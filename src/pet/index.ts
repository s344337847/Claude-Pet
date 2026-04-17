import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { Pet } from './Pet';
import { defaultStyle } from './styles';
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
let returnVelocityX = 0;
let returnVelocityY = 0;
const RETURN_GRAVITY = 0.6;
const RETURN_JUMP_VELOCITY = -15;

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
  const cfg = await invoke<{ scale: number; colors: typeof defaultStyle.colors }>('get_config');
  applyScale(cfg.scale);
  pet.setColors(cfg.colors);
}

function updateWalk() {
  const state = pet.getCurrentState();
  if (state === 'work') return;

  const physSize = logicalToPhysical(32 * scale);

  if (state === 'success') {
    const targetX = Math.floor((screenW - physSize) / 2);
    const targetY = Math.floor((screenH - physSize) / 2) - 100;
    winX += (targetX - winX) * 0.1;
    winY += (targetY - winY) * 0.1;
    if (Math.abs(targetX - winX) < 1) winX = targetX;
    if (Math.abs(targetY - winY) < 1) winY = targetY;
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }

  if (state === 'returning') {
    winX += returnVelocityX;
    winY += returnVelocityY;
    returnVelocityY += RETURN_GRAVITY;

    const floorY = screenH - physSize - BOTTOM_OFFSET;

    if (winY >= floorY) {
      winY = floorY;
      if (returnVelocityY > 0 && Math.abs(returnVelocityY) > 2) {
        returnVelocityY = -returnVelocityY * 0.4;
        returnVelocityX *= 0.8;
      } else {
        winX = Math.round(winX);
        winY = Math.round(winY);
        pet.setState('idle');
        returnVelocityX = 0;
        returnVelocityY = 0;
      }
    }

    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
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
    pet.setState(event.payload.state);
  }
});

listen<typeof defaultStyle.colors>('colors_change', (event) => {
  pet.setColors(event.payload);
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

  if (pet.getCurrentState() === 'returning') {
    pet.setState('idle');
    returnVelocityX = 0;
    returnVelocityY = 0;
  }

  const oldPhysSize = Math.round(32 * oldScale * scaleFactor);
  const newPhysSize = Math.round(32 * newScale * scaleFactor);

  winX = pos.x;
  winY = pos.y + oldPhysSize - newPhysSize;

  await win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
});

function tick() {
  const state = pet.getCurrentState();

  if (state === 'success' || state === 'fail') {
    stateTimer++;
    if (stateTimer > 120) {
      stateTimer = 0;
      if (state === 'success') {
        const physSize = logicalToPhysical(32 * scale);
        const targetX = MARGIN + Math.random() * (screenW - physSize - MARGIN * 2);
        const distanceX = targetX - winX;
        const framesToTarget = 45 + Math.random() * 15;
        returnVelocityX = distanceX / framesToTarget;
        returnVelocityY = RETURN_JUMP_VELOCITY;
        pet.setState('returning');
      } else {
        pet.setState('idle');
        winY = screenH - logicalToPhysical(32 * scale) - BOTTOM_OFFSET;
      }
    }
  }

  updateWalk();
  pet.tick();
  requestAnimationFrame(tick);
}

Promise.all([initScreenSize(), initConfig()]).then(() => {
  requestAnimationFrame(tick);
});
