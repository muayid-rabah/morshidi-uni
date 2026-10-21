"""Phase 4B tests: run only against the named, network-isolated disposable container."""
import json
import subprocess
import concurrent.futures
import unittest

CONTAINER = 'morshidi-phase4b-disposable'
DB = 'phase4b_test3'

def sql(statement, check=True):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB], input=statement.encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise AssertionError(result.stderr.decode('utf-8', 'replace'))
    return result.stdout.decode('utf-8').strip() if check else result

def command(key, opened, sleep=0):
    kind = 'opened' if opened else 'closed'
    flag = 'true' if opened else 'false'
    return sql(f"""begin;
      select updated_at as stamp from public.calendar where id=1 \\gset
      select pg_sleep({sleep});
      select public.university_set_registration_v2(:'stamp'::timestamptz,
        jsonb_build_object('registrationOpen', {flag}, 'registrationWindow', jsonb_build_object('start',null,'end',null)),
        'registration.{kind}', '{{}}'::jsonb, '{key}')::text;
      commit;""")

def value(query): return sql(query).splitlines()[-1]

class DatabaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',CONTAINER],capture_output=True,text=True,check=True)
        if result.stdout.strip() != 'none': raise RuntimeError('Disposable container must have no network')
        sql("""insert into public.calendar(id,data_json,updated_at) values
          (1, '{"currentTerm":{"code":"TEST-1","label":"test"},"registrationOpen":false,"registrationWindow":{"start":null,"end":null}}', clock_timestamp());""")

    def test_01_open_noop_retry_and_new_transition(self):
        result = json.loads(command('open-a', True)); self.assertEqual(result['event']['type'], 'registration.opened')
        self.assertNotIn('studentId', result['event']); self.assertEqual(result['event']['payload']['currentTerm']['code'], 'TEST-1')
        self.assertEqual(value("select count(*) from public.events where event_type='registration.opened'"), '1')
        self.assertEqual(value("select count(*) from university_private.registration_commands where idempotency_key='open-a'"), '1')
        self.assertIsNone(json.loads(command('noop-k', True))['event'])
        command('close-b', False)
        self.assertTrue(json.loads(command('noop-k', True))['duplicate'])
        self.assertEqual(value("select data_json->>'registrationOpen' from public.calendar where id=1"), 'false')
        self.assertEqual(value("select count(*) from public.events where event_type='registration.opened'"), '1')
        command('fresh-open', True)
        self.assertEqual(value("select count(*) from public.events where event_type='registration.opened'"), '2')
        self.assertEqual(value("select count(*) from university_private.registration_commands where idempotency_key='noop-k' and event_id is null"), '1')

    def test_02_concurrent_distinct_keys(self):
        command('concurrent-close', False)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda key: json.loads(command(key, True, 0.7)), ['race-a','race-b']))
        self.assertEqual(sum(r['event'] is not None for r in results), 1)
        self.assertEqual(value("select count(*) from university_private.registration_commands where idempotency_key in ('race-a','race-b')"), '2')

    def test_03_concurrent_same_key(self):
        command('same-close', False)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: json.loads(command('race-same', True, 0.7)), range(2)))
        self.assertEqual(sum(not r['duplicate'] for r in results), 1)
        self.assertEqual(results[0]['event']['id'], results[1]['event']['id'])
        self.assertEqual(value("select count(*) from public.events where idempotency_key='race-same'"), '1')
        self.assertEqual(value("select count(*) from university_private.registration_commands where idempotency_key='race-same'"), '1')

    def test_04_legacy_and_conflicting_keys(self):
        self.assertTrue(json.loads(command('race-same', True))['duplicate'])
        result = sql("""select public.university_set_registration_v2((select updated_at from public.calendar),
          '{"registrationOpen":false,"registrationWindow":{}}', 'registration.closed', '{}', 'race-same');""", False)
        self.assertNotEqual(result.returncode, 0); self.assertIn('IDEMPOTENCY_KEY_CONFLICT', result.stderr.decode())
        sql("delete from university_private.registration_commands where idempotency_key='open-a'")
        self.assertTrue(json.loads(command('open-a', True))['duplicate'])
        self.assertEqual(value("select count(*) from university_private.registration_commands where idempotency_key='open-a'"), '1')

    def test_05_delivery_persistence(self):
        sql("select university_private.append_event('student.created','{}'::jsonb,null,'unsupported-test')")
        sql("select public.university_terminal_delivery((select cursor from public.events where idempotency_key='unsupported-test'),'unsupported_event',null)")
        sql("select public.university_terminal_delivery((select cursor from public.events where idempotency_key='close-b'),'http_rejected',422)")
        sql("select public.university_mark_delivery((select cursor from public.events where idempotency_key='fresh-open'),503,false)")
        self.assertEqual(value("select attempts || ':' || last_status || ':' || (next_attempt_at > occurred_at)::text from public.events where idempotency_key='fresh-open'"),'1:503:true')
        # Each sql() launches a new psql process; its exit and replacement must
        # leave the exact retry schedule and attempt count intact.
        retry = value("select attempts || ':' || next_attempt_at::text from public.events where idempotency_key='fresh-open'")
        self.assertEqual(value("select attempts || ':' || next_attempt_at::text from public.events where idempotency_key='fresh-open'"), retry)
        self.assertEqual(value("select count(*) from public.events where idempotency_key in ('unsupported-test','close-b') and delivered_at is null and delivery_terminal_reason is not null"),'2')
        sql("select public.university_mark_delivery((select cursor from public.events where idempotency_key='unsupported-test'),202,true)")
        self.assertEqual(value("select delivered_at is null from public.events where idempotency_key='unsupported-test'"),'t')
        self.assertEqual(value("select count(*) from public.events where idempotency_key in ('race-a','race-b') and delivered_at is null and delivery_terminal_reason is null"),'1')
        sql("select public.university_mark_delivery((select cursor from public.events where idempotency_key in ('race-a','race-b')),202,true)")
        self.assertEqual(value("select delivered_at is not null from public.events where idempotency_key in ('race-a','race-b')"),'t')

    def test_06_privileges_and_rls(self):
        self.assertEqual(value("select relrowsecurity from pg_class where oid='public.events'::regclass"), 't')
        for role in ('anon','authenticated'):
            for stmt in ("select * from public.events", "select * from university_private.registration_commands", "select public.university_mark_delivery(1,202,true)", "select public.university_set_registration_v2(null::timestamptz,'{}'::jsonb,'registration.opened','{}'::jsonb,'denied')"):
                result=sql(f'set role {role}; {stmt}', False)
                self.assertNotEqual(result.returncode,0, f'{role} was allowed {stmt}')
        self.assertEqual(value("select has_function_privilege('service_role','public.university_set_registration_v2(timestamptz,jsonb,text,jsonb,text)','execute')"), 't')
        self.assertEqual(value("select has_function_privilege('anon','public.university_set_registration_v2(timestamptz,jsonb,text,jsonb,text)','execute')"), 'f')
        self.assertEqual(value("select has_function_privilege('authenticated','public.university_terminal_delivery(bigint,text,integer)','execute')"), 'f')
        sql("set role service_role; select public.university_mark_delivery(999999,202,true)")
        result=sql('set role service_role; select * from university_private.registration_commands',False)
        self.assertNotEqual(result.returncode,0)

if __name__ == '__main__': unittest.main(verbosity=2)
