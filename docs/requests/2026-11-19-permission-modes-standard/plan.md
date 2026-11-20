# Chuẩn hoá ba chế độ quyền guarded/confined/open Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** ba mode `guarded` (cũ `ask`), `confined` (cũ `full`, không bao giờ hỏi, ngoài rào deny), `open` (không hỏi, không rào; chỉ chặn ghi file cấu hình quyền, `writeScope`, `mcpDeny`), tên cũ là bí danh; `aip mode` ghi tên mới, `status` giải thích mode; `session-start` báo mode khác `guarded`.
**Architecture:** một hàm chuẩn hoá `modeName` + hai hàm hiệu lực trong `gate-config.mjs`; mỗi hook kiểm `open` ở đầu `decide` (trong `try`) rồi trả sớm; nhánh `ask` của `full` đổi `deny` khi `confined` hiệu lực; CLI dùng chung `modeName` và hằng định nghĩa `MODE_DEFS`.
**Tech Stack:** Node.js 20+ ESM, zero dependency; test là module contract/content chạy bằng `node test/validate.mjs`, CLI test `node test/mode.test.mjs`.
**Spec:** design.md
**Requirement:** không có

**Thứ tự:** tuần tự Task 1 → 9 trên nhánh `feature/permission-modes-standard` (cắt từ `master` `44bdd964`). **Tổng ước lượng:** 250 phút.

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/gate-config.mjs` | `modeName`, `effectiveMode`, `fullEffective` (hiệu lực `confined`), `openEffective` | Task 1 |
| `core/hooks/scripts/guard-bash.mjs` | `open` trả sớm + nhận diện `aip mode` (K12, K13); nhánh phiên không bypass (D9) | Task 2 |
| `core/hooks/scripts/guard-bash.mjs` | chín nhánh ask → deny của `confined`, câu `deny` (D15), catch (K15) | Task 3 |
| `core/hooks/scripts/guard-files.mjs` | `open`/`confined` theo mức chặt hơn cwd/file đích (K14), K13, K15, D16 | Task 4 |
| `core/hooks/scripts/guard-mcp.mjs` | `open` bỏ deny `start_session`/`mcpAllow`, giữ `mcpDeny`; K15 | Task 5 |
| `core/hooks/scripts/session-start.mjs` | dòng báo mode (K17, D23) | Task 6 |
| `cli/lib/mode.mjs`, `cli/index.mjs`, `cli/lib/autonomy.mjs` | `aip mode guarded|confined|open|status` + bí danh, `MODE_DEFS`, cảnh báo, status | Task 7 |
| `test/contract/94-permission-modes.contract.mjs` | AC1.1, bảng bí danh AC1.2, AC2.7, đổi kỳ vọng ca `ask` cũ của `full` | Task 1, 3, 5 |
| `test/contract/99-permission-modes-standard.contract.mjs` (mới) | bảng AC2.x, AC3.x, AC6.x của mode mới | Task 2–6 |
| `test/contract/99-path-permissions.contract.mjs`, `99-hook-popup.contract.mjs`, `97-audit-mustfix.contract.mjs`, `91-guard-mcp.contract.mjs` | đổi kỳ vọng ca `ask` của `full` thành `deny` (cùng đầu vào), câu R21; `99-hook-popup:187` và `94:264` đổi gợi ý `aip mode guarded` ở Task 2 | Task 2, 3, 4, 5 |
| `test/contract/90-hooks.contract.mjs` | tiêm `loadGate` cho ca `session-start` không tiêm cấu hình | Task 6 |
| `test/mode.test.mjs` | AC4.x | Task 7 |
| `docs/specs/hooks-gates/spec.md`, `docs/specs/cli-wizard/spec.md`, `docs/specs/baseline/spec.md` | R25 mới và các R đổi | Task 8 |
| `docs/aip-gate.md`, `docs/aip-gate_VI.md`, `README.md`, `README_VI.md`, `core/agents/AGENTS.template.md`, `AGENTS.md`, `CHANGELOG.md` | ba định nghĩa, bí danh, mẫu, breaking | Task 8 |
| `test/content/29-permission-modes-docs.pin.mjs`, `30-permission-modes-phase2-docs.pin.mjs`, `34-autonomy-gates.pin.mjs`, pin mới cho câu định nghĩa | pin docs theo tên mới | Task 8 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump 1.35.0, lock | Task 9 |

## Global Constraints
- Ba câu định nghĩa (nguyên văn, dùng ở `MODE_DEFS`, spec, docs, README):
  - `guarded` — VI "Việc rủi ro thì hỏi người dùng." / EN "Risky actions ask the user."
  - `confined` — VI "Không bao giờ hỏi: việc trong rào thì cho qua, ngoài rào thì từ chối." / EN "Never asks: work inside the fence passes, work outside it is denied."
  - `open` — VI "Không hỏi, không rào: chỉ còn chặn ghi file cấu hình quyền và theo `writeScope`, `mcpDeny`." / EN "Never asks, no fence: only writes to permission config files, `writeScope` and `mcpDeny` still block."
- `modeName(value)`: `'ask'|'guarded'` → `'guarded'`; `'full'|'confined'` → `'confined'`; `'open'` → `'open'`; mọi giá trị khác (thiếu, `null`, số, mảng, sai hoa thường, khoảng trắng/xuống dòng thừa, `bypass`, `"constructor"`, `"__proto__"`) → `'guarded'`. Cài bằng `switch` hoặc `===`, không tra object/`Map`. Kiểm nới quyền chỉ bằng danh sách dương (`=== 'open'`, `∈ {confined, open}`), không dùng `!== 'guarded'`.
- `confined`/`open` hiệu lực khi đủ ba điều kiện: `modeName(config.mode)` đúng mode, `permission_mode === 'bypassPermissions'`, file cấu hình không bị git theo dõi (cấu hình tiêm không có `file` coi là đáng tin). Kiểm `permission_mode` trước, `mode` trước `tracked` (không thêm lời gọi git ở đường nóng phiên không bypass).
- Tên hàm: giữ `fullEffective` (nghĩa: hiệu lực `confined`, trả `false` ở `open`), thêm `openEffective(gate, input, { tracked })`; giữ tên bốn khoá `fullKeep`, `fullRoots`, `fullReadRoots`, `fullPaths` (D13).
- Lỗi: bước kiểm `open` nằm trong `try`, lỗi ⇒ coi là không `open`. `confined` hiệu lực mà lỗi sau bước xác định mode ⇒ `deny` ở cả ba hook. Mode hiệu lực `guarded` ⇒ fail-open như hôm nay.
- `open` vẫn `deny` ghi `.claude/aip-gate.json`, `.claude/settings*.json` (mẫu `GUARD_CONFIG` của từng hook) và đường dẫn kết thúc bằng `hooks/scope-lock.json`; `aip mode <guarded|confined|open|ask|full>` (kể cả `ai-engineering-platform mode`, `node …/cli/index.mjs mode`, qua `npx`) do agent chạy là ghi cấu hình: `ask(CONFIG_TEXT)` ở `guarded`, `deny` ở `confined`/`open`; `aip mode status` cho qua.
- Câu `ask` theo R21: một câu ngắn, không chứa `bypass`, `root`, `fullRoots`. Câu `deny` của `confined` viết cho agent: một câu nêu việc bị chặn + một câu "Mở: …" (khoá rào, người dùng tự làm, hoặc `aip mode open`; nhánh ghi cấu hình và `aip mode` không gợi ý `aip mode open`).
- Test: một hành vi một hàng của bảng tham số hoá; tên hàng có ID AC; ca `ask` cũ của `full` không xoá mà đổi kỳ vọng sang `deny` cùng đầu vào; mỗi cổng nới có hàng đối chứng ở `guarded`. Lệnh hẹp: `node test/validate.mjs --only permission-modes`, `--only path-permissions`, `--only hook`, `--only guard-mcp`, `node test/mode.test.mjs`. Repo chính có `mode: "full"` thật (file không bị git theo dõi) nên vài ca của `94-permission-modes` (P4e AC1.3) đỏ sẵn ở đây. Cách chạy duy nhất: bước "thấy đỏ" và "xanh" của mỗi task chạy trong repo chính (bản clone không có thay đổi chưa commit), so với danh sách ca đỏ sẵn đo một lần ở `44bdd964` (`node test/validate.mjs --only permission-modes`, ghi tên ca đỏ vào ledger); chỉ ca đỏ ngoài danh sách đó mới tính là đỏ của task. Full suite (Task 9) chạy trên clone sạch sau commit: `git clone -b feature/permission-modes-standard <repo> <scratchpad>/c`, lần sau `git -C <scratchpad>/c pull`.
- Số nền (clean clone `44bdd964`): `npm test` exit 0, validate 8798 pass.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment chỉ ghi lý do (AGENTS.md); commit header tiếng Anh, body tiếng Việt, mỗi task qua `core:git-workflow`, không `Co-Authored-By`; commit test đỏ trước rồi code (task TDD).
- Bump `core/.manifest.json` `1.34.13` → `1.35.0` (chỉ core).

## Review Focus
- File bị git theo dõi hoặc phiên không bypass với `mode: 'open'`/`'confined'` không được mở cổng — AC2.7 (Task 5, bảng ba hook) và AC3.5 (Task 3).
- Lỗi không tự mở cổng: bước kiểm `open` lỗi (AC2.9, Task 2/4/5) và `confined` lỗi sau xác định mode ⇒ `deny` (AC3.6, Task 3/4/5).
- Giá trị lạ (`"__proto__"`, `"constructor"`, `" open"`, `Open`, `bypass`) luôn là `guarded` — AC1.1 (Task 1), AC6.1 (Task 6).
- `guarded` không đổi hành vi ngoài ca `aip mode` (K12): hàng đối chứng của AC3.1, AC3.3 (Task 3, 4) và AC1.2 (Task 5).
- Repo lồng `open` không phá rào của project `confined` — AC2.12 (Task 4).

### Task 1: modeName và hàm hiệu lực
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC1.1
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `modeName(value) → 'guarded'|'confined'|'open'`; `effectiveMode(config, input) → 'guarded'|'confined'|'open'`; `fullEffective(gate, input, { tracked })` (true chỉ khi `confined`); `openEffective(gate, input, { tracked })`.

- [ ] **Step 1:** đổi bảng `effectiveMode` hiện có ở `94-permission-modes` (`:10-20`) thành bảng AC1.1 (16 giá trị `mode` × 7 `permission_mode`), thêm hàng `modeName` cho giá trị lạ (so `=== 'guarded'`) và `fullEffective`/`openEffective` ở `mode: 'open'`/`'confined'` (kể cả `tracked: () => true` → `false`); chạy trên clone sạch `node test/validate.mjs --only permission-modes`, thấy đỏ.
- [ ] **Step 2:** thêm `modeName`, sửa `effectiveMode`, `fullEffective` (qua `modeName`, `false` ở `open`), thêm `openEffective` cùng khuôn; chạy lại, xanh; commit `feat(hooks): add guarded/confined/open mode names and effectiveness`.

### Task 2: guard-bash ở open và aip mode do agent chạy
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.3, AC2.1, AC2.2, AC2.8, AC2.9, AC2.11
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Create: `test/contract/99-permission-modes-standard.contract.mjs`
- Test: `test/contract/99-permission-modes-standard.contract.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs` (dòng 264 kiểm FULL_NO_BYPASS_TEXT chứa "aip mode ask")
- Test: `test/contract/99-hook-popup.contract.mjs` (dòng 187, cùng chuỗi)

**Interfaces:**
- Consumes: `modeName`, `fullEffective`, `openEffective` (Task 1).
- Produces: `isModeChange(tokens) → boolean` (đoạn lệnh là `aip mode <guarded|confined|open|ask|full>`, `ai-engineering-platform mode …`, `node …/cli/index.mjs mode …`, kể cả qua `npx`; `status` và không đối số là `false`), dùng trong nhánh ghi cấu hình của `decide`; `FULL_NO_BYPASS_TEXT` mới nêu `aip mode guarded`.

- [ ] **Step 1:** tạo file contract mới với seam như `99-path-permissions` (`bd(cmd, { tool, cfg, extra, opts })`), viết bảng AC2.1, AC2.2, AC2.8, phần `guard-bash` của AC2.11 (gồm nháy chưa đóng), phần `guard-bash` của AC2.9 (`reader` ném, `git push origin master` → `ask` như khi không `open`) và AC1.3; thêm ca K12 ở `guarded`/`ask` (`aip mode open`, `node cli/index.mjs mode confined` → `ask` với `CONFIG_TEXT`; `aip mode status` → `null`); đổi kỳ vọng `94-permission-modes:264` và `99-hook-popup:187` từ `aip mode ask` sang `aip mode guarded`; chạy `--only permission-modes-standard`, `--only permission-modes`, `--only hook-popup`, thấy đỏ.
- [ ] **Step 2:** trong `decide`, sau khi có `cwd`/`bypass`, kiểm `openEffective` trong `try` (D2); ở `open` chỉ chạy kiểm ghi cấu hình + mẫu `aip mode` (D3: kiểm rẻ chuỗi trước, lỗi ⇒ `deny` nếu chuỗi có tên file cấu hình hoặc `aip mode`, ngược lại `null`); thêm mẫu `aip mode` vào nhánh ghi cấu hình `:1772` (`ask` ở `guarded`; `confined` để Task 3); `:1815` dùng `modeName(gate()?.mode)` ∈ {`confined`, `open`}; đổi `FULL_NO_BYPASS_TEXT`. Chạy lại bảng mới và `--only path-permissions`, `--only hook` (clone sạch), xanh; commit `feat(hooks): add open mode to guard-bash and treat aip mode as config write`.

### Task 3: guard-bash ở confined không còn hỏi
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC3.1, AC3.2, AC3.5
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/99-permission-modes-standard.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`
- Test: `test/contract/94-permission-modes.contract.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: `fullEffective` (Task 1), `isModeChange(tokens)` (Task 2).
- Produces: các hằng câu `deny` của `confined` (tên do builder đặt) tách khỏi câu `ask` (`CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT` giữ cho `guarded`).

- [ ] **Step 1:** viết bảng AC3.1 (tám hàng, lặp `mode: 'confined'` và `'full'`, đối chứng `guarded`, `fullKeep: []`), AC3.2 (từ khoá vận hành trong `reason`), AC3.5 phần `guard-bash`; đổi kỳ vọng các ca `ask` của `full` ở `99-path-permissions`, `99-hook-popup`, `94-permission-modes`, `97-audit-mustfix` thành `deny` (giữ đầu vào; ca R21 của câu `ask` chuyển sang `guarded` hoặc kiểm câu `deny`); chạy, thấy đỏ.
- [ ] **Step 2:** bảy nhánh `:1759`, `:1770`, `:1772-1773`, `:1810`, `:1811`, `:1829`, `:1835` trả `deny` khi `full()` (D15), giữ `ask` ở `guarded`; chạy `--only permission-modes-standard`, `--only path-permissions`, `--only hook`, `--only audit-mustfix` (clone sạch), xanh; commit `feat(hooks)!: confined mode denies instead of asking in guard-bash`.

### Task 4: guard-files ở open và confined
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC2.3, AC2.4, AC2.9, AC2.11, AC2.12, AC3.3, AC3.4, AC3.6
**Files:**
- Modify: `core/hooks/scripts/guard-files.mjs`
- Test: `test/contract/99-permission-modes-standard.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `fullEffective`, `openEffective`, `modeName` (Task 1).
- Produces: không có

- [ ] **Step 1:** viết bảng AC2.3, AC2.4, phần `guard-files` của AC2.11, AC2.12 (seam `reader` trả theo thư mục, gồm repo lồng `P/tmp`), AC3.3 (đối chứng `guarded`), phần `guard-files` của AC2.9 và AC3.6, và AC3.4 (chạy lại mọi bảng `confined` của `guard-bash`/`guard-files`, không `ask`); đổi kỳ vọng ca `ask` của `full` trong `99-path-permissions` phía `guard-files` thành `deny`; chạy, thấy đỏ.
- [ ] **Step 2:** `decide` tính mode theo `cwd` và theo thư mục file đích, lấy mức chặt hơn (K14); `open` bỏ `SECRET_DENY`/`confine`/`guardConfigAsk`, `deny` ghi `GUARD_CONFIG` hoặc `hooks/scope-lock.json`, giữ `writeScope`; `confined`: `confine` và `guardConfigAsk` trả `deny`; bọc phần sau bước xác định mode (K15): lỗi ở `confined` ⇒ `deny`; lỗi ở `open` ⇒ `deny` chỉ khi đích khớp `GUARD_CONFIG` hoặc `hooks/scope-lock.json`, còn lại `null`; lỗi ở `guarded` ⇒ ném lại như hôm nay (fail-open ở `main()`). Chạy bảng mới, `--only path-permissions`, `--only hook` (clone sạch), xanh; commit `feat(hooks)!: add open and confined modes to guard-files`.

### Task 5: guard-mcp và bảng bí danh ba hook
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.2, AC2.5, AC2.6, AC2.7, AC2.9, AC2.10, AC3.6
**Files:**
- Modify: `core/hooks/scripts/guard-mcp.mjs`
- Test: `test/contract/99-permission-modes-standard.contract.mjs`
- Test: `test/contract/91-guard-mcp.contract.mjs`

**Interfaces:**
- Consumes: `fullEffective`, `openEffective` (Task 1); hành vi `open`/`confined` của `guard-bash` (Task 2, 3) và `guard-files` (Task 4).
- Produces: không có

- [ ] **Step 1:** viết AC2.5, AC2.6, AC2.10, phần `guard-mcp` của AC2.9 và AC3.6, rồi hai bảng chéo ba hook: AC1.2 (bí danh `ask`≡`guarded`≡thiếu, `full`≡`confined`, `bypass`≡`guarded`) và AC2.7 (thiếu một điều kiện ⇒ bằng `guarded`, hoặc bằng `confined` khi mode là `confined`/`full`); chạy, thấy đỏ ở phần `guard-mcp`.
- [ ] **Step 2:** `decide` đọc cấu hình trước nhánh `start_session` chỉ khi nhánh đó sắp deny (D5); `open` (trong `try`) bỏ deny `start_session` và `mcpAllow`, giữ `mcpDeny`; ask khi file hỏng giữ; lỗi sau xác định mode: `confined` ⇒ `deny`, `open` ⇒ `null`, `guarded` ⇒ ném lại như hôm nay (K15). Chạy bảng mới, `--only guard-mcp`, `--only permission-modes` (clone sạch), xanh; commit `feat(hooks): add open mode to guard-mcp`.

### Task 6: session-start báo mode
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC6.1, AC6.2
**Files:**
- Modify: `core/hooks/scripts/session-start.mjs`
- Test: `test/contract/99-permission-modes-standard.contract.mjs`
- Test: `test/contract/90-hooks.contract.mjs` (ca gọi decide không tiêm cấu hình sẽ đọc mode "full" thật của repo chính)

**Interfaces:**
- Consumes: `modeName` (Task 1); `resolveGate`, `gateTracked` (đã import ở `session-start.mjs:7`).
- Produces: hai seam mới của `decide(input, deps)`: `deps.loadGate(cwd) → { config, file } | null` (mặc định qua `resolveGate`) và `deps.gateTracked(file) → true|false|null` (mặc định `gateTracked`). Không dùng `deps.loadConfig` (chỉ trả config, không có `file`) và không dùng `deps.tracked` (đang là seam kiểm handoff, chữ ký `(p, root)`, `session-start.mjs:228-229`).

- [ ] **Step 1:** viết bảng AC6.1 (8 giá trị `mode` × `source`, `gateTracked: () => true` cho ca file bị theo dõi) và AC6.2 (`bootstrapInject: false`, ngân sách `MAX_TOTAL`, `loadGate` ném lỗi) qua `decide` với hai seam trên (cách tiêm khác như test R12 ở `90-hooks`); ca nào ở `90-hooks` gọi `decide` mà không tiêm `loadGate` thì tiêm `loadGate: () => null` để không đọc file thật; chạy `--only permission-modes-standard`, `--only hooks`, thấy đỏ.
- [ ] **Step 2:** thêm dòng `aip: mode hiệu lực = <mode> (nguồn …)` ở đầu `additionalContext` khi `source` ∈ {`startup`, `clear`, `compact`} và mode là `confined`/`open`, tính vào `MAX_TOTAL`, không phụ thuộc `bootstrapInject`, lỗi ⇒ không dòng; chạy bảng mới và `--only hook`, xanh; commit `feat(hooks): announce confined/open mode at session start`.

### Task 7: aip mode guarded|confined|open|status
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
**Files:**
- Modify: `cli/lib/mode.mjs`
- Modify: `cli/index.mjs`
- Modify: `cli/lib/autonomy.mjs`
- Test: `test/mode.test.mjs`

**Interfaces:**
- Consumes: `modeName` (Task 1, import từ `core/hooks/scripts/gate-config.mjs`).
- Produces: `MODE_DEFS` (ba câu định nghĩa VI, dùng cho help, status và pin của Task 8); hàm áp mode thay `applyFull`/`applyAsk` (tên do builder đặt).

- [ ] **Step 1:** đổi test cũ `applyFull`/`applyAsk`/`statusOf` (`test/mode.test.mjs:8`, `:37`, `:58`) sang API mới và viết bảng AC4.1–AC4.7 qua `runMode`, AC4.8 qua `node cli/index.mjs mode <tên>` trong repo tạm; chạy `node test/mode.test.mjs`, thấy đỏ.
- [ ] **Step 2:** `cli/lib/mode.mjs`: hàm áp mode (ghi tên mới, `guarded` bỏ khoá), `statusOf` qua `modeName`, dòng `Ý nghĩa:`, dòng gợi ý tên cũ, dòng giá trị không nhận ra, dòng khoá `full*` không tác dụng ở `open`, cảnh báo `open`/`confined` (D8, AC4.4), `GIT_LABEL`/`SETTINGS_LABEL`; `cli/index.mjs` nhận năm tên, usage `guarded|confined|open|status`, help ba định nghĩa; `cli/lib/autonomy.mjs:64` đổi `aip mode confined`. Chạy `node test/mode.test.mjs` và `node test/validate.mjs --only autonomy`, xanh; commit `feat(cli)!: aip mode guarded|confined|open with legacy aliases`.

### Task 8: spec, docs, README, baseline, CHANGELOG
**Kind:** DOCS
**Ước lượng:** 30'
**Phủ AC:** AC5.1, AC5.2, AC5.3, AC5.4, AC5.5
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `docs/specs/baseline/spec.md`
- Modify: `docs/aip-gate.md`
- Modify: `docs/aip-gate_VI.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Modify: `CHANGELOG.md`
- Test: `test/content/29-permission-modes-docs.pin.mjs`
- Test: `test/content/30-permission-modes-phase2-docs.pin.mjs`
- Test: `test/content/34-autonomy-gates.pin.mjs`
- Test: `test/content/55-permission-mode-defs.pin.mjs`

**Interfaces:**
- Consumes: `MODE_DEFS` (Task 7); hành vi của Task 1–7.
- Produces: không có

- [ ] **Step 1:** viết spec: R25 mới (định nghĩa ba mode, bí danh, quy tắc `open` gồm K12–K15 và giới hạn heuristic, quy tắc `confined` không hỏi, `session-start` báo mode, lệnh `aip mode`), đổi R6, R7, R8, R10, R11, R12, R16, R20, R21, R23, R24 (hooks-gates), R4 (cli-wizard), R5 (baseline), Lịch sử và ngày 2026-11-19; `docs/aip-gate*.md` ba mục mở đầu bằng câu định nghĩa, mẫu `guarded`/`confined`/`open`; README hai bản và bullet Safety ở `AGENTS.template.md` + `AGENTS.md` (byte-identical); `CHANGELOG.md` mục breaking dưới `[Unreleased]`.
- [ ] **Step 2:** cập nhật pin 29, 30, 34 theo tên mới; tạo pin 55 so ba câu định nghĩa trong spec, docs, README với `MODE_DEFS` (bản VI) và bảng EN của Global Constraints (bản EN).
- [ ] **Step 3:** đối chiếu khẳng định với code: liệt kê từng tên hàm, khoá, lệnh, giá trị mặc định vừa viết → `file:line` → khớp|lệch; sửa dòng lệch hoặc gắn `[Unverified]`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only spec`, `--only permission-modes-docs`, `--only permission-modes-phase2-docs`, `--only autonomy`, `--only mode-defs` và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-19-permission-modes-standard/ --base master`, xanh; commit `docs(hooks): document guarded/confined/open permission modes`.

### Task 9: bump, build, lock và full suite
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy kiểm chứng, không có hành vi mới để viết test đỏ trước
**Ước lượng:** 15'
**Phủ AC:** AC5.6
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: mọi thay đổi của Task 1–8.
- Produces: không có

- [ ] **Step 1:** bump `core/.manifest.json` `1.34.13` → `1.35.0`; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `git clone -b feature/permission-modes-standard` sang thư mục tạm sạch, chạy `npm test` một lần, exit 0, ghi số pass so với số nền; commit `chore(core): bump core to 1.35.0 for permission modes`.
