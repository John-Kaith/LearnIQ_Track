"""DepEd SHS grading (DepEd Order No. 8, s. 2015): component weights
(Table 5), the initial grade, transmutation, descriptors and rounding."""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

PASSING_GRADE = 75

TVL_STRANDS = frozenset({"TVL-HE", "TVL", "TVLHE"})
VALID_DEPED_CATEGORIES = frozenset(
    {"core", "academic_standard", "academic_specialized"}
)


def normalize_strand(strand: str | None) -> str:
    return (strand or "").strip().upper().replace(" ", "-")


def shs_component_weights(
    strand: str | None,
    deped_category: str | None,
) -> dict[str, float]:
    """Return weight fractions: ww, pt, qa (sum = 1.0)."""
    category = (deped_category or "academic_standard").strip().lower()
    if category not in VALID_DEPED_CATEGORIES:
        category = "academic_standard"

    # Core subjects weigh the same in every track (Table 5).
    if category == "core":
        return {"ww": 0.25, "pt": 0.50, "qa": 0.25}
    if normalize_strand(strand) in TVL_STRANDS:
        return {"ww": 0.20, "pt": 0.60, "qa": 0.20}
    if category == "academic_specialized":
        return {"ww": 0.35, "pt": 0.40, "qa": 0.25}
    return {"ww": 0.25, "pt": 0.45, "qa": 0.30}


def format_weights_label(weights: dict[str, float]) -> str:
    ww = int(round(weights.get("ww", 0) * 100))
    pt = int(round(weights.get("pt", 0) * 100))
    qa = int(round(weights.get("qa", 0) * 100))
    return f"{ww}/{pt}/{qa}"


def compute_weighted_final(
    written_work: float | None,
    performance_task: float | None,
    quarterly_assessment: float | None,
    weights: dict[str, float],
) -> float | None:
    """The DepEd *initial* grade (sum of weighted scores, 2 decimals); needs all
    three component scores. transmute() turns it into the period grade."""
    if written_work is None or performance_task is None or quarterly_assessment is None:
        return None
    total = (
        float(written_work) * weights["ww"]
        + float(performance_task) * weights["pt"]
        + float(quarterly_assessment) * weights["qa"]
    )
    return round(total, 2)


def resolve_component_scores(
    *,
    auto_ww: float | None,
    auto_pt: float | None,
    auto_qa: float | None,
    stored: dict[str, Any] | None,
) -> tuple[float | None, float | None, float | None]:
    """Teacher-stored scores override auto-computed values when present."""
    row = stored or {}
    ww = row.get("written_work_score")
    pt = row.get("performance_task_score")
    qa = row.get("quarterly_assessment_score")
    return (
        float(ww) if ww is not None else auto_ww,
        float(pt) if pt is not None else auto_pt,
        float(qa) if qa is not None else auto_qa,
    )
# .


def round_half_up(value: float | None) -> int | None:
    """Whole-number rounding as on report cards (89.5 -> 90, not banker's 90/88)."""
    if value is None:
        return None
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def transmute(initial_grade: float | None) -> int | None:
    """DepEd transmutation table: initial grade -> grading-period grade.

    60.00 and up: every 1.60 points is one grade step from 75 (60 -> 75,
    84.86 -> 90, 100 -> 100). Below 60: every 4 points is one step from 60
    (0 -> 60, 59.99 -> 74). Done in hundredths so float noise can't flip a step.
    """
    if initial_grade is None:
        return None
    hundredths = int(Decimal(str(initial_grade)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) * 100)
    hundredths = max(0, min(10000, hundredths))
    if hundredths >= 6000:
        return min(100, 75 + (hundredths - 6000) // 160)
    return 60 + hundredths // 400


def grade_descriptor(grade: float | None) -> str | None:
    """DepEd descriptor for a period, semester or general average grade."""
    if grade is None:
        return None
    g = float(grade)
    if g >= 90:
        return "Outstanding"
    if g >= 85:
        return "Very Satisfactory"
    if g >= 80:
        return "Satisfactory"
    if g >= PASSING_GRADE:
        return "Fairly Satisfactory"
    return "Did Not Meet Expectations"


def average_grade(grades: list[float | None]) -> int | None:
    """Whole-number average of the grades that exist (None when there are none)."""
    present = [float(g) for g in grades if g is not None]
    if not present:
        return None
    return round_half_up(sum(present) / len(present))
