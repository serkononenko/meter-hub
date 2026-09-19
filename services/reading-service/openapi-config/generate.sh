#!/bin/bash

echo "🔄 Clearing old folder..."
rm -rf "./src/reading/generated"

echo "🚀 Launching typescript-nestjs-server server generation..."
npx @openapitools/openapi-generator-cli generate \
  -i "../../contracts/openapi/services/reading-service/openapi.yaml" \
  -g typescript-nestjs-server \
  -o "./src/reading/generated" \
  -c "./openapi-config/reading-server.json"

# The typescript-nestjs-server generator emits extensionless relative imports,
# which break under "moduleResolution": "nodenext" with ESM. Resolve directory
# barrels (api/, controllers/, decorators/, models/) to /index and append .js.
find "./src/reading/generated" -name '*.ts' -exec sed -i '' -E \
  -e "s#from '(\.\.?/)(api|controllers|decorators|models)'#from '\1\2/index'#g" \
  -e "s#(from '\.\.?/[^']*)'#\1.js'#g" {} +

# Model types referenced in decorated controller signatures must be type-only
# imports under "isolatedModules" + "emitDecoratorMetadata" (TS1272).
find "./src/reading/generated/controllers" -name '*.ts' -exec sed -i '' -E \
  -e "/from '\.\.\/models\/index\.js'/s/import \{/import type {/" {} +

echo "🚀 Launching typescript-fetch client generation for meter-service..."
mkdir -p "./src/meter/generated"
npx @openapitools/openapi-generator-cli generate \
  -i "../../contracts/openapi/services/meter-service/openapi.yaml" \
  -g typescript-fetch \
  -o "./src/meter/generated" \
  -c "./openapi-config/meter-client.json"

echo "✅ Successfully generated"
