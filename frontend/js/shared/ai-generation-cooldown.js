/**
 * 30s cooldown per AI generation type (reviewer, quiz, activity) after a successful run.
 */
(function () {
  const COOLDOWN_MS = 30_000;
  const TYPES = ["reviewer", "quiz", "activity"];

  const buttonsByType = { reviewer: [], quiz: [], activity: [] };
  const packButtons = [];
  let tickTimer = null;

  function storageKey(type) {
    const u =
      typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const id = (u && (u.id_number || u.email)) || "guest";
    return `lq_ai_gen_cd_${String(id).trim()}_${type}`;
  }

  function getRemainingMs(type) {
    if (!TYPES.includes(type)) return 0;
    try {
      const until = parseInt(localStorage.getItem(storageKey(type)) || "0", 10);
      if (!until || Number.isNaN(until)) return 0;
      return Math.max(0, until - Date.now());
    } catch {
      return 0;
    }
  }

  function start(type) {
    if (!TYPES.includes(type)) return;
    try {
      localStorage.setItem(storageKey(type), String(Date.now() + COOLDOWN_MS));
    } catch {
      /* ignore */
    }
    refreshButtons();
  }

  function assertCanGenerate(type) {
    const ms = getRemainingMs(type);
    if (ms <= 0) return;
    const secs = Math.ceil(ms / 1000);
    throw new Error(`Please wait ${secs}s before generating ${type} again.`);
  }

  function assertCanGenerateAll(types) {
    for (const t of types) assertCanGenerate(t);
  }

  function formatLabel(type, remainingMs) {
    const secs = Math.ceil(remainingMs / 1000);
    const names = {
      reviewer: "Reviewer",
      quiz: "Quiz",
      activity: "Activity",
    };
    return `${names[type] || type} (${secs}s)`;
  }

  function applyButtonState(btn, type) {
    if (!btn) return;
    const remaining = getRemainingMs(type);
    const onCooldown = remaining > 0;
    if (!btn.dataset.aiGenDefaultHtml) {
      btn.dataset.aiGenDefaultHtml = btn.innerHTML;
    }
    if (onCooldown) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("ai-gen-on-cooldown");
      btn.innerHTML = `<i class="fa-solid fa-clock"></i> ${formatLabel(type, remaining)}`;
    } else {
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
      btn.classList.remove("ai-gen-on-cooldown");
      btn.innerHTML = btn.dataset.aiGenDefaultHtml;
    }
  }

  function applyPackButtonState(btn) {
    if (!btn) return;
    const remaining = Math.max(...TYPES.map((t) => getRemainingMs(t)));
    if (!btn.dataset.aiGenDefaultHtml) {
      btn.dataset.aiGenDefaultHtml = btn.innerHTML;
    }
    if (remaining > 0) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("ai-gen-on-cooldown");
      const secs = Math.ceil(remaining / 1000);
      btn.innerHTML = `<i class="fa-solid fa-clock"></i> AI pack (${secs}s)`;
    } else {
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
      btn.classList.remove("ai-gen-on-cooldown");
      btn.innerHTML = btn.dataset.aiGenDefaultHtml;
    }
  }

  function refreshButtons() {
    for (const type of TYPES) {
      for (const btn of buttonsByType[type]) {
        applyButtonState(btn, type);
      }
    }
    for (const btn of packButtons) {
      applyPackButtonState(btn);
    }
    const anyActive = TYPES.some((t) => getRemainingMs(t) > 0);
    if (anyActive && !tickTimer) {
      tickTimer = window.setInterval(() => {
        refreshButtons();
        if (!TYPES.some((t) => getRemainingMs(t) > 0)) {
          window.clearInterval(tickTimer);
          tickTimer = null;
        }
      }, 500);
    }
  }

  function registerButton(type, el) {
    if (!el || !TYPES.includes(type)) return;
    if (!buttonsByType[type].includes(el)) buttonsByType[type].push(el);
    applyButtonState(el, type);
  }

  function registerById(type, id) {
    const el = document.getElementById(id);
    if (el) registerButton(type, el);
  }

  function registerPackButton(el) {
    if (!el || packButtons.includes(el)) return;
    packButtons.push(el);
    applyPackButtonState(el);
  }

  function registerPackById(id) {
    const el = document.getElementById(id);
    if (el) registerPackButton(el);
  }

  function registerDefaults() {
    registerById("reviewer", "student-generate-reviewer-btn");
    registerById("quiz", "student-generate-quiz-btn");
    registerById("quiz", "student-quiz-generate-confirm");
    registerById("activity", "student-generate-activity-btn");
    registerById("activity", "student-activity-generate-confirm");
    registerPackById("teacher-generate-ai-pack-btn");
  }

  window.AiGenCooldown = {
    COOLDOWN_MS,
    TYPES,
    getRemainingMs,
    start,
    assertCanGenerate,
    assertCanGenerateAll,
    registerButton,
    registerById,
    registerDefaults,
    registerPackButton,
    registerPackById,
    refreshButtons,
  };

  document.addEventListener("DOMContentLoaded", () => {
    registerDefaults();
    refreshButtons();
  });
})();
