document.addEventListener("DOMContentLoaded", async () => {
  if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();

  await loadJournals();

  document.getElementById("refresh-journals")?.addEventListener("click", () => {
    loadJournals();
    if (typeof showToast === "function") showToast("Journals refreshed.", "success");
  });
});
