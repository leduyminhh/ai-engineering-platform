# Theo dõi mức dùng và chi phí từ transcript (P5c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm `aip stats --usage [--since]` tổng hợp token và tiền theo model, phiên chính so với subagent, và tín hiệu cache từ transcript Claude Code.
**Architecture:** Một module mới `cli/lib/transcript-usage.mjs` gồm hàm thuần (parse dòng → lượt, gộp phiên + tín hiệu, dựng báo cáo) và một hàm đọc đĩa tách riêng; `args.mjs` và `index.mjs` chỉ nối cờ và in bảng. Tiền lấy từ dòng `cost-state` của Claude Code, aip không có bảng giá. Không đổi `transcript-stats.mjs` hay các chế độ `aip stats` cũ.
**Tech Stack:** Node.js 20+ built-ins (ESM), test tự viết kiểu `ok(cond, msg)` như `test/transcript-stats.test.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; README EN/VI.
- Chỉ đọc `~/.claude/projects/<slug>/` của project hiện tại (qua `findTranscripts`); không ghi file; không in nội dung hội thoại: đầu ra chỉ có số, tên model, `sessionId`, tên agent, tên file transcript.
- Test dùng fixture tự dựng, không đọc transcript thật; tên test mang tiền tố `P5c ACx.y:` để không trùng ID AC của pin cũ.
- Mọi khẳng định về layout transcript và ý nghĩa `cost-state` giữ nhãn `[Unverified]`; không bảng giá, không dự đoán hạn mức.
- Không `rm -rf` thư mục có junction trên Windows; dọn bằng `fs.rmSync`.
- Không bump version trừ khi `node cli/lib/versions.mjs --lock` buộc (chỉ ở Task 5, không sửa tay file lock).
- Nhánh hiện tại (`claude/p5c-cost-tracking-3161b4`, tương ứng `feature/p5c-cost-tracking` trong design), commit mỗi task qua `core:git-workflow` (header tiếng Anh, thân tiếng Việt có dấu, `git commit -F` từ file ngoài repo, không Co-Authored-By); không push, không merge.
- Ngưỡng tín hiệu cache: khoảng nghỉ > 60 phút; cache tạo > 50% context; "cache tạo lớn" của tín hiệu khoảng nghỉ = `cache_creation_input_tokens >= 10000` (Ruling của plan, hằng `LARGE_CACHE_CREATE`).
- Cửa sổ `--since` mặc định 7 ngày; thiếu `cost-state` hiển thị `—` (không ước tính).

## Review Focus

- `cost-state` thiếu, hoặc `hasUnknownModelCost: true`, hoặc `modelUsage` thiếu một model: tiền `null`/`—`, không ném lỗi, nhãn "có model chưa rõ giá" (Task 2, 4).
- File rỗng, dòng cuối dở, phiên chỉ có dòng không phải `assistant`, `message.model` là `<synthetic>`, dòng `assistant` thiếu `usage`: không lỗi, tất cả bằng 0 (Task 1, 2).
- Cùng `sessionId` xuất hiện ở hai file (resume/fork) hoặc cùng `message.id` ở hai file: token và tiền không bị đếm đôi (Task 2, 3).
- Thư mục `subagents/` không tồn tại, `.meta.json` hỏng hoặc thiếu `agentType`, file subagent không đọc được: quay về `agentId`/bỏ qua, không làm hỏng báo cáo (Task 3).
- `--since` ở tương lai hoặc sai định dạng (`0`, `-3`, `2026-13-40`, `abc`): ở tương lai cho báo cáo rỗng; sai định dạng in cách dùng và exit 2 (Task 4).
- Đầu ra không chứa văn bản người dùng/kết quả công cụ/`description` của meta, và không tạo file (Task 4).

---

### Task 1: Parse dòng transcript thành lượt dùng
**Phủ AC:** AC1.2
**Files:**
- Create: `cli/lib/transcript-usage.mjs`
- Test: `test/transcript-usage.test.mjs`
- Modify: `package.json` (nối `&& node test/transcript-usage.test.mjs` vào cuối script `test`; kiểm `.github/workflows` xem CI có liệt kê test riêng không và cập nhật nếu có)

**Interfaces:**
- Produces:
  - `export const LARGE_CACHE_CREATE = 10000`, `export const IDLE_GAP_MS = 60 * 60 * 1000`.
  - `export function parseUsageLines(lines: string[]): { sessionId: string | null, turns: Turn[], costStates: CostState[] }`.
  - `Turn = { id: string, model: string, ts: number | null, usage: Usage }` — `ts` là epoch ms từ `timestamp` của dòng (null nếu thiếu/không hợp lệ); `Usage = { input, cacheRead, cacheCreate, cacheCreate1h, cacheCreate5m, output }` (số, mặc định 0; `cacheCreate1h/5m` lấy từ `usage.cache_creation.ephemeral_1h_input_tokens/ephemeral_5m_input_tokens`). Mỗi `message.id` chỉ một `Turn` (giá trị lớn nhất từng trường, `ts` nhỏ nhất); không có `message.id` thì mỗi dòng một lượt riêng; thứ tự theo lần xuất hiện đầu tiên.
  - `CostState = { totalCostUSD: number, hasUnknownModelCost: boolean, modelUsage: { [model: string]: { costUSD: number } } }` từ dòng `type: "cost-state"` có `totalCostUSD` là số; `sessionId` là `sessionId` của dòng đầu tiên có trường đó.

- [x] **Step 1: Viết test (đỏ).** Tạo `test/transcript-usage.test.mjs` theo khuôn `test/transcript-stats.test.mjs` (`ok`, `fails`, fixture `j()`), tên mang `P5c AC1.2:`. Kiểm: hai dòng cùng `message.id` với `usage` khác nhau → một `Turn` với max từng trường; dòng `model: '<synthetic>'` và dòng không có `usage` hoặc không có `model` bị bỏ; `cache_creation` tách 1h/5m đọc đúng; `timestamp` hỏng → `ts: null`; dòng JSON hỏng và dòng cuối dở bị bỏ qua; `cost-state` đọc đúng `totalCostUSD`, `hasUnknownModelCost`, `modelUsage[m].costUSD`; `sessionId` lấy từ dòng đầu có trường đó.
- [x] **Step 2: Chạy `node test/transcript-usage.test.mjs`.** Mong đợi: FAIL (thiếu module).
- [x] **Step 3: Hiện thực** `parseUsageLines` trong `cli/lib/transcript-usage.mjs` (header comment nhắc layout là `[Unverified]`, nội bộ Claude Code; dùng cùng cách bỏ dòng JSON hỏng như `statsFromLines`).
- [x] **Step 4: Chạy lại test.** Mong đợi: PASS.
- [x] **Step 5: Commit** `feat(cli): parse transcript lines into usage turns` qua `core:git-workflow`.

### Task 2: Gộp một phiên và đếm tín hiệu cache
**Phủ AC:** AC1.1, AC1.3, AC1.4
**Files:**
- Modify: `cli/lib/transcript-usage.mjs`
- Test: `test/transcript-usage.test.mjs`

**Interfaces:**
- Consumes: `parseUsageLines`, `Turn`, `Usage`, `CostState`, `LARGE_CACHE_CREATE`, `IDLE_GAP_MS` (Task 1).
- Produces:
  - `export function buildSessionUsage(sessionId: string, parts: Array<{ agent: string | null, file: string, parsed: ReturnType<typeof parseUsageLines> }>, opts?: { sinceMs?: number | null }): SessionUsage | null`. `agent: null` là phiên chính, ngược lại là tên agent (đã chọn ở Task 3). Nhiều `parts` cùng phiên (resume/fork) được gộp: `message.id` trùng giữa các file chỉ tính một lần theo cùng quy tắc max/min của Task 1; `cost-state` chọn bản có `totalCostUSD` lớn nhất trên toàn bộ `parts`. Với `sinceMs` số: bỏ lượt có `ts` null hoặc `< sinceMs`; trả `null` nếu sau lọc không còn lượt nào.
  - `SessionUsage = { sessionId, files: string[], costUsd: number | null, unknownModelCost: boolean, firstTs: number | null, lastTs: number | null, byModel: { [model]: Usage & { turns: number, costUsd: number | null } }, main: Usage & { turns: number }, bySubagent: { [agent]: Usage & { turns: number } }, subagentShare: number, signals: Signals }`.
  - `costUsd` = `totalCostUSD` lớn nhất, `null` nếu không có `cost-state`; `unknownModelCost` = `hasUnknownModelCost` của bản đó; `byModel[m].costUsd` = `modelUsage[m].costUSD` của bản đó (`null` nếu không có). `subagentShare` = token subagent / token tổng, với token = `input + cacheRead + cacheCreate + output` (0 khi tổng bằng 0).
  - `Signals = { modelSwitches: { count, tokens }, idleGaps: { count, tokens }, cacheHeavy: { count, tokens } }`. Chuỗi = phiên chính hoặc một agent, sắp theo thứ tự lượt. `modelSwitches`: lượt có model khác lượt liền trước cùng chuỗi, `tokens` = `cacheCreate` của lượt sau. `idleGaps`: chỉ chuỗi phiên chính, lượt có `ts` cách lượt trước `> IDLE_GAP_MS` và `cacheCreate >= LARGE_CACHE_CREATE`, `tokens` = `cacheCreate` của lượt đó. `cacheHeavy`: mọi chuỗi, lượt có `cacheCreate * 2 > input + cacheRead + cacheCreate`, `tokens` = `cacheCreate`. Một lượt có thể vào nhiều tín hiệu.

- [x] **Step 1: Viết test (đỏ).** Tên mang `P5c AC1.1:`, `P5c AC1.3:`, `P5c AC1.4:`. Bảng tham số hóa theo chuỗi fixture:
  - AC1.1: ba `cost-state` tăng dần (1, 3, 2 theo thứ tự dòng) → `costUsd === 3`; không có `cost-state` → `costUsd === null`; `hasUnknownModelCost: true` → `unknownModelCost === true`; `byModel[m].costUsd` lấy từ bản lớn nhất.
  - AC1.3: hai agent (`reviewer`, và một agent không có tên dùng `agentId` như `a0c291f1eec1ef53d`) + phiên chính → `bySubagent` có đúng hai khóa, `main` không lẫn token subagent, `subagentShare` đúng phép chia; token vẫn vào `byModel` theo model của lượt.
  - AC1.4: đổi model giữa hai lượt cùng chuỗi → `modelSwitches {1, cacheCreate lượt sau}`; nghỉ 61 phút với `cacheCreate` 20000 → `idleGaps {1, 20000}`, nghỉ 59 phút hoặc `cacheCreate` 9999 → 0; lượt `cacheCreate 600, cacheRead 300, input 100` → `cacheHeavy` đúng một, lượt `cacheCreate 500, cacheRead 500` (đúng 50%) → không tính; chuỗi không có hiện tượng nào → ba tín hiệu `{count: 0, tokens: 0}`; model đổi giữa phiên chính và subagent không tính là đổi model.
  - Gộp: cùng `message.id` ở hai `parts` → tính một lần; `sinceMs` loại lượt cũ và lượt `ts` null, và trả `null` khi hết lượt.
- [x] **Step 2: Chạy `node test/transcript-usage.test.mjs`.** Mong đợi: FAIL (thiếu hàm).
- [x] **Step 3: Hiện thực** `buildSessionUsage` theo Interfaces; comment chỉ nêu vì sao: tiền lấy bản lớn nhất vì `cost-state` là bộ đếm tích lũy, và vì sao không tách tiền subagent (`cost-state` của phiên gốc đã gồm subagent, `[Inference]`, kết luận ở design).
- [x] **Step 4: Chạy lại test.** Mong đợi: PASS.
- [x] **Step 5: Commit** `feat(cli): aggregate session usage and cache signals` qua `core:git-workflow`.

### Task 3: Đọc đĩa, gộp theo phiên, dựng báo cáo
**Phủ AC:** AC1.1, AC1.2, AC1.3 (phía đĩa), AC2.1 (nội dung báo cáo)
**Files:**
- Modify: `cli/lib/transcript-usage.mjs`
- Test: `test/transcript-usage.test.mjs`

**Interfaces:**
- Consumes: `findTranscripts({ home, cwd })` từ `cli/lib/transcript-stats.mjs`; `parseUsageLines`, `buildSessionUsage`, `SessionUsage` (Task 1–2).
- Produces:
  - `export function parseSince(value: string | undefined, nowMs: number): number | null` — `undefined` → `nowMs - 7 ngày`; chuỗi `^\d+$` > 0 → `nowMs - n ngày`; `yyyy-mm-dd` hợp lệ (kiểm ngày tồn tại) → `Date.UTC(y, m-1, d)`; còn lại `null`.
  - `export function loadSessionUsage({ home, cwd, sinceMs }: { home: string, cwd: string, sinceMs: number | null }): SessionUsage[]` — mỗi `*.jsonl` ở thư mục project là một phần của phiên (tên phiên = `sessionId` của dòng đầu, rơi về tên file không đuôi); mọi `agent-*.jsonl` trong `<thư-mục-project>/<tên-file-không-đuôi>/subagents/` là phần subagent; tên agent = `agentType` (chuỗi không rỗng) trong `agent-<id>.meta.json` cùng thư mục, rơi về `<id>` của tên file khi meta thiếu/hỏng/thiếu khóa; không bao giờ đọc `description` hay trường khác của meta. File/thư mục không đọc được bị bỏ qua. Các file cùng `sessionId` gộp thành một `SessionUsage`; kết quả bỏ `null`.
  - `export function buildUsageReport(sessions: SessionUsage[], opts: { sinceMs: number | null, top?: number }): UsageReport` với `UsageReport = { sinceMs, sessions: number, totals: Usage & { turns: number, costUsd: number | null, unknownModelCost: boolean, subagentShare: number }, byModel: Array<{ model, turns, input, cacheRead, cacheCreate, cacheCreate1h, cacheCreate5m, output, cacheReadPct: number, costUsd: number | null }>, bySubagent: Array<{ agent, turns, input, cacheRead, cacheCreate, output }>, signals: Signals, top: Array<{ sessionId, costUsd, turns, subagentShare, files, signals, unknownModelCost }> }`. `byModel` sắp theo token giảm dần; `cacheReadPct` = `cacheRead / (input + cacheRead + cacheCreate)` (0 khi mẫu số 0); `costUsd` tổng chỉ cộng phiên có tiền, `null` khi không phiên nào có; `top` mặc định 5, sắp theo `costUsd` giảm dần (`null` xếp sau, rồi theo token tổng).

- [x] **Step 1: Viết test (đỏ).** Tên mang `P5c AC1.1:`, `P5c AC1.2:`, `P5c AC1.3:`, `P5c AC2.1:`. Dựng thư mục `HOME` tạm (`fs.mkdtempSync`, dọn bằng `fs.rmSync`) theo mẫu của `transcript-stats.test.mjs`: hai phiên, một phiên có `subagents/` (một agent có meta `agentType`, một agent meta hỏng, một agent không có meta, `description` trong meta chứa chuỗi nhận diện), một phiên chia hai file cùng `sessionId`. Kiểm: số phiên và tổng token; phiên chia hai file không đếm đôi tiền; tên agent đúng và `description` không xuất hiện ở `JSON.stringify(report)`; `parseSince` bảng tham số hóa (`undefined`, `'3'`, `'2026-10-01'`, `'0'`, `'-3'`, `'abc'`, `'2026-13-40'`, `'2026-02-30'`); `buildUsageReport`: sắp `top` đúng, phiên không tiền xếp sau, `top` giới hạn 5 khi có 7 phiên; `sinceMs` ở tương lai → `sessions: 0`, `byModel: []`, `totals.costUsd === null`.
- [x] **Step 2: Chạy `node test/transcript-usage.test.mjs`.** Mong đợi: FAIL.
- [x] **Step 3: Hiện thực** ba hàm theo Interfaces trong `transcript-usage.mjs`; dùng lại `findTranscripts`, không sửa `transcript-stats.mjs`.
- [x] **Step 4: Chạy lại test.** Mong đợi: PASS.
- [x] **Step 5: Commit** `feat(cli): load transcript usage from disk and build report` qua `core:git-workflow`.

### Task 4: Cờ `--usage`/`--since` và bảng `aip stats --usage`
**Phủ AC:** AC2.1, AC2.2, AC2.3
**Files:**
- Modify: `cli/lib/args.mjs`, `cli/index.mjs` (hàm `reportStats`/case `stats`, text trợ giúp dòng `stats`)
- Test: `test/args.test.mjs`, `test/transcript-usage.test.mjs`

**Interfaces:**
- Consumes: `parseSince`, `loadSessionUsage`, `buildUsageReport`, `UsageReport` (Task 3); `os.homedir()` như `reportStats` cũ.
- Produces:
  - `parse()` đặt `usage: true` cho `--usage`, `since: <chuỗi>` cho `--since <v>` và `--since=<v>`; không đặt `explicit`.
  - `reportUsage({ since, json, now? }): number` trong `cli/index.mjs` (hoặc module riêng nếu `index.mjs` quá dài): trả exit code; `--json` in `JSON.stringify(report, null, 2)` với `UsageReport` nguyên (khóa ổn định như Task 3); bảng text gồm dòng tổng (số phiên, tiền hoặc `—`, phần subagent %), bảng theo model (cột lượt, input, cache đọc, cache tạo, output, %cache đọc, tiền), dòng tín hiệu (3 số lần + token), bảng top 5 phiên (tên phiên, tiền hoặc `—`, lượt, phần subagent, số tín hiệu), nhãn "có model chưa rõ giá" khi `unknownModelCost`, và một dòng nói tiền là `cost-state` cả phiên (gồm subagent) không chia theo cửa sổ + `[Unverified]`. `--since` sai định dạng: in cách dùng (`--since <số ngày|yyyy-mm-dd>`) ra stderr, exit 2. Không có transcript → in thông báo như chế độ cũ và exit 0.
  - `aip stats --usage --session <f>` in lỗi rõ ra stderr và exit 2; `aip stats --since ...` không kèm `--usage` cũng exit 2 với thông báo rõ.

- [x] **Step 1: Viết test (đỏ).** `test/args.test.mjs`: `parse(['stats','--usage','--since','3','--json'])` cho `usage === true`, `since === '3'`, `json === true`; dạng `--since=2026-10-01`; `parse(['stats'])` không có `usage`/`since` (tên `P5c AC2.2:`). `test/transcript-usage.test.mjs`: chạy `node cli/index.mjs stats ...` bằng `execFileSync` với `cwd` và `HOME`/`USERPROFILE` là thư mục tạm có fixture (tên `P5c AC2.1:`, `P5c AC2.2:`, `P5c AC2.3:`): bảng chứa tên model fixture và tiền `—` cho phiên không có `cost-state`; `--json` parse được và đủ khóa của `UsageReport`; `--since abc` exit 2 và stderr có `--since`; `--usage --session x` exit 2; `--since 3` không `--usage` exit 2; `stats` không cờ vẫn in bảng context cũ (tiêu đề `Phiên`). AC2.3: fixture có dòng `user` chứa chuỗi `SECRET-USER-TEXT`, `tool_result` chứa `SECRET-TOOL-OUT`, meta `description` chứa `SECRET-META-DESC` → cả ba không có trong stdout bảng lẫn `--json`; danh sách file (đệ quy) của thư mục `HOME` tạm trước và sau lệnh giống hệt.
- [x] **Step 2: Chạy `node test/args.test.mjs && node test/transcript-usage.test.mjs`.** Mong đợi: FAIL.
- [x] **Step 3: Hiện thực** cờ trong `parse()` (cùng khuôn `--session`) và `reportUsage` + nối vào case `stats`; cập nhật dòng trợ giúp `stats` trong `buildHelp()` nêu `--usage`, `--since`, tiền từ `cost-state` của Claude Code, `[Unverified]`. Căn cột bằng `padEnd`/`padStart` như bảng cũ; không đổi hành vi chế độ cũ.
- [x] **Step 4: Chạy lại hai test.** Mong đợi: PASS; chạy `node test/transcript-stats.test.mjs` vẫn PASS (không hồi quy).
- [x] **Step 5: Commit** `feat(cli): add aip stats --usage` qua `core:git-workflow`.

### Task 5: Tài liệu, spec sống, đồng bộ trạng thái, kiểm chứng cuối
**Phủ AC:** AC3.1, AC4.1, AC5.1, AC6.1
**Files:**
- Create: `docs/specs/cli-wizard/spec.md` (theo `core/skills/artifact-templates/references/spec.template.md`, bỏ khối header `<!-- artifact-template … -->`)
- Modify: `README.md`, `README_VI.md`, `CLAUDE.md` (dòng lệnh `aip stats`), `docs/specs/README.md` (chỉ nếu bảng cần thêm trạng thái; giữ đủ 7 năng lực), `docs/requests/2026-10-21-aip-trends-master-spec/design.md` (bảng trace xu hướng 6 và 9, trạng thái P3 và P5c), `docs/requests/2026-10-22-parallel-agents/design.md` (header ghi merge `480edd2`), `docs/requests/2026-10-22-cost-tracking/design.md` (header: trạng thái hoàn thành, tick AC), `docs/requests/2026-10-22-cost-tracking/plan.md` (tick checkbox)
- Test: `test/content/` — thêm một pin mới (số thứ tự kế tiếp theo thư mục, tên mang `P5c AC3.1:`) kiểm đoạn neo README EN/VI và dòng `CLAUDE.md`
- Cập nhật nếu cần: `plugins/_versions.lock.json` chỉ qua `node cli/lib/versions.mjs --lock`

**Interfaces:**
- Consumes: hành vi và tên cờ của Task 4.
- Produces: không có (task cuối).

- [x] **Step 1: Viết pin đỏ.** Pin kiểm: `README.md` và `README_VI.md` mục `aip stats` chứa `--usage`, `--since`, `cost-state`, `[Unverified]`, và câu nói aip không có bảng giá/không dự đoán hạn mức (neo bằng cụm từ ổn định, một bản cho mỗi ngôn ngữ); `CLAUDE.md` dòng lệnh `aip stats` chứa `--usage`.
- [x] **Step 2: Chạy `node test/validate.mjs --only <tên pin>`.** Mong đợi: FAIL.
- [x] **Step 3: Viết tài liệu.** README EN/VI và `CLAUDE.md` mô tả cờ mới (tiền = `cost-state` của Claude Code gồm cả subagent, không bảng giá, không dự đoán hạn mức, `[Unverified]` cho layout và ý nghĩa `cost-state`). Tạo `docs/specs/cli-wizard/spec.md` với `cli-wizard/R1` (tổng hợp token theo model từ transcript, chỉ đọc, `--since`), `cli-wizard/R2` (tiền lấy từ `cost-state`, không bảng giá, thiếu thì `—`), `cli-wizard/R3` (không in nội dung hội thoại, không ghi file); chỉ yêu cầu mới, không backfill. Đồng bộ spec tổng (P3 xong, merge `480edd2`; P5c xong, ghi "hash khi merge" nếu chưa merge) và header design P3 (AC5.1).
- [x] **Step 4: Chạy lại pin.** Mong đợi: PASS.
- [x] **Step 5: Kiểm chứng toàn bộ.** `npm run build`, `node cli/lib/versions.mjs --lock` (nếu từ chối vì nội dung plugin đổi mà version không đổi thì bump đúng một lần rồi chạy lại; nếu không đổi hash thì không bump), `npm test`, `npm run pack:verify`, `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-22-cost-tracking` (không W10–W14), `node core/skills/artifact-templates/scripts/check-partition.mjs docs/requests/2026-10-22-cost-tracking`. Mong đợi: tất cả xanh/không cảnh báo; ghi kết quả thật vào báo cáo.
- [x] **Step 6: Commit** `docs(cli): document aip stats --usage and add cli-wizard spec` qua `core:git-workflow`.
