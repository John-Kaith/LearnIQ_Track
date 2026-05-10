document.addEventListener("DOMContentLoaded", async () => {
  if (typeof hydrateAdminSidebarFromSession === "function") hydrateAdminSidebarFromSession();

  await loadAttendanceLogs();

  document.getElementById("refresh-attendance")?.addEventListener("click", () => {
    loadAttendanceLogs();
    if (typeof showToast === "function") showToast("Attendance logs refreshed.", "success");
  });
});
