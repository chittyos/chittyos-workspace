#!/bin/bash
# Verify term certification against ChittyCanon
# Usage: ./scripts/canon-verify.sh <term_name>
#
# This script checks if a term is registered in ChittyCanon.
# Run this when Claude is blocked by the certification gate.

set -e

CANON_URL="https://canon.chitty.cc/api/terms"
TERM="$1"

if [ -z "$TERM" ]; then
    echo "Usage: ./scripts/canon-verify.sh <term_name>"
    echo "Example: ./scripts/canon-verify.sh evidence_collection"
    exit 1
fi

echo "Checking ChittyCanon for term: $TERM"
echo ""

# Check if term exists
RESULT=$(curl -s "$CANON_URL" | jq -r --arg term "$TERM" '.terms[] | select(.name == $term)')

if [ -n "$RESULT" ]; then
    STAGE=$(echo "$RESULT" | jq -r '.stage')
    DEFINITION=$(echo "$RESULT" | jq -r '.definition')
    TERM_ID=$(echo "$RESULT" | jq -r '.term_id')

    echo "✅ CERTIFIED - Term found in ChittyCanon"
    echo ""
    echo "Term ID:    $TERM_ID"
    echo "Stage:      $STAGE"
    echo "Definition: $DEFINITION"
    echo ""
    echo "Tell Claude: \"Term '$TERM' is certified (stage: $STAGE). Proceed.\""
else
    echo "❌ NOT CERTIFIED - Term not found in ChittyCanon"
    echo ""
    echo "To propose this term:"
    echo ""
    cat << EOF
curl -X POST "https://canon.chitty.cc/api/terms/propose" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "$TERM",
    "definition": "YOUR_DEFINITION_HERE",
    "domain": ["your", "domains"],
    "category": "core_type",
    "proposer": "your-service",
    "service": "chittyos",
    "gap_filled": "Why this term is needed",
    "not_for": ["What this term should NOT be used for"]
  }'
EOF
    echo ""
    echo "After proposing, re-run this script to verify."
    exit 1
fi
