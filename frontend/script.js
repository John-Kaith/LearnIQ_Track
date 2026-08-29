const sampleAiData = {
  reviewer: [
    "Plate tectonics explains how Earth’s crust is broken into moving plates that shape continents and oceans.",
    "Volcanoes and earthquakes usually occur near plate boundaries where pressure and movement are strongest.",
    "Weathering, erosion, and deposition continuously reshape landforms over time."
  ],
  quiz: [
    {
      question: "Which layer of the Earth is broken into tectonic plates?",
      choices: ["Inner core", "Mantle", "Lithosphere", "Outer core"],
      answer: "Lithosphere"
    },
    {
      question: "What usually forms at convergent plate boundaries?",
      choices: ["Mountain ranges", "River deltas", "Sand dunes", "Coral reefs"],
      answer: "Mountain ranges"
    },
    {
      question: "Which process moves rock fragments from one place to another?",
      choices: ["Weathering", "Erosion", "Melting", "Compaction"],
      answer: "Erosion"
    }
  ],
  activities: [
    "Create a labeled diagram showing the three main plate boundary types.",
    "Answer the 10-item quiz challenge and compare scores with your classmates.",
    "Write a reflection on how natural hazards affect communities in the Philippines."
  ]
};

function escapeHtml(text) {
  if (text == null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function getProfileDisplayName(user) {
  if (!user) return "User";
  const dn = user.display_name && String(user.display_name).trim();
  if (dn) return dn;
  const fn = String(user.first_name || "").trim();
  const ln = String(user.last_name || "").trim();
  const mn = String(user.middle_name || "").trim();
  const suf = String(user.name_suffix || "").trim();
  if (fn && ln) {
    const base = [fn, mn, ln].filter(Boolean).join(" ");
    return suf ? `${base} ${suf}` : base;
  }
  return String(user.email || "User").trim();
}
window.getProfileDisplayName = getProfileDisplayName;

function normalizeGradeLevel(raw) {
  const s = String(raw || "").trim().toLowerCase();
  const m = s.match(/\b(11|12)\b/);
  return m ? m[1] : "";
}

function isGrade11Student(user) {
  if (!user) return false;
  const role = String(user.role || "").trim().toLowerCase();
  if (role !== "student") return false;
  return normalizeGradeLevel(user.grade_level) === "11";
}

function canAccessImmersionTracker(user) {
  if (!user) return false;
  const role = String(user.role || "").trim().toLowerCase();
  if (role === "teacher" || role === "admin") return true;
  return normalizeGradeLevel(user.grade_level) === "12";
}

// ============================================================
// Flashcards modal study experience
// ------------------------------------------------------------
// One modal is reused for any number of decks. The launcher in
// the Activities tab stores its cards as a JSON payload on the
// data-fc-cards attribute; clicking opens the modal with that
// deck loaded.
// ============================================================

const _fcState = {
  cards: [],
  current: 0,
  animating: false,
};

function _fcEls() {
  return {
    modal: document.getElementById("flashcards-modal"),
    card: document.getElementById("fc-card"),
    front: document.getElementById("fc-card-front-text"),
    back: document.getElementById("fc-card-back-text"),
    counter: document.getElementById("fc-modal-counter"),
    prev: document.getElementById("fc-prev-btn"),
    next: document.getElementById("fc-next-btn"),
    close: document.getElementById("fc-modal-close"),
    cardView: document.getElementById("fc-card-view"),
    completeView: document.getElementById("fc-complete-view"),
    completeCount: document.getElementById("fc-complete-count"),
    reviewAgain: document.getElementById("fc-review-again"),
    closeDeck: document.getElementById("fc-close-deck"),
  };
}

function _fcShowCard(idx) {
  const els = _fcEls();
  if (!els.card || !_fcState.cards.length) return;
  const c = _fcState.cards[idx];
  if (!c) return;
  els.card.classList.remove("flipped");
  if (els.front) els.front.textContent = c.front;
  if (els.back) els.back.textContent = c.back;
  if (els.counter) els.counter.textContent = `${idx + 1} / ${_fcState.cards.length}`;
  _fcState.current = idx;

  if (els.prev) els.prev.disabled = idx === 0;
  if (els.next) {
    els.next.innerHTML =
      idx === _fcState.cards.length - 1
        ? 'Finish <i class="fa-solid fa-flag-checkered"></i>'
        : 'Next <i class="fa-solid fa-chevron-right"></i>';
  }
}

function _fcShowCompletion() {
  const els = _fcEls();
  if (els.cardView) els.cardView.hidden = true;
  if (els.completeView) els.completeView.hidden = false;
  if (els.completeCount) els.completeCount.textContent = String(_fcState.cards.length);
}

function _fcShowDeck() {
  const els = _fcEls();
  if (els.cardView) els.cardView.hidden = false;
  if (els.completeView) els.completeView.hidden = true;
}

function openFlashcardsModal(cards) {
  const els = _fcEls();
  if (!els.modal) {
    console.warn("[Flashcards] Modal element not found in DOM.");
    return;
  }
  const list = (Array.isArray(cards) ? cards : []).filter((c) => c && c.front && c.back);
  if (!list.length) {
    console.warn("[Flashcards] No valid cards to display.");
    return;
  }
  _fcState.cards = list;
  _fcState.current = 0;
  _fcShowDeck();
  _fcShowCard(0);
  els.modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  els.card?.focus();
}

function closeFlashcardsModal() {
  const els = _fcEls();
  if (!els.modal) return;
  els.modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
  _fcState.cards = [];
  _fcState.current = 0;
  if (els.card) els.card.classList.remove("flipped");
}

function wireFlashcardLauncher(launcherEl) {
  if (!launcherEl || launcherEl.dataset.fcWired === "1") return;
  launcherEl.dataset.fcWired = "1";
  launcherEl.addEventListener("click", () => {
    const raw = launcherEl.dataset.fcCards || "";
    if (!raw) return;
    try {
      const cards = JSON.parse(decodeURIComponent(raw));
      openFlashcardsModal(cards);
    } catch (err) {
      console.warn("[Flashcards] Failed to parse cards payload:", err);
    }
  });
}

/**
 * Wire global modal controls once at startup.
 * Idempotent: safe to call multiple times.
 */
function _fcWireModalControlsOnce() {
  if (typeof document === "undefined") return;
  if (document.body && document.body.dataset.fcModalWired === "1") return;
  const els = _fcEls();
  if (!els.modal) return;
  if (document.body) document.body.dataset.fcModalWired = "1";

  els.card?.addEventListener("click", () => {
    if (_fcState.animating) return;
    els.card.classList.toggle("flipped");
  });
  els.card?.addEventListener("keydown", (ev) => {
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      els.card.classList.toggle("flipped");
    }
  });

  els.prev?.addEventListener("click", () => {
    if (_fcState.current > 0) _fcShowCard(_fcState.current - 1);
  });
  els.next?.addEventListener("click", () => {
    if (_fcState.current < _fcState.cards.length - 1) {
      _fcShowCard(_fcState.current + 1);
    } else {
      _fcShowCompletion();
    }
  });

  els.close?.addEventListener("click", closeFlashcardsModal);
  els.closeDeck?.addEventListener("click", closeFlashcardsModal);
  els.reviewAgain?.addEventListener("click", () => {
    _fcShowDeck();
    _fcShowCard(0);
  });

  els.modal.addEventListener("click", (ev) => {
    if (ev.target === els.modal) closeFlashcardsModal();
  });

  document.addEventListener("keydown", (ev) => {
    if (els.modal.hasAttribute("hidden")) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeFlashcardsModal();
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _fcWireModalControlsOnce);
  } else {
    _fcWireModalControlsOnce();
  }
}

/**
 * Render the AI-generated activities list (essays, flashcards, plus legacy types)
 * into a target container. Returns immediately if the container is missing.
 * Wires up any flashcard decks after insertion.
 */
function renderActivitiesInto(targetEl, activities) {
  if (!targetEl) return;
  const acts = Array.isArray(activities) ? activities : activities == null ? [] : [activities];
  const flashcardDeckIds = [];

  const html = acts
    .map((item, i) => {
      if (typeof item === "string") {
        return `
          <div class="activity-item">
            <strong>Activity ${i + 1}</strong>
            <p>${escapeHtml(item)}</p>
          </div>`;
      }

      if (typeof item !== "object" || item === null) {
        return `
          <div class="activity-item">
            <strong>Activity ${i + 1}</strong>
            <p>${escapeHtml(String(item))}</p>
          </div>`;
      }

      // Flashcards deck — renders as a stack-thumbnail launcher that opens the study modal
      if (item.activity_type === "flashcards" && Array.isArray(item.cards)) {
        const cards = item.cards.filter((c) => c && c.front && c.back);
        if (cards.length === 0) {
          return `
            <div class="activity-item">
              <strong>Flashcards</strong>
              <p class="small-note">No cards generated.</p>
            </div>`;
        }
        const launcherId = `fc-launcher-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        flashcardDeckIds.push(launcherId);
        const cardsPayload = encodeURIComponent(JSON.stringify(cards));
        const previewText = escapeHtml(cards[0].front.length > 70 ? cards[0].front.slice(0, 70) + "…" : cards[0].front);
        return `
          <div class="activity-item flashcard-activity">
            <button
              type="button"
              id="${launcherId}"
              class="fc-launcher"
              data-fc-cards="${cardsPayload}"
              aria-label="Open flashcards deck with ${cards.length} cards">
              <div class="fc-launcher-stack" aria-hidden="true">
                <div class="fc-launcher-card fc-launcher-card-3"></div>
                <div class="fc-launcher-card fc-launcher-card-2"></div>
                <div class="fc-launcher-card fc-launcher-card-1">
                  <span class="fc-launcher-label"><i class="fa-solid fa-clone"></i> Flashcards</span>
                  <span class="fc-launcher-preview">${previewText}</span>
                </div>
              </div>
              <div class="fc-launcher-meta">
                <strong><i class="fa-solid fa-clone"></i> Flashcards deck</strong>
                <span class="small-note">${cards.length} card${cards.length === 1 ? "" : "s"} · Click to study</span>
                <span class="fc-launcher-cta">
                  <i class="fa-solid fa-play"></i> Start studying
                </span>
              </div>
            </button>
          </div>`;
      }

      // Essay (open-ended prompt with optional sample answer)
      if (item.activity_type === "essay" && item.question) {
        const sample = item.answer == null ? "" : String(item.answer);
        return `
          <div class="activity-item essay-activity">
            <div class="essay-header">
              <strong>Essay ${i + 1}</strong>
              <span class="essay-chip"><i class="fa-solid fa-pen-nib"></i> Essay</span>
            </div>
            <p class="essay-prompt">${escapeHtml(item.question)}</p>
            <textarea class="form-textarea essay-response" rows="6" placeholder="Write your response here..."></textarea>
            ${
              sample
                ? `<details class="essay-sample">
                    <summary><i class="fa-solid fa-lightbulb"></i> Show sample answer / key points</summary>
                    <p>${escapeHtml(sample)}</p>
                  </details>`
                : ""
            }
          </div>`;
      }

      // Legacy: matching (kept for previously-stored data)
      if (item.activity_type === "matching" && Array.isArray(item.pairs)) {
        const pairs = item.pairs
          .slice(0, 10)
          .map((p) => `<li><strong>${escapeHtml(p.left || "")}</strong> — ${escapeHtml(p.right || "")}</li>`)
          .join("");
        return `
          <div class="activity-item">
            <strong>Matching Type</strong>
            <span class="small-note">Match the pairs below</span>
            <ul class="small-note" style="margin:0.6rem 0 0; padding-left:1.2rem;">
              ${pairs || "<li>—</li>"}
            </ul>
          </div>`;
      }

      // Legacy: generic question/answer (identification, true/false, fill_blank, short_answer)
      if (Object.prototype.hasOwnProperty.call(item, "question") && Object.prototype.hasOwnProperty.call(item, "answer")) {
        const ans =
          typeof item.answer === "boolean"
            ? item.answer
              ? "True"
              : "False"
            : item.answer == null
            ? "—"
            : String(item.answer);
        return `
          <div class="activity-item">
            <strong>${escapeHtml((item.activity_type || "activity").replace("_", " "))} ${i + 1}</strong>
            <p>${escapeHtml(item.question || "")}</p>
            <small>Answer: ${escapeHtml(ans)}</small>
          </div>`;
      }

      return `
        <div class="activity-item">
          <strong>${escapeHtml(item.title || `Activity ${i + 1}`)}</strong>
          <span class="small-note">${escapeHtml(item.activity_type || "activity")}</span>
          <div class="activity-instructions">
            <em>${escapeHtml(item.instructions || "")}</em>
          </div>
          <p>${escapeHtml(item.question_or_task || "")}</p>
        </div>`;
    })
    .join("");

  targetEl.innerHTML = html || '<p class="small-note">No activities yet.</p>';

  flashcardDeckIds.forEach((id) => {
    const launcherEl = document.getElementById(id);
    if (launcherEl && typeof wireFlashcardLauncher === "function") {
      wireFlashcardLauncher(launcherEl);
    }
  });
}

/* readApiJson, getApiBase, apiUrl → js/core/api.js (load before this file) */

function showToast(message, type = "info") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (!container.children.length) container.remove();
  }, 2800);
}

function animateProgressBars() {
  document.querySelectorAll(".progress-bar span[data-progress], .progress-bar span[style]").forEach((bar) => {
    const width = bar.dataset.progress || bar.style.width || "0%";
    bar.style.width = width;
  });
}

const authStorageKey = "learniq-accounts";
const authSessionKey = "learniq-current-user";

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
    display_name: getProfileDisplayName(user),
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    middle_name: user.middle_name || "",
    name_suffix: user.name_suffix || "",
    grade_level: user.grade_level || "",
    strand: user.strand || "",
    role: user.role || "student",
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

/* =========================================================
 * Profile avatar + extra profile details (per-account)
 *
 * Photos and extra fields (bio, phone, section, dob, address)
 * are stored on the user's `profiles` row in Supabase (source of
 * truth). They are also kept in localStorage as an offline cache
 * so synchronous APIs like `applyToElement` can render the avatar
 * instantly on any page without waiting for a network round-trip.
 *
 * Read path (sync):
 *   `LearnIQAvatar.get(user)`        → cache → localStorage → null
 *   `LearnIQProfileDetails.get(user)` → cache → localStorage → empty
 *
 * Write path (async):
 *   `LearnIQAvatar.set(user, url)`           → PATCH /me/profile
 *   `LearnIQProfileDetails.set(user, obj)`   → PATCH /me/profile
 *
 * Both writers update the local cache on success. Any code that
 * fetches `/me` should call `LearnIQProfile.absorb(user, payload)`
 * (or call `LearnIQAvatar.loadFromServer(user)`) so the cache stays
 * in sync with the database.
 * ========================================================= */
(function () {
  if (typeof window === "undefined") return;

  const AVATAR_PREFIX = "lq_avatar_";
  const DETAILS_PREFIX = "lq_profile_details_";
  const MAX_INPUT_BYTES = 8 * 1024 * 1024;
  const DETAIL_FIELDS = ["bio", "phone", "section", "dob", "address"];

  const avatarCache = new Map(); // key -> dataUrl
  const detailsCache = new Map(); // key -> { bio, phone, ... }

  function accountKey(user) {
    if (!user) return "";
    const idn = String(user.id_number || "").trim();
    if (idn) return idn;
    return String(user.email || "").trim().toLowerCase();
  }

  function emptyDetails() {
    return DETAIL_FIELDS.reduce((acc, k) => {
      acc[k] = "";
      return acc;
    }, {});
  }

  function lsGetAvatar(key) {
    try {
      return localStorage.getItem(AVATAR_PREFIX + key) || null;
    } catch {
      return null;
    }
  }
  function lsSetAvatar(key, dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(AVATAR_PREFIX + key, dataUrl);
      else localStorage.removeItem(AVATAR_PREFIX + key);
      return true;
    } catch (e) {
      console.warn("Avatar local cache save failed:", e);
      return false;
    }
  }
  function lsGetDetails(key) {
    try {
      const raw = localStorage.getItem(DETAILS_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const out = emptyDetails();
      for (const f of DETAIL_FIELDS) {
        if (typeof parsed[f] === "string") out[f] = parsed[f];
      }
      return out;
    } catch {
      return null;
    }
  }
  function lsSetDetails(key, details) {
    try {
      const safe = emptyDetails();
      for (const f of DETAIL_FIELDS) {
        safe[f] = details && typeof details[f] === "string" ? details[f].trim() : "";
      }
      localStorage.setItem(DETAILS_PREFIX + key, JSON.stringify(safe));
      return true;
    } catch (e) {
      console.warn("Profile details cache save failed:", e);
      return false;
    }
  }

  /* ---------- Sync getters (cache → localStorage → empty) ---------- */
  function getAvatar(user) {
    const k = accountKey(user);
    if (!k) return null;
    if (avatarCache.has(k)) return avatarCache.get(k);
    const v = lsGetAvatar(k);
    if (v) avatarCache.set(k, v);
    return v || null;
  }
  function getDetails(user) {
    const k = accountKey(user);
    if (!k) return emptyDetails();
    if (detailsCache.has(k)) return { ...detailsCache.get(k) };
    const v = lsGetDetails(k);
    if (v) {
      detailsCache.set(k, v);
      return { ...v };
    }
    return emptyDetails();
  }

  /* ---------- Local-only cache writers ---------- */
  function setAvatarLocal(user, dataUrl) {
    const k = accountKey(user);
    if (!k) return false;
    if (dataUrl) {
      avatarCache.set(k, dataUrl);
      return lsSetAvatar(k, dataUrl);
    }
    avatarCache.delete(k);
    return lsSetAvatar(k, null);
  }
  function setDetailsLocal(user, details) {
    const k = accountKey(user);
    if (!k) return false;
    const safe = emptyDetails();
    for (const f of DETAIL_FIELDS) {
      safe[f] = details && typeof details[f] === "string" ? details[f].trim() : "";
    }
    detailsCache.set(k, safe);
    return lsSetDetails(k, safe);
  }

  /* ---------- Absorb /me responses into the cache ---------- */
  function absorbServerResponse(user, payload) {
    if (!payload || typeof payload !== "object") return;
    const k = accountKey(user);
    if (!k) return;
    if (typeof payload.avatar_data === "string") {
      const av = payload.avatar_data;
      if (av) {
        avatarCache.set(k, av);
        lsSetAvatar(k, av);
      } else {
        avatarCache.delete(k);
        lsSetAvatar(k, null);
      }
    }
    let touchedDetails = false;
    const merged = detailsCache.get(k) || lsGetDetails(k) || emptyDetails();
    for (const f of DETAIL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(payload, f)) {
        merged[f] = typeof payload[f] === "string" ? payload[f] : "";
        touchedDetails = true;
      }
    }
    if (touchedDetails) {
      detailsCache.set(k, merged);
      lsSetDetails(k, merged);
    }
  }

  /* ---------- Server sync (authenticated) ---------- */
  function authHeaders() {
    const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const headers = { "Content-Type": "application/json" };
    if (u && u.access_token) headers.Authorization = `Bearer ${u.access_token}`;
    return headers;
  }

  let refreshInFlight = null;
  /**
   * Exchange the stored refresh_token for a fresh access_token. Multiple
   * concurrent callers share the same in-flight promise so we never make
   * more than one refresh request at a time.
   */
  async function tryRefreshSession() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
        const rt = u && u.refresh_token ? String(u.refresh_token) : "";
        if (!rt) return false;
        const res = await fetch(apiUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!res.ok) return false;
        const body = await res.json().catch(() => null);
        if (!body || !body.access_token) return false;
        const next = { ...u, access_token: body.access_token };
        if (body.refresh_token) next.refresh_token = body.refresh_token;
        try {
          const key = typeof authSessionKey === "string" ? authSessionKey : "learniq-current-user";
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch (_) { /* storage full */ }
        return true;
      } catch (_) {
        return false;
      }
    })();
    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  }

  async function fetchWithRefresh(url, init) {
    const first = await fetch(url, { ...init, headers: authHeaders() });
    if (first.status !== 401) return first;
    const refreshed = await tryRefreshSession();
    if (!refreshed) return first;
    return fetch(url, { ...init, headers: authHeaders() });
  }

  async function patchProfile(payload) {
    const res = await fetchWithRefresh(apiUrl("/me/profile"), {
      method: "PATCH",
      body: JSON.stringify(payload || {}),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      const reason =
        body && (body.error || body.message)
          ? typeof body.error === "string"
            ? body.error
            : JSON.stringify(body.error)
          : `Request failed (${res.status})`;
      const err = new Error(reason);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  async function loadFromServer(user) {
    if (!user || !user.access_token) return null;
    try {
      const res = await fetchWithRefresh(apiUrl("/me"), {});
      if (!res.ok) return null;
      const body = await res.json();
      absorbServerResponse(user, body);
      return body;
    } catch (e) {
      console.warn("Profile load from server failed:", e);
      return null;
    }
  }

  function friendlyAuthError(e) {
    const m = String((e && e.message) || "").toLowerCase();
    if (e && e.status === 401) {
      return "Your session expired. Please sign in again to save changes.";
    }
    if (m.includes("sign in required") || m.includes("not signed in")) {
      return "Your session expired. Please sign in again to save changes.";
    }
    return (e && e.message) || "Network error.";
  }

  async function saveAvatarRemote(user, dataUrl) {
    if (!user) return { ok: false, reason: "Not signed in." };
    if (!user.access_token) {
      // Offline / no auth: keep it local-only so the UI still works.
      const ok = setAvatarLocal(user, dataUrl);
      return { ok, reason: ok ? "" : "Could not save locally.", local: true };
    }
    try {
      const body = await patchProfile({ avatar_data: dataUrl || "" });
      absorbServerResponse(user, body);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: friendlyAuthError(e) };
    }
  }

  async function saveDetailsRemote(user, details) {
    if (!user) return { ok: false, reason: "Not signed in." };
    const payload = {};
    for (const f of DETAIL_FIELDS) {
      payload[f] = details && typeof details[f] === "string" ? details[f].trim() : "";
    }
    if (!user.access_token) {
      const ok = setDetailsLocal(user, payload);
      return { ok, reason: ok ? "" : "Could not save locally.", local: true };
    }
    try {
      const body = await patchProfile(payload);
      absorbServerResponse(user, body);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: friendlyAuthError(e) };
    }
  }

  /* ---------- Avatar DOM apply + image resize ---------- */
  function applyAvatarToElement(el, user, fallbackText) {
    if (!el) return;
    const data = getAvatar(user);
    if (data) {
      el.style.backgroundImage = `url("${data}")`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.style.backgroundRepeat = "no-repeat";
      el.classList.add("avatar-has-image");
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.classList.remove("avatar-has-image");
      if (typeof fallbackText === "string") el.textContent = fallbackText;
    }
  }

  function resizeImageToDataUrl(file, maxSize) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("No file selected."));
      if (!String(file.type || "").startsWith("image/")) {
        return reject(new Error("Please choose an image file."));
      }
      if (file.size > MAX_INPUT_BYTES) {
        return reject(new Error("Image is too large. Choose a file under 8 MB."));
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const maxD = maxSize || 256;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) {
            URL.revokeObjectURL(url);
            return reject(new Error("Could not read image dimensions."));
          }
          if (w > h && w > maxD) { h = Math.round((h * maxD) / w); w = maxD; }
          else if (h >= w && h > maxD) { w = Math.round((w * maxD) / h); h = maxD; }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image."));
      };
      img.src = url;
    });
  }

  window.LearnIQAvatar = {
    get: getAvatar,
    /** Save the avatar. Returns Promise<{ ok, reason?, local? }>. */
    set: saveAvatarRemote,
    /** Cache-only setter used by `_absorb` and offline fallbacks. */
    setLocal: setAvatarLocal,
    clear: (user) => saveAvatarRemote(user, ""),
    applyToElement: applyAvatarToElement,
    resizeImageToDataUrl,
    loadFromServer,
  };

  window.LearnIQProfileDetails = {
    FIELDS: DETAIL_FIELDS.slice(),
    get: getDetails,
    /** Save the details. Returns Promise<{ ok, reason?, local? }>. */
    set: saveDetailsRemote,
    setLocal: setDetailsLocal,
    loadFromServer,
  };

  window.LearnIQProfile = {
    /** Update local caches from a `/me` (or PATCH /me/profile) response. */
    absorb: absorbServerResponse,
    loadFromServer,
  };
})();

/** User chip in student sidebar (dashboard-shell pages that skip setupStudentDashboard). */
function hydrateStudentSidebarChip() {
  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  if (!nameEl && !initialsEl && !trackEl) return;
  const user = getCurrentUserSession();
  const full = user ? getProfileDisplayName(user) : "";
  const roleGuess = user && user.role ? String(user.role).trim().toLowerCase() : "";
  const defaultName = roleGuess === "teacher" ? "Teacher" : "Student";
  if (nameEl) nameEl.textContent = full || (user && user.email) || defaultName;
  if (initialsEl) {
    const fallback = user
      ? getUserInitials(full || (user.email || ""))
      : roleGuess === "teacher"
        ? "TC"
        : "ST";
    if (user && window.LearnIQAvatar) {
      window.LearnIQAvatar.applyToElement(initialsEl, user, fallback);
    } else {
      initialsEl.textContent = fallback;
    }
  }
  if (trackEl) {
    if (user && user.id_number) {
      trackEl.textContent = `ID ${user.id_number}`;
    } else if (user && user.email) {
      trackEl.textContent = String(user.email).trim();
    } else {
      trackEl.textContent = "";
    }
  }
}

/**
 * Mobile nav: turns the fixed sidebar into a hamburger-triggered slide-in
 * drawer below 1080px (see css/learniq-sidebar.css) instead of stacking the
 * full nav list above the page content, which pushed every page below the
 * fold on phones. Runs on every page — no-ops if there's no sidebar here.
 */
function initMobileSidebarDrawer() {
  const sidebar = document.querySelector(
    ".dashboard-shell > .sidebar.lq-sidebar, .dashboard-shell > .sidebar, .dashboard-shell > aside.sidebar"
  );
  if (!sidebar || document.querySelector(".sidebar-mobile-toggle")) return;

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "sidebar-mobile-toggle";
  toggleBtn.setAttribute("aria-label", "Open menu");
  toggleBtn.setAttribute("aria-expanded", "false");
  toggleBtn.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';

  const backdrop = document.createElement("div");
  backdrop.className = "sidebar-mobile-backdrop";

  document.body.appendChild(backdrop);
  document.body.appendChild(toggleBtn);

  function openDrawer() {
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-open");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) closeDrawer();
    else openDrawer();
  });
  backdrop.addEventListener("click", closeDrawer);
  sidebar.querySelectorAll(".side-links a").forEach((a) => a.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });
}

const DASHBOARD_SIDEBAR_BY_ROLE = {
  teacher: {
    brandSubtitle: "Teacher LearnIQ",
    bodyClass: "teacher-learniq-page",
    profileLinkId: "teacher-profile-chip-link",
    items: [
      { id: "dashboard", href: "teacher-learniq-dashboard.html", icon: "fa-chalkboard-user", label: "Dashboard" },
      { id: "subjects", href: "teacher-subjects.html", icon: "fa-book-open", label: "My Subjects" },
      { id: "ai-result", href: "ai-result.html", icon: "fa-wand-sparkles", label: "Full lesson review" },
      { id: "leaderboard", href: "leaderboard.html", icon: "fa-trophy", label: "Leaderboard" },
      { id: "gradecard", href: "teacher-student-gradecard.html", icon: "fa-id-card", label: "Student Gradecard" },
      {
        id: "immersion-attendance",
        href: "teacher-immersion-attendance.html",
        icon: "fa-briefcase",
        label: "Immersion Attendance",
      },
      {
        id: "student-registration",
        href: "teacher-student-registration.html",
        icon: "fa-user-plus",
        label: "Student Registration",
      },
      { id: "settings", href: "teacher-settings.html", icon: "fa-gear", label: "Settings" },
    ],
  },
  student: {
    brandSubtitle: "LearnIQ Module",
    bodyClass: null,
    profileLinkId: "student-profile-chip-link",
    items: [
      { id: "learniq-dashboard", href: "learniq-dashboard.html", icon: "fa-graduation-cap", label: "LearnIQ Dashboard" },
      { id: "subjects", href: "subjects.html", icon: "fa-book-open", label: "My lesson" },
      { id: "archived", href: "student-archived.html", icon: "fa-box-archive", label: "Archived" },
      { id: "battle-arena", href: "battle-arena.html", icon: "fa-gamepad", label: "AI Battle Arena" },
      { id: "leaderboard", href: "leaderboard.html", icon: "fa-trophy", label: "Leaderboard" },
      { id: "history", href: "history.html", icon: "fa-clock-rotate-left", label: "History" },
      { id: "module", href: "module-selection.html", icon: "fa-th-large", label: "Module Selection" },
      { id: "settings", href: "student-settings.html", icon: "fa-gear", label: "Settings" },
    ],
  },
};

const TEACHER_ONLY_PAGE_PATHS = new Set([
  "teacher-learniq-dashboard.html",
  "teacher-dashboard.html",
  "teacher-subjects.html",
  "teacher-subject-lessons.html",
  "ai-result.html",
  "teacher-student-gradecard.html",
  "teacher-immersion-attendance.html",
  "teacher-student-registration.html",
  "teacher-settings.html",
]);

const TEACHER_PATH_TO_SIDEBAR_ID = {
  "teacher-learniq-dashboard.html": "dashboard",
  "teacher-dashboard.html": "dashboard",
  "teacher-subjects.html": "subjects",
  "teacher-subject-lessons.html": "subjects",
  "ai-result.html": "ai-result",
  "leaderboard.html": "leaderboard",
  "teacher-student-gradecard.html": "gradecard",
  "teacher-immersion-attendance.html": "immersion-attendance",
  "teacher-student-registration.html": "student-registration",
  "teacher-settings.html": "settings",
};

const STUDENT_PATH_TO_SIDEBAR_ID = {
  "learniq-dashboard.html": "learniq-dashboard",
  "my-lesson.html": "learniq-dashboard",
  "subjects.html": "subjects",
  "student-archived.html": "archived",
  "battle-arena.html": "battle-arena",
  "leaderboard.html": "leaderboard",
  "history.html": "history",
  "module-selection.html": "module",
  "student-settings.html": "settings",
  "student-profile.html": "settings",
};

function getDashboardSidebarActivePageId() {
  const fromDataset = (document.body?.dataset?.sidebarActive || "").trim();
  if (fromDataset) return fromDataset;
  const path = (window.location.pathname || "").split("/").pop() || "";
  return TEACHER_PATH_TO_SIDEBAR_ID[path] || STUDENT_PATH_TO_SIDEBAR_ID[path] || "";
}

function isTeacherSidebarPage() {
  const path = (window.location.pathname || "").split("/").pop() || "";
  return TEACHER_ONLY_PAGE_PATHS.has(path) || document.body?.classList?.contains("teacher-learniq-page");
}

function isAdminAppPage() {
  const path = (window.location.pathname || "").split("/").pop() || "";
  return path.startsWith("admin-") && path.endsWith(".html");
}

function resolveDashboardSidebarRole() {
  if (isAdminAppPage()) return "admin";
  const user = getCurrentUserSession();
  const role = user && user.role ? String(user.role).trim().toLowerCase() : "";
  if (role === "teacher") return "teacher";
  if (role === "admin") return "admin";
  if (role === "student") return "student";
  if (isTeacherSidebarPage()) return "teacher";
  return "student";
}

function redirectAdminFromTeacherOnlyPages() {
  if (!isTeacherSidebarPage() || isAdminAppPage()) return;
  const user = getCurrentUserSession();
  const role = user && user.role ? String(user.role).trim().toLowerCase() : "";
  if (role !== "admin") return;
  window.location.replace("admin-approval.html");
}

function renderTeacherSidebar(activePageId) {
  const navHost = document.querySelector(".side-links");
  const pageId = activePageId || getDashboardSidebarActivePageId();
  if (!navHost || !pageId) return;

  const config = DASHBOARD_SIDEBAR_BY_ROLE.teacher;
  const brandSmall = document.querySelector(".sidebar-header .brand small");
  if (brandSmall) brandSmall.textContent = config.brandSubtitle;
  document.body.classList.add("teacher-learniq-page");

  const profileLink = document.querySelector(".sidebar-footer .user-chip-profile-link");
  if (profileLink && config.profileLinkId) profileLink.id = config.profileLinkId;

  navHost.innerHTML = config.items
    .map((item) => {
      const isActive = item.id === pageId;
      return `<a href="${escapeHtml(item.href)}"${isActive ? ' class="active"' : ""}><i class="fa-solid ${escapeHtml(
        item.icon
      )}"></i> ${escapeHtml(item.label)}</a>`;
    })
    .join("");

  hydrateStudentSidebarChip();
}

function ensureTeacherSidebarNav() {
  if (!isTeacherSidebarPage()) return;
  if (resolveDashboardSidebarRole() === "admin") return;
  renderTeacherSidebar(getDashboardSidebarActivePageId());
}

if (typeof window !== "undefined") {
  window.ensureTeacherSidebarNav = ensureTeacherSidebarNav;
  window.renderTeacherSidebar = renderTeacherSidebar;
}

/** Shared pages (leaderboard, history) show student nav in HTML; swap for teachers from session. */
function applyRoleAwareDashboardSidebar(activePageId) {
  if (isAdminAppPage()) return;

  const sidebarRole = resolveDashboardSidebarRole();
  if (sidebarRole === "admin") return;

  const pageId = activePageId || getDashboardSidebarActivePageId();
  if (!pageId) return;

  if (isTeacherSidebarPage() || sidebarRole === "teacher") {
    renderTeacherSidebar(pageId);
    return;
  }

  const navHost = document.querySelector(".side-links");
  if (!navHost) return;

  const config = DASHBOARD_SIDEBAR_BY_ROLE.student;
  const brandSmall = document.querySelector(".sidebar-header .brand small");
  if (brandSmall) brandSmall.textContent = config.brandSubtitle;
  document.body.classList.remove("teacher-learniq-page");

  const profileLink = document.querySelector(".sidebar-footer .user-chip-profile-link");
  if (profileLink && config.profileLinkId) profileLink.id = config.profileLinkId;

  navHost.innerHTML = config.items
    .map((item) => {
      const isActive = item.id === pageId;
      return `<a href="${escapeHtml(item.href)}" data-nav-id="${escapeHtml(item.id)}"${
        isActive ? ' class="active"' : ""
      }><i class="fa-solid ${escapeHtml(item.icon)}"></i> ${escapeHtml(item.label)}</a>`;
    })
    .join("");

  hydrateStudentSidebarChip();
}

function initRoleAwareDashboardSidebar() {
  if (isAdminAppPage()) return;
  const pageId = getDashboardSidebarActivePageId();
  if (pageId) applyRoleAwareDashboardSidebar(pageId);
}

function refreshDashboardSidebarForSession() {
  const pageId = getDashboardSidebarActivePageId();
  if (!pageId) return;
  if (isAdminAppPage()) {
    renderAdminSidebar(pageId);
    return;
  }
  applyRoleAwareDashboardSidebar(pageId);
}

const ADMIN_SIDEBAR_ITEMS = [
  { id: "dashboard", href: "admin-approval.html", icon: "fa-gauge", label: "Dashboard" },
  { id: "student-approvals", href: "admin-student-approvals.html", icon: "fa-user-graduate", label: "Students" },
  { id: "teacher-approvals", href: "admin-teacher-approvals.html", icon: "fa-chalkboard-user", label: "Teachers" },
  {
    id: "teacher-registration",
    href: "admin-teacher-registration.html",
    icon: "fa-chalkboard-user",
    label: "Teacher Registration",
  },
  {
    id: "student-registration",
    href: "admin-student-registration.html",
    icon: "fa-user-plus",
    label: "Student Registration",
  },
  { id: "users", href: "admin-users.html", icon: "fa-users", label: "Users" },
  { id: "subjects", href: "admin-subjects.html", icon: "fa-book-open", label: "Subjects" },
  { id: "ai-results", href: "admin-approval.html#ai-results", icon: "fa-robot", label: "AI Results" },
  { id: "files", href: "admin-uploaded-files.html", icon: "fa-cloud-arrow-up", label: "Uploaded Files" },
  { id: "leaderboard", href: "admin-leaderboard.html", icon: "fa-ranking-star", label: "Leaderboard" },
  { id: "gradecard", href: "admin-student-gradecard.html", icon: "fa-id-card", label: "Student Gradecard" },
  { id: "attendance", href: "admin-attendance-logs.html", icon: "fa-calendar-check", label: "Attendance Logs" },
  { id: "journals", href: "admin-journals.html", icon: "fa-book", label: "Journals" },
  { id: "reports", href: "admin-reports.html", icon: "fa-file-lines", label: "Reports" },
  { id: "settings", href: "admin-settings.html", icon: "fa-gear", label: "Settings" },
];

const ADMIN_PATH_TO_SIDEBAR_ID = {
  "admin-approval.html": "dashboard",
  "admin-student-approvals.html": "student-approvals",
  "admin-teacher-approvals.html": "teacher-approvals",
  "admin-teacher-registration.html": "teacher-registration",
  "admin-student-registration.html": "student-registration",
  "admin-users.html": "users",
  "admin-subjects.html": "subjects",
  "admin-uploaded-files.html": "files",
  "admin-leaderboard.html": "leaderboard",
  "admin-student-gradecard.html": "gradecard",
  "admin-attendance-logs.html": "attendance",
  "admin-journals.html": "journals",
  "admin-reports.html": "reports",
  "admin-settings.html": "settings",
  "admin-profile.html": "settings",
};

function getAdminSidebarActivePageId() {
  const fromDataset = (document.body?.dataset?.sidebarActive || "").trim();
  if (fromDataset) return fromDataset;
  const path = (window.location.pathname || "").split("/").pop() || "";
  if (path === "admin-approval.html" && window.location.hash === "#ai-results") {
    return "ai-results";
  }
  return ADMIN_PATH_TO_SIDEBAR_ID[path] || "";
}

function renderAdminSidebar(activePageId) {
  const navHost = document.querySelector(".side-links");
  const pageId = activePageId || getAdminSidebarActivePageId();
  if (!navHost || !pageId) return;

  document.body.classList.remove("teacher-learniq-page");

  navHost.innerHTML = ADMIN_SIDEBAR_ITEMS.map((item) => {
    const isActive = item.id === pageId;
    return `<a href="${escapeHtml(item.href)}"${isActive ? ' class="active"' : ""}><i class="fa-solid ${escapeHtml(
      item.icon
    )}"></i> ${escapeHtml(item.label)}</a>`;
  }).join("");
}

/** Every admin-*.html page runs this on load — the one place to enforce
 * "not an admin? get out" consistently, instead of each page needing its
 * own copy of the check (most didn't have one). */
function guardAdminAppPage() {
  if (!isAdminAppPage()) return true;
  const user = getCurrentUserSession();
  const role = user && user.role ? String(user.role).trim().toLowerCase() : "";
  if (!user?.access_token || role !== "admin") {
    window.location.replace("login.html");
    return false;
  }
  return true;
}

function initAdminSidebar() {
  if (!isAdminAppPage()) return;
  if (!guardAdminAppPage()) return;
  renderAdminSidebar(getAdminSidebarActivePageId());
  hydrateAdminSidebarFromSession();
  if (!window.__adminSidebarHashBound) {
    window.__adminSidebarHashBound = true;
    window.addEventListener("hashchange", () => {
      if (isAdminAppPage()) renderAdminSidebar(getAdminSidebarActivePageId());
    });
  }
}

function ensureAdminSidebarNav() {
  if (!isAdminAppPage()) return;
  if (!guardAdminAppPage()) return;
  renderAdminSidebar(getAdminSidebarActivePageId());
}

if (typeof window !== "undefined") {
  window.ensureAdminSidebarNav = ensureAdminSidebarNav;
  window.guardAdminAppPage = guardAdminAppPage;
  window.renderAdminSidebar = renderAdminSidebar;
  window.isAdminAppPage = isAdminAppPage;
}

/** Teacher LearnIQ sidebar footer — session + /me (all teacher-learniq-page layouts). */
function initTeacherLearniqSidebarProfile() {
  if (!document.body?.classList?.contains("teacher-learniq-page")) return;
  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();
}

/** Admin sidebar chip (pages under admin-*.html with #admin-sidebar-* ids). */
function hydrateAdminSidebarFromSession() {
  const nameEl = document.getElementById("admin-sidebar-name");
  const roleEl = document.getElementById("admin-sidebar-role");
  const avatarEl = document.getElementById("admin-sidebar-avatar");
  if (!nameEl && !roleEl && !avatarEl) return;
  const user = getCurrentUserSession();
  if (!user) return;
  const full = getProfileDisplayName(user);
  const roleRaw = String(user.role || "admin").trim().toLowerCase();
  const roleLabel =
    roleRaw === "admin" ? "Admin / Principal" : roleRaw ? roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1) : "Admin";
  if (nameEl) nameEl.textContent = full || String(user.email || "").trim() || "Admin";
  if (roleEl) roleEl.textContent = roleLabel;
  if (avatarEl) {
    const fallback = getUserInitials(full || String(user.email || "")) || "AD";
    if (window.LearnIQAvatar) {
      window.LearnIQAvatar.applyToElement(avatarEl, user, fallback);
    } else {
      avatarEl.textContent = fallback;
    }
  }
}

function learniqPreviewName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "Student";
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const ini = last.length ? `${last[0].toUpperCase()}.` : "";
  return `${parts[0]} ${ini}`.trim();
}

async function initLearniqDashboardIfPresent() {
  const pointsEl = document.getElementById("dashboard-stat-points");
  if (!pointsEl) return;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const u = getCurrentUserSession();
  const greetingName = u ? String(u.first_name || "").trim() || getProfileDisplayName(u) : "Student";
  setText("dashboard-greeting-name", greetingName);

  if (!u?.access_token) {
    setText("dashboard-stat-points", "0");
    setText("dashboard-stat-week", "Sign in to see your stats");
    setText("dashboard-stat-rank", "—");
    setText("dashboard-stat-rank-note", "Leaderboard uses quiz scores");
    setText("dashboard-stat-progress-pct", "0%");
    const sp0 = document.getElementById("dashboard-progress-span");
    if (sp0) {
      sp0.dataset.progress = "0%";
      sp0.style.width = "0%";
    }
    setText("dash-lesson-line", "—");
    setText("dash-quiz-line", "—");
    setText("dash-week-line", "—");
    const ul0 = document.getElementById("dashboard-leaderboard-mini");
    if (ul0) ul0.innerHTML = '<li class="small-note">Sign in to load the board.</li>';
    return;
  }

  try {
    const res = await fetch(apiUrl("/student/dashboard-stats"), { headers: immersionAuthHeaders() });
    const d = await readApiJson(res);
    pointsEl.textContent = Number(d.total_points || 0).toLocaleString();
    setText("dashboard-stat-week", d.points_week_note || "");
    const rank = d.leaderboard_rank;
    setText("dashboard-stat-rank", rank != null ? `#${rank}` : "—");
    setText("dashboard-stat-rank-note", d.rank_note || "");
    const pct = Number(d.progress_pct || 0);
    const pctLabel = `${Number.isFinite(pct) ? pct.toFixed(1) : "0.0"}%`;
    setText("dashboard-stat-progress-pct", pctLabel);
    const bar = document.getElementById("dashboard-progress-span");
    if (bar) {
      bar.dataset.progress = pctLabel;
      bar.style.width = pctLabel;
    }
    const pub = Number(d.published_lessons_count || 0);
    const practiced = Number(d.lessons_practiced || 0);
    setText("dash-lesson-line", `${practiced} / ${pub}`);
    setText("dash-quiz-line", String(d.quiz_attempts != null ? d.quiz_attempts : "0"));
    setText("dash-week-line", Number(d.points_this_week || 0).toLocaleString());

    const ul = document.getElementById("dashboard-leaderboard-mini");
    if (ul) {
      const prev = Array.isArray(d.leaderboard_preview) ? d.leaderboard_preview : [];
      if (!prev.length) {
        ul.innerHTML =
          '<li class="small-note">No rankings yet. Finish a scored quiz in My lesson to appear here.</li>';
      } else {
        const medals = { 1: "🥇 ", 2: "🥈 ", 3: "🥉 " };
        ul.innerHTML = prev
          .map((e) => {
            const rank = Number(e.rank) || 0;
            const medal = medals[rank] || "";
            return `<li data-rank="${rank}"><strong>${medal}${escapeHtml(String(e.rank))}. ${escapeHtml(
              learniqPreviewName(e.display_name || getProfileDisplayName(e))
            )}</strong> <small>${Number(e.total_points || 0).toLocaleString()} pts</small></li>`;
          })
          .join("");
      }
    }
    animateProgressBars();
  } catch (e) {
    console.error("dashboard-stats:", e);
    setText("dashboard-stat-points", "0");
    setText("dashboard-stat-week", "Could not load stats");
    setText("dashboard-stat-rank", "—");
    setText("dashboard-stat-rank-note", "Try refreshing the page");
    setText("dashboard-stat-progress-pct", "0%");
    const sp = document.getElementById("dashboard-progress-span");
    if (sp) {
      sp.dataset.progress = "0%";
      sp.style.width = "0%";
    }
    setText("dash-lesson-line", "—");
    setText("dash-quiz-line", "—");
    setText("dash-week-line", "—");
    const ulE = document.getElementById("dashboard-leaderboard-mini");
    if (ulE) ulE.innerHTML = '<li class="small-note">Rankings unavailable.</li>';
  }
}

/** Teacher LearnIQ — Student Performance tiles from /teacher/dashboard-stats.student_performance */
function hydrateTeacherDashboardStudentPerformance(d, opts) {
  const hint = document.getElementById("teacher-performance-hint");
  const topEl = document.getElementById("teacher-perf-top-value");
  const topDetail = document.getElementById("teacher-perf-top-detail");
  const attCount = document.getElementById("teacher-perf-attention-count");
  const attDetail = document.getElementById("teacher-perf-attention-detail");
  const compPct = document.getElementById("teacher-perf-completion-pct");
  const compDetail = document.getElementById("teacher-perf-completion-detail");
  const scopeCount = document.getElementById("teacher-perf-scope-count");
  const scopeDetail = document.getElementById("teacher-perf-scope-detail");
  if (!topEl || !topDetail || !attCount || !compPct || !compDetail || !attDetail) return;

  const showHint = (msg) => {
    if (!hint) return;
    if (msg) {
      hint.hidden = false;
      hint.textContent = msg;
    } else {
      hint.hidden = true;
      hint.textContent = "";
    }
  };

  if (opts && opts.signedOut) {
    showHint("Sign in to load student performance.");
    topEl.textContent = "—";
    topDetail.textContent = "";
    attCount.textContent = "—";
    compPct.textContent = "—";
    compDetail.textContent = "This month";
    if (scopeCount) scopeCount.textContent = "—";
    if (scopeDetail) scopeDetail.textContent = "With quiz attempts";
    return;
  }

  if ((opts && opts.error) || !d || typeof d !== "object") {
    showHint("Could not load student performance.");
    topEl.textContent = "—";
    topDetail.textContent = "Try refreshing the page";
    attCount.textContent = "—";
    compPct.textContent = "—";
    compDetail.textContent = "This month";
    if (scopeCount) scopeCount.textContent = "—";
    if (scopeDetail) scopeDetail.textContent = "With quiz attempts";
    return;
  }

  showHint("");

  const sp = d.student_performance;
  if (!sp || !sp.scope_student_count) {
    topEl.textContent = "—";
    topDetail.textContent = "No student quiz data on your lessons yet";
    attCount.textContent = "0";
    attDetail.textContent = "Below 70% avg";
    compPct.textContent = "—";
    compDetail.textContent = "No cohort yet";
    if (scopeCount) scopeCount.textContent = "0";
    if (scopeDetail) scopeDetail.textContent = "No quiz attempts yet";
    return;
  }

  const name = sp.top_name;
  const idn = sp.top_id_number;
  const tpct = sp.top_pct;
  if (name) {
    const safe = escapeHtml(String(name));
    if (idn) {
      const href = `student-profile.html?id_number=${encodeURIComponent(String(idn))}`;
      topEl.innerHTML = `<a href="${href}" class="teacher-performance-name-link" aria-label="Open student profile">${safe}</a>`;
    } else {
      topEl.textContent = String(name);
    }
  } else {
    topEl.textContent = "—";
  }

  if (tpct != null && Number.isFinite(Number(tpct))) {
    topDetail.textContent = `${Number(tpct).toFixed(1)}% quiz average`;
  } else {
    topDetail.textContent = "No average yet";
  }

  const na = Number(sp.needs_attention_count || 0);
  attCount.textContent = String(na);
  attDetail.textContent = "Below 70% avg";

  const scoped = Number(sp.scope_student_count || 0);
  if (scopeCount) scopeCount.textContent = String(scoped);
  if (scopeDetail) {
    scopeDetail.textContent =
      scoped === 1 ? "Student with quiz attempts" : "Students with quiz attempts";
  }

  const part = sp.participation_pct;
  if (part != null && Number.isFinite(Number(part))) {
    compPct.textContent = `${Number(part).toFixed(0)}%`;
    compDetail.textContent = "Quiz-taking students active this month";
  } else {
    compPct.textContent = "—";
    compDetail.textContent = "This month";
  }
}

function setTeacherOverviewPublishProgress(pct) {
  const label = document.getElementById("teacher-overview-publish-pct-label");
  const span = document.getElementById("teacher-overview-publish-progress");
  const n = pct != null && Number.isFinite(Number(pct)) ? Math.max(0, Math.min(100, Number(pct))) : null;
  if (label) label.textContent = n != null ? `${n.toFixed(0)}%` : "—";
  if (span) {
    const w = n != null ? `${n}%` : "0%";
    span.dataset.progress = w;
    span.style.width = w;
  }
}

function hydrateTeacherOverviewInsights(d) {
  const ul = document.getElementById("teacher-overview-insights");
  if (!ul) return;
  if (!d || typeof d !== "object") {
    ul.innerHTML = '<li class="small-note">Sign in to see teaching insights.</li>';
    return;
  }

  const items = [];
  const sp = d.student_performance || {};
  const atRisk = Number(sp.needs_attention_count || 0);
  if (atRisk > 0) {
    items.push({
      html: `<strong>${atRisk}</strong> student${atRisk === 1 ? "" : "s"} below 70% quiz average — review in <a href="teacher-student-gradecard.html">Student gradecard</a>.`,
      tone: "warn",
    });
  }

  const drafts = Number(d.draft_lessons != null ? d.draft_lessons : 0);
  if (drafts > 0) {
    items.push({
      html: `<strong>${drafts}</strong> draft lesson${drafts === 1 ? "" : "s"} not published — open <a href="teacher-subjects.html">My Subjects</a> to publish.`,
      tone: "info",
    });
  }

  const ai = Number(d.lessons_with_ai != null ? d.lessons_with_ai : 0);
  const total = Number(d.lessons_uploaded != null ? d.lessons_uploaded : 0);
  if (total > 0 && ai < total) {
    items.push({
      html: `<strong>${total - ai}</strong> lesson${total - ai === 1 ? "" : "s"} still need an AI pack (reviewer/quiz).`,
      tone: "info",
    });
  }

  const enrolled = Number(d.enrolled_students != null ? d.enrolled_students : 0);
  if (enrolled === 0 && Number(d.subjects_count || 0) > 0) {
    items.push({
      html: "No students enrolled yet — share your subject join codes from My Subjects.",
      tone: "info",
    });
  }

  const attempts = Number(d.quiz_attempts_total || 0);
  if (attempts === 0 && total > 0 && Number(d.lessons_published || 0) > 0) {
    items.push({
      html: "Published lessons have no quiz attempts yet — remind students to practice in My lesson.",
      tone: "info",
    });
  }

  if (sp.top_name && sp.top_pct != null && !atRisk) {
    items.push({
      html: `Strongest quiz average: <strong>${escapeHtml(String(sp.top_name))}</strong> (${Number(sp.top_pct).toFixed(1)}%). See <a href="leaderboard.html">Leaderboard</a> for full rankings.`,
      tone: "ok",
    });
  }

  if (!items.length) {
    ul.innerHTML =
      '<li class="teacher-overview-insight teacher-overview-insight-ok">You are set up — create a subject, upload a lesson, and invite students when ready.</li>';
    return;
  }

  ul.innerHTML = items
    .map(
      (item) =>
        `<li class="teacher-overview-insight teacher-overview-insight-${escapeHtml(item.tone || "info")}">${item.html}</li>`,
    )
    .join("");
}

/** Teacher LearnIQ overview dashboard (Bearer + role teacher). */
async function initTeacherLearniqDashboardStatsIfPresent() {
  if (document.body?.classList?.contains("teacher-subject-lessons-page")) return;
  const root = document.getElementById("teacher-overview-enrolled");
  if (!root) return;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const u = getCurrentUserSession();
  if (!u?.access_token) {
    setText("teacher-overview-enrolled", "—");
    setText("teacher-overview-enrolled-note", "Sign in to load");
    hydrateTeacherOverviewInsights(null);
    return;
  }

  try {
    const res = await fetch(apiUrl("/teacher/dashboard-stats"), { headers: immersionAuthHeaders() });
    const d = await readApiJson(res);

    setText("teacher-overview-enrolled", String(d.enrolled_students != null ? d.enrolled_students : "0"));
    setText("teacher-overview-enrolled-note", d.enrolled_students_note || "");
    setText("teacher-overview-quiz-attempts", String(d.quiz_attempts_total != null ? d.quiz_attempts_total : "0"));
    setText("teacher-overview-quiz-note", d.quiz_attempts_note || "");
    const avg = d.avg_quiz_score_pct;
    setText(
      "teacher-overview-avg",
      avg != null && Number.isFinite(Number(avg)) ? `${Number(avg).toFixed(1)}%` : "—",
    );
    setText("teacher-overview-avg-note", d.avg_quiz_note || "");

    const sp = d.student_performance || {};
    const part = sp.participation_pct;
    setText(
      "teacher-overview-participation",
      part != null && Number.isFinite(Number(part)) ? `${Number(part).toFixed(0)}%` : "—",
    );
    setText(
      "teacher-overview-participation-note",
      sp.scope_student_count
        ? `${sp.scope_student_count} student${sp.scope_student_count === 1 ? "" : "s"} with quiz data`
        : "No quiz takers yet",
    );

    setText("teacher-overview-drafts", String(d.draft_lessons != null ? d.draft_lessons : "0"));
    setText("teacher-overview-drafts-note", d.draft_lessons_note || "");
    setText("teacher-overview-published", String(d.lessons_published != null ? d.lessons_published : "0"));
    setText("teacher-overview-published-note", d.lessons_published_note || "");
    setText("teacher-overview-ai", String(d.lessons_with_ai != null ? d.lessons_with_ai : "0"));
    setText("teacher-overview-ai-note", d.lessons_with_ai_note || "");
    const rate = d.publish_rate_pct;
    setText(
      "teacher-overview-publish-rate",
      rate != null && Number.isFinite(Number(rate)) ? `${Number(rate).toFixed(0)}%` : "—",
    );
    setText("teacher-overview-publish-rate-note", d.publish_rate_note || "");
    setTeacherOverviewPublishProgress(rate);

    const updatedEl = document.getElementById("teacher-stats-updated");
    if (updatedEl && d.updated_at) {
      try {
        updatedEl.hidden = false;
        updatedEl.textContent = `Updated ${new Date(d.updated_at).toLocaleString()}`;
      } catch {
        updatedEl.hidden = true;
      }
    }

    hydrateTeacherOverviewInsights(d);
    animateProgressBars();
  } catch (e) {
    console.error("teacher/dashboard-stats:", e);
    setText("teacher-overview-enrolled", "—");
    setText("teacher-overview-enrolled-note", "Could not load stats");
    hydrateTeacherOverviewInsights(null);
  }
}

function setupLeaderboardPage() {
  const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  if (!path.includes("leaderboard.html")) return;

  initRoleAwareDashboardSidebar();

  const emptyEl = document.getElementById("leaderboard-empty");
  const populatedEl = document.getElementById("leaderboard-populated");
  const podiumEl = document.getElementById("leaderboard-podium");
  const tbody = document.getElementById("leaderboard-table-body");
  const liveLine = document.getElementById("leaderboard-live-line");
  const tableNote = document.getElementById("leaderboard-table-note");
  const emptyTitle = document.getElementById("leaderboard-empty-title");
  const emptyBody = document.getElementById("leaderboard-empty-body");
  const emptyCta = document.getElementById("leaderboard-empty-cta");
  const retryBtn = document.getElementById("leaderboard-retry-btn");
  const refreshBtn = document.getElementById("leaderboard-refresh-btn");

  const fmtInt = (n) => Number(n).toLocaleString();
  const fmtPct = (x) => {
    const v = Number(x);
    return `${Number.isFinite(v) ? v.toFixed(1) : "0.0"}%`;
  };

  function defaultEmptyCopy() {
    if (emptyTitle) emptyTitle.textContent = "No rankings yet";
    if (emptyBody) {
      emptyBody.innerHTML =
        "When students complete quizzes in <strong>My lesson</strong>, scores appear here. Be the first on the board.";
    }
    if (emptyCta) emptyCta.hidden = false;
    if (retryBtn) retryBtn.hidden = true;
  }

  function errorEmptyCopy(msg) {
    if (emptyTitle) emptyTitle.textContent = "Could not load rankings";
    if (emptyBody) emptyBody.textContent = msg || "Check that the API is running and Supabase is configured.";
    if (emptyCta) emptyCta.hidden = true;
    if (retryBtn) retryBtn.hidden = false;
  }

  function renderPodium(entries) {
    if (!podiumEl) return;
    const slots = [
      { podiumClass: "second", rank: 2, dataIndex: 1, hint: "Second place is open — keep practicing." },
      { podiumClass: "first", rank: 1, dataIndex: 0, hint: "Complete a quiz to claim the top spot." },
      { podiumClass: "third", rank: 3, dataIndex: 2, hint: "Third place awaits — every quiz counts." },
    ];
    podiumEl.innerHTML = slots
      .map(({ podiumClass, rank, dataIndex, hint }) => {
        const e = entries[dataIndex];
        if (!e) {
          return `<article class="glass-card top-rank-card ${podiumClass} is-leaderboard-placeholder">
            <div class="rank-badge">#${rank}</div>
            <h3>—</h3>
            <p>Open</p>
            <small>${escapeHtml(hint)}</small>
          </article>`;
        }
        return `<article class="glass-card top-rank-card ${podiumClass}">
          <div class="rank-badge">#${e.rank}</div>
          <h3>${escapeHtml(e.display_name || getProfileDisplayName(e) || "Student")}</h3>
          <p>${fmtInt(e.total_points)} points</p>
          <small>${escapeHtml(e.tagline || "")}</small>
        </article>`;
      })
      .join("");
  }

  function renderTable(entries, currentIdNumber) {
    if (!tbody) return;
    const cur = (currentIdNumber || "").trim();
    tbody.innerHTML = entries
      .map((e) => {
        const idn = (e.id_number || "").trim();
        const isYou = cur && idn && idn === cur;
        return `<tr class="${isYou ? "leaderboard-row-you" : ""}">
          <td>#${e.rank}</td>
          <td>${escapeHtml(e.display_name || getProfileDisplayName(e) || "Student")}${isYou ? ' <span class="small-note">(you)</span>' : ""}</td>
          <td>${fmtInt(e.total_points)}</td>
          <td>${fmtInt(e.quiz_attempts)}</td>
          <td>${fmtPct(e.progress_pct)}</td>
        </tr>`;
      })
      .join("");
  }

  async function refresh() {
    if (liveLine) liveLine.textContent = "Updating…";
    try {
      const res = await fetch(apiUrl("/student/leaderboard?limit=50"));
      const data = await readApiJson(res);
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const updated = data.updated_at;

      defaultEmptyCopy();

      if (liveLine) {
        if (updated) {
          const d = new Date(updated);
          const t = !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(updated);
          liveLine.textContent = `Last updated: ${t} · Auto-refresh every 45s`;
        } else {
          liveLine.textContent = "Live from quiz submissions";
        }
      }

      if (tableNote) {
        tableNote.textContent =
          entries.length === 0
            ? "No submitted quiz attempts yet."
            : `Showing ${entries.length} student${entries.length === 1 ? "" : "s"} · Sorted by total points, then accuracy.`;
      }

      if (entries.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        if (populatedEl) populatedEl.hidden = true;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        if (populatedEl) populatedEl.hidden = false;
        renderPodium(entries);
        const u = getCurrentUserSession();
        renderTable(entries, u && u.id_number ? String(u.id_number) : "");
      }
    } catch (e) {
      console.error("leaderboard:", e);
      errorEmptyCopy(e?.message || "Request failed.");
      if (liveLine) liveLine.textContent = "Could not refresh rankings.";
      if (emptyEl) emptyEl.hidden = false;
      if (populatedEl) populatedEl.hidden = true;
    }
  }

  emptyCta?.addEventListener("click", () => {
    const user = getCurrentUserSession();
    const role = user && user.role ? String(user.role).trim().toLowerCase() : "student";
    window.location.href = role === "teacher" ? "teacher-subjects.html" : "subjects.html";
  });
  retryBtn?.addEventListener("click", () => {
    defaultEmptyCopy();
    refresh();
  });
  refreshBtn?.addEventListener("click", () => refresh());

  refresh();
  setInterval(refresh, 45_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
  });
}

function immersionAuthHeaders() {
  const u = getCurrentUserSession();
  const headers = { "Content-Type": "application/json" };
  if (u && u.access_token) {
    headers.Authorization = `Bearer ${u.access_token}`;
  }
  return headers;
}

async function hydrateSidebarProfileFromDatabase() {
  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  const linkEl = document.getElementById("student-profile-chip-link") || document.getElementById("teacher-profile-chip-link");
  if (!nameEl && !initialsEl && !trackEl && !linkEl) return;

  const u = getCurrentUserSession();
  if (!u?.access_token) return;

  try {
    const res = await fetch(apiUrl("/me"), { headers: immersionAuthHeaders() });
    const p = await readApiJson(res);
    const showName = getProfileDisplayName(p) || (p && p.email ? String(p.email).trim() : "") || "User";
    const email = p && p.email ? String(p.email).trim() : "";
    const idn = p && p.id_number ? String(p.id_number).trim() : "";

    const cacheUser = {
      id_number: idn,
      email,
      display_name: showName,
      first_name: p?.first_name || "",
      last_name: p?.last_name || "",
      middle_name: p?.middle_name || "",
      name_suffix: p?.name_suffix || "",
      access_token: u.access_token,
    };

    // Fold the freshly-fetched profile (incl. avatar_data) into the local
    // cache so any synchronous `applyToElement` calls on this page (and
    // future pages, since localStorage persists) render the photo.
    if (window.LearnIQProfile && typeof window.LearnIQProfile.absorb === "function") {
      window.LearnIQProfile.absorb(cacheUser, p);
    }

    if (nameEl) nameEl.textContent = showName;
    if (initialsEl) {
      const fallback = getUserInitials(showName || email);
      if (window.LearnIQAvatar) {
        window.LearnIQAvatar.applyToElement(initialsEl, cacheUser, fallback);
      } else {
        initialsEl.textContent = fallback;
      }
    }
    if (trackEl) trackEl.textContent = idn ? `ID ${idn}` : "";
    if (linkEl && idn) linkEl.href = `student-profile.html?id_number=${encodeURIComponent(idn)}`;
    if (typeof refreshDashboardSidebarForSession === "function") {
      refreshDashboardSidebarForSession();
    }
  } catch (e) {
    console.error("me:", e);
  }
}

function fmtImmersionClock(iso) {
  if (!iso) return "--:--";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function fmtImmersionDurationLabel(timeInIso, timeOutIso) {
  if (!timeInIso) return "0h 0m";
  const a = new Date(timeInIso).getTime();
  const b = timeOutIso ? new Date(timeOutIso).getTime() : Date.now();
  let mins = Math.max(0, Math.floor((b - a) / 60000));
  const h = Math.floor(mins / 60);
  mins %= 60;
  return `${h}h ${mins}m`;
}

/** Local YYYY-MM-DD for "today" cards (matches user's calendar day). */
function immersionTodayKeyLocal() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function immersionRowDayKey(row) {
  if (!row || typeof row !== "object") return "";
  if (row.date) return String(row.date).slice(0, 10);
  if (row.time_in) return String(row.time_in).slice(0, 10);
  return "";
}

/** Most recent attendance row for the local calendar day (for summary when not clocked in). */
function immersionPickTodayRow(history, todayKey) {
  if (!Array.isArray(history) || !todayKey) return null;
  const sameDay = history.filter((r) => immersionRowDayKey(r) === todayKey);
  if (!sameDay.length) return null;
  sameDay.sort((a, b) => String(b.time_in || "").localeCompare(String(a.time_in || "")));
  return sameDay[0];
}

function immersionCoordsLabel(lat, lon) {
  if (lat == null || lat === "" || lon == null || lon === "") return "";
  const a = Number(lat);
  const b = Number(lon);
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  return `${a.toFixed(6)}, ${b.toFixed(6)}`;
}

function fmtImmersionDetailTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
  } catch {
    return String(iso);
  }
}

function buildImmersionAttendanceDetailHtml(row) {
  const esc = escapeHtml;
  const escAttr = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  const photoSrc = (url) => {
    if (!url) return "";
    const u = String(url);
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
    let full = apiUrl(u);
    if (u.includes("/teacher/immersion/attendance-photo")) {
      const sess = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
      if (sess && sess.access_token) {
        full += `${full.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(sess.access_token)}`;
      }
    }
    return full;
  };
  const section = (title, photoUrl, location, coords, ts, pendingNote) => {
    const src = photoSrc(photoUrl);
    const photoBlock = src
      ? `<div class="immersion-detail-photo">
          <button type="button" class="immersion-detail-photo-thumb" data-photo-src="${escAttr(src)}" data-photo-label="${esc(title)}" aria-label="View full ${esc(title)} photo">
            <img src="${escAttr(src)}" alt="${esc(title)} verification photo" loading="lazy" />
          </button>
          <button type="button" class="btn btn-ghost btn-sm immersion-see-photo-btn" data-photo-src="${escAttr(src)}" data-photo-label="${esc(title)}">
            <i class="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true"></i> See photo
          </button>
        </div>`
      : `<p class="small-note">${esc(pendingNote || "No photo on file.")}</p>`;
    return `<section class="immersion-detail-section">
      <h4>${esc(title)}</h4>
      ${photoBlock}
      <dl class="immersion-detail-meta">
        <div><dt>location</dt><dd>${esc(location || "—")}</dd></div>
        <div><dt>coordinates</dt><dd>${esc(coords || "—")}</dd></div>
        <div><dt>timestamp</dt><dd>${esc(fmtImmersionDetailTimestamp(ts))}</dd></div>
      </dl>
    </section>`;
  };
  const tin = row.photo_url || row.time_in_photo_url;
  const tout = row.time_out_photo_url;
  const hasOut = row.time_out && String(row.time_out).trim() !== "";
  let html = section(
    "Time In",
    tin,
    row.readable_location_name,
    immersionCoordsLabel(row.latitude, row.longitude),
    row.capture_timestamp || row.time_in,
    "No Time In photo on file."
  );
  if (hasOut || tout || row.time_out_readable_location_name) {
    html += section(
      "Time Out",
      tout,
      row.time_out_readable_location_name,
      immersionCoordsLabel(row.time_out_latitude, row.time_out_longitude),
      row.time_out_capture_timestamp || row.time_out,
      "No Time Out photo on file."
    );
  } else {
    html += `<section class="immersion-detail-section"><h4>Time Out</h4><p class="small-note">Not recorded yet.</p></section>`;
  }
  return html;
}

function openImmersionAttendanceModal() {
  const modal = document.getElementById("immersion-attendance-modal");
  if (!modal) return;
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
}

function closeImmersionAttendanceModal() {
  closeImmersionPhotoLightbox();
  const modal = document.getElementById("immersion-attendance-modal");
  if (!modal) return;
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
}

function openImmersionPhotoLightbox(src, label) {
  if (!src) return;
  const lb = document.getElementById("immersion-photo-lightbox");
  const img = document.getElementById("immersion-photo-lightbox-img");
  if (!lb || !img) {
    window.open(src, "_blank", "noopener,noreferrer");
    return;
  }
  img.src = src;
  img.alt = label ? `${label} verification photo` : "Attendance verification photo";
  lb.removeAttribute("hidden");
}

function closeImmersionPhotoLightbox() {
  const lb = document.getElementById("immersion-photo-lightbox");
  const img = document.getElementById("immersion-photo-lightbox-img");
  if (!lb) return;
  lb.setAttribute("hidden", "");
  if (img) {
    img.removeAttribute("src");
    img.alt = "";
  }
}

function handleImmersionPhotoPreviewClick(ev) {
  const trigger = ev.target.closest(".immersion-see-photo-btn, .immersion-detail-photo-thumb");
  if (!trigger) return;
  ev.preventDefault();
  ev.stopPropagation();
  const src = trigger.dataset.photoSrc;
  const label = trigger.dataset.photoLabel || "Attendance";
  if (src) openImmersionPhotoLightbox(src, label);
}

function showImmersionAttendanceDetail(row) {
  if (!row) return;
  const titleEl = document.getElementById("immersion-attendance-modal-title");
  const subEl = document.getElementById("immersion-attendance-modal-subtitle");
  const body = document.getElementById("immersion-attendance-modal-body");
  const day = row.date || (row.time_in ? String(row.time_in).slice(0, 10) : "—");
  const tIn = fmtImmersionClock(row.time_in);
  const tOut = row.time_out ? fmtImmersionClock(row.time_out) : "—";
  if (titleEl) titleEl.textContent = "Attendance details";
  if (subEl) subEl.textContent = `${day} · Time In ${tIn} · Time Out ${tOut}`;
  if (body) {
    body.innerHTML = buildImmersionAttendanceDetailHtml(row);
    body.removeEventListener("click", handleImmersionPhotoPreviewClick);
    body.addEventListener("click", handleImmersionPhotoPreviewClick);
  }
  openImmersionAttendanceModal();
}

async function setupImmersionDashboard() {
  const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  if (!path.includes("immersion-dashboard.html")) return;

  const user = getCurrentUserSession();
  if (!user || !user.access_token || !user.id_number) {
    window.location.href = "login.html";
    return;
  }

  if (isGrade11Student(user)) {
    showToast("Immersion Tracker is only for Grade 12 students.", "info");
    window.location.href = "module-selection.html";
    return;
  }

  if (!canAccessImmersionTracker(user)) {
    try {
      const res = await fetch(apiUrl("/me"), { headers: immersionAuthHeaders() });
      const prof = await readApiJson(res);
      const merged = { ...user, ...prof };
      if (isGrade11Student(merged)) {
        showToast("Immersion Tracker is only for Grade 12 students.", "info");
        window.location.href = "module-selection.html";
        return;
      }
      setCurrentUserSession({ ...merged, access_token: user.access_token, refresh_token: user.refresh_token });
    } catch {
      /* continue if profile refresh fails */
    }
  }

  const nameEl = document.getElementById("student-display-name");
  const initialsEl = document.getElementById("student-avatar-initials");
  const trackEl = document.getElementById("student-display-track");
  const full = getProfileDisplayName(user) || "";
  if (nameEl && full) nameEl.textContent = full;
  if (initialsEl) {
    const fallback = getUserInitials(full || user.email || "");
    if (window.LearnIQAvatar) {
      window.LearnIQAvatar.applyToElement(initialsEl, user, fallback);
    } else {
      initialsEl.textContent = fallback;
    }
  }
  if (trackEl && user.id_number) trackEl.textContent = `ID ${user.id_number}`;
  void hydrateSidebarProfileFromDatabase();

  const qrScanToggleBtn = document.getElementById("qr-scan-toggle-btn");
  const qrScanToggleLabel = document.getElementById("qr-scan-toggle-label");
  const qrScannerPanel = document.getElementById("immersion-qr-scanner-panel");
  const qrScannerVideo = document.getElementById("immersion-qr-scanner-video");
  const qrScannerCanvas = document.getElementById("immersion-qr-scanner-canvas");
  const qrScannerStatus = document.getElementById("immersion-qr-scanner-status");
  const qrScannerCancelBtn = document.getElementById("immersion-qr-scanner-cancel-btn");
  const statusText = document.getElementById("time-status-text");
  const timeInDisplay = document.getElementById("time-in-display");
  const timeOutDisplay = document.getElementById("time-out-display");
  const durationDisplay = document.getElementById("duration-display");
  const listEl = document.getElementById("recent-attendance-list");
  const timeInSummary = document.getElementById("immersion-time-in-summary");
  const viewTimeInDetailsBtn = document.getElementById("view-time-in-details-btn");

  let durationTimer = null;
  let canClockIn = false;
  let canClockOut = false;
  let sessionRowForDetails = null;
  let recentAttendanceRows = [];
  let qrScanStream = null;
  let qrScanRafId = null;
  let qrScanBusy = false;

  function setQrScannerStatus(text, kind) {
    if (!qrScannerStatus) return;
    qrScannerStatus.classList.remove("is-success", "is-error");
    if (kind) qrScannerStatus.classList.add(kind === "success" ? "is-success" : "is-error");
    const icon = kind === "success" ? "fa-circle-check" : kind === "error" ? "fa-triangle-exclamation" : "fa-camera";
    qrScannerStatus.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i> ${escapeHtml(text)}`;
  }

  async function openQrScanner() {
    if (!qrScannerPanel || !qrScannerVideo) return;
    if (typeof jsQR !== "function") {
      showToast("QR scanner library did not load. Check your internet connection.", "error");
      return;
    }
    qrScannerPanel.hidden = false;
    if (qrScanToggleBtn) qrScanToggleBtn.hidden = true;
    setQrScannerStatus("Point the camera at the workplace QR code.");
    try {
      qrScanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      qrScannerVideo.srcObject = qrScanStream;
      await qrScannerVideo.play();
      qrScanLoop();
    } catch (e) {
      setQrScannerStatus("Could not open the camera. Allow camera access and try again.", "error");
    }
  }

  function closeQrScanner() {
    if (qrScanRafId) {
      cancelAnimationFrame(qrScanRafId);
      qrScanRafId = null;
    }
    if (qrScanStream) {
      qrScanStream.getTracks().forEach((t) => t.stop());
      qrScanStream = null;
    }
    if (qrScannerVideo) qrScannerVideo.srcObject = null;
    if (qrScannerPanel) qrScannerPanel.hidden = true;
    if (qrScanToggleBtn) qrScanToggleBtn.hidden = false;
    qrScanBusy = false;
  }

  function qrScanLoop() {
    if (!qrScannerVideo || !qrScannerCanvas || !qrScanStream) return;
    qrScanRafId = requestAnimationFrame(qrScanLoop);
    if (qrScannerVideo.readyState !== qrScannerVideo.HAVE_ENOUGH_DATA || qrScanBusy) return;
    const ctx = qrScannerCanvas.getContext("2d", { willReadFrequently: true });
    qrScannerCanvas.width = qrScannerVideo.videoWidth;
    qrScannerCanvas.height = qrScannerVideo.videoHeight;
    ctx.drawImage(qrScannerVideo, 0, 0, qrScannerCanvas.width, qrScannerCanvas.height);
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, qrScannerCanvas.width, qrScannerCanvas.height);
    } catch {
      return;
    }
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (!result || !result.data) return;
    const code = result.data.trim();
    if (!code) return;
    void handleQrScanned(code);
  }

  async function handleQrScanned(code) {
    qrScanBusy = true;
    setQrScannerStatus("Checking…");
    const u = getCurrentUserSession();
    const headers = { "Content-Type": "application/json" };
    if (u?.access_token) headers.Authorization = `Bearer ${u.access_token}`;
    try {
      const res = await fetch(apiUrl("/student/immersion/qr-checkin"), {
        method: "POST",
        headers,
        body: JSON.stringify({ scanned_code: code }),
      });
      const data = await readApiJson(res);
      const action = data.action === "time_out" ? "Time Out" : "Time In";
      setQrScannerStatus(`${action} recorded.`, "success");
      showToast(`${action} recorded.`, "success");
      window.setTimeout(closeQrScanner, 900);
      await refreshAttendanceUi();
    } catch (e) {
      setQrScannerStatus(e?.message || "That QR code could not be checked in.", "error");
      showToast(e?.message || "Check-in failed.", "error");
      qrScanBusy = false;
    }
  }

  qrScanToggleBtn?.addEventListener("click", () => void openQrScanner());
  qrScannerCancelBtn?.addEventListener("click", closeQrScanner);
  window.addEventListener("beforeunload", closeQrScanner);

  function applyClockedInForTimeOut(sessionRow) {
    canClockIn = false;
    canClockOut = true;
    sessionRowForDetails = sessionRow;
    if (qrScanToggleLabel) qrScanToggleLabel.textContent = "Scan to Time Out";
    if (timeInSummary) timeInSummary.hidden = false;
  }

  function applyIdleClockState() {
    canClockIn = true;
    canClockOut = false;
    sessionRowForDetails = null;
    if (qrScanToggleLabel) qrScanToggleLabel.textContent = "Scan to Time In";
    if (timeInSummary) timeInSummary.hidden = true;
  }

  async function refreshAttendanceUi() {
    let data;
    try {
      const res = await fetch(apiUrl("/attendance-history?limit=40"), { headers: immersionAuthHeaders() });
      data = await readApiJson(res);
    } catch (e) {
      console.error("attendance-history:", e);
      showToast(e?.message || "Could not load attendance. Check login and API URL.", "error");
      return;
    }
    const active = data.active || null;
    const todayKey = immersionTodayKeyLocal();
    const todayRow = immersionPickTodayRow(data.history, todayKey);

    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }

    if (active && active.time_in) {
      applyClockedInForTimeOut(active);
      if (statusText) statusText.textContent = "Clocked In";
      if (timeInDisplay) timeInDisplay.textContent = fmtImmersionClock(active.time_in);
      if (timeOutDisplay) timeOutDisplay.textContent = "--:--";
      if (durationDisplay) durationDisplay.textContent = fmtImmersionDurationLabel(active.time_in, null);
      const t0 = active.time_in;
      durationTimer = setInterval(() => {
        if (durationDisplay) durationDisplay.textContent = fmtImmersionDurationLabel(t0, null);
      }, 30_000);
    } else if (todayRow && todayRow.time_in) {
      const done = todayRow.time_out && String(todayRow.time_out).trim() !== "";
      if (done) {
        applyIdleClockState();
        sessionRowForDetails = todayRow;
      } else {
        applyClockedInForTimeOut(todayRow);
      }
      if (statusText) statusText.textContent = done ? "Session complete" : "Clocked In";
      if (timeInDisplay) timeInDisplay.textContent = fmtImmersionClock(todayRow.time_in);
      if (timeOutDisplay) {
        timeOutDisplay.textContent = done ? fmtImmersionClock(todayRow.time_out) : "--:--";
      }
      if (durationDisplay) {
        if (todayRow.total_hours != null && todayRow.total_hours !== "" && done) {
          const th = Number(todayRow.total_hours);
          if (!Number.isNaN(th)) {
            const m = Math.round(th * 60);
            durationDisplay.textContent = `${Math.floor(m / 60)}h ${m % 60}m`;
          } else {
            durationDisplay.textContent = fmtImmersionDurationLabel(todayRow.time_in, todayRow.time_out);
          }
        } else {
          durationDisplay.textContent = fmtImmersionDurationLabel(todayRow.time_in, todayRow.time_out);
        }
      }
      if (!done) {
        const t0 = todayRow.time_in;
        durationTimer = setInterval(() => {
          if (durationDisplay) durationDisplay.textContent = fmtImmersionDurationLabel(t0, null);
        }, 30_000);
      }
    } else {
      applyIdleClockState();
      if (statusText) statusText.textContent = "Not Clocked In";
      if (timeInDisplay) timeInDisplay.textContent = "--:--";
      if (timeOutDisplay) timeOutDisplay.textContent = "--:--";
      if (durationDisplay) durationDisplay.textContent = "0h 0m";
    }

    if (listEl && Array.isArray(data.history)) {
      const rows = data.history.slice(0, 10);
      recentAttendanceRows = rows;
      listEl.innerHTML = rows.length
        ? rows
            .map((r, idx) => {
              const st = String(r.status || "").toLowerCase();
              const badgeClass = st === "active" ? "active" : st === "completed" ? "completed" : "warning";
              const day =
                r.date ||
                (r.time_in ? String(r.time_in).slice(0, 10) : "—");
              const tIn = fmtImmersionClock(r.time_in);
              const tOut = r.time_out ? fmtImmersionClock(r.time_out) : "--";
              const sub =
                st === "active"
                  ? "Currently in session"
                  : r.total_hours != null && r.total_hours !== ""
                  ? `${Number(r.total_hours).toFixed(2)} hours`
                  : "—";
              const loc = (r.readable_location_name || "").trim();
              const locLine = loc
                ? `<span class="small-note time-log-location"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(loc)}</span>`
                : "";
              return `<li class="time-log-item immersion-attendance-row" data-row-idx="${idx}" role="button" tabindex="0">
              <div>
                <strong>${escapeHtml(day)}</strong>
                <span class="small-note">Time In: ${escapeHtml(tIn)} | Time Out: ${escapeHtml(tOut)}</span>
                ${locLine}
              </div>
              <div class="time-log-actions">
                <span class="status-badge ${badgeClass}">${escapeHtml(sub)}</span>
                <button type="button" class="btn btn-ghost btn-sm immersion-view-details-btn">View details</button>
              </div>
            </li>`;
            })
            .join("")
        : `<li class="time-log-item"><div><span class="small-note">No attendance logs yet. Scan the workplace QR code to start.</span></div></li>`;
    }
  }

  async function loadJournals() {
    const box = document.getElementById("recent-journal-list");
    if (!box) return;
    try {
      const res = await fetch(apiUrl("/journals"), { headers: immersionAuthHeaders() });
      const entries = await readApiJson(res);
      const arr = Array.isArray(entries) ? entries : [];
      box.innerHTML = arr.length
        ? arr
            .slice(0, 12)
            .map((j) => {
              const when = j.submitted_at || j.created_at || "";
              const content = j.body || j.journal_text || "";
              const d = when ? new Date(when) : null;
              return `<article class="journal-entry">
              <div class="journal-header">
                <strong>${escapeHtml(d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString() : "—")}</strong>
                <span class="small-note">${escapeHtml(fmtImmersionClock(when))}</span>
              </div>
              <p class="journal-content">${escapeHtml(content)}</p>
            </article>`;
            })
            .join("")
        : '<p class="small-note">No journal entries yet.</p>';
    } catch (e) {
      box.innerHTML = `<p class="small-note">${escapeHtml(e?.message || "Could not load journals.")}</p>`;
    }
  }


  viewTimeInDetailsBtn?.addEventListener("click", () => {
    if (sessionRowForDetails) showImmersionAttendanceDetail(sessionRowForDetails);
  });

  listEl?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".immersion-view-details-btn");
    const rowEl = ev.target.closest(".immersion-attendance-row");
    if (!btn && !rowEl) return;
    if (btn) ev.stopPropagation();
    const li = rowEl || btn?.closest(".immersion-attendance-row");
    const idx = Number(li?.dataset?.rowIdx);
    const row = recentAttendanceRows[idx];
    if (row) showImmersionAttendanceDetail(row);
  });

  listEl?.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const rowEl = ev.target.closest(".immersion-attendance-row");
    if (!rowEl) return;
    ev.preventDefault();
    const idx = Number(rowEl.dataset.rowIdx);
    const row = recentAttendanceRows[idx];
    if (row) showImmersionAttendanceDetail(row);
  });

  const attendanceModal = document.getElementById("immersion-attendance-modal");
  document.getElementById("immersion-attendance-modal-close")?.addEventListener("click", closeImmersionAttendanceModal);
  attendanceModal?.addEventListener("click", (ev) => {
    if (ev.target === attendanceModal) closeImmersionAttendanceModal();
  });
  const photoLightbox = document.getElementById("immersion-photo-lightbox");
  document.getElementById("immersion-photo-lightbox-close")?.addEventListener("click", closeImmersionPhotoLightbox);
  photoLightbox?.addEventListener("click", (ev) => {
    if (ev.target === photoLightbox) closeImmersionPhotoLightbox();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (photoLightbox && !photoLightbox.hasAttribute("hidden")) {
      closeImmersionPhotoLightbox();
      return;
    }
    if (attendanceModal && !attendanceModal.hasAttribute("hidden")) {
      closeImmersionAttendanceModal();
    }
  });

  document.getElementById("journal-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const bodyEl = document.getElementById("journal-body");
    const dateEl = document.getElementById("journal-date");
    const text = (bodyEl && bodyEl.value.trim()) || "";
    if (!text) {
      showToast("Write something in your journal first.", "error");
      return;
    }
    try {
      const payload = { body: text };
      if (dateEl && dateEl.value) payload.entry_date = dateEl.value;
      const res = await fetch(apiUrl("/journals"), {
        method: "POST",
        headers: immersionAuthHeaders(),
        body: JSON.stringify(payload),
      });
      await readApiJson(res);
      showToast("Journal saved.", "success");
      if (bodyEl) bodyEl.value = "";
      await loadJournals();
    } catch (e) {
      showToast(e?.message || "Could not save journal.", "error");
    }
  });

  await refreshAttendanceUi();
  await loadJournals();
}

const sampleUsers = [
  {
    fullName: "Maria Santos",
    idNumber: "2024-10001",
    email: "maria.santos@school.edu",
    password: "StudentPass1",
    role: "Student",
    status: "Pending",
    createdDate: "Mar 25, 2024"
  },
  {
    fullName: "Jose dela Cruz",
    idNumber: "2024-10002",
    email: "jose.delacruz@school.edu",
    password: "StudentPass2",
    role: "Student",
    status: "Approved",
    createdDate: "Mar 16, 2024"
  },
  {
    fullName: "Anna Reyes",
    idNumber: "2024-10003",
    email: "anna.reyes@school.edu",
    password: "StudentPass3",
    role: "Student",
    status: "Rejected",
    createdDate: "Mar 18, 2024"
  },
  {
    fullName: "Teacher Ronaldo",
    idNumber: "TEACH-01",
    email: "ronaldo@school.edu",
    password: "TeacherPass1",
    role: "Teacher",
    status: "Approved",
    createdDate: "Feb 08, 2024"
  },
  {
    fullName: "Teacher Miriam",
    idNumber: "TEACH-02",
    email: "miriam@school.edu",
    password: "TeacherPass2",
    role: "Teacher",
    status: "Approved",
    createdDate: "Mar 01, 2024"
  },
  {
    fullName: "Principal Cruz",
    idNumber: "ADMIN-01",
    email: "principal@school.edu",
    password: "AdminPass1",
    role: "Admin",
    status: "Approved",
    createdDate: "Dec 01, 2023"
  }
];

function getStoredUsers() {
  // Disabled: Use real Supabase authentication instead
  return [];
}

function saveUsers(users) {
  // Disabled: Use real Supabase authentication instead
  console.log("localStorage auth disabled - using Supabase instead");
}

function ensureSampleUsers() {
  // Disabled: Use real Supabase authentication instead
  return [];
}

/** Fallback if /admin/stats is unavailable. */
function getAdminDashboardStatsFromUsers(users) {
  const role = (u) => String(u.role || "").trim().toLowerCase();
  const totalStudents = users.filter((u) => role(u) === "student").length;
  const totalTeachers = users.filter((u) => role(u) === "teacher").length;
  return { totalStudents, totalTeachers };
}

/** Bearer header for the current session — despite the name, used for any
 * endpoint that needs to identify the caller (admin-only checks via
 * _resolve_admin_id, or "is this student/teacher looking at their own data"
 * checks via _can_view_student_data / _can_view_teacher_data). */
function adminAuthHeaders() {
  const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  return u && u.access_token ? { Authorization: `Bearer ${u.access_token}` } : {};
}

async function renderMetrics() {
  const empty = {
    totalStudents: 0,
    totalTeachers: 0,
    uploadedFilesCount: 0,
    activeUsersToday: 0,
  };
  try {
    const statsRes = await fetch(apiUrl("/admin/stats"), { headers: adminAuthHeaders() });
    if (statsRes.ok) {
      const d = await statsRes.json().catch(() => ({}));
      if (d && d.error) throw new Error(typeof d.error === "string" ? d.error : "Admin stats error");
      updateMetricsDisplay({
        totalStudents: d.total_students ?? 0,
        totalTeachers: d.total_teachers ?? 0,
        uploadedFilesCount: d.uploaded_files ?? 0,
        activeUsersToday: d.active_users_today ?? 0,
      });
      return;
    }

    const [usersRes, lessonsRes] = await Promise.all([
      fetch(apiUrl("/users"), { headers: adminAuthHeaders() }),
      fetch(apiUrl("/lessons")),
    ]);
    let uploadedFilesCount = 0;
    if (lessonsRes.ok) {
      const lessonData = await lessonsRes.json();
      uploadedFilesCount =
        typeof lessonData.count === "number" ? lessonData.count : (lessonData.lessons || []).length;
    }
    if (!usersRes.ok) {
      updateMetricsDisplay({ ...empty, uploadedFilesCount });
      return;
    }
    const users = await usersRes.json();
    const stats = getAdminDashboardStatsFromUsers(users);
    updateMetricsDisplay({ ...stats, uploadedFilesCount, activeUsersToday: 0 });
  } catch (error) {
    console.error("Failed to fetch admin metrics:", error);
    updateMetricsDisplay(empty);
  }
}

function setMetricText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function updateMetricsDisplay(stats) {
  setMetricText("metric-total-students", stats.totalStudents);
  setMetricText("metric-total-teachers", stats.totalTeachers);
  setMetricText("metric-uploaded-files", stats.uploadedFilesCount ?? 0);
  setMetricText("metric-active-users", stats.activeUsersToday ?? 0);

  const denom = Math.max(1, (stats.totalStudents || 0) + (stats.totalTeachers || 0));
  const chartStudents = document.getElementById("chart-students");
  const chartTeachers = document.getElementById("chart-teachers");
  if (chartStudents) {
    chartStudents.dataset.progress = `${Math.min(100, Math.round(((stats.totalStudents || 0) / denom) * 100))}%`;
  }
  if (chartTeachers) {
    chartTeachers.dataset.progress = `${Math.min(100, Math.round(((stats.totalTeachers || 0) / denom) * 100))}%`;
  }
  if (chartStudents || chartTeachers) {
    animateProgressBars();
  }
}

function formatAdminActivityTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return d.toISOString().slice(0, 16);
  }
}

async function refreshAdminRecentActivity() {
  const list = document.getElementById("recent-activity-list");
  if (!list) return;
  list.innerHTML = '<li><span class="small-note">Loading…</span></li>';
  try {
    const res = await fetch(apiUrl("/admin/recent-activity"), { headers: adminAuthHeaders() });
    if (!res.ok) throw new Error("activity");
    const data = await res.json().catch(() => ({}));
    if (data.error) {
      throw new Error(typeof data.error === "string" ? data.error : "activity");
    }
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      list.innerHTML =
        '<li><span class="small-note">No recent activity yet. Registrations, lesson uploads, and quiz attempts will appear here.</span></li>';
      return;
    }
    list.innerHTML = items
      .map(
        (item) => `
        <li>
          <strong>${escapeHtml(item.title || "—")}</strong>
          <small>${escapeHtml(item.detail || "")}</small>
          <span class="metric-note">${escapeHtml(formatAdminActivityTime(item.timestamp))}</span>
        </li>
      `
      )
      .join("");
  } catch (e) {
    console.error("refreshAdminRecentActivity:", e);
    list.innerHTML =
      '<li><span class="small-note">Could not load activity. Check that you are signed in and the API is running.</span></li>';
  }
}

function renderRecentActivity() {
  void refreshAdminRecentActivity();
}

function exportReports() {
  showToast("Admin reports exported successfully.", "info");
}

function uploadDashboardFile(file) {
  if (!file) return;
  void refreshAdminRecentActivity();
  showToast(`Uploaded ${file.name}`, "success");
}

function setupDashboardActions() {
  document.getElementById("export-reports-btn")?.addEventListener("click", exportReports);
  document.getElementById("view-students-btn")?.addEventListener("click", () => {
    document.getElementById("admin-table")?.scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("upload-file-btn")?.addEventListener("click", () => {
    document.getElementById("dashboard-upload-input")?.click();
  });
  document.getElementById("sidebar-logout")?.addEventListener("click", logoutAdmin);
  document.getElementById("refresh-dashboard")?.addEventListener("click", async () => {
    await renderMetrics();
    await refreshAdminRecentActivity();
    showToast("Dashboard refreshed.", "success");
  });
  document.getElementById("dashboard-upload-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    uploadDashboardFile(file);
    event.target.value = "";
  });
}

function renderSystemStatus() {
  const grid = document.querySelector(".wide-status-grid");
  if (!grid) return;
  void (async () => {
    const badges = grid.querySelectorAll(".status-card .status-badge");
    const setBadge = (i, text, online) => {
      const b = badges[i];
      if (!b) return;
      b.textContent = text;
      b.classList.remove("online", "warning");
      b.classList.add(online ? "online" : "warning");
    };
    try {
      const res = await fetch(apiUrl("/health"));
      const h = await res.json().catch(() => ({}));
      setBadge(0, h.has_api_key ? "Ready" : "API key unset", Boolean(h.has_api_key));
      setBadge(1, h.has_supabase ? "Connected" : "Not configured", Boolean(h.has_supabase));
      setBadge(2, "Not tracked", false);
      setBadge(3, h.ok ? "Healthy" : "Check server", Boolean(h.ok));
    } catch {
      setBadge(0, "Unknown", false);
      setBadge(1, "Unknown", false);
      setBadge(2, "Not tracked", false);
      setBadge(3, "Unknown", false);
    }
  })();
}

function showAuthMessage(message, element, type = "info") {
  if (!element) return;
  element.style.display = "block";
  element.textContent = message;
  element.style.background =
    type === "success"
      ? "rgba(34, 197, 94, 0.12)"
      : type === "error"
      ? "rgba(239, 68, 68, 0.12)"
      : "rgba(96, 165, 250, 0.08)";
  element.style.border =
    type === "success"
      ? "1px solid rgba(34, 197, 94, 0.2)"
      : type === "error"
      ? "1px solid rgba(239, 68, 68, 0.2)"
      : "1px solid rgba(96, 165, 250, 0.18)";
}

function setupForms() {
  document.querySelectorAll(".demo-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      showToast("Demo UI ready for backend authentication.", "success");
    });
  });
}

function setSignupFieldRequired(el, required) {
  if (!el) return;
  if (required) el.setAttribute("required", "");
  else el.removeAttribute("required");
}

function applySignupRoleUi(role) {
  const isStudent = role !== "teacher";
  const signupHeading = document.getElementById("signup-heading");
  const idLabel = document.getElementById("id-label");
  const studentShsFields = document.getElementById("signup-student-shs-fields");
  const lastNameEl = document.getElementById("signup-last-name");
  const firstNameEl = document.getElementById("signup-first-name");
  const middleNameEl = document.getElementById("signup-middle-name");
  const gradeLevelEl = document.getElementById("signup-grade-level");
  const strandEl = document.getElementById("signup-strand");

  if (signupHeading) {
    signupHeading.textContent = isStudent ? "Student registration" : "Teacher registration";
  }
  if (idLabel) {
    idLabel.textContent = isStudent ? "Learner Reference Number (LRN)" : "Teacher ID / Employee ID";
  }
  if (studentShsFields) studentShsFields.hidden = !isStudent;

  setSignupFieldRequired(lastNameEl, true);
  setSignupFieldRequired(firstNameEl, true);
  setSignupFieldRequired(gradeLevelEl, isStudent);
  setSignupFieldRequired(strandEl, isStudent);
  if (middleNameEl) middleNameEl.removeAttribute("required");
}

function setupRoleSelection() {
  const roleCards = document.querySelectorAll(".role-card");
  const selected = document.querySelector(".role-card.selected") || roleCards[0];
  if (selected && !selected.classList.contains("selected")) {
    selected.classList.add("selected");
  }
  applySignupRoleUi(selected?.dataset?.role || "student");

  roleCards.forEach((card) => {
    card.addEventListener("click", () => {
      roleCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      applySignupRoleUi(card.dataset.role || "student");
    });
  });
}

function registrationSuccessMessage(result, wasAutoGenerated) {
  const base = (result && result.message) || "Account created.";
  if (!wasAutoGenerated) return base;
  if (result && result.credentials_emailed) {
    const to = (result.email || "their email").trim();
    return `${base} Check ${to} for LRN/email and password.`;
  }
  // Backend already appends credentials_email_error to message when email fails.
  return base;
}

function setupAdminTeacherRegistrationPage() {
  ensureAdminSidebarNav();
  const form = document.getElementById("admin-teacher-reg-form");
  const messageEl = document.getElementById("atr-message");
  if (!form) return;

  const user = getCurrentUserSession();
  const role = user && user.role ? String(user.role).trim().toLowerCase() : "";
  if (!user?.access_token) {
    window.location.href = "login.html";
    return;
  }
  if (role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!messageEl) return;

    const idNumber = document.getElementById("atr-id")?.value.trim() || "";
    const email = (document.getElementById("atr-email")?.value || "").trim().toLowerCase();
    const passwordRaw = document.getElementById("atr-password")?.value || "";
    const wasAutoPassword = !passwordRaw.trim();
    const lastName = (document.getElementById("atr-last-name")?.value || "").trim();
    const firstName = (document.getElementById("atr-first-name")?.value || "").trim();
    const middleName = (document.getElementById("atr-middle-name")?.value || "").trim();
    const nameSuffix = (document.getElementById("atr-name-suffix")?.value || "").trim();

    if (!idNumber || !email) {
      showAuthMessage("All required fields must be filled in.", messageEl, "error");
      return;
    }
    if (!lastName || !firstName) {
      showAuthMessage("Last name and first name are required.", messageEl, "error");
      return;
    }

    const payload = {
      id_number: idNumber,
      email,
      password: passwordRaw.trim(),
      auto_generate_password: wasAutoPassword,
      role: "teacher",
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      name_suffix: nameSuffix,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loader"></span> Submitting…';
    }

    try {
      const response = await fetch(apiUrl("/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Registration failed");
      }
      const result = await response.json();
      form.reset();
      showAuthMessage(registrationSuccessMessage(result, wasAutoPassword), messageEl, "success");
      showToast("Teacher registration submitted.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", messageEl, "error");
      showToast(`Registration failed: ${error.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}

async function refreshAdminRegSectionOptions() {
  const gradeLevel = (document.getElementById("asr-grade-level")?.value || "").trim();
  const strand = (document.getElementById("asr-strand")?.value || "").trim();
  const sel = document.getElementById("asr-section");
  if (!sel) return;
  if (!gradeLevel || !strand) {
    sel.innerHTML = `<option value="">Select year level and strand first</option>`;
    return;
  }
  sel.innerHTML = `<option value="">Loading…</option>`;
  try {
    const res = await fetch(
      apiUrl(`/sections?grade_level=${encodeURIComponent(gradeLevel)}&strand=${encodeURIComponent(strand)}`)
    );
    const data = await res.json().catch(() => ({}));
    const sections = Array.isArray(data.sections) ? data.sections : [];
    if (!sections.length) {
      sel.innerHTML = `<option value="">No sections yet — add one in Admin Settings</option>`;
      return;
    }
    sel.innerHTML =
      `<option value="">Select section (optional)</option>` +
      sections.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join("");
  } catch {
    sel.innerHTML = `<option value="">Could not load sections</option>`;
  }
}

function setupAdminStudentRegistrationPage() {
  ensureAdminSidebarNav();
  const form = document.getElementById("admin-student-reg-form");
  const messageEl = document.getElementById("asr-message");
  if (!form) return;

  const user = getCurrentUserSession();
  const role = user && user.role ? String(user.role).trim().toLowerCase() : "";
  if (!user?.access_token) {
    window.location.href = "login.html";
    return;
  }
  if (role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("asr-grade-level")?.addEventListener("change", refreshAdminRegSectionOptions);
  document.getElementById("asr-strand")?.addEventListener("change", refreshAdminRegSectionOptions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!messageEl) return;

    const idNumber = document.getElementById("asr-id")?.value.trim() || "";
    const email = (document.getElementById("asr-email")?.value || "").trim().toLowerCase();
    const passwordRaw = document.getElementById("asr-password")?.value || "";
    const wasAutoPassword = !passwordRaw.trim();
    const lastName = (document.getElementById("asr-last-name")?.value || "").trim();
    const firstName = (document.getElementById("asr-first-name")?.value || "").trim();
    const middleName = (document.getElementById("asr-middle-name")?.value || "").trim();
    const nameSuffix = (document.getElementById("asr-name-suffix")?.value || "").trim();
    const gradeLevel = (document.getElementById("asr-grade-level")?.value || "").trim();
    const strand = (document.getElementById("asr-strand")?.value || "").trim();
    const section = (document.getElementById("asr-section")?.value || "").trim();

    if (!idNumber || !email) {
      showAuthMessage("All required fields must be filled in.", messageEl, "error");
      return;
    }
    if (!lastName || !firstName) {
      showAuthMessage("Last name and first name are required.", messageEl, "error");
      return;
    }
    if (!gradeLevel || !strand) {
      showAuthMessage("Year level and strand are required.", messageEl, "error");
      return;
    }

    const payload = {
      id_number: idNumber,
      email,
      password: passwordRaw.trim(),
      auto_generate_password: wasAutoPassword,
      role: "student",
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      name_suffix: nameSuffix,
      grade_level: gradeLevel,
      strand,
      section,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loader"></span> Submitting…';
    }

    try {
      const response = await fetch(apiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Registration failed");
      }
      const result = await response.json();
      form.reset();
      showAuthMessage(registrationSuccessMessage(result, wasAutoPassword), messageEl, "success");
      showToast("Student registration submitted.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", messageEl, "error");
      showToast(`Registration failed: ${error.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}

function setupTeacherStudentRegistrationPage() {
  ensureTeacherSidebarNav();
  const form = document.getElementById("teacher-student-reg-form");
  const messageEl = document.getElementById("tsr-message");
  if (!form) return;

  const user = getCurrentUserSession();
  const role = user && user.role ? String(user.role).trim().toLowerCase() : "";
  if (!user?.access_token) {
    window.location.href = "login.html";
    return;
  }
  if (role !== "teacher" && role !== "admin") {
    window.location.href = role === "student" ? "learniq-dashboard.html" : "login.html";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!messageEl) return;

    const idNumber = document.getElementById("tsr-id")?.value.trim() || "";
    const email = (document.getElementById("tsr-email")?.value || "").trim().toLowerCase();
    const passwordRaw = document.getElementById("tsr-password")?.value || "";
    const wasAutoPassword = !passwordRaw.trim();
    const lastName = (document.getElementById("tsr-last-name")?.value || "").trim();
    const firstName = (document.getElementById("tsr-first-name")?.value || "").trim();
    const middleName = (document.getElementById("tsr-middle-name")?.value || "").trim();
    const nameSuffix = (document.getElementById("tsr-name-suffix")?.value || "").trim();
    const gradeLevel = (document.getElementById("tsr-grade-level")?.value || "").trim();
    const strand = (document.getElementById("tsr-strand")?.value || "").trim();

    if (!idNumber || !email) {
      showAuthMessage("All required fields must be filled in.", messageEl, "error");
      return;
    }
    if (!lastName || !firstName) {
      showAuthMessage("Last name and first name are required.", messageEl, "error");
      return;
    }
    if (!gradeLevel || !strand) {
      showAuthMessage("Year level and strand are required.", messageEl, "error");
      return;
    }

    const payload = {
      id_number: idNumber,
      email,
      password: passwordRaw.trim(),
      auto_generate_password: wasAutoPassword,
      role: "student",
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      name_suffix: nameSuffix,
      grade_level: gradeLevel,
      strand,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loader"></span> Submitting…';
    }

    try {
      const response = await fetch(apiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Registration failed");
      }
      const result = await response.json();
      form.reset();
      showAuthMessage(registrationSuccessMessage(result, wasAutoPassword), messageEl, "success");
      showToast("Student registration submitted.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", messageEl, "error");
      showToast(`Registration failed: ${error.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}

function setupSignupPage() {
  const signupForm = document.querySelector("#signup-form");
  const signupMessage = document.querySelector("#signup-message");
  if (!signupForm) return;

  const roleSelector = document.querySelector(".role-selector");
  if (roleSelector && roleSelector.hidden) {
    applySignupRoleUi("teacher");
  } else {
    setupRoleSelection();
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signupMessage) return;

    const idNumber = document.querySelector("#signup-id").value.trim();
    const email = document.querySelector("#signup-email").value.trim().toLowerCase();
    const password = document.querySelector("#signup-password").value;
    const confirmPassword = document.querySelector("#signup-confirm").value;
    const lastName = (document.querySelector("#signup-last-name")?.value || "").trim();
    const firstName = (document.querySelector("#signup-first-name")?.value || "").trim();
    const middleName = (document.querySelector("#signup-middle-name")?.value || "").trim();
    const nameSuffix = (document.querySelector("#signup-name-suffix")?.value || "").trim();
    const gradeLevel = (document.querySelector("#signup-grade-level")?.value || "").trim();
    const strand = (document.querySelector("#signup-strand")?.value || "").trim();

    const selectedRole = document.querySelector(".role-card.selected");
    const role = selectedRole?.dataset?.role || "teacher";
    if (!selectedRole && document.querySelector(".role-selector:not([hidden])")) {
      showAuthMessage("Please select an account type.", signupMessage, "error");
      return;
    }
    const isStudent = role === "student";

    if (!idNumber || !email || !password || !confirmPassword) {
      showAuthMessage("All required fields must be filled in.", signupMessage, "error");
      return;
    }

    if (!lastName || !firstName) {
      showAuthMessage("Last name and first name are required.", signupMessage, "error");
      return;
    }

    if (isStudent && (!gradeLevel || !strand)) {
      showAuthMessage("Year level and strand are required.", signupMessage, "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Confirm password must match.", signupMessage, "error");
      return;
    }

    const payload = {
      id_number: idNumber,
      email,
      password,
      role,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      name_suffix: nameSuffix,
    };
    if (isStudent) {
      payload.grade_level = gradeLevel;
      payload.strand = strand;
    }

    try {
      const response = await fetch(apiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Registration failed");
      }

      const result = await response.json();
      signupForm.reset();
      showAuthMessage(result.message || "Account created. You can sign in after confirming your email.", signupMessage, "success");
      showToast(
        isStudent ? "Student registration submitted for review." : "Teacher registration submitted for review.",
        "success"
      );
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", signupMessage, "error");
      showToast(`Registration failed: ${error.message}`, "error");
    }
  });
}

function buildLoginPayload(identifierRaw, password) {
  const identifier = (identifierRaw || "").trim();
  const payload = { password, identifier };
  if (identifier.includes("@")) {
    payload.login_method = "email";
    payload.email = identifier.toLowerCase();
  } else {
    payload.login_method = "lrn";
    payload.lrn = identifier;
    payload.id_number = identifier;
  }
  return payload;
}

function setupLoginPage() {
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier =
      document.getElementById("login-email")?.value ||
      document.getElementById("login-identifier")?.value ||
      "";
    const password = document.getElementById("login-password")?.value || "";
    const endpointUrl = apiUrl("/login");
    const payload = buildLoginPayload(identifier, password);

    if (!identifier.trim() || !password) {
      const errorMsg = "LRN or email and password are required.";
      if (loginMessage) {
        showAuthMessage(errorMsg, loginMessage, "error");
      } else {
        alert(errorMsg);
      }
      return;
    }

    try {
      // Call backend login endpoint (now uses Supabase Auth)
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error || error.message || "Login failed";
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("LOGIN RESPONSE:", result);
      const user = result.user;
      
      if (!user) {
        throw new Error("Invalid response format: missing user data");
      }
      
      const successMessage =
        user.role === "admin"
          ? "Welcome Admin. Redirecting to approval dashboard..."
          : user.role === "teacher"
          ? "Welcome Teacher. Redirecting to teacher dashboard..."
          : "Login successful. Redirecting to student dashboard...";
      
      console.log("SAVING SESSION:", user);
      setCurrentUserSession(user);
      console.log("SESSION CHECK AFTER SAVE:", sessionStorage.getItem(authSessionKey));
      showAuthMessage(successMessage, loginMessage, "success");
      showToast(successMessage, "success");
      
      setTimeout(() => {
        console.log("REDIRECT BLOCK REACHED");
        console.log("USER ROLE:", user.role);
        try {
          if (window.LearnIQTheme && typeof window.LearnIQTheme.set === "function") {
            const themeFromDom =
              document.documentElement.getAttribute("data-theme") === "dark"
                ? "dark"
                : "light";
            window.LearnIQTheme.set(themeFromDom);
          }
        } catch (_) {
          /* keep redirect even if theme sync fails */
        }
        if (user.role === "admin") {
          window.location.href = "admin-approval.html";
        } else if (user.role === "teacher") {
          window.location.href = "teacher-learniq-dashboard.html";
        } else if (user.role === "student") {
          window.location.href = "module-selection.html";
        } else {
          window.location.href = "login.html";
        }
      }, 1000);
    } catch (error) {
      const errorMsg = error.message || "Login failed. Please try again.";
      if (loginMessage) {
        showAuthMessage(errorMsg, loginMessage, "error");
      } else {
        alert(errorMsg);
      }
      showToast(`Login failed: ${errorMsg}`, "error");
    }
  });
}

function setupForgotPasswordPage() {
  const forgotForm = document.querySelector("#forgot-password-form");
  const forgotMessage = document.querySelector("#forgot-message");
  if (!forgotForm) return;

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!forgotMessage) return;

    const email = document.querySelector("#forgot-email").value.trim().toLowerCase();

    if (!email) {
      showAuthMessage("Email is required.", forgotMessage, "error");
      return;
    }

    try {
      // Call backend forgot password endpoint
      const response = await fetch(apiUrl("/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Password reset request failed");
      }

      const result = await response.json();
      forgotForm.reset();
      showAuthMessage(result.message, forgotMessage, "success");
      showToast("Password reset instructions sent to your email.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Password reset failed. Please try again.", forgotMessage, "error");
      showToast(`Password reset failed: ${error.message}`, "error");
    }
  });
}

function setupResetPasswordPage() {
  const form = document.querySelector("#reset-password-form");
  const message = document.querySelector("#reset-password-message");
  const fieldError = document.querySelector("#reset-password-field-error");
  const subtitle = document.querySelector("#reset-password-subtitle");
  const submitBtn = document.querySelector("#reset-password-submit-btn");
  if (!form) return;

  // Supabase sends the recovery token as a hash fragment (implicit flow)
  // or as a ?code= query param (PKCE flow) — support both.
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const code = queryParams.get("code");
  const hasRecoveryLink = (accessToken && refreshToken) || !!code;

  if (!hasRecoveryLink) {
    if (subtitle) subtitle.textContent = "This reset link is invalid or has expired.";
    form.style.display = "none";
    showAuthMessage(
      "This reset link is invalid or has expired. Request a new one from the forgot password page.",
      message,
      "error"
    );
    return;
  }

  // Scrub the token out of the visible URL/history once read.
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch (e) {
    /* ignore */
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!message) return;

    const newPassword = document.querySelector("#reset-new-password").value;
    const confirmPassword = document.querySelector("#reset-confirm-password").value;
    if (fieldError) fieldError.style.display = "none";

    if (newPassword.length < 8) {
      showAuthMessage("Password must be at least 8 characters.", fieldError || message, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAuthMessage("Passwords don't match.", fieldError || message, "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Updating…";
    }

    try {
      const response = await fetch(apiUrl("/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          code: code,
          new_password: newPassword
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Could not reset password.");
      }

      form.reset();
      form.style.display = "none";
      showAuthMessage(result.message || "Password updated. Redirecting to login…", message, "success");
      showToast("Password updated successfully.", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1800);
    } catch (error) {
      showAuthMessage(error.message || "Could not reset password. Please try again.", message, "error");
      showToast(`Reset failed: ${error.message}`, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Update Password";
      }
    }
  });
}

function togglePassword(inputId, button) {
  const passwordInput = document.getElementById(inputId);
  const icon = button.querySelector('i');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function formatStatusBadge(status) {
  const cls = status === "Approved" ? "online" : status === "Rejected" ? "warning" : "";
  return `<span class="status-badge ${cls}">${escapeHtml(status)}</span>`;
}

async function renderAdminTable(filter = "") {
  const tableBody = document.querySelector("#admin-table-body");
  if (!tableBody) return;

  try {
    const response = await fetch(apiUrl("/users"), { headers: adminAuthHeaders() });
    if (!response.ok) {
      tableBody.innerHTML = `<tr><td colspan="5">Failed to load users from server.</td></tr>`;
      return;
    }
    
    const users = await response.json();
    const filterValue = filter.trim().toLowerCase();

    const rows = users
      .filter((user) =>
        !filterValue ||
        (getProfileDisplayName(user).toLowerCase().includes(filterValue)) ||
        (user.id_number && user.id_number.toLowerCase().includes(filterValue))
      )
      .map(
        (user) => `
          <tr>
            <td>${escapeHtml(getProfileDisplayName(user) || "N/A")}</td>
            <td>${escapeHtml(user.id_number || "N/A")}</td>
            <td>${escapeHtml(user.email || "N/A")}</td>
            <td>${escapeHtml(user.role || "N/A")}</td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
          </tr>
        `
      );

    tableBody.innerHTML = rows.join("") || `<tr><td colspan="5">No matching users found.</td></tr>`;
  } catch (error) {
    console.error("Failed to render admin table:", error);
    tableBody.innerHTML = `<tr><td colspan="5">Error loading user data.</td></tr>`;
  }
}

/** Clear session and go to login. Optional confirm body copy (student / teacher / admin). */
function confirmAndLogout(confirmMessage) {
  const message =
    confirmMessage ||
    "Are you sure you want to log out? You will need to sign in again to continue.";
  const proceed = function () {
    sessionStorage.clear();
    showToast("Logged out successfully.", "info");
    setTimeout(function () {
      window.location.href = "login.html";
    }, 350);
  };

  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    window.LearnIQConfirm.show({
      title: "Log out?",
      message,
      confirmText: "Log out",
      cancelText: "Cancel",
    }).then(function (ok) {
      if (ok) proceed();
    });
    return;
  }

  if (confirm(message)) proceed();
}

function logoutAdmin() {
  confirmAndLogout(
    "Are you sure you want to log out? You will need to sign in again to access the admin panel."
  );
}

function setupAdminNavigation() {
  // Handle hash-based navigation
  const sections = {
    '': 'dashboard',
    'approvals': 'approvals',
    'users': 'users', 
    'ai-results': 'ai-results',
    'files': 'files',
    'leaderboard': 'leaderboard',
    'attendance': 'attendance',
    'journals': 'journals',
    'reports': 'reports',
    'settings': 'settings'
  };

  function showSection(sectionId) {
    // Hide all sections
    Object.keys(sections).forEach(hash => {
      const section = document.getElementById(hash || 'dashboard');
      if (section) section.style.display = 'none';
    });

    // Show selected section or default dashboard
    const targetSection = document.getElementById(sectionId === 'dashboard' ? '' : sectionId) || 
                         document.querySelector('.dashboard-grid') ||
                         document.querySelector('section[class*="glass-card"]');
    
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    // Update active sidebar link
    document.querySelectorAll('.side-links a').forEach(link => {
      link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.side-links a[href*="${sectionId}"]`) ||
                      document.querySelector('.side-links a[href="admin-approval.html"]');
    if (activeLink) activeLink.classList.add('active');

    // Load section-specific data
    loadSectionData(sectionId);
  }

  function loadSectionData(sectionId) {
    switch(sectionId) {
      case 'approvals':
        loadPendingApprovals();
        break;
      case 'users':
        loadAllUsers();
        break;
      case 'ai-results':
        loadAIResults();
        break;
      case 'files':
        loadUploadedFiles();
        break;
      case 'leaderboard':
        loadLeaderboard();
        break;
      case 'attendance':
        loadAttendanceLogs();
        break;
      case 'journals':
        loadJournals();
        break;
      case 'reports':
        loadReports();
        break;
      case 'settings':
        loadSettings();
        break;
    }
  }

  // Handle initial hash
  const hash = window.location.hash.slice(1);
  showSection(hash || 'dashboard');

  // Handle hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    showSection(hash || 'dashboard');
  });

  // Handle sidebar clicks
  document.querySelectorAll('.side-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      // Phase 1 migration: allow real page navigation for separated admin pages.
      // Keep hash-switching only for in-dashboard sections.
      if (href && !href.includes('#') && href !== 'admin-approval.html') {
        return; // allow normal navigation
      }
      e.preventDefault();
      const hash = href.includes('#') ? href.split('#')[1] : '';
      window.location.hash = hash;
      showSection(hash || 'dashboard');
    });
  });
}

/** All students list (admin Students page). */
async function loadPendingApprovals() {
  const tableBody = document.querySelector("#approval-table-body");
  if (!tableBody) return;

  const searchEl = document.querySelector("#approval-search");
  const q = (searchEl?.value || "").trim().toLowerCase();

  try {
    const response = await fetch(apiUrl("/users"), { headers: adminAuthHeaders() });
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="4">Failed to load students.</td></tr>';
      return;
    }

    const users = await response.json();
    let students = users.filter((u) => String(u.role || "").toLowerCase() === "student");

    if (q) {
      students = students.filter((u) => {
        const blob = `${getProfileDisplayName(u)} ${u.id_number || ""} ${u.email || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }

    const rows = students
      .map((user) => {
        const idNum = String(user.id_number || "").trim();
        const encId = encodeURIComponent(idNum);
        const nameCell = idNum
          ? `<span class="profile-row-name">${escapeHtml(getProfileDisplayName(user) || "N/A")}</span>`
          : escapeHtml(getProfileDisplayName(user) || "N/A");
        const rowAttrs = idNum
          ? ` class="profile-row" data-profile-id="${encId}" tabindex="0" role="button" aria-label="View profile of ${escapeHtml(
              getProfileDisplayName(user) || "user"
            )}"`
          : "";
        return `
      <tr${rowAttrs}>
        <td>${nameCell}</td>
        <td>${escapeHtml(user.id_number || "N/A")}</td>
        <td>${escapeHtml(user.email || "N/A")}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
      </tr>`;
      })
      .join("");

    tableBody.innerHTML = rows || `<tr><td colspan="4">No student profiles in the database.</td></tr>`;
  } catch (error) {
    console.error("Failed to load students:", error);
    tableBody.innerHTML = '<tr><td colspan="4">Error loading data.</td></tr>';
  }
}

/** All teachers list (admin Teachers page). */
async function loadTeacherApprovals() {
  const tableBody = document.querySelector("#teacher-approval-table-body");
  if (!tableBody) return;

  const searchEl = document.querySelector("#teacher-approval-search");
  const q = (searchEl?.value || "").trim().toLowerCase();

  try {
    const response = await fetch(apiUrl("/users"), { headers: adminAuthHeaders() });
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="4">Failed to load teachers.</td></tr>';
      return;
    }

    const users = await response.json();
    let teachers = users.filter((u) => String(u.role || "").toLowerCase() === "teacher");

    if (q) {
      teachers = teachers.filter((u) => {
        const blob = `${getProfileDisplayName(u)} ${u.id_number || ""} ${u.email || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }

    const rows = teachers
      .map((user) => {
        const idNum = String(user.id_number || "").trim();
        const encId = encodeURIComponent(idNum);
        const nameCell = idNum
          ? `<span class="profile-row-name">${escapeHtml(getProfileDisplayName(user) || "N/A")}</span>`
          : escapeHtml(getProfileDisplayName(user) || "N/A");
        const rowAttrs = idNum
          ? ` class="profile-row" data-profile-id="${encId}" tabindex="0" role="button" aria-label="View profile of ${escapeHtml(
              getProfileDisplayName(user) || "user"
            )}"`
          : "";
        return `
      <tr${rowAttrs}>
        <td>${nameCell}</td>
        <td>${escapeHtml(user.id_number || "N/A")}</td>
        <td>${escapeHtml(user.email || "N/A")}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
      </tr>`;
      })
      .join("");

    tableBody.innerHTML = rows || `<tr><td colspan="4">No teacher profiles in the database.</td></tr>`;
  } catch (error) {
    console.error("Failed to load teachers:", error);
    tableBody.innerHTML = '<tr><td colspan="4">Error loading data.</td></tr>';
  }
}

/** Which profile preview modal exists on the current page (teacher vs student approvals). */
function getAdminProfilePreviewModalEls() {
  const teacherBackdrop = document.getElementById("teacher-profile-modal");
  if (teacherBackdrop) {
    return {
      backdrop: teacherBackdrop,
      body: document.getElementById("teacher-profile-modal-body"),
      title: document.getElementById("teacher-profile-modal-title"),
    };
  }
  const studentBackdrop = document.getElementById("student-profile-modal");
  return {
    backdrop: studentBackdrop,
    body: document.getElementById("student-profile-modal-body"),
    title: document.getElementById("student-profile-modal-title"),
  };
}

function closeAdminProfilePreviewModal() {
  const t = document.getElementById("teacher-profile-modal");
  const s = document.getElementById("student-profile-modal");
  if (t) t.hidden = true;
  if (s) s.hidden = true;
  document.removeEventListener("keydown", adminProfilePreviewModalOnKey);
}

function adminProfilePreviewModalOnKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeAdminProfilePreviewModal();
  }
}

function formatTeacherProfileModalRow(label, valueHtml) {
  return `<dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd>`;
}

function _profileInitials(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function _formatProfileDate(value, withTime = true) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return withTime ? d.toLocaleString() : d.toLocaleDateString();
  } catch {
    return String(value);
  }
}

/** Loads `GET /admin/profile/{id_number}` into the approvals profile modal on this page. */
async function openAdminProfilePreviewModal(idNumber, titleText) {
  const { backdrop, body, title } = getAdminProfilePreviewModalEls();
  if (!backdrop || !body) return;

  const id = String(idNumber || "").trim();
  if (!id) return;

  if (title && titleText) title.textContent = titleText;

  backdrop.hidden = false;
  body.innerHTML = '<p class="small-note" style="margin:0;">Loading profile…</p>';
  document.removeEventListener("keydown", adminProfilePreviewModalOnKey);
  document.addEventListener("keydown", adminProfilePreviewModalOnKey);

  try {
    const res = await fetch(apiUrl(`/admin/profile/${encodeURIComponent(id)}`), { headers: adminAuthHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data.error === "string" ? data.error : res.statusText || "Request failed";
      body.innerHTML = `<p class="small-note" style="margin:0;color:#fb923c;">${escapeHtml(msg)}</p>`;
      return;
    }
    const p = data;
    const fullName = getProfileDisplayName(p) || "Unnamed user";
    const role = String(p.role || "").trim();
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "—";
    const initials = _profileInitials(fullName);
    const avatarUrl = String(
      p.avatar_data || p.avatar_url || p.profile_picture || p.photo_url || ""
    ).trim();
    const avatarHtml = avatarUrl
      ? `<img src="${escapeHtml(avatarUrl)}" alt="Profile picture" />`
      : `<span>${escapeHtml(initials)}</span>`;

    const coreRows = [
      ["LRN", escapeHtml(p.lrn || p.id_number || "—")],
      ["Email", escapeHtml(p.email || "—")],
      ["Role", escapeHtml(roleLabel)],
      ["Created", escapeHtml(_formatProfileDate(p.created_at, true))],
      ["Profile UUID", `<code class="profile-uuid">${escapeHtml(p.id ? String(p.id) : "—")}</code>`],
    ];

    // Optional extended fields (only show if present in the profile row)
    const extraFieldMap = [
      ["First name", "first_name"],
      ["Middle name", "middle_name"],
      ["Last name", "last_name"],
      ["Phone", "phone"],
      ["Contact number", "contact_number"],
      ["Address", "address"],
      ["Gender", "gender"],
      ["Date of birth", "dob", { date: true }],
      ["Date of birth", "birthdate", { date: true }],
      ["Date of birth", "date_of_birth", { date: true }],
      ["About", "bio"],
      ["Adviser ID", "adviser_id_number"],
      ["Department", "department"],
      ["Grade level", "grade_level"],
      ["Section", "section"],
      ["Track", "track"],
      ["Strand", "strand"],
      ["School", "school"],
      ["Updated", "updated_at", { dateTime: true }],
    ];
    const seenKeys = new Set();
    const extraRows = [];
    for (const [label, key, opts] of extraFieldMap) {
      if (seenKeys.has(key)) continue;
      const raw = p[key];
      if (raw == null || String(raw).trim() === "") continue;
      seenKeys.add(key);
      let valueHtml;
      if (opts?.date) valueHtml = escapeHtml(_formatProfileDate(raw, false));
      else if (opts?.dateTime) valueHtml = escapeHtml(_formatProfileDate(raw, true));
      else valueHtml = escapeHtml(String(raw));
      extraRows.push([label, valueHtml]);
    }

    const allRows = [...coreRows, ...extraRows];
    const dlHtml = allRows.map(([label, html]) => formatTeacherProfileModalRow(label, html)).join("");

    body.innerHTML = `
      <div class="profile-preview-head">
        <div class="profile-preview-avatar">${avatarHtml}</div>
        <div class="profile-preview-headline">
          <h4 class="profile-preview-name">${escapeHtml(fullName)}</h4>
          <div class="profile-preview-chips">
            <span class="profile-chip profile-chip-role">
              <i class="fa-solid fa-id-badge"></i> ${escapeHtml(roleLabel)}
            </span>
          </div>
        </div>
      </div>
      <dl class="teacher-profile-modal-dl">${dlHtml}</dl>`;
  } catch (e) {
    console.error("openAdminProfilePreviewModal:", e);
    body.innerHTML = `<p class="small-note" style="margin:0;color:#fb923c;">${escapeHtml(
      e.message || "Could not load profile."
    )}</p>`;
  }
}

function closeTeacherProfileModal() {
  closeAdminProfilePreviewModal();
}

async function openTeacherProfileModal(idNumber) {
  return openAdminProfilePreviewModal(idNumber, "Teacher profile");
}

// Admin Users page state — cached full list + active role tab + search term.
// Allows tab switching + search filtering without re-hitting the server.
let adminUsersCache = [];
let adminUsersRoleFilter = "all";
let adminUsersSearchTerm = "";

function renderAdminUsersTable() {
  const tableBody = document.querySelector('#users-table-body');
  if (!tableBody) return;

  const term = (adminUsersSearchTerm || "").trim().toLowerCase();
  const role = (adminUsersRoleFilter || "all").toLowerCase();

  const filtered = adminUsersCache.filter((u) => {
    if (role !== "all") {
      if (String(u.role || "").trim().toLowerCase() !== role) return false;
    }
    if (!term) return true;
    const hay = [
      getProfileDisplayName(u),
      u.first_name,
      u.last_name,
      u.id_number,
      u.email,
      u.role,
    ]
      .map((v) => String(v || "").toLowerCase())
      .join(" ");
    return hay.includes(term);
  });

  if (!filtered.length) {
    const msg = adminUsersCache.length
      ? "No users match the current filter."
      : "No users found.";
    tableBody.innerHTML = `<tr><td colspan="5">${msg}</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered
    .map(
      (user) => `
      <tr>
        <td>${escapeHtml(getProfileDisplayName(user) || 'N/A')}</td>
        <td>${escapeHtml(user.id_number || 'N/A')}</td>
        <td>${escapeHtml(user.email || 'N/A')}</td>
        <td>${escapeHtml(user.role || 'N/A')}</td>
        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
      </tr>
    `
    )
    .join('');
}

function updateAdminUsersTabCounts() {
  const counts = { all: 0, student: 0, teacher: 0 };
  for (const u of adminUsersCache) {
    counts.all += 1;
    const r = String(u.role || "").trim().toLowerCase();
    if (r === "student") counts.student += 1;
    else if (r === "teacher") counts.teacher += 1;
  }
  const ids = {
    all: "users-tab-count-all",
    student: "users-tab-count-student",
    teacher: "users-tab-count-teacher",
  };
  for (const key of Object.keys(ids)) {
    const el = document.getElementById(ids[key]);
    if (el) el.textContent = String(counts[key]);
  }
}

function setAdminUsersRoleFilter(role) {
  adminUsersRoleFilter = (role || "all").toLowerCase();
  document.querySelectorAll("[data-users-role-tab]").forEach((btn) => {
    const isActive = btn.getAttribute("data-users-role-tab") === adminUsersRoleFilter;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderAdminUsersTable();
}

function setAdminUsersSearchTerm(term) {
  adminUsersSearchTerm = String(term || "");
  renderAdminUsersTable();
}

// Expose admin-users helpers on window so the page entry file (a separate
// script) can always reach them no matter the cross-script timing.
window.setAdminUsersRoleFilter = setAdminUsersRoleFilter;
window.setAdminUsersSearchTerm = setAdminUsersSearchTerm;
window.renderAdminUsersTable = renderAdminUsersTable;
window.loadAllUsers = loadAllUsers;

// Self-mounting: as soon as the Admin Users page DOM is ready, wire up the
// tab + search + reset event listeners. This makes the page work even if
// the page-specific entry file (admin-users.entry.js) has not yet attached
// its own handlers, and is idempotent (data-users-handlers-bound guard).
function setupAdminUsersPageHandlers() {
  const tabsHost = document.querySelector(".workspace-tabs[aria-label='Filter users by role']");
  if (!tabsHost) return; // not on the Admin Users page
  if (tabsHost.dataset.usersHandlersBound === "1") return;
  tabsHost.dataset.usersHandlersBound = "1";

  document.querySelectorAll("[data-users-role-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-users-role-tab") || "all";
      setAdminUsersRoleFilter(role);
    });
  });

  const searchInput = document.getElementById("users-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      setAdminUsersSearchTerm(e.target.value);
    });
  }

  document.getElementById("users-reset")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    setAdminUsersSearchTerm("");
    setAdminUsersRoleFilter("all");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupAdminUsersPageHandlers, { once: true });
} else {
  setupAdminUsersPageHandlers();
}

async function loadAllUsers() {
  const tableBody = document.querySelector('#users-table-body');
  if (!tableBody) return;

  try {
    const response = await fetch(apiUrl("/users"), { headers: adminAuthHeaders() });
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="6">Failed to load users.</td></tr>';
      return;
    }
    const users = await response.json();
    adminUsersCache = Array.isArray(users) ? users : [];
    updateAdminUsersTabCounts();
    renderAdminUsersTable();
  } catch (error) {
    console.error('Failed to load all users:', error);
    tableBody.innerHTML = '<tr><td colspan="6">Error loading data.</td></tr>';
  }
}

async function loadAIResults() {
  const grid = document.querySelector("#ai-results-grid");
  if (!grid) return;

  const emptyHtml = `
    <div class="empty-state">
      <i class="fa-solid fa-robot"></i>
      <h3>No AI Content Yet</h3>
      <p>No lessons have reviewer text, quizzes, or activities yet. Teachers generate these from uploaded files.</p>
    </div>
  `;

  try {
    const response = await fetch(apiUrl("/lessons"));
    if (!response.ok) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const data = await response.json();
    const lessons = data.lessons || [];
    const withAi = lessons.filter(
      (l) => l.has_reviewer || (Number(l.quiz_count) > 0) || l.has_activities
    );
    if (!withAi.length) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const cards = withAi
      .map((l) => {
        const bits = [];
        if (l.has_reviewer) bits.push("Reviewer");
        if (Number(l.quiz_count) > 0) bits.push(`Quiz (${l.quiz_count})`);
        if (l.has_activities) bits.push("Activities");
        const published = l.is_published || l.published;
        return `
          <article class="glass-card fade-up" style="padding:1rem 1.15rem;">
            <h4 style="margin:0 0 0.35rem;">${escapeHtml(l.filename || "Lesson")}</h4>
            <p class="small-note" style="margin:0 0 0.5rem;">Teacher: ${escapeHtml(l.teacher_id_number || "—")}</p>
            <p class="small-note" style="margin:0 0 0.75rem;">${escapeHtml(bits.join(" · ") || "—")}</p>
            <span class="status-badge ${published ? "online" : "warning"}">${published ? "Published" : "Draft"}</span>
          </article>
        `;
      })
      .join("");
    grid.innerHTML = `<div class="content-grid">${cards}</div>`;
  } catch (e) {
    console.error("loadAIResults:", e);
    grid.innerHTML = emptyHtml;
  }
}

async function loadUploadedFiles() {
  const tableBody = document.querySelector('#files-table-body');
  if (!tableBody) return;

  try {
    const response = await fetch(apiUrl("/lessons"));
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="6">Failed to load files.</td></tr>';
      return;
    }

    const data = await response.json();
    const lessons = data.lessons || [];

    const rows = lessons.map(lesson => `
      <tr>
        <td>${lesson.filename || 'N/A'}</td>
        <td>${lesson.teacher_id_number || 'N/A'}</td>
        <td>${lesson.file_type || 'N/A'}</td>
        <td>${lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : 'N/A'}</td>
        <td>${lesson.is_published ? '<span class="status-badge online">Published</span>' : '<span class="status-badge warning">Draft</span>'}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost" data-action="view" data-id="${lesson.file_id}">View</button>
          </div>
        </td>
      </tr>
    `).join('');

    tableBody.innerHTML = rows || '<tr><td colspan="6">No uploaded files found.</td></tr>';
  } catch (error) {
    console.error('Failed to load uploaded files:', error);
    tableBody.innerHTML = '<tr><td colspan="6">Error loading data.</td></tr>';
  }
}

async function loadLeaderboard() {
  const list = document.querySelector('#leaderboard-list');
  if (!list) return;

  const emptyHtml = `
    <div class="empty-state">
      <i class="fa-solid fa-ranking-star"></i>
      <h3>No Quiz Results Yet</h3>
      <p>Students need to complete quizzes to appear on the leaderboard.</p>
    </div>
  `;

  try {
    const response = await fetch(apiUrl("/student/leaderboard"));
    if (!response.ok) {
      list.innerHTML = emptyHtml;
      return;
    }
    const data = await response.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];

    if (!entries.length) {
      list.innerHTML = emptyHtml;
      return;
    }

    const rows = entries
      .map(
        (e) =>
          `<tr>
            <td>${escapeHtml(String(e.rank ?? "—"))}</td>
            <td>${escapeHtml(e.display_name || getProfileDisplayName(e) || "Student")}</td>
            <td>${escapeHtml(String(e.total_points ?? 0))}</td>
            <td>${escapeHtml(String(e.quiz_attempts ?? 0))}</td>
            <td>${escapeHtml(String(e.progress_pct ?? 0))}%</td>
          </tr>`
      )
      .join("");
    list.innerHTML = `
      <div class="table-overflow">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Points</th>
              <th>Attempts</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    console.error("loadLeaderboard:", error);
    list.innerHTML = emptyHtml;
  }
}

async function loadAttendanceLogs() {
  const tableBody = document.querySelector("#attendance-table-body");
  if (!tableBody) return;

  const emptyRow = '<tr><td colspan="4">No attendance records yet.</td></tr>';
  try {
    const response = await fetch(apiUrl("/admin/attendance-logs"), { headers: adminAuthHeaders() });
    if (!response.ok) {
      tableBody.innerHTML = '<tr><td colspan="4">Could not load attendance logs.</td></tr>';
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.error) {
      tableBody.innerHTML = `<tr><td colspan="4">${escapeHtml(String(data.error))}</td></tr>`;
      return;
    }
    const logs = Array.isArray(data.logs) ? data.logs : [];
    if (!logs.length) {
      tableBody.innerHTML = emptyRow;
      return;
    }
    tableBody.innerHTML = logs
      .map(
        (row) => `
      <tr>
        <td>${escapeHtml(row.student_display || "—")}</td>
        <td>${escapeHtml(row.date_display || "—")}</td>
        <td>${escapeHtml(row.status || "—")}</td>
        <td>${escapeHtml(row.notes || "—")}</td>
      </tr>`
      )
      .join("");
  } catch (e) {
    console.error("loadAttendanceLogs:", e);
    tableBody.innerHTML = '<tr><td colspan="4">Error loading attendance.</td></tr>';
  }
}

async function loadJournals() {
  const grid = document.querySelector("#journal-grid");
  if (!grid) return;

  const emptyHtml = `
    <div class="empty-state">
      <i class="fa-solid fa-book"></i>
      <h3>No Journal Submissions Yet</h3>
      <p>Journal entries from students will show here.</p>
    </div>
  `;

  try {
    const response = await fetch(apiUrl("/admin/journals-feed"), { headers: adminAuthHeaders() });
    if (!response.ok) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (data.error) {
      grid.innerHTML = `<div class="empty-state"><p>${escapeHtml(String(data.error))}</p></div>`;
      return;
    }
    const journals = Array.isArray(data.journals) ? data.journals : [];
    if (!journals.length) {
      grid.innerHTML = emptyHtml;
      return;
    }
    const cards = journals
      .map((j) => {
        const when = j.submitted_at ? formatAdminActivityTime(j.submitted_at) : "—";
        const body = (j.body || "").trim();
        const preview = body.length > 280 ? `${body.slice(0, 280)}…` : body;
        return `
          <article class="glass-card fade-up" style="padding:1rem 1.15rem;">
            <div style="display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.5rem;">
              <strong>${escapeHtml(j.student_display || "Student")}</strong>
              <span class="small-note">${escapeHtml(when)}</span>
            </div>
            <p class="small-note" style="margin:0;white-space:pre-wrap;">${escapeHtml(preview || "—")}</p>
          </article>
        `;
      })
      .join("");
    grid.innerHTML = `<div class="content-grid">${cards}</div>`;
  } catch (e) {
    console.error("loadJournals:", e);
    grid.innerHTML = emptyHtml;
  }
}

async function loadReports() {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  try {
    const res = await fetch(apiUrl("/admin/stats"), { headers: adminAuthHeaders() });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      if (!d.error) {
        setText("report-total-users", d.total_accounts ?? 0);
        setText("report-total-students", d.total_students ?? 0);
        setText("report-active-today", d.active_users_today ?? 0);
        setText("report-lessons", d.lessons_total ?? 0);
        setText("report-published", d.lessons_published ?? 0);
        setText("report-ai-content", d.lessons_with_ai ?? 0);
        return;
      }
    }
  } catch (e) {
    console.error("loadReports /admin/stats:", e);
  }

  try {
    const response = await fetch(apiUrl("/users"), { headers: adminAuthHeaders() });
    if (response.ok) {
      const users = await response.json();
      setText("report-total-users", users.length);
      setText(
        "report-total-students",
        users.filter((u) => String(u.role || "").toLowerCase() === "student").length
      );
      setText("report-active-today", 0);
      setText("report-lessons", 0);
      setText("report-published", 0);
      setText("report-ai-content", 0);
    }
  } catch (error) {
    console.error("Failed to load report data:", error);
  }
}

function loadSettings() {
  // Settings are static for now - could be loaded from backend in future
  console.log('Settings section loaded');
}

function setupAdminPage() {
  const adminTableBody = document.querySelector("#admin-table-body");
  if (!adminTableBody) return;

  renderAdminTable();
  renderMetrics();
  renderRecentActivity();
  renderSystemStatus();
  setupDashboardActions();
  setupAdminNavigation();

  const adminSearchInput = document.getElementById("admin-search");
  const adminResetButton = document.getElementById("admin-reset");
  if (adminSearchInput) {
    adminSearchInput.addEventListener("input", () => renderAdminTable(adminSearchInput.value));
  }
  if (adminResetButton) {
    adminResetButton.addEventListener("click", () => {
      if (adminSearchInput) adminSearchInput.value = "";
      renderAdminTable();
      renderMetrics();
    });
  }
}

// Teacher dashboard: lesson file selected in UI + server state
const LESSON_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;
const LESSON_UPLOAD_TOO_LARGE_MSG =
  "File too large (max 500 MB). Export a smaller PDF/PPTX or split the deck.";

let currentFileId = null;
let currentQuiz = [];
let teacherAiAbortController = null;

const TEACHER_FILE_STORAGE_KEY = "learniq-teacher-file-id";

async function fetchTeacherLessonsList() {
  try {
    const currentUser = getCurrentUserSession();
    if (!currentUser || !currentUser.id_number) {
      console.error("No logged-in teacher found");
      return [];
    }

    const res = await fetch(apiUrl(`/teacher/lessons?teacher_id_number=${currentUser.id_number}`), {
      headers: adminAuthHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.lessons || [];
  } catch (error) {
    console.error("Failed to fetch teacher lessons:", error);
    return [];
  }
}

function teacherLessonFileMetaLine(lesson) {
  const ftRaw = lesson && lesson.file_type != null ? String(lesson.file_type).trim() : "";
  const ft = ftRaw ? ftRaw.toUpperCase() : "FILE";
  const d = lesson && lesson.created_at ? new Date(lesson.created_at) : null;
  const dateOk = d && !Number.isNaN(d.getTime());
  const datePart = dateOk ? `Uploaded ${d.toLocaleDateString()}` : "Date not available";
  return `${ft} • ${datePart}`;
}

function getTeacherDashboardSubjectFilter() {
  try {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("subject_id");
    return sid && sid.trim() ? sid.trim() : null;
  } catch {
    return null;
  }
}

function teacherLessonMatchesSubject(lesson, subjectId) {
  if (!subjectId || subjectId === "__unassigned__") return false;
  const lid = String(lesson?.subject_id || "").trim().toLowerCase();
  const sid = String(subjectId).trim().toLowerCase();
  return Boolean(lid && sid && lid === sid);
}

async function linkLessonToSubject(lessonId, subjectId) {
  const lid = String(lessonId || "").trim();
  const sid = String(subjectId || "").trim();
  if (!lid || !sid || sid === "__unassigned__") return;
  const res = await fetch(apiUrl("/lesson/subject"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_id: lid, file_id: lid, subject_id: sid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Could not link lesson to this subject.");
  }
  await readApiJson(res);
}

function sortTeacherLessonsNewestFirst(lessonList) {
  return [...lessonList].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });
}

function isTeacherLessonPublished(lesson) {
  return Boolean(lesson?.is_published || lesson?.published);
}

function getTeacherSubjectUnpublishedLessons(lessonList) {
  return (lessonList || []).filter((l) => !isTeacherLessonPublished(l));
}

function getTeacherSubjectYourLessons(allLessons, subjectFilter) {
  if (!subjectFilter || subjectFilter === "__unassigned__") {
    return subjectFilter === "__unassigned__"
      ? allLessons.filter((l) => !l.subject_id)
      : allLessons;
  }
  // Only lessons explicitly linked to this subject (never show unlinked files on every subject).
  return allLessons.filter((l) => teacherLessonMatchesSubject(l, subjectFilter));
}

/** Download a lesson file with Authorization header (same tab). */
async function downloadLessonFileWithAuth(fileUrl) {
  try {
    const user = getCurrentUserSession();
    const headers = {};
    if (user && user.access_token) {
      headers.Authorization = `Bearer ${user.access_token}`;
    }
    const response = await fetch(fileUrl, { headers });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (e) {
    showToast(`Could not download file: ${e.message}`, "error");
  }
}

function teacherLessonFileViewUrl(lessonId) {
  const u = getCurrentUserSession();
  const lid = encodeURIComponent(String(lessonId || "").trim());
  const tid = encodeURIComponent(String(u?.id_number || "").trim());
  return apiUrl(`/lessons/${lid}/file?teacher_id_number=${tid}`);
}

function viewTeacherLessonFile(lessonId) {
  const u = getCurrentUserSession();
  if (!u?.id_number) {
    showToast("Sign in again to view lessons.", "error");
    return;
  }
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }
  downloadLessonFileWithAuth(teacherLessonFileViewUrl(id));
}

function studentLessonFileViewUrl(lessonId) {
  const sid = getStudentIdNumberForApi();
  const lid = encodeURIComponent(String(lessonId || "").trim());
  const student = encodeURIComponent(String(sid || "").trim());
  return apiUrl(`/student/lessons/${lid}/file?student_id_number=${student}`);
}

function viewStudentLessonFile(lessonId) {
  const sid = getStudentIdNumberForApi();
  if (!sid) {
    showToast("Please sign in as a student to view lessons.", "error");
    return;
  }
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }
  downloadLessonFileWithAuth(studentLessonFileViewUrl(id));
}

function teacherSubjectYourLessonActionsHtml(lesson) {
  const lid = String(lesson.id || lesson.file_id || "").replace(/'/g, "\\'");
  const isPub = Boolean(lesson.is_published || lesson.published);
  const publishBtn = isPub
    ? `<button type="button" class="btn btn-sm btn-secondary" onclick="unpublishLessonFromSubjectPage('${lid}')">Unpublish</button>`
    : `<button type="button" class="btn btn-sm btn-primary" onclick="publishLessonFromSubjectPage('${lid}')">Publish</button>`;
  return `<button type="button" class="btn btn-sm btn-secondary" onclick="viewTeacherLessonFile('${lid}')">View</button>
    ${publishBtn}
    <button type="button" class="btn btn-sm btn-danger" onclick="removeTeacherLesson('${lid}')">Remove</button>`;
}

function renderTeacherSubjectYourLessonRow(lesson) {
  return renderTeacherSubjectLessonRow(lesson, teacherSubjectYourLessonActionsHtml(lesson));
}

function teacherSubjectPublishedLessonActionsHtml(lesson) {
  const lid = String(lesson.id || lesson.file_id || "").replace(/'/g, "\\'");
  return `<button type="button" class="btn btn-sm btn-secondary" onclick="viewTeacherLessonFile('${lid}')">View</button>
    <button type="button" class="btn btn-sm btn-secondary" onclick="unpublishLessonFromSubjectPage('${lid}')">Unpublish</button>
    <button type="button" class="btn btn-sm btn-danger" onclick="removeTeacherLesson('${lid}')">Remove</button>`;
}

function renderTeacherSubjectLessonRow(lesson, actionsHtml) {
  const fname = escapeHtml(lesson.filename || "Untitled Lesson");
  const meta = escapeHtml(teacherLessonFileMetaLine(lesson));
  return `
          <div class="lesson-item">
            <div class="lesson-info">
              <h4>${fname}</h4>
              <span class="small-note">${meta}</span>
            </div>
            <div class="lesson-actions">
              ${actionsHtml}
            </div>
          </div>`;
}

function renderTeacherSubjectPublishedLessonRow(lesson) {
  return renderTeacherSubjectLessonRow(lesson, teacherSubjectPublishedLessonActionsHtml(lesson));
}

async function ensureLessonLinkedToCurrentSubject(lessonId) {
  const subjectId = getTeacherDashboardSubjectFilter();
  if (!subjectId || subjectId === "__unassigned__") return;
  const all = await fetchTeacherLessonsList();
  const lesson = all.find((l) => String(l.id || l.file_id || "") === String(lessonId));
  if (lesson && !teacherLessonMatchesSubject(lesson, subjectId)) {
    await linkLessonToSubject(lessonId, subjectId);
  }
}

async function publishLessonFromSubjectPage(lessonId) {
  try {
    await ensureLessonLinkedToCurrentSubject(lessonId);
    await publishLesson(lessonId);
  } catch (e) {
    showToast(e?.message || "Could not publish lesson.", "error");
  }
}

async function unpublishLessonFromSubjectPage(lessonId) {
  await unpublishLesson(lessonId);
}

async function removeTeacherLesson(lessonId) {
  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: "Remove lesson?",
      message: "This permanently removes the lesson file and related content. This cannot be undone.",
      confirmText: "Remove",
      cancelText: "Cancel",
      danger: true,
    });
  } else {
    ok = window.confirm("Remove this lesson permanently?");
  }
  if (!ok) return;

  const id = String(lessonId || "").trim();
  try {
    const res = await fetch(apiUrl(`/lessons/${encodeURIComponent(id)}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Remove failed (status ${res.status}).`);
    }
    if (String(currentFileId || "") === id) {
      currentFileId = null;
      localStorage.removeItem(TEACHER_FILE_STORAGE_KEY);
    }
    showToast("Lesson removed.", "success");
    await refreshTeacherLessons();
    await loadTeacherDashboardLessons();
    void initTeacherLearniqDashboardStatsIfPresent();
  } catch (e) {
    showToast(e?.message || "Could not remove lesson.", "error");
  }
}

window.publishLessonFromSubjectPage = publishLessonFromSubjectPage;
window.unpublishLessonFromSubjectPage = unpublishLessonFromSubjectPage;
window.removeTeacherLesson = removeTeacherLesson;
window.viewTeacherLessonFile = viewTeacherLessonFile;

async function loadTeacherDashboardLessons() {
  try {
    const allLessons = await fetchTeacherLessonsList();

    const subjectFilter = getTeacherDashboardSubjectFilter();
    const isSubjectPage = document.body?.classList?.contains("teacher-subject-lessons-page");
    let lessons = allLessons;
    let yourLessons = allLessons;

    if (subjectFilter) {
      if (subjectFilter === "__unassigned__") {
        lessons = allLessons.filter((l) => !l.subject_id);
        yourLessons = lessons;
      } else {
        yourLessons = getTeacherSubjectYourLessons(allLessons, subjectFilter);
        lessons = isSubjectPage
          ? yourLessons
          : allLessons.filter((l) => teacherLessonMatchesSubject(l, subjectFilter));
      }
    }

    const linkedForSubject =
      subjectFilter && subjectFilter !== "__unassigned__"
        ? allLessons.filter((l) => teacherLessonMatchesSubject(l, subjectFilter))
        : lessons;

    const recentLessonsList = document.getElementById("recent-lessons-list");
    if (recentLessonsList) {
      const displayLessons =
        isSubjectPage && subjectFilter ? getTeacherSubjectUnpublishedLessons(yourLessons) : lessons;
      const sortedLessons = sortTeacherLessonsNewestFirst(displayLessons);
      if (sortedLessons.length === 0) {
        recentLessonsList.innerHTML =
          isSubjectPage && subjectFilter
            ? '<p class="small-note">No unpublished lessons for this subject yet.</p>'
            : subjectFilter
              ? '<p class="small-note">No uploaded lessons for this subject yet.</p>'
              : '<p class="small-note">No uploaded lessons yet.</p>';
      } else if (isSubjectPage && subjectFilter) {
        recentLessonsList.innerHTML = sortedLessons
          .map((lesson) => renderTeacherSubjectYourLessonRow(lesson))
          .join("");
      } else {
        recentLessonsList.innerHTML = sortedLessons
          .map((lesson) => {
            const lid = String(lesson.id || lesson.file_id || "").replace(/'/g, "\\'");
            const fname = escapeHtml(lesson.filename || "Untitled Lesson");
            const meta = escapeHtml(teacherLessonFileMetaLine(lesson));
            return `
          <div class="lesson-item">
            <div class="lesson-info">
              <h4>${fname}</h4>
              <span class="small-note">${meta}</span>
            </div>
            <div class="lesson-actions">
              ${
                lesson.is_published
                  ? `<button type="button" class="btn btn-sm btn-primary" onclick="unpublishLesson('${lid}')">Unpublish</button>`
                  : `<button type="button" class="btn btn-sm btn-secondary" onclick="generateAIContent('${lid}')">Generate AI</button>
                 <button type="button" class="btn btn-sm btn-primary" onclick="publishLesson('${lid}')">Publish</button>`
              }
              <button type="button" class="btn btn-sm btn-danger" onclick="deleteTeacherLesson('${lid}')">Delete</button>
            </div>
          </div>
        `;
          })
          .join("");
      }
    }
    
    // Published Lessons - only lessons with is_published = true
    const publishedLessonsList = document.getElementById('published-lessons-list');
    if (publishedLessonsList) {
      const publishedLessons = linkedForSubject.filter((lesson) => lesson.is_published || lesson.published);
      if (publishedLessons.length === 0) {
        publishedLessonsList.innerHTML = subjectFilter
          ? '<p class="small-note">No published lessons for this subject yet.</p>'
          : '<p class="small-note">No published lessons yet.</p>';
      } else if (isSubjectPage && subjectFilter) {
        publishedLessonsList.innerHTML = publishedLessons
          .map((lesson) => renderTeacherSubjectPublishedLessonRow(lesson))
          .join("");
      } else {
        publishedLessonsList.innerHTML = publishedLessons.map((lesson) => {
          const lid = String(lesson.id || lesson.file_id || "").replace(/'/g, "\\'");
          const fname = escapeHtml(lesson.filename || "Untitled Lesson");
          const ftRaw = lesson && lesson.file_type != null ? String(lesson.file_type).trim() : "";
          const ft = escapeHtml(ftRaw ? ftRaw.toUpperCase() : "FILE");
          const d = lesson && lesson.created_at ? new Date(lesson.created_at) : null;
          const dateOk = d && !Number.isNaN(d.getTime());
          const cal = escapeHtml(dateOk ? d.toLocaleDateString() : "—");
          return `
          <div class="published-lesson">
            <div class="lesson-header">
              <h4>${fname}</h4>
              <span class="status-badge online">Published</span>
            </div>
            <div class="lesson-stats">
              <span><i class="fa-solid fa-file"></i> ${ft}</span>
              <span><i class="fa-solid fa-calendar"></i> ${cal}</span>
            </div>
            <div class="lesson-actions">
              <button type="button" class="btn btn-sm btn-primary" onclick="unpublishLesson('${lid}')">Unpublish</button>
              <button type="button" class="btn btn-sm btn-danger" onclick="deleteTeacherLesson('${lid}')">Delete</button>
            </div>
          </div>
        `;
        }).join("");
      }
    }

    if (isSubjectPage && subjectFilter) {
      updateTeacherSubjectPageStats(yourLessons, linkedForSubject);
    }
  } catch (error) {
    console.error('Failed to load teacher dashboard lessons:', error);
    
    // Show error messages in all sections
    document.getElementById('recent-lessons-list') && (document.getElementById('recent-lessons-list').innerHTML = '<p class="small-note">Error loading lessons.</p>');
    document.getElementById('published-lessons-list') && (document.getElementById('published-lessons-list').innerHTML = '<p class="small-note">Error loading lessons.</p>');
  }
}

async function publishLesson(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: "Publish lesson?",
      message: "Are you sure you want to publish this lesson?",
      confirmText: "Yes",
      cancelText: "No",
    });
  } else {
    ok = window.confirm("Are you sure you want to publish this lesson?");
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl("/publish-lesson"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ file_id: id }),
    });
    await readApiJson(res);
    showToast("Lesson published. Students can open or refresh their dashboard.", "success");
    await loadTeacherDashboardLessons();
    void initTeacherLearniqDashboardStatsIfPresent();
  } catch (e) {
    showToast(e?.message || "Could not publish lesson.", "error");
  }
}

async function unpublishLesson(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: "Unpublish lesson?",
      message:
        "Are you sure you want to unpublish this lesson? Students will no longer see this content.",
      confirmText: "Yes",
      cancelText: "No",
    });
  } else {
    ok = window.confirm(
      "Are you sure you want to unpublish this lesson? Students will no longer see this content.",
    );
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl("/unpublish-lesson"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ file_id: id }),
    });
    await readApiJson(res);
    showToast("Lesson unpublished. Students can no longer see this content.", "success");
    await loadTeacherDashboardLessons();
    void initTeacherLearniqDashboardStatsIfPresent();
  } catch (e) {
    showToast(e?.message || "Could not unpublish lesson.", "error");
  }
}

function generateAIContent(lessonId) {
  // This would navigate to AI generation page or call AI endpoint
  console.log('Generate AI for lesson:', lessonId);
  // Could redirect to ai-result.html with lesson ID
  window.location.href = `ai-result.html?file_id=${lessonId}`;
}

async function deleteTeacherLesson(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    showToast("Missing lesson id.", "error");
    return;
  }

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: "Delete lesson?",
      message: "This permanently removes the lesson file, AI content, and quiz attempts. This cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true,
    });
  } else {
    ok = window.confirm("Delete this lesson permanently? This cannot be undone.");
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl(`/lessons/${encodeURIComponent(id)}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (status ${res.status}).`);
    }
    if (String(currentFileId || "") === id) {
      currentFileId = null;
      localStorage.removeItem(TEACHER_FILE_STORAGE_KEY);
    }
    showToast("Lesson deleted.", "success");
    await refreshTeacherLessons();
    await loadTeacherDashboardLessons();
    void initTeacherLearniqDashboardStatsIfPresent();
  } catch (e) {
    showToast(e?.message || "Could not delete lesson.", "error");
  }
}

window.deleteTeacherLesson = deleteTeacherLesson;

function renderTeacherLessonsTable(lessons, selectedId) {
  const tbody = document.getElementById("teacher-lessons-tbody");
  if (!tbody) return;
  const sel = selectedId !== undefined && selectedId !== null ? selectedId : currentFileId;
  if (!lessons.length) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="small-note">No uploads yet. Choose a PDF or PPT and click a generate button to upload it.</td></tr>';
    return;
  }
  tbody.innerHTML = lessons
    .map((l) => {
      const bits = [];
      if (l.has_reviewer) bits.push("Reviewer");
      if (l.quiz_count) bits.push(`${l.quiz_count} quiz Q`);
      if (l.has_activities) bits.push("Activities");
      const aiCell = bits.length ? bits.join(" · ") : "—";
      const pub = l.published ? '<span class="status-badge online">Yes</span>' : "—";
      const selected = sel === l.file_id ? "lesson-row-selected" : "";
      return `<tr class="${selected}" data-lesson-id="${encodeURIComponent(l.file_id)}" style="cursor:pointer">
        <td>${escapeHtml(l.filename)}</td>
        <td>${escapeHtml(aiCell)}</td>
        <td>${pub}</td>
      </tr>`;
    })
    .join("");
}

async function syncLessonFromServer(fileId) {
  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(fileId)}`));
    if (!res.ok) {
      currentQuiz = [];
      return;
    }
    const data = await res.json();
    currentQuiz = Array.isArray(data.quiz) ? [...data.quiz] : [];
  } catch {
    currentQuiz = [];
  }
}

async function refreshTeacherLessons() {
  const lessons = await fetchTeacherLessonsList();
  const saved = localStorage.getItem(TEACHER_FILE_STORAGE_KEY);
  if (saved && lessons.some((l) => l.file_id === saved)) {
    currentFileId = saved;
    await syncLessonFromServer(saved);
    const meta = lessons.find((l) => l.file_id === saved);
    const fileMeta = document.querySelector("#file-meta");
    // `teacher-learniq-dashboard.html` uses #file-meta for the local file picker state.
    // Don't auto-fill it from saved server lesson selection.
    const isTeacherLearniqPage = document.body && document.body.classList.contains("teacher-learniq-page");
    if (!isTeacherLearniqPage && fileMeta && meta) {
      fileMeta.textContent = `Selected lesson: ${meta.filename}`;
    }
  }
  renderTeacherLessonsTable(lessons, currentFileId);
}

async function selectTeacherLesson(fileId, filename) {
  currentFileId = fileId;
  localStorage.setItem(TEACHER_FILE_STORAGE_KEY, fileId);
  await syncLessonFromServer(fileId);
  const fileMeta = document.querySelector("#file-meta");
  const isTeacherLearniqPage = document.body && document.body.classList.contains("teacher-learniq-page");
  if (!isTeacherLearniqPage && fileMeta && filename) {
    fileMeta.textContent = `Selected lesson: ${filename}`;
  }
  const lessons = await fetchTeacherLessonsList();
  renderTeacherLessonsTable(lessons, fileId);
}

async function uploadFile(file, subjectId = null) {
  const currentUser = getCurrentUserSession();
  if (!currentUser || !currentUser.id_number) {
    throw new Error("Teacher not logged in. Please log in again.");
  }

  if (file.size > LESSON_UPLOAD_MAX_BYTES) {
    throw new Error(LESSON_UPLOAD_TOO_LARGE_MSG);
  }

  console.log("Uploading file:", file.name);
  console.log("teacher_id_number:", currentUser.id_number);
  console.log("subject_id:", subjectId);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("teacher_id_number", currentUser.id_number);
  if (subjectId) {
    formData.append("subject_id", subjectId);
  }

  console.log("FormData contents:");
  for (let [key, value] of formData.entries()) {
    console.log(`  ${key}:`, key === 'file' ? value.name : value);
  }

  const response = await fetch(apiUrl("/upload-file"), {
    method: "POST",
    headers: adminAuthHeaders(),
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Upload failed with status ${response.status}`);
  }

  const result = await readApiJson(response);
  currentFileId = result.file_id;
  localStorage.setItem(TEACHER_FILE_STORAGE_KEY, result.file_id);
  if (subjectId && result.file_id) {
    const already =
      result.subject_id != null && String(result.subject_id).trim() === String(subjectId).trim();
    if (!already) {
      try {
        await linkLessonToSubject(result.file_id, subjectId);
      } catch (linkErr) {
        console.warn("linkLessonToSubject after upload:", linkErr);
        throw linkErr;
      }
    }
  }
  showToast(`File uploaded: ${result.filename}`, "success");
  await refreshTeacherLessons();
  await loadTeacherDashboardLessons();
  if (document.body?.classList?.contains("teacher-subject-lessons-page")) {
    const sid = getTeacherDashboardUploadSubjectId();
    if (sid) {
      const lessons = await fetchTeacherLessonsList();
      const your = getTeacherSubjectYourLessons(lessons, sid);
      const linked = lessons.filter((l) => teacherLessonMatchesSubject(l, sid));
      updateTeacherSubjectPageStats(your, linked);
    }
  } else {
    void initTeacherLearniqDashboardStatsIfPresent();
  }
  return result;
}

function _aiCooldownAssert(type, fetchOpts = {}) {
  if (fetchOpts.skipCooldown) return;
  if (window.AiGenCooldown?.assertCanGenerate) {
    window.AiGenCooldown.assertCanGenerate(type);
  }
}

function _aiCooldownStart(type, fetchOpts = {}) {
  if (fetchOpts.skipCooldown) return;
  if (window.AiGenCooldown?.start) {
    window.AiGenCooldown.start(type);
  }
}

async function generateReviewer(fetchOpts = {}) {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");
  _aiCooldownAssert("reviewer", fetchOpts);

  const response = await fetch(apiUrl("/generate-reviewer"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      file_id: currentFileId,
      skip_cooldown: Boolean(fetchOpts.skipCooldown),
    }),
    ...(fetchOpts.signal ? { signal: fetchOpts.signal } : {})
  });

  const result = await readApiJson(response);
  _aiCooldownStart("reviewer", fetchOpts);
  return result.reviewer;
}

async function generateQuestion(fetchOpts = {}) {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");
  _aiCooldownAssert("quiz", fetchOpts);

  const response = await fetch(apiUrl("/generate-question"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      file_id: currentFileId,
      skip_cooldown: Boolean(fetchOpts.skipCooldown),
    }),
    ...(fetchOpts.signal ? { signal: fetchOpts.signal } : {})
  });

  const result = await readApiJson(response);
  currentQuiz.push(result);
  _aiCooldownStart("quiz", fetchOpts);
  return result;
}

async function generateActivities(fetchOpts = {}) {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");
  _aiCooldownAssert("activity", fetchOpts);

  const response = await fetch(apiUrl("/generate-activities"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      file_id: currentFileId,
      skip_cooldown: Boolean(fetchOpts.skipCooldown),
    }),
    ...(fetchOpts.signal ? { signal: fetchOpts.signal } : {})
  });

  const result = await readApiJson(response);
  _aiCooldownStart("activity", fetchOpts);
  return result.activities;
}

function updateFullAiPreview(previewBody, reviewerText, activities, questions) {
  if (!previewBody) return;
  const actBlock = Array.isArray(activities)
    ? activities.map((a) => `<p>• ${escapeHtml(a)}</p>`).join("")
    : "";
  const quizBlock = (questions || [])
    .map(
      (q, i) => `<div class="preview-snippet" style="margin-top:0.75rem">
        <h4>Question ${i + 1}</h4>
        <p><strong>${escapeHtml(q.question)}</strong></p>
        <p class="small-note">${(q.choices || []).map((c) => escapeHtml(c)).join(" · ")}</p>
        <small>Answer: ${escapeHtml(q.answer)}</small>
      </div>`
    )
    .join("");
  previewBody.innerHTML = `
    <div class="preview-snippet">
      <div class="reviewer-preview-toolbar">
        <h4>Reviewer</h4>
        <button type="button" class="btn btn-secondary btn-small" id="teacher-download-reviewer-pdf-btn">
          <i class="fa-solid fa-file-pdf"></i> Download PDF
        </button>
      </div>
      <div id="teacher-reviewer-preview-md" class="reviewer-markdown-body"></div>
    </div>
    <div class="preview-snippet"><h4>Learning activities</h4>${actBlock || "<p>—</p>"}</div>
    ${
      quizBlock ||
      '<div class="preview-snippet"><h4>Quiz</h4><p class="small-note">No questions generated.</p></div>'
    }
  `;
  const revEl = document.getElementById("teacher-reviewer-preview-md");
  if (revEl) {
    if (typeof mountReviewerMarkdownInto === "function") {
      mountReviewerMarkdownInto(revEl, reviewerText);
    } else {
      revEl.innerHTML = `<p>${escapeHtml(String(reviewerText || ""))}</p>`;
    }
  }
  const pdfBtn = document.getElementById("teacher-download-reviewer-pdf-btn");
  if (pdfBtn && revEl && typeof setReviewerPdfButtonVisible === "function") {
    const has =
      typeof normalizeReviewerMarkdown === "function"
        ? normalizeReviewerMarkdown(reviewerText).length > 0
        : Boolean(String(reviewerText || "").trim());
    setReviewerPdfButtonVisible(pdfBtn, has);
    pdfBtn.onclick = () => {
      if (typeof downloadReviewerPdfFromElement === "function") {
        downloadReviewerPdfFromElement(revEl, "reviewer");
      }
    };
  }
}

async function updateTeacherApiStatus() {
  const el = document.getElementById("teacher-api-status");
  if (!el) return;
  el.textContent = "Checking server…";
  el.classList.remove("is-online", "is-offline");
  try {
    const res = await fetch(apiUrl("/health"));
    if (!res.ok) throw new Error("unreachable");
    const data = await res.json().catch(() => ({}));
    let msg = "Server connected.";
    if (data.has_supabase === false) {
      msg += " Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to backend/.env and run supabase_schema.sql.";
    }
    if (data.has_api_key === false) {
      msg += " Set API_KEY for AI generation.";
    } else if (data.has_supabase !== false) {
      msg += " Upload & publish use the database.";
    }
    el.textContent = msg;
    el.classList.add("is-online");
  } catch {
    el.textContent =
      "Cannot reach the Ubuntu API. Start FastAPI on the Ubuntu laptop and set learniq-api-base in Settings (or localStorage) to http://YOUR-UBUNTU-IP:8000";
    el.classList.add("is-offline");
  }
}

async function runTeacherAiPack(previewBody) {
  if (!currentFileId) {
    showToast("Upload a lesson file first, or select one in the table below.", "error");
    return;
  }
  try {
    if (window.AiGenCooldown?.assertCanGenerateAll) {
      window.AiGenCooldown.assertCanGenerateAll(["reviewer", "quiz", "activity"]);
    }
  } catch (cooldownErr) {
    showToast(cooldownErr.message, "error");
    return;
  }
  teacherAiAbortController?.abort();
  teacherAiAbortController = new AbortController();
  const { signal } = teacherAiAbortController;
  const btn = document.getElementById("teacher-generate-ai-pack-btn");
  const cancelBtn = document.getElementById("teacher-cancel-ai-pack-btn");
  const prev = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="loader"></span> Generating...`;
  }
  if (cancelBtn) {
    cancelBtn.hidden = false;
    cancelBtn.disabled = false;
  }
  try {
    if (window.AiGenCooldown?.assertCanGenerateAll) {
      window.AiGenCooldown.assertCanGenerateAll(["reviewer", "quiz", "activity"]);
    }
    currentQuiz = [];
    const packOpts = { signal, skipCooldown: true };
    const reviewer = await generateReviewer(packOpts);
    const activities = await generateActivities(packOpts);
    const questions = [];
    for (let i = 0; i < 3; i++) {
      questions.push(await generateQuestion(packOpts));
    }
    if (window.AiGenCooldown?.start) {
      window.AiGenCooldown.start("reviewer");
      window.AiGenCooldown.start("activity");
      window.AiGenCooldown.start("quiz");
    }
    updateFullAiPreview(previewBody, reviewer, activities, questions);
    await refreshTeacherLessons();
    showToast("AI content ready: reviewer, activities, and 3 quiz questions.", "success");
  } catch (error) {
    if (error?.name === "AbortError" || signal.aborted) {
      showToast("AI generation cancelled.", "info");
    } else {
      showToast(`Error: ${error.message}`, "error");
    }
  } finally {
    teacherAiAbortController = null;
    if (cancelBtn) {
      cancelBtn.hidden = true;
      cancelBtn.disabled = true;
    }
    if (btn) {
      btn.innerHTML = prev;
    }
    window.AiGenCooldown?.refreshButtons?.();
  }
}

async function hydrateTeacherDashboardSubjectHeader() {
  const subjectId = getTeacherDashboardSubjectFilter();
  const actions = document.getElementById("teacher-dashboard-header-actions");
  const titleEl = document.getElementById("teacher-dashboard-panel-title");
  const subtitleEl = document.getElementById("teacher-dashboard-panel-subtitle");

  if (!subjectId) {
    if (actions) actions.hidden = true;
    return;
  }
  if (actions) actions.hidden = false;

  if (subjectId === "__unassigned__") {
    if (titleEl) titleEl.textContent = "Unassigned · Teacher LearnIQ";
    if (subtitleEl) {
      subtitleEl.textContent = "Lessons you uploaded that don't have a subject yet. Edit them to assign one.";
    }
    return;
  }

  try {
    const res = await fetch(apiUrl("/subjects"));
    if (!res.ok) return;
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const match = subjects.find((s) => String(s.id) === subjectId);
    if (match && titleEl) {
      titleEl.textContent = `${match.name} · Teacher LearnIQ`;
    }
    if (match && subtitleEl) {
      subtitleEl.textContent = match.description
        || "Manage the lessons you uploaded for this subject.";
    }
  } catch (e) {
    console.log("DEBUG: hydrateTeacherDashboardSubjectHeader failed:", e);
  }
}

async function loadTeacherSubjectOptions(selectId = "upload-subject-select") {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentUser = getCurrentUserSession();
  const teacherId = currentUser?.id_number ? encodeURIComponent(currentUser.id_number) : "";
  const subjectsUrl = teacherId
    ? apiUrl(`/subjects?owner_teacher_id_number=${teacherId}`)
    : apiUrl("/subjects");
  try {
    const res = await fetch(subjectsUrl);
    if (!res.ok) return;
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const placeholder = '<option value="" disabled selected>Choose subject…</option>';
    const opts = subjects
      .map((s) => `<option value="${escapeHtml(String(s.id))}">${escapeHtml(s.name || "Untitled subject")}</option>`)
      .join("");
    select.innerHTML = placeholder + opts;
    if (subjects.length === 0) {
      select.innerHTML = '<option value="" disabled selected>No subjects available — add one in the database.</option>';
    }
  } catch (e) {
    console.log("DEBUG: loadTeacherSubjectOptions failed:", e);
  }
}

function getTeacherDashboardUploadSubjectId() {
  const subjectFilter = getTeacherDashboardSubjectFilter();
  if (subjectFilter && subjectFilter !== "__unassigned__") {
    return subjectFilter;
  }
  return null;
}

function setupTeacherDashboard() {
  redirectAdminFromTeacherOnlyPages();
  ensureTeacherSidebarNav();
  const subjectId = getTeacherDashboardSubjectFilter();
  if (
    subjectId &&
    subjectId !== "__unassigned__" &&
    window.location.pathname.includes("teacher-learniq-dashboard.html")
  ) {
    window.location.replace(
      `teacher-subject-lessons.html?subject_id=${encodeURIComponent(subjectId)}`
    );
    return;
  }

  const fileInput = document.querySelector("#file-input");
  const fileMeta = document.querySelector("#file-meta");
  const previewBody = document.querySelector("#ai-preview-body");
  const tbody = document.getElementById("teacher-lessons-tbody");
  const clearBtn = document.getElementById("file-clear-btn");

  hydrateStudentSidebarChip();
  void initTeacherLearniqDashboardStatsIfPresent();

  const isStatsDashboard = document.body?.classList?.contains("teacher-stats-dashboard-page");
  if (isStatsDashboard) {
    document.getElementById("teacher-stats-refresh-btn")?.addEventListener("click", () => {
      void initTeacherLearniqDashboardStatsIfPresent();
    });
    return;
  }

  void hydrateTeacherDashboardSubjectHeader();

  // Load dashboard lessons on page load (legacy teacher-dashboard.html)
  loadTeacherDashboardLessons();

  if (fileMeta) {
    fileMeta.textContent = "";
  }

  fileInput?.addEventListener("change", () => {
    const selectedFile = fileInput?.files?.[0];
    if (!fileMeta) return;
    if (!selectedFile) {
      fileMeta.textContent = "";
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    fileMeta.textContent = `Selected file: ${selectedFile.name}`;
    if (clearBtn) clearBtn.hidden = false;
  });

  clearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (fileInput) fileInput.value = "";
    if (fileMeta) fileMeta.textContent = "";
    clearBtn.hidden = true;
    // Trigger any listeners that rely on change
    fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const uploadForm = document.querySelector("#upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const selectedFile = fileInput?.files?.[0];
      if (!selectedFile) {
        if (fileMeta) fileMeta.textContent = "No file selected yet";
        return;
      }

      const subjectId = getTeacherDashboardUploadSubjectId();

      if (fileMeta) fileMeta.textContent = `Uploading ${selectedFile.name}…`;
      currentFileId = null;
      currentQuiz = [];
      try {
        await uploadFile(selectedFile, subjectId || null);
        if (fileMeta) fileMeta.textContent = `Uploaded: ${selectedFile.name}`;
        fileInput.value = "";
      } catch (e) {
        if (fileMeta) fileMeta.textContent = "Upload failed. Try again.";
        const msg =
          e && e.message && String(e.message).includes("fetch")
            ? "Cannot reach the Ubuntu API. Check learniq-api-base in Settings points to http://YOUR-UBUNTU-IP:8000"
            : e.message || "Upload failed";
        showToast(msg, "error");
      }
    });
  }

  document.getElementById("teacher-generate-ai-pack-btn")?.addEventListener("click", () => {
    runTeacherAiPack(previewBody);
  });
  document.getElementById("teacher-cancel-ai-pack-btn")?.addEventListener("click", () => {
    teacherAiAbortController?.abort();
  });

  document.getElementById("publish-lesson-btn")?.addEventListener("click", async () => {
    if (!currentFileId) {
      showToast("Select a lesson in the table first.", "error");
      return;
    }
    try {
      const res = await fetch(apiUrl("/publish-lesson"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
        body: JSON.stringify({ file_id: currentFileId })
      });
      await readApiJson(res);
      showToast("Lesson published. Students can open or refresh their dashboard.", "success");
      await refreshTeacherLessons();
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  document.getElementById("refresh-lessons-btn")?.addEventListener("click", async () => {
    try {
      await refreshTeacherLessons();
      showToast("Lesson list updated.", "success");
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  if (tbody) {
    tbody.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-lesson-id]");
      if (!row) return;
      const raw = row.getAttribute("data-lesson-id");
      if (!raw) return;
      const id = decodeURIComponent(raw);
      const fnameCell = row.querySelector("td");
      const fname = fnameCell ? fnameCell.textContent.trim() : "";
      selectTeacherLesson(id, fname);
    });
  }

  refreshTeacherLessons();
  updateTeacherApiStatus();
}

function answersMatch(studentPick, correctAnswer) {
  const a = String(studentPick).trim().toLowerCase();
  const b = String(correctAnswer).trim().toLowerCase();
  if (a === b) return true;
  const first = a.charAt(0);
  if (b.length <= 2 && first === b.charAt(0)) return true;
  return false;
}

// ───────────────────────────────────────────────────────────────────────────
// Subjects page (frontend/subjects.html) — student entry point that renders
// subject cards using the SAME lesson-card design as my-lesson.html.
// Clicking a card navigates to my-lesson.html?subject_id=<uuid>.
// ───────────────────────────────────────────────────────────────────────────

function getStudentIdNumberForApi() {
  const u = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  return String(u?.id_number || "").trim() || "";
}

async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function joinSubjectWithCode(joinCode) {
  const studentId = getStudentIdNumberForApi();
  if (!studentId) {
    showToast("Please sign in as a student.", "error");
    return false;
  }
  const code = String(joinCode || "").trim().toUpperCase();
  if (!code) {
    showToast("Enter a subject code.", "error");
    return false;
  }
  const res = await fetch(apiUrl("/subjects/join"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ join_code: code, student_id_number: studentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not join subject.");
  }
  return data;
}

/**
 * Global "Join a class" modal, opened from the sidebar nav on any student
 * page (not just My lesson) — built once on demand, reuses joinSubjectWithCode().
 */
function openJoinClassModal() {
  let backdrop = document.getElementById("join-class-modal-backdrop");
  if (backdrop) {
    backdrop.hidden = false;
    document.getElementById("join-class-code-input")?.focus();
    return;
  }

  backdrop = document.createElement("div");
  backdrop.id = "join-class-modal-backdrop";
  backdrop.className = "action-modal-backdrop";

  backdrop.innerHTML = `
    <div class="action-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="join-class-modal-title">
      <div class="action-modal-head">
        <h3 id="join-class-modal-title"><i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Join a class</h3>
      </div>
      <p class="small-note">Your teacher will give you a code like <strong>MAT-C5DL</strong>.</p>
      <form id="join-class-modal-form">
        <input type="text" id="join-class-code-input" class="form-input" placeholder="E.G. MAT-C5DL" maxlength="12" autocomplete="off" required />
        <p class="small-note add-subject-error" id="join-class-code-error" hidden role="alert"></p>
        <div class="learniq-confirm-actions" style="margin-top: 0.85rem;">
          <button type="button" class="btn btn-ghost" id="join-class-modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="join-class-modal-submit">
            <i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Join class
          </button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(backdrop);

  const closeModal = () => {
    backdrop.hidden = true;
  };
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.getElementById("join-class-modal-cancel")?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) closeModal();
  });

  const input = document.getElementById("join-class-code-input");
  input?.addEventListener("input", () => {
    const v = String(input.value || "").toUpperCase().replace(/\s+/g, "");
    if (input.value !== v) input.value = v;
  });

  document.getElementById("join-class-modal-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorEl = document.getElementById("join-class-code-error");
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    const submitBtn = document.getElementById("join-class-modal-submit");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const data = await joinSubjectWithCode(input?.value || "");
      const name = data?.subject?.name || "Subject";
      showToast(`Joined "${name}" successfully.`, "success");
      if (input) input.value = "";
      closeModal();
      if (typeof renderSubjectsPage === "function" && document.getElementById("subjects-list")) {
        await renderSubjectsPage();
      }
    } catch (e) {
      const msg = e?.message || "Could not join subject.";
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      showToast(msg, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  input?.focus();
}

/** Delegated so the sidebar's "Join a class" link works on every student page. */
function bindJoinClassSidebarLink() {
  if (document.body.dataset.joinClassLinkBound === "1") return;
  document.body.dataset.joinClassLinkBound = "1";
  document.addEventListener("click", (event) => {
    const link = event.target.closest('[data-action="join-class"]');
    if (!link) return;
    event.preventDefault();
    openJoinClassModal();
  });
}
bindJoinClassSidebarLink();

async function regenerateSubjectJoinCode(subjectId) {
  const teacher = getCurrentUserSession();
  const teacherId = String(teacher?.id_number || "").trim();
  if (!teacherId) {
    showToast("Please sign in as a teacher.", "error");
    return null;
  }
  const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}/regenerate-code`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ teacher_id_number: teacherId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not regenerate code.");
  }
  return data;
}

function buildTeacherJoinCodeBlockHtml(subject) {
  const safeId = String(subject.id || "").replace(/'/g, "\\'");
  const code = String(subject.join_code || "").trim();
  if (!code) {
    return `
      <div class="subject-join-code-block teacher-subject-join-code">
        <span class="subject-join-code-label">Join code</span>
        <span class="subject-join-code-empty">Not set</span>
        <div class="subject-join-code-actions">
          <button type="button" class="btn btn-secondary btn-small teacher-subject-regen-code" data-subject-id="${safeId}">
            <i class="fa-solid fa-rotate" aria-hidden="true"></i> Generate code
          </button>
        </div>
      </div>`;
  }
  return `
    <div class="subject-join-code-block teacher-subject-join-code">
      <span class="subject-join-code-label">Join code</span>
      <code class="subject-join-code-value" title="Class join code">${escapeHtml(code)}</code>
      <div class="subject-join-code-actions">
        <button type="button" class="btn btn-secondary btn-small teacher-subject-copy-code" data-join-code="${escapeHtml(code)}" title="Copy join code">
          <i class="fa-solid fa-copy" aria-hidden="true"></i> Copy
        </button>
        <button type="button" class="btn btn-secondary btn-small teacher-subject-regen-code" data-subject-id="${safeId}" title="Regenerate code (enrolled students stay)">
          <i class="fa-solid fa-rotate" aria-hidden="true"></i> Regenerate
        </button>
      </div>
    </div>`;
}

function buildSubjectCardHtml(subject, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const showMenu = opts.showMenu !== false;
  const archivedView = !!opts.archivedView;
  const safeId = String(subject.id).replace(/'/g, "\\'");
  const color = subject.color || "#ca8a04";
  const name = subject.name || "Untitled subject";
  const description = subject.description || "Lessons grouped under this subject.";
  const count = Number(subject.published_lesson_count || 0);
  const lessonsLabel = count === 1 ? "1 lesson" : `${count} lessons`;
  const targetUrl = `my-lesson.html?subject_id=${encodeURIComponent(subject.id)}`;
  const status = String(subject.enrollment_status || "active").toLowerCase();
  const teacherName = (subject.teacher_name || subject.teacher_id_number || "").trim();
  const teacherAvatar = (subject.teacher_avatar_data || "").trim();
  const teacherInitials = getUserInitials(teacherName || "Teacher");
  const avatarStyle = teacherAvatar
    ? ` style="background-image:url('${teacherAvatar.replace(/'/g, "%27")}');background-size:cover;background-position:center;"`
    : "";
  const isUnenrolled = archivedView && status === "unenrolled";
  const statusPill =
    status === "archived"
      ? '<span class="lesson-card-pill subject-status-pill"><i class="fa-solid fa-box-archive"></i> Archived</span>'
      : status === "unenrolled"
      ? '<span class="lesson-card-pill subject-status-pill"><i class="fa-solid fa-user-minus"></i> Unenrolled</span>'
      : "";
  const menuHtml = showMenu
    ? `
      <div class="subject-card-menu-wrap">
        <button type="button" class="subject-card-menu-btn" aria-label="Subject options" aria-haspopup="menu" aria-expanded="false" data-subject-menu-toggle="${safeId}">
          <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
        </button>
        <div class="subject-card-menu" role="menu" hidden data-subject-menu="${safeId}">
          <button type="button" role="menuitem" data-subject-action="archive" data-subject-id="${safeId}" data-subject-name="${escapeHtml(name)}">
            <i class="fa-solid fa-box-archive" aria-hidden="true"></i> Archive
          </button>
          <button type="button" role="menuitem" data-subject-action="unenroll" data-subject-id="${safeId}" data-subject-name="${escapeHtml(name)}">
            <i class="fa-solid fa-user-minus" aria-hidden="true"></i> Unenroll
          </button>
        </div>
      </div>`
    : "";
  const bannerTag = isUnenrolled ? "div" : "a";
  const bannerHref = isUnenrolled ? "" : ` href="${targetUrl}"`;

  return `
    <article class="subject-classroom-card" data-subject-id="${safeId}" style="--subject-color: ${escapeHtml(color)};">
      <${bannerTag} class="subject-classroom-card-banner"${bannerHref} aria-label="Open ${escapeHtml(name)}">
        <div class="subject-classroom-card-banner-text">
          <h4>${escapeHtml(name)}</h4>
          <span>${escapeHtml(teacherName || "Subject")}</span>
        </div>
        <div class="subject-classroom-card-avatar"${avatarStyle} aria-hidden="true">${teacherAvatar ? "" : escapeHtml(teacherInitials)}</div>
      </${bannerTag}>
      <div class="subject-classroom-card-body">
        <p class="subject-classroom-card-tagline">${escapeHtml(description)}</p>
        ${statusPill ? `<div class="subject-classroom-card-status-row">${statusPill}</div>` : ""}
      </div>
      <div class="subject-classroom-card-footer">
        <span class="subject-classroom-card-footer-stat" title="${lessonsLabel}">
          <i class="fa-solid fa-layer-group" aria-hidden="true"></i> ${lessonsLabel}
        </span>
        <div class="subject-classroom-card-footer-actions">
          ${
            isUnenrolled
              ? `<span class="btn btn-secondary btn-small" aria-disabled="true">Unenrolled</span>`
              : `<a class="btn btn-primary btn-small" href="${targetUrl}">Open</a>`
          }
          ${menuHtml}
        </div>
      </div>
    </article>
  `;
}

function closeAllSubjectCardMenus() {
  document.querySelectorAll(".subject-card-menu").forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll("[data-subject-menu-toggle]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

async function confirmSubjectEnrollmentAction(subjectName, action) {
  const title =
    action === "archive" ? "Archive this subject?" : "Unenroll from this subject?";
  const message =
    action === "archive"
      ? "Are you sure you want to archive this subject?"
      : `Are you sure you want to unenroll from ${subjectName || "this subject"}? It will be removed from My subjects.`;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    return window.LearnIQConfirm.show({
      title,
      message,
      confirmText: action === "archive" ? "Archive" : "Unenroll",
      cancelText: "Cancel",
      variant: action === "unenroll" ? "danger" : "default",
    });
  }
  return window.confirm(`${title}\n\n${message}`);
}

async function patchStudentSubjectEnrollment(subjectId, action) {
  const studentId = getStudentIdNumberForApi();
  if (!studentId) throw new Error("Please sign in as a student.");
  const response = await fetch(
    apiUrl(`/student/subjects/${encodeURIComponent(subjectId)}/enrollment`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ student_id_number: studentId, action }),
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Could not update enrollment.");
  }
  return data;
}

function applyLessonCountsToSubjects(subjects, lessons) {
  const liveCounts = lessons.reduce((acc, l) => {
    const sid = l.subject_id ? String(l.subject_id) : "";
    if (sid) acc[sid] = (acc[sid] || 0) + 1;
    return acc;
  }, {});
  return subjects.map((s) => ({
    ...s,
    published_lesson_count:
      liveCounts[String(s.id)] != null
        ? liveCounts[String(s.id)]
        : s.published_lesson_count || 0,
  }));
}

async function renderSubjectsPage() {
  const listEl = document.getElementById("subjects-list");
  const selectionEl = document.getElementById("subjects-selection");
  const emptyEl = document.getElementById("subjects-empty");
  const emptyText = document.getElementById("subjects-empty-text");
  if (!listEl || !selectionEl || !emptyEl) return;

  closeAllSubjectCardMenus();

  const studentId = getStudentIdNumberForApi();
  if (!studentId) {
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = "Please sign in as a student to view your subjects.";
    return;
  }

  try {
    const subjectsUrl = apiUrl(
      `/student/subjects?student_id_number=${encodeURIComponent(studentId)}`
    );
    const lessonsUrl = apiUrl(
      `/student/lessons?student_id_number=${encodeURIComponent(studentId)}`
    );
    const [subjectsRes, lessonsRes] = await Promise.all([
      fetch(subjectsUrl, { headers: adminAuthHeaders() }),
      fetch(lessonsUrl, { headers: adminAuthHeaders() }),
    ]);

    let subjects = [];
    if (subjectsRes.ok) {
      const data = await subjectsRes.json();
      subjects = Array.isArray(data.subjects) ? data.subjects : [];
    }

    let lessons = [];
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      lessons = Array.isArray(data.lessons) ? data.lessons : [];
    }

    subjects = applyLessonCountsToSubjects(subjects, lessons);

    if (subjects.length === 0) {
      selectionEl.hidden = true;
      emptyEl.hidden = false;
      if (emptyText) {
        emptyText.textContent =
          "You have not joined any subjects yet. Use \"Join a class\" in the sidebar to enter your teacher's class code.";
      }
      return;
    }

    emptyEl.hidden = true;
    selectionEl.hidden = false;
    listEl.innerHTML = subjects.map((s) => buildSubjectCardHtml(s, { showMenu: true })).join("");
  } catch (e) {
    console.log("DEBUG: renderSubjectsPage failed:", e);
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    if (emptyText) {
      emptyText.textContent = "Cannot reach the Ubuntu API. Set backend URL in Settings (learniq-api-base).";
    }
  }
}

function setupSubjectsPage() {
  console.log("PAGE INIT RUNNING: setupSubjectsPage() called");
  hydrateStudentSidebarChip();
  initRoleAwareDashboardSidebar();
  void hydrateSidebarProfileFromDatabase();

  // "Join a class" now lives in the sidebar (openJoinClassModal, bound
  // globally) instead of a form on this page — see bindJoinClassSidebarLink().

  document.getElementById("subjects-refresh-btn")?.addEventListener("click", () => {
    renderSubjectsPage();
  });

  if (!window.__subjectsPageMenuBound) {
    window.__subjectsPageMenuBound = true;
    document.addEventListener("click", async (event) => {
      const toggle = event.target.closest("[data-subject-menu-toggle]");
      if (toggle) {
        event.preventDefault();
        event.stopPropagation();
        const subjectId = toggle.getAttribute("data-subject-menu-toggle");
        const menu = document.querySelector(`[data-subject-menu="${subjectId}"]`);
        const wasOpen = menu && !menu.hidden;
        closeAllSubjectCardMenus();
        if (menu && !wasOpen) {
          menu.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
        }
        return;
      }

      const actionBtn = event.target.closest("[data-subject-action]");
      if (actionBtn) {
        event.preventDefault();
        closeAllSubjectCardMenus();
        const action = actionBtn.getAttribute("data-subject-action");
        const subjectId = actionBtn.getAttribute("data-subject-id");
        const subjectName = actionBtn.getAttribute("data-subject-name") || "";
        if (!subjectId || !action) return;
        const ok = await confirmSubjectEnrollmentAction(subjectName, action);
        if (!ok) return;
        try {
          await patchStudentSubjectEnrollment(subjectId, action);
          showToast(
            action === "archive"
              ? "Subject archived. It stays in My subjects."
              : "Unenrolled. View it under Archived in the sidebar.",
            "success"
          );
          await renderSubjectsPage();
        } catch (err) {
          showToast(err.message || "Could not update subject.", "error");
        }
        return;
      }

      if (!event.target.closest(".subject-card-menu-wrap")) {
        closeAllSubjectCardMenus();
      }
    });
  }

  void renderSubjectsPage();
}

function buildArchivedLessonCardHtml(lesson, subjectId, canOpen) {
  const lid = String(lesson.file_id || "").replace(/'/g, "\\'");
  const sid = String(subjectId || "").replace(/'/g, "\\'");
  const teacherName = lesson.teacher_name || lesson.teacher_id_number || "Teacher";
  const createdLabel = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "";
  const title = escapeHtml(lesson.filename || "Untitled lesson");
  if (!canOpen) {
    return `
      <article class="lesson-card archived-lesson-card is-disabled">
        <div class="lesson-card-icon"><i class="fa-solid fa-file-lines"></i></div>
        <div class="lesson-info">
          <h4>${title}</h4>
          <p class="small-note archived-lessons-empty">Lesson unavailable — you unenrolled from this subject.</p>
        </div>
      </article>`;
  }
  const openUrl = `my-lesson.html?subject_id=${encodeURIComponent(subjectId)}`;
  return `
    <article class="lesson-card archived-lesson-card">
      <div class="lesson-card-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="lesson-info">
        <h4>${title}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-tag"></i> ${escapeHtml((lesson.file_type || "file").toUpperCase())}</span>
          ${createdLabel ? `<span class="lesson-card-pill"><i class="fa-solid fa-calendar"></i> ${createdLabel}</span>` : ""}
          <span class="lesson-card-pill"><i class="fa-solid fa-user"></i> ${escapeHtml(teacherName)}</span>
        </div>
        <p class="lesson-card-features small-note">Reviewer • Quiz • Activities</p>
      </div>
      <div class="lesson-actions lesson-actions-split">
        <button type="button" class="btn btn-secondary btn-small" onclick="event.stopPropagation(); viewStudentLessonFile('${lid}')">View</button>
        <a class="btn btn-primary btn-small" href="${openUrl}">Open</a>
      </div>
    </article>`;
}

function buildArchivedSubjectBlockHtml(subject, lessons) {
  const status = String(subject.enrollment_status || "archived").toLowerCase();
  const canOpen = status === "archived";
  const sid = String(subject.id);
  const subjectLessons = lessons.filter((l) => String(l.subject_id || "") === sid);
  const cardHtml = buildSubjectCardHtml(subject, { showMenu: false, archivedView: true });
  const lessonsHtml =
    subjectLessons.length > 0
      ? subjectLessons
          .map((l) => buildArchivedLessonCardHtml(l, sid, canOpen))
          .join("")
      : `<p class="small-note archived-lessons-empty">${
          canOpen
            ? "No published lessons for this subject yet."
            : "You unenrolled — lessons are no longer available."
        }</p>`;
  return `
    <section class="archived-subject-block" data-subject-id="${escapeHtml(sid)}">
      ${cardHtml}
      <div class="archived-subject-lessons">
        <h4>Lessons</h4>
        <div class="lesson-grid">${lessonsHtml}</div>
      </div>
    </section>`;
}

async function renderStudentArchivedPage() {
  const root = document.getElementById("archived-subjects-root");
  const emptyEl = document.getElementById("archived-empty");
  const contentEl = document.getElementById("archived-content");
  const emptyText = document.getElementById("archived-empty-text");
  if (!root || !emptyEl || !contentEl) return;

  const studentId = getStudentIdNumberForApi();
  if (!studentId) {
    emptyEl.hidden = false;
    contentEl.hidden = true;
    if (emptyText) emptyText.textContent = "Please sign in as a student to view archived subjects.";
    root.innerHTML = "";
    return;
  }

  try {
    const archivedUrl = apiUrl(
      `/student/subjects/archived?student_id_number=${encodeURIComponent(studentId)}`
    );
    const lessonsUrl = apiUrl(
      `/student/lessons?student_id_number=${encodeURIComponent(studentId)}`
    );
    const [archivedRes, lessonsRes] = await Promise.all([
      fetch(archivedUrl, { headers: adminAuthHeaders() }),
      fetch(lessonsUrl, { headers: adminAuthHeaders() }),
    ]);

    let subjects = [];
    if (archivedRes.ok) {
      const data = await archivedRes.json();
      subjects = Array.isArray(data.subjects) ? data.subjects : [];
    }

    let lessons = [];
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      lessons = Array.isArray(data.lessons) ? data.lessons : [];
    }

    subjects = applyLessonCountsToSubjects(subjects, lessons);

    if (subjects.length === 0) {
      emptyEl.hidden = false;
      contentEl.hidden = true;
      root.innerHTML = "";
      return;
    }

    emptyEl.hidden = true;
    contentEl.hidden = false;
    root.innerHTML = subjects.map((s) => buildArchivedSubjectBlockHtml(s, lessons)).join("");
  } catch (e) {
    console.log("renderStudentArchivedPage failed:", e);
    emptyEl.hidden = false;
    contentEl.hidden = true;
    if (emptyText) {
      emptyText.textContent = "Cannot reach the Ubuntu API. Set backend URL in Settings (learniq-api-base).";
    }
    root.innerHTML = "";
  }
}

function setupStudentArchivedPage() {
  hydrateStudentSidebarChip();
  initRoleAwareDashboardSidebar();
  void hydrateSidebarProfileFromDatabase();

  document.getElementById("archived-refresh-btn")?.addEventListener("click", () => {
    void renderStudentArchivedPage();
  });

  void renderStudentArchivedPage();
}

// ───────────────────────────────────────────────────────────────────────────
// Teacher Subjects page (frontend/teacher-subjects.html) — same lesson-card
// design as student subjects, but lesson counts are scoped to the signed-in
// teacher's own uploads. Clicking a card filters the teacher dashboard.
// ───────────────────────────────────────────────────────────────────────────

function buildTeacherSubjectCardHtml(subject) {
  const safeId = String(subject.id).replace(/'/g, "\\'");
  const color = subject.color || "#ca8a04";
  const name = subject.name || "Untitled subject";
  const description = subject.description || "Lessons grouped under this subject.";
  const myCount = Number(subject.my_lesson_count || 0);
  const publishedCount = Number(subject.my_published_count || 0);
  const myLabel = myCount === 1 ? "1 of your lessons" : `${myCount} of your lessons`;
  const pubLabel = publishedCount === 1 ? "1 published" : `${publishedCount} published`;
  const targetUrl = `teacher-subject-lessons.html?subject_id=${encodeURIComponent(subject.id)}`;
  const isUnassigned = String(subject.id) === "__unassigned__";
  const menuHtml = isUnassigned
    ? ""
    : `
      <div class="subject-card-menu-wrap">
        <button type="button" class="subject-card-menu-btn" aria-label="Subject options" aria-haspopup="menu" aria-expanded="false" data-subject-menu-toggle="${safeId}">
          <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
        </button>
        <div class="subject-card-menu" role="menu" hidden data-subject-menu="${safeId}">
          <button type="button" role="menuitem" class="teacher-subject-upload-trigger" data-subject-id="${safeId}">
            <i class="fa-solid fa-upload" aria-hidden="true"></i> Upload
          </button>
          <button type="button" role="menuitem" class="teacher-subject-delete-trigger" data-subject-id="${safeId}" data-subject-name="${escapeHtml(name)}" data-lesson-count="${myCount}">
            <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
          </button>
        </div>
      </div>`;
  return `
    <article class="lesson-card subject-card-themed${isUnassigned ? "" : " subject-card-with-menu"}" data-subject-id="${safeId}" style="--subject-color: ${escapeHtml(color)};">
      <div class="lesson-card-icon"><i class="fa-solid fa-book-open"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(name)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${myLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-eye"></i> ${pubLabel}</span>
        </div>
        <p class="lesson-card-tagline">${escapeHtml(description)}</p>
        ${isUnassigned ? "" : buildTeacherJoinCodeBlockHtml(subject)}
      </div>
      ${menuHtml}
      <div class="lesson-actions teacher-subject-card-actions">
        <a class="btn btn-primary btn-small teacher-subject-open-btn" href="${targetUrl}">Open Subject</a>
      </div>
    </article>
  `;
}

async function renderTeacherSubjectsPage() {
  const listEl = document.getElementById("teacher-subjects-list");
  const selectionEl = document.getElementById("teacher-subjects-selection");
  const emptyEl = document.getElementById("teacher-subjects-empty");
  const emptyText = document.getElementById("teacher-subjects-empty-text");
  if (!listEl || !selectionEl || !emptyEl) return;

  const currentUser = getCurrentUserSession();
  if (!currentUser || !currentUser.id_number) {
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = "Please sign in as a teacher to view your subjects.";
    return;
  }

  try {
    const ownerParam = encodeURIComponent(currentUser.id_number);
    const [subjectsRes, lessonsRes] = await Promise.all([
      fetch(apiUrl(`/subjects?owner_teacher_id_number=${ownerParam}`)),
      fetch(apiUrl(`/teacher/lessons?teacher_id_number=${ownerParam}`), { headers: adminAuthHeaders() }),
    ]);

    let subjects = [];
    if (subjectsRes.ok) {
      const data = await subjectsRes.json();
      subjects = Array.isArray(data.subjects) ? data.subjects : [];
    }

    let myLessons = [];
    if (lessonsRes.ok) {
      const data = await lessonsRes.json();
      myLessons = Array.isArray(data.lessons) ? data.lessons : [];
    }

    // Count THIS teacher's lessons per subject (total + published).
    const totals = {};
    const published = {};
    for (const lesson of myLessons) {
      const sid = lesson.subject_id ? String(lesson.subject_id).trim() : "";
      if (!sid) continue;
      totals[sid] = (totals[sid] || 0) + 1;
      if (lesson.is_published || lesson.published) {
        published[sid] = (published[sid] || 0) + 1;
      }
    }

    subjects = subjects.map((s) => {
      const key = String(s.id);
      return {
        ...s,
        my_lesson_count: totals[key] || 0,
        my_published_count: published[key] || 0,
      };
    });

    if (subjects.length === 0) {
      selectionEl.hidden = true;
      emptyEl.hidden = false;
      return;
    }

    emptyEl.hidden = true;
    selectionEl.hidden = false;
    listEl.innerHTML = subjects.map(buildTeacherSubjectCardHtml).join("");
  } catch (e) {
    console.log("DEBUG: renderTeacherSubjectsPage failed:", e);
    selectionEl.hidden = true;
    emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = "Cannot reach the Ubuntu API. Set backend URL in Settings (learniq-api-base).";
  }
}

async function teacherDeleteSubject(subjectId, subjectName, lessonCount = 0) {
  const id = String(subjectId || "").trim();
  if (!id || id === "__unassigned__") return;

  const name = String(subjectName || "this subject").trim() || "this subject";
  const total = Number(lessonCount || 0);

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: `Delete "${name}"?`,
      message: total > 0
        ? `${total} of your lesson${total === 1 ? "" : "s"} will no longer be linked to this subject. Continue?`
        : "This subject has no lessons tagged to it. Continue?",
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true,
    });
  } else {
    ok = window.confirm(`Delete "${name}"? This cannot be undone.`);
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(id)}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (status ${res.status}).`);
    }
    showToast(`Subject "${name}" deleted.`, "success");
    await renderTeacherSubjectsPage();
  } catch (e) {
    showToast(e?.message || "Could not delete subject.", "error");
  }
}

window.teacherDeleteSubject = teacherDeleteSubject;

function setupTeacherSubjectsQuickUpload() {
  const quickFileInput = document.getElementById("teacher-subjects-quick-file-input");
  const listEl = document.getElementById("teacher-subjects-list");
  let pendingQuickSubjectId = null;

  const runUpload = async (selectedFile, subjectId) => {
    if (!selectedFile) {
      showToast("Choose a PDF or PPT file first.", "error");
      return;
    }
    if (!subjectId) {
      showToast("Choose a subject for this lesson.", "error");
      return;
    }

    try {
      await uploadFile(selectedFile, subjectId);
      await renderTeacherSubjectsPage();
    } catch (e) {
      const msg =
        e && e.message && String(e.message).includes("fetch")
          ? "Cannot reach API. Start the backend (uvicorn) or check learniq-api-base in localStorage."
          : e.message || "Upload failed";
      showToast(msg, "error");
    }
  };

  quickFileInput?.addEventListener("change", async () => {
    const selectedFile = quickFileInput.files?.[0];
    const subjectId = pendingQuickSubjectId;
    pendingQuickSubjectId = null;
    quickFileInput.value = "";
    if (!selectedFile || !subjectId) return;
    await runUpload(selectedFile, subjectId);
  });

  if (listEl && !listEl.dataset.uploadBound) {
    listEl.dataset.uploadBound = "1";
    listEl.addEventListener("click", (event) => {
      const menuToggle = event.target.closest("[data-subject-menu-toggle]");
      if (menuToggle) {
        event.preventDefault();
        event.stopPropagation();
        const subjectId = menuToggle.getAttribute("data-subject-menu-toggle");
        const menu = listEl.querySelector(`[data-subject-menu="${subjectId}"]`);
        const wasOpen = menu && !menu.hidden;
        closeAllSubjectCardMenus();
        if (menu && !wasOpen) {
          menu.hidden = false;
          menuToggle.setAttribute("aria-expanded", "true");
        }
        return;
      }

      const copyBtn = event.target.closest(".teacher-subject-copy-code");
      if (copyBtn) {
        event.preventDefault();
        event.stopPropagation();
        const code = copyBtn.getAttribute("data-join-code") || "";
        void copyTextToClipboard(code).then((ok) => {
          showToast(ok ? "Join code copied." : "Could not copy code.", ok ? "success" : "error");
        });
        return;
      }

      const regenBtn = event.target.closest(".teacher-subject-regen-code");
      if (regenBtn) {
        event.preventDefault();
        event.stopPropagation();
        const subjectId = regenBtn.getAttribute("data-subject-id") || "";
        if (!subjectId) return;
        const runRegen = async () => {
          try {
            const updated = await regenerateSubjectJoinCode(subjectId);
            showToast(
              updated?.join_code
                ? `New join code: ${updated.join_code}`
                : "Join code regenerated.",
              "success"
            );
            await renderTeacherSubjectsPage();
          } catch (e) {
            showToast(e?.message || "Could not regenerate code.", "error");
          }
        };
        if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
          void window.LearnIQConfirm.show({
            title: "Regenerate join code?",
            message:
              "Students who have not joined yet will need the new code. Students already enrolled stay in this subject.",
            confirmText: "Regenerate",
            cancelText: "Cancel",
          }).then((ok) => {
            if (ok) void runRegen();
          });
        } else {
          if (window.confirm("Regenerate join code? Existing enrollments are kept.")) {
            void runRegen();
          }
        }
        return;
      }

      const deleteTrigger = event.target.closest(".teacher-subject-delete-trigger");
      if (deleteTrigger) {
        event.preventDefault();
        event.stopPropagation();
        closeAllSubjectCardMenus();
        void teacherDeleteSubject(
          deleteTrigger.getAttribute("data-subject-id") || "",
          deleteTrigger.getAttribute("data-subject-name") || "",
          deleteTrigger.getAttribute("data-lesson-count") || "0",
        );
        return;
      }

      const trigger = event.target.closest(".teacher-subject-upload-trigger");
      if (!trigger || !quickFileInput) return;
      event.preventDefault();
      event.stopPropagation();
      closeAllSubjectCardMenus();
      pendingQuickSubjectId = trigger.getAttribute("data-subject-id") || "";
      quickFileInput.click();
    });
  }

  if (document.body.dataset.teacherSubjectMenusBound !== "1") {
    document.body.dataset.teacherSubjectMenusBound = "1";
    document.addEventListener("click", (event) => {
      if (event.target.closest(".subject-card-menu-wrap")) return;
      closeAllSubjectCardMenus();
    });
  }
}

function updateTeacherSubjectPageStats(yourLessons, publishedSource) {
  const total = (yourLessons || []).length;
  const unpublished = getTeacherSubjectUnpublishedLessons(yourLessons);
  const pubList = publishedSource || yourLessons || [];
  const published = pubList.filter((l) => isTeacherLessonPublished(l)).length;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText("teacher-stat-lessons", String(total));
  setText(
    "teacher-stat-lessons-note",
    total === 0
      ? "Upload your first lesson in the Upload tab"
      : total === 1
        ? "1 lesson file"
        : `${total} lesson files`,
  );
  setText("teacher-stat-published", String(published));
  setText(
    "teacher-stat-published-note",
    published === 0 ? "Nothing published yet" : `${published} visible to students`,
  );
  setText("teacher-subject-tab-count-lessons", String(unpublished.length));
  setText("teacher-subject-tab-count-published", String(published));
}

let activeTeacherSubjectTab = "stream";

function setTeacherSubjectActiveTab(tab) {
  const valid = ["stream", "upload", "lessons", "published"];
  const next = valid.includes(tab) ? tab : "stream";
  activeTeacherSubjectTab = next;

  document.querySelectorAll(".workspace-tab[data-teacher-subject-tab]").forEach((btn) => {
    const key = btn.getAttribute("data-teacher-subject-tab");
    const isActive = key === next;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const panels = {
    stream: document.getElementById("teacher-subject-panel-stream"),
    upload: document.getElementById("teacher-subject-panel-upload"),
    lessons: document.getElementById("teacher-subject-panel-lessons"),
    published: document.getElementById("teacher-subject-panel-published"),
  };
  Object.entries(panels).forEach(([key, el]) => {
    if (!el) return;
    el.hidden = key !== next;
  });
}

function setupTeacherSubjectLessonsTabs() {
  if (!document.body?.classList?.contains("teacher-subject-lessons-page")) return;
  document.querySelectorAll(".workspace-tab[data-teacher-subject-tab]").forEach((btn) => {
    if (btn.dataset.subjectTabBound === "1") return;
    btn.dataset.subjectTabBound = "1";
    btn.addEventListener("click", () => {
      setTeacherSubjectActiveTab(btn.getAttribute("data-teacher-subject-tab"));
    });
  });
  setTeacherSubjectActiveTab(activeTeacherSubjectTab);
}

async function hydrateTeacherSubjectLessonsPage() {
  const subjectId = getTeacherDashboardSubjectFilter();
  if (!subjectId) return;

  const titleEl = document.getElementById("teacher-subject-page-title");
  const subtitleEl = document.getElementById("teacher-subject-page-subtitle");
  const uploadLabel = document.getElementById("teacher-subject-upload-label");
  const joinWrap = document.getElementById("teacher-subject-page-join");
  const codeStat = document.getElementById("teacher-stat-join-code");

  try {
    const res = await fetch(apiUrl("/subjects"));
    if (!res.ok) return;
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const match = subjects.find((s) => String(s.id) === String(subjectId));
    if (!match) {
      if (titleEl) titleEl.textContent = "Subject not found";
      if (subtitleEl) subtitleEl.textContent = "This subject may have been removed. Go back to My Subjects.";
      return;
    }

    const name = match.name || "Subject";
    if (titleEl) titleEl.textContent = name;
    if (subtitleEl) {
      subtitleEl.textContent =
        match.description || "Upload lessons here. They are tagged to this subject automatically.";
    }
    if (uploadLabel) uploadLabel.textContent = name;

    const bannerEl = document.getElementById("teacher-subject-banner");
    if (bannerEl) {
      bannerEl.style.setProperty("--subject-banner-color", match.color || DEFAULT_SUBJECT_COLOR);
    }

    const code = String(match.join_code || "").trim();
    if (codeStat) codeStat.textContent = code || "—";

    if (joinWrap && code) {
      joinWrap.hidden = false;
      joinWrap.innerHTML = `
        <div class="teacher-subject-page-join-inner">
          <span class="small-note">Students join with</span>
          <code class="subject-join-code-value">${escapeHtml(code)}</code>
          <button type="button" class="btn btn-secondary btn-small teacher-subject-page-copy-code" data-join-code="${escapeHtml(code)}">
            <i class="fa-solid fa-copy"></i> Copy code
          </button>
        </div>`;
      const copyBtn = joinWrap.querySelector(".teacher-subject-page-copy-code");
      copyBtn?.addEventListener("click", () => {
        void copyTextToClipboard(code).then((ok) => {
          showToast(ok ? "Join code copied." : "Could not copy.", ok ? "success" : "error");
        });
      });
    }
  } catch (e) {
    console.log("hydrateTeacherSubjectLessonsPage:", e);
  }
}

function bindTeacherSubjectLessonUploadForm() {
  const fileInput = document.querySelector("#file-input");
  const fileMeta = document.querySelector("#file-meta");
  const clearBtn = document.getElementById("file-clear-btn");
  const uploadForm = document.querySelector("#upload-form");
  const subjectId = getTeacherDashboardUploadSubjectId();

  if (!subjectId) return;
  // Guard against double-binding: this function can be called more than once
  // per page load, and without this, each extra bind adds another "submit"
  // listener — one Upload click then fires N uploads of the same file.
  if (!uploadForm || uploadForm.dataset.bound === "1") return;
  uploadForm.dataset.bound = "1";

  if (fileMeta) fileMeta.textContent = "No file selected yet.";

  fileInput?.addEventListener("change", () => {
    const selectedFile = fileInput?.files?.[0];
    if (!fileMeta) return;
    if (!selectedFile) {
      fileMeta.textContent = "No file selected yet.";
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    fileMeta.textContent = `Selected: ${selectedFile.name}`;
    if (clearBtn) clearBtn.hidden = false;
  });

  clearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (fileInput) fileInput.value = "";
    if (fileMeta) fileMeta.textContent = "No file selected yet.";
    clearBtn.hidden = true;
  });

  uploadForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selectedFile = fileInput?.files?.[0];
    if (!selectedFile) {
      if (fileMeta) fileMeta.textContent = "Choose a PDF or PPT file first.";
      return;
    }
    if (fileMeta) fileMeta.textContent = `Uploading ${selectedFile.name}…`;
    try {
      await uploadFile(selectedFile, subjectId);
      if (fileMeta) fileMeta.textContent = `Uploaded to this subject: ${selectedFile.name}`;
      if (fileInput) fileInput.value = "";
      if (clearBtn) clearBtn.hidden = true;
      await loadTeacherDashboardLessons();
      setTeacherSubjectActiveTab("lessons");
    } catch (e) {
      if (fileMeta) fileMeta.textContent = "Upload failed. Try again.";
      showToast(e?.message || "Upload failed", "error");
    }
  });
}

async function loadTeacherSubjectLessonsPage() {
  const subjectId = getTeacherDashboardSubjectFilter();
  if (!subjectId) return;
  await loadTeacherDashboardLessons();
}

/** Shared feed-item markup for Class Stream (teacher + student). Must stay
 *  top-level — teacher-subject-lessons.html never calls setupStudentDashboard(). */
function formatAnnouncementDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return d.toISOString().slice(0, 16);
  }
}

function renderAnnouncementCommentHtml(c) {
  const name = (c.author_name || "Someone").trim();
  const initials = getUserInitials(name);
  const when = formatAnnouncementDate(c.created_at);
  return `
    <div class="subject-announcement-comment">
      <div class="subject-announcement-comment-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
      <div class="subject-announcement-comment-body">
        <strong>${escapeHtml(name)}</strong> <span class="small-note">${escapeHtml(when)}</span>
        <p>${escapeHtml(c.body || "")}</p>
      </div>
    </div>`;
}

/** Role-aware URL to open a lesson's original file (used by Class stream attachment cards). */
function announcementLessonFileUrl(lessonId) {
  const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  const role = String(user?.role || "").trim().toLowerCase();
  return role === "teacher" ? teacherLessonFileViewUrl(lessonId) : studentLessonFileViewUrl(lessonId);
}

function renderAnnouncementLessonCardHtml(lesson) {
  if (!lesson || !lesson.id) return "";
  const ext = String(lesson.file_type || "").replace(/^\./, "").toUpperCase() || "FILE";
  const icon = ext === "PDF" ? "fa-file-pdf" : ext === "PPT" || ext === "PPTX" ? "fa-file-powerpoint" : "fa-file-lines";
  const url = announcementLessonFileUrl(lesson.id);
  return `
    <a class="subject-announcement-lesson-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
      <div class="subject-announcement-lesson-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></div>
      <div class="subject-announcement-lesson-meta">
        <strong>${escapeHtml(lesson.filename || "Lesson file")}</strong>
        <span class="small-note">${escapeHtml(ext)}${lesson.is_published ? "" : " · Unpublished"}</span>
      </div>
    </a>`;
}

function renderAnnouncementFeedHtml(announcements) {
  const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  const canManage = String(user?.role || "").trim().toLowerCase() === "teacher";
  return (announcements || [])
    .map((a) => {
      const name = (a.teacher_name || "Teacher").trim();
      const initials = getUserInitials(name);
      const when = formatAnnouncementDate(a.created_at);
      const comments = Array.isArray(a.comments) ? a.comments : [];
      const commentCount = a.comment_count ?? comments.length;
      const reactionCount = a.reaction_count ?? 0;
      const reacted = !!a.viewer_reacted;
      const aid = escapeHtml(String(a.id));
      const sid = escapeHtml(String(a.subject_id || ""));
      const menuHtml = canManage
        ? `
        <div class="subject-card-menu-wrap subject-announcement-menu-wrap">
          <button type="button" class="subject-card-menu-btn" aria-label="Post options" aria-haspopup="menu" aria-expanded="false" data-announcement-menu-toggle="${aid}">
            <i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i>
          </button>
          <div class="subject-card-menu" role="menu" hidden data-announcement-menu="${aid}">
            <button type="button" role="menuitem" class="teacher-subject-delete-trigger" data-announcement-delete data-announcement-id="${aid}" data-subject-id="${sid}">
              <i class="fa-solid fa-trash" aria-hidden="true"></i> Delete
            </button>
          </div>
        </div>`
        : "";
      return `
      <article class="subject-announcement-item" data-announcement-id="${aid}" data-subject-id="${sid}">
        <div class="subject-announcement-head">
          <div class="subject-announcement-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
          <div class="subject-announcement-meta">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(when)}</span>
          </div>
          ${menuHtml}
        </div>
        <div class="subject-announcement-body">${escapeHtml(a.body || "")}</div>
        ${renderAnnouncementLessonCardHtml(a.lesson)}
        <div class="subject-announcement-actions">
          <button type="button" class="subject-announcement-like-btn${reacted ? " is-active" : ""}" data-announcement-react-btn aria-pressed="${reacted ? "true" : "false"}">
            <i class="fa-solid fa-heart" aria-hidden="true"></i>
            <span class="subject-announcement-like-count">${reactionCount}</span>
          </button>
          <span class="subject-announcement-comment-count">
            <i class="fa-regular fa-comment" aria-hidden="true"></i> ${commentCount} comment${commentCount === 1 ? "" : "s"}
          </span>
        </div>
        <div class="subject-announcement-comments">${comments.map(renderAnnouncementCommentHtml).join("")}</div>
        <form class="subject-announcement-comment-form" data-announcement-comment-form>
          <input type="text" class="form-input" placeholder="Add a comment…" maxlength="2000" required />
          <button type="submit" class="btn btn-secondary btn-sm" aria-label="Post comment">
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
          </button>
        </form>
      </article>`;
    })
    .join("");
}

/** Delegated so it keeps working after every innerHTML re-render of a feed. */
function closeAllAnnouncementMenus() {
  document.querySelectorAll("[data-announcement-menu]").forEach((menu) => {
    menu.hidden = true;
  });
  document.querySelectorAll("[data-announcement-menu-toggle]").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

function applyAnnouncementFeedHtml(feedEl, announcements) {
  if (!feedEl) return;
  const list = Array.isArray(announcements) ? announcements : [];
  const emptyEl =
    feedEl.id === "teacher-announcements-feed"
      ? document.getElementById("teacher-announcements-empty")
      : document.getElementById("subject-announcements-empty");
  if (!list.length) {
    feedEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  feedEl.innerHTML = renderAnnouncementFeedHtml(list);
}

function bindAnnouncementFeedInteractions() {
  if (document.body.dataset.announcementInteractionsBound === "1") return;
  document.body.dataset.announcementInteractionsBound = "1";

  document.addEventListener("click", async (event) => {
    const menuToggle = event.target.closest("[data-announcement-menu-toggle]");
    if (menuToggle) {
      event.preventDefault();
      event.stopPropagation();
      const aid = menuToggle.getAttribute("data-announcement-menu-toggle");
      const menu = document.querySelector(`[data-announcement-menu="${aid}"]`);
      const wasOpen = menu && !menu.hidden;
      closeAllAnnouncementMenus();
      if (typeof closeAllSubjectCardMenus === "function") closeAllSubjectCardMenus();
      if (menu && !wasOpen) {
        menu.hidden = false;
        menuToggle.setAttribute("aria-expanded", "true");
      }
      return;
    }

    const deleteBtn = event.target.closest("[data-announcement-delete]");
    if (deleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      closeAllAnnouncementMenus();
      const subjectId = deleteBtn.getAttribute("data-subject-id") || "";
      const announcementId = deleteBtn.getAttribute("data-announcement-id") || "";
      if (!subjectId || !announcementId) return;
      const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
      if (!user?.access_token) {
        showToast("Sign in required.", "error");
        return;
      }
      let ok = false;
      if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
        ok = await window.LearnIQConfirm.show({
          title: "Delete this post?",
          message: "This announcement will be removed from the class stream. This cannot be undone.",
          confirmText: "Delete",
          cancelText: "Cancel",
          variant: "danger",
        });
      } else {
        ok = window.confirm("Delete this post? This cannot be undone.");
      }
      if (!ok) return;
      try {
        const res = await fetch(
          apiUrl(`/subjects/${encodeURIComponent(subjectId)}/announcements/${encodeURIComponent(announcementId)}`),
          { method: "DELETE", headers: { Authorization: `Bearer ${user.access_token}` } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not delete post.");
        const article = deleteBtn.closest(".subject-announcement-item");
        const feedEl = article?.closest(".subject-announcements-feed");
        applyAnnouncementFeedHtml(feedEl, data.announcements);
        showToast("Post deleted.", "success");
      } catch (e) {
        showToast(e.message || "Could not delete post.", "error");
      }
      return;
    }

    if (!event.target.closest(".subject-announcement-menu-wrap")) {
      closeAllAnnouncementMenus();
    }

    const btn = event.target.closest("[data-announcement-react-btn]");
    if (!btn) return;
    const article = btn.closest(".subject-announcement-item");
    const subjectId = article?.dataset.subjectId;
    const announcementId = article?.dataset.announcementId;
    if (!subjectId || !announcementId) return;
    const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    if (!user?.access_token) {
      showToast("Sign in required.", "error");
      return;
    }
    btn.disabled = true;
    try {
      const res = await fetch(
        apiUrl(`/subjects/${encodeURIComponent(subjectId)}/announcements/${encodeURIComponent(announcementId)}/react`),
        { method: "POST", headers: { Authorization: `Bearer ${user.access_token}` } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not react.");
      btn.classList.toggle("is-active", !!data.reacted);
      btn.setAttribute("aria-pressed", data.reacted ? "true" : "false");
      const countEl = btn.querySelector(".subject-announcement-like-count");
      if (countEl) countEl.textContent = String(data.reaction_count ?? 0);
    } catch (e) {
      showToast(e.message || "Could not react.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-announcement-comment-form]");
    if (!form) return;
    event.preventDefault();
    const article = form.closest(".subject-announcement-item");
    const feedContainer = form.closest(".subject-announcements-feed");
    const subjectId = article?.dataset.subjectId;
    const announcementId = article?.dataset.announcementId;
    const input = form.querySelector("input");
    const text = (input?.value || "").trim();
    if (!subjectId || !announcementId || !text || !feedContainer) return;

    const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    if (!user?.access_token) {
      showToast("Sign in required.", "error");
      return;
    }
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch(
        apiUrl(`/subjects/${encodeURIComponent(subjectId)}/announcements/${encodeURIComponent(announcementId)}/comments`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.access_token}` },
          body: JSON.stringify({ body: text }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not post comment.");
      const announcements = Array.isArray(data.announcements) ? data.announcements : [];
      feedContainer.innerHTML = renderAnnouncementFeedHtml(announcements);
    } catch (e) {
      showToast(e.message || "Could not post comment.", "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

let lastLoadedSubjectAnnouncementsId = null;

/** Stream tab feed (student read-only view). */
async function loadSubjectAnnouncements(subjectId) {
  const feedEl = document.getElementById("subject-announcements-feed");
  const emptyEl = document.getElementById("subject-announcements-empty");
  if (!feedEl) return;

  if (!subjectId || String(subjectId) === "__unassigned__") {
    feedEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = true;
    lastLoadedSubjectAnnouncementsId = null;
    return;
  }
  if (lastLoadedSubjectAnnouncementsId === String(subjectId)) return;
  lastLoadedSubjectAnnouncementsId = String(subjectId);

  const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  if (!user?.access_token) return;

  try {
    const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}/announcements`), {
      headers: { Authorization: `Bearer ${user.access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load announcements.");
    const announcements = Array.isArray(data.announcements) ? data.announcements : [];
    if (!announcements.length) {
      feedEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    feedEl.innerHTML = renderAnnouncementFeedHtml(announcements);
  } catch (e) {
    lastLoadedSubjectAnnouncementsId = null;
    feedEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = e.message || "Could not load announcements.";
    }
  }
}

/** Teacher's own Class stream: post + feed for the subject in the URL. */
async function loadTeacherAnnouncements() {
  const subjectId = getTeacherDashboardSubjectFilter();
  const feedEl = document.getElementById("teacher-announcements-feed");
  const emptyEl = document.getElementById("teacher-announcements-empty");
  if (!subjectId || !feedEl) return;

  const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  if (!user?.access_token) return;

  try {
    const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}/announcements`), {
      headers: { Authorization: `Bearer ${user.access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load announcements.");
    const announcements = Array.isArray(data.announcements) ? data.announcements : [];
    if (!announcements.length) {
      feedEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    feedEl.innerHTML = renderAnnouncementFeedHtml(announcements);
  } catch (e) {
    feedEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = e.message || "Could not load announcements.";
    }
  }
}

function bindTeacherAnnouncementForm() {
  const form = document.getElementById("teacher-announcement-form");
  const textEl = document.getElementById("teacher-announcement-text");
  const postBtn = document.getElementById("teacher-announcement-post-btn");
  const fileInput = document.getElementById("teacher-announcement-file-input");
  const attachBtn = document.getElementById("teacher-announcement-attach-btn");
  const fileNameEl = document.getElementById("teacher-announcement-file-name");
  const fileClearBtn = document.getElementById("teacher-announcement-file-clear");

  const clearAttachedFile = () => {
    if (fileInput) fileInput.value = "";
    if (fileNameEl) {
      fileNameEl.hidden = true;
      fileNameEl.textContent = "";
    }
    if (fileClearBtn) fileClearBtn.hidden = true;
  };

  if (attachBtn && attachBtn.dataset.bound !== "1") {
    attachBtn.dataset.bound = "1";
    attachBtn.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", () => {
      const f = fileInput.files?.[0];
      if (!f) {
        clearAttachedFile();
        return;
      }
      if (fileNameEl) {
        fileNameEl.textContent = f.name;
        fileNameEl.hidden = false;
      }
      if (fileClearBtn) fileClearBtn.hidden = false;
    });
    fileClearBtn?.addEventListener("click", clearAttachedFile);
  }

  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const subjectId = getTeacherDashboardSubjectFilter();
    const text = (textEl?.value || "").trim();
    if (!subjectId || !text) return;

    const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    if (!user?.access_token) {
      showToast("Sign in required.", "error");
      return;
    }

    const attachedFile = fileInput?.files?.[0] || null;
    const originalBtnHtml = postBtn?.innerHTML;
    if (postBtn) {
      postBtn.disabled = true;
      if (attachedFile) postBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Uploading & posting…`;
    }
    try {
      // One click, two calls under the hood: upload the file (same pipeline as
      // the Upload tab — text extraction runs here; AI quiz/reviewer generation
      // stays a separate explicit step) then attach its id to the post.
      let lessonId = null;
      if (attachedFile) {
        const uploaded = await uploadFile(attachedFile, getTeacherDashboardUploadSubjectId() || subjectId);
        lessonId = uploaded?.file_id || null;
      }

      const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}/announcements`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.access_token}`,
        },
        body: JSON.stringify({ body: text, lesson_id: lessonId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not post announcement.");

      const feedEl = document.getElementById("teacher-announcements-feed");
      const emptyEl = document.getElementById("teacher-announcements-empty");
      const announcements = Array.isArray(data.announcements) ? data.announcements : [];
      if (feedEl) feedEl.innerHTML = renderAnnouncementFeedHtml(announcements);
      if (emptyEl) emptyEl.hidden = announcements.length > 0;

      if (textEl) textEl.value = "";
      clearAttachedFile();
      showToast("Announcement posted.", "success");
    } catch (e) {
      showToast(e.message || "Could not post announcement.", "error");
    } finally {
      if (postBtn) {
        postBtn.disabled = false;
        if (originalBtnHtml) postBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}

function setupTeacherSubjectLessonsPage() {
  const subjectId = getTeacherDashboardSubjectFilter();
  if (!subjectId || subjectId === "__unassigned__") {
    window.location.replace("teacher-subjects.html");
    return;
  }

  ensureTeacherSidebarNav();
  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();

  void hydrateTeacherSubjectLessonsPage();
  setupTeacherSubjectLessonsTabs();
  bindTeacherSubjectLessonUploadForm();
  bindTeacherAnnouncementForm();
  bindAnnouncementFeedInteractions();
  void loadTeacherSubjectLessonsPage();
  void loadTeacherAnnouncements();
}

function setupTeacherSubjectsPage() {
  console.log("PAGE INIT RUNNING: setupTeacherSubjectsPage() called");
  ensureTeacherSidebarNav();
  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();

  document.getElementById("teacher-subjects-refresh-btn")?.addEventListener("click", () => {
    renderTeacherSubjectsPage();
  });

  setupTeacherAddSubjectForm();
  setupTeacherSubjectsQuickUpload();

  void renderTeacherSubjectsPage();
}

// ───────────────────────────────────────────────────────────────────────────
// Admin Subjects page (frontend/admin-subjects.html) — drill-down flow:
//   Default view      → Teacher profile cards
//   ?teacher_id=X     → Subjects for that teacher (only subjects they teach)
//   ?teacher_id=X
//     &subject_id=Y   → Lessons by that teacher under that subject
//
// The page also retains an "Add Subject" modal in the header for global
// subject management (subjects are school-wide and shared across teachers).
// ───────────────────────────────────────────────────────────────────────────

let adminSubjectsCache = [];
let adminTeachersCache = [];
let adminAllLessonsCache = [];
const UNASSIGNED_SUBJECT_ID = "__unassigned__";

function getAdminSubjectsViewParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    teacherId: (params.get("teacher_id") || "").trim(),
    subjectId: (params.get("subject_id") || "").trim(),
  };
}

function teacherInitialsFromName(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "T";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildAdminTeacherCardHtml(teacher, lessonStats) {
  const tid = String(teacher.id_number || "").replace(/'/g, "\\'");
  const safeTid = escapeHtml(teacher.id_number || "");
  const firstName = teacher.first_name || "";
  const lastName = teacher.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim() || teacher.email || "Unnamed Teacher";
  const initials = teacherInitialsFromName(fullName);
  const subjectCount = Number(lessonStats?.subject_count || 0);
  const lessonCount = Number(lessonStats?.lesson_count || 0);
  const publishedCount = Number(lessonStats?.published_count || 0);
  const subjectLabel = subjectCount === 1 ? "1 subject" : `${subjectCount} subjects`;
  const lessonLabel = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;
  const publishedLabel = publishedCount === 1 ? "1 published" : `${publishedCount} published`;
  const drillUrl = `admin-subjects.html?teacher_id=${encodeURIComponent(teacher.id_number || "")}`;
  return `
    <article class="lesson-card subject-card-themed admin-teacher-card" data-teacher-id="${safeTid}" style="--subject-color: #60a5fa;" onclick="window.location.href='${drillUrl}'">
      <div class="lesson-card-icon admin-teacher-card-avatar">${escapeHtml(initials)}</div>
      <div class="lesson-info">
        <h4>${escapeHtml(fullName)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-book-open"></i> ${subjectLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${lessonLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-eye"></i> ${publishedLabel}</span>
        </div>
        <p class="lesson-card-tagline">ID No.: ${safeTid || "—"}</p>
        <p class="lesson-card-features small-note">Tap to view this teacher's subjects.</p>
      </div>
      <div class="lesson-actions">
        <button type="button" class="btn btn-primary btn-small" onclick="event.stopPropagation(); window.location.href='${drillUrl}'">
          <i class="fa-solid fa-arrow-right"></i> Open Subjects
        </button>
      </div>
    </article>
  `;
}

function buildAdminSubjectDrillCardHtml(subject, teacherIdNumber, stats) {
  const safeSid = String(subject.id).replace(/'/g, "\\'");
  const color = subject.color || "#ca8a04";
  const name = subject.name || "Untitled subject";
  const description = subject.description || "No description set.";
  const lessonCount = Number(stats?.lesson_count || 0);
  const publishedCount = Number(stats?.published_count || 0);
  const lessonLabel = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;
  const publishedLabel = publishedCount === 1 ? "1 published" : `${publishedCount} published`;
  const drillUrl = `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber || "")}&subject_id=${encodeURIComponent(subject.id || "")}`;
  return `
    <article class="lesson-card subject-card-themed" data-subject-id="${safeSid}" style="--subject-color: ${escapeHtml(color)};" onclick="window.location.href='${drillUrl}'">
      <div class="lesson-card-icon"><i class="fa-solid fa-book-open"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(name)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-layer-group"></i> ${lessonLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-eye"></i> ${publishedLabel}</span>
        </div>
        <p class="lesson-card-tagline">${escapeHtml(description)}</p>
        <p class="lesson-card-features small-note">Tap to see this teacher's lessons.</p>
      </div>
      <div class="lesson-actions">
        <button type="button" class="btn btn-primary btn-small" onclick="event.stopPropagation(); window.location.href='${drillUrl}'">
          <i class="fa-solid fa-arrow-right"></i> Open Lessons
        </button>
      </div>
    </article>
  `;
}

function describeAdminLessonFileType(fileTypeRaw) {
  const ext = String(fileTypeRaw || "").trim().toLowerCase().replace(/^\./, "");
  if (ext === "pdf") {
    return { label: "PDF", icon: "fa-file-pdf", className: "lesson-pill-pdf" };
  }
  if (ext === "ppt" || ext === "pptx") {
    return { label: "PPTX", icon: "fa-file-powerpoint", className: "lesson-pill-ppt" };
  }
  if (ext === "doc" || ext === "docx") {
    return { label: "DOCX", icon: "fa-file-word", className: "lesson-pill-doc" };
  }
  if (ext === "txt") {
    return { label: "TXT", icon: "fa-file-lines", className: "lesson-pill-txt" };
  }
  return { label: (ext || "FILE").toUpperCase(), icon: "fa-file", className: "lesson-pill-generic" };
}

function describeAdminLessonActivities(lessonContent) {
  const acts = lessonContent && Array.isArray(lessonContent.activities) ? lessonContent.activities : [];
  if (!acts.length) return { count: 0, label: "None" };
  const first = acts[0];
  if (first && first.activity_type === "flashcards" && Array.isArray(first.cards)) {
    const n = first.cards.length;
    return { count: n, label: `${n} flashcard${n === 1 ? "" : "s"}` };
  }
  if (first && first.activity_type === "essay") {
    return { count: acts.length, label: `${acts.length} essay prompt${acts.length === 1 ? "" : "s"}` };
  }
  return { count: acts.length, label: `${acts.length} item${acts.length === 1 ? "" : "s"}` };
}

// ============================================================
// Admin lesson preview modal
// ------------------------------------------------------------
// Opens a modal showing a lesson's reviewer (rendered markdown),
// quiz items, and activities — invoked from clickable lesson
// cards on admin-subjects.html.
// ============================================================

let _adminLessonPreviewCache = new Map(); // file_id -> lesson list-item (incl. lesson_content)

function _adminLessonPreviewEls() {
  return {
    modal: document.getElementById("admin-lesson-preview-modal"),
    title: document.getElementById("admin-lesson-preview-title"),
    summary: document.getElementById("admin-lesson-preview-summary"),
    paneReviewer: document.getElementById("admin-lesson-preview-pane-reviewer"),
    paneQuiz: document.getElementById("admin-lesson-preview-pane-quiz"),
    paneActivities: document.getElementById("admin-lesson-preview-pane-activities"),
  };
}

function closeAdminLessonPreviewModal() {
  const { modal } = _adminLessonPreviewEls();
  if (!modal) return;
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", _adminLessonPreviewOnKey);
}

function _adminLessonPreviewOnKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeAdminLessonPreviewModal();
  }
}

function _adminLessonPreviewSwitchTab(tab) {
  const wanted = String(tab || "reviewer");
  document.querySelectorAll("[data-admin-preview-tab]").forEach((btn) => {
    const on = btn.getAttribute("data-admin-preview-tab") === wanted;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll("[data-admin-preview-pane]").forEach((pane) => {
    pane.hidden = pane.getAttribute("data-admin-preview-pane") !== wanted;
  });
}

function _adminLessonPreviewWireOnce() {
  if (typeof document === "undefined") return;
  if (document.body && document.body.dataset.adminLessonPreviewWired === "1") return;
  const { modal } = _adminLessonPreviewEls();
  if (!modal) return;
  if (document.body) document.body.dataset.adminLessonPreviewWired = "1";

  modal.querySelectorAll(".admin-lesson-preview-close").forEach((btn) => {
    btn.addEventListener("click", closeAdminLessonPreviewModal);
  });
  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) closeAdminLessonPreviewModal();
  });

  modal.querySelectorAll("[data-admin-preview-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-admin-preview-tab");
      if (t) _adminLessonPreviewSwitchTab(t);
    });
  });
}

function _renderAdminLessonReviewer(target, reviewer) {
  if (!target) return;
  const text = String(reviewer || "").trim();
  if (!text) {
    target.innerHTML = '<p class="small-note">No reviewer generated for this lesson yet.</p>';
    return;
  }
  if (typeof mountReviewerMarkdownInto === "function") {
    target.innerHTML = '<div class="reviewer-markdown-body reviewer-mount"></div>';
    const mountPoint = target.querySelector(".reviewer-mount");
    mountReviewerMarkdownInto(mountPoint, reviewer);
  } else {
    target.innerHTML = `<p>${escapeHtml(text)}</p>`;
  }
}

function _renderAdminLessonQuiz(target, quiz) {
  if (!target) return;
  const items = Array.isArray(quiz) ? quiz : [];
  if (!items.length) {
    target.innerHTML = '<p class="small-note">No quiz questions for this lesson yet.</p>';
    return;
  }
  const letters = ["A", "B", "C", "D", "E", "F"];
  target.innerHTML = `
    <ol class="admin-lesson-quiz-list">
      ${items
        .map((q) => {
          const question = String(q?.question || "").trim();
          const choices = Array.isArray(q?.choices) ? q.choices : [];
          const answer = q?.answer == null ? "" : String(q.answer);
          const choiceHtml = choices
            .map(
              (c, i) =>
                `<li class="${letters[i] === answer ? "admin-quiz-correct" : ""}">
                  <span class="admin-quiz-letter">${letters[i] || i + 1}.</span>
                  ${escapeHtml(String(c))}
                  ${letters[i] === answer ? '<i class="fa-solid fa-check admin-quiz-check"></i>' : ""}
                </li>`
            )
            .join("");
          return `
            <li class="admin-lesson-quiz-item">
              <p class="admin-lesson-quiz-question">${escapeHtml(question || "(no question text)")}</p>
              <ul class="admin-lesson-quiz-choices">${choiceHtml || "<li class=\"small-note\">No choices listed</li>"}</ul>
              <p class="small-note admin-quiz-answer">Correct answer: <strong>${escapeHtml(answer || "—")}</strong></p>
            </li>`;
        })
        .join("")}
    </ol>`;
}

function _renderAdminLessonActivities(target, activities) {
  if (!target) return;
  if (typeof renderActivitiesInto === "function") {
    renderActivitiesInto(target, activities);
  } else {
    target.innerHTML = '<p class="small-note">Activity renderer unavailable.</p>';
  }
}

async function openAdminLessonPreviewModal(lessonId, fallbackData) {
  _adminLessonPreviewWireOnce();
  const { modal, title, summary, paneReviewer, paneQuiz, paneActivities } = _adminLessonPreviewEls();
  if (!modal) return;

  const id = String(lessonId || "").trim();
  if (!id) return;

  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", _adminLessonPreviewOnKey);
  _adminLessonPreviewSwitchTab("reviewer");

  if (title) title.textContent = "Lesson preview";
  if (summary) summary.innerHTML = '<p class="small-note" style="margin:0;">Loading lesson…</p>';
  if (paneReviewer) paneReviewer.innerHTML = '<p class="small-note">Loading…</p>';
  if (paneQuiz) paneQuiz.innerHTML = "";
  if (paneActivities) paneActivities.innerHTML = "";

  // Use cached list-item (already has filename, file_type, is_published, created_at) if available.
  const cached = _adminLessonPreviewCache.get(id) || fallbackData || {};

  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(id)}`));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = typeof data?.error === "string" ? data.error : res.statusText || "Failed to load lesson";
      if (summary) summary.innerHTML = `<p class="small-note" style="margin:0;color:#fb923c;">${escapeHtml(msg)}</p>`;
      if (paneReviewer) paneReviewer.innerHTML = "";
      return;
    }

    const filename = String(data.filename || cached.filename || "Untitled lesson");
    const fileType = cached.file_type || "";
    const isPublished = !!(cached.is_published || cached.published);
    const createdAt = cached.created_at ? new Date(cached.created_at).toLocaleString() : "—";
    const fileMeta = describeAdminLessonFileType(fileType);

    if (title) title.textContent = filename;
    if (summary) {
      summary.innerHTML = `
        <div class="admin-lesson-preview-summary-head">
          <div class="admin-lesson-preview-icon lesson-card-icon-${fileMeta.className.replace("lesson-pill-", "")}">
            <i class="fa-solid ${fileMeta.icon}"></i>
          </div>
          <div class="admin-lesson-preview-headline">
            <h4>${escapeHtml(filename)}</h4>
            <div class="admin-lesson-preview-chips">
              <span class="lesson-card-pill ${fileMeta.className}">
                <i class="fa-solid ${fileMeta.icon}"></i> ${escapeHtml(fileMeta.label)}
              </span>
              <span class="lesson-card-pill ${isPublished ? "lesson-pill-published" : "lesson-pill-draft"}">
                <i class="fa-solid ${isPublished ? "fa-circle-check" : "fa-clock"}"></i> ${isPublished ? "Published" : "Draft"}
              </span>
              <span class="lesson-card-pill lesson-pill-date">
                <i class="fa-solid fa-calendar"></i> ${escapeHtml(createdAt)}
              </span>
            </div>
          </div>
        </div>`;
    }

    _renderAdminLessonReviewer(paneReviewer, data.reviewer);
    _renderAdminLessonQuiz(paneQuiz, data.quiz || []);
    _renderAdminLessonActivities(paneActivities, data.activities || []);
  } catch (err) {
    console.error("openAdminLessonPreviewModal:", err);
    if (summary) summary.innerHTML = `<p class="small-note" style="margin:0;color:#fb923c;">${escapeHtml(err.message || "Could not load lesson.")}</p>`;
  }
}

function buildAdminLessonCardHtml(lesson) {
  const filename = lesson.filename || "Untitled lesson";
  const isPublished = !!(lesson.is_published || lesson.published);
  const createdAt = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "—";
  const quizCount = Number(lesson.quiz_count || 0);
  const hasReviewer = !!lesson.has_reviewer;
  const lessonId = String(lesson.file_id || lesson.id || "").trim();
  const fileMeta = describeAdminLessonFileType(lesson.file_type);
  const activityMeta = describeAdminLessonActivities(lesson.lesson_content);
  return `
    <article
      class="lesson-card lesson-card-clickable"
      data-lesson-id="${escapeHtml(lessonId)}"
      tabindex="0"
      role="button"
      aria-label="Open lesson ${escapeHtml(filename)}">
      <div class="lesson-card-icon lesson-card-icon-${fileMeta.className.replace("lesson-pill-", "")}">
        <i class="fa-solid ${fileMeta.icon}"></i>
      </div>
      <div class="lesson-info">
        <h4>${escapeHtml(filename)}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill ${fileMeta.className}">
            <i class="fa-solid ${fileMeta.icon}"></i> ${escapeHtml(fileMeta.label)}
          </span>
          <span class="lesson-card-pill ${isPublished ? "lesson-pill-published" : "lesson-pill-draft"}">
            <i class="fa-solid ${isPublished ? "fa-circle-check" : "fa-clock"}"></i> ${isPublished ? "Published" : "Draft"}
          </span>
          <span class="lesson-card-pill lesson-pill-date">
            <i class="fa-solid fa-calendar"></i> ${escapeHtml(createdAt)}
          </span>
        </div>
        <div class="lesson-card-stats">
          <span class="lesson-stat ${hasReviewer ? "lesson-stat-on" : "lesson-stat-off"}">
            <i class="fa-solid fa-book-open"></i>
            <span>Reviewer: <strong>${hasReviewer ? "Yes" : "No"}</strong></span>
          </span>
          <span class="lesson-stat ${quizCount > 0 ? "lesson-stat-on" : "lesson-stat-off"}">
            <i class="fa-solid fa-list-check"></i>
            <span>Quiz: <strong>${quizCount}</strong> ${quizCount === 1 ? "item" : "items"}</span>
          </span>
          <span class="lesson-stat ${activityMeta.count > 0 ? "lesson-stat-on" : "lesson-stat-off"}">
            <i class="fa-solid fa-clone"></i>
            <span>Activities: <strong>${escapeHtml(activityMeta.label)}</strong></span>
          </span>
        </div>
        <span class="lesson-card-cta">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Click to preview
        </span>
      </div>
    </article>
  `;
}

async function fetchAdminTeachers() {
  const res = await fetch(apiUrl("/users"), { headers: adminAuthHeaders() });
  if (!res.ok) throw new Error(`/users status ${res.status}`);
  const rows = await res.json();
  const list = Array.isArray(rows) ? rows : (rows.users || []);
  return list.filter((u) => String(u.role || "").trim().toLowerCase() === "teacher");
}

async function fetchAdminAllLessons() {
  const res = await fetch(apiUrl("/lessons"));
  if (!res.ok) throw new Error(`/lessons status ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.lessons) ? data.lessons : [];
}

async function fetchAdminSubjects() {
  const res = await fetch(apiUrl("/subjects"));
  if (!res.ok) throw new Error(`/subjects status ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.subjects) ? data.subjects : [];
}

function computeStatsByTeacher(lessons) {
  const stats = {};
  for (const l of lessons) {
    const tid = (l.teacher_id_number || "").trim();
    if (!tid) continue;
    if (!stats[tid]) stats[tid] = { lesson_count: 0, published_count: 0, subjects: new Set() };
    stats[tid].lesson_count += 1;
    if (l.is_published || l.published) stats[tid].published_count += 1;
    const sid = l.subject_id ? String(l.subject_id) : UNASSIGNED_SUBJECT_ID;
    stats[tid].subjects.add(sid);
  }
  for (const t of Object.keys(stats)) {
    stats[t].subject_count = stats[t].subjects.size;
    delete stats[t].subjects;
  }
  return stats;
}

function showAdminEmpty(title, text) {
  const empty = document.getElementById("admin-empty-state");
  const t = document.getElementById("admin-empty-title");
  const p = document.getElementById("admin-empty-text");
  if (empty) empty.hidden = false;
  if (t) t.textContent = title;
  if (p) p.textContent = text;
}

function hideAllAdminViews() {
  ["admin-empty-state", "admin-teachers-view", "admin-subjects-view", "admin-lessons-view"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function setAdminSubjectsHeader({ title, subtitle, backHref, backText, showAddButton }) {
  const titleEl = document.getElementById("admin-subjects-title");
  const subEl = document.getElementById("admin-subjects-subtitle");
  const backEl = document.getElementById("admin-subjects-back-link");
  const backTxtEl = document.getElementById("admin-subjects-back-text");
  const addBtn = document.getElementById("admin-add-subject-btn");

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;
  if (backEl) {
    if (backHref) {
      backEl.hidden = false;
      backEl.setAttribute("href", backHref);
    } else {
      backEl.hidden = true;
    }
  }
  if (backTxtEl && backText) backTxtEl.textContent = backText;
  if (addBtn) addBtn.hidden = !showAddButton;
}

async function renderAdminTeachersView() {
  hideAllAdminViews();
  setAdminSubjectsHeader({
    title: "Teachers",
    subtitle: "Pick a teacher to see the subjects they have uploaded lessons for.",
    backHref: null,
    backText: "",
    showAddButton: true,
  });

  const viewEl = document.getElementById("admin-teachers-view");
  const listEl = document.getElementById("admin-teachers-list");
  if (!viewEl || !listEl) return;

  try {
    const [teachers, lessons] = await Promise.all([
      fetchAdminTeachers(),
      fetchAdminAllLessons(),
    ]);
    adminTeachersCache = teachers;
    adminAllLessonsCache = lessons;

    if (!teachers.length) {
      showAdminEmpty("No teachers yet", "There are no teachers in the system yet.");
      return;
    }

    const statsByTeacher = computeStatsByTeacher(lessons);
    teachers.sort((a, b) => {
      const an = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase();
      const bn = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase();
      return an.localeCompare(bn);
    });

    viewEl.hidden = false;
    listEl.innerHTML = teachers
      .map((t) => buildAdminTeacherCardHtml(t, statsByTeacher[String(t.id_number || "").trim()]))
      .join("");
  } catch (e) {
    console.log("DEBUG: renderAdminTeachersView failed:", e);
    showAdminEmpty("Cannot load teachers", "Is the LearnIQ Track backend running?");
  }
}

async function renderAdminTeacherSubjectsView(teacherIdNumber) {
  hideAllAdminViews();

  // Set placeholder header so the Back button works immediately.
  setAdminSubjectsHeader({
    title: "Loading subjects…",
    subtitle: "Fetching this teacher's subjects from the database.",
    backHref: "admin-subjects.html",
    backText: "Back to Teachers",
    showAddButton: false,
  });

  // Resolve teacher name (best-effort).
  let teacherName = `Teacher ${teacherIdNumber}`;
  try {
    if (!adminTeachersCache.length) {
      adminTeachersCache = await fetchAdminTeachers();
    }
    const teacher = adminTeachersCache.find(
      (t) => String(t.id_number || "").trim() === String(teacherIdNumber)
    );
    if (teacher) {
      const composed = [teacher.first_name, teacher.last_name].filter(Boolean).join(" ").trim();
      teacherName = composed || getProfileDisplayName(teacher) || teacher.email || teacherName;
    }
  } catch (e) {
    console.log("DEBUG: teacher subjects view — teacher lookup skipped:", e);
  }

  // ── ACTUAL FETCH FROM DATABASE ─────────────────────────────────────────
  // GET /teacher/lessons?teacher_id_number=X is backed by Supabase, so we
  // get real lesson rows here. Each row already includes subject_id.
  let lessons = [];
  try {
    const res = await fetch(
      apiUrl(`/teacher/lessons?teacher_id_number=${encodeURIComponent(teacherIdNumber)}`),
      { headers: adminAuthHeaders() }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`/teacher/lessons status ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    lessons = Array.isArray(data.lessons) ? data.lessons : [];
  } catch (e) {
    console.log("DEBUG: renderAdminTeacherSubjectsView — lessons fetch failed:", e);
    setAdminSubjectsHeader({
      title: `${teacherName}'s Subjects`,
      subtitle: "We couldn't load this teacher's lessons. See console for details.",
      backHref: "admin-subjects.html",
      backText: "Back to Teachers",
      showAddButton: false,
    });
    showAdminEmpty(
      "Cannot load subjects",
      "The backend returned an error while reading this teacher's lessons. Is the LearnIQ Track backend running?"
    );
    return;
  }

  // Fetch global subjects (for names/colors). Failure is non-fatal — we fall
  // back to showing subject IDs.
  let subjects = [];
  try {
    subjects = adminSubjectsCache.length ? adminSubjectsCache : await fetchAdminSubjects();
    adminSubjectsCache = subjects;
  } catch (e) {
    console.log("DEBUG: teacher subjects view — /subjects fetch skipped:", e);
    subjects = [];
  }

  setAdminSubjectsHeader({
    title: `${teacherName}'s Subjects`,
    subtitle: "Click a subject card to see lessons uploaded by this teacher under that subject.",
    backHref: "admin-subjects.html",
    backText: "Back to Teachers",
    showAddButton: false,
  });
  const viewTitle = document.getElementById("admin-subjects-view-title");
  if (viewTitle) viewTitle.textContent = `Subjects taught by ${teacherName}`;

  if (!lessons.length) {
    showAdminEmpty(
      "No lessons uploaded yet",
      `${teacherName} has not uploaded any lessons yet, so there are no subjects to show.`
    );
    return;
  }

  // Group lessons by subject_id and compute counts.
  const grouped = {};
  for (const l of lessons) {
    const sid = l.subject_id ? String(l.subject_id) : UNASSIGNED_SUBJECT_ID;
    if (!grouped[sid]) grouped[sid] = { lesson_count: 0, published_count: 0 };
    grouped[sid].lesson_count += 1;
    if (l.is_published || l.published) grouped[sid].published_count += 1;
  }

  const subjectById = {};
  for (const s of subjects) subjectById[String(s.id)] = s;
  const cards = [];
  for (const sid of Object.keys(grouped)) {
    let subject;
    if (sid === UNASSIGNED_SUBJECT_ID) {
      subject = { id: UNASSIGNED_SUBJECT_ID, name: "Unassigned", description: "Lessons not yet tagged with a subject.", color: "#9ca3af" };
    } else {
      subject = subjectById[sid] || { id: sid, name: "Unknown subject", description: "", color: "#9ca3af" };
    }
    cards.push(buildAdminSubjectDrillCardHtml(subject, teacherIdNumber, grouped[sid]));
  }

  const viewEl = document.getElementById("admin-subjects-view");
  const listEl = document.getElementById("admin-subjects-list");
  if (!viewEl || !listEl) return;
  viewEl.hidden = false;
  listEl.innerHTML = cards.join("");
}

async function renderAdminTeacherLessonsView(teacherIdNumber, subjectId) {
  hideAllAdminViews();

  // Set a temporary header right away so the Back link works even if the
  // fetch fails or returns no rows.
  setAdminSubjectsHeader({
    title: "Loading lessons…",
    subtitle: "Fetching lessons from the database.",
    backHref: `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber)}`,
    backText: "Back to Subjects",
    showAddButton: false,
  });

  // Resolve teacher name (best-effort, never blocks the lessons fetch).
  let teacherName = `Teacher ${teacherIdNumber}`;
  try {
    if (!adminTeachersCache.length) {
      adminTeachersCache = await fetchAdminTeachers();
    }
    const teacher = adminTeachersCache.find(
      (t) => String(t.id_number || "").trim() === String(teacherIdNumber)
    );
    if (teacher) {
      const composed = [teacher.first_name, teacher.last_name].filter(Boolean).join(" ").trim();
      teacherName = composed || getProfileDisplayName(teacher) || teacher.email || teacherName;
    }
  } catch (e) {
    console.log("DEBUG: lessons view — teacher lookup skipped:", e);
  }

  // Resolve subject name (best-effort, never blocks the lessons fetch).
  let subjectName = "Subject";
  try {
    if (subjectId === UNASSIGNED_SUBJECT_ID) {
      subjectName = "Unassigned";
    } else {
      const subjects = adminSubjectsCache.length ? adminSubjectsCache : await fetchAdminSubjects();
      adminSubjectsCache = subjects;
      const subj = subjects.find((s) => String(s.id) === String(subjectId));
      if (subj && subj.name) subjectName = subj.name;
    }
  } catch (e) {
    console.log("DEBUG: lessons view — subject lookup skipped:", e);
  }

  // ── ACTUAL LESSON FETCH FROM DATABASE ──────────────────────────────────
  // GET /teacher/lessons?teacher_id_number=X is backed by db_supabase.list_teacher_lessons(),
  // which directly queries the Supabase `lessons` table. We filter the
  // returned rows client-side by subject_id.
  let allLessons = [];
  try {
    const res = await fetch(
      apiUrl(`/teacher/lessons?teacher_id_number=${encodeURIComponent(teacherIdNumber)}`),
      { headers: adminAuthHeaders() }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`/teacher/lessons status ${res.status}: ${errBody}`);
    }
    const data = await res.json();
    allLessons = Array.isArray(data.lessons) ? data.lessons : [];
  } catch (e) {
    console.log("DEBUG: renderAdminTeacherLessonsView — lessons fetch failed:", e);
    setAdminSubjectsHeader({
      title: `${subjectName} — ${teacherName}`,
      subtitle: "We couldn't load the lessons. See console for details.",
      backHref: `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber)}`,
      backText: `Back to ${teacherName}'s Subjects`,
      showAddButton: false,
    });
    showAdminEmpty(
      "Cannot load lessons",
      "The backend returned an error while fetching this teacher's lessons. Is the LearnIQ Track backend running?"
    );
    return;
  }

  const filtered = allLessons.filter((l) => {
    const sid = l.subject_id ? String(l.subject_id) : UNASSIGNED_SUBJECT_ID;
    return sid === String(subjectId);
  });

  setAdminSubjectsHeader({
    title: `${subjectName} — ${teacherName}`,
    subtitle: filtered.length
      ? `${filtered.length} lesson${filtered.length === 1 ? "" : "s"} uploaded by ${teacherName} under ${subjectName}.`
      : `No lessons by ${teacherName} under ${subjectName} yet.`,
    backHref: `admin-subjects.html?teacher_id=${encodeURIComponent(teacherIdNumber)}`,
    backText: `Back to ${teacherName}'s Subjects`,
    showAddButton: false,
  });

  const viewTitle = document.getElementById("admin-lessons-view-title");
  if (viewTitle) viewTitle.textContent = `Lessons in ${subjectName}`;

  if (!filtered.length) {
    showAdminEmpty(
      "No lessons in this subject",
      `${teacherName} has not uploaded any lessons under ${subjectName} yet.`
    );
    return;
  }

  const viewEl = document.getElementById("admin-lessons-view");
  const listEl = document.getElementById("admin-lessons-list");
  if (!viewEl || !listEl) return;

  filtered.sort((a, b) => {
    const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bd - ad;
  });

  viewEl.hidden = false;
  listEl.innerHTML = filtered.map(buildAdminLessonCardHtml).join("");

  // Cache lessons so the preview modal can use file_type/is_published/created_at
  // without a second fetch (the /get-content endpoint only returns content).
  try {
    if (!_adminLessonPreviewCache) _adminLessonPreviewCache = new Map();
    filtered.forEach((lesson) => {
      const id = String(lesson.file_id || lesson.id || "").trim();
      if (id) _adminLessonPreviewCache.set(id, lesson);
    });
  } catch (e) {
    console.warn("Could not cache admin lessons:", e);
  }

  // Delegated click + keyboard handler for clickable lesson cards.
  if (!listEl.dataset.adminLessonClickWired) {
    listEl.dataset.adminLessonClickWired = "1";
    const openFromTarget = (target) => {
      const card = target && target.closest ? target.closest(".lesson-card-clickable[data-lesson-id]") : null;
      if (!card) return;
      const lid = card.getAttribute("data-lesson-id");
      if (!lid) return;
      openAdminLessonPreviewModal(lid, _adminLessonPreviewCache.get(lid));
    };
    listEl.addEventListener("click", (ev) => openFromTarget(ev.target));
    listEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        const card = ev.target && ev.target.closest ? ev.target.closest(".lesson-card-clickable[data-lesson-id]") : null;
        if (card) {
          ev.preventDefault();
          openFromTarget(ev.target);
        }
      }
    });
  }
}

async function renderAdminSubjectsPage() {
  const { teacherId, subjectId } = getAdminSubjectsViewParams();
  if (teacherId && subjectId) {
    await renderAdminTeacherLessonsView(teacherId, subjectId);
  } else if (teacherId) {
    await renderAdminTeacherSubjectsView(teacherId);
  } else {
    await renderAdminTeachersView();
  }
}

function setAdminSubjectModalMode(mode, subject) {
  const titleEl = document.getElementById("admin-subject-modal-title");
  const hintEl = document.getElementById("admin-subject-modal-hint");
  const submitBtn = document.getElementById("admin-subject-submit");
  const editIdInput = document.getElementById("admin-subject-edit-id");
  const nameInput = document.getElementById("admin-subject-name");
  const descInput = document.getElementById("admin-subject-description");
  const errorEl = document.getElementById("admin-subject-form-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  if (mode === "edit" && subject) {
    if (titleEl) titleEl.textContent = "Edit subject";
    if (hintEl) hintEl.textContent = "Update the name, description, or color of this subject.";
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save changes';
    if (editIdInput) editIdInput.value = String(subject.id);
    if (nameInput) nameInput.value = subject.name || "";
    if (descInput) descInput.value = subject.description || "";
    const wantedColor = (subject.color || "").trim();
    const radios = document.querySelectorAll('input[name="admin-subject-color"]');
    let matched = false;
    radios.forEach((r) => {
      if (r.value.toLowerCase() === wantedColor.toLowerCase()) {
        r.checked = true;
        matched = true;
      }
    });
    if (!matched && radios.length > 0) radios[0].checked = true;
  } else {
    if (titleEl) titleEl.textContent = "Add a new subject";
    if (hintEl) hintEl.textContent = "Create a new subject so teachers can group their uploaded lessons under it.";
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-circle-plus"></i> Create Subject';
    if (editIdInput) editIdInput.value = "";
    if (nameInput) nameInput.value = "";
    if (descInput) descInput.value = "";
    const first = document.querySelector('input[name="admin-subject-color"]');
    if (first) first.checked = true;
  }
}

function openAdminSubjectAddModal() {
  const modal = document.getElementById("admin-subject-modal");
  if (!modal) return;
  setAdminSubjectModalMode("add", null);
  modal.removeAttribute("hidden");
  document.getElementById("admin-subject-name")?.focus();
}

function openAdminSubjectEditModal(subjectId) {
  const modal = document.getElementById("admin-subject-modal");
  if (!modal) return;
  const subject = adminSubjectsCache.find((s) => String(s.id) === String(subjectId));
  if (!subject) {
    showToast("Subject not found. Refreshing list.", "error");
    void renderAdminSubjectsPage();
    return;
  }
  setAdminSubjectModalMode("edit", subject);
  modal.removeAttribute("hidden");
  document.getElementById("admin-subject-name")?.focus();
}

function closeAdminSubjectModal() {
  const modal = document.getElementById("admin-subject-modal");
  if (modal) modal.setAttribute("hidden", "");
}

async function adminDeleteSubject(subjectId) {
  const subject = adminSubjectsCache.find((s) => String(s.id) === String(subjectId));
  const subjectName = subject?.name || "this subject";
  const total = Number(subject?.total_lesson_count || 0);

  let ok = false;
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") {
    ok = await window.LearnIQConfirm.show({
      title: `Delete "${subjectName}"?`,
      message: total > 0
        ? `${total} lesson${total === 1 ? "" : "s"} are tagged with this subject. They will become "Unassigned" after deletion. Continue?`
        : "This subject has no lessons tagged to it. Continue?",
      confirmText: "Delete",
      cancelText: "Cancel",
      danger: true,
    });
  } else {
    ok = window.confirm(`Delete "${subjectName}"? This cannot be undone.`);
  }
  if (!ok) return;

  try {
    const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}`), { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (status ${res.status}).`);
    }
    showToast(`Subject "${subjectName}" deleted.`, "success");
    await renderAdminSubjectsPage();
  } catch (e) {
    console.log("DEBUG: adminDeleteSubject failed:", e);
    showToast(e?.message || "Could not delete subject.", "error");
  }
}

window.openAdminSubjectEditModal = openAdminSubjectEditModal;
window.adminDeleteSubject = adminDeleteSubject;

function setupAdminSubjectModal() {
  const modal = document.getElementById("admin-subject-modal");
  const openBtn = document.getElementById("admin-add-subject-btn");
  const closeBtn = document.getElementById("admin-subject-modal-close");
  const cancelBtn = document.getElementById("admin-subject-cancel");
  const form = document.getElementById("admin-subject-form");
  const nameInput = document.getElementById("admin-subject-name");
  const descInput = document.getElementById("admin-subject-description");
  const submitBtn = document.getElementById("admin-subject-submit");
  const errorEl = document.getElementById("admin-subject-form-error");

  if (!modal || !openBtn || !form) return;

  openBtn.addEventListener("click", () => openAdminSubjectAddModal());
  closeBtn?.addEventListener("click", closeAdminSubjectModal);
  cancelBtn?.addEventListener("click", closeAdminSubjectModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAdminSubjectModal();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    const editId = (document.getElementById("admin-subject-edit-id")?.value || "").trim();
    const name = (nameInput?.value || "").trim();
    const description = (descInput?.value || "").trim();
    const colorInput = form.querySelector('input[name="admin-subject-color"]:checked');
    const color = colorInput ? colorInput.value : "#ca8a04";

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "Subject name is required.";
        errorEl.hidden = false;
      }
      nameInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.prevHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    }

    try {
      let res;
      if (editId) {
        res = await fetch(apiUrl(`/subjects/${encodeURIComponent(editId)}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, color }),
        });
      } else {
        res = await fetch(apiUrl("/subjects"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, color }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (status ${res.status}).`);
      }
      closeAdminSubjectModal();
      showToast(editId ? `Subject "${name}" updated.` : `Subject "${name}" added.`, "success");
      await renderAdminSubjectsPage();
    } catch (e) {
      console.log("DEBUG: admin subject save failed:", e);
      if (errorEl) {
        errorEl.textContent = e?.message || "Could not save subject. Please try again.";
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.prevHtml || 'Save';
      }
    }
  });
}

function setupAdminSubjectsPage() {
  console.log("PAGE INIT RUNNING: setupAdminSubjectsPage() called");
  if (typeof hydrateAdminSidebarFromSession === "function") {
    hydrateAdminSidebarFromSession();
  }

  setupAdminSubjectModal();

  document.getElementById("admin-subjects-refresh-btn")?.addEventListener("click", () => {
    renderAdminSubjectsPage();
  });

  void renderAdminSubjectsPage();
}

function setupTeacherAddSubjectForm() {
  const form = document.getElementById("teacher-add-subject-form");
  const nameInput = document.getElementById("teacher-add-subject-name");
  const descInput = document.getElementById("teacher-add-subject-description");
  const submitBtn = document.getElementById("teacher-add-subject-submit");
  const resetBtn = document.getElementById("teacher-add-subject-reset");
  const errorEl = document.getElementById("teacher-add-subject-error");

  if (!form) return;

  const clearError = () => {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
  };

  const resetForm = () => {
    clearError();
    if (nameInput) nameInput.value = "";
    if (descInput) descInput.value = "";
    const first = form.querySelector('input[name="subject-color"]');
    if (first) first.checked = true;
  };

  resetBtn?.addEventListener("click", clearError);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    const name = (nameInput?.value || "").trim();
    const description = (descInput?.value || "").trim();
    const colorInput = form.querySelector('input[name="subject-color"]:checked');
    const color = colorInput ? colorInput.value : "#ca8a04";

    if (!name) {
      if (errorEl) {
        errorEl.textContent = "Subject name is required.";
        errorEl.hidden = false;
      }
      nameInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.prevHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…';
    }

    try {
      const teacher = getCurrentUserSession();
      const teacherId = String(teacher?.id_number || "").trim();
      const res = await fetch(apiUrl("/subjects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          color,
          created_by_teacher_id_number: teacherId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to add subject (status ${res.status}).`);
      }
      const created = await res.json().catch(() => ({}));
      resetForm();
      const codeNote = created.join_code ? ` Join code: ${created.join_code}` : "";
      showToast(`Subject "${created.name || name}" added.${codeNote}`, "success");
      await renderTeacherSubjectsPage();
    } catch (e) {
      console.log("DEBUG: create subject failed:", e);
      if (errorEl) {
        errorEl.textContent = e?.message || "Could not add subject. Please try again.";
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitBtn.dataset.prevHtml || 'Create Subject';
      }
    }
  });
}

async function setupModuleSelectionPage() {
  const learniqLink = document.getElementById("learniq-module-link");
  const immersionLink = document.getElementById("immersion-module-link");
  const immersionNote = document.getElementById("immersion-module-note");
  const immersionBtn = document.getElementById("immersion-module-btn");

  let user = getCurrentUserSession();
  if (!user?.access_token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch(apiUrl("/me"), { headers: immersionAuthHeaders() });
    const prof = await readApiJson(res);
    user = { ...user, ...prof, access_token: user.access_token, refresh_token: user.refresh_token };
    setCurrentUserSession(user);
  } catch (e) {
    console.warn("module-selection: could not refresh profile", e);
  }

  const role = String(user.role || "").trim().toLowerCase();

  if (learniqLink) {
    learniqLink.href = role === "teacher" ? "teacher-learniq-dashboard.html" : "learniq-dashboard.html";
  }

  if (!immersionLink) return;

  const immersionHref =
    role === "teacher" ? "teacher-immersion.html" : "immersion-dashboard.html";

  if (isGrade11Student(user)) {
    immersionLink.href = "#";
    immersionLink.classList.add("is-disabled");
    immersionLink.setAttribute("aria-disabled", "true");
    immersionLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      showToast("Immersion Tracker is only for Grade 12 students.", "info");
    });
    if (immersionNote) immersionNote.hidden = false;
    if (immersionBtn) {
      immersionBtn.classList.remove("btn-primary");
      immersionBtn.classList.add("btn-secondary", "is-locked");
      immersionBtn.textContent = "Grade 12 only";
    }
    return;
  }

  immersionLink.href = immersionHref;
}

function setupStudentDashboard() {
  console.log("PAGE INIT RUNNING: setupStudentDashboard() called");

  hydrateStudentSidebarChip();
  void hydrateSidebarProfileFromDatabase();
  void initLearniqDashboardIfPresent();

const emptyEl = document.getElementById("student-lesson-empty");
const emptyText = document.getElementById("student-lesson-empty-text");
const metaCard = document.getElementById("student-lesson-meta");
const reviewerCard = document.getElementById("student-reviewer-card");
const quizCard = document.getElementById("student-quiz-card");
const activitiesCard = document.getElementById("student-activities-card");
const titleEl = document.getElementById("student-lesson-title");
const filenameEl = document.getElementById("student-lesson-filename");
const reviewerList = document.getElementById("student-reviewer-list");
const activitiesList = document.getElementById("student-activities-list");
const quizProgress = document.getElementById("student-quiz-progress");
const quizBody = document.getElementById("student-quiz-body");
const quizScoreEl = document.getElementById("student-quiz-score");
const workspaceEl = document.getElementById("student-workspace");
const lessonMetaLine = document.getElementById("student-lesson-meta-line");
const lessonPreviewText = document.getElementById("student-lesson-preview-text");
const aiStatusEl = document.getElementById("student-ai-status");
const lessonTabButtons = Array.from(document.querySelectorAll(".workspace-tab"));
const tabLesson = document.getElementById("student-tab-lesson");
const tabReviewer = document.getElementById("student-tab-reviewer");
const tabQuiz = document.getElementById("student-tab-quiz");
const tabActivity = document.getElementById("student-tab-activity");


let studentLessons = []; // All published lessons
let studentSubjects = []; // All subjects (with published_lesson_count)
let selectedSubjectId = null; // Currently selected subject (null = show subject grid)
let selectedLesson = null; // Currently selected lesson
let activeContentType = null; // Controls which section is displayed: "reviewer", "quiz", "activity", or null
let lessonData = null; // Legacy - for backward compatibility
let quizIndex = 0;
let quizScore = 0;
  let quizAnswered = false;
  let studentAnswers = []; // Track all student answers
  let studentAiAbortController = null;

  const quizSettingsModal = document.getElementById("student-quiz-settings-modal");
  const quizSettingsClose = document.getElementById("student-quiz-settings-close");
  const quizSettingsCancel = document.getElementById("student-quiz-generate-cancel");
  const quizSettingsConfirm = document.getElementById("student-quiz-generate-confirm");
  const quizCountSelect = document.getElementById("student-quiz-count");
  const quizDifficultySelect = document.getElementById("student-quiz-difficulty");

  const activitySettingsModal = document.getElementById("student-activity-settings-modal");
  const activitySettingsClose = document.getElementById("student-activity-settings-close");
  const activitySettingsCancel = document.getElementById("student-activity-generate-cancel");
  const activitySettingsConfirm = document.getElementById("student-activity-generate-confirm");
  const activityTypeSelect = document.getElementById("student-activity-type");

  function openModal(el) {
    if (!el) return;
    el.removeAttribute("hidden");
  }

  function closeModal(el) {
    if (!el) return;
    el.setAttribute("hidden", "");
  }

  function getActiveStudentLessons() {
  if (!selectedSubjectId) return studentLessons;
  if (String(selectedSubjectId) === "__unassigned__") {
    return studentLessons.filter((l) => !l.subject_id);
  }
  return studentLessons.filter((l) => String(l.subject_id || "") === String(selectedSubjectId));
}

function applySubjectTeacherAvatar(el, avatarData, displayName) {
  if (!el) return;
  const av = String(avatarData || "").trim();
  const initials = getUserInitials(displayName || "Teacher");
  if (av) {
    el.style.backgroundImage = `url("${av.replace(/"/g, "%22")}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundRepeat = "no-repeat";
    el.classList.add("avatar-has-image");
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.classList.remove("avatar-has-image");
    el.textContent = initials;
  }
}

function renderSubjectTeacherProfile() {
  const card = document.getElementById("subject-teacher-profile");
  const avatarEl = document.getElementById("subject-teacher-avatar");
  const nameEl = document.getElementById("subject-teacher-name");
  const idEl = document.getElementById("subject-teacher-id");
  if (!card) return;

  if (!selectedSubjectId || String(selectedSubjectId) === "__unassigned__") {
    card.hidden = true;
    return;
  }

  const subjectMeta = studentSubjects.find((s) => String(s.id) === String(selectedSubjectId));
  let teacherName =
    (subjectMeta?.teacher_name || "").trim() ||
    (subjectMeta?.created_by_teacher_id_number || "").trim();
  let teacherId =
    (subjectMeta?.teacher_id_number || subjectMeta?.created_by_teacher_id_number || "").trim();
  let teacherAvatar = (subjectMeta?.teacher_avatar_data || "").trim();

  if (!teacherName) {
    const sampleLesson = getActiveStudentLessons().find(
      (l) => l.teacher_name || l.teacher_id_number
    );
    if (sampleLesson) {
      teacherName = (sampleLesson.teacher_name || sampleLesson.teacher_id_number || "").trim();
      teacherId = teacherId || String(sampleLesson.teacher_id_number || "").trim();
    }
  }

  if (!teacherName) {
    card.hidden = true;
    return;
  }

  card.hidden = false;
  if (nameEl) nameEl.textContent = teacherName;
  if (idEl) idEl.textContent = teacherId ? `ID ${teacherId}` : "";
  applySubjectTeacherAvatar(avatarEl, teacherAvatar, teacherName);
}

let lastLoadedSubjectPeopleId = null;

/** People tab classmates list (Teachers section reuses renderSubjectTeacherProfile). */
async function loadSubjectPeople(subjectId) {
  const listEl = document.getElementById("subject-classmates-list");
  const countEl = document.getElementById("subject-classmates-count");
  const emptyEl = document.getElementById("subject-classmates-empty");
  if (!listEl) return;

  if (!subjectId || String(subjectId) === "__unassigned__") {
    listEl.innerHTML = "";
    if (countEl) countEl.textContent = "";
    if (emptyEl) emptyEl.hidden = true;
    lastLoadedSubjectPeopleId = null;
    return;
  }
  if (lastLoadedSubjectPeopleId === String(subjectId)) return;
  lastLoadedSubjectPeopleId = String(subjectId);

  const user = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  if (!user?.access_token) return;

  try {
    const res = await fetch(apiUrl(`/subjects/${encodeURIComponent(subjectId)}/people`), {
      headers: { Authorization: `Bearer ${user.access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not load classmates.");

    const students = Array.isArray(data.students) ? data.students : [];
    if (countEl) {
      countEl.textContent = students.length ? `${students.length} ${students.length === 1 ? "student" : "students"}` : "";
    }
    if (!students.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    listEl.innerHTML = students
      .map((s) => {
        const name = getProfileDisplayName(s) || "Student";
        const initials = getUserInitials(name);
        return `
      <div class="subject-people-row">
        <div class="subject-people-row-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <span class="subject-people-row-name">${escapeHtml(name)}</span>
      </div>`;
      })
      .join("");
  } catch (e) {
    lastLoadedSubjectPeopleId = null;
    listEl.innerHTML = "";
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = e.message || "Could not load classmates.";
    }
    if (countEl) countEl.textContent = "";
  }
}

// Default subject color when none is set — stays in the yellow/gold family
// (see the swatch palettes in teacher-subjects.html / admin-subjects.html).
const DEFAULT_SUBJECT_COLOR = "#ca8a04";

function updateMyLessonHeaderForSubject() {
  const headerTitle = document.getElementById("student-lesson-panel-title");
  const headerSubtitle = document.getElementById("student-lesson-panel-subtitle");
  const backLink = document.getElementById("student-back-to-subjects-link");
  const plainHeader = document.getElementById("student-lesson-panel-header");
  const banner = document.getElementById("subject-class-banner");
  const bannerTitle = document.getElementById("subject-banner-title");
  const bannerSubtitle = document.getElementById("subject-banner-subtitle");
  const tabsNav = document.getElementById("subject-class-tabs");

  if (selectedSubjectId) {
    if (backLink) backLink.hidden = false;
    const subjectMeta = studentSubjects.find((s) => String(s.id) === String(selectedSubjectId));
    const name = subjectMeta?.name
      || (String(selectedSubjectId) === "__unassigned__" ? "Unassigned" : null);
    if (headerTitle) headerTitle.textContent = name ? `${name} Lessons` : "My Lesson";
    if (headerSubtitle) {
      headerSubtitle.textContent = "Open a published lesson to review, take a quiz, or do an activity.";
    }

    // Classroom-style banner + Stream/Classwork/People tabs replace the plain header.
    if (plainHeader) plainHeader.hidden = true;
    if (banner) {
      banner.hidden = false;
      banner.style.setProperty("--subject-banner-color", subjectMeta?.color || DEFAULT_SUBJECT_COLOR);
    }
    if (bannerTitle) bannerTitle.textContent = name || "Subject";
    if (bannerSubtitle) {
      const teacherName = (subjectMeta?.teacher_name || "").trim();
      bannerSubtitle.textContent = teacherName ? `Taught by ${teacherName}` : "";
    }
    if (tabsNav) tabsNav.hidden = false;

    const streamDesc = document.getElementById("subject-stream-description");
    if (streamDesc) {
      streamDesc.textContent = (subjectMeta?.description || "").trim()
        || "Open Classwork to see published lessons for this subject.";
    }
    const streamCount = document.getElementById("subject-stream-lesson-count");
    if (streamCount) {
      const count = getActiveStudentLessons().length;
      streamCount.textContent = `${count} published ${count === 1 ? "lesson" : "lessons"}`;
    }
  } else {
    if (backLink) backLink.hidden = true;
    if (headerTitle) headerTitle.textContent = "My Lesson";
    if (headerSubtitle) {
      headerSubtitle.textContent = "Open a published lesson to review, take a quiz, or do an activity.";
    }
    if (plainHeader) plainHeader.hidden = false;
    if (banner) banner.hidden = true;
    if (tabsNav) tabsNav.hidden = true;
  }
}

function initSubjectClassTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".subject-class-tab[data-subject-tab]"));
  if (!tabButtons.length) return;

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-subject-tab");
      tabButtons.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      ["stream", "classwork", "people"].forEach((name) => {
        const panel = document.getElementById(`subject-tab-panel-${name}`);
        if (panel) panel.hidden = name !== target;
      });
    });
  });
}
initSubjectClassTabs();

function renderLessonSelection() {
  console.log("DEBUG: renderLessonSelection called");
  console.log("DEBUG: studentLessons length:", studentLessons.length);

  const selectionEl = document.getElementById("student-lesson-selection");
  const lessonListEl = document.getElementById("student-lesson-list");
  const subjectEmptyEl = document.getElementById("student-lesson-empty-for-subject");
  const titleEl = document.getElementById("student-lesson-selection-title");
  const subtitleEl = document.getElementById("student-lesson-selection-subtitle");

  if (!selectionEl || !lessonListEl) {
    console.log("DEBUG: Missing DOM elements - aborting render");
    return;
  }

  updateMyLessonHeaderForSubject();
  renderSubjectTeacherProfile();
  loadSubjectPeople(selectedSubjectId);
  loadSubjectAnnouncements(selectedSubjectId);
  bindAnnouncementFeedInteractions();

  const lessons = getActiveStudentLessons();
  selectionEl.hidden = false;

  const subjectMeta = selectedSubjectId
    ? studentSubjects.find((s) => String(s.id) === String(selectedSubjectId))
    : null;
  if (titleEl) {
    titleEl.textContent = subjectMeta?.name
      ? `${subjectMeta.name} · published lessons`
      : "Published lessons";
  }
  if (subtitleEl) {
    subtitleEl.textContent = lessons.length
      ? "Choose a lesson to open your AI-powered workspace."
      : selectedSubjectId
        ? "No lessons published for this subject yet."
        : "No published lessons yet.";
  }

  if (lessons.length === 0) {
    lessonListEl.innerHTML = "";
    if (subjectEmptyEl) subjectEmptyEl.hidden = false;
    return;
  }
  if (subjectEmptyEl) subjectEmptyEl.hidden = true;

  let html = "";
  lessons.forEach((lesson) => {
    const teacherName = lesson.teacher_name || lesson.teacher_id_number || "Teacher";
    const createdLabel = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "Unknown date";
    const lid = String(lesson.file_id || "").replace(/'/g, "\\'");
    html += `
    <article class="lesson-card ${selectedLesson?.file_id === lesson.file_id ? 'selected' : ''}"
         data-lesson-id="${lesson.file_id}">
      <div class="lesson-card-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="lesson-info">
        <h4>${escapeHtml(lesson.filename || 'Untitled Lesson')}</h4>
        <div class="lesson-card-meta-row">
          <span class="lesson-card-pill"><i class="fa-solid fa-tag"></i> ${escapeHtml((lesson.file_type || 'Unknown').toUpperCase())}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-calendar"></i> ${createdLabel}</span>
          <span class="lesson-card-pill"><i class="fa-solid fa-user"></i> ${escapeHtml(teacherName)}</span>
        </div>
        <p class="lesson-card-tagline">AI Learning Workspace</p>
        <p class="lesson-card-features small-note">Review • Quiz • Activities</p>
      </div>
      <div class="lesson-actions lesson-actions-split">
        <button type="button" class="btn btn-secondary btn-small" onclick="event.stopPropagation(); viewStudentLessonFile('${lid}')">View</button>
        <button type="button" class="btn btn-primary btn-small" onclick="event.stopPropagation(); selectLessonById('${lid}')">Open Workspace</button>
      </div>
    </article>
  `;
  });

  lessonListEl.innerHTML = html;
}

function selectLessonById(lessonId) {
  const lesson = studentLessons.find(l => l.file_id === lessonId);
  if (lesson) {
    selectLesson(lesson);
  }
}

async function selectLesson(lesson) {
  selectedLesson = lesson;
  lessonData = lesson; // Update legacy for compatibility
  activeContentType = "lesson";
  
  console.log("Selected lesson:", selectedLesson); // Debug: Log selected lesson
  
  // Update UI
  renderLessonSelection();
  showLessonSelection(lesson);
  
  if (workspaceEl) workspaceEl.hidden = false;
  if (lessonMetaLine) {
    const createdLabel = lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : "Unknown date";
    lessonMetaLine.textContent = `${lesson.file_type?.toUpperCase() || "UNKNOWN"} • Uploaded ${createdLabel}`;
  }
  if (lessonPreviewText) {
    lessonPreviewText.textContent = (lesson.extracted_text || "").trim().slice(0, 420) || "Lesson preview is not available yet for this file.";
  }
  showContentSection("lesson");
  await refreshSelectedLessonContent();
  
  // Show success message
  showToast(`Selected: ${lesson.filename || "Lesson"}`, "success");
}

// Make functions globally accessible for inline onclick handlers
window.selectLessonById = selectLessonById;
window.selectLesson = selectLesson;

function renderDashboardOverview() {
  const selectionEl = document.getElementById("student-lesson-selection");

  if (emptyEl) emptyEl.hidden = true;
  if (selectionEl) selectionEl.hidden = true;
  if (metaCard) metaCard.hidden = true;
  if (workspaceEl) workspaceEl.hidden = true;
  if (reviewerCard) reviewerCard.hidden = true;
  if (quizCard) quizCard.hidden = true;
  if (activitiesCard) activitiesCard.hidden = true;
}

function showLessonSelection(lesson) {
  if (emptyEl) emptyEl.hidden = true;
  if (metaCard) metaCard.hidden = false;
  if (workspaceEl) workspaceEl.hidden = false;
  if (titleEl) titleEl.textContent = "AI Lesson Workspace";
  if (filenameEl) filenameEl.textContent = lesson.filename || "Selected lesson";
}

function showEmpty(message) {
    lessonData = null;
    selectedLesson = null;
    activeContentType = null;
    const selectionEl = document.getElementById("student-lesson-selection");
    if (selectionEl) selectionEl.hidden = true;
    if (emptyEl) emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = message;
    if (metaCard) metaCard.hidden = true;
    if (workspaceEl) workspaceEl.hidden = true;
    if (reviewerCard) reviewerCard.hidden = true;
    if (quizCard) quizCard.hidden = true;
    if (activitiesCard) activitiesCard.hidden = true;
  }

  function closeActionModal() {}

  // Fisher-Yates shuffle — returns a new array, does not mutate the input.
  function shuffleArray(arr) {
    const copy = Array.isArray(arr) ? arr.slice() : [];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Every student reads the same cached quiz questions from the DB (the AI only
  // regenerates them when a teacher clicks "Generate Quiz"). Without this, the
  // question order AND the A/B/C/D choice order would be identical for every
  // student, making it trivial to just share "1-B, 2-D, 3-A..." Shuffling both
  // per browser session (not saved back to the DB) keeps the same question bank
  // but breaks that shortcut, without needing extra AI calls per student.
  function shuffleQuizForStudent(questions) {
    if (!Array.isArray(questions)) return questions;
    const letters = ["A", "B", "C", "D"];
    const reshuffled = questions.map((q) => {
      if (!q || !Array.isArray(q.choices) || q.choices.length < 2) return q;
      const correctIndex = letters.indexOf(String(q.answer || "").trim().toUpperCase());
      const tagged = q.choices.map((choice, i) => ({ choice, wasCorrect: i === correctIndex }));
      const shuffledChoices = shuffleArray(tagged);
      const newCorrectIndex = shuffledChoices.findIndex((c) => c.wasCorrect);
      return {
        ...q,
        choices: shuffledChoices.map((c) => c.choice),
        answer: newCorrectIndex >= 0 ? letters[newCorrectIndex] : q.answer,
      };
    });
    return shuffleArray(reshuffled);
  }

  function showLesson(data) {
    console.log("[DEBUG] showLesson called with data:", data);
    console.log("[DEBUG] data.activities value:", data.activities);
    console.log("[DEBUG] Type of data.activities:", typeof data.activities);
    console.log("[DEBUG] Is data.activities an array?", Array.isArray(data.activities));

    lessonData = Array.isArray(data?.quiz) && data.quiz.length
      ? { ...data, quiz: shuffleQuizForStudent(data.quiz) }
      : data;
    if (emptyEl) emptyEl.hidden = true;
    if (metaCard) metaCard.hidden = false;
    if (reviewerCard) reviewerCard.hidden = false;
    if (quizCard) quizCard.hidden = false;
    if (activitiesCard) activitiesCard.hidden = false;

    if (titleEl) titleEl.textContent = "Your class lesson";
    if (filenameEl) filenameEl.textContent = data.filename || "";

    if (reviewerList) {
      if (typeof mountReviewerMarkdownInto === "function") {
        mountReviewerMarkdownInto(reviewerList, data.reviewer);
      } else {
        reviewerList.innerHTML = `<p>${escapeHtml(String(data.reviewer || ""))}</p>`;
      }
      const pdfBtn = document.getElementById("student-download-reviewer-pdf-btn");
      if (pdfBtn && typeof setReviewerPdfButtonVisible === "function") {
        const has =
          typeof normalizeReviewerMarkdown === "function"
            ? normalizeReviewerMarkdown(data.reviewer).length > 0
            : Boolean(String(data.reviewer || "").trim());
        setReviewerPdfButtonVisible(pdfBtn, has);
      }
    }

    if (activitiesList) {
      const acts = data.activities || [];
      console.log("[DEBUG] Rendering activities. acts:", acts);
      renderActivitiesInto(activitiesList, acts);
    }

    quizIndex = 0;
    quizScore = 0;
    quizAnswered = false;
    studentAnswers = []; // Initialize answer tracking
    renderStudentQuiz();
  }

  function focusStudentSection(action) {
    const target =
      action === "reviewer" ? tabReviewer : action === "quiz" ? tabQuiz : action === "activity" ? tabActivity : tabLesson;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateReviewerDisplay(reviewerData) {
    if (!reviewerList) return;
    if (typeof mountReviewerMarkdownInto === "function") {
      mountReviewerMarkdownInto(reviewerList, reviewerData);
    } else {
      reviewerList.innerHTML = `<p>${escapeHtml(String(reviewerData || ""))}</p>`;
    }
    const pdfBtn = document.getElementById("student-download-reviewer-pdf-btn");
    if (pdfBtn && typeof setReviewerPdfButtonVisible === "function") {
      const has =
        typeof normalizeReviewerMarkdown === "function"
          ? normalizeReviewerMarkdown(reviewerData).length > 0
          : Boolean(String(reviewerData || "").trim());
      setReviewerPdfButtonVisible(pdfBtn, has);
    }
  }

  function updateActivitiesDisplay(activitiesData) {
    if (!activitiesList) return;
    console.log("[DEBUG] updateActivitiesDisplay called with:", activitiesData);

    const arr = Array.isArray(activitiesData) ? activitiesData : activitiesData == null ? [] : [activitiesData];
    const hasLegacyStringified = arr.some(
      (it) => typeof it === "string" && it.trim() === "[object Object]"
    );
    if (hasLegacyStringified) {
      console.warn("[DEBUG] Detected legacy stringified activities ('[object Object]') in DB.");
      activitiesList.innerHTML = `
        <div class="activity-item">
          <strong>Outdated activities</strong>
          <p class="small-note">These activities were saved with an older version and can no longer be displayed. Click <strong>Generate Activity</strong> again to create fresh AI-generated essays or flashcards.</p>
        </div>`;
      return;
    }

    if (typeof renderActivitiesInto === "function") {
      renderActivitiesInto(activitiesList, activitiesData);
      return;
    }
    const activitiesArray = arr;
    activitiesList.innerHTML = activitiesArray
      .map(
        (item, i) => `
      <div class="activity-item">
        <strong>Activity ${i + 1}</strong>
        <p>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</p>
      </div>`
      )
      .join("") || '<p class="small-note">No activities yet.</p>';
  }

  function renderStudentQuiz() {
    const questions = (lessonData && lessonData.quiz) || [];
    if (!questions.length) {
      if (quizProgress) quizProgress.textContent = "";
      quizBody.innerHTML = '<p class="small-note">No quiz questions yet. Your teacher may still be adding them.</p>';
      if (quizScoreEl) quizScoreEl.textContent = "";
      return;
    }

    // Initialize studentAnswers array if needed
    if (studentAnswers.length !== questions.length) {
      studentAnswers = new Array(questions.length).fill(null);
    }

    if (quizProgress) quizProgress.textContent = `Question ${quizIndex + 1} of ${questions.length}`;
    if (quizScoreEl) quizScoreEl.textContent = "";

    const q = questions[quizIndex];
    if (!q || !q.question) {
      quizBody.innerHTML = '<p class="small-note">Invalid question data.</p>';
      return;
    }

    const choices = Array.isArray(q.choices) ? q.choices : [];
    const letters = ["A", "B", "C", "D"];
    const saved = studentAnswers[quizIndex];
    const checkedAttr = (val) => (saved === val ? "checked" : "");
    const formatChoiceText = (choice) => {
      // Strip any leading "A. "/"B) " label the AI embedded in the choice text —
      // must match any letter, not just the current render position, since
      // shuffleQuizForStudent() reorders choices independently of their
      // originally-generated letter.
      const raw = String(choice || "").trim();
      const stripped = raw.replace(/^[A-D][.)\s]+/i, "").trim();
      return stripped || raw;
    };

    quizBody.innerHTML = `
      <p class="student-quiz-question"><strong>${escapeHtml(q.question)}</strong></p>
      <div class="student-quiz-choices">
      ${choices
        .map((c, i) => {
          const letter = letters[i] || String(i);
          const choiceText = formatChoiceText(c);
          return `
        <label class="student-quiz-choice">
          <input type="radio" name="student-quiz-opt" value="${letter}" ${checkedAttr(letter)} />
          <span class="student-quiz-choice-text"><span class="student-quiz-choice-letter">${letter}.</span> ${escapeHtml(choiceText)}</span>
        </label>`;
        })
        .join("")}
      </div>
      <div class="button-group student-quiz-nav" style="margin-top:0.75rem;">
        <button type="button" class="btn btn-secondary" id="student-quiz-prev-btn" ${quizIndex === 0 ? "disabled" : ""}>Previous</button>
        <button type="button" class="btn btn-primary" id="student-quiz-next-btn">${
          quizIndex + 1 >= questions.length ? "Submit Quiz" : "Next"
        }</button>
      </div>
    `;

    function saveCurrentAnswer() {
      const picked = document.querySelector('input[name="student-quiz-opt"]:checked');
      studentAnswers[quizIndex] = picked ? String(picked.value) : null;
    }

    function renderResults() {
      // Evaluate all answers on submit
      let correct = 0;
      const rows = questions
        .map((question, idx) => {
          const your = studentAnswers[idx];
          const correctAns = String(question.answer || "").trim().toUpperCase();
          const ok = your && correctAns && String(your).toUpperCase() === correctAns;
          if (ok) correct += 1;
          const yourLabel = your ? String(your).toUpperCase() : "—";
          const mark = ok ? "✅" : "❌";
          return `
            <div class="activity-item" style="margin-top:0.75rem;">
              <strong>Q${idx + 1}. ${escapeHtml(question.question || "")}</strong>
              <p class="small-note" style="margin:0.35rem 0 0;">Your Answer: ${escapeHtml(yourLabel)} ${mark}</p>
              <p class="small-note" style="margin:0.15rem 0 0;">Correct Answer: ${escapeHtml(correctAns || "—")} ✅</p>
            </div>
          `;
        })
        .join("");

      const total = questions.length;
      const pct = Math.round((correct / Math.max(1, total)) * 100);
      if (quizProgress) quizProgress.textContent = "Results";
      if (quizScoreEl) quizScoreEl.textContent = `Score: ${correct} / ${total} (${pct}%)`;

      try {
        if (typeof recordStudentHistory === "function") {
          const questionsSnapshot = questions.map((question, idx) => ({
            question: String(question?.question || ""),
            choices: Array.isArray(question?.choices) ? question.choices.map((c) => String(c)) : [],
            answer: String(question?.answer || "").trim().toUpperCase(),
            student_answer: studentAnswers[idx] ? String(studentAnswers[idx]).toUpperCase() : null,
          }));
          recordStudentHistory("quiz", {
            lesson_id: selectedLesson?.file_id || selectedLesson?.lesson_id || null,
            lesson_title: selectedLesson?.title || selectedLesson?.filename || "Lesson",
            subject_name: selectedLesson?.subject_name || "",
            score: correct,
            total,
            questions: questionsSnapshot,
          });
        }
      } catch (e) {
        console.warn("recordStudentHistory(quiz) failed:", e);
      }

      try {
        const lessonIdForBackend = selectedLesson?.file_id || selectedLesson?.lesson_id;
        if (lessonIdForBackend) {
          const session =
            typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
          const idNumber = String(session?.id_number || "").trim() || null;
          fetch(apiUrl("/quiz-attempt"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
            body: JSON.stringify({
              lesson_id: lessonIdForBackend,
              score: correct,
              total_questions: total,
              answers: studentAnswers,
              student_id_number: idNumber,
            }),
          }).catch((err) => console.warn("Failed to save quiz attempt to server:", err));
        }
      } catch (e) {
        console.warn("Quiz attempt POST setup failed:", e);
      }

      quizBody.innerHTML = `
        <div class="glass-card" style="padding:1rem;border:1px solid rgba(148,163,184,0.18);border-radius:16px;background:rgba(15,23,42,0.35);">
          <h4 style="margin:0 0 0.35rem;">Quiz Results</h4>
          <p class="content-subtitle" style="margin:0;">Score: <strong>${correct} / ${total}</strong></p>
          <p class="content-subtitle" style="margin:0.25rem 0 0;"><strong>${pct}%</strong></p>
        </div>
        <div style="margin-top:1rem;">
          <h4 style="margin:0;">Answer Review</h4>
          <p class="small-note" style="margin:0.25rem 0 0;">Review your answers below.</p>
          ${rows || '<p class="small-note">No questions to review.</p>'}
        </div>
      `;
    }

    document.getElementById("student-quiz-prev-btn")?.addEventListener("click", () => {
      saveCurrentAnswer();
      if (quizIndex > 0) quizIndex -= 1;
      renderStudentQuiz();
    });

    document.getElementById("student-quiz-next-btn")?.addEventListener("click", () => {
      saveCurrentAnswer();
      if (quizIndex + 1 >= questions.length) {
        renderResults();
        return;
      }
      quizIndex += 1;
      renderStudentQuiz();
    });
  }

  async function loadStudentSubjects() {
    const studentId = getStudentIdNumberForApi();
    if (!studentId) {
      studentSubjects = [];
      return;
    }
    try {
      const res = await fetch(
        apiUrl(`/student/subjects?student_id_number=${encodeURIComponent(studentId)}`),
        { headers: adminAuthHeaders() }
      );
      if (!res.ok) {
        studentSubjects = [];
        return;
      }
      const data = await res.json();
      studentSubjects = Array.isArray(data.subjects) ? data.subjects : [];
    } catch (e) {
      console.log("DEBUG: loadStudentSubjects failed:", e);
      studentSubjects = [];
    }
  }

  function readSelectedSubjectFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sid = params.get("subject_id");
      return sid && sid.trim() ? sid.trim() : null;
    } catch {
      return null;
    }
  }

  async function loadStudentLessons() {
    console.log("DEBUG: loadStudentLessons called");
    console.log("DEBUG: Current page:", window.location.pathname);
    const currentPath = window.location.pathname;
    const isMyLessonPage = currentPath.includes('my-lesson.html');
    if (!isMyLessonPage) {
      renderDashboardOverview();
      return;
    }

    // Pin the subject for this page view to whatever is in the URL.
    selectedSubjectId = readSelectedSubjectFromUrl();

    try {
      await loadStudentSubjects();

      const studentId = getStudentIdNumberForApi();
      if (!studentId) {
        studentLessons = [];
        showEmpty("Please sign in as a student to view lessons.");
        return;
      }

      console.log("Calling /student/lessons...");
      const apiUrlValue = apiUrl(
        `/student/lessons?student_id_number=${encodeURIComponent(studentId)}`
      );
      const res = await fetch(apiUrlValue, { headers: adminAuthHeaders() });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.log("DEBUG: API error:", err);
        studentLessons = [];
        showEmpty(err.error || "No published lessons yet. Ask your teacher to publish one.");
        return;
      }

      const data = await res.json();
      studentLessons = data.lessons || [];
      console.log("Lessons count:", studentLessons.length);

      if (selectedLesson?.file_id) {
        const matched = studentLessons.find((lesson) => lesson.file_id === selectedLesson.file_id);
        if (matched) {
          selectedLesson = { ...selectedLesson, ...matched };
        }
      }

      // When no subject was passed in the URL, default to showing every lesson
      // (legacy behavior). When a subject is pinned, filtering happens inside
      // getActiveStudentLessons().
      if (!selectedSubjectId && studentLessons.length === 0) {
        showEmpty("No published lesson yet. Ask your teacher to publish one.");
        return;
      }
      if (selectedSubjectId && getActiveStudentLessons().length === 0 && studentLessons.length === 0) {
        showEmpty("No published lesson yet for this subject.");
        return;
      }

      if (emptyEl) emptyEl.hidden = true;
      renderLessonSelection();
    } catch (e) {
      console.log("DEBUG: loadStudentLessons error:", e);
      showEmpty("Cannot reach the Ubuntu API. Set the backend URL in Settings (learniq-api-base).");
    }
  }

  async function loadStudentLesson() {
    try {
      const res = await fetch(apiUrl("/student/lesson"));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showEmpty(err.error || "No published lesson yet. Ask your teacher to publish one.");
        return;
      }
      const data = await res.json();
      showLesson(data);
    } catch {
      showEmpty("Cannot reach the Ubuntu API. Set the backend URL in Settings (learniq-api-base).");
    }
  }

  
  function showContentSection(contentType) {
    activeContentType = contentType;
    const panelMap = {
      lesson: tabLesson,
      reviewer: tabReviewer,
      quiz: tabQuiz,
      activity: tabActivity
    };
    Object.entries(panelMap).forEach(([key, panel]) => {
      if (!panel) return;
      panel.hidden = key !== contentType;
    });
    lessonTabButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lesson-tab") === contentType);
    });

    switch (contentType) {
      case "lesson":
        if (tabLesson) {
          tabLesson.innerHTML = '<p class="small-note">Use the AI actions to generate reviewer, quiz, and activities for this lesson.</p>';
        }
        break;
      case "reviewer":
        if (
          selectedLesson &&
          (typeof normalizeReviewerMarkdown === "function"
            ? normalizeReviewerMarkdown(selectedLesson.reviewer)
            : String(selectedLesson.reviewer || "").trim())
        ) {
          updateReviewerDisplay(selectedLesson.reviewer);
          try {
            if (typeof recordStudentHistory === "function") {
              recordStudentHistory("reviewer", {
                lesson_id: selectedLesson.file_id || selectedLesson.lesson_id || null,
                lesson_title: selectedLesson.title || selectedLesson.filename || "Lesson",
                subject_name: selectedLesson.subject_name || "",
              });
            }
          } catch (e) {
            console.warn("recordStudentHistory(reviewer) failed:", e);
          }
        } else {
          if (reviewerList) {
            reviewerList.innerHTML =
              '<p class="small-note">No reviewer content yet. Click &quot;Generate Reviewer&quot;.</p>';
          }
          const pdfBtn = document.getElementById("student-download-reviewer-pdf-btn");
          if (pdfBtn) pdfBtn.hidden = true;
        }
        break;
      case "quiz":
        if (selectedLesson && selectedLesson.quiz && selectedLesson.quiz.length > 0) {
          lessonData = selectedLesson;
          renderStudentQuiz();
        } else {
          if (quizBody) quizBody.innerHTML = '<p class="small-note">No quiz questions yet. Click "Generate Quiz".</p>';
          if (quizProgress) quizProgress.textContent = "";
          if (quizScoreEl) quizScoreEl.textContent = "";
        }
        break;
      case "activity":
        if (selectedLesson && selectedLesson.activities && selectedLesson.activities.length > 0) {
          updateActivitiesDisplay(selectedLesson.activities);
          try {
            if (typeof recordStudentHistory === "function") {
              recordStudentHistory("activity", {
                lesson_id: selectedLesson.file_id || selectedLesson.lesson_id || null,
                lesson_title: selectedLesson.title || selectedLesson.filename || "Lesson",
                subject_name: selectedLesson.subject_name || "",
                activity_count: selectedLesson.activities.length,
              });
            }
          } catch (e) {
            console.warn("recordStudentHistory(activity) failed:", e);
          }
        } else {
          if (activitiesList) activitiesList.innerHTML = '<p class="small-note">No activities yet. Click "Generate Activity".</p>';
        }
        break;
    }
  }

  async function refreshSelectedLessonContent() {
    if (!selectedLesson?.file_id) return;
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(selectedLesson.file_id)}`));
    if (!res.ok) return;
    const payload = await res.json();
    selectedLesson = {
      ...selectedLesson,
      reviewer: payload.reviewer ?? "",
      quiz: payload.quiz || [],
      activities: payload.activities || []
    };
    lessonData = selectedLesson;
  }

  async function runStudentAiAction(actionType) {
    if (!selectedLesson?.file_id) {
      showToast("Please open a lesson workspace first.", "error");
      return;
    }

    try {
      _aiCooldownAssert(actionType);
    } catch (cooldownErr) {
      showToast(cooldownErr.message, "error");
      return;
    }

    const endpointUrl =
      actionType === "reviewer"
        ? apiUrl("/generate-reviewer")
        : actionType === "quiz"
        ? apiUrl("/generate-question")
        : apiUrl("/generate-activities");

    const requestPayload = { file_id: selectedLesson.file_id };
    if (actionType === "quiz") {
      requestPayload.quiz_count = Number(quizCountSelect?.value || 10);
      const diff = (quizDifficultySelect?.value || "").trim();
      if (diff) requestPayload.difficulty = diff;
    }
    if (actionType === "activity") {
      requestPayload.activity_type = (activityTypeSelect?.value || "essay").trim();
      requestPayload.count = requestPayload.activity_type === "flashcards" ? 10 : 5;
    }

    console.log("STARTING AI GENERATION");
    console.log("AI actionType:", actionType);
    console.log("AI endpoint URL:", endpointUrl);
    console.log("AI payload:", requestPayload);
    console.log("Selected lesson:", selectedLesson);

    const actionMap = {
      reviewer: {
        button: document.getElementById("student-generate-reviewer-btn"),
        endpoint: "/generate-reviewer",
        loading: "Generating reviewer with AI...",
        done: "Reviewer generated."
      },
      quiz: {
        button: document.getElementById("student-generate-quiz-btn"),
        endpoint: "/generate-question",
        loading: "Creating quiz questions...",
        done: "Quiz generated."
      },
      activity: {
        button: document.getElementById("student-generate-activity-btn"),
        endpoint: "/generate-activities",
        loading: "Preparing activities...",
        done: "Activities generated."
      }
    };

    const config = actionMap[actionType];
    if (!config) return;
    const btn = config.button;
    const originalText = btn ? btn.innerHTML : "";
    const cancelAiBtn = document.getElementById("student-ai-cancel-btn");

    studentAiAbortController?.abort();
    studentAiAbortController = new AbortController();
    const { signal } = studentAiAbortController;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loader"></span> Working...';
    }
    if (cancelAiBtn) {
      cancelAiBtn.hidden = false;
      cancelAiBtn.disabled = false;
    }
    if (aiStatusEl) aiStatusEl.textContent = config.loading;

    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
        body: JSON.stringify(requestPayload),
        signal
      });

      console.log("AI RESPONSE STATUS:", res.status);

      const payload = await res.json().catch(() => ({}));
      console.log("AI RESPONSE DATA:", payload);

      if (!res.ok) {
        const errValue = payload?.error ?? payload?.message ?? payload;
        const errMsg =
          typeof errValue === "string"
            ? errValue
            : errValue && typeof errValue === "object"
            ? JSON.stringify(errValue)
            : `Request failed (HTTP ${res.status})`;
        throw new Error(errMsg);
      }

      await refreshSelectedLessonContent();
      if (actionType === "quiz") {
        quizIndex = 0;
        quizScore = 0;
        quizAnswered = false;
        studentAnswers = [];
        lessonData = Array.isArray(selectedLesson?.quiz) && selectedLesson.quiz.length
          ? { ...selectedLesson, quiz: shuffleQuizForStudent(selectedLesson.quiz) }
          : selectedLesson;
      }
      try {
        if (typeof recordStudentHistory === "function" && selectedLesson?.file_id) {
          const base = {
            lesson_id: selectedLesson.file_id,
            lesson_title: selectedLesson.title || selectedLesson.filename || "Lesson",
            subject_name: selectedLesson.subject_name || "",
          };
          if (actionType === "quiz") {
            const qList = Array.isArray(selectedLesson.quiz) ? selectedLesson.quiz : [];
            recordStudentHistory("quiz", {
              ...base,
              score: 0,
              total: qList.length,
              questions: [],
              generated_only: true,
            });
          } else if (actionType === "reviewer") {
            recordStudentHistory("reviewer", base);
          } else if (actionType === "activity") {
            const acts = Array.isArray(selectedLesson.activities) ? selectedLesson.activities : [];
            recordStudentHistory("activity", { ...base, activity_count: acts.length });
          }
        }
      } catch (histErr) {
        console.warn("recordStudentHistory after AI generate failed:", histErr);
      }
      _aiCooldownStart(actionType);
      showContentSection(actionType);
      if (aiStatusEl) aiStatusEl.textContent = config.done;
      showToast(config.done, "success");
    } catch (error) {
      console.error("AI Generation Error:", error);
      if (error?.name === "AbortError" || signal.aborted) {
        if (aiStatusEl) aiStatusEl.textContent = "Generation cancelled.";
        showToast("Generation cancelled.", "info");
      } else {
        const msg =
          error && typeof error === "object" && "message" in error
            ? String(error.message || "Unknown error")
            : String(error || "Unknown error");
        if (aiStatusEl) aiStatusEl.textContent = `Generation failed: ${msg}`;
        showToast(`Failed to generate ${actionType}: ${msg}`, "error");
      }
    } finally {
      studentAiAbortController = null;
      if (cancelAiBtn) {
        cancelAiBtn.hidden = true;
        cancelAiBtn.disabled = true;
      }
      if (btn && !window.AiGenCooldown?.getRemainingMs?.(actionType)) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
      window.AiGenCooldown?.refreshButtons?.();
    }
  }

  // Handle generation button click
  const generateBtn = document.getElementById("generate-btn");
  const cancelGenerationBtn = document.getElementById("cancel-generation-btn");
  
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      const generationOptions = document.querySelector(".generation-options");
      const action = generationOptions.dataset.currentAction;
      
      if (!action || !selectedLesson?.file_id) {
        showToast("Please select a lesson first.", "error");
        return;
      }

      try {
        _aiCooldownAssert(action);
      } catch (cooldownErr) {
        showToast(cooldownErr.message, "error");
        return;
      }

      // Disable button and show loading
      generateBtn.disabled = true;
      const originalText = generateBtn.innerHTML;
      generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
      
      try {
        const fileId = selectedLesson.file_id;
        let requestBody = { file_id: fileId };
        
        // Add parameters based on action type
        if (action === "quiz") {
          const quizCount = document.getElementById("quiz-count").value;
          requestBody.quiz_count = parseInt(quizCount);
        } else if (action === "activity") {
          const activityType = document.getElementById("activity-type").value;
          requestBody.activity_type = activityType;
        }

        let response;
        switch (action) {
          case "reviewer":
            response = await fetch(apiUrl("/generate-reviewer"), {
              method: "POST",
              headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
              body: JSON.stringify(requestBody)
            });
            break;
          case "quiz":
            response = await fetch(apiUrl("/generate-question"), {
              method: "POST",
              headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
              body: JSON.stringify(requestBody)
            });
            break;
          case "activity":
            response = await fetch(apiUrl("/generate-activities"), {
              method: "POST",
              headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
              body: JSON.stringify(requestBody)
            });
            break;
          default:
            return;
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || `Failed to generate ${action}`);
        }

        const result = await response.json();
        console.log(`[DEBUG] ${action} API response:`, result);
        
        // Reload lesson data from database to ensure consistency
        console.log("[DEBUG] Reloading lesson data...");
        await loadStudentLessons(); // Reload all lessons to maintain selection state
        console.log(`[DEBUG] Lesson data reloaded. ${action}:`, selectedLesson?.[action === 'quiz' ? 'quiz' : 'activities']);
        
        // Close modal and focus section
        closeActionModal();
        focusStudentSection(action);
        
        // Show success message with details
        let successMessage = `Successfully generated ${action}!`;
        if (action === "quiz" && result.count) {
          successMessage += ` Created ${result.count} questions.`;
        } else if (action === "activity" && result.total_activities) {
          successMessage += ` Total activities: ${result.total_activities}.`;
        }
        _aiCooldownStart(action);
        showToast(successMessage, "success");
        
      } catch (error) {
        console.error(`Error generating ${action}:`, error);
        showToast(`Failed to generate ${action}: ${error.message}`, "error");
      } finally {
        generateBtn.innerHTML = originalText;
        window.AiGenCooldown?.refreshButtons?.();
        closeActionModal();
      }
    });
  }

  window.AiGenCooldown?.registerDefaults?.();
  window.AiGenCooldown?.refreshButtons?.();
  
  // Handle cancel button click
  if (cancelGenerationBtn) {
    cancelGenerationBtn.addEventListener("click", () => {
      closeActionModal();
    });
  }
  document.getElementById("student-refresh-lesson-btn")?.addEventListener("click", () => {
    loadStudentLessons();
  });
  lessonTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-lesson-tab");
      if (!tab) return;
      showContentSection(tab);
    });
  });
  document.getElementById("student-ai-cancel-btn")?.addEventListener("click", () => {
    studentAiAbortController?.abort();
  });
  document.getElementById("student-generate-reviewer-btn")?.addEventListener("click", () => {
    if (window.AiGenCooldown?.getRemainingMs?.("reviewer") > 0) {
      showToast(
        `Please wait ${Math.ceil(window.AiGenCooldown.getRemainingMs("reviewer") / 1000)}s before generating reviewer again.`,
        "error"
      );
      return;
    }
    runStudentAiAction("reviewer");
  });
  document.getElementById("student-download-reviewer-pdf-btn")?.addEventListener("click", () => {
    if (!reviewerList || typeof downloadReviewerPdfFromElement !== "function") return;
    downloadReviewerPdfFromElement(reviewerList, selectedLesson?.filename || "reviewer");
  });
  document.getElementById("student-generate-quiz-btn")?.addEventListener("click", () => {
    if (window.AiGenCooldown?.getRemainingMs?.("quiz") > 0) {
      showToast(
        `Please wait ${Math.ceil(window.AiGenCooldown.getRemainingMs("quiz") / 1000)}s before generating quiz again.`,
        "error"
      );
      return;
    }
    openModal(quizSettingsModal);
  });
  document.getElementById("student-generate-activity-btn")?.addEventListener("click", () => {
    if (window.AiGenCooldown?.getRemainingMs?.("activity") > 0) {
      showToast(
        `Please wait ${Math.ceil(window.AiGenCooldown.getRemainingMs("activity") / 1000)}s before generating activity again.`,
        "error"
      );
      return;
    }
    openModal(activitySettingsModal);
  });

  quizSettingsClose?.addEventListener("click", () => closeModal(quizSettingsModal));
  quizSettingsCancel?.addEventListener("click", () => closeModal(quizSettingsModal));
  quizSettingsConfirm?.addEventListener("click", async () => {
    closeModal(quizSettingsModal);
    await runStudentAiAction("quiz");
  });

  activitySettingsClose?.addEventListener("click", () => closeModal(activitySettingsModal));
  activitySettingsCancel?.addEventListener("click", () => closeModal(activitySettingsModal));
  activitySettingsConfirm?.addEventListener("click", async () => {
    closeModal(activitySettingsModal);
    await runStudentAiAction("activity");
  });
  loadStudentLessons();
}

async function renderAiResultPage() {
  const reviewerList = document.querySelector("#reviewer-result");
  const quizList = document.querySelector("#quiz-result");
  const activitiesList = document.querySelector("#activities-result");
  if (!reviewerList || !quizList || !activitiesList) return;

  hydrateStudentSidebarChip();

  const params = new URLSearchParams(window.location.search);
  let fileId = params.get("file_id") || localStorage.getItem(TEACHER_FILE_STORAGE_KEY);
  if (!fileId) {
    reviewerList.innerHTML =
      '<p class="small-note">Go to My Subjects, open a subject, then select or upload a lesson to review it here.</p>';
    quizList.innerHTML = "<li>—</li>";
    activitiesList.innerHTML = "<li>—</li>";
    return;
  }

  const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(fileId)}`));
  if (!res.ok) {
    reviewerList.innerHTML = '<p class="small-note">Could not load this lesson.</p>';
    quizList.innerHTML = "<li>—</li>";
    activitiesList.innerHTML = "<li>—</li>";
    return;
  }

  const payload = await res.json();
  const pdfBtn = document.getElementById("ai-result-download-reviewer-pdf");
  if (typeof mountReviewerMarkdownInto === "function") {
    mountReviewerMarkdownInto(reviewerList, payload.reviewer);
  } else {
    reviewerList.innerHTML = `<div class="reviewer-markdown-body"><p>${escapeHtml(
      String(payload.reviewer || "")
    )}</p></div>`;
  }
  if (pdfBtn && typeof setReviewerPdfButtonVisible === "function") {
    const has =
      typeof normalizeReviewerMarkdown === "function"
        ? normalizeReviewerMarkdown(payload.reviewer).length > 0
        : Boolean(String(payload.reviewer || "").trim());
    setReviewerPdfButtonVisible(pdfBtn, has);
    pdfBtn.onclick = () => {
      if (typeof downloadReviewerPdfFromElement === "function") {
        downloadReviewerPdfFromElement(reviewerList, payload.filename || "reviewer");
      }
    };
  }

  const quiz = Array.isArray(payload.quiz) ? payload.quiz : [];
  quizList.innerHTML = quiz.length
    ? quiz
        .map(
          (item) => `
        <li>
          <strong>${escapeHtml(item.question)}</strong><br />
          <span>${(item.choices || []).map((c) => escapeHtml(c)).join(" • ")}</span><br />
          <small>Answer: ${escapeHtml(item.answer)}</small>
        </li>
      `
        )
        .join("")
    : "<li>No quiz items yet.</li>";

  const acts = Array.isArray(payload.activities) ? payload.activities : [];
  activitiesList.innerHTML =
    acts
      .map((item) => {
        if (typeof item === "string") return `<li>${escapeHtml(item)}</li>`;
        if (item && typeof item === "object") {
          if (item.activity_type === "flashcards" && Array.isArray(item.cards)) {
            const cards = item.cards
              .filter((c) => c && c.front && c.back)
              .map(
                (c) =>
                  `<li><strong>${escapeHtml(c.front)}</strong> — ${escapeHtml(c.back)}</li>`
              )
              .join("");
            return `<li><strong>Flashcards</strong><ul>${cards}</ul></li>`;
          }
          if (item.activity_type === "essay" && item.question) {
            return `<li><strong>Essay:</strong> ${escapeHtml(item.question)}${
              item.answer
                ? `<br /><small>Sample: ${escapeHtml(String(item.answer))}</small>`
                : ""
            }</li>`;
          }
          if (item.question != null) {
            const ans =
              typeof item.answer === "boolean"
                ? item.answer
                  ? "True"
                  : "False"
                : item.answer == null
                ? "—"
                : String(item.answer);
            return `<li><strong>${escapeHtml(item.question)}</strong><br /><small>Answer: ${escapeHtml(ans)}</small></li>`;
          }
          return `<li>${escapeHtml(JSON.stringify(item))}</li>`;
        }
        return `<li>${escapeHtml(String(item))}</li>`;
      })
      .join("") || "<li>No activities yet.</li>";
}

// =====================================================================
// Student History (Quiz / Reviewer / Activity)
// =====================================================================

const STUDENT_HISTORY_KEYS = {
  quiz: "learniq_history_quiz",
  reviewer: "learniq_history_reviewer",
  activity: "learniq_history_activity",
  battle: "learniq_history_battle",
};
const STUDENT_HISTORY_MAX_PER_TYPE = 100;
let activeHistoryTab = "quiz";
let currentHistoryDetailContext = null;
/** Server-backed history (Supabase); localStorage remains as fallback/cache. */
let studentHistoryServerCache = {
  loaded: false,
  loading: false,
  quiz: [],
  reviewer: [],
  activity: [],
  battle: [],
};

function getStudentHistoryUserKey() {
  try {
    const session = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
    const idn = String(session?.id_number || "").trim();
    return idn ? `:${idn}` : "";
  } catch {
    return "";
  }
}

function readStudentHistoryListLocal(type) {
  try {
    const baseKey = STUDENT_HISTORY_KEYS[type];
    if (!baseKey) return [];
    const key = `${baseKey}${getStudentHistoryUserKey()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function historyEntryDedupKey(type, item) {
  if (item?.id) return `${type}:${item.id}`;
  const lid = String(item?.lesson_id || "");
  const ts = item?.timestamp ? new Date(item.timestamp).getTime() : 0;
  return `${type}:${lid}:${ts}`;
}

function readStudentHistoryList(type) {
  const local = readStudentHistoryListLocal(type);
  if (!studentHistoryServerCache.loaded) return local;
  const server = studentHistoryServerCache[type] || [];
  const seen = new Set();
  const merged = [];
  for (const item of [...server, ...local]) {
    const key = historyEntryDedupKey(type, item);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  merged.sort((a, b) => {
    const ta = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });
  return merged.slice(0, STUDENT_HISTORY_MAX_PER_TYPE);
}

async function fetchStudentHistoryFromServer() {
  if (studentHistoryServerCache.loading) return;
  const session = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  const idn = String(session?.id_number || "").trim();
  if (!idn) return;
  studentHistoryServerCache.loading = true;
  try {
    const res = await fetch(
      apiUrl(`/student/learning-history?student_id_number=${encodeURIComponent(idn)}`),
      { headers: adminAuthHeaders() }
    );
    if (!res.ok) {
      console.warn("fetchStudentHistoryFromServer:", res.status);
      return;
    }
    const data = await res.json();
    studentHistoryServerCache.quiz = Array.isArray(data.quiz) ? data.quiz : [];
    studentHistoryServerCache.reviewer = Array.isArray(data.reviewer) ? data.reviewer : [];
    studentHistoryServerCache.activity = Array.isArray(data.activity) ? data.activity : [];
    studentHistoryServerCache.battle = Array.isArray(data.battle) ? data.battle : [];
    studentHistoryServerCache.loaded = true;
    syncServerHistoryToLocalStorage();
    if (typeof updateStudentHistoryTabCounts === "function") updateStudentHistoryTabCounts();
    if (document.getElementById("history-list-host")) {
      setStudentHistoryActiveTab(activeHistoryTab);
    }
  } catch (e) {
    console.warn("fetchStudentHistoryFromServer failed:", e);
  } finally {
    studentHistoryServerCache.loading = false;
  }
}

function syncServerHistoryToLocalStorage() {
  ["quiz", "reviewer", "activity", "battle"].forEach((type) => {
    const merged = readStudentHistoryList(type);
    if (merged.length) writeStudentHistoryList(type, merged);
  });
}

async function persistStudentHistoryToServer(type, payload) {
  if (type === "quiz") return;
  const session = typeof getCurrentUserSession === "function" ? getCurrentUserSession() : null;
  const idn = String(session?.id_number || "").trim();
  if (!idn || !STUDENT_HISTORY_KEYS[type]) return;
  try {
    const res = await fetch(apiUrl("/student/learning-history"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({
        student_id_number: idn,
        event_type: type,
        ...(payload || {}),
      }),
    });
    if (res.ok && studentHistoryServerCache.loaded) {
      void fetchStudentHistoryFromServer();
    }
  } catch (e) {
    console.warn("persistStudentHistoryToServer failed:", e);
  }
}

function writeStudentHistoryList(type, list) {
  try {
    const baseKey = STUDENT_HISTORY_KEYS[type];
    if (!baseKey) return;
    const key = `${baseKey}${getStudentHistoryUserKey()}`;
    const capped = Array.isArray(list) ? list.slice(0, STUDENT_HISTORY_MAX_PER_TYPE) : [];
    localStorage.setItem(key, JSON.stringify(capped));
  } catch (e) {
    console.warn("writeStudentHistoryList failed:", e);
  }
}

function recordStudentHistory(type, payload) {
  if (!STUDENT_HISTORY_KEYS[type]) return;
  const entry = {
    ...(payload || {}),
    timestamp: new Date().toISOString(),
  };
  const list = readStudentHistoryList(type);

  // For reviewer/activity, avoid spam by collapsing repeat opens of the same
  // lesson within a 5-minute window into the most recent entry.
  if (type !== "quiz" && list.length > 0) {
    const last = list[0];
    const sameLesson = String(last.lesson_id || "") === String(payload?.lesson_id || "");
    const lastTime = last.timestamp ? new Date(last.timestamp).getTime() : 0;
    const recently = Date.now() - lastTime < 5 * 60 * 1000;
    if (sameLesson && recently) {
      list[0] = entry;
      writeStudentHistoryList(type, list);
      if (typeof updateStudentHistoryTabCounts === "function") updateStudentHistoryTabCounts();
      return;
    }
  }

  list.unshift(entry);
  writeStudentHistoryList(type, list);
  if (typeof updateStudentHistoryTabCounts === "function") updateStudentHistoryTabCounts();
  void persistStudentHistoryToServer(type, entry);
}

function formatHistoryTimestamp(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function buildHistoryItemHtml(type, item, index) {
  const title = escapeHtml(String(item.lesson_title || item.title || "Lesson"));
  const subject = item.subject_name
    ? `<span class="history-pill">${escapeHtml(item.subject_name)}</span>`
    : "";
  const when = formatHistoryTimestamp(item.timestamp);
  let iconHtml = "";
  let summary = "";

  if (type === "quiz") {
    const score = Number(item.score || 0);
    const total = Number(item.total || 0);
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    iconHtml = '<i class="fa-solid fa-clipboard-question" aria-hidden="true"></i>';
    if (item.generated_only) {
      summary = `<span class="history-summary-pill">Quiz generated <span class="small-note">(${total} question${total === 1 ? "" : "s"})</span></span>`;
    } else {
      summary = `<span class="history-summary-pill">Score <strong>${score}/${total}</strong> &nbsp;<span class="small-note">(${pct}%)</span></span>`;
    }
  } else if (type === "reviewer") {
    iconHtml = '<i class="fa-solid fa-book" aria-hidden="true"></i>';
    summary = '<span class="small-note">Reviewer opened</span>';
  } else if (type === "activity") {
    iconHtml = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>';
    summary = '<span class="small-note">Activity opened</span>';
  } else if (type === "battle") {
    const won = String(item.outcome || "").toLowerCase() === "win";
    const correct = Number(item.correct_answers || 0);
    iconHtml = '<i class="fa-solid fa-gamepad" aria-hidden="true"></i>';
    summary = `<span class="history-summary-pill">${won ? "Victory" : "Defeat"} <span class="small-note">(${correct} word${correct === 1 ? "" : "s"} correct)</span></span>`;
  }

  return `
    <button type="button" class="history-item" data-history-type="${escapeHtml(type)}" data-history-index="${index}" aria-label="View ${escapeHtml(type)} details for ${title}">
      <span class="history-item-icon">${iconHtml}</span>
      <span class="history-item-body">
        <span class="history-item-header">
          <span class="history-item-title">${title}</span>
          ${subject}
        </span>
        <span class="history-item-summary-line">${summary}</span>
      </span>
      <span class="history-item-date">
        <i class="fa-regular fa-clock" aria-hidden="true"></i>
        <span>${escapeHtml(when)}</span>
      </span>
      <span class="history-item-chevron" aria-hidden="true">
        <i class="fa-solid fa-chevron-right"></i>
      </span>
    </button>
  `;
}

function renderStudentHistoryList(type) {
  const host = document.getElementById("history-list-host");
  if (!host) return;
  const list = readStudentHistoryList(type);
  if (!list.length) {
    const labels = {
      quiz: {
        title: "No quiz history yet",
        body: "Generate or finish a quiz from My lesson — completed attempts and generated quizzes appear here.",
      },
      reviewer: {
        title: "No reviewer history yet",
        body: "Generate or open a reviewer from My lesson and it will appear here.",
      },
      activity: {
        title: "No activity history yet",
        body: "Generate or open activities from My lesson and they will appear here.",
      },
      battle: {
        title: "No Battle Arena history yet",
        body: "Finish a battle in AI Battle Arena and the result will appear here.",
      },
    };
    const l = labels[type] || labels.quiz;
    host.innerHTML = `
      <article class="glass-card content-card history-empty">
        <h3>${l.title}</h3>
        <p class="content-subtitle">${l.body}</p>
      </article>
    `;
    return;
  }
  host.innerHTML = list.map((item, idx) => buildHistoryItemHtml(type, item, idx)).join("");
}

// --- History detail modal ---

function openHistoryDetailModal() {
  const modal = document.getElementById("history-detail-modal");
  if (!modal) return;
  modal.removeAttribute("hidden");
  document.body.style.overflow = "hidden";
}

function closeHistoryDetailModal() {
  const modal = document.getElementById("history-detail-modal");
  if (!modal) return;
  modal.setAttribute("hidden", "");
  document.body.style.overflow = "";
}

function setHistoryDetailHeader(title, subtitle) {
  const titleEl = document.getElementById("history-detail-title");
  const subEl = document.getElementById("history-detail-subtitle");
  if (titleEl) titleEl.textContent = title || "Details";
  if (subEl) subEl.textContent = subtitle || "";
}

function setHistoryDetailBody(html) {
  const body = document.getElementById("history-detail-body");
  if (body) body.innerHTML = html;
}

function renderQuizDetailIntoModal(item) {
  const questions = Array.isArray(item?.questions) ? item.questions : [];
  const score = Number(item?.score || 0);
  const total = Number(item?.total || 0);
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  const summary = `
    <div class="history-detail-score-card">
      <div>
        <p class="small-note" style="margin:0;">Final score</p>
        <h2 style="margin:0.15rem 0 0;">${score} / ${total}</h2>
      </div>
      <div class="history-detail-score-pct">
        <strong>${pct}%</strong>
      </div>
    </div>
  `;

  if (!questions.length) {
    setHistoryDetailBody(`
      ${summary}
      <p class="small-note" style="margin-top:1rem;">No question details were saved for this attempt.</p>
    `);
    return;
  }

  const rows = questions
    .map((q, i) => {
      const studentAns = q.student_answer ? String(q.student_answer).toUpperCase() : "—";
      const correctAns = String(q.answer || "").trim().toUpperCase();
      const ok = studentAns !== "—" && studentAns === correctAns;
      const choicesHtml = Array.isArray(q.choices)
        ? q.choices
            .map((c, idx) => {
              const letter = ["A", "B", "C", "D", "E"][idx] || String(idx + 1);
              const isStudent = studentAns === letter;
              const isCorrect = correctAns === letter;
              const cls = [
                "history-quiz-choice",
                isStudent ? "is-student" : "",
                isCorrect ? "is-correct" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `<li class="${cls}"><strong>${letter}.</strong> ${escapeHtml(String(c))}</li>`;
            })
            .join("")
        : "";
      return `
        <article class="history-quiz-question">
          <header class="history-quiz-question-head">
            <h4>Q${i + 1}. ${escapeHtml(String(q.question || ""))}</h4>
            <span class="history-quiz-mark ${ok ? "is-ok" : "is-bad"}">
              ${ok ? '<i class="fa-solid fa-circle-check"></i> Correct' : '<i class="fa-solid fa-circle-xmark"></i> Wrong'}
            </span>
          </header>
          <ol class="history-quiz-choices">${choicesHtml}</ol>
          <p class="small-note history-quiz-answer-line">
            Your answer: <strong>${escapeHtml(studentAns)}</strong> &nbsp;·&nbsp;
            Correct answer: <strong>${escapeHtml(correctAns || "—")}</strong>
          </p>
        </article>
      `;
    })
    .join("");

  setHistoryDetailBody(`
    ${summary}
    <div class="history-quiz-list">${rows}</div>
  `);
}

async function renderReviewerDetailIntoModal(item) {
  setHistoryDetailBody('<p class="small-note">Loading reviewer…</p>');
  const lessonId = item?.lesson_id;
  if (!lessonId) {
    setHistoryDetailBody('<p class="small-note">No lesson linked to this entry.</p>');
    return;
  }
  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(lessonId)}`));
    if (!res.ok) {
      setHistoryDetailBody('<p class="small-note">Failed to load reviewer content.</p>');
      return;
    }
    const data = await res.json();
    const reviewer = data?.reviewer;
    const hasReviewer =
      typeof normalizeReviewerMarkdown === "function"
        ? normalizeReviewerMarkdown(reviewer).length > 0
        : Boolean(String(reviewer || "").trim());

    if (!hasReviewer) {
      setHistoryDetailBody('<p class="small-note">No reviewer content available for this lesson anymore.</p>');
      return;
    }

    setHistoryDetailBody('<div id="history-reviewer-target" class="reviewer-markdown-body"></div>');
    const target = document.getElementById("history-reviewer-target");
    if (typeof mountReviewerMarkdownInto === "function") {
      mountReviewerMarkdownInto(target, reviewer);
    } else if (target) {
      target.innerHTML = `<pre>${escapeHtml(String(reviewer || ""))}</pre>`;
    }
  } catch (e) {
    console.warn("renderReviewerDetailIntoModal error:", e);
    setHistoryDetailBody('<p class="small-note">Could not reach the server.</p>');
  }
}

async function renderActivityDetailIntoModal(item) {
  setHistoryDetailBody('<p class="small-note">Loading activity…</p>');
  const lessonId = item?.lesson_id;
  if (!lessonId) {
    setHistoryDetailBody('<p class="small-note">No lesson linked to this entry.</p>');
    return;
  }
  try {
    const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(lessonId)}`));
    if (!res.ok) {
      setHistoryDetailBody('<p class="small-note">Failed to load activity content.</p>');
      return;
    }
    const data = await res.json();
    const activities = Array.isArray(data?.activities) ? data.activities : [];
    if (!activities.length) {
      setHistoryDetailBody('<p class="small-note">No activities available for this lesson anymore.</p>');
      return;
    }
    setHistoryDetailBody('<div class="history-activity-list" id="history-activity-render-target"></div>');
    const target = document.getElementById("history-activity-render-target");
    if (target && typeof renderActivitiesInto === "function") {
      renderActivitiesInto(target, activities);
    } else if (target) {
      target.innerHTML = activities
        .map(
          (act, i) => `
            <article class="activity-item history-activity-item">
              <strong>Activity ${i + 1}</strong>
              <p>${escapeHtml(typeof act === "string" ? act : JSON.stringify(act))}</p>
            </article>
          `
        )
        .join("");
    }
  } catch (e) {
    console.warn("renderActivityDetailIntoModal error:", e);
    setHistoryDetailBody('<p class="small-note">Could not reach the server.</p>');
  }
}

function openHistoryItemDetail(type, index) {
  const list = readStudentHistoryList(type);
  const item = list[Number(index)];
  if (!item) return;
  currentHistoryDetailContext = { type, item };
  const subtitle = [
    item.subject_name ? String(item.subject_name) : "",
    formatHistoryTimestamp(item.timestamp),
  ]
    .filter(Boolean)
    .join(" · ");
  setHistoryDetailHeader(String(item.lesson_title || "Lesson"), subtitle);
  setHistoryDetailBody('<p class="small-note">Loading…</p>');
  openHistoryDetailModal();

  if (type === "quiz") {
    renderQuizDetailIntoModal(item);
  } else if (type === "reviewer") {
    void renderReviewerDetailIntoModal(item);
  } else if (type === "activity") {
    void renderActivityDetailIntoModal(item);
  } else if (type === "battle") {
    renderBattleDetailIntoModal(item);
  } else {
    setHistoryDetailBody('<p class="small-note">Nothing to show.</p>');
  }
}

function renderBattleDetailIntoModal(item) {
  const won = String(item.outcome || "").toLowerCase() === "win";
  const correct = Number(item.correct_answers || 0);
  const damage = Number(item.total_damage || 0);
  setHistoryDetailBody(`
    <article class="history-battle-detail">
      <p class="history-summary-pill ${won ? "is-ok" : "is-bad"}">
        <i class="fa-solid ${won ? "fa-trophy" : "fa-skull"}" aria-hidden="true"></i>
        ${won ? "Victory" : "Defeated"}
      </p>
      <dl class="battle-info-list">
        <div class="battle-info-row">
          <dt>Words answered correctly</dt>
          <dd>${correct}</dd>
        </div>
        <div class="battle-info-row">
          <dt>Total damage dealt</dt>
          <dd>${damage}</dd>
        </div>
      </dl>
    </article>
  `);
}

async function downloadHistoryDetailAsPdf() {
  const body = document.getElementById("history-detail-body");
  const titleEl = document.getElementById("history-detail-title");
  const subEl = document.getElementById("history-detail-subtitle");
  if (!body) return;

  const ctx = currentHistoryDetailContext || {};
  const type = ctx.type || "history";
  const item = ctx.item || {};
  const lessonTitle = String(item.lesson_title || titleEl?.textContent || "history").trim();
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const baseName = `${typeLabel}_${lessonTitle}`;

  const sanitizedTitle = escapeHtml(lessonTitle);
  const sanitizedSubtitle = escapeHtml(String(subEl?.textContent || ""));
  const header = `
    <div class="history-pdf-header">
      <p class="history-pdf-eyebrow">${escapeHtml(typeLabel)} history</p>
      <h1>${sanitizedTitle}</h1>
      ${sanitizedSubtitle ? `<p class="history-pdf-subtitle">${sanitizedSubtitle}</p>` : ""}
    </div>
  `;

  const safeBase =
    (baseName || "history")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 80) || "history";

  const btn = document.getElementById("history-detail-download");
  const originalHtml = btn ? btn.innerHTML : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparing PDF…';
  }

  try {
    if (typeof downloadHtmlAsPdf !== "function") {
      if (typeof showToast === "function") {
        showToast("PDF export is not ready. Refresh the page and try again.", "error");
      }
      return;
    }
    const ok = await downloadHtmlAsPdf(header + body.innerHTML, `${safeBase}.pdf`, "history-pdf-export");
    if (ok && typeof showToast === "function") showToast("PDF downloaded.", "success");
  } finally {
    if (btn) {
      btn.disabled = false;
      if (originalHtml !== null) btn.innerHTML = originalHtml;
    }
  }
}

function updateStudentHistoryTabCounts() {
  ["quiz", "reviewer", "activity", "battle"].forEach((type) => {
    const el = document.getElementById(`history-tab-count-${type}`);
    if (el) el.textContent = String(readStudentHistoryList(type).length);
  });
}

function setStudentHistoryActiveTab(type) {
  const valid = ["quiz", "reviewer", "activity", "battle"];
  if (!valid.includes(type)) type = "quiz";
  activeHistoryTab = type;
  document.querySelectorAll(".workspace-tab[data-history-tab]").forEach((btn) => {
    const tab = btn.getAttribute("data-history-tab");
    const isActive = tab === type;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderStudentHistoryList(type);
}

function setupStudentHistoryPage() {
  initRoleAwareDashboardSidebar();
  if (typeof hydrateSidebarProfileFromDatabase === "function") {
    void hydrateSidebarProfileFromDatabase();
  }
  updateStudentHistoryTabCounts();
  setStudentHistoryActiveTab(activeHistoryTab);
  void fetchStudentHistoryFromServer();

  document.querySelectorAll(".workspace-tab[data-history-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-history-tab");
      setStudentHistoryActiveTab(tab);
    });
  });

  const host = document.getElementById("history-list-host");
  if (host && !host.dataset.historyClicksBound) {
    host.dataset.historyClicksBound = "1";
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".history-item[data-history-type]");
      if (!btn) return;
      const type = btn.getAttribute("data-history-type");
      const idx = btn.getAttribute("data-history-index");
      openHistoryItemDetail(type, idx);
    });
  }

  const modal = document.getElementById("history-detail-modal");
  if (modal && !modal.dataset.historyModalBound) {
    modal.dataset.historyModalBound = "1";
    const closeBtn = document.getElementById("history-detail-close");
    if (closeBtn) closeBtn.addEventListener("click", closeHistoryDetailModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeHistoryDetailModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hasAttribute("hidden")) closeHistoryDetailModal();
    });
    const downloadBtn = document.getElementById("history-detail-download");
    if (downloadBtn) downloadBtn.addEventListener("click", downloadHistoryDetailAsPdf);
  }
}

// Expose for other inline pages / debugging.
if (typeof window !== "undefined") {
  window.recordStudentHistory = recordStudentHistory;
  window.setupStudentHistoryPage = setupStudentHistoryPage;
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired:", window.location.pathname);
  redirectAdminFromTeacherOnlyPages();
  initAdminSidebar();
  initRoleAwareDashboardSidebar();
  initTeacherLearniqSidebarProfile();
  initMobileSidebarDrawer();
  animateProgressBars();
  setupForms();
  setupSignupPage();
  
  // Only run page-specific setup if we're on the correct page
  if (window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/login')) {
    setupLoginPage();
  }
  if (window.location.pathname.includes('signup.html') || window.location.pathname.endsWith('/signup')) {
    // signupPage is already handled by setupSignupPage()
  }
  if (window.location.pathname.includes('admin-approval.html') || window.location.pathname.includes('admin-dashboard.html')) {
    setupAdminPage();
  }
  if (window.location.pathname.includes('admin-subjects.html')) {
    setupAdminSubjectsPage();
  }
  if (window.location.pathname.includes('teacher-learniq-dashboard.html') || window.location.pathname.includes('teacher-dashboard.html')) {
    setupTeacherDashboard();
  }
  if (window.location.pathname.includes('teacher-subject-lessons.html')) {
    setupTeacherSubjectLessonsPage();
  }
  if (window.location.pathname.includes('teacher-subjects.html')) {
    setupTeacherSubjectsPage();
  }
  if (window.location.pathname.includes("teacher-student-registration.html")) {
    setupTeacherStudentRegistrationPage();
  }
  if (window.location.pathname.includes("admin-teacher-registration.html")) {
    setupAdminTeacherRegistrationPage();
  }
  if (window.location.pathname.includes("admin-student-registration.html")) {
    setupAdminStudentRegistrationPage();
  }
  if (window.location.pathname.includes("immersion-dashboard.html")) {
    setupImmersionDashboard();
  }
  if (window.location.pathname.includes("leaderboard.html")) {
    setupLeaderboardPage();
  }
  if (window.location.pathname.includes("module-selection.html")) {
    void setupModuleSelectionPage();
  }
  if (window.location.pathname.includes('learniq-dashboard.html') || window.location.pathname.includes('my-lesson.html')) {
    setupStudentDashboard();
  }
  if (window.location.pathname.includes('subjects.html')) {
    setupSubjectsPage();
  }
  if (window.location.pathname.includes("student-archived.html")) {
    setupStudentArchivedPage();
  }
  if (window.location.pathname.includes('history.html')) {
    setupStudentHistoryPage();
  }
  if (
    window.location.pathname.includes("student-settings.html") ||
    window.location.pathname.includes("teacher-settings.html")
  ) {
    hydrateStudentSidebarChip();
  }
  renderAiResultPage();
  setupProfilePage();
});

function refreshAvatarsAcrossPage(user) {
  if (!window.LearnIQAvatar || !user) return;
  const fullName = getProfileDisplayName(user);
  const fallback = getUserInitials(fullName || user.email || "");
  const sidebar = document.getElementById("student-avatar-initials");
  if (sidebar) window.LearnIQAvatar.applyToElement(sidebar, user, fallback);
  const adminAv = document.getElementById("admin-sidebar-avatar");
  if (adminAv) window.LearnIQAvatar.applyToElement(adminAv, user, fallback || "AD");
  const profileAv = document.getElementById("profile-photo-avatar");
  if (profileAv) window.LearnIQAvatar.applyToElement(profileAv, user, fallback || "ST");
}

/**
 * Open the photo crop / edit modal. Resolves to a 256x256 JPEG data URL
 * representing the user's circular crop, or `null` if they cancel.
 *
 * The stage is a fixed square frame. The source image is positioned with
 * `transform: translate(tx, ty) scale(scale)`, drag pans (tx, ty), the
 * slider scales (anchored to the center). On save, the visible square is
 * drawn from the source image onto a 256x256 canvas.
 */
function openPhotoCropper(file) {
  return new Promise((resolve) => {
    const modal = document.getElementById("photo-crop-modal");
    const img = document.getElementById("photo-crop-img");
    const stage = document.getElementById("photo-crop-stage");
    const zoom = document.getElementById("photo-crop-zoom");
    const zoomIn = document.getElementById("photo-crop-zoom-in");
    const zoomOut = document.getElementById("photo-crop-zoom-out");
    const saveBtn = document.getElementById("photo-crop-save");
    const cancelBtn = document.getElementById("photo-crop-cancel");
    const closeBtn = document.getElementById("photo-crop-modal-close");
    const backdrop = document.getElementById("photo-crop-modal-backdrop");
    if (!modal || !img || !stage || !zoom || !saveBtn || !cancelBtn || !closeBtn || !backdrop) {
      resolve(null);
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    const state = {
      tx: 0,
      ty: 0,
      sMin: 1,
      scale: 1,
      naturalW: 0,
      naturalH: 0,
      frameSize: 300,
      dragging: false,
      dragStart: null,
    };

    function clamp(v, lo, hi) {
      if (hi < lo) return (lo + hi) / 2;
      return Math.min(Math.max(v, lo), hi);
    }

    function applyTransform() {
      const w = state.naturalW * state.scale;
      const h = state.naturalH * state.scale;
      state.tx = clamp(state.tx, state.frameSize - w, 0);
      state.ty = clamp(state.ty, state.frameSize - h, 0);
      img.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    }

    function fitInitial() {
      state.frameSize = stage.clientWidth || 300;
      const F = state.frameSize;
      state.sMin = Math.max(F / state.naturalW, F / state.naturalH);
      state.scale = state.sMin;
      state.tx = (F - state.naturalW * state.scale) / 2;
      state.ty = (F - state.naturalH * state.scale) / 2;
      zoom.value = "1";
      applyTransform();
    }

    function setZoom(zoomValue) {
      const v = Math.max(1, Math.min(parseFloat(zoom.max) || 4, parseFloat(zoomValue) || 1));
      zoom.value = String(v);
      const F = state.frameSize;
      const cx = F / 2;
      const cy = F / 2;
      const newScale = state.sMin * v;
      if (state.scale > 0) {
        state.tx = cx - ((cx - state.tx) / state.scale) * newScale;
        state.ty = cy - ((cy - state.ty) / state.scale) * newScale;
      }
      state.scale = newScale;
      applyTransform();
    }

    function onPointerDown(e) {
      state.dragging = true;
      state.dragStart = { x: e.clientX, y: e.clientY, tx: state.tx, ty: state.ty };
      try { stage.setPointerCapture(e.pointerId); } catch {}
      stage.classList.add("is-grabbing");
    }
    function onPointerMove(e) {
      if (!state.dragging) return;
      state.tx = state.dragStart.tx + (e.clientX - state.dragStart.x);
      state.ty = state.dragStart.ty + (e.clientY - state.dragStart.y);
      applyTransform();
    }
    function onPointerUp(e) {
      if (!state.dragging) return;
      state.dragging = false;
      try { stage.releasePointerCapture(e.pointerId); } catch {}
      stage.classList.remove("is-grabbing");
    }
    function onZoomInput() {
      setZoom(zoom.value);
    }
    function onZoomIn() {
      const step = 0.25;
      setZoom((parseFloat(zoom.value) || 1) + step);
    }
    function onZoomOut() {
      const step = 0.25;
      setZoom((parseFloat(zoom.value) || 1) - step);
    }
    function onKey(e) {
      if (e.key === "Escape") finish(null);
    }
    function onWheel(e) {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      setZoom((parseFloat(zoom.value) || 1) + dir * 0.1);
    }

    function cleanup() {
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("wheel", onWheel);
      zoom.removeEventListener("input", onZoomInput);
      if (zoomIn) zoomIn.removeEventListener("click", onZoomIn);
      if (zoomOut) zoomOut.removeEventListener("click", onZoomOut);
      saveBtn.removeEventListener("click", onSave);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKey);
      try { URL.revokeObjectURL(blobUrl); } catch {}
      img.removeAttribute("src");
      img.style.transform = "";
      modal.hidden = true;
      document.body.classList.remove("lq-modal-open");
    }

    function finish(result) {
      cleanup();
      resolve(result);
    }
    function onCancel() { finish(null); }

    function onSave() {
      try {
        const F = state.frameSize;
        const srcX = -state.tx / state.scale;
        const srcY = -state.ty / state.scale;
        const srcSize = F / state.scale;
        const OUT = 256;
        const canvas = document.createElement("canvas");
        canvas.width = OUT;
        canvas.height = OUT;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        finish(dataUrl);
      } catch (err) {
        console.warn("Crop save failed:", err);
        finish(null);
      }
    }

    img.onload = () => {
      state.naturalW = img.naturalWidth || img.width || 0;
      state.naturalH = img.naturalHeight || img.height || 0;
      if (!state.naturalW || !state.naturalH) {
        finish(null);
        return;
      }
      fitInitial();
    };
    img.onerror = () => finish(null);

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("wheel", onWheel, { passive: false });
    zoom.addEventListener("input", onZoomInput);
    if (zoomIn) zoomIn.addEventListener("click", onZoomIn);
    if (zoomOut) zoomOut.addEventListener("click", onZoomOut);
    saveBtn.addEventListener("click", onSave);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKey);

    modal.hidden = false;
    document.body.classList.add("lq-modal-open");
    img.src = blobUrl;
  });
}

function setupProfilePhotoEditor(user) {
  const wrap = document.getElementById("profile-photo-card");
  const input = document.getElementById("profile-photo-input");
  const chooseBtn = document.getElementById("profile-photo-choose-btn");
  const removeBtn = document.getElementById("profile-photo-remove-btn");
  const avatarEl = document.getElementById("profile-photo-avatar");
  const chooseLabel = document.getElementById("profile-photo-choose-label");
  const hintEl = document.getElementById("profile-photo-hint");
  if (!wrap || !input || !chooseBtn || !avatarEl) return;
  if (wrap.dataset.lqWired === "1") return;
  wrap.dataset.lqWired = "1";

  if (!user || !(user.id_number || user.email)) {
    chooseBtn.disabled = true;
    if (removeBtn) removeBtn.hidden = true;
    if (hintEl) hintEl.textContent = "Sign in first to add or change your profile photo.";
    return;
  }

  function refresh() {
    const fullName = getProfileDisplayName(user);
    const fallback = getUserInitials(fullName || user.email || "") || "ST";
    if (window.LearnIQAvatar) {
      window.LearnIQAvatar.applyToElement(avatarEl, user, fallback);
    } else {
      avatarEl.textContent = fallback;
    }
    const has = !!(window.LearnIQAvatar && window.LearnIQAvatar.get(user));
    if (chooseLabel) chooseLabel.textContent = has ? "Change photo" : "Add photo";
    if (removeBtn) removeBtn.hidden = !has;
  }

  function setStatus(msg, isError) {
    if (!hintEl) return;
    hintEl.textContent = msg || "PNG, JPG, or WEBP. Saved on this device for your profile.";
    hintEl.style.color = isError ? "var(--danger, #ef4444)" : "";
  }

  chooseBtn.addEventListener("click", () => input.click());

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setStatus("Please choose an image file.", true);
      input.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus("Image is too large. Choose a file under 8 MB.", true);
      input.value = "";
      return;
    }
    setStatus("Opening editor…", false);
    try {
      const dataUrl = await openPhotoCropper(file);
      if (!dataUrl) {
        setStatus("");
        input.value = "";
        return;
      }
      setStatus("Uploading…", false);
      chooseBtn.disabled = true;
      if (removeBtn) removeBtn.disabled = true;
      const result = await window.LearnIQAvatar.set(user, dataUrl);
      chooseBtn.disabled = false;
      if (removeBtn) removeBtn.disabled = false;
      if (!result.ok) {
        setStatus(result.reason || "Could not save photo.", true);
      } else {
        setStatus(result.local ? "Photo saved locally." : "Photo updated.", false);
        refresh();
        refreshAvatarsAcrossPage(user);
      }
    } catch (e) {
      chooseBtn.disabled = false;
      if (removeBtn) removeBtn.disabled = false;
      console.warn("Profile photo upload failed:", e);
      setStatus(e && e.message ? e.message : "Could not read that image.", true);
    } finally {
      input.value = "";
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", async () => {
      if (!window.confirm("Remove your profile photo?")) return;
      setStatus("Removing…", false);
      chooseBtn.disabled = true;
      removeBtn.disabled = true;
      const result = await window.LearnIQAvatar.clear(user);
      chooseBtn.disabled = false;
      removeBtn.disabled = false;
      if (!result.ok) {
        setStatus(result.reason || "Could not remove photo.", true);
        return;
      }
      setStatus("Photo removed.", false);
      refresh();
      refreshAvatarsAcrossPage(user);
    });
  }

  refresh();
}

/* ============================================================
 * PSGC cascading address picker
 *
 * Loads Region → Province → City/Municipality → Barangay using the
 * free https://psgc.gitlab.io/api/ service. Final address is composed
 * as a single human-readable string and written into the existing
 * `address` profile column (no DB schema changes needed). The picked
 * components are also cached in localStorage so re-opening the edit
 * form on the same device pre-fills the dropdowns.
 * ============================================================ */
const PSGC_BASE = "https://psgc.gitlab.io/api";
const psgcCache = new Map();

/* ---- Generic full-screen loader (reference-counted) ---- */
let lqLoaderCount = 0;
let lqLoaderEl = null;

function lqEnsureLoader() {
  if (lqLoaderEl) return lqLoaderEl;
  const overlay = document.createElement("div");
  overlay.className = "lq-loader-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-label", "Loading");
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="lq-loader-card">
      <div class="lq-loader-spinner" aria-hidden="true"></div>
      <span class="lq-loader-text">Loading…</span>
    </div>
  `;
  document.body.appendChild(overlay);
  lqLoaderEl = overlay;
  return overlay;
}

function lqShowLoader(message) {
  const el = lqEnsureLoader();
  const txt = el.querySelector(".lq-loader-text");
  if (txt) txt.textContent = message || "Loading…";
  lqLoaderCount += 1;
  el.hidden = false;
}

function lqHideLoader() {
  lqLoaderCount = Math.max(0, lqLoaderCount - 1);
  if (lqLoaderCount === 0 && lqLoaderEl) {
    lqLoaderEl.hidden = true;
  }
}

async function psgcFetchJson(path, loaderMessage) {
  if (psgcCache.has(path)) return psgcCache.get(path);
  const url = `${PSGC_BASE}${path}`;
  const showSpinner = !!loaderMessage;
  if (showSpinner) lqShowLoader(loaderMessage);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`PSGC ${res.status}`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    psgcCache.set(path, arr);
    return arr;
  } finally {
    if (showSpinner) lqHideLoader();
  }
}

function setupAddressPicker() {
  const root = document.getElementById("profile-address-editor");
  const regionSel = document.getElementById("profile-address-region");
  const provinceSel = document.getElementById("profile-address-province");
  const citySel = document.getElementById("profile-address-city");
  const brgySel = document.getElementById("profile-address-barangay");
  const streetInp = document.getElementById("profile-address-street");
  const hiddenInp = document.getElementById("profile-detail-address-input");
  const preview = document.getElementById("profile-address-preview");
  if (!root || !regionSel || !provinceSel || !citySel || !brgySel) return null;

  const COMP_PREFIX = "lq_addr_components_";

  function compKey(user) {
    if (!user) return "";
    const idn = (user.id_number || "").trim();
    if (idn) return COMP_PREFIX + idn;
    const em = (user.email || "").trim().toLowerCase();
    return em ? COMP_PREFIX + em : "";
  }

  function readCachedComponents(user) {
    try {
      const k = compKey(user);
      if (!k) return null;
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : null;
    } catch {
      return null;
    }
  }

  function writeCachedComponents(user, comp) {
    try {
      const k = compKey(user);
      if (!k) return;
      localStorage.setItem(k, JSON.stringify(comp || {}));
    } catch (_) { /* ignore quota errors */ }
  }

  function selectedText(sel) {
    if (!sel) return "";
    const v = String(sel.value || "").trim();
    if (!v || v === "__NONE__") return "";
    const opt = sel.options[sel.selectedIndex];
    return opt ? String(opt.textContent || "").trim() : "";
  }

  function composedValue() {
    const region = selectedText(regionSel);
    const province = selectedText(provinceSel);
    const city = selectedText(citySel);
    const brgy = selectedText(brgySel);
    const street = String((streetInp && streetInp.value) || "").trim();
    const parts = [];
    if (street) parts.push(street);
    if (brgy) parts.push(`Brgy. ${brgy}`);
    if (city) parts.push(city);
    if (province) parts.push(province);
    if (region) parts.push(region);
    return parts.filter(Boolean).join(", ");
  }

  function updatePreview() {
    if (!preview) return;
    const v = composedValue();
    preview.textContent = v ? `Will save as: ${v}` : "";
  }

  function fillSelect(sel, items, placeholder, valueKey = "code") {
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    for (const it of items) {
      const o = document.createElement("option");
      o.value = it[valueKey] || it.code || "";
      o.textContent = it.name || "";
      sel.appendChild(o);
    }
  }

  function resetSelect(sel, placeholder) {
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    sel.disabled = true;
  }

  async function loadProvinces(regionCode, preselectCode) {
    if (!regionCode) {
      resetSelect(provinceSel, "Select region first");
      resetSelect(citySel, "Select province first");
      resetSelect(brgySel, "Select city first");
      updatePreview();
      return;
    }
    provinceSel.disabled = true;
    provinceSel.innerHTML = `<option value="">Loading…</option>`;
    try {
      const list = await psgcFetchJson(`/regions/${regionCode}/provinces/`, "Loading provinces…");
      if (list.length === 0) {
        // NCR has no provinces — load cities directly under the region.
        fillSelect(provinceSel, [{ code: "__NONE__", name: "— (no province)" }], "Select province");
        provinceSel.value = "__NONE__";
        provinceSel.disabled = false;
        await loadCities(regionCode, preselectCode, /*fromRegion*/ true);
      } else {
        fillSelect(provinceSel, list, "Select province");
        provinceSel.disabled = false;
        if (preselectCode) {
          provinceSel.value = preselectCode;
          if (provinceSel.value) await loadCities(provinceSel.value, null, false);
        } else {
          resetSelect(citySel, "Select province first");
          resetSelect(brgySel, "Select city first");
        }
      }
    } catch (e) {
      provinceSel.innerHTML = `<option value="">Could not load provinces</option>`;
    }
    updatePreview();
  }

  async function loadCities(parentCode, preselectCode, fromRegion) {
    if (!parentCode || parentCode === "__NONE__") {
      // If province selection is "(no province)" we need region for cities.
      if (!fromRegion) {
        resetSelect(citySel, "Select province first");
        resetSelect(brgySel, "Select city first");
        updatePreview();
        return;
      }
    }
    citySel.disabled = true;
    citySel.innerHTML = `<option value="">Loading…</option>`;
    try {
      const path = fromRegion
        ? `/regions/${parentCode}/cities-municipalities/`
        : `/provinces/${parentCode}/cities-municipalities/`;
      const list = await psgcFetchJson(path, "Loading cities…");
      fillSelect(citySel, list, "Select city / municipality");
      citySel.disabled = false;
      if (preselectCode) {
        citySel.value = preselectCode;
        if (citySel.value) await loadBarangays(citySel.value, null);
      } else {
        resetSelect(brgySel, "Select city first");
      }
    } catch (e) {
      citySel.innerHTML = `<option value="">Could not load cities</option>`;
    }
    updatePreview();
  }

  async function loadBarangays(cityCode, preselectCode) {
    if (!cityCode) {
      resetSelect(brgySel, "Select city first");
      updatePreview();
      return;
    }
    brgySel.disabled = true;
    brgySel.innerHTML = `<option value="">Loading…</option>`;
    try {
      const list = await psgcFetchJson(`/cities-municipalities/${cityCode}/barangays/`, "Loading barangays…");
      fillSelect(brgySel, list, "Select barangay");
      brgySel.disabled = false;
      if (preselectCode) brgySel.value = preselectCode;
    } catch (e) {
      brgySel.innerHTML = `<option value="">Could not load barangays</option>`;
    }
    updatePreview();
  }

  let regionsReady = null;
  async function ensureRegions() {
    if (regionsReady) return regionsReady;
    regionsReady = (async () => {
      try {
        const list = await psgcFetchJson(`/regions/`, "Loading regions…");
        fillSelect(regionSel, list, "Select region");
        regionSel.disabled = false;
      } catch (e) {
        regionSel.innerHTML = `<option value="">Could not load regions</option>`;
      }
    })();
    return regionsReady;
  }

  regionSel.addEventListener("change", async () => {
    await loadProvinces(regionSel.value, null);
  });
  provinceSel.addEventListener("change", async () => {
    const code = provinceSel.value;
    if (code === "__NONE__") {
      // No province — use region for city list.
      await loadCities(regionSel.value, null, true);
    } else {
      await loadCities(code, null, false);
    }
  });
  citySel.addEventListener("change", async () => {
    await loadBarangays(citySel.value, null);
  });
  brgySel.addEventListener("change", updatePreview);
  if (streetInp) streetInp.addEventListener("input", updatePreview);

  async function loadFor(user, existingAddress) {
    await ensureRegions();
    const cached = readCachedComponents(user);
    if (cached && cached.regionCode) {
      regionSel.value = cached.regionCode;
      await loadProvinces(cached.regionCode, cached.provinceCode || null);
      if (cached.provinceCode === "__NONE__") {
        provinceSel.value = "__NONE__";
        await loadCities(cached.regionCode, cached.cityCode || null, true);
      } else if (cached.cityCode) {
        await loadCities(cached.provinceCode || cached.regionCode, cached.cityCode, !cached.provinceCode);
      }
      if (cached.barangayCode && !brgySel.disabled) {
        brgySel.value = cached.barangayCode;
      }
      if (streetInp) streetInp.value = cached.street || "";
    } else if (streetInp) {
      // No cached components — drop existing address into the street field as a fallback
      streetInp.value = existingAddress || "";
    }
    updatePreview();
  }

  function rememberComponents(user) {
    writeCachedComponents(user, {
      regionCode: regionSel.value,
      provinceCode: provinceSel.value,
      cityCode: citySel.value,
      barangayCode: brgySel.value,
      street: (streetInp && streetInp.value) || "",
    });
    if (hiddenInp) hiddenInp.value = composedValue();
  }

  return {
    root,
    composedValue,
    loadFor,
    rememberComponents,
  };
}

function setupProfileDetailsEditor(user) {
  const card = document.getElementById("profile-details-card");
  const grid = document.getElementById("profile-details-grid");
  const editBtn = document.getElementById("profile-details-edit-btn");
  const saveBtn = document.getElementById("profile-details-save-btn-bottom");
  const cancelBtn = document.getElementById("profile-details-cancel-btn-bottom");
  const footer = document.getElementById("profile-details-footer");
  const hintEl = document.getElementById("profile-details-hint");
  if (!card || !grid || !editBtn || !saveBtn || !cancelBtn) return;
  if (card.dataset.lqWired === "1") return;
  card.dataset.lqWired = "1";

  const FIELDS = ["bio", "phone", "section", "dob", "address"];

  const addressPicker = setupAddressPicker();

  function setStatus(msg, isError) {
    if (!hintEl) return;
    hintEl.textContent = msg || "";
    hintEl.style.color = isError ? "var(--danger, #ef4444)" : "";
  }

  function formatDob(raw) {
    if (!raw) return "—";
    const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return raw;
    try {
      const d = new Date(`${raw}T00:00:00`);
      if (Number.isNaN(d.getTime())) return raw;
      return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return raw;
    }
  }

  function renderView(details) {
    for (const f of FIELDS) {
      const disp = document.getElementById(`profile-detail-${f}-display`);
      if (!disp) continue;
      const val = details && details[f] ? String(details[f]).trim() : "";
      if (!val) {
        disp.textContent = "";
        disp.classList.add("is-empty");
      } else if (f === "dob") {
        disp.textContent = formatDob(val);
        disp.classList.remove("is-empty");
      } else {
        disp.textContent = val;
        disp.classList.remove("is-empty");
      }
    }
  }

  function setMode(mode, details) {
    grid.dataset.mode = mode;
    const editing = mode === "edit";
    for (const f of FIELDS) {
      const disp = document.getElementById(`profile-detail-${f}-display`);
      const inp = document.getElementById(`profile-detail-${f}-input`);
      if (disp) disp.hidden = editing;
      if (f === "address") {
        if (addressPicker && addressPicker.root) addressPicker.root.hidden = !editing;
        if (editing && addressPicker) {
          addressPicker.loadFor(user, (details && details.address) || "");
        }
        continue;
      }
      if (inp) {
        inp.hidden = !editing;
        if (editing) inp.value = (details && details[f]) || "";
      }
    }
    editBtn.hidden = editing;
    if (footer) footer.hidden = !editing;
  }

  if (!user || !(user.id_number || user.email)) {
    editBtn.disabled = true;
    setStatus("Sign in first to add personal details.", false);
    return;
  }

  let current = (window.LearnIQProfileDetails && window.LearnIQProfileDetails.get(user)) || {};
  renderView(current);

  function enterEditMode() {
    current = (window.LearnIQProfileDetails && window.LearnIQProfileDetails.get(user)) || {};
    setStatus("");
    setMode("edit", current);
    const bioInp = document.getElementById("profile-detail-bio-input");
    if (bioInp) bioInp.focus();
  }

  function cancelEdit() {
    setStatus("");
    setMode("view");
    renderView(current);
  }

  function setSaving(saving) {
    if (saveBtn) saveBtn.disabled = saving;
    if (cancelBtn) cancelBtn.disabled = saving;
  }

  async function saveEdit() {
    const next = {};
    for (const f of FIELDS) {
      if (f === "address") {
        next.address = addressPicker ? addressPicker.composedValue() : "";
        continue;
      }
      const inp = document.getElementById(`profile-detail-${f}-input`);
      next[f] = inp ? String(inp.value || "").trim() : "";
    }
    if (!window.LearnIQProfileDetails) {
      setStatus("Profile module not loaded.", true);
      return;
    }
    setStatus("Saving…", false);
    setSaving(true);
    const result = await window.LearnIQProfileDetails.set(user, next);
    setSaving(false);
    if (!result.ok) {
      setStatus(result.reason || "Could not save details.", true);
      return;
    }
    if (addressPicker) addressPicker.rememberComponents(user);
    current = next;
    renderView(current);
    setMode("view");
    setStatus(result.local ? "Details saved locally." : "Details saved.", false);
  }

  /** Re-render the view (used after async load from server). */
  card._lqRefresh = () => {
    if (grid.dataset.mode === "edit") return;
    current = (window.LearnIQProfileDetails && window.LearnIQProfileDetails.get(user)) || emptyLocal();
    renderView(current);
  };
  function emptyLocal() {
    const empty = {};
    for (const f of FIELDS) empty[f] = "";
    return empty;
  }

  editBtn.addEventListener("click", enterEditMode);
  cancelBtn.addEventListener("click", cancelEdit);
  saveBtn.addEventListener("click", saveEdit);
}

function setupProfilePage() {
  const path = (window.location.pathname || "").replace(/\\/g, "/").toLowerCase();

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  if (path.includes("admin-profile.html")) {
    hydrateAdminSidebarFromSession();
    const u = getCurrentUserSession();
    const hint = document.getElementById("profile-hint");
    const brandSub = document.getElementById("profile-brand-subtitle");
    const titleEl = document.getElementById("profile-title");
    const subEl = document.getElementById("profile-subtitle");

    if (titleEl) titleEl.textContent = "Administrator profile";
    if (subEl) subEl.textContent = "Your account information from this session.";
    if (brandSub) brandSub.textContent = "Admin Control Center";

    if (!u) {
      setText("profile-full-name", "—");
      setText("profile-role", "—");
      setText("profile-id-number", "—");
      setText("profile-email", "—");
      if (hint) hint.textContent = "Sign in as an administrator first, then open this page again.";
      return;
    }

    const role = String(u.role || "").trim();
    setText("profile-full-name", getProfileDisplayName(u) || "—");
    setText("profile-role", role || "—");
    setText("profile-id-number", String(u.id_number || "").trim() || "—");
    setText("profile-email", String(u.email || "").trim() || "—");
    if (hint) hint.textContent = "";
    return;
  }

  if (!path.includes("student-profile.html")) return;

  hydrateStudentSidebarChip();

  const u = getCurrentUserSession();
  const hint = document.getElementById("profile-hint");
  const roleBadge = document.getElementById("profile-role-badge");
  const brandSub = document.getElementById("profile-brand-subtitle");

  if (!u) {
    setText("profile-full-name", "—");
    setText("profile-role", "—");
    setText("profile-id-number", "—");
    setText("profile-email", "—");
    if (roleBadge) roleBadge.textContent = "Signed out";
    if (brandSub) brandSub.textContent = "Sign in required";
    if (hint) hint.textContent = "Sign in first, then open this page again.";
    setupProfilePhotoEditor(null);
    setupProfileDetailsEditor(null);
    return;
  }

  const role = String(u.role || "").trim();
  setText("profile-full-name", getProfileDisplayName(u) || "—");
  setText("profile-role", role || "—");
  setText("profile-id-number", String(u.id_number || "").trim() || "—");
  setText("profile-email", String(u.email || "").trim() || "—");
  if (roleBadge) roleBadge.textContent = role ? role : "Signed in";
  if (brandSub) brandSub.textContent = role ? `${role} account` : "Account";

  // Optional: if page was opened with ?id_number=... show that in hint for future DB lookup.
  const params = new URLSearchParams(window.location.search);
  const idn = (params.get("id_number") || "").trim();
  if (hint) {
    hint.textContent = idn && u.id_number && idn !== String(u.id_number)
      ? "Note: This profile page currently shows the signed-in user only."
      : "";
  }

  setupProfilePhotoEditor(u);
  setupProfileDetailsEditor(u);

  if (typeof window.initStudentLearningIQ === "function") {
    window.initStudentLearningIQ();
  }

  // Fetch latest profile from the database (source of truth) and re-render
  // once the cache is updated. Running in the background so the initial
  // localStorage-cached values render instantly.
  if (u && u.access_token && window.LearnIQProfile && window.LearnIQProfile.loadFromServer) {
    window.LearnIQProfile.loadFromServer(u)
      .then((payload) => {
        if (!payload) return;
        refreshAvatarsAcrossPage(u);
        const card = document.getElementById("profile-details-card");
        if (card && typeof card._lqRefresh === "function") card._lqRefresh();
      })
      .catch((err) => console.warn("Profile load failed:", err));
  }
}

// Class Stream comments/reactions — delegated listeners, safe on every page.
bindAnnouncementFeedInteractions();
