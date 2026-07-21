/**
 * AI Battle Arena — Phase 1 foundation (frontend only).
 * Loads published lessons via /student/lessons. No AI generation or battle logic yet.
 */
(function () {
  "use strict";

  var selectedLessonId = null;
  var selectedMode = "ai";

  function esc(text) {
    if (typeof escapeHtml === "function") return escapeHtml(text);
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function studentId() {
    if (typeof getStudentIdNumberForApi === "function") {
      return getStudentIdNumberForApi();
    }
    try {
      var u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
      return String((u && u.id_number) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function setStartEnabled(on) {
    var btn = document.getElementById("battle-arena-start-btn");
    var hint = document.getElementById("battle-arena-start-hint");
    if (btn) btn.disabled = !on;
    if (hint) {
      hint.textContent = on
        ? "Ready — battle flow comes in a later phase."
        : "Select a lesson to enable Start Battle.";
    }
  }

  function syncSelectionUi() {
    document.querySelectorAll("#battle-arena-lesson-list .lesson-card").forEach(function (card) {
      var id = card.getAttribute("data-lesson-id");
      var isOn = id && id === selectedLessonId;
      card.classList.toggle("selected", !!isOn);
      card.setAttribute("aria-pressed", isOn ? "true" : "false");
    });
    setStartEnabled(!!selectedLessonId && selectedMode === "ai");
  }

  function buildLessonCard(lesson) {
    var id = String(lesson.file_id || lesson.lesson_id || "").trim();
    if (!id) return "";
    var title = esc(lesson.filename || lesson.title || "Untitled lesson");
    var teacher = esc(lesson.teacher_name || lesson.teacher_id_number || "Teacher");
    var fileType = esc(String(lesson.file_type || "file").toUpperCase());
    var subject = esc(lesson.subject_name || "");
    var createdLabel = "";
    try {
      if (lesson.created_at) createdLabel = new Date(lesson.created_at).toLocaleDateString();
    } catch (e) {
      createdLabel = "";
    }
    return (
      '<button type="button" class="lesson-card battle-arena-lesson-card" data-lesson-id="' +
      esc(id) +
      '" aria-pressed="false">' +
      '<div class="lesson-card-icon"><i class="fa-solid fa-file-lines" aria-hidden="true"></i></div>' +
      '<div class="lesson-info">' +
      "<h4>" +
      title +
      "</h4>" +
      '<div class="lesson-card-meta-row">' +
      '<span class="lesson-card-pill"><i class="fa-solid fa-tag"></i> ' +
      fileType +
      "</span>" +
      (createdLabel
        ? '<span class="lesson-card-pill"><i class="fa-solid fa-calendar"></i> ' + esc(createdLabel) + "</span>"
        : "") +
      (subject
        ? '<span class="lesson-card-pill"><i class="fa-solid fa-bookmark"></i> ' + subject + "</span>"
        : "") +
      '<span class="lesson-card-pill"><i class="fa-solid fa-user"></i> ' +
      teacher +
      "</span>" +
      "</div>" +
      '<p class="lesson-card-features small-note">Tap to select for battle</p>' +
      "</div>" +
      "</button>"
    );
  }

  async function loadLessons() {
    var listEl = document.getElementById("battle-arena-lesson-list");
    var emptyEl = document.getElementById("battle-arena-lessons-empty");
    var statusEl = document.getElementById("battle-arena-lessons-status");
    if (!listEl) return;

    selectedLessonId = null;
    syncSelectionUi();

    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "Loading lessons…";
    }
    if (emptyEl) emptyEl.hidden = true;
    listEl.hidden = true;
    listEl.innerHTML = "";

    var sid = studentId();
    if (!sid) {
      if (statusEl) statusEl.textContent = "Sign in as a student to load published lessons.";
      return;
    }
    if (typeof apiUrl !== "function") {
      if (statusEl) statusEl.textContent = "API helper missing. Check js/core/api.js.";
      return;
    }

    try {
      var url = apiUrl("/student/lessons?student_id_number=" + encodeURIComponent(sid));
      var res = await fetch(url);
      var data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }
      if (!res.ok) {
        throw new Error((data && data.error) || "Could not load lessons.");
      }
      var lessons = Array.isArray(data.lessons) ? data.lessons : [];
      if (statusEl) statusEl.hidden = true;

      if (!lessons.length) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }

      listEl.innerHTML = lessons.map(buildLessonCard).filter(Boolean).join("");
      listEl.hidden = false;
    } catch (err) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = (err && err.message) || "Could not load lessons.";
      }
      if (typeof showToast === "function") {
        showToast((err && err.message) || "Could not load lessons.", "error");
      }
    }
  }

  function onLessonListClick(event) {
    var card = event.target.closest(".battle-arena-lesson-card[data-lesson-id]");
    if (!card || !document.getElementById("battle-arena-lesson-list").contains(card)) return;
    selectedLessonId = card.getAttribute("data-lesson-id") || null;
    syncSelectionUi();
  }

  function onModeChange(event) {
    var input = event.target;
    if (!input || input.name !== "battle-mode") return;
    selectedMode = input.value === "player" ? "player" : "ai";
    document.querySelectorAll(".battle-mode-card").forEach(function (card) {
      var radio = card.querySelector('input[name="battle-mode"]');
      card.classList.toggle("is-selected", !!(radio && radio.checked));
    });
    syncSelectionUi();
  }

  function onStartClick() {
    if (!selectedLessonId) return;
    if (typeof showToast === "function") {
      showToast("Battle setup saved for later — combat starts in a future update.", "info");
    }
  }

  function setupBattleArenaPage() {
    if (typeof hydrateStudentSidebarChip === "function") hydrateStudentSidebarChip();
    if (typeof initRoleAwareDashboardSidebar === "function") initRoleAwareDashboardSidebar();
    if (typeof hydrateSidebarProfileFromDatabase === "function") {
      void hydrateSidebarProfileFromDatabase();
    }

    document.getElementById("battle-arena-refresh-btn")?.addEventListener("click", function () {
      void loadLessons();
    });
    document.getElementById("battle-arena-lesson-list")?.addEventListener("click", onLessonListClick);
    document.querySelectorAll('input[name="battle-mode"]').forEach(function (radio) {
      radio.addEventListener("change", onModeChange);
    });
    document.getElementById("battle-arena-start-btn")?.addEventListener("click", onStartClick);

    setStartEnabled(false);
    void loadLessons();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var path = (window.location.pathname || "").split("/").pop() || "";
    if (path !== "battle-arena.html" && !document.body.classList.contains("battle-arena-page")) {
      return;
    }
    setupBattleArenaPage();
  });

  window.setupBattleArenaPage = setupBattleArenaPage;
})();
