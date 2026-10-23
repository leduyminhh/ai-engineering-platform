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

test("P4e AC2.4: full lần hai với settings dạng rỗng là already-full, không báo sửa tay", () => {
  const r = applyFull({ mode: "full" }, EMPTY, { allowEnvFiles: false });
  assert.equal(r.settingsAction, "already-full");
  assert.equal(r.settingsText, EMPTY);
  const root = tmp();
  put(setPath(root), gen());
  runMode("full", { root, out: () => {} });
  const lines = [];
  runMode("full", { root, out: (l) => lines.push(l) });
  assert.ok(!lines.join("\n").includes("sửa tay"));
  assert.equal(fs.readFileSync(setPath(root), "utf8"), EMPTY);
});

test("P4e AC2.5: trong worktree, aip mode theo đúng thứ tự đọc của hook (worktree rồi repo chính)", () => {
  const main = fs.realpathSync.native(tmp());
  const git = (cwd, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  git(main, "config", "user.name", "t");
  git(main, "config", "user.email", "t@example.com");
  put(path.join(main, "README.md"), "x");
  git(main, "add", "README.md");
  git(main, "commit", "-q", "-m", "init");
  const wt = path.join(path.dirname(main), `${path.basename(main)}-wt`);
  dirs.push(wt);
  git(main, "worktree", "add", "-q", wt, "-b", "p4e-mode-wt");
  put(gatePath(main), JSON.stringify({ mode: "full", mcpDeny: ["evil"] }));
  const run = (sub) => { const l = []; runMode(sub, { root: wt, out: (x) => l.push(x) }); return l.join("\n"); };

  assert.match(run("status"), /Chế độ: full/);
  assert.match(run("status"), /repo chính/);

  run("ask");
  assert.deepEqual(JSON.parse(fs.readFileSync(gatePath(wt), "utf8")), { mcpDeny: ["evil"] });
  assert.match(run("status"), /Chế độ: ask/);
  assert.equal(JSON.parse(fs.readFileSync(gatePath(main), "utf8")).mode, "full", "file repo chính không bị sửa");

  fs.rmSync(gatePath(wt));
  const msg = run("full");
  assert.deepEqual(JSON.parse(fs.readFileSync(gatePath(wt), "utf8")), { mode: "full", mcpDeny: ["evil"] });
  assert.match(msg, /che file/);
});

test("P4e2 AC1.7: aip mode cảnh báo theo trạng thái git của aip-gate.json, không sửa .gitignore", () => {
  const git = (cwd, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const run = (sub, root) => { const l = []; assert.equal(runMode(sub, { root, out: (x) => l.push(x) }), 0); return l.join("\n"); };
  const ignorePath = (r) => path.join(r, ".gitignore");

  const tracked = tmp();
  git(tracked, "config", "user.name", "t");
  git(tracked, "config", "user.email", "t@example.com");
  put(gatePath(tracked), "{}");
  git(tracked, "add", ".claude/aip-gate.json");
  git(tracked, "commit", "-q", "-m", "gate");
  const t = run("full", tracked);
  assert.match(t, /bỏ qua/);
  assert.match(t, /git rm --cached \.claude\/aip-gate\.json/);
  assert.equal(JSON.parse(fs.readFileSync(gatePath(tracked), "utf8")).mode, "full");
  assert.match(run("status", tracked), /git: .*được theo dõi.*bỏ qua/);

  const open = tmp();
  const o = run("full", open);
  assert.match(o, /\.claude\/aip-gate\.json/);
  assert.match(o, /\.gitignore/);
  assert.doesNotMatch(o, /git rm --cached/);
  assert.match(run("status", open), /git: .*không theo dõi/);

  const ignored = tmp();
  put(ignorePath(ignored), ".claude/aip-gate.json\n");
  const before = fs.readFileSync(ignorePath(ignored));
  assert.doesNotMatch(run("full", ignored), /git|gitignore/i);
  assert.deepEqual(fs.readFileSync(ignorePath(ignored)), before);
  assert.match(run("status", ignored), /git: .*không theo dõi/);

  assert.equal(fs.existsSync(ignorePath(tracked)), false);
  assert.equal(fs.existsSync(ignorePath(open)), false);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "aip-mode-nogit-"));
  dirs.push(outside);
  assert.match(run("status", outside), /git: .*không xác định/);
  assert.match(run("full", outside), /✓ mode=full/);
});
