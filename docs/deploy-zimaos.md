# Deploying MeterHub on a ZimaOS home server

The whole platform is one Docker Compose project — no JDK, Node, or
database installation needed on the device. ZimaOS ships Docker and
Compose, so deployment is: clone → configure → `compose up`.

Two ways to run:

| Mode | Command | When to use |
|---|---|---|
| **Build on device** | `docker compose up -d --build` | First deploy, or when you want to run unmerged local changes. Slow on mini-PC hardware (Gradle + npm builds in Docker). |
| **Pull prebuilt images** | `docker compose -f docker-compose.yml -f compose.prod.yml pull && docker compose -f docker-compose.yml -f compose.prod.yml up -d` | Day-to-day updates. Images are built by CI (`publish.yml`) on every green `main` push. Seconds, not minutes. |

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
docker compose up -d --build
```

Or pull mode (recommended after the first run):

```bash
docker compose -f docker-compose.yml -f compose.prod.yml pull
docker compose -f docker-compose.yml -f compose.prod.yml up -d
```

First build/pull takes a while; later updates are incremental.

## 4. Verify — from any machine on the LAN

| URL | What |
|---|---|
| `http://<pc-ip>:3000` | Web app |
| `http://<pc-ip>:8080/actuator/health` | Gateway health |
| `http://<pc-ip>:3001` | Grafana (logs/traces/dashboards — Loki, Jaeger, Prometheus included) |
| `http://<pc-ip>:16686` | Jaeger UI |
| `http://<pc-ip>:9090` | Prometheus |

The full e2e journey can also be pointed at the server:

```bash
GATEWAY_URL=http://<pc-ip>:8080 node --test e2e/journey.e2e.test.mjs
```

## 5. Updating

```bash
git pull
docker compose -f docker-compose.yml -f compose.prod.yml pull
docker compose -f docker-compose.yml -f compose.prod.yml up -d
```

Volumes (`postgres_data`, `prometheus_data`, `grafana_data`,
`loki_data`) survive image updates. Rebuild-on-device mode updates the
same way with `docker compose up -d --build`.

## ZimaOS notes

- **Port conflicts.** ZimaOS/CasaOS's own UI commonly occupies ports
  80/443 (and sometimes app-store services). This stack publishes
  `3000, 3001, 5432, 8080, 9090, 16686`. If one clashes, change only
  the *host* side in `docker-compose.yml` (e.g. `"13000:3000"`) —
  internal service names/ports are unaffected.
- **`docker compose version`.** The `compose.prod.yml` override uses
  Compose `!reset` tags, which need Compose v2.24+ (recent ZimaOS
  builds ship this; older ones may need a Docker/Compose update).
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
