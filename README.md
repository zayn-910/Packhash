# Blockchain-Based Integrity Verification for Network Packet Captures

A proof-of-concept system that demonstrates how blockchain can be used to detect
tampering with network packet capture (`.pcap`) evidence — relevant to digital
forensics and chain-of-custody scenarios in cybersecurity.

## Problem

Once network traffic is captured as evidence (e.g., during an incident
investigation), the captured file must remain provably unaltered. An attacker
or malicious insider with access to the storage location could selectively
delete packets to hide evidence of their activity — without needing to delete
the entire file, which would be far more noticeable.

This project anchors a cryptographic fingerprint of captured packets on a
blockchain at the time of capture, so any later tampering — even the removal
of a single packet — becomes detectable.

## How it works

1. **Capture** — live network traffic is captured using `tshark` and saved as
   a `.pcap` file.
2. **Hash** — each packet's key fields (timestamp, source/destination IP,
   port, domain) are extracted and hashed individually (SHA-256).
3. **Merkle Tree** — all individual packet hashes are combined into a single
   Merkle root, keeping on-chain storage constant regardless of how many
   packets were captured.
4. **Anchor** — the Merkle root is stored on a local Ethereum blockchain
   (via a Solidity smart contract) at the moment of capture. Once anchored,
   it cannot be altered or overwritten.
5. **Verify** — at any later point, the current `.pcap` file is re-hashed and
   compared against the original local record (`records.json`) and the
   on-chain root. Any missing or altered packet is detected and reported,
   including its timestamp, source/destination IP, and domain — pinpointing
   exactly what was tampered with.

## Tech stack

- **Solidity** — smart contract (`PacketRegistry.sol`)
- **Hardhat** — local Ethereum network, contract deployment
- **Ethers.js** — blockchain interaction from Node.js scripts
- **Wireshark / tshark / editcap** — packet capture and manipulation
- **Node.js** — hashing, Merkle tree construction, verification logic

Everything runs locally — no real cryptocurrency, no cloud services, no
external APIs, no cost of any kind.

## Project structure

```
├── contracts/
│   └── PacketRegistry.sol     # Stores the Merkle root on-chain
├── scripts/
│   ├── deploy.js              # Deploys the contract
│   ├── anchor.js              # Hashes packets, builds Merkle tree, anchors root
│   └── verify.js              # Detects and reports tampering
├── evidence/
│   ├── evidence.pcap          # Captured traffic (not committed — see .gitignore)
│   └── records.json           # Local detailed record of all packet hashes
├── merkle.js                  # Merkle tree construction helper
├── capture_and_anchor.sh      # Capture + deploy + anchor in one step
├── tamper.sh                  # Simulates evidence tampering (deletes packets)
├── run.sh                     # Convenience wrapper for deploy/anchor/verify
└── hardhat.config.js
```

## Requirements

- Node.js (LTS)
- Wireshark (provides `tshark` and `editcap`)
- A Linux environment (tested on Ubuntu)

## Setup

**1. Install prerequisites** (skip any already installed):

```bash
# Update package lists
sudo apt update

# Install Node.js (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Install Wireshark (provides tshark and editcap)
sudo apt install -y wireshark
```

During the Wireshark install, when asked *"Should non-superusers be able to
capture packets?"*, select **Yes**. Then add your user to the `wireshark`
group so `tshark` can run without `sudo`:
```bash
sudo usermod -aG wireshark $USER
```
Log out and log back in (or reboot) for this to take effect.

Verify everything installed correctly:
```bash
node -v
tshark -v
editcap -v
```

**2. Clone the repository:**
```bash
git clone https://github.com/zayn-910/Packhash.git
cd Packhash
```

**3. Install project dependencies:**
```bash
npm install
```

**4. Compile the smart contract:**
```bash
npx hardhat compile
```
## Usage (manual, step by step)

**1. Start a local blockchain.** Keep this running in its own terminal for
the rest of the session — restarting it wipes all deployed contracts and
anchored data:
```bash
npx hardhat node
```

**2. Deploy the smart contract** (in a second terminal):
```bash
npx hardhat run scripts/deploy.js --network localhost
```
This writes the deployed contract's address to `contract-address.json`,
which the next scripts read automatically.

**3. Capture network traffic:**
```bash
tshark -i <interface> -a duration:30 -f "tcp port 443 or udp port 53" -w evidence/evidence.pcap
```
Replace `<interface>` with your network interface name (find it with
`tshark -D`). This captures packets and stops after 30 seconds and saves them to `evidence/evidence.pcap`.

**4. Hash the captured packets and anchor the Merkle root on-chain:**
```bash
npx hardhat run scripts/anchor.js --network localhost
```
This extracts each packet's fields via `tshark`, hashes them individually,
saves full details to `evidence/records.json`, builds a Merkle tree from
all the hashes, and anchors only the resulting root on the blockchain.

**5. Simulate evidence tampering** by removing packets from
`evidence/evidence.pcap` directly with `editcap`. For example, to keep only
packets 1-50 and 55-60 (deleting packets 51-54):
```bash
editcap -r evidence/evidence.pcap evidence/_tmp.pcap 1-50 55-60
mv evidence/_tmp.pcap evidence/evidence.pcap
```
(Writing to a temporary file first and renaming it avoids corrupting the
file mid-edit, since `editcap` cannot safely read and write the same file
at once.)

**6. Verify integrity:**
```bash
npx hardhat run scripts/verify.js --network localhost
```
This re-hashes the current `evidence.pcap`, checks the local reference file
(`records.json`) against the on-chain root, then compares packet-by-packet
to report exactly which packet(s) are missing or altered — including their
timestamp, source/destination IP, and domain where available.

## Convenience scripts

The steps above are wrapped into shell scripts for faster repeated use
during development and demos:

| Script | Equivalent to |
|---|---|
| `./capture_and_anchor.sh` | Steps 2-4 combined, run back-to-back |
| `./tamper.sh` | Step 5, prompts for which packet ranges to keep |
| `./verify.sh` | Step 6, verify packets |

These are optional — the manual commands above work identically and are
useful for understanding exactly what each step does.
## Design notes and known limitations

- **Threat model**: this protects evidence *after* it has been captured and
  anchored. It assumes an adversary with write access to the stored evidence
  file (e.g., a compromised analyst machine or logging server) — it does not
  protect the original remote endpoints, and it does not prevent tampering
  that occurs before anchoring completes.
- **Two-layer verification**: the on-chain Merkle root verifies that the
  local reference file (`records.json`) itself hasn't been forged; a
  separate packet-by-packet comparison against that reference detects
  tampering in the actual evidence file.
- **Capture-to-anchor gap**: there is a brief window between when a packet is
  captured and when its hash is anchored on-chain. `capture_and_anchor.sh`
  minimizes this by running both steps back-to-back automatically.
- **Scalability**: using a Merkle root instead of storing individual packet
  hashes on-chain keeps gas cost constant regardless of capture size.

## Future scope

- Chained anchors (each new capture session's root incorporates the previous
  root, so tampering with old evidence invalidates the entire subsequent
  chain — similar to how blocks are linked in a real blockchain).
- Hierarchical hourly/daily rollup anchoring for long-term scalability.
- Live/streaming hash-and-anchor to further reduce the capture-to-anchor gap.
- Integration with real distributed blockchain networks instead of a local
  simulated chain.
