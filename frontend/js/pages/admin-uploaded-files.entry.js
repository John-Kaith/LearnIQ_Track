document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.LearnIQTopnav && typeof LearnIQTopnav.mountAdmin === "function") {
      await LearnIQTopnav.mountAdmin();
    }
  } catch (e) {
    console.error(e);
  }

  try {
    await loadUploadedFiles();
  } catch (e) {
    console.error(e);
  }

  document.getElementById("refresh-files")?.addEventListener("click", () => {
    loadUploadedFiles();
    if (typeof showToast === "function") showToast("Files refreshed.", "success");
  });

  // Optional: handle "View" button if present.
  document.getElementById("files-table-body")?.addEventListener("click", (event) => {
    const target = event.target;
    const action = target?.dataset?.action;
    const fileId = target?.dataset?.id;
    if (action !== "view" || !fileId) return;
    // Keep behavior minimal: open existing AI result page with file_id (if used).
    window.location.href = `ai-result.html?file_id=${encodeURIComponent(fileId)}`;
  });
});

