import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "../cli/lib/init.mjs";
import { initDocFiles } from "../cli/lib/templates.mjs";
import { BEGIN, importsAgentsMd } from "../cli/lib/managed-block.mjs";
import { loadPolicy } from "../cli/lib/permissions.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirs = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "aip-init-")); dirs.push(d); return d; };
// Node rmSync: an toàn với junction do install tạo (Git Bash rm -rf xoá xuyên vào build/).
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(abs, base) : [path.relative(base, abs).split(path.sep).join("/")];
  });
}

test("init mặc định chỉ tạo AGENTS.md có khối baseline + CLAUDE.md import @AGENTS.md", () => {
  const root = tmp();
  const r = init({ root });
  assert.deepEqual([...r.created].sort(), ["AGENTS.md", "CLAUDE.md"]);
  assert.ok(read(root, "AGENTS.md").includes(BEGIN));
  assert.ok(importsAgentsMd(read(root, "CLAUDE.md")));
});

test("init --full tạo cả khung templates/init + AGENTS.md", () => {
  const root = tmp();
  const r = init({ root, full: true });
  const expected = [...listFiles(path.join(REPO, "templates", "init")), ...initDocFiles().map((f) => f.rel), ".claude/settings.json", "AGENTS.md"].sort();
  assert.deepEqual([...r.created].sort(), expected);
});

test("init --full sinh requirement/design/plan _TEMPLATE từ core, đã bỏ khối header", () => {
  const root = tmp();
  init({ root, full: true });
  for (const f of ["requirement", "design", "plan"]) {
    const text = read(root, `docs/requests/_TEMPLATE/${f}.md`);
    assert.ok(text.length > 0, f);
    assert.ok(!text.includes("<!-- artifact-template"), f);
  }
});

test("init --full sinh docs/decisions/_TEMPLATE.md và project-knowledge/ từ core, đã bỏ khối header", () => {
  const root = tmp();
  init({ root, full: true });
  for (const rel of ["docs/decisions/_TEMPLATE.md", "project-knowledge/project-overview.md", "project-knowledge/code-convention.md"]) {
    const text = read(root, rel);
    assert.ok(text.length > 0, rel);
    assert.ok(!text.includes("<!-- artifact-template"), rel);
  }
  assert.ok(read(root, "docs/decisions/_TEMPLATE.md").includes("## Bối cảnh và vấn đề"));
  assert.ok(fs.existsSync(path.join(root, "project-knowledge/tech-stack.yml")));
});

test("init --full không ghi đè docs/requests/_TEMPLATE/plan.md đã có", () => {
  const root = tmp();
  const old = "# Plan: kiểu cũ\n## Phase 1\n";
  fs.mkdirSync(path.join(root, "docs/requests/_TEMPLATE"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/requests/_TEMPLATE/plan.md"), old);
  const r = init({ root, full: true });
  assert.equal(read(root, "docs/requests/_TEMPLATE/plan.md"), old);
  assert.ok(r.skipped.includes("docs/requests/_TEMPLATE/plan.md"));
  assert.ok(r.created.includes("docs/requests/_TEMPLATE/design.md"));
});

test("AC2.2: init --full sinh docs/specs/_TEMPLATE.md từ core, đã bỏ khối header", () => {
  const root = tmp();
  init({ root, full: true });
  const text = read(root, "docs/specs/_TEMPLATE.md");
  assert.ok(text.includes("## Yêu cầu"));
  assert.ok(!text.includes("<!-- artifact-template"));
});

test("AC2.2: init --full không ghi đè docs/specs/_TEMPLATE.md đã có", () => {
  const root = tmp();
  const old = "# Spec cũ\n";
  fs.mkdirSync(path.join(root, "docs/specs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/specs/_TEMPLATE.md"), old);
  const r = init({ root, full: true });
  assert.equal(read(root, "docs/specs/_TEMPLATE.md"), old);
  assert.ok(r.skipped.includes("docs/specs/_TEMPLATE.md"));
});

test("init không ghi đè file đã có, cảnh báo khi CLAUDE.md có sẵn chưa import", () => {
  for (const [claude, warns] of [["# Rule cũ\n", 1], ["@AGENTS.md\n# Rule cũ\n", 0]]) {
    const root = tmp();
    fs.writeFileSync(path.join(root, "CLAUDE.md"), claude);
    const r = init({ root });
    assert.equal(read(root, "CLAUDE.md"), claude);
    assert.deepEqual(r.skipped, ["CLAUDE.md"]);
    assert.equal(r.warnings.length, warns, JSON.stringify(claude));
  }
});

test("AC1.2: init --full sinh .claude/settings.json: deny = nhóm secrets, ask = ba nhóm còn lại", () => {
  const root = tmp();
  init({ root, full: true });
  const { groups } = loadPolicy();
  const { permissions } = JSON.parse(read(root, ".claude/settings.json"));
  assert.deepEqual(permissions.deny, groups.secrets.rules);
  assert.deepEqual(permissions.ask, [...groups.git_push.rules, ...groups.network.rules, ...groups.production_deploy.rules]);
});

test("AC1.3: init --full không đọc/sửa .claude/settings.json đã có (JSON hợp lệ hoặc chuỗi rác)", () => {
  for (const old of ['{"permissions":{"allow":["Bash(ls *)"]}}\n', "không phải json {{{"]) {
    const root = tmp();
    fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(root, ".claude/settings.json"), old);
    const r = init({ root, full: true });
    assert.equal(read(root, ".claude/settings.json"), old);
    assert.ok(r.skipped.includes(".claude/settings.json"));
    assert.ok(!r.created.includes(".claude/settings.json"));
  }
});

test("init không --full không tạo .claude/settings.json", () => {
  const root = tmp();
  init({ root });
  assert.ok(!fs.existsSync(path.join(root, ".claude/settings.json")));
});

test("init rồi install claude core: baseline nằm ở AGENTS.md đúng 1 lần, không chép vào CLAUDE.md", async () => {
  const root = tmp();
  init({ root });
  process.env.AIE_INSTALL_ROOT = root;
  const { install } = await import("../cli/lib/install.mjs");
  install({ providers: "claude", plugins: "core", scope: "project" });
  assert.equal(read(root, "AGENTS.md").split(BEGIN).length - 1, 1);
  assert.ok(!read(root, "CLAUDE.md").includes(BEGIN));
});
