/**
 * Student Profile — Learning IQ from /student/learning-iq (real quiz + activity data).
 * Not a clinical IQ test — LearnIQ learning intelligence from lesson behavior.
 */
(function () {
  function escapeHtml(text) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(text);
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
  }

  function levelForScore(score) {
    const n = Number(score);
    if (n >= 90) return { label: "Exceptional Learner", tier: "exceptional" };
    if (n >= 80) return { label: "Advanced Learner", tier: "advanced" };
    if (n >= 70) return { label: "Developing Learner", tier: "developing" };
    return { label: "Needs Improvement", tier: "growth" };
  }

  function barTierForScore(score) {
    const n = Number(score);
    if (n >= 90) return "elite";
    if (n >= 75) return "strong";
    if (n >= 60) return "steady";
    return "focus";
  }

  function renderInsightList(items, iconClass) {
    if (!items || !items.length) {
      return `<li class="learning-iq-insight-empty">—</li>`;
    }
    return items
      .map(
        (item) =>
          `<li><i class="fa-solid ${iconClass}" aria-hidden="true"></i><span>${escapeHtml(item)}</span></li>`
      )
      .join("");
  }

  function renderLearningIQ(data) {
    const card = document.getElementById("learning-iq-card");
    if (!card) return;

    const score = Math.max(0, Math.min(100, Number(data.score) || 0));
    const level = levelForScore(score);
    const barTier = barTierForScore(score);

    const scoreEl = document.getElementById("learning-iq-score");
    const levelEl = document.getElementById("learning-iq-level-label");
    const barEl = document.getElementById("learning-iq-bar-fill");
    const barPctEl = document.getElementById("learning-iq-bar-pct");
    const strengthsEl = document.getElementById("learning-iq-strengths");
    const improveEl = document.getElementById("learning-iq-improvements");
    const encourageEl = document.getElementById("learning-iq-encouragement");

    if (scoreEl) scoreEl.textContent = String(Math.round(score));
    if (levelEl) {
      levelEl.textContent = level.label;
      levelEl.dataset.tier = level.tier;
    }
    if (barPctEl) barPctEl.textContent = `${Math.round(score)}%`;
    if (barEl) {
      barEl.className = `learning-iq-bar-fill learning-iq-bar-fill--${barTier}`;
      barEl.style.width = "0%";
      barEl.setAttribute("aria-valuenow", String(Math.round(score)));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          barEl.style.width = `${score}%`;
        });
      });
    }
    if (strengthsEl) {
      strengthsEl.innerHTML = renderInsightList(data.strengths, "fa-circle-check");
    }
    if (improveEl) {
      improveEl.innerHTML = renderInsightList(data.improvements, "fa-circle-dot");
    }
    if (encourageEl) encourageEl.textContent = data.encouragement || "";

    card.dataset.score = String(Math.round(score));
    card.dataset.tier = level.tier;
    card.dataset.computed = data.is_computed ? "true" : "false";
  }

  function renderLoading() {
    const scoreEl = document.getElementById("learning-iq-score");
    const levelEl = document.getElementById("learning-iq-level-label");
    const encourageEl = document.getElementById("learning-iq-encouragement");
    if (scoreEl) scoreEl.textContent = "…";
    if (levelEl) levelEl.textContent = "Calculating…";
    if (encourageEl) encourageEl.textContent = "Loading your Learning IQ from quiz and activity data…";
  }

  function renderError(message) {
    renderLearningIQ({
      score: 0,
      strengths: [],
      improvements: ["Could not load score — try again later"],
      encouragement: message || "Sign in and refresh to see your Learning IQ.",
      is_computed: false,
    });
  }

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    const getSession =
      typeof window.getCurrentUserSession === "function" ? window.getCurrentUserSession : null;
    const user = getSession ? getSession() : null;
    if (user?.access_token) headers.Authorization = `Bearer ${user.access_token}`;
    return headers;
  }

  async function fetchLearningIQ() {
    const url =
      typeof window.apiUrl === "function"
        ? window.apiUrl("/student/learning-iq")
        : "/student/learning-iq";
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function initStudentLearningIQ() {
    const section = document.getElementById("learning-iq-section");
    const card = document.getElementById("learning-iq-card");
    if (!section || !card) return;

    const getSession =
      typeof window.getCurrentUserSession === "function" ? window.getCurrentUserSession : null;
    const user = getSession ? getSession() : null;
    const role = String(user?.role || "").toLowerCase();

    if (!user || role !== "student") {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    renderLoading();

    try {
      const data = await fetchLearningIQ();
      renderLearningIQ(data);
    } catch (err) {
      console.error("learning-iq:", err);
      renderError(
        "We could not load your Learning IQ. Make sure you are signed in and the server is running."
      );
    }
  }

  window.initStudentLearningIQ = initStudentLearningIQ;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudentLearningIQ);
  } else {
    initStudentLearningIQ();
  }
})();
