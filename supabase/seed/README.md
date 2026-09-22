# CSV → Supabase import

Import semicolon-delimited table exports from Supabase (or another Postgres instance) into this project’s schema.

## Prerequisites

1. Target Supabase project linked in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Migrations applied (both files under `supabase/migrations/`):

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Empty tables (before first import):

   ```sql
   SELECT 'members' AS t, count(*) FROM public.members
   UNION ALL SELECT 'daily_records', count(*) FROM public.daily_records
   UNION ALL SELECT 'member_month_progress', count(*) FROM public.member_month_progress;
   ```

## Option A — SQL file (Supabase SQL Editor)

Generate paste-ready SQL (preserves UUIDs and `pin_hash` for existing PIN login):

```sh
node supabase/seed/generate-import-sql.mjs \
  --members ~/Downloads/members-export-....csv \
  --daily-records ~/Downloads/daily_records-export-....csv \
  --out supabase/seed/import-from-export-2026-09-22.sql
```

Then in **Supabase Dashboard → SQL → New query**, paste the full contents of the generated file and run once.

Generated `import-from-export*.sql` files are gitignored (they contain PIN hashes).

## Option B — CLI apply (service role)

Same CSV inputs, inserts via the API (no copy/paste):

```sh
node --env-file=.env supabase/seed/apply-csv-import.mjs \
  --members ~/Downloads/members-export-....csv \
  --daily-records ~/Downloads/daily_records-export-....csv
```

Optional third file if `member_month_progress` has rows:

```sh
  --month-progress ~/Downloads/member_month_progress-export-....csv
```

## Verify

```sql
SELECT count(*) AS members FROM public.members;           -- expect 10 for Sep 2026 export
SELECT count(*) AS daily_records FROM public.daily_records; -- expect 86
SELECT count(*) AS month_progress FROM public.member_month_progress;

SELECT m.name, count(d.id) AS days_logged
FROM public.members m
LEFT JOIN public.daily_records d ON d.member_id = m.id
GROUP BY m.id, m.name
ORDER BY m.name;
```

App smoke test: `npm run dev` → log in with member name + same PIN as before → check today / leaderboard.

## Import order

`members` → `daily_records` → `member_month_progress` (if any). The generator and apply script enforce this order.
