// ============================================================
// Teacher Student Gradecard
// - Fetch gradecard for a student
// - Lets the teacher save per-subject final grades + remarks
//   (POST /student-grades) and overall teacher comments via the
//   "Save remarks" button.
// ============================================================

(function () {
  const STATE = {
    periods: [],
    currentPeriodId: null,
    activeStudentIdNumber: null,
    lastData: null,        // last full gradecard payload
    editedSubjects: new Map(), // subject_id -> { final_grade, remarks, teacher_comments }
  };

  function $(id) { return document.getElementById(id); }
  function setText(id, value) { const el = $(id); if (el) el.textContent = value; }

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
    el.style.color = kind === "danger" ? "#fca5a5"
      : kind === "success" ? "#34d399"
      : "";
  }

  function renderEmptyState(text) {
    const body = $("gradecard-subjects-body");
    if (body) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-id-card"></i>
            <p>${escapeHtml(text || "Search for a student above to load their gradecard.")}</p>
            <p class="small-note">Type the school ID number or full name then press Enter.</p>
          </td>
        </tr>`;
    }
  }

  // ---------- Loaders ----------

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
      STATE.activeStudentIdNumber = studentIdNumber;
      STATE.lastData = data;
      renderGradecard(data);
    } catch (err) {
      console.error("loadGradecardForStudent:", err);
      renderEmptyState(`Failed to load: ${err.message}`);
    }
  }

  // ---------- Renderer ----------

  function renderGradecard(data) {
    const student = data.student || {};
    const adviser = data.adviser || null;
    const summary = data.summary || {};
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    // Filter subjects: teacher only sees subjects they teach (best-effort match
    // on teacher_id_number against the signed-in user). For now we keep all
    // subjects visible — wire later when we have the teacher's id_number in
    // session.
    const subjectsForTeacher = subjects;

    setText("gradecard-ref", summary.reference_no || "GR-XXXX-XXXX");
    const av = $("gradecard-avatar");
    if (av) av.textContent = initials(student.full_name);
    setText("gradecard-student-name", student.full_name || "—");

    const metaBits = [
      student.id_number ? `ID No. ${student.id_number}` : null,
      student.grade_level ? `Grade ${student.grade_level}` : null,
      student.strand || null,
      student.section ? `Section ${student.section}` : null,
    ].filter(Boolean);
    setText("gradecard-student-meta", metaBits.join(" · ") || "—");

    setText(
      "gradecard-student-adviser",
      `Adviser: ${adviser?.full_name || "—"}`
    );

    setText("gradecard-gpa", fmtNumber(summary.general_average));
    setText("gradecard-standing", summary.standing || "—");
    setText("gradecard-conduct", summary.conduct || "—");
    setText("gradecard-days-present", fmtNumber(summary.days_present));
    setText("gradecard-days-absent", fmtNumber(summary.days_absent));
    setText("gradecard-tardy", fmtNumber(summary.times_tardy));

    // Teacher comments textarea (overall student comments — re-uses adviser_comments
    // field for the template view).
    const commentsEl = $("gradecard-comments-text");
    if (commentsEl) {
      commentsEl.value = summary.adviser_comments || "";
    }

    const body = $("gradecard-subjects-body");
    if (!body) return;

    if (!subjectsForTeacher.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <i class="fa-solid fa-id-card"></i>
            <p>No subject activity recorded for <strong>${escapeHtml(student.full_name || student.id_number || "this student")}</strong> in this period.</p>
            <p class="small-note">Wait for them to submit quizzes/activities, or enroll them in your subject.</p>
          </td>
        </tr>`;
      return;
    }

    body.innerHTML = subjectsForTeacher
      .map((s) => {
        const sid = escapeHtml(s.subject_id);
        const finalVal = s.final_grade == null ? "" : String(s.final_grade);
        const remarks = s.remarks || "";
        return `
          <tr data-subject-id="${sid}">
            <td><strong>${escapeHtml(s.subject_name || "Subject")}</strong></td>
            <td class="num">${s.quiz_attempts || 0}</td>
            <td class="num">${fmtNumber(s.quiz_average)}</td>
            <td class="num">${s.activity_attempts || 0}<br /><span class="small-note">avg ${fmtNumber(s.activity_average)}</span></td>
            <td class="num">${fmtPercent(s.attendance_percent)}</td>
            <td class="num">
              <input
                type="number"
                class="form-input gradecard-final-input"
                data-field="final_grade"
                data-subject-id="${sid}"
                min="0" max="100" step="0.1"
                value="${escapeHtml(finalVal)}"
                placeholder="${fmtNumber(s.final_grade)}"
                style="width: 80px; text-align:center;" />
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

    // Wire input change tracking
    body.querySelectorAll("input.gradecard-final-input, input.gradecard-remarks-input").forEach((inp) => {
      inp.addEventListener("input", () => {
        const sid = inp.getAttribute("data-subject-id");
        const field = inp.getAttribute("data-field");
        if (!sid || !field) return;
        if (!STATE.editedSubjects.has(sid)) STATE.editedSubjects.set(sid, {});
        const entry = STATE.editedSubjects.get(sid);
        if (field === "final_grade") {
          const v = inp.value.trim();
          entry.final_grade = v === "" ? null : Number(v);
        } else {
          entry.remarks = inp.value;
        }
      });
    });
  }

  // ---------- Save ----------

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

    // Save per-subject overrides only for subjects the teacher changed.
    for (const subj of subjects) {
      const sid = String(subj.subject_id);
      const edit = STATE.editedSubjects.get(sid);
      if (!edit) continue;

      const body = {
        student_id_number: STATE.activeStudentIdNumber,
        subject_id: sid,
        grading_period_id: periodId,
        teacher_id_number: subj.teacher_id_number || null,
        final_grade: edit.final_grade !== undefined ? edit.final_grade : subj.final_grade,
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

    // Save overall comments on gradecards.adviser_comments
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

    // Reload to reflect any computed values that changed
    await loadGradecardForStudent(STATE.activeStudentIdNumber);
  }

  // ---------- Controls ----------

  function handleSearchSubmit() {
    const input = $("gradecard-search-input");
    if (!input) return;
    const raw = String(input.value || "").trim();
    if (!raw) {
      renderEmptyState();
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
      if (STATE.activeStudentIdNumber) loadGradecardForStudent(STATE.activeStudentIdNumber);
    });
    $("gradecard-subject-select")?.addEventListener("change", () => {
      if (STATE.activeStudentIdNumber) loadGradecardForStudent(STATE.activeStudentIdNumber);
    });

    $("gradecard-print-btn")?.addEventListener("click", () => window.print());
    $("gradecard-save-remarks-btn")?.addEventListener("click", saveRemarks);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindControls();
    renderEmptyState();
    await loadGradingPeriods();
  });
})();
