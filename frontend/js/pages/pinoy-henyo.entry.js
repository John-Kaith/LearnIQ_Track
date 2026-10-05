/**
 * Pinoy Henyo (pinoy-henyo.html) — Larong Pinoy: guess the word on your forehead.
 *
 * A word from the lesson's question bank is "on your forehead". Ask your
 * ka-Henyo yes-or-no questions; they can only answer OO, HINDI or PWEDE:
 *   - "Tungkol ba sa ___?" cards use words from the lesson's own explanations
 *     (the hidden word's own words = OO, a close word = PWEDE, others = HINDI);
 *   - letter cards: first letter, vowels, length.
 * Type a guess any time. CLUE shows the lesson question (−10 seconds), PASS skips.
 * Guess as many words as you can in 2 minutes: reach the target to win (2 / 3 / 4
 * words on Normal / Medium / Hard; one short is a draw). Hard has fewer "OO" cards.
 * Menus, results, log, settings and pause come from the Arcade shell.
 */
(function () {
  "use strict";

  var S = window.ArcadeShell;
  var SP = window.ArcadeSprites;
  var esc = S.esc;
  var sound = S.sound;
  var shell = null;

  var GAME_ID = "pinoy-henyo";
  var ROUND_MS = 120000;
  var TARGET = { normal: 2, medium: 3, hard: 4 };
  var TRUE_CARDS = { normal: 2, medium: 2, hard: 1 };
  var DECOY_CARDS = { normal: 3, medium: 4, hard: 5 };
  var CLUE_COST_MS = 10000;
  var ANSWER_DELAY = 650;
  var LETTER_RANGES = [["A", "F"], ["G", "M"], ["N", "S"], ["T", "Z"]];
  var VOWELS = ["A", "E", "I", "O", "U"];
  var LONG_WORD = 8;
  var MAX_LOGGED_ANSWERS = 60;
  var STOP_WORDS = (
    "the a an of and or to in on for with is are was were be been being by as at that this these those it its from into " +
    "which what who whom whose when where why how their they them there here has have had can could will would should " +
    "not but also than then about used uses using use part parts called known main make makes made help helps other " +
    "each such more most very many much some one two three any all both only same like within without between during " +
    "through over under after before because while does done do your you our we his her him she he term terms word " +
    "lesson answer question thing things type types kind kinds form forms process way ways stores store " +
    "ng sa ang mga na at ay para isang ito nito kung may mula lahat din rin"
  ).split(" ");
  var STOP = {};
  STOP_WORDS.forEach(function (w) {
    STOP[w] = true;
  });

  /* Game-show music, made in the browser (js/arcade/chiptune.js). */
  var C = [48, 52, 55];
  var F = [41, 45, 48];
  var G = [43, 47, 50];
  var AM = [45, 48, 52];
  var E7 = [40, 44, 50];
  var MENU_SONG = {
    bpm: 132,
    chords: [C, C, F, G, C, AM, F, G],
    melody: [
      [0, 72, 1], [1, 76, 1], [2, 79, 1], [3, 84, 3], [6, 79, 2],
      [8, 81, 2], [10, 79, 2], [12, 76, 4],
      [16, 77, 1], [17, 81, 1], [18, 84, 2], [20, 81, 2], [22, 77, 2],
      [24, 79, 4], [28, 74, 4],
      [32, 72, 1], [33, 76, 1], [34, 79, 1], [35, 84, 3], [38, 79, 2],
      [40, 81, 2], [42, 84, 2], [44, 88, 4],
      [48, 86, 2], [50, 84, 2], [52, 81, 2], [54, 77, 2],
      [56, 79, 2], [58, 83, 2], [60, 84, 4],
    ],
    lead: { wave: "pulse", gain: 0.06 },
    bass: { wave: "triangle", gain: 0.22, steps: [0, 2, 4, 6], fifthOn: [2, 6] },
    kick: [0, 4],
    kickGain: 0.26,
    snare: [2, 6],
    snareGain: 0.07,
    hat: [1, 3, 5, 7],
    hatGain: 0.03,
  };
  var PLAY_SONG = {
    bpm: 144,
    chords: [AM, AM, F, F, C, C, E7, E7],
    melody: [
      [0, 69, 1], [4, 72, 1],
      [8, 69, 1], [12, 76, 1],
      [16, 77, 1], [20, 76, 1],
      [24, 74, 2], [28, 72, 2],
      [32, 69, 1], [36, 72, 1],
      [40, 69, 1], [44, 76, 1],
      [48, 80, 2], [52, 76, 2],
      [56, 74, 2], [60, 71, 2],
    ],
    lead: { wave: "pulse", gain: 0.045 },
    arp: { wave: "square", gain: 0.025, pattern: [0, 2, 1, 2, 0, 2, 1, 2] },
    bass: { wave: "triangle", gain: 0.2, steps: [0, 4], fifthOn: [4] },
    kick: [0, 4],
    kickGain: 0.22,
    hat: [0, 1, 2, 3, 4, 5, 6, 7],
    hatGain: 0.022,
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

  function cleanWord(text) {
    return String(text || "").toLowerCase().replace(/[^a-z]/g, "");
  }

  function setStatus(text) {
    var el = $("ph-status");
    if (el) el.textContent = text || "";
  }

  var toastTimer = null;

  function showToast(text, cls, ms) {
    var el = $("ph-toast");
    if (!el) return;
    el.textContent = text;
    el.className = "sk-toast" + (cls ? " " + cls : "");
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.hidden = true;
    }, ms || 1400);
  }

  /* ----------------------------------------------------------
   * Words from the lesson's explanations
   * ---------------------------------------------------------- */
  function wordsOf(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z\s-]/g, " ")
      .split(/[\s-]+/)
      .filter(function (w) {
        return w.length >= 4 && !STOP[w];
      });
  }

  function unique(list) {
    var seen = {};
    return list.filter(function (w) {
      if (seen[w]) return false;
      seen[w] = true;
      return true;
    });
  }

  /** Words that give the answer away (the answer itself, or nearly). */
  function givesAway(word, answer) {
    return word === answer || (word.length >= 5 && answer.indexOf(word.slice(0, 5)) === 0) || (answer.length >= 5 && word.indexOf(answer.slice(0, 5)) === 0);
  }

  /** OO: one of the hidden word's own words; PWEDE: shares a stem with one; HINDI: anything else. */
  function answerFor(keyword, own) {
    if (own.indexOf(keyword) !== -1) return "OO";
    var stem = keyword.slice(0, 5);
    var close = keyword.length >= 5 && own.some(function (w) {
      return w.length >= 5 && w.slice(0, 5) === stem;
    });
    return close ? "PWEDE" : "HINDI";
  }

  function meaningCards(word) {
    var own = unique(wordsOf(word.meaning).concat(wordsOf(word.question))).filter(function (w) {
      return !givesAway(w, word.answer);
    });
    var fromMeaning = unique(wordsOf(word.meaning)).filter(function (w) {
      return !givesAway(w, word.answer);
    });
    var trueCount = TRUE_CARDS[match.difficulty] || 2;
    var picks = S.shuffle(fromMeaning.length ? fromMeaning : own).slice(0, trueCount);
    var decoys = [];
    S.shuffle(match.bank).forEach(function (other) {
      if (other.answer === word.answer) return;
      S.shuffle(wordsOf(other.meaning)).forEach(function (w) {
        if (decoys.indexOf(w) === -1 && picks.indexOf(w) === -1 && own.indexOf(w) === -1 && !givesAway(w, word.answer) && !givesAway(w, other.answer)) {
          decoys.push(w);
        }
      });
    });
    decoys = decoys.slice(0, DECOY_CARDS[match.difficulty] || 4);
    return S.shuffle(picks.concat(decoys)).map(function (k) {
      return { kind: "meaning", label: "Tungkol ba sa “" + k + "”?", short: k, answer: answerFor(k, own) };
    });
  }

  function letterCards(word) {
    var first = word.answer.charAt(0).toUpperCase();
    var cards = LETTER_RANGES.map(function (r) {
      return {
        kind: "letter",
        label: "Simula sa " + r[0] + "–" + r[1] + "?",
        short: r[0] + "–" + r[1],
        answer: first >= r[0] && first <= r[1] ? "OO" : "HINDI",
      };
    });
    VOWELS.forEach(function (v) {
      cards.push({ kind: "letter", label: "May letrang " + v + "?", short: "May " + v, answer: word.answer.toUpperCase().indexOf(v) !== -1 ? "OO" : "HINDI" });
    });
    cards.push({ kind: "letter", label: LONG_WORD + " letra o higit pa?", short: LONG_WORD + "+ letra", answer: word.answer.length >= LONG_WORD ? "OO" : "HINDI" });
    return cards;
  }

  /* ----------------------------------------------------------
   * Drawing
   * ---------------------------------------------------------- */
  function renderCards() {
    var meaning = $("ph-ask-meaning");
    var letters = $("ph-ask-letters");
    if (!meaning || !letters || !match) return;
    var html = function (card, i) {
      var cls = "ph-card is-" + card.kind + (card.asked ? " is-asked is-" + card.answer.toLowerCase() : "");
      return (
        '<button type="button" class="' + cls + '" data-card="' + i + '"' + (card.asked ? " disabled" : "") + ' aria-label="' + esc(card.label) + (card.asked ? ": " + card.answer : "") + '">' +
        '<span class="ph-card-q">' + esc(card.short) + "</span>" +
        (card.asked ? '<span class="ph-card-a">' + card.answer + "</span>" : "") +
        "</button>"
      );
    };
    meaning.innerHTML =
      '<p class="ph-group-label">TUNGKOL BA SA…?</p>' +
      match.cards
        .map(function (c, i) {
          return c.kind === "meaning" ? html(c, i) : "";
        })
        .join("");
    letters.innerHTML =
      '<p class="ph-group-label">LETRA</p>' +
      match.cards
        .map(function (c, i) {
          return c.kind === "letter" ? html(c, i) : "";
        })
        .join("");
  }

  function renderAsked() {
    var list = $("ph-asked");
    if (!list || !match) return;
    list.innerHTML = match.asked
      .slice()
      .reverse()
      .map(function (a) {
        return '<li class="is-' + a.answer.toLowerCase() + '"><span>' + esc(a.label) + "</span><b>" + a.answer + "</b></li>";
      })
      .join("");
  }

  function renderHud() {
    if (!match) return;
    var left = Math.max(0, match.timeLeft);
    var secs = Math.ceil(left / 1000);
    var clock = $("ph-clock");
    if (clock) {
      clock.textContent = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
      clock.classList.toggle("is-low", secs <= 10 && match.started);
    }
    $("ph-score").textContent = "HENYO " + match.guessed + " / " + (TARGET[match.difficulty] || 2);
    $("ph-word-num").textContent = "WORD " + Math.max(1, match.wordIndex);
  }

  function bubble(text, cls) {
    var el = $("ph-bubble");
    if (!el) return;
    el.textContent = text;
    el.className = "ph-bubble" + (cls ? " " + cls : "");
  }

  function setBand(text) {
    var el = $("ph-band-text");
    if (el) el.textContent = text;
  }

  function focusInput() {
    var input = $("ph-input");
    if (!input) return;
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) input.focus({ preventScroll: true });
  }

  /* ----------------------------------------------------------
   * Words
   * ---------------------------------------------------------- */
  function nextWord() {
    if (!match.queue.length) match.queue = S.shuffle(match.bank);
    var w = match.queue.shift();
    match.word = w;
    match.wordIndex += 1;
    match.shown.push(w.answer);
    match.asked = [];
    match.attempts = [];
    match.clueUsed = false;
    match.cards = meaningCards(w).concat(letterCards(w));
    var clue = $("ph-clue");
    if (clue) {
      clue.hidden = true;
      clue.textContent = "";
    }
    $("ph-clue-btn").disabled = false;
    $("ph-input").value = "";
    setBand("?");
    bubble("Ask me anything!", "");
    renderCards();
    renderAsked();
    renderHud();
    focusInput();
  }

  function logWord(result) {
    if (!match.word) return;
    if (result === "correct") match.correct += 1;
    if (match.answerLog.length >= MAX_LOGGED_ANSWERS) return;
    match.answerLog.push({
      question: String(match.word.question || "").slice(0, 240),
      answer: match.word.answer,
      meaning: String(match.word.meaning || "").slice(0, 200),
      result: result,
      attempts: match.attempts.slice(0, 3),
      hints: match.clueUsed ? 1 : 0,
    });
  }

  async function askCard(index) {
    if (!match || !match.started || match.ended || match.busy || match.paused) return;
    var card = match.cards[index];
    if (!card || card.asked) return;
    var token = match.token;
    match.busy = true;
    bubble("Hmm…", "is-thinking");
    sound.tone(440, 0.04, "square");
    if (!(await wait(ANSWER_DELAY, token))) return;
    card.asked = true;
    match.totalAsked += 1;
    match.asked.push({ label: card.label, answer: card.answer });
    bubble(card.answer + "!", "is-" + card.answer.toLowerCase());
    if (card.answer === "OO") {
      sound.tone(784, 0.06, "square");
      sound.tone(1047, 0.08, "square", 70);
    } else if (card.answer === "PWEDE") {
      sound.tone(587, 0.08, "square");
    } else {
      sound.tone(220, 0.12, "square");
    }
    renderCards();
    renderAsked();
    match.busy = false;
    focusInput();
  }

  async function onGuess(e) {
    e.preventDefault();
    if (!match || !match.started || match.ended || match.paused || match.celebrating) return;
    var input = $("ph-input");
    var guess = cleanWord(input.value);
    if (!guess) return;
    var token = match.token;
    if (guess === match.word.answer) {
      match.guessed += 1;
      match.celebrating = true;
      logWord("correct");
      setBand(match.word.answer.toUpperCase());
      bubble("HENYO!", "is-oo");
      var henyo = $("ph-henyo");
      if (henyo) {
        henyo.classList.remove("is-shown");
        void henyo.offsetWidth;
        henyo.classList.add("is-shown");
      }
      sound.victory();
      renderHud();
      if (!(await wait(1300, token))) return;
      match.celebrating = false;
      nextWord();
    } else {
      if (match.attempts.indexOf(guess) === -1) match.attempts.push(guess);
      bubble("HINDI 'YAN!", "is-hindi");
      sound.tone(196, 0.14, "square");
      input.classList.remove("is-wrong");
      void input.offsetWidth;
      input.classList.add("is-wrong");
      input.select();
    }
  }

  function onClue() {
    if (!match || !match.started || match.ended || match.paused || match.clueUsed || match.celebrating) return;
    match.clueUsed = true;
    match.timeLeft -= CLUE_COST_MS;
    var clue = $("ph-clue");
    if (clue) {
      clue.textContent = "Clue: " + match.word.question;
      clue.hidden = false;
    }
    $("ph-clue-btn").disabled = true;
    sound.tone(523, 0.06, "triangle");
    renderHud();
    focusInput();
  }

  async function onPass() {
    if (!match || !match.started || match.ended || match.paused || match.celebrating) return;
    var token = match.token;
    match.celebrating = true;
    logWord("skipped");
    setBand(match.word.answer.toUpperCase());
    bubble("The word was " + match.word.answer.toUpperCase() + ".", "is-pwede");
    sound.tone(330, 0.08, "square");
    if (!(await wait(1500, token))) return;
    match.celebrating = false;
    nextWord();
  }

  function tick() {
    var now = Date.now();
    if (!match) return;
    var dt = now - match.lastTick;
    match.lastTick = now;
    if (!match.started || match.ended || match.paused) return;
    match.timeLeft -= dt;
    renderHud();
    if (match.timeLeft <= 0) endMatch();
  }

  /* ----------------------------------------------------------
   * End of the round
   * ---------------------------------------------------------- */
  function outcomeFor(guessed) {
    var target = TARGET[match.difficulty] || 2;
    return guessed >= target ? "win" : guessed === target - 1 ? "draw" : "lose";
  }

  function computeProgress(outcome) {
    var st = shell.arcadeStats() || {};
    var perLevel = Number(st.exp_per_level || S.EXP_PER_LEVEL) || S.EXP_PER_LEVEL;
    var before = Number(st.total_exp || 0);
    var exp = S.gameExpForResult(outcome, match.correct);
    var after = before + exp;
    return {
      exp: exp,
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
      stat("Words", match.guessed + "/" + (TARGET[match.difficulty] || 2)) +
      stat("EXP", "+" + p.exp) +
      stat("Arcade LV", p.levelAfter) +
      stat("Asked", match.totalAsked) +
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
    match.timeLeft = 0;
    renderHud();
    sound.stop(playMusic);
    if (!match.celebrating) logWord("unanswered"); // the word you were still guessing
    var outcome = outcomeFor(match.guessed);
    if (outcome === "win") sound.victory();
    else {
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
      match_score: match.guessed + " WORD" + (match.guessed === 1 ? "" : "S"),
      words_guessed: match.guessed,
      target: TARGET[match.difficulty] || 2,
      questions_asked: match.totalAsked,
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
    setBand(match.word ? match.word.answer.toUpperCase() : "?");
    bubble("TIME'S UP!", "is-hindi");
    setStatus("TIME'S UP!");
    var ended = match;
    setTimeout(function () {
      if (match !== ended) return;
      var target = TARGET[match.difficulty] || 2;
      shell.showResults({
        outcome: outcome,
        title: outcome === "win" ? "HENYO KA!" : outcome === "draw" ? "TABLA!" : "TALO!",
        sub:
          "You guessed " + match.guessed + " word" + (match.guessed === 1 ? "" : "s") + " (target: " + target + ") and asked " +
          match.totalAsked + " question" + (match.totalAsked === 1 ? "" : "s") + ".",
        progressHtml: progressHtml(progress),
        answers: match.answerLog,
        againLabel: outcome === "win" ? "PLAY AGAIN" : "TRY AGAIN",
      });
    }, 1500);
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
      timeLeft: ROUND_MS,
      lastTick: Date.now(),
      word: null,
      wordIndex: 0,
      cards: [],
      asked: [],
      attempts: [],
      clueUsed: false,
      guessed: 0,
      correct: 0,
      totalAsked: 0,
      answerLog: [],
      busy: false,
      celebrating: false,
      started: false,
      ended: false,
      paused: false,
    };
  }

  function setWaiting(waiting) {
    $("ph-play-screen")?.classList.toggle("is-waiting", waiting);
    var ready = $("ph-ready");
    if (ready) ready.hidden = !waiting;
    if (waiting) $("ph-start-btn")?.focus({ preventScroll: true });
  }

  function showFreshMatch() {
    S.renderCharacterInto($("ph-avatar"));
    $("ph-partner-art").innerHTML = SP.sprite("kid", SP.KIDS[3], { cls: "ph-art" });
    match.cards = [];
    renderCards();
    renderAsked();
    renderHud();
    setBand("?");
    bubble("Ask me anything!", "");
    $("ph-input").value = "";
    $("ph-clue").hidden = true;
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
    nextWord();
  }

  function restartMatch() {
    if (!match) return;
    var old = match;
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
  function outcomeOf(m) {
    var o = String((m && m.outcome) || "").toLowerCase();
    return o === "win" || o === "draw" ? o : "lose";
  }

  function logRow(m) {
    var o = outcomeOf(m);
    return {
      badge:
        o === "win"
          ? '<i class="fa-solid fa-check" aria-hidden="true"></i> HENYO'
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
      title: o === "win" ? "HENYO KA!" : o === "draw" ? "TABLA!" : "TALO!",
      cls: o === "win" ? "is-win" : o === "draw" ? "" : "is-loss",
      chips: [
        S.formatLogDate(m.timestamp),
        S.difficultyLabel(m.difficulty),
        m.match_score ? m.match_score + (m.target ? " / " + Number(m.target) : "") : "",
        m.questions_asked != null ? Number(m.questions_asked) + " ASKED" : "",
        m.exp_gained != null ? "+" + Number(m.exp_gained) + " EXP" : "",
      ],
    };
  }

  function difficultyNote(key) {
    return "2 minutes · guess " + (TARGET[key] || 2) + " words to win" + (key === "hard" ? " · fewer OO cards" : "");
  }

  var SETUP_HTML =
    '<div class="wc-setup">' +
    '<p class="wc-setup-label">HOW TO WIN</p>' +
    '<p class="wc-setup-note">Guess the words from this lesson before the 2 minutes run out.</p>' +
    "</div>";

  function isWin(m) {
    return outcomeOf(m) === "win";
  }

  function setup() {
    shell = S.create({
      id: GAME_ID,
      name: "Pinoy Henyo",
      eventType: "game",
      title: ["PINOY", "HENYO"],
      tagline: "Oo, hindi o pwede? Guess the word on your forehead!",
      logTitle: "GAME LOG",
      playLabel: "PLAY!",
      loadingText: "Writing the words…",
      playScreenId: "ph-play-screen",
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
        return !!match && match.started && !match.ended;
      },
      onPause: function () {
        if (match) match.paused = true;
      },
      onResume: function () {
        if (!match) return;
        match.paused = false;
        match.lastTick = Date.now();
        focusInput();
      },
      canRestart: function () {
        return !!match && match.started;
      },
      onRestart: restartMatch,
      quitMessage: function () {
        return match && match.started ? "This game won't be saved." : "You'll go back to the main menu.";
      },
      onLeave: function () {
        sound.stopAll();
        setWaiting(false);
        match = null;
      },
      onCharacterChange: function () {
        S.renderCharacterInto($("ph-avatar"));
      },
    });

    makeMusic(PLAY_SONG)
      .then(function (src) {
        if (src) sound.setSrc(playMusic, src);
      })
      .catch(function (e) {
        console.warn("Pinoy Henyo music:", e);
      });

    setInterval(tick, 100);
    $("ph-pause-btn")?.addEventListener("click", shell.openPause);
    $("ph-start-btn")?.addEventListener("click", onStartClick);
    $("ph-guess-form")?.addEventListener("submit", onGuess);
    $("ph-clue-btn")?.addEventListener("click", onClue);
    $("ph-pass-btn")?.addEventListener("click", function () {
      void onPass();
    });
    $("ph-input")?.addEventListener("animationend", function (e) {
      e.target.classList.remove("is-wrong");
    });
    document.querySelector(".ph-asks")?.addEventListener("click", function (e) {
      var btn = e.target.closest(".ph-card[data-card]");
      if (!btn || btn.disabled) return;
      void askCard(Number(btn.getAttribute("data-card")));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("ph-play-screen") || !window.ArcadeShell) return;
    setup();
  });
})();
