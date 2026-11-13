-- 20261113120000_contact_hardening.sql
--
-- SELF-HEALING + IDEMPOTENT. Resolves whatever contact table already exists and
-- hardens THAT, rather than assuming a name. Deliberate: 20261110074801 was just
-- marked `reverted`, so we do not yet know if its objects are present. A migration
-- that guessed wrong here would create a duplicate table.
--
-- If no contact table exists, this RAISES a notice and no-ops. In that case the
-- correct action is `migration repair --status applied` or making 20261110074801
-- idempotent and re-pushing it — not letting this file invent a schema.
--
-- No BEGIN/COMMIT: the CLI manages the transaction, and remote units cannot
-- always be safely wrapped in one.

create extension if not exists pgcrypto with schema extensions;

-- 1. Defensive columns on the resolved table
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
    raise notice USING MESSAGE = 'contact_hardening: no contact table found — NO-OP; resolve 20261110074801 first.';
    return;
  end if;
  raise notice USING MESSAGE = 'contact_hardening: target = public.' || v_tbl;
  execute format('alter table public.%I add column if not exists honeypot text', v_tbl);
  execute format('alter table public.%I add column if not exists ip inet', v_tbl);
  execute format('alter table public.%I add column if not exists user_agent text', v_tbl);
  execute format('alter table public.%I add column if not exists archived_at timestamptz', v_tbl);
  execute format('alter table public.%I add column if not exists received_at timestamptz', v_tbl);
exception when undefined_column then
  raise notice USING MESSAGE = 'contact_hardening: unexpected schema — skipping column adds; reconcile with 20261110074801.';
end;
$$;

-- 2. RLS: INSERT-only for anon. No SELECT/UPDATE/DELETE policy => deny by default.
--    The browser holds the anon key, so the DATABASE is the authorisation boundary.
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
  execute format('drop policy if exists %L on public.%I', 'anon can submit contact message', v_tbl);
  execute format('create policy %L on public.%I for insert to anon, authenticated with check (honeypot is null or honeypot = %L)',
                 'anon can submit contact message', v_tbl, '');
  raise notice USING MESSAGE = 'contact_hardening: RLS enforced on public.' || v_tbl;
end;
$$;

-- 3. Rate-limited intake RPC.
--    SECURITY DEFINER is REQUIRED: anon must not read the table to count its own
--    recent submissions, so counting runs as owner. Supabase's advisor will flag
--    `anon_security_definer_function_executable` — that is CORRECT BY DESIGN for a
--    public contact form. We satisfy the lint's intent by pinning search_path,
--    validating every input inside the function, and returning status only (never
--    stored rows). Real IP enforcement belongs in an Edge Function reading the
--    trusted CF-Connecting-IP header; client-supplied IPs are spoofable.
create or replace function public.submit_contact_message(
  p_name text, p_email text, p_body text,
  p_subject text default null, p_honeypot text default null,
  p_url text default null, p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare v_tbl text; v_ip inet; v_recent bigint; v_id uuid;
begin
  select c.relname into v_tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname in ('contact_message','contact_messages','messages','contact','inbox_message','lead_message')
   order by case c.relname when 'contact_message' then 1 when 'contact_messages' then 2
                           when 'messages' then 3 when 'inbox_message' then 4
                           when 'lead_message' then 5 else 6 end
   limit 1;
  if v_tbl is null then
    return jsonb_build_object('ok', false, 'error', 'endpoint_not_provisioned');
  end if;

  -- Honeypot: reject silently but answer SUCCESS so the bot does not adapt.
  if p_honeypot is not null and p_honeypot <> '' then
    return jsonb_build_object('ok', true, 'id', null);
  end if;

  if p_name is null or btrim(p_name) = '' or char_length(p_name) > 120 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name'); end if;
  if p_email is null or char_length(p_email) > 254
     or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email'); end if;
  if p_body is null or btrim(p_body) = '' or char_length(p_body) > 8000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_body'); end if;
  if p_subject is not null and char_length(p_subject) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_subject'); end if;

  v_ip := nil_inet();
  begin
    v_ip := (nullif(current_setting('request.headers', true), ''))::jsonb ->> 'x-forwarded-for';
    v_ip := v_ip::inet;
  exception when others then
    v_ip := nil_inet();
  end;

  if v_ip is not null then
    execute format('select count(*) from public.%I where created_at > now() - interval %L and (ip = $1 or lower(email) = lower($2))',
                   v_tbl, '1 hour') into v_recent using v_ip, p_email;
  else
    execute format('select count(*) from public.%I where created_at > now() - interval %L and lower(email) = lower($1)',
                   v_tbl, '1 hour') into v_recent using p_email;
  end if;
  if coalesce(v_recent, 0) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  execute format('insert into public.%I (name,email,subject,body,url,user_agent,ip,honeypot,created_at) '
                 || 'values ($1,$2,$3,$4,$5,$6,$7,$8, now()) returning id', v_tbl)
    into v_id
    using btrim(p_name), lower(btrim(p_email)), nullif(btrim(coalesce(p_subject,'')),''),
          btrim(p_body), nullif(left(coalesce(p_url,''),2048),''),
          nullif(left(coalesce(p_user_agent,''),512),''), v_ip, null;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$fn$;

revoke all on function public.submit_contact_message(text,text,text,text,text,text,text) from public;
grant execute on function public.submit_contact_message(text,text,text,text,text,text,text) to anon, authenticated;

comment on function public.submit_contact_message(text,text,text,text,text,text,text) is
  'Public contact intake. SECURITY DEFINER by design (rate-limit read needs owner). '
  || 'Insert-only, returns status never data. Advisor flag '
  || 'anon_security_definer_function_executable is expected and accepted.';

-- 4. Operator inbox indexes
do $$
declare v_tbl text;
begin
  select c.relname into v_tbl from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname in ('contact_message','contact_messages','messages','contact','inbox_message','lead_message')
   limit 1;
  if v_tbl is null then return; end if;
  execute format('create index if not exists %I on public.%I (created_at desc)', v_tbl||'_created_at_idx', v_tbl);
  execute format('create index if not exists %I on public.%I (lower(email))', v_tbl||'_email_idx', v_tbl);
  execute format('create index if not exists %I on public.%I (ip, created_at desc)', v_tbl||'_ip_created_idx', v_tbl);
end;
$$;
