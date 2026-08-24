// Public, no-login workplace check-in display. A teacher shares this page's
// URL (with their display token) with a student's host company once; the
// host just opens it here — no account needed — and leaves it open while
// students scan the rotating QR with their own phones.

(function () {
  const REFRESH_MS = 15000;
  const POLL_MS = 4000;

  let tid = "";
  let token = "";
  let refreshTimer = null;
  let countdownTimer = null;
  let pollTimer = null;
  let countdownDeadline = 0;
  let countdownTotalMs = REFRESH_MS;
  let lastPollAt = null;
  let tokenFetchInFlight = false;

  function $(id) {
    return document.getElementById(id);
  }

  function paramsFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search);
      return { tid: (p.get("tid") || "").trim(), token: (p.get("token") || "").trim() };
    } catch {
      return { tid: "", token: "" };
    }
  }

  function showError(message) {
    const ready = $("workplace-display-ready");
    const errorBox = $("workplace-display-error");
    const errorText = $("workplace-display-error-text");
    if (ready) ready.hidden = true;
    if (errorBox) errorBox.hidden = false;
    if (errorText && message) errorText.textContent = message;
  }

  async function refreshQr() {
    const canvas = $("workplace-display-qr-canvas");
    if (!canvas || typeof QRCode === "undefined" || tokenFetchInFlight) return;
    tokenFetchInFlight = true;
    try {
      const res = await fetch(
        apiUrl(`/public/immersion/qr-token?tid=${encodeURIComponent(tid)}&token=${encodeURIComponent(token)}`)
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) {
          stopRotation();
          stopPolling();
          showError(data.error || "This link is invalid. Ask your teacher for a new one.");
          return;
        }
        throw new Error(data.error || "Could not refresh the QR code.");
      }
      QRCode.toCanvas(canvas, data.token, { width: 220, margin: 1 }, () => {});
      const ttlMs = (data.ttl_seconds || 20) * 1000;
      countdownTotalMs = Math.min(ttlMs, REFRESH_MS);
      countdownDeadline = Date.now() + countdownTotalMs;
    } catch (e) {
      console.warn("workplace display QR:", e);
    } finally {
      tokenFetchInFlight = false;
    }
  }

  function tickCountdown() {
    const fill = $("workplace-display-countdown-fill");
    const label = $("workplace-display-countdown-label");
    if (!fill && !label) return;
    const msLeft = Math.max(0, countdownDeadline - Date.now());
    const pct = countdownTotalMs > 0 ? Math.max(0, Math.min(100, (msLeft / countdownTotalMs) * 100)) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = msLeft > 250 ? `New code in ${Math.ceil(msLeft / 1000)}s` : "Refreshing…";
  }

  function startRotation() {
    stopRotation();
    void refreshQr();
    refreshTimer = window.setInterval(() => void refreshQr(), REFRESH_MS);
    countdownTimer = window.setInterval(tickCountdown, 200);
  }

  function stopRotation() {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (countdownTimer) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function announceEvent(evt) {
    if (typeof announceVoice !== "function") return;
    const name = evt.student_name || "A student";
    const phrase =
      evt.action === "time_out"
        ? `${name} has timed out from work immersion.`
        : `${name} has timed in for work immersion.`;
    announceVoice(phrase);
  }

  async function pollRecentCheckins() {
    if (!lastPollAt) {
      lastPollAt = new Date().toISOString();
      return;
    }
    try {
      const res = await fetch(
        apiUrl(
          `/public/immersion/recent-checkins?tid=${encodeURIComponent(tid)}&token=${encodeURIComponent(token)}&since=${encodeURIComponent(lastPollAt)}`
        )
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      for (const evt of data.events || []) announceEvent(evt);
      for (const evt of data.events || []) {
        if (evt.at && evt.at > lastPollAt) lastPollAt = evt.at;
      }
    } catch (e) {
      console.warn("workplace display recent check-ins:", e);
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => void pollRecentCheckins(), POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // Editable workplace name — purely local to this device/browser (no
  // backend storage). Lets whoever set up this display label it, e.g.
  // "Yoma Inc.", so it's clear which host company's check-in this is.
  function nameStorageKey() {
    return `learniq-workplace-name:${tid}`;
  }

  function loadWorkplaceName() {
    try {
      return (localStorage.getItem(nameStorageKey()) || "").trim();
    } catch {
      return "";
    }
  }

  function saveWorkplaceName(name) {
    try {
      if (name) localStorage.setItem(nameStorageKey(), name);
      else localStorage.removeItem(nameStorageKey());
    } catch {
      /* ignore — editable name is a nice-to-have, not critical */
    }
  }

  function applyWorkplaceName() {
    const textEl = $("workplace-display-name-text");
    const saved = loadWorkplaceName();
    const display = saved || "Workplace Check-In";
    if (textEl) textEl.textContent = display;
    document.title = saved ? `${saved} | LearnIQ Track` : "Workplace Check-In | LearnIQ Track";
  }

  function startEditingName() {
    const textEl = $("workplace-display-name-text");
    const input = $("workplace-display-name-input");
    if (!textEl || !input) return;
    input.value = loadWorkplaceName();
    textEl.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }

  function finishEditingName() {
    const textEl = $("workplace-display-name-text");
    const input = $("workplace-display-name-input");
    if (!textEl || !input || input.hidden) return;
    saveWorkplaceName(input.value.trim());
    input.hidden = true;
    textEl.hidden = false;
    applyWorkplaceName();
  }

  function initEditableName() {
    applyWorkplaceName();
    $("workplace-display-name-edit-btn")?.addEventListener("click", startEditingName);
    const input = $("workplace-display-name-input");
    input?.addEventListener("blur", finishEditingName);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      } else if (e.key === "Escape") {
        input.hidden = true;
        $("workplace-display-name-text").hidden = false;
      }
    });
  }

  function init() {
    if (!document.body.classList.contains("workplace-display-page")) return;
    const p = paramsFromUrl();
    tid = p.tid;
    token = p.token;
    if (!tid || !token) {
      showError("This link is missing information. Ask your teacher for a new one.");
      return;
    }
    initEditableName();
    startRotation();
    startPolling();
    window.addEventListener("beforeunload", () => {
      stopRotation();
      stopPolling();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
