-- 提问墙数据层：表、RLS、Realtime、RPC
-- security definer 实现放在 private schema；public 仅保留同名 invoker 包装供 supabase.rpc 调用。

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- 表
-- ---------------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author_name text,
  status text not null default 'open',
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint questions_body_len check (char_length(body) between 1 and 200),
  constraint questions_author_name_len check (author_name is null or char_length(author_name) <= 40),
  constraint questions_status_allowed check (status in ('open', 'speaking', 'answered')),
  constraint questions_vote_count_nonneg check (vote_count >= 0)
);

create index questions_status_vote_count_idx
  on public.questions (status, vote_count desc);

create table public.votes (
  question_id uuid not null references public.questions (id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, voter_key)
);

create index votes_voter_key_idx on public.votes (voter_key);

create table public.host_secrets (
  id boolean primary key default true check (id),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.host_sessions (
  token_hash text primary key,
  expires_at timestamptz not null default (now() + interval '12 hours'),
  created_at timestamptz not null default now()
);

comment on table public.host_secrets is '单行表，只存主持 PIN 哈希。匿名不可访问。';
comment on table public.host_sessions is '只存主持会话 token 哈希。匿名不可访问。';

-- 仅供限流，不通过 API 暴露
create table private.question_submissions (
  id bigint generated always as identity primary key,
  voter_key text not null,
  created_at timestamptz not null default now()
);

create index question_submissions_voter_key_created_at_idx
  on private.question_submissions (voter_key, created_at desc);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.questions replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'questions'
  ) then
    alter publication supabase_realtime add table public.questions;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- vote_count 与 votes 行数同步
-- ---------------------------------------------------------------------------

create or replace function private.sync_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.questions
    set vote_count = vote_count + 1
    where id = new.question_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.questions
    set vote_count = greatest(vote_count - 1, 0)
    where id = old.question_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger votes_sync_count
after insert or delete on public.votes
for each row execute function private.sync_vote_count();

-- ---------------------------------------------------------------------------
-- 校验辅助
-- ---------------------------------------------------------------------------

create or replace function private.assert_voter_key(p_voter_key text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v text;
begin
  v := trim(both from coalesce(p_voter_key, ''));
  if v = '' or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid voter_key' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC 实现（private, security definer）
-- ---------------------------------------------------------------------------

create or replace function private.submit_question(
  p_body text,
  p_author_name text,
  p_voter_key text
)
returns public.questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_body text;
  v_author text;
  v_count integer;
  v_row public.questions;
begin
  v_key := private.assert_voter_key(p_voter_key);
  v_body := trim(both from coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 200 then
    raise exception 'body must be 1 to 200 characters' using errcode = '22023';
  end if;

  v_author := nullif(trim(both from coalesce(p_author_name, '')), '');
  if v_author is not null and char_length(v_author) > 40 then
    raise exception 'author_name must be at most 40 characters' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select count(*) into v_count
  from private.question_submissions
  where voter_key = v_key
    and created_at > now() - interval '1 hour';

  if v_count >= 5 then
    raise exception 'rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.questions (body, author_name, status, vote_count)
  values (v_body, v_author, 'open', 0)
  returning * into v_row;

  insert into private.question_submissions (voter_key)
  values (v_key);

  return v_row;
end;
$$;

create or replace function private.toggle_vote(
  p_question_id uuid,
  p_voter_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_status text;
  v_exists boolean;
  v_count integer;
begin
  v_key := private.assert_voter_key(p_voter_key);

  if p_question_id is null then
    raise exception 'invalid question_id' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_question_id::text, 1));

  select status into v_status
  from public.questions
  where id = p_question_id
  for update;

  if v_status is null then
    raise exception 'question not found' using errcode = 'P0002';
  end if;

  if v_status not in ('open', 'speaking') then
    raise exception 'cannot vote on answered question' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.votes
    where question_id = p_question_id and voter_key = v_key
  ) into v_exists;

  if v_exists then
    delete from public.votes
    where question_id = p_question_id and voter_key = v_key;
  else
    insert into public.votes (question_id, voter_key)
    values (p_question_id, v_key);
  end if;

  select vote_count into v_count
  from public.questions
  where id = p_question_id;

  return jsonb_build_object('vote_count', v_count, 'voted', not v_exists);
end;
$$;

create or replace function private.verify_host_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_token text;
  v_token_hash text;
  v_expires timestamptz;
begin
  select pin_hash into v_hash
  from public.host_secrets
  where id = true;

  if v_hash is null
     or p_pin is null
     or extensions.crypt(p_pin, v_hash) <> v_hash then
    raise exception 'invalid pin' using errcode = '28000';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires := now() + interval '12 hours';

  insert into public.host_sessions (token_hash, expires_at)
  values (v_token_hash, v_expires);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

create or replace function private.set_question_status(
  p_question_id uuid,
  p_status text,
  p_session_token text
)
returns public.questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_expires timestamptz;
  v_row public.questions;
begin
  if p_session_token is null or trim(both from p_session_token) = '' then
    raise exception 'invalid or expired session' using errcode = '28000';
  end if;

  v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

  select expires_at into v_expires
  from public.host_sessions
  where token_hash = v_token_hash;

  if v_expires is null or v_expires <= now() then
    raise exception 'invalid or expired session' using errcode = '28000';
  end if;

  if p_status is null or p_status not in ('open', 'speaking', 'answered') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  if p_question_id is null then
    raise exception 'invalid question_id' using errcode = '22023';
  end if;

  perform 1
  from public.questions
  where id = p_question_id or status = 'speaking'
  for update;

  if not exists (select 1 from public.questions where id = p_question_id) then
    raise exception 'question not found' using errcode = 'P0002';
  end if;

  if p_status = 'speaking' then
    update public.questions
    set status = 'open'
    where status = 'speaking'
      and id <> p_question_id;
  end if;

  update public.questions
  set status = p_status
  where id = p_question_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- public invoker 包装（供 supabase.rpc 调用）
-- ---------------------------------------------------------------------------

create or replace function public.submit_question(
  body text,
  author_name text,
  voter_key text
)
returns public.questions
language sql
security invoker
set search_path = ''
as $$
  select * from private.submit_question(body, author_name, voter_key);
$$;

create or replace function public.toggle_vote(
  question_id uuid,
  voter_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.toggle_vote(question_id, voter_key);
$$;

create or replace function public.verify_host_pin(pin text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.verify_host_pin(pin);
$$;

create or replace function public.set_question_status(
  question_id uuid,
  status text,
  session_token text
)
returns public.questions
language sql
security invoker
set search_path = ''
as $$
  select * from private.set_question_status(question_id, status, session_token);
$$;

-- ---------------------------------------------------------------------------
-- 权限与 RLS
-- ---------------------------------------------------------------------------

revoke all on function private.submit_question(text, text, text) from public;
revoke all on function private.toggle_vote(uuid, text) from public;
revoke all on function private.verify_host_pin(text) from public;
revoke all on function private.set_question_status(uuid, text, text) from public;
revoke all on function private.sync_vote_count() from public;
revoke all on function private.assert_voter_key(text) from public;

revoke all on function public.submit_question(text, text, text) from public;
revoke all on function public.toggle_vote(uuid, text) from public;
revoke all on function public.verify_host_pin(text) from public;
revoke all on function public.set_question_status(uuid, text, text) from public;

grant usage on schema public to anon, authenticated;
grant usage on schema private to anon, authenticated;

grant execute on function private.submit_question(text, text, text) to anon, authenticated;
grant execute on function private.toggle_vote(uuid, text) to anon, authenticated;
grant execute on function private.verify_host_pin(text) to anon, authenticated;
grant execute on function private.set_question_status(uuid, text, text) to anon, authenticated;

grant execute on function public.submit_question(text, text, text) to anon, authenticated;
grant execute on function public.toggle_vote(uuid, text) to anon, authenticated;
grant execute on function public.verify_host_pin(text) to anon, authenticated;
grant execute on function public.set_question_status(uuid, text, text) to anon, authenticated;

grant select on table public.questions to anon, authenticated;

revoke all on table public.votes from public, anon, authenticated;
revoke all on table public.host_secrets from public, anon, authenticated;
revoke all on table public.host_sessions from public, anon, authenticated;
revoke all on table private.question_submissions from public, anon, authenticated;

alter table public.questions enable row level security;
alter table public.votes enable row level security;
alter table public.host_secrets enable row level security;
alter table public.host_sessions enable row level security;
alter table private.question_submissions enable row level security;

create policy questions_select
  on public.questions
  for select
  to anon, authenticated
  using (true);

-- votes / host_* / private.question_submissions 不建策略：启用 RLS 后默认拒绝
