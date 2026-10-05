/**
 * Tumbang Preso (tumbang-preso.html) — Larong Pinoy: knock down the can with your tsinelas.
 *
 * 8 rounds against the bot. Each round you answer a question from the lesson:
 * right = one throw. A throw is aimed with a moving arrow: stop it in the green
 * to knock the can down (TUMBA!), in the yellow for a lucky chance, anywhere else
 * misses. Then the bot answers and throws. Most knock-downs wins; same = draw.
 * The bot answers right more often, throws better and the green is smaller on
 * Medium and Hard. Menus, results, log, settings and pause: the Arcade shell.
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

  var GAME_ID = "tumbang-preso";
  var ROUNDS = 8;
  var QUESTION_SECONDS = { normal: 20, medium: 15, hard: 10 };
  var BOT_ACCURACY = { normal: 0.6, medium: 0.75, hard: 0.9 };
  var BOT_HIT = { normal: 0.4, medium: 0.55, hard: 0.7 };
  var HIT_WIDTH = { normal: 20, medium: 15, hard: 11 }; // % of the meter
  var NEAR_EXTRA = 9; // yellow on each side of the green
  var NEAR_LUCK = 0.35; // chance that a yellow throw still knocks the can down
  var NEEDLE_SPEED = { normal: 85, medium: 110, hard: 135 }; // % of the meter per second
  var AIM_SECONDS = 8; // the throw goes by itself after this
  var MAX_LOGGED_ANSWERS = 60;
  var PLAYER_COLORS = { t: "#ffcf3f", p: "#1d4ed8" };

  /* A playful street tune, made in the browser (js/arcade/chiptune.js). */
  var C = [48, 52, 55];
  var F = [41, 45, 48];
  var G = [43, 47, 50];
  var AM = [45, 48, 52];
  var D7 = [38, 42, 45];
  var MENU_SONG = {
    bpm: 120,
    chords: [C, AM, F, G, C, AM, D7, G],
    melody: [
      [0, 76, 1], [1, 76, 1], [2, 79, 1], [3, 76, 1], [4, 72, 2], [6, 74, 2],
      [8, 76, 1], [9, 76, 1], [10, 79, 1], [11, 81, 1], [12, 79, 4],
      [16, 77, 1], [17, 77, 1], [18, 81, 1], [19, 77, 1], [20, 74, 2], [22, 72, 2],
      [24, 74, 2], [26, 76, 2], [28, 74, 4],
      [32, 76, 1], [33, 76, 1], [34, 79, 1], [35, 76, 1], [36, 72, 2], [38, 74, 2],
      [40, 76, 1], [41, 79, 1], [42, 84, 2], [44, 81, 4],
      [48, 78, 2], [50, 81, 2], [52, 78, 2], [54, 74, 2],
      [56, 79, 6],
    ],
    lead: { wave: "pulse", gain: 0.065 },
    bass: { wave: "triangle", gain: 0.22, steps: [0, 3, 4, 6], fifthOn: [3, 6] },
    kick: [0, 4],
    kickGain: 0.26,
    snare: [2, 6],
    snareGain: 0.07,
    hat: [1, 5],
    hatGain: 0.03,
  };
  var PLAY_SONG = {
    bpm: 108,
    chords: [C, F, C, G, AM, F, D7, G],
    melody: [
      [0, 72, 2], [2, 76, 2], [4, 79, 4],
      [8, 81, 2], [10, 79, 2], [12, 77, 4],
      [16, 76, 2], [18, 72, 2], [20, 76, 4],
      [24, 74, 8],
      [32, 72, 2], [34, 76, 2], [36, 79, 4],
      [40, 81, 2], [42, 84, 2], [44, 81, 4],
      [48, 78, 2], [50, 76, 2], [52, 74, 4],
      [56, 79, 8],
    ],
    lead: { wave: "pulse", gain: 0.05 },
    arp: { wave: "triangle", gain: 0.05, pattern: [0, 1, 2, 1, 0, 1, 2, 1] },
    bass: { wave: "triangle", gain: 0.2, steps: [0, 4], fifthOn: [4] },
    kick: [0, 4],
    kickGain: 0.2,
    hat: [2, 6],
    hatGain: 0.025,
  };

  function makeMusic(song) {
    return window.ArcadeChiptune ? window.ArcadeChiptune.render(song) : Promise.resolve(null);
  }

  var playMusic = sound.createTrack(null, true, "music");
  var match = null;

  function $(id) {
    return document.getElementById(id);
  }

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
      }, 40);
    });
  }

  function setStatus(text) {
    var el = $("tp-status");
    if (el) el.textContent = text || "";
  }

  var toastTimer = null;

  function showToast(text, cls, ms) {
    var el = $("tp-toast");
    if (!el) return;
    el.textContent = text;
    el.className = "sk-toast" + (cls ? " " + cls : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, ms || 1300);
  }

  function shout(text, cls) {
    var el = $("tp-shout");
    if (!el) return;
    el.textContent = text;
    el.className = "tp-shout is-shown" + (cls ? " " + cls : "");
    void el.offsetWidth;
    setTimeout(function () {
      if (el.textContent === text) el.className = "tp-shout";
    }, 1300);
  }

  /* ----------------------------------------------------------
   * Scene
   * ---------------------------------------------------------- */
  function drawScene() {
    $("tp-can").innerHTML = SP.sprite("can", null, { cls: "tp-art" });
    $("tp-taya").innerHTML = SP.sprite("kid", SP.KIDS[1], { cls: "tp-art" });
    $("tp-slipper").innerHTML = SP.sprite("slipper", null, { cls: "tp-art" });
    $("tp-landed").innerHTML = SP.sprite("slipper", null, { cls: "tp-art" });
    S.renderCharacterInto($("tp-avatar-x"));
    $("tp-avatar-o").innerHTML = SP.sprite("bot", null, { cls: "tp-art" });
  }

  function setThrower(player) {
    var el = $("tp-thrower");
    if (!el) return;
    el.innerHTML = player === "x" ? SP.sprite("kid", PLAYER_COLORS, { cls: "tp-art" }) : SP.sprite("bot", null, { cls: "tp-art" });
    el.classList.toggle("is-bot", player === "o");
    $("tp-player-x").classList.toggle("is-turn", player === "x");
    $("tp-player-o").classList.toggle("is-turn", player === "o");
  }

  function renderScores() {
    if (!match) return;
    ["x", "o"].forEach(function (p) {
      var n = match.knocks[p];
      $("tp-score-" + p).textContent = String(n);
      var cans = $("tp-cans-" + p);
      if (cans) {
        cans.innerHTML = new Array(n + 1).join('<i class="tp-mini-can"></i>');
        cans.setAttribute("aria-label", n + (n === 1 ? " knock-down" : " knock-downs"));
      }
    });
    $("tp-round").textContent = "ROUND " + Math.max(1, match.round) + " OF " + ROUNDS;
  }

  /** The tsinelas flies from the thrower to the can (or past it on a miss). */
  function fly(outcome) {
    return new Promise(function (resolve) {
      var scene = $("tp-scene");
      var flight = $("tp-flight");
      var thrower = $("tp-thrower");
      var can = $("tp-can");
      var landed = $("tp-landed");
      if (!scene || !flight || !thrower || !can) return resolve();
      var sr = scene.getBoundingClientRect();
      var tr = thrower.getBoundingClientRect();
      var cr = can.getBoundingClientRect();
      var x0 = tr.right - sr.left - tr.width * 0.2;
      var y0 = tr.top - sr.top + tr.height * 0.25;
      var x1 = cr.left - sr.left + cr.width * 0.5;
      var y1 = cr.top - sr.top + cr.height * 0.45;
      if (outcome !== "hit") {
        // short or long, and a little off to the side
        x1 += (Math.random() < 0.5 ? -1 : 1) * cr.width * (1.4 + Math.random());
        y1 += cr.height * 0.5;
      }
      flight.style.left = x0 + "px";
      flight.style.top = y0 + "px";
      flight.classList.add("is-flying");
      landed.classList.remove("is-shown");
      var dx = x1 - x0;
      var dy = y1 - y0;
      var arc = Math.max(40, sr.height * 0.28);
      var anim = flight.animate(
        [
          { transform: "translate(0px, 0px) rotate(0deg)", easing: "ease-out" },
          { transform: "translate(" + dx / 2 + "px, " + (dy / 2 - arc) + "px) rotate(400deg)", easing: "ease-in" },
          { transform: "translate(" + dx + "px, " + dy + "px) rotate(760deg)" },
        ],
        { duration: 650, fill: "forwards" }
      );
      sound.tone(440, 0.05, "triangle");
      anim.onfinish = function () {
        flight.classList.remove("is-flying");
        anim.cancel();
        if (outcome !== "hit") {
          landed.style.left = x1 + "px";
          landed.style.top = y1 + "px";
          landed.classList.add("is-shown");
        }
        resolve();
      };
    });
  }

  function knockCan() {
    var can = $("tp-can");
    if (!can) return;
    can.classList.remove("is-down");
    void can.offsetWidth;
    can.classList.add("is-down");
    sound.tone(988, 0.05, "square");
    sound.tone(659, 0.08, "square", 60);
    sound.tone(1319, 0.06, "square", 140);
  }

  function standCan() {
    $("tp-can")?.classList.remove("is-down");
    $("tp-landed")?.classList.remove("is-shown");
  }

  /* ----------------------------------------------------------
   * Aiming
   * ---------------------------------------------------------- */
  function aim(token) {
    return new Promise(function (resolve) {
      var width = HIT_WIDTH[match.difficulty] || HIT_WIDTH.normal;
      var center = 30 + Math.random() * 40;
      var hit = $("tp-hit");
      var near = $("tp-near");
      hit.style.left = center - width / 2 + "%";
      hit.style.width = width + "%";
      near.style.left = center - width / 2 - NEAR_EXTRA + "%";
      near.style.width = width + NEAR_EXTRA * 2 + "%";
      var needle = $("tp-needle");
      var speed = NEEDLE_SPEED[match.difficulty] || NEEDLE_SPEED.normal;
      var pos = 0;
      var dir = 1;
      var aimed = 0;
      var last = performance.now();
      var done = false;
      $("tp-aim").hidden = false;
      setStatus("STOP THE ARROW IN THE GREEN!");
      $("tp-throw-btn").disabled = false;
      $("tp-throw-btn").focus({ preventScroll: true });

      function finish() {
        if (done) return;
        done = true;
        match.throwNow = null;
        $("tp-throw-btn").disabled = true;
        var off = Math.abs(pos - center);
        var zone = off <= width / 2 ? "hit" : off <= width / 2 + NEAR_EXTRA ? "near" : "miss";
        setTimeout(function () {
          $("tp-aim").hidden = true;
        }, 350);
        resolve(zone);
      }

      match.throwNow = finish;
      function frame(now) {
        if (done) return;
        if (!match || match.token !== token) {
          done = true;
          resolve(null);
          return;
        }
        var dt = (now - last) / 1000;
        last = now;
        if (!match.paused) {
          aimed += dt;
          pos += dir * speed * dt;
          if (pos >= 100) {
            pos = 100;
            dir = -1;
          } else if (pos <= 0) {
            pos = 0;
            dir = 1;
          }
          needle.style.left = pos + "%";
          if (aimed >= AIM_SECONDS) {
            finish();
            return;
          }
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  /* ----------------------------------------------------------
   * Rounds
   * ---------------------------------------------------------- */
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

  async function throwAt(player, zone, token) {
    var lucky = zone === "near" && Math.random() < NEAR_LUCK;
    var hit = zone === "hit" || lucky;
    await fly(hit ? "hit" : "miss");
    if (!match || match.token !== token) return;
    if (hit) {
      knockCan();
      match.knocks[player] += 1;
      renderScores();
      shout(lucky ? "TUMBA! (SWERTE!)" : "TUMBA!", "is-good");
    } else {
      sound.tone(196, 0.15, "square");
      shout(zone === "near" || zone === "close" ? "MUNTIK NA!" : "SABLAY!", "is-bad");
    }
    await wait(1200, token);
    standCan();
  }

  async function playRound() {
    if (!match || match.ended) return;
    var token = match.token;
    match.round += 1;
    renderScores();

    // Your turn
    setThrower("x");
    var q = nextQuestion();
    match.shown.push(q.answer);
    setStatus("ANSWER RIGHT TO EARN A THROW");
    var res = await quiz.ask({
      label: "ROUND " + match.round + " · YOUR THROW",
      question: q.question,
      choices: Q.choicesFor(q, match.bank, 4),
      answer: q.answer,
      meaning: q.meaning,
      seconds: QUESTION_SECONDS[match.difficulty] || QUESTION_SECONDS.normal,
      continueMs: { correct: 900, wrong: 2400 },
    });
    if (!res || !match || match.token !== token) return;
    logAnswer(q, res);
    if (res.correct) {
      var zone = await aim(token);
      if (!zone || !match || match.token !== token) return;
      setStatus("");
      await throwAt("x", zone, token);
      if (!match || match.token !== token) return;
    } else {
      showToast("NO THROW THIS ROUND", "is-bad", 1200);
      if (!(await wait(1000, token))) return;
    }

    // The bot's turn
    setThrower("o");
    setStatus("BOT'S TURN");
    if (!(await wait(700, token))) return;
    var right = Math.random() < (BOT_ACCURACY[match.difficulty] || BOT_ACCURACY.normal);
    if (right) {
      showToast("BOT ANSWERED RIGHT: IT THROWS", "is-info", 1000);
      if (!(await wait(900, token))) return;
      var botHit = Math.random() < (BOT_HIT[match.difficulty] || BOT_HIT.normal);
      // "close": a near miss with no lucky chance (the bot's luck is already in BOT_HIT)
      await throwAt("o", botHit ? "hit" : Math.random() < 0.5 ? "close" : "miss", token);
      if (!match || match.token !== token) return;
    } else {
      showToast("BOT ANSWERED WRONG: NO THROW", "is-bad", 1100);
      if (!(await wait(1100, token))) return;
    }
    setStatus("");
    if (match.round >= ROUNDS) {
      endMatch();
      return;
    }
    void playRound();
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
      score: match.knocks.x + "-" + match.knocks.o,
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
      stat("Tumba", p.score) +
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
    sound.stop(playMusic);
    var x = match.knocks.x;
    var o = match.knocks.o;
    var outcome = x > o ? "win" : x < o ? "lose" : "draw";
    if (outcome === "win") sound.victory();
    else if (outcome === "lose") {
      sound.tone(392, 0.12, "square");
      sound.tone(311, 0.12, "square", 140);
      sound.tone(262, 0.25, "square", 280);
    } else sound.tone(523, 0.15, "square");
    var progress = computeProgress(outcome);
    shell.saveResult({
      lesson_id: match.lessonId,
      outcome: outcome,
      difficulty: match.difficulty,
      opponent: "bot",
      match_score: progress.score,
      knocks: x,
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
    setStatus("GAME OVER");
    var ended = match;
    setTimeout(function () {
      if (match !== ended) return;
      shell.showResults({
        outcome: outcome,
        title: outcome === "win" ? "PANALO!" : outcome === "draw" ? "TABLA!" : "TALO!",
        sub:
          "You knocked the can down " + x + " time" + (x === 1 ? "" : "s") + ", the bot " + o + ". " +
          match.correct + " correct answer" + (match.correct === 1 ? "" : "s") + ".",
        progressHtml: progressHtml(progress),
        answers: match.answerLog,
        againLabel: outcome === "win" ? "PLAY AGAIN" : "REMATCH",
      });
    }, 1200);
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
      round: 0,
      knocks: { x: 0, o: 0 },
      correct: 0,
      answerLog: [],
      throwNow: null,
      started: false,
      ended: false,
      paused: false,
    };
  }

  function setWaiting(waiting) {
    $("tp-play-screen")?.classList.toggle("is-waiting", waiting);
    var ready = $("tp-ready");
    if (ready) ready.hidden = !waiting;
    if (waiting) $("tp-start-btn")?.focus({ preventScroll: true });
  }

  function showFreshMatch() {
    quiz.cancel();
    drawScene();
    setThrower("x");
    standCan();
    $("tp-aim").hidden = true;
    renderScores();
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
    sound.play(playMusic);
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

  function onKeydown(e) {
    if (!match) return;
    if (quiz.isOpen()) {
      quiz.handleKey(e);
      return;
    }
    if (match.throwNow && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      match.throwNow();
    }
  }

  /* ----------------------------------------------------------
   * Match Log
   * ---------------------------------------------------------- */
  function outcomeOf(m) {
    var o = String((m && m.outcome) || "").toLowerCase();
    return o === "win" || o === "draw" ? o : "lose";
  }

  function logRow(m) {
    var o = outcomeOf(m);
    return {
      badge:
        o === "win"
          ? '<i class="fa-solid fa-check" aria-hidden="true"></i> WON'
          : o === "draw"
          ? '<i class="fa-solid fa-equals" aria-hidden="true"></i> DRAW'
          : '<i class="fa-solid fa-xmark" aria-hidden="true"></i> LOST',
      cls: o === "win" ? "is-win" : o === "draw" ? "is-draw" : "is-loss",
      meta: [S.formatLogDate(m.timestamp), S.difficultyLabel(m.difficulty), m.subject_name || ""],
      score: m.match_score || "",
    };
  }

  function logDetail(m) {
    var o = outcomeOf(m);
    return {
      title: o === "win" ? "PANALO!" : o === "draw" ? "TABLA!" : "TALO!",
      cls: o === "win" ? "is-win" : o === "draw" ? "" : "is-loss",
      chips: [
        S.formatLogDate(m.timestamp),
        S.difficultyLabel(m.difficulty),
        m.match_score ? "TUMBA " + m.match_score : "",
        m.exp_gained != null ? "+" + Number(m.exp_gained) + " EXP" : "",
        Number(m.correct_answers || 0) + " CORRECT",
      ],
    };
  }

  function difficultyNote(key) {
    var seconds = QUESTION_SECONDS[key] || QUESTION_SECONDS.normal;
    return (
      seconds + " seconds per question · " + (key === "hard" ? "small" : key === "medium" ? "medium" : "big") +
      " green · the bot is right " + Math.round((BOT_ACCURACY[key] || 0.6) * 100) + "% of the time"
    );
  }

  var SETUP_HTML =
    '<div class="wc-setup">' +
    '<p class="wc-setup-label">HOW TO WIN</p>' +
    '<p class="wc-setup-note">8 rounds against the bot. Most knock-downs wins.</p>' +
    "</div>";

  function isWin(m) {
    return outcomeOf(m) === "win";
  }

  function setup() {
    quiz = Q.create({
      host: $("tp-quiz"),
      isPaused: function () {
        return !!match && match.paused;
      },
    });
    shell = S.create({
      id: GAME_ID,
      name: "Tumbang Preso",
      eventType: "game",
      title: ["TUMBANG", "PRESO"],
      tagline: "Answer right, throw your tsinelas, knock the can down!",
      logTitle: "GAME LOG",
      playLabel: "PLAY!",
      loadingText: "Setting up the can…",
      playScreenId: "tp-play-screen",
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
        if (match.throwNow) $("tp-throw-btn")?.focus({ preventScroll: true });
        else $("tp-pause-btn")?.focus({ preventScroll: true });
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
        if (match) match.throwNow = null;
        match = null;
      },
      onKeydown: onKeydown,
      onCharacterChange: function () {
        S.renderCharacterInto($("tp-avatar-x"));
      },
    });

    makeMusic(PLAY_SONG)
      .then(function (src) {
        if (src) sound.setSrc(playMusic, src);
      })
      .catch(function (e) {
        console.warn("Tumbang Preso music:", e);
      });

    $("tp-pause-btn")?.addEventListener("click", shell.openPause);
    $("tp-start-btn")?.addEventListener("click", onStartClick);
    $("tp-throw-btn")?.addEventListener("click", function () {
      if (match && match.throwNow && !match.paused) match.throwNow();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("tp-play-screen") || !window.ArcadeShell || !window.ArcadeQuiz) return;
    setup();
  });
})();
