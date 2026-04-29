import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
from supabase import create_client, Client

import db_supabase
from supabase_client import is_configured

load_dotenv()

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


def gemini_text_from_result(result: dict) -> str:
    try:
        parts = result["candidates"][0]["content"]["parts"]
        if not parts:
            return ""
        return parts[0].get("text") or ""
    except (KeyError, IndexError, TypeError):
        return ""


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
    err = require_supabase()
    if err is not None:
        return err
    try:
        email = (body.get("email") or "").strip()
        password = body.get("password") or ""
        
        if not email or not password:
            return JSONResponse({"error": "email and password are required."}, status_code=400)
        
        # Authenticate with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if not auth_response.user:
            return JSONResponse({"error": "Invalid credentials."}, status_code=401)
        
        # Get user profile from our profiles table
        user_profile = db_supabase.get_profile_by_email(email)
        if not user_profile:
            return JSONResponse({"error": "User profile not found."}, status_code=404)
        
        # Check approval status
        approval_status = user_profile.get("approval_status", "pending")
        if approval_status == "pending":
            return JSONResponse({"error": "Your account is still pending approval."}, status_code=403)
        elif approval_status == "rejected":
            return JSONResponse({"error": "Your registration was not approved. Please contact the administrator."}, status_code=403)
        
        # Return safe user data with auth session
        safe_user = {
            "id": user_profile.get("id"),
            "full_name": user_profile.get("full_name"),
            "id_number": user_profile.get("id_number"),
            "email": user_profile.get("email"),
            "role": user_profile.get("role"),
            "approval_status": user_profile.get("approval_status"),
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token
        }
        
        return {"user": safe_user, "message": "Login successful"}
    except Exception as e:
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


@app.patch("/users")
def update_user_status(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        id_number = body.get("id_number")
        approval_status = body.get("approval_status")
        
        if not id_number or not approval_status:
            return JSONResponse({"error": "id_number and approval_status are required."}, status_code=400)
        
        if approval_status not in ("pending", "approved", "rejected"):
            return JSONResponse({"error": "Invalid approval_status."}, status_code=400)
        
        success = db_supabase.update_user_approval_status(id_number, approval_status)
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
def list_teacher_lessons():
    err = require_supabase()
    if err is not None:
        return err
    try:
        rows = db_supabase.list_lessons_with_content()
        return {"lessons": [db_supabase.lesson_to_api_list_item(r) for r in rows]}
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
        if isinstance(reviewer, str):
            lines = [p.strip() for p in reviewer.replace("\r", "").split("\n") if p.strip()]
            reviewer_list = lines if lines else [reviewer]
        elif isinstance(reviewer, list):
            reviewer_list = reviewer
        else:
            reviewer_list = []

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
            "reviewer": reviewer_list,
            "quiz": quiz,
            "activities": activities,
        }
        print(f"[DEBUG] /student/lesson returning activities: {activities}")
        return result
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
        lesson = db_supabase.insert_lesson(
            filename=filename,
            file_type=ft,
            extracted_text=str(text)[:3000],
            storage_path=None,
            teacher_id_number=tid,
        )
        return lesson
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
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
        lesson = db_supabase.insert_lesson(
            filename=file.filename,
            file_type=file_type,
            extracted_text=text,
            storage_path=temp_path,
            teacher_id_number=None,
        )
        lid = lesson["id"]
        return {"file_id": lid, "filename": file.filename}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/generate-reviewer")
async def generate_reviewer(body: dict):
    key_err = require_gemini_key()
    if key_err is not None:
        return key_err
    db_err = require_supabase()
    if db_err is not None:
        return db_err

    file_id = body.get("file_id")
    lesson = db_supabase.get_lesson_row(str(file_id)) if file_id else None
    if not lesson:
        return JSONResponse({"error": "File not found"}, status_code=404)

    text = lesson.get("extracted_text") or ""
    if not str(text).strip():
        return JSONResponse(
            {"error": "No text extracted from this file. Use a PDF with selectable text, or another file."},
            status_code=400,
        )

    prompt = f"Create a short reviewer summary based on this lesson:\n\n{text}"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    response = requests.post(url, json=payload, timeout=120)
    result = response.json()

    if response.status_code != 200:
        return JSONResponse({"error": result}, status_code=502)

    reviewer_text = gemini_text_from_result(result)
    if not reviewer_text:
        return JSONResponse({"error": "AI returned no text. Try again."}, status_code=502)

    try:
        db_supabase.set_reviewer(str(file_id), reviewer_text)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)

    return {"reviewer": reviewer_text}


@app.post("/generate-question")
async def generate_question(body: dict):
    key_err = require_gemini_key()
    if key_err is not None:
        return key_err
    db_err = require_supabase()
    if db_err is not None:
        return db_err

    file_id = body.get("file_id")
    lesson = db_supabase.get_lesson_row(str(file_id)) if file_id else None
    if not lesson:
        return JSONResponse({"error": "File not found"}, status_code=404)

    text = lesson.get("extracted_text") or ""
    if not str(text).strip():
        return JSONResponse(
            {"error": "No text extracted from this file. Use a PDF with selectable text."},
            status_code=400,
        )

    quiz_count = body.get("quiz_count", 1)
    if not isinstance(quiz_count, int) or quiz_count < 1:
        quiz_count = 1
    
    prompt = (
        f"Based on this lesson, create {quiz_count} multiple choice questions with 4 choices (A-D) and the correct answer for each:\n\n{text}\n\n"
        f'Return ONLY valid JSON array: [{{"question": "...", "choices": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "correct choice"}}, ...]'
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    response = requests.post(url, json=payload, timeout=120)
    result = response.json()

    if response.status_code != 200:
        return JSONResponse({"error": result}, status_code=502)

    raw_output = gemini_text_from_result(result)
    if not raw_output:
        return JSONResponse({"error": "AI returned no text. Try again."}, status_code=502)

    try:
        questions_data = parse_model_json(raw_output)
        if not isinstance(questions_data, list):
            questions_data = [questions_data]
    except (json.JSONDecodeError, ValueError):
        return JSONResponse(
            {"error": "Failed to parse questions from AI.", "raw": raw_output},
            status_code=502,
        )

    try:
        # Clear existing quiz and add all new questions
        db_supabase.set_quiz(str(file_id), [])
        for question in questions_data:
            db_supabase.append_quiz_question(str(file_id), question)
    except Exception as e:
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

    activity_type = body.get("activity_type", "essay")
    if activity_type not in ["essay", "short_answer", "identification"]:
        activity_type = "essay"
    
    # Generate activity type instructions
    type_instructions = {
        "essay": "an essay-type activity with a writing prompt",
        "short_answer": "a short answer activity with questions requiring brief responses",
        "identification": "an identification activity with items to identify or label"
    }
    
    prompt = (
        f"Create ONE {type_instructions[activity_type]} based on this lesson:\n\n{text}\n\n"
        'Return ONLY valid JSON: {"activity_type": "' + activity_type + '", "title": "...", "instructions": "...", "question_or_task": "..."}'
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    response = requests.post(url, json=payload, timeout=120)
    result = response.json()
    print(f"[DEBUG] Gemini API response status: {response.status_code}")

    if response.status_code != 200:
        print(f"[DEBUG] Gemini API error: {result}")
        return JSONResponse({"error": result}, status_code=502)

    raw_output = gemini_text_from_result(result)
    print(f"[DEBUG] Raw output from Gemini: {raw_output}")
    if not raw_output:
        print(f"[DEBUG] Gemini returned no text")
        return JSONResponse({"error": "AI returned no text. Try again."}, status_code=502)

    try:
        activity_data = parse_model_json(raw_output)
        print(f"[DEBUG] Parsed activity: {activity_data}")
        print(f"[DEBUG] Type of activity: {type(activity_data)}")
        if not isinstance(activity_data, dict):
            print(f"[DEBUG] Converting to activity object")
            activity_data = {"activity_type": activity_type, "title": "Activity", "instructions": "Complete this activity", "question_or_task": str(activity_data)}
    except (json.JSONDecodeError, ValueError) as e:
        print(f"[DEBUG] JSON parsing error: {e}")
        return JSONResponse(
            {"error": "Failed to parse activity from AI.", "raw": raw_output},
            status_code=502,
        )

    try:
        print(f"[DEBUG] Getting existing activities for file_id: {file_id}")
        existing_lesson = db_supabase.get_content_row(str(file_id))
        existing_activities = []
        if existing_lesson and existing_lesson.get("activities"):
            existing_activities = existing_lesson["activities"]
            if not isinstance(existing_activities, list):
                existing_activities = [existing_activities]
        
        # Append new activity to existing ones
        existing_activities.append(activity_data)
        
        print(f"[DEBUG] Saving activities to database for file_id: {file_id}")
        db_supabase.set_activities(str(file_id), existing_activities)
        print(f"[DEBUG] Activities saved successfully")
    except Exception as e:
        print(f"[DEBUG] Database save error: {e}")
        return JSONResponse({"error": str(e)}, status_code=502)

    print(f"[DEBUG] Returning activity: {activity_data}")
    return {"activity": activity_data, "total_activities": len(existing_activities)}


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
async def time_in(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        student_id = (body.get("student_id") or body.get("student_id_number") or "").strip()
        if not student_id:
            return JSONResponse({"error": "student_id is required."}, status_code=400)

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
async def time_out(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        student_id = (body.get("student_id") or body.get("student_id_number") or "").strip()
        if not student_id:
            return JSONResponse({"error": "student_id is required."}, status_code=400)

        active = db_supabase.get_active_attendance(student_id)
        if not active:
            return JSONResponse({"error": "No active Time In found for this student."}, status_code=400)

        now_iso = datetime.now(timezone.utc).isoformat()
        updated = db_supabase.complete_time_out(str(active["id"]), now_iso)
        return updated
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.post("/submit-journal")
async def submit_journal(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        student_id = (body.get("student_id") or body.get("student_id_number") or "").strip()
        journal_body = (body.get("body") or "").strip()
        if not student_id or not journal_body:
            return JSONResponse({"error": "student_id and body are required."}, status_code=400)

        attendance_id = body.get("attendance_id")
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
async def journals_create(body: dict):
    err = require_supabase()
    if err is not None:
        return err
    try:
        sid = (body.get("student_id_number") or "").strip()
        text_body = (body.get("body") or "").strip()
        if not sid or not text_body:
            return JSONResponse({"error": "student_id_number and body are required."}, status_code=400)
        return db_supabase.insert_journal(sid, text_body, entry_date=body.get("entry_date"))
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/journals")
def journals_list(student_id_number: str):
    err = require_supabase()
    if err is not None:
        return err
    try:
        return db_supabase.list_journals_for_student(student_id_number)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
