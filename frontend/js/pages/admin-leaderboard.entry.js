document.addEventListener("DOMContentLoaded", async () => {
  if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();

  await loadLeaderboard();

  document.getElementById("refresh-leaderboard")?.addEventListener("click", () => {
    loadLeaderboard();
    if (typeof showToast === "function") showToast("Leaderboard refreshed.", "success");
  });
});
