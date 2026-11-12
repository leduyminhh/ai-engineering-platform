# Thiết kế: popup hook dễ hiểu, bớt bắt nhầm, giữ mcpDeny
- Ngày: 2026-11-12
- Trạng thái: draft
- Requirement: không có

## Vấn đề và lý do

Popup "Allow Claude to run this command?" hiện câu `reason` của nhánh `ask` ngay trên khối lệnh thô. Người dùng phàn nàn popup toàn lệnh máy móc, câu hỏi dùng thuật ngữ nội bộ, và một lệnh commit bị hỏi nhầm là "ghi cấu hình hook". Đã đọc và chạy thử trong code (`core/hooks/scripts/`):

1. **Câu reason khó hiểu.** `guard-bash.mjs` 452 (`Nguyên tắc nền: ${why} cần người dùng xác nhận trước.` với `why` từ `pushReason` 122–133), 456, 466, 471, 475, 379; `guard-files.mjs` 77 và 94. Chứa "nguyên tắc nền", "hook an toàn", "root", "fullRoots", "bypass"; không nói cho phép thì hậu quả gì, nên chọn gì; câu bí mật không nêu token khớp.
2. **Bắt nhầm cấu hình hook (guard-bash 455).** `GUARD_CONFIG.test(cmd) && WRITE_IN_STRING.test(...)` so cả chuỗi lệnh nên tên file và một lệnh ghi bất kỳ ở chỗ khác cùng kích hoạt. Chạy thử: `git commit -m "docs: aip-gate.json" > m2.txt` → ask; `cat .claude/settings.json | tee x` → ask. Cả hai không ghi vào file cấu hình.
3. **Bắt nhầm file bí mật (`secretAsk`, 473–476).** `secretScanText` chỉ miễn `echo`, `printf`, `git check-ignore|ls-files`. Chạy thử: `git log -- .env`, `ls credentials`, `grep -rn credentials src`, `npm test -- --grep "credentials"` → ask.
4. **Hỏi thừa ở full với chuỗi trong `bash -c`.** `confineSegment` (293–294) dùng `WRITE_IN_STRING` (một regex tìm tên lệnh ghi hoặc `>` trong chuỗi), nên `bash -c "awk '$1>2' f"` → ask dù `>` nằm trong nháy của awk. Dạng không có `bash -c` (`awk '$1>2' f`) đã đúng (null) vì `confineSegment` đọc token và bỏ `>` trong nháy.
5. **Fail-open nới quyền (E).** `guard-mcp.decide` dùng `readGate`, mà `resolveGate` trả `null` khi `gitUnknown` và `readGate` trả `null` khi file hỏng. Cả hai trường hợp `mcpDeny` bị bỏ qua. `mcpAllow`/`mcpDeny` là khoá `trust: any` (chỉ siết), nên bỏ qua chúng là hướng nới.

## Quyết định đã chốt

Phạm vi A, B, E do người dùng duyệt ngày 2026-11-12. Không làm: hook cho lệnh phá huỷ, commit nhánh bảo vệ, `Co-Authored-By` (C); gộp `main()`, hằng câu, helper git (D).

- **A1 — khuôn reason.** Mọi reason `ask` là một đoạn theo thứ tự: lệnh làm gì → vì sao hỏi → cho phép thì sao → nên chọn gì. Bỏ "nguyên tắc nền", "hook an toàn", "root", "fullRoots", "bypass". Reason `deny` giữ nguyên (agent đọc, `fullRoots` là gợi ý hành động; test 94 dòng 149 ghim câu này). Chín câu người dùng đã xem là bản chuẩn; `guard-files` dòng 93–94 hiện dùng một câu cho cả `ask` lẫn `deny`, tách thành hai.
- **A2 — dữ liệu động trong câu.** Nhánh bảo vệ nêu tên nhánh (`master`); câu bí mật nêu token khớp (nhóm bắt của `SECRET`/`KEY_SECRET`); câu đọc ngoài project nêu đường dẫn. `pushReason` trả `{ kind, branch? }` thay vì chuỗi; ba kind `protected`, `force`, `unknown` (refspec biến/~ và `-C`/`cd` biến gộp vào `unknown`).
- **A3 — dòng "Lệnh gồm: …".** Tự sinh từ `segs` (parse sẵn có), chỉ ở reason của `guard-bash`: liệt kê tối đa 6 bước theo thứ tự, mỗi bước là `git <lệnh con>` hoặc tên lệnh, kèm "ghi vào `<đích>`" khi có chuyển hướng; hơn 6 bước thì "… và N bước khác". Ví dụ: `Lệnh gồm: git add, git commit, git push origin master.` Không đếm "3 file": `git commit -m` không nêu file nào, số file chỉ có khi chạy `git`, mà hook không chạy lệnh của người dùng. Khác ví dụ của người dùng ở điểm này.
- **A4 — rule AGENTS.md.** Thêm vào `### Rules` (hoặc `### Safety`) một dòng: mỗi lệnh Bash một việc, không nối chuỗi dài bằng `&&`, vì popup chỉ hỏi được cả chuỗi. `AGENTS.md` hiện đúng 200 dòng, bằng trần của baseline-slim (`test/contract/30-templates.contract.mjs`), nên thêm dòng phải kèm gộp ít nhất một dòng sẵn có; sửa `core/agents/AGENTS.template.md` trước rồi chép byte-identical sang `AGENTS.md`.
- **B1 — cấu hình hook theo đích ghi.** Tách khỏi `confineSegment` hàm `writeTargets(t)` trả đích ghi của một đoạn (chuyển hướng `>`/`>>`, đối số của `WRITE_CMDS`, cờ đường dẫn PowerShell) cộng tên lệnh đã bỏ tiền tố bọc. `GUARD_CONFIG` chỉ so với từng đích; `sed`/`perl` có cờ tại-chỗ (`-i`, `-pi`, `--in-place`) hỏi khi một đối số khớp `GUARD_CONFIG`. Quét `[...segs, ...naiveAll]` (đã bung `bash -c`/`eval`), nên `bash -c "echo x > .claude/aip-gate.json"` vẫn bị hỏi. Heuristic giữ giới hạn cũ: `node -e`, `git restore`, `curl -o` không bị bắt.
- **B2 — bí mật: bỏ qua metadata và đối số tìm kiếm.** Trong `secretScanText`: (a) mở rộng nhóm metadata: `ls`, `dir`, và `git log` chỉ khi mọi cờ nằm trong danh sách an toàn (`--oneline`, `--stat`, `--name-only`, `--name-status`, `--follow`, `--all`, `--graph`, `--decorate`, `-<n>`, `-n<k>`, `--format=`, `--pretty=`, `--date=`…); `-p`/`--patch`/`-u`/`-c`/`--cc`/`-L`/`-G`/`-S` hay cờ lạ → vẫn hỏi, vì chúng in nội dung file. Điều kiện hiện có (không chuyển hướng, không pipe sang lệnh sau, không `$()`/backtick) giữ nguyên. (b) Bỏ token mẫu tìm kiếm trước khi so `SECRET`: đối số dương đầu tiên (không phải cờ, không sau `--`) của `grep`/`egrep`/`fgrep`/`rg`/`ag`/`ack`/`findstr`/`select-string`, giá trị của `-e`/`--regexp`, và giá trị của `--grep`, `-t`, `--testNamePattern`, `--filter`, `-k` ở mọi lệnh (dạng `=` và dạng tách). Đối số còn lại (đường dẫn) vẫn so như cũ nên `grep x .env` vẫn hỏi.
- **B3 — chuỗi `bash -c`/`eval` ở full.** Thay `WRITE_IN_STRING.test(args.join(' '))` bằng `stringWrites(inner)`: parse chuỗi con (`parse` + `naiveSegments`, như phần còn lại của hook) và hỏi khi một đoạn có đích ghi hoặc là `WRITE_CMDS`. Chuỗi con nháy không đóng thì rơi về regex cũ. Vẫn là `ask` (không chuyển thành `deny`), đúng R7.
- **C1 — thư mục tạm do Claude sinh ra là root hợp lệ ở full (bổ sung 2026-11-12 theo yêu cầu người dùng sau khi xem popup thật).** `allowedRoots` thêm `<os.tmpdir()>/claude` (mọi thư mục tạm của phiên Claude Code, gồm scratchpad); `scratchpad_dir` của stdin vẫn là root như cũ. Dùng chung cho `guard-bash` (H6, bí mật ngoài root) và `guard-files` (confine). [Unverified] Bố cục `<tmpdir>/claude` lấy từ đường dẫn scratchpad thấy trong popup trên Windows; chưa kiểm trên POSIX.
- **C2 — biến gán trong cùng lệnh được giải ở full.** Ảnh popup thật: `S=$(cygpath -u 'C:\…\scratchpad'); mkdir -p $S/bin && cd $S …` bị hỏi "đường dẫn không xác định được" vì `$S`. Trước khi tách lệnh cho H6 (chỉ ở full, không áp cho PowerShell), thay `$NAME`/`${NAME}` bằng giá trị lấy từ khối phép gán ở ĐẦU chuỗi: mỗi phép gán `NAME=<literal tuyệt đối không khoảng trắng>` hoặc `NAME=$(cygpath [cờ] '<literal>')` kết thúc đúng bằng `;` hoặc xuống dòng. Không thay khi phần sau nhắc `NAME=`/`NAME+=`/`NAME in`, hoặc có `unset`/`read`/`eval`/`source`/…/here-string, hoặc heredoc không phải `cat`/`tee` với delimiter có nháy. Phép gán ở chỗ khác không được tin. (Bản đầu quét văn bản thô nên reviewer tái lập nhiều đường thoát; đã thu hẹp sau review.)
- **E — mcpDeny khi không đọc được cấu hình.** `guard-mcp` gọi `locateGate` (qua một hàm mới ở `gate-config.mjs`) thay `readGate`: (a) `gitUnknown` mà đọc được file → dùng config đó cho `mcpAllow`/`mcpDeny` (cả hai chỉ siết; `full` vẫn không hiệu lực vì `tracked` không xác định); (b) file `aip-gate.json` tồn tại nhưng hỏng (`source: 'worktree-invalid'` hoặc `mainInvalid`) trong repo git → `ask` cho mọi tool MCP, lý do nêu file hỏng và cách sửa; (c) ngoài repo git, không có file → như cũ (null, R3/R4). Quy tắc `start_session` thiếu model vẫn chạy trước.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given mỗi nhánh `ask` của `guard-bash` và `guard-files` (bảng ca: push bảo vệ, push force, push không biết nhánh, sửa cấu hình, nhắc file bí mật, commit nháy chưa đóng, full + đường dẫn không rõ, full + phiên không bypass, đọc ngoài project) When hook quyết định Then `reason` không chứa "nguyên tắc nền", "hook an toàn", "fullRoots", "bypass", "root"; chứa "cho phép" hoặc "từ chối"; dài tối đa 500 ký tự (không kể dòng "Lệnh gồm").
- [ ] **AC1.2** — Given push vào `master`, lệnh nhắc `.env`/`server.pem`, đọc `C:/x/y.txt` ngoài project When hook hỏi Then reason chứa lần lượt `master`, tên file khớp (`.env`, `server.pem`) và đường dẫn đã cho.
- [ ] **AC1.3** — Given `git add -A && git commit -m x && git push origin master` When `guard-bash` hỏi Then reason có dòng bắt đầu "Lệnh gồm:" chứa `git add`, `git commit`, `git push` theo thứ tự; lệnh 8 bước chỉ liệt kê 6 và có "2 bước khác"; reason của `guard-files` không có dòng này.
- [ ] **AC1.4** — Given `deny` của full ngoài project (`guard-bash` 463, `guard-files` ghi ngoài) When hook quyết định Then reason vẫn chứa `fullRoots` (không đổi).
- [ ] **AC1.5** — Given `AGENTS.md` và `core/agents/AGENTS.template.md` When đọc Then có dòng rule "mỗi lệnh Bash một việc", hai file byte-identical, ≤ 200 dòng.
- [ ] **AC2.1** — Given `git commit -m "docs: aip-gate.json" > m2.txt` và `cat .claude/settings.json | tee x` When `guard-bash` chạy Then null; Given `echo x > .claude/aip-gate.json`, `bash -c "echo x > .claude/aip-gate.json"`, `sed -i s/a/b/ .claude/settings.json`, `cp x .claude/settings.json` Then vẫn ask (các ca R18 hiện có không đổi).
- [ ] **AC2.2** — Given `git log -- .env`, `git log --oneline -5 -- credentials`, `ls credentials`, `grep -rn credentials src`, `npm test -- --grep "credentials"` When `guard-bash` chạy Then null; Given `git log -p -- .env`, `git diff -- .env`, `grep x .env`, `grep -rn credentials credentials.json`, `cat .env`, `git log -- .env | xargs cat` Then ask.
- [ ] **AC2.3** — Given full hiệu lực When `bash -c "awk '$1>2' f"`, `bash -c "grep -rm 1 x ."` Then null; `bash -c "rm /x"`, `bash -c "echo a > /x"`, `eval "rm /x"` và chuỗi nháy không đóng chứa `rm` vẫn ask.
- [ ] **AC3.1** — Given `gitUnknown` (git lỗi, có `.git` ở trên) và file có `mcpDeny: ["a"]` When tool `mcp__a__t` Then deny nêu `mcpDeny`; `mcpAllow` cũng áp.
- [ ] **AC3.2** — Given `aip-gate.json` hỏng (JSON sai hoặc không phải đối tượng) ở worktree hoặc ở repo chính khi chạy trong worktree When tool MCP bất kỳ Then ask, lý do nêu đường dẫn file; tool không phải MCP và `start_session` thiếu model không đổi (deny như R16).
- [ ] **AC3.3** — Given không có file, hoặc ngoài repo git, hoặc file hợp lệ không có `mcpDeny` When tool MCP Then như trước (null / theo `mcpAllow`).
- [ ] **AC6.1** — Given full hiệu lực, `scratchpad_dir` có hoặc không có trong stdin When `guard-bash` nhận `mkdir -p <tmpdir>/claude/p/s/scratchpad/bin` và `guard-files` nhận Write/Read vào `<tmpdir>/claude/p/s/x.txt` Then không ask, không deny; ghi vào `<tmpdir>/x.txt` (ngoài thư mục `claude`) vẫn deny.
- [ ] **AC6.2** — Given full + bypass, `scratchpad_dir` = `<tmpdir>/claude/p/s/scratchpad` When lệnh dạng `S=$(cygpath -u '<scratchpad_dir>'); R=/e/x; mkdir -p $S/bin && cd $S; cat > bin/docker <<'EOF'
stub
EOF
chmod +x bin/docker; PATH="$S/bin:$PATH" bash $R/run.sh` Then không ask (bản trước: ask "đường dẫn không xác định được").
- [ ] **AC6.3** — Given full When `S=/etc; rm $S/x`, `rm $S/x; S=/tmp/claude/a`, `S=$X; rm $S/x`, `cat > f <<'EOF'
S=/tmp/claude/a
EOF
rm -rf $S/x`, `S="/tmp/claude/a b"; rm $S` Then vẫn bị chặn (deny khi giải ra ngoài root, ask khi không xác định được; riêng `S=/etc; rm $S/x` bản trước chỉ ask); lệnh không ở full không đổi; gán không ở đầu chuỗi, `S=… cmd`, `unset`/`+=`/`for S in`/`read`/`eval`, gán lại sau heredoc và PowerShell đều không được tin.
- [ ] **AC4.1** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng version.

## Thiết kế

Tác động và vị trí:
- `core/hooks/scripts/guard-bash.mjs`: `pushReason` trả `{kind, branch}`; hàm dựng reason dùng chung (`askReason(parts, segs)`) và `summarize(segs)`; `writeTargets` tách từ `confineSegment`; `stringWrites`; `secretScanText` mở rộng; `hits` trả cả token khớp.
- `core/hooks/scripts/guard-files.mjs`: tách reason `ask`/`deny` ở `confine`; sửa `GUARD_CONFIG_ASK`.
- `core/hooks/scripts/gate-config.mjs`: thêm `gateForGuard(dir)` (bọc `locateGate`: `{ gate, invalid, gitUnknown }`); `guard-mcp.mjs` dùng nó, seam test `locate`.
- `core/agents/AGENTS.template.md` và `AGENTS.md`: một dòng rule.
- Test: `test/contract/94-permission-modes.contract.mjs` và `90-hooks.contract.mjs` (bảng ca AC1–AC2), `91-guard-mcp.contract.mjs` (AC3). Test reason chỉ kiểm khuôn (từ cấm, cụm "cho phép/từ chối", độ dài) và token khớp, không ghim cả câu.
- `core/hooks/scripts/gate-config.mjs`: `allowedRoots` thêm root tạm của Claude; `core/hooks/scripts/guard-bash.mjs`: `substituteVars(cmd)` dùng trong nhánh full.
- Spec sống `docs/specs/hooks-gates/spec.md`; `README.md`/`README_VI.md` mục Hooks (guard-bash, guard-mcp, mục "Không phát hiện"); `core/.manifest.json` 1.33.6 → 1.33.7; `plugins/_versions.lock.json` qua `versions.mjs --lock`.

## Ảnh hưởng spec
- hooks-gates: đổi R3, đổi R7, đổi R18, thêm R21, thêm R22, thêm R23

## Ngoài phạm vi và anti-goal
- Không đổi câu `deny` và câu `DENY_COMMIT`; không thêm hook mới; không đổi `gate-file.mjs` (hai bản sao giữ byte-identical); không đổi `session-start`/`gate-stop`.
- Không bắt thêm đường ghi cấu hình (`git restore`, `node -e`, `curl -o`): giới hạn heuristic đã ghi ở R18.
- Anti-goal: không hạ mức hỏi của lệnh đọc nội dung file bí mật; chỉ bỏ hỏi khi lệnh không thể in nội dung.
- C2 không phải bộ giải biến tổng quát: không giải `$(…)` khác, mảng, `export`, gán trong `if`/`||`/hàm; phép gán có điều kiện mà hook tin là đã chạy là rủi ro còn lại ([Inference]: chỉ ở full, vốn là heuristic không phải sandbox).

## Ràng buộc
- Zero-dependency; hook fail-open với lỗi nội bộ; không thêm lời gọi git ở đường nóng (`guard-mcp` vẫn một `locateGate`).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không merge, không push khi người dùng chưa xác nhận.

## Kiểm thử
- AC1.x: bảng ca ở `94-permission-modes` (đã có seam `config`, `repoRoot`, `tracked`) và `90-hooks`; một hàm kiểm khuôn dùng chung.
- AC2.x: bảng ca ask/null ở `90-hooks` (H2/H3 hiện có) và `97-audit-mustfix` (R18); mỗi ca bắt nhầm một dòng.
- AC3.x: `91-guard-mcp` với seam `locate`, và một ca CLI trong git repo thật có file hỏng.
- AC4.1: `npm run build`, `versions.mjs --lock`, `npm test`.

## Để builder quyết
- Chữ chính xác của từng câu (theo khuôn, bám chín câu đã duyệt); thay "bypass" bằng "chế độ bỏ qua hỏi quyền".
- Danh sách cờ an toàn của `git log` và danh sách lệnh tìm kiếm có thể gọn hơn nếu test thấy thừa.

## Rủi ro và câu hỏi mở
- [Inference] B2 nới hook về phía ít hỏi hơn. `git log` với cờ chưa nằm trong danh sách vẫn hỏi nên sai về phía an toàn; `ls <file bí mật>` chỉ lộ sự tồn tại và tên file. Một đối số tìm kiếm bị nhận nhầm là đường dẫn chỉ gây hỏi thừa, ngược lại (đường dẫn bị nhận nhầm là mẫu tìm) khó xảy ra vì mẫu chỉ là đối số dương đầu tiên, trước mọi `--`.
- E(b) đổi file hỏng từ "cho qua" thành "hỏi mỗi lần gọi MCP". Người dùng có file hỏng sẽ thấy popup lặp lại cho tới khi sửa; thông báo nêu đường dẫn. Chưa có số liệu mức độ file hỏng gặp ngoài thực tế.
- E(a) làm hook đọc cấu hình khi git lỗi; quyết định trước đó ("gitUnknown: giữ hành vi như ngoài repo") nhằm khoá `untracked`, còn `mcpAllow`/`mcpDeny` chỉ siết nên an toàn; chỉ đổi ở `guard-mcp`.
- Câu mở cho người duyệt: (1) file hỏng thì `ask` (đề xuất) hay `deny` mọi tool MCP; (2) chấp nhận dòng "Lệnh gồm" liệt kê bước thay vì đếm file; (3) cách gộp để `AGENTS.md` không vượt 200 dòng khi thêm rule (builder chọn dòng ít giá trị nhất, trình ở G3).
