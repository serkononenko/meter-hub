# Local Service Ports

| Component         | Internal DNS      | Internal Port | External Port | Protocol | Notes                          |
|-------------------|-------------------|--------------:|--------------:|----------|--------------------------------|
| Next.js Web       | web               |          3000 |          3000 | HTTP     | Frontend                       |
| API Gateway       | api-gateway       |          8080 |          8080 | HTTP     | Main API entry point           |
| Identity Service  | identity-service  |          8081 |             - | HTTP     | Auth / identity                |
| Household Service | household-service |          8082 |             - | HTTP     | Household management           |
| Meter Service     | meter-service     |          8083 |             - | HTTP     | Meter management               |
| Reading Service   | reading-service   |          8084 |             - | HTTP     | Reading management             |
| PostgreSQL        | postgres          |          5432 |          5432 | TCP      | Shared local instance, if used |
| Kafka             | —                 |          9092 |             - | TCP      | Planned                        |
| Redis             | —                 |          6379 |             - | TCP      | Planned                        |
| Prometheus        | —                 |          9090 |             - | HTTP     | Planned                        |
| Grafana           | —                 |          3001 |             - | HTTP     | Planned                        |

### Rules

- Ports `3000` and `8080` are reserved for the frontend and gateway.
- Backend services use `8081+` sequentially.
- Infrastructure uses its conventional default ports where practical.
- The port listed here is the host port. Container-to-container communication should use the container/service name and the container port.
