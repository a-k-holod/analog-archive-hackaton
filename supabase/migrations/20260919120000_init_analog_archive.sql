-- Analog Archive — initial schema
-- Supports the MVP (rolls, frames, notes) plus future developments / roll insights.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- rolls
-- ---------------------------------------------------------------------------
create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  film_stock text,
  iso text,
  camera text,
  lens text,
  frame_count integer not null default 0 check (frame_count >= 0),
  started_on date,
  contact_sheet_generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index rolls_created_at_idx on public.rolls (created_at desc);

-- ---------------------------------------------------------------------------
-- frames
-- ---------------------------------------------------------------------------
create table public.frames (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.rolls (id) on delete cascade,
  frame_number integer not null check (frame_number > 0),
  image_url text,
  title text,
  description text,
  location text,
  taken_at timestamptz,
  aperture text,
  shutter_speed text,
  focal_length text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (roll_id, frame_number)
);

create index frames_roll_id_idx on public.frames (roll_id);
create index frames_taken_at_idx on public.frames (taken_at);

-- ---------------------------------------------------------------------------
-- notes (roll-level or frame-level; optional photograph of handwriting)
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.rolls (id) on delete cascade,
  frame_id uuid references public.frames (id) on delete set null,
  image_url text,
  text text,
  created_at timestamptz not null default now(),
  check (text is not null or image_url is not null)
);

create index notes_roll_id_idx on public.notes (roll_id);
create index notes_frame_id_idx on public.notes (frame_id);

-- ---------------------------------------------------------------------------
-- developments (darkroom log per roll) — reserved for later
-- ---------------------------------------------------------------------------
create table public.developments (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.rolls (id) on delete cascade,
  developer text,
  dilution text,
  temperature text,
  development_time text,
  agitation text,
  notes text,
  created_at timestamptz not null default now()
);

create index developments_roll_id_idx on public.developments (roll_id);

-- ---------------------------------------------------------------------------
-- roll_insights — reserved for later AI / editorial readings
-- ---------------------------------------------------------------------------
create table public.roll_insights (
  id uuid primary key default gen_random_uuid(),
  roll_id uuid not null references public.rolls (id) on delete cascade,
  summary text,
  subjects text[] not null default '{}',
  sequences jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index roll_insights_roll_id_idx on public.roll_insights (roll_id);
create index roll_insights_created_at_idx on public.roll_insights (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (open for hackathon; tighten when auth exists)
-- ---------------------------------------------------------------------------
alter table public.rolls enable row level security;
alter table public.frames enable row level security;
alter table public.notes enable row level security;
alter table public.developments enable row level security;
alter table public.roll_insights enable row level security;

create policy "rolls_public_access"
  on public.rolls for all
  using (true) with check (true);

create policy "frames_public_access"
  on public.frames for all
  using (true) with check (true);

create policy "notes_public_access"
  on public.notes for all
  using (true) with check (true);

create policy "developments_public_access"
  on public.developments for all
  using (true) with check (true);

create policy "roll_insights_public_access"
  on public.roll_insights for all
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage: photographs bucket (public read for MVP)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photographs', 'photographs', true)
on conflict (id) do update set public = excluded.public;

create policy "photographs_public_select"
  on storage.objects for select
  using (bucket_id = 'photographs');

create policy "photographs_public_insert"
  on storage.objects for insert
  with check (bucket_id = 'photographs');

create policy "photographs_public_update"
  on storage.objects for update
  using (bucket_id = 'photographs')
  with check (bucket_id = 'photographs');

create policy "photographs_public_delete"
  on storage.objects for delete
  using (bucket_id = 'photographs');
