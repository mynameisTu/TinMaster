begin;

create table private.diagnostic_session_results (
  session_id uuid primary key
    references public.diagnostic_sessions(id) on delete cascade,
  score numeric(7, 2) not null check (score >= 0),
  maximum_score numeric(7, 2) not null check (maximum_score > 0),
  answered_questions integer not null check (answered_questions >= 0),
  fully_correct_questions integer not null check (fully_correct_questions >= 0),
  total_questions integer not null check (total_questions > 0),
  submitted_at timestamptz not null,
  constraint diagnostic_session_results_counts_check check (
    fully_correct_questions <= answered_questions
      and answered_questions <= total_questions
  ),
  constraint diagnostic_session_results_score_within_maximum_check
    check (score <= maximum_score)
);

alter table private.diagnostic_session_results owner to postgres;
alter table private.diagnostic_session_results enable row level security;

revoke all on private.diagnostic_session_results from public, anon, authenticated, service_role;

create or replace function private.prevent_diagnostic_result_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Diagnostic results are immutable'
    using errcode = '42501';
end;
$$;

create trigger diagnostic_session_results_immutable
  before update on private.diagnostic_session_results
  for each row execute function private.prevent_diagnostic_result_mutation();

create or replace function public.submit_diagnostic_session(
  p_user_id uuid,
  p_session_id uuid
)
returns table (
  session_status text,
  score numeric,
  maximum_score numeric,
  answered_questions integer,
  fully_correct_questions integer,
  total_questions integer,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_session public.diagnostic_sessions%rowtype;
  v_result private.diagnostic_session_results%rowtype;
  v_now timestamptz;
  v_scoring_item jsonb;
  v_answer jsonb;
  v_correct_answers jsonb;
  v_statement text;
  v_matching_count integer;
  v_score numeric(7, 2) := 0;
  v_maximum_score numeric(7, 2) := 0;
  v_answered_questions integer := 0;
  v_fully_correct_questions integer := 0;
  v_total_questions integer := 0;
  v_question_score numeric(7, 2);
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'Authenticated user and diagnostic session are required'
      using errcode = '22023';
  end if;

  select s.*
  into v_session
  from public.diagnostic_sessions s
  where s.id = p_session_id
    and s.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Diagnostic session not found'
      using errcode = 'P0002';
  end if;

  if v_session.status = 'completed' then
    select r.*
    into v_result
    from private.diagnostic_session_results r
    where r.session_id = p_session_id;
    if not found then
      raise exception 'Completed diagnostic session has no persisted result'
        using errcode = '55000';
    end if;
    return query
    select
      v_session.status,
      v_result.score,
      v_result.maximum_score,
      v_result.answered_questions,
      v_result.fully_correct_questions,
      v_result.total_questions,
      v_result.submitted_at;
    return;
  end if;

  if v_session.status = 'incomplete' then
    return query select v_session.status, null::numeric, null::numeric,
      null::integer, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  v_now := pg_catalog.clock_timestamp();
  if v_session.deadline_at <= v_now then
    update public.diagnostic_sessions s
    set status = 'incomplete',
        finalized_at = v_now
    where s.id = p_session_id
    returning s.* into v_session;
    return query select v_session.status, null::numeric, null::numeric,
      null::integer, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  for v_scoring_item in
    select item.value
    from private.diagnostic_session_scoring scoring
    cross join lateral pg_catalog.jsonb_array_elements(scoring.scoring_snapshot)
      with ordinality as item(value, ordinality)
    where scoring.session_id = p_session_id
    order by item.ordinality
  loop
    v_total_questions := v_total_questions + 1;
    v_question_score := 0;
    select answer.answer_selection
    into v_answer
    from private.diagnostic_session_answers answer
    where answer.session_id = p_session_id
      and answer.question_id = v_scoring_item ->> 'questionId';

    if v_answer is not null then
      v_answered_questions := v_answered_questions + 1;
      if v_scoring_item ->> 'questionType' = 'single_choice' then
        v_maximum_score := v_maximum_score + 0.25;
        if v_answer ->> 'optionId' = v_scoring_item ->> 'correctOptionId' then
          v_question_score := 0.25;
          v_fully_correct_questions := v_fully_correct_questions + 1;
        end if;
      elsif v_scoring_item ->> 'questionType' = 'true_false_multistatement' then
        v_maximum_score := v_maximum_score + 1;
        v_correct_answers := v_scoring_item -> 'correctAnswers';
        v_matching_count := 0;
        foreach v_statement in array array['a', 'b', 'c', 'd']
        loop
          if (v_answer -> 'answers' ->> v_statement)::boolean
            = (v_correct_answers ->> v_statement)::boolean
          then
            v_matching_count := v_matching_count + 1;
          end if;
        end loop;
        v_question_score := case v_matching_count
          when 1 then 0.1
          when 2 then 0.25
          when 3 then 0.5
          when 4 then 1
          else 0
        end;
        if v_matching_count = 4 then
          v_fully_correct_questions := v_fully_correct_questions + 1;
        end if;
      else
        raise exception 'Unsupported diagnostic scoring question type'
          using errcode = '22023';
      end if;
    else
      if v_scoring_item ->> 'questionType' = 'single_choice' then
        v_maximum_score := v_maximum_score + 0.25;
      elsif v_scoring_item ->> 'questionType' = 'true_false_multistatement' then
        v_maximum_score := v_maximum_score + 1;
      else
        raise exception 'Unsupported diagnostic scoring question type'
          using errcode = '22023';
      end if;
    end if;
    v_score := v_score + v_question_score;
  end loop;

  if v_total_questions = 0 or v_total_questions <> pg_catalog.cardinality(v_session.question_ids) then
    raise exception 'Diagnostic scoring snapshot is incomplete'
      using errcode = '55000';
  end if;

  update public.diagnostic_sessions s
  set status = 'completed',
      submitted_at = v_now,
      finalized_at = v_now
  where s.id = p_session_id
  returning s.* into v_session;

  insert into private.diagnostic_session_results (
    session_id,
    score,
    maximum_score,
    answered_questions,
    fully_correct_questions,
    total_questions,
    submitted_at
  )
  values (
    p_session_id,
    v_score,
    v_maximum_score,
    v_answered_questions,
    v_fully_correct_questions,
    v_total_questions,
    v_now
  )
  returning * into v_result;

  return query
  select
    v_session.status,
    v_result.score,
    v_result.maximum_score,
    v_result.answered_questions,
    v_result.fully_correct_questions,
    v_result.total_questions,
    v_result.submitted_at;
end;
$$;

create or replace function public.get_diagnostic_session_result(
  p_user_id uuid,
  p_session_id uuid
)
returns table (
  score numeric,
  maximum_score numeric,
  answered_questions integer,
  fully_correct_questions integer,
  total_questions integer,
  submitted_at timestamptz
)
language sql
security definer
set search_path = ''
set row_security = off
as $$
  select
    result.score,
    result.maximum_score,
    result.answered_questions,
    result.fully_correct_questions,
    result.total_questions,
    result.submitted_at
  from private.diagnostic_session_results result
  join public.diagnostic_sessions session
    on session.id = result.session_id
  where session.id = p_session_id
    and session.user_id = p_user_id
    and session.status = 'completed';
$$;

alter function private.prevent_diagnostic_result_mutation() owner to postgres;
alter function public.submit_diagnostic_session(uuid, uuid) owner to postgres;
alter function public.get_diagnostic_session_result(uuid, uuid) owner to postgres;

revoke all on function private.prevent_diagnostic_result_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.submit_diagnostic_session(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_diagnostic_session_result(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.submit_diagnostic_session(uuid, uuid)
  to service_role;
grant execute on function public.get_diagnostic_session_result(uuid, uuid)
  to service_role;

comment on table private.diagnostic_session_results is
  'Immutable, server-calculated diagnostic results. Direct client access is denied.';
comment on function public.submit_diagnostic_session(uuid, uuid) is
  'Atomically scores saved answers against the private snapshot and finalizes an owned session; callable only by the server service role.';
comment on function public.get_diagnostic_session_result(uuid, uuid) is
  'Returns the persisted result only to the server for the verified session owner.';

commit;
