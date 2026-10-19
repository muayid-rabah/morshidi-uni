-- End-to-end registration: structured audit events and deterministic demo offerings.
-- Fake University remains authoritative. Data is explicitly synthetic and uses
-- only canonical courses already present in curriculum_plan_courses.

begin;

create or replace function public.university_record_registration_audit(
  p_student_id text,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event jsonb;
begin
  if not exists (select 1 from public.students where student_id = p_student_id) then
    raise exception using message = 'STUDENT_NOT_FOUND';
  end if;
  if p_payload->>'action' not in ('REGISTER', 'DROP')
     or p_payload->>'outcome' not in ('CONFIRMED', 'REJECTED') then
    raise exception using message = 'INVALID_REGISTRATION_AUDIT';
  end if;
  v_event := university_private.append_event(
    'registration.audit',
    p_payload || jsonb_build_object('recordedAt', clock_timestamp()),
    p_student_id,
    p_idempotency_key
  );
  return jsonb_build_object('duplicate', false, 'event', v_event);
end;
$$;

revoke all on function public.university_record_registration_audit(text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.university_record_registration_audit(text, jsonb, text)
  to service_role;

-- Deterministic Fake University demo offerings for canonical, prerequisite-free,
-- non-review courses that do not already have an offering in the active term.
with active_term as (
  select data_json #>> '{currentTerm,code}' as term_code from public.calendar where id = 1
), candidates as (
  select distinct on (pc.course_code)
    pc.course_code,
    pc.name_ar,
    pc.credit_hours,
    row_number() over (order by pc.course_code, pc.plan_key) as slot
  from public.curriculum_plan_courses pc
  where jsonb_array_length(pc.prerequisite_codes) = 0
    and coalesce(pc.review_required, false) = false
  order by pc.course_code, pc.plan_key
)
insert into public.offerings(section_id, course_code, term_code, data_json, updated_at)
select
  'DEMO-' || active_term.term_code || '-' || candidates.course_code || '-01',
  candidates.course_code,
  active_term.term_code,
  jsonb_build_object(
    'id', 'DEMO-' || active_term.term_code || '-' || candidates.course_code || '-01',
    'course_code', candidates.course_code,
    'course_name', candidates.name_ar,
    'section_number', 1,
    'credits', candidates.credit_hours,
    'instructor', 'مدرس تجريبي - Fake University',
    'days', case when candidates.slot % 2 = 0 then 'ن ر' else 'ح ث خ' end,
    'days_array', case when candidates.slot % 2 = 0
      then jsonb_build_array('الاثنين', 'الأربعاء')
      else jsonb_build_array('الأحد', 'الثلاثاء', 'الخميس') end,
    'start_time', lpad((8 + (candidates.slot % 6))::text, 2, '0') || ':00',
    'end_time', lpad((9 + (candidates.slot % 6))::text, 2, '0') || ':00',
    'meetings', case when candidates.slot % 2 = 0
      then jsonb_build_array(
        jsonb_build_object('day', 'الاثنين', 'startTime', lpad((8 + (candidates.slot % 6))::text, 2, '0') || ':00', 'endTime', lpad((9 + (candidates.slot % 6))::text, 2, '0') || ':00'),
        jsonb_build_object('day', 'الأربعاء', 'startTime', lpad((8 + (candidates.slot % 6))::text, 2, '0') || ':00', 'endTime', lpad((9 + (candidates.slot % 6))::text, 2, '0') || ':00'))
      else jsonb_build_array(
        jsonb_build_object('day', 'الأحد', 'startTime', lpad((8 + (candidates.slot % 6))::text, 2, '0') || ':00', 'endTime', lpad((9 + (candidates.slot % 6))::text, 2, '0') || ':00'),
        jsonb_build_object('day', 'الثلاثاء', 'startTime', lpad((8 + (candidates.slot % 6))::text, 2, '0') || ':00', 'endTime', lpad((9 + (candidates.slot % 6))::text, 2, '0') || ':00'),
        jsonb_build_object('day', 'الخميس', 'startTime', lpad((8 + (candidates.slot % 6))::text, 2, '0') || ':00', 'endTime', lpad((9 + (candidates.slot % 6))::text, 2, '0') || ':00')) end,
    'room', 'قاعة تجريبية ' || (100 + candidates.slot)::text,
    'capacity', 30,
    'enrolled', 0,
    'available', 30,
    'status', 'متاحة',
    'demo_policy', true
  ),
  clock_timestamp()
from candidates cross join active_term
where active_term.term_code is not null
on conflict (section_id) do nothing;

commit;
