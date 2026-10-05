/**
 * Arcade game shell — shared by every Arcade game (Word Clash, Tic-Tac-Know, …).
 *
 * ArcadeShell.create(game) builds what all the games have in common inside
 * #wc-app: PRESS START, the main menu, world (subject) and stage (lesson)
 * select, results, the game log and settings, plus the loading screen, the
 * fighter picker and the pause menu. It also owns the shared pieces: sound
 * settings, the lesson question bank (one bank per lesson + difficulty that
 * grows as students play), saving each result with every answer, and the
 * keyboard. A game brings its own play screen and gameplay — see create().
 */
(function (global) {
  "use strict";

  var EXP_PER_LEVEL = 100;
  var DIFFICULTIES = { normal: "Normal", medium: "Medium", hard: "Hard" };
  var DIFFICULTY_STORAGE_KEY = "learniq-battle-difficulty";
  var LAST_LESSON_KEY = "learniq-last-lesson";
  var BANK_MIN = 5;
  var BANK_MAX = 60; // keep in sync with BATTLE_BANK_MAX in backend/main.py
  var MORE_QUESTIONS_BELOW = 6;

  /* ----------------------------------------------------------
   * Small helpers
   * ---------------------------------------------------------- */
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
    if (typeof getStudentIdNumberForApi === "function") return getStudentIdNumberForApi();
    try {
      var u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
      return String((u && u.id_number) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function authHeaders() {
    return typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {};
  }

  /** JSON request to the LearnIQ API; errors carry the HTTP status. */
  async function fetchJson(path, options) {
    if (typeof apiUrl !== "function") throw new Error("API helper missing. Check js/core/api.js.");
    var opts = Object.assign({}, options || {});
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    var res = await fetch(apiUrl(path), opts);
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var err = new Error((data && data.error) || "Request failed.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function lessonTitle(lesson) {
    if (!lesson) return "—";
    return String(lesson.filename || lesson.title || "Untitled lesson");
  }

  function stageLabel(lesson) {
    return lessonTitle(lesson).replace(/\.(pdf|pptx?|docx?|txt)$/i, "");
  }

  function cssEscape(v) {
    return global.CSS && CSS.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&");
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function formatClock(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function formatLogDate(iso) {
    try {
      var d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function playerName() {
    var user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    var name = user && typeof getProfileDisplayName === "function" ? getProfileDisplayName(user) : "";
    return String(name || "Player").trim() || "Player";
  }

  function difficultyLabel(key) {
    return (DIFFICULTIES[key] || DIFFICULTIES.normal).toUpperCase();
  }

  /**
   * EXP for every Arcade game after Word Clash: 10 win, 6 draw, 4 loss, +1 per
   * correct answer (max +5). Keep in sync with game_exp_for_result() in
   * backend/db_supabase.py, which recomputes it from saved results.
   */
  function gameExpForResult(outcome, correctAnswers) {
    var base = outcome === "win" ? 10 : outcome === "draw" ? 6 : 4;
    return base + Math.min(5, Math.max(0, Number(correctAnswers) || 0));
  }

  async function confirmDialog(opts) {
    if (global.LearnIQConfirm && typeof global.LearnIQConfirm.show === "function") {
      return global.LearnIQConfirm.show(Object.assign({ variant: "danger" }, opts));
    }
    return global.confirm(opts.message || opts.title);
  }

  /* ----------------------------------------------------------
   * Reduce motion: same preference as the LMS Settings page (learniq-prefs).
   * ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
   * Sound: one volume for music and one for effects, shared by every game
   * (localStorage). 50% = the original loudness; 0 = off.
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

  var tracks = [];

  /**
   * An audio file; every track is registered so volume changes reach it.
   * src may be null while a game still makes its music (see setTrackSrc).
   */
  function createTrack(src, loop, kind) {
    var track = { src: src, loop: !!loop, kind: kind || "sfx", el: null, wanted: false };
    tracks.push(track);
    return track;
  }

  /** Gives a track its file; if it was asked to play while it had none, it starts now. */
  function setTrackSrc(track, src) {
    if (!track) return;
    if (track.el) {
      track.el.pause();
      track.el = null;
    }
    track.src = src || null;
    if (track.wanted && track.src) {
      track.wanted = false;
      playTrack(track);
    }
  }

  function playTrack(track) {
    if (!track) return;
    if (!track.src) {
      track.wanted = true; // plays once its file is ready
      return;
    }
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
    if (!track) return;
    track.wanted = false;
    if (!track.el) return;
    track.el.pause();
    track.el.currentTime = 0;
  }

  function stopAllTracks() {
    tracks.forEach(stopTrack);
  }

  /*
   * intro.mp3 loops on the menus, the loading screen and before a game starts.
   * A game can bring its own menu music instead (game.menuMusic).
   */
  var DEFAULT_INTRO_SRC = "audio/intro.mp3";
  var introMusic = createTrack(DEFAULT_INTRO_SRC, true, "music");

  function playIntroMusic() {
    tracks.forEach(function (t) {
      if (t !== introMusic && t.kind === "music") stopTrack(t);
    });
    playTrack(introMusic);
  }

  /** Menu music: starts the intro loop unless it is already playing (no restart between screens). */
  function ensureIntroMusic() {
    if (introMusic.wanted || (introMusic.el && !introMusic.el.paused)) return;
    playIntroMusic();
  }

  function stopIntroMusic() {
    stopTrack(introMusic);
  }

  /* Retro sound effects, synthesized with Web Audio (no files). */
  var audioCtx = null;

  function getAudioCtx() {
    var Ctx = global.AudioContext || global.webkitAudioContext;
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

  function playVictorySound() {
    playTone(523, 0.12, "square", 0);
    playTone(659, 0.12, "square", 120);
    playTone(784, 0.22, "square", 240);
  }

  /** Volume sliders + every track follow the saved volumes. */
  function applyVolume() {
    tracks.forEach(function (t) {
      if (t.el) t.el.volume = effectiveVolume(t.kind);
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

  /* ----------------------------------------------------------
   * Fighters: the player's pixel-art avatar in every game (DiceBear
   * "Pixel Art" from a fixed seed). The choice is saved per browser.
   * ---------------------------------------------------------- */
  var CHARACTER_SEEDS = [
    "Aiden", "Bella", "Carlo", "Dana", "Elio", "Faye", "Gabe", "Hana", "Ivan", "Jade",
    "Kai", "Luna", "Milo", "Nina", "Omar", "Pia", "Quinn", "Rico", "Sofia", "Theo",
    "Uma", "Vince", "Wren", "Xian", "Yuri", "Zara", "Axel", "Bea", "Cruz", "Dom",
  ];
  var CHARACTER_STORAGE_KEY = "learniq-battle-character";
  var LAST_GAME_KEY = "learniq-arcade-last-game"; // read by arcade.entry.js
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

  /* ----------------------------------------------------------
   * Difficulty: one saved choice shared by every game.
   * ---------------------------------------------------------- */
  var selectedDifficulty = (function () {
    try {
      var saved = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
      return DIFFICULTIES[saved] ? saved : "normal";
    } catch (e) {
      return "normal";
    }
  })();

  /* ----------------------------------------------------------
   * Question bank: each lesson + difficulty has one bank on the server,
   * shared by every student and every game, growing over time (backend
   * /generate-battle-questions). Games show the questions this student
   * hasn't seen first, then the ones they missed last time, then the rest.
   * When fewer than MORE_QUESTIONS_BELOW unseen ones are left after a game,
   * the server is asked to add more in the background.
   * ---------------------------------------------------------- */
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
        difficulty: DIFFICULTIES[difficulty] ? difficulty : "normal",
      });
    });
    return out;
  }

  async function loadLessonContent(fileId) {
    var data = await fetchJson("/get-content/" + encodeURIComponent(fileId));
    return { battleQuestions: Array.isArray(data.battle_questions) ? data.battle_questions : [] };
  }

  function bankForDifficulty(content, difficulty) {
    return normalizeQuestionEntries(content.battleQuestions).filter(function (q) {
      return q.difficulty === difficulty;
    });
  }

  async function generateQuestions(fileId, difficulty, mode) {
    var body = { file_id: fileId, difficulty: difficulty || "normal" };
    if (mode) body.mode = mode;
    var data = await fetchJson("/generate-battle-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return Array.isArray(data.questions) ? data.questions : [];
  }

  /**
   * The lesson's bank for one difficulty; the first player of a lesson waits for
   * the AI's first batch. opts: { gameName, playWord, onGenerating }.
   */
  async function loadQuestionBank(fileId, difficulty, opts) {
    var o = opts || {};
    var retry = " Press " + (o.playWord || "PLAY") + " to try again.";
    var bank = bankForDifficulty(await loadLessonContent(fileId), difficulty);
    if (bank.length >= BANK_MIN) return bank;
    if (o.onGenerating) o.onGenerating();
    try {
      bank = normalizeQuestionEntries(await generateQuestions(fileId, difficulty));
    } catch (err) {
      // 400/404: the lesson file has no readable text (or is missing) — retrying won't help.
      if (err && (err.status === 400 || err.status === 404)) {
        throw new Error(
          "This lesson's file can't be read, so " + (o.gameName || "the game") +
            " can't make questions for it. Ask your teacher to upload it again."
        );
      }
      var message = (err && err.message) || "Couldn't make questions for this lesson.";
      throw new Error(/try again/i.test(message) ? message : message + retry);
    }
    if (bank.length < BANK_MIN) throw new Error("Couldn't make questions for this lesson." + retry);
    return bank;
  }

  function answerKey(word) {
    return String(word || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  /** Latest result per answer word in this student's games on a lesson: "missed" or "mastered". */
  function questionHistory(events, lessonId) {
    var state = {};
    // events are newest first, so the first time a word shows up is its latest result.
    events.forEach(function (b) {
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

  /** Up to `count` questions: never seen first, then missed last time, then the rest (each group shuffled). */
  function pickQuestions(bank, events, lessonId, count) {
    var state = questionHistory(events, lessonId);
    var unseen = [];
    var missed = [];
    var mastered = [];
    bank.forEach(function (q) {
      var s = state[answerKey(q.answer)];
      (s === "missed" ? missed : s === "mastered" ? mastered : unseen).push(q);
    });
    return {
      questions: shuffle(unseen).concat(shuffle(missed), shuffle(mastered)).slice(0, count),
      unseenKeys: unseen.map(function (q) {
        return answerKey(q.answer);
      }),
    };
  }

  /** After a game: if this student has (almost) seen the whole bank, ask the server for more. */
  function requestMoreQuestionsIfLow(opts) {
    if (!opts || !opts.lessonId || !opts.bankSize || opts.bankSize >= BANK_MAX) return;
    var shown = {};
    (opts.shownAnswers || []).forEach(function (word) {
      shown[answerKey(word)] = true;
    });
    var unseenLeft = (opts.unseenKeys || []).filter(function (k) {
      return !shown[k];
    }).length;
    if (unseenLeft >= MORE_QUESTIONS_BELOW) return;
    generateQuestions(opts.lessonId, opts.difficulty, "more").catch(function () {
      /* best effort: the next game just repeats a few questions */
    });
  }

  /* ----------------------------------------------------------
   * Answer review: results screen and the game log
   * ---------------------------------------------------------- */
  function renderReviewList(listEl, answers) {
    if (!listEl) return;
    if (!Array.isArray(answers)) {
      listEl.innerHTML =
        '<li class="wc-review-empty">Answers weren\'t saved for this game. Games from now on keep every answer.</li>';
      return;
    }
    if (!answers.length) {
      listEl.innerHTML = '<li class="wc-review-empty">No questions were answered in this game.</li>';
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

  /* ----------------------------------------------------------
   * Markup shared by every game
   * ---------------------------------------------------------- */
  function difficultyPickerHtml(labelId) {
    return (
      '<div class="battle-difficulty-picker wc-seg" role="radiogroup" aria-labelledby="' + labelId + '">' +
      Object.keys(DIFFICULTIES)
        .map(function (key) {
          return (
            '<button type="button" class="battle-difficulty-option" role="radio" data-difficulty="' + key +
            '" aria-checked="false">' + DIFFICULTIES[key].toUpperCase() + "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  /** Screen words. A game can rename them (game.words), e.g. worlds become subjects. */
  var DEFAULT_WORDS = {
    selectWorld: "SELECT WORLD",
    worldsSub: "Each world is one of your subjects.",
    loadingWorlds: "Loading worlds…",
    noWorlds: "No worlds yet. Join a class with your teacher's code, then come back.",
    world: "WORLD",
    stage: "STAGE",
    stages: "STAGES",
    noStages: "NO STAGES YET",
    emptyWorld: "No lessons in this world yet.",
    stagesLabel: "Stages",
    pickStage: "Pick a stage",
    fighter: "FIGHTER",
    chooseFighter: "Choose Your Fighter",
    cleared: "CLEARED",
    clearedIcon: "fa-star",
    stageSelect: "STAGE SELECT",
    stageNum: function (world, stage) {
      return world + "-" + stage;
    },
  };

  /** Words for classroom games (Tic-Tac-Know, Larong Pinoy): subjects and lessons, not worlds and stages. */
  var CLASSROOM_WORDS = {
    selectWorld: "PICK A SUBJECT",
    worldsSub: "Each subject has its own lessons to play.",
    loadingWorlds: "Loading subjects…",
    noWorlds: "No subjects yet. Join a class with your teacher's code, then come back.",
    world: "SUBJECT",
    stage: "LESSON",
    stages: "LESSONS",
    noStages: "NO LESSONS YET",
    emptyWorld: "No lessons in this subject yet.",
    stagesLabel: "Lessons",
    pickStage: "Pick a lesson",
    fighter: "PLAYER",
    chooseFighter: "Choose Your Player",
    cleared: "WON",
    clearedIcon: "fa-check",
    stageSelect: "LESSONS",
    stageNum: function (subject, lesson) {
      return lesson + ".";
    },
  };

  function shellMarkup(g) {
    var w = g.words;
    var logo = function (small, id) {
      return (
        '<h1 class="wc-logo' + (small ? " is-small" : "") + '" id="' + id + '">' +
        '<span class="wc-logo-top">' + esc(g.title[0]) + "</span>" +
        '<span class="wc-logo-main">' + esc(g.title[1]) + "</span></h1>"
      );
    };
    var head = function (id, text) {
      return (
        '<header class="wc-screen-head">' +
        '<button type="button" class="wc-back" data-wc-back><i class="fa-solid fa-caret-left" aria-hidden="true"></i> BACK</button>' +
        '<h2 class="wc-screen-title" id="' + id + '">' + esc(text) + "</h2>" +
        '<span class="wc-head-spacer" aria-hidden="true"></span></header>'
      );
    };
    var menuItem = function (action, label) {
      return '<button type="button" class="wc-menu-item" data-wc-action="' + action + '">' + esc(label) + "</button>";
    };
    return (
      // PRESS START: also unlocks audio (browsers block sound until the first tap)
      '<section class="wc-screen wc-splash" id="wc-splash" aria-labelledby="wc-splash-title">' +
      logo(false, "wc-splash-title") +
      '<p class="wc-tagline">' + esc(g.tagline) + "</p>" +
      '<button type="button" class="wc-press-start" id="wc-press-start">PRESS START</button>' +
      '<p class="wc-hint">Click, tap or press Enter</p></section>' +
      // MAIN MENU
      '<section class="wc-screen wc-menu" id="wc-menu" hidden aria-labelledby="wc-menu-title">' +
      logo(true, "wc-menu-title") +
      '<div class="wc-player-card">' +
      '<div class="wc-player-sprite" id="wc-player-sprite" aria-hidden="true"></div>' +
      '<div class="wc-player-info">' +
      '<strong class="wc-player-name" id="wc-player-name">PLAYER</strong>' +
      '<span class="wc-player-level" id="wc-player-level">LV 0</span>' +
      '<div class="wc-exp-bar" aria-hidden="true"><div class="wc-exp-fill" id="wc-player-exp-fill"></div></div>' +
      '<span class="wc-player-meta" id="wc-player-meta"></span>' +
      "</div></div>" +
      '<nav class="wc-menu-list" aria-label="Main menu">' +
      menuItem("start", "START") +
      menuItem("log", g.logTitle) +
      menuItem("settings", "SETTINGS") +
      menuItem("quit", "QUIT") +
      "</nav>" +
      '<p class="wc-hint">↑ ↓ select · Enter confirm</p></section>' +
      // WORLD SELECT: one world per subject
      '<section class="wc-screen wc-worlds" id="wc-worlds" hidden aria-labelledby="wc-worlds-title">' +
      head("wc-worlds-title", w.selectWorld) +
      '<p class="wc-screen-sub">' + esc(w.worldsSub) + "</p>" +
      '<p class="wc-status" id="wc-worlds-status" role="status">' + esc(w.loadingWorlds) + "</p>" +
      '<div class="wc-world-grid" id="wc-world-grid"></div></section>' +
      // STAGE SELECT: one stage per lesson in the chosen subject
      '<section class="wc-screen wc-stages" id="wc-stages" hidden aria-labelledby="wc-stages-title">' +
      head("wc-stages-title", w.world + " 1") +
      '<p class="wc-screen-sub" id="wc-stages-sub"></p>' +
      '<div class="wc-stage-layout">' +
      '<ol class="wc-stage-list" id="wc-stage-list" aria-label="' + esc(w.stagesLabel) + '"></ol>' +
      '<aside class="wc-stage-panel" aria-label="Game setup">' +
      '<div class="wc-setup">' +
      '<p class="wc-setup-label" id="wc-diff-label">DIFFICULTY</p>' +
      difficultyPickerHtml("wc-diff-label") +
      '<p class="wc-setup-note" id="wc-diff-note"></p></div>' +
      '<div class="wc-setup wc-setup-row">' +
      '<div class="wc-fighter-sprite" id="wc-fighter-sprite" aria-hidden="true"></div>' +
      '<div class="wc-setup-body"><p class="wc-setup-label">' + esc(w.fighter) + "</p>" +
      '<button type="button" class="wc-btn wc-btn-small" id="wc-change-fighter">CHANGE</button></div></div>' +
      (g.setupHtml || "") +
      '<p class="wc-selected-stage" id="wc-selected-stage">' + esc(w.pickStage) + "</p>" +
      '<p class="wc-stage-alert" id="wc-stage-alert" role="alert" hidden></p>' +
      '<button type="button" class="wc-btn wc-btn-primary wc-btn-block" id="wc-fight-btn" disabled>' + esc(g.playLabel) + "</button>" +
      "</aside></div></section>" +
      // RESULTS
      '<section class="wc-screen wc-results" id="wc-results" hidden aria-labelledby="wc-results-title">' +
      '<h2 class="wc-results-title" id="wc-results-title"></h2>' +
      '<p class="wc-results-sub" id="wc-results-sub"></p>' +
      '<div class="wc-card wc-results-card"><div class="battle-result-progress" id="battle-result-progress" hidden></div></div>' +
      '<div class="wc-card wc-review"><h3 class="wc-card-title">REVIEW ANSWERS</h3>' +
      '<ol class="wc-review-list" id="wc-results-review"></ol></div>' +
      '<div class="wc-btn-row">' +
      '<button type="button" class="wc-btn wc-btn-primary" id="wc-play-again">PLAY AGAIN</button>' +
      '<button type="button" class="wc-btn" id="wc-results-stages">' + esc(w.stageSelect) + "</button>" +
      '<button type="button" class="wc-btn" id="wc-results-menu">MENU</button></div></section>' +
      // GAME LOG: past games, each with its answers
      '<section class="wc-screen wc-log" id="wc-log" hidden aria-labelledby="wc-log-title">' +
      head("wc-log-title", g.logTitle) +
      '<p class="wc-status" id="wc-log-status" role="status">Loading…</p>' +
      '<ol class="wc-log-list" id="wc-log-list"></ol></section>' +
      '<section class="wc-screen wc-log-detail" id="wc-log-detail" hidden aria-labelledby="wc-log-detail-title">' +
      head("wc-log-detail-title", "GAME") +
      '<div class="wc-card" id="wc-log-detail-summary"></div>' +
      '<div class="wc-card wc-review"><h3 class="wc-card-title">YOUR ANSWERS</h3>' +
      '<ol class="wc-review-list" id="wc-log-detail-review"></ol></div></section>' +
      // SETTINGS (shared by every game)
      '<section class="wc-screen wc-settings" id="wc-settings" hidden aria-labelledby="wc-settings-title">' +
      head("wc-settings-title", "SETTINGS") +
      '<div class="wc-card wc-settings-card">' +
      '<label class="wc-setting"><span class="wc-setting-name">MUSIC</span>' +
      '<input type="range" class="wc-volume" data-sound-kind="music" min="0" max="100" step="5" value="50" />' +
      '<output class="wc-volume-value" data-sound-kind="music">50</output></label>' +
      '<label class="wc-setting"><span class="wc-setting-name">SOUND FX</span>' +
      '<input type="range" class="wc-volume" data-sound-kind="sfx" min="0" max="100" step="5" value="50" />' +
      '<output class="wc-volume-value" data-sound-kind="sfx">50</output></label>' +
      '<label class="wc-setting wc-has-toggle"><span class="wc-setting-name">REDUCE MOTION</span>' +
      '<input type="checkbox" class="wc-toggle" id="wc-reduce-motion" /></label>' +
      '<div class="wc-setting wc-setting-stack">' +
      '<span class="wc-setting-name" id="wc-default-diff-label">DEFAULT DIFFICULTY</span>' +
      difficultyPickerHtml("wc-default-diff-label") +
      "</div></div></section>"
    );
  }

  function overlayMarkup(g) {
    return (
      '<section class="battle-loading-screen" id="battle-loading-screen" hidden>' +
      '<div class="battle-loading-inner">' +
      '<div class="battle-loading-sprite" id="battle-loading-sprite" aria-hidden="true">🧑‍🎓</div>' +
      '<p class="battle-loading-title">LOADING<span class="battle-loading-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p>' +
      '<div class="battle-loading-bar" role="status" aria-label="Loading">' +
      "<span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>" +
      '<p class="battle-loading-hint" id="battle-loading-hint"></p></div></section>' +
      '<div class="battle-character-dialog" id="battle-character-dialog" hidden>' +
      '<div class="battle-character-panel" role="dialog" aria-modal="true" aria-labelledby="battle-character-title">' +
      '<div class="battle-character-head"><h3 id="battle-character-title">' + esc(g.words.chooseFighter) + "</h3>" +
      '<button type="button" class="battle-character-close" id="battle-character-close" aria-label="Close">' +
      '<i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>' +
      '<div class="battle-character-grid" id="battle-character-grid" role="radiogroup" aria-label="Choose your character"></div>' +
      "</div></div>" +
      // PAUSE: Esc or the Pause button during a game; the clock stops while open
      '<div class="wc-pause" id="wc-pause" hidden role="dialog" aria-modal="true" aria-labelledby="wc-pause-title">' +
      '<div class="wc-pause-panel"><h2 class="wc-pause-title" id="wc-pause-title">PAUSED</h2>' +
      '<nav class="wc-menu-list" aria-label="Pause menu">' +
      '<button type="button" class="wc-menu-item" data-wc-pause="resume">RESUME</button>' +
      '<button type="button" class="wc-menu-item" data-wc-pause="restart">RESTART</button>' +
      '<button type="button" class="wc-menu-item" data-wc-pause="settings">SETTINGS</button>' +
      '<button type="button" class="wc-menu-item" data-wc-pause="quit">QUIT TO MENU</button>' +
      "</nav></div></div>"
    );
  }

  /* ----------------------------------------------------------
   * create(game) — one per game page.
   *
   * game: {
   *   id               "word-clash" | "tic-tac-know" (saved as metadata.game)
   *   name             "Word Clash"
   *   eventType        "battle" (Word Clash) | "game" (every newer game)
   *   title            ["WORD", "CLASH"] — the two logo lines
   *   tagline          line under the logo on PRESS START
   *   logTitle         menu + log screen title, e.g. "BATTLE LOG"
   *   playLabel        stage panel button, e.g. "FIGHT!"
   *   loadingText      loading screen hint while the game gets ready
   *   playScreenId     id of the game's own full-screen play element
   *   setupHtml        extra rows for the stage panel (after the fighter)
   *   words            renames screen words (keys of DEFAULT_WORDS), e.g. { world: "SUBJECT" }
   *   menuMusic        the game's own menu music: a file path, or a function returning a
   *                    promise of one (e.g. music made in the browser); default intro.mp3
   *   difficultyNote(key)          text under the difficulty picker
   *   start(api, ctx)              async; ctx = { lesson, lessonId, difficulty }.
   *                                Load questions (api.loadBank / api.pickQuestions),
   *                                then api.showPlayScreen(). Throw to go back with a message.
   *   playAgain(api)               results PLAY AGAIN
   *   onStagesOpen(api)            stage screen opened (refresh setup rows)
   *   menuCard(api)                { level, expPct, meta } for the menu player card
   *   refreshStats(api)            async; reload what menuCard shows
   *   isCleared(entry)             a saved result that clears its stage (★)
   *   logRow(entry)                { badge (html), cls, meta: [], score }
   *   logDetail(entry)             { title, cls, chips: [] }
   *   canPause(api), onPause(api), onResume(api), canRestart(api), onRestart(api)
   *   quitMessage(api)             text of the "Quit to menu?" dialog
   *   onLeave(api)                 leaving the play screen: stop timers / music
   *   onKeydown(event, api)        keys on the play screen (not Esc)
   *   onCharacterDialog(open, api), onCharacterChange(seed, api)
   * }
   * ---------------------------------------------------------- */
  function create(game) {
    var g = Object.assign(
      {
        eventType: "game",
        logTitle: "GAME LOG",
        playLabel: "PLAY!",
        loadingText: "Getting your game ready…",
        tagline: "",
        setupHtml: "",
      },
      game || {}
    );
    g.words = Object.assign({}, DEFAULT_WORDS, (game && game.words) || {});
    var w = g.words;
    var api = {};

    // The game's own menu music; until it is ready, a request to play waits for it.
    if (g.menuMusic) {
      var menuMusic = null;
      try {
        menuMusic = typeof g.menuMusic === "function" ? g.menuMusic() : g.menuMusic;
      } catch (e) {
        menuMusic = null;
      }
      setTrackSrc(introMusic, null);
      Promise.resolve(menuMusic).then(
        function (src) {
          setTrackSrc(introMusic, src || DEFAULT_INTRO_SRC);
        },
        function () {
          setTrackSrc(introMusic, DEFAULT_INTRO_SRC);
        }
      );
    }
    var SCREENS = ["splash", "menu", "worlds", "stages", "results", "log", "log-detail", "settings"];
    var activeScreen = "splash";
    var settingsReturn = "menu"; // "pause" when Settings was opened from the pause menu
    var subjects = []; // worlds, in the order /student/subjects returns them
    var lessonsById = {};
    var lessonsBySubject = {}; // subject id -> lessons (stages), oldest first
    var worldsLoaded = false;
    var worldsLoading = null;
    var history = { battle: [], game: [] }; // saved results from every game, newest first
    var historyLoaded = false;
    var historyLoading = null;
    var pendingResults = []; // saved this session, not in the server's list yet (still saving)
    var renderedLog = []; // the log rows on screen, so a click opens the row that was shown
    var arcadeStats = null; // /student/arcade-stats
    var currentWorldId = null;
    var selectedLessonId = null;
    var selectedLesson = null;
    var playing = false; // the game's play screen is in use (also while its Settings is open from Pause)
    var characterDialogOpener = null;

    function $(id) {
      return document.getElementById(id);
    }

    function screenEl(name) {
      return $("wc-" + name);
    }

    function playScreen() {
      return $(g.playScreenId);
    }

    function call(hook) {
      var fn = g[hook];
      if (typeof fn !== "function") return undefined;
      return fn.apply(null, Array.prototype.slice.call(arguments, 1));
    }

    /* ---------- saved results ---------- */
    function gameLog() {
      if (g.eventType === "battle") return history.battle;
      return history.game.filter(function (e) {
        return String(e.game || "") === g.id;
      });
    }

    /** Every game's results, newest first: which questions this student has seen (shared bank). */
    function answeredEvents() {
      return history.battle.concat(history.game).sort(function (a, b) {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
    }

    async function loadHistory() {
      var sid = studentId();
      if (!sid || typeof apiUrl !== "function") return history;
      try {
        var data = await fetchJson("/student/learning-history?student_id_number=" + encodeURIComponent(sid));
        var lists = {
          battle: Array.isArray(data.battle) ? data.battle : [],
          game: Array.isArray(data.game) ? data.game : [],
        };
        // Keep this session's results that the server doesn't list yet (matched by client_id).
        pendingResults = pendingResults.filter(function (p) {
          var onServer = lists[p.type].some(function (e) {
            return e.client_id && e.client_id === p.entry.client_id;
          });
          if (!onServer) lists[p.type].unshift(p.entry);
          return !onServer;
        });
        history.battle = lists.battle;
        history.game = lists.game;
        historyLoaded = true;
      } catch (e) {
        console.warn("Arcade history failed:", e);
      }
      return history;
    }

    function ensureHistory() {
      if (historyLoaded) return Promise.resolve(history);
      if (!historyLoading) {
        historyLoading = loadHistory().finally(function () {
          historyLoading = null;
        });
      }
      return historyLoading;
    }

    async function loadArcadeStats() {
      var sid = studentId();
      if (!sid || typeof apiUrl !== "function") return arcadeStats;
      try {
        arcadeStats = await fetchJson("/student/arcade-stats?student_id_number=" + encodeURIComponent(sid));
      } catch (e) {
        console.warn("Arcade stats failed:", e);
      }
      return arcadeStats;
    }

    async function refreshStats() {
      if (typeof g.refreshStats === "function") await g.refreshStats(api);
      else await loadArcadeStats();
      renderMenuCard();
    }

    /* ---------- main menu player card ---------- */
    function defaultMenuCard() {
      var st = arcadeStats || {};
      var perLevel = Number(st.exp_per_level || EXP_PER_LEVEL) || EXP_PER_LEVEL;
      var into = Number(st.exp_into_level || 0);
      var mine = (st.games && st.games[g.id]) || {};
      return {
        level: "ARCADE LV " + Number(st.level || 0) + " · " + into + "/" + perLevel + " EXP",
        expPct: Math.round((into / perLevel) * 100),
        meta:
          Number(mine.wins || 0) + " W · " + Number(mine.draws || 0) + " D · " + Number(mine.losses || 0) + " L",
      };
    }

    function renderMenuCard() {
      var card = typeof g.menuCard === "function" ? g.menuCard(api) : defaultMenuCard();
      var set = function (id, text) {
        var el = $(id);
        if (el) el.textContent = text;
      };
      set("wc-player-name", playerName().toUpperCase());
      set("wc-player-level", card.level || "");
      set("wc-player-meta", card.meta || "");
      var fill = $("wc-player-exp-fill");
      if (fill) fill.style.width = Math.max(0, Math.min(100, Number(card.expPct) || 0)) + "%";
      renderCharacterInto($("wc-player-sprite"), selectedCharacter);
    }

    /* ---------- screens ---------- */

    /** Shows one menu screen (hiding the loading and play layers) and focuses its first control. */
    function showScreen(name, opts) {
      activeScreen = name;
      SCREENS.forEach(function (s) {
        var el = screenEl(s);
        if (el) el.hidden = s !== name;
      });
      $("battle-loading-screen")?.setAttribute("hidden", "");
      playScreen()?.setAttribute("hidden", "");
      var app = $("wc-app");
      if (app) {
        app.hidden = false;
        app.scrollTop = 0;
      }
      if (!(opts && opts.noFocus)) focusFirst(screenEl(name));
    }

    function focusFirst(root) {
      if (!root) return;
      var target = root.querySelector(
        ".wc-menu-item:not([hidden]), .wc-press-start, .wc-world:not([disabled]), .wc-stage, .wc-log-item, .wc-btn-primary:not([disabled]), button:not([disabled])"
      );
      if (target) target.focus({ preventScroll: true });
    }

    function showMenu() {
      renderMenuCard();
      showScreen("menu");
    }

    function showLoading(hint) {
      $("wc-app")?.setAttribute("hidden", "");
      playScreen()?.setAttribute("hidden", "");
      setLoadingHint(hint || g.loadingText);
      $("battle-loading-screen")?.removeAttribute("hidden");
    }

    function setLoadingHint(text) {
      var hint = $("battle-loading-hint");
      if (hint) hint.textContent = text;
    }

    function showPlayScreen() {
      playing = true;
      $("wc-app")?.setAttribute("hidden", "");
      $("battle-loading-screen")?.setAttribute("hidden", "");
      playScreen()?.removeAttribute("hidden");
    }

    function playScreenVisible() {
      var el = playScreen();
      return !!el && !el.hidden;
    }

    /** BACK and Esc on the menu screens. */
    function goBack() {
      switch (activeScreen) {
        case "worlds":
        case "log":
          showMenu();
          break;
        case "stages":
          showScreen("worlds", { noFocus: true });
          focusWorld(currentWorldId);
          break;
        case "log-detail":
          showScreen("log", { noFocus: true });
          focusFirst($("wc-log-list"));
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
      if (settingsReturn === "pause" && playing) {
        $("wc-app")?.setAttribute("hidden", "");
        playScreen()?.removeAttribute("hidden");
        openPause();
        return;
      }
      showMenu();
    }

    /* ---------- worlds (subjects) and stages (lessons) ---------- */

    /** Subjects become worlds; their published lessons become stages. */
    async function loadWorlds() {
      var sid = studentId();
      if (!sid) throw new Error("Sign in as a student to play.");
      var q = "?student_id_number=" + encodeURIComponent(sid);
      var results = await Promise.all([fetchJson("/student/subjects" + q), fetchJson("/student/lessons" + q + "&lite=1")]);
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

    function clearedLessonIds() {
      var cleared = {};
      gameLog().forEach(function (entry) {
        var ok = typeof g.isCleared === "function" ? g.isCleared(entry) : String(entry.outcome || "").toLowerCase() === "win";
        if (ok && entry.lesson_id) cleared[String(entry.lesson_id)] = true;
      });
      return cleared;
    }

    /** Worlds use the subject's colour in its dark-mode (blue/violet) form, matching the game palette. */
    function worldColor(subject) {
      var c = (subject && subject.color) || "#ca8a04";
      return typeof darkSubjectColor === "function" ? darkSubjectColor(c) : c;
    }

    async function openWorlds() {
      showScreen("worlds", { noFocus: true });
      var status = $("wc-worlds-status");
      var grid = $("wc-world-grid");
      if (!worldsLoaded) {
        if (status) {
          status.hidden = false;
          status.textContent = w.loadingWorlds;
        }
        if (grid) grid.innerHTML = "";
      }
      try {
        await Promise.all([ensureWorlds(), ensureHistory()]);
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
      var status = $("wc-worlds-status");
      var grid = $("wc-world-grid");
      if (!grid) return;
      if (!subjects.length) {
        if (status) {
          status.hidden = false;
          status.textContent = w.noWorlds;
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
            '<span class="wc-world-banner"><span class="wc-world-num">' +
            esc(w.world) +
            " " +
            (i + 1) +
            "</span></span>" +
            '<span class="wc-world-body">' +
            '<span class="wc-world-name">' +
            esc(subject.name || "Subject") +
            "</span>" +
            '<span class="wc-world-meta">' +
            (stages.length
              ? stages.length +
                " " +
                esc(stages.length === 1 ? w.stage : w.stages) +
                ' · <i class="fa-solid ' +
                esc(w.clearedIcon) +
                ' wc-star" aria-hidden="true"></i> ' +
                done +
                "/" +
                stages.length
              : esc(w.noStages)) +
            "</span></span></button>"
          );
        })
        .join("");
    }

    function focusWorld(worldId) {
      var grid = $("wc-world-grid");
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
      var title = $("wc-stages-title");
      var sub = $("wc-stages-sub");
      if (title) title.textContent = w.world + " " + (subjects.indexOf(subject) + 1);
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
      renderCharacterInto($("wc-fighter-sprite"), selectedCharacter);
      renderDifficultyPicker();
      call("onStagesOpen", api);
      showScreen("stages", { noFocus: true });
      var list = $("wc-stage-list");
      var focusEl =
        (selectedLessonId && list && list.querySelector('.wc-stage[data-lesson-id="' + cssEscape(selectedLessonId) + '"]')) ||
        (list && list.querySelector(".wc-stage"));
      if (focusEl) focusEl.focus({ preventScroll: true });
    }

    function renderStages() {
      var list = $("wc-stage-list");
      if (!list) return;
      var worldNum =
        subjects.findIndex(function (s) {
          return String(s.id) === String(currentWorldId);
        }) + 1;
      var stages = lessonsBySubject[String(currentWorldId)] || [];
      var cleared = clearedLessonIds();
      if (!stages.length) {
        list.innerHTML = '<li class="wc-stage-empty">' + esc(w.emptyWorld) + "</li>";
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
            esc(w.stageNum(worldNum, i + 1)) +
            "</span>" +
            '<span class="wc-stage-name">' +
            esc(stageLabel(lesson)) +
            "</span>" +
            (cleared[id]
              ? '<span class="wc-stage-badge is-cleared"><i class="fa-solid ' + esc(w.clearedIcon) + '" aria-hidden="true"></i> ' + esc(w.cleared) + "</span>"
              : '<span class="wc-stage-badge">NEW</span>') +
            "</button></li>"
          );
        })
        .join("");
      renderSelectedStage();
    }

    /** Why the last PLAY didn't start; stays above the button until the student changes something. */
    function setStageAlert(text) {
      var el = $("wc-stage-alert");
      if (!el) return;
      el.textContent = text || "";
      el.hidden = !text;
    }

    function renderSelectedStage() {
      var label = $("wc-selected-stage");
      var playBtn = $("wc-fight-btn");
      if (label) label.textContent = selectedLesson ? stageLabel(selectedLesson) : w.pickStage;
      if (playBtn) playBtn.disabled = !selectedLesson;
    }

    function readLastLessonId() {
      try {
        return localStorage.getItem(LAST_LESSON_KEY) || "";
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
          localStorage.setItem(LAST_LESSON_KEY, selectedLessonId);
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
      // Focus moves to PLAY, so picking a stage and pressing Enter starts it
      // (on phones this also scrolls the setup panel into view).
      $("wc-fight-btn")?.focus();
    }

    /* ---------- difficulty ---------- */
    function saveDifficulty(key) {
      if (!DIFFICULTIES[key]) return;
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
      var note = $("wc-diff-note");
      if (note) note.textContent = typeof g.difficultyNote === "function" ? g.difficultyNote(selectedDifficulty) : "";
    }

    function setupDifficultyPickers() {
      document.querySelectorAll(".battle-difficulty-picker").forEach(function (picker) {
        picker.addEventListener("click", function (e) {
          var btn = e.target.closest(".battle-difficulty-option");
          var key = btn && btn.getAttribute("data-difficulty");
          if (key && DIFFICULTIES[key]) {
            saveDifficulty(key);
            playClickSound();
          }
        });
        // Left/right move between options (radio group behaviour).
        picker.addEventListener("keydown", function (e) {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          var keys = Object.keys(DIFFICULTIES);
          var idx = keys.indexOf(selectedDifficulty);
          idx = (idx + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length;
          saveDifficulty(keys[idx]);
          picker.querySelector('[data-difficulty="' + selectedDifficulty + '"]')?.focus();
          e.preventDefault();
          e.stopPropagation();
        });
      });
      renderDifficultyPicker();
    }

    /* ---------- settings ---------- */
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
      $("wc-reduce-motion")?.addEventListener("change", function (e) {
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

    /* ---------- fighter picker ---------- */
    function renderCharacterPicker() {
      var grid = $("battle-character-grid");
      if (!grid) return;
      if (!grid.childElementCount) {
        grid.innerHTML = CHARACTER_SEEDS.map(function (seed) {
          return (
            '<button type="button" class="battle-character-option" role="radio" data-character="' +
            esc(seed) +
            '" aria-label="' +
            esc(w.fighter.charAt(0) + w.fighter.slice(1).toLowerCase()) +
            " " +
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

    function setCharacterDialogOpen(open) {
      var dialog = $("battle-character-dialog");
      if (!dialog) return;
      if (open) {
        renderCharacterPicker();
        characterDialogOpener = document.activeElement;
      }
      dialog.hidden = !open;
      call("onCharacterDialog", open, api);
      if (open) {
        dialog.querySelector(".battle-character-option.is-active")?.focus();
      } else if (characterDialogOpener && characterDialogOpener.isConnected && characterDialogOpener.offsetParent) {
        characterDialogOpener.focus();
      }
    }

    function setupCharacterPicker() {
      var grid = $("battle-character-grid");
      var dialog = $("battle-character-dialog");
      if (!grid || !dialog) return;
      $("battle-character-close")?.addEventListener("click", function () {
        setCharacterDialogOpen(false);
      });
      dialog.addEventListener("click", function (e) {
        if (e.target === dialog) setCharacterDialogOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !dialog.hidden) {
          // Closes only the picker: the menu's Esc (go back a screen) must not run too.
          e.preventDefault();
          e.stopImmediatePropagation();
          setCharacterDialogOpen(false);
        }
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
        ["wc-fighter-sprite", "wc-player-sprite"].forEach(function (id) {
          renderCharacterInto($(id), seed);
        });
        call("onCharacterChange", seed, api);
        playClickSound();
        setCharacterDialogOpen(false);
      });
      $("wc-change-fighter")?.addEventListener("click", function () {
        playClickSound();
        setCharacterDialogOpen(true);
      });
    }

    /* ---------- playing ---------- */
    async function startGame() {
      if (!selectedLesson) return;
      setStageAlert("");
      ensureIntroMusic();
      renderCharacterInto($("battle-loading-sprite"), selectedCharacter);
      showLoading(g.loadingText);
      try {
        await g.start(api, { lesson: selectedLesson, lessonId: selectedLessonId, difficulty: selectedDifficulty });
      } catch (err) {
        playing = false;
        stopIntroMusic();
        var message = (err && err.message) || "Could not start the game.";
        if (currentWorldId && subjects.length) {
          openStages(currentWorldId);
          setStageAlert(message); // stays visible, unlike a toast
        } else {
          showMenu();
          if (typeof showToast === "function") showToast(message, "error");
        }
      }
    }

    /** Leaves the play screen (or its results) for the main menu or the stage list. */
    function leavePlay(target) {
      call("onLeave", api);
      playing = false;
      closePause(true);
      if (target === "stages" && currentWorldId && subjects.length) {
        openStages(currentWorldId);
      } else {
        showMenu();
      }
      ensureIntroMusic();
    }

    /**
     * Saves a finished game: adds the lesson, game and difficulty, keeps it in
     * this page's log right away and records it in the LMS history (server).
     */
    function saveResult(entry) {
      var full = Object.assign(
        {
          lesson_id: selectedLessonId || null,
          lesson_title: selectedLesson ? lessonTitle(selectedLesson) : g.name,
          subject_name: selectedLesson ? String(selectedLesson.subject_name || "") : "",
          game: g.id,
          difficulty: selectedDifficulty,
        },
        entry || {}
      );
      // Same id here and on the server copy, so the two are known to be one game.
      if (!full.client_id) full.client_id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      var local = Object.assign({ timestamp: new Date().toISOString() }, full);
      (g.eventType === "battle" ? history.battle : history.game).unshift(local);
      pendingResults.push({ type: g.eventType === "battle" ? "battle" : "game", entry: local });
      if (typeof recordStudentHistory === "function") recordStudentHistory(g.eventType, full);
      try {
        localStorage.setItem(LAST_GAME_KEY, g.id); // the Arcade page opens on this game
      } catch (e) {
        /* ignore */
      }
      setTimeout(function () {
        void loadHistory();
        void refreshStats();
      }, 1800);
      return full;
    }

    /**
     * Results screen. r = { outcome: "win" | "lose" | "draw", title, sub,
     * progressHtml, answers, againLabel }.
     */
    function showResults(r) {
      var title = $("wc-results-title");
      var again = $("wc-play-again");
      var progress = $("battle-result-progress");
      if (title) {
        title.textContent = r.title || "";
        title.classList.toggle("is-win", r.outcome === "win");
        title.classList.toggle("is-draw", r.outcome === "draw");
      }
      var sub = $("wc-results-sub");
      if (sub) sub.textContent = r.sub || "";
      if (progress) {
        progress.innerHTML = r.progressHtml || "";
        progress.hidden = !r.progressHtml;
      }
      renderReviewList($("wc-results-review"), r.answers || []);
      if (again) again.textContent = r.againLabel || (r.outcome === "win" ? "PLAY AGAIN" : "TRY AGAIN");
      showScreen("results", { noFocus: true });
      again?.focus({ preventScroll: true });
    }

    /* ---------- pause ---------- */
    function openPause() {
      if (!playing || !playScreenVisible()) return;
      if (typeof g.canPause === "function" && !g.canPause(api)) return;
      var el = $("wc-pause");
      if (!el || !el.hidden) return;
      call("onPause", api);
      el.hidden = false;
      var restart = el.querySelector('[data-wc-pause="restart"]');
      if (restart) restart.hidden = typeof g.canRestart === "function" ? !g.canRestart(api) : false;
      focusFirst(el);
      playClickSound();
    }

    /** silent: just hide it (game ending / leaving / restarting) without resuming the clock. */
    function closePause(silent) {
      var el = $("wc-pause");
      if (!el || el.hidden) return;
      el.hidden = true;
      if (silent) return;
      call("onResume", api);
    }

    function isPaused() {
      var el = $("wc-pause");
      return !!el && !el.hidden;
    }

    async function onPauseAction(action) {
      if (action === "resume") {
        playClickSound();
        closePause();
      } else if (action === "restart") {
        playClickSound();
        closePause(true);
        call("onRestart", api);
      } else if (action === "settings") {
        playClickSound();
        $("wc-pause").hidden = true; // stays paused while in Settings
        openSettings("pause");
      } else if (action === "quit") {
        var ok = await confirmDialog({
          title: "Quit to menu?",
          message: typeof g.quitMessage === "function" ? g.quitMessage(api) : "This game won't be saved.",
          confirmText: "Quit",
          cancelText: "Keep playing",
        });
        if (ok) leavePlay("menu");
        else document.querySelector('[data-wc-pause="quit"]')?.focus();
      }
    }

    /* ---------- game log ---------- */
    async function openLog() {
      showScreen("log", { noFocus: true });
      var status = $("wc-log-status");
      var list = $("wc-log-list");
      if (status) {
        status.hidden = false;
        status.textContent = "Loading…";
      }
      if (list) list.innerHTML = "";
      await ensureHistory();
      renderLog();
      focusFirst(screenEl("log"));
    }

    function renderLog() {
      var status = $("wc-log-status");
      var list = $("wc-log-list");
      if (!list) return;
      var entries = gameLog().slice();
      renderedLog = entries;
      if (!entries.length) {
        if (status) {
          status.hidden = false;
          status.textContent = "No games yet. Press START and pick a stage to play.";
        }
        list.innerHTML = "";
        return;
      }
      if (status) status.hidden = true;
      list.innerHTML = entries
        .map(function (entry, i) {
          var row = g.logRow(entry);
          return (
            '<li><button type="button" class="wc-log-item ' + esc(row.cls || "") + '" data-log-index="' + i + '">' +
            '<span class="wc-log-outcome">' + row.badge + "</span>" +
            '<span class="wc-log-main"><span class="wc-log-lesson">' + esc(stageLabel({ filename: entry.lesson_title || "Lesson" })) + "</span>" +
            '<span class="wc-log-meta">' + esc((row.meta || []).filter(Boolean).join(" · ")) + "</span></span>" +
            '<span class="wc-log-score">' + esc(row.score || "") + "</span>" +
            "</button></li>"
          );
        })
        .join("");
    }

    function openLogDetail(index) {
      var entry = renderedLog[index];
      if (!entry) return;
      var detail = g.logDetail(entry);
      var title = $("wc-log-detail-title");
      var summary = $("wc-log-detail-summary");
      if (title) {
        title.textContent = detail.title || "";
        title.classList.toggle("is-win", detail.cls === "is-win");
        title.classList.toggle("is-loss", detail.cls === "is-loss");
      }
      if (summary) {
        summary.innerHTML =
          '<p class="wc-log-detail-lesson">' + esc(stageLabel({ filename: entry.lesson_title || "Lesson" })) + "</p>" +
          (entry.subject_name ? '<p class="wc-log-detail-subject">' + esc(entry.subject_name) + "</p>" : "") +
          '<div class="wc-chip-row">' +
          (detail.chips || [])
            .filter(Boolean)
            .map(function (c) {
              return '<span class="wc-chip">' + esc(c) + "</span>";
            })
            .join("") +
          "</div>";
      }
      renderReviewList($("wc-log-detail-review"), Array.isArray(entry.answers) ? entry.answers : null);
      showScreen("log-detail");
    }

    /* ---------- main menu, PRESS START and keyboard ---------- */
    function pressStart() {
      if (activeScreen !== "splash") return;
      getAudioCtx();
      ensureIntroMusic();
      playClickSound();
      showMenu();
    }

    async function quitGame() {
      var ok = await confirmDialog({
        title: "Leave " + g.name + "?",
        message: "You'll go back to the Arcade.",
        confirmText: "Quit",
        cancelText: "Stay",
      });
      if (ok) {
        stopAllTracks();
        global.location.href = "arcade.html";
      } else {
        document.querySelector('[data-wc-action="quit"]')?.focus();
      }
    }

    function onMenuAction(action) {
      playClickSound();
      if (action === "start") void openWorlds();
      else if (action === "log") void openLog();
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
      var charDialog = $("battle-character-dialog");
      if (charDialog && !charDialog.hidden) return;
      var key = e.key;
      var dir = key === "ArrowDown" || key === "ArrowRight" ? 1 : key === "ArrowUp" || key === "ArrowLeft" ? -1 : 0;
      if (playScreenVisible()) {
        var pause = $("wc-pause");
        if (key === "Escape") {
          e.preventDefault();
          if (isPaused()) closePause();
          else openPause();
        } else if (isPaused()) {
          if (dir && (key === "ArrowDown" || key === "ArrowUp")) {
            e.preventDefault();
            moveFocus(pause, ".wc-menu-item", dir);
          }
        } else {
          call("onKeydown", e, api);
        }
        return;
      }
      var loading = $("battle-loading-screen");
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

    /**
     * Deep link: <game>.html?lesson=<file_id>&difficulty=<key>&start=1 skips the
     * menus and starts that lesson right away (dashboard launcher).
     */
    async function applyLaunchFromUrl() {
      var params = new URLSearchParams(global.location.search);
      var lessonId = params.get("lesson");
      if (!lessonId || params.get("start") !== "1") return false;
      global.history.replaceState(null, "", global.location.pathname);
      try {
        await ensureWorlds();
      } catch (e) {
        return false;
      }
      if (!lessonsById[lessonId]) return false;
      var difficulty = params.get("difficulty");
      if (difficulty && DIFFICULTIES[difficulty]) saveDifficulty(difficulty);
      setSelectedLesson(lessonId);
      currentWorldId = String(selectedLesson.subject_id || "");
      void startGame();
      return true;
    }

    /* ---------- build + wire up ---------- */
    function mount() {
      var app = $("wc-app");
      if (!app) {
        app = document.createElement("main");
        app.className = "wc-app";
        app.id = "wc-app";
        document.body.prepend(app);
      }
      app.setAttribute("aria-label", g.name);
      app.innerHTML = shellMarkup(g);
      var holder = document.createElement("div");
      holder.innerHTML = overlayMarkup(g);
      while (holder.firstChild) document.body.appendChild(holder.firstChild);
    }

    function bind() {
      setupSettings();
      setupCharacterPicker();
      setupDifficultyPickers();

      $("wc-press-start")?.addEventListener("click", pressStart);
      // Tapping anywhere on the title screen also counts as PRESS START.
      $("wc-splash")?.addEventListener("click", function (e) {
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
      $("wc-world-grid")?.addEventListener("click", function (e) {
        var btn = e.target.closest(".wc-world[data-world-id]");
        if (!btn || btn.disabled) return;
        playClickSound();
        openStages(btn.getAttribute("data-world-id"));
      });
      $("wc-stage-list")?.addEventListener("click", onStageListClick);
      $("wc-fight-btn")?.addEventListener("click", function () {
        if (!selectedLesson) return;
        playClickSound();
        void startGame();
      });
      $("wc-log-list")?.addEventListener("click", function (e) {
        var btn = e.target.closest(".wc-log-item[data-log-index]");
        if (!btn) return;
        playClickSound();
        openLogDetail(Number(btn.getAttribute("data-log-index")));
      });
      $("wc-play-again")?.addEventListener("click", function () {
        call("playAgain", api);
      });
      $("wc-results-stages")?.addEventListener("click", function () {
        playClickSound();
        leavePlay("stages");
      });
      $("wc-results-menu")?.addEventListener("click", function () {
        playClickSound();
        leavePlay("menu");
      });
      document.querySelectorAll("[data-wc-pause]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          void onPauseAction(btn.getAttribute("data-wc-pause"));
        });
      });
      document.addEventListener("keydown", onGlobalKeydown);
    }

    api = {
      game: g,
      $: $,
      // navigation
      showScreen: showScreen,
      showMenu: showMenu,
      showLoading: showLoading,
      setLoadingHint: setLoadingHint,
      showPlayScreen: showPlayScreen,
      leavePlay: leavePlay,
      openStages: openStages,
      setStageAlert: setStageAlert,
      // pause
      openPause: openPause,
      closePause: closePause,
      isPaused: isPaused,
      isPlaying: function () {
        return playing;
      },
      // what is being played
      lesson: function () {
        return selectedLesson;
      },
      lessonId: function () {
        return selectedLessonId;
      },
      difficulty: function () {
        return selectedDifficulty;
      },
      // data
      ensureHistory: ensureHistory,
      gameLog: gameLog,
      arcadeStats: function () {
        return arcadeStats;
      },
      refreshStats: refreshStats,
      refreshMenuCard: renderMenuCard,
      loadBank: function (lessonId, difficulty) {
        return loadQuestionBank(lessonId, difficulty, {
          gameName: g.name,
          playWord: String(g.playLabel || "PLAY").replace(/[^A-Za-z ]/g, "").trim() || "PLAY",
          onGenerating: function () {
            setLoadingHint("Generating " + (DIFFICULTIES[difficulty] || "").toLowerCase() + " questions with AI…");
          },
        });
      },
      reloadBank: async function (lessonId, difficulty) {
        return bankForDifficulty(await loadLessonContent(lessonId), difficulty);
      },
      pickQuestions: function (bank, lessonId, count) {
        return pickQuestions(bank, answeredEvents(), lessonId, count);
      },
      requestMoreIfLow: requestMoreQuestionsIfLow,
      // results
      saveResult: saveResult,
      showResults: showResults,
      // fighter
      character: function () {
        return selectedCharacter;
      },
      openCharacterPicker: function () {
        setCharacterDialogOpen(true);
      },
    };

    mount();
    bind();
    renderMenuCard();
    void refreshStats();
    void ensureHistory();

    // Deep links go straight into a game; everyone else starts at PRESS START.
    var params = new URLSearchParams(global.location.search);
    var launching = !!params.get("lesson") && params.get("start") === "1";
    if (launching) showLoading(g.loadingText);
    else showScreen("splash");
    void applyLaunchFromUrl().then(function (started) {
      if (launching && !started) showScreen("splash");
    });
    return api;
  }

  global.ArcadeShell = {
    create: create,
    EXP_PER_LEVEL: EXP_PER_LEVEL,
    CLASSROOM_WORDS: CLASSROOM_WORDS,
    esc: esc,
    shuffle: shuffle,
    formatClock: formatClock,
    formatLogDate: formatLogDate,
    difficultyLabel: difficultyLabel,
    gameExpForResult: gameExpForResult,
    studentId: studentId,
    authHeaders: authHeaders,
    fetchJson: fetchJson,
    playerName: playerName,
    answerKey: answerKey,
    renderCharacterInto: renderCharacterInto,
    character: function () {
      return selectedCharacter;
    },
    sound: {
      createTrack: createTrack,
      setSrc: setTrackSrc,
      play: playTrack,
      stop: stopTrack,
      stopAll: stopAllTracks,
      playIntro: playIntroMusic,
      ensureIntro: ensureIntroMusic,
      stopIntro: stopIntroMusic,
      tone: playTone,
      click: playClickSound,
      victory: playVictorySound,
      context: getAudioCtx,
    },
  };
})(window);
