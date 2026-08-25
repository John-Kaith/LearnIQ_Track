"""
Sample/dummy data seeder — FOR TESTING ONLY.

Creates one demo teacher + one demo student, two subjects (gold/amber
colors, matching the new Classroom-style banner), a few published lessons
under each, and enrolls the student in both — so the Stream / Classwork /
People tabs on my-lesson.html have real content to show instead of empty
states.

Usage:
    1. Make sure the backend is running: uvicorn main:app --reload
       (see HOW_TO_RUN.txt)
    2. python seed_classroom_demo.py

Safe to re-run: registering an already-existing id_number/email just prints
a "skipped" line and the script carries on with the rest.
"""

import requests

BASE_URL = "http://127.0.0.1:8000"

TEACHER = {
    # Deliberately generic — last name is literally the role, so this can
    # never be mistaken for a real person's name.
    "last_name": "Teacher",
    "first_name": "Demo",
    "id_number": "DEMO-T01",
    "email": "demo.teacher@learniq.test",
    "password": "demo1234",
    "role": "teacher",
}

STUDENT = {
    "last_name": "Student",
    "first_name": "Demo",
    "id_number": "DEMO-S01",
    "email": "demo.student@learniq.test",
    "password": "demo1234",
    "role": "student",
    "grade_level": "12",
    "strand": "STEM",
}

# Colors are pulled from the same gold/amber swatch palette used in
# teacher-subjects.html / admin-subjects.html — keep it in that family.
SUBJECTS = [
    {
        "name": "General Biology 2",
        "description": "Cell structure, genetics, and ecology.",
        "color": "#ca8a04",
        "lessons": [
            "Cell Structure and Function.pdf",
            "Mendelian Genetics.pdf",
            "Intro to Ecology.pdf",
        ],
    },
    {
        "name": "Research in Daily Life 2",
        "description": "Quantitative and qualitative research methods.",
        "color": "#b45309",
        "lessons": [
            "Research Design Basics.pdf",
        ],
    },
]


def register(user: dict) -> None:
    r = requests.post(f"{BASE_URL}/register", json=user, timeout=10)
    if r.status_code == 200:
        print(f"  created {user['id_number']} ({user['email']})")
    else:
        print(f"  skipped {user['id_number']}: {r.status_code} {r.text[:150]}")


def create_subject(subject: dict, teacher_id_number: str) -> dict | None:
    body = {
        "name": subject["name"],
        "description": subject["description"],
        "color": subject["color"],
        "created_by_teacher_id_number": teacher_id_number,
    }
    r = requests.post(f"{BASE_URL}/subjects", json=body, timeout=10)
    if r.status_code == 409:
        # Already exists from a previous run — look it up instead.
        existing = requests.get(
            f"{BASE_URL}/subjects",
            params={"owner_teacher_id_number": teacher_id_number},
            timeout=10,
        ).json()
        for row in existing.get("subjects", []):
            if row.get("name") == subject["name"]:
                print(f"  '{subject['name']}' already exists -> id={row['id']}")
                return row
        print(f"  '{subject['name']}' reported duplicate but not found — skipping.")
        return None
    if not r.ok:
        print(f"  failed to create '{subject['name']}': {r.status_code} {r.text[:150]}")
        return None
    row = r.json()
    print(f"  created '{row['name']}' -> id={row['id']} join_code={row['join_code']}")
    return row


def upload_and_publish_lesson(filename: str, subject_id: str, teacher_id_number: str) -> None:
    r = requests.post(
        f"{BASE_URL}/upload-lesson",
        json={
            "filename": filename,
            "extracted_text": f"Sample seeded content for {filename} — used to test the UI only.",
            "teacher_id_number": teacher_id_number,
            "subject_id": subject_id,
        },
        timeout=10,
    )
    if not r.ok:
        print(f"    upload failed for {filename}: {r.status_code} {r.text[:150]}")
        return
    lesson = r.json()
    pr = requests.post(
        f"{BASE_URL}/publish-lesson",
        json={"lesson_id": lesson.get("id")},
        timeout=10,
    )
    status = "published" if pr.ok else f"publish failed ({pr.status_code})"
    print(f"    {filename}: {status}")


def join_subject(student_id_number: str, join_code: str) -> None:
    if not join_code:
        print("    (no join_code returned, skipping enrollment)")
        return
    r = requests.post(
        f"{BASE_URL}/subjects/join",
        json={"student_id_number": student_id_number, "join_code": join_code},
        timeout=10,
    )
    if r.ok or r.status_code == 409:  # 409 = already enrolled, fine
        print(f"    student enrolled (or already was) via code {join_code}")
    else:
        print(f"    join failed: {r.status_code} {r.text[:150]}")


def main() -> None:
    print("1) Registering demo accounts...")
    register(TEACHER)
    register(STUDENT)

    print("2) Creating subjects + lessons...")
    for subject in SUBJECTS:
        row = create_subject(subject, TEACHER["id_number"])
        if not row:
            continue
        for filename in subject["lessons"]:
            upload_and_publish_lesson(filename, row["id"], TEACHER["id_number"])
        join_subject(STUDENT["id_number"], row.get("join_code"))

    print("\nDone. Log in at http://localhost:8090/login.html with:")
    print(f"  Teacher -> {TEACHER['email']} / {TEACHER['password']}")
    print(f"  Student -> {STUDENT['email']} / {STUDENT['password']}")
    print("Then open My lesson -> a subject to see the new banner + Stream/Classwork/People tabs.")


if __name__ == "__main__":
    main()
