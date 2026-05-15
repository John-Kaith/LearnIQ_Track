async function setupTeacherImmersionMonitor() {
  const selectEl = document.getElementById("teacher-immersion-student-select");
  const loadBtn = document.getElementById("teacher-immersion-load-btn");
  const attendanceEl = document.getElementById("teacher-immersion-attendance-body");
  const journalsEl = document.getElementById("teacher-immersion-journals");
  const metricsEl = document.getElementById("teacher-immersion-metrics");
  if (!selectEl || !loadBtn || !attendanceEl) return;

  const session = getCurrentUserSession();
  if (!session || !session.access_token) {
    window.location.href = "login.html";
    return;
  }

  const role = String(session.role || "").toLowerCase();
  if (role !== "teacher" && role !== "admin") {
    attendanceEl.innerHTML =
      `<tr><td colspan="5" class="small-note">This page is for teachers/admins.</td></tr>`;
    loadBtn.disabled = true;
    return;
  }

  const headers = { Authorization: `Bearer ${session.access_token}` };

  async function loadStudentList() {
    try {
      const res = await fetch(apiUrl("/teacher/immersion/students"), { headers });
      const data = await readApiJson(res);
      const studs = Array.isArray(data.students) ? data.students : [];
      selectEl.innerHTML =
        studs
          .map(
            (s) =>
              `<option value="${escapeHtml(String(s.id_number))}">${escapeHtml(
                `${(typeof getProfileDisplayName === "function" ? getProfileDisplayName(s) : s.display_name) || s.id_number} (${String(s.id_number)})`
              )}</option>`
          )
          .join("") || `<option value="">No approved students</option>`;
    } catch (e) {
      showToast(e?.message || "Could not load students.", "error");
      selectEl.innerHTML = `<option value="">Failed to load roster</option>`;
    }
  }

  async function renderOverview() {
    const sid = selectEl.value;
    if (!sid) return;
    const res = await fetch(
      apiUrl(`/teacher/immersion/student-overview?student_id_number=${encodeURIComponent(sid)}&limit=120`),
      { headers }
    );
    const bundle = await readApiJson(res);
    const hrs =
      bundle.total_hours_rendered != null ? Number(bundle.total_hours_rendered).toFixed(2) : "0.00";
    const nm = bundle.student?.display_name || (typeof getProfileDisplayName === "function" ? getProfileDisplayName(bundle.student) : sid) || sid;
    if (metricsEl) {
      metricsEl.innerHTML = `<strong>${escapeHtml(nm)}</strong> · rendered <strong>${escapeHtml(hrs)}</strong> hrs`;
    }
    const logs = bundle.attendance || [];
    attendanceEl.innerHTML =
      logs.length === 0
        ? `<tr><td colspan="5" class="small-note">No immersion clock sessions yet.</td></tr>`
        : logs
            .map((r) => {
              const st = String(r.status || "").toLowerCase();
              const badgeClass =
                st === "active" ? "active" : st === "completed" ? "completed" : "warning";
              const th = r.total_hours == null ? "—" : `${Number(r.total_hours).toFixed(2)}h`;
              return `
          <tr>
            <td>${escapeHtml(fmtDate(r.calendar_date || r.time_in))}</td>
            <td>${escapeHtml(fmtTime(r.time_in))}</td>
            <td>${escapeHtml(fmtTime(r.time_out))}</td>
            <td>${escapeHtml(th)}</td>
            <td><span class="status-badge ${badgeClass}">${escapeHtml(r.status || "—")}</span></td>
          </tr>`;
            })
            .join("");
    const jEntries = Array.isArray(bundle.journals) ? bundle.journals : [];
    if (journalsEl) {
      journalsEl.innerHTML =
        jEntries.length === 0
          ? `<p class="small-note">No journal entries.</p>`
          : jEntries
              .slice(0, 25)
              .map(
                (j) =>
                  `<article class="immersion-journal-entry glass-card" style="padding:0.85rem;margin-bottom:0.5rem;border-radius:14px;">
                  <div class="small-note">${escapeHtml(fmtDate(j.entry_date || j.created_at))}</div>
                  <p style="margin:0.35rem 0 0;line-height:1.45;">${escapeHtml(j.body)}</p>
                </article>`
              )
              .join("");
    }
  }

  await loadStudentList();
  loadBtn.addEventListener("click", () =>
    renderOverview().catch((e) => showToast(e?.message || "Load failed.", "error"))
  );
}
