#!/bin/bash
# ============================================
# LOCAL PREPROCESSING SCRIPT
# Filters, deduplicates, and prepares files for upload
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage
usage() {
    echo "Usage: $0 <input_directory> [output_directory]"
    echo ""
    echo "Preprocesses legal documents for upload to Chitty Evidence Platform."
    echo ""
    echo "Arguments:"
    echo "  input_directory   Directory containing documents to process"
    echo "  output_directory  Output directory (default: ./preprocessed)"
    echo ""
    echo "Output:"
    echo "  - MANIFEST.csv with file hashes"
    echo "  - Deduplicated files renamed to their hash"
    echo "  - STATS.txt with processing summary"
    exit 1
}

# Check arguments
if [ -z "$1" ]; then
    usage
fi

INPUT_DIR="$1"
OUTPUT_DIR="${2:-./preprocessed}"
MANIFEST="$OUTPUT_DIR/MANIFEST.csv"
STATS="$OUTPUT_DIR/STATS.txt"
DUPLICATES="$OUTPUT_DIR/DUPLICATES.txt"

# Validate input directory
if [ ! -d "$INPUT_DIR" ]; then
    echo -e "${RED}Error: Input directory does not exist: $INPUT_DIR${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Initialize files
echo "file_path,sha256,size_bytes,mime_type,original_name" > "$MANIFEST"
echo "" > "$DUPLICATES"

# Counters
TOTAL=0
PROCESSED=0
SKIPPED_TYPE=0
SKIPPED_DUP=0
SKIPPED_SIZE=0
SKIPPED_JUNK=0

# Declare associative array for hash deduplication
declare -A SEEN_HASHES

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Chitty Evidence Preprocessor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Input:  ${YELLOW}$INPUT_DIR${NC}"
echo -e "Output: ${YELLOW}$OUTPUT_DIR${NC}"
echo ""
echo -e "${BLUE}Scanning files...${NC}"

# Find all files
while IFS= read -r -d '' file; do
    TOTAL=$((TOTAL + 1))

    # Get filename
    basename=$(basename "$file")

    # Skip hidden files
    if [[ "$basename" == .* ]]; then
        SKIPPED_JUNK=$((SKIPPED_JUNK + 1))
        continue
    fi

    # Skip known junk files
    case "$basename" in
        "Thumbs.db"|"desktop.ini"|".DS_Store"|"*.tmp"|"~*")
            SKIPPED_JUNK=$((SKIPPED_JUNK + 1))
            continue
            ;;
    esac

    # Get file extension
    ext="${basename##*.}"
    ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

    # Filter by allowed types
    case "$ext_lower" in
        pdf|png|jpg|jpeg|tiff|tif|webp)
            # Allowed
            ;;
        *)
            SKIPPED_TYPE=$((SKIPPED_TYPE + 1))
            continue
            ;;
    esac

    # Check file size (skip files < 1KB or > 100MB)
    size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ "$size" -lt 1024 ]; then
        SKIPPED_SIZE=$((SKIPPED_SIZE + 1))
        continue
    fi
    if [ "$size" -gt 104857600 ]; then
        echo -e "${YELLOW}Warning: Skipping large file (>100MB): $file${NC}"
        SKIPPED_SIZE=$((SKIPPED_SIZE + 1))
        continue
    fi

    # Compute SHA-256 hash
    if command -v shasum &> /dev/null; then
        hash=$(shasum -a 256 "$file" | cut -d' ' -f1)
    else
        hash=$(sha256sum "$file" | cut -d' ' -f1)
    fi

    # Check for duplicate
    if [ -n "${SEEN_HASHES[$hash]}" ]; then
        echo "$file -> duplicate of ${SEEN_HASHES[$hash]}" >> "$DUPLICATES"
        SKIPPED_DUP=$((SKIPPED_DUP + 1))
        continue
    fi

    # Mark hash as seen
    SEEN_HASHES[$hash]="$file"

    # Get mime type
    if command -v file &> /dev/null; then
        mime=$(file --mime-type -b "$file")
    else
        case "$ext_lower" in
            pdf) mime="application/pdf" ;;
            png) mime="image/png" ;;
            jpg|jpeg) mime="image/jpeg" ;;
            tiff|tif) mime="image/tiff" ;;
            webp) mime="image/webp" ;;
            *) mime="application/octet-stream" ;;
        esac
    fi

    # Copy file to output directory with hash as name
    output_file="$OUTPUT_DIR/${hash}.${ext_lower}"
    cp "$file" "$output_file"

    # Add to manifest
    echo "$output_file,$hash,$size,$mime,$basename" >> "$MANIFEST"

    PROCESSED=$((PROCESSED + 1))

    # Progress indicator
    if [ $((PROCESSED % 100)) -eq 0 ]; then
        echo -e "  Processed ${GREEN}$PROCESSED${NC} files..."
    fi

done < <(find "$INPUT_DIR" -type f -print0)

# Write stats
echo "========================================" > "$STATS"
echo "Preprocessing Summary" >> "$STATS"
echo "========================================" >> "$STATS"
echo "Date: $(date)" >> "$STATS"
echo "Input Directory: $INPUT_DIR" >> "$STATS"
echo "" >> "$STATS"
echo "Files Scanned:    $TOTAL" >> "$STATS"
echo "Files Processed:  $PROCESSED" >> "$STATS"
echo "Duplicates:       $SKIPPED_DUP" >> "$STATS"
echo "Wrong Type:       $SKIPPED_TYPE" >> "$STATS"
echo "Wrong Size:       $SKIPPED_SIZE" >> "$STATS"
echo "Junk Files:       $SKIPPED_JUNK" >> "$STATS"
echo "========================================" >> "$STATS"

# Print summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Preprocessing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Files scanned:    ${YELLOW}$TOTAL${NC}"
echo -e "  Files processed:  ${GREEN}$PROCESSED${NC}"
echo -e "  Duplicates found: ${YELLOW}$SKIPPED_DUP${NC}"
echo -e "  Wrong type:       ${YELLOW}$SKIPPED_TYPE${NC}"
echo -e "  Wrong size:       ${YELLOW}$SKIPPED_SIZE${NC}"
echo -e "  Junk files:       ${YELLOW}$SKIPPED_JUNK${NC}"
echo ""
echo -e "Output files:"
echo -e "  ${BLUE}$MANIFEST${NC}"
echo -e "  ${BLUE}$STATS${NC}"
if [ "$SKIPPED_DUP" -gt 0 ]; then
    echo -e "  ${BLUE}$DUPLICATES${NC}"
fi
echo ""
echo -e "Next step: Run ${GREEN}npm run bulk-upload${NC} to upload to the platform."
