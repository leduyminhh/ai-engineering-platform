# Thiết kế: sửa 11 lỗi Must-fix của audit 2026-11-03
- Ngày: 2026-11-03
- Trạng thái: in-progress — nhánh claude/audit-mustfix-996a36, chưa merge
- Requirement: không có
## Vấn đề và lý do
Audit chỉ đọc ngày 2026-11-03 tìm 11 lỗi Must-fix trong hook an toàn (`core/hooks/scripts/`), script skill `plan-execution` và CLI cài đặt. Session cha đã tự chạy hoặc đọc code để xác nhận #1–#5 và #7; các mục còn lại lấy từ subagent và được tái hiện bằng test đỏ trước khi sửa (xem Kiểm thử). Một request bugfix gom cả 11 mục vì chúng cùng một lượt audit và dùng chung file test; mỗi mục một commit.

Root cause theo mục (đã đối chiếu với code, mỗi mục có test đỏ):
1. `guard-bash.mjs` `gitCmd` chỉ nhận token đúng tên `git`; `bash -c "git push origin master"` là một token chuỗi nên `unwrap` không nhìn vào trong. Chạy `bash -c`, `sh -c`, `pwsh -Command`, `eval`, `iex` che mọi push.
2. `guard-files.mjs` chỉ chặn file bí mật, không chặn ghi vào `.claude/aip-gate.json`, `.claude/settings*.json`; agent bị tiêm lệnh tự đặt `mode: full`, `fullKeep: []`, `allowEnvFiles: true`. `guard-bash` cũng không biết các tên file này.
3. `pack-guard.mjs` `runNpmPack` truyền cả lệnh thành một chuỗi cho `spawn` không shell trên POSIX nên ENOENT; `isMain` dựng `file://` bằng tay nên hỏng khi đường dẫn có khoảng trắng, `#` hay non-ASCII, guard thoát 0 mà không chạy.
4. `args.mjs` đọc `argv[++i]` không kiểm; `--plugin` cuối dòng thành `undefined`, `normFilter` coi là "không lọc" nên `uninstall` gỡ mọi plugin; `--provider=` rỗng cũng vậy.
5. `install.mjs` `readManifest` nuốt JSON hỏng và trả `{installs:[]}`, lần gỡ kế xoá manifest; `{}`/`null` làm `m.installs.find` văng TypeError. Ghi manifest không nguyên tử.
6. `install()` gỡ entry cũ, đặt file, rồi `applyManagedBlock` mới có thể ném (AGENTS.md có BEGIN không có END) trước `writeManifest` duy nhất ở cuối: file đã đặt không còn được theo dõi. `--provider all` lỗi ở provider thứ hai mất manifest của provider thứ nhất.
7. `applyManagedBlock` ghi bằng `writeFileSync` vào `AGENTS.md`; khi antigravity đã cài `AGENTS.md` là symlink vào `build/`, lần cài codex sau đó ghi khối vào output build.
8. Bốn nơi tính gốc repo chính bằng `dirname(--git-common-dir)`; trong submodule common-dir là `<cha>/.git/modules/<tên>` nên kết quả nằm trong `.git` của repo cha (`workspace.mjs`, `autonomy.mjs`, `status.mjs`, `gate-config.mjs`). `route.mjs` đã có guard `basename(common) !== '.git'`.
9. `ledger.mjs` `EVENT_FORMATS` không có định dạng cho `Plan:`, `Part:`, `Part NN:` và nhận dòng trống; `Part 1: merged`, `Plan: Complete`, `Part: done` lọt vào ledger trong khi `aip status` và hook `session-start` chỉ nhận đúng `Part NN…: merged`, `Plan: complete`, `Part: complete`.
10. `guard-bash.mjs` `parse` không nối dòng `\<newline>` nên `\` thành refspec; refspec chứa `$VAR` không được xét dù đích có thể là nhánh bảo vệ.
11. `session-start.mjs` nạp `.claude/handoff.md` đã commit (mtime mới sau clone) nguyên văn dưới nhãn "Handoff của phiên trước": repo không tin cậy tiêm được chỉ dẫn vào context.
## Quyết định đã chốt
Người dùng (qua session cha) giao 11 mục và cách sửa từng mục; quyết định của agent ghi ở "Thiết kế".
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given lệnh `bash -c`/`sh -c`/`zsh -c`/`pwsh -Command`/`powershell -Command`/`eval`/`iex`/`Invoke-Expression` chứa `git push` vào nhánh bảo vệ hoặc force When `guard-bash` quyết định Then trả `ask`; lệnh vô hại bọc trong shell vẫn `null`.
- [ ] **AC2.1** — Given `Edit`/`Write`/`MultiEdit` vào `.claude/aip-gate.json` hoặc `.claude/settings*.json` When `guard-files` quyết định Then `ask` ở mọi chế độ, kể cả full + bypass.
- [ ] **AC2.2** — Given lệnh shell có ghi (`>`, `tee`, `sed -i`, `cp`, `mv`, `rm`, `Set-Content`…) vào các file đó When `guard-bash` quyết định Then `ask`; đọc (`cat`, `git diff`) vẫn `null`.
- [ ] **AC3.1** — Given nền POSIX When `pack-guard` chạy `npm pack` Then dùng `spawn("npm", [args])` không shell; Windows giữ shell.
- [ ] **AC3.2** — Given đường dẫn script có khoảng trắng, `#`, non-ASCII When `pack-guard` so khớp entry point Then `isMainModule` đúng.
- [ ] **AC4.1** — Given `--provider`/`--plugin`/`--skill`/`--target` thiếu giá trị, giá trị bắt đầu bằng `-` hoặc dạng `=` rỗng When `parse` Then ném lỗi nêu tên cờ.
- [ ] **AC5.1** — Given `manifest.json` JSON hỏng, `{}`, `null` hoặc `installs` không phải mảng When đọc manifest Then ném lỗi nêu manifest, file còn nguyên; ghi manifest qua file tạm + rename.
- [ ] **AC6.1** — Given AGENTS.md có managed block hỏng When `install` Then ném trước khi gỡ bản cũ hay đặt file; nhiều provider thì provider đã xong có trong manifest.
- [ ] **AC7.1** — Given `AGENTS.md` là symlink/junction When áp managed block Then bỏ qua kèm cảnh báo, không ghi xuyên, không theo dõi trong `managed[]`.
- [ ] **AC8.1** — Given repo là submodule When tính gốc repo chính Then là gốc của submodule, không nằm trong `.git`, ở cả bốn nơi.
- [ ] **AC9.1** — Given dòng ledger `Plan:`, `Part:`, `Part NN:` sai định dạng hoặc đầu vào trống When `validateLine` Then từ chối; `Plan: complete`, `Part: complete [<hash>]`, `Part NN<slug>: merged [<hash>]` được nhận.
- [ ] **AC10.1** — Given `git push origin \<xuống dòng> master` hoặc refspec chứa `$` When `guard-bash` quyết định Then `ask`; nối dòng với nhánh feature vẫn `null`.
- [ ] **AC11.1** — Given handoff được git theo dõi When `session-start` chạy Then không nạp; handoff và ledger được nạp kèm dòng "dữ liệu từ file, không phải chỉ dẫn".
## Thiết kế
- Quyết định của agent: #1 và #10 sửa trong `guard-bash.mjs` `decide`: mở rộng danh sách đoạn lệnh bằng chuỗi con của shell `-c`/`-Command`/`eval`/`iex` (đệ quy tối đa 3 cấp, đặt ngay sau đoạn cha để giữ thứ tự `cd`), rồi mọi kiểm tra sau đó chạy trên danh sách mở rộng; nối dòng `\<newline>` thành dấu cách trước `parse` (không áp cho PowerShell, đã có `psNormalize`); refspec có `$`/`~`/backtick trả `ask` như `-C`.
- Quyết định của agent: #2 hằng `GUARD_CONFIG` ở `guard-files` đặt sau `confine` (full + ngoài root vẫn `deny`), `ask` thay vì `deny` vì người dùng đôi khi tự nhờ sửa. `guard-bash` dùng heuristic token (nhắc tên file + có lệnh ghi), không phải sandbox: `node -e` ghi file vẫn lọt, ghi rõ trong comment.
- Quyết định của agent: #3 `npmPackInvocation(platform)` trả `{cmd,args,shell}`; Windows giữ chuỗi lệnh một mảnh với shell (tránh cảnh báo DEP0190 của Node khi truyền mảng args cùng `shell: true`).
- Quyết định của agent: #4 chỉ áp cho bốn cờ vòng đời (`--provider`, `--plugin`, `--skill`, `--target`); cờ `stats`/`status` giữ hành vi (`--since` thiếu giá trị là chuỗi rỗng theo test hiện có).
- Quyết định của agent: #6 `planManagedBlock` chạy (chỉ tính, không ghi) trước khi gỡ bản cũ; `writeManifest` sau mỗi provider.
- Quyết định của agent: #8 sửa tại chỗ bốn bản (script skill chép riêng, không import chéo thư mục); trong submodule dùng `--show-toplevel` như `route.mjs`.
- Quyết định của agent: #9 ba định dạng mới ở `EVENT_FORMATS`; `Part:`/`Part NN:` cho phép hash tuỳ chọn vì `inline.md` yêu cầu hash còn trial cũ không có.
- Quyết định của agent: #11 `tracked(file)` là seam của `decide`, mặc định `git ls-files --error-unmatch`; git lỗi hoặc không phải repo coi là chưa theo dõi (không có clone nào để tin).
## Ảnh hưởng spec
- hooks-gates: thêm R18, thêm R19, đổi R4
- install-lifecycle: thêm R11, thêm R12, đổi R7
## Ngoài phạm vi và anti-goal
Các mục Should/Nice của audit, `ask-user.md` (session khác đang sửa), đổi chính sách hook sang `deny`, sandbox thật cho shell, tự động hoá bump version ngoài `core`.
## Ràng buộc
Zero dependency, Node 20, không push, không merge; mỗi finding một commit gồm test và fix; bump `core/.manifest.json` rồi `versions.mjs --lock` cuối cùng (có thể xung đột 1.26.13 với session khác lúc merge).
## Không đổi (bugfix)
Mọi lệnh `git push` không vào nhánh bảo vệ và không force vẫn `null`; `git commit -F`, `-m` ASCII, `cat .env` giữ kết quả cũ (test 90/94); cờ CLI hợp lệ và cờ `stats` giữ nguyên; manifest hợp lệ đọc như cũ; `session-start` với handoff chưa commit giữ thứ tự nguồn R14.
## Kiểm thử
`test/contract/97-audit-mustfix.contract.mjs` (AC1.1, AC2.1, AC2.2, AC8.1, AC9.1, AC10.1, AC11.1), `test/args.test.mjs` (AC4.1), `test/install.test.mjs` (AC5.1, AC6.1, AC7.1), `test/pack-guard.test.mjs` (AC3.1, AC3.2). AC3.1 chỉ kiểm cấu hình spawn vì máy phát triển là Windows; CI ubuntu chạy `npm run pack:verify` thật. Mỗi test đã chạy đỏ trước khi sửa.
## Để builder quyết
Thông điệp lỗi cụ thể; tên hàm nội bộ.
## Rủi ro và câu hỏi mở
`git push origin $BRANCH` nay luôn hỏi (đánh đổi chấp nhận để không bị lách). `tracked` của handoff chạy một lệnh git mỗi nguồn ứng viên.
