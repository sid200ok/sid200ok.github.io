-- ============================================================================
-- db-history.sql — READ ONLY.
--
-- PREREQUISITE: run scripts/db-probe.sql first and confirm which history
-- table exists. Then keep ONLY the matching block below and delete the other,
-- because Postgres parses the whole script and a missing relation raises 42P01
-- even inside a false predicate.
-- ============================================================================

-- ---------- BLOCK A: modern layout (schema supabase_migrations) ----------
select 'modern' as layout, *
  from supabase_migrations.schema_migrations
 order by version;

-- ---------- BLOCK B: legacy layout (table public._supabase_migrations) ----
-- select 'legacy' as layout, *
--   from public._supabase_migrations
--  order by version;

-- ---------- Targeted check for the version you repaired -------------------
-- Expect one of three outcomes, and each means something different:
--   0 rows              -> repair DELETED the row; next `db push` WILL re-run it
--   1 row, status=...   -> repair FLAGGED it; read the status column value
--   1 row, no status    -> repair did not take effect; re-run it
select version,
       '*' as present,
       xmlelement(name row, x.*)::text as raw_row
  from supabase_migrations.schema_migrations,
       lateral (select 1) AS x
 where version = '20261110074801';

-- ---------- Drift summary: local files vs remote history ------------------
-- Compare this list against `ls supabase/migrations` by hand. Any version
-- present in one and absent in the other is the real root cause of the
-- mismatch you were originally trying to patch over.
select version,
       coalesce(name, '(unnamed)') as migration_name,
       coalesce(runner,  '(unknown)') as runner
  from supabase_migrations.schema_migrations
 order by version desc;
