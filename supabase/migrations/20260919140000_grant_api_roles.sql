-- Grant API roles access to Analog Archive tables.
-- Required so the publishable/anon key can read/write via PostgREST.
-- Safe to re-run.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.rolls,
  public.frames,
  public.notes,
  public.developments,
  public.roll_insights
to anon, authenticated, service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;
