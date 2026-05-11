(function () {
  if (!document.body.classList.contains("index-landing")) return;
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  gsap.registerPlugin(ScrollTrigger);

  const easeOut = "power2.out";
  const easeSoft = "power3.out";

  gsap.timeline({ defaults: { duration: 0.72, ease: easeOut } })
    .from(".landing-hero-eyebrow", { opacity: 0, y: 18 }, 0)
    .from(".landing-hero-title", { opacity: 0, y: 26 }, 0.07)
    .from(".landing-hero-lead", { opacity: 0, y: 22 }, 0.14)
    .from(".landing-hero-actions", { opacity: 0, y: 20 }, 0.22)
    .from(".landing-scroll-cue", { opacity: 0, y: 14 }, 0.32);

  gsap.to(".landing-scroll-cue .fa-chevron-down", {
    y: 6,
    duration: 0.85,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
    delay: 0.9,
  });

  const scrollReveal = {
    duration: 0.68,
    ease: easeSoft,
  };

  gsap.from(".landing-simple-head > *", {
    scrollTrigger: {
      trigger: ".landing-simple-head",
      start: "top 86%",
      once: true,
    },
    opacity: 0,
    y: 26,
    stagger: 0.1,
    ...scrollReveal,
  });

  gsap.from(".landing-feature-card", {
    scrollTrigger: {
      trigger: ".landing-feature-grid",
      start: "top 82%",
      once: true,
    },
    opacity: 0,
    y: 40,
    stagger: 0.12,
    ...scrollReveal,
  });

  gsap.from(".landing-immersion-wide", {
    scrollTrigger: {
      trigger: ".landing-immersion-wide",
      start: "top 88%",
      once: true,
    },
    opacity: 0,
    y: 44,
    duration: 0.75,
    ease: easeSoft,
  });

  gsap.from(".landing-developers-card", {
    scrollTrigger: {
      trigger: ".landing-developers-card",
      start: "top 90%",
      once: true,
    },
    opacity: 0,
    y: 36,
    duration: 0.7,
    ease: easeSoft,
  });

  gsap.from(".landing-footer-grid > *", {
    scrollTrigger: {
      trigger: ".landing-site-footer",
      start: "top 92%",
      once: true,
    },
    opacity: 0,
    y: 22,
    stagger: 0.08,
    duration: 0.55,
    ease: easeOut,
  });

  gsap.from(".landing-footer-bar-inner", {
    scrollTrigger: {
      trigger: ".landing-footer-bar",
      start: "top 98%",
      once: true,
    },
    opacity: 0,
    duration: 0.45,
    ease: easeOut,
  });
})();
