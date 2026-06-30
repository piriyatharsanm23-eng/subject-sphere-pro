
-- 1) Public materials policy: exclude archived
DROP POLICY IF EXISTS "Public can read materials" ON public.materials;
CREATE POLICY "Public can read materials"
  ON public.materials FOR SELECT
  USING (is_archived = false);

-- 2) Activity logs: server-side trigger fills user_name/user_role, ignoring client input
CREATE OR REPLACE FUNCTION public.set_activity_log_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _role text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.is_super_admin(_uid) THEN
    _role := 'super_admin';
  ELSIF public.has_role(_uid, 'admin') THEN
    _role := 'admin';
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT COALESCE(full_name, email) INTO _name FROM public.profiles WHERE id = _uid;
  NEW.user_id := _uid;
  NEW.user_name := _name;
  NEW.user_role := _role;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_activity_log_metadata() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_activity_log_metadata ON public.activity_logs;
CREATE TRIGGER trg_set_activity_log_metadata
  BEFORE INSERT ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_log_metadata();

-- 3) Drop SECURITY DEFINER function callable by authenticated; replaced by direct insert + trigger
DROP FUNCTION IF EXISTS public.log_activity(text, text, text, uuid, uuid, uuid);

-- 4) Replace increment_download (SECURITY DEFINER, anon-callable) with trigger + RLS insert
DROP POLICY IF EXISTS "No direct download inserts" ON public.downloads;
CREATE POLICY "Anyone can record a download"
  ON public.downloads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE m.id = downloads.material_id AND m.is_archived = false
    )
  );
GRANT INSERT ON public.downloads TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bump_material_download_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.materials
     SET download_count = download_count + 1
   WHERE id = NEW.material_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.bump_material_download_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bump_material_download_count ON public.downloads;
CREATE TRIGGER trg_bump_material_download_count
  AFTER INSERT ON public.downloads
  FOR EACH ROW EXECUTE FUNCTION public.bump_material_download_count();

DROP FUNCTION IF EXISTS public.increment_download(uuid);
