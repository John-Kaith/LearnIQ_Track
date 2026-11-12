document.addEventListener("DOMContentLoaded", () => {
  if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();

  const yearSelect = document.getElementById("report-school-year");
  let requestSeq = 0;
  let yearOptionsReady = false;

  document.getElementById("print-reports-btn")?.addEventListener("click", () => {
    window.print();
  });

  yearSelect?.addEventListener("change", () => {
    if (!yearOptionsReady) return;
    refreshReport(yearSelect.value);
  });

  refreshReport("");

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null || value === "" ? "—" : String(value);
  }

  function setCount(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const n = Number(value);
    el.textContent = Number.isFinite(n) ? n.toLocaleString() : "0";
  }

  function setHealth(id, label) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = label ? String(label) : "—";
    el.textContent = text;
    const ok = /online|healthy/i.test(text);
    el.classList.toggle("status-online", ok && text !== "—");
    el.classList.toggle("status-warn", !ok && text !== "—");
  }

  function currentUserLabel() {
    const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    if (!user) return "System Admin";
    if (typeof getProfileDisplayName === "function") {
      const name = getProfileDisplayName(user);
      if (name) return name;
    }
    return String(user.email || "").trim() || "System Admin";
  }

  function formatGenerated(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toLocaleString();
    return d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  }

  function formatHours(value) {
    if (value == null || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  function formatScore(value) {
    if (value == null || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }

  function esc(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "");
  }

  function periodLabel(data) {
    if (!data.applied_school_year) return "All time";
    const range =
      data.period_start && data.period_end ? ` (${data.period_start} – ${data.period_end})` : "";
    return `S.Y. ${data.applied_school_year}${range}`;
  }

  function fillYearSelect(data) {
    if (!yearSelect) return;
    const years = Array.isArray(data.school_years) ? data.school_years : [];
    const applied = data.applied_school_year || "all";
    const options = ['<option value="all">All time</option>'];
    years.forEach((year) => {
      const sy = String(year.school_year || "").trim();
      if (!sy) return;
      options.push(`<option value="${esc(sy)}">S.Y. ${esc(sy)}</option>`);
    });
    yearOptionsReady = false;
    yearSelect.innerHTML = options.join("");
    const hasApplied = [...yearSelect.options].some((option) => option.value === applied);
    yearSelect.value = hasApplied ? applied : "all";
    yearOptionsReady = true;
  }

  function renderImmersion(rows) {
    const body = document.getElementById("report-immersion-body");
    const note = document.getElementById("report-immersion-note");
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6">No attendance records in this period.</td></tr>';
      if (note) note.textContent = "No attendance logs in the selected period.";
      return;
    }

    let logs = 0;
    let verified = 0;
    let flagged = 0;
    let hours = 0;
    let hoursKnown = false;
    const html = rows
      .map((row) => {
        const rowLogs = Number(row.logs) || 0;
        const rowVerified = Number(row.verified) || 0;
        const rowFlagged = Number(row.flagged) || 0;
        logs += rowLogs;
        verified += rowVerified;
        flagged += rowFlagged;
        if (row.rendered_hours != null && row.rendered_hours !== "") {
          const n = Number(row.rendered_hours);
          if (Number.isFinite(n)) {
            hours += n;
            hoursKnown = true;
          }
        }
        const kind = row.kind === "class" ? "Class" : "Immersion";
        return `<tr>
          <td>${esc(row.name || "—")}</td>
          <td>${kind}</td>
          <td>${rowLogs.toLocaleString()}</td>
          <td>${formatHours(row.rendered_hours)}</td>
          <td>${rowVerified.toLocaleString()}</td>
          <td>${rowFlagged.toLocaleString()}</td>
        </tr>`;
      })
      .join("");

    body.innerHTML = `${html}<tr class="report-total-row">
      <td colspan="2">Total</td>
      <td>${logs.toLocaleString()}</td>
      <td>${hoursKnown ? formatHours(hours) : "—"}</td>
      <td>${verified.toLocaleString()}</td>
      <td>${flagged.toLocaleString()}</td>
    </tr>`;

    if (note) {
      const hoursText = hoursKnown ? `${formatHours(hours)} rendered hours` : "rendered hours not recorded";
      note.textContent = `${logs.toLocaleString()} logs · ${hoursText} · ${verified.toLocaleString()} verified · ${flagged.toLocaleString()} flagged`;
    }
  }

  function renderAcademics(rows) {
    const body = document.getElementById("report-academic-body");
    const note = document.getElementById("report-academic-note");
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="5">No subjects in this period.</td></tr>';
      if (note) note.textContent = "No subjects to report.";
      return;
    }

    let lessons = 0;
    let quizzes = 0;
    body.innerHTML = rows
      .map((row) => {
        lessons += Number(row.published_lessons) || 0;
        quizzes += Number(row.published_quizzes) || 0;
        return `<tr>
          <td>${esc(row.subject || "—")}</td>
          <td>${esc(row.teachers || "—")}</td>
          <td>${(Number(row.published_lessons) || 0).toLocaleString()}</td>
          <td>${(Number(row.published_quizzes) || 0).toLocaleString()}</td>
          <td>${formatScore(row.average_score)}</td>
        </tr>`;
      })
      .join("");

    if (note) {
      note.textContent = `${rows.length.toLocaleString()} subjects · ${lessons.toLocaleString()} published lessons · ${quizzes.toLocaleString()} published quizzes`;
    }
  }

  function renderReport(data) {
    const summary = data.summary || {};
    const health = summary.health || {};
    setCount("report-total-users", summary.total_users);
    setCount("report-students", summary.students);
    setCount("report-teachers", summary.teachers);
    setText("report-active-label", data.active_label || "Active Today");
    setCount("report-active-today", summary.active_users);
    setCount("report-lessons", summary.total_lessons);
    setCount("report-published", summary.published_lessons);
    setCount("report-ai-content", summary.ai_quizzes);
    setHealth("report-health-db", health.database);
    setHealth("report-health-ai", health.ai_api);
    setHealth("report-health-storage", health.storage);

    const period = periodLabel(data);
    const user = currentUserLabel();
    setText("report-period-note", period);
    setText("report-print-period", period);
    setText("report-print-generated", formatGenerated(data.generated_at));
    setText("report-print-user", user);
    setText("report-print-prepared", user);
    fillYearSelect(data);
    renderImmersion(Array.isArray(data.immersion) ? data.immersion : []);
    renderAcademics(Array.isArray(data.academics) ? data.academics : []);
  }

  async function refreshReport(schoolYear) {
    const seq = ++requestSeq;
    const note = document.getElementById("report-period-note");
    if (note) note.textContent = "Loading report…";
    if (yearSelect) yearSelect.disabled = true;

    try {
      const params = new URLSearchParams();
      if (schoolYear) params.set("school_year", schoolYear);
      const qs = params.toString();
      const res = await fetch(apiUrl(`/admin/reports${qs ? `?${qs}` : ""}`), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
      const data = await res.json().catch(() => ({}));
      if (seq !== requestSeq) return;
      if (!res.ok || data.error) {
        const message = typeof data.error === "string" ? data.error : "Could not load the system report.";
        throw new Error(message);
      }
      renderReport(data);
    } catch (error) {
      if (seq !== requestSeq) return;
      console.error("admin reports:", error);
      const message = error?.message || "Could not load the system report.";
      if (note) note.textContent = message;
      const immersion = document.getElementById("report-immersion-body");
      const academics = document.getElementById("report-academic-body");
      if (immersion) immersion.innerHTML = `<tr><td colspan="6">${esc(message)}</td></tr>`;
      if (academics) academics.innerHTML = `<tr><td colspan="5">${esc(message)}</td></tr>`;
      if (typeof showToast === "function") showToast(message, "error");
    } finally {
      if (seq === requestSeq && yearSelect) yearSelect.disabled = false;
    }
  }
});
