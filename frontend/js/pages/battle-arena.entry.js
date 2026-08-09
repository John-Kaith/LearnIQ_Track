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
   * Retro sound effects — synthesized with Web Audio, no audio
   * files needed. Lazily created on first use (autoplay policies
   * require a user gesture, and every caller here fires from a
   * click handler already).
   * ---------------------------------------------------------- */

  function getAudioCtx() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type, delay) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var startAt = ctx.currentTime + (delay || 0) / 1000;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.09, startAt);
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

  function playErrorSound() {
    playTone(140, 0.22, "sawtooth");
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

  function playDefeatSound() {
    playTone(392, 0.16, "sawtooth", 0);
    playTone(330, 0.16, "sawtooth", 140);
    playTone(262, 0.3, "sawtooth", 280);
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
      var badge = card.querySelector(".battle-selected-badge");
      if (badge) badge.hidden = !isOn;
      var selectBtn = card.querySelector("[data-select-lesson]");
      if (selectBtn) {
        selectBtn.textContent = isOn ? "Selected" : "Select Lesson";
        selectBtn.classList.toggle("btn-primary", !isOn);
        selectBtn.classList.toggle("btn-secondary", !!isOn);
        selectBtn.disabled = !!isOn;
      }
    });
    renderSelectedPanel();
    setStartEnabled(isLobbyReady());
  }

  function selectLesson(lessonId) {
    var id = String(lessonId || "").trim();
    if (!id || !lessonsById[id]) return;
    selectedLessonId = id;
    selectedLesson = lessonsById[id];
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
      '<span class="battle-selected-badge" hidden><i class="fa-solid fa-check" aria-hidden="true"></i> Selected</span>' +
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

  async function generateBattleQuestionsWithAi(fileId) {
    if (typeof apiUrl !== "function") {
      throw new Error("API helper missing. Check js/core/api.js.");
    }
    var res = await fetch(apiUrl("/generate-battle-questions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
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
      if (!questionText || answer.length < 4 || answer.length > 10) return;
      out.push({
        question: questionText,
        answer: answer,
        meaning: String(entry.meaning || "").trim(),
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

  function onAttackClick() {
    if (!fight || !fight.selected.length) return;
    var word = fight.selected.map(function (idx) { return fight.grid[idx].letter; }).join("").toLowerCase();

    if (word === fight.currentAnswer) {
      var dmg = damageForWordLength(word.length);
      var meaning = fight.currentMeaning || "";
      fight.aiHp = Math.max(0, fight.aiHp - dmg);
      fight.wordsUsed.unshift({ word: word, damage: dmg, meaning: meaning });

      renderHp();
      renderWordsUsed();
      triggerAttackAnim("player");
      playAttackSound("player");
      setTimeout(function () {
        triggerHitAnim("ai", dmg);
        playHitSound();
      }, 200);

      if (typeof showToast === "function") {
        showToast("Correct! " + dmg + " damage dealt." + (meaning ? " " + meaning : ""), "success");
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

    playErrorSound();
    var counterDmg = 6 + Math.floor(Math.random() * 9);
    fight.playerHp = Math.max(0, fight.playerHp - counterDmg);
    fight.selected = [];

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
      showToast("Not quite — the AI hits back for " + counterDmg + "!", "error");
    }

    if (fight.playerHp <= 0) {
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
        (outcome === "win" ? "You defeated the AI opponent! " : "The AI opponent defeated you. ") +
        battleResultSummary();
    }
    if (primaryBtn) primaryBtn.textContent = outcome === "win" ? "Battle Again" : "Try Again";

    modal.hidden = false;
    document.body.classList.add("lq-modal-open");
  }

  function closeResultModal() {
    var modal = document.getElementById("battle-result-modal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("lq-modal-open");
  }

  function endBattle(outcome) {
    if (outcome === "win") {
      playVictorySound();
    } else {
      playDefeatSound();
    }
    openResultModal(outcome);
    saveBattleResultToHistory(outcome);
  }

  function saveBattleResultToHistory(outcome) {
    if (!fight || typeof recordStudentHistory !== "function") return;
    var totalDamage = fight.wordsUsed.reduce(function (sum, e) { return sum + e.damage; }, 0);
    recordStudentHistory("battle", {
      lesson_id: fight.lessonId || null,
      lesson_title: selectedLesson ? lessonTitle(selectedLesson) : "Battle Arena",
      outcome: outcome,
      correct_answers: fight.wordsUsed.length,
      total_damage: totalDamage,
    });
  }

  function resetFightForRebattle() {
    if (!fight) return;
    fight.playerHp = PLAYER_MAX_HP;
    fight.aiHp = AI_MAX_HP;
    fight.wordsUsed = [];
    fight.questions = shuffleArray(fight.questions);
    renderHp();
    renderWordsUsed();
    advanceToQuestion(0);
  }

  function exitToLobby() {
    fight = null;
    closeResultModal();
    showLobbyScreen();
  }

  async function startBattle() {
    if (!isLobbyReady() || !selectedLesson) return;

    var fileId = selectedLessonId;
    closeBattleModal();
    showLoadingScreen();
    setLoadingHint("Preparing your battle…");

    try {
      var content = await loadLessonContentAndVocab(fileId);
      var questions = normalizeQuestionEntries(content.battleQuestions);
      var usingAi = questions.length >= 5;
      var usingFallback = false;

      if (!usingAi) {
        setLoadingHint("Generating battle questions with AI…");
        try {
          var aiQuestions = await generateBattleQuestionsWithAi(fileId);
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
      };

      var playerNameEl = document.getElementById("battle-fight-player-name");
      if (playerNameEl) {
        playerNameEl.textContent = document.getElementById("student-display-name")?.textContent || "You";
      }

      showFightScreenEl();
      renderVocabNote();
      renderHp();
      renderWordsUsed();
      advanceToQuestion(0);
    } catch (err) {
      fight = null;
      showLobbyScreen();
      if (typeof showToast === "function") {
        showToast((err && err.message) || "Could not start battle.", "error");
      }
    }
  }

  async function onExitBattleClick() {
    var confirmed = true;
    if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
      confirmed = await window.LearnIQConfirm.show({
        title: "Exit Battle?",
        message: "Your progress in this battle will be lost.",
        confirmText: "Exit Battle",
        cancelText: "Keep Battling",
        variant: "danger",
      });
    }
    if (confirmed) exitToLobby();
  }

  function onResultPrimaryClick() {
    closeResultModal();
    resetFightForRebattle();
  }

  function onResultSecondaryClick() {
    exitToLobby();
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
    document.getElementById("battle-attack-btn")?.addEventListener("click", onAttackClick);
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
