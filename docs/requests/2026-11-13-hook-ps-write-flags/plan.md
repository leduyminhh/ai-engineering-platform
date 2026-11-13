# hook-ps-write-flags Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `guard-bash` kiểm đúng đường dẫn đích của `Set-Content`/`Out-File`/`Add-Content` khi có cờ có giá trị đứng trước (`-Encoding utf8`, `-Value y`, `-ErrorAction Stop`…), để ghi ra ngoài root ở chế độ full bị `deny`; mọi token trừ tên cờ đã biết là ứng viên đích (vòng ba), chỉ giá trị của cờ có giá trị đứng trơn là nội dung.
**Architecture:** trong nhánh `WRITE_CMDS` của `writeTargets` (`guard-bash.mjs`), với tên thuộc `FIRST_ONLY` phân loại từng cờ qua hai danh sách đầy đủ tên (có giá trị / công tắc), hàm `psWriteCandidates` trả mọi token là ứng viên đích trừ tên cờ đã biết; giá trị của cờ có giá trị đứng trơn là nội dung và bị bỏ; không còn coi đối số vị trí sau `-Path` là Value (vòng ba: Windows PowerShell 5.1 đảo vai đối số vị trí khi có tham số động).
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | hai hằng danh sách cờ cạnh `PS_VALUE_FLAGS`; nhánh phân loại cờ cho `FIRST_ONLY` trong `writeTargets`; đổi dòng `pos = FIRST_ONLY.has(name) ? all.slice(0, 1) : all` và comment của nó | Task 1 |
| `test/contract/99-path-permissions.contract.mjs` | bảng ca mới AC1.1–AC1.4 cạnh các ca PowerShell sẵn có (dòng ~189) | Task 1 |
| `docs/specs/hooks-gates/spec.md` | R24: thêm quy tắc cờ của `Set-Content`/`Out-File`/`Add-Content`, bỏ mục đó khỏi "Giới hạn đã biết"; dòng Phạm vi; dòng Lịch sử | Task 2 |
| `README.md`, `README_VI.md` | mục Hooks đoạn `fullPaths`: bỏ giới hạn cũ (dòng ~446), nêu quy tắc mới ở bảng vai (dòng ~453) | Task 2 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump core 1.33.14 → 1.33.15, lock | Task 3 |

Không đổi: `classifyPath`/`grantsOf`/`gate-config.mjs`, `guard-files.mjs`, `Copy-Item`/`Move-Item`/`rm` và `PS_VALUE_FLAGS` hiện có; `94-permission-modes`, `99-hook-popup`, `90-hooks`, `97-audit-mustfix` giữ nguyên làm bằng chứng tương thích (AC2.1).

## Global Constraints
- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng.
- Danh sách cờ có giá trị (so khớp không phân biệt hoa thường, bỏ `-`, tách `:`): `Value`, `Encoding`, `Stream`, `Width`, `InputObject`, `Filter`, `Include`, `Exclude`, `Credential`, `ErrorAction`/`ea`, `WarningAction`/`wa`, `InformationAction`/`infa`, `ErrorVariable`/`ev`, `WarningVariable`/`wv`, `InformationVariable`/`iv`, `OutVariable`/`ov`, `OutBuffer`/`ob`, `PipelineVariable`/`pv`. Công tắc: `Force`, `NoNewline`, `Append`, `NoClobber`, `PassThru`, `AsByteStream`, `WhatIf`, `Confirm`/`cf`, `UseTransaction`, `Verbose`/`vb`, `Debug`/`db`. Cờ ngoài hai danh sách là cờ lạ (D2).
- Không điều kiện hoá theo `msys` (D6); không đổi `PS_VALUE_FLAGS`, parse của `Copy-Item`/`Move-Item`/`rm`; vai của đích vẫn `['write']` (không thêm `delete`).
- `allPos` (kiểm cấu hình hook R18) là mảng ứng viên của `psWriteCandidates`; đối số vị trí thứ hai không còn được miễn kiểm (D4 vòng ba), chỉ giá trị của cờ có giá trị đứng trơn bị bỏ.
- Không thêm câu `ask`/`deny` mới (D7): kết quả qua câu có sẵn, `shapeOk` của `99-hook-popup.contract.mjs` vẫn đúng.
- Test dùng seam `bd`/`expectAll` sẵn có của `99-path-permissions.contract.mjs` (`tool: 'PowerShell'`, full + bypass, `D`/`O`/`T`/`OUT` từ `mkdtemp` dưới `<tmpdir>/aip-…`); mỗi `ok()` ghi ID AC trong thông điệp; dọn bằng `fs.rmSync`, không `rm -rf`.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ khi gate đạt).
- Mỗi task: test đỏ đúng lý do trước (commit riêng), sửa, test xanh; commit trên nhánh `feature/hook-ps-write-flags` qua `core:git-workflow`, không `Co-Authored-By`; không push. Test hẹp: `node test/validate.mjs --only path-permissions`, sau khi sửa hook thêm `--only hook`; `npm test` một lần ở Task 3.

## Review Focus
- Task 1: `Set-Content -Path O/x OUT/y` là `deny` (đối số vị trí thứ hai không còn được miễn, AC1.2 sau vòng ba) và `Set-Content -Path OUT/x y` vẫn `deny`; `Set-Content -Value OUT/y O/x` vẫn `null` (giá trị cờ đứng trơn là nội dung).
- Task 1: cờ có giá trị ở dạng dính `-Encoding:utf8` và alias `-ea` đều bỏ đúng một token (AC1.1).
- Task 1: cờ lạ (`-Enc`, `-Foo`) không làm lọt đích ngoài root, và `Set-Content -Enc utf8 O/x y` vẫn `null` (AC1.3).
- Task 1: kiểm cấu hình hook (R18) không đổi: `Set-Content -Encoding utf8 .claude\aip-gate.json x` và `Set-Content -Value x .claude\aip-gate.json` vẫn `ask`, `Set-Content -Value .claude\aip-gate.json x` `null` (AC1.4).
- Task 2: mô tả R24 và README khớp code (danh sách cờ, D2, D3, D4) và còn đúng phần "Giới hạn đã biết" cho ba lỗ chưa sửa (AC3.1).

### Task 1: bỏ giá trị cờ cho nhóm FIRST_ONLY trong writeTargets
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4, AC2.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Modify: `test/contract/99-path-permissions.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `FIRST_ONLY`, `PS_PATH_FLAGS`, `PS_VALUE_FLAGS`, `writeTargets(t, msys)` trả `{ targets, needs, name, args, allPos }`, `namedPath`
- Produces: hằng `PS_WRITE_VALUE_FLAGS`, `PS_WRITE_SWITCHES` (tên nội bộ do builder chọn) và hàm phân loại cờ trả `'value' | 'switch' | 'unknown'`; hình dạng trả về của `writeTargets` không đổi

- [ ] **Step 1:** thêm bảng ca vào `99-path-permissions.contract.mjs`, tham số hoá theo mẫu lệnh với `{X}` ∈ `OUT`/`D` (deny) và `O`/`T` (null) cho AC1.1 (12 mẫu của design), ca `null`/`deny` của AC1.2, AC1.3 và AC1.4 (AC1.4 chạy ở `mode: ask`, phiên thường). Chạy `node test/validate.mjs --only path-permissions`: đỏ ở các ca AC1.1, AC1.3 và `Set-Content -Path O/x OUT/y` (AC1.2); các ca khác xanh. Commit test đỏ riêng: `test(hooks): cover Set-Content value flags before path`.
- [ ] **Step 2:** sửa `writeTargets`: với `FIRST_ONLY.has(name)`, mỗi cờ không phải đường dẫn đã gọi tên được phân loại — `'value'` bỏ cờ và token kế (dạng `-X:giá-trị` chỉ bỏ cờ), `'switch'` bỏ cờ, `'unknown'` đặt cờ báo "cờ lạ" (riêng, không dùng `blurred` vì `blurred` đòi thêm `delete`). Đổi dòng gán `pos`: cờ lạ → `all`; đã gọi tên `-Path`/`-LiteralPath`/`-FilePath` → `[]`; còn lại `all.slice(0, 1)`. Viết lại comment cũ ở dòng đó cho đúng nguyên nhân (chỉ giữ phần giải thích `allPos`). Chạy `--only path-permissions`: xanh.
- [ ] **Step 3:** chạy `node test/validate.mjs --only hook`, rồi `--only audit` và `--only permission` (các suite `99-hook-popup`, `97-audit-mustfix`, `94-permission-modes`, `90-hooks`): xanh, không sửa test cũ.
- [ ] **Step 4:** chạy script dò tạm trong scratchpad (`probe.mjs` + `rows.json` đã dùng lúc lập design) trên các ca của AC1.1–AC1.3: mọi dòng `ok`.
- [ ] **Step 5:** commit `fix(hooks): skip value flags before Set-Content path in guard-bash`.

### Task 2: cập nhật spec R24 và README
**Kind:** DOCS
**TDD:** không — chỉ tài liệu
**Ước lượng:** 20'
**Phủ AC:** AC3.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Test: `test/validate.mjs --only content`

**Interfaces:**
- Consumes: hành vi đã chốt ở Task 1 (danh sách cờ, D2, D3, D4 của `design.md`)
- Produces: không có

- [ ] **Step 1:** sửa R24 trong `spec.md`: thêm câu quy tắc (cờ có giá trị và công tắc của `Set-Content`/`Out-File`/`Add-Content` bị bỏ; cờ lạ thì mọi đối số vị trí là ứng viên đích; đã gọi tên `-Path`/`-LiteralPath`/`-FilePath` thì đối số vị trí là Value; Value/Encoding vị trí không kiểm); xoá mục `Set-Content`/`Out-File`/`Add-Content` khỏi "Giới hạn đã biết"; thêm dòng Phạm vi (request `2026-11-13-hook-ps-write-flags`), dòng Nguồn của R24 và một dòng Lịch sử `hooks-gates/R24 | đổi`.
- [ ] **Step 2:** sửa `README.md` (dòng ~446 bỏ giới hạn cũ; bảng vai dòng ~453 hoặc câu kế nêu quy tắc mới) và `README_VI.md` (cùng chỗ), khớp spec.
- [ ] **Step 3 (đối chiếu khẳng định với code):** liệt kê từng khẳng định kiểm được (tên cờ, alias, danh sách công tắc, hành vi cờ lạ), đối chiếu với `guard-bash.mjs` bằng grep, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 4:** chạy `node test/validate.mjs --only content`: xanh. Commit `docs(hooks): document Set-Content value flag handling in R24`.

### Task 3: bump version, build, lock và chạy toàn bộ test
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy kiểm
**Ước lượng:** 15'
**Phủ AC:** AC3.2
**Files:**
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `npm test`

**Interfaces:**
- Consumes: kết quả Task 1 và Task 2
- Produces: không có

- [ ] **Step 1:** `core/.manifest.json` version 1.33.14 → 1.33.15.
- [ ] **Step 2:** `npm run build`, rồi `node cli/lib/versions.mjs --lock` (mỗi lệnh một lần gọi Bash).
- [ ] **Step 3:** `npm test` một lần: xanh. Commit `chore(core): bump to 1.33.15`.
