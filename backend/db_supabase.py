"""Small Supabase helpers for lessons and related tables (beginner-friendly)."""
from __future__ import annotations

import base64
import binascii
import math
import os
import re
import secrets
import urllib.parse
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

CLASS_ATTENDANCE_DEFAULT_RADIUS_M = 150

JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

from grading_shs import (
    compute_weighted_final,
    format_weights_label,
    resolve_component_scores,
    shs_component_weights,
)
from supabase_client import supabase

ZERO_UUID = "00000000-0000-0000-0000-000000000000"

# profiles table column (renamed from id_number)
PROFILE_LRN_COLUMN = "lrn"


def profile_lrn_from_row(profile: dict[str, Any] | None) -> str:
    """LRN / school ID from a profiles row (supports legacy id_number key in memory)."""
    if not profile:
        return ""
    return str(profile.get(PROFILE_LRN_COLUMN) or profile.get("id_number") or "").strip()


def normalize_profile_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Ensure API consumers still receive id_number alongside lrn."""
    if not row:
        return None
    out = dict(row)
    lrn = profile_lrn_from_row(out)
    if lrn:
        out[PROFILE_LRN_COLUMN] = lrn
        out["id_number"] = lrn
    return out


def _sb():
    if supabase is None:
        raise RuntimeError("Supabase is not configured (check SUPABASE_URL and keys in .env).")
    return supabase


def get_profile_by_credentials(id_number: str, email: str) -> dict[str, Any] | None:
    """Get a user profile by ID number and email."""
    try:
        response = (
            _sb()
            .table("profiles")
            .select("*")
            .eq(PROFILE_LRN_COLUMN, id_number)
            .eq("email", email.lower().strip())
            .single()
            .execute()
        )
        return normalize_profile_row(response.data)
    except Exception as e:
        print(f"Error getting profile by credentials: {e}")
        return None


def get_profile_by_email(email: str) -> dict[str, Any] | None:
    """Get a user profile by email address."""
    try:
        response = (
            _sb()
            .table("profiles")
            .select("*")
            .eq("email", email.lower().strip())
            .single()
            .execute()
        )
        return normalize_profile_row(response.data)
    except Exception as e:
        print(f"Error getting profile by email: {e}")
        return None


def get_profile_by_id_number(id_number: str) -> dict[str, Any] | None:
    """Profile row for school LRN / ID (used for attendance_logs.student_id FK)."""
    try:
        res = (
            _sb()
            .table("profiles")
            .select("*")
            .eq(PROFILE_LRN_COLUMN, id_number.strip())
            .limit(1)
            .execute()
        )
        return normalize_profile_row(res.data[0] if res.data else None)
    except Exception as e:
        print(f"Error get_profile_by_id_number: {e}")
        return None


def profile_uuid_for_id_number(id_number: str) -> str | None:
    p = get_profile_by_id_number(id_number)
    if not p or not p.get("id"):
        return None
    return str(p["id"])


def profile_display_name(profile: dict[str, Any] | None) -> str:
    """First [Middle] Last [Suffix]."""
    if not profile:
        return "User"
    fn = (profile.get("first_name") or "").strip()
    ln = (profile.get("last_name") or "").strip()
    mn = (profile.get("middle_name") or "").strip()
    if fn and ln:
        parts = [fn]
        if mn:
            parts.append(mn)
        parts.append(ln)
        suffix = (profile.get("name_suffix") or "").strip()
        name = " ".join(parts)
        return f"{name} {suffix}".strip() if suffix else name
    return profile_lrn_from_row(profile) or "User"


_PROFILE_NAME_COLS = "id, last_name, first_name, middle_name, name_suffix, lrn, role"


def serialize_public_profile(prof: dict[str, Any] | None) -> dict[str, Any]:
    """API/session shape without full_name."""
    if not prof:
        return {}
    p = normalize_profile_row(dict(prof)) or {}
    p.pop("password", None)
    lrn = profile_lrn_from_row(p)
    return {
        "id": p.get("id"),
        "display_name": profile_display_name(p),
        "first_name": (p.get("first_name") or "").strip(),
        "last_name": (p.get("last_name") or "").strip(),
        "middle_name": (p.get("middle_name") or "").strip(),
        "name_suffix": (p.get("name_suffix") or "").strip(),
        "lrn": lrn,
        "id_number": lrn,
        "email": p.get("email"),
        "role": p.get("role"),
        "grade_level": p.get("grade_level"),
        "strand": p.get("strand"),
        "bio": p.get("bio") or "",
        "phone": p.get("phone") or "",
        "section": p.get("section") or "",
        "dob": (str(p.get("dob")) if p.get("dob") else ""),
        "address": p.get("address") or "",
        "avatar_data": p.get("avatar_data") or "",
        "adviser_id_number": p.get("adviser_id_number") or "",
        "created_at": p.get("created_at"),
    }


def insert_profile(
    id_number: str,
    email: str,
    password: str,
    role: str = "student",
    auth_user_id: str | None = None,
    *,
    last_name: str | None = None,
    first_name: str | None = None,
    middle_name: str | None = None,
    name_suffix: str | None = None,
    grade_level: str | None = None,
    strand: str | None = None,
    section: str | None = None,
) -> dict[str, Any]:
    if not last_name or not first_name:
        raise ValueError("last_name and first_name are required.")
    row = {
        PROFILE_LRN_COLUMN: id_number.strip(),
        "email": email.lower().strip(),
        "password": password,
        "role": role,
        "last_name": last_name.strip(),
        "first_name": first_name.strip(),
    }
    if middle_name is not None and str(middle_name).strip():
        row["middle_name"] = str(middle_name).strip()
    if name_suffix is not None and str(name_suffix).strip():
        row["name_suffix"] = str(name_suffix).strip()
    if grade_level is not None:
        row["grade_level"] = grade_level
    if strand is not None:
        row["strand"] = strand
    if section is not None and str(section).strip():
        row["section"] = str(section).strip()

    # If auth_user_id is provided, use it as the profile ID
    if auth_user_id:
        row["id"] = auth_user_id

    res = _sb().table("profiles").insert(row).execute()
    inserted = res.data[0] if res.data else row
    return normalize_profile_row(inserted) or inserted


def list_profiles() -> list[dict[str, Any]]:
    res = _sb().table("profiles").select("*").order("created_at", desc=True).execute()
    return res.data or []


def get_all_profiles() -> list[dict[str, Any]]:
    """Get all profiles without passwords."""
    res = _sb().table("profiles").select("*").order("created_at", desc=True).execute()
    profiles = res.data or []
    out: list[dict[str, Any]] = []
    for profile in profiles:
        row = normalize_profile_row(dict(profile)) or {}
        row.pop("password", None)
        row.pop("full_name", None)
        row["display_name"] = profile_display_name(row)
        out.append(row)
    return out


# Fields the signed-in user can edit on their own profile page. "section" is
# deliberately excluded — it's a fixed, admin-managed value (see sections.sql
# / admin_set_student_section), not something a student can self-report.
PROFILE_EXTRA_FIELDS = ("bio", "phone", "dob", "address", "avatar_data")


def update_profile_extras(id_number: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    """Update the editable profile fields on a profile row.

    Only the keys in `PROFILE_EXTRA_FIELDS` are accepted. Empty strings are
    stored as NULL so the row stays clean. Returns the updated row or None.
    """
    cleaned: dict[str, Any] = {}
    for key in PROFILE_EXTRA_FIELDS:
        if not fields or key not in fields:
            continue
        value = fields[key]
        if value is None:
            cleaned[key] = None
        elif isinstance(value, str):
            stripped = value.strip()
            cleaned[key] = stripped if stripped else None
        else:
            cleaned[key] = value
    if not cleaned:
        return get_profile_by_id_number(id_number)
    res = (
        _sb()
        .table("profiles")
        .update(cleaned)
        .eq(PROFILE_LRN_COLUMN, id_number.strip())
        .execute()
    )
    updated = res.data[0] if res.data else None
    return normalize_profile_row(updated)


def insert_lesson(
    filename: str,
    file_type: str,
    extracted_text: str,
    storage_path: str | None,
    teacher_id_number: str | None = None,
    subject_id: str | None = None,
    file_base64: str | None = None,
    *,
    lesson_id: str | None = None,
) -> dict[str, Any]:
    print(f"INSERT LESSON CALLED:")
    print(f"  filename: {filename}")
    print(f"  file_type: {file_type}")
    print(f"  teacher_id_number: {teacher_id_number}")
    print(f"  subject_id: {subject_id}")
    print(f"  file_base64: {'yes (' + str(len(file_base64 or '')) + ' chars)' if file_base64 else 'no'}")
    print(f"  storage_path: {(storage_path or '')[:120] or 'none'}")
    print(f"  lesson_id (preset): {lesson_id or 'none'}")

    effective_storage = None if file_base64 else storage_path

    def _with_id(row: dict[str, Any]) -> dict[str, Any]:
        lid = (lesson_id or "").strip()
        if lid:
            return {**row, "id": lid}
        return row

    # Support both new and older lessons table schemas.
    # Never send storage_path when None — some DBs have no storage_path column (PostgREST PGRST204).
    attempts: list[dict[str, Any]] = []
    if file_base64:
        attempts.extend(
            [
                _with_id(
                    {
                        "filename": filename,
                        "file_type": file_type,
                        "extracted_text": extracted_text,
                        "file_base64": file_base64,
                        "is_published": False,
                        "teacher_id_number": teacher_id_number,
                        "subject_id": subject_id,
                    }
                ),
                _with_id(
                    {
                        "filename": filename,
                        "file_type": file_type,
                        "extracted_text": extracted_text,
                        "file_base64": file_base64,
                        "is_published": False,
                        "teacher_id_number": teacher_id_number,
                    }
                ),
                _with_id(
                    {
                        "filename": filename,
                        "file_type": file_type,
                        "extracted_text": extracted_text,
                        "file_base64": file_base64,
                        "is_published": False,
                    }
                ),
            ]
        )
    else:
        def _with_storage(row: dict[str, Any]) -> dict[str, Any]:
            if effective_storage is not None:
                return {**row, "storage_path": effective_storage}
            return row

        # Every fallback attempt must keep storage_path when saving to disk (Phase A).
        disk_rows = [
            {
                "filename": filename,
                "file_type": file_type,
                "extracted_text": extracted_text,
                "is_published": False,
                "teacher_id_number": teacher_id_number,
                "subject_id": subject_id,
            },
            {
                "filename": filename,
                "file_type": file_type,
                "extracted_text": extracted_text,
                "is_published": False,
                "teacher_id_number": teacher_id_number,
            },
            {
                "filename": filename,
                "file_type": file_type,
                "extracted_text": extracted_text,
                "is_published": False,
            },
            {
                "filename": filename,
                "extracted_text": extracted_text,
                "is_published": False,
            },
        ]
        attempts.extend(_with_id(_with_storage(r)) for r in disk_rows)
    last_error: Exception | None = None
    res = None
    for i, lesson_row in enumerate(attempts):
        try:
            log_row = {
                k: (f"<{len(str(v))} chars>" if k == "file_base64" and v else v)
                for k, v in lesson_row.items()
            }
            print(f"  Attempt {i+1}: inserting row (summary): {log_row}")
            res = _sb().table("lessons").insert(lesson_row).execute()
            print(f"  Insert lesson response: {res.data}")
            break
        except Exception as e:
            print(f"  Attempt {i+1} failed: {e}")
            last_error = e
    if res is None:
        if file_base64:
            cause = str(last_error).strip() if last_error else "unknown error"
            if len(cause) > 800:
                cause = cause[:800] + "…"
            raise RuntimeError(
                "Cannot save the lesson file in the database. "
                f"Details: {cause} — "
                "Confirm: (1) SUPABASE_URL in backend/.env is the same project where you ran lessons_file_base64.sql, "
                "(2) backend uses SUPABASE_SERVICE_ROLE_KEY (not the anon key) so RLS does not block inserts, "
                "(3) try a smaller PDF if the error mentions size, payload, or 413. "
                "See the API terminal for the full 'Attempt N failed' line."
            ) from last_error
        if last_error is not None:
            raise last_error
        raise RuntimeError("Failed to insert lesson.")
    lesson = res.data[0]
    lid = lesson["id"]
    print(f"  Lesson inserted with ID: {lid}")
    if subject_id:
        try:
            update_lesson_subject(str(lid), str(subject_id))
            lesson["subject_id"] = subject_id
        except Exception as link_err:
            print(f"  post-insert subject link failed: {link_err}")
            raise RuntimeError(
                "Lesson was saved but could not be linked to the subject. "
                "Run backend/migrations/lessons_subject_id.sql in Supabase, then try again."
            ) from link_err
    _sb().table("lesson_content").insert({"lesson_id": lid, "reviewer": None, "quiz": [], "activities": None}).execute()
    return lesson


def get_lesson_row(lesson_id: str) -> dict[str, Any] | None:
    res = _sb().table("lessons").select("*").eq("id", lesson_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_content_row(lesson_id: str) -> dict[str, Any] | None:
    res = _sb().table("lesson_content").select("*").eq("lesson_id", lesson_id).limit(1).execute()
    return res.data[0] if res.data else None


def list_lessons_with_content() -> list[dict[str, Any]]:
    res = (
        _sb()
        .table("lessons")
        .select("id, filename, is_published, created_at, lesson_content(reviewer, quiz, activities)")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def list_teacher_lessons(teacher_id_number: str) -> list[dict[str, Any]]:
    # Fall back to the original SELECT if the schema doesn't have subject_id yet.
    selects = [
        "id, filename, file_type, is_published, created_at, teacher_id_number, subject_id, lesson_content(reviewer, quiz, activities)",
        "id, filename, file_type, is_published, created_at, teacher_id_number, lesson_content(reviewer, quiz, activities)",
    ]
    last_error: Exception | None = None
    for sel in selects:
        try:
            res = (
                _sb()
                .table("lessons")
                .select(sel)
                .eq("teacher_id_number", teacher_id_number)
                .order("created_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            last_error = e
            print(f"list_teacher_lessons select '{sel}': {e}")
    if last_error is not None:
        raise last_error
    return []


def list_all_lessons() -> list[dict[str, Any]]:
    """All lesson uploads (admin dashboard, files table)."""
    selects = [
        "id, filename, file_type, is_published, created_at, teacher_id_number, subject_id, lesson_content(reviewer, quiz, activities)",
        "id, filename, file_type, is_published, created_at, teacher_id_number, lesson_content(reviewer, quiz, activities)",
    ]
    last_error: Exception | None = None
    for sel in selects:
        try:
            res = (
                _sb()
                .table("lessons")
                .select(sel)
                .order("created_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            last_error = e
            print(f"list_all_lessons select '{sel}': {e}")
    if last_error is not None:
        raise last_error
    return []


def count_lessons_total() -> int:
    try:
        res = _sb().table("lessons").select("*", count="exact", head=True).execute()
        n = getattr(res, "count", None)
        if n is not None:
            return int(n)
    except Exception as e:
        print(f"count_lessons_total: {e}")
    try:
        return len(list_all_lessons())
    except Exception:
        return 0


def _profile_uuid_to_id_number() -> dict[str, str]:
    m: dict[str, str] = {}
    for p in get_all_profiles():
        pid = p.get("id")
        num = profile_lrn_from_row(p)
        if pid and num:
            m[str(pid)] = str(num).strip()
    return m


def distinct_active_id_numbers_today_utc() -> int:
    """Distinct students/teachers (by school id_number when mappable) active today (UTC)."""
    from datetime import datetime, timezone

    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    iso = start.isoformat()
    keys: set[str] = set()
    uuid_map = _profile_uuid_to_id_number()

    def add_row_student_keys(r: dict[str, Any]) -> None:
        num = r.get("student_id_number")
        if num:
            keys.add(str(num).strip())
        pid = r.get("student_id")
        if pid:
            ps = str(pid)
            if ps in uuid_map and uuid_map[ps]:
                keys.add(uuid_map[ps])
            else:
                keys.add(f"uuid:{ps}")

    def pull_table(table: str, time_col: str) -> None:
        for sel in ("student_id, student_id_number", "student_id", "student_id_number"):
            try:
                res = _sb().table(table).select(sel).gte(time_col, iso).execute()
                for r in res.data or []:
                    add_row_student_keys(r)
                return
            except Exception as e:
                print(f"admin stats active_users_today: {table}.{time_col} select {sel}: {e}")

    pull_table("journals", "submitted_at")
    pull_table("journals", "created_at")
    pull_table("quiz_attempts", "submitted_at")
    pull_table("quiz_attempts", "created_at")
    for col in ("created_at", "time_in"):
        pull_table("attendance_logs", col)

    try:
        res = _sb().table("lessons").select("teacher_id_number, teacher_id").gte("created_at", iso).execute()
        for r in res.data or []:
            tidn = r.get("teacher_id_number")
            if tidn:
                keys.add(str(tidn).strip())
            tid = r.get("teacher_id")
            if tid and str(tid) in uuid_map and uuid_map[str(tid)]:
                keys.add(uuid_map[str(tid)])
    except Exception as e:
        print(f"admin stats active_users_today: skip lessons: {e}")

    return len(keys)


def count_lessons_with_ai_content() -> int:
    """Lessons whose lesson_content has reviewer text, quiz items, or activities."""
    n = 0
    for row in list_all_lessons():
        nested = row.get("lesson_content")
        if isinstance(nested, list):
            lc: dict[str, Any] = nested[0] if nested else {}
        else:
            lc = nested if isinstance(nested, dict) else {}
        reviewer = lc.get("reviewer")
        if reviewer is not None and str(reviewer).strip():
            n += 1
            continue
        quiz = lc.get("quiz") or []
        if isinstance(quiz, list) and len(quiz) > 0:
            n += 1
            continue
        acts = lc.get("activities")
        if acts not in (None, "", [], {}):
            if isinstance(acts, list) and len(acts) == 0:
                pass
            else:
                n += 1
    return n


def list_all_attendance_logs(limit: int = 200) -> list[dict[str, Any]]:
    """All immersion / attendance rows for admin view (recent first)."""
    profiles = get_all_profiles()
    by_uuid = {str(p["id"]): p for p in profiles if p.get("id")}
    by_idnum = {
        profile_lrn_from_row(p): p for p in profiles if profile_lrn_from_row(p)
    }

    res = None
    for order_col in ("logged_at", "time_in", "created_at"):
        try:
            res = _sb().table("attendance_logs").select("*").order(order_col, desc=True).limit(limit).execute()
            break
        except Exception as e:
            print(f"list_all_attendance_logs order {order_col}: {e}")
    if res is None:
        return []

    rows = res.data or []
    out: list[dict[str, Any]] = []
    for r in rows:
        pid = r.get("student_id")
        idn = (r.get("student_id_number") or "").strip()
        name = ""
        if pid and str(pid) in by_uuid:
            name = profile_display_name(by_uuid[str(pid)])
        if not name or name == "User":
            if idn:
                p = by_idnum.get(idn) or get_profile_by_id_number(idn)
                name = profile_display_name(p) if p else idn
        student_display = name.strip() if name.strip() and name != "User" else (idn or "—")

        day = r.get("date")
        if day:
            day_str = str(day)[:10]
        else:
            tin = r.get("time_in") or r.get("logged_at") or r.get("created_at") or ""
            day_str = str(tin)[:10] if tin else "—"

        status = str(r.get("status") or "").strip() or "—"
        note_parts: list[str] = []
        if r.get("total_hours") is not None and r.get("total_hours") != "":
            try:
                note_parts.append(f'{float(r["total_hours"]):.2f}h')
            except (TypeError, ValueError):
                note_parts.append(str(r.get("total_hours")))
        if r.get("event_type"):
            note_parts.append(str(r.get("event_type")))
        notes = " · ".join(note_parts) if note_parts else "—"

        out.append(
            {
                "student_display": student_display,
                "date_display": day_str,
                "status": status,
                "notes": notes,
                "time_in": r.get("time_in"),
                "time_out": r.get("time_out"),
            }
        )
    return out


def list_all_journals_admin(limit: int = 200) -> list[dict[str, Any]]:
    """All journal rows for admin review (recent first)."""
    profiles = get_all_profiles()
    by_uuid = {str(p["id"]): p for p in profiles if p.get("id")}
    by_idnum = {
        profile_lrn_from_row(p): p for p in profiles if profile_lrn_from_row(p)
    }

    rows: list[dict[str, Any]] = []
    for order_col in ("submitted_at", "created_at"):
        try:
            res = _sb().table("journals").select("*").order(order_col, desc=True).limit(limit).execute()
            rows = res.data or []
            if rows:
                break
        except Exception as e:
            print(f"list_all_journals_admin order {order_col}: {e}")

    out: list[dict[str, Any]] = []
    for r in rows[:limit]:
        pid = r.get("student_id")
        idn = (r.get("student_id_number") or "").strip()
        name = ""
        if pid and str(pid) in by_uuid:
            name = profile_display_name(by_uuid[str(pid)])
        if not name or name == "User":
            if idn:
                p = by_idnum.get(idn) or get_profile_by_id_number(idn)
                name = profile_display_name(p) if p else idn
        student_display = name.strip() if name.strip() and name != "User" else (idn or "—")
        body = (r.get("journal_text") or r.get("body") or "").strip()
        ts = r.get("submitted_at") or r.get("created_at") or ""
        out.append(
            {
                "student_display": student_display,
                "body": body,
                "submitted_at": ts,
            }
        )
    return out


def get_admin_recent_activity(limit: int = 12) -> list[dict[str, Any]]:
    """Lightweight merged feed from profiles + lessons (+ optional quiz attempts)."""
    items: list[dict[str, Any]] = []

    for p in get_all_profiles():
        ts = p.get("created_at")
        nm = profile_display_name(p)
        role = str(p.get("role") or "").strip().lower()
        items.append(
            {
                "kind": "profile",
                "title": f'{nm or "Account"} ({role or "user"})',
                "detail": "New account registered",
                "timestamp": ts,
            }
        )

    for row in list_all_lessons():
        ts = row.get("created_at")
        fn = str(row.get("filename") or "Lesson file").strip()
        tid = str(row.get("teacher_id_number") or "").strip() or "Teacher"
        items.append(
            {
                "kind": "lesson",
                "title": f"Uploaded: {fn}",
                "detail": f"Teacher ID: {tid}",
                "timestamp": ts,
            }
        )

    try:
        by_uuid = {str(p["id"]): p for p in get_all_profiles() if p.get("id")}
        res = (
            _sb().table("quiz_attempts").select("*").order("created_at", desc=True).limit(40).execute()
        )
        attempts = res.data or []
        for qa in attempts:
            ts = qa.get("created_at") or qa.get("submitted_at") or ""
            sid = qa.get("student_id")
            idn = (qa.get("student_id_number") or "").strip()
            who = ""
            if sid and str(sid) in by_uuid:
                who = profile_display_name(by_uuid[str(sid)])
            if not who and idn:
                who = idn
            score = qa.get("score")
            total = qa.get("total_questions")
            detail = "Quiz attempt"
            if score is not None and total is not None:
                detail = f"Quiz score {score}/{total}"
            items.append(
                {
                    "kind": "quiz",
                    "title": f"{who or 'Student'} submitted a quiz",
                    "detail": detail,
                    "timestamp": ts,
                }
            )
    except Exception as e:
        print(f"get_admin_recent_activity quiz_attempts: {e}")

    def ts_key(it: dict[str, Any]) -> str:
        return str(it.get("timestamp") or "")

    items.sort(key=ts_key, reverse=True)
    return items[:limit]


def get_admin_dashboard_stats() -> dict[str, Any]:
    profiles = get_all_profiles()

    def rrole(p: dict[str, Any]) -> str:
        return str(p.get("role") or "").strip().lower()

    total_students = sum(1 for p in profiles if rrole(p) == "student")
    total_teachers = sum(1 for p in profiles if rrole(p) == "teacher")

    lessons_rows = list_all_lessons()
    lessons_published = sum(1 for row in lessons_rows if row.get("is_published"))

    return {
        "total_accounts": len(profiles),
        "total_students": total_students,
        "total_teachers": total_teachers,
        "uploaded_files": count_lessons_total(),
        "lessons_total": count_lessons_total(),
        "lessons_published": lessons_published,
        "lessons_with_ai": count_lessons_with_ai_content(),
        "active_users_today": distinct_active_id_numbers_today_utc(),
    }


def set_reviewer(lesson_id: str, reviewer: str) -> None:
    _sb().table("lesson_content").update({"reviewer": reviewer}).eq("lesson_id", lesson_id).execute()


def set_activities(lesson_id: str, activities: list[Any]) -> None:
    _sb().table("lesson_content").update({"activities": activities}).eq("lesson_id", lesson_id).execute()


def set_quiz(lesson_id: str, quiz: list[Any]) -> None:
    _sb().table("lesson_content").update({"quiz": quiz}).eq("lesson_id", lesson_id).execute()


def set_battle_questions(lesson_id: str, questions: list[Any]) -> None:
    _sb().table("lesson_content").update({"battle_questions": questions}).eq("lesson_id", lesson_id).execute()


def append_quiz_question(lesson_id: str, question: dict[str, Any]) -> list[Any]:
    row = get_content_row(lesson_id)
    quiz = []
    if row and row.get("quiz") is not None:
        quiz = row["quiz"] if isinstance(row["quiz"], list) else []
    quiz = list(quiz)
    quiz.append(question)
    _sb().table("lesson_content").update({"quiz": quiz}).eq("lesson_id", lesson_id).execute()
    return quiz


def unpublish_all_lessons() -> None:
    _sb().table("lessons").update({"is_published": False}).neq("id", ZERO_UUID).execute()


def publish_lesson(lesson_id: str) -> None:
    _sb().table("lessons").update({"is_published": True}).eq("id", lesson_id).execute()


def unpublish_lesson(lesson_id: str) -> None:
    _sb().table("lessons").update({"is_published": False}).eq("id", lesson_id).execute()


def list_published_lessons_with_content() -> list[dict[str, Any]]:
    lesson_cols = (
        "id, filename, file_type, extracted_text, is_published, "
        "created_at, teacher_id_number, subject_id, lesson_content(*)"
    )
    res = (
        _sb()
        .table("lessons")
        .select(lesson_cols)
        .eq("is_published", True)
        .order("created_at", desc=True)
        .execute()
    )
    # Build a lookup of subjects so we can attach name/color/description to each lesson.
    subjects_by_id = {str(s.get("id")): s for s in list_subjects()}

    lessons = []
    for row in res.data or []:
        nested = row.get("lesson_content")
        if isinstance(nested, list):
            lc = nested[0] if nested else {}
        else:
            lc = nested or {}

        # Process reviewer (single Markdown string; join legacy list rows)
        reviewer = lc.get("reviewer")
        if isinstance(reviewer, list):
            reviewer_str = "\n\n".join(str(x).strip() for x in reviewer if str(x).strip())
        elif isinstance(reviewer, str):
            reviewer_str = reviewer
        else:
            reviewer_str = ""

        # Process quiz and activities
        quiz = lc.get("quiz") or []
        if not isinstance(quiz, list):
            quiz = []

        activities = lc.get("activities") or []
        if not isinstance(activities, list):
            activities = []

        clean = {k: v for k, v in row.items() if k != "lesson_content"}
        sid = clean.get("subject_id")
        sid_key = str(sid) if sid is not None else None
        subject = subjects_by_id.get(sid_key) if sid_key else None

        lessons.append({
            "file_id": clean["id"],
            "filename": clean.get("filename") or "",
            "file_type": clean.get("file_type") or "",
            "created_at": clean.get("created_at"),
            "reviewer": reviewer_str,
            "quiz": quiz,
            "activities": activities,
            "subject_id": sid_key,
            "subject_name": (subject or {}).get("name") or "",
            "subject_color": (subject or {}).get("color") or "",
            "teacher_id_number": (clean.get("teacher_id_number") or "").strip(),
        })

    return lessons


def _serialize_subject_row(row: dict[str, Any]) -> dict[str, Any]:
    deped = (row.get("deped_category") or "academic_standard").strip().lower()
    if deped not in ("core", "academic_standard", "academic_specialized"):
        deped = "academic_standard"
    return {
        "id": str(row.get("id")) if row.get("id") is not None else None,
        "name": (row.get("name") or "").strip(),
        "description": row.get("description") or "",
        "color": row.get("color") or "",
        "created_at": row.get("created_at"),
        "join_code": (row.get("join_code") or "").strip() or None,
        "created_by_teacher_id_number": (row.get("created_by_teacher_id_number") or "").strip() or None,
        "deped_category": deped,
    }


def _join_code_prefix_from_name(name: str) -> str:
    letters = re.sub(r"[^A-Za-z]", "", name or "")[:3].upper()
    return letters if len(letters) >= 2 else "CLS"


def _generate_join_code_candidate(name: str) -> str:
    prefix = _join_code_prefix_from_name(name)
    suffix = "".join(secrets.choice(JOIN_CODE_CHARS) for _ in range(4))
    return f"{prefix}-{suffix}".upper()


def _allocate_unique_join_code(name: str, max_attempts: int = 12) -> str:
    for _ in range(max_attempts):
        code = _generate_join_code_candidate(name)
        if not get_subject_by_join_code(code):
            return code
    raise RuntimeError("Could not generate a unique join code. Please try again.")


def get_subject_by_join_code(join_code: str) -> dict[str, Any] | None:
    code = (join_code or "").strip().upper()
    if not code:
        return None
    try:
        res = (
            _sb()
            .table("subjects")
            .select(
                "id, name, description, color, created_at, join_code, "
                "created_by_teacher_id_number, deped_category"
            )
            .eq("join_code", code)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return _serialize_subject_row(rows[0]) if rows else None
    except Exception as e:
        print(f"get_subject_by_join_code: {e}")
        return None


def get_subject_row(subject_id: str) -> dict[str, Any] | None:
    if not subject_id:
        return None
    try:
        res = (
            _sb()
            .table("subjects")
            .select(
                "id, name, description, color, created_at, join_code, "
                "created_by_teacher_id_number, deped_category"
            )
            .eq("id", subject_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return _serialize_subject_row(rows[0]) if rows else None
    except Exception as e:
        print(f"get_subject_row: {e}")
        return None


def list_subjects() -> list[dict[str, Any]]:
    """All subject rows (used by Student My Lesson + Teacher upload UI)."""
    try:
        res = (
            _sb()
            .table("subjects")
            .select(
                "id, name, description, color, created_at, join_code, "
                "created_by_teacher_id_number, deped_category"
            )
            .order("name")
            .execute()
        )
        return [_serialize_subject_row(r) for r in (res.data or [])]
    except Exception as e:
        print(f"list_subjects: {e}")
        return []


def list_subjects_for_teacher_owner(teacher_id_number: str) -> list[dict[str, Any]]:
    """Subjects owned by this teacher, plus legacy rows they have lessons under (no owner yet)."""
    tid = (teacher_id_number or "").strip()
    if not tid:
        return []
    owned: dict[str, dict[str, Any]] = {}
    for s in list_subjects():
        owner = (s.get("created_by_teacher_id_number") or "").strip()
        if owner == tid:
            owned[str(s["id"])] = s
    try:
        res = (
            _sb()
            .table("lessons")
            .select("subject_id")
            .eq("teacher_id_number", tid)
            .execute()
        )
        legacy_ids = {
            str(r["subject_id"])
            for r in (res.data or [])
            if r.get("subject_id") is not None
        }
    except Exception as e:
        print(f"list_subjects_for_teacher_owner lessons: {e}")
        legacy_ids = set()
    for s in list_subjects():
        sid = str(s.get("id") or "")
        if not sid or sid in owned:
            continue
        owner = (s.get("created_by_teacher_id_number") or "").strip()
        if not owner and sid in legacy_ids:
            owned[sid] = s
    return sorted(owned.values(), key=lambda x: (x.get("name") or "").lower())


def create_subject(
    name: str,
    description: str | None = None,
    color: str | None = None,
    created_by_teacher_id_number: str | None = None,
    deped_category: str | None = None,
) -> dict[str, Any]:
    """Insert a new subject row and return it."""
    payload: dict[str, Any] = {"name": (name or "").strip()}
    if not payload["name"]:
        raise ValueError("Subject name is required.")
    if description is not None:
        payload["description"] = str(description).strip() or None
    if color is not None:
        payload["color"] = str(color).strip() or None
    owner = (created_by_teacher_id_number or "").strip()
    if owner:
        payload["created_by_teacher_id_number"] = owner
        payload["join_code"] = _allocate_unique_join_code(payload["name"])
    if deped_category is not None:
        cat = str(deped_category).strip().lower()
        if cat in ("core", "academic_standard", "academic_specialized"):
            payload["deped_category"] = cat
    try:
        res = _sb().table("subjects").insert(payload).execute()
        rows = res.data or []
        return _serialize_subject_row(rows[0]) if rows else _serialize_subject_row(payload)
    except Exception as e:
        print(f"create_subject: {e}")
        raise


def regenerate_subject_join_code(subject_id: str, teacher_id_number: str) -> dict[str, Any]:
    """Issue a new join code for a subject; existing enrollments are unchanged."""
    tid = (teacher_id_number or "").strip()
    if not tid:
        raise ValueError("teacher_id_number is required.")
    subject = get_subject_row(subject_id)
    if not subject:
        raise LookupError("Subject not found.")
    owner = (subject.get("created_by_teacher_id_number") or "").strip()
    if owner and owner != tid:
        raise PermissionError("Only the subject owner can regenerate the join code.")
    new_code = _allocate_unique_join_code(subject.get("name") or "CLS")
    try:
        res = (
            _sb()
            .table("subjects")
            .update({"join_code": new_code})
            .eq("id", subject_id)
            .execute()
        )
        rows = res.data or []
        if rows:
            return _serialize_subject_row(rows[0])
        subject["join_code"] = new_code
        if not owner:
            _sb().table("subjects").update({"created_by_teacher_id_number": tid}).eq("id", subject_id).execute()
            subject["created_by_teacher_id_number"] = tid
        return subject
    except Exception as e:
        print(f"regenerate_subject_join_code: {e}")
        raise


def count_published_lessons_by_subject() -> dict[str, int]:
    """Return {subject_id: published_lesson_count} for badge counts on Subject cards."""
    counts: dict[str, int] = {}
    try:
        res = (
            _sb()
            .table("lessons")
            .select("subject_id")
            .eq("is_published", True)
            .execute()
        )
        for r in res.data or []:
            sid = r.get("subject_id")
            if sid is None:
                continue
            key = str(sid)
            counts[key] = counts.get(key, 0) + 1
    except Exception as e:
        print(f"count_published_lessons_by_subject: {e}")
    return counts


def count_lessons_by_subject() -> dict[str, int]:
    """Return {subject_id: total_lesson_count} regardless of publish status."""
    counts: dict[str, int] = {}
    try:
        res = _sb().table("lessons").select("subject_id").execute()
        for r in res.data or []:
            sid = r.get("subject_id")
            if sid is None:
                continue
            key = str(sid)
            counts[key] = counts.get(key, 0) + 1
    except Exception as e:
        print(f"count_lessons_by_subject: {e}")
    return counts


def count_teachers_by_subject() -> dict[str, int]:
    """Return {subject_id: distinct_teacher_count} — how many teachers have at
    least one lesson under each subject."""
    teachers: dict[str, set[str]] = {}
    try:
        res = (
            _sb()
            .table("lessons")
            .select("subject_id, teacher_id_number")
            .execute()
        )
        for r in res.data or []:
            sid = r.get("subject_id")
            tid = (r.get("teacher_id_number") or "").strip()
            if sid is None or not tid:
                continue
            key = str(sid)
            teachers.setdefault(key, set()).add(tid)
    except Exception as e:
        print(f"count_teachers_by_subject: {e}")
    return {k: len(v) for k, v in teachers.items()}


def update_subject(
    subject_id: str,
    name: str | None = None,
    description: str | None = None,
    color: str | None = None,
    deped_category: str | None = None,
) -> dict[str, Any]:
    """Update one or more fields on a subject row."""
    payload: dict[str, Any] = {}
    if name is not None:
        cleaned = str(name).strip()
        if not cleaned:
            raise ValueError("Subject name cannot be empty.")
        payload["name"] = cleaned
    if description is not None:
        payload["description"] = str(description).strip() or None
    if color is not None:
        payload["color"] = str(color).strip() or None
    if deped_category is not None:
        cat = str(deped_category).strip().lower()
        if cat in ("core", "academic_standard", "academic_specialized"):
            payload["deped_category"] = cat
    if not payload:
        raise ValueError("Nothing to update.")
    try:
        res = _sb().table("subjects").update(payload).eq("id", subject_id).execute()
        rows = res.data or []
        return rows[0] if rows else payload
    except Exception as e:
        print(f"update_subject: {e}")
        raise


def delete_lesson(lesson_id: str) -> None:
    """Delete a lesson row (lesson_content and quiz_attempts cascade)."""
    try:
        _sb().table("lessons").delete().eq("id", lesson_id).execute()
    except Exception as e:
        print(f"delete_lesson: {e}")
        raise


def delete_subject(subject_id: str) -> None:
    """Delete a subject row. Caller should ensure no lessons reference it.

    To play safe, this first NULL-outs subject_id on any lesson that still
    references it (in case the FK is set to RESTRICT) and then deletes."""
    try:
        try:
            _sb().table("lessons").update({"subject_id": None}).eq("subject_id", subject_id).execute()
        except Exception as inner:
            # Non-fatal — if the FK is ON DELETE SET NULL/CASCADE, this may
            # be unnecessary. Log and proceed.
            print(f"delete_subject (null lessons.subject_id): {inner}")
        _sb().table("subjects").delete().eq("id", subject_id).execute()
    except Exception as e:
        print(f"delete_subject: {e}")
        raise


def update_lesson_subject(lesson_id: str, subject_id: str | None) -> None:
    """Reassign the subject of a lesson (teacher edit)."""
    try:
        _sb().table("lessons").update({"subject_id": subject_id}).eq("id", lesson_id).execute()
    except Exception as e:
        print(f"update_lesson_subject: {e}")
        raise


def update_lesson_storage_path(lesson_id: str, storage_path: str) -> None:
    """Persist where the uploaded lesson file is stored on disk."""
    try:
        _sb().table("lessons").update({"storage_path": storage_path}).eq("id", lesson_id).execute()
    except Exception as e:
        print(f"update_lesson_storage_path: {e}")
        raise


def update_lesson_extracted_text(lesson_id: str, extracted_text: str) -> None:
    """Save text extracted from the uploaded file (used for AI generation)."""
    try:
        snippet = str(extracted_text or "")[:3000]
        _sb().table("lessons").update({"extracted_text": snippet}).eq("id", lesson_id).execute()
    except Exception as e:
        print(f"update_lesson_extracted_text: {e}")
        raise


def get_published_lesson_with_content() -> tuple[dict[str, Any], dict[str, Any]] | None:
    lesson_cols = (
        "id, filename, file_type, extracted_text, is_published, "
        "created_at, teacher_id_number, subject_id, lesson_content(*)"
    )
    res = (
        _sb()
        .table("lessons")
        .select(lesson_cols)
        .eq("is_published", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    nested = row.get("lesson_content")
    if isinstance(nested, list):
        lc = nested[0] if nested else {}
    else:
        lc = nested or {}
    clean = {k: v for k, v in row.items() if k != "lesson_content"}
    return clean, lc


def insert_quiz_attempt(
    lesson_id: str,
    score: int,
    total_questions: int,
    answers: Any,
    student_id_number: str | None = None,
) -> dict[str, Any]:
    base = {
        "lesson_id": lesson_id,
        "score": score,
        "total_questions": total_questions,
        "answers": answers,
    }
    now_iso = datetime.now(timezone.utc).isoformat()
    tries: list[dict[str, Any]] = []
    if student_id_number:
        pid = profile_uuid_for_id_number(student_id_number.strip())
        if pid:
            tries.append({**base, "student_id": pid, "submitted_at": now_iso})
            tries.append({**base, "student_id": pid})
            tries.append({**base, "student_id": pid, "student_id_number": student_id_number.strip()})
        tries.append({**base, "student_id_number": student_id_number.strip()})
    tries.append({**base, "submitted_at": now_iso})
    tries.append(base)

    last_err: Exception | None = None
    for row in tries:
        try:
            res = _sb().table("quiz_attempts").insert(row).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("insert_quiz_attempt failed")


def _leaderboard_tagline(entry: dict[str, Any]) -> str:
    rank = int(entry.get("rank") or 99)
    pct = float(entry.get("progress_pct") or 0)
    att = int(entry.get("quiz_attempts") or 0)
    if rank == 1:
        return "Leading the class"
    if pct >= 85:
        return "Strong quiz accuracy"
    if att >= 5:
        return "Consistent participation"
    if att >= 2:
        return "Active on quizzes"
    return "On the board"


def get_learniq_leaderboard(limit: int = 100) -> dict[str, Any]:
    """Aggregate quiz_attempts by student (profiles.role = student). Sorted by total points then accuracy."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        res = _sb().table("quiz_attempts").select("*").execute()
    except Exception as e:
        print(f"get_learniq_leaderboard attempts: {e}")
        return {"updated_at": now_iso, "entries": []}

    rows = res.data or []
    agg: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"total_score": 0, "total_questions": 0, "attempts": 0, "last_ts": ""}
    )

    for r in rows:
        sid = r.get("student_id")
        if sid:
            sid = str(sid).strip()
            if not sid or sid == ZERO_UUID:
                sid = None
        if not sid:
            leg = (r.get("student_id_number") or "").strip()
            if leg:
                sid = profile_uuid_for_id_number(leg)
        if not sid:
            continue

        try:
            sc = int(float(r.get("score") or 0))
        except (TypeError, ValueError):
            sc = 0
        try:
            tq = int(float(r.get("total_questions") or 0))
        except (TypeError, ValueError):
            tq = 0

        a = agg[sid]
        a["total_score"] += sc
        a["total_questions"] += tq
        a["attempts"] += 1
        ts = str(r.get("submitted_at") or r.get("created_at") or "")
        if ts and ts > a["last_ts"]:
            a["last_ts"] = ts

    if not agg:
        return {"updated_at": now_iso, "entries": []}

    ids = list(agg.keys())
    profiles_map: dict[str, dict[str, Any]] = {}
    chunk = 80
    for i in range(0, len(ids), chunk):
        chunk_ids = ids[i : i + chunk]
        try:
            pres = (
                _sb()
                .table("profiles")
                .select(_PROFILE_NAME_COLS)
                .in_("id", chunk_ids)
                .execute()
            )
            for p in pres.data or []:
                profiles_map[str(p["id"])] = p
        except Exception as e:
            print(f"get_learniq_leaderboard profiles: {e}")

    entries: list[dict[str, Any]] = []
    for sid, v in agg.items():
        prof = profiles_map.get(sid)
        if not prof:
            continue
        role = str(prof.get("role") or "student").strip().lower()
        if role != "student":
            continue
        tq = int(v["total_questions"])
        pct = round(100.0 * float(v["total_score"]) / tq, 1) if tq > 0 else 0.0
        entries.append(
            {
                "student_id": sid,
                "display_name": profile_display_name(prof),
                "id_number": profile_lrn_from_row(prof),
                "lrn": profile_lrn_from_row(prof),
                "total_points": int(v["total_score"]),
                "quiz_attempts": int(v["attempts"]),
                "progress_pct": pct,
                "last_activity": v["last_ts"] or None,
            }
        )

    entries.sort(
        key=lambda x: (-x["total_points"], -x["progress_pct"], -x["quiz_attempts"]),
    )

    out: list[dict[str, Any]] = []
    for i, e in enumerate(entries[:limit], 1):
        row = {**e, "rank": i}
        row["tagline"] = _leaderboard_tagline(row)
        out.append(row)

    return {"updated_at": now_iso, "entries": out}


def count_published_lessons() -> int:
    try:
        res = (
            _sb()
            .table("lessons")
            .select("*", count="exact", head=True)
            .eq("is_published", True)
            .execute()
        )
        n = getattr(res, "count", None)
        if n is not None:
            return int(n)
    except Exception as e:
        print(f"count_published_lessons: {e}")
    return 0


def _dt_from_lesson_created(created_at: Any) -> datetime | None:
    if not created_at:
        return None
    raw = str(created_at).strip()
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def _quiz_attempt_ts_utc(row: dict[str, Any]) -> datetime | None:
    raw = row.get("submitted_at") or row.get("created_at")
    if raw is None:
        return None
    return _dt_from_lesson_created(raw)


def _profile_uuid_from_quiz_attempt_row(row: dict[str, Any]) -> str | None:
    pid = row.get("student_id")
    if pid:
        ps = str(pid).strip()
        if ps and ps != ZERO_UUID:
            return ps
    leg = (row.get("student_id_number") or "").strip()
    if leg:
        u = profile_uuid_for_id_number(leg)
        if u:
            return str(u).strip()
    return None


def get_teacher_learniq_dashboard_stats(teacher_id_number: str) -> dict[str, Any]:
    """Totals for Teacher LearnIQ: uploads, uploads this calendar month (UTC), distinct students with attempts on teacher lessons, weighted avg quiz %."""
    tid = (teacher_id_number or "").strip()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    perf_empty = {
        "top_name": None,
        "top_id_number": None,
        "top_pct": None,
        "needs_attention_count": 0,
        "participation_pct": None,
        "scope_student_count": 0,
    }

    base: dict[str, Any] = {
        "updated_at": now_iso,
        "lessons_uploaded": 0,
        "lessons_this_month": 0,
        "lessons_uploaded_note": "No lessons uploaded yet",
        "active_students": 0,
        "active_students_note": "Students who took quizzes on your lessons",
        "avg_quiz_score_pct": None,
        "avg_quiz_note": "No quiz attempts on your lessons yet",
        "lessons_published": 0,
        "lessons_published_note": "Nothing published yet",
        "subjects_count": 0,
        "subjects_count_note": "Create a subject in My Subjects",
        "enrolled_students": 0,
        "enrolled_students_note": "Students joined your subjects",
        "draft_lessons": 0,
        "draft_lessons_note": "Not published yet",
        "publish_rate_pct": None,
        "publish_rate_note": "Published vs total uploads",
        "lessons_with_ai": 0,
        "lessons_with_ai_note": "Lessons with AI reviewer or quiz",
        "quiz_attempts_total": 0,
        "quiz_attempts_this_month": 0,
        "quiz_attempts_note": "On your lesson quizzes",
        "student_performance": dict(perf_empty),
    }

    if not tid:
        return base

    try:
        lessons = list_teacher_lessons(tid)
    except Exception as e:
        print(f"get_teacher_learniq_dashboard_stats list_teacher_lessons: {e}")
        lessons = []

    lesson_ids: set[str] = set()
    this_month = 0
    for row in lessons:
        lid = row.get("id")
        if lid is not None:
            lesson_ids.add(str(lid))
        dt = _dt_from_lesson_created(row.get("created_at"))
        if dt is not None and dt >= month_start:
            this_month += 1

    n_lessons = len(lessons)
    n_published = sum(1 for row in lessons if row.get("is_published"))
    n_draft = max(0, n_lessons - n_published)
    ai_ready = 0
    for row in lessons:
        lc = row.get("lesson_content")
        if isinstance(lc, list):
            lc = lc[0] if lc else {}
        if not isinstance(lc, dict):
            lc = {}
        quiz = lc.get("quiz") or []
        if lc.get("reviewer") or (isinstance(quiz, list) and len(quiz) > 0):
            ai_ready += 1
    base["lessons_uploaded"] = n_lessons
    base["lessons_this_month"] = this_month
    base["lessons_published"] = n_published
    base["draft_lessons"] = n_draft
    base["lessons_with_ai"] = ai_ready
    if n_lessons > 0:
        base["publish_rate_pct"] = round(100.0 * float(n_published) / float(n_lessons), 1)
        base["publish_rate_note"] = f"{n_published} of {n_lessons} lessons live for students"
        base["draft_lessons_note"] = (
            "All published" if n_draft == 0 else f"{n_draft} waiting to publish"
        )
        base["lessons_with_ai_note"] = (
            f"{ai_ready} with AI content"
            if ai_ready
            else "Generate AI from a subject lesson"
        )
    else:
        base["publish_rate_note"] = "Upload from My Subjects"
        base["draft_lessons_note"] = "No drafts yet"
        base["lessons_with_ai_note"] = "No AI packs yet"
    if n_lessons == 0:
        base["lessons_uploaded_note"] = "Create a subject and upload from My Subjects"
        base["lessons_published_note"] = "Nothing published yet"
    elif this_month > 0:
        base["lessons_uploaded_note"] = f"+{this_month} uploaded this month"
        base["lessons_published_note"] = (
            f"{n_published} of {n_lessons} visible to students"
            if n_published < n_lessons
            else "All uploads are published"
        )
    else:
        base["lessons_uploaded_note"] = "No uploads this month"
        base["lessons_published_note"] = (
            f"{n_published} published" if n_published else "Publish from a subject page"
        )

    owned: list[dict[str, Any]] = []
    try:
        owned = list_subjects_for_teacher_owner(tid)
        base["subjects_count"] = len(owned)
        base["subjects_count_note"] = (
            "Open a subject to upload lessons"
            if not owned
            else f"{len(owned)} class{'es' if len(owned) != 1 else ''} you manage"
        )
        subject_ids = [str(s["id"]) for s in owned if s.get("id")]
        if subject_ids:
            try:
                eres = (
                    _sb()
                    .table("enrollments")
                    .select("student_id")
                    .in_("subject_id", subject_ids)
                    .execute()
                )
                enrolled = {
                    str(r["student_id"])
                    for r in (eres.data or [])
                    if r.get("student_id") is not None
                }
                base["enrolled_students"] = len(enrolled)
                base["enrolled_students_note"] = (
                    "Across all your subjects"
                    if enrolled
                    else "Share join codes so students can enroll"
                )
            except Exception as e:
                print(f"get_teacher_learniq_dashboard_stats enrollments: {e}")
    except Exception as e:
        print(f"get_teacher_learniq_dashboard_stats subjects: {e}")
        base["subjects_count"] = 0
        base["subjects_count_note"] = "—"

    if not lesson_ids:
        return base

    try:
        att_res = _sb().table("quiz_attempts").select("*").execute()
    except Exception as e:
        print(f"get_teacher_learniq_dashboard_stats quiz_attempts: {e}")
        return base

    rows = att_res.data or []
    relevant = [r for r in rows if str(r.get("lesson_id") or "") in lesson_ids]
    base["quiz_attempts_total"] = len(relevant)
    base["quiz_attempts_this_month"] = sum(
        1
        for r in relevant
        if (_quiz_attempt_ts_utc(r) is not None and _quiz_attempt_ts_utc(r) >= month_start)
    )
    if not relevant:
        base["quiz_attempts_note"] = "Students have not taken your quizzes yet"
    elif base["quiz_attempts_this_month"]:
        base["quiz_attempts_note"] = f"{base['quiz_attempts_this_month']} attempts this month"
    else:
        base["quiz_attempts_note"] = "No quiz attempts this month yet"
    if not relevant:
        base["active_students_note"] = "No quiz attempts yet"
        return base

    student_keys: set[str] = set()
    sum_score = 0
    sum_questions = 0

    agg_by_uuid: dict[str, dict[str, Any]] = defaultdict(lambda: {"s": 0, "q": 0, "hit_month": False})

    for r in relevant:
        pid = r.get("student_id")
        key: str | None = None
        if pid:
            ps = str(pid).strip()
            if ps and ps != ZERO_UUID:
                key = f"id:{ps}"
        if key is None:
            leg = (r.get("student_id_number") or "").strip()
            if leg:
                key = f"num:{leg}"
        if key is not None:
            student_keys.add(key)

        try:
            sc = int(float(r.get("score") or 0))
        except (TypeError, ValueError):
            sc = 0
        try:
            tq = int(float(r.get("total_questions") or 0))
        except (TypeError, ValueError):
            tq = 0
        sum_score += sc
        sum_questions += tq

        uid = _profile_uuid_from_quiz_attempt_row(r)
        if uid:
            a = agg_by_uuid[uid]
            a["s"] += sc
            a["q"] += tq
            ts = _quiz_attempt_ts_utc(r)
            if ts is not None and ts >= month_start:
                a["hit_month"] = True

    base["active_students"] = len(student_keys)
    base["active_students_note"] = (
        "With quiz attempts on your lessons" if student_keys else "No enrolled activity yet"
    )

    if sum_questions > 0:
        pct = round(100.0 * float(sum_score) / float(sum_questions), 1)
        base["avg_quiz_score_pct"] = pct
        base["avg_quiz_note"] = "Across all attempts on your lessons"
    else:
        base["avg_quiz_note"] = "No scored attempts yet"

    uuids = [u for u in agg_by_uuid if agg_by_uuid[u]["q"] > 0]
    if not uuids:
        base["student_performance"] = dict(perf_empty)
        return base

    profiles_map: dict[str, dict[str, Any]] = {}
    chunk = 80
    for i in range(0, len(uuids), chunk):
        chunk_ids = uuids[i : i + chunk]
        try:
            pres = (
                _sb().table("profiles").select(_PROFILE_NAME_COLS).in_("id", chunk_ids).execute()
            )
            for p in pres.data or []:
                profiles_map[str(p["id"])] = p
        except Exception as e:
            print(f"get_teacher_learniq_dashboard_stats profiles: {e}")

    scoped: list[dict[str, Any]] = []
    for uid in uuids:
        prof = profiles_map.get(uid)
        if not prof:
            continue
        role = str(prof.get("role") or "").strip().lower()
        if role != "student":
            continue
        raw = agg_by_uuid[uid]
        q = int(raw["q"])
        s = int(raw["s"])
        if q <= 0:
            continue
        st_pct = round(100.0 * float(s) / float(q), 1)
        scoped.append(
            {
                "id": uid,
                "display_name": profile_display_name(prof),
                "id_number": profile_lrn_from_row(prof) or None,
                "lrn": profile_lrn_from_row(prof) or None,
                "pct": st_pct,
                "score": s,
                "hit_month": bool(raw.get("hit_month")),
            }
        )

    sp = dict(perf_empty)
    if scoped:
        sp["scope_student_count"] = len(scoped)
        sp["needs_attention_count"] = sum(1 for x in scoped if x["pct"] < 70.0)
        month_active = sum(1 for x in scoped if x["hit_month"])
        sp["participation_pct"] = round(100.0 * float(month_active) / float(len(scoped)), 1)
        top = max(scoped, key=lambda x: (x["pct"], x["score"]))
        if top.get("display_name"):
            sp["top_name"] = top["display_name"]
            sp["top_id_number"] = profile_lrn_from_row(top)
            sp["top_pct"] = top["pct"]
    base["student_performance"] = sp

    return base


def get_student_learniq_dashboard_stats(student_id_number: str) -> dict[str, Any]:
    """Per-student quiz totals, weekly points, rank, leaderboard preview."""
    sid_key = (student_id_number or "").strip()
    now_iso = datetime.now(timezone.utc).isoformat()
    pid = profile_uuid_for_id_number(sid_key) if sid_key else None

    lb = get_learniq_leaderboard(200)
    entries = lb.get("entries") or []
    preview = entries[:5]

    def _base(**extra: Any) -> dict[str, Any]:
        return {
            "updated_at": now_iso,
            "total_points": 0,
            "points_this_week": 0,
            "points_week_note": "Start a quiz in My lesson to earn points",
            "quiz_attempts": 0,
            "lessons_practiced": 0,
            "progress_pct": 0.0,
            "leaderboard_rank": None,
            "ranked_student_count": len(entries),
            "rank_note": "Complete a quiz to appear on the leaderboard",
            "published_lessons_count": count_published_lessons(),
            "leaderboard_preview": preview,
            **extra,
        }

    if not pid:
        return _base()

    try:
        res = _sb().table("quiz_attempts").select("*").execute()
    except Exception as e:
        print(f"get_student_learniq_dashboard_stats attempts: {e}")
        return _base()

    cutoff_dt = datetime.now(timezone.utc) - timedelta(days=7)

    def _row_dt(val: Any) -> datetime | None:
        if not val:
            return None
        try:
            return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        except Exception:
            return None

    my_rows: list[dict[str, Any]] = []
    for r in res.data or []:
        rsid = r.get("student_id")
        if rsid:
            if str(rsid).strip() != str(pid):
                continue
        else:
            if (r.get("student_id_number") or "").strip() != sid_key:
                continue
        my_rows.append(r)

    distinct_lessons: set[str] = set()
    total_score = 0
    total_tq = 0
    attempts = 0
    points_week = 0

    for r in my_rows:
        try:
            sc = int(float(r.get("score") or 0))
        except (TypeError, ValueError):
            sc = 0
        try:
            tq = int(float(r.get("total_questions") or 0))
        except (TypeError, ValueError):
            tq = 0
        total_score += sc
        total_tq += tq
        attempts += 1
        lid = r.get("lesson_id")
        if lid:
            distinct_lessons.add(str(lid))
        ts = r.get("submitted_at") or r.get("created_at")
        tdt = _row_dt(ts)
        if tdt is not None and tdt >= cutoff_dt:
            points_week += sc

    progress_pct = round(100.0 * float(total_score) / total_tq, 1) if total_tq > 0 else 0.0

    rank = None
    for e in entries:
        if profile_lrn_from_row(e) == sid_key:
            rank = int(e.get("rank") or 0)
            break

    if rank == 1:
        rank_note = "You are #1 on the leaderboard"
    elif rank is not None and rank <= 3:
        rank_note = "Top three — great work"
    elif rank is not None and rank <= 10:
        rank_note = "Top ten in your class"
    elif rank is not None and len(entries) > 0:
        rank_note = f"Ranked {rank} of {len(entries)}"
    else:
        rank_note = "Not ranked yet — submit a scored quiz"

    if attempts == 0:
        week_note = "No quiz attempts yet"
    elif points_week > 0:
        week_note = f"+{points_week} pts in the last 7 days"
    else:
        week_note = "No points in the last 7 days"

    pub = count_published_lessons()

    return {
        "updated_at": now_iso,
        "total_points": int(total_score),
        "points_this_week": int(points_week),
        "points_week_note": week_note,
        "quiz_attempts": attempts,
        "lessons_practiced": len(distinct_lessons),
        "progress_pct": progress_pct,
        "leaderboard_rank": rank,
        "ranked_student_count": len(entries),
        "rank_note": rank_note,
        "published_lessons_count": pub,
        "leaderboard_preview": preview,
    }


def _row_dt_utc(val: Any) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(str(val).replace("Z", "+00:00"))
    except Exception:
        return None


def compute_student_learning_iq(student_id_number: str) -> dict[str, Any]:
    """
    LearnIQ Learning IQ (0–100) from real activity — not clinical IQ.
    Sources: quiz_attempts, student_learning_events (activity/reviewer).
    """
    sid_key = (student_id_number or "").strip()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    pid = profile_uuid_for_id_number(sid_key) if sid_key else None

    quiz_accuracy = 0.0
    practice_breadth = 0.0
    activity_engagement = 0.0
    study_consistency = 0.0
    quiz_attempts = 0
    lessons_practiced = 0
    activity_events = 0
    reviewer_events = 0

    active_days: set[str] = set()

    if pid or sid_key:
        try:
            res = _sb().table("quiz_attempts").select("*").execute()
            distinct_lessons: set[str] = set()
            total_score = 0
            total_tq = 0
            cutoff_14 = now - timedelta(days=14)

            for r in res.data or []:
                rsid = r.get("student_id")
                if rsid:
                    if str(rsid).strip() != str(pid):
                        continue
                else:
                    if (r.get("student_id_number") or "").strip() != sid_key:
                        continue

                try:
                    sc = int(float(r.get("score") or 0))
                except (TypeError, ValueError):
                    sc = 0
                try:
                    tq = int(float(r.get("total_questions") or 0))
                except (TypeError, ValueError):
                    tq = 0
                total_score += sc
                total_tq += tq
                quiz_attempts += 1
                lid = r.get("lesson_id")
                if lid:
                    distinct_lessons.add(str(lid))
                tdt = _row_dt_utc(r.get("submitted_at") or r.get("created_at"))
                if tdt is not None and tdt >= cutoff_14:
                    active_days.add(tdt.date().isoformat())

            lessons_practiced = len(distinct_lessons)
            quiz_accuracy = (
                round(100.0 * float(total_score) / total_tq, 1) if total_tq > 0 else 0.0
            )
        except Exception as e:
            print(f"compute_student_learning_iq quiz_attempts: {e}")

        activity_rows = list_student_learning_events(sid_key, "activity", limit=80)
        reviewer_rows = list_student_learning_events(sid_key, "reviewer", limit=80)
        activity_events = len(activity_rows)
        reviewer_events = len(reviewer_rows)
        activity_engagement = min(100.0, float(activity_events) * 20.0)

        cutoff_14 = now - timedelta(days=14)
        for ev in activity_rows + reviewer_rows:
            tdt = _row_dt_utc(ev.get("timestamp"))
            if tdt is not None and tdt >= cutoff_14:
                active_days.add(tdt.date().isoformat())

        pub = count_published_lessons()
        if pub > 0:
            practice_breadth = min(
                100.0, round(100.0 * float(lessons_practiced) / float(pub), 1)
            )
        elif lessons_practiced > 0:
            practice_breadth = 50.0

        study_consistency = min(100.0, round(100.0 * len(active_days) / 14.0, 1))

    has_data = quiz_attempts > 0 or activity_events > 0 or reviewer_events > 0

    if not has_data:
        return {
            "computed_at": now_iso,
            "is_computed": True,
            "has_data": False,
            "score": 0,
            "strengths": [],
            "improvements": [
                "Complete your first quiz",
                "Try lesson activities",
            ],
            "encouragement": (
                "Start in My lesson — take a quiz or finish an activity to build your Learning IQ."
            ),
            "components": {
                "quiz_accuracy": 0.0,
                "practice_breadth": 0.0,
                "activity_engagement": 0.0,
                "study_consistency": 0.0,
            },
            "stats": {
                "quiz_attempts": 0,
                "lessons_practiced": 0,
                "activity_events": 0,
                "reviewer_events": 0,
            },
        }

    score = int(
        round(
            0.40 * quiz_accuracy
            + 0.25 * practice_breadth
            + 0.20 * activity_engagement
            + 0.15 * study_consistency
        )
    )
    score = max(0, min(100, score))

    strengths: list[str] = []
    improvements: list[str] = []

    if quiz_accuracy >= 75.0:
        strengths.append("Strong quiz performance")
    if study_consistency >= 55.0:
        strengths.append("Consistent studying")
    if practice_breadth >= 50.0:
        strengths.append("Regular lesson practice")
    if activity_engagement >= 60.0:
        strengths.append("Active on lesson activities")

    if quiz_accuracy < 65.0 and quiz_attempts > 0:
        improvements.append("Quiz accuracy")
    if activity_engagement < 50.0:
        improvements.append("Activity completion")
    if study_consistency < 50.0:
        improvements.append("Learning consistency")
    if practice_breadth < 40.0:
        improvements.append("More lessons practiced")

    if not strengths:
        strengths.append("Getting started — keep going")
    if not improvements:
        improvements.append("Keep your momentum")

    if score >= 90:
        encouragement = (
            "Outstanding learning habits. Keep challenging yourself with new lessons and quizzes."
        )
    elif score >= 80:
        encouragement = (
            "You're showing strong learning consistency. Keep practicing activities to improve your Learning IQ."
        )
    elif score >= 70:
        encouragement = (
            "Solid progress. Focus on quizzes and activities you have not tried yet this week."
        )
    else:
        encouragement = (
            "Every quiz and activity counts. Practice a little each day to raise your Learning IQ."
        )

    return {
        "computed_at": now_iso,
        "is_computed": True,
        "has_data": True,
        "score": score,
        "strengths": strengths[:4],
        "improvements": improvements[:4],
        "encouragement": encouragement,
        "components": {
            "quiz_accuracy": quiz_accuracy,
            "practice_breadth": practice_breadth,
            "activity_engagement": round(activity_engagement, 1),
            "study_consistency": study_consistency,
        },
        "stats": {
            "quiz_attempts": quiz_attempts,
            "lessons_practiced": lessons_practiced,
            "activity_events": activity_events,
            "reviewer_events": reviewer_events,
        },
    }


def insert_attendance(student_id_number: str, event_type: str) -> dict[str, Any]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    tries: list[dict[str, Any]] = []
    if pid:
        tries.append({"student_id": pid, "event_type": event_type})
    tries.append({"student_id_number": student_id_number, "event_type": event_type})
    last_err: Exception | None = None
    for row in tries:
        try:
            res = _sb().table("attendance_logs").insert(row).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("insert_attendance failed")


def list_attendance_for_student(student_id_number: str) -> list[dict[str, Any]]:
    return list_attendance_by_student(student_id_number)


def insert_journal(student_id_number: str, body: str, entry_date: str | None = None) -> dict[str, Any]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    if not pid:
        raise RuntimeError("No profile found for this id_number; journals.student_id is required.")

    now_iso = datetime.now(timezone.utc).isoformat()
    cores: list[dict[str, Any]] = [
        {"student_id": pid, "journal_text": body, "submitted_at": now_iso},
        {"student_id": pid, "journal_text": body},
        {"student_id": pid, "body": body, "submitted_at": now_iso},
        {"student_id": pid, "body": body},
    ]
    if entry_date:
        cores = [
            {"student_id": pid, "journal_text": body, "entry_date": entry_date, "submitted_at": now_iso},
            {"student_id": pid, "journal_text": body, "entry_date": entry_date},
            *cores,
        ]

    legacy = [
        {"student_id_number": student_id_number.strip(), "journal_text": body},
        {"student_id_number": student_id_number.strip(), "body": body},
    ]

    last_err: Exception | None = None
    for ins in cores + legacy:
        try:
            res = _sb().table("journals").insert(ins).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("insert_journal failed")


def list_journals_for_student(student_id_number: str) -> list[dict[str, Any]]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    seen: dict[str, dict[str, Any]] = {}
    order_cols = (("student_id", pid), ("student_id_number", student_id_number.strip()))
    for col, val in order_cols:
        if not val:
            continue
        try:
            res = _sb().table("journals").select("*").eq(col, val).execute()
            for r in res.data or []:
                seen[str(r["id"])] = r
        except Exception as e:
            print(f"list_journals_for_student {col}: {e}")
    rows = list(seen.values())
    rows.sort(
        key=lambda r: str(r.get("submitted_at") or r.get("created_at") or ""),
        reverse=True,
    )
    return rows


def get_active_attendance(student_id_number: str) -> dict[str, Any] | None:
    """Open session for *today* (UTC calendar date): no time_out and status not 'completed'."""
    pid = profile_uuid_for_id_number(student_id_number.strip())
    today = datetime.now(timezone.utc).date().isoformat()

    def _row_calendar_day(row: dict[str, Any]) -> str | None:
        d = row.get("date")
        if d:
            return str(d)[:10]
        tin = row.get("time_in")
        if not tin:
            return None
        s = str(tin).replace("Z", "+00:00")
        if "T" in s:
            return s.split("T", 1)[0]
        return s[:10] if len(s) >= 10 else None

    def _pick_open(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
        for row in rows or []:
            tout = row.get("time_out")
            if tout not in (None, ""):
                continue
            st = str(row.get("status") or "").strip().lower()
            if st == "completed":
                continue
            if st not in ("", "active", "in_progress", "clocked_in", "open"):
                continue
            day = _row_calendar_day(row)
            if day and day != today:
                continue
            return row
        return None

    for col, val in (("student_id", pid), ("student_id_number", student_id_number.strip())):
        if not val:
            continue
        try:
            res = (
                _sb()
                .table("attendance_logs")
                .select("*")
                .eq(col, val)
                .order("time_in", desc=True)
                .limit(40)
                .execute()
            )
            hit = _pick_open(res.data or [])
            if hit:
                return hit
        except Exception as e:
            print(f"get_active_attendance {col}: {e}")
    return None


def insert_time_in(student_id_number: str, time_in_iso: str) -> dict[str, Any]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    if not pid:
        raise RuntimeError(
            "No profile UUID for this id_number. Ensure profiles.id exists and matches auth signup."
        )
    today = datetime.now(timezone.utc).date().isoformat()
    candidates: list[dict[str, Any]] = [
        {
            "student_id": pid,
            "time_in": time_in_iso,
            "status": "active",
            "time_out": None,
            "total_hours": None,
            "date": today,
        },
        {
            "student_id": pid,
            "time_in": time_in_iso,
            "status": "active",
            "time_out": None,
            "total_hours": None,
        },
        {
            "student_id": pid,
            "student_id_number": student_id_number.strip(),
            "time_in": time_in_iso,
            "status": "active",
            "time_out": None,
            "total_hours": None,
            "date": today,
        },
        {
            "student_id": pid,
            "student_id_number": student_id_number.strip(),
            "time_in": time_in_iso,
            "status": "active",
            "time_out": None,
            "total_hours": None,
        },
    ]
    legacy = {
        "student_id_number": student_id_number.strip(),
        "time_in": time_in_iso,
        "status": "active",
        "time_out": None,
        "total_hours": None,
    }
    candidates.append({**legacy, "date": today})
    candidates.append(legacy)

    last_err: Exception | None = None
    for row in candidates:
        try:
            res = _sb().table("attendance_logs").insert(row).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("insert_time_in failed")


def _upload_url_for_path(path: str | None) -> str | None:
    """Public URL for a file under uploads/ — only if the file exists on disk."""
    if not path:
        return None
    p = str(path).strip().lstrip("/")
    if p.startswith("uploads/"):
        rel = p[len("uploads/") :]
    else:
        rel = p
    if not rel:
        return None
    try:
        import immersion_upload

        disk = immersion_upload.UPLOAD_ROOT / rel.replace("/", os.sep)
        if not disk.is_file():
            return None
    except Exception:
        return None
    return f"/uploads/{rel}"


def read_attendance_photo_bytes(row: dict[str, Any], kind: str) -> tuple[bytes, str] | None:
    """Load Time In / Time Out image bytes from DB base64 or disk path."""
    kind = str(kind or "").strip().lower()
    if kind == "time_in":
        b64 = row.get("captured_photo_base64")
        path = row.get("captured_photo_path")
    elif kind == "time_out":
        b64 = row.get("time_out_photo_base64")
        path = row.get("time_out_photo_path")
    else:
        return None

    if isinstance(b64, str) and b64.strip():
        payload = b64.strip()
        if payload.startswith("data:") and "," in payload:
            payload = payload.split(",", 1)[1]
        try:
            raw = base64.standard_b64decode(payload)
        except (binascii.Error, ValueError):
            raw = b""
        if raw:
            return raw, _mime_from_image_bytes(raw[:32])

    if path:
        p = str(path).strip().lstrip("/")
        if p.startswith("uploads/"):
            rel = p[len("uploads/") :]
        else:
            rel = p
        try:
            import immersion_upload

            disk = immersion_upload.UPLOAD_ROOT / rel.replace("/", os.sep)
            if disk.is_file():
                raw = disk.read_bytes()
                return raw, _mime_from_image_bytes(raw[:32])
        except Exception as e:
            print(f"read_attendance_photo_bytes disk {path}: {e}")
    return None


def _mime_from_image_bytes(prefix: bytes) -> str:
    if len(prefix) >= 3 and prefix[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if len(prefix) >= 8 and prefix[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(prefix) >= 12 and prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP":
        return "image/webp"
    if len(prefix) >= 6 and prefix[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "image/jpeg"


def _data_url_from_base64_field(b64: str | None) -> str | None:
    s = (b64 or "").strip()
    if not s:
        return None
    if s.startswith("data:"):
        return s
    try:
        raw = base64.standard_b64decode(s)
    except (binascii.Error, ValueError):
        return None
    if not raw:
        return None
    mime = _mime_from_image_bytes(raw[:32])
    return f"data:{mime};base64,{s}"


def enrich_attendance_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Attach photo URLs from disk paths or DB base64 blobs (blobs are not returned in the payload)."""
    if not row or not isinstance(row, dict):
        return row
    row = {**row}
    tin_b64 = row.pop("captured_photo_base64", None)
    tout_b64 = row.pop("time_out_photo_base64", None)
    tin = None
    tout = None
    if isinstance(tin_b64, str) and tin_b64.strip():
        tin = _data_url_from_base64_field(tin_b64)
    if isinstance(tout_b64, str) and tout_b64.strip():
        tout = _data_url_from_base64_field(tout_b64)
    if not tin:
        tin = _upload_url_for_path(row.get("captured_photo_path"))
    if not tout:
        tout = _upload_url_for_path(row.get("time_out_photo_path"))
    if tin:
        row = {**row, "photo_url": tin, "time_in_photo_url": tin}
    if tout:
        row = {**row, "time_out_photo_url": tout}
    return row


def insert_time_in_with_capture(
    student_id_number: str,
    time_in_iso: str,
    *,
    captured_photo_path: str | None = None,
    captured_photo_base64: str | None = None,
    latitude: float,
    longitude: float,
    readable_location_name: str,
    capture_timestamp: str,
) -> dict[str, Any]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    if not pid:
        raise RuntimeError(
            "No profile UUID for this id_number. Ensure profiles.id exists and matches auth signup."
        )
    today = datetime.now(timezone.utc).date().isoformat()
    path = (captured_photo_path or "").strip()
    b64 = (captured_photo_base64 or "").strip()
    if not path and not b64:
        raise RuntimeError("Immersion time-in requires a captured photo.")
    capture_fields: dict[str, Any] = {
        "latitude": latitude,
        "longitude": longitude,
        "readable_location_name": readable_location_name,
        "capture_timestamp": capture_timestamp,
    }
    if b64:
        capture_fields["captured_photo_base64"] = b64
    if path:
        capture_fields["captured_photo_path"] = path
    # Match live Supabase schema (student_id + capture cols; no event_type / student_id_number).
    row = {
        "student_id": pid,
        "time_in": time_in_iso,
        "status": "active",
        "time_out": None,
        "total_hours": None,
        "date": today,
        **capture_fields,
    }
    try:
        res = _sb().table("attendance_logs").insert(row).execute()
        if res.data:
            return enrich_attendance_row(res.data[0]) or res.data[0]
    except Exception as e:
        msg = str(e)
        if "PGRST204" in msg and (
            "capture_timestamp" in msg
            or "captured_photo_path" in msg
            or "captured_photo_base64" in msg
            or "readable_location_name" in msg
        ):
            hint = (
                "backend/migrations/immersion_attendance_capture.sql"
                + (
                    " and backend/migrations/immersion_attendance_photos_base64.sql"
                    if "captured_photo_base64" in msg
                    else ""
                )
            )
            raise RuntimeError(
                "Database is missing immersion capture columns. In Supabase SQL Editor, run "
                f"{hint} then try Time In again."
            ) from e
        raise
    last_err: Exception | None = None
    for legacy in (
        {**row, "student_id_number": student_id_number.strip()},
        {**row, "event_type": "time_in"},
    ):
        try:
            res = _sb().table("attendance_logs").insert(legacy).execute()
            if res.data:
                return enrich_attendance_row(res.data[0]) or res.data[0]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("insert_time_in_with_capture failed")


def complete_time_out(attendance_id: str, time_out_iso: str) -> dict[str, Any]:
    attendance = (
        _sb()
        .table("attendance_logs")
        .select("*")
        .eq("id", attendance_id)
        .limit(1)
        .execute()
    )
    if not attendance.data:
        raise RuntimeError("Attendance record not found.")

    row = attendance.data[0]
    time_in_value = row.get("time_in")
    if not time_in_value:
        raise RuntimeError("Attendance record has no time_in.")

    time_in_dt = datetime.fromisoformat(str(time_in_value).replace("Z", "+00:00"))
    time_out_dt = datetime.fromisoformat(str(time_out_iso).replace("Z", "+00:00"))
    total_hours = round((time_out_dt - time_in_dt).total_seconds() / 3600, 2)
    if total_hours < 0:
        raise RuntimeError("time_out cannot be earlier than time_in.")

    updated = (
        _sb()
        .table("attendance_logs")
        .update(
            {
                "time_out": time_out_iso,
                "total_hours": total_hours,
                "status": "completed",
            }
        )
        .eq("id", attendance_id)
        .execute()
    )
    row_out = updated.data[0] if updated.data else {
        "id": attendance_id,
        "time_out": time_out_iso,
        "total_hours": total_hours,
        "status": "completed",
    }
    return enrich_attendance_row(row_out) or row_out


def complete_time_out_with_capture(
    attendance_id: str,
    time_out_iso: str,
    *,
    time_out_photo_path: str | None = None,
    time_out_photo_base64: str | None = None,
    latitude: float,
    longitude: float,
    readable_location_name: str,
    capture_timestamp: str,
) -> dict[str, Any]:
    attendance = (
        _sb()
        .table("attendance_logs")
        .select("*")
        .eq("id", attendance_id)
        .limit(1)
        .execute()
    )
    if not attendance.data:
        raise RuntimeError("Attendance record not found.")

    row = attendance.data[0]
    time_in_value = row.get("time_in")
    if not time_in_value:
        raise RuntimeError("Attendance record has no time_in.")

    time_in_dt = datetime.fromisoformat(str(time_in_value).replace("Z", "+00:00"))
    time_out_dt = datetime.fromisoformat(str(time_out_iso).replace("Z", "+00:00"))
    total_hours = round((time_out_dt - time_in_dt).total_seconds() / 3600, 2)
    if total_hours < 0:
        raise RuntimeError("time_out cannot be earlier than time_in.")

    path = (time_out_photo_path or "").strip()
    b64 = (time_out_photo_base64 or "").strip()
    if not path and not b64:
        raise RuntimeError("Time Out requires a captured photo.")
    payload: dict[str, Any] = {
        "time_out": time_out_iso,
        "total_hours": total_hours,
        "status": "completed",
        "time_out_latitude": latitude,
        "time_out_longitude": longitude,
        "time_out_readable_location_name": readable_location_name,
        "time_out_capture_timestamp": capture_timestamp,
    }
    if b64:
        payload["time_out_photo_base64"] = b64
    if path:
        payload["time_out_photo_path"] = path
    try:
        updated = _sb().table("attendance_logs").update(payload).eq("id", attendance_id).execute()
        if updated.data:
            return enrich_attendance_row(updated.data[0]) or updated.data[0]
    except Exception as e:
        msg = str(e)
        if "PGRST204" in msg and "time_out_" in msg:
            hint = "backend/migrations/immersion_time_out_capture.sql"
            if "time_out_photo_base64" in msg:
                hint += " and backend/migrations/immersion_attendance_photos_base64.sql"
            raise RuntimeError(
                "Database is missing Time Out capture columns. Run "
                f"{hint} in Supabase SQL Editor."
            ) from e
        basic = _sb().table("attendance_logs").update(
            {"time_out": time_out_iso, "total_hours": total_hours, "status": "completed"}
        ).eq("id", attendance_id).execute()
        if basic.data:
            return enrich_attendance_row(basic.data[0]) or basic.data[0]
        raise
    raise RuntimeError("complete_time_out_with_capture failed")


def list_attendance_by_student(student_id_number: str) -> list[dict[str, Any]]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    seen: dict[str, dict[str, Any]] = {}
    for col, val in (("student_id", pid), ("student_id_number", student_id_number.strip())):
        if not val:
            continue
        try:
            res = (
                _sb()
                .table("attendance_logs")
                .select("*")
                .eq(col, val)
                .order("time_in", desc=True)
                .execute()
            )
            for r in res.data or []:
                seen[str(r["id"])] = r
        except Exception as e:
            print(f"list_attendance_by_student {col}: {e}")
    rows = list(seen.values())
    rows.sort(key=lambda r: str(r.get("time_in") or r.get("created_at") or ""), reverse=True)
    return rows


def insert_journal_linked(student_id_number: str, attendance_id: str, body: str) -> dict[str, Any]:
    pid = profile_uuid_for_id_number(student_id_number.strip())
    if not pid:
        raise RuntimeError("No profile found for this id_number; journals.student_id is required.")
    now_iso = datetime.now(timezone.utc).isoformat()
    tries: list[dict[str, Any]] = [
        {"student_id": pid, "attendance_id": attendance_id, "journal_text": body, "submitted_at": now_iso},
        {"student_id": pid, "attendance_id": attendance_id, "journal_text": body},
        {"student_id": pid, "attendance_id": attendance_id, "body": body},
        {
            "student_id": pid,
            "student_id_number": student_id_number.strip(),
            "attendance_id": attendance_id,
            "journal_text": body,
        },
        {"student_id_number": student_id_number.strip(), "attendance_id": attendance_id, "journal_text": body},
        {"student_id_number": student_id_number.strip(), "attendance_id": attendance_id, "body": body},
    ]
    last_err: Exception | None = None
    for ins in tries:
        try:
            res = _sb().table("journals").insert(ins).execute()
            if res.data:
                return res.data[0]
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    raise RuntimeError("insert_journal_linked failed")


def lesson_to_api_list_item(row: dict[str, Any]) -> dict[str, Any]:
    nested = row.get("lesson_content")
    if isinstance(nested, list):
        lc = nested[0] if nested else {}
    else:
        lc = nested or {}
    quiz = lc.get("quiz") or []
    if not isinstance(quiz, list):
        quiz = []
    lid = str(row["id"])
    pub = bool(row.get("is_published"))
    sid = row.get("subject_id")
    return {
        "id": lid,
        "file_id": lid,
        "filename": row.get("filename") or "",
        "file_type": (row.get("file_type") or "").strip(),
        "created_at": row.get("created_at"),
        "has_reviewer": bool(lc.get("reviewer")),
        "quiz_count": len(quiz),
        "has_activities": bool(lc.get("activities")),
        "published": pub,
        "is_published": pub,
        "subject_id": str(sid) if sid is not None else None,
        "lesson_content": {
            "reviewer": lc.get("reviewer"),
            "quiz": quiz,
            "activities": lc.get("activities"),
        },
    }


# ============================================================
# Student Gradecard helpers
# ------------------------------------------------------------
# Backed by the tables: grading_periods, enrollments,
# activity_attempts, student_grades, gradecards. See the
# migration SQL provided in chat for the table definitions.
# ============================================================


def list_grading_periods() -> list[dict[str, Any]]:
    try:
        res = (
            _sb()
            .table("grading_periods")
            .select("*")
            .order("start_date", desc=True)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"list_grading_periods: {e}")
        return []


def get_current_grading_period() -> dict[str, Any] | None:
    """Return the row flagged is_current=true, or the most recent one as fallback."""
    try:
        res = (
            _sb()
            .table("grading_periods")
            .select("*")
            .eq("is_current", True)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"get_current_grading_period (is_current): {e}")
    # Fallback: most recent by start_date
    try:
        res = (
            _sb()
            .table("grading_periods")
            .select("*")
            .order("start_date", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"get_current_grading_period (fallback): {e}")
        return None


def get_grading_period(period_id: str | None) -> dict[str, Any] | None:
    if not period_id:
        return get_current_grading_period()
    try:
        res = (
            _sb()
            .table("grading_periods")
            .select("*")
            .eq("id", period_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"get_grading_period: {e}")
    return get_current_grading_period()


def _period_date_range(period: dict[str, Any] | None) -> tuple[str | None, str | None]:
    """Return (start_iso, end_iso_exclusive) ISO strings for filtering by submitted_at."""
    if not period:
        return None, None
    start = period.get("start_date")
    end = period.get("end_date")
    if not start or not end:
        return None, None
    # end_date is the last valid day → make exclusive upper bound by appending +1 day
    try:
        end_dt = datetime.fromisoformat(str(end)) + timedelta(days=1)
        end_iso = end_dt.date().isoformat()
    except Exception:
        end_iso = str(end)
    return f"{start}T00:00:00", f"{end_iso}T00:00:00"


# ---------- Enrollments ----------

ENROLLMENT_STATUS_ACTIVE = "active"
ENROLLMENT_STATUS_ARCHIVED = "archived"
ENROLLMENT_STATUS_UNENROLLED = "unenrolled"
_MY_SUBJECTS_STATUSES = (ENROLLMENT_STATUS_ACTIVE, ENROLLMENT_STATUS_ARCHIVED)
_ARCHIVED_LIST_STATUSES = (ENROLLMENT_STATUS_ARCHIVED, ENROLLMENT_STATUS_UNENROLLED)


def enrollment_status_from_row(row: dict[str, Any] | None) -> str:
    if not row:
        return ENROLLMENT_STATUS_ACTIVE
    raw = (row.get("enrollment_status") or ENROLLMENT_STATUS_ACTIVE).strip().lower()
    if raw in _ARCHIVED_LIST_STATUSES or raw == ENROLLMENT_STATUS_ACTIVE:
        return raw
    return ENROLLMENT_STATUS_ACTIVE


def list_enrollments_for_student(
    student_uuid: str,
    period_id: str | None = None,
) -> list[dict[str, Any]]:
    if not student_uuid:
        return []
    try:
        q = (
            _sb()
            .table("enrollments")
            .select(
                "*, subjects(id, name, color), "
                "profiles!enrollments_student_id_fkey(last_name, first_name, middle_name, name_suffix, id_number)"
            )
            .eq("student_id", student_uuid)
        )
        # Some PostgREST versions don't accept the inverse FK alias above; fallback below.
        if period_id:
            q = q.eq("grading_period_id", period_id)
        res = q.execute()
        return res.data or []
    except Exception:
        # Fallback: plain select without joins
        try:
            q = _sb().table("enrollments").select("*").eq("student_id", student_uuid)
            if period_id:
                q = q.eq("grading_period_id", period_id)
            res = q.execute()
            rows = res.data or []
            subject_ids = list({r.get("subject_id") for r in rows if r.get("subject_id")})
            subjects_map: dict[str, dict[str, Any]] = {}
            if subject_ids:
                try:
                    sres = (
                        _sb()
                        .table("subjects")
                        .select("id, name, color")
                        .in_("id", subject_ids)
                        .execute()
                    )
                    for s in sres.data or []:
                        subjects_map[str(s["id"])] = s
                except Exception as e:
                    print(f"list_enrollments_for_student subjects fetch: {e}")
            for r in rows:
                sid = r.get("subject_id")
                if sid and str(sid) in subjects_map:
                    r["subjects"] = subjects_map[str(sid)]
            return rows
        except Exception as e:
            print(f"list_enrollments_for_student fallback: {e}")
            return []


def upsert_enrollment(
    student_uuid: str,
    subject_id: str,
    teacher_id_number: str | None,
    grading_period_id: str | None,
) -> dict[str, Any] | None:
    if not student_uuid or not subject_id:
        return None
    row = {
        "student_id": student_uuid,
        "subject_id": str(subject_id),
        "teacher_id_number": teacher_id_number,
        "grading_period_id": grading_period_id,
        "enrollment_status": ENROLLMENT_STATUS_ACTIVE,
    }
    try:
        res = (
            _sb()
            .table("enrollments")
            .upsert(row, on_conflict="student_id,subject_id,grading_period_id")
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        print(f"upsert_enrollment: {e}")
        return None


def get_student_enrollment_row(
    student_uuid: str,
    subject_id: str,
    grading_period_id: str | None,
) -> dict[str, Any] | None:
    if not student_uuid or not subject_id:
        return None
    try:
        q = (
            _sb()
            .table("enrollments")
            .select("*")
            .eq("student_id", student_uuid)
            .eq("subject_id", str(subject_id))
        )
        if grading_period_id:
            q = q.eq("grading_period_id", grading_period_id)
        res = q.limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"get_student_enrollment_row: {e}")
        return None


def student_enrollment_exists(
    student_uuid: str,
    subject_id: str,
    grading_period_id: str | None,
) -> bool:
    row = get_student_enrollment_row(student_uuid, subject_id, grading_period_id)
    if not row:
        return False
    return enrollment_status_from_row(row) in _MY_SUBJECTS_STATUSES


def update_student_enrollment_status(
    student_uuid: str,
    subject_id: str,
    grading_period_id: str | None,
    new_status: str,
) -> dict[str, Any] | None:
    if not student_uuid or not subject_id:
        return None
    status = (new_status or "").strip().lower()
    if status not in _ARCHIVED_LIST_STATUSES and status != ENROLLMENT_STATUS_ACTIVE:
        raise ValueError("Invalid enrollment status.")
    row = get_student_enrollment_row(student_uuid, subject_id, grading_period_id)
    if not row or not row.get("id"):
        return None
    try:
        res = (
            _sb()
            .table("enrollments")
            .update({"enrollment_status": status})
            .eq("id", row["id"])
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        print(f"update_student_enrollment_status: {e}")
        raise


def _student_enrollment_access_map(
    student_uuid: str,
    grading_period_id: str | None,
) -> dict[str, str | None]:
    """Map subject_id -> teacher_id_number filter for published lessons (None = any teacher)."""
    access: dict[str, str | None] = {}
    for row in list_enrollments_for_student(student_uuid, grading_period_id):
        if enrollment_status_from_row(row) == ENROLLMENT_STATUS_UNENROLLED:
            continue
        sid = row.get("subject_id")
        if not sid:
            nested = row.get("subjects") or {}
            sid = nested.get("id")
        if not sid:
            continue
        key = str(sid)
        tid = (row.get("teacher_id_number") or "").strip() or None
        if key not in access:
            access[key] = tid
    return access


def join_subject_by_code(student_uuid: str, join_code: str) -> dict[str, Any]:
    """
    Enroll a student using a subject join code.
    Raises ValueError with user-facing messages for invalid / already enrolled.
    """
    if not student_uuid:
        raise ValueError("Student not found.")
    subject = get_subject_by_join_code(join_code)
    if not subject or not subject.get("id"):
        raise ValueError("Invalid subject code")
    subject_id = str(subject["id"])
    period = get_current_grading_period() or {}
    period_id = period.get("id")
    if not period_id:
        raise ValueError("No grading period is configured. Ask your administrator.")
    existing = get_student_enrollment_row(student_uuid, subject_id, period_id)
    if existing:
        prior = enrollment_status_from_row(existing)
        if prior in _MY_SUBJECTS_STATUSES:
            raise ValueError("You are already enrolled in this subject")
        if prior == ENROLLMENT_STATUS_UNENROLLED:
            row = update_student_enrollment_status(
                student_uuid, subject_id, period_id, ENROLLMENT_STATUS_ACTIVE
            )
            if not row:
                raise RuntimeError("Could not re-enroll.")
            return {"subject": subject, "enrollment": row}
    teacher_id = (subject.get("created_by_teacher_id_number") or "").strip() or None
    row = upsert_enrollment(
        student_uuid=student_uuid,
        subject_id=subject_id,
        teacher_id_number=teacher_id,
        grading_period_id=period_id,
    )
    if not row:
        raise RuntimeError("Could not complete enrollment.")
    return {"subject": subject, "enrollment": row}


def list_enrolled_subjects_for_student(
    student_uuid: str,
    grading_period_id: str | None = None,
    *,
    statuses: tuple[str, ...] = _MY_SUBJECTS_STATUSES,
) -> list[dict[str, Any]]:
    """Subjects the student is enrolled in for the given (or current) grading period."""
    if not student_uuid:
        return []
    period_id = grading_period_id
    if not period_id:
        cur = get_current_grading_period() or {}
        period_id = cur.get("id")
    pub_counts = count_published_lessons_by_subject()
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in list_enrollments_for_student(student_uuid, period_id):
        if enrollment_status_from_row(row) not in statuses:
            continue
        nested = row.get("subjects") or {}
        sid = row.get("subject_id") or nested.get("id")
        if not sid:
            continue
        key = str(sid)
        if key in seen:
            continue
        seen.add(key)
        full = get_subject_row(key) or {
            "id": key,
            "name": nested.get("name") or "Subject",
            "description": nested.get("description") or "",
            "color": nested.get("color") or "",
        }
        full = dict(full)
        full["published_lesson_count"] = pub_counts.get(key, 0)
        full["enrollment_status"] = enrollment_status_from_row(row)
        out.append(full)
    _enrich_subjects_with_teacher_profiles(out)
    return sorted(out, key=lambda x: (x.get("name") or "").lower())


def _enrich_subjects_with_teacher_profiles(subjects: list[dict[str, Any]]) -> None:
    """Attach teacher_name, teacher_id_number, teacher_avatar_data for student UI."""
    teacher_idns: set[str] = set()
    for s in subjects:
        tidn = (s.get("created_by_teacher_id_number") or "").strip()
        if tidn:
            teacher_idns.add(tidn)
    if not teacher_idns:
        return
    profile_map: dict[str, dict[str, Any]] = {}
    for tidn in teacher_idns:
        prof = get_profile_by_id_number(tidn)
        if prof:
            profile_map[tidn] = prof
    for s in subjects:
        tidn = (s.get("created_by_teacher_id_number") or "").strip()
        if not tidn:
            s["teacher_name"] = None
            s["teacher_id_number"] = None
            s["teacher_avatar_data"] = ""
            continue
        prof = profile_map.get(tidn)
        s["teacher_id_number"] = tidn
        s["teacher_name"] = profile_display_name(prof) if prof else tidn
        s["teacher_avatar_data"] = (prof.get("avatar_data") or "") if prof else ""


def list_archived_subjects_for_student(
    student_uuid: str,
    grading_period_id: str | None = None,
) -> list[dict[str, Any]]:
    """Archived + unenrolled subjects for the Archived section."""
    return list_enrolled_subjects_for_student(
        student_uuid,
        grading_period_id,
        statuses=_ARCHIVED_LIST_STATUSES,
    )


def student_can_view_published_lesson(student_uuid: str, lesson: dict[str, Any]) -> bool:
    """True when the lesson is published and the student is enrolled in its subject."""
    if not student_uuid or not lesson:
        return False
    if not lesson.get("is_published"):
        return False
    period_id = None
    cur = get_current_grading_period() or {}
    period_id = cur.get("id")
    access = _student_enrollment_access_map(student_uuid, period_id)
    sid = lesson.get("subject_id")
    if not sid or str(sid) not in access:
        return False
    required_teacher = access[str(sid)]
    if required_teacher:
        lesson_teacher = (lesson.get("teacher_id_number") or "").strip()
        if lesson_teacher and lesson_teacher != required_teacher:
            return False
    return True


def list_published_lessons_for_student(
    student_uuid: str,
    subject_id: str | None = None,
    grading_period_id: str | None = None,
) -> list[dict[str, Any]]:
    """Published lessons limited to subjects the student is enrolled in."""
    if not student_uuid:
        return []
    period_id = grading_period_id
    if not period_id:
        cur = get_current_grading_period() or {}
        period_id = cur.get("id")
    access = _student_enrollment_access_map(student_uuid, period_id)
    if not access:
        return []
    lessons = list_published_lessons_with_content()
    out: list[dict[str, Any]] = []
    for lesson in lessons:
        sid = lesson.get("subject_id")
        if not sid or str(sid) not in access:
            continue
        required_teacher = access[str(sid)]
        if required_teacher:
            lesson_teacher = (lesson.get("teacher_id_number") or "").strip()
            if lesson_teacher and lesson_teacher != required_teacher:
                continue
        if subject_id is not None and str(sid) != str(subject_id):
            continue
        out.append(lesson)
    return out


# ---------- Quiz / activity / attendance aggregations ----------

def _lessons_for_subject(subject_id: str) -> list[dict[str, Any]]:
    try:
        res = (
            _sb()
            .table("lessons")
            .select("id, grading_component")
            .eq("subject_id", subject_id)
            .execute()
        )
        return res.data or []
    except Exception as e:
        print(f"_lessons_for_subject: {e}")
        return []


def _lesson_ids_for_subject(subject_id: str) -> list[str]:
    return [str(r["id"]) for r in _lessons_for_subject(subject_id) if r.get("id")]


def _lesson_ids_for_grading_component(subject_id: str, component: str) -> list[str]:
    """Lessons that count toward WW, PT, or QA (null lesson tag uses platform defaults)."""
    allowed_null = {
        "written_work": ("written_work", None),
        "performance_task": ("performance_task", None),
        "quarterly_assessment": ("quarterly_assessment",),
    }
    tags = allowed_null.get(component, (component,))
    ids: list[str] = []
    for row in _lessons_for_subject(subject_id):
        lid = row.get("id")
        if not lid:
            continue
        gc = row.get("grading_component")
        if gc is None and None in tags:
            ids.append(str(lid))
        elif gc in tags:
            ids.append(str(lid))
    return ids


def _average_quiz_attempts(
    student_uuid: str,
    lesson_ids: list[str],
    period: dict[str, Any] | None,
) -> dict[str, Any]:
    """Return {average: float|None, attempts: int} from quiz_attempts on given lessons."""
    out = {"average": None, "attempts": 0}
    if not lesson_ids or not student_uuid:
        return out
    try:
        q = (
            _sb()
            .table("quiz_attempts")
            .select("score, total_questions, submitted_at")
            .eq("student_id", student_uuid)
            .in_("lesson_id", lesson_ids)
        )
        start, end = _period_date_range(period)
        if start and end:
            q = q.gte("submitted_at", start).lt("submitted_at", end)
        res = q.execute()
        rows = res.data or []
        if not rows:
            return out
        pct_values: list[float] = []
        for r in rows:
            try:
                score = float(r.get("score") or 0)
                total = int(r.get("total_questions") or 0)
                if total > 0:
                    pct_values.append(max(0.0, min(100.0, (score / total) * 100.0)))
                else:
                    # If no total_questions stored, assume score is already a percentage.
                    pct_values.append(max(0.0, min(100.0, score)))
            except Exception:
                continue
        if pct_values:
            out["average"] = round(sum(pct_values) / len(pct_values), 2)
            out["attempts"] = len(pct_values)
        return out
    except Exception as e:
        print(f"_average_quiz_attempts: {e}")
        return out


def compute_quiz_average_for_subject(
    student_uuid: str,
    subject_id: str,
    period: dict[str, Any] | None,
) -> dict[str, Any]:
    """Written Work: quiz attempts on lessons tagged written_work (or untagged)."""
    lesson_ids = _lesson_ids_for_grading_component(subject_id, "written_work")
    return _average_quiz_attempts(student_uuid, lesson_ids, period)


def compute_quarterly_assessment_for_subject(
    student_uuid: str,
    subject_id: str,
    period: dict[str, Any] | None,
) -> dict[str, Any]:
    """Quarterly Assessment: quiz attempts on lessons tagged quarterly_assessment."""
    lesson_ids = _lesson_ids_for_grading_component(subject_id, "quarterly_assessment")
    return _average_quiz_attempts(student_uuid, lesson_ids, period)


def compute_activity_average_for_subject(
    student_uuid: str,
    subject_id: str,
    period: dict[str, Any] | None,
) -> dict[str, Any]:
    """Performance Tasks: activity attempts on PT-tagged lessons (or untagged)."""
    out = {"average": None, "attempts": 0}
    lesson_ids = _lesson_ids_for_grading_component(subject_id, "performance_task")
    if not lesson_ids or not student_uuid:
        return out
    try:
        q = (
            _sb()
            .table("activity_attempts")
            .select("score, submitted_at")
            .eq("student_id", student_uuid)
            .in_("lesson_id", lesson_ids)
        )
        start, end = _period_date_range(period)
        if start and end:
            q = q.gte("submitted_at", start).lt("submitted_at", end)
        res = q.execute()
        rows = res.data or []
        if not rows:
            return out
        scored = [float(r["score"]) for r in rows if r.get("score") is not None]
        out["attempts"] = len(rows)
        if scored:
            out["average"] = round(sum(scored) / len(scored), 2)
        return out
    except Exception as e:
        print(f"compute_activity_average_for_subject: {e}")
        return out


# ---------- Class attendance (photo check-in per subject; not immersion) ----------

def _subject_owned_by_teacher(subject_id: str, teacher_id_number: str) -> bool:
    row = get_subject_row(subject_id)
    if not row:
        return False
    return (row.get("created_by_teacher_id_number") or "").strip() == (
        teacher_id_number or ""
    ).strip()


def create_subject_announcement(
    subject_id: str, teacher_id_number: str, body: str, lesson_id: str | None = None
) -> dict[str, Any]:
    """Class Stream: teacher posts an announcement to a subject, optionally
    attaching one of their own lessons (shown as a file card, like Classroom)."""
    sid = str(subject_id or "").strip()
    idn = str(teacher_id_number or "").strip()
    text = str(body or "").strip()
    if not sid or not idn or not text:
        raise ValueError("subject_id, teacher_id_number, and body are required.")
    row: dict[str, Any] = {"subject_id": sid, "teacher_id_number": idn, "body": text}
    lid = str(lesson_id or "").strip()
    if lid:
        lesson = get_lesson_row(lid)
        if not lesson or str(lesson.get("teacher_id_number") or "") != idn:
            raise ValueError("You can only attach your own lessons.")
        row["lesson_id"] = lid
    res = _sb().table("subject_announcements").insert(row).execute()
    inserted = (res.data or [None])[0]
    if not inserted:
        raise RuntimeError("Could not save announcement.")
    return inserted


def get_announcement_row(announcement_id: str) -> dict[str, Any] | None:
    aid = str(announcement_id or "").strip()
    if not aid:
        return None
    res = _sb().table("subject_announcements").select("*").eq("id", aid).limit(1).execute()
    return res.data[0] if res.data else None


def list_subject_announcements(
    subject_id: str, limit: int = 50, viewer_id_number: str | None = None
) -> list[dict[str, Any]]:
    sid = str(subject_id or "").strip()
    if not sid:
        return []
    try:
        res = (
            _sb()
            .table("subject_announcements")
            .select("*")
            .eq("subject_id", sid)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"list_subject_announcements: {e}")
        return []

    ann_ids = [str(r.get("id")) for r in rows if r.get("id")]
    comments_by_ann = _list_comments_for_announcements(ann_ids)
    reaction_counts, reacted_ids = _reaction_summary_for_announcements(ann_ids, viewer_id_number)

    # Attach lesson file-card info for posts that reference one.
    lesson_ids = list({str(r.get("lesson_id")) for r in rows if r.get("lesson_id")})
    lesson_cache: dict[str, dict[str, Any]] = {}
    if lesson_ids:
        try:
            lres = (
                _sb()
                .table("lessons")
                .select("id, filename, file_type, is_published")
                .in_("id", lesson_ids)
                .execute()
            )
            for lrow in lres.data or []:
                lesson_cache[str(lrow.get("id"))] = lrow
        except Exception as e:
            print(f"list_subject_announcements (lesson attachments): {e}")

    # Attach the posting teacher's display name/avatar for the feed UI.
    profile_cache: dict[str, dict[str, Any]] = {}

    def _named(idn: str) -> dict[str, Any]:
        idn = str(idn or "")
        if idn and idn not in profile_cache:
            profile_cache[idn] = get_profile_by_id_number(idn) or {}
        prof = profile_cache.get(idn) or {}
        return {
            "id_number": idn,
            "name": profile_display_name(prof) if prof else idn,
            "avatar_data": (prof.get("avatar_data") or "") if prof else "",
        }

    out: list[dict[str, Any]] = []
    for r in rows:
        ann_id = str(r.get("id"))
        idn = str(r.get("teacher_id_number") or "")
        teacher = _named(idn)
        comments = []
        for c in comments_by_ann.get(ann_id, []):
            author = _named(c.get("author_id_number"))
            comments.append(
                {
                    "id": c.get("id"),
                    "body": c.get("body") or "",
                    "created_at": c.get("created_at"),
                    "author_id_number": author["id_number"],
                    "author_name": author["name"],
                    "author_avatar_data": author["avatar_data"],
                    "author_role": c.get("author_role") or "",
                }
            )
        lesson_row = lesson_cache.get(str(r.get("lesson_id") or "")) if r.get("lesson_id") else None
        out.append(
            {
                "id": r.get("id"),
                "subject_id": r.get("subject_id"),
                "body": r.get("body") or "",
                "created_at": r.get("created_at"),
                "teacher_id_number": idn,
                "teacher_name": teacher["name"],
                "teacher_avatar_data": teacher["avatar_data"],
                "comments": comments,
                "comment_count": len(comments),
                "reaction_count": reaction_counts.get(ann_id, 0),
                "viewer_reacted": ann_id in reacted_ids,
                "lesson": (
                    {
                        "id": lesson_row.get("id"),
                        "filename": lesson_row.get("filename") or "Lesson file",
                        "file_type": lesson_row.get("file_type") or "",
                        "is_published": bool(lesson_row.get("is_published")),
                    }
                    if lesson_row
                    else None
                ),
            }
        )
    return out


def _list_comments_for_announcements(announcement_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    """announcement_id -> ordered list of comment rows (oldest first)."""
    if not announcement_ids:
        return {}
    try:
        res = (
            _sb()
            .table("subject_announcement_comments")
            .select("*")
            .in_("announcement_id", announcement_ids)
            .order("created_at", desc=False)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"_list_comments_for_announcements: {e}")
        return {}
    out: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        out.setdefault(str(r.get("announcement_id")), []).append(r)
    return out


def _reaction_summary_for_announcements(
    announcement_ids: list[str], viewer_id_number: str | None
) -> tuple[dict[str, int], set[str]]:
    """announcement_id -> like count, and the set of announcement_ids the viewer has liked."""
    if not announcement_ids:
        return {}, set()
    try:
        res = (
            _sb()
            .table("subject_announcement_reactions")
            .select("announcement_id, reactor_id_number")
            .in_("announcement_id", announcement_ids)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"_reaction_summary_for_announcements: {e}")
        return {}, set()
    counts: dict[str, int] = {}
    reacted: set[str] = set()
    viewer = str(viewer_id_number or "")
    for r in rows:
        aid = str(r.get("announcement_id"))
        counts[aid] = counts.get(aid, 0) + 1
        if viewer and str(r.get("reactor_id_number") or "") == viewer:
            reacted.add(aid)
    return counts, reacted


def create_announcement_comment(
    announcement_id: str, author_id_number: str, author_role: str, body: str
) -> dict[str, Any]:
    aid = str(announcement_id or "").strip()
    idn = str(author_id_number or "").strip()
    role = str(author_role or "").strip().lower()
    text = str(body or "").strip()
    if not aid or not idn or role not in ("teacher", "student") or not text:
        raise ValueError("announcement_id, author, and body are required.")
    row = {"announcement_id": aid, "author_id_number": idn, "author_role": role, "body": text}
    res = _sb().table("subject_announcement_comments").insert(row).execute()
    inserted = (res.data or [None])[0]
    if not inserted:
        raise RuntimeError("Could not save comment.")
    return inserted


def toggle_announcement_reaction(announcement_id: str, reactor_id_number: str) -> dict[str, Any]:
    """Like if not yet reacted, unlike if already reacted. Returns {reacted, reaction_count}."""
    aid = str(announcement_id or "").strip()
    idn = str(reactor_id_number or "").strip()
    if not aid or not idn:
        raise ValueError("announcement_id and reactor are required.")
    existing = (
        _sb()
        .table("subject_announcement_reactions")
        .select("id")
        .eq("announcement_id", aid)
        .eq("reactor_id_number", idn)
        .limit(1)
        .execute()
    )
    if existing.data:
        _sb().table("subject_announcement_reactions").delete().eq("id", existing.data[0]["id"]).execute()
        reacted = False
    else:
        _sb().table("subject_announcement_reactions").insert(
            {"announcement_id": aid, "reactor_id_number": idn}
        ).execute()
        reacted = True
    count_res = (
        _sb()
        .table("subject_announcement_reactions")
        .select("id", count="exact")
        .eq("announcement_id", aid)
        .execute()
    )
    return {"reacted": reacted, "reaction_count": count_res.count or 0}


def student_enrolled_in_subject(student_uuid: str, subject_id: str) -> bool:
    if not student_uuid or not subject_id:
        return False
    cur = get_current_grading_period() or {}
    access = _student_enrollment_access_map(student_uuid, cur.get("id"))
    return str(subject_id).strip() in access


def list_students_enrolled_in_subject(subject_id: str) -> list[dict[str, Any]]:
    """Active-enrollment classmates for a subject's People tab."""
    sid = str(subject_id or "").strip()
    if not sid:
        return []
    try:
        res = (
            _sb()
            .table("enrollments")
            .select(
                "student_id, enrollment_status, "
                "profiles!enrollments_student_id_fkey(id, last_name, first_name, middle_name, name_suffix, lrn, avatar_data)"
            )
            .eq("subject_id", sid)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"list_students_enrolled_in_subject: {e}")
        return []

    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for r in rows:
        if enrollment_status_from_row(r) != ENROLLMENT_STATUS_ACTIVE:
            continue
        prof = r.get("profiles") or {}
        pid = str(prof.get("id") or r.get("student_id") or "")
        if not pid or pid in seen:
            continue
        seen.add(pid)
        out.append(serialize_public_profile(prof))
    out.sort(key=lambda p: (p.get("last_name") or "", p.get("first_name") or ""))
    return out


def _serialize_class_checkin_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    out = {**row}
    b64 = out.pop("captured_photo_base64", None)
    photo = _data_url_from_base64_field(b64) if isinstance(b64, str) else None
    if photo:
        out["photo_url"] = photo
        out["time_in_photo_url"] = photo
    return out


def _class_attendance_record_is_present(rec: dict[str, Any] | None) -> bool:
    """Present when a check-in record exists for this session (QR scan or,
    for older rows, a photo submission) and isn't explicitly marked absent."""
    if not rec:
        return False
    if str(rec.get("status") or "").strip().lower() == "absent":
        return False
    return True


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def _get_subject_row(subject_id: str) -> dict[str, Any] | None:
    sid = str(subject_id or "").strip()
    if not sid:
        return None
    try:
        res = _sb().table("subjects").select("*").eq("id", sid).limit(1).execute()
        return (res.data or [None])[0]
    except Exception as e:
        print(f"_get_subject_row: {e}")
        return None


def _maybe_set_subject_geofence(
    subject_id: str,
    lat: float,
    lon: float,
    location_name: str | None = None,
) -> None:
    """First Start with GPS sets the fixed class geofence pin for this subject."""
    subj = _get_subject_row(subject_id)
    if not subj or subj.get("attendance_geofence_lat") is not None:
        return
    label = (location_name or "").strip() or "Class location"
    try:
        _sb().table("subjects").update(
            {
                "attendance_geofence_lat": lat,
                "attendance_geofence_lon": lon,
                "attendance_geofence_radius_m": CLASS_ATTENDANCE_DEFAULT_RADIUS_M,
                "attendance_geofence_label": label,
            }
        ).eq("id", str(subject_id)).execute()
    except Exception as e:
        print(f"_maybe_set_subject_geofence: {e}")


def _resolve_class_geofence(
    subject_id: str,
    session: dict[str, Any] | None,
) -> dict[str, Any] | None:
    subj = _get_subject_row(subject_id)
    if subj and subj.get("attendance_geofence_lat") is not None and subj.get(
        "attendance_geofence_lon"
    ) is not None:
        try:
            return {
                "center_lat": float(subj["attendance_geofence_lat"]),
                "center_lon": float(subj["attendance_geofence_lon"]),
                "radius_m": float(
                    subj.get("attendance_geofence_radius_m")
                    or CLASS_ATTENDANCE_DEFAULT_RADIUS_M
                ),
                "source": "subject",
                "label": (subj.get("attendance_geofence_label") or "Class location").strip(),
            }
        except (TypeError, ValueError):
            pass
    if session and session.get("teacher_start_latitude") is not None and session.get(
        "teacher_start_longitude"
    ) is not None:
        try:
            return {
                "center_lat": float(session["teacher_start_latitude"]),
                "center_lon": float(session["teacher_start_longitude"]),
                "radius_m": float(CLASS_ATTENDANCE_DEFAULT_RADIUS_M),
                "source": "session",
                "label": (session.get("teacher_start_location_name") or "Teacher start").strip(),
            }
        except (TypeError, ValueError):
            pass
    return None


def _evaluate_location_verified(
    subject_id: str,
    session: dict[str, Any] | None,
    student_lat: float,
    student_lon: float,
) -> bool | None:
    geofence = _resolve_class_geofence(subject_id, session)
    if not geofence:
        return None
    dist = _haversine_meters(
        geofence["center_lat"],
        geofence["center_lon"],
        student_lat,
        student_lon,
    )
    return dist <= geofence["radius_m"]


def _geofence_for_api(subject_id: str, session: dict[str, Any] | None) -> dict[str, Any] | None:
    g = _resolve_class_geofence(subject_id, session)
    if not g:
        return None
    return {
        "radius_m": int(g["radius_m"]),
        "source": g["source"],
        "label": g["label"],
    }


def _apply_teacher_start_to_session(
    subject_id: str,
    session_id: str,
    *,
    teacher_latitude: float | None,
    teacher_longitude: float | None,
    teacher_start_location_name: str | None = None,
) -> None:
    if teacher_latitude is None or teacher_longitude is None:
        return
    try:
        lat = float(teacher_latitude)
        lon = float(teacher_longitude)
    except (TypeError, ValueError):
        return
    name = (teacher_start_location_name or "").strip() or None
    try:
        _sb().table("class_attendance_sessions").update(
            {
                "teacher_start_latitude": lat,
                "teacher_start_longitude": lon,
                "teacher_start_location_name": name,
            }
        ).eq("id", str(session_id)).execute()
        _maybe_set_subject_geofence(subject_id, lat, lon, name)
    except Exception as e:
        print(f"_apply_teacher_start_to_session: {e}")


def _class_attendance_local_today() -> str:
    """School-day date for class attendance (Philippines)."""
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("Asia/Manila")).date().isoformat()
    except Exception:
        return datetime.now(timezone.utc).date().isoformat()


def get_class_attendance_session_today(subject_id: str) -> dict[str, Any] | None:
    """Open session for this subject, else today's closed session (PH school day)."""
    sid = str(subject_id or "").strip()
    if not sid:
        return None
    try:
        open_res = (
            _sb()
            .table("class_attendance_sessions")
            .select("*")
            .eq("subject_id", sid)
            .eq("status", "open")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        if open_res.data:
            return open_res.data[0]
        day = _class_attendance_local_today()
        res = (
            _sb()
            .table("class_attendance_sessions")
            .select("*")
            .eq("subject_id", sid)
            .eq("session_date", day)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        print(f"get_class_attendance_session_today: {e}")
        return None


def start_class_attendance_session(
    subject_id: str,
    teacher_id_number: str,
    *,
    teacher_latitude: float | None = None,
    teacher_longitude: float | None = None,
    teacher_start_location_name: str | None = None,
) -> dict[str, Any]:
    sid = str(subject_id or "").strip()
    tid = str(teacher_id_number or "").strip()
    if not sid or not tid:
        raise ValueError("subject_id and teacher_id_number are required.")
    if not _subject_owned_by_teacher(sid, tid):
        raise ValueError("You do not own this subject.")
    existing = get_class_attendance_session_today(sid)
    if existing:
        if str(existing.get("status") or "").lower() == "open":
            sess_id = str(existing.get("id") or "")
            _apply_teacher_start_to_session(
                sid,
                sess_id,
                teacher_latitude=teacher_latitude,
                teacher_longitude=teacher_longitude,
                teacher_start_location_name=teacher_start_location_name,
            )
            return get_class_attendance_session_today(sid) or existing
        # Re-open today's session — fresh round; clear prior check-ins for this session.
        sess_id = str(existing.get("id") or "")
        try:
            _sb().table("class_attendance_records").delete().eq("session_id", sess_id).execute()
        except Exception as e:
            print(f"start_class_attendance_session clear records: {e}")
        res = (
            _sb()
            .table("class_attendance_sessions")
            .update(
                {
                    "status": "open",
                    "ended_at": None,
                    "started_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", sess_id)
            .execute()
        )
        row = (res.data or [None])[0] or existing
        _apply_teacher_start_to_session(
            sid,
            sess_id,
            teacher_latitude=teacher_latitude,
            teacher_longitude=teacher_longitude,
            teacher_start_location_name=teacher_start_location_name,
        )
        return get_class_attendance_session_today(sid) or row
    res = (
        _sb()
        .table("class_attendance_sessions")
        .insert(
            {
                "subject_id": sid,
                "teacher_id_number": tid,
                "status": "open",
                "session_date": _class_attendance_local_today(),
            }
        )
        .execute()
    )
    row = (res.data or [None])[0]
    if not row:
        raise RuntimeError("Could not start class attendance.")
    _apply_teacher_start_to_session(
        sid,
        str(row.get("id") or ""),
        teacher_latitude=teacher_latitude,
        teacher_longitude=teacher_longitude,
        teacher_start_location_name=teacher_start_location_name,
    )
    return get_class_attendance_session_today(sid) or row


def end_class_attendance_session(session_id: str, teacher_id_number: str) -> dict[str, Any]:
    sess_id = str(session_id or "").strip()
    tid = str(teacher_id_number or "").strip()
    session = (
        _sb()
        .table("class_attendance_sessions")
        .select("*")
        .eq("id", sess_id)
        .limit(1)
        .execute()
    )
    row = (session.data or [None])[0]
    if not row:
        raise ValueError("Attendance session not found.")
    if not _subject_owned_by_teacher(str(row.get("subject_id") or ""), tid):
        raise ValueError("You do not own this subject.")
    if str(row.get("status") or "").lower() == "closed":
        return row
    ended = datetime.now(timezone.utc).isoformat()
    res = (
        _sb()
        .table("class_attendance_sessions")
        .update({"status": "closed", "ended_at": ended})
        .eq("id", sess_id)
        .execute()
    )
    return (res.data or [row])[0]


def _list_enrolled_students_for_subject(subject_id: str) -> list[dict[str, Any]]:
    sid = str(subject_id or "").strip()
    if not sid:
        return []
    try:
        res = (
            _sb()
            .table("enrollments")
            .select("student_id")
            .eq("subject_id", sid)
            .execute()
        )
        uuids = [str(r["student_id"]) for r in (res.data or []) if r.get("student_id")]
    except Exception as e:
        print(f"_list_enrolled_students_for_subject: {e}")
        return []
    profiles = _fetch_student_profiles_by_uuids(uuids)
    out = [serialize_public_profile(p) for p in profiles]
    out.sort(key=lambda x: (x.get("display_name") or x.get("id_number") or "").lower())
    return out


def _class_records_for_session(session_id: str) -> list[dict[str, Any]]:
    try:
        res = (
            _sb()
            .table("class_attendance_records")
            .select("*")
            .eq("session_id", str(session_id))
            .order("time_in", desc=False)
            .execute()
        )
        return [_serialize_class_checkin_row(r) or r for r in (res.data or [])]
    except Exception as e:
        print(f"_class_records_for_session: {e}")
        return []


def build_class_attendance_live(subject_id: str, teacher_id_number: str) -> dict[str, Any]:
    sid = str(subject_id or "").strip()
    tid = str(teacher_id_number or "").strip()
    if not _subject_owned_by_teacher(sid, tid):
        raise PermissionError("You do not own this subject.")
    session = get_class_attendance_session_today(sid)
    students = _list_enrolled_students_for_subject(sid)
    session_open = bool(
        session and str(session.get("status") or "").lower() == "open"
    )
    records = _class_records_for_session(str(session["id"])) if session else []
    by_student = {str(r.get("student_id") or ""): r for r in records}
    roster = []
    present = 0
    pending = 0
    for stu in students:
        stu_id = str(stu.get("id") or "")
        rec = by_student.get(stu_id)
        submitted = _class_attendance_record_is_present(rec)
        if submitted:
            present += 1
        elif session_open:
            pending += 1
        state = "present" if submitted else ("pending" if session_open else "absent")
        roster.append(
            {
                "student": stu,
                "checked_in": submitted,
                "attendance_state": state,
                "record": rec if submitted else None,
            }
        )
    absent = max(0, len(students) - present - pending)
    geofence = _geofence_for_api(sid, session)
    return {
        "session": session,
        "roster": roster,
        "geofence": geofence,
        "enrolled_count": len(students),
        "present_count": present,
        "pending_count": pending,
        "absent_count": absent,
    }


def get_student_class_attendance_status(
    student_uuid: str,
    student_id_number: str,
    subject_id: str,
) -> dict[str, Any]:
    sid = str(subject_id or "").strip()
    if not student_enrolled_in_subject(student_uuid, sid):
        return {
            "enrolled": False,
            "session_open": False,
            "session_closed": False,
            "session": None,
            "already_checked_in": False,
            "marked_absent": False,
            "record": None,
        }
    session = get_class_attendance_session_today(sid)
    status = str(session.get("status") or "").lower() if session else ""
    open_sess = bool(session and status == "open")
    closed_sess = bool(session and status == "closed")
    record = None
    if session:
        try:
            res = (
                _sb()
                .table("class_attendance_records")
                .select("*")
                .eq("session_id", str(session["id"]))
                .eq("student_id", student_uuid)
                .limit(1)
                .execute()
            )
            if res.data:
                record = _serialize_class_checkin_row(res.data[0])
        except Exception as e:
            print(f"get_student_class_attendance_status record: {e}")
    checked_in = _class_attendance_record_is_present(record)
    if record and not checked_in:
        record = None
    checked_out = bool(record and record.get("time_out"))
    return {
        "enrolled": True,
        "session_open": open_sess,
        "session_closed": closed_sess,
        "session": session,
        "geofence": _geofence_for_api(sid, session),
        "already_checked_in": checked_in,
        "checked_out": checked_out,
        "marked_absent": closed_sess and not checked_in,
        "record": record,
    }


def insert_class_attendance_checkin(
    student_uuid: str,
    student_id_number: str,
    subject_id: str,
    *,
    time_in_iso: str,
    captured_photo_base64: str,
    latitude: float,
    longitude: float,
    readable_location_name: str,
    capture_timestamp: str,
) -> dict[str, Any]:
    sid = str(subject_id or "").strip()
    if not student_enrolled_in_subject(student_uuid, sid):
        raise PermissionError("You are not enrolled in this subject.")
    session = get_class_attendance_session_today(sid)
    if not session or str(session.get("status") or "").lower() != "open":
        raise ValueError("Class attendance is not open for this subject right now.")
    sess_id = str(session["id"])
    try:
        existing = (
            _sb()
            .table("class_attendance_records")
            .select("id")
            .eq("session_id", sess_id)
            .eq("student_id", student_uuid)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise ValueError("You already checked in for today's class attendance.")
    except ValueError:
        raise
    except Exception as e:
        print(f"insert_class_attendance_checkin existing: {e}")

    location_verified = _evaluate_location_verified(sid, session, latitude, longitude)
    row = {
        "session_id": sess_id,
        "student_id": student_uuid,
        "student_id_number": student_id_number.strip(),
        "time_in": time_in_iso,
        "status": "present",
        "captured_photo_base64": captured_photo_base64,
        "latitude": latitude,
        "longitude": longitude,
        "readable_location_name": readable_location_name,
        "capture_timestamp": capture_timestamp,
    }
    if location_verified is not None:
        row["location_verified"] = location_verified
    res = _sb().table("class_attendance_records").insert(row).execute()
    inserted = (res.data or [None])[0]
    if not inserted:
        raise RuntimeError("Could not save class attendance.")
    return _serialize_class_checkin_row(inserted) or inserted


def insert_class_attendance_checkin_via_qr(
    student_uuid: str,
    student_id_number: str,
    subject_id: str,
    *,
    time_in_iso: str,
) -> dict[str, Any]:
    """QR check-in: teacher scans the student's own QR (their id_number) with
    the class camera. No photo/GPS — presence in front of the teacher's
    camera at scan time is the proof, same trust level as a paper sign-in
    sheet the teacher watches in person."""
    sid = str(subject_id or "").strip()
    if not student_enrolled_in_subject(student_uuid, sid):
        raise PermissionError("This student is not enrolled in this subject.")
    session = get_class_attendance_session_today(sid)
    if not session or str(session.get("status") or "").lower() != "open":
        raise ValueError("Class attendance is not open for this subject right now.")
    sess_id = str(session["id"])
    try:
        existing = (
            _sb()
            .table("class_attendance_records")
            .select("id")
            .eq("session_id", sess_id)
            .eq("student_id", student_uuid)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise ValueError("This student already checked in for today's class attendance.")
    except ValueError:
        raise
    except Exception as e:
        print(f"insert_class_attendance_checkin_via_qr existing: {e}")

    row = {
        "session_id": sess_id,
        "student_id": student_uuid,
        "student_id_number": student_id_number.strip(),
        "time_in": time_in_iso,
        "status": "present",
    }
    res = _sb().table("class_attendance_records").insert(row).execute()
    inserted = (res.data or [None])[0]
    if not inserted:
        raise RuntimeError("Could not save class attendance.")
    return _serialize_class_checkin_row(inserted) or inserted


def class_attendance_qr_toggle(
    student_uuid: str,
    student_id_number: str,
    subject_id: str,
    *,
    now_iso: str,
) -> tuple[str, dict[str, Any]]:
    """Student scans the teacher's rotating class-attendance QR: first scan
    = time in, second scan = time out. Mirrors the immersion time-in/out
    toggle so a student can't just scan once and leave without it showing.
    Returns (action, record) where action is 'time_in' or 'time_out'."""
    sid = str(subject_id or "").strip()
    if not student_enrolled_in_subject(student_uuid, sid):
        raise PermissionError("This student is not enrolled in this subject.")
    session = get_class_attendance_session_today(sid)
    if not session or str(session.get("status") or "").lower() != "open":
        raise ValueError("Class attendance is not open for this subject right now.")
    sess_id = str(session["id"])
    try:
        existing = (
            _sb()
            .table("class_attendance_records")
            .select("*")
            .eq("session_id", sess_id)
            .eq("student_id", student_uuid)
            .limit(1)
            .execute()
        )
        existing_row = existing.data[0] if existing.data else None
    except Exception as e:
        print(f"class_attendance_qr_toggle existing: {e}")
        existing_row = None

    if existing_row:
        if existing_row.get("time_out"):
            raise ValueError("You've already checked out for today's class attendance.")
        res = (
            _sb()
            .table("class_attendance_records")
            .update({"time_out": now_iso})
            .eq("id", existing_row["id"])
            .execute()
        )
        updated = (res.data or [None])[0]
        if not updated:
            raise RuntimeError("Could not save time out.")
        return "time_out", (_serialize_class_checkin_row(updated) or updated)

    row = {
        "session_id": sess_id,
        "student_id": student_uuid,
        "student_id_number": student_id_number.strip(),
        "time_in": now_iso,
        "status": "present",
    }
    res = _sb().table("class_attendance_records").insert(row).execute()
    inserted = (res.data or [None])[0]
    if not inserted:
        raise RuntimeError("Could not save class attendance.")
    return "time_in", (_serialize_class_checkin_row(inserted) or inserted)


def _attendance_status_bucket(status_raw: Any) -> str:
    s = str(status_raw or "").strip().lower()
    if s in {"absent"}:
        return "absent"
    if s in {"late", "tardy"}:
        return "tardy"
    if s in {"present", "in_progress", "active", "completed", "clocked_in", "clocked_out", "open", "closed"}:
        return "present"
    return "other"


def compute_attendance_stats(
    student_uuid: str,
    student_id_number: str | None,
    period: dict[str, Any] | None,
) -> dict[str, Any]:
    """Return {present, absent, tardy, total, percent} for the period."""
    out = {"present": 0, "absent": 0, "tardy": 0, "total": 0, "percent": None}
    if not student_uuid and not student_id_number:
        return out

    start_iso, end_iso = _period_date_range(period)
    rows: list[dict[str, Any]] = []

    for col, val in (("student_id", student_uuid), ("student_id_number", student_id_number)):
        if not val:
            continue
        try:
            q = _sb().table("attendance_logs").select("status, date, time_in").eq(col, val)
            if start_iso and end_iso:
                # attendance_logs may use date or time_in for the day; try time_in first
                q = q.gte("time_in", start_iso).lt("time_in", end_iso)
            res = q.execute()
            rows.extend(res.data or [])
        except Exception as e:
            print(f"compute_attendance_stats ({col}): {e}")

    seen_days: set[str] = set()
    for r in rows:
        bucket = _attendance_status_bucket(r.get("status"))
        if bucket == "other":
            continue
        # Dedup by day so multiple logs on the same day count once
        day = str(r.get("date") or (r.get("time_in") or "")[:10])
        if not day or day in seen_days:
            continue
        seen_days.add(day)
        out[bucket] += 1

    out["total"] = out["present"] + out["absent"] + out["tardy"]
    if out["total"] > 0:
        out["percent"] = round((out["present"] / out["total"]) * 100.0, 2)
    return out


# ---------- Student learning history (History page) ----------


def _lesson_title_and_subject(lesson_id: str) -> tuple[str, str, dict[str, Any] | None]:
    lesson = get_lesson_row(lesson_id) if lesson_id else None
    title = (lesson.get("filename") if lesson else None) or "Lesson"
    subject_name = ""
    if lesson and lesson.get("subject_id"):
        sub = get_subject_row(str(lesson["subject_id"]))
        if sub:
            subject_name = (sub.get("name") or "").strip()
    return title, subject_name, lesson


def _quiz_questions_snapshot_from_attempt(
    content_row: dict[str, Any] | None,
    answers_raw: Any,
) -> list[dict[str, Any]]:
    quiz = (content_row or {}).get("quiz") if content_row else []
    if not isinstance(quiz, list):
        quiz = []
    answers: list[Any] = []
    if isinstance(answers_raw, list):
        answers = answers_raw
    elif isinstance(answers_raw, dict):
        answers = list(answers_raw.values())
    out: list[dict[str, Any]] = []
    for i, q in enumerate(quiz):
        if not isinstance(q, dict):
            continue
        your = answers[i] if i < len(answers) else None
        ans_letter = str(q.get("answer") or "").strip().upper()
        out.append(
            {
                "question": str(q.get("question") or ""),
                "choices": [str(c) for c in (q.get("choices") or [])],
                "answer": ans_letter,
                "student_answer": str(your).strip().upper() if your is not None else None,
            }
        )
    return out


def list_student_quiz_history(
    student_id_number: str,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Quiz attempts for History page (from quiz_attempts + lesson_content)."""
    idn = (student_id_number or "").strip()
    student_uuid = profile_uuid_for_id_number(idn) if idn else None
    if not student_uuid and not idn:
        return []

    rows: list[dict[str, Any]] = []
    try:
        q = _sb().table("quiz_attempts").select("*")
        if student_uuid:
            q = q.eq("student_id", student_uuid)
        elif idn:
            q = q.eq("student_id_number", idn)
        res = q.order("created_at", desc=True).limit(limit).execute()
        rows = res.data or []
    except Exception as e:
        print(f"list_student_quiz_history: {e}")
        return []

    out: list[dict[str, Any]] = []
    for r in rows:
        lid = str(r.get("lesson_id") or "")
        if not lid:
            continue
        title, subject_name, _lesson = _lesson_title_and_subject(lid)
        _, lc = get_lesson_with_content(lid)
        score = int(r.get("score") or 0)
        total = int(r.get("total_questions") or 0)
        ts = r.get("submitted_at") or r.get("created_at")
        out.append(
            {
                "id": str(r.get("id") or ""),
                "lesson_id": lid,
                "lesson_title": title,
                "subject_name": subject_name,
                "score": score,
                "total": total,
                "questions": _quiz_questions_snapshot_from_attempt(lc, r.get("answers")),
                "timestamp": ts,
            }
        )
    return out


def insert_student_learning_event(
    student_id_number: str,
    event_type: str,
    payload: dict[str, Any],
) -> dict[str, Any] | None:
    """Persist reviewer / activity history event."""
    idn = (student_id_number or "").strip()
    et = (event_type or "").strip().lower()
    if et not in ("reviewer", "activity", "battle"):
        raise ValueError("event_type must be reviewer, activity, or battle")
    student_uuid = profile_uuid_for_id_number(idn) if idn else None
    lesson_id = payload.get("lesson_id")
    meta = {
        k: payload[k]
        for k in payload
        if k not in ("lesson_id", "lesson_title", "subject_name", "timestamp")
    }
    row: dict[str, Any] = {
        "event_type": et,
        "lesson_id": str(lesson_id) if lesson_id else None,
        "lesson_title": (payload.get("lesson_title") or "").strip() or None,
        "subject_name": (payload.get("subject_name") or "").strip() or None,
        "metadata": meta or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if student_uuid:
        row["student_id"] = student_uuid
    if idn:
        row["student_id_number"] = idn
    try:
        res = _sb().table("student_learning_events").insert(row).execute()
        return (res.data or [None])[0]
    except Exception as e:
        print(f"insert_student_learning_event: {e}")
        raise


def list_student_learning_events(
    student_id_number: str,
    event_type: str,
    limit: int = 100,
) -> list[dict[str, Any]]:
    idn = (student_id_number or "").strip()
    et = (event_type or "").strip().lower()
    student_uuid = profile_uuid_for_id_number(idn) if idn else None
    if not student_uuid and not idn:
        return []
    try:
        q = _sb().table("student_learning_events").select("*").eq("event_type", et)
        if student_uuid:
            q = q.eq("student_id", student_uuid)
        elif idn:
            q = q.eq("student_id_number", idn)
        res = q.order("created_at", desc=True).limit(limit).execute()
        rows = res.data or []
    except Exception as e:
        print(f"list_student_learning_events: {e}")
        return []

    out: list[dict[str, Any]] = []
    for r in rows:
        meta = r.get("metadata") if isinstance(r.get("metadata"), dict) else {}
        out.append(
            {
                "id": str(r.get("id") or ""),
                "lesson_id": str(r.get("lesson_id") or "") or None,
                "lesson_title": r.get("lesson_title") or "Lesson",
                "subject_name": r.get("subject_name") or "",
                "timestamp": r.get("created_at"),
                **meta,
            }
        )
    return out


def _has_reviewer_content(reviewer: Any) -> bool:
    if isinstance(reviewer, list):
        return any(str(x).strip() for x in reviewer)
    return bool(str(reviewer or "").strip())


def _merge_history_by_lesson(
    primary: list[dict[str, Any]],
    backfill: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Keep primary entries; add backfill only for lesson_ids not already present."""
    seen = {str(x.get("lesson_id") or "") for x in primary if x.get("lesson_id")}
    merged = list(primary)
    for item in backfill:
        lid = str(item.get("lesson_id") or "")
        if not lid or lid in seen:
            continue
        seen.add(lid)
        merged.append(item)
    merged.sort(
        key=lambda x: str(x.get("timestamp") or ""),
        reverse=True,
    )
    return merged[:100]


def backfill_student_history_from_lessons(student_id_number: str) -> dict[str, list[dict[str, Any]]]:
    """
    Include lessons with saved reviewer/quiz/activities so past AI generations appear
    even if no history event was recorded at the time.
    """
    idn = (student_id_number or "").strip()
    student_uuid = profile_uuid_for_id_number(idn) if idn else None
    if not student_uuid:
        return {"quiz": [], "reviewer": [], "activity": []}

    lessons = list_published_lessons_for_student(student_uuid)
    quiz_out: list[dict[str, Any]] = []
    reviewer_out: list[dict[str, Any]] = []
    activity_out: list[dict[str, Any]] = []

    for lesson in lessons:
        lid = str(lesson.get("id") or lesson.get("file_id") or "")
        if not lid:
            continue
        title = (lesson.get("filename") or lesson.get("title") or "Lesson").strip()
        subject_name = (lesson.get("subject_name") or "").strip()
        ts = lesson.get("created_at") or lesson.get("updated_at")
        reviewer = lesson.get("reviewer")
        quiz = lesson.get("quiz") if isinstance(lesson.get("quiz"), list) else []
        activities = lesson.get("activities") if isinstance(lesson.get("activities"), list) else []

        if _has_reviewer_content(reviewer):
            reviewer_out.append(
                {
                    "id": f"backfill-reviewer:{lid}",
                    "lesson_id": lid,
                    "lesson_title": title,
                    "subject_name": subject_name,
                    "timestamp": ts,
                    "from_lesson_content": True,
                }
            )
        if quiz:
            quiz_out.append(
                {
                    "id": f"backfill-quiz:{lid}",
                    "lesson_id": lid,
                    "lesson_title": title,
                    "subject_name": subject_name,
                    "score": 0,
                    "total": len(quiz),
                    "questions": [],
                    "generated_only": True,
                    "timestamp": ts,
                    "from_lesson_content": True,
                }
            )
        if activities:
            activity_out.append(
                {
                    "id": f"backfill-activity:{lid}",
                    "lesson_id": lid,
                    "lesson_title": title,
                    "subject_name": subject_name,
                    "timestamp": ts,
                    "activity_count": len(activities),
                    "from_lesson_content": True,
                }
            )

    return {
        "quiz": quiz_out,
        "reviewer": reviewer_out,
        "activity": activity_out,
    }


def get_student_learning_history(student_id_number: str) -> dict[str, list[dict[str, Any]]]:
    quiz = list_student_quiz_history(student_id_number)
    reviewer = list_student_learning_events(student_id_number, "reviewer")
    activity = list_student_learning_events(student_id_number, "activity")
    battle = list_student_learning_events(student_id_number, "battle")
    backfill = backfill_student_history_from_lessons(student_id_number)
    return {
        "quiz": _merge_history_by_lesson(quiz, backfill.get("quiz") or []),
        "reviewer": _merge_history_by_lesson(reviewer, backfill.get("reviewer") or []),
        "activity": _merge_history_by_lesson(activity, backfill.get("activity") or []),
        "battle": battle,
    }


# ---------- Teacher gradecard roster (strands → students) ----------

SHS_STRANDS = ("STEM", "ABM", "HUMSS", "TVL-HE")
_STRAND_ALIASES = {"HUMMS": "HUMSS", "TVLHE": "TVL-HE", "TVL": "TVL-HE"}


def normalize_profile_strand(strand: str | None) -> str | None:
    raw = (strand or "").strip().upper().replace(" ", "-")
    if not raw:
        return None
    return _STRAND_ALIASES.get(raw, raw)


# ---------- Sections (admin-managed fixed list, scoped to grade + strand) ----------
# See backend/migrations/sections.sql. Students can no longer free-type their
# own section (removed from PROFILE_EXTRA_FIELDS above) — only admins assign
# it, and only from this table's fixed list.


def list_sections(
    grade_level: str | None = None, strand: str | None = None
) -> list[dict[str, Any]]:
    try:
        q = _sb().table("sections").select("*")
        if grade_level:
            q = q.eq("grade_level", str(grade_level).strip())
        if strand:
            norm = normalize_profile_strand(strand)
            if norm:
                q = q.eq("strand", norm)
        res = q.order("name").execute()
        return res.data or []
    except Exception as e:
        print(f"list_sections: {e}")
        return []


def create_section(name: str, grade_level: str, strand: str) -> dict[str, Any]:
    nm = str(name or "").strip()
    gl = normalize_profile_grade_level(grade_level)
    st = normalize_profile_strand(strand)
    if not nm:
        raise ValueError("Section name is required.")
    if gl not in ("11", "12"):
        raise ValueError("Grade level must be 11 or 12.")
    if st not in SHS_STRANDS:
        raise ValueError("Invalid strand.")
    try:
        res = (
            _sb()
            .table("sections")
            .insert({"name": nm, "grade_level": gl, "strand": st})
            .execute()
        )
    except Exception as e:
        msg = str(e)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            raise ValueError("A section with this name already exists.")
        raise
    row = (res.data or [None])[0]
    if not row:
        raise RuntimeError("Could not create section.")
    return row


def delete_section(section_id: str) -> bool:
    sid = str(section_id or "").strip()
    if not sid:
        return False
    res = _sb().table("sections").delete().eq("id", sid).execute()
    return bool(res.data)


def list_students_without_section() -> list[dict[str, Any]]:
    """Students whose profile has no section yet — for the admin Sections
    page to show who still needs one assigned."""
    try:
        res = (
            _sb()
            .table("profiles")
            .select(
                "id, last_name, first_name, middle_name, name_suffix, lrn, "
                "email, role, grade_level, strand, section"
            )
            .eq("role", "student")
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"list_students_without_section: {e}")
        return []
    out = [serialize_public_profile(p) for p in rows if not str(p.get("section") or "").strip()]
    out.sort(key=lambda x: (x.get("display_name") or x.get("id_number") or "").lower())
    return out


def admin_set_student_section(student_id_number: str, section_name: str) -> dict[str, Any] | None:
    """Admin-only: assign/replace a student's section. An empty section_name
    clears it. A non-empty value must exactly match a row in `sections`."""
    sid_number = str(student_id_number or "").strip()
    name = str(section_name or "").strip()
    if not sid_number:
        raise ValueError("student_id_number is required.")
    if name:
        exists = _sb().table("sections").select("id").eq("name", name).limit(1).execute()
        if not exists.data:
            raise ValueError("That section does not exist. Add it first in Manage Sections.")
    res = (
        _sb()
        .table("profiles")
        .update({"section": name or None})
        .eq(PROFILE_LRN_COLUMN, sid_number)
        .execute()
    )
    row = (res.data or [None])[0]
    return normalize_profile_row(row) if row else None


def normalize_profile_grade_level(grade_level: str | None) -> str | None:
    """SHS grade level from profiles.grade_level — returns '11', '12', or None."""
    s = str(grade_level or "").strip().lower()
    if not s:
        return None
    m = re.search(r"\b(11|12)\b", s)
    if m:
        return m.group(1)
    if s in ("11", "12"):
        return s
    return None


def _teacher_owned_subject_ids(teacher_id_number: str) -> list[str]:
    tid = (teacher_id_number or "").strip()
    if not tid:
        return []
    return [
        str(s["id"])
        for s in list_subjects_for_teacher_owner(tid)
        if s.get("id")
    ]


def _student_uuids_enrolled_in_teacher_subjects(
    teacher_id_number: str,
    grading_period_id: str | None = None,
) -> set[str]:
    """Distinct students enrolled in any subject owned by this teacher."""
    subject_ids = _teacher_owned_subject_ids(teacher_id_number)
    if not subject_ids:
        return set()
    try:
        q = (
            _sb()
            .table("enrollments")
            .select("student_id")
            .in_("subject_id", subject_ids)
        )
        if grading_period_id:
            q = q.eq("grading_period_id", grading_period_id)
        res = q.execute()
        return {
            str(r["student_id"])
            for r in (res.data or [])
            if r.get("student_id")
        }
    except Exception as e:
        print(f"_student_uuids_enrolled_in_teacher_subjects: {e}")
        return set()


def _fetch_student_profiles_by_uuids(uuids: set[str] | list[str]) -> list[dict[str, Any]]:
    ids = [str(u) for u in uuids if u]
    if not ids:
        return []
    cols = (
        "id, last_name, first_name, middle_name, name_suffix, lrn, "
        "email, role, grade_level, strand, section"
    )
    out: list[dict[str, Any]] = []
    chunk = 80
    for i in range(0, len(ids), chunk):
        batch = ids[i : i + chunk]
        try:
            res = (
                _sb()
                .table("profiles")
                .select(cols)
                .in_("id", batch)
                .eq("role", "student")
                .execute()
            )
            for row in res.data or []:
                normalized = normalize_profile_row(row)
                if normalized:
                    out.append(normalized)
        except Exception as e:
            print(f"_fetch_student_profiles_by_uuids: {e}")
    return out


def list_gradecard_strands_for_teacher(teacher_id_number: str) -> list[dict[str, Any]]:
    """SHS strands with counts of enrolled students the teacher can grade."""
    student_uuids = _student_uuids_enrolled_in_teacher_subjects(teacher_id_number)
    profiles = _fetch_student_profiles_by_uuids(student_uuids)
    counts: dict[str, int] = {s: 0 for s in SHS_STRANDS}
    grade_counts: dict[str, dict[str, int]] = {
        s: {"11": 0, "12": 0} for s in SHS_STRANDS
    }
    unassigned = 0
    unassigned_grades = {"11": 0, "12": 0}
    for p in profiles:
        norm = normalize_profile_strand(p.get("strand"))
        gl = normalize_profile_grade_level(p.get("grade_level"))
        if norm in counts:
            counts[norm] += 1
            if gl in ("11", "12"):
                grade_counts[norm][gl] += 1
        else:
            unassigned += 1
            if gl in ("11", "12"):
                unassigned_grades[gl] += 1
    rows = [
        {
            "strand": s,
            "label": s,
            "student_count": counts[s],
            "grade_11_count": grade_counts[s]["11"],
            "grade_12_count": grade_counts[s]["12"],
        }
        for s in SHS_STRANDS
    ]
    if unassigned:
        rows.append(
            {
                "strand": "__unassigned__",
                "label": "No strand set",
                "student_count": unassigned,
                "grade_11_count": unassigned_grades["11"],
                "grade_12_count": unassigned_grades["12"],
            }
        )
    return rows


def list_gradecard_students_for_teacher(
    teacher_id_number: str,
    strand: str,
    *,
    search: str | None = None,
    grade_level: str | None = None,
) -> list[dict[str, Any]]:
    """Students in a strand enrolled in the teacher's subjects."""
    norm_strand = normalize_profile_strand(strand)
    if strand == "__unassigned__":
        norm_strand = None
        match_unassigned = True
    else:
        match_unassigned = False
        if not norm_strand or norm_strand not in SHS_STRANDS:
            return []

    norm_grade = normalize_profile_grade_level(grade_level) if grade_level else None
    if grade_level and norm_grade not in ("11", "12"):
        return []

    student_uuids = _student_uuids_enrolled_in_teacher_subjects(teacher_id_number)
    profiles = _fetch_student_profiles_by_uuids(student_uuids)
    needle = (search or "").strip().lower()
    out: list[dict[str, Any]] = []

    for p in profiles:
        p_strand = normalize_profile_strand(p.get("strand"))
        if match_unassigned:
            if p_strand in SHS_STRANDS:
                continue
        elif p_strand != norm_strand:
            continue

        if norm_grade:
            p_grade = normalize_profile_grade_level(p.get("grade_level"))
            if p_grade != norm_grade:
                continue

        row = serialize_public_profile(p)
        if needle:
            hay = " ".join(
                [
                    row.get("display_name") or "",
                    row.get("id_number") or "",
                    row.get("email") or "",
                    row.get("section") or "",
                ]
            ).lower()
            if needle not in hay:
                continue
        out.append(row)

    out.sort(key=lambda x: (x.get("display_name") or x.get("id_number") or "").lower())
    return out


IMMERSION_REQUIRED_HOURS = 600


def teacher_can_view_student_immersion(
    teacher_id_number: str,
    student_id_number: str,
    *,
    grade_level: str = "12",
) -> bool:
    """True when the student is Grade 12 (by default) and enrolled in the teacher's subjects."""
    tid = str(teacher_id_number or "").strip()
    sid = str(student_id_number or "").strip()
    if not tid or not sid:
        return False
    prof = get_profile_by_id_number(sid)
    if not prof or str(prof.get("role") or "").strip().lower() != "student":
        return False
    if grade_level:
        gl = normalize_profile_grade_level(prof.get("grade_level"))
        if gl != str(grade_level).strip():
            return False
    student_uuid = str(prof.get("id") or "")
    if not student_uuid:
        return False
    enrolled = _student_uuids_enrolled_in_teacher_subjects(tid)
    return student_uuid in enrolled


def list_recent_immersion_checkins_for_teacher(
    teacher_id_number: str,
    *,
    since: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Time In / Time Out events for this teacher's Grade 12 immersion
    students, newer than `since` (ISO timestamp). Powers the workplace QR
    display's live voice announcement — it polls this and speaks each new
    event as it lands."""
    tid = str(teacher_id_number or "").strip()
    if not tid:
        return []
    student_uuids = _student_uuids_enrolled_in_teacher_subjects(tid)
    if not student_uuids:
        return []
    profiles = _fetch_student_profiles_by_uuids(student_uuids)
    grade12 = [p for p in profiles if normalize_profile_grade_level(p.get("grade_level")) == "12"]
    if not grade12:
        return []
    name_by_uuid = {
        str(p.get("id")): (profile_display_name(p) or p.get("lrn") or "Student") for p in grade12
    }
    since_dt = _parse_iso_datetime(since)

    try:
        res = (
            _sb()
            .table("attendance_logs")
            .select("*")
            .in_("student_id", list(name_by_uuid.keys()))
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"list_recent_immersion_checkins_for_teacher: {e}")
        return []

    events: list[dict[str, Any]] = []
    for row in rows:
        sid = str(row.get("student_id") or "")
        name = name_by_uuid.get(sid)
        if not name:
            continue
        for field, action in (("time_in", "time_in"), ("time_out", "time_out")):
            raw = row.get(field)
            dt = _parse_iso_datetime(raw)
            if not dt or (since_dt and dt <= since_dt):
                continue
            events.append(
                {
                    "id": f"{row.get('id')}-{action}",
                    "student_id_number": row.get("student_id_number"),
                    "student_name": name,
                    "action": action,
                    "at": raw,
                }
            )

    events.sort(key=lambda e: e["at"] or "")
    return events[-limit:]


def _attendance_calendar_day(row: dict[str, Any]) -> str | None:
    d = row.get("date")
    if d:
        return str(d)[:10]
    tin = row.get("time_in")
    if not tin:
        return None
    s = str(tin).replace("Z", "+00:00")
    if "T" in s:
        return s.split("T", 1)[0]
    return s[:10] if len(s) >= 10 else None


def _parse_iso_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _hours_from_attendance_row(row: dict[str, Any], *, now: datetime | None = None) -> float:
    th = row.get("total_hours")
    if th is not None and th != "":
        try:
            return max(0.0, float(th))
        except (TypeError, ValueError):
            pass
    tin = _parse_iso_datetime(row.get("time_in"))
    if not tin:
        return 0.0
    tout = _parse_iso_datetime(row.get("time_out"))
    end = tout or (now or datetime.now(timezone.utc))
    if end < tin:
        return 0.0
    return max(0.0, round((end - tin).total_seconds() / 3600.0, 2))


def enrich_students_with_immersion_status(students: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """At-a-glance immersion status per student, added in one bulk query
    instead of one request per student: today_status ('at_work' | 'completed'
    | 'not_started'), total_hours_rendered, percent_complete. Used by the
    Immersion Attendance student list so a teacher can see who's currently
    at work without opening each student individually."""
    student_uuids = [str(s.get("id")) for s in students if s.get("id")]
    if not student_uuids:
        return students
    try:
        res = _sb().table("attendance_logs").select("*").in_("student_id", student_uuids).execute()
        rows = res.data or []
    except Exception as e:
        print(f"enrich_students_with_immersion_status: {e}")
        return students

    by_student: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_student[str(r.get("student_id") or "")].append(r)

    today_str = datetime.now(timezone.utc).date().isoformat()
    for s in students:
        uid = str(s.get("id") or "")
        logs = by_student.get(uid, [])
        total_hours = sum(_hours_from_attendance_row(r) for r in logs)
        today_row = next((r for r in logs if _attendance_calendar_day(r) == today_str), None)
        if today_row and not today_row.get("time_out"):
            status = "at_work"
        elif today_row:
            status = "completed"
        else:
            status = "not_started"
        s["today_status"] = status
        s["total_hours_rendered"] = round(total_hours, 2)
        s["percent_complete"] = (
            round(min(100, (total_hours / IMMERSION_REQUIRED_HOURS) * 100))
            if IMMERSION_REQUIRED_HOURS
            else 0
        )
    return students


_ATTENDANCE_B64_KEYS = frozenset({"captured_photo_base64", "time_out_photo_base64"})
_ATTENDANCE_PHOTO_URL_KEYS = frozenset(
    {"photo_url", "time_in_photo_url", "time_out_photo_url"}
)


def _attendance_photo_flags(row: dict[str, Any] | None) -> tuple[bool, bool]:
    if not row:
        return False, False
    has_in = bool(
        row.get("captured_photo_path")
        or row.get("captured_photo_base64")
        or row.get("photo_url")
        or row.get("time_in_photo_url")
    )
    has_out = bool(
        row.get("time_out_photo_path")
        or row.get("time_out_photo_base64")
        or row.get("time_out_photo_url")
    )
    return has_in, has_out


def _attach_teacher_photo_api_urls(out: dict[str, Any], student_id_number: str) -> dict[str, Any]:
    """Use image endpoint URLs (img tags cannot send Bearer headers)."""
    aid = str(out.get("id") or "")
    if not aid:
        return out
    sid_q = urllib.parse.quote(student_id_number.strip())
    aid_q = urllib.parse.quote(aid)
    if out.get("has_time_in_photo"):
        u = (
            f"/teacher/immersion/attendance-photo?student_id_number={sid_q}"
            f"&attendance_id={aid_q}&kind=time_in"
        )
        out["photo_url"] = u
        out["time_in_photo_url"] = u
    if out.get("has_time_out_photo"):
        out["time_out_photo_url"] = (
            f"/teacher/immersion/attendance-photo?student_id_number={sid_q}"
            f"&attendance_id={aid_q}&kind=time_out"
        )
    return out


def _attendance_for_teacher_api(
    row: dict[str, Any] | None,
    *,
    include_photos: bool = False,
    student_id_number: str | None = None,
) -> dict[str, Any] | None:
    """Strip raw base64 from payloads; optionally include verification photo URLs."""
    if not row:
        return None
    raw = {**row}
    has_in, has_out = _attendance_photo_flags(raw)
    enriched = enrich_attendance_row(raw) or {}
    out = {k: v for k, v in enriched.items() if k not in _ATTENDANCE_B64_KEYS}
    out["has_time_in_photo"] = has_in
    out["has_time_out_photo"] = has_out
    if include_photos and student_id_number:
        out = _attach_teacher_photo_api_urls(out, student_id_number)
    elif not include_photos:
        for k in _ATTENDANCE_PHOTO_URL_KEYS:
            out.pop(k, None)
    return out


def _attendance_belongs_to_student(row: dict[str, Any], student_id_number: str) -> bool:
    sid = str(student_id_number or "").strip()
    if not sid or not row:
        return False
    if str(row.get("student_id_number") or "").strip() == sid:
        return True
    pid = profile_uuid_for_id_number(sid)
    if pid and str(row.get("student_id") or "") == str(pid):
        return True
    return False


def get_attendance_log_by_id(attendance_id: str) -> dict[str, Any] | None:
    aid = str(attendance_id or "").strip()
    if not aid:
        return None
    try:
        res = _sb().table("attendance_logs").select("*").eq("id", aid).limit(1).execute()
        rows = res.data or []
        return rows[0] if rows else None
    except Exception as e:
        print(f"get_attendance_log_by_id: {e}")
        return None


def get_teacher_immersion_attendance_session(
    teacher_id_number: str,
    student_id_number: str,
    attendance_id: str,
) -> dict[str, Any]:
    """Single attendance row with Time In / Time Out photo URLs for teacher review."""
    if not teacher_can_view_student_immersion(teacher_id_number, student_id_number):
        raise PermissionError("You do not have access to this student's immersion records.")
    row = get_attendance_log_by_id(attendance_id)
    if not row:
        raise ValueError("Attendance session not found.")
    if not _attendance_belongs_to_student(row, student_id_number):
        raise PermissionError("This attendance record does not belong to the selected student.")
    clean = _attendance_for_teacher_api(
        row, include_photos=True, student_id_number=student_id_number.strip()
    )
    if not clean:
        raise ValueError("Attendance session not found.")
    clean["calendar_date"] = _attendance_calendar_day(row)
    clean["hours_rendered"] = _hours_from_attendance_row(row)
    return clean


def build_teacher_immersion_student_overview(
    teacher_id_number: str,
    student_id_number: str,
    *,
    limit: int = 120,
) -> dict[str, Any]:
    """Immersion summary for teacher monitor: hours, today, active session, logs, journals."""
    if not teacher_can_view_student_immersion(teacher_id_number, student_id_number):
        raise PermissionError("You do not have access to this student's immersion records.")

    prof = get_profile_by_id_number(student_id_number.strip())
    if not prof:
        raise ValueError("Student profile not found.")

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    cap = max(1, min(int(limit), 200))

    raw_rows = list_attendance_by_student(student_id_number.strip())
    enriched = [enrich_attendance_row(r) for r in raw_rows]
    sid = student_id_number.strip()
    active_raw = get_active_attendance(sid)
    active = _attendance_for_teacher_api(active_raw, include_photos=True, student_id_number=sid)

    total_rendered = 0.0
    days_attended: set[str] = set()
    today_row: dict[str, Any] | None = None

    for r in enriched:
        day = _attendance_calendar_day(r)
        if day:
            days_attended.add(day)
        if day == today and today_row is None:
            today_row = r
        st = str(r.get("status") or "").strip().lower()
        if st == "completed" or r.get("time_out"):
            total_rendered += _hours_from_attendance_row(r, now=now)

    if today_row is None:
        for r in enriched:
            if _attendance_calendar_day(r) == today:
                today_row = r
                break

    today_hours = 0.0
    today_status = "not_started"
    if active_raw:
        today_status = "at_work"
        today_hours = _hours_from_attendance_row(active_raw, now=now)
        if not today_row:
            today_row = active_raw
    elif today_row:
        today_hours = _hours_from_attendance_row(today_row, now=now)
        if today_row.get("time_out"):
            today_status = "completed"
        elif today_row.get("time_in"):
            today_status = "clocked_in"

    remaining = max(0.0, round(IMMERSION_REQUIRED_HOURS - total_rendered, 2))
    percent = (
        round(min(100.0, (total_rendered / IMMERSION_REQUIRED_HOURS) * 100.0), 1)
        if IMMERSION_REQUIRED_HOURS > 0
        else 0.0
    )

    attendance_out: list[dict[str, Any]] = []
    for r in enriched[:cap]:
        clean = _attendance_for_teacher_api(r, include_photos=False, student_id_number=sid)
        if not clean:
            continue
        clean = {**clean, "calendar_date": _attendance_calendar_day(r)}
        clean["hours_rendered"] = _hours_from_attendance_row(r, now=now)
        attendance_out.append(clean)

    journals_raw = list_journals_for_student(student_id_number.strip())
    journals: list[dict[str, Any]] = []
    for j in journals_raw[:50]:
        body = (j.get("journal_text") or j.get("body") or "").strip()
        journals.append(
            {
                "id": j.get("id"),
                "body": body,
                "entry_date": j.get("entry_date") or _attendance_calendar_day(j),
                "submitted_at": j.get("submitted_at") or j.get("created_at"),
                "attendance_id": j.get("attendance_id"),
            }
        )

    student = serialize_public_profile(prof)
    return {
        "student": student,
        "required_hours": IMMERSION_REQUIRED_HOURS,
        "total_hours_rendered": round(total_rendered, 2),
        "remaining_hours": remaining,
        "percent_complete": percent,
        "days_attended": len(days_attended),
        "journal_count": len(journals_raw),
        "today_date": today,
        "today_status": today_status,
        "today_hours": round(today_hours, 2),
        "today_session": _attendance_for_teacher_api(today_row, include_photos=True, student_id_number=sid)
        if today_row
        else None,
        "active": active,
        "is_at_work": bool(active_raw),
        "attendance": attendance_out,
        "journals": journals,
    }


# ---------- student_grades (per-subject rows) ----------

def get_student_grade(
    student_uuid: str,
    subject_id: str,
    grading_period_id: str | None,
) -> dict[str, Any] | None:
    if not student_uuid or not subject_id:
        return None
    try:
        q = (
            _sb()
            .table("student_grades")
            .select("*")
            .eq("student_id", student_uuid)
            .eq("subject_id", subject_id)
        )
        if grading_period_id:
            q = q.eq("grading_period_id", grading_period_id)
        res = q.limit(1).execute()
        return (res.data or [None])[0]
    except Exception as e:
        print(f"get_student_grade: {e}")
        return None


def merge_and_compute_student_grade(
    student_uuid: str,
    student_strand: str | None,
    subject_id: str,
    grading_period_id: str,
    partial: dict[str, Any],
) -> dict[str, Any]:
    """Merge teacher input with auto scores and DepEd weights; return upsert payload."""
    period = get_grading_period(grading_period_id)
    existing = get_student_grade(student_uuid, subject_id, grading_period_id) or {}

    subj = get_subject_row(subject_id) or {}
    deped_category = (subj.get("deped_category") or "academic_standard").strip().lower()
    weights = shs_component_weights(student_strand, deped_category)

    q = compute_quiz_average_for_subject(student_uuid, subject_id, period)
    a = compute_activity_average_for_subject(student_uuid, subject_id, period)
    qa_auto = compute_quarterly_assessment_for_subject(student_uuid, subject_id, period)

    def _pick(key: str, auto: float | None) -> float | None:
        if key in partial and partial[key] is not None:
            return float(partial[key])
        if existing.get(key) is not None:
            return float(existing[key])
        return auto

    ww = _pick("written_work_score", q["average"])
    pt = _pick("performance_task_score", a["average"])
    qa = _pick("quarterly_assessment_score", qa_auto["average"])

    computed_final = compute_weighted_final(ww, pt, qa, weights)
    final_is_manual = bool(
        partial["final_is_manual"]
        if "final_is_manual" in partial
        else existing.get("final_is_manual")
    )
    if final_is_manual and partial.get("final_grade") is not None:
        final_grade = float(partial["final_grade"])
    elif final_is_manual and existing.get("final_grade") is not None:
        final_grade = float(existing["final_grade"])
    elif computed_final is not None:
        final_grade = computed_final
        final_is_manual = False
    elif partial.get("final_grade") is not None:
        final_grade = float(partial["final_grade"])
    else:
        final_grade = existing.get("final_grade")

    out: dict[str, Any] = {
        "student_id": student_uuid,
        "subject_id": subject_id,
        "grading_period_id": grading_period_id,
        "teacher_id_number": partial.get("teacher_id_number") or existing.get("teacher_id_number"),
        "written_work_score": ww,
        "performance_task_score": pt,
        "quarterly_assessment_score": qa,
        "quiz_average": ww,
        "activity_average": pt,
        "attendance_percent": partial.get("attendance_percent") or existing.get("attendance_percent"),
        "final_grade": final_grade,
        "final_is_manual": final_is_manual,
        "remarks": partial.get("remarks") if "remarks" in partial else existing.get("remarks"),
        "teacher_comments": (
            partial.get("teacher_comments")
            if "teacher_comments" in partial
            else existing.get("teacher_comments")
        ),
    }
    if partial.get("finalized_at"):
        out["finalized_at"] = partial["finalized_at"]
    return out


def upsert_student_grade(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Insert or update a per-subject grade row.
    Required: student_id, subject_id, grading_period_id.
    Optional: written_work_score, performance_task_score, quarterly_assessment_score,
              quiz_average, activity_average, attendance_percent, final_grade,
              final_is_manual, remarks, teacher_comments, teacher_id_number, finalized_at.
    """
    sid = payload.get("student_id")
    sub = payload.get("subject_id")
    per = payload.get("grading_period_id")
    if not sid or not sub:
        raise RuntimeError("student_id and subject_id are required")

    row = {
        "student_id": sid,
        "subject_id": sub,
        "grading_period_id": per,
        "teacher_id_number": payload.get("teacher_id_number"),
        "written_work_score": payload.get("written_work_score"),
        "performance_task_score": payload.get("performance_task_score"),
        "quarterly_assessment_score": payload.get("quarterly_assessment_score"),
        "quiz_average": payload.get("quiz_average"),
        "activity_average": payload.get("activity_average"),
        "attendance_percent": payload.get("attendance_percent"),
        "final_grade": payload.get("final_grade"),
        "final_is_manual": payload.get("final_is_manual"),
        "remarks": payload.get("remarks"),
        "teacher_comments": payload.get("teacher_comments"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.get("finalized_at"):
        row["finalized_at"] = payload["finalized_at"]

    try:
        res = (
            _sb()
            .table("student_grades")
            .upsert(row, on_conflict="student_id,subject_id,grading_period_id")
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        print(f"upsert_student_grade: {e}")
        raise


# ---------- gradecards (top-level summary) ----------

def get_gradecard_row(
    student_uuid: str,
    grading_period_id: str | None,
) -> dict[str, Any] | None:
    if not student_uuid:
        return None
    try:
        q = _sb().table("gradecards").select("*").eq("student_id", student_uuid)
        if grading_period_id:
            q = q.eq("grading_period_id", grading_period_id)
        res = q.limit(1).execute()
        return (res.data or [None])[0]
    except Exception as e:
        print(f"get_gradecard_row: {e}")
        return None


def _classify_standing(avg: float | None) -> str:
    if avg is None:
        return "—"
    if avg >= 95:
        return "With Highest Honors"
    if avg >= 90:
        return "With High Honors"
    if avg >= 85:
        return "With Honors"
    if avg >= 75:
        return "Passed"
    return "Failed"


def _generate_reference_no(student_id_number: str | None, period: dict[str, Any] | None) -> str:
    if not period or not student_id_number:
        return "GR-XXXX-XXXX"
    sy = str(period.get("school_year") or "").replace(" ", "")
    name = str(period.get("name") or "").replace(" ", "")
    return f"GR-{sy}-{name}-{student_id_number}"


def upsert_gradecard(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Insert or update the top-level gradecard summary row."""
    sid = payload.get("student_id")
    per = payload.get("grading_period_id")
    if not sid or not per:
        raise RuntimeError("student_id and grading_period_id are required")

    row = {
        "student_id": sid,
        "grading_period_id": per,
        "general_average": payload.get("general_average"),
        "standing": payload.get("standing"),
        "conduct": payload.get("conduct"),
        "days_present": payload.get("days_present"),
        "days_absent": payload.get("days_absent"),
        "times_tardy": payload.get("times_tardy"),
        "adviser_comments": payload.get("adviser_comments"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if payload.get("reference_no"):
        row["reference_no"] = payload["reference_no"]
    if payload.get("finalized_at"):
        row["finalized_at"] = payload["finalized_at"]

    try:
        res = (
            _sb()
            .table("gradecards")
            .upsert(row, on_conflict="student_id,grading_period_id")
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        print(f"upsert_gradecard: {e}")
        raise


# ---------- activity_attempts ----------

def insert_activity_attempt(payload: dict[str, Any]) -> dict[str, Any]:
    """Record a student's activity submission (essay / flashcards review)."""
    student_uuid = payload.get("student_id")
    if not student_uuid:
        raise RuntimeError("student_id (profile UUID) is required")
    lesson_id = payload.get("lesson_id")
    if not lesson_id:
        raise RuntimeError("lesson_id is required")

    row = {
        "student_id": student_uuid,
        "lesson_id": str(lesson_id),
        "activity_index": int(payload.get("activity_index") or 0),
        "activity_type": str(payload.get("activity_type") or "essay"),
        "response": payload.get("response"),
        "score": payload.get("score"),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        res = _sb().table("activity_attempts").insert(row).execute()
        return (res.data or [None])[0]
    except Exception as e:
        print(f"insert_activity_attempt: {e}")
        raise


# ---------- Aggregating gradecard (the big one) ----------

def _collect_subject_ids_for_student(
    student_uuid: str,
    period: dict[str, Any] | None,
) -> list[str]:
    """Find subjects this student is associated with for the period.
    Considers enrollments + quiz_attempts + activity_attempts (within the period).
    """
    subject_ids: set[str] = set()

    # 1) From enrollments
    try:
        q = _sb().table("enrollments").select("subject_id, grading_period_id").eq("student_id", student_uuid)
        res = q.execute()
        for r in res.data or []:
            sid = r.get("subject_id")
            if not sid:
                continue
            # If row has no period, include it; if it has a period, match it
            row_period = r.get("grading_period_id")
            if not row_period or not period or str(row_period) == str(period.get("id")):
                subject_ids.add(str(sid))
    except Exception as e:
        print(f"_collect_subject_ids_for_student enrollments: {e}")

    start, end = _period_date_range(period)

    # 2) From quiz_attempts → lessons.subject_id
    try:
        q = _sb().table("quiz_attempts").select("lesson_id, submitted_at").eq("student_id", student_uuid)
        if start and end:
            q = q.gte("submitted_at", start).lt("submitted_at", end)
        qa = q.execute()
        lesson_ids = list({str(r["lesson_id"]) for r in (qa.data or []) if r.get("lesson_id")})
        if lesson_ids:
            lres = (
                _sb()
                .table("lessons")
                .select("id, subject_id")
                .in_("id", lesson_ids)
                .execute()
            )
            for r in lres.data or []:
                if r.get("subject_id"):
                    subject_ids.add(str(r["subject_id"]))
    except Exception as e:
        print(f"_collect_subject_ids_for_student quiz_attempts: {e}")

    # 3) From activity_attempts → lessons.subject_id
    try:
        q = _sb().table("activity_attempts").select("lesson_id, submitted_at").eq("student_id", student_uuid)
        if start and end:
            q = q.gte("submitted_at", start).lt("submitted_at", end)
        aa = q.execute()
        lesson_ids = list({str(r["lesson_id"]) for r in (aa.data or []) if r.get("lesson_id")})
        if lesson_ids:
            lres = (
                _sb()
                .table("lessons")
                .select("id, subject_id")
                .in_("id", lesson_ids)
                .execute()
            )
            for r in lres.data or []:
                if r.get("subject_id"):
                    subject_ids.add(str(r["subject_id"]))
    except Exception as e:
        print(f"_collect_subject_ids_for_student activity_attempts: {e}")

    return sorted(subject_ids)


def _fetch_subjects_map(subject_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not subject_ids:
        return {}
    try:
        res = (
            _sb()
            .table("subjects")
            .select("id, name, color, description, deped_category")
            .in_("id", subject_ids)
            .execute()
        )
        return {str(r["id"]): r for r in (res.data or [])}
    except Exception as e:
        print(f"_fetch_subjects_map: {e}")
        return {}


def _fetch_teacher_for_subject(student_uuid: str, subject_id: str) -> str | None:
    """Pick a representative teacher_id_number for the given subject (prefer enrollment row)."""
    try:
        res = (
            _sb()
            .table("enrollments")
            .select("teacher_id_number")
            .eq("student_id", student_uuid)
            .eq("subject_id", subject_id)
            .not_.is_("teacher_id_number", "null")
            .limit(1)
            .execute()
        )
        if res.data and res.data[0].get("teacher_id_number"):
            return str(res.data[0]["teacher_id_number"])
    except Exception:
        pass
    try:
        res = (
            _sb()
            .table("lessons")
            .select("teacher_id_number")
            .eq("subject_id", subject_id)
            .not_.is_("teacher_id_number", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and res.data[0].get("teacher_id_number"):
            return str(res.data[0]["teacher_id_number"])
    except Exception as e:
        print(f"_fetch_teacher_for_subject: {e}")
    return None


def _profile_lookup_by_id_numbers(idns: list[str]) -> dict[str, dict[str, Any]]:
    cleaned = list({str(x).strip() for x in idns if x})
    if not cleaned:
        return {}
    try:
        res = (
            _sb()
            .table("profiles")
            .select(_PROFILE_NAME_COLS)
            .in_("id_number", cleaned)
            .execute()
        )
        return {str(r["id_number"]): r for r in (res.data or [])}
    except Exception as e:
        print(f"_profile_lookup_by_id_numbers: {e}")
        return {}


def build_full_gradecard(
    student_id_number: str,
    grading_period_id: str | None = None,
) -> dict[str, Any]:
    """Return a complete gradecard JSON ready for the frontend."""
    student = get_profile_by_id_number(student_id_number)
    if not student:
        raise RuntimeError(f"Student profile not found for id_number={student_id_number}")
    student_uuid = str(student["id"])

    period = get_grading_period(grading_period_id)

    # Subjects derived from enrollments + activity
    subject_ids = _collect_subject_ids_for_student(student_uuid, period)
    subjects_map = _fetch_subjects_map(subject_ids)

    # Pull any existing student_grades rows so teacher overrides win
    grade_rows_by_subject: dict[str, dict[str, Any]] = {}
    if subject_ids and period:
        try:
            res = (
                _sb()
                .table("student_grades")
                .select("*")
                .eq("student_id", student_uuid)
                .eq("grading_period_id", period["id"])
                .in_("subject_id", subject_ids)
                .execute()
            )
            for r in res.data or []:
                grade_rows_by_subject[str(r["subject_id"])] = r
        except Exception as e:
            print(f"build_full_gradecard student_grades: {e}")

    # Build subject rows
    subjects_out: list[dict[str, Any]] = []
    teacher_idns_needed: set[str] = set()

    for sid in subject_ids:
        subj = subjects_map.get(sid, {"id": sid, "name": "Unknown subject"})
        existing = grade_rows_by_subject.get(sid) or {}

        q = compute_quiz_average_for_subject(student_uuid, sid, period)
        a = compute_activity_average_for_subject(student_uuid, sid, period)
        qa_lesson = compute_quarterly_assessment_for_subject(student_uuid, sid, period)
        att = compute_attendance_stats(student_uuid, student_id_number, period)

        teacher_idn = existing.get("teacher_id_number") or _fetch_teacher_for_subject(student_uuid, sid)
        if teacher_idn:
            teacher_idns_needed.add(teacher_idn)

        deped_category = (subj.get("deped_category") or "academic_standard").strip().lower()
        weights = shs_component_weights(student.get("strand"), deped_category)

        ww, pt, qa = resolve_component_scores(
            auto_ww=q["average"],
            auto_pt=a["average"],
            auto_qa=qa_lesson["average"],
            stored=existing,
        )
        computed_final = compute_weighted_final(ww, pt, qa, weights)
        final_is_manual = bool(existing.get("final_is_manual"))
        if final_is_manual and existing.get("final_grade") is not None:
            display_final = float(existing["final_grade"])
        elif computed_final is not None:
            display_final = computed_final
        elif existing.get("final_grade") is not None:
            display_final = float(existing["final_grade"])
        else:
            display_final = None

        subjects_out.append({
            "subject_id": sid,
            "subject_name": subj.get("name"),
            "subject_color": subj.get("color"),
            "deped_category": deped_category,
            "weights": weights,
            "weights_label": format_weights_label(weights),
            "teacher_id_number": teacher_idn,
            "teacher_name": None,  # filled below
            "written_work_score": ww,
            "written_work_auto": q["average"],
            "written_work_attempts": q["attempts"],
            "performance_task_score": pt,
            "performance_task_auto": a["average"],
            "performance_task_attempts": a["attempts"],
            "quarterly_assessment_score": qa,
            "quarterly_assessment_auto": qa_lesson["average"],
            "quarterly_assessment_attempts": qa_lesson["attempts"],
            "quiz_average": q["average"],
            "quiz_attempts": q["attempts"],
            "activity_average": a["average"],
            "activity_attempts": a["attempts"],
            "attendance_percent": att["percent"],
            "attendance_present": att["present"],
            "attendance_absent": att["absent"],
            "attendance_tardy": att["tardy"],
            "computed_final": computed_final,
            "final_grade": display_final,
            "final_is_manual": final_is_manual,
            "final_is_override": final_is_manual,
            "grade_complete": computed_final is not None,
            "remarks": existing.get("remarks"),
            "teacher_comments": existing.get("teacher_comments"),
            "finalized_at": existing.get("finalized_at"),
        })

    # Resolve teacher names + adviser
    adviser_idn = (student.get("adviser_id_number") or "").strip() if student.get("adviser_id_number") else ""
    if adviser_idn:
        teacher_idns_needed.add(adviser_idn)
    profile_map = _profile_lookup_by_id_numbers(list(teacher_idns_needed))
    for row in subjects_out:
        tidn = row.get("teacher_id_number")
        if tidn and tidn in profile_map:
            row["teacher_name"] = profile_display_name(profile_map[tidn])

    adviser_profile = profile_map.get(adviser_idn) if adviser_idn else None

    # Top-level summary
    finals = [s["final_grade"] for s in subjects_out if s.get("final_grade") is not None]
    auto_general = round(sum(finals) / len(finals), 2) if finals else None

    auto_att = compute_attendance_stats(student_uuid, student_id_number, period)

    summary_row = get_gradecard_row(student_uuid, period["id"] if period else None) or {}
    summary_out = {
        "id": summary_row.get("id"),
        "reference_no": summary_row.get("reference_no")
            or _generate_reference_no(profile_lrn_from_row(student), period),
        "general_average": summary_row.get("general_average")
            if summary_row.get("general_average") is not None else auto_general,
        "general_average_auto": auto_general,
        "standing": summary_row.get("standing")
            or _classify_standing(summary_row.get("general_average")
                                  if summary_row.get("general_average") is not None else auto_general),
        "conduct": summary_row.get("conduct"),
        "days_present": summary_row.get("days_present")
            if summary_row.get("days_present") is not None else auto_att["present"],
        "days_absent": summary_row.get("days_absent")
            if summary_row.get("days_absent") is not None else auto_att["absent"],
        "times_tardy": summary_row.get("times_tardy")
            if summary_row.get("times_tardy") is not None else auto_att["tardy"],
        "adviser_comments": summary_row.get("adviser_comments"),
        "finalized_at": summary_row.get("finalized_at"),
    }

    return {
        "student": {
            "id": student_uuid,
            "lrn": profile_lrn_from_row(student),
            "id_number": profile_lrn_from_row(student),
            "display_name": profile_display_name(student),
            "first_name": student.get("first_name"),
            "last_name": student.get("last_name"),
            "middle_name": student.get("middle_name"),
            "name_suffix": student.get("name_suffix"),
            "email": student.get("email"),
            "role": student.get("role"),
            "grade_level": student.get("grade_level"),
            "section": student.get("section"),
            "track": student.get("track"),
            "strand": student.get("strand"),
            "adviser_id_number": adviser_idn or None,
        },
        "adviser": ({
            "lrn": profile_lrn_from_row(adviser_profile),
            "id_number": profile_lrn_from_row(adviser_profile),
            "display_name": profile_display_name(adviser_profile),
        } if adviser_profile else None),
        "period": period,
        "subjects": subjects_out,
        "summary": summary_out,
    }

