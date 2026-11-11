# Một luồng đọc aip-gate.json Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** mọi hook, lệnh CLI và script `autonomy.mjs` đọc `.claude/aip-gate.json` qua một module `gate-file.mjs`, theo một bảng khoá có mức tin cậy; khoá nới quyền trong file đã bị git theo dõi bị bỏ qua.
**Architecture:** module zero-dep `core/hooks/scripts/gate-file.mjs` (nguồn) + bản sao byte-identical `core/skills/plan-execution/scripts/gate-file.mjs`; `gate-config.mjs` dựng `resolveGate` trên `locateGate` và re-export `gateTracked`; consumer gọi `trustedValue` cho khoá `untracked`.
**Tech Stack:** Node.js 20+ ESM thuần, chỉ built-in `node:`; test bằng script Node của repo (`npm test`).
**Spec:** design.md
**Requirement:** requirement.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/gate-file.mjs` | đọc file, tìm theo worktree → repo chính, kiểm tracked, bảng khoá, `trustedValue`, `lintGate` | Task 1 |
| `core/skills/plan-execution/scripts/gate-file.mjs` | bản sao byte-identical cho script tự đứng | Task 1 |
| `test/contract/98-gate-file.contract.mjs` | vector của module, byte-identical, quét import, quét hàm đọc cũ, chạy script từ bản sao | Task 1, Task 4 |
| `core/hooks/scripts/gate-config.mjs` | `resolveGate` trên `locateGate`, re-export `gateTracked`/`lsFiles`, `envFilesAllowed` qua `trustedValue` | Task 2 |
| `core/hooks/scripts/gate-stop.mjs` | `stopGate`/`exemptAgents` qua `trustedValue`, thông điệp chặn theo A9 | Task 2 |
| `core/hooks/scripts/session-start.mjs` | handoff dùng `gateTracked` | Task 2 |
| `test/contract/90-hooks.contract.mjs` | ca allowEnvFiles/stopGate/exemptAgents/reason/handoff | Task 2 |
| `test/contract/93-hooks-worktree.contract.mjs`, `test/contract/94-permission-modes.contract.mjs`, `test/contract/97-audit-mustfix.contract.mjs` | giữ xanh (import `gateTracked`/`resolveGate`) | Task 2 |
| `cli/lib/mode.mjs` | `aip mode` dùng `locateGate`, hỏng → exit 1, dòng status mới, quy tắc chép A7 | Task 3 |
| `cli/lib/autonomy.mjs` | `aip autonomy` dùng `locateGate`, dòng status mới, quy tắc chép A7 | Task 3 |
| `test/mode.test.mjs`, `test/content/34-autonomy-gates.pin.mjs` | ca CLI mode/autonomy | Task 3 |
| `cli/lib/init.mjs` | `readAllowEnvFiles` qua `locateGate` + `trustedValue`, hỏng → ném lỗi trước mọi ghi | Task 4 |
| `core/skills/plan-execution/scripts/autonomy.mjs` | import bản sao, bỏ parser và `trackedByGit` riêng | Task 4 |
| `test/init.test.mjs`, `test/content/48-ask-execution-mode.pin.mjs` | ca init, giữ xanh pin autonomy | Task 4 |
| `docs/specs/hooks-gates/spec.md`, `docs/specs/cli-wizard/spec.md` | spec sống R20, R19, R4, R6, R8 | Task 5 |
| `CLAUDE.md`, `README.md`, `README_VI.md` | câu mô tả khoá aip-gate.json (chỉ nơi có nhắc `allowEnvFiles`/`stopGate`) | Task 5 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump version core, lock | Task 5 |

## Global Constraints
- Khoá `trust: 'untracked'` (đúng 6): `mode`, `autonomy`, `allowEnvFiles`, `stopGate`, `exemptAgents`, `testCommands` (thêm khi thực thi Task 5, người dùng duyệt).
- Khoá `trust: 'any'` (đúng 12): `fullKeep`, `fullRoots`, `fullReadRoots`, `mcpAllow`, `mcpDeny`, `bootstrapInject`, `handoffInject`, `ledgerInject`, `resumeWarn`, `handoffPath`, `handoffMaxAgeHours`, `statusStaleMinutes`. `calc: 6 + 12 = 18`.
- Kiểu trong `GATE_KEYS`: `mode`/`handoffPath` string; `autonomy` object; `allowEnvFiles`/`stopGate`/`bootstrapInject`/`handoffInject`/`ledgerInject`/`resumeWarn` boolean; `exemptAgents`/`fullKeep`/`fullRoots`/`fullReadRoots`/`mcpAllow`/`mcpDeny`/`testCommands` array; `handoffMaxAgeHours`/`statusStaleMinutes` number.
- `trustedValue`: khoá `any` → trả nguyên, không gọi git; khoá `untracked` → trả giá trị khi `gate.inRepo === false` hoặc `tracked(file) === false`; `true` hoặc `null` → `undefined`. Chỉ gọi git khi khoá `untracked` có trong config.
- File hỏng: hook và script coi như không có cấu hình, im lặng, vẫn che file repo chính (hooks-gates/R9); CLI (`aip mode`, `aip autonomy`, `aip init --full`) in đường dẫn file hỏng ra stderr, exit 1, không ghi file nào.
- `gate-file.mjs` chỉ import specifier `node:`; hai bản giống hệt byte (so sau chuẩn hoá `\r\n`). Sửa một bản thì chép sang bản kia.
- `fullEffective` không đổi code và seam (A12). Hook không thêm cảnh báo mới; lỗi nội bộ fail-open.
- Chép khoá sang file worktree (A7): file repo chính bị theo dõi hoặc không xác định → không chép 6 khoá `untracked`; không bị theo dõi → chép như trước; `mode` luôn bị bỏ khi chép từ repo chính.
- UTF-8 không BOM, LF; comment theo mục Comments của `AGENTS.md` (tiếng Việt có dấu, chỉ giải thích *vì sao*).
- Commit mỗi task qua `core:git-workflow`: header `type(scope): summary` tiếng Anh, body tiếng Việt có dấu, `git commit -F`, không dòng `Co-Authored-By`.

## Review Focus
- Đường chép khoá repo chính → worktree (A7) đưa lại hiệu lực cho khoá đã bị bỏ qua: ca tracked/untracked trong `test/mode.test.mjs` và `test/content/34-autonomy-gates.pin.mjs` (Task 3).
- Phiên thường spawn thêm `git ls-files`: ca đếm lời gọi của AC2.3 trong `test/contract/98-gate-file.contract.mjs` (Task 1).
- File worktree hỏng che file repo chính ở CLI và script (không rơi về repo chính, không ghi): ca AC4.1 ở Task 3 và Task 4, ca AC3.4 ở Task 2.
- Tổng quát hoá nhánh `.claude` symlink của `gateTracked` (A4) đổi kết quả cho file cấu hình: các ca symlink hiện có của `test/contract/94-permission-modes.contract.mjs` giữ xanh (Task 2).
- `exemptAgents` bị bỏ qua phải rơi về đúng `DEFAULT_EXEMPT_AGENTS`, không về mảng rỗng: ca AC3.2 trong `test/contract/90-hooks.contract.mjs` (Task 2).

### Task 1: Module gate-file.mjs và contract test
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC2.1, AC2.2, AC2.3, AC2.4, AC5.1
**Files:**
- Create: `core/hooks/scripts/gate-file.mjs`
- Create: `core/skills/plan-execution/scripts/gate-file.mjs`
- Test: `test/contract/98-gate-file.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `readGateAt(root)` → `null | { invalid: true } | { config }`; `locateGate(cwd, { git })` → `{ inRepo, top, main, roots, file, config, source, mainInvalid }` (`source` ∈ `'worktree' | 'main' | 'worktree-invalid' | null`; `mainInvalid` là đường dẫn file repo chính hỏng hoặc `null`; seam `git(args, cwd)` trả stdout đã trim, ném khi lỗi); `gateTracked(file, { run })` → `true | false | null`; `lsFiles(dir, spec)`; `GATE_KEYS` (object tên khoá → `{ type, trust }`); `trustedValue(gate, key, { tracked })`; `lintGate(config)` → `{ unknown: string[], badType: string[] }`

- [ ] **Step 1:** Đọc `core/hooks/scripts/gate-config.mjs` (`readState`, `resolveGate`, `gateTracked`, `lsFiles`) và `core/skills/plan-execution/scripts/autonomy.mjs` (`locate`, `readGateAt`) để giữ nguyên hành vi R4/R6/R9 khi gom lại; đọc cách test contract khác đăng ký với `test/validate.mjs` (vd `test/contract/97-audit-mustfix.contract.mjs`).
- [ ] **Step 2:** Viết `test/contract/98-gate-file.contract.mjs` (import từ `core/hooks/scripts/gate-file.mjs`), các ca đỏ:
  - AC1.1: một test tham số trên repo git tạm (và worktree, submodule, thư mục ngoài git): thiếu → `config: null`; JSON hỏng / mảng / `null` / chuỗi → `source: 'worktree-invalid'`, không rơi về repo chính; BOM → đọc được; worktree trống cạnh repo chính hợp lệ → `source: 'main'`; repo chính hỏng, worktree trống → `config: null`, `mainInvalid` là đường dẫn; submodule → `main` là gốc submodule; ngoài repo → `inRepo: false`, đọc `<cwd>/.claude/aip-gate.json`.
  - AC2.1: `Object.keys(GATE_KEYS).length === 18`, đúng 5 khoá `untracked` và 13 khoá `any` theo Global Constraints, mỗi khoá có `type`.
  - AC2.2: một test tham số 5 khoá × 4 trạng thái (seam `tracked` trả `false`/`true`/`null`, và `gate.inRepo === false`).
  - AC2.3: khoá `any` ở 4 trạng thái trả nguyên giá trị, seam `tracked` được gọi 0 lần; config không có khoá `untracked` → 0 lời gọi; `gateTracked` với seam `run` đếm tối đa 2 lời gọi mỗi file.
  - AC2.4: `lintGate({ foo: 1, stopGate: 'no', mcpAllow: 'a' })` → `unknown: ['foo']`, `badType` chứa `stopGate`, `mcpAllow`; config hợp lệ → hai mảng rỗng.
  - AC5.1: hai file `gate-file.mjs` giống hệt byte sau chuẩn hoá `\r\n`; lệch thì thông báo nêu tên hai file.
- [ ] **Step 3:** Chạy `node test/validate.mjs --only gate-file` → thấy đỏ (module chưa có).
- [ ] **Step 4:** Viết `core/hooks/scripts/gate-file.mjs` theo Interfaces (chuyển `gateTracked`/`lsFiles`/cache từ `gate-config.mjs`, nhánh symlink theo A4: hỏi thư mục cha trực tiếp của file); chép nguyên byte sang `core/skills/plan-execution/scripts/gate-file.mjs`. Chưa sửa consumer nào.
- [ ] **Step 5:** Chạy `node test/validate.mjs --only gate-file` → xanh; chạy `node test/validate.mjs --only hooks` → vẫn xanh (consumer chưa đổi).
- [ ] **Step 6:** Commit `feat(core): add gate-file module for aip-gate.json`.

### Task 2: Hook dùng gate-file.mjs
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`
- Modify: `core/hooks/scripts/gate-stop.mjs`
- Modify: `core/hooks/scripts/session-start.mjs`
- Test: `test/contract/90-hooks.contract.mjs`
- Test: `test/contract/93-hooks-worktree.contract.mjs` (giữ xanh, import resolveGate)
- Test: `test/contract/94-permission-modes.contract.mjs` (giữ xanh, import gateTracked)
- Test: `test/contract/97-audit-mustfix.contract.mjs` (giữ xanh)

**Interfaces:**
- Consumes: `locateGate(cwd, { git })`, `gateTracked(file, { run })`, `lsFiles(dir, spec)`, `trustedValue(gate, key, { tracked })`
- Produces: `resolveGate(dir)` (ngoài repo vẫn `null`; thêm trường `inRepo: true`), re-export `gateTracked` và `lsFiles` từ `gate-config.mjs`

- [ ] **Step 1:** Thêm ca đỏ vào `test/contract/90-hooks.contract.mjs` (seam `tracked`/`loadConfig` có sẵn của hook):
  - AC3.1: `allowEnvFiles: true` + file bị theo dõi hoặc không xác định → `guard-bash`/`guard-files` vẫn hỏi với `.env`; không bị theo dõi → không hỏi.
  - AC3.2: `stopGate: false` và `exemptAgents: ["x"]` + file bị theo dõi/không xác định → gate vẫn chặn, `exemptAgents` = `DEFAULT_EXEMPT_AGENTS`; không bị theo dõi → như hiện nay.
  - AC3.3: `reason` khi chặn: file bị theo dõi/không xác định → không có `"stopGate": false`, chỉ còn `AIP_STOP_GATE=off`; file thiếu hoặc không bị theo dõi → còn cả hai.
  - AC3.4: worktree có file hỏng, repo chính hợp lệ → hook coi cấu hình là none, stderr rỗng, không chặn.
  - AC3.5: handoff bị bỏ khi `tracked` trả `true`, được nạp khi `false` hoặc `null`.
- [ ] **Step 2:** Chạy `node test/validate.mjs --only hooks` → thấy các ca mới đỏ.
- [ ] **Step 3:** Sửa `gate-config.mjs`: `resolveGate` dựng trên `locateGate` (ngoài repo trả `null`), bỏ `readState`/`gateTracked`/`lsFiles`/cache cục bộ và re-export từ `gate-file.mjs`; `envFilesAllowed` dùng `trustedValue(gate, 'allowEnvFiles')`; giữ nguyên `fullEffective` (A12). Sửa `gate-stop.mjs`: `stopGate`/`exemptAgents` qua `trustedValue`, dựng `reason` theo A9 (hỏi git chỉ khi chặn). Sửa `session-start.mjs`: bỏ `trackedByGit`, `d.tracked` mặc định là `(p) => gateTracked(p) === true`.
- [ ] **Step 4:** Chạy `node test/validate.mjs --only hooks` và `node test/validate.mjs --only permission` → xanh; AC3.6: các ca `fullEffective` của `94-permission-modes.contract.mjs` xanh không sửa ngữ nghĩa.
- [ ] **Step 5:** Commit `refactor(core): read aip-gate.json through gate-file in hooks`.

### Task 3: aip mode và aip autonomy dùng gate-file.mjs
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC4.1, AC4.2, AC4.3, AC4.5
**Files:**
- Modify: `cli/lib/mode.mjs`
- Modify: `cli/lib/autonomy.mjs`
- Test: `test/mode.test.mjs`
- Test: `test/content/34-autonomy-gates.pin.mjs`

**Interfaces:**
- Consumes: `locateGate(cwd, { git })`, `trustedValue(gate, key, { tracked })`, `lintGate(config)`, `GATE_KEYS`, `gateTracked(file, { run })`
- Produces: không có

- [ ] **Step 1:** Thêm ca đỏ (repo git tạm, seam `run` có sẵn của `gitStateOf`):
  - AC4.1: file worktree hỏng, và riêng ca file repo chính hỏng khi worktree trống → `aip mode full|ask|status` và `aip autonomy high|safe|status` in đường dẫn file hỏng ra stderr, exit 1, không ghi `aip-gate.json` hay `settings.json`.
  - AC4.2: file bị theo dõi (và ca không xác định) có `stopGate: false`, `allowEnvFiles: true` → cả hai lệnh `status` in một dòng nêu từng khoá bị bỏ qua kèm lý do; không có khoá bị bỏ qua thì không có dòng đó.
  - AC4.3: file có `foo` và `stopGate: "no"` → `status` in dòng khoá lạ và dòng khoá sai kiểu kèm kiểu cần có; file sạch thì không.
  - AC4.5: worktree trống, repo chính bị theo dõi chứa `allowEnvFiles`, `stopGate`, `exemptAgents`, `autonomy`, `mode`, một khoá `any` và khoá lạ → file worktree sau `aip mode full` và sau `aip autonomy high` không chứa 5 khoá `untracked` cũ (`aip autonomy high` chỉ ghi bộ `high`), vẫn chứa khoá `any` và khoá lạ; repo chính không bị theo dõi → 4 khoá đầu được chép, `mode` vẫn bị bỏ.
- [ ] **Step 2:** Chạy `node test/mode.test.mjs` và `node test/validate.mjs --only autonomy` → thấy các ca mới đỏ.
- [ ] **Step 3:** Sửa `mode.mjs` (bỏ `locateGate`/`readText` đọc riêng, dùng `locateGate` của module; dòng status mới; lọc khoá khi chép từ repo chính theo A7) và `autonomy.mjs` (bỏ `readAt`/`gateOf`; `bad` từ `source === 'worktree-invalid'` hoặc `mainInvalid`; status và chép như `mode.mjs`). Hàm thuần `applyFull`/`applyAsk`/`statusOf` giữ chữ ký.
- [ ] **Step 4:** Chạy `node test/mode.test.mjs` và `node test/validate.mjs --only autonomy` → xanh.
- [ ] **Step 5:** Commit `refactor(cli): use gate-file in aip mode and aip autonomy`.

### Task 4: aip init và script autonomy.mjs dùng gate-file.mjs
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.2, AC4.1, AC4.4, AC5.2, AC5.3
**Files:**
- Modify: `cli/lib/init.mjs`
- Modify: `core/skills/plan-execution/scripts/autonomy.mjs`
- Test: `test/init.test.mjs`
- Test: `test/contract/98-gate-file.contract.mjs`
- Test: `test/content/34-autonomy-gates.pin.mjs` (giữ xanh)
- Test: `test/content/48-ask-execution-mode.pin.mjs` (giữ xanh)

**Interfaces:**
- Consumes: `locateGate(cwd, { git })`, `trustedValue(gate, key, { tracked })` (bản ở `core/skills/plan-execution/scripts/gate-file.mjs` cho script)
- Produces: không có

- [ ] **Step 1:** Ca đỏ:
  - AC4.1 (init): đổi ca `JSON hỏng` ở `test/init.test.mjs` (hiện kỳ vọng `false`) thành: `aip init --full` với file hỏng → stderr nêu đường dẫn, exit 1, không ghi `settings.json` hay `AGENTS.md`.
  - AC4.4: `allowEnvFiles: true` → file không bị theo dõi hoặc thư mục ngoài repo git → `settings.json` không có quy tắc `.env`; file bị theo dõi (và ca không xác định) → có quy tắc `.env`.
  - AC1.2 trong `98-gate-file.contract.mjs`: quét `core/` và `cli/` (trừ hai `gate-file.mjs`): không còn định nghĩa `readState`, `readAt`, `readGateAt`, `gateOf`, `trackedByGit`, `locateGate` (ngoài `gate-file.mjs`), và `readAllowEnvFiles` không gọi `readFileSync`.
  - AC5.2, AC5.3 trong `98-gate-file.contract.mjs`: chỉ có import `node:` trong `gate-file.mjs`; chép `core/skills/plan-execution/scripts` sang thư mục tạm không có `core/hooks` và `cli`, chạy `node autonomy.mjs` trong repo git tạm → exit 0, in JSON bốn khoá; cùng bản chép đó, `aip-gate.json` đã commit có `autonomy.mergeLocal: true` → in mặc định (R15 vẫn đúng khi chạy từ bản sao; pin 34 và 48 phủ phần còn lại từ nguồn).
- [ ] **Step 2:** Chạy `node test/init.test.mjs` và `node test/validate.mjs --only gate-file` → thấy đỏ.
- [ ] **Step 3:** Sửa `init.mjs` (`readAllowEnvFiles` qua `locateGate` + `trustedValue`; file hỏng → ném lỗi trước vòng ghi file, `cli/index.mjs` in lỗi và exit 1 như lỗi init khác) và `autonomy.mjs` của plan-execution (import `./gate-file.mjs`, bỏ `trackedByGit`/`readGateAt`/`locate`; giữ seam `deps.git`, `deps.tracked`; giữ hành vi R15 kể cả `--set`).
- [ ] **Step 4:** Chạy `node test/init.test.mjs`, `node test/validate.mjs --only gate-file` và `node test/validate.mjs --only autonomy` → xanh; AC5.3: hai pin 34 và 48 xanh không sửa ngữ nghĩa.
- [ ] **Step 5:** Commit `refactor(cli): use gate-file in aip init and autonomy script`.

### Task 5: Spec sống, tài liệu và version
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC6.1, AC6.2
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/cli-wizard/spec.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs` (chạy cả bộ qua `npm test`)

**Interfaces:**
- Consumes: `GATE_KEYS`
- Produces: không có

- [ ] **Step 1:** `docs/specs/hooks-gates/spec.md`: thêm R20 theo đoạn R20 ở `design.md` (bảng 18 khoá, tên khớp `GATE_KEYS`, chính sách tin cậy, file hỏng, module duy nhất + bản sao byte-identical), đổi R19 (handoff dùng `gateTracked`, icase, symlink), thêm dòng Lịch sử trỏ request này. `docs/specs/cli-wizard/spec.md`: đổi R4, R6 (dòng status khoá bị bỏ qua/lạ/sai kiểu, file hỏng exit 1, quy tắc chép A7), R8 (`aip init --full` với file hỏng hoặc `allowEnvFiles` trong file bị theo dõi), thêm dòng Lịch sử.
- [ ] **Step 2:** `CLAUDE.md`, `README.md`, `README_VI.md`: chỉ sửa câu mô tả `allowEnvFiles`/`stopGate`/`exemptAgents` để nêu chúng chỉ có hiệu lực từ file không bị git theo dõi; không viết lại đoạn khác.
- [ ] **Step 3:** Đối chiếu khẳng định với code: liệt kê từng tên khoá, mặc định, mã thoát, đường dẫn vừa viết; grep `core/hooks/scripts/gate-file.mjs`, `cli/lib/mode.mjs`, `cli/lib/autonomy.mjs`, `cli/lib/init.mjs`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; dòng lệch sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 4:** Bump `core/.manifest.json` lên version lớn hơn `1.33.1` (patch), chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 5:** Chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-11-aip-gate-config-flow/ --base master` → không W10–W14; chạy `npm test` → exit 0.
- [ ] **Step 6:** Commit `docs(specs): record aip-gate key trust policy`.
