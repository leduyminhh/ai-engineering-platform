# scoped-path-permissions Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** thêm khoá `fullPaths` (`{path, allow: read|write|delete}`) để hook ở chế độ full cấp quyền đọc/ghi/xoá riêng theo thư mục, phân loại lệnh theo vai (nguồn xoá, đích ghi) và giữ nguyên hành vi của `fullRoots`/`fullReadRoots`.
**Architecture:** `gate-config.mjs` dựng danh sách grant `{path, allow}` và `classifyPath` nhận thêm loại quyền cần; `guard-files` và `guard-bash` tra grant theo `need` của từng đích; `writeTargets` trả thêm `needs` song song với `targets`. Một contract file mới cho mọi ca bảng.
**Tech Stack:** Node ESM zero-dependency; test tự viết (`test/contract/*.contract.mjs`, export `default async run({ ok, ctx })`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/gate-file.mjs` | thêm khoá `fullPaths` vào `GATE_KEYS` (khoá thứ 19, `untracked`) | Task 1 |
| `core/skills/plan-execution/scripts/gate-file.mjs` | bản sao giống byte | Task 1 |
| `test/contract/98-gate-file.contract.mjs` | 18 → 19 khoá, `fullPaths` vào `UNTRACKED` (dòng 91, 97, 106) | Task 1 |
| `core/hooks/scripts/gate-config.mjs` | `fullPaths(config)`, `grantsOf(gate, input)`, `classifyPath` nhận `need`, `allowedRoots` trả root đủ ba quyền | Task 2 |
| `core/hooks/scripts/guard-files.mjs` | `confine()` tra grant theo `need`; quy tắc bí mật D7; câu `deny` mới | Task 3 |
| `core/hooks/scripts/guard-bash.mjs` | `rootsOf()` trả grant; `writeTargets` thêm `needs`; `classifyTarget`/`confineSegment`/`secretOutsideRoots` truyền `need`; dò `-t`; câu `deny` dòng 728 | Task 4, 5 |
| `test/contract/99-path-permissions.contract.mjs` | file test mới: AC1.2, AC2–AC6 | Task 1–6 |
| `README.md`, `README_VI.md`, `CLAUDE.md` | mục Hooks (đoạn chế độ quyền, dòng root chỉ-đọc), dòng mô tả khoá `aip-gate.json` | Task 7 |
| `docs/specs/hooks-gates/spec.md` | đổi R7, R10, R20; thêm R24; dòng lịch sử; `Cập nhật:` | Task 8 |
| `core/.manifest.json`, `plugins/_versions.lock.json` | bump version core, lock | Task 8 |
| `test/content/29-permission-modes-docs.pin.mjs`, `30-permission-modes-phase2-docs.pin.mjs` | không sửa; chạy làm bằng chứng pin tài liệu còn xanh | Task 7 |

Không đổi: `gate-stop.mjs`, `session-start.mjs`, `guard-mcp.mjs`, `cli/lib/mode.mjs` (D9, D10); `94-permission-modes`, `99-hook-popup`, `90-hooks`, `97-audit-mustfix` giữ nguyên làm bằng chứng tương thích (AC5.3).

## Global Constraints
- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng (grant dựng từ config đã đọc, không thêm `readGate`).
- Chữ ký cũ giữ nguyên: `classifyPath(p, cwd, roots, msys)` nhận roots là chuỗi (coi đủ ba quyền) hoặc `{path, allow}`; `need` là tham số cuối (sau `msys`) hoặc nằm trong opts, mặc định `'write'`; `fullRoots(config)`, `fullReadRoots(config)`, `allowedRoots` vẫn export và trả như cũ cho test `94-permission-modes`.
- Quyền độc lập: `write` không kéo theo `read`, `delete` không kéo theo `write` (D2); quyền là hợp của mọi mục chứa đường dẫn (D1). Thiếu `write`/`delete` → `deny`; thiếu `read` hoặc đường dẫn không xác định → `ask` (D3).
- `fullPaths` hợp lệ khi `path` là chuỗi tuyệt đối và `allow` là mảng; chỉ nhận chữ thường `"read"`, `"write"`, `"delete"`; mục sai bị bỏ lặng lẽ theo hướng ít quyền hơn (D4); `*` trong `path` là ký tự thường; so khớp và gộp mục qua `norm` của `gate-config.mjs` + `path.resolve` (D11).
- Chỉ ở full hiệu lực (`mode: "full"` + `bypassPermissions` + file không bị git theo dõi); chế độ `ask` không đổi. `fullPaths` là khoá `untracked` (D5).
- Câu `ask` theo R21: không chứa 'nguyên tắc nền', 'hook an toàn', 'fullRoots', 'bypass', 'root' (BANNED của `99-hook-popup.contract.mjs`), có "cho phép" hoặc "từ chối", ≤ 500 ký tự không kể dòng "Lệnh gồm"; không thêm câu `ask` mới (D3). Câu `deny` mới nêu `fullPaths`, giữ cụm `fullRoots` cũ (AC1.4 của `99-hook-popup` ghim) và tên quyền còn thiếu.
- `isClaudeTmpRoot` thắng trước khi tra grant (D8); bí mật (Read lẫn Write) chỉ miễn ở root đủ ba quyền (D7); `stringWrites`, H1, H2, H3 ngoài full, kiểm cấu hình hook (R18) không đổi.
- Test tạo thư mục bằng `fs.mkdtempSync` dưới `<os.tmpdir()>/aip-…` (không dưới `<tmpdir>/claude`), đường dẫn tuyệt đối; `D`, `O`, `T`, `T2`, `P` rời nhau, `P` không chứa các thư mục kia; ca hoa/thường chỉ chạy khi `process.platform === 'win32'`; dọn bằng `fs.rmSync` (Node), không `rm -rf`.
- Mỗi `ok()` của test mới ghi ID AC trong thông điệp (vd `AC3.6: …`) để `check-request.mjs` W7 thấy.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md (chỉ khi gate đạt).
- Mỗi task: test đỏ đúng lý do trước, sửa, test xanh; commit riêng trên nhánh mới tách từ master (sau khi `feature/hook-popup-standardization` merge) qua `core:git-workflow`; không push. Test hẹp: `node test/validate.mjs --only path-permissions`; sau khi sửa hook chạy thêm `--only hook` (hoặc `--build`); `npm test` một lần ở Task 8.

## Review Focus
- Task 5: `mv` một đối số, `mv -t`/`--target-directory=`, `Move-Item` không cờ và dạng dính `-Destination:X`; `cp -t DIR src` đổi kết quả (AC3.6–AC3.9, AC3.8).
- Task 5: `Copy-Item -Path` chỉ cần `read` (nới so với cũ): ngoài mọi grant ra `ask`, không `deny` (AC3.10).
- Task 3, 4: bí mật chỉ miễn ở root đủ ba quyền; `["read","write"]` trên `.env` → `ask` (Read) hoặc `ask` (Write), `["read"]` + Write → `deny` (AC6.3, AC6.4).
- Task 4: `<tmpdir>/claude` và glob ngay dưới nó vẫn bị chặn dù mục `fullPaths` nào cho `delete` (D8, AC4.3 ở Task 6); `rm <O>/*` xét thư mục cha với đúng `need` (AC4.5).
- Task 6: hợp quyền không thu hẹp được root đầy đủ/gốc project/scratchpad/tmp (AC4.2) và `fullRoots`/`fullReadRoots` cũ cho kết quả y hệt (AC5.1, AC5.2).

### Task 1: khoá fullPaths trong GATE_KEYS
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 15'
**Phủ AC:** AC1.1, AC1.2
**Files:**
- Modify: `core/hooks/scripts/gate-file.mjs`
- Modify: `core/skills/plan-execution/scripts/gate-file.mjs`
- Modify: `test/contract/98-gate-file.contract.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `GATE_KEYS` trong `gate-file.mjs`; `gateLines` của `cli/lib/mode.mjs` (đọc `GATE_KEYS`, không sửa)
- Produces: `GATE_KEYS.fullPaths = { type: 'array', trust: 'untracked' }`

- [ ] **Step 1:** sửa `98-gate-file.contract.mjs`: `18` → `19` (dòng 97), thêm `'fullPaths'` vào `UNTRACKED` (dòng 91) và giá trị mẫu (dòng 106); tạo `99-path-permissions.contract.mjs` (khung `run({ ok, ctx })`, helper `mkdtemp`, seam `config`/`repoRoot`/`tracked`/`permission_mode` như `94-permission-modes`) với ca AC1.2: file `aip-gate.json` bị git theo dõi chứa `fullPaths` hợp lệ → `aip mode status` liệt kê `fullPaths` ở "Khoá bị bỏ qua". Chạy `node test/validate.mjs --only gate-file` và `--only path-permissions`: đỏ.
- [ ] **Step 2:** thêm dòng `fullPaths: { type: 'array', trust: 'untracked' }` sau `fullReadRoots` ở `gate-file.mjs`, cập nhật bình luận ba khoá full* thành bốn; chép byte-identical sang bản `plan-execution`. Chạy cùng hai lệnh: xanh; `node test/validate.mjs --only bytes` (hoặc `--build`): hai bản giống byte.
- [ ] **Step 3:** commit `feat(hooks): add fullPaths gate key`.

### Task 2: bộ đọc fullPaths và grant trong gate-config
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC2.1
**Files:**
- Modify: `core/hooks/scripts/gate-config.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `fullRoots(config)`, `fullReadRoots(config)`, `defaultReadRoots(input)`, `claudeTmpRoots()`, `norm`, `classifyPath` trong `gate-config.mjs`
- Produces: `fullPaths(config): Array<{ path: string, allow: Array<'read'|'write'|'delete'> }>` (đã resolve, gộp trùng theo hợp); `grantsOf(gate, input): Array<{ path: string, allow: string[], glob?: boolean }>` (gồm gốc project/repo chính/scratchpad/`<tmpdir>/claude`/`fullRoots` đủ ba quyền, `fullReadRoots` và `defaultReadRoots` chỉ `read` — mục mặc định có `glob: true` —, `fullPaths`); `classifyPath(p, cwd, roots, msys = true, need = 'write'): 'inside'|'outside'|'unknown'` với phần tử roots là chuỗi hoặc `{ path, allow }`; `allowedRoots(gate, input)` giữ chữ ký, chỉ trả root đủ ba quyền

- [ ] **Step 1:** thêm vào `99-path-permissions.contract.mjs` một test tham số hoá cho `fullPaths()` theo AC2.1 (khoá thiếu/`null`/chuỗi/đối tượng → `[]`; `path` tương đối, `path` không phải chuỗi, `allow` không phải mảng, phần tử không phải đối tượng → bỏ; `["read","Write","x",3]` → `{read}`; `["Write"]` và `[]` → mục không cấp quyền; hai mục cùng `path` → một mục hợp quyền) và một test `classifyPath` với roots đối tượng theo từng `need` (`unknown` khi có `$`/`~`). Chạy `--only path-permissions`: đỏ (chưa có export).
- [ ] **Step 2:** viết `fullPaths` (D4, gộp theo `norm`), `grantsOf` và mở rộng `classifyPath`: chuỗi trong roots coi đủ ba quyền, đối tượng tra `allow.includes(need)`, so khớp tiền tố qua `norm` + `path.resolve` (D11); `*` chỉ là wildcard với mục `glob: true` (dùng khớp theo đoạn như `inReadRoot`). `allowedRoots` lọc grant đủ ba quyền. Chạy `--only path-permissions` và `node test/contract/94-permission-modes.contract.mjs` qua validate (`--only permission`): xanh cả test cũ.
- [ ] **Step 3:** commit `feat(hooks): resolve fullPaths grants in gate-config`.

### Task 3: guard-files tra quyền theo thư mục
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC3.1, AC3.2, AC6.2, AC6.3, AC6.4
**Files:**
- Modify: `core/hooks/scripts/guard-files.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `grantsOf(gate, input)`, `classifyPath(p, cwd, roots, msys, need)` (Task 2); `confine`, `WRITE_TOOLS`, `isSecretPath` trong `guard-files.mjs`
- Produces: không có (đổi nội bộ `confine`)

- [ ] **Step 1:** thêm bảng ca `guard-files.decide` (full hiệu lực; `D` `["read"]`, `O` `["read","write"]`, `T` ba quyền): AC3.1 (Read/Grep vào `D`,`O`,`T` → null; Write/Edit/MultiEdit/NotebookEdit vào `D` → `deny`, vào `O`,`T` → null), AC3.2 (`["write"]` riêng: Read → `ask`, Write → null), AC6.3 (Read `<D>/.env`, `<O>/.env` → `ask`, `<T>/.env` → null), AC6.4 (Write `<O>/.env` → `ask`, `<T>/.env` → null, `<D>/.env` → `deny`, `<P>/.env` → null), AC6.2 (reason `deny` chứa `fullPaths`, `fullRoots` và `write`; reason `ask` qua `shapeOk`: sao chép hàm khuôn của `99-hook-popup`), AC3.11 phần `guard-files` (Read ngoài mọi mục → `ask` với câu hiện có). Chạy: đỏ.
- [ ] **Step 2:** thay `classifyPath` + `inReadRoot` trong `confine()` bằng một lần tra `grantsOf` với `need` = `write` cho `WRITE_TOOLS`, `read` cho Read/Grep; đường dẫn bí mật dùng `need` ba quyền (D7: chỉ miễn khi grant đủ ba quyền, còn lại `ask`); `deny` khi thiếu `write` (câu mới nêu `fullPaths` + `fullRoots` + "quyền write"); giữ câu `ask` hiện có. Chạy `--only path-permissions`, `--only permission`, `--only hook`: xanh (đặc biệt `94-permission-modes`, `99-hook-popup`).
- [ ] **Step 3:** commit `feat(hooks): per-directory read and write grants in guard-files`.

### Task 4: guard-bash tra quyền ghi/xoá theo thư mục (lệnh không phải mv)
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC2.2, AC3.3, AC3.4, AC3.5, AC3.11, AC4.5, AC6.2, AC6.3
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `grantsOf`, `classifyPath(p, cwd, roots, msys, need)` (Task 2); `writeTargets`, `classifyTarget`, `confineSegment`, `secretOutsideRoots`, `isClaudeTmpRoot`, `rootsOf` trong `guard-bash.mjs`
- Produces: `writeTargets(t)` trả `{ targets, needs, name, args, allPos }` (`needs[i]` là mảng quyền cần của `targets[i]`; `targets` giữ nguyên cho kiểm cấu hình hook và `stringWrites`); `classifyTarget(raw, dir, unres, roots, msys, need)`; `rootsOf()` trả grant

- [ ] **Step 1:** thêm bảng ca `guard-bash.decide` (full + bypass, cấu hình AC3.1): AC3.3 (`rm <D>/f`, `rm <O>/f`, `rmdir <O>/d`, PowerShell `Remove-Item <O>/f` → `deny`; `rm <T>/f`, `Remove-Item <T>/f` → null; `rm <T>/a <O>/b` → `deny`), AC3.4 (`cp x`, `touch`, `mkdir`, `chmod 600`, `tee`, `truncate -s0`, `>`, `>>`, PowerShell `Set-Content -Path` vào `<D>` → `deny`; cùng lệnh ở `<O>`,`<T>` → null), AC3.5 (`fullPaths` riêng `{T2, ["delete"]}`: `cp x`/`touch`/`>` vào `<T2>` → `deny`, `rm <T2>/f` → null), AC2.2 (`{path: "<D>/*", ba quyền}`: `rm <D>/a` → `deny`), AC4.5 (`rm <O>/*` → `deny`, `rm <T>/*` → null, `cp x <D>/*` → `deny`), AC3.11 (`rm $X/f`, `cat > ~/f`, ``rm `pwd`/f``, `bash -c "rm <T>/f"` → `ask`), AC6.3 (`cat <D>/.env` → `ask`, `cat <T>/.env` → null), AC6.2 (reason `deny` có `fullPaths`, `fullRoots`, tên quyền thiếu; reason `ask` qua khuôn). Chạy: đỏ.
- [ ] **Step 2:** `rootsOf()` trả grant (`grantsOf`); `writeTargets` thêm `needs` theo D6 mục 1, 3 (chuyển hướng → `['write']`; `rm`/`rmdir`/`del`/`erase`/`rd`/`remove-item` → `['delete']`; `cp`/`copy`/`copy-item` đối số cuối → `['write']`; `touch`, `mkdir`, `chmod`, `chown`, `tee`, `truncate`, `Set-Content`/`Out-File`/`Add-Content` → `['write']`; `mv`/`move`/`move-item` tạm thời `['delete','write']` cho mọi đối số để Task 5 chia vai); `classifyTarget` truyền `need` (kể cả nhánh `GLOB` với thư mục cha); `confineSegment` kết hợp `needs` từng đích (`deny` khi một đích thiếu `write`/`delete`, `ask` khi thiếu `read` hoặc không xác định, deny thắng ask); `isClaudeTmpRoot` đứng trước tra grant; `secretOutsideRoots` truyền `need` ba quyền; câu `deny` ở dòng 728 theo Global Constraints. Chạy `--only path-permissions`, `--only hook`: xanh.
- [ ] **Step 3:** commit `feat(hooks): per-directory write and delete grants in guard-bash`.

### Task 5: guard-bash phân vai mv, -t/--target-directory, Move-Item và Copy-Item
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC3.6, AC3.7, AC3.8, AC3.9, AC3.10
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `writeTargets(t)` với `needs` (Task 4); `PS_PATH_FLAGS`, `LAST_ONLY` trong `guard-bash.mjs`
- Produces: `needs` theo D6 đầy đủ: `mv`/`move`/`move-item` mọi đối số trừ cuối `['delete']`, đối số cuối `['write']`, một đối số không `-t` `['delete','write']`; `-t DIR`/`-tDIR`/`--target-directory DIR`/`--target-directory=DIR` cho `mv` và `cp`; bảng (lệnh, cờ) PowerShell kể cả dạng dính `-Destination:X`/`-Path:X`

- [ ] **Step 1:** thêm bảng ca cấu hình AC3.1: AC3.6 (`mv <T>/a <O>/b` → null; `mv <T>/a` → null; `mv <O>/a <O>/b`, `mv <T>/a <D>/b`, `mv <D>/a <T>/b`, `mv <O>/a` → `deny`), AC3.7 (`mv -t <O> <T>/a`, `mv --target-directory=<O> <T>/a` → null; `mv -t <T> <O>/a`, `mv -t <D> <T>/a` → `deny`), AC3.8 (`cp -t <O> x`, `cp --target-directory=<O> x` → null; `cp -t <D> x` → `deny`), AC3.9 (PowerShell `Move-Item <T>/a <O>/b`, `Move-Item -Path <T>/a -Destination <O>/b` → null; `Move-Item <O>/a <O>/b`, `-Destination:<D>/b`, `-Path:<O>/a -Destination <T>/b` → `deny`), AC3.10 (`Copy-Item -Path <D>/a -Destination <O>/b` → null; `-Path <O>/a -Destination <D>/b` → `deny`; `-Path <outside-all>/a -Destination <O>/b` → `ask`). Chạy: đỏ.
- [ ] **Step 2:** trong `writeTargets` dò `-t`/`--target-directory` trước khi chia vai (đích `['write']`, đối số vị trí còn lại là nguồn: `mv` → `['delete']`, `cp` không có đích nào để kiểm); gán vai cho `mv`/`move`/`move-item` theo D6; bảng (lệnh, cờ) PowerShell cho cờ tách rời và dạng dính (`-Destination` → write; `-Path`/`-LiteralPath` của `Move-Item`/`Remove-Item` → delete, của `Copy-Item` → read, của `Set-Content`/`Add-Content` → write; `-FilePath` → write); `-T` không nhận giá trị. Chạy `--only path-permissions`, `--only hook`: xanh, trong đó `97-audit-mustfix` và `90-hooks` không sửa.
- [ ] **Step 3:** commit `feat(hooks): split mv, copy and PowerShell path roles for per-directory grants`.

### Task 6: bộ ca tương thích và hợp quyền
**Kind:** TOOLING
**TDD:** không — characterization: hành vi đã nằm ở Task 2–5, các ca này phải xanh ngay; ca đỏ thì sửa tại file production của task sinh ra nó và nêu ở báo cáo
**Ước lượng:** 20'
**Phủ AC:** AC4.1, AC4.2, AC4.3, AC4.4, AC5.1, AC5.2, AC5.3, AC6.1
**Files:**
- Test: `test/contract/99-path-permissions.contract.mjs`

**Interfaces:**
- Consumes: `guard-bash.decide`, `guard-files.decide`, bảng ca của Task 3–5
- Produces: không có

- [ ] **Step 1:** thêm test tham số hoá: AC4.1 (`fullReadRoots: [D]` + `{<D>/out, read+write}` → Write `<D>/out/f` null, Write `<D>/x` `deny`, Read `<D>/x` null, `rm <D>/out/f` `deny`); AC4.2 (`fullRoots: [T]` + `{<T>/keep, read}` → `rm <T>/keep/f` null; `{<P>/sub, read}` → `rm`/Write `<P>/sub/f` null; tương tự `scratchpad_dir` và `<tmpdir>/claude/p/x`); AC4.3 (hai mục cùng `path` `read` và `write` → gộp; `rm <tmpdir>/claude` luôn `deny`); AC4.4 (`rm <T>/../<tên O>/f` `deny`, `rm <T>/sub/../f` null, mục có `/` cuối khớp, ca hoa/thường chỉ ở win32); AC5.1 (chỉ `fullRoots: [T]` chạy lại bảng AC3.1–AC3.10 với `T`: y hệt `["read","write","delete"]`); AC5.2 (chỉ `fullReadRoots: [D]`: Read/Grep null; Write, `rm`, `cp x`, `mv <D>/a <T>/b` → `deny`); AC6.1 (`mode: "ask"`, phiên không bypass, hoặc `tracked` trả true cho file → kết quả y hệt khi không có `fullPaths`). Chạy `--only path-permissions`: xanh.
- [ ] **Step 2:** chạy `node test/validate.mjs --only permission`, `--only hook`, `--only gate-file`: xanh (AC5.3); không thêm test lặp với `94`/`99-hook-popup`.
- [ ] **Step 3:** commit `test(hooks): cover fullPaths union, compatibility and gating`.

### Task 7: README, README_VI, CLAUDE.md
**Kind:** DOCS
**TDD:** không — chỉ tài liệu; pin `test/content/29-*` và `30-*` kiểm các từ khoá vận hành đã có
**Ước lượng:** 20'
**Phủ AC:** AC7.1
**Files:**
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Modify: `test/content/29-permission-modes-docs.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** README mục Hooks (đoạn chế độ quyền, dòng "Confinement to the roots" và "Read-only roots") và bản tương ứng ở `README_VI.md`: thêm `fullPaths` với ví dụ của design, bảng quyền theo lệnh (K2), quy tắc hợp quyền (không thu hẹp được thư mục trong root đầy đủ), `write` không kéo theo `read`, ghi rõ heuristic đọc token không phải sandbox, symlink/`ln`/`sed -i`/`find -delete`/`xargs rm`/`git clean` không phân loại theo quyền, `Copy-Item -Path` chỉ cần `read`, Bash đọc file (`cat`…) không bị nhốt theo `read`. `CLAUDE.md` dòng mô tả khoá `aip-gate.json` nhắc `fullPaths` cạnh `fullRoots`/`fullReadRoots`. Thêm vào pin `29-permission-modes-docs` một assert `AC7.1` chỉ cho hợp đồng vận hành: README, README_VI và CLAUDE.md chứa `fullPaths`, README/README_VI chứa ba giá trị `read`, `write`, `delete` (không pin cả đoạn văn).
- [ ] **Step 2:** đối chiếu khẳng định với code: tên khoá, ba giá trị `allow`, bảng lệnh → quyền, `Copy-Item -Path` → read, `<tmpdir>/claude` ngoại lệ; ghi bảng `khẳng định → file:line → khớp|lệch`, sửa dòng lệch hoặc gắn `[Unverified]`. Chạy `node test/validate.mjs --only permission-modes-docs` (hoặc `--build`): xanh.
- [ ] **Step 3:** commit `docs(hooks): document fullPaths per-directory permissions`.

### Task 8: spec sống, version, full suite
**Kind:** DOCS
**TDD:** không — spec và version; `npm test` kiểm lock, spec và toàn bộ contract
**Ước lượng:** 20'
**Phủ AC:** AC8.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/contract/60-versions.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** spec `hooks-gates`: đổi R7 (root gồm `fullPaths`; ghi/xoá phân biệt theo vai), R10 (root chỉ-đọc là trường hợp riêng của `fullPaths`), R20 (19 khoá, hàng `fullPaths` kiểu array/untracked/`[]`, câu lý do), thêm R24 (mô hình hợp quyền, bảng quyền theo lệnh, quy tắc xác thực, quy tắc bí mật D1–D8; nguồn trỏ design); thêm dòng lịch sử cho R7, R10, R20 (đổi) và R24 (thêm); đổi `Cập nhật:`. Nếu R21–R23 chưa có ở master thì đánh số lại theo ghi chú giả định của design.
- [ ] **Step 2:** đối chiếu từng khẳng định mới (số khoá 19, ba giá trị `allow`, vai `mv`, ngoại lệ `<tmpdir>/claude`, bí mật chỉ miễn ở root đủ ba quyền) với code; ghi bảng `khẳng định → file:line → khớp|lệch`, sửa dòng lệch.
- [ ] **Step 3:** bump `core/.manifest.json` (tăng patch so với version lúc bắt đầu nhánh); `npm run build`; `node cli/lib/versions.mjs --lock`; `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-12-scoped-path-permissions/ --base master`; `npm test`. Xanh.
- [ ] **Step 4:** commit `docs(specs): record fullPaths per-directory permissions; chore(core): bump version`.
