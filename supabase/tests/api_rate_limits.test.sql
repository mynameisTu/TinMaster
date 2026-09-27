begin;

select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'rate-user-one@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"One"}',
    now(), now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'rate-user-two@example.test', '',
    now(), '{"provider":"google","providers":["google"]}', '{"name":"Two"}',
    now(), now()
  );

update private.api_rate_limit_config
set limit_count = 2, window_seconds = 60
where endpoint = '/api/ai/explain';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

select is(
  (select allowed from public.consume_api_rate_limit('/api/ai/explain')),
  true,
  'first request is allowed'
);
select is(
  (select remaining from public.consume_api_rate_limit('/api/ai/explain')),
  0,
  'second request reaches configured limit'
);
select is(
  (select allowed from public.consume_api_rate_limit('/api/ai/explain')),
  false,
  'requests above the per-endpoint limit are denied'
);
select ok(
  (select retry_after_seconds >= 1 from public.consume_api_rate_limit('/api/ai/explain')),
  'denied decisions include a positive retry interval'
);
select is(
  (select allowed from public.consume_api_rate_limit('/api/ai/video-script')),
  true,
  'each endpoint has an independent counter'
);
select throws_ok(
  $$select * from public.consume_api_rate_limit('/api/not-configured')$$,
  '22023',
  'Unknown rate limit endpoint',
  'unconfigured endpoint keys are rejected'
);
select throws_ok(
  $$select limit_count from private.api_rate_limit_config$$,
  '42501',
  null,
  'authenticated users cannot inspect or modify private limiter configuration'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is(
  (select allowed from public.consume_api_rate_limit('/api/ai/explain')),
  true,
  'limits are isolated by verified Auth user'
);

select * from finish();
rollback;
