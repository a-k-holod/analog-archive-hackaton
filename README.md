# Analog Archive

A digital archive for analog photography. This hackathon slice preserves a film roll, its frames, notes, a contact sheet, and a roll-level analysis.

The app opens on the archive. There is no authentication yet.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Roll data still lives in the browser (`localStorage`) for the current UI. Supabase is wired for the next persistence step.

## Supabase

1. Copy `.env.example` to `.env.local` (already created with placeholders).
2. Replace the placeholders with your project URL and publishable key from Supabase → Project Settings → API.
3. Apply the migrations in `supabase/migrations/` (SQL editor, or `DATABASE_URL=... npm run db:migrate`).
4. Verify the connection:

```bash
npm run verify:supabase
```

Or open `GET /api/supabase/health` while the dev server is running.

Client helpers live in `src/lib/supabase/`:

- `client.ts` — browser / Client Components (`@supabase/ssr`)
- `server.ts` — Server Components, Route Handlers, Server Actions
- `verify.ts` — connection check used by the health route and script

## Schema

Tables: `rolls`, `frames`, `notes`, `developments`, `roll_insights`. UUID primary keys, cascade deletes from rolls, open RLS policies until auth is added.

## Workflow

1. Create a roll
2. Add frames (photograph + metadata)
3. Add notes
4. Generate a contact sheet
5. Analyze the roll
