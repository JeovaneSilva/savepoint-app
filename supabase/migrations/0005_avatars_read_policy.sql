-- Fix: uploading a profile photo failed with "row-level security" because upsert also needs read access.
-- Safe to run more than once. (0004 already includes this for new setups.)

-- Needed by upload(..., { upsert: true }): Storage checks read access to see if the file already exists.
-- Only the owner's folder; public URLs keep working because the bucket is public.
DROP POLICY IF EXISTS "Avatars: read own" ON storage.objects;
CREATE POLICY "Avatars: read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
