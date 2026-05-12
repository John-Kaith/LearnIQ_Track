import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
import requests
from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, UploadFile, HTTPException, Header, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
from supabase import create_client, Client

import db_supabase
from supabase_client import is_configured

# Always load `backend/.env` (same folder as this file), not only when cwd is `backend/`.
# `override=True` so values here win over a stale Windows `API_KEY` user env var.
_backend_env = Path(__file__).resolve().parent / ".env"
load_dotenv(_backend_env, override=True)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
API_KEY = os.getenv("API_KEY")

# Supabase Auth client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

app = FastAPI(title="LearnIQ Track API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_supabase():
    if not is_configured():
        return JSONResponse(
            {
                "error": "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
                "(or SUPABASE_KEY) to backend/.env and run supabase_schema.sql in the Supabase SQL editor."
            },
            status_code=503,
        )
    return None


def student_id_number_from_authorization(authorization: str | None) -> str | None:
    """Resolve school id_number from Supabase access token (Authorization: Bearer …)."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        ures = supabase.auth.get_user(jwt=token)
        if not ures:
            return None
        user = getattr(ures, "user", None)
        email = getattr(user, "email", None) if user is not None else None
        if not email:
            return None
        prof = db_supabase.get_profile_by_email(email)
        if not prof:
            return None
        sid = prof.get("id_number")
        return str(sid).strip() if sid else None
    except Exception as e:
        print("student_id_number_from_authorization:", e)
        return None


def resolve_student_id_number_or_403(body: dict, authorization: str | None):
    """Returns (id_number, None) or (None, JSONResponse)."""
    token_sid = student_id_number_from_authorization(authorization)
    body_sid = (body.get("student_id_number") or body.get("student_id") or "").strip()
    if token_sid and body_sid and body_sid != token_sid:
        return None, JSONResponse(
            {"error": "student_id_number does not match signed-in user."},
            status_code=403,
        )
    sid = token_sid or body_sid
    if not sid:
        return None, JSONResponse(
            {"error": "Sign in required, or pass student_id_number in the request body."},
            status_code=401,
        )
    return sid, None


def gemini_text_from_result(result: dict) -> str:
    try:
        parts = result["candidates"][0]["content"]["parts"]
        if not parts:
            return ""
        return parts[0].get("text") or ""
    except (KeyError, IndexError, TypeError):
        return ""


def strip_outer_markdown_code_fence(text: str) -> str:
    """Remove accidental ```markdown … ``` wrapper from model output."""
    t = (text or "").strip()
    if not t.startswith("```"):
        return t
    lines = t.split("\n")
    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
    while lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


REVIEWER_SOURCE_MAX_CHARS = 120_000

REVIEWER_PROMPT_TEMPLATE = (
    "You are an experienced teacher writing a study reviewer for senior high school students.\n\n"
    "TASK: Using ONLY the lesson text below, produce a clear reviewer students can use to study.\n\n"
    "OUTPUT FORMAT (GitHub-flavored Markdown only; no HTML tags):\n"
    "1) Start with exactly one level-1 heading on its own line: # <short topic title>\n"
    "2) One short opening paragraph (3–5 sentences) that explains the big idea in plain language.\n"
    "3) ## Key Points — then 4–7 bullets. Each bullet must be its own line starting with \"• \" "
    "(bullet character + space).\n"
    "4) ## Important Definitions — one term per line using this pattern: Term — short definition "
    "(use an em dash between term and definition).\n"
    "5) ## Summary — one short closing paragraph (2–4 sentences) that ties ideas together.\n\n"
    "STYLE RULES:\n"
    "- Balance short paragraphs with lists; avoid one giant paragraph or one endless bullet list.\n"
    "- Sound clear and educational; avoid hype, filler, or stock AI phrases "
    '(e.g. avoid "delve", "leverage", "In conclusion", "It is important to note").\n'
    "- Simplify complex ideas; do not repeat the same point in multiple sections.\n"
    "- Keep vocabulary accessible; define jargon briefly when it appears.\n"
    "- Write in the same language as the lesson when the lesson is not English; otherwise use English.\n"
    "- Do not wrap the entire answer in markdown code fences (no ```).\n"
    "- Do not add links, images, URLs, or quiz questions.\n\n"
    "LESSON TEXT:\n{source}\n"
)


def parse_model_json(raw: str):
    """Parse JSON from model output; strips optional markdown code fences."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if len(lines) >= 2:
            text = "\n".join(lines[1:])
        if "```" in text:
            text = text[: text.index("```")].strip()
    return json.loads(text)


def friendly_ai_error(result: dict | str | None) -> str:
    """
    Convert provider errors into a user-friendly message (no raw payload in UI).
    """
    try:
        if isinstance(result, dict):
            msg = (
                result.get("error", {}).get("message")
                if isinstance(result.get("error"), dict)
                else result.get("message")
            )
            msg = str(msg or "").lower()
            if "high demand" in msg or "overloaded" in msg or "unavailable" in msg:
                return "AI servers are currently busy. Please try again."
            if "quota" in msg or "rate limit" in msg or "resource" in msg:
                return "AI quota is currently exceeded. Please try again later."
            if "api key" in msg or "permission" in msg or "denied" in msg:
                return "AI access is currently unavailable. Please contact the administrator."
        return "Failed to generate content. Please retry."
    except Exception:
        return "Failed to generate content. Please retry."


def normalize_quiz_questions(obj, desired_count: int):
    """
    Accept either {"questions":[...]} or a raw list, then validate/normalize.
    Enforces: question(str), choices(list of 4 strings), answer(letter A-D).
    """
    if isinstance(obj, dict) and isinstance(obj.get("questions"), list):
        questions = obj["questions"]
    elif isinstance(obj, list):
        questions = obj
    else:
        raise ValueError("Invalid quiz JSON format")

    out = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        question = str(q.get("question") or "").strip()
        choices = q.get("choices") or []
        answer = q.get("answer")
        if not question:
            continue
        if not isinstance(choices, list):
            continue
        choices = [str(c) for c in choices if str(c).strip()]
        if len(choices) != 4:
            continue

        # Normalize answer to a letter (A-D).
        ans = str(answer or "").strip()
        if len(ans) == 1 and ans.upper() in ("A", "B", "C", "D"):
            ans_letter = ans.upper()
        else:
            # If model returns full choice text, try matching by prefix or exact.
            ans_letter = ""
            for idx, c in enumerate(choices):
                if ans.strip().lower() == c.strip().lower():
                    ans_letter = ("A", "B", "C", "D")[idx]
                    break
            if not ans_letter:
                first = ans[:1].upper()
                if first in ("A", "B", "C", "D"):
                    ans_letter = first
        if not ans_letter:
            continue

        out.append({"question": question, "choices": choices, "answer": ans_letter})
        if desired_count and len(out) >= desired_count:
            break

    if not out:
        raise ValueError("No valid quiz questions parsed")
    return out


def require_gemini_key():
    if not API_KEY or not str(API_KEY).strip():
        return JSONResponse(
            {"error": "Missing API_KEY in backend .env (Google Gemini). AI generation is disabled until you add it."},
            status_code=503,
        )
    return None


@app.get("/health")
def health():
    return {
        "ok": True,
        "has_api_key": bool(API_KEY and API_KEY.strip()),
        "has_supabase": is_configured(),
    }


@app.get("/test-db")
def test_db():
    """
    Quick Supabase smoke test: insert -> select -> update (then cleanup).
    Useful for confirming DB connectivity and table write/read behavior.
    """
    err = require_supabase()
    if err is not None:
        return err
    test_id = f"SBTEST-{uuid.uuid4().hex[:8]}"
    test_email = f"{test_id.lower()}@example.com"
    result = {
        "configured": is_configured(),
        "test_id_number": test_id,
        "insert_ok": False,
        "select_ok": False,
        "update_ok": False,
        "cleanup_ok": False,
    }
    try:
        inserted = db_supabase.insert_profile(
            full_name="Supabase DB Test",
            id_number=test_id,
            email=test_email,
            password="TempPass123",
            role="student",
            approval_status="pending",
        )
        result["insert_ok"] = bool(inserted and inserted.get("id_number") == test_id)

        rows = [r for r in db_supabase.list_profiles() if r.get("id_number") == test_id]
        result["select_ok"] = bool(rows)

        db_supabase.update_profile_status(test_id, "approved")
        rows_after = [r for r in db_supabase.list_profiles() if r.get("id_number") == test_id]
        result["update_ok"] = bool(rows_after and rows_after[0].get("approval_status") == "approved")

        # Keep test data out of production tables.
        db_supabase._sb().table("profiles").delete().eq("id_number", test_id).execute()
        rows_cleanup = [r for r in db_supabase.list_profiles() if r.get("id_number") == test_id]
        result["cleanup_ok"] = not rows_cleanup

        result["message"] = "Supabase test completed."
        return result
    except Exception as e:
        result["error"] = str(e)
        return JSONResponse(result, status_code=500)


@app.get("/")
def home():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "LearnIQ Track API is running"}


# --- Profiles (replaces local-only auth storage for the API side) ---


@app.post("/login")
async def login_user(body: dict):
    print("LOGIN ENDPOINT HIT")
    print(f"DEBUG: Login attempt - body: {body}")
    
    err = require_supabase()
    if err is not None:
        print(f"DEBUG: Supabase connection error: {err}")
        return err
    
    try:
        email = (body.get("email") or "").strip()
        password = body.get("password") or ""
        print(f"LOGIN EMAIL: {email}")
        
        print(f"DEBUG: Extracted email: '{email}', password: {'*' * len(password) if password else 'None'}")
        
        if not email or not password:
            print(f"DEBUG: Missing email or password")
            return JSONResponse({"error": "email and password are required."}, status_code=400)
        
        # Authenticate with Supabase
        print(f"DEBUG: Attempting Supabase auth for email: {email}")
        try:
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            print(f"DEBUG: Supabase auth response: {type(auth_response)}")
            print(f"DEBUG: Auth user: {auth_response.user}")
            print(f"DEBUG: Auth session: {auth_response.session}")
            print(f"LOGIN PASSWORD VALIDATION RESULT: {bool(auth_response.user)}")
        except Exception as auth_error:
            print(f"DEBUG: Supabase auth exception: {auth_error}")
            print(f"DEBUG: Auth exception type: {type(auth_error)}")
            return JSONResponse({"error": "Invalid credentials."}, status_code=401)
        
        if not auth_response.user:
            print(f"DEBUG: No user returned from auth")
            return JSONResponse({"error": "Invalid credentials."}, status_code=401)
        
        # Get user profile from our profiles table
        print(f"DEBUG: Looking up profile for email: {email}")
        try:
            user_profile = db_supabase.get_profile_by_email(email)
            print(f"DEBUG: Profile lookup result: {user_profile}")
            print(f"LOGIN DATABASE RESULT: {user_profile}")
        except Exception as profile_error:
            print(f"DEBUG: Profile lookup exception: {profile_error}")
            print(f"DEBUG: Profile exception type: {type(profile_error)}")
            return JSONResponse({"error": "Database error during profile lookup."}, status_code=500)
        
        if not user_profile:
            print(f"DEBUG: No profile found for email: {email}")
            return JSONResponse({"error": "User profile not found."}, status_code=404)
        
        # Check approval status
        approval_status = user_profile.get("approval_status", "pending")
        print(f"DEBUG: User approval status: {approval_status}")
        
        if approval_status == "pending":
            print(f"DEBUG: User account pending approval")
            return JSONResponse({"error": "Your account is still pending approval."}, status_code=403)
        elif approval_status == "rejected":
            print(f"DEBUG: User account rejected")
            return JSONResponse({"error": "Your registration was not approved. Please contact the administrator."}, status_code=403)
        
        # Return safe user data with auth session
        print(f"DEBUG: Preparing successful response")
        print(f"DEBUG: Raw user_profile from DB: {user_profile}")
        print(f"DEBUG: user_profile keys: {list(user_profile.keys()) if user_profile else 'None'}")
        print(f"DEBUG: user_profile.get('role'): {user_profile.get('role') if user_profile else 'None'}")
        print(f"DEBUG: Type of role: {type(user_profile.get('role')) if user_profile else 'None'}")
        
        try:
            role_value = user_profile.get("role")
            print(f"DEBUG: Role value before processing: '{role_value}'")
            print(f"DEBUG: Role value trimmed: '{role_value.strip() if role_value else None}'")
            print(f"DEBUG: Role value lowercased: '{role_value.strip().lower() if role_value else None}'")
            
            safe_user = {
                "id": user_profile.get("id"),
                "full_name": user_profile.get("full_name"),
                "id_number": user_profile.get("id_number"),
                "email": user_profile.get("email"),
                "role": role_value.strip().lower() if role_value else "student",
                "approval_status": user_profile.get("approval_status"),
                "access_token": auth_response.session.access_token,
                "refresh_token": auth_response.session.refresh_token
            }
            print(f"DEBUG: Safe user data prepared: {safe_user}")
            print(f"DEBUG: Final role in safe_user: '{safe_user['role']}'")
            print(f"DEBUG: Final role type: {type(safe_user['role'])}")
        except Exception as response_error:
            print(f"DEBUG: Response preparation exception: {response_error}")
            print(f"DEBUG: Response exception type: {type(response_error)}")
            return JSONResponse({"error": "Error preparing user response."}, status_code=500)
        
        print(f"DEBUG: Login successful for user: {email}")
        print(f"FINAL LOGIN RESPONSE: {safe_user}")
        print(f"FINAL RESPONSE STRUCTURE: {{'user': {safe_user}, 'message': 'Login successful'}}")
        print(f"LOGIN RESPONSE PAYLOAD: {{'user': {safe_user}, 'message': 'Login successful'}}")
        return {"user": safe_user, "message": "Login successful"}
        
    except Exception as e:
        print(f"DEBUG: Login endpoint exception: {e}")
        print(f"DEBUG: Exception type: {type(e)}")
        print(f"DEBUG: Exception args: {e.args}")
        import traceback
        print(f"DEBUG: Full traceback: {traceback.format_exc()}")
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/forgot-password")
async def forgot_password(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        email = (body.get("email") or "").strip()
        
        if not email:
            return JSONResponse({"error": "Email is required."}, status_code=400)
        
        # Use Supabase Auth to send password reset email
        supabase.auth.reset_password_for_email(email, {
            "redirectTo": "http://localhost:8000/login.html"  # Update this to your frontend URL
        })
        
        return {"message": "Password reset instructions have been sent to your email."}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/validate-session")
async def validate_session(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        access_token = body.get("access_token")
        if not access_token:
            return JSONResponse({"error": "Access token required."}, status_code=400)
        
        # Set the session and get current user
        supabase.auth.set_session(access_token)
        user = supabase.auth.get_user()
        
        if not user.user:
            return JSONResponse({"error": "Invalid session."}, status_code=401)
        
        # Get user profile from our profiles table
        user_profile = db_supabase.get_profile_by_email(user.user.email)
        if not user_profile:
            return JSONResponse({"error": "User profile not found."}, status_code=404)
        
        # Return safe user data
        safe_user = {
            "id": user_profile.get("id"),
            "full_name": user_profile.get("full_name"),
            "id_number": user_profile.get("id_number"),
            "email": user_profile.get("email"),
            "role": user_profile.get("role"),
            "approval_status": user_profile.get("approval_status")
        }
        
        return {"user": safe_user, "message": "Session valid"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/register")
async def register_user(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        full_name = (body.get("full_name") or "").strip()
        id_number = (body.get("id_number") or "").strip()
        email = (body.get("email") or "").strip()
        password = body.get("password") or ""
        role = (body.get("role") or "student").strip().lower()
        
        if not full_name or not id_number or not email or not password:
            return JSONResponse({"error": "full_name, id_number, email, and password are required."}, status_code=400)
        
        # Only allow student and teacher roles for public signup
        if role not in ("student", "teacher"):
            role = "student"
        
        # Create user with Supabase Auth (this sends confirmation email)
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": full_name,
                    "id_number": id_number,
                    "role": role
                }
            }
        })
        
        if not auth_response.user:
            return JSONResponse({"error": "Failed to create account."}, status_code=400)
        
        # Insert user profile into our profiles table with matching auth user ID
        profile = db_supabase.insert_profile(
            full_name=full_name,
            id_number=id_number,
            email=email,
            password="",  # No password stored in profiles table anymore
            role=role,
            approval_status="pending",
            auth_user_id=auth_response.user.id  # Use Supabase Auth user ID
        )
        
        profile = dict(profile)
        profile.pop("password", None)
        
        return {
            "user": profile,
            "message": "Account created successfully. Please check your email to confirm your account."
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@app.get("/users")
def get_users():
    err = require_supabase()
    if err is not None:
        return err
    try:
        rows = db_supabase.get_all_profiles()
        out = []
        for r in rows:
            x = dict(r)
            x.pop("password", None)
            out.append(x)
        return out
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/admin/stats")
def get_admin_dashboard_stats():
    """Aggregated metrics for the admin dashboard (Supabase)."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        return db_supabase.get_admin_dashboard_stats()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/admin/attendance-logs")
def admin_list_attendance_logs(limit: int = Query(default=200, ge=1, le=500)):
    err = require_supabase()
    if err is not None:
        return err
    try:
        return {"logs": db_supabase.list_all_attendance_logs(limit)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/admin/journals-feed")
def admin_list_journals_feed(limit: int = Query(default=200, ge=1, le=500)):
    """All journal submissions (admin)."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        return {"journals": db_supabase.list_all_journals_admin(limit)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/admin/profile/{id_number}")
def admin_get_profile_by_id_number(id_number: str):
    """Single profile row from Supabase (admin UI / modals). Password omitted."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        prof = db_supabase.get_profile_by_id_number(id_number)
        if not prof:
            return JSONResponse({"error": "Profile not found."}, status_code=404)
        out = dict(prof)
        out.pop("password", None)
        return out
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/admin/recent-activity")
def admin_recent_activity(limit: int = Query(default=12, ge=1, le=50)):
    """Recent registrations, uploads, and quiz attempts for the admin dashboard."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        return {"items": db_supabase.get_admin_recent_activity(limit)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.patch("/users")
def update_user_status(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        id_number = body.get("id_number")
        approval_status = body.get("approval_status")
        
        print(f"DEBUG: Received approval request - id_number: {id_number}, approval_status: {approval_status}")
        
        if not id_number or not approval_status:
            return JSONResponse({"error": "id_number and approval_status are required."}, status_code=400)
        
        if approval_status not in ("pending", "approved", "rejected"):
            print(f"DEBUG: Invalid approval_status value: {approval_status}")
            return JSONResponse({"error": "Invalid approval_status."}, status_code=400)
        
        print(f"DEBUG: Calling database update for id_number: {id_number}")
        success = db_supabase.update_user_approval_status(id_number, approval_status)
        print(f"DEBUG: Database update result: {success}")
        
        if not success:
            return JSONResponse({"error": "User not found."}, status_code=404)
        
        return {"message": f"User status updated to {approval_status}"}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.patch("/profiles/{id_number}/status")
async def patch_profile_status(id_number: str, body: dict):
    err = require_supabase()
    if err is not None:
        return err
    new_status = (body.get("approval_status") or "").strip().lower()
    if new_status not in ("pending", "approved", "rejected"):
        return JSONResponse({"error": "approval_status must be pending, approved, or rejected."}, status_code=400)
    try:
        db_supabase.update_profile_status(id_number, new_status)
        return {"id_number": id_number, "approval_status": new_status}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


# --- Lessons & AI (Supabase) ---


@app.get("/teacher/lessons")
def list_teacher_lessons(teacher_id_number: str = Query(...)):
    err = require_supabase()    
    if err is not None:
        return err
    try:
        rows = db_supabase.list_teacher_lessons(teacher_id_number)
        return {"lessons": [db_supabase.lesson_to_api_list_item(r) for r in rows]}
    except Exception as e:
        import traceback
        print("TEACHER LESSONS ERROR:", repr(e))
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/teacher/dashboard-stats")
def get_teacher_dashboard_stats(authorization: str | None = Header(default=None)):
    """Teacher LearnIQ dashboard: upload counts, students with activity, avg quiz score (Bearer token)."""
    err = require_supabase()
    if err is not None:
        return err
    idn = student_id_number_from_authorization(authorization)
    if not idn:
        return JSONResponse({"error": "Sign in required."}, status_code=401)
    try:
        prof = db_supabase.get_profile_by_id_number(idn)
        role = str((prof or {}).get("role") or "").strip().lower()
        if role != "teacher":
            return JSONResponse({"error": "Teacher access only."}, status_code=403)
        return db_supabase.get_teacher_learniq_dashboard_stats(idn)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)

@app.get("/me")
def get_me(authorization: str | None = Header(default=None)):
    """Return signed-in user's profile row (Bearer token)."""
    err = require_supabase()
    if err is not None:
        return err
    sid = student_id_number_from_authorization(authorization)
    if not sid:
        return JSONResponse({"error": "Sign in required."}, status_code=401)
    try:
        prof = db_supabase.get_profile_by_id_number(sid)
        if not prof:
            return JSONResponse({"error": "Profile not found."}, status_code=404)
        return {
            "id": prof.get("id"),
            "full_name": prof.get("full_name"),
            "id_number": prof.get("id_number"),
            "email": prof.get("email"),
            "role": prof.get("role"),
            "approval_status": prof.get("approval_status"),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/lessons")
def list_all_lessons_admin():
    """All uploaded lesson files (admin Uploaded Files section + dashboard stat)."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        rows = db_supabase.list_all_lessons()
        lessons_out = []
        for r in rows:
            base = db_supabase.lesson_to_api_list_item(r)
            lessons_out.append(
                {
                    **base,
                    "file_type": r.get("file_type") or "",
                    "created_at": r.get("created_at"),
                    "teacher_id_number": r.get("teacher_id_number") or "",
                    "is_published": bool(r.get("is_published")),
                }
            )
        return {"lessons": lessons_out, "count": len(lessons_out)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/publish-lesson")
async def publish_lesson(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    lesson_id = body.get("lesson_id") or body.get("file_id")
    if not lesson_id:
        return JSONResponse({"error": "lesson_id (or file_id) is required."}, status_code=400)
    try:
        if not db_supabase.get_lesson_row(str(lesson_id)):
            return JSONResponse({"error": "Lesson not found."}, status_code=404)
        db_supabase.publish_lesson(str(lesson_id))
        return {"published_file_id": lesson_id, "message": "Students can now open this lesson on their dashboard."}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/unpublish-lesson")
async def unpublish_lesson(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    lesson_id = body.get("lesson_id") or body.get("file_id")
    if not lesson_id:
        return JSONResponse({"error": "lesson_id (or file_id) is required."}, status_code=400)
    try:
        if not db_supabase.get_lesson_row(str(lesson_id)):
            return JSONResponse({"error": "Lesson not found."}, status_code=404)
        db_supabase.unpublish_all_lessons()
        return {"unpublished_file_id": lesson_id, "message": "Lesson is no longer visible to students."}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/student/lessons")
def get_student_lessons(subject_id: str | None = None):
    err = require_supabase()
    if err is not None:
        return err
    try:
        lessons = db_supabase.list_published_lessons_with_content()
        if subject_id:
            lessons = [
                lesson for lesson in lessons
                if str(lesson.get("subject_id") or "") == str(subject_id)
            ]
        print("STUDENT LESSONS DEBUG: Found", len(lessons), "published lessons (subject_id=", subject_id, ")")
        for i, lesson in enumerate(lessons):
            print(f"  Lesson {i+1}: {lesson.get('filename', 'No filename')} (id: {lesson.get('file_id', 'No id')})")
        return {"lessons": lessons}
    except Exception as e:
        print("STUDENT LESSONS ERROR:", str(e))
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/subjects")
def list_subjects_endpoint():
    """List all subjects with lesson counts (used by Student/Teacher/Admin UIs)."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        subjects = db_supabase.list_subjects()
        pub_counts = db_supabase.count_published_lessons_by_subject()
        total_counts = db_supabase.count_lessons_by_subject()
        teacher_counts = db_supabase.count_teachers_by_subject()
        for s in subjects:
            sid = s.get("id")
            key = str(sid) if sid is not None else ""
            s["published_lesson_count"] = pub_counts.get(key, 0)
            s["total_lesson_count"] = total_counts.get(key, 0)
            s["teacher_count"] = teacher_counts.get(key, 0)
        return {"subjects": subjects, "count": len(subjects)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/subjects")
async def create_subject_endpoint(body: dict):
    """Create a new subject row (used by Teacher 'Add Subject' modal)."""
    err = require_supabase()
    if err is not None:
        return err
    name = (body.get("name") or "").strip()
    if not name:
        return JSONResponse({"error": "Subject name is required."}, status_code=400)
    description = body.get("description")
    color = body.get("color")
    try:
        row = db_supabase.create_subject(name=name, description=description, color=color)
        sid = row.get("id") if isinstance(row, dict) else None
        return {
            "id": str(sid) if sid is not None else None,
            "name": (row.get("name") if isinstance(row, dict) else name) or name,
            "description": (row.get("description") if isinstance(row, dict) else description) or "",
            "color": (row.get("color") if isinstance(row, dict) else color) or "",
        }
    except ValueError as ve:
        return JSONResponse({"error": str(ve)}, status_code=400)
    except Exception as e:
        msg = str(e)
        # Friendly error if the database uniqueness constraint is violated.
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return JSONResponse({"error": "A subject with this name already exists."}, status_code=409)
        return JSONResponse({"error": msg}, status_code=502)


@app.put("/subjects/{subject_id}")
async def update_subject_endpoint(subject_id: str, body: dict):
    """Update a subject row (name/description/color). Admin-only in spirit."""
    err = require_supabase()
    if err is not None:
        return err
    if not subject_id:
        return JSONResponse({"error": "subject_id is required."}, status_code=400)
    try:
        row = db_supabase.update_subject(
            subject_id=subject_id,
            name=body.get("name"),
            description=body.get("description"),
            color=body.get("color"),
        )
        sid = row.get("id") if isinstance(row, dict) else subject_id
        return {
            "id": str(sid) if sid is not None else subject_id,
            "name": (row.get("name") if isinstance(row, dict) else None) or body.get("name"),
            "description": (row.get("description") if isinstance(row, dict) else None) or body.get("description") or "",
            "color": (row.get("color") if isinstance(row, dict) else None) or body.get("color") or "",
        }
    except ValueError as ve:
        return JSONResponse({"error": str(ve)}, status_code=400)
    except Exception as e:
        msg = str(e)
        if "duplicate" in msg.lower() or "unique" in msg.lower():
            return JSONResponse({"error": "Another subject already uses this name."}, status_code=409)
        return JSONResponse({"error": msg}, status_code=502)


@app.delete("/subjects/{subject_id}")
async def delete_subject_endpoint(subject_id: str):
    """Delete a subject. Any lesson referencing it will have its subject_id set
    to NULL first (so legacy lessons appear under 'Unassigned')."""
    err = require_supabase()
    if err is not None:
        return err
    if not subject_id:
        return JSONResponse({"error": "subject_id is required."}, status_code=400)
    try:
        db_supabase.delete_subject(subject_id)
        return {"deleted_subject_id": subject_id}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/lesson/subject")
async def set_lesson_subject(body: dict):
    """Teacher edit: assign or change the subject of an existing lesson."""
    err = require_supabase()
    if err is not None:
        return err
    lesson_id = body.get("lesson_id") or body.get("file_id")
    if not lesson_id:
        return JSONResponse({"error": "lesson_id (or file_id) is required."}, status_code=400)
    subject_id = body.get("subject_id")
    if subject_id is not None:
        subject_id = str(subject_id) or None
    try:
        if not db_supabase.get_lesson_row(str(lesson_id)):
            return JSONResponse({"error": "Lesson not found."}, status_code=404)
        db_supabase.update_lesson_subject(str(lesson_id), subject_id)
        return {"lesson_id": lesson_id, "subject_id": subject_id}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/student/lesson")
def get_student_lesson():
    err = require_supabase()
    if err is not None:
        return err
    try:
        bundle = db_supabase.get_published_lesson_with_content()
        if not bundle:
            return JSONResponse(
                {"error": "No lesson has been published yet. Ask your teacher to publish a lesson."},
                status_code=404,
            )
        meta, gen = bundle
        lesson_id = meta["id"]
        reviewer = gen.get("reviewer")
        if isinstance(reviewer, list):
            reviewer_str = "\n\n".join(str(x).strip() for x in reviewer if str(x).strip())
        elif isinstance(reviewer, str):
            reviewer_str = reviewer
        else:
            reviewer_str = ""

        quiz = gen.get("quiz") or []
        if not isinstance(quiz, list):
            if isinstance(quiz, dict):
                # Convert single question object to array
                quiz = [quiz]
            else:
                quiz = []

        activities = gen.get("activities") or []
        print(f"[DEBUG] Raw activities from database: {activities}")
        print(f"[DEBUG] Type of raw activities: {type(activities)}")
        if not isinstance(activities, list):
            if isinstance(activities, str):
                # Convert single string to array
                activities = [activities]
                print(f"[DEBUG] Converted string to array: {activities}")
            else:
                activities = []
                print(f"[DEBUG] Converted non-list to empty array")
        else:
            print(f"[DEBUG] Activities already an array: {activities}")

        result = {
            "file_id": lesson_id,
            "filename": meta.get("filename", ""),
            "reviewer": reviewer_str,
            "quiz": quiz,
            "activities": activities,
        }
        print(f"[DEBUG] /student/lesson returning activities: {activities}")
        return result
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/student/leaderboard")
def get_student_leaderboard(limit: int = Query(50, ge=1, le=200)):
    """Live rankings from quiz_attempts (students only)."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        return db_supabase.get_learniq_leaderboard(limit=limit)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/student/dashboard-stats")
def get_student_dashboard_stats(authorization: str | None = Header(default=None)):
    """LearnIQ dashboard: quiz totals, rank, preview (Bearer token)."""
    err = require_supabase()
    if err is not None:
        return err
    sid = student_id_number_from_authorization(authorization)
    if not sid:
        return JSONResponse({"error": "Sign in required."}, status_code=401)
    try:
        return db_supabase.get_student_learniq_dashboard_stats(sid)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/upload-lesson")
async def upload_lesson_json(body: dict):
    """Create a lesson row from JSON (same data as your Flask sample, without a file upload)."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        filename = (body.get("filename") or "").strip()
        if not filename:
            return JSONResponse({"error": "filename is required."}, status_code=400)
        text = body.get("extracted_text") or body.get("text") or ""
        ft = (body.get("file_type") or Path(filename).suffix.lstrip(".") or "unknown").strip()
        tid = body.get("teacher_id_number") or body.get("teacher_id")
        if tid is not None:
            tid = str(tid)
        subject_id = body.get("subject_id")
        if subject_id is not None:
            subject_id = str(subject_id) or None
        lesson = db_supabase.insert_lesson(
            filename=filename,
            file_type=ft,
            extracted_text=str(text)[:3000],
            storage_path=None,
            teacher_id_number=tid,
            subject_id=subject_id,
        )
        return lesson
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    teacher_id_number: str = Form(...),
    subject_id: str | None = Form(default=None),
):
    print("UPLOAD CALLED")
    print("Filename:", file.filename)
    print("Teacher ID Number:", teacher_id_number)
    print("Subject ID:", subject_id)

    err = require_supabase()
    if err is not None:
        return err

    if not file.filename or not file.filename.lower().endswith((".pdf", ".ppt", ".pptx")):
        return JSONResponse(
            {"error": "Only PDF, PPT, and PPTX files are allowed."},
            status_code=400,
        )

    ext = Path(file.filename).suffix.lower()
    file_type = ext.lstrip(".") or "unknown"
    safe_name = Path(file.filename).name
    temp_path = f"temp_upload_{safe_name.replace(' ', '_')}"

    raw = await file.read()
    with open(temp_path, "wb") as f:
        f.write(raw)

    text = ""
    if file.filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(temp_path)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            text = text[:3000]
        except Exception:
            text = ""

    try:
        print("CALLING INSERT LESSON...")
        clean_subject_id = (str(subject_id).strip() or None) if subject_id else None
        lesson = db_supabase.insert_lesson(
            filename=file.filename,
            file_type=file_type,
            extracted_text=text,
            storage_path=temp_path,
            teacher_id_number=teacher_id_number,
            subject_id=clean_subject_id,
        )
        lid = lesson["id"]
        print(f"UPLOAD SUCCESS: file_id={lid}, filename={file.filename}")
        return {"file_id": lid, "filename": file.filename}
    except Exception as e:
        import traceback
        print(f"UPLOAD FAILED: {e}")
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/generate-reviewer")
async def generate_reviewer(body: dict):
    print("AI GENERATION REQUEST RECEIVED: /generate-reviewer")
    print("REQUEST PAYLOAD:", body)
    key_err = require_gemini_key()
    if key_err is not None:
        print("AI GENERATION ERROR (gemini key):", key_err.body if hasattr(key_err, "body") else key_err)
        return key_err
    db_err = require_supabase()
    if db_err is not None:
        print("AI GENERATION ERROR (supabase):", db_err.body if hasattr(db_err, "body") else db_err)
        return db_err

    file_id = body.get("file_id")
    lesson = db_supabase.get_lesson_row(str(file_id)) if file_id else None
    if not lesson:
        return JSONResponse({"error": "File not found"}, status_code=404)

    text = lesson.get("extracted_text") or ""
    if not str(text).strip():
        print("AI GENERATION ERROR: empty extracted_text")
        return JSONResponse(
            {"error": "No text extracted from this file. Use a PDF with selectable text, or another file."},
            status_code=400,
        )

    source = str(text).replace("\r\n", "\n").replace("\r", "\n")
    if len(source) > REVIEWER_SOURCE_MAX_CHARS:
        source = source[:REVIEWER_SOURCE_MAX_CHARS] + "\n\n[…excerpt truncated for length…]"
    prompt = REVIEWER_PROMPT_TEMPLATE.format(source=source)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    print("SENDING TO AI API (reviewer)")
    response = requests.post(url, json=payload, timeout=120)
    result = response.json()
    print("AI RAW RESPONSE STATUS (reviewer):", response.status_code)
    try:
        print("AI RAW RESPONSE BODY (reviewer):", result)
    except Exception as e:
        print("AI RAW RESPONSE PRINT ERROR (reviewer):", str(e))

    if response.status_code != 200:
        return JSONResponse({"error": result}, status_code=502)

    reviewer_text = strip_outer_markdown_code_fence(gemini_text_from_result(result))
    if not reviewer_text:
        return JSONResponse({"error": "AI returned no text. Try again."}, status_code=502)

    try:
        db_supabase.set_reviewer(str(file_id), reviewer_text)
    except Exception as e:
        print("AI GENERATION ERROR (db write reviewer):", str(e))
        return JSONResponse({"error": str(e)}, status_code=502)

    return {"reviewer": reviewer_text}


@app.post("/generate-question")
async def generate_question(body: dict):
    print("AI GENERATION REQUEST RECEIVED: /generate-question")
    print("REQUEST PAYLOAD:", body)
    key_err = require_gemini_key()
    if key_err is not None:
        print("AI GENERATION ERROR (gemini key):", key_err.body if hasattr(key_err, "body") else key_err)
        return key_err
    db_err = require_supabase()
    if db_err is not None:
        print("AI GENERATION ERROR (supabase):", db_err.body if hasattr(db_err, "body") else db_err)
        return db_err

    file_id = body.get("file_id")
    lesson = db_supabase.get_lesson_row(str(file_id)) if file_id else None
    if not lesson:
        return JSONResponse({"error": "File not found"}, status_code=404)

    text = lesson.get("extracted_text") or ""
    if not str(text).strip():
        print("AI GENERATION ERROR: empty extracted_text")
        return JSONResponse(
            {"error": "No text extracted from this file. Use a PDF with selectable text."},
            status_code=400,
        )

    quiz_count = body.get("quiz_count", 1)
    if not isinstance(quiz_count, int) or quiz_count < 1:
        quiz_count = 1
    difficulty = (body.get("difficulty") or "").strip().lower()
    if difficulty not in ("easy", "medium", "hard", ""):
        difficulty = ""
    
    diff_line = f"Difficulty: {difficulty}.\n" if difficulty else ""
    prompt = (
        "You are an educational content generator.\n"
        f"{diff_line}"
        f"Create exactly {quiz_count} multiple-choice questions based ONLY on the lesson text.\n"
        "Each question must have exactly 4 choices (A-D).\n"
        "Return STRICT VALID JSON ONLY (no markdown, no explanations, no code fences) with this schema:\n"
        '{ "questions": [ { "question": "...", "choices": ["A. ...","B. ...","C. ...","D. ..."], "answer": "B" } ] }\n'
        "The answer MUST be a single letter A, B, C, or D.\n\n"
        "LESSON TEXT:\n"
        f"{text}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    print("SENDING TO AI API (quiz)")
    response = requests.post(url, json=payload, timeout=120)
    result = response.json()
    print("AI RAW RESPONSE STATUS (quiz):", response.status_code)
    try:
        print("AI RAW RESPONSE BODY (quiz):", result)
    except Exception as e:
        print("AI RAW RESPONSE PRINT ERROR (quiz):", str(e))

    if response.status_code != 200:
        return JSONResponse({"error": friendly_ai_error(result)}, status_code=502)

    raw_output = gemini_text_from_result(result)
    if not raw_output:
        return JSONResponse({"error": "AI returned no text. Try again."}, status_code=502)

    try:
        parsed = parse_model_json(raw_output)
        questions_data = normalize_quiz_questions(parsed, desired_count=quiz_count)
    except (json.JSONDecodeError, ValueError) as e:
        print("AI GENERATION ERROR: failed to parse questions JSON")
        return JSONResponse(
            {"error": "Failed to parse quiz questions. Please retry."},
            status_code=502,
        )

    try:
        # Clear existing quiz and add all new questions
        db_supabase.set_quiz(str(file_id), [])
        for question in questions_data:
            db_supabase.append_quiz_question(str(file_id), question)
    except Exception as e:
        print("AI GENERATION ERROR (db write quiz):", str(e))
        return JSONResponse({"error": str(e)}, status_code=502)

    return {"questions": questions_data, "count": len(questions_data)}


@app.post("/generate-activities")
async def generate_activities(body: dict):
    print(f"[DEBUG] /generate-activities called with body: {body}")
    
    key_err = require_gemini_key()
    if key_err is not None:
        print(f"[DEBUG] Gemini key error: {key_err}")
        return key_err
    db_err = require_supabase()
    if db_err is not None:
        print(f"[DEBUG] Supabase error: {db_err}")
        return db_err

    file_id = body.get("file_id")
    print(f"[DEBUG] file_id: {file_id}")
    
    lesson = db_supabase.get_lesson_row(str(file_id)) if file_id else None
    if not lesson:
        print(f"[DEBUG] Lesson not found for file_id: {file_id}")
        return JSONResponse({"error": "File not found"}, status_code=404)

    text = lesson.get("extracted_text") or ""
    print(f"[DEBUG] Extracted text length: {len(text)}")
    if not str(text).strip():
        print(f"[DEBUG] No extracted text found")
        return JSONResponse(
            {"error": "No text extracted from this file. Use a PDF with selectable text."},
            status_code=400,
        )

    activity_type = (body.get("activity_type") or "essay").strip().lower()
    count = body.get("count", 5)
    try:
        count = int(count)
    except Exception:
        count = 5
    if count not in (5, 10, 15):
        count = 5

    allowed = {"essay", "flashcards"}
    if activity_type not in allowed:
        activity_type = "essay"

    schema_by_type = {
        "essay": '{ "activities": [ { "question": "Essay prompt...", "answer": "Sample answer or key points the response should cover (2-4 sentences)." } ] }',
        "flashcards": '{ "cards": [ { "front": "Term or question (short)", "back": "Definition or answer (concise)" } ] }',
    }

    type_instructions = {
        "essay": (
            "Write open-ended essay prompts that require the student to explain, analyze, "
            "compare, or evaluate ideas from the lesson. Each prompt should be 1-2 sentences. "
            "The 'answer' field should be a concise sample answer or list of key points (no markdown)."
        ),
        "flashcards": (
            "Create study flashcards. The 'front' is a short term, concept, or question "
            "(max ~8 words). The 'back' is a concise definition or answer (1-2 sentences). "
            "Cover the most important concepts from the lesson."
        ),
    }

    prompt = (
        "You are an educational content generator.\n"
        f"Create exactly {count} items for activity type: {activity_type}.\n"
        f"{type_instructions[activity_type]}\n"
        "Return STRICT VALID JSON ONLY (no markdown, no explanations, no code fences).\n"
        f"Schema:\n{schema_by_type[activity_type]}\n\n"
        "LESSON TEXT:\n"
        f"{text}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    response = requests.post(url, json=payload, timeout=120)
    result = response.json()
    print(f"[DEBUG] Gemini API response status: {response.status_code}")

    if response.status_code != 200:
        print(f"[DEBUG] Gemini API error: {result}")
        return JSONResponse({"error": friendly_ai_error(result)}, status_code=502)

    raw_output = gemini_text_from_result(result)
    print(f"[DEBUG] Raw output from Gemini: {raw_output}")
    if not raw_output:
        print(f"[DEBUG] Gemini returned no text")
        return JSONResponse({"error": "AI returned no text. Try again."}, status_code=502)

    try:
        activity_data = parse_model_json(raw_output)
        if not isinstance(activity_data, dict):
            raise ValueError("Invalid activities JSON format")
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[DEBUG] JSON parsing error: {e}")
        return JSONResponse({"error": "Failed to generate activities. Please retry."}, status_code=502)

    # Normalize to DB storage format: list of dicts, or a single deck object for flashcards.
    normalized_activities = []
    if activity_type == "flashcards":
        cards = activity_data.get("cards") if isinstance(activity_data.get("cards"), list) else []
        cards = [
            {"front": str(c.get("front") or "").strip(), "back": str(c.get("back") or "").strip()}
            for c in cards
            if isinstance(c, dict) and c.get("front") and c.get("back")
        ]
        if not cards:
            return JSONResponse({"error": "Failed to generate flashcards. Please retry."}, status_code=502)
        normalized_activities = [{"activity_type": "flashcards", "cards": cards}]
    else:
        acts = activity_data.get("activities") if isinstance(activity_data.get("activities"), list) else []
        for a in acts:
            if not isinstance(a, dict):
                continue
            q = str(a.get("question") or "").strip()
            ans = a.get("answer")
            if not q:
                continue
            normalized_activities.append({"activity_type": activity_type, "question": q, "answer": ans})
        if not normalized_activities:
            return JSONResponse({"error": "Failed to generate activities. Please retry."}, status_code=502)

    try:
        # Replace activities cleanly (stable regeneration)
        print(f"[DEBUG] Saving activities to database for file_id: {file_id}")
        db_supabase.set_activities(str(file_id), normalized_activities)
        print(f"[DEBUG] Activities saved successfully")
    except Exception as e:
        print(f"[DEBUG] Database save error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)

    print(f"[DEBUG] Returning activities (normalized): {normalized_activities}")
    return {"activities": normalized_activities, "total_activities": len(normalized_activities)}


@app.post("/save-ai-content")
async def save_ai_content(body: dict):
    """Save reviewer, quiz, and/or activities for a lesson (manual or external tools)."""
    err = require_supabase()
    if err is not None:
        return err
    lesson_id = body.get("lesson_id") or body.get("file_id")
    if not lesson_id:
        return JSONResponse({"error": "lesson_id or file_id is required."}, status_code=400)
    lesson_id = str(lesson_id)
    if not db_supabase.get_lesson_row(lesson_id):
        return JSONResponse({"error": "Lesson not found."}, status_code=404)
    try:
        if "reviewer" in body and body["reviewer"] is not None:
            db_supabase.set_reviewer(lesson_id, body["reviewer"])
        if "activities" in body and body["activities"] is not None:
            db_supabase.set_activities(lesson_id, body["activities"])
        if "quiz" in body and body["quiz"] is not None:
            q = body["quiz"]
            if not isinstance(q, list):
                return JSONResponse({"error": "quiz must be a JSON array."}, status_code=400)
            db_supabase.set_quiz(lesson_id, q)
        gen = db_supabase.get_content_row(lesson_id) or {}
        lesson = db_supabase.get_lesson_row(lesson_id) or {}
        return {
            "file_id": lesson_id,
            "filename": lesson.get("filename", ""),
            "reviewer": gen.get("reviewer"),
            "quiz": gen.get("quiz") or [],
            "activities": gen.get("activities"),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/get-content/{file_id}")
def get_content(file_id: str):
    err = require_supabase()
    if err is not None:
        return err
    try:
        lesson = db_supabase.get_lesson_row(file_id)
        if not lesson:
            return JSONResponse({"error": "Content not found"}, status_code=404)
        gen = db_supabase.get_content_row(file_id) or {}
        return {
            "file_id": file_id,
            "filename": lesson.get("filename", ""),
            "reviewer": gen.get("reviewer"),
            "quiz": gen.get("quiz") or [],
            "activities": gen.get("activities"),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


# --- Quiz, attendance, journals ---


@app.post("/quiz-attempt")
async def quiz_attempt(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        lesson_id = body.get("lesson_id") or body.get("file_id")
        if not lesson_id:
            return JSONResponse({"error": "lesson_id (or file_id) is required."}, status_code=400)
        row = db_supabase.insert_quiz_attempt(
            str(lesson_id),
            score=int(body.get("score", 0)),
            total_questions=int(body.get("total_questions", 0)),
            answers=body.get("answers"),
            student_id_number=body.get("student_id_number"),
        )
        return row
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/time-in")
async def time_in(
    body: dict | None = Body(default=None),
    authorization: str | None = Header(default=None),
):
    err = require_supabase()
    if err is not None:
        return err
    try:
        payload = body if isinstance(body, dict) else {}
        student_id, bad = resolve_student_id_number_or_403(payload, authorization)
        if bad is not None:
            return bad

        existing = db_supabase.get_active_attendance(student_id)
        if existing:
            return JSONResponse(
                {"error": "Student already has an active session. Time Out first.", "attendance_id": existing.get("id")},
                status_code=409,
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        row = db_supabase.insert_time_in(student_id, now_iso)
        return row
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/time-out")
async def time_out(
    body: dict | None = Body(default=None),
    authorization: str | None = Header(default=None),
):
    err = require_supabase()
    if err is not None:
        return err
    try:
        payload = body if isinstance(body, dict) else {}
        student_id, bad = resolve_student_id_number_or_403(payload, authorization)
        if bad is not None:
            return bad

        active = db_supabase.get_active_attendance(student_id)
        if not active:
            return JSONResponse({"error": "No active Time In found for this student."}, status_code=400)

        now_iso = datetime.now(timezone.utc).isoformat()
        updated = db_supabase.complete_time_out(str(active["id"]), now_iso)
        return updated
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/attendance-history")
def attendance_history(
    limit: int = Query(60, ge=1, le=200),
    authorization: str | None = Header(default=None),
):
    """Immersion dashboard: active clock-in + recent rows + sum of completed hours."""
    err = require_supabase()
    if err is not None:
        return err
    try:
        student_id, bad = resolve_student_id_number_or_403({}, authorization)
        if bad is not None:
            return bad
        rows = db_supabase.list_attendance_by_student(student_id)[:limit]
        active = db_supabase.get_active_attendance(student_id)
        total = 0.0
        for r in rows:
            th = r.get("total_hours")
            if th is not None:
                try:
                    total += float(th)
                except (TypeError, ValueError):
                    pass
        return {
            "active": active,
            "history": rows,
            "total_hours_rendered": round(total, 2),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/submit-journal")
async def submit_journal(
    body: dict | None = Body(default=None),
    authorization: str | None = Header(default=None),
):
    err = require_supabase()
    if err is not None:
        return err
    try:
        payload = body if isinstance(body, dict) else {}
        student_id, bad = resolve_student_id_number_or_403(payload, authorization)
        if bad is not None:
            return bad
        journal_body = (payload.get("body") or "").strip()
        if not journal_body:
            return JSONResponse({"error": "body is required."}, status_code=400)

        attendance_id = payload.get("attendance_id") or payload.get("immersion_log_id")
        if attendance_id is not None:
            attendance_id = str(attendance_id)
        else:
            records = db_supabase.list_attendance_by_student(student_id)
            if not records:
                return JSONResponse({"error": "No attendance record found for this student."}, status_code=400)
            attendance_id = str(records[0]["id"])

        row = db_supabase.insert_journal_linked(student_id, attendance_id, journal_body)
        return row
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/attendance/{student_id}")
def get_attendance(student_id: str):
    err = require_supabase()
    if err is not None:
        return err
    try:
        return db_supabase.list_attendance_by_student(student_id)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/journals/{student_id}")
def get_journals(student_id: str):
    err = require_supabase()
    if err is not None:
        return err
    try:
        return db_supabase.list_journals_for_student(student_id)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/attendance")
async def attendance(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        sid = (body.get("student_id_number") or "").strip()
        ev = (body.get("event_type") or "").strip().lower()
        if not sid or ev not in ("time_in", "time_out"):
            return JSONResponse(
                {"error": "student_id_number and event_type (time_in | time_out) are required."},
                status_code=400,
            )
        return db_supabase.insert_attendance(sid, ev)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/attendance")
def attendance_list(student_id_number: str):
    err = require_supabase()
    if err is not None:
        return err
    try:
        return db_supabase.list_attendance_for_student(student_id_number)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/journals")
async def journals_create(body: dict, authorization: str | None = Header(default=None)):
    err = require_supabase()
    if err is not None:
        return err
    try:
        sid, bad = resolve_student_id_number_or_403(body, authorization)
        if bad is not None:
            return bad
        text_body = (body.get("body") or body.get("journal_text") or "").strip()
        if not text_body:
            return JSONResponse({"error": "body (or journal_text) is required."}, status_code=400)
        return db_supabase.insert_journal(sid, text_body, entry_date=body.get("entry_date"))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/journals")
def journals_list(
    student_id_number: str | None = None,
    authorization: str | None = Header(default=None),
):
    err = require_supabase()
    if err is not None:
        return err
    try:
        sid, bad = resolve_student_id_number_or_403(
            {"student_id_number": student_id_number} if student_id_number else {},
            authorization,
        )
        if bad is not None:
            return bad
        return db_supabase.list_journals_for_student(sid)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
