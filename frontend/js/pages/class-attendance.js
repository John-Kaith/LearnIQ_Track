// Class attendance — teacher subject page (rotating QR display) + student
// my-lesson (camera scanner). The teacher shows a QR that rotates every
// ~15s (anti-fraud — a saved screenshot stops scanning within seconds);
// students scan it with their own camera to check themselves in. Each
// successful scan is announced out loud and pushed to a live feed.

(function () {
  const TEACHER_POLL_MS = 4000;
  const QR_REFRESH_MS = 15000;
  const SCAN_REPEAT_COOLDOWN_MS = 4000; // ignore the same QR again for this long
  const FLASH_MS = 500;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return typeof escapeHtml === "function" ? escapeHtml(s) : String(s ?? "");
  }

  function authHeaders(json) {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const h = json ? { "Content-Type": "application/json" } : {};
    if (u?.access_token) h.Authorization = `Bearer ${u.access_token}`;
    return h;
  }

  function teacherId() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    return u?.id_number ? String(u.id_number).trim() : "";
  }

  function subjectIdFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("subject_id")?.trim() || "";
    } catch {
      return "";
    }
  }

  function fmtClock(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  function fmtSubmittedTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return fmtClock(iso);
    }
  }

  function initials(name) {
    return (
      String(name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "??"
    );
  }

  // ── Teacher (teacher-subject-lessons.html): rotating QR + live feed ────

  let teacherPollTimer = null;
  let teacherSessionId = null;
  let qrRefreshTimer = null;
  let qrCountdownTimer = null;
  let qrCountdownDeadline = 0;
  let qrCountdownTotalMs = QR_REFRESH_MS;
  let qrTokenFetchInFlight = false;
  let announcedPresentIds = null; // null = not yet seeded for the current session
  let announcedForSessionId = undefined; // deliberately not null, so the first real session (id=null) still seeds

  function stopTeacherPoll() {
    if (teacherPollTimer) {
      clearInterval(teacherPollTimer);
      teacherPollTimer = null;
    }
  }

  async function refreshTeacherQr() {
    const canvas = $("teacher-class-qr-canvas");
    const sid = subjectIdFromUrl();
    const tid = teacherId();
    if (!canvas || !sid || !tid || typeof QRCode === "undefined" || qrTokenFetchInFlight) return;
    qrTokenFetchInFlight = true;
    try {
      const res = await fetch(
        apiUrl(
          `/teacher/class-attendance/qr-token?teacher_id_number=${encodeURIComponent(tid)}&subject_id=${encodeURIComponent(sid)}`
        ),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || "Could not refresh the QR code.");
      QRCode.toCanvas(canvas, data.token, { width: 220, margin: 1 }, () => {});
      const ttlMs = (data.ttl_seconds || 15) * 1000;
      qrCountdownTotalMs = Math.min(ttlMs, QR_REFRESH_MS);
      qrCountdownDeadline = Date.now() + qrCountdownTotalMs;
    } catch (e) {
      console.warn("class attendance QR:", e);
    } finally {
      qrTokenFetchInFlight = false;
    }
  }

  function tickQrCountdown() {
    const fill = $("teacher-class-qr-countdown-fill");
    const label = $("teacher-class-qr-countdown-label");
    if (!fill && !label) return;
    const msLeft = Math.max(0, qrCountdownDeadline - Date.now());
    const pct = qrCountdownTotalMs > 0 ? Math.max(0, Math.min(100, (msLeft / qrCountdownTotalMs) * 100)) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = msLeft > 250 ? `New code in ${Math.ceil(msLeft / 1000)}s` : "Refreshing…";
  }

  function startQrRotation() {
    stopQrRotation();
    void refreshTeacherQr();
    qrRefreshTimer = window.setInterval(() => void refreshTeacherQr(), QR_REFRESH_MS);
    qrCountdownTimer = window.setInterval(tickQrCountdown, 200);
  }

  function stopQrRotation() {
    if (qrRefreshTimer) {
      window.clearInterval(qrRefreshTimer);
      qrRefreshTimer = null;
    }
    if (qrCountdownTimer) {
      window.clearInterval(qrCountdownTimer);
      qrCountdownTimer = null;
    }
  }

  function pushScanFeedItem(row) {
    const list = $("teacher-class-scan-feed-list");
    if (!list) return;
    const stu = row.student || {};
    const name = stu.display_name || stu.id_number || "Student";
    const item = document.createElement("div");
    item.className = "class-attendance-scan-feed-item";
    item.innerHTML = `<span class="avatar avatar-sm">${esc(initials(name))}</span>
      <div>
        <strong>${esc(name)}</strong>
        <span class="small-note">Checked in at ${esc(fmtClock(row.record?.time_in))}</span>
      </div>`;
    list.insertBefore(item, list.firstChild); // newest scan on top
    while (list.children.length > 30) list.removeChild(list.lastChild);
  }

  function diffAndAnnouncePresent(present) {
    if (teacherSessionId !== announcedForSessionId) {
      // New (or newly-ended) session — reset so old ids/feed don't bleed in.
      announcedForSessionId = teacherSessionId;
      announcedPresentIds = null;
      const list = $("teacher-class-scan-feed-list");
      if (list) list.innerHTML = "";
    }

    const currentIds = new Set(present.map((row) => row.student?.id_number).filter(Boolean));
    if (announcedPresentIds === null) {
      // First render for this session — seed the baseline without announcing
      // (avoids re-announcing everyone already present on a page refresh).
      announcedPresentIds = currentIds;
      return;
    }
    for (const row of present) {
      const id = row.student?.id_number;
      if (!id || announcedPresentIds.has(id)) continue;
      pushScanFeedItem(row);
      const name = row.student?.display_name || id;
      if (typeof announceVoice === "function") announceVoice(`${name} has been marked present.`);
    }
    announcedPresentIds = currentIds;
  }

  function attendanceRowHtml(row, state) {
    const stu = row.student || {};
    const rec = row.record;
    const name = stu.display_name || stu.id_number || "Student";
    return `<article class="class-attendance-live-row" role="listitem">
      <div class="class-attendance-live-student">
        <span class="avatar avatar-sm">${esc(initials(name))}</span>
        <div>
          <strong>${esc(name)}</strong>
          <span class="small-note">LRN ${esc(stu.id_number || stu.lrn || "—")}</span>
        </div>
      </div>
      <div class="class-attendance-live-meta">
        ${state === "present" ? `<span class="small-note">${esc(fmtClock(rec?.time_in))}</span>` : ""}
      </div>
    </article>`;
  }

  function renderGroup(groupName, rows) {
    const listEl = $(`teacher-class-list-${groupName}`);
    const countEl = $(`teacher-class-group-count-${groupName}`);
    if (countEl) countEl.textContent = String(rows.length);
    if (!listEl) return;
    if (!rows.length) {
      listEl.innerHTML = `<p class="class-attendance-group-empty">Nobody here yet.</p>`;
      return;
    }
    listEl.innerHTML = rows.map((row) => attendanceRowHtml(row, groupName)).join("");
  }

  function renderTeacherLive(data) {
    const session = data?.session;
    const roster = data?.roster || [];
    const statsWrap = $("teacher-class-attendance-stats");
    const badge = $("teacher-class-attendance-status-badge");
    const counts = $("teacher-class-attendance-counts");
    const rosterWrap = $("teacher-class-attendance-roster");
    const startBtn = $("teacher-class-attendance-start-btn");
    const endBtn = $("teacher-class-attendance-end-btn");
    const hint = $("teacher-class-attendance-hint");
    const qrDisplay = $("teacher-class-qr-display");
    const feedWrap = $("teacher-class-scan-feed");

    teacherSessionId = session?.id ? String(session.id) : null;
    const open = session && String(session.status || "").toLowerCase() === "open";

    if (startBtn) {
      startBtn.hidden = open;
      startBtn.disabled = open;
    }
    if (endBtn) {
      endBtn.hidden = !open;
      endBtn.disabled = !open;
    }
    if (statsWrap) statsWrap.hidden = !session;
    if (badge) {
      badge.textContent = open ? "Attendance open" : session ? "Attendance ended" : "—";
    }
    if (counts) {
      const pending = data?.pending_count ?? 0;
      const parts = [
        `${data?.present_count ?? 0} present`,
        pending > 0 ? `${pending} not yet scanned` : null,
        `${data?.absent_count ?? 0} absent`,
        `${data?.enrolled_count ?? 0} enrolled`,
      ].filter(Boolean);
      counts.textContent = parts.join(" · ");
    }

    if (hint) {
      hint.textContent = open
        ? "Show this screen to your class — students scan it with their own camera to check in."
        : session
          ? "Attendance is closed. Students who were not scanned are marked absent. You can open it again anytime."
          : "Open attendance, then show this screen to your class.";
    }

    if (qrDisplay) qrDisplay.hidden = !open;
    if (feedWrap) feedWrap.hidden = !open;
    if (open) startQrRotation();
    else stopQrRotation();

    if (!rosterWrap) return;
    if (!session) {
      rosterWrap.hidden = true;
      return;
    }
    rosterWrap.hidden = false;

    const present = [];
    const pending = [];
    const absent = [];
    for (const row of roster) {
      const state = row.attendance_state || (row.checked_in ? "present" : open ? "pending" : "absent");
      if (state === "present") present.push(row);
      else if (state === "absent") absent.push(row);
      else pending.push(row);
    }
    renderGroup("present", present);
    renderGroup("pending", pending);
    renderGroup("absent", absent);
    diffAndAnnouncePresent(present);

    if (open && !teacherPollTimer) {
      teacherPollTimer = setInterval(() => void refreshTeacherLive(), TEACHER_POLL_MS);
    }
    if (!open) stopTeacherPoll();
  }

  async function refreshTeacherLive() {
    const sid = subjectIdFromUrl();
    const tid = teacherId();
    if (!sid || !tid) return;
    try {
      const res = await fetch(
        apiUrl(
          `/teacher/class-attendance/live?teacher_id_number=${encodeURIComponent(tid)}&subject_id=${encodeURIComponent(sid)}`
        ),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load attendance.");
      renderTeacherLive(data);
    } catch (e) {
      console.warn("class attendance live:", e);
    }
  }

  async function teacherStart() {
    const sid = subjectIdFromUrl();
    const tid = teacherId();
    const res = await fetch(apiUrl("/teacher/class-attendance/start"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ teacher_id_number: tid, subject_id: sid }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not open attendance.");
    if (typeof showToast === "function") showToast("Class attendance opened.", "success");
    await refreshTeacherLive();
  }

  async function teacherEnd() {
    if (!teacherSessionId) return;
    const ok =
      window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function"
        ? await window.LearnIQConfirm.show({
            title: "End attendance?",
            message: "Students who were not scanned will be marked absent.",
            confirmText: "End",
            variant: "danger",
          })
        : window.confirm("End attendance?");
    if (!ok) return;
    const tid = teacherId();
    const res = await fetch(apiUrl("/teacher/class-attendance/end"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ teacher_id_number: tid, session_id: teacherSessionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not end attendance.");
    if (typeof showToast === "function") showToast("Class attendance ended.", "success");
    stopTeacherPoll();
    stopQrRotation();
    await refreshTeacherLive();
  }

  function initTeacher() {
    if (!document.body.classList.contains("teacher-subject-lessons-page")) return;
    if (!subjectIdFromUrl()) return;
    $("teacher-class-attendance-start-btn")?.addEventListener("click", () => {
      teacherStart().catch((e) => {
        if (typeof showToast === "function") showToast(e.message, "error");
        else alert(e.message);
      });
    });
    $("teacher-class-attendance-end-btn")?.addEventListener("click", () => {
      teacherEnd().catch((e) => {
        if (typeof showToast === "function") showToast(e.message, "error");
        else alert(e.message);
      });
    });
    window.addEventListener("beforeunload", stopQrRotation);
    void refreshTeacherLive();
  }

  // ── Student (my-lesson.html): camera scans the teacher's QR ────────────

  let studentPollTimer = null;
  let studentSubjectId = null;
  let studentScannerStream = null;
  let studentScannerRafId = null;
  let studentLastScan = { code: "", at: 0 };
  let studentScanInFlight = false;

  function stopStudentPoll() {
    if (studentPollTimer) {
      clearInterval(studentPollTimer);
      studentPollTimer = null;
    }
  }

  function setStudentScannerStatus(text, kind) {
    const el = $("student-class-scanner-status");
    if (!el) return;
    el.classList.remove("is-success", "is-error");
    if (kind) el.classList.add(kind === "success" ? "is-success" : "is-error");
    el.innerHTML = `<i class="fa-solid ${kind === "success" ? "fa-circle-check" : kind === "error" ? "fa-triangle-exclamation" : "fa-camera"}" aria-hidden="true"></i> ${esc(text)}`;
  }

  function flashStudentScanner() {
    const el = $("student-class-scanner-flash");
    if (!el) return;
    el.hidden = false;
    window.setTimeout(() => {
      el.hidden = true;
    }, FLASH_MS);
  }

  async function openStudentScanner() {
    const wrap = $("student-class-scanner");
    const video = $("student-class-scanner-video");
    const toggleWrap = $("student-class-scan-toggle-wrap");
    if (!wrap || !video || typeof jsQR !== "function") {
      if (typeof jsQR !== "function") {
        setStudentScannerStatus("QR scanner library did not load. Check your internet connection.", "error");
      }
      return;
    }
    wrap.hidden = false;
    if (toggleWrap) toggleWrap.hidden = true;
    try {
      studentScannerStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      video.srcObject = studentScannerStream;
      await video.play();
      setStudentScannerStatus("Point your camera at your teacher's QR code.");
      studentScanLoop();
    } catch (e) {
      setStudentScannerStatus("Could not open the camera. Allow camera access and try again.", "error");
    }
  }

  function closeStudentScanner() {
    if (studentScannerRafId) {
      cancelAnimationFrame(studentScannerRafId);
      studentScannerRafId = null;
    }
    if (studentScannerStream) {
      studentScannerStream.getTracks().forEach((t) => t.stop());
      studentScannerStream = null;
    }
    const video = $("student-class-scanner-video");
    if (video) video.srcObject = null;
    const wrap = $("student-class-scanner");
    if (wrap) wrap.hidden = true;
    const toggleWrap = $("student-class-scan-toggle-wrap");
    if (toggleWrap) toggleWrap.hidden = false;
  }

  function studentScanLoop() {
    const video = $("student-class-scanner-video");
    const canvas = $("student-class-scanner-canvas");
    if (!video || !canvas || !studentScannerStream) return;
    studentScannerRafId = requestAnimationFrame(studentScanLoop);
    if (video.readyState !== video.HAVE_ENOUGH_DATA || studentScanInFlight) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (!result || !result.data) return;

    const code = result.data.trim();
    if (!code) return;
    const now = Date.now();
    if (code === studentLastScan.code && now - studentLastScan.at < SCAN_REPEAT_COOLDOWN_MS) return;
    studentLastScan = { code, at: now };
    void handleStudentScan(code);
  }

  async function handleStudentScan(scannedCode) {
    studentScanInFlight = true;
    setStudentScannerStatus("Checking…");
    try {
      const res = await fetch(apiUrl("/student/class-attendance/qr-checkin"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ scanned_code: scannedCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not check in.");
      flashStudentScanner();
      setStudentScannerStatus("Checked in!", "success");
      if (typeof showToast === "function") showToast("You're marked present.", "success");
      if (typeof announceVoice === "function") announceVoice("You have been marked present.");
      window.setTimeout(() => {
        closeStudentScanner();
        void refreshStudentStatus();
      }, 900);
    } catch (e) {
      setStudentScannerStatus(e.message || "That QR code could not be checked in.", "error");
    } finally {
      studentScanInFlight = false;
      window.setTimeout(() => {
        if (studentScannerStream) setStudentScannerStatus("Point your camera at your teacher's QR code.");
      }, 2200);
    }
  }

  function renderStudentStatus(data) {
    const card = $("student-class-attendance-card");
    const sub = $("student-class-attendance-subtitle");
    const statusEl = $("student-class-attendance-status");
    const toggleWrap = $("student-class-scan-toggle-wrap");
    const submittedPanel = $("student-class-attendance-submitted");
    const submittedTimeEl = $("student-class-submitted-time");

    if (!card) return;
    if (!data?.enrolled) {
      card.hidden = true;
      stopStudentPoll();
      closeStudentScanner();
      return;
    }

    card.hidden = false;
    const open = data.session_open;
    const done = data.already_checked_in;
    const absent = data.marked_absent;
    const rec = data.record;

    card.classList.toggle("is-absent", Boolean(absent));
    card.classList.toggle("is-submitted", Boolean(done));

    if (done || absent || !open) closeStudentScanner();

    if (done) {
      if (toggleWrap) toggleWrap.hidden = true;
      if (submittedPanel) submittedPanel.hidden = false;
      if (submittedTimeEl) {
        submittedTimeEl.textContent = `Checked in at ${fmtSubmittedTime(rec?.time_in)}`;
      }
      if (sub) sub.textContent = "Your attendance for this class is on record.";
      if (statusEl) statusEl.textContent = "";
    } else {
      if (submittedPanel) submittedPanel.hidden = true;
      if (sub) {
        sub.textContent = absent
          ? "Attendance is closed. You were marked absent because you did not scan in time."
          : open
            ? "Class attendance is open. Scan your teacher's QR code to check in."
            : "Your teacher has not opened attendance yet.";
      }
      if (statusEl) {
        statusEl.textContent = absent
          ? "You can no longer check in for this session."
          : open
            ? "Tap the button below, then point your camera at your teacher's screen."
            : "The scan button will appear here once attendance opens.";
      }
      if (toggleWrap) toggleWrap.hidden = !open;
    }

    if (data.enrolled && !done) {
      if (!studentPollTimer) {
        studentPollTimer = setInterval(() => void refreshStudentStatus(), TEACHER_POLL_MS);
      }
    } else {
      stopStudentPoll();
    }
  }

  async function refreshStudentStatus() {
    const sid = studentSubjectId || subjectIdFromUrl();
    if (!sid) return;
    try {
      const res = await fetch(
        apiUrl(`/student/class-attendance/status?subject_id=${encodeURIComponent(sid)}`),
        { headers: authHeaders() }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load attendance status.");
      renderStudentStatus(data);
    } catch (e) {
      console.warn("student class attendance:", e);
      const statusEl = $("student-class-attendance-status");
      if (statusEl) {
        statusEl.textContent =
          "Could not load attendance status. Refresh the page or sign in again.";
      }
    }
  }

  function initStudent() {
    if (!document.body.classList.contains("my-lesson-page")) return;
    studentSubjectId = subjectIdFromUrl();
    if (!studentSubjectId) return;
    $("student-class-scan-toggle-btn")?.addEventListener("click", () => {
      void openStudentScanner();
    });
    $("student-class-scanner-cancel-btn")?.addEventListener("click", () => {
      closeStudentScanner();
    });
    window.addEventListener("beforeunload", closeStudentScanner);
    void refreshStudentStatus();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void refreshStudentStatus();
    });
  }

  window.refreshStudentClassAttendance = refreshStudentStatus;

  function init() {
    initTeacher();
    initStudent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
