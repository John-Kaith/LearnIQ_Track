document.addEventListener("DOMContentLoaded", async () => {
  try {
    await LearnIQTopnav.mountTeacher();
  } catch (e) {
    console.error(e);
  }
  setupTeacherImmersionMonitor().catch((e) => {
    console.error(e);
    showToast(e?.message || "Teacher immersion page failed.", "error");
  });
});
