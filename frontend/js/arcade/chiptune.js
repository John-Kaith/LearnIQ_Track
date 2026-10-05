/**
 * Arcade chiptune: makes a game's background music in the browser (no audio
 * files). A song is a short loop of chords, a melody and drums; render(song)
 * plays it once into a WAV file and resolves with a blob: URL that loops like
 * any other track (ArcadeShell.sound). Resolves null if the browser can't.
 *
 * song = {
 *   bpm: 112,                      one step is an eighth note; a bar is 8 steps
 *   chords: [[48, 52, 55], ...],   MIDI notes, one chord per bar (sets the loop length)
 *   melody: [[step, midi, length in steps], ...]
 *   lead: { wave: "pulse" | "square" | "triangle", gain }
 *   arp:  { wave, gain, pattern: [chord index per step] } (optional)
 *   bass: { wave, gain, steps: [steps in a bar], fifthOn: [steps that play the fifth] }
 *   kick / snare / hat: [steps in a bar], with kickGain / snareGain / hatGain
 * }
 */
(function (global) {
  "use strict";

  var RATE = 22050; // plenty for 8-bit style music, and half the size of 44.1 kHz
  var TAIL = 1; // seconds rendered past the loop end, folded back onto the start

  function hz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** 25% pulse wave, the classic chiptune lead. */
  function pulseWave(ctx) {
    var n = 24;
    var real = new Float32Array(n);
    var imag = new Float32Array(n);
    var duty = 0.25;
    for (var k = 1; k < n; k++) {
      real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
      imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    return ctx.createPeriodicWave(real, imag);
  }

  function noiseBuffer(ctx) {
    var buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** 16-bit mono WAV. */
  function wavBlob(samples, rate) {
    var n = samples.length;
    var view = new DataView(new ArrayBuffer(44 + n * 2));
    var text = function (offset, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    };
    text(0, "RIFF");
    view.setUint32(4, 36 + n * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([view.buffer], { type: "audio/wav" });
  }

  function render(song) {
    var Offline = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!Offline || !song || !song.chords || !song.chords.length) return Promise.resolve(null);
    try {
      var step = 60 / song.bpm / 2;
      var steps = song.chords.length * 8;
      var loopSeconds = steps * step;
      var ctx = new Offline(1, Math.ceil((loopSeconds + TAIL) * RATE), RATE);
      var pulse = pulseWave(ctx);
      var noise = noiseBuffer(ctx);

      var lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 4200;
      var compressor = ctx.createDynamicsCompressor();
      var bus = ctx.createGain();
      bus.gain.value = 0.55;
      bus.connect(lowpass);
      lowpass.connect(compressor);
      compressor.connect(ctx.destination);

      var tone = function (t, freq, dur, vol, wave) {
        var osc = ctx.createOscillator();
        if (wave === "pulse") osc.setPeriodicWave(pulse);
        else osc.type = wave || "square";
        osc.frequency.setValueAtTime(freq, t);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t);
        osc.stop(t + dur + 0.03);
      };

      var hit = function (t, dur, vol, type, freq) {
        var src = ctx.createBufferSource();
        src.buffer = noise;
        var filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(bus);
        src.start(t);
        src.stop(t + dur + 0.02);
      };

      var kick = function (t, vol) {
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(t);
        osc.stop(t + 0.18);
      };

      var has = function (list, n) {
        return Array.isArray(list) && list.indexOf(n) !== -1;
      };

      for (var s = 0; s < steps; s++) {
        var t = s * step + 0.01;
        var inBar = s % 8;
        var chord = song.chords[Math.floor(s / 8)];
        if (song.bass && has(song.bass.steps, inBar)) {
          var bassNote = (has(song.bass.fifthOn, inBar) ? chord[2] : chord[0]) - 12;
          tone(t, hz(bassNote), step * 1.6, song.bass.gain, song.bass.wave);
        }
        if (song.arp) {
          var pick = song.arp.pattern[inBar % song.arp.pattern.length];
          tone(t, hz(chord[pick] + 12), step * 0.8, song.arp.gain, song.arp.wave);
        }
        if (has(song.kick, inBar)) kick(t, song.kickGain || 0.3);
        if (has(song.snare, inBar)) hit(t, 0.1, song.snareGain || 0.08, "bandpass", 1800);
        if (has(song.hat, inBar)) hit(t, 0.04, song.hatGain || 0.035, "highpass", 7000);
      }
      (song.melody || []).forEach(function (note) {
        tone(note[0] * step + 0.01, hz(note[1]), note[2] * step * 0.92, song.lead.gain, song.lead.wave);
      });

      return new Promise(function (resolve, reject) {
        ctx.oncomplete = function (e) {
          resolve(e.renderedBuffer);
        };
        var rendering = ctx.startRendering();
        if (rendering && typeof rendering.then === "function") rendering.then(resolve, reject);
      }).then(function (buffer) {
        var data = buffer.getChannelData(0);
        var loopLength = Math.round(loopSeconds * RATE);
        var out = new Float32Array(loopLength);
        out.set(data.subarray(0, loopLength));
        // Notes still ringing at the loop end continue at its start: the loop has no seam.
        for (var i = loopLength; i < data.length; i++) out[i - loopLength] += data[i];
        var peak = 0;
        for (var j = 0; j < out.length; j++) peak = Math.max(peak, Math.abs(out[j]));
        if (peak > 0) {
          var scale = 0.85 / peak;
          for (var k = 0; k < out.length; k++) out[k] *= scale;
        }
        return URL.createObjectURL(wavBlob(out, RATE));
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  global.ArcadeChiptune = { render: render };
})(window);
