/**
 * LearnIQ dashboard launcher (learniq-dashboard.html hero).
 *
 * Study card: pick a lesson, then Reviewer / Quiz / Activity opens it in
 * my-lesson.html on that tab. Word Clash card: pick a lesson + difficulty, then
 * Start goes straight into the battle (battle-arena.html). Both default to the
 * last lesson the student opened (localStorage "learniq-last-lesson", written
 * by My Lesson and Word Clash).
 *
 * Uses script.js / api.js globals: apiUrl, adminAuthHeaders, getStudentIdNumberForApi.
 */
(function () {
  "use strict";

  var LAST_LESSON_KEY = "learniq-last-lesson";
  var DIFFICULTY_KEY = "learniq-battle-difficulty"; // shared with battle-arena.entry.js
  var DIFFICULTIES = ["normal", "medium", "hard"];

  var lessonsById = {};

  function readStorage(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (e) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  }

  var difficulty = DIFFICULTIES.indexOf(readStorage(DIFFICULTY_KEY)) >= 0 ? readStorage(DIFFICULTY_KEY) : "normal";

  function el(id) {
    return document.getElementById(id);
  }

  function studyButtons() {
    return Array.prototype.slice.call(document.querySelectorAll("#dashboard-launcher [data-study-tab]"));
  }

  /** Disabled pickers showing one message (loading / empty / error). */
  function showMessage(text) {
    ["launcher-study-lesson", "launcher-battle-lesson"].forEach(function (id) {
      var select = el(id);
      if (!select) return;
      select.innerHTML = "";
      var opt = document.createElement("option");
      opt.textContent = text;
      select.appendChild(opt);
      select.disabled = true;
    });
    setActionsEnabled(false);
  }

  function setActionsEnabled(on) {
    studyButtons().forEach(function (btn) {
      btn.disabled = !on;
    });
    var start = el("launcher-battle-start");
    if (start) start.disabled = !on;
  }

  /** One <optgroup> per subject, lessons in the order the API returns them (newest first). */
  function fillSelect(select, lessons, selectedId) {
    select.innerHTML = "";
    var groups = {};
    lessons.forEach(function (lesson) {
      var name = String(lesson.subject_name || "Other lessons");
      if (!groups[name]) {
        groups[name] = document.createElement("optgroup");
        groups[name].label = name;
        select.appendChild(groups[name]);
      }
      var opt = document.createElement("option");
      opt.value = String(lesson.file_id);
      opt.textContent = String(lesson.filename || "Untitled lesson");
      groups[name].appendChild(opt);
    });
    select.value = selectedId;
    select.disabled = false;
  }

  function renderDifficulty() {
    document.querySelectorAll("#dashboard-launcher [data-difficulty]").forEach(function (btn) {
      var on = btn.getAttribute("data-difficulty") === difficulty;
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
  }

  async function loadLessons() {
    var sid = typeof getStudentIdNumberForApi === "function" ? getStudentIdNumberForApi() : "";
    if (!sid || typeof apiUrl !== "function") {
      showMessage("Sign in as a student to see your lessons");
      return;
    }
    try {
      var res = await fetch(apiUrl("/student/lessons?student_id_number=" + encodeURIComponent(sid) + "&lite=1"), {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || "Could not load lessons.");
      var lessons = (Array.isArray(data.lessons) ? data.lessons : []).filter(function (l) {
        return l && l.file_id;
      });
      if (!lessons.length) {
        showMessage("No published lessons yet");
        return;
      }
      lessonsById = {};
      lessons.forEach(function (l) {
        lessonsById[String(l.file_id)] = l;
      });
      var last = readStorage(LAST_LESSON_KEY);
      var initial = lessonsById[last] ? last : String(lessons[0].file_id);
      fillSelect(el("launcher-study-lesson"), lessons, initial);
      fillSelect(el("launcher-battle-lesson"), lessons, initial);
      setActionsEnabled(true);
    } catch (e) {
      console.warn("dashboard launcher:", e);
      showMessage("Couldn't load lessons. Refresh to try again");
    }
  }

  function openStudy(tab) {
    var lesson = lessonsById[el("launcher-study-lesson").value];
    if (!lesson) return;
    window.location.href =
      "my-lesson.html?subject_id=" +
      encodeURIComponent(lesson.subject_id || "") +
      "&lesson=" +
      encodeURIComponent(lesson.file_id) +
      "&tab=" +
      encodeURIComponent(tab);
  }

  function startBattle() {
    var lesson = lessonsById[el("launcher-battle-lesson").value];
    if (!lesson) return;
    window.location.href =
      "battle-arena.html?lesson=" +
      encodeURIComponent(lesson.file_id) +
      "&difficulty=" +
      encodeURIComponent(difficulty) +
      "&start=1";
  }

  function setup() {
    var root = el("dashboard-launcher");
    if (!root) return;

    studyButtons().forEach(function (btn) {
      btn.addEventListener("click", function () {
        openStudy(btn.getAttribute("data-study-tab"));
      });
    });
    el("launcher-battle-start")?.addEventListener("click", startBattle);

    var picker = root.querySelector(".launcher-difficulty");
    picker?.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-difficulty]");
      if (!btn) return;
      difficulty = btn.getAttribute("data-difficulty");
      writeStorage(DIFFICULTY_KEY, difficulty);
      renderDifficulty();
    });
    // Arrow keys move between options (radio group behaviour).
    picker?.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var idx = DIFFICULTIES.indexOf(difficulty);
      idx = (idx + (e.key === "ArrowRight" ? 1 : DIFFICULTIES.length - 1)) % DIFFICULTIES.length;
      difficulty = DIFFICULTIES[idx];
      writeStorage(DIFFICULTY_KEY, difficulty);
      renderDifficulty();
      picker.querySelector('[data-difficulty="' + difficulty + '"]')?.focus();
      e.preventDefault();
    });

    renderDifficulty();
    void loadLessons();
  }

  document.addEventListener("DOMContentLoaded", setup);
})();
