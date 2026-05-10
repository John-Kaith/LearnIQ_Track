/**
 * LearnIQ reviewer: normalize stored reviewer (string or legacy line array),
 * render Markdown safely for the dark UI, and export a print-friendly PDF.
 * Depends on globals: marked, DOMPurify, html2pdf (loaded from CDN before script.js).
 */

function normalizeReviewerMarkdown(reviewer) {
  if (reviewer == null) return "";
  if (typeof reviewer === "string") return reviewer.replace(/\r\n/g, "\n").trim();
  if (Array.isArray(reviewer)) {
    return reviewer
      .map((x) => String(x == null ? "" : x).trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return String(reviewer).trim();
}

function reviewerMarkdownToSafeHtml(md) {
  const raw = normalizeReviewerMarkdown(md);
  if (!raw) return "";

  const escapePlain = (text) => {
    if (typeof escapeHtml === "function") return escapeHtml(text);
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  };

  if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
    const html = typeof marked.parse === "function" ? marked.parse(raw) : marked(raw);
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }

  return `<pre class="reviewer-markdown-fallback">${escapePlain(raw)}</pre>`;
}

function mountReviewerMarkdownInto(el, reviewer) {
  if (!el) return;
  const text = normalizeReviewerMarkdown(reviewer);
  el.classList.add("reviewer-markdown-body");
  if (!text) {
    el.innerHTML = '<p class="small-note">No reviewer yet.</p>';
    return;
  }
  el.innerHTML = reviewerMarkdownToSafeHtml(text);
}

function setReviewerPdfButtonVisible(button, visible) {
  if (!button) return;
  button.hidden = !visible;
  button.disabled = !visible;
}

async function downloadReviewerPdfFromElement(sourceEl, suggestedBasename) {
  if (!sourceEl) return;
  if (typeof html2pdf === "undefined") {
    if (typeof showToast === "function") {
      showToast("PDF export is not ready. Refresh the page and try again.", "error");
    }
    return;
  }

  const base = (suggestedBasename || "reviewer")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "reviewer";

  const clone = document.createElement("div");
  clone.className = "reviewer-pdf-export reviewer-markdown-body";
  clone.innerHTML = sourceEl.innerHTML;
  clone.setAttribute("aria-hidden", "true");
  clone.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    "width:190mm",
    "box-sizing:border-box",
    "padding:12mm 14mm",
    "font:11pt/1.55 Inter,system-ui,Segoe UI,sans-serif",
    "background:#ffffff",
    "color:#111827",
  ].join(";");

  document.body.appendChild(clone);

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `${base}.pdf`,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };

  try {
    await html2pdf().set(opt).from(clone).save();
    if (typeof showToast === "function") showToast("Reviewer PDF downloaded.", "success");
  } catch (e) {
    console.error(e);
    if (typeof showToast === "function") showToast("Could not create PDF. Try again.", "error");
  } finally {
    clone.remove();
  }
}
