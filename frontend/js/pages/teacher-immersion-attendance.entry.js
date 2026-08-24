// Teacher Immersion Attendance — strand → Grade 12 students → detail

(function () {
  const STRAND_META = {
    STEM: { icon: "fa-atom", color: "#ca8a04", blurb: "Science, Technology, Engineering & Mathematics" },
    ABM: { icon: "fa-chart-line", color: "#b45309", blurb: "Accountancy, Business & Management" },
    HUMSS: { icon: "fa-book-open", color: "#a16207", blurb: "Humanities & Social Sciences" },
    "TVL-HE": { icon: "fa-screwdriver-wrench", color: "#92400e", blurb: "Technical-Vocational-Livelihood" },
    __unassigned__: { icon: "fa-circle-question", color: "#78716c", blurb: "No strand on profile" },
  };

  const STATE = {
    view: "list", // "list" (tabs + student list) or "detail" (one student's full record)
    strands: [],
    selectedStrand: null,
    selectedStrandLabel: null,
    students: [],
    activeStudentIdNumber: null,
    overview: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function getTeacherIdNumber() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    return u && u.id_number ? String(u.id_number).trim() : "";
  }

  function authHeaders() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const h = {};
    if (u && u.access_token) h.Authorization = `Bearer ${u.access_token}`;
    return h;
  }

  function initials(name) {
    const s = String(name || "").trim();
    if (!s) return "??";
    return s
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "??";
  }

  function strandCountG12(row) {
    return Number(row?.grade_12_count) || 0;
  }

  function photoSrc(url) {
    if (!url) return "";
    const u = String(url);
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
    let full = typeof apiUrl === "function" ? apiUrl(u) : u;
    if (u.includes("/teacher/immersion/attendance-photo")) {
      const sess = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
      if (sess && sess.access_token) {
        full += `${full.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(sess.access_token)}`;
      }
    }
    return full;
  }

  function escAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function photoThumbBlock(url, label) {
    const src = photoSrc(url);
    if (!src) return "";
    return `<div class="immersion-today-photo-item">
      <span class="small-note">${escapeHtml(label)}</span>
      <button type="button" class="immersion-detail-photo-thumb immersion-see-photo-btn" data-photo-src="${escAttr(src)}" data-photo-label="${escapeHtml(label)}" aria-label="View ${escapeHtml(label)} photo">
        <img src="${escAttr(src)}" alt="${escapeHtml(label)} verification" loading="lazy" />
      </button>
    </div>`;
  }

  function workStatusLabel(bundle) {
    if (!bundle) return { text: "—", cls: "" };
    if (bundle.is_at_work || bundle.today_status === "at_work") {
      return { text: "At work now", cls: "active" };
    }
    if (bundle.today_status === "completed") {
      return { text: "Completed today", cls: "completed" };
    }
    if (bundle.today_status === "clocked_in") {
      return { text: "Clocked in", cls: "warning" };
    }
    return { text: "Not at work", cls: "" };
  }

  // At-a-glance badge for the student list row (Strand tab view) — lets a
  // teacher see who's currently at work without opening each student.
  function immersionStatusBadge(s) {
    const status = s.today_status;
    const pct = Number(s.percent_complete) || 0;
    const hours = Number(s.total_hours_rendered) || 0;
    const label =
      status === "at_work" ? "At work now" : status === "completed" ? "Here today" : `${pct}% of 600h`;
    const cls = status === "at_work" ? "active" : status === "completed" ? "completed" : "";
    const title = `${hours}h of 600h required (${pct}%)`;
    return `<span class="status-badge immersion-row-badge ${cls}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
  }

  function showListView() {
    STATE.view = "list";
    STATE.activeStudentIdNumber = null;
    STATE.overview = null;
    $("immersion-picker")?.removeAttribute("hidden");
    $("immersion-detail-toolbar")?.setAttribute("hidden", "");
    $("immersion-detail-sheet")?.setAttribute("hidden", "");
  }

  function showDetailView() {
    STATE.view = "detail";
    $("immersion-picker")?.setAttribute("hidden", "");
    $("immersion-detail-toolbar")?.removeAttribute("hidden");
    $("immersion-detail-sheet")?.removeAttribute("hidden");
  }

  function renderStrandTabs() {
    const nav = $("immersion-strand-tabs");
    if (!nav) return;
    const rows = STATE.strands.filter((row) => {
      const code = row.strand || "";
      if (code === "__unassigned__") return strandCountG12(row) > 0;
      return true;
    });
    if (!rows.length) {
      nav.innerHTML = "";
      return;
    }
    nav.innerHTML = rows
      .map((row) => {
        const code = row.strand || "";
        const label = row.label || code;
        const count = strandCountG12(row);
        const isActive = code === STATE.selectedStrand;
        return `
          <button
            type="button"
            class="subject-class-tab${isActive ? " is-active" : ""}"
            role="tab"
            aria-selected="${isActive ? "true" : "false"}"
            data-strand="${escapeHtml(code)}"
            data-label="${escapeHtml(label)}">
            ${escapeHtml(label)}<span class="subject-class-tab-count">${count}</span>
          </button>`;
      })
      .join("");
    nav.querySelectorAll(".subject-class-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectStrand(btn.getAttribute("data-strand"), btn.getAttribute("data-label"));
      });
    });
  }

  async function loadStrands() {
    const nav = $("immersion-strand-tabs");
    const list = $("immersion-student-list");
    const tid = getTeacherIdNumber();
    if (!tid) {
      if (list) list.innerHTML = `<p class="empty-state">Sign in as a teacher to continue.</p>`;
      return;
    }
    if (list) list.innerHTML = `<p class="small-note">Loading strands…</p>`;
    try {
      const params = new URLSearchParams({ teacher_id_number: tid });
      const res = await fetch(apiUrl(`/teacher/immersion/strands?${params}`), {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.strands = Array.isArray(data.strands) ? data.strands : [];
      const rows = STATE.strands.filter((row) => {
        const code = row.strand || "";
        if (code === "__unassigned__") return strandCountG12(row) > 0;
        return true;
      });
      if (!rows.length) {
        renderStrandTabs();
        if (list) {
          list.innerHTML = `<p class="empty-state">No Grade 12 students enrolled in your subjects yet.</p>`;
        }
        return;
      }
      // Default to the first strand that actually has students, else just the first tab.
      const preferred = rows.find((r) => strandCountG12(r) > 0) || rows[0];
      await selectStrand(preferred.strand, preferred.label || preferred.strand);
    } catch (err) {
      console.error("loadStrands:", err);
      if (nav) nav.innerHTML = "";
      if (list) {
        list.innerHTML = `<p class="empty-state">Could not load strands: ${escapeHtml(err.message)}</p>`;
      }
      if (typeof showToast === "function") showToast(err.message || "Load failed.", "error");
    }
  }

  async function selectStrand(strand, label) {
    STATE.selectedStrand = strand;
    STATE.selectedStrandLabel = label || strand;
    const filter = $("immersion-student-filter");
    if (filter) filter.value = "";
    renderStrandTabs();
    showListView();
    await loadStudents();
  }

  async function loadStudents(filterText) {
    const list = $("immersion-student-list");
    if (!list || !STATE.selectedStrand) return;
    const tid = getTeacherIdNumber();
    if (!tid) return;
    list.innerHTML = `<p class="small-note">Loading students…</p>`;
    try {
      const params = new URLSearchParams({
        teacher_id_number: tid,
        strand: STATE.selectedStrand,
      });
      const q = (filterText || "").trim();
      if (q) params.set("q", q);
      const res = await fetch(apiUrl(`/teacher/immersion/students?${params}`), {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.students = Array.isArray(data.students) ? data.students : [];
      if (!STATE.students.length) {
        list.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-user-group"></i>
            <p>No Grade 12 students in this strand enrolled in your subjects yet.</p>
          </div>`;
        return;
      }
      list.innerHTML = STATE.students
        .map((s) => {
          const idn = escapeHtml(s.id_number || "");
          const name = escapeHtml(s.display_name || s.id_number || "Student");
          const meta = [s.section ? `Section ${s.section}` : null].filter(Boolean).join(" · ");
          return `
            <button type="button" class="gradecard-student-row" role="listitem" data-id-number="${idn}">
              <span class="gradecard-student-row-avatar">${escapeHtml(initials(s.display_name || idn))}</span>
              <span class="gradecard-student-row-text">
                <strong>${name}</strong>
                <span class="small-note">ID ${idn}${meta ? ` · ${escapeHtml(meta)}` : ""} · Grade 12</span>
              </span>
              ${immersionStatusBadge(s)}
              <i class="fa-solid fa-chevron-right gradecard-student-row-chevron" aria-hidden="true"></i>
            </button>`;
        })
        .join("");
      list.querySelectorAll(".gradecard-student-row").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sid = btn.getAttribute("data-id-number");
          if (sid) openStudentDetail(sid);
        });
      });
    } catch (err) {
      console.error("loadStudents:", err);
      list.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
      if (typeof showToast === "function") showToast(err.message || "Load failed.", "error");
    }
  }

  function renderOverview(bundle) {
    const student = bundle.student || {};
    const name = student.display_name || student.id_number || "Student";
    $("immersion-detail-name").textContent = name;
    $("immersion-detail-avatar").textContent = initials(name);
    const metaParts = [
      student.id_number ? `ID ${student.id_number}` : null,
      student.strand || null,
      student.section ? `Section ${student.section}` : null,
      "Grade 12",
    ].filter(Boolean);
    $("immersion-detail-meta").textContent = metaParts.join(" · ");

    const ws = workStatusLabel(bundle);
    const badge = $("immersion-work-status-badge");
    if (badge) {
      badge.textContent = ws.text;
      badge.className = `status-badge ${ws.cls}`.trim();
    }

    const todayH = Number(bundle.today_hours) || 0;
    $("immersion-stat-today-hours").textContent = `${todayH.toFixed(2)}h`;
    $("immersion-stat-today-note").textContent = bundle.is_at_work
      ? "Still clocked in — hours updating"
      : bundle.today_status === "not_started"
        ? "No time in yet today"
        : "Recorded for today";

    const total = Number(bundle.total_hours_rendered) || 0;
    const required = Number(bundle.required_hours) || 600;
    const remaining = Number(bundle.remaining_hours) || 0;
    const pct = Number(bundle.percent_complete) || 0;
    $("immersion-stat-total-hours").textContent = `${total.toFixed(2)}h`;
    $("immersion-stat-total-note").textContent = `${pct}% of ${required}h required`;

    $("immersion-stat-remaining-hours").textContent = `${remaining.toFixed(2)}h`;
    $("immersion-stat-remaining-note").textContent =
      remaining <= 0 ? "Requirement met" : "Until immersion target";

    $("immersion-stat-days").textContent = String(bundle.days_attended ?? 0);
    $("immersion-stat-journals-note").textContent = `${bundle.journal_count ?? 0} journal entries`;

    const todayBody = $("immersion-today-body");
    const session = bundle.today_session || bundle.active;
    if (todayBody) {
      if (!session) {
        todayBody.innerHTML = `<p class="empty-state">No clock session for today yet.</p>`;
      } else {
        const loc = session.readable_location_name || "—";
        const tIn = fmtTime(session.time_in);
        const tOut = session.time_out ? fmtTime(session.time_out) : bundle.is_at_work ? "In progress" : "—";
        const tinUrl = session.photo_url || session.time_in_photo_url;
        const toutUrl = session.time_out_photo_url;
        const photos =
          tinUrl || toutUrl
            ? `<div class="immersion-today-photos">
                ${photoThumbBlock(tinUrl, "Time In")}
                ${photoThumbBlock(toutUrl, "Time Out")}
              </div>`
            : "";
        const viewBtn =
          session.id && (session.has_time_in_photo || session.has_time_out_photo || tinUrl || toutUrl)
            ? `<button type="button" class="btn btn-ghost btn-sm teacher-view-attendance-btn" data-attendance-id="${escapeHtml(String(session.id))}" style="margin-top:0.65rem;">
                <i class="fa-solid fa-camera"></i> View verification photos
              </button>`
            : "";
        todayBody.innerHTML = `
          <dl class="immersion-detail-meta">
            <div><dt>Time in</dt><dd>${escapeHtml(tIn)}</dd></div>
            <div><dt>Time out</dt><dd>${escapeHtml(tOut)}</dd></div>
            <div><dt>Hours today</dt><dd>${escapeHtml(String(todayH.toFixed(2)))}h</dd></div>
            <div><dt>Location</dt><dd>${escapeHtml(loc)}</dd></div>
          </dl>
          ${photos}
          ${viewBtn}`;
        bindAttendancePhotoButtons(todayBody);
      }
    }

    const tbody = $("immersion-attendance-body");
    const logs = Array.isArray(bundle.attendance) ? bundle.attendance : [];
    if (tbody) {
      tbody.innerHTML =
        logs.length === 0
          ? `<tr><td colspan="7" class="small-note">No immersion sessions yet.</td></tr>`
          : logs
              .map((r) => {
                const st = String(r.status || "").toLowerCase();
                const badgeClass =
                  st === "active" ? "active" : st === "completed" ? "completed" : "warning";
                const hrs =
                  r.hours_rendered != null
                    ? `${Number(r.hours_rendered).toFixed(2)}h`
                    : r.total_hours != null
                      ? `${Number(r.total_hours).toFixed(2)}h`
                      : "—";
                const loc = r.readable_location_name || "—";
                const hasPhoto = r.has_time_in_photo || r.has_time_out_photo;
                const photoCell =
                  hasPhoto && r.id
                    ? `<button type="button" class="btn btn-ghost btn-sm teacher-view-attendance-btn" data-attendance-id="${escapeHtml(String(r.id))}">
                        <i class="fa-solid fa-camera"></i> View
                      </button>`
                    : `<span class="small-note">—</span>`;
                return `<tr>
                  <td>${escapeHtml(fmtDate(r.calendar_date || r.time_in))}</td>
                  <td>${escapeHtml(fmtTime(r.time_in))}</td>
                  <td>${escapeHtml(r.time_out ? fmtTime(r.time_out) : "—")}</td>
                  <td>${escapeHtml(hrs)}</td>
                  <td>${escapeHtml(loc)}</td>
                  <td><span class="status-badge ${badgeClass}">${escapeHtml(r.status || "—")}</span></td>
                  <td>${photoCell}</td>
                </tr>`;
              })
              .join("");
      bindAttendancePhotoButtons(tbody);
    }

    const journalsEl = $("immersion-journals-list");
    const journals = Array.isArray(bundle.journals) ? bundle.journals : [];
    if (journalsEl) {
      journalsEl.innerHTML =
        journals.length === 0
          ? `<p class="small-note">No journal entries yet.</p>`
          : journals
              .map(
                (j) => `
              <article class="immersion-journal-entry glass-card lq-surface-inset" style="padding:0.85rem;margin-bottom:0.5rem;border-radius:14px;">
                <div class="small-note">${escapeHtml(fmtDate(j.entry_date || j.submitted_at))}</div>
                <p style="margin:0.35rem 0 0;line-height:1.45;">${escapeHtml(j.body || "")}</p>
              </article>`
              )
              .join("");
    }
  }

  function bindAttendancePhotoButtons(root) {
    if (!root) return;
    root.querySelectorAll(".teacher-view-attendance-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const aid = btn.getAttribute("data-attendance-id");
        if (aid) void openAttendanceSession(aid);
      });
    });
  }

  async function openAttendanceSession(attendanceId) {
    const tid = getTeacherIdNumber();
    const sid = STATE.activeStudentIdNumber;
    if (!tid || !sid || !attendanceId) return;
    try {
      if (typeof showToast === "function") showToast("Loading photos…", "info");
      const params = new URLSearchParams({
        teacher_id_number: tid,
        student_id_number: sid,
        attendance_id: String(attendanceId),
      });
      const res = await fetch(apiUrl(`/teacher/immersion/attendance-session?${params}`), {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const row = data.session;
      if (!row) throw new Error("No session data returned.");
      if (typeof showImmersionAttendanceDetail === "function") {
        showImmersionAttendanceDetail(row);
      } else {
        const body = $("immersion-attendance-modal-body");
        if (body && typeof buildImmersionAttendanceDetailHtml === "function") {
          body.innerHTML = buildImmersionAttendanceDetailHtml(row);
          if (typeof openImmersionAttendanceModal === "function") openImmersionAttendanceModal();
        }
      }
    } catch (err) {
      console.error("openAttendanceSession:", err);
      if (typeof showToast === "function") showToast(err.message || "Could not load photos.", "error");
    }
  }

  async function openStudentDetail(studentIdNumber) {
    const tid = getTeacherIdNumber();
    if (!tid) return;
    STATE.activeStudentIdNumber = studentIdNumber;
    showDetailView();
    const sheet = $("immersion-detail-sheet");
    if (sheet) sheet.setAttribute("aria-busy", "true");
    try {
      const params = new URLSearchParams({
        teacher_id_number: tid,
        student_id_number: studentIdNumber,
        limit: "120",
      });
      const res = await fetch(apiUrl(`/teacher/immersion/student-overview?${params}`), {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.overview = data;
      renderOverview(data);
    } catch (err) {
      console.error("openStudentDetail:", err);
      if (typeof showToast === "function") showToast(err.message || "Could not load student.", "error");
      showListView();
    } finally {
      if (sheet) sheet.removeAttribute("aria-busy");
    }
  }

  function bindEvents() {
    $("immersion-back-students-btn")?.addEventListener("click", showListView);
    $("immersion-refresh-btn")?.addEventListener("click", () => {
      if (STATE.activeStudentIdNumber) openStudentDetail(STATE.activeStudentIdNumber);
    });
    let filterTimer;
    $("immersion-student-filter")?.addEventListener("input", (ev) => {
      clearTimeout(filterTimer);
      const val = ev.target.value;
      filterTimer = setTimeout(() => loadStudents(val), 280);
    });

    $("immersion-attendance-modal-close")?.addEventListener("click", () => {
      if (typeof closeImmersionAttendanceModal === "function") closeImmersionAttendanceModal();
    });
    $("immersion-photo-lightbox-close")?.addEventListener("click", () => {
      if (typeof closeImmersionPhotoLightbox === "function") closeImmersionPhotoLightbox();
    });
    const modal = $("immersion-attendance-modal");
    modal?.addEventListener("click", (ev) => {
      if (ev.target === modal && typeof closeImmersionAttendanceModal === "function") {
        closeImmersionAttendanceModal();
      }
    });
    const lb = $("immersion-photo-lightbox");
    lb?.addEventListener("click", (ev) => {
      if (ev.target === lb && typeof closeImmersionPhotoLightbox === "function") {
        closeImmersionPhotoLightbox();
      }
    });
    document.addEventListener("click", (ev) => {
      if (typeof handleImmersionPhotoPreviewClick === "function") {
        handleImmersionPhotoPreviewClick(ev);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const session = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    if (!session || !session.access_token) {
      window.location.href = "login.html";
      return;
    }
    const role = String(session.role || "").toLowerCase();
    if (role !== "teacher" && role !== "admin") {
      if (typeof showToast === "function") showToast("Teacher access only.", "error");
      window.location.href = "login.html";
      return;
    }
    if (typeof ensureTeacherSidebarNav === "function") ensureTeacherSidebarNav();
    if (typeof initTeacherLearniqSidebarProfile === "function") {
      initTeacherLearniqSidebarProfile();
    } else if (typeof hydrateStudentSidebarChip === "function") {
      hydrateStudentSidebarChip();
    }
    bindEvents();
    await loadStrands();
  });
})();
