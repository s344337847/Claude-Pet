import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, PhysicalPosition, currentMonitor } from "@tauri-apps/api/window";

type PetState = "idle" | "walk" | "work" | "success" | "fail" | "sleep" | "returning";

interface Colors {
  primary: string;
  work: string;
  success: string;
  fail: string;
  sleep: string;
}

interface Config {
  scale: number;
  size_preset: string;
  colors: Colors;
}

interface StatePayload {
  state: PetState;
  task_count: number;
  in_progress_count: number;
}

const canvas = document.getElementById("pet-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let scale = 4;

let colors = {
  primary: "#6b8cff",
  work: "#ffaa44",
  success: "#6b8cff",
  fail: "#889999",
  sleep: "#6b8cff",
};

let currentState: PetState = "idle";
let stateTimer = 0;
let frame = 0;

// Window movement state (all in PHYSICAL pixels to match Rust backend)
const win = getCurrentWindow();
let winX = 0;
let winY = 0;
let screenW = 1920;
let screenH = 1080;
let scaleFactor = 1.0;
let walkDirection = 1; // 1 = right, -1 = left
let walkSpeed = 2;     // physical pixels per frame
let idleTimer = 0;
const MARGIN = 10;     // physical pixels
const BOTTOM_OFFSET = 50; // physical pixels, matches Rust
let returnVelocityX = 0;
let returnVelocityY = 0;
const RETURN_GRAVITY = 0.6;
const RETURN_JUMP_VELOCITY = -15;

function applyScale(s: number) {
  scale = s;
  const logicalSize = 32 * s;
  canvas.width = logicalSize;
  canvas.height = logicalSize;
  canvas.style.width = `${logicalSize}px`;
  canvas.style.height = `${logicalSize}px`;
  document.body.style.width = `${logicalSize}px`;
  document.body.style.height = `${logicalSize}px`;
  document.documentElement.style.width = `${logicalSize}px`;
  document.documentElement.style.height = `${logicalSize}px`;
}

function logicalToPhysical(v: number): number {
  return Math.round(v * scaleFactor);
}

async function initScreenSize() {
  const monitor = await currentMonitor();
  if (monitor) {
    scaleFactor = monitor.scaleFactor;
    screenW = monitor.size.width;
    screenH = monitor.size.height;
    const pos = await win.outerPosition();
    winX = pos.x;
    winY = pos.y;
  }
}

async function initConfig() {
  const cfg = await invoke<Config>("get_config");
  applyScale(cfg.scale);
  colors = cfg.colors;
}

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function pixel(x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, scale, scale);
}

function rect(x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
}

// --- Draw helpers for pet body ---
function drawBody(offsetY: number, color: string) {
  // Head
  rect(10, 6 + offsetY, 12, 10, color);
  // Ears
  pixel(10, 4 + offsetY, color);
  pixel(11, 4 + offsetY, color);
  pixel(20, 4 + offsetY, color);
  pixel(21, 4 + offsetY, color);
  // Body
  rect(11, 16 + offsetY, 10, 10, color);
  // Tail
  pixel(22, 18 + offsetY, color);
  pixel(23, 17 + offsetY, color);
}

function drawFace(offsetY: number, eyeOpen: boolean, mouth: "smile" | "neutral" | "frown") {
  // Eyes
  const eyeColor = eyeOpen ? "#111" : "#88a";
  if (eyeOpen) {
    pixel(12, 10 + offsetY, eyeColor);
    pixel(13, 10 + offsetY, eyeColor);
    pixel(18, 10 + offsetY, eyeColor);
    pixel(19, 10 + offsetY, eyeColor);
  } else {
    pixel(12, 11 + offsetY, eyeColor);
    pixel(13, 11 + offsetY, eyeColor);
    pixel(18, 11 + offsetY, eyeColor);
    pixel(19, 11 + offsetY, eyeColor);
  }
  // Mouth
  const mouthColor = "#334";
  if (mouth === "smile") {
    pixel(14, 13 + offsetY, mouthColor);
    pixel(15, 13 + offsetY, mouthColor);
    pixel(16, 13 + offsetY, mouthColor);
    pixel(17, 13 + offsetY, mouthColor);
    pixel(13, 12 + offsetY, mouthColor);
    pixel(18, 12 + offsetY, mouthColor);
  } else if (mouth === "frown") {
    pixel(14, 12 + offsetY, mouthColor);
    pixel(15, 12 + offsetY, mouthColor);
    pixel(16, 12 + offsetY, mouthColor);
    pixel(17, 12 + offsetY, mouthColor);
    pixel(13, 13 + offsetY, mouthColor);
    pixel(18, 13 + offsetY, mouthColor);
  } else {
    pixel(14, 13 + offsetY, mouthColor);
    pixel(15, 13 + offsetY, mouthColor);
    pixel(16, 13 + offsetY, mouthColor);
    pixel(17, 13 + offsetY, mouthColor);
  }
}

function drawLegs(offsetY: number, color: string, frameNum: number) {
  const leg1 = (frameNum % 20) < 10 ? 0 : 1;
  const leg2 = (frameNum % 20) < 10 ? 1 : 0;
  // Left legs
  pixel(11, 26 + offsetY + leg1, color);
  pixel(12, 26 + offsetY + leg1, color);
  // Right legs
  pixel(19, 26 + offsetY + leg2, color);
  pixel(20, 26 + offsetY + leg2, color);
}

// --- Animation renderers ---
function renderIdle() {
  const blink = Math.random() < 0.02;
  const offsetY = Math.sin(frame * 0.05) * 0.5;
  drawBody(offsetY, colors.primary);
  drawFace(offsetY, !blink, "neutral");
  drawLegs(offsetY, colors.primary, 0);
}

function renderWalk() {
  const bounce = Math.abs(Math.sin(frame * 0.2)) * 1.5;
  drawBody(bounce, colors.primary);
  drawFace(bounce, true, "neutral");
  drawLegs(bounce, colors.primary, frame);
}

function renderWork() {
  const typeOffset = (frame % 10) < 5 ? 0 : 1;
  drawBody(0, colors.work);
  drawFace(0, true, "neutral");
  drawLegs(0, colors.work, 0);
  // typing hands / keyboard
  rect(8 + typeOffset, 22, 4, 2, "#334");
  rect(20 - typeOffset, 22, 4, 2, "#334");
  // thought bubble
  rect(24, 4, 6, 4, "#fff");
  pixel(25, 3, "#fff");
  pixel(26, 2, "#fff");
  // code symbol inside bubble
  rect(26, 5, 2, 2, "#0f0");
}

function renderSuccess() {
  const jump = Math.abs(Math.sin(frame * 0.3)) * 4;
  drawBody(-jump, colors.success);
  drawFace(-jump, true, "smile");
  drawLegs(-jump, colors.success, 0);
  // confetti particles
  const confettiColors = ["#f44", "#4f4", "#44f", "#ff4"];
  for (let i = 0; i < 8; i++) {
    const px = (frame * 3 + i * 17) % 32;
    const py = ((frame * 2 + i * 11) % 20) + 8;
    pixel(px, py, confettiColors[i % confettiColors.length]);
  }
}

function renderFail() {
  drawBody(2, colors.fail);
  drawFace(2, false, "frown");
  drawLegs(2, colors.fail, 0);
  // sweat drop
  pixel(22, 6, "#4af");
  pixel(22, 7, "#4af");
}

function renderSleep() {
  const offsetY = Math.sin(frame * 0.03) * 0.5;
  drawBody(offsetY, colors.sleep);
  drawFace(offsetY, false, "neutral");
  drawLegs(offsetY, colors.sleep, 0);
  // Zzz
  const zOffset = (frame % 60) / 10;
  pixel(24, 4 - zOffset, "#fff");
  pixel(26, 2 - zOffset, "#fff");
}

function render() {
  clear();
  switch (currentState) {
    case "idle":
      renderIdle();
      break;
    case "walk":
      renderWalk();
      break;
    case "work":
      renderWork();
      break;
    case "success":
      renderSuccess();
      break;
    case "fail":
      renderFail();
      break;
    case "sleep":
      renderSleep();
      break;
  }
}

// --- Window movement logic ---
function updateWalk() {
  if (currentState === "work") return;

  const physSize = logicalToPhysical(32 * scale);

  if (currentState === "success") {
    // Jump to center
    const targetX = Math.floor((screenW - physSize) / 2);
    const targetY = Math.floor((screenH - physSize) / 2) - 100;
    winX += (targetX - winX) * 0.1;
    winY += (targetY - winY) * 0.1;
    win.setPosition(new PhysicalPosition(winX, winY));
    return;
  }

  if (currentState === "returning") {
    winX += returnVelocityX;
    winY += returnVelocityY;
    returnVelocityY += RETURN_GRAVITY;

    const floorY = screenH - physSize - BOTTOM_OFFSET;

    if (winY >= floorY) {
      winY = floorY;
      if (returnVelocityY > 0 && Math.abs(returnVelocityY) > 2) {
        // Small bounce
        returnVelocityY = -returnVelocityY * 0.4;
        returnVelocityX *= 0.8;
      } else {
        // Landed, snap to idle
        winX = Math.round(winX);
        winY = Math.round(winY);
        currentState = "idle";
        idleTimer = 0;
        returnVelocityX = 0;
        returnVelocityY = 0;
      }
    }

    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }

  if (currentState === "idle") {
    idleTimer++;
    if (idleTimer > 180) {
      // Resume walking after ~3 seconds
      idleTimer = 0;
      currentState = "walk";
    }
    return;
  }

  if (currentState === "walk") {
    winX += walkSpeed * walkDirection;
    if (winX <= MARGIN) {
      winX = MARGIN;
      walkDirection = 1;
    } else if (winX >= screenW - physSize - MARGIN) {
      winX = screenW - physSize - MARGIN;
      walkDirection = -1;
    }
    win.setPosition(new PhysicalPosition(winX, winY));

    // Randomly stop to idle
    if (Math.random() < 0.005) {
      currentState = "idle";
      idleTimer = 0;
    }
    return;
  }
}

// --- State transitions ---
function transitionTo(newState: PetState) {
  if (newState === currentState) return;

  if (newState === "success") {
    stateTimer = 0;
    currentState = "success";
    return;
  }

  if (newState === "fail") {
    stateTimer = 0;
    currentState = "fail";
    return;
  }

  if (newState === "work") {
    currentState = "work";
    return;
  }

  if (newState === "idle" || newState === "sleep") {
    currentState = "idle";
    idleTimer = 0;
    return;
  }

  if (newState === "returning") {
    currentState = "returning";
    return;
  }
}

// --- Event listeners ---
listen<StatePayload>("pet_state_change", (event) => {
  const payload = event.payload;
  transitionTo(payload.state);
});

listen<Colors>("colors_change", (event) => {
  colors = event.payload;
});

listen<number>("scale_change", async (event) => {
  const oldScale = scale;
  const newScale = event.payload;

  const monitor = await currentMonitor();
  if (monitor) {
    scaleFactor = monitor.scaleFactor;
  }

  const pos = await win.outerPosition();

  applyScale(newScale);

  // Interrupt returning animation if scale changes to avoid physics mismatch
  if (currentState === "returning") {
    currentState = "idle";
    idleTimer = 0;
    returnVelocityX = 0;
    returnVelocityY = 0;
  }

  const oldPhysSize = Math.round(32 * oldScale * scaleFactor);
  const newPhysSize = Math.round(32 * newScale * scaleFactor);

  winX = pos.x;
  winY = pos.y + oldPhysSize - newPhysSize;

  await win.setPosition(new PhysicalPosition(winX, winY));
});

// --- Main loop ---
function tick() {
  frame++;

  if (currentState === "success" || currentState === "fail") {
    stateTimer++;
    if (stateTimer > 120) {
      stateTimer = 0;
      if (currentState === "success") {
        // Start parabolic jump back
        const physSize = logicalToPhysical(32 * scale);
        const targetX = MARGIN + Math.random() * (screenW - physSize - MARGIN * 2);
        const distanceX = targetX - winX;
        const framesToTarget = 45 + Math.random() * 15; // 45~60 frames
        returnVelocityX = distanceX / framesToTarget;
        returnVelocityY = RETURN_JUMP_VELOCITY;
        currentState = "returning";
      } else {
        // fail still snaps back instantly for now
        currentState = "idle";
        idleTimer = 0;
        winY = screenH - logicalToPhysical(32 * scale) - BOTTOM_OFFSET;
      }
    }
  }

  updateWalk();
  render();
  requestAnimationFrame(tick);
}

Promise.all([initScreenSize(), initConfig()]).then(() => {
  requestAnimationFrame(tick);
});
