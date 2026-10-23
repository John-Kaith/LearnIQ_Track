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

/**
 * App mode: a page opened inside the LearnIQ mobile app (its WebView) gets the
 * "lq-app" class on <html> and window.LearnIQApp to talk to the app. `?app=1`
 * turns it on in a normal browser too, to preview the app look.
 */
(function () {
  var active = false;
  try {
    active =
      !!window.ReactNativeWebView ||
      sessionStorage.getItem("learniq-app-mode") === "1" ||
      /[?&]app=1(?:&|$)/.test(window.location.search);
    if (active) sessionStorage.setItem("learniq-app-mode", "1");
  } catch (e) {
    active = !!window.ReactNativeWebView;
  }
  if (active) document.documentElement.classList.add("lq-app");

  function post(message) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
        return true;
      }
    } catch (e) {
      /* not in the app */
    }
    return false;
  }

  window.LearnIQApp = {
    active: active,
    post: post,
    /** Close this page and go back to the app. False outside the app. */
    exit: function () {
      return active && post({ type: "exit" });
    },
    /** Hand refreshed tokens to the app: refresh tokens are single use. */
    sessionRefreshed: function (session) {
      if (active && session && session.access_token) {
        post({ type: "session", access_token: session.access_token, refresh_token: session.refresh_token || "" });
      }
    },
  };
})();
// .
