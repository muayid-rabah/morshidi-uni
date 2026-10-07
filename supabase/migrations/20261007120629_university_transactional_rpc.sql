-- Transactional mutation boundary for SupabaseUniversityRepository.
-- This migration is intentionally separate from the already-applied base schema.

begin;

create schema if not exists university_private;
revoke all on schema university_private from public, anon, authenticated, service_role;

create or replace function university_private.event_json(p_event public.events)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_event.id,
    'type', p_event.event_type,
    'version', p_event.version,
    'occurredAt', p_event.occurred_at,
    'payload', p_event.payload_json,
    'idempotencyKey', p_event.idempotency_key,
    'cursor', p_event.cursor
  ) || case
    when p_event.student_id is not null
      then jsonb_build_object('studentId', p_event.student_id)
    else '{}'::jsonb
  end;
$$;

create or replace function university_private.append_event(
  p_event_type text,
  p_payload jsonb,
  p_student_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.events%rowtype;
  v_inserted public.events%rowtype;
  v_aggregate_key text;
  v_version integer;
  v_occurred_at timestamptz := clock_timestamp();
begin
  select * into v_existing
  from public.events
  where idempotency_key = p_idempotency_key;

  if found then
    return university_private.event_json(v_existing);
  end if;

  v_aggregate_key := case
    when p_student_id is not null then 'student:' || p_student_id
    when p_event_type like 'registration.%' then 'calendar'
    when position('section' in p_event_type) > 0 or p_event_type = 'offering.updated'
      then 'offering:' || coalesce(p_payload->>'sectionId', 'unknown')
    else p_event_type || ':' || coalesce(p_payload->>'id', 'global')
  end;

  begin
    insert into public.aggregate_versions (aggregate_key, version)
    values (v_aggregate_key, 1)
    on conflict (aggregate_key) do update
      set version = public.aggregate_versions.version + 1
    returning version into v_version;

    insert into public.events (
      id, event_type, version, occurred_at, student_id, payload_json,
      idempotency_key, next_attempt_at
    ) values (
      gen_random_uuid()::text, p_event_type, v_version, v_occurred_at,
      p_student_id, p_payload, p_idempotency_key, v_occurred_at
    )
    returning * into v_inserted;
  exception
    when unique_violation then
      select * into v_existing
      from public.events
      where idempotency_key = p_idempotency_key;
      if found then
        return university_private.event_json(v_existing);
      end if;
      raise;
  end;

  return university_private.event_json(v_inserted);
end;
$$;

revoke all on function university_private.event_json(public.events) from public, anon, authenticated, service_role;
revoke all on function university_private.append_event(text, jsonb, text, text) from public, anon, authenticated, service_role;

create or replace function public.university_commit_student_mutation(
  p_student_id text,
  p_expected_updated_at timestamptz,
  p_profile_json jsonb,
  p_record_json jsonb,
  p_event_type text,
  p_event_payload jsonb,
  p_idempotency_key text,
  p_secondary_event_type text,
  p_secondary_event_payload jsonb,
  p_secondary_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_existing public.events%rowtype;
  v_event jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.events where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate', true, 'event', university_private.event_json(v_existing));
  end if;

  select * into v_student from public.students where student_id = p_student_id for update;
  if not found then raise exception using message = 'STUDENT_NOT_FOUND'; end if;
  if v_student.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'CONCURRENT_MODIFICATION';
  end if;

  update public.students
  set profile_json = p_profile_json,
      record_json = coalesce(p_record_json, record_json),
      updated_at = clock_timestamp()
  where student_id = p_student_id;

  v_event := university_private.append_event(
    p_event_type, p_event_payload, p_student_id, p_idempotency_key
  );
  if p_secondary_event_type is not null then
    perform university_private.append_event(
      p_secondary_event_type,
      coalesce(p_secondary_event_payload, '{}'::jsonb),
      p_student_id,
      p_secondary_idempotency_key
    );
  end if;

  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;

create or replace function public.university_create_student(
  p_student_id text,
  p_profile_json jsonb,
  p_record_json jsonb,
  p_event_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.events%rowtype;
  v_event jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  perform pg_advisory_xact_lock(hashtextextended('student:' || p_student_id, 0));
  select * into v_existing from public.events where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate', true, 'event', university_private.event_json(v_existing));
  end if;
  if exists (select 1 from public.students where student_id = p_student_id) then
    raise exception using message = 'STUDENT_ALREADY_EXISTS';
  end if;

  insert into public.students (student_id, profile_json, record_json, updated_at)
  values (p_student_id, p_profile_json, p_record_json, clock_timestamp());
  v_event := university_private.append_event(
    'student.created', p_event_payload, p_student_id, p_idempotency_key
  );
  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;

create or replace function public.university_register_sections(
  p_student_id text,
  p_expected_student_updated_at timestamptz,
  p_profile_json jsonb,
  p_offering_updates jsonb,
  p_event_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar public.calendar%rowtype;
  v_student public.students%rowtype;
  v_existing public.events%rowtype;
  v_update jsonb;
  v_offering public.offerings%rowtype;
  v_event jsonb;
  v_current_term text;
  v_section_id text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.events where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate', true, 'event', university_private.event_json(v_existing));
  end if;

  -- Global registration lock order: calendar, student, then offerings by section_id.
  -- Registration close takes the calendar lock; offering-only updates take no
  -- calendar/student lock, so these operations cannot form a cyclic row-lock order.
  select * into v_calendar from public.calendar where id = 1 for update;
  if not found then raise exception using message = 'UNIVERSITY_DATA_NOT_INITIALIZED'; end if;
  if coalesce((v_calendar.data_json->>'registrationOpen')::boolean, false) is not true then
    raise exception using message = 'REGISTRATION_CLOSED';
  end if;
  v_current_term := v_calendar.data_json #>> '{currentTerm,code}';
  if v_current_term is null then
    raise exception using message = 'UNIVERSITY_DATA_NOT_INITIALIZED';
  end if;

  select * into v_student from public.students where student_id = p_student_id for update;
  if not found then raise exception using message = 'STUDENT_NOT_FOUND'; end if;
  if v_student.updated_at is distinct from p_expected_student_updated_at then
    raise exception using message = 'CONCURRENT_MODIFICATION';
  end if;

  -- Lock and revalidate every requested or updated offering in deterministic order.
  -- The profile contains the requested final schedule; offering_updates also
  -- contains removed sections whose seat counts must be changed.
  for v_section_id in
    select ids.section_id
    from (
      select requested.value->>'id' as section_id
      from jsonb_array_elements(coalesce(p_profile_json->'currentRegisteredSections', '[]'::jsonb)) requested
      union
      select updated.value->>'section_id' as section_id
      from jsonb_array_elements(coalesce(p_offering_updates, '[]'::jsonb)) updated
    ) ids
    where ids.section_id is not null
    order by ids.section_id
  loop
    select * into v_offering
    from public.offerings
    where section_id = v_section_id
    for update;
    if not found then raise exception using message = 'SECTION_NOT_FOUND'; end if;
    if v_offering.term_code is distinct from v_current_term then
      raise exception using message = 'WRONG_TERM';
    end if;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_offering_updates, '[]'::jsonb))
    order by value->>'section_id'
  loop
    select * into v_offering
    from public.offerings
    where section_id = v_update->>'section_id';
    if not found then raise exception using message = 'SECTION_NOT_FOUND'; end if;
    if v_offering.term_code is distinct from v_current_term then
      raise exception using message = 'WRONG_TERM';
    end if;
    if v_offering.updated_at is distinct from (v_update->>'expected_updated_at')::timestamptz then
      raise exception using message = 'CONCURRENT_MODIFICATION';
    end if;

    update public.offerings
    set data_json = v_update->'data_json', updated_at = clock_timestamp()
    where section_id = v_offering.section_id;
    perform university_private.append_event(
      'offering.updated',
      v_update->'event_payload',
      null,
      v_update->>'idempotency_key'
    );
  end loop;

  update public.students
  set profile_json = p_profile_json, updated_at = clock_timestamp()
  where student_id = p_student_id;
  v_event := university_private.append_event(
    'schedule.changed', p_event_payload, p_student_id, p_idempotency_key
  );
  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;

create or replace function public.university_set_registration(
  p_expected_updated_at timestamptz,
  p_calendar_json jsonb,
  p_event_type text,
  p_event_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar public.calendar%rowtype;
  v_existing public.events%rowtype;
  v_event jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.events where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate', true, 'event', university_private.event_json(v_existing));
  end if;
  select * into v_calendar from public.calendar where id = 1 for update;
  if not found then raise exception using message = 'UNIVERSITY_DATA_NOT_INITIALIZED'; end if;
  if v_calendar.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'CONCURRENT_MODIFICATION';
  end if;
  update public.calendar set data_json = p_calendar_json, updated_at = clock_timestamp() where id = 1;
  v_event := university_private.append_event(p_event_type, p_event_payload, null, p_idempotency_key);
  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;

create or replace function public.university_update_offering(
  p_section_id text,
  p_expected_updated_at timestamptz,
  p_data_json jsonb,
  p_event_type text,
  p_event_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offering public.offerings%rowtype;
  v_existing public.events%rowtype;
  v_event jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.events where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('duplicate', true, 'event', university_private.event_json(v_existing));
  end if;
  select * into v_offering from public.offerings where section_id = p_section_id for update;
  if not found then raise exception using message = 'SECTION_NOT_FOUND'; end if;
  if v_offering.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'CONCURRENT_MODIFICATION';
  end if;
  update public.offerings set data_json = p_data_json, updated_at = clock_timestamp()
  where section_id = p_section_id;
  v_event := university_private.append_event(p_event_type, p_event_payload, null, p_idempotency_key);
  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;

create or replace function public.university_mark_delivery(
  p_cursor bigint,
  p_status integer,
  p_delivered boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_delay_seconds integer;
  v_now timestamptz := clock_timestamp();
begin
  select attempts + 1 into v_attempts
  from public.events
  where cursor = p_cursor
  for update;
  if not found then return; end if;
  v_delay_seconds := least(60, power(2, least(v_attempts, 6))::integer);
  update public.events
  set attempts = v_attempts,
      last_status = p_status,
      delivered_at = case when p_delivered then v_now else null end,
      next_attempt_at = v_now + make_interval(secs => v_delay_seconds)
  where cursor = p_cursor;
end;
$$;

revoke all on function public.university_commit_student_mutation(text, timestamptz, jsonb, jsonb, text, jsonb, text, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.university_create_student(text, jsonb, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.university_register_sections(text, timestamptz, jsonb, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.university_set_registration(timestamptz, jsonb, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.university_update_offering(text, timestamptz, jsonb, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.university_mark_delivery(bigint, integer, boolean)
  from public, anon, authenticated, service_role;

grant execute on function public.university_commit_student_mutation(text, timestamptz, jsonb, jsonb, text, jsonb, text, text, jsonb, text)
  to service_role;
grant execute on function public.university_create_student(text, jsonb, jsonb, jsonb, text)
  to service_role;
grant execute on function public.university_register_sections(text, timestamptz, jsonb, jsonb, jsonb, text)
  to service_role;
grant execute on function public.university_set_registration(timestamptz, jsonb, text, jsonb, text)
  to service_role;
grant execute on function public.university_update_offering(text, timestamptz, jsonb, text, jsonb, text)
  to service_role;
grant execute on function public.university_mark_delivery(bigint, integer, boolean)
  to service_role;

commit;
