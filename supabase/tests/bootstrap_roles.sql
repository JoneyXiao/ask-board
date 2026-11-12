-- 在非 Supabase 的本地 Postgres 上补齐角色与 schema，便于验收迁移。
-- supabase start 环境已有这些角色，不要在正式 migration 里创建。

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists extensions;
grant usage on schema public to anon, authenticated, service_role;
