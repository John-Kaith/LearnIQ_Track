"""Local disk storage for immersion Time In photos (uploads/immersion/).

The photos show students, so /uploads/immersion/… only opens through a link
the API signed: /uploads/<path>?exp=<unix time>&sig=<hmac>. A copied link stops
working within two hours. main.py's SecurityMiddleware checks the signature.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT = Path(os.environ.get("IMMERSION_UPLOAD_ROOT", str(BASE_DIR / "uploads")))
IMMERSION_SUBDIR = "immersion"

ALLOWED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PHOTO_BYTES = 6 * 1024 * 1024

_FALLBACK_LINK_SECRET = secrets.token_hex(32)  # only if no server secret is configured


def _photo_link_key() -> bytes:
    """Read at call time: main.py loads .env after importing this module."""
    secret = (
        os.getenv("UPLOAD_SIGNING_SECRET")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_KEY")
        or _FALLBACK_LINK_SECRET
    ).strip()
    return hmac.new(secret.encode("utf-8"), b"learniq-photo-links", hashlib.sha256).digest()


def _photo_link_sig(rel: str, exp: int) -> str:
    return hmac.new(_photo_link_key(), f"{rel}:{exp}".encode("utf-8"), hashlib.sha256).hexdigest()


def signed_photo_url(relative_path: str) -> str:
    """Valid for one to two hours. Expiry is on the hour, so a page's links stay
    the same for a while and the browser can cache the photos."""
    rel = str(relative_path).strip().lstrip("/")
    exp = (int(time.time()) // 3600 + 2) * 3600
    return f"/uploads/{rel}?exp={exp}&sig={_photo_link_sig(rel, exp)}"


def photo_link_is_valid(relative_path: str, exp: str | None, sig: str | None) -> bool:
    try:
        exp_at = int(exp or "")
    except ValueError:
        return False
    if exp_at < time.time():
        return False
    rel = str(relative_path).strip().lstrip("/")
    return hmac.compare_digest(_photo_link_sig(rel, exp_at), str(sig or ""))


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
        p = p[len("uploads/") :]
    return signed_photo_url(p)
# .
