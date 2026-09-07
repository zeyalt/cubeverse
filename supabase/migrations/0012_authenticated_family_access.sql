-- Browser clients authenticate as the household's Supabase user. Existing
-- owner-scoped RLS policies in 0001 already compare owner_id with auth.uid();
-- this migration hardens storage and exposes a cheap ownership sanity check.
--
-- Before enabling the static client for an existing installation, reassign the
-- existing rows to the household auth user's UUID in a maintenance session.

create or replace function public.current_owner_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid()
$$;

revoke all on function public.current_owner_id() from public;
grant execute on function public.current_owner_id() to authenticated;

drop policy if exists "owner_all" on public.competition_notes;
create policy "owner_all" on public.competition_notes
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "owner_all" on public.benchmark_competitors;
create policy "owner_all" on public.benchmark_competitors
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "media_authenticated_insert" on storage.objects;
create policy "media_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "media_authenticated_update" on storage.objects;
create policy "media_authenticated_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "media_authenticated_delete" on storage.objects;
create policy "media_authenticated_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
