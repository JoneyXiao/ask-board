#!/usr/bin/env python3
"""Apply migration + seed and run data-layer acceptance against a Postgres URL."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = next((ROOT / "supabase/migrations").glob("*_init_ask_board.sql"))
SEED = ROOT / "supabase/seed.sql"
BOOTSTRAP = Path(__file__).with_name("bootstrap_roles.sql")

K1 = "11111111-1111-1111-1111-111111111111"
K2 = "22222222-2222-2222-2222-222222222222"


def run_psql(url: str, sql: str, *, role: str | None = None, on_error_stop: bool = True) -> str:
    parts = []
    if role:
        parts.append(f"set role {role};")
    parts.append(sql)
    env = os.environ.copy()
    env["PAGER"] = "cat"
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as fh:
        fh.write("\n".join(parts))
        path = fh.name
    try:
        cmd = [
            "psql",
            url,
            "-v",
            "ON_ERROR_STOP=1" if on_error_stop else "ON_ERROR_STOP=0",
            "-A",
            "-t",
            "-q",
            "-f",
            path,
        ]
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True, env=env)
    finally:
        os.unlink(path)
    if proc.returncode != 0:
        raise RuntimeError(
            f"psql failed ({proc.returncode}):\nSQL:\n{sql}\nstderr:\n{proc.stderr}\nstdout:\n{proc.stdout}"
        )
    return proc.stdout.strip()


def must_fail(url: str, sql: str, role: str | None = None, contains: str | None = None) -> str:
    try:
        out = run_psql(url, sql, role=role)
    except RuntimeError as e:
        text = str(e)
        if contains and contains.lower() not in text.lower():
            raise RuntimeError(f"failed as expected, but message mismatch ({contains!r}):\n{text}") from e
        return text
    raise RuntimeError(f"expected failure, but succeeded: {sql}\noutput: {out}")


def scalar(url: str, sql: str, role: str | None = None) -> str:
    return run_psql(url, sql, role=role)


def priv(url: str, role: str, table: str, privilege: str) -> bool:
    v = scalar(url, f"select has_table_privilege('{role}', '{table}', '{privilege}');")
    return v in ("t", "true", "1")


def main() -> int:
    url = os.environ.get("DATABASE_URL") or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not url:
        print("Usage: DATABASE_URL=postgres://... python3 run_acceptance.py", file=sys.stderr)
        return 2

    print("Applying bootstrap, migration, seed…")
    run_psql(url, BOOTSTRAP.read_text())
    run_psql(url, MIGRATION.read_text())
    run_psql(url, SEED.read_text())
    print("OK: migration and seed applied")

    assert priv(url, "anon", "public.questions", "SELECT"), "anon should SELECT questions"
    for p in ("INSERT", "UPDATE", "DELETE"):
        assert not priv(url, "anon", "public.questions", p), f"anon must not {p} questions"
    for table in (
        "public.votes",
        "public.host_secrets",
        "public.host_sessions",
        "private.question_submissions",
    ):
        for p in ("SELECT", "INSERT", "UPDATE", "DELETE"):
            assert not priv(url, "anon", table, p), f"anon must not {p} {table}"
    print("OK: RLS grants — anon can only SELECT questions")

    must_fail(url, "insert into public.questions (body) values ('nope');", role="anon")
    must_fail(url, "select * from public.votes;", role="anon")
    must_fail(url, "select * from public.host_secrets;", role="anon")
    must_fail(url, "select * from public.host_sessions;", role="anon")
    print("OK: anon direct writes/reads blocked")

    q1 = scalar(
        url,
        f"select id from public.submit_question('第一个问题', 'Alice', '{K1}');",
        role="anon",
    )
    assert q1, "submit_question should return an id"
    row = scalar(
        url,
        f"select status || ',' || vote_count || ',' || body || ',' || author_name from public.questions where id = '{q1}';",
        role="anon",
    )
    assert row == "open,0,第一个问题,Alice", row
    print("OK: submit_question")

    for i in range(2, 6):
        scalar(url, f"select id from public.submit_question('问题{i}', null, '{K1}');", role="anon")
    must_fail(
        url,
        f"select id from public.submit_question('第6条应失败', null, '{K1}');",
        role="anon",
        contains="rate limit",
    )
    print("OK: rate limit 5/hour/voter_key")

    q2 = scalar(
        url,
        f"select id from public.submit_question('第二个观众的问题', null, '{K2}');",
        role="anon",
    )
    assert q2, "second voter should submit"
    print("OK: other voter_key can still submit")

    v = scalar(url, f"select public.toggle_vote('{q1}', '{K2}')::text;", role="anon")
    compact = v.replace(" ", "")
    assert '"vote_count":1' in compact, v
    assert '"voted":true' in compact, v
    v = scalar(url, f"select public.toggle_vote('{q1}', '{K2}')::text;", role="anon")
    compact = v.replace(" ", "")
    assert '"vote_count":0' in compact, v
    assert '"voted":false' in compact, v
    scalar(url, f"select public.toggle_vote('{q1}', '{K2}')::text;", role="anon")
    print("OK: toggle_vote")

    must_fail(url, "select public.verify_host_pin('0000');", role="anon", contains="invalid pin")
    token_json = scalar(url, "select public.verify_host_pin('1234')::text;", role="anon")
    data = json.loads(token_json)
    token = data["token"]
    assert re.fullmatch(r"[0-9a-f]{64}", token), token
    assert "expires_at" in data
    print("OK: verify_host_pin")

    st = scalar(
        url,
        f"select status from public.set_question_status('{q1}', 'speaking', '{token}');",
        role="anon",
    )
    assert st == "speaking", st
    st2 = scalar(
        url,
        f"select status from public.set_question_status('{q2}', 'speaking', '{token}');",
        role="anon",
    )
    assert st2 == "speaking", st2
    n = scalar(url, "select count(*) from public.questions where status = 'speaking';", role="anon")
    assert n == "1", n
    back = scalar(url, f"select status from public.questions where id = '{q1}';", role="anon")
    assert back == "open", back
    print("OK: only one speaking at a time")

    scalar(
        url,
        f"select status from public.set_question_status('{q2}', 'answered', '{token}');",
        role="anon",
    )
    must_fail(
        url,
        f"select public.toggle_vote('{q2}', '{K1}')::text;",
        role="anon",
        contains="answered",
    )
    print("OK: cannot vote on answered")

    must_fail(
        url,
        f"select status from public.set_question_status('{q1}', 'answered', 'not-a-real-token');",
        role="anon",
        contains="invalid or expired session",
    )
    print("OK: bad token rejected")

    expired = "expired-session-token-for-test"
    run_psql(
        url,
        """
        insert into public.host_sessions (token_hash, expires_at)
        values (encode(extensions.digest('expired-session-token-for-test', 'sha256'), 'hex'), now() - interval '1 hour');
        """,
    )
    must_fail(
        url,
        f"select status from public.set_question_status('{q1}', 'answered', '{expired}');",
        role="anon",
        contains="invalid or expired session",
    )
    print("OK: expired token rejected")

    pub = scalar(
        url,
        "select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'questions';",
    )
    assert pub == "1", pub
    print("OK: questions in supabase_realtime")

    print("All acceptance checks passed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as e:
        print(f"ACCEPTANCE FAILED: {e}", file=sys.stderr)
        raise SystemExit(1)
    except RuntimeError as e:
        print(f"ACCEPTANCE FAILED: {e}", file=sys.stderr)
        raise SystemExit(1)
