const canvas = document.querySelector("#heart-canvas");
const ctx = canvas.getContext("2d");
const audio = document.querySelector("#audio");
const playButton = document.querySelector("#play");
const heartToggle = document.querySelector("#heart-toggle");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const filePicker = document.querySelector("#file-picker");
const timeline = document.querySelector("#timeline");
const currentTimeLabel = document.querySelector("#current-time");
const durationLabel = document.querySelector("#duration");
const trackName = document.querySelector("#track-name");
const playlistButtons = [...document.querySelectorAll("[data-track]")];
const viewButtons = [...document.querySelectorAll("[data-view]")];

const TAU = Math.PI * 2;
const builtInTracks = [
  {
    title: "1979 — The Smashing Pumpkins",
    src: "assets/1979.mp3",
    bpm: 128,
  },
  {
    title: "Digital Love — Daft Punk",
    src: "assets/digital-love.mp3",
    bpm: 124,
  },
  {
    title: "Friday I'm in Love — The Cure",
    src: "assets/friday-im-in-love.mp3",
    bpm: 136,
  },
  {
    title: "Midnight City — M83",
    src: "assets/midnight-city.mp3",
    bpm: 106,
  },
  {
    title: "No Existes — Soda Stereo",
    src: "assets/no-existes.mp3",
    bpm: 79,
  },
  {
    title: "Heroes — David Bowie",
    src: "assets/heroes.mp3",
    bpm: 79,
  },
];
const particles = [];
const starParticles = [];
const cometParticles = [];
const saturnBodyParticles = [];
const saturnRingParticles = [];
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
let audioContext;
let analyser;
let frequencyData;
let demoTimer;
let demoBeat = 0;
let objectUrl;
let isPlaying = false;
let isBuffering = false;
let rotationX = 0;
let rotationY = 0;
let rotationZ = -0.1;
let dragStartX = 0;
let dragStartY = 0;
let rotationAtDragStart = { x: 0, y: 0, z: 0 };
let movedDuringGesture = false;
let previousFrame = performance.now();
let lastRenderedFrame = 0;
let bassAverage = 0.08;
let beatPulse = 0;
let lastBeatAt = 0;
let beatOffset = 0;
let currentBpm = builtInTracks[0].bpm;
let currentTrackIndex = 0;
let currentView = "saturn";

function heartPoint(t, band = 0) {
  const sin = Math.sin(t);
  const x = 16 * sin * sin * sin;
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  const scale = 1 - band * 0.06;
  return { x: x * scale, y: y * scale };
}

function buildHeart() {
  particles.length = 0;
  const bands = 4;
  const perBand = 30;

  for (let band = 0; band < bands; band += 1) {
    for (let index = 0; index < perBand; index += 1) {
      if (index === 0) continue;
      const t = (index / perBand) * TAU + band * 0.015;
      const point = heartPoint(t, band);
      particles.push({
        x: point.x,
        y: point.y,
        t,
        band,
        seed: Math.random() * TAU,
        drift: 0.72 + Math.random() * 0.6,
      });
    }
  }
}

function buildSpaceScene() {
  starParticles.length = 0;
  cometParticles.length = 0;
  saturnBodyParticles.length = 0;
  saturnRingParticles.length = 0;
  const starCount = 68;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < starCount; index += 1) {
    const yPosition = 1 - ((index + 0.5) / starCount) * 2;
    const ringRadius = Math.sqrt(1 - yPosition * yPosition);
    const angle = index * goldenAngle;
    const radiusNoise = 0.9 + Math.random() * 0.22;
    starParticles.push({
      x: Math.cos(angle) * ringRadius * 21 * radiusNoise,
      y: yPosition * 16.5 * radiusNoise,
      z: Math.sin(angle) * ringRadius * 13 * radiusNoise,
      seed: Math.random() * TAU,
      size: 0.72 + Math.random() * 0.55,
      char: index % 4 === 0 ? "✦" : index % 3 === 0 ? "⋆" : "·",
    });
  }

  for (let index = 0; index < 5; index += 1) {
    cometParticles.push({
      seed: (index / 5) * TAU + Math.random() * 0.4,
      speed: 0.00012 + Math.random() * 0.00008,
      radiusX: 18 + Math.random() * 6,
      radiusY: 12 + Math.random() * 5,
      depth: 8 + Math.random() * 9,
    });
  }

  const latitudeBands = 20;
  for (let latitudeIndex = 0; latitudeIndex <= latitudeBands; latitudeIndex += 1) {
    const latitude = -Math.PI / 2 + (latitudeIndex / latitudeBands) * Math.PI;
    const ringSize = Math.cos(latitude);
    const longitudeCount = Math.max(12, Math.round(44 * ringSize));
    for (let longitudeIndex = 0; longitudeIndex < longitudeCount; longitudeIndex += 1) {
      const longitude = (longitudeIndex / longitudeCount) * TAU + latitudeIndex * 0.11;
      saturnBodyParticles.push({
        x: Math.cos(longitude) * ringSize * 10.5,
        y: Math.sin(latitude) * 8.6,
        z: Math.sin(longitude) * ringSize * 7.4,
        seed: Math.random() * TAU,
      });
    }
  }

  const ringRadii = [13.5, 16, 18.5];
  for (let ring = 0; ring < ringRadii.length; ring += 1) {
    const radius = ringRadii[ring];
    const segments = 96;
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * TAU + ring * 0.035;
      saturnRingParticles.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * (0.17 + ring * 0.012),
        z: Math.sin(angle) * radius * 0.46,
        angle,
        ring,
        seed: Math.random() * TAU,
      });
    }
  }
}

function rotateLocal(x, y, z, angleX, angleY, angleZ) {
  const y1 = y * Math.cos(angleX) - z * Math.sin(angleX);
  const z1 = y * Math.sin(angleX) + z * Math.cos(angleX);
  const x2 = x * Math.cos(angleY) + z1 * Math.sin(angleY);
  const z2 = -x * Math.sin(angleY) + z1 * Math.cos(angleY);
  return {
    x: x2 * Math.cos(angleZ) - y1 * Math.sin(angleZ),
    y: x2 * Math.sin(angleZ) + y1 * Math.cos(angleZ),
    z: z2,
  };
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function getEnergy(now) {
  if (analyser && isPlaying && !audio.paused) {
    analyser.getByteFrequencyData(frequencyData);
    const bassBins = Math.min(18, frequencyData.length);
    let total = 0;
    for (let index = 0; index < bassBins; index += 1) total += frequencyData[index];
    const energy = total / bassBins / 255;
    bassAverage = bassAverage * 0.94 + energy * 0.06;
    const threshold = Math.max(0.13, bassAverage * 1.28);
    if (energy > threshold && now - lastBeatAt > 260) {
      beatPulse = 1;
      lastBeatAt = now;
    }
    return energy;
  }

  return 0.08;
}

function projectPoint(x, y, z, centerX, centerY) {
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosZ = Math.cos(rotationZ);
  const sinZ = Math.sin(rotationZ);

  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;
  const x3 = x2 * cosZ - y1 * sinZ;
  const y3 = x2 * sinZ + y1 * cosZ;
  const perspective = 620 / (620 + z2);

  return {
    x: centerX + x3 * perspective,
    y: centerY + y3 * perspective,
    z: z2,
    perspective,
  };
}

class HeartCharacterRenderer {
  drawGlyph({ point, right, text, font, color, shadowColor = "rgba(255, 166, 195, 0.48)", shadowBlur = 7 }) {
    ctx.save();
    ctx.translate(point.x, point.y);
    if (right) ctx.rotate(Math.atan2(right.y - point.y, right.x - point.x));
    ctx.scale(point.perspective, point.perspective);
    ctx.fillStyle = color;
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.font = font;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

class SaturnCharacterRenderer extends HeartCharacterRenderer {
  draw({ now, scale, centerX, centerY, reduced }) {
    const autoX = reduced ? 0 : 0.07 + Math.sin(now * 0.00009) * 0.055;
    const autoY = reduced ? 0 : now * 0.000025;
    const autoZ = reduced ? 0 : Math.sin(now * 0.000065) * 0.035;

    const projectParticle = (particle, localScale = scale) => {
      const position = rotateLocal(particle.x, particle.y, particle.z, autoX, autoY, autoZ);
      return {
        particle,
        point: projectPoint(position.x * localScale, position.y * localScale, position.z * localScale, centerX, centerY),
      };
    };

    const rings = saturnRingParticles.map((particle) => projectParticle(particle));
    const body = saturnBodyParticles.map((particle) => projectParticle(particle));
    const backRings = rings.filter((item) => item.point.z < 0);
    const frontRings = rings.filter((item) => item.point.z >= 0);
    const ringFont = `700 ${Math.max(5.4, scale * 0.56)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const bodyFont = `700 ${Math.max(5.4, scale * 0.57)}px ui-monospace, SFMono-Regular, Menlo, monospace`;

    const drawRings = (items) => {
      ctx.save();
      ctx.font = ringFont;
      ctx.shadowColor = "rgba(255, 166, 195, 0.56)";
      ctx.shadowBlur = 4;
      for (const item of items) {
        const ringAlpha = 0.7 + item.particle.ring * 0.1;
        ctx.fillStyle = `rgba(255, 194, 212, ${ringAlpha})`;
        ctx.fillText("19", item.point.x, item.point.y);
      }
      ctx.restore();
    };

    drawRings(backRings);
    ctx.save();
    ctx.font = bodyFont;
    ctx.shadowColor = "rgba(255, 166, 195, 0.42)";
    ctx.shadowBlur = 3;
    body.forEach((item, index) => {
      const depthLight = Math.max(0, Math.min(1, (item.point.z / (scale * 8) + 1) / 2));
      const red = Math.round(222 + depthLight * 22);
      const green = Math.round(116 + depthLight * 50);
      const blue = Math.round(158 + depthLight * 34);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.58 + depthLight * 0.38})`;
      ctx.fillText("19", item.point.x, item.point.y);
    });
    ctx.restore();
    drawRings(frontRings);
  }
}

const heartRenderer = new HeartCharacterRenderer();
const saturnRenderer = new SaturnCharacterRenderer();

function draw(now) {
  const targetFps = isBuffering ? 20 : window.innerWidth <= 480 ? 30 : 45;
  if (now - lastRenderedFrame < 1000 / targetFps) {
    requestAnimationFrame(draw);
    return;
  }
  lastRenderedFrame = now;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const frameDelta = Math.min(50, now - previousFrame);
  previousFrame = now;
  beatPulse *= Math.exp(-frameDelta / 115);
  const energy = getEnergy(now);
  let tempoPulse = 0;
  if (isPlaying && !audio.paused) {
    const beatPosition = ((audio.currentTime - beatOffset) * currentBpm) / 60;
    const beatPhase = ((beatPosition % 1) + 1) % 1;
    tempoPulse = Math.exp(-beatPhase * 10.5);
  }
  const reduced = motion.matches;
  const activePulse = Math.max(beatPulse, tempoPulse);
  const pulse = reduced ? 1 : 1 + activePulse * 0.135 + energy * 0.008;
  const baseScale = Math.min(width / 43, height / 39);
  const pulsedScale = baseScale * pulse;
  const scale = currentView === "heart" ? pulsedScale : baseScale;
  const centerX = width / 2;
  const centerY = height * 0.36;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(8.5, scale * 0.78)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.shadowColor = "rgba(255, 166, 195, 0.48)";
  ctx.shadowBlur = 7 + energy * 8 + activePulse * 10;

  if (currentView === "heart") {
    for (const particle of particles) {
      const wave = reduced ? 0 : Math.sin(now * 0.0015 * particle.drift + particle.seed);
      const depth = particle.band / 4;
      const localScale = scale * (1 + wave * 0.009 + energy * 0.012 * (1 - depth));
      const x = particle.x * localScale * 0.9;
      const y = particle.y * localScale * 0.84;
      const z = wave * scale * 0.7 + (1 - depth) * 2;
      const point = projectPoint(x, y, z, centerX, centerY);
      const nextHeartPoint = heartPoint(particle.t + 0.012, particle.band);
      const nextPoint = projectPoint(
        nextHeartPoint.x * localScale * 0.9,
        nextHeartPoint.y * localScale * 0.84,
        z,
        centerX,
        centerY,
      );
      const alpha = 0.48 + (1 - depth) * 0.38 + energy * 0.12;

      heartRenderer.drawGlyph({
        point,
        right: nextPoint,
        text: "i love you",
        font: `600 ${Math.max(8.5, scale * 0.78)}px ui-monospace, SFMono-Regular, Menlo, monospace`,
        color: `rgba(244, 166, 192, ${Math.min(alpha, 1)})`,
        shadowBlur: 7 + energy * 8 + activePulse * 10,
      });
    }

    const centerPoint = projectPoint(0, 0, 4, centerX, centerY);
    ctx.save();
    ctx.translate(centerPoint.x, centerPoint.y);
    ctx.scale(centerPoint.perspective, centerPoint.perspective);
    ctx.fillStyle = "rgba(255, 194, 212, 0.98)";
    ctx.shadowBlur = 11 + activePulse * 10;
    ctx.font = `700 ${Math.max(9, scale * 0.84)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText("i love you", 0, 0);
    ctx.restore();
  } else {
    const orbitX = reduced ? 0 : Math.sin(now * 0.00011) * 0.3;
    const orbitY = reduced ? 0 : now * 0.000075;
    const orbitZ = reduced ? 0 : Math.sin(now * 0.00008) * 0.16;

    for (const comet of cometParticles) {
      const angle = comet.seed + now * comet.speed;
      const tailAngle = angle - 0.24;
      const cometPosition = rotateLocal(
        Math.cos(angle) * comet.radiusX,
        Math.sin(angle) * comet.radiusY,
        Math.sin(angle * 0.7 + comet.seed) * comet.depth,
        orbitX,
        orbitY,
        orbitZ,
      );
      const tailPosition = rotateLocal(
        Math.cos(tailAngle) * comet.radiusX,
        Math.sin(tailAngle) * comet.radiusY,
        Math.sin(tailAngle * 0.7 + comet.seed) * comet.depth,
        orbitX,
        orbitY,
        orbitZ,
      );
      const head = projectPoint(cometPosition.x * baseScale, cometPosition.y * baseScale, cometPosition.z * baseScale, centerX, centerY);
      const tail = projectPoint(tailPosition.x * baseScale, tailPosition.y * baseScale, tailPosition.z * baseScale, centerX, centerY);
      const trail = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      trail.addColorStop(0, "rgba(234, 160, 183, 0)");
      trail.addColorStop(1, `rgba(255, 194, 212, ${0.72 + activePulse * 0.22})`);
      ctx.save();
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.2 + activePulse * 0.8;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
      ctx.translate(head.x, head.y);
      ctx.scale(head.perspective, head.perspective);
      ctx.fillStyle = "rgba(255, 211, 224, 0.95)";
      ctx.font = `700 ${Math.max(8, baseScale * 0.95)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText("✦", 0, 0);
      ctx.restore();
    }

    for (const star of starParticles) {
      const shimmer = reduced ? 0 : Math.sin(now * 0.002 + star.seed) * 0.14;
      const position = rotateLocal(star.x, star.y, star.z, orbitX, orbitY, orbitZ);
      const point = projectPoint(position.x * pulsedScale, position.y * pulsedScale, position.z * pulsedScale, centerX, centerY);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.scale(point.perspective, point.perspective);
      ctx.fillStyle = `rgba(244, 166, 192, ${0.58 + shimmer + activePulse * 0.2})`;
      ctx.shadowBlur = 7 + activePulse * 11;
      ctx.font = `600 ${Math.max(8, pulsedScale * star.size)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText(star.char, 0, 0);
      ctx.restore();
    }

    saturnRenderer.draw({ now, scale: baseScale, centerX, centerY, reduced });
  }

  ctx.restore();
  requestAnimationFrame(draw);
}

function setupAnalyser() {
  if (audioContext || !audio.src) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.82;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
}

function updatePlayingState(nextState) {
  isPlaying = nextState;
  playButton.classList.toggle("is-playing", nextState);
  playButton.setAttribute("aria-label", nextState ? "Pause" : "Play");
  heartToggle.setAttribute("aria-label", nextState ? "Pause music" : "Play music");
}

function startDemoPulse() {
  window.clearInterval(demoTimer);
  demoTimer = window.setInterval(() => {
    demoBeat = (demoBeat + 1) % 4;
  }, 510);
  updatePlayingState(true);
}

async function togglePlayback() {
  if (!audio.src) {
    if (isPlaying) {
      window.clearInterval(demoTimer);
      updatePlayingState(false);
    } else {
      startDemoPulse();
    }
    return;
  }

  setupAnalyser();
  if (audioContext?.state === "suspended") await audioContext.resume();

  if (audio.paused) {
    try {
      await audio.play();
    } catch {
      updatePlayingState(false);
    }
  } else {
    audio.pause();
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function updateTimeline() {
  const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  timeline.value = progress;
  timeline.style.setProperty("--progress", `${progress}%`);
  currentTimeLabel.textContent = formatTime(audio.currentTime);
  durationLabel.textContent = formatTime(audio.duration);
}

function loadSong(file) {
  if (!file) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  trackName.textContent = file.name.replace(/\.[^.]+$/, "");
  playlistButtons.forEach((button) => button.classList.remove("is-active"));
  currentTrackIndex = null;
  currentBpm = 128;
  beatOffset = 0;
  isBuffering = true;
  audio.load();
  togglePlayback();
}

function loadBuiltInTrack(index) {
  const track = builtInTracks[index];
  if (!track) return;
  audio.pause();
  audio.src = track.src;
  trackName.textContent = track.title;
  currentBpm = track.bpm;
  currentTrackIndex = index;
  beatOffset = 0;
  isBuffering = true;
  currentTimeLabel.textContent = "0:00";
  timeline.value = 0;
  timeline.style.setProperty("--progress", "0%");
  playlistButtons.forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.track) === index);
  });
  audio.load();
  togglePlayback();
}

playButton.addEventListener("click", togglePlayback);
heartToggle.addEventListener("pointerdown", (event) => {
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  rotationAtDragStart = { x: rotationX, y: rotationY, z: rotationZ };
  movedDuringGesture = false;
  heartToggle.setPointerCapture(event.pointerId);
});
heartToggle.addEventListener("pointermove", (event) => {
  if (!heartToggle.hasPointerCapture(event.pointerId)) return;
  const distanceX = event.clientX - dragStartX;
  const distanceY = event.clientY - dragStartY;
  if (Math.hypot(distanceX, distanceY) > 3) movedDuringGesture = true;
  if (event.shiftKey) {
    rotationZ = rotationAtDragStart.z + distanceX * 0.012;
  } else {
    rotationX = rotationAtDragStart.x - distanceY * 0.009;
    rotationY = rotationAtDragStart.y + distanceX * 0.009;
  }
});
heartToggle.addEventListener("pointerup", (event) => {
  if (heartToggle.hasPointerCapture(event.pointerId)) heartToggle.releasePointerCapture(event.pointerId);
});
heartToggle.addEventListener("pointercancel", (event) => {
  if (heartToggle.hasPointerCapture(event.pointerId)) heartToggle.releasePointerCapture(event.pointerId);
});
heartToggle.addEventListener("click", () => {
  if (movedDuringGesture) {
    movedDuringGesture = false;
    return;
  }
  togglePlayback();
});
heartToggle.addEventListener("wheel", (event) => {
  event.preventDefault();
  rotationZ += event.deltaY * 0.0025;
}, { passive: false });
heartToggle.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 0.18 : 0.1;
  if (event.key === "ArrowUp") rotationX -= step;
  else if (event.key === "ArrowDown") rotationX += step;
  else if (event.key === "ArrowLeft") rotationY -= step;
  else if (event.key === "ArrowRight") rotationY += step;
  else if (event.key.toLowerCase() === "q") rotationZ -= step;
  else if (event.key.toLowerCase() === "e") rotationZ += step;
  else return;
  event.preventDefault();
});
previousButton.addEventListener("click", () => {
  const index = currentTrackIndex === null
    ? builtInTracks.length - 1
    : (currentTrackIndex - 1 + builtInTracks.length) % builtInTracks.length;
  loadBuiltInTrack(index);
});
nextButton.addEventListener("click", () => {
  const index = currentTrackIndex === null
    ? 0
    : (currentTrackIndex + 1) % builtInTracks.length;
  loadBuiltInTrack(index);
});
filePicker.addEventListener("change", (event) => loadSong(event.target.files[0]));
playlistButtons.forEach((button) => {
  button.addEventListener("click", () => loadBuiltInTrack(Number(button.dataset.track)));
});
viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    viewButtons.forEach((item) => item.classList.toggle("is-active", item === button));
  });
});
timeline.addEventListener("input", () => {
  if (!audio.duration) return;
  audio.currentTime = (Number(timeline.value) / 100) * audio.duration;
  updateTimeline();
});
audio.addEventListener("play", () => updatePlayingState(true));
audio.addEventListener("pause", () => updatePlayingState(false));
audio.addEventListener("ended", () => updatePlayingState(false));
audio.addEventListener("loadstart", () => {
  isBuffering = true;
});
audio.addEventListener("canplay", () => {
  isBuffering = false;
});
audio.addEventListener("playing", () => {
  isBuffering = false;
});
audio.addEventListener("waiting", () => {
  isBuffering = true;
});
audio.addEventListener("error", () => {
  isBuffering = false;
  updatePlayingState(false);
});
audio.addEventListener("loadedmetadata", updateTimeline);
audio.addEventListener("timeupdate", updateTimeline);
window.addEventListener("resize", resizeCanvas);

buildHeart();
buildSpaceScene();
resizeCanvas();
requestAnimationFrame(draw);
