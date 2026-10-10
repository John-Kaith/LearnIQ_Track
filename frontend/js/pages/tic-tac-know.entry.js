/**
 * Tic-Tac-Know (tic-tac-know.html) — an Arcade game: answer a question from the
 * lesson to claim a square; three in a row wins the round, best of 3.
 *
 * Play the bot (Normal / Medium / Hard: it answers right more often and plays
 * smarter). Questions come from the lesson's
 * shared question bank (the same one Word Clash uses) as multiple choice: the
 * answer plus three other answers from the lesson. A wrong answer leaves the
 * square open with a new question. The menus, results, Match Log, settings and
 * pause come from the shared Arcade shell (js/arcade/arcade-shell.js). Every
 * match is saved as a "game" learning event with the student's answers.
 *
 * Its own look and sound, so it doesn't feel like Word Clash: a classroom
 * chalkboard (css/tic-tac-know.css), its own words for the shell screens
 * (subjects and lessons) and its own chiptune music (js/arcade/chiptune.js).
 */
(function () {
  "use strict";

  var S = window.ArcadeShell;
  var esc = S.esc;
  var sound = S.sound;
  var shell = null; // ArcadeShell.create(...) for this page

  var GAME_ID = "tic-tac-know";
  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  var ROUNDS = 3;
  var ROUND_WINS_NEEDED = 2;
  var MAX_TURNS_PER_ROUND = 30; // a round where everyone keeps missing ends in a draw
  var MAX_LOGGED_ANSWERS = 60;
  var QUESTION_SECONDS = { normal: 20, medium: 15, hard: 10 };
  var BOT_ACCURACY = { normal: 0.6, medium: 0.75, hard: 0.9 };
  var CHOICE_KEYS = ["A", "B", "C", "D"];

  var match = null;

  /*
   * Music, made in the browser: a bouncy loop for the menus and a calmer one
   * while a match is played. Both use C - Am - F - G - C - Am - Dm - G.
   */
  var CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [38, 41, 45], [43, 47, 50]];
  var MENU_SONG = {
    bpm: 112,
    chords: CHORDS,
    melody: [
      [0, 76, 2], [2, 79, 2], [4, 76, 1], [5, 74, 1], [6, 72, 2],
      [8, 69, 2], [10, 72, 2], [12, 76, 4],
      [16, 77, 2], [18, 76, 1], [19, 74, 1], [20, 72, 2], [22, 69, 2],
      [24, 71, 2], [26, 74, 2], [28, 79, 4],
      [32, 76, 2], [34, 79, 2], [36, 84, 2], [38, 79, 2],
      [40, 81, 2], [42, 79, 1], [43, 76, 1], [44, 72, 4],
      [48, 74, 2], [50, 77, 2], [52, 81, 2], [54, 77, 2],
      [56, 79, 2], [58, 77, 1], [59, 76, 1], [60, 74, 4],
    ],
    lead: { wave: "pulse", gain: 0.075 },
    arp: { wave: "square", gain: 0.035, pattern: [0, 1, 2, 1, 0, 1, 2, 1] },
    bass: { wave: "triangle", gain: 0.22, steps: [0, 2, 4, 6], fifthOn: [2, 6] },
    kick: [0, 4],
    kickGain: 0.32,
    snare: [2, 6],
    snareGain: 0.08,
    hat: [1, 3, 5, 7],
    hatGain: 0.035,
  };
  var MATCH_SONG = {
    bpm: 100,
    chords: CHORDS,
    melody: [
      [0, 72, 3], [4, 76, 2], [6, 79, 2],
      [8, 81, 4], [12, 79, 2], [14, 76, 2],
      [16, 77, 3], [20, 81, 2], [22, 84, 2],
      [24, 83, 4], [28, 79, 4],
      [32, 76, 2], [34, 74, 2], [36, 72, 4],
      [40, 69, 2], [42, 72, 2], [44, 76, 4],
      [48, 74, 3], [52, 77, 2], [54, 81, 2],
      [56, 79, 6], [62, 74, 2],
    ],
    lead: { wave: "pulse", gain: 0.05 },
    arp: { wave: "triangle", gain: 0.06, pattern: [0, 2, 1, 2, 0, 2, 1, 2] },
    bass: { wave: "triangle", gain: 0.2, steps: [0, 4], fifthOn: [4] },
    kick: [0],
    kickGain: 0.22,
    hat: [2, 6],
    hatGain: 0.025,
  };

  function makeMusic(song) {
    return window.ArcadeChiptune ? window.ArcadeChiptune.render(song) : Promise.resolve(null);
  }

  var matchMusic = sound.createTrack(null, true, "music"); // filled in by makeMusic(MATCH_SONG)
  var gameOverSound = sound.createTrack("audio/gameover.mp3", false, "sfx");
  var sfxCorrect = sound.createTrack("audio/correct%20answer.mp3", false);
  var sfxWrong = sound.createTrack("audio/wrong.mp3", false);

  function $(id) {
    return document.getElementById(id);
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
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

  /* ----------------------------------------------------------
   * Players
   * ---------------------------------------------------------- */
  function nameOf(mark) {
    return mark === "x" ? "YOU" : "BOT";
  }

  /** The student plays X; the bot plays O. */
  function isHumanTurn() {
    return !!match && match.turn === "x";
  }

  function canPickSquare() {
    return !!match && match.started && !match.ended && !match.busy && !match.paused && isHumanTurn();
  }

  /* ----------------------------------------------------------
   * Questions: the lesson's shared bank, unseen first (shell), then reshuffled
   * ---------------------------------------------------------- */
  function nextQuestion() {
    if (!match.queue.length) match.queue = S.shuffle(match.bank);
    return match.queue.shift();
  }

  /** The answer plus three other answers from the same lesson, shuffled. */
  function choicesFor(question) {
    var others = [];
    S.shuffle(match.bank).forEach(function (q) {
      if (q.answer !== question.answer && others.indexOf(q.answer) === -1 && others.length < 3) others.push(q.answer);
    });
    return S.shuffle([question.answer].concat(others));
  }

  /* ----------------------------------------------------------
   * Board rules + bot
   * ---------------------------------------------------------- */
  function winningLine(board, mark) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      if (board[l[0]] === mark && board[l[1]] === mark && board[l[2]] === mark) return l;
    }
    return null;
  }

  function emptyCells(board) {
    var out = [];
    board.forEach(function (v, i) {
      if (!v) out.push(i);
    });
    return out;
  }

  /** A square that completes three in a row for `mark`, or -1. */
  function finishingMove(board, mark) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      var marks = l.filter(function (c) {
        return board[c] === mark;
      }).length;
      var open = l.filter(function (c) {
        return !board[c];
      });
      if (marks === 2 && open.length === 1) return open[0];
    }
    return -1;
  }

  function minimax(board, botTurn, depth) {
    if (winningLine(board, "o")) return 10 - depth;
    if (winningLine(board, "x")) return depth - 10;
    var empty = emptyCells(board);
    if (!empty.length) return 0;
    var best = botTurn ? -Infinity : Infinity;
    empty.forEach(function (i) {
      board[i] = botTurn ? "o" : "x";
      var score = minimax(board, !botTurn, depth + 1);
      board[i] = null;
      best = botTurn ? Math.max(best, score) : Math.min(best, score);
    });
    return best;
  }

  /** Normal: any open square. Medium: wins, blocks, centre, corners. Hard: best possible move. */
  function botPickSquare() {
    var board = match.board.slice();
    var empty = emptyCells(board);
    if (match.difficulty === "hard") {
      if (empty.length === 9) return 4;
      var best = -Infinity;
      var moves = [];
      empty.forEach(function (i) {
        board[i] = "o";
        var score = minimax(board, false, 0);
        board[i] = null;
        if (score > best) {
          best = score;
          moves = [i];
        } else if (score === best) {
          moves.push(i);
        }
      });
      return pickRandom(moves);
    }
    if (match.difficulty === "medium") {
      var win = finishingMove(board, "o");
      if (win >= 0) return win;
      var block = finishingMove(board, "x");
      if (block >= 0) return block;
      if (!board[4]) return 4;
      var corners = [0, 2, 6, 8].filter(function (i) {
        return !board[i];
      });
      if (corners.length) return pickRandom(corners);
    }
    return pickRandom(empty);
  }

  /* ----------------------------------------------------------
   * Rendering
   * ---------------------------------------------------------- */
  function setStatus(text) {
    var el = $("ttk-status");
    if (el) el.textContent = text || "";
  }

  function renderAvatars() {
    S.renderCharacterInto($("ttk-avatar-x"));
    var o = $("ttk-avatar-o");
    if (o) o.textContent = "🤖";
  }

  /** Rounds won, as chalk tally marks. */
  function renderScore(id, rounds) {
    var el = $(id);
    if (!el) return;
    el.innerHTML = new Array(rounds + 1).join('<i class="ttk-tally"></i>');
    el.setAttribute("aria-label", rounds + (rounds === 1 ? " round won" : " rounds won"));
  }

  function renderScoreboard() {
    if (!match) return;
    $("ttk-name-x").textContent = nameOf("x");
    $("ttk-name-o").textContent = nameOf("o");
    renderScore("ttk-score-x", match.scores.x);
    renderScore("ttk-score-o", match.scores.o);
    var live = match.started && !match.ended;
    $("ttk-player-x").classList.toggle("is-turn", live && match.turn === "x");
    $("ttk-player-o").classList.toggle("is-turn", live && match.turn === "o");
    $("ttk-round").textContent = "ROUND " + match.round + " OF " + ROUNDS;
  }

  function renderBoard() {
    var pickable = canPickSquare();
    document.querySelectorAll("#ttk-board .ttk-cell").forEach(function (btn) {
      var i = Number(btn.getAttribute("data-cell"));
      var mark = match ? match.board[i] : null;
      btn.textContent = mark ? mark.toUpperCase() : "";
      btn.classList.toggle("is-x", mark === "x");
      btn.classList.toggle("is-o", mark === "o");
      btn.classList.toggle("is-open", !mark);
      btn.disabled = !!mark || !pickable;
      btn.setAttribute("aria-label", "Square " + (i + 1) + ": " + (mark ? mark.toUpperCase() : "open"));
    });
  }

  function flashCell(index, cls) {
    var btn = document.querySelector('#ttk-board .ttk-cell[data-cell="' + index + '"]');
    if (!btn) return;
    btn.classList.remove(cls);
    void btn.offsetWidth;
    btn.classList.add(cls);
    setTimeout(function () {
      btn.classList.remove(cls);
    }, 600);
  }

  function setWaiting(waiting) {
    $("ttk-play-screen")?.classList.toggle("is-waiting", waiting);
    var ready = $("ttk-ready");
    if (ready) ready.hidden = !waiting;
    if (waiting) $("ttk-start-btn")?.focus({ preventScroll: true });
  }

  function showBanner(text, cls) {
    var el = $("ttk-banner");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ttk-banner" + (cls ? " " + cls : "");
    el.hidden = !text;
  }

  function clearWinHighlight() {
    document.querySelectorAll("#ttk-board .ttk-cell.is-win").forEach(function (c) {
      c.classList.remove("is-win");
    });
    var strike = $("ttk-strike");
    if (strike) strike.hidden = true;
  }

  /** Draws the chalk line through three in a row (data-line = its index in LINES). */
  function showWinLine(line, mark) {
    (line || []).forEach(function (i) {
      document.querySelector('#ttk-board .ttk-cell[data-cell="' + i + '"]')?.classList.add("is-win");
    });
    var strike = $("ttk-strike");
    var index = LINES.indexOf(line);
    if (!strike || index === -1) return;
    strike.setAttribute("data-line", String(index));
    strike.className = "ttk-strike is-" + mark;
    strike.hidden = false;
  }

  /* ----------------------------------------------------------
   * The question card
   * ---------------------------------------------------------- */
  function stopQuestionTimer() {
    if (match && match.qTimer) clearInterval(match.qTimer);
    if (match) match.qTimer = null;
  }

  function renderQuestionTimer() {
    if (!match) return;
    var left = Math.max(0, match.qTimeLeft);
    $("ttk-q-time").textContent = S.formatClock(left);
    var fill = $("ttk-q-bar-fill");
    if (fill) {
      fill.style.width = Math.round((left / match.qTotal) * 100) + "%";
      fill.classList.toggle("is-low", left <= 3);
    }
  }

  function startQuestionTimer(seconds, onTimeout) {
    stopQuestionTimer();
    match.qTotal = seconds;
    match.qTimeLeft = seconds;
    var last = Date.now();
    renderQuestionTimer();
    match.qTimer = setInterval(function () {
      if (!match) return;
      var now = Date.now();
      var dt = (now - last) / 1000;
      last = now;
      if (match.paused) return;
      match.qTimeLeft -= dt;
      renderQuestionTimer();
      if (match.qTimeLeft <= 0) {
        stopQuestionTimer();
        onTimeout();
      }
    }, 250);
  }

  function closeCard() {
    stopQuestionTimer();
    var card = $("ttk-question");
    if (card) card.hidden = true;
    if (match) {
      match.card = null;
      match.cardContinue = null;
    }
  }

  /** Waits for "tap to continue" (or Enter), or `ms` of unpaused time. */
  function waitForContinue(ms, token) {
    $("ttk-q-continue").hidden = false;
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (ok) {
        if (done) return;
        done = true;
        if (match) match.cardContinue = null;
        resolve(ok);
      };
      // A short delay so the tap that answered doesn't also skip the feedback.
      setTimeout(function () {
        if (!done && match && match.token === token) match.cardContinue = finish.bind(null, true);
      }, 350);
      void wait(ms, token).then(finish);
    });
  }

  function feedbackHtml(correct, picked, q, isBot) {
    var head;
    if (correct) {
      head = isBot ? "BOT GOT IT." : "CORRECT!";
      return "<strong>" + head + "</strong> " + (isBot ? "The bot takes the square." : "The square is yours.");
    }
    head = isBot ? "BOT MISSED." : picked ? "WRONG." : "TIME'S UP.";
    return (
      "<strong>" + head + "</strong> The answer is <b>" + esc(q.answer.toUpperCase()) + "</b>." +
      (q.meaning ? ' <span class="ttk-q-meaning">' + esc(q.meaning) + "</span>" : "")
    );
  }

  /**
   * Shows the square's question and resolves { correct, picked } once the answer
   * (or the bot's answer) has been shown, or null if the match was left / restarted.
   */
  function askQuestion(cell, mark, q, choices, isBot) {
    var token = match.token;
    return new Promise(function (resolve) {
      var panel = document.querySelector("#ttk-question .ttk-q-panel");
      panel?.classList.toggle("is-o", mark === "o");
      $("ttk-q-label").textContent = "SQUARE " + (cell + 1) + " · " + nameOf(mark);
      $("ttk-q-text").textContent = q.question;
      $("ttk-q-feedback").hidden = true;
      $("ttk-q-continue").hidden = true;
      $("ttk-choices").innerHTML = choices
        .map(function (c, i) {
          return (
            '<button type="button" class="ttk-choice" data-choice="' + i + '"' + (isBot ? " disabled" : "") + ">" +
            '<span class="ttk-choice-key">' + CHOICE_KEYS[i] + "</span>" +
            "<span>" + esc(c.toUpperCase()) + "</span></button>"
          );
        })
        .join("");
      var bar = document.querySelector("#ttk-question .ttk-q-bar");
      if (bar) bar.hidden = isBot;
      $("ttk-q-time").textContent = isBot ? "BOT'S TURN" : "";
      $("ttk-question").hidden = false;

      var card = { choices: choices, isBot: isBot, answered: false };
      match.card = card;

      function reveal(picked) {
        document.querySelectorAll("#ttk-choices .ttk-choice").forEach(function (btn) {
          var word = choices[Number(btn.getAttribute("data-choice"))];
          btn.disabled = true;
          btn.classList.toggle("is-correct", word === q.answer);
          btn.classList.toggle("is-wrong", !!picked && word === picked && word !== q.answer);
        });
      }

      card.finish = function (picked) {
        if (card.answered || !match || match.token !== token) return;
        card.answered = true;
        stopQuestionTimer();
        var correct = picked === q.answer;
        reveal(picked);
        var fb = $("ttk-q-feedback");
        fb.className = "ttk-q-feedback " + (correct ? "is-correct" : "is-wrong");
        fb.innerHTML = feedbackHtml(correct, picked, q, isBot);
        fb.hidden = false;
        sound.play(correct ? sfxCorrect : sfxWrong);
        void waitForContinue(correct ? 1300 : 2600, token).then(function (ok) {
          if (!ok) {
            resolve(null);
            return;
          }
          closeCard();
          resolve({ correct: correct, picked: picked });
        });
      };

      if (isBot) {
        // The bot "reads" the question, then answers: right as often as its level allows.
        void wait(1000, token).then(function (ok) {
          if (!ok) return resolve(null);
          var right = Math.random() < (BOT_ACCURACY[match.difficulty] || BOT_ACCURACY.normal);
          var wrong = choices.filter(function (c) {
            return c !== q.answer;
          });
          var pick = right || !wrong.length ? q.answer : pickRandom(wrong);
          var btn = $("ttk-choices").querySelector('[data-choice="' + choices.indexOf(pick) + '"]');
          btn?.classList.add("is-picked");
          void wait(450, token).then(function (ok2) {
            if (!ok2) return resolve(null);
            card.finish(pick);
          });
        });
      } else {
        startQuestionTimer(QUESTION_SECONDS[match.difficulty] || QUESTION_SECONDS.normal, function () {
          card.finish(null); // time's up
        });
        $("ttk-choices").querySelector(".ttk-choice")?.focus({ preventScroll: true });
      }
    });
  }

  /* ----------------------------------------------------------
   * Turns, rounds, match
   * ---------------------------------------------------------- */
  function logStudentAnswer(q, result) {
    if (result.correct) match.correctX += 1;
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

  async function playSquare(cell, mark, isBot) {
    var token = match.token;
    match.busy = true;
    renderBoard();
    var q = match.cellQuestions[cell];
    match.shown.push(q.answer);
    var result = await askQuestion(cell, mark, q, choicesFor(q), isBot);
    if (!result || !match || match.token !== token) return;

    if (mark === "x") logStudentAnswer(q, result);
    if (result.correct) {
      match.board[cell] = mark;
      sound.tone(mark === "x" ? 660 : 440, 0.08, "square");
    } else {
      match.cellQuestions[cell] = nextQuestion(); // the answer was shown, so the square gets a new one
      sound.tone(200, 0.12, "square");
    }
    match.turnsThisRound += 1;
    match.busy = false;
    renderBoard();
    flashCell(cell, result.correct ? "is-claimed" : "is-missed");

    var line = winningLine(match.board, mark);
    if (line) return endRound(mark, line);
    if (!emptyCells(match.board).length || match.turnsThisRound >= MAX_TURNS_PER_ROUND) return endRound(null, null);
    match.turn = mark === "x" ? "o" : "x";
    void nextTurn();
  }

  async function nextTurn() {
    if (!match || match.ended) return;
    var token = match.token;
    renderScoreboard();
    renderBoard();
    if (isHumanTurn()) {
      setStatus("YOUR TURN — PICK A SQUARE");
      return; // waits for a square to be clicked
    }
    match.busy = true;
    renderBoard();
    setStatus("BOT IS THINKING…");
    if (!(await wait(550, token))) return;
    void playSquare(botPickSquare(), "o", true);
  }

  function startRound(starter) {
    match.board = [null, null, null, null, null, null, null, null, null];
    match.cellQuestions = match.board.map(nextQuestion);
    match.turn = starter;
    match.turnsThisRound = 0;
    match.busy = false;
    clearWinHighlight();
    showBanner("");
    renderScoreboard();
    renderBoard();
    void nextTurn();
  }

  async function endRound(winner, line) {
    var token = match.token;
    match.busy = true;
    if (winner) match.scores[winner] += 1;
    renderScoreboard();
    renderBoard();
    if (winner) showWinLine(line, winner);
    var text;
    var cls;
    if (!winner) {
      text = "DRAW ROUND";
      cls = "is-draw";
      sound.tone(440, 0.1, "square");
    } else if (winner === "x") {
      text = "YOU WIN THE ROUND!";
      cls = "is-win";
      sound.victory();
    } else {
      text = "BOT WINS THE ROUND";
      cls = "is-loss";
      sound.tone(220, 0.2, "square");
    }
    showBanner(text, cls);
    setStatus("");
    if (!(await wait(2200, token))) return;
    showBanner("");
    var over =
      match.scores.x >= ROUND_WINS_NEEDED || match.scores.o >= ROUND_WINS_NEEDED || match.round >= ROUNDS;
    if (over) return endMatch();
    match.round += 1;
    startRound(match.round % 2 === 1 ? "x" : "o"); // who starts alternates: X, O, X
  }

  function matchOutcome() {
    if (match.scores.x > match.scores.o) return "win";
    if (match.scores.x < match.scores.o) return "lose";
    return "draw";
  }

  /** EXP and Arcade level after this match (server numbers refresh right after saving). */
  function computeProgress(outcome) {
    var st = shell.arcadeStats() || {};
    var perLevel = Number(st.exp_per_level || S.EXP_PER_LEVEL) || S.EXP_PER_LEVEL;
    var before = Number(st.total_exp || 0);
    var exp = S.gameExpForResult(outcome, match.correctX);
    var after = before + exp;
    return {
      exp: exp,
      score: match.scores.x + "-" + match.scores.o,
      correct: match.correctX,
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
      stat("Score", p.score) +
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
    closeCard();
    sound.stop(matchMusic);
    var outcome = matchOutcome();
    if (outcome === "win") sound.victory();
    else if (outcome === "lose") sound.play(gameOverSound);
    else sound.tone(523, 0.15, "square");
    var progress = computeProgress(outcome);
    shell.saveResult({
      lesson_id: match.lessonId,
      outcome: outcome,
      difficulty: match.difficulty,
      opponent: "bot",
      match_score: progress.score,
      rounds_won: match.scores.x,
      rounds_lost: match.scores.o,
      correct_answers: match.correctX,
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
    renderScoreboard();
    var ended = match;
    setTimeout(function () {
      if (match === ended) showMatchResults(outcome, progress);
    }, 900);
  }

  function showMatchResults(outcome, progress) {
    var x = match.scores.x;
    var o = match.scores.o;
    var title = outcome === "win" ? "YOU WIN!" : outcome === "lose" ? "YOU LOSE" : "DRAW!";
    var sub =
      outcome === "win"
        ? "You beat the Bot " + x + "-" + o + ". "
        : outcome === "lose"
        ? "The Bot won " + o + "-" + x + ". "
        : "It's a tie, " + x + "-" + o + ". ";
    sub += match.correctX + " correct answer" + (match.correctX === 1 ? "" : "s") + ".";
    shell.showResults({
      outcome: outcome,
      title: title,
      sub: sub,
      progressHtml: progressHtml(progress),
      answers: match.answerLog,
      againLabel: outcome === "win" ? "PLAY AGAIN" : "REMATCH",
    });
  }

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
      round: 1,
      scores: { x: 0, o: 0 },
      board: [null, null, null, null, null, null, null, null, null],
      cellQuestions: [],
      turn: "x",
      turnsThisRound: 0,
      answerLog: [],
      correctX: 0,
      started: false,
      ended: false,
      paused: false,
      busy: false,
      card: null,
      cardContinue: null,
      qTimer: null,
    };
  }

  function showFreshMatch() {
    showBanner("");
    clearWinHighlight();
    closeCard();
    renderAvatars();
    renderScoreboard();
    renderBoard();
    setStatus("");
    shell.showPlayScreen();
    setWaiting(true);
  }

  /* ----------------------------------------------------------
   * Shell hooks
   * ---------------------------------------------------------- */
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
    sound.play(matchMusic);
    startRound("x");
  }

  /** Same lesson, a fresh pick of questions, back on the Ready screen. */
  function restartMatch() {
    if (!match) return;
    var old = match;
    closeCard();
    match = newMatch(old.lessonId, old.difficulty, old.bank, shell.pickQuestions(old.bank, old.lessonId, old.bank.length));
    sound.stopAll();
    sound.playIntro();
    showFreshMatch();
  }

  /** Results → PLAY AGAIN / REMATCH: the bank may have grown since the match started. */
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

  function onCellClick(e) {
    var btn = e.target.closest(".ttk-cell[data-cell]");
    if (!btn || !canPickSquare()) return;
    var cell = Number(btn.getAttribute("data-cell"));
    if (match.board[cell]) return;
    sound.click();
    void playSquare(cell, "x", false);
  }

  function onChoiceClick(e) {
    var btn = e.target.closest(".ttk-choice[data-choice]");
    var card = match && match.card;
    if (!btn || btn.disabled || !card || card.isBot || card.answered || match.paused) return;
    btn.classList.add("is-picked");
    card.finish(card.choices[Number(btn.getAttribute("data-choice"))]);
  }

  function onCardClick(e) {
    if (e.target.closest(".ttk-choice")) return;
    if (match && match.cardContinue) match.cardContinue();
  }

  /** Keys on the play screen: A–D / 1–4 answer, Enter continues, arrows move around the board. */
  function onKeydown(e) {
    if (!match) return;
    var card = $("ttk-question");
    if (card && !card.hidden) {
      if (match.cardContinue && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        match.cardContinue();
        return;
      }
      var idx = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[String(e.key).toLowerCase()];
      if (idx !== undefined) {
        var btn = $("ttk-choices").querySelector('[data-choice="' + idx + '"]');
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
      }
      return;
    }
    var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    if (!(e.key in moves)) return;
    var current = document.activeElement && document.activeElement.closest && document.activeElement.closest(".ttk-cell[data-cell]");
    var from = current ? Number(current.getAttribute("data-cell")) : 4;
    var to = from + moves[e.key];
    if ((e.key === "ArrowLeft" && from % 3 === 0) || (e.key === "ArrowRight" && from % 3 === 2) || to < 0 || to > 8) return;
    e.preventDefault();
    document.querySelector('#ttk-board .ttk-cell[data-cell="' + to + '"]')?.focus();
  }

  function isWin(m) {
    return String((m && m.outcome) || "").toLowerCase() === "win";
  }

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
      meta: [
        S.formatLogDate(m.timestamp),
        S.difficultyLabel(m.difficulty),
        m.opponent === "bot" ? "VS BOT" : "",
        m.subject_name || "",
      ],
      score: m.match_score || "",
    };
  }

  function logDetail(m) {
    var o = outcomeOf(m);
    return {
      title: o === "win" ? "YOU WON" : o === "draw" ? "DRAW" : "YOU LOST",
      cls: o === "win" ? "is-win" : o === "draw" ? "" : "is-loss",
      chips: [
        S.formatLogDate(m.timestamp),
        S.difficultyLabel(m.difficulty),
        m.opponent === "bot" ? "VS BOT" : "",
        m.match_score ? "SCORE " + m.match_score : "",
        m.exp_gained != null ? "+" + Number(m.exp_gained) + " EXP" : "",
        Number(m.correct_answers || 0) + " CORRECT",
      ],
    };
  }

  function difficultyNote(key) {
    var seconds = QUESTION_SECONDS[key] || QUESTION_SECONDS.normal;
    return seconds + " seconds per question · the bot is right " + Math.round((BOT_ACCURACY[key] || 0.6) * 100) + "% of the time";
  }

  function setup() {
    shell = S.create({
      id: GAME_ID,
      name: "Tic-Tac-Know",
      eventType: "game",
      title: ["TIC-TAC", "KNOW"],
      tagline: "Answer to claim the square. Three in a row wins.",
      logTitle: "MATCH LOG",
      playLabel: "PLAY!",
      loadingText: "Setting up the board…",
      loadingTips: [
        "Answer right to claim the square. Three in a row wins!",
        "The middle square is part of four lines, more than any other square.",
        "On Medium and Hard, the bot answers right more often and picks smarter squares.",
      ],
      playScreenId: "ttk-play-screen",
      menuMusic: function () {
        return makeMusic(MENU_SONG);
      },
      // A classroom game: subjects and lessons, not worlds and stages.
      words: {
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
        $("ttk-pause-btn")?.focus({ preventScroll: true });
      },
      canRestart: function () {
        return !!match && match.started;
      },
      onRestart: restartMatch,
      quitMessage: function () {
        return match && match.started ? "This match won't be saved." : "You'll go back to the main menu.";
      },
      onLeave: function () {
        closeCard();
        sound.stopAll();
        setWaiting(false);
        match = null;
      },
      onKeydown: onKeydown,
      onCharacterChange: function (seed) {
        S.renderCharacterInto($("ttk-avatar-x"), seed);
      },
    });

    makeMusic(MATCH_SONG)
      .then(function (src) {
        if (src) sound.setSrc(matchMusic, src);
      })
      .catch(function (e) {
        console.warn("Tic-Tac-Know match music:", e);
      });

    $("ttk-pause-btn")?.addEventListener("click", shell.openPause);
    $("ttk-board")?.addEventListener("click", onCellClick);
    $("ttk-start-btn")?.addEventListener("click", onStartClick);
    $("ttk-choices")?.addEventListener("click", onChoiceClick);
    $("ttk-question")?.addEventListener("click", onCardClick);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("ttk-play-screen") || !window.ArcadeShell) return;
    setup();
  });
})();
