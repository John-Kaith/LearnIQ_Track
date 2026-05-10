document.addEventListener("DOMContentLoaded", async () => {
  if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();

  await loadReports();

  document.getElementById("export-all-reports")?.addEventListener("click", () => {
    if (typeof showToast === "function") showToast("Export is not wired yet.", "info");
  });
});
