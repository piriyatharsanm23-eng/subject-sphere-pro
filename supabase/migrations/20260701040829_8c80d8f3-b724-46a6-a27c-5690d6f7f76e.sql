
-- Drop the flagged security-definer view
DROP VIEW IF EXISTS public.uploader_profiles;

-- Public-safe mirror of profile name + avatar
CREATE TABLE IF NOT EXISTS public.public_profile_info (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_profile_info TO anon, authenticated;
GRANT ALL ON public.public_profile_info TO service_role;

ALTER TABLE public.public_profile_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profile info"
ON public.public_profile_info FOR SELECT
TO anon, authenticated
USING (true);

-- Sync trigger from profiles -> public_profile_info
CREATE OR REPLACE FUNCTION public.sync_public_profile_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.public_profile_info (id, full_name, avatar_url, updated_at)
  VALUES (NEW.id, NEW.full_name, NEW.avatar_url, now())
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_public_profile_info() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_sync_public_info ON public.profiles;
CREATE TRIGGER profiles_sync_public_info
AFTER INSERT OR UPDATE OF full_name, avatar_url ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_public_profile_info();

-- Backfill existing profiles
INSERT INTO public.public_profile_info (id, full_name, avatar_url)
SELECT id, full_name, avatar_url FROM public.profiles
ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();
