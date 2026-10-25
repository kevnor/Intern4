-- Security checks for the database schema. Read-only: it only looks at the catalogs.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db-security-check.sql
--   npm run security:db        (against the local Supabase stack)
--
-- Findings are 'high' (the script fails) or 'info' (printed, never fails). It checks the schema that
-- the migrations build, not the hosted project's dashboard settings (auth settings, hooks, MFA).
--
-- To accept a finding on purpose, add it to an allowlist below WITH a reason, so the history shows
-- what was accepted and why.

begin;

create temp table findings (
  severity text not null check (severity in ('high', 'info')),
  check_name text not null,
  object text not null,
  detail text not null
) on commit drop;

-- Functions that may be called by anon (or PUBLIC) although they are SECURITY DEFINER.
create temp table allow_definer_for_anon (function_name text primary key, reason text not null) on commit drop;
-- (none today)

-- Storage buckets that are meant to be public.
create temp table allow_public_bucket (bucket_id text primary key, reason text not null) on commit drop;
-- (none today)

-- Tables in public that anon may touch.
create temp table allow_anon_table (table_name text primary key, reason text not null) on commit drop;
-- (none today)

-- 1. Every table in public has row level security on.
insert into findings
select 'high', 'rls-disabled', format('public.%I', c.relname),
       'Row level security is off, so anyone with the API key can read and write it'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');

-- 2. SECURITY DEFINER functions pin their search_path (otherwise a caller can shadow what they use).
insert into findings
select 'high', 'definer-without-search-path', format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
       'SECURITY DEFINER without a fixed search_path'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg where cfg like 'search_path=%')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

-- 3. SECURITY DEFINER functions are not callable by anon or PUBLIC.
insert into findings
select 'high', 'definer-callable-by-anon', format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)),
       'SECURITY DEFINER function can be executed without signing in'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in (select function_name from allow_definer_for_anon)
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

-- 4. anon has no privileges on tables in public.
insert into findings
select 'high', 'anon-table-privilege', format('public.%I', c.relname),
       'anon has privileges on this table'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
  and (
    has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger')
    or has_any_column_privilege('anon', c.oid, 'select, insert, update, references')
  )
  and c.relname not in (select table_name from allow_anon_table)
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');

-- 5. Views run as their owner unless security_invoker is set, which bypasses RLS on the tables below.
insert into findings
select 'high', 'view-bypasses-rls', format('public.%I', c.relname),
       'View without security_invoker runs as its owner and bypasses row level security'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and not coalesce((select option_value::boolean from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), false);

-- 6. Public storage buckets are only the expected ones.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into findings
    select 'high', 'public-bucket', format('storage.%I', b.id), 'Bucket is public: anyone can read its files by URL'
    from storage.buckets b
    where b.public and b.id not in (select bucket_id from allow_public_bucket);
  end if;
end $$;

-- 7. A table with row level security and no policy is closed to everyone. Usually a mistake, but safe.
insert into findings
select 'info', 'rls-without-policy', format('public.%I', c.relname),
       'Row level security is on but there is no policy: only the service role can use it'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relrowsecurity
  and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid)
  and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');

-- Report
select severity, check_name, object, detail from findings order by severity, check_name, object;

do $$
declare
  v_high integer;
  v_info integer;
begin
  select count(*) filter (where severity = 'high'), count(*) filter (where severity = 'info')
  into v_high, v_info from findings;

  raise notice 'db-security-check: % high, % info', v_high, v_info;

  if v_high > 0 then
    raise exception 'db-security-check failed: % high finding(s), see the list above', v_high;
  end if;
end $$;

rollback;
