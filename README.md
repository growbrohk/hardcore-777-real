# 777 HARDCORE

Private daily fitness challenge app: log reps, track streaks, and compete on the leaderboard.

Built with [TanStack Start](https://tanstack.com/start), React, and [Supabase](https://supabase.com) (Postgres).

## Prerequisites

- Node.js 20+ and npm
- A Supabase project with the schema applied (see below)

## Local development

1. Copy environment variables:

   ```sh
   cp .env.example .env
   ```

2. Fill in `.env`:
   - `SUPABASE_*` and `VITE_SUPABASE_*` from Supabase → **Settings → API**
   - `SUPABASE_SERVICE_ROLE_KEY` — **service_role** / secret key (server only; never expose to the client)
   - `SESSION_SECRET` — random string, e.g. `openssl rand -base64 32`

3. Apply database migrations to your Supabase project (SQL Editor or CLI):

   - `supabase/migrations/20260825043744_e8c65163-023c-4bde-a366-4d39291f8975.sql`
   - `supabase/migrations/20260919133434_741e1370-2682-4655-97b8-4a8c38759938.sql`

   With the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

4. Install and run:

   ```sh
   npm install
   npm run dev
   ```

   Dev server defaults to port **8080**.

## Deploy on Vercel

1. Import this repository in [Vercel](https://vercel.com).
2. Set **Environment Variables** (Production and Preview):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - Optional: `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
   - For client bundles at build time, also set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
3. Build command: `npm run build` (Nitro uses the **Vercel** preset).
4. After deploy, smoke-test login/signup and the leaderboard.

Do **not** commit `.env` or paste service-role keys into the repo.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Development server       |
| `npm run build`| Production build (Nitro)   |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint                   |
