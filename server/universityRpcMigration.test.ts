import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20261007120629_university_transactional_rpc.sql');
const migration = readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

function functionDefinition(name: string): string {
  const start = migration.indexOf(`create or replace function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = migration.indexOf('\ncreate or replace function ', start + 1);
  return migration.slice(start, next === -1 ? migration.length : next);
}

describe('university transactional RPC migration hardening', () => {
  it('is atomic when manually applied', () => {
    const statements = migration.replace(/^--.*$/gm, '').trim();
    assert.match(statements, /^begin;/i);
    assert.match(statements, /commit;$/i);
  });

  it('omits studentId only for non-student events without stripping payload nulls', () => {
    const definition = functionDefinition('university_private.event_json');
    const baseObject = definition.slice(definition.indexOf('jsonb_build_object('), definition.indexOf(') || case'));
    assert.doesNotMatch(baseObject, /'studentId'/);
    assert.match(definition, /when p_event\.student_id is not null[\s\S]*jsonb_build_object\('studentId', p_event\.student_id\)/);
    assert.doesNotMatch(definition, /jsonb_strip_nulls/i);
  });

  it('serializes registration locks as calendar, student, then ordered offerings', () => {
    const definition = functionDefinition('public.university_register_sections');
    const calendarLock = definition.indexOf('from public.calendar where id = 1 for update');
    const studentLock = definition.indexOf('from public.students where student_id = p_student_id for update');
    const offeringLock = definition.indexOf('order by ids.section_id');
    assert.ok(calendarLock >= 0 && studentLock > calendarLock && offeringLock > studentLock);
    assert.match(definition, /registrationOpen'[\s\S]*REGISTRATION_CLOSED/);
    assert.match(definition, /v_offering\.term_code is distinct from v_current_term[\s\S]*WRONG_TERM/);
    assert.match(definition, /p_profile_json->'currentRegisteredSections'[\s\S]*p_offering_updates/);
  });

  it('allows an open registration to reach the mutation and rejects a closed one transactionally', () => {
    const definition = functionDefinition('public.university_register_sections');
    const openCheck = definition.indexOf("coalesce((v_calendar.data_json->>'registrationOpen')::boolean, false) is not true");
    const closedError = definition.indexOf("raise exception using message = 'REGISTRATION_CLOSED'", openCheck);
    const studentMutation = definition.indexOf('update public.students', closedError);
    assert.ok(openCheck >= 0 && closedError > openCheck && studentMutation > closedError);
  });

  it('makes registration close participate in the same leading calendar lock', () => {
    const setRegistration = functionDefinition('public.university_set_registration');
    assert.match(setRegistration, /from public\.calendar where id = 1 for update/);
    const updateOffering = functionDefinition('public.university_update_offering');
    assert.doesNotMatch(updateOffering, /from public\.calendar/);
  });

  it('pins every SECURITY DEFINER function to an empty search path', () => {
    const definitions = [...migration.matchAll(/create or replace function public\.[\s\S]*?(?=\ncreate or replace function |\nrevoke all on function public\.)/gi)]
      .map((match) => match[0]);
    assert.equal(definitions.length, 6);
    for (const definition of definitions) {
      assert.match(definition, /security definer\s+set search_path = ''/i);
    }
  });

  it('keeps helpers private and exposes only the approved service-role RPC boundary', () => {
    assert.match(migration, /revoke all on schema university_private from public, anon, authenticated, service_role/i);
    assert.match(migration, /revoke all on function university_private\.event_json\(public\.events\) from public, anon, authenticated, service_role/i);
    assert.match(migration, /revoke all on function university_private\.append_event\(text, jsonb, text, text\) from public, anon, authenticated, service_role/i);
    assert.doesNotMatch(migration, /grant execute on function university_private\./i);
  });

  it('keeps aggregate version allocation inside the unique-violation subtransaction', () => {
    const definition = functionDefinition('university_private.append_event');
    const exceptionBlockStart = definition.indexOf('\n  begin\n', definition.indexOf('v_aggregate_key :='));
    const aggregateWrite = definition.indexOf('insert into public.aggregate_versions', exceptionBlockStart);
    const eventWrite = definition.indexOf('insert into public.events', aggregateWrite);
    const handler = definition.indexOf('exception\n    when unique_violation then', eventWrite);
    assert.ok(exceptionBlockStart >= 0 && aggregateWrite > exceptionBlockStart && eventWrite > aggregateWrite && handler > eventWrite);
    assert.match(definition.slice(handler), /where idempotency_key = p_idempotency_key[\s\S]*return university_private\.event_json\(v_existing\)/);
  });
});

describe('notification reliability migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261021161034_notification_reliability_idempotency.sql'), 'utf8');
  it('records a no-op under a locked key and calendar before any transition', () => {
    const keyLock = sql.indexOf('pg_advisory_xact_lock');
    const replay = sql.indexOf('from university_private.registration_commands where idempotency_key');
    const rowLock = sql.indexOf('from public.calendar where id = 1 for update');
    const noOp = sql.indexOf("if (v_calendar.data_json->>'registrationOpen')::boolean = v_open then");
    const write = sql.indexOf('update public.calendar set data_json');
    assert.ok(keyLock >= 0 && replay > keyLock && rowLock > replay && noOp > rowLock && write > noOp);
    assert.match(sql.slice(noOp, write), /insert into university_private\.registration_commands\(idempotency_key, event_type\)/);
    assert.match(sql, /IDEMPOTENCY_KEY_CONFLICT/);
    assert.match(sql, /university_set_registration_v2/);
  });
  it('keeps terminal failures distinguishable and restricts privileged functions', () => {
    assert.match(sql, /delivery_terminal_reason in \('unsupported_event', 'http_rejected', 'invalid_event'\)/);
    assert.match(sql, /where cursor = p_cursor and delivered_at is null and delivery_terminal_reason is null/);
    assert.match(sql, /revoke all on university_private\.registration_commands from public, anon, authenticated, service_role/);
    for (const name of ['university_set_registration', 'university_set_registration_v2', 'university_mark_delivery', 'university_terminal_delivery']) {
      assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^;]+ from public, anon, authenticated, service_role`));
    }
  });
});

describe('historical cutover terminal-reason reconciliation migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261022123000_reconcile_historical_cutover_terminal_reason.sql'), 'utf8');

  it('is forward-only, atomic, and contains no historical data rewrite', () => {
    const statements = sql.replace(/^--.*$/gm, '').trim();
    assert.match(statements, /^begin;/i);
    assert.match(statements, /commit;$/i);
    assert.doesNotMatch(sql, /\b(update|delete|truncate)\s+public\.events\b/i);
    assert.doesNotMatch(sql, /\binsert\s+into\s+public\.events\b/i);
  });

  it('accepts only the original or already-reconciled constraint before changing it', () => {
    assert.match(sql, /pg_get_expr\(c\.conbin, c\.conrelid, true\)/i);
    assert.match(sql, /EXPECTED_EVENTS_TERMINAL_REASON_CHECK_MISSING/);
    assert.match(sql, /UNEXPECTED_EVENTS_TERMINAL_REASON_CHECK/);
    assert.match(sql, /if v_compact = v_expected_original[\s\S]*elsif v_compact = v_expected_reconciled/i);
  });

  it('adds historical_cutover without removing existing terminal reasons', () => {
    assert.match(sql, /\('unsupported_event', 'http_rejected', 'invalid_event', 'historical_cutover'\)/);
    assert.match(sql, /already have the reviewed manual schema correction/i);
  });
});
