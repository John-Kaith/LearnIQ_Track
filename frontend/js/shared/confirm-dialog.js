/**
 * Themed confirm dialog (replaces window.confirm). Returns Promise<boolean>.
 */
(function () {
  if (window.LearnIQConfirm && typeof window.LearnIQConfirm.show === "function") return;

  let zBase = 2400;

  function show(options) {
    const o = options && typeof options === "object" ? options : {};
    const title = o.title != null ? String(o.title) : "Confirm";
    const message = o.message != null ? String(o.message) : "";
    const confirmText = o.confirmText != null ? String(o.confirmText) : "OK";
    const cancelText = o.cancelText != null ? String(o.cancelText) : "Cancel";
    const variant = o.variant === "danger" ? "danger" : "default";

    return new Promise(function (resolve) {
      const backdrop = document.createElement("div");
      backdrop.className = "action-modal-backdrop learniq-confirm-backdrop";
      backdrop.style.zIndex = String(++zBase);

      const panel = document.createElement("div");
      panel.className = "action-modal glass-card learniq-confirm-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      const titleId = "learniq-confirm-title-" + String(Date.now());
      panel.setAttribute("aria-labelledby", titleId);

      const head = document.createElement("div");
      head.className = "action-modal-head";
      const h3 = document.createElement("h3");
      h3.id = titleId;
      h3.textContent = title;
      head.appendChild(h3);

      const msg = document.createElement("p");
      msg.className = "small-note learniq-confirm-message";
      msg.textContent = message;

      const actions = document.createElement("div");
      actions.className = "learniq-confirm-actions";

      const btnCancel = document.createElement("button");
      btnCancel.type = "button";
      btnCancel.className = "btn btn-ghost";
      btnCancel.textContent = cancelText;

      const btnOk = document.createElement("button");
      btnOk.type = "button";
      btnOk.className = variant === "danger" ? "btn btn-danger" : "btn btn-primary";
      btnOk.textContent = confirmText;

      function finish(val) {
        document.removeEventListener("keydown", onKey);
        try {
          backdrop.remove();
        } catch (_) {}
        resolve(!!val);
      }

      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }

      btnCancel.addEventListener("click", function () {
        finish(false);
      });
      btnOk.addEventListener("click", function () {
        finish(true);
      });
      backdrop.addEventListener("click", function (e) {
        if (e.target === backdrop) finish(false);
      });

      actions.appendChild(btnCancel);
      actions.appendChild(btnOk);
      panel.appendChild(head);
      panel.appendChild(msg);
      panel.appendChild(actions);
      backdrop.appendChild(panel);
      document.body.appendChild(backdrop);
      document.addEventListener("keydown", onKey);
      btnCancel.focus();
    });
  }

  window.LearnIQConfirm = { show: show };
})();
