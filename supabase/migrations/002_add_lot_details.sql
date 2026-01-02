-- Add new columns to lots table to match LotInfo interface
ALTER TABLE public.lots 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'neutro',
ADD COLUMN IF NOT EXISTS zona TEXT,
ADD COLUMN IF NOT EXISTS setor TEXT,
ADD COLUMN IF NOT EXISTS lote_geo TEXT,
ADD COLUMN IF NOT EXISTS owner_cpf TEXT,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS testada NUMERIC,
ADD COLUMN IF NOT EXISTS display_id TEXT,
ADD COLUMN IF NOT EXISTS aliases JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '{}'::jsonb;

-- Create index for status to help with filtering
CREATE INDEX IF NOT EXISTS idx_lots_status ON public.lots(status);
CREATE INDEX IF NOT EXISTS idx_lots_is_available ON public.lots(is_available);
