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
  var STOPWORDS = new Set([
    "this", "that", "these", "those", "with", "from", "have", "has", "had",
    "were", "will", "would", "could", "should", "which", "their", "there",
    "about", "into", "than", "then", "them", "they", "your", "each", "some",
    "when", "what", "where", "while", "such", "also", "only", "over", "more",
    "most", "other", "after", "before", "because", "being", "does", "doing",
    "here", "same", "very", "just", "like", "make", "made", "used", "using",
    "known", "shown", "given", "based", "called",
  ]);
  var FALLBACK_WORDS = [
    "analysis", "concept", "evidence", "process", "structure", "theory",
    "context", "summary", "factor", "method", "principle", "reaction",
    "variable", "hypothesis", "system",
  ];
  var LETTER_FILLER =
    "eeeeeeeeeeeeaaaaaaaaaiiiiiiiiiooooooooonnnnnnnrrrrrrrttttttllllssssuuuu" +
    "ddddggg" + "bbccmmppffhhvvwwyykjxqz";

  var fight = null;

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
   * Phase 3 — vocab extraction
   * ---------------------------------------------------------- */

  function addWordsFromText(freq, text, weight) {
    if (!text) return;
    String(text)
      .toLowerCase()
      .split(/[^a-z]+/)
      .forEach(function (w) {
        if (w.length < 4 || w.length > 9) return;
        if (STOPWORDS.has(w)) return;
        freq[w] = (freq[w] || 0) + weight;
      });
  }

  function extractVocabWords(reviewerText, quiz) {
    var freq = {};
    addWordsFromText(freq, reviewerText, 1);
    (Array.isArray(quiz) ? quiz : []).forEach(function (q) {
      if (!q || typeof q !== "object") return;
      addWordsFromText(freq, q.question, 1);
      var choices = q.choices || q.options || [];
      if (Array.isArray(choices)) {
        choices.forEach(function (c) {
          addWordsFromText(freq, c, 1);
        });
      } else if (choices && typeof choices === "object") {
        Object.keys(choices).forEach(function (k) {
          addWordsFromText(freq, choices[k], 1);
        });
      }
      addWordsFromText(freq, q.answer || q.correct_answer, 4);
    });

    return Object.keys(freq)
      .sort(function (a, b) {
        var diff = freq[b] - freq[a];
        return diff !== 0 ? diff : b.length - a.length;
      })
      .slice(0, 14);
  }

  /* ----------------------------------------------------------
   * Phase 3 — letter pool / grid
   * ---------------------------------------------------------- */

  function buildLetterPool(vocabWords) {
    var pool = [];
    vocabWords.forEach(function (w) {
      String(w)
        .split("")
        .forEach(function (ch) {
          pool.push(ch);
          pool.push(ch);
        });
    });
    for (var i = 0; i < LETTER_FILLER.length; i++) pool.push(LETTER_FILLER[i]);
    return pool;
  }

  function drawLetter(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function drawGrid(pool, size) {
    var grid = [];
    for (var i = 0; i < size; i++) grid.push({ letter: drawLetter(pool) });
    return grid;
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
      reviewer: typeof data.reviewer === "string" ? data.reviewer : "",
      quiz: Array.isArray(data.quiz) ? data.quiz : [],
      battleWords: Array.isArray(data.battle_words) ? data.battle_words : [],
    };
  }

  async function generateBattleWordsWithAi(fileId) {
    if (typeof apiUrl !== "function") {
      throw new Error("API helper missing. Check js/core/api.js.");
    }
    var res = await fetch(apiUrl("/generate-battle-words"), {
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
      throw new Error((data && data.error) || "Could not generate battle words.");
    }
    return Array.isArray(data.words) ? data.words : [];
  }

  function showLobbyScreen() {
    document.querySelector(".dashboard-shell")?.removeAttribute("hidden");
    document.getElementById("battle-fight-screen")?.setAttribute("hidden", "");
    document.body.classList.remove("battle-fullscreen-active");
  }

  function showFightScreenEl() {
    document.querySelector(".dashboard-shell")?.setAttribute("hidden", "");
    document.getElementById("battle-fight-screen")?.removeAttribute("hidden");
    document.body.classList.add("battle-fullscreen-active");
  }

  function renderVocabNote() {
    var note = document.getElementById("battle-vocab-note");
    if (!note || !fight) return;
    if (fight.usingFallback) {
      note.hidden = false;
      note.textContent = "Using general vocabulary — no AI content yet for this lesson.";
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
      listEl.innerHTML = '<li class="battle-words-used-empty" id="battle-words-used-empty">No words yet — start attacking!</li>';
      return;
    }
    listEl.innerHTML = fight.wordsUsed
      .map(function (entry) {
        return (
          "<li><span>" +
          esc(entry.word.toUpperCase()) +
          '</span><span class="small-note">+' +
          entry.damage +
          " dmg</span></li>"
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
      previewEl.innerHTML = '<span class="battle-word-preview-placeholder" id="battle-word-preview-placeholder">Tap letters to build a word…</span>';
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
    fight.grid = drawGrid(fight.pool, GRID_SIZE);
    fight.selected = [];
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

  function resolveAiCounterAttack() {
    if (!fight || fight.aiHp <= 0) return;
    var dmg = 6 + Math.floor(Math.random() * 9);
    fight.playerHp = Math.max(0, fight.playerHp - dmg);
    renderHp();
    triggerAttackAnim("ai");
    setTimeout(function () {
      triggerHitAnim("player", dmg);
    }, 200);
    if (typeof showToast === "function") {
      showToast((document.getElementById("battle-fight-ai-name")?.textContent || "AI Rival") + " hits back for " + dmg + "!", "info");
    }
    if (fight.playerHp <= 0) {
      endBattle("lose");
    }
  }

  function onAttackClick() {
    if (!fight || !fight.selected.length) return;
    var word = fight.selected.map(function (idx) { return fight.grid[idx].letter; }).join("").toLowerCase();

    if (word.length < 3) {
      if (typeof showToast === "function") showToast("Words must be at least 3 letters.", "error");
      return;
    }
    if (fight.vocabWords.indexOf(word) === -1) {
      if (typeof showToast === "function") {
        showToast('"' + word.toUpperCase() + '" isn\'t one of this lesson\'s key words. Try another!', "error");
      }
      return;
    }

    var dmg = damageForWordLength(word.length);
    fight.aiHp = Math.max(0, fight.aiHp - dmg);
    fight.wordsUsed.unshift({ word: word, damage: dmg });

    var usedIndexes = fight.selected.slice();
    usedIndexes.forEach(function (idx) {
      fight.grid[idx] = { letter: drawLetter(fight.pool) };
    });
    fight.selected = [];

    renderHp();
    renderWordsUsed();
    renderGrid();
    renderWordPreview();
    triggerAttackAnim("player");
    setTimeout(function () {
      triggerHitAnim("ai", dmg);
    }, 200);

    if (typeof showToast === "function") {
      showToast('"' + word.toUpperCase() + '" hits for ' + dmg + " damage!", "success");
    }

    if (fight.aiHp <= 0) {
      endBattle("win");
      return;
    }
    setTimeout(resolveAiCounterAttack, 700);
  }

  function battleResultSummary() {
    var count = fight ? fight.wordsUsed.length : 0;
    var totalDamage = fight ? fight.wordsUsed.reduce(function (sum, e) { return sum + e.damage; }, 0) : 0;
    return count + " word" + (count === 1 ? "" : "s") + " used, " + totalDamage + " total damage dealt.";
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
    openResultModal(outcome);
  }

  function resetFightForRebattle() {
    if (!fight) return;
    fight.playerHp = PLAYER_MAX_HP;
    fight.aiHp = AI_MAX_HP;
    fight.wordsUsed = [];
    fight.selected = [];
    fight.grid = drawGrid(fight.pool, GRID_SIZE);
    renderHp();
    renderWordsUsed();
    renderGrid();
    renderWordPreview();
  }

  function exitToLobby() {
    fight = null;
    closeResultModal();
    showLobbyScreen();
  }

  async function startBattle() {
    if (!isLobbyReady() || !selectedLesson) return;

    var fileId = selectedLessonId;
    var okBtn = document.getElementById("battle-arena-modal-ok");
    var originalLabel = okBtn ? okBtn.textContent : "Start Battle";
    if (okBtn) {
      okBtn.disabled = true;
      okBtn.textContent = "Loading…";
    }

    try {
      var content = await loadLessonContentAndVocab(fileId);
      var vocab = Array.isArray(content.battleWords) ? content.battleWords.slice() : [];
      var usingAi = vocab.length >= 5;
      var usingFallback = false;

      if (!usingAi) {
        if (okBtn) okBtn.textContent = "Generating battle words…";
        try {
          vocab = await generateBattleWordsWithAi(fileId);
          usingAi = vocab.length >= 5;
        } catch (aiErr) {
          if (typeof showToast === "function") {
            showToast((aiErr && aiErr.message) || "Could not generate AI battle words.", "error");
          }
        }
      }

      if (!usingAi) {
        vocab = extractVocabWords(content.reviewer, content.quiz);
        if (vocab.length < 5) {
          FALLBACK_WORDS.forEach(function (w) {
            if (vocab.indexOf(w) === -1) vocab.push(w);
          });
          usingFallback = true;
        }
      }
      vocab = vocab.slice(0, 15);

      closeBattleModal();

      fight = {
        lessonId: fileId,
        vocabWords: vocab,
        pool: buildLetterPool(vocab),
        grid: [],
        selected: [],
        playerHp: PLAYER_MAX_HP,
        aiHp: AI_MAX_HP,
        wordsUsed: [],
        usingFallback: usingFallback,
      };
      fight.grid = drawGrid(fight.pool, GRID_SIZE);

      var playerNameEl = document.getElementById("battle-fight-player-name");
      if (playerNameEl) {
        playerNameEl.textContent = document.getElementById("student-display-name")?.textContent || "You";
      }

      showFightScreenEl();
      renderVocabNote();
      renderHp();
      renderWordsUsed();
      renderGrid();
      renderWordPreview();
    } catch (err) {
      fight = null;
      if (typeof showToast === "function") {
        showToast((err && err.message) || "Could not start battle.", "error");
      }
    } finally {
      if (okBtn) {
        okBtn.disabled = false;
        okBtn.textContent = originalLabel;
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
