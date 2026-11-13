-- ============================================================================
-- 20261113120000_contact_hardening.sql
-- Purpose: Make the public contact endpoint production-safe.
-- Design: SELF-HEALING and idempotent. Resolves whatever contact table exists.
-- ============================================================================

-- 1. Defensive columns on the resolved table (idempotent)
do $$
declare v_tbl text;
begin
  select c.relname into v_tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname in ('contact_message','contact_messages','messages','contact','inbox_message','lead_message')
   order by case c.relname when 'contact_message' then 1 when 'contact_messages' then 2
                           when 'messages' then 3 when 'inbox_message' then 4
                           when 'lead_message' then 5 else 6 end
   limit 1;

  if v_tbl is null then
    raise notice USING MESSAGE = 'contact_hardening: no contact table found — NO-OP.';
    return;
  end if;

  raise notice USING MESSAGE = 'contact_hardening: target table = public.' || v_tbl;

  execute format('alter table public.%I add column if not exists honeypot text', v_tbl);
  execute format('alter table public.%I add column if not exists ip inet', v_tbl);
  execute format('alter table public.%I add column if not exists user_agent text', v_tbl);
  execute format('alter table public.%I add column if not exists archived_at timestamptz', v_tbl);
  execute format('alter table public.%I add column if not exists received_at timestamptz', v_tbl);

exception
  when undefined_column then
    raise notice USING MESSAGE = 'contact_hardening: unexpected schema — skipping column adds.';
end;
$$;

-- 2. RLS: INSERT-only for anon. No SELECT/UPDATE/DELETE policy => deny by default.
do $$
declare v_tbl text;
begin
  select c.relname into v_tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname in ('contact_message','contact_messages','messages','contact','inbox_message','lead_message')
   order by case c.relname when 'contact_message' then 1 when 'contact_messages' then 2
                           when 'messages' then 3 when 'inbox_message' then 4
                           when 'lead_message' then 5 else 6 end
   limit 1;

  if v_tbl is null then return; end if;

  execute format('alter table public.%I enable row level security', v_tbl);
  execute format('alter table public.%I force row level security', v_tbl);

  -- FIX: Use %I for identifiers (policy names), not %L (string literals)
  execute format('drop policy if exists %I on public.%I', 'anon_can_submit_contact', v_tbl);
  
  execute format('create policy %I on public.%I for insert to anon, authenticated with check (honeypot is null or honeypot = %L)',
                 'anon_can_submit_contact', v_tbl, '');

  raise notice USING MESSAGE = 'contact_hardening: RLS enforced on public.' || v_tbl;
end;
$$;
