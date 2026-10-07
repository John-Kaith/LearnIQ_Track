/**
 * Palosebo (palosebo.html) — Larong Pinoy: a fiesta race up greasy bamboo poles.
 *
 * The student races three bots (KUYA, ATE, BUNSO). Everyone gets the same
 * question from the lesson's shared question bank (multiple choice). A right
 * answer climbs: the faster the answer, the higher the climb. A wrong answer
 * (or no answer) slides down. First to reach the prize at the top wins.
 * Bots answer right more often and faster on Medium and Hard.
 * Menus, results, Match Log, settings and pause come from the Arcade shell;
 * the question card from js/arcade/quiz-card.js. Saved as a "game" event.
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

  var GAME_ID = "palosebo";
  var TOP = 100; // metres to the prize
  var CLIMB = 12; // a right answer
  var SPEED_BONUS = 8; // up to this much more for a fast answer
  var SLIDE = 6; // a wrong answer
  var MAX_QUESTIONS = 25;
  var MAX_LOGGED_ANSWERS = 60;
  var QUESTION_SECONDS = { normal: 14, medium: 11, hard: 9 };
  var BOT_ACCURACY = { normal: 0.55, medium: 0.7, hard: 0.85 };
  var BOT_SPEED = { normal: [0.45, 0.95], medium: [0.3, 0.85], hard: [0.2, 0.7] }; // part of the clock used
  var BOTS = [
    { name: "KUYA", kid: 0 },
    { name: "ATE", kid: 3 },
    { name: "BUNSO", kid: 1 },
  ];
  var PLAYER_COLORS = { t: "#ffd23f", p: "#7c2d12" };

  /* Fiesta band music, made in the browser (js/arcade/chiptune.js). */
  var C = [48, 52, 55];
  var F = [41, 45, 48];
  var G = [43, 47, 50];
  var AM = [45, 48, 52];
  var DM = [38, 41, 45];
  var MENU_SONG = {
    bpm: 116,
    chords: [C, F, G, C, C, F, G, C],
    melody: [
      [0, 72, 1], [1, 72, 1], [2, 76, 2], [4, 79, 2], [6, 76, 2],
      [8, 77, 2], [10, 81, 2], [12, 77, 2], [14, 74, 2],
      [16, 79, 1], [17, 79, 1], [18, 77, 2], [20, 76, 2], [22, 74, 2],
      [24, 72, 4], [28, 79, 2], [30, 76, 2],
      [32, 72, 1], [33, 72, 1], [34, 76, 2], [36, 79, 2], [38, 84, 2],
      [40, 81, 2], [42, 77, 2], [44, 81, 2], [46, 84, 2],
      [48, 83, 2], [50, 79, 2], [52, 77, 2], [54, 74, 2],
      [56, 72, 6],
    ],
    lead: { wave: "pulse", gain: 0.07 },
    bass: { wave: "triangle", gain: 0.24, steps: [0, 2, 4, 6], fifthOn: [2, 6] },
    kick: [0, 4],
    kickGain: 0.28,
    snare: [2, 6],
    snareGain: 0.07,
  };
  var RACE_SONG = {
    bpm: 132,
    chords: [C, AM, F, G, C, AM, DM, G],
    melody: [
      [0, 79, 2], [2, 77, 1], [3, 76, 1], [4, 74, 2], [6, 72, 2],
      [8, 76, 2], [10, 77, 1], [11, 79, 1], [12, 81, 4],
      [16, 81, 2], [18, 79, 1], [19, 77, 1], [20, 76, 2], [22, 74, 2],
      [24, 74, 2], [26, 76, 2], [28, 79, 4],
      [32, 79, 2], [34, 77, 1], [35, 76, 1], [36, 74, 2], [38, 72, 2],
      [40, 76, 2], [42, 77, 1], [43, 79, 1], [44, 84, 4],
      [48, 81, 2], [50, 79, 2], [52, 77, 2], [54, 76, 2],
      [56, 74, 2], [58, 76, 2], [60, 72, 4],
    ],
    lead: { wave: "pulse", gain: 0.06 },
    arp: { wave: "square", gain: 0.03, pattern: [0, 1, 2, 1, 0, 1, 2, 1] },
    bass: { wave: "triangle", gain: 0.22, steps: [0, 2, 4, 6], fifthOn: [2, 6] },
    kick: [0, 4],
    kickGain: 0.3,
    snare: [2, 6],
    snareGain: 0.08,
    hat: [1, 3, 5, 7],
    hatGain: 0.03,
  };

  function makeMusic(song) {
    return window.ArcadeChiptune ? window.ArcadeChiptune.render(song) : Promise.resolve(null);
  }

  var raceMusic = sound.createTrack(null, true, "music");
  var match = null;

  function $(id) {
    return document.getElementById(id);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  /** Resolves true after `ms` of unpaused time, or false if the match was left or restarted meanwhile. */
  function wait(ms, token) {
    return new Promise(function (resolve) {
      var left = ms;
      var last = Date.now();
      var id = setInterval(function () {
        if (!match || match.token !== token) {
          clearInterval(id);
          resolve(false);
          return;
        }
        var now = Date.now();
        if (!match.paused) left -= now - last;
        last = now;
        if (left <= 0) {
          clearInterval(id);
          resolve(true);
        }
      }, 50);
    });
  }

  function placeLabel(n) {
    return n + (n === 1 ? "ST" : n === 2 ? "ND" : n === 3 ? "RD" : "TH");
  }

  function setStatus(text) {
    var el = $("pb-status");
    if (el) el.textContent = text || "";
  }

  /* ----------------------------------------------------------
   * The race
   * ---------------------------------------------------------- */
  function climberArt(r) {
    return SP.sprite("climber", r.isPlayer ? PLAYER_COLORS : SP.KIDS[r.kid], { cls: "pb-climber-art" });
  }

  function renderLanes() {
    var list = $("pb-lanes");
    if (!list || !match) return;
    list.innerHTML = match.racers
      .map(function (r, i) {
        return (
          '<li class="pb-lane' + (r.isPlayer ? " is-player" : "") + '" data-racer="' + i + '">' +
          '<div class="pb-prize">' + SP.sprite("prize", null, { cls: "pb-prize-art" }) + "</div>" +
          '<div class="pb-pole">' +
          '<div class="pb-climber" id="pb-climber-' + i + '">' + climberArt(r) +
          '<span class="pb-delta" id="pb-delta-' + i + '" aria-hidden="true"></span>' +
          '<span class="pb-lock" id="pb-lock-' + i + '" hidden title="Answered"><i class="fa-solid fa-check" aria-hidden="true"></i></span>' +
          "</div></div>" +
          '<div class="pb-name">' + (r.isPlayer ? '<span class="pb-avatar" id="pb-avatar" aria-hidden="true"></span>' : "") + esc(r.name) + "</div>" +
          '<div class="pb-meters" id="pb-meters-' + i + '">0 m</div>' +
          "</li>"
        );
      })
      .join("");
    S.renderCharacterInto($("pb-avatar"));
    positionClimbers();
  }

  function positionClimbers() {
    if (!match) return;
    match.racers.forEach(function (r, i) {
      var el = $("pb-climber-" + i);
      var h = Math.min(TOP, r.total) / TOP;
      if (el) el.style.setProperty("--h", String(h));
      var m = $("pb-meters-" + i);
      if (m) m.textContent = Math.round(Math.min(TOP, r.total)) + " m";
      var lane = document.querySelector('.pb-lane[data-racer="' + i + '"]');
      if (lane) lane.classList.toggle("is-top", r.total >= TOP);
    });
  }

  function showDelta(i, delta) {
    var el = $("pb-delta-" + i);
    if (!el) return;
    el.textContent = (delta > 0 ? "+" : "") + delta;
    el.className = "pb-delta " + (delta > 0 ? "is-up" : "is-down");
    void el.offsetWidth;
    el.classList.add("is-shown");
  }

  function clearLocks() {
    if (!match) return;
    match.racers.forEach(function (r, i) {
      var lock = $("pb-lock-" + i);
      if (lock) lock.hidden = true;
    });
  }

  function nextQuestion() {
    if (!match.queue.length) match.queue = Q.shuffle(match.bank);
    return match.queue.shift();
  }

  /** What each bot will do on this question: right or wrong, and when it answers. */
  function botPlans(seconds) {
    var acc = BOT_ACCURACY[match.difficulty] || BOT_ACCURACY.normal;
    var range = BOT_SPEED[match.difficulty] || BOT_SPEED.normal;
    return match.racers.map(function (r) {
      if (r.isPlayer) return null;
      var answers = Math.random() < 0.92; // sometimes a bot runs out of time
      return {
        answered: answers,
        correct: answers && Math.random() < acc,
        time: answers ? seconds * rand(range[0], range[1]) : seconds,
        shown: false,
      };
    });
  }

  /** Shows a check over each bot when it locks in its answer (it doesn't say if it's right). */
  function watchBots(plans, token) {
    var elapsed = 0;
    var last = Date.now();
    var id = setInterval(function () {
      if (!match || match.token !== token || match.roundOver) {
        clearInterval(id);
        return;
      }
      var now = Date.now();
      if (!match.paused) elapsed += now - last;
      last = now;
      plans.forEach(function (p, i) {
        if (p && p.answered && !p.shown && elapsed >= p.time * 1000) {
          p.shown = true;
          var lock = $("pb-lock-" + i);
          if (lock) lock.hidden = false;
          sound.tone(880, 0.03, "square");
        }
      });
    }, 100);
  }

  function applyRound(result, plans, seconds) {
    match.roundOver = true;
    match.racers.forEach(function (r, i) {
      var correct = r.isPlayer ? result.correct : plans[i].correct;
      var time = r.isPlayer ? result.ms / 1000 : plans[i].time;
      var delta = correct ? CLIMB + Math.round(SPEED_BONUS * Math.max(0, 1 - time / seconds)) : -SLIDE;
      if (!correct && r.total <= 0) delta = 0;
      r.total = Math.max(0, r.total + delta);
      r.lastTime = correct ? time : Infinity;
      if (delta) showDelta(i, delta);
    });
    positionClimbers();
    if (result.correct) {
      sound.tone(523, 0.06, "square");
      sound.tone(659, 0.06, "square", 70);
      sound.tone(784, 0.08, "square", 140);
    } else {
      sound.tone(330, 0.08, "square");
      sound.tone(247, 0.14, "square", 90);
    }
  }

  /** Everyone by height; at the same height, whoever answered faster; the student wins exact ties. */
  function ranking() {
    return match.racers.slice().sort(function (a, b) {
      return (
        Math.min(TOP, b.total) - Math.min(TOP, a.total) ||
        b.total - a.total ||
        a.lastTime - b.lastTime ||
        (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0)
      );
    });
  }

  async function playRound() {
    if (!match || match.ended) return;
    var token = match.token;
    match.qIndex += 1;
    match.roundOver = false;
    $("pb-round").textContent = "QUESTION " + match.qIndex;
    var q = nextQuestion();
    match.shown.push(q.answer);
    var seconds = QUESTION_SECONDS[match.difficulty] || QUESTION_SECONDS.normal;
    var plans = botPlans(seconds);
    clearLocks();
    setStatus("ANSWER FAST TO CLIMB HIGHER!");
    watchBots(plans, token);
    var result = await quiz.ask({
      label: "QUESTION " + match.qIndex,
      question: q.question,
      choices: Q.choicesFor(q, match.bank, 4),
      answer: q.answer,
      meaning: q.meaning,
      seconds: seconds,
      continueMs: { correct: 1200, wrong: 2300 },
      onAnswered: function (res) {
        applyRound(res, plans, seconds);
      },
    });
    if (!result || !match || match.token !== token) return;
    logAnswer(q, result);
    var leader = ranking()[0];
    if (leader.total >= TOP || match.qIndex >= MAX_QUESTIONS) {
      endMatch();
      return;
    }
    setStatus("");
    if (!(await wait(450, token))) return;
    void playRound();
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

  /* ----------------------------------------------------------
   * End of the race
   * ---------------------------------------------------------- */
  function computeProgress(outcome, place) {
    var st = shell.arcadeStats() || {};
    var perLevel = Number(st.exp_per_level || S.EXP_PER_LEVEL) || S.EXP_PER_LEVEL;
    var before = Number(st.total_exp || 0);
    var exp = S.gameExpForResult(outcome, match.correct);
    var after = before + exp;
    return {
      exp: exp,
      place: place,
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
      stat("Place", placeLabel(p.place)) +
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
    quiz.cancel();
    sound.stop(raceMusic);
    var order = ranking();
    var player = match.racers[0];
    var place = order.indexOf(player) + 1;
    var winner = order[0];
    var outcome = place === 1 ? "win" : "lose";
    if (outcome === "win") sound.victory();
    else {
      sound.tone(392, 0.12, "square");
      sound.tone(330, 0.12, "square", 140);
      sound.tone(262, 0.25, "square", 280);
    }
    var progress = computeProgress(outcome, place);
    shell.saveResult({
      lesson_id: match.lessonId,
      outcome: outcome,
      difficulty: match.difficulty,
      opponent: "bot",
      place: place,
      match_score: placeLabel(place) + " PLACE",
      climbed_m: Math.round(Math.min(TOP, player.total)),
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
    setStatus(place === 1 ? "YOU GRABBED THE PRIZE!" : winner.name + " GRABBED THE PRIZE!");
    var ended = match;
    setTimeout(function () {
      if (match !== ended) return;
      var sub =
        place === 1
          ? "You reached the prize first! "
          : winner.name + " reached the prize first. You finished " + placeLabel(place).toLowerCase() + ". ";
      sub += match.correct + " correct answer" + (match.correct === 1 ? "" : "s") + ".";
      shell.showResults({
        outcome: outcome,
        title: place === 1 ? "PANALO!" : placeLabel(place) + " PLACE",
        sub: sub,
        progressHtml: progressHtml(progress),
        answers: match.answerLog,
        againLabel: place === 1 ? "PLAY AGAIN" : "TRY AGAIN",
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
      racers: [{ name: "YOU", isPlayer: true, total: 0, lastTime: Infinity }].concat(
        BOTS.map(function (b) {
          return { name: b.name, kid: b.kid, isPlayer: false, total: 0, lastTime: Infinity };
        })
      ),
      qIndex: 0,
      correct: 0,
      answerLog: [],
      started: false,
      ended: false,
      paused: false,
      roundOver: false,
    };
  }

  function setWaiting(waiting) {
    $("pb-play-screen")?.classList.toggle("is-waiting", waiting);
    var ready = $("pb-ready");
    if (ready) ready.hidden = !waiting;
    if (waiting) $("pb-start-btn")?.focus({ preventScroll: true });
  }

  function showFreshMatch() {
    quiz.cancel();
    renderLanes();
    $("pb-round").textContent = "QUESTION 1";
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
    setWaiting(false);
    sound.stopIntro();
    sound.click();
    sound.play(raceMusic);
    void playRound();
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

  /* ----------------------------------------------------------
   * Match Log
   * ---------------------------------------------------------- */
  function isWin(m) {
    return String((m && m.outcome) || "").toLowerCase() === "win";
  }

  function logRow(m) {
    var place = Number(m.place || 0);
    var win = isWin(m);
    return {
      badge: win
        ? '<i class="fa-solid fa-trophy" aria-hidden="true"></i> 1ST'
        : place
        ? placeLabel(place)
        : '<i class="fa-solid fa-xmark" aria-hidden="true"></i> LOST',
      cls: win ? "is-win" : "is-loss",
      meta: [S.formatLogDate(m.timestamp), S.difficultyLabel(m.difficulty), m.subject_name || ""],
      score: m.climbed_m != null ? Number(m.climbed_m) + " M" : "",
    };
  }

  function logDetail(m) {
    var place = Number(m.place || 0);
    return {
      title: isWin(m) ? "PANALO!" : place ? placeLabel(place) + " PLACE" : "YOU LOST",
      cls: isWin(m) ? "is-win" : "is-loss",
      chips: [
        S.formatLogDate(m.timestamp),
        S.difficultyLabel(m.difficulty),
        m.match_score || "",
        m.climbed_m != null ? Number(m.climbed_m) + " M CLIMBED" : "",
        m.exp_gained != null ? "+" + Number(m.exp_gained) + " EXP" : "",
        Number(m.correct_answers || 0) + " CORRECT",
      ],
    };
  }

  function difficultyNote(key) {
    var seconds = QUESTION_SECONDS[key] || QUESTION_SECONDS.normal;
    return seconds + " seconds per question · the bots are right " + Math.round((BOT_ACCURACY[key] || 0.55) * 100) + "% of the time";
  }

  var SETUP_HTML =
    '<div class="wc-setup">' +
    '<p class="wc-setup-label">RIVALS</p>' +
    '<p class="wc-setup-note">You race KUYA, ATE and BUNSO up the greasy poles.</p>' +
    "</div>";

  function setup() {
    quiz = Q.create({
      host: $("pb-quiz"),
      keepSpace: true, // the poles don't jump between questions
      isPaused: function () {
        return !!match && match.paused;
      },
    });
    shell = S.create({
      id: GAME_ID,
      name: "Palosebo",
      eventType: "game",
      title: ["LARONG PINOY", "PALOSEBO"],
      tagline: "Answer right to climb. First to the prize wins!",
      logTitle: "RACE LOG",
      playLabel: "CLIMB!",
      loadingText: "Greasing the poles…",
      loadingTips: [
        { label: "ALAM MO BA?", text: "Palosebo is a fiesta game: players climb a greased bamboo pole to reach the prize at the top." },
        "The faster you answer right, the higher you climb.",
      ],
      playScreenId: "pb-play-screen",
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
        $("pb-pause-btn")?.focus({ preventScroll: true });
      },
      canRestart: function () {
        return !!match && match.started;
      },
      onRestart: restartMatch,
      quitMessage: function () {
        return match && match.started ? "This race won't be saved." : "You'll go back to the main menu.";
      },
      onLeave: function () {
        quiz.cancel();
        sound.stopAll();
        setWaiting(false);
        match = null;
      },
      onKeydown: function (e) {
        if (quiz.isOpen()) quiz.handleKey(e);
      },
      onCharacterChange: function () {
        S.renderCharacterInto($("pb-avatar"));
      },
    });

    makeMusic(RACE_SONG)
      .then(function (src) {
        if (src) sound.setSrc(raceMusic, src);
      })
      .catch(function (e) {
        console.warn("Palosebo music:", e);
      });

    $("pb-pause-btn")?.addEventListener("click", shell.openPause);
    $("pb-start-btn")?.addEventListener("click", onStartClick);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("pb-play-screen") || !window.ArcadeShell || !window.ArcadeQuiz) return;
    setup();
  });
})();
