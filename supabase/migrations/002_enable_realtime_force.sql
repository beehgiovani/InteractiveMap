-- Force enable realtime for lots table
-- We drop it first to ensure clean state, then add it back
ALTER PUBLICATION supabase_realtime DROP TABLE public.lots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
