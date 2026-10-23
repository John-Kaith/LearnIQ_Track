/**
 * LearnIQ — single API base for all frontend requests.
 *
 * Backend runs ONLY on the Ubuntu laptop (FastAPI). Windows is for editing only.
 *
 * Resolution order:
 *   1. localStorage["learniq-api-base"]
 *   2. window.LEARNIQ_CONFIG.apiBase (js/learniq-config.js)
 *   3. window.location.origin when NOT localhost/127.0.0.1 (browser opened on Ubuntu host)
 *
 * Windows dev preview (localhost, file://): set localStorage or learniq-config.js to Ubuntu LAN URL, e.g.
 *   http://192.168.1.50:8000
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "learniq-api-base";

  var API_BASE_HELP =
    "Set the Ubuntu backend URL: localStorage.setItem('learniq-api-base', 'http://YOUR-UBUNTU-IP:8000') " +
    "or edit frontend/js/learniq-config.js";

  function normalizeBase(url) {
    if (url == null) return "";
    var s = String(url).trim();
    if (!s) return "";
    return s.replace(/\/+$/, "");
  }

  function isLocalDevHost(hostname) {
    var h = String(hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
  }

  function getConfigApiBase() {
    try {
      return normalizeBase(global.LEARNIQ_CONFIG && global.LEARNIQ_CONFIG.apiBase);
    } catch (e) {
      return "";
    }
  }

  function getStoredApiBase() {
    try {
      return normalizeBase(global.localStorage && global.localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return "";
    }
  }

  function setStoredApiBase(url) {
    var base = normalizeBase(url);
    try {
      if (!global.localStorage) return base;
      if (base) global.localStorage.setItem(STORAGE_KEY, base);
      else global.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    return base;
  }

  /** Same-origin only when page is served from the Ubuntu host (LAN IP / hostname), not Windows localhost. */
  function getPageOriginApiBase() {
    if (typeof global.location === "undefined") return "";
    var loc = global.location;
    if (loc.protocol === "file:") return "";
    if (isLocalDevHost(loc.hostname)) return "";
    return normalizeBase(loc.origin);
  }

  function getApiBase() {
    return getStoredApiBase() || getConfigApiBase() || getPageOriginApiBase();
  }

  function getApiBaseStatus() {
    var stored = getStoredApiBase();
    var config = getConfigApiBase();
    var origin = getPageOriginApiBase();
    var resolved = getApiBase();
    var source = stored ? "localStorage" : config ? "learniq-config.js" : origin ? "page-origin" : "unset";
    return {
      apiBase: resolved,
      source: source,
      stored: stored,
      config: config,
      pageOrigin: origin,
      needsConfiguration:
        !resolved &&
        typeof global.location !== "undefined" &&
        (global.location.protocol === "file:" || isLocalDevHost(global.location.hostname)),
    };
  }

  function apiUrl(path) {
    var base = getApiBase();
    if (!base) {
      throw new Error("LearnIQ API base is not configured. " + API_BASE_HELP);
    }
    var p = String(path || "");
    if (p.charAt(0) !== "/") p = "/" + p;
    return base + p;
  }

  async function readApiJson(response) {
    var result = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      // FastAPI's own errors (404/405/422) use "detail" instead of "error".
      var err = result.error != null ? result.error : result.detail;
      var msg =
        typeof err === "string"
          ? err
          : err != null
          ? JSON.stringify(err)
          : response.statusText || "Request failed";
      throw new Error(msg);
    }
    if (result && Object.prototype.hasOwnProperty.call(result, "error") && result.error != null) {
      var errBody = result.error;
      throw new Error(typeof errBody === "string" ? errBody : JSON.stringify(errBody));
    }
    return result;
  }

  var SESSION_KEY = "learniq-current-user"; // same key as authSessionKey in script.js
  var refreshing = null;

  /**
   * Swap the stored refresh token for a new access token. One refresh at a
   * time: refresh tokens are single use. Resolves true when the session was
   * renewed. Inside the mobile app the new tokens go to the app as well.
   */
  function refreshSession() {
    if (refreshing) return refreshing;
    var session = null;
    try {
      session = JSON.parse(global.sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      session = null;
    }
    if (!session || !session.refresh_token) return Promise.resolve(false);
    refreshing = fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (body) {
        if (!body || !body.access_token) return false;
        var next = Object.assign({}, session, { access_token: body.access_token });
        if (body.refresh_token) next.refresh_token = body.refresh_token;
        try {
          global.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        } catch (e) {
          /* storage full */
        }
        if (global.LearnIQApp) global.LearnIQApp.sessionRefreshed(next);
        return true;
      })
      .catch(function () {
        return false;
      })
      .then(function (ok) {
        refreshing = null;
        return ok;
      });
    return refreshing;
  }

  function warnIfApiBaseMissing() {
    var status = getApiBaseStatus();
    if (!status.needsConfiguration) return;
    console.warn(
      "[LearnIQ] API base not set. Requests will fail until you point to the Ubuntu backend.\n" +
        API_BASE_HELP
    );
  }

  var LearnIQApi = {
    STORAGE_KEY: STORAGE_KEY,
    API_BASE_HELP: API_BASE_HELP,
    getApiBase: getApiBase,
    setApiBase: setStoredApiBase,
    getApiBaseStatus: getApiBaseStatus,
    apiUrl: apiUrl,
    readApiJson: readApiJson,
    refreshSession: refreshSession,
    warnIfApiBaseMissing: warnIfApiBaseMissing,
  };

  global.LearnIQApi = LearnIQApi;
  global.getApiBase = getApiBase;
  global.setLearniqApiBase = setStoredApiBase;
  global.apiUrl = apiUrl;
  global.readApiJson = readApiJson;
  global.learniqRefreshSession = refreshSession;

  warnIfApiBaseMissing();
})(typeof window !== "undefined" ? window : globalThis);
// .
