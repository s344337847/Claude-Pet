import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

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

let currentConfig: Config = {
  scale: 4,
  size_preset: "medium",
  colors: {
    primary: "#6b8cff",
    work: "#ffaa44",
    success: "#6b8cff",
    fail: "#889999",
    sleep: "#6b8cff",
  },
};

const win = getCurrentWindow();

const elScaleRange = document.getElementById("scale-range") as HTMLInputElement;
const elScaleValue = document.getElementById("scale-value") as HTMLSpanElement;
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
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const btnCancel = document.getElementById("btn-cancel") as HTMLButtonElement;

function updateSizeUI() {
  const s = currentConfig.scale;
  elScaleRange.value = String(s);
  elScaleValue.textContent = `${s}×`;
  elSizeDisplay.textContent = `Current: ${32 * s}×${32 * s}`;

  [btnSmall, btnMedium, btnLarge].forEach((b) => b.classList.remove("active"));
  if (s === 2) btnSmall.classList.add("active");
  else if (s === 4) btnMedium.classList.add("active");
  else if (s === 6) btnLarge.classList.add("active");
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

elScaleRange.addEventListener("input", () => {
  applyScale(parseInt(elScaleRange.value, 10));
});

function updateColorsUI() {
  colorPrimary.value = currentConfig.colors.primary;
  colorWork.value = currentConfig.colors.work;
  colorSuccess.value = currentConfig.colors.success;
  colorFail.value = currentConfig.colors.fail;
  colorSleep.value = currentConfig.colors.sleep;
}

function applyColors() {
  invoke("save_config", { config: currentConfig }).catch(console.error);
}

colorPrimary.addEventListener("input", () => {
  currentConfig.colors.primary = colorPrimary.value;
  applyColors();
});

colorWork.addEventListener("input", () => {
  currentConfig.colors.work = colorWork.value;
  applyColors();
});
colorSuccess.addEventListener("input", () => {
  currentConfig.colors.success = colorSuccess.value;
  applyColors();
});
colorFail.addEventListener("input", () => {
  currentConfig.colors.fail = colorFail.value;
  applyColors();
});
colorSleep.addEventListener("input", () => {
  currentConfig.colors.sleep = colorSleep.value;
  applyColors();
});

toggleAdvanced.addEventListener("click", () => {
  advancedColors.classList.toggle("hidden");
  toggleAdvanced.textContent = advancedColors.classList.contains("hidden") ? "Advanced ▼" : "Advanced ▲";
});

btnResetColors.addEventListener("click", () => {
  currentConfig.colors.work = currentConfig.colors.primary;
  currentConfig.colors.success = currentConfig.colors.primary;
  currentConfig.colors.fail = currentConfig.colors.primary;
  currentConfig.colors.sleep = currentConfig.colors.primary;
  updateColorsUI();
  applyColors();
});

btnSave.addEventListener("click", () => {
  invoke("save_config", { config: currentConfig }).then(() => win.close()).catch(console.error);
});

btnCancel.addEventListener("click", () => {
  win.close();
});

async function init() {
  const cfg = await invoke<Config>("get_config");
  currentConfig = cfg;
  updateSizeUI();
  updateColorsUI();
}

init().catch(console.error);
