/**
 * Arcade (arcade.html) — the game library.
 *
 * Arcade level + each game's record from /student/arcade-stats, recent plays
 * and cleared stages from /student/learning-history (Word Clash = event
 * "battle", other games = event "game" with metadata.game), top players from
 * /student/leaderboard (ranked by Arcade level, then EXP).
 * The hero shows the game played last. It is drawn right away from the last
 * game played on this device, then checked against the server history.
 */
(function () {
  "use strict";

  var EXP_PER_LEVEL = 100;
  var TOP_PLAYERS = 5;
  var RECENT_PLAYS = 5;
  var CHARACTER_STORAGE_KEY = "learniq-battle-character"; // shared with the Arcade games
  var LAST_GAME_KEY = "learniq-arcade-last-game"; // also set by arcade-shell.js

  var TTK_BOARD =
    '<span class="arcade-ttk-board">' +
    '<span class="is-x is-win">X</span><span class="is-o">O</span><span></span>' +
    '<span></span><span class="is-x is-win">X</span><span class="is-o">O</span>' +
    '<span class="is-o">O</span><span></span><span class="is-x is-win">X</span>' +
    "</span>";

  function sprite(name, colors) {
    return window.ArcadeSprites ? window.ArcadeSprites.sprite(name, colors, { cls: "arcade-sprite" }) : "";
  }

  function logo(top, main) {
    return '<span class="arcade-cover-logo"><span>' + top + "</span><span>" + main + "</span></span>";
  }

  function sungkaPits() {
    var pit = "<i>" + sprite("shell") + "</i>";
    return '<span class="arcade-sg-row">' + pit + pit + pit + pit + pit + "</span>";
  }

  /**
   * Every playable game, in the order of the "All games" list. Word Clash results
   * are "battle" events; the others are "game" events (metadata.game = the key).
   * cover(hero): the box art; the hero version may add the student's fighter.
   */
  var GAMES = {
    "word-clash": {
      name: "Word Clash",
      url: "battle-arena.html",
      cls: "wordclash",
      desc: "Spell the answer to attack. Every subject is a world and every lesson is a stage.",
      card: "Spell the answer to defeat the monster.",
      tags: ["Spelling", "Solo", "All subjects"],
      firstPlay: "You haven't played yet. Press Play to start your first battle!",
      // A battle: your letter tiles hit the dragon. The hero shows the fighter you picked.
      cover: function (hero) {
        var hp = '<span class="arcade-wc-hp"><i></i></span>';
        return (
          '<span class="arcade-wc-moon"></span><span class="arcade-wc-hills"></span>' +
          logo("WORD", "CLASH") +
          '<span class="arcade-wc-stage">' +
          '<span class="arcade-wc-side is-fighter">' +
          hp +
          (hero
            ? '<span class="arcade-wc-fighter" id="arcade-hero-fighter">🧑‍🎓</span>'
            : sprite("kid", { t: "#67e8f9", p: "#312e81" })) +
          "</span>" +
          '<span class="arcade-wc-tiles"><b>W</b><b>O</b><b>R</b><b>D</b><i class="arcade-wc-boom"></i></span>' +
          '<span class="arcade-wc-side is-dragon">' + hp + sprite("dragon") + "</span>" +
          "</span>"
        );
      },
    },
    "tic-tac-know": {
      name: "Tic-Tac-Know",
      url: "tic-tac-know.html",
      cls: "ttk",
      desc: "Every square hides a question from your lesson. Answer right to claim it, then get three in a row.",
      card: "Answer a question to claim a square. Get three in a row to win.",
      tags: ["Multiple choice", "vs Bot", "All subjects"],
      firstPlay: "You haven't played yet. Press Play to start your first match!",
      cover: function (hero) {
        return (
          logo("TIC-TAC", "KNOW") +
          (hero ? '<span class="arcade-cover-fighter" id="arcade-hero-fighter">🧑‍🎓</span>' : "") +
          TTK_BOARD +
          (hero ? '<span class="arcade-cover-bot">🤖</span>' : "")
        );
      },
    },
    sungka: {
      name: "Sungka",
      url: "sungka.html",
      cls: "sungka",
      desc: "The Filipino shell game. Answer right to pick your bahay; most shells in your ulo wins.",
      card: "Answer right to pick your bahay. Most shells in your ulo wins.",
      tags: ["Board game", "vs Bot", "Larong Pinoy"],
      firstPlay: "You haven't played yet. Press Play to start your first game!",
      cover: function () {
        return logo("LARONG PINOY", "SUNGKA") + '<span class="arcade-sg-board">' + sungkaPits() + sungkaPits() + "</span>";
      },
    },
    palosebo: {
      name: "Palosebo",
      url: "palosebo.html",
      cls: "palosebo",
      desc: "A fiesta race up greasy bamboo poles. Answer fast to climb higher; first to the prize wins.",
      card: "Race up the greasy poles. The faster you answer, the higher you climb.",
      tags: ["Race", "vs 3 bots", "Larong Pinoy"],
      firstPlay: "You haven't played yet. Press Play to start your first race!",
      cover: function () {
        var prize = "<b>" + sprite("prize") + "</b>";
        return (
          '<span class="arcade-pb-flags"></span>' +
          logo("LARONG PINOY", "PALOSEBO") +
          '<span class="arcade-pb-poles"><i>' + prize + "</i>" +
          '<i class="is-climb">' + prize + "<span>" + sprite("climber", { t: "#ffd23f", p: "#7c2d12" }) + "</span></i>" +
          "<i>" + prize + "</i></span>"
        );
      },
    },
    patintero: {
      name: "Patintero",
      url: "patintero.html",
      cls: "patintero",
      desc: "Cross every line and come back home without getting tagged. Tagged? Answer right to slip through.",
      card: "Dodge the taya. Tagged? Answer right to slip through.",
      tags: ["Action", "Solo", "Larong Pinoy"],
      firstPlay: "You haven't played yet. Press Play to start your first game!",
      cover: function () {
        return (
          logo("LARONG PINOY", "PATINTERO") +
          '<span class="arcade-pt-court">' +
          '<i class="arcade-pt-kid is-runner">' + sprite("kid", { t: "#ffd166", p: "#1e3a8a" }) + "</i>" +
          '<i class="arcade-pt-kid is-taya">' + sprite("kid", { t: "#16a34a" }) + "</i>" +
          "</span>"
        );
      },
    },
    "tumbang-preso": {
      name: "Tumbang Preso",
      url: "tumbang-preso.html",
      cls: "tumbang",
      desc: "Every right answer earns a throw. Stop the arrow in the green and knock the can down!",
      card: "Answer right to earn a throw. Knock the can down with your tsinelas.",
      tags: ["Aim", "vs Bot", "Larong Pinoy"],
      firstPlay: "You haven't played yet. Press Play to start your first game!",
      cover: function () {
        return (
          logo("TUMBANG", "PRESO") +
          '<span class="arcade-tp-road"></span>' +
          '<span class="arcade-tp-kid">' + sprite("kid", { t: "#ffcf3f", p: "#1d4ed8" }) + "</span>" +
          '<span class="arcade-tp-slipper">' + sprite("slipper") + "</span>" +
          '<span class="arcade-tp-can">' + sprite("can") + "</span>"
        );
      },
    },
    "pinoy-henyo": {
      name: "Pinoy Henyo",
      url: "pinoy-henyo.html",
      cls: "henyo",
      desc: "The word from the lesson is on your forehead. Ask oo, hindi o pwede, then guess it in 2 minutes.",
      card: "Ask oo, hindi o pwede and guess the word on your forehead.",
      tags: ["Guess the word", "Solo", "Larong Pinoy"],
      firstPlay: "You haven't played yet. Press Play to start your first round!",
      cover: function () {
        return (
          logo("PINOY", "HENYO") +
          '<span class="arcade-ph-card">?</span>' +
          '<span class="arcade-ph-bubble is-oo">OO!</span>' +
          '<span class="arcade-ph-bubble is-pwede">PWEDE!</span>'
        );
      },
    },
  };
  var NEWEST_GAME = "sungka"; // shown to students who haven't played anything yet

  /** The "All games" cards, from the registry. */
  function renderGameCards() {
    var list = document.getElementById("arcade-games");
    if (!list) return;
    var html = Object.keys(GAMES)
      .map(function (id) {
        var g = GAMES[id];
        return (
          '<li><a class="arcade-game" href="' + g.url + '">' +
          '<span class="arcade-cover arcade-cover--' + g.cls + '" aria-hidden="true">' + g.cover(false) + "</span>" +
          '<span class="arcade-game-body">' +
          '<span class="arcade-game-name">' + esc(g.name) + "</span>" +
          '<span class="arcade-game-desc">' + esc(g.card) + "</span>" +
          '<span class="arcade-game-tags">' +
          g.tags
            .map(function (t) {
              return "<span>" + esc(t) + "</span>";
            })
            .join("") +
          "</span></span>" +
          '<span class="arcade-game-cta">Play <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>' +
          "</a></li>"
        );
      })
      .join("");
    list.innerHTML = html;
  }

  function esc(v) {
    return typeof escapeHtml === "function"
      ? escapeHtml(String(v == null ? "" : v))
      : String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
  }

  function session() {
    return typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  }

  function studentId() {
    if (typeof getStudentIdNumberForApi === "function") return getStudentIdNumberForApi();
    var u = session();
    return String((u && u.id_number) || "").trim();
  }

  async function getJson(path, withAuth) {
    var headers = withAuth && typeof adminAuthHeaders === "function" ? adminAuthHeaders() : {};
    var res = await fetch(apiUrl(path), { headers: headers });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error((data && data.error) || "Request failed.");
    return data;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function fmtInt(n) {
    return Number(n || 0).toLocaleString();
  }

  function lessonName(item) {
    return String((item && item.lesson_title) || "Lesson").replace(/\.(pdf|pptx?|docx?|txt)$/i, "");
  }

  function timeOf(item) {
    var t = item && item.timestamp ? new Date(item.timestamp).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }

  function timeAgo(iso) {
    var t = iso ? new Date(iso).getTime() : NaN;
    if (Number.isNaN(t)) return "";
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    var d = Math.floor(s / 86400);
    if (d === 1) return "yesterday";
    if (d < 7) return d + " days ago";
    return new Date(t).toLocaleDateString();
  }

  function difficultyLabel(key) {
    var k = String(key || "").toLowerCase();
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : "";
  }

  /** "win", "draw" or "loss". */
  function outcomeOf(item) {
    var o = String((item && item.outcome) || "").toLowerCase();
    return o === "win" || o === "draw" ? o : "loss";
  }

  var OUTCOME = {
    win: { label: "Won", icon: "fa-trophy" },
    draw: { label: "Draw", icon: "fa-handshake" },
    loss: { label: "Lost", icon: "fa-skull" },
  };

  function battleScore(item) {
    return Number(item.score != null ? item.score : item.total_damage) || 0;
  }

  function readLastGame() {
    try {
      var id = localStorage.getItem(LAST_GAME_KEY);
      return GAMES[id] ? id : "";
    } catch (e) {
      return "";
    }
  }

  function saveLastGame(id) {
    try {
      localStorage.setItem(LAST_GAME_KEY, id);
    } catch (e) {
      /* ignore */
    }
  }

  /** Every result from every game, newest first: { game, item }. */
  function allPlays(history) {
    var plays = [];
    (Array.isArray(history.battle) ? history.battle : []).forEach(function (item) {
      plays.push({ game: "word-clash", item: item });
    });
    (Array.isArray(history.game) ? history.game : []).forEach(function (item) {
      var id = String(item.game || "").toLowerCase();
      if (GAMES[id] && id !== "word-clash") plays.push({ game: id, item: item });
    });
    plays.sort(function (a, b) {
      return timeOf(b.item) - timeOf(a.item);
    });
    return plays;
  }

  /* ---- Header + hero ---- */
  function renderLevel(stats) {
    var totalExp = Number(stats.total_exp || 0);
    var perLevel = Number(stats.exp_per_level || EXP_PER_LEVEL) || EXP_PER_LEVEL;
    var level = stats.level != null ? Number(stats.level) : Math.floor(totalExp / perLevel);
    var into = stats.exp_into_level != null ? Number(stats.exp_into_level) : totalExp % perLevel;
    setText("arcade-level-num", "LV " + level);
    setText("arcade-level-exp", into + " / " + perLevel + " EXP");
    var fill = document.getElementById("arcade-level-fill");
    if (fill) fill.style.width = Math.min(100, Math.round((into / perLevel) * 100)) + "%";
    var box = document.getElementById("arcade-level");
    if (box) box.setAttribute("aria-label", "Arcade level " + level + ", " + into + " of " + perLevel + " EXP");
  }

  /** The hero's four numbers for one game, from its stats and its plays. */
  function heroStats(id, gameStats, plays) {
    var mine = plays.filter(function (p) {
      return p.game === id;
    });
    var cleared = {};
    mine.forEach(function (p) {
      if (outcomeOf(p.item) === "win" && p.item.lesson_id) cleared[String(p.item.lesson_id)] = true;
    });
    var count = function (outcome) {
      return mine.filter(function (p) {
        return outcomeOf(p.item) === outcome;
      }).length;
    };
    var s = gameStats || {};
    if (id === "word-clash") {
      return [
        ["Battles", s.battles != null ? s.battles : mine.length],
        ["Wins", s.wins != null ? s.wins : count("win")],
        ["Best score", s.best_score || 0],
        ["Stages cleared", Object.keys(cleared).length],
      ];
    }
    return [
      ["Matches", s.matches != null ? s.matches : mine.length],
      ["Wins", s.wins != null ? s.wins : count("win")],
      ["Draws", s.draws != null ? s.draws : count("draw")],
      ["Lessons won", Object.keys(cleared).length],
    ];
  }

  function renderHeroStats(rows) {
    var dl = document.getElementById("arcade-stats");
    if (!dl) return;
    dl.innerHTML = rows
      .map(function (r) {
        var value = typeof r[1] === "number" ? fmtInt(r[1]) : r[1];
        return '<div class="arcade-stat"><dt>' + esc(r[0]) + "</dt><dd>" + esc(value) + "</dd></div>";
      })
      .join("");
  }

  var heroGame = "";

  /** Cover, name, description, Play link and stat labels of the hero's game. */
  function renderHeroGame(id) {
    if (heroGame === id) return;
    heroGame = id;
    var game = GAMES[id];
    var cover = document.getElementById("arcade-hero-cover");
    if (cover) {
      cover.className = "arcade-cover arcade-cover--" + game.cls + " arcade-hero-cover";
      cover.setAttribute("href", game.url);
      cover.innerHTML = game.cover(true);
    }
    setText("arcade-hero-title", game.name);
    setText("arcade-hero-desc", game.desc);
    var play = document.getElementById("arcade-hero-play");
    if (play) {
      play.setAttribute("href", game.url);
      play.setAttribute("aria-label", "Play " + game.name);
    }
    renderHeroStats(
      heroStats(id, null, []).map(function (r) {
        return [r[0], "–"];
      })
    );
    renderFighter();
  }

  function renderHero(stats, plays, historyOk) {
    var last = plays[0];
    var id = last ? last.game : heroGame || NEWEST_GAME;
    if (last) saveLastGame(id);
    renderHeroGame(id);
    var games = (stats && stats.games) || {};
    var rows = heroStats(id, games[id], plays);
    if (!historyOk) rows[3][1] = "–"; // cleared stages / lessons won come from the history
    renderHeroStats(rows);

    var lastEl = document.getElementById("arcade-hero-last");
    if (!historyOk) {
      setText("arcade-hero-eyebrow", "Continue playing");
      if (lastEl) lastEl.textContent = "Could not load your last game. Refresh to try again.";
      return;
    }
    if (!last) {
      setText("arcade-hero-eyebrow", "New game");
      if (lastEl) lastEl.textContent = GAMES[id].firstPlay;
      return;
    }
    setText("arcade-hero-eyebrow", "Continue playing");
    if (lastEl) {
      lastEl.innerHTML =
        "Last played: <strong>" +
        esc(lessonName(last.item)) +
        "</strong> · " +
        esc(timeAgo(last.item.timestamp)) +
        " · " +
        OUTCOME[outcomeOf(last.item)].label;
    }
  }

  /** The hero cover shows the fighter the student picked in the Arcade games. */
  function renderFighter() {
    var el = document.getElementById("arcade-hero-fighter");
    if (!el) return;
    var seed = "Aiden";
    try {
      seed = localStorage.getItem(CHARACTER_STORAGE_KEY) || seed;
    } catch (e) {
      /* keep default */
    }
    var img = document.createElement("img");
    img.alt = "";
    img.src = "https://api.dicebear.com/9.x/pixel-art/svg?seed=" + encodeURIComponent(seed);
    img.addEventListener("load", function () {
      el.textContent = "";
      el.appendChild(img);
    });
  }

  /* ---- Recent plays ---- */
  function renderRecent(plays, failed) {
    var list = document.getElementById("arcade-recent");
    if (!list) return;
    if (failed) {
      list.innerHTML = '<li class="arcade-list-note">Could not load your games. Refresh to try again.</li>';
      return;
    }
    if (!plays.length) {
      list.innerHTML = '<li class="arcade-list-note">No games yet. Your games will show up here.</li>';
      return;
    }
    list.innerHTML = plays
      .slice(0, RECENT_PLAYS)
      .map(function (p) {
        var b = p.item;
        var outcome = outcomeOf(b);
        var o = OUTCOME[outcome];
        var meta = [GAMES[p.game].name, b.subject_name, difficultyLabel(b.difficulty), timeAgo(b.timestamp)].filter(Boolean);
        var value = p.game === "word-clash" ? fmtInt(battleScore(b)) + " pts" : String(b.match_score || "");
        return (
          '<li class="arcade-row">' +
          '<span class="arcade-outcome is-' +
          outcome +
          '" role="img" aria-label="' +
          o.label +
          '" title="' +
          o.label +
          '"><i class="fa-solid ' +
          o.icon +
          '" aria-hidden="true"></i></span>' +
          '<span class="arcade-row-main"><span class="arcade-row-title">' +
          esc(lessonName(b)) +
          '</span><span class="arcade-row-meta">' +
          esc(meta.join(" · ")) +
          "</span></span>" +
          '<span class="arcade-row-value">' +
          esc(value) +
          "</span></li>"
        );
      })
      .join("");
  }

  /* ---- Top players ---- */
  function arcadeExp(e) {
    return Number(e.arcade_total_exp != null ? e.arcade_total_exp : e.battle_total_exp) || 0;
  }

  function arcadeLevel(e) {
    return Number(e.arcade_level != null ? e.arcade_level : e.battle_level) || 0;
  }

  function topPlayerRow(e, rank, isYou) {
    return (
      '<li class="arcade-row' +
      (isYou ? " is-you" : "") +
      '">' +
      '<span class="arcade-rank' +
      (rank <= 3 ? " is-" + rank : "") +
      '">' +
      rank +
      "</span>" +
      '<span class="arcade-row-main"><span class="arcade-row-title">' +
      esc(e.display_name || "Student") +
      (isYou ? '<span class="arcade-you">(you)</span>' : "") +
      '</span><span class="arcade-row-meta">' +
      fmtInt(arcadeExp(e)) +
      " EXP</span></span>" +
      '<span class="arcade-row-value">LV ' +
      fmtInt(arcadeLevel(e)) +
      "</span></li>"
    );
  }

  function renderTop(entries, failed) {
    var list = document.getElementById("arcade-top");
    if (!list) return;
    if (failed) {
      list.innerHTML = '<li class="arcade-list-note">Could not load the rankings. Refresh to try again.</li>';
      return;
    }
    var ranked = entries
      .filter(function (e) {
        return arcadeExp(e) > 0;
      })
      .sort(function (a, b) {
        return (
          arcadeLevel(b) - arcadeLevel(a) ||
          arcadeExp(b) - arcadeExp(a) ||
          Number(b.battle_best_score || 0) - Number(a.battle_best_score || 0)
        );
      });
    if (!ranked.length) {
      list.innerHTML = '<li class="arcade-list-note">No one has played yet. Be the first!</li>';
      return;
    }
    var me = studentId();
    var myIndex = -1;
    ranked.forEach(function (e, i) {
      if (me && String(e.id_number || "").trim() === me) myIndex = i;
    });
    var html = ranked
      .slice(0, TOP_PLAYERS)
      .map(function (e, i) {
        return topPlayerRow(e, i + 1, i === myIndex);
      })
      .join("");
    // Not in the top list: show where you are underneath.
    if (myIndex >= TOP_PLAYERS) {
      html += '<li class="arcade-gap" aria-hidden="true">⋮</li>' + topPlayerRow(ranked[myIndex], myIndex + 1, true);
    }
    list.innerHTML = html;
  }

  async function loadArcade() {
    renderGameCards();
    renderHeroGame(readLastGame() || NEWEST_GAME);
    var sid = studentId();
    if (!sid) {
      if (!session()) {
        window.location.href = "login.html";
        return;
      }
      renderRecent([], false);
      setText("arcade-hero-last", "Sign in with a student account to play.");
    }

    var q = "?student_id_number=" + encodeURIComponent(sid);
    var results = await Promise.allSettled([
      sid ? getJson("/student/arcade-stats" + q, true) : Promise.resolve({}),
      sid ? getJson("/student/learning-history" + q, true) : Promise.resolve({}),
      getJson("/student/leaderboard?limit=200", false),
    ]);
    var stats = results[0].status === "fulfilled" ? results[0].value || {} : {};
    var historyOk = results[1].status === "fulfilled";
    var plays = historyOk ? allPlays(results[1].value || {}) : [];

    renderLevel(stats);
    if (sid) {
      renderHero(stats, plays, historyOk);
      renderRecent(plays, !historyOk);
    }
    var boardOk = results[2].status === "fulfilled";
    renderTop(boardOk && Array.isArray(results[2].value.entries) ? results[2].value.entries : [], !boardOk);
  }

  document.addEventListener("DOMContentLoaded", function () {
    void loadArcade();
  });
})();
