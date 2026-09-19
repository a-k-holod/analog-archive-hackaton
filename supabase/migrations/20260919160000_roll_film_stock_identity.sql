-- Keep film_stock as the archival display text while optionally linking a roll
-- to a stable ID in the bundled catalog. It is intentionally not a foreign key:
-- the catalog is versioned with the application, not stored in Supabase.

alter table public.rolls
  add column if not exists film_stock_id text;
