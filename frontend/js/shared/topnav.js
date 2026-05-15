/**
 * Injected LMS top navigation fragments (students, teachers, admins).
 */
(function () {
  const SESSION_KEY = "learniq-current-user";

  /** Shell V2: single slot id; fallbacks for older HTML during migration. */
  function getTopnavSlot() {
    return (
      document.getElementById("app-topnav-slot") ||
      document.getElementById("dashboard-topnav-slot") ||
      document.getElementById("admin-topnav-slot") ||
      document.getElementById("teacher-topnav-slot")
    );
  }

  function hydrateStudentChrome() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const u = JSON.parse(raw);
      const nameEl = document.getElementById("student-display-name");
      const initialsEl = document.getElementById("student-avatar-initials");
      const trackEl = document.getElementById("student-display-track");
      const full = (typeof getProfileDisplayName === "function" ? getProfileDisplayName(u) : u.display_name) || "";
      if (nameEl && full) nameEl.textContent = full;
      if (initialsEl) {
        const parts = full.split(/\s+/).filter(Boolean);
        let ini = "";
        if (parts.length >= 2) ini = (parts[0][0] + parts[1][0]).toUpperCase();
        else ini = parts[0] ? parts[0].slice(0, 2).toUpperCase() : "";
        const fallback = ini || "ST";
        if (window.LearnIQAvatar) {
          window.LearnIQAvatar.applyToElement(initialsEl, u, fallback);
        } else {
          initialsEl.textContent = fallback;
        }
      }
      if (trackEl && u.id_number) trackEl.textContent = "ID " + u.id_number;
    } catch (_) {}
  }

  function applyActiveStudentUnified() {
    const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    const file = path.split("/").pop() || "";
    const sel = '[data-lms-module="student-unified"] a[data-nav-id]';
    document.querySelectorAll(sel).forEach((a) => a.classList.remove("is-active"));

    const map = [
      ["learniq-dashboard.html", "home"],
      ["my-lesson.html", "lessons"],
      ["leaderboard.html", "leaderboard"],
      ["immersion-dashboard.html", "immersion"],
      ["student-settings.html", "settings"],
    ];
    for (let i = 0; i < map.length; i++) {
      if (file === map[i][0] || path.endsWith("/" + map[i][0])) {
        const link = document.querySelector(`[data-lms-module="student-unified"] a[data-nav-id="${map[i][1]}"]`);
        if (link) link.classList.add("is-active");
        break;
      }
    }
  }

  function applyActiveTeacherNav() {
    const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    const file = path.split("/").pop() || "";
    const sel = '[data-lms-module="teacher-app"] a[data-nav-id]';
    document.querySelectorAll(sel).forEach((a) => a.classList.remove("is-active"));
    if (path.includes("teacher-immersion.html")) {
      const l = document.querySelector('[data-lms-module="teacher-app"] a[data-nav-id="immersion-monitor"]');
      if (l) l.classList.add("is-active");
      return;
    }
    if (file === "ai-result.html" || path.endsWith("/ai-result.html")) {
      const x = document.querySelector('[data-lms-module="teacher-app"] a[data-nav-id="ai-review"]');
      if (x) x.classList.add("is-active");
      return;
    }
    if (file === "leaderboard.html" || path.endsWith("/leaderboard.html")) {
      const x = document.querySelector('[data-lms-module="teacher-app"] a[data-nav-id="ext-leaderboard"]');
      if (x) x.classList.add("is-active");
      return;
    }
    if (file === "module-selection.html" || path.endsWith("/module-selection.html")) {
      const x = document.querySelector('[data-lms-module="teacher-app"] a[data-nav-id="modules"]');
      if (x) x.classList.add("is-active");
      return;
    }
    if (file === "teacher-settings.html" || path.endsWith("/teacher-settings.html")) {
      const x = document.querySelector('[data-lms-module="teacher-app"] a[data-nav-id="settings"]');
      if (x) x.classList.add("is-active");
      return;
    }
    const dash = document.querySelector('[data-lms-module="teacher-app"] a[data-nav-id="dash"]');
    if (dash && (file === "teacher-learniq-dashboard.html" || path.includes("teacher-dashboard.html"))) dash.classList.add("is-active");
  }

  function applyActiveAdminNav() {
    const sel = '[data-lms-module="admin-app"] a[data-nav-id]';
    document.querySelectorAll(sel).forEach((a) => a.classList.remove("is-active"));
    const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
    const file = path.split("/").pop() || "";
    let id = "adm-dash";
    if (file === "admin-student-approvals.html") id = "adm-approvals";
    else if (file === "admin-teacher-approvals.html") id = "adm-teacher-approvals";
    else if (file === "admin-users.html") id = "adm-users";
    else if (file === "admin-uploaded-files.html") id = "adm-files";
    else if (file === "admin-leaderboard.html") id = "adm-leaderboard";
    else if (file === "admin-attendance-logs.html") id = "adm-attendance";
    else if (file === "admin-journals.html") id = "adm-journals";
    else if (file === "admin-reports.html") id = "adm-reports";
    else if (file === "admin-settings.html") id = "adm-settings";
    else if (file === "admin-profile.html") id = "adm-dash";
    else {
      // Legacy admin dashboard sections (hash-based); AI Results still on dashboard hash
      const hash = (window.location.hash || "").replace(/^#\/?/, "").toLowerCase();
      if (hash.includes("ai-results") || hash.includes("ai_results")) id = "adm-ai";
      else if (hash.includes("leaderboard")) id = "adm-leaderboard";
      else if (hash.includes("attendance")) id = "adm-attendance";
      else if (hash.includes("journals")) id = "adm-journals";
      else if (hash.includes("reports")) id = "adm-reports";
      else if (hash.includes("settings")) id = "adm-settings";
    }
    const link = document.querySelector(`[data-lms-module="admin-app"] a[data-nav-id="${id}"]`);
    if (link) link.classList.add("is-active");
  }

  function wireMobileToggle(slot) {
    var roots = slot ? slot.querySelectorAll(".lms-topnav") : document.querySelectorAll(".lms-topnav");
    roots.forEach(function (header) {
      if (header.getAttribute("data-lms-topnav-wired") === "1") return;
      var btn = header.querySelector(".lms-topnav-menu-toggle");
      var body = header.querySelector(".lms-topnav-body");
      if (!btn || !body) return;
      header.setAttribute("data-lms-topnav-wired", "1");

      function closeIfNarrow() {
        if (window.LearnIQMobile && typeof window.LearnIQMobile.closeTopNavIfNarrow === "function") {
          window.LearnIQMobile.closeTopNavIfNarrow(header);
        }
      }

      btn.addEventListener("click", function () {
        var open = header.classList.toggle("lms-topnav--menu-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });

      body.querySelectorAll("a[href]").forEach(function (link) {
        link.addEventListener("click", closeIfNarrow);
      });

      var logoutBtn = header.querySelector(".lms-topnav-logout-btn");
      if (logoutBtn) logoutBtn.addEventListener("click", closeIfNarrow);

      var mq = window.matchMedia("(max-width: 900px)");
      function syncDesktop() {
        if (!mq.matches) {
          header.classList.remove("lms-topnav--menu-open");
          btn.setAttribute("aria-expanded", "false");
          btn.setAttribute("aria-label", "Open menu");
        }
      }
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", syncDesktop);
      else if (typeof mq.addListener === "function") mq.addListener(syncDesktop);
    });
  }

  function wireLogout(selector, handler) {
    const btn =
      selector === "#admin-topnav-logout"
        ? document.getElementById("admin-topnav-logout")
        : selector === "#teacher-topnav-logout"
          ? document.getElementById("teacher-topnav-logout")
          : document.getElementById("student-topnav-logout");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (typeof handler === "function") {
        handler();
        return;
      }
      if (typeof window.learniqLogout === "function") window.learniqLogout();
    });
  }

  async function mountFragment(slot, filename) {
    if (!slot || slot.getAttribute("data-topnav-mounted") === "1") return;
    const url = new URL("components/" + filename, window.location.href);
    const res = await fetch(url.toString(), { credentials: "same-origin" });
    if (!res.ok) throw new Error("Topnav load failed (" + res.status + ")");
    slot.innerHTML = await res.text();
    slot.setAttribute("data-topnav-mounted", "1");
  }

  window.LearnIQTopnav = window.LearnIQTopnav || {};

  window.LearnIQTopnav.mountStudentUnified = async function () {
    const slot = getTopnavSlot();
    await mountFragment(slot, "topnav-student-unified.html");
    hydrateStudentChrome();
    applyActiveStudentUnified();
    wireLogout("#student-topnav-logout");
    wireMobileToggle(slot);
    window.addEventListener("hashchange", applyActiveStudentUnified);
    if (window.LearnIQTheme && typeof window.LearnIQTheme.remount === "function") window.LearnIQTheme.remount();
  };

  window.LearnIQTopnav.mountTeacher = async function () {
    const slot = getTopnavSlot();
    await mountFragment(slot, "topnav-teacher-app.html");
    applyActiveTeacherNav();
    wireLogout("#teacher-topnav-logout", () => {
      try {
        sessionStorage.clear();
      } catch (_) {}
      window.location.href = "login.html";
    });
    wireMobileToggle(slot);
    window.addEventListener("hashchange", applyActiveTeacherNav);
    if (window.LearnIQTheme && typeof window.LearnIQTheme.remount === "function") window.LearnIQTheme.remount();
  };

  window.LearnIQTopnav.mountAdmin = async function () {
    const slot = getTopnavSlot();
    await mountFragment(slot, "topnav-admin-app.html");
    applyActiveAdminNav();
    wireLogout("#admin-topnav-logout", () => {
      if (typeof window.logoutAdmin === "function") window.logoutAdmin();
      else sessionStorage.clear() || (window.location.href = "login.html");
    });
    wireMobileToggle(slot);
    window.addEventListener("hashchange", applyActiveAdminNav);
    if (window.LearnIQTheme && typeof window.LearnIQTheme.remount === "function") window.LearnIQTheme.remount();
  };

  /* Back-compat mounts */
  window.__learnIQMountLearniqStudentTopNav = async function () {
    return window.LearnIQTopnav.mountStudentUnified();
  };
  window.__learnIQMountImmersionStudentTopNav = window.__learnIQMountLearniqStudentTopNav;
  window.__learnIQMountStudentTopNav = window.__learnIQMountLearniqStudentTopNav;
})();
