import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { classifyFiles, describePack, loadPolicy } from "../cli/lib/pack-guard.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
// Policy gốc của repo (gói chỉ core) — dùng làm nền để test dựng biến thể shipPlugins.
const DEFAULT_POLICY_FOR_TEST = loadPolicy(REPO_ROOT);

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

test("pack-guard: nội dung skill của plugin trong shipPlugins KHÔNG bị chặn", () => {
  const policy = { ...DEFAULT_POLICY_FOR_TEST, shipPlugins: ["backend"] };
  const ok = baseline().concat(["plugins/backend/skills/backend-init/references/structure.md"]);
  assert.deepEqual(classifyFiles(ok, policy), []);
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
  const { allowed, denied, missing } = describePack(files, { ...DEFAULT_POLICY_FOR_TEST, shipPlugins: ["backend"] });
  assert.ok(allowed.includes("cli/index.mjs"), "file hợp lệ phải nằm ở allowed");
  assert.ok(allowed.includes("plugins/backend/skills/backend-init/references/structure.md"), "nội dung skill plugin trong shipPlugins phải allowed");
  assert.ok(denied.includes("test/wizard.test.mjs"), "test suite phải bị denied");
  assert.ok(denied.includes("docs/internal/plan.md"), "docs/ phải bị denied");
  assert.deepEqual(missing, [], "bộ file này đủ required");
});

test("pack-guard: describePack báo thiếu file bắt buộc", () => {
  const { missing } = describePack(["package.json", "LICENSE", "README.md"]);
  assert.ok(missing.includes("cli/index.mjs"), "phải nêu thiếu cli/index.mjs");
});

test("pack-guard: pack.config.json của repo chỉ ship core (shipPlugins rỗng, deny workflows/)", () => {
  const policy = loadPolicy(REPO_ROOT);
  assert.deepEqual(policy.shipPlugins, [], "shipPlugins phải rỗng — gói npm chỉ có core");
  assert.ok(policy.deny.includes("^workflows/"), "deny phải gồm ^workflows/");
});

test("pack-guard: gói chỉ core (không plugin, không workflows) hợp lệ", () => {
  const files = baseline().concat([
    "core/skills/git-workflow/SKILL.md",
    "plugins/_marketplace.json",
    "plugins/_published.json",
  ]);
  assert.deepEqual(classifyFiles(files, DEFAULT_POLICY_FOR_TEST), []);
});

test("pack-guard: chặn plugins/<id>/ ngoài shipPlugins (kể cả plugin từng published)", () => {
  const files = baseline().concat(["plugins/backend/skills/backend-init/SKILL.md", "plugins/data/.manifest.json"]);
  const errs = classifyFiles(files, DEFAULT_POLICY_FOR_TEST);
  assert.ok(errs.some((e) => e.includes("plugins/backend/")), "plugin backend ngoài shipPlugins phải bị chặn");
  assert.ok(errs.some((e) => e.includes("plugins/data/")), "plugin data ngoài shipPlugins phải bị chặn");
});

test("pack-guard: chặn workflows/ trong gói", () => {
  const files = baseline().concat(["workflows/orchestrator/WORKFLOW.md"]);
  const errs = classifyFiles(files, DEFAULT_POLICY_FOR_TEST);
  assert.ok(errs.some((e) => e.includes("workflows/orchestrator/WORKFLOW.md")), "workflows/ phải bị chặn");
});

test("pack-guard: file cấp plugins/ (_published.json, _marketplace.json) không bị coi là plugin", () => {
  const files = baseline().concat(["plugins/_published.json", "plugins/_marketplace.json"]);
  assert.deepEqual(classifyFiles(files, DEFAULT_POLICY_FOR_TEST), []);
});

test("pack-guard: shipPlugins khai báo mà thiếu trong gói → THIẾU", () => {
  const policy = { ...DEFAULT_POLICY_FOR_TEST, shipPlugins: ["backend"] };
  const errs = classifyFiles(baseline(), policy);
  assert.ok(errs.some((e) => e.includes("THIẾU") && e.includes("plugins/backend/")),
    "plugin trong shipPlugins vắng khỏi gói phải báo THIẾU");
});

test("pack-guard: plugin trong shipPlugins có mặt → hợp lệ, plugin khác vẫn bị chặn", () => {
  const policy = { ...DEFAULT_POLICY_FOR_TEST, shipPlugins: ["backend"] };
  const files = baseline().concat(["plugins/backend/.manifest.json", "plugins/frontend/.manifest.json"]);
  const errs = classifyFiles(files, policy);
  assert.ok(!errs.some((e) => e.includes("plugins/backend/")), "backend được ship");
  assert.ok(errs.some((e) => e.includes("plugins/frontend/")), "frontend vẫn bị chặn");
});

test("pack-guard: _published.json không còn buộc plugin published phải có trong gói", () => {
  // _published.json (wizard offer) giữ nguyên, nhưng không được ép ship: gói chỉ core vẫn hợp lệ.
  const policy = loadPolicy(REPO_ROOT);
  assert.deepEqual(classifyFiles(baseline(), policy), []);
});
