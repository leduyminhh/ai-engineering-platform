import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { classifyFiles, describePack, loadPolicy } from "../cli/lib/pack-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// Bộ file tối thiểu có vẻ hợp lệ, đủ các file bắt buộc.
function baseline() {
  return [
    "package.json",
    "LICENSE",
    "README.md",
    "cli/index.mjs",
    "cli/build.mjs",
    "cli/lib/install.mjs",
    "cli/lib/plugins.mjs",
  ];
}

test("pack-guard: bộ file hợp lệ không có vi phạm", () => {
  assert.deepEqual(classifyFiles(baseline()), []);
});

test("pack-guard: chặn thư mục test/ (ngoài allowlist)", () => {
  const bad = baseline().concat(["test/install.test.mjs"]);
  const errs = classifyFiles(bad);
  assert.ok(errs.some((e) => e.includes("test/install.test.mjs")),
    "file dưới test/ phải bị guard chặn");
});

test("pack-guard: chặn mọi file .test.mjs và docs/", () => {
  const files = baseline().concat([
    "test/wizard.test.mjs",
    "docs/internal/plan.md",
  ]);
  const errs = classifyFiles(files);
  assert.ok(errs.some((e) => e.includes("wizard.test.mjs")), "phải chặn wizard.test.mjs");
  assert.ok(errs.some((e) => e.includes('"docs"')), "phải chặn docs/");
});

test("pack-guard: nội dung skill trong plugin KHÔNG bị chặn", () => {
  // file phụ trợ trong cây plugin hợp lệ (nội dung skill) nằm trong allowlist, không denylist.
  const ok = baseline().concat(["plugins/backend/skills/backend-init/references/structure.md"]);
  assert.deepEqual(classifyFiles(ok).filter((e) => e.includes("structure.md")), []);
});

test("pack-guard: mục ngoài allowlist bị chặn", () => {
  const errs = classifyFiles(baseline().concat(["providers/x.json", "report/r.json"]));
  assert.ok(errs.some((e) => e.includes('"providers"')), "phải chặn providers/");
  assert.ok(errs.some((e) => e.includes('"report"')), "phải chặn report/");
});

test("pack-guard: báo thiếu file bắt buộc", () => {
  const errs = classifyFiles(["package.json", "LICENSE", "README.md"]);
  assert.ok(errs.some((e) => e.includes("cli/index.mjs")), "phải báo thiếu cli/index.mjs");
});

test("pack-guard: loadPolicy đọc pack.config.json ở root", () => {
  const policy = loadPolicy(REPO_ROOT);
  assert.ok(policy.allowTop.includes("adapters"), "allowTop phải gồm adapters");
  assert.ok(policy.allowTop.includes("templates"), "allowTop phải gồm templates");
  assert.ok(policy.allowFile.includes("package.json"), "allowFile phải gồm package.json");
  assert.ok(policy.deny.some((d) => d.includes("test")), "deny phải gồm pattern test");
  assert.ok(policy.required.includes("cli/index.mjs"), "required phải gồm cli/index.mjs");
});

test("pack-guard: describePack tách allowed/denied/missing", () => {
  const files = [
    ...baseline(),
    "plugins/backend/skills/backend-init/references/structure.md",
    "test/wizard.test.mjs",
    "docs/internal/plan.md",
  ];
  const { allowed, denied, missing } = describePack(files);
  assert.ok(allowed.includes("cli/index.mjs"), "file hợp lệ phải nằm ở allowed");
  assert.ok(allowed.includes("plugins/backend/skills/backend-init/references/structure.md"), "nội dung skill plugin phải allowed");
  assert.ok(denied.includes("test/wizard.test.mjs"), "test suite phải bị denied");
  assert.ok(denied.includes("docs/internal/plan.md"), "docs/ phải bị denied");
  assert.deepEqual(missing, [], "bộ file này đủ required");
});

test("pack-guard: describePack báo thiếu file bắt buộc", () => {
  const { missing } = describePack(["package.json", "LICENSE", "README.md"]);
  assert.ok(missing.includes("cli/index.mjs"), "phải nêu thiếu cli/index.mjs");
});

test("pack-guard: loadPolicy suy denylist plugin chưa publish từ _published.json", () => {
  const policy = loadPolicy(REPO_ROOT);
  assert.ok(Array.isArray(policy.published) && policy.published.includes("backend"),
    "policy.published phải phản ánh _published.json");
  const files = baseline().concat([
    "plugins/backend/.manifest.json",
    "plugins/frontend/.manifest.json",
    "plugins/engineering/.manifest.json",
    "plugins/data/skills/data-oltp-init/SKILL.md",
  ]);
  const errs = classifyFiles(files, policy);
  assert.ok(errs.some((e) => e.includes("plugins/data/")), "plugin chưa publish (data) phải bị chặn");
  assert.ok(!errs.some((e) => e.includes("engineering")), "plugin đã publish (engineering) không bị chặn/thiếu");
});

test("pack-guard: báo thiếu plugin đã publish khi vắng khỏi package", () => {
  const policy = loadPolicy(REPO_ROOT);
  const files = baseline().concat([
    "plugins/backend/.manifest.json",
    "plugins/frontend/.manifest.json",
  ]); // thiếu 'engineering' (đang published)
  const errs = classifyFiles(files, policy);
  assert.ok(errs.some((e) => e.includes("engineering")), "phải báo thiếu plugin đã publish 'engineering'");
});
