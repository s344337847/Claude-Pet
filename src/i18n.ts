import { invoke } from "@tauri-apps/api/core";

type Dict = Record<string, string>;

const en: Dict = {
  "app-title": "Claude Pet Settings",
  "section-general": "General",
  "autostart-label": "Launch on system startup",
  "section-display": "Display",
  "monitor-primary": "Primary Monitor",
  "monitor-hint": "Select which screen to display the pet on.",
  "section-size": "Window Size",
  "size-small": "Small",
  "size-medium": "Medium",
  "size-large": "Large",
  "section-performance": "Performance",
  "fps-15": "15 FPS",
  "fps-30": "30 FPS",
  "fps-60": "60 FPS",
  "fps-unlimited": "Unlimited",
  "performance-hint": "Lower FPS reduces CPU usage when the pet is visible.",
  "section-appearance": "Appearance",
  "color-primary": "Primary",
  "advanced-colors": "Advanced colors",
  "color-work": "Work",
  "color-success": "Success",
  "color-fail": "Fail",
  "color-sleep": "Sleep",
  "reset-colors": "Reset to Primary",
  "settings-hint": "Changes are saved automatically. Close this window when you are done.",
  "section-language": "Language",
  "lang-en": "English",
  "lang-zh": "中文",

  "pet-manager-title": "Pet Manager",
  "refresh": "Refresh",
  "no-pets": "No pets running.",
  "no-session": "No session",
  "no-directory": "No directory",
  "delete": "Delete",
  "create": "Create",
  "pet-label-placeholder": "Pet label",
  "style-random": "Random",
  "style-default-cat": "Default Cat",
  "style-dog": "Dog",
  "style-ayaka": "Ayaka",
  "style-ganyu": "Ganyu",
  "style-hint": "Choose the default pet style. New pets will use this style.",

  "about-desc": "A pixel-art desktop pet that lives on your screen and reports Claude Code task status in real time.",
  "about-info": "Info",
  "about-author": "Author",
  "about-license": "License",
  "about-tech": "Tech Stack",
  "about-copyright": "Made with love for Claude Code users.",
  "check-update": "Check for Updates",
  "update-checking": "Checking...",
  "update-available": "Update available: v{version}",
  "update-not-found": "You are on the latest version.",
  "update-error": "Failed to check for updates.",
  "update-download": "Download & Install",
  "update-downloading": "Downloading...",
  "update-restart": "Restart to apply update.",
  "update-release-notes": "Release Notes",
};

const zh: Dict = {
  "app-title": "Claude Pet 设置",
  "section-general": "通用",
  "autostart-label": "开机自动启动",
  "section-display": "显示",
  "monitor-primary": "主显示器",
  "monitor-hint": "选择在哪个屏幕上显示宠物。",
  "section-size": "窗口大小",
  "size-small": "小",
  "size-medium": "中",
  "size-large": "大",
  "section-performance": "性能",
  "fps-15": "15 FPS",
  "fps-30": "30 FPS",
  "fps-60": "60 FPS",
  "fps-unlimited": "无限制",
  "performance-hint": "较低的 FPS 可以减少宠物显示时的 CPU 占用。",
  "section-appearance": "外观",
  "color-primary": "主色",
  "advanced-colors": "高级颜色",
  "color-work": "工作中",
  "color-success": "成功",
  "color-fail": "失败",
  "color-sleep": "睡眠",
  "reset-colors": "重置为主色",
  "settings-hint": "更改会自动保存。完成后关闭此窗口即可。",
  "section-language": "语言",
  "lang-en": "English",
  "lang-zh": "中文",

  "pet-manager-title": "宠物管理",
  "refresh": "刷新",
  "no-pets": "暂无运行中的宠物。",
  "no-session": "无会话",
  "no-directory": "无目录",
  "delete": "删除",
  "create": "创建",
  "pet-label-placeholder": "宠物标签",
  "style-random": "随机",
  "style-default-cat": "默认猫咪",
  "style-dog": "狗狗",
  "style-ayaka": "绫华",
  "style-ganyu": "甘雨",
  "style-hint": "选择默认宠物样式。新创建的宠物将使用此样式。",

  "about-desc": "一款像素风桌面宠物，常驻屏幕角落，实时汇报 Claude Code 的任务状态。",
  "about-info": "信息",
  "about-author": "作者",
  "about-license": "许可证",
  "about-tech": "技术栈",
  "about-copyright": "专为 Claude Code 用户打造。",
  "check-update": "检查更新",
  "update-checking": "检查中...",
  "update-available": "发现新版本: v{version}",
  "update-not-found": "当前已是最新版本。",
  "update-error": "检查更新失败。",
  "update-download": "下载并安装",
  "update-downloading": "下载中...",
  "update-restart": "重启以应用更新。",
  "update-release-notes": "更新日志",
};

const dicts: Record<string, Dict> = { en, zh };

let currentLang = "zh";

export function getLanguage(): string {
  return currentLang;
}

export function setLanguage(lang: string, save = true) {
  if (!dicts[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  applyI18n();
  if (save) {
    invoke("set_language", { language: lang }).catch(console.error);
  }
}

export function t(key: string): string {
  return dicts[currentLang]?.[key] ?? dicts["en"]?.[key] ?? key;
}

export function applyI18n() {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const attr = el.dataset.i18nAttr || "textContent";
    if (!key) return;
    const value = t(key);
    if (attr === "textContent") {
      el.textContent = value;
    } else {
      el.setAttribute(attr, value);
    }
  });
}
