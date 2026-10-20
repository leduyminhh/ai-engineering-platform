import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "../cli/lib/init.mjs";
import { initDocFiles } from "../cli/lib/templates.mjs";
import { BEGIN, importsAgentsMd } from "../cli/lib/managed-block.mjs";

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
  const expected = [...listFiles(path.join(REPO, "templates", "init")), ...initDocFiles().map((f) => f.rel), "AGENTS.md"].sort();
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

test("init rồi install claude core: baseline nằm ở AGENTS.md đúng 1 lần, không chép vào CLAUDE.md", async () => {
  const root = tmp();
  init({ root });
  process.env.AIE_INSTALL_ROOT = root;
  const { install } = await import("../cli/lib/install.mjs");
  install({ providers: "claude", plugins: "core", scope: "project" });
  assert.equal(read(root, "AGENTS.md").split(BEGIN).length - 1, 1);
  assert.ok(!read(root, "CLAUDE.md").includes(BEGIN));
});
