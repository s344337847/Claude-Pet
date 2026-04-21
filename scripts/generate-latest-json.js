#!/usr/bin/env node
/**
 * 生成 Tauri Updater 的 latest.json
 * 用法: node generate-latest-json.js <版本号> [构建输出目录] [github仓库]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const BUNDLE_DIR = path.join(PROJECT_ROOT, "src-tauri", "target", "release", "bundle");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function findFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function getGitLog(version) {
  try {
    const { execSync } = await import("child_process");
    const prevTag = execSync("git describe --tags --abbrev=0 HEAD~1", { encoding: "utf-8", cwd: PROJECT_ROOT }).trim();
    const log = execSync(`git log ${prevTag}..HEAD --pretty=format:"- %s"`, { encoding: "utf-8", cwd: PROJECT_ROOT }).trim();
    return log || "Bug fixes and improvements.";
  } catch {
    return "Bug fixes and improvements.";
  }
}

async function main() {
  const version = process.argv[2];
  const outputDir = process.argv[3] || path.join(PROJECT_ROOT, "release");
  const repo = process.argv[4] || "s344337847/Claude-Pet";

  if (!version) {
    const tauriConf = readJson(path.join(PROJECT_ROOT, "src-tauri", "tauri.conf.json"));
    version = tauriConf?.version;
    if (!version) {
      console.error("错误: 无法从 tauri.conf.json 读取版本号，请手动指定");
      process.exit(1);
    }
  }

  const tag = `v${version}`;
  const releaseUrl = `https://github.com/${repo}/releases/download/${tag}`;
  const pubDate = new Date().toISOString();

  const platforms = {};

  // NSIS .exe + .sig
  const nsisDir = path.join(BUNDLE_DIR, "nsis");
  const nsisExes = findFiles(nsisDir, ".exe").filter((f) => !f.endsWith(".exe.sig"));
  for (const exePath of nsisExes) {
    const sigPath = exePath + ".sig";
    if (fs.existsSync(sigPath)) {
      const signature = fs.readFileSync(sigPath, "utf-8").trim();
      const fileName = path.basename(exePath);
      platforms["windows-x86_64"] = {
        signature,
        url: `${releaseUrl}/${fileName}`,
      };
      console.log(`[OK] windows-x86_64: ${fileName}`);
    }
  }

  // MSI + .sig (备用)
  const msiDir = path.join(BUNDLE_DIR, "msi");
  const msiFiles = findFiles(msiDir, ".msi");
  for (const msiPath of msiFiles) {
    const sigPath = msiPath + ".sig";
    if (fs.existsSync(sigPath) && !platforms["windows-x86_64"]) {
      const signature = fs.readFileSync(sigPath, "utf-8").trim();
      const fileName = path.basename(msiPath);
      platforms["windows-x86_64"] = {
        signature,
        url: `${releaseUrl}/${fileName}`,
      };
      console.log(`[OK] windows-x86_64 (MSI): ${fileName}`);
    }
  }

  if (Object.keys(platforms).length === 0) {
    console.error("错误: 未找到任何已签名的安装包。请先运行 `npm run tauri build` 并确保私钥已配置。");
    process.exit(1);
  }

  // 尝试从 git log 生成 release notes
  const { execSync } = await import("child_process");
  let notes = "Bug fixes and improvements.";
  try {
    const tags = execSync("git tag --sort=-creatordate", { encoding: "utf-8", cwd: PROJECT_ROOT }).trim().split("\n").filter(Boolean);
    if (tags.length >= 2) {
      const prevTag = tags[1];
      notes = execSync(`git log ${prevTag}..HEAD --pretty=format:"- %s"`, { encoding: "utf-8", cwd: PROJECT_ROOT }).trim();
    }
  } catch {
    // ignore
  }

  const latestJson = {
    version,
    notes: notes || "Bug fixes and improvements.",
    pub_date: pubDate,
    platforms,
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outPath = path.join(outputDir, "latest.json");
  fs.writeFileSync(outPath, JSON.stringify(latestJson, null, 2), "utf-8");
  console.log(`\n[OK] latest.json 已生成: ${outPath}`);
  console.log(JSON.stringify(latestJson, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
