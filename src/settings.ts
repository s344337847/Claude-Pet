import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { setLanguage, t } from "./i18n";

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
  language: string;
  style_name: string;
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
  language: "en",
  style_name: "",
};

/* ── Tab switching ── */

function switchTab(tab: string) {
  document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  document.querySelectorAll<HTMLDivElement>(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
}

document.querySelectorAll<HTMLButtonElement>(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab!);
  });
});

listen("switch_tab", (event) => {
  switchTab(event.payload as string);
}).catch(console.error);

/* ── Pets (merged from pets.ts) ── */

interface PetInstance {
  label: string;
  session_id: string | null;
  cwd: string | null;
  style_name: string;
}

const listEl = document.getElementById("pet-list") as HTMLDivElement;
const refreshBtn = document.getElementById("btn-refresh") as HTMLButtonElement;

async function loadPets() {
  const pets = await invoke<PetInstance[]>("list_pets");
  renderPets(pets);
}

function renderPets(pets: PetInstance[]) {
  listEl.innerHTML = "";

  if (pets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.dataset.i18n = "no-pets";
    empty.textContent = t("no-pets");
    listEl.appendChild(empty);
    return;
  }

  for (const p of pets) {
    const row = document.createElement("div");
    row.className = "pet-row";

    const info = document.createElement("div");
    info.className = "pet-info";

    const styleSpan = document.createElement("span");
    styleSpan.className = "pet-style";
    styleSpan.textContent = p.style_name;

    const labelSpan = document.createElement("span");
    labelSpan.className = "pet-label";
    labelSpan.textContent = p.label;

    const sessionSpan = document.createElement("span");
    sessionSpan.className = "pet-session";
    sessionSpan.textContent = p.session_id || t("no-session");

    const cwdSpan = document.createElement("span");
    cwdSpan.className = "pet-cwd";
    cwdSpan.textContent = p.cwd || t("no-directory");

    info.appendChild(styleSpan);
    info.appendChild(labelSpan);
    info.appendChild(sessionSpan);
    info.appendChild(cwdSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = t("delete");
    deleteBtn.addEventListener("click", async () => {
      await invoke("destroy_pet", { label: p.label });
      await loadPets();
    });

    row.appendChild(info);
    row.appendChild(deleteBtn);
    listEl.appendChild(row);
  }
}

refreshBtn.addEventListener("click", loadPets);

/* ── Settings ── */

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
const elStyleSelect = document.getElementById("style-select") as HTMLSelectElement;
const toggleAutostart = document.getElementById("toggle-autostart") as HTMLInputElement;
const btnLangEn = document.getElementById("btn-lang-en") as HTMLButtonElement;
const btnLangZh = document.getElementById("btn-lang-zh") as HTMLButtonElement;

function updateLanguageUI() {
  const lang = currentConfig.language;
  [btnLangEn, btnLangZh].forEach((b) => b.classList.remove("active"));
  if (lang === "en") btnLangEn.classList.add("active");
  else if (lang === "zh") btnLangZh.classList.add("active");
}

async function loadMonitors() {
  const monitors = await invoke<MonitorInfo[]>("get_available_monitors");
  elMonitorSelect.innerHTML = `<option value="">${t("monitor-primary")}</option>`;
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

async function loadStyles() {
  const styles = await invoke<string[]>("list_styles");
  while (elStyleSelect.options.length > 1) {
    elStyleSelect.remove(1);
  }
  for (const style of styles) {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = t(`style-${style}`) || style;
    elStyleSelect.appendChild(option);
  }
  elStyleSelect.value = currentConfig.style_name || "";
}

elStyleSelect.addEventListener("change", () => {
  const value = elStyleSelect.value || "";
  currentConfig.style_name = value;
  invoke("save_config", { config: currentConfig }).catch(console.error);
});

async function init() {
  const cfg = await invoke<Config>("get_config");
  currentConfig = cfg;
  updateSizeUI();
  updateFpsUI();
  updateColorsUI();
  updateLanguageUI();
  await loadMonitors();
  await loadStyles();

  setLanguage(currentConfig.language || "en", false);
  document.title = t("app-title");

  try {
    toggleAutostart.checked = await isEnabled();
  } catch {
    // ignore if plugin unavailable
  }

  // Load version
  try {
    const version = await getVersion();
    const versionEl = document.getElementById("about-version") as HTMLDivElement;
    if (versionEl) versionEl.textContent = `v${version}`;
  } catch {
    // ignore
  }

  // Load pets list in background
  loadPets().catch(console.error);
}

toggleAutostart.addEventListener("change", async () => {
  try {
    if (toggleAutostart.checked) {
      await enable();
    } else {
      await disable();
    }
  } catch (err) {
    console.error("Failed to change autostart setting:", err);
    toggleAutostart.checked = await isEnabled().catch(() => false);
  }
});

function applyLanguage(lang: string) {
  currentConfig.language = lang;
  updateLanguageUI();
  setLanguage(lang, true);
  document.title = t("app-title");
}

btnLangEn.addEventListener("click", () => applyLanguage("en"));
btnLangZh.addEventListener("click", () => applyLanguage("zh"));

/* ── Updater ── */

const btnCheckUpdate = document.getElementById("btn-check-update") as HTMLButtonElement;
const updateStatus = document.getElementById("update-status") as HTMLDivElement;
const updateDetails = document.getElementById("update-details") as HTMLDivElement;
const updateVersion = document.getElementById("update-version") as HTMLDivElement;
const updateNotes = document.getElementById("update-notes") as HTMLDivElement;
const btnInstallUpdate = document.getElementById("btn-install-update") as HTMLButtonElement;
const updateProgress = document.getElementById("update-progress") as HTMLDivElement;
const progressFill = document.getElementById("progress-fill") as HTMLDivElement;
const progressText = document.getElementById("progress-text") as HTMLDivElement;

let totalDownloaded = 0;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

async function doCheckUpdate() {
  btnCheckUpdate.disabled = true;
  updateStatus.textContent = t("update-checking");
  updateDetails.style.display = "none";
  updateProgress.style.display = "none";

  try {
    const result = await invoke<{
      version: string;
      date: string | null;
      body: string | null;
    } | null>("check_update");

    if (result) {
      updateStatus.textContent = t("update-available").replace("{version}", result.version);
      updateVersion.textContent = `v${result.version}`;
      updateNotes.textContent = result.body || "";
      updateDetails.style.display = "block";
    } else {
      updateStatus.textContent = t("update-not-found");
    }
  } catch (err) {
    console.error("Check update failed:", err);
    updateStatus.textContent = t("update-error");
  } finally {
    btnCheckUpdate.disabled = false;
  }
}

async function doInstallUpdate() {
  btnInstallUpdate.disabled = true;
  btnCheckUpdate.disabled = true;
  updateStatus.textContent = t("update-downloading");
  updateProgress.style.display = "block";
  totalDownloaded = 0;

  try {
    await invoke("install_update");
    updateStatus.textContent = t("update-restart");
    updateProgress.style.display = "none";
  } catch (err) {
    console.error("Install update failed:", err);
    updateStatus.textContent = t("update-error");
    btnInstallUpdate.disabled = false;
    btnCheckUpdate.disabled = false;
  }
}

btnCheckUpdate.addEventListener("click", doCheckUpdate);
btnInstallUpdate.addEventListener("click", doInstallUpdate);

listen("update_progress", (event) => {
  const payload = event.payload as { chunk: number; total: number | null };
  totalDownloaded += payload.chunk;
  if (payload.total && payload.total > 0) {
    const pct = Math.min(100, Math.round((totalDownloaded / payload.total) * 100));
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${formatBytes(totalDownloaded)} / ${formatBytes(payload.total)}`;
  } else {
    progressFill.style.width = "100%";
    progressText.textContent = formatBytes(totalDownloaded);
  }
}).catch(console.error);

listen("update_done", () => {
  progressFill.style.width = "100%";
  progressText.textContent = "";
}).catch(console.error);

init().catch(console.error);
