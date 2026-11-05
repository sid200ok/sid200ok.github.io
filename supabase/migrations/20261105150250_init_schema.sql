-- supabase/migrations/<timestamp>_init_schema.sql

-- 1. Contact Messages Table (for your booking/inquiry forms)
create table public.contact_messages (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    full_name text not null,
    email text not null,
    message text not null
);

-- Enable Row Level Security
alter table public.contact_messages enable row level security;

-- Policy: Allow ANYONE (anonymous) to INSERT a message
create policy "Allow public to insert messages"
on public.contact_messages
for insert
to anon
with check (true);

-- Policy: ONLY authenticated users (you, via the admin dashboard or secure token) can READ messages
create policy "Allow authenticated users to read messages"
on public.contact_messages
for select
to authenticated
using (true);


-- 2. Projects Table (for your dynamic portfolio grid)
create table public.projects (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text not null,
    description text not null,
    status text check (status in ('idea', 'mvp', 'production', 'archived')) default 'idea',
    link text,
    is_public boolean default true
);

-- Enable Row Level Security
alter table public.projects enable row level security;

-- Policy: Allow ANYONE to read projects marked as public
create policy "Allow public to read public projects"
on public.projects
for select
to anon
using (is_public = true);

-- Policy: Allow authenticated users to do everything (read, insert, update, delete)
create policy "Allow authenticated users full access"
on public.projects
for all
to authenticated
using (true)
with check (true);
