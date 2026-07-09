-- Roles + schemas expected by PostgREST and GoTrue. Runs before any
-- application migration because filenames sort lexicographically and
-- this file is prefixed 00-.
--
-- Idempotent: safe to re-run on an existing volume.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute format(
      'create role authenticator noinherit login password %L',
      current_setting('POSTGRES_PASSWORD', true)
    );
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute format(
      'create role supabase_auth_admin login password %L',
      current_setting('POSTGRES_PASSWORD', true)
    );
  end if;
end$$;

grant anon, authenticated, service_role to authenticator;

create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
