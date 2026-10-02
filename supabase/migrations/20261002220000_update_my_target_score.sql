begin;

create or replace function public.update_my_target_score(p_target_score numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_target_score numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_target_score is null
    or p_target_score < 1.0
    or p_target_score > 10.0
    or p_target_score * 2 <> pg_catalog.trunc(p_target_score * 2)
  then
    raise exception 'Target score must be between 1.0 and 10.0 in 0.5 increments'
      using errcode = '22023';
  end if;

  update public.profiles p
  set target_score = p_target_score
  where p.id = auth.uid()
  returning p.target_score into v_target_score;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_target_score;
end;
$$;

alter function public.update_my_target_score(numeric) owner to postgres;

revoke all on function public.update_my_target_score(numeric) from public, anon;
grant execute on function public.update_my_target_score(numeric) to authenticated;

commit;
