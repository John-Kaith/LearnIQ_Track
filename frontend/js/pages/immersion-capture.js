/**
 * Immersion clock: camera + GPS + timestamp before Time In or Time Out.
 */
(function () {
  const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
  const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

  function formatDisplayTimestamp(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
    } catch {
      return iso;
    }
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
    });
  }

  const CAPTURE_W = 1920;
  const CAPTURE_H = 1080;
  const LANDSCAPE_RATIO = CAPTURE_W / CAPTURE_H;

  function drawLandscape1080(video, canvas) {
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    let sw;
    let sh;
    let sx;
    let sy;
    const sourceRatio = vw / vh;
    if (sourceRatio > LANDSCAPE_RATIO) {
      sw = vw;
      sh = Math.round(vw / LANDSCAPE_RATIO);
      sx = 0;
      sy = Math.round((vh - sh) / 2);
    } else {
      sh = vh;
      sw = Math.round(vh * LANDSCAPE_RATIO);
      sx = Math.round((vw - sw) / 2);
      sy = 0;
    }
    canvas.width = CAPTURE_W;
    canvas.height = CAPTURE_H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAPTURE_W, CAPTURE_H);
  }

  async function reverseGeocode(lat, lon) {
    const url = `${NOMINATIM_REVERSE}?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Could not resolve address from GPS.");
    const data = await res.json();
    const name = (data.display_name || "").trim();
    if (!name) throw new Error("No address found for your GPS coordinates.");
    return name;
  }

  function createImmersionCaptureController(options) {
    const {
      takePhotoBtn,
      shutterBtn,
      cancelCameraBtn,
      cameraPanel,
      videoEl,
      canvasEl,
      previewPanel,
      previewImg,
      previewBadgeEl,
      fieldLocation,
      fieldTimeLabel,
      fieldTime,
      fieldCoords,
      captureStatusEl,
      timeInBtn,
      timeOutBtn,
      onReadyChange,
    } = options;

    let mediaStream = null;
    let readyPayload = null;
    let mode = "time_in";

    const copy = {
      time_in: {
        idle: "Take a photo to capture your location and time before Time In.",
        ready: "Photo, location, and time captured. You can now tap Time In.",
        preview: "Photo Preview",
        timeLabel: "time in:",
        photoName: "time-in.jpg",
        gpsError: "Location permission denied. Allow location access to complete Time In verification.",
      },
      time_out: {
        idle: "Take a photo to capture your location and time before Time Out.",
        ready: "Photo, location, and time captured. You can now tap Time Out.",
        preview: "Time Out Photo Preview",
        timeLabel: "time out:",
        photoName: "time-out.jpg",
        gpsError: "Location permission denied. Allow location access to complete Time Out verification.",
      },
    };

    function modeCopy() {
      return copy[mode] || copy.time_in;
    }

    function setStatus(msg, isError) {
      if (!captureStatusEl) return;
      captureStatusEl.textContent = msg || "";
      captureStatusEl.classList.toggle("is-error", Boolean(isError));
    }

    function syncActionButton(btn, ready, idleTitle, enablePrimary) {
      if (!btn) return;
      btn.disabled = !ready;
      btn.setAttribute("aria-disabled", ready ? "false" : "true");
      btn.title = ready ? "" : idleTitle;
      btn.classList.toggle("is-locked", !ready);
      if (enablePrimary !== false) {
        btn.classList.toggle("btn-primary", ready);
        btn.classList.toggle("btn-secondary", !ready);
      }
    }

    function updateActionButtons() {
      const ready = Boolean(readyPayload);
      const c = modeCopy();
      if (fieldTimeLabel) fieldTimeLabel.textContent = c.timeLabel;
      if (previewBadgeEl) previewBadgeEl.textContent = c.preview;

      if (mode === "time_in") {
        syncActionButton(timeInBtn, ready, "Take a photo first to enable Time In");
        if (timeOutBtn) {
          timeOutBtn.disabled = true;
          timeOutBtn.classList.add("is-locked");
          timeOutBtn.classList.remove("btn-primary");
          timeOutBtn.classList.add("btn-secondary");
        }
      } else {
        syncActionButton(timeOutBtn, ready, "Take a photo first to enable Time Out");
        if (timeInBtn) {
          timeInBtn.disabled = true;
          timeInBtn.classList.add("is-locked");
          timeInBtn.classList.remove("btn-primary");
          timeInBtn.classList.add("btn-secondary");
        }
      }
    }

    function notifyReady() {
      updateActionButtons();
      if (typeof onReadyChange === "function") onReadyChange(Boolean(readyPayload), mode);
    }

    function setMode(nextMode) {
      mode = nextMode === "time_out" ? "time_out" : "time_in";
      resetCapture();
    }

    function stopCamera() {
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
      }
      if (videoEl) videoEl.srcObject = null;
      if (cameraPanel) cameraPanel.hidden = true;
    }

    function clearCaptureFields() {
      if (fieldLocation) fieldLocation.textContent = "—";
      if (fieldTime) fieldTime.textContent = "—";
      if (fieldCoords) fieldCoords.textContent = "—";
    }

    function fillCaptureFields(payload) {
      if (fieldLocation) fieldLocation.textContent = payload.readable_location_name || "—";
      if (fieldTime) fieldTime.textContent = formatDisplayTimestamp(payload.capture_timestamp);
      if (fieldCoords) {
        fieldCoords.textContent = `${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}`;
      }
    }

    function resetCapture() {
      readyPayload = null;
      stopCamera();
      if (previewPanel) previewPanel.hidden = true;
      if (previewImg) {
        previewImg.removeAttribute("src");
        previewImg.hidden = true;
      }
      if (takePhotoBtn) takePhotoBtn.disabled = false;
      clearCaptureFields();
      setStatus(modeCopy().idle, false);
      notifyReady();
    }

    function showPreview(payload) {
      readyPayload = payload;
      if (previewPanel) previewPanel.hidden = false;
      if (previewImg && payload.previewUrl) {
        previewImg.src = payload.previewUrl;
        previewImg.hidden = false;
      }
      fillCaptureFields(payload);
      if (takePhotoBtn) takePhotoBtn.disabled = true;
      setStatus(modeCopy().ready, false);
      notifyReady();
    }

    async function capturePhotoAndMetadata() {
      setStatus("Opening camera…", false);
      if (takePhotoBtn) takePhotoBtn.disabled = true;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not available. Use HTTPS or localhost and a device with a camera.");
        }
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            aspectRatio: { ideal: 16 / 9 },
          },
          audio: false,
        });
        if (cameraPanel) cameraPanel.hidden = false;
        if (videoEl) {
          videoEl.srcObject = mediaStream;
          await videoEl.play();
        }
        setStatus("Position yourself in frame, then tap Capture.", false);
        if (takePhotoBtn) takePhotoBtn.disabled = false;
      } catch (e) {
        if (takePhotoBtn) takePhotoBtn.disabled = false;
        const denied = e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
        setStatus(
          denied
            ? "Camera permission denied. Allow camera access in your browser settings and try again."
            : e?.message || "Could not open camera.",
          true
        );
        stopCamera();
      }
    }

    async function shutterCapture() {
      if (!videoEl || !canvasEl) return;
      setStatus("Capturing photo and GPS…", false);
      if (shutterBtn) shutterBtn.disabled = true;

      try {
        drawLandscape1080(videoEl, canvasEl);
        const captureIso = new Date().toISOString();
        const blob = await new Promise((resolve, reject) => {
          canvasEl.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode photo."))), "image/jpeg", 0.88);
        });

        let position;
        try {
          position = await getCurrentPosition();
        } catch (geoErr) {
          const denied = geoErr && geoErr.code === 1;
          throw new Error(denied ? modeCopy().gpsError : geoErr?.message || "Could not get GPS location.");
        }

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setStatus("Resolving address…", false);
        const locationName = await reverseGeocode(lat, lon);
        const previewUrl = URL.createObjectURL(blob);

        stopCamera();
        showPreview({
          blob,
          previewUrl,
          latitude: lat,
          longitude: lon,
          readable_location_name: locationName,
          capture_timestamp: captureIso,
        });
      } catch (e) {
        setStatus(e?.message || "Capture failed.", true);
        if (takePhotoBtn) takePhotoBtn.disabled = false;
      } finally {
        if (shutterBtn) shutterBtn.disabled = false;
      }
    }

    function buildFormData() {
      if (!readyPayload) return null;
      const fd = new FormData();
      fd.append("photo", readyPayload.blob, modeCopy().photoName);
      fd.append("latitude", String(readyPayload.latitude));
      fd.append("longitude", String(readyPayload.longitude));
      fd.append("readable_location_name", readyPayload.readable_location_name);
      fd.append("capture_timestamp", readyPayload.capture_timestamp);
      return fd;
    }

    takePhotoBtn?.addEventListener("click", () => {
      if (readyPayload) return;
      void capturePhotoAndMetadata();
    });
    shutterBtn?.addEventListener("click", () => void shutterCapture());
    cancelCameraBtn?.addEventListener("click", () => {
      stopCamera();
      if (takePhotoBtn) takePhotoBtn.disabled = false;
      setStatus(modeCopy().idle, false);
    });

    setMode("time_in");

    return {
      setMode,
      getMode: () => mode,
      resetCapture,
      buildFormData,
      isReady: () => Boolean(readyPayload),
      revokePreview: () => {
        if (readyPayload?.previewUrl) URL.revokeObjectURL(readyPayload.previewUrl);
      },
    };
  }

  window.createImmersionCaptureController = createImmersionCaptureController;
})();
