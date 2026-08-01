CREATE TABLE public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  path text,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);
CREATE INDEX site_visits_created_at_idx ON public.site_visits (created_at desc);
CREATE INDEX site_visits_visitor_idx ON public.site_visits (visitor_id);
GRANT INSERT ON public.site_visits TO anon, authenticated;
GRANT SELECT ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record a visit" ON public.site_visits FOR INSERT TO anon, authenticated WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Super admins can read visits" ON public.site_visits FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));