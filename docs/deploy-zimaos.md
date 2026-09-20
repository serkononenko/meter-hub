# Deploying MeterHub on a ZimaOS home server

The whole platform is one Docker Compose project — no JDK, Node, or
database installation needed on the device. ZimaOS ships Docker and
Compose, so deployment is: clone → configure → `compose up`.

Two ways to run:

| Mode | Command | When to use |
|---|---|---|
| **Build on device** | `docker-compose up -d --build` | First deploy, or when you want to run unmerged local changes. Slow on mini-PC hardware (Gradle + npm builds in Docker). |
| **Pull prebuilt images** | `docker-compose -f docker-compose.yml -f compose.prod.yml pull && docker-compose -f docker-compose.yml -f compose.prod.yml up -d` | Day-to-day updates. Images are built by CI (`publish.yml`) on every green `main` push. Seconds, not minutes. |

> **ZimaOS CLI note.** ZimaOS ships Compose as the standalone
> `docker-compose` binary, not the `docker compose` plugin — use the
> hyphenated form everywhere. If you also see
> `Error loading config file: /DATA/.docker/config.json: permission
> denied`, export `DOCKER_CONFIG=$HOME/.docker` first (or run with
> `sudo`); the warning is noise, but the export makes it go away.

## 1. Get the repository onto the device

SSH into ZimaOS (Settings → SSH in its web UI shows the connect
command), then:

```bash
git clone https://github.com/serkononenko/meter-hub.git
cd meter-hub
```

If `git` is unavailable on the device, clone on another machine and
copy the directory over (`scp -r meter-hub zima@<pc-ip>:~/`).

## 2. Configure (same as local setup, once)

```bash
cp .env.example .env          # fill the password placeholders
mkdir -p certs
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out certs/identity.jwt.private-key
openssl pkey -in certs/identity.jwt.private-key -pubout \
  -out certs/identity.jwt.public-key
```

The keys are read by the services through Docker Compose secrets — no
symlinks needed on a compose-only deploy (the per-service `certs`
symlinks from the README are only for running services outside Docker).

## 3. Start

Build-on-device mode:

```bash
docker-compose up -d --build
```

Or pull mode (recommended after the first run):

```bash
docker-compose -f docker-compose.yml -f compose.prod.yml pull
docker-compose -f docker-compose.yml -f compose.prod.yml up -d
```

First build/pull takes a while; later updates are incremental.

## 4. Verify

Only the web app is reachable from other machines. From the device
itself (or via an SSH tunnel — see below):

| URL | What |
|---|---|
| `http://<pc-ip>:13000` | Web app (works from any LAN machine) |
| `http://localhost:8080` is **not** published in prod — the browser reaches the API through the web app's `/api/*` proxy | Gateway health instead: `curl http://localhost:13000/api/identity/actuator/health` (via the web proxy), or `docker-compose exec api-gateway curl -sf localhost:8080/actuator/health` |
| `http://localhost:3001` | Grafana (logs/traces/dashboards — Loki, Jaeger, Prometheus included) |
| `http://localhost:16686` | Jaeger UI |
| `http://localhost:9090` | Prometheus |

Grafana, Jaeger, Prometheus, and Postgres bind to `127.0.0.1` in
`compose.prod.yml` — they have no auth or dev-default credentials, so
they are host-only. To open their UIs from your own machine, tunnel
over SSH rather than exposing ports:

```bash
ssh -L 13000:localhost:13000 -L 3001:localhost:3001 \
    -L 9090:localhost:9090 -L 16686:localhost:16686 user@<pc-ip>
```

The full e2e journey must run on the device in prod mode (the gateway
port is not published):

```bash
GATEWAY_URL=http://localhost:8080 node --test e2e/journey.e2e.test.mjs
```

## 5. Updating

```bash
git pull
docker-compose -f docker-compose.yml -f compose.prod.yml pull
docker-compose -f docker-compose.yml -f compose.prod.yml up -d
```

Volumes (`postgres_data`, `prometheus_data`, `grafana_data`,
`loki_data`) survive image updates. Rebuild-on-device mode updates the
same way with `docker-compose up -d --build`.

## ZimaOS notes

- **Port conflicts.** ZimaOS/CasaOS's own UI commonly occupies ports
  80/443 — and on this device, 3000. The prod stack therefore publishes
  the web app on `13000` (`compose.prod.yml`), plus `3001, 5432, 9090,
  16686` on `127.0.0.1` only (`8080` is not published at all). If
  another clash appears, change only the *host* side in
  `docker-compose.yml` (e.g. `"13000:3000"`) — internal service
  names/ports are unaffected.
- **Compose version.** The `compose.prod.yml` override uses Compose
  `!reset`/`!override` tags, which need Compose v2.24+. The device
  this guide was written for ships standalone `docker-compose`
  v2.32.4, which satisfies that.
- **Architecture.** x86_64 Zima devices run the prebuilt `linux/amd64`
  images directly. (If you ever deploy on an ARM device, switch
  `publish.yml` to `platforms: linux/amd64,linux/arm64` — the images
  build from source, so multi-arch is a CI flag, not a code change.)
- **Backups.** Everything stateful lives in the four named volumes;
  `docker run --rm -v meter-hub_postgres_data:/data -v $PWD:/backup alpine tar czf /backup/pg.tgz /data`
  is enough for a cold backup while the stack is down.

## Security posture (read before exposing beyond LAN)

This is a dev-grade stack by design (see `docs/known-limitations.md`):
plain HTTP, default Grafana credentials (`admin`/`admin` unless
overridden in `.env`), no service-to-service authentication, no rate
limiting. Keep it on the LAN; for remote access put a VPN (e.g.
Tailscale) on the device rather than port-forwarding.
