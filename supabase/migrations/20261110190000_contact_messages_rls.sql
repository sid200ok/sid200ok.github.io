-- Authoritative contact_messages RLS migration.
--
-- Behavior:
--   anon -> INSERT allowed
--   anon -> SELECT allowed at privilege level, but no SELECT policy exists
--   therefore anon SELECT returns zero rows: []
--
-- Do not place secrets in this file.

create table if not exists public.contact_messages (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) between 3 and 254),
  message    text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

-- Helpful index for admin review / spam investigation.
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

-- Enable RLS.
alter table public.contact_messages enable row level security;

-- Drop all existing policies on this table to make this migration authoritative.
do $$
declare
  pol text;
begin
  for pol in
    select polname
    from pg_policy
    where polrelid = 'public.contact_messages'::regclass
  loop
    execute format('drop policy if exists %I on public.contact_messages', pol);
  end loop;
end $$;

-- Insert-only policy for public contact form.
create policy "contact_messages_anon_insert"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

-- No SELECT policy is created.
-- Because anon has SELECT privilege but no SELECT policy, reads return [].

-- Reset privileges conservatively.
revoke all on table public.contact_messages from public;
revoke all on table public.contact_messages from anon;
revoke all on table public.contact_messages from authenticated;

-- Anon may insert and may attempt select, but select returns zero rows due RLS.
grant insert, select on table public.contact_messages to anon;

-- Authenticated may insert if needed; no select policy means no rows returned.
grant insert on table public.contact_messages to authenticated;

-- Grant sequence usage if the identity/serial sequence exists.
do $$
declare
  seq text;
begin
  seq := pg_get_serial_sequence('public.contact_messages', 'id');
  if seq is not null then
    execute format('grant usage on sequence %s to anon, authenticated', seq);
  end if;
end $$;
