import { invoke } from "@tauri-apps/api/core";

interface Colors {
  primary: string;
  work: string;
  success: string;
  fail: string;
  sleep: string;
}

interface MonitorInfo {
  name: string;
  size: [number, number];
  position: [number, number];
  is_primary: boolean;
}

interface Config {
  scale: number;
  size_preset: string;
  fps_limit: number;
  colors: Colors;
  monitor: string | null;
}

let currentConfig: Config = {
  scale: 4,
  size_preset: "medium",
  fps_limit: 60,
  colors: {
    primary: "#6b8cff",
    work: "#ffaa44",
    success: "#6b8cff",
    fail: "#889999",
    sleep: "#6b8cff",
  },
  monitor: null,
};

const elScaleRange = document.getElementById("scale-range") as HTMLInputElement;
const elScaleValue = document.getElementById("scale-value") as HTMLDivElement;
const elSizeDisplay = document.getElementById("size-display") as HTMLSpanElement;
const btnSmall = document.getElementById("btn-small") as HTMLButtonElement;
const btnMedium = document.getElementById("btn-medium") as HTMLButtonElement;
const btnLarge = document.getElementById("btn-large") as HTMLButtonElement;
const colorPrimary = document.getElementById("color-primary") as HTMLInputElement;
const colorWork = document.getElementById("color-work") as HTMLInputElement;
const colorSuccess = document.getElementById("color-success") as HTMLInputElement;
const colorFail = document.getElementById("color-fail") as HTMLInputElement;
const colorSleep = document.getElementById("color-sleep") as HTMLInputElement;
const toggleAdvanced = document.getElementById("toggle-advanced") as HTMLButtonElement;
const advancedColors = document.getElementById("advanced-colors") as HTMLDivElement;
const btnResetColors = document.getElementById("btn-reset-colors") as HTMLButtonElement;
const btnFps15 = document.getElementById("btn-fps-15") as HTMLButtonElement;
const btnFps30 = document.getElementById("btn-fps-30") as HTMLButtonElement;
const btnFps60 = document.getElementById("btn-fps-60") as HTMLButtonElement;
const btnFps0 = document.getElementById("btn-fps-0") as HTMLButtonElement;

const hexPrimary = document.getElementById("hex-primary") as HTMLSpanElement;
const hexWork = document.getElementById("hex-work") as HTMLSpanElement;
const hexSuccess = document.getElementById("hex-success") as HTMLSpanElement;
const hexFail = document.getElementById("hex-fail") as HTMLSpanElement;
const hexSleep = document.getElementById("hex-sleep") as HTMLSpanElement;

function updateSizeUI() {
  const s = currentConfig.scale;
  elScaleRange.value = String(s);
  elScaleValue.textContent = `${s}x`;
  elSizeDisplay.textContent = `Current: ${32 * s} x ${32 * s}`;

  [btnSmall, btnMedium, btnLarge].forEach((b) => b.classList.remove("active"));
  if (s === 2) btnSmall.classList.add("active");
  else if (s === 4) btnMedium.classList.add("active");
  else if (s === 6) btnLarge.classList.add("active");
}

function updateFpsUI() {
  const fps = currentConfig.fps_limit;
  [btnFps15, btnFps30, btnFps60, btnFps0].forEach((b) => b.classList.remove("active"));
  if (fps === 15) btnFps15.classList.add("active");
  else if (fps === 30) btnFps30.classList.add("active");
  else if (fps === 60) btnFps60.classList.add("active");
  else if (fps === 0) btnFps0.classList.add("active");
}

function applyFps(fps: number) {
  currentConfig.fps_limit = fps;
  updateFpsUI();
  invoke("save_config", { config: currentConfig }).catch(console.error);
}

function applyScale(s: number) {
  currentConfig.scale = s;
  currentConfig.size_preset = s === 2 ? "small" : s === 4 ? "medium" : s === 6 ? "large" : "custom";
  updateSizeUI();
  invoke("save_config", { config: currentConfig }).catch(console.error);
}

btnSmall.addEventListener("click", () => applyScale(2));
btnMedium.addEventListener("click", () => applyScale(4));
btnLarge.addEventListener("click", () => applyScale(6));

btnFps15.addEventListener("click", () => applyFps(15));
btnFps30.addEventListener("click", () => applyFps(30));
btnFps60.addEventListener("click", () => applyFps(60));
btnFps0.addEventListener("click", () => applyFps(0));

elScaleRange.addEventListener("input", () => {
  applyScale(parseInt(elScaleRange.value, 10));
});

function setHexText(el: HTMLSpanElement, value: string) {
  el.textContent = value.toUpperCase();
}

function updateColorsUI() {
  colorPrimary.value = currentConfig.colors.primary;
  colorWork.value = currentConfig.colors.work;
  colorSuccess.value = currentConfig.colors.success;
  colorFail.value = currentConfig.colors.fail;
  colorSleep.value = currentConfig.colors.sleep;

  setHexText(hexPrimary, currentConfig.colors.primary);
  setHexText(hexWork, currentConfig.colors.work);
  setHexText(hexSuccess, currentConfig.colors.success);
  setHexText(hexFail, currentConfig.colors.fail);
  setHexText(hexSleep, currentConfig.colors.sleep);
}

function applyColors() {
  invoke("save_config", { config: currentConfig }).catch(console.error);
}

colorPrimary.addEventListener("input", () => {
  currentConfig.colors.primary = colorPrimary.value;
  setHexText(hexPrimary, colorPrimary.value);
  applyColors();
});

colorWork.addEventListener("input", () => {
  currentConfig.colors.work = colorWork.value;
  setHexText(hexWork, colorWork.value);
  applyColors();
});

colorSuccess.addEventListener("input", () => {
  currentConfig.colors.success = colorSuccess.value;
  setHexText(hexSuccess, colorSuccess.value);
  applyColors();
});

colorFail.addEventListener("input", () => {
  currentConfig.colors.fail = colorFail.value;
  setHexText(hexFail, colorFail.value);
  applyColors();
});

colorSleep.addEventListener("input", () => {
  currentConfig.colors.sleep = colorSleep.value;
  setHexText(hexSleep, colorSleep.value);
  applyColors();
});

toggleAdvanced.addEventListener("click", () => {
  const isOpen = advancedColors.classList.toggle("open");
  toggleAdvanced.classList.toggle("open", isOpen);
});

btnResetColors.addEventListener("click", () => {
  currentConfig.colors.work = currentConfig.colors.primary;
  currentConfig.colors.success = currentConfig.colors.primary;
  currentConfig.colors.fail = currentConfig.colors.primary;
  currentConfig.colors.sleep = currentConfig.colors.primary;
  updateColorsUI();
  applyColors();
});

const elMonitorSelect = document.getElementById("monitor-select") as HTMLSelectElement;

async function loadMonitors() {
  const monitors = await invoke<MonitorInfo[]>("get_available_monitors");
  elMonitorSelect.innerHTML = '<option value="">Primary Monitor</option>';
  for (const m of monitors) {
    const option = document.createElement("option");
    option.value = m.name;
    option.textContent = `${m.name} (${m.size[0]}x${m.size[1]})${m.is_primary ? " [Primary]" : ""}`;
    elMonitorSelect.appendChild(option);
  }
  elMonitorSelect.value = currentConfig.monitor || "";
}

elMonitorSelect.addEventListener("change", () => {
  const value = elMonitorSelect.value || null;
  currentConfig.monitor = value;
  invoke("set_monitor", { monitorName: value }).catch(console.error);
});

async function init() {
  const cfg = await invoke<Config>("get_config");
  currentConfig = cfg;
  updateSizeUI();
  updateFpsUI();
  updateColorsUI();
  await loadMonitors();
}

init().catch(console.error);
