/**
 * Arcade quiz card: one multiple-choice question from the lesson's question
 * bank (the answer plus three other answers from the same lesson). Shared by
 * the Larong Pinoy games (Sungka, Palosebo, Patintero, Tumbang Preso); each game
 * puts the card where it wants and styles it (classes aq-*).
 *
 *   var quiz = ArcadeQuiz.create({ host, isPaused, sound: { correct, wrong }, keepSpace });
 *     keepSpace: between questions the card is invisible but keeps its place
 *     (class "is-idle") instead of being hidden, so the game around it doesn't move.
 *   quiz.ask({ label, question, choices, answer, meaning, seconds,
 *              bot: { pick, delay } | null, onAnswered(result) })
 *     -> Promise<{ correct, picked, ms }>, or null if cancelled.
 *   quiz.cancel(); quiz.handleKey(event) -> true if used; quiz.isOpen()
 *
 * Timers stop while isPaused() is true. `ms` is the unpaused time taken to answer.
 */
(function (global) {
  "use strict";

  var KEYS = ["A", "B", "C", "D"];
  var cardCount = 0;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /** The answer plus up to `count - 1` other answers from the same bank, shuffled. */
  function choicesFor(question, bank, count) {
    var n = count || 4;
    var others = [];
    shuffle(bank || []).forEach(function (q) {
      if (q.answer !== question.answer && others.indexOf(q.answer) === -1 && others.length < n - 1) others.push(q.answer);
    });
    return shuffle([question.answer].concat(others));
  }

  function formatSeconds(s) {
    var whole = Math.max(0, Math.ceil(s));
    return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
  }

  function create(opts) {
    var o = opts || {};
    var host = o.host;
    var isPaused = typeof o.isPaused === "function" ? o.isPaused : function () {
      return false;
    };
    var sound = o.sound || {};
    var keepSpace = !!o.keepSpace;
    var id = "aq-text-" + ++cardCount;

    function setShown(shown) {
      if (keepSpace) {
        host.classList.toggle("is-idle", !shown);
        if (shown) host.removeAttribute("aria-hidden");
        else host.setAttribute("aria-hidden", "true");
      } else {
        host.hidden = !shown;
      }
    }

    host.classList.add("aq-host");
    if (keepSpace) host.classList.add("is-docked");
    host.innerHTML =
      '<div class="aq-card" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
      '<div class="aq-head"><span class="aq-label"></span><span class="aq-time" role="timer" aria-live="off"></span></div>' +
      '<div class="aq-bar" aria-hidden="true"><span class="aq-bar-fill"></span></div>' +
      '<p class="aq-text" id="' + id + '"></p>' +
      '<div class="aq-choices" role="group" aria-label="Answers"></div>' +
      '<p class="aq-feedback" hidden></p>' +
      '<p class="aq-continue" hidden>Tap to continue</p>' +
      "</div>";
    setShown(false);

    var card = host.querySelector(".aq-card");
    var labelEl = host.querySelector(".aq-label");
    var timeEl = host.querySelector(".aq-time");
    var barEl = host.querySelector(".aq-bar");
    var fillEl = host.querySelector(".aq-bar-fill");
    var textEl = host.querySelector(".aq-text");
    var choicesEl = host.querySelector(".aq-choices");
    var feedbackEl = host.querySelector(".aq-feedback");
    var continueEl = host.querySelector(".aq-continue");

    var current = null; // the question on screen

    /** Resolves true after `ms` of unpaused time, false if the question was cancelled first. */
    function wait(ms, token) {
      return new Promise(function (resolve) {
        var left = ms;
        var last = Date.now();
        var timer = setInterval(function () {
          if (!current || current.token !== token) {
            clearInterval(timer);
            resolve(false);
            return;
          }
          var now = Date.now();
          if (!isPaused()) left -= now - last;
          last = now;
          if (left <= 0) {
            clearInterval(timer);
            resolve(true);
          }
        }, 50);
      });
    }

    function renderTime() {
      if (!current || !current.seconds) return;
      var left = Math.max(0, current.seconds - current.elapsed / 1000);
      timeEl.textContent = formatSeconds(left);
      fillEl.style.width = Math.round((left / current.seconds) * 100) + "%";
      fillEl.classList.toggle("is-low", left <= 3);
    }

    function stopTimer() {
      if (current && current.timer) clearInterval(current.timer);
      if (current) current.timer = null;
    }

    function close() {
      stopTimer();
      setShown(false);
      current = null;
    }

    function cancel() {
      if (!current) return;
      var resolve = current.resolve;
      close();
      resolve(null);
    }

    function feedbackHtml(q, correct, picked) {
      if (typeof q.feedback === "function") return q.feedback(correct, picked);
      if (correct) return "<strong>" + (q.bot ? esc(q.botName || "BOT") + " GOT IT." : "CORRECT!") + "</strong>";
      var head = q.bot ? esc(q.botName || "BOT") + " MISSED." : picked ? "WRONG." : "TIME'S UP.";
      return (
        "<strong>" + head + "</strong> The answer is <b>" + esc(String(q.answer).toUpperCase()) + "</b>." +
        (q.meaning ? ' <span class="aq-meaning">' + esc(q.meaning) + "</span>" : "")
      );
    }

    function finish(picked) {
      var q = current;
      if (!q || q.answered) return;
      q.answered = true;
      stopTimer();
      var correct = picked === q.answer;
      var result = { correct: correct, picked: picked, ms: Math.round(q.elapsed) };
      choicesEl.querySelectorAll(".aq-choice").forEach(function (btn) {
        var word = q.choices[Number(btn.getAttribute("data-choice"))];
        btn.disabled = true;
        btn.classList.toggle("is-correct", word === q.answer);
        btn.classList.toggle("is-wrong", !!picked && word === picked && word !== q.answer);
      });
      feedbackEl.className = "aq-feedback " + (correct ? "is-correct" : "is-wrong");
      feedbackEl.innerHTML = feedbackHtml(q, correct, picked);
      feedbackEl.hidden = false;
      if (correct && typeof sound.correct === "function") sound.correct();
      if (!correct && typeof sound.wrong === "function") sound.wrong();
      if (typeof q.onAnswered === "function") q.onAnswered(result);
      continueEl.hidden = false;
      var token = q.token;
      // A short delay, so the tap that answered doesn't also skip the feedback.
      setTimeout(function () {
        if (current && current.token === token) current.canContinue = true;
      }, 350);
      var ms = correct ? q.continueMs.correct : q.continueMs.wrong;
      void wait(ms, token).then(function (ok) {
        if (ok && current && current.token === token) next();
      });
      q.result = result;
    }

    function next() {
      var q = current;
      if (!q || !q.answered) return;
      var resolve = q.resolve;
      var result = q.result;
      close();
      resolve(result);
    }

    function ask(question) {
      if (current) cancel();
      return new Promise(function (resolve) {
        var q = Object.assign(
          {
            label: "",
            seconds: 0,
            bot: null,
            continueMs: { correct: 1300, wrong: 2600 },
          },
          question,
          { token: String(Date.now()) + Math.random(), resolve: resolve, elapsed: 0, answered: false, canContinue: false }
        );
        current = q;
        card.classList.toggle("is-bot", !!q.bot);
        card.setAttribute("data-who", q.who || "");
        labelEl.textContent = q.label;
        textEl.textContent = q.question;
        choicesEl.innerHTML = q.choices
          .map(function (c, i) {
            return (
              '<button type="button" class="aq-choice" data-choice="' + i + '"' + (q.bot ? " disabled" : "") + ">" +
              '<span class="aq-key">' + KEYS[i] + "</span><span>" + esc(String(c).toUpperCase()) + "</span></button>"
            );
          })
          .join("");
        feedbackEl.hidden = true;
        continueEl.hidden = true;
        barEl.hidden = !!q.bot || !q.seconds;
        timeEl.textContent = q.bot ? (q.botName || "BOT") + "'S TURN" : "";
        setShown(true);

        if (q.bot) {
          var token = q.token;
          void wait(q.bot.delay || 1000, token).then(function (ok) {
            if (!ok) return;
            var btn = choicesEl.querySelector('[data-choice="' + q.choices.indexOf(q.bot.pick) + '"]');
            if (btn) btn.classList.add("is-picked");
            void wait(450, token).then(function (ok2) {
              if (ok2) finish(q.bot.pick);
            });
          });
          return;
        }
        var last = Date.now();
        renderTime();
        q.timer = setInterval(function () {
          if (!current || current !== q) return;
          var now = Date.now();
          if (!isPaused()) q.elapsed += now - last;
          last = now;
          if (q.seconds) {
            renderTime();
            if (q.elapsed >= q.seconds * 1000) finish(null);
          }
        }, 100);
        var first = choicesEl.querySelector(".aq-choice");
        if (first) first.focus({ preventScroll: true });
      });
    }

    choicesEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".aq-choice");
      if (!btn || btn.disabled || !current || current.bot || current.answered || isPaused()) return;
      btn.classList.add("is-picked");
      finish(current.choices[Number(btn.getAttribute("data-choice"))]);
    });

    host.addEventListener("click", function (e) {
      if (e.target.closest(".aq-choice")) return;
      if (current && current.answered && current.canContinue) next();
    });

    /** A–D / 1–4 answer, Enter or Space continues. Returns true when the key was used. */
    function handleKey(e) {
      if (!current) return false;
      if (current.answered) {
        if ((e.key === "Enter" || e.key === " ") && current.canContinue) {
          e.preventDefault();
          next();
        }
        return true;
      }
      var idx = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[String(e.key).toLowerCase()];
      if (idx !== undefined && !current.bot) {
        var btn = choicesEl.querySelector('[data-choice="' + idx + '"]');
        if (btn && !btn.disabled) {
          e.preventDefault();
          btn.click();
        }
      }
      return true;
    }

    return {
      ask: ask,
      cancel: cancel,
      handleKey: handleKey,
      isOpen: function () {
        return !!current;
      },
      el: host,
    };
  }

  global.ArcadeQuiz = { create: create, choicesFor: choicesFor, shuffle: shuffle, esc: esc };
})(window);
