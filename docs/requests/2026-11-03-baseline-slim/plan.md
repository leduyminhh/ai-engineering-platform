# Rút gọn baseline AGENTS.template.md xuống ≤ 200 dòng Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** template baseline ≤ 200 dòng, khoá bằng contract; 4 mục hẹp chuyển nguyên chữ sang `references/` của skill core, baseline giữ dòng trỏ; mọi chuỗi pin cũ vẫn được kiểm; `npm test` xanh.
**Architecture:** chỉ dời nội dung (không viết lại); thêm 4 file reference vào skill core sẵn có; test dời theo nội dung. Không đổi `install`/`managed-block`/hook.
**Tech Stack:** Node 20 ESM zero dependency; harness `ok()` của `test/validate.mjs` (module `test/contract/*.contract.mjs`, `test/content/*.pin.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/plan-execution/references/model-routing.md` | chi tiết Model and session routing (chép nguyên chữ) | Task 1 |
| `core/skills/artifact-templates/references/docs-conventions.md` | chi tiết Docs location and format + Memory and resume | Task 1 |
| `core/skills/using-aip/references/agents-in-ci.md` | Agents in CI | Task 1 |
| `core/skills/git-worktree/references/parallel-agents.md` | Parallel agents | Task 1 |
| `core/skills/{plan-execution,artifact-templates,using-aip,git-worktree}/SKILL.md` | link tới reference mới | Task 1 |
| `test/content/18-…`, `19-…`, `20-…`, `21-…`, `22-…`, `23-…`, `25-…`, `32-…`, `33-…` `.pin.mjs` | chuỗi đã dời đọc từ reference | Task 1, Task 2 |
| `core/agents/AGENTS.template.md`, `AGENTS.md` | baseline rút gọn, byte-identical | Task 2 |
| `test/contract/30-templates.contract.mjs` | giới hạn 200 dòng, dòng trỏ → file tồn tại (nguồn + build) | Task 2 |
| `test/content/31-workflow-self-sufficient.pin.mjs` | mốc heading sau khi rút gọn | Task 2 |
| `README.md`, `README_VI.md`, `CLAUDE.md`, `core/skills/git-workflow/SKILL.md`, `core/skills/git-worktree/SKILL.md` | câu nhắc mục baseline đã dời | Task 3 |
| `core/.manifest.json`, `plugins/_versions.lock.json`, `docs/specs/baseline/spec.md`, `docs/specs/artifact-templates/spec.md`, `docs/specs/README.md` (nếu cần) | version, spec sống | Task 4 |

## Global Constraints
- Template: `core/agents/AGENTS.template.md` ≤ 200 dòng (đếm `\n` sau chuẩn hoá `\r\n` → `\n`, khớp `wc -l`), tính cả phần ngoài marker. `AGENTS.md` byte-identical với template; UTF-8 không BOM, LF.
- Reference chép nguyên chữ phần cũ (tiếng Anh), thêm H1 và một câu nguồn; không rút gọn chữ.
- Không viết lại các mục giữ nguyên: Priority, Rules, Comments, Testing, Safety, Command routing, Workflow defaults (trừ khối con Docs/Memory), Language, Definition of Done.
- Vẫn > 200 sau L1–L3 của design: rút chữ cột Work của bảng tier hoặc gộp 4 bullet routing, giữ đủ 5 hàng; không đụng mục giữ nguyên.
- Dòng trỏ baseline có dạng chứa `skill `<tên>`` và `references/<file>.md`.
- Không xoá chuỗi pin nào; pin dời theo nội dung. Không sửa ADR 0002/0003.
- Một commit mỗi task qua `core:git-workflow` (header EN, body VI có dấu, `-F`, không `Co-Authored-By` theo AGENTS.md); không push, không merge.

## Review Focus
- Lát cắt `indexOf` rỗng làm pin pass giả (AC3.2): Task 2 soát từng mốc heading trong pin `18`, `19`, `20`, `21`, `31`.
- Reference ship tới mọi provider (AC2.5): contract ở Task 2 kiểm file tồn tại trong cả 4 build.
- Câu `autonomy.partRunner` trong Parallel agents nằm ở `parallel-agents.md`, xung đột với request `2026-11-03-execution-mode-choice` (Task 1, ghi vào Rủi ro khi kết thúc).
- `guard-mcp.mjs:36` vẫn trỏ đúng mục routing: Task 2 giữ heading `### Model and session routing` và hàng `sonnet`.

### Task 1: Tạo 4 reference và dời pin sang reference
**Kind:** TOOLING
**TDD:** không — chỉ dời nội dung; pin đã có chuyển đích đọc, template chưa đổi nên đỏ/xanh không phân biệt ở task này
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC3.1, AC4.1
**Files:**
- Create: `core/skills/plan-execution/references/model-routing.md`
- Create: `core/skills/artifact-templates/references/docs-conventions.md`
- Create: `core/skills/using-aip/references/agents-in-ci.md`
- Create: `core/skills/git-worktree/references/parallel-agents.md`
- Modify: `core/skills/plan-execution/SKILL.md`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Modify: `core/skills/using-aip/SKILL.md`
- Modify: `core/skills/git-worktree/SKILL.md`
- Test: `test/content/18-superpowers-docs-standard.pin.mjs`
- Test: `test/content/19-verification-gate.pin.mjs`
- Test: `test/content/20-model-session-routing.pin.mjs`
- Test: `test/content/21-long-session-context.pin.mjs`
- Test: `test/content/22-living-spec.pin.mjs`
- Test: `test/content/23-agent-permissions.pin.mjs`
- Test: `test/content/25-parallel-agents-docs.pin.mjs`
- Test: `test/content/32-superpowers-gap.pin.mjs`
- Test: `test/content/33-request-parts.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: 4 đường dẫn `core/skills/plan-execution/references/model-routing.md`, `core/skills/artifact-templates/references/docs-conventions.md`, `core/skills/using-aip/references/agents-in-ci.md`, `core/skills/git-worktree/references/parallel-agents.md`

- [ ] **Step 1:** chép nguyên chữ từ `AGENTS.template.md` (commit `031aca28`): dòng 160–201 → `docs-conventions.md`; 225–308 → `model-routing.md`; 203–210 → `agents-in-ci.md`; 212–223 → `parallel-agents.md`. Thêm link mỗi file vào `SKILL.md` của skill chứa nó (mục Tham chiếu/Bản đồ tài liệu; `using-aip`, `git-worktree` thêm mục ngắn).
- [ ] **Step 2:** sửa các pin theo bảng "Ánh xạ pin" của design: chuỗi có nơi mới là reference thì đọc reference; chuỗi ở lại baseline giữ nguyên. Kiểm `t<n>`, `**Song song:**` mở rộng sang 4 reference.
- [ ] **Step 3:** `npm run build` rồi `node test/validate.mjs` → 0 fail (template chưa đổi nên mọi pin cũ vẫn xanh); commit.

### Task 2: Rút gọn template + contract 200 dòng
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC2.5, AC3.2
**Files:**
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Modify: `test/contract/30-templates.contract.mjs`
- Modify: `test/content/31-workflow-self-sufficient.pin.mjs`
- Test: `test/contract/30-templates.contract.mjs`
- Test: `test/content/18-superpowers-docs-standard.pin.mjs`
- Test: `test/content/20-model-session-routing.pin.mjs`
- Test: `test/content/21-long-session-context.pin.mjs`
- Test: `test/content/31-workflow-self-sufficient.pin.mjs`
- Test: `test/managed-block.test.mjs`

**Interfaces:**
- Consumes: 4 đường dẫn `core/skills/plan-execution/references/model-routing.md`, `core/skills/artifact-templates/references/docs-conventions.md`, `core/skills/using-aip/references/agents-in-ci.md`, `core/skills/git-worktree/references/parallel-agents.md`
- Produces: không có

- [ ] **Step 1:** thêm vào `30-templates`: hàm đếm dòng + assert ≤ 200 (kèm ca âm tính 201 dòng trên chuỗi giả); parse dòng trỏ `skill `<tên>`` + `references/<file>.md` → file tồn tại ở `core/skills/<tên>/references/` và ở `build/{claude,codex,cursor,antigravity}` (bỏ qua build nếu chưa có thư mục, theo pattern `--build` sẵn có). Chạy `node test/validate.mjs --only templates` → đỏ (324 dòng).
- [ ] **Step 2:** rút gọn template theo "Bố cục baseline mới" của design (L1–L3), chép sang `AGENTS.md`; sửa mốc heading trong pin `31` (và `18`, `20`, `21` nếu lát cắt đổi). `wc -l core/agents/AGENTS.template.md` ≤ 200, `cmp AGENTS.md core/agents/AGENTS.template.md` exit 0.
- [ ] **Step 3:** `npm run build` rồi `node test/validate.mjs --build` và `node test/managed-block.test.mjs` → 0 fail; commit.

### Task 3: Sửa tài liệu nhắc mục baseline đã dời
**Kind:** DOCS
**Phủ AC:** AC4.2
**Files:**
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Modify: `core/skills/git-workflow/SKILL.md`
- Modify: `core/skills/git-worktree/SKILL.md`
- Test: `test/content/23-agent-permissions.pin.mjs`
- Test: `test/content/25-parallel-agents-docs.pin.mjs`

**Interfaces:**
- Consumes: 4 đường dẫn reference của Task 1
- Produces: không có

- [ ] **Step 1:** sửa các câu ở `README.md:382`, `:398`, `README_VI.md:375`, `:391`, `CLAUDE.md:73`, `core/skills/git-workflow/SKILL.md:29`, `core/skills/git-worktree/SKILL.md:17`, `:75` để trỏ reference mới; giữ các từ pin `23`/`25` đọc. `grep` các cụm ở AC4.2 → 0 kết quả.
- [ ] **Step 2:** `node test/validate.mjs` → 0 fail; commit.

### Task 4: Bump core, lock, spec sống
**Kind:** TOOLING
**TDD:** không — version/lock/spec, đã có `npm test` (lock check) và `check-request.mjs` kiểm
**Phủ AC:** AC5.1, AC5.2, AC5.3
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `docs/specs/baseline/spec.md`
- Modify: `docs/specs/artifact-templates/spec.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** bump `core/.manifest.json` minor (từ `1.26.15`), `npm run build`, `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** spec sống theo `## Ảnh hưởng spec` (baseline: đổi R2, R3, R4, R6, R7, thêm R9; artifact-templates: thêm R14) + dòng Lịch sử; `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-03-baseline-slim/ --base master` → không W10–W14.
- [ ] **Step 3:** `npm test` → exit 0; commit.

### Task 5: Gói minor sau review cuối (G3: sửa rồi merge)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.5, AC4.2, AC5.1, AC5.3
**Files:**
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-spec-writing/references/spec-structure.md`
- Modify: `core/skills/git-worktree/SKILL.md`
- Modify: `CLAUDE.md`
- Modify: `docs/specs/baseline/spec.md`
- Modify: `docs/specs/artifact-templates/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/backend/.manifest.json`
- Modify: `plugins/frontend/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/30-templates.contract.mjs`
- Test: `test/content/25-parallel-agents-docs.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** test đỏ: dòng trỏ CI trong baseline chứa `dontAsk`, `--allowedTools`, `--max-budget-usd`; dòng trỏ Parallel chứa `rm -rf`; bullet song song của routing chứa `between parts`; kiểm AC4.2 bao thêm `engineering-spec-writing` (`baseline \`AGENTS.md\``) và `quy ước baseline` của `git-worktree`. Chạy `node test/validate.mjs --only templates` và `--only 25-parallel` → đỏ; commit test.
- [ ] **Step 2:** sửa trên chính các dòng (template vẫn ≤ 200 dòng, `AGENTS.md` byte-identical); trỏ `engineering-spec-writing` về skill `artifact-templates`, `references/docs-conventions.md`; sửa `description`/`title`/dòng 17 của `git-worktree` (giữ trigger, ≤ 500 ký tự); câu `CLAUDE.md:73`; spec R2/R3/R7 + dòng `Cập nhật`. Bump core 1.27.1, engineering, backend, frontend (patch); `npm run build`, `node cli/lib/versions.mjs --lock`; test xanh; commit.
