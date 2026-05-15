/**
 * Common settings panel shared by student / teacher / admin settings pages.
 *
 * Usage:
 *   <div id="common-settings-mount"></div>
 *   <script src="js/shared/common-settings.js" defer></script>
 *   <script>
 *     document.addEventListener("DOMContentLoaded", () => {
 *       mountCommonSettings(document.getElementById("common-settings-mount"));
 *     });
 *   </script>
 *
 * Sections rendered:
 *  - Account (name, ID, email, role — read only)
 *  - Appearance (theme toggle + density)
 *  - Notifications (email + sound — persisted to localStorage)
 *  - Privacy & Security (change password, sign out)
 *  - About (version + support)
 */
(function () {
  const PREFS_KEY = "learniq-prefs";

  function readPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  function writePrefs(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs || {}));
    } catch (e) { /* storage may be full or disabled */ }
  }
  function setPref(key, value) {
    const p = readPrefs();
    p[key] = value;
    writePrefs(p);
  }
  function getPref(key, fallback) {
    const p = readPrefs();
    return key in p ? p[key] : fallback;
  }

  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function getSession() {
    try {
      if (typeof getCurrentUserSession === "function") {
        return getCurrentUserSession() || {};
      }
      const raw = sessionStorage.getItem("learniq-user-session");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getInitials(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    const parts = s.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  }

  function buildHTML(session) {
    const name = (typeof getProfileDisplayName === "function" ? getProfileDisplayName(session) : session.display_name) || "—";
    const idNumber = session.id_number || "—";
    const email = session.email || "—";
    const role = (session.role || "—").replace(/^./, (c) => c.toUpperCase());
    const status = session.approval_status || "active";

    return `
      <section class="cs-panel">
        <!-- Account -->
        <article class="cs-card cs-account-card">
          <div class="cs-card-head">
            <h3><i class="fa-solid fa-user-circle"></i> Account</h3>
            <p class="small-note">Your sign-in details. Update them from your profile page.</p>
          </div>
          <div class="cs-account-body">
            <div class="cs-account-avatar" aria-hidden="true">${esc(getInitials(name))}</div>
            <dl class="cs-account-fields">
              <div><dt>Name</dt><dd>${esc(name)}</dd></div>
              <div><dt>ID Number</dt><dd>${esc(idNumber)}</dd></div>
              <div><dt>Email</dt><dd>${esc(email)}</dd></div>
              <div><dt>Role</dt><dd>${esc(role)}</dd></div>
              <div><dt>Status</dt><dd><span class="cs-pill cs-pill-${esc(String(status).toLowerCase())}">${esc(status)}</span></dd></div>
            </dl>
          </div>
        </article>

        <!-- Appearance -->
        <article class="cs-card">
          <div class="cs-card-head">
            <h3><i class="fa-solid fa-palette"></i> Appearance</h3>
            <p class="small-note">How LearnIQ Track looks for you.</p>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Theme</strong>
              <span class="small-note">Switch between dark and light interface.</span>
            </div>
            <div class="cs-segmented" role="group" aria-label="Theme">
              <button type="button" class="cs-seg-btn" data-cs-theme="dark"><i class="fa-solid fa-moon"></i> Dark</button>
              <button type="button" class="cs-seg-btn" data-cs-theme="light"><i class="fa-solid fa-sun"></i> Light</button>
            </div>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Compact density</strong>
              <span class="small-note">Smaller spacing — fits more content on screen.</span>
            </div>
            <label class="cs-switch">
              <input type="checkbox" id="cs-density-toggle" />
              <span class="cs-switch-slider"></span>
            </label>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Reduce motion</strong>
              <span class="small-note">Minimize animations across the app.</span>
            </div>
            <label class="cs-switch">
              <input type="checkbox" id="cs-reduce-motion-toggle" />
              <span class="cs-switch-slider"></span>
            </label>
          </div>
        </article>

        <!-- Notifications -->
        <article class="cs-card">
          <div class="cs-card-head">
            <h3><i class="fa-solid fa-bell"></i> Notifications</h3>
            <p class="small-note">Choose what notifications you receive (saved locally for now).</p>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Email notifications</strong>
              <span class="small-note">Approvals, announcements, and grade updates.</span>
            </div>
            <label class="cs-switch">
              <input type="checkbox" id="cs-notif-email-toggle" />
              <span class="cs-switch-slider"></span>
            </label>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>In-app sounds</strong>
              <span class="small-note">Play a soft sound when something needs your attention.</span>
            </div>
            <label class="cs-switch">
              <input type="checkbox" id="cs-notif-sound-toggle" />
              <span class="cs-switch-slider"></span>
            </label>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Daily summary</strong>
              <span class="small-note">A summary email at the end of each day.</span>
            </div>
            <label class="cs-switch">
              <input type="checkbox" id="cs-notif-daily-toggle" />
              <span class="cs-switch-slider"></span>
            </label>
          </div>
        </article>

        <!-- Privacy & Security -->
        <article class="cs-card">
          <div class="cs-card-head">
            <h3><i class="fa-solid fa-shield-halved"></i> Privacy &amp; Security</h3>
            <p class="small-note">Manage your password and active sessions.</p>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Change password</strong>
              <span class="small-note">We'll send a reset link to <strong>${esc(email)}</strong>.</span>
            </div>
            <button type="button" id="cs-change-password" class="btn btn-secondary">
              <i class="fa-solid fa-key"></i> Send reset link
            </button>
          </div>
          <div class="cs-row">
            <div class="cs-row-text">
              <strong>Sign out of this device</strong>
              <span class="small-note">End your current session.</span>
            </div>
            <button type="button" id="cs-logout" class="btn btn-secondary">
              <i class="fa-solid fa-right-from-bracket"></i> Sign out
            </button>
          </div>
        </article>

        <!-- About -->
        <article class="cs-card cs-about-card">
          <div class="cs-card-head">
            <h3><i class="fa-solid fa-circle-info"></i> About</h3>
            <p class="small-note">App information and support.</p>
          </div>
          <div class="cs-about-grid">
            <div><dt>App</dt><dd>LearnIQ Track</dd></div>
            <div><dt>Version</dt><dd>2026.05.13</dd></div>
            <div><dt>Support</dt><dd><a href="mailto:support@learniq-track.local">support@learniq-track.local</a></dd></div>
          </div>
        </article>
      </section>
    `;
  }

  function wirePanel(rootEl) {
    if (!rootEl) return;

    // ---- Theme segmented control
    const themeBtns = rootEl.querySelectorAll("[data-cs-theme]");
    const syncThemeButtons = () => {
      const current = (window.LearnIQTheme && window.LearnIQTheme.get && window.LearnIQTheme.get()) || "dark";
      themeBtns.forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-cs-theme") === current);
        b.setAttribute("aria-pressed", b.getAttribute("data-cs-theme") === current ? "true" : "false");
      });
    };
    themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const wanted = btn.getAttribute("data-cs-theme");
        if (window.LearnIQTheme && window.LearnIQTheme.set) {
          window.LearnIQTheme.set(wanted);
        }
        syncThemeButtons();
      });
    });
    syncThemeButtons();
    window.addEventListener("storage", (e) => {
      if (e.key === "learniq-theme") syncThemeButtons();
    });

    // ---- Density toggle (adds .density-compact on <html>)
    const densityEl = rootEl.querySelector("#cs-density-toggle");
    if (densityEl) {
      densityEl.checked = !!getPref("density_compact", false);
      document.documentElement.classList.toggle("density-compact", densityEl.checked);
      densityEl.addEventListener("change", () => {
        setPref("density_compact", densityEl.checked);
        document.documentElement.classList.toggle("density-compact", densityEl.checked);
      });
    }

    // ---- Reduce motion toggle
    const motionEl = rootEl.querySelector("#cs-reduce-motion-toggle");
    if (motionEl) {
      motionEl.checked = !!getPref("reduce_motion", false);
      document.documentElement.classList.toggle("reduce-motion", motionEl.checked);
      motionEl.addEventListener("change", () => {
        setPref("reduce_motion", motionEl.checked);
        document.documentElement.classList.toggle("reduce-motion", motionEl.checked);
      });
    }

    // ---- Notification toggles
    [
      ["#cs-notif-email-toggle", "notif_email", true],
      ["#cs-notif-sound-toggle", "notif_sound", true],
      ["#cs-notif-daily-toggle", "notif_daily", false],
    ].forEach(([selector, key, defVal]) => {
      const el = rootEl.querySelector(selector);
      if (!el) return;
      el.checked = !!getPref(key, defVal);
      el.addEventListener("change", () => setPref(key, el.checked));
    });

    // ---- Change password
    const pwBtn = rootEl.querySelector("#cs-change-password");
    if (pwBtn) {
      pwBtn.addEventListener("click", async () => {
        const session = getSession();
        const email = session.email;
        if (!email) {
          if (typeof showToast === "function") showToast("No email on file.", "danger");
          else alert("No email on file for this account.");
          return;
        }
        const ok = typeof showConfirmDialog === "function"
          ? await showConfirmDialog({
              title: "Send reset link?",
              message: `We'll email a password reset link to ${email}.`,
              confirmText: "Send",
              cancelText: "Cancel",
              variant: "primary",
            })
          : confirm(`Send password reset link to ${email}?`);
        if (!ok) return;

        pwBtn.disabled = true;
        const oldHtml = pwBtn.innerHTML;
        pwBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
        try {
          const apiUrlFn = typeof apiUrl === "function" ? apiUrl : (p) => p;
          const res = await fetch(apiUrlFn("/forgot-password"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          if (typeof showToast === "function") showToast("Reset link sent. Check your email.", "success");
          else alert("Reset link sent. Check your email.");
        } catch (err) {
          if (typeof showToast === "function") showToast(`Could not send link: ${err.message}`, "danger");
          else alert(`Could not send link: ${err.message}`);
        } finally {
          pwBtn.disabled = false;
          pwBtn.innerHTML = oldHtml;
        }
      });
    }

    // ---- Sign out
    const logoutBtn = rootEl.querySelector("#cs-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        // Use whichever logout helper this role's pages already export.
        if (typeof confirmAndLogout === "function") return confirmAndLogout();
        if (typeof logoutAdmin === "function") return logoutAdmin();
        if (typeof window.logout === "function") return window.logout();
        try { sessionStorage.clear(); } catch (e) { /* ignore */ }
        window.location.href = "index.html";
      });
    }
  }

  /** Public API: mount the common settings panel into the given element. */
  function mountCommonSettings(targetEl /*, opts */) {
    if (!targetEl) return;
    const session = getSession();
    targetEl.innerHTML = buildHTML(session);
    wirePanel(targetEl);
  }

  window.mountCommonSettings = mountCommonSettings;
})();
