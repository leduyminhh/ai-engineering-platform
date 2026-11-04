# Khối baseline thuộc `aip init` ở project Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `aip init` idempotent làm mới khối baseline ở `AGENTS.md` và bảo đảm `CLAUDE.md` import `@AGENTS.md`; `install`/`uninstall`/`update` không ghi khối, chỉ gỡ khối legacy ở global; `aip check` cảnh báo khối cũ hoặc nạp trùng; docs + spec sống khớp; `npm test` xanh.
**Architecture:** trích khối thành hàm thuần ở `managed-block.mjs` dùng chung cho `init`, `check` và dọn legacy; `init` lập kế hoạch đầy đủ rồi mới ghi; `install.mjs` xoá đường ghi khối, `uninstallEntries` và nhánh `plugin-refresh` dọn `managed[]` chỉ ở scope global.
**Tech Stack:** Node 20 ESM zero dependency; `node:test` (`test/*.test.mjs`), harness `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `cli/lib/managed-block.mjs` | hàm thuần trích khối từ nội dung template | Task 1 |
| `cli/lib/init.mjs` | init idempotent: kế hoạch create/refresh/unchanged/skip cho `AGENTS.md`/`CLAUDE.md`, ghi theo kế hoạch | Task 1 |
| `cli/index.mjs` (`reportInit`) | in bốn nhóm kết quả init và nhắc vùng marker do aip quản lý | Task 1 |
| `cli/lib/wizard.mjs` | nhãn mục `init` | Task 1 |
| `test/init.test.mjs`, `test/managed-block.test.mjs` | test init + hàm trích khối | Task 1 |
| `cli/lib/install.mjs` (install/uninstall/update) | bỏ ghi khối; dọn `managed[]` legacy chỉ ở global | Task 2 |
| `test/install.test.mjs` (phần install/uninstall/update) | test AC3.x, thay test cũ của audit AC6.1/AC7.1 | Task 2 |
| `cli/lib/install.mjs` (`check`), `cli/index.mjs` (`reportCheck`) | cảnh báo khối baseline, chỉ đọc | Task 3 |
| `test/install.test.mjs` (phần check) | test AC4.x | Task 3 |
| `README.md`, `README_VI.md`, `CLAUDE.md`, `docs/specs/README.md`, `docs/specs/install-lifecycle/spec.md`, `docs/specs/cli-wizard/spec.md`, `docs/specs/baseline/spec.md` | docs + spec sống | Task 4 |

## Global Constraints
- Marker giữ nguyên: `<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->` / `<!-- AI-ENGINEERING:END AGENTS_BASELINE -->`; không đổi `core/agents/AGENTS.template.md`, `AGENTS.md` của repo, adapter cursor/antigravity, ngữ nghĩa `mergeManagedBlock`/`removeManagedBlock`.
- So khối "bằng template" sau chuẩn hoá `\r\n` → `\n`.
- Kết quả `init()` có đúng bốn mảng `created`, `refreshed`, `unchanged`, `skipped` (+ `warnings`); mỗi file thuộc đúng một mảng (design, "Quyết định của agent" mục 6).
- `AGENTS.md` marker hỏng → init ném nêu `AGENTS.md`, không ghi byte nào (lập kế hoạch trước, ghi sau). `CLAUDE.md` marker hỏng → không ném, giữ nguyên, cảnh báo.
- Symlink/junction (`isLinkPath`) → bỏ qua + cảnh báo, file đích không đổi byte.
- `managed[]` legacy: scope global → gỡ khối (`cleanManagedBlock`), link bỏ qua + cảnh báo, marker hỏng không ném; scope project → không sửa file. Entry mới không có `managed`.
- `aip check` chỉ đọc, thoát mã 0; cảnh báo chỉ khi `doctor: true`; file global lấy từ `scopeRoot('global')`.
- Zero dependency; UTF-8 không BOM, LF; chuỗi hiển thị tiếng Việt có dấu. Test sandbox bằng thư mục tạm/`AIE_INSTALL_ROOT`, dọn bằng `fs.rmSync` (không `rm -rf`). Tên test chứa ID AC.
- Một commit mỗi task qua `core:git-workflow` (header EN, body VI có dấu, `-F`); không push, không merge.

## Review Focus
- Init ném giữa chừng để lại file nửa vời (AC1.5): Task 1, test marker hỏng kiểm `listFiles` của root không đổi, cả `--full`.
- Chèn `@AGENTS.md` vào `CLAUDE.md` bắt đầu bằng BOM hoặc CRLF làm `importsAgentsMd` sai: Task 1, test AC2.1 tham số hoá thêm ca BOM và CRLF.
- Nạp hai lần còn sót khi `CLAUDE.md` chứa khối (AC2.3): Task 1 đếm BEGIN trong cả hai file bằng 1.
- `update` nhánh `plugin-refresh` không đi qua `uninstallEntries` nên quên dọn global (AC3.3): Task 2 có ca plugin-mode với seam fake `claude` CLI.
- Mất test bảo vệ "ghi manifest sau từng provider" của audit AC6.1 khi bỏ `planManagedBlock`: Task 2 giữ một test kích lỗi bằng cách khác và ghi tên test thay thế trong commit.

### Task 1: Init idempotent + `CLAUDE.md` import + báo kết quả
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC2.1, AC2.2, AC2.3, AC2.4, AC5.1, AC5.2
**Files:**
- Modify: `cli/lib/managed-block.mjs`
- Modify: `cli/lib/init.mjs`
- Modify: `cli/index.mjs`
- Modify: `cli/lib/wizard.mjs`
- Test: `test/init.test.mjs`
- Test: `test/managed-block.test.mjs`

**Interfaces:**
- Consumes: `mergeManagedBlock`, `removeManagedBlock`, `importsAgentsMd`, `BEGIN`, `END` (có sẵn ở `cli/lib/managed-block.mjs`); `isLinkPath` (có sẵn ở `cli/lib/install.mjs` hoặc chuyển sang module dùng chung nếu import vòng)
- Produces: `extractBaselineBlock(templateText: string): string` ở `cli/lib/managed-block.mjs` (ném khi thiếu/hỏng marker); `init({ root, full })` trả `{ root, created: string[], refreshed: string[], unchanged: string[], skipped: string[], warnings: string[] }`

- [ ] **Step 1:** Viết test đỏ trong `test/managed-block.test.mjs`: `AC1 extractBaselineBlock` trả vùng BEGIN..END của `core/agents/AGENTS.template.md` và ném khi thiếu marker. Chạy `node --test test/managed-block.test.mjs` → đỏ.
- [ ] **Step 2:** Viết test đỏ trong `test/init.test.mjs` cho AC1.1–AC1.7, AC2.1–AC2.4, AC5.1 (tham số hoá: AC1.5 hai dạng marker hỏng × `full` true/false; AC1.6 `AGENTS.md`/`CLAUDE.md` là link — junction cho thư mục không áp, dùng `fs.symlinkSync` file và bỏ qua ca khi Windows không cho tạo symlink bằng `t.skip` kèm lý do; AC2.1 thêm ca BOM và CRLF). Sửa test cũ "không ghi đè file đã có, cảnh báo khi CLAUDE.md chưa import" theo hành vi mới. Chạy `node --test test/init.test.mjs` → đỏ đúng các ca mới.
- [ ] **Step 3:** Thêm `extractBaselineBlock` vào `managed-block.mjs`; viết lại `init()`: bước lập kế hoạch (đọc template, tính nội dung mới của `AGENTS.md` và `CLAUDE.md`, phân loại) rồi bước ghi; file khác của init giữ logic không ghi đè. `install.mjs` `baselineBlock()` gọi `extractBaselineBlock` (chưa xoá đường ghi khối ở task này). Chạy `node --test test/init.test.mjs test/managed-block.test.mjs` → xanh.
- [ ] **Step 4:** `reportInit` in `+` created, `~` refreshed (kèm câu vùng giữa marker do aip quản lý), số file unchanged/skipped; nhãn wizard `init — tạo hoặc làm mới AGENTS.md + CLAUDE.md`. Test AC5.2: spawn `node cli/index.mjs init` trong thư mục tạm có `AGENTS.md` cũ, assert stdout có dòng `~ AGENTS.md`. Chạy `node --test test/init.test.mjs test/wizard.test.mjs` → xanh.
- [ ] **Step 5:** Chạy `node --test test/install.test.mjs` (không hồi quy do đổi `baselineBlock`) → xanh; commit.

### Task 2: `install`/`uninstall`/`update` không ghi khối; dọn legacy ở global
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC3.1, AC3.2, AC3.3, AC3.4, AC3.5
**Files:**
- Modify: `cli/lib/install.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `extractBaselineBlock` (Task 1) chỉ nếu dọn legacy cần; `cleanManagedBlock`, `removeManagedBlock` (có sẵn)
- Produces: `uninstallEntries(m, root, predicate, scope)` (thêm tham số `scope`); entry manifest mới không có trường `managed`

- [ ] **Step 1:** Viết test đỏ `AC3.1`–`AC3.5` trong `test/install.test.mjs` (sandbox `AIE_INSTALL_ROOT`; manifest legacy dựng sẵn có `managed`; plugin-mode và `update` nhánh `plugin-refresh` dùng seam fake `claude` CLI có trong file; tham số hoá provider claude skills/plugin, codex, cursor, antigravity cho AC3.1). Sửa/thay test cũ: "claude + CLAUDE.md import @AGENTS.md: khối baseline chuyển sang AGENTS.md", antigravity regression managed-block symlink, audit 2026-11-03 AC6.1/AC7.1 — phần "ghi manifest sau từng provider" giữ bằng test kích lỗi khác. Chạy `node --test test/install.test.mjs` → đỏ đúng ca mới.
- [ ] **Step 2:** Xoá `instructionFiles`, `planManagedBlock`, `applyManagedBlock`, `managedFilesToClean` (và test riêng của nó nếu có) cùng các lời gọi trong `install()`; `uninstallEntries` nhận `scope`, dọn `managed[]` của entry bị gỡ chỉ khi global; nhánh `plugin-refresh` của `update()` dọn `managed[]` của entry giữ lại (global) rồi xoá trường và ghi manifest; scope project chỉ xoá trường. Xoá `baselineBlock()` nếu không còn dùng. Chạy `node --test test/install.test.mjs` → xanh.
- [ ] **Step 3:** Chạy `node test/validate.mjs --build` → exit 0; commit (body nêu tên test thay thế cho audit AC6.1/AC7.1).

### Task 3: `aip check` cảnh báo khối baseline
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC4.1, AC4.2, AC4.3, AC4.4, AC4.5
**Files:**
- Modify: `cli/lib/install.mjs`
- Modify: `cli/index.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `extractBaselineBlock` (Task 1), `importsAgentsMd`, `BEGIN`, `END`
- Produces: `check({ scope, doctor })` trả thêm `baseline: { warnings: string[] }` khi `doctor: true`

- [ ] **Step 1:** Viết test đỏ `AC4.1`–`AC4.5`: `check({scope, doctor:true})` trong sandbox (global có/không khối ở scope project và global; `AGENTS.md` khối cũ / bằng template kể cả CRLF; `CLAUDE.md` thiếu import / chứa khối; marker hỏng; chưa có `AGENTS.md`; không marker) — assert danh sách cảnh báo và mtime/nội dung mọi file không đổi; AC4.5 spawn `node cli/index.mjs check` assert exit 0. Chạy `node --test test/install.test.mjs` → đỏ.
- [ ] **Step 2:** Cài `baseline.warnings` trong `check()` (đọc trong `try`, không ghi) và in ở `reportCheck` (`⚠` mỗi dòng). Chạy `node --test test/install.test.mjs` → xanh; commit.

### Task 4: Docs, spec sống, kiểm cuối
**Kind:** DOCS
**Phủ AC:** AC6.1, AC6.2, AC6.3
**Files:**
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Modify: `docs/specs/README.md`
- Modify: `docs/specs/install-lifecycle/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `docs/specs/baseline/spec.md`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: hành vi của Task 1–3 (`init` 4 nhóm kết quả, `install` không ghi khối, `check` cảnh báo)
- Produces: không có

- [ ] **Step 1:** Sửa README/README_VI/CLAUDE.md/`docs/specs/README.md` theo design mục "Điểm chạm": khối thuộc `aip init` (chạy lại để làm mới), `install` chỉ gỡ khối legacy ở global, bỏ câu đếm tham chiếu và dòng bảng provider "baseline block → AGENTS.md/CLAUDE.md". Chạy `grep -nE "reference-count|managed block|khối managed|khối baseline" README.md README_VI.md CLAUDE.md docs/specs/README.md` → không còn câu nói install ghi khối (AC6.1).
- [ ] **Step 2:** Gộp spec theo `## Ảnh hưởng spec` của design: `install-lifecycle` đổi R5, R6, R7, R11, thêm R13; `cli-wizard` thêm R8; sửa chữ Phạm vi của `baseline`; thêm dòng bảng Lịch sử. Chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-04-project-baseline-init/ --base master` → 0 cảnh báo W10–W14 (AC6.2).
- [ ] **Step 3:** Chạy `npm test` → exit 0; không chạm `core/`/`plugins/` nên không bump (nếu có chạm thì bump `.manifest.json` + `npm run build` + `node cli/lib/versions.mjs --lock`) (AC6.3); commit.
