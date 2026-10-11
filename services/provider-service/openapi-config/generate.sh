#!/bin/bash

echo "🔄 Clearing old folders..."
rm -rf "./src/generated/provider"
rm -rf "./src/generated/household"
rm -rf "./src/generated/meter"

echo "🚀 Launching typescript-nestjs-server generation..."
npx @openapitools/openapi-generator-cli generate \
  -i "../../contracts/openapi/services/provider-service/openapi.yaml" \
  -g typescript-nestjs-server \
  -o "./src/generated/provider" \
  -c "./openapi-config/provider-server.json"

# typescript-nestjs-server emits extensionless relative imports, which break under
# "moduleResolution": "nodenext" with ESM. Resolve directory barrels to /index and append .js.
find "./src/generated/provider" -name '*.ts' -exec sed -i '' -E \
  -e "s#from '(\.\.?/)(api|controllers|decorators|models)'#from '\1\2/index'#g" \
  -e "s#(from '\.\.?/[^']*)'#\1.js'#g" {} +

# Model types in decorated controller signatures must be type-only imports under
# "isolatedModules" + "emitDecoratorMetadata" (TS1272).
find "./src/generated/provider/controllers" -name '*.ts' -exec sed -i '' -E \
  -e "/from '\.\.\/models\/index\.js'/s/import \{/import type {/" {} +

echo "🚀 Launching typescript-fetch client generation for household-service..."
mkdir -p "./src/generated/household"
npx @openapitools/openapi-generator-cli generate \
  -i "../../contracts/openapi/services/household-service/openapi.yaml" \
  -g typescript-fetch \
  -o "./src/generated/household" \
  -c "./openapi-config/household-client.json"

echo "🚀 Launching typescript-fetch client generation for meter-service..."
mkdir -p "./src/generated/meter"
npx @openapitools/openapi-generator-cli generate \
  -i "../../contracts/openapi/services/meter-service/openapi.yaml" \
  -g typescript-fetch \
  -o "./src/generated/meter" \
  -c "./openapi-config/meter-client.json"

echo "✅ Successfully generated"
