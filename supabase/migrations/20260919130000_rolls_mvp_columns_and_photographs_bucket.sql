-- Additive migration for projects that already applied an earlier init without these columns.
-- Safe to run multiple times.

alter table public.rolls
  add column if not exists started_on date;

alter table public.rolls
  add column if not exists contact_sheet_generated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('photographs', 'photographs', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'photographs_public_select'
  ) then
    create policy "photographs_public_select"
      on storage.objects for select
      using (bucket_id = 'photographs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'photographs_public_insert'
  ) then
    create policy "photographs_public_insert"
      on storage.objects for insert
      with check (bucket_id = 'photographs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'photographs_public_update'
  ) then
    create policy "photographs_public_update"
      on storage.objects for update
      using (bucket_id = 'photographs')
      with check (bucket_id = 'photographs');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'photographs_public_delete'
  ) then
    create policy "photographs_public_delete"
      on storage.objects for delete
      using (bucket_id = 'photographs');
  end if;
end $$;
