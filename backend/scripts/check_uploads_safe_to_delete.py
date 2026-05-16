#!/usr/bin/env python3
"""
Verify the database before deleting the project `uploads/` folder.

Run from repo root or from `backend/`:
  python backend/scripts/check_uploads_safe_to_delete.py

Exit 0 only when nothing in Supabase still depends on local upload files
(lessons without file_base64; immersion rows with photo paths but no base64).
"""
from __future__ import annotations

import sys
from pathlib import Path

_backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend))

from supabase_client import is_configured, supabase  # noqa: E402


def _paginated_count(
    table: str,
    *,
    select_cols: str,
    row_needs_disk,
    page_size: int = 1000,
) -> tuple[int, str | None]:
    """Return (count, error_message)."""
    if supabase is None:
        return 0, "Supabase is not configured (SUPABASE_URL + key in backend/.env)."
    start = 0
    total = 0
    while True:
        try:
            res = (
                supabase.table(table)
                .select(select_cols)
                .range(start, start + page_size - 1)
                .execute()
            )
        except Exception as e:
            return 0, f"{table}: {e}"
        rows = res.data or []
        for r in rows:
            if row_needs_disk(r):
                total += 1
        if len(rows) < page_size:
            break
        start += page_size
    return total, None


def main() -> int:
    if not is_configured() or supabase is None:
        print("ERROR: Configure backend/.env with SUPABASE_URL and a service key, then retry.")
        return 2

    def lesson_disk(r: dict) -> bool:
        return not str(r.get("file_base64") or "").strip()

    n_lessons, err = _paginated_count("lessons", select_cols="id,file_base64", row_needs_disk=lesson_disk)
    if err:
        print(f"ERROR: {err}")
        return 2

    def immersion_tin_disk(r: dict) -> bool:
        p = str(r.get("captured_photo_path") or "").strip()
        b = str(r.get("captured_photo_base64") or "").strip()
        return bool(p) and not b

    def immersion_tout_disk(r: dict) -> bool:
        p = str(r.get("time_out_photo_path") or "").strip()
        b = str(r.get("time_out_photo_base64") or "").strip()
        return bool(p) and not b

    n_in, err = _paginated_count(
        "attendance_logs",
        select_cols="id,captured_photo_path,captured_photo_base64",
        row_needs_disk=immersion_tin_disk,
    )
    if err:
        print(f"ERROR (attendance_logs / time-in columns): {err}")
        print("Hint: run immersion migrations in Supabase if columns are missing.")
        return 2

    n_out, err = _paginated_count(
        "attendance_logs",
        select_cols="id,time_out_photo_path,time_out_photo_base64",
        row_needs_disk=immersion_tout_disk,
    )
    if err:
        print(f"ERROR (attendance_logs / time-out columns): {err}")
        return 2

    print("--- uploads/ delete safety check ---")
    print(f"lessons without file_base64 (need disk or re-upload):     {n_lessons}")
    print(f"attendance time-in path only (no base64 in DB):         {n_in}")
    print(f"attendance time-out path only (no base64 in DB):      {n_out}")
    print("--------------------------------------")

    if n_lessons or n_in or n_out:
        print(
            "NOT safe to delete uploads/ yet. "
            "Re-upload lessons missing DB blobs; do new Time In/Out so photos are stored in DB; "
            "or run SQL in backend/migrations/check_uploads_dependencies.sql to inspect rows."
        )
        return 1

    print(
        "OK — no rows depend on local upload files for lessons or immersion captures.\n"
        "You may delete the contents of the project `uploads/` folder (stop the API first if you like).\n"
        "The app will recreate empty uploads/, uploads/lessons, uploads/immersion on next start."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
