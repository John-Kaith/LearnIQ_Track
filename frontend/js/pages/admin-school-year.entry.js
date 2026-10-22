// ============================================================
// Admin School Year page
// Shows today's grading period, lets the admin set each semester's three
// dates (start, last day of Midterm, last day of the semester) and makes or
// previews next school year, which is otherwise created automatically.
// ============================================================

(function () {
  const STATE = {
    data: null,
    selected: null, // school_year string being edited
  };

  function $(id) { return document.getElementById(id); }

  function authHeaders(extra) {
    return {
      ...(typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {}),
      ...(extra || {}),
    };
  }

  function parseDay(iso) {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  }

  function fmtDay(iso, withYear) {
    const d = parseDay(iso);
    if (!d) return "—";
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
  }

  function addDays(iso, n) {
    const d = parseDay(iso);
    if (!d) return "";
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function weeksBetween(a, b) {
    const da = parseDay(a);
    const db = parseDay(b);
    if (!da || !db || db < da) return null;
    return Math.round(((db - da) / 86400000 + 1) / 7);
  }

  function setStatus(msg, kind) {
    const el = $("sy-status");
    if (!el) return;
    el.textContent = msg || "";
    el.className = `sy-status${kind ? ` is-${kind}` : ""}`;
  }

  // ---------- Loading ----------

  async function load(keepSelection) {
    try {
      const res = await fetch(apiUrl("/admin/school-years"), { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.data = data;
      const years = data.school_years || [];
      const current = data.current_period?.school_year;
      if (!keepSelection || !years.some((y) => y.school_year === STATE.selected)) {
        STATE.selected = years.some((y) => y.school_year === current) ? current : years[0]?.school_year || null;
      }
      render();
    } catch (err) {
      console.error("school years:", err);
      $("sy-now").innerHTML = `<p class="sy-error"><i class="fa-solid fa-circle-exclamation"></i> Couldn't load the school years: ${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------- Rendering ----------

  function render() {
    renderNow();
    renderForm();
    renderNext();
  }

  function renderNow() {
    const box = $("sy-now");
    const p = STATE.data?.current_period;
    if (!p) {
      box.innerHTML = '<p class="sy-muted">No grading periods yet. Set the dates below to start.</p>';
      return;
    }
    const review = STATE.data.needs_review || [];
    box.innerHTML = `
      <div class="sy-now-row">
        <span class="sy-now-icon" aria-hidden="true"><i class="fa-solid fa-calendar-check"></i></span>
        <div>
          <span class="sy-label">Today</span>
          <strong>${escapeHtml(p.name || "—")}</strong>
          <span class="sy-muted">S.Y. ${escapeHtml(p.school_year || "—")} · ${escapeHtml(fmtDay(p.start_date))} – ${escapeHtml(fmtDay(p.end_date, true))}</span>
        </div>
      </div>
      ${review.length ? `<p class="sy-review-note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        Please check the dates of S.Y. ${review.map(escapeHtml).join(", ")}.</p>` : ""}`;
  }

  function semesterBlock(sem) {
    const n = sem.semester;
    return `
      <fieldset class="sy-sem" data-semester="${n}">
        <legend>${escapeHtml(sem.label || `Semester ${n}`)}</legend>
        <div class="sy-dates">
          <label class="sy-field">
            <span>Starts</span>
            <input type="date" class="form-input" data-key="start" value="${escapeHtml(sem.start || "")}" required />
          </label>
          <label class="sy-field">
            <span>Midterm ends</span>
            <input type="date" class="form-input" data-key="midterm_end" value="${escapeHtml(sem.midterm_end || "")}" required />
          </label>
          <label class="sy-field">
            <span>Semester ends</span>
            <input type="date" class="form-input" data-key="end" value="${escapeHtml(sem.end || "")}" required />
          </label>
        </div>
        <p class="sy-preview" data-preview></p>
      </fieldset>`;
  }

  function renderForm() {
    const form = $("sy-form");
    const years = STATE.data?.school_years || [];
    let sy = years.find((y) => y.school_year === STATE.selected);
    if (!sy) {
      // Nothing on file yet: start a blank school year for this calendar year.
      const y = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
      sy = {
        school_year: `${y}-${y + 1}`,
        dates_confirmed: true,
        semesters: [
          { semester: 1, label: "1st Semester" },
          { semester: 2, label: "2nd Semester" },
        ],
      };
      STATE.selected = sy.school_year;
    }
    form.hidden = false;
    $("sy-form-title").textContent = `S.Y. ${sy.school_year}`;

    const pick = $("sy-year-pick");
    const sel = $("sy-year-select");
    pick.hidden = years.length < 2;
    sel.innerHTML = years
      .map((y) => `<option value="${escapeHtml(y.school_year)}">S.Y. ${escapeHtml(y.school_year)}${y.dates_confirmed ? "" : " (check dates)"}</option>`)
      .join("");
    sel.value = sy.school_year;

    $("sy-review").hidden = !!sy.dates_confirmed;
    $("sy-semesters").innerHTML = sy.semesters.map(semesterBlock).join("");
    form.querySelectorAll("input[type=date]").forEach((inp) => inp.addEventListener("input", () => {
      updatePreviews();
      setStatus("Not saved yet.", "dirty");
    }));
    updatePreviews();
    setStatus("");
  }

  function readSemesters() {
    return Array.from(document.querySelectorAll(".sy-sem")).map((fs) => {
      const val = (k) => fs.querySelector(`[data-key="${k}"]`)?.value || "";
      return {
        semester: Number(fs.getAttribute("data-semester")),
        start: val("start"),
        midterm_end: val("midterm_end"),
        end: val("end"),
      };
    });
  }

  function updatePreviews() {
    document.querySelectorAll(".sy-sem").forEach((fs) => {
      const val = (k) => fs.querySelector(`[data-key="${k}"]`)?.value || "";
      const start = val("start");
      const midEnd = val("midterm_end");
      const end = val("end");
      const out = fs.querySelector("[data-preview]");
      if (!(start && midEnd && end)) {
        out.textContent = "Fill in all three dates.";
        out.className = "sy-preview";
        return;
      }
      const finalsStart = addDays(midEnd, 1);
      const ok = start <= midEnd && midEnd < end;
      const mw = weeksBetween(start, midEnd);
      const fw = weeksBetween(finalsStart, end);
      out.className = `sy-preview${ok ? "" : " is-error"}`;
      out.textContent = ok
        ? `Midterm: ${fmtDay(start)} – ${fmtDay(midEnd)} (${mw} wk) · Finals: ${fmtDay(finalsStart)} – ${fmtDay(end, true)} (${fw} wk)`
        : "Midterm must end after the semester starts and before it ends.";
    });
  }

  function renderNext() {
    const box = $("sy-next");
    const data = STATE.data || {};
    const plan = data.next_plan;
    const years = data.school_years || [];
    if (!plan) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const exists = years.some((y) => y.school_year === plan.school_year);
    if (exists) {
      box.innerHTML = `
        <h2>S.Y. ${escapeHtml(plan.school_year)}</h2>
        <p class="sy-muted">Ready. Pick it in the school year list above to check its dates.</p>`;
      return;
    }
    const latest = years.find((y) => y.end) || {};
    const autoOn = latest.end ? fmtDay(addDays(latest.end, 1), true) : "the day after this school year ends";
    const s1 = plan.semesters[0] || {};
    box.innerHTML = `
      <div class="sy-next-row">
        <div>
          <h2>Next: S.Y. ${escapeHtml(plan.school_year)}</h2>
          <p class="sy-muted">Made automatically on <strong>${escapeHtml(autoOn)}</strong>, using this year's dates one year later
            (1st Semester from ${escapeHtml(fmtDay(s1.start, true))}). You'll be asked to check them.</p>
        </div>
        <button type="button" class="btn btn-secondary" id="sy-create-next">
          <i class="fa-solid fa-calendar-plus"></i> Make it now
        </button>
      </div>`;
    $("sy-create-next")?.addEventListener("click", createNext);
  }

  // ---------- Actions ----------

  async function save(ev) {
    ev.preventDefault();
    const btn = $("sy-save-btn");
    btn.disabled = true;
    setStatus("Saving…");
    try {
      const res = await fetch(apiUrl(`/admin/school-years/${encodeURIComponent(STATE.selected)}`), {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ semesters: readSemesters() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load(true);
      setStatus("Saved. The current period now follows these dates.", "ok");
      if (typeof showToast === "function") showToast("School year dates saved.", "success");
    } catch (err) {
      setStatus(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function createNext() {
    const plan = STATE.data?.next_plan;
    if (!plan) return;
    const ok = window.LearnIQConfirm
      ? await window.LearnIQConfirm.show({
        title: `Make S.Y. ${plan.school_year} now?`,
        message: "Its dates are copied from this school year, one year later. You can change them after.",
        confirmText: "Make it",
        cancelText: "Cancel",
      })
      : true;
    if (!ok) return;
    try {
      const res = await fetch(apiUrl("/admin/school-years/next"), { method: "POST", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      STATE.selected = plan.school_year;
      await load(true);
      if (typeof showToast === "function") showToast(`S.Y. ${plan.school_year} is ready. Check its dates.`, "success");
    } catch (err) {
      if (typeof showToast === "function") showToast(err.message, "danger");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();
    $("sy-form")?.addEventListener("submit", save);
    $("sy-year-select")?.addEventListener("change", (ev) => {
      STATE.selected = ev.target.value;
      renderForm();
    });
    load(false);
  });
})();
// .
