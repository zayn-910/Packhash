const hre = require("hardhat");
const { execSync } = require("child_process");
const fs = require("fs");
const { sha256, getRoot } = require("../merkle.js");

const { address: CONTRACT_ADDRESS } = JSON.parse(fs.readFileSync("contract-address.json"));
const PCAP_FILE = "evidence/evidence.pcap";
const RECORDS_FILE = "evidence/records.json";

async function main() {
  const rawOutput = execSync(
    `tshark -r ${PCAP_FILE} -T fields -E separator=/t ` +
    `-e frame.time_epoch -e ip.src -e ip.dst ` +
    `-e tcp.dstport -e dns.qry.name -e tls.handshake.extensions_server_name`
  ).toString();

  const lines = rawOutput.trim().split("\n");
  console.log(`Extracted ${lines.length} packets from ${PCAP_FILE}`);

  const leafHashes = [];
  const records = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const cols = line.split("\t");
    const [timeEpoch, srcIp, dstIp, dstPort, dnsQuery, tlsSni] = cols;
    const info = dnsQuery || tlsSni || (dstPort ? `port:${dstPort}` : "N/A");
    const record = `${timeEpoch}|${srcIp}|${dstIp}|${dstPort}|${info}`;
    const hash = sha256(record);

    leafHashes.push(hash);
    records.push({ packetNumber: index + 1, timeEpoch, srcIp, dstIp, dstPort, info, hash });
  }

  // Save full detail locally — this is what lets verify.js pinpoint WHICH packet changed
  fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
  console.log(`Saved local reference snapshot to ${RECORDS_FILE}`);

  // Build Merkle tree, get single root
  const root = getRoot(leafHashes);
  console.log(`Computed Merkle root: 0x${root}`);

  // Anchor ONLY the root on-chain — cheap, constant gas regardless of packet count
  const [signer] = await hre.ethers.getSigners();
  const registry = await hre.ethers.getContractAt("PacketRegistry", CONTRACT_ADDRESS, signer);

  const tx = await registry.anchorRoot("0x" + root, leafHashes.length);
  await tx.wait();

  console.log(`✅ Anchored Merkle root for ${leafHashes.length} packets.`);
  console.log("Transaction hash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
