#!/bin/bash
# tamper.sh - Delete packet(s) from evidence.pcap by specifying what to KEEP

TARGET="evidence/evidence.pcap"
TEMP="evidence/_tmp.pcap"

if [ ! -f "$TARGET" ]; then
  echo "Error: $TARGET not found. Run capture.sh first."
  exit 1
fi

TOTAL=$(tshark -r "$TARGET" | wc -l)
echo "=== Evidence Tampering Simulator ==="
echo "Current packet count: $TOTAL"
echo ""
echo "Enter the packet range(s) to KEEP (editcap syntax)."
echo "Example: 1-10 20-33   (this deletes packets 11-19)"
read -p "Ranges to keep: " KEEP

editcap -r "$TARGET" "$TEMP" $KEEP

if [ ! -f "$TEMP" ]; then
  echo "Error: editcap failed, no output produced. evidence.pcap left untouched."
  exit 1
fi

mv "$TEMP" "$TARGET"

echo ""
echo "evidence.pcap updated — now contains only: $KEEP"
NEW_TOTAL=$(tshark -r "$TARGET" | wc -l)
echo "New packet count: $NEW_TOTAL (was $TOTAL)"
