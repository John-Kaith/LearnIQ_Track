// ============================================================
// Admin Student Gradecard
// Step 1: pick a student (search by name or ID, with suggestions).
// Step 2: a simple gradecard — final grade + status per subject, with the
// WW / PT / Exam breakdown one tap away. Print adds the official header,
// reference number and signature lines.
// ============================================================

(function () {
  const G = window.LearnIQGradecard;
  const MAX_RESULTS = 8;

  const STATE = {
    periods: [],
    currentPeriodId: null,
    students: [],
    studentsStatus: "loading", // loading | ok | error
    matches: [],
    activeIndex: -1,
    activeStudentIdNumber: null,
    loadToken: 0,
  };

  function $(id) { return document.getElementById(id); }

  function studentName(u) {
    if (typeof getProfileDisplayName === "function") {
      const n = getProfileDisplayName(u);
      if (n) return n;
    }
    return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.id_number || "Student";
  }

  function studentMetaBits(u) {
    return [
      u.id_number || null,
      u.grade_level ? `Grade ${u.grade_level}` : null,
      [u.strand, u.section].filter(Boolean).join("-") || null,
    ].filter(Boolean);
  }

  // ---------- Terms ----------

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
          const cur = p.id === STATE.currentPeriodId ? " (current)" : "";
          return `<option value="${escapeHtml(p.id)}">${escapeHtml(G.periodLabel(p) + cur)}</option>`;
        })
        .join("");
      const wanted = new URLSearchParams(location.search).get("period");
      sel.value = STATE.periods.some((p) => p.id === wanted) ? wanted : (STATE.currentPeriodId || "");
    } catch (err) {
      console.error("loadGradingPeriods:", err);
      sel.innerHTML = '<option value="">Couldn\'t load terms</option>';
      sel.disabled = true;
    }
  }

  // ---------- Step 1: student search ----------

  async function loadStudents() {
    try {
      const res = await fetch(apiUrl("/users"), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const users = await res.json();
      STATE.students = (Array.isArray(users) ? users : [])
        .filter((u) => String(u.role || "").toLowerCase() === "student" && u.id_number)
        .map((u) => {
          const name = studentName(u);
          return {
            id_number: String(u.id_number).trim(),
            name,
            meta: studentMetaBits(u).join(" · "),
            search: `${name} ${u.first_name || ""} ${u.last_name || ""} ${u.id_number}`.toLowerCase(),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      STATE.studentsStatus = "ok";
    } catch (err) {
      console.error("loadStudents:", err);
      STATE.studentsStatus = "error";
    }
    renderResults();
  }

  function findMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    const hits = STATE.students.filter((s) => words.every((w) => s.search.includes(w)));
    const rank = (s) => {
      if (s.id_number.toLowerCase() === q) return 0;
      if (s.name.toLowerCase().startsWith(q) || s.id_number.toLowerCase().startsWith(q)) return 1;
      return 2;
    };
    return hits.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }

  function renderResults() {
    const input = $("gradecard-search-input");
    const list = $("gc-results");
    const hint = $("gc-hint");
    if (!input || !list || !hint) return;
    const q = input.value.trim();

    if (STATE.studentsStatus !== "ok") {
      STATE.matches = [];
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      if (q) hint.textContent = "Press Enter to open this ID number.";
      else if (STATE.studentsStatus === "loading") hint.textContent = "Loading students…";
      else hint.textContent = "Couldn't load the student list. Type the full ID number and press Enter.";
      return;
    }

    STATE.matches = findMatches(q);
    if (!q) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      hint.textContent = `Search ${STATE.students.length} student${STATE.students.length === 1 ? "" : "s"} by name or ID number.`;
      return;
    }
    if (!STATE.matches.length) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      hint.textContent = `No student matches “${q}”.`;
      return;
    }

    const shown = STATE.matches.slice(0, MAX_RESULTS);
    if (STATE.activeIndex >= shown.length) STATE.activeIndex = shown.length - 1;
    if (STATE.activeIndex < 0) STATE.activeIndex = 0;
    list.innerHTML = shown
      .map((s, i) => `
        <li role="option" id="gc-opt-${i}" class="gc-result${i === STATE.activeIndex ? " is-active" : ""}"
            aria-selected="${i === STATE.activeIndex}" data-id="${escapeHtml(s.id_number)}">
          <span class="gc-result-avatar" aria-hidden="true">${escapeHtml(G.initials(s.name))}</span>
          <span class="gc-result-text">
            <strong>${escapeHtml(s.name)}</strong>
            <small>${escapeHtml(s.meta)}</small>
          </span>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </li>`)
      .join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", `gc-opt-${STATE.activeIndex}`);
    const more = STATE.matches.length - shown.length;
    hint.textContent = more > 0
      ? `Showing ${shown.length} of ${STATE.matches.length}. Keep typing to narrow it down.`
      : `${STATE.matches.length} match${STATE.matches.length === 1 ? "" : "es"}.`;
  }

  function onSearchKey(ev) {
    const shown = Math.min(STATE.matches.length, MAX_RESULTS);
    if (ev.key === "ArrowDown" && shown) {
      ev.preventDefault();
      STATE.activeIndex = (STATE.activeIndex + 1) % shown;
      renderResults();
    } else if (ev.key === "ArrowUp" && shown) {
      ev.preventDefault();
      STATE.activeIndex = (STATE.activeIndex - 1 + shown) % shown;
      renderResults();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const raw = ev.currentTarget.value.trim();
      if (!raw) return;
      const pick = STATE.matches[STATE.activeIndex] || STATE.matches[0];
      // Without the student list (or no match), try the text as an ID number.
      openStudent(pick ? pick.id_number : raw);
    } else if (ev.key === "Escape") {
      ev.currentTarget.value = "";
      STATE.activeIndex = 0;
      renderResults();
    }
  }

  // ---------- Switching between the two steps ----------

  function moveTermSelect(slotId) {
    const field = $("gc-term-field");
    const slot = $(slotId);
    if (field && slot && field.parentElement !== slot) slot.appendChild(field);
  }

  function showPicker() {
    STATE.activeStudentIdNumber = null;
    STATE.loadToken += 1;
    moveTermSelect("gc-term-slot-picker");
    $("gc-picker").hidden = false;
    $("gc-toolbar").hidden = true;
    $("gradecard-sheet").hidden = true;
    syncUrl();
    const input = $("gradecard-search-input");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function showReport() {
    moveTermSelect("gc-term-slot-report");
    $("gc-picker").hidden = true;
    $("gc-toolbar").hidden = false;
    $("gradecard-sheet").hidden = false;
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (STATE.activeStudentIdNumber) {
      params.set("student", STATE.activeStudentIdNumber);
      const period = $("gradecard-term-select")?.value;
      if (period) params.set("period", period);
    }
    // Keeps the open student on refresh; never worth breaking the page over.
    try {
      const url = new URL(location.href);
      url.search = params.toString();
      history.replaceState(null, "", url.href);
    } catch (_) { /* e.g. a sandboxed or file:// copy of the page */ }
  }

  function setStatus(message, kind) {
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

  // ---------- Step 2: the gradecard ----------

  async function openStudent(studentIdNumber) {
    STATE.activeStudentIdNumber = studentIdNumber;
    showReport();
    syncUrl();
    await loadGradecard();
  }

  async function loadGradecard() {
    const sid = STATE.activeStudentIdNumber;
    if (!sid) return;
    const token = ++STATE.loadToken;
    const period = $("gradecard-term-select")?.value || STATE.currentPeriodId || "";
    const params = new URLSearchParams({ student_id_number: sid });
    if (period) params.set("period_id", period);

    setStatus('<i class="fa-solid fa-spinner fa-spin"></i> Loading gradecard…', "loading");
    try {
      const res = await fetch(apiUrl(`/gradecard?${params.toString()}`), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
      const data = await res.json().catch(() => ({}));
      if (token !== STATE.loadToken) return;
      if (!res.ok) {
        const msg = res.status === 404 || /not found/i.test(data?.error || "")
          ? `No student with ID number <strong>${escapeHtml(sid)}</strong>.`
          : escapeHtml(data?.error || `Couldn't load the gradecard (HTTP ${res.status}).`);
        setStatus(`<i class="fa-solid fa-circle-exclamation"></i> ${msg}`, "error");
        return;
      }
      setStatus("");
      renderGradecard(data);
    } catch (err) {
      if (token !== STATE.loadToken) return;
      console.error("loadGradecard:", err);
      setStatus(`<i class="fa-solid fa-circle-exclamation"></i> Couldn't load the gradecard: ${escapeHtml(err.message)}`, "error");
    }
  }

  function renderNotes(summary) {
    const box = $("gc-notes");
    if (!box) return;
    const bits = [];
    if (summary.conduct) bits.push(`<span><em>Conduct</em> ${escapeHtml(summary.conduct)}</span>`);
    if (G.hasNumber(summary.times_tardy) && Number(summary.times_tardy) > 0) {
      bits.push(`<span><em>Tardy</em> ${G.fmtNumber(summary.times_tardy)}×</span>`);
    }
    const comment = summary.adviser_comments && String(summary.adviser_comments).trim();
    if (!bits.length && !comment) {
      box.innerHTML = '<h3>Adviser notes</h3><p class="gc-muted">No adviser notes for this term.</p>';
      return;
    }
    box.innerHTML = `
      <h3>Adviser notes</h3>
      ${bits.length ? `<p class="gc-note-line">${bits.join("")}</p>` : ""}
      ${comment ? `<p class="gc-note-text">${escapeHtml(comment)}</p>` : ""}`;
  }

  function renderGradecard(data) {
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const semester = data.semester || null;
    const name = G.renderHeader(data);
    const body = $("gradecard-subjects-body");
    if (body) {
      body.innerHTML = subjects.length
        ? subjects.map((s) => G.renderSubject(s, semester)).join("")
        : `<p class="gc-empty"><i class="fa-solid fa-book-open" aria-hidden="true"></i>
             No subjects for this term. ${escapeHtml(name)} isn't enrolled in a class this semester yet.</p>`;
    }
    renderNotes(data.summary || {});
  }

  // ---------- Wiring ----------

  function bindControls() {
    const input = $("gradecard-search-input");
    input?.addEventListener("input", () => {
      STATE.activeIndex = 0;
      renderResults();
    });
    input?.addEventListener("keydown", onSearchKey);

    $("gc-results")?.addEventListener("click", (ev) => {
      const li = ev.target.closest(".gc-result");
      if (li?.dataset.id) openStudent(li.dataset.id);
    });

    $("gradecard-term-select")?.addEventListener("change", () => {
      if (STATE.activeStudentIdNumber) {
        syncUrl();
        loadGradecard();
      }
    });

    $("gc-change-btn")?.addEventListener("click", showPicker);
    $("gradecard-print-btn")?.addEventListener("click", () => window.print());
    G.installPrintExpand();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();
    bindControls();
    await loadGradingPeriods();
    const linked = new URLSearchParams(location.search).get("student");
    if (linked) {
      openStudent(linked);
      loadStudents();
    } else {
      showPicker();
      await loadStudents();
    }
  });
})();
// .
