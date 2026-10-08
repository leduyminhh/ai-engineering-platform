# Standards Phase 0 — sửa gấp lỗi đang xảy ra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ 4 lỗi/rủi ro đang có thật trên máy dev — frontmatter build không phải YAML hợp lệ, plugin `workflows` không load vì hard-dependency, version không bump khi nội dung đổi (cache Claude giữ bản cũ), CI không kiểm hợp đồng Claude Code — và sửa chuỗi mô tả `*-principles` còn ghi "pipeline bắt buộc".

**Architecture:** Năm thay đổi nhỏ, độc lập, trên engine hiện có: (1) emitter frontmatter quote có điều kiện + hàm kiểm YAML an toàn dùng cho mọi build; (2) `workflows/.manifest.json` khai báo `hardDependencies` tường minh, plugin còn lại ghi vào preamble từng workflow; (3) sửa chuỗi mô tả principles ở 2 adapter; (4) CI matrix Windows + `claude plugin validate --strict`; (5) `core/.manifest.json`, lock `plugins/_versions.lock.json` (hash build ↔ version) với cổng bump khi lock, contract semver/đồng bộ version thay 5 assert ghim, `aip check` đối chiếu version đã cài. Thứ tự task đã xếp để **task cuối** mới tạo lock (sau khi mọi thay đổi output đã xong).

**Tech Stack:** Node ≥ 20 ESM zero-dep; test bằng `node test/validate.mjs` (`ok(cond,msg)`); `claude` CLI 2.1.285 (có trên PATH máy dev); GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-07-platform-standards-audit-design.md` (§3.1 E1, E5, E6; §3.2 S3; §3.4 T1, T4; §5 Phase 0)

## Global Constraints

- UTF-8 **không BOM**, LF cho mọi file nguồn; nội dung/thông điệp tiếng Việt có dấu; comment code tiếng Việt, chỉ giải thích *vì sao*.
- **KHÔNG sửa** `package.json`, `pack.config.json` (file packaging của chủ dự án). Script mới gọi trực tiếp `node cli/lib/<file>.mjs`.
- Không đổi hành vi với provider khác ngoài việc quote YAML (Cursor `.mdc` description, Codex SKILL.md) — Antigravity không phát frontmatter.
- Mọi assert cũ trong `test/validate.mjs` phải còn xanh trừ 5 assert ghim version được thay có chủ đích ở Task 5 (tìm theo nội dung; tại `692a40c` ở khoảng dòng 1316, 1470, 1614, 1789 và pin engineering `mf.version === '1.4.0'` trong khối 29d).
- Semver: `version` khớp `^\d+\.\d+\.\d+$`; bump PATCH cho mọi plugin ở Task 5 (output đổi do Task 1): core `1.1.1→1.1.2`, backend `1.5.0→1.5.1`, frontend `1.7.0→1.7.1`, engineering `1.4.0→1.4.1`, ops `1.2.0→1.2.1`, data `1.3.0→1.3.1`; `workflows` `1.0.0→1.1.0` ở Task 2 (đổi dependency).
- Commit qua `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt (Changed/Reason), `git commit -F <file>` sau khi chạy `test-commit-message-encoding.ps1`; **KHÔNG** thêm `Co-authored-by` / `Co-Authored-By`. Branch: `chore/standards-phase0` (rebase lên `master 0e6a103`; spec `692a40c`).
- Trước mỗi lần `node test/validate.mjs`: chạy `npm run build` (assert build đọc `build/`). Không chạy 2 lượt test song song (cùng ghi `build/`).
- Trên Windows không `rm -rf` thư mục có junction; dọn bằng Node `fs.rmSync`.

## Review Focus

- Mô tả bắt đầu bằng ký tự YAML đặc biệt (`[`, `{`, `>`, `|`, `*`, `&`, `!`, `%`, `@`, `` ` ``, `-`/`?`/`:` + space) hoặc chứa `: ` ở giữa → phải được quote; mô tả thuần chữ (kể cả có `, `) → giữ plain; test ở Task 1 (unit `yamlScalar` + quét build 3 provider).
- Mô tả có dấu `"` hoặc `\` bên trong → quote kiểu JSON phải escape đúng và `checkFrontmatterYaml` chấp nhận; test ở Task 1.
- Build với `--plugin` lọc bớt plugin (vd thiếu `data`) → `dependencies` của `workflows` chỉ gồm hard-dep **có mặt**, không treo; test ở Task 2 (fixture adapter).
- Workflow dùng plugin ngoài hard-dep (db-change → `data`; incident/release → `ops`) → preamble có dòng "Plugin cần có"; workflow không dùng plugin ngoài → không có dòng đó; test ở Task 2.
- Lock: output đổi mà version không đổi → `node cli/lib/versions.mjs --lock` **từ chối** (exit 1, nêu plugin); lock không khớp build → validate đỏ; test ở Task 5 (hàm thuần với fixture, không ghi lock thật).

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `cli/lib/write.mjs` | `yamlScalar()` + `frontmatter()` quote có điều kiện | 1 |
| `cli/lib/conventions.mjs` | `checkFrontmatterYaml(fmText)` (thuần) | 1 |
| `adapters/cursor/adapter.mjs` | `mdc()` quote description | 1 |
| `workflows/.manifest.json` | `hardDependencies`, version 1.1.0 | 2 |
| `adapters/claude/adapter.mjs` | `workflowFiles()` dùng hardDependencies; chuỗi principles (Task 3) | 2, 3 |
| `adapters/_shared/agents.mjs` | `workflowPreamble()` thêm dòng "Plugin cần có" | 2 |
| `adapters/codex/adapter.mjs` | chuỗi principles | 3 |
| `.github/workflows/ci.yml`, `release.yml` | matrix, strict validate, permissions, gh release | 4 |
| `core/.manifest.json` (mới) | id/name/description/version của core | 5 |
| `cli/lib/plugins.mjs` | `loadCore()` đọc manifest | 5 |
| `cli/lib/versions.mjs` (mới) | hash build, lock, cổng bump, CLI `--lock`/`--check` | 5 |
| `plugins/_versions.lock.json` (mới, sinh) | `{id: {version, hash}}` | 5 |
| `cli/lib/install.mjs`, `cli/index.mjs` | `check()` đối chiếu `claude plugin list`; in cảnh báo lệch | 5 |
| `plugins/*/.manifest.json` | bump PATCH | 5 |
| `CLAUDE.md` | ghi lệnh lock + quy tắc bump | 5 |
| `test/validate.mjs` | khối 31 (Task 1), 32 (Task 2), 33 (Task 3), 34 (Task 5); sửa 5 pin + L419/L424 (Task 5) | 1–5 |

**Vị trí chèn khối assert mới:** ngay TRƯỚC 2 dòng cuối `test/validate.mjs`:

```js
// ─────────────────────────────────────────────────────────────────────────────
console.log('');
```

Biến có sẵn: `fs`, `path`, `REPO_ROOT`, `PLUGINS_DIR`, `CORE_DIR`, `BUILD`, `ok`, `fails`, `plugins`, `core`, `workflows`, `allAgents`, `listFilesRec`, `claudeAdapter`, `codexAdapter`, `fxPlugin`, `fxCore`, `fxMk`, `fxWorkflows`, `byPath`.

---

### Task 1: Frontmatter YAML an toàn (quote có điều kiện)

**Files:**
- Modify: `cli/lib/write.mjs` (hàm `frontmatter`, thêm `yamlScalar`)
- Modify: `cli/lib/conventions.mjs` (thêm `checkFrontmatterYaml`)
- Modify: `adapters/cursor/adapter.mjs` (`mdc()`)
- Modify: `test/validate.mjs` (import `checkFrontmatterYaml`; khối 31)

**Interfaces:**
- Produces: `yamlScalar(v: string) → string` (export từ `write.mjs`); `checkFrontmatterYaml(fmText: string) → string[]` (export từ `conventions.mjs`, lỗi rỗng = hợp lệ). Task 5 dùng `checkFrontmatterYaml` không đổi.

- [ ] **Step 1: Viết test đỏ (khối 31)**

Sửa dòng import `conventions.mjs` ở đầu `test/validate.mjs` thành:

```js
import { checkSkillBody, checkDescription, notForTargets, quotedPhrases, triggerCollisions, checkFrontmatterYaml } from '../cli/lib/conventions.mjs';
```

và thêm sau dòng `import { agentsFiles, whenToUse, WHEN_TO_USE_MAX } from '../adapters/_shared/lib.mjs';`:

```js
import { frontmatter, yamlScalar } from '../cli/lib/write.mjs';
```

Chèn khối:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 31. Frontmatter build là YAML an toàn (spec 2026-10-07 audit E1 / Phase 0 P0.1)
// ─────────────────────────────────────────────────────────────────────────────
{
  ok(yamlScalar('backend-adr') === 'backend-adr', 'yamlScalar: chuỗi thuần giữ plain');
  ok(yamlScalar('Edit, Write, NotebookEdit, Agent') === 'Edit, Write, NotebookEdit, Agent', 'yamlScalar: dấu phẩy không cần quote');
  ok(yamlScalar('Recipe on-demand: review') === '"Recipe on-demand: review"', 'yamlScalar: ": " giữa chuỗi → quote');
  ok(yamlScalar('PR #12') === '"PR #12"', 'yamlScalar: " #" → quote');
  ok(yamlScalar('[a] b') === '"[a] b"' && yamlScalar('- x') === '"- x"' && yamlScalar('*.ts') === '"*.ts"',
    'yamlScalar: ký tự mở cấu trúc ở đầu → quote');
  ok(yamlScalar('nói "skill"') === '"nói \\"skill\\""', 'yamlScalar: dấu " bên trong được escape');
  ok(yamlScalar('') === '""' && yamlScalar('a ') === '"a "', 'yamlScalar: rỗng / khoảng trắng cuối → quote');
  ok(frontmatter([['name', 'x'], ['description', 'A: b'], ['effort', 'high'], ['skip', null]])
    === '---\nname: x\ndescription: "A: b"\neffort: high\n---', 'frontmatter: quote đúng key cần quote, bỏ key null');
  ok(checkFrontmatterYaml('name: x\ndescription: "A: b"').length === 0, 'checkFrontmatterYaml: hợp lệ');
  ok(checkFrontmatterYaml('description: A: b').some((e) => e.includes('plain scalar')), 'checkFrontmatterYaml: ": " không quote → lỗi');
  ok(checkFrontmatterYaml('description: "chưa đóng').some((e) => e.includes('quote')), 'checkFrontmatterYaml: quote không đóng → lỗi');
  ok(checkFrontmatterYaml('description: "có \\"escape\\" đúng"').length === 0, 'checkFrontmatterYaml: escape \\" hợp lệ');
  ok(checkFrontmatterYaml('- item').length === 1, 'checkFrontmatterYaml: dòng không phải key: value → lỗi');
  const fmOf31 = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---/); return m ? m[1] : null; };
  const targets31 = [
    ['claude', path.join(BUILD, 'claude'), (f) => f.endsWith('.md')],
    ['codex', path.join(BUILD, 'codex'), (f) => f.endsWith('SKILL.md')],
    ['cursor', path.join(BUILD, 'cursor'), (f) => f.endsWith('SKILL.md') || f.endsWith('.mdc')],
  ];
  for (const [prov, dir, pick] of targets31) {
    if (!fs.existsSync(dir)) continue;
    const bad = [];
    let seen = 0;
    for (const rel of listFilesRec(dir).filter(pick)) {
      const fm = fmOf31(fs.readFileSync(path.join(dir, rel), 'utf8'));
      if (fm === null) continue;
      seen++;
      const errs = checkFrontmatterYaml(fm);
      if (errs.length) bad.push(`${rel}: ${errs[0]}`);
    }
    ok(seen > 0 && bad.length === 0, `build ${prov}: ${seen} frontmatter đều là YAML an toàn${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`);
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npm run build && node test/validate.mjs`
Expected: lỗi import (`yamlScalar`/`checkFrontmatterYaml` chưa tồn tại → `SyntaxError: The requested module … does not provide an export named …`). Đây là trạng thái đỏ hợp lệ của bước này.

- [ ] **Step 3: Sửa `cli/lib/write.mjs`**

Thay toàn bộ hàm `frontmatter` (từ comment `/** Emit a YAML frontmatter block …` tới hết hàm) bằng:

```js
// Plain scalar chỉ an toàn khi không mở đầu bằng ký tự cấu trúc YAML và không chứa ": " / " #";
// mô tả tiếng Việt thường có ": " nên phải quote, nếu không parser chặt báo "mapping values are not allowed here".
const PLAIN_UNSAFE = /^[\s"'#&*!|>%@`\[\]{},?:-]|:\s|\s#|\s$|[\n\r\t]/;

/** Chuỗi YAML an toàn: plain khi vô hại, ngược lại double-quoted kiểu JSON (YAML 1.2 chấp nhận). */
export function yamlScalar(v) {
  const s = String(v);
  return s === '' || PLAIN_UNSAFE.test(s) ? JSON.stringify(s) : s;
}

/** Emit a YAML frontmatter block from an ordered list of [key, value] pairs. */
export function frontmatter(pairs) {
  const lines = ['---'];
  for (const [k, v] of pairs) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'boolean' || typeof v === 'number') lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${yamlScalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}
```

- [ ] **Step 4: Thêm `checkFrontmatterYaml` vào `cli/lib/conventions.mjs`**

Chèn cuối file:

```js
// Kiểm frontmatter ĐÃ PHÁT: value chứa ": ", " #" hoặc mở đầu bằng ký tự cấu trúc phải nằm trong ngoặc kép.
// Chỉ nhận dạng `key: value` một dòng — đúng tập con mà frontmatter() phát ra hiện nay.
const PLAIN_UNSAFE_VALUE = /^[\s"'#&*!|>%@`\[\]{},?:-]|:\s|\s#|\s$/;
const QUOTED = /^"(?:[^"\\]|\\.)*"$/;

export function checkFrontmatterYaml(fmText) {
  const errs = [];
  for (const line of fmText.split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z][\w-]*):(?:\s(.*))?$/);
    if (!m) { errs.push(`dòng không phải "key: value": ${line.slice(0, 40)}`); continue; }
    const v = m[2] ?? '';
    if (v.startsWith('"')) { if (!QUOTED.test(v)) errs.push(`${m[1]}: chuỗi quote không đóng hoặc escape sai`); continue; }
    if (PLAIN_UNSAFE_VALUE.test(v)) errs.push(`${m[1]}: plain scalar không an toàn ("${v.slice(0, 30)}")`);
  }
  return errs;
}
```

- [ ] **Step 5: Sửa `adapters/cursor/adapter.mjs`**

Dòng import: `import { fullPrinciples, skillFiles } from '../_shared/lib.mjs';` → thêm dòng ngay dưới:

```js
import { yamlScalar } from '../../cli/lib/write.mjs';
```

Trong `mdc()`: `if (description) fm.push(\`description: ${description}\`);` → `if (description) fm.push(\`description: ${yamlScalar(description)}\`);`

- [ ] **Step 6: Chạy test, xác nhận xanh**

Run: `npm run build && node test/validate.mjs`
Expected: `0 fail`; 3 assert `build <prov>: N frontmatter đều là YAML an toàn` PASS (claude ≈ 73, codex ≈ 55, cursor ≈ 41). Các assert cũ dạng `/^description: .*oracle/m` vẫn PASS vì `.*` nuốt dấu `"`.

- [ ] **Step 7: Kiểm chéo bằng PyYAML (bằng chứng, không phải test)**

Run (Git Bash; `py` là Python 3.13 có PyYAML):

```bash
py - <<'EOF'
import re,glob,yaml
bad=0;tot=0
for f in glob.glob('build/claude/plugins/*/skills/*/SKILL.md')+glob.glob('build/claude/plugins/*/agents/*.md')+glob.glob('build/codex/*/skills/*/SKILL.md')+glob.glob('build/cursor/*/.cursor/skills/*/SKILL.md')+glob.glob('build/cursor/*/.cursor/rules/*.mdc'):
    s=open(f,encoding='utf-8').read(); m=re.match(r'^---\n(.*?)\n---',s,re.S); tot+=1
    try: yaml.safe_load(m.group(1))
    except Exception as e: bad+=1; print('FAIL',f)
print('yaml ok',tot-bad,'/',tot)
EOF
```

Expected: `yaml ok N / N` (0 FAIL). Ghi kết quả vào report.

- [ ] **Step 8: `npm test` toàn bộ**

Run: `npm test`
Expected: exit 0 (install/wizard/managed-block/pack-guard/args không đụng frontmatter).

- [ ] **Step 9: Commit qua `core:git-workflow`**

Stage: `cli/lib/write.mjs`, `cli/lib/conventions.mjs`, `adapters/cursor/adapter.mjs`, `test/validate.mjs`.

```
fix(adapters): quote YAML frontmatter values that are unsafe as plain scalars

Changed:
- write.mjs: thêm yamlScalar, frontmatter() quote kiểu JSON khi value chứa ": ", " #", mở đầu bằng ký tự cấu trúc YAML hoặc rỗng; chuỗi thuần giữ plain
- conventions.mjs: thêm checkFrontmatterYaml kiểm frontmatter đã phát
- cursor adapter: description của .mdc đi qua yamlScalar
- validate khối 31: unit yamlScalar/frontmatter/checkFrontmatterYaml + quét frontmatter build claude/codex/cursor

Reason:
- 58/73 file build claude (và phần lớn codex/cursor) không parse được bằng YAML chặt vì description có ": "; Claude Code dung thứ nhưng parser khác thì không
```

---

### Task 2: `workflows` chỉ hard-depend plugin bắt buộc chung

**Files:**
- Modify: `workflows/.manifest.json`
- Modify: `adapters/claude/adapter.mjs` (`workflowFiles`)
- Modify: `adapters/_shared/agents.mjs` (`workflowPreamble`)
- Modify: `test/validate.mjs` (khối 32; sửa assert `pj.dependencies[0] === 'core'` trong B3)

**Interfaces:**
- Consumes: `loadWorkflows()` đã trả `manifest` (xác nhận tại `cli/lib/plugins.mjs`, return object có `manifest`).
- Produces: `workflowPreamble(wf, agentsById, provider, { hardDeps })` — tham số thứ 4 tuỳ chọn; `workflowFiles` tính `softDeps(wf)` = plugin của `agents`/`requires` ∉ hardDeps.

- [ ] **Step 1: Viết test đỏ (khối 32 + sửa B3)**

Trong B3, thay dòng:

```js
    ok(pj.dependencies[0] === 'core', 'build claude workflows: depends on core');
```

bằng:

```js
    const hard32 = ['core', ...(workflows.manifest.hardDependencies || []).filter((d) => d !== 'core')];
    const mkNames32 = new Set(mk.plugins.map((x) => x.name));
    ok(JSON.stringify(pj.dependencies) === JSON.stringify(hard32.filter((d) => mkNames32.has(d))),
      `build claude workflows: dependencies = hardDependencies có mặt trong marketplace (${pj.dependencies.join(',')})`);
    ok(pj.dependencies.every((d) => mkNames32.has(d)), 'build claude workflows: mọi dependency là entry marketplace');
```

Chèn khối 32:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 32. workflows: hard-dependency tường minh + plugin còn lại ghi trong preamble (spec 2026-10-07 audit E6 / P0.2)
// ─────────────────────────────────────────────────────────────────────────────
{
  if (workflows) {
    const hard = workflows.manifest.hardDependencies;
    ok(Array.isArray(hard) && hard.includes('core') && hard.length < plugins.length + 1,
      'workflows manifest: hardDependencies tường minh, có core, không bao trùm mọi plugin');
    ok(/^\d+\.\d+\.\d+$/.test(workflows.version) && workflows.version !== '1.0.0', 'workflows manifest: version đã bump khỏi 1.0.0');
    const pluginOfAgent = new Map(allAgents.map((a) => [a.id, a.plugin]));
    for (const wf of workflows.stages) {
      const need = new Set([...wf.requires.map((r) => r.split('/')[0]), ...wf.agents.map((a) => pluginOfAgent.get(a)).filter(Boolean)]);
      const soft = [...need].filter((p) => !hard.includes(p)).sort();
      const built = path.join(BUILD, 'claude', 'plugins', 'workflows', 'skills', wf.id, 'SKILL.md');
      const c = fs.existsSync(built) ? fs.readFileSync(built, 'utf8') : '';
      if (soft.length) {
        ok(c.includes(`> **Plugin cần có:** ${soft.map((p) => `\`${p}\``).join(', ')}`),
          `${wf.id}: preamble nêu plugin ngoài hard-dep (${soft.join(',')})`);
      } else {
        ok(!c.includes('**Plugin cần có:**'), `${wf.id}: không có plugin ngoài hard-dep → không có dòng "Plugin cần có"`);
      }
    }
  }
  // Fixture: hardDependencies lọc theo plugin có mặt; thiếu hardDependencies → giữ hành vi cũ (union).
  const fxWfHard = { ...fxWorkflows, manifest: { hardDependencies: ['core', 'fx', 'absent-plugin'] } };
  const outH = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore, workflows: fxWfHard }));
  const pjH = JSON.parse(outH.get('plugins/workflows/.claude-plugin/plugin.json').content);
  ok(JSON.stringify(pjH.dependencies) === '["core","fx"]', 'claude workflows: hardDependencies lọc plugin vắng mặt');
  const fxWfSoft = { ...fxWorkflows, manifest: { hardDependencies: ['core'] } };
  const outS = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore, workflows: fxWfSoft }));
  ok(JSON.parse(outS.get('plugins/workflows/.claude-plugin/plugin.json').content).dependencies.length === 1
    && outS.get('plugins/workflows/skills/workflow-demo/SKILL.md').content.includes('> **Plugin cần có:** `fx`'),
    'claude workflows: plugin ngoài hard-dep → không vào dependencies, có dòng Plugin cần có');
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL `workflows manifest: hardDependencies tường minh…`, `version đã bump`, B3 `dependencies = hardDependencies…` (hiện là 6 dependency), 3 assert `preamble nêu plugin ngoài hard-dep` (db-change, incident, release), 2 assert fixture.

- [ ] **Step 3: Sửa `workflows/.manifest.json`**

```json
{
  "id": "workflows",
  "name": "Engineering Workflows",
  "description": "Bộ 12 workflow kỹ thuật (feature, bugfix, refactor, code review, testing, security review, db change, API, performance, incident, release, docs) + orchestrator chọn workflow theo yêu cầu. Workflow điều phối agent/skill của nhiều plugin qua các bước có gate, evidence và checkpoint người duyệt. Plugin bắt buộc: core, backend, frontend, engineering; db-change cần thêm data, incident/release cần thêm ops (ghi ở preamble từng workflow).",
  "version": "1.1.0",
  "hardDependencies": ["core", "backend", "frontend", "engineering"]
}
```

- [ ] **Step 4: Sửa `adapters/claude/adapter.mjs` `workflowFiles`**

Thay toàn bộ hàm `workflowFiles` bằng:

```js
// Plugin `workflows` gọi xuyên nhiều plugin. Claude coi `dependencies` là "phải enabled" nên chỉ khai
// báo hard-dependency tường minh từ manifest (thiếu một plugin lẻ như `data` không được làm hỏng cả bộ);
// plugin còn lại được nêu trong preamble từng workflow. Không có hardDependencies → union như trước.
function workflowFiles(wfs, plugins, author) {
  const agentsById = new Map(plugins.flatMap((p) => p.agents || []).map((a) => [a.id, a]));
  const present = new Set(plugins.map((p) => p.id));
  const pluginsOf = (wf) => {
    const s = new Set();
    for (const r of wf.requires) s.add(r.split('/')[0]);
    for (const id of wf.agents) { const a = agentsById.get(id); if (a) s.add(a.plugin); }
    return s;
  };
  const hard = (wfs.manifest && wfs.manifest.hardDependencies) || null;
  const deps = hard ? new Set(hard) : new Set(wfs.stages.flatMap((wf) => [...pluginsOf(wf)]));
  const dependencies = ['core', ...[...deps].filter((d) => d !== 'core' && present.has(d)).sort()];
  const files = [{ path: 'plugins/workflows/.claude-plugin/plugin.json', content: pluginJson(wfs, { dependencies, author }) }];
  for (const wf of wfs.stages) {
    const soft = hard ? [...pluginsOf(wf)].filter((p) => !hard.includes(p)).sort() : [];
    files.push(...skillFiles(wf, 'plugins/workflows/skills', workflowPreamble(wf, agentsById, 'claude', { softDeps: soft })));
  }
  return files;
}
```

- [ ] **Step 5: Sửa `adapters/_shared/agents.mjs` `workflowPreamble`**

Chữ ký: `export function workflowPreamble(wf, agentsById, provider) {` → `export function workflowPreamble(wf, agentsById, provider, { softDeps = [] } = {}) {`

Trong nhánh `if (provider === 'claude') {`, ngay sau dòng `L.push('> **Đọc trước** nguyên tắc nền tảng — skill \`principles\` (bản cài dạng plugin: \`core:principles\`).');` thêm:

```js
    if (softDeps.length) {
      L.push(`> **Plugin cần có:** ${softDeps.map((p) => `\`${p}\``).join(', ')} (không nằm trong dependency của plugin workflows — cài thêm trước khi chạy).`);
    }
```

- [ ] **Step 6: Chạy test, xác nhận xanh**

Run: `npm run build && node test/validate.mjs`
Expected: `0 fail`. Kiểm thêm: `cat build/claude/plugins/workflows/.claude-plugin/plugin.json` có `dependencies: ["core","backend","engineering","frontend"]`; `grep -l "Plugin cần có" build/claude/plugins/workflows/skills/*/SKILL.md` ra đúng 3 file (db-change, incident, release).

- [ ] **Step 7: Kiểm bằng CLI thật**

Run: `claude plugin validate --strict build/claude/plugins/workflows`
Expected: `Validation passed`.

- [ ] **Step 8: `npm test`** → exit 0.

- [ ] **Step 9: Commit qua `core:git-workflow`**

Stage: `workflows/.manifest.json`, `adapters/claude/adapter.mjs`, `adapters/_shared/agents.mjs`, `test/validate.mjs`.

```
fix(workflows): declare hard dependencies explicitly so one missing plugin cannot break the set

Changed:
- workflows/.manifest.json: hardDependencies = core, backend, frontend, engineering; version 1.1.0; mô tả nêu plugin cần thêm theo workflow
- adapter claude: dependencies của plugin workflows lấy từ hardDependencies (lọc plugin có mặt); plugin ngoài hard-dep ghi vào preamble "Plugin cần có" của từng workflow
- validate: B3 kiểm dependencies khớp hardDependencies ⊂ marketplace; khối 32 kiểm preamble db-change/incident/release + fixture adapter

Reason:
- Trên máy dev plugin workflows failed to load vì thiếu data, dù data chỉ cần cho 1/12 workflow
```

---

### Task 3: Sửa chuỗi mô tả `*-principles` (2 adapter)

**Files:**
- Modify: `adapters/claude/adapter.mjs` (`pluginPrinciplesFiles`)
- Modify: `adapters/codex/adapter.mjs` (`pluginPrinciplesSkill`)
- Modify: `test/validate.mjs` (khối 33)

**Interfaces:** không có.

- [ ] **Step 1: Viết test đỏ (khối 33)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 33. Mô tả skill <plugin>-principles không còn "pipeline bắt buộc", có tình huống dùng (spec 2026-10-07 audit S3 / P0.5)
// ─────────────────────────────────────────────────────────────────────────────
{
  for (const p of plugins) {
    if (!(p.shared.principles && p.shared.principles.trim())) continue;
    for (const [prov, rel] of [['claude', path.join('claude', 'plugins', p.id, 'skills', `${p.id}-principles`, 'SKILL.md')],
      ['codex', path.join('codex', p.id, 'skills', `${p.id}-principles`, 'SKILL.md')]]) {
      const f = path.join(BUILD, rel);
      const c = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      ok(c && !c.includes('pipeline bắt buộc') && /^description: .*Dùng khi/m.test(c),
        `build ${prov} ${p.id}-principles: mô tả không nhắc pipeline bắt buộc, có "Dùng khi"`);
    }
  }
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL 10 assert (5 plugin có principles × 2 provider).

- [ ] **Step 3: Sửa chuỗi ở 2 adapter**

`adapters/claude/adapter.mjs` trong `pluginPrinciplesFiles`, thay 3 dòng `const description = …;` bằng:

```js
  const description =
    `Nguyên tắc riêng của plugin ${p.id} (phân tầng, ranh giới an toàn, nguồn sự thật đặc thù), ` +
    `bổ sung cho skill core principles. Dùng khi bắt đầu bất kỳ skill ${p.id}-* nào hoặc trước khi ` +
    `quyết định điều gì chạm ranh giới an toàn của plugin ${p.id}.`;
```

`adapters/codex/adapter.mjs` trong `pluginPrinciplesSkill`: thay y hệt.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `npm run build && node test/validate.mjs` → `0 fail`.

- [ ] **Step 5: Commit qua `core:git-workflow`**

Stage: 2 adapter + `test/validate.mjs`.

```
fix(adapters): drop "pipeline bắt buộc" from plugin principles descriptions

Changed:
- Mô tả skill <plugin>-principles ở adapter claude và codex: bỏ "pipeline bắt buộc" (khái niệm đã bỏ), thêm câu "Dùng khi" theo hướng dẫn viết description
- validate khối 33 kiểm mô tả build của 5 plugin có principles

Reason:
- Mô tả cũ mâu thuẫn với quy ước repo và nằm trong ngữ cảnh mọi phiên
```

---

### Task 4: CI — matrix Windows, `claude plugin validate --strict`, release bằng `gh`

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

**Interfaces:** không có. (Không có test tự động cho YAML CI; kiểm bằng `node -e` parse YAML không có — dùng `py -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))"`.)

- [ ] **Step 1: Viết `ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 24]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run pack:verify

  claude-plugin-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      # CLI Claude Code không phải dependency của repo; cài tại chỗ để chạy đúng validator chính thức ở chế độ CI (--strict).
      - name: Install Claude Code CLI
        id: cli
        continue-on-error: true
        run: npm i -g @anthropic-ai/claude-code && claude --version
      - name: claude plugin validate --strict
        if: steps.cli.outcome == 'success'
        shell: bash
        run: |
          claude plugin validate --strict build/claude
          for p in build/claude/plugins/*/; do claude plugin validate --strict "$p"; done
      - name: CLI unavailable
        if: steps.cli.outcome != 'success'
        run: echo "::warning::Không cài được Claude Code CLI trên runner — bỏ qua plugin validate --strict (đã chạy local)."
```

- [ ] **Step 2: Viết `release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run pack:verify
      - name: Create GitHub release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "$GITHUB_REF_NAME" --title "Release $GITHUB_REF_NAME" --notes "See CHANGELOG.md and MIGRATION.md for details."
```

- [ ] **Step 3: Kiểm YAML hợp lệ**

Run: `py -c "import yaml,sys;[yaml.safe_load(open(f,encoding='utf-8')) for f in sys.argv[1:]];print('yaml ok')" .github/workflows/ci.yml .github/workflows/release.yml`
Expected: `yaml ok`. Kiểm no BOM/LF như mọi file.

- [ ] **Step 4: Chạy tại chỗ phần có thể**

Run: `claude plugin validate --strict build/claude && for p in build/claude/plugins/*/; do claude plugin validate --strict "$p"; done`
Expected: 8 dòng `Validation passed`.

- [ ] **Step 5: Commit qua `core:git-workflow`**

Stage: 2 file workflow.

```
ci: run tests on windows and node 24, validate plugins with claude --strict

Changed:
- ci.yml: matrix ubuntu/windows × node 20/24, thêm pack:verify, bỏ bước validate chạy trùng; job riêng build rồi claude plugin validate --strict cho marketplace và từng plugin (cảnh báo nếu không cài được CLI); permissions contents: read; concurrency huỷ run cũ
- release.yml: thay actions/create-release@v1 bằng gh release create; permissions contents: write

Reason:
- install.mjs có nhánh junction chỉ chạy trên Windows và máy dev dùng Node 24; tài liệu Claude Code khuyến nghị --strict cho CI
```

---

### Task 5: Version gate — `core/.manifest.json`, lock hash↔version, contract semver, `aip check` doctor, bump

**Files:**
- Create: `core/.manifest.json`
- Create: `cli/lib/versions.mjs`
- Create (sinh): `plugins/_versions.lock.json`
- Modify: `cli/lib/plugins.mjs` (`loadCore`)
- Modify: `cli/lib/install.mjs` (`check()` + hàm `claudeInstalledVersions`, export `parseClaudePluginList`)
- Modify: `cli/index.mjs` (`reportCheck`)
- Modify: `plugins/{backend,frontend,engineering,ops,data}/.manifest.json` (bump PATCH)
- Modify: `test/validate.mjs` (5 pin → semver; L419/L424 đã sửa ở Task 2 cho L424; khối 34)
- Modify: `CLAUDE.md` (mục Commands + Adding capability content)

**Interfaces:**
- Produces từ `cli/lib/versions.mjs`:
  - `hashDir(dir) → string` (sha256 hex của `[relPath + '\0' + nội dung]` sắp xếp theo relPath, đọc nhị phân);
  - `currentVersions({ buildDir = BUILD_CLAUDE_PLUGINS }) → { [id]: { version, hash } }` (đọc `build/claude/plugins/<id>/.claude-plugin/plugin.json` để lấy version, hash cả thư mục);
  - `lockPath` = `plugins/_versions.lock.json`; `readLock()`; `planLock(current, previous) → { next, refused: [{id, version, reason}] }` (thuần: entry hash đổi nhưng version không đổi ⇒ refused);
  - `diffLock(current, lock) → string[]` (thuần: lệch hash/version/thiếu id ⇒ thông điệp);
  - CLI: `node cli/lib/versions.mjs --lock` (ghi lock, exit 1 nếu refused), `--check` (exit 1 nếu `diffLock` khác rỗng).
- Produces từ `install.mjs`: `parseClaudePluginList(text, marketplaceName) → [{id, version}]` (thuần); `check()` thêm `claude: { available: boolean, stale: [{id, installed, source}] }`.

- [ ] **Step 1: Viết test đỏ (khối 34 + sửa pin)**

Thay 5 dòng pin:

```js
// L1316
  ok(/^\d+\.\d+\.\d+$/.test(feMan19.version) && !feMan19.description.includes('DRAFT'),
    'frontend manifest: version semver, description không còn nhãn DRAFT');
// L1470
  ok(/^\d+\.\d+\.\d+$/.test(beMan20.version), 'backend manifest: version semver');
// L1614
  ok(/^\d+\.\d+\.\d+$/.test(dataMan22.version) && !dataMan22.description.includes('DRAFT') && dataMan22.description.includes('data-db-migration'),
    'data manifest: version semver, description nêu data-db-migration và không còn nhãn DRAFT');
// L1789
  ok(/^\d+\.\d+\.\d+$/.test(feMan23.version) && feMan23.description.includes('frontend-performance'),
    'frontend manifest: version semver, description nêu frontend-performance');
// khối 29d (pin engineering hiện là 1.4.0)
  ok(mf.description.includes('7 skill') && mf.description.includes('engineering-task-breakdown') && /^\d+\.\d+\.\d+$/.test(mf.version),
    'engineering manifest: 7 skill, có engineering-task-breakdown, version semver');
```

(Giữ nguyên các dòng chuỗi thông điệp cũ nếu khác chút về số dòng — tìm theo nội dung.)

Thay assert vacuous trong B3 (agent): `ok(c.includes(\`name: ${a.id}\`) && c.includes('disallowedTools:') && c.includes('Agent'),` → 

```js
    const fmA = (c.match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
    ok(fmA.includes(`name: ${a.id}`) && /^disallowedTools: .*\bAgent\b/m.test(fmA),
```

Thêm import đầu file (sau import `write.mjs`):

```js
import { hashDir, currentVersions, planLock, diffLock, readLock } from '../cli/lib/versions.mjs';
import { parseClaudePluginList } from '../cli/lib/install.mjs';
```

Chèn khối 34:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 34. Version gate: core manifest, semver + đồng bộ version, lock hash↔version, doctor (spec 2026-10-07 audit E5 / P0.3)
// ─────────────────────────────────────────────────────────────────────────────
{
  const coreMf = path.join(CORE_DIR, '.manifest.json');
  ok(fs.existsSync(coreMf), 'core: có core/.manifest.json');
  const cm = fs.existsSync(coreMf) ? JSON.parse(fs.readFileSync(coreMf, 'utf8')) : {};
  ok(cm.id === 'core' && core.version === cm.version && core.description === cm.description,
    'core: loadCore đọc id/version/description từ manifest');
  const units = [core, ...plugins, ...(workflows ? [workflows] : [])];
  for (const u of units) ok(/^\d+\.\d+\.\d+$/.test(u.version), `${u.id}: version semver (${u.version})`);
  const claudeDir34 = path.join(BUILD, 'claude');
  if (fs.existsSync(claudeDir34)) {
    const mk = JSON.parse(fs.readFileSync(path.join(claudeDir34, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const mkNames = new Set(mk.plugins.map((x) => x.name));
    for (const u of units) {
      const pj = JSON.parse(fs.readFileSync(path.join(claudeDir34, 'plugins', u.id, '.claude-plugin', 'plugin.json'), 'utf8'));
      const entry = mk.plugins.find((x) => x.name === u.id) || {};
      ok(pj.version === u.version && entry.version === u.version, `${u.id}: version đồng bộ manifest = plugin.json = marketplace`);
      ok((pj.dependencies || []).every((d) => mkNames.has(d)), `${u.id}: dependencies ⊂ marketplace`);
    }
    // Lock = chân lý đã commit của "build của version này"; lệch ⇒ chạy node cli/lib/versions.mjs --lock (nó từ chối nếu chưa bump).
    const diff = diffLock(currentVersions(), readLock());
    ok(diff.length === 0, `versions lock khớp build${diff.length ? ' — ' + diff.slice(0, 3).join(' | ') : ''}`);
  }
  // Thuần: hash ổn định, nhạy nội dung; planLock từ chối khi hash đổi mà version giữ nguyên.
  const tmp34 = fs.mkdtempSync(path.join(os.tmpdir(), 'ver-'));
  try {
    fs.mkdirSync(path.join(tmp34, 'a'));
    fs.writeFileSync(path.join(tmp34, 'a', 'x.md'), 'một');
    const h1 = hashDir(tmp34);
    ok(h1 === hashDir(tmp34) && /^[0-9a-f]{64}$/.test(h1), 'hashDir: tất định, sha256 hex');
    fs.writeFileSync(path.join(tmp34, 'a', 'x.md'), 'hai');
    ok(hashDir(tmp34) !== h1, 'hashDir: đổi nội dung → đổi hash');
  } finally { fs.rmSync(tmp34, { recursive: true, force: true }); }
  const prev = { core: { version: '1.0.0', hash: 'h1' }, be: { version: '2.0.0', hash: 'k1' } };
  const cur = { core: { version: '1.0.0', hash: 'h2' }, be: { version: '2.0.1', hash: 'k2' }, fe: { version: '0.1.0', hash: 'f' } };
  const plan34 = planLock(cur, prev);
  ok(plan34.refused.length === 1 && plan34.refused[0].id === 'core', 'planLock: hash đổi + version giữ → từ chối đúng plugin');
  ok(plan34.next.be.hash === 'k2' && plan34.next.fe && plan34.next.core.hash === 'h1', 'planLock: entry hợp lệ cập nhật, entry mới thêm, entry bị từ chối giữ cũ');
  ok(diffLock(cur, prev).length === 3 && diffLock(cur, { ...cur }).length === 0, 'diffLock: báo lệch hash/version/thiếu id; khớp → rỗng');
  const sample = 'Installed plugins:\n\n  ❯ backend@ai-engineering-platform\n    Version: 1.2.0\n    Scope: user\n    Status: ✔ enabled\n\n  ❯ feature-dev@claude-plugins-official\n    Version: 2a8ad9f74633\n\n  ❯ workflows@ai-engineering-platform\n    Version: 1.0.0\n    Status: ✘ failed to load\n';
  ok(JSON.stringify(parseClaudePluginList(sample, 'ai-engineering-platform')) === '[{"id":"backend","version":"1.2.0"},{"id":"workflows","version":"1.0.0"}]',
    'parseClaudePluginList: lấy đúng plugin của marketplace + version');
}

```

Thêm `import os from 'node:os';` ở đầu file nếu chưa có.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: lỗi import `versions.mjs` không tồn tại (đỏ hợp lệ).

- [ ] **Step 3: Tạo `core/.manifest.json` và sửa `loadCore`**

`core/.manifest.json`:

```json
{
  "id": "core",
  "name": "Core — Nguyên tắc nền tảng Cowork→Code",
  "description": "Nguyên tắc nền tảng dùng chung (4 nguyên tắc cốt lõi, 3 tầng tài liệu, ranh giới an toàn, nguồn sự thật) cho mọi plugin workflow Cowork → Code. Mọi plugin phụ thuộc core này. Dùng khi bắt đầu bất kỳ skill nào của bộ hoặc khi cần đối chiếu ranh giới an toàn nền.",
  "version": "1.1.2"
}
```

`cli/lib/plugins.mjs` `loadCore()`:

```js
export function loadCore() {
  const manifest = readJSON(path.join(CORE_DIR, '.manifest.json'));
  return {
    id: manifest.id || 'core',
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    manifest,
    principles: readCorePrinciples(),
    stages: loadSkills(CORE_DIR),
    agents: [],
  };
}
```

(Cập nhật comment JSDoc phía trên: version/description đọc từ `core/.manifest.json`, cùng cơ chế với plugin.)

- [ ] **Step 4: Tạo `cli/lib/versions.mjs`**

```js
#!/usr/bin/env node
// Cổng version: cache plugin của Claude Code key theo version, nên nội dung build đổi mà version
// không đổi thì người dùng không bao giờ nhận bản mới. Lock ghi hash build của từng plugin tại version
// đã commit; --lock từ chối khi hash đổi mà version chưa bump; validate kiểm lock khớp build hiện tại.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from './plugins.mjs';

export const LOCK_PATH = path.join(REPO_ROOT, 'plugins', '_versions.lock.json');
const BUILD_CLAUDE_PLUGINS = path.join(REPO_ROOT, 'build', 'claude', 'plugins');

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

export function hashDir(dir) {
  const h = createHash('sha256');
  for (const rel of walk(dir)) {
    h.update(rel); h.update('\0');
    h.update(fs.readFileSync(path.join(dir, rel))); h.update('\0');
  }
  return h.digest('hex');
}

export function currentVersions({ buildDir = BUILD_CLAUDE_PLUGINS } = {}) {
  const out = {};
  if (!fs.existsSync(buildDir)) return out;
  for (const e of fs.readdirSync(buildDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const pj = path.join(buildDir, e.name, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(pj)) continue;
    const { version } = JSON.parse(fs.readFileSync(pj, 'utf8'));
    out[e.name] = { version, hash: hashDir(path.join(buildDir, e.name)) };
  }
  return out;
}

export function readLock(p = LOCK_PATH) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

/** Thuần: lock mới từ build hiện tại; entry hash đổi nhưng version giữ nguyên bị từ chối (giữ entry cũ). */
export function planLock(current, previous) {
  const next = {};
  const refused = [];
  for (const id of Object.keys(current).sort()) {
    const cur = current[id];
    const old = previous[id];
    if (old && old.hash !== cur.hash && old.version === cur.version) {
      refused.push({ id, version: cur.version, reason: 'nội dung build đổi nhưng version chưa bump' });
      next[id] = old;
    } else {
      next[id] = cur;
    }
  }
  return { next, refused };
}

/** Thuần: lệch giữa build hiện tại và lock đã commit. */
export function diffLock(current, lock) {
  const errs = [];
  for (const id of Object.keys(current).sort()) {
    const l = lock[id];
    if (!l) { errs.push(`${id}: chưa có trong lock`); continue; }
    if (l.version !== current[id].version) errs.push(`${id}: lock ghi ${l.version}, build là ${current[id].version}`);
    else if (l.hash !== current[id].hash) errs.push(`${id}: build đổi so với lock (version ${l.version})`);
  }
  for (const id of Object.keys(lock)) if (!current[id]) errs.push(`${id}: có trong lock nhưng không còn trong build`);
  return errs;
}

function main(argv) {
  const current = currentVersions();
  if (!Object.keys(current).length) { console.error('Chưa có build/claude/plugins — chạy npm run build trước.'); return 2; }
  if (argv.includes('--lock')) {
    const { next, refused } = planLock(current, readLock());
    for (const r of refused) console.error(`✗ ${r.id}@${r.version}: ${r.reason} — bump version trong manifest rồi chạy lại.`);
    fs.writeFileSync(LOCK_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Đã ghi ${path.relative(REPO_ROOT, LOCK_PATH)} (${Object.keys(next).length} plugin).`);
    return refused.length ? 1 : 0;
  }
  const diff = diffLock(current, readLock());
  for (const d of diff) console.error(`✗ ${d}`);
  console.log(diff.length ? `${diff.length} lệch — chạy: node cli/lib/versions.mjs --lock` : 'versions lock khớp build.');
  return diff.length ? 1 : 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
```

- [ ] **Step 5: `aip check` doctor**

`cli/lib/install.mjs`: thêm sau `runClaudeCli` (cùng khu vực):

```js
/** Thuần: đọc output `claude plugin list`, trả plugin của marketplace này kèm version đã cài. */
export function parseClaudePluginList(text, marketplaceName) {
  const out = [];
  let cur = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const head = line.match(/^❯\s+([a-z0-9-]+)@(.+)$/);
    if (head) { cur = head[2] === marketplaceName ? { id: head[1], version: null } : null; if (cur) out.push(cur); continue; }
    const ver = line.match(/^Version:\s*(\S+)/);
    if (ver && cur) cur.version = ver[1];
  }
  return out;
}

/** Đối chiếu version plugin đã cài trong Claude Code với nguồn; không có CLI → available=false, không ném. */
function claudeDoctor() {
  let out;
  try { out = runClaudeCli(['plugin', 'list'], { tolerate: true }); } catch { return { available: false, stale: [] }; }
  if (!out.ok) return { available: false, stale: [] };
  const source = new Map([loadCore(), ...loadPlugins(), ...(loadWorkflows() ? [loadWorkflows()] : [])].map((u) => [u.id, u.version]));
  const stale = parseClaudePluginList(out.out, loadMarketplace().name)
    .filter((e) => source.has(e.id) && e.version !== source.get(e.id))
    .map((e) => ({ id: e.id, installed: e.version, source: source.get(e.id) }));
  return { available: true, stale };
}
```

Trong `check()`: thêm `claude: claudeDoctor(),` vào object trả về (sau `manifest:`).

`cli/index.mjs` `reportCheck`: thêm cuối hàm (trước dấu `}` đóng, sau vòng `for`):

```js
  if (r.claude && r.claude.available && r.claude.stale.length) {
    console.log('\n⚠ Plugin trong Claude Code lệch nguồn (cache key theo version) — chạy "aip update" hoặc cài lại:');
    for (const s of r.claude.stale) console.log(`  - ${s.id}: đã cài ${s.installed}, nguồn ${s.source}`);
  }
```

Lưu ý: `reportCheck` return sớm khi `!r.installs.length` — đưa khối doctor LÊN TRƯỚC dòng `if (!r.installs.length) …` để vẫn báo lệch khi manifest aip trống (trường hợp cài bằng `claude plugin install` tay).

- [ ] **Step 6: Bump PATCH 5 plugin**

`plugins/backend/.manifest.json` `1.5.0→1.5.1`; `frontend` `1.7.0→1.7.1`; `engineering` `1.4.0→1.4.1`; `ops` `1.2.0→1.2.1`; `data` `1.3.0→1.3.1` (chỉ đổi trường `version`).

- [ ] **Step 7: Build, tạo lock, chạy test**

Run:

```bash
npm run build
node cli/lib/versions.mjs --lock
node cli/lib/versions.mjs --check
node test/validate.mjs
```

Expected: `--lock` ghi `plugins/_versions.lock.json` với 7 entry (core, backend, data, engineering, frontend, ops, workflows), exit 0 (lock chưa tồn tại → không có refused); `--check` in `versions lock khớp build.`; validate `0 fail`.

Kiểm cổng từ chối: sửa tạm 1 ký tự trong `core/principles/principles.md`, `npm run build && node cli/lib/versions.mjs --lock` → exit 1 với `✗ core@1.1.2: nội dung build đổi nhưng version chưa bump`; hoàn tác sửa (`git checkout -- core/principles/principles.md`), build lại, `--check` xanh. Ghi kết quả vào report.

- [ ] **Step 8: Cập nhật `CLAUDE.md`**

Mục `## Commands`, thêm sau khối lệnh npm:

```markdown
Version gate: Claude Code caches plugins **by version**, so any change to projected content must bump the
plugin's `.manifest.json` version (core: `core/.manifest.json`). After `npm run build`, run
`node cli/lib/versions.mjs --lock` to refresh `plugins/_versions.lock.json` (it refuses when content changed but
the version did not); `npm test` fails if the lock does not match the build. `aip check` reports installed
Claude plugins whose version differs from source.
```

Mục `### Adding capability content`, thêm bullet cuối:

```markdown
- Any content change → bump the owning plugin's version and re-run `node cli/lib/versions.mjs --lock` (see Version gate above). `workflows/.manifest.json` `hardDependencies` lists the plugins the `workflows` plugin depends on; a workflow needing another plugin (e.g. `data`, `ops`) gets a "Plugin cần có" preamble line instead.
```

Và trong mô tả `loadCore()` ở mục Architecture: `loadCore()` returns core as a plugin-shaped object → thêm "(identity/version from `core/.manifest.json`)".

- [ ] **Step 9: Toàn bộ verification**

```bash
npm run build
npm test
npm run pack:verify
node cli/lib/versions.mjs --check
claude plugin validate --strict build/claude
aip check   # hoặc node cli/index.mjs check — kỳ vọng in cảnh báo lệch cho backend/frontend/engineering (đang cài 1.2.0)
```

Expected: tất cả exit 0 (riêng `aip check` in cảnh báo nhưng exit 0). `pack:verify` pass: `plugins/_versions.lock.json` không trong `package.json files` nên không ship; `cli/lib/versions.mjs` nằm trong `cli/`.

- [ ] **Step 10: Commit qua `core:git-workflow`**

Stage: `core/.manifest.json`, `cli/lib/plugins.mjs`, `cli/lib/versions.mjs`, `plugins/_versions.lock.json`, `cli/lib/install.mjs`, `cli/index.mjs`, 5 manifest plugin, `test/validate.mjs`, `CLAUDE.md`.

```
feat(cli): add plugin version gate and installed-version check

Changed:
- core/.manifest.json làm nguồn id/version/description của core; loadCore đọc manifest thay vì hard-code
- cli/lib/versions.mjs: hash build từng plugin, lock plugins/_versions.lock.json; --lock từ chối khi nội dung đổi mà version chưa bump, --check báo lệch; validate khối 34 kiểm lock khớp build, semver, version đồng bộ manifest/plugin.json/marketplace, dependencies ⊂ marketplace
- aip check: đối chiếu claude plugin list với version nguồn, cảnh báo plugin cũ
- Bump PATCH backend 1.5.1, frontend 1.7.1, engineering 1.4.1, ops 1.2.1, data 1.3.1, core 1.1.2 vì output đổi (quote YAML, mô tả principles)
- Thay 5 assert ghim version bằng kiểm semver; sửa assert agent "Agent" vacuous; CLAUDE.md ghi quy tắc bump + lock

Reason:
- Cache plugin Claude Code key theo version; nội dung đổi mà không bump thì người dùng giữ bản cũ (máy dev đang cài backend 1.2.0 trong khi nguồn 1.5.0)
```

---

### Task 6: Pilot — cài lại và xác nhận trên máy dev (không commit)

**Files:** không sửa repo.

- [ ] **Step 1:** `aip update -g` (hoặc `aip update` ở scope đang cài) → kỳ vọng `claude plugin list` cho `workflows@ai-engineering-platform` `✔ enabled`, version 1.1.0; backend 1.5.1 …
- [ ] **Step 2:** `claude plugin details engineering@ai-engineering-platform` → inventory 8 skill + 3 agent, version 1.4.1; ghi lại always-on token để so sánh ở Phase 1.
- [ ] **Step 3:** `aip check` không còn cảnh báo lệch. Báo cáo kết quả; nếu `aip update` không xử lý được `workflows` (từng fail to load) thì ghi rõ và gợi ý `claude plugin uninstall workflows@… && claude plugin install workflows@…`.
