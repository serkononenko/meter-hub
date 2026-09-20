# syntax=docker/dockerfile:1

FROM node:25-alpine AS build
WORKDIR /app

# Copy manifests first so dependency downloads stay cached between builds.
COPY package.json package-lock.json ./
RUN npm ci

# The rewrite to the gateway is baked into the build manifest, so the
# in-network gateway address must be provided at build time (docker-compose.yml
# passes it). Runtime GATEWAY_URL only affects the BFF route handlers.
ARG GATEWAY_URL=http://localhost:8080
ENV GATEWAY_URL=${GATEWAY_URL}

COPY next.config.ts orval.config.ts ./
COPY public ./public
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

FROM node:25-alpine
WORKDIR /app

ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Standalone output bundles the server with only the node_modules it needs.
COPY --from=build --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=build --chown=appuser:appgroup /app/.next/static ./.next/static
COPY --from=build --chown=appuser:appgroup /app/public ./public

USER appuser

# Conventions §13: the web app is reachable on 3000 (docs/ports.md).
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
