// ============================================================
// Admin Student Gradecard
// Wires search input + term selector → /gradecard endpoint
// and renders into the static template on admin-student-gradecard.html
// ============================================================

(function () {
  const STATE = {
    periods: [],
    currentPeriodId: null,
    activeStudentIdNumber: null,
  };

  function $(id) { return document.getElementById(id); }

  function fmtNumber(v, suffix = "") {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return `${Math.round(n * 100) / 100}${suffix}`;
  }

  function fmtPercent(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return `${Math.round(n * 100) / 100}%`;
  }

  function initials(name) {
    const s = String(name || "").trim();
    if (!s) return "??";
    const parts = s.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "??";
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function renderEmptyState(text) {
    const body = $("gradecard-subjects-body");
    if (body) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-id-card"></i>
            <p>${escapeHtml(text || "Search for a student above to load their gradecard.")}</p>
            <p class="small-note">Tip: type the school ID number (e.g. <code>2026-12345</code>) or the student's full name then press Enter.</p>
          </td>
        </tr>`;
    }
  }

  function resetGradecardUi() {
    setText("gradecard-student-name", "—");
    setText("gradecard-student-meta", "—");
    setText("gradecard-student-adviser", "Adviser: —");
    setText("gradecard-gpa", "—");
    setText("gradecard-standing", "—");
    setText("gradecard-conduct", "—");
    setText("gradecard-days-present", "—");
    setText("gradecard-days-absent", "—");
    setText("gradecard-tardy", "—");
    setText("gradecard-ref", "GR-XXXX-XXXX");
    const av = $("gradecard-avatar");
    if (av) av.textContent = "?";
    const comments = $("gradecard-comments-text");
    if (comments) {
      comments.textContent = "Comments and remarks from the student's adviser will appear here once a student is loaded.";
    }
  }

  async function loadGradingPeriods() {
    const sel = $("gradecard-term-select");
    if (!sel) return;
    try {
      const res = await fetch(apiUrl("/grading-periods"));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      STATE.periods = Array.isArray(data.periods) ? data.periods : [];
      STATE.currentPeriodId = data.current_id || (STATE.periods[0]?.id ?? null);

      if (!STATE.periods.length) {
        sel.innerHTML = '<option value="">No grading periods yet</option>';
        sel.disabled = true;
        return;
      }

      sel.disabled = false;
      sel.innerHTML = STATE.periods
        .map((p) => {
          const label = `${p.school_year} · ${p.name}`;
          const isCur = p.id === STATE.currentPeriodId ? " (current)" : "";
          return `<option value="${escapeHtml(p.id)}">${escapeHtml(label + isCur)}</option>`;
        })
        .join("");
      if (STATE.currentPeriodId) sel.value = STATE.currentPeriodId;
    } catch (err) {
      console.error("loadGradingPeriods:", err);
      sel.innerHTML = '<option value="">Failed to load periods</option>';
      sel.disabled = true;
    }
  }

  async function loadGradecardForStudent(studentIdNumber) {
    const periodSel = $("gradecard-term-select");
    const period = periodSel?.value || STATE.currentPeriodId || "";

    const params = new URLSearchParams({ student_id_number: studentIdNumber });
    if (period) params.set("period_id", period);

    renderEmptyState("Loading gradecard…");

    try {
      const res = await fetch(apiUrl(`/gradecard?${params.toString()}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        renderEmptyState(msg);
        if (typeof showToast === "function") showToast(msg, "danger");
        return;
      }
      STATE.activeStudentIdNumber = studentIdNumber;
      renderGradecard(data);
    } catch (err) {
      console.error("loadGradecardForStudent:", err);
      renderEmptyState(`Failed to load: ${err.message}`);
    }
  }

  function renderGradecard(data) {
    const student = data.student || {};
    const adviser = data.adviser || null;
    const period = data.period || {};
    const summary = data.summary || {};
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    // Header / student block
    setText("gradecard-ref", summary.reference_no || "GR-XXXX-XXXX");
    const av = $("gradecard-avatar");
    const studentName = student.display_name || student.first_name || "—";
    if (av) av.textContent = initials(studentName);
    setText("gradecard-student-name", studentName);

    const metaBits = [
      student.id_number ? `ID No. ${student.id_number}` : null,
      student.grade_level ? `Grade ${student.grade_level}` : null,
      student.strand || null,
      student.section ? `Section ${student.section}` : null,
    ].filter(Boolean);
    setText("gradecard-student-meta", metaBits.join(" · ") || "—");

    setText(
      "gradecard-student-adviser",
      `Adviser: ${adviser?.display_name || "—"}`
    );

    setText("gradecard-gpa", fmtNumber(summary.general_average));
    setText("gradecard-standing", summary.standing || "—");

    // Conduct grid
    setText("gradecard-conduct", summary.conduct || "—");
    setText("gradecard-days-present", fmtNumber(summary.days_present));
    setText("gradecard-days-absent", fmtNumber(summary.days_absent));
    setText("gradecard-tardy", fmtNumber(summary.times_tardy));

    // Adviser comments
    const comments = $("gradecard-comments-text");
    if (comments) {
      comments.textContent =
        (summary.adviser_comments && String(summary.adviser_comments).trim()) ||
        "No adviser comments saved yet for this student.";
    }

    // Subjects table
    const body = $("gradecard-subjects-body");
    if (!body) return;

    if (!subjects.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-id-card"></i>
            <p>No subject activity recorded for <strong>${escapeHtml(student.display_name || student.id_number || "this student")}</strong> in this period.</p>
            <p class="small-note">Enroll this student in subjects or wait for them to submit quizzes/activities.</p>
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = subjects
      .map((s) => {
        const finalBadge = s.final_is_override
          ? `<span class="badge badge-soft" style="margin-left:0.35rem;" title="Set by teacher"><i class="fa-solid fa-pen"></i></span>`
          : "";
        return `
          <tr>
            <td><strong>${escapeHtml(s.subject_name || "Subject")}</strong></td>
            <td>${escapeHtml(s.teacher_name || s.teacher_id_number || "—")}</td>
            <td class="num">${fmtNumber(s.quiz_average)}<br /><span class="small-note">${s.quiz_attempts || 0} attempts</span></td>
            <td class="num">${fmtNumber(s.activity_average)}<br /><span class="small-note">${s.activity_attempts || 0} done</span></td>
            <td class="num">${fmtPercent(s.attendance_percent)}</td>
            <td class="num"><strong>${fmtNumber(s.final_grade)}</strong>${finalBadge}</td>
            <td>${escapeHtml(s.remarks || "—")}</td>
          </tr>`;
      })
      .join("");
  }

  function handleSearchSubmit() {
    const input = $("gradecard-search-input");
    if (!input) return;
    const raw = String(input.value || "").trim();
    if (!raw) {
      renderEmptyState();
      resetGradecardUi();
      return;
    }
    loadGradecardForStudent(raw);
  }

  function bindControls() {
    $("gradecard-search-input")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        handleSearchSubmit();
      }
    });

    $("gradecard-term-select")?.addEventListener("change", () => {
      if (STATE.activeStudentIdNumber) {
        loadGradecardForStudent(STATE.activeStudentIdNumber);
      }
    });

    $("gradecard-print-btn")?.addEventListener("click", () => {
      window.print();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();
    bindControls();
    renderEmptyState();
    await loadGradingPeriods();
  });
})();
