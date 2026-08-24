// Admin Settings — Manage Sections (fixed list, e.g. "STEM 12-A") + assign
// a section to students who don't have one yet. Sections are the source of
// truth the registration form's dropdown reads from.

(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return typeof escapeHtml === "function" ? escapeHtml(s) : String(s ?? "");
  }

  function authHeaders(json) {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const h = json ? { "Content-Type": "application/json" } : {};
    if (u?.access_token) h.Authorization = `Bearer ${u.access_token}`;
    return h;
  }

  async function loadSections() {
    const list = $("admin-sections-list");
    if (!list) return;
    try {
      const res = await fetch(apiUrl("/sections"));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load sections.");
      const sections = Array.isArray(data.sections) ? data.sections : [];
      if (!sections.length) {
        list.innerHTML = `<p class="empty-state">No sections yet. Add one above.</p>`;
        return;
      }
      // Group by strand, then grade, for easy scanning.
      const groups = {};
      for (const s of sections) {
        const key = `${s.strand} · Grade ${s.grade_level}`;
        (groups[key] ||= []).push(s);
      }
      list.innerHTML = Object.entries(groups)
        .map(
          ([label, rows]) => `
        <div class="admin-sections-group">
          <h4 class="class-attendance-group-head">${esc(label)}</h4>
          ${rows
            .map(
              (s) => `
            <div class="admin-sections-row" data-section-id="${esc(s.id)}">
              <span>${esc(s.name)}</span>
              <button type="button" class="btn btn-ghost btn-sm admin-section-delete-btn" data-section-id="${esc(s.id)}" aria-label="Delete ${esc(s.name)}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>`
            )
            .join("")}
        </div>`
        )
        .join("");
      list.querySelectorAll(".admin-section-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => void deleteSection(btn.getAttribute("data-section-id")));
      });
      // cache for the assign-dropdowns below
      window.__ADMIN_SECTIONS_CACHE = sections;
    } catch (e) {
      list.innerHTML = `<p class="empty-state">${esc(e.message)}</p>`;
    }
  }

  async function addSection(ev) {
    ev.preventDefault();
    const name = $("as-section-name")?.value.trim();
    const gradeLevel = $("as-section-grade")?.value;
    const strand = $("as-section-strand")?.value;
    if (!name || !gradeLevel || !strand) return;
    const submitBtn = ev.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch(apiUrl("/admin/sections"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ name, grade_level: gradeLevel, strand }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add section.");
      $("as-section-name").value = "";
      $("as-section-grade").value = "";
      $("as-section-strand").value = "";
      if (typeof showToast === "function") showToast("Section added.", "success");
      await loadSections();
    } catch (e) {
      if (typeof showToast === "function") showToast(e.message, "error");
      else alert(e.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function deleteSection(sectionId) {
    if (!sectionId) return;
    const ok =
      window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function"
        ? await window.LearnIQConfirm.show({
            title: "Delete this section?",
            message: "Students already assigned to it keep the name on their profile, but it won't be selectable at registration anymore.",
            confirmText: "Delete",
            variant: "danger",
          })
        : window.confirm("Delete this section?");
    if (!ok) return;
    try {
      const res = await fetch(apiUrl(`/admin/sections/${encodeURIComponent(sectionId)}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete section.");
      if (typeof showToast === "function") showToast("Section deleted.", "success");
      await loadSections();
    } catch (e) {
      if (typeof showToast === "function") showToast(e.message, "error");
      else alert(e.message);
    }
  }

  function sectionOptionsFor(student) {
    const all = window.__ADMIN_SECTIONS_CACHE || [];
    const matching = all.filter(
      (s) => s.grade_level === String(student.grade_level || "") && s.strand === student.strand
    );
    const pool = matching.length ? matching : all;
    if (!pool.length) return `<option value="">No sections available</option>`;
    return (
      `<option value="">Select section…</option>` +
      pool.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("")
    );
  }

  async function loadStudentsWithoutSection() {
    const list = $("admin-no-section-list");
    const note = $("admin-no-section-count-note");
    if (!list) return;
    try {
      const res = await fetch(apiUrl("/admin/students-without-section"), {
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load students.");
      const students = Array.isArray(data.students) ? data.students : [];
      if (note) {
        note.textContent = students.length
          ? `${students.length} student${students.length === 1 ? "" : "s"} need a section assigned.`
          : "Every student has a section assigned.";
      }
      if (!students.length) {
        list.innerHTML = "";
        return;
      }
      list.innerHTML = students
        .map(
          (s) => `
        <div class="admin-sections-row admin-assign-row" data-id-number="${esc(s.id_number)}">
          <span>${esc(s.display_name || s.id_number)} <span class="small-note">· ${esc(s.grade_level || "?")} ${esc(s.strand || "")}</span></span>
          <select class="admin-assign-select">${sectionOptionsFor(s)}</select>
          <button type="button" class="btn btn-secondary btn-sm admin-assign-btn" data-id-number="${esc(s.id_number)}">Assign</button>
        </div>`
        )
        .join("");
      list.querySelectorAll(".admin-assign-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = btn.closest(".admin-assign-row");
          const select = row?.querySelector(".admin-assign-select");
          const idNumber = btn.getAttribute("data-id-number");
          if (select?.value) void assignSection(idNumber, select.value);
        });
      });
    } catch (e) {
      list.innerHTML = `<p class="empty-state">${esc(e.message)}</p>`;
    }
  }

  async function assignSection(studentIdNumber, section) {
    try {
      const res = await fetch(apiUrl("/admin/students/section"), {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ student_id_number: studentIdNumber, section }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not assign section.");
      if (typeof showToast === "function") showToast("Section assigned.", "success");
      await loadStudentsWithoutSection();
    } catch (e) {
      if (typeof showToast === "function") showToast(e.message, "error");
      else alert(e.message);
    }
  }

  function init() {
    if (!$("admin-sections-card")) return;
    $("admin-add-section-form")?.addEventListener("submit", addSection);
    void loadSections().then(loadStudentsWithoutSection);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
