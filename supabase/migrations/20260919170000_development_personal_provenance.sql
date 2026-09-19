-- Personal development provenance fields.
-- Manufacturer recipes stay in the bundled app catalog; this table logs what
-- the photographer actually did on a roll. source_recipe_id is attribution only
-- (not a foreign key — the catalog is not stored in Postgres).

alter table public.developments
  add column if not exists method text,
  add column if not exists exposure_index text,
  add column if not exists source_recipe_id text,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.developments.source_recipe_id is
  'Optional bundled catalog recipe id used as a starting point. Never implies the catalog row is editable.';

comment on column public.developments.method is
  'Personal process method (e.g. spiral tank). Free text for photographer edits.';

comment on column public.developments.exposure_index is
  'Personal exposure index used for this development. Free text for photographer edits.';
