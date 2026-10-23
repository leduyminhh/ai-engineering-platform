# Thiết kế: hai chế độ quyền theo project, `ask` mặc định và `full` (project P4e)
- Ngày: 2026-10-22
- Trạng thái: đã triển khai trên nhánh, chờ duyệt diff (2026-10-22)
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P4e (xu hướng 8)

## Vấn đề và lý do

Sau P4, aip chỉ có một chế độ: `ask`/`deny` cứng (policy trong `settings.json` cộng ba hook `guard-*`). Người dùng muốn thêm một chế độ thứ hai cho project mà họ tin: chạy không người canh, được xóa, đọc `.env`, khóa, secret và các lệnh nguy hiểm khác, nhưng chỉ trong project đó; mọi nơi khác vẫn hỏi như hiện tại.

Hai ràng buộc từ tài liệu Claude Code (qua subagent, tóm tắt thứ cấp, 2026-10-22) quyết định cách làm:
- Quy tắc `permissions.deny/ask` gộp qua mọi cấp và `deny` ở bất kỳ cấp nào đều thắng; project không gỡ được quy tắc của cấp người dùng. Quy tắc `deny` và `ask` vẫn hiệu lực trong `bypassPermissions`. Vì vậy mặc định "ask" ở cấp global không thể là quy tắc trong settings người dùng, và một project muốn `full` thì settings của chính nó không được chứa quy tắc của aip.
- `permissions.defaultMode` kiểu bypass trong settings của project bị bỏ qua; chỉ bật bằng `--permission-mode bypassPermissions` hoặc settings người dùng.

## Đã kiểm thực tế (2026-10-22, Claude Code 2.1.306, máy của người dùng)

Một hook thử ghi các khóa của stdin PreToolUse vào file (không ghi nội dung lệnh). Chi phí khoảng 0,46 USD cho 4 phiên `claude -p` nhỏ:
- **Hook khai trong settings, chế độ bypass:** stdin có `permission_mode: "bypassPermissions"`.
- **Hook của plugin (`--plugin-dir`), chế độ bypass:** có `permission_mode: "bypassPermissions"`; chế độ mặc định: `permission_mode: "default"`. Một phiên bypass tương tác do người dùng tự chạy cho cùng kết quả.
- **Các khóa của stdin PreToolUse:** `session_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort`, `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id` (và `prompt_id` ở chế độ `-p`); phiên chính không có `agent_type`.
- **Hook trả `permissionDecision: "ask"` trong bypass (`-p`):** lệnh `echo ... > file` **không chạy** và file không xuất hiện; mô hình trả lời "blocked". Kết luận: `ask` của hook được tôn trọng trong bypass; trong chế độ `-p` không có ai trả lời nên bị từ chối. [Unverified] chưa thử bằng tay trong phiên tương tác để xem có hiện hộp xác nhận hay không.
- **Hook trong subagent (spike P4e, 2026-10-22, Claude Code 2.1.306, `claude -p --permission-mode bypassPermissions`, hook khai trong settings, trần 0,2 USD):** lệnh Bash do subagent `general-purpose` chạy có stdin với `permission_mode: "bypassPermissions"`, `scratchpad_dir`, thêm `agent_id` và `agent_type`; phiên chính gọi Agent tool không có `agent_type`. Kết luận: `full` hiệu lực cả trong subagent. Phiên dừng vì vượt trần ngân sách sau lệnh Bash đó.
- **Chưa kiểm:** `permission_mode` khi người dùng đổi chế độ giữa phiên (Shift+Tab; không tự động hóa được trong `-p`), và hook của plugin bên trong subagent (chỉ thử hook khai trong settings).

## Quyết định đã chốt

Của người dùng (2026-10-22): hai chế độ. (1) `full`: bypass đầy đủ lệnh như xóa, truy cập env, secret. (2) `ask`: không tự động truy cập, phải chấp nhận như hiện tại. Mặc định global là `ask`; chỉ project con có cấu hình `.claude` mới vào `full`, bằng lệnh `aip mode full`; **và** chỉ phiên chạy ở chế độ bypass mới được toàn quyền trong thư mục đó. Bổ sung 2026-10-22: trong `full` chỉ được thao tác trong `root/*` của project (ngoài root không được ghi hay xóa); chấp nhận việc Windows native không có sandbox; cách xử lý đánh đổi ở phiên không bypass do tôi đề xuất (mục dưới).

Người dùng duyệt 2026-10-22: câu hỏi mở 1 = vẫn hỏi (`fullKeep` mặc định `["push"]`), câu hỏi mở 2 = giữ H5 trong `full`; các đề xuất còn lại của design được duyệt cùng.

Đề xuất của tôi (đã duyệt):
- **Cấu hình:** khóa `mode` trong `<git-root>/.claude/aip-gate.json`, giá trị `"ask"` (mặc định, thiếu khóa = `ask`) hoặc `"full"`. Không có cấu hình thừa kế từ thư mục cha.
- **Chế độ hiệu lực `full`** chỉ khi **cả hai** đúng: `mode === "full"` trong cấu hình project, và stdin của hook có `permission_mode === "bypassPermissions"`. Thiếu trường hoặc giá trị khác ⇒ chạy như `ask`. Hook chạy trong subagent chưa kiểm nên mặc định rơi về `ask` nếu thiếu trường.
- **Hành vi hook khi `full` hiệu lực:**
  - `guard-bash`: không đưa quyết định cho H1 (push nhánh bảo vệ), H2 (commit `-m` có dấu), H3 (lệnh nhắc file bí mật), trừ một danh sách giữ lại `fullKeep` (mặc định `["push"]`: push lên `main`/`master`/`dev`/`develop` và force push vẫn hỏi, vì hướng ra ngoài và khó đảo ngược; đặt `[]` để mở hết).
  - `guard-files`: bỏ H3 (đọc/ghi file bí mật). H5 (`writeScope` của agent) **giữ nguyên**, vì đó là phạm vi vai trò của agent, không phải rào an toàn của chủ project.
  - `guard-mcp`: bỏ giới hạn `mcpAllow`, nhưng vẫn tôn trọng `mcpDeny` (danh sách chặn tường minh của chủ project).
  - `gate-stop` và `session-start`: không đổi (không phải quyền).
- **Nhốt trong `root/*` khi `full` hiệu lực (yêu cầu của người dùng).** Các root được phép: gốc project (thư mục git chứa `aip-gate.json`; với worktree thì cả gốc worktree lẫn gốc repo chính, như `gate-config.mjs` đã làm), `scratchpad_dir` do chính stdin của hook cấp (Claude Code ghi file tạm ở đó), và các đường dẫn tuyệt đối khai trong khóa tùy chọn `fullRoots` (mặc định rỗng). Ngoài các root đó:
  - `guard-files`: Edit/Write/MultiEdit/NotebookEdit → `deny` (H6); Read/Grep → `ask` (đề xuất của tôi: đọc ngoài root cần xác nhận thay vì cấm hẳn, vì nhiều việc hợp lệ cần đọc file hệ thống hoặc cấu hình; `ask` được tôn trọng trong bypass).
  - `guard-bash`: lệnh có đối số đường dẫn cụ thể của nhóm ghi/xóa (`rm`, `rmdir`, `del`, `erase`, `rd`, `Remove-Item`, `mv`, `move`, `Move-Item`, `cp`, `copy`, `Copy-Item`, `touch`, `mkdir`, `chmod`, `chown`, `tee`, `truncate`, `Set-Content`, `Out-File`, `Add-Content`) và chuyển hướng `>`/`>>` mà đích nằm ngoài root → `deny` (H6). Đường dẫn không phân tích được (biến `$X`, `~`, `$HOME`, `*` ở gốc, lệnh ghép không tách được) → `ask`. [Inference] đây là heuristic: chương trình tự ghi file (python, npm script, makefile) không bị phát hiện; nhốt thật vẫn cần container, VM hoặc WSL2 với sandbox.
- **`aip mode full|ask|status`** (chỉ phạm vi project, từ chối `-g`):
  - `full`: ghi `mode: "full"` vào `aip-gate.json` (giữ khóa khác, bỏ BOM, tạo file nếu thiếu); nếu `.claude/settings.json` trùng byte với bản aip sinh thì thay bằng `{"permissions":{"deny":[],"ask":[]}}`; nếu khác (người dùng đã sửa) thì không đụng và liệt kê quy tắc của aip còn trong đó cần tự gỡ, vì `deny`/`ask` vẫn chặn trong bypass. In cảnh báo: phải chạy Claude bằng `--permission-mode bypassPermissions` hoặc settings người dùng (project không bật được); lệnh xóa ở đường dẫn quan trọng vẫn có thể hỏi theo tài liệu; trên Windows native không có sandbox nên "trong thư mục đó" chỉ là theo cấu hình hook, không phải nhốt bằng hệ điều hành (muốn nhốt: WSL2, VM hoặc container).
  - `ask`: bỏ khóa `mode`; nếu `settings.json` đang đúng bản của chế độ `full` do aip sinh thì sinh lại policy chuẩn (tôn trọng `allowEnvFiles`).
  - `status`: in `mode` hiện tại, nguồn cấu hình, và `settings.json` còn quy tắc aip hay không.
- **Giữ `ask` cho phiên không bypass trong project `full` (đề xuất của tôi cho cảnh báo 4):** các quy tắc `ask` của policy chạy bằng hook thay vì `settings.json` khi `mode: "full"` nhưng phiên không phải bypass: `guard-bash` hỏi với `git push` (mọi nhánh), `curl`, `wget`, `kubectl apply`, `terraform apply`, `helm upgrade`. Danh sách mẫu nằm trong script hook và có một contract test so khớp với nhóm `git_push`, `network` (phần Bash) và `production_deploy` của `core/permissions/policy.json` để hai nơi không lệch. Khi `mode` là `ask` thì không bật (đã có quy tắc trong `settings.json`), khi `full` hiệu lực thì tắt. Khoảng hở còn lại: `WebFetch` (là tool, không phải Bash) không còn bị hỏi trong phiên không bypass của project `full`; chấp nhận và ghi trong tài liệu. Chủ project có thể chạy `aip mode ask` để lấy lại toàn bộ.
- **Baseline:** thêm một bullet trong `Safety`: khi `aip-gate.json` có `mode: "full"` và phiên ở `bypassPermissions`, chủ project đã cho phép truy cập không người canh trong project đó; các xác nhận về xóa và file bí mật được bỏ, riêng push lên nhánh bảo vệ vẫn cần xác nhận (nếu `fullKeep` không đổi). Chép `AGENTS.md` byte-for-byte.
- **Phạm vi "trong thư mục đó":** theo vị trí `aip-gate.json` và các root ở trên; không thừa kế từ thư mục cha. Hook của một project chỉ đọc cấu hình của repo chứa cwd phiên (`guard-bash`). `guard-files` đọc hai nơi: công tắc bí mật/env đọc cấu hình của repo chứa file đích, còn nhốt root (H6) đọc cấu hình của repo chứa cwd phiên; lý do: nếu H6 đọc theo repo của file đích thì đích luôn nằm trong root của chính repo đó và việc nhốt không bao giờ kích hoạt.

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given hàm xác định chế độ hiệu lực (`effectiveMode(config, input)`), Then bảng tham số cho `config.mode` ∈ {thiếu, `ask`, `full`, giá trị lạ} × `input.permission_mode` ∈ {thiếu, `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`} chỉ trả `full` khi `mode === "full"` và `permission_mode === "bypassPermissions"`; mọi trường hợp khác trả `ask`.
- [x] **AC1.2** — Given `full` hiệu lực, When `guard-bash` nhận `rm -rf x`, `cat .env`, `curl http://x`, `git commit -m "có dấu"`, Then không có quyết định; `git push origin main` và `git push --force` vẫn `ask` khi `fullKeep` mặc định, và không có quyết định khi `fullKeep: []`.
- [x] **AC1.3** — Given `full` hiệu lực, When `guard-files` nhận Read/Write `.env` hoặc `*.pem`, Then không có quyết định; Edit ngoài `writeScope` của một agent có `writeScope` vẫn `deny`.
- [x] **AC1.4** — Given `full` hiệu lực, When `guard-mcp` nhận tool của server không nằm trong `mcpAllow`, Then không có quyết định; server nằm trong `mcpDeny` vẫn `deny`.
- [x] **AC1.5** — Given `mode: "full"` nhưng `permission_mode` là `default` hoặc thiếu, Then cả ba hook chạy như `ask` (cùng quyết định như khi không có `mode`).
- [x] **AC1.6** — Given `full` hiệu lực, When `guard-files` nhận Write/Edit/MultiEdit/NotebookEdit vào đường dẫn nằm ngoài mọi root được phép (gốc project, gốc repo chính khi ở worktree, `scratchpad_dir` của stdin, `fullRoots`), Then `deny` kèm lý do; đường dẫn trong root (kể cả `..` được chuẩn hóa về trong root) không có quyết định; đường dẫn đi ra ngoài bằng `..` bị `deny`; Read/Grep ngoài root là `ask`.
- [x] **AC1.7** — Given `full` hiệu lực, When `guard-bash` nhận `rm -rf ../x`, `rm /etc/x`, `mv a /tmp/b` (đích ngoài root, không nằm trong `scratchpad_dir`), `echo x > /tmp/y` hoặc `del C:\Windows\x`, Then `deny`; `rm -rf build`, `mv a b`, `echo x > out.txt` trong root không có quyết định; lệnh với đường dẫn không phân tích được (`rm -rf $X`, `rm -rf ~`, `rm -rf *` ở gốc) là `ask`.
- [x] **AC1.8** — Given `mode: "full"` và phiên KHÔNG bypass (`permission_mode` là `default` hoặc thiếu), When `guard-bash` nhận `git push origin feature/x`, `curl http://x`, `kubectl apply -f x`, Then `ask`; Given `mode` thiếu hoặc `ask`, Then các mẫu này không do hook quyết (quy tắc nằm ở `settings.json`); Given `full` hiệu lực, Then không có quyết định (trừ `fullKeep`).
- [x] **AC1.9** — Given hai danh sách (mẫu `ask` trong hook và quy tắc Bash của nhóm `git_push`, `network`, `production_deploy` trong `core/permissions/policy.json`), Then một contract test chứng minh chúng cùng tập lệnh (trừ `WebFetch`), nên sửa policy mà không sửa hook làm test đỏ.
- [x] **AC2.1** — Given `aip mode full` trong một project, Then `aip-gate.json` có `mode: "full"`, giữ nguyên các khóa khác và xử lý được file có BOM; chạy lại không đổi gì; `aip mode full -g` bị từ chối.
- [x] **AC2.2** — Given `.claude/settings.json` trùng byte với bản aip sinh, When `aip mode full`, Then file thành `{"permissions":{"deny":[],"ask":[]}}`; Given file khác bản aip sinh, Then không bị sửa và đầu ra liệt kê quy tắc của aip còn trong đó.
- [x] **AC2.3** — Given `aip mode ask`, Then khóa `mode` bị bỏ, các khóa khác giữ nguyên, và `settings.json` đang ở dạng `full` do aip sinh được sinh lại theo policy chuẩn (tôn trọng `allowEnvFiles`); `aip mode status` in đúng `mode` và tình trạng `settings.json`.
- [x] **AC2.4** — Given `parse()` của `cli/lib/args.mjs`, Then `mode full|ask|status` được đọc đúng (kiểm qua `parse()`), giá trị lạ bị từ chối với thông báo rõ, và không đổi hành vi các lệnh hiện có.
- [x] **AC3.1** — Given baseline và `AGENTS.md`, Then có bullet `Safety` về `full` như mô tả và `AGENTS.md` giữ byte-for-byte giống template.
- [x] **AC3.2** — Given `README.md` và `README_VI.md`, Then có mục chế độ quyền: hai chế độ, lệnh `aip mode`, điều kiện hiệu lực (cấu hình và phiên bypass), cảnh báo (project không bật được bypass, lệnh xóa đường dẫn quan trọng vẫn có thể hỏi, Windows native không có sandbox), kết quả kiểm thực tế kèm ngày và phiên bản, các điều chưa kiểm; dòng `[Unverified]` cũ về "hook `ask` trong bypass" được cập nhật theo kết quả; `CLAUDE.md` mô tả `mode` và `aip mode`.
- [x] **AC4.1** — Given repo sau thay đổi, Then `docs/specs/hooks-gates/spec.md` có yêu cầu mới cho chế độ `full` (hiệu lực, hành vi, `fullKeep`) và `docs/specs/cli-wizard/spec.md` có yêu cầu cho `aip mode`; `check-request.mjs` trên request này không có W10–W14.
- [x] **AC5.1** — `npm test` xanh; bump version `core` (và thành phần `versions.mjs --lock` buộc); `npm run pack:verify` xanh.

## Ảnh hưởng spec
- hooks-gates: thêm R6, thêm R7, thêm R8
- cli-wizard: thêm R4

## Thiết kế

### 1. Phát hiện chế độ hiệu lực (core)

Hàm thuần `effectiveMode(config, input)` trong `core/hooks/scripts/gate-config.mjs` (đã là nơi đọc `aip-gate.json`); ba hook `guard-*` gọi nó ngay đầu `decide`. Giá trị `fullKeep` đọc từ cùng cấu hình (mảng chuỗi, hiện chỉ nhận `"push"`; kiểu sai ⇒ mặc định). Hook vẫn fail-open và chỉ đọc.

### 2. Lệnh `aip mode`

`cli/lib/mode.mjs` (hàm thuần dựng nội dung mới của `aip-gate.json` và `settings.json`, tách khỏi I/O) và nối vào `cli/index.mjs`/`cli/lib/args.mjs`. Nhận biết "bản aip sinh" bằng cách so byte với `buildClaudePermissions(loadPolicy(), { allowEnvFiles })` của chính cấu hình hiện tại, không gắn khóa đánh dấu vào `settings.json` (tài liệu không nói rõ khóa lạ được xử lý thế nào).

### 3. Tài liệu và thử nghiệm

README EN/VI, `CLAUDE.md`, baseline `Safety`. Test: bảng tham số cho `effectiveMode`, test hook theo mẫu `91-guard-mcp`/`90-hooks`, test `aip mode` trên thư mục tạm (`fs.rmSync` để dọn), test `parse()`.

## Ngoài phạm vi và anti-goal

- Không nhốt bằng hệ điều hành (sandbox của Claude Code, container, VM): việc nhốt trong `root/*` ở trên là heuristic của hook cho file tool và một nhóm lệnh ghi/xóa, không bao được chương trình tự ghi file;
- Không cấu hình sandbox của Claude Code, không container/VM, không nhốt Bash trong project bằng hệ điều hành; không chế độ global `full`; không cấp bypass cho project (aip không bật được); không thay đổi quyền của Cursor/Codex/Antigravity.
- Anti-goal: một `full` bật nhầm ở cấp global hoặc thừa kế từ thư mục cha; `aip mode full` ghi đè `settings.json` đã chỉnh tay của người dùng.

## Ràng buộc

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; README EN/VI; hook fail-open và không ghi file.
- Dùng đúng giá trị `permission_mode` đã kiểm (`bypassPermissions`), không suy từ cờ khác.
- Nhánh `feature/p4e-permission-modes`, commit mỗi task qua `core:git-workflow`; không push.

## Kiểm thử

AC1.x: hook (đơn vị, bảng tham số) và CLI hook qua `execFileSync` với stdin có/không `permission_mode`; AC2.x: test `mode.mjs` và `aip mode` trên thư mục tạm, `parse()` trong `test/args.test.mjs`; AC3.1, AC3.2: pin theo đoạn neo, nhãn có tiền tố riêng của request; AC4.1: `check-request.mjs`; AC5.1: `npm test`, `pack:verify`.

## Để builder quyết

- Tên chính xác của hàm, vị trí file; định dạng đầu ra của `aip mode status`.
- Cách tách `fullKeep` thêm giá trị khác ngoài `push` nếu thật sự cần (hiện chỉ `push`).

## Rủi ro và câu hỏi mở

- [Unverified] `permission_mode` khi người dùng đổi chế độ giữa phiên (spike 2026-10-22 đã xác nhận trong subagent với hook khai trong settings); nếu thiếu thì rơi về `ask`.
- [Unverified] `ask` của hook trong bypass chỉ được kiểm ở chế độ `-p` (bị từ chối vì không có ai trả lời); chưa xác nhận hộp xác nhận hiện trong phiên tương tác.
- [Inference] Phiên không bypass trong project `full` mất các quy tắc `ask` của policy (xem Đánh đổi); chủ project có thể chạy `aip mode ask` để lấy lại.
- Hook chỉ có ở plugin mode (skills-mode không cài hook); chế độ `full` không có tác dụng với Cursor/Codex/Antigravity.
- [Inference] Heuristic nhốt trong `root/*` có thể chặn nhầm (đường dẫn cần ghi ngoài root hợp lệ → thêm vào `fullRoots`) và bỏ sót (lệnh qua `bash -c`, biến môi trường, symlink trỏ ra ngoài chưa được resolve; builder quyết có `realpath` hay không và ghi vào design).
- [Unverified] `scratchpad_dir` luôn có trong stdin của PreToolUse (đã thấy ở cả bốn phiên thử, kể cả plugin hook) nhưng chưa kiểm với subagent; thiếu thì chỉ còn gốc project và `fullRoots`.
- Ruling: symlink không được resolve (không dùng `realpath`); đường dẫn nằm trong root nhưng là symlink trỏ ra ngoài vẫn được coi là trong root.
- [Inference] `.claude/aip-gate.json` nằm trong các root nên một agent ở `full` có thể tự sửa `mode` hoặc `fullRoots`; không có rào bảo vệ riêng cho file này.
- Đường dẫn chứa `$`, `~` hoặc dấu backtick trong tên file làm file tool (`guard-files`) trả `ask` vì không phân tích được.
- [Inference] H6 của `guard-bash` bỏ sót wrapper và lệnh gián tiếp: `xargs`, `find -delete`, `dd`, `sed -i`, `ln`, `cp -t`, `bash -lc`, chuyển hướng nối chuỗi như `a>b>/tmp/x`.
- [Inference] Mẫu `ask` dự phòng ở phiên không bypass bỏ sót `kubectl -n x apply` và các wrapper `env`, `time`, `xargs`, `bash -c`.
- Đã xử lý (vòng sửa cuối): `aip mode` resolve cấu hình theo đúng thứ tự của hook (file worktree, rồi file repo chính), ghi vào file worktree bắt đầu từ các khóa của repo chính, và `status` in nguồn thật; file worktree che file repo chính từ lúc đó.
- [Inference] I4: `mode: "full"` nằm trong `.claude/aip-gate.json`, file repo có thể commit; mở repo clone đã commit file này trong phiên bypass làm `full` hiệu lực mà không chạy `aip mode` (code không kiểm file có được theo dõi bởi git). Đã chốt: chỉ ghi vào tài liệu; chủ project quyết định, phương án: từ chối `full` khi `aip-gate.json` là file được git theo dõi. Công tắc secret/env của `guard-files` cũng đọc từ repo của file đích.
- [Unverified] I5: khi `full` hiệu lực công cụ file hỏi khi Read/Grep ngoài root và deny khi ghi, gồm file của chính Claude Code ngoài project (cache plugin, file tràn kết quả tool ở `~/.claude/projects`; vị trí chính xác chưa kiểm). Đã chốt: chỉ ghi vào tài liệu; chủ project quyết định, phương án: thêm root chỉ-đọc cho thư mục của Claude Code; hiện thêm vào `fullRoots` nếu chạy không người canh bị từ chối (trong `claude -p`, `ask` nghĩa là bị từ chối).
- Đã chốt: `fullKeep` mặc định giữ hỏi push nhánh bảo vệ và force push; H5 giữ trong `full`.
