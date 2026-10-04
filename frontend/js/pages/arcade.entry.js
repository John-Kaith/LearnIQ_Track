/**
 * Arcade (arcade.html) — the game library.
 *
 * Arcade level + Word Clash stats from /student/battle-stats, recent plays and
 * cleared stages from /student/learning-history (event "battle"), top players
 * from /student/leaderboard (ranked by Word Clash level, then EXP).
 * When more games exist, their events can carry metadata.game and the level
 * here becomes the total across games.
 */
(function () {
  "use strict";

  var EXP_PER_LEVEL = 100;
  var TOP_PLAYERS = 5;
  var RECENT_PLAYS = 5;
  var CHARACTER_STORAGE_KEY = "learniq-battle-character"; // shared with battle-arena.entry.js

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

  function isWin(item) {
    return String((item && item.outcome) || "").toLowerCase() === "win";
  }

  function battleScore(item) {
    return Number(item.score != null ? item.score : item.total_damage) || 0;
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

  function renderHero(stats, battles) {
    var cleared = {};
    battles.forEach(function (b) {
      if (isWin(b) && b.lesson_id) cleared[String(b.lesson_id)] = true;
    });
    setText("arcade-stat-battles", fmtInt(stats.battles != null ? stats.battles : battles.length));
    setText("arcade-stat-wins", fmtInt(stats.wins != null ? stats.wins : battles.filter(isWin).length));
    setText("arcade-stat-best", fmtInt(stats.best_score || 0));
    setText("arcade-stat-cleared", fmtInt(Object.keys(cleared).length));

    var last = battles[0];
    var lastEl = document.getElementById("arcade-hero-last");
    if (!last) {
      setText("arcade-hero-eyebrow", "New game");
      if (lastEl) lastEl.textContent = "You haven't played yet. Press Play to start your first battle!";
      return;
    }
    setText("arcade-hero-eyebrow", "Continue playing");
    if (lastEl) {
      lastEl.innerHTML =
        "Last played: <strong>" +
        esc(lessonName(last)) +
        "</strong> · " +
        esc(timeAgo(last.timestamp)) +
        " · " +
        (isWin(last) ? "Won" : "Lost");
    }
  }

  /** The hero cover shows the fighter the student picked in Word Clash. */
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
  function renderRecent(battles, failed) {
    var list = document.getElementById("arcade-recent");
    if (!list) return;
    if (failed) {
      list.innerHTML = '<li class="arcade-list-note">Could not load your games. Refresh to try again.</li>';
      return;
    }
    if (!battles.length) {
      list.innerHTML = '<li class="arcade-list-note">No games yet. Your battles will show up here.</li>';
      return;
    }
    list.innerHTML = battles
      .slice(0, RECENT_PLAYS)
      .map(function (b) {
        var won = isWin(b);
        var meta = ["Word Clash", b.subject_name, difficultyLabel(b.difficulty), timeAgo(b.timestamp)].filter(Boolean);
        var label = won ? "Won" : "Lost";
        return (
          '<li class="arcade-row">' +
          '<span class="arcade-outcome ' +
          (won ? "is-win" : "is-loss") +
          '" role="img" aria-label="' +
          label +
          '" title="' +
          label +
          '"><i class="fa-solid ' +
          (won ? "fa-trophy" : "fa-skull") +
          '" aria-hidden="true"></i></span>' +
          '<span class="arcade-row-main"><span class="arcade-row-title">' +
          esc(lessonName(b)) +
          '</span><span class="arcade-row-meta">' +
          esc(meta.join(" · ")) +
          "</span></span>" +
          '<span class="arcade-row-value">' +
          fmtInt(battleScore(b)) +
          " pts</span></li>"
        );
      })
      .join("");
  }

  /* ---- Top players ---- */
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
      '</span><span class="arcade-row-meta">Best ' +
      fmtInt(e.battle_best_score || 0) +
      " · " +
      fmtInt(e.battle_total_exp || 0) +
      " EXP</span></span>" +
      '<span class="arcade-row-value">LV ' +
      fmtInt(e.battle_level || 0) +
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
        return Number(e.battle_total_exp || 0) > 0;
      })
      .sort(function (a, b) {
        return (
          Number(b.battle_level || 0) - Number(a.battle_level || 0) ||
          Number(b.battle_total_exp || 0) - Number(a.battle_total_exp || 0) ||
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
    var sid = studentId();
    if (!sid) {
      if (!session()) {
        window.location.href = "login.html";
        return;
      }
      renderRecent([], false);
      setText("arcade-hero-last", "Sign in with a student account to play.");
    }
    renderFighter();

    var q = "?student_id_number=" + encodeURIComponent(sid);
    var results = await Promise.allSettled([
      sid ? getJson("/student/battle-stats" + q, true) : Promise.resolve({}),
      sid ? getJson("/student/learning-history" + q, true) : Promise.resolve({}),
      getJson("/student/leaderboard?limit=200", false),
    ]);
    var stats = results[0].status === "fulfilled" ? results[0].value || {} : {};
    var historyOk = results[1].status === "fulfilled";
    var battles = historyOk && Array.isArray(results[1].value.battle) ? results[1].value.battle : [];
    // Newest first (the server already sorts; keep it safe for cached lists).
    battles.sort(function (a, b) {
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    renderLevel(stats);
    if (sid) {
      renderHero(stats, battles);
      renderRecent(battles, !historyOk);
    }
    var boardOk = results[2].status === "fulfilled";
    renderTop(boardOk && Array.isArray(results[2].value.entries) ? results[2].value.entries : [], !boardOk);
  }

  document.addEventListener("DOMContentLoaded", function () {
    void loadArcade();
  });
})();
