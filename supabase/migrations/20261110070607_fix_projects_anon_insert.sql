
-- Allow the anon role to insert into the projects table
GRANT INSERT ON public.projects TO anon;

-- Add an RLS policy to permit the insertion
create policy "Allow anon to insert projects"
on public.projects
for insert
to anon
with check (true);
