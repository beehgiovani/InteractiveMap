-- Add remaining missing columns for full LotInfo support
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS documentation TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS testada NUMERIC;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS history JSONB;
