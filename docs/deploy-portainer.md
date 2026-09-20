# Deploying MeterHub with Portainer

The production deployment runs the same prebuilt ghcr.io images that
CI publishes on every green `main` push, managed through Portainer's
UI: app tiles, start/stop buttons, log
viewer, and a one-click redeploy. Uses the dedicated single-file stack
`compose.portainer.yml` — Portainer
stacks take one compose file and don't merge overrides, so the
`docker-compose.yml` + `compose.prod.yml` pair doesn't work there.

## 0. Prerequisites

- A Docker host with **Portainer CE ≥ 2.19** (Community is enough) and
  SSH access to it.
- Portainer itself reachable (commonly `http://<host>:9443`).

## 1. Configure the registry (private ghcr.io images)

The service/web images are published to ghcr.io as **private** packages
by default, so Portainer needs pull credentials:

1. On GitHub create a classic PAT with `read:packages` scope
   (Settings → Developer settings → Personal access tokens).
2. In Portainer: **Registries → Add registry → Custom registry**
   - URL: `ghcr.io`
   - Username: your GitHub username
   - Password: the PAT
3. Leave "Authentication" enabled; save.

## 2. Put the key material and repo files on the host

Portainer resolves **relative** bind paths against its own data
directory, not the host filesystem, so the stack file uses absolute
paths via two variables (`CERTS_DIR`, `REPO_DIR`). SSH into the host:

```bash
# JWT signing keys (same key pair as any environment)
sudo mkdir -p /opt/meter-hub/certs
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  -out /opt/meter-hub/certs/identity.jwt.private-key
openssl pkey -in /opt/meter-hub/certs/identity.jwt.private-key -pubout \
  -out /opt/meter-hub/certs/identity.jwt.public-key
sudo chmod 600 /opt/meter-hub/certs/*

# Repo checkout for the bind-mounted configs (postgres init, prometheus,
# grafana provisioning, loki/promtail configs)
sudo git clone https://github.com/serkononenko/meter-hub.git /opt/meter-hub/repo
```

`/opt/meter-hub` is the default of both variables; if you place things
elsewhere, change the values in step 4 instead of editing the stack
file.

## 3. Create the stack

**Stacks → Add stack → Web editor**, name it `meter-hub`, then either
paste the contents of `compose.portainer.yml` or use **Repository**
mode pointing at this repo with that path (Web editor is simpler for
keeping the file in the repo as the source of truth).

## 4. Environment variables

Under **Environment variables → Advanced mode**, paste the same shape
as `.env.example` with real values — including two Portainer-specific
entries:

```bash
# Where the JWT PEM files live on the host (step 2)
CERTS_DIR=/opt/meter-hub/certs
# Where the repo checkout lives on the host (step 2)
REPO_DIR=/opt/meter-hub/repo

# ...plus the usual: POSTGRES_*, the four *_DB_PASSWORD values,
# GRAFANA_ADMIN_USER / GRAFANA_ADMIN_PASSWORD (change from defaults!).
# Generate strong values; see .env.example for the full list.
```

Leave "Prune volumes" **unchecked** and deploy.

## 5. Verify

| Check | Where |
|---|---|
| All 11 containers running | Stack detail page — should show `Running (healthy)` for postgres |
| Web app from any LAN machine | `http://<host-ip>:13000` |
| Gateway health via the web proxy | `curl http://<host-ip>:13000/api/identity/actuator/health` |
| Grafana / Jaeger / Prometheus | Loopback-only on the host (13001 / 16686 / 9090) — reach over SSH tunnel: `ssh -L 13001:localhost:13001 -L 9090:localhost:9090 -L 16686:localhost:16686 user@<host-ip>` |

Portainer's container list replaces most of the CLI here: logs,
console access, and per-container restart are all in the UI.

## 6. Updating

Images are rebuilt by CI (`publish.yml`) on every green `main` push.
To pick them up: open the stack → **Editor** is unchanged →
**Update the stack**, tick **"Re-pull image and redeploy"** → Save.
That forces a fresh pull of the `:main` tags and recreates changed
containers. Volumes persist across redeploys.

> Community Edition has no per-stack auto-update webhook (that's
> Business). If unattended updates matter, either re-run the redeploy
> button after CI or run
> `docker compose -f compose.portainer.yml --env-file <env-file> pull && docker compose -f compose.portainer.yml --env-file <env-file> up -d`
> on the host via cron — Portainer will reflect the externally changed
> stack state.

## Portainer-specific notes

- **One file, no overrides.** `compose.portainer.yml` is a flattened
  copy of `docker-compose.yml` + `compose.prod.yml`. If you change the
  other two, mirror the change here — the file header documents this.
- **No `!reset`/`!override` tags** — Portainer's compose parser
  historically chokes on Compose custom tags; the flattened file needs
  none.
- **Secrets are file-based** (`secrets: file:`), which works on plain
  Docker hosts; they resolve through `CERTS_DIR`. No Portainer secret
  store involved.
- **Promtail needs the Docker socket** (`/var/run/docker.sock:ro`) —
  that's a host bind mount, unaffected by Portainer's relative-path
  behavior.
- **Don't also deploy the same stack via the CLI** (`docker-compose.yml`
  + `compose.prod.yml`) on the same host: two compose projects would
  fight over the `meter-hub-network` name and the published ports.
