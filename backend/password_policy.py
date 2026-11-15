"""Password strength and breach checks shared by account creation flows."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

import requests

MIN_PASSWORD_LENGTH = 10
_HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/"
_COMMON_PASSWORDS = frozenset(
    {
        "1234567890",
        "password",
        "password1",
        "password123",
        "qwerty123",
        "admin123",
        "letmein123",
        "welcome123",
        "iloveyou",
        "student123",
        "teacher123",
        "learn iq",
    }
)


class PasswordBreachCheckUnavailable(RuntimeError):
    """Raised when the breach service cannot be reached."""


@dataclass(frozen=True)
class PasswordPolicyResult:
    ok: bool
    score: int
    label: str
    message: str


def _score(password: str, common: bool, breached: bool) -> int:
    score = 0
    if len(password) >= MIN_PASSWORD_LENGTH:
        score += 1
    if len(password) >= 14:
        score += 1
    if len(password) >= 18:
        score += 1
    score += sum(
        bool(pattern.search(password))
        for pattern in (
            re.compile(r"[A-Z]"),
            re.compile(r"[a-z]"),
            re.compile(r"\d"),
            re.compile(r"[^A-Za-z0-9\s]"),
        )
    )
    if not common:
        score += 1
    if not breached:
        score += 1
    return min(score, 7)


def _is_breached(password: str) -> bool:
    digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]
    try:
        response = requests.get(
            _HIBP_RANGE_URL + prefix,
            headers={"Add-Padding": "true", "User-Agent": "LearnIQ-Track-password-check"},
            timeout=5,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise PasswordBreachCheckUnavailable from exc
    return any(line.split(":", 1)[0].strip().upper() == suffix for line in response.text.splitlines())


def validate_password(password: str) -> PasswordPolicyResult:
    common = password.lower() in _COMMON_PASSWORDS
    if common:
        return PasswordPolicyResult(False, 1, "Weak", "Choose a less common password.")

    missing = []
    if len(password) < MIN_PASSWORD_LENGTH:
        missing.append(f"at least {MIN_PASSWORD_LENGTH} characters")
    if not re.search(r"[A-Z]", password):
        missing.append("an uppercase letter")
    if not re.search(r"[a-z]", password):
        missing.append("a lowercase letter")
    if not re.search(r"\d", password):
        missing.append("a number")
    if not re.search(r"[^A-Za-z0-9\s]", password):
        missing.append("a symbol")
    score = _score(password, common=False, breached=False)
    if missing:
        return PasswordPolicyResult(False, score, "Weak", "Password needs " + ", ".join(missing) + ".")
    if _is_breached(password):
        return PasswordPolicyResult(False, 1, "Weak", "This password has appeared in a data breach. Choose another password.")
    label = "Very strong" if score >= 7 else "Strong" if score >= 6 else "Fair"
    return PasswordPolicyResult(True, score, label, f"Password strength: {label}.")
