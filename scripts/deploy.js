const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const PacketRegistry = await hre.ethers.getContractFactory("PacketRegistry");
  const registry = await PacketRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("PacketRegistry deployed to:", address);

  // Save address so anchor.js and verify.js can read it automatically
  fs.writeFileSync("contract-address.json", JSON.stringify({ address }, null, 2));
  console.log("Address saved to contract-address.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
