-- Fix RLS policies for Realtime subscriptions
-- Drop existing policies and recreate with proper permissions

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON public.lots;
DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.lots;

-- Create new policies that work with Realtime
-- Allow anyone to read (including anonymous realtime subscriptions)
CREATE POLICY "Enable read access for all users" ON public.lots
    FOR SELECT
    USING (true);

-- Allow anyone to insert
CREATE POLICY "Enable insert for all users" ON public.lots
    FOR INSERT
    WITH CHECK (true);

-- Allow anyone to update
CREATE POLICY "Enable update for all users" ON public.lots
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow anyone to delete
CREATE POLICY "Enable delete for all users" ON public.lots
    FOR DELETE
    USING (true);

-- Verify the table is in the realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lots';
