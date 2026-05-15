"""Local disk storage for immersion Time In photos (uploads/immersion/)."""
from __future__ import annotations

import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = Path(os.environ.get("IMMERSION_UPLOAD_ROOT", str(BASE_DIR / "uploads")))
IMMERSION_SUBDIR = "immersion"

ALLOWED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTO_BYTES = 6 * 1024 * 1024


def _safe_id_number(student_id_number: str) -> str:
    raw = (student_id_number or "").strip()
    safe = re.sub(r"[^\w.\-]", "_", raw)
    return safe or "unknown"


def immersion_day_folder(student_id_number: str, day_iso: str | None = None) -> Path:
    day = day_iso or datetime.now(timezone.utc).date().isoformat()
    return UPLOAD_ROOT / IMMERSION_SUBDIR / _safe_id_number(student_id_number) / day


def save_immersion_photo(
    student_id_number: str,
    raw: bytes,
    original_name: str | None = None,
    *,
    name_prefix: str = "capture",
) -> str:
    """Save bytes under uploads/immersion/{id}/{date}/{uuid}.ext — returns relative path under uploads/."""
    if not raw:
        raise ValueError("Photo file is empty.")
    if len(raw) > MAX_PHOTO_BYTES:
        raise ValueError("Photo is too large (max 6 MB).")

    ext = ".jpg"
    if original_name:
        suffix = Path(original_name).suffix.lower()
        if suffix in ALLOWED_IMAGE_SUFFIXES:
            ext = ".jpg" if suffix == ".jpeg" else suffix

    day = datetime.now(timezone.utc).date().isoformat()
    folder = immersion_day_folder(student_id_number, day)
    folder.mkdir(parents=True, exist_ok=True)
    safe_prefix = re.sub(r"[^\w\-]", "", (name_prefix or "capture").strip()) or "capture"
    filename = f"{safe_prefix}-{uuid.uuid4().hex}{ext}"
    dest = folder / filename
    dest.write_bytes(raw)

    rel = f"{IMMERSION_SUBDIR}/{_safe_id_number(student_id_number)}/{day}/{filename}"
    return rel.replace("\\", "/")


def photo_public_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    p = str(relative_path).strip().lstrip("/")
    if p.startswith("uploads/"):
        return f"/{p}"
    return f"/uploads/{p}"
