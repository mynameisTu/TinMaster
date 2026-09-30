begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  add column username text,
  add column public_member_id text,
  add column avatar_path text;

create or replace function public.generate_public_member_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'TM-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));
$$;

alter table public.profiles
  alter column public_member_id
  set default public.generate_public_member_id();

update public.profiles
set public_member_id = public.generate_public_member_id()
where public_member_id is null;

alter table public.profiles
  alter column public_member_id set not null,
  add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$'),
  add constraint profiles_public_member_id_format
    check (public_member_id ~ '^TM-[A-F0-9]{16}$'),
  add constraint profiles_avatar_path_owner
    check (
      avatar_path is null
      or avatar_path ~ (
        '^' || id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$'
      )
    );

create unique index profiles_username_unique
  on public.profiles (username)
  where username is not null;

create unique index profiles_public_member_id_unique
  on public.profiles (public_member_id);

create table private.member_profile_update_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1)
);

create table private.member_avatar_upload_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1)
);

create table private.member_avatar_upload_reservations (
  user_id uuid not null references auth.users(id) on delete cascade,
  object_name text not null unique,
  reserved_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  primary key (user_id, object_name)
);

create table private.member_avatar_cleanup_queue (
  user_id uuid not null references auth.users(id) on delete restrict,
  object_name text not null,
  queued_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (user_id, object_name)
);

alter table private.member_profile_update_limits owner to postgres;
alter table private.member_avatar_upload_limits owner to postgres;
alter table private.member_avatar_upload_reservations owner to postgres;
alter table private.member_avatar_cleanup_queue owner to postgres;

alter table private.member_profile_update_limits enable row level security;
alter table private.member_avatar_upload_limits enable row level security;
alter table private.member_avatar_upload_reservations enable row level security;
alter table private.member_avatar_cleanup_queue enable row level security;
revoke all on private.member_profile_update_limits from public, anon, authenticated;
revoke all on private.member_avatar_upload_limits from public, anon, authenticated;
revoke all on private.member_avatar_upload_reservations from public, anon, authenticated;
revoke all on private.member_avatar_cleanup_queue from public, anon, authenticated;

create or replace function public.consume_member_profile_update_limit()
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into private.member_profile_update_limits as current_limit (
    user_id, window_started_at, request_count
  )
  values (auth.uid(), pg_catalog.clock_timestamp(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when current_limit.window_started_at + interval '1 hour'
          <= pg_catalog.clock_timestamp()
          then pg_catalog.clock_timestamp()
        else current_limit.window_started_at
      end,
      request_count = case
        when current_limit.window_started_at + interval '1 hour'
          <= pg_catalog.clock_timestamp()
          then 1
        else current_limit.request_count + 1
      end
  returning request_count into v_count;

  if v_count > 10 then
    raise exception 'Profile update limit exceeded; try again later'
      using errcode = 'P0001', detail = 'PROFILE_RATE_LIMIT';
  end if;
end;
$$;

create or replace function public.update_my_member_profile(
  p_display_name text,
  p_username text,
  p_exam_track text
)
returns table (
  id uuid,
  username text,
  public_member_id text,
  display_name text,
  role text,
  exam_track text,
  avatar_path text
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_username text := lower(btrim(coalesce(p_username, '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(v_display_name) not between 1 and 80 then
    raise exception 'Display name must be between 1 and 80 characters'
      using errcode = '22023';
  end if;

  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 lowercase letters, digits, or underscores'
      using errcode = '22023';
  end if;

  if p_exam_track is not null and p_exam_track not in ('ICT', 'CS') then
    raise exception 'Learning orientation must be ICT, CS, or null'
      using errcode = '22023';
  end if;

  perform public.consume_member_profile_update_limit();

  update public.profiles p
  set display_name = v_display_name,
      username = v_username,
      exam_track = p_exam_track,
      updated_at = pg_catalog.clock_timestamp()
  where p.id = auth.uid();

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return query
  select p.id, p.username, p.public_member_id, p.display_name,
         p.role, p.exam_track, p.avatar_path
  from public.profiles p
  where p.id = auth.uid();
end;
$$;

create or replace function public.list_public_members(
  p_query text default '',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  username text,
  public_member_id text,
  display_name text,
  role text,
  exam_track text,
  avatar_path text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_query text := lower(btrim(coalesce(p_query, '')));
  v_like_pattern text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(v_query) > 64
    or p_limit is null or p_limit not between 1 and 50
    or p_offset is null or p_offset not between 0 and 10000 then
    raise exception 'Invalid directory query or pagination'
      using errcode = '22023';
  end if;

  -- Treat %, _, and \ as literals so directory search cannot expand wildcards.
  v_like_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select p.username, p.public_member_id, p.display_name,
         p.role, p.exam_track, p.avatar_path
  from public.profiles p
  where p.username is not null
    and (
      v_query = ''
      or p.username like v_like_pattern escape '\'
      or lower(p.display_name) like v_like_pattern escape '\'
      or lower(p.public_member_id) like v_like_pattern escape '\'
    )
  order by p.username
  limit p_limit
  offset p_offset;
end;
$$;

create or replace function public.get_public_member(p_username text)
returns table (
  username text,
  public_member_id text,
  display_name text,
  role text,
  exam_track text,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select p.username, p.public_member_id, p.display_name,
         p.role, p.exam_track, p.avatar_path
  from public.profiles p
  where auth.uid() is not null
    and p.username = lower(btrim(coalesce(p_username, '')))
    and p.username is not null;
$$;

create or replace function public.get_my_member_profile()
returns table (
  id uuid,
  username text,
  public_member_id text,
  display_name text,
  role text,
  exam_track text,
  avatar_path text
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select p.id, p.username, p.public_member_id, p.display_name,
         p.role, p.exam_track, p.avatar_path
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.set_my_avatar_path(p_object_name text)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_old_path text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_object_name is null or p_object_name !~ (
    '^' || auth.uid()::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$'
  ) then
    raise exception 'Invalid avatar path' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects o
    join private.member_avatar_upload_reservations r
      on r.user_id = auth.uid()
     and r.object_name = o.name
     and r.consumed_at is null
     and r.expires_at > pg_catalog.clock_timestamp()
    where o.bucket_id = 'tinmaster-avatars'
      and o.name = p_object_name
  ) then
    raise exception 'Avatar upload is missing, expired, or already used'
      using errcode = '22023';
  end if;

  select p.avatar_path into v_old_path
  from public.profiles p
  where p.id = auth.uid()
  for update;

  update private.member_avatar_upload_reservations
  set consumed_at = pg_catalog.clock_timestamp()
  where user_id = auth.uid()
    and object_name = p_object_name
    and consumed_at is null;

  if v_old_path is not null then
    insert into private.member_avatar_cleanup_queue (user_id, object_name)
    values (auth.uid(), v_old_path)
    on conflict (user_id, object_name) do nothing;
  end if;

  update public.profiles
  set avatar_path = p_object_name,
      updated_at = pg_catalog.clock_timestamp()
  where id = auth.uid();

  return v_old_path;
end;
$$;

create or replace function public.remove_my_avatar()
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_old_path text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.avatar_path into v_old_path
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if v_old_path is not null then
    insert into private.member_avatar_cleanup_queue (user_id, object_name)
    values (auth.uid(), v_old_path)
    on conflict (user_id, object_name) do nothing;
  end if;

  update public.profiles
  set avatar_path = null,
      updated_at = pg_catalog.clock_timestamp()
  where id = auth.uid()
    and avatar_path is not null;

  return v_old_path;
end;
$$;

create or replace function public.complete_my_avatar_cleanup(p_object_name text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or p_object_name is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'tinmaster-avatars'
      and o.name = p_object_name
  ) then
    raise exception 'Avatar object must be removed before cleanup is completed'
      using errcode = '55000';
  end if;

  delete from private.member_avatar_cleanup_queue q
  where q.user_id = auth.uid()
    and q.object_name = p_object_name;
end;
$$;

create or replace function public.guard_member_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.avatar_path is not null or exists (
    select 1 from private.member_avatar_cleanup_queue q
    where q.user_id = old.id
  ) then
    raise exception 'Avatar cleanup is required before account deletion'
      using errcode = '23503';
  end if;
  return old;
end;
$$;

create trigger profiles_guard_member_delete
before delete on public.profiles
for each row execute function public.guard_member_profile_delete();

create or replace function public.admin_set_public_member_id(
  p_user_id uuid,
  p_public_member_id text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_member_id text := upper(btrim(coalesce(p_public_member_id, '')));
begin
  if auth.uid() is null or not public.is_current_user_admin() then
    raise exception 'Recent administrator authentication required'
      using errcode = '42501';
  end if;

  if p_user_id is null or v_member_id !~ '^TM-[A-F0-9]{16}$' then
    raise exception 'Invalid public member identifier' using errcode = '22023';
  end if;

  update public.profiles p
  set public_member_id = v_member_id,
      updated_at = pg_catalog.clock_timestamp()
  where p.id = p_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.reserve_my_avatar_upload(p_object_name text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_object_name is null or p_object_name !~ (
    '^' || auth.uid()::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$'
  ) then
    raise exception 'Invalid avatar upload path' using errcode = '22023';
  end if;

  insert into private.member_avatar_upload_limits as current_limit (
    user_id, window_started_at, request_count
  )
  values (auth.uid(), pg_catalog.clock_timestamp(), 1)
  on conflict (user_id) do update
  set window_started_at = case
        when current_limit.window_started_at + interval '1 hour'
          <= pg_catalog.clock_timestamp()
          then pg_catalog.clock_timestamp()
        else current_limit.window_started_at
      end,
      request_count = case
        when current_limit.window_started_at + interval '1 hour'
          <= pg_catalog.clock_timestamp()
          then 1
        else current_limit.request_count + 1
      end
  returning request_count into v_count;

  if v_count > 5 then
    raise exception 'Avatar upload limit exceeded; try again later'
      using errcode = 'P0001', detail = 'AVATAR_RATE_LIMIT';
  end if;

  insert into private.member_avatar_upload_reservations (
    user_id, object_name, expires_at
  )
  values (
    auth.uid(), p_object_name, pg_catalog.clock_timestamp() + interval '15 minutes'
  );
end;
$$;

create or replace function private.is_my_pending_avatar_upload(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from private.member_avatar_upload_reservations r
    where r.user_id = auth.uid()
      and r.object_name = p_object_name
      and r.consumed_at is null
      and r.expires_at > pg_catalog.clock_timestamp()
  );
$$;

create or replace function private.can_delete_my_old_avatar(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null
    and p_object_name like auth.uid()::text || '/%'
    and not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.avatar_path = p_object_name
    );
$$;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'tinmaster-avatars',
  'tinmaster-avatars',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from storage.buckets b
    where b.id = 'tinmaster-avatars'
      and b.public = false
      and b.file_size_limit = 4194304
      and b.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  ) then
    raise exception 'tinmaster-avatars bucket exists with incompatible settings';
  end if;
end;
$$;

drop policy if exists tinmaster_avatar_authenticated_read on storage.objects;
create policy tinmaster_avatar_authenticated_read
  on storage.objects for select to authenticated
  using (bucket_id = 'tinmaster-avatars');

drop policy if exists tinmaster_avatar_reserved_owner_insert on storage.objects;
create policy tinmaster_avatar_reserved_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tinmaster-avatars'
    and private.is_my_pending_avatar_upload(name)
  );

drop policy if exists tinmaster_avatar_owner_delete_unreferenced on storage.objects;
create policy tinmaster_avatar_owner_delete_unreferenced
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tinmaster-avatars'
    and private.can_delete_my_old_avatar(name)
  );

alter function public.generate_public_member_id() owner to postgres;
alter function public.consume_member_profile_update_limit() owner to postgres;
alter function public.update_my_member_profile(text, text, text) owner to postgres;
alter function public.list_public_members(text, integer, integer) owner to postgres;
alter function public.get_public_member(text) owner to postgres;
alter function public.get_my_member_profile() owner to postgres;
alter function public.set_my_avatar_path(text) owner to postgres;
alter function public.remove_my_avatar() owner to postgres;
alter function public.complete_my_avatar_cleanup(text) owner to postgres;
alter function public.guard_member_profile_delete() owner to postgres;
alter function public.reserve_my_avatar_upload(text) owner to postgres;
alter function public.admin_set_public_member_id(uuid, text) owner to postgres;
alter function private.is_my_pending_avatar_upload(text) owner to postgres;
alter function private.can_delete_my_old_avatar(text) owner to postgres;

revoke all on function public.generate_public_member_id() from public, anon, authenticated;
revoke all on function public.consume_member_profile_update_limit() from public, anon, authenticated;
revoke all on function public.update_my_member_profile(text, text, text) from public, anon;
revoke all on function public.list_public_members(text, integer, integer) from public, anon;
revoke all on function public.get_public_member(text) from public, anon;
revoke all on function public.get_my_member_profile() from public, anon;
revoke all on function public.set_my_avatar_path(text) from public, anon;
revoke all on function public.remove_my_avatar() from public, anon;
revoke all on function public.complete_my_avatar_cleanup(text) from public, anon;
revoke all on function public.guard_member_profile_delete() from public, anon, authenticated;
revoke all on function public.reserve_my_avatar_upload(text) from public, anon;
revoke all on function public.admin_set_public_member_id(uuid, text) from public, anon;
revoke all on function private.is_my_pending_avatar_upload(text) from public, anon;
revoke all on function private.can_delete_my_old_avatar(text) from public, anon;

grant execute on function public.update_my_member_profile(text, text, text) to authenticated;
grant execute on function public.list_public_members(text, integer, integer) to authenticated;
grant execute on function public.get_public_member(text) to authenticated;
grant execute on function public.get_my_member_profile() to authenticated;
grant execute on function public.set_my_avatar_path(text) to authenticated;
grant execute on function public.remove_my_avatar() to authenticated;
grant execute on function public.complete_my_avatar_cleanup(text) to authenticated;
grant execute on function public.reserve_my_avatar_upload(text) to authenticated;
grant execute on function public.admin_set_public_member_id(uuid, text) to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_my_pending_avatar_upload(text) to authenticated;
grant execute on function private.can_delete_my_old_avatar(text) to authenticated;

-- Close the legacy column UPDATE grants from the profiles foundation migration.
-- Member fields must go through rate-limited RPCs. OAuth avatar_url continues
-- via public.handle_auth_user_profile() (SECURITY DEFINER). Authenticated
-- clients keep SELECT so auth bootstrap and settings can read the row.
revoke update on table public.profiles from authenticated;
revoke update (
  display_name, avatar_url, school, grade, exam_track, target_score
) on table public.profiles from authenticated;

commit;
