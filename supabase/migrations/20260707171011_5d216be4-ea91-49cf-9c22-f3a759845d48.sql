
CREATE TABLE public.ai_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  chatgpt_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  gemini_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

INSERT INTO public.ai_settings (id) VALUES (TRUE);

GRANT SELECT ON public.ai_settings TO anon, authenticated;
GRANT UPDATE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read AI settings"
  ON public.ai_settings FOR SELECT
  TO anon, authenticated
  USING (TRUE);

CREATE POLICY "Super admins can update AI settings"
  ON public.ai_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
