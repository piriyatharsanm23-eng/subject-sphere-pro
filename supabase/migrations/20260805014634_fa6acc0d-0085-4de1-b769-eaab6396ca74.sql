CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_ids uuid[] NOT NULL DEFAULT '{}',
  user_agent text,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

GRANT ALL ON public.push_subscriptions TO service_role;
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own devices" ON public.push_subscriptions;
CREATE POLICY "Users view own devices" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove own devices" ON public.push_subscriptions;
CREATE POLICY "Users remove own devices" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;
ALTER TABLE public.deadlines ADD COLUMN IF NOT EXISTS push_notified_at timestamptz;

-- Super admins get notified when a new account joins
CREATE OR REPLACE FUNCTION public.notify_super_admins_on_new_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'new_account',
         'New account joined',
         COALESCE(NEW.full_name, NEW.email, 'A new user') || ' just created an account.',
         '/super/users'
    FROM public.user_roles ur
   WHERE ur.role = 'super_admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_super_admins_on_new_profile ON public.profiles;
CREATE TRIGGER trg_notify_super_admins_on_new_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_super_admins_on_new_profile();

-- Super admins get notified when an approval is requested
CREATE OR REPLACE FUNCTION public.notify_super_admins_on_pending_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT ur.user_id,
         'change_requested',
         'Approval needed',
         'A ' || NEW.action || ' request on ' || NEW.entity_type || ' is waiting for review.',
         '/super/pending'
    FROM public.user_roles ur
   WHERE ur.role = 'super_admin';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_super_admins_on_pending_change ON public.pending_changes;
CREATE TRIGGER trg_notify_super_admins_on_pending_change
  AFTER INSERT ON public.pending_changes
  FOR EACH ROW EXECUTE FUNCTION public.notify_super_admins_on_pending_change();