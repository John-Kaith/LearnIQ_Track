document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.LearnIQTopnav && typeof LearnIQTopnav.mountAdmin === "function") {
      await LearnIQTopnav.mountAdmin();
    }
  } catch (e) {
    console.error(e);
  }

  try {
    if (typeof loadTeacherApprovals === "function") await loadTeacherApprovals();
  } catch (e) {
    console.error(e);
  }

  document.getElementById("teacher-approval-reset")?.addEventListener("click", () => {
    const s = document.getElementById("teacher-approval-search");
    if (s) s.value = "";
    if (typeof loadTeacherApprovals === "function") loadTeacherApprovals();
  });

  document.getElementById("teacher-approval-search")?.addEventListener("input", () => {
    if (typeof loadTeacherApprovals === "function") loadTeacherApprovals();
  });

  function handleTeacherRowInteraction(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;

    const profileEl = target.closest("[data-profile-id]");
    if (profileEl && profileEl.dataset.profileId != null && profileEl.dataset.profileId !== "") {
      event.preventDefault();
      const raw = String(profileEl.dataset.profileId || "").trim();
      const idNumber = raw ? decodeURIComponent(raw) : "";
      if (idNumber && typeof openAdminProfilePreviewModal === "function") {
        openAdminProfilePreviewModal(idNumber, "Teacher profile");
      }
    }
  }

  const teacherTableBody = document.getElementById("teacher-approval-table-body");
  teacherTableBody?.addEventListener("click", handleTeacherRowInteraction);
  teacherTableBody?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row =
      event.target && typeof event.target.closest === "function"
        ? event.target.closest("[data-profile-id]")
        : null;
    if (!row) return;
    event.preventDefault();
    handleTeacherRowInteraction({ target: row, preventDefault: () => {} });
  });

  const profileModal = document.getElementById("teacher-profile-modal");
  if (profileModal) {
    profileModal.addEventListener("click", (e) => {
      if (e.target === profileModal && typeof closeAdminProfilePreviewModal === "function") {
        closeAdminProfilePreviewModal();
      }
    });
    profileModal.querySelectorAll(".teacher-profile-modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof closeAdminProfilePreviewModal === "function") closeAdminProfilePreviewModal();
      });
    });
    profileModal.querySelector(".teacher-profile-modal-panel")?.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});
