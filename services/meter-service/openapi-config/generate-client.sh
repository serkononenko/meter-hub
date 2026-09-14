#!/bin/bash

INPUT_SPEC="../../contracts/openapi/services/household-service/openapi.yaml"
OUTPUT_DIR="./src/household/generated"
CONFIG_FILE="./openapi-config/household-client.json"

echo "🔄 Clearing old client folder..."
rm -rf "$OUTPUT_DIR"

echo "🚀 Launching typescript-fetch client generation..."
npx @openapitools/openapi-generator-cli generate \
  -i "$INPUT_SPEC" \
  -g typescript-fetch \
  -o "$OUTPUT_DIR" \
  -c "$CONFIG_FILE"

echo "✅ Client successfully generated in $OUTPUT_DIR"
