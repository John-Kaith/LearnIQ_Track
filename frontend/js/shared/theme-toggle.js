/**
 * Global light / dark theme. Default = dark (no data-theme on <html>).
 * Dark: sun icon → switch to light. Light: moon icon → switch to dark.
 */
(function () {
  var THEME_KEY = "learniq-theme";

  function normalizeStored(val) {
    if (val == null) return null;
    var s = String(val).trim().toLowerCase();
    if (s === "light" || s === "dark") return s;
    return null;
  }

  /** Resolved effective theme for UI (default dark). */
  function getTheme() {
    var raw = readStoredTheme();
    return raw === "light" ? "light" : "dark";
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
      document.documentElement.getAttribute("data-theme") === "light" ? "#f1f5f9" : "#050b16"
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
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    root.style.colorScheme = theme === "light" ? "light" : "dark";
    setMetaThemeColor();
    document.querySelectorAll(".theme-toggle-btn").forEach(updateBtnIcon);
  }

  /** User-facing: persist + apply (toggle, programmatic set). */
  function applyTheme(theme) {
    applyVisualTheme(theme);
    persistTheme(theme);
  }

  function updateBtnIcon(btn) {
    var isLight = document.documentElement.getAttribute("data-theme") === "light";
    btn.innerHTML = "";
    var i = document.createElement("i");
    i.setAttribute("aria-hidden", "true");
    i.className = isLight ? "fa-solid fa-moon" : "fa-solid fa-sun";
    btn.appendChild(i);
    btn.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
    btn.setAttribute("title", isLight ? "Dark mode" : "Light mode");
  }

  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
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
    applyVisualTheme(t === "light" ? "light" : "dark");
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
