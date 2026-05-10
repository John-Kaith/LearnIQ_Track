(function () {
  window.LearnIQMobile = window.LearnIQMobile || {};
  window.LearnIQMobile.closeTopNavIfNarrow = function (header) {
    if (!header || !window.matchMedia("(max-width: 900px)").matches) return;
    header.classList.remove("lms-topnav--menu-open");
    const btn = header.querySelector(".lms-topnav-menu-toggle");
    if (btn) btn.setAttribute("aria-expanded", "false");
  };
})();
