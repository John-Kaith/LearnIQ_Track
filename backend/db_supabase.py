"""Small Supabase helpers for lessons and related tables (beginner-friendly)."""
from __future__ import annotations

from datetime import datetime
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


def insert_profile(
    full_name: str,
    id_number: str,
    email: str,
    password: str,
    role: str = "student",
    approval_status: str = "pending",
) -> dict[str, Any]:
    row = {
        "full_name": full_name,
        "id_number": id_number,
        "email": email.lower().strip(),
        "password": password,
        "role": role,
        "approval_status": approval_status,
    }
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
        result = (
            _sb()
            .table("profiles")
            .update({"approval_status": approval_status})
            .eq("id_number", id_number)
            .execute()
        )
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
    for lesson_row in attempts:
        try:
            res = _sb().table("lessons").insert(lesson_row).execute()
            break
        except Exception as e:
            last_error = e
    if res is None:
        if last_error is not None:
            raise last_error
        raise RuntimeError("Failed to insert lesson.")
    lesson = res.data[0]
    lid = lesson["id"]
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
    unpublish_all_lessons()
    _sb().table("lessons").update({"is_published": True}).eq("id", lesson_id).execute()


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
    row = {
        "lesson_id": lesson_id,
        "score": score,
        "total_questions": total_questions,
        "answers": answers,
        "student_id_number": student_id_number,
    }
    res = _sb().table("quiz_attempts").insert(row).execute()
    return res.data[0] if res.data else row


def insert_attendance(student_id_number: str, event_type: str) -> dict[str, Any]:
    row = {"student_id_number": student_id_number, "event_type": event_type}
    res = _sb().table("attendance_logs").insert(row).execute()
    return res.data[0] if res.data else row


def list_attendance_for_student(student_id_number: str) -> list[dict[str, Any]]:
    res = (
        _sb()
        .table("attendance_logs")
        .select("*")
        .eq("student_id_number", student_id_number)
        .order("logged_at", desc=True)
        .execute()
    )
    return res.data or []


def insert_journal(student_id_number: str, body: str, entry_date: str | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {"student_id_number": student_id_number, "body": body}
    if entry_date:
        row["entry_date"] = entry_date
    res = _sb().table("journals").insert(row).execute()
    return res.data[0] if res.data else row


def list_journals_for_student(student_id_number: str) -> list[dict[str, Any]]:
    res = (
        _sb()
        .table("journals")
        .select("*")
        .eq("student_id_number", student_id_number)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def get_active_attendance(student_id_number: str) -> dict[str, Any] | None:
    res = (
        _sb()
        .table("attendance_logs")
        .select("*")
        .eq("student_id_number", student_id_number)
        .eq("status", "active")
        .order("time_in", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def insert_time_in(student_id_number: str, time_in_iso: str) -> dict[str, Any]:
    row = {
        "student_id_number": student_id_number,
        "time_in": time_in_iso,
        "status": "active",
        "time_out": None,
        "total_hours": None,
    }
    res = _sb().table("attendance_logs").insert(row).execute()
    return res.data[0] if res.data else row


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
    res = (
        _sb()
        .table("attendance_logs")
        .select("*")
        .eq("student_id_number", student_id_number)
        .order("time_in", desc=True)
        .execute()
    )
    return res.data or []


def insert_journal_linked(student_id_number: str, attendance_id: str, body: str) -> dict[str, Any]:
    row = {
        "student_id_number": student_id_number,
        "attendance_id": attendance_id,
        "body": body,
    }
    res = _sb().table("journals").insert(row).execute()
    return res.data[0] if res.data else row


def lesson_to_api_list_item(row: dict[str, Any]) -> dict[str, Any]:
    nested = row.get("lesson_content")
    if isinstance(nested, list):
        lc = nested[0] if nested else {}
    else:
        lc = nested or {}
    quiz = lc.get("quiz") or []
    if not isinstance(quiz, list):
        quiz = []
    return {
        "file_id": row["id"],
        "filename": row.get("filename") or "",
        "has_reviewer": bool(lc.get("reviewer")),
        "quiz_count": len(quiz),
        "has_activities": bool(lc.get("activities")),
        "published": bool(row.get("is_published")),
    }
