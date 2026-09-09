# syntax=docker/dockerfile:1

FROM node:25-alpine AS build
WORKDIR /app

# Copy manifests first so dependency downloads stay cached between builds.
COPY package.json package-lock.json ./
RUN npm ci

COPY prisma prisma
COPY prisma.config.ts ./
# The generated client is committed under src/database/generated/prisma, but
# regenerating here keeps it in sync with the checked-in schema.
RUN npx prisma generate

COPY src src
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY vitest.config.ts vitest.config.e2e.ts ./
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
# Conventions §11: Meter Service listens on 8083.
ENV SERVER_PORT=8083
EXPOSE 8083

# Apply pending migrations (prisma_migrations tracks applied files), then start.
ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
