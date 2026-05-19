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
      var err = result.error;
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
    warnIfApiBaseMissing: warnIfApiBaseMissing,
  };

  global.LearnIQApi = LearnIQApi;
  global.getApiBase = getApiBase;
  global.setLearniqApiBase = setStoredApiBase;
  global.apiUrl = apiUrl;
  global.readApiJson = readApiJson;

  warnIfApiBaseMissing();
})(typeof window !== "undefined" ? window : globalThis);
