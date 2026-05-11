const sampleAiData = {
  reviewer: [
    "Plate tectonics explains how Earth’s crust is broken into moving plates that shape continents and oceans.",
    "Volcanoes and earthquakes usually occur near plate boundaries where pressure and movement are strongest.",
    "Weathering, erosion, and deposition continuously reshape landforms over time."
  ],
  quiz: [
    {
      question: "Which layer of the Earth is broken into tectonic plates?",
      choices: ["Inner core", "Mantle", "Lithosphere", "Outer core"],
      answer: "Lithosphere"
    },
    {
      question: "What usually forms at convergent plate boundaries?",
      choices: ["Mountain ranges", "River deltas", "Sand dunes", "Coral reefs"],
      answer: "Mountain ranges"
    },
    {
      question: "Which process moves rock fragments from one place to another?",
      choices: ["Weathering", "Erosion", "Melting", "Compaction"],
      answer: "Erosion"
    }
  ],
  activities: [
    "Create a labeled diagram showing the three main plate boundary types.",
    "Answer the 10-item quiz challenge and compare scores with your classmates.",
    "Write a reflection on how natural hazards affect communities in the Philippines."
  ]
};

function escapeHtml(text) {
  if (text == null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

async function readApiJson(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = result.error;
    const msg =
      typeof err === "string"
        ? err
        : err != null
        ? JSON.stringify(err)
        : response.statusText || "Request failed";
    throw new Error(msg);
  }
  if (result && Object.prototype.hasOwnProperty.call(result, "error") && result.error != null) {
    const err = result.error;
    throw new Error(typeof err === "string" ? err : JSON.stringify(err));
  }
  return result;
}

/**
 * Backend URL for fetch(). Empty string = same origin (when FastAPI serves the frontend on :8000).
 * Override: localStorage.setItem("learniq-api-base", "http://127.0.0.1:9000")
 */
function getApiBase() {
  if (typeof window === "undefined") return "";
  const custom = localStorage.getItem("learniq-api-base");
  if (custom && custom.trim()) return custom.trim().replace(/\/$/, "");
  const { protocol, hostname, port } = window.location;
  if (protocol === "file:") return "http://127.0.0.1:8000";
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1";
  if (!isLocal) return "";
  if (port === "8000") return "";
  return "http://127.0.0.1:8000";
}

function apiUrl(path) {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (!container.children.length) container.remove();
  }, 2800);
}

function animateProgressBars() {
  document.querySelectorAll(".progress-bar span[data-progress], .progress-bar span[style]").forEach((bar) => {
    const width = bar.dataset.progress || bar.style.width || "0%";
    bar.style.width = width;
  });
}

const authStorageKey = "learniq-accounts";
const authSessionKey = "learniq-current-user";

function getUserInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function setCurrentUserSession(user) {
  console.log("Saving user session:", user);
  console.log("User role:", user.role);
  
  const safeUser = {
    id: user.id,
    id_number: user.id_number,
    email: user.email,
    full_name: user.full_name,
    role: user.role || "student",
    approval_status: user.approval_status || "approved",
    access_token: user.access_token,
    refresh_token: user.refresh_token
  };
  
  console.log("Session stored:", safeUser);
  sessionStorage.setItem(authSessionKey, JSON.stringify(safeUser));
  console.log("SessionStorage check:", sessionStorage.getItem(authSessionKey));
}

function getCurrentUserSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(authSessionKey) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** User chip in student sidebar (dashboard-shell pages that skip setupStudentDashboard). */
function hydrateStudentSidebarChip() {
  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  if (!nameEl && !initialsEl && !trackEl) return;
  const user = getCurrentUserSession();
  const full = user && user.full_name ? String(user.full_name).trim() : "";
  const roleGuess = user && user.role ? String(user.role).trim().toLowerCase() : "";
  const defaultName = roleGuess === "teacher" ? "Teacher" : "Student";
  if (nameEl) nameEl.textContent = full || (user && user.email) || defaultName;
  if (initialsEl) initialsEl.textContent = user ? getUserInitials(full || (user.email || "")) : roleGuess === "teacher" ? "TC" : "ST";
  if (trackEl) {
    if (user && user.id_number) {
      trackEl.textContent = `ID ${user.id_number}`;
    } else if (user && user.email) {
      trackEl.textContent = String(user.email).trim();
    } else {
      trackEl.textContent = "";
    }
  }
}

/** Admin sidebar chip (pages under admin-*.html with #admin-sidebar-* ids). */
function hydrateAdminSidebarFromSession() {
  const nameEl = document.getElementById("admin-sidebar-name");
  const roleEl = document.getElementById("admin-sidebar-role");
  const avatarEl = document.getElementById("admin-sidebar-avatar");
  if (!nameEl && !roleEl && !avatarEl) return;
  const user = getCurrentUserSession();
  if (!user) return;
  const full = String(user.full_name || "").trim();
  const roleRaw = String(user.role || "admin").trim().toLowerCase();
  const roleLabel =
    roleRaw === "admin" ? "Admin / Principal" : roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1) : "Admin";
  if (nameEl) nameEl.textContent = full || String(user.email || "").trim() || "Admin";
  if (roleEl) roleEl.textContent = roleLabel;
  if (avatarEl) avatarEl.textContent = getUserInitials(full || String(user.email || "")) || "AD";
}

function learniqPreviewName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "Student";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const ini = last.length ? `${last[0].toUpperCase()}.` : "";
  return `${parts[0]} ${ini}`.trim();
}

async function initLearniqDashboardIfPresent() {
  const pointsEl = document.getElementById("dashboard-stat-points");
  if (!pointsEl) return;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const u = getCurrentUserSession();
  if (!u?.access_token) {
    setText("dashboard-stat-points", "0");
    setText("dashboard-stat-week", "Sign in to see your stats");
    setText("dashboard-stat-rank", "—");
    setText("dashboard-stat-rank-note", "Leaderboard uses quiz scores");
    setText("dashboard-stat-progress-pct", "0%");
    const sp0 = document.getElementById("dashboard-progress-span");
    if (sp0) {
      sp0.dataset.progress = "0%";
      sp0.style.width = "0%";
    }
    setText("dash-lesson-line", "—");
    setText("dash-quiz-line", "—");
    setText("dash-week-line", "—");
    const ul0 = document.getElementById("dashboard-leaderboard-mini");
    if (ul0) ul0.innerHTML = '<li class="small-note">Sign in to load the board.</li>';
    return;
  }

  try {
    const res = await fetch(apiUrl("/student/dashboard-stats"), { headers: immersionAuthHeaders() });
    const d = await readApiJson(res);
    pointsEl.textContent = Number(d.total_points || 0).toLocaleString();
    setText("dashboard-stat-week", d.points_week_note || "");
    const rank = d.leaderboard_rank;
    setText("dashboard-stat-rank", rank != null ? `#${rank}` : "—");
    setText("dashboard-stat-rank-note", d.rank_note || "");
    const pct = Number(d.progress_pct || 0);
    const pctLabel = `${Number.isFinite(pct) ? pct.toFixed(1) : "0.0"}%`;
    setText("dashboard-stat-progress-pct", pctLabel);
    const bar = document.getElementById("dashboard-progress-span");
    if (bar) {
      bar.dataset.progress = pctLabel;
      bar.style.width = pctLabel;
    }
    const pub = Number(d.published_lessons_count || 0);
    const practiced = Number(d.lessons_practiced || 0);
    setText("dash-lesson-line", `${practiced} / ${pub}`);
    setText("dash-quiz-line", String(d.quiz_attempts != null ? d.quiz_attempts : "0"));
    setText("dash-week-line", Number(d.points_this_week || 0).toLocaleString());

    const ul = document.getElementById("dashboard-leaderboard-mini");
    if (ul) {
      const prev = Array.isArray(d.leaderboard_preview) ? d.leaderboard_preview : [];
      if (!prev.length) {
        ul.innerHTML =
          '<li class="small-note">No rankings yet. Finish a scored quiz in My lesson to appear here.</li>';
      } else {
        ul.innerHTML = prev
          .map(
            (e) =>
              `<li><strong>${escapeHtml(String(e.rank))}. ${escapeHtml(
                learniqPreviewName(e.full_name)
              )}</strong> <small>${Number(e.total_points || 0).toLocaleString()} pts</small></li>`
          )
          .join("");
      }
    }
    animateProgressBars();
  } catch (e) {
    console.error("dashboard-stats:", e);
    setText("dashboard-stat-points", "0");
    setText("dashboard-stat-week", "Could not load stats");
    setText("dashboard-stat-rank", "—");
    setText("dashboard-stat-rank-note", "Try refreshing the page");
    setText("dashboard-stat-progress-pct", "0%");
    const sp = document.getElementById("dashboard-progress-span");
    if (sp) {
      sp.dataset.progress = "0%";
      sp.style.width = "0%";
    }
    setText("dash-lesson-line", "—");
    setText("dash-quiz-line", "—");
    setText("dash-week-line", "—");
    const ulE = document.getElementById("dashboard-leaderboard-mini");
    if (ulE) ulE.innerHTML = '<li class="small-note">Rankings unavailable.</li>';
  }
}

/** Teacher LearnIQ — Student Performance tiles from /teacher/dashboard-stats.student_performance */
function hydrateTeacherDashboardStudentPerformance(d, opts) {
  const hint = document.getElementById("teacher-performance-hint");
  const topEl = document.getElementById("teacher-perf-top-value");
  const topDetail = document.getElementById("teacher-perf-top-detail");
  const attCount = document.getElementById("teacher-perf-attention-count");
  const attDetail = document.getElementById("teacher-perf-attention-detail");
  const compPct = document.getElementById("teacher-perf-completion-pct");
  const compDetail = document.getElementById("teacher-perf-completion-detail");
  if (!topEl || !topDetail || !attCount || !compPct || !compDetail || !attDetail) return;

  const showHint = (msg) => {
    if (!hint) return;
    if (msg) {
      hint.hidden = false;
      hint.textContent = msg;
    } else {
      hint.hidden = true;
      hint.textContent = "";
    }
  };

  if (opts && opts.signedOut) {
    showHint("Sign in to load student performance.");
    topEl.textContent = "—";
    topDetail.textContent = "";
    attCount.textContent = "—";
    compPct.textContent = "—";
    compDetail.textContent = "This month";
    return;
  }

  if ((opts && opts.error) || !d || typeof d !== "object") {
    showHint("Could not load student performance.");
    topEl.textContent = "—";
    topDetail.textContent = "Try refreshing the page";
    attCount.textContent = "—";
    compPct.textContent = "—";
    compDetail.textContent = "This month";
    return;
  }

  showHint("");

  const sp = d.student_performance;
  if (!sp || !sp.scope_student_count) {
    topEl.textContent = "—";
    topDetail.textContent = "No student quiz data on your lessons yet";
    attCount.textContent = "0 students";
    attDetail.textContent = "Below 70% avg";
    compPct.textContent = "—";
    compDetail.textContent = "No cohort yet";
    return;
  }

  const name = sp.top_name;
  const idn = sp.top_id_number;
  const tpct = sp.top_pct;
  if (name) {
    const safe = escapeHtml(String(name));
    if (idn) {
      const href = `student-profile.html?id_number=${encodeURIComponent(String(idn))}`;
      topEl.innerHTML = `<a href="${href}" class="teacher-performance-name-link" aria-label="Open student profile">${safe}</a>`;
    } else {
      topEl.textContent = String(name);
    }
  } else {
    topEl.textContent = "—";
  }

  if (tpct != null && Number.isFinite(Number(tpct))) {
    topDetail.textContent = `${Number(tpct).toFixed(1)}% quiz average`;
  } else {
    topDetail.textContent = "No average yet";
  }

  const na = Number(sp.needs_attention_count || 0);
  attCount.textContent = `${na} student${na === 1 ? "" : "s"}`;
  attDetail.textContent = "Below 70% avg";

  const part = sp.participation_pct;
  if (part != null && Number.isFinite(Number(part))) {
    compPct.textContent = `${Number(part).toFixed(0)}%`;
    compDetail.textContent = "Quiz-taking students active this month";
  } else {
    compPct.textContent = "—";
    compDetail.textContent = "This month";
  }
}

/** Teacher LearnIQ dashboard stat cards (Bearer + role teacher). */
async function initTeacherLearniqDashboardStatsIfPresent() {
  const lessonsEl = document.getElementById("teacher-stat-lessons");
  if (!lessonsEl) return;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const u = getCurrentUserSession();
  if (!u?.access_token) {
    setText("teacher-stat-lessons", "—");
    setText("teacher-stat-lessons-note", "Sign in to load stats");
    setText("teacher-stat-students", "—");
    setText("teacher-stat-students-note", "—");
    setText("teacher-stat-avg", "—");
    setText("teacher-stat-avg-note", "—");
    hydrateTeacherDashboardStudentPerformance(null, { signedOut: true });
    return;
  }

  try {
    const res = await fetch(apiUrl("/teacher/dashboard-stats"), { headers: immersionAuthHeaders() });
    const d = await readApiJson(res);
    setText("teacher-stat-lessons", String(d.lessons_uploaded != null ? d.lessons_uploaded : "0"));
    setText("teacher-stat-lessons-note", d.lessons_uploaded_note || "");
    setText("teacher-stat-students", String(d.active_students != null ? d.active_students : "0"));
    setText("teacher-stat-students-note", d.active_students_note || "");
    const pct = d.avg_quiz_score_pct;
    setText(
      "teacher-stat-avg",
      pct != null && Number.isFinite(Number(pct)) ? `${Number(pct).toFixed(1)}%` : "—",
    );
    setText("teacher-stat-avg-note", d.avg_quiz_note || "");
    hydrateTeacherDashboardStudentPerformance(d);
  } catch (e) {
    console.error("teacher/dashboard-stats:", e);
    setText("teacher-stat-lessons", "—");
    setText("teacher-stat-lessons-note", "Could not load stats");
    setText("teacher-stat-students", "—");
    setText("teacher-stat-students-note", "—");
    setText("teacher-stat-avg", "—");
    setText("teacher-stat-avg-note", "Try refreshing the page");
    hydrateTeacherDashboardStudentPerformance(null, { error: true });
  }
}

function setupLeaderboardPage() {
  const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  if (!path.includes("leaderboard.html")) return;

  hydrateStudentSidebarChip();

  const emptyEl = document.getElementById("leaderboard-empty");
  const populatedEl = document.getElementById("leaderboard-populated");
  const podiumEl = document.getElementById("leaderboard-podium");
  const tbody = document.getElementById("leaderboard-table-body");
  const liveLine = document.getElementById("leaderboard-live-line");
  const tableNote = document.getElementById("leaderboard-table-note");
  const emptyTitle = document.getElementById("leaderboard-empty-title");
  const emptyBody = document.getElementById("leaderboard-empty-body");
  const emptyCta = document.getElementById("leaderboard-empty-cta");
  const retryBtn = document.getElementById("leaderboard-retry-btn");
  const refreshBtn = document.getElementById("leaderboard-refresh-btn");

  const fmtInt = (n) => Number(n).toLocaleString();
  const fmtPct = (x) => {
    const v = Number(x);
    return `${Number.isFinite(v) ? v.toFixed(1) : "0.0"}%`;
  };

  function defaultEmptyCopy() {
    if (emptyTitle) emptyTitle.textContent = "No rankings yet";
    if (emptyBody) {
      emptyBody.innerHTML =
        "When students complete quizzes in <strong>My lesson</strong>, scores appear here. Be the first on the board.";
    }
    if (emptyCta) emptyCta.hidden = false;
    if (retryBtn) retryBtn.hidden = true;
  }

  function errorEmptyCopy(msg) {
    if (emptyTitle) emptyTitle.textContent = "Could not load rankings";
    if (emptyBody) emptyBody.textContent = msg || "Check that the API is running and Supabase is configured.";
    if (emptyCta) emptyCta.hidden = true;
    if (retryBtn) retryBtn.hidden = false;
  }

  function renderPodium(entries) {
    if (!podiumEl) return;
    const slots = [
      { podiumClass: "second", rank: 2, dataIndex: 1, hint: "Second place is open — keep practicing." },
      { podiumClass: "first", rank: 1, dataIndex: 0, hint: "Complete a quiz to claim the top spot." },
      { podiumClass: "third", rank: 3, dataIndex: 2, hint: "Third place awaits — every quiz counts." },
    ];
    podiumEl.innerHTML = slots
      .map(({ podiumClass, rank, dataIndex, hint }) => {
        const e = entries[dataIndex];
        if (!e) {
          return `<article class="glass-card top-rank-card ${podiumClass} is-leaderboard-placeholder">
            <div class="rank-badge">#${rank}</div>
            <h3>—</h3>
            <p>Open</p>
            <small>${escapeHtml(hint)}</small>
          </article>`;
        }
        return `<article class="glass-card top-rank-card ${podiumClass}">
          <div class="rank-badge">#${e.rank}</div>
          <h3>${escapeHtml(e.full_name || "Student")}</h3>
          <p>${fmtInt(e.total_points)} points</p>
          <small>${escapeHtml(e.tagline || "")}</small>
        </article>`;
      })
      .join("");
  }

  function renderTable(entries, currentIdNumber) {
    if (!tbody) return;
    const cur = (currentIdNumber || "").trim();
    tbody.innerHTML = entries
      .map((e) => {
        const idn = (e.id_number || "").trim();
        const isYou = cur && idn && idn === cur;
        return `<tr class="${isYou ? "leaderboard-row-you" : ""}">
          <td>#${e.rank}</td>
          <td>${escapeHtml(e.full_name || "Student")}${isYou ? ' <span class="small-note">(you)</span>' : ""}</td>
          <td>${fmtInt(e.total_points)}</td>
          <td>${fmtInt(e.quiz_attempts)}</td>
          <td>${fmtPct(e.progress_pct)}</td>
        </tr>`;
      })
      .join("");
  }

  async function refresh() {
    if (liveLine) liveLine.textContent = "Updating…";
    try {
      const res = await fetch(apiUrl("/student/leaderboard?limit=50"));
      const data = await readApiJson(res);
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const updated = data.updated_at;

      defaultEmptyCopy();

      if (liveLine) {
        if (updated) {
          const d = new Date(updated);
          const t = !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(updated);
          liveLine.textContent = `Last updated: ${t} · Auto-refresh every 45s`;
        } else {
          liveLine.textContent = "Live from quiz submissions";
        }
      }

      if (tableNote) {
        tableNote.textContent =
          entries.length === 0
            ? "No submitted quiz attempts yet."
            : `Showing ${entries.length} student${entries.length === 1 ? "" : "s"} · Sorted by total points, then accuracy.`;
      }

      if (entries.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        if (populatedEl) populatedEl.hidden = true;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        if (populatedEl) populatedEl.hidden = false;
        renderPodium(entries);
        const u = getCurrentUserSession();
        renderTable(entries, u && u.id_number ? String(u.id_number) : "");
      }
    } catch (e) {
      console.error("leaderboard:", e);
      errorEmptyCopy(e?.message || "Request failed.");
      if (liveLine) liveLine.textContent = "Could not refresh rankings.";
      if (emptyEl) emptyEl.hidden = false;
      if (populatedEl) populatedEl.hidden = true;
    }
  }

  emptyCta?.addEventListener("click", () => {
    window.location.href = "subjects.html";
  });
  retryBtn?.addEventListener("click", () => {
    defaultEmptyCopy();
    refresh();
  });
  refreshBtn?.addEventListener("click", () => refresh());

  refresh();
  setInterval(refresh, 45_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

function immersionAuthHeaders() {
  const u = getCurrentUserSession();
  const headers = { "Content-Type": "application/json" };
  if (u && u.access_token) {
    headers.Authorization = `Bearer ${u.access_token}`;
  }
  return headers;
}

async function hydrateSidebarProfileFromDatabase() {
  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  const linkEl = document.getElementById("student-profile-chip-link") || document.getElementById("teacher-profile-chip-link");
  if (!nameEl && !initialsEl && !trackEl && !linkEl) return;

  const u = getCurrentUserSession();
  if (!u?.access_token) return;

  try {
    const res = await fetch(apiUrl("/me"), { headers: immersionAuthHeaders() });
    const p = await readApiJson(res);
    const full = p && p.full_name ? String(p.full_name).trim() : "";
    const email = p && p.email ? String(p.email).trim() : "";
    const idn = p && p.id_number ? String(p.id_number).trim() : "";
    const showName = full || email || "User";

    if (nameEl) nameEl.textContent = showName;
    if (initialsEl) initialsEl.textContent = getUserInitials(full || email);
    if (trackEl) trackEl.textContent = idn ? `ID ${idn}` : "";
    if (linkEl && idn) linkEl.href = `student-profile.html?id_number=${encodeURIComponent(idn)}`;
  } catch (e) {
    console.error("me:", e);
  }
}

function fmtImmersionClock(iso) {
  if (!iso) return "--:--";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function fmtImmersionDurationLabel(timeInIso, timeOutIso) {
  if (!timeInIso) return "0h 0m";
  const a = new Date(timeInIso).getTime();
  const b = timeOutIso ? new Date(timeOutIso).getTime() : Date.now();
  let mins = Math.max(0, Math.floor((b - a) / 60000));
  const h = Math.floor(mins / 60);
  mins %= 60;
  return `${h}h ${mins}m`;
}

/** Local YYYY-MM-DD for "today" cards (matches user's calendar day). */
function immersionTodayKeyLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function immersionRowDayKey(row) {
  if (!row || typeof row !== "object") return "";
  if (row.date) return String(row.date).slice(0, 10);
  if (row.time_in) return String(row.time_in).slice(0, 10);
  return "";
}

/** Most recent attendance row for the local calendar day (for summary when not clocked in). */
function immersionPickTodayRow(history, todayKey) {
  if (!Array.isArray(history) || !todayKey) return null;
  const sameDay = history.filter((r) => immersionRowDayKey(r) === todayKey);
  if (!sameDay.length) return null;
  sameDay.sort((a, b) => String(b.time_in || "").localeCompare(String(a.time_in || "")));
  return sameDay[0];
}

async function setupImmersionDashboard() {
  const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  if (!path.includes("immersion-dashboard.html")) return;

  const user = getCurrentUserSession();
  if (!user || !user.access_token || !user.id_number) {
    window.location.href = "login.html";
    return;
  }

  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  const full = (user.full_name && String(user.full_name).trim()) || "";
  if (nameEl && full) nameEl.textContent = full;
  if (initialsEl) initialsEl.textContent = getUserInitials(full || user.email || "");
  if (trackEl && user.id_number) trackEl.textContent = `ID ${user.id_number}`;
  void hydrateSidebarProfileFromDatabase();

  const timeInBtn = document.getElementById("time-in-btn");
  const timeOutBtn = document.getElementById("time-out-btn");
  const statusText = document.getElementById("time-status-text");
  const timeInDisplay = document.getElementById("time-in-display");
  const timeOutDisplay = document.getElementById("time-out-display");
  const durationDisplay = document.getElementById("duration-display");
  const listEl = document.getElementById("recent-attendance-list");

  let durationTimer = null;

  async function refreshAttendanceUi() {
    let data;
    try {
      const res = await fetch(apiUrl("/attendance-history?limit=40"), { headers: immersionAuthHeaders() });
      data = await readApiJson(res);
    } catch (e) {
      console.error("attendance-history:", e);
      showToast(e?.message || "Could not load attendance. Check login and API URL.", "error");
      return;
    }
    const active = data.active || null;
    const todayKey = immersionTodayKeyLocal();
    const todayRow = immersionPickTodayRow(data.history, todayKey);

    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }

    if (active && active.time_in) {
      if (statusText) statusText.textContent = "Clocked In";
      if (timeInDisplay) timeInDisplay.textContent = fmtImmersionClock(active.time_in);
      if (timeOutDisplay) timeOutDisplay.textContent = "--:--";
      if (durationDisplay) durationDisplay.textContent = fmtImmersionDurationLabel(active.time_in, null);
      if (timeInBtn) timeInBtn.disabled = true;
      if (timeOutBtn) timeOutBtn.disabled = false;
      const t0 = active.time_in;
      durationTimer = setInterval(() => {
        if (durationDisplay) durationDisplay.textContent = fmtImmersionDurationLabel(t0, null);
      }, 30_000);
    } else if (todayRow && todayRow.time_in) {
      const done = todayRow.time_out && String(todayRow.time_out).trim() !== "";
      if (statusText) statusText.textContent = done ? "Session complete" : "Clocked In";
      if (timeInDisplay) timeInDisplay.textContent = fmtImmersionClock(todayRow.time_in);
      if (timeOutDisplay) {
        timeOutDisplay.textContent = done ? fmtImmersionClock(todayRow.time_out) : "--:--";
      }
      if (durationDisplay) {
        if (todayRow.total_hours != null && todayRow.total_hours !== "" && done) {
          const th = Number(todayRow.total_hours);
          if (!Number.isNaN(th)) {
            const m = Math.round(th * 60);
            durationDisplay.textContent = `${Math.floor(m / 60)}h ${m % 60}m`;
          } else {
            durationDisplay.textContent = fmtImmersionDurationLabel(todayRow.time_in, todayRow.time_out);
          }
        } else {
          durationDisplay.textContent = fmtImmersionDurationLabel(todayRow.time_in, todayRow.time_out);
        }
      }
      if (timeInBtn) timeInBtn.disabled = !done;
      if (timeOutBtn) timeOutBtn.disabled = done;
      if (!done) {
        const t0 = todayRow.time_in;
        durationTimer = setInterval(() => {
          if (durationDisplay) durationDisplay.textContent = fmtImmersionDurationLabel(t0, null);
        }, 30_000);
      }
    } else {
      if (statusText) statusText.textContent = "Not Clocked In";
      if (timeInDisplay) timeInDisplay.textContent = "--:--";
      if (timeOutDisplay) timeOutDisplay.textContent = "--:--";
      if (durationDisplay) durationDisplay.textContent = "0h 0m";
      if (timeInBtn) timeInBtn.disabled = false;
      if (timeOutBtn) timeOutBtn.disabled = true;
    }

    if (listEl && Array.isArray(data.history)) {
      const rows = data.history.slice(0, 10);
      listEl.innerHTML = rows.length
        ? rows
            .map((r) => {
              const st = String(r.status || "").toLowerCase();
              const badgeClass = st === "active" ? "active" : st === "completed" ? "completed" : "warning";
              const day =
                r.date ||
                (r.time_in ? String(r.time_in).slice(0, 10) : "—");
              const tIn = fmtImmersionClock(r.time_in);
              const tOut = r.time_out ? fmtImmersionClock(r.time_out) : "--";
              const sub =
                st === "active"
                  ? "Currently in session"
                  : r.total_hours != null && r.total_hours !== ""
                  ? `${Number(r.total_hours).toFixed(2)} hours`
                  : "—";
              return `<li class="time-log-item">
              <div>
                <strong>${escapeHtml(day)}</strong>
                <span class="small-note">Time In: ${escapeHtml(tIn)} | Time Out: ${escapeHtml(tOut)}</span>
              </div>
              <span class="status-badge ${badgeClass}">${escapeHtml(sub)}</span>
            </li>`;
            })
            .join("")
        : `<li class="time-log-item"><div><span class="small-note">No attendance logs yet. Tap Time In to start.</span></div></li>`;
    }
  }

  async function loadJournals() {
    const box = document.getElementById("recent-journal-list");
    if (!box) return;
    try {
      const res = await fetch(apiUrl("/journals"), { headers: immersionAuthHeaders() });
      const entries = await readApiJson(res);
      const arr = Array.isArray(entries) ? entries : [];
      box.innerHTML = arr.length
        ? arr
            .slice(0, 12)
            .map((j) => {
              const when = j.submitted_at || j.created_at || "";
              const content = j.body || j.journal_text || "";
              const d = when ? new Date(when) : null;
              return `<article class="journal-entry">
              <div class="journal-header">
                <strong>${escapeHtml(d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : "—")}</strong>
                <span class="small-note">${escapeHtml(fmtImmersionClock(when))}</span>
              </div>
              <p class="journal-content">${escapeHtml(content)}</p>
            </article>`;
            })
            .join("")
        : '<p class="small-note">No journal entries yet.</p>';
    } catch (e) {
      box.innerHTML = `<p class="small-note">${escapeHtml(e?.message || "Could not load journals.")}</p>`;
    }
  }

  timeInBtn?.addEventListener("click", async () => {
    try {
      const res = await fetch(apiUrl("/time-in"), {
        method: "POST",
        headers: immersionAuthHeaders(),
        body: "{}",
      });
      await readApiJson(res);
      showToast("Time In recorded.", "success");
      await refreshAttendanceUi();
    } catch (e) {
      showToast(e?.message || "Time In failed.", "error");
    }
  });

  timeOutBtn?.addEventListener("click", async () => {
    try {
      const res = await fetch(apiUrl("/time-out"), {
        method: "POST",
        headers: immersionAuthHeaders(),
        body: "{}",
      });
      await readApiJson(res);
      showToast("Time Out recorded.", "success");
      await refreshAttendanceUi();
    } catch (e) {
      showToast(e?.message || "Time Out failed.", "error");
    }
  });

  document.getElementById("journal-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const bodyEl = document.getElementById("journal-body");
    const dateEl = document.getElementById("journal-date");
    const text = (bodyEl && bodyEl.value.trim()) || "";
    if (!text) {
      showToast("Write something in your journal first.", "error");
      return;
    }
    try {
      const payload = { body: text };
      if (dateEl && dateEl.value) payload.entry_date = dateEl.value;
      const res = await fetch(apiUrl("/journals"), {
        method: "POST",
        headers: immersionAuthHeaders(),
        body: JSON.stringify(payload),
      });
      await readApiJson(res);
      showToast("Journal saved.", "success");
      if (bodyEl) bodyEl.value = "";
      await loadJournals();
    } catch (e) {
      showToast(e?.message || "Could not save journal.", "error");
    }
  });

  await refreshAttendanceUi();
  await loadJournals();
}

const sampleUsers = [
  {
    fullName: "Maria Santos",
    idNumber: "2024-10001",
    email: "maria.santos@school.edu",
    password: "StudentPass1",
    role: "Student",
    status: "Pending",
    createdDate: "Mar 25, 2024"
  },
  {
    fullName: "Jose dela Cruz",
    idNumber: "2024-10002",
    email: "jose.delacruz@school.edu",
    password: "StudentPass2",
    role: "Student",
    status: "Approved",
    createdDate: "Mar 16, 2024"
  },
  {
    fullName: "Anna Reyes",
    idNumber: "2024-10003",
    email: "anna.reyes@school.edu",
    password: "StudentPass3",
    role: "Student",
    status: "Rejected",
    createdDate: "Mar 18, 2024"
  },
  {
    fullName: "Teacher Ronaldo",
    idNumber: "TEACH-01",
    email: "ronaldo@school.edu",
    password: "TeacherPass1",
    role: "Teacher",
    status: "Approved",
    createdDate: "Feb 08, 2024"
  },
  {
    fullName: "Teacher Miriam",
    idNumber: "TEACH-02",
    email: "miriam@school.edu",
    password: "TeacherPass2",
    role: "Teacher",
    status: "Approved",
    createdDate: "Mar 01, 2024"
  },
  {
    fullName: "Principal Cruz",
    idNumber: "ADMIN-01",
    email: "principal@school.edu",
    password: "AdminPass1",
    role: "Admin",
    status: "Approved",
    createdDate: "Dec 01, 2023"
  }
];

function getStoredUsers() {
  // Disabled: Use real Supabase authentication instead
  return [];
}

function saveUsers(users) {
  // Disabled: Use real Supabase authentication instead
  console.log("localStorage auth disabled - using Supabase instead");
}

function ensureSampleUsers() {
  // Disabled: Use real Supabase authentication instead
  return [];
}

/** Fallback if /admin/stats is unavailable; matches Supabase role / approval_status shape. */
function getAdminDashboardStatsFromUsers(users) {
  const role = (u) => String(u.role || "").trim().toLowerCase();
  const status = (u) => String(u.approval_status || u.status || "pending").trim().toLowerCase();
  const totalStudents = users.filter((u) => role(u) === "student").length;
  const totalTeachers = users.filter((u) => role(u) === "teacher").length;
  const pendingApprovals = users.filter(
    (u) => status(u) === "pending" && (role(u) === "student" || role(u) === "teacher")
  ).length;
  const approvedAccounts = users.filter((u) => status(u) === "approved").length;
  const rejectedAccounts = users.filter((u) => status(u) === "rejected").length;
  return { totalStudents, totalTeachers, pendingApprovals, approvedAccounts, rejectedAccounts };
}

async function renderMetrics() {
  const empty = {
    totalStudents: 0,
    totalTeachers: 0,
    pendingApprovals: 0,
    approvedAccounts: 0,
    rejectedAccounts: 0,
    uploadedFilesCount: 0,
    activeUsersToday: 0,
  };
  try {
    const statsRes = await fetch(apiUrl("/admin/stats"));
    if (statsRes.ok) {
      const d = await statsRes.json().catch(() => ({}));
      if (d && d.error) throw new Error(typeof d.error === "string" ? d.error : "Admin stats error");
      updateMetricsDisplay({
        totalStudents: d.total_students ?? 0,
        totalTeachers: d.total_teachers ?? 0,
        pendingApprovals: d.pending_approvals ?? 0,
        approvedAccounts: d.approved_accounts ?? 0,
        rejectedAccounts: d.rejected_accounts ?? 0,
        uploadedFilesCount: d.uploaded_files ?? 0,
        activeUsersToday: d.active_users_today ?? 0,
      });
      return;
    }

    const [usersRes, lessonsRes] = await Promise.all([fetch(apiUrl("/users")), fetch(apiUrl("/lessons"))]);
    let uploadedFilesCount = 0;
    if (lessonsRes.ok) {
      const lessonData = await lessonsRes.json();
      uploadedFilesCount =
        typeof lessonData.count === "number" ? lessonData.count : (lessonData.lessons || []).length;
    }
    if (!usersRes.ok) {
      updateMetricsDisplay({ ...empty, uploadedFilesCount });
      return;
    }
    const users = await usersRes.json();
    const stats = getAdminDashboardStatsFromUsers(users);
    updateMetricsDisplay({ ...stats, uploadedFilesCount, activeUsersToday: 0 });
  } catch (error) {
    console.error("Failed to fetch admin metrics:", error);
    updateMetricsDisplay(empty);
  }
}

function updateMetricsDisplay(stats) {
  document.getElementById("metric-total-students").textContent = stats.totalStudents;
  document.getElementById("metric-total-teachers").textContent = stats.totalTeachers;
  document.getElementById("metric-pending-approvals").textContent = stats.pendingApprovals;
  document.getElementById("metric-approved-accounts").textContent = stats.approvedAccounts;
  document.getElementById("metric-rejected-accounts").textContent = stats.rejectedAccounts;
  const uploadedEl = document.getElementById("metric-uploaded-files");
  if (uploadedEl) uploadedEl.textContent = stats.uploadedFilesCount ?? 0;
  const activeEl = document.getElementById("metric-active-users");
  if (activeEl) activeEl.textContent = stats.activeUsersToday ?? 0;
  document.getElementById("chart-pending").dataset.progress = `${Math.min(100, Math.round((stats.pendingApprovals / Math.max(1, stats.totalStudents + stats.totalTeachers)) * 100))}%`;
  document.getElementById("chart-approved").dataset.progress = `${Math.min(100, Math.round((stats.approvedAccounts / Math.max(1, stats.totalStudents + stats.totalTeachers)) * 100))}%`;
  document.getElementById("chart-rejected").dataset.progress = `${Math.min(100, Math.round((stats.rejectedAccounts / Math.max(1, stats.totalStudents + stats.totalTeachers)) * 100))}%`;
  animateProgressBars();
}

function formatAdminActivityTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return d.toISOString().slice(0, 16);
  }
}

async function refreshAdminRecentActivity() {
  const list = document.getElementById("recent-activity-list");
  if (!list) return;
  list.innerHTML = '<li><span class="small-note">Loading…</span></li>';
  try {
    const res = await fetch(apiUrl("/admin/recent-activity"));
    if (!res.ok) throw new Error("activity");
    const data = await res.json().catch(() => ({}));
    if (data.error) {
      throw new Error(typeof data.error === "string" ? data.error : "activity");
    }
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      list.innerHTML =
        '<li><span class="small-note">No recent activity yet. Registrations, lesson uploads, and quiz attempts will appear here.</span></li>';
      return;
    }
    list.innerHTML = items
      .map(
        (item) => `
        <li>
          <strong>${escapeHtml(item.title || "—")}</strong>
          <small>${escapeHtml(item.detail || "")}</small>
          <span class="metric-note">${escapeHtml(formatAdminActivityTime(item.timestamp))}</span>
        </li>
      `
      )
      .join("");
  } catch (e) {
    console.error("refreshAdminRecentActivity:", e);
    list.innerHTML =
      '<li><span class="small-note">Could not load activity. Check that you are signed in and the API is running.</span></li>';
  }
}

function renderRecentActivity() {
  void refreshAdminRecentActivity();
}

function approveAllPending() {
  const users = ensureSampleUsers();
  const updated = users.map((user) =>
    user.status === "Pending" ? { ...user, status: "Approved" } : user
  );
  saveUsers(updated);
  renderAdminTable(document.querySelector("#admin-search")?.value || "");
  renderMetrics();
  showToast("All pending students have been approved.", "success");
}

function exportReports() {
  showToast("Admin reports exported successfully.", "info");
}

function uploadDashboardFile(file) {
  if (!file) return;
  void refreshAdminRecentActivity();
  showToast(`Uploaded ${file.name}`, "success");
}

function setupDashboardActions() {
  document.getElementById("approve-all-btn")?.addEventListener("click", approveAllPending);
  document.getElementById("export-reports-btn")?.addEventListener("click", exportReports);
  document.getElementById("view-students-btn")?.addEventListener("click", () => {
    document.getElementById("admin-table")?.scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("upload-file-btn")?.addEventListener("click", () => {
    document.getElementById("dashboard-upload-input")?.click();
  });
  document.getElementById("sidebar-logout")?.addEventListener("click", logoutAdmin);
  document.getElementById("refresh-dashboard")?.addEventListener("click", async () => {
    await renderMetrics();
    await refreshAdminRecentActivity();
    showToast("Dashboard refreshed.", "success");
  });
  document.getElementById("dashboard-upload-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    uploadDashboardFile(file);
    event.target.value = "";
  });
}

function renderSystemStatus() {
  const grid = document.querySelector(".wide-status-grid");
  if (!grid) return;
  void (async () => {
    const badges = grid.querySelectorAll(".status-card .status-badge");
    const setBadge = (i, text, online) => {
      const b = badges[i];
      if (!b) return;
      b.textContent = text;
      b.classList.remove("online", "warning");
      b.classList.add(online ? "online" : "warning");
    };
    try {
      const res = await fetch(apiUrl("/health"));
      const h = await res.json().catch(() => ({}));
      setBadge(0, h.has_api_key ? "Ready" : "API key unset", Boolean(h.has_api_key));
      setBadge(1, h.has_supabase ? "Connected" : "Not configured", Boolean(h.has_supabase));
      setBadge(2, "Not tracked", false);
      setBadge(3, h.ok ? "Healthy" : "Check server", Boolean(h.ok));
    } catch {
      setBadge(0, "Unknown", false);
      setBadge(1, "Unknown", false);
      setBadge(2, "Not tracked", false);
      setBadge(3, "Unknown", false);
    }
  })();
}

function showAuthMessage(message, element, type = "info") {
  if (!element) return;
  element.style.display = "block";
  element.textContent = message;
  element.style.background =
    type === "success"
      ? "rgba(34, 197, 94, 0.12)"
      : type === "error"
      ? "rgba(239, 68, 68, 0.12)"
      : "rgba(96, 165, 250, 0.08)";
  element.style.border =
    type === "success"
      ? "1px solid rgba(34, 197, 94, 0.2)"
      : type === "error"
      ? "1px solid rgba(239, 68, 68, 0.2)"
      : "1px solid rgba(96, 165, 250, 0.18)";
}

function setupForms() {
  document.querySelectorAll(".demo-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      showToast("Demo UI ready for backend authentication.", "success");
    });
  });
}

function setupRoleSelection() {
  const roleCards = document.querySelectorAll(".role-card");
  const signupHeading = document.getElementById("signup-heading");
  const idLabel = document.getElementById("id-label");
  
  // Default to student selection
  if (roleCards.length > 0) {
    roleCards[0].classList.add("selected");
  }
  
  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      // Remove selected class from all cards
      roleCards.forEach(c => c.classList.remove("selected"));
      
      // Add selected class to clicked card
      card.classList.add("selected");
      
      // Update UI based on selected role
      const role = card.dataset.role;
      
      if (role === "teacher") {
        if (signupHeading) signupHeading.textContent = "Teacher registration";
        if (idLabel) idLabel.textContent = "Teacher ID / Employee ID";
      } else {
        if (signupHeading) signupHeading.textContent = "Student registration";
        if (idLabel) idLabel.textContent = "Student ID Number";
      }
    });
  });
}

function setupSignupPage() {
  const signupForm = document.querySelector("#signup-form");
  const signupMessage = document.querySelector("#signup-message");
  if (!signupForm) return;

  // Setup role selection
  setupRoleSelection();

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signupMessage) return;

    const fullName = document.querySelector("#signup-name").value.trim();
    const idNumber = document.querySelector("#signup-id").value.trim();
    const email = document.querySelector("#signup-email").value.trim().toLowerCase();
    const password = document.querySelector("#signup-password").value;
    const confirmPassword = document.querySelector("#signup-confirm").value;
    
    // Get selected role
    const selectedRole = document.querySelector(".role-card.selected");
    if (!selectedRole) {
      showAuthMessage("Please select an account type.", signupMessage, "error");
      return;
    }
    const role = selectedRole.dataset.role;

    if (!fullName || !idNumber || !email || !password || !confirmPassword) {
      showAuthMessage("All fields are required.", signupMessage, "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Confirm password must match.", signupMessage, "error");
      return;
    }

    try {
      // Call backend registration endpoint (now uses Supabase Auth)
      const response = await fetch(apiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          id_number: idNumber,
          email: email,
          password: password,
          role: role
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Registration failed");
      }

      const result = await response.json();
      signupForm.reset();
      showAuthMessage(result.message || "Your account is pending approval by the Admin/Principal.", signupMessage, "success");
      showToast("Student registration submitted for review.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", signupMessage, "error");
      showToast(`Registration failed: ${error.message}`, "error");
    }
  });
}

function setupLoginPage() {
  console.log("SETUP LOGIN PAGE RUNNING");
  console.log("CURRENT PATHNAME:", window.location.pathname);
  console.log("SCRIPT LOADED, SETUP LOGIN PAGE INVOKED");
  const form = document.getElementById("login-form");
  console.log("LOGIN FORM:", form);
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  
  if (!loginForm) {
    console.error("Login form not found!");
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    console.log("LOGIN SUBMIT DETECTED");
    event.preventDefault();
    console.log("event.preventDefault() executed");

    const email = document.querySelector("#login-email").value.trim().toLowerCase();
    const password = document.querySelector("#login-password").value;
    const endpointUrl = apiUrl("/login");
    const payload = {
      email: email,
      password: password
    };
    console.log("STARTING LOGIN FETCH");
    console.log("LOGIN EMAIL:", email);
    console.log("LOGIN PAYLOAD:", payload);
    console.log("LOGIN ENDPOINT URL:", endpointUrl);

    if (!email || !password) {
      const errorMsg = "Email and password are required.";
      if (loginMessage) {
        showAuthMessage(errorMsg, loginMessage, "error");
      } else {
        alert(errorMsg);
      }
      return;
    }

    try {
      // Call backend login endpoint (now uses Supabase Auth)
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error || error.message || "Login failed";
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("LOGIN RESPONSE:", result);
      const user = result.user;
      
      if (!user) {
        throw new Error("Invalid response format: missing user data");
      }
      
      const successMessage =
        user.role === "admin"
          ? "Welcome Admin. Redirecting to approval dashboard..."
          : user.role === "teacher"
          ? "Welcome Teacher. Redirecting to teacher dashboard..."
          : "Login successful. Redirecting to student dashboard...";
      
      console.log("SAVING SESSION:", user);
      setCurrentUserSession(user);
      console.log("SESSION CHECK AFTER SAVE:", sessionStorage.getItem(authSessionKey));
      showAuthMessage(successMessage, loginMessage, "success");
      showToast(successMessage, "success");
      
      setTimeout(() => {
        console.log("REDIRECT BLOCK REACHED");
        console.log("USER ROLE:", user.role);
        try {
          if (window.LearnIQTheme && typeof window.LearnIQTheme.set === "function") {
            const themeFromDom =
              document.documentElement.getAttribute("data-theme") === "light"
                ? "light"
                : "dark";
            window.LearnIQTheme.set(themeFromDom);
          }
        } catch (_) {
          /* keep redirect even if theme sync fails */
        }
        if (user.role === "admin") {
          window.location.href = "admin-approval.html";
        } else if (user.role === "teacher") {
          window.location.href = "teacher-learniq-dashboard.html";
        } else if (user.role === "student") {
          window.location.href = "module-selection.html";
        } else {
          window.location.href = "login.html";
        }
      }, 1000);
    } catch (error) {
      const errorMsg = error.message || "Login failed. Please try again.";
      if (loginMessage) {
        showAuthMessage(errorMsg, loginMessage, "error");
      } else {
        alert(errorMsg);
      }
      showToast(`Login failed: ${errorMsg}`, "error");
    }
  });
}

function setupForgotPasswordPage() {
  const forgotForm = document.querySelector("#forgot-password-form");
  const forgotMessage = document.querySelector("#forgot-message");
  if (!forgotForm) return;

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!forgotMessage) return;

    const email = document.querySelector("#forgot-email").value.trim().toLowerCase();

    if (!email) {
      showAuthMessage("Email is required.", forgotMessage, "error");
      return;
    }

    try {
      // Call backend forgot password endpoint
      const response = await fetch(apiUrl("/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Password reset request failed");
      }

      const result = await response.json();
      forgotForm.reset();
      showAuthMessage(result.message, forgotMessage, "success");
      showToast("Password reset instructions sent to your email.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Password reset failed. Please try again.", forgotMessage, "error");
      showToast(`Password reset failed: ${error.message}`, "error");
    }
  });
}

function togglePassword(inputId, button) {
  const passwordInput = document.getElementById(inputId);
  const icon = button.querySelector('i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function formatStatusBadge(status) {
  const cls = status === "Approved" ? "online" : status === "Rejected" ? "warning" : "";
  return `<span class="status-badge ${cls}">${escapeHtml(status)}</span>`;
}

async function renderAdminTable(filter = "") {
  const tableBody = document.querySelector("#admin-table-body");
  if (!tableBody) return;

  try {
    const response = await fetch(apiUrl("/users"));
    if (!response.ok) {
      tableBody.innerHTML = `<tr><td colspan="7">Failed to load users from server.</td></tr>`;
      return;
    }
    
    const users = await response.json();
    const filterValue = filter.trim().toLowerCase();

    const rows = users
      .filter((user) =>
        !filterValue ||
        (user.full_name && user.full_name.toLowerCase().includes(filterValue)) ||
        (user.id_number && user.id_number.toLowerCase().includes(filterValue))
      )
      .map((user) => {
        const actions = (user.role === "student" || user.role === "teacher") && user.approval_status === "pending" ?
          `<div class="table-actions">
            <button class="btn btn-secondary" data-action="approve" data-id="${user.id_number}">Approve</button>
            <button class="btn btn-ghost" data-action="reject" data-id="${user.id_number}">Reject</button>
          </div>` :
          "—";

        return `
          <tr>
            <td>${user.full_name || "N/A"}</td>
            <td>${user.id_number || "N/A"}</td>
            <td>${user.email || "N/A"}</td>
            <td>${user.role || "N/A"}</td>
            <td>${formatStatusBadge(user.approval_status || "pending")}</td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
            <td>${actions}</td>
          </tr>
        `;
      });

    tableBody.innerHTML = rows.join("") || `<tr><td colspan="7">No matching student registrations found.</td></tr>`;
  } catch (error) {
    console.error("Failed to render admin table:", error);
    tableBody.innerHTML = `<tr><td colspan="7">Error loading user data.</td></tr>`;
  }
}

/** Clear session and go to login. Optional confirm body copy (student / teacher / admin). */
function confirmAndLogout(confirmMessage) {
  const message =
    confirmMessage ||
    "Are you sure you want to log out? You will need to sign in again to continue.";
  const proceed = function () {
    sessionStorage.clear();
    showToast("Logged out successfully.", "info");
    setTimeout(function () {
      window.location.href = "login.html";
    }, 350);
  };

  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    window.LearnIQConfirm.show({
      title: "Log out?",
      message,
      confirmText: "Log out",
      cancelText: "Cancel",
    }).then(function (ok) {
      if (ok) proceed();
    });
    return;
  }

  if (confirm(message)) proceed();
}

function logoutAdmin() {
  confirmAndLogout(
    "Are you sure you want to log out? You will need to sign in again to access the admin panel."
  );
}

function setupAdminNavigation() {
  // Handle hash-based navigation
  const sections = {
    '': 'dashboard',
    'approvals': 'approvals',
    'users': 'users', 
    'ai-results': 'ai-results',
    'files': 'files',
    'leaderboard': 'leaderboard',
    'attendance': 'attendance',
    'journals': 'journals',
    'reports': 'reports',
    'settings': 'settings'
  };

  function showSection(sectionId) {
    // Hide all sections
    Object.keys(sections).forEach(hash => {
      const section = document.getElementById(hash || 'dashboard');
      if (section) section.style.display = 'none';
    });

    // Show selected section or default dashboard
    const targetSection = document.getElementById(sectionId === 'dashboard' ? '' : sectionId) || 
                         document.querySelector('.dashboard-grid') ||
                         document.querySelector('section[class*="glass-card"]');
    
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    // Update active sidebar link
    document.querySelectorAll('.side-links a').forEach(link => {
      link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.side-links a[href*="${sectionId}"]`) ||
                      document.querySelector('.side-links a[href="admin-approval.html"]');
    if (activeLink) activeLink.classList.add('active');

    // Load section-specific data
    loadSectionData(sectionId);
  }

  function loadSectionData(sectionId) {
    switch(sectionId) {
      case 'approvals':
        loadPendingApprovals();
        break;
      case 'users':
        loadAllUsers();
        break;
      case 'ai-results':
        loadAIResults();
        break;
      case 'files':
        loadUploadedFiles();
        break;
      case 'leaderboard':
        loadLeaderboard();
        break;
      case 'attendance':
        loadAttendanceLogs();
        break;
      case 'journals':
        loadJournals();
        break;
      case 'reports':
        loadReports();
        break;
      case 'settings':
        loadSettings();
        break;
    }
  }

  // Handle initial hash
  const hash = window.location.hash.slice(1);
  showSection(hash || 'dashboard');

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    showSection(hash || 'dashboard');
  });

  // Handle sidebar clicks
  document.querySelectorAll('.side-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      // Phase 1 migration: allow real page navigation for separated admin pages.
      // Keep hash-switching only for in-dashboard sections.
      if (href && !href.includes('#') && href !== 'admin-approval.html') {
        return; // allow normal navigation
      }
      e.preventDefault();
      const hash = href.includes('#') ? href.split('#')[1] : '';
      window.location.hash = hash;
      showSection(hash || 'dashboard');
    });
  });
}

/** Tab: "pending" | "approved" | "rejected" | "total" — set via `window.__studentApprovalsTab` on Student Approvals page. */
async function loadPendingApprovals() {
  const tableBody = document.querySelector("#approval-table-body");
  if (!tableBody) return;

  const status = String(window.__studentApprovalsTab || "pending")
    .toLowerCase()
    .trim();
  const safeStatus =
    status === "approved" || status === "rejected" || status === "total" ? status : "pending";
  window.__studentApprovalsTab = safeStatus;

  const searchEl = document.querySelector("#approval-search");
  const q = (searchEl?.value || "").trim().toLowerCase();

  try {
    const response = await fetch(apiUrl("/users"));
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="6">Failed to load students.</td></tr>';
      return;
    }

    const users = await response.json();
    let students = users.filter((u) => String(u.role || "").toLowerCase() === "student");
    if (safeStatus !== "total") {
      students = students.filter(
        (u) => String(u.approval_status || "pending").toLowerCase() === safeStatus
      );
    }

    if (q) {
      students = students.filter((u) => {
        const blob = `${u.full_name || ""} ${u.id_number || ""} ${u.email || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }

    const rows = students
      .map((user) => {
        const idNum = String(user.id_number || "").trim();
        const encId = encodeURIComponent(idNum);
        const nameBtn = idNum
          ? `<button type="button" class="teacher-profile-name-btn" data-profile-id="${encId}" title="View profile from Supabase">${escapeHtml(
              user.full_name || "N/A"
            )}</button>`
          : escapeHtml(user.full_name || "N/A");
        const stRaw = String(user.approval_status || "pending").toLowerCase();
        const stLabel = stRaw ? stRaw.charAt(0).toUpperCase() + stRaw.slice(1) : "Pending";
        const statusCell = formatStatusBadge(stLabel);
        const showActions =
          safeStatus === "pending" || (safeStatus === "total" && stRaw === "pending");
        const actions = showActions
          ? `<div class="table-actions">
            <button type="button" class="btn btn-secondary" data-action="approve" data-id="${escapeHtml(
              idNum
            )}">Approve</button>
            <button type="button" class="btn btn-ghost" data-action="reject" data-id="${escapeHtml(
              idNum
            )}">Reject</button>
          </div>`
          : '<span class="small-note">—</span>';
        return `
      <tr>
        <td>${nameBtn}</td>
        <td>${escapeHtml(user.id_number || "N/A")}</td>
        <td>${escapeHtml(user.email || "N/A")}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
        <td>${statusCell}</td>
        <td>${actions}</td>
      </tr>`;
      })
      .join("");

    const emptyMsg =
      safeStatus === "pending"
        ? "No pending student registrations."
        : safeStatus === "approved"
        ? "No approved students."
        : safeStatus === "rejected"
        ? "No rejected students."
        : "No student profiles in the database.";
    tableBody.innerHTML = rows || `<tr><td colspan="6">${emptyMsg}</td></tr>`;
  } catch (error) {
    console.error("Failed to load student approvals:", error);
    tableBody.innerHTML = '<tr><td colspan="6">Error loading data.</td></tr>';
  }
}

/** Tab: "pending" | "approved" | "rejected" | "total" — set via `window.__teacherApprovalsTab` before calling. */
async function loadTeacherApprovals() {
  const tableBody = document.querySelector("#teacher-approval-table-body");
  if (!tableBody) return;

  const status = String(window.__teacherApprovalsTab || "pending")
    .toLowerCase()
    .trim();
  const safeStatus =
    status === "approved" || status === "rejected" || status === "total" ? status : "pending";
  window.__teacherApprovalsTab = safeStatus;

  const searchEl = document.querySelector("#teacher-approval-search");
  const q = (searchEl?.value || "").trim().toLowerCase();

  try {
    const response = await fetch(apiUrl("/users"));
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="6">Failed to load teachers.</td></tr>';
      return;
    }

    const users = await response.json();
    let teachers = users.filter((u) => String(u.role || "").toLowerCase() === "teacher");
    if (safeStatus !== "total") {
      teachers = teachers.filter(
        (u) => String(u.approval_status || "pending").toLowerCase() === safeStatus
      );
    }

    if (q) {
      teachers = teachers.filter((u) => {
        const blob = `${u.full_name || ""} ${u.id_number || ""} ${u.email || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }

    const rows = teachers
      .map((user) => {
        const idNum = String(user.id_number || "").trim();
        const encId = encodeURIComponent(idNum);
        const nameBtn = idNum
          ? `<button type="button" class="teacher-profile-name-btn" data-profile-id="${encId}" title="View profile from Supabase">${escapeHtml(
              user.full_name || "N/A"
            )}</button>`
          : escapeHtml(user.full_name || "N/A");
        const stRaw = String(user.approval_status || "pending").toLowerCase();
        const stLabel = stRaw ? stRaw.charAt(0).toUpperCase() + stRaw.slice(1) : "Pending";
        const statusCell = formatStatusBadge(stLabel);
        const showActions =
          safeStatus === "pending" || (safeStatus === "total" && stRaw === "pending");
        const actions = showActions
          ? `<div class="table-actions">
            <button type="button" class="btn btn-secondary" data-action="approve" data-id="${escapeHtml(
              idNum
            )}">Approve</button>
            <button type="button" class="btn btn-ghost" data-action="reject" data-id="${escapeHtml(
              idNum
            )}">Reject</button>
          </div>`
          : '<span class="small-note">—</span>';
        return `
      <tr>
        <td>${nameBtn}</td>
        <td>${escapeHtml(user.id_number || "N/A")}</td>
        <td>${escapeHtml(user.email || "N/A")}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
        <td>${statusCell}</td>
        <td>${actions}</td>
      </tr>`;
      })
      .join("");

    const emptyMsg =
      safeStatus === "pending"
        ? "No pending teacher registrations."
        : safeStatus === "approved"
        ? "No approved teachers."
        : safeStatus === "rejected"
        ? "No rejected teachers."
        : "No teacher profiles in the database.";
    tableBody.innerHTML = rows || `<tr><td colspan="6">${emptyMsg}</td></tr>`;
  } catch (error) {
    console.error("Failed to load teacher approvals:", error);
    tableBody.innerHTML = '<tr><td colspan="6">Error loading data.</td></tr>';
  }
}

/** Which profile preview modal exists on the current page (teacher vs student approvals). */
function getAdminProfilePreviewModalEls() {
  const teacherBackdrop = document.getElementById("teacher-profile-modal");
  if (teacherBackdrop) {
    return {
      backdrop: teacherBackdrop,
      body: document.getElementById("teacher-profile-modal-body"),
      title: document.getElementById("teacher-profile-modal-title"),
    };
  }
  const studentBackdrop = document.getElementById("student-profile-modal");
  return {
    backdrop: studentBackdrop,
    body: document.getElementById("student-profile-modal-body"),
    title: document.getElementById("student-profile-modal-title"),
  };
}

function closeAdminProfilePreviewModal() {
  const t = document.getElementById("teacher-profile-modal");
  const s = document.getElementById("student-profile-modal");
  if (t) t.hidden = true;
  if (s) s.hidden = true;
  document.removeEventListener("keydown", adminProfilePreviewModalOnKey);
}

function adminProfilePreviewModalOnKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeAdminProfilePreviewModal();
  }
}

function formatTeacherProfileModalRow(label, valueHtml) {
  return `<dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd>`;
}

/** Loads `GET /admin/profile/{id_number}` into the approvals profile modal on this page. */
async function openAdminProfilePreviewModal(idNumber, titleText) {
  const { backdrop, body, title } = getAdminProfilePreviewModalEls();
  if (!backdrop || !body) return;

  const id = String(idNumber || "").trim();
  if (!id) return;

  if (title && titleText) title.textContent = titleText;

  backdrop.hidden = false;
  body.innerHTML = '<p class="small-note" style="margin:0;">Loading profile…</p>';
  document.removeEventListener("keydown", adminProfilePreviewModalOnKey);
  document.addEventListener("keydown", adminProfilePreviewModalOnKey);

  try {
    const res = await fetch(apiUrl(`/admin/profile/${encodeURIComponent(id)}`));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : res.statusText || "Request failed";
      body.innerHTML = `<p class="small-note" style="margin:0;color:#fb923c;">${escapeHtml(msg)}</p>`;
      return;
    }
    const p = data;
    const created = p.created_at ? new Date(p.created_at).toLocaleString() : "—";
    const role = String(p.role || "—").trim() || "—";
    const roleLabel = role !== "—" ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "—";
    const ap = String(p.approval_status || "pending").toLowerCase();
    const apLabel = ap ? ap.charAt(0).toUpperCase() + ap.slice(1) : "Pending";
    body.innerHTML = `
      <dl class="teacher-profile-modal-dl">
        ${formatTeacherProfileModalRow("Full name", escapeHtml(p.full_name || "—"))}
        ${formatTeacherProfileModalRow("ID number", escapeHtml(p.id_number || "—"))}
        ${formatTeacherProfileModalRow("Email", escapeHtml(p.email || "—"))}
        ${formatTeacherProfileModalRow("Role", escapeHtml(roleLabel))}
        ${formatTeacherProfileModalRow("Approval", formatStatusBadge(apLabel))}
        ${formatTeacherProfileModalRow("Profile UUID", escapeHtml(p.id ? String(p.id) : "—"))}
        ${formatTeacherProfileModalRow("Created", escapeHtml(created))}
      </dl>`;
  } catch (e) {
    console.error("openAdminProfilePreviewModal:", e);
    body.innerHTML = `<p class="small-note" style="margin:0;color:#fb923c;">${escapeHtml(
      e.message || "Could not load profile."
    )}</p>`;
  }
}

function closeTeacherProfileModal() {
  closeAdminProfilePreviewModal();
}

async function openTeacherProfileModal(idNumber) {
  return openAdminProfilePreviewModal(idNumber, "Teacher profile");
}

// Admin Users page state — cached full list + active role tab + search term.
// Allows tab switching + search filtering without re-hitting the server.
let adminUsersCache = [];
let adminUsersRoleFilter = "all";
let adminUsersSearchTerm = "";

function renderAdminUsersTable() {
  const tableBody = document.querySelector('#users-table-body');
  if (!tableBody) return;

  const term = (adminUsersSearchTerm || "").trim().toLowerCase();
  const role = (adminUsersRoleFilter || "all").toLowerCase();

  const filtered = adminUsersCache.filter((u) => {
    if (role !== "all") {
      if (String(u.role || "").trim().toLowerCase() !== role) return false;
    }
    if (!term) return true;
    const hay = [
      u.full_name,
      u.first_name,
      u.last_name,
      u.id_number,
      u.email,
      u.role,
      u.approval_status,
    ]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return hay.includes(term);
  });

  if (!filtered.length) {
    const msg = adminUsersCache.length
      ? "No users match the current filter."
      : "No users found.";
    tableBody.innerHTML = `<tr><td colspan="6">${msg}</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered
    .map(
      (user) => `
      <tr>
        <td>${escapeHtml(user.full_name || 'N/A')}</td>
        <td>${escapeHtml(user.id_number || 'N/A')}</td>
        <td>${escapeHtml(user.email || 'N/A')}</td>
        <td>${escapeHtml(user.role || 'N/A')}</td>
        <td>${formatStatusBadge(user.approval_status || 'pending')}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
      </tr>
    `
    )
    .join('');
}

function updateAdminUsersTabCounts() {
  const counts = { all: 0, student: 0, teacher: 0 };
  for (const u of adminUsersCache) {
    counts.all += 1;
    const r = String(u.role || "").trim().toLowerCase();
    if (r === "student") counts.student += 1;
    else if (r === "teacher") counts.teacher += 1;
  }
  const ids = {
    all: "users-tab-count-all",
    student: "users-tab-count-student",
    teacher: "users-tab-count-teacher",
  };
  for (const key of Object.keys(ids)) {
    const el = document.getElementById(ids[key]);
    if (el) el.textContent = String(counts[key]);
  }
}

function setAdminUsersRoleFilter(role) {
  adminUsersRoleFilter = (role || "all").toLowerCase();
  document.querySelectorAll("[data-users-role-tab]").forEach((btn) => {
    const isActive = btn.getAttribute("data-users-role-tab") === adminUsersRoleFilter;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderAdminUsersTable();
}

function setAdminUsersSearchTerm(term) {
  adminUsersSearchTerm = String(term || "");
  renderAdminUsersTable();
}

// Expose admin-users helpers on window so the page entry file (a separate
// script) can always reach them no matter the cross-script timing.
window.setAdminUsersRoleFilter = setAdminUsersRoleFilter;
window.setAdminUsersSearchTerm = setAdminUsersSearchTerm;
window.renderAdminUsersTable = renderAdminUsersTable;
window.loadAllUsers = loadAllUsers;

// Self-mounting: as soon as the Admin Users page DOM is ready, wire up the
// tab + search + reset event listeners. This makes the page work even if
// the page-specific entry file (admin-users.entry.js) has not yet attached
// its own handlers, and is idempotent (data-users-handlers-bound guard).
function setupAdminUsersPageHandlers() {
  const tabsHost = document.querySelector(".workspace-tabs[aria-label='Filter users by role']");
  if (!tabsHost) return; // not on the Admin Users page
  if (tabsHost.dataset.usersHandlersBound === "1") return;
  tabsHost.dataset.usersHandlersBound = "1";

  document.querySelectorAll("[data-users-role-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-users-role-tab") || "all";
      setAdminUsersRoleFilter(role);
    });
  });

  const searchInput = document.getElementById("users-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      setAdminUsersSearchTerm(e.target.value);
    });
  }

  document.getElementById("users-reset")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    setAdminUsersSearchTerm("");
    setAdminUsersRoleFilter("all");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupAdminUsersPageHandlers, { once: true });
} else {
  setupAdminUsersPageHandlers();
}

async function loadAllUsers() {
  const tableBody = document.querySelector('#users-table-body');
  if (!tableBody) return;

  try {
    const response = await fetch(apiUrl("/users"));
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="6">Failed to load users.</td></tr>';
      return;
    }
    const users = await response.json();
    adminUsersCache = Array.isArray(users) ? users : [];
    updateAdminUsersTabCounts();
    renderAdminUsersTable();
  } catch (error) {
    console.error('Failed to load all users:', error);
    tableBody.innerHTML = '<tr><td colspan="6">Error loading data.</td></tr>';
  }
}

async function loadAIResults() {
  const grid = document.querySelector("#ai-results-grid");
  if (!grid) return;

  const emptyHtml = `
    <div class="empty-state">
      <i class="fa-solid fa-robot"></i>
      <h3>No AI Content Yet</h3>
      <p>No lessons have reviewer text, quizzes, or activities yet. Teachers generate these from uploaded files.</p>
    </div>
  `;

  try {
    const response = await fetch(apiUrl("/lessons"));
    if (!response.ok) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const data = await response.json();
    const lessons = data.lessons || [];
    const withAi = lessons.filter(
      (l) => l.has_reviewer || (Number(l.quiz_count) > 0) || l.has_activities
    );
    if (!withAi.length) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const cards = withAi
      .map((l) => {
        const bits = [];
        if (l.has_reviewer) bits.push("Reviewer");
        if (Number(l.quiz_count) > 0) bits.push(`Quiz (${l.quiz_count})`);
        if (l.has_activities) bits.push("Activities");
        const published = l.is_published || l.published;
        return `
          <article class="glass-card fade-up" style="padding:1rem 1.15rem;">
            <h4 style="margin:0 0 0.35rem;">${escapeHtml(l.filename || "Lesson")}</h4>
            <p class="small-note" style="margin:0 0 0.5rem;">Teacher: ${escapeHtml(l.teacher_id_number || "—")}</p>
            <p class="small-note" style="margin:0 0 0.75rem;">${escapeHtml(bits.join(" · ") || "—")}</p>
            <span class="status-badge ${published ? "online" : "warning"}">${published ? "Published" : "Draft"}</span>
          </article>
        `;
      })
      .join("");
    grid.innerHTML = `<div class="content-grid">${cards}</div>`;
  } catch (e) {
    console.error("loadAIResults:", e);
    grid.innerHTML = emptyHtml;
  }
}

async function loadUploadedFiles() {
  const tableBody = document.querySelector('#files-table-body');
  if (!tableBody) return;

  try {
    const response = await fetch(apiUrl("/lessons"));
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="6">Failed to load files.</td></tr>';
      return;
    }

    const data = await response.json();
    const lessons = data.lessons || [];

    const rows = lessons.map(lesson => `
      <tr>
        <td>${lesson.filename || 'N/A'}</td>
        <td>${lesson.teacher_id_number || 'N/A'}</td>
        <td>${lesson.file_type || 'N/A'}</td>
        <td>${lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : 'N/A'}</td>
        <td>${lesson.is_published ? '<span class="status-badge online">Published</span>' : '<span class="status-badge warning">Draft</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost" data-action="view" data-id="${lesson.file_id}">View</button>
          </div>
        </td>
      </tr>
    `).join('');

    tableBody.innerHTML = rows || '<tr><td colspan="6">No uploaded files found.</td></tr>';
  } catch (error) {
    console.error('Failed to load uploaded files:', error);
    tableBody.innerHTML = '<tr><td colspan="6">Error loading data.</td></tr>';
  }
}

async function loadLeaderboard() {
  const list = document.querySelector('#leaderboard-list');
  if (!list) return;

  const emptyHtml = `
    <div class="empty-state">
      <i class="fa-solid fa-ranking-star"></i>
      <h3>No Quiz Results Yet</h3>
      <p>Students need to complete quizzes to appear on the leaderboard.</p>
    </div>
  `;

  try {
    const response = await fetch(apiUrl("/student/leaderboard"));
    if (!response.ok) {
      list.innerHTML = emptyHtml;
      return;
    }
    const data = await response.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];

    if (!entries.length) {
      list.innerHTML = emptyHtml;
      return;
    }

    const rows = entries
      .map(
        (e) =>
          `<tr>
            <td>${escapeHtml(String(e.rank ?? "—"))}</td>
            <td>${escapeHtml(e.full_name || "Student")}</td>
            <td>${escapeHtml(String(e.total_points ?? 0))}</td>
            <td>${escapeHtml(String(e.quiz_attempts ?? 0))}</td>
            <td>${escapeHtml(String(e.progress_pct ?? 0))}%</td>
          </tr>`
      )
      .join("");
    list.innerHTML = `
      <div class="table-overflow">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Points</th>
              <th>Attempts</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error("loadLeaderboard:", error);
    list.innerHTML = emptyHtml;
  }
}

async function loadAttendanceLogs() {
  const tableBody = document.querySelector("#attendance-table-body");
  if (!tableBody) return;

  const emptyRow = '<tr><td colspan="4">No attendance records yet.</td></tr>';
  try {
    const response = await fetch(apiUrl("/admin/attendance-logs"));
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="4">Could not load attendance logs.</td></tr>';
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.error) {
      tableBody.innerHTML = `<tr><td colspan="4">${escapeHtml(String(data.error))}</td></tr>`;
      return;
    }
    const logs = Array.isArray(data.logs) ? data.logs : [];
    if (!logs.length) {
      tableBody.innerHTML = emptyRow;
      return;
    }
    tableBody.innerHTML = logs
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.student_display || "—")}</td>
        <td>${escapeHtml(row.date_display || "—")}</td>
        <td>${escapeHtml(row.status || "—")}</td>
        <td>${escapeHtml(row.notes || "—")}</td>
      </tr>`
      )
      .join("");
  } catch (e) {
    console.error("loadAttendanceLogs:", e);
    tableBody.innerHTML = '<tr><td colspan="4">Error loading attendance.</td></tr>';
  }
}

async function loadJournals() {
  const grid = document.querySelector("#journal-grid");
  if (!grid) return;

  const emptyHtml = `
    <div class="empty-state">
      <i class="fa-solid fa-book"></i>
      <h3>No Journal Submissions Yet</h3>
      <p>Journal entries from students will show here.</p>
    </div>
  `;

  try {
    const response = await fetch(apiUrl("/admin/journals-feed"));
    if (!response.ok) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.error) {
      grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(String(data.error))}</p></div>`;
      return;
    }
    const journals = Array.isArray(data.journals) ? data.journals : [];
    if (!journals.length) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const cards = journals
      .map((j) => {
        const when = j.submitted_at ? formatAdminActivityTime(j.submitted_at) : "—";
        const body = (j.body || "").trim();
        const preview = body.length > 280 ? `${body.slice(0, 280)}…` : body;
        return `
          <article class="glass-card fade-up" style="padding:1rem 1.15rem;">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.5rem;">
              <strong>${escapeHtml(j.student_display || "Student")}</strong>
              <span class="small-note">${escapeHtml(when)}</span>
            </div>
            <p class="small-note" style="margin:0;white-space:pre-wrap;">${escapeHtml(preview || "—")}</p>
          </article>
        `;
      })
      .join("");
    grid.innerHTML = `<div class="content-grid">${cards}</div>`;
  } catch (e) {
    console.error("loadJournals:", e);
    grid.innerHTML = emptyHtml;
  }
}

async function loadReports() {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  try {
    const res = await fetch(apiUrl("/admin/stats"));
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      if (!d.error) {
        setText("report-total-users", d.total_accounts ?? 0);
        setText("report-pending", d.pending_approvals ?? 0);
        setText("report-active-today", d.active_users_today ?? 0);
        setText("report-lessons", d.lessons_total ?? 0);
        setText("report-published", d.lessons_published ?? 0);
        setText("report-ai-content", d.lessons_with_ai ?? 0);
        return;
      }
    }
  } catch (e) {
    console.error("loadReports /admin/stats:", e);
  }

  try {
    const response = await fetch(apiUrl("/users"));
    if (response.ok) {
      const users = await response.json();
      setText("report-total-users", users.length);
      setText("report-pending", users.filter((u) => u.approval_status === "pending").length);
      setText("report-active-today", 0);
      setText("report-lessons", 0);
      setText("report-published", 0);
      setText("report-ai-content", 0);
    }
  } catch (error) {
    console.error("Failed to load report data:", error);
  }
}

function loadSettings() {
  // Settings are static for now - could be loaded from backend in future
  console.log('Settings section loaded');
}

async function updateAdminUserStatus(idNumber, newStatus) {
  try {
    const payload = {
      id_number: idNumber,
      approval_status: newStatus
    };
    console.log("Sending approval request:", payload);
    
    const response = await fetch(apiUrl("/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to update user status");
    }

    // Refresh the table and metrics
    await renderAdminTable(document.querySelector("#admin-search")?.value || "");
    await renderMetrics();
    await refreshAdminRecentActivity();
    if (document.querySelector("#approval-table-body") && typeof loadPendingApprovals === "function") {
      await loadPendingApprovals();
    }
    if (document.querySelector("#teacher-approval-table-body") && typeof loadTeacherApprovals === "function") {
      await loadTeacherApprovals();
    }
    showToast(`User marked ${newStatus.toLowerCase()} successfully.`, "success");
  } catch (error) {
    console.error("Failed to update user status:", error);
    showToast(`Failed to update user: ${error.message}`, "error");
  }
}

function setupAdminPage() {
  const adminTableBody = document.querySelector("#admin-table-body");
  if (!adminTableBody) return;

  renderAdminTable();
  renderMetrics();
  renderRecentActivity();
  renderSystemStatus();
  setupDashboardActions();
  setupAdminNavigation();

  adminTableBody.addEventListener("click", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const idNumber = target.dataset.id;
    if (!action || !idNumber) return;

    if (action === "approve") {
      updateAdminUserStatus(idNumber, "approved");
    }
    if (action === "reject") {
      updateAdminUserStatus(idNumber, "rejected");
    }
  });

  const adminSearchInput = document.getElementById("admin-search");
  const adminResetButton = document.getElementById("admin-reset");
  if (adminSearchInput) {
    adminSearchInput.addEventListener("input", () => renderAdminTable(adminSearchInput.value));
  }
  if (adminResetButton) {
    adminResetButton.addEventListener("click", () => {
      if (adminSearchInput) adminSearchInput.value = "";
      renderAdminTable();
      renderMetrics();
    });
  }
}

// Teacher dashboard: lesson file selected in UI + server state
let currentFileId = null;
let currentQuiz = [];
let teacherAiAbortController = null;

const TEACHER_FILE_STORAGE_KEY = "learniq-teacher-file-id";

async function fetchTeacherLessonsList() {
  try {
    const currentUser = getCurrentUserSession();
    if (!currentUser || !currentUser.id_number) {
      console.error("No logged-in teacher found");
      return [];
    }

    const res = await fetch(apiUrl(`/teacher/lessons?teacher_id_number=${currentUser.id_number}`));
    if (!res.ok) return [];
    const data = await res.json();
    return data.lessons || [];
  } catch (error) {
    console.error("Failed to fetch teacher lessons:", error);
    return [];
  }
}

function teacherLessonFileMetaLine(lesson) {
  const ftRaw = lesson && lesson.file_type != null ? String(lesson.file_type).trim() : "";
  const ft = ftRaw ? ftRaw.toUpperCase() : "FILE";
  const d = lesson && lesson.created_at ? new Date(lesson.created_at) : null;
  const dateOk = d && !Number.isNaN(d.getTime());
  const datePart = dateOk ? `Uploaded ${d.toLocaleDateString()}` : "Date not available";
  return `${ft} • ${datePart}`;
}

function getTeacherDashboardSubjectFilter() {
  try {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("subject_id");
    return sid && sid.trim() ? sid.trim() : null;
  } catch {
    return null;
  }
}

async function loadTeacherDashboardLessons() {
  try {
    const allLessons = await fetchTeacherLessonsList();

    // Optional subject filter coming from teacher-subjects.html.
    const subjectFilter = getTeacherDashboardSubjectFilter();
    let lessons = allLessons;
    if (subjectFilter) {
      if (subjectFilter === "__unassigned__") {
        lessons = allLessons.filter((l) => !l.subject_id);
      } else {
        lessons = allLessons.filter((l) => String(l.subject_id || "") === subjectFilter);
      }
    }

    // Recent Lessons - all lessons sorted by created_at desc
    const recentLessonsList = document.getElementById('recent-lessons-list');
    if (recentLessonsList) {
      if (lessons.length === 0) {
        recentLessonsList.innerHTML = subjectFilter
          ? '<p class="small-note">No uploaded lessons for this subject yet.</p>'
          : '<p class="small-note">No uploaded lessons yet.</p>';
      } else {
        const sortedLessons = [...lessons].sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        });
        recentLessonsList.innerHTML = sortedLessons.map((lesson) => {
          const lid = String(lesson.id || lesson.file_id || "").replace(/'/g, "\\'");
          const fname = escapeHtml(lesson.filename || "Untitled Lesson");
          const meta = escapeHtml(teacherLessonFileMetaLine(lesson));
          return `
          <div class="lesson-item">
            <div class="lesson-info">
              <h4>${fname}</h4>
              <span class="small-note">${meta}</span>
            </div>
            <div class="lesson-actions">
              ${
                lesson.is_published
                  ? `<button type="button" class="btn btn-sm btn-primary" onclick="unpublishLesson('${lid}')">Unpublish</button>`
                  : `<button type="button" class="btn btn-sm btn-secondary" onclick="generateAIContent('${lid}')">Generate AI</button>
                 <button type="button" class="btn btn-sm btn-primary" onclick="publishLesson('${lid}')">Publish</button>`
              }
            </div>
          </div>
        `;
        }).join('');
      }
    }
    
    // Published Lessons - only lessons with is_published = true
    const publishedLessonsList = document.getElementById('published-lessons-list');
    if (publishedLessonsList) {
      const publishedLessons = lessons.filter((lesson) => lesson.is_published || lesson.published);
      if (publishedLessons.length === 0) {
        publishedLessonsList.innerHTML = subjectFilter
          ? '<p class="small-note">No published lessons for this subject yet.</p>'
          : '<p class="small-note">No published lessons yet.</p>';
      } else {
        publishedLessonsList.innerHTML = publishedLessons.map((lesson) => {
          const fname = escapeHtml(lesson.filename || "Untitled Lesson");
          const ftRaw = lesson && lesson.file_type != null ? String(lesson.file_type).trim() : "";
          const ft = escapeHtml(ftRaw ? ftRaw.toUpperCase() : "FILE");
          const d = lesson && lesson.created_at ? new Date(lesson.created_at) : null;
          const dateOk = d && !Number.isNaN(d.getTime());
          const cal = escapeHtml(dateOk ? d.toLocaleDateString() : "—");
          return `
          <div class="published-lesson">
            <div class="lesson-header">
              <h4>${fname}</h4>
              <span class="status-badge online">Published</span>
            </div>
            <div class="lesson-stats">
              <span><i class="fa-solid fa-file"></i> ${ft}</span>
              <span><i class="fa-solid fa-calendar"></i> ${cal}</span>
            </div>
          </div>
        `;
        }).join('');
      }
    }
    
    // AI Generation Queue - lessons without AI content or not published
    const aiQueueList = document.getElementById('ai-queue-list');
    if (aiQueueList) {
      const queuedLessons = lessons.filter(
        (lesson) =>
          !(lesson.is_published || lesson.published) &&
          (!lesson.lesson_content || !lesson.lesson_content.reviewer),
      );
      if (queuedLessons.length === 0) {
        aiQueueList.innerHTML = subjectFilter
          ? '<p class="small-note">No lessons waiting for AI generation under this subject.</p>'
          : '<p class="small-note">No lessons waiting for AI generation.</p>';
      } else {
        aiQueueList.innerHTML = queuedLessons.map((lesson) => {
          const fname = escapeHtml(lesson.filename || "Untitled Lesson");
          return `
          <div class="queue-item">
            <div class="queue-info">
              <h4>${fname}</h4>
              <span class="small-note">Waiting for AI processing</span>
            </div>
            <div class="queue-status">
              <span class="status-badge warning">Pending</span>
            </div>
          </div>
        `;
        }).join('');
      }
    }
    
  } catch (error) {
    console.error('Failed to load teacher dashboard lessons:', error);
    
    // Show error messages in all sections
    document.getElementById('recent-lessons-list') && (document.getElementById('recent-lessons-list').innerHTML = '<p class="small-note">Error loading lessons.</p>');
    document.getElementById('published-lessons-list') && (document.getElementById('published-lessons-list').innerHTML = '<p class="small-note">Error loading lessons.</p>');
    document.getElementById('ai-queue-list') && (document.getElementById('ai-queue-list').innerHTML = '<p class="small-note">Error loading lessons.</p>');
  }
}

async function publishLesson(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: "Publish lesson?",
      message: "Are you sure you want to publish this lesson?",
      confirmText: "Yes",
      cancelText: "No",
    });
  } else {
    ok = window.confirm("Are you sure you want to publish this lesson?");
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl("/publish-lesson"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: id }),
    });
    await readApiJson(res);
    showToast("Lesson published. Students can open or refresh their dashboard.", "success");
    await loadTeacherDashboardLessons();
    void initTeacherLearniqDashboardStatsIfPresent();
  } catch (e) {
    showToast(e?.message || "Could not publish lesson.", "error");
  }
}

async function unpublishLesson(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: "Unpublish lesson?",
      message:
        "Are you sure you want to unpublish this lesson? Students will no longer see this content.",
      confirmText: "Yes",
      cancelText: "No",
    });
  } else {
    ok = window.confirm(
      "Are you sure you want to unpublish this lesson? Students will no longer see this content.",
    );
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl("/unpublish-lesson"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: id }),
    });
    await readApiJson(res);
    showToast("Lesson unpublished. Students can no longer see this content.", "success");
    await loadTeacherDashboardLessons();
    void initTeacherLearniqDashboardStatsIfPresent();
  } catch (e) {
    showToast(e?.message || "Could not unpublish lesson.", "error");
  }
}

function generateAIContent(lessonId) {
  // This would navigate to AI generation page or call AI endpoint
  console.log('Generate AI for lesson:', lessonId);
  // Could redirect to ai-result.html with lesson ID
  window.location.href = `ai-result.html?file_id=${lessonId}`;
}

function renderTeacherLessonsTable(lessons, selectedId) {
  const tbody = document.getElementById("teacher-lessons-tbody");
  if (!tbody) return;
  const sel = selectedId !== undefined && selectedId !== null ? selectedId : currentFileId;
  if (!lessons.length) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="small-note">No uploads yet. Choose a PDF or PPT and click a generate button to upload it.</td></tr>';
    return;
  }
  tbody.innerHTML = lessons
    .map((l) => {
      const bits = [];
      if (l.has_reviewer) bits.push("Reviewer");
      if (l.quiz_count) bits.push(`${l.quiz_count} quiz Q`);
      if (l.has_activities) bits.push("Activities");
      const aiCell = bits.length ? bits.join(" · ") : "—";
      const pub = l.published ? '<span class="status-badge online">Yes</span>' : "—";
      const selected = sel === l.file_id ? "lesson-row-selected" : "";
      return `<tr class="${selected}" data-lesson-id="${encodeURIComponent(l.file_id)}" style="cursor:pointer">
        <td>${escapeHtml(l.filename)}</td>
        <td>${escapeHtml(aiCell)}</td>
        <td>${pub}</td>
      </tr>`;
    })
    .join("");
}

async function syncLessonFromServer(fileId) {
  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(fileId)}`));
    if (!res.ok) {
      currentQuiz = [];
      return;
    }
    const data = await res.json();
    currentQuiz = Array.isArray(data.quiz) ? [...data.quiz] : [];
  } catch {
    currentQuiz = [];
  }
}

async function refreshTeacherLessons() {
  const lessons = await fetchTeacherLessonsList();
  const saved = localStorage.getItem(TEACHER_FILE_STORAGE_KEY);
  if (saved && lessons.some((l) => l.file_id === saved)) {
    currentFileId = saved;
    await syncLessonFromServer(saved);
    const meta = lessons.find((l) => l.file_id === saved);
    const fileMeta = document.querySelector("#file-meta");
    // `teacher-learniq-dashboard.html` uses #file-meta for the local file picker state.
    // Don't auto-fill it from saved server lesson selection.
    const isTeacherLearniqPage = document.body && document.body.classList.contains("teacher-learniq-page");
    if (!isTeacherLearniqPage && fileMeta && meta) {
      fileMeta.textContent = `Selected lesson: ${meta.filename}`;
    }
  }
  renderTeacherLessonsTable(lessons, currentFileId);
}

async function selectTeacherLesson(fileId, filename) {
  currentFileId = fileId;
  localStorage.setItem(TEACHER_FILE_STORAGE_KEY, fileId);
  await syncLessonFromServer(fileId);
  const fileMeta = document.querySelector("#file-meta");
  const isTeacherLearniqPage = document.body && document.body.classList.contains("teacher-learniq-page");
  if (!isTeacherLearniqPage && fileMeta && filename) {
    fileMeta.textContent = `Selected lesson: ${filename}`;
  }
  const lessons = await fetchTeacherLessonsList();
  renderTeacherLessonsTable(lessons, fileId);
}

async function uploadFile(file, subjectId = null) {
  const currentUser = getCurrentUserSession();
  if (!currentUser || !currentUser.id_number) {
    throw new Error("Teacher not logged in. Please log in again.");
  }

  console.log("Uploading file:", file.name);
  console.log("teacher_id_number:", currentUser.id_number);
  console.log("subject_id:", subjectId);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("teacher_id_number", currentUser.id_number);
  if (subjectId) {
    formData.append("subject_id", subjectId);
  }

  console.log("FormData contents:");
  for (let [key, value] of formData.entries()) {
    console.log(`  ${key}:`, key === 'file' ? value.name : value);
  }

  const response = await fetch(apiUrl("/upload-file"), {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Upload failed with status ${response.status}`);
  }

  const result = await readApiJson(response);
  currentFileId = result.file_id;
  localStorage.setItem(TEACHER_FILE_STORAGE_KEY, result.file_id);
  showToast(`File uploaded: ${result.filename}`, "success");
  await refreshTeacherLessons();
  await loadTeacherDashboardLessons(); // Refresh dashboard
  void initTeacherLearniqDashboardStatsIfPresent();
  return result;
}

async function generateReviewer(fetchOpts = {}) {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");

  const response = await fetch(apiUrl("/generate-reviewer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: currentFileId }),
    ...(fetchOpts.signal ? { signal: fetchOpts.signal } : {})
  });

  const result = await readApiJson(response);
  return result.reviewer;
}

async function generateQuestion(fetchOpts = {}) {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");

  const response = await fetch(apiUrl("/generate-question"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: currentFileId }),
    ...(fetchOpts.signal ? { signal: fetchOpts.signal } : {})
  });

  const result = await readApiJson(response);
  currentQuiz.push(result);
  return result;
}

async function generateActivities(fetchOpts = {}) {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");

  const response = await fetch(apiUrl("/generate-activities"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: currentFileId }),
    ...(fetchOpts.signal ? { signal: fetchOpts.signal } : {})
  });

  const result = await readApiJson(response);
  return result.activities;
}

function updateFullAiPreview(previewBody, reviewerText, activities, questions) {
  if (!previewBody) return;
  const actBlock = Array.isArray(activities)
    ? activities.map((a) => `<p>• ${escapeHtml(a)}</p>`).join("")
    : "";
  const quizBlock = (questions || [])
    .map(
      (q, i) => `<div class="preview-snippet" style="margin-top:0.75rem">
        <h4>Question ${i + 1}</h4>
        <p><strong>${escapeHtml(q.question)}</strong></p>
        <p class="small-note">${(q.choices || []).map((c) => escapeHtml(c)).join(" · ")}</p>
        <small>Answer: ${escapeHtml(q.answer)}</small>
      </div>`
    )
    .join("");
  previewBody.innerHTML = `
    <div class="preview-snippet">
      <div class="reviewer-preview-toolbar">
        <h4>Reviewer</h4>
        <button type="button" class="btn btn-secondary btn-small" id="teacher-download-reviewer-pdf-btn">
          <i class="fa-solid fa-file-pdf"></i> Download PDF
        </button>
      </div>
      <div id="teacher-reviewer-preview-md" class="reviewer-markdown-body"></div>
    </div>
    <div class="preview-snippet"><h4>Learning activities</h4>${actBlock || "<p>—</p>"}</div>
    ${
      quizBlock ||
      '<div class="preview-snippet"><h4>Quiz</h4><p class="small-note">No questions generated.</p></div>'
    }
  `;
  const revEl = document.getElementById("teacher-reviewer-preview-md");
  if (revEl) {
    if (typeof mountReviewerMarkdownInto === "function") {
      mountReviewerMarkdownInto(revEl, reviewerText);
    } else {
      revEl.innerHTML = `<p>${escapeHtml(String(reviewerText || ""))}</p>`;
    }
  }
  const pdfBtn = document.getElementById("teacher-download-reviewer-pdf-btn");
  if (pdfBtn && revEl && typeof setReviewerPdfButtonVisible === "function") {
    const has =
      typeof normalizeReviewerMarkdown === "function"
        ? normalizeReviewerMarkdown(reviewerText).length > 0
        : Boolean(String(reviewerText || "").trim());
    setReviewerPdfButtonVisible(pdfBtn, has);
    pdfBtn.onclick = () => {
      if (typeof downloadReviewerPdfFromElement === "function") {
        downloadReviewerPdfFromElement(revEl, "reviewer");
      }
    };
  }
}

async function updateTeacherApiStatus() {
  const el = document.getElementById("teacher-api-status");
  if (!el) return;
  el.textContent = "Checking server…";
  el.classList.remove("is-online", "is-offline");
  try {
    const res = await fetch(apiUrl("/health"));
    if (!res.ok) throw new Error("unreachable");
    const data = await res.json().catch(() => ({}));
    let msg = "Server connected.";
    if (data.has_supabase === false) {
      msg += " Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to backend/.env and run supabase_schema.sql.";
    }
    if (data.has_api_key === false) {
      msg += " Set API_KEY for AI generation.";
    } else if (data.has_supabase !== false) {
      msg += " Upload & publish use the database.";
    }
    el.textContent = msg;
    el.classList.add("is-online");
  } catch {
    el.textContent =
      "Cannot reach API. Run: cd backend → uvicorn main:app --reload — then open http://127.0.0.1:8000/teacher-dashboard.html (or set localStorage learniq-api-base to your API URL).";
    el.classList.add("is-offline");
  }
}

async function runTeacherAiPack(previewBody) {
  if (!currentFileId) {
    showToast("Upload a lesson file first, or select one in the table below.", "error");
    return;
  }
  teacherAiAbortController?.abort();
  teacherAiAbortController = new AbortController();
  const { signal } = teacherAiAbortController;
  const btn = document.getElementById("teacher-generate-ai-pack-btn");
  const cancelBtn = document.getElementById("teacher-cancel-ai-pack-btn");
  const prev = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="loader"></span> Generating...`;
  }
  if (cancelBtn) {
    cancelBtn.hidden = false;
    cancelBtn.disabled = false;
  }
  try {
    currentQuiz = [];
    const reviewer = await generateReviewer({ signal });
    const activities = await generateActivities({ signal });
    const questions = [];
    for (let i = 0; i < 3; i++) {
      questions.push(await generateQuestion({ signal }));
    }
    updateFullAiPreview(previewBody, reviewer, activities, questions);
    await refreshTeacherLessons();
    showToast("AI content ready: reviewer, activities, and 3 quiz questions.", "success");
  } catch (error) {
    if (error?.name === "AbortError" || signal.aborted) {
      showToast("AI generation cancelled.", "info");
    } else {
      showToast(`Error: ${error.message}`, "error");
    }
  } finally {
    teacherAiAbortController = null;
    if (cancelBtn) {
      cancelBtn.hidden = true;
      cancelBtn.disabled = true;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prev;
    }
  }
}

async function hydrateTeacherDashboardSubjectHeader() {
  const subjectId = getTeacherDashboardSubjectFilter();
  const actions = document.getElementById("teacher-dashboard-header-actions");
  const titleEl = document.getElementById("teacher-dashboard-panel-title");
  const subtitleEl = document.getElementById("teacher-dashboard-panel-subtitle");

  if (!subjectId) {
    if (actions) actions.hidden = true;
    return;
  }
  if (actions) actions.hidden = false;

  if (subjectId === "__unassigned__") {
    if (titleEl) titleEl.textContent = "Unassigned · Teacher LearnIQ";
    if (subtitleEl) {
      subtitleEl.textContent = "Lessons you uploaded that don't have a subject yet. Edit them to assign one.";
    }
    return;
  }

  try {
    const res = await fetch(apiUrl("/subjects"));
    if (!res.ok) return;
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const match = subjects.find((s) => String(s.id) === subjectId);
    if (match && titleEl) {
      titleEl.textContent = `${match.name} · Teacher LearnIQ`;
    }
    if (match && subtitleEl) {
      subtitleEl.textContent = match.description
        || "Manage the lessons you uploaded for this subject.";
    }
  } catch (e) {
    console.log("DEBUG: hydrateTeacherDashboardSubjectHeader failed:", e);
  }
}

async function loadTeacherSubjectOptions() {
  const select = document.getElementById("upload-subject-select");
  if (!select) return;
  try {
    const res = await fetch(apiUrl("/subjects"));
    if (!res.ok) return;
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const placeholder = '<option value="" disabled selected>Choose subject…</option>';
    const opts = subjects
      .map((s) => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.name || "Untitled subject")}</option>`)
      .join("");
    select.innerHTML = placeholder + opts;
    if (subjects.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No subjects available — add one in the database.</option>';
    }
  } catch (e) {
    console.log("DEBUG: loadTeacherSubjectOptions failed:", e);
  }
}

function setupTeacherDashboard() {
  const fileInput = document.querySelector("#file-input");
  const fileMeta = document.querySelector("#file-meta");
  const previewBody = document.querySelector("#ai-preview-body");
  const tbody = document.getElementById("teacher-lessons-tbody");
  const uploadBtn = document.getElementById("upload-btn");
  const clearBtn = document.getElementById("file-clear-btn");
  const subjectSelect = document.getElementById("upload-subject-select");

  hydrateStudentSidebarChip();
  void initTeacherLearniqDashboardStatsIfPresent();

  // Load subjects into the dropdown (Teacher LearnIQ page only).
  if (subjectSelect) {
    void loadTeacherSubjectOptions();
  }

  // If a subject filter is present in the URL, reveal the back link and tweak
  // the header copy. Also try to swap the title to the subject name.
  void hydrateTeacherDashboardSubjectHeader();

  // Load dashboard lessons on page load
  loadTeacherDashboardLessons();

  if (fileMeta) {
    fileMeta.textContent = "";
  }

  fileInput?.addEventListener("change", () => {
    const selectedFile = fileInput?.files?.[0];
    if (!fileMeta) return;
    if (!selectedFile) {
      fileMeta.textContent = "";
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    fileMeta.textContent = `Selected file: ${selectedFile.name}`;
    if (clearBtn) clearBtn.hidden = false;
  });

  clearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (fileInput) fileInput.value = "";
    if (fileMeta) fileMeta.textContent = "";
    clearBtn.hidden = true;
    // Trigger any listeners that rely on change
    fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
  });

  uploadBtn?.addEventListener("click", () => {
    console.log("Upload button clicked");
    fileInput?.click();
  });

  const uploadForm = document.querySelector("#upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      console.log("Form submitted");

      const selectedFile = fileInput?.files?.[0];
      if (!selectedFile) {
        if (fileMeta) fileMeta.textContent = "No file selected yet";
        return;
      }

      const subjectId = subjectSelect ? subjectSelect.value : "";
      if (subjectSelect && !subjectId) {
        showToast("Please choose a subject for this lesson.", "error");
        subjectSelect.focus();
        return;
      }

      if (fileMeta) fileMeta.textContent = `Uploading ${selectedFile.name}…`;
      currentFileId = null;
      currentQuiz = [];
      try {
        await uploadFile(selectedFile, subjectId || null);
        if (fileMeta) fileMeta.textContent = `Uploaded: ${selectedFile.name}`;
        fileInput.value = "";
      } catch (e) {
        if (fileMeta) fileMeta.textContent = "Upload failed. Try again.";
        const msg =
          e && e.message && String(e.message).includes("fetch")
            ? "Cannot reach API. Start the backend (uvicorn) or check learniq-api-base in localStorage."
            : e.message || "Upload failed";
        showToast(msg, "error");
      }
    });
  }

  document.getElementById("teacher-generate-ai-pack-btn")?.addEventListener("click", () => {
    runTeacherAiPack(previewBody);
  });
  document.getElementById("teacher-cancel-ai-pack-btn")?.addEventListener("click", () => {
    teacherAiAbortController?.abort();
  });

  document.getElementById("publish-lesson-btn")?.addEventListener("click", async () => {
    if (!currentFileId) {
      showToast("Select a lesson in the table first.", "error");
      return;
    }
    try {
      const res = await fetch(apiUrl("/publish-lesson"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: currentFileId })
      });
      await readApiJson(res);
      showToast("Lesson published. Students can open or refresh their dashboard.", "success");
      await refreshTeacherLessons();
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  document.getElementById("refresh-lessons-btn")?.addEventListener("click", async () => {
    try {
      await refreshTeacherLessons();
      showToast("Lesson list updated.", "success");
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  if (tbody) {
    tbody.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-lesson-id]");
      if (!row) return;
      const raw = row.getAttribute("data-lesson-id");
      if (!raw) return;
      const id = decodeURIComponent(raw);
      const fnameCell = row.querySelector("td");
      const fname = fnameCell ? fnameCell.textContent.trim() : "";
      selectTeacherLesson(id, fname);
    });
  }

  refreshTeacherLessons();
  updateTeacherApiStatus();
}

function answersMatch(studentPick, correctAnswer) {
  const a = String(studentPick).trim().toLowerCase();
  const b = String(correctAnswer).trim().toLowerCase();
  if (a === b) return true;
  const first = a.charAt(0);
  if (b.length <= 2 && first === b.charAt(0)) return true;
  return false;
}

// ───────────────────────────────────────────────────────────────────────────
// Subjects page (frontend/subjects.html) — student entry point that renders
// subject cards using the SAME lesson-card design as my-lesson.html.
// Clicking a card navigates to my-lesson.html?subject_id=<uuid>.
// ───────────────────────────────────────────────────────────────────────────

function buildSubjectCardHtml(subject) {
  const safeId = String(subject.id).replace(/'/g, "\\'");
  const color = subject.color || "#60a5fa";
  const name = subject.name || "Untitled subject";
  const description = subject.description || "Lessons grouped under this subject.";
  const count = Number(subject.published_lesson_count || 0);
  const lessonsLabel = count === 1 ? "1 lesson" : `${count} lessons`;
  const targetUrl = `my-lesson.html?subject_id=${encodeURIComponent(subject.id)}`;
  return `
    <article class="lesson-card subject-card-themed" data-subject-id="${safeId}" style="--subject-color: ${escapeHtml(color)};">
      <div class="lesson-card-icon"><i class="fa-solid fa-book-open"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(name)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${lessonsLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-bookmark"></i> Subject</span>
        </div>
        <p class="lesson-card-tagline">${escapeHtml(description)}</p>
        <p class="lesson-card-features small-note">Reviewer • Quiz • Activities</p>
      </div>
      <div class="lesson-actions">
        <a class="btn btn-primary btn-small" href="${targetUrl}">Open Subject</a>
      </div>
    </article>
  `;
}

async function renderSubjectsPage() {
  const listEl = document.getElementById("subjects-list");
  const selectionEl = document.getElementById("subjects-selection");
  const emptyEl = document.getElementById("subjects-empty");
  if (!listEl || !selectionEl || !emptyEl) return;

  try {
    const [subjectsRes, lessonsRes] = await Promise.all([
      fetch(apiUrl("/subjects")),
      fetch(apiUrl("/student/lessons")),
    ]);

    let subjects = [];
    if (subjectsRes.ok) {
      const data = await subjectsRes.json();
      subjects = Array.isArray(data.subjects) ? data.subjects : [];
    }

    let lessons = [];
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      lessons = Array.isArray(data.lessons) ? data.lessons : [];
    }

    // Recompute counts from the freshly fetched published lessons (in case
    // /subjects count is stale) and inject an "Unassigned" virtual subject
    // for legacy lessons without subject_id.
    const liveCounts = lessons.reduce((acc, l) => {
      const sid = l.subject_id ? String(l.subject_id) : "__unassigned__";
      acc[sid] = (acc[sid] || 0) + 1;
      return acc;
    }, {});
    subjects = subjects.map((s) => ({
      ...s,
      published_lesson_count:
        liveCounts[String(s.id)] != null
          ? liveCounts[String(s.id)]
          : (s.published_lesson_count || 0),
    }));
    if (liveCounts["__unassigned__"]) {
      subjects.push({
        id: "__unassigned__",
        name: "Unassigned",
        description: "Published lessons that don't have a subject yet.",
        color: "#94a3b8",
        published_lesson_count: liveCounts["__unassigned__"],
      });
    }

    if (subjects.length === 0) {
      selectionEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    selectionEl.hidden = false;
    listEl.innerHTML = subjects.map(buildSubjectCardHtml).join("");
  } catch (e) {
    console.log("DEBUG: renderSubjectsPage failed:", e);
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    const text = document.getElementById("subjects-empty-text");
    if (text) text.textContent = "Cannot reach the server. Is the LearnIQ Track backend running?";
  }
}

function setupSubjectsPage() {
  console.log("PAGE INIT RUNNING: setupSubjectsPage() called");
  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();

  document.getElementById("subjects-refresh-btn")?.addEventListener("click", () => {
    renderSubjectsPage();
  });

  void renderSubjectsPage();
}

// ───────────────────────────────────────────────────────────────────────────
// Teacher Subjects page (frontend/teacher-subjects.html) — same lesson-card
// design as student subjects, but lesson counts are scoped to the signed-in
// teacher's own uploads. Clicking a card filters the teacher dashboard.
// ───────────────────────────────────────────────────────────────────────────

function buildTeacherSubjectCardHtml(subject) {
  const safeId = String(subject.id).replace(/'/g, "\\'");
  const color = subject.color || "#60a5fa";
  const name = subject.name || "Untitled subject";
  const description = subject.description || "Lessons grouped under this subject.";
  const myCount = Number(subject.my_lesson_count || 0);
  const publishedCount = Number(subject.my_published_count || 0);
  const myLabel = myCount === 1 ? "1 of your lessons" : `${myCount} of your lessons`;
  const pubLabel = publishedCount === 1 ? "1 published" : `${publishedCount} published`;
  const targetUrl = `teacher-learniq-dashboard.html?subject_id=${encodeURIComponent(subject.id)}`;
  return `
    <article class="lesson-card subject-card-themed" data-subject-id="${safeId}" style="--subject-color: ${escapeHtml(color)};">
      <div class="lesson-card-icon"><i class="fa-solid fa-book-open"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(name)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${myLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-eye"></i> ${pubLabel}</span>
        </div>
        <p class="lesson-card-tagline">${escapeHtml(description)}</p>
        <p class="lesson-card-features small-note">Upload • Generate • Publish</p>
      </div>
      <div class="lesson-actions">
        <a class="btn btn-primary btn-small" href="${targetUrl}">Open Subject</a>
      </div>
    </article>
  `;
}

async function renderTeacherSubjectsPage() {
  const listEl = document.getElementById("teacher-subjects-list");
  const selectionEl = document.getElementById("teacher-subjects-selection");
  const emptyEl = document.getElementById("teacher-subjects-empty");
  const emptyText = document.getElementById("teacher-subjects-empty-text");
  if (!listEl || !selectionEl || !emptyEl) return;

  const currentUser = getCurrentUserSession();
  if (!currentUser || !currentUser.id_number) {
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = "Please sign in as a teacher to view your subjects.";
    return;
  }

  try {
    const [subjectsRes, lessonsRes] = await Promise.all([
      fetch(apiUrl("/subjects")),
      fetch(apiUrl(`/teacher/lessons?teacher_id_number=${encodeURIComponent(currentUser.id_number)}`)),
    ]);

    let subjects = [];
    if (subjectsRes.ok) {
      const data = await subjectsRes.json();
      subjects = Array.isArray(data.subjects) ? data.subjects : [];
    }

    let myLessons = [];
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      myLessons = Array.isArray(data.lessons) ? data.lessons : [];
    }

    // Count THIS teacher's lessons per subject (total + published).
    const totals = {};
    const published = {};
    for (const lesson of myLessons) {
      const sid = lesson.subject_id ? String(lesson.subject_id) : "__unassigned__";
      totals[sid] = (totals[sid] || 0) + 1;
      if (lesson.is_published || lesson.published) {
        published[sid] = (published[sid] || 0) + 1;
      }
    }

    subjects = subjects.map((s) => {
      const key = String(s.id);
      return {
        ...s,
        my_lesson_count: totals[key] || 0,
        my_published_count: published[key] || 0,
      };
    });

    if (totals["__unassigned__"]) {
      subjects.push({
        id: "__unassigned__",
        name: "Unassigned",
        description: "Your lessons that don't have a subject yet. Edit them to assign one.",
        color: "#94a3b8",
        my_lesson_count: totals["__unassigned__"],
        my_published_count: published["__unassigned__"] || 0,
      });
    }

    if (subjects.length === 0) {
      selectionEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    selectionEl.hidden = false;
    listEl.innerHTML = subjects.map(buildTeacherSubjectCardHtml).join("");
  } catch (e) {
    console.log("DEBUG: renderTeacherSubjectsPage failed:", e);
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = "Cannot reach the server. Is the LearnIQ Track backend running?";
  }
}

function setupTeacherSubjectsPage() {
  console.log("PAGE INIT RUNNING: setupTeacherSubjectsPage() called");
  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();

  document.getElementById("teacher-subjects-refresh-btn")?.addEventListener("click", () => {
    renderTeacherSubjectsPage();
  });

  setupTeacherAddSubjectModal();

  void renderTeacherSubjectsPage();
}

// ───────────────────────────────────────────────────────────────────────────
// Admin Subjects page (frontend/admin-subjects.html) — drill-down flow:
//   Default view      → Teacher profile cards
//   ?teacher_id=X     → Subjects for that teacher (only subjects they teach)
//   ?teacher_id=X
//     &subject_id=Y   → Lessons by that teacher under that subject
//
// The page also retains an "Add Subject" modal in the header for global
// subject management (subjects are school-wide and shared across teachers).
// ───────────────────────────────────────────────────────────────────────────

let adminSubjectsCache = [];
let adminTeachersCache = [];
let adminAllLessonsCache = [];
const UNASSIGNED_SUBJECT_ID = "__unassigned__";

function getAdminSubjectsViewParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    teacherId: (params.get("teacher_id") || "").trim(),
    subjectId: (params.get("subject_id") || "").trim(),
  };
}

function teacherInitialsFromName(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "T";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildAdminTeacherCardHtml(teacher, lessonStats) {
  const tid = String(teacher.id_number || "").replace(/'/g, "\\'");
  const safeTid = escapeHtml(teacher.id_number || "");
  const firstName = teacher.first_name || "";
  const lastName = teacher.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || teacher.email || "Unnamed Teacher";
  const initials = teacherInitialsFromName(fullName);
  const subjectCount = Number(lessonStats?.subject_count || 0);
  const lessonCount = Number(lessonStats?.lesson_count || 0);
  const publishedCount = Number(lessonStats?.published_count || 0);
  const subjectLabel = subjectCount === 1 ? "1 subject" : `${subjectCount} subjects`;
  const lessonLabel = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;
  const publishedLabel = publishedCount === 1 ? "1 published" : `${publishedCount} published`;
  const drillUrl = `admin-subjects.html?teacher_id=${encodeURIComponent(teacher.id_number || "")}`;
  return `
    <article class="lesson-card subject-card-themed admin-teacher-card" data-teacher-id="${safeTid}" style="--subject-color: #60a5fa;" onclick="window.location.href='${drillUrl}'">
      <div class="lesson-card-icon admin-teacher-card-avatar">${escapeHtml(initials)}</div>
      <div class="lesson-info">
        <h4>${escapeHtml(fullName)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-book-open"></i> ${subjectLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${lessonLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-eye"></i> ${publishedLabel}</span>
        </div>
        <p class="lesson-card-tagline">ID No.: ${safeTid || "—"}</p>
        <p class="lesson-card-features small-note">Tap to view this teacher's subjects.</p>
      </div>
      <div class="lesson-actions">
        <button type="button" class="btn btn-primary btn-small" onclick="event.stopPropagation(); window.location.href='${drillUrl}'">
          <i class="fa-solid fa-arrow-right"></i> Open Subjects
        </button>
      </div>
    </article>
  `;
}

function buildAdminSubjectDrillCardHtml(subject, teacherIdNumber, stats) {
  const safeSid = String(subject.id).replace(/'/g, "\\'");
  const color = subject.color || "#60a5fa";
  const name = subject.name || "Untitled subject";
  const description = subject.description || "No description set.";
  const lessonCount = Number(stats?.lesson_count || 0);
  const publishedCount = Number(stats?.published_count || 0);
  const lessonLabel = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;
  const publishedLabel = publishedCount === 1 ? "1 published" : `${publishedCount} published`;
  const drillUrl = `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber || "")}&subject_id=${encodeURIComponent(subject.id || "")}`;
  return `
    <article class="lesson-card subject-card-themed" data-subject-id="${safeSid}" style="--subject-color: ${escapeHtml(color)};" onclick="window.location.href='${drillUrl}'">
      <div class="lesson-card-icon"><i class="fa-solid fa-book-open"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(name)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${lessonLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-eye"></i> ${publishedLabel}</span>
        </div>
        <p class="lesson-card-tagline">${escapeHtml(description)}</p>
        <p class="lesson-card-features small-note">Tap to see this teacher's lessons.</p>
      </div>
      <div class="lesson-actions">
        <button type="button" class="btn btn-primary btn-small" onclick="event.stopPropagation(); window.location.href='${drillUrl}'">
          <i class="fa-solid fa-arrow-right"></i> Open Lessons
        </button>
      </div>
    </article>
  `;
}

function buildAdminLessonCardHtml(lesson) {
  const filename = lesson.filename || "Untitled lesson";
  const fileType = (lesson.file_type || "file").toString().toUpperCase();
  const isPublished = !!(lesson.is_published || lesson.published);
  const createdAt = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "—";
  const quizCount = Number(lesson.quiz_count || 0);
  const hasReviewer = !!lesson.has_reviewer;
  const hasActivities = !!lesson.has_activities;
  return `
    <article class="lesson-card">
      <div class="lesson-card-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(filename)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-file"></i> ${escapeHtml(fileType)}</span>
          <span class="lesson-card-pill ${isPublished ? "lesson-pill-published" : "lesson-pill-draft"}">
            <i class="fa-solid ${isPublished ? "fa-circle-check" : "fa-clock"}"></i> ${isPublished ? "Published" : "Draft"}
          </span>
          <span class="lesson-card-pill"><i class="fa-solid fa-calendar"></i> ${escapeHtml(createdAt)}</span>
        </div>
        <p class="lesson-card-tagline">
          Reviewer: ${hasReviewer ? "Yes" : "No"} • Quiz items: ${quizCount} • Activities: ${hasActivities ? "Yes" : "No"}
        </p>
      </div>
    </article>
  `;
}

async function fetchAdminTeachers() {
  const res = await fetch(apiUrl("/users"));
  if (!res.ok) throw new Error(`/users status ${res.status}`);
  const rows = await res.json();
  const list = Array.isArray(rows) ? rows : (rows.users || []);
  return list.filter((u) => {
    const role = String(u.role || "").trim().toLowerCase();
    if (role !== "teacher") return false;
    const status = String(u.approval_status || "approved").trim().toLowerCase();
    // Show approved teachers by default; pending/rejected are hidden from the
    // drill-down because they normally cannot upload lessons anyway.
    return status === "approved";
  });
}

async function fetchAdminAllLessons() {
  const res = await fetch(apiUrl("/lessons"));
  if (!res.ok) throw new Error(`/lessons status ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.lessons) ? data.lessons : [];
}

async function fetchAdminSubjects() {
  const res = await fetch(apiUrl("/subjects"));
  if (!res.ok) throw new Error(`/subjects status ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.subjects) ? data.subjects : [];
}

function computeStatsByTeacher(lessons) {
  const stats = {};
  for (const l of lessons) {
    const tid = (l.teacher_id_number || "").trim();
    if (!tid) continue;
    if (!stats[tid]) stats[tid] = { lesson_count: 0, published_count: 0, subjects: new Set() };
    stats[tid].lesson_count += 1;
    if (l.is_published || l.published) stats[tid].published_count += 1;
    const sid = l.subject_id ? String(l.subject_id) : UNASSIGNED_SUBJECT_ID;
    stats[tid].subjects.add(sid);
  }
  for (const t of Object.keys(stats)) {
    stats[t].subject_count = stats[t].subjects.size;
    delete stats[t].subjects;
  }
  return stats;
}

function showAdminEmpty(title, text) {
  const empty = document.getElementById("admin-empty-state");
  const t = document.getElementById("admin-empty-title");
  const p = document.getElementById("admin-empty-text");
  if (empty) empty.hidden = false;
  if (t) t.textContent = title;
  if (p) p.textContent = text;
}

function hideAllAdminViews() {
  ["admin-empty-state", "admin-teachers-view", "admin-subjects-view", "admin-lessons-view"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function setAdminSubjectsHeader({ title, subtitle, backHref, backText, showAddButton }) {
  const titleEl = document.getElementById("admin-subjects-title");
  const subEl = document.getElementById("admin-subjects-subtitle");
  const backEl = document.getElementById("admin-subjects-back-link");
  const backTxtEl = document.getElementById("admin-subjects-back-text");
  const addBtn = document.getElementById("admin-add-subject-btn");

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;
  if (backEl) {
    if (backHref) {
      backEl.hidden = false;
      backEl.setAttribute("href", backHref);
    } else {
      backEl.hidden = true;
    }
  }
  if (backTxtEl && backText) backTxtEl.textContent = backText;
  if (addBtn) addBtn.hidden = !showAddButton;
}

async function renderAdminTeachersView() {
  hideAllAdminViews();
  setAdminSubjectsHeader({
    title: "Teachers",
    subtitle: "Pick a teacher to see the subjects they have uploaded lessons for.",
    backHref: null,
    backText: "",
    showAddButton: true,
  });

  const viewEl = document.getElementById("admin-teachers-view");
  const listEl = document.getElementById("admin-teachers-list");
  if (!viewEl || !listEl) return;

  try {
    const [teachers, lessons] = await Promise.all([
      fetchAdminTeachers(),
      fetchAdminAllLessons(),
    ]);
    adminTeachersCache = teachers;
    adminAllLessonsCache = lessons;

    if (!teachers.length) {
      showAdminEmpty("No teachers yet", "There are no approved teachers in the system yet.");
      return;
    }

    const statsByTeacher = computeStatsByTeacher(lessons);
    teachers.sort((a, b) => {
      const an = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const bn = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return an.localeCompare(bn);
    });

    viewEl.hidden = false;
    listEl.innerHTML = teachers
      .map((t) => buildAdminTeacherCardHtml(t, statsByTeacher[String(t.id_number || "").trim()]))
      .join("");
  } catch (e) {
    console.log("DEBUG: renderAdminTeachersView failed:", e);
    showAdminEmpty("Cannot load teachers", "Is the LearnIQ Track backend running?");
  }
}

async function renderAdminTeacherSubjectsView(teacherIdNumber) {
  hideAllAdminViews();

  // Set placeholder header so the Back button works immediately.
  setAdminSubjectsHeader({
    title: "Loading subjects…",
    subtitle: "Fetching this teacher's subjects from the database.",
    backHref: "admin-subjects.html",
    backText: "Back to Teachers",
    showAddButton: false,
  });

  // Resolve teacher name (best-effort).
  let teacherName = `Teacher ${teacherIdNumber}`;
  try {
    if (!adminTeachersCache.length) {
      adminTeachersCache = await fetchAdminTeachers();
    }
    const teacher = adminTeachersCache.find(
      (t) => String(t.id_number || "").trim() === String(teacherIdNumber)
    );
    if (teacher) {
      const composed = [teacher.first_name, teacher.last_name].filter(Boolean).join(" ").trim();
      teacherName = composed || teacher.full_name || teacher.email || teacherName;
    }
  } catch (e) {
    console.log("DEBUG: teacher subjects view — teacher lookup skipped:", e);
  }

  // ── ACTUAL FETCH FROM DATABASE ─────────────────────────────────────────
  // GET /teacher/lessons?teacher_id_number=X is backed by Supabase, so we
  // get real lesson rows here. Each row already includes subject_id.
  let lessons = [];
  try {
    const res = await fetch(
      apiUrl(`/teacher/lessons?teacher_id_number=${encodeURIComponent(teacherIdNumber)}`)
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`/teacher/lessons status ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    lessons = Array.isArray(data.lessons) ? data.lessons : [];
  } catch (e) {
    console.log("DEBUG: renderAdminTeacherSubjectsView — lessons fetch failed:", e);
    setAdminSubjectsHeader({
      title: `${teacherName}'s Subjects`,
      subtitle: "We couldn't load this teacher's lessons. See console for details.",
      backHref: "admin-subjects.html",
      backText: "Back to Teachers",
      showAddButton: false,
    });
    showAdminEmpty(
      "Cannot load subjects",
      "The backend returned an error while reading this teacher's lessons. Is the LearnIQ Track backend running?"
    );
    return;
  }

  // Fetch global subjects (for names/colors). Failure is non-fatal — we fall
  // back to showing subject IDs.
  let subjects = [];
  try {
    subjects = adminSubjectsCache.length ? adminSubjectsCache : await fetchAdminSubjects();
    adminSubjectsCache = subjects;
  } catch (e) {
    console.log("DEBUG: teacher subjects view — /subjects fetch skipped:", e);
    subjects = [];
  }

  setAdminSubjectsHeader({
    title: `${teacherName}'s Subjects`,
    subtitle: "Click a subject card to see lessons uploaded by this teacher under that subject.",
    backHref: "admin-subjects.html",
    backText: "Back to Teachers",
    showAddButton: false,
  });
  const viewTitle = document.getElementById("admin-subjects-view-title");
  if (viewTitle) viewTitle.textContent = `Subjects taught by ${teacherName}`;

  if (!lessons.length) {
    showAdminEmpty(
      "No lessons uploaded yet",
      `${teacherName} has not uploaded any lessons yet, so there are no subjects to show.`
    );
    return;
  }

  // Group lessons by subject_id and compute counts.
  const grouped = {};
  for (const l of lessons) {
    const sid = l.subject_id ? String(l.subject_id) : UNASSIGNED_SUBJECT_ID;
    if (!grouped[sid]) grouped[sid] = { lesson_count: 0, published_count: 0 };
    grouped[sid].lesson_count += 1;
    if (l.is_published || l.published) grouped[sid].published_count += 1;
  }

  const subjectById = {};
  for (const s of subjects) subjectById[String(s.id)] = s;
  const cards = [];
  for (const sid of Object.keys(grouped)) {
    let subject;
    if (sid === UNASSIGNED_SUBJECT_ID) {
      subject = { id: UNASSIGNED_SUBJECT_ID, name: "Unassigned", description: "Lessons not yet tagged with a subject.", color: "#9ca3af" };
    } else {
      subject = subjectById[sid] || { id: sid, name: "Unknown subject", description: "", color: "#9ca3af" };
    }
    cards.push(buildAdminSubjectDrillCardHtml(subject, teacherIdNumber, grouped[sid]));
  }

  const viewEl = document.getElementById("admin-subjects-view");
  const listEl = document.getElementById("admin-subjects-list");
  if (!viewEl || !listEl) return;
  viewEl.hidden = false;
  listEl.innerHTML = cards.join("");
}

async function renderAdminTeacherLessonsView(teacherIdNumber, subjectId) {
  hideAllAdminViews();

  // Set a temporary header right away so the Back link works even if the
  // fetch fails or returns no rows.
  setAdminSubjectsHeader({
    title: "Loading lessons…",
    subtitle: "Fetching lessons from the database.",
    backHref: `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber)}`,
    backText: "Back to Subjects",
    showAddButton: false,
  });

  // Resolve teacher name (best-effort, never blocks the lessons fetch).
  let teacherName = `Teacher ${teacherIdNumber}`;
  try {
    if (!adminTeachersCache.length) {
      adminTeachersCache = await fetchAdminTeachers();
    }
    const teacher = adminTeachersCache.find(
      (t) => String(t.id_number || "").trim() === String(teacherIdNumber)
    );
    if (teacher) {
      const composed = [teacher.first_name, teacher.last_name].filter(Boolean).join(" ").trim();
      teacherName = composed || teacher.full_name || teacher.email || teacherName;
    }
  } catch (e) {
    console.log("DEBUG: lessons view — teacher lookup skipped:", e);
  }

  // Resolve subject name (best-effort, never blocks the lessons fetch).
  let subjectName = "Subject";
  try {
    if (subjectId === UNASSIGNED_SUBJECT_ID) {
      subjectName = "Unassigned";
    } else {
      const subjects = adminSubjectsCache.length ? adminSubjectsCache : await fetchAdminSubjects();
      adminSubjectsCache = subjects;
      const subj = subjects.find((s) => String(s.id) === String(subjectId));
      if (subj && subj.name) subjectName = subj.name;
    }
  } catch (e) {
    console.log("DEBUG: lessons view — subject lookup skipped:", e);
  }

  // ── ACTUAL LESSON FETCH FROM DATABASE ──────────────────────────────────
  // GET /teacher/lessons?teacher_id_number=X is backed by db_supabase.list_teacher_lessons(),
  // which directly queries the Supabase `lessons` table. We filter the
  // returned rows client-side by subject_id.
  let allLessons = [];
  try {
    const res = await fetch(
      apiUrl(`/teacher/lessons?teacher_id_number=${encodeURIComponent(teacherIdNumber)}`)
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`/teacher/lessons status ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    allLessons = Array.isArray(data.lessons) ? data.lessons : [];
  } catch (e) {
    console.log("DEBUG: renderAdminTeacherLessonsView — lessons fetch failed:", e);
    setAdminSubjectsHeader({
      title: `${subjectName} — ${teacherName}`,
      subtitle: "We couldn't load the lessons. See console for details.",
      backHref: `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber)}`,
      backText: `Back to ${teacherName}'s Subjects`,
      showAddButton: false,
    });
    showAdminEmpty(
      "Cannot load lessons",
      "The backend returned an error while fetching this teacher's lessons. Is the LearnIQ Track backend running?"
    );
    return;
  }

  const filtered = allLessons.filter((l) => {
    const sid = l.subject_id ? String(l.subject_id) : UNASSIGNED_SUBJECT_ID;
    return sid === String(subjectId);
  });

  setAdminSubjectsHeader({
    title: `${subjectName} — ${teacherName}`,
    subtitle: filtered.length
      ? `${filtered.length} lesson${filtered.length === 1 ? "" : "s"} uploaded by ${teacherName} under ${subjectName}.`
      : `No lessons by ${teacherName} under ${subjectName} yet.`,
    backHref: `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber)}`,
    backText: `Back to ${teacherName}'s Subjects`,
    showAddButton: false,
  });

  const viewTitle = document.getElementById("admin-lessons-view-title");
  if (viewTitle) viewTitle.textContent = `Lessons in ${subjectName}`;

  if (!filtered.length) {
    showAdminEmpty(
      "No lessons in this subject",
      `${teacherName} has not uploaded any lessons under ${subjectName} yet.`
    );
    return;
  }

  const viewEl = document.getElementById("admin-lessons-view");
  const listEl = document.getElementById("admin-lessons-list");
  if (!viewEl || !listEl) return;

  filtered.sort((a, b) => {
    const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bd - ad;
  });

  viewEl.hidden = false;
  listEl.innerHTML = filtered.map(buildAdminLessonCardHtml).join("");
}

async function renderAdminSubjectsPage() {
  const { teacherId, subjectId } = getAdminSubjectsViewParams();
  if (teacherId && subjectId) {
    await renderAdminTeacherLessonsView(teacherId, subjectId);
  } else if (teacherId) {
    await renderAdminTeacherSubjectsView(teacherId);
  } else {
    await renderAdminTeachersView();
  }
}

function setAdminSubjectModalMode(mode, subject) {
  const titleEl = document.getElementById("admin-subject-modal-title");
  const hintEl = document.getElementById("admin-subject-modal-hint");
  const submitBtn = document.getElementById("admin-subject-submit");
  const editIdInput = document.getElementById("admin-subject-edit-id");
  const nameInput = document.getElementById("admin-subject-name");
  const descInput = document.getElementById("admin-subject-description");
  const errorEl = document.getElementById("admin-subject-form-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  if (mode === "edit" && subject) {
    if (titleEl) titleEl.textContent = "Edit subject";
    if (hintEl) hintEl.textContent = "Update the name, description, or color of this subject.";
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save changes';
    if (editIdInput) editIdInput.value = String(subject.id);
    if (nameInput) nameInput.value = subject.name || "";
    if (descInput) descInput.value = subject.description || "";
    const wantedColor = (subject.color || "").trim();
    const radios = document.querySelectorAll('input[name="admin-subject-color"]');
    let matched = false;
    radios.forEach((r) => {
      if (r.value.toLowerCase() === wantedColor.toLowerCase()) {
        r.checked = true;
        matched = true;
      }
    });
    if (!matched && radios.length > 0) radios[0].checked = true;
  } else {
    if (titleEl) titleEl.textContent = "Add a new subject";
    if (hintEl) hintEl.textContent = "Create a new subject so teachers can group their uploaded lessons under it.";
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Create Subject';
    if (editIdInput) editIdInput.value = "";
    if (nameInput) nameInput.value = "";
    if (descInput) descInput.value = "";
    const first = document.querySelector('input[name="admin-subject-color"]');
    if (first) first.checked = true;
  }
}

function openAdminSubjectAddModal() {
  const modal = document.getElementById("admin-subject-modal");
  if (!modal) return;
  setAdminSubjectModalMode("add", null);
  modal.removeAttribute("hidden");
  document.getElementById("admin-subject-name")?.focus();
}

function openAdminSubjectEditModal(subjectId) {
  const modal = document.getElementById("admin-subject-modal");
  if (!modal) return;
  const subject = adminSubjectsCache.find((s) => String(s.id) === String(subjectId));
  if (!subject) {
    showToast("Subject not found. Refreshing list.", "error");
    void renderAdminSubjectsPage();
    return;
  }
  setAdminSubjectModalMode("edit", subject);
  modal.removeAttribute("hidden");
  document.getElementById("admin-subject-name")?.focus();
}

function closeAdminSubjectModal() {
  const modal = document.getElementById("admin-subject-modal");
  if (modal) modal.setAttribute("hidden", "");
}

async function adminDeleteSubject(subjectId) {
  const subject = adminSubjectsCache.find((s) => String(s.id) === String(subjectId));
  const subjectName = subject?.name || "this subject";
  const total = Number(subject?.total_lesson_count || 0);

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: `Delete "${subjectName}"?`,
      message: total > 0
        ? `${total} lesson${total === 1 ? "" : "s"} are tagged with this subject. They will become "Unassigned" after deletion. Continue?`
        : "This subject has no lessons tagged to it. Continue?",
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true,
    });
  } else {
    ok = window.confirm(`Delete "${subjectName}"? This cannot be undone.`);
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (status ${res.status}).`);
    }
    showToast(`Subject "${subjectName}" deleted.`, "success");
    await renderAdminSubjectsPage();
  } catch (e) {
    console.log("DEBUG: adminDeleteSubject failed:", e);
    showToast(e?.message || "Could not delete subject.", "error");
  }
}

window.openAdminSubjectEditModal = openAdminSubjectEditModal;
window.adminDeleteSubject = adminDeleteSubject;

function setupAdminSubjectModal() {
  const modal = document.getElementById("admin-subject-modal");
  const openBtn = document.getElementById("admin-add-subject-btn");
  const closeBtn = document.getElementById("admin-subject-modal-close");
  const cancelBtn = document.getElementById("admin-subject-cancel");
  const form = document.getElementById("admin-subject-form");
  const nameInput = document.getElementById("admin-subject-name");
  const descInput = document.getElementById("admin-subject-description");
  const submitBtn = document.getElementById("admin-subject-submit");
  const errorEl = document.getElementById("admin-subject-form-error");

  if (!modal || !openBtn || !form) return;

  openBtn.addEventListener("click", () => openAdminSubjectAddModal());
  closeBtn?.addEventListener("click", closeAdminSubjectModal);
  cancelBtn?.addEventListener("click", closeAdminSubjectModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAdminSubjectModal();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    const editId = (document.getElementById("admin-subject-edit-id")?.value || "").trim();
    const name = (nameInput?.value || "").trim();
    const description = (descInput?.value || "").trim();
    const colorInput = form.querySelector('input[name="admin-subject-color"]:checked');
    const color = colorInput ? colorInput.value : "#60a5fa";

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "Subject name is required.";
        errorEl.hidden = false;
      }
      nameInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.prevHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    }

    try {
      let res;
      if (editId) {
        res = await fetch(apiUrl(`/subjects/${encodeURIComponent(editId)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, color }),
        });
      } else {
        res = await fetch(apiUrl("/subjects"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, color }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (status ${res.status}).`);
      }
      closeAdminSubjectModal();
      showToast(editId ? `Subject "${name}" updated.` : `Subject "${name}" added.`, "success");
      await renderAdminSubjectsPage();
    } catch (e) {
      console.log("DEBUG: admin subject save failed:", e);
      if (errorEl) {
        errorEl.textContent = e?.message || "Could not save subject. Please try again.";
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.prevHtml || 'Save';
      }
    }
  });
}

function setupAdminSubjectsPage() {
  console.log("PAGE INIT RUNNING: setupAdminSubjectsPage() called");
  if (typeof hydrateAdminSidebarFromSession === "function") {
    hydrateAdminSidebarFromSession();
  }

  setupAdminSubjectModal();

  document.getElementById("admin-subjects-refresh-btn")?.addEventListener("click", () => {
    renderAdminSubjectsPage();
  });

  void renderAdminSubjectsPage();
}

function setupTeacherAddSubjectModal() {
  const modal = document.getElementById("teacher-add-subject-modal");
  const openBtn = document.getElementById("teacher-add-subject-btn");
  const closeBtn = document.getElementById("teacher-add-subject-close");
  const cancelBtn = document.getElementById("teacher-add-subject-cancel");
  const form = document.getElementById("teacher-add-subject-form");
  const nameInput = document.getElementById("teacher-add-subject-name");
  const descInput = document.getElementById("teacher-add-subject-description");
  const submitBtn = document.getElementById("teacher-add-subject-submit");
  const errorEl = document.getElementById("teacher-add-subject-error");

  if (!modal || !openBtn || !form) return;

  const open = () => {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (nameInput) nameInput.value = "";
    if (descInput) descInput.value = "";
    // Reset color to the first swatch.
    const first = form.querySelector('input[name="subject-color"]');
    if (first) first.checked = true;
    modal.removeAttribute("hidden");
    nameInput?.focus();
  };
  const close = () => {
    modal.setAttribute("hidden", "");
  };

  openBtn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    const name = (nameInput?.value || "").trim();
    const description = (descInput?.value || "").trim();
    const colorInput = form.querySelector('input[name="subject-color"]:checked');
    const color = colorInput ? colorInput.value : "#60a5fa";

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "Subject name is required.";
        errorEl.hidden = false;
      }
      nameInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.prevHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…';
    }

    try {
      const res = await fetch(apiUrl("/subjects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, color }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to add subject (status ${res.status}).`);
      }
      const created = await res.json().catch(() => ({}));
      close();
      showToast(`Subject "${created.name || name}" added.`, "success");
      await renderTeacherSubjectsPage();
    } catch (e) {
      console.log("DEBUG: create subject failed:", e);
      if (errorEl) {
        errorEl.textContent = e?.message || "Could not add subject. Please try again.";
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.prevHtml || 'Create Subject';
      }
    }
  });
}

function setupStudentDashboard() {
  console.log("PAGE INIT RUNNING: setupStudentDashboard() called");

  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();
  void initLearniqDashboardIfPresent();

const emptyEl = document.getElementById("student-lesson-empty");
const emptyText = document.getElementById("student-lesson-empty-text");
const metaCard = document.getElementById("student-lesson-meta");
const reviewerCard = document.getElementById("student-reviewer-card");
const quizCard = document.getElementById("student-quiz-card");
const activitiesCard = document.getElementById("student-activities-card");
const titleEl = document.getElementById("student-lesson-title");
const filenameEl = document.getElementById("student-lesson-filename");
const reviewerList = document.getElementById("student-reviewer-list");
const activitiesList = document.getElementById("student-activities-list");
const quizProgress = document.getElementById("student-quiz-progress");
const quizBody = document.getElementById("student-quiz-body");
const quizScoreEl = document.getElementById("student-quiz-score");
const workspaceEl = document.getElementById("student-workspace");
const lessonMetaLine = document.getElementById("student-lesson-meta-line");
const lessonPreviewText = document.getElementById("student-lesson-preview-text");
const aiStatusEl = document.getElementById("student-ai-status");
const lessonTabButtons = Array.from(document.querySelectorAll(".workspace-tab"));
const tabLesson = document.getElementById("student-tab-lesson");
const tabReviewer = document.getElementById("student-tab-reviewer");
const tabQuiz = document.getElementById("student-tab-quiz");
const tabActivity = document.getElementById("student-tab-activity");


let studentLessons = []; // All published lessons
let studentSubjects = []; // All subjects (with published_lesson_count)
let selectedSubjectId = null; // Currently selected subject (null = show subject grid)
let selectedLesson = null; // Currently selected lesson
let activeContentType = null; // Controls which section is displayed: "reviewer", "quiz", "activity", or null
let lessonData = null; // Legacy - for backward compatibility
let quizIndex = 0;
let quizScore = 0;
  let quizAnswered = false;
  let studentAnswers = []; // Track all student answers
  let studentAiAbortController = null;

  const quizSettingsModal = document.getElementById("student-quiz-settings-modal");
  const quizSettingsClose = document.getElementById("student-quiz-settings-close");
  const quizSettingsCancel = document.getElementById("student-quiz-generate-cancel");
  const quizSettingsConfirm = document.getElementById("student-quiz-generate-confirm");
  const quizCountSelect = document.getElementById("student-quiz-count");
  const quizDifficultySelect = document.getElementById("student-quiz-difficulty");

  const activitySettingsModal = document.getElementById("student-activity-settings-modal");
  const activitySettingsClose = document.getElementById("student-activity-settings-close");
  const activitySettingsCancel = document.getElementById("student-activity-generate-cancel");
  const activitySettingsConfirm = document.getElementById("student-activity-generate-confirm");
  const activityTypeSelect = document.getElementById("student-activity-type");
  const activityCountSelect = document.getElementById("student-activity-count");

  function openModal(el) {
    if (!el) return;
    el.removeAttribute("hidden");
  }

  function closeModal(el) {
    if (!el) return;
    el.setAttribute("hidden", "");
  }

  function getActiveStudentLessons() {
  if (!selectedSubjectId) return studentLessons;
  if (String(selectedSubjectId) === "__unassigned__") {
    return studentLessons.filter((l) => !l.subject_id);
  }
  return studentLessons.filter((l) => String(l.subject_id || "") === String(selectedSubjectId));
}

function updateMyLessonHeaderForSubject() {
  const headerTitle = document.getElementById("student-lesson-panel-title");
  const headerSubtitle = document.getElementById("student-lesson-panel-subtitle");
  const backLink = document.getElementById("student-back-to-subjects-link");

  if (selectedSubjectId) {
    if (backLink) backLink.hidden = false;
    const subjectMeta = studentSubjects.find((s) => String(s.id) === String(selectedSubjectId));
    const name = subjectMeta?.name
      || (String(selectedSubjectId) === "__unassigned__" ? "Unassigned" : null);
    if (headerTitle) headerTitle.textContent = name ? `${name} Lessons` : "My Lesson";
    if (headerSubtitle) {
      headerSubtitle.textContent = "Open a published lesson to review, take a quiz, or do an activity.";
    }
  } else {
    if (backLink) backLink.hidden = true;
    if (headerTitle) headerTitle.textContent = "My Lesson";
    if (headerSubtitle) {
      headerSubtitle.textContent = "Open a published lesson to review, take a quiz, or do an activity.";
    }
  }
}

function renderLessonSelection() {
  console.log("DEBUG: renderLessonSelection called");
  console.log("DEBUG: studentLessons length:", studentLessons.length);

  const selectionEl = document.getElementById("student-lesson-selection");
  const lessonListEl = document.getElementById("student-lesson-list");
  const subjectEmptyEl = document.getElementById("student-lesson-empty-for-subject");
  const titleEl = document.getElementById("student-lesson-selection-title");
  const subtitleEl = document.getElementById("student-lesson-selection-subtitle");

  if (!selectionEl || !lessonListEl) {
    console.log("DEBUG: Missing DOM elements - aborting render");
    return;
  }

  updateMyLessonHeaderForSubject();

  const lessons = getActiveStudentLessons();
  selectionEl.hidden = false;

  const subjectMeta = selectedSubjectId
    ? studentSubjects.find((s) => String(s.id) === String(selectedSubjectId))
    : null;
  if (titleEl) {
    titleEl.textContent = subjectMeta?.name
      ? `${subjectMeta.name} · published lessons`
      : "Published lessons";
  }
  if (subtitleEl) {
    subtitleEl.textContent = lessons.length
      ? "Choose a lesson to open your AI-powered workspace."
      : selectedSubjectId
        ? "No lessons published for this subject yet."
        : "No published lessons yet.";
  }

  if (lessons.length === 0) {
    lessonListEl.innerHTML = "";
    if (subjectEmptyEl) subjectEmptyEl.hidden = false;
    return;
  }
  if (subjectEmptyEl) subjectEmptyEl.hidden = true;

  let html = "";
  lessons.forEach((lesson) => {
    const teacherName = lesson.teacher_name || lesson.teacher_id_number || "Teacher";
    const createdLabel = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "Unknown date";
    html += `
    <article class="lesson-card ${selectedLesson?.file_id === lesson.file_id ? 'selected' : ''}"
         data-lesson-id="${lesson.file_id}">
      <div class="lesson-card-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(lesson.filename || 'Untitled Lesson')}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-tag"></i> ${escapeHtml((lesson.file_type || 'Unknown').toUpperCase())}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-calendar"></i> ${createdLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-user"></i> ${escapeHtml(teacherName)}</span>
        </div>
        <p class="lesson-card-tagline">AI Learning Workspace</p>
        <p class="lesson-card-features small-note">Review • Quiz • Activities</p>
      </div>
      <div class="lesson-actions">
        <button class="btn btn-primary btn-small" onclick="selectLessonById('${lesson.file_id}')">Open Workspace</button>
      </div>
    </article>
  `;
  });

  lessonListEl.innerHTML = html;
}

function selectLessonById(lessonId) {
  const lesson = studentLessons.find(l => l.file_id === lessonId);
  if (lesson) {
    selectLesson(lesson);
  }
}

async function selectLesson(lesson) {
  selectedLesson = lesson;
  lessonData = lesson; // Update legacy for compatibility
  activeContentType = "lesson";
  
  console.log("Selected lesson:", selectedLesson); // Debug: Log selected lesson
  
  // Update UI
  renderLessonSelection();
  showLessonSelection(lesson);
  
  if (workspaceEl) workspaceEl.hidden = false;
  if (lessonMetaLine) {
    const createdLabel = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "Unknown date";
    lessonMetaLine.textContent = `${lesson.file_type?.toUpperCase() || "UNKNOWN"} • Uploaded ${createdLabel}`;
  }
  if (lessonPreviewText) {
    lessonPreviewText.textContent = (lesson.extracted_text || "").trim().slice(0, 420) || "Lesson preview is not available yet for this file.";
  }
  showContentSection("lesson");
  await refreshSelectedLessonContent();
  
  // Show success message
  showToast(`Selected: ${lesson.filename || "Lesson"}`, "success");
}

// Make functions globally accessible for inline onclick handlers
window.selectLessonById = selectLessonById;
window.selectLesson = selectLesson;

function renderDashboardOverview() {
  const selectionEl = document.getElementById("student-lesson-selection");

  if (emptyEl) emptyEl.hidden = true;
  if (selectionEl) selectionEl.hidden = true;
  if (metaCard) metaCard.hidden = true;
  if (workspaceEl) workspaceEl.hidden = true;
  if (reviewerCard) reviewerCard.hidden = true;
  if (quizCard) quizCard.hidden = true;
  if (activitiesCard) activitiesCard.hidden = true;
}

function showLessonSelection(lesson) {
  if (emptyEl) emptyEl.hidden = true;
  if (metaCard) metaCard.hidden = false;
  if (workspaceEl) workspaceEl.hidden = false;
  if (titleEl) titleEl.textContent = "AI Lesson Workspace";
  if (filenameEl) filenameEl.textContent = lesson.filename || "Selected lesson";
}

function showEmpty(message) {
    lessonData = null;
    selectedLesson = null;
    activeContentType = null;
    const selectionEl = document.getElementById("student-lesson-selection");
    if (selectionEl) selectionEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = message;
    if (metaCard) metaCard.hidden = true;
    if (workspaceEl) workspaceEl.hidden = true;
    if (reviewerCard) reviewerCard.hidden = true;
    if (quizCard) quizCard.hidden = true;
    if (activitiesCard) activitiesCard.hidden = true;
  }

  function closeActionModal() {}

  function showLesson(data) {
    console.log("[DEBUG] showLesson called with data:", data);
    console.log("[DEBUG] data.activities value:", data.activities);
    console.log("[DEBUG] Type of data.activities:", typeof data.activities);
    console.log("[DEBUG] Is data.activities an array?", Array.isArray(data.activities));
    
    lessonData = data;
    if (emptyEl) emptyEl.hidden = true;
    if (metaCard) metaCard.hidden = false;
    if (reviewerCard) reviewerCard.hidden = false;
    if (quizCard) quizCard.hidden = false;
    if (activitiesCard) activitiesCard.hidden = false;

    if (titleEl) titleEl.textContent = "Your class lesson";
    if (filenameEl) filenameEl.textContent = data.filename || "";

    if (reviewerList) {
      if (typeof mountReviewerMarkdownInto === "function") {
        mountReviewerMarkdownInto(reviewerList, data.reviewer);
      } else {
        reviewerList.innerHTML = `<p>${escapeHtml(String(data.reviewer || ""))}</p>`;
      }
      const pdfBtn = document.getElementById("student-download-reviewer-pdf-btn");
      if (pdfBtn && typeof setReviewerPdfButtonVisible === "function") {
        const has =
          typeof normalizeReviewerMarkdown === "function"
            ? normalizeReviewerMarkdown(data.reviewer).length > 0
            : Boolean(String(data.reviewer || "").trim());
        setReviewerPdfButtonVisible(pdfBtn, has);
      }
    }

    if (activitiesList) {
      const acts = data.activities || [];
      console.log("[DEBUG] Rendering activities. acts:", acts);
      console.log("[DEBUG] activitiesList element:", activitiesList);
      activitiesList.innerHTML = acts
        .map(
          (item, i) => {
            // Handle both old string format and new structured format
            if (typeof item === 'string') {
              return `
                <div class="activity-item">
                  <strong>Activity ${i + 1}</strong>
                  <p>${escapeHtml(item)}</p>
                </div>`;
            } else if (typeof item === 'object' && item !== null) {
              if (item.activity_type === "matching" && Array.isArray(item.pairs)) {
                const pairs = item.pairs
                  .slice(0, 10)
                  .map((p) => `<li><strong>${escapeHtml(p.left || "")}</strong> — ${escapeHtml(p.right || "")}</li>`)
                  .join("");
                return `
                  <div class="activity-item">
                    <strong>Matching Type</strong>
                    <span class="small-note">Match the pairs below</span>
                    <ul class="small-note" style="margin:0.6rem 0 0; padding-left:1.2rem;">
                      ${pairs || "<li>—</li>"}
                    </ul>
                  </div>`;
              }

              if (Object.prototype.hasOwnProperty.call(item, "question") && Object.prototype.hasOwnProperty.call(item, "answer")) {
                const ans =
                  typeof item.answer === "boolean"
                    ? item.answer
                      ? "True"
                      : "False"
                    : item.answer == null
                    ? "—"
                    : String(item.answer);
                return `
                  <div class="activity-item">
                    <strong>${escapeHtml((item.activity_type || "activity").replace("_", " "))} ${i + 1}</strong>
                    <p>${escapeHtml(item.question || "")}</p>
                    <small>Answer: ${escapeHtml(ans)}</small>
                  </div>`;
              }

              return `
                <div class="activity-item">
                  <strong>${escapeHtml(item.title || `Activity ${i + 1}`)}</strong>
                  <span class="small-note">${escapeHtml(item.activity_type || 'activity')}</span>
                  <div class="activity-instructions">
                    <em>${escapeHtml(item.instructions || '')}</em>
                  </div>
                  <p>${escapeHtml(item.question_or_task || '')}</p>
                </div>`;
            } else {
              return `
                <div class="activity-item">
                  <strong>Activity ${i + 1}</strong>
                  <p>${escapeHtml(String(item))}</p>
                </div>`;
            }
          }
        )
        .join("") || '<p class="small-note">No activities yet.</p>';
      console.log("[DEBUG] activitiesList.innerHTML after render:", activitiesList.innerHTML);
    }

    quizIndex = 0;
    quizScore = 0;
    quizAnswered = false;
    studentAnswers = []; // Initialize answer tracking
    renderStudentQuiz();
  }

  function focusStudentSection(action) {
    const target =
      action === "reviewer" ? tabReviewer : action === "quiz" ? tabQuiz : action === "activity" ? tabActivity : tabLesson;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateReviewerDisplay(reviewerData) {
    if (!reviewerList) return;
    if (typeof mountReviewerMarkdownInto === "function") {
      mountReviewerMarkdownInto(reviewerList, reviewerData);
    } else {
      reviewerList.innerHTML = `<p>${escapeHtml(String(reviewerData || ""))}</p>`;
    }
    const pdfBtn = document.getElementById("student-download-reviewer-pdf-btn");
    if (pdfBtn && typeof setReviewerPdfButtonVisible === "function") {
      const has =
        typeof normalizeReviewerMarkdown === "function"
          ? normalizeReviewerMarkdown(reviewerData).length > 0
          : Boolean(String(reviewerData || "").trim());
      setReviewerPdfButtonVisible(pdfBtn, has);
    }
  }

  function updateActivitiesDisplay(activitiesData) {
    if (!activitiesList) return;
    const activitiesArray = Array.isArray(activitiesData) ? activitiesData : [activitiesData];
    activitiesList.innerHTML = activitiesArray
      .map(
        (item, i) => `
      <div class="activity-item">
        <strong>Activity ${i + 1}</strong>
        <p>${escapeHtml(item)}</p>
      </div>`
      )
      .join("") || '<p class="small-note">No activities yet.</p>';
  }

  function renderStudentQuiz() {
    const questions = (lessonData && lessonData.quiz) || [];
    if (!questions.length) {
      if (quizProgress) quizProgress.textContent = "";
      quizBody.innerHTML = '<p class="small-note">No quiz questions yet. Your teacher may still be adding them.</p>';
      if (quizScoreEl) quizScoreEl.textContent = "";
      return;
    }

    // Initialize studentAnswers array if needed
    if (studentAnswers.length !== questions.length) {
      studentAnswers = new Array(questions.length).fill(null);
    }

    if (quizProgress) quizProgress.textContent = `Question ${quizIndex + 1} of ${questions.length}`;
    if (quizScoreEl) quizScoreEl.textContent = "";

    const q = questions[quizIndex];
    if (!q || !q.question) {
      quizBody.innerHTML = '<p class="small-note">Invalid question data.</p>';
      return;
    }

    const choices = Array.isArray(q.choices) ? q.choices : [];
    const letters = ["A", "B", "C", "D"];
    const radios = choices
      .map(
        (c, i) => `
      <label class="small-note" style="display:block;margin:0.35rem 0;">
        <input type="radio" name="student-quiz-opt" value="${letters[i] || i}" />
        ${escapeHtml(c)}
      </label>`
      )
      .join("");

    const saved = studentAnswers[quizIndex];
    const checkedAttr = (val) => (saved === val ? "checked" : "");

    quizBody.innerHTML = `
      <p><strong>${escapeHtml(q.question)}</strong></p>
      ${choices
        .map(
          (c, i) => `
        <label class="small-note" style="display:block;margin:0.35rem 0;">
          <input type="radio" name="student-quiz-opt" value="${letters[i] || i}" ${checkedAttr(letters[i])} />
          ${escapeHtml(c)}
        </label>`
        )
        .join("")}
      <div class="button-group" style="margin-top:0.75rem;">
        <button type="button" class="btn btn-secondary" id="student-quiz-prev-btn" ${quizIndex === 0 ? "disabled" : ""}>Previous</button>
        <button type="button" class="btn btn-primary" id="student-quiz-next-btn">${
          quizIndex + 1 >= questions.length ? "Submit Quiz" : "Next"
        }</button>
      </div>
    `;

    function saveCurrentAnswer() {
      const picked = document.querySelector('input[name="student-quiz-opt"]:checked');
      studentAnswers[quizIndex] = picked ? String(picked.value) : null;
    }

    function renderResults() {
      // Evaluate all answers on submit
      let correct = 0;
      const rows = questions
        .map((question, idx) => {
          const your = studentAnswers[idx];
          const correctAns = String(question.answer || "").trim().toUpperCase();
          const ok = your && correctAns && String(your).toUpperCase() === correctAns;
          if (ok) correct += 1;
          const yourLabel = your ? String(your).toUpperCase() : "—";
          const mark = ok ? "✅" : "❌";
          return `
            <div class="activity-item" style="margin-top:0.75rem;">
              <strong>Q${idx + 1}. ${escapeHtml(question.question || "")}</strong>
              <p class="small-note" style="margin:0.35rem 0 0;">Your Answer: ${escapeHtml(yourLabel)} ${mark}</p>
              <p class="small-note" style="margin:0.15rem 0 0;">Correct Answer: ${escapeHtml(correctAns || "—")} ✅</p>
            </div>
          `;
        })
        .join("");

      const total = questions.length;
      const pct = Math.round((correct / Math.max(1, total)) * 100);
      if (quizProgress) quizProgress.textContent = "Results";
      if (quizScoreEl) quizScoreEl.textContent = `Score: ${correct} / ${total} (${pct}%)`;

      try {
        if (typeof recordStudentHistory === "function") {
          const questionsSnapshot = questions.map((question, idx) => ({
            question: String(question?.question || ""),
            choices: Array.isArray(question?.choices) ? question.choices.map((c) => String(c)) : [],
            answer: String(question?.answer || "").trim().toUpperCase(),
            student_answer: studentAnswers[idx] ? String(studentAnswers[idx]).toUpperCase() : null,
          }));
          recordStudentHistory("quiz", {
            lesson_id: selectedLesson?.file_id || selectedLesson?.lesson_id || null,
            lesson_title: selectedLesson?.title || selectedLesson?.filename || "Lesson",
            subject_name: selectedLesson?.subject_name || "",
            score: correct,
            total,
            questions: questionsSnapshot,
          });
        }
      } catch (e) {
        console.warn("recordStudentHistory(quiz) failed:", e);
      }

      try {
        const lessonIdForBackend = selectedLesson?.file_id || selectedLesson?.lesson_id;
        if (lessonIdForBackend) {
          const session =
            typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
          const idNumber = String(session?.id_number || "").trim() || null;
          fetch(apiUrl("/quiz-attempt"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lesson_id: lessonIdForBackend,
              score: correct,
              total_questions: total,
              answers: studentAnswers,
              student_id_number: idNumber,
            }),
          }).catch((err) => console.warn("Failed to save quiz attempt to server:", err));
        }
      } catch (e) {
        console.warn("Quiz attempt POST setup failed:", e);
      }

      quizBody.innerHTML = `
        <div class="glass-card" style="padding:1rem;border:1px solid rgba(148,163,184,0.18);border-radius:16px;background:rgba(15,23,42,0.35);">
          <h4 style="margin:0 0 0.35rem;">Quiz Results</h4>
          <p class="content-subtitle" style="margin:0;">Score: <strong>${correct} / ${total}</strong></p>
          <p class="content-subtitle" style="margin:0.25rem 0 0;"><strong>${pct}%</strong></p>
        </div>
        <div style="margin-top:1rem;">
          <h4 style="margin:0;">Answer Review</h4>
          <p class="small-note" style="margin:0.25rem 0 0;">Review your answers below.</p>
          ${rows || '<p class="small-note">No questions to review.</p>'}
        </div>
      `;
    }

    document.getElementById("student-quiz-prev-btn")?.addEventListener("click", () => {
      saveCurrentAnswer();
      if (quizIndex > 0) quizIndex -= 1;
      renderStudentQuiz();
    });

    document.getElementById("student-quiz-next-btn")?.addEventListener("click", () => {
      saveCurrentAnswer();
      if (quizIndex + 1 >= questions.length) {
        renderResults();
        return;
      }
      quizIndex += 1;
      renderStudentQuiz();
    });
  }

  async function loadStudentSubjects() {
    try {
      const res = await fetch(apiUrl("/subjects"));
      if (!res.ok) {
        studentSubjects = [];
        return;
      }
      const data = await res.json();
      studentSubjects = Array.isArray(data.subjects) ? data.subjects : [];
    } catch (e) {
      console.log("DEBUG: loadStudentSubjects failed:", e);
      studentSubjects = [];
    }
  }

  function readSelectedSubjectFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get("subject_id");
      return sid && sid.trim() ? sid.trim() : null;
    } catch {
      return null;
    }
  }

  async function loadStudentLessons() {
    console.log("DEBUG: loadStudentLessons called");
    console.log("DEBUG: Current page:", window.location.pathname);
    const currentPath = window.location.pathname;
    const isMyLessonPage = currentPath.includes('my-lesson.html');
    if (!isMyLessonPage) {
      renderDashboardOverview();
      return;
    }

    // Pin the subject for this page view to whatever is in the URL.
    selectedSubjectId = readSelectedSubjectFromUrl();

    try {
      await loadStudentSubjects();

      console.log("Calling /student/lessons...");
      const apiUrlValue = apiUrl("/student/lessons");
      const res = await fetch(apiUrlValue);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.log("DEBUG: API error:", err);
        studentLessons = [];
        showEmpty(err.error || "No published lessons yet. Ask your teacher to publish one.");
        return;
      }

      const data = await res.json();
      studentLessons = data.lessons || [];
      console.log("Lessons count:", studentLessons.length);

      if (selectedLesson?.file_id) {
        const matched = studentLessons.find((lesson) => lesson.file_id === selectedLesson.file_id);
        if (matched) {
          selectedLesson = { ...selectedLesson, ...matched };
        }
      }

      // When no subject was passed in the URL, default to showing every lesson
      // (legacy behavior). When a subject is pinned, filtering happens inside
      // getActiveStudentLessons().
      if (!selectedSubjectId && studentLessons.length === 0) {
        showEmpty("No published lesson yet. Ask your teacher to publish one.");
        return;
      }
      if (selectedSubjectId && getActiveStudentLessons().length === 0 && studentLessons.length === 0) {
        showEmpty("No published lesson yet for this subject.");
        return;
      }

      if (emptyEl) emptyEl.hidden = true;
      renderLessonSelection();
    } catch (e) {
      console.log("DEBUG: loadStudentLessons error:", e);
      showEmpty("Cannot reach the server. Is the LearnIQ Track backend running?");
    }
  }

  async function loadStudentLesson() {
    try {
      const res = await fetch(apiUrl("/student/lesson"));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showEmpty(err.error || "No published lesson yet. Ask your teacher to publish one.");
        return;
      }
      const data = await res.json();
      showLesson(data);
    } catch {
      showEmpty("Cannot reach the server. Is the LearnIQ Track backend running?");
    }
  }

  
  function showContentSection(contentType) {
    activeContentType = contentType;
    const panelMap = {
      lesson: tabLesson,
      reviewer: tabReviewer,
      quiz: tabQuiz,
      activity: tabActivity
    };
    Object.entries(panelMap).forEach(([key, panel]) => {
      if (!panel) return;
      panel.hidden = key !== contentType;
    });
    lessonTabButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lesson-tab") === contentType);
    });

    switch (contentType) {
      case "lesson":
        if (tabLesson) {
          tabLesson.innerHTML = '<p class="small-note">Use the AI actions to generate reviewer, quiz, and activities for this lesson.</p>';
        }
        break;
      case "reviewer":
        if (
          selectedLesson &&
          (typeof normalizeReviewerMarkdown === "function"
            ? normalizeReviewerMarkdown(selectedLesson.reviewer)
            : String(selectedLesson.reviewer || "").trim())
        ) {
          updateReviewerDisplay(selectedLesson.reviewer);
          try {
            if (typeof recordStudentHistory === "function") {
              recordStudentHistory("reviewer", {
                lesson_id: selectedLesson.file_id || selectedLesson.lesson_id || null,
                lesson_title: selectedLesson.title || selectedLesson.filename || "Lesson",
                subject_name: selectedLesson.subject_name || "",
              });
            }
          } catch (e) {
            console.warn("recordStudentHistory(reviewer) failed:", e);
          }
        } else {
          if (reviewerList) {
            reviewerList.innerHTML =
              '<p class="small-note">No reviewer content yet. Click &quot;Generate Reviewer&quot;.</p>';
          }
          const pdfBtn = document.getElementById("student-download-reviewer-pdf-btn");
          if (pdfBtn) pdfBtn.hidden = true;
        }
        break;
      case "quiz":
        if (selectedLesson && selectedLesson.quiz && selectedLesson.quiz.length > 0) {
          lessonData = selectedLesson;
          renderStudentQuiz();
        } else {
          if (quizBody) quizBody.innerHTML = '<p class="small-note">No quiz questions yet. Click "Generate Quiz".</p>';
          if (quizProgress) quizProgress.textContent = "";
          if (quizScoreEl) quizScoreEl.textContent = "";
        }
        break;
      case "activity":
        if (selectedLesson && selectedLesson.activities && selectedLesson.activities.length > 0) {
          updateActivitiesDisplay(selectedLesson.activities);
          try {
            if (typeof recordStudentHistory === "function") {
              recordStudentHistory("activity", {
                lesson_id: selectedLesson.file_id || selectedLesson.lesson_id || null,
                lesson_title: selectedLesson.title || selectedLesson.filename || "Lesson",
                subject_name: selectedLesson.subject_name || "",
                activity_count: selectedLesson.activities.length,
              });
            }
          } catch (e) {
            console.warn("recordStudentHistory(activity) failed:", e);
          }
        } else {
          if (activitiesList) activitiesList.innerHTML = '<p class="small-note">No activities yet. Click "Generate Activity".</p>';
        }
        break;
    }
  }

  async function refreshSelectedLessonContent() {
    if (!selectedLesson?.file_id) return;
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(selectedLesson.file_id)}`));
    if (!res.ok) return;
    const payload = await res.json();
    selectedLesson = {
      ...selectedLesson,
      reviewer: payload.reviewer ?? "",
      quiz: payload.quiz || [],
      activities: payload.activities || []
    };
    lessonData = selectedLesson;
  }

  async function runStudentAiAction(actionType) {
    if (!selectedLesson?.file_id) {
      showToast("Please open a lesson workspace first.", "error");
      return;
    }

    const endpointUrl =
      actionType === "reviewer"
        ? apiUrl("/generate-reviewer")
        : actionType === "quiz"
        ? apiUrl("/generate-question")
        : apiUrl("/generate-activities");

    const requestPayload = { file_id: selectedLesson.file_id };
    if (actionType === "quiz") {
      requestPayload.quiz_count = Number(quizCountSelect?.value || 10);
      const diff = (quizDifficultySelect?.value || "").trim();
      if (diff) requestPayload.difficulty = diff;
    }
    if (actionType === "activity") {
      requestPayload.activity_type = (activityTypeSelect?.value || "short_answer").trim();
      requestPayload.count = Number(activityCountSelect?.value || 5);
    }

    console.log("STARTING AI GENERATION");
    console.log("AI actionType:", actionType);
    console.log("AI endpoint URL:", endpointUrl);
    console.log("AI payload:", requestPayload);
    console.log("Selected lesson:", selectedLesson);

    const actionMap = {
      reviewer: {
        button: document.getElementById("student-generate-reviewer-btn"),
        endpoint: "/generate-reviewer",
        loading: "Generating reviewer with AI...",
        done: "Reviewer generated."
      },
      quiz: {
        button: document.getElementById("student-generate-quiz-btn"),
        endpoint: "/generate-question",
        loading: "Creating quiz questions...",
        done: "Quiz generated."
      },
      activity: {
        button: document.getElementById("student-generate-activity-btn"),
        endpoint: "/generate-activities",
        loading: "Preparing activities...",
        done: "Activities generated."
      }
    };

    const config = actionMap[actionType];
    if (!config) return;
    const btn = config.button;
    const originalText = btn ? btn.innerHTML : "";
    const cancelAiBtn = document.getElementById("student-ai-cancel-btn");

    studentAiAbortController?.abort();
    studentAiAbortController = new AbortController();
    const { signal } = studentAiAbortController;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loader"></span> Working...';
    }
    if (cancelAiBtn) {
      cancelAiBtn.hidden = false;
      cancelAiBtn.disabled = false;
    }
    if (aiStatusEl) aiStatusEl.textContent = config.loading;

    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal
      });

      console.log("AI RESPONSE STATUS:", res.status);

      const payload = await res.json().catch(() => ({}));
      console.log("AI RESPONSE DATA:", payload);

      if (!res.ok) {
        const errValue = payload?.error ?? payload?.message ?? payload;
        const errMsg =
          typeof errValue === "string"
            ? errValue
            : errValue && typeof errValue === "object"
            ? JSON.stringify(errValue)
            : `Request failed (HTTP ${res.status})`;
        throw new Error(errMsg);
      }

      await refreshSelectedLessonContent();
      if (actionType === "quiz") {
        quizIndex = 0;
        quizScore = 0;
        quizAnswered = false;
        studentAnswers = [];
        lessonData = selectedLesson;
      }
      showContentSection(actionType);
      if (aiStatusEl) aiStatusEl.textContent = config.done;
      showToast(config.done, "success");
    } catch (error) {
      console.error("AI Generation Error:", error);
      if (error?.name === "AbortError" || signal.aborted) {
        if (aiStatusEl) aiStatusEl.textContent = "Generation cancelled.";
        showToast("Generation cancelled.", "info");
      } else {
        const msg =
          error && typeof error === "object" && "message" in error
            ? String(error.message || "Unknown error")
            : String(error || "Unknown error");
        if (aiStatusEl) aiStatusEl.textContent = `Generation failed: ${msg}`;
        showToast(`Failed to generate ${actionType}: ${msg}`, "error");
      }
    } finally {
      studentAiAbortController = null;
      if (cancelAiBtn) {
        cancelAiBtn.hidden = true;
        cancelAiBtn.disabled = true;
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  // Handle generation button click
  const generateBtn = document.getElementById("generate-btn");
  const cancelGenerationBtn = document.getElementById("cancel-generation-btn");
  
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      const generationOptions = document.querySelector(".generation-options");
      const action = generationOptions.dataset.currentAction;
      
      if (!action || !selectedLesson?.file_id) {
        showToast("Please select a lesson first.", "error");
        return;
      }

      // Disable button and show loading
      generateBtn.disabled = true;
      const originalText = generateBtn.innerHTML;
      generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
      
      try {
        const fileId = selectedLesson.file_id;
        let requestBody = { file_id: fileId };
        
        // Add parameters based on action type
        if (action === "quiz") {
          const quizCount = document.getElementById("quiz-count").value;
          requestBody.quiz_count = parseInt(quizCount);
        } else if (action === "activity") {
          const activityType = document.getElementById("activity-type").value;
          requestBody.activity_type = activityType;
        }

        let response;
        switch (action) {
          case "reviewer":
            response = await fetch(apiUrl("/generate-reviewer"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody)
            });
            break;
          case "quiz":
            response = await fetch(apiUrl("/generate-question"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody)
            });
            break;
          case "activity":
            response = await fetch(apiUrl("/generate-activities"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody)
            });
            break;
          default:
            return;
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || `Failed to generate ${action}`);
        }

        const result = await response.json();
        console.log(`[DEBUG] ${action} API response:`, result);
        
        // Reload lesson data from database to ensure consistency
        console.log("[DEBUG] Reloading lesson data...");
        await loadStudentLessons(); // Reload all lessons to maintain selection state
        console.log(`[DEBUG] Lesson data reloaded. ${action}:`, selectedLesson?.[action === 'quiz' ? 'quiz' : 'activities']);
        
        // Close modal and focus section
        closeActionModal();
        focusStudentSection(action);
        
        // Show success message with details
        let successMessage = `Successfully generated ${action}!`;
        if (action === "quiz" && result.count) {
          successMessage += ` Created ${result.count} questions.`;
        } else if (action === "activity" && result.total_activities) {
          successMessage += ` Total activities: ${result.total_activities}.`;
        }
        showToast(successMessage, "success");
        
      } catch (error) {
        console.error(`Error generating ${action}:`, error);
        showToast(`Failed to generate ${action}: ${error.message}`, "error");
      } finally {
        // Restore button and reset modal
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;
        closeActionModal();
      }
    });
  }
  
  // Handle cancel button click
  if (cancelGenerationBtn) {
    cancelGenerationBtn.addEventListener("click", () => {
      closeActionModal();
    });
  }
  document.getElementById("student-refresh-lesson-btn")?.addEventListener("click", () => {
    loadStudentLessons();
  });
  lessonTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-lesson-tab");
      if (!tab) return;
      showContentSection(tab);
    });
  });
  document.getElementById("student-ai-cancel-btn")?.addEventListener("click", () => {
    studentAiAbortController?.abort();
  });
  document.getElementById("student-generate-reviewer-btn")?.addEventListener("click", () => {
    runStudentAiAction("reviewer");
  });
  document.getElementById("student-download-reviewer-pdf-btn")?.addEventListener("click", () => {
    if (!reviewerList || typeof downloadReviewerPdfFromElement !== "function") return;
    downloadReviewerPdfFromElement(reviewerList, selectedLesson?.filename || "reviewer");
  });
  document.getElementById("student-generate-quiz-btn")?.addEventListener("click", () => {
    openModal(quizSettingsModal);
  });
  document.getElementById("student-generate-activity-btn")?.addEventListener("click", () => {
    openModal(activitySettingsModal);
  });

  quizSettingsClose?.addEventListener("click", () => closeModal(quizSettingsModal));
  quizSettingsCancel?.addEventListener("click", () => closeModal(quizSettingsModal));
  quizSettingsConfirm?.addEventListener("click", async () => {
    closeModal(quizSettingsModal);
    await runStudentAiAction("quiz");
  });

  activitySettingsClose?.addEventListener("click", () => closeModal(activitySettingsModal));
  activitySettingsCancel?.addEventListener("click", () => closeModal(activitySettingsModal));
  activitySettingsConfirm?.addEventListener("click", async () => {
    closeModal(activitySettingsModal);
    await runStudentAiAction("activity");
  });
  loadStudentLessons();
}

async function renderAiResultPage() {
  const reviewerList = document.querySelector("#reviewer-result");
  const quizList = document.querySelector("#quiz-result");
  const activitiesList = document.querySelector("#activities-result");
  if (!reviewerList || !quizList || !activitiesList) return;

  hydrateStudentSidebarChip();

  const params = new URLSearchParams(window.location.search);
  let fileId = params.get("file_id") || localStorage.getItem(TEACHER_FILE_STORAGE_KEY);
  if (!fileId) {
    reviewerList.innerHTML =
      '<p class="small-note">Go to the Teacher Dashboard, select or upload a lesson, then open this page again.</p>';
    quizList.innerHTML = "<li>—</li>";
    activitiesList.innerHTML = "<li>—</li>";
    return;
  }

  const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(fileId)}`));
  if (!res.ok) {
    reviewerList.innerHTML = '<p class="small-note">Could not load this lesson.</p>';
    quizList.innerHTML = "<li>—</li>";
    activitiesList.innerHTML = "<li>—</li>";
    return;
  }

  const payload = await res.json();
  const pdfBtn = document.getElementById("ai-result-download-reviewer-pdf");
  if (typeof mountReviewerMarkdownInto === "function") {
    mountReviewerMarkdownInto(reviewerList, payload.reviewer);
  } else {
    reviewerList.innerHTML = `<div class="reviewer-markdown-body"><p>${escapeHtml(
      String(payload.reviewer || "")
    )}</p></div>`;
  }
  if (pdfBtn && typeof setReviewerPdfButtonVisible === "function") {
    const has =
      typeof normalizeReviewerMarkdown === "function"
        ? normalizeReviewerMarkdown(payload.reviewer).length > 0
        : Boolean(String(payload.reviewer || "").trim());
    setReviewerPdfButtonVisible(pdfBtn, has);
    pdfBtn.onclick = () => {
      if (typeof downloadReviewerPdfFromElement === "function") {
        downloadReviewerPdfFromElement(reviewerList, payload.filename || "reviewer");
      }
    };
  }

  const quiz = Array.isArray(payload.quiz) ? payload.quiz : [];
  quizList.innerHTML = quiz.length
    ? quiz
        .map(
          (item) => `
        <li>
          <strong>${escapeHtml(item.question)}</strong><br />
          <span>${(item.choices || []).map((c) => escapeHtml(c)).join(" • ")}</span><br />
          <small>Answer: ${escapeHtml(item.answer)}</small>
        </li>
      `
        )
        .join("")
    : "<li>No quiz items yet.</li>";

  const acts = Array.isArray(payload.activities) ? payload.activities : [];
  activitiesList.innerHTML =
    acts.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No activities yet.</li>";
}

// =====================================================================
// Student History (Quiz / Reviewer / Activity)
// =====================================================================

const STUDENT_HISTORY_KEYS = {
  quiz: "learniq_history_quiz",
  reviewer: "learniq_history_reviewer",
  activity: "learniq_history_activity",
};
const STUDENT_HISTORY_MAX_PER_TYPE = 100;
let activeHistoryTab = "quiz";
let currentHistoryDetailContext = null;

function getStudentHistoryUserKey() {
  try {
    const session = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const idn = String(session?.id_number || "").trim();
    return idn ? `:${idn}` : "";
  } catch {
    return "";
  }
}

function readStudentHistoryList(type) {
  try {
    const baseKey = STUDENT_HISTORY_KEYS[type];
    if (!baseKey) return [];
    const key = `${baseKey}${getStudentHistoryUserKey()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStudentHistoryList(type, list) {
  try {
    const baseKey = STUDENT_HISTORY_KEYS[type];
    if (!baseKey) return;
    const key = `${baseKey}${getStudentHistoryUserKey()}`;
    const capped = Array.isArray(list) ? list.slice(0, STUDENT_HISTORY_MAX_PER_TYPE) : [];
    localStorage.setItem(key, JSON.stringify(capped));
  } catch (e) {
    console.warn("writeStudentHistoryList failed:", e);
  }
}

function recordStudentHistory(type, payload) {
  if (!STUDENT_HISTORY_KEYS[type]) return;
  const entry = {
    ...(payload || {}),
    timestamp: new Date().toISOString(),
  };
  const list = readStudentHistoryList(type);

  // For reviewer/activity, avoid spam by collapsing repeat opens of the same
  // lesson within a 5-minute window into the most recent entry.
  if (type !== "quiz" && list.length > 0) {
    const last = list[0];
    const sameLesson = String(last.lesson_id || "") === String(payload?.lesson_id || "");
    const lastTime = last.timestamp ? new Date(last.timestamp).getTime() : 0;
    const recently = Date.now() - lastTime < 5 * 60 * 1000;
    if (sameLesson && recently) {
      list[0] = entry;
      writeStudentHistoryList(type, list);
      if (typeof updateStudentHistoryTabCounts === "function") updateStudentHistoryTabCounts();
      return;
    }
  }

  list.unshift(entry);
  writeStudentHistoryList(type, list);
  if (typeof updateStudentHistoryTabCounts === "function") updateStudentHistoryTabCounts();
}

function formatHistoryTimestamp(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function buildHistoryItemHtml(type, item, index) {
  const title = escapeHtml(String(item.lesson_title || item.title || "Lesson"));
  const subject = item.subject_name
    ? `<span class="history-pill">${escapeHtml(item.subject_name)}</span>`
    : "";
  const when = formatHistoryTimestamp(item.timestamp);
  let iconHtml = "";
  let summary = "";

  if (type === "quiz") {
    const score = Number(item.score || 0);
    const total = Number(item.total || 0);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    iconHtml = '<i class="fa-solid fa-clipboard-question" aria-hidden="true"></i>';
    summary = `<span class="history-summary-pill">Score <strong>${score}/${total}</strong> &nbsp;<span class="small-note">(${pct}%)</span></span>`;
  } else if (type === "reviewer") {
    iconHtml = '<i class="fa-solid fa-book" aria-hidden="true"></i>';
    summary = '<span class="small-note">Reviewer opened</span>';
  } else if (type === "activity") {
    iconHtml = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
    summary = '<span class="small-note">Activity opened</span>';
  }

  return `
    <button type="button" class="history-item" data-history-type="${escapeHtml(type)}" data-history-index="${index}" aria-label="View ${escapeHtml(type)} details for ${title}">
      <span class="history-item-icon">${iconHtml}</span>
      <span class="history-item-body">
        <span class="history-item-header">
          <span class="history-item-title">${title}</span>
          ${subject}
        </span>
        <span class="history-item-summary-line">${summary}</span>
      </span>
      <span class="history-item-date">
        <i class="fa-regular fa-clock" aria-hidden="true"></i>
        <span>${escapeHtml(when)}</span>
      </span>
      <span class="history-item-chevron" aria-hidden="true">
        <i class="fa-solid fa-chevron-right"></i>
      </span>
    </button>
  `;
}

function renderStudentHistoryList(type) {
  const host = document.getElementById("history-list-host");
  if (!host) return;
  const list = readStudentHistoryList(type);
  if (!list.length) {
    const labels = {
      quiz: {
        title: "No quiz history yet",
        body: "When you submit a quiz, it will appear here.",
      },
      reviewer: {
        title: "No reviewer history yet",
        body: "Open a reviewer from any lesson and it will appear here.",
      },
      activity: {
        title: "No activity history yet",
        body: "Open an activity from any lesson and it will appear here.",
      },
    };
    const l = labels[type] || labels.quiz;
    host.innerHTML = `
      <article class="glass-card content-card history-empty">
        <h3>${l.title}</h3>
        <p class="content-subtitle">${l.body}</p>
      </article>
    `;
    return;
  }
  host.innerHTML = list.map((item, idx) => buildHistoryItemHtml(type, item, idx)).join("");
}

// --- History detail modal ---

function openHistoryDetailModal() {
  const modal = document.getElementById("history-detail-modal");
  if (!modal) return;
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
}

function closeHistoryDetailModal() {
  const modal = document.getElementById("history-detail-modal");
  if (!modal) return;
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
}

function setHistoryDetailHeader(title, subtitle) {
  const titleEl = document.getElementById("history-detail-title");
  const subEl = document.getElementById("history-detail-subtitle");
  if (titleEl) titleEl.textContent = title || "Details";
  if (subEl) subEl.textContent = subtitle || "";
}

function setHistoryDetailBody(html) {
  const body = document.getElementById("history-detail-body");
  if (body) body.innerHTML = html;
}

function renderQuizDetailIntoModal(item) {
  const questions = Array.isArray(item?.questions) ? item.questions : [];
  const score = Number(item?.score || 0);
  const total = Number(item?.total || 0);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const summary = `
    <div class="history-detail-score-card">
      <div>
        <p class="small-note" style="margin:0;">Final score</p>
        <h2 style="margin:0.15rem 0 0;">${score} / ${total}</h2>
      </div>
      <div class="history-detail-score-pct">
        <strong>${pct}%</strong>
      </div>
    </div>
  `;

  if (!questions.length) {
    setHistoryDetailBody(`
      ${summary}
      <p class="small-note" style="margin-top:1rem;">No question details were saved for this attempt.</p>
    `);
    return;
  }

  const rows = questions
    .map((q, i) => {
      const studentAns = q.student_answer ? String(q.student_answer).toUpperCase() : "—";
      const correctAns = String(q.answer || "").trim().toUpperCase();
      const ok = studentAns !== "—" && studentAns === correctAns;
      const choicesHtml = Array.isArray(q.choices)
        ? q.choices
            .map((c, idx) => {
              const letter = ["A", "B", "C", "D", "E"][idx] || String(idx + 1);
              const isStudent = studentAns === letter;
              const isCorrect = correctAns === letter;
              const cls = [
                "history-quiz-choice",
                isStudent ? "is-student" : "",
                isCorrect ? "is-correct" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `<li class="${cls}"><strong>${letter}.</strong> ${escapeHtml(String(c))}</li>`;
            })
            .join("")
        : "";
      return `
        <article class="history-quiz-question">
          <header class="history-quiz-question-head">
            <h4>Q${i + 1}. ${escapeHtml(String(q.question || ""))}</h4>
            <span class="history-quiz-mark ${ok ? "is-ok" : "is-bad"}">
              ${ok ? '<i class="fa-solid fa-circle-check"></i> Correct' : '<i class="fa-solid fa-circle-xmark"></i> Wrong'}
            </span>
          </header>
          <ol class="history-quiz-choices">${choicesHtml}</ol>
          <p class="small-note history-quiz-answer-line">
            Your answer: <strong>${escapeHtml(studentAns)}</strong> &nbsp;·&nbsp;
            Correct answer: <strong>${escapeHtml(correctAns || "—")}</strong>
          </p>
        </article>
      `;
    })
    .join("");

  setHistoryDetailBody(`
    ${summary}
    <div class="history-quiz-list">${rows}</div>
  `);
}

async function renderReviewerDetailIntoModal(item) {
  setHistoryDetailBody('<p class="small-note">Loading reviewer…</p>');
  const lessonId = item?.lesson_id;
  if (!lessonId) {
    setHistoryDetailBody('<p class="small-note">No lesson linked to this entry.</p>');
    return;
  }
  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(lessonId)}`));
    if (!res.ok) {
      setHistoryDetailBody('<p class="small-note">Failed to load reviewer content.</p>');
      return;
    }
    const data = await res.json();
    const reviewer = data?.reviewer;
    const hasReviewer =
      typeof normalizeReviewerMarkdown === "function"
        ? normalizeReviewerMarkdown(reviewer).length > 0
        : Boolean(String(reviewer || "").trim());

    if (!hasReviewer) {
      setHistoryDetailBody('<p class="small-note">No reviewer content available for this lesson anymore.</p>');
      return;
    }

    setHistoryDetailBody('<div id="history-reviewer-target" class="reviewer-markdown-body"></div>');
    const target = document.getElementById("history-reviewer-target");
    if (typeof mountReviewerMarkdownInto === "function") {
      mountReviewerMarkdownInto(target, reviewer);
    } else if (target) {
      target.innerHTML = `<pre>${escapeHtml(String(reviewer || ""))}</pre>`;
    }
  } catch (e) {
    console.warn("renderReviewerDetailIntoModal error:", e);
    setHistoryDetailBody('<p class="small-note">Could not reach the server.</p>');
  }
}

async function renderActivityDetailIntoModal(item) {
  setHistoryDetailBody('<p class="small-note">Loading activity…</p>');
  const lessonId = item?.lesson_id;
  if (!lessonId) {
    setHistoryDetailBody('<p class="small-note">No lesson linked to this entry.</p>');
    return;
  }
  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(lessonId)}`));
    if (!res.ok) {
      setHistoryDetailBody('<p class="small-note">Failed to load activity content.</p>');
      return;
    }
    const data = await res.json();
    const activities = Array.isArray(data?.activities) ? data.activities : [];
    if (!activities.length) {
      setHistoryDetailBody('<p class="small-note">No activities available for this lesson anymore.</p>');
      return;
    }
    const rows = activities
      .map(
        (act, i) => `
          <article class="activity-item history-activity-item">
            <strong>Activity ${i + 1}</strong>
            <p>${escapeHtml(String(act))}</p>
          </article>
        `
      )
      .join("");
    setHistoryDetailBody(`<div class="history-activity-list">${rows}</div>`);
  } catch (e) {
    console.warn("renderActivityDetailIntoModal error:", e);
    setHistoryDetailBody('<p class="small-note">Could not reach the server.</p>');
  }
}

function openHistoryItemDetail(type, index) {
  const list = readStudentHistoryList(type);
  const item = list[Number(index)];
  if (!item) return;
  currentHistoryDetailContext = { type, item };
  const subtitle = [
    item.subject_name ? String(item.subject_name) : "",
    formatHistoryTimestamp(item.timestamp),
  ]
    .filter(Boolean)
    .join(" · ");
  setHistoryDetailHeader(String(item.lesson_title || "Lesson"), subtitle);
  setHistoryDetailBody('<p class="small-note">Loading…</p>');
  openHistoryDetailModal();

  if (type === "quiz") {
    renderQuizDetailIntoModal(item);
  } else if (type === "reviewer") {
    void renderReviewerDetailIntoModal(item);
  } else if (type === "activity") {
    void renderActivityDetailIntoModal(item);
  } else {
    setHistoryDetailBody('<p class="small-note">Nothing to show.</p>');
  }
}

function downloadHistoryDetailAsPdf() {
  const body = document.getElementById("history-detail-body");
  const titleEl = document.getElementById("history-detail-title");
  const subEl = document.getElementById("history-detail-subtitle");
  if (!body) return;

  const ctx = currentHistoryDetailContext || {};
  const type = ctx.type || "history";
  const item = ctx.item || {};
  const lessonTitle = String(item.lesson_title || titleEl?.textContent || "history").trim();
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const baseName = `${typeLabel}_${lessonTitle}`;

  if (typeof html2pdf === "undefined") {
    if (typeof showToast === "function") {
      showToast("PDF export is not ready. Refresh the page and try again.", "error");
    }
    return;
  }

  const clone = document.createElement("div");
  clone.className = "history-pdf-export reviewer-markdown-body";
  const sanitizedTitle = escapeHtml(lessonTitle);
  const sanitizedSubtitle = escapeHtml(String(subEl?.textContent || ""));
  const header = `
    <div class="history-pdf-header">
      <p class="history-pdf-eyebrow">${escapeHtml(typeLabel)} history</p>
      <h1>${sanitizedTitle}</h1>
      ${sanitizedSubtitle ? `<p class="history-pdf-subtitle">${sanitizedSubtitle}</p>` : ""}
    </div>
  `;
  clone.innerHTML = header + body.innerHTML;
  clone.setAttribute("aria-hidden", "true");
  clone.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    "width:190mm",
    "box-sizing:border-box",
    "padding:14mm 14mm",
    "font:11pt/1.55 Inter,system-ui,Segoe UI,sans-serif",
    "background:#ffffff",
    "color:#111827",
  ].join(";");

  document.body.appendChild(clone);

  const safeBase =
    (baseName || "history")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) || "history";

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `${safeBase}.pdf`,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };

  const btn = document.getElementById("history-detail-download");
  const originalHtml = btn ? btn.innerHTML : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparing PDF…';
  }

  html2pdf()
    .set(opt)
    .from(clone)
    .save()
    .then(() => {
      if (typeof showToast === "function") showToast("PDF downloaded.", "success");
    })
    .catch((err) => {
      console.error(err);
      if (typeof showToast === "function") showToast("Could not create PDF. Try again.", "error");
    })
    .finally(() => {
      clone.remove();
      if (btn) {
        btn.disabled = false;
        if (originalHtml !== null) btn.innerHTML = originalHtml;
      }
    });
}

function updateStudentHistoryTabCounts() {
  ["quiz", "reviewer", "activity"].forEach((type) => {
    const el = document.getElementById(`history-tab-count-${type}`);
    if (el) el.textContent = String(readStudentHistoryList(type).length);
  });
}

function setStudentHistoryActiveTab(type) {
  const valid = ["quiz", "reviewer", "activity"];
  if (!valid.includes(type)) type = "quiz";
  activeHistoryTab = type;
  document.querySelectorAll(".workspace-tab[data-history-tab]").forEach((btn) => {
    const tab = btn.getAttribute("data-history-tab");
    const isActive = tab === type;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderStudentHistoryList(type);
}

function setupStudentHistoryPage() {
  if (typeof hydrateStudentSidebarChip === "function") hydrateStudentSidebarChip();
  if (typeof hydrateSidebarProfileFromDatabase === "function") {
    void hydrateSidebarProfileFromDatabase();
  }
  updateStudentHistoryTabCounts();
  setStudentHistoryActiveTab(activeHistoryTab);

  document.querySelectorAll(".workspace-tab[data-history-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-history-tab");
      setStudentHistoryActiveTab(tab);
    });
  });

  const host = document.getElementById("history-list-host");
  if (host && !host.dataset.historyClicksBound) {
    host.dataset.historyClicksBound = "1";
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".history-item[data-history-type]");
      if (!btn) return;
      const type = btn.getAttribute("data-history-type");
      const idx = btn.getAttribute("data-history-index");
      openHistoryItemDetail(type, idx);
    });
  }

  const modal = document.getElementById("history-detail-modal");
  if (modal && !modal.dataset.historyModalBound) {
    modal.dataset.historyModalBound = "1";
    const closeBtn = document.getElementById("history-detail-close");
    if (closeBtn) closeBtn.addEventListener("click", closeHistoryDetailModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeHistoryDetailModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hasAttribute("hidden")) closeHistoryDetailModal();
    });
    const downloadBtn = document.getElementById("history-detail-download");
    if (downloadBtn) downloadBtn.addEventListener("click", downloadHistoryDetailAsPdf);
  }
}

// Expose for other inline pages / debugging.
if (typeof window !== "undefined") {
  window.recordStudentHistory = recordStudentHistory;
  window.setupStudentHistoryPage = setupStudentHistoryPage;
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired:", window.location.pathname);
  animateProgressBars();
  if (document.getElementById("admin-sidebar-name") || document.getElementById("admin-sidebar-avatar")) {
    hydrateAdminSidebarFromSession();
  }
  setupForms();
  setupSignupPage();
  
  // Only run page-specific setup if we're on the correct page
  if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/login')) {
    setupLoginPage();
  }
  if (window.location.pathname.includes('signup.html') || window.location.pathname.endsWith('/signup')) {
    // signupPage is already handled by setupSignupPage()
  }
  if (window.location.pathname.includes('admin-approval.html') || window.location.pathname.includes('admin-dashboard.html')) {
    setupAdminPage();
  }
  if (window.location.pathname.includes('admin-subjects.html')) {
    setupAdminSubjectsPage();
  }
  if (window.location.pathname.includes('teacher-learniq-dashboard.html') || window.location.pathname.includes('teacher-dashboard.html')) {
    setupTeacherDashboard();
  }
  if (window.location.pathname.includes('teacher-subjects.html')) {
    setupTeacherSubjectsPage();
  }
  if (window.location.pathname.includes("immersion-dashboard.html")) {
    setupImmersionDashboard();
  }
  if (window.location.pathname.includes("leaderboard.html")) {
    setupLeaderboardPage();
  }
  if (window.location.pathname.includes("module-selection.html")) {
    setupStudentDashboard();
  }
  if (window.location.pathname.includes('learniq-dashboard.html') || window.location.pathname.includes('my-lesson.html')) {
    setupStudentDashboard();
  }
  if (window.location.pathname.includes('subjects.html')) {
    setupSubjectsPage();
  }
  if (window.location.pathname.includes('history.html')) {
    setupStudentHistoryPage();
  }
  if (
    window.location.pathname.includes("student-settings.html") ||
    window.location.pathname.includes("teacher-settings.html")
  ) {
    hydrateStudentSidebarChip();
  }
  renderAiResultPage();
  setupProfilePage();
});

function setupProfilePage() {
  const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  if (path.includes("admin-profile.html")) {
    hydrateAdminSidebarFromSession();
    const u = getCurrentUserSession();
    const hint = document.getElementById("profile-hint");
    const brandSub = document.getElementById("profile-brand-subtitle");
    const titleEl = document.getElementById("profile-title");
    const subEl = document.getElementById("profile-subtitle");

    if (titleEl) titleEl.textContent = "Administrator profile";
    if (subEl) subEl.textContent = "Your account information from this session.";
    if (brandSub) brandSub.textContent = "Admin Control Center";

    if (!u) {
      setText("profile-full-name", "—");
      setText("profile-role", "—");
      setText("profile-id-number", "—");
      setText("profile-email", "—");
      if (hint) hint.textContent = "Sign in as an administrator first, then open this page again.";
      return;
    }

    const role = String(u.role || "").trim();
    setText("profile-full-name", String(u.full_name || "").trim() || "—");
    setText("profile-role", role || "—");
    setText("profile-id-number", String(u.id_number || "").trim() || "—");
    setText("profile-email", String(u.email || "").trim() || "—");
    if (hint) hint.textContent = "";
    return;
  }

  if (!path.includes("student-profile.html")) return;

  hydrateStudentSidebarChip();

  const u = getCurrentUserSession();
  const hint = document.getElementById("profile-hint");
  const roleBadge = document.getElementById("profile-role-badge");
  const brandSub = document.getElementById("profile-brand-subtitle");

  if (!u) {
    setText("profile-full-name", "—");
    setText("profile-role", "—");
    setText("profile-id-number", "—");
    setText("profile-email", "—");
    if (roleBadge) roleBadge.textContent = "Signed out";
    if (brandSub) brandSub.textContent = "Sign in required";
    if (hint) hint.textContent = "Sign in first, then open this page again.";
    return;
  }

  const role = String(u.role || "").trim();
  setText("profile-full-name", String(u.full_name || "").trim() || "—");
  setText("profile-role", role || "—");
  setText("profile-id-number", String(u.id_number || "").trim() || "—");
  setText("profile-email", String(u.email || "").trim() || "—");
  if (roleBadge) roleBadge.textContent = role ? role : "Signed in";
  if (brandSub) brandSub.textContent = role ? `${role} account` : "Account";

  // Optional: if page was opened with ?id_number=... show that in hint for future DB lookup.
  const params = new URLSearchParams(window.location.search);
  const idn = (params.get("id_number") || "").trim();
  if (hint) {
    hint.textContent = idn && u.id_number && idn !== String(u.id_number)
      ? "Note: This profile page currently shows the signed-in user only."
      : "";
  }
}
