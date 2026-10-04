# syntax=docker/dockerfile:1
FROM node:25-alpine AS build
WORKDIR /app

# Copy manifests first so dependency downloads stay cached between builds.
# .npmrc must ride along: it pins legacy-peer-deps, which the lock was
# generated with (prisma CLI's studio-core react peers — see .npmrc).
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY prisma prisma
COPY prisma.config.ts ./
# Generated Prisma client and event types are committed under src/generated
# and copied in with src (mirrors reading-service: plain `prisma generate`
# would be a second source of truth).
COPY src src
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
RUN npm run build

FROM node:25-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build --chown=appuser:appgroup /app/node_modules node_modules
COPY --from=build --chown=appuser:appgroup /app/dist dist
COPY --from=build --chown=appuser:appgroup /app/prisma prisma
COPY --from=build --chown=appuser:appgroup /app/prisma.config.ts ./
COPY --from=build --chown=appuser:appgroup /app/package.json ./
USER appuser

# Conventions §11: events-demo listens on 8085.
ENV SERVER_PORT=8085
EXPOSE 8085

# Apply pending migrations (prisma_migrations tracks applied files), then start.
ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
