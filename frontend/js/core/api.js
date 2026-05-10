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
