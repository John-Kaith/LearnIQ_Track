document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.LearnIQTopnav && typeof LearnIQTopnav.mountAdmin === "function") {
      await LearnIQTopnav.mountAdmin();
    }
  } catch (e) {
    console.error(e);
  }

  window.__teacherApprovalsTab = "pending";

  function setActiveTab(tab) {
    window.__teacherApprovalsTab = tab;
    document.querySelectorAll("[data-teacher-approval-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-teacher-approval-tab") === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-teacher-approval-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-teacher-approval-tab");
      if (!tab) return;
      setActiveTab(tab);
      if (typeof loadTeacherApprovals === "function") loadTeacherApprovals();
    });
  });

  try {
    if (typeof loadTeacherApprovals === "function") await loadTeacherApprovals();
  } catch (e) {
    console.error(e);
  }

  document.getElementById("refresh-teacher-approvals")?.addEventListener("click", () => {
    if (typeof loadTeacherApprovals === "function") loadTeacherApprovals();
    if (typeof showToast === "function") showToast("Teacher list refreshed.", "success");
  });

  document.getElementById("teacher-approval-reset")?.addEventListener("click", () => {
    const s = document.getElementById("teacher-approval-search");
    if (s) s.value = "";
    if (typeof loadTeacherApprovals === "function") loadTeacherApprovals();
  });

  document.getElementById("teacher-approval-search")?.addEventListener("input", () => {
    if (typeof loadTeacherApprovals === "function") loadTeacherApprovals();
  });

  function handleTeacherApprovalRowInteraction(event) {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;

    // Action buttons take priority — opening the profile would block them otherwise.
    const actionEl = target.closest("[data-action]");
    if (actionEl && actionEl.dataset.action && actionEl.dataset.id) {
      const action = actionEl.dataset.action;
      const idNumber = actionEl.dataset.id;
      if (action === "approve" && typeof updateAdminUserStatus === "function") {
        updateAdminUserStatus(idNumber, "approved");
      }
      if (action === "reject" && typeof updateAdminUserStatus === "function") {
        updateAdminUserStatus(idNumber, "rejected");
      }
      return;
    }

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
  teacherTableBody?.addEventListener("click", handleTeacherApprovalRowInteraction);
  teacherTableBody?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target && typeof event.target.closest === "function"
      ? event.target.closest("[data-profile-id]")
      : null;
    if (!row || event.target.closest("[data-action]")) return;
    event.preventDefault();
    handleTeacherApprovalRowInteraction({ target: row, preventDefault: () => {} });
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
