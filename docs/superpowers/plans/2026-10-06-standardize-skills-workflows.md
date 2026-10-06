# Chuẩn hoá skill + workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ép khung `SKILL.md`, chuẩn hoá description (≤ 1024 ký tự, "Không dùng khi → id", không trùng trigger), bỏ frontmatter chết, thêm drift guard cho workflow, và đo trùng lặp để ra quyết định gộp có số liệu.

**Architecture:** Rule mới nằm trong helper thuần `cli/lib/conventions.mjs` (skill/description) và `cli/lib/workflows.mjs` (dòng neo, tín hiệu Registry), được `test/validate.mjs` gọi ở các block mới `// 24.`–`// 28.` ở cuối file. Nội dung (48 file skill/workflow) sửa bằng script một lần chạy từ thư mục tạm (không commit) để diff chỉ chạm đúng dòng cần sửa. Script đo trùng lặp `test/overlap.mjs` chỉ in báo cáo, không nằm trong `npm test`.

**Tech Stack:** Node.js 20+, ESM, zero dependency. `node test/validate.mjs`, `npm test`, `npm run build`, `npm run pack:verify`.

**Spec:** [`docs/superpowers/specs/2026-10-06-standardize-skills-workflows-design.md`](../specs/2026-10-06-standardize-skills-workflows-design.md) (đọc cả §10 "Sai lệch khi lập plan").

## Global Constraints

- Nhánh `refactor/skills-workflows-standardization` (đã cắt từ `master` `321d0c3`). Không push; không merge.
- File UTF-8 **không BOM**, LF **trong index** (`.gitattributes`: `* text=auto eol=lf`). Nội dung tiếng Việt có dấu; identifier/code tiếng Anh.
- Working tree có thể là CRLF dù index LF (`git ls-files --eol <file>` → `w/crlf`; vd `adapters/_shared/lib.mjs`, `plugins/engineering/skills/engineering-diagram/SKILL.md`). Script đọc file phải chuẩn hoá `\r\n` → `\n` trước khi xử lý và ghi lại LF. Nếu Edit tool không khớp chuỗi nhiều dòng vì CRLF, đổi file đó về LF trước bằng script `<tmpdir>/aip-to-lf.mjs` (Global Constraints, khối dưới); index đã LF nên diff không đổi.
- Comment code chỉ giải thích *vì sao*, tiếng Việt, 1–2 dòng; không comment điều code đã nói.
- Zero runtime dependency; không thêm package.
- Description: tối đa **1024 ký tự** (đếm code point `[...s].length`); câu cuối là `Không dùng khi <tình huống> → <id>[; <tình huống> → <id>].`; mọi `<id>` là id skill/workflow/agent có thật và khác id của chính nó.
- `SKILL.md` phải có H2 `## Quy trình` và `## Ranh giới an toàn` (cho phép hậu tố sau một dấu cách).
- Đổi một file working tree về LF (lưu `<tmpdir>/aip-to-lf.mjs`, chạy `node <tmpdir>/aip-to-lf.mjs <file>…`):

  ```js
  import fs from 'node:fs';
  for (const f of process.argv.slice(2)) fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  ```
- Script một lần (strip/rewrite/rename) lưu và chạy từ thư mục tạm của OS (`node -p "require('os').tmpdir()"`), cwd = gốc repo; **không commit** script.
- Dọn thư mục tạm/sandbox bằng Node `fs.rmSync`, không `rm -rf` (junction Windows có thể xoá xuyên vào `build/`).
- Mỗi task = 1 commit. Trước mỗi commit: dừng, trình bày `git status --short` + `git diff --stat` + message, **chờ chủ dự án duyệt diff**.
- Commit qua skill `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu (Changed/Reason), **không dùng dấu `?`** trong body, ghi message ra file UTF-8 rồi `git commit -F <file>`. **Không thêm dòng `Co-Authored-By`**.
- Không sửa nội dung ngoài phạm vi task (vd câu "KHÔNG thuộc pipeline nào" trong thân skill `*-init` giữ nguyên).

## Review Focus

1. **Câu "Không dùng khi" có dấu chấm giữa câu** (vd "v.v.") → vẫn bắt đủ mọi `→ id`. Test ở Task 3 Step 1 (`notForTargets` với "v.v.").
2. **Mũi tên viết dính hoặc có backtick** (`→c-d`, ``→ `workflow-x` ``) → vẫn được kiểm id. Test ở Task 3 Step 1.
3. **Description trỏ vào chính nó** (`→ <id của chính skill>`) → lỗi. Test ở Task 3 Step 1.
4. **Trigger khác nhau chỉ ở hoa/thường hoặc khoảng trắng đầu/cuối** ("OpenAPI" vs " openapi ") → coi là trùng. Test ở Task 3 Step 1 (`quotedPhrases`, `triggerCollisions`).
5. **File workflow CRLF** (checkout Windows) → dòng neo vẫn khớp. Test ở Task 4 Step 1 (`missingAnchors` với `\r\n`).

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `cli/lib/conventions.mjs` (mới) | Helper thuần: khung H2 skill, rule description, trigger trùng | 2, 3 |
| `cli/lib/workflows.mjs` | + `WF_ANCHORS`, `missingAnchors`, `registrySignals` | 4 |
| `cli/lib/plugins.mjs` | Bỏ đọc `pipeline`/`next`/`stageNumber` | 1 |
| `adapters/_shared/lib.mjs` | `agentsFiles` liệt kê skill một nhóm; bỏ `stageSlug` | 1 |
| `test/validate.mjs` | Gỡ assert pipeline; block `// 24.`–`// 28.`; cơ chế `warn` | 1–5 |
| `test/overlap.mjs` (mới) + `package.json` | Báo cáo trùng lặp, `npm run overlap` | 5 |
| 35 `SKILL.md`, 13 `WORKFLOW.md`, `templates/workflows/workflow.template.md` | Nội dung | 1–4 |
| `CLAUDE.md`, `README.md`, `README_VI.md`, `CHANGELOG.md`, `plugins/backend/shared/principles.md`, `plugins/backend/skills/backend-migrate-architecture/README.md` | Tài liệu | 1–5 |
| `docs/superpowers/specs/2026-10-06-standardize-skills-workflows-design.md` | Số đo B0 + quyết định B1 | 6 |

Vị trí chèn block test mới: cuối `test/validate.mjs` có đoạn

```js
// ─────────────────────────────────────────────────────────────────────────────
console.log('');
if (fails.length) {
```

Mọi block `// 24.`–`// 28.` chèn **ngay trước** dòng kẻ `// ───` đứng trên `console.log('');` này, theo thứ tự số.

---

### Task 1: A1 — Bỏ frontmatter chết `pipeline` / `next` / `stageNumber`

**Files:**
- Modify: `cli/lib/plugins.mjs:124-127,165,170-174,241-242`
- Modify: `adapters/_shared/lib.mjs:14-17,93-137`
- Modify: `test/validate.mjs` (import; `:185-189`; `:219`; `:233-234`; `:238-248`; `:259-268`; `:315`; `:659-660`; `:834-835`; `:878-879`; `:1145-1146`; `:1456-1457`; `:1757-1758`; block `// 24.` mới)
- Modify: 35 `SKILL.md`, 13 `WORKFLOW.md`, `templates/workflows/workflow.template.md` (chỉ frontmatter)
- Modify: `CLAUDE.md:55,72`, `README.md:317-320`, `README_VI.md:311-314`, `plugins/backend/shared/principles.md:17`, `plugins/backend/skills/backend-migrate-architecture/README.md:4-5`, `CHANGELOG.md`

**Interfaces:**
- Consumes: không.
- Produces: stage từ `loadSkills()`/`loadWorkflows()` **không còn** key `pipeline`, `next`, `stageNumber`. `agentsFiles(plugin, { tool, base, core })` sinh `AGENTS.md` có đúng một nhóm `## Skill (gọi theo yêu cầu)`. `stageSlug` bị xoá.

- [ ] **Step 1: Chụp build hiện tại để so sau**

```bash
npm run build
node -e "const fs=require('fs'),os=require('os'),path=require('path');const d=path.join(os.tmpdir(),'aip-build-before');fs.rmSync(d,{recursive:true,force:true});fs.cpSync('build',d,{recursive:true});console.log(d)"
```

Expected: in đường dẫn thư mục snapshot.

- [ ] **Step 2: Viết test đỏ (block 24)**

Thêm vào dòng import đầu `test/validate.mjs` (sau dòng `import { tomlBasic, tomlMultiline } from '../adapters/_shared/agents.mjs';`):

```js
import { agentsFiles, whenToUse } from '../adapters/_shared/lib.mjs';
```

Chèn block (vị trí: xem "Vị trí chèn block test mới"):

```js
// ─────────────────────────────────────────────────────────────────────────────
// 24. Chuẩn hoá A1: frontmatter không còn trường chết (spec 2026-10-06 §4.1)
// ─────────────────────────────────────────────────────────────────────────────
{
  const DEAD = /^(pipeline|next|stageNumber):/m;
  const fmOf = (file) => (fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const sources = [
    ...core.stages.map((s) => path.join(CORE_DIR, 'skills', s.id, 'SKILL.md')),
    ...plugins.flatMap((p) => p.stages.map((s) => path.join(PLUGINS_DIR, p.id, 'skills', s.id, 'SKILL.md'))),
    ...(workflows ? workflows.stages.map((s) => path.join(s.dir, 'WORKFLOW.md')) : []),
    path.join(REPO_ROOT, 'templates', 'workflows', 'workflow.template.md'),
  ];
  for (const f of sources) {
    ok(!DEAD.test(fmOf(f)), `${path.relative(REPO_ROOT, f)}: frontmatter không còn pipeline/next/stageNumber`);
  }
  for (const s of [...core.stages, ...plugins.flatMap((p) => p.stages), ...(workflows ? workflows.stages : [])]) {
    ok(!('pipeline' in s) && !('next' in s) && !('stageNumber' in s), `${s.id}: loader không trả pipeline/next/stageNumber`);
  }
  const ag24 = agentsFiles({ id: 'fx', name: 'Fixture', shared: { principles: '' }, stages: [{
    id: 'fx-a', title: 'A', description: 'Làm A. Chi tiết.', runsIn: 'execute', invoke: 'per-request', body: 'x',
    assets: [], fileAssets: [], dirAssets: [] }] }, { tool: 'Antigravity', base: 'fx', core: fxCore });
  const agMd24 = (ag24.find((f) => f.path === 'fx/AGENTS.md') || { content: '' }).content;
  ok(!agMd24.includes('Pipeline & các giai đoạn') && !agMd24.includes('Thứ tự bắt buộc') && !agMd24.includes('Tiếp theo'),
    'agentsFiles: không còn mục pipeline / "Tiếp theo"');
  ok(agMd24.includes('## Skill (gọi theo yêu cầu)') && agMd24.includes('### fx-a — A')
    && agMd24.includes('- **Khi nào dùng:** Làm A.'), 'agentsFiles: liệt kê skill trong một nhóm');
}
```

- [ ] **Step 3: Chạy để thấy đỏ**

Run: `node test/validate.mjs`
Expected: FAIL; danh sách lỗi có `frontmatter không còn pipeline/next/stageNumber` (49 file), `loader không trả pipeline/next/stageNumber`, và 2 lỗi `agentsFiles`.

- [ ] **Step 4: Sửa loader**

`cli/lib/plugins.mjs`, comment của `loadSkills` (dòng 124–129):

```js
/**
 * Load a plugin's skills from `skills/<skill-id>/SKILL.md`. Metadata lives in the SKILL.md
 * frontmatter (order, title, runsIn, invoke, sharedAssets); body is the instructions. Files
 * alongside SKILL.md (e.g. `references/`) are treated as assets to ship.
 * Returns the same internal stage shape adapters already consume, ordered by `order`.
 */
```

Trong `stages.push({...})` của `loadSkills`, xoá dòng `stageNumber: meta.stageNumber || '',` và khối:

```js
      // pipeline=false đánh dấu "recipe on-demand" — skill KHÔNG thuộc chuỗi bắt buộc
      // init→...→implement (đứng riêng, next=null). Frontmatter parser trả "false" dạng
      // string nên nhận cả hai. Mặc định (thiếu field) = true = stage pipeline.
      pipeline: meta.pipeline === false || meta.pipeline === 'false' ? false : true,
      next: meta.next === undefined ? null : meta.next,
```

Trong `stages.push({...})` của `loadWorkflows`, xoá 2 dòng:

```js
      pipeline: meta.pipeline === false || meta.pipeline === 'false' ? false : true,
      next: meta.next === undefined ? null : meta.next,
```

- [ ] **Step 5: Sửa adapter dùng chung**

`adapters/_shared/lib.mjs`: xoá hàm `stageSlug` (dòng 14–17 kèm dòng trống sau nó). Trong comment của `agentsFiles` đổi `AGENTS.md (principles + pipeline index)` thành `AGENTS.md (principles + skill index)`. Thay khối từ `// Chia stage pipeline (chuỗi bắt buộc)…` tới hết `if (recipes.length) { … }` (dòng 110–137) bằng:

```js
  L.push('## Skill (gọi theo yêu cầu)');
  L.push('');
  for (const s of plugin.stages) {
    L.push(`### ${s.id} — ${s.title}`);
    L.push(`- **Chạy ở:** ${s.runsIn} · **Tần suất:** ${s.invoke}`);
    L.push(`- **Khi nào dùng:** ${whenToUse(s)}`);
    L.push(`- **Hướng dẫn chi tiết:** \`${workflowDocPath(s)}\``);
    L.push('');
  }
```

- [ ] **Step 6: Bỏ key khỏi 49 file nguồn bằng script một lần**

Lưu thành `<tmpdir>/aip-strip-frontmatter.mjs`:

```js
// Script một lần (không commit): bỏ pipeline/next/stageNumber khỏi frontmatter.
import fs from 'node:fs';
import path from 'node:path';

const targets = [];
const scan = (dir, name) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name, name);
    if (e.isDirectory() && fs.existsSync(f)) targets.push(f);
  }
};
scan('core/skills', 'SKILL.md');
for (const p of fs.readdirSync('plugins', { withFileTypes: true })) {
  if (p.isDirectory() && !p.name.startsWith('_')) scan(path.join('plugins', p.name, 'skills'), 'SKILL.md');
}
scan('workflows', 'WORKFLOW.md');
targets.push('templates/workflows/workflow.template.md');

let removed = 0;
for (const f of targets) {
  const text = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n[\s\S]*?\n---\n/);
  if (!m) throw new Error(`Không có frontmatter: ${f}`);
  const fm = m[0].replace(/^(pipeline|next|stageNumber):.*\n/gm, () => { removed++; return ''; });
  fs.writeFileSync(f, fm + text.slice(m[0].length));
}
console.log(`${targets.length} file, bỏ ${removed} dòng`);
```

Run: `node "$(node -p "require('os').tmpdir()")/aip-strip-frontmatter.mjs"`
Expected: `49 file, bỏ 133 dòng`

- [ ] **Step 7: Gỡ assert pipeline cũ trong `test/validate.mjs`**

1. Vòng `for (const s of core.stages)` (quanh dòng 181): xoá 2 assert

```js
  ok(s.pipeline === false && s.next === null,
    `core ${s.id}: recipe on-demand (pipeline=false, next=null) — core không có pipeline`);
```

```js
  ok(!!s.stageNumber, `core ${s.id}: có stageNumber (metadata workflow; strip ở adapter)`);
```

2. Vòng plugin (quanh dòng 219): xoá `const ids = new Set(p.stages.map((s) => s.id));` và 2 dòng

```js
    ok(s.next === null || typeof s.next === 'string', `${s.id}: next là string|null`);
    if (typeof s.next === 'string') ok(ids.has(s.next), `${s.id}: next "${s.next}" trỏ tới skill có thật`);
```

3. Thay khối

```js
  // Chia stage pipeline (chuỗi bắt buộc) vs recipe on-demand (pipeline=false).
  const pipe = p.stages.filter((s) => s.pipeline !== false);
  const recipes = p.stages.filter((s) => s.pipeline === false);
  const pipeOrders = pipe.map((s) => s.order);

  // order: unique toàn plugin; pipeline liên tục 1..N; recipe đứng SAU pipeline.
  ok(new Set(orders).size === orders.length, `${p.id}: order không trùng`);
  const sortedPipe = [...pipeOrders].sort((a, b) => a - b);
  ok(sortedPipe.every((v, i) => v === i + 1), `${p.id}: order pipeline liên tục 1..${pipe.length}`);
  ok(recipes.every((s) => s.order > pipe.length), `${p.id}: order recipe > ${pipe.length} (đứng sau pipeline)`);
  ok(recipes.every((s) => s.next === null), `${p.id}: recipe skill có next=null (không nối pipeline)`);
```

bằng

```js
  ok(new Set(orders).size === orders.length, `${p.id}: order không trùng`);
```

4. Xoá khối (cuối vòng plugin)

```js

  // Nếu plugin CÓ pipeline: đúng 1 skill kết thúc (next=null), order lớn nhất. Bỏ pipeline
  // (mọi skill là recipe) → không áp ràng buộc này (không còn khái niệm chuỗi bắt buộc).
  if (pipe.length > 0) {
    const terminals = pipe.filter((s) => s.next === null);
    ok(terminals.length === 1, `${p.id}: đúng 1 skill pipeline kết thúc (next=null)`);
    if (terminals.length === 1) {
      ok(terminals[0].order === Math.max(...pipeOrders), `${p.id}: skill pipeline kết thúc có order lớn nhất`);
    }
  }
```

5. Vòng workflow (quanh dòng 315): xoá `ok(s.pipeline === false && s.next === null, \`${s.id}: pipeline=false, next=null\`);`

6. Quanh dòng 659, thay

```js
  ok(/^name: data-db-migration$/m.test(skillMd) && /^order: 5$/m.test(skillMd) && /^stageNumber: "05"$/m.test(skillMd),
    'data-db-migration: frontmatter name, order 5, stageNumber "05" trong plugin data');
```

bằng

```js
  ok(/^name: data-db-migration$/m.test(skillMd) && /^order: 5$/m.test(skillMd),
    'data-db-migration: frontmatter name, order 5 trong plugin data');
```

7. Năm assert còn lại: bỏ vế `/^pipeline: false$/m.test(<biến>) && ` và chữ `, pipeline false` trong message:

```js
  ok(/^order: 7$/m.test(diSkill) && /^sharedAssets: templates\/architecture$/m.test(diSkill),
    'frontend-data-integration: frontmatter order 7, sharedAssets templates/architecture');
```

```js
  ok(/^order: 8$/m.test(e2eSkill) && /^sharedAssets: templates\/architecture$/m.test(e2eSkill),
    'frontend-e2e-testing: frontmatter order 8, sharedAssets templates/architecture');
```

```js
    ok(/^order: 9$/m.test(s) && /^runsIn: execute$/m.test(s),
      `${p}-fix: frontmatter order 9, runsIn execute`);
```

```js
  ok(/^order: 10$/m.test(perfSkill) && /^runsIn: execute$/m.test(perfSkill),
    'backend-performance: frontmatter order 10, runsIn execute');
```

```js
  ok(/^order: 10$/m.test(feSkill23) && /^runsIn: execute$/m.test(feSkill23),
    'frontend-performance: frontmatter order 10, runsIn execute');
```

- [ ] **Step 8: Chạy để thấy xanh**

Run: `node test/validate.mjs`
Expected: `KẾT QUẢ: <n> pass, 0 fail`

Run: `grep -rn "pipeline\b\|stageNumber\|\.next\b\|stageSlug" cli adapters test --include=*.mjs`
Expected: chỉ còn `test/validate.mjs` (block 24 và dòng `reg.rows[0].next`/`r.next`/`nextOf` của Registry) và comment `adapters/antigravity/adapter.mjs:9`, `adapters/claude/adapter.mjs:81`, `adapters/codex/adapter.mjs:43` (văn bản mô tả principles, ngoài phạm vi).

- [ ] **Step 9: So build trước/sau**

```bash
npm run build
node -e "const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');const A=path.join(os.tmpdir(),'aip-build-before');const walk=(d,b=d)=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name),b):[path.relative(b,path.join(d,e.name)).split(path.sep).join('/')]):[];const h=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');for(const t of ['antigravity','claude','codex','cursor','cowork']){const a=new Set(walk(path.join(A,t))),b=new Set(walk(path.join('build',t)));for(const f of new Set([...a,...b]))if(!a.has(f)||!b.has(f)||h(path.join(A,t,f))!==h(path.join('build',t,f)))console.log(t+'/'+f);}"
```

Expected: chỉ các dòng `antigravity/<plugin>/AGENTS.md`. Nếu thấy file khác → dừng, báo lại.

Dọn snapshot: `node -e "const fs=require('fs'),os=require('os'),path=require('path');fs.rmSync(path.join(os.tmpdir(),'aip-build-before'),{recursive:true,force:true})"`

- [ ] **Step 10: Sửa tài liệu**

`CLAUDE.md` dòng 55: thay `frontmatter (\`order\`, \`pipeline\`, \`next\`, \`runsIn\`, \`invoke\`, \`sharedAssets\`) describes each one — **this repo runs skills as standalone recipes** (\`pipeline: false\`, no mandatory chain).` bằng `frontmatter (\`order\`, \`title\`, \`runsIn\`, \`invoke\`, \`sharedAssets\`) describes each one — **this repo runs skills as standalone recipes** (no mandatory chain).`

`CLAUDE.md` dòng 72: thay `(frontmatter: \`name\`, \`description\`, \`order\`, \`title\`, \`runsIn\`, \`invoke\`, \`pipeline: false\`, \`next: null\`)` bằng `(frontmatter: \`name\`, \`description\`, \`order\`, \`title\`, \`runsIn\`, \`invoke\`)`.

`README.md`, thay

```markdown
- **New skill** → add `plugins/<id>/skills/<skill-id>/SKILL.md` with frontmatter
  (`name`, `description`, `order`, `title`, `runsIn`, `invoke`, `pipeline: false`,
  `next: null`). It is auto-discovered — no manifest list to update. Put shipped
  reference files under `skills/<skill>/references/`.
```

bằng

```markdown
- **New skill** → add `plugins/<id>/skills/<skill-id>/SKILL.md` with frontmatter
  (`name`, `description`, `order`, `title`, `runsIn`, `invoke`). It is auto-discovered —
  no manifest list to update. Put shipped reference files under `skills/<skill>/references/`.
```

`README_VI.md`, thay

```markdown
- **Skill mới** → thêm `plugins/<id>/skills/<skill-id>/SKILL.md` với frontmatter (`name`,
  `description`, `order`, `title`, `runsIn`, `invoke`, `pipeline: false`, `next: null`).
```

bằng

```markdown
- **Skill mới** → thêm `plugins/<id>/skills/<skill-id>/SKILL.md` với frontmatter (`name`,
  `description`, `order`, `title`, `runsIn`, `invoke`).
```

`plugins/backend/shared/principles.md` dòng 17: `Đây là 2 skill độc lập (\`pipeline: false\`), gọi khi cần` → `Đây là 2 skill độc lập (recipe on-demand), gọi khi cần`.

`plugins/backend/skills/backend-migrate-architecture/README.md` dòng 4: `Recipe \`pipeline: false\`, gọi` → `Recipe on-demand, gọi`.

`CHANGELOG.md`, dưới `## [Unreleased]` thêm:

```markdown

### Changed

- Removed the dead `pipeline`, `next` and `stageNumber` frontmatter keys from every skill, workflow
  and the workflow template; the loader no longer exposes them, and the Antigravity `AGENTS.md`
  lists skills in a single group (the empty "Pipeline" section is gone).
```

- [ ] **Step 11: Chạy toàn bộ cổng**

Run: `npm test && npm run pack:verify`
Expected: exit 0; `validate` báo `0 fail`.

- [ ] **Step 12: Commit (sau khi chủ dự án duyệt diff)**

Message:

```text
refactor(skills): drop dead pipeline, next and stageNumber frontmatter

Bỏ ba trường frontmatter không còn tác dụng khỏi skill, workflow và template.

Changed:
- Xoá pipeline/next/stageNumber khỏi 35 SKILL.md, 13 WORKFLOW.md và workflow.template.md.
- Loader không còn trả ba key này; AGENTS.md của antigravity liệt kê skill trong một nhóm.
- Gỡ assert pipeline trong test/validate.mjs, thêm block 24 chặn tái xuất hiện.
- Cập nhật CLAUDE.md, README, principles backend và CHANGELOG.

Reason:
- Cả 48 file đều pipeline false và next null; khái niệm pipeline đã bỏ từ lâu.
- AGENTS.md antigravity đang in mục "Thứ tự bắt buộc" rỗng.
```

```bash
git add -A cli/lib/plugins.mjs adapters/_shared/lib.mjs test/validate.mjs core plugins workflows templates/workflows CLAUDE.md README.md README_VI.md CHANGELOG.md
MSG="$(node -p "require('os').tmpdir()")/aip-commit-msg.txt"   # ghi message ở trên vào file này (UTF-8), rồi:
git commit -F "$MSG"
```

---

### Task 2: A2 — Khung H2 bắt buộc cho `SKILL.md`

**Files:**
- Create: `cli/lib/conventions.mjs`
- Modify: `test/validate.mjs` (import; block `// 25.`)
- Modify: 10 skill có `## Luồng …`, `engineering-release-notes` (thân + `references/scope-and-grouping.md`), `backend-implement`, `frontend-implement`, `backend-performance`, `frontend-performance`, `data-db-migration`, 4 skill `*-init`
- Modify: `CLAUDE.md:72`, `README.md`, `README_VI.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: không.
- Produces: `cli/lib/conventions.mjs` export `SKILL_HEADINGS: Array<[string, RegExp]>`, `checkSkillBody(body: string): string[]` (mảng lỗi, rỗng = hợp lệ).

- [ ] **Step 1: Viết test đỏ (block 25)**

Thêm import (sau dòng import `agentsFiles` ở Task 1):

```js
import { checkSkillBody } from '../cli/lib/conventions.mjs';
```

Chèn block:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 25. Chuẩn hoá A2: khung H2 SKILL.md (spec 2026-10-06 §4.2)
// ─────────────────────────────────────────────────────────────────────────────
{
  ok(checkSkillBody('## Quy trình\nx\n## Ranh giới an toàn\nx').length === 0, 'checkSkillBody: đủ 2 heading → hợp lệ');
  ok(checkSkillBody('## Quy trình (trung tính stack) — cổng\n## Ranh giới an toàn (CLAUDE.md)').length === 0,
    'checkSkillBody: cho phép hậu tố sau dấu cách');
  ok(checkSkillBody('## Luồng viết spec\n## Ranh giới an toàn').some((e) => e.includes('Quy trình')),
    'checkSkillBody: "## Luồng …" không thay được "## Quy trình"');
  ok(checkSkillBody('## Quy trình\n## Ranh giới').some((e) => e.includes('Ranh giới an toàn')),
    'checkSkillBody: "## Ranh giới" trần không đạt');
  ok(checkSkillBody('## Quy trìnhX\n## Ranh giới an toàn').length === 1, 'checkSkillBody: chữ dính sau tên heading không đạt');
  ok(checkSkillBody('### Quy trình\n## Ranh giới an toàn').length === 1, 'checkSkillBody: H3 không thay được H2');
  for (const s of [...core.stages, ...plugins.flatMap((p) => p.stages)]) {
    const errs = checkSkillBody(s.body);
    ok(errs.length === 0, `${s.id}: khung SKILL.md hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
  }
}
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `node test/validate.mjs`
Expected: FAIL vì không tìm thấy module `../cli/lib/conventions.mjs` (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Tạo `cli/lib/conventions.mjs`**

```js
// Helper THUẦN kiểm quy ước SKILL.md và description (spec 2026-10-06 §4.2–4.3).
// Zero-dependency; không đọc đĩa để validator test được bằng chuỗi.

// Cho phép hậu tố sau dấu cách ("## Quy trình — cổng F1–F5") để không phải đổi heading đang mang nghĩa.
export const SKILL_HEADINGS = [
  ['Quy trình', /^## Quy trình(?: .*)?$/m],
  ['Ranh giới an toàn', /^## Ranh giới an toàn(?: .*)?$/m],
];

export function checkSkillBody(body) {
  return SKILL_HEADINGS.filter(([, re]) => !re.test(body)).map(([h]) => `thiếu heading "## ${h}"`);
}
```

- [ ] **Step 4: Chạy để thấy test đơn vị xanh, dữ liệu thật đỏ**

Run: `node test/validate.mjs`
Expected: FAIL đúng 19 skill: 10 skill `Luồng …` (thiếu Quy trình), `backend-implement`, `frontend-implement`, 4 `*-init` (thiếu Ranh giới an toàn), `backend-performance`, `frontend-performance`, `data-db-migration` (thiếu Quy trình). 6 assert đơn vị đều pass.

- [ ] **Step 5: Đổi heading bằng script một lần**

Lưu thành `<tmpdir>/aip-rename-headings.mjs`:

```js
// Script một lần (không commit): đổi heading theo spec 2026-10-06 §4.2; mỗi chuỗi cũ phải xuất hiện đúng số lần dự kiến.
import fs from 'node:fs';

const EDITS = [
  ['plugins/engineering/skills/engineering-adr/SKILL.md', '## Luồng viết ADR', '## Quy trình — viết ADR', 1],
  ['plugins/engineering/skills/engineering-convention-enforce/SKILL.md', '## Luồng kiểm & enforce', '## Quy trình — kiểm & enforce', 1],
  ['plugins/engineering/skills/engineering-diagram/SKILL.md', '## Luồng sinh diagram', '## Quy trình — sinh diagram', 1],
  ['plugins/engineering/skills/engineering-quality-gate/SKILL.md', '## Luồng quality + security gate', '## Quy trình — quality + security gate', 1],
  ['plugins/engineering/skills/engineering-release-notes/SKILL.md', '## Luồng viết release notes', '## Quy trình — viết release notes', 1],
  ['plugins/engineering/skills/engineering-spec-writing/SKILL.md', '## Luồng viết spec', '## Quy trình — viết spec', 1],
  ['plugins/ops/skills/ops-deploy-release/SKILL.md', '## Luồng deploy / release', '## Quy trình — deploy / release', 1],
  ['plugins/ops/skills/ops-incident-troubleshooting/SKILL.md', '## Luồng điều tra sự cố', '## Quy trình — điều tra sự cố', 1],
  ['plugins/ops/skills/ops-observability/SKILL.md', '## Luồng observability', '## Quy trình — observability', 1],
  ['core/skills/git-workflow/SKILL.md', '## Luồng commit & push', '## Quy trình — commit & push', 1],
  ['core/skills/git-workflow/SKILL.md', '## Luồng changelog / release notes', '## Quy trình — changelog / release notes', 1],
  ['plugins/engineering/skills/engineering-release-notes/SKILL.md', '`Luồng changelog / release notes`', '`Quy trình — changelog / release notes`', 4],
  ['plugins/engineering/skills/engineering-release-notes/references/scope-and-grouping.md', '`Luồng changelog / release notes`', '`Quy trình — changelog / release notes`', 1],
  ['plugins/backend/skills/backend-implement/SKILL.md', '\n## Ranh giới\n', '\n## Ranh giới an toàn\n', 1],
  ['plugins/frontend/skills/frontend-implement/SKILL.md', '\n## Ranh giới\n', '\n## Ranh giới an toàn\n', 1],
  ['plugins/backend/skills/backend-performance/SKILL.md', '\n## Hai chế độ\n', '\n## Quy trình — hai chế độ\n', 1],
  ['plugins/frontend/skills/frontend-performance/SKILL.md', '\n## Hai chế độ\n', '\n## Quy trình — hai chế độ\n', 1],
];

for (const [f, from, to, count] of EDITS) {
  const text = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const n = text.split(from).length - 1;
  if (n !== count) throw new Error(`${f}: "${from}" xuất hiện ${n} lần, dự kiến ${count}`);
  fs.writeFileSync(f, text.split(from).join(to));
}

// data-db-migration: bọc Bước 0 + hai chế độ dưới "## Quy trình", hạ mỗi cấp một bậc.
const dbm = 'plugins/data/skills/data-db-migration/SKILL.md';
let t = fs.readFileSync(dbm, 'utf8').replace(/\r\n/g, '\n');
const before = t;
t = t.replace(/^### ([AC]\d\. )/gm, '#### $1')
  .replace(/^## (Chế độ (?:ADOPT|CHANGE) — )/gm, '### $1')
  .replace('\n## Bước 0 — Chọn chế độ\n', '\n## Quy trình\n\n### Bước 0 — Chọn chế độ\n');
if (t === before || !t.includes('\n## Quy trình\n')) throw new Error('data-db-migration: không đổi được heading');
fs.writeFileSync(dbm, t);
console.log('Đã đổi heading');
```

Run: `node "$(node -p "require('os').tmpdir()")/aip-rename-headings.mjs"`
Expected: `Đã đổi heading`

Kiểm `data-db-migration`:

Run: `grep -n "^#" plugins/data/skills/data-db-migration/SKILL.md`
Expected (theo thứ tự): `# …`, `## Ranh giới với skill lân cận`… (phần đầu không đổi), `## Tiền đề`, `## Ranh giới an toàn (CLAUDE.md)`, `## Quy trình`, `### Bước 0 — Chọn chế độ`, `### Chế độ ADOPT — áp công cụ migration`, `#### A1. Nạp context` … `#### A7. Verify + báo cáo`, `### Chế độ CHANGE — viết một thay đổi schema`, `#### C1. Nhận diện` … `#### C5. Bàn giao`, `## Report trả về`, `## Rủi ro còn lại (luôn nêu)`.

- [ ] **Step 6: Thêm mục an toàn cho 4 skill `*-init`**

Nội dung chỉ gom các quy tắc đã có trong chính skill (Tiền đề + Quy trình), không thêm quy tắc mới.

`plugins/backend/skills/backend-init/SKILL.md`: chèn ngay trước dòng `## Ghi chú`:

```markdown
## Ranh giới an toàn

- Cấu trúc đã tồn tại → KHÔNG ghi đè, báo lại; khi copy `templates/` chỉ thêm file chưa có.
- CHỈ scaffold tài liệu: KHÔNG sinh code skeleton, KHÔNG viết code thực thi.
- Con người chốt phương án và duyệt diff trước commit.

```

`plugins/frontend/skills/frontend-init/SKILL.md` (không có `## Ghi chú`): nối vào cuối file, sau dòng `4. KHÔNG viết code thực thi — mới chỉ scaffold.`:

```markdown

## Ranh giới an toàn

- Cấu trúc đã tồn tại → KHÔNG ghi đè, báo lại; khi copy `templates/` chỉ thêm file chưa có.
- CHỈ scaffold tài liệu: KHÔNG copy/sinh skeleton code, KHÔNG viết code thực thi.
- Con người chốt phương án UX/IA và duyệt diff.
```

`plugins/data/skills/data-oltp-init/SKILL.md`: chèn ngay trước dòng `## Ghi chú`:

```markdown
## Ranh giới an toàn

- Cấu trúc đã tồn tại → KHÔNG ghi đè, báo lại; khi copy `templates/` chỉ thêm file chưa có.
- CHỈ scaffold tài liệu: KHÔNG sinh code skeleton, KHÔNG sinh DDL/migration thật, KHÔNG viết code thực thi.
- Con người chốt phương án và duyệt diff.

```

`plugins/data/skills/data-olap-init/SKILL.md`: chèn ngay trước dòng `## Ghi chú`:

```markdown
## Ranh giới an toàn

- Cấu trúc đã tồn tại → KHÔNG ghi đè, báo lại; khi copy `templates/` chỉ thêm file chưa có.
- CHỈ scaffold tài liệu: KHÔNG sinh code skeleton, KHÔNG sinh transform thật, KHÔNG viết code thực thi.
- Con người chốt phương án mô hình/nguồn và duyệt diff.

```

- [ ] **Step 7: Chạy để thấy xanh + diff chỉ là heading/mục mới**

Run: `node test/validate.mjs`
Expected: `0 fail`

Run: `git diff -U0 -- plugins core | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '^[-+]#' | grep -v '`Quy trình — changelog / release notes`\|`Luồng changelog / release notes`'`
Expected: chỉ các dòng `+` của 4 mục "Ranh giới an toàn" mới (bullet và dòng trống) và 1 dòng trống thêm sau `## Quy trình` của `data-db-migration`. Không có dòng `-` nào ngoài heading.

- [ ] **Step 8: Tài liệu**

`CLAUDE.md` dòng 72, sau `(frontmatter: \`name\`, \`description\`, \`order\`, \`title\`, \`runsIn\`, \`invoke\`).` chèn câu: ` The body must have \`## Quy trình…\` and \`## Ranh giới an toàn…\` H2 headings (a suffix after a space is allowed; checked by \`cli/lib/conventions.mjs\`).`

`README.md`: thêm bullet con ngay dưới bullet **New skill**:

```markdown
  The body must have `## Quy trình…` and `## Ranh giới an toàn…` H2 headings (a suffix after a
  space is allowed), enforced by `test/validate.mjs`.
```

`README_VI.md`: thêm dưới bullet **Skill mới** (sau dòng `` `skills/<skill>/references/`. ``):

```markdown
  Thân skill phải có H2 `## Quy trình…` và `## Ranh giới an toàn…` (cho phép hậu tố sau dấu
  cách), do `test/validate.mjs` kiểm.
```

`CHANGELOG.md`, thêm vào `### Changed` của `[Unreleased]`:

```markdown
- `SKILL.md` must have `## Quy trình…` and `## Ranh giới an toàn…` headings (`cli/lib/conventions.mjs`);
  headings normalised in 15 skills and the 4 `*-init` skills gained a safety section built from rules
  they already stated.
```

- [ ] **Step 9: Chạy toàn bộ cổng**

Run: `npm test && npm run pack:verify`
Expected: exit 0.

- [ ] **Step 10: Commit (sau khi chủ dự án duyệt diff)**

```text
refactor(skills): enforce Quy trình and Ranh giới an toàn headings

Ép khung H2 tối thiểu cho mọi SKILL.md bằng validator.

Changed:
- Thêm cli/lib/conventions.mjs với SKILL_HEADINGS và checkSkillBody.
- Đổi "## Luồng …" thành "## Quy trình — …" ở 10 skill, "## Ranh giới" thành "## Ranh giới an toàn" ở 2 skill.
- backend-performance/frontend-performance: "## Hai chế độ" thành "## Quy trình — hai chế độ".
- data-db-migration: bọc Bước 0 và hai chế độ dưới "## Quy trình", hạ cấp heading con.
- Thêm "## Ranh giới an toàn" cho 4 skill init, chỉ gom quy tắc đã có.
- Block 25 trong test/validate.mjs; cập nhật CLAUDE.md, README, CHANGELOG.

Reason:
- Skill chưa có khung bắt buộc, có khoảng 40 biến thể heading.
```

```bash
git add -A cli/lib/conventions.mjs test/validate.mjs core plugins CLAUDE.md README.md README_VI.md CHANGELOG.md
MSG="$(node -p "require('os').tmpdir()")/aip-commit-msg.txt"   # ghi message ở trên vào file này (UTF-8), rồi:
git commit -F "$MSG"
```

---

### Task 3: A3 — Rule description + viết lại 48 description

**Files:**
- Modify: `cli/lib/conventions.mjs` (thêm hằng + 4 hàm)
- Modify: `test/validate.mjs` (import; `warn`; block `// 26.`; in cảnh báo ở cuối)
- Modify: dòng `description:` của 35 `SKILL.md` + 13 `WORKFLOW.md`
- Modify: `CLAUDE.md:72`, `README.md`, `README_VI.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `cli/lib/conventions.mjs` từ Task 2; `whenToUse` (import ở Task 1).
- Produces: export `DESCRIPTION_MAX = 1024`, `FIRST_SENTENCE_MAX = 200`, `NOT_FOR = 'Không dùng khi'`, `quotedPhrases(desc: string): string[]`, `notForTargets(desc: string): string[] | null`, `checkDescription(desc: string, knownIds: Set<string>, selfId: string): string[]`, `triggerCollisions(entries: Array<{id: string, kind: 'skill'|'workflow', description: string}>): string[]`.

- [ ] **Step 1: Viết test đỏ (block 26 + cơ chế cảnh báo)**

Đổi import `checkSkillBody` thành:

```js
import { checkSkillBody, checkDescription, notForTargets, quotedPhrases, triggerCollisions, FIRST_SENTENCE_MAX } from '../cli/lib/conventions.mjs';
```

Ngay dưới dòng `const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };` thêm:

```js
const warns = [];
const warn = (cond, msg) => { if (!cond) warns.push(msg); };
```

Ở cuối file, ngay sau `console.log('');` (dòng trước `if (fails.length) {`) thêm:

```js
if (warns.length) {
  console.log('CẢNH BÁO (không chặn):');
  for (const w of warns) console.log('  ! ' + w);
}
```

Chèn block:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 26. Chuẩn hoá A3: description (spec 2026-10-06 §4.3, §10)
// ─────────────────────────────────────────────────────────────────────────────
{
  const known26 = new Set(['a-b', 'c-d', 'workflow-x']);
  ok(checkDescription('Làm X. Không dùng khi Y → a-b.', known26, 'c-d').length === 0, 'checkDescription: hợp lệ');
  ok(checkDescription('Làm X.', known26, 'c-d').some((e) => e.includes('thiếu câu')), 'checkDescription: thiếu câu Không dùng khi');
  ok(checkDescription('Làm X. Không dùng khi Y.', known26, 'c-d').some((e) => e.includes('không có')),
    'checkDescription: câu Không dùng khi không có đích');
  ok(checkDescription('Làm X. Không dùng khi Y → z-z.', known26, 'c-d').some((e) => e.includes('z-z')),
    'checkDescription: đích không tồn tại');
  ok(checkDescription('Làm X. Không dùng khi Y → c-d.', known26, 'c-d').some((e) => e.includes('chính nó')),
    'checkDescription: trỏ vào chính nó');
  ok(checkDescription('Làm X. KHÔNG thuộc pipeline bắt buộc; gọi khi cần. Không dùng khi Y → a-b.', known26, 'c-d')
    .some((e) => e.includes('pipeline')), 'checkDescription: còn câu pipeline');
  ok(checkDescription(`${'x'.repeat(1020)}. Không dùng khi Y → a-b.`, known26, 'c-d').some((e) => e.includes('1024')),
    'checkDescription: quá 1024 ký tự');
  ok(JSON.stringify(notForTargets('Làm X v.v. Không dùng khi Y, v.v. → a-b; Z →c-d; W → `workflow-x`.'))
    === '["a-b","c-d","workflow-x"]', 'notForTargets: chịu "v.v.", mũi tên dính, backtick');
  ok(notForTargets('Làm X.') === null, 'notForTargets: không có câu → null');
  ok(JSON.stringify(quotedPhrases('muốn "OpenAPI", " openapi " — chữ "skill"')) === '["openapi","openapi"]',
    'quotedPhrases: chữ thường, trim, bỏ "skill"');
  const col26 = triggerCollisions([
    { id: 'a-b', kind: 'skill', description: 'Dùng khi "Sửa Lỗi". Không dùng khi Y → c-d.' },
    { id: 'c-d', kind: 'skill', description: 'Dùng khi "sửa lỗi ". Không dùng khi Y → a-b.' },
    { id: 'e-f', kind: 'skill', description: 'Dùng khi "release". Không dùng khi Y → workflow-x.' },
    { id: 'g-h', kind: 'skill', description: 'Dùng khi "deploy". Không dùng khi Y → a-b.' },
    { id: 'workflow-x', kind: 'workflow', description: 'Dùng khi "release", "deploy". Không dùng khi Y → a-b.' },
  ]);
  ok(col26.some((e) => e.includes('"sửa lỗi"') && e.includes('a-b') && e.includes('c-d')),
    'triggerCollisions: trùng skill ↔ skill (khác hoa/thường, khoảng trắng) → lỗi');
  ok(!col26.some((e) => e.includes('e-f')), 'triggerCollisions: skill ↔ workflow có "→ workflow-x" → hợp lệ');
  ok(col26.some((e) => e.includes('g-h') && e.includes('workflow-x')), 'triggerCollisions: skill ↔ workflow không trỏ → lỗi');

  const all26 = [
    ...core.stages.map((s) => ({ ...s, kind: 'skill' })),
    ...plugins.flatMap((p) => p.stages.map((s) => ({ ...s, kind: 'skill' }))),
    ...(workflows ? workflows.stages.map((s) => ({ ...s, kind: 'workflow' })) : []),
  ];
  const ids26 = new Set([...all26.map((s) => s.id), ...allAgents.map((a) => a.id)]);
  for (const s of all26) {
    const errs = checkDescription(s.description, ids26, s.id);
    ok(errs.length === 0, `${s.id}: description hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
  }
  const real26 = triggerCollisions(all26.map((s) => ({ id: s.id, kind: s.kind, description: s.description })));
  ok(real26.length === 0, `không có trigger trùng${real26.length ? ' — ' + real26.join(' | ') : ''}`);
  const longFirst = all26.filter((s) => [...whenToUse(s)].length > FIRST_SENTENCE_MAX).map((s) => s.id);
  warn(longFirst.length === 0, `${longFirst.length}/${all26.length} description có câu đầu > ${FIRST_SENTENCE_MAX} ký tự `
    + `(render ở AGENTS.md antigravity), vd ${longFirst.slice(0, 5).join(', ')}`);
}
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `node test/validate.mjs`
Expected: FAIL `SyntaxError`/`does not provide an export named 'checkDescription'`.

- [ ] **Step 3: Thêm hàm vào `cli/lib/conventions.mjs`**

Nối vào cuối file:

```js
// Giới hạn của Agent Skills (platform.claude.com, mục "Skill structure"); bộ zip Cowork được upload lên claude.ai.
export const DESCRIPTION_MAX = 1024;
// whenToUse() render câu đầu vào mục lục AGENTS.md của antigravity; câu quá dài làm mục lục khó đọc.
export const FIRST_SENTENCE_MAX = 200;
export const NOT_FOR = 'Không dùng khi';
const GENERIC = new Set(['skill', 'workflow']);

export function quotedPhrases(desc) {
  return [...desc.matchAll(/"([^"]{2,80})"/g)].map((m) => m[1].trim().toLowerCase()).filter((p) => !GENERIC.has(p));
}

// Câu "Không dùng khi" luôn đứng cuối, nên lấy mọi "→ <id>" từ đó tới hết; tách câu theo dấu chấm sẽ hỏng với "v.v.".
export function notForTargets(desc) {
  const i = desc.indexOf(NOT_FOR);
  if (i === -1) return null;
  return [...desc.slice(i).matchAll(/→\s*`?([a-z][a-z0-9-]*)`?/g)].map((m) => m[1]);
}

export function checkDescription(desc, knownIds, selfId) {
  const errs = [];
  const len = [...desc].length;
  if (len > DESCRIPTION_MAX) errs.push(`dài ${len} ký tự (tối đa ${DESCRIPTION_MAX})`);
  if (desc.includes('KHÔNG thuộc pipeline')) errs.push('còn câu "KHÔNG thuộc pipeline…" (khái niệm pipeline đã bỏ)');
  const targets = notForTargets(desc);
  if (targets === null) errs.push(`thiếu câu "${NOT_FOR} … → <id>"`);
  else if (!targets.length) errs.push(`câu "${NOT_FOR}" không có "→ <id>"`);
  else {
    for (const t of targets) {
      if (t === selfId) errs.push(`"→ ${t}" trỏ vào chính nó`);
      else if (!knownIds.has(t)) errs.push(`"→ ${t}" không phải id skill/workflow/agent có thật`);
    }
  }
  return errs;
}

// Trùng trigger giữa hai skill làm mô hình chọn tuỳ ý; trùng skill ↔ workflow chỉ hợp lệ khi skill trỏ sang workflow.
export function triggerCollisions(entries) {
  const owners = new Map();
  for (const e of entries) {
    for (const p of new Set(quotedPhrases(e.description))) {
      if (!owners.has(p)) owners.set(p, []);
      owners.get(p).push(e);
    }
  }
  const errs = [];
  for (const [p, es] of owners) {
    const skills = es.filter((e) => e.kind === 'skill');
    const wfs = es.filter((e) => e.kind === 'workflow');
    if (skills.length > 1) errs.push(`"${p}" trùng giữa skill ${skills.map((e) => e.id).join(', ')}`);
    for (const s of skills) {
      for (const w of wfs) {
        if (!(notForTargets(s.description) || []).includes(w.id)) {
          errs.push(`"${p}" trùng ${s.id} ↔ ${w.id} nhưng ${s.id} không trỏ "→ ${w.id}"`);
        }
      }
    }
  }
  return errs;
}
```

- [ ] **Step 4: Chạy để thấy test đơn vị xanh, dữ liệu thật đỏ**

Run: `node test/validate.mjs`
Expected: FAIL chỉ ở dữ liệu thật: 48 lỗi `description hợp lệ` (thiếu "Không dùng khi", 44 file còn câu pipeline, 12 file quá 1024) và 1 lỗi `không có trigger trùng`. Mọi assert đơn vị block 26 pass.

- [ ] **Step 5: Viết lại 48 description bằng script một lần**

26 description giữ nguyên nội dung, chỉ đổi trigger trùng, bỏ câu pipeline và nối câu "Không dùng khi". 22 description sẽ vượt 1024 nên thay toàn bộ bằng bản rút gọn: giữ nguyên danh sách trigger và các cụm mà `test/validate.mjs` đang assert (`N+1`, `oracle`, `-implement`, `-refactor`, `backend-fix`, `backend-testing`, `frontend-fix`, `frontend-testing`, `frontend-e2e-testing`). Chi tiết bị lược vẫn có trong thân `SKILL.md`. Lúc lập plan, script đã chạy thử trên bản sao tạm của repo và cho đúng kết quả mô phỏng (max 1.006 ký tự, 0 trigger trùng).

Lưu thành `<tmpdir>/aip-rewrite-descriptions.mjs`:

```js
// Script một lần (không commit): ghi lại description theo spec 2026-10-06 §4.3.
import fs from "node:fs";
import path from "node:path";

const NOT_FOR = {
  "git-workflow": {"renames":[["\"release\"","\"release branch\""]],"notFor":"Không dùng khi cần viết nội dung changelog/release notes hướng người dùng → engineering-release-notes; chuẩn bị cả đợt phát hành (quality gate, release notes, deploy checklist) → workflow-release."},
  "backend-init": {"notFor":"Không dùng khi project đã có mã nguồn và cần đổi kiến trúc → backend-migrate-architecture; cần externalize config/secret → backend-migrate-vault-consul."},
  "backend-implement": {"notFor":"Không dùng khi contract API chưa chốt → backend-api-contract; làm feature end-to-end nhiều bước → workflow-feature."},
  "backend-testing": {"notFor":"Không dùng khi test luồng đầu-cuối qua UI → frontend-e2e-testing; cần quy trình viết test có phân loại failure và commit → workflow-testing."},
  "backend-migrate-vault-consul": {"notFor":"Không dùng khi chỉ cần quét secret bị lộ trong mã nguồn → engineering-quality-gate."},
  "backend-migrate-architecture": {"notFor":"Không dùng khi chỉ dọn code trong kiến trúc hiện tại → backend-refactor; cần quy trình đổi kiến trúc có ADR, characterization test và commit theo lô → workflow-refactor."},
  "backend-api-contract": {"notFor":"Không dùng khi cần làm API end-to-end (contract, code, test, commit) → workflow-api; hiện thực code theo contract đã chốt → backend-implement."},
  "data-oltp-init": {"notFor":"Không dùng khi schema thuộc một app backend, không phải database project dùng chung → data-db-migration; cần kho/pipeline phân tích → data-olap-init."},
  "data-olap-init": {"notFor":"Không dùng khi cần database vận hành OLTP → data-oltp-init."},
  "engineering-diagram": {"notFor":"Không dùng khi cần viết cả spec yêu cầu → engineering-spec-writing."},
  "frontend-init": {"notFor":"Không dùng khi project đã có mã nguồn React và cần đổi kiến trúc → frontend-migrate-architecture."},
  "frontend-implement": {"notFor":"Không dùng khi cần nối API thật → frontend-data-integration; làm feature end-to-end → workflow-feature."},
  "frontend-testing": {"notFor":"Không dùng khi test luồng đầu-cuối bằng Playwright → frontend-e2e-testing; cần quy trình viết test có phân loại failure và commit → workflow-testing."},
  "workflow-orchestrator": {"notFor":"Không dùng khi việc cần làm đã rõ là sửa bug → workflow-bugfix; làm feature → workflow-feature."},
  "workflow-feature": {"notFor":"Không dùng khi chỉ sửa lỗi hành vi đã có → workflow-bugfix."},
  "workflow-bugfix": {"notFor":"Không dùng khi hệ thống production đang sập → workflow-incident."},
  "workflow-refactor": {"notFor":"Không dùng khi đổi hành vi → workflow-feature."},
  "workflow-code-review": {"notFor":"Không dùng khi cần thêm tính năng → workflow-feature; cần sửa lỗi → workflow-bugfix."},
  "workflow-testing": {"notFor":"Không dùng khi failure là lỗi code cần sửa → workflow-bugfix."},
  "workflow-security-review": {"notFor":"Không dùng khi chỉ cần quality gate trước release → workflow-release."},
  "workflow-db-change": {"notFor":"Không dùng khi không đổi schema, chỉ đổi query/logic để thêm tính năng → workflow-feature; để sửa lỗi → workflow-bugfix."},
  "workflow-api": {"notFor":"Không dùng khi không cần contract mới, chỉ đổi logic nội bộ để thêm tính năng → workflow-feature; để sửa lỗi → workflow-bugfix."},
  "workflow-performance": {"notFor":"Không dùng khi chậm do lỗi logic rõ ràng, không phải hiệu năng → workflow-bugfix."},
  "workflow-incident": {"notFor":"Không dùng khi lỗi tái hiện được ở local, production vẫn ổn → workflow-bugfix."},
  "workflow-release": {"notFor":"Không dùng khi chưa sẵn sàng phát hành, cần thêm tính năng trước → workflow-feature; cần sửa lỗi trước → workflow-bugfix."},
  "workflow-docs": {"notFor":"Không dùng khi cần đổi hành vi/code để thêm tính năng → workflow-feature; để sửa lỗi → workflow-bugfix."},
};

const FULL = {
  "engineering-quality-gate": "Skill capability (plugin engineering) chạy quality + security gate trên mã nguồn: TOOL GATE (SonarQube, Black Duck SCA, Trivy thay thế) và SECURITY REVIEW SOURCE-FIRST theo OWASP Top 10 / ASVS / CWE, scanner chỉ là enrichment. Gộp và triage findings, tự sửa lỗi rõ ràng (con người DUYỆT DIFF), xuất report có evidence + residual risk + mask secret. Chạy scanner CLI tại chỗ hoặc đọc report/BOM/SARIF đã xuất, không gọi web API. Dùng skill NÀY khi người dùng muốn \"quét sonar\", \"chạy sonarqube\", \"check black duck\", \"quét bảo mật phụ thuộc\", \"security review\", \"review bảo mật code\", \"quality gate\", \"sửa lỗi sonar\", \"fix từ report\", \"review chất lượng code\", \"kiểm tra lỗ hổng dependency\" — kể cả khi không nói chính xác chữ \"skill\". Không dùng khi cần quy trình bảo mật đầy đủ (threat model, remediation, re-scan, commit) → workflow-security-review; review correctness/thiết kế → backend-code-review; review frontend → frontend-code-review.",
  "ops-incident-troubleshooting": "Skill vận hành (plugin ops) hướng dẫn TRIAGE & ĐIỀU TRA sự cố production an toàn: chốt phạm vi (triệu chứng, thời điểm, blast radius), khoanh vùng theo tầng (edge → app → DB → dependency → infra), đọc log/metric/trace và tương quan timeline, đặt giả thuyết rồi kiểm chứng bằng bằng chứng cụ thể, ĐỀ XUẤT mitigation kèm rủi ro, viết RCA + residual risk. Read-only + đề xuất là mặc định: KHÔNG tự sửa/khởi động lại/rollback/đụng prod khi chưa xác nhận; mask secret. Dùng skill NÀY khi người dùng muốn \"điều tra sự cố\", \"incident\", \"prod lỗi\", \"server down\", \"điều tra lỗi production\", \"triage\", \"RCA\", \"đọc log lỗi\", \"500 error\", \"service chậm\", \"khoanh vùng lỗi\" — kể cả khi không nói chính xác chữ \"skill\". Con người DUYỆT trước mọi tác động production. Không dùng khi cần quy trình sự cố đầy đủ (mitigation, xác minh phục hồi, commit RCA) → workflow-incident; lỗi tái hiện được ở local → workflow-bugfix.",
  "frontend-performance": "Recipe on-demand: ĐO và PROFILE hiệu năng FRONTEND (React/TypeScript). Chế độ measure chốt bảng điều kiện đo, chạy Lighthouse CLI ≥3 lần trên bản build production ở local, báo median LCP/TBT/CLS, bundle size và độ lệch (số lab, TBT không phải INP); chế độ profile tìm bottleneck theo thứ tự bundle → render → main thread có evidence và đề xuất file/component cho frontend-fix. Chỉ chạy local/test, từ chối staging/production và dịch vụ đo bên thứ ba; thiếu môi trường → not_run. KHÔNG sửa code; KHÔNG thay test đúng/sai (đó là frontend-testing/frontend-e2e-testing). Dùng skill NÀY khi người dùng muốn \"đo hiệu năng frontend\", \"Lighthouse\", \"LCP\", \"bundle size\", \"profile React\", \"render chậm\", \"trang tải chậm\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi cần cả quy trình tối ưu (baseline, profile, sửa, so trước/sau, commit) → workflow-performance; sửa code theo bottleneck đã xác nhận → frontend-fix.",
  "ops-deploy-release": "Skill vận hành (plugin ops) hướng dẫn deploy/release một service an toàn: dò cấu hình deploy/CI và chốt scope release, chạy checklist tiền deploy (build/test/migration, backup + điểm rollback, feature flag), chọn chiến lược rolling / blue-green / canary kèm tiêu chí tiến/lùi, trình bày lệnh deploy/rollback chờ người xác nhận, verify hậu deploy bằng health/metric/smoke test, đóng checklist + residual risk. Đọc Dockerfile/compose/k8s/CI làm ràng buộc, KHÔNG dựng lại hạ tầng, KHÔNG lộ secret. Dùng skill NÀY khi người dùng muốn \"deploy\", \"release\", \"phát hành\", \"triển khai lên server\", \"rollback\", \"release checklist\", \"canary\", \"blue-green\", \"rolling update\" — kể cả khi không nói chính xác chữ \"skill\". Con người DUYỆT trước mọi tác động production. Không dùng khi cần cả quy trình phát hành (quality gate, release notes, version bump, hậu kiểm) → workflow-release; chỉ viết release notes → engineering-release-notes.",
  "ops-observability": "Skill vận hành (plugin ops) hướng dẫn THIẾT LẬP & ĐÁNH GIÁ observability cho một service: dò stack hiện có (Prometheus/Grafana/OpenTelemetry/ELK/Loki/Datadog) và health endpoint, ba trụ cột metrics/logs/traces, golden signals + SLI/SLO + error budget, alerting theo triệu chứng bám SLO chống alert fatigue, đánh giá độ phủ và ĐỀ XUẤT bổ sung. Docs-only + đề xuất là mặc định: KHÔNG tự đổi cấu hình monitoring/hạ tầng prod; KHÔNG lộ secret. Dùng skill NÀY khi người dùng muốn \"observability\", \"giám sát\", \"monitoring\", \"metrics/logs/traces\", \"alert\", \"cảnh báo\", \"SLO/SLI\", \"dashboard\", \"golden signals\" — kể cả khi không nói chính xác chữ \"skill\". Con người áp dụng vào hạ tầng thật. Không dùng khi đang có sự cố cần điều tra → ops-incident-troubleshooting; cần quy trình xử lý sự cố đầy đủ → workflow-incident.",
  "frontend-code-review": "Recipe on-demand: REVIEW một diff/PR/module FRONTEND (React/TypeScript) theo các TRỤC — correctness (state/effect, dependency array, race giữa request, key list, memo, loading/error/empty), bám boundary kiến trúc UI (Feature-Based/FSD/Micro-FE, public API, server-state ở React Query), đơn giản hoá & tái dùng, a11y, readability & naming theo code-convention, test coverage. Phân loại severity (blocker/major/minor/nit) + evidence file:line + đề xuất fix; READ-ONLY mặc định. Defer tái cấu trúc sang frontend-refactor. Dùng skill NÀY khi người dùng muốn \"review code frontend\", \"review PR React\", \"review component\", \"đánh giá code FE\", \"review diff frontend\", \"review UI code\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi cần quét bảo mật hoặc tool scan → engineering-quality-gate; review cả PR đa vai trò BE + FE → workflow-code-review.",
  "backend-code-review": "Recipe on-demand: REVIEW một diff/PR/module BACKEND (Java/Spring, Python) theo các TRỤC — correctness (edge/null/error-handling/race/resource-leak/transaction), bám kiến trúc (Dependency Rule, một transaction một aggregate, mapper ở biên), đơn giản hoá & tái dùng, readability & naming theo code-convention, hiệu năng (N+1, thiếu index, query trong vòng lặp — nhãn suspected khi chưa đo), test coverage. Phân loại severity (blocker/major/minor/nit) + evidence file:line + đề xuất fix; READ-ONLY mặc định. Defer tái cấu trúc sang backend-refactor. Dùng skill NÀY khi người dùng muốn \"review code backend\", \"review PR backend\", \"review API/service\", \"đánh giá code Java/Spring\", \"review Python backend\", \"review diff backend\", \"đọc soát PR\", \"nhận xét thiết kế backend\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi cần quét bảo mật hoặc tool scan → engineering-quality-gate; review cả PR đa vai trò BE + FE → workflow-code-review.",
  "frontend-refactor": "Recipe on-demand: REFACTOR mã nguồn FRONTEND (React/TypeScript) GIỮ NGUYÊN hành vi quan sát được — extract component/custom hook, lift/colocate state, bỏ prop drilling, tách presentational khỏi logic, gom style/token trùng, memoize hợp lý, bỏ useEffect thừa. Refactor TRONG ranh giới kiến trúc đã chốt (Feature-Based/FSD/Micro-FE). Cổng behavior-preserving: baseline XANH → characterization test cho vùng thiếu test → bước nhỏ XANH sau mỗi bước → con người duyệt diff. Dùng skill NÀY khi người dùng muốn \"refactor frontend\", \"tái cấu trúc React\", \"dọn component\", \"tách component/hook\", \"bỏ prop drilling\", \"giảm trùng lặp UI\", \"đơn giản hoá React\", \"tách logic khỏi JSX\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn React. Không dùng khi đổi kiểu kiến trúc → frontend-migrate-architecture; cần quy trình refactor nhiều bước có commit theo lô → workflow-refactor.",
  "engineering-convention-enforce": "Skill capability xuyên suốt (plugin engineering) để KIỂM và ENFORCE quy ước của project: đặt tên file/thư mục/định danh, cấu trúc thư mục, convention chung. Đối chiếu với `project-knowledge/code-convention.md` (+ source-structure/architecture/lint config nếu có), báo lệch có evidence `file:line` + rule nguồn, đề xuất sửa kèm severity. READ-ONLY mặc định; sửa hàng loạt CHỈ khi được yêu cầu và con người DUYỆT DIFF. Thiếu code-convention → fail-loud, không tự bịa chuẩn; đổi convention là quyết định kiến trúc. Docs-only recipe, không phải validator chạy được. Dùng skill NÀY khi người dùng muốn \"enforce convention\", \"kiểm quy ước\", \"chuẩn hoá đặt tên\", \"kiểm cấu trúc thư mục\", \"convention check\", \"lint quy ước\", \"áp chuẩn code convention\" — kể cả khi không nói chính xác chữ \"skill\". Không dùng khi cần đổi convention → engineering-adr; review correctness/thiết kế → backend-code-review; quét chất lượng bằng tool → engineering-quality-gate.",
  "backend-refactor": "Recipe on-demand: REFACTOR mã nguồn BACKEND (Java/Spring, Python) GIỮ NGUYÊN hành vi nghiệp vụ — extract method/class, gom trùng lặp đúng tầng, guard clause/polymorphism, tách god class, parameter object, đảo phụ thuộc qua port. Tôn trọng Dependency Rule của kiến trúc đã chốt; áp design pattern CHỈ khi gỡ được phức tạp thật (HỎI trước pattern lớn). Cổng behavior-preserving: baseline XANH → characterization test cho vùng thiếu test → bước nhỏ XANH sau mỗi bước → con người duyệt diff. Dùng skill NÀY khi người dùng muốn \"refactor backend\", \"tái cấu trúc code backend\", \"dọn code Java/Python\", \"giảm trùng lặp\", \"tách hàm/tách class\", \"đơn giản hoá code\", \"gỡ god class\", \"áp design pattern backend\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi đổi kiểu kiến trúc → backend-migrate-architecture; cần quy trình refactor nhiều bước có commit theo lô → workflow-refactor.",
  "backend-performance": "Recipe on-demand: ĐO và PROFILE hiệu năng BACKEND (Java/Spring, Python). Chế độ measure chốt bảng điều kiện đo, dùng script k6 ở perf/ hoặc micro-benchmark (JMH, pytest-benchmark) ở bench/, chạy ≥3 lần, báo p50/p95/p99, throughput, error rate và độ lệch; chế độ profile tìm bottleneck theo thứ tự DB (N+1, EXPLAIN ANALYZE) → CPU/alloc → I/O/pool/lock có evidence và đề xuất file/hàm cho backend-fix. Chỉ chạy local/test, từ chối staging/production; thiếu môi trường → not_run. KHÔNG sửa code production; KHÔNG thay test đúng/sai (đó là backend-testing). Dùng skill NÀY khi người dùng muốn \"đo hiệu năng backend\", \"load test\", \"benchmark\", \"profile\", \"tìm bottleneck\", \"p95/p99\", \"N+1\", \"query chậm\", \"latency API\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi cần cả quy trình tối ưu (baseline, profile, sửa, so trước/sau, commit) → workflow-performance; sửa code theo bottleneck đã xác nhận → backend-fix.",
  "frontend-e2e-testing": "Recipe on-demand: viết TEST ĐẦU-CUỐI bằng Playwright cho 3–5 luồng người dùng giá trị cao của FRONTEND React đã nối API thật — mỗi test map một acceptance criterion, đặt ở e2e/, selector theo role/label/text, không sleep cứng, baseURL/credential từ biến môi trường, CHỈ chạy local/test, đăng nhập một lần qua storageState, dữ liệu cô lập, chống flaky bằng --repeat-each=3, evidence bằng trace + report HTML. Test đỏ vì bug thật thì giữ đỏ và báo, KHÔNG sửa code production; KHÔNG tự cài @playwright/test hay browser khi chưa hỏi. Dùng skill NÀY khi người dùng muốn \"e2e\", \"end-to-end\", \"test đầu-cuối\", \"Playwright\", \"test luồng người dùng\", \"smoke test FE\", \"kiểm luồng xuyên FE-BE-DB\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có luồng nối API thật. Không dùng khi cần unit/integration test component → frontend-testing; đo hiệu năng → frontend-performance.",
  "frontend-fix": "Recipe on-demand: SỬA code FRONTEND có sẵn (React/TypeScript) theo MỘT oracle đỏ — failing test tái hiện bug, regression test của finding bảo mật, hoặc giả thuyết bottleneck đã xác nhận — trong phạm vi file khoanh TRƯỚC. Áp fix tối thiểu cho oracle chuyển xanh; KHÔNG đụng test/fixture/snapshot; KHÔNG sửa ngoài danh sách file (cần mở rộng → trả blocked); KHÔNG che triệu chứng (any, ts-ignore, eslint-disable, skip test, nới waitFor). Ba chế độ: bug / security / performance. Dùng skill NÀY khi người dùng muốn \"sửa bug React theo failing test\", \"fix finding bảo mật frontend\", \"sửa frontend theo root cause\", \"áp fix tối thiểu frontend\", \"tối ưu frontend theo bottleneck đã xác nhận\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn React. Không dùng khi chưa có oracle đỏ → workflow-bugfix; dựng UI mới → frontend-implement; dọn component giữ hành vi → frontend-refactor.",
  "frontend-migrate-architecture": "Recipe on-demand: tái cấu trúc mã nguồn FRONTEND (React) hiện có sang kiến trúc đích (Feature-Based, Feature-Sliced Design, Micro-Frontend), GIỮ NGUYÊN hành vi. Feature-Based/FSD: dời/gom file in-place, sửa import theo tầng/slice, ép ranh giới bằng import-boundary lint; Micro-Frontend: CHỈ lập KẾ HOẠCH phân rã, KHÔNG auto-move. Di chuyển theo lô nhỏ XANH-mỗi-bước, con người duyệt diff; xử lý cả project đã chạy frontend-init lẫn code cũ. Dùng skill NÀY khi người dùng muốn \"đổi kiến trúc frontend\", \"tái cấu trúc kiến trúc React\", \"chuyển sang Feature-Based/FSD\", \"áp Feature-Sliced Design\", \"tách Micro-Frontend\", \"restructure src frontend\", \"refactor cấu trúc UI\", \"dọn cấu trúc component\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn React. Không dùng khi chỉ dọn component trong ranh giới hiện tại → frontend-refactor; cần quy trình đổi kiến trúc có ADR và commit theo lô → workflow-refactor.",
  "engineering-release-notes": "Skill capability (plugin engineering) để từ LỊCH SỬ GIT (giữa 2 tag, khoảng ngày, N ngày gần nhất, hoặc nhóm commit) VIẾT changelog + release notes HƯỚNG NGƯỜI DÙNG: phân nhóm New Features / Improvements / Fixes / Breaking Changes / Security, lọc churn nội bộ, viết lại commit thành ngôn ngữ kết quả, nêu breaking change + cách migrate, giữ truy vết tag/hash/PR/ticket. Là bước hoàn tất sau khi git-workflow gom lịch sử. Docs-only: KHÔNG tự tag/release/push, KHÔNG bịa thay đổi; con người duyệt. Dùng skill NÀY khi người dùng muốn \"release notes\", \"changelog\", \"ghi chú phát hành\", \"tóm tắt thay đổi từ tag\", \"tổng hợp commit tuần/tháng\", \"what's new\", \"viết note cho bản phát hành\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần ở giai đoạn plan. Không dùng khi chỉ cần gom lịch sử git → git-workflow; chuẩn bị cả đợt phát hành → workflow-release.",
  "engineering-spec-writing": "Skill capability (plugin engineering) để KHẢO SÁT yêu cầu và VIẾT một feature/requirement spec GỌN vào docs/requests/<ngày>-<slug>/requirement.md + khung plan.md. Hỏi phần BA còn thiếu (mục tiêu, success criteria, actors, phạm vi, ràng buộc, NFR, edge case) rồi viết đặc tả MỨC FEATURE với acceptance criteria ĐO ĐƯỢC, link ADR + contract/data-model, nêu rủi ro/giả định/câu hỏi mở. Cần bộ artifact BA đầy đủ hay đặc tả SAP-specific ở Cowork → handoff cho FIS (fisba/fissap/fispm). Dùng skill NÀY khi người dùng muốn \"viết spec\", \"đặc tả yêu cầu\", \"làm tài liệu nghiệp vụ\", \"khảo sát yêu cầu\", \"feature spec\", \"requirement spec\", \"PRD gọn\", \"viết yêu cầu tính năng\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần ở giai đoạn plan. Không dùng khi cần ghi một quyết định kiến trúc → engineering-adr; làm feature end-to-end → workflow-feature.",
  "data-db-migration": "Recipe on-demand cho SCHEMA DATABASE của một BACKEND project, 2 chế độ: ADOPT — kiểm kê cơ chế schema hiện trạng (ddl-auto, DDL chạy tay), so sánh Flyway ↔ Liquibase bằng bằng chứng của project, DỪNG cho người dùng chọn rồi áp module migration; CHANGE — viết MỘT thay đổi schema an toàn theo expand/contract, kiểm rủi ro khoá bảng PostgreSQL, verify trên DB test theo chu trình từng công cụ. Template cho Java/Spring Boot + PostgreSQL; Python/Alembic chỉ có hướng dẫn. KHÔNG chạy migration lên production. Dùng skill NÀY khi người dùng muốn \"migrate db\", \"flyway\", \"liquibase\", \"công cụ migration\", \"bỏ ddl-auto\", \"quản lý schema\", \"database migration\", \"đổi schema\", \"thêm cột\", \"expand contract\", \"schema change\", \"migration an toàn\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi project đã chạy data-oltp-init → data-oltp-implement; cần quy trình đổi schema đầy đủ (review query, chạy thử DB test, commit) → workflow-db-change.",
  "frontend-data-integration": "Recipe on-demand: NỐI UI React đã dựng (presentational từ frontend-implement) với API THẬT theo contract OpenAPI ở docs/contracts/ — type sinh từ contract, data hook đúng tầng kiến trúc bằng TanStack Query, nối ở container/page (KHÔNG sửa presentational), đủ loading/error/empty/success, map DTO sang view model ở biên, map lỗi 401/4xx/5xx, test bằng msw. Lệch contract thì DỪNG và báo drift. KHÔNG quyết định lưu token/auth, KHÔNG thêm global store hay thư viện data khi chưa hỏi. Dùng skill NÀY khi người dùng muốn \"nối API\", \"gọi API cho màn hình\", \"tích hợp API vào React\", \"data hook\", \"sinh type từ OpenAPI\", \"nối data cho component\", \"thay mock bằng API thật\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã chạy frontend-init và đã có contract. Không dùng khi contract API chưa chốt → backend-api-contract; dựng UI từ thiết kế → frontend-implement.",
  "backend-fix": "Recipe on-demand: SỬA code BACKEND có sẵn (Java/Spring, Python) theo MỘT oracle đỏ — failing test tái hiện bug, regression test của finding bảo mật, hoặc giả thuyết bottleneck đã xác nhận — trong phạm vi file khoanh TRƯỚC. Áp fix tối thiểu cho oracle chuyển xanh; KHÔNG đụng test/fixture/snapshot; KHÔNG sửa ngoài danh sách file (cần mở rộng → trả blocked); KHÔNG che triệu chứng (nuốt exception, skip test, nới timeout, hạ log). Ba chế độ: bug / security / performance. Dùng skill NÀY khi người dùng muốn \"sửa bug theo failing test\", \"fix finding bảo mật\", \"sửa backend theo root cause\", \"áp fix tối thiểu backend\", \"tối ưu backend theo bottleneck đã xác nhận\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có mã nguồn. Không dùng khi chưa có oracle đỏ → workflow-bugfix; viết feature mới → backend-implement; dọn code giữ hành vi → backend-refactor.",
  "data-olap-implement": "Recipe hiện thực TRANSFORM/MODEL + PIPELINE cho DATA WAREHOUSE/LAKEHOUSE project OLAP: từ data-contract (schema đầu ra + grain + SLA) và kiến trúc phân tầng (do data-olap-init tạo) build transform trong pipelines/ (ingest → transform/model → serving), mô hình dimensional hoặc normalized, layer staging → intermediate → mart, transform idempotent/incremental, data-quality test làm cổng trước khi publish, lineage nguồn→đích; giữ DATA CONTRACT đã công bố. Dùng skill NÀY khi người dùng muốn \"build pipeline\", \"viết transform\", \"ETL/ELT\", \"data model warehouse\", \"dimensional model\", \"data quality test\", \"lineage\", \"build dataset\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG chạy pipeline lên dữ liệu production khi chưa duyệt. Gọi khi cần trên project đã chạy data-olap-init. Không dùng khi đổi schema database vận hành → data-oltp-implement.",
  "data-oltp-implement": "Recipe hiện thực SCHEMA VẬT LÝ cho DATABASE project OLTP: từ data-model + schema-conventions (do data-oltp-init tạo) sinh DDL (bảng/cột/kiểu/khoá/unique/check/index) + migration versioned theo expand-contract, REVERSIBLE (mỗi up có down), tương thích online (backfill theo lô) + DB object tối thiểu + seed idempotent trong root db/; giữ SCHEMA CONTRACT đã công bố cho consumer; test toàn vẹn chạy up/down trên DB tạm. Dùng skill NÀY khi người dùng muốn \"tạo schema database\", \"viết migration\", \"DDL\", \"expand-contract migration\", \"áp schema OLTP\", \"thêm bảng/cột\", \"seed dữ liệu\", \"schema change database project\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG tự áp migration lên production. Gọi khi cần trên project đã chạy data-oltp-init. Không dùng khi schema thuộc một app backend → data-db-migration; cần quy trình đổi schema có review query và commit → workflow-db-change.",
  "engineering-adr": "Skill capability (plugin engineering) để ĐIỀU PHỐI một quyết định kiến trúc/thiết kế rồi GHI thành ADR chuẩn (Nygard) vào docs/decisions/: làm rõ bối cảnh & forces, liệt kê 2–4 phương án kèm đánh đổi, chốt quyết định + lý do truy vết được, ghi hệ quả trung thực (cả tiêu cực + residual risk), đánh số tiếp theo convention, đặt Status, link spec + contract/data-model. Portable ra mọi provider. Dùng skill NÀY khi người dùng muốn \"viết ADR\", \"ghi quyết định kiến trúc\", \"architecture decision record\", \"quyết định thiết kế\", \"chọn phương án\", \"đánh đổi kiến trúc\", \"lưu lý do quyết định\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG tự quyết quyết định lớn thay người dùng (con người chốt Status). Gọi khi cần ở giai đoạn plan. Không dùng khi cần đặc tả yêu cầu tính năng → engineering-spec-writing.",
};

const files = [];
const scan = (dir, name) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name, name);
    if (e.isDirectory() && fs.existsSync(f)) files.push(f);
  }
};
scan("core/skills", "SKILL.md");
for (const p of fs.readdirSync("plugins", { withFileTypes: true })) {
  if (p.isDirectory() && !p.name.startsWith("_")) scan(path.join("plugins", p.name, "skills"), "SKILL.md");
}
scan("workflows", "WORKFLOW.md");

for (const f of files) {
  const text = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const id = text.match(/^name: (.+)$/m)[1].trim();
  const line = text.match(/^description: (".*")$/m);
  let d;
  if (FULL[id]) {
    d = FULL[id];
  } else {
    const p = NOT_FOR[id];
    if (!p) throw new Error(`Thiếu dữ liệu cho ${id}`);
    d = JSON.parse(line[1]);
    for (const [a, b] of p.renames || []) {
      if (!d.includes(a)) throw new Error(`${id}: không thấy ${a}`);
      d = d.replace(a, b);
    }
    if (p.drop) {
      if (!d.includes(p.drop)) throw new Error(`${id}: không thấy câu cần bỏ`);
      d = d.replace(p.drop, "");
    }
    d = d.replace(/ KHÔNG thuộc pipeline bắt buộc; gọi khi cần.$/, "").replace("KHÔNG thuộc pipeline bắt buộc; gọi khi cần", "Gọi khi cần");
    d = `${d.trimEnd()} ${p.notFor}`;
  }
  fs.writeFileSync(f, text.replace(line[0], () => `description: ${JSON.stringify(d)}`));
}
console.log(`Đã ghi ${files.length} description`);
```

Run: `node "$(node -p "require('os').tmpdir()")/aip-rewrite-descriptions.mjs"`
Expected: `Đã ghi 48 description`

Kiểm diff chỉ chạm dòng description:

Run: `git diff --numstat -- core plugins workflows | awk '$1!=1||$2!=1' ; git diff -U0 -- core plugins workflows | grep '^[-+]' | grep -v '^[-+][-+]' | grep -v '^[-+]description: '`
Expected: không in gì.

- [ ] **Step 6: Chạy để thấy xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`; có dòng `CẢNH BÁO (không chặn):` về câu đầu > 200 ký tự (theo §10 của spec, không chặn).

- [ ] **Step 7: Tài liệu**

`CLAUDE.md` dòng 72, nối sau câu heading của Task 2: ` The \`description\` is at most 1024 characters, ends with \`Không dùng khi <case> → <id>.\` pointing at real skill/workflow/agent ids, and must not repeat another skill's quoted trigger verbatim.`

`README.md`, nối vào bullet con của Task 2:

```markdown
  The `description` is at most 1024 characters, ends with `Không dùng khi <case> → <id>.`
  (real skill/workflow/agent ids), and must not repeat another skill's quoted trigger.
```

`README_VI.md`, nối vào bullet con của Task 2:

```markdown
  `description` tối đa 1024 ký tự, kết thúc bằng `Không dùng khi <tình huống> → <id>.` (id
  skill/workflow/agent có thật), không lặp nguyên văn trigger của skill khác.
```

`CHANGELOG.md`, thêm vào `### Changed`:

```markdown
- Skill and workflow `description`s are at most 1024 characters (Agent Skills limit), end with
  `Không dùng khi … → <id>`, and no quoted trigger is shared verbatim between two skills; 22
  over-long descriptions were shortened with their trigger lists kept.
```

- [ ] **Step 8: Chạy toàn bộ cổng**

Run: `npm test && npm run pack:verify`
Expected: exit 0.

- [ ] **Step 9: Commit (sau khi chủ dự án duyệt diff)**

```text
refactor(skills): enforce description length, not-for pointers and unique triggers

Chuẩn hoá description của 48 skill và workflow theo rule mới.

Changed:
- Thêm DESCRIPTION_MAX, notForTargets, checkDescription, triggerCollisions vào cli/lib/conventions.mjs.
- Mọi description kết thúc bằng "Không dùng khi … → <id>", bỏ câu "KHÔNG thuộc pipeline".
- Rút gọn 22 description dưới 1024 ký tự, giữ nguyên danh sách trigger.
- Đổi trigger trùng nguyên văn giữa backend-fix/frontend-fix, git-workflow/ops-deploy-release,
  frontend-refactor/frontend-migrate-architecture, data-db-migration/data-oltp-implement.
- Block 26 và cơ chế cảnh báo trong test/validate.mjs; cập nhật CLAUDE.md, README, CHANGELOG.

Reason:
- Agent Skills giới hạn description 1024 ký tự; 12 skill trong bộ Cowork đang vượt.
- Ranh giới skill và workflow chỉ nằm trong văn bản tự do, có trigger trùng nguyên văn.
```

```bash
git add -A cli/lib/conventions.mjs test/validate.mjs core plugins workflows CLAUDE.md README.md README_VI.md CHANGELOG.md
MSG="$(node -p "require('os').tmpdir()")/aip-commit-msg.txt"   # ghi message ở trên vào file này (UTF-8), rồi:
git commit -F "$MSG"
```

---

### Task 4: A4 — Drift guard boilerplate workflow + Registry

**Files:**
- Modify: `cli/lib/workflows.mjs` (thêm `WF_ANCHORS`, `missingAnchors`, `registrySignals`)
- Modify: `templates/workflows/workflow.template.md` (bỏ 1 dòng)
- Modify: dòng `description:` của `workflows/bugfix/WORKFLOW.md`, `workflows/code-review/WORKFLOW.md`, `workflows/security-review/WORKFLOW.md`
- Modify: `test/validate.mjs` (import; block `// 27.`), `CHANGELOG.md`

**Interfaces:**
- Consumes: `section()` nội bộ của `cli/lib/workflows.mjs`.
- Produces: export `WF_ANCHORS: string[]` (5 dòng), `missingAnchors(text: string): string[]`, `registrySignals(text: string): Map<string, string[]>` (id workflow → các cụm trong ngoặc kép ở cột "Tín hiệu").

- [ ] **Step 1: Viết test đỏ (block 27)**

Đổi dòng import từ `../cli/lib/workflows.mjs` thành:

```js
import { checkWorkflowBody, parseSteps, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS, missingAnchors, registrySignals } from '../cli/lib/workflows.mjs';
```

Chèn block:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 27. Chuẩn hoá A4: drift guard workflow ↔ template, Registry ↔ description (spec 2026-10-06 §4.4, §10)
// ─────────────────────────────────────────────────────────────────────────────
{
  const tpl27 = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'workflows', 'workflow.template.md'), 'utf8').replace(/\r\n/g, '\n');
  ok(missingAnchors(tpl27).length === 0, 'template workflow chứa mọi dòng neo WF_ANCHORS');
  ok(!tpl27.includes('Không có subagent'), 'template workflow: không lặp câu fallback subagent (adapter đã chèn preamble)');
  ok(missingAnchors(tpl27.replace('Thiếu điều kiện nào → dừng', 'Thiếu điều kiện → dừng')).length === 1,
    'missingAnchors: lệch một chữ → báo thiếu');
  ok(missingAnchors(tpl27.replace(/\n/g, '\r\n')).length === 0, 'missingAnchors: chấp nhận CRLF');
  const fx27 = registrySignals(['## Registry', '| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |', '|---|---|---|---|---|',
    '| `workflow-x` | "a b", stacktrace, "c" | low | — | x |', '## Khác'].join('\n'));
  ok(JSON.stringify(fx27.get('workflow-x')) === '["a b","c"]', 'registrySignals: chỉ lấy cụm trong ngoặc kép');
  if (workflows) {
    for (const s of workflows.stages) {
      const miss = missingAnchors(s.body);
      ok(miss.length === 0, `${s.id}: đủ dòng neo khung${miss.length ? ' — thiếu: ' + miss.join(' | ') : ''}`);
    }
    const orch27 = workflows.stages.find((s) => s.kind === 'orchestrator');
    const sig27 = registrySignals(orch27 ? orch27.body : '');
    ok(sig27.size === workflows.stages.filter((s) => s.kind === 'workflow').length, 'registrySignals: đọc đủ dòng Registry');
    for (const [id, sigs] of sig27) {
      const w = workflows.stages.find((s) => s.id === id);
      const d = (w ? w.description : '').toLowerCase();
      const miss = sigs.filter((x) => !d.includes(x.toLowerCase()));
      ok(miss.length === 0, `${id}: mọi tín hiệu Registry có trong description${miss.length ? ' — thiếu: ' + miss.join(', ') : ''}`);
    }
  }
}
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `node test/validate.mjs`
Expected: FAIL `does not provide an export named 'missingAnchors'`.

- [ ] **Step 3: Thêm helper vào `cli/lib/workflows.mjs`**

Ngay sau dòng `export const WORKFLOW_PROVIDERS = ['claude', 'codex'];` thêm:

```js
// Chỉ neo dòng khung; bảng lỗi, DoD và dòng commit được từng workflow tuỳ biến hợp lệ (đo 7–10/12 file).
export const WF_ANCHORS = [
  'Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.',
  'Mỗi bước có đủ 8 trường. Bước kết thúc bằng checkpoint người duyệt thì gắn ⏸ cuối tên bước.',
  '| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |',
  '| Tình huống | Hành động |',
  'Trả về đúng khối sau; mục nào không chạy được ghi `status: not_run` kèm `reason`.',
];
```

Nối vào cuối file:

```js
export function missingAnchors(text) {
  const lines = new Set(text.split('\n').map((l) => l.trimEnd()));
  return WF_ANCHORS.filter((a) => !lines.has(a));
}

export function registrySignals(text) {
  const out = new Map();
  for (const line of (section(text, 'Registry') || '').split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const id = cells[0].replace(/`/g, '');
    if (!id.startsWith('workflow-')) continue;
    out.set(id, [...cells[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  }
  return out;
}
```

- [ ] **Step 4: Chạy để thấy dữ liệu thật đỏ**

Run: `node test/validate.mjs`
Expected: FAIL đúng 4 lỗi: `template workflow: không lặp câu fallback subagent`, và tín hiệu Registry thiếu ở `workflow-bugfix` (`không chạy`, `sai kết quả`), `workflow-code-review` (`PR #`), `workflow-security-review` (`CVE`). Mọi `đủ dòng neo khung` pass (13 file).

- [ ] **Step 5: Sửa template và 3 description**

`templates/workflows/workflow.template.md`: xoá dòng

```markdown
Không có subagent → session chính chạy tuần tự skill tương ứng.
```

(`adapters/_shared/agents.mjs:46` đã chèn câu này vào preamble mọi workflow build ra.)

Trong dòng `description:` của:
- `workflows/bugfix/WORKFLOW.md`: thay `\"tại sao bị lỗi\"` bằng `\"tại sao bị lỗi\", \"không chạy\", \"sai kết quả\"`
- `workflows/code-review/WORKFLOW.md`: thay `\"nhận xét PR\"` bằng `\"nhận xét PR\", \"PR #\"`
- `workflows/security-review/WORKFLOW.md`: thay `\"kiểm secret\"` bằng `\"kiểm secret\", \"CVE\"`

(Trong file, dấu ngoặc kép bên trong description được escape `\"`.)

- [ ] **Step 6: Chạy để thấy xanh**

Run: `node test/validate.mjs`
Expected: `0 fail` (block 26 vẫn xanh: không có trigger mới trùng).

- [ ] **Step 7: CHANGELOG**

Thêm vào `### Changed`:

```markdown
- Workflow drift guards: the five fixed template lines (`WF_ANCHORS`) must appear in every
  `WORKFLOW.md`, and every quoted Registry signal must appear in that workflow's `description`.
```

- [ ] **Step 8: Chạy toàn bộ cổng**

Run: `npm test && npm run pack:verify`
Expected: exit 0.

- [ ] **Step 9: Commit (sau khi chủ dự án duyệt diff)**

```text
test(workflows): guard template lines and registry signals against drift

Thêm drift guard cho khung workflow và Registry của orchestrator.

Changed:
- Thêm WF_ANCHORS, missingAnchors, registrySignals vào cli/lib/workflows.mjs.
- Block 27 trong test/validate.mjs kiểm 13 WORKFLOW.md và template.
- Bỏ dòng fallback subagent khỏi template vì adapter đã chèn vào preamble.
- Thêm 4 cụm tín hiệu Registry còn thiếu vào description bugfix, code-review, security-review.

Reason:
- 4/45 tín hiệu Registry không có trong description workflow tương ứng.
- Dòng fallback subagent của template không có ở workflow nào.
```

```bash
git add -A cli/lib/workflows.mjs test/validate.mjs templates/workflows workflows CHANGELOG.md
MSG="$(node -p "require('os').tmpdir()")/aip-commit-msg.txt"   # ghi message ở trên vào file này (UTF-8), rồi:
git commit -F "$MSG"
```

---

### Task 5: B0 — Script đo trùng lặp

**Files:**
- Create: `test/overlap.mjs`
- Modify: `package.json` (script `overlap`), `test/validate.mjs` (import; block `// 28.`), `CHANGELOG.md`

**Interfaces:**
- Consumes: `WF_ANCHORS`, `parseSteps` từ `cli/lib/workflows.mjs` (Task 4); loader `cli/lib/plugins.mjs`.
- Produces: export `normLines(text): Set<string>`, `lineOverlap(a, b): number`, `stepOverlap(a, b): number`, `titleOverlap(a, b): number` (tỉ lệ 0–1, chia cho phía nhỏ hơn). Chạy trực tiếp in 2 bảng markdown.

- [ ] **Step 1: Viết test đỏ (block 28)**

Thêm import:

```js
import { lineOverlap, stepOverlap, titleOverlap } from './overlap.mjs';
```

Chèn block:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 28. Chuẩn hoá B0: chỉ số trùng lặp (spec 2026-10-06 §5.1)
// ─────────────────────────────────────────────────────────────────────────────
{
  ok(lineOverlap('a\nb\nc', 'b\nc\nd\ne') === 2 / 3, 'lineOverlap: chia cho tập nhỏ hơn');
  ok(lineOverlap('Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.\nx',
    'Thiếu điều kiện nào → dừng, báo thiếu gì, không tự tạo thay.\ny') === 0, 'lineOverlap: bỏ dòng neo template');
  ok(lineOverlap('|---|---|\n```\nx', '|---|---|\n```\ny') === 0, 'lineOverlap: bỏ dòng cấu trúc markdown');
  ok(lineOverlap('', 'a') === 0, 'lineOverlap: rỗng → 0');
  const st = (n, who, act) => `### Bước ${n} — T${n}\n- **Thực hiện:** ${who}\n- **Hành động:** ${act}\n`;
  const wa = `## Các bước\n${st(1, 'session chính', 'chạy build')}${st(2, 'agent \`x\`', 'viết test')}## Checkpoint\n`;
  const wb = `## Các bước\n${st(1, 'session chính', 'chạy build')}${st(2, 'agent \`y\`', 'viết test')}${st(3, 'a', 'b')}## Checkpoint\n`;
  ok(stepOverlap(wa, wb) === 0.5, 'stepOverlap: khớp cả Thực hiện lẫn Hành động');
  ok(titleOverlap(wa, wb) === 1, 'titleOverlap: so tên bước');
}
```

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `node test/validate.mjs`
Expected: FAIL `Cannot find module` … `test/overlap.mjs`.

- [ ] **Step 3: Tạo `test/overlap.mjs`**

```js
#!/usr/bin/env node
// Báo cáo trùng lặp nội dung skill ↔ skill và workflow ↔ workflow (spec 2026-10-06 §5.1).
// Chỉ in số liệu để ra quyết định gộp; không assert nên không nằm trong `npm test`.
import { pathToFileURL } from 'node:url';
import { loadPlugins, loadCore, loadWorkflows } from '../cli/lib/plugins.mjs';
import { WF_ANCHORS, parseSteps } from '../cli/lib/workflows.mjs';

const ANCHORS = new Set(WF_ANCHORS);
// Dòng kẻ bảng, rào code và dòng chỉ có # trùng ở mọi file nên không phản ánh nội dung.
const STRUCTURAL = /^(\|[-| :]+\||```.*|#+|---)$/;

export function normLines(text) {
  return new Set(text.split('\n').map((l) => l.trim()).filter((l) => l && !ANCHORS.has(l) && !STRUCTURAL.test(l)));
}

const ratio = (hits, a, b) => (Math.min(a, b) ? hits / Math.min(a, b) : 0);

export function lineOverlap(a, b) {
  const A = normLines(a);
  const B = normLines(b);
  return ratio([...A].filter((l) => B.has(l)).length, A.size, B.size);
}

const field = (body, f) => ((body.split(`**${f}:**`)[1] || '').split('\n- **')[0]).replace(/\s+/g, ' ').trim();
const stepKey = (s) => `${field(s.body, 'Thực hiện')}§${field(s.body, 'Hành động')}`;
const titleKey = (s) => s.title.replace('⏸', '').trim().toLowerCase();

export function stepOverlap(a, b) {
  const A = parseSteps(a);
  const B = new Set(parseSteps(b).map(stepKey));
  return ratio(A.filter((s) => B.has(stepKey(s))).length, A.length, B.size);
}

export function titleOverlap(a, b) {
  const A = parseSteps(a);
  const B = new Set(parseSteps(b).map(titleKey));
  return ratio(A.filter((s) => B.has(titleKey(s))).length, A.length, B.size);
}

const pct = (x) => `${Math.round(x * 100)}%`;

function report(title, items, cols) {
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      rows.push([`${items[i].id} ↔ ${items[j].id}`, ...cols.map(([, fn]) => fn(items[i].body, items[j].body))]);
    }
  }
  rows.sort((x, y) => Math.max(...y.slice(1)) - Math.max(...x.slice(1)));
  console.log(`\n## ${title}\n`);
  console.log(`| Cặp | ${cols.map(([h]) => h).join(' | ')} |`);
  console.log(`|---|${cols.map(() => '---').join('|')}|`);
  for (const r of rows.slice(0, 15)) {
    console.log(`| ${r[0]} | ${r.slice(1).map((x) => `${pct(x)}${x >= 0.6 ? ' ⚠' : ''}`).join(' | ')} |`);
  }
}

function main() {
  const skills = [...loadCore().stages, ...loadPlugins().flatMap((p) => p.stages)];
  const workflows = (loadWorkflows() || { stages: [] }).stages;
  report('Skill ↔ skill (top 15)', skills, [['Dòng', lineOverlap]]);
  report('Workflow ↔ workflow (top 15)', workflows,
    [['Dòng', lineOverlap], ['Bước (Thực hiện + Hành động)', stepOverlap], ['Tên bước', titleOverlap]]);
  console.log('\n⚠ = chạm ngưỡng gộp 60% (spec §5.2 tiêu chí 2).');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

`package.json`, trong `scripts` thêm sau dòng `"validate": …`:

```json
    "overlap": "node test/overlap.mjs",
```

- [ ] **Step 4: Chạy để thấy xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`

Run: `npm run overlap`
Expected: in 2 bảng markdown "Skill ↔ skill (top 15)" và "Workflow ↔ workflow (top 15)", exit 0. Lưu output (dùng ở Task 6).

- [ ] **Step 5: CHANGELOG**

Dưới `[Unreleased]` thêm (nếu chưa có `### Added` thì tạo trước `### Changed`):

```markdown
### Added

- `npm run overlap` (`test/overlap.mjs`) prints skill/skill and workflow/workflow content-overlap
  ratios used to decide merges.
```

- [ ] **Step 6: Chạy toàn bộ cổng**

Run: `npm test && npm run pack:verify`
Expected: exit 0 (pack-guard không ship `test/`).

- [ ] **Step 7: Commit (sau khi chủ dự án duyệt diff)**

```text
test(tooling): add overlap report for skills and workflows

Thêm script đo trùng lặp nội dung để quyết định gộp dựa trên số liệu.

Changed:
- Thêm test/overlap.mjs và script npm run overlap.
- Block 28 trong test/validate.mjs kiểm lineOverlap, stepOverlap, titleOverlap.
- Cập nhật CHANGELOG.

Reason:
- Spec chuẩn hoá yêu cầu quyết định gộp phải kèm số đo, không dựa trên tên gọi.
```

```bash
git add -A test/overlap.mjs test/validate.mjs package.json CHANGELOG.md
MSG="$(node -p "require('os').tmpdir()")/aip-commit-msg.txt"   # ghi message ở trên vào file này (UTF-8), rồi:
git commit -F "$MSG"
```

---

### Task 6: B1 — Ghi quyết định gộp vào spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-06-standardize-skills-workflows-design.md` (§5.3, trạng thái)

**Interfaces:**
- Consumes: output `npm run overlap` (Task 5).
- Produces: §5.3.1 có bảng số đo + đánh giá 5 tiêu chí cho `workflow-api → workflow-feature`.

- [ ] **Step 1: Thu số liệu**

Run: `npm run overlap`
Lấy dòng `workflow-api ↔ workflow-feature` (hoặc `workflow-feature ↔ workflow-api`) và mọi dòng có `⚠`.

- [ ] **Step 2: Đánh giá 5 tiêu chí (§5.2) cho `api → feature`**

| # | Tiêu chí | Cách kiểm | Kết quả |
|---|---|---|---|
| 1 | Không có trigger độc lập | So trigger trong ngoặc kép ở description `workflow-api` ("làm API", "thêm endpoint", "OpenAPI", "contract-first") với `workflow-feature` | Ghi đạt/không đạt kèm cụm |
| 2 | Trùng ≥ 60% | Cột "Dòng" và "Bước" từ Step 1 | Ghi số |
| 3 | Cùng `risk` và `tier` | Frontmatter hai file | Ghi giá trị |
| 4 | Bản gộp ≤ 272 dòng | `wc -l` hai file; ước lượng = feature + phần riêng của api | Ghi số |
| 5 | Có đường migrate | Chưa có cơ chế stub (§5.4) | Ghi "chưa có" |

Gộp chỉ khi đạt cả 5.

- [ ] **Step 3: Ghi vào spec**

Thêm mục `### 5.3.1 Số đo B0 và quyết định (YYYY-MM-DD ngày chạy)` ngay sau bảng §5.3, gồm: (a) bảng top 15 workflow ↔ workflow và top 15 skill ↔ skill dán nguyên từ Step 1; (b) bảng 5 tiêu chí ở Step 2 đã điền; (c) kết luận một câu:
- Không đạt đủ 5 tiêu chí → "Không gộp `workflow-api` vào `workflow-feature`; Pha B kết thúc."
- Đạt đủ 5 tiêu chí → "Đủ điều kiện gộp; việc gộp (stub `deprecatedBy`, sửa wizard/installer, kiểm `aip update`) làm spec + plan riêng."

Cập nhật cột "Trạng thái" của dòng `workflow-api` trong bảng §5.3 theo kết luận. Đổi dòng trạng thái đầu spec thành `**Đã thực thi Pha A + B0 (YYYY-MM-DD)**`.

- [ ] **Step 4: Kiểm**

Run: `npm test`
Expected: exit 0.

- [ ] **Step 5: Commit (sau khi chủ dự án duyệt diff)**

```text
docs(spec): record overlap measurements and merge decision

Ghi số đo trùng lặp và quyết định gộp workflow-api vào spec chuẩn hoá.

Changed:
- Thêm mục 5.3.1 với bảng số đo B0 và đánh giá 5 tiêu chí gộp.
- Cập nhật trạng thái spec.

Reason:
- Pha B yêu cầu quyết định gộp hoặc không gộp phải kèm số đo.
```

```bash
git add docs/superpowers/specs/2026-10-06-standardize-skills-workflows-design.md
MSG="$(node -p "require('os').tmpdir()")/aip-commit-msg.txt"   # ghi message ở trên vào file này (UTF-8), rồi:
git commit -F "$MSG"
```

---

## Kiểm tra cuối nhánh

- [ ] `npm test && npm run pack:verify` → exit 0.
- [ ] Encoding mọi file đổi trên nhánh (EOL kiểm ở index, BOM kiểm ở working tree):

```bash
git ls-files --eol $(git diff --name-only master...HEAD) | grep -v "^i/lf"
git diff --name-only master...HEAD | while read -r f; do [ -f "$f" ] && head -c3 "$f" | od -An -tx1 | grep -q "ef bb bf" && echo "BOM $f"; done; echo done
```

Expected: lệnh đầu không in gì; lệnh sau chỉ in `done`.

- [ ] `git log --format=%B master..HEAD` còn nguyên dấu tiếng Việt; không có dòng `Co-Authored-By`.
- [ ] Review toàn nhánh (một reviewer mới, đọc spec §10 + plan) trước khi bàn chuyện merge.
