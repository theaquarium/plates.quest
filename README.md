# Plates Quest

A local-first, shareable license plate checklist for road trips. The app is a React PWA served by a Cloudflare Worker, with shared trip state stored in D1.

## What it does

- Creates trips with US, Canadian, Mexican, and European plate lists.
- Keeps joined trips and every optimistic edit in `localStorage`.
- Works offline after the first visit and syncs when connectivity returns.
- Shares editable trips through unguessable `/:tripId` links; there are no accounts.
- Archives trips in the UI after 30 days without a modification.

## Conflict rules

- A plate update based on the current server version can check or uncheck a plate.
- When two plate updates conflict, checked wins. A stale client cannot erase a newer sighting.
- Trip names use last-write-wins by client edit time, with client ID as a deterministic tie-breaker.

## Local development

```sh
npm install
npm run cf-typegen
npm run db:migrate:local
npm run dev
```

The Vite development server runs the React app and Worker API together using the Cloudflare D1 binding in `wrangler.jsonc`.

## Deploying

The production D1 database and Cloudflare account are configured in `wrangler.jsonc`. Authenticate with Wrangler, then run:

```sh
npm run deploy
```

To use the `plates.quest` domain, delegate its DNS to Cloudflare and attach it as a custom domain for the deployed Worker.
