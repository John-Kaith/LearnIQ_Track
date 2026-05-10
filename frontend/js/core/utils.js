function escapeHtml(text) {
  if (text == null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}
function fmtTime(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDate(value) {
  if (!value) return "\u2014";
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00`).toLocaleDateString();
  return s;
}

function hoursSince(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, (Date.now() - d.getTime()) / 36e5);
}
function animateProgressBars() {
  document.querySelectorAll(".progress-bar span[data-progress], .progress-bar span[style]").forEach((bar) => {
    const width = bar.dataset.progress || bar.style.width || "0%";
    bar.style.width = width;
  });
}
