#!/bin/bash
# Run this from the project folder to create a local SQL backup
# Usage: bash backup-db.sh

set -a
source .env
set +a

DATE=$(date +"%Y-%m-%d_%H-%M")
FILENAME="backup_${DATE}.sql"

echo "Creating backup: $FILENAME"

pg_dump "$DIRECT_URL" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  > "$FILENAME"

echo "Done! Saved as $FILENAME"
