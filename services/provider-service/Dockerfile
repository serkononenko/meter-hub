# syntax=docker/dockerfile:1

FROM node:25-alpine AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY prisma prisma
COPY prisma.config.ts ./
# The generated Prisma client is committed under src/generated/prisma: `prisma generate --sql`
# needs a live database, and a plain `prisma generate` would wipe the TypedSQL module.

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
ENV SERVER_PORT=8086
EXPOSE 8086

ENTRYPOINT ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
