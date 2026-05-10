document.addEventListener("DOMContentLoaded", async () => {
  if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();

  loadSettings();
});
