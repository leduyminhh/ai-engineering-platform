import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "../cli/lib/init.mjs";
import { initDocFiles } from "../cli/lib/templates.mjs";
import { BEGIN, END, importsAgentsMd, extractBaselineBlock } from "../cli/lib/managed-block.mjs";
import { execFileSync } from "node:child_process";
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

// ── baseline-init (docs/requests/2026-11-04-project-baseline-init) ─────────────
const TEMPLATE = fs.readFileSync(path.join(REPO, "core/agents/AGENTS.template.md"), "utf8");
const BLOCK = extractBaselineBlock(TEMPLATE);
const OLD_BLOCK = `${BEGIN}\nbaseline cũ\n${END}`;
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const snapshot = (root) => Object.fromEntries(listFiles(root).sort().map((f) => [f, read(root, f)]));
// Windows không bật Developer Mode thì symlinkSync ném EPERM: bỏ ca thay vì đỏ vì môi trường.
const linkOrSkip = (t, target, link) => {
  try { fs.symlinkSync(target, link, "file"); return true; }
  catch (e) { if (e.code !== "EPERM") throw e; t.skip("không tạo được symlink trên máy này (EPERM)"); return false; }
};
const bucketOf = (r, f) => ["created", "refreshed", "unchanged", "skipped"].filter((k) => r[k].includes(f));

test("baseline-init AC1.1: init trên thư mục trống tạo AGENTS.md nguyên văn template + CLAUDE.md", () => {
  const root = tmp();
  const r = init({ root });
  assert.equal(read(root, "AGENTS.md"), TEMPLATE);
  assert.equal(read(root, "CLAUDE.md"), read(REPO, "templates/init-minimal/CLAUDE.md"));
  assert.deepEqual([...r.created].sort(), ["AGENTS.md", "CLAUDE.md"]);
  assert.deepEqual([r.refreshed, r.unchanged, r.skipped], [[], [], []]);
});

test("baseline-init AC1.2: AGENTS.md có khối cũ → thay vùng giữa marker, giữ nguyên ngoài marker", () => {
  const root = tmp();
  write(root, "AGENTS.md", `# Rule riêng\ntrên\n\n${OLD_BLOCK}\n\n## Dưới\nrule dưới\n`);
  write(root, "CLAUDE.md", "@AGENTS.md\n");
  const r = init({ root });
  assert.equal(read(root, "AGENTS.md"), `# Rule riêng\ntrên\n\n${BLOCK}\n\n## Dưới\nrule dưới\n`);
  assert.deepEqual(bucketOf(r, "AGENTS.md"), ["refreshed"]);
});

test("baseline-init AC1.3: chạy init lần hai không ghi AGENTS.md (kể cả file CRLF có khối bằng template)", () => {
  for (const eol of ["\n", "\r\n"]) {
    const root = tmp();
    const text = `# Riêng${eol}${eol}${BLOCK.replace(/\n/g, eol)}${eol}`;
    write(root, "AGENTS.md", text);
    write(root, "CLAUDE.md", "@AGENTS.md\n");
    const before = fs.statSync(path.join(root, "AGENTS.md")).mtimeMs;
    const r = init({ root });
    assert.equal(read(root, "AGENTS.md"), text, JSON.stringify(eol));
    assert.equal(fs.statSync(path.join(root, "AGENTS.md")).mtimeMs, before);
    assert.deepEqual(bucketOf(r, "AGENTS.md"), ["unchanged"]);
  }
});

test("baseline-init AC1.4: AGENTS.md không có marker → nối khối sau nội dung cũ", () => {
  const root = tmp();
  write(root, "AGENTS.md", "# Rule riêng\nchỉ của project\n");
  write(root, "CLAUDE.md", "@AGENTS.md\n");
  const r = init({ root });
  assert.equal(read(root, "AGENTS.md"), `# Rule riêng\nchỉ của project\n\n${BLOCK}\n`);
  assert.deepEqual(bucketOf(r, "AGENTS.md"), ["refreshed"]);
});

for (const [name, broken] of [["BEGIN không có END", `${BEGIN}\nx\n`], ["END trước BEGIN", `${END}\nx\n${BEGIN}\n`]]) {
  for (const full of [false, true]) {
    test(`baseline-init AC1.5: AGENTS.md marker hỏng (${name})${full ? " --full" : ""} → ném, không ghi file nào`, () => {
      const root = tmp();
      write(root, "AGENTS.md", broken);
      write(root, "CLAUDE.md", "# Rule cũ\n");
      const before = snapshot(root);
      assert.throws(() => init({ root, full }), /AGENTS\.md/);
      assert.deepEqual(snapshot(root), before);
    });
  }
}

// UTF-16LE có BOM (PowerShell 5 `>`) đọc bằng utf8 thành rác rồi bị ghi đè; init phải từ chối trước mọi ghi.
for (const bad of ["AGENTS.md", "CLAUDE.md"]) {
  test(`baseline-init AC1.5: ${bad} không phải UTF-8 (UTF-16LE) → ném nêu tên file, không ghi file nào`, () => {
    const root = tmp();
    write(root, "AGENTS.md", "# Rule cũ\n");
    write(root, "CLAUDE.md", "# Rule cũ\n");
    fs.writeFileSync(path.join(root, bad), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("# Rule cũ\r\n", "utf16le")]));
    const raw = (r) => Object.fromEntries(listFiles(r).sort().map((f) => [f, fs.readFileSync(path.join(r, f)).toString("hex")]));
    const before = raw(root);
    assert.throws(() => init({ root }), (e) => e.message.includes(bad) && /UTF-8/.test(e.message));
    assert.deepEqual(raw(root), before);
  });
}

for (const rel of ["AGENTS.md", "CLAUDE.md"]) {
  test(`baseline-init AC1.6: ${rel} là symlink → bỏ qua, file đích không đổi`, (t) => {
    const root = tmp();
    const outside = tmp();
    const target = path.join(outside, rel);
    fs.writeFileSync(target, `# đích\n${OLD_BLOCK}\n`);
    if (!linkOrSkip(t, target, path.join(root, rel))) return;
    const r = init({ root });
    assert.equal(fs.readFileSync(target, "utf8"), `# đích\n${OLD_BLOCK}\n`);
    assert.deepEqual(bucketOf(r, rel), ["skipped"]);
    assert.ok(r.warnings.some((w) => w.includes(rel)), r.warnings.join("\n"));
  });
}

test("baseline-init AC1.7: init --full vẫn giữ nguyên plan _TEMPLATE và settings.json đã có", () => {
  const root = tmp();
  write(root, "docs/requests/_TEMPLATE/plan.md", "# Plan cũ\n");
  write(root, ".claude/settings.json", "{}\n");
  const r = init({ root, full: true });
  assert.equal(read(root, "docs/requests/_TEMPLATE/plan.md"), "# Plan cũ\n");
  assert.equal(read(root, ".claude/settings.json"), "{}\n");
  assert.ok(r.skipped.includes("docs/requests/_TEMPLATE/plan.md") && r.skipped.includes(".claude/settings.json"));
});

for (const [name, bom, eol] of [["LF", "", "\n"], ["CRLF", "", "\r\n"], ["BOM", "﻿", "\n"]]) {
  test(`baseline-init AC2.1: CLAUDE.md có sẵn chưa import (${name}) → chèn @AGENTS.md ở đầu`, () => {
    const root = tmp();
    const old = `# Rule cũ${eol}dòng 2${eol}`;
    write(root, "CLAUDE.md", bom + old);
    const r = init({ root });
    const text = read(root, "CLAUDE.md");
    assert.ok(importsAgentsMd(text));
    assert.equal(text.replace(/^﻿/, "").split(/\r?\n/)[0], "@AGENTS.md");
    assert.ok(text.endsWith(old));
    assert.deepEqual(bucketOf(r, "CLAUDE.md"), ["refreshed"]);
    assert.ok(!r.warnings.some((w) => w.includes("chưa import")));
  });
}

test("baseline-init AC2.2: CLAUDE.md đã import, không có khối → không đổi byte", () => {
  const root = tmp();
  write(root, "CLAUDE.md", "@AGENTS.md\n# Rule cũ\n");
  const r = init({ root });
  assert.equal(read(root, "CLAUDE.md"), "@AGENTS.md\n# Rule cũ\n");
  assert.deepEqual(bucketOf(r, "CLAUDE.md"), ["unchanged"]);
});

for (const head of ["", "@AGENTS.md\n"]) {
  test(`baseline-init AC2.3: CLAUDE.md chứa khối baseline${head ? " (đã import)" : ""} → gỡ khối, baseline chỉ còn ở AGENTS.md`, () => {
    const root = tmp();
    write(root, "CLAUDE.md", `${head}# Trên\n\n${OLD_BLOCK}\n\n# Dưới\n`);
    const r = init({ root });
    const claude = read(root, "CLAUDE.md");
    assert.ok(importsAgentsMd(claude));
    assert.ok(claude.includes("# Trên") && claude.includes("# Dưới") && !claude.includes("baseline cũ"));
    assert.ok(read(root, "AGENTS.md").includes(BLOCK));
    assert.equal((read(root, "AGENTS.md") + claude).split(BEGIN).length - 1, 1);
    assert.deepEqual(bucketOf(r, "CLAUDE.md"), ["refreshed"]);
  });
}

test("baseline-init AC2.4: AGENTS.md là symlink → CLAUDE.md giữ nguyên, có cảnh báo", (t) => {
  const root = tmp();
  const target = path.join(tmp(), "AGENTS.md");
  fs.writeFileSync(target, OLD_BLOCK);
  if (!linkOrSkip(t, target, path.join(root, "AGENTS.md"))) return;
  const claude = `# Trên\n${OLD_BLOCK}\n`;
  write(root, "CLAUDE.md", claude);
  const r = init({ root });
  assert.equal(read(root, "CLAUDE.md"), claude);
  assert.ok(r.warnings.some((w) => w.includes("CLAUDE.md") && w.includes("AGENTS.md") && /symlink|junction/.test(w)), r.warnings.join("\n"));
});

test("baseline-init AC5.1: mỗi file nằm đúng một nhóm created/refreshed/unchanged/skipped", () => {
  const root = tmp();
  write(root, "AGENTS.md", OLD_BLOCK);
  write(root, "CLAUDE.md", "# chưa import\n");
  write(root, "README.md", "# có sẵn\n");
  const r = init({ root, full: true });
  assert.deepEqual(bucketOf(r, "AGENTS.md"), ["refreshed"]);
  assert.deepEqual(bucketOf(r, "CLAUDE.md"), ["refreshed"]);
  assert.deepEqual(bucketOf(r, "README.md"), ["skipped"]);
  const all = [...r.created, ...r.refreshed, ...r.unchanged, ...r.skipped];
  assert.equal(new Set(all).size, all.length);
});

test("baseline-init AC5.2: aip init in dòng làm mới AGENTS.md", () => {
  const root = tmp();
  write(root, "AGENTS.md", OLD_BLOCK);
  const out = execFileSync(process.execPath, [path.join(REPO, "cli/index.mjs"), "init"], { cwd: root, encoding: "utf8", env: { ...process.env, AIE_INSTALL_ROOT: root } });
  assert.match(out, /^\s*~ AGENTS\.md/m);
  assert.match(out, /marker/);
});

test("AC1.2: init --full sinh .claude/settings.json: deny = nhóm secrets, ask = ba nhóm còn lại", () => {
  const root = tmp();
  init({ root, full: true });
  const { groups } = loadPolicy();
  const { permissions } = JSON.parse(read(root, ".claude/settings.json"));
  assert.deepEqual(permissions.deny, groups.secrets.rules);
  assert.deepEqual(permissions.ask, [...groups.git_push.rules, ...groups.network.rules, ...groups.production_deploy.rules]);
});

const GATE_CASES = [
  ['true', '{"allowEnvFiles": true}', true],
  ['true có BOM', '﻿{"allowEnvFiles": true}', true],
  ['chuỗi "true"', '{"allowEnvFiles": "true"}', false],
  ['false', '{"allowEnvFiles": false}', false],
  ['số 1', '{"allowEnvFiles": 1}', false],
  ['JSON hỏng', '{allowEnvFiles: ', false],
  ['thiếu file', null, false],
];
for (const [name, content, omit] of GATE_CASES) {
  test(`AC1.4: init --full với aip-gate.json allowEnvFiles ${name} → ${omit ? "bỏ" : "giữ"} quy tắc .env`, () => {
    const root = tmp();
    const gate = path.join(root, ".claude", "aip-gate.json");
    if (content != null) { fs.mkdirSync(path.dirname(gate), { recursive: true }); fs.writeFileSync(gate, content); }
    init({ root, full: true });
    const { groups } = loadPolicy();
    const { permissions } = JSON.parse(read(root, ".claude/settings.json"));
    assert.deepEqual(permissions.deny, omit ? [] : groups.secrets.rules);
    assert.deepEqual(permissions.ask, [...groups.git_push.rules, ...groups.network.rules, ...groups.production_deploy.rules]);
    if (content != null) assert.equal(fs.readFileSync(gate, "utf8"), content);
    else assert.ok(!fs.existsSync(gate));
  });
}

test("AC1.3: init --full không đọc/sửa .claude/settings.json đã có (JSON hợp lệ hoặc chuỗi rác)", () => {
  for (const old of ['{"permissions":{"allow":["Bash(ls *)"]}}\n', "không phải json {{{"]) {
    const root = tmp();
    fs.mkdirSync(path.join(root, ".claude"), { recursive: true });
    fs.writeFileSync(path.join(root, ".claude/settings.json"), old);
    const r = init({ root, full: true });
    assert.equal(read(root, ".claude/settings.json"), old);
    assert.ok(r.skipped.includes(".claude/settings.json"));
    assert.ok(!r.created.includes(".claude/settings.json"));
    assert.ok(r.warnings.some((w) => w.includes(".claude/settings.json") && w.includes("core/permissions/policy.json")));
  }
});

test("AC1.3: init --full tạo mới .claude/settings.json thì không cảnh báo chính sách", () => {
  const root = tmp();
  const r = init({ root, full: true });
  assert.ok(r.created.includes(".claude/settings.json"));
  assert.ok(!r.warnings.some((w) => w.includes("policy.json")));
});

// Workflow CI mẫu chỉ là tài liệu để người dùng tự chép; init chạm .github/ sẽ âm thầm bật CI review trên repo đích.
for (const full of [false, true]) {
  test(`P6a AC1.1: init${full ? " --full" : ""} không tạo file nào dưới .github/ và không sao chép templates/ci`, () => {
    const root = tmp();
    const r = init({ root, full });
    assert.ok(r.created.every((f) => !f.startsWith(".github/") && !f.includes("claude-review")));
    assert.ok(!fs.existsSync(path.join(root, ".github")));
  });
}

test("init rồi install claude core: baseline nằm ở AGENTS.md đúng 1 lần, không chép vào CLAUDE.md", async () => {
  const root = tmp();
  init({ root });
  process.env.AIE_INSTALL_ROOT = root;
  const { install } = await import("../cli/lib/install.mjs");
  install({ providers: "claude", plugins: "core", scope: "project" });
  assert.equal(read(root, "AGENTS.md").split(BEGIN).length - 1, 1);
  assert.ok(!read(root, "CLAUDE.md").includes(BEGIN));
});
