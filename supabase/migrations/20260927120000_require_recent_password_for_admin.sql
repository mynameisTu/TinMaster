create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with token_claims as (
    select auth.jwt() as claims
  )
  select exists (
    select 1
    from public.profiles p
    cross join token_claims c
    where p.id = auth.uid()
      and p.role = 'admin'
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(c.claims -> 'amr') = 'array' then c.claims -> 'amr'
            else '[]'::jsonb
          end
        ) as amr(value)
        where case
          when jsonb_typeof(amr.value) = 'string' then amr.value #>> '{}'
          else amr.value ->> 'method'
        end = 'password'
          and case
            when jsonb_typeof(amr.value) = 'object' then
              case
                when amr.value ->> 'timestamp' ~ '^[0-9]+([.][0-9]+)?$'
                  then (amr.value ->> 'timestamp')::numeric
                    between extract(epoch from now()) - 900
                    and extract(epoch from now()) + 60
                else false
              end
            when jsonb_typeof(amr.value) = 'string' then
              case
                when c.claims ->> 'auth_time' ~ '^[0-9]+$'
                  then (c.claims ->> 'auth_time')::numeric
                    between extract(epoch from now()) - 900
                    and extract(epoch from now()) + 60
                else false
              end
            else false
          end
      )
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;
