/**
 * AI Battle Arena — Phase 2 lobby + Phase 3 battle (frontend only).
 * Loads published lessons via /student/lessons, lesson content via
 * /get-content/{file_id}. Battle vocabulary/grid/HP are all client-side —
 * no new backend endpoints, no persistence.
 */
(function () {
  "use strict";

  var selectedLessonId = null;
  var selectedLesson = null;
  var selectedMode = "ai";
  var lessonsById = {};

  var GRID_SIZE = 20;
  var PLAYER_MAX_HP = 100;
  var AI_MAX_HP = 100;
  var FALLBACK_QUESTIONS = [
    { question: "What word means breaking something down into its parts to understand it?", answer: "analysis", meaning: "Examining something closely by studying its parts." },
    { question: "What word means an idea or principle behind something?", answer: "concept", meaning: "A general idea behind a topic or theory." },
    { question: "What word means information that supports a claim?", answer: "evidence", meaning: "Facts or information showing something is true." },
    { question: "What word means a series of steps to reach a result?", answer: "process", meaning: "A series of actions taken to achieve a result." },
    { question: "What word means the arrangement of parts within something?", answer: "structure", meaning: "The way parts are arranged to form a whole." },
    { question: "What word means a set of ideas explaining how something works?", answer: "theory", meaning: "An explanation based on general principles." },
    { question: "What word means the setting or background of a situation?", answer: "context", meaning: "The circumstances surrounding an idea or event." },
    { question: "What word means a brief overview of the main points?", answer: "summary", meaning: "A short statement of the main points." },
    { question: "What word means something that contributes to a result?", answer: "factor", meaning: "Something that contributes to a result." },
    { question: "What word means a particular way of doing something?", answer: "method", meaning: "A particular way of doing something." },
    { question: "What word means a fundamental rule or belief?", answer: "principle", meaning: "A fundamental rule or belief guiding behavior." },
    { question: "What word means a response triggered by something else?", answer: "reaction", meaning: "A response triggered by an action or event." },
    { question: "What word means something that can change or vary?", answer: "variable", meaning: "Something that can change or vary." },
    { question: "What word means an educated guess to be tested?", answer: "hypothesis", meaning: "A proposed explanation to be tested." },
    { question: "What word means a set of connected parts working together?", answer: "system", meaning: "A set of connected parts working as a whole." },
  ];
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
   * Game menu (☰, top-right on the loading / battle screens):
   * arena level, AI defeated, best score, and separate volume +
   * mute for music and for sound effects (saved in localStorage).
   * 50% = the original loudness.
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
      var vol = effectiveVolume(kind);
      var name = kind === "music" ? "music" : "sound effects";
      document.querySelectorAll('.battle-sound-mute[data-sound-kind="' + kind + '"]').forEach(function (btn) {
        var icon = btn.querySelector("i");
        if (icon) {
          icon.className =
            "fa-solid " + (vol === 0 ? "fa-volume-xmark" : vol < 0.5 ? "fa-volume-low" : "fa-volume-high");
        }
        var label = audioSettings[kind].muted ? "Unmute " + name : "Mute " + name;
        btn.setAttribute("aria-label", label);
        btn.setAttribute("title", label);
        btn.setAttribute("aria-pressed", audioSettings[kind].muted ? "true" : "false");
      });
      document.querySelectorAll('.battle-sound-slider[data-sound-kind="' + kind + '"]').forEach(function (slider) {
        slider.value = String(Math.round(vol * 100));
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

  function renderBattleMenuStats() {
    var st = menuStats();
    var into = st.totalExp % EXP_PER_LEVEL;
    var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("battle-menu-level", String(st.level));
    set("battle-menu-wins", String(st.wins));
    set("battle-menu-best", String(st.best));
    set("battle-menu-exp-text", into + " / " + EXP_PER_LEVEL + " EXP to Level " + (st.level + 1));
    var fill = document.getElementById("battle-menu-exp-fill");
    if (fill) fill.style.width = Math.round((into / EXP_PER_LEVEL) * 100) + "%";
  }

  function setBattleMenuOpen(open) {
    var panel = document.getElementById("battle-menu-panel");
    var toggle = document.getElementById("battle-menu-toggle");
    if (open) renderBattleMenuStats();
    if (panel) panel.hidden = !open;
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setupBattleMenu() {
    var toggle = document.getElementById("battle-menu-toggle");
    var wrap = document.getElementById("battle-menu");
    toggle?.addEventListener("click", function () {
      var panel = document.getElementById("battle-menu-panel");
      setBattleMenuOpen(!!(panel && panel.hidden));
    });
    document.addEventListener("click", function (e) {
      if (wrap && !wrap.contains(e.target)) setBattleMenuOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setBattleMenuOpen(false);
    });
    document.querySelectorAll(".battle-sound-slider").forEach(function (slider) {
      slider.addEventListener("input", function () {
        var kind = slider.getAttribute("data-sound-kind") === "music" ? "music" : "sfx";
        audioSettings[kind].volume = Math.max(0, Math.min(1, Number(slider.value) / 100));
        audioSettings[kind].muted = false;
        applyVolume();
        saveAudioSettings();
      });
    });
    document.querySelectorAll(".battle-sound-mute").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-sound-kind") === "music" ? "music" : "sfx";
        var ch = audioSettings[kind];
        if (ch.muted || ch.volume === 0) {
          ch.muted = false;
          if (ch.volume === 0) ch.volume = 0.5;
        } else {
          ch.muted = true;
        }
        applyVolume();
        saveAudioSettings();
      });
    });
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

  function modeLabel() {
    return selectedMode === "player" ? "Battle Player" : "Battle AI";
  }

  function isLobbyReady() {
    return !!(selectedLessonId && selectedMode === "ai");
  }

  function setStartEnabled(on) {
    var btn = document.getElementById("battle-arena-start-btn");
    var label = document.getElementById("battle-arena-start-label");
    var hint = document.getElementById("battle-arena-start-hint");
    if (btn) {
      btn.disabled = !on;
      btn.classList.toggle("is-ready", !!on);
    }
    if (label) label.textContent = on ? "Ready to Battle" : "Start Battle";
    if (hint) {
      hint.textContent = on
        ? "Ready to Battle — review Step 3, then click to continue."
        : "Select a lesson and battle mode to continue.";
    }
  }

  function renderSelectedPanel() {
    var emptyEl = document.getElementById("battle-selected-empty");
    var detailsEl = document.getElementById("battle-selected-details");
    var nameEl = document.getElementById("battle-info-name");
    var typeEl = document.getElementById("battle-info-type");
    var dateEl = document.getElementById("battle-info-date");

    if (!selectedLesson) {
      if (emptyEl) emptyEl.hidden = false;
      if (detailsEl) detailsEl.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (detailsEl) detailsEl.hidden = false;
    if (nameEl) nameEl.textContent = lessonTitle(selectedLesson);
    if (typeEl) typeEl.textContent = lessonFileType(selectedLesson);
    if (dateEl) dateEl.textContent = formatDate(selectedLesson.created_at);
  }

  function syncSelectionUi() {
    document.querySelectorAll("#battle-arena-lesson-list .battle-arena-lesson-card").forEach(function (card) {
      var id = card.getAttribute("data-lesson-id");
      var isOn = id && id === selectedLessonId;
      card.classList.toggle("selected", !!isOn);
      card.setAttribute("aria-pressed", isOn ? "true" : "false");
      var selectBtn = card.querySelector("[data-select-lesson]");
      if (selectBtn) {
        selectBtn.textContent = isOn ? "Unselect" : "Select Lesson";
        selectBtn.classList.toggle("btn-primary", !isOn);
        selectBtn.classList.toggle("btn-secondary", !!isOn);
      }
    });
    renderSelectedPanel();
    setStartEnabled(isLobbyReady());
  }

  function selectLesson(lessonId) {
    var id = String(lessonId || "").trim();
    if (!id || !lessonsById[id]) return;
    // Clicking the already-selected lesson unselects it.
    if (id === selectedLessonId) {
      selectedLessonId = null;
      selectedLesson = null;
    } else {
      selectedLessonId = id;
      selectedLesson = lessonsById[id];
    }
    syncSelectionUi();
  }

  function buildLessonCard(lesson) {
    var id = String(lesson.file_id || lesson.lesson_id || "").trim();
    if (!id) return "";
    var title = esc(lessonTitle(lesson));
    var fileType = esc(lessonFileType(lesson));
    var createdLabel = formatDate(lesson.created_at);
    var createdHtml =
      createdLabel !== "—"
        ? '<span class="lesson-card-pill"><i class="fa-solid fa-calendar"></i> ' + esc(createdLabel) + "</span>"
        : "";

    return (
      '<article class="lesson-card battle-arena-lesson-card" data-lesson-id="' +
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
      createdHtml +
      "</div>" +
      "</div>" +
      '<div class="lesson-actions">' +
      '<button type="button" class="btn btn-primary btn-small" data-select-lesson="' +
      esc(id) +
      '">Select Lesson</button>' +
      "</div>" +
      "</article>"
    );
  }

  async function loadLessons() {
    var listEl = document.getElementById("battle-arena-lesson-list");
    var emptyEl = document.getElementById("battle-arena-lessons-empty");
    var statusEl = document.getElementById("battle-arena-lessons-status");
    if (!listEl) return;

    selectedLessonId = null;
    selectedLesson = null;
    lessonsById = {};
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
      var res = await fetch(url, {
        headers: typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {},
      });
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

      lessons.forEach(function (lesson) {
        var id = String(lesson.file_id || lesson.lesson_id || "").trim();
        if (id) lessonsById[id] = lesson;
      });

      listEl.innerHTML = lessons.map(buildLessonCard).filter(Boolean).join("");
      listEl.hidden = false;
      syncSelectionUi();
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
    var selectBtn = event.target.closest("[data-select-lesson]");
    if (selectBtn) {
      event.preventDefault();
      selectLesson(selectBtn.getAttribute("data-select-lesson"));
      return;
    }
    var card = event.target.closest(".battle-arena-lesson-card[data-lesson-id]");
    if (!card || !document.getElementById("battle-arena-lesson-list").contains(card)) return;
    selectLesson(card.getAttribute("data-lesson-id"));
  }

  function onModeChange(event) {
    var input = event.target;
    if (!input || input.name !== "battle-mode") return;
    selectedMode = input.value === "player" ? "player" : "ai";
    document.querySelectorAll(".battle-mode-card").forEach(function (card) {
      var radio = card.querySelector('input[name="battle-mode"]');
      card.classList.toggle("is-selected", !!(radio && radio.checked));
    });
    setStartEnabled(isLobbyReady());
  }

  function openBattleModal() {
    if (!isLobbyReady() || !selectedLesson) return;
    var modal = document.getElementById("battle-arena-modal");
    var lessonEl = document.getElementById("battle-modal-lesson");
    var modeEl = document.getElementById("battle-modal-mode");
    if (lessonEl) lessonEl.textContent = lessonTitle(selectedLesson);
    if (modeEl) modeEl.textContent = modeLabel();
    renderDifficultyPicker();
    if (modal) {
      modal.hidden = false;
      document.body.classList.add("lq-modal-open");
    }
  }

  function closeBattleModal() {
    var modal = document.getElementById("battle-arena-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("lq-modal-open");
  }

  function onStartClick() {
    if (!isLobbyReady()) return;
    openBattleModal();
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
      throw new Error((data && data.error) || "Could not generate battle questions.");
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

  function showLobbyScreen() {
    document.querySelector(".dashboard-shell")?.removeAttribute("hidden");
    document.getElementById("battle-loading-screen")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.setAttribute("hidden", "");
    document.body.classList.remove("battle-fullscreen-active");
  }

  function showFightScreenEl() {
    document.querySelector(".dashboard-shell")?.setAttribute("hidden", "");
    document.getElementById("battle-loading-screen")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.removeAttribute("hidden");
    document.body.classList.add("battle-fullscreen-active");
  }

  function showLoadingScreen() {
    document.querySelector(".dashboard-shell")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.setAttribute("hidden", "");
    document.getElementById("battle-loading-screen")?.removeAttribute("hidden");
    document.body.classList.add("battle-fullscreen-active");
  }

  function setLoadingHint(text) {
    var hint = document.getElementById("battle-loading-hint");
    if (hint) hint.textContent = text;
  }

  function renderVocabNote() {
    var note = document.getElementById("battle-vocab-note");
    if (!note || !fight) return;
    if (fight.usingFallback) {
      note.hidden = false;
      note.textContent = "Using general questions — no AI content yet for this lesson.";
    } else {
      note.hidden = true;
    }
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
    var previewEl = document.getElementById("battle-word-preview");
    var attackBtn = document.getElementById("battle-attack-btn");
    if (!previewEl || !fight) return;
    var word = fight.selected.map(function (idx) { return fight.grid[idx].letter; }).join("");
    if (!word) {
      previewEl.innerHTML = '<span class="battle-word-preview-placeholder" id="battle-word-preview-placeholder">Tap letters to spell the answer…</span>';
    } else {
      previewEl.textContent = word;
    }
    if (attackBtn) attackBtn.disabled = fight.selected.length === 0;
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

  function onNextClick() {
    if (!fight || !fight.questions.length) return;
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
    try {
      localStorage.setItem(DIFFICULTY_STORAGE_KEY, key);
    } catch (e) {
      /* ignore */
    }
    renderDifficultyPicker();
  }

  function renderDifficultyPicker() {
    document.querySelectorAll(".battle-difficulty-option").forEach(function (btn) {
      var on = btn.getAttribute("data-difficulty") === selectedDifficulty;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    var modalEl = document.getElementById("battle-modal-difficulty");
    if (modalEl) modalEl.textContent = difficultyConfig(selectedDifficulty).label;
  }

  function setupDifficultyPicker() {
    var picker = document.querySelector(".battle-difficulty-picker");
    if (!picker) return;
    picker.addEventListener("click", function (e) {
      var btn = e.target.closest(".battle-difficulty-option");
      var key = btn && btn.getAttribute("data-difficulty");
      if (key && BATTLE_DIFFICULTIES[key]) saveSelectedDifficulty(key);
    });
    // Arrow keys move between options (radio group behaviour).
    picker.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var keys = Object.keys(BATTLE_DIFFICULTIES);
      var idx = keys.indexOf(selectedDifficulty);
      idx = (idx + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length;
      saveSelectedDifficulty(keys[idx]);
      picker.querySelector('[data-difficulty="' + selectedDifficulty + '"]')?.focus();
      e.preventDefault();
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
    renderQuestion();
    renderGrid();
    renderWordPreview();
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
      setTimeout(function () {
        playTrack(sfxAttack);
      }, 150);
      setTimeout(function () {
        triggerHitAnim("ai", dmg);
        playHitSound();
      }, 350);

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

    playTrack(sfxWrong);
    var counterDmg = 6 + Math.floor(Math.random() * 9);
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
      showToast("Not quite — the AI hits back for " + counterDmg + "! -" + TIME_PENALTY_WRONG + "s", "error");
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

  function openResultModal(outcome) {
    var modal = document.getElementById("battle-result-modal");
    var titleEl = document.getElementById("battle-result-modal-title");
    var bodyEl = document.getElementById("battle-result-modal-body");
    var primaryBtn = document.getElementById("battle-result-primary-btn");
    if (!modal) return;

    if (titleEl) titleEl.textContent = outcome === "win" ? "Victory!" : "Defeated";
    if (bodyEl) {
      bodyEl.textContent =
        (outcome === "win"
          ? "You defeated the AI opponent! "
          : fight && fight.endReason === "time"
          ? "Time's up! "
          : "The AI opponent defeated you. ") +
        battleResultSummary();
    }
    if (primaryBtn) primaryBtn.textContent = outcome === "win" ? "Battle Again" : "Try Again";

    modal.hidden = false;
    document.body.classList.add("lq-modal-open");
  }

  function closeResultModal() {
    var modal = document.getElementById("battle-result-modal");
    if (modal) modal.hidden = true;
    renderResultProgress(null);
    document.body.classList.remove("lq-modal-open");
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

  function endBattle(outcome) {
    if (!fight || fight.ended) return;
    fight.ended = true;
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
    openResultModal(outcome);
    renderResultProgress(progress);
    saveBattleResultToHistory(outcome, progress);

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
    setTimeout(loadBattleStats, 1500);
  }

  function saveBattleResultToHistory(outcome, progress) {
    if (!fight || typeof recordStudentHistory !== "function") return;
    var p = progress || computeBattleProgress(outcome);
    recordStudentHistory("battle", {
      lesson_id: fight.lessonId || null,
      lesson_title: selectedLesson ? lessonTitle(selectedLesson) : "Battle Arena",
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
    });
  }

  function resetFightForRebattle() {
    if (!fight) return;
    fight.playerHp = PLAYER_MAX_HP;
    fight.aiHp = AI_MAX_HP;
    fight.wordsUsed = [];
    fight.hintsLeft = HINTS_PER_BATTLE;
    renderHintButton();
    fight.questions = shuffleArray(fight.questions);
    renderHp();
    renderWordsUsed();
    advanceToQuestion(0);
    resetBattleClock();
  }

  function exitToLobby() {
    stopBattleTimer();
    stopAllMusic();
    setBattleWaiting(false);
    fight = null;
    closeResultModal();
    showLobbyScreen();
  }

  async function startBattle() {
    if (!isLobbyReady() || !selectedLesson) return;

    var fileId = selectedLessonId;
    closeBattleModal();
    playIntroMusic();
    showLoadingScreen();
    setLoadingHint("Preparing your battle…");

    try {
      var difficulty = selectedDifficulty;
      var content = await loadLessonContentAndVocab(fileId);
      var questions = normalizeQuestionEntries(content.battleQuestions).filter(function (q) {
        return q.difficulty === difficulty;
      });
      var usingAi = questions.length >= 5;
      var usingFallback = false;

      if (!usingAi) {
        setLoadingHint("Generating " + difficultyConfig(difficulty).label.toLowerCase() + " battle questions with AI…");
        try {
          var aiQuestions = await generateBattleQuestionsWithAi(fileId, difficulty);
          questions = normalizeQuestionEntries(aiQuestions);
          usingAi = questions.length >= 5;
        } catch (aiErr) {
          if (typeof showToast === "function") {
            showToast((aiErr && aiErr.message) || "Could not generate AI battle questions.", "error");
          }
        }
      }

      if (!usingAi) {
        questions = FALLBACK_QUESTIONS.slice();
        usingFallback = true;
      }
      questions = shuffleArray(questions).slice(0, 12);

      fight = {
        lessonId: fileId,
        questions: questions,
        questionIndex: 0,
        currentAnswer: "",
        currentMeaning: "",
        grid: [],
        selected: [],
        playerHp: PLAYER_MAX_HP,
        aiHp: AI_MAX_HP,
        wordsUsed: [],
        usingFallback: usingFallback,
        hintsLeft: HINTS_PER_BATTLE,
        difficulty: difficulty,
      };
      renderHintButton();

      var playerNameEl = document.getElementById("battle-fight-player-name");
      if (playerNameEl) {
        playerNameEl.textContent = document.getElementById("student-display-name")?.textContent || "You";
      }

      showFightScreenEl();
      renderVocabNote();
      renderHp();
      renderWordsUsed();
      advanceToQuestion(0);
      resetBattleClock();
    } catch (err) {
      fight = null;
      stopIntroMusic();
      showLobbyScreen();
      if (typeof showToast === "function") {
        showToast((err && err.message) || "Could not start battle.", "error");
      }
    }
  }

  /** Exit dialog: Keep Battling / Restart (back to the Ready screen) / Exit Battle. */
  async function onExitBattleClick() {
    var choice = true;
    // Restart only makes sense once the round has started (not on the Ready screen).
    var inBattle = !!(fight && fight.started && !fight.ended);
    if (fight) fight.paused = true; // don't let the clock run out while deciding
    if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
      choice = await window.LearnIQConfirm.show({
        title: "Exit Battle?",
        message: inBattle
          ? "Your progress in this battle will be lost. Restart to try again from the beginning."
          : "You'll go back to the lesson list.",
        confirmText: "Exit Battle",
        cancelText: inBattle ? "Keep Battling" : "Stay",
        extraText: inBattle ? "Restart" : "",
        variant: "danger",
      });
    }
    if (choice === "extra") {
      restartBattle();
    } else if (choice) {
      exitToLobby();
    } else if (fight) {
      fight.paused = false;
      battleTimerLastTick = Date.now(); // don't count the time spent in the dialog
    }
  }

  /** Same lesson and questions (reshuffled), full HP, fresh timer, back on the Ready screen. */
  function restartBattle(options) {
    if (!fight) return;
    var opts = options || {};
    stopBattleTimer();
    closeResultModal();
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

  function onResultPrimaryClick() {
    // The button reads "Try Again" after a loss and "Battle Again" after a win.
    restartBattle({ tryAgain: !!fight && fight.lastOutcome !== "win" });
  }

  function onResultSecondaryClick() {
    exitToLobby();
  }

  function setupBattleArenaPage() {
    setupBattleMenu();
    setupDifficultyPicker();
    void loadBattleStats();
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
    document.getElementById("battle-arena-modal-ok")?.addEventListener("click", function () {
      void startBattle();
    });
    document.getElementById("battle-arena-modal-close")?.addEventListener("click", closeBattleModal);
    document.getElementById("battle-arena-modal")?.addEventListener("click", function (e) {
      if (e.target === e.currentTarget) closeBattleModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var modal = document.getElementById("battle-arena-modal");
      if (modal && !modal.hidden) closeBattleModal();
    });

    document.getElementById("battle-letter-grid")?.addEventListener("click", onTileClick);
    document.getElementById("battle-clear-btn")?.addEventListener("click", onClearClick);
    document.getElementById("battle-scramble-btn")?.addEventListener("click", onScrambleClick);
    document.getElementById("battle-hint-btn")?.addEventListener("click", onHintClick);
    document.getElementById("battle-start-btn")?.addEventListener("click", onStartRoundClick);
    document.getElementById("battle-attack-btn")?.addEventListener("click", onAttackClick);
    document.getElementById("next-btn")?.addEventListener("click", onNextClick);
    document.getElementById("battle-exit-btn")?.addEventListener("click", function () {
      void onExitBattleClick();
    });
    document.getElementById("battle-result-primary-btn")?.addEventListener("click", onResultPrimaryClick);
    document.getElementById("battle-result-secondary-btn")?.addEventListener("click", onResultSecondaryClick);

    setStartEnabled(false);
    renderSelectedPanel();
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
