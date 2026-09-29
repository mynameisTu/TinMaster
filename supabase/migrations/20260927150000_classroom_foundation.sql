begin;

create table public.classrooms (
  id uuid primary key default extensions.gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  grade smallint check (grade between 10 and 12),
  archived_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index classrooms_teacher_created
  on public.classrooms (teacher_id, created_at desc);

create table public.classroom_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default pg_catalog.now(),
  left_at timestamptz
);

create unique index classroom_memberships_one_active
  on public.classroom_memberships (classroom_id, student_id)
  where left_at is null;

create index classroom_memberships_student_history
  on public.classroom_memberships (student_id, classroom_id, joined_at desc);

create table public.classroom_invitation_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  max_uses integer not null default 100 check (max_uses between 1 and 500),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (expires_at > created_at)
);

create index classroom_invitation_codes_classroom_created
  on public.classroom_invitation_codes (classroom_id, created_at desc);

comment on table public.classrooms is
  'Classroom records are archived, never hard-deleted. Account deletion is restricted while classroom history references the profile; reviewed anonymization is a separate future workflow.';
comment on table public.classroom_memberships is
  'Membership history is append-and-close: leave/removal sets left_at; rejoining creates another row.';
comment on table public.classroom_invitation_codes is
  'Only SHA-256 hashes of high-entropy invitation codes are stored; plaintext is returned once by creation RPCs.';

alter table public.classrooms owner to postgres;
alter table public.classroom_memberships owner to postgres;
alter table public.classroom_invitation_codes owner to postgres;

create or replace function public.is_current_user_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  );
$$;

create or replace function public.is_classroom_owner(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.classrooms c
    where c.id = p_classroom_id
      and c.teacher_id = auth.uid()
  );
$$;

create or replace function public.can_manage_classroom(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.is_current_user_teacher()
    and public.is_classroom_owner(p_classroom_id);
$$;

create or replace function public.is_active_classroom_student(p_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.profiles p
    join public.classroom_memberships m on m.student_id = p.id
    join public.classrooms c on c.id = m.classroom_id
    where p.id = auth.uid()
      and p.role = 'student'
      and m.classroom_id = p_classroom_id
      and m.left_at is null
      and c.archived_at is null
  );
$$;

create or replace function public.touch_classroom_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.guard_classroom_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is not null then
    raise exception 'Archived classrooms are immutable' using errcode = '55000';
  end if;

  if new.teacher_id is distinct from old.teacher_id then
    raise exception 'Classroom ownership cannot be changed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger classrooms_guard_update
before update on public.classrooms
for each row execute function public.guard_classroom_update();

create trigger classrooms_touch_updated_at
before update on public.classrooms
for each row execute function public.touch_classroom_updated_at();

create or replace function public.archive_classrooms_on_teacher_role_revocation()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if old.role = 'teacher' and new.role is distinct from 'teacher' then
    update public.classrooms c
    set archived_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    where c.teacher_id = new.id
      and c.archived_at is null;

    update public.classroom_invitation_codes i
    set revoked_at = pg_catalog.clock_timestamp()
    where i.revoked_at is null
      and exists (
        select 1
        from public.classrooms c
        where c.id = i.classroom_id
          and c.teacher_id = new.id
          and c.archived_at is not null
      );
  end if;

  return new;
end;
$$;

create trigger profiles_archive_classrooms_on_teacher_revocation
after update of role on public.profiles
for each row
when (old.role = 'teacher' and new.role is distinct from 'teacher')
execute function public.archive_classrooms_on_teacher_role_revocation();

alter table public.classrooms enable row level security;
alter table public.classroom_memberships enable row level security;
alter table public.classroom_invitation_codes enable row level security;

drop policy if exists classrooms_read_owner_or_active_student on public.classrooms;
create policy classrooms_read_owner_or_active_student
  on public.classrooms for select to authenticated
  using (
    public.is_classroom_owner(id)
    or (
      archived_at is null
      and public.is_active_classroom_student(id)
    )
  );

drop policy if exists classrooms_update_active_owner on public.classrooms;
create policy classrooms_update_active_owner
  on public.classrooms for update to authenticated
  using (
    archived_at is null
    and public.can_manage_classroom(id)
  )
  with check (
    archived_at is null
    and public.can_manage_classroom(id)
  );

drop policy if exists classroom_memberships_read_self_or_active_owner
  on public.classroom_memberships;
create policy classroom_memberships_read_self_or_active_owner
  on public.classroom_memberships for select to authenticated
  using (
    student_id = auth.uid()
    or public.can_manage_classroom(classroom_id)
  );

drop policy if exists classroom_invitation_codes_read_owner
  on public.classroom_invitation_codes;
create policy classroom_invitation_codes_read_owner
  on public.classroom_invitation_codes for select to authenticated
  using (public.is_classroom_owner(classroom_id));

revoke all on public.classrooms from public, anon, authenticated;
revoke all on public.classroom_memberships from public, anon, authenticated;
revoke all on public.classroom_invitation_codes from public, anon, authenticated;

grant select on public.classrooms to authenticated;
grant update (name, grade) on public.classrooms to authenticated;
grant select on public.classroom_memberships to authenticated;
grant select (
  id, classroom_id, created_by, expires_at, max_uses, use_count, revoked_at, created_at
) on public.classroom_invitation_codes to authenticated;

create or replace function public.create_classroom(
  p_name text,
  p_grade smallint
)
returns table (
  classroom_id uuid,
  invitation_code text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_role text;
  v_classroom_id uuid := extensions.gen_random_uuid();
  v_code text := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires_at timestamptz :=
    pg_catalog.statement_timestamp() + interval '7 days';
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'teacher' then
    raise exception 'Teacher access required' using errcode = '42501';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'A classroom name between 1 and 120 characters is required'
      using errcode = '22023';
  end if;

  if p_grade is not null and p_grade not between 10 and 12 then
    raise exception 'Grade must be between 10 and 12' using errcode = '22023';
  end if;

  insert into public.classrooms (id, teacher_id, name, grade)
  values (v_classroom_id, auth.uid(), v_name, p_grade);

  insert into public.classroom_invitation_codes (
    classroom_id, created_by, code_hash, expires_at
  )
  values (
    v_classroom_id,
    auth.uid(),
    encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'),
    v_expires_at
  );

  return query select v_classroom_id, v_code, v_expires_at;
end;
$$;

create or replace function public.create_classroom_invitation(
  p_classroom_id uuid,
  p_max_uses integer default 100
)
returns table (invitation_code text, invitation_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_role text;
  v_code text := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires_at timestamptz :=
    pg_catalog.statement_timestamp() + interval '7 days';
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'teacher' then
    raise exception 'Teacher access required' using errcode = '42501';
  end if;

  if p_max_uses is null or p_max_uses not between 1 and 500 then
    raise exception 'Maximum uses must be between 1 and 500'
      using errcode = '22023';
  end if;

  select c.teacher_id into v_owner_id
  from public.classrooms c
  where c.id = p_classroom_id
  for update;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.classrooms c
    where c.id = p_classroom_id and c.archived_at is not null
  ) then
    raise exception 'Archived classrooms cannot issue invitation codes'
      using errcode = '22023';
  end if;

  insert into public.classroom_invitation_codes (
    classroom_id, created_by, code_hash, expires_at, max_uses
  )
  values (
    p_classroom_id,
    auth.uid(),
    encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'),
    v_expires_at,
    p_max_uses
  );

  return query select v_code, v_expires_at;
end;
$$;

create or replace function public.join_classroom(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_code text := coalesce(p_code, '');
  v_code_hash text;
  v_user_role text;
  v_teacher_id uuid;
  v_classroom_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'student' then
    raise exception 'Student access required' using errcode = '42501';
  end if;

  if v_code !~ '^[0-9a-f]{48}$' then
    raise exception 'Invitation code is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  v_code_hash := encode(extensions.digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex');

  select c.teacher_id, c.id
  into v_teacher_id, v_classroom_id
  from public.classroom_invitation_codes i
  join public.classrooms c on c.id = i.classroom_id
  where i.code_hash = v_code_hash;

  if v_classroom_id is null then
    raise exception 'Invitation code is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = v_teacher_id
  for share;

  if v_user_role is distinct from 'teacher' then
    raise exception 'Invitation code is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  perform 1
  from public.classrooms c
  where c.id = v_classroom_id
    and c.teacher_id = v_teacher_id
  for update;

  if not found then
    raise exception 'Invitation code is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  -- Validate the invitation before membership checks so expired/revoked/exhausted
  -- codes still surface as invitation failures even for current members.
  if not exists (
    select 1
    from public.classroom_invitation_codes i
    where i.code_hash = v_code_hash
      and i.classroom_id = v_classroom_id
      and i.revoked_at is null
      and i.expires_at > pg_catalog.clock_timestamp()
      and i.use_count < i.max_uses
      and exists (
        select 1
        from public.classrooms c
        join public.profiles t on t.id = c.teacher_id
        where c.id = i.classroom_id
          and c.archived_at is null
          and t.role = 'teacher'
      )
  ) then
    raise exception 'Invitation code is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  -- Reject before consuming an invitation use so duplicate joins cannot
  -- burn limited codes when an active membership already exists.
  if exists (
    select 1
    from public.classroom_memberships m
    where m.classroom_id = v_classroom_id
      and m.student_id = auth.uid()
      and m.left_at is null
  ) then
    raise exception 'Active classroom membership already exists'
      using errcode = '23505';
  end if;

  update public.classroom_invitation_codes i
  set use_count = i.use_count + 1
  where i.code_hash = v_code_hash
    and i.classroom_id = v_classroom_id
    and i.revoked_at is null
    and i.expires_at > pg_catalog.clock_timestamp()
    and i.use_count < i.max_uses
    and exists (
      select 1
      from public.classrooms c
      join public.profiles t on t.id = c.teacher_id
      where c.id = i.classroom_id
        and c.archived_at is null
        and t.role = 'teacher'
    )
  returning i.classroom_id into v_classroom_id;

  if v_classroom_id is null then
    raise exception 'Invitation code is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  insert into public.classroom_memberships (
    classroom_id, student_id, joined_at
  )
  values (v_classroom_id, auth.uid(), pg_catalog.clock_timestamp());

  return v_classroom_id;
end;
$$;

create or replace function public.leave_classroom(p_classroom_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.classrooms c
  where c.id = p_classroom_id
    and c.archived_at is null
  for update;

  if not found then
    raise exception 'Active classroom membership not found'
      using errcode = '22023';
  end if;

  update public.classroom_memberships m
  set left_at = pg_catalog.clock_timestamp()
  where m.classroom_id = p_classroom_id
    and m.student_id = auth.uid()
    and m.left_at is null;

  if not found then
    raise exception 'Active classroom membership not found'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.remove_classroom_student(
  p_classroom_id uuid,
  p_student_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_role text;
  v_owner_id uuid;
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'teacher' then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  select c.teacher_id, c.archived_at
  into v_owner_id, v_archived_at
  from public.classrooms c
  where c.id = p_classroom_id
  for update;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  if v_archived_at is not null then
    raise exception 'Archived classrooms are immutable' using errcode = '55000';
  end if;

  update public.classroom_memberships m
  set left_at = pg_catalog.clock_timestamp()
  where m.classroom_id = p_classroom_id
    and m.student_id = p_student_id
    and m.left_at is null;

  if not found then
    raise exception 'Active classroom membership not found'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.archive_classroom(p_classroom_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_role text;
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'teacher' then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  select c.teacher_id into v_owner_id
  from public.classrooms c
  where c.id = p_classroom_id
  for update;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  update public.classrooms c
  set archived_at = pg_catalog.clock_timestamp(),
      updated_at = pg_catalog.clock_timestamp()
  where c.id = p_classroom_id
    and c.archived_at is null;

  if not found then
    raise exception 'Classroom not found or already archived'
      using errcode = '22023';
  end if;

  update public.classroom_invitation_codes i
  set revoked_at = pg_catalog.clock_timestamp()
  where i.classroom_id = p_classroom_id
    and i.revoked_at is null;
end;
$$;

create or replace function public.revoke_classroom_invitation(
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_role text;
  v_classroom_id uuid;
  v_owner_id uuid;
  v_archived_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'teacher' then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  select i.classroom_id into v_classroom_id
  from public.classroom_invitation_codes i
  where i.id = p_invitation_id;

  if v_classroom_id is null then
    raise exception 'Invitation not found, inaccessible, or already revoked'
      using errcode = '22023';
  end if;

  select c.teacher_id, c.archived_at
  into v_owner_id, v_archived_at
  from public.classrooms c
  where c.id = v_classroom_id
  for update;

  if v_owner_id is distinct from auth.uid() then
    raise exception 'Invitation not found, inaccessible, or already revoked'
      using errcode = '22023';
  end if;

  if v_archived_at is not null then
    raise exception 'Archived classrooms are immutable' using errcode = '55000';
  end if;

  update public.classroom_invitation_codes i
  set revoked_at = pg_catalog.clock_timestamp()
  where i.id = p_invitation_id
    and i.revoked_at is null;

  if not found then
    raise exception 'Invitation not found, inaccessible, or already revoked'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.get_classroom_students(
  p_classroom_id uuid
)
returns table (
  student_id uuid,
  display_name text,
  joined_at timestamptz,
  left_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.role into v_user_role
  from public.profiles p
  where p.id = auth.uid()
  for share;

  if v_user_role is distinct from 'teacher'
    or not public.is_classroom_owner(p_classroom_id) then
    raise exception 'Classroom access required' using errcode = '42501';
  end if;

  return query
  select m.student_id, p.display_name, m.joined_at, m.left_at
  from public.classroom_memberships m
  join public.profiles p on p.id = m.student_id
  where m.classroom_id = p_classroom_id
  order by m.joined_at, m.student_id;
end;
$$;

alter function public.is_current_user_teacher() owner to postgres;
alter function public.is_classroom_owner(uuid) owner to postgres;
alter function public.can_manage_classroom(uuid) owner to postgres;
alter function public.is_active_classroom_student(uuid) owner to postgres;
alter function public.touch_classroom_updated_at() owner to postgres;
alter function public.guard_classroom_update() owner to postgres;
alter function public.archive_classrooms_on_teacher_role_revocation() owner to postgres;
alter function public.create_classroom(text, smallint) owner to postgres;
alter function public.create_classroom_invitation(uuid, integer) owner to postgres;
alter function public.join_classroom(text) owner to postgres;
alter function public.leave_classroom(uuid) owner to postgres;
alter function public.remove_classroom_student(uuid, uuid) owner to postgres;
alter function public.archive_classroom(uuid) owner to postgres;
alter function public.revoke_classroom_invitation(uuid) owner to postgres;
alter function public.get_classroom_students(uuid) owner to postgres;

revoke all on function public.is_current_user_teacher() from public, anon;
revoke all on function public.is_classroom_owner(uuid) from public, anon;
revoke all on function public.can_manage_classroom(uuid) from public, anon;
revoke all on function public.is_active_classroom_student(uuid) from public, anon;
revoke all on function public.touch_classroom_updated_at() from public, anon, authenticated;
revoke all on function public.guard_classroom_update() from public, anon, authenticated;
revoke all on function public.archive_classrooms_on_teacher_role_revocation()
  from public, anon, authenticated;
revoke all on function public.create_classroom(text, smallint) from public, anon;
revoke all on function public.create_classroom_invitation(uuid, integer) from public, anon;
revoke all on function public.join_classroom(text) from public, anon;
revoke all on function public.leave_classroom(uuid) from public, anon;
revoke all on function public.remove_classroom_student(uuid, uuid) from public, anon;
revoke all on function public.archive_classroom(uuid) from public, anon;
revoke all on function public.revoke_classroom_invitation(uuid) from public, anon;
revoke all on function public.get_classroom_students(uuid) from public, anon;

grant execute on function public.is_current_user_teacher() to authenticated;
grant execute on function public.is_classroom_owner(uuid) to authenticated;
grant execute on function public.can_manage_classroom(uuid) to authenticated;
grant execute on function public.is_active_classroom_student(uuid) to authenticated;
grant execute on function public.create_classroom(text, smallint) to authenticated;
grant execute on function public.create_classroom_invitation(uuid, integer) to authenticated;
grant execute on function public.join_classroom(text) to authenticated;
grant execute on function public.leave_classroom(uuid) to authenticated;
grant execute on function public.remove_classroom_student(uuid, uuid) to authenticated;
grant execute on function public.archive_classroom(uuid) to authenticated;
grant execute on function public.revoke_classroom_invitation(uuid) to authenticated;
grant execute on function public.get_classroom_students(uuid) to authenticated;

commit;
