/**
 * Sungka (sungka.html) — Larong Pinoy: the Filipino shell board game.
 *
 * Each side has 7 bahay (holes) and an ulo (store) on the player's left. A move
 * picks up every shell in one of your bahay and drops them one by one,
 * clockwise, skipping the other player's ulo:
 *   - last shell in your ulo: you move again;
 *   - last shell in a bahay that had shells: pick them all up and keep dropping;
 *   - last shell in an empty bahay on your side: kain — take it and the shells
 *     across into your ulo; in an empty bahay on the other side: your turn ends.
 * The game ends when the player to move has no shells; most shells in the ulo wins.
 *
 * Learning: a question from the lesson before every move. Right: you pick the
 * bahay. Wrong: the game picks one at random. The bot (Normal / Medium / Hard)
 * answers right more often and plays smarter; or play a friend on this device.
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

  var GAME_ID = "sungka";
  var SHELLS = 5; // per bahay at the start (the full game uses 7; 5 keeps a match around 5 minutes)
  var X_STORE = 7; // the student's ulo (left end)
  var O_STORE = 15; // the opponent's ulo (right end)
  var X_PITS = [0, 1, 2, 3, 4, 5, 6]; // in dropping order: right to left along the bottom row
  var O_PITS = [8, 9, 10, 11, 12, 13, 14]; // left to right along the top row
  var MAX_MOVES = 120;
  var MAX_DROPS = 400; // safety for very long chains
  var STEP_MS = 150;
  var QUESTION_SECONDS = { normal: 20, medium: 15, hard: 10 };
  var BOT_ACCURACY = { normal: 0.6, medium: 0.75, hard: 0.9 };
  var OPPONENT_STORAGE_KEY = "learniq-sungka-opponent";
  var MAX_LOGGED_ANSWERS = 60;
  var SPOTS = [[50, 50], [34, 36], [66, 64], [64, 34], [36, 66], [50, 22], [50, 78], [22, 50], [78, 50]];

  /* Kulintang-style pentatonic music, made in the browser (js/arcade/chiptune.js). */
  var C = [48, 52, 55];
  var AM = [45, 48, 52];
  var F = [41, 45, 48];
  var G = [43, 47, 50];
  var MENU_SONG = {
    bpm: 100,
    chords: [C, AM, C, G, C, AM, F, G],
    melody: [
      [0, 72, 1], [1, 74, 1], [2, 76, 2], [4, 79, 2], [6, 81, 2],
      [8, 79, 1], [9, 76, 1], [10, 74, 2], [12, 72, 4],
      [16, 76, 1], [17, 79, 1], [18, 81, 2], [20, 84, 2], [22, 81, 2],
      [24, 79, 4], [28, 76, 4],
      [32, 72, 1], [33, 74, 1], [34, 76, 2], [36, 79, 2], [38, 76, 2],
      [40, 74, 2], [42, 72, 2], [44, 69, 4],
      [48, 72, 2], [50, 74, 2], [52, 76, 2], [54, 79, 2],
      [56, 76, 2], [58, 74, 2], [60, 72, 4],
    ],
    lead: { wave: "square", gain: 0.055 },
    bass: { wave: "triangle", gain: 0.2, steps: [0, 4], fifthOn: [4] },
    kick: [0, 3, 6],
    kickGain: 0.22,
    hat: [2, 5],
    hatGain: 0.03,
  };
  var PLAY_SONG = {
    bpm: 92,
    chords: [C, F, C, G, AM, F, C, G],
    melody: [
      [0, 76, 3], [4, 79, 2], [6, 81, 2],
      [8, 79, 4], [12, 76, 4],
      [16, 74, 3], [20, 76, 2], [22, 79, 2],
      [24, 76, 8],
      [32, 81, 3], [36, 79, 2], [38, 76, 2],
      [40, 74, 4], [44, 72, 4],
      [48, 74, 3], [52, 76, 2], [54, 74, 2],
      [56, 72, 8],
    ],
    lead: { wave: "square", gain: 0.045 },
    arp: { wave: "triangle", gain: 0.055, pattern: [0, 2, 1, 2, 0, 2, 1, 2] },
    bass: { wave: "triangle", gain: 0.18, steps: [0, 4], fifthOn: [4] },
    kick: [0],
    kickGain: 0.18,
    hat: [3, 7],
    hatGain: 0.02,
  };

  function makeMusic(song) {
    return window.ArcadeChiptune ? window.ArcadeChiptune.render(song) : Promise.resolve(null);
  }

  var playMusic = sound.createTrack(null, true, "music");

  var opponent = (function () {
    try {
      return localStorage.getItem(OPPONENT_STORAGE_KEY) === "friend" ? "friend" : "bot";
    } catch (e) {
      return "bot";
    }
  })();
  var match = null;

  function $(id) {
    return document.getElementById(id);
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
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
        if (!match.paused) left -= match.fast ? (now - last) * 8 : now - last;
        last = now;
        if (left <= 0) {
          clearInterval(id);
          resolve(true);
        }
      }, 25);
    });
  }

  /* ----------------------------------------------------------
   * Rules (pure: also used by the bot to look ahead)
   * ---------------------------------------------------------- */
  function storeOf(player) {
    return player === "x" ? X_STORE : O_STORE;
  }

  function pitsOf(player) {
    return player === "x" ? X_PITS : O_PITS;
  }

  function other(player) {
    return player === "x" ? "o" : "x";
  }

  function sideOf(pos) {
    return pos <= X_STORE ? "x" : "o";
  }

  function opposite(pos) {
    return 14 - pos;
  }

  function nextPos(pos, player) {
    var n = (pos + 1) % 16;
    if (n === storeOf(other(player))) n = (n + 1) % 16;
    return n;
  }

  function legalMoves(board, player) {
    return pitsOf(player).filter(function (p) {
      return board[p] > 0;
    });
  }

  /** Plays one move on a copy of the board; returns the new board and every step for the animation. */
  function simulateMove(board, pos, player) {
    var b = board.slice();
    var store = storeOf(player);
    var before = b[store];
    var steps = [];
    var hand = b[pos];
    var drops = 0;
    var extra = false;
    var captured = 0;
    var i = pos;
    b[pos] = 0;
    steps.push({ type: "pick", pos: pos, hand: hand });
    while (hand > 0) {
      if (drops >= MAX_DROPS) {
        b[store] += hand; // a never-ending chain: the shells in hand go to the ulo
        hand = 0;
        break;
      }
      i = nextPos(i, player);
      b[i] += 1;
      hand -= 1;
      drops += 1;
      steps.push({ type: "drop", pos: i, hand: hand });
      if (hand > 0) continue;
      if (i === store) {
        extra = true;
        break;
      }
      if (b[i] > 1) {
        hand = b[i];
        b[i] = 0;
        steps.push({ type: "pick", pos: i, hand: hand });
        continue;
      }
      if (sideOf(i) === player && b[opposite(i)] > 0) {
        captured = b[opposite(i)] + 1;
        steps.push({ type: "capture", pos: i, from: opposite(i), amount: captured });
        b[store] += captured;
        b[opposite(i)] = 0;
        b[i] = 0;
      }
    }
    return { board: b, steps: steps, extra: extra, captured: captured, gain: b[store] - before };
  }

  function moveValue(board, pos, player) {
    var r = simulateMove(board, pos, player);
    return r.gain + (r.extra ? 3 : 0);
  }

  function bestBy(moves, score) {
    var best = -Infinity;
    var picks = [];
    moves.forEach(function (m) {
      var v = score(m);
      if (v > best) {
        best = v;
        picks = [m];
      } else if (v === best) {
        picks.push(m);
      }
    });
    return pickRandom(picks);
  }

  /** Normal: another move or a kain if it sees one. Medium: the best single move. Hard: also thinks of the reply. */
  function botChoose(board, player, level) {
    var moves = legalMoves(board, player);
    if (level === "hard") {
      return bestBy(moves, function (m) {
        var r = simulateMove(board, m, player);
        var next = r.extra ? legalMoves(r.board, player) : legalMoves(r.board, other(player));
        if (!next.length) return r.gain;
        var follow = Math.max.apply(
          null,
          next.map(function (n) {
            return moveValue(r.board, n, r.extra ? player : other(player));
          })
        );
        return r.gain + (r.extra ? follow : -follow);
      });
    }
    if (level === "medium") {
      return bestBy(moves, function (m) {
        return moveValue(board, m, player);
      });
    }
    var extras = moves.filter(function (m) {
      return simulateMove(board, m, player).extra;
    });
    if (extras.length) return pickRandom(extras);
    var kain = moves.filter(function (m) {
      return simulateMove(board, m, player).captured > 0;
    });
    return kain.length ? pickRandom(kain) : pickRandom(moves);
  }

  /* ----------------------------------------------------------
   * Players
   * ---------------------------------------------------------- */
  function isFriendMatch() {
    return !!match && match.opponent === "friend";
  }

  function nameOf(player) {
    if (player === "x") {
      if (!isFriendMatch()) return "YOU";
      var first = String(S.playerName() || "").trim().split(/\s+/)[0] || "PLAYER 1";
      return first.toUpperCase().slice(0, 12);
    }
    return isFriendMatch() ? "PLAYER 2" : "BOT";
  }

  /* ----------------------------------------------------------
   * Board drawing
   * ---------------------------------------------------------- */
  // Desktop: ulo on each end, the opponent's row on top. Phones: the board turns upright.
  function cellOf(pos) {
    var col;
    var row;
    var span = false;
    if (pos === X_STORE) {
      col = 1;
      span = true;
    } else if (pos === O_STORE) {
      col = 9;
      span = true;
    } else if (pos >= 8) {
      col = pos - 6; // 8..14 -> columns 2..8
      row = 1;
    } else {
      col = 8 - pos; // 6..0 -> columns 2..8
      row = 2;
    }
    var desktop = { c: String(col), r: span ? "1 / 3" : String(row) };
    var phone = { c: span ? "1 / 3" : String(row), r: String(10 - col) };
    return { desktop: desktop, phone: phone };
  }

  var SHELL_SVG = null;

  function shellsHtml(n, max) {
    if (!SHELL_SVG) SHELL_SVG = SP.sprite("shell", null, { cls: "sg-shell-art" });
    var out = "";
    for (var k = 0; k < Math.min(n, max); k++) {
      var spot = SPOTS[k % SPOTS.length];
      var jitter = k >= SPOTS.length ? 6 : 0;
      out += '<span class="sg-shell" style="left:' + (spot[0] + jitter) + "%;top:" + (spot[1] - jitter) + '%">' + SHELL_SVG + "</span>";
    }
    return out;
  }

  function buildBoard() {
    var board = $("sg-board");
    if (!board) return;
    var html = "";
    for (var pos = 0; pos < 16; pos++) {
      var cell = cellOf(pos);
      var style =
        "--dc:" + cell.desktop.c + ";--dr:" + cell.desktop.r + ";--mc:" + cell.phone.c + ";--mr:" + cell.phone.r;
      if (pos === X_STORE || pos === O_STORE) {
        html +=
          '<div class="sg-store ' + (pos === X_STORE ? "is-x" : "is-o") + '" data-pos="' + pos + '" style="' + style + '">' +
          '<span class="sg-shells"></span><span class="sg-count"></span></div>';
      } else {
        html +=
          '<button type="button" class="sg-pit ' + (pos < X_STORE ? "is-x" : "is-o") + '" data-pos="' + pos + '" style="' + style + '" disabled>' +
          '<span class="sg-shells"></span><span class="sg-count"></span></button>';
      }
    }
    board.innerHTML = html;
  }

  function renderPit(pos) {
    var el = document.querySelector('#sg-board [data-pos="' + pos + '"]');
    if (!el || !match) return;
    var n = match.board[pos];
    var isStore = pos === X_STORE || pos === O_STORE;
    el.querySelector(".sg-shells").innerHTML = shellsHtml(n, isStore ? 9 : 7);
    el.querySelector(".sg-count").textContent = String(n);
    if (!isStore) {
      var pickable = !!match.picking && match.picking === sideOf(pos) && n > 0;
      el.disabled = !pickable;
      el.classList.toggle("is-pickable", pickable);
      el.setAttribute(
        "aria-label",
        (sideOf(pos) === "x" ? nameOf("x") : nameOf("o")) + " bahay " + (pitsOf(sideOf(pos)).indexOf(pos) + 1) + ": " + n + " shells"
      );
    } else {
      el.setAttribute("aria-label", nameOf(pos === X_STORE ? "x" : "o") + " ulo: " + n + " shells");
    }
  }

  function renderBoard() {
    for (var pos = 0; pos < 16; pos++) renderPit(pos);
    renderPlayers();
  }

  function renderPlayers() {
    if (!match) return;
    $("sg-name-x").textContent = nameOf("x");
    $("sg-name-o").textContent = nameOf("o");
    $("sg-score-x").textContent = String(match.board[X_STORE]);
    $("sg-score-o").textContent = String(match.board[O_STORE]);
    var live = match.started && !match.ended;
    $("sg-player-x").classList.toggle("is-turn", live && match.turn === "x");
    $("sg-player-o").classList.toggle("is-turn", live && match.turn === "o");
    $("sg-turn").textContent = !live ? "SUNGKA" : match.turn === "x" ? (isFriendMatch() ? nameOf("x") + "'S TURN" : "YOUR TURN") : nameOf("o") + "'S TURN";
  }

  function renderAvatars() {
    S.renderCharacterInto($("sg-avatar-x"));
    var o = $("sg-avatar-o");
    if (o) o.innerHTML = isFriendMatch() ? SP.sprite("kid", SP.KIDS[2], { cls: "sg-avatar-art" }) : SP.sprite("bot", null, { cls: "sg-avatar-art" });
  }

  function markHand(pos, hand) {
    document.querySelectorAll("#sg-board .is-hand").forEach(function (el) {
      el.classList.remove("is-hand");
    });
    if (pos == null) return;
    var el = document.querySelector('#sg-board [data-pos="' + pos + '"]');
    if (el) el.classList.add("is-hand");
    setStatus(hand > 0 ? "SHELLS IN HAND: " + hand : "");
  }

  function setStatus(text) {
    var el = $("sg-status");
    if (el) el.textContent = text || "";
  }

  var toastTimer = null;

  function showToast(text, cls, ms) {
    var el = $("sg-toast");
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
   * Moves
   * ---------------------------------------------------------- */
  function nextQuestion() {
    if (!match.queue.length) match.queue = Q.shuffle(match.bank);
    return match.queue.shift();
  }

  /** Waits for the player to click one of their highlighted bahay. */
  function pickPit(player, token) {
    return new Promise(function (resolve) {
      match.picking = player;
      match.pickResolve = function (pos) {
        if (!match || match.token !== token) return resolve(null);
        match.picking = null;
        match.pickResolve = null;
        renderBoard();
        resolve(pos);
      };
      renderBoard();
      setStatus(player === "x" && !isFriendMatch() ? "PICK ONE OF YOUR BAHAY" : nameOf(player) + ": PICK A BAHAY");
      var first = document.querySelector("#sg-board .sg-pit.is-pickable");
      if (first) first.focus({ preventScroll: true });
    });
  }

  async function animateMove(pos, player, token) {
    var r = simulateMove(match.board, pos, player);
    var b = match.board;
    match.animating = true;
    match.fast = false;
    for (var k = 0; k < r.steps.length; k++) {
      var st = r.steps[k];
      if (st.type === "pick") {
        b[st.pos] = 0;
        renderPit(st.pos);
        markHand(st.pos, st.hand);
        sound.tone(294, 0.05, "triangle");
      } else if (st.type === "drop") {
        b[st.pos] += 1;
        renderPit(st.pos);
        markHand(st.pos, st.hand);
        sound.tone(st.pos === storeOf(player) ? 880 : 520 + (k % 5) * 40, 0.03, "square");
      } else if (st.type === "capture") {
        b[storeOf(player)] += st.amount;
        b[st.from] = 0;
        b[st.pos] = 0;
        renderPit(st.from);
        renderPit(st.pos);
        renderPit(storeOf(player));
        showToast("KAIN! +" + st.amount, "is-good");
        sound.tone(523, 0.08, "square");
        sound.tone(784, 0.12, "square", 90);
      }
      renderPlayers();
      // Long chains speed up (and a tap on the board speeds them up more).
      if (!(await wait(k > 60 ? STEP_MS / 5 : k > 24 ? STEP_MS / 2 : STEP_MS, token))) return null;
    }
    match.board = r.board.slice();
    match.animating = false;
    match.fast = false;
    markHand(null);
    renderBoard();
    return r;
  }

  async function nextTurn() {
    if (!match || match.ended) return;
    var token = match.token;
    var player = match.turn;
    renderBoard();
    if (match.moves >= MAX_MOVES || !legalMoves(match.board, player).length) {
      endGame();
      return;
    }
    match.moves += 1;
    $("sg-moves").textContent = "MOVE " + match.moves;
    var human = player === "x" || isFriendMatch();
    var pos;
    if (human) {
      var q = nextQuestion();
      match.shown.push(q.answer);
      setStatus(player === "x" && !isFriendMatch() ? "ANSWER TO PICK YOUR BAHAY" : nameOf(player) + ": ANSWER TO PICK A BAHAY");
      var res = await quiz.ask({
        label: player === "x" && !isFriendMatch() ? "YOUR MOVE" : nameOf(player) + "'S MOVE",
        who: player,
        question: q.question,
        choices: Q.choicesFor(q, match.bank, 4),
        answer: q.answer,
        meaning: q.meaning,
        seconds: QUESTION_SECONDS[match.difficulty] || QUESTION_SECONDS.normal,
        continueMs: { correct: 900, wrong: 2400 },
      });
      if (!res || !match || match.token !== token) return;
      if (player === "x") logAnswer(q, res);
      if (res.correct) {
        pos = await pickPit(player, token);
        if (pos == null || !match || match.token !== token) return;
      } else {
        pos = pickRandom(legalMoves(match.board, player));
        markHand(pos, 0);
        showToast("THE GAME PICKED A BAHAY FOR YOU", "is-bad", 1200);
        if (!(await wait(1100, token))) return;
      }
    } else {
      setStatus("BOT IS THINKING…");
      if (!(await wait(650, token))) return;
      var right = Math.random() < (BOT_ACCURACY[match.difficulty] || BOT_ACCURACY.normal);
      pos = right ? botChoose(match.board, "o", match.difficulty) : pickRandom(legalMoves(match.board, "o"));
      markHand(pos, 0);
      showToast(right ? "BOT ANSWERED RIGHT" : "BOT ANSWERED WRONG: RANDOM BAHAY", right ? "is-info" : "is-bad", 1100);
      if (!(await wait(1000, token))) return;
    }
    sound.click();
    var result = await animateMove(pos, player, token);
    if (!result || !match || match.token !== token) return;
    if (result.extra && legalMoves(match.board, player).length) {
      showToast(player === "x" && !isFriendMatch() ? "ULO! ANOTHER MOVE" : nameOf(player) + " GETS ANOTHER MOVE", "is-info", 1100);
      if (!(await wait(700, token))) return;
    } else {
      match.turn = other(player);
    }
    void nextTurn();
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
   * End of the game
   * ---------------------------------------------------------- */
  function computeProgress(outcome) {
    var st = shell.arcadeStats() || {};
    var perLevel = Number(st.exp_per_level || S.EXP_PER_LEVEL) || S.EXP_PER_LEVEL;
    var before = Number(st.total_exp || 0);
    var exp = S.gameExpForResult(outcome, match.correct);
    var after = before + exp;
    return {
      exp: exp,
      score: match.board[X_STORE] + "-" + match.board[O_STORE],
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
      stat("Shells", p.score) +
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

  function endGame() {
    if (!match || match.ended) return;
    match.ended = true;
    match.picking = null;
    quiz.cancel();
    sound.stop(playMusic);
    // Shells still in a bahay go to that side's ulo.
    ["x", "o"].forEach(function (p) {
      pitsOf(p).forEach(function (i) {
        match.board[storeOf(p)] += match.board[i];
        match.board[i] = 0;
      });
    });
    renderBoard();
    markHand(null);
    var x = match.board[X_STORE];
    var o = match.board[O_STORE];
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
      opponent: match.opponent,
      match_score: progress.score,
      shells_won: x,
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
      var friend = isFriendMatch();
      var title;
      if (friend) title = outcome === "draw" ? "TABLA!" : (outcome === "win" ? nameOf("x") : nameOf("o")) + " WINS!";
      else title = outcome === "win" ? "PANALO!" : outcome === "draw" ? "TABLA!" : "TALO!";
      var sub =
        (friend ? nameOf("x") + " collected " + x + " shells, " + nameOf("o") + " " + o + ". " : "You collected " + x + " shells, the bot " + o + ". ") +
        match.correct + " correct answer" + (match.correct === 1 ? "" : "s") + ".";
      shell.showResults({
        outcome: outcome,
        title: title,
        sub: sub,
        progressHtml: progressHtml(progress),
        answers: match.answerLog,
        againLabel: outcome === "win" ? "PLAY AGAIN" : "REMATCH",
      });
    }, 1500);
  }

  /* ----------------------------------------------------------
   * Match setup
   * ---------------------------------------------------------- */
  function newBoard() {
    var b = [];
    for (var i = 0; i < 16; i++) b.push(i === X_STORE || i === O_STORE ? 0 : SHELLS);
    return b;
  }

  function newMatch(lessonId, difficulty, bank, pick) {
    return {
      token: String(Date.now()) + Math.random(),
      lessonId: lessonId,
      difficulty: difficulty,
      opponent: opponent,
      bank: bank,
      bankSize: bank.length,
      unseenKeys: pick.unseenKeys,
      queue: pick.questions.slice(),
      shown: [],
      board: newBoard(),
      turn: "x",
      moves: 0,
      correct: 0,
      answerLog: [],
      picking: null,
      pickResolve: null,
      animating: false,
      fast: false,
      started: false,
      ended: false,
      paused: false,
    };
  }

  function setWaiting(waiting) {
    $("sg-play-screen")?.classList.toggle("is-waiting", waiting);
    var ready = $("sg-ready");
    if (ready) ready.hidden = !waiting;
    if (waiting) $("sg-start-btn")?.focus({ preventScroll: true });
  }

  function showFreshMatch() {
    quiz.cancel();
    buildBoard();
    renderAvatars();
    renderBoard();
    markHand(null);
    setStatus("");
    $("sg-moves").textContent = "MOVE 1";
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
    void nextTurn();
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

  function onBoardClick(e) {
    if (!match) return;
    if (match.animating) {
      match.fast = true; // tap to speed up the shells
      return;
    }
    var btn = e.target.closest(".sg-pit.is-pickable");
    if (!btn || !match.pickResolve || match.paused) return;
    match.pickResolve(Number(btn.getAttribute("data-pos")));
  }

  /** Arrows move between the bahay you can pick; the quiz card takes A–D and Enter. */
  function onKeydown(e) {
    if (!match) return;
    if (quiz.isOpen()) {
      quiz.handleKey(e);
      return;
    }
    if (!match.picking) return;
    var dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!dir) return;
    var pits = Array.prototype.slice.call(document.querySelectorAll("#sg-board .sg-pit.is-pickable"));
    // screen order: the bottom row runs 6..0 left to right, the top row 8..14
    pits.sort(function (a, b) {
      var pa = Number(a.getAttribute("data-pos"));
      var pb = Number(b.getAttribute("data-pos"));
      return (pa < X_STORE ? -pa : pa) - (pb < X_STORE ? -pb : pb);
    });
    if (!pits.length) return;
    var idx = pits.indexOf(document.activeElement);
    var next = pits[(idx + dir + pits.length) % pits.length] || pits[0];
    e.preventDefault();
    next.focus();
  }

  /* ----------------------------------------------------------
   * Match Log + stage panel
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
      meta: [S.formatLogDate(m.timestamp), S.difficultyLabel(m.difficulty), m.opponent === "friend" ? "VS FRIEND" : "VS BOT", m.subject_name || ""],
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
        m.opponent === "friend" ? "VS FRIEND" : "VS BOT",
        m.match_score ? "SHELLS " + m.match_score : "",
        m.exp_gained != null ? "+" + Number(m.exp_gained) + " EXP" : "",
        Number(m.correct_answers || 0) + " CORRECT",
      ],
    };
  }

  function difficultyNote(key) {
    var seconds = QUESTION_SECONDS[key] || QUESTION_SECONDS.normal;
    var note = seconds + " seconds per question";
    if (opponent === "bot") note += " · the bot is right " + Math.round((BOT_ACCURACY[key] || 0.6) * 100) + "% of the time";
    return note;
  }

  var OPPONENT_HTML =
    '<div class="wc-setup">' +
    '<p class="wc-setup-label" id="sg-opponent-label">OPPONENT</p>' +
    '<div class="wc-seg sk-seg-2 sg-opponent-picker" role="radiogroup" aria-labelledby="sg-opponent-label">' +
    '<button type="button" class="sk-option" role="radio" data-opponent="bot">BOT</button>' +
    '<button type="button" class="sk-option" role="radio" data-opponent="friend">FRIEND</button>' +
    "</div>" +
    '<p class="wc-setup-note" id="sg-opponent-note"></p></div>';

  function renderOpponentPicker() {
    document.querySelectorAll(".sg-opponent-picker .sk-option").forEach(function (btn) {
      var on = btn.getAttribute("data-opponent") === opponent;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    var note = $("sg-opponent-note");
    if (note) note.textContent = opponent === "friend" ? "Take turns on this device. Only your answers are saved." : "Play against the computer.";
    var diffNote = $("wc-diff-note");
    if (diffNote && shell) diffNote.textContent = difficultyNote(shell.difficulty());
  }

  function setOpponent(value) {
    opponent = value === "friend" ? "friend" : "bot";
    try {
      localStorage.setItem(OPPONENT_STORAGE_KEY, opponent);
    } catch (e) {
      /* ignore */
    }
    shell.setStageAlert("");
    renderOpponentPicker();
  }

  function isWin(m) {
    return outcomeOf(m) === "win";
  }

  function setup() {
    quiz = Q.create({
      host: $("sg-quiz"),
      isPaused: function () {
        return !!match && match.paused;
      },
    });
    shell = S.create({
      id: GAME_ID,
      name: "Sungka",
      eventType: "game",
      title: ["LARONG PINOY", "SUNGKA"],
      tagline: "Answer to pick your bahay. Most shells in your ulo wins.",
      logTitle: "GAME LOG",
      playLabel: "PLAY!",
      loadingText: "Setting out the shells…",
      playScreenId: "sg-play-screen",
      setupHtml: OPPONENT_HTML,
      words: S.CLASSROOM_WORDS,
      menuMusic: function () {
        return makeMusic(MENU_SONG);
      },
      difficultyNote: difficultyNote,
      start: startMatch,
      playAgain: function () {
        void playAgain();
      },
      onStagesOpen: renderOpponentPicker,
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
        $("sg-pause-btn")?.focus({ preventScroll: true });
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
      onCharacterChange: function () {
        S.renderCharacterInto($("sg-avatar-x"));
      },
    });

    makeMusic(PLAY_SONG)
      .then(function (src) {
        if (src) sound.setSrc(playMusic, src);
      })
      .catch(function (e) {
        console.warn("Sungka music:", e);
      });

    $("sg-pause-btn")?.addEventListener("click", shell.openPause);
    $("sg-start-btn")?.addEventListener("click", onStartClick);
    $("sg-board")?.addEventListener("click", onBoardClick);
    document.querySelector(".sg-opponent-picker")?.addEventListener("click", function (e) {
      var btn = e.target.closest(".sk-option");
      if (!btn) return;
      sound.click();
      setOpponent(btn.getAttribute("data-opponent"));
    });
    document.querySelector(".sg-opponent-picker")?.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      e.stopPropagation();
      setOpponent(opponent === "bot" ? "friend" : "bot");
      document.querySelector('.sg-opponent-picker [data-opponent="' + opponent + '"]')?.focus();
    });
    renderOpponentPicker();
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("sg-play-screen") || !window.ArcadeShell || !window.ArcadeQuiz) return;
    setup();
  });

  // For tests: the rules without the screen.
  window.__sungkaRules = { simulateMove: simulateMove, botChoose: botChoose, newBoard: newBoard };
})();
