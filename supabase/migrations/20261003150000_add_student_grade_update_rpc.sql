begin;

create or replace function public.update_my_student_grade(p_grade smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_grade smallint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_grade is not null and (p_grade not between 10 and 12) then
    raise exception 'Grade must be 10, 11, or 12'
      using errcode = '22023';
  end if;

  perform public.consume_member_profile_update_limit();

  update public.profiles p
  set grade = p_grade,
      updated_at = pg_catalog.clock_timestamp()
  where p.id = auth.uid()
    and p.role = 'student'
  returning p.grade into v_grade;

  if not found then
    raise exception 'Student profile not found'
      using errcode = '42501';
  end if;

  return v_grade;
end;
$$;

alter function public.update_my_student_grade(smallint) owner to postgres;
revoke all on function public.update_my_student_grade(smallint) from public, anon;
grant execute on function public.update_my_student_grade(smallint) to authenticated;

commit;
