ALTER PUBLICATION supabase_realtime ADD TABLE public.deadlines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;
ALTER TABLE public.deadlines REPLICA IDENTITY FULL;
ALTER TABLE public.materials REPLICA IDENTITY FULL;
ALTER TABLE public.subjects REPLICA IDENTITY FULL;