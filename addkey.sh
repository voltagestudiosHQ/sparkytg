#!/bin/bash
set -euo pipefail

# Usage: ./addkey.sh NAME value
# Creates or updates tgcloud/lib/secrets.js with the given key-value pair

NAME="$1"
VALUE="$2"
SECRETS_FILE="tgcloud/lib/secrets.js"

# Escape for a single-quoted JS string literal: backslashes, single
# quotes, and newlines (so multi-line prompts stay valid JS)
VALUE_ESC=$(node -e '
const BS = String.fromCharCode(92), Q = String.fromCharCode(39);
const v = process.argv[1] || "";
process.stdout.write(
  v.split(BS).join(BS + BS).split(Q).join(BS + Q).replace(/\r?\n/g, BS + "n")
);
' "$VALUE")

# Create directory if it doesn't exist
mkdir -p tgcloud/lib

# Create file with header comment if it doesn't exist
if [ ! -f "$SECRETS_FILE" ]; then
  echo "// Local secrets - git-ignored. See secrets.example.js" > "$SECRETS_FILE"
  echo "" >> "$SECRETS_FILE"
fi

# Use temp file for atomic update
TEMP_FILE=$(mktemp)

# Process the file
HAS_EXPORT=0
while IFS= read -r line; do
  if echo "$line" | grep -q "export const $NAME = "; then
    echo "export const $NAME = '$VALUE_ESC';" >> "$TEMP_FILE"
    HAS_EXPORT=1
  else
    echo "$line" >> "$TEMP_FILE"
  fi
done < "$SECRETS_FILE"

# If no existing export, append it
if [ "$HAS_EXPORT" -eq 0 ]; then
  echo "" >> "$TEMP_FILE"
  echo "export const $NAME = '$VALUE_ESC';" >> "$TEMP_FILE"
fi

# Atomic move
mv "$TEMP_FILE" "$SECRETS_FILE"

echo "Updated $NAME in $SECRETS_FILE"
