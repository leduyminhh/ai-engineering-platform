# hook-popup-short Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** popup `ask` của `guard-bash` và `guard-files` chỉ nói đang làm gì và đụng đường dẫn/nhánh nào: một câu ngắn, không câu khuyên cho phép hay từ chối; dòng `Lệnh gồm` giữ nhưng tối đa 3 bước.
**Architecture:** sửa chữ tại chỗ (các hằng `*_TEXT`, `pushText`, `secretText` ở `guard-bash.mjs`; `guardConfigAsk` và ba câu của `confine` ở `guard-files.mjs`), rút `MAX_STEPS` và độ dài đường dẫn của `summarize`, cho `summarize` nhận số bước tối đa và `export` để test; đổi khuôn `shapeOk` ở hai file test.
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | chữ mới của `PUSH_TEXT`, `pushText`, `CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`, `FULL_NO_BYPASS_TEXT`, `secretText`, `UNPARSABLE_TEXT` (Task 1); `MAX_STEPS` 3, tham số `max` và `export` của `summarize`, đường dẫn 40 ký tự (Task 2) | Task 1–2 |
| `core/hooks/scripts/guard-files.mjs` | chữ mới của `guardConfigAsk` và ba câu `ask` trong `confine` (Task 1); `deny` không đổi | Task 1 |
| `test/contract/99-hook-popup.contract.mjs` | `shapeOk` và `BANNED` (Task 1); ca 8 bước và ca "không giấu lệnh" của dòng `Lệnh gồm` (Task 2) | Task 1–2 |
| `test/contract/99-path-permissions.contract.mjs` | bản sao `shapeOk` (Task 1); ca dòng `Lệnh gồm` nếu lệch số bước (Task 2) | Task 1–2 |
| `docs/specs/hooks-gates/spec.md` | R21 theo khuôn mới; Phạm vi; Nguồn; dòng Lịch sử | Task 3 |
| `README.md`, `README_VI.md`, `CHANGELOG.md` | mục Hooks, đoạn mô tả popup và dòng `Lệnh gồm` (dòng ~341 và ~345); mục CHANGELOG mới | Task 3 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core 1.33.23 → 1.33.24, lock | Task 4 |

Không đổi: `gate-config.mjs`, `guard-mcp.mjs`, `gate-stop.mjs`, `session-start.mjs`, `cli/lib/*`, logic quyết định `ask`/`deny` và mọi câu `deny`; `90-hooks`, `94-permission-modes`, `97-audit-mustfix` giữ nguyên làm bằng chứng tương thích (grep xem còn ca nào ghim chữ cũ thì sửa ở Task 1). Task 1–2 cùng sửa `guard-bash.mjs` và cùng file test nên chạy tuần tự.

## Global Constraints
- Zero-dependency; hook fail-open với lỗi nội bộ (`summarize` lỗi chỉ mất dòng tóm tắt); không đổi khi nào hook hỏi hay chặn; không đổi câu `deny`, `DENY_COMMIT`, `CLAUDE_TMP_BLOCKED_TEXT`.
- Khuôn reason `ask`: dòng 1 là một câu `<việc> <token>.`, không "Agent muốn", không lý do, không `cho phép`, `từ chối`, `nên `, `hãy `, `khuyên`; dòng 2 (chỉ `guard-bash`) là `Lệnh gồm: …`; tối đa 2 dòng, câu chính tối đa 500 ký tự, tổng dưới 1200 ký tự khi dữ liệu agent dài; dữ liệu agent đi qua `showArg` (giữ nguyên).
- Chữ mới nguyên văn (token trong `` ` ``): ``Đẩy code lên nhánh bảo vệ `master`.``; `Force push: ghi đè nhánh trên remote.`; `Push vào nhánh chưa rõ (tên nhánh hoặc thư mục là biến).`; ``Ghi vào file cấu hình quyền (`.claude/aip-gate.json` hoặc `settings.json`).`` (guard-bash) và ``Ghi vào file cấu hình quyền `aip-gate.json`.`` (guard-files, tên file qua `showArg(path.basename)`); ``Ghi hoặc xoá ở đường dẫn chưa rõ (`$VAR`, `~`, `*`).``; `Đọc file ngoài các thư mục được cấp quyền đọc.`; ``Lệnh đẩy code, gọi mạng hoặc deploy; project bật chế độ full nhưng phiên này vẫn hỏi. Đổi: `aip mode ask`.``; ``Lệnh nhắc tới file bí mật `<tên>`.``; `Lệnh commit có dấu nháy chưa đóng, không đọc chắc được.`; guard-files: ``Ghi|Đọc đường dẫn chưa rõ `<đường dẫn>`.``, ``Ghi|Đọc file bí mật `<đường dẫn>` ở thư mục chưa đủ quyền đọc, ghi, xoá.``, ``Đọc file ngoài thư mục project `<đường dẫn>`.``
- `Lệnh gồm`: tối đa 3 bước rồi `, … và N bước khác`; đường dẫn trong mỗi bước `showArg(…, 40)`; `summarize(cmd, msys = true, max = MAX_STEPS)` và `export` chỉ để test.
- Test: bảng ca sẵn có của `99-hook-popup.contract.mjs` (một hàng mỗi nhánh); không ghim cả câu, chỉ khuôn (từ cấm, không chữ khuyên, ≤ 500 ký tự, ≤ 2 dòng) và token khớp; mỗi `ok()` ghi ID AC trong thông điệp; dọn tạm bằng `fs.rmSync`, không `rm -rf`.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ khi gate đạt); comment cũ nói về khuôn "cho phép thì sao, nên chọn gì" phải sửa theo khuôn mới.
- Mỗi task: test đỏ đúng lý do trước (commit riêng), sửa, test xanh; commit trên nhánh `feature/hook-popup-short` qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`), không `Co-Authored-By`; không push. Test hẹp: `node test/validate.mjs --only hook-popup` và `--only path-permissions`, sau khi sửa hook thêm `--only hook`; `npm test` một lần ở Task 4. Một lệnh Bash mỗi lần gọi.

## Review Focus
- Task 1: mọi nhánh `ask` của hai hook vẫn nêu token khớp (`master`, `.env`, `server.pem`, đường dẫn), `allowEnvFiles` bật thì không nêu `.env`; `deny` nhắc `fullRoots`/`fullPaths` không đổi (AC1.2, AC1.4).
- Task 1: đường dẫn agent có xuống dòng, backtick, bidi, 900 ký tự vẫn không chèn dòng giả vào reason (AC1.5).
- Task 2: các ca "không giấu lệnh" (heredoc, `<<EOF` trong nháy, `bash -c`, nháy chưa đóng, `$( )`) chuyển sang `summarize(cmd, true, 99)` mà vẫn kiểm đúng điều cũ; lệnh 8 bước ra 3 bước và "5 bước khác" (AC1.3).
- Task 3: R21 và README khớp code về ba điểm: không câu khuyên, 3 bước, 40 ký tự đường dẫn (AC2.1).

### Task 1: chữ ask mới và khuôn test
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.2, AC1.4, AC1.5
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `core/hooks/scripts/guard-files.mjs`
- Modify: `test/contract/99-hook-popup.contract.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `showArg(s, max)` của `gate-config.mjs`, hàm `ask(text)` trong `decide` của `guard-bash.mjs`, `confine` và `guardConfigAsk` của `guard-files.mjs`
- Produces: `` `shapeOk(reason)` `` (hàm test cục bộ, khuôn mới: không `BANNED`, không `cho phép|từ chối|nên |hãy |khuyên|Agent muốn`, câu chính ≤ 500 ký tự, ≤ 2 dòng); chữ mới của các hằng `*_TEXT` (Global Constraints)

- [ ] **Step 1:** đổi `shapeOk` ở `99-hook-popup.contract.mjs` và bản sao ở `99-path-permissions.contract.mjs` theo khuôn mới; thêm ca `guard-bash` đọc ngoài thư mục được cấp (full, đọc đường dẫn ngoài root) vào bảng ca; giữ nguyên các ca token khớp, `deny`, dữ liệu agent. Chạy `node test/validate.mjs --only hook-popup` và `--only path-permissions`: đỏ ở mọi ca `ask` còn câu cũ, xanh ở `deny` và ca token riêng. Grep `test/` tìm ca ghim chữ `ask` cũ (`90-hooks`, `94-permission-modes`, `97-audit-mustfix`) và sửa cho khớp khuôn nếu có. Commit test đỏ riêng: `test(hooks): require short ask reasons without advice`.
- [ ] **Step 2:** sửa chữ ở `guard-bash.mjs` (`PUSH_TEXT`, `pushText`, `CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`, `FULL_NO_BYPASS_TEXT`, `secretText`, `UNPARSABLE_TEXT`) và `guard-files.mjs` (`guardConfigAsk`, ba câu `ask` trong `confine`) theo Global Constraints; sửa comment mô tả khuôn cũ. Không đổi nhánh quyết định.
- [ ] **Step 3:** chạy `--only hook-popup`, `--only path-permissions`, `--only hook`: xanh.
- [ ] **Step 4:** commit `fix(hooks): shorten ask popup reasons to action and path`.

### Task 2: dòng Lệnh gồm tối đa 3 bước
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-hook-popup.contract.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-hook-popup.contract.mjs`

**Interfaces:**
- Consumes: `` `summarize(cmd, msys)` `` và `MAX_STEPS` của `guard-bash.mjs`, `showArg`
- Produces: `` `summarize(cmd, msys = true, max = MAX_STEPS)` `` được `export` từ `guard-bash.mjs`

- [ ] **Step 1:** sửa test: ca 8 bước kỳ vọng `5 bước khác` và chỉ 3 bước; đường dẫn trong bước tối đa 40 ký tự cuối; các ca "không giấu lệnh" (heredoc `cat > file <<EOF`, `<<EOF` trong nháy, `bash -c`, nháy chưa đóng, `$( )`, `cat x | bash <<EOF`, delimiter dính chữ) đọc dòng tóm tắt bằng `gb.summarize(cmd, true, 99)` thay vì dòng trong reason; giữ ca `git add && git commit && git push` theo thứ tự (đủ 3 bước), ca dòng giả/bidi/backtick và ca 100k ký tự. Chạy `--only hook-popup` và `--only path-permissions`: đỏ ở ca 3 bước, 40 ký tự và `summarize` chưa export. Commit test đỏ riêng: `test(hooks): cover three-step command summary`.
- [ ] **Step 2:** `MAX_STEPS` 3; `summarize(cmd, msys = true, max = MAX_STEPS)` dùng `max` thay `MAX_STEPS` ở cả hai chỗ; `showArg(w.targets[ti], 40)`; `export function summarize`. Chạy `--only hook-popup`, `--only path-permissions`, `--only hook`: xanh.
- [ ] **Step 3:** commit `fix(hooks): cap command summary at three steps`.

### Task 3: spec R21 và README
**Kind:** DOCS
**TDD:** không — chỉ chữ tài liệu, bằng chứng là bước đối chiếu khẳng định với code
**Ước lượng:** 25'
**Phủ AC:** AC2.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CHANGELOG.md`
- Test: `test/content` (các pin liên quan, chạy `node test/validate.mjs --only content`)

**Interfaces:**
- Consumes: chữ và hằng đã sửa ở Task 1–2 (`MAX_STEPS`, `summarize`, khuôn `shapeOk`)
- Produces: không có

- [ ] **Step 1:** sửa R21 trong `docs/specs/hooks-gates/spec.md`: câu `ask` của `guard-bash` và `guard-files` là một câu việc + token, không câu khuyên, không "vì sao hỏi"; `Lệnh gồm` tối đa 3 bước, đường dẫn 40 ký tự cuối; `deny`/`DENY_COMMIT` giữ nhắc `fullRoots`/`fullPaths`; giữ phần dữ liệu agent qua `showArg` và nhãn đọc/xoá/ghi; thêm nguồn `2026-11-16-hook-popup-short` (đổi), dòng "Gồm" ở Phạm vi và dòng Lịch sử `hooks-gates/R21 | đổi`. Sửa `README.md` và `README_VI.md` mục Hooks (đoạn popup/dòng `Lệnh gồm`, dòng ~341 và ~345) và thêm mục vào `CHANGELOG.md` theo khuôn các mục cũ.
- [ ] **Step 2:** đối chiếu khẳng định với code: liệt kê từng khẳng định kiểm được (số bước 3, 40 ký tự, mọi câu `ask` mới, `deny` không đổi, `aip mode ask`) và grep `guard-bash.mjs`/`guard-files.mjs`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 3:** chạy `node test/validate.mjs --only content` và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-16-hook-popup-short/ --base master`: không còn W13 của `hooks-gates`.
- [ ] **Step 4:** commit `docs(hooks): describe short ask popup in R21 and README`.

### Task 4: bump version, build, lock
**Kind:** TOOLING
**TDD:** không — chỉ bump số version, đã có cổng `versions.mjs --lock` và `npm test` kiểm
**Ước lượng:** 15'
**Phủ AC:** AC2.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: nội dung hook đã đổi ở Task 1–2
- Produces: không có

- [ ] **Step 1:** `core/.manifest.json` 1.33.23 → 1.33.24; `npm run build`; `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `npm test` một lần (không chạy lại sau từng vòng sửa). Xanh mới sang review cuối.
- [ ] **Step 3:** commit `chore(core): bump to 1.33.24`.
