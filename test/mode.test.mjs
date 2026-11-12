import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { applyFull, applyAsk, statusOf, runMode } from "../cli/lib/mode.mjs";
import { runAutonomy } from "../cli/lib/autonomy.mjs";
import { buildClaudePermissions, loadPolicy } from "../cli/lib/permissions.mjs";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "cli", "index.mjs");
const dirs = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aip-mode-"));
  dirs.push(d);
  execFileSync("git", ["init", "-q"], { cwd: d });
  return d;
};
const tmpNoGit = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aip-auto-nogit-"));
  dirs.push(d);
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

test("P4e2 AC2.3: file worktree hỏng che repo chính; aip mode báo lỗi ra stderr, exit 1, không ghi file", () => {
  const main = fs.realpathSync.native(tmp());
  const git = (cwd, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  git(main, "config", "user.name", "t");
  git(main, "config", "user.email", "t@example.com");
  put(path.join(main, "README.md"), "x");
  git(main, "add", "README.md");
  git(main, "commit", "-q", "-m", "init");
  const wt = path.join(path.dirname(main), `${path.basename(main)}-bad`);
  dirs.push(wt);
  git(main, "worktree", "add", "-q", wt, "-b", "p4e2-bad-wt");
  const mainGate = JSON.stringify({ mode: "full" });
  put(gatePath(main), mainGate);
  for (const bad of ["{ not json", "[]", "null"]) {
    put(gatePath(wt), bad);
    for (const sub of ["status", "full", "ask"]) {
      const r = spawnSync("node", [CLI, "mode", sub], { cwd: wt, encoding: "utf8" });
      assert.equal(r.status, 1, `${sub} với ${bad}`);
      assert.match(r.stderr, /aip-gate\.json/);
      assert.equal(r.stdout, "");
      assert.equal(fs.readFileSync(gatePath(wt), "utf8"), bad);
      assert.equal(fs.readFileSync(gatePath(main), "utf8"), mainGate);
    }
  }
});

test("P4e2 AC2.5: settings.json hoặc aip-gate.json là thư mục, hoặc JSON hỏng ⇒ stderr, exit 1, không ném", () => {
  for (const target of [setPath, gatePath]) {
    const root = tmp();
    fs.mkdirSync(target(root), { recursive: true });
    for (const sub of ["status", "full", "ask"]) {
      const err = [];
      const out = [];
      assert.equal(runMode(sub, { root, out: (l) => out.push(l), err: (l) => err.push(l) }), 1, `${sub} ${path.basename(target(root))}`);
      assert.match(err.join("\n"), /Lỗi/);
      assert.deepEqual(out, []);
    }
    assert.ok(fs.statSync(target(root)).isDirectory());
  }
  const root = tmp();
  put(gatePath(root), "{ not json");
  const err = [];
  assert.equal(runMode("status", { root, out: () => assert.fail("stdout"), err: (l) => err.push(l) }), 1);
  assert.match(err.join("\n"), /JSON/);
});

test("P4e2 AC4.5: git không chạy được (run trả null) → status 'không xác định', full không cảnh báo đã theo dõi", () => {
  const root = tmp();
  put(gatePath(root), JSON.stringify({ mode: "full" }));
  const lines = [];
  runMode("status", { root, out: (l) => lines.push(l), run: () => null });
  assert.match(lines.join("\n"), /git: không xác định/);
  const full = [];
  runMode("full", { root, out: (l) => full.push(l), run: () => null });
  assert.ok(!full.join("\n").includes("được git theo dõi"));
});

test("autonomy-gates AC8.1: aip autonomy high/safe/status giữ khóa khác; sub lạ exit 2", () => {
  const root = tmp();
  const others = { mode: "full", allowEnvFiles: true, mcpDeny: ["evil"] };
  put(gatePath(root), JSON.stringify(others));
  const run = (sub) => { const out = [], err = []; const code = runAutonomy(sub, { root, out: (l) => out.push(l), err: (l) => err.push(l) }); return { code, out: out.join("\n"), err: err.join("\n") }; };
  const gate = () => JSON.parse(fs.readFileSync(gatePath(root), "utf8"));
  const HIGH = { mergeLocal: true, cleanup: true, partRunner: "subagent" };

  assert.match(run("status").out, /"partRunner":"session"/);

  assert.equal(run("high").code, 0);
  assert.deepEqual(gate(), { ...others, autonomy: HIGH });
  assert.match(run("high").out, /cách chạy vẫn hỏi/, "high không bỏ câu hỏi cách chạy");
  assert.deepEqual(gate(), { ...others, autonomy: HIGH }, "high lần hai không đổi gì");
  assert.ok(run("status").out.includes(JSON.stringify({ ...HIGH, planRunner: "subagent" })));

  assert.equal(run("safe").code, 0);
  assert.deepEqual(gate(), others);
  assert.match(run("status").out, /"mergeLocal":false,"cleanup":false,"partRunner":"session","planRunner":"subagent"/);

  const before = fs.readFileSync(gatePath(root), "utf8");
  for (const sub of ["bogus", undefined]) assert.equal(run(sub).code, 2, String(sub));
  assert.equal(fs.readFileSync(gatePath(root), "utf8"), before, "sub lạ không ghi file");
});

test("autonomy-gates AC3.4: aip-gate.json đã git add ⇒ status nêu khoá bị bỏ qua và in mặc định an toàn; high cảnh báo", () => {
  const root = tmp();
  const run = (sub) => { const out = []; runAutonomy(sub, { root, out: (l) => out.push(l) }); return out.join("\n"); };
  assert.equal(runAutonomy("high", { root, out: () => {} }), 0);
  assert.ok(run("status").includes('"mergeLocal":true'), "chưa theo dõi: khoá có hiệu lực");
  execFileSync("git", ["add", ".claude/aip-gate.json"], { cwd: root });
  const st = run("status");
  assert.match(st, /"mergeLocal":false,"cleanup":false,"partRunner":"session","planRunner":"subagent"/);
  assert.match(st, /bỏ qua/);
  assert.match(run("high"), /bỏ qua/);
});

test("autonomy-gates: high và safe giữ gợi ý planRunner đã lưu bằng --set", () => {
  const root = tmp();
  put(gatePath(root), JSON.stringify({ mode: "ask", autonomy: { mergeLocal: true, partRunner: "sequential", planRunner: "inline" } }));
  const run = (sub) => runAutonomy(sub, { root, out: () => {}, err: () => {} });
  const gate = () => JSON.parse(fs.readFileSync(gatePath(root), "utf8"));
  assert.equal(run("high"), 0);
  assert.deepEqual(gate().autonomy, { mergeLocal: true, cleanup: true, partRunner: "subagent", planRunner: "inline" });
  assert.equal(run("safe"), 0);
  assert.deepEqual(gate(), { mode: "ask", autonomy: { planRunner: "inline" } }, "safe bỏ bộ high, giữ planRunner");
});

test("autonomy-gates AC8.1: safe khi chưa có aip-gate.json không tạo file; high tạo .claude/", () => {
  const root = tmp();
  assert.equal(runAutonomy("safe", { root, out: () => {} }), 0);
  assert.equal(fs.existsSync(gatePath(root)), false);
  assert.equal(runAutonomy("high", { root, out: () => {} }), 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(gatePath(root), "utf8")), { autonomy: { mergeLocal: true, cleanup: true, partRunner: "subagent" } });
});

test("autonomy-gates AC8.1: aip-gate.json hỏng → stderr, exit 1, không ghi", () => {
  const root = tmp();
  put(gatePath(root), "{ hỏng");
  for (const sub of ["high", "safe"]) {
    const err = [];
    assert.equal(runAutonomy(sub, { root, out: () => {}, err: (l) => err.push(l) }), 1, sub);
    assert.equal(fs.readFileSync(gatePath(root), "utf8"), "{ hỏng");
    assert.ok(err.length, sub);
  }
});

test("autonomy-gates AC8.1: CLI aip autonomy từ chối -g và giá trị lạ", () => {
  const root = tmp();
  const run = (...args) => spawnSync("node", [CLI, "autonomy", ...args], { cwd: root, encoding: "utf8" });
  assert.notEqual(run("high", "-g").status, 0);
  assert.equal(run("bogus").status, 2);
  assert.equal(fs.existsSync(gatePath(root)), false);
  assert.equal(run("high").status, 0);
  assert.equal(JSON.parse(fs.readFileSync(gatePath(root), "utf8")).autonomy.partRunner, "subagent");
});

test("autonomy-gates AC8.1: ngoài repo git, high/safe/status đọc thẳng aip-gate.json của thư mục; file hỏng ⇒ exit 1, không ghi", () => {
  const root = tmpNoGit();
  const others = { mode: "full", allowEnvFiles: true, mcpDeny: ["evil"] };
  put(gatePath(root), JSON.stringify(others));
  const run = (sub) => { const out = [], err = []; const code = runAutonomy(sub, { root, out: (l) => out.push(l), err: (l) => err.push(l) }); return { code, out: out.join("\n"), err: err.join("\n") }; };
  const gate = () => JSON.parse(fs.readFileSync(gatePath(root), "utf8"));
  const HIGH = { mergeLocal: true, cleanup: true, partRunner: "subagent" };

  assert.equal(run("high").code, 0);
  assert.deepEqual(gate(), { ...others, autonomy: HIGH });
  const st = run("status").out;
  assert.ok(st.includes(JSON.stringify({ ...HIGH, planRunner: "subagent" })));
  assert.doesNotMatch(st, /mặc định an toàn/);
  assert.equal(run("safe").code, 0);
  assert.deepEqual(gate(), others);

  for (const bad of ["{ hỏng", "[]"]) {
    put(gatePath(root), bad);
    for (const sub of ["high", "safe", "status"]) {
      const r = run(sub);
      assert.equal(r.code, 1, `${sub} với ${bad}`);
      assert.match(r.err, /aip-gate\.json/);
      assert.equal(fs.readFileSync(gatePath(root), "utf8"), bad);
    }
  }
});

test("autonomy-gates AC8.1: high cảnh báo theo trạng thái git của aip-gate.json, không sửa .gitignore", () => {
  const git = (cwd, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const run = (sub, root) => { const l = []; assert.equal(runAutonomy(sub, { root, out: (x) => l.push(x), err: () => {} }), 0); return l.join("\n"); };

  const tracked = tmp();
  git(tracked, "config", "user.name", "t");
  git(tracked, "config", "user.email", "t@example.com");
  put(gatePath(tracked), "{}");
  git(tracked, "add", ".claude/aip-gate.json");
  git(tracked, "commit", "-q", "-m", "gate");
  const t = run("high", tracked);
  assert.match(t, /clone/);
  assert.match(t, /git rm --cached \.claude\/aip-gate\.json/);
  assert.match(run("status", tracked), /git: .*được git theo dõi/);

  const open = tmp();
  const o = run("high", open);
  assert.match(o, /\.gitignore/);
  assert.doesNotMatch(o, /git rm --cached/);
  assert.match(run("status", open), /git: .*chưa gitignore/);
  assert.equal(fs.existsSync(path.join(open, ".gitignore")), false);
});

test("autonomy-gates AC8.1: trong worktree, safe chép khóa repo chính trừ autonomy và mode; repo chính hỏng ⇒ exit 1, không ghi", () => {
  const main = fs.realpathSync.native(tmp());
  const git = (cwd, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", ...a], { cwd, stdio: ["ignore", "pipe", "pipe"] });
  git(main, "config", "user.name", "t");
  git(main, "config", "user.email", "t@example.com");
  put(path.join(main, "README.md"), "x");
  git(main, "add", "README.md");
  git(main, "commit", "-q", "-m", "init");
  const wt = path.join(path.dirname(main), `${path.basename(main)}-auto-wt`);
  dirs.push(wt);
  git(main, "worktree", "add", "-q", wt, "-b", "autonomy-wt");
  const high = { mergeLocal: true, cleanup: true, partRunner: "subagent" };
  const mainGate = JSON.stringify({ mode: "full", mcpDeny: ["evil"], autonomy: high });
  put(gatePath(main), mainGate);
  const run = (sub) => { const out = []; const code = runAutonomy(sub, { root: wt, out: (l) => out.push(l), err: () => {} }); return { code, out: out.join("\n") }; };

  assert.ok(run("status").out.includes(JSON.stringify({ ...high, planRunner: "subagent" })), "worktree đọc khóa của repo chính");
  assert.equal(run("safe").code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(gatePath(wt), "utf8")), { mcpDeny: ["evil"] }, "mode full của repo chính không được chép sang file worktree chưa theo dõi");
  assert.equal(fs.readFileSync(gatePath(main), "utf8"), mainGate, "file repo chính không bị sửa");

  fs.rmSync(gatePath(wt));
  put(gatePath(main), "{ hỏng");
  for (const sub of ["high", "safe", "status"]) assert.equal(run(sub).code, 1, sub);
  assert.equal(fs.existsSync(gatePath(wt)), false, "không tạo file che repo chính hỏng");
});

// Request 2026-11-11-aip-gate-config-flow: aip mode và aip autonomy đọc qua gate-file.mjs.
const gitC = (cwd, ...a) => execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd, stdio: ["ignore", "pipe", "pipe"] });
const mainWithWt = (tag) => {
  const main = fs.realpathSync.native(tmp());
  put(path.join(main, "README.md"), "x");
  gitC(main, "add", "README.md");
  gitC(main, "commit", "-q", "-m", "init");
  const wt = path.join(path.dirname(main), `${path.basename(main)}-${tag}`);
  dirs.push(wt);
  gitC(main, "worktree", "add", "-q", wt, "-b", `gcf-${tag}`);
  return { main, wt };
};
const cmd = (fn, sub, root, extra = {}) => { const out = [], err = []; const code = fn(sub, { root, out: (l) => out.push(l), err: (l) => err.push(l), ...extra }); return { code, out: out.join("\n"), err: err.join("\n") }; };
const commitGate = (root, obj) => { put(gatePath(root), JSON.stringify(obj)); gitC(root, "add", ".claude/aip-gate.json"); gitC(root, "commit", "-q", "-m", "gate"); };

test("gate-config-flow AC4.1: file repo chính hỏng, worktree trống ⇒ aip mode và aip autonomy báo lỗi, exit 1, không ghi", () => {
  const { main, wt } = mainWithWt("main-bad");
  put(gatePath(main), "{ hỏng");
  for (const [fn, subs] of [[runMode, ["status", "full", "ask"]], [runAutonomy, ["status", "high", "safe"]]]) {
    for (const sub of subs) {
      const r = cmd(fn, sub, wt);
      assert.equal(r.code, 1, `${fn.name} ${sub}`);
      assert.ok(r.err.includes(gatePath(main)), `${fn.name} ${sub}: stderr nêu đường dẫn file hỏng (${r.err})`);
      assert.equal(fs.existsSync(gatePath(wt)) || fs.existsSync(setPath(wt)), false, `${fn.name} ${sub}: không ghi file nào`);
    }
  }
});

test("gate-config-flow AC4.2: status liệt kê khoá nới quyền bị bỏ qua kèm lý do", () => {
  const root = tmp();
  commitGate(root, { stopGate: false, allowEnvFiles: true, mcpDeny: ["x"] });
  for (const fn of [runMode, runAutonomy]) {
    const t = cmd(fn, "status", root).out;
    assert.match(t, /bị bỏ qua \(đang được git theo dõi\): .*stopGate/, `${fn.name}: ${t}`);
    assert.match(t, /bị bỏ qua.*allowEnvFiles/);
    assert.doesNotMatch(t.split("\n").find((l) => l.includes("bị bỏ qua")) ?? "", /mcpDeny/);
    assert.match(cmd(fn, "status", root, { run: () => null }).out, /bị bỏ qua \(không xác định được trạng thái git\): .*stopGate/);
  }
  const open = tmp();
  put(gatePath(open), JSON.stringify({ stopGate: false, allowEnvFiles: true }));
  for (const fn of [runMode, runAutonomy]) assert.doesNotMatch(cmd(fn, "status", open).out, /bị bỏ qua/, `${fn.name}: file không bị theo dõi`);
});

test("gate-config-flow AC4.3: status liệt kê khoá lạ và khoá sai kiểu", () => {
  const root = tmp();
  put(gatePath(root), JSON.stringify({ foo: 1, stopGate: "no" }));
  for (const fn of [runMode, runAutonomy]) {
    const t = cmd(fn, "status", root).out;
    assert.match(t, /Khoá lạ: "foo"/, `${fn.name}: ${t}`);
    assert.match(t, /Khoá sai kiểu: "stopGate" \(cần boolean\)/);
  }
  put(gatePath(root), JSON.stringify({ stopGate: true, mcpDeny: [] }));
  for (const fn of [runMode, runAutonomy]) assert.doesNotMatch(cmd(fn, "status", root).out, /Khoá lạ|Khoá sai kiểu/);
});

test("gate-config-flow AC4.5: không chép khoá nới quyền của file repo chính đã bị theo dõi sang file worktree", () => {
  const HIGH = { mergeLocal: true, cleanup: true, partRunner: "subagent" };
  const loose = { allowEnvFiles: true, stopGate: false, exemptAgents: ["x"], autonomy: { mergeLocal: true, planRunner: "inline" } };
  const read = (wt) => JSON.parse(fs.readFileSync(gatePath(wt), "utf8"));

  const t = mainWithWt("trk");
  commitGate(t.main, { ...loose, mode: "full", mcpDeny: ["evil"], foo: 1 });
  assert.equal(cmd(runMode, "full", t.wt).code, 0);
  assert.deepEqual(read(t.wt), { mode: "full", mcpDeny: ["evil"], foo: 1 });
  fs.rmSync(gatePath(t.wt));
  assert.equal(cmd(runAutonomy, "high", t.wt).code, 0);
  assert.deepEqual(read(t.wt), { mcpDeny: ["evil"], foo: 1, autonomy: HIGH });

  const u = mainWithWt("open");
  put(gatePath(u.main), JSON.stringify({ ...loose, mode: "full", mcpDeny: ["evil"] }));
  assert.equal(cmd(runMode, "ask", u.wt).code, 0);
  assert.deepEqual(read(u.wt), { ...loose, mcpDeny: ["evil"] });
  fs.rmSync(gatePath(u.wt));
  assert.equal(cmd(runAutonomy, "high", u.wt).code, 0);
  assert.deepEqual(read(u.wt), { ...loose, mcpDeny: ["evil"], autonomy: { ...HIGH, planRunner: "inline" } });
});

test("gate-config-flow: aip mode ask sinh lại settings giữ quy tắc .env khi allowEnvFiles nằm trong file đã bị theo dõi", () => {
  const root = tmp();
  commitGate(root, { allowEnvFiles: true, mode: "full" });
  put(setPath(root), EMPTY);
  assert.equal(cmd(runMode, "ask", root).code, 0);
  assert.equal(fs.readFileSync(setPath(root), "utf8"), gen(false));
});

test("gate-config-flow AC4.3: khoá lạ và khoá sai kiểu in qua JSON.stringify, không lọt ESC hay xuống dòng", () => {
  const root = tmp();
  const key = "x\u001b[31m\ny";
  put(gatePath(root), JSON.stringify({ [key]: 1 }));
  for (const fn of [runMode, runAutonomy]) {
    const t = cmd(fn, "status", root).out;
    const line = t.split("\n").find((l) => l.startsWith("Khoá lạ:")) ?? "";
    assert.ok(line.includes(JSON.stringify(key)) && !t.includes("\u001b"), fn.name + ": " + JSON.stringify(t));
  }
});

test("gate-config-flow AC4.2: status chỉ hiện mode đáng tin; gợi ý gỡ theo dõi nhắc xem lại từng khoá", () => {
  const root = tmp();
  commitGate(root, { mode: "full", autonomy: { mergeLocal: true } });
  const t = cmd(runMode, "status", root).out;
  assert.match(t, /Chế độ: ask/, t);
  assert.doesNotMatch(t, /Chế độ: full/);
  assert.match(t, /mode.*bỏ qua|bỏ qua.*mode/i);
  assert.match(cmd(runMode, "full", root).out, /xem lại/);
  assert.match(cmd(runAutonomy, "status", root).out, /xem lại/);
  assert.match(cmd(runAutonomy, "high", root).out, /xem lại/);
});

// Windows: junction không cần quyền admin; symlink file có thể bị từ chối (EPERM) nên ca đó bỏ qua khi không tạo được.
function linked(kind) {
  const root = tmp();
  const ext = tmpNoGit();
  put(path.join(ext, "aip-gate.json"), JSON.stringify({ mode: "full", autonomy: { mergeLocal: true } }));
  put(path.join(ext, "settings.json"), EMPTY);
  if (kind === "dir") fs.symlinkSync(ext, path.join(root, ".claude"), "junction");
  else {
    fs.mkdirSync(path.join(root, ".claude"));
    try { fs.symlinkSync(path.join(ext, "aip-gate.json"), gatePath(root), "file"); } catch (e) { if (e.code === "EPERM") return null; throw e; }
  }
  return { root, ext };
}
const snapshot = (d) => Object.fromEntries(fs.readdirSync(d).map((f) => [f, fs.readFileSync(path.join(d, f), "utf8")]));

test("gate-followups AC1.1: aip mode/autonomy từ chối ghi khi .claude hoặc aip-gate.json là symlink/junction", () => {
  for (const kind of ["dir", "file"]) {
    const l = linked(kind);
    if (!l) continue;
    const before = snapshot(l.ext);
    for (const [fn, sub] of [[runMode, "full"], [runMode, "ask"], [runAutonomy, "high"], [runAutonomy, "safe"]]) {
      const r = cmd(fn, sub, l.root);
      assert.equal(r.code, 1, `${kind} ${sub}: ${r.out}${r.err}`);
      assert.match(r.err, /symlink|junction/, `${kind} ${sub}`);
      assert.deepEqual(snapshot(l.ext), before, `${kind} ${sub}: file đích không đổi`);
    }
    assert.equal(cmd(runMode, "status", l.root).code, 0, `${kind}: status vẫn đọc được`);
  }
});
