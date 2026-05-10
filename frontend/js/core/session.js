const authStorageKey = "learniq-accounts";
const authSessionKey = "learniq-current-user";

/** Shared student/module logout: clears session and returns to login (Switch Module does not use this). */
function learniqLogout() {
  try {
    sessionStorage.removeItem(authSessionKey);
  } catch (_) {}
  window.location.href = "login.html";
}
window.learniqLogout = learniqLogout;

function getUserInitials(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function setCurrentUserSession(user) {
  console.log("Saving user session:", user);
  console.log("User role:", user.role);
  
  const safeUser = {
    id: user.id,
    id_number: user.id_number,
    email: user.email,
    full_name: user.full_name,
    role: user.role || "student",
    approval_status: user.approval_status || "approved",
    access_token: user.access_token,
    refresh_token: user.refresh_token
  };
  
  console.log("Session stored:", safeUser);
  sessionStorage.setItem(authSessionKey, JSON.stringify(safeUser));
  console.log("SessionStorage check:", sessionStorage.getItem(authSessionKey));
}

function getCurrentUserSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(authSessionKey) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Required for immersion + secured journal endpoints (Bearer = Supabase session from login). */
function immersionAuthHeaders() {
  const u = getCurrentUserSession();
  const headers = { "Content-Type": "application/json" };
  if (u && u.access_token) {
    headers.Authorization = `Bearer ${u.access_token}`;
  }
  return headers;
}

function hydrateImmersionSidebarUserChip() {
  const u = getCurrentUserSession();
  if (!u) return;
  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  const full = (u.full_name && String(u.full_name).trim()) || "";
  if (nameEl && full) nameEl.textContent = full;
  if (initialsEl) initialsEl.textContent = getUserInitials(full || u.email || "");
  if (trackEl && u.id_number) trackEl.textContent = `ID ${u.id_number}`;
}
