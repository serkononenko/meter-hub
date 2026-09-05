# MeterHub OpenAPI Contracts

This directory contains the initial shared OpenAPI contract structure for MeterHub.

## Structure

```text
openapi/
├── openapi.yaml
├── components/
│   ├── headers/
│   │   └── correlation-id.yaml
│   └── schemas/
│       └── problem.yaml
└── services/
    └── identity-service/
        └── openapi.yaml
```

Each service keeps its own contract under `services/<service-name>/openapi.yaml`. Service contracts may reference the shared components in `components/` and the root document, but should define their domain-specific schemas locally.

## Rules

- Service APIs use `/api/v1/...`.
- IDs use UUID v4.
- Timestamps use UTC RFC 3339 with a `Z` suffix.
- Errors use `application/problem+json`.
- `X-Correlation-ID` is used for request tracing.
- Service-specific contracts should reuse these definitions instead of introducing alternative formats.

The root contract is intentionally small. Domain-specific paths should be added as individual services are implemented.
