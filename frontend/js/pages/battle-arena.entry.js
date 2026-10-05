/**
 * Word Clash (battle-arena.html) — the Arcade's spelling battle game.
 *
 * The menus (PRESS START, worlds and stages, results, Battle Log, settings,
 * pause) and the question bank come from the shared Arcade shell
 * (js/arcade/arcade-shell.js). This file is the battle itself: spell the
 * answer with letter tiles to hit the monster before your HP or the clock
 * runs out. Every battle is saved as a "battle" learning event with its
 * question-by-question answers.
 */
(function () {
  "use strict";

  var S = window.ArcadeShell;
  var esc = S.esc;
  var sound = S.sound;
  var shell = null; // ArcadeShell.create(...) for this page

  var GRID_SIZE = 20;
  var PLAYER_MAX_HP = 100;
  var AI_MAX_HP = 100;
  var QUESTIONS_PER_BATTLE = 12;
  var LETTER_FILLER =
    "eeeeeeeeeeeeaaaaaaaaaiiiiiiiiiooooooooonnnnnnnrrrrrrrttttttllllssssuuuu" +
    "ddddggg" + "bbccmmppffhhvvwwyykjxqz";

  var fight = null;

  /* ----------------------------------------------------------
   * Word Clash level: every finished battle earns 5–15 EXP;
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
    var sid = S.studentId();
    if (!sid || typeof apiUrl !== "function") return battleStats;
    try {
      battleStats = await S.fetchJson("/student/battle-stats?student_id_number=" + encodeURIComponent(sid));
      renderNextOpponent();
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

  /* ----------------------------------------------------------
   * Sound: shared volume settings and tones come from the shell.
   * Music: intro.mp3 (shell) loops on the menus and the Ready screen;
   * "game start.mp3" loops once Start is pressed and stops when the
   * battle ends; gameover.mp3 plays once on a loss.
   * ---------------------------------------------------------- */
  var battleMusic = sound.createTrack("audio/game%20start.mp3", true, "music");
  var gameOverSound = sound.createTrack("audio/gameover.mp3", false, "sfx");
  var sfxTimerRunsOut = sound.createTrack("audio/timer%20runsout.mp3", false);
  var sfxWrong = sound.createTrack("audio/wrong.mp3", false);
  var sfxTryAgain = sound.createTrack("audio/try%20again.mp3", false);
  var sfxAttack = sound.createTrack("audio/attack.mp3", false);
  var sfxCorrect = sound.createTrack("audio/correct%20answer.mp3", false);
  var sfxWinStreak = sound.createTrack("audio/5%20win%20streak.mp3", false);

  function playTrack(track) {
    sound.play(track);
  }

  function stopTrack(track) {
    sound.stop(track);
  }

  function stopIntroMusic() {
    sound.stopIntro();
  }

  function playClickSound() {
    sound.click();
  }

  function playScrambleSound() {
    sound.tone(500, 0.05, "square");
    sound.tone(650, 0.05, "square", 40);
  }

  function playAttackSound(who) {
    if (who === "ai") {
      sound.tone(330, 0.07, "square");
      sound.tone(220, 0.09, "square", 60);
    } else {
      sound.tone(440, 0.06, "square");
      sound.tone(660, 0.09, "square", 50);
    }
  }

  function playHitSound() {
    sound.tone(160, 0.14, "square");
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
   * Difficulty (picked in the shell): Normal 15 / Medium 10 / Hard 5 min.
   * ---------------------------------------------------------- */
  var BATTLE_SECONDS = { normal: 15 * 60, medium: 10 * 60, hard: 5 * 60 };

  function battleStartSeconds() {
    var key = fight ? fight.difficulty : shell ? shell.difficulty() : "normal";
    return BATTLE_SECONDS[key] || BATTLE_SECONDS.normal;
  }

  var TIME_PENALTY_WRONG = 5;
  var TIME_BONUS_CORRECT = 3;
  var STREAK_FOR_HEAL = 5;
  var STREAK_HEAL_HP = 5;
  var battleTimerId = null;
  var battleTimerLastTick = 0;

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

  function resultProgressHtml(progress) {
    if (!progress) return "";
    var pct = Math.round((progress.expIntoLevel / EXP_PER_LEVEL) * 100);
    return (
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
        : "")
    );
  }

  function showBattleResults(outcome, progress) {
    var monster = fight && fight.monster ? fight.monster.name : "monster";
    var timeUp = fight && fight.endReason === "time";
    shell.showResults({
      outcome: outcome,
      title: outcome === "win" ? "VICTORY!" : timeUp ? "TIME'S UP!" : "DEFEAT",
      sub:
        (outcome === "win"
          ? "You defeated the " + monster + "! "
          : timeUp
          ? "The clock ran out. "
          : "The " + monster + " won this time. ") + battleResultSummary(),
      progressHtml: resultProgressHtml(progress),
      answers: fight ? fight.answerLog || [] : [],
      againLabel: outcome === "win" ? "PLAY AGAIN" : "TRY AGAIN",
    });
  }

  function endBattle(outcome) {
    if (!fight || fight.ended) return;
    fight.ended = true;
    shell.closePause(true);
    stopBattleTimer();
    stopTrack(battleMusic);
    stopTrack(sfxTimerRunsOut);
    fight.lastOutcome = outcome;
    if (outcome === "win") {
      sound.victory();
    } else {
      playTrack(gameOverSound);
    }
    var progress = computeBattleProgress(outcome);
    saveBattleResult(outcome, progress);
    shell.requestMoreIfLow({
      lessonId: fight.lessonId,
      difficulty: fight.difficulty,
      bankSize: fight.bankSize,
      unseenKeys: fight.unseenKeys,
      shownAnswers: (fight.answerLog || []).map(function (e) {
        return e.answer;
      }),
    });

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
      if (fight === endedFight) showBattleResults(outcome, progress);
    }, 1100);
  }

  /** Saved with every answer, so the results screen, Battle Log and History can replay it. */
  function saveBattleResult(outcome, progress) {
    if (!fight) return;
    var p = progress || computeBattleProgress(outcome);
    shell.saveResult({
      lesson_id: fight.lessonId || null,
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
    });
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
    var pick = shell.pickQuestions(fight.bank || fight.questions, fight.lessonId, QUESTIONS_PER_BATTLE);
    fight.questions = pick.questions;
    fight.unseenKeys = pick.unseenKeys;
    renderHp();
    renderWordsUsed();
    advanceToQuestion(0);
    resetBattleClock();
  }

  /* ----------------------------------------------------------
   * Battle lifecycle (called by the shell)
   * ---------------------------------------------------------- */
  async function startBattle(api, ctx) {
    var loaded = await Promise.all([api.loadBank(ctx.lessonId, ctx.difficulty), api.ensureHistory()]);
    var bank = loaded[0];
    var pick = api.pickQuestions(bank, ctx.lessonId, QUESTIONS_PER_BATTLE);

    fight = {
      lessonId: ctx.lessonId,
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
      difficulty: ctx.difficulty,
      monster: monsterForStage(currentStage()),
    };
    renderMonster(fight.monster);
    S.renderCharacterInto(document.getElementById("battle-player-sprite"));
    renderHintButton();

    var playerNameEl = document.getElementById("battle-fight-player-name");
    if (playerNameEl) playerNameEl.textContent = S.playerName();

    api.showPlayScreen();
    renderHp();
    renderWordsUsed();
    advanceToQuestion(0);
    resetBattleClock();
  }

  /** Same lesson, a fresh pick of questions, full HP, fresh timer, back on the Ready screen. */
  function restartBattle(options) {
    if (!fight) return;
    var opts = options || {};
    stopBattleTimer();
    shell.closePause(true);
    shell.showPlayScreen();
    sound.stopAll();
    if (opts.tryAgain) {
      // "Try Again" after a loss: play try again.mp3 first, then the intro music.
      playTrack(sfxTryAgain);
      var el = sfxTryAgain.el;
      var started = false;
      var startIntro = function () {
        if (started || !fight || fight.started) return;
        started = true;
        sound.playIntro();
      };
      if (el) el.addEventListener("ended", startIntro, { once: true });
      setTimeout(startIntro, 4000); // fallback if the clip can't play
    } else {
      sound.playIntro();
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
      var bank = await shell.reloadBank(current.lessonId, current.difficulty);
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
   * Shell hooks: Battle Log rows, menu card, pause
   * ---------------------------------------------------------- */
  function isWin(b) {
    return String((b && b.outcome) || "").toLowerCase() === "win";
  }

  function battlePoints(b) {
    return Number(b.score != null ? b.score : b.total_damage || 0);
  }

  function logRow(b) {
    var won = isWin(b);
    return {
      badge: won
        ? '<i class="fa-solid fa-star" aria-hidden="true"></i> WON'
        : '<i class="fa-solid fa-xmark" aria-hidden="true"></i> LOST',
      cls: won ? "is-win" : "is-loss",
      meta: [S.formatLogDate(b.timestamp), S.difficultyLabel(b.difficulty), b.subject_name || ""],
      score: battlePoints(b) + " PTS",
    };
  }

  function logDetail(b) {
    var won = isWin(b);
    return {
      title: won ? "VICTORY" : "DEFEAT",
      cls: won ? "is-win" : "is-loss",
      chips: [
        S.formatLogDate(b.timestamp),
        S.difficultyLabel(b.difficulty),
        battlePoints(b) + " PTS",
        b.exp_gained != null ? "+" + Number(b.exp_gained) + " EXP" : "",
        Number(b.correct_answers || 0) + " CORRECT",
        b.level_after != null ? "LV " + Number(b.level_after) : "",
        b.new_best ? "NEW BEST!" : "",
        b.leveled_up ? "LEVEL UP!" : "",
      ],
    };
  }

  /** Main menu player card: Word Clash level, EXP bar, wins and best score. */
  function menuCard() {
    var st = menuStats();
    var into = st.totalExp % EXP_PER_LEVEL;
    return {
      level: "LV " + st.level + " · " + into + "/" + EXP_PER_LEVEL + " EXP",
      expPct: Math.round((into / EXP_PER_LEVEL) * 100),
      meta: st.wins + (st.wins === 1 ? " WIN" : " WINS") + " · BEST " + st.best,
    };
  }

  /* Stage panel row under the fighter: the monster the next battle will be against. */
  var NEXT_OPPONENT_HTML =
    '<div class="wc-setup wc-setup-row">' +
    '<div class="wc-opponent-sprite" id="wc-opponent-sprite" aria-hidden="true"></div>' +
    '<div class="wc-setup-body"><p class="wc-setup-label">NEXT OPPONENT</p>' +
    '<p class="wc-opponent-name" id="wc-opponent-name">—</p></div></div>';

  function setup() {
    shell = S.create({
      id: "word-clash",
      name: "Word Clash",
      eventType: "battle",
      title: ["WORD", "CLASH"],
      tagline: "Spell the answer. Defeat the monsters.",
      logTitle: "BATTLE LOG",
      playLabel: "FIGHT!",
      loadingText: "Preparing your battle…",
      playScreenId: "battle-fight-screen",
      setupHtml: NEXT_OPPONENT_HTML,
      difficultyNote: function (key) {
        return formatBattleTime(BATTLE_SECONDS[key] || BATTLE_SECONDS.normal) + " on the clock";
      },
      start: startBattle,
      playAgain: function () {
        void playAgain();
      },
      onStagesOpen: renderNextOpponent,
      menuCard: menuCard,
      refreshStats: loadBattleStats,
      isCleared: isWin,
      logRow: logRow,
      logDetail: logDetail,
      canPause: function () {
        return !!fight && !fight.ended;
      },
      onPause: function () {
        if (fight) fight.paused = true;
      },
      onResume: function () {
        if (!fight) return;
        fight.paused = false;
        battleTimerLastTick = Date.now(); // time spent paused doesn't count
        document.getElementById("battle-pause-btn")?.focus({ preventScroll: true });
      },
      canRestart: function () {
        return !!fight && fight.started;
      },
      onRestart: function () {
        restartBattle();
      },
      quitMessage: function () {
        return fight && fight.started ? "This battle won't be saved." : "You'll go back to the main menu.";
      },
      onLeave: function () {
        stopBattleTimer();
        sound.stopAll();
        setBattleWaiting(false);
        fight = null;
      },
      // Don't let the clock run while choosing a fighter mid-battle.
      onCharacterDialog: function (open) {
        if (fight && fight.started && !fight.ended) {
          fight.paused = open;
          if (!open) battleTimerLastTick = Date.now();
        }
        document.getElementById("battle-player-sprite")?.setAttribute("aria-expanded", open ? "true" : "false");
      },
      onCharacterChange: function (seed) {
        S.renderCharacterInto(document.getElementById("battle-player-sprite"), seed);
      },
    });

    document.getElementById("battle-pause-btn")?.addEventListener("click", shell.openPause);
    // Click your fighter in the arena to change it.
    var sprite = document.getElementById("battle-player-sprite");
    sprite?.addEventListener("click", shell.openCharacterPicker);
    sprite?.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        shell.openCharacterPicker();
      }
    });
    document.getElementById("battle-letter-grid")?.addEventListener("click", onTileClick);
    document.getElementById("battle-clear-btn")?.addEventListener("click", onClearClick);
    document.getElementById("battle-backspace-btn")?.addEventListener("click", onBackspaceClick);
    document.addEventListener("keydown", onBackspaceKey);
    document.getElementById("battle-scramble-btn")?.addEventListener("click", onScrambleClick);
    document.getElementById("battle-hint-btn")?.addEventListener("click", onHintClick);
    document.getElementById("battle-start-btn")?.addEventListener("click", onStartRoundClick);
    document.getElementById("battle-attack-btn")?.addEventListener("click", onAttackClick);
    document.getElementById("next-btn")?.addEventListener("click", onNextClick);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("battle-fight-screen") || !window.ArcadeShell) return;
    setup();
  });
})();
