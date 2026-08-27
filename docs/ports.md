# Local Service Ports

| Component | Port | Protocol | Notes |
|---|---:|---|---|
| Next.js Web | 3000 | HTTP | Frontend |
| API Gateway | 8080 | HTTP | Main API entry point |
| Identity Service | 8081 | HTTP | Auth / identity |
| Household Service | 8082 | HTTP | Household management |
| Meter Service | 8083 | HTTP | Meter management |
| Reading Service | 8084 | HTTP | Reading management |
| PostgreSQL | 5432 | TCP | Shared local instance, if used |
| Kafka | 9092 | TCP | Planned |
| Redis | 6379 | TCP | Planned |
| Prometheus | 9090 | HTTP | Planned |
| Grafana | 3001 | HTTP | Planned |

### Rules

- Ports `3000` and `8080` are reserved for the frontend and gateway.
- Backend services use `8081+` sequentially.
- Infrastructure uses its conventional default ports where practical.
- The port listed here is the host port. Container-to-container communication should use the container/service name and the container port.
