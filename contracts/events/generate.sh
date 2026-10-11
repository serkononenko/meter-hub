#!/bin/bash
# Generates TypeScript types from the event JSON Schemas under contracts/events/
# into the services that produce or consume them. Mirrors the OpenAPI →
# generated-client flow (services/*/openapi-config/generate.sh), but uses
# json-schema-to-typescript (json2ts) — run from a service that has it as a
# devDependency, or with npx.
#
# Usage: contracts/events/generate.sh <path-to-a-service-root> [domain...]
# Domains are the subdirectories of contracts/events/ (default: meter).
# Run from the repo root:
#   contracts/events/generate.sh services/reading-service
#   contracts/events/generate.sh services/provider-service provider
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "usage: $0 <service-root> [domain...]" >&2
    exit 1
fi

SERVICE_ROOT=$1
shift
DOMAINS=("${@:-meter}")
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO_ROOT/$SERVICE_ROOT/src/generated/events"

mkdir -p "$OUT"

echo "🔄 Generating event types into $SERVICE_ROOT/src/generated/events ..."
for DOMAIN in "${DOMAINS[@]}"; do
    for SCHEMA in "$REPO_ROOT"/contracts/events/"$DOMAIN"/*.schema.json; do
        NAME="$(basename "$SCHEMA" .json).ts"
        npx --prefix "$REPO_ROOT/$SERVICE_ROOT" json2ts \
            --bannerComment "/* Generated from contracts/events/ — do not edit. */" \
            "$SCHEMA" \
            "$OUT/$NAME"
    done
done

echo "✅ Done: $OUT"
