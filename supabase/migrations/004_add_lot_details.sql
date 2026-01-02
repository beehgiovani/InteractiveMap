-- Add missing columns for lot details
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS zona TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS setor TEXT;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS lote_geo TEXT; -- Correpts to loteGeo in client
