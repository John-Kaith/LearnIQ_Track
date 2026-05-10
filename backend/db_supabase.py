"""Small Supabase helpers for lessons and related tables (beginner-friendly)."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from supabase_client import supabase

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


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
            .eq("id_number", id_number)
            .eq("email", email.lower().strip())
            .single()
            .execute()
        )
        return response.data
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
        return response.data
    except Exception as e:
        print(f"Error getting profile by email: {e}")
        return None


def get_profile_by_id_number(id_number: str) -> dict[str, Any] | None:
    """Profile row for a school ID number (used for attendance_logs.student_id FK)."""
    try:
        res = _sb().table("profiles").select("*").eq("id_number", id_number.strip()).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"Error get_profile_by_id_number: {e}")
        return None


def profile_uuid_for_id_number(id_number: str) -> str | None:
    p = get_profile_by_id_number(id_number)
    if not p or not p.get("id"):
        return None
    return str(p["id"])


def insert_profile(
    full_name: str,
    id_number: str,
    email: str,
    password: str,
    role: str = "student",
    approval_status: str = "pending",
    auth_user_id: str | None = None,
) -> dict[str, Any]:
    row = {
        "full_name": full_name,
        "id_number": id_number,
        "email": email.lower().strip(),
        "password": password,
        "role": role,
        "approval_status": approval_status,
    }
    
    # If auth_user_id is provided, use it as the profile ID
    if auth_user_id:
        row["id"] = auth_user_id
    
    res = _sb().table("profiles").insert(row).execute()
    return res.data[0] if res.data else row


def list_profiles() -> list[dict[str, Any]]:
    res = _sb().table("profiles").select("*").order("created_at", desc=True).execute()
    return res.data or []


def get_all_profiles() -> list[dict[str, Any]]:
    """Get all profiles without passwords."""
    res = _sb().table("profiles").select("*").order("created_at", desc=True).execute()
    profiles = res.data or []
    # Remove passwords from response
    for profile in profiles:
        profile.pop("password", None)
    return profiles


def update_user_approval_status(id_number: str, approval_status: str) -> bool:
    """Update a user's approval status."""
    try:
        print(f"DEBUG: Database update - id_number: {id_number}, approval_status: {approval_status}")
        result = (
            _sb()
            .table("profiles")
            .update({"approval_status": approval_status})
            .eq("id_number", id_number)
            .execute()
        )
        print(f"DEBUG: Database update result data: {result.data}")
        print(f"DEBUG: Database update result length: {len(result.data) if result.data else 0}")
        return len(result.data) > 0
    except Exception as e:
        print(f"Error updating user approval status: {e}")
        return False


def update_profile_status(id_number: str, approval_status: str) -> None:
    _sb().table("profiles").update({"approval_status": approval_status}).eq("id_number", id_number).execute()


def insert_lesson(
    filename: str,
    file_type: str,
    extracted_text: str,
    storage_path: str | None,
    teacher_id_number: str | None = None,
) -> dict[str, Any]:
    print(f"INSERT LESSON CALLED:")
    print(f"  filename: {filename}")
    print(f"  file_type: {file_type}")
    print(f"  teacher_id_number: {teacher_id_number}")
    
    # Support both new and older lessons table schemas.
    # Try full row first, then retry without columns older schemas may not have.
    attempts = [
        {
            "filename": filename,
            "file_type": file_type,
            "extracted_text": extracted_text,
            "storage_path": storage_path,
            "is_published": False,
            "teacher_id_number": teacher_id_number,
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
    last_error: Exception | None = None
    res = None
    for i, lesson_row in enumerate(attempts):
        try:
            print(f"  Attempt {i+1}: inserting row: {lesson_row}")
            res = _sb().table("lessons").insert(lesson_row).execute()
            print(f"  Insert lesson response: {res.data}")
            break
        except Exception as e:
            print(f"  Attempt {i+1} failed: {e}")
            last_error = e
    if res is None:
        if last_error is not None:
            raise last_error
        raise RuntimeError("Failed to insert lesson.")
    lesson = res.data[0]
    lid = lesson["id"]
    print(f"  Lesson inserted with ID: {lid}")
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
    res = (
        _sb()
        .table("lessons")
        .select("id, filename, file_type, is_published, created_at, teacher_id_number, lesson_content(reviewer, quiz, activities)")
        .eq("teacher_id_number", teacher_id_number)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def list_all_lessons() -> list[dict[str, Any]]:
    """All lesson uploads (admin dashboard, files table)."""
    res = (
        _sb()
        .table("lessons")
        .select("id, filename, file_type, is_published, created_at, teacher_id_number, lesson_content(reviewer, quiz, activities)")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


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
        num = p.get("id_number")
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
    by_idnum = {str(p.get("id_number") or "").strip(): p for p in profiles if p.get("id_number")}

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
            name = str(by_uuid[str(pid)].get("full_name") or "").strip()
        if not name and idn:
            p = by_idnum.get(idn) or get_profile_by_id_number(idn)
            name = str((p or {}).get("full_name") or "").strip() or idn
        student_display = name.strip() if name.strip() else (idn or "—")

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
    by_idnum = {str(p.get("id_number") or "").strip(): p for p in profiles if p.get("id_number")}

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
            name = str(by_uuid[str(pid)].get("full_name") or "").strip()
        if not name and idn:
            p = by_idnum.get(idn) or get_profile_by_id_number(idn)
            name = str((p or {}).get("full_name") or "").strip() or idn
        student_display = name.strip() if name.strip() else (idn or "—")
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
        nm = str(p.get("full_name") or "User").strip()
        role = str(p.get("role") or "").strip().lower()
        st = str(p.get("approval_status") or "pending").strip()
        items.append(
            {
                "kind": "profile",
                "title": f'{nm or "Account"} ({role or "user"})',
                "detail": f"Registration status: {st}",
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
                who = str(by_uuid[str(sid)].get("full_name") or "").strip()
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

    def st(p: dict[str, Any]) -> str:
        return str(p.get("approval_status") or "pending").strip().lower()

    total_students = sum(1 for p in profiles if rrole(p) == "student")
    total_teachers = sum(1 for p in profiles if rrole(p) == "teacher")
    pending_approvals = sum(
        1 for p in profiles if st(p) == "pending" and rrole(p) in ("student", "teacher")
    )
    approved_accounts = sum(1 for p in profiles if st(p) == "approved")
    rejected_accounts = sum(1 for p in profiles if st(p) == "rejected")

    lessons_rows = list_all_lessons()
    lessons_published = sum(1 for row in lessons_rows if row.get("is_published"))

    return {
        "total_accounts": len(profiles),
        "total_students": total_students,
        "total_teachers": total_teachers,
        "pending_approvals": pending_approvals,
        "approved_accounts": approved_accounts,
        "rejected_accounts": rejected_accounts,
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


def list_published_lessons_with_content() -> list[dict[str, Any]]:
    res = (
        _sb()
        .table("lessons")
        .select("*, lesson_content(*)")
        .eq("is_published", True)
        .order("created_at", desc=True)
        .execute()
    )
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
        lessons.append({
            "file_id": clean["id"],
            "filename": clean.get("filename") or "",
            "file_type": clean.get("file_type") or "",
            "created_at": clean.get("created_at"),
            "reviewer": reviewer_str,
            "quiz": quiz,
            "activities": activities,
        })
    
    return lessons


def get_published_lesson_with_content() -> tuple[dict[str, Any], dict[str, Any]] | None:
    res = (
        _sb()
        .table("lessons")
        .select("*, lesson_content(*)")
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
                .select("id, full_name, id_number, role")
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
                "full_name": (str(prof.get("full_name") or "").strip() or "Student"),
                "id_number": (str(prof.get("id_number") or "").strip()),
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
    base["lessons_uploaded"] = n_lessons
    base["lessons_this_month"] = this_month
    if n_lessons == 0:
        base["lessons_uploaded_note"] = "Upload your first lesson"
    elif this_month > 0:
        base["lessons_uploaded_note"] = f"+{this_month} this month"
    else:
        base["lessons_uploaded_note"] = "No uploads this month"

    if not lesson_ids:
        return base

    try:
        att_res = _sb().table("quiz_attempts").select("*").execute()
    except Exception as e:
        print(f"get_teacher_learniq_dashboard_stats quiz_attempts: {e}")
        return base

    rows = att_res.data or []
    relevant = [r for r in rows if str(r.get("lesson_id") or "") in lesson_ids]
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
                _sb().table("profiles").select("id, full_name, id_number, role").in_("id", chunk_ids).execute()
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
                "full_name": (str(prof.get("full_name") or "").strip() or None),
                "id_number": (str(prof.get("id_number") or "").strip() or None),
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
        if top.get("full_name"):
            sp["top_name"] = top["full_name"]
            sp["top_id_number"] = top.get("id_number")
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
        if (e.get("id_number") or "").strip() == sid_key:
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
    return updated.data[0] if updated.data else {
        "id": attendance_id,
        "time_out": time_out_iso,
        "total_hours": total_hours,
        "status": "completed",
    }


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
        "lesson_content": {
            "reviewer": lc.get("reviewer"),
            "quiz": quiz,
            "activities": lc.get("activities"),
        },
    }
