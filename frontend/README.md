# MeterHub Frontend

Next.js 16 (App Router) + Material UI web application for MeterHub. API
calls are generated from the OpenAPI contracts with Orval
(`npm run generate:api`).

## Running

- **Docker (default):** `docker compose up -d web` from the repository root
  builds this image and serves the app on http://localhost:3000 — the
  rewrite to the API gateway is baked in at build time
  (`GATEWAY_URL=http://api-gateway:8080` build arg) and the BFF route
  handlers read `GATEWAY_URL` at runtime; both are wired in
  `docker-compose.yml`.
- **Development:** `npm install && npm run dev` — same URLs, but the
  rewrite and BFF default to `http://localhost:8080` so it pairs with a
  locally running gateway.

## Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `GATEWAY_URL` | rewrite (build time), BFF routes (runtime) | `http://localhost:8080` | API gateway base URL |

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
