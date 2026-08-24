// Shared text-to-speech announcer for live QR check-in scans (Class
// Attendance teacher camera, Immersion workplace QR display). Speaks a short
// confirmation out loud so whoever is watching the scanning device hears
// each check-in without needing to look at the screen. Silently does
// nothing on browsers without SpeechSynthesis support — a nice-to-have,
// never something that should block or error out the actual check-in.

(function () {
  let cachedVoice = null;
  let voicesReady = false;

  function pickVoice() {
    if (voicesReady) return cachedVoice;
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null; // getVoices() can be empty before the
    // browser's async voice list has loaded — try again on the next call
    voicesReady = true;
    cachedVoice =
      voices.find((v) => /en-US|en-GB/i.test(v.lang) && /natural|neural/i.test(v.name)) ||
      voices.find((v) => /en-US|en-GB/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0] ||
      null;
    return cachedVoice;
  }

  function announceVoice(text) {
    const message = String(text || "").trim();
    if (!message) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    try {
      const utter = new SpeechSynthesisUtterance(message);
      utter.rate = 1;
      utter.pitch = 1;
      utter.volume = 1;
      const voice = pickVoice();
      if (voice) utter.voice = voice;
      window.speechSynthesis.speak(utter);
    } catch {
      // Voice announcement is a nice-to-have — never let it break the caller.
    }
  }

  window.announceVoice = announceVoice;
})();
