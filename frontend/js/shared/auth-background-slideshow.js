/**
 * Slow crossfade background for login / signup (frontend/images/).
 */
(function () {
  var SLIDES = [
    "images/120037430_358883125154225_420387870410868505_n_1655452949.jpg",
    "images/landing-hero.jpg",
    "images/psbcbuilding_1712794431.jpg",
  ];
  var DISPLAY_MS = 3000;

  function prefersReducedMotion() {
    return (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("reduce-motion")
    );
  }

  function init() {
    var host = document.querySelector(".auth-page-media--slideshow");
    if (!host || host.dataset.slideshowReady === "1") return;
    host.dataset.slideshowReady = "1";
    host.innerHTML = "";

    var slides = SLIDES.map(function (src, index) {
      var el = document.createElement("div");
      el.className = "auth-page-media-slide" + (index === 0 ? " is-active" : "");
      el.style.backgroundImage = 'url("' + src + '")';
      host.appendChild(el);
      var img = new Image();
      img.src = src;
      return el;
    });

    if (slides.length < 2 || prefersReducedMotion()) return;

    var index = 0;
    setInterval(function () {
      slides[index].classList.remove("is-active");
      index = (index + 1) % slides.length;
      slides[index].classList.add("is-active");
    }, DISPLAY_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
