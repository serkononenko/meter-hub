# Postgres image with the per-service database init script baked in, so
# first-boot database/role creation doesn't depend on a repo checkout
# being bind-mounted on the deployment host (docker-compose.portainer.yml
# resolves relative bind paths against Portainer's own data directory).
FROM postgres:17
COPY init/ /docker-entrypoint-initdb.d/
