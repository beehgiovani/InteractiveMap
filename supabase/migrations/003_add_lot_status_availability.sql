-- Add missing columns to lots table
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'neutro';
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT false;
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS owner_cpf TEXT;

-- Create index for status for better filtering performance
CREATE INDEX IF NOT EXISTS idx_lots_status ON public.lots(status);
