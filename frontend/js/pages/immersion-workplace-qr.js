// Teacher-side: the printable-turned-live "workplace check-in QR" for work
// immersion. Kept open on a screen at the immersion site — students scan it
// with their own phone to Time In / Time Out. The code rotates every ~15s
// (anti-fraud: a saved screenshot stops scanning within seconds, proving the
// student was physically there), and each scan is announced out loud.

(function () {
  const REFRESH_MS = 15000;
  const POLL_MS = 4000;

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

  function authHeaders(json) {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const h = json ? { "Content-Type": "application/json" } : {};
    if (u?.access_token) h.Authorization = `Bearer ${u.access_token}`;
    return h;
  }

  function teacherIdNumber() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    return u?.id_number ? String(u.id_number).trim() : "";
  }

  async function refreshQr() {
    const canvas = $("immersion-workplace-qr-canvas");
    const tid = teacherIdNumber();
    if (!canvas || !tid || typeof QRCode === "undefined" || tokenFetchInFlight) return;
    tokenFetchInFlight = true;
    try {
      const res = await fetch(
        apiUrl(`/teacher/immersion/qr-token?teacher_id_number=${encodeURIComponent(tid)}`),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "Could not refresh the QR code.");
      QRCode.toCanvas(canvas, data.token, { width: 220, margin: 1 }, () => {});
      const ttlMs = (data.ttl_seconds || 20) * 1000;
      countdownTotalMs = Math.min(ttlMs, REFRESH_MS);
      countdownDeadline = Date.now() + countdownTotalMs;
    } catch (e) {
      console.warn("immersion workplace QR:", e);
    } finally {
      tokenFetchInFlight = false;
    }
  }

  function tickCountdown() {
    const fill = $("immersion-qr-countdown-fill");
    const label = $("immersion-qr-countdown-label");
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
    const tid = teacherIdNumber();
    if (!tid) return;
    if (!lastPollAt) {
      // First poll: only start listening from now on — don't announce old history.
      lastPollAt = new Date().toISOString();
      return;
    }
    try {
      const res = await fetch(
        apiUrl(
          `/teacher/immersion/recent-checkins?teacher_id_number=${encodeURIComponent(tid)}&since=${encodeURIComponent(lastPollAt)}`
        ),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const events = data.events || [];
      for (const evt of events) announceEvent(evt);
      // Only ever advance `lastPollAt` to a timestamp we actually saw an
      // event at — never to the server's current wall-clock. A scan that
      // commits between "since" and the moment this request was processed
      // would otherwise fall in the gap and never be seen by any poll.
      for (const evt of events) {
        if (evt.at && evt.at > lastPollAt) lastPollAt = evt.at;
      }
    } catch (e) {
      console.warn("immersion recent check-ins:", e);
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

  async function getShareLink() {
    const tid = teacherIdNumber();
    const btn = $("immersion-get-share-link-btn");
    const panel = $("immersion-share-link-panel");
    const input = $("immersion-share-link-input");
    if (!tid || !panel || !input) return;
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(
        apiUrl(`/teacher/immersion/display-link?teacher_id_number=${encodeURIComponent(tid)}`),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "Could not get the shareable link.");
      const url = `${window.location.origin}/workplace-display.html?tid=${encodeURIComponent(data.teacher_id_number)}&token=${encodeURIComponent(data.token)}`;
      input.value = url;
      panel.hidden = false;
      input.select();
    } catch (e) {
      if (typeof showToast === "function") showToast(e.message || "Could not get the shareable link.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    if (!document.body.classList.contains("teacher-immersion-attendance-page")) return;
    startRotation();
    startPolling();
    $("immersion-get-share-link-btn")?.addEventListener("click", () => void getShareLink());
    $("immersion-share-link-copy-btn")?.addEventListener("click", async () => {
      const input = $("immersion-share-link-input");
      if (!input?.value) return;
      const ok = typeof copyTextToClipboard === "function" ? await copyTextToClipboard(input.value) : false;
      if (typeof showToast === "function") {
        showToast(ok ? "Link copied." : "Could not copy — select and copy manually.", ok ? "success" : "error");
      }
    });
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
