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
- **Cubes** — track your collection with photos, brands, main-cube selection, and
  a puzzle-type filter.
- **Badges** — unlockable achievements for PBs, milestones, and streaks.
- **Multi-cuber** — switch between cubers sharing one device.
- **Theming, offline & PWA** — light/dark themes, an offline solve queue, and a
  service worker for installable, resilient use.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack) + React 19
- [Supabase](https://supabase.com) (Postgres + Storage) via the service-role client
- [Tailwind CSS v4](https://tailwindcss.com)
- [Recharts](https://recharts.org) for charts
- [`scrambow`](https://www.npmjs.com/package/scrambow) for scramble generation and
  [`scramble-display`](https://www.npmjs.com/package/scramble-display) +
  [`@cubing/icons`](https://www.npmjs.com/package/@cubing/icons) for cube visuals/icons
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
   | `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server only — never exposed to the client) |
   | `WCA_OAUTH_CLIENT_ID` / `WCA_OAUTH_CLIENT_SECRET` | Optional, only for the OAuth WCA import path |

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
app/            Next.js routes (home tabs, onboarding, competitions, timer) + server actions
components/     UI — kid-mode tabs/sheets, analytics charts, cubes, shared primitives
lib/            Domain logic: cubing math, analytics, PBs, badges, streaks, Supabase, WCA import
supabase/       SQL migrations and config
scripts/        Local data/seed utilities
```

## Deployment

Deployable on any platform that supports Next.js (e.g. [Vercel](https://vercel.com)).
Set the same environment variables in your hosting provider and ensure the Supabase
migrations have been applied to the target database.
