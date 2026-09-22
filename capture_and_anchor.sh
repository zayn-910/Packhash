#!/bin/bash
# capture.sh - Capture live network packets as evidence
# deploy
npx hardhat run scripts/deploy.js --network localhost

INTERFACE="enp0s3"
DURATION=10
OUTPUT="evidence/evidence.pcap"

echo "=== Packet Capture ==="
echo "Capturing for ${DURATION}s on $INTERFACE..."
echo "Browse a couple of sites now."

tshark -i "$INTERFACE" -a duration:"$DURATION" -f "tcp port 443 or udp port 53" -w "$OUTPUT"

echo ""
echo "Capture complete. Saved to $OUTPUT"
COUNT=$(tshark -r "$OUTPUT" | wc -l)
echo "Total packets captured: $COUNT"


# anchor
npx hardhat run scripts/anchor.js --network localhost
