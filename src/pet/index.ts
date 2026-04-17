import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { Pet } from './Pet';
import { defaultStyle, STYLES } from './styles';
import type { PetState } from '../types';

const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const win = getCurrentWindow();
const label = win.label;

let scale = 4;

let winX = 0;
let winY = 0;
let screenW = 1920;
let screenH = 1080;
let scaleFactor = 1.0;
let walkDirection = 1; // 1 = right, -1 = left
let walkSpeed = 2;     // physical pixels per frame
let stateTimer = 0;
const MARGIN = 10;     // physical pixels
const BOTTOM_OFFSET = 50; // physical pixels, matches Rust
const SLIDE_SPEED = 10; // physical pixels per frame

let targetFps = 60;
let lastFrameTime = 0;

const pet = new Pet(defaultStyle, scale, ctx);

function applyScale(s: number) {
  scale = s;
  pet.setScale(s);
  const logicalSize = 32 * s;
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
  const cfg = await invoke<{ scale: number; fps_limit: number; colors: typeof defaultStyle.colors }>('get_config');
  applyScale(cfg.scale);
  targetFps = cfg.fps_limit || 60;
  pet.setColors(cfg.colors);
}

function updateWalk() {
  const state = pet.getCurrentState();
  if (state === 'work' || state === 'success' || state === 'fail') return;

  const physSize = logicalToPhysical(32 * scale);

  if (state === 'exit') {
    const targetY = screenH;
    if (winY < targetY) {
      winY += SLIDE_SPEED;
      if (winY > targetY) winY = targetY;
    }
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }

  if (state === 'enter') {
    const targetY = screenH - physSize - BOTTOM_OFFSET;
    if (winY < targetY) {
      winY += SLIDE_SPEED;
      if (winY > targetY) winY = targetY;
    } else if (winY > targetY) {
      winY -= SLIDE_SPEED;
      if (winY < targetY) winY = targetY;
    }
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    if (winY === targetY) {
      pet.setState('idle');
    }
    return;
  }

  if (state === 'idle') {
    // Pet's IdleAction handles idle->walk transition internally
    return;
  }

  if (state === 'walk') {
    winX += walkSpeed * walkDirection;
    if (winX <= MARGIN) {
      winX = MARGIN;
      walkDirection = 1;
    } else if (winX >= screenW - physSize - MARGIN) {
      winX = screenW - physSize - MARGIN;
      walkDirection = -1;
    }
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }
}

listen<{ label: string; state: PetState }>('pet_state_change', (event) => {
  if (event.payload.label === label) {
    if (event.payload.state === 'enter') {
      winY = screenH; // start just below visible area
    }
    pet.setState(event.payload.state);
  }
});

listen<{ label: string; style_name: string }>('pet_style_init', (event) => {
  if (event.payload.label === label) {
    const style = STYLES.find((s) => s.name === event.payload.style_name) || defaultStyle;
    pet.setStyle(style);
  }
});

listen<typeof defaultStyle.colors>('colors_change', (event) => {
  pet.setColors(event.payload);
});

listen<number>('fps_limit_change', (event) => {
  targetFps = event.payload || 60;
});

listen<number>('scale_change', async (event) => {
  const oldScale = scale;
  const newScale = event.payload;

  const monitor = await currentMonitor();
  if (monitor) {
    scaleFactor = monitor.scaleFactor;
  }

  const pos = await win.outerPosition();

  applyScale(newScale);

  const oldPhysSize = Math.round(32 * oldScale * scaleFactor);
  const newPhysSize = Math.round(32 * newScale * scaleFactor);

  winX = pos.x;
  winY = pos.y + oldPhysSize - newPhysSize;

  await win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
});

function tick(timestamp: number) {
  if (targetFps > 0) {
    const minFrameInterval = 1000 / targetFps;
    if (timestamp - lastFrameTime < minFrameInterval) {
      requestAnimationFrame(tick);
      return;
    }
    lastFrameTime = timestamp;
  }

  const state = pet.getCurrentState();

  if (state === 'success' || state === 'fail') {
    stateTimer++;
    if (stateTimer > 120) {
      stateTimer = 0;
      pet.setState('idle');
    }
  }

  updateWalk();
  pet.tick();
  requestAnimationFrame(tick);
}

Promise.all([initScreenSize(), initConfig()]).then(() => {
  requestAnimationFrame(tick);
});
