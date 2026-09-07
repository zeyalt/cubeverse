# Cubeverse

A speedcubing practice timer and progress tracker — generate scrambles, time your
solves, set per-puzzle targets, and follow your improvement across practice and
competitions. Built for a playful, touch-first experience with a calmer
"grown-up" data layer underneath.

## Features

- **Practice timer** — WCA-style scrambles per event, an inline cube visual of the
  scrambled state, live Ao5/Ao12/best metrics, and editable per-puzzle target times.
- **Analytics** — solves-over-time and distribution charts, PB progression
  (combining WCA + non-WCA competitions), a personal-records table, and a practice
  heatmap. Charts adapt to light/dark themes.
- **Competitions** — import official results from a WCA profile, or add unofficial
  competitions and results manually. WCA records are read-only; manual ones are
  editable/deletable.
- **Trainer** — 2×2 CLL case drill with setup/solve algs, rep tracking, and
  progress that syncs across devices.
- **Badges** — unlockable achievements for PBs, milestones, and streaks.
- **Multi-cuber** — switch between cubers sharing one device.
- **Theming, offline & PWA** — light/dark themes, an offline solve queue, and a
  service worker for installable, resilient use.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, static export, Turbopack) + React 19
- [Supabase](https://supabase.com) (Auth, Postgres, Storage, Edge Functions) through authenticated RLS
- [Tailwind CSS v4](https://tailwindcss.com)
- [Recharts](https://recharts.org) for charts
- [`scrambow`](https://www.npmjs.com/package/scrambow) for scramble generation and
  [`@cubing/icons`](https://www.npmjs.com/package/@cubing/icons) for puzzle icons
- TypeScript, ESLint, [Vitest](https://vitest.dev)

> **Note:** This repo pins a specific Next.js version whose APIs and conventions may
> differ from older releases. See `AGENTS.md` and the guides in
> `node_modules/next/dist/docs/` before making framework-level changes.

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (URL + keys)

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from the example and fill in your Supabase keys:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Description |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
   Runtime access uses only the public anon key plus the signed-in household
   account. Never expose a service-role key in a `NEXT_PUBLIC_*` variable.

3. Apply the database migrations in `supabase/migrations/` to your Supabase project
   (in order). These create the schema, the public `media` storage bucket, and
   supporting indexes.

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Use `npm run dev -- -p 3005`
   to run on a different port.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest test suite |

Utility scripts for local data live in `scripts/` (e.g. `seed-demo.mjs` to seed demo
data, `clear-all.mjs` to wipe).

## Project structure

```
app/            Static Next.js routes
components/     UI — kid-mode tabs/sheets, analytics charts, trainer, shared primitives
lib/            Domain logic: cubing math, analytics, PBs, badges, Supabase, offline sync
supabase/       SQL migrations and config
scripts/        Local data/seed utilities
```

## Deployment

`npm run build` emits the app to `out/`, so it can be hosted on any static CDN.
Apply the Supabase migrations, deploy the `wca-proxy` Edge Function with an
`APP_ORIGIN` secret, and create the household Supabase Auth account before use.
For an existing no-auth installation, reassign its `owner_id` values to that
account's Auth UUID before enabling browser access.
