-- Create the lots table
CREATE TABLE IF NOT EXISTS public.lots (
    id TEXT PRIMARY KEY,
    quadra TEXT NOT NULL,
    lote TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Lot information
    area NUMERIC,
    price NUMERIC,
    owner TEXT,
    owner_contact TEXT,
    notes TEXT,
    
    -- Geometry and attachments (JSONB for flexibility)
    coordinates JSONB NOT NULL,
    center JSONB,
    photos JSONB DEFAULT '[]'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lots_quadra ON public.lots(quadra);
CREATE INDEX IF NOT EXISTS idx_lots_lote ON public.lots(lote);
CREATE INDEX IF NOT EXISTS idx_lots_owner ON public.lots(owner);
CREATE INDEX IF NOT EXISTS idx_lots_coordinates ON public.lots USING GIN (coordinates);

-- Enable Row Level Security (RLS)
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public read access
-- Note: Adjust this policy based on your security requirements
CREATE POLICY "Allow public read access" ON public.lots
    FOR SELECT
    USING (true);

-- Create a policy to allow authenticated users to insert/update
-- Note: Adjust this policy based on your security requirements
CREATE POLICY "Allow authenticated insert/update" ON public.lots
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
