
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS materials_telegram_notify_idx
  ON public.materials (created_at)
  WHERE telegram_notified_at IS NULL AND is_archived = false;

ALTER TABLE public.telegram_subscribers
  ADD COLUMN IF NOT EXISTS receive_admin_alerts boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.telegram_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  pending_update_count integer,
  last_error_message text,
  last_error_at timestamptz,
  webhook_url text,
  raw jsonb
);

GRANT SELECT ON public.telegram_health_logs TO authenticated;
GRANT ALL ON public.telegram_health_logs TO service_role;

ALTER TABLE public.telegram_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view telegram health logs"
  ON public.telegram_health_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
