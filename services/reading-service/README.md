# Reading Service

MeterHub Reading Service: stores and serves meter readings (task Epic 6).

## Stack

- NestJS 12 (ESM, `nodenext`)
- PostgreSQL via Prisma 7 (`reading_db`, user `reading_user`)
- Vitest for unit and e2e tests

## Local development

```bash
npm install
# Postgres runs via the repo-root docker-compose (reading_db is provisioned
# by infrastructure/postgres/init).
DATABASE_URL='postgresql://reading_user:reading_dev@localhost:5432/reading_db' \
  npx prisma migrate deploy
npm run start:dev
```

The service listens on `:8084` (conventions §11). `GET /health` reports
Prisma connectivity.

## Tests

```bash
npm test        # unit
npm run test:e2e  # e2e (needs DATABASE_URL as above)
npm run lint
```
