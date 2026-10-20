-- Let logged-in users see each other's profile pictures (Beboerliste and resident profiles).
-- Profile pictures are stored as <userId>/profile/<file>; regi images stay restricted.
drop policy if exists "authenticated users can read profile pictures" on storage.objects;

create policy "authenticated users can read profile pictures"
  on storage.objects
  as permissive
  for select
  to authenticated
  using (
    bucket_id = 'Bilder'::text
    and (storage.foldername(name))[2] = 'profile'
  );
