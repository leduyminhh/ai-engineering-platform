import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyFull, applyAsk, statusOf, runMode } from "../cli/lib/mode.mjs";
import { buildClaudePermissions, loadPolicy } from "../cli/lib/permissions.mjs";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "cli", "index.mjs");
const dirs = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aip-mode-"));
  dirs.push(d);
  execFileSync("git", ["init", "-q"], { cwd: d });
  return d;
};
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const gen = (allowEnvFiles = false) => JSON.stringify(buildClaudePermissions(loadPolicy(), { allowEnvFiles }), null, 2) + "\n";
const EMPTY = JSON.stringify({ permissions: { deny: [], ask: [] } }, null, 2) + "\n";
const gatePath = (r) => path.join(r, ".claude", "aip-gate.json");
const setPath = (r) => path.join(r, ".claude", "settings.json");
const put = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };

test("P4e AC2.2: settings do aip sinh thành rỗng; bản sửa tay giữ nguyên và liệt kê quy tắc aip còn lại", () => {
  const a = applyFull(null, gen(), { allowEnvFiles: false });
  assert.equal(a.settingsText, EMPTY);
  assert.equal(a.settingsAction, "replaced");
  assert.equal(a.gate.mode, "full");

  const edited = JSON.stringify({ permissions: { deny: ["Read(./.env)", "Bash(rm -rf /tmp/x *)"], ask: ["WebFetch"] } }, null, 2) + "\n";
  const b = applyFull({}, edited, { allowEnvFiles: false });
  assert.equal(b.settingsText, edited);
  assert.equal(b.settingsAction, "kept-custom");
  assert.ok(b.leftoverRules.includes("WebFetch"));
  assert.ok(!b.leftoverRules.includes("Bash(rm -rf /tmp/x *)"));

  assert.equal(applyFull({}, null, { allowEnvFiles: false }).settingsAction, "absent");
});

test("P4e AC2.3: ask sau full sinh lại policy chuẩn, tôn trọng allowEnvFiles, giữ khóa khác", () => {
  for (const allowEnvFiles of [false, true]) {
    const f = applyFull({ mcpAllow: ["x"], allowEnvFiles }, gen(allowEnvFiles), { allowEnvFiles });
    const k = applyAsk(f.gate, f.settingsText, { allowEnvFiles });
    assert.equal(k.settingsText, gen(allowEnvFiles));
    assert.equal(k.settingsAction, "regenerated");
    assert.deepEqual(k.gate, { mcpAllow: ["x"], allowEnvFiles });
  }
  assert.ok(gen(true).length < gen(false).length, "allowEnvFiles bỏ nhóm env khỏi policy");
  assert.equal(applyAsk({ mode: "full" }, "{ custom }", { allowEnvFiles: false }).settingsAction, "kept");
  assert.equal(applyAsk(null, null, { allowEnvFiles: false }).settingsAction, "absent");
});

test("P4e AC2.3: statusOf báo mode và tình trạng settings", () => {
  assert.deepEqual(statusOf(null, null), { mode: "ask", settings: "absent", leftoverRules: [] });
  assert.equal(statusOf({ mode: "full" }, EMPTY).settings, "aip-full");
  assert.equal(statusOf({ mode: "full" }, EMPTY).mode, "full");
  assert.equal(statusOf({}, gen()).settings, "aip-ask");
  assert.equal(statusOf({ mode: "bogus" }, "{}").mode, "ask");
  const s = statusOf({}, JSON.stringify({ permissions: { ask: ["WebFetch"] } }));
  assert.equal(s.settings, "custom-with-aip-rules");
  assert.deepEqual(s.leftoverRules, ["WebFetch"]);
  assert.equal(statusOf({}, "{}").settings, "custom");
});

test("P4e AC2.1: runMode full giữ khóa khác, bỏ BOM, idempotent, ghi không BOM", () => {
  const root = tmp();
  put(gatePath(root), "\uFEFF" + JSON.stringify({ mcpAllow: ["a"] }));
  put(setPath(root), gen());
  const lines = [];
  assert.equal(runMode("full", { root, out: (l) => lines.push(l) }), 0);
  const first = fs.readFileSync(gatePath(root));
  assert.notEqual(first[0], 0xef);
  assert.deepEqual(JSON.parse(first.toString("utf8")), { mcpAllow: ["a"], mode: "full" });
  assert.ok(first.toString("utf8").endsWith("}\n") && !first.toString("utf8").includes("\r"));
  assert.equal(fs.readFileSync(setPath(root), "utf8"), EMPTY);
  assert.ok(lines.join("\n").includes("bypassPermissions"));
  runMode("full", { root, out: () => {} });
  assert.deepEqual(fs.readFileSync(gatePath(root)), first);
});

test("P4e AC2.1: runMode full tạo .claude/ khi thiếu; ask bỏ khóa mode; status in mode", () => {
  const root = tmp();
  runMode("full", { root, out: () => {} });
  assert.deepEqual(JSON.parse(fs.readFileSync(gatePath(root), "utf8")), { mode: "full" });
  const lines = [];
  runMode("status", { root, out: (l) => lines.push(l) });
  assert.ok(lines.join("\n").includes("full"));
  runMode("ask", { root, out: () => {} });
  assert.deepEqual(JSON.parse(fs.readFileSync(gatePath(root), "utf8")), {});
  const l2 = [];
  runMode("status", { root, out: (l) => l2.push(l) });
  assert.ok(l2.join("\n").includes("ask"));
});

test("P4e AC2.1: CLI từ chối -g và giá trị lạ", () => {
  const root = tmp();
  const run = (...args) => spawnSync("node", [CLI, "mode", ...args], { cwd: root, encoding: "utf8" });
  const g = run("full", "-g");
  assert.notEqual(g.status, 0);
  assert.match(g.stderr, /project/);
  assert.equal(run("bogus").status, 2);
  assert.equal(run().status, 2);
  assert.equal(fs.existsSync(gatePath(root)), false);
  assert.equal(run("full").status, 0);
  assert.equal(JSON.parse(fs.readFileSync(gatePath(root), "utf8")).mode, "full");
});
