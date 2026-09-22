const hre = require("hardhat");
const { execSync } = require("child_process");
const fs = require("fs");
const { sha256, getRoot } = require("../merkle.js");

const { address: CONTRACT_ADDRESS } = JSON.parse(fs.readFileSync("contract-address.json"));
const PCAP_FILE = "evidence/evidence.pcap";
const RECORDS_FILE = "evidence/records.json";

async function main() {
  // Step 1: recompute hashes from the CURRENT file
  const rawOutput = execSync(
    `tshark -r ${PCAP_FILE} -T fields -E separator=/t ` +
    `-e frame.time_epoch -e ip.src -e ip.dst ` +
    `-e tcp.dstport -e dns.qry.name -e tls.handshake.extensions_server_name`
  ).toString();

  const lines = rawOutput.trim().split("\n");
  console.log(`Current file has ${lines.length} packets.`);

  const currentHashes = [];
  for (let index = 0; index < lines.length; index++) {
    const cols = lines[index].split("\t");
    const [timeEpoch, srcIp, dstIp, dstPort, dnsQuery, tlsSni] = cols;
    const info = dnsQuery || tlsSni || (dstPort ? `port:${dstPort}` : "N/A");
    const record = `${timeEpoch}|${srcIp}|${dstIp}|${dstPort}|${info}`;
    currentHashes.push(sha256(record));
  }

  // Step 2: check the on-chain root against the LOCAL records.json's root
  // (this proves whether records.json itself is trustworthy)
  const originalRecords = JSON.parse(fs.readFileSync(RECORDS_FILE));
  const originalHashes = originalRecords.map(r => r.hash);
  const localRoot = getRoot(originalHashes);

  const [signer] = await hre.ethers.getSigners();
  const registry = await hre.ethers.getContractAt("PacketRegistry", CONTRACT_ADDRESS, signer);

  const onChainRoot = (await registry.getRoot()).slice(2); // strip "0x"
  const onChainCount = await registry.getPacketCount();

  console.log(`On-chain root:  0x${onChainRoot}`);
  console.log(`Local root:     0x${localRoot}`);

  if (onChainRoot !== localRoot) {
    console.log("\n🚨 records.json itself does not match the anchored root — reference file may be compromised!");
    return;
  }
  console.log("✅ records.json verified against blockchain — reference file is trustworthy.\n");

  // Step 3: compare current file's hashes against records.json to find WHICH packet changed
  let tamperedFound = false;
  let currentIndex = 0;
  const missingPackets = [];

  for (let i = 0; i < originalHashes.length; i++) {
    if (currentIndex < currentHashes.length && currentHashes[currentIndex] === originalHashes[i]) {
      currentIndex++;
    } else {
      tamperedFound = true;
      const meta = originalRecords[i];
      missingPackets.push(meta);
    }
  }

  const countMismatch = Number(onChainCount) !== currentHashes.length;

  if (missingPackets.length > 0) {
    console.log(`❌ TAMPERING DETECTED — ${missingPackets.length} packet(s) missing from evidence file:\n`);
    missingPackets.forEach(p => {
      console.log(`   Packet #${p.packetNumber} — ${p.info} (${p.srcIp} → ${p.dstIp})`);
    });
  }

  if (!tamperedFound && !countMismatch) {
    console.log("✅ Evidence integrity verified — no tampering detected.");
  } else {
    console.log("\n🚨 Evidence integrity check FAILED — chain of custody has been broken.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
