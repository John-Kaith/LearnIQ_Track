/**
 * Word Clash (battle-arena.html) — the Arcade's spelling battle game.
 *
 * Game shell: PRESS START → menu (Start / Battle Log / Settings / Quit) →
 * world select (one world per subject) → stage select (one stage per lesson)
 * → loading → Ready → battle → results. Esc / Pause opens the pause menu.
 *
 * Data: /student/subjects + /student/lessons?lite=1 for worlds and stages,
 * /get-content and /generate-battle-questions for questions (one shared bank
 * per lesson + difficulty that grows as students play),
 * /student/learning-history (event "battle") for results — every battle saves
 * its question-by-question answers so the Battle Log can replay them.
 */
(function () {
  "use strict";

  var selectedLessonId = null;
  var selectedLesson = null;
  var lessonsById = {};
  var subjects = []; // worlds, in the order /student/subjects returns them
  var lessonsBySubject = {}; // subject id -> lessons (stages), oldest first
  var battleLog = []; // saved battles, newest first (Battle Log + cleared stars)
  var battleLogLoaded = false;
  var currentWorldId = null;

  var GRID_SIZE = 20;
  var PLAYER_MAX_HP = 100;
  var AI_MAX_HP = 100;
  var LETTER_FILLER =
    "eeeeeeeeeeeeaaaaaaaaaiiiiiiiiiooooooooonnnnnnnrrrrrrrttttttllllssssuuuu" +
    "ddddggg" + "bbccmmppffhhvvwwyykjxqz";

  var fight = null;
  var audioCtx = null;

  /* ----------------------------------------------------------
   * Arena progression: every finished battle earns 5–15 EXP;
   * 100 EXP = 1 level (starts at level 0). Keep in sync with
   * battle_exp_for_result() in backend/db_supabase.py, which
   * recomputes level / EXP / best score from saved history.
   * ---------------------------------------------------------- */
  var EXP_PER_LEVEL = 100;
  var battleStats = (function () {
    try {
      return JSON.parse(sessionStorage.getItem("learniq-battle-stats") || "null");
    } catch (e) {
      return null;
    }
  })(); // { level, total_exp, best_score, ... } from /student/battle-stats

  function battleExpForResult(outcome, correctAnswers) {
    var exp = 5;
    if (outcome === "win") exp += 5;
    exp += Math.min(5, Math.max(0, Number(correctAnswers) || 0));
    return Math.max(5, Math.min(15, exp));
  }

  async function loadBattleStats() {
    var sid = studentId();
    if (!sid || typeof apiUrl !== "function") return null;
    try {
      var headers = typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {};
      var res = await fetch(
        apiUrl("/student/battle-stats?student_id_number=" + encodeURIComponent(sid)),
        { headers: headers }
      );
      if (!res.ok) return battleStats;
      battleStats = await res.json();
      if (typeof renderNextOpponent === "function") renderNextOpponent();
      try {
        sessionStorage.setItem("learniq-battle-stats", JSON.stringify(battleStats));
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      console.warn("loadBattleStats failed:", e);
    }
    return battleStats;
  }

  /* ----------------------------------------------------------
   * Retro sound effects — synthesized with Web Audio, no audio
   * files needed. Lazily created on first use (autoplay policies
   * require a user gesture, and every caller here fires from a
   * click handler already).
   * ---------------------------------------------------------- */

  /* ----------------------------------------------------------
   * Sound settings (Settings screen): separate volume for music and
   * for sound effects, saved in localStorage. 50% = the original
   * loudness; 0 = muted.
   * ---------------------------------------------------------- */
  var AUDIO_STORAGE_KEY = "learniq-battle-audio";
  var OLD_VOLUME_STORAGE_KEY = "learniq-battle-volume";
  var audioSettings = {
    music: { volume: 0.5, muted: false },
    sfx: { volume: 0.5, muted: false },
  };

  (function loadAudioSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) || "null");
      if (!saved) {
        // Carry over the earlier single volume setting to both channels.
        var old = JSON.parse(localStorage.getItem(OLD_VOLUME_STORAGE_KEY) || "null");
        if (old && typeof old.volume === "number") {
          saved = {
            music: { volume: old.volume, muted: !!old.muted },
            sfx: { volume: old.volume, muted: !!old.muted },
          };
        }
      }
      ["music", "sfx"].forEach(function (kind) {
        var ch = saved && saved[kind];
        if (ch && typeof ch.volume === "number") audioSettings[kind].volume = Math.max(0, Math.min(1, ch.volume));
        if (ch && typeof ch.muted === "boolean") audioSettings[kind].muted = ch.muted;
      });
    } catch (e) {
      /* keep defaults */
    }
  })();

  function effectiveVolume(kind) {
    var ch = audioSettings[kind === "music" ? "music" : "sfx"];
    return ch.muted ? 0 : ch.volume;
  }

  function saveAudioSettings() {
    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(audioSettings));
    } catch (e) {
      /* ignore */
    }
  }

  function applyVolume() {
    ALL_TRACKS.forEach(function (t) {
      if (t && t.el) t.el.volume = effectiveVolume(t.kind);
    });
    ["music", "sfx"].forEach(function (kind) {
      var pct = String(Math.round(effectiveVolume(kind) * 100));
      document.querySelectorAll('.wc-volume[data-sound-kind="' + kind + '"]').forEach(function (slider) {
        slider.value = pct;
        slider.setAttribute("aria-label", (kind === "music" ? "Music" : "Sound effects") + " volume");
      });
      document.querySelectorAll('.wc-volume-value[data-sound-kind="' + kind + '"]').forEach(function (out) {
        out.textContent = pct === "0" ? "OFF" : pct;
      });
    });
  }

  /** Stats for the menu: server numbers when available, else this browser's battle history. */
  function menuStats() {
    if (battleStats && typeof battleStats.wins === "number") {
      return {
        level: Number(battleStats.level || 0),
        totalExp: Number(battleStats.total_exp || 0),
        wins: Number(battleStats.wins || 0),
        best: Number(battleStats.best_score || 0),
      };
    }
    var list = typeof readStudentHistoryListLocal === "function" ? readStudentHistoryListLocal("battle") : [];
    var totalExp = 0;
    var wins = 0;
    var best = 0;
    list.forEach(function (b) {
      var won = String(b.outcome || "").toLowerCase() === "win";
      totalExp += battleExpForResult(won ? "win" : "lose", b.correct_answers);
      if (won) wins += 1;
      best = Math.max(best, Number(b.score != null ? b.score : b.total_damage) || 0);
    });
    return { level: Math.floor(totalExp / EXP_PER_LEVEL), totalExp: totalExp, wins: wins, best: best };
  }

  /** Player card on the main menu: fighter, name, level, EXP bar, wins, best score. */
  function renderMenuPlayer() {
    var st = menuStats();
    var into = st.totalExp % EXP_PER_LEVEL;
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("wc-player-name", playerDisplayName().toUpperCase());
    set("wc-player-level", "LV " + st.level + " · " + into + "/" + EXP_PER_LEVEL + " EXP");
    set("wc-player-meta", st.wins + (st.wins === 1 ? " WIN" : " WINS") + " · BEST " + st.best);
    var fill = document.getElementById("wc-player-exp-fill");
    if (fill) fill.style.width = Math.round((into / EXP_PER_LEVEL) * 100) + "%";
    renderCharacterInto(document.getElementById("wc-player-sprite"), selectedCharacter);
  }

  function playerDisplayName() {
    var user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    var name = user && typeof getProfileDisplayName === "function" ? getProfileDisplayName(user) : "";
    return String(name || "Player").trim() || "Player";
  }

  /* Reduce motion: same preference as the LMS Settings page (learniq-prefs). */
  var PREFS_KEY = "learniq-prefs";

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function applyReduceMotion(on) {
    document.documentElement.classList.toggle("reduce-motion", !!on);
    var box = document.getElementById("wc-reduce-motion");
    if (box) box.checked = !!on;
  }

  function setupSettings() {
    document.querySelectorAll(".wc-volume").forEach(function (slider) {
      slider.addEventListener("input", function () {
        var kind = slider.getAttribute("data-sound-kind") === "music" ? "music" : "sfx";
        audioSettings[kind].volume = Math.max(0, Math.min(1, Number(slider.value) / 100));
        audioSettings[kind].muted = false;
        applyVolume();
        saveAudioSettings();
      });
      slider.addEventListener("change", function () {
        if (slider.getAttribute("data-sound-kind") !== "music") playClickSound();
      });
    });
    document.getElementById("wc-reduce-motion")?.addEventListener("change", function (e) {
      var prefs = readPrefs();
      prefs.reduce_motion = !!e.target.checked;
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      } catch (err) {
        /* ignore */
      }
      applyReduceMotion(prefs.reduce_motion);
    });
    applyReduceMotion(!!readPrefs().reduce_motion);
    applyVolume();
  }

  function getAudioCtx() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type, delay) {
    var vol = effectiveVolume("sfx");
    if (vol <= 0) return;
    var ctx = getAudioCtx();
    if (!ctx) return;
    var startAt = ctx.currentTime + (delay || 0) / 1000;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.18 * vol, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration);
  }

  function playClickSound() {
    playTone(720, 0.05, "square");
  }

  function playScrambleSound() {
    playTone(500, 0.05, "square");
    playTone(650, 0.05, "square", 40);
  }

  function playAttackSound(who) {
    if (who === "ai") {
      playTone(330, 0.07, "square");
      playTone(220, 0.09, "square", 60);
    } else {
      playTone(440, 0.06, "square");
      playTone(660, 0.09, "square", 50);
    }
  }

  function playHitSound() {
    playTone(160, 0.14, "square");
  }

  function playVictorySound() {
    playTone(523, 0.12, "square", 0);
    playTone(659, 0.12, "square", 120);
    playTone(784, 0.22, "square", 240);
  }

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

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleDateString();
    } catch (e) {
      return "—";
    }
  }

  function lessonTitle(lesson) {
    if (!lesson) return "—";
    return String(lesson.filename || lesson.title || "Untitled lesson");
  }

  function lessonFileType(lesson) {
    if (!lesson) return "—";
    return String(lesson.file_type || "file").toUpperCase();
  }

  /* ----------------------------------------------------------
   * Screens. The menus live in #wc-app; the loading screen and the
   * battle are separate full-screen layers on top of it.
   * ---------------------------------------------------------- */
  var SCREENS = ["splash", "menu", "worlds", "stages", "results", "log", "log-detail", "settings"];
  var activeScreen = "splash";
  var settingsReturn = "menu"; // "pause" when Settings was opened from the pause menu

  function screenEl(name) {
    return document.getElementById("wc-" + name);
  }

  /** Shows one menu screen (hiding the battle layers) and focuses its first control. */
  function showScreen(name, opts) {
    activeScreen = name;
    SCREENS.forEach(function (s) {
      var el = screenEl(s);
      if (el) el.hidden = s !== name;
    });
    document.getElementById("battle-loading-screen")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.setAttribute("hidden", "");
    var app = document.getElementById("wc-app");
    if (app) {
      app.hidden = false;
      app.scrollTop = 0;
    }
    if (!(opts && opts.noFocus)) focusFirst(screenEl(name));
  }

  function focusFirst(root) {
    if (!root) return;
    var target = root.querySelector(
      ".wc-menu-item, .wc-press-start, .wc-world:not([disabled]), .wc-stage, .wc-log-item, .wc-btn-primary:not([disabled]), button:not([disabled])"
    );
    if (target) target.focus({ preventScroll: true });
  }

  function showLoadingScreen() {
    document.getElementById("wc-app")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.setAttribute("hidden", "");
    document.getElementById("battle-loading-screen")?.removeAttribute("hidden");
  }

  function showFightScreenEl() {
    document.getElementById("wc-app")?.setAttribute("hidden", "");
    document.getElementById("battle-loading-screen")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.removeAttribute("hidden");
  }

  /** BACK and Esc on the menu screens. */
  function goBack() {
    switch (activeScreen) {
      case "worlds":
      case "log":
        showScreen("menu");
        break;
      case "stages":
        showScreen("worlds", { noFocus: true });
        focusWorld(currentWorldId);
        break;
      case "log-detail":
        showScreen("log", { noFocus: true });
        focusFirst(document.getElementById("wc-log-list"));
        break;
      case "settings":
        closeSettings();
        break;
      default:
        return;
    }
    playClickSound();
  }

  function openSettings(from) {
    settingsReturn = from === "pause" ? "pause" : "menu";
    applyVolume();
    renderDifficultyPicker();
    showScreen("settings");
  }

  function closeSettings() {
    if (settingsReturn === "pause" && fight && !fight.ended) {
      document.getElementById("wc-app")?.setAttribute("hidden", "");
      document.getElementById("battle-fight-screen")?.removeAttribute("hidden");
      openPause();
      return;
    }
    showScreen("menu");
  }

  /* ----------------------------------------------------------
   * Worlds (subjects) and stages (lessons)
   * ---------------------------------------------------------- */
  function authHeaders() {
    return typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {};
  }

  async function fetchJson(path) {
    var res = await fetch(apiUrl(path), { headers: authHeaders() });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error((data && data.error) || "Request failed.");
    return data;
  }

  /** Subjects become worlds; their published lessons become stages. */
  async function loadWorlds() {
    var sid = studentId();
    if (!sid) throw new Error("Sign in as a student to play.");
    if (typeof apiUrl !== "function") throw new Error("API helper missing. Check js/core/api.js.");
    var q = "?student_id_number=" + encodeURIComponent(sid);
    var results = await Promise.all([
      fetchJson("/student/subjects" + q),
      fetchJson("/student/lessons" + q + "&lite=1"),
    ]);
    subjects = Array.isArray(results[0].subjects) ? results[0].subjects : [];
    var lessons = Array.isArray(results[1].lessons) ? results[1].lessons : [];
    lessonsById = {};
    lessonsBySubject = {};
    lessons.forEach(function (lesson) {
      var id = String(lesson.file_id || lesson.lesson_id || "").trim();
      if (!id) return;
      lessonsById[id] = lesson;
      var key = String(lesson.subject_id || "");
      (lessonsBySubject[key] = lessonsBySubject[key] || []).push(lesson);
    });
    // Stage 1 is the first lesson the teacher published.
    Object.keys(lessonsBySubject).forEach(function (key) {
      lessonsBySubject[key].sort(function (a, b) {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
    });
  }

  var worldsLoaded = false;
  var worldsLoading = null;

  function ensureWorlds() {
    if (worldsLoaded) return Promise.resolve();
    if (!worldsLoading) {
      worldsLoading = loadWorlds()
        .then(function () {
          worldsLoaded = true;
        })
        .finally(function () {
          worldsLoading = null;
        });
    }
    return worldsLoading;
  }

  /** Saved battles, newest first: Battle Log, cleared stars and the menu stats. */
  async function loadBattleLog() {
    var sid = studentId();
    if (!sid || typeof apiUrl !== "function") return battleLog;
    try {
      var data = await fetchJson("/student/learning-history?student_id_number=" + encodeURIComponent(sid));
      battleLog = Array.isArray(data.battle) ? data.battle : [];
      battleLogLoaded = true;
    } catch (e) {
      console.warn("loadBattleLog failed:", e);
    }
    return battleLog;
  }

  function clearedLessonIds() {
    var cleared = {};
    battleLog.forEach(function (b) {
      if (String(b.outcome || "").toLowerCase() === "win" && b.lesson_id) cleared[String(b.lesson_id)] = true;
    });
    return cleared;
  }

  function stageLabel(lesson) {
    return lessonTitle(lesson).replace(/\.(pdf|pptx?|docx?|txt)$/i, "");
  }

  /** Worlds use the subject's colour in its dark-mode (blue/violet) form, matching the game palette. */
  function worldColor(subject) {
    var c = (subject && subject.color) || "#ca8a04";
    return typeof darkSubjectColor === "function" ? darkSubjectColor(c) : c;
  }

  function cssEscape(v) {
    return window.CSS && CSS.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&");
  }

  async function openWorlds() {
    showScreen("worlds", { noFocus: true });
    var status = document.getElementById("wc-worlds-status");
    var grid = document.getElementById("wc-world-grid");
    if (!worldsLoaded) {
      if (status) {
        status.hidden = false;
        status.textContent = "Loading worlds…";
      }
      if (grid) grid.innerHTML = "";
    }
    try {
      await Promise.all([ensureWorlds(), battleLog.length ? null : loadBattleLog()]);
    } catch (err) {
      if (status) {
        status.hidden = false;
        status.textContent = (err && err.message) || "Could not load your subjects.";
      }
      focusFirst(screenEl("worlds"));
      return;
    }
    renderWorlds();
    focusWorld(currentWorldId);
  }

  function renderWorlds() {
    var status = document.getElementById("wc-worlds-status");
    var grid = document.getElementById("wc-world-grid");
    if (!grid) return;
    if (!subjects.length) {
      if (status) {
        status.hidden = false;
        status.textContent = "No worlds yet. Join a class with your teacher's code, then come back.";
      }
      grid.innerHTML = "";
      return;
    }
    if (status) status.hidden = true;
    var cleared = clearedLessonIds();
    grid.innerHTML = subjects
      .map(function (subject, i) {
        var stages = lessonsBySubject[String(subject.id)] || [];
        var done = stages.filter(function (l) {
          return cleared[String(l.file_id)];
        }).length;
        return (
          '<button type="button" class="wc-world" data-world-id="' +
          esc(subject.id) +
          '"' +
          (stages.length ? "" : " disabled") +
          ' style="--world-color:' +
          esc(worldColor(subject)) +
          '">' +
          '<span class="wc-world-banner"><span class="wc-world-num">WORLD ' +
          (i + 1) +
          "</span></span>" +
          '<span class="wc-world-body">' +
          '<span class="wc-world-name">' +
          esc(subject.name || "Subject") +
          "</span>" +
          '<span class="wc-world-meta">' +
          (stages.length
            ? stages.length +
              (stages.length === 1 ? " STAGE" : " STAGES") +
              ' · <i class="fa-solid fa-star wc-star" aria-hidden="true"></i> ' +
              done +
              "/" +
              stages.length
            : "NO STAGES YET") +
          "</span></span></button>"
        );
      })
      .join("");
  }

  function focusWorld(worldId) {
    var grid = document.getElementById("wc-world-grid");
    if (!grid) return;
    var btn =
      (worldId && grid.querySelector('.wc-world[data-world-id="' + cssEscape(worldId) + '"]:not([disabled])')) ||
      grid.querySelector(".wc-world:not([disabled])");
    if (btn) btn.focus({ preventScroll: true });
    else focusFirst(screenEl("worlds"));
  }

  function openStages(worldId) {
    var subject = subjects.find(function (s) {
      return String(s.id) === String(worldId);
    });
    if (!subject) return;
    currentWorldId = String(subject.id);
    setStageAlert("");
    var stages = lessonsBySubject[currentWorldId] || [];
    var title = document.getElementById("wc-stages-title");
    var sub = document.getElementById("wc-stages-sub");
    if (title) title.textContent = "WORLD " + (subjects.indexOf(subject) + 1);
    if (sub) sub.textContent = subject.name || "";
    // Keep the current pick if it's in this world, else the last lesson opened anywhere.
    if (!selectedLesson || String(selectedLesson.subject_id) !== currentWorldId) {
      var last = readLastLessonId();
      var pick = stages.find(function (l) {
        return String(l.file_id) === last;
      });
      setSelectedLesson(pick ? pick.file_id : null);
    }
    renderStages();
    renderNextOpponent();
    renderCharacterInto(document.getElementById("wc-fighter-sprite"), selectedCharacter);
    renderDifficultyPicker();
    showScreen("stages", { noFocus: true });
    var list = document.getElementById("wc-stage-list");
    var focusEl =
      (selectedLessonId && list && list.querySelector('.wc-stage[data-lesson-id="' + cssEscape(selectedLessonId) + '"]')) ||
      (list && list.querySelector(".wc-stage"));
    if (focusEl) focusEl.focus({ preventScroll: true });
  }

  function renderStages() {
    var list = document.getElementById("wc-stage-list");
    if (!list) return;
    var worldNum =
      subjects.findIndex(function (s) {
        return String(s.id) === String(currentWorldId);
      }) + 1;
    var stages = lessonsBySubject[String(currentWorldId)] || [];
    var cleared = clearedLessonIds();
    if (!stages.length) {
      list.innerHTML = '<li class="wc-stage-empty">No lessons in this world yet.</li>';
      renderSelectedStage();
      return;
    }
    list.innerHTML = stages
      .map(function (lesson, i) {
        var id = String(lesson.file_id);
        var on = id === selectedLessonId;
        return (
          '<li><button type="button" class="wc-stage' +
          (on ? " is-selected" : "") +
          '" data-lesson-id="' +
          esc(id) +
          '" aria-pressed="' +
          (on ? "true" : "false") +
          '">' +
          '<span class="wc-stage-num">' +
          worldNum +
          "-" +
          (i + 1) +
          "</span>" +
          '<span class="wc-stage-name">' +
          esc(stageLabel(lesson)) +
          "</span>" +
          (cleared[id]
            ? '<span class="wc-stage-badge is-cleared"><i class="fa-solid fa-star" aria-hidden="true"></i> CLEARED</span>'
            : '<span class="wc-stage-badge">NEW</span>') +
          "</button></li>"
        );
      })
      .join("");
    renderSelectedStage();
  }

  /** Why the last FIGHT didn't start; stays above FIGHT until the student changes something. */
  function setStageAlert(text) {
    var el = document.getElementById("wc-stage-alert");
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
  }

  function renderSelectedStage() {
    var label = document.getElementById("wc-selected-stage");
    var fightBtn = document.getElementById("wc-fight-btn");
    if (label) label.textContent = selectedLesson ? stageLabel(selectedLesson) : "Pick a stage";
    if (fightBtn) fightBtn.disabled = !selectedLesson;
  }

  function readLastLessonId() {
    try {
      return localStorage.getItem("learniq-last-lesson") || "";
    } catch (e) {
      return "";
    }
  }

  function setSelectedLesson(lessonId) {
    var id = lessonId ? String(lessonId) : "";
    selectedLessonId = id && lessonsById[id] ? id : null;
    selectedLesson = selectedLessonId ? lessonsById[selectedLessonId] : null;
    if (selectedLessonId) {
      // The dashboard launcher preselects the last lesson the student opened.
      try {
        localStorage.setItem("learniq-last-lesson", selectedLessonId);
      } catch (e) {
        /* ignore */
      }
    }
  }

  function onStageListClick(event) {
    var btn = event.target.closest(".wc-stage[data-lesson-id]");
    if (!btn) return;
    setStageAlert("");
    setSelectedLesson(btn.getAttribute("data-lesson-id"));
    playClickSound();
    document.querySelectorAll("#wc-stage-list .wc-stage").forEach(function (b) {
      var on = b === btn;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderSelectedStage();
    // Focus moves to FIGHT, so picking a stage and pressing Enter starts it
    // (on phones this also scrolls the setup panel into view).
    document.getElementById("wc-fight-btn")?.focus();
  }

  /**
   * Dashboard launcher deep link: battle-arena.html?lesson=<file_id>&difficulty=<key>&start=1
   * skips the menus and starts that battle right away.
   */
  async function applyLaunchFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var lessonId = params.get("lesson");
    if (!lessonId || params.get("start") !== "1") return false;
    window.history.replaceState(null, "", window.location.pathname);
    try {
      await ensureWorlds();
    } catch (e) {
      return false;
    }
    if (!lessonsById[lessonId]) return false;
    var difficulty = params.get("difficulty");
    if (difficulty && BATTLE_DIFFICULTIES[difficulty]) saveSelectedDifficulty(difficulty);
    setSelectedLesson(lessonId);
    currentWorldId = String(selectedLesson.subject_id || "");
    void loadBattleLog();
    void startBattle();
    return true;
  }

  /* ----------------------------------------------------------
   * Phase 3 — per-question letter grid
   * Builds the grid directly from the current answer's exact
   * letters (guaranteed formable) plus random filler letters,
   * shuffled — no probabilistic pool needed since there's only
   * one valid word at a time.
   * ---------------------------------------------------------- */

  function buildAnswerGrid(answer, size) {
    var letters = String(answer || "").split("");
    while (letters.length < size) {
      letters.push(LETTER_FILLER[Math.floor(Math.random() * LETTER_FILLER.length)]);
    }
    letters = letters.slice(0, size);
    for (var i = letters.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = letters[i];
      letters[i] = letters[j];
      letters[j] = tmp;
    }
    return letters.map(function (ch) {
      return { letter: ch };
    });
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /* ----------------------------------------------------------
   * Phase 3 — content load + battle lifecycle
   * ---------------------------------------------------------- */

  async function loadLessonContentAndVocab(fileId) {
    if (typeof apiUrl !== "function") {
      throw new Error("API helper missing. Check js/core/api.js.");
    }
    var res = await fetch(apiUrl("/get-content/" + encodeURIComponent(fileId)));
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      throw new Error((data && data.error) || "Could not load lesson content.");
    }
    return {
      battleQuestions: Array.isArray(data.battle_questions) ? data.battle_questions : [],
    };
  }

  async function generateBattleQuestionsWithAi(fileId, difficulty) {
    if (typeof apiUrl !== "function") {
      throw new Error("API helper missing. Check js/core/api.js.");
    }
    var res = await fetch(apiUrl("/generate-battle-questions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {}),
      },
      body: JSON.stringify({ file_id: fileId, difficulty: difficulty || "normal" }),
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      var err = new Error((data && data.error) || "Could not generate battle questions.");
      err.status = res.status;
      throw err;
    }
    return Array.isArray(data.questions) ? data.questions : [];
  }

  function normalizeQuestionEntries(rawEntries) {
    var out = [];
    (Array.isArray(rawEntries) ? rawEntries : []).forEach(function (entry) {
      if (!entry || typeof entry !== "object") return;
      var questionText = String(entry.question || "").trim();
      var answer = String(entry.answer || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      if (!questionText || answer.length < 4 || answer.length > 12) return;
      var difficulty = String(entry.difficulty || "normal").toLowerCase();
      out.push({
        question: questionText,
        answer: answer,
        meaning: String(entry.meaning || "").trim(),
        difficulty: BATTLE_DIFFICULTIES[difficulty] ? difficulty : "normal",
      });
    });
    return out;
  }

  function setLoadingHint(text) {
    var hint = document.getElementById("battle-loading-hint");
    if (hint) hint.textContent = text;
  }

  function renderHpSide(hp, maxHp, fillId, valueId, heartsId) {
    var pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    var fillEl = document.getElementById(fillId);
    var valueEl = document.getElementById(valueId);
    var heartsEl = document.getElementById(heartsId);
    if (fillEl) {
      fillEl.style.width = pct + "%";
      fillEl.classList.toggle("is-low", pct <= 30);
    }
    if (valueEl) valueEl.textContent = Math.max(0, hp) + "/" + maxHp;
    if (heartsEl) {
      var totalHearts = 5;
      var filled = Math.max(0, Math.min(totalHearts, Math.ceil((hp / maxHp) * totalHearts)));
      var html = "";
      for (var i = 0; i < totalHearts; i++) {
        html +=
          '<i class="fa-solid fa-heart' +
          (i < filled ? "" : " is-empty") +
          '" aria-hidden="true"></i>';
      }
      heartsEl.innerHTML = html;
    }
  }

  function renderHp() {
    if (!fight) return;
    renderHpSide(fight.playerHp, PLAYER_MAX_HP, "battle-player-hp-fill", "battle-player-hp-value", "battle-player-hearts");
    renderHpSide(fight.aiHp, AI_MAX_HP, "battle-ai-hp-fill", "battle-ai-hp-value", "battle-ai-hearts");
  }

  function renderWordsUsed() {
    var listEl = document.getElementById("battle-words-used-list");
    if (!listEl || !fight) return;
    if (!fight.wordsUsed.length) {
      listEl.innerHTML = '<li class="battle-words-used-empty" id="battle-words-used-empty">No answers yet — start attacking!</li>';
      return;
    }
    listEl.innerHTML = fight.wordsUsed
      .map(function (entry) {
        var meaningHtml = entry.meaning
          ? '<span class="battle-word-meaning">' + esc(entry.meaning) + "</span>"
          : "";
        return (
          "<li><div class='battle-words-used-row'><span>" +
          esc(entry.word.toUpperCase()) +
          '</span><span class="small-note">+' +
          entry.damage +
          " dmg</span></div>" +
          meaningHtml +
          "</li>"
        );
      })
      .join("");
  }

  function renderWordPreview() {
    var previewEl = document.getElementById("battle-word-preview-text");
    var attackBtn = document.getElementById("battle-attack-btn");
    var backspaceBtn = document.getElementById("battle-backspace-btn");
    if (!previewEl || !fight) return;
    var word = fight.selected.map(function (idx) { return fight.grid[idx].letter; }).join("");
    if (!word) {
      previewEl.innerHTML = '<span class="battle-word-preview-placeholder" id="battle-word-preview-placeholder">Tap letters to spell the answer…</span>';
    } else {
      previewEl.textContent = word;
    }
    if (attackBtn) attackBtn.disabled = fight.selected.length === 0;
    if (backspaceBtn) backspaceBtn.disabled = fight.selected.length === 0;
  }

  function renderGrid() {
    var gridEl = document.getElementById("battle-letter-grid");
    if (!gridEl || !fight) return;
    gridEl.innerHTML = fight.grid
      .map(function (tile, idx) {
        var isSelected = fight.selected.indexOf(idx) !== -1;
        return (
          '<button type="button" class="battle-tile' +
          (isSelected ? " is-selected" : "") +
          '" data-tile-index="' +
          idx +
          '"' +
          (isSelected ? " disabled" : "") +
          ">" +
          esc(tile.letter) +
          "</button>"
        );
      })
      .join("");
  }

  function onTileClick(event) {
    var btn = event.target.closest(".battle-tile[data-tile-index]");
    if (!btn || !fight) return;
    var idx = Number(btn.getAttribute("data-tile-index"));
    if (Number.isNaN(idx) || fight.selected.indexOf(idx) !== -1) return;
    fight.selected.push(idx);
    playClickSound();
    renderGrid();
    renderWordPreview();
  }

  function onClearClick() {
    if (!fight) return;
    fight.selected = [];
    renderGrid();
    renderWordPreview();
  }

  /** Remove the last picked letter; its tile becomes tappable again. */
  function onBackspaceClick() {
    if (!fight || !fight.selected.length) return;
    fight.selected.pop();
    playClickSound();
    renderGrid();
    renderWordPreview();
  }

  /** Physical Backspace key does the same, but only mid-round with nothing else open. */
  function onBackspaceKey(e) {
    if (e.key !== "Backspace") return;
    if (!fight || !fight.started || fight.ended || fight.paused) return;
    var screen = document.getElementById("battle-fight-screen");
    if (!screen || screen.hidden) return;
    var target = e.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (document.querySelector(".action-modal-backdrop:not([hidden]), #battle-character-dialog:not([hidden])")) return;
    e.preventDefault();
    onBackspaceClick();
  }

  function onNextClick() {
    if (!fight || !fight.questions.length) return;
    logAnswer("skipped");
    fight.selected = [];
    advanceToQuestion(fight.questionIndex + 1);
  }

  var HINTS_PER_BATTLE = 3;

  /* ----------------------------------------------------------
   * Battle timer + streak: time set by difficulty, -5s per wrong answer,
   * +3s per correct answer; every 5 correct answers in a row
   * heals +5 HP. Time running out ends the battle as a defeat.
   * ---------------------------------------------------------- */
  /* Difficulty: sets the battle time (Normal 15 / Medium 10 / Hard 5 min) and which
     AI questions are used (the backend writes recall / apply / analyze questions). */
  var BATTLE_DIFFICULTIES = {
    normal: { label: "Normal", seconds: 15 * 60 },
    medium: { label: "Medium", seconds: 10 * 60 },
    hard: { label: "Hard", seconds: 5 * 60 },
  };
  var DIFFICULTY_STORAGE_KEY = "learniq-battle-difficulty";
  var selectedDifficulty = (function () {
    try {
      var saved = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
      return BATTLE_DIFFICULTIES[saved] ? saved : "normal";
    } catch (e) {
      return "normal";
    }
  })();

  function difficultyConfig(key) {
    return BATTLE_DIFFICULTIES[key] || BATTLE_DIFFICULTIES.normal;
  }

  function battleStartSeconds() {
    return difficultyConfig(fight ? fight.difficulty : selectedDifficulty).seconds;
  }

  function saveSelectedDifficulty(key) {
    selectedDifficulty = key;
    setStageAlert("");
    try {
      localStorage.setItem(DIFFICULTY_STORAGE_KEY, key);
    } catch (e) {
      /* ignore */
    }
    renderDifficultyPicker();
  }

  /** Stage select and Settings each have a picker; both show the same saved choice. */
  function renderDifficultyPicker() {
    document.querySelectorAll(".battle-difficulty-option").forEach(function (btn) {
      var on = btn.getAttribute("data-difficulty") === selectedDifficulty;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    var note = document.getElementById("wc-diff-note");
    if (note) note.textContent = formatBattleTime(difficultyConfig(selectedDifficulty).seconds) + " on the clock";
  }

  function setupDifficultyPicker() {
    document.querySelectorAll(".battle-difficulty-picker").forEach(function (picker) {
      picker.addEventListener("click", function (e) {
        var btn = e.target.closest(".battle-difficulty-option");
        var key = btn && btn.getAttribute("data-difficulty");
        if (key && BATTLE_DIFFICULTIES[key]) {
          saveSelectedDifficulty(key);
          playClickSound();
        }
      });
      // Left/right move between options (radio group behaviour).
      picker.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var keys = Object.keys(BATTLE_DIFFICULTIES);
        var idx = keys.indexOf(selectedDifficulty);
        idx = (idx + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length;
        saveSelectedDifficulty(keys[idx]);
        picker.querySelector('[data-difficulty="' + selectedDifficulty + '"]')?.focus();
        e.preventDefault();
        e.stopPropagation();
      });
    });
    renderDifficultyPicker();
  }
  var TIME_PENALTY_WRONG = 5;
  var TIME_BONUS_CORRECT = 3;
  var STREAK_FOR_HEAL = 5;
  var STREAK_HEAL_HP = 5;
  var battleTimerId = null;
  var battleTimerLastTick = 0;

  /* Music: intro.mp3 loops from "Start Battle" (lobby) through loading and the
     Ready screen; "game start.mp3" loops once the in-game Start is pressed and
     stops when the battle ends; gameover.mp3 plays once on a loss. */
  var introMusic = createTrack("audio/intro.mp3", true, "music");
  var battleMusic = createTrack("audio/game%20start.mp3", true, "music");
  var gameOverSound = createTrack("audio/gameover.mp3", false, "sfx");

  // One-shot sound effects (frontend/audio).
  var sfxTimerRunsOut = createTrack("audio/timer%20runsout.mp3", false);
  var sfxWrong = createTrack("audio/wrong.mp3", false);
  var sfxTryAgain = createTrack("audio/try%20again.mp3", false);
  var sfxAttack = createTrack("audio/attack.mp3", false);
  var sfxCorrect = createTrack("audio/correct%20answer.mp3", false);
  var sfxWinStreak = createTrack("audio/5%20win%20streak.mp3", false);
  var ALL_TRACKS = [
    introMusic,
    battleMusic,
    gameOverSound,
    sfxTimerRunsOut,
    sfxWrong,
    sfxTryAgain,
    sfxAttack,
    sfxCorrect,
    sfxWinStreak,
  ];

  function createTrack(src, loop, kind) {
    return { src: src, loop: loop, kind: kind || "sfx", el: null };
  }

  function playTrack(track) {
    try {
      if (!track.el) {
        track.el = new Audio(track.src);
        track.el.loop = track.loop;
      }
      track.el.volume = effectiveVolume(track.kind);
      track.el.currentTime = 0;
      var playing = track.el.play();
      if (playing && typeof playing.catch === "function") {
        playing.catch(function (e) {
          console.warn("Could not play " + track.src + ":", e);
        });
      }
    } catch (e) {
      console.warn("Audio unavailable (" + track.src + "):", e);
    }
  }

  function stopTrack(track) {
    if (!track.el) return;
    track.el.pause();
    track.el.currentTime = 0;
  }

  function playIntroMusic() {
    stopTrack(battleMusic);
    stopTrack(gameOverSound);
    playTrack(introMusic);
  }

  function stopIntroMusic() {
    stopTrack(introMusic);
  }

  /** Menu music: starts the intro loop unless it is already playing (no restart between screens). */
  function ensureIntroMusic() {
    if (introMusic.el && !introMusic.el.paused) return;
    playIntroMusic();
  }

  function stopAllMusic() {
    ALL_TRACKS.forEach(stopTrack);
  }

  /* Plays timer runsout.mp3 once when the clock reaches 3 seconds. If a +3s bonus
     lifts it back above 3s, the warning stops and can play again later. */
  var LOW_TIME_WARNING_SECONDS = 3;

  function checkLowTimeWarning() {
    if (!fight || fight.ended) return;
    if (fight.timeLeft > LOW_TIME_WARNING_SECONDS) {
      if (fight.lowTimeWarned) stopTrack(sfxTimerRunsOut);
      fight.lowTimeWarned = false;
    } else if (fight.timeLeft > 0 && !fight.lowTimeWarned) {
      fight.lowTimeWarned = true;
      playTrack(sfxTimerRunsOut);
    }
  }

  function formatBattleTime(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function renderBattleTimer() {
    var el = document.getElementById("battle-timer");
    var valueEl = document.getElementById("battle-timer-value");
    if (!el || !valueEl || !fight) return;
    valueEl.textContent = formatBattleTime(fight.timeLeft);
    el.classList.toggle("is-low", fight.timeLeft <= 10);
  }

  function renderStreak() {
    var el = document.getElementById("battle-streak");
    if (!el || !fight) return;
    el.textContent = "Streak " + (fight.streak % STREAK_FOR_HEAL) + "/" + STREAK_FOR_HEAL;
  }

  function showTimerPopup(text, kind) {
    var el = document.getElementById("battle-timer");
    if (!el) return;
    var pop = document.createElement("span");
    pop.className = "battle-timer-popup is-" + kind;
    pop.textContent = text;
    el.appendChild(pop);
    setTimeout(function () {
      pop.remove();
    }, 900);
  }

  function adjustBattleTime(delta) {
    if (!fight) return;
    fight.timeLeft = Math.max(0, fight.timeLeft + delta);
    showTimerPopup((delta > 0 ? "+" : "") + delta + "s", delta > 0 ? "up" : "down");
    renderBattleTimer();
    checkLowTimeWarning();
  }

  function stopBattleTimer() {
    if (battleTimerId) clearInterval(battleTimerId);
    battleTimerId = null;
  }

  function startBattleTimer() {
    stopBattleTimer();
    battleTimerLastTick = Date.now();
    renderBattleTimer();
    battleTimerId = setInterval(function () {
      var now = Date.now();
      var elapsed = (now - battleTimerLastTick) / 1000;
      battleTimerLastTick = now;
      if (!fight || fight.ended) {
        stopBattleTimer();
        return;
      }
      if (fight.paused) return;
      fight.timeLeft = Math.max(0, fight.timeLeft - elapsed);
      renderBattleTimer();
      checkLowTimeWarning();
      if (fight.timeLeft <= 0) {
        fight.endReason = "time";
        if (typeof showToast === "function") showToast("Time's up!", "error");
        endBattle("lose");
      }
    }, 250);
  }

  /** Resets the clock and waits on the Start button: question and letters stay hidden until then. */
  function resetBattleClock() {
    if (!fight) return;
    stopBattleTimer();
    fight.timeLeft = battleStartSeconds();
    fight.streak = 0;
    fight.ended = false;
    fight.paused = false;
    fight.started = false;
    fight.endReason = "";
    fight.lowTimeWarned = false;
    renderStreak();
    renderBattleTimer();
    var readyTime = document.getElementById("battle-ready-time");
    if (readyTime) readyTime.textContent = formatBattleTime(battleStartSeconds());
    setBattleWaiting(true);
  }

  function setBattleWaiting(waiting) {
    var screen = document.getElementById("battle-fight-screen");
    var panel = document.getElementById("battle-ready-panel");
    if (screen) screen.classList.toggle("is-waiting", waiting);
    if (panel) panel.hidden = !waiting;
    if (waiting) document.getElementById("battle-start-btn")?.focus();
  }

  function onStartRoundClick() {
    if (!fight || fight.started || fight.ended) return;
    fight.started = true;
    setBattleWaiting(false);
    stopIntroMusic();
    playClickSound();
    playTrack(battleMusic);
    startBattleTimer();
  }

  function renderHintButton() {
    var btn = document.getElementById("battle-hint-btn");
    var countEl = document.getElementById("battle-hint-count");
    var left = fight ? fight.hintsLeft : HINTS_PER_BATTLE;
    if (countEl) countEl.textContent = String(left);
    if (btn) btn.disabled = !fight || left <= 0;
  }

  /** Keeps the correctly spelled start of the word and taps the next correct letter. */
  function onHintClick() {
    if (!fight || fight.hintsLeft <= 0) return;
    var answer = String(fight.currentAnswer || "").toLowerCase();
    if (!answer) return;

    var keep = 0;
    while (
      keep < fight.selected.length &&
      keep < answer.length &&
      String(fight.grid[fight.selected[keep]].letter).toLowerCase() === answer[keep]
    ) {
      keep++;
    }
    if (keep >= answer.length) {
      if (typeof showToast === "function") showToast("The answer is already spelled — hit Attack!", "info");
      return;
    }
    fight.selected = fight.selected.slice(0, keep);

    var next = answer[keep];
    var tileIdx = -1;
    for (var i = 0; i < fight.grid.length; i++) {
      if (fight.selected.indexOf(i) === -1 && String(fight.grid[i].letter).toLowerCase() === next) {
        tileIdx = i;
        break;
      }
    }
    if (tileIdx === -1) return;

    fight.selected.push(tileIdx);
    fight.hintsLeft -= 1;
    logAnswer("hint");
    playClickSound();
    renderGrid();
    renderWordPreview();
    renderHintButton();
    if (typeof showToast === "function") {
      showToast(
        "Hint: letter " + (keep + 1) + " of " + answer.length + " is \"" + next.toUpperCase() + "\"",
        "info"
      );
    }
  }

  function onScrambleClick() {
    if (!fight) return;
    fight.grid = buildAnswerGrid(fight.currentAnswer, GRID_SIZE);
    fight.selected = [];
    playScrambleSound();
    renderGrid();
    renderWordPreview();
  }

  function renderQuestion() {
    var textEl = document.getElementById("battle-question-text");
    if (!textEl || !fight) return;
    var current = fight.questions[fight.questionIndex];
    textEl.textContent = current ? current.question : "";
  }

  function advanceToQuestion(index) {
    if (!fight || !fight.questions.length) return;
    fight.questionIndex = index % fight.questions.length;
    var current = fight.questions[fight.questionIndex];
    fight.currentAnswer = current.answer;
    fight.currentMeaning = current.meaning || "";
    fight.grid = buildAnswerGrid(fight.currentAnswer, GRID_SIZE);
    fight.selected = [];
    logQuestionShown(current);
    renderQuestion();
    renderGrid();
    renderWordPreview();
  }

  /* ----------------------------------------------------------
   * Answer log: one entry per question shown, saved with the battle so
   * the results screen and the Battle Log can show what was answered.
   * result: "correct" | "skipped" | "unanswered" (still on screen when
   * the battle ended); attempts = wrong words tried first.
   * ---------------------------------------------------------- */
  var MAX_LOGGED_QUESTIONS = 60;

  function logQuestionShown(question) {
    if (!fight) return;
    fight.answerLog = fight.answerLog || [];
    fight.currentLog = {
      question: String(question.question || "").slice(0, 240),
      answer: String(question.answer || ""),
      meaning: String(question.meaning || "").slice(0, 200),
      result: "unanswered",
      attempts: [],
      hints: 0,
    };
    if (fight.answerLog.length < MAX_LOGGED_QUESTIONS) fight.answerLog.push(fight.currentLog);
  }

  function logAnswer(kind, word) {
    var entry = fight && fight.currentLog;
    if (!entry || entry.result !== "unanswered") return;
    if (kind === "wrong") {
      if (entry.attempts.length < 5) entry.attempts.push(String(word || "").slice(0, 24));
    } else if (kind === "hint") {
      entry.hints += 1;
    } else {
      entry.result = kind; // "correct" | "skipped"
    }
  }

  function damageForWordLength(len) {
    if (len <= 4) return 8;
    if (len <= 6) return 14;
    return 22;
  }

  function triggerAttackAnim(who) {
    var sprite = document.getElementById(who === "player" ? "battle-player-sprite" : "battle-ai-sprite");
    if (!sprite) return;
    sprite.classList.remove("is-attacking");
    void sprite.offsetWidth;
    sprite.classList.add("is-attacking");
    sprite.addEventListener(
      "animationend",
      function () {
        sprite.classList.remove("is-attacking");
      },
      { once: true }
    );
  }

  function triggerHitAnim(who, dmg) {
    var sprite = document.getElementById(who === "player" ? "battle-player-sprite" : "battle-ai-sprite");
    var fighterEl = document.getElementById(who === "player" ? "battle-player-fighter" : "battle-ai-fighter");
    if (sprite) {
      sprite.classList.remove("is-hit");
      void sprite.offsetWidth;
      sprite.classList.add("is-hit");
      sprite.addEventListener(
        "animationend",
        function () {
          sprite.classList.remove("is-hit");
        },
        { once: true }
      );
    }
    if (fighterEl) {
      var popup = document.createElement("span");
      popup.className = "battle-damage-popup";
      popup.textContent = "-" + dmg;
      fighterEl.appendChild(popup);
      setTimeout(function () {
        popup.remove();
      }, 900);
    }
  }

  /* ----------------------------------------------------------
   * Characters: pixel-art fighters (DiceBear "Pixel Art" avatars,
   * generated from a fixed seed). The choice is saved per browser.
   * ---------------------------------------------------------- */
  var CHARACTER_SEEDS = [
    "Aiden", "Bella", "Carlo", "Dana", "Elio", "Faye", "Gabe", "Hana", "Ivan", "Jade",
    "Kai", "Luna", "Milo", "Nina", "Omar", "Pia", "Quinn", "Rico", "Sofia", "Theo",
    "Uma", "Vince", "Wren", "Xian", "Yuri", "Zara", "Axel", "Bea", "Cruz", "Dom",
  ];
  var CHARACTER_STORAGE_KEY = "learniq-battle-character";
  var selectedCharacter = (function () {
    try {
      var saved = localStorage.getItem(CHARACTER_STORAGE_KEY);
      return CHARACTER_SEEDS.indexOf(saved) !== -1 ? saved : CHARACTER_SEEDS[0];
    } catch (e) {
      return CHARACTER_SEEDS[0];
    }
  })();

  function characterAvatarUrl(seed) {
    return "https://api.dicebear.com/9.x/pixel-art/svg?seed=" + encodeURIComponent(seed);
  }

  /** Puts the chosen fighter into a sprite box; falls back to 🧑‍🎓 if the image can't load. */
  function renderCharacterInto(el, seed) {
    if (!el) return;
    el.innerHTML = "";
    var img = document.createElement("img");
    img.className = "battle-avatar-img";
    img.alt = "";
    img.src = characterAvatarUrl(seed || selectedCharacter);
    img.addEventListener("error", function () {
      el.textContent = "🧑‍🎓";
    });
    el.appendChild(img);
  }

  function renderCharacterPicker() {
    var grid = document.getElementById("battle-character-grid");
    if (!grid) return;
    if (!grid.childElementCount) {
      grid.innerHTML = CHARACTER_SEEDS.map(function (seed) {
        return (
          '<button type="button" class="battle-character-option" role="radio" data-character="' +
          esc(seed) +
          '" aria-label="Fighter ' +
          esc(seed) +
          '"><img src="' +
          characterAvatarUrl(seed) +
          '" alt="" loading="lazy" /></button>'
        );
      }).join("");
    }
    grid.querySelectorAll(".battle-character-option").forEach(function (btn) {
      var on = btn.getAttribute("data-character") === selectedCharacter;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
  }

  var characterDialogOpener = null;

  function setCharacterDialogOpen(open) {
    var dialog = document.getElementById("battle-character-dialog");
    var sprite = document.getElementById("battle-player-sprite");
    if (!dialog) return;
    if (open) {
      renderCharacterPicker();
      characterDialogOpener = document.activeElement;
    }
    dialog.hidden = !open;
    // Don't let the clock run while choosing mid-battle.
    if (fight && fight.started && !fight.ended) {
      fight.paused = open;
      if (!open) battleTimerLastTick = Date.now();
    }
    if (sprite) sprite.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      dialog.querySelector(".battle-character-option.is-active")?.focus();
    } else if (characterDialogOpener && characterDialogOpener.isConnected && characterDialogOpener.offsetParent) {
      characterDialogOpener.focus();
    } else if (sprite) {
      sprite.focus();
    }
  }

  /** Click your fighter in the arena to open the picker; picking one swaps it right away. */
  function setupCharacterPicker() {
    var grid = document.getElementById("battle-character-grid");
    var dialog = document.getElementById("battle-character-dialog");
    var sprite = document.getElementById("battle-player-sprite");
    if (!grid || !dialog) return;

    sprite?.addEventListener("click", function () {
      setCharacterDialogOpen(true);
    });
    sprite?.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setCharacterDialogOpen(true);
      }
    });
    document.getElementById("battle-character-close")?.addEventListener("click", function () {
      setCharacterDialogOpen(false);
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) setCharacterDialogOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dialog.hidden) setCharacterDialogOpen(false);
    });

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest(".battle-character-option");
      var seed = btn && btn.getAttribute("data-character");
      if (!seed) return;
      selectedCharacter = seed;
      try {
        localStorage.setItem(CHARACTER_STORAGE_KEY, seed);
      } catch (err) {
        /* ignore */
      }
      renderCharacterPicker();
      ["battle-player-sprite", "wc-fighter-sprite", "wc-player-sprite"].forEach(function (id) {
        renderCharacterInto(document.getElementById(id), seed);
      });
      playClickSound();
      setCharacterDialogOpen(false);
    });
  }

  /* ----------------------------------------------------------
   * Monster ladder: every win moves to the next monster. After the
   * 20th (the Three-Headed Dragon) it keeps coming back at a higher
   * level with no cap. Stronger monsters hit back harder.
   * ---------------------------------------------------------- */
  var MONSTERS = [
    { name: "Green Slime", sprite: "🦠" },
    { name: "Giant Rat", sprite: "🐀" },
    { name: "Cave Bat", sprite: "🦇" },
    { name: "Goblin", sprite: "👺" },
    { name: "Venom Spider", sprite: "🕷️" },
    { name: "Dire Wolf", sprite: "🐺" },
    { name: "Skeleton Warrior", sprite: "💀" },
    { name: "Swamp Zombie", sprite: "🧟" },
    { name: "Phantom", sprite: "👻" },
    { name: "Sand Scorpion", sprite: "🦂" },
    { name: "War Boar", sprite: "🐗" },
    { name: "Ogre", sprite: "👹" },
    { name: "Stone Golem", sprite: "🗿" },
    { name: "Vampire Lord", sprite: "🧛" },
    { name: "Kraken", sprite: "🦑" },
    { name: "Fire Elemental", sprite: "🔥" },
    { name: "Dark Sorcerer", sprite: "🧙" },
    { name: "Chimera", sprite: "🦁" },
    { name: "Wyvern", sprite: "🐉" },
    { name: "Three-Headed Dragon", sprite: "🐲🐲🐲", boss: true },
  ];

  /** stage = AI defeated so far (0 = first battle). */
  function monsterForStage(stage) {
    var n = Math.max(0, Math.floor(Number(stage) || 0));
    var idx = Math.min(n, MONSTERS.length - 1);
    var m = MONSTERS[idx];
    return {
      name: m.name,
      sprite: m.sprite,
      boss: !!m.boss,
      level: n + 1,
      // Extra counter-attack damage: +1 every 2 monsters, then +1 every 5 levels past the dragon.
      power: Math.floor(idx / 2) + (n > MONSTERS.length - 1 ? Math.floor((n - (MONSTERS.length - 1)) / 5) : 0),
    };
  }

  function currentStage() {
    return typeof menuStats === "function" ? menuStats().wins : 0;
  }

  function renderMonster(monster) {
    var sprite = document.getElementById("battle-ai-sprite");
    var nameEl = document.getElementById("battle-ai-name");
    var levelEl = document.getElementById("battle-ai-level");
    if (sprite) {
      sprite.classList.toggle("is-boss", monster.boss);
      sprite.innerHTML = monster.boss
        ? '<span class="battle-monster-heads"><span>🐲</span><span>🐲</span><span>🐲</span></span>'
        : esc(monster.sprite);
    }
    if (nameEl) nameEl.textContent = monster.name;
    if (levelEl) levelEl.textContent = "Lv " + monster.level;
  }

  /** Stage select panel: the monster the next battle will be against. */
  function renderNextOpponent() {
    var m = monsterForStage(currentStage());
    var sprite = document.getElementById("wc-opponent-sprite");
    var name = document.getElementById("wc-opponent-name");
    if (sprite) sprite.textContent = m.boss ? "🐲" : m.sprite;
    if (name) name.textContent = m.name.toUpperCase() + " · LV " + m.level;
  }

  /* ----------------------------------------------------------
   * Energy-beam attack (charge ball + beam from the player to the
   * monster), drawn inside the battle stage.
   * ---------------------------------------------------------- */
  function fireEnergyBeam() {
    var stage = document.querySelector(".battle-stage");
    var from = document.getElementById("battle-player-sprite");
    var to = document.getElementById("battle-ai-sprite");
    if (!stage || !from || !to) return;
    var sRect = stage.getBoundingClientRect();
    var a = from.getBoundingClientRect();
    var b = to.getBoundingClientRect();
    var startX = a.right - sRect.left - a.width * 0.15;
    var endX = b.left - sRect.left + b.width * 0.4;
    var y = a.top - sRect.top + a.height * 0.55;
    if (endX <= startX) return;

    var charge = document.createElement("div");
    charge.className = "battle-beam-charge";
    charge.style.left = startX + "px";
    charge.style.top = y + "px";

    var beam = document.createElement("div");
    beam.className = "battle-beam";
    beam.style.left = startX + "px";
    beam.style.top = y + "px";
    beam.style.width = endX - startX + "px";

    var impact = document.createElement("div");
    impact.className = "battle-beam-impact";
    impact.style.left = endX + "px";
    impact.style.top = y + "px";

    stage.appendChild(charge);
    stage.appendChild(beam);
    stage.appendChild(impact);
    setTimeout(function () {
      charge.remove();
      beam.remove();
      impact.remove();
    }, 1100);
  }

  function showHealPopup(amount) {
    var fighterEl = document.getElementById("battle-player-fighter");
    if (!fighterEl) return;
    var popup = document.createElement("span");
    popup.className = "battle-damage-popup battle-heal-popup";
    popup.textContent = "+" + amount + " HP";
    fighterEl.appendChild(popup);
    setTimeout(function () {
      popup.remove();
    }, 900);
  }

  function onAttackClick() {
    if (!fight || !fight.selected.length) return;
    var word = fight.selected.map(function (idx) { return fight.grid[idx].letter; }).join("").toLowerCase();

    if (word === fight.currentAnswer) {
      logAnswer("correct");
      var dmg = damageForWordLength(word.length);
      var meaning = fight.currentMeaning || "";
      fight.aiHp = Math.max(0, fight.aiHp - dmg);
      fight.wordsUsed.unshift({ word: word, damage: dmg, meaning: meaning });

      adjustBattleTime(TIME_BONUS_CORRECT);
      fight.streak += 1;
      var streakHit = fight.streak % STREAK_FOR_HEAL === 0;
      var healed = 0;
      if (streakHit) {
        var hpBefore = fight.playerHp;
        fight.playerHp = Math.min(PLAYER_MAX_HP, fight.playerHp + STREAK_HEAL_HP);
        healed = fight.playerHp - hpBefore;
        showHealPopup(STREAK_HEAL_HP);
      }
      renderStreak();

      renderHp();
      renderWordsUsed();
      playTrack(streakHit ? sfxWinStreak : sfxCorrect);
      triggerAttackAnim("player");
      fireEnergyBeam();
      setTimeout(function () {
        playTrack(sfxAttack);
      }, 250);
      setTimeout(function () {
        triggerHitAnim("ai", dmg);
        playHitSound();
      }, 600);

      if (typeof showToast === "function") {
        showToast(
          "Correct! " + dmg + " damage dealt, +" + TIME_BONUS_CORRECT + "s." +
            (streakHit
              ? " " + STREAK_FOR_HEAL + " in a row: +" + STREAK_HEAL_HP + " HP" + (healed < STREAK_HEAL_HP ? " (HP full)" : "") + "!"
              : "") +
            (meaning ? " " + meaning : ""),
          "success"
        );
      }

      if (fight.aiHp <= 0) {
        endBattle("win");
        return;
      }
      setTimeout(function () {
        advanceToQuestion(fight.questionIndex + 1);
      }, 700);
      return;
    }

    logAnswer("wrong", word);
    playTrack(sfxWrong);
    var counterDmg = 6 + Math.floor(Math.random() * 9) + (fight.monster ? fight.monster.power : 0);
    fight.playerHp = Math.max(0, fight.playerHp - counterDmg);
    fight.selected = [];
    fight.streak = 0;
    renderStreak();
    adjustBattleTime(-TIME_PENALTY_WRONG);

    renderHp();
    renderGrid();
    renderWordPreview();
    triggerAttackAnim("ai");
    playAttackSound("ai");
    setTimeout(function () {
      triggerHitAnim("player", counterDmg);
      playHitSound();
    }, 200);

    if (typeof showToast === "function") {
      showToast(
        "Not quite — the " + (fight.monster ? fight.monster.name : "AI") + " hits back for " + counterDmg + "! -" + TIME_PENALTY_WRONG + "s",
        "error"
      );
    }

    if (fight.playerHp <= 0) {
      endBattle("lose");
    } else if (fight.timeLeft <= 0) {
      fight.endReason = "time";
      endBattle("lose");
    }
  }

  function battleResultSummary() {
    var count = fight ? fight.wordsUsed.length : 0;
    var totalDamage = fight ? fight.wordsUsed.reduce(function (sum, e) { return sum + e.damage; }, 0) : 0;
    return count + " correct answer" + (count === 1 ? "" : "s") + ", " + totalDamage + " total damage dealt.";
  }

  /** Points, EXP and level change for the battle that just ended. */
  function computeBattleProgress(outcome) {
    var correct = fight ? fight.wordsUsed.length : 0;
    var points = fight ? fight.wordsUsed.reduce(function (sum, e) { return sum + e.damage; }, 0) : 0;
    var exp = battleExpForResult(outcome, correct);
    var prevExp = Number((battleStats && battleStats.total_exp) || 0);
    var prevBest = Number((battleStats && battleStats.best_score) || 0);
    var totalExp = prevExp + exp;
    var levelBefore = Math.floor(prevExp / EXP_PER_LEVEL);
    var levelAfter = Math.floor(totalExp / EXP_PER_LEVEL);
    return {
      points: points,
      correct: correct,
      exp: exp,
      totalExp: totalExp,
      expIntoLevel: totalExp % EXP_PER_LEVEL,
      levelBefore: levelBefore,
      levelAfter: levelAfter,
      leveledUp: levelAfter > levelBefore,
      bestScore: Math.max(prevBest, points),
      newBest: points > prevBest,
    };
  }

  function renderResultProgress(progress) {
    var el = document.getElementById("battle-result-progress");
    if (!el) return;
    if (!progress) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    var pct = Math.round((progress.expIntoLevel / EXP_PER_LEVEL) * 100);
    el.innerHTML =
      '<div class="battle-result-stats">' +
      '<div class="battle-result-stat"><span>Points</span><strong>' + progress.points + "</strong></div>" +
      '<div class="battle-result-stat"><span>EXP</span><strong>+' + progress.exp + "</strong></div>" +
      '<div class="battle-result-stat"><span>Level</span><strong>' + progress.levelAfter + "</strong></div>" +
      '<div class="battle-result-stat"><span>Best</span><strong>' + progress.bestScore + "</strong></div>" +
      "</div>" +
      '<div class="battle-result-exp" aria-label="EXP to next level">' +
      '<div class="battle-result-exp-bar"><div class="battle-result-exp-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="battle-result-exp-text">' + progress.expIntoLevel + " / " + EXP_PER_LEVEL + " EXP to Level " + (progress.levelAfter + 1) + "</span>" +
      "</div>" +
      (progress.leveledUp
        ? '<p class="battle-result-flag is-levelup"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Level up! You reached Level ' + progress.levelAfter + "</p>"
        : "") +
      (progress.newBest
        ? '<p class="battle-result-flag is-best"><i class="fa-solid fa-star" aria-hidden="true"></i> New personal best: ' + progress.points + " points</p>"
        : "");
    el.hidden = false;
  }

  /* ----------------------------------------------------------
   * Answer review: results screen and Battle Log detail
   * ---------------------------------------------------------- */
  function renderReviewList(listEl, answers) {
    if (!listEl) return;
    if (!Array.isArray(answers)) {
      listEl.innerHTML =
        '<li class="wc-review-empty">Answers weren\'t saved for this battle. Battles from now on keep every answer.</li>';
      return;
    }
    if (!answers.length) {
      listEl.innerHTML = '<li class="wc-review-empty">No questions were answered in this battle.</li>';
      return;
    }
    listEl.innerHTML = answers
      .map(function (row) {
        var tries = (Array.isArray(row.attempts) ? row.attempts : []).filter(Boolean);
        var result = row.result === "correct" ? "correct" : row.result === "skipped" ? "skipped" : "unanswered";
        var state = result === "correct" ? "correct" : tries.length ? "wrong" : result;
        var icon = { correct: "fa-check", wrong: "fa-xmark", skipped: "fa-forward", unanswered: "fa-hourglass-end" }[state];
        var status =
          state === "correct"
            ? tries.length
              ? "Correct after " + (tries.length + 1) + " tries"
              : "Correct"
            : state === "wrong"
            ? result === "skipped"
              ? "Wrong, then skipped"
              : "Wrong"
            : result === "skipped"
            ? "Skipped"
            : "Not answered";
        var hints = Number(row.hints || 0);
        return (
          '<li class="wc-review-item is-' + state + '">' +
          '<span class="wc-review-icon" aria-hidden="true"><i class="fa-solid ' + icon + '"></i></span>' +
          '<div class="wc-review-body">' +
          '<p class="wc-review-q">' + esc(row.question || "") + "</p>" +
          '<p class="wc-review-a"><span class="wc-review-status">' +
          esc(status) +
          (hints ? " · " + hints + (hints === 1 ? " hint" : " hints") : "") +
          "</span>" +
          (tries.length
            ? ' <span class="wc-review-tries">You tried: ' +
              esc(tries.map(function (w) { return String(w).toUpperCase(); }).join(", ")) +
              "</span>"
            : "") +
          "</p>" +
          '<p class="wc-review-answer">Answer: <strong>' +
          esc(String(row.answer || "").toUpperCase()) +
          "</strong>" +
          (row.meaning ? ' <span class="wc-review-meaning">— ' + esc(row.meaning) + "</span>" : "") +
          "</p>" +
          "</div></li>"
        );
      })
      .join("");
  }

  function showResults(outcome, progress) {
    var title = document.getElementById("wc-results-title");
    var sub = document.getElementById("wc-results-sub");
    var again = document.getElementById("wc-play-again");
    var monster = fight && fight.monster ? fight.monster.name : "monster";
    var timeUp = fight && fight.endReason === "time";
    if (title) {
      title.textContent = outcome === "win" ? "VICTORY!" : timeUp ? "TIME'S UP!" : "DEFEAT";
      title.classList.toggle("is-win", outcome === "win");
    }
    if (sub) {
      sub.textContent =
        (outcome === "win"
          ? "You defeated the " + monster + "! "
          : timeUp
          ? "The clock ran out. "
          : "The " + monster + " won this time. ") + battleResultSummary();
    }
    renderResultProgress(progress);
    renderReviewList(document.getElementById("wc-results-review"), fight ? fight.answerLog || [] : []);
    if (again) again.textContent = outcome === "win" ? "PLAY AGAIN" : "TRY AGAIN";
    showScreen("results", { noFocus: true });
    again?.focus({ preventScroll: true });
  }

  function endBattle(outcome) {
    if (!fight || fight.ended) return;
    fight.ended = true;
    closePause(true);
    stopBattleTimer();
    stopTrack(battleMusic);
    stopTrack(sfxTimerRunsOut);
    fight.lastOutcome = outcome;
    if (outcome === "win") {
      playVictorySound();
    } else {
      playTrack(gameOverSound);
    }
    var progress = computeBattleProgress(outcome);
    saveBattleResultToHistory(outcome, progress);
    requestMoreQuestionsIfLow();

    // Update locally right away; the server copy is refreshed once history is saved.
    var prevStats = battleStats || {};
    battleStats = Object.assign({}, prevStats, {
      level: progress.levelAfter,
      total_exp: progress.totalExp,
      exp_into_level: progress.expIntoLevel,
      best_score: progress.bestScore,
    });
    if (typeof prevStats.wins === "number") {
      battleStats.wins = prevStats.wins + (outcome === "win" ? 1 : 0);
      battleStats.battles = Number(prevStats.battles || 0) + 1;
    }

    // Let the last hit and the victory / game-over sound play before the results screen.
    var endedFight = fight;
    setTimeout(function () {
      if (fight === endedFight) showResults(outcome, progress);
    }, 1100);
    setTimeout(function () {
      void loadBattleStats();
      void loadBattleLog();
    }, 1800);
  }

  function saveBattleResultToHistory(outcome, progress) {
    if (!fight) return;
    var p = progress || computeBattleProgress(outcome);
    var entry = {
      lesson_id: fight.lessonId || null,
      lesson_title: selectedLesson ? lessonTitle(selectedLesson) : "Word Clash",
      subject_name: selectedLesson ? String(selectedLesson.subject_name || "") : "",
      game: "word-clash",
      outcome: outcome,
      difficulty: fight.difficulty || "normal",
      correct_answers: p.correct,
      total_damage: p.points,
      score: p.points,
      exp_gained: p.exp,
      level_after: p.levelAfter,
      total_exp_after: p.totalExp,
      leveled_up: p.leveledUp,
      new_best: p.newBest,
      answers: (fight.answerLog || []).map(function (e) {
        return {
          question: e.question,
          answer: e.answer,
          meaning: e.meaning,
          result: e.result,
          attempts: e.attempts.slice(),
          hints: e.hints,
        };
      }),
    };
    // Shown in the Battle Log and stage stars right away; replaced by the server copy on refresh.
    battleLog.unshift(Object.assign({ timestamp: new Date().toISOString() }, entry));
    if (typeof recordStudentHistory === "function") recordStudentHistory("battle", entry);
  }

  function resetFightForRebattle() {
    if (!fight) return;
    fight.monster = monsterForStage(currentStage());
    renderMonster(fight.monster);
    fight.playerHp = PLAYER_MAX_HP;
    fight.aiHp = AI_MAX_HP;
    fight.wordsUsed = [];
    fight.answerLog = [];
    fight.currentLog = null;
    fight.hintsLeft = HINTS_PER_BATTLE;
    renderHintButton();
    var pick = pickBattleQuestions(fight.bank || fight.questions, fight.lessonId);
    fight.questions = pick.questions;
    fight.unseenKeys = pick.unseenKeys;
    renderHp();
    renderWordsUsed();
    advanceToQuestion(0);
    resetBattleClock();
  }

  function showMenu() {
    renderMenuPlayer();
    showScreen("menu");
  }

  /** Leaves the battle (or its results) for the main menu or the stage list. */
  function leaveFight(target) {
    stopBattleTimer();
    stopAllMusic();
    setBattleWaiting(false);
    closePause(true);
    fight = null;
    if (target === "stages" && currentWorldId && subjects.length) {
      openStages(currentWorldId);
    } else {
      showMenu();
    }
    ensureIntroMusic();
  }

  /* ----------------------------------------------------------
   * Question bank: each lesson + difficulty has one bank on the server,
   * shared by every student and growing over time (backend
   * /generate-battle-questions). A battle shows the questions this student
   * hasn't seen first, then the ones they missed last time, then the rest.
   * When fewer than MORE_QUESTIONS_BELOW unseen ones are left, the server is
   * asked to add more in the background for the next battle.
   * ---------------------------------------------------------- */
  var QUESTIONS_PER_BATTLE = 12;
  var MORE_QUESTIONS_BELOW = 6;
  var BANK_MAX = 60; // keep in sync with BATTLE_BANK_MAX in backend/main.py

  function answerKey(word) {
    return String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  /** Latest result per answer word in this student's battles on a lesson: "missed" or "mastered". */
  function questionHistory(lessonId) {
    var state = {};
    // battleLog is newest first, so the first time a word shows up is its latest result.
    battleLog.forEach(function (b) {
      if (String(b.lesson_id || "") !== String(lessonId) || !Array.isArray(b.answers)) return;
      b.answers.forEach(function (a) {
        var key = answerKey(a && a.answer);
        if (!key || state[key]) return;
        var clean = a.result === "correct" && !(a.attempts && a.attempts.length) && !Number(a.hints || 0);
        state[key] = clean ? "mastered" : "missed";
      });
    });
    return state;
  }

  /** Up to 12 questions: never seen first, then missed last time, then the rest (each group shuffled). */
  function pickBattleQuestions(bank, lessonId) {
    var state = questionHistory(lessonId);
    var unseen = [];
    var missed = [];
    var mastered = [];
    bank.forEach(function (q) {
      var s = state[answerKey(q.answer)];
      (s === "missed" ? missed : s === "mastered" ? mastered : unseen).push(q);
    });
    return {
      questions: shuffleArray(unseen)
        .concat(shuffleArray(missed), shuffleArray(mastered))
        .slice(0, QUESTIONS_PER_BATTLE),
      unseenKeys: unseen.map(function (q) {
        return answerKey(q.answer);
      }),
    };
  }

  function bankForDifficulty(content, difficulty) {
    return normalizeQuestionEntries(content.battleQuestions).filter(function (q) {
      return q.difficulty === difficulty;
    });
  }

  /** The lesson's bank for one difficulty; the first player of a lesson waits for the AI's first batch. */
  async function loadQuestionBank(fileId, difficulty) {
    var bank = bankForDifficulty(await loadLessonContentAndVocab(fileId), difficulty);
    if (bank.length >= 5) return bank;
    setLoadingHint("Generating " + difficultyConfig(difficulty).label.toLowerCase() + " battle questions with AI…");
    try {
      bank = normalizeQuestionEntries(await generateBattleQuestionsWithAi(fileId, difficulty));
    } catch (err) {
      // 400/404: the lesson file has no readable text (or is missing) — retrying won't help.
      if (err && (err.status === 400 || err.status === 404)) {
        throw new Error(
          "This lesson's file can't be read, so Word Clash can't make questions for it. Ask your teacher to upload it again."
        );
      }
      var message = (err && err.message) || "Couldn't make questions for this lesson.";
      throw new Error(/try again/i.test(message) ? message : message + " Press FIGHT to try again.");
    }
    if (bank.length < 5) throw new Error("Couldn't make questions for this lesson. Press FIGHT to try again.");
    return bank;
  }

  /** After a battle: if this student has (almost) seen the whole bank, ask the server for more. */
  function requestMoreQuestionsIfLow() {
    if (!fight || !fight.bankSize || fight.bankSize >= BANK_MAX) return;
    var shown = {};
    (fight.answerLog || []).forEach(function (e) {
      shown[answerKey(e.answer)] = true;
    });
    var unseenLeft = (fight.unseenKeys || []).filter(function (k) {
      return !shown[k];
    }).length;
    if (unseenLeft >= MORE_QUESTIONS_BELOW) return;
    fetch(apiUrl("/generate-battle-questions"), {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify({ file_id: fight.lessonId, difficulty: fight.difficulty, mode: "more" }),
    }).catch(function () {
      /* best effort: the next battle just repeats a few questions */
    });
  }

  async function startBattle() {
    if (!selectedLesson) return;

    var fileId = selectedLessonId;
    setStageAlert("");
    ensureIntroMusic();
    renderCharacterInto(document.getElementById("battle-loading-sprite"), selectedCharacter);
    showLoadingScreen();
    setLoadingHint("Preparing your battle…");

    try {
      var difficulty = selectedDifficulty;
      // The Battle Log says which questions this student has seen (deep links skip the menus that load it).
      var loaded = await Promise.all([loadQuestionBank(fileId, difficulty), battleLogLoaded ? null : loadBattleLog()]);
      var bank = loaded[0];
      var pick = pickBattleQuestions(bank, fileId);

      fight = {
        lessonId: fileId,
        bank: bank,
        bankSize: bank.length,
        unseenKeys: pick.unseenKeys,
        questions: pick.questions,
        questionIndex: 0,
        currentAnswer: "",
        currentMeaning: "",
        grid: [],
        selected: [],
        playerHp: PLAYER_MAX_HP,
        aiHp: AI_MAX_HP,
        wordsUsed: [],
        answerLog: [],
        currentLog: null,
        hintsLeft: HINTS_PER_BATTLE,
        difficulty: difficulty,
        monster: monsterForStage(currentStage()),
      };
      renderMonster(fight.monster);
      renderCharacterInto(document.getElementById("battle-player-sprite"), selectedCharacter);
      renderHintButton();

      var playerNameEl = document.getElementById("battle-fight-player-name");
      if (playerNameEl) playerNameEl.textContent = playerDisplayName();

      showFightScreenEl();
      renderHp();
      renderWordsUsed();
      advanceToQuestion(0);
      resetBattleClock();
    } catch (err) {
      fight = null;
      stopIntroMusic();
      var message = (err && err.message) || "Could not start battle.";
      if (currentWorldId && subjects.length) {
        openStages(currentWorldId);
        setStageAlert(message); // stays visible, unlike a toast
      } else {
        showMenu();
        if (typeof showToast === "function") showToast(message, "error");
      }
    }
  }

  /** Same lesson and questions (reshuffled), full HP, fresh timer, back on the Ready screen. */
  function restartBattle(options) {
    if (!fight) return;
    var opts = options || {};
    stopBattleTimer();
    closePause(true);
    showFightScreenEl();
    ALL_TRACKS.forEach(stopTrack);
    if (opts.tryAgain) {
      // "Try Again" after a loss: play try again.mp3 first, then the intro music.
      playTrack(sfxTryAgain);
      var el = sfxTryAgain.el;
      var started = false;
      var startIntro = function () {
        if (started || !fight || fight.started) return;
        started = true;
        playIntroMusic();
      };
      if (el) el.addEventListener("ended", startIntro, { once: true });
      setTimeout(startIntro, 4000); // fallback if the clip can't play
    } else {
      playIntroMusic();
    }
    resetFightForRebattle();
  }

  /** Results → PLAY AGAIN / TRY AGAIN: same stage, picked again from the bank (it may have grown). */
  var playAgainBusy = false;

  async function playAgain() {
    var current = fight;
    if (!current || playAgainBusy) return;
    playAgainBusy = true;
    try {
      var bank = bankForDifficulty(await loadLessonContentAndVocab(current.lessonId), current.difficulty);
      if (bank.length >= 5) {
        current.bank = bank;
        current.bankSize = bank.length;
      }
    } catch (e) {
      /* keep the bank we have */
    }
    playAgainBusy = false;
    // Reads "Try Again" after a loss and "Play Again" after a win.
    if (fight === current) restartBattle({ tryAgain: current.lastOutcome !== "win" });
  }

  /* ----------------------------------------------------------
   * Pause menu (Pause button / Esc during a battle). The clock stops
   * while it is open.
   * ---------------------------------------------------------- */
  function openPause() {
    if (!fight || fight.ended) return;
    var el = document.getElementById("wc-pause");
    if (!el || !el.hidden) return;
    fight.paused = true;
    el.hidden = false;
    var restart = el.querySelector('[data-wc-pause="restart"]');
    if (restart) restart.hidden = !fight.started;
    focusFirst(el);
    playClickSound();
  }

  /** silent: just hide it (battle ending / leaving) without restarting the clock. */
  function closePause(silent) {
    var el = document.getElementById("wc-pause");
    if (!el || el.hidden) return;
    el.hidden = true;
    if (silent || !fight) return;
    fight.paused = false;
    battleTimerLastTick = Date.now(); // time spent paused doesn't count
    document.getElementById("battle-pause-btn")?.focus({ preventScroll: true });
  }

  async function confirmDialog(opts) {
    if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
      return window.LearnIQConfirm.show(Object.assign({ variant: "danger" }, opts));
    }
    return window.confirm(opts.message || opts.title);
  }

  async function onPauseAction(action) {
    if (action === "resume") {
      playClickSound();
      closePause();
    } else if (action === "restart") {
      playClickSound();
      restartBattle();
    } else if (action === "settings") {
      playClickSound();
      document.getElementById("wc-pause").hidden = true; // stays paused while in Settings
      openSettings("pause");
    } else if (action === "quit") {
      var ok = await confirmDialog({
        title: "Quit to menu?",
        message: fight && fight.started ? "This battle won't be saved." : "You'll go back to the main menu.",
        confirmText: "Quit",
        cancelText: "Keep playing",
      });
      if (ok) leaveFight("menu");
      else document.querySelector('[data-wc-pause="quit"]')?.focus();
    }
  }

  /* ----------------------------------------------------------
   * Battle Log: saved battles with their answers
   * ---------------------------------------------------------- */
  function formatLogDate(iso) {
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function difficultyLabel(key) {
    return BATTLE_DIFFICULTIES[key] ? BATTLE_DIFFICULTIES[key].label.toUpperCase() : "NORMAL";
  }

  function logLessonName(b) {
    return stageLabel({ filename: b.lesson_title || "Lesson" });
  }

  async function openBattleLog() {
    showScreen("log", { noFocus: true });
    var status = document.getElementById("wc-log-status");
    var list = document.getElementById("wc-log-list");
    if (status) {
      status.hidden = false;
      status.textContent = "Loading…";
    }
    if (list) list.innerHTML = "";
    await loadBattleLog();
    renderBattleLog();
    var first = list && list.querySelector(".wc-log-item");
    if (first) first.focus({ preventScroll: true });
    else focusFirst(screenEl("log"));
  }

  function renderBattleLog() {
    var status = document.getElementById("wc-log-status");
    var list = document.getElementById("wc-log-list");
    if (!list) return;
    if (!battleLog.length) {
      if (status) {
        status.hidden = false;
        status.textContent = "No battles yet. Press START and pick a stage!";
      }
      list.innerHTML = "";
      return;
    }
    if (status) status.hidden = true;
    list.innerHTML = battleLog
      .map(function (b, i) {
        var won = String(b.outcome || "").toLowerCase() === "win";
        var meta = [formatLogDate(b.timestamp), difficultyLabel(b.difficulty), b.subject_name || ""].filter(Boolean);
        return (
          '<li><button type="button" class="wc-log-item ' + (won ? "is-win" : "is-loss") + '" data-log-index="' + i + '">' +
          '<span class="wc-log-outcome">' +
          (won ? '<i class="fa-solid fa-star" aria-hidden="true"></i> WON' : '<i class="fa-solid fa-xmark" aria-hidden="true"></i> LOST') +
          "</span>" +
          '<span class="wc-log-main"><span class="wc-log-lesson">' + esc(logLessonName(b)) + "</span>" +
          '<span class="wc-log-meta">' + esc(meta.join(" · ")) + "</span></span>" +
          '<span class="wc-log-score">' + Number(b.score != null ? b.score : b.total_damage || 0) + " PTS</span>" +
          "</button></li>"
        );
      })
      .join("");
  }

  function openLogDetail(index) {
    var b = battleLog[index];
    if (!b) return;
    var won = String(b.outcome || "").toLowerCase() === "win";
    var title = document.getElementById("wc-log-detail-title");
    var summary = document.getElementById("wc-log-detail-summary");
    if (title) {
      title.textContent = won ? "VICTORY" : "DEFEAT";
      title.classList.toggle("is-win", won);
      title.classList.toggle("is-loss", !won);
    }
    if (summary) {
      var chips = [
        formatLogDate(b.timestamp),
        difficultyLabel(b.difficulty),
        Number(b.score != null ? b.score : b.total_damage || 0) + " PTS",
        b.exp_gained != null ? "+" + Number(b.exp_gained) + " EXP" : "",
        Number(b.correct_answers || 0) + " CORRECT",
        b.level_after != null ? "LV " + Number(b.level_after) : "",
        b.new_best ? "NEW BEST!" : "",
        b.leveled_up ? "LEVEL UP!" : "",
      ].filter(Boolean);
      summary.innerHTML =
        '<p class="wc-log-detail-lesson">' + esc(logLessonName(b)) + "</p>" +
        (b.subject_name ? '<p class="wc-log-detail-subject">' + esc(b.subject_name) + "</p>" : "") +
        '<div class="wc-chip-row">' +
        chips.map(function (c) { return '<span class="wc-chip">' + esc(c) + "</span>"; }).join("") +
        "</div>";
    }
    renderReviewList(document.getElementById("wc-log-detail-review"), Array.isArray(b.answers) ? b.answers : null);
    showScreen("log-detail");
  }

  /* ----------------------------------------------------------
   * Main menu, PRESS START and keyboard controls
   * ---------------------------------------------------------- */
  function pressStart() {
    if (activeScreen !== "splash") return;
    getAudioCtx();
    ensureIntroMusic();
    playClickSound();
    showMenu();
  }

  async function quitGame() {
    var ok = await confirmDialog({
      title: "Leave Word Clash?",
      message: "You'll go back to the Arcade.",
      confirmText: "Quit",
      cancelText: "Stay",
    });
    if (ok) {
      stopAllMusic();
      window.location.href = "arcade.html";
    } else {
      document.querySelector('[data-wc-action="quit"]')?.focus();
    }
  }

  function onMenuAction(action) {
    playClickSound();
    if (action === "start") void openWorlds();
    else if (action === "log") void openBattleLog();
    else if (action === "settings") openSettings("menu");
    else if (action === "quit") void quitGame();
  }

  /** Arrow keys move between the main choices of each screen, like a game menu. */
  var NAV_BY_SCREEN = {
    menu: ".wc-menu-item",
    worlds: ".wc-world:not([disabled])",
    stages: ".wc-stage",
    log: ".wc-log-item",
    results: ".wc-btn-row .wc-btn",
  };

  function moveFocus(root, selector, dir) {
    if (!root) return;
    var items = Array.prototype.filter.call(root.querySelectorAll(selector), function (el) {
      return !el.disabled && !el.hidden && el.offsetParent !== null;
    });
    if (!items.length) return;
    var idx = items.indexOf(document.activeElement);
    var next = idx === -1 ? items[0] : items[(idx + dir + items.length) % items.length];
    next.focus();
    playTone(520, 0.03, "square");
  }

  function onGlobalKeydown(e) {
    if (e.defaultPrevented) return;
    if (document.querySelector(".learniq-confirm-backdrop")) return; // the dialog handles its own keys
    var charDialog = document.getElementById("battle-character-dialog");
    if (charDialog && !charDialog.hidden) return;
    var key = e.key;
    var dir = key === "ArrowDown" || key === "ArrowRight" ? 1 : key === "ArrowUp" || key === "ArrowLeft" ? -1 : 0;
    var fightScreen = document.getElementById("battle-fight-screen");
    var pause = document.getElementById("wc-pause");
    if (fightScreen && !fightScreen.hidden) {
      if (key === "Escape") {
        e.preventDefault();
        if (pause && !pause.hidden) closePause();
        else openPause();
      } else if (pause && !pause.hidden && dir && (key === "ArrowDown" || key === "ArrowUp")) {
        e.preventDefault();
        moveFocus(pause, ".wc-menu-item", dir);
      }
      return;
    }
    var loading = document.getElementById("battle-loading-screen");
    if (loading && !loading.hidden) return;
    if (activeScreen === "splash") {
      if (key === "Enter" || key === " ") {
        e.preventDefault();
        pressStart();
      }
      return;
    }
    if (key === "Escape") {
      e.preventDefault();
      goBack();
      return;
    }
    var tag = (e.target && e.target.tagName) || "";
    if (!dir || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    var selector = NAV_BY_SCREEN[activeScreen];
    if (!selector) return;
    e.preventDefault();
    moveFocus(screenEl(activeScreen), selector, dir);
  }

  function setupBattleArenaPage() {
    setupSettings();
    setupCharacterPicker();
    setupDifficultyPicker();
    renderMenuPlayer();
    void loadBattleStats().then(renderMenuPlayer);
    void loadBattleLog();

    document.getElementById("wc-press-start")?.addEventListener("click", pressStart);
    // Tapping anywhere on the title screen also counts as PRESS START.
    document.getElementById("wc-splash")?.addEventListener("click", function (e) {
      if (!e.target.closest("button")) pressStart();
    });
    document.querySelectorAll("[data-wc-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onMenuAction(btn.getAttribute("data-wc-action"));
      });
    });
    document.querySelectorAll("[data-wc-back]").forEach(function (btn) {
      btn.addEventListener("click", goBack);
    });
    document.getElementById("wc-world-grid")?.addEventListener("click", function (e) {
      var btn = e.target.closest(".wc-world[data-world-id]");
      if (!btn || btn.disabled) return;
      playClickSound();
      openStages(btn.getAttribute("data-world-id"));
    });
    document.getElementById("wc-stage-list")?.addEventListener("click", onStageListClick);
    document.getElementById("wc-fight-btn")?.addEventListener("click", function () {
      if (!selectedLesson) return;
      playClickSound();
      void startBattle();
    });
    document.getElementById("wc-change-fighter")?.addEventListener("click", function () {
      playClickSound();
      setCharacterDialogOpen(true);
    });
    document.getElementById("wc-log-list")?.addEventListener("click", function (e) {
      var btn = e.target.closest(".wc-log-item[data-log-index]");
      if (!btn) return;
      playClickSound();
      openLogDetail(Number(btn.getAttribute("data-log-index")));
    });
    document.getElementById("wc-play-again")?.addEventListener("click", function () {
      void playAgain();
    });
    document.getElementById("wc-results-stages")?.addEventListener("click", function () {
      playClickSound();
      leaveFight("stages");
    });
    document.getElementById("wc-results-menu")?.addEventListener("click", function () {
      playClickSound();
      leaveFight("menu");
    });
    document.getElementById("battle-pause-btn")?.addEventListener("click", openPause);
    document.querySelectorAll("[data-wc-pause]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        void onPauseAction(btn.getAttribute("data-wc-pause"));
      });
    });
    document.addEventListener("keydown", onGlobalKeydown);

    document.getElementById("battle-letter-grid")?.addEventListener("click", onTileClick);
    document.getElementById("battle-clear-btn")?.addEventListener("click", onClearClick);
    document.getElementById("battle-backspace-btn")?.addEventListener("click", onBackspaceClick);
    document.addEventListener("keydown", onBackspaceKey);
    document.getElementById("battle-scramble-btn")?.addEventListener("click", onScrambleClick);
    document.getElementById("battle-hint-btn")?.addEventListener("click", onHintClick);
    document.getElementById("battle-start-btn")?.addEventListener("click", onStartRoundClick);
    document.getElementById("battle-attack-btn")?.addEventListener("click", onAttackClick);
    document.getElementById("next-btn")?.addEventListener("click", onNextClick);

    // Dashboard launcher links straight into a battle; everyone else starts at PRESS START.
    var params = new URLSearchParams(window.location.search);
    var launching = !!params.get("lesson") && params.get("start") === "1";
    if (launching) {
      showLoadingScreen();
      setLoadingHint("Preparing your battle…");
    } else {
      showScreen("splash");
    }
    void applyLaunchFromUrl().then(function (started) {
      if (launching && !started) showScreen("splash");
    });
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
// .
