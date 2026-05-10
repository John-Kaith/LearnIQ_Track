document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.LearnIQTopnav && typeof LearnIQTopnav.mountAdmin === "function") {
      await LearnIQTopnav.mountAdmin();
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await loadAllUsers();
  } catch (e) {
    console.error(e);
  }

  document.getElementById("refresh-users")?.addEventListener("click", () => {
    loadAllUsers();
    if (typeof showToast === "function") showToast("Users refreshed.", "success");
  });

  document.getElementById("users-reset")?.addEventListener("click", () => {
    const s = document.getElementById("users-search");
    if (s) s.value = "";
    loadAllUsers();
  });
});

