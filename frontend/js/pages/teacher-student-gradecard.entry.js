// Teacher Student Gradecard — strand → students → detail.
// The detail is the same simple gradecard as the admin page (shared view in
// js/shared/gradecard-view.js); the teacher's own subjects open into a small
// editor for Written work / Performance tasks / Exam, an optional final-grade
// override and remarks.

(function () {
  const G = window.LearnIQGradecard;

  const STRAND_META = {
    STEM: { icon: "fa-atom", color: "#ca8a04", blurb: "Science, Technology, Engineering & Mathematics" },
    ABM: { icon: "fa-chart-line", color: "#b45309", blurb: "Accountancy, Business & Management" },
    HUMSS: { icon: "fa-book-open", color: "#a16207", blurb: "Humanities & Social Sciences" },
    "TVL-HE": { icon: "fa-screwdriver-wrench", color: "#92400e", blurb: "Technical-Vocational-Livelihood" },
    __unassigned__: { icon: "fa-circle-question", color: "#78716c", blurb: "No strand on profile" },
  };

  // Component fields: label, what the automatic score comes from, weight key.
  const COMPONENTS = [
    { field: "written_work_score", label: "Written work", source: "quizzes", weight: "ww", prefix: "written_work" },
    { field: "performance_task_score", label: "Performance tasks", source: "activities", weight: "pt", prefix: "performance_task" },
    { field: "quarterly_assessment_score", label: "Exam", source: "exam lessons", weight: "qa", prefix: "quarterly_assessment" },
  ];

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
    loadToken: 0,
  };

  function $(id) { return document.getElementById(id); }

  function getTeacherIdNumber() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    return u && u.id_number ? String(u.id_number).trim() : "";
  }

  function normalizeGradeLevel(raw) {
    const s = String(raw || "").trim().toLowerCase();
    const m = s.match(/\b(11|12)\b/);
    return m ? m[1] : "";
  }

  // ---------- Picker: grade tabs, strands, students ----------

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
            style="--strand-accent:${meta.color}; --strand-accent-dark:${
              typeof darkSubjectColor === "function" ? darkSubjectColor(meta.color) : meta.color
            }">
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

  function syncUrl() {
    const params = new URLSearchParams();
    if (STATE.selectedStrand) params.set("strand", STATE.selectedStrand);
    if (STATE.activeStudentIdNumber) params.set("student", STATE.activeStudentIdNumber);
    try {
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState(null, "", url.href);
    } catch (_) { /* e.g. a sandboxed or file:// copy of the page */ }
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
    STATE.editedSubjects.clear();
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
    STATE.editedSubjects.clear();
    STATE.loadToken += 1;
    $("gradecard-strand-step")?.setAttribute("hidden", "");
    $("gradecard-students-step")?.removeAttribute("hidden");
    $("gradecard-picker")?.removeAttribute("hidden");
    $("gradecard-detail-toolbar")?.setAttribute("hidden", "");
    $("gradecard-sheet")?.setAttribute("hidden", "");
    renderBreadcrumb();
    syncUrl();
  }

  function showDetailView() {
    STATE.view = "detail";
    $("gradecard-picker")?.setAttribute("hidden", "");
    $("gradecard-detail-toolbar")?.removeAttribute("hidden");
    $("gradecard-sheet")?.removeAttribute("hidden");
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
        sel.innerHTML = '<option value="">No terms yet</option>';
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      sel.innerHTML = STATE.periods
        .map((p) => {
          const isCur = p.id === STATE.currentPeriodId ? " (current)" : "";
          return `<option value="${escapeHtml(p.id)}">${escapeHtml(G.periodLabel(p) + isCur)}</option>`;
        })
        .join("");
      if (STATE.currentPeriodId) sel.value = STATE.currentPeriodId;
    } catch (err) {
      console.error("loadGradingPeriods:", err);
      sel.innerHTML = '<option value="">Couldn\'t load terms</option>';
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
      const res = await fetch(apiUrl(`/teacher/gradecard/strands?${params}`), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
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
      const res = await fetch(apiUrl(`/teacher/gradecard/students?${params}`), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
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
              <span class="gradecard-student-row-avatar">${escapeHtml(G.initials(s.display_name || idn))}</span>
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

  // ---------- Detail: the gradecard ----------

  function setSheetStatus(message, kind) {
    const box = $("gc-status");
    const body = $("gc-body");
    if (!box || !body) return;
    if (!message) {
      box.hidden = true;
      body.hidden = false;
      return;
    }
    box.className = `gc-status${kind ? ` is-${kind}` : ""}`;
    box.innerHTML = message;
    box.hidden = false;
    body.hidden = true;
  }

  function setSaveStatus(msg, kind) {
    const el = $("gradecard-save-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = `gc-save-status${kind ? ` is-${kind}` : ""}`;
  }

  function commentsChanged() {
    const el = $("gradecard-comments-text");
    if (!el || !STATE.lastData) return false;
    return String(el.value || "").trim() !== String(STATE.lastData.summary?.adviser_comments || "").trim();
  }

  function hasUnsavedChanges() {
    return STATE.editedSubjects.size > 0 || commentsChanged();
  }

  function refreshDirtyStatus() {
    const n = STATE.editedSubjects.size;
    const bits = [];
    if (n) bits.push(`${n} subject${n === 1 ? "" : "s"}`);
    if (commentsChanged()) bits.push("comments");
    if (bits.length) setSaveStatus(`Unsaved changes: ${bits.join(" and ")}.`, "dirty");
    else setSaveStatus("No changes yet.");
  }

  async function okToLeave() {
    if (!hasUnsavedChanges()) return true;
    const opts = {
      title: "Discard unsaved changes?",
      message: "You changed scores or comments that aren't saved yet.",
      confirmText: "Discard",
      cancelText: "Keep editing",
      variant: "danger",
    };
    return window.LearnIQConfirm ? window.LearnIQConfirm.show(opts) : true;
  }

  async function openStudentGradecard(studentIdNumber) {
    STATE.activeStudentIdNumber = studentIdNumber;
    showDetailView();
    await loadGradecardForStudent(studentIdNumber);
  }

  async function loadGradecardForStudent(studentIdNumber) {
    const token = ++STATE.loadToken;
    const period = $("gradecard-term-select")?.value || STATE.currentPeriodId || "";
    const params = new URLSearchParams({ student_id_number: studentIdNumber });
    if (period) params.set("period_id", period);

    STATE.editedSubjects.clear();
    setSheetStatus('<i class="fa-solid fa-spinner fa-spin"></i> Loading gradecard…', "loading");

    try {
      const res = await fetch(apiUrl(`/gradecard?${params.toString()}`), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
      const data = await res.json().catch(() => ({}));
      if (token !== STATE.loadToken) return;
      if (!res.ok) {
        const msg = escapeHtml(data?.error || `Couldn't load the gradecard (HTTP ${res.status}).`);
        setSheetStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${msg}`, "error");
        return;
      }
      STATE.lastData = data;
      setSheetStatus("");
      renderGradecard(data);
    } catch (err) {
      if (token !== STATE.loadToken) return;
      console.error("loadGradecardForStudent:", err);
      setSheetStatus(`<i class="fa-solid fa-circle-exclamation"></i> Couldn't load the gradecard: ${escapeHtml(err.message)}`, "error");
    }
  }

  // Same rule as the server: a teacher grades only the subjects they own.
  function isMine(s) {
    const me = getTeacherIdNumber();
    return !!me && s.owner_teacher_id_number === me;
  }

  function scoreField(s, comp) {
    const sid = escapeHtml(s.subject_id);
    const entered = s[`${comp.prefix}_entered`];
    const auto = s[`${comp.prefix}_auto`];
    const attempts = G.attemptsNote(s[`${comp.prefix}_attempts`]);
    const weight = G.weightNote((s.weights || {})[comp.weight]);
    const help = G.hasNumber(auto)
      ? `Auto ${G.fmtNumber(auto)} from ${comp.source}${attempts ? ` (${attempts})` : ""}`
      : `No automatic score from ${comp.source} yet`;
    return `
      <label class="gc-field">
        <span>${comp.label}<em>${escapeHtml(weight)}</em></span>
        <input type="number" class="form-input" inputmode="decimal" min="0" max="100" step="0.01"
          data-subject-id="${sid}" data-field="${comp.field}"
          value="${G.hasNumber(entered) ? escapeHtml(String(entered)) : ""}"
          placeholder="${G.hasNumber(auto) ? escapeHtml(G.fmtNumber(auto)) : "—"}" />
        <small>${escapeHtml(help)}</small>
      </label>`;
  }

  function renderEditableSubject(s, semester) {
    const sid = escapeHtml(s.subject_id);
    const computed = G.hasNumber(s.computed_final) ? G.fmtNumber(s.computed_final) : "";
    const overrideValue = s.final_is_override && G.hasNumber(s.final_grade) ? String(s.final_grade) : "";
    return `
      <details class="gc-subject gc-editable" data-subject-id="${sid}">
        ${G.subjectSummary(s).replace("</strong>", '</strong><span class="gc-dirty-tag">Unsaved changes</span>')}
        <div class="gc-breakdown">
          <div class="gc-edit-grid">
            ${COMPONENTS.map((c) => scoreField(s, c)).join("")}
          </div>
          <div class="gc-edit-row">
            <label class="gc-field">
              <span>Final grade override</span>
              <input type="number" class="form-input" inputmode="numeric" min="60" max="100" step="1"
                data-subject-id="${sid}" data-field="final_grade"
                value="${escapeHtml(overrideValue)}"
                placeholder="${computed ? `Computed: ${escapeHtml(computed)}` : "Not computed yet"}" />
              <small>Leave blank to use the computed grade.</small>
            </label>
            <label class="gc-field">
              <span>Remarks</span>
              <input type="text" class="form-input" maxlength="200"
                data-subject-id="${sid}" data-field="remarks"
                value="${escapeHtml(s.remarks || "")}"
                placeholder="Optional, e.g. Needs remediation" />
              <small>&nbsp;</small>
            </label>
          </div>
          ${G.gradeLines(s, semester)}
        </div>
      </details>`;
  }

  function renderGradecard(data) {
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const semester = data.semester || null;
    const name = G.renderHeader(data);

    let mine = subjects.filter(isMine);
    let others = subjects.filter((s) => !isMine(s));
    // Nothing of the teacher's own here: show everything read-only.
    const editable = mine.length > 0;
    if (!editable) {
      mine = [];
      others = subjects;
    }

    const body = $("gradecard-subjects-body");
    const mineTitle = $("gc-mine-title");
    const mineNote = $("gc-mine-note");
    if (body) {
      body.closest(".gc-subjects").hidden = !editable && subjects.length > 0;
      body.innerHTML = editable
        ? mine.map((s) => renderEditableSubject(s, semester)).join("")
        : `<p class="gc-empty"><i class="fa-solid fa-book-open" aria-hidden="true"></i>
             No subjects for this term. ${escapeHtml(name)} isn't enrolled in a class this semester yet.</p>`;
    }
    if (mineTitle) mineTitle.textContent = "Your subjects";
    if (mineNote) mineNote.hidden = !editable;

    const otherBox = $("gc-other-subjects");
    const otherBody = $("gc-other-body");
    if (otherBox && otherBody) {
      otherBox.hidden = others.length === 0;
      otherBox.querySelector("h3").textContent = editable ? "Other teachers' subjects" : "Subjects";
      otherBody.innerHTML = others.map((s) => G.renderSubject(s, semester)).join("");
    }

    const commentsEl = $("gradecard-comments-text");
    if (commentsEl) commentsEl.value = data.summary?.adviser_comments || "";

    // Printed copy: every subject read-only, plus the comments as notes.
    const printBody = $("gc-print-body");
    if (printBody) printBody.innerHTML = subjects.map((s) => G.renderSubject(s, semester)).join("");
    const printNotes = $("gc-print-notes");
    if (printNotes) {
      const comment = String(data.summary?.adviser_comments || "").trim();
      printNotes.innerHTML = comment
        ? `<h3>Adviser notes</h3><p class="gc-note-text">${escapeHtml(comment)}</p>`
        : "";
    }

    bindEditors();
    refreshDirtyStatus();
  }

  function bindEditors() {
    document.querySelectorAll("#gradecard-subjects-body input[data-field]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const sid = inp.getAttribute("data-subject-id");
        const field = inp.getAttribute("data-field");
        if (!sid || !field) return;
        if (!STATE.editedSubjects.has(sid)) STATE.editedSubjects.set(sid, {});
        const entry = STATE.editedSubjects.get(sid);
        if (field === "remarks") {
          entry.remarks = inp.value;
        } else {
          const v = inp.value.trim();
          entry[field] = v === "" ? null : Number(v);
        }
        inp.closest(".gc-subject")?.classList.add("is-dirty");
        refreshDirtyStatus();
      });
    });
  }

  function gradeBody(subj, edit, periodId) {
    const body = {
      student_id_number: STATE.activeStudentIdNumber,
      subject_id: String(subj.subject_id),
      grading_period_id: periodId,
    };
    // Scores: send what the teacher entered (null = use the automatic score).
    COMPONENTS.forEach((c) => {
      body[c.field] = edit[c.field] !== undefined ? edit[c.field] : (subj[`${c.prefix}_entered`] ?? null);
    });
    // Final override: only when touched. A blank box turns it off.
    if (edit.final_grade !== undefined) {
      body.final_grade = edit.final_grade;
      body.final_is_manual = edit.final_grade !== null;
    }
    if (edit.remarks !== undefined) body.remarks = edit.remarks;
    return body;
  }

  function validEdit(edit) {
    for (const c of COMPONENTS) {
      const v = edit[c.field];
      if (v !== undefined && v !== null && (Number.isNaN(v) || v < 0 || v > 100)) return `${c.label} must be 0 to 100.`;
    }
    const f = edit.final_grade;
    if (f !== undefined && f !== null && (Number.isNaN(f) || f < 60 || f > 100)) return "A final grade must be 60 to 100.";
    return "";
  }

  async function saveChanges() {
    if (!STATE.activeStudentIdNumber || !STATE.lastData) return;
    const periodId = $("gradecard-term-select")?.value || STATE.currentPeriodId;
    if (!periodId) {
      setSaveStatus("No grading period is set up.", "error");
      return;
    }
    if (!hasUnsavedChanges()) {
      setSaveStatus("No changes to save.");
      return;
    }

    const subjects = STATE.lastData.subjects || [];
    for (const subj of subjects) {
      const edit = STATE.editedSubjects.get(String(subj.subject_id));
      const problem = edit && validEdit(edit);
      if (problem) {
        setSaveStatus(`${subj.subject_name || "Subject"}: ${problem}`, "error");
        return;
      }
    }

    const btn = $("gradecard-save-remarks-btn");
    if (btn) btn.disabled = true;
    setSaveStatus("Saving…");
    const errors = [];

    for (const subj of subjects) {
      const edit = STATE.editedSubjects.get(String(subj.subject_id));
      if (!edit) continue;
      try {
        const res = await fetch(apiUrl("/student-grades"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {}),
          },
          body: JSON.stringify(gradeBody(subj, edit, periodId)),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) errors.push(`${subj.subject_name || subj.subject_id}: ${data?.error || res.status}`);
      } catch (e) {
        errors.push(`${subj.subject_name || subj.subject_id}: ${e.message}`);
      }
    }

    if (commentsChanged()) {
      try {
        const res = await fetch(apiUrl("/gradecards"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {}),
          },
          body: JSON.stringify({
            student_id_number: STATE.activeStudentIdNumber,
            grading_period_id: periodId,
            adviser_comments: String($("gradecard-comments-text")?.value || "").trim(),
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
      console.error("Save errors:", errors);
      setSaveStatus(`Couldn't save: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`, "error");
      if (typeof showToast === "function") showToast("Some changes weren't saved.", "danger");
      return;
    }
    if (typeof showToast === "function") showToast("Gradecard saved.", "success");
    await loadGradecardForStudent(STATE.activeStudentIdNumber);
    setSaveStatus("Saved. Grades are recomputed.", "ok");
  }

  // ---------- Wiring ----------

  function bindControls() {
    $("gradecard-back-strands-btn")?.addEventListener("click", showStrandsView);
    $("gradecard-back-students-btn")?.addEventListener("click", async () => {
      if (await okToLeave()) showStudentsView();
    });

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

    const termSel = $("gradecard-term-select");
    let lastTerm = termSel?.value || "";
    termSel?.addEventListener("focus", () => { lastTerm = termSel.value; });
    termSel?.addEventListener("change", async () => {
      if (!STATE.activeStudentIdNumber) return;
      if (!(await okToLeave())) {
        termSel.value = lastTerm;
        return;
      }
      lastTerm = termSel.value;
      loadGradecardForStudent(STATE.activeStudentIdNumber);
    });

    $("gradecard-comments-text")?.addEventListener("input", refreshDirtyStatus);
    $("gradecard-print-btn")?.addEventListener("click", () => window.print());
    $("gradecard-save-remarks-btn")?.addEventListener("click", saveChanges);
    G.installPrintExpand();

    window.addEventListener("beforeunload", (ev) => {
      if (STATE.view === "detail" && hasUnsavedChanges()) {
        ev.preventDefault();
        ev.returnValue = "";
      }
    });
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
// .
