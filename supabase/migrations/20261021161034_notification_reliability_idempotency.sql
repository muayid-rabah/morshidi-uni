begin;

-- Terminal dispositions retain the original event and distinguish skips/failures from delivery.
alter table public.events add column delivery_terminal_reason text;
alter table public.events add column delivery_terminal_at timestamptz;
alter table public.events add constraint events_terminal_reason_check
  check (delivery_terminal_reason is null or delivery_terminal_reason in ('unsupported_event', 'http_rejected', 'invalid_event'));
create index events_pending_actionable_idx on public.events(next_attempt_at, cursor)
  where delivered_at is null and delivery_terminal_reason is null;

create table university_private.registration_commands (
  idempotency_key text primary key,
  event_type text not null check (event_type in ('registration.opened', 'registration.closed')),
  event_id text references public.events(id),
  created_at timestamptz not null default clock_timestamp()
);
revoke all on university_private.registration_commands from public, anon, authenticated, service_role;

create or replace function public.university_set_registration(
  p_expected_updated_at timestamptz, p_calendar_json jsonb, p_event_type text,
  p_event_payload jsonb, p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_calendar public.calendar%rowtype;
  v_command university_private.registration_commands%rowtype;
  v_existing public.events%rowtype;
  v_open boolean;
  v_calendar_json jsonb;
  v_event jsonb;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = ''
     or p_event_type not in ('registration.opened', 'registration.closed') then
    raise exception using message = 'INVALID_REGISTRATION_COMMAND';
  end if;
  v_open := p_event_type = 'registration.opened';
  if jsonb_typeof(p_calendar_json->'registrationOpen') is distinct from 'boolean'
     or (p_calendar_json->>'registrationOpen')::boolean is distinct from v_open
     or jsonb_typeof(p_calendar_json->'registrationWindow') is distinct from 'object' then
    raise exception using message = 'INVALID_REGISTRATION_COMMAND';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_command from university_private.registration_commands where idempotency_key = p_idempotency_key;
  if found then
    if v_command.event_type <> p_event_type then raise exception using message = 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    if v_command.event_id is not null then
      select * into v_existing from public.events where id = v_command.event_id;
      v_event := university_private.event_json(v_existing);
    end if;
    return jsonb_build_object('duplicate', true, 'event', v_event);
  end if;
  -- Preserve idempotency for registration events written before this migration.
  select * into v_existing from public.events where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.event_type <> p_event_type then raise exception using message = 'IDEMPOTENCY_KEY_CONFLICT'; end if;
    insert into university_private.registration_commands(idempotency_key, event_type, event_id)
      values (p_idempotency_key, p_event_type, v_existing.id);
    return jsonb_build_object('duplicate', true, 'event', university_private.event_json(v_existing));
  end if;
  select * into v_calendar from public.calendar where id = 1 for update;
  if not found then raise exception using message = 'UNIVERSITY_DATA_NOT_INITIALIZED'; end if;
  if jsonb_typeof(v_calendar.data_json->'registrationOpen') is distinct from 'boolean' then
    raise exception using message = 'INVALID_REGISTRATION_STATE';
  end if;
  if (v_calendar.data_json->>'registrationOpen')::boolean = v_open then
    insert into university_private.registration_commands(idempotency_key, event_type) values (p_idempotency_key, p_event_type);
    return jsonb_build_object('duplicate', false, 'event', null);
  end if;
  if v_calendar.updated_at is distinct from p_expected_updated_at then
    raise exception using message = 'CONCURRENT_MODIFICATION';
  end if;
  v_calendar_json := jsonb_set(jsonb_set(v_calendar.data_json, '{registrationOpen}', to_jsonb(v_open)),
    '{registrationWindow}', p_calendar_json->'registrationWindow');
  update public.calendar set data_json = v_calendar_json, updated_at = clock_timestamp() where id = 1;
  v_event := university_private.append_event(p_event_type,
    jsonb_build_object('currentTerm', v_calendar_json->'currentTerm', 'registrationWindow', v_calendar_json->'registrationWindow'),
    null, p_idempotency_key);
  insert into university_private.registration_commands(idempotency_key, event_type, event_id)
    values (p_idempotency_key, p_event_type, v_event->>'id');
  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;
revoke all on function public.university_set_registration(timestamptz, jsonb, text, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.university_set_registration(timestamptz, jsonb, text, jsonb, text) to service_role;

-- A new RPC name prevents new application code from silently falling back to the old contract.
create function public.university_set_registration_v2(
  p_expected_updated_at timestamptz, p_calendar_json jsonb, p_event_type text,
  p_event_payload jsonb, p_idempotency_key text
) returns jsonb language sql security definer set search_path = '' as $$
  select public.university_set_registration(p_expected_updated_at, p_calendar_json, p_event_type, p_event_payload, p_idempotency_key);
$$;
revoke all on function public.university_set_registration_v2(timestamptz, jsonb, text, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.university_set_registration_v2(timestamptz, jsonb, text, jsonb, text) to service_role;

create or replace function public.university_mark_delivery(p_cursor bigint, p_status integer, p_delivered boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempts integer; v_now timestamptz := clock_timestamp();
begin
  select attempts + 1 into v_attempts from public.events
    where cursor = p_cursor and delivered_at is null and delivery_terminal_reason is null for update;
  if not found then return; end if;
  update public.events set attempts = v_attempts, last_status = p_status,
    delivered_at = case when p_delivered then v_now else null end,
    next_attempt_at = v_now + make_interval(secs => least(60, power(2, least(v_attempts, 6))::integer))
    where cursor = p_cursor;
end;
$$;
revoke all on function public.university_mark_delivery(bigint, integer, boolean) from public, anon, authenticated, service_role;
grant execute on function public.university_mark_delivery(bigint, integer, boolean) to service_role;

create function public.university_terminal_delivery(p_cursor bigint, p_reason text, p_status integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_reason not in ('unsupported_event', 'http_rejected', 'invalid_event') then
    raise exception using message = 'INVALID_DELIVERY_DISPOSITION';
  end if;
  update public.events set delivery_terminal_reason = p_reason, delivery_terminal_at = clock_timestamp(),
    last_status = p_status, attempts = attempts + case when p_reason = 'http_rejected' then 1 else 0 end
    where cursor = p_cursor and delivered_at is null and delivery_terminal_reason is null;
end;
$$;
revoke all on function public.university_terminal_delivery(bigint, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.university_terminal_delivery(bigint, text, integer) to service_role;
commit;
