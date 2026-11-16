# hook-copy-alias-brace Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `guard-bash` ở chế độ full (và R18 ở mọi chế độ) đóng bốn lỗ ghi còn lại: `Copy-Item` có cờ lạ/viết tắt (`-Dest`), alias PowerShell `cpi`/`mi`/`ri`, brace expansion `{..,x}` ở Bash, và giá trị của `cp`/`mv -S`/`--suffix` bị tính là đối số vị trí.
**Architecture:** sửa tại chỗ trong `guard-bash.mjs`: thêm alias vào các tập tên lệnh, bỏ giá trị `-S`/`--suffix` trong vòng đối số GNU của `writeTargets`, mở nhánh `blurred` của `writeTargets` cho nhóm copy kèm danh sách switch đã biết, thêm `braceExpand` vào `classifyTarget` (chỉ Bash) và đổi thứ tự động từ ở `summarize`.
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | `writeTargets`: bỏ giá trị `-S`/`--suffix` của `cp`/`mv` Bash (Task 1); alias `cpi`/`mi`/`ri` trong `WRITE_CMDS`, `LAST_ONLY`, `MOVE_CMDS`, `DELETE_CMDS`, `COPY_MOVE` (Task 2); hằng `PS_COPY_SWITCH`, nhánh `blurred` cho copy, `slots`, vai `needs` và động từ ở `summarize` (Task 3); `braceExpand` và nhánh mở rộng trong `classifyTarget` (Task 4) | Task 1–4 |
| `test/contract/99-path-permissions.contract.mjs` | bảng ca mới AC1.x–AC4.1 cạnh các ca PowerShell/Bash sẵn có (dòng ~185–290) | Task 1–4 |
| `docs/specs/hooks-gates/spec.md` | R18 (alias `cpi`/`mi` ghi vào `.claude`, bỏ khỏi giới hạn) và R24 (switch đã biết, `Copy-Item` cờ lạ, alias, brace, `-S`, giới hạn còn lại); Phạm vi; Nguồn; dòng Lịch sử | Task 5 |
| `README.md`, `README_VI.md` | mục Hooks đoạn `fullPaths` và đoạn giới hạn (dòng ~348, ~440–453 của `README.md`; ~344, ~436–449 của `README_VI.md`) | Task 5 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core 1.33.19 → 1.33.20, lock | Task 6 |

Không đổi: `gate-config.mjs`, `guard-files.mjs`, `classifyPath`/`grantsOf`/`fullPaths`, `guard-mcp`, `gate-stop`, `session-start`, `cli/lib/*`; `94-permission-modes`, `99-hook-popup`, `90-hooks`, `97-audit-mustfix` giữ nguyên làm bằng chứng tương thích (AC5.1). Task 1–4 cùng sửa `guard-bash.mjs` và cùng file test nên chạy tuần tự.

## Global Constraints
- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng; `braceExpand` có trần 256 nhánh.
- Danh sách switch của `Copy-Item`/`Move-Item` (`PS_COPY_SWITCH`, so khớp tên đầy đủ, không phân biệt hoa thường, bỏ `-`, tách `:`): `recurse`, `force`, `container`, `passthru`, `whatif`, `confirm`, `usetransaction`, `verbose`, `debug`. Cờ `-X` khác (ngoài `PS_VALUE_FLAGS` đã có) là cờ lạ → `blurred`: copy `['read','write']`, move `['delete','write']` cho mọi đối số vị trí.
- Alias thêm đúng ba tên: `cpi` (nhóm copy-item), `mi` (nhóm move-item), `ri` (nhóm remove-item); không thêm alias khác.
- `-S`/`--suffix` bỏ giá trị chỉ khi Bash (`msys`) và tên `cp`/`mv`; `--suffix=X`/`-SX` dính giữ cách bỏ cờ chung.
- Brace expansion chỉ khi `msys`: nhóm `{a,b}` có dấu phẩy ở cấp ngoài cùng, lồng được; dải `{1..3}`/`{x}` không sinh nhánh mới; thứ tự gộp kết quả `blocked` > `outside` > `unknown` > còn lại; vượt 256 nhánh → `unknown`.
- Không thêm câu `ask`/`deny` mới (D7): mọi kết quả qua câu có sẵn, `shapeOk` của `99-hook-popup.contract.mjs` vẫn đúng; chỉ đổi động từ của dòng "Lệnh gồm" (D3).
- Test dùng seam `bd`/`expectAll` sẵn có của `99-path-permissions.contract.mjs` (`D`/`O`/`T`/`OUT` từ `mkdtemp` dưới `<tmpdir>/aip-…`, `tool: 'Bash'` hoặc `'PowerShell'`, full + bypass; ca R18 chạy thêm ở `mode: ask` thường); mỗi `ok()` ghi ID AC trong thông điệp; dọn bằng `fs.rmSync`, không `rm -rf`; một hàng mỗi hành vi, không lặp ca đã có.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ khi gate đạt).
- Mỗi task: test đỏ đúng lý do trước (commit riêng), sửa, test xanh; commit trên nhánh `feature/hook-copy-alias-brace` qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`), không `Co-Authored-By`; không push. Test hẹp: `node test/validate.mjs --only path-permissions`, sau khi sửa hook thêm `--only hook`; `npm test` một lần ở Task 6. Một lệnh Bash mỗi lần gọi.

## Review Focus
- Task 1: `cp T/x O/b -S .bak` vẫn `null` và `cp O/x D/b -S .bak` thành `deny`; giá trị `.bak` không còn là đích (AC4.1).
- Task 2: `cpi OUT/a O/b` là `ask` (nguồn thiếu `read`) còn `cpi T/a D/b` là `deny`; `ri` có vai `delete` (AC2.1, AC2.2).
- Task 3: `Copy-Item -Recurse D/a O/b` vẫn `null` (switch đã biết) trong khi `Copy-Item -Dest D/b x` là `deny`; `Copy-Item -Path .claude/settings.json -Destination out\x` vẫn `null` (AC1.1–AC1.3).
- Task 3: dòng "Lệnh gồm" của `Copy-Item -Dest .claude\settings.json x` nói "ghi vào", không "đọc"; ca R21 cũ của `99-hook-popup` giữ nguyên (AC1.4, AC5.1).
- Task 4: `rm T/{..,x}/f` ra `deny`, `rm T/{a,b}/f` vẫn `null`, trần 256 nhánh trả `ask` không treo, PowerShell không đổi (AC3.1–AC3.3).

### Task 1: bỏ giá trị -S / --suffix của cp/mv Bash
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC4.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `writeTargets(t, msys)` trả `{ targets, needs, name, args, allPos }`, biến `gnu` và vòng đối số của nhánh `WRITE_CMDS`
- Produces: không có (hình dạng trả về của `writeTargets` không đổi)

- [ ] **Step 1:** thêm bảng ca AC4.1 vào `99-path-permissions.contract.mjs` (Bash, full): các ca `deny`, `null` và `ask` của design. Chạy `node test/validate.mjs --only path-permissions`: đỏ ở các ca có giá trị `-S` tách rời (`cp O/x D/b -S .bak`, `--suffix .bak`, `cp -S .bak O/x D/b`, `-bS`, `mv T/x D/b -S .bak`), xanh ở `--suffix=.bak` và các ca `null`. Commit test đỏ riêng: `test(hooks): cover cp and mv suffix value in guard-bash`.
- [ ] **Step 2:** sửa `writeTargets`: khi `gnu`, `--suffix` đứng trơn hoặc cờ bó khớp `/^-[A-Za-z]*S$/` thì bỏ luôn token kế (`i++`) trước nhánh bỏ cờ chung. Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`: xanh, không sửa test cũ.
- [ ] **Step 4:** commit `fix(hooks): skip cp and mv suffix value when finding write targets`.

### Task 2: alias PowerShell cpi, mi, ri
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `WRITE_CMDS`, `LAST_ONLY`, `MOVE_CMDS`, `DELETE_CMDS`, `COPY_MOVE` (R18), `writeTargets`
- Produces: không có

- [ ] **Step 1:** thêm bảng ca AC2.1 (PowerShell, full) và AC2.2 (PowerShell, `mode: ask` thường và full+bypass) vào `99-path-permissions.contract.mjs`. Chạy `--only path-permissions`: đỏ ở mọi ca `deny`/`ask` (hiện `null`), xanh ở các ca `null`. Commit test đỏ riêng: `test(hooks): cover cpi, mi and ri aliases in guard-bash`.
- [ ] **Step 2:** thêm `cpi` vào `WRITE_CMDS`, `LAST_ONLY`, `COPY_MOVE`; `mi` vào `WRITE_CMDS`, `MOVE_CMDS`, `COPY_MOVE`; `ri` vào `WRITE_CMDS`, `DELETE_CMDS`. Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`: xanh.
- [ ] **Step 4:** commit `fix(hooks): treat cpi, mi and ri as copy, move and delete in guard-bash`.

### Task 3: Copy-Item cờ lạ cần read và write, dòng Lệnh gồm nói ghi
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC5.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `PS_VALUE_FLAGS`, `PS_PATH_FLAGS`, biến `blurred`/`slots`/`copyLike` trong `writeTargets`, `summarize(cmd)` (dòng động từ `verb`), alias của Task 2
- Produces: hằng `PS_COPY_SWITCH` (tên nội bộ do builder chọn); hình dạng trả về của `writeTargets` không đổi

- [ ] **Step 1:** thêm bảng ca AC1.1, AC1.2, AC1.3 và AC1.4 vào `99-path-permissions.contract.mjs` (AC1.3 chạy ở `mode: ask` thường và full+bypass; AC1.4 kiểm `reason` của ca `Copy-Item -Dest .claude\settings.json x` chứa "ghi vào" ở dòng "Lệnh gồm"). Chạy `--only path-permissions`: đỏ ở các ca `-Dest`/`-De`/`-D`, `Move-Item -Force T/a O/b` (đang `deny` oan) và AC1.3/AC1.4; xanh ở các ca switch đã biết của `Copy-Item` và ca `-Path .claude/settings.json` chỉ đọc. Commit test đỏ riêng: `test(hooks): cover Copy-Item unknown and abbreviated flags`.
- [ ] **Step 2:** sửa `writeTargets`: hằng `PS_COPY_SWITCH`; nhánh `blurred` hiện chỉ cho `MOVE_CMDS` mở cho `LAST_ONLY` và bỏ qua cờ trong `PS_COPY_SWITCH` (cả dạng `-X:giá-trị`); `slots` chỉ khi không `blurred`; `needs` của `blurred` là `['read','write']` cho copy, `['delete','write']` cho move. Sửa `summarize`: động từ ưu tiên `delete`, rồi `write` ("ghi vào"), rồi `read` ("đọc"). Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`, rồi `--only audit` và `--only permission` (các suite `99-hook-popup`, `97-audit-mustfix`, `94-permission-modes`, `90-hooks`): xanh. Nếu một ca cũ ghim `Move-Item -Force …` bị `deny`, ghi rõ ca đó ở báo cáo và sửa đúng ca đó (hành vi đổi có chủ đích, D2); không sửa ca khác.
- [ ] **Step 4:** commit `fix(hooks): require read and write for Copy-Item with unknown flags`.

### Task 4: brace expansion ở Bash
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC3.1, AC3.2, AC3.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `classifyTarget(raw, dir, unres, roots, msys, need)`, nhánh `GLOB`, `hasUnresolvedRef`, `classifyPath`
- Produces: hàm `braceExpand(p, cap)` trả mảng nhánh hoặc `null` khi vượt `cap` (tên nội bộ do builder chọn)

- [ ] **Step 1:** thêm bảng ca AC3.1 (`deny`, `null`, `ask`), AC3.2 (trần 256 nhánh, glob trong brace) và AC3.3 (PowerShell không đổi) vào `99-path-permissions.contract.mjs`. Chạy `--only path-permissions`: đỏ ở các ca `deny` của AC3.1 (`rm T/{..,x}/f`, `rm T/.{.,x}/d/f`, `rm T/{a,..}`, `rm {T,OUT}/f`, `rm O/{a,b}`, `cp x T/{..,y}/f`, `rm T/{a,{..,b}}/f`) và ở ca `ask` (biến trong nhánh, trần 256, `rm T/{.?,x}/f`); xanh ở các ca `null` và AC3.3. Commit test đỏ riêng: `test(hooks): cover brace expansion in guard-bash path classification`.
- [ ] **Step 2:** thêm `braceExpand` và nhánh trong `classifyTarget`: khi `msys` và đường dẫn có nhóm brace có dấu phẩy thì mở rộng (tối đa 256, vượt thì `unknown`), phân loại từng nhánh bằng chính `classifyTarget` và gộp theo `blocked` > `outside` > `unknown` > còn lại. Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`, rồi `--only audit` và `--only permission`: xanh.
- [ ] **Step 4:** commit `fix(hooks): expand brace groups when classifying guard-bash paths`.

### Task 5: cập nhật spec R18, R24 và README
**Kind:** DOCS
**TDD:** không — chỉ tài liệu
**Ước lượng:** 25'
**Phủ AC:** AC6.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Test: `test/validate.mjs --only content`

**Interfaces:**
- Consumes: hành vi đã chốt ở Task 1–4 (D1–D6 của `design.md`)
- Produces: không có

- [ ] **Step 1:** sửa R18 trong `spec.md`: nêu `cpi`/`mi` ghi vào đích `.claude` cũng bị hỏi, `Copy-Item -Dest .claude\settings.json x` (cờ lạ) bị hỏi, bỏ "alias `cpi`/`mi`" khỏi danh sách không bắt; thêm Nguồn. Sửa R24: nguồn `read`/vai `blurred` của copy, danh sách switch đã biết (đổi cho cả `Move-Item`), alias `cpi`/`mi`/`ri`, brace expansion ở Bash (trần 256, thứ tự gộp), `-S`/`--suffix`; giữ phần giới hạn còn lại (viết tắt switch, alias khác như `sc`/`ac`/`ni`, brace trong tên file của R18, `Copy-Item -Dest O/b D/a` bị `deny` oan); bỏ bốn lỗ đã sửa khỏi giới hạn; thêm dòng Phạm vi, Nguồn và hai dòng Lịch sử (`hooks-gates/R18 | đổi`, `hooks-gates/R24 | đổi`).
- [ ] **Step 2:** sửa `README.md` (dòng ~348 và ~440–453) và `README_VI.md` (cùng chỗ): bỏ các giới hạn đã đóng, nêu quy tắc mới, khớp spec.
- [ ] **Step 3 (đối chiếu khẳng định với code):** liệt kê từng khẳng định kiểm được (tên switch, alias, trần 256, cờ `-S`/`--suffix`, thứ tự gộp), đối chiếu với `guard-bash.mjs` bằng grep, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only content`: xanh. Commit `docs(hooks): document Copy-Item flags, aliases, brace and suffix in R18 and R24`.

### Task 6: bump version, build, lock và chạy toàn bộ test
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy kiểm
**Ước lượng:** 15'
**Phủ AC:** AC5.1, AC6.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `npm test`

**Interfaces:**
- Consumes: kết quả Task 1–5
- Produces: không có

- [ ] **Step 1:** `core/.manifest.json` version 1.33.19 → 1.33.20.
- [ ] **Step 2:** `npm run build`, rồi `node cli/lib/versions.mjs --lock` (mỗi lệnh một lần gọi Bash).
- [ ] **Step 3:** `npm test` một lần: xanh. Commit `chore(core): bump to 1.33.20`.

### Task 7: chặn chi phí brace theo cả lệnh (sửa sau review cuối)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC3.4
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `braceExpand(p, cap)`, nhánh brace trong `classifyTarget`, `confineSegment`, `decide`
- Produces: ngân sách cộng dồn cho mọi đường dẫn có brace trong một lệnh (tên nội bộ do builder chọn); `braceExpand` giữ chữ ký

- [ ] **Step 1:** thêm ca AC3.4 vào `99-path-permissions.contract.mjs`: 24 token, mỗi token ≤ 4096 ký tự có 64 dấu `{` (8 nhóm `{a,b}` + 56 `{` lẻ + filler) kèm `OUT/z` ở đối số khác, kỳ vọng `deny` hoặc `ask` và `decide` dưới 1000 ms (kiểu ca thời gian đã có); ca không đổi `rm T/{a,b}/f`, `cp x T/{a,b}` vẫn `null`. Chạy `node test/validate.mjs --only path-permissions`: đỏ ở ca mới (quá thời gian). Commit test đỏ riêng: `test(hooks): cover brace cost across many tokens in guard-bash`.
- [ ] **Step 2:** sửa `guard-bash.mjs`: ngân sách cộng dồn theo cả lệnh (tổng độ dài hoặc số `{` của các đường dẫn có brace; hết ngân sách thì `unknown`), hạ trần độ dài mỗi token nếu cần, bỏ mở rộng brace lại ở từng nhánh trong `classifyTarget` (nhánh đã không còn nhóm có dấu phẩy); khôi phục dòng doc của `braceExpand` (cap → null; `{1..3}` và `{x}` giữ nguyên) cạnh dòng giải thích trần. Đo `decide` thật: lệnh < 200KB dưới 1 s; chạy `--only path-permissions`, `--only hook`, `--only audit`, `--only permission`: xanh.
- [ ] **Step 3:** sửa tài liệu theo hai điểm lệch của re-review: "đường dẫn dài hơn 4096 ký tự thì ask" chỉ khi đường dẫn có `{`; hỏi thừa của `Copy-Item -Rec`/`-r`/`-ea 0` ở R18 chỉ khi file cấu hình là đối số vị trí (dạng `-Path … -Destination` không bị); ghi ngân sách theo lệnh vào R24 và hai README; đối chiếu từng khẳng định với code; `node test/validate.mjs --only content`: xanh.
- [ ] **Step 4:** commit code `fix(hooks): budget brace expansion across the whole command` và docs `docs(hooks): note per-command brace budget and fix R18 wording`.

### Task 8: bump version sau Task 7
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy kiểm
**Ước lượng:** 15'
**Phủ AC:** AC5.1, AC6.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `npm test`

**Interfaces:**
- Consumes: kết quả Task 7
- Produces: không có

- [ ] **Step 1:** `core/.manifest.json` version 1.33.21 → 1.33.22.
- [ ] **Step 2:** `npm run build`, rồi `node cli/lib/versions.mjs --lock` (mỗi lệnh một lần gọi Bash).
- [ ] **Step 3:** `npm test` một lần: xanh. Commit `chore(core): bump to 1.33.22`.
