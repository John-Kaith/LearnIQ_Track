"""Send registration credentials via Gmail SMTP (App Password)."""

from __future__ import annotations

import os
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def generate_registration_password(length: int = 12) -> str:
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))


def smtp_configured() -> bool:
    return bool((os.getenv("SMTP_USER") or "").strip() and (os.getenv("SMTP_PASSWORD") or "").strip())


def _smtp_settings() -> dict[str, Any]:
    return {
        "host": (os.getenv("SMTP_HOST") or "smtp.gmail.com").strip(),
        "port": int(os.getenv("SMTP_PORT") or "587"),
        "user": (os.getenv("SMTP_USER") or "").strip(),
        "password": (os.getenv("SMTP_PASSWORD") or "").strip(),
        "from_addr": (os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or "").strip(),
        "login_url": (os.getenv("APP_LOGIN_URL") or "http://127.0.0.1:8000/login.html").strip(),
    }


def _display_name(first_name: str, last_name: str, middle_name: str = "", suffix: str = "") -> str:
    parts = [p for p in (first_name, middle_name, last_name) if p]
    name = " ".join(parts).strip()
    if suffix:
        name = f"{name} {suffix}".strip()
    return name or "User"


def send_registration_credentials_email(
    *,
    to_email: str,
    first_name: str,
    last_name: str,
    middle_name: str = "",
    name_suffix: str = "",
    lrn: str,
    login_email: str,
    password: str,
    role: str,
) -> tuple[bool, str | None]:
    """Returns (sent_ok, error_message)."""
    if not smtp_configured():
        return False, "Gmail SMTP is not configured (set SMTP_USER and SMTP_PASSWORD in backend/.env)."

    to = to_email.strip().lower()
    if not to:
        return False, "Recipient email is missing."

    cfg = _smtp_settings()
    name = _display_name(first_name, last_name, middle_name, name_suffix)
    role_label = "Student" if role == "student" else "Teacher"
    lrn_label = "LRN" if role == "student" else "ID / Employee ID"

    subject = "Your LearnIQ Track login credentials"
    body = f"""Hello {name},

Your {role_label} account on LearnIQ Track has been created.

Sign in at: {cfg["login_url"]}

Your login credentials:
  • {lrn_label}: {lrn}
  • Email: {login_email}
  • Password: {password}

Students can sign in using LRN or email. Teachers and admins sign in with email.

If you did not expect this message, contact your school administrator.

— LearnIQ Track
"""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = cfg["from_addr"]
    msg["To"] = to
    msg.set_content(body)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=30) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(cfg["user"], cfg["password"])
            server.send_message(msg)
        return True, None
    except Exception as exc:
        return False, str(exc)
