// ============================================================
// Gradecard view pieces shared by the admin and teacher gradecard pages:
// the student header, the summary tiles, a read-only subject row with its
// breakdown, and opening every breakdown while printing.
// Expects the markup ids used in admin-student-gradecard.html.
// ============================================================

(function () {
  const PASSING_GRADE = 75;

  function $(id) { return document.getElementById(id); }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function hasNumber(v) {
    return v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
  }

  function fmtNumber(v) {
    if (!hasNumber(v)) return "—";
    return `${Math.round(Number(v) * 100) / 100}`;
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((p) => p[0].toUpperCase()).join("") || "?";
  }

  function periodLabel(p) {
    if (!p) return "";
    return [p.school_year, p.name].filter(Boolean).join(" · ");
  }

  function termName(term) {
    return term === "midterm" ? "Midterm" : term === "finals" ? "Finals" : "Term";
  }

  function subjectStatus(s) {
    if (hasNumber(s.final_grade)) {
      return Number(s.final_grade) >= PASSING_GRADE
        ? { cls: "pass", icon: "fa-circle-check", text: "Passed" }
        : { cls: "fail", icon: "fa-circle-xmark", text: "Below 75" };
    }
    const anyScore = [s.written_work_score, s.performance_task_score].some(hasNumber);
    if (anyScore && !hasNumber(s.quarterly_assessment_score)) {
      return { cls: "wait", icon: "fa-hourglass-half", text: "Needs exam" };
    }
    if (anyScore) return { cls: "wait", icon: "fa-hourglass-half", text: "Incomplete" };
    return { cls: "none", icon: "fa-minus", text: "No grades yet" };
  }

  function statusPill(s) {
    const st = subjectStatus(s);
    return `<span class="gc-pill is-${st.cls}"><i class="fa-solid ${st.icon}" aria-hidden="true"></i> ${st.text}</span>`;
  }

  function attemptsNote(attempts) {
    return hasNumber(attempts) && Number(attempts) > 0
      ? `${attempts} ${Number(attempts) === 1 ? "try" : "tries"}`
      : "";
  }

  function weightNote(weight) {
    return hasNumber(weight) ? `${Math.round(Number(weight) * 100)}% of grade` : "";
  }

  function breakdownItem(label, value, attempts, weight) {
    return `
      <div class="gc-part">
        <span>${label}</span>
        <strong>${fmtNumber(value)}</strong>
        <small>${[weightNote(weight), attemptsNote(attempts)].filter(Boolean).join(" · ") || "&nbsp;"}</small>
      </div>`;
  }

  // "Initial grade 83.45 → transmuted 89 · Very Satisfactory" and
  // "1st Semester: Midterm 94 · Finals 89 → 92"
  function gradeLines(s, semester) {
    const lines = [];
    if (hasNumber(s.final_grade)) {
      const how = s.final_is_override
        ? "Set by teacher"
        : hasNumber(s.initial_grade)
          ? `Initial grade ${fmtNumber(s.initial_grade)} → transmuted ${fmtNumber(s.final_grade)}`
          : "";
      lines.push(escapeHtml([how, s.descriptor].filter(Boolean).join(" · ")));
    }
    if (semester && s.semester_grades) {
      const parts = semester.periods.map((p) => `${termName(p.term)} ${fmtNumber(s.semester_grades[p.id])}`);
      const result = hasNumber(s.semester_grade)
        ? ` → <strong>${fmtNumber(s.semester_grade)}</strong>`
        : " (semester grade once both are in)";
      lines.push(`${escapeHtml(semester.label)}: ${parts.join(" · ")}${result}`);
    }
    return lines.filter(Boolean).map((l) => `<p class="gc-calc">${l}</p>`).join("");
  }

  function subjectSummary(s) {
    const teacher = s.teacher_name || s.teacher_id_number || "No teacher listed";
    return `
      <summary>
        <span class="gc-subject-name">
          <strong>${escapeHtml(s.subject_name || "Subject")}</strong>
          <small>${escapeHtml(teacher)}</small>
        </span>
        <span class="gc-final">${fmtNumber(s.final_grade)}</span>
        ${statusPill(s)}
        <i class="fa-solid fa-chevron-down gc-caret" aria-hidden="true"></i>
      </summary>`;
  }

  function renderSubject(s, semester) {
    const weights = s.weights || {};
    const remarks = s.remarks ? `<p class="gc-remark"><span>Remarks:</span> ${escapeHtml(s.remarks)}</p>` : "";
    const comment = s.teacher_comments ? `<p class="gc-remark"><span>Teacher:</span> ${escapeHtml(s.teacher_comments)}</p>` : "";
    return `
      <details class="gc-subject">
        ${subjectSummary(s)}
        <div class="gc-breakdown">
          <div class="gc-parts">
            ${breakdownItem("Written work", s.written_work_score, s.written_work_attempts, weights.ww)}
            ${breakdownItem("Performance tasks", s.performance_task_score, s.performance_task_attempts, weights.pt)}
            ${breakdownItem("Exam", s.quarterly_assessment_score, s.quarterly_assessment_attempts, weights.qa)}
          </div>
          ${gradeLines(s, semester)}${remarks}${comment}
        </div>
      </details>`;
  }

  /** Student header, summary tiles and print header. */
  function renderHeader(data) {
    const student = data.student || {};
    const adviser = data.adviser || null;
    const period = data.period || {};
    const summary = data.summary || {};
    const semester = data.semester || null;

    const name = student.display_name || student.first_name || student.id_number || "—";
    setText("gradecard-avatar", initials(name));
    setText("gradecard-student-name", name);
    setText("gradecard-student-meta", [
      student.id_number ? `ID ${student.id_number}` : null,
      student.grade_level ? `Grade ${student.grade_level}` : null,
      student.strand || null,
      student.section ? `Section ${student.section}` : null,
      `Adviser: ${adviser?.display_name || "none yet"}`,
    ].filter(Boolean).join(" · "));
    setText("gc-term-tag", periodLabel(period));
    setText("gc-print-term", `Official Student Gradecard · ${periodLabel(period)}`);
    setText("gradecard-ref", summary.reference_no || "—");

    setText("gc-term-avg-label", `${termName(period.term)} average`);
    setText("gradecard-gpa", fmtNumber(summary.general_average));
    setText("gc-term-avg-note", summary.descriptor || "");

    const semStat = $("gc-sem-stat");
    if (semStat) semStat.hidden = !semester;
    if (semester) {
      setText("gc-sem-label", `${semester.label} average`);
      setText("gc-sem-avg", fmtNumber(semester.general_average));
      setText("gc-sem-note", semester.complete
        ? (semester.descriptor || "")
        : "When every subject has Midterm and Finals grades");
    }
    // The semester's standing is the official one once it's complete.
    const standing = semester?.complete && semester.standing ? semester.standing : summary.standing;
    setText("gradecard-standing", standing && standing !== "—" ? standing : "—");
    setText("gc-standing-note", semester?.complete
      ? `Based on the ${semester.label.toLowerCase()}`
      : `Based on ${termName(period.term)} so far`);

    const present = Number(summary.days_present) || 0;
    const absent = Number(summary.days_absent) || 0;
    if (present + absent > 0) {
      setText("gc-attendance", `${Math.round((present / (present + absent)) * 100)}%`);
      setText("gc-attendance-note", `${present} present · ${absent} absent`);
    } else {
      setText("gc-attendance", "—");
      setText("gc-attendance-note", "No attendance yet");
    }
    return name;
  }

  /** A printed gradecard shows every subject's breakdown, then folds back. */
  function installPrintExpand() {
    let opened = [];
    window.addEventListener("beforeprint", () => {
      opened = Array.from(document.querySelectorAll(".gc-subject:not([open])"));
      opened.forEach((d) => { d.open = true; });
    });
    window.addEventListener("afterprint", () => {
      opened.forEach((d) => { d.open = false; });
      opened = [];
    });
  }

  window.LearnIQGradecard = {
    PASSING_GRADE,
    hasNumber,
    fmtNumber,
    initials,
    periodLabel,
    termName,
    subjectStatus,
    statusPill,
    attemptsNote,
    weightNote,
    gradeLines,
    subjectSummary,
    renderSubject,
    renderHeader,
    installPrintExpand,
  };
})();
// .
