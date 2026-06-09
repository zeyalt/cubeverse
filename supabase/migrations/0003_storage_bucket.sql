-- Media storage bucket for journal/competition photos
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Public read; service role handles writes (no-auth mode)
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');
