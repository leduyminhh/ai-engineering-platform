# Phase 2 — Engine chiếu frontmatter đầy đủ: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Engine đọc và chiếu được frontmatter dạng list/map/boolean, chiếu khoá skill/agent theo allowlist từng provider, áp các khoá đó cho skill/agent/workflow cần thiết, lọc skill draft khỏi marketplace, và làm nốt các mục Phase 1 dời sang.

**Architecture:** Parser zero-dep trong `cli/lib/plugins.mjs` mở rộng thêm list/map/boolean và fail-loud khi gặp khoá lạ. Emitter `frontmatter()` trong `cli/lib/write.mjs` ghi được list/map. Adapter chọn khoá theo allowlist provider (`PROVIDER_SKILL_KEYS`). Nội dung (SKILL.md, agent, WORKFLOW.md, manifest) chỉ thêm khoá — không đổi cấu trúc thư mục nguồn.

**Tech Stack:** Node.js ≥ 20, ESM thuần, zero runtime dependency; test là script Node (`test/validate.mjs` + module `test/contract/*`, `test/content/*`).

**Spec:** `docs/superpowers/specs/2026-10-07-platform-standards-audit-design.md` (§3.1 E2/E3/E8/E9/E10, §3.2 S4, §3.3 W1/W2/W5/W6, §3.4 T6, §5 Phase 2, §6 D2/D3/D6), cộng các mục Phase 1 dời sang (§5 ghi chú dưới Phase 1).

## Bối cảnh đã xác minh (docs Claude Code, re-fetch 2026-10-08)

- Skill (https://code.claude.com/docs/en/skills.md): có `argument-hint`, `arguments`, `user-invocable` (bool, `false` = ẩn khỏi menu `/` nhưng model vẫn gọi được), `disable-model-invocation` (bool, ẩn hẳn description), `allowed-tools`, `disallowed-tools` (chuỗi phân cách dấu cách/phẩy hoặc YAML list), `effort`, `paths` (chuỗi phẩy hoặc YAML list), `compatibility` (≤ 500 ký tự), `metadata` (map), `when_to_use` (gộp với description, trần 1.536).
- Agent (https://code.claude.com/docs/en/sub-agents.md): `tools`/`disallowedTools` (chuỗi phẩy hoặc list), `skills` (ví dụ duy nhất là YAML list, tên trần), `maxTurns` (số), `isolation: worktree`, `model`, `effort`, `color`. **`hooks`, `mcpServers`, `permissionMode` bị bỏ qua với agent của plugin.** Khoá lạ bị bỏ qua không báo lỗi.
- plugin.json: `homepage` (phải là URL hợp lệ, sai thì plugin không load), `repository`, `license` (SPDX), `keywords`. marketplace `owner`: `name` + `email`/`url` tuỳ chọn.
- `claude plugin list --json` tồn tại: mảng object, luôn có `id` (`name@marketplace`), `version`, `scope`, `enabled`, `installPath`.

## Quyết định thực thi (controller chốt, ghi lại để reviewer không đòi ngược)

| # | Quyết định | Lý do |
|---|---|---|
| R1 | KHÔNG tách khối trigger sang `when_to_use` (P2.3) | Claude gộp `description` + `when_to_use` khi liệt kê nên không tiết kiệm token; Codex/Cursor không có khoá này → phải gộp lại; validator Phase 1 đòi "Dùng khi" trong description. `when_to_use` cũng không vào allowlist (YAGNI). |
| R2 | KHÔNG đặt `disallowed-tools` cho skill nào (P2.3) | Cả 5 ứng viên đều có chế độ ghi tuỳ chọn: `*-code-review` + `engineering-convention-enforce` sửa khi người dùng yêu cầu rõ, `ops-incident-troubleshooting` viết RCA theo template, `ops-observability` ghi tài liệu. Khoá Edit/Write làm gãy chế độ đó mà không chặn được Bash. Engine vẫn hỗ trợ khoá. Cổng cứng là hook ở Phase 3. |
| R3 | `skills` preload của agent = **skill đầu tiên** trong danh sách (skill chính), không preload hết | Preload nhét toàn bộ nội dung skill vào mỗi lần dispatch; agent 4 skill (spec-analyst) sẽ tốn ~7k token. Skill còn lại gọi qua tool `Skill`. |
| R4 | Agent read-only có `tools` allowlist phải kèm `Skill` khi có > 1 skill | Không có `Skill` thì agent không nạp được skill thứ hai. |
| R5 | KHÔNG đặt `permissionMode`, `isolation`, `maxTurns`, `model`, `effort` cho agent nào | `permissionMode` bị bỏ qua với agent plugin; `isolation` theo D6 chờ eval; `maxTurns`/`model`/`effort` chưa có số đo. Engine hỗ trợ `maxTurns` + `isolation` để thử sau. |
| R6 | Draft chuyển sang `build/claude/drafts/<plugin>/…` thay vì xoá khỏi build | Cài skills-mode (`aip install --skill data/data-oltp-init`) và gói Cowork vẫn cần file draft; chỉ marketplace (đọc `plugins/`) không được thấy. |
| R7 | KHÔNG thêm `renames` vào marketplace | Chưa có plugin nào đổi tên. |
| R8 | Bump **MINOR** mọi plugin một lần ở Task 8 | Đổi hành vi định tuyến (`disable-model-invocation`, `tools`) — không phải sửa lỗi. Version gate từ chối re-lock cùng version khi nội dung đổi, nên chỉ bump ở cuối (như Phase 1). |
| R9 | Task 2–7: assertion lock version (`test/contract/60-versions.contract.mjs`) **được phép đỏ** | Hệ quả của R8. Mọi assertion khác phải xanh. Task 1 không đổi output nên lock phải xanh. |

## Global Constraints

- Node.js ≥ 20; ESM thuần; **zero runtime dependency** (chỉ built-in Node).
- File nguồn UTF-8 **không BOM**, xuống dòng **LF**.
- KHÔNG sửa `package.json`, `pack.config.json`.
- Comment trong code: tiếng Việt có dấu, 1–2 dòng, chỉ giải thích *vì sao* (quality gate trong `AGENTS.md`); không comment điều code đã nói.
- Nội dung skill/agent/workflow/manifest viết tiếng Việt có dấu.
- Commit: header tiếng Anh `type(scope): summary`; body tiếng Việt có dấu (mục "Thay đổi:" / "Lý do:"); ghi message ra file rồi `node core/skills/git-workflow/scripts/check-commit-message.mjs <file>` phải exit 0, sau đó `git commit -F <file>`. **KHÔNG** thêm dòng `Co-Authored-By` hay attribution assistant.
- Một task = một commit (cộng commit sửa sau review nếu có). Không push. Không merge.
- KHÔNG chạy hai lượt test song song (cùng ghi `build/`). Chạy tuần tự.
- Windows: KHÔNG `rm -rf` thư mục chứa junction từ Git Bash; dọn bằng Node `fs.rmSync`.
- Làm việc trong worktree `E:\Mine\AI\ai-engineering-platform\.worktrees\standards-phase2`, branch `refactor/standards-phase2`.
- Lệnh kiểm chuẩn mỗi task (trừ khi task nói khác):
  - `node test/validate.mjs --build` — mọi FAIL phải đến từ module `60-versions` về lock (R9), không FAIL nào khác.
  - `node test/install.test.mjs`, `node test/wizard.test.mjs`, `node test/managed-block.test.mjs`, `node test/pack-guard.test.mjs`, `node test/args.test.mjs` — đều 0 fail.

## Review Focus

1. **Giá trị chuỗi trông giống kiểu khác** (`"true"`, `"123"`, `"[x]"`, `"a: b"`) — emitter phải quote để YAML đọc lại đúng chuỗi; parser đọc lại phải ra đúng giá trị (round-trip). Test ở Task 1.
2. **Tác giả quên quote giá trị bắt đầu bằng `[`** (vd `argument-hint: [PR]` bị đọc thành list) — loader phải fail-loud vì sai kiểu, không âm thầm ghi list sang Claude. Test ở Task 2.
3. **File nguồn CRLF có block list** — parser phải đọc đúng khi gọi trực tiếp với `\r\n`. Test ở Task 1.
4. **Cài skills-mode một skill draft** sau khi draft chuyển sang `drafts/` — vẫn cài được, và marketplace không lộ skill draft. Test ở Task 6.
5. **Claude Code cũ không hỗ trợ `plugin list --json`** — `aip check` phải rơi về parser text, không báo "không có CLI". Test ở Task 7.

---

### Task 0: Workspace

- [ ] **Step 1: Tạo worktree từ master**

```bash
git worktree add .worktrees/standards-phase2 -b refactor/standards-phase2 master
```

- [ ] **Step 2: Chuyển plan vào branch**

Plan này nằm ở main tree (chưa commit). Copy sang worktree, commit ở đó, rồi xoá bản ở main tree:

```bash
cp docs/superpowers/plans/2026-10-08-standards-phase2.md .worktrees/standards-phase2/docs/superpowers/plans/
```

Commit trong worktree: `docs(plan): add standards phase 2 implementation plan` (body tiếng Việt, kiểm bằng `check-commit-message.mjs`). Sau đó xoá file ở main tree bằng `node -e "require('fs').rmSync('docs/superpowers/plans/2026-10-08-standards-phase2.md')"`.

- [ ] **Step 3: Baseline xanh trong worktree**

Run: `npm test` (trong worktree). Expected: exit 0.

---

### Task 1: Parser + emitter frontmatter (list, map, boolean, fail-loud)

**Files:**
- Modify: `cli/lib/plugins.mjs` (parser `parseFrontmatter` → export; `splitList` nhận mảng; loader fail-loud)
- Modify: `cli/lib/write.mjs` (`yamlScalar`, `frontmatter`)
- Modify: `cli/lib/conventions.mjs` (`checkFrontmatterYaml` nhận dòng con)
- Create: `test/contract/80-frontmatter.contract.mjs`
- Modify: `test/context.mjs` (export thêm `parseFrontmatter`)

**Interfaces:**
- Produces: `export function parseFrontmatter(text) -> { meta: Object, body: string }` (plugins.mjs). Giá trị: `string | number | boolean | null | string[] | Object<string, scalar>`.
- Produces: `splitList(v)` nhận `string | string[]`.
- Produces: `frontmatter(pairs)` ghi mảng thành block list (`key:` + `  - item`), object thuần thành map một cấp (`key:` + `  k: v`); mảng rỗng / object rỗng / `null` / `undefined` → bỏ khoá.
- Produces: loader (`loadSkills`, `loadAgents`, `loadWorkflows`) **ném Error** khi frontmatter có khoá ngoài `SOURCE_KEYS[kind]`; message chứa đường dẫn tương đối file + tên khoá.

- [ ] **Step 1: Viết test đỏ** — tạo `test/contract/80-frontmatter.contract.mjs`:

```js
// Contract Phase 2: parser/emitter frontmatter (list, map, boolean) và fail-loud khoá lạ.
export default async function run({ ok, ctx }) {
  const { parseFrontmatter, frontmatter, yamlScalar, checkFrontmatterYaml, splitList } = ctx;

  // Parser: các dạng mới
  {
    const { meta, body } = parseFrontmatter([
      '---',
      'name: x',
      'description: "A: b \\"q\\""',
      'flag: true',
      'off: false',
      'n: 12',
      'nil: null',
      "single: 'it''s'",
      'inline: [Read, "Grep", \'Glob\']',
      'empty: []',
      'block:',
      '  - a',
      '  - "b: c"',
      'meta:',
      '  owner: team',
      '  level: 2',
      '---',
      'Body',
    ].join('\n'));
    ok(meta.name === 'x' && meta.description === 'A: b "q"', 'parseFrontmatter: scalar + chuỗi JSON-quoted');
    ok(meta.flag === true && meta.off === false && meta.n === 12 && meta.nil === null, 'parseFrontmatter: boolean/số/null');
    ok(meta.single === "it's", "parseFrontmatter: chuỗi nháy đơn ('' = ')");
    ok(JSON.stringify(meta.inline) === '["Read","Grep","Glob"]', 'parseFrontmatter: list inline có quote');
    ok(Array.isArray(meta.empty) && meta.empty.length === 0, 'parseFrontmatter: list inline rỗng');
    ok(JSON.stringify(meta.block) === '["a","b: c"]', 'parseFrontmatter: block list');
    ok(JSON.stringify(meta.meta) === '{"owner":"team","level":2}', 'parseFrontmatter: map một cấp');
    ok(body === 'Body', 'parseFrontmatter: body sau frontmatter');
  }
  {
    const crlf = '---\r\nname: x\r\nblock:\r\n  - a\r\n  - b\r\n---\r\nB\r\n';
    const { meta } = parseFrontmatter(crlf);
    ok(meta.name === 'x' && JSON.stringify(meta.block) === '["a","b"]', 'parseFrontmatter: CRLF + block list');
  }
  {
    let threw = false;
    try { parseFrontmatter('---\nname: x\n  - lạc\n---\n'); } catch { threw = true; }
    ok(threw, 'parseFrontmatter: dòng thụt lề không thuộc khoá nào → ném lỗi');
  }

  // splitList nhận mảng
  ok(JSON.stringify(splitList(['a ', '', 'b'])) === '["a","b"]', 'splitList: nhận mảng, trim + bỏ rỗng');

  // Emitter: list/map + quote chuỗi trông giống kiểu khác
  {
    ok(yamlScalar('true') === '"true"' && yamlScalar('123') === '"123"' && yamlScalar('null') === '"null"',
      'yamlScalar: chuỗi trông như bool/số/null → quote');
    const fm = frontmatter([
      ['name', 'x'], ['tools', ['Read', 'Grep']], ['meta', { owner: 'team', level: 2 }],
      ['empty', []], ['blank', {}], ['flag', false], ['hint', '[PR | branch]'],
    ]);
    ok(fm === ['---', 'name: x', 'tools:', '  - Read', '  - Grep', 'meta:', '  owner: team', '  level: 2',
      'flag: false', 'hint: "[PR | branch]"', '---'].join('\n'), 'frontmatter: list/map/bool, bỏ list/map rỗng');
    const back = parseFrontmatter(`${fm}\n`).meta;
    ok(JSON.stringify(back) === JSON.stringify({ name: 'x', tools: ['Read', 'Grep'], meta: { owner: 'team', level: 2 }, flag: false, hint: '[PR | branch]' }),
      'frontmatter → parseFrontmatter: round-trip giữ nguyên giá trị');
    const inner = fm.split('\n').slice(1, -1).join('\n');
    ok(checkFrontmatterYaml(inner).length === 0, 'checkFrontmatterYaml: chấp nhận dòng con list/map');
    ok(checkFrontmatterYaml('tools:\n  - a: b').length === 1, 'checkFrontmatterYaml: item list plain không an toàn → lỗi');
  }

  // Loader fail-loud: khoá lạ ném lỗi nêu file + khoá
  {
    const { fs, os, path } = ctx;
    const { loadSkillsFrom } = ctx;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-fm-'));
    try {
      fs.mkdirSync(path.join(dir, 'skills', 'demo'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'skills', 'demo', 'SKILL.md'), '---\nname: demo\nrunin: plan\n---\nx\n');
      let msg = '';
      try { loadSkillsFrom(dir); } catch (e) { msg = String(e.message); }
      ok(msg.includes('runin') && msg.includes('SKILL.md'), 'loader: khoá frontmatter lạ → ném lỗi nêu khoá + file');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
```

Thêm vào `test/context.mjs`: import `parseFrontmatter, loadSkillsFrom` từ `../cli/lib/plugins.mjs` và đưa cả hai vào object trả về.

- [ ] **Step 2: Chạy để thấy đỏ**

Run: `node test/validate.mjs --only frontmatter`
Expected: lỗi import (`parseFrontmatter`/`loadSkillsFrom` không được export) hoặc nhiều FAIL.

- [ ] **Step 3: Cài parser trong `cli/lib/plugins.mjs`**

Thay `parseFrontmatter` hiện tại (dòng ~100–124) bằng:

```js
/**
 * Parser frontmatter zero-dep cho tập con YAML mà repo dùng: scalar một dòng (chuỗi "…" kiểu JSON, '…',
 * số nguyên, true/false/null, plain), list inline `[a, b]`, block list `- x` và map một cấp `k: v` thụt lề.
 */
export function parseFrontmatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\s/.test(line)) throw new Error(`frontmatter: dòng thụt lề không thuộc khoá nào: "${line.trim()}"`);
    const c = line.indexOf(':');
    if (c === -1) continue;
    const key = line.slice(0, c).trim();
    const raw = line.slice(c + 1).trim();
    if (raw !== '') { meta[key] = parseInline(raw); continue; }
    const block = [];
    while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
    if (!block.length) { meta[key] = ''; continue; }
    if (block.every((b) => b === '-' || b.startsWith('- '))) {
      meta[key] = block.map((b) => parseScalar(b.slice(1).trim()));
    } else {
      meta[key] = Object.fromEntries(block.map((b) => {
        const j = b.indexOf(':');
        if (j === -1) throw new Error(`frontmatter: "${key}" trộn list và map hoặc dòng con sai: "${b}"`);
        return [b.slice(0, j).trim(), parseScalar(b.slice(j + 1).trim())];
      }));
    }
  }
  return { meta, body: m[2] };
}

function parseScalar(raw) {
  if (raw === '') return '';
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw[0] === '"') { try { return JSON.parse(raw); } catch { return raw; } }
  if (raw[0] === "'" && raw.length >= 2 && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function parseInline(raw) {
  if (!(raw[0] === '[' && raw.endsWith(']'))) return parseScalar(raw);
  const inner = raw.slice(1, -1).trim();
  return inner ? splitOutsideQuotes(inner).map((s) => parseScalar(s.trim())) : [];
}

// Dấu phẩy trong chuỗi quote là nội dung, không phải ranh giới phần tử.
function splitOutsideQuotes(s) {
  const out = [];
  let cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      cur += ch;
      if (ch === '\\' && q === '"' && i + 1 < s.length) cur += s[++i];
      else if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
```

Sửa `splitList`:

```js
/** Danh sách nguồn: chuỗi "a, b" (dạng cũ) hoặc YAML list. */
export function splitList(v) {
  const items = Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(',') : [];
  return items.map((s) => s.trim()).filter(Boolean);
}
```

Fail-loud: import `checkSourceKeys` từ `./conventions.mjs`, thêm helper và gọi ngay sau mỗi `parseFrontmatter(...)` trong `loadSkills`, `loadAgents`, `loadWorkflows`:

```js
import { checkSourceKeys } from './conventions.mjs';

// Khoá gõ sai trước đây bị bỏ im lặng; ném lỗi để build và test dừng ngay ở file sai.
function assertSourceKeys(kind, meta, file) {
  const errs = checkSourceKeys(kind, meta);
  if (errs.length) throw new Error(`${path.relative(REPO_ROOT, file)}: ${errs.join('; ')}`);
}
```

- `loadSkills`: `assertSourceKeys('skill', meta, skillFile)`
- `loadAgents`: `assertSourceKeys('agent', meta, path.join(dir, f))`
- `loadWorkflows`: `assertSourceKeys('workflow', meta, file)`

Export thêm để test fixture gọi được: đổi `function loadSkills(pluginDir)` thành giữ nguyên tên nội bộ và thêm `export const loadSkillsFrom = loadSkills;` ngay sau định nghĩa.

- [ ] **Step 4: Cài emitter trong `cli/lib/write.mjs`**

```js
// Plain scalar chỉ an toàn khi không mở đầu bằng ký tự cấu trúc YAML và không chứa ": " / " #";
// mô tả tiếng Việt thường có ": " hoặc dấu " nên phải quote, nếu không parser chặt báo "mapping values are not allowed here".
// Chuỗi trông như bool/số/null phải quote, nếu không YAML đọc lại thành kiểu khác.
const PLAIN_UNSAFE = /^[\s"'#&*!|>%@`\[\]{},?:-]|:(?:\s|$)|\s#|\s$|["\n\r\t]|^(?:true|false|null|~|-?\d+(?:\.\d+)?)$/i;

export function yamlScalar(v) {
  const s = String(v);
  return s === '' || PLAIN_UNSAFE.test(s) ? JSON.stringify(s) : s;
}

const plainValue = (v) => (typeof v === 'boolean' || typeof v === 'number' ? String(v) : yamlScalar(v));

/** Emit a YAML frontmatter block from an ordered list of [key, value] pairs. */
export function frontmatter(pairs) {
  const lines = ['---'];
  for (const [k, v] of pairs) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      lines.push(`${k}:`, ...v.map((x) => `  - ${plainValue(x)}`));
    } else if (typeof v === 'object') {
      const es = Object.entries(v).filter(([, x]) => x !== undefined && x !== null);
      if (!es.length) continue;
      lines.push(`${k}:`, ...es.map(([mk, mv]) => `  ${mk}: ${plainValue(mv)}`));
    } else {
      lines.push(`${k}: ${plainValue(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
```

- [ ] **Step 5: `checkFrontmatterYaml` nhận dòng con** — trong `cli/lib/conventions.mjs`, thay vòng lặp bằng:

```js
export function checkFrontmatterYaml(fmText) {
  const errs = [];
  let parent = null; // khoá vừa mở khối con (giá trị rỗng)
  const checkValue = (key, v) => {
    if (v.startsWith('"')) { if (!QUOTED.test(v)) errs.push(`${key}: chuỗi quote không đóng hoặc escape sai`); return; }
    if (PLAIN_UNSAFE_VALUE.test(v)) errs.push(`${key}: plain scalar không an toàn ("${v.slice(0, 30)}")`);
  };
  for (const line of fmText.split('\n')) {
    if (!line.trim()) continue;
    const item = line.match(/^ {2}- (.*)$/);
    const sub = line.match(/^ {2}([A-Za-z][\w-]*): (.*)$/);
    if ((item || sub) && parent) { checkValue(parent, item ? item[1] : sub[2]); continue; }
    const m = line.match(/^([A-Za-z][\w-]*):(?:\s(.*))?$/);
    if (!m) { errs.push(`dòng không phải "key: value": ${line.slice(0, 40)}`); parent = null; continue; }
    const v = m[2] ?? '';
    parent = v === '' ? m[1] : null;
    if (v !== '') checkValue(m[1], v);
  }
  return errs;
}
```

Cập nhật comment phía trên hằng số: bỏ câu "Chỉ nhận dạng `key: value` một dòng — đúng tập con mà frontmatter() phát ra hiện nay." thay bằng "Nhận `key: value` và dòng con `  - x` / `  k: v` mà frontmatter() phát ra."

- [ ] **Step 6: Chạy test**

Run: `node test/validate.mjs --only frontmatter` → Expected: 0 fail.
Run: `node test/validate.mjs --build` → Expected: **0 fail** (Task 1 không đổi output build).
Run: `node cli/lib/versions.mjs --check` → Expected: `versions lock khớp build.` (bằng chứng output không đổi).
Run: các test còn lại trong Global Constraints → 0 fail.

- [ ] **Step 7: Commit** — `feat(cli): parse and emit YAML lists, maps and booleans in frontmatter`

---

### Task 2: Chiếu khoá skill theo allowlist provider + áp cho skill

**Files:**
- Modify: `cli/lib/conventions.mjs` (`SKILL_PASSTHROUGH`, `SOURCE_KEYS`, `checkPassthroughTypes`)
- Modify: `cli/lib/plugins.mjs` (stage `passthrough`)
- Modify: `adapters/_shared/lib.mjs` (`PROVIDER_SKILL_KEYS`, `skillMd`/`skillFiles` nhận `{ keys }`)
- Modify: `adapters/claude/adapter.mjs`, `adapters/cursor/adapter.mjs` (codex giữ nguyên — không truyền keys)
- Modify: `cli/lib/pack.mjs` (gói Cowork truyền `skillKeys: []`)
- Modify (nội dung): 4 skill `*-init`, 9 skill nhận `argument-hint` (liệt kê ở Step 6)
- Test: `test/contract/80-frontmatter.contract.mjs` (thêm khối)

**Interfaces:**
- Consumes: `parseFrontmatter`, `frontmatter` (Task 1).
- Produces: `export const SKILL_PASSTHROUGH = ['argument-hint', 'arguments', 'user-invocable', 'disable-model-invocation', 'allowed-tools', 'disallowed-tools', 'effort', 'paths', 'compatibility', 'metadata']` (conventions.mjs).
- Produces: `export function checkPassthroughTypes(meta) -> string[]` (conventions.mjs).
- Produces: mỗi stage skill/workflow có `passthrough: Object` (chỉ khoá có mặt, theo thứ tự `SKILL_PASSTHROUGH`).
- Produces: `export const PROVIDER_SKILL_KEYS = { claude: SKILL_PASSTHROUGH, cursor: ['paths', 'disable-model-invocation', 'metadata'], codex: [] }` (lib.mjs).
- Produces: `skillMd(stage, preamble = '', { keys = [] } = {})`, `skillFiles(stage, base, preamble = '', { keys = [] } = {})`.
- Produces: claude adapter đọc `ctx.skillKeys` (mặc định `PROVIDER_SKILL_KEYS.claude`); skill principles sinh ra (core + `<id>-principles`) có `user-invocable: false` khi `skillKeys` chứa `user-invocable`.

- [ ] **Step 1: Viết test đỏ** — thêm vào cuối `run()` của `80-frontmatter.contract.mjs`:

```js
  // Task 2: passthrough skill theo provider
  {
    const { claudeAdapter, codexAdapter, cursorAdapter, fxCore, fxMk, byPath, checkPassthroughTypes, SOURCE_KEYS } = ctx;
    ok(SOURCE_KEYS.skill.includes('disable-model-invocation') && SOURCE_KEYS.workflow.includes('argument-hint')
      && !SOURCE_KEYS.skill.includes('when_to_use'), 'SOURCE_KEYS: skill nhận khoá passthrough (không có when_to_use), workflow nhận argument-hint');
    ok(checkPassthroughTypes({ 'argument-hint': ['PR'] }).length === 1, 'checkPassthroughTypes: argument-hint là list (quên quote "[...]") → lỗi');
    ok(checkPassthroughTypes({ 'disable-model-invocation': 'true' }).length === 1, 'checkPassthroughTypes: cờ boolean viết dạng chuỗi → lỗi');
    ok(checkPassthroughTypes({ 'allowed-tools': ['Read'], paths: 'src/**', metadata: { a: 1 }, effort: 'high' }).length === 0,
      'checkPassthroughTypes: kiểu hợp lệ → không lỗi');
    ok(checkPassthroughTypes({ effort: 'huge' }).length === 1, 'checkPassthroughTypes: effort ngoài low|medium|high|xhigh|max → lỗi');
    const stage = { id: 'fx-init', title: '', description: 'Fixture init. Dùng khi người dùng muốn "a", "b", "c". Không dùng khi x → fx-other.',
      body: '## Quy trình\nx\n', passthrough: { 'argument-hint': '[path]', 'disable-model-invocation': true, paths: ['src/**'] },
      assets: [], fileAssets: [], dirAssets: [], assetsDir: '' };
    const fx = { id: 'fx', name: 'Fx', description: 'Fx', version: '1.0.0', shared: { principles: 'P\n' }, stages: [stage], agents: [] };
    const cl = byPath(claudeAdapter.build([fx], { marketplace: fxMk, core: fxCore }));
    const clMd = cl.get('plugins/fx/skills/fx-init/SKILL.md').content;
    ok(clMd.includes('argument-hint: "[path]"') && clMd.includes('disable-model-invocation: true') && clMd.includes('paths:\n  - src/**'),
      'claude skill: chiếu argument-hint, disable-model-invocation, paths');
    ok(cl.get('plugins/fx/skills/fx-principles/SKILL.md').content.includes('user-invocable: false')
      && cl.get('plugins/core/skills/principles/SKILL.md').content.includes('user-invocable: false'),
      'claude: skill principles (core + plugin) có user-invocable: false');
    const cw = byPath(claudeAdapter.build([fx], { marketplace: fxMk, core: fxCore, skillKeys: [] }));
    const cwMd = cw.get('plugins/fx/skills/fx-init/SKILL.md').content;
    ok(!cwMd.includes('argument-hint') && !cw.get('plugins/core/skills/principles/SKILL.md').content.includes('user-invocable'),
      'claude skillKeys: [] (gói Cowork): chỉ name + description');
    const cx = byPath(codexAdapter.build([fx], { core: fxCore }));
    const cxFm = cx.get('fx/skills/fx-init/SKILL.md').content.split('\n---')[0];
    ok(!cxFm.includes('argument-hint') && !cxFm.includes('disable-model-invocation'), 'codex skill: chỉ name + description');
    const cu = byPath(cursorAdapter.build([fx], { core: fxCore }));
    const cuMd = cu.get('fx/.cursor/skills/fx-init/SKILL.md').content;
    ok(cuMd.includes('disable-model-invocation: true') && cuMd.includes('paths:') && !cuMd.includes('argument-hint'),
      'cursor skill: chỉ paths, disable-model-invocation, metadata');
  }
```

Thêm vào `test/context.mjs`: import `cursorAdapter` từ `../adapters/cursor/adapter.mjs`, `checkPassthroughTypes` từ conventions; đưa vào object trả về.

- [ ] **Step 2: Chạy để thấy đỏ** — `node test/validate.mjs --only frontmatter` → FAIL ở các assert Task 2.

- [ ] **Step 3: conventions.mjs**

```js
// Khoá skill chiếu thẳng sang SKILL.md, tên theo https://code.claude.com/docs/en/skills.md (re-fetch 2026-10-08).
// Không có when_to_use: Claude gộp nó với description nên không tiết kiệm token, provider khác không hiểu.
export const SKILL_PASSTHROUGH = ['argument-hint', 'arguments', 'user-invocable', 'disable-model-invocation',
  'allowed-tools', 'disallowed-tools', 'effort', 'paths', 'compatibility', 'metadata'];

export const SOURCE_KEYS = {
  skill: ['name', 'description', 'order', 'title', 'runsIn', 'invoke', 'sharedAssets', ...SKILL_PASSTHROUGH],
  agent: ['name', 'description', 'mode', 'skills', 'model', 'effort', 'color'],
  workflow: ['name', 'description', 'order', 'title', 'kind', 'tier', 'risk', 'agents', 'requires', 'runsIn', 'invoke', 'argument-hint'],
};

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const isStr = (v) => typeof v === 'string';
const isStrList = (v) => isStr(v) || (Array.isArray(v) && v.every(isStr));
const PASSTHROUGH_TYPES = {
  'argument-hint': [isStr, 'chuỗi (giá trị bắt đầu bằng "[" phải đặt trong ngoặc kép)'],
  arguments: [isStrList, 'chuỗi hoặc list chuỗi'],
  'user-invocable': [(v) => typeof v === 'boolean', 'true/false'],
  'disable-model-invocation': [(v) => typeof v === 'boolean', 'true/false'],
  'allowed-tools': [isStrList, 'chuỗi hoặc list chuỗi'],
  'disallowed-tools': [isStrList, 'chuỗi hoặc list chuỗi'],
  effort: [(v) => EFFORTS.includes(v), EFFORTS.join('|')],
  paths: [isStrList, 'chuỗi hoặc list chuỗi'],
  compatibility: [(v) => isStr(v) && [...v].length <= 500, 'chuỗi ≤ 500 ký tự'],
  metadata: [(v) => !!v && typeof v === 'object' && !Array.isArray(v), 'map'],
};

export function checkPassthroughTypes(meta) {
  return Object.entries(PASSTHROUGH_TYPES)
    .filter(([k]) => meta[k] !== undefined && !PASSTHROUGH_TYPES[k][0](meta[k]))
    .map(([k, [, want]]) => `khoá "${k}" sai kiểu (cần ${want})`);
}
```

- [ ] **Step 4: plugins.mjs** — import `SKILL_PASSTHROUGH`, `checkPassthroughTypes`; trong `assertSourceKeys` gộp thêm lỗi kiểu:

```js
function assertSourceKeys(kind, meta, file) {
  const errs = [...checkSourceKeys(kind, meta), ...(kind === 'agent' ? [] : checkPassthroughTypes(meta))];
  if (errs.length) throw new Error(`${path.relative(REPO_ROOT, file)}: ${errs.join('; ')}`);
}

const pickPassthrough = (meta, keys) =>
  Object.fromEntries(keys.filter((k) => meta[k] !== undefined).map((k) => [k, meta[k]]));
```

Stage skill: thêm `passthrough: pickPassthrough(meta, SKILL_PASSTHROUGH)`; stage workflow: `passthrough: pickPassthrough(meta, ['argument-hint'])`.

- [ ] **Step 5: lib.mjs + adapter**

`adapters/_shared/lib.mjs`:

```js
import { SKILL_PASSTHROUGH } from '../../cli/lib/conventions.mjs';

// Mỗi provider chỉ nhận khoá nó hiểu. Codex SKILL.md giữ name + description; Cursor theo tài liệu Agent Skills [Unverified].
export const PROVIDER_SKILL_KEYS = {
  claude: SKILL_PASSTHROUGH,
  cursor: ['paths', 'disable-model-invocation', 'metadata'],
  codex: [],
};

export function skillMd(stage, preamble = '', { keys = [] } = {}) {
  const pt = stage.passthrough || {};
  return (
    frontmatter([
      ['name', stage.id],
      ['description', stage.description],
      ...keys.filter((k) => pt[k] !== undefined).map((k) => [k, pt[k]]),
    ]) +
    '\n\n' +
    (preamble ? preamble.trim() + '\n\n' : '') +
    stage.body.replace(/^\n+/, '')
  );
}

export function skillFiles(stage, base, preamble = '', opts = {}) {
  const dir = `${base}/${stage.id}`;
  return [{ path: `${dir}/SKILL.md`, content: skillMd(stage, preamble, opts) }, ...assetFiles(stage, dir)];
}
```

`adapters/claude/adapter.mjs`: trong `build(plugins, { marketplace, core, workflows, skillKeys = PROVIDER_SKILL_KEYS.claude })`:
- truyền `{ keys: skillKeys }` vào mọi `skillFiles(...)` (core stages, plugin stages, workflows);
- `coreFiles(core, { author, skillKeys })` và `pluginPrinciplesFiles(p, skillKeys)` thêm cặp `['user-invocable', skillKeys.includes('user-invocable') ? false : undefined]` sau description, kèm comment một dòng: `// Principles là nền cho skill khác, không phải lệnh người dùng gõ; model vẫn gọi được.`
- `workflowFiles(wfs, plugins, author, skillKeys)` truyền `{ keys: skillKeys }`.

`adapters/cursor/adapter.mjs`: import `PROVIDER_SKILL_KEYS`; mọi `skillFiles(s, …)` thêm tham số `''` cho preamble và `{ keys: PROVIDER_SKILL_KEYS.cursor }`.

`cli/lib/pack.mjs` dòng ~154: `claudeAdapter.build(plugins, { outDir: tmp, marketplace: loadMarketplace(), core, skillKeys: [] })` + comment `// Cowork upload chỉ chắc chắn nhận name + description; khoá Claude Code khác bỏ để zip không bị từ chối.`

- [ ] **Step 6: Nội dung — thêm khoá vào frontmatter nguồn** (giá trị bắt đầu bằng `[` **phải** đặt trong ngoặc kép):

| File | Khoá thêm |
|---|---|
| `plugins/backend/skills/backend-init/SKILL.md` | `disable-model-invocation: true` |
| `plugins/frontend/skills/frontend-init/SKILL.md` | `disable-model-invocation: true` |
| `plugins/data/skills/data-oltp-init/SKILL.md` | `disable-model-invocation: true` |
| `plugins/data/skills/data-olap-init/SKILL.md` | `disable-model-invocation: true` |
| `plugins/backend/skills/backend-implement/SKILL.md` | `argument-hint: "[use case | đường dẫn contract]"` |
| `plugins/frontend/skills/frontend-implement/SKILL.md` | `argument-hint: "[đường dẫn thiết kế | link Figma]"` |
| `plugins/backend/skills/backend-fix/SKILL.md` | `argument-hint: "[failing test | finding | bottleneck] [danh sách file]"` |
| `plugins/frontend/skills/frontend-fix/SKILL.md` | `argument-hint: "[failing test | finding | bottleneck] [danh sách file]"` |
| `plugins/backend/skills/backend-code-review/SKILL.md` | `argument-hint: "[PR | branch | đường dẫn]"` |
| `plugins/frontend/skills/frontend-code-review/SKILL.md` | `argument-hint: "[PR | branch | đường dẫn]"` |
| `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` | `argument-hint: "[đường dẫn requirement/use case/ARD]"` |
| `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | `argument-hint: "[mô tả yêu cầu]"` |
| `plugins/engineering/skills/engineering-adr/SKILL.md` | `argument-hint: "[quyết định cần chốt]"` |

Đặt khoá mới ngay sau dòng `invoke:` (hoặc dòng cuối frontmatter nếu không có `invoke:`).

Thêm test build vào `80-frontmatter.contract.mjs` (chỉ chạy khi `build/claude` tồn tại):

```js
  {
    const { fs, path, claudeDir, plugins } = ctx;
    if (fs.existsSync(claudeDir)) {
      const fmOf = (p) => (fs.readFileSync(p, 'utf8').match(/^---\n([\s\S]*?)\n---/) || ['', ''])[1];
      for (const p of plugins) for (const s of p.stages.filter((x) => x.id.endsWith('-init'))) {
        ok(/^disable-model-invocation: true$/m.test(fmOf(path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'SKILL.md'))),
          `build claude ${s.id}: disable-model-invocation: true (D2)`);
      }
      for (const p of plugins) {
        const f = path.join(claudeDir, 'plugins', p.id, 'skills', `${p.id}-principles`, 'SKILL.md');
        if (fs.existsSync(f)) ok(/^user-invocable: false$/m.test(fmOf(f)), `build claude ${p.id}-principles: user-invocable: false`);
      }
      const hinted = plugins.flatMap((p) => p.stages.filter((s) => s.passthrough['argument-hint']).map((s) => [p.id, s.id]));
      ok(hinted.length >= 9, `có ≥ 9 skill khai báo argument-hint (=${hinted.length})`);
      for (const [pid, sid] of hinted) {
        ok(/^argument-hint: ".+"$/m.test(fmOf(path.join(claudeDir, 'plugins', pid, 'skills', sid, 'SKILL.md'))), `build claude ${sid}: argument-hint`);
      }
    }
  }
```

Cập nhật assert cũ trong `test/contract/20-build.contract.mjs` nếu nó đòi frontmatter "chỉ name+description" theo cách loại trừ khoá passthrough (hiện chỉ kiểm có name/description và không có `order`/`runsIn` — giữ nguyên nếu vẫn xanh).

- [ ] **Step 7: Chạy test** — theo Global Constraints. Expected: chỉ FAIL lock (R9).
- [ ] **Step 8: Commit** — `feat(platform): project skill frontmatter keys per provider`

---

### Task 3: Agent — `tools` allowlist, `skills` preload, khoá passthrough

**Files:**
- Modify: `cli/lib/conventions.mjs` (`SOURCE_KEYS.agent`, `checkAgentTools`)
- Modify: `cli/lib/plugins.mjs` (`loadAgents`)
- Modify: `adapters/_shared/agents.mjs` (`claudeAgentMd`)
- Modify (nội dung): 5 agent read-only (Step 5); body 2 agent ops nếu có câu bảo agent tự chạy lệnh
- Test: `test/contract/80-frontmatter.contract.mjs`; `test/contract/00-unit.contract.mjs` (assert agent cũ vẫn xanh)

**Interfaces:**
- Consumes: `frontmatter` ghi list (Task 1), `splitList` nhận mảng (Task 1).
- Produces: agent model có thêm `tools: string[]`, `maxTurns: number|null`, `isolation: string|null`.
- Produces: `export function checkAgentTools(agent) -> string[]` (conventions.mjs).
- Produces: agent Claude có `skills:` là YAML list **một phần tử** = tên trần skill đầu tiên (R3); `tools: A, B` khi nguồn có `tools`.

- [ ] **Step 1: Viết test đỏ**

```js
  // Task 3: agent passthrough
  {
    const { claudeAdapter, codexAdapter, fxPlugin, fxAgent, fxCore, fxMk, byPath, checkAgentTools, SOURCE_KEYS } = ctx;
    ok(['tools', 'maxTurns', 'isolation'].every((k) => SOURCE_KEYS.agent.includes(k)) && !SOURCE_KEYS.agent.includes('permissionMode'),
      'SOURCE_KEYS.agent: có tools/maxTurns/isolation, không có permissionMode (bị bỏ qua với agent plugin)');
    const ag = { ...fxAgent, skills: ['fx/fx-review', 'fx/fx-extra'], tools: ['Read', 'Grep', 'Glob', 'Skill'], maxTurns: 20, isolation: null };
    const md = byPath(claudeAdapter.build([{ ...fxPlugin, agents: [ag] }], { marketplace: fxMk, core: fxCore }))
      .get('plugins/fx/agents/fx-reviewer.md').content;
    ok(md.includes('tools: Read, Grep, Glob, Skill') && md.includes('skills:\n  - fx-review\n') && !md.includes('- fx-extra'),
      'claude agent: tools chuỗi phẩy + skills preload chỉ skill đầu (tên trần)');
    ok(md.includes('maxTurns: 20') && !md.includes('isolation:'), 'claude agent: maxTurns khi có, bỏ isolation khi null');
    const plain = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore })).get('plugins/fx/agents/fx-reviewer.md').content;
    ok(!/^tools:/m.test(plain) && plain.includes('skills:\n  - fx-review'), 'claude agent: không khai tools → không ghi tools, vẫn preload');
    const toml = byPath(codexAdapter.build([{ ...fxPlugin, agents: [ag] }], { core: fxCore })).get('fx/agents/fx-reviewer.toml').content;
    ok(!/^tools|^skills|^maxTurns/m.test(toml), 'codex agent: không ghi tools/skills/maxTurns');
    ok(checkAgentTools({ mode: 'read-only', skills: ['a/x', 'a/y'], tools: ['Read', 'Edit'] }).length === 2,
      'checkAgentTools: read-only có Edit + thiếu Skill khi > 1 skill → 2 lỗi');
    ok(checkAgentTools({ mode: 'read-only', skills: ['a/x'], tools: [] }).length === 0, 'checkAgentTools: không khai tools → không lỗi');
  }
  {
    const { allAgents } = ctx;
    const ro = allAgents.filter((a) => a.mode === 'read-only');
    ok(ro.length === 5 && ro.every((a) => a.tools.length > 0), 'mọi agent read-only khai báo tools allowlist (W1)');
    for (const a of allAgents) {
      const errs = ctx.checkAgentTools(a);
      ok(errs.length === 0, `${a.id}: tools hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    }
    for (const a of allAgents.filter((x) => x.plugin === 'ops')) {
      ok(!a.tools.includes('Bash'), `${a.id}: không có Bash (chỉ đề xuất lệnh)`);
    }
  }
```

Thêm `checkAgentTools` vào import/return của `test/context.mjs`.

- [ ] **Step 2: Chạy để thấy đỏ.**

- [ ] **Step 3: conventions.mjs**

```js
agent: ['name', 'description', 'mode', 'skills', 'model', 'effort', 'color', 'tools', 'maxTurns', 'isolation'],

const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'Agent'];

// tools là allowlist: agent read-only không được có tool ghi; thiếu Skill thì agent không nạp được skill thứ hai.
export function checkAgentTools(agent) {
  const tools = agent.tools || [];
  if (!tools.length) return [];
  const errs = [];
  if (agent.mode === 'read-only') {
    const bad = tools.filter((t) => WRITE_TOOLS.includes(t));
    if (bad.length) errs.push(`read-only nhưng tools có ${bad.join(', ')}`);
  }
  if ((agent.skills || []).length > 1 && !tools.includes('Skill')) errs.push('có > 1 skill nhưng tools thiếu Skill');
  return errs;
}
```

- [ ] **Step 4: plugins.mjs `loadAgents`** — thêm:

```js
      tools: splitList(meta.tools),
      maxTurns: typeof meta.maxTurns === 'number' ? meta.maxTurns : null,
      isolation: meta.isolation || null,
```

`adapters/_shared/agents.mjs`:

```js
export function claudeAgentMd(agent) {
  const tools = agent.tools || [];
  const head = frontmatter([
    ['name', agent.id],
    ['description', agent.description],
    ['tools', tools.length ? tools.join(', ') : null],
    ['disallowedTools', CLAUDE_DENY[agent.mode]],
    // Preload chỉ skill chính: preload nhét toàn bộ nội dung skill vào mỗi lần dispatch; skill khác gọi qua tool Skill.
    ['skills', agent.skills.length ? [agent.skills[0].split('/')[1]] : null],
    ['model', agent.model],
    ['effort', agent.effort],
    ['color', agent.color],
    ['maxTurns', agent.maxTurns ?? null],
    ['isolation', agent.isolation ?? null],
  ]);
  const note = `> **Dùng skill:** ${skillPointer(agent.skills)}.\n${principlesDigest({ provider: 'claude' })}`;
  return `${head}\n\n${note}\n\n${agent.body.replace(/^\n+/, '')}`;
}
```

- [ ] **Step 5: Nội dung agent** — thêm dòng `tools:` ngay sau `mode:`:

| Agent | `tools` |
|---|---|
| `plugins/backend/agents/backend-reviewer.md` | `Read, Grep, Glob, Bash, Skill` |
| `plugins/frontend/agents/frontend-reviewer.md` | `Read, Grep, Glob, Bash, Skill` |
| `plugins/engineering/agents/engineering-quality-auditor.md` | `Read, Grep, Glob, Bash, Skill` |
| `plugins/ops/agents/ops-incident-investigator.md` | `Read, Grep, Glob, Skill` |
| `plugins/ops/agents/ops-release-engineer.md` | `Read, Grep, Glob, Skill` |

Ghi dạng chuỗi phẩy (không quote — dấu phẩy an toàn trong plain scalar). Sau đó đọc body 2 agent ops: câu nào bảo agent **tự chạy** lệnh (Bash, `kubectl`, `curl`, "chạy lệnh") thì sửa thành "đề xuất lệnh để người dùng chạy và dán kết quả lại", giữ nguyên các câu cấm. Không đổi gì khác trong body.

Agent description không đổi → không cần sửa `checkAgentDescription`.

- [ ] **Step 6: Chạy test** (Global Constraints). Assert cũ `20-build` đòi `disallowedTools … Agent` vẫn xanh vì `disallowedTools` vẫn ghi.
- [ ] **Step 7: Commit** — `feat(platform): project agent tools allowlist and skill preload`

---

### Task 4: Workflow — gate ⏸ đầu cho risk cao, argument-hint, description đúng mẫu

**Files:**
- Modify: `adapters/_shared/agents.mjs` (`workflowPreamble`)
- Modify (nội dung): 12 `workflows/<slug>/WORKFLOW.md` (argument-hint) + 9 description (Step 5)
- Create: `test/fixtures/workflow-not-for-ids.json` (snapshot TRƯỚC khi sửa description)
- Test: `test/contract/50-workflows.contract.mjs` (thêm khối)

**Interfaces:**
- Consumes: stage workflow có `risk`, `passthrough['argument-hint']` (Task 2); claude adapter đã truyền `{ keys }` cho workflow (Task 2).
- Produces: preamble Claude và Codex của workflow có `risk` ∈ {`high`, `critical`} chứa dòng bắt đầu bằng `> **⏸ Xác nhận trước khi bắt đầu:**`.

- [ ] **Step 1: Snapshot "Không dùng khi → id" của workflow TRƯỚC khi sửa**

```bash
node --input-type=module -e "import {loadWorkflows} from './cli/lib/plugins.mjs'; import {notForTargets} from './cli/lib/conventions.mjs'; import fs from 'node:fs'; const o={}; for (const s of loadWorkflows().stages) o[s.id]=notForTargets(s.description)||[]; fs.writeFileSync('test/fixtures/workflow-not-for-ids.json', JSON.stringify(o,null,2)+'\n');"
```

- [ ] **Step 2: Viết test đỏ** — thêm vào `test/contract/50-workflows.contract.mjs`:

```js
  // Phase 2 Task 4: gate đầu cho risk cao, argument-hint, description đúng mẫu
  {
    const snap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'test', 'fixtures', 'workflow-not-for-ids.json'), 'utf8'));
    for (const s of workflows.stages) {
      const errs = checkDescriptionStyle(s.description, { max: 500 });
      ok(errs.length === 0, `${s.id}: description đúng mẫu Phase 1 (≤ 500)${errs.length ? ' — ' + errs.join('; ') : ''}`);
      const now = notForTargets(s.description) || [];
      ok((snap[s.id] || []).every((id) => now.includes(id)), `${s.id}: giữ mọi "→ id" của snapshot`);
      if (s.kind === 'workflow') ok(typeof s.passthrough['argument-hint'] === 'string', `${s.id}: có argument-hint`);
    }
    const hi = workflows.stages.filter((s) => ['high', 'critical'].includes(s.risk));
    ok(hi.length === 4, `4 workflow risk ≥ high (=${hi.map((s) => s.id).join(', ')})`);
    if (fs.existsSync(claudeDir)) {
      for (const s of workflows.stages) {
        const c = fs.readFileSync(path.join(claudeDir, 'plugins/workflows/skills', s.id, 'SKILL.md'), 'utf8');
        const has = c.includes('> **⏸ Xác nhận trước khi bắt đầu:**');
        ok(has === hi.includes(s), `build claude ${s.id}: gate ⏸ đầu ${hi.includes(s) ? 'có' : 'không có'} (risk ${s.risk || '—'})`);
        if (s.passthrough['argument-hint']) ok(/^argument-hint: ".+"$/m.test(c.split('\n---')[0]), `build claude ${s.id}: argument-hint`);
      }
    }
  }
```

Bổ sung các tên còn thiếu (`checkDescriptionStyle`, `notForTargets`, `claudeDir`, `REPO_ROOT`) vào destructure đầu module nếu chưa có.

- [ ] **Step 3: Chạy để thấy đỏ.**

- [ ] **Step 4: `workflowPreamble`** — thêm ngay sau dòng digest ở **cả hai** nhánh (claude, codex):

```js
// D3: không dùng disable-model-invocation (ẩn description → orchestrator không route được); chặn bằng xác nhận đầu.
const startGate = (wf) => (['high', 'critical'].includes(wf.risk)
  ? `> **⏸ Xác nhận trước khi bắt đầu:** workflow risk ${wf.risk} — tóm tắt phạm vi, môi trường đích và các bước có tác động; dừng chờ người dùng đồng ý rồi mới vào Bước 1.`
  : null);
```

Trong `workflowPreamble`: `const g = startGate(wf); if (g) L.push(g);` ngay sau `L.push(principlesDigest(...))` ở mỗi nhánh.

- [ ] **Step 5: Nội dung workflow**

(a) `argument-hint` cho 12 workflow (`kind: workflow`, không phải orchestrator), đặt ngay sau dòng `risk:`:

| slug | argument-hint |
|---|---|
| api | `"[endpoint | use case]"` |
| bugfix | `"[mô tả bug | issue]"` |
| code-review | `"[PR | branch]"` |
| db-change | `"[thay đổi schema]"` |
| docs | `"[tài liệu cần cập nhật]"` |
| feature | `"[yêu cầu | đường dẫn requirement]"` |
| incident | `"[triệu chứng | thời điểm bắt đầu]"` |
| performance | `"[luồng | metric mục tiêu]"` |
| refactor | `"[module | mục tiêu refactor]"` |
| release | `"[version | phạm vi release]"` |
| security-review | `"[phạm vi | PR]"` |
| testing | `"[module | loại test]"` |

(b) Viết lại description của 9 workflow đang lệch mẫu: `workflow-orchestrator`, `workflow-feature`, `workflow-bugfix`, `workflow-testing`, `workflow-security-review`, `workflow-performance`, `workflow-incident`, `workflow-release`, `workflow-docs`. Mẫu: `<câu hành động ≤ 200 ký tự>. Dùng khi người dùng muốn "t1", "t2", "t3"[, "t4", "t5"]. Không dùng khi <trường hợp> → <id>[; … → <id>].` — tổng ≤ 500, 3–5 trigger, bỏ boilerplate (`kể cả khi không nói chính xác`…). Ràng buộc bắt buộc:
- giữ mọi `→ id` trong `test/fixtures/workflow-not-for-ids.json`;
- mọi tín hiệu trong cột "Tín hiệu" của Registry (`workflows/orchestrator/WORKFLOW.md`) vẫn phải xuất hiện trong description workflow đó (contract `registrySignals` hiện có). Nếu Registry có > 5 tín hiệu cho một workflow nên không thể giữ 3–5 trigger → **dừng, trả BLOCKED** kèm danh sách, không tự sửa Registry;
- không tạo trigger trùng nguyên văn với skill (contract `triggerCollisions`).

- [ ] **Step 6: Chạy test** (Global Constraints). Chạy thêm `npm run overlap` và dán phần workflow/workflow vào report (tham khảo, không phải gate).
- [ ] **Step 7: Commit** — `feat(workflows): gate high-risk starts, add argument hints, align descriptions`

---

### Task 5: Workflow gọn hơn — tách nhánh hiếm sang `references/`, rút Evidence trùng Gate

**Files:**
- Modify: các `workflows/<slug>/WORKFLOW.md` cần rút
- Create: `workflows/<slug>/references/<chủ-đề>.md` (chỉ khi có khối đủ điều kiện tách)
- Modify: `test/context.mjs` (helper `wfText`), các pin trong `test/content/*.pin.mjs` đọc câu đã chuyển chỗ
- Test: `test/contract/50-workflows.contract.mjs`

**Interfaces:**
- Consumes: loader đã ship thư mục con của workflow làm asset (`assets` = thư mục con, copy bằng `copyDir`) — không cần sửa engine.
- Produces: `wfText(slug) -> string` trong ctx = nội dung `WORKFLOW.md` + mọi file `references/*.md` của workflow đó (nối theo tên file).

Quy tắc (reviewer kiểm theo đúng các dòng này):
1. **Không bao giờ chuyển**: heading `### Bước N`, ký hiệu `⏸`, các dòng trường `Thực hiện`/`Gate`/`Khi fail`, mọi câu cấm/ranh giới an toàn trong `Ràng buộc`, các mục `## Checkpoint`, `## Definition of Done`, `## Report cuối`, Registry của orchestrator.
2. **Được chuyển** sang `references/<chủ-đề>.md`: khối chỉ áp dụng cho một nhánh điều kiện (vd "khi quay lại từ Bước 6", chi tiết riêng phía frontend hoặc backend, bảng rollback dài, ví dụ mẫu). Chỗ cũ để **một dòng** trỏ: `Khi <điều kiện> → đọc \`references/<chủ-đề>.md\`.`
3. **Evidence trùng Gate**: khi dòng `- **Evidence:**` chỉ nhắc lại nội dung Gate, rút thành bằng chứng cụ thể ngắn (vd `- **Evidence:** report bước + lệnh đã chạy.`). Không xoá dòng `Evidence` (khung `checkWorkflowBody` đòi trường này).
4. Mục tiêu đo được: tổng byte 13 `WORKFLOW.md` giảm **≥ 10 %** so với đầu task. Báo bảng byte trước/sau từng file trong report. Không đạt 10 % mà không còn khối đủ điều kiện → báo con số thật, không cố chuyển thêm.

- [ ] **Step 1: Ghi số đo đầu task**

```bash
node -e "const fs=require('fs');let t=0;for(const d of fs.readdirSync('workflows')){const f='workflows/'+d+'/WORKFLOW.md';if(fs.existsSync(f)){const n=fs.statSync(f).size;t+=n;console.log(d,n)}}console.log('TOTAL',t)"
```

- [ ] **Step 2: Viết test đỏ** — thêm vào `50-workflows.contract.mjs`:

```js
  // Phase 2 Task 5: mọi references/<x>.md được trỏ tới phải tồn tại và được ship
  for (const s of workflows.stages) {
    const refs = [...s.body.matchAll(/`references\/([\w.-]+\.md)`/g)].map((m) => m[1]);
    for (const r of new Set(refs)) {
      ok(fs.existsSync(path.join(s.dir, 'references', r)), `${s.id}: references/${r} tồn tại`);
      if (fs.existsSync(claudeDir)) {
        ok(fs.existsSync(path.join(claudeDir, 'plugins/workflows/skills', s.id, 'references', r)), `build claude ${s.id}: ship references/${r}`);
      }
    }
  }
```

Test này xanh trước khi chuyển (chưa có trỏ) — đỏ sẽ xuất hiện nếu trỏ sai sau khi chuyển. Thêm `wfText` vào `test/context.mjs`:

```js
  const wfText = (slug) => {
    const dir = path.join(REPO_ROOT, 'workflows', slug);
    const refDir = path.join(dir, 'references');
    const refs = fs.existsSync(refDir) ? fs.readdirSync(refDir).filter((f) => f.endsWith('.md')).sort() : [];
    return [path.join(dir, 'WORKFLOW.md'), ...refs.map((f) => path.join(refDir, f))]
      .map((f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).join('\n');
  };
```

- [ ] **Step 3: Rút gọn từng workflow theo quy tắc 1–4**, bắt đầu từ file lớn nhất (`performance`, `db-change`, `security-review`, `feature`, `bugfix`).

- [ ] **Step 4: Chạy `node test/validate.mjs --build`.** Pin trong `test/content/*.pin.mjs` đỏ vì câu đã chuyển sang `references/` → chỉ đổi **nguồn đọc** của pin sang `ctx.wfText('<slug>')`, **không đổi câu được assert**. Pin đỏ vì câu bị xoá/viết lại → khôi phục câu (đó là mất nội dung).

- [ ] **Step 5: Ghi số đo cuối** (lệnh Step 1) và chạy toàn bộ test (Global Constraints).
- [ ] **Step 6: Commit** — `refactor(workflows): move rare branches to references and trim evidence lines`

---

### Task 6: Marketplace không lộ skill draft + metadata plugin + description manifest

**Files:**
- Modify: `cli/build.mjs` (cờ `--include-draft`, truyền `published`)
- Modify: `adapters/claude/adapter.mjs` (draft → `drafts/`, `pluginJson` metadata, keywords)
- Modify: `cli/lib/install.mjs` (`installOne` claude đọc cả `drafts/`)
- Modify: `plugins/_marketplace.json` (`homepage`, `repository`, `license`, `owner.url`)
- Modify: 5 `plugins/<id>/.manifest.json` + `core/.manifest.json` (thêm `keywords`; viết lại description backend/data/engineering/frontend)
- Modify: `test/content/02-p0-fixes.pin.mjs` (về hưu vòng PL2 — đã thành contract)
- Test: `test/contract/20-build.contract.mjs`, `test/contract/10-source.contract.mjs`, `test/install.test.mjs`

**Interfaces:**
- Consumes: `loadPublished()` → `{pluginId: '*' | string[]} | null`.
- Produces: claude adapter nhận `ctx.published` (null/undefined = không lọc, giữ hành vi cũ cho `pack.mjs` và fixture test). Skill draft → `drafts/<plugin>/skills/<skill>/`; agent có skill draft → `drafts/<plugin>/agents/<agent>.md`.
- Produces: `node cli/build.mjs --target claude --include-draft` → draft nằm lại trong `plugins/`.
- Produces: plugin.json có `homepage`, `repository`, `license` (từ `_marketplace.json`), `keywords` (từ manifest `keywords`, thiếu thì giữ mặc định cũ).

- [ ] **Step 1: Viết test đỏ**

`test/contract/20-build.contract.mjs`, trong khối `if (fs.existsSync(claudeDir))`:

```js
    // Phase 2 Task 6: marketplace không lộ skill draft (E8)
    {
      const pub = loadPublished();
      const isDraft = (pid, sid) => !!pub && pub[pid] !== '*' && !(pub[pid] || []).includes(`${pid}/${sid}`);
      for (const p of plugins) for (const s of p.stages) {
        const inPlugins = fs.existsSync(path.join(claudeDir, 'plugins', p.id, 'skills', s.id, 'SKILL.md'));
        const inDrafts = fs.existsSync(path.join(claudeDir, 'drafts', p.id, 'skills', s.id, 'SKILL.md'));
        ok(isDraft(p.id, s.id) ? (!inPlugins && inDrafts) : (inPlugins && !inDrafts),
          `build claude ${s.id}: ${isDraft(p.id, s.id) ? 'draft nằm ở drafts/' : 'published nằm ở plugins/'}`);
      }
      for (const a of allAgents) {
        const inPlugins = fs.existsSync(path.join(claudeDir, 'plugins', a.plugin, 'agents', `${a.id}.md`));
        if (inPlugins) ok(a.skills.every((sid) => !isDraft(...sid.split('/'))), `build claude agent ${a.id}: không trỏ skill draft`);
      }
      const pj = JSON.parse(fs.readFileSync(path.join(claudeDir, 'plugins/backend/.claude-plugin/plugin.json'), 'utf8'));
      ok(/^https:\/\//.test(pj.homepage || '') && !!pj.repository && pj.license === 'MIT', 'plugin.json: homepage/repository/license (E9)');
      ok(Array.isArray(pj.keywords) && pj.keywords.includes('backend') && !pj.keywords.includes('cowork-to-code'),
        'plugin.json: keywords riêng theo plugin');
    }
```

Thêm `loadPublished` vào import/return của `test/context.mjs` nếu chưa có. Lưu ý: assert keywords cũ trong test (nếu có) dùng `'cowork-to-code'` → cập nhật theo keywords mới.

`test/contract/10-source.contract.mjs`:

```js
  // Phase 2 Task 6: manifest description gọn và nêu đủ skill published (thay pin PL2)
  {
    const pub = loadPublished();
    for (const u of [core, ...plugins]) {
      const len = [...u.description].length;
      ok(len <= 500, `${u.id}: manifest description ≤ 500 ký tự (=${len})`);
      const published = u.stages.filter((s) => u.id === 'core' || !pub || pub[u.id] === '*' || (pub[u.id] || []).includes(`${u.id}/${s.id}`));
      const missing = published.map((s) => s.id).filter((id) => !u.description.includes(id));
      ok(missing.length === 0, `${u.id}: manifest description nêu đủ skill published (thiếu: ${missing.join(', ')})`);
      ok(Array.isArray(u.manifest.keywords) && u.manifest.keywords.length >= 2, `${u.id}: manifest có keywords`);
    }
  }
```

Nếu `core/.manifest.json` hoặc `plugins/ops/.manifest.json` chưa nêu đủ skill published (`git-workflow`; 3 skill ops) thì bổ sung vào description của chúng, vẫn ≤ 500 ký tự.

`test/install.test.mjs`: thêm một case cài skills-mode claude cho skill draft, theo mẫu các case `--skill` sẵn có (dùng `AIE_INSTALL_ROOT` = thư mục tạm, `parse()` từ `cli/lib/args.mjs` như các case khác):

```js
// Skill draft nằm ở build/claude/drafts/ nhưng vẫn cài skills-mode được (R6).
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf-draft-'));
  try {
    // dùng đúng helper chạy install của file này (ví dụ runInstall / install(parse([...]))) với:
    //   --provider claude --skill data/data-oltp-init --yes, scope project, AIE_INSTALL_ROOT=root
    // rồi assert:
    ok(fs.existsSync(path.join(root, '.claude', 'skills', 'data-oltp-init', 'SKILL.md')), 'install claude skills-mode: cài được skill draft từ drafts/');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
```

(Implementer thay hai dòng comment bằng lời gọi install đúng helper của file — đọc 3 case `--skill` gần dòng 332 để chép mẫu.)

- [ ] **Step 2: Chạy để thấy đỏ.**

- [ ] **Step 3: `cli/build.mjs`** — `parseArgs` thêm `includeDraft: false` và `else if (v === '--include-draft') a.includeDraft = true;`; import `loadPublished`; gọi adapter với `{ outDir, marketplace, core, workflows, published: args.includeDraft ? null : loadPublished() }`. Cập nhật dòng "Dùng:" ở đầu file + chuỗi help (`--include-draft`).

- [ ] **Step 4: claude adapter**

```js
// Marketplace chỉ đọc plugins/, nên skill draft để ở drafts/: cài skills-mode và gói Cowork vẫn lấy được, marketplace thì không thấy.
function draftOf(published) {
  if (!published) return () => false;
  return (pid, sid) => published[pid] !== '*' && !(published[pid] || []).includes(`${pid}/${sid}`);
}
```

Trong vòng `for (const p of plugins)`: `const isDraft = draftOf(published);` — stage: `const base = isDraft(p.id, stage.id) ? \`drafts/${p.id}/skills\` : \`plugins/${p.id}/skills\`;`; agent: nếu `a.skills.some((sid) => isDraft(...sid.split('/')))` thì path `drafts/${p.id}/agents/${a.id}.md`. Core và workflows không lọc.

`pluginJson(p, { dependencies, author, meta })`:

```js
  const obj = {
    name: p.id,
    displayName: p.name,
    description: p.description,
    version: p.version,
    author,
    homepage: meta && meta.homepage,
    repository: meta && meta.repository,
    license: meta && meta.license,
    keywords: Array.isArray(p.manifest && p.manifest.keywords) ? p.manifest.keywords : ['workflow', p.id],
  };
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
```

`meta = { homepage: marketplace.homepage, repository: marketplace.repository, license: marketplace.license }` truyền vào mọi lời gọi `pluginJson` (core, plugin, workflows). `marketplaceJson` giữ nguyên (owner tự mang `url`).

- [ ] **Step 5: `cli/lib/install.mjs` `installOne`** — nhánh `layout.kind === 'claude'`: thay `const pluginsDir = …; if (!fs.existsSync(pluginsDir)) return …; for (const id of fs.readdirSync(pluginsDir))` bằng vòng qua hai gốc:

```js
    // drafts/ giữ skill chưa published (không vào marketplace) nhưng skills-mode vẫn cài được.
    for (const rootName of ['plugins', 'drafts']) {
      const pluginsDir = path.join(pbuild, rootName);
      if (!fs.existsSync(pluginsDir)) continue;
      for (const id of fs.readdirSync(pluginsDir)) {
        // … giữ nguyên thân vòng lặp cũ …
      }
    }
```

- [ ] **Step 6: Nội dung**

`plugins/_marketplace.json`:

```json
{
  "name": "ai-engineering-platform",
  "owner": {
    "name": "ai-engineering-platform",
    "url": "https://github.com/leduyminhh/ai-engineering-platform"
  },
  "description": "(giữ nguyên chuỗi hiện tại)",
  "homepage": "https://github.com/leduyminhh/ai-engineering-platform",
  "repository": "https://github.com/leduyminhh/ai-engineering-platform",
  "license": "MIT"
}
```

`keywords` trong manifest:

| Manifest | keywords |
|---|---|
| `core/.manifest.json` | `["principles", "git", "workflow"]` |
| `plugins/backend/.manifest.json` | `["backend", "java", "spring", "python", "api"]` |
| `plugins/frontend/.manifest.json` | `["frontend", "react", "typescript", "ui"]` |
| `plugins/engineering/.manifest.json` | `["engineering", "spec", "adr", "quality", "release"]` |
| `plugins/ops/.manifest.json` | `["ops", "deploy", "incident", "observability"]` |
| `plugins/data/.manifest.json` | `["data", "database", "migration"]` |

Kiểm `test/contract/10-source.contract.mjs` / `60-versions` có assert tập khoá manifest cố định không — nếu có, thêm `keywords` vào tập cho phép.

Viết lại `description` của `backend` (713), `data` (741), `engineering` (948), `frontend` (1223) xuống ≤ 500 ký tự: một câu nêu plugin làm gì + `Skill: id1, id2, …` (đủ mọi skill published). Giữ chuỗi các pin hiện có còn kiểm: `engineering` vẫn nêu `check-tasks.mjs`; `frontend` không có `Layered`, không có `DRAFT`; `data` không có `DRAFT`. `data`: skill draft không bắt buộc nêu.

Về hưu pin PL2 trong `test/content/02-p0-fixes.pin.mjs` (vòng `for (const id of ['backend', 'frontend', 'engineering'])` dòng ~35–42) vì đã thành contract ở 10-source (D4). Giữ các assert khác trong khối.

- [ ] **Step 7: Chạy test** (Global Constraints). Chạy thêm `node cli/build.mjs --target claude --include-draft` rồi kiểm tay `build/claude/plugins/data/skills/data-oltp-init/SKILL.md` tồn tại; sau đó chạy lại `npm run build` để `build/` về trạng thái mặc định trước khi chạy test khác.
- [ ] **Step 8: Commit** — `feat(claude): keep draft skills out of the marketplace, add plugin metadata`

---

### Task 7: `aip check` đọc `plugin list --json`; dọn thư mục tạm của install.test

**Files:**
- Modify: `cli/lib/install.mjs` (`parseClaudePluginJson`, `claudeDoctor`)
- Modify: `test/install.test.mjs` (dọn temp dir khi thoát)
- Modify: `test/context.mjs` (export `parseClaudePluginJson`)
- Test: `test/contract/80-frontmatter.contract.mjs` (khối unit doctor) — hoặc module có test `parseClaudePluginList` hiện tại (tìm bằng grep), đặt cạnh nó.

**Interfaces:**
- Produces: `export function parseClaudePluginJson(text, marketplaceName) -> Array<{id, version}> | null` — `null` khi không phải JSON hợp lệ có dạng mảng (hoặc object có `installed` là mảng).

- [ ] **Step 1: Viết test đỏ** (đặt cạnh test `parseClaudePluginList` hiện có):

```js
  {
    const { parseClaudePluginJson } = ctx;
    const json = JSON.stringify([
      { id: 'backend@mkt', version: '1.7.0', scope: 'user', enabled: true, installPath: 'x' },
      { id: 'other@else', version: '9.9.9', scope: 'user', enabled: true, installPath: 'y' },
    ]);
    ok(JSON.stringify(parseClaudePluginJson(json, 'mkt')) === '[{"id":"backend","version":"1.7.0"}]', 'parseClaudePluginJson: lọc theo marketplace');
    ok(JSON.stringify(parseClaudePluginJson(JSON.stringify({ installed: JSON.parse(json) }), 'mkt')) === '[{"id":"backend","version":"1.7.0"}]',
      'parseClaudePluginJson: dạng {installed: [...]} (--available)');
    ok(parseClaudePluginJson('Installed plugins:\n  ❯ backend@mkt', 'mkt') === null, 'parseClaudePluginJson: output text (CLI cũ) → null để rơi về parser text');
  }
```

- [ ] **Step 2: Chạy để thấy đỏ.**

- [ ] **Step 3: Cài**

```js
/** Output `claude plugin list --json`; null khi không phải JSON để caller rơi về parser text (CLI cũ). */
export function parseClaudePluginJson(text, marketplaceName) {
  let data;
  try { data = JSON.parse(String(text || '')); } catch { return null; }
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.installed) ? data.installed : null);
  if (!rows) return null;
  return rows
    .filter((r) => r && typeof r.id === 'string' && r.id.endsWith(`@${marketplaceName}`))
    .map((r) => ({ id: r.id.slice(0, -(`@${marketplaceName}`.length)), version: r.version || null }));
}
```

`claudeDoctor`:

```js
function claudeDoctor() {
  const mkt = loadMarketplace().name;
  let entries = null;
  try {
    const j = runClaudeCli(['plugin', 'list', '--json'], { tolerate: true, timeout: 15000 });
    if (j.ok) entries = parseClaudePluginJson(j.out, mkt);
  } catch { /* rơi về text */ }
  if (!entries) {
    let out;
    try { out = runClaudeCli(['plugin', 'list'], { tolerate: true, timeout: 15000 }); } catch { return { available: false, stale: [] }; }
    if (!out.ok) return { available: false, stale: [] };
    entries = parseClaudePluginList(out.out, mkt);
  }
  const wf = loadWorkflows();
  const source = new Map([loadCore(), ...loadPlugins(), ...(wf ? [wf] : [])].map((u) => [u.id, u.version]));
  const stale = entries
    .filter((e) => e.version && source.has(e.id) && e.version !== source.get(e.id))
    .map((e) => ({ id: e.id, installed: e.version, source: source.get(e.id) }));
  return { available: true, stale };
}
```

- [ ] **Step 4: install.test.mjs** — ngay sau các import:

```js
// Assert fail giữa chừng làm bỏ qua lệnh dọn cuối khối; dọn mọi thư mục tạm khi process thoát (Node rmSync, an toàn với junction).
const TMP_DIRS = [];
const mkTmp = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); TMP_DIRS.push(d); return d; };
process.on('exit', () => { for (const d of TMP_DIRS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* đã xoá */ } } });
```

Thay mọi `fs.mkdtempSync(path.join(os.tmpdir(), '<prefix>'))` trong file bằng `mkTmp('<prefix>')` (kể cả case draft Task 6). Giữ nguyên các lệnh `rmSync` đang có.

- [ ] **Step 5: Chạy test** (Global Constraints). Đếm thư mục `cwf-*` trong `os.tmpdir()` trước/sau `node test/install.test.mjs` — không tăng.
- [ ] **Step 6: Commit** — `fix(cli): read plugin list as JSON in aip check, clean test temp dirs`

---

### Task 8: Bump version, lock, tài liệu, kiểm toàn bộ

**Files:**
- Modify: `core/.manifest.json`, `plugins/{backend,frontend,engineering,ops,data}/.manifest.json`, `workflows/.manifest.json` (version)
- Modify: `plugins/_versions.lock.json` (sinh bằng lệnh)
- Modify: `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `README_VI.md`
- Modify: `docs/superpowers/specs/2026-10-07-platform-standards-audit-design.md` (một dòng ghi chú dưới Phase 2)

- [ ] **Step 1: Bump MINOR** (R8): core 1.2.1 → **1.3.0**, backend 1.6.1 → **1.7.0**, frontend 1.8.1 → **1.9.0**, engineering 1.5.1 → **1.6.0**, ops 1.3.1 → **1.4.0**, data 1.4.1 → **1.5.0**, workflows 1.2.2 → **1.3.0**.

- [ ] **Step 2: Build + lock**

```bash
npm run build
node cli/lib/versions.mjs --lock
node cli/lib/versions.mjs --check
```

Expected: `versions lock khớp build.`

- [ ] **Step 3: Tài liệu**
- `CHANGELOG.md` `[Unreleased]`: mục Added/Changed cho Phase 2 — parser list/map/boolean + fail-loud khoá lạ; khoá skill chiếu theo provider; 4 `*-init` `disable-model-invocation`; principles `user-invocable: false`; `argument-hint` (9 skill + 12 workflow); agent `tools` allowlist (5 read-only, ops không Bash) + preload skill chính; gate ⏸ đầu cho workflow risk ≥ high; 9 description workflow theo mẫu; workflow rút gọn (số byte trước → sau từ report Task 5); draft ra `drafts/` + `--include-draft`; plugin.json homepage/repository/license/keywords; manifest description ≤ 500; `aip check` đọc `--json`; version bump.
- `CLAUDE.md` mục "Adding capability content": khoá passthrough skill (`SKILL_PASSTHROUGH`, giá trị bắt đầu bằng `[` phải quote), khoá agent `tools`/`maxTurns`/`isolation` (`permissionMode` bị bỏ qua với agent plugin), loader fail-loud khoá lạ; mục npm/marketplace: draft ở `build/claude/drafts/`, `node cli/build.mjs --include-draft`.
- `README.md` + `README_VI.md`: dòng `--include-draft` ở phần build; ghi chú draft không có trong marketplace.
- Spec §5, ngay dưới bảng Phase 2: `Thực thi 2026-10-08: R1 không tách when_to_use; R2 không đặt disallowed-tools cho skill (đều có chế độ ghi tuỳ chọn); R3 preload chỉ skill chính; R5 không permissionMode/isolation mặc định (xem plan 2026-10-08-standards-phase2).`

- [ ] **Step 4: Kiểm toàn bộ**

```bash
npm test
npm run pack:verify
claude plugin validate --strict build/claude
```

Expected: `npm test` exit 0; pack-guard pass; validate pass (nếu không có CLI `claude` → ghi "not_run" trong report, không coi là pass).

- [ ] **Step 5: Commit** — `chore(platform): bump plugin versions for phase 2 and document changes`
