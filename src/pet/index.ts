import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
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
let walkDirection = defaultStyle.initialFacing ?? 1; // 1 = right, -1 = left
let walkSpeed = 2;     // physical pixels per frame
let stateTimer = 0;
const MARGIN = 10;     // physical pixels
const BOTTOM_OFFSET = 50; // physical pixels, matches Rust
const SLIDE_SPEED = 10; // physical pixels per frame
const TOOLTIP_EXTRA_LOGICAL = 50;

let targetFps = 60;
let tooltipExpanded = false;
let lastFrameTime = 0;

const pet = new Pet(defaultStyle, scale, ctx);
pet.setFacing(walkDirection);

function applyScale(s: number) {
  scale = s;
  pet.setScale(s);
  const displaySize = pet.getDisplaySize();
  const height = tooltipExpanded ? displaySize + TOOLTIP_EXTRA_LOGICAL : displaySize;
  canvas.style.width = `${displaySize}px`;
  canvas.style.height = `${displaySize}px`;
  document.body.style.width = `${displaySize}px`;
  document.body.style.height = `${height}px`;
  document.documentElement.style.width = `${displaySize}px`;
  document.documentElement.style.height = `${height}px`;
  const wrapper = document.getElementById('pet-wrapper') as HTMLElement | null;
  if (wrapper) {
    wrapper.style.width = `${displaySize}px`;
    wrapper.style.height = `${displaySize}px`;
  }
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

  const physSize = logicalToPhysical(pet.getDisplaySize());

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
      pet.setFacing(walkDirection);
    } else if (winX >= screenW - physSize - MARGIN) {
      winX = screenW - physSize - MARGIN;
      walkDirection = -1;
      pet.setFacing(walkDirection);
    }
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }
}

const tooltipEl = document.getElementById('pet-tooltip') as HTMLDivElement;
let typewriterTimer: ReturnType<typeof setTimeout> | null = null;
let successDelayTimer: ReturnType<typeof setTimeout> | null = null;

const THINKING_EMOJIS = [
  '(｡•́︿•̀｡)', '(•́ ⍨ •̀)', '(⊙_⊙)', '(｡ŏ_ŏ)', '(￣_￣)',
  '(・へ・)', '(｡･ω･｡)?', '(⊙.⊙)', '(o_O)', '(・_・ヾ)',
  '(°o°;)', '(;°o°)', '(⊙_⊙;)', '(・・ )?', '(￣?￣)',
];

const HAPPY_EMOJIS = [
  '(｡♥‿♥｡)', '(◕‿◕)', '(✿◠‿◠)', '٩(◕‿◕｡)۶', '(ﾉ◕ヮ◕)ﾉ',
  'ヽ(✿ﾟ▽ﾟ)ノ', 'o(≧▽≦)o', '(*^▽^*)', '٩(｡•́‿•̀｡)۶', '♪(´▽｀)',
  '（＾ｖ＾）', '(✯◡✯)', '＼(＾O＾)／', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '(｡◕‿◕｡)',
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function expandWindowForTooltip() {
  if (tooltipExpanded) return;
  tooltipExpanded = true;
  const displaySize = pet.getDisplaySize();
  const newHeight = displaySize + TOOLTIP_EXTRA_LOGICAL;
  await win.setSize(new LogicalSize(displaySize, newHeight));
  document.body.style.height = `${newHeight}px`;
  document.documentElement.style.height = `${newHeight}px`;
  winY -= Math.round(TOOLTIP_EXTRA_LOGICAL * scaleFactor);
  await win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
}

async function clearTooltip() {
  if (typewriterTimer) {
    clearTimeout(typewriterTimer);
    typewriterTimer = null;
  }
  if (successDelayTimer) {
    clearTimeout(successDelayTimer);
    successDelayTimer = null;
  }
  tooltipEl.textContent = '';
  tooltipEl.classList.remove('typing-done', 'scrolling');
  tooltipEl.removeAttribute('data-state');
  tooltipEl.style.removeProperty('--scroll-offset');
  tooltipEl.style.removeProperty('--scroll-duration');
  // tooltip 一直显示，不恢复窗口大小
}

async function showTypewriter(text: string, _state: 'success' | 'fail' | 'work' = 'success') {
  await clearTooltip();
  await expandWindowForTooltip();
  tooltipEl.classList.add('visible');
  let index = 0;
  tooltipEl.classList.remove('typing-done');

  const scrollInner = document.createElement('span');
  scrollInner.className = 'scroll-inner';
  tooltipEl.appendChild(scrollInner);

  const cursorEl = document.createElement('span');
  cursorEl.className = 'cursor';

  function typeNext() {
    if (index <= text.length) {
      scrollInner.textContent = text.slice(0, index);
      scrollInner.appendChild(cursorEl);
      index++;
      typewriterTimer = setTimeout(typeNext, 40);
    } else {
      tooltipEl.classList.add('typing-done');
      // Check overflow and enable scrolling if needed
      const style = getComputedStyle(tooltipEl);
      const padLeft = parseFloat(style.paddingLeft);
      const padRight = parseFloat(style.paddingRight);
      const availableWidth = tooltipEl.clientWidth - padLeft - padRight;
      const overflow = scrollInner.scrollWidth - availableWidth;
      if (overflow > 0) {
        tooltipEl.style.setProperty('--scroll-offset', `${-overflow}px`);
        const duration = Math.max(4, 4 + overflow / 20);
        tooltipEl.style.setProperty('--scroll-duration', `${duration}s`);
        tooltipEl.classList.add('scrolling');
      }
      typewriterTimer = null;
    }
  }
  typeNext();
}

listen<{ label: string; state: PetState; cwd?: string }>('pet_state_change', (event) => {
  if (event.payload.label === label) {
    const newState = event.payload.state;
    if (newState === 'enter') {
      winY = screenH; // start just below visible area
    }
    if (newState === 'success' && event.payload.cwd) {
      showTypewriter(randomPick(HAPPY_EMOJIS));
      successDelayTimer = setTimeout(() => {
        showTypewriter(event.payload.cwd!);
      }, 1800);
    } else if (newState === 'work') {
      showTypewriter(randomPick(THINKING_EMOJIS));
    }
    pet.setState(newState);
  }
});

listen<{ label: string; style_name: string }>('pet_style_init', (event) => {
  if (event.payload.label === label) {
    const style = STYLES.find((s) => s.name === event.payload.style_name) || defaultStyle;
    pet.setStyle(style);
    walkDirection = style.initialFacing ?? 1;
    pet.setFacing(walkDirection);
  }
});

listen<typeof defaultStyle.colors>('colors_change', (event) => {
  pet.setColors(event.payload);
});

listen<number>('fps_limit_change', (event) => {
  targetFps = event.payload || 60;
});

listen<number>('scale_change', async (event) => {
  const newScale = event.payload;

  const monitor = await currentMonitor();
  if (monitor) {
    scaleFactor = monitor.scaleFactor;
  }

  const pos = await win.outerPosition();

  const oldDisplaySize = pet.getDisplaySize();
  applyScale(newScale);
  const newDisplaySize = pet.getDisplaySize();

  const oldPhysSize = Math.round(oldDisplaySize * scaleFactor);
  const newPhysSize = Math.round(newDisplaySize * scaleFactor);

  winX = pos.x;
  winY = pos.y + oldPhysSize - newPhysSize;

  await win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));

  if (tooltipExpanded) {
    // expandWindowForTooltip 会再次减去 tooltip 高度，
    // 所以先加回来，避免重复偏移
    winY += Math.round(TOOLTIP_EXTRA_LOGICAL * scaleFactor);
    tooltipExpanded = false;
    await expandWindowForTooltip();
  }
});

listen<{ screenW: number; screenH: number; scaleFactor: number }>('monitor_changed', async (event) => {
  screenW = event.payload.screenW;
  screenH = event.payload.screenH;
  scaleFactor = event.payload.scaleFactor;
  const pos = await win.outerPosition();
  winX = pos.x;
  winY = pos.y;
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
      // 保留提示信息直至进入work状态
      // clearTooltip();
      pet.setState('idle');
    }
  }

  updateWalk();
  pet.tick();
  requestAnimationFrame(tick);
}

Promise.all([initScreenSize(), initConfig()]).then(async () => {
  try {
    const pets = await invoke<Array<{ label: string; style_name?: string }>>('list_pets');
    const myPet = pets.find((p) => p.label === label);
    if (myPet?.style_name) {
      const style = STYLES.find((s) => s.name === myPet.style_name) || defaultStyle;
      pet.setStyle(style);
      walkDirection = style.initialFacing ?? 1;
      pet.setFacing(walkDirection);
    }
  } catch {
    // ignore
  }
  // tooltip 默认一直显示
  await expandWindowForTooltip();
  tooltipEl.classList.add('visible');
  requestAnimationFrame(tick);
});
