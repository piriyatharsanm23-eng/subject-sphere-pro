
-- 1. Add avatar_url + avatar_path to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_path text;

-- 2. Public read view exposing only id, full_name, avatar_url (no email)
CREATE OR REPLACE VIEW public.uploader_profiles
WITH (security_invoker = false) AS
SELECT id, full_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.uploader_profiles TO anon, authenticated;

-- 3. Storage RLS for avatars bucket
-- Public read (anon + authenticated)
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar (path prefix = their uid)
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
