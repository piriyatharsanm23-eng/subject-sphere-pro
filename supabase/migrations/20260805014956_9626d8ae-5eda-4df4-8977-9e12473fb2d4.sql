CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_ids uuid[] NOT NULL DEFAULT '{}',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_subjects ON public.push_subscriptions USING gin (subject_ids);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;
ALTER TABLE public.deadlines ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_super_admins_on_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'new_account',
         'New account joined',
         COALESCE(NEW.full_name, NEW.email, 'A new user') || ' created an account',
         '/super/users'
    FROM public.user_roles ur
   WHERE ur.role = 'super_admin';
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_super_admins_on_new_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_super_admins_on_new_profile ON public.profiles;
CREATE TRIGGER trg_notify_super_admins_on_new_profile
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_super_admins_on_new_profile();