# Điều hướng model và phiên Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi agent của plugin khai `model` (mặc định `sonnet`), validate chặn agent thiếu/sai `model`, baseline có mục "Model and session routing", README hướng dẫn `CLAUDE_CODE_SUBAGENT_MODEL`.
**Architecture:** Loader (`cli/lib/plugins.mjs:266`) và adapter Claude (`adapters/_shared/agents.mjs:25`) đã đọc và chiếu khoá `model`; Codex/Cursor/Antigravity không chiếu khoá này và giữ nguyên. Thêm hàm thuần `checkAgentModel` trong `cli/lib/conventions.mjs` chạy trong contract cho mọi agent và template agent; nội dung quy tắc nằm ở managed block `core/agents/AGENTS.template.md`.
**Tech Stack:** Node 20+ ESM, chỉ built-in; harness `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; baseline viết tiếng Anh; README.md tiếng Anh, README_VI.md tiếng Việt có dấu.
- Giá trị `model` hợp lệ: `sonnet`, `opus`, `haiku`, `fable`, `inherit`, hoặc model ID khớp `/^claude-[a-z0-9.-]+$/`. `inherit` chỉ hợp lệ khi body agent chứa chữ `inherit` (lý do ghi trong body).
- Cả 16 agent trong `plugins/*/agents/*.md` dùng `model: sonnet` + `effort: high` (design §3, quyết định người dùng 2026-10-21); không agent nào đặt `opus`/`haiku` cứng.
- Ràng buộc effort theo model trong `checkAgentModel`: `sonnet` → `effort` bắt buộc `high`; `opus` → `effort` thiếu hoặc `medium`/`high`; `haiku`/`fable`/`inherit`/model ID → không ràng buộc.
- `AGENTS.md` gốc giống byte-for-byte `core/agents/AGENTS.template.md`.
- Mọi con số trong mục baseline (TTL 1 giờ/5 phút, hệ số ~4×/~15×, thứ tự chọn model) có link nguồn chính thức như trong design §"Sự thật đã kiểm", hoặc nhãn [Unverified].
- Không đặt `CLAUDE_CODE_SUBAGENT_MODEL` thay người dùng (D6); không thêm hook (D7).
- Tên test bắt đầu bằng ID AC. Giữa các task chỉ chạy test có mục tiêu; `npm test` toàn bộ xanh sau Task 3.
- Commit mỗi task qua `core:git-workflow` (`git commit -F`), không dòng `Co-Authored-By`.

## Review Focus

- Agent có `model` là chuỗi rỗng hoặc viết hoa (`Sonnet`) → lỗi, không lọt → test ở Task 1.
- Model ID dạng `claude-sonnet-5-5` hợp lệ; `gpt-4o` không hợp lệ → test ở Task 1.
- `inherit` không có lý do trong body → lỗi; có chữ `inherit` trong body → hợp lệ → test ở Task 1.
- Build Codex/Cursor/Antigravity không sinh khoá `model` mới (hành vi giữ nguyên) → test ở Task 1.
- Template agent (`agent.template.md`) được điền mẫu vẫn qua kiểm `model` → test ở Task 1.

---

### Task 1: Khai `model` cho 16 agent + kiểm `checkAgentModel`

**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Modify: `plugins/*/agents/*.md` (16 file, thêm `model: sonnet` vào frontmatter, sau `mode`)
- Modify: `core/skills/artifact-templates/references/agent.template.md` (frontmatter thêm `model: sonnet`)
- Modify: `cli/lib/conventions.mjs`, `test/context.mjs` (export qua `ctx` như `checkAgentTools`)
- Test: `test/contract/40-conventions.contract.mjs`

**Interfaces:**
- Produces: `export function checkAgentModel(agent: { id, model, body }): string[]` — rỗng khi hợp lệ; thông điệp nêu id agent.

- [x] **Step 1: Viết test đỏ** — trong `40-conventions.contract.mjs` (tìm chỗ đang chạy `checkAgentTools` trên mọi agent và đặt cạnh đó):
  - `AC1.2: checkAgentModel` tham số hoá: hợp lệ — `sonnet`, `opus`, `haiku`, `fable`, `claude-sonnet-5-5`, `inherit` với body chứa "inherit vì …"; lỗi — thiếu (`null`), `''`, `Sonnet`, `gpt-4o`, `inherit` với body không nhắc inherit. Mỗi lỗi chứa id agent.
  - `AC1.1: mọi agent nguồn khai model hợp lệ` — `checkAgentModel` rỗng cho mọi agent trong `ctx.allAgents`, và `model === 'sonnet'` cho cả 16.
  - `AC1.3: build Claude mang model, provider khác không đổi` — khi có build: mỗi agent Claude sinh ra (`build/claude/plugins/<plugin>/agents/<id>.md`) có dòng `model: sonnet`; không file nào dưới `build/codex`, `build/cursor`, `build/antigravity` chứa dòng bắt đầu `model:` hoặc `model =`.
  - Template agent: thêm kiểm `checkAgentModel` cạnh `checkAgentTools` ở `35-artifact-templates.contract.mjs:138` (tên `AC1.1: template agent khai model`).
- [x] **Step 2: Chạy, xác nhận đỏ** — `node test/validate.mjs --build --only conventions` và `--only artifact-templates`.
- [x] **Step 3: Viết `checkAgentModel`, thêm `model: sonnet` vào 16 agent + template agent.**
- [x] **Step 4: Chạy, xác nhận xanh** — cùng lệnh Step 2.
- [x] **Step 5: Commit** — `feat(agents): declare model for every plugin agent`.

### Task 2: Mục baseline "Model and session routing" + README

**Phủ AC:** AC2.1, AC2.2, AC3.1
**Files:**
- Modify: `core/agents/AGENTS.template.md` (mục `### Model and session routing`, đặt trước `### Language`)
- Modify: `AGENTS.md` (chép byte-for-byte)
- Modify: `README.md`, `README_VI.md` (đoạn `CLAUDE_CODE_SUBAGENT_MODEL`)
- Test: `test/content/20-model-session-routing.pin.mjs`

- [x] **Step 1: Viết pin đỏ** `test/content/20-model-session-routing.pin.mjs` (khung như `19-verification-gate.pin.mjs`):
  - `AC2.1: baseline có mục Model and session routing` — đoạn từ `### Model and session routing` tới heading `###` kế tiếp tồn tại trong template và nhắc: `haiku`, `sonnet`, `opus`, "new session" (bàn giao thay vì đổi model), `/clear`, `/compact`, cron ≥ 15 phút, và không gửi tin chỉ để báo nhận.
  - `AC2.2: số liệu có nguồn` — đoạn đó chứa `code.claude.com/docs/en/prompt-caching`, `code.claude.com/docs/en/sub-agents`, `code.claude.com/docs/en/costs`.
  - `AC3.1: README hướng dẫn CLAUDE_CODE_SUBAGENT_MODEL` — cả `README.md` và `README_VI.md` chứa `CLAUDE_CODE_SUBAGENT_MODEL` và `"env"`.
  - Drift `AGENTS.md == template` đã có ở `30-templates.contract.mjs`; không viết lại.
- [x] **Step 2: Chạy, xác nhận đỏ** — `node test/validate.mjs --only model-session-routing`.
- [x] **Step 3: Viết nội dung** — mục baseline theo đủ 13 quy tắc ở design §2 (chọn model, xoay phiên, giao tiếp giữa phiên, theo dõi, song song) cộng bảng tầng việc → model gọn từ §1, câu ngắn, link nguồn tại chỗ có số liệu; chép sang `AGENTS.md`. README: một đoạn ngắn trong mục cài đặt/cấu hình Claude: đặt `{"env": {"CLAUDE_CODE_SUBAGENT_MODEL": "sonnet"}}` trong `~/.claude/settings.json` làm lưới an toàn cho subagent ngoài plugin; thứ tự ưu tiên: tham số lúc gọi → frontmatter `model` → biến môi trường → model phiên chính; aip không tự ghi settings.
- [x] **Step 4: Chạy, xác nhận xanh** — `--only model-session-routing`, `--only templates`, `--only superpowers-docs-standard`, `--only verification-gate`.
- [x] **Step 5: Commit** — `docs(core): add model and session routing rules to baseline`.

### Task 2b: Effort cho agent và baseline (bổ sung 2026-10-21)

**Phủ AC:** AC1.1, AC1.2, AC2.1
**Files:**
- Modify: `plugins/*/agents/*.md` (16 file thêm `effort: high` sau `model`), `core/skills/artifact-templates/references/agent.template.md`
- Modify: `cli/lib/conventions.mjs` (`checkAgentModel` kiểm effort theo Global Constraints)
- Modify: `core/agents/AGENTS.template.md` + `AGENTS.md` (quy tắc effort trong mục Model and session routing, link prompt-caching)
- Test: `test/contract/40-conventions.contract.mjs`
- Test: `test/content/20-model-session-routing.pin.mjs`

- [x] **Step 1: Test đỏ** — mở rộng ca tham số `AC1.2`: sonnet thiếu effort → lỗi; sonnet `medium` → lỗi; opus `low` → lỗi; opus `medium` và `high` → hợp lệ; haiku không effort → hợp lệ. `AC1.1`: cả 16 agent `effort === 'high'`. Pin `AC2.1`: mục baseline nhắc `effort`, `medium`, `high`.
- [x] **Step 2: Chạy, xác nhận đỏ** — `--build --only conventions`, `--only model-session-routing`.
- [x] **Step 3: Viết code + nội dung**, chép template sang `AGENTS.md`.
- [x] **Step 4: Chạy, xác nhận xanh** — cùng lệnh + `--only artifact-templates`, `--only templates`.
- [x] **Step 5: Commit** — `feat(agents): set effort per model tier`.

### Task 3: Bump version, lock, toàn bộ test

**Phủ AC:** AC4.1
**Files:**
- Modify: `core/.manifest.json` (patch), `.manifest.json` của mọi plugin có agent đổi (`backend`, `frontend`, `engineering`, `data`, `ops` — patch), plugin khác chỉ khi lock từ chối
- Modify: `plugins/_versions.lock.json`

- [x] **Step 1:** Bump patch như trên.
- [x] **Step 2:** `npm run build && node cli/lib/versions.mjs --lock` — exit 0.
- [x] **Step 3:** `npm test` — toàn bộ PASS.
- [x] **Step 4:** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-model-session-routing` — chỉ W7 cho AC4.1.
- [x] **Step 5: Commit** — `chore(release): bump versions for model and session routing`.
