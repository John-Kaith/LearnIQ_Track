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

/** Force dark ink on white paper for every paintable node (PDF export only). */
function applyPdfExportPaintStyles(root) {
  const ink = "#111827";
  const inkMuted = "#374151";
  const inkLink = "#1d4ed8";
  const paper = "#ffffff";
  const codeBg = "#f1f5f9";
  const border = "#e2e8f0";

  root.style.setProperty("background", paper, "important");
  root.style.setProperty("background-color", paper, "important");
  root.style.setProperty("color", ink, "important");
  root.style.setProperty("-webkit-text-fill-color", ink, "important");
  root.style.setProperty("font-family", "Inter, system-ui, Segoe UI, sans-serif", "important");
  root.style.setProperty("font-size", "11pt", "important");
  root.style.setProperty("line-height", "1.55", "important");

  root.querySelectorAll("*").forEach((el) => {
    const t = el.tagName;
    if (t === "SCRIPT" || t === "STYLE") return;
    if (t === "IMG" || t === "SVG") return;

    if (t === "A") {
      el.style.setProperty("color", inkLink, "important");
      el.style.setProperty("-webkit-text-fill-color", inkLink, "important");
      return;
    }
    if (t === "PRE" || t === "CODE") {
      el.style.setProperty("color", "#0f172a", "important");
      el.style.setProperty("-webkit-text-fill-color", "#0f172a", "important");
      el.style.setProperty("background-color", codeBg, "important");
      el.style.setProperty("border", `1px solid ${border}`, "important");
      return;
    }
    if (t === "HR") {
      el.style.setProperty("border-color", "rgba(15,23,42,0.22)", "important");
      el.style.setProperty("border-style", "solid", "important");
      el.style.setProperty("border-width", "1px 0 0", "important");
      el.style.setProperty("background", "transparent", "important");
      return;
    }
    if (t === "TH" || t === "TD") {
      el.style.setProperty("color", ink, "important");
      el.style.setProperty("-webkit-text-fill-color", ink, "important");
      el.style.setProperty("border-color", border, "important");
      return;
    }
    if (t === "H3") {
      el.style.setProperty("color", inkMuted, "important");
      el.style.setProperty("-webkit-text-fill-color", inkMuted, "important");
      return;
    }
    if (t === "H1" || t === "H2" || t === "H4" || t === "H5" || t === "H6") {
      el.style.setProperty("color", ink, "important");
      el.style.setProperty("-webkit-text-fill-color", ink, "important");
      if (t === "H2") {
        el.style.setProperty("border-bottom-color", "rgba(15,23,42,0.18)", "important");
      }
      return;
    }
    if (t === "STRONG" || t === "B") {
      el.style.setProperty("color", ink, "important");
      el.style.setProperty("-webkit-text-fill-color", ink, "important");
      el.style.setProperty("font-weight", "700", "important");
      return;
    }
    if (t === "LI" || t === "P" || t === "SPAN" || t === "SMALL" || t === "DIV" || t === "OL" || t === "UL") {
      el.style.setProperty("color", ink, "important");
      el.style.setProperty("-webkit-text-fill-color", ink, "important");
    }
  });
}

/**
 * Build a viewport-safe clone for html2canvas (never use reviewer-markdown-body on the clone —
 * that class ties export nodes to dark-theme var(--text) rules).
 */
function createPdfExportClone(innerHtml, extraClassNames) {
  const clone = document.createElement("div");
  const extra = String(extraClassNames || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  clone.className = ["reviewer-pdf-export", ...extra].join(" ");
  clone.innerHTML = innerHtml;
  clone.setAttribute("aria-hidden", "true");
  applyPdfExportPaintStyles(clone);
  return clone;
}

function mountPdfExportCloneForCapture(clone) {
  clone.style.setProperty("position", "fixed", "important");
  clone.style.setProperty("left", "0", "important");
  clone.style.setProperty("top", "0", "important");
  clone.style.setProperty("z-index", "2147483646", "important");
  clone.style.setProperty("box-sizing", "border-box", "important");
  clone.style.setProperty("width", "794px", "important");
  clone.style.setProperty("max-width", "100vw", "important");
  clone.style.setProperty("min-height", "120px", "important");
  clone.style.setProperty("padding", "36px 42px", "important");
  clone.style.setProperty("pointer-events", "none", "important");
  clone.style.setProperty("overflow", "visible", "important");
  clone.style.setProperty("opacity", "1", "important");
  clone.style.setProperty("visibility", "visible", "important");
}

async function waitForPdfExportLayout() {
  if (document.fonts && typeof document.fonts.ready?.then === "function") {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function getHtml2PdfOptions(filename) {
  return {
    margin: [8, 8, 8, 8],
    filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };
}

/**
 * Export arbitrary HTML through html2pdf (history modal, shared reviewer pipeline).
 * @param {string} innerHtml
 * @param {string} filename - with or without .pdf
 * @param {string} [extraClassNames] - e.g. "history-pdf-export"
 */
async function downloadHtmlAsPdf(innerHtml, filename, extraClassNames) {
  if (typeof html2pdf === "undefined") {
    if (typeof showToast === "function") {
      showToast("PDF export is not ready. Refresh the page and try again.", "error");
    }
    return false;
  }

  const html = String(innerHtml || "").trim();
  if (!html) {
    if (typeof showToast === "function") showToast("Nothing to export yet.", "error");
    return false;
  }

  const clone = createPdfExportClone(html, extraClassNames);
  mountPdfExportCloneForCapture(clone);
  document.body.appendChild(clone);

  await waitForPdfExportLayout();
  void clone.offsetHeight;

  if (clone.scrollHeight < 8) {
    clone.remove();
    if (typeof showToast === "function") showToast("Could not layout PDF content. Try again.", "error");
    return false;
  }

  try {
    await html2pdf().set(getHtml2PdfOptions(filename)).from(clone).save();
    return true;
  } catch (e) {
    console.error(e);
    if (typeof showToast === "function") showToast("Could not create PDF. Try again.", "error");
    return false;
  } finally {
    clone.remove();
  }
}

async function downloadReviewerPdfFromElement(sourceEl, suggestedBasename) {
  if (!sourceEl) return false;

  const html = (sourceEl.innerHTML || "").trim();
  if (!html) {
    if (typeof showToast === "function") showToast("Nothing to export yet.", "error");
    return false;
  }

  const base = (suggestedBasename || "reviewer")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80) || "reviewer";

  const ok = await downloadHtmlAsPdf(html, `${base}.pdf`, "");
  if (ok && typeof showToast === "function") showToast("Reviewer PDF downloaded.", "success");
  return ok;
}
