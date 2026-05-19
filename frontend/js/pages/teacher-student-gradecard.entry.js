// Teacher Student Gradecard — strand → students → detail

(function () {
  const STRAND_META = {
    STEM: { icon: "fa-atom", color: "#3b82f6", blurb: "Science, Technology, Engineering & Mathematics" },
    ABM: { icon: "fa-chart-line", color: "#10b981", blurb: "Accountancy, Business & Management" },
    HUMSS: { icon: "fa-book-open", color: "#a855f7", blurb: "Humanities & Social Sciences" },
    "TVL-HE": { icon: "fa-screwdriver-wrench", color: "#f59e0b", blurb: "Technical-Vocational-Livelihood" },
    __unassigned__: { icon: "fa-circle-question", color: "#94a3b8", blurb: "No strand on profile" },
  };

  const STATE = {
    view: "strands",
    periods: [],
    currentPeriodId: null,
    strands: [],
    selectedStrand: null,
    selectedStrandLabel: null,
    selectedGradeLevel: "11",
    students: [],
    activeStudentIdNumber: null,
    lastData: null,
    editedSubjects: new Map(),
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, value) { const el = $(id); if (el) el.textContent = value; }

  function getTeacherIdNumber() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    return u && u.id_number ? String(u.id_number).trim() : "";
  }

  function normalizeGradeLevel(raw) {
    const s = String(raw || "").trim().toLowerCase();
    const m = s.match(/\b(11|12)\b/);
    return m ? m[1] : "";
  }

  function updateGradeTabUI() {
    document.querySelectorAll("[data-gradecard-grade]").forEach((btn) => {
      const g = btn.getAttribute("data-gradecard-grade");
      btn.classList.toggle("is-active", g === STATE.selectedGradeLevel);
      btn.setAttribute("aria-selected", g === STATE.selectedGradeLevel ? "true" : "false");
    });
  }

  function strandCountForGrade(row) {
    if (!row) return 0;
    return STATE.selectedGradeLevel === "12"
      ? Number(row.grade_12_count) || 0
      : Number(row.grade_11_count) || 0;
  }

  function updateGradeTabCounts() {
    let c11 = 0;
    let c12 = 0;
    STATE.strands.forEach((row) => {
      c11 += Number(row.grade_11_count) || 0;
      c12 += Number(row.grade_12_count) || 0;
    });
    const el11 = $("gradecard-grade-count-11");
    const el12 = $("gradecard-grade-count-12");
    if (el11) {
      el11.textContent = String(c11);
      el11.hidden = false;
    }
    if (el12) {
      el12.textContent = String(c12);
      el12.hidden = false;
    }
  }

  function updateStrandStepNote() {
    const note = document.querySelector("#gradecard-strand-step .gradecard-step-head .small-note");
    if (note) {
      note.textContent = `Grade ${STATE.selectedGradeLevel} students enrolled in your subjects, grouped by SHS strand.`;
    }
  }

  function renderStrandGrid() {
    const grid = $("gradecard-strand-grid");
    if (!grid) return;
    if (!STATE.strands.length) {
      grid.innerHTML = `<p class="empty-state">No strands found. Enroll students in your subjects first.</p>`;
      return;
    }

    const rows = STATE.strands.filter((row) => {
      const code = row.strand || "";
      if (code === "__unassigned__") return strandCountForGrade(row) > 0;
      return true;
    });

    if (!rows.length) {
      grid.innerHTML = `
        <p class="empty-state">No Grade ${escapeHtml(STATE.selectedGradeLevel)} students enrolled in your subjects yet.</p>`;
      return;
    }

    grid.innerHTML = rows
      .map((row) => {
        const code = row.strand || "";
        const meta = STRAND_META[code] || STRAND_META.__unassigned__;
        const label = row.label || code;
        const count = strandCountForGrade(row);
        return `
          <button
            type="button"
            class="gradecard-strand-card"
            role="listitem"
            data-strand="${escapeHtml(code)}"
            data-label="${escapeHtml(label)}"
            style="--strand-accent:${meta.color}">
            <span class="gradecard-strand-icon"><i class="fa-solid ${meta.icon}"></i></span>
            <strong>${escapeHtml(label)}</strong>
            <span class="small-note">${escapeHtml(meta.blurb)}</span>
            <span class="gradecard-strand-count">${count} student${count === 1 ? "" : "s"}</span>
          </button>`;
      })
      .join("");

    grid.querySelectorAll(".gradecard-strand-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectStrand(btn.getAttribute("data-strand"), btn.getAttribute("data-label"));
      });
    });
  }

  async function selectGradeLevel(grade) {
    const g = normalizeGradeLevel(grade);
    if (g !== "11" && g !== "12") return;
    if (STATE.selectedGradeLevel === g) return;
    STATE.selectedGradeLevel = g;
    updateGradeTabUI();
    updateStrandStepNote();
    renderStrandGrid();
    if (STATE.view === "students" && STATE.selectedStrand) {
      const filter = $("gradecard-student-filter");
      await loadStudents(filter?.value || "");
    }
  }

  function fmtNumber(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return `${Math.round(n * 100) / 100}`;
  }

  function fmtPercent(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return `${Math.round(n * 100) / 100}%`;
  }

  function scoreInput(sid, field, value, placeholder) {
    const v = value == null ? "" : String(value);
    return `<input
      type="number"
      class="form-input gradecard-score-input"
      data-field="${field}"
      data-subject-id="${sid}"
      min="0" max="100" step="0.1"
      value="${escapeHtml(v)}"
      placeholder="${escapeHtml(placeholder || "—")}"
      style="width: 72px; text-align:center;" />`;
  }

  function parseScoreInput(inp) {
    const v = inp.value.trim();
    return v === "" ? null : Number(v);
  }

  function initials(name) {
    const s = String(name || "").trim();
    if (!s) return "??";
    const parts = s.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "??";
  }

  function setStatus(msg, kind = "muted") {
    const el = $("gradecard-save-status");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = kind === "danger" ? "#fca5a5" : kind === "success" ? "#34d399" : "";
  }

  function renderEmptyState(text) {
    const body = $("gradecard-subjects-body");
    if (!body) return;
    body.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fa-solid fa-id-card"></i>
          <p>${escapeHtml(text || "Select a student to view their gradecard.")}</p>
        </td>
      </tr>`;
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (STATE.selectedStrand) params.set("strand", STATE.selectedStrand);
    if (STATE.activeStudentIdNumber) params.set("student", STATE.activeStudentIdNumber);
    const q = params.toString();
    const url = q
      ? `${window.location.pathname}?${q}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }

  function renderBreadcrumb() {
    const nav = $("gradecard-breadcrumb");
    if (!nav) return;
    const parts = [
      `<button type="button" class="gradecard-crumb${STATE.view === "strands" ? " is-current" : ""}" data-go="strands">Strands</button>`,
    ];
    if (STATE.selectedStrand) {
      parts.push('<span class="gradecard-crumb-sep">/</span>');
      parts.push(
        `<button type="button" class="gradecard-crumb${STATE.view === "students" ? " is-current" : ""}" data-go="students">${escapeHtml(
          STATE.selectedStrandLabel || STATE.selectedStrand
        )}</button>`
      );
    }
    if (STATE.activeStudentIdNumber && STATE.view === "detail") {
      const name =
        STATE.lastData?.student?.display_name || STATE.activeStudentIdNumber;
      parts.push('<span class="gradecard-crumb-sep">/</span>');
      parts.push(`<span class="gradecard-crumb is-current">${escapeHtml(name)}</span>`);
    }
    nav.innerHTML = parts.join("");
    nav.querySelectorAll("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const go = btn.getAttribute("data-go");
        if (go === "strands") showStrandsView();
        else if (go === "students") showStudentsView();
      });
    });
  }

  function showStrandsView() {
    STATE.view = "strands";
    STATE.selectedStrand = null;
    STATE.selectedStrandLabel = null;
    STATE.activeStudentIdNumber = null;
    STATE.lastData = null;
    $("gradecard-strand-step")?.removeAttribute("hidden");
    $("gradecard-students-step")?.setAttribute("hidden", "");
    $("gradecard-picker")?.removeAttribute("hidden");
    $("gradecard-detail-toolbar")?.setAttribute("hidden", "");
    $("gradecard-sheet")?.setAttribute("hidden", "");
    const filter = $("gradecard-student-filter");
    if (filter) filter.value = "";
    renderBreadcrumb();
    syncUrl();
    renderStrandGrid();
  }

  function showStudentsView() {
    STATE.view = "students";
    STATE.activeStudentIdNumber = null;
    STATE.lastData = null;
    $("gradecard-strand-step")?.setAttribute("hidden", "");
    $("gradecard-students-step")?.removeAttribute("hidden");
    $("gradecard-picker")?.removeAttribute("hidden");
    $("gradecard-detail-toolbar")?.setAttribute("hidden", "");
    $("gradecard-sheet")?.setAttribute("hidden", "");
    renderBreadcrumb();
    syncUrl();
    renderEmptyState();
  }

  function showDetailView() {
    STATE.view = "detail";
    $("gradecard-picker")?.setAttribute("hidden", "");
    $("gradecard-detail-toolbar")?.removeAttribute("hidden");
    $("gradecard-sheet")?.removeAttribute("hidden");
    renderBreadcrumb();
    syncUrl();
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

  async function loadStrands() {
    const grid = $("gradecard-strand-grid");
    if (!grid) return;
    const tid = getTeacherIdNumber();
    if (!tid) {
      grid.innerHTML = `<p class="empty-state">Sign in as a teacher to view strands.</p>`;
      return;
    }
    grid.innerHTML = `<p class="small-note">Loading strands…</p>`;
    try {
      const params = new URLSearchParams({ teacher_id_number: tid });
      const res = await fetch(apiUrl(`/teacher/gradecard/strands?${params}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.strands = Array.isArray(data.strands) ? data.strands : [];
      updateGradeTabCounts();
      updateStrandStepNote();
      renderStrandGrid();
    } catch (err) {
      console.error("loadStrands:", err);
      grid.innerHTML = `<p class="empty-state">Could not load strands: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function selectStrand(strand, label) {
    STATE.selectedStrand = strand;
    STATE.selectedStrandLabel = label || strand;
    const title = $("gradecard-students-title");
    if (title) {
      title.innerHTML = `<i class="fa-solid fa-users"></i> ${escapeHtml(STATE.selectedStrandLabel)}`;
    }
    const sub = $("gradecard-students-subtitle");
    if (sub) {
      sub.textContent = `Grade ${STATE.selectedGradeLevel} students enrolled in your subjects under this strand.`;
    }
    showStudentsView();
    await loadStudents();
  }

  async function loadStudents(filterText) {
    const list = $("gradecard-student-list");
    if (!list || !STATE.selectedStrand) return;
    const tid = getTeacherIdNumber();
    if (!tid) return;

    list.innerHTML = `<p class="small-note">Loading students…</p>`;
    try {
      const params = new URLSearchParams({
        teacher_id_number: tid,
        strand: STATE.selectedStrand,
        grade_level: STATE.selectedGradeLevel,
      });
      const q = (filterText || "").trim();
      if (q) params.set("q", q);
      const res = await fetch(apiUrl(`/teacher/gradecard/students?${params}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.students = Array.isArray(data.students) ? data.students : [];
      if (!STATE.students.length) {
        list.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-user-group"></i>
            <p>No ${escapeHtml(STATE.selectedGradeLevel === "12" ? "Grade 12" : "Grade 11")} students in this strand enrolled in your subjects yet.</p>
          </div>`;
        return;
      }
      list.innerHTML = STATE.students
        .map((s) => {
          const idn = escapeHtml(s.id_number || "");
          const name = escapeHtml(s.display_name || s.id_number || "Student");
          const meta = [
            s.grade_level ? `Grade ${s.grade_level}` : null,
            s.section ? `Section ${s.section}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return `
            <button
              type="button"
              class="gradecard-student-row"
              role="listitem"
              data-id-number="${idn}">
              <span class="gradecard-student-row-avatar">${escapeHtml(initials(s.display_name || idn))}</span>
              <span class="gradecard-student-row-text">
                <strong>${name}</strong>
                <span class="small-note">ID ${idn}${meta ? ` · ${escapeHtml(meta)}` : ""}</span>
              </span>
              <i class="fa-solid fa-chevron-right gradecard-student-row-chevron" aria-hidden="true"></i>
            </button>`;
        })
        .join("");
      list.querySelectorAll(".gradecard-student-row").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idn = btn.getAttribute("data-id-number");
          if (idn) openStudentGradecard(idn);
        });
      });
    } catch (err) {
      console.error("loadStudents:", err);
      list.innerHTML = `<p class="empty-state">Could not load students: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function openStudentGradecard(studentIdNumber) {
    STATE.activeStudentIdNumber = studentIdNumber;
    showDetailView();
    await loadGradecardForStudent(studentIdNumber);
  }

  async function loadGradecardForStudent(studentIdNumber) {
    const periodSel = $("gradecard-term-select");
    const period = periodSel?.value || STATE.currentPeriodId || "";

    const params = new URLSearchParams({ student_id_number: studentIdNumber });
    if (period) params.set("period_id", period);

    renderEmptyState("Loading gradecard…");
    STATE.editedSubjects.clear();

    try {
      const res = await fetch(apiUrl(`/gradecard?${params.toString()}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`;
        renderEmptyState(msg);
        if (typeof showToast === "function") showToast(msg, "danger");
        return;
      }
      STATE.lastData = data;
      renderGradecard(data);
      renderBreadcrumb();
    } catch (err) {
      console.error("loadGradecardForStudent:", err);
      renderEmptyState(`Failed to load: ${err.message}`);
    }
  }

  function renderGradecard(data) {
    const student = data.student || {};
    const adviser = data.adviser || null;
    const summary = data.summary || {};
    const period = data.period || {};
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    const periodLabel = $("gradecard-period-label");
    if (periodLabel) {
      const py = period.school_year || "";
      const pn = period.name || "";
      periodLabel.textContent =
        py || pn ? `Teacher Gradecard · ${py}${pn ? ` · ${pn}` : ""}` : "Teacher Gradecard View";
    }

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
    setText("gradecard-student-adviser", `Adviser: ${adviser?.display_name || "—"}`);

    setText("gradecard-gpa", fmtNumber(summary.general_average));
    setText("gradecard-standing", summary.standing || "—");
    setText("gradecard-conduct", summary.conduct || "—");
    setText("gradecard-days-present", fmtNumber(summary.days_present));
    setText("gradecard-days-absent", fmtNumber(summary.days_absent));
    setText("gradecard-tardy", fmtNumber(summary.times_tardy));

    const commentsEl = $("gradecard-comments-text");
    if (commentsEl) commentsEl.value = summary.adviser_comments || "";

    const body = $("gradecard-subjects-body");
    if (!body) return;

    if (!subjects.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-id-card"></i>
            <p>No subject activity for <strong>${escapeHtml(student.display_name || student.id_number || "this student")}</strong> in this period.</p>
            <p class="small-note">Enroll them in your subject or wait for quiz/activity submissions.</p>
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = subjects
      .map((s) => {
        const sid = escapeHtml(s.subject_id);
        const finalVal = s.final_grade == null ? "" : String(s.final_grade);
        const remarks = s.remarks || "";
        const weightsLabel = s.weights_label || "—";
        const incomplete = !s.grade_complete;
        const attNote =
          s.attendance_percent != null
            ? `<span class="small-note">Att ${fmtPercent(s.attendance_percent)}</span>`
            : "";
        return `
          <tr data-subject-id="${sid}">
            <td>
              <strong>${escapeHtml(s.subject_name || "Subject")}</strong>
              ${attNote}
            </td>
            <td class="num">${scoreInput(sid, "written_work_score", s.written_work_score, fmtNumber(s.written_work_auto))}</td>
            <td class="num">${scoreInput(sid, "performance_task_score", s.performance_task_score, fmtNumber(s.performance_task_auto))}</td>
            <td class="num">${scoreInput(sid, "quarterly_assessment_score", s.quarterly_assessment_score, fmtNumber(s.quarterly_assessment_auto))}</td>
            <td class="num"><span class="badge badge-soft" title="WW / PT / QA %">${escapeHtml(weightsLabel)}</span></td>
            <td class="num">
              <input
                type="number"
                class="form-input gradecard-final-input"
                data-field="final_grade"
                data-subject-id="${sid}"
                min="0" max="100" step="0.1"
                value="${escapeHtml(finalVal)}"
                placeholder="${incomplete ? "Incomplete" : fmtNumber(s.computed_final)}"
                style="width: 72px; text-align:center;" />
              ${s.final_is_manual ? '<span class="small-note" title="Manual override">✎</span>' : ""}
            </td>
            <td>
              <input
                type="text"
                class="form-input gradecard-remarks-input"
                data-field="remarks"
                data-subject-id="${sid}"
                value="${escapeHtml(remarks)}"
                placeholder="e.g. Passed"
                style="width: 100%; min-width: 120px;" />
            </td>
          </tr>`;
      })
      .join("");

    body.querySelectorAll(
      "input.gradecard-score-input, input.gradecard-final-input, input.gradecard-remarks-input"
    ).forEach((inp) => {
      inp.addEventListener("input", () => {
        const sid = inp.getAttribute("data-subject-id");
        const field = inp.getAttribute("data-field");
        if (!sid || !field) return;
        if (!STATE.editedSubjects.has(sid)) STATE.editedSubjects.set(sid, {});
        const entry = STATE.editedSubjects.get(sid);
        if (field === "remarks") {
          entry.remarks = inp.value;
          return;
        }
        if (field === "final_grade") {
          entry.final_grade = parseScoreInput(inp);
          entry.final_is_manual = true;
          return;
        }
        entry[field] = parseScoreInput(inp);
      });
    });
  }

  async function saveRemarks() {
    if (!STATE.activeStudentIdNumber || !STATE.lastData) {
      setStatus("Load a student first.", "danger");
      return;
    }

    const periodId = $("gradecard-term-select")?.value || STATE.currentPeriodId;
    if (!periodId) {
      setStatus("No grading period configured.", "danger");
      return;
    }

    const btn = $("gradecard-save-remarks-btn");
    if (btn) btn.disabled = true;
    setStatus("Saving…");

    const subjects = STATE.lastData.subjects || [];
    const savedSubjects = [];
    const errors = [];

    for (const subj of subjects) {
      const sid = String(subj.subject_id);
      const edit = STATE.editedSubjects.get(sid);
      if (!edit) continue;

      const body = {
        student_id_number: STATE.activeStudentIdNumber,
        subject_id: sid,
        grading_period_id: periodId,
        teacher_id_number: subj.teacher_id_number || null,
        written_work_score:
          edit.written_work_score !== undefined ? edit.written_work_score : subj.written_work_score,
        performance_task_score:
          edit.performance_task_score !== undefined
            ? edit.performance_task_score
            : subj.performance_task_score,
        quarterly_assessment_score:
          edit.quarterly_assessment_score !== undefined
            ? edit.quarterly_assessment_score
            : subj.quarterly_assessment_score,
        final_grade: edit.final_grade !== undefined ? edit.final_grade : subj.final_grade,
        final_is_manual: edit.final_is_manual === true,
        remarks: edit.remarks !== undefined ? edit.remarks : subj.remarks,
      };

      try {
        const res = await fetch(apiUrl("/student-grades"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          errors.push(`${subj.subject_name || sid}: ${data?.error || res.status}`);
        } else {
          savedSubjects.push(subj.subject_name || sid);
        }
      } catch (e) {
        errors.push(`${subj.subject_name || sid}: ${e.message}`);
      }
    }

    const commentsEl = $("gradecard-comments-text");
    const newComments = commentsEl ? String(commentsEl.value || "").trim() : "";
    const oldComments = String(STATE.lastData.summary?.adviser_comments || "").trim();
    if (newComments !== oldComments) {
      try {
        const res = await fetch(apiUrl("/gradecards"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            student_id_number: STATE.activeStudentIdNumber,
            grading_period_id: periodId,
            adviser_comments: newComments,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) errors.push(`Comments: ${data?.error || res.status}`);
      } catch (e) {
        errors.push(`Comments: ${e.message}`);
      }
    }

    if (btn) btn.disabled = false;

    if (errors.length) {
      setStatus(`Saved with ${errors.length} error(s). See console.`, "danger");
      console.error("Save errors:", errors);
      if (typeof showToast === "function") showToast("Some changes failed to save.", "danger");
    } else if (!savedSubjects.length && newComments === oldComments) {
      setStatus("No changes to save.");
    } else {
      setStatus("Saved.", "success");
      if (typeof showToast === "function") showToast("Gradecard saved.", "success");
    }

    await loadGradecardForStudent(STATE.activeStudentIdNumber);
  }

  function bindControls() {
    $("gradecard-back-strands-btn")?.addEventListener("click", showStrandsView);
    $("gradecard-back-students-btn")?.addEventListener("click", showStudentsView);

    document.querySelectorAll("[data-gradecard-grade]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectGradeLevel(btn.getAttribute("data-gradecard-grade"));
      });
    });

    let filterTimer = null;
    $("gradecard-student-filter")?.addEventListener("input", (ev) => {
      clearTimeout(filterTimer);
      const val = ev.target.value;
      filterTimer = setTimeout(() => loadStudents(val), 280);
    });

    $("gradecard-term-select")?.addEventListener("change", () => {
      if (STATE.activeStudentIdNumber) loadGradecardForStudent(STATE.activeStudentIdNumber);
    });

    $("gradecard-print-btn")?.addEventListener("click", () => window.print());
    $("gradecard-save-remarks-btn")?.addEventListener("click", saveRemarks);
  }

  async function restoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const strand = params.get("strand");
    const student = params.get("student");
    if (!strand) return;
    await selectStrand(strand, strand);
    if (student) await openStudentGradecard(student);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (typeof ensureTeacherSidebarNav === "function") {
      ensureTeacherSidebarNav();
    }
    if (typeof initTeacherLearniqSidebarProfile === "function") {
      initTeacherLearniqSidebarProfile();
    } else if (typeof hydrateStudentSidebarChip === "function") {
      hydrateStudentSidebarChip();
    }
    bindControls();
    updateGradeTabUI();
    renderEmptyState();
    await loadGradingPeriods();
    await loadStrands();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("strand")) {
      await restoreFromUrl();
    } else {
      showStrandsView();
    }
  });
})();
