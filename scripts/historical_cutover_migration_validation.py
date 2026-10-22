"""Real PostgreSQL validation for the historical_cutover constraint reconciliation.

Run only against the named disposable, network-isolated PostgreSQL container.
"""
from __future__ import annotations

import pathlib
import subprocess
import time
import unittest


CONTAINER = "morshidi-phase4b-disposable"
DATABASES = (
    "historical_cutover_fresh",
    "historical_cutover_reconciled",
    "historical_cutover_unexpected",
)
ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
BASELINE = (
    "20261007111025_initial_university_schema.sql",
    "20261007120629_university_transactional_rpc.sql",
    "20261021161034_notification_reliability_idempotency.sql",
)
RECONCILIATION = "20261022123000_reconcile_historical_cutover_terminal_reason.sql"


def psql(database: str, sql: str, *, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-q", "-A", "-t",
         "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database],
        input=sql.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if check and result.returncode:
        raise AssertionError(result.stderr.decode("utf-8", "replace"))
    return result


def value(database: str, sql: str) -> str:
    return psql(database, sql).stdout.decode("utf-8").strip().splitlines()[-1]


def migration(name: str) -> str:
    return (MIGRATIONS / name).read_text(encoding="utf-8")


def prepare(database: str) -> None:
    psql("postgres", f"drop database if exists {database} with (force); create database {database};")
    for name in BASELINE:
        psql(database, migration(name))


def insert_terminal(database: str, key: str, reason: str, *, check: bool = True):
    return psql(database, f"""
        insert into public.events(
          id,event_type,version,occurred_at,student_id,payload_json,idempotency_key,
          next_attempt_at,delivery_terminal_reason,delivery_terminal_at
        ) values (
          gen_random_uuid()::text,'registration.opened',1,clock_timestamp(),null,'{{}}'::jsonb,
          '{key}',clock_timestamp(),'{reason}',clock_timestamp()
        );
    """, check=check)


class HistoricalCutoverMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        result = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Running}}|{{.HostConfig.NetworkMode}}", CONTAINER],
            capture_output=True, text=True, check=True,
        )
        if result.stdout.strip() != "true|none":
            raise RuntimeError("Disposable PostgreSQL container must be running with network mode none")
        for _ in range(20):
            if psql("postgres", "select 1", check=False).returncode == 0:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL did not become ready")
        psql("postgres", """
          do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
          do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
          do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
        """)
        for database in DATABASES:
            prepare(database)

    @classmethod
    def tearDownClass(cls):
        for database in DATABASES:
            psql("postgres", f"drop database if exists {database} with (force);", check=False)

    def test_original_constraint_is_upgraded_without_data_rewrite(self):
        database = DATABASES[0]
        before = value(database, "select count(*) from public.events")
        psql(database, migration(RECONCILIATION))
        self.assertEqual(value(database, "select count(*) from public.events"), before)
        insert_terminal(database, "fresh-historical", "historical_cutover")
        self.assertNotEqual(insert_terminal(database, "fresh-invalid", "unexpected", check=False).returncode, 0)

    def test_already_reconciled_schema_and_archived_rows_are_preserved(self):
        database = DATABASES[1]
        psql(database, """
          alter table public.events drop constraint events_terminal_reason_check;
          alter table public.events add constraint events_terminal_reason_check check (
            delivery_terminal_reason is null or delivery_terminal_reason in
              ('unsupported_event','http_rejected','invalid_event','historical_cutover'));
        """)
        insert_terminal(database, "existing-historical", "historical_cutover")
        before = value(database, "select count(*) || ':' || min(idempotency_key) from public.events")
        psql(database, migration(RECONCILIATION))
        self.assertEqual(value(database, "select count(*) || ':' || min(idempotency_key) from public.events"), before)

    def test_unexpected_constraint_aborts_and_remains_unchanged(self):
        database = DATABASES[2]
        psql(database, """
          alter table public.events drop constraint events_terminal_reason_check;
          alter table public.events add constraint events_terminal_reason_check check (
            delivery_terminal_reason is null or delivery_terminal_reason in ('mystery'));
        """)
        result = psql(database, migration(RECONCILIATION), check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("UNEXPECTED_EVENTS_TERMINAL_REASON_CHECK", result.stderr.decode("utf-8", "replace"))
        self.assertIn("mystery", value(database, """
          select pg_get_constraintdef(oid) from pg_constraint
           where conrelid='public.events'::regclass and conname='events_terminal_reason_check'
        """))


if __name__ == "__main__":
    unittest.main(verbosity=2)
