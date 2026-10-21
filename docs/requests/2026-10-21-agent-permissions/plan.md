# Quyền cho agent và cổng MCP (P4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm chính sách quyền chuẩn `core/permissions/policy.json` được `aip init --full` chiếu thành `.claude/settings.json`, hook `guard-mcp` kiểm theo `mcpAllow`/`mcpDeny`, mục baseline và README về agent trong CI, và spec sống đầu tiên `docs/specs/hooks-gates/spec.md`.
**Architecture:** Chính sách là dữ liệu JSON trong core; một module thuần `cli/lib/permissions.mjs` đọc, kiểm cú pháp quy tắc và dựng khối `permissions`; `cli/lib/init.mjs` thêm một mục vào kế hoạch ghi file (không ghi đè). `guard-mcp.mjs` theo khuôn `guard-files.mjs` (hàm `decide` thuần + `main` đọc stdin, fail-open) và đọc cấu hình qua `gate-config.mjs`.
**Tech Stack:** Node 20+ ESM, chỉ built-in; harness `test/validate.mjs` (contract/content modules), `node:test` cho `test/init.test.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; baseline tiếng Anh; README.md tiếng Anh, README_VI.md tiếng Việt có dấu.
- Dạng quy tắc quyền hợp lệ (chỉ các dạng này): `Read(<path>)`, `Bash(<lệnh> *)` (dấu cách trước `*`), `WebFetch`, `mcp__<server>__*`. Nhóm của chính sách: `secrets` (action `deny`), `git_push`, `network`, `production_deploy` (action `ask`). Quy tắc glob chưa xác nhận trong tài liệu (ví dụ cho `*.pem`) không được đưa vào cho tới khi đối chiếu `code.claude.com/docs/en/permissions`; nếu không xác nhận được thì bỏ quy tắc đó và ghi vào báo cáo task.
- `.claude/settings.json` do `aip init --full` tạo **chỉ khi chưa tồn tại**; không bao giờ sửa file có sẵn; không ghi settings ở scope global.
- Cấu hình hook trong `<git-root>/.claude/aip-gate.json`: `mcpAllow`, `mcpDeny` — mảng chuỗi. Tên server: `<server>` hoặc `plugin:<plugin>:<server>`. Tool `mcp__<server>__<tool>`; tool của plugin `mcp__plugin_<plugin>_<server>__<tool>` ánh xạ về `plugin:<plugin>:<server>` (tên plugin không chứa `_`; phần còn lại là server). Không có cấu hình, cấu hình sai kiểu, hoặc lỗi nội bộ → cho qua (fail-open, exit 0, không in gì). `mcpDeny` thắng `mcpAllow`; có `mcpAllow` không rỗng thì server ngoài danh sách bị `deny`.
- Đầu ra deny theo khuôn của `guard-files`: `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: <vì sao> } }`.
- Tên test bắt đầu bằng ID AC. Giữa các task chỉ chạy test có mục tiêu; `npm test` toàn bộ xanh ở Task 6.
- Commit mỗi task qua `core:git-workflow` (`git commit -F`), không dòng `Co-Authored-By`; không push; chỉ bump version ở Task 6 (core và đúng plugin mà `versions.mjs --lock` buộc).

## Review Focus

- `aip init --full` khi `.claude/settings.json` đã có nội dung tùy ý (kể cả JSON hỏng) → giữ nguyên byte-for-byte, không parse, không crash → Task 2.
- `mcp__` tool thiếu phần tool hoặc tên rỗng (`mcp__`, `mcp__a`) → cho qua, không crash → Task 3.
- Tên server có dấu `_` (`mcp__my_server__t`) → server là `my_server`; tool của plugin có server chứa `_` → ánh xạ đúng → Task 3.
- `mcpAllow` là chuỗi (không phải mảng), mảng lẫn số, `null` → coi như không có cấu hình → Task 3.
- `aip-gate.json` có BOM hoặc không tồn tại, thư mục không phải git → cho qua → Task 3.
- Chính sách có nhóm lạ hoặc action ngoài `deny|ask`, quy tắc rỗng/có ký tự điều khiển → validator báo lỗi → Task 1.
- Tên module test pin mới không trùng ID AC với pin cũ (bài học P7) → Task 4.

---

### Task 1: Chính sách quyền và bộ dựng khối `permissions`

**Phủ AC:** AC1.1
**Files:**
- Create: `core/permissions/policy.json`, `cli/lib/permissions.mjs`, `test/contract/92-permissions.contract.mjs`
- Test: `test/contract/92-permissions.contract.mjs`

**Interfaces:**
- Produces: `export const POLICY_PATH: string` (đường dẫn tuyệt đối tới `core/permissions/policy.json`); `export function loadPolicy(file?: string): { version: number, groups: Record<string, { action: 'deny'|'ask', rules: string[] }> }`; `export function checkPolicy(policy: object): string[]` (danh sách lỗi, rỗng = hợp lệ; kiểm bốn nhóm bắt buộc, action đúng, `rules` không rỗng, từng quy tắc qua `isValidRule`); `export function isValidRule(rule: string): boolean`; `export function buildClaudePermissions(policy): { permissions: { deny: string[], ask: string[] } }` (gom theo action, giữ thứ tự nhóm, không trùng).

- [x] **Step 1: Viết test đỏ** (module `92-permissions.contract.mjs`, `export default async function run({ ok, ctx })`, theo mẫu import của `90-hooks.contract.mjs`): `AC1.1:` chính sách thật của repo qua `checkPolicy` không lỗi và có đủ bốn nhóm với action đúng; bảng tham số hóa cho `isValidRule` (hợp lệ: `Read(./.env)`, `Bash(git push *)`, `WebFetch`, `mcp__x__*`; không hợp lệ: chuỗi rỗng, `Bash(git push*)`, `Read()`, `mcp__x`, quy tắc có xuống dòng); `checkPolicy` báo lỗi cho nhóm lạ, action lạ, thiếu nhóm, `rules` rỗng; `buildClaudePermissions` gom `deny` từ `secrets` và `ask` từ ba nhóm còn lại theo đúng thứ tự, không trùng.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only permissions`. Expected: FAIL (module chưa có).
- [x] **Step 3: Tạo `policy.json`** dạng `{ "version": 1, "groups": { … } }` với quy tắc tối thiểu: `secrets` → `Read(./.env)`, `Read(./.env.*)`; `git_push` → `Bash(git push *)`; `network` → `WebFetch`, `Bash(curl *)`, `Bash(wget *)`; `production_deploy` → `Bash(kubectl apply *)`, `Bash(terraform apply *)`, `Bash(helm upgrade *)`. Đối chiếu `Read(./.env.*)` với tài liệu cú pháp quy tắc; nếu không xác nhận được dạng glob thì chỉ giữ `Read(./.env)` (xem Global Constraints).
- [x] **Step 4: Viết `cli/lib/permissions.mjs`** theo Interfaces (regex cho từng dạng quy tắc hợp lệ; không dùng thư viện ngoài).
- [x] **Step 5: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only permissions`. Expected: PASS. Run: `npm run pack:verify`. Expected: exit 0 (file mới nằm trong `core/` và `cli/` nên theo gói npm).
- [x] **Step 6: Commit** `feat(core): add agent permission policy and rule builder`.

### Task 2: `aip init --full` sinh `.claude/settings.json`

**Phủ AC:** AC1.2, AC1.3
**Files:**
- Modify: `cli/lib/init.mjs`
- Test: `test/init.test.mjs`

**Interfaces:**
- Consumes: `loadPolicy`, `buildClaudePermissions` (Task 1).
- Produces: kế hoạch `init({ full: true })` có thêm mục `['.claude/settings.json', { content }]` với `content = JSON.stringify(buildClaudePermissions(loadPolicy()), null, 2) + '\n'`; `init` không đổi chữ ký.

- [x] **Step 1: Viết test đỏ** trong `test/init.test.mjs`: `AC1.2:` sau `init --full` ở thư mục trống có `.claude/settings.json` hợp lệ JSON, `permissions.deny` bằng đúng quy tắc nhóm `secrets` và `permissions.ask` bằng quy tắc ba nhóm còn lại; `AC1.3:` ghi trước `.claude/settings.json` nội dung tùy ý (một bản JSON hợp lệ và một bản chuỗi rác) → sau `init --full` byte-for-byte không đổi, đường dẫn nằm trong `skipped`; `init` (không `--full`) không tạo file này; cập nhật test hiện có `init --full tạo cả khung…` để danh sách `created` mong đợi có thêm `.claude/settings.json`.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/init.test.mjs`. Expected: FAIL.
- [x] **Step 3: Thêm mục vào kế hoạch của `init`** trong nhánh `full` (cùng cơ chế `existsSync → skipped` đang dùng); không đọc hay parse file có sẵn.
- [x] **Step 4: Chạy, xác nhận xanh.** Run: `node test/init.test.mjs` và `node test/wizard.test.mjs`. Expected: PASS (wizard có thể liệt kê file init; nếu fail thì cập nhật danh sách mong đợi tương ứng).
- [x] **Step 5: Commit** `feat(cli): generate .claude/settings.json permissions on init --full`.

### Task 3: Hook `guard-mcp`

**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC2.5
**Files:**
- Create: `core/hooks/scripts/guard-mcp.mjs`, `test/contract/91-guard-mcp.contract.mjs`
- Modify: `core/hooks/hooks.json`
- Test: `test/contract/91-guard-mcp.contract.mjs`, `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: `readGateConfig(dir)` từ `core/hooks/scripts/gate-config.mjs` (trả object cấu hình hoặc `null`).
- Produces: `export function parseMcpTool(name: string): { server: string } | null` (`mcp__a__t` → `{server:'a'}`; `mcp__plugin_p_a__t` → `{server:'plugin:p:a'}`; thiếu phần tool hoặc tên rỗng → `null`); `export function decide(input: object, { config }?: { config?: object | null }): { decision: 'deny', reason: string } | null` (`config` mặc định đọc bằng `readGateConfig(input.cwd)`).

- [x] **Step 1: Viết test đỏ** trong module mới `91-guard-mcp.contract.mjs`: `AC2.1:` `hooks.json` có mục PreToolUse với matcher `mcp__.*` và `args[0]` kết thúc `guard-mcp.mjs`, qua `checkHooksJson` không lỗi, build claude ship script; `AC2.2:` không cấu hình (`null`, `{}`) → `null`; `AC2.3:` bảng tham số hóa cấu hình × tên tool: `mcpAllow:['a']` + `mcp__b__t` → deny có lý do; `mcp__a__t` → `null`; `mcpAllow:['plugin:p:a']` + `mcp__plugin_p_a__t` → `null`, `+ mcp__plugin_p_b__t` → deny; `mcp__my_server__t` với `mcpAllow:['my_server']` → `null`; `AC2.4:` `mcpDeny` thắng `mcpAllow`; `mcpDeny` đơn lẻ chặn đúng server; `AC2.5:` cấu hình sai kiểu (`mcpAllow:'a'`, `[1]`, `null`), tên tool hỏng (`mcp__`, `mcp__a`), tool không phải MCP (`Bash`) → `null`; CLI qua `execFileSync('node', [script], { input })`: stdin rỗng/`nope`/`{}` → không in gì, exit 0; stdin có BOM + cấu hình deny trong một git repo tạm (`aip-gate.json` có BOM) → in JSON deny; thư mục không phải git → không in gì.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only guard-mcp`. Expected: FAIL.
- [x] **Step 3: Viết `guard-mcp.mjs`** theo khuôn `guard-files.mjs` (hàm `decide`/`parseMcpTool` export; `main` đọc stdin bỏ BOM, in JSON deny; chỉ chạy `main` khi là entry; `try/catch` fail-open; `process.exitCode = 0`).
- [x] **Step 4: Đăng ký trong `hooks.json`** một mục PreToolUse mới `{ "matcher": "mcp__.*", hooks: [{ type:'command', command:'node', args:['${CLAUDE_PLUGIN_ROOT}/hooks/scripts/guard-mcp.mjs'], timeout:10 }] }` theo đúng định dạng các mục hiện có; sửa các kiểm đếm cứng trong `90-hooks.contract.mjs` nếu có (không nới lỏng assertion khác).
- [x] **Step 5: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only guard-mcp` và `--only hooks`. Expected: PASS.
- [x] **Step 6: Commit** `feat(core): add guard-mcp hook with mcpAllow and mcpDeny`.

### Task 4: Baseline, README và pin cho agent trong CI

**Phủ AC:** AC3.1, AC3.2
**Files:**
- Modify: `core/agents/AGENTS.template.md`, `AGENTS.md` (chép byte-for-byte), `README.md`, `README_VI.md`, `CLAUDE.md`
- Create: `test/content/23-agent-permissions.pin.mjs`
- Test: `test/content/23-agent-permissions.pin.mjs`, `test/contract/70-bytes.contract.mjs`

**Interfaces:**
- Consumes: khoá `mcpAllow`/`mcpDeny` (Task 3), `core/permissions/policy.json` và `.claude/settings.json` của init (Task 1–2).

- [x] **Step 1: Viết test đỏ** (module pin mới, `export default async function run({ ok, ctx })`; ID AC mang tiền tố `P4 AC…` hoặc `AC3.1 (P4):` để không trùng ID cũ trong cùng thư mục — kiểm bằng grep các pin hiện có): baseline có mục `Agents in CI` với `--permission-mode dontAsk`, `--allowedTools`, `--max-turns`, `--max-budget-usd`, `--bare` và ghim action theo commit SHA; README.md và README_VI.md có công thức CI, mục chính sách quyền (nêu Claude-only và lý do chưa có Cursor/Codex/Antigravity) và khoá `mcpAllow`/`mcpDeny`; `CLAUDE.md` nhắc `guard-mcp` và `core/permissions/policy.json`.
- [x] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only agent-permissions`. Expected: FAIL.
- [x] **Step 3: Viết mục baseline `Agents in CI`** (tiếng Anh, ngắn, ngay trước `### Model and session routing` hoặc cùng cấp với các mục hiện có), rồi `cp core/agents/AGENTS.template.md AGENTS.md` và `cmp` hai file.
- [x] **Step 4: Viết README.md/README_VI.md**: công thức tối thiểu cho `claude -p` (dựa trên sự thật đã nêu trong design: `dontAsk`, `--allowedTools` tường minh, `--max-turns`, `--max-budget-usd`, `--bare`; `-p` không `--bare` nạp hook và `.mcp.json` của project không hỏi; ghim action theo SHA, token chỉ đọc, môi trường cần người duyệt), bảng/mục hook thêm `guard-mcp` kèm `mcpAllow`/`mcpDeny` (đặt cạnh mô tả `allowEnvFiles` hiện có), mục chính sách quyền. Mọi khẳng định về Claude Code ghi `[Unverified]` kèm link tài liệu khi chưa tự đối chiếu. Cập nhật `CLAUDE.md` mô tả `guard-mcp` (mục Hooks) và `core/permissions/policy.json`.
- [x] **Step 5: Chạy, xác nhận xanh.** Run: `node test/validate.mjs --build --only agent-permissions` và `--only bytes`. Expected: PASS.
- [x] **Step 6: Commit** `docs(core): document agent CI recipe, permission policy and guard-mcp`.

### Task 5: Spec sống đầu tiên `hooks-gates`

**Phủ AC:** AC4.1
**Files:**
- Create: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/README.md` (chỉ nếu cần đánh dấu năng lực đã có spec)
- Test: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-agent-permissions`

**Interfaces:**
- Consumes: khung `core/skills/artifact-templates/references/spec.template.md` (bỏ khối header); mục `## Ảnh hưởng spec` của design (`hooks-gates: thêm R1, thêm R2, thêm R3`).

- [x] **Step 1:** Tạo `docs/specs/hooks-gates/spec.md` theo khung template (bỏ khối `<!-- artifact-template … -->`), Vietnamese: `Mục đích`, `Phạm vi`; ba yêu cầu đo được, mỗi yêu cầu một dòng `- **hooks-gates/R<n>** — … Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)`: R1 `guard-mcp` từ chối tool của server không thuộc `mcpAllow` khi `mcpAllow` không rỗng; R2 `mcpDeny` thắng `mcpAllow`; R3 không có cấu hình, cấu hình sai kiểu hoặc lỗi nội bộ thì `guard-mcp` cho qua. Bảng `Lịch sử` có ba dòng tương ứng với ngày 2026-10-21.
- [x] **Step 2:** Run `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-agent-permissions`. Expected: không W10–W14 (W7/W8/W9 có thể còn vì AC cổng hoặc plan chưa liệt kê hết file test — báo nhưng không sửa AC).
- [x] **Step 3:** Cập nhật `docs/specs/README.md` bằng một câu nêu `hooks-gates` đã có spec (giữ nguyên bảng 7 năng lực).
- [x] **Step 4: Commit** `docs(specs): add hooks-gates living spec for guard-mcp`.

### Task 6: Version, lock và toàn bộ test

**Phủ AC:** AC5.1
**Files:**
- Modify: `core/.manifest.json`, `plugins/_versions.lock.json`, `CHANGELOG.md`, manifest của plugin mà lock buộc phải bump
- Test: toàn repo (`npm test`)

- [x] **Step 1:** Bump `core/.manifest.json` version lên bản minor kế tiếp; `npm run build`; `node cli/lib/versions.mjs --lock`. Nếu lock từ chối vì plugin/workflow khác đổi nội dung chiếu thì bump đúng plugin theo thông báo, build lại và lock lại. Thêm mục vào `CHANGELOG.md` theo định dạng hiện có (chính sách quyền, `guard-mcp`, `.claude/settings.json` từ init, mục CI, spec `hooks-gates`; ghi các plugin bị bump kèm lý do).
- [x] **Step 2:** Run `npm test`. Expected: exit 0, validate/install/wizard/init/pack-guard/args/transcript-stats đều 0 fail.
- [x] **Step 3:** Run `npm run pack:verify`. Expected: exit 0.
- [x] **Step 4:** Run `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-agent-permissions --tests test/contract/92-permissions.contract.mjs test/contract/91-guard-mcp.contract.mjs test/contract/90-hooks.contract.mjs test/init.test.mjs test/content/23-agent-permissions.pin.mjs`. Expected: W7 chỉ cho AC không có test (AC3.2, AC4.1, AC5.1 là AC đọc/cổng); báo từng cái.
- [x] **Step 5:** Tick AC1.1–AC5.1 trong `design.md` khi có bằng chứng từ các bước trên (AC không chứng minh được giữ `[ ]` kèm `[chưa kiểm]`); tick các step đã làm trong plan này trừ Step 6; commit `chore(core): bump core and lock versions` rồi `docs(requests): mark agent permissions AC done and tick plan`.
- [ ] **Step 6:** Dừng, báo người dùng nhánh `feature/p4-permissions-mcp` để duyệt diff; không merge, không push.

### Task 7: `allowEnvFiles` bỏ quy tắc `.env` khỏi settings sinh ra

**Phủ AC:** AC1.4
**Files:**
- Modify: `core/permissions/policy.json`, `cli/lib/permissions.mjs`, `cli/lib/init.mjs`, `README.md`, `README_VI.md`, `CHANGELOG.md`
- Test: `test/contract/92-permissions.contract.mjs`, `test/init.test.mjs`

**Interfaces:**
- Produces: nhóm có thể mang khoá tuỳ chọn `"omitWhen": "allowEnvFiles"` (giá trị duy nhất hợp lệ); `buildClaudePermissions(policy, { allowEnvFiles }?: { allowEnvFiles?: boolean })` bỏ nhóm có `omitWhen` khớp cờ đang bật; `init` đọc trực tiếp `<root>/.claude/aip-gate.json` (bỏ BOM; chỉ `allowEnvFiles === true` mới bật; thiếu file, JSON hỏng hoặc kiểu khác → tắt), không dùng `gate-config.mjs` vì thư mục đích có thể chưa là git repo.

- [ ] **Step 1: Viết test đỏ** — `AC1.4:` init --full với `aip-gate.json` `{"allowEnvFiles": true}` (và bản có BOM) → `permissions.deny` rỗng và `ask` giữ đủ ba nhóm; với `{"allowEnvFiles": "true"}`, `false`, JSON hỏng, thiếu file → deny giữ quy tắc `.env` như AC1.2; `aip-gate.json` có sẵn không bị sửa; contract: `checkPolicy` chấp nhận `omitWhen: "allowEnvFiles"` và từ chối giá trị khác; `buildClaudePermissions` với `{ allowEnvFiles: true }` bỏ nhóm `secrets`.
- [ ] **Step 2: Chạy, xác nhận đỏ.** Run: `node test/validate.mjs --build --only permissions` và `node test/init.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Thêm `"omitWhen": "allowEnvFiles"` vào nhóm `secrets`; cập nhật `checkPolicy`/`buildClaudePermissions`; nối `init`** đọc cờ và truyền vào `buildClaudePermissions`. README EN/VI và CHANGELOG nêu hành vi.
- [ ] **Step 4: Chạy, xác nhận xanh.** Run: hai lệnh ở Step 2 và `--only agent-permissions`. Expected: PASS.
- [ ] **Step 5: Bump version nếu `versions.mjs --lock` buộc, chạy `npm test` và `npm run pack:verify`; tick AC1.4; commit** `feat(cli): omit .env rules from generated settings when allowEnvFiles is true`.
