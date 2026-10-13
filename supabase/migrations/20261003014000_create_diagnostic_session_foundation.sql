begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.diagnostic_question_ids_are_unique(p_question_ids text[])
returns boolean
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select cardinality(p_question_ids) > 0
    and array_position(p_question_ids, null) is null
    and cardinality(p_question_ids) = (
      select count(distinct question_id)::integer
      from unnest(p_question_ids) as ids(question_id)
    );
$$;

create or replace function private.diagnostic_presentation_snapshot_is_safe(
  p_snapshot jsonb
)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_question jsonb;
  v_option jsonb;
  v_statement jsonb;
  v_code jsonb;
begin
  if pg_catalog.jsonb_typeof(p_snapshot) <> 'array' then
    return false;
  end if;

  for v_question in
    select item.value
    from pg_catalog.jsonb_array_elements(p_snapshot) as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_question) <> 'object'
      or v_question - array[
        'id', 'stem', 'questionType', 'singleChoiceOptions',
        'trueFalseStatements', 'codeSnippet', 'diagramDesc'
      ]::text[] <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(v_question -> 'id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_question -> 'stem') is distinct from 'string'
    then
      return false;
    end if;

    if v_question ? 'codeSnippet' then
      v_code := v_question -> 'codeSnippet';
      if pg_catalog.jsonb_typeof(v_code) <> 'object'
        or v_code - array['language', 'code']::text[] <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(v_code -> 'language') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_code -> 'code') is distinct from 'string'
      then
        return false;
      end if;
    end if;

    if v_question ? 'diagramDesc'
      and pg_catalog.jsonb_typeof(v_question -> 'diagramDesc') is distinct from 'string'
    then
      return false;
    end if;

    if v_question ->> 'questionType' = 'single_choice' then
      if pg_catalog.jsonb_typeof(v_question -> 'singleChoiceOptions') is distinct from 'array'
        or v_question ? 'trueFalseStatements'
      then
        return false;
      end if;
      if pg_catalog.jsonb_array_length(v_question -> 'singleChoiceOptions') = 0 then
        return false;
      end if;

      for v_option in
        select item.value
        from pg_catalog.jsonb_array_elements(v_question -> 'singleChoiceOptions')
          as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_option) <> 'object'
          or v_option - array['optionId', 'label', 'text']::text[] <> '{}'::jsonb
          or pg_catalog.jsonb_typeof(v_option -> 'optionId') is distinct from 'string'
          or pg_catalog.jsonb_typeof(v_option -> 'label') is distinct from 'string'
          or pg_catalog.jsonb_typeof(v_option -> 'text') is distinct from 'string'
        then
          return false;
        end if;
      end loop;
    elsif v_question ->> 'questionType' = 'true_false_multistatement' then
      if pg_catalog.jsonb_typeof(v_question -> 'trueFalseStatements') is distinct from 'array'
        or v_question ? 'singleChoiceOptions'
      then
        return false;
      end if;
      if pg_catalog.jsonb_array_length(v_question -> 'trueFalseStatements') <> 4 then
        return false;
      end if;

      for v_statement in
        select item.value
        from pg_catalog.jsonb_array_elements(v_question -> 'trueFalseStatements')
          as item(value)
      loop
        if pg_catalog.jsonb_typeof(v_statement) <> 'object'
          or v_statement - array['subOrder', 'statementText']::text[] <> '{}'::jsonb
          or pg_catalog.jsonb_typeof(v_statement -> 'subOrder') is distinct from 'string'
          or pg_catalog.jsonb_typeof(v_statement -> 'statementText') is distinct from 'string'
        then
          return false;
        end if;
      end loop;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.diagnostic_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  grade_snapshot smallint not null check (grade_snapshot between 10 and 12),
  eligible_grades smallint[] not null,
  question_ids text[] not null,
  presentation_snapshot jsonb not null,
  question_bank_version text not null check (char_length(btrim(question_bank_version)) > 0),
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'incomplete')),
  idempotency_key uuid not null,
  submitted_at timestamptz,
  finalized_at timestamptz,
  constraint diagnostic_sessions_grade_scope_check check (
    eligible_grades = case grade_snapshot
      when 10 then array[10]::smallint[]
      when 11 then array[10, 11]::smallint[]
      when 12 then array[10, 11, 12]::smallint[]
    end
  ),
  constraint diagnostic_sessions_question_ids_check check (
    private.diagnostic_question_ids_are_unique(question_ids)
  ),
  constraint diagnostic_sessions_presentation_array_check check (
    case
      when jsonb_typeof(presentation_snapshot) = 'array'
        then jsonb_array_length(presentation_snapshot) = cardinality(question_ids)
          and private.diagnostic_presentation_snapshot_is_safe(presentation_snapshot)
      else false
    end
  ),
  constraint diagnostic_sessions_deadline_check check (deadline_at > started_at),
  constraint diagnostic_sessions_timestamps_check check (
    (status = 'in_progress' and submitted_at is null and finalized_at is null)
    or (status = 'completed' and submitted_at is not null and finalized_at is not null)
    or (
      status = 'incomplete'
      and finalized_at is not null
      and finalized_at >= deadline_at
    )
  ),
  constraint diagnostic_sessions_submission_time_check check (
    submitted_at is null or submitted_at >= started_at
  ),
  constraint diagnostic_sessions_finalization_time_check check (
    finalized_at is null
    or finalized_at >= started_at
      and (submitted_at is null or finalized_at >= submitted_at)
  ),
  constraint diagnostic_sessions_user_idempotency_unique
    unique (user_id, idempotency_key)
);

create index diagnostic_sessions_user_started
  on public.diagnostic_sessions (user_id, started_at desc);

create unique index diagnostic_sessions_one_active_per_user
  on public.diagnostic_sessions (user_id)
  where status = 'in_progress';

create table private.diagnostic_session_scoring (
  session_id uuid primary key
    references public.diagnostic_sessions(id) on delete cascade,
  scoring_snapshot jsonb not null,
  question_bank_version text not null
    check (char_length(btrim(question_bank_version)) > 0),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint diagnostic_session_scoring_array_check
    check (jsonb_typeof(scoring_snapshot) = 'array')
);

create table private.diagnostic_session_answers (
  session_id uuid not null
    references public.diagnostic_sessions(id) on delete cascade,
  question_id text not null,
  answer_selection jsonb,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (session_id, question_id)
);

alter table public.diagnostic_sessions owner to postgres;
alter table private.diagnostic_session_scoring owner to postgres;
alter table private.diagnostic_session_answers owner to postgres;

alter table public.diagnostic_sessions enable row level security;
alter table private.diagnostic_session_scoring enable row level security;
alter table private.diagnostic_session_answers enable row level security;

revoke all on public.diagnostic_sessions from public, anon, authenticated;
grant select (
  id,
  grade_snapshot,
  eligible_grades,
  question_ids,
  presentation_snapshot,
  question_bank_version,
  started_at,
  deadline_at,
  status,
  submitted_at,
  finalized_at
) on public.diagnostic_sessions to authenticated;
revoke all on private.diagnostic_session_scoring from public, anon, authenticated, service_role;
revoke all on private.diagnostic_session_answers from public, anon, authenticated, service_role;

drop policy if exists diagnostic_sessions_read_owner
  on public.diagnostic_sessions;
create policy diagnostic_sessions_read_owner
  on public.diagnostic_sessions for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.guard_diagnostic_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.user_id,
    new.grade_snapshot,
    new.eligible_grades,
    new.question_ids,
    new.presentation_snapshot,
    new.question_bank_version,
    new.started_at,
    new.deadline_at,
    new.idempotency_key
  ) is distinct from row(
    old.id,
    old.user_id,
    old.grade_snapshot,
    old.eligible_grades,
    old.question_ids,
    old.presentation_snapshot,
    old.question_bank_version,
    old.started_at,
    old.deadline_at,
    old.idempotency_key
  ) then
    raise exception 'Diagnostic session snapshots are immutable'
      using errcode = '42501';
  end if;

  if old.status <> new.status then
    if old.status <> 'in_progress'
      or new.status not in ('completed', 'incomplete')
      or pg_catalog.clock_timestamp() < old.deadline_at and new.status = 'incomplete'
      or new.status = 'completed'
        and (new.submitted_at is null or new.submitted_at > old.deadline_at)
    then
      raise exception 'Invalid diagnostic session state transition'
        using errcode = '22023';
    end if;
  elsif old.status <> 'in_progress'
    and row(new.submitted_at, new.finalized_at)
      is distinct from row(old.submitted_at, old.finalized_at)
  then
    raise exception 'Finalized diagnostic sessions are immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_diagnostic_scoring_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Diagnostic scoring snapshots are immutable'
    using errcode = '42501';
end;
$$;

create or replace function private.guard_diagnostic_answer_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if row(new.session_id, new.question_id)
    is distinct from row(old.session_id, old.question_id)
  then
    raise exception 'Diagnostic answer ownership is immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger diagnostic_sessions_immutable
  before update on public.diagnostic_sessions
  for each row execute function private.guard_diagnostic_session_update();

create trigger diagnostic_session_scoring_immutable
  before update on private.diagnostic_session_scoring
  for each row execute function private.prevent_diagnostic_scoring_mutation();

create trigger diagnostic_session_answers_immutable_owner
  before update on private.diagnostic_session_answers
  for each row execute function private.guard_diagnostic_answer_update();

create or replace function public.create_diagnostic_session(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_question_ids text[],
  p_presentation_snapshot jsonb,
  p_question_bank_version text,
  p_scoring_snapshot jsonb
)
returns setof public.diagnostic_sessions
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_existing public.diagnostic_sessions%rowtype;
  v_session public.diagnostic_sessions%rowtype;
  v_grade smallint;
  v_eligible_grades smallint[];
  v_presentation_ids text[];
  v_scoring_ids text[];
  v_started_at timestamptz;
begin
  if p_user_id is null or p_idempotency_key is null then
    raise exception 'Authenticated user and idempotency key are required'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tinmaster-diagnostic:' || p_user_id::text, 0)
  );

  update public.diagnostic_sessions s
  set status = 'incomplete',
      finalized_at = pg_catalog.clock_timestamp()
  where s.user_id = p_user_id
    and s.status = 'in_progress'
    and s.deadline_at <= pg_catalog.clock_timestamp();
  select s.*
  into v_existing
  from public.diagnostic_sessions s
  where s.user_id = p_user_id
    and s.idempotency_key = p_idempotency_key;
  if found then
    return next v_existing;
    return;
  end if;

  if exists (
    select 1
    from public.diagnostic_sessions s
    where s.user_id = p_user_id
      and s.status = 'in_progress'
  ) then
    raise exception 'An active diagnostic session already exists'
      using errcode = '55000';
  end if;

  select p.grade
  into v_grade
  from public.profiles p
  where p.id = p_user_id
    and p.role = 'student';
  if not found or v_grade is null or v_grade not between 10 and 12 then
    raise exception 'A student profile with a valid grade is required'
      using errcode = '22023';
  end if;

  v_eligible_grades := case v_grade
    when 10 then array[10]::smallint[]
    when 11 then array[10, 11]::smallint[]
    when 12 then array[10, 11, 12]::smallint[]
  end;

  if p_question_ids is null
    or p_presentation_snapshot is null
    or p_scoring_snapshot is null
    or p_question_bank_version is null
    or pg_catalog.btrim(p_question_bank_version) = ''
    or not private.diagnostic_question_ids_are_unique(p_question_ids)
    or pg_catalog.jsonb_typeof(p_presentation_snapshot) <> 'array'
    or pg_catalog.jsonb_typeof(p_scoring_snapshot) <> 'array'
    or not private.diagnostic_presentation_snapshot_is_safe(p_presentation_snapshot)
  then
    raise exception 'Invalid diagnostic question snapshot'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_presentation_snapshot)
      <> pg_catalog.cardinality(p_question_ids)
    or pg_catalog.jsonb_array_length(p_scoring_snapshot)
      <> pg_catalog.cardinality(p_question_ids)
  then
    raise exception 'Question snapshot length does not match question IDs'
      using errcode = '22023';
  end if;

  select pg_catalog.array_agg(item.value ->> 'id' order by item.ordinality)
  into v_presentation_ids
  from pg_catalog.jsonb_array_elements(p_presentation_snapshot)
    with ordinality as item(value, ordinality);

  select pg_catalog.array_agg(item.value ->> 'questionId' order by item.ordinality)
  into v_scoring_ids
  from pg_catalog.jsonb_array_elements(p_scoring_snapshot)
    with ordinality as item(value, ordinality);

  if v_presentation_ids is distinct from p_question_ids
    or v_scoring_ids is distinct from p_question_ids
    or pg_catalog.array_position(v_presentation_ids, null) is not null
    or pg_catalog.array_position(v_scoring_ids, null) is not null
  then
    raise exception 'Question, presentation, and scoring snapshots do not match'
      using errcode = '22023';
  end if;

  v_started_at := pg_catalog.clock_timestamp();
  insert into public.diagnostic_sessions (
    user_id,
    grade_snapshot,
    eligible_grades,
    question_ids,
    presentation_snapshot,
    question_bank_version,
    started_at,
    deadline_at,
    idempotency_key
  )
  values (
    p_user_id,
    v_grade,
    v_eligible_grades,
    p_question_ids,
    p_presentation_snapshot,
    p_question_bank_version,
    v_started_at,
    v_started_at + interval '25 minutes',
    p_idempotency_key
  )
  returning * into v_session;

  insert into private.diagnostic_session_scoring (
    session_id,
    scoring_snapshot,
    question_bank_version
  )
  values (
    v_session.id,
    p_scoring_snapshot,
    p_question_bank_version
  );

  return next v_session;
end;
$$;

create or replace function public.save_diagnostic_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_question_id text,
  p_answer_selection jsonb,
  p_expected_revision bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_session public.diagnostic_sessions%rowtype;
  v_question jsonb;
  v_answers jsonb;
  v_current_revision bigint;
  v_new_revision bigint;
begin
  if p_user_id is null
    or p_session_id is null
    or p_question_id is null
    or p_expected_revision is null
    or p_expected_revision < 0
  then
    raise exception 'Authenticated user, session, question, and valid expected revision are required'
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

  if v_session.status <> 'in_progress'
    or v_session.deadline_at <= pg_catalog.clock_timestamp()
  then
    raise exception 'Diagnostic session is not accepting answers'
      using errcode = '55000';
  end if;

  if not (p_question_id = any(v_session.question_ids)) then
    raise exception 'Question is not part of this diagnostic session'
      using errcode = '22023';
  end if;

  select item.value
  into v_question
  from pg_catalog.jsonb_array_elements(v_session.presentation_snapshot)
    as item(value)
  where item.value ->> 'id' = p_question_id;
  if not found then
    raise exception 'Question presentation is unavailable'
      using errcode = '22023';
  end if;

  if p_answer_selection is not null then
    if pg_catalog.jsonb_typeof(p_answer_selection) <> 'object' then
      raise exception 'Invalid diagnostic answer selection'
        using errcode = '22023';
    end if;

    if pg_catalog.octet_length(p_answer_selection::text) > 2048 then
      raise exception 'Diagnostic answer selection is too large'
        using errcode = '22023';
    end if;

    if v_question ->> 'questionType' = 'single_choice' then
      if p_answer_selection - 'optionId' <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(p_answer_selection -> 'optionId')
          is distinct from 'string'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(v_question -> 'singleChoiceOptions')
            as option_item(value)
          where option_item.value ->> 'optionId'
            = p_answer_selection ->> 'optionId'
        )
      then
        raise exception 'Invalid single-choice answer selection'
          using errcode = '22023';
      end if;
    elsif v_question ->> 'questionType' = 'true_false_multistatement' then
      v_answers := p_answer_selection -> 'answers';
      if p_answer_selection - 'answers' <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(v_answers) is distinct from 'object'
      then
        raise exception 'Invalid true/false answer selection'
          using errcode = '22023';
      end if;

      if v_answers - array['a', 'b', 'c', 'd']::text[] <> '{}'::jsonb
        or pg_catalog.jsonb_typeof(v_answers -> 'a') is distinct from 'boolean'
        or pg_catalog.jsonb_typeof(v_answers -> 'b') is distinct from 'boolean'
        or pg_catalog.jsonb_typeof(v_answers -> 'c') is distinct from 'boolean'
        or pg_catalog.jsonb_typeof(v_answers -> 'd') is distinct from 'boolean'
      then
        raise exception 'Invalid true/false answer selection'
          using errcode = '22023';
      end if;
    else
      raise exception 'Unsupported diagnostic question type'
        using errcode = '22023';
    end if;
  end if;

  select a.revision
  into v_current_revision
  from private.diagnostic_session_answers a
  where a.session_id = p_session_id
    and a.question_id = p_question_id;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'Diagnostic answer revision conflict'
        using errcode = '40001';
    end if;
    insert into private.diagnostic_session_answers (
      session_id,
      question_id,
      answer_selection,
      revision,
      updated_at
    )
    values (
      p_session_id,
      p_question_id,
      p_answer_selection,
      1,
      pg_catalog.clock_timestamp()
    )
    returning revision into v_new_revision;
    return v_new_revision;
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception 'Diagnostic answer revision conflict'
      using errcode = '40001';
  end if;

  update private.diagnostic_session_answers a
  set answer_selection = p_answer_selection,
      revision = a.revision + 1,
      updated_at = pg_catalog.clock_timestamp()
  where a.session_id = p_session_id
    and a.question_id = p_question_id
    and a.revision = p_expected_revision
  returning a.revision into v_new_revision;

  if not found then
    raise exception 'Diagnostic answer revision conflict'
      using errcode = '40001';
  end if;
  return v_new_revision;
end;
$$;

create or replace function public.get_diagnostic_session_state(
  p_user_id uuid,
  p_session_id uuid
)
returns table (
  session_id uuid,
  grade_snapshot smallint,
  eligible_grades smallint[],
  question_ids text[],
  presentation_snapshot jsonb,
  question_bank_version text,
  started_at timestamptz,
  deadline_at timestamptz,
  status text,
  submitted_at timestamptz,
  finalized_at timestamptz,
  answer_selections jsonb
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_session public.diagnostic_sessions%rowtype;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'Authenticated user and session are required'
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

  if v_session.status = 'in_progress'
    and v_session.deadline_at <= pg_catalog.clock_timestamp()
  then
    update public.diagnostic_sessions s
    set status = 'incomplete',
        finalized_at = pg_catalog.clock_timestamp()
    where s.id = p_session_id
    returning s.* into v_session;
  end if;

  return query
  select
    v_session.id,
    v_session.grade_snapshot,
    v_session.eligible_grades,
    v_session.question_ids,
    v_session.presentation_snapshot,
    v_session.question_bank_version,
    v_session.started_at,
    v_session.deadline_at,
    v_session.status,
    v_session.submitted_at,
    v_session.finalized_at,
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(
          a.question_id,
          pg_catalog.jsonb_build_object(
            'revision', a.revision,
            'answerSelection', a.answer_selection
          )
        )
        from private.diagnostic_session_answers a
        where a.session_id = p_session_id
      ),
      '{}'::jsonb
    );
end;
$$;

alter function private.diagnostic_question_ids_are_unique(text[]) owner to postgres;
alter function private.diagnostic_presentation_snapshot_is_safe(jsonb) owner to postgres;
alter function private.guard_diagnostic_session_update() owner to postgres;
alter function private.prevent_diagnostic_scoring_mutation() owner to postgres;
alter function private.guard_diagnostic_answer_update() owner to postgres;
alter function public.create_diagnostic_session(uuid, uuid, text[], jsonb, text, jsonb)
  owner to postgres;
alter function public.save_diagnostic_answer(uuid, uuid, text, jsonb, bigint)
  owner to postgres;
alter function public.get_diagnostic_session_state(uuid, uuid)
  owner to postgres;

revoke all on function private.diagnostic_question_ids_are_unique(text[])
  from public, anon, authenticated, service_role;
revoke all on function private.diagnostic_presentation_snapshot_is_safe(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.guard_diagnostic_session_update()
  from public, anon, authenticated, service_role;
revoke all on function private.prevent_diagnostic_scoring_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_diagnostic_answer_update()
  from public, anon, authenticated, service_role;
revoke all on function public.create_diagnostic_session(uuid, uuid, text[], jsonb, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.save_diagnostic_answer(uuid, uuid, text, jsonb, bigint)
  from public, anon, authenticated;
revoke all on function public.get_diagnostic_session_state(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_diagnostic_session(uuid, uuid, text[], jsonb, text, jsonb)
  to service_role;
grant execute on function public.save_diagnostic_answer(uuid, uuid, text, jsonb, bigint)
  to service_role;
grant execute on function public.get_diagnostic_session_state(uuid, uuid)
  to service_role;

comment on table public.diagnostic_sessions is
  'Diagnostic-only assessment snapshots. Student-readable only through owner RLS; writes are restricted to server RPCs.';
comment on table private.diagnostic_session_scoring is
  'Server-only scoring snapshots paired transactionally with diagnostic sessions.';
comment on table private.diagnostic_session_answers is
  'Server-only answer selections; contains no correctness or score fields.';
comment on function public.create_diagnostic_session(uuid, uuid, text[], jsonb, text, jsonb) is
  'Server-role-only atomic session creation. The caller must derive p_user_id from the verified authenticated request.';
comment on function public.save_diagnostic_answer(uuid, uuid, text, jsonb, bigint) is
  'Server-role-only compare-and-swap answer write. p_expected_revision is an untrusted precondition; the database verifies it and returns the next revision. The caller must derive p_user_id from verified authentication.';
comment on function public.get_diagnostic_session_state(uuid, uuid) is
  'Server-role-only owner-scoped session and saved-answer read. The caller must derive p_user_id from the verified authenticated request.';

commit;
