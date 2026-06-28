#!/usr/bin/env python3
"""Mint per-client access codes straight into Supabase over Postgres.

Reads the connection string from the CADENCE_DATABASE_URL env var (the same one
in cadence-backend/.env). Keeps secrets out of the command line / chat.

Usage:
    CADENCE_DATABASE_URL='postgresql+asyncpg://...' python3 mint_codes_pg.py <count> [label]
    # or, loading it from the backend .env:
    export $(grep '^CADENCE_DATABASE_URL=' ../../../cadence-backend/.env) && \
        python3 mint_codes_pg.py 5 test

Prints the minted codes (seq, code, label). Requires: pip install asyncpg
"""
import asyncio
import os
import secrets
import sys

import asyncpg

CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O/1/I/L


def _block(n: int) -> str:
    return "".join(secrets.choice(CHARS) for _ in range(n))


def _code() -> str:
    return f"CAD-{_block(4)}-{_block(4)}"


async def main() -> None:
    url = os.environ.get("CADENCE_DATABASE_URL", "")
    if not url:
        sys.exit("Set CADENCE_DATABASE_URL (see cadence-backend/.env).")
    # asyncpg wants a plain postgresql:// DSN, not the SQLAlchemy +asyncpg form.
    dsn = url.replace("postgresql+asyncpg://", "postgresql://")

    count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    label = sys.argv[2] if len(sys.argv) > 2 else None
    if not (1 <= count <= 1000):
        sys.exit("count must be 1..1000")

    conn = await asyncpg.connect(dsn, ssl="require")
    made = []
    while len(made) < count:
        try:
            row = await conn.fetchrow(
                "insert into access_codes(code, label) values($1, $2) "
                "returning seq, code, status",
                _code(),
                f"{label}-{len(made) + 1}" if label else None,
            )
            made.append(row)
        except asyncpg.UniqueViolationError:
            continue  # extremely rare collision; retry
    print("seq,code,label,status")
    for r in made:
        print(f"{r['seq']},{r['code']},{label or ''},{r['status']}")
    total = await conn.fetchval("select count(*) from access_codes")
    print(f"\n# total codes now in table: {total}", file=sys.stderr)
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
