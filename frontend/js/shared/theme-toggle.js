/**
 * Global light / dark theme.
 * 1st (default): yellow & white light — no data-theme on <html>
 * 2nd (optional): dark blue — data-theme="dark"
 */
(function () {
  var THEME_KEY = "learniq-theme";

  function normalizeStored(val) {
    if (val == null) return null;
    var s = String(val).trim().toLowerCase();
    if (s === "light" || s === "dark") return s;
    return null;
  }

  /** Resolved effective theme (default light). */
  function getTheme() {
    var raw = readStoredTheme();
    return raw === "dark" ? "dark" : "light";
  }

  /** Raw preference from storage, or null if unset / unreadable. */
  function readStoredTheme() {
    try {
      var a = normalizeStored(localStorage.getItem(THEME_KEY));
      if (a) return a;
    } catch (e) {}
    try {
      var b = normalizeStored(sessionStorage.getItem(THEME_KEY));
      if (b) return b;
    } catch (e) {}
    return null;
  }

  function setMetaThemeColor() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "theme-color");
      document.head.appendChild(m);
    }
    m.setAttribute(
      "content",
      document.documentElement.getAttribute("data-theme") === "dark" ? "#050b16" : "#fffbeb"
    );
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    try {
      sessionStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  /** Update DOM only (no storage writes). Safe for initial load / bfcache / storage events. */
  function applyVisualTheme(theme) {
    var root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.removeAttribute("data-theme");
      root.style.colorScheme = "light";
    }
    setMetaThemeColor();
    document.querySelectorAll(".theme-toggle-btn").forEach(updateBtnIcon);
  }

  /** User-facing: persist + apply (toggle, programmatic set). */
  function applyTheme(theme) {
    applyVisualTheme(theme);
    persistTheme(theme);
  }

  function updateBtnIcon(btn) {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    btn.innerHTML = "";
    var i = document.createElement("i");
    i.setAttribute("aria-hidden", "true");
    i.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    btn.appendChild(i);
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme (yellow and white)" : "Switch to dark blue theme"
    );
    btn.setAttribute("title", isDark ? "Light mode" : "Dark blue mode");
  }

  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }

  function mountSidebarToggles() {
    document.querySelectorAll(".sidebar-header").forEach(function (header) {
      if (header.querySelector(".theme-toggle-btn")) return;
      var anchor = header.querySelector(".brand") || header.firstElementChild;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-toggle-btn";
      btn.addEventListener("click", toggleTheme);
      if (anchor) {
        anchor.insertAdjacentElement("afterend", btn);
      } else {
        header.appendChild(btn);
      }
    });
  }

  function mountTopnavToggles() {
    document.querySelectorAll(".lms-topnav-head").forEach(function (head) {
      if (head.querySelector(".theme-toggle-btn")) return;
      var menuToggle = head.querySelector(".lms-topnav-menu-toggle");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-toggle-btn theme-toggle-btn--topnav";
      btn.addEventListener("click", toggleTheme);
      if (menuToggle) {
        menuToggle.insertAdjacentElement("beforebegin", btn);
      } else {
        head.appendChild(btn);
      }
    });
  }

  function mountFixedFallback() {
    if (document.querySelector(".theme-toggle-btn")) return;
    if (document.querySelector(".sidebar-header")) return;
    if (document.querySelector(".lms-topnav-head")) return;
    if (document.getElementById("app-topnav-slot")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle-btn theme-toggle-btn--fixed";
    btn.addEventListener("click", toggleTheme);
    document.body.appendChild(btn);
  }

  function remount() {
    mountSidebarToggles();
    mountTopnavToggles();
    mountFixedFallback();
    document.querySelectorAll(".theme-toggle-btn").forEach(updateBtnIcon);
  }

  function hydrateFromStorage() {
    applyVisualTheme(getTheme());
  }

  hydrateFromStorage();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", remount);
  } else {
    remount();
  }

  window.addEventListener("storage", function (e) {
    if (e.key !== THEME_KEY || e.storageArea !== localStorage) return;
    var t = normalizeStored(e.newValue);
    applyVisualTheme(t === "dark" ? "dark" : "light");
  });

  window.addEventListener("pageshow", function (ev) {
    if (!ev.persisted) return;
    hydrateFromStorage();
    remount();
  });

  window.LearnIQTheme = {
    get: getTheme,
    readStored: readStoredTheme,
    set: applyTheme,
    applyVisual: applyVisualTheme,
    toggle: toggleTheme,
    remount: remount,
  };
})();
