"""
Supabase client for LearnIQ Track. Loads backend/.env (SUPABASE_URL + key).
Prefer SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) on the server so RLS does not block inserts.
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

_env_dir = Path(__file__).resolve().parent
load_dotenv(_env_dir / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    or os.getenv("SERVICE_ROLE_KEY", "").strip()
    or os.getenv("SUPABASE_KEY", "").strip()
)

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def is_configured() -> bool:
    return supabase is not None
