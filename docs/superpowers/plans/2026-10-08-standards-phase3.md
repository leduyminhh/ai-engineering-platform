# Phase 3 — Hooks, eval, phân phối: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến các ranh giới an toàn đang chỉ nằm trong prose thành cổng cứng (hook PreToolUse trong plugin `core`), có bộ eval đầu tiên đo định tuyến skill, có đường phân phối marketplace qua git, và cài Codex vào đường dẫn skill hiện hành.

**Architecture:** Hook nguồn ở `core/hooks/` (`hooks.json` + `scripts/*.mjs` Node zero-dep), adapter Claude copy sang `build/claude/plugins/core/hooks/` và sinh thêm `scope-lock.json` từ khoá `writeScope` của agent. Script hook là module thuần (`decide(input)`) + CLI đọc stdin — test gọi thẳng hàm và spawn CLI. Eval nằm ở `evals/<plugin>/` cấp repo, chạy tay bằng `claude plugin eval --eval-dir`. Phân phối: script tạo branch `dist` cục bộ chứa `build/claude`; người dùng tự push.

**Tech Stack:** Node.js ≥ 20, ESM, zero runtime dependency; Claude Code hooks (PreToolUse, JSON `hookSpecificOutput`); `claude plugin eval`.

**Spec:** `docs/superpowers/specs/2026-10-07-platform-standards-audit-design.md` (§3.1 E4/E7, §3.3 W1/W3/W8, §3.4 T5, §3.5, §5 Phase 3, §6 D5).

## Bối cảnh đã xác minh (docs re-fetch 2026-10-08; thử nghiệm Codex 0.147.0 trên máy)

- Hook plugin: file mặc định `hooks/hooks.json` trong thư mục plugin, bọc `{"hooks": {<Event>: [{ "matcher", "hooks": [{ "type": "command", "command", "args", "timeout", "if" }] }]}}`. `${CLAUDE_PLUGIN_ROOT}` = thư mục plugin đã cài. Dạng exec (`command: "node"` + `args`) là mẫu đa nền tảng docs khuyên; trên Windows shim `.cmd` không spawn được (`node.exe` thì được).
- PreToolUse stdin: `session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`, `permission_mode`; `agent_id`/`agent_type` chỉ có khi chạy trong subagent.
- Quyết định: exit 0 + stdout JSON `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow|deny|ask","permissionDecisionReason":"…"}}`; `deny` > `ask` > `allow` giữa các hook. Exit khác 0/2 = lỗi không chặn (fail-open).
- `allowManagedHooksOnly` (managed settings) chặn hook của plugin không được force-enable; hook chỉ có nghĩa ở plugin-mode (skills-mode không có `${CLAUDE_PLUGIN_ROOT}`).
- `claude plugin eval`: case = thư mục có `prompt.md` (frontmatter `runs`, `max_turns`, `allowed_tools`…) + `graders/<tên>.md` (frontmatter `type`: `regex`/`tool_used`/`tool_order`/`file_exists`/`llm`/`baseline`). `--eval-dir`, `--threshold`, `--max-cost-usd`, `--no-publish`, `--json`. Mỗi lượt chạy gọi model trên tài khoản người dùng. Windows native từ chối case cấp quyền Bash (cần WSL2).
- Marketplace qua git: `claude plugin marketplace add owner/repo@ref` (hoặc `#ref`); marketplace root = thư mục chứa `.claude-plugin/marketplace.json`.
- Codex: docs hiện hành chỉ ghi `.agents/skills` (repo, quét từ cwd lên root) và `~/.agents/skills` (user). Thử nghiệm `codex debug prompt-input` trên Codex 0.147.0: cả `.agents/skills` lẫn `.codex/skills` (cấp repo) đều được nạp → `.codex/skills` là đường cũ còn chạy nhưng không còn trong docs.

## Quyết định thực thi (cần người dùng duyệt)

| # | Quyết định | Lý do |
|---|---|---|
| Q1 | Hook chỉ có ở plugin-mode; skills-mode không cài hook (ghi rõ trong README) | Theo spec P3.1; skills-mode không có `${CLAUDE_PLUGIN_ROOT}`, phẳng hoá hook vào `settings.json` của người dùng là sửa cấu hình cá nhân. |
| Q2 | H1 push lên `main`/`master`/`dev`/`develop`, push `--force`/`--delete`/`--mirror`/`--all` → **ask** (người dùng xác nhận trong UI); H2 `git commit -m` có ký tự non-ASCII → **deny** kèm hướng dẫn `-F`; H3 file bí mật: tool file (Read/Edit/Write/MultiEdit/NotebookEdit) → **deny**, lệnh Bash nhắc tới file bí mật → **ask** | Quy tắc gốc là "không làm khi chưa được xác nhận" → `ask` đúng nghĩa hơn `deny` cho push; regex trên chuỗi Bash có thể bắt nhầm nên chỉ `ask`; đường dẫn file thì chính xác nên `deny`. `.env.example`/`.env.sample`/`.env.template` luôn được phép. |
| Q3 | Bỏ H4 (chặn Bash của agent ops) | Từ Phase 2 hai agent ops không còn tool Bash. |
| Q4 | H5 khoá phạm vi ghi: khoá agent mới `writeScope` (list glob); adapter sinh `scope-lock.json` vào hook của `core`; một script `guard-files.mjs` lo cả H3 + H5 | Một lần spawn Node mỗi lần gọi tool thay vì một script mỗi plugin; nguồn sự thật nằm ở frontmatter agent. |
| Q5 | Hook fail-open: lỗi nội bộ script → exit 0 không quyết định | Một lỗi parse không được khoá cứng cả phiên làm việc của người dùng. |
| Q6 | Eval ở `evals/<plugin>/` cấp repo (không ship trong plugin), chạy tay: `claude plugin eval build/claude/plugins/<id> --eval-dir evals/<id> …`; KHÔNG vào `npm test`/CI | Ship trong plugin buộc bump version mỗi lần sửa case; chạy eval tốn tiền model; Windows native từ chối case có Bash. |
| Q7 | Phân phối: `node cli/dist.mjs` dựng branch `dist` **cục bộ** chứa `build/claude`; push là việc của người dùng; không có CI tự publish | Push là hành động ra ngoài, cần người dùng quyết. |
| Q8 | Codex cài vào `.agents/skills` (project) / `~/.agents/skills` (global); agent Codex giữ `.codex/agents`. Antigravity skill native **hoãn** | Theo docs hiện hành; Antigravity không nằm trong provider mặc định và cũng dùng `.agents/skills` → sẽ đè skill Codex nếu bật cùng lúc. |
| Q9 | Bump `core` MINOR (1.3.0 → 1.4.0) ở Task 7; plugin khác chỉ bump khi output build đổi | Hook là tính năng mới của core. Lock `core` được phép đỏ từ Task 1 đến Task 6 (như Phase 1–2). |

## Global Constraints

- Node.js ≥ 20; ESM thuần; **zero runtime dependency** (cả script hook).
- File nguồn UTF-8 **không BOM**, LF. Comment tiếng Việt có dấu, 1–2 dòng, chỉ giải thích *vì sao*.
- KHÔNG sửa `package.json`, `pack.config.json`.
- Commit: header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu ("Thay đổi:" / "Lý do:"), `node core/skills/git-workflow/scripts/check-commit-message.mjs <file>` exit 0 rồi `git commit -F <file>`; KHÔNG `Co-Authored-By`.
- Không push, không merge, không tạo/đổi branch remote. Không chạy `claude plugin eval` thật (tốn tiền) — chỉ `claude plugin validate`.
- KHÔNG chạy hai lượt test song song. Windows: dọn thư mục chứa junction bằng Node `fs.rmSync`.
- Script hook không được ghi file, không gọi mạng; chỉ được gọi `git rev-parse` (đọc).
- Làm việc trong worktree `E:\Mine\AI\ai-engineering-platform\.worktrees\standards-phase3`, branch `refactor/standards-phase3`.
- Lệnh kiểm mỗi task: `node test/validate.mjs --build` (FAIL được phép duy nhất: lock của `core` ở `60-versions`, Task 1–6), rồi `node test/install.test.mjs`, `node test/wizard.test.mjs`, `node test/managed-block.test.mjs`, `node test/pack-guard.test.mjs`, `node test/args.test.mjs` — đều 0 fail.

## Review Focus

1. **Lệnh git ghép** (`git add . && git push origin main`, `git -C repo push`, `git push origin HEAD` khi đang ở `main`, `git push origin feature:main`) — phải bắt được push vào nhánh bảo vệ. Test ở Task 2.
2. **Hook gặp input lạ** (stdin rỗng, JSON hỏng, thiếu `tool_input`) — phải exit 0 không quyết định, không làm hỏng phiên. Test ở Task 2 + 3.
3. **File mẫu được phép** (`.env.example`, `config/.env.sample`, `id_rsa.pub`) — không bị chặn; `.env`, `.env.local`, `certs/server.pem` bị chặn. Test ở Task 3.
4. **Agent không có `writeScope`, hoặc phiên chính (không có `agent_type`)** — không bị khoá phạm vi; agent có `writeScope` ghi ra ngoài (kể cả `../x`) bị chặn. Test ở Task 3.
5. **Cài lại sau khi đổi đường Codex** — bản cài cũ ở `.codex/skills` phải được gỡ (theo manifest) khi `aip update`/cài lại, không để lại hai bản. Test ở Task 6.

---

### Task 0: Workspace

- [ ] Tạo worktree: `git worktree add .worktrees/standards-phase3 -b refactor/standards-phase3 master`.
- [ ] Copy plan này vào worktree, commit `docs(plan): add standards phase 3 implementation plan`, xoá bản ở main tree bằng Node `fs.rmSync`.
- [ ] `npm test` trong worktree → exit 0.

---

### Task 1: Engine chiếu hook (plugin-mode)

**Files:**
- Modify: `cli/lib/plugins.mjs` (`loadCore`, `loadPlugins`: thêm `hooksDir`)
- Modify: `adapters/claude/adapter.mjs` (copy `hooks/`)
- Modify: `cli/lib/install.mjs` (`installOne` claude skills-mode bỏ qua `hooks`; xoá nhánh `.mcp.json` chết)
- Create: `core/hooks/hooks.json`, `core/hooks/scripts/guard-bash.mjs`, `core/hooks/scripts/guard-files.mjs` (hai script ở task này chỉ là bản rỗng `process.exit(0)` có comment một dòng; Task 2–3 viết thật)
- Create: `test/contract/90-hooks.contract.mjs`
- Modify: `cli/lib/conventions.mjs` (`checkHooksJson`)

**Interfaces:**
- Produces: `plugin.hooksDir` / `core.hooksDir`: đường dẫn tuyệt đối tới `<dir>/hooks` khi có `hooks/hooks.json`, ngược lại `null`.
- Produces: `export const HOOK_EVENTS = ['PreToolUse', 'PostToolUse']` và `export function checkHooksJson(obj, { scriptsExist }) -> string[]` (conventions.mjs): kiểm bọc `hooks`, event thuộc `HOOK_EVENTS`, mỗi handler `type: "command"`, `command: "node"`, `args[0]` bắt đầu bằng `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/` và `scriptsExist(relPath)` trả true, `timeout` là số ≤ 30.
- Produces: build Claude có `plugins/<id>/hooks/` (copy nguyên thư mục) khi `hooksDir` có.

- [ ] **Step 1: Test đỏ** — `test/contract/90-hooks.contract.mjs`:

```js
// Contract Phase 3: hook plugin (nguồn hợp lệ, ship sang build Claude, không lọt sang provider khác / skills-mode).
export default async function run({ ok, ctx }) {
  const { fs, path, core, plugins, BUILD, claudeDir, checkHooksJson, HOOK_EVENTS } = ctx;
  ok(HOOK_EVENTS.includes('PreToolUse'), 'HOOK_EVENTS có PreToolUse');
  ok(checkHooksJson({ hooks: { Foo: [] } }, { scriptsExist: () => true }).some((e) => e.includes('Foo')), 'checkHooksJson: event lạ → lỗi');
  ok(checkHooksJson({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash', args: ['x'] }] }] } },
    { scriptsExist: () => true }).length >= 1, 'checkHooksJson: command khác node → lỗi');
  ok(checkHooksJson({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node',
    args: ['${CLAUDE_PLUGIN_ROOT}/hooks/scripts/missing.mjs'], timeout: 10 }] }] } }, { scriptsExist: () => false }).length === 1,
    'checkHooksJson: script không tồn tại → lỗi');
  const units = [core, ...plugins].filter((u) => u.hooksDir);
  ok(units.some((u) => u.id === 'core'), 'core có hooks/');
  for (const u of units) {
    const obj = JSON.parse(fs.readFileSync(path.join(u.hooksDir, 'hooks.json'), 'utf8'));
    const errs = checkHooksJson(obj, { scriptsExist: (rel) => fs.existsSync(path.join(u.hooksDir, rel)) });
    ok(errs.length === 0, `${u.id}: hooks.json hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
    if (fs.existsSync(claudeDir)) {
      ok(fs.existsSync(path.join(claudeDir, 'plugins', u.id, 'hooks', 'hooks.json')), `build claude ${u.id}: ship hooks/hooks.json`);
      ok(!fs.existsSync(path.join(BUILD, 'codex', u.id, 'hooks')) && !fs.existsSync(path.join(BUILD, 'cursor', u.id, 'hooks')),
        `${u.id}: hook không lọt sang codex/cursor`);
    }
  }
}
```

Thêm `checkHooksJson`, `HOOK_EVENTS` vào import/return của `test/context.mjs`. Trong `test/install.test.mjs`, thêm assert vào một case cài claude skills-mode có sẵn: thư mục `<root>/.claude/hooks` không tồn tại sau khi cài core.

- [ ] **Step 2: Chạy thấy đỏ.**
- [ ] **Step 3: Cài** — loader: `hooksDir: fs.existsSync(path.join(dir, 'hooks', 'hooks.json')) ? path.join(dir, 'hooks') : null` (cả core lẫn plugin). Adapter Claude: với core và mỗi plugin có `hooksDir`, thêm `{ path: \`plugins/${id}/hooks\`, copyDir: hooksDir }`. `installOne` claude: `if (!comp.isDirectory() || comp.name === '.claude-plugin' || comp.name === 'hooks') continue;` kèm comment "Hook cần `${CLAUDE_PLUGIN_ROOT}` nên chỉ chạy ở plugin-mode". Xoá 3 dòng `.mcp.json` (không plugin nào có file này — E7/P3.4) và biến `pluginActive` nếu không còn dùng. `core/hooks/hooks.json`:

```json
{
  "description": "Cổng an toàn nền của ai-engineering-platform: git, file bí mật, phạm vi ghi của agent.",
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/scripts/guard-bash.mjs"], "timeout": 10 } ] },
      { "matcher": "Read|Edit|Write|MultiEdit|NotebookEdit", "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/scripts/guard-files.mjs"], "timeout": 10 } ] }
    ]
  }
}
```

- [ ] **Step 4: Chạy test** (Global Constraints) + `claude plugin validate --strict build/claude/plugins/core` phải pass (ghi output vào report).
- [ ] **Step 5: Commit** — `feat(claude): project plugin hooks and drop dead mcp branch`

---

### Task 2: `guard-bash.mjs` — H1 push, H2 commit -m non-ASCII, H3 secret trong Bash

**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Produces: `export function decide(input, { currentBranch }) -> null | { decision: 'ask' | 'deny', reason: string }`; `currentBranch(cwd) -> string | null` được inject (mặc định gọi `git -C <cwd> rev-parse --abbrev-ref HEAD`, timeout 3000 ms, lỗi → null).
- Produces: chạy như CLI (`node guard-bash.mjs` đọc stdin) → in JSON `hookSpecificOutput` khi có quyết định, luôn exit 0 (Q5).

- [ ] **Step 1: Test đỏ** — thêm vào `90-hooks.contract.mjs`:

```js
  {
    const { pathToFileURL, execFileSync, CORE_DIR } = ctx;
    const script = path.join(CORE_DIR, 'hooks', 'scripts', 'guard-bash.mjs');
    const { decide } = await import(pathToFileURL(script).href);
    const on = (branch) => ({ currentBranch: () => branch });
    const bash = (command) => ({ tool_name: 'Bash', cwd: '.', tool_input: { command } });
    const d = (cmd, br = 'feature/x') => decide(bash(cmd), on(br));
    ok(d('git push origin main')?.decision === 'ask', 'H1: push main → ask');
    ok(d('git add . && git push origin develop')?.decision === 'ask', 'H1: lệnh ghép push develop → ask');
    ok(d('git -C repo push origin master')?.decision === 'ask', 'H1: git -C … push master → ask');
    ok(d('git push origin HEAD', 'main')?.decision === 'ask' && d('git push', 'dev')?.decision === 'ask', 'H1: HEAD/không refspec khi đang ở nhánh bảo vệ → ask');
    ok(d('git push origin feature:main')?.decision === 'ask', 'H1: src:dst vào main → ask');
    ok(d('git push --force origin feature/x')?.decision === 'ask' && d('git push origin +feature/x')?.decision === 'ask'
      && d('git push origin --delete feature/x')?.decision === 'ask', 'H1: force/+ref/delete → ask');
    ok(d('git push -u origin feature/x') === null && d('git push') === null, 'H1: push nhánh feature → không quyết định');
    ok(d('git commit -m "sửa lỗi"')?.decision === 'deny' && d('git commit -m "fix bug"') === null && d('git commit -F msg.txt') === null,
      'H2: -m có dấu → deny; -m ASCII và -F → cho qua');
    ok(d('cat .env')?.decision === 'ask' && d('source ./.env.local')?.decision === 'ask' && d('cat certs/server.pem')?.decision === 'ask',
      'H3: Bash đụng file bí mật → ask');
    ok(d('cp .env.example .env.example.bak') === null && d('ls -la') === null, 'H3: .env.example và lệnh thường → cho qua');
    const run = (stdin) => execFileSync('node', [script], { input: stdin, encoding: 'utf8' });
    ok(run('') === '' && run('{bad json') === '' && run('{}') === '', 'guard-bash CLI: input rỗng/hỏng → exit 0, không in gì (fail-open)');
    const out = JSON.parse(run(JSON.stringify(bash('git commit -m "thêm"'))) || '{}');
    ok(out.hookSpecificOutput?.hookEventName === 'PreToolUse' && out.hookSpecificOutput?.permissionDecision === 'deny'
      && /-F/.test(out.hookSpecificOutput?.permissionDecisionReason || ''), 'guard-bash CLI: in JSON hookSpecificOutput deny + hướng dẫn -F');
  }
```

Đảm bảo `pathToFileURL`, `execFileSync`, `CORE_DIR` có trong destructure.

- [ ] **Step 2: Chạy thấy đỏ.**
- [ ] **Step 3: Cài** `core/hooks/scripts/guard-bash.mjs`:

```js
#!/usr/bin/env node
// PreToolUse(Bash): biến các ranh giới "không push nhánh bảo vệ / commit -F / không đụng file bí mật" thành cổng cứng.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const PROTECTED = new Set(['main', 'master', 'dev', 'develop']);
const SECRET = /(^|[\s'"=/])(\.env(\.(?!example\b|sample\b|template\b)[\w.-]+)?|[\w.-]+\.(pem|jks|keystore|p12|pfx)|id_(rsa|ed25519|ecdsa)|credentials(\.json)?)(?=$|[\s'"])/;

const tokens = (s) => s.match(/"[^"]*"|'[^']*'|\S+/g) || [];
const segments = (cmd) => cmd.split(/&&|\|\||;|\n|\|/).map((s) => s.trim()).filter(Boolean);

function gitSub(t, sub) {
  const g = t.indexOf('git');
  if (g === -1) return -1;
  for (let i = g + 1; i < t.length; i++) {
    if (t[i] === sub) return i;
    if (t[i] === '-C' || t[i] === '-c') { i++; continue; }
    if (!t[i].startsWith('-')) return -1;
  }
  return -1;
}

function pushReason(seg, cwd, currentBranch) {
  const t = tokens(seg);
  const i = gitSub(t, 'push');
  if (i === -1) return null;
  const args = t.slice(i + 1);
  const flags = args.filter((a) => a.startsWith('-'));
  const pos = args.filter((a) => !a.startsWith('-'));
  if (flags.some((f) => /^(--force(-with-lease)?(=.*)?|-f|--delete|-d|--mirror|--all)$/.test(f)) || pos.slice(1).some((r) => r.startsWith('+'))) {
    return 'push dạng force/xoá/mirror/all';
  }
  const here = () => currentBranch(cwd);
  const refs = pos.slice(1).map((r) => r.split(':').pop().replace(/^refs\/heads\//, ''));
  const targets = (refs.length ? refs : ['HEAD']).map((r) => (r === 'HEAD' ? here() : r));
  const hit = targets.find((r) => r && PROTECTED.has(r));
  return hit ? `push vào nhánh bảo vệ "${hit}"` : null;
}

function defaultBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd || '.', 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

export function decide(input, { currentBranch = defaultBranch } = {}) {
  const cmd = String(input?.tool_input?.command ?? '');
  if (!cmd) return null;
  const cwd = input?.cwd || '.';
  for (const seg of segments(cmd)) {
    const t = tokens(seg);
    if (gitSub(t, 'commit') !== -1 && /(^|\s)(-m|--message)(\s|=)/.test(seg) && /[^\x00-\x7F]/.test(seg)) {
      return { decision: 'deny', reason: 'Commit message có ký tự non-ASCII qua -m dễ hỏng encoding. Ghi message ra file UTF-8, kiểm bằng check-commit-message.mjs rồi chạy `git commit -F <file>` (skill git-workflow).' };
    }
    const why = pushReason(seg, cwd, currentBranch);
    if (why) return { decision: 'ask', reason: `Nguyên tắc nền: ${why} cần người dùng xác nhận trước.` };
  }
  if (SECRET.test(cmd)) return { decision: 'ask', reason: 'Lệnh nhắc tới file bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa file bí mật khi chưa được duyệt.' };
  return null;
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { return; }
  const d = decide(input);
  if (!d) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.decision, permissionDecisionReason: d.reason } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open: lỗi nội bộ không được chặn phiên làm việc */ }
  process.exit(0);
}
```

Nếu test nào trong Step 1 đỏ vì chi tiết regex/token, sửa **script** cho đúng hành vi mà test mô tả — không nới test.

- [ ] **Step 4: Chạy test** (Global Constraints).
- [ ] **Step 5: Commit** — `feat(core): guard git push, non-ASCII commit -m and secret access in Bash`

---

### Task 3: `guard-files.mjs` — H3 file bí mật + H5 khoá phạm vi ghi theo `writeScope`

**Files:**
- Modify: `core/hooks/scripts/guard-files.mjs`
- Modify: `cli/lib/conventions.mjs` (`SOURCE_KEYS.agent` + `writeScope`; `checkAgentTools` thêm: `writeScope` chỉ cho agent `mode: write`)
- Modify: `cli/lib/plugins.mjs` (`loadAgents`: `writeScope: splitList(meta.writeScope)`)
- Modify: `adapters/claude/adapter.mjs` (sinh `plugins/core/hooks/scope-lock.json`; KHÔNG ghi `writeScope` vào agent `.md`)
- Modify (nội dung): 5 agent (Step 5)
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Produces: `export function decide(input, { scopes }) -> null | { decision: 'deny', reason }` trong `guard-files.mjs`; `scopes` = object `{ agentId: string[] }` (mặc định đọc `scope-lock.json` cạnh thư mục `scripts/`, thiếu file → `{}`).
- Produces: `export function globToRegExp(glob) -> RegExp` (cùng file; `**/` = 0+ thư mục, `**` = mọi ký tự, `*` = không qua `/`).
- Produces: `build/claude/plugins/core/hooks/scope-lock.json` = `{ "<agent-id>": ["glob", …] }` cho mọi agent có `writeScope`, khoá sắp xếp theo id.

- [ ] **Step 1: Test đỏ**

```js
  {
    const { pathToFileURL, execFileSync, CORE_DIR, claudeAdapter, fxPlugin, fxAgent, fxCore, fxMk, byPath, allAgents } = ctx;
    const script = path.join(CORE_DIR, 'hooks', 'scripts', 'guard-files.mjs');
    const { decide, globToRegExp } = await import(pathToFileURL(script).href);
    const scopes = { 'fx-writer': ['docs/**', 'CHANGELOG.md'], 'fx-tests': ['**/test/**', '**/*.test.*'] };
    const call = (tool, file, agent) => decide({ tool_name: tool, cwd: '/repo', agent_type: agent, tool_input: { file_path: file } }, { scopes });
    ok(call('Read', '/repo/.env')?.decision === 'deny' && call('Edit', '/repo/app/.env.local')?.decision === 'deny'
      && call('Read', '/repo/certs/server.pem')?.decision === 'deny', 'H3: tool file đụng .env/.env.local/.pem → deny');
    ok(call('Read', '/repo/.env.example') === null && call('Read', '/repo/config/.env.sample') === null
      && call('Read', '/repo/keys/id_rsa.pub') === null, 'H3: .env.example/.sample và khoá public → cho qua');
    ok(call('Write', '/repo/docs/a.md', 'fx-writer') === null && call('Write', '/repo/CHANGELOG.md', 'plugin:fx-writer') === null,
      'H5: ghi trong writeScope (kể cả agent_type có tiền tố plugin:) → cho qua');
    ok(call('Write', '/repo/src/a.js', 'fx-writer')?.decision === 'deny' && call('Write', '/other/x.md', 'fx-writer')?.decision === 'deny',
      'H5: ghi ngoài writeScope (kể cả ngoài repo) → deny');
    ok(call('Write', '/repo/src/test/A.java', 'fx-tests') === null && call('Write', '/repo/web/a.test.ts', 'fx-tests') === null
      && call('Edit', '/repo/src/a.ts', 'fx-tests')?.decision === 'deny', 'H5: glob test cho test-writer');
    ok(call('Read', '/repo/src/a.js', 'fx-writer') === null, 'H5: chỉ khoá ghi, không khoá đọc');
    ok(call('Write', '/repo/src/a.js') === null && call('Write', '/repo/src/a.js', 'khac') === null,
      'H5: phiên chính hoặc agent không có writeScope → không khoá');
    ok(globToRegExp('**/test/**').test('test/a.java') && !globToRegExp('docs/*').test('docs/a/b.md'), 'globToRegExp: **/ và *');
    const run = (stdin) => execFileSync('node', [script], { input: stdin, encoding: 'utf8' });
    ok(run('') === '' && run('nope') === '', 'guard-files CLI: input hỏng → exit 0, không in gì');
    const ag = { ...fxAgent, id: 'fx-writer', mode: 'write', writeScope: ['docs/**'] };
    const out = byPath(claudeAdapter.build([{ ...fxPlugin, agents: [ag] }], { marketplace: fxMk, core: { ...fxCore, hooksDir: path.join(CORE_DIR, 'hooks') } }));
    const lock = JSON.parse((out.get('plugins/core/hooks/scope-lock.json') || { content: '{}' }).content);
    ok(JSON.stringify(lock['fx-writer']) === '["docs/**"]', 'adapter: sinh scope-lock.json từ writeScope');
    ok(!(out.get('plugins/fx/agents/fx-writer.md') || { content: '' }).content.includes('writeScope'), 'adapter: không ghi writeScope vào agent .md');
    const scoped = allAgents.filter((a) => a.writeScope.length);
    ok(scoped.length === 5 && scoped.every((a) => a.mode === 'write'), '5 agent ghi có writeScope (H5)');
  }
```

- [ ] **Step 2: Chạy thấy đỏ.**
- [ ] **Step 3: Cài `guard-files.mjs`**

```js
#!/usr/bin/env node
// PreToolUse(Read|Edit|Write|MultiEdit|NotebookEdit): chặn file bí mật; agent có writeScope chỉ ghi trong phạm vi khai báo.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const SECRET = /(^|\/)(\.env(\.(?!(example|sample|template)$)[\w.-]+)?|[^/]+\.(pem|jks|keystore|p12|pfx)|id_(rsa|ed25519|ecdsa)|credentials(\.json)?)$/i;

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
    else if (glob.startsWith('**', i)) { re += '.*'; i += 1; }
    else if (glob[i] === '*') re += '[^/]*';
    else re += glob[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

function loadScopes() {
  const f = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scope-lock.json');
  try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; } catch { return {}; }
}

export function decide(input, { scopes = loadScopes() } = {}) {
  const file = input?.tool_input?.file_path || input?.tool_input?.notebook_path;
  if (!file) return null;
  const abs = path.resolve(input.cwd || '.', String(file)).replace(/\\/g, '/');
  if (SECRET.test(abs)) {
    return { decision: 'deny', reason: 'File bí mật (.env/khoá/credentials) — nguyên tắc nền không đọc/sửa; nhờ người dùng thao tác trực tiếp nếu thật sự cần.' };
  }
  if (!WRITE_TOOLS.has(input.tool_name)) return null;
  const agent = String(input.agent_type || '').split(':').pop();
  const scope = agent && scopes[agent];
  if (!scope || !scope.length) return null;
  const rel = path.relative(path.resolve(input.cwd || '.'), path.resolve(input.cwd || '.', String(file))).replace(/\\/g, '/');
  if (!rel.startsWith('..') && !path.isAbsolute(rel) && scope.some((g) => globToRegExp(g).test(rel))) return null;
  return { decision: 'deny', reason: `Agent ${agent} chỉ được ghi trong: ${scope.join(', ')}. Cần sửa ngoài phạm vi → trả blocked cho session chính.` };
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { return; }
  const d = decide(input);
  if (!d) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: d.decision, permissionDecisionReason: d.reason } }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { /* fail-open */ }
  process.exit(0);
}
```

Lưu ý test dùng đường dẫn POSIX `/repo/...`; trên Windows `path.resolve('/repo', …)` cho `E:/repo/...` — giữ hành vi nhất quán vì cả `abs` lẫn `rel` đều tính từ cùng `cwd`. Nếu test đỏ vì khác nền tảng, sửa script để chuẩn hoá (không nới test).

- [ ] **Step 4: Adapter + loader** — `loadAgents`: `writeScope: splitList(meta.writeScope)`. Adapter Claude: sau khi xử lý plugins, nếu core có `hooksDir` thì thêm `{ path: 'plugins/core/hooks/scope-lock.json', content: JSON.stringify(map, null, 2) + '\n' }` với map từ mọi agent có `writeScope` (khoá sắp xếp). `claudeAgentMd` không đổi (không có `writeScope`). `checkAgentTools`: `writeScope.length && mode !== 'write'` → lỗi `writeScope chỉ dành cho agent ghi`.

- [ ] **Step 5: Nội dung — thêm `writeScope` (YAML block list) ngay sau `skills:`**

| Agent | writeScope |
|---|---|
| `plugins/engineering/agents/engineering-release-scribe.md` | `docs/**`, `CHANGELOG.md` |
| `plugins/engineering/agents/engineering-spec-analyst.md` | `docs/**` |
| `plugins/backend/agents/backend-test-writer.md` | `**/test/**`, `**/tests/**`, `**/*Test.java`, `**/*Tests.java`, `**/*IT.java`, `**/test_*.py`, `**/*_test.py`, `**/conftest.py` |
| `plugins/frontend/agents/frontend-test-writer.md` | `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*`, `**/test/**`, `**/tests/**`, `**/mocks/**` |
| `plugins/frontend/agents/frontend-e2e-test-writer.md` | `e2e/**`, `playwright.config.*` |

Ví dụ:

```yaml
writeScope:
  - docs/**
  - CHANGELOG.md
```

(`docs/**` bắt đầu bằng chữ nên plain an toàn; glob bắt đầu bằng `*` phải quote: `- "**/test/**"`.)

Đối chiếu body từng agent: nếu body cho phép ghi thư mục nằm ngoài danh sách trên (vd test-writer ghi fixture ở `src/test/resources`, `testdata/`), bổ sung glob tương ứng và ghi lý do vào report — không bỏ quyền ghi mà body đang hứa.

- [ ] **Step 6: Chạy test** (Global Constraints) + `claude plugin validate --strict build/claude/plugins/core`.
- [ ] **Step 7: Commit** — `feat(core): guard secret files and lock agent write scope`

---

### Task 4: Eval đầu tiên (3 case) + contract cấu trúc

**Files:**
- Create: `evals/engineering/spec-writing-routes/prompt.md`, `evals/engineering/spec-writing-routes/graders/{skill-used,file-written,acceptance}.md`
- Create: `evals/backend/code-review-readonly/prompt.md`, `evals/backend/code-review-readonly/case.yaml`, `evals/backend/code-review-readonly/fixtures/…`, `graders/{skill-used,no-edit,severity}.md`
- Create: `evals/workflows/bugfix-routes/prompt.md`, `graders/{skill-used,asks-repro}.md`
- Create: `evals/README.md` (cách chạy, chi phí, giới hạn Windows)
- Modify: `.gitignore` (`evals/**/results/`)
- Create: `test/contract/95-evals.contract.mjs`
- Modify: `cli/lib/conventions.mjs` (`checkEvalCase`)

**Interfaces:**
- Produces: `export const EVAL_GRADER_TYPES = ['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']`, `export function checkEvalCase({ promptMeta, graders }) -> string[]` — `promptMeta.runs` 1–50 nếu có, `max_turns` ≤ 200 nếu có; ≥ 1 grader; mỗi grader có `type` ∈ danh sách; `tool_used` có `tool`; `regex` có `pattern`; `file_exists` có `path`; `allowed_tools` (nếu có) không chứa `Bash` (Q6: Windows native từ chối).

- [ ] **Step 1: Test đỏ** — `95-evals.contract.mjs`: duyệt `evals/<plugin>/<case>/`, parse frontmatter `prompt.md` và từng `graders/*.md` bằng `parseFrontmatter`, gọi `checkEvalCase`; assert ≥ 3 case, mỗi case 0 lỗi; mỗi `<plugin>` khớp một plugin có thật (`core`, plugin trong `plugins/`, hoặc `workflows`); unit `checkEvalCase` với case thiếu grader / grader type lạ / `allowed_tools: [Bash]` → lỗi.
- [ ] **Step 2: Chạy thấy đỏ.**
- [ ] **Step 3a: Lấy schema thật** — trong thư mục tạm, chạy `claude plugin eval init --bare demo` (không gọi model) và đọc file sinh ra để chép đúng tên field (`prompt.md`, `case.yaml`, grader). Nếu lệnh không có trên máy, ghi "not_run" vào report và theo bảng field trong mục Bối cảnh của plan. `tool_used` muốn "không được gọi" thì đặt `min: 0` và `max: 0`.
- [ ] **Step 3: Viết 3 case** (tiếng Việt cho prompt, giống người dùng thật):
  - `engineering/spec-writing-routes`: prompt "Viết spec cho tính năng đặt lại mật khẩu qua email …"; grader `tool_used` `tool: Skill`, `input_match: '"skill"\s*:\s*"(?:[\w-]+:)?engineering-spec-writing"'`; `file_exists` `path: docs/requests/**/requirement.md`; `llm` criteria: có acceptance criteria đo được, có phần giả định/câu hỏi mở. `allowed_tools: [Read, Write, Edit, Glob, Grep, Skill]`.
  - `backend/code-review-readonly`: `case.yaml` (`schema_version: "1.1"`, `context.scaffold_script` tạo vài file Java có lỗi N+1 rõ ràng); prompt "Review giúp tôi module order trong src/ …"; graders `tool_used` Skill `backend-code-review`; `tool_used` `tool: Edit` với `min: 0`, `max: 0` và `tool: Write` `min: 0`, `max: 0` (read-only mặc định); `llm` criteria: có finding severity + `file:line`, nêu N+1. `allowed_tools: [Read, Glob, Grep, Skill]`. `scaffold_script` viết bằng Node (`node -e …`) hoặc shell tối giản, không cần mạng.
  - `workflows/bugfix-routes`: prompt "Trang thanh toán báo lỗi 500 khi áp mã giảm giá, sửa giúp tôi"; grader `tool_used` Skill `workflow-bugfix`; `llm` criteria: hỏi/thu bước tái hiện hoặc failing test trước khi sửa, không sửa code khi chưa có oracle. `allowed_tools: [Read, Glob, Grep, Skill]`, `max_turns: 8`.
  - Mọi `prompt.md` đặt `runs: 3`.
- [ ] **Step 4: `evals/README.md`** — lệnh chạy (một plugin):

```bash
claude plugin eval build/claude/plugins/engineering --eval-dir evals/engineering --threshold 0.8 --max-cost-usd 5 --no-publish --json evals/engineering/results/latest.json
```

Ghi: mỗi lượt gọi model trên tài khoản người dùng; chạy tay hoặc nightly, không trong `npm test`; case không cấp `Bash` để chạy được trên Windows native; build trước bằng `npm run build`.
- [ ] **Step 5: Chạy test** (Global Constraints). KHÔNG chạy `claude plugin eval` thật.
- [ ] **Step 6: Commit** — `test(evals): add first plugin eval cases and structure contract`

---

### Task 5: Phân phối — branch `dist` cục bộ, cảnh báo cài trùng

**Files:**
- Create: `cli/dist.mjs`
- Modify: `cli/lib/install.mjs` (skills-mode claude cảnh báo khi plugin-mode đã cài cùng marketplace)
- Modify: `README.md`, `README_VI.md` (mục phân phối: plugin-mode là đường chuẩn — D5; skills-mode cho chọn lẻ/Cowork; hook chỉ ở plugin-mode)
- Test: `test/contract/90-hooks.contract.mjs` hoặc module mới `test/contract/96-dist.contract.mjs`

**Interfaces:**
- Produces: `export function distPlan({ buildDir, sourceSha }) -> { files: string[], message: string }` (thuần, test được): liệt kê file tương đối trong `build/claude` (bỏ `drafts/`), message commit `chore(dist): publish claude marketplace from <sha7>` + body tiếng Việt.
- Produces: CLI `node cli/dist.mjs [--dry-run]`: chạy `node cli/build.mjs --target claude`; tạo worktree tạm của branch `dist` (orphan nếu chưa có) trong `os.tmpdir()`; xoá nội dung cũ (trừ `.git`) bằng `fs.rmSync`; copy `build/claude` (trừ `drafts/`) vào; ghi message ra file, chạy `check-commit-message.mjs`, `git commit -F`; `git worktree remove`; in lệnh push gợi ý `git push origin dist` và lệnh cài `claude plugin marketplace add <owner>/<repo>@dist`. KHÔNG push. `--dry-run` chỉ in `distPlan`.
- Produces: `export function claudePluginOverlap(installedIds, selectedPluginIds) -> string[]` (thuần) dùng để cảnh báo.

- [ ] **Step 1: Test đỏ** — unit `distPlan` trên một thư mục fixture tạm (`plugins/a/x.md`, `drafts/b/y.md`, `.claude-plugin/marketplace.json`) → `files` không có `drafts/…`, có `.claude-plugin/marketplace.json`; `message` qua `check-commit-message.mjs` exit 0 (ghi ra file tạm rồi chạy). Unit `claudePluginOverlap(['backend','core'], ['backend','frontend'])` → `['backend']`.
- [ ] **Step 2: Chạy thấy đỏ.**
- [ ] **Step 3: Cài** `cli/dist.mjs` theo Interfaces; dùng `execFileSync('git', [...], { stdio: 'inherit' })`; mọi lỗi → thông báo rõ + exit 1, luôn gỡ worktree tạm trong `finally` (Node `fs.rmSync` nếu `git worktree remove` thất bại). Skills-mode claude trong `install()`: trước khi cài, gọi `claude plugin list --json` (qua `runClaudeCli`, `tolerate: true`, timeout 15000; dùng `parseClaudePluginJson`) — nếu trùng plugin thì `console.warn` "đã cài dạng plugin: <ids> — skill sẽ xuất hiện hai lần; gỡ một trong hai (`claude plugin uninstall …` hoặc `aip uninstall`)". Không có CLI → bỏ qua im lặng. Không gọi CLI khi `AIE_INSTALL_ROOT` được đặt (test).
- [ ] **Step 4: Kiểm tay** `node cli/dist.mjs --dry-run` (in danh sách + message). Chạy thật `node cli/dist.mjs` một lần trong worktree để chứng minh tạo được commit trên branch `dist` cục bộ, rồi **xoá branch `dist` vừa tạo** (`git branch -D dist`) — branch dist thật do người dùng tạo khi muốn phát hành. Ghi output vào report.
- [ ] **Step 5: Chạy test** (Global Constraints).
- [ ] **Step 6: Commit** — `feat(cli): add local dist branch publisher and duplicate-install warning`

---

### Task 6: Codex cài vào `.agents/skills`

**Files:**
- Modify: `cli/lib/install.mjs` (layout codex: skills → `<root>/.agents/skills/<id>`; agents giữ `<root>/.codex/agents`)
- Modify: `adapters/codex/adapter.mjs` (comment đầu file nêu đường mới)
- Modify: `README.md`, `README_VI.md`, `CLAUDE.md` (đường cài Codex)
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: manifest cài đặt hiện có (`links[]`/`files[]`) — gỡ theo đường đã ghi nên bản cũ ở `.codex/skills` vẫn gỡ đúng.

- [ ] **Step 1: Test đỏ** — trong `install.test.mjs`: cài codex (qua `parse()`) → skill nằm ở `<root>/.agents/skills/<id>/SKILL.md`, không có `<root>/.codex/skills`; agent TOML vẫn ở `<root>/.codex/agents/`. Case nâng cấp: tạo manifest giả lập bản cài cũ (link/file ở `.codex/skills/x`) rồi chạy cài lại codex → `.codex/skills/x` bị gỡ, `.agents/skills/x` có (Review Focus 5). Dùng `mkTmp` như các case khác.
- [ ] **Step 2: Chạy thấy đỏ.**
- [ ] **Step 3: Cài** — đổi `skillsRoot` của nhánh codex thành `path.join(root, '.agents', 'skills')`, comment: "Docs Codex hiện hành chỉ còn `.agents/skills` (repo) và `~/.agents/skills` (user); `.codex/skills` vẫn được nạp ở Codex 0.147 nhưng không còn trong docs." Cảnh báo scope project ở `install()` (dòng ~682) đổi nội dung cho đúng: Codex quét `.agents/skills` từ cwd lên root repo nên cài project dùng được — bỏ cảnh báo nếu không còn đúng.
- [ ] **Step 4: Chạy test** (Global Constraints).
- [ ] **Step 5: Commit** — `fix(codex): install skills into .agents/skills`

---

### Task 7: Bump, lock, tài liệu, kiểm toàn bộ

- [ ] **Bump** `core` 1.3.0 → **1.4.0**. `npm run build` → `node cli/lib/versions.mjs --check`: plugin nào khác báo lệch thì bump PATCH plugin đó (ghi lý do). `node cli/lib/versions.mjs --lock` → `--check` khớp.
- [ ] **Tài liệu**:
  - `CHANGELOG.md` [Unreleased]: hook core (H1 ask, H2 deny, H3 deny/ask, H5 scope-lock qua `writeScope`, fail-open, chỉ plugin-mode, tôn trọng `allowManagedHooksOnly`), eval (`evals/`, cách chạy, chi phí), `cli/dist.mjs`, cảnh báo cài trùng, Codex `.agents/skills` (+ ghi chú nâng cấp: chạy `aip update -g --provider codex` để chuyển), bỏ nhánh `.mcp.json`, version.
  - `CLAUDE.md`: thư mục `core/hooks/`, khoá agent `writeScope`, `evals/`, `cli/dist.mjs`, đường cài Codex.
  - `README.md` / `README_VI.md`: mục Hooks (gì bị chặn/hỏi, cách tắt tạm: `/hooks` hoặc gỡ plugin core — nêu đúng cơ chế docs), mục Eval, mục Phân phối.
  - Spec §5 dưới bảng Phase 3: một dòng `Thực thi 2026-10-08:` liệt kê Q1–Q9.
- [ ] **Kiểm**: `npm test` exit 0; `npm run pack:verify`; `claude plugin validate --strict build/claude` và từng `build/claude/plugins/*/`.
- [ ] **Commit** — `chore(platform): bump core for phase 3 and document hooks, evals, dist`
