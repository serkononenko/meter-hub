# Local Service Ports

| Component         | Internal DNS      | Internal Port | External Port | Protocol | Notes                                                                                              |
|-------------------|-------------------|--------------:|--------------:|----------|----------------------------------------------------------------------------------------------------|
| Next.js Web       | web               |          3000 |          3000 | HTTP     | Frontend                                                                                           |
| API Gateway       | api-gateway       |          8080 |          8080 | HTTP     | Main API entry point; prod binds to loopback only                                                  |
| Identity Service  | identity-service  |          8081 |             - | HTTP     | Auth / identity                                                                                    |
| Household Service | household-service |          8082 |             - | HTTP     | Household management                                                                               |
| Meter Service     | meter-service     |          8083 |             - | HTTP     | Meter management                                                                                   |
| Reading Service   | reading-service   |          8084 |             - | HTTP     | Reading management                                                                                 |
| PostgreSQL        | postgres          |          5432 |          5432 | TCP      | Shared local instance; prod binds to loopback only                                                 |
| Prometheus        | prometheus        |          9090 |          9090 | HTTP     | Scrapes the services' metric endpoints                                                             |
| Grafana           | grafana           |          3000 |          3001 | HTTP     | Dashboards over Prometheus; prod publishes loopback-only on 13001 |
| Jaeger            | jaeger            |         16686 |         16686 | HTTP     | Trace UI; OTLP collector on 4318 (internal only)                                                   |
| Loki              | loki              |          3100 |             - | HTTP     | Log storage; pushed to by Promtail (internal only)                                                 |

### Rules

- Ports `3000` and `8080` are reserved for the frontend and gateway.
- Backend services use `8081+` sequentially.
- Infrastructure uses its conventional default ports where practical.
- The Grafana host port is `3001` because the container port `3000` is already taken by the web app on the host. In prod it is `13001` instead — home-server UIs (CasaOS-family backends) commonly bind `127.0.0.1:3001`.
- The port listed here is the host port. Container-to-container communication should use the container/service name and the container port.

> **Prod binding.** In `docker-compose.portainer.yml` (the production
> deployment), exactly two host ports are published, both on all
> interfaces: the web app on `13000` (container port stays 3000) and
> Grafana on `13001` (protected by its admin login from `stack.env`).
> Everything else is internal — `api-gateway` has no host port (the
> browser reaches the API through the web app's `/api/*` proxy), and
> Jaeger, Prometheus, and Postgres have no host port at all: reach
> them from inside the network (Grafana datasources, `docker exec`),
> not from the host. See `docs/deploy-portainer.md`.

| Kafka             | —                 |          9092 |             - | TCP      | Planned                                  |
| Redis             | —                 |          6379 |             - | TCP      | Planned                                  |
