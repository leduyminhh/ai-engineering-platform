# Kiểm soát context phiên dài Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm quy tắc baseline cho phiên chạy dài, template `handoff.md`, hook `SessionStart` (bật mặc định) và lệnh `aip stats` đo context từ transcript.
**Architecture:** Nội dung quy tắc nằm trong managed block `core/agents/AGENTS.template.md` (mục "Model and session routing" đã có, chỉ mở rộng). Template mới vào skill `core/artifact-templates` để dùng chung 4 provider. Hook `core/hooks/scripts/session-start.mjs` theo đúng khung `gate-stop.mjs` (hàm `decide()` thuần, fail-open, đọc `.claude/aip-gate.json`). Công cụ đo là module thuần `cli/lib/transcript-stats.mjs` + lệnh `aip stats`, không phụ thuộc build.
**Tech Stack:** Node 20+ ESM, chỉ built-in; harness `test/validate.mjs` (contract/content) và test rời `test/*.test.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; baseline viết tiếng Anh; `README.md` tiếng Anh, `README_VI.md` tiếng Việt có dấu.
- `AGENTS.md` gốc giống **byte-for-byte** `core/agents/AGENTS.template.md` (contract `30-templates.contract.mjs:7`).
- Hook: chỉ `node` + `args` dạng exec, `args[0]` bắt đầu `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/`, `timeout` số trong `(0, 30]` (`checkHooksJson`). Fail-open: lỗi nội bộ → exit 0, không in gì.
- `SessionStart` **không chặn được** phiên (exit 2 chỉ hiện stderr cho người dùng); `additionalContext` và stdout mỗi thứ cap **10.000 ký tự**, không nâng được, vượt thì Claude Code thay bằng đường dẫn file + 2.000 ký tự đầu và **không nhắc Claude đọc file đó** → script tự cắt.
- `prompt_cache_likely_expired` / `estimated_cache_write_usd` / `context_tokens` chỉ có từ Claude Code **v2.1.251+** và chỉ khi `source` là `resume`/`fork`. Thiếu trường → không in gì.
- Mọi con số trong baseline có link nguồn chính thức hoặc nhãn `[Unverified]` / `[Inference]`.
- Ngưỡng xoay phiên: mềm ~40%, cứng ~60% — giữ nhãn `[Inference]`, không trình bày như số đo.
- Mọi thay đổi nội dung `core/` → bump `core/.manifest.json` rồi `node cli/lib/versions.mjs --lock`.
- Tên test bắt đầu bằng ID AC (`AC<n>.<m>`); giữa các task chỉ chạy test có mục tiêu, `npm test` toàn bộ ở Task 6.
- Commit mỗi task qua `core:git-workflow` (`git commit -F`), không dòng `Co-Authored-By`.

## Review Focus

- `handoff.md` rỗng, chỉ có tiêu đề, hoặc toàn placeholder `<…>` → hook không được chèn một khối rỗng vào mọi phiên; nội dung dưới ngưỡng tối thiểu thì bỏ qua.
- `docs/requests/` có nhiều request, chỉ **một** request đang chạy → phải chọn theo mtime, không theo thứ tự alphabet; request cũ không được thắng.
- `handoff.md` cũ (vài ngày) vẫn tồn tại → không chèn, vì phiên mới làm lại việc còn tốn hơn không chèn.
- Transcript có entry `attachment` (`prompt_snapshot`, `skill_listing`, `total_tokens_reminder`…) — chiếm phần lớn context thật nhưng **không** phải `tool_result`; công cụ bỏ qua chúng sẽ báo tổng thiếu.
- `aip stats` gặp transcript của phiên đang chạy (file đang được ghi) → dòng JSONL cuối có thể dở; một dòng hỏng không được làm hỏng cả báo cáo.
- `aip stats` chạy ở project chưa từng có phiên Claude Code → báo "không tìm thấy", exit 0, không stack trace.

---

### Task 1: Sửa số đo và AC4.2 trong design.md

Design.md hiện ghi transcript lưu mục assistant **hai lần** và phải loại trùng theo `message.id`. Đo lại trên transcript thật cho thấy điều ngược lại: các entry dùng chung `message.id` là **block tách rời** (`thinking`, `text`, `tool_use`), nội dung **bổ sung** nhau, `0` khối trùng nội dung; loại trùng theo `message.id` sẽ **mất** nội dung. Cách đúng là lấy dung lượng từ `message.usage` và đếm `tool_use.id` / `tool_result.tool_use_id`.

**Phủ AC:** AC4.2
**Files:**
- Modify: `docs/requests/2026-10-21-long-session-context/design.md:29` (mục "Phát hiện thêm"), `:47` (mục "Chưa kiểm được"), `:84` (AC4.2)

**Interfaces:**
- Produces: cách đo mà Task 4 hiện thực — context một lượt = `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`; đếm nội dung theo `tool_use.id` / `tool_result.tool_use_id`; `attachment` là nhóm riêng.

- [ ] **Step 1: Thay dòng "Phát hiện thêm" (design.md:29) bằng số đo đã kiểm**

Nội dung mới nêu: (a) `message.id` dùng chung cho nhiều entry là các block tách rời, không phải bản trùng — `14f90af6` có 241 entry / 97 `message.id` / 0 khối trùng nội dung, nên **không** loại trùng theo `message.id`; (b) cách đúng là `usage` cho dung lượng và `tool_use.id` cho nội dung; (c) `attachment` là nhóm riêng chiếm phần lớn (phiên `cbf9fb34`: `prompt_snapshot` 42%, `skill_listing` 21%, `instructions` 8%, `nested_memory` 7%, `total_tokens_reminder` 581 lần ≈ 5%); (d) dung lượng đầu phiên 61K–85K token trên 6 phiên dài nhất, đỉnh 965K ở lượt 295 — khớp `get_usage`.

- [ ] **Step 2: Bỏ nhãn `[Unverified]` ở design.md:47**

Phần chênh 578K so với ~363K đã giải thích được: số 363K đo thủ công bỏ sót `thinking`, `attachment` (`prompt_snapshot`, `skill_listing`) và `usage`; đo từ `usage` ra đúng mức `get_usage` báo. Xoá dòng `[Unverified]` đó khỏi mục "Chưa kiểm được", không thêm dòng thay thế.

- [ ] **Step 3: Viết lại AC4.2 (design.md:84)**

AC4.2 mới: *Given công cụ đo transcript, When chạy trên transcript có entry assistant dùng chung `message.id`, Then mọi block đều được tính (không loại trùng theo `message.id`); `tool_result` trùng `tool_use_id` chỉ tính một lần; dung lượng mỗi lượt lấy từ `usage`; báo cáo tách nhóm `attachment` khỏi `tool_result` và tổng các nhóm khớp tổng nội dung.*

- [ ] **Step 4: Ghi quyết định đã chốt vào design.md**

Ba câu hỏi mở ở cuối design.md (dòng 137–141) đã có đáp án người dùng 2026-10-21: (1) **bật mặc định** cả hai hook H-A và H-B; (2) `autoCompactWindow` **không** hạ mặc định, chỉ hướng dẫn kèm đánh đổi (giữ D7); (3) công cụ đo transcript **làm trong aip** (`aip stats`). Ghi ba đáp án này vào mục "Quyết định đã chốt", đổi `Trạng thái` ở dòng 3 thành "đã duyệt 2026-10-21, đang hiện thực theo plan.md", và sửa D8 từ "người dùng chọn, mặc định tắt" thành "bật mặc định, tắt bằng `handoffInject`/`resumeWarn`".

- [ ] **Step 5: Chạy validator của request**

Run: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-long-session-context`
Expected: không có `WARN ... [W3]`/`[W4]` (ID AC trùng hoặc sai định dạng); W6/W7/W9 được phép ở bước này vì plan chưa có test file.

- [ ] **Step 6: Commit**

```bash
git add docs/requests/2026-10-21-long-session-context/design.md docs/requests/2026-10-21-long-session-context/plan.md
git commit -F - <<'EOF'
docs(requests): record approved decisions and implementation plan

Chốt bật mặc định hai hook SessionStart, công cụ đo nằm trong aip;
kèm plan 6 task cho phiên chạy dài.
EOF
```

### Task 2: Template `handoff.md`

**Phủ AC:** AC2.1, AC4.1
**Files:**
- Create: `core/skills/artifact-templates/references/handoff.template.md`
- Modify: `core/skills/artifact-templates/SKILL.md` (mục lục + bản đồ tài liệu)
- Modify: `test/contract/35-artifact-templates.contract.mjs:42` (danh sách `TYPES`)
- Modify: `README.md:106`, `README_VI.md:103`, `CLAUDE.md:63` ("9 artifact templates" → "10")
- Test: `test/contract/35-artifact-templates.contract.mjs`

**Interfaces:**
- Produces: file `core/skills/artifact-templates/references/handoff.template.md`, header `type: handoff`, `version: 1`, `validator: chưa có`. Task 3 (hook) và Task 5 (baseline) trỏ tới đường dẫn này.

- [ ] **Step 1: Viết test đỏ — thêm `'handoff'` vào `TYPES`**

Trong `35-artifact-templates.contract.mjs:42`, thêm `'handoff'` vào mảng `TYPES` và đổi thông điệp `'mục lục artifact-templates có đúng 9 loại'` → `'… 10 loại'`. Vòng lặp sẵn có (`for (const row of index)`) đã tự kiểm file tồn tại, khối header, `validator`/`sources` khớp dòng mục lục, `type` khớp cột Loại — không viết thêm assertion nào.

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs --only artifact-templates`
Expected: FAIL với `mục lục artifact-templates có đúng 10 loại (đang có: adr, agent, …)`.

- [ ] **Step 3: Tạo template**

`core/skills/artifact-templates/references/handoff.template.md`, mở đầu bằng khối:

```
<!-- artifact-template
type: handoff
version: 1
validator: chưa có
sources: docs/requests/2026-10-21-long-session-context/design.md (D4); Claude Code prompt-caching (session rotation)
Bỏ khối này khi chép template ra dùng.
-->
```

Thân file có đúng các heading sau, mỗi heading một dòng mẫu `<…>`:

`# Bàn giao phiên — <slug>` → `## Nhánh` (`<tên nhánh>`, `<hash HEAD>`), `## Đã xong`, `## Đang dở`, `## Bước kế`, `## Câu hỏi chờ người dùng`, `## Ràng buộc phải nhớ`, `## Run-log` (đường dẫn file), `## Context` (dòng `used_percentage` / `/usage` từng phiên ở cổng phase gần nhất — đây là phần phủ AC4.1 phía template).

- [ ] **Step 4: Thêm dòng mục lục vào `SKILL.md`**

Dòng mới đặt sau dòng `adr` (giữ thứ tự cột `Loại | Template | Validator | Nguồn`):

```
| handoff | [handoff.template.md](references/handoff.template.md) | chưa có | docs/requests/2026-10-21-long-session-context/design.md (D4); Claude Code prompt-caching (session rotation) |
```

Cột Validator/Nguồn phải khớp **từng ký tự** với khối header (contract so sánh trực tiếp). Thêm một gạch đầu dòng vào "Bản đồ tài liệu" mô tả template. Cập nhật số đếm trong `README.md`, `README_VI.md`, `CLAUDE.md`.

- [ ] **Step 5: Chạy, xác nhận xanh**

Run: `node test/validate.mjs --only artifact-templates`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/skills/artifact-templates test/contract/35-artifact-templates.contract.mjs README.md README_VI.md CLAUDE.md
git commit -F - <<'EOF'
feat(core): add handoff template to artifact-templates

Template bàn giao phiên cho việc xoay phiên không kế thừa hội thoại.
EOF
```

### Task 3: Hook `SessionStart`

**Phủ AC:** AC3.1, AC3.2
**Files:**
- Create: `core/hooks/scripts/session-start.mjs`
- Modify: `core/hooks/hooks.json` (thêm event `SessionStart`)
- Modify: `cli/lib/conventions.mjs:224` (`HOOK_EVENTS`)
- Test: `test/contract/90-hooks.contract.mjs`

**Interfaces:**
- Consumes: `readGateConfig(dir)` từ `./gate-config.mjs` (đã có; trả `null` hoặc object JSON của `<git-root>/.claude/aip-gate.json`).
- Produces: `export function decide(input, deps = {}) -> null | { additionalContext: string }` — `main()` bọc thành `{ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }`.

Khoá cấu hình mới trong `.claude/aip-gate.json`, **bật mặc định** (chỉ tắt khi đặt `false`):

| Khoá | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `handoffInject` | boolean | `true` | nạp `handoff.md` khi `source` là `startup`/`clear`/`compact` |
| `resumeWarn` | boolean | `true` | cảnh báo khi `source` là `resume`/`fork` và cache đã nguội |
| `handoffPath` | string | — | đường dẫn tương đối `cwd`; bỏ trống thì tự tìm |
| `handoffMaxAgeHours` | number | `24` | quá tuổi này thì không nạp |

Thứ tự tìm `handoff.md` (dừng ở file đầu tiên tồn tại): `cfg.handoffPath` → `docs/requests/*/handoff.md` có mtime mới nhất → `.claude/handoff.md`.

- [ ] **Step 1: Viết test đỏ**

Thêm vào `90-hooks.contract.mjs`, sau khối import `gate-stop`:

```js
ok(HOOK_EVENTS.includes('SessionStart'), 'AC3.1: HOOK_EVENTS có SessionStart');
```

Rồi một khối import `session-start.mjs` qua `pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', 'session-start.mjs'))` và gọi `decide` với deps giả (`readFile`, `existsSync`, `statSync`, `readdirSync`, `now`, `loadConfig`) — không chạm đĩa thật:

- `AC3.1: startup có handoff → chèn nội dung` — `source: 'startup'`, handoff `# Bàn giao\nNhánh: feature/x` → `additionalContext` chứa `feature/x`.
- `AC3.1: không có handoff → null` — mọi nguồn tìm đều không tồn tại.
- `AC3.1: handoff cũ hơn handoffMaxAgeHours → null` — `now` = mtime + 25 giờ.
- `AC3.1: nội dung dài bị cắt còn 9000 ký tự` — handoff 20.000 ký tự → `additionalContext.length === 9000`.
- `AC3.1: handoff rỗng hoặc chỉ có placeholder → null` — nội dung `< 80` ký tự sau khi bỏ heading.
- `AC3.1: nhiều request → chọn mtime mới nhất` — hai thư mục, cái cũ có tên alphabet đứng trước.
- `AC3.1: source resume không nạp handoff` — `source: 'resume'` + `prompt_cache_likely_expired: false` → `null` dù có handoff.
- `AC3.1: handoffInject false → null`; `AC3.1: lỗi đọc file → null`.
- `AC3.2: resume + cache nguội → một dòng có estimated_cache_write_usd` — `prompt_cache_likely_expired: true`, `context_tokens: 182340`, `estimated_cache_write_usd: 1.1396` → chuỗi chứa `182340` và `1.1396`, không chứa `\n` thứ hai.
- `AC3.2: prompt_cache_likely_expired false hoặc thiếu → null`; `AC3.2: resumeWarn false → null`.

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs --only hooks`
Expected: FAIL — không import được `session-start.mjs`.

- [ ] **Step 3: Viết `core/hooks/scripts/session-start.mjs`**

Theo khung `gate-stop.mjs`: `decide()` bọc toàn bộ trong `try { … } catch { return null }`; `main()` đọc stdin, bỏ BOM (`replace(/^﻿/, '')` — PowerShell 5.1 chèn BOM), in JSON; khối `import.meta.url === pathToFileURL(process.argv[1]).href` chạy `main()`, `catch {}` fail-open, `process.exitCode = 0`, **không** `process.exit()`.

Hằng số: `const MAX_CHARS = 9000;` (dưới cap 10.000 của Claude Code, chừa chỗ cho phần bọc) và `const MIN_CHARS = 80;` (chặn file rỗng/placeholder).

Nhánh `resume`/`fork`: in một dòng dạng `Phiên nguội: mở lại tốn ~<context_tokens> token không cache (~<estimated_cache_write_usd> USD). Cân nhắc mở phiên mới từ <đường dẫn handoff>.` Chỉ dùng trường có trong input; trường nào thiếu thì bỏ phần đó, không bịa số.

Nhánh `startup`/`clear`/`compact`: tìm handoff theo thứ tự ở trên; quá `handoffMaxAgeHours` → `null`; cắt còn `MAX_CHARS`; bọc bằng một dòng dẫn `Handoff của phiên trước (<đường dẫn tương đối>):`.

- [ ] **Step 4: Đăng ký event**

`core/hooks/hooks.json` — một nhóm, **không matcher** (script tự phân nhánh theo `input.source`):

```json
"SessionStart": [ { "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.mjs"], "timeout": 10 } ] } ]
```

`cli/lib/conventions.mjs:224` — thêm `'SessionStart'` vào `HOOK_EVENTS`.

- [ ] **Step 5: Chạy, xác nhận xanh**

Run: `node test/validate.mjs --build --only hooks`
Expected: PASS, gồm cả kiểm `hooks.json` hợp lệ và hook không lọt sang codex/cursor.

- [ ] **Step 6: Commit**

```bash
git add core/hooks cli/lib/conventions.mjs test/contract/90-hooks.contract.mjs
git commit -F - <<'EOF'
feat(core): add SessionStart hook for handoff injection and cold resume warning

Nạp handoff.md khi mở phiên mới và cảnh báo khi resume phiên đã nguội cache;
bật mặc định, tắt bằng handoffInject/resumeWarn trong .claude/aip-gate.json.
EOF
```

### Task 4: `aip stats` đo context từ transcript

**Phủ AC:** AC4.2
**Files:**
- Create: `cli/lib/transcript-stats.mjs`
- Create: `test/transcript-stats.test.mjs`
- Modify: `cli/index.mjs` (import, `case 'stats'`, `buildHelp()`)
- Modify: `package.json` (`test` script thêm `node test/transcript-stats.test.mjs`)
- Modify: `completions/aip.bash:9`, `completions/aip.zsh` (thêm `stats`)
- Test: `test/transcript-stats.test.mjs`

**Interfaces:**
- Produces:
  - `export function projectSlug(cwd: string): string` — `cwd.replace(/[:\\/]/g, '-')`.
  - `export function statsFromLines(lines: string[]): SessionStats`
  - `export function statsForFile(file: string): SessionStats`
  - `export function findTranscripts({ home, cwd }): string[]` — `<home>/.claude/projects/<projectSlug(cwd)>/*.jsonl`.
  - `SessionStats = { turns, firstCtx, peakCtx, peakTurn, lastCtx, chars: { toolResult, toolUse, assistantText, thinking, userText, attachment }, toolResultByTool: Record<string, number>, attachmentByType: Record<string, number> }` (mọi giá trị `chars` tính bằng **ký tự**).
- Task 3 không phụ thuộc module này; Task 6 gọi `aip stats` để viết README.

- [ ] **Step 1: Viết test đỏ**

`test/transcript-stats.test.mjs`, cùng khung `args.test.mjs` (`ok`/`fail`/`process.exit(1)`), dựng transcript bằng chuỗi JSONL viết tại chỗ — không cần file thật:

- `AC4.2: projectSlug('E:\\Mine\\AI\\x') === 'E--Mine-AI-x'`
- `AC4.2: context một lượt = input + cache_read + cache_creation` — hai entry `usage` `{input_tokens: 2, cache_read_input_tokens: 43501, cache_creation_input_tokens: 23846}` → `turns === 1`, `lastCtx === 67349`.
- `AC4.2: tool_result trùng tool_use_id chỉ tính một lần` — hai `tool_result` cùng `tool_use_id`, 100 và 50 ký tự → `chars.toolResult === 100`.
- `AC4.2: hai entry assistant cùng message.id khác block đều được tính` — một entry `thinking` 300 ký tự + một entry `text` 200 ký tự, **cùng** `message.id` → `chars.thinking === 300 && chars.assistantText === 200` (chống hồi quy lỗi design.md:29).
- `AC4.2: attachment tách nhóm riêng` — entry `{type:'attachment', attachment:{type:'skill_listing', …}}` 500 ký tự → `chars.attachment > 0 && chars.toolResult === 0`.
- `AC4.2: dòng JSONL hỏng không làm hỏng báo cáo` — chèn `'{not json'` giữa hai entry hợp lệ → vẫn đọc được cả hai.
- `AC4.2: tổng các nhóm = tổng ký tự nội dung` — cộng 5 nhóm = tổng tính độc lập trên cùng fixture.

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/transcript-stats.test.mjs`
Expected: FAIL — không resolve được `../cli/lib/transcript-stats.mjs`.

- [ ] **Step 3: Viết `cli/lib/transcript-stats.mjs`**

Bỏ qua dòng không parse được (`try { JSON.parse } catch { continue }`). Chỉ đọc `type === 'assistant' | 'user' | 'attachment'`; entry khác (`queue-operation`, `custom-title`, `mode`, `atis-latch`…) bỏ qua.

Dung lượng lượt: lấy từ `message.usage` của entry `assistant`, cộng ba trường; nhiều entry cùng `message.id` → giữ **giá trị lớn nhất** (cùng một request, số phải bằng nhau; giữ max để không đếm hai lần mà cũng không mất lượt).

Nội dung: `tool_use` đếm theo `id` (bỏ id đã thấy), `tool_result` đếm theo `tool_use_id` (bỏ id đã thấy) và gộp theo tên tool lấy từ map `tool_use.id → name`; `attachment` đếm `JSON.stringify(attachment).length` theo `attachment.type`; `text`/`thinking` của assistant và `text` của user đếm thẳng độ dài chuỗi.

- [ ] **Step 4: Nối lệnh `aip stats`**

`cli/index.mjs`: `case 'stats'` → `reportStats(...)`. Không cờ → quét `findTranscripts` của project hiện tại, in bảng `Phiên | lượt | đầu | đỉnh | cuối`, sắp theo `peakCtx` giảm dần, tối đa 10 dòng. `--session <path>` → in phân rã đầy đủ (`chars` từng nhóm + % trên tổng, `toolResultByTool`, `attachmentByType`, `firstCtx`/`peakCtx`/`peakTurn`). `--json` → in JSON thô. Không tìm thấy transcript → in `Không tìm thấy transcript cho <slug>` và trả về bình thường (exit 0).

Ghi rõ trong help: `[Unverified]` layout `<home>/.claude/projects/<slug>/*.jsonl` là nội bộ của Claude Code, không phải hợp đồng công khai.

`package.json`: thêm `node test/transcript-stats.test.mjs` vào chuỗi `test`. `completions/aip.bash:9` và `completions/aip.zsh` thêm `stats`.

- [ ] **Step 5: Chạy, xác nhận xanh**

Run: `node test/transcript-stats.test.mjs && node cli/index.mjs stats`
Expected: `transcript-stats.test: <n> pass`; lệnh in bảng cho project này, không lỗi.

- [ ] **Step 6: Commit**

```bash
git add cli/lib/transcript-stats.mjs test/transcript-stats.test.mjs cli/index.mjs package.json completions
git commit -F - <<'EOF'
feat(cli): add aip stats to measure context from Claude Code transcripts

Đo dung lượng context từ usage, tách nhóm attachment khỏi tool_result;
không loại trùng theo message.id vì đó là các block tách rời.
EOF
```

### Task 5: Mở rộng mục baseline "Model and session routing"

**Phủ AC:** AC1.1, AC1.2, AC2.2, AC4.1
**Files:**
- Modify: `core/agents/AGENTS.template.md:216-248` (mục "Rotating sessions" + mục mới "Long sessions")
- Modify: `AGENTS.md` (chép byte-for-byte)
- Test: `test/content/21-long-session-context.pin.mjs`

**Interfaces:**
- Consumes: đường dẫn `handoff.md` do Task 2 tạo; các khoá `handoffInject`/`resumeWarn` do Task 3 đọc.

- [ ] **Step 1: Viết test đỏ**

`test/content/21-long-session-context.pin.mjs`, theo khung `20-model-session-routing.pin.mjs` (cắt mục giữa `### Model and session routing` và `### ` kế tiếp):

- `AC1.1: mục có quy tắc phiên dài` — mục chứa `handoff.md`, `foreground`, `one line`, `1 hour`, `statusline`.
- `AC1.2: mọi con số có nguồn hoặc nhãn` — mục chứa `[Inference]`, `[Unverified]`, và `code.claude.com/docs/en/prompt-caching`.
- `AC2.2: nêu ai đọc được % context` — mục chứa `statusline` và `hook` trong **cùng** một dòng, và dòng đó chứa `cannot`.
- `AC4.1: có quy tắc ghi % context ở cổng phase` — mục chứa `/usage`.
- `AC1.1: AGENTS.md == AGENTS.template.md` — đọc cả hai, so sau khi chuẩn hoá CRLF (contract `30-templates` đã kiểm; pin này chỉ giữ cho lần sửa này, xoá khi rule đã thành contract).
- `AC5.1: README EN/VI nêu tên cấu hình nén` — cả `README.md` và `README_VI.md` chứa `autoCompactWindow` và `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (tên biến môi trường là hợp đồng vận hành, không phải văn xuôi tài liệu).
- `AC6.1: test mới thật sự chạy trong CI` — `JSON.parse(package.json).scripts.test` chứa `transcript-stats.test.mjs`; test viết ra mà không nối vào `npm test` là lỗi không chỗ nào khác bắt.

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs --only long-session-context`
Expected: FAIL.

- [ ] **Step 3: Sửa quy tắc 4 và thêm mục "Long sessions"**

Quy tắc 4 hiện có: đổi cụm "write a handoff (branch, hash, unfinished work, pending questions) to the ledger/run-log" thành trỏ tới `handoff.md` (template trong `core:artifact-templates`), thêm ngưỡng cứng ~60% bên cạnh mềm ~40%, và thêm câu: only a human or the statusline can read the percentage (`context_window.used_percentage`); a hook cannot — no hook input carries the context size.

Thêm mục con `**Long sessions**` **sau** khối "Parallelism" (quy tắc 13, cuối mục), đánh số tiếp 14–18, mỗi quy tắc 1–2 dòng:

14. A child session writes its long report to a file and sends the parent one line with the path and the conclusion. The orchestrating session never reads long diffs or logs itself; a `haiku` subagent reads and returns the summary.
15. Every command in the orchestrating session bounds its output (`--stat`, `head`, column filters); list sessions by name or id rather than a full listing; never repeat `get_usage`/`list_events` within one gate.
16. When the next step depends on a subagent's result, run it in the foreground instead of ending the turn to wait for a background notification.
17. A session idle longer than the prompt-cache TTL (1 hour for the main session on a subscription) is cheaper to replace than to wake: open a new session from `handoff.md`. Never switch model mid-session (rule 1).
18. Record each session's context usage (`/usage` or the statusline's `used_percentage`) in the run-log at every phase gate.

Mỗi con số kèm link: TTL → `prompt-caching#cache-lifetime`; ngưỡng 40/60 → `[Inference]`; hook không đọc được → `hooks#common-input-fields` + `statusline`.

- [ ] **Step 4: Chép sang `AGENTS.md`**

Copy nguyên nội dung `core/agents/AGENTS.template.md` sang `AGENTS.md` (không sửa tay hai nơi).

- [ ] **Step 5: Chạy, xác nhận xanh**

Run: `node test/validate.mjs --only long-session-context && node test/validate.mjs --only templates`
Expected: PASS cả hai (không drift `AGENTS.md`).

- [ ] **Step 6: Commit**

```bash
git add core/agents/AGENTS.template.md AGENTS.md test/content/21-long-session-context.pin.mjs
git commit -F - <<'EOF'
docs(baseline): add long-session rules to model and session routing

Báo cáo dài ghi file, giới hạn đầu ra lệnh, chạy foreground, xoay phiên
bằng handoff.md, phiên rảnh quá TTL thì mở phiên mới.
EOF
```

### Task 6: README, version và toàn bộ test

**Phủ AC:** AC5.1, AC6.1
**Files:**
- Modify: `README.md` (`## Hooks`, `## CLI`, mục mới về `autoCompactWindow`)
- Modify: `README_VI.md` (tương ứng)
- Modify: `core/.manifest.json` (bump minor)
- Modify: `plugins/_versions.lock.json` (sinh bằng `--lock`)
- Modify: `CHANGELOG.md` (mục `Unreleased`)
- Test: `test/content/21-long-session-context.pin.mjs` (thêm assertion AC5.1, AC6.1)

- [ ] **Step 1: Viết mục README về `autoCompactWindow`**

Trong `README.md` (và bản VI), thêm mục nói rõ: bốn cách đặt ngưỡng nén (`/autocompact <100k–1M>`, `autoCompactWindow` trong settings, `--autocompact`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW` — ưu tiên cao nhất, `k`/`M` từ v2.1.304), mặc định model cửa sổ 1M nén ở ~967K, và **đánh đổi**: trần mỗi request thấp hơn nhưng nén nhiều lần hơn và mỗi lần nén mất chi tiết. Câu bắt buộc: **aip does not write your settings** — đây là cấu hình của bạn. Cảnh báo: khi đặt `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `used_percentage` của statusline vẫn đo trên cửa sổ đầy nên không còn chỉ đúng lúc nén chạy.

Thêm vào `21-long-session-context.pin.mjs` hai assertion mang nhãn AC5.1 và AC6.1 (cả hai file README chứa `autoCompactWindow` và `CLAUDE_CODE_AUTO_COMPACT_WINDOW`; `JSON.parse(package.json).scripts.test` chứa `transcript-stats.test.mjs`); chạy `node test/validate.mjs --only long-session-context` và xác nhận **đỏ** trước khi viết README.

- [ ] **Step 2: Viết mục README cho hook `SessionStart` và `aip stats`**

`## Hooks`: thêm dòng vào bảng quy tắc + một đoạn mô tả `session-start` (hai chế độ, thứ tự tìm handoff, `handoffMaxAgeHours`, cap 9.000 ký tự, bật mặc định, tắt bằng `handoffInject`/`resumeWarn`). `## CLI`: thêm `aip stats [--session <path>] [--json]` + nhãn `[Unverified]` cho layout `~/.claude/projects/<slug>/`.

- [ ] **Step 3: Bump version và khoá**

Sửa `core/.manifest.json` `version` từ `1.8.8` lên `1.9.0` (thêm template + hook + mục baseline). Rồi:

Run: `npm run build && node cli/lib/versions.mjs --lock`
Expected: `Đã ghi plugins/_versions.lock.json`; không dòng `✗ … version chưa bump`.

- [ ] **Step 4: Chạy toàn bộ test**

Run: `npm test`
Expected: `KẾT QUẢ: <n> pass, 0 fail`, `install.test`/`wizard.test`/`managed-block.test`/`init.test`/`pack-guard.test`/`args.test`/`transcript-stats.test` đều xanh.

- [ ] **Step 5: Chạy validator request**

Run: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-long-session-context`
Expected: không còn `[W7]` (mọi AC đã có test nhắc tới) và không `[W9]`.

- [ ] **Step 6: Commit**

```bash
git add README.md README_VI.md CHANGELOG.md core/.manifest.json plugins/_versions.lock.json
git commit -F - <<'EOF'
docs(release): document long-session rules, compaction window and aip stats

README nêu đánh đổi autoCompactWindow và aip không ghi settings người dùng;
core lên 1.9.0, cập nhật versions lock.
EOF
```

---

## Self-Review

**Spec coverage:** AC1.1/AC1.2/AC2.2 → Task 5; AC2.1 → Task 2; AC3.1/AC3.2 → Task 3; AC4.1 → Task 2 (template) + Task 5 (baseline); AC4.2 → Task 1 (đặc tả) + Task 4 (công cụ); AC5.1 → Task 6; AC6.1 → Task 6. Không AC nào thiếu task.

**Ngoài phạm vi có chủ đích** (design đã loại): hook `Stop` đo context từ transcript, hook `PreCompact` chặn nén, hạ `autoCompactWindow` thay người dùng, công cụ đo tách repo riêng (đã chốt làm trong aip).

**Type consistency:** `decide()` của hook trả `{ additionalContext }`; `main()` bọc thành `hookSpecificOutput`. `statsFromLines`/`statsForFile` cùng trả `SessionStats`. Tên khoá cấu hình `handoffInject`/`resumeWarn`/`handoffPath`/`handoffMaxAgeHours` dùng thống nhất ở Task 3, 5, 6.

**Điểm cần người duyệt:** ngưỡng `MIN_CHARS = 80` và `handoffMaxAgeHours = 24` là số chọn theo kinh nghiệm, chưa đo; nếu thấy quá chặt thì chỉnh trong Task 3 trước khi commit.
