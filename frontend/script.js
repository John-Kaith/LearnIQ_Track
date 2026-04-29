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

/**
 * Backend URL for fetch(). Empty string = same origin (when FastAPI serves the frontend on :8000).
 * Override: localStorage.setItem("learniq-api-base", "http://127.0.0.1:9000")
 */
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
  sessionStorage.setItem(authSessionKey, JSON.stringify(safeUser));
}

function getCurrentUserSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(authSessionKey) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
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

const dashboardActivity = [
  { title: "Maria Santos approved", detail: "Student registration confirmed.", time: "15 minutes ago" },
  { title: "New file uploaded", detail: "Attendance report added by teacher.", time: "45 minutes ago" },
  { title: "AI analysis generated", detail: "Learning summary created for 3 students.", time: "1 hour ago" },
  { title: "Journal submitted", detail: "Journal entry from Anna Reyes received.", time: "2 hours ago" }
];

function getAdminDashboardStats(users) {
  const totalStudents = users.filter((user) => user.role === "Student").length;
  const totalTeachers = users.filter((user) => user.role === "Teacher").length;
  const pendingApprovals = users.filter((user) => user.status === "Pending").length;
  const approvedAccounts = users.filter((user) => user.status === "Approved").length;
  const rejectedAccounts = users.filter((user) => user.status === "Rejected").length;
  return { totalStudents, totalTeachers, pendingApprovals, approvedAccounts, rejectedAccounts };
}

async function renderMetrics() {
  try {
    const response = await fetch(apiUrl("/users"));
    if (!response.ok) {
      // Fallback to zeros if API fails
      updateMetricsDisplay({ totalStudents: 0, totalTeachers: 0, pendingApprovals: 0, approvedAccounts: 0, rejectedAccounts: 0 });
      return;
    }
    
    const users = await response.json();
    const stats = getAdminDashboardStats(users);
    updateMetricsDisplay(stats);
  } catch (error) {
    console.error("Failed to fetch users for metrics:", error);
    // Fallback to zeros
    updateMetricsDisplay({ totalStudents: 0, totalTeachers: 0, pendingApprovals: 0, approvedAccounts: 0, rejectedAccounts: 0 });
  }
}

function updateMetricsDisplay(stats) {
  document.getElementById("metric-total-students").textContent = stats.totalStudents;
  document.getElementById("metric-total-teachers").textContent = stats.totalTeachers;
  document.getElementById("metric-pending-approvals").textContent = stats.pendingApprovals;
  document.getElementById("metric-approved-accounts").textContent = stats.approvedAccounts;
  document.getElementById("metric-rejected-accounts").textContent = stats.rejectedAccounts;
  document.getElementById("metric-active-users").textContent = Math.max(12, stats.totalStudents + 3);
  document.getElementById("chart-pending").dataset.progress = `${Math.min(100, Math.round((stats.pendingApprovals / Math.max(1, stats.totalStudents + stats.totalTeachers)) * 100))}%`;
  document.getElementById("chart-approved").dataset.progress = `${Math.min(100, Math.round((stats.approvedAccounts / Math.max(1, stats.totalStudents + stats.totalTeachers)) * 100))}%`;
  document.getElementById("chart-rejected").dataset.progress = `${Math.min(100, Math.round((stats.rejectedAccounts / Math.max(1, stats.totalStudents + stats.totalTeachers)) * 100))}%`;
  animateProgressBars();
}

function renderRecentActivity() {
  const list = document.getElementById("recent-activity-list");
  if (!list) return;
  list.innerHTML = dashboardActivity
    .map(
      (item) => `
        <li>
          <strong>${item.title}</strong>
          <small>${item.detail}</small>
          <span class="metric-note">${item.time}</span>
        </li>
      `
    )
    .join("");
}

function approveAllPending() {
  const users = ensureSampleUsers();
  const updated = users.map((user) =>
    user.status === "Pending" ? { ...user, status: "Approved" } : user
  );
  saveUsers(updated);
  renderAdminTable(document.querySelector("#admin-search")?.value || "");
  renderMetrics();
  showToast("All pending students have been approved.", "success");
}

function exportReports() {
  showToast("Admin reports exported successfully.", "info");
}

function uploadDashboardFile(file) {
  if (!file) return;
  dashboardActivity.unshift({
    title: `File uploaded: ${file.name}`,
    detail: "New file added to the admin library.",
    time: "Just now"
  });
  if (dashboardActivity.length > 6) dashboardActivity.pop();
  renderRecentActivity();
  showToast(`Uploaded ${file.name}`, "success");
}

function setupDashboardActions() {
  document.getElementById("approve-all-btn")?.addEventListener("click", approveAllPending);
  document.getElementById("export-reports-btn")?.addEventListener("click", exportReports);
  document.getElementById("view-students-btn")?.addEventListener("click", () => {
    document.getElementById("admin-table")?.scrollIntoView({ behavior: "smooth" });
  });
  document.getElementById("upload-file-btn")?.addEventListener("click", () => {
    document.getElementById("dashboard-upload-input")?.click();
  });
  document.getElementById("logout-button")?.addEventListener("click", logoutAdmin);
  document.getElementById("sidebar-logout")?.addEventListener("click", logoutAdmin);
  document.getElementById("topbar-search")?.addEventListener("input", (event) => {
    renderAdminTable(event.target.value || "");
  });
  document.getElementById("refresh-dashboard")?.addEventListener("click", () => {
    renderMetrics();
    renderRecentActivity();
    showToast("Dashboard refreshed.", "success");
  });
  document.getElementById("dashboard-upload-input")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    uploadDashboardFile(file);
    event.target.value = "";
  });
}

function renderSystemStatus() {
  const statusCards = document.querySelectorAll(".status-card");
  statusCards.forEach((card) => {
    const badge = card.querySelector(".status-badge");
    if (badge && badge.textContent.includes("Offline")) {
      badge.classList.remove("online");
      badge.classList.add("warning");
    }
  });
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

function setupSignupPage() {
  const signupForm = document.querySelector("#signup-form");
  const signupMessage = document.querySelector("#signup-message");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!signupMessage) return;

    const fullName = document.querySelector("#signup-name").value.trim();
    const idNumber = document.querySelector("#signup-id").value.trim();
    const email = document.querySelector("#signup-email").value.trim().toLowerCase();
    const password = document.querySelector("#signup-password").value;
    const confirmPassword = document.querySelector("#signup-confirm").value;

    if (!fullName || !idNumber || !email || !password || !confirmPassword) {
      showAuthMessage("All fields are required.", signupMessage, "error");
      return;
    }

    if (password !== confirmPassword) {
      showAuthMessage("Confirm password must match.", signupMessage, "error");
      return;
    }

    try {
      // Call backend register endpoint (now uses Supabase Auth)
      const response = await fetch(apiUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          id_number: idNumber,
          email: email,
          password: password,
          role: "student"
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Registration failed");
      }

      const result = await response.json();
      signupForm.reset();
      showAuthMessage(result.message || "Your account is pending approval by the Admin/Principal.", signupMessage, "success");
      showToast("Student registration submitted for review.", "success");
    } catch (error) {
      showAuthMessage(error.message || "Registration failed. Please try again.", signupMessage, "error");
      showToast(`Registration failed: ${error.message}`, "error");
    }
  });
}

function setupLoginPage() {
  console.log("setupLoginPage running");
  
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  
  console.log("login form found:", loginForm);
  console.log("login message found:", loginMessage);
  
  if (!loginForm) {
    console.error("Login form not found!");
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    console.log("login submit fired");
    event.preventDefault();

    const email = document.querySelector("#login-email").value.trim().toLowerCase();
    const password = document.querySelector("#login-password").value;

    console.log("login attempt with email:", email);

    if (!email || !password) {
      const errorMsg = "Email and password are required.";
      console.error(errorMsg);
      if (loginMessage) {
        showAuthMessage(errorMsg, loginMessage, "error");
      } else {
        alert(errorMsg);
      }
      return;
    }

    try {
      console.log("sending login request to:", apiUrl("/login"));
      
      // Call backend login endpoint (now uses Supabase Auth)
      const response = await fetch(apiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      console.log("login response status:", response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("login error response:", error);
        throw new Error(error.error || "Login failed");
      }

      const result = await response.json();
      console.log("login success result:", result);
      
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
      
      console.log("login successful, redirecting...");
      showAuthMessage(successMessage, loginMessage, "success");
      showToast(successMessage, "success");

      setCurrentUserSession(user);

      setTimeout(() => {
        if (user.role === "admin") {
          window.location.href = "admin-approval.html";
        } else {
          window.location.href = "module-selection.html";
        }
      }, 1000);
    } catch (error) {
      console.error("login error:", error);
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
    const response = await fetch(apiUrl("/users"));
    if (!response.ok) {
      tableBody.innerHTML = `<tr><td colspan="7">Failed to load users from server.</td></tr>`;
      return;
    }
    
    const users = await response.json();
    const filterValue = filter.trim().toLowerCase();

    const rows = users
      .filter((user) =>
        !filterValue ||
        (user.full_name && user.full_name.toLowerCase().includes(filterValue)) ||
        (user.id_number && user.id_number.toLowerCase().includes(filterValue))
      )
      .map((user) => {
        const actions = user.role === "student" ?
          `<div class="table-actions">
            <button class="btn btn-secondary" data-action="approve" data-id="${user.id_number}">Approve</button>
            <button class="btn btn-ghost" data-action="reject" data-id="${user.id_number}">Reject</button>
          </div>` :
          "—";

        return `
          <tr>
            <td>${user.full_name || "N/A"}</td>
            <td>${user.id_number || "N/A"}</td>
            <td>${user.email || "N/A"}</td>
            <td>${user.role || "N/A"}</td>
            <td>${formatStatusBadge(user.approval_status || "pending")}</td>
            <td>${user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}</td>
            <td>${actions}</td>
          </tr>
        `;
      });

    tableBody.innerHTML = rows.join("") || `<tr><td colspan="7">No matching student registrations found.</td></tr>`;
  } catch (error) {
    console.error("Failed to render admin table:", error);
    tableBody.innerHTML = `<tr><td colspan="7">Error loading user data.</td></tr>`;
  }
}

function logoutAdmin() {
  const confirmed = confirm("Are you sure you want to log out?");
  if (!confirmed) return;

  sessionStorage.clear();
  showToast("Logged out successfully.", "info");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 350);
}

async function updateAdminUserStatus(idNumber, newStatus) {
  try {
    const response = await fetch(apiUrl("/users"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_number: idNumber,
        approval_status: newStatus
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to update user status");
    }

    // Refresh the table and metrics
    await renderAdminTable(document.querySelector("#admin-search")?.value || "");
    await renderMetrics();
    showToast(`Student ${newStatus.toLowerCase()} successfully.`, "success");
  } catch (error) {
    console.error("Failed to update user status:", error);
    showToast(`Failed to update user: ${error.message}`, "error");
  }
}

function setupAdminPage() {
  const searchInput = document.querySelector("#admin-search");
  const resetButton = document.querySelector("#admin-reset");
  const tableBody = document.querySelector("#admin-table-body");
  if (!tableBody) return;

  renderAdminTable();
  renderMetrics();
  renderRecentActivity();
  renderSystemStatus();
  setupDashboardActions();

  tableBody.addEventListener("click", (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const idNumber = target.dataset.id;
    if (!action || !idNumber) return;

    if (action === "approve") {
      updateAdminUserStatus(idNumber, "Approved");
    }
    if (action === "reject") {
      updateAdminUserStatus(idNumber, "Rejected");
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", () => renderAdminTable(searchInput.value));
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
      }
      renderAdminTable();
      renderMetrics();
    });
  }
}

// Teacher dashboard: lesson file selected in UI + server state
let currentFileId = null;
let currentQuiz = [];

const TEACHER_FILE_STORAGE_KEY = "learniq-teacher-file-id";

async function fetchTeacherLessonsList() {
  try {
    const res = await fetch(apiUrl("/teacher/lessons"));
    if (!res.ok) return [];
    const data = await res.json();
    return data.lessons || [];
  } catch {
    return [];
  }
}

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
    if (fileMeta && meta) {
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
  if (fileMeta && filename) {
    fileMeta.textContent = `Selected lesson: ${filename}`;
  }
  const lessons = await fetchTeacherLessonsList();
  renderTeacherLessonsTable(lessons, fileId);
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(apiUrl("/upload-file"), {
    method: "POST",
    body: formData
  });

  const result = await readApiJson(response);
  currentFileId = result.file_id;
  localStorage.setItem(TEACHER_FILE_STORAGE_KEY, result.file_id);
  showToast(`File uploaded: ${result.filename}`, "success");
  await refreshTeacherLessons();
  return result;
}

async function generateReviewer() {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");

  const response = await fetch(apiUrl("/generate-reviewer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: currentFileId })
  });

  const result = await readApiJson(response);
  return result.reviewer;
}

async function generateQuestion() {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");

  const response = await fetch(apiUrl("/generate-question"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: currentFileId })
  });

  const result = await readApiJson(response);
  currentQuiz.push(result);
  return result;
}

async function generateActivities() {
  if (!currentFileId) throw new Error("Choose a lesson file or select a row in the table first.");

  const response = await fetch(apiUrl("/generate-activities"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: currentFileId })
  });

  const result = await readApiJson(response);
  return result.activities;
}

function updateFullAiPreview(previewBody, reviewerText, activities, questions) {
  if (!previewBody) return;
  const rev = escapeHtml(String(reviewerText || ""));
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
    <div class="preview-snippet"><h4>Reviewer Summary</h4><p>${rev}</p></div>
    <div class="preview-snippet"><h4>Learning activities</h4>${actBlock || "<p>—</p>"}</div>
    ${
      quizBlock ||
      '<div class="preview-snippet"><h4>Quiz</h4><p class="small-note">No questions generated.</p></div>'
    }
  `;
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
      "Cannot reach API. Run: cd backend → uvicorn main:app --reload — then open http://127.0.0.1:8000/teacher-dashboard.html (or set localStorage learniq-api-base to your API URL).";
    el.classList.add("is-offline");
  }
}

async function runTeacherAiPack(previewBody) {
  if (!currentFileId) {
    showToast("Upload a lesson file first, or select one in the table below.", "error");
    return;
  }
  const btn = document.getElementById("teacher-generate-ai-pack-btn");
  const prev = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="loader"></span> Generating...`;
  }
  try {
    currentQuiz = [];
    const reviewer = await generateReviewer();
    const activities = await generateActivities();
    const questions = [];
    for (let i = 0; i < 3; i++) {
      questions.push(await generateQuestion());
    }
    updateFullAiPreview(previewBody, reviewer, activities, questions);
    await refreshTeacherLessons();
    showToast("AI content ready: reviewer, activities, and 3 quiz questions.", "success");
  } catch (error) {
    showToast(`Error: ${error.message}`, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prev;
    }
  }
}

function setupTeacherDashboard() {
  const fileInput = document.querySelector("#lesson-file");
  const fileMeta = document.querySelector("#file-meta");
  const previewBody = document.querySelector("#ai-preview-body");
  const tbody = document.getElementById("teacher-lessons-tbody");
  const uploadBtn = document.getElementById("upload-lesson-btn");

  uploadBtn?.addEventListener("click", () => {
    fileInput?.click();
  });

  if (fileInput && fileMeta) {
    fileInput.addEventListener("change", async () => {
      const selectedFile = fileInput.files?.[0];
      if (!selectedFile) {
        fileMeta.textContent = "No file selected yet";
        return;
      }
      fileMeta.textContent = `Uploading ${selectedFile.name}…`;
      currentFileId = null;
      currentQuiz = [];
      try {
        await uploadFile(selectedFile);
        fileMeta.textContent = `Uploaded: ${selectedFile.name}`;
        fileInput.value = "";
      } catch (e) {
        fileMeta.textContent = "Upload failed. Try again.";
        const msg =
          e && e.message && String(e.message).includes("fetch")
            ? "Cannot reach API. Start the backend (uvicorn) or check learniq-api-base in localStorage."
            : e.message || "Upload failed";
        showToast(msg, "error");
      }
    });
  }

  document.getElementById("teacher-generate-ai-pack-btn")?.addEventListener("click", () => {
    void runTeacherAiPack(previewBody);
  });

  document.getElementById("publish-lesson-btn")?.addEventListener("click", async () => {
    if (!currentFileId) {
      showToast("Select a lesson in the table first.", "error");
      return;
    }
    try {
      const res = await fetch(apiUrl("/publish-lesson"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: currentFileId })
      });
      await readApiJson(res);
      showToast("Lesson published. Students can open or refresh their dashboard.", "success");
      await refreshTeacherLessons();
    } catch (e) {
      showToast(`Error: ${e.message}`, "error");
    }
  });

  document.getElementById("unpublish-lesson-btn")?.addEventListener("click", async () => {
    if (!currentFileId) {
      showToast("Select a lesson in the table first.", "error");
      return;
    }
    const confirmed = confirm("Are you sure you want to unpublish this lesson? Students will no longer see this content.");
    if (!confirmed) return;
    
    try {
      const res = await fetch(apiUrl("/unpublish-lesson"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: currentFileId })
      });
      await readApiJson(res);
      showToast("Lesson unpublished. Students can no longer see this content.", "success");
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
      void selectTeacherLesson(id, fname);
    });
  }

  void refreshTeacherLessons();
  void updateTeacherApiStatus();
}

function answersMatch(studentPick, correctAnswer) {
  const a = String(studentPick).trim().toLowerCase();
  const b = String(correctAnswer).trim().toLowerCase();
  if (a === b) return true;
  const first = a.charAt(0);
  if (b.length <= 2 && first === b.charAt(0)) return true;
  return false;
}

function setupStudentDashboard() {
  const currentUser = getCurrentUserSession();
  const displayName = document.getElementById("student-display-name");
  const displayTrack = document.getElementById("student-display-track");
  const displayAvatar = document.getElementById("student-avatar-initials");
  const leaderboardName = document.getElementById("student-leaderboard-name");

  if (displayName) {
    displayName.textContent = currentUser?.fullName || "Student";
  }
  if (displayAvatar) {
    displayAvatar.textContent = getUserInitials(currentUser?.fullName || "Student");
  }
  if (displayTrack && !displayTrack.textContent.trim()) {
    displayTrack.textContent = "STEM - 12 A";
  }
  if (leaderboardName) {
    leaderboardName.textContent = `2. ${currentUser?.fullName || "Student"}`;
  }

  const emptyEl = document.getElementById("student-lesson-empty");
  const emptyText = document.getElementById("student-lesson-empty-text");
  const metaCard = document.getElementById("student-lesson-meta");
  const titleEl = document.getElementById("student-lesson-title");
  const filenameEl = document.getElementById("student-lesson-filename");
  const reviewerCard = document.getElementById("student-reviewer-card");
  const reviewerList = document.getElementById("student-reviewer-list");
  const quizCard = document.getElementById("student-quiz-card");
  const quizBody = document.getElementById("student-quiz-body");
  const quizProgress = document.getElementById("student-quiz-progress");
  const quizScoreEl = document.getElementById("student-quiz-score");
  const activitiesCard = document.getElementById("student-activities-card");
  const activitiesList = document.getElementById("student-activities-list");
  const refreshBtn = document.getElementById("student-refresh-lesson-btn");
  const openActionsBtn = document.getElementById("student-open-actions-btn");
  const actionModal = document.getElementById("student-lesson-action-modal");
  const actionModalClose = document.getElementById("student-lesson-action-modal-close");
  const actionModalMeta = document.getElementById("student-lesson-action-modal-meta");
  const actionButtons = actionModal ? Array.from(actionModal.querySelectorAll("[data-student-lesson-action]")) : [];

  if (!emptyEl || !quizBody) return;

  let lessonData = null;
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let studentAnswers = []; // Track all student answers

  function showEmpty(message) {
    lessonData = null;
    if (emptyEl) emptyEl.hidden = false;
    if (emptyText) emptyText.textContent = message;
    if (metaCard) metaCard.hidden = true;
    if (reviewerCard) reviewerCard.hidden = true;
    if (quizCard) quizCard.hidden = true;
    if (activitiesCard) activitiesCard.hidden = true;
    closeActionModal();
  }

  function closeActionModal() {
    if (!actionModal) return;
    actionModal.setAttribute("hidden", "");
    
    // Reset generation options
    const generationOptions = document.querySelector(".generation-options");
    const actionButtons = document.querySelector(".action-modal-actions");
    const quizOptions = document.querySelector(".quiz-options");
    const activityOptions = document.querySelector(".activity-options");
    
    if (generationOptions) generationOptions.hidden = true;
    if (actionButtons) actionButtons.hidden = false;
    if (quizOptions) quizOptions.hidden = true;
    if (activityOptions) activityOptions.hidden = true;
  }

  function setStudentActionButtonsDisabled(disabled) {
    actionButtons.forEach((button) => {
      button.disabled = disabled;
    });
  }

  function openActionModal() {
    if (!actionModal) return;
    if (actionModalMeta) {
      actionModalMeta.textContent = lessonData
        ? `Selected lesson: ${lessonData.filename || "Your class lesson"}`
        : "No lesson loaded yet. Click 'Check again' first.";
    }
    setStudentActionButtonsDisabled(!lessonData);
    actionModal.removeAttribute("hidden");
  }

  // Global fallback so inline click can always open modal.
  window.openStudentLessonActions = () => {
    const modal = document.getElementById("student-lesson-action-modal");
    const meta = document.getElementById("student-lesson-action-modal-meta");
    const filename = (document.getElementById("student-lesson-filename")?.textContent || "").trim();
    const buttons = Array.from(document.querySelectorAll("[data-student-lesson-action]"));
    if (!modal) return;
    if (meta) {
      meta.textContent = filename ? `Selected lesson: ${filename}` : "No lesson loaded yet. Click 'Check again' first.";
    }
    buttons.forEach((btn) => {
      btn.disabled = !filename;
    });
    modal.removeAttribute("hidden");
  };

  function showLesson(data) {
    console.log("[DEBUG] showLesson called with data:", data);
    console.log("[DEBUG] data.activities value:", data.activities);
    console.log("[DEBUG] Type of data.activities:", typeof data.activities);
    console.log("[DEBUG] Is data.activities an array?", Array.isArray(data.activities));
    
    lessonData = data;
    if (emptyEl) emptyEl.hidden = true;
    if (metaCard) metaCard.hidden = false;
    if (reviewerCard) reviewerCard.hidden = false;
    if (quizCard) quizCard.hidden = false;
    if (activitiesCard) activitiesCard.hidden = false;

    if (titleEl) titleEl.textContent = "Your class lesson";
    if (filenameEl) filenameEl.textContent = data.filename || "";

    if (reviewerList) {
      const bullets = data.reviewer || [];
      reviewerList.innerHTML = bullets.map((line) => `<li>${escapeHtml(line)}</li>`).join("") || "<li>No reviewer yet.</li>";
    }

    if (activitiesList) {
      const acts = data.activities || [];
      console.log("[DEBUG] Rendering activities. acts:", acts);
      console.log("[DEBUG] activitiesList element:", activitiesList);
      activitiesList.innerHTML = acts
        .map(
          (item, i) => {
            // Handle both old string format and new structured format
            if (typeof item === 'string') {
              return `
                <div class="activity-item">
                  <strong>Activity ${i + 1}</strong>
                  <p>${escapeHtml(item)}</p>
                </div>`;
            } else if (typeof item === 'object' && item !== null) {
              return `
                <div class="activity-item">
                  <strong>${escapeHtml(item.title || `Activity ${i + 1}`)}</strong>
                  <span class="small-note">${escapeHtml(item.activity_type || 'activity')}</span>
                  <div class="activity-instructions">
                    <em>${escapeHtml(item.instructions || '')}</em>
                  </div>
                  <p>${escapeHtml(item.question_or_task || '')}</p>
                </div>`;
            } else {
              return `
                <div class="activity-item">
                  <strong>Activity ${i + 1}</strong>
                  <p>${escapeHtml(String(item))}</p>
                </div>`;
            }
          }
        )
        .join("") || '<p class="small-note">No activities yet.</p>';
      console.log("[DEBUG] activitiesList.innerHTML after render:", activitiesList.innerHTML);
    }

    quizIndex = 0;
    quizScore = 0;
    quizAnswered = false;
    studentAnswers = []; // Initialize answer tracking
    renderStudentQuiz();
  }

  function focusStudentSection(action) {
    const target =
      action === "reviewer" ? reviewerCard : action === "quiz" ? quizCard : action === "activity" ? activitiesCard : null;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    closeActionModal();
  }

  function updateReviewerDisplay(reviewerData) {
    if (!reviewerList) return;
    const reviewerArray = Array.isArray(reviewerData) ? reviewerData : [reviewerData];
    reviewerList.innerHTML = reviewerArray.map((line) => `<li>${escapeHtml(line)}</li>`).join("") || "<li>No reviewer content.</li>";
  }

  function updateActivitiesDisplay(activitiesData) {
    if (!activitiesList) return;
    const activitiesArray = Array.isArray(activitiesData) ? activitiesData : [activitiesData];
    activitiesList.innerHTML = activitiesArray
      .map(
        (item, i) => `
      <div class="activity-item">
        <strong>Activity ${i + 1}</strong>
        <p>${escapeHtml(item)}</p>
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
    if (quizScoreEl) quizScoreEl.textContent = `Score: ${quizScore} / ${questions.length}`;

    const q = questions[quizIndex];
    if (!q || !q.question) {
      quizBody.innerHTML = '<p class="small-note">Invalid question data.</p>';
      return;
    }

    const choices = Array.isArray(q.choices) ? q.choices : [];
    const radios = choices
      .map(
        (c, i) => `
      <label class="small-note" style="display:block;margin:0.35rem 0;">
        <input type="radio" name="student-quiz-opt" value="${i}" ${quizAnswered ? "disabled" : ""} />
        ${escapeHtml(c)}
      </label>`
      )
      .join("");

    const feedbackId = "student-quiz-feedback";
    quizBody.innerHTML = `
      <p><strong>${escapeHtml(q.question)}</strong></p>
      ${radios}
      <div id="${feedbackId}" class="small-note" style="margin-top:0.75rem;"></div>
      <div class="button-group" style="margin-top:0.75rem;">
        <button type="button" class="btn btn-primary" id="student-quiz-check-btn" ${quizAnswered ? "disabled" : ""}>Check answer</button>
        <button type="button" class="btn btn-secondary" id="student-quiz-next-btn">Next</button>
      </div>
    `;

    document.getElementById("student-quiz-check-btn")?.addEventListener("click", () => {
      if (quizAnswered) return;
      const picked = document.querySelector('input[name="student-quiz-opt"]:checked');
      const fb = document.getElementById(feedbackId);
      if (!picked) {
        if (fb) fb.textContent = "Pick an answer first.";
        return;
      }
      quizAnswered = true;
      const idx = Number(picked.value);
      const choiceText = choices[idx] != null ? choices[idx] : "";
      const ok = answersMatch(choiceText, q.answer);
      if (ok) quizScore += 1;
      if (fb) {
        fb.textContent = ok ? "Correct!" : "Not quite. Correct answer: " + String(q.answer);
        fb.style.color = ok ? "var(--success, #22c55e)" : "var(--warning, #f59e0b)";
      }
      document.querySelectorAll('input[name="student-quiz-opt"]').forEach((el) => {
        el.disabled = true;
      });
      document.getElementById("student-quiz-check-btn").disabled = true;
      document.getElementById("student-quiz-next-btn").disabled = false;
      if (quizScoreEl) quizScoreEl.textContent = `Score: ${quizScore} / ${questions.length}`;
    });

    document.getElementById("student-quiz-next-btn")?.addEventListener("click", () => {
      // Save current answer (or unanswered)
      const picked = document.querySelector('input[name="student-quiz-opt"]:checked');
      if (picked) {
        // Answer was selected and possibly checked
        const idx = Number(picked.value);
        const choiceText = choices[idx] != null ? choices[idx] : "";
        studentAnswers[quizIndex] = choiceText;
        
        // Calculate score if answer was checked
        if (quizAnswered) {
          const ok = answersMatch(choiceText, q.answer);
          if (ok) quizScore += 1;
        }
      } else {
        // Question was skipped
        studentAnswers[quizIndex] = null; // Mark as unanswered
      }
      
      if (quizIndex + 1 >= questions.length) {
        // Calculate final score
        let finalScore = 0;
        studentAnswers.forEach((answer, index) => {
          if (answer !== null && answer !== undefined) {
            const question = questions[index];
            if (question && answersMatch(answer, question.answer)) {
              finalScore += 1;
            }
          }
          // Unanswered (null) counts as incorrect (0 points)
        });
        
        quizBody.innerHTML = `<p class="content-subtitle">Quiz complete. Final score: ${finalScore} / ${questions.length}</p>`;
        if (quizProgress) quizProgress.textContent = "Finished";
        if (quizScoreEl) quizScoreEl.textContent = `Score: ${finalScore} / ${questions.length}`;
        return;
      }
      
      quizIndex += 1;
      quizAnswered = false;
      renderStudentQuiz();
    });
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
      showEmpty("Cannot reach the server. Is the LearnIQ Track backend running?");
    }
  }

  refreshBtn?.addEventListener("click", () => void loadStudentLesson());
  openActionsBtn?.addEventListener("click", openActionModal);
  actionModalClose?.addEventListener("click", closeActionModal);
  actionModal?.addEventListener("click", (event) => {
    if (event.target === actionModal) closeActionModal();
  });
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.studentLessonAction;
      if (!action) return;
      
      // Show generation options based on action
      const generationOptions = document.querySelector(".generation-options");
      const quizOptions = document.querySelector(".quiz-options");
      const activityOptions = document.querySelector(".activity-options");
      const actionButtons = document.querySelector(".action-modal-actions");
      
      // Hide action buttons and show generation options
      actionButtons.hidden = true;
      generationOptions.hidden = false;
      
      // Show appropriate options based on action
      quizOptions.hidden = action !== "quiz";
      activityOptions.hidden = action !== "activity";
      
      // Store current action for generation
      generationOptions.dataset.currentAction = action;
    });
  });

  // Handle generation button click
  const generateBtn = document.getElementById("generate-btn");
  const cancelGenerationBtn = document.getElementById("cancel-generation-btn");
  
  if (generateBtn) {
    generateBtn.addEventListener("click", async () => {
      const generationOptions = document.querySelector(".generation-options");
      const action = generationOptions.dataset.currentAction;
      
      if (!action || !lessonData?.file_id) {
        showToast("No lesson file available. Please refresh and try again.", "error");
        return;
      }

      // Disable button and show loading
      generateBtn.disabled = true;
      const originalText = generateBtn.innerHTML;
      generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
      
      try {
        const fileId = lessonData.file_id;
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
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody)
            });
            break;
          case "quiz":
            response = await fetch(apiUrl("/generate-question"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody)
            });
            break;
          case "activity":
            response = await fetch(apiUrl("/generate-activities"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
        await loadStudentLesson();
        console.log(`[DEBUG] Lesson data reloaded. ${action}:`, lessonData?.[action === 'quiz' ? 'quiz' : 'activities']);
        
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
        showToast(successMessage, "success");
        
      } catch (error) {
        console.error(`Error generating ${action}:`, error);
        showToast(`Failed to generate ${action}: ${error.message}`, "error");
      } finally {
        // Restore button and reset modal
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalText;
        closeActionModal();
      }
    });
  }
  
  // Handle cancel button click
  if (cancelGenerationBtn) {
    cancelGenerationBtn.addEventListener("click", () => {
      closeActionModal();
    });
  }
  void loadStudentLesson();
}

async function renderAiResultPage() {
  const reviewerList = document.querySelector("#reviewer-result");
  const quizList = document.querySelector("#quiz-result");
  const activitiesList = document.querySelector("#activities-result");
  if (!reviewerList || !quizList || !activitiesList) return;

  const params = new URLSearchParams(window.location.search);
  let fileId = params.get("file_id") || localStorage.getItem(TEACHER_FILE_STORAGE_KEY);
  if (!fileId) {
    reviewerList.innerHTML =
      "<li>Go to the Teacher Dashboard, select or upload a lesson, then open this page again.</li>";
    quizList.innerHTML = "<li>—</li>";
    activitiesList.innerHTML = "<li>—</li>";
    return;
  }

  const res = await fetch(apiUrl(`/get-content/${encodeURIComponent(fileId)}`));
  if (!res.ok) {
    reviewerList.innerHTML = "<li>Could not load this lesson.</li>";
    quizList.innerHTML = "<li>—</li>";
    activitiesList.innerHTML = "<li>—</li>";
    return;
  }

  const payload = await res.json();
  let reviewerItems = [];
  if (typeof payload.reviewer === "string") {
    reviewerItems = payload.reviewer
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!reviewerItems.length) reviewerItems = [payload.reviewer];
  } else if (Array.isArray(payload.reviewer)) {
    reviewerItems = payload.reviewer;
  }

  reviewerList.innerHTML =
    reviewerItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No reviewer yet.</li>";

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
    acts.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No activities yet.</li>";
}

document.addEventListener("DOMContentLoaded", () => {
  animateProgressBars();
  setupForms();
  setupSignupPage();
  setupLoginPage();
  setupAdminPage();
  setupTeacherDashboard();
  setupStudentDashboard();
  void renderAiResultPage();
});
