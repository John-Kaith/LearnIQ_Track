"""DepEd SHS grading weights (Table 5) and weighted final computation."""

from __future__ import annotations

from typing import Any

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

    if normalize_strand(strand) in TVL_STRANDS:
        return {"ww": 0.20, "pt": 0.60, "qa": 0.20}

    if category == "core":
        return {"ww": 0.25, "pt": 0.50, "qa": 0.25}
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
    """DepEd-style weighted final; requires all three component scores."""
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
