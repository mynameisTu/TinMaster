create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.api_rate_limit_config (
  endpoint text primary key check (
    endpoint in (
      '/api/ai/explain',
      '/api/ai/video-script',
      '/api/exercises/extract-file'
    )
  ),
  limit_count integer not null check (limit_count > 0),
  window_seconds integer not null check (window_seconds > 0),
  updated_at timestamptz not null default now()
);

insert into private.api_rate_limit_config (endpoint, limit_count, window_seconds)
values
  ('/api/ai/explain', 30, 60),
  ('/api/ai/video-script', 5, 60),
  ('/api/exercises/extract-file', 5, 60)
on conflict (endpoint) do nothing;

create table if not exists private.api_rate_limit_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null references private.api_rate_limit_config(endpoint) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, endpoint)
);

alter table private.api_rate_limit_config enable row level security;
alter table private.api_rate_limit_counters enable row level security;
revoke all on private.api_rate_limit_config from public, anon, authenticated;
revoke all on private.api_rate_limit_counters from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(p_endpoint text)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  limit_value integer,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  configured_limit integer;
  configured_window_seconds integer;
  current_count integer;
  current_window_started_at timestamptz;
  window_expiry timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select c.limit_count, c.window_seconds
  into configured_limit, configured_window_seconds
  from private.api_rate_limit_config c
  where c.endpoint = p_endpoint;

  if not found then
    raise exception 'Unknown rate limit endpoint' using errcode = '22023';
  end if;

  insert into private.api_rate_limit_counters as existing (
    user_id,
    endpoint,
    window_started_at,
    request_count
  )
  values (
    current_user_id,
    p_endpoint,
    statement_timestamp(),
    1
  )
  on conflict (user_id, endpoint) do update
  set
    window_started_at = case
      when existing.window_started_at
        + make_interval(secs => configured_window_seconds)
        <= statement_timestamp()
      then statement_timestamp()
      else existing.window_started_at
    end,
    request_count = case
      when existing.window_started_at
        + make_interval(secs => configured_window_seconds)
        <= statement_timestamp()
      then 1
      else existing.request_count + 1
    end
  returning existing.request_count, existing.window_started_at
  into current_count, current_window_started_at;

  window_expiry := current_window_started_at
    + make_interval(secs => configured_window_seconds);

  return query select
    current_count <= configured_limit,
    case
      when current_count <= configured_limit then 0
      else greatest(
        1,
        ceil(extract(epoch from (window_expiry - clock_timestamp())))::integer
      )
    end,
    configured_limit,
    greatest(0, configured_limit - current_count);
end;
$$;

revoke all on function public.consume_api_rate_limit(text) from public, anon;
grant execute on function public.consume_api_rate_limit(text) to authenticated;
