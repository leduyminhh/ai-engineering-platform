# hook-roots-list Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** câu `deny` ghi hoặc xoá ngoài root ở chế độ full của `guard-bash` và `guard-files` liệt kê các root có quyền đang thiếu (kiểu `list_roots`, tối đa 6 mục) và do một helper chung dựng, thay vì hai chuỗi viết tay.
**Architecture:** thêm hàm `denyOutsideText(need, grants, subject)` vào `gate-config.mjs`; `guard-bash.mjs` và `guard-files.mjs` gọi nó với `grants` đã tính sẵn trong `decide` (`rootsOf()`) và `confine` (`grantsOf(...)`); không đổi `grantsOf`/`classifyPath` hay logic quyết định `ask`/`deny`.
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

**Điều kiện bắt đầu:** request `2026-11-16-hook-popup-short` đã merge vào `master` (cùng sửa `guard-bash.mjs`, `guard-files.mjs`, R21, README). Trước Task 1: `git rebase master` (hoặc tạo lại nhánh từ master) rồi kiểm lại số dòng của hai câu deny bằng grep `Chế độ full chỉ cho phép`; số dòng trong plan lấy từ master lúc viết (guard-bash ~980, guard-files ~96).

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/gate-config.mjs` | hàm `denyOutsideText(need, grants, subject)` (export): câu deny đầy đủ + dòng root + câu xin thêm quyền | Task 1 |
| `core/hooks/scripts/guard-bash.mjs` | nhánh deny của full (~980) gọi `denyOutsideText(r.deny, rootsOf(), …)` | Task 2 |
| `core/hooks/scripts/guard-files.mjs` | nhánh deny ghi ngoài root của `confine` (~96) gọi `denyOutsideText('write', grants, …)` | Task 2 |
| `test/contract/99-path-permissions.contract.mjs` | bảng ca của helper (AC2.1) và ca deny của hai hook (AC1.1–AC1.5) | Task 1–2 |
| `docs/specs/hooks-gates/spec.md` | R21 (deny thêm dòng root) và R24 (deny nêu root có quyền); Phạm vi; Nguồn; dòng Lịch sử | Task 3 |
| `README.md`, `README_VI.md`, `CHANGELOG.md` | mục Hooks đoạn deny của `fullPaths`; mục CHANGELOG mới | Task 3 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core một bậc patch, lock | Task 4 |

Không đổi: `grantsOf`/`classifyPath`/`allowedRoots`, `guard-mcp`, `gate-stop`, `session-start`, `cli/lib/*`, mọi câu `ask`, `DENY_COMMIT`, `CLAUDE_TMP_BLOCKED_TEXT`; `94-permission-modes`, `99-hook-popup`, `90-hooks`, `97-audit-mustfix` giữ nguyên làm bằng chứng tương thích (AC1.5). Task 1–2 cùng sửa file test nên chạy tuần tự.

## Global Constraints
- Zero-dependency; hook fail-open với lỗi nội bộ: helper ném lỗi thì hai hook rơi về câu deny không có dòng root (giữ `try/catch` quanh lời gọi helper, cùng cách `summarize` hiện đang làm).
- Câu deny gồm ba phần theo thứ tự: `Chế độ full chỉ cho phép <subject> có quyền <need>; đường dẫn chưa có.` (với `subject` là cụm đứng trước "có quyền": `lệnh này ở thư mục` cho `guard-bash`, `ghi vào thư mục` cho `guard-files`) → dòng root (khi có) → `Cần mở rộng → thêm vào "fullPaths" (allow có "<need>") hoặc "fullRoots" trong .claude/aip-gate.json.` Giữ chuỗi `fullPaths`, `fullRoots` và quyền thiếu trong câu (test 94 và 99 kiểm).
- Dòng root: `Được ghi: \`A\`, \`B\`, …` khi `need` là `write`, `Được xoá: …` khi `delete`; mỗi đường dẫn qua `showArg(p, 80)` đặt trong dấu `` ` ``; tối đa 6 mục rồi `, … và N mục khác`; chỉ liệt kê grant có `allow.includes(need)` và không phải glob (`glob: true` của `fullReadRoots`/`defaultReadRoots` bỏ); `need` khác `write`/`delete` hoặc không còn mục nào thì không có dòng; thứ tự giữ như `grantsOf`.
- Không có dữ liệu agent trong dòng root (chỉ gốc project, scratchpad, `fullRoots`, `<tmpdir>/claude`, `fullPaths` do cấu hình); vẫn qua `showArg` để bỏ ký tự điều khiển/bidi/backtick.
- Câu deny tổng không quá ~720 ký tự với 6 mục × 80 ký tự.
- Test dùng seam `bd`/`expectAll` sẵn có của `99-path-permissions.contract.mjs` (`D`/`O`/`T`/`OUT` từ `mkdtemp` dưới `<tmpdir>/aip-…`, `tool: 'Bash'`/`'PowerShell'`, full + bypass); helper kiểm trực tiếp bằng `import` của `gate-config.mjs` với grants dựng tay; mỗi `ok()` ghi ID AC trong thông điệp; dọn bằng `fs.rmSync`, không `rm -rf`; một hàng mỗi hành vi.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ khi gate đạt).
- Mỗi task: test đỏ đúng lý do trước (commit riêng), sửa, test xanh; commit trên nhánh `feature/hook-roots-list` qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`), không `Co-Authored-By`; không push. Test hẹp: `node test/validate.mjs --only path-permissions`, sau khi sửa hook thêm `--only hook` và `--only permission-modes`; `npm test` một lần ở Task 4. Một lệnh Bash mỗi lần gọi.

## Review Focus
- Task 1: `Được ghi:` chỉ chứa root có quyền `write` (không chứa `D` chỉ read, không chứa entry glob), `Được xoá:` chỉ root có `delete`; 8 root ra đúng 6 mục + "… và 2 mục khác" (AC1.3, AC1.4, AC2.1).
- Task 1: đường dẫn root có backtick, xuống dòng, bidi hoặc dài hơn 80 ký tự không chèn dòng giả vào reason (AC1.3).
- Task 2: `rm OUT/f` ra `Được xoá:`, `cp x OUT/b` và `echo x > OUT/f` ra `Được ghi:`, và Write/Edit/MultiEdit/NotebookEdit ở `guard-files` ra `Được ghi:`; câu cũ vẫn chứa `fullPaths`, `fullRoots` và quyền thiếu (AC1.1, AC1.2).
- Task 2: `CLAUDE_TMP_BLOCKED_TEXT`, `DENY_COMMIT` và mọi `ask` không đổi; sau thay không còn chuỗi `Chế độ full chỉ cho phép` ngoài `gate-config.mjs` (AC1.5, AC2.1).
- Task 3: R21, R24 và README khớp code ở ba điểm: dòng root chỉ liệt kê quyền đang thiếu, tối đa 6 mục, `ask` không đổi (AC3.1).

### Task 1: helper denyOutsideText
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.3, AC1.4, AC2.1
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `grantsOf(gate, input)` trả `{ path, allow, glob? }[]`, `showArg(s, max)` của `gate-config.mjs`
- Produces: `` `denyOutsideText(need, grants, subject)` `` (export từ `gate-config.mjs`; trả chuỗi theo Global Constraints)

- [ ] **Step 1:** thêm bảng ca của helper vào `99-path-permissions.contract.mjs` (import `gate-config.mjs`; grants dựng tay): rỗng; một root đủ ba quyền; `T` đủ ba quyền + `O` read+write + `D` chỉ read với `write` (chỉ `T`, `O`) và `delete` (chỉ `T`); chỉ có glob chỉ-đọc → không có dòng; 8 root ghi được → 6 mục + "… và 2 mục khác"; root có backtick, xuống dòng, bidi, 200 ký tự (không chèn dòng, mỗi đường dẫn ≤ 80 ký tự đuôi); `need` là `read` → không có dòng; câu vẫn chứa `fullPaths`, `fullRoots` và quyền thiếu. Chạy `node test/validate.mjs --only path-permissions`: đỏ vì chưa có export. Commit test đỏ riêng: `test(hooks): cover deny text listing writable roots`.
- [ ] **Step 2:** thêm `denyOutsideText` vào `gate-config.mjs` (đặt cạnh `grantsOf`); chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`: xanh, không sửa test cũ.
- [ ] **Step 4:** commit `feat(hooks): add shared deny text that lists roots with the missing permission`.

### Task 2: guard-bash và guard-files dùng helper
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.2, AC1.5, AC2.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `core/hooks/scripts/guard-files.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `` `denyOutsideText(need, grants, subject)` `` của Task 1; `rootsOf()` trong `decide` của `guard-bash.mjs`; biến `grants` trong `confine` của `guard-files.mjs`
- Produces: không có

- [ ] **Step 1:** thêm bảng ca AC1.1 (Bash, full + bypass, `fullPaths` như Review Focus: `rm OUT/f` → `Được xoá:` chỉ `T`; `cp x OUT/b`, `echo x > OUT/f` → `Được ghi:` có `T`, `O`, không `D`; reason có `fullPaths`, `fullRoots`, quyền thiếu), AC1.2 (`guard-files`: Write/Edit/MultiEdit/NotebookEdit vào `OUT/f` → `Được ghi:`) và AC1.5 (deny `<tmpdir>/claude`, `DENY_COMMIT`, các `ask` không đổi; `shapeOk` còn đúng cho `ask`) vào `99-path-permissions.contract.mjs`. Thêm một kiểm AC2.1: đọc `guard-bash.mjs` và `guard-files.mjs` bằng `fs.readFileSync` và khẳng định không còn chuỗi `Chế độ full chỉ cho phép` ngoài `gate-config.mjs`. Chạy `--only path-permissions`: đỏ ở các ca có dòng `Được …` và ca đọc nguồn. Commit test đỏ riêng: `test(hooks): require roots line in deny reasons`.
- [ ] **Step 2:** sửa nhánh deny của `guard-bash.mjs` (`r.blocked ? CLAUDE_TMP_BLOCKED_TEXT : denyOutsideText(r.deny, roots, 'lệnh này ở thư mục')`, `roots` là `rootsOf()` đã tính ở đầu nhánh full) và nhánh deny ghi ngoài root của `confine` trong `guard-files.mjs` (`denyOutsideText('write', grants, 'ghi vào thư mục')`); bọc lời gọi để lỗi của helper rơi về câu không có dòng root (fail-open). Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook` và `--only permission-modes`: xanh, không sửa test cũ.
- [ ] **Step 4:** commit `fix(hooks): list roots with the missing permission in deny reasons`.

### Task 3: spec R21/R24 và README
**Kind:** DOCS
**TDD:** không — chỉ chữ tài liệu, bằng chứng là bước đối chiếu khẳng định với code
**Ước lượng:** 20'
**Phủ AC:** AC3.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CHANGELOG.md`
- Test: `test/content` (các pin liên quan, chạy `node test/validate.mjs --only content`)

**Interfaces:**
- Consumes: chữ và helper đã có ở Task 1–2 (`denyOutsideText`, dòng `Được ghi:`/`Được xoá:`, trần 6 mục, `showArg(…, 80)`)
- Produces: không có

- [ ] **Step 1:** sửa R21 (câu `deny` của full ngoài root thêm một dòng liệt kê root có quyền đang thiếu; `ask` và `deny` khác không đổi) và R24 (deny của `guard-files`/`guard-bash` nêu `fullPaths`, `fullRoots`, quyền thiếu và các root có quyền đó, tối đa 6 mục) trong `docs/specs/hooks-gates/spec.md`; thêm nguồn `2026-11-16-hook-roots-list` (đổi), dòng "Gồm" ở Phạm vi và dòng Lịch sử cho R21 và R24 theo khuôn các dòng có sẵn. Sửa `README.md` và `README_VI.md` mục Hooks (đoạn deny của `fullPaths`, grep `fullPaths` để tìm), thêm mục vào `CHANGELOG.md` theo khuôn các mục `### Changed`.
- [ ] **Step 2:** đối chiếu khẳng định với code: liệt kê từng khẳng định kiểm được (trần 6 mục, `showArg(…, 80)`, chỉ liệt kê root có quyền đang thiếu, bỏ glob, `ask` và deny tmp không đổi, `Được ghi:`/`Được xoá:`) và grep `gate-config.mjs`, `guard-bash.mjs`, `guard-files.mjs`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch` hoặc gắn `[Unverified]`.
- [ ] **Step 3:** chạy `node test/validate.mjs --only content` và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-16-hook-roots-list/ --base master`: không còn W13 của `hooks-gates`.
- [ ] **Step 4:** commit `docs(hooks): describe roots line in deny reasons`.

### Task 4: bump version, build, lock
**Kind:** TOOLING
**TDD:** không — chỉ bump số version, đã có cổng `versions.mjs --lock` và `npm test` kiểm
**Ước lượng:** 15'
**Phủ AC:** AC3.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: nội dung hook đã đổi ở Task 1–2
- Produces: không có

- [ ] **Step 1:** tăng `version` trong `core/.manifest.json` một bậc patch từ giá trị hiện tại; sửa số version nếu `CHANGELOG.md` của Task 3 đã ghi số khác; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `npm test` một lần (không chạy lại sau từng vòng sửa); xanh mới sang review cuối.
- [ ] **Step 3:** commit `chore(core): bump for deny roots list`.
