create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  avatar_url text,
  role text not null default 'student'
    check (role in ('student', 'teacher', 'admin')),
  school text,
  grade smallint check (grade between 10 and 12),
  exam_track text check (exam_track in ('CS', 'ICT')),
  target_score numeric(3, 1) not null default 8.5
    check (target_score between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_single_admin
  on public.profiles (role) where role = 'admin';

create table if not exists public.teacher_invitations (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null,
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (invited_email = lower(trim(invited_email)))
);

create index if not exists teacher_invitations_admin_list
  on public.teacher_invitations (created_at desc);

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.handle_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = case
        when excluded.display_name <> '' then excluded.display_name
        else public.profiles.display_name
      end,
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_created on auth.users;
create trigger on_auth_user_profile_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_auth_user_profile();

insert into public.profiles (id, email, display_name, avatar_url)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, email, display_name, avatar_url)
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
    coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

create or replace function public.create_teacher_invitation(p_email text)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_token text;
  invitation_expiry timestamptz := now() + interval '7 days';
  normalized_email text := lower(trim(p_email));
begin
  if not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  invitation_token := translate(
    rtrim(encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );

  insert into public.teacher_invitations (
    invited_email,
    token_hash,
    invited_by,
    expires_at
  )
  values (
    normalized_email,
    encode(extensions.digest(convert_to(invitation_token, 'UTF8'), 'sha256'), 'hex'),
    auth.uid(),
    invitation_expiry
  );

  return query select invitation_token, invitation_expiry;
end;
$$;

create or replace function public.redeem_teacher_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_email text;
  invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(u.email)
  into current_email
  from auth.users u
  where u.id = auth.uid()
    and u.email_confirmed_at is not null;

  if current_email is null then
    raise exception 'A verified email address is required' using errcode = '42501';
  end if;

  update public.teacher_invitations i
  set redeemed_by = auth.uid(),
      redeemed_at = now()
  where i.token_hash = encode(
      extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'),
      'hex'
    )
    and i.invited_email = current_email
    and i.redeemed_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  returning i.id into invitation_id;

  if invitation_id is null then
    raise exception 'Invitation is invalid, expired, revoked, or does not match this account'
      using errcode = '22023';
  end if;

  update public.profiles
  set role = 'teacher', updated_at = now()
  where id = auth.uid()
    and role = 'student';

  if not found then
    raise exception 'Only student accounts can redeem a teacher invitation'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.set_user_role(
  p_target_user_id uuid,
  p_target_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_target_role is distinct from 'student' then
    raise exception 'Teacher access must be granted through an invitation'
      using errcode = '22023';
  end if;

  update public.profiles
  set role = 'student', updated_at = now()
  where id = p_target_user_id
    and role <> 'admin';

  if not found then
    raise exception 'Profile not found or protected administrator account'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.revoke_teacher_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_current_user_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  update public.teacher_invitations
  set revoked_at = now()
  where id = p_invitation_id
    and redeemed_at is null
    and revoked_at is null;

  if not found then
    raise exception 'Invitation not found or already used/revoked' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_profile_updated_at();

alter table public.profiles enable row level security;
alter table public.teacher_invitations enable row level security;

drop policy if exists "Users read their own profile; admins read all" on public.profiles;
create policy "Users read their own profile; admins read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_current_user_admin());

drop policy if exists "Users update their own public profile" on public.profiles;
create policy "Users update their own public profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Admins read teacher invitations" on public.teacher_invitations;
create policy "Admins read teacher invitations"
  on public.teacher_invitations for select to authenticated
  using (public.is_current_user_admin());

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, school, grade, exam_track, target_score)
  on public.profiles to authenticated;
revoke all on public.teacher_invitations from anon, authenticated;
grant select on public.teacher_invitations to authenticated;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
revoke all on function public.create_teacher_invitation(text) from public, anon;
grant execute on function public.create_teacher_invitation(text) to authenticated;
revoke all on function public.redeem_teacher_invitation(text) from public, anon;
grant execute on function public.redeem_teacher_invitation(text) to authenticated;
revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
revoke all on function public.revoke_teacher_invitation(uuid) from public, anon;
grant execute on function public.revoke_teacher_invitation(uuid) to authenticated;
