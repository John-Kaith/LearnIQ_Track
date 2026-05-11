// Page-specific bootstrap. The tab/search/reset handlers are auto-mounted by
// script.js (setupAdminUsersPageHandlers), so here we only handle the initial
// data load + optional top-nav mount.
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.LearnIQTopnav && typeof LearnIQTopnav.mountAdmin === "function") {
      await LearnIQTopnav.mountAdmin();
    }
  } catch (e) {
    console.error(e);
  }

  try {
    if (typeof loadAllUsers === "function") {
      await loadAllUsers();
    }
  } catch (e) {
    console.error(e);
  }

  document.getElementById("refresh-users")?.addEventListener("click", () => {
    if (typeof loadAllUsers === "function") {
      loadAllUsers();
      if (typeof showToast === "function") showToast("Users refreshed.", "success");
    }
  });
});

