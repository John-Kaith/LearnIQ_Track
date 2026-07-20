/** Apply saved theme before CSS paints (default = light). */
(function () {
  try {
    var raw =
      (localStorage.getItem("learniq-theme") || sessionStorage.getItem("learniq-theme") || "")
        .trim()
        .toLowerCase();
    var root = document.documentElement;
    if (raw === "dark") {
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.removeAttribute("data-theme");
      root.style.colorScheme = "light";
    }
  } catch (e) {
    /* ignore */
  }
})();
