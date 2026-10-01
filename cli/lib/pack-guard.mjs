// cli/lib/pack-guard.mjs
// Verifier fail-loud cho nội dung gói npm. package.json đã khai `files` allowlist
// (cơ chế native của npm quyết định file nào được đóng gói); guard này là lớp
// kiểm tra thứ hai (belt-and-suspenders): chạy `npm pack --ignore-scripts
// --dry-run --json`, đối chiếu từng file THỰC TẾ sẽ publish với (a) allowlist cấp
// thư mục và (b) denylist cấp file, rồi fail-loud khi có file vượt ranh giới —
// bắt được cả trường hợp `files` bị nới rộng nhầm.
//
// Luật phạm vi: gói npm CHỈ ship core (core/ + CLI + adapters + templates). Plugin và workflows
// người dùng cài từ source (clone + npm link) nên `plugins/<id>/` chỉ được có mặt khi id nằm trong
// `shipPlugins` (mặc định rỗng) và `workflows/` luôn bị chặn. `plugins/_published.json` chỉ điều
// khiển wizard offer khi chạy từ source — KHÔNG còn quyết định gói ship gì.
//
// Policy publish lấy từ <root>/pack.config.json — nguồn sự thật duy nhất.
// Khi thiếu file (vd consumer cài package), fallback về DEFAULT_POLICY.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---- policy mặc định (fallback khi thiếu pack.config.json) ----
// Giữ khớp với nội dung pack.config.json ở root repo.
const DEFAULT_POLICY = {
  // allowlist: chỉ những gốc cấp cao này được phép lên npm. Một thư mục mới
  // xuất hiện (vd docs/, report/) mà không khai ở đây là lỗi.
  allowTop: ["adapters", "cli", "core", "plugins", "templates"],
  // file nhất định cấp root trong package (luôn có).
  allowFile: ["package.json", "package-lock.json", "LICENSE", "README.md", "AGENTS.md"],
  // denylist: pattern regex (string) chặn file dù nằm trong allowlist. Config Cowork (_cowork.json,
  // tham chiếu skill mọi plugin) và workflows/ luôn chặn vì gói không ship plugin/workflow.
  deny: [
    "\\.test\\.mjs$",
    "^test/",
    "^docs/",
    "^completions/",
    "^SHELL_SETUP\\.md$",
    "^plugins/_cowork\\.json$",
    "^workflows/",
  ],
  // plugin id được ship dưới plugins/<id>/. Rỗng = gói chỉ có core; plugin còn lại cài từ source.
  shipPlugins: [],
  // file bắt buộc phải có trong package (gồm bin entry + khai báo).
  required: ["cli/index.mjs", "cli/build.mjs", "cli/lib/install.mjs", "cli/lib/plugins.mjs"],
};

const CONFIG_NAME = "pack.config.json";

function hasArray(obj, key) {
  return obj && Array.isArray(obj[key]);
}

/** Đọc policy từ <root>/pack.config.json; lỗi/shape sai → DEFAULT_POLICY. Thiếu shipPlugins → [] (chỉ core). */
export function loadPolicy(root) {
  try {
    const cfg = JSON.parse(readFileSync(resolve(root, CONFIG_NAME), "utf8"));
    if (!hasArray(cfg, "allowTop") || !hasArray(cfg, "allowFile") || !hasArray(cfg, "deny") || !hasArray(cfg, "required")) {
      return DEFAULT_POLICY;
    }
    return {
      allowTop: cfg.allowTop, allowFile: cfg.allowFile, deny: cfg.deny, required: cfg.required,
      shipPlugins: hasArray(cfg, "shipPlugins") ? cfg.shipPlugins : [],
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpmPack(root) {
  return new Promise((resolve, reject) => {
    // Windows không spawn được *.cmd khi pass arg dạng mảng qua spawn thuần
    // (EINVAL), nên cần shell. Args ở đây là hằng số cố định, không chứa input
    // người dùng.
    // --ignore-scripts: npm pack mặc định chạy prepack, mà prepack chính là
    // guard này → nếu không dừng script sẽ đệ quy vô hạn.
    const child = spawn(`${npmBin} pack --ignore-scripts --dry-run --json`, {
      cwd: root,
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`npm pack thoát mã ${code}: ${stderr.trim()}`));
      else resolve(stdout);
    });
  });
}

async function packFileList(root) {
  const stdout = await runNpmPack(root);
  const parsed = JSON.parse(stdout);
  const pack = Array.isArray(parsed) ? parsed[0] : parsed;
  return (pack?.files ?? []).map((f) => f.path.replaceAll("\\", "/").replace(/^\.\//, ""));
}

function topOf(file) {
  const i = file.indexOf("/");
  return i === -1 ? file : file.slice(0, i);
}

/** Biên dịch deny patterns (string) của policy thành mảng RegExp. */
function compileDeny(policy) {
  return policy.deny.map((d) => new RegExp(d));
}

/** Id plugin nếu file nằm dưới plugins/<id>/; file cấp plugins/ (_published.json…) → null. */
function pluginIdOf(file) {
  const m = /^plugins\/([^/]+)\//.exec(file);
  return m ? m[1] : null;
}

/** Plugin không nằm trong shipPlugins: file của nó không được lên npm. */
function isUnshippedPlugin(file, policy) {
  const id = pluginIdOf(file);
  return id !== null && !(policy.shipPlugins || []).includes(id);
}

// ---- hàm thuần: test được không cần gọi npm pack ----

/** Trả danh sách vi phạm cho một bộ file đã cho. Rỗng = hợp lệ. */
export function classifyFiles(files, policy = DEFAULT_POLICY) {
  const errors = [];
  const denies = compileDeny(policy);
  for (const file of files) {
    const top = topOf(file);
    if (policy.allowFile.includes(file)) continue;
    if (!policy.allowTop.includes(top)) {
      errors.push(`CẤM: mục ngoài allowlist "${top}" không được publish (${file})`);
      continue;
    }
    if (isUnshippedPlugin(file, policy)) {
      errors.push(`CẤM: plugin "${pluginIdOf(file)}" không nằm trong shipPlugins — gói npm chỉ ship core (${file})`);
      continue;
    }
    for (const pat of denies) {
      if (pat.test(file)) {
        errors.push(`CẤM: file bị denylist — ${file}`);
        break;
      }
    }
  }
  for (const req of policy.required) {
    if (!files.includes(req)) errors.push(`THIẾU: file bắt buộc không có trong package — ${req}`);
  }
  // Mỗi plugin trong shipPlugins PHẢI có mặt — bắt lỗi package.json files lệch với pack.config.json.
  for (const id of policy.shipPlugins || []) {
    if (!files.some((f) => f.startsWith(`plugins/${id}/`))) {
      errors.push(`THIẾU: plugin trong shipPlugins không có file trong package — plugins/${id}/`);
    }
  }
  return errors;
}

/**
 * Chia bộ file thành allowed / denied / missing theo policy. Phục vụ `--show`
 * và test. denied khớp lỗi của classifyFiles; missing = thiếu file bắt buộc.
 */
export function describePack(files, policy = DEFAULT_POLICY) {
  const denied = [];
  const deniedSet = new Set();
  const denies = compileDeny(policy);
  for (const file of files) {
    const top = topOf(file);
    let bad = false;
    if (!policy.allowFile.includes(file)) {
      if (!policy.allowTop.includes(top)) {
        denied.push(file);
        deniedSet.add(file);
        bad = true;
      }
      if (!bad && isUnshippedPlugin(file, policy)) {
        denied.push(file);
        deniedSet.add(file);
        bad = true;
      }
      if (!bad) {
        for (const pat of denies) {
          if (pat.test(file)) {
            denied.push(file);
            deniedSet.add(file);
            break;
          }
        }
      }
    }
  }
  const missing = policy.required.filter((req) => !files.includes(req));
  const allowed = files.filter((f) => !deniedSet.has(f));
  return { allowed, denied, missing };
}

/** Trả danh sách vi phạm (rỗng = hợp lệ). Tương tự validatePlugins(). */
export async function packGuardViolations({ root }) {
  const policy = loadPolicy(root);
  let files;
  try {
    files = await packFileList(root);
  } catch (err) {
    return [`pack-guard đọc npm pack thất bại: ${err.message}`];
  }
  return classifyFiles(files, policy);
}

/** In kết quả; exit code khác 0 khi có vi phạm. */
export async function runPackGuard() {
  const errors = await packGuardViolations({ root: process.cwd() });
  if (errors.length) {
    console.error("\n✖ pack-guard: có file vượt ranh giới publish:\n");
    for (const e of errors) console.error(`  · ${e}`);
    console.error("\nSửa allowlist trong pack.config.json hoặc loại file trước khi publish.\n");
    process.exitCode = 1;
    return false;
  }
  console.log("✔ pack-guard: toàn bộ file trong package đều nằm trong phạm vi được phép.");
  return true;
}

/** In policy + breakdown file publish (chế độ --show). Luôn exit 0. */
async function runShow() {
  const root = process.cwd();
  const policy = loadPolicy(root);
  let files;
  try {
    files = await packFileList(root);
  } catch (err) {
    console.error(`✖ pack-guard --show: không đọc được npm pack: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const { allowed, denied, missing } = describePack(files, policy);

  console.log(`\n=== Publish policy (${CONFIG_NAME}) ===`);
  console.log(`allowTop : ${policy.allowTop.join(", ")}`);
  console.log(`allowFile: ${policy.allowFile.join(", ")}`);
  console.log(`deny     : ${policy.deny.join(", ")}`);
  console.log(`shipPlugins: ${(policy.shipPlugins || []).join(", ") || "(rỗng — chỉ core)"}`);
  console.log(`required : ${policy.required.join(", ")}`);
  console.log(`\n=== File sẽ publish (npm pack --dry-run): ${files.length} ===`);
  console.log(`allowed : ${allowed.length}`);
  console.log(`denied  : ${denied.length}`);
  console.log(`missing (required): ${missing.length}`);

  if (denied.length) {
    console.log("\n--- File bị guard chặn (fix pack.config.json trước khi publish): ---");
    for (const f of denied) console.log(`  CẤM ${f}`);
  }
  if (missing.length) {
    console.log("\n--- File bắt buộc bị thiếu: ---");
    for (const f of missing) console.log(`  THIẾU ${f}`);
  }

  const byTop = {};
  for (const f of allowed) {
    const top = topOf(f);
    byTop[top] = (byTop[top] || 0) + 1;
  }
  console.log("\n--- Phân bố allowed theo thư mục gốc: ---");
  for (const [k, v] of Object.entries(byTop).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
  console.log(denied.length || missing.length
    ? "\n⚠ Có denied/missing: chưa sẵn sàng publish."
    : "\n✔ Mọi file đều trong phạm vi được phép — sẵn sàng publish.");
}

// Chạy như entry point: `node cli/lib/pack-guard.mjs` hoặc qua npm script.
// Dùng so khớp import.meta.url với argv[1] (import.meta.main chưa ổn định trên Node 20 →
// undefined khiến guard không chạy, prepack pass rỗng — vô hiệu hoá guard).
const isMain = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`
);
if (isMain) {
  if (process.argv.includes("--show")) {
    await runShow();
  } else {
    await runPackGuard();
  }
}