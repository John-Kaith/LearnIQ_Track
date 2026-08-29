/**
 * Lesson Detail Page Entry Point
 * Handles file viewing and AI generation features (Reviewer, Quiz, Activity, Flashcards)
 */

(function () {
  const PAGE_NAME = "lesson-detail";
  let currentLesson = null;
  let currentFileId = null;
  let isGenerating = false;

  // Get lesson ID from URL params
  function getLessonIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("file_id");
  }

  // Initialize page
  async function init() {
    currentFileId = getLessonIdFromUrl();
    if (!currentFileId) {
      showError("No lesson selected");
      return;
    }

    // Setup back button
    document.querySelector(".nav-back-btn").addEventListener("click", () => {
      window.history.back();
    });

    // Setup tab navigation
    setupTabNavigation();

    // Setup event listeners
    setupEventListeners();

    // Load lesson data
    await loadLesson();

    // Load file viewer
    await loadFileViewer();
  }

  function setupTabNavigation() {
    const navButtons = document.querySelectorAll(".lesson-detail-nav-btn");
    const panels = document.querySelectorAll(".lesson-detail-tab-panel");

    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;

        // Update active button
        navButtons.forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");

        // Update active panel
        panels.forEach((panel) => {
          if (panel.id === `tab-${tabName}`) {
            panel.classList.add("is-active");
            panel.removeAttribute("hidden");
          } else {
            panel.classList.remove("is-active");
            panel.setAttribute("hidden", "");
          }
        });
      });
    });
  }

  function setupEventListeners() {
    // Reviewer
    document.getElementById("reviewer-generate-btn").addEventListener("click", () => generateReviewer());

    // Quiz
    document.getElementById("quiz-generate-btn").addEventListener("click", () => generateQuiz());

    // Activity (Essays)
    document.getElementById("activity-generate-btn").addEventListener("click", () => generateActivity("essay"));

    // Flashcards
    document.getElementById("flashcards-generate-btn").addEventListener("click", () => generateActivity("flashcards"));
  }

  async function loadLesson() {
    try {
      const lesson = await window.LearnIQAPI.call(`/lessons/${currentFileId}`, { method: "GET" });
      currentLesson = lesson;

      document.getElementById("lesson-detail-title").textContent = lesson.filename || "Lesson";
      document.getElementById("lesson-detail-subtitle").textContent = lesson.teacher_name || "—";
    } catch (err) {
      console.error("Failed to load lesson:", err);
    }
  }

  async function loadFileViewer() {
    try {
      const container = document.getElementById("pdf-viewer");
      const loading = document.getElementById("file-viewer-loading");
      const error = document.getElementById("file-viewer-error");

      // For now, show a message that file viewing is available
      // In production, integrate with PDF.js or similar
      loading.hidden = true;
      container.innerHTML = `
        <div class="file-viewer-placeholder">
          <i class="fa-solid fa-file-pdf"></i>
          <p>${currentLesson?.filename || "File"}</p>
          <small>File viewer integration coming soon. Use "Generate" buttons to create study materials.</small>
        </div>
      `;
    } catch (err) {
      console.error("Failed to load file:", err);
      document.getElementById("file-viewer-error").textContent = "Could not load file";
      document.getElementById("file-viewer-error").hidden = false;
    }
  }

  async function generateReviewer() {
    await generateContent("reviewer", "/generate-reviewer");
  }

  async function generateQuiz() {
    await generateContent("quiz", "/generate-question");
  }

  async function generateActivity(type) {
    const endpoint = "/generate-activities";
    const tabName = type === "flashcards" ? "flashcards" : "activity";

    setGenerating(true, tabName);

    try {
      const payload = {
        file_id: currentFileId,
        activity_type: type,
        count: 5,
      };

      const response = await window.LearnIQAPI.call(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.error) {
        updateStatus(tabName, `Error: ${response.error}`);
        return;
      }

      // Handle activities response
      handleActivitiesResponse(response, type);
      updateStatus(tabName, `${type === "flashcards" ? "Flashcards" : "Activities"} generated successfully!`);
    } catch (err) {
      console.error(`Generate ${type} error:`, err);
      updateStatus(tabName, `Error: ${err.message || "Failed to generate"}`);
    } finally {
      setGenerating(false, tabName);
    }
  }

  async function generateContent(contentType, endpoint) {
    const tabName = contentType;
    setGenerating(true, tabName);

    try {
      const payload = { file_id: currentFileId };

      // Add quiz-specific options
      if (contentType === "quiz") {
        payload.quiz_count = 10;
      }

      const response = await window.LearnIQAPI.call(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.error) {
        updateStatus(tabName, `Error: ${response.error}`);
        return;
      }

      // Handle content response
      if (contentType === "reviewer") {
        handleReviewerResponse(response);
      } else if (contentType === "quiz") {
        handleQuizResponse(response);
      }

      updateStatus(tabName, `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} generated successfully!`);
    } catch (err) {
      console.error(`Generate ${contentType} error:`, err);
      updateStatus(tabName, `Error: ${err.message || "Failed to generate"}`);
    } finally {
      setGenerating(false, tabName);
    }
  }

  function handleReviewerResponse(data) {
    const container = document.getElementById("reviewer-container");
    const content = document.getElementById("reviewer-content");

    if (data.reviewer) {
      content.innerHTML = window.ReviewerMarkdown?.toHtml?.(data.reviewer) || `<p>${data.reviewer}</p>`;
      container.hidden = false;
    }
  }

  function handleQuizResponse(data) {
    const container = document.getElementById("quiz-container");
    const body = document.getElementById("quiz-body");

    if (data.quiz && Array.isArray(data.quiz)) {
      // Render quiz questions (reuse logic from my-lesson.html)
      const html = data.quiz
        .map(
          (q, i) =>
            `
        <div class="quiz-question-card">
          <h5>Q${i + 1}: ${q.question}</h5>
          <div class="quiz-options">
            ${(q.options || [])
              .map(
                (opt, j) =>
                  `
              <label class="quiz-option">
                <input type="radio" name="q${i}" value="${j}" />
                <span>${opt}</span>
              </label>
            `
              )
              .join("")}
          </div>
        </div>
      `
        )
        .join("");

      body.innerHTML = html;
      container.hidden = false;

      // Add submit button
      if (!document.getElementById("quiz-submit-btn")) {
        const submitBtn = document.createElement("button");
        submitBtn.id = "quiz-submit-btn";
        submitBtn.className = "btn btn-primary";
        submitBtn.textContent = "Submit Quiz";
        submitBtn.style.marginTop = "1rem";
        body.appendChild(submitBtn);
      }
    }
  }

  function handleActivitiesResponse(data, type) {
    const container = document.getElementById(type === "flashcards" ? "flashcards-container" : "activity-container");
    const list = document.getElementById(type === "flashcards" ? "flashcards-list" : "activity-list");

    if (type === "flashcards" && data[0]?.cards) {
      renderFlashcardsList(data[0].cards, list);
    } else if (type === "essay" && Array.isArray(data)) {
      renderEssayList(data, list);
    }

    container.hidden = false;
  }

  function renderFlashcardsList(cards, container) {
    const html = cards
      .map(
        (card, i) =>
          `
      <div class="flashcard-item">
        <div class="flashcard-header">
          <strong>Card ${i + 1}</strong>
          <small>${card.front}</small>
        </div>
        <div class="flashcard-preview">
          <p><strong>Front:</strong> ${card.front}</p>
          <p><strong>Back:</strong> ${card.back}</p>
        </div>
        <button class="btn btn-secondary btn-small flashcard-study-btn" data-index="${i}">
          <i class="fa-solid fa-book"></i> Study
        </button>
      </div>
    `
      )
      .join("");

    container.innerHTML = html;

    // Add event listeners to study buttons
    container.querySelectorAll(".flashcard-study-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index, 10);
        showFlashcardsModal(cards, index);
      });
    });
  }

  function renderEssayList(activities, container) {
    const html = activities
      .map(
        (act, i) =>
          `
      <div class="activity-item">
        <div class="activity-header">
          <strong>Activity ${i + 1}</strong>
        </div>
        <div class="activity-content">
          <p><strong>Question:</strong> ${act.question}</p>
          <p><strong>Sample Answer:</strong> ${act.answer}</p>
        </div>
      </div>
    `
      )
      .join("");

    container.innerHTML = html;
  }

  function showFlashcardsModal(cards, startIndex = 0) {
    const modal = document.getElementById("flashcards-modal");
    const front = document.getElementById("fc-front");
    const back = document.getElementById("fc-back");
    const counter = document.getElementById("fc-modal-counter");
    let currentIndex = startIndex;

    function updateCard() {
      const card = cards[currentIndex];
      front.textContent = card.front;
      back.textContent = card.back;
      counter.textContent = `${currentIndex + 1} / ${cards.length}`;
      back.hidden = true;
    }

    updateCard();
    modal.hidden = false;

    document.getElementById("fc-flip-btn").onclick = () => {
      back.hidden = !back.hidden;
    };

    document.getElementById("fc-prev-btn").onclick = () => {
      currentIndex = (currentIndex - 1 + cards.length) % cards.length;
      updateCard();
    };

    document.getElementById("fc-next-btn").onclick = () => {
      currentIndex = (currentIndex + 1) % cards.length;
      updateCard();
    };

    document.getElementById("fc-modal-close").onclick = () => {
      modal.hidden = true;
    };
  }

  function setGenerating(generating, tabName) {
    isGenerating = generating;

    const generateBtn = document.getElementById(`${tabName}-generate-btn`);
    const cancelBtn = document.getElementById(`${tabName}-ai-cancel-btn`);

    if (generateBtn) {
      generateBtn.disabled = generating;
      generateBtn.hidden = generating;
    }
    if (cancelBtn) {
      cancelBtn.hidden = !generating;
    }
  }

  function updateStatus(tabName, message) {
    const statusEl = document.getElementById(`${tabName}-status`);
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = message.includes("Error") ? "#ef4444" : "#10b981";
    }
  }

  function showError(message) {
    document.body.innerHTML = `
      <div class="error-page">
        <h1>Error</h1>
        <p>${message}</p>
        <button onclick="window.history.back()" class="btn btn-primary">Go Back</button>
      </div>
    `;
  }

  // Wait for API to be ready
  function waitForAPI(callback, attempts = 0) {
    if (window.LearnIQAPI) {
      callback();
    } else if (attempts < 50) {
      setTimeout(() => waitForAPI(callback, attempts + 1), 100);
    }
  }

  waitForAPI(init);
})();
