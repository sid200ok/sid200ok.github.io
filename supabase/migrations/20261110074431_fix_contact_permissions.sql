-- 1. Ensure schema access
GRANT USAGE ON SCHEMA public TO anon;

-- 2. Grant explicit table privileges (ALL covers INSERT, SELECT, etc.)
GRANT ALL ON public.contact_messages TO anon;

-- 3. Enforce Row Level Security
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 4. Clean slate: drop old policies to prevent conflicts
DROP POLICY IF EXISTS "Allow public to insert messages" ON public.contact_messages;
DROP POLICY IF EXISTS "anon_can_insert" ON public.contact_messages;

-- 5. Create definitive, unambiguous policies
CREATE POLICY "anon_can_insert" 
ON public.contact_messages 
FOR INSERT 
TO anon 
WITH CHECK (true);

CREATE POLICY "authenticated_can_read" 
ON public.contact_messages 
FOR SELECT 
TO authenticated 
USING (true);
