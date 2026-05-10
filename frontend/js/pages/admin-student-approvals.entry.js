document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.LearnIQTopnav && typeof LearnIQTopnav.mountAdmin === "function") {
      await LearnIQTopnav.mountAdmin();
    }
  } catch (e) {
    console.error(e);
  }

  window.__studentApprovalsTab = "pending";

  function setActiveTab(tab) {
    window.__studentApprovalsTab = tab;
    document.querySelectorAll("[data-student-approval-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-student-approval-tab") === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  document.querySelectorAll("[data-student-approval-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-student-approval-tab");
      if (!tab) return;
      setActiveTab(tab);
      if (typeof loadPendingApprovals === "function") loadPendingApprovals();
    });
  });

  try {
    if (typeof loadPendingApprovals === "function") await loadPendingApprovals();
  } catch (e) {
    console.error(e);
  }

  document.getElementById("refresh-approvals")?.addEventListener("click", () => {
    if (typeof loadPendingApprovals === "function") loadPendingApprovals();
    if (typeof showToast === "function") showToast("Student list refreshed.", "success");
  });

  document.getElementById("approval-reset")?.addEventListener("click", () => {
    const s = document.getElementById("approval-search");
    if (s) s.value = "";
    if (typeof loadPendingApprovals === "function") loadPendingApprovals();
  });

  document.getElementById("approval-search")?.addEventListener("input", () => {
    if (typeof loadPendingApprovals === "function") loadPendingApprovals();
  });

  document.getElementById("approval-table-body")?.addEventListener("click", (event) => {
    const target = event.target;
    const profileEl = target && typeof target.closest === "function" ? target.closest("[data-profile-id]") : null;
    if (profileEl && profileEl.dataset.profileId != null && profileEl.dataset.profileId !== "") {
      event.preventDefault();
      const raw = String(profileEl.dataset.profileId || "").trim();
      const idNumber = raw ? decodeURIComponent(raw) : "";
      if (idNumber && typeof openAdminProfilePreviewModal === "function") {
        openAdminProfilePreviewModal(idNumber, "Student profile");
      }
      return;
    }

    const action = target?.dataset?.action;
    const idNumber = target?.dataset?.id;
    if (!action || !idNumber) return;
    if (action === "approve" && typeof updateAdminUserStatus === "function") {
      updateAdminUserStatus(idNumber, "approved");
    }
    if (action === "reject" && typeof updateAdminUserStatus === "function") {
      updateAdminUserStatus(idNumber, "rejected");
    }
  });

  const profileModal = document.getElementById("student-profile-modal");
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
