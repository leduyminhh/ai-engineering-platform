# Gate kiểm chứng (project 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chặn agent dừng khi đã sửa code mà chưa chạy kiểm chứng (hook Stop/SubagentStop), cảnh báo AC chưa có test (W7–W9 + `--strict`), và chạy thật 3 case eval lần đầu.
**Architecture:** Hook mới `core/hooks/scripts/gate-stop.mjs` export `decide()` thuần, đọc transcript JSONL qua dependency inject để unit test bằng fixture. `check-request.mjs` nhận thêm `readTest` inject: phạm vi test lấy từ dòng `**Files:**` của `plan.md` hoặc cờ `--tests`. Eval chạy tay bằng `claude plugin eval`, kết quả ghi vào `evals/README.md`.
**Tech Stack:** Node 20+ ESM, chỉ built-in; harness test `test/validate.mjs` (`ok(cond, msg)`); `claude plugin eval`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep, chỉ built-in Node 20+; ESM; UTF-8 không BOM, LF.
- Hook không ghi file, không gọi lệnh ngoài `git rev-parse`; bỏ BOM ở stdin như `guard-files.mjs`; mọi lỗi nội bộ → cho dừng, exit 0.
- Hook chỉ có ở plugin mode; không lọt sang codex/cursor/skills-mode.
- Comment trong code: tiếng Việt, chỉ giải thích *vì sao* (baseline mục Comments).
- Tên test (chuỗi thứ hai của `ok(…)`) bắt đầu bằng ID AC nó phủ, vd `'AC1.1: …'` — chính W7 sẽ kiểm điều này.
- Cấu hình gate: `<git-root>/.claude/aip-gate.json`, khoá `stopGate` (bool), `testCommands` (string[] regex), `exemptAgents` (string[], ghi đè mặc định `["data-migration-writer"]`). Biến môi trường tắt: `AIP_STOP_GATE=off`.
- File tài liệu (không tính là sửa code): phần mở rộng `.md .mdx .txt .rst .adoc`, không phân biệt hoa thường.
- Regex ID AC trong file test: `/(?<!\d)AC(\d+)[._](\d+)(?!\d)/gi`, chuẩn hóa về `AC<n>.<m>`.
- Thư mục bỏ qua khi quét test: `node_modules`, `.git`, `build`, `dist`, `target`, `.venv`.
- Eval: tổng ≤ 0,5 USD/case cho mọi lượt chạy của case, chỉ `--runs 1`, không `--runs 3`.
- Giữa các task chỉ chạy test có mục tiêu (`node test/validate.mjs --build --only <nhóm>`); `npm test` toàn bộ chỉ xanh sau Task 5 (bump version + lock).
- Commit mỗi task qua `core:git-workflow` (message ra file UTF-8, `git commit -F`), không thêm dòng `Co-Authored-By`.

## Review Focus

- Dòng `type:"user"` có `isMeta: true` (nội dung skill được nạp, caveat lệnh local) nằm giữa lượt không được coi là prompt mới; nếu coi, sửa trước đó bị bỏ qua và gate cho qua sai → test ở Task 1.
- Lệnh test viết ghép/pipe/có biến môi trường (`cd x && npm test 2>&1 | tail -5`, `FOO=1 npx vitest run`, `npm test; if ($?) { … }`) phải được tính; `echo npm test`, `npm install`, `cat test/a.js` thì không → test ở Task 1.
- Đường dẫn Windows và phần mở rộng hoa (`E:\repo\README.MD`) vẫn là tài liệu; `package.json`, `.yml` vẫn là code → test ở Task 1.
- `AC1.10` trong file test không được tính là đã phủ `AC1.1`; `test_ac1_2_rejects` và `testAc1_2Rejects` phải tính là phủ `AC1.2` → test ở Task 3.
- Đường dẫn trong `**Files:**` có hậu tố dòng (`` `a/b.mjs:123-145` ``) hoặc chỉ là thư mục test → resolve đúng file/thư mục, không báo W9 nhầm → test ở Task 3.

---

### Task 1: Hook `gate-stop.mjs` — luồng quyết định

**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.10
**Files:**
- Create: `core/hooks/scripts/gate-stop.mjs`
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Produces:
  - `export function decide(input: object, deps?: { readFile?: (p: string) => string, loadConfig?: (cwd: string) => object|null, env?: Record<string,string> }): null | { decision: 'block', reason: string }`
  - `export function isTestCommand(command: string, extra?: RegExp[]): boolean`
  - `export const DEFAULT_EXEMPT_AGENTS = ['data-migration-writer']`
  - Chạy như script: đọc stdin JSON, `decide()` khác null thì in `JSON.stringify({ decision: 'block', reason })`, luôn exit 0.

- [ ] **Step 1: Viết test đỏ** — thêm khối mới cuối `90-hooks.contract.mjs`, import `gate-stop.mjs` như khối `guard-bash`. Helper dựng JSONL trong test (không đọc transcript thật):

```js
const line = (o) => JSON.stringify(o);
const human = (text) => line({ type: 'user', message: { role: 'user', content: text } });
const meta = (text) => line({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text }] } });
const use = (name, input) => line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't' + Math.random(), name, input }] } });
const result = () => line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } });
const run = (lines, { input = {}, cfg = null, env = {} } = {}) => gate.decide(
  { hook_event_name: 'Stop', stop_hook_active: false, transcript_path: 'T', cwd: '.', ...input },
  { readFile: () => lines.join('\n'), loadConfig: () => cfg, env });
const edit = (p) => use('Edit', { file_path: p, old_string: 'a', new_string: 'b' });
const bash = (command) => use('Bash', { command });
```

Các assertion (mỗi dòng một `ok`, tên bắt đầu bằng ID AC):
- AC1.1: `run([human('sửa'), edit('src/a.js'), edit('src/b.ts'), edit('src/c.py'), edit('src/d.go'), result()])` → `decision === 'block'`, `reason` chứa `'4'`, chứa `src/a.js`, `src/b.ts`, `src/c.py`, không chứa `src/d.go`. Cùng kết quả khi tool là `Write`, `MultiEdit` (`file_path`) và `NotebookEdit` (`notebook_path: 'n.ipynb'`).
- AC1.1: test chạy **trước** lần sửa cuối → block: `[human('x'), edit('a.js'), bash('npm test'), edit('b.js')]`.
- AC1.2: `[human('x'), edit('a.js'), bash('npm test')]` → `null`; `PowerShell` với `command: 'npm test; if ($?) { "ok" }'` → `null`.
- AC1.2 (Review Focus): parameterized trên `gate.isTestCommand` — đúng: `npm test`, `pnpm run test`, `yarn test`, `bun test`, `npm run test:unit`, `npx vitest run`, `npx jest`, `npx playwright test`, `node --test`, `node test/validate.mjs --build`, `mvn -q test`, `./mvnw verify`, `mvn compile`, `./gradlew check`, `gradle build`, `pytest -q`, `python -m pytest`, `python3 -m unittest`, `uv run pytest`, `go test ./...`, `cargo test`, `dotnet test`, `tsc --noEmit`, `npx tsc`, `eslint .`, `npm run lint`, `pnpm run typecheck`, `npm run build`, `ruff check .`, `mypy src`, `cd app && npm test 2>&1 | tail -5`, `FOO=1 npx vitest run`; sai: `echo npm test`, `npm install`, `cat test/a.js`, `git status`, `ls tests/`, `node scripts/build.mjs`.
- AC1.3: không sửa gì → `null`; chỉ sửa `docs/a.md`, `E:\\repo\\README.MD`, `notes.txt`, `x.rst`, `y.adoc`, `z.mdx` → `null`; sửa `package.json` hoặc `ci.yml` không test → block.
- AC1.4: `input.stop_hook_active = true` → `null`; `env: { AIP_STOP_GATE: 'off' }` → `null`; `cfg: { stopGate: false }` → `null`; `cfg: { stopGate: true }` vẫn block.
- AC1.5: `readFile` ném lỗi → `null`; nội dung `'not json\n{"type":1}\n[]'` → `null`; dòng assistant có `message.content` là chuỗi hoặc `tool_use` thiếu `input` → không ném, kết quả `null` khi không còn sửa hợp lệ. Chạy script thật bằng `execFileSync(process.execPath, [script], { input: 'không phải json' })` → stdout rỗng, exit 0.
- AC1.6: `hook_event_name: 'SubagentStop'`, `transcript_path: 'MAIN'`, `agent_transcript_path: 'SUB'`, `readFile: (p) => p === 'SUB' ? subLines : mainLines` (sub có sửa không test, main sạch) → block; đảo nội dung → `null`. Transcript subagent không có `human()` nào vẫn xét toàn bộ.
- AC1.7: `cfg: { testCommands: ['^make test\\b', '('] }` + `bash('make test')` sau sửa → `null` (regex sai `'('` bị bỏ qua, không ném); không có cfg → block.
- AC1.8: `[human('a'), edit('a.js'), human('b'), bash('git status')]` → `null`.
- AC1.8 (Review Focus): `[human('a'), edit('a.js'), meta('Base directory for this skill: …'), bash('git status')]` → block (dòng `isMeta` không mở lượt mới).
- AC1.10: `SubagentStop` với `agent_type: 'data:data-migration-writer'` và `'data-migration-writer'` → `null`; `agent_type: 'backend:backend-implementer'` → block; `cfg: { exemptAgents: ['backend-implementer'] }` → `backend:backend-implementer` `null` còn `data:data-migration-writer` block (cấu hình ghi đè, không cộng).
- Hiệu năng: transcript tổng hợp ~5 MB (15 000 dòng assistant `Read` ~300 byte trước `human()`, rồi một sửa) → `decide` < 1000 ms (mục tiêu thiết kế < 300 ms đo tay; ngưỡng test nới để CI Windows không đỏ giả).

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs --only hooks`
Expected: FAIL — `Cannot find module …gate-stop.mjs`.

- [ ] **Step 3: Viết `core/hooks/scripts/gate-stop.mjs`**

Theo luồng §1 của design và khung `guard-files.mjs` (shebang, comment đầu file 1 dòng, `main()` bỏ BOM stdin, khối `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)` + `try/catch` fail-open + `process.exitCode = 0`). Các quyết định cụ thể:
- Ranh giới lượt (Stop): duyệt ngược từ cuối file, dừng ở dòng `type === 'user'`, `!isMeta`, và `message.content` là chuỗi hoặc mảng có phần tử `type !== 'tool_result'`; chỉ `JSON.parse` các dòng sau ranh giới. Dòng parse lỗi bị bỏ qua. SubagentStop: xét mọi dòng.
- Sửa code: `tool_use` tên `Edit|Write|MultiEdit|NotebookEdit`, đường dẫn `input.file_path ?? input.notebook_path`, không khớp `/\.(md|mdx|txt|rst|adoc)$/i`.
- Lệnh: `tool_use` tên `Bash|PowerShell`, `input.command` tách đoạn theo `/&&|\|\||;|\||\n/`, mỗi đoạn trim, bỏ tiền tố gán biến `^(\w+=\S*\s+)+`, rồi thử từng regex (mặc định + `testCommands`). Regex mặc định neo `^`:

```js
const DEFAULT_TEST_PATTERNS = [
  /^(npm|pnpm|yarn|bun)( run)? test(:[\w:-]+)?\b/,
  /^(npm|pnpm|yarn|bun) run (build|lint|typecheck)\b/,
  /^(npx|bunx|pnpm (exec|dlx)|yarn) (vitest|jest|mocha|playwright test|tsc|eslint)\b/,
  /^(vitest|jest|mocha|tsc|eslint|pytest|ruff|mypy)\b/,
  /^node (--test\b|test[\\/])/,
  /^(\.[\\/])?mvnw?(\.cmd)?\b.*\b(test|verify|compile)\b/,
  /^(\.[\\/])?gradlew?(\.bat)?\b.*\b(test|check|build)\b/,
  /^(python3?|py) -m (pytest|unittest)\b/,
  /^(uv|poetry) run (pytest|ruff|mypy)\b/,
  /^(go|cargo|dotnet) test\b/,
];
```

- `loadConfig(cwd)` mặc định: `git -C <cwd> rev-parse --show-toplevel` (timeout 3000, như `guard-files`), đọc `<root>/.claude/aip-gate.json`, lỗi bất kỳ → `null`. `testCommands` không phải mảng chuỗi → bỏ qua; từng regex `new RegExp(s)` trong `try`.
- `reason` tiếng Việt, ngắn: số file đã sửa, tối đa 3 đường dẫn, yêu cầu chạy test/lint/build liên quan hoặc nói rõ vì sao bỏ qua, cách tắt (`AIP_STOP_GATE=off` hoặc `"stopGate": false` trong `.claude/aip-gate.json`).

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs --only hooks`
Expected: mọi dòng của khối mới PASS; các khối `guard-bash`/`guard-files` cũ vẫn PASS. (Khối kiểm `hooks.json` chưa đổi ở task này.)

- [ ] **Step 5: Commit** qua `core:git-workflow` — header `feat(core): add stop gate hook script`.

### Task 2: Đăng ký hook Stop/SubagentStop và tài liệu

**Phủ AC:** AC1.9
**Files:**
- Modify: `core/hooks/hooks.json`
- Modify: `cli/lib/conventions.mjs:200` (`HOOK_EVENTS`)
- Modify: `README.md:319-330`, `README_VI.md:312-322` (mục hook của core)
- Modify: `CLAUDE.md:64` (dòng **Hooks**)
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: `core/hooks/scripts/gate-stop.mjs` (Task 1).
- Produces: `HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'Stop', 'SubagentStop']`.

- [ ] **Step 1: Viết test đỏ** trong `90-hooks.contract.mjs`:
  - `AC1.9: HOOK_EVENTS có Stop và SubagentStop` — `HOOK_EVENTS.includes('Stop') && HOOK_EVENTS.includes('SubagentStop')`.
  - `AC1.9: hooks.json core đăng ký Stop + SubagentStop gọi gate-stop.mjs` — với `hooks = JSON.parse(core/hooks/hooks.json)`, mỗi event `Stop`/`SubagentStop` có đúng một group, `hooks[0]` = `{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gate-stop.mjs'], timeout: 10 }`.
  - `AC1.9: build claude ship gate-stop.mjs` — khi `claudeDir` tồn tại: `plugins/core/hooks/scripts/gate-stop.mjs` có trong build.
  - Các kiểm "không lọt sang codex/cursor" và "skills-mode không cài hook" hiện có giữ nguyên, không viết lại.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs --build --only hooks`
Expected: FAIL ở 3 dòng AC1.9 mới.

- [ ] **Step 3: Sửa code và tài liệu**
  - `hooks.json`: thêm 2 khoá `Stop`, `SubagentStop` đúng đoạn JSON ở design §1 (không `matcher`).
  - `HOOK_EVENTS` như Interfaces.
  - README/README_VI: "hai hook `PreToolUse`" → thêm hook thứ ba `Stop`/`SubagentStop` (`gate-stop`): chặn một lần khi lượt đã sửa file code mà chưa chạy test/lint/typecheck/build sau lần sửa cuối; không phán xanh/đỏ; tắt bằng `AIP_STOP_GATE=off` hoặc `.claude/aip-gate.json` `{"stopGate": false}`; thêm lệnh bằng `testCommands`; miễn agent bằng `exemptAgents` (mặc định `data-migration-writer`); [Unverified] dựa vào cấu trúc transcript nội bộ của Claude Code. Giữ cấu trúc mục hiện có, mỗi README một đoạn ngắn + một ví dụ JSON cấu hình.
  - `CLAUDE.md:64`: thêm `gate-stop.mjs` (Stop/SubagentStop) vào câu Hooks.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs --build --only hooks`
Expected: PASS toàn bộ khối hooks (gồm `checkHooksJson` báo 0 lỗi cho core).

- [ ] **Step 5: Commit** qua `core:git-workflow` — header `feat(core): register stop gate for Stop and SubagentStop`.

### Task 3: `check-request.mjs` — W7/W8/W9, `--tests`, `--strict`

**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC2.6, AC2.7
**Files:**
- Modify: `core/skills/artifact-templates/scripts/check-request.mjs`
- Modify: `core/skills/artifact-templates/SKILL.md:33-34,44,87` (cú pháp mới, exit 1 khi `--strict`)
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Produces:
  - `export function acIdsIn(text: string): Set<string>` — ID đã chuẩn hóa `AC<n>.<m>`.
  - `export function planTestPaths(planText: string): { hasFiles: boolean, entries: Array<{ path: string, line: number }> }` — chỉ mục là file/thư mục test; `path` đã bỏ hậu tố `:<dòng>(-<dòng>)?`.
  - `export function checkRequest(texts, { readTest, override } = {})` — `readTest: (relPath: string) => string | null` (null = không tồn tại; thư mục trả nội dung gộp); `override: string[] | undefined`. Không có `readTest` → hành vi cũ W1–W6, các test cũ ở `test/content/18-…pin.mjs` không đổi.
  - `export function main(argv: string[]): 0 | 1 | 2`.

- [ ] **Step 1: Viết test đỏ** — khối mới trong `35-artifact-templates.contract.mjs`, import script qua `pathToFileURL`. Fixture: `design.md` có `AC1.1`, `AC1.2`, `AC1.10` hợp lệ; `plan.md` có `**Goal:**`, `**Spec:**`, `**Phủ AC:** AC1.1, AC1.2, AC1.10` và:

```text
**Files:**
- Modify: `src/a.mjs:10-20`
- Test: `test/a.contract.mjs:5`
- Create: `tests/b_test.py`
```

`readTest` là map `{ 'test/a.contract.mjs': "ok(x, 'AC1.10: …')", 'tests/b_test.py': 'def test_ac1_2_rejects(): pass' }` (khóa thiếu → `null`). Assertion:
  - `AC2.1: AC không có trong file test của plan → W7 tại dòng AC` — chỉ `AC1.1` có W7, `file === 'design.md'`, `line` = dòng của `AC1.1`.
  - `AC2.2: AC1.10 không phủ AC1.1; test_ac1_2_* và testAc1_2* phủ AC1.2` — thay nội dung `b_test.py` bằng `void testAc1_2Rejects()` vẫn không có W7 cho `AC1.2`; `acIdsIn('AC1.2 ac1_2 Ac1.2 AC1.20 xAC3_4')` = `{AC1.2, AC1.20, AC3.4}`.
  - `AC2.6: plan có **Files:** nhưng không file test → W8, không W7` — bỏ 2 dòng test khỏi plan → đúng một W8, 0 W7.
  - `AC2.6: file test ghi trong plan chưa tồn tại → W9` — xóa `tests/b_test.py` khỏi map → một W9 trỏ `plan.md` dòng của mục đó.
  - `AC2.6: planTestPaths` parameterized: `` `src/a.mjs` `` không phải test; `` `test/x.mjs` ``, `` `tests/x.py` ``, `` `src/__tests__/x.ts` ``, `` `spec/x.rb` ``, `` `a.test.ts` ``, `` `a.spec.js` ``, `` `a_test.go` ``, `` `test_a.py` ``, `` `FooTest.java` ``, `- Test: \`qa/x.feature\`` là test; `**Files:** \`test/a.mjs\`` (cùng dòng) được nhận; plan không có `**Files:**` → `hasFiles === false` và `checkRequest` không in W7/W8/W9.
  - `AC2.7: override thay phạm vi plan, không W8/W9` — `override: ['qa/']` với `readTest` trả nội dung chứa cả 3 ID → 0 cảnh báo dù plan không ghi test.
  - `AC2.3: quét thư mục đệ quy, bỏ thư mục loại trừ và file nhị phân` — dùng `main()` trên thư mục tạm có `.git/`, `docs/requests/r/design.md` (thêm `AC2.1` vào fixture), `docs/requests/r/plan.md` (`**Phủ AC:**` phủ cả `AC2.1`, ghi `` - Test: `test/` ``), `test/sub/a.mjs` (chứa `AC1.1 AC1.2 AC1.10`), `test/node_modules/x.js`, `test/build/y.js` và `test/bin.dat` (byte `\0` rồi `AC2.1`) cùng chứa `AC2.1`; `main([dir])` → exit 0, output (bắt `console.log`) có đúng một W7 và đó là `AC2.1` — chứng minh cả ba nguồn bị bỏ qua còn thư mục con `sub/` được quét.
  - `AC2.4: --strict exit 1 khi có cảnh báo, 0 khi sạch; không cờ vẫn 0; đối số sai 2` — `main([dir, '--strict'])` với một W7 → 1; sạch → 0; `main([dir])` có W7 → 0; `main([dir, '--tests'])`, `main([dir, '--bogus'])`, `main([dir, dir])`, `main([dir, '--tests', 'không-có'])` → 2.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs --only artifact-templates`
Expected: FAIL — `acIdsIn`/`planTestPaths` không phải function, W7 không xuất hiện.

- [ ] **Step 3: Sửa `check-request.mjs`**
  - `planTestPaths`: dòng bắt đầu `**Files:**` (sau `linesOf`, bỏ khối code) mở một vùng gồm chính dòng đó và các dòng `- ` liền sau; trong vùng lấy các đoạn trong backtick. Mục là test khi dòng bắt đầu `- Test:` (không phân biệt hoa thường) hoặc đường dẫn khớp `/(^|\/)(test|tests|__tests__|spec)(\/|$)|\.(test|spec)\.[^/]+$|_test\.[^/]+$|(^|\/)test_[^/]+\.py$|Test\.java$/`. Bỏ trùng theo `path`.
  - `checkRequest`: chỉ khi có `readTest` — `override` có → đọc từng path; không → `planTestPaths(plan.md)`: `!hasFiles` → bỏ qua W7–W9; `hasFiles` mà `entries` rỗng → W8 tại dòng `**Files:**` đầu tiên; entry đọc ra `null` → W9 tại `entry.line`. W7 cho mỗi AC hợp lệ (map `valid`) không nằm trong hợp `acIdsIn` của các nội dung đọc được. Thông điệp: W7 `` `${id} chưa có test nào nhắc tới` ``, W8 `plan.md không ghi file test nào trong **Files:**`, W9 `` `File test ${path} chưa tồn tại` ``.
  - `main`: phân tích `<dir> [--tests <path>…] [--strict]` (`--tests` lấy các đối số tới cờ kế; 0 path, cờ lạ, hơn một thư mục, path `--tests` không tồn tại → usage + 2). Gốc = thư mục tổ tiên gần nhất của `<dir>` có `.git` (file hoặc thư mục), không có → `process.cwd()`; path từ plan resolve theo gốc, path `--tests` theo `process.cwd()`. `readTest` mặc định: không tồn tại → `null`; file → nội dung, bỏ qua (chuỗi rỗng) nếu 8 KB đầu có `\0` hoặc đọc lỗi; thư mục → đệ quy, bỏ thư mục trong Global Constraints, gộp nội dung. Trả `strict && warnings.length ? 1 : 0`. Cập nhật thông báo usage và comment đầu file.
  - `SKILL.md`: cú pháp mới, ý nghĩa W7–W9, `--strict` exit 1.

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs --only artifact-templates && node test/validate.mjs --only superpowers-docs-standard`
Expected: PASS cả khối mới lẫn test W1–W6/exit code cũ ở pin 18.

- [ ] **Step 5: Commit** qua `core:git-workflow` — header `feat(core): warn when acceptance criteria have no test`.

### Task 4: Quy ước gắn ID AC vào test trong baseline và plan template

**Phủ AC:** AC2.5
**Files:**
- Modify: `core/agents/AGENTS.template.md:158-165` (mục Docs location and format)
- Modify: `AGENTS.md` (chép byte-for-byte từ template)
- Modify: `core/skills/artifact-templates/references/plan.template.md` (dòng `**Files:**`)
- Create: `test/content/19-verification-gate.pin.mjs`

**Interfaces:**
- Consumes: cú pháp `check-request.mjs` của Task 3.

- [ ] **Step 1: Viết pin đỏ** `test/content/19-verification-gate.pin.mjs` (khung như pin 18: comment đầu file nêu request, `export default async function run({ ok, ctx })`):
  - `AC2.5: baseline yêu cầu gắn ID AC vào tên test hoặc comment` — đoạn `### Superpowers workflow defaults` … `### Language` của template chứa `` `ac1_2` ``, `` `- Test:` ``, `--strict`.
  - `AC2.5: plan template ghi file test trong **Files:**` — `plan.template.md` chứa `` - Test: ` ``.
  - Kiểm `AGENTS.md == AGENTS.template.md` đã có ở `test/contract/30-templates.contract.mjs`; không viết lại.

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs --only verification-gate`
Expected: FAIL ở 2 dòng AC2.5.

- [ ] **Step 3: Sửa nội dung** (baseline viết tiếng Anh như phần còn lại của file):
  - Sau bullet "Acceptance criteria: …" thêm: test phủ một AC ghi ID của nó trong tên test hoặc comment (`AC1.2`; tên hàm Python dùng `ac1_2`); mỗi task ghi file test trong `**Files:**` dạng `` - Test: `path` ``.
  - Câu "It only warns; it never blocks." → nó cảnh báo cả AC chưa có test nào trong các file test của plan nhắc tới; chỉ cảnh báo (exit 0) trừ khi chạy với `--strict` (exit 1 khi có cảnh báo, dùng cho CI).
  - Chép template sang `AGENTS.md`.
  - `plan.template.md`: `**Files:** <...>` → danh sách theo writing-plans (`` - Create: `…` ``, `` - Modify: `…` ``, `` - Test: `…` ``).

- [ ] **Step 4: Chạy, xác nhận xanh**

Run: `node test/validate.mjs --only verification-gate && node test/validate.mjs --only templates && node test/validate.mjs --only superpowers-docs-standard`
Expected: PASS (gồm drift guard AGENTS.md và pin baseline cũ của project 1).

- [ ] **Step 5: Commit** qua `core:git-workflow` — header `docs(core): require AC ids in tests and test files in plans`.

### Task 5: Bump version, lock, chạy toàn bộ test

**Phủ AC:** AC4.1
**Files:**
- Modify: `core/.manifest.json` (`1.7.1` → `1.8.0`), và `.manifest.json` của plugin khác chỉ khi lệnh lock từ chối plugin đó (bump patch)
- Modify: `plugins/_versions.lock.json`

- [ ] **Step 1:** Bump `core` lên `1.8.0`.
- [ ] **Step 2:** Run: `npm run build && node cli/lib/versions.mjs --lock` — Expected: exit 0. Nếu lock báo "nội dung build đổi nhưng version chưa bump" cho plugin khác → bump patch plugin đó rồi chạy lại.
- [ ] **Step 3:** Run: `npm test` — Expected: toàn bộ PASS (validate --build, install, wizard, managed-block, init, pack-guard, args).
- [ ] **Step 4:** Run: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-20-verification-gate` — Expected: không có W1–W6, W8, W9; W7 chỉ còn cho `AC3.1`, `AC3.2`, `AC4.1` (kiểm thủ công / bằng `npm test`, không có test nhắc ID). Ghi kết quả vào báo cáo task.
- [ ] **Step 5: Commit** qua `core:git-workflow` — header `chore(release): bump core for verification gate`.

### Task 6: Smoke test hook Stop và chạy eval lần đầu (thủ công, tốn tiền)

**Phủ AC:** AC3.1, AC3.2
**Files:**
- Modify: `evals/README.md`
- Modify: `evals/<plugin>/<case>/**` chỉ khi lỗi thuộc case/grader/lệnh (AC3.2)

Task này do **session chính** chạy (không giao subagent): nó đổi cấu hình Claude global và tiêu tiền model trên tài khoản người dùng.

- [ ] **Step 1: Ghi lại trạng thái cài đặt trước** — Run: `aip check -g` và lưu output vào báo cáo để có thể trả lại (`aip uninstall --provider claude --plugin <id> -g --yes` cho plugin vốn chưa cài).
- [ ] **Step 2: Cài plugin** — Run: `npm run build`, rồi `aip install --provider claude --as-plugin --plugin <id> -g --yes` cho `core`, `engineering`, `backend`, `workflows`.
- [ ] **Step 3: Smoke Stop hook** — trong một project nháp có `git init` và `package.json` có script `test`, mở phiên `claude` mới: (a) yêu cầu sửa một file `.js` rồi dừng → thấy lý do chặn của gate, agent chạy test hoặc giải thích rồi dừng; (b) yêu cầu chỉ sửa `README.md` → dừng không bị chặn. Ghi kết quả; nếu plugin hook `Stop` không chạy, ghi rõ và gỡ nhãn [Unverified] theo kết quả thật.
- [ ] **Step 4: Chạy từng case** theo "Danh sách kiểm lần chạy đầu" của `evals/README.md`, mỗi lượt `--case <name> --runs 1 --no-publish --max-cost-usd <0,5 − đã tiêu của case>`, kèm cờ thêm theo bảng của README (`--allow-tools Write Edit`, `--scaffold` cho backend/workflows) và `--json evals/<id>/results/latest.json`. Đọc chi phí từ JSON sau mỗi lượt; hết 0,5 USD của case thì dừng case đó.
- [ ] **Step 5: Phân loại case đỏ (AC3.2)** — lỗi do case/grader/lệnh → sửa trong `evals/` rồi chạy lại nếu còn ngân sách; lỗi do skill → ghi finding (case, grader đỏ, trích hành vi) vào README, không sửa skill.
- [ ] **Step 6: Cập nhật `evals/README.md` (AC3.1)** — thêm mục "Kết quả lần chạy đầu" với bảng `Case | Ngày | Model | Số run | Pass | Chi phí (USD) | Ghi chú`; bỏ hoặc sửa các nhãn [Unverified] mà lần chạy đã kiểm (cách gọi lệnh, nơi đọc case, nơi ghi kết quả, scaffold, `file_exists`); giữ nhãn cho điều chưa kiểm được.
- [ ] **Step 7:** Run: `node test/validate.mjs --only evals` — Expected: PASS (contract cấu trúc case vẫn xanh sau khi sửa case).
- [ ] **Step 8: Commit** qua `core:git-workflow` — header `docs(evals): record first eval run results`. Báo người dùng tổng chi phí thực tế và lệnh gỡ cài đặt nếu họ muốn trả trạng thái global về như Step 1.
