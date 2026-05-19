// Class attendance — teacher subject page + student my-lesson (photo check-in, live roster)

(function () {
  const TEACHER_POLL_MS = 3000;
  const STUDENT_POLL_MS = 3000;

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

  function locationVerifiedBadgeHtml(verified) {
    if (verified === true) {
      return '<span class="badge badge-soft class-attendance-loc-badge"><i class="fa-solid fa-location-dot"></i> Location verified</span>';
    }
    if (verified === false) {
      return '<span class="badge class-attendance-loc-badge class-attendance-loc-badge--warn"><i class="fa-solid fa-triangle-exclamation"></i> Location unverified</span>';
    }
    return "";
  }

  function applyStudentLocationBadge(rec) {
    const el = $("student-class-location-verified-badge");
    if (!el) return;
    const v = rec?.location_verified;
    if (v === true) {
      el.className = "badge badge-soft class-attendance-loc-badge";
      el.innerHTML = '<i class="fa-solid fa-location-dot"></i> Location verified';
      el.hidden = false;
    } else if (v === false) {
      el.className = "badge class-attendance-loc-badge class-attendance-loc-badge--warn";
      el.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Location unverified (still present)';
      el.hidden = false;
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function getCurrentPositionForTeacher() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    });
  }

  async function reverseGeocodeSimple(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return "";
      const data = await res.json();
      return (data.display_name || "").trim();
    } catch {
      return "";
    }
  }

  function initials(name) {
    return String(name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "??";
  }

  // ── Teacher (teacher-subject-lessons.html) ─────────────────────────────

  let teacherPollTimer = null;
  let teacherSessionId = null;

  function stopTeacherPoll() {
    if (teacherPollTimer) {
      clearInterval(teacherPollTimer);
      teacherPollTimer = null;
    }
  }

  function renderTeacherLive(data) {
    const session = data?.session;
    const roster = data?.roster || [];
    const statsWrap = $("teacher-class-attendance-stats");
    const badge = $("teacher-class-attendance-status-badge");
    const counts = $("teacher-class-attendance-counts");
    const list = $("teacher-class-attendance-live-list");
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
        pending > 0 ? `${pending} pending` : null,
        `${data?.absent_count ?? 0} absent`,
        `${data?.enrolled_count ?? 0} enrolled`,
      ].filter(Boolean);
      counts.textContent = parts.join(" · ");
    }
    const locNote = $("teacher-class-attendance-location");
    const geoNote = $("teacher-class-attendance-geofence");
    if (locNote) {
      const tLoc = session?.teacher_start_location_name;
      if (tLoc) {
        locNote.textContent = `You started from: ${tLoc} (reference only — does not auto-mark students).`;
        locNote.hidden = false;
      } else if (open) {
        locNote.textContent =
          "Allow location when starting to set the class area for location-verified badges.";
        locNote.hidden = false;
      } else {
        locNote.hidden = true;
      }
    }
    if (geoNote) {
      const gf = data?.geofence;
      if (gf?.label) {
        geoNote.textContent = `Class area: ${gf.label} (within ${gf.radius_m ?? 150} m for “Location verified”).`;
        geoNote.hidden = false;
      } else {
        geoNote.hidden = true;
      }
    }

    if (hint) {
      hint.textContent = open
        ? "Photo submit = Present. Location match shows a verified badge only."
        : session
          ? "Attendance is closed. Students who did not submit are marked absent. You can start again anytime."
          : "Start attendance so enrolled students can submit with a photo inside this subject.";
    }

    if (!list) return;
    if (!session) {
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    list.hidden = false;
    list.innerHTML = roster
      .map((row) => {
        const stu = row.student || {};
        const rec = row.record;
        const name = stu.display_name || stu.id_number || "Student";
        const state = row.attendance_state || (row.checked_in ? "present" : open ? "pending" : "absent");
        const label =
          state === "present" ? "Present" : state === "pending" ? "Pending" : "Absent";
        const photo = rec?.photo_url || rec?.time_in_photo_url || "";
        const locBadge =
          state === "present" ? locationVerifiedBadgeHtml(rec?.location_verified) : "";
        return `<article class="class-attendance-live-row" role="listitem">
          <div class="class-attendance-live-student">
            <span class="avatar avatar-sm">${esc(initials(name))}</span>
            <div>
              <strong>${esc(name)}</strong>
              <span class="small-note">LRN ${esc(stu.id_number || stu.lrn || "—")}</span>
            </div>
          </div>
          <div class="class-attendance-live-meta">
            <span class="badge ${state === "present" ? "badge-soft" : ""}">${esc(label)}</span>
            ${locBadge}
            ${state === "present" ? `<span class="small-note">${esc(fmtClock(rec?.time_in))}</span>` : ""}
            ${photo ? `<img class="class-attendance-live-thumb" src="${esc(photo)}" alt="Check-in photo" loading="lazy" />` : ""}
          </div>
        </article>`;
      })
      .join("");

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
    const body = { teacher_id_number: tid, subject_id: sid };
    if (typeof showToast === "function") {
      showToast("Getting your location for class area…", "info");
    }
    const pos = await getCurrentPositionForTeacher();
    if (pos) {
      body.teacher_latitude = pos.latitude;
      body.teacher_longitude = pos.longitude;
      const name = await reverseGeocodeSimple(pos.latitude, pos.longitude);
      if (name) body.teacher_start_location_name = name;
    }
    const res = await fetch(apiUrl("/teacher/class-attendance/start"), {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not start attendance.");
    if (typeof showToast === "function") showToast("Class attendance started.", "success");
    await refreshTeacherLive();
  }

  async function teacherEnd() {
    if (!teacherSessionId) return;
    const ok =
      typeof showConfirmDialog === "function"
        ? await showConfirmDialog({
            title: "End attendance?",
            message: "Students will no longer be able to check in.",
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
    void refreshTeacherLive();
  }

  // ── Student (my-lesson.html) ───────────────────────────────────────────

  let studentPollTimer = null;
  let studentCapture = null;
  let studentSubjectId = null;

  function stopStudentPoll() {
    if (studentPollTimer) {
      clearInterval(studentPollTimer);
      studentPollTimer = null;
    }
  }

  function syncStudentCheckInBtn(ready) {
    const btn = $("student-class-check-in-btn");
    if (!btn || btn.hidden) return;
    const active = studentCapture?.isReady?.() ? ready : false;
    btn.disabled = !active;
    btn.classList.toggle("is-locked", !ready);
    btn.classList.toggle("btn-primary", ready);
    btn.classList.toggle("btn-secondary", !ready);
  }

  function fmtSubmittedTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return fmtClock(iso);
    }
  }

  function fillStudentCaptureFields(rec) {
    const locEl = $("student-class-field-location");
    const timeEl = $("student-class-field-time");
    const fields = $("student-class-capture-fields");
    if (locEl) locEl.textContent = rec?.readable_location_name || "—";
    if (timeEl) {
      timeEl.textContent = fmtSubmittedTime(rec?.time_in || rec?.capture_timestamp);
    }
    if (fields) fields.hidden = false;
  }

  function clearStudentCaptureFields() {
    const locEl = $("student-class-field-location");
    const timeEl = $("student-class-field-time");
    if (locEl) locEl.textContent = "—";
    if (timeEl) timeEl.textContent = "—";
  }

  function renderStudentSubmittedView(rec) {
    const panel = $("student-class-attendance-submitted");
    const photoEl = $("student-class-submitted-photo");
    if (!panel) return;
    panel.hidden = false;
    fillStudentCaptureFields(rec);
    const photo = rec?.photo_url || rec?.time_in_photo_url || "";
    if (photoEl) {
      if (photo) {
        photoEl.src = photo;
        photoEl.hidden = false;
      } else {
        photoEl.removeAttribute("src");
        photoEl.hidden = true;
      }
    }
    applyStudentLocationBadge(rec);
  }

  function hideStudentSubmittedView() {
    const panel = $("student-class-attendance-submitted");
    const photoEl = $("student-class-submitted-photo");
    if (panel) panel.hidden = true;
    if (photoEl) {
      photoEl.removeAttribute("src");
      photoEl.hidden = true;
    }
    const locBadge = $("student-class-location-verified-badge");
    if (locBadge) locBadge.hidden = true;
    clearStudentCaptureFields();
    const fields = $("student-class-capture-fields");
    if (fields) fields.hidden = true;
  }

  function renderStudentStatus(data) {
    const card = $("student-class-attendance-card");
    const sub = $("student-class-attendance-subtitle");
    const statusEl = $("student-class-attendance-status");
    const captureStatus = $("student-class-capture-status");
    const actions = $("student-class-attendance-actions");
    const takeBtn = $("student-class-take-photo-btn");
    const fields = $("student-class-capture-fields");
    const previewPanel = $("student-class-preview-panel");

    if (!card) return;
    if (!data?.enrolled) {
      card.hidden = true;
      if (actions) actions.hidden = true;
      hideStudentSubmittedView();
      stopStudentPoll();
      return;
    }

    card.hidden = false;
    const open = data.session_open;
    const done = data.already_checked_in;
    const absent = data.marked_absent;
    const rec = data.record;
    const showForm = !done && !absent;
    const canSubmit = open && showForm;

    card.classList.toggle("is-absent", Boolean(absent));
    card.classList.toggle("is-submitted", Boolean(done));

    if (done) {
      if (rec) renderStudentSubmittedView(rec);
      else {
        const panel = $("student-class-attendance-submitted");
        if (panel) panel.hidden = false;
      }
      if (sub) sub.textContent = "Your attendance for this class is on record.";
      if (statusEl) statusEl.textContent = "";
      if (captureStatus) captureStatus.hidden = true;
      if (actions) actions.hidden = true;
      if (previewPanel) previewPanel.hidden = true;
      studentCapture?.revokePreview?.();
      studentCapture?.setCaptureActive?.(false, { clearFieldsOnDeactivate: false });
      if (rec) fillStudentCaptureFields(rec);
    } else {
      hideStudentSubmittedView();
      if (sub) {
        sub.textContent = absent
          ? "Attendance is closed. You were marked absent because you did not submit."
          : open
            ? "Class attendance is open. Take a photo, then submit attendance."
            : "Waiting for your teacher to start attendance.";
      }
      if (statusEl) {
        statusEl.textContent = absent
          ? "You can no longer submit for this session."
          : open
            ? data?.geofence
              ? "Photo is required. Submit inside the class area for a location verified badge."
              : "Photo is required. Take a photo, then tap Submit attendance."
            : showForm
              ? "Submit attendance will unlock when your teacher starts class attendance for this subject."
              : "";
      }
      if (captureStatus) captureStatus.hidden = !canSubmit;
      if (actions) actions.hidden = !showForm;
      if (fields) fields.hidden = !canSubmit;
      if (takeBtn) takeBtn.disabled = !canSubmit;
      studentCapture?.setCaptureActive?.(canSubmit);
      if (absent) {
        studentCapture?.revokePreview?.();
        studentCapture?.resetCapture?.();
      }
    }

    if (data.enrolled && !done) {
      if (!studentPollTimer) {
        studentPollTimer = setInterval(() => void refreshStudentStatus(), STUDENT_POLL_MS);
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
      if (typeof showToast === "function") {
        showToast(e.message || "Could not load attendance status.", "error");
      }
    }
  }

  async function studentCheckIn() {
    const fd = studentCapture?.buildFormData?.();
    if (!fd) {
      if (typeof showToast === "function") showToast("Take a photo first.", "error");
      return;
    }
    const sid = studentSubjectId || subjectIdFromUrl();
    fd.append("subject_id", sid);
    const res = await fetch(apiUrl("/student/class-attendance/check-in"), {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Check-in failed.");
    studentCapture?.revokePreview?.();
    renderStudentStatus({
      enrolled: true,
      session_open: true,
      session_closed: false,
      already_checked_in: true,
      marked_absent: false,
      record: data.record,
    });
    const verified = data.record?.location_verified;
    let msg = "Attendance submitted.";
    if (verified === true) msg = "Attendance submitted. Location verified.";
    else if (verified === false) {
      msg = "Attendance submitted. Location unverified — you are still marked present.";
    }
    if (typeof showToast === "function") showToast(msg, verified === false ? "info" : "success");
    await refreshStudentStatus();
  }

  function initStudent() {
    if (!document.body.classList.contains("my-lesson-page")) return;
    studentSubjectId = subjectIdFromUrl();
    if (!studentSubjectId) return;

    if (typeof window.createImmersionCaptureController === "function") {
      studentCapture = window.createImmersionCaptureController({
        initialMode: "class_attendance",
        takePhotoBtn: $("student-class-take-photo-btn"),
        shutterBtn: $("student-class-camera-shutter"),
        cancelCameraBtn: $("student-class-camera-cancel"),
        cameraPanel: $("student-class-camera-panel"),
        videoEl: $("student-class-camera-video"),
        canvasEl: $("student-class-camera-canvas"),
        previewPanel: $("student-class-preview-panel"),
        previewImg: $("student-class-preview-img"),
        previewBadgeEl: $("student-class-preview-badge"),
        fieldLocation: $("student-class-field-location"),
        fieldTimeLabel: null,
        fieldTime: $("student-class-field-time"),
        fieldCoords: null,
        captureStatusEl: $("student-class-capture-status"),
        timeInBtn: $("student-class-check-in-btn"),
        timeOutBtn: null,
        onReadyChange: (ready) => syncStudentCheckInBtn(ready),
      });
      studentCapture?.setCaptureActive?.(false, { clearFieldsOnDeactivate: true });
    }

    $("student-class-check-in-btn")?.addEventListener("click", () => {
      studentCheckIn().catch((e) => {
        if (typeof showToast === "function") showToast(e.message, "error");
        else alert(e.message);
      });
    });

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
