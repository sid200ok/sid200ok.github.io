-- Grant basic usage of the public schema to the anon role
GRANT USAGE ON SCHEMA public TO anon;

-- Grant specific table permissions required for the frontend to interact with them
GRANT SELECT ON public.projects TO anon;
GRANT INSERT ON public.contact_messages TO anon;

-- Re-assert RLS is enabled (harmless if already enabled, ensures safety)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
