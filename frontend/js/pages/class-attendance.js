// Class attendance — teacher subject page (QR camera scanner) + student
// my-lesson (shows their own QR code). Presence in front of the teacher's
// camera at scan time is the proof — no photo/GPS step for students.

(function () {
  const TEACHER_POLL_MS = 4000;
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

  function studentId() {
    return typeof getStudentIdNumberForApi === "function" ? getStudentIdNumberForApi() : "";
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

  // ── Teacher (teacher-subject-lessons.html) ─────────────────────────────

  let teacherPollTimer = null;
  let teacherSessionId = null;
  let scannerStream = null;
  let scannerRafId = null;
  let lastScan = { code: "", at: 0 };
  let scanInFlight = false;

  function stopTeacherPoll() {
    if (teacherPollTimer) {
      clearInterval(teacherPollTimer);
      teacherPollTimer = null;
    }
  }

  function setScannerStatus(text, kind) {
    const el = $("teacher-class-scanner-status");
    if (!el) return;
    el.classList.remove("is-success", "is-error");
    if (kind) el.classList.add(kind === "success" ? "is-success" : "is-error");
    el.innerHTML = `<i class="fa-solid ${kind === "success" ? "fa-circle-check" : kind === "error" ? "fa-triangle-exclamation" : "fa-camera"}" aria-hidden="true"></i> ${esc(text)}`;
  }

  function flashScanner() {
    const el = $("teacher-class-scanner-flash");
    if (!el) return;
    el.hidden = false;
    window.setTimeout(() => {
      el.hidden = true;
    }, FLASH_MS);
  }

  async function startScanner() {
    const wrap = $("teacher-class-scanner");
    const video = $("teacher-class-scanner-video");
    if (!wrap || !video || typeof jsQR !== "function") {
      if (typeof jsQR !== "function") {
        setScannerStatus("QR scanner library did not load. Check your internet connection.", "error");
      }
      return;
    }
    wrap.hidden = false;
    try {
      scannerStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      video.srcObject = scannerStream;
      await video.play();
      setScannerStatus("Point the camera at a student's QR code.");
      scanLoop();
    } catch (e) {
      setScannerStatus("Could not open the camera. Allow camera access and try again.", "error");
    }
  }

  function stopScanner() {
    if (scannerRafId) {
      cancelAnimationFrame(scannerRafId);
      scannerRafId = null;
    }
    if (scannerStream) {
      scannerStream.getTracks().forEach((t) => t.stop());
      scannerStream = null;
    }
    const video = $("teacher-class-scanner-video");
    if (video) video.srcObject = null;
    const wrap = $("teacher-class-scanner");
    if (wrap) wrap.hidden = true;
  }

  function scanLoop() {
    const video = $("teacher-class-scanner-video");
    const canvas = $("teacher-class-scanner-canvas");
    if (!video || !canvas || !scannerStream) return;
    scannerRafId = requestAnimationFrame(scanLoop);
    if (video.readyState !== video.HAVE_ENOUGH_DATA || scanInFlight) return;

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
    if (code === lastScan.code && now - lastScan.at < SCAN_REPEAT_COOLDOWN_MS) return;
    lastScan = { code, at: now };
    void handleScan(code);
  }

  async function handleScan(scannedIdNumber) {
    scanInFlight = true;
    const sid = subjectIdFromUrl();
    const tid = teacherId();
    setScannerStatus(`Checking ${scannedIdNumber}…`);
    try {
      const res = await fetch(apiUrl("/teacher/class-attendance/scan"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          teacher_id_number: tid,
          subject_id: sid,
          scanned_id_number: scannedIdNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not mark attendance.");
      flashScanner();
      setScannerStatus(`${data.student_name || scannedIdNumber} marked present.`, "success");
      if (typeof showToast === "function") {
        showToast(`${data.student_name || scannedIdNumber} marked present.`, "success");
      }
      await refreshTeacherLive();
    } catch (e) {
      setScannerStatus(e.message || "That QR code could not be checked in.", "error");
    } finally {
      scanInFlight = false;
      window.setTimeout(() => {
        if (scannerStream) setScannerStatus("Point the camera at a student's QR code.");
      }, 2200);
    }
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
        ? "Scan each student's QR code with the camera below."
        : session
          ? "Attendance is closed. Students who were not scanned are marked absent. You can open it again anytime."
          : "Open attendance, then scan each student's QR code with your camera.";
    }

    if (open) startScanner();
    else stopScanner();

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
      typeof showConfirmDialog === "function"
        ? await showConfirmDialog({
            title: "End attendance?",
            message: "Students who were not scanned will be marked absent.",
            confirmLabel: "End",
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
    stopScanner();
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
    window.addEventListener("beforeunload", stopScanner);
    void refreshTeacherLive();
  }

  // ── Student (my-lesson.html) ───────────────────────────────────────────

  let studentPollTimer = null;
  let studentSubjectId = null;
  let studentQrRendered = false;

  function stopStudentPoll() {
    if (studentPollTimer) {
      clearInterval(studentPollTimer);
      studentPollTimer = null;
    }
  }

  function renderStudentQr() {
    if (studentQrRendered) return;
    const canvas = $("student-class-qr-canvas");
    const id = studentId();
    if (!canvas || !id || typeof QRCode === "undefined") return;
    QRCode.toCanvas(canvas, id, { width: 200, margin: 1 }, (err) => {
      if (!err) studentQrRendered = true;
    });
  }

  function renderStudentStatus(data) {
    const card = $("student-class-attendance-card");
    const sub = $("student-class-attendance-subtitle");
    const statusEl = $("student-class-attendance-status");
    const qrPanel = $("student-class-qr-panel");
    const submittedPanel = $("student-class-attendance-submitted");
    const submittedTimeEl = $("student-class-submitted-time");

    if (!card) return;
    if (!data?.enrolled) {
      card.hidden = true;
      stopStudentPoll();
      return;
    }

    card.hidden = false;
    const open = data.session_open;
    const done = data.already_checked_in;
    const absent = data.marked_absent;
    const rec = data.record;

    card.classList.toggle("is-absent", Boolean(absent));
    card.classList.toggle("is-submitted", Boolean(done));

    if (done) {
      if (qrPanel) qrPanel.hidden = true;
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
          ? "Attendance is closed. You were marked absent because you were not scanned."
          : open
            ? "Class attendance is open. Show your QR code to your teacher."
            : "Your teacher has not opened attendance yet.";
      }
      if (statusEl) {
        statusEl.textContent = absent
          ? "You can no longer check in for this session."
          : open
            ? "Hold your screen up to your teacher's camera."
            : "The QR code below will appear here once attendance opens.";
      }
      if (qrPanel) {
        qrPanel.hidden = !open;
        if (open) renderStudentQr();
      }
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
