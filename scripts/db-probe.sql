select
  (select coalesce(string_agg(nspname, ', ' order by nspname), '(none)')
     from pg_namespace
    where nspname in ('supabase_migrations','public','auth','storage','graphql','realtime')) as relevant_schemas,
  (select coalesce(string_agg(table_schema || '.' || table_name, ', ' order by table_schema, table_name), '(none)')
     from information_schema.tables
    where table_name in ('schema_migrations','_supabase_migrations')) as migration_history_tables_found,
  (to_regclass('supabase_migrations.schema_migrations') is not null) as has_modern_history,
  (to_regclass('public._supabase_migrations') is not null) as has_legacy_history,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE') as public_table_count,
  (select coalesce(string_agg(table_name, ', ' order by table_name), '(none)')
     from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE') as public_tables,
  (select count(*) from pg_policies where schemaname='public') as rls_policy_count,
  (select coalesce(string_agg(tablename || ' :: ' || policyname || ' [' || cmd || ']', '  |  ' order by tablename, policyname), '(none)')
     from pg_policies where schemaname='public') as rls_policies,
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '(none)')
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and c.relname ilike any (array['%contact%','%message%','%inbox%','%lead%'])) as candidate_contact_tables,
  current_setting('server_version') as postgres_version, now() as probed_at;
