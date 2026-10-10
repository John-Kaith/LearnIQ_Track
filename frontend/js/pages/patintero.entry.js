/**
 * Patintero (patintero.html) — Larong Pinoy: cross every line and come back home.
 *
 * The court has 4 lines; each has a taya who can only move along that line.
 * Move one square at a time (arrow keys, WASD or the on-screen pad). Get to the
 * far end (dulo) and back home (bahay) = one balik; 2 balik win. You have 3 lives.
 *   - Tagged (you and a taya on the same square of its line): a quick question.
 *     Right = lusot: that taya is dazed for a moment so you can get past.
 *     Wrong = out: you lose a life and start the trip again from home.
 *   - At the far end you answer a question for a bonus star.
 * The taya are faster and chase harder on Medium and Hard.
 * Menus, results, log, settings and pause come from the Arcade shell.
 */
(function () {
  "use strict";

  var S = window.ArcadeShell;
  var Q = window.ArcadeQuiz;
  var SP = window.ArcadeSprites;
  var esc = S.esc;
  var sound = S.sound;
  var shell = null;
  var quiz = null;

  var GAME_ID = "patintero";
  var COLS = 5;
  var ROWS = 9; // row 0 = far end (dulo), row 8 = home (bahay)
  var LINES = [1, 3, 5, 7]; // rows with a taya
  var HOME = 8;
  var END = 0;
  var START_COL = 2;
  var GOAL_TRIPS = 2;
  var LIVES = 3;
  var GUARD_SPEED = { normal: 1.5, medium: 2.1, hard: 2.8 }; // squares per second
  var GUARD_CHASE = { normal: 0.45, medium: 0.7, hard: 0.9 }; // chance a taya steps toward you when you're next to its line
  var DAZE_MS = 2500;
  var QUESTION_SECONDS = { normal: 15, medium: 12, hard: 9 };
  var MAX_LOGGED_ANSWERS = 60;
  var PLAYER_COLORS = { t: "#ffd166", p: "#1e3a8a" };

  /* A night-street chase tune, made in the browser (js/arcade/chiptune.js). */
  var AM = [45, 48, 52];
  var F = [41, 45, 48];
  var C = [48, 52, 55];
  var G = [43, 47, 50];
  var E = [40, 44, 47];
  var MENU_SONG = {
    bpm: 128,
    chords: [AM, F, C, G, AM, F, E, E],
    melody: [
      [0, 69, 1], [1, 72, 1], [2, 76, 2], [4, 74, 1], [5, 72, 1], [6, 69, 2],
      [8, 72, 1], [9, 74, 1], [10, 77, 2], [12, 76, 4],
      [16, 79, 1], [17, 76, 1], [18, 72, 2], [20, 74, 1], [21, 76, 1], [22, 79, 2],
      [24, 74, 4], [28, 71, 4],
      [32, 69, 1], [33, 72, 1], [34, 76, 2], [36, 81, 2], [38, 79, 2],
      [40, 77, 1], [41, 76, 1], [42, 74, 2], [44, 72, 4],
      [48, 71, 2], [50, 72, 2], [52, 74, 2], [54, 76, 2],
      [56, 68, 4], [60, 71, 4],
    ],
    lead: { wave: "pulse", gain: 0.06 },
    arp: { wave: "square", gain: 0.03, pattern: [0, 1, 2, 1, 0, 1, 2, 1] },
    bass: { wave: "triangle", gain: 0.22, steps: [0, 2, 4, 6], fifthOn: [2, 6] },
    kick: [0, 4],
    kickGain: 0.26,
    snare: [2, 6],
    snareGain: 0.07,
    hat: [1, 3, 5, 7],
    hatGain: 0.03,
  };
  var PLAY_SONG = {
    bpm: 140,
    chords: [AM, AM, F, G, AM, AM, E, E],
    melody: [
      [0, 76, 1], [2, 76, 1], [3, 74, 1], [4, 72, 2], [6, 69, 2],
      [8, 76, 1], [10, 76, 1], [11, 77, 1], [12, 79, 4],
      [16, 77, 1], [18, 77, 1], [19, 76, 1], [20, 74, 2], [22, 72, 2],
      [24, 71, 2], [26, 72, 2], [28, 74, 4],
      [32, 76, 1], [34, 76, 1], [35, 74, 1], [36, 72, 2], [38, 69, 2],
      [40, 72, 1], [42, 74, 1], [43, 76, 1], [44, 81, 4],
      [48, 80, 2], [50, 76, 2], [52, 74, 2], [54, 71, 2],
      [56, 68, 8],
    ],
    lead: { wave: "pulse", gain: 0.05 },
    bass: { wave: "triangle", gain: 0.22, steps: [0, 2, 4, 6], fifthOn: [2, 6] },
    kick: [0, 4],
    kickGain: 0.28,
    snare: [2, 6],
    snareGain: 0.08,
    hat: [1, 3, 5, 7],
    hatGain: 0.035,
  };

  function makeMusic(song) {
    return window.ArcadeChiptune ? window.ArcadeChiptune.render(song) : Promise.resolve(null);
  }

  var playMusic = sound.createTrack(null, true, "music");
  var match = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    var el = $("pt-status");
    if (el) el.textContent = text || "";
  }

  var toastTimer = null;

  function showToast(text, cls, ms) {
    var el = $("pt-toast");
    if (!el) return;
    el.textContent = text;
    el.className = "sk-toast" + (cls ? " " + cls : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, ms || 1300);
  }

  /* ----------------------------------------------------------
   * Court drawing
   * ---------------------------------------------------------- */
  function buildCourt() {
    var grid = $("pt-grid");
    if (!grid) return;
    var html = "";
    for (var r = 0; r < ROWS; r++) {
      var kind = r === END ? "is-end" : r === HOME ? "is-home" : LINES.indexOf(r) !== -1 ? "is-line" : "is-box";
      html += '<div class="pt-row ' + kind + '">';
      if (r === END) html += '<span class="pt-row-label">DULO</span>';
      if (r === HOME) html += '<span class="pt-row-label">BAHAY</span>';
      html += "</div>";
    }
    grid.innerHTML = html;
    $("pt-runner").innerHTML = SP.sprite("kid", PLAYER_COLORS, { cls: "pt-art" });
    $("pt-guards").innerHTML = match.guards
      .map(function (g, i) {
        return (
          '<div class="pt-guard" id="pt-guard-' + i + '">' +
          SP.sprite("kid", SP.KIDS[(i + 2) % SP.KIDS.length], { cls: "pt-art" }) +
          '<span class="pt-daze" aria-hidden="true">?!</span></div>'
        );
      })
      .join("");
  }

  function place(el, row, col) {
    if (!el) return;
    el.style.left = (col * 100) / COLS + "%";
    el.style.top = (row * 100) / ROWS + "%";
  }

  function renderRunner() {
    if (!match) return;
    place($("pt-runner"), match.player.row, match.player.col);
  }

  function renderGuards() {
    if (!match) return;
    match.guards.forEach(function (g, i) {
      var el = $("pt-guard-" + i);
      place(el, g.row, g.col);
      if (el) el.classList.toggle("is-dazed", match.clock < g.dazedUntil);
    });
  }

  function renderHud() {
    if (!match) return;
    $("pt-trips").textContent = "BALIK " + match.trips + " / " + GOAL_TRIPS;
    var lives = $("pt-lives");
    if (lives) {
      var html = "";
      for (var i = 0; i < LIVES; i++) {
        html += '<i class="fa-solid fa-heart' + (i < match.lives ? "" : " is-lost") + '" aria-hidden="true"></i>';
      }
      lives.innerHTML = html;
      lives.setAttribute("aria-label", match.lives + (match.lives === 1 ? " life" : " lives"));
    }
    var goal = $("pt-goal");
    if (goal) {
      goal.innerHTML = match.reachedEnd
        ? 'NOW GO BACK HOME <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>'
        : 'GO TO THE FAR END <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
    }
  }

  /* ----------------------------------------------------------
   * The taya
   * ---------------------------------------------------------- */
  function newGuards() {
    var starts = [0, 4, 1, 3];
    return LINES.map(function (row, i) {
      return { row: row, col: starts[i], dir: i % 2 ? -1 : 1, acc: Math.random() * 600, dazedUntil: 0 };
    });
  }

  function stepGuard(g) {
    var p = match.player;
    var near = Math.abs(p.row - g.row) <= 1;
    if (near && Math.random() < (GUARD_CHASE[match.difficulty] || GUARD_CHASE.normal)) {
      if (p.col === g.col) return; // blocks the square in front of you
      g.dir = p.col > g.col ? 1 : -1;
    }
    var next = g.col + g.dir;
    if (next < 0 || next >= COLS) {
      g.dir = -g.dir;
      next = g.col + g.dir;
    }
    g.col = next;
  }

  function taggedBy() {
    var p = match.player;
    for (var i = 0; i < match.guards.length; i++) {
      var g = match.guards[i];
      if (g.row === p.row && g.col === p.col && match.clock >= g.dazedUntil) return g;
    }
    return null;
  }

  function tick() {
    var now = Date.now();
    var dt = now - (match ? match.lastTick : now);
    if (!match) return;
    match.lastTick = now;
    if (!match.started || match.ended || match.paused || match.frozen) return;
    match.clock += dt;
    var speed = GUARD_SPEED[match.difficulty] || GUARD_SPEED.normal;
    var moved = false;
    match.guards.forEach(function (g) {
      if (match.clock < g.dazedUntil) return;
      g.acc += dt * speed;
      while (g.acc >= 1000) {
        g.acc -= 1000;
        stepGuard(g);
        moved = true;
      }
    });
    if (moved || match.dazeShown) renderGuards();
    match.dazeShown = match.guards.some(function (g) {
      return match.clock < g.dazedUntil;
    });
    var g = taggedBy();
    if (g) void onTagged(g);
  }

  /* ----------------------------------------------------------
   * The runner
   * ---------------------------------------------------------- */
  function move(dir) {
    if (!match || !match.started || match.ended || match.paused || match.frozen) return;
    var p = match.player;
    var row = p.row + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    var col = p.col + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    p.row = row;
    p.col = col;
    renderRunner();
    sound.tone(LINES.indexOf(row) !== -1 ? 520 : 440, 0.03, "square");
    var g = taggedBy();
    if (g) {
      void onTagged(g);
      return;
    }
    if (row === END && !match.reachedEnd) void onFarEnd();
    else if (row === HOME && match.reachedEnd) onHome();
  }

  function nextQuestion() {
    if (!match.queue.length) match.queue = Q.shuffle(match.bank);
    return match.queue.shift();
  }

  function logAnswer(q, result) {
    if (result.correct) match.correct += 1;
    if (match.answerLog.length >= MAX_LOGGED_ANSWERS) return;
    match.answerLog.push({
      question: String(q.question || "").slice(0, 240),
      answer: q.answer,
      meaning: String(q.meaning || "").slice(0, 200),
      result: result.correct ? "correct" : "unanswered",
      attempts: !result.correct && result.picked ? [String(result.picked).slice(0, 24)] : [],
      hints: 0,
    });
  }

  function ask(label) {
    var q = nextQuestion();
    match.shown.push(q.answer);
    return quiz
      .ask({
        label: label,
        question: q.question,
        choices: Q.choicesFor(q, match.bank, 4),
        answer: q.answer,
        meaning: q.meaning,
        seconds: QUESTION_SECONDS[match.difficulty] || QUESTION_SECONDS.normal,
        continueMs: { correct: 900, wrong: 2300 },
      })
      .then(function (res) {
        if (res && match) logAnswer(q, res);
        return res;
      });
  }

  async function onTagged(guard) {
    if (!match || match.frozen || match.ended) return;
    var token = match.token;
    match.frozen = true;
    $("pt-runner")?.classList.add("is-tagged");
    sound.tone(196, 0.12, "square");
    sound.tone(147, 0.18, "square", 120);
    setStatus("TAYA! ANSWER RIGHT TO SLIP THROUGH");
    var res = await ask("NATAPIK KA!");
    if (!res || !match || match.token !== token) return;
    $("pt-runner")?.classList.remove("is-tagged");
    if (res.correct) {
      guard.dazedUntil = match.clock + DAZE_MS;
      renderGuards();
      showToast("LUSOT! GO, GO, GO!", "is-good", 1200);
    } else {
      match.lives -= 1;
      renderHud();
      if (match.lives <= 0) {
        showToast("OUT!", "is-bad", 1400);
        endMatch();
        return;
      }
      showToast("OUT! BACK TO BAHAY", "is-bad", 1400);
      match.player = { row: HOME, col: START_COL };
      match.reachedEnd = false;
      renderRunner();
      renderHud();
    }
    setStatus("");
    match.frozen = false;
    match.lastTick = Date.now();
  }

  async function onFarEnd() {
    var token = match.token;
    match.reachedEnd = true;
    match.frozen = true;
    renderHud();
    sound.tone(659, 0.08, "square");
    sound.tone(880, 0.1, "square", 90);
    setStatus("DULO! ANSWER FOR A BONUS STAR");
    var res = await ask("DULO · BONUS");
    if (!res || !match || match.token !== token) return;
    if (res.correct) {
      match.bonus += 1;
      showToast("BONUS STAR! NOW GO BACK HOME", "is-info", 1300);
    } else {
      showToast("NO STAR. NOW GO BACK HOME", "is-bad", 1300);
    }
    setStatus("");
    match.frozen = false;
    match.lastTick = Date.now();
  }

  function onHome() {
    match.trips += 1;
    match.reachedEnd = false;
    renderHud();
    sound.victory();
    if (match.trips >= GOAL_TRIPS) {
      endMatch();
      return;
    }
    showToast("ISANG BALIK! ONE MORE", "is-info", 1300);
  }

  /* ----------------------------------------------------------
   * End of the match
   * ---------------------------------------------------------- */
  function computeProgress(outcome) {
    var st = shell.arcadeStats() || {};
    var perLevel = Number(st.exp_per_level || S.EXP_PER_LEVEL) || S.EXP_PER_LEVEL;
    var before = Number(st.total_exp || 0);
    var exp = S.gameExpForResult(outcome, match.correct);
    var after = before + exp;
    return {
      exp: exp,
      correct: match.correct,
      perLevel: perLevel,
      levelAfter: Math.floor(after / perLevel),
      expIntoLevel: after % perLevel,
      leveledUp: Math.floor(after / perLevel) > Math.floor(before / perLevel),
    };
  }

  function progressHtml(p) {
    var stat = function (label, value) {
      return '<div class="battle-result-stat"><span>' + label + "</span><strong>" + esc(value) + "</strong></div>";
    };
    var pct = Math.round((p.expIntoLevel / p.perLevel) * 100);
    return (
      '<div class="battle-result-stats">' +
      stat("Balik", match.trips + "/" + GOAL_TRIPS) +
      stat("EXP", "+" + p.exp) +
      stat("Arcade LV", p.levelAfter) +
      stat("Correct", p.correct) +
      "</div>" +
      '<div class="battle-result-exp" aria-label="EXP to next Arcade level">' +
      '<div class="battle-result-exp-bar"><div class="battle-result-exp-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="battle-result-exp-text">' + p.expIntoLevel + " / " + p.perLevel + " EXP to Arcade Level " + (p.levelAfter + 1) + "</span>" +
      "</div>" +
      (p.leveledUp
        ? '<p class="battle-result-flag is-levelup"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Arcade level up! You reached Level ' + p.levelAfter + "</p>"
        : "")
    );
  }

  function endMatch() {
    if (!match || match.ended) return;
    match.ended = true;
    match.frozen = true;
    quiz.cancel();
    sound.stop(playMusic);
    var outcome = match.trips >= GOAL_TRIPS ? "win" : "lose";
    if (outcome === "lose") {
      sound.tone(392, 0.12, "square");
      sound.tone(311, 0.12, "square", 140);
      sound.tone(262, 0.25, "square", 280);
    }
    var progress = computeProgress(outcome);
    shell.saveResult({
      lesson_id: match.lessonId,
      outcome: outcome,
      difficulty: match.difficulty,
      opponent: "solo",
      match_score: match.trips + " BALIK",
      trips: match.trips,
      lives_left: match.lives,
      bonus_stars: match.bonus,
      correct_answers: match.correct,
      questions_answered: match.answerLog.length,
      exp_gained: progress.exp,
      answers: match.answerLog.slice(),
    });
    shell.requestMoreIfLow({
      lessonId: match.lessonId,
      difficulty: match.difficulty,
      bankSize: match.bankSize,
      unseenKeys: match.unseenKeys,
      shownAnswers: match.shown,
    });
    setStatus(outcome === "win" ? "2 BALIK! YOU WIN!" : "OUT OF LIVES");
    var ended = match;
    setTimeout(function () {
      if (match !== ended) return;
      var stars = match.bonus ? " " + match.bonus + " bonus star" + (match.bonus === 1 ? "" : "s") + "." : "";
      shell.showResults({
        outcome: outcome,
        title: outcome === "win" ? "PANALO!" : "TAYA KA!",
        sub:
          (outcome === "win"
            ? "You made " + GOAL_TRIPS + " round trips with " + match.lives + " " + (match.lives === 1 ? "life" : "lives") + " left."
            : "The taya got you. You made " + match.trips + " round trip" + (match.trips === 1 ? "" : "s") + ".") +
          stars + " " + match.correct + " correct answer" + (match.correct === 1 ? "" : "s") + ".",
        progressHtml: progressHtml(progress),
        answers: match.answerLog,
        againLabel: outcome === "win" ? "PLAY AGAIN" : "TRY AGAIN",
      });
    }, 1300);
  }

  /* ----------------------------------------------------------
   * Match setup
   * ---------------------------------------------------------- */
  function newMatch(lessonId, difficulty, bank, pick) {
    return {
      token: String(Date.now()) + Math.random(),
      lessonId: lessonId,
      difficulty: difficulty,
      bank: bank,
      bankSize: bank.length,
      unseenKeys: pick.unseenKeys,
      queue: pick.questions.slice(),
      shown: [],
      player: { row: HOME, col: START_COL },
      guards: newGuards(),
      lives: LIVES,
      trips: 0,
      reachedEnd: false,
      bonus: 0,
      correct: 0,
      answerLog: [],
      clock: 0,
      lastTick: Date.now(),
      dazeShown: false,
      started: false,
      ended: false,
      paused: false,
      frozen: false,
    };
  }

  function setWaiting(waiting) {
    $("pt-play-screen")?.classList.toggle("is-waiting", waiting);
    var ready = $("pt-ready");
    if (ready) ready.hidden = !waiting;
    if (waiting) $("pt-start-btn")?.focus({ preventScroll: true });
  }

  function showFreshMatch() {
    quiz.cancel();
    buildCourt();
    renderRunner();
    renderGuards();
    renderHud();
    $("pt-runner")?.classList.remove("is-tagged");
    setStatus("");
    shell.showPlayScreen();
    setWaiting(true);
  }

  async function startMatch(api, ctx) {
    var loaded = await Promise.all([api.loadBank(ctx.lessonId, ctx.difficulty), api.ensureHistory()]);
    var bank = loaded[0];
    match = newMatch(ctx.lessonId, ctx.difficulty, bank, api.pickQuestions(bank, ctx.lessonId, bank.length));
    showFreshMatch();
  }

  function onStartClick() {
    if (!match || match.started) return;
    match.started = true;
    match.lastTick = Date.now();
    setWaiting(false);
    sound.stopIntro();
    sound.click();
    sound.play(playMusic);
    setStatus("ARROW KEYS OR THE BUTTONS TO MOVE");
  }

  function restartMatch() {
    if (!match) return;
    var old = match;
    quiz.cancel();
    match = newMatch(old.lessonId, old.difficulty, old.bank, shell.pickQuestions(old.bank, old.lessonId, old.bank.length));
    sound.stopAll();
    sound.playIntro();
    showFreshMatch();
  }

  var playAgainBusy = false;

  async function playAgain() {
    var current = match;
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
    if (match === current) restartMatch();
  }

  var KEY_MOVES = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
    W: "up",
    S: "down",
    A: "left",
    D: "right",
  };

  function onKeydown(e) {
    if (!match) return;
    if (quiz.isOpen()) {
      quiz.handleKey(e);
      return;
    }
    var dir = KEY_MOVES[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  }

  /* ----------------------------------------------------------
   * Match Log
   * ---------------------------------------------------------- */
  function isWin(m) {
    return String((m && m.outcome) || "").toLowerCase() === "win";
  }

  function logRow(m) {
    var win = isWin(m);
    return {
      badge: win ? '<i class="fa-solid fa-check" aria-hidden="true"></i> WON' : '<i class="fa-solid fa-xmark" aria-hidden="true"></i> OUT',
      cls: win ? "is-win" : "is-loss",
      meta: [S.formatLogDate(m.timestamp), S.difficultyLabel(m.difficulty), m.subject_name || ""],
      score: m.match_score || "",
    };
  }

  function logDetail(m) {
    return {
      title: isWin(m) ? "PANALO!" : "TAYA KA!",
      cls: isWin(m) ? "is-win" : "is-loss",
      chips: [
        S.formatLogDate(m.timestamp),
        S.difficultyLabel(m.difficulty),
        m.match_score || "",
        m.lives_left != null ? Number(m.lives_left) + " LIVES LEFT" : "",
        m.bonus_stars ? Number(m.bonus_stars) + " BONUS" : "",
        m.exp_gained != null ? "+" + Number(m.exp_gained) + " EXP" : "",
        Number(m.correct_answers || 0) + " CORRECT",
      ],
    };
  }

  function difficultyNote(key) {
    var seconds = QUESTION_SECONDS[key] || QUESTION_SECONDS.normal;
    var pace = key === "hard" ? "fast" : key === "medium" ? "quicker" : "slow";
    return seconds + " seconds per question · " + pace + " taya";
  }

  var SETUP_HTML =
    '<div class="wc-setup">' +
    '<p class="wc-setup-label">HOW TO WIN</p>' +
    '<p class="wc-setup-note">Make 2 round trips (balik) with 3 lives.</p>' +
    "</div>";

  function setup() {
    quiz = Q.create({
      host: $("pt-quiz"),
      isPaused: function () {
        return !!match && match.paused;
      },
    });
    shell = S.create({
      id: GAME_ID,
      name: "Patintero",
      eventType: "game",
      title: ["LARONG PINOY", "PATINTERO"],
      tagline: "Cross the lines, dodge the taya, come back home!",
      logTitle: "GAME LOG",
      playLabel: "PLAY!",
      loadingText: "Drawing the lines…",
      loadingTips: [
        { label: "ALAM MO BA?", text: "Patintero is played on lines drawn on the ground. The taya guard the lines while the runners cross and come back." },
        "Answer right to slip past the taya. Grab the bonus star, then run back home!",
      ],
      playScreenId: "pt-play-screen",
      setupHtml: SETUP_HTML,
      words: S.CLASSROOM_WORDS,
      menuMusic: function () {
        return makeMusic(MENU_SONG);
      },
      difficultyNote: difficultyNote,
      start: startMatch,
      playAgain: function () {
        void playAgain();
      },
      isCleared: isWin,
      logRow: logRow,
      logDetail: logDetail,
      canPause: function () {
        return !!match && !match.ended;
      },
      onPause: function () {
        if (match) match.paused = true;
      },
      onResume: function () {
        if (!match) return;
        match.paused = false;
        match.lastTick = Date.now();
        $("pt-pause-btn")?.focus({ preventScroll: true });
      },
      canRestart: function () {
        return !!match && match.started;
      },
      onRestart: restartMatch,
      quitMessage: function () {
        return match && match.started ? "This game won't be saved." : "You'll go back to the main menu.";
      },
      onLeave: function () {
        quiz.cancel();
        sound.stopAll();
        setWaiting(false);
        match = null;
      },
      onKeydown: onKeydown,
    });

    makeMusic(PLAY_SONG)
      .then(function (src) {
        if (src) sound.setSrc(playMusic, src);
      })
      .catch(function (e) {
        console.warn("Patintero music:", e);
      });

    setInterval(tick, 50);
    $("pt-pause-btn")?.addEventListener("click", shell.openPause);
    $("pt-start-btn")?.addEventListener("click", onStartClick);
    document.querySelectorAll(".pt-pad-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        move(btn.getAttribute("data-move"));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("pt-play-screen") || !window.ArcadeShell || !window.ArcadeQuiz) return;
    setup();
  });
})();
