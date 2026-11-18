# guard-bash giải biến vòng for Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** ở `full`, `guard-bash` giải `$NAME` của `for NAME in <từ literal>; do … done` (Bash) và `foreach ($x in 'a','b') { … }` (PowerShell) bằng từng giá trị như brace expansion (mỗi giá trị phân loại riêng, gộp `blocked` > `outside` > `unknown`), nên `"$SP/$c.out"` không còn bị hỏi oan khi mọi giá trị an toàn.
**Architecture:** vá trên bộ giải hiện có (`leadInfo`, `walkSegments`, `resolveWord`) và luật brace của `classifyTarget`; thêm một `Map` `loop` vào `state` của `resolveWord`, không thêm cơ chế song song. Mọi dạng ngoài cấu trúc đúng giữ `ask`.
**Tech Stack:** Node.js 20+ ESM, zero dependency; test là module contract chạy bằng `node test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

**Thứ tự:** tuần tự Task 1 → 4, nhánh `feature/guard-bash-for-loop-var` cắt từ `claude/laughing-tu-69e18d` (tip `6a66a2d0`). **Tổng ước lượng:** 170 phút.

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | `leadInfo` (header `for`), `findLoops`, `walkSegments` (phạm vi và kiểm điều kiện), `resolveWord` (`state.loop`), `classifyTarget` (nhóm đánh dấu); Task 2: `scanWords`, `psUnsafe`, `walked` | Task 1–2 |
| `test/contract/99-path-permissions.contract.mjs` | khối mới "biến vòng for" (bảng tham số hoá) | Task 1–2 |
| `docs/specs/hooks-gates/spec.md` | R23, Lịch sử, dòng "Gồm" | Task 3 |
| `README.md`, `README_VI.md` | đoạn giới hạn của `full` | Task 3 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump patch kế tiếp và lock | Task 4 |
| `docs/requests/2026-11-18-guard-bash-for-loop-var/design.md` | đổi Trạng thái khi xong | Task 4 |

## Global Constraints
- Hướng an toàn: không hiểu thì hỏi; không thêm đường nào biến `ask`/`deny` hiện có thành `null` ngoài ca AC1.1; không làm lỏng root. Fail-open ngoài `full` + bypass giữ nguyên.
- Dùng lại `scanWords`, `resolveWord`, `walkSegments`, `classifyTarget`/`braceExpand`; không đổi chúng ngoài các điểm của design; không đổi `unwrap`, `confineSegment`, `parse()`, `summarize`, `guard-files.mjs`, `gate-config.mjs`, câu `reason` (R21).
- Kiểm "tên lệnh là biến" (`opaque`) phải chạy trên từ giải không có `loop` (D6); không để giá trị vòng thành tên lệnh.
- Zero-dependency; không thêm lời gọi git ở đường nóng; chi phí xấu nhất (256 giá trị × thân nhiều từ) < 1 giây.
- Test: một hành vi một hàng của bảng; hàng đỏ trước khi sửa và hàng đối chứng; tên có ID AC; seam `bd(cmd, { tool, opts, extra })`; `T` trong root, `OUT` ngoài mọi root. Lệnh test hẹp: `node test/validate.mjs --only path-permissions`; `npm test` chỉ chạy trên bản `git clone` sạch (repo chính bật `mode: full`).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment chỉ ghi lý do (AGENTS.md); commit header tiếng Anh, body tiếng Việt, từng task qua `core:git-workflow`; commit test đỏ trước, rồi code.
- Không dùng `String.replace` với chuỗi thay thế có `$`` hoặc `$&` khi sửa code bằng script; dùng công cụ Edit.

## Review Focus
- Hàng đối chứng của mỗi quy tắc loại trừ vẫn `ask`: danh sách có `$`/glob/thế lệnh/`{`/`,`/khoảng trắng/giá trị bắt đầu `-`, 257 giá trị, gán lại `c`, hai vòng cùng tên, dùng ngoài thân hoặc trong chuyển hướng của `done` (AC1.3, AC1.4).
- Giá trị vòng không thành tên lệnh: `for c in rm ls; do $c <OUT>/x; done`, `sudo $c`, `env $c`, `timeout 5 $c` vẫn `ask` (AC1.5).
- Giá trị xấu nhất thắng: `..` ở bất kỳ vị trí nào của danh sách thành `deny` khi `<T>/$c/x` (AC1.2).
- Lệnh con `$( )` trong thân vòng thấy `loop` nhưng không thấy tên đã bị gán lại trong chính lệnh con.

### Task 1: Giải biến vòng for trong walkSegments (D1–D6)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 70 phút
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.7
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`leadInfo`, `walkSegments`, `resolveWord`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `leadInfo(seg)` (`lead`, `assigns`, `extra`, `cmdAt`), `LEAD_KW`, `unwrap`, `resolveWord(word, state, dialect)`, `classifyTarget` (mở nhóm brace), `MAX_VAR_NAMES`, `noVars`.
- Produces: `leadInfo(seg).loop` = `{ name, words }` khi đoạn là `for NAME in W…` đúng dạng (hai tên header không vào `extra`); `resolveWord` nhận `state.loop: Map<tên, chuỗi>` (giá trị như nhóm brace); `walkSegments` dựng `loopAt[i]` và truyền `loop` cho lệnh con.

- [ ] **Step 1:** thêm hàng AC1.1–AC1.5 đỏ vào khối mới "biến vòng for" của `99-path-permissions` (null/deny cho ca nhận, `ask` cho ca loại trừ và tên lệnh); chạy `node test/validate.mjs --only path-permissions`, thấy đỏ ở hàng AC1.1 và AC1.2; commit `test(hooks): add red rows for for-loop variable in guard-bash`.
- [ ] **Step 2:** `leadInfo`: nhận header `for NAME in W…` ở vị trí `lead`, trả `loop`, bỏ qua hai tên header khi gom `extra`.
- [ ] **Step 3:** `walkSegments`: với mỗi header, kiểm D2 (từ literal qua `resolveWord` env rỗng, giá trị hợp lệ, ≤ 256), D4 (một header cho `NAME`, không phép gán hay `extra` khác, không `case`/`<<`, tên không thuộc `HOME`/`PWD`/`OLDPWD`/`PATH`/`CDPATH`, `vars` bật), tìm `do` kế và `done` đúng cấp (D1, D3); hợp lệ thì gắn nhóm brace vào `loopAt[i]` cho các đoạn từ `do` tới trước `done`, không hợp lệ thì đưa `NAME` vào `bad` như trước. Truyền `loop` vào `state`; kiểm `opaque` tên lệnh trên từ giải không có `loop` (D6); truyền `loop` cho lệnh con, bỏ tên bị gán trong lệnh con. `resolveWord` đọc `state.loop` trước `env`. Chạy lại `--only path-permissions` và `--only hook`, xanh.
- [ ] **Step 4:** đo bằng script tạm trong scratchpad: ca chi phí xấu nhất (256 giá trị, thân 8 từ, 3 vòng lồng) và các ca của design; ghi kết quả vào ledger; commit `feat(hooks): resolve for-loop variable of literal lists in guard-bash`.

### Task 2: PowerShell foreach (D7)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 70 phút
**Phủ AC:** AC1.6
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs` (`scanWords`, `findLoops`, `psUnsafe`, `walkSegments`, `walked` trong `decide`)
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `findLoops`, `loopValues`, nhóm đánh dấu và `state.loop` của Task 1; `leadInfoPs`, `psUnsafe(scan, depth, absNames)`, `prepareWalk`.
- Produces: đoạn của `scanWords` có thêm `kd`, `pn`, `km`; `findLoops(…, ps = true)` nhận `foreach ($x in …) { … }`; `psUnsafe` nhìn bản ảo đã bỏ đoạn cấu trúc vòng; `walkSegments` trả mảng có `loopAny` để lần quét thô PowerShell dùng.

- [ ] **Step 1:** thêm hàng AC1.6 đỏ vào khối "biến vòng for" (null/deny cho ca nhận; `ask` cho danh sách ngoài dạng, `$x` ngoài khối, gán lại, `ForEach-Object`, lệnh ngoài danh sách trong khối; hàng đối chứng: mọi lệnh PowerShell có `{ } ( =` ngoài dạng vòng giữ `ask`); chạy `--only path-permissions`, thấy đỏ; commit `test(hooks): add red rows for PowerShell foreach variable`.
- [ ] **Step 2:** `scanWords` ghi `kd`, `pn`, `km` vào đoạn; `findLoops` nhận dạng `foreach` (đoạn `foreach`, đoạn `$x in …` có `pn === 1`, đoạn `{` có `pn === 0`, tìm `}` đúng cấp), ghép phần tử danh sách theo dấu phẩy; giá trị theo D2 cộng loại `:`.
- [ ] **Step 3:** `psUnsafe` ở `depth === 0` dựng bản ảo của lệnh (bỏ đoạn `foreach`, `$x in …`, `}` và từ `{`; đoạn thân chỉ phức vì vòng thì `compound: false`), thêm tên biến vòng vào `absNames`; `walkSegments` dùng `findLoops` cho PowerShell, bỏ `$x` khỏi `extra` của đoạn header; `walked` truyền `loopAny` (lọc bằng tên mà lần quét thô thấy bị gán) sang lần quét thô. Chạy `--only path-permissions` và `--only hook`, xanh.
- [ ] **Step 4:** đo bằng script tạm: ca PowerShell của AC1.6, ca có `ForEach-Object`/`%`, ca `foreach` lồng, thân nhiều lệnh xuống dòng và `;`; commit `feat(hooks): resolve PowerShell foreach variable of literal lists`.

### Task 3: Spec và README
**Kind:** DOCS
**TDD:** không — tài liệu, không mã
**Ước lượng:** 15 phút
**Phủ AC:** AC2.2
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md` (R23, Lịch sử, dòng "Gồm")
- Modify: `README.md`, `README_VI.md` (đoạn giới hạn của `full`)
- Test: `core/skills/artifact-templates/scripts/check-request.mjs` (chạy trên thư mục request)

**Interfaces:**
- Consumes: hành vi đã làm ở Task 1 (tên hằng, hàm, trần 256).
- Produces: không có

- [ ] **Step 1:** đổi R23: nêu D1–D7 (dạng vòng được nhận, danh sách literal, phạm vi `do`…`done`, điều kiện `NAME`, nhóm brace, tên lệnh không dùng giá trị vòng, PowerShell không đổi) và sửa câu "`for`/`select NAME` … chưa rõ" thành có ngoại lệ; thêm một dòng Lịch sử và dòng "Gồm".
- [ ] **Step 2:** đối chiếu khẳng định với code: liệt kê từng khẳng định kiểm được, grep `guard-bash.mjs`, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo; dòng lệch sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 3:** chạy `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-18-guard-bash-for-loop-var/` và `node test/validate.mjs --only spec`; commit `docs(hooks): record for-loop variable resolution in hooks-gates spec`.

### Task 4: Version, build, lock và kiểm cuối
**Kind:** TOOLING
**TDD:** không — chỉ chạy lệnh và bump version
**Ước lượng:** 15 phút
**Phủ AC:** AC2.1, AC2.3
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json` (qua `node cli/lib/versions.mjs --lock`)
- Modify: `docs/requests/2026-11-18-guard-bash-for-loop-var/design.md` (Trạng thái)
- Test: `test/validate.mjs`

**Interfaces:**
- Consumes: version hiện tại của `core/.manifest.json` (1.34.9 ở nhánh nền).
- Produces: không có

- [ ] **Step 1:** bump patch kế tiếp của `core/.manifest.json`; `npm run build`, rồi `node cli/lib/versions.mjs --lock`.
- [ ] **Step 2:** `node test/validate.mjs --only hook`, `--only path-permissions`, `--only spec`, xanh.
- [ ] **Step 3:** chạy `decide` thật bằng script tạm trong scratchpad cho mọi ca AC1.1–AC1.5, ghi kết quả vào ledger.
- [ ] **Step 4:** `git clone` repo vào thư mục tạm, chạy `npm test` trong clone; mong đợi exit 0. Dọn clone bằng Node `fs.rmSync`.
- [ ] **Step 5:** đổi Trạng thái của `design.md`; commit `chore(core): bump core for for-loop variable in guard-bash`.
