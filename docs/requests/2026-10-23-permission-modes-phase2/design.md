# Thiết kế: chế độ quyền giai đoạn 2 — chặn `full` từ file được git theo dõi, vá minor, root chỉ-đọc (project P4e-2)
- Ngày: 2026-10-23
- Trạng thái: đã duyệt 2026-10-23 (cả phép đo I5: nhánh A)
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: tiếp nối [P4e](../2026-10-22-permission-modes/design.md) (đã merge master c149703, chưa push)

## Vấn đề và lý do

Review P4e để lại ba nhóm việc, xử lý tuần tự vì cùng chạm `gate-config.mjs`, `guard-bash.mjs`, `guard-files.mjs`, `cli/lib/mode.mjs`:

1. **I4 (bảo mật).** `mode: "full"` đọc từ `.claude/aip-gate.json`, file mà repo có thể commit. Người dùng chạy phiên `bypassPermissions` trong một repo clone đã commit file này thì `full` hiệu lực mà không ai chạy `aip mode`: kẻ viết repo tự mở xóa, secret, mạng. Điều kiện bypass do người dùng bật, nhưng quyết định "project này đáng tin" lại do chính repo (không đáng tin) đưa ra.
2. **Minor.** Ba lỗi đã có bằng chứng (N2 wrapper `nice`/`env -S`/`sudo -u`, N3 đường dẫn `/e/x` của công cụ PowerShell, N4 JSON hỏng trong `aip-gate.json` của worktree mà hook và `aip mode` xử lý khác nhau) cộng một danh sách minor hoãn.
3. **I5.** Ở `full`, công cụ file hỏi khi Read/Grep và chặn khi ghi ngoài root, kể cả file của chính Claude Code ngoài project (file tràn kết quả tool, file plugin). Trong `claude -p` `ask` nghĩa là bị từ chối nên chạy không người canh bị kẹt. Vị trí chính xác là `[Unverified]`, cần một phép đo trước khi viết code.

## Quyết định (ruling) và chi phí nếu sai

Tất cả là đề xuất của tôi, chờ duyệt cùng design.

### I4

- **R-I4.1: `full` chỉ hiệu lực khi file cấu hình đang cho kết quả KHÔNG được git theo dõi.** Kiểm bằng một lệnh `git -C <gốc nơi file nằm> ls-files --error-unmatch -- .claude/aip-gate.json`: exit 0 = được theo dõi ⇒ `ask`; exit 1 = không theo dõi ⇒ `full` được phép; mọi kết quả khác (không có git, timeout, exit 128, lỗi spawn) ⇒ `ask` (không xác định được ⇒ không cấp quyền rộng). Chi phí nếu sai: một team commit `aip-gate.json` cho `mcpAllow`/`mcpDeny` và muốn `full` trong cùng file sẽ thấy `full` không chạy. Cách tự sửa rõ ràng (gỡ file khỏi index hoặc bỏ `mode`); `aip mode status` nói thẳng lý do. Phương án thay thế (file `aip-gate.local.json` không bao giờ commit) để việc sau, không làm ở đây.
- **R-I4.2: thứ tự kiểm rẻ trước.** Chỉ gọi git khi `permission_mode === "bypassPermissions"` **và** `config.mode === "full"`. Phiên thường, project `ask` không tốn thêm lần spawn git nào. Trong một lần chạy hook kết quả được nhớ (một lệnh git cho mọi lần `full()` của cùng file). `effectiveMode(config, input)` giữ nguyên là hàm thuần (bảng tham số AC1.1 của P4e không đổi); phần kiểm git nằm ở lớp trên nó.
- **R-I4.3: file nào được kiểm.** File thật sự cung cấp cấu hình: `resolveGate` trả thêm `file` (gốc worktree nếu file worktree hợp lệ, ngược lại gốc repo chính) và kiểm theo gốc chứa file đó. Cấu hình tiêm vào `decide({config})` (chỉ test) coi là đáng tin vì đường production không bao giờ tiêm.
- **R-I4.4: nhánh `ask` dự phòng của phiên không bypass không bị ảnh hưởng.** Project có `mode: "full"` được theo dõi bởi git, phiên thường: hook vẫn hỏi `git push`/`curl`/…, vì hỏi thừa là hướng an toàn; không kiểm git ở nhánh này. Chi phí nếu sai: một câu hỏi thừa.
- **R-I4.5: `aip mode full` không sửa `.gitignore`.** `.gitignore` là nội dung repo hướng ra ngoài; thay vào đó lệnh (a) khi file được theo dõi: cảnh báo `full` sẽ bị bỏ qua, in `git rm --cached .claude/aip-gate.json` và dòng `.claude/aip-gate.json`; (b) khi chưa theo dõi nhưng chưa bị ignore (`git check-ignore -q`): cảnh báo dễ commit nhầm và in dòng gitignore cần thêm; (c) khi chưa theo dõi và đã ignore: im lặng. Vẫn ghi `mode: "full"` và exit 0 ở mọi nhánh (chủ project có thể tháo theo dõi sau). `aip mode status` in thêm dòng `git: được theo dõi ⇒ full bị bỏ qua` / `không theo dõi` / `không xác định`. Chi phí nếu sai: người dùng muốn tự động hóa ghi `.gitignore`; thêm sau rất rẻ.
- **R-I4.6: baseline `Safety` không đổi.** Bullet hiện có nói `full` là chủ project opt-in; điều kiện "file không bị theo dõi" là chi tiết thực thi, nằm ở README, spec và cảnh báo của lệnh. Vì vậy `AGENTS.md` không đổi. Chi phí nếu sai: thiếu một câu ở baseline; sửa rẻ nhưng buộc chép byte-for-byte.
- **Biên cần ghi:** worktree (kiểm theo file thật được dùng); file tracked nhưng đã sửa cục bộ vẫn là tracked; `skip-worktree`/`assume-unchanged` vẫn là tracked; `.gitignore` không gỡ theo dõi file đã có trong index; ngoài repo git thì `resolveGate` đã trả `null` nên không có cấu hình.

### Minor

- **R-N2: phủ thay vì thu hẹp README.** `cmdIndex` hiểu `nice -n5`, `nice --10`, `nice --adjustment 5`, `env -S "<chuỗi>"`/`--split-string` (tách chuỗi thành token rồi chạy tiếp như lệnh) và các tùy chọn có giá trị của `sudo` (`-u`/`--user`, `-g`, `-h`, `-p`, `-C`, `-r`, `-t`, `-U`, `-D`, `-R`, `-T`). Dùng chung cho H6 và danh sách `ask` của phiên không bypass. Chi phí nếu sai: còn kiểu cú pháp lạ khác lọt; README vẫn ghi danh sách "không phát hiện".
- **R-N3: PowerShell không đổi `/e/x`.** Công cụ PowerShell giải `/e/x` theo ổ hiện tại (`E:\e\x`), không phải Git Bash `E:/x`; hook không áp `normalizeMsysPath` cho `tool_name === "PowerShell"` (cả `cd`, đích ghi, đường dẫn secret, `-C` của git). Chỉ có nghĩa trên win32. Chi phí nếu sai: PowerShell kiểu Git Bash hiếm gặp bị coi sai ổ (hướng chặn thêm, không bỏ sót).
- **R-N4: file `aip-gate.json` của worktree tồn tại nhưng hỏng thì che file repo chính, cấu hình là `null` (không rơi về repo chính).** "Hỏng" gồm JSON sai cú pháp và giá trị không phải đối tượng. Hook và `aip mode` cùng coi file đó là cấu hình hiện hành; `aip mode` vẫn báo lỗi để người dùng sửa, hook fail-open như mọi lỗi cấu hình (không `full`, không `mcpAllow`/`mcpDeny` của repo chính cho tới khi sửa). Chọn hướng này vì rơi về repo chính có thể bật `full` hoặc `mcpDeny` từ một file mà chủ worktree đã cố ý che. Chi phí nếu sai: `mcpDeny` của repo chính tạm không áp trong worktree có file hỏng (cùng mức fail-open đã chấp nhận cho file hỏng ở repo chính).
- **Minor hoãn đã xử lý (rẻ, cùng file):** `chmod -x /etc/x` không còn rơi mất đích (mode dạng `-x`/`+x`/`u-x` được nhận là mode); `bash -lc "rm /x"` và `-ic`… được nhận như `-c`; chuyển hướng nối chuỗi `a>b>/tmp/x` tách đủ mọi `>`; `kubectl -n x apply`, `helm -n x upgrade` và cờ có giá trị toàn cục khớp danh sách `ask`; `aip mode` in lỗi ra stderr; `settings.json` là thư mục báo lỗi rõ thay vì ném EISDIR; bỏ `bypass &&` thừa trước `full()`.
- **Minor vẫn hoãn (ghi vào README/design, không làm):** tách `;` trong nháy/heredoc của `naiveSegments` gây deny nhầm. Lý do: union hai cách tách là chủ ý để nháy lẻ không che lệnh; sai theo hướng an toàn; sửa cần parser heredoc. Chi phí: thỉnh thoảng deny nhầm, người dùng thêm `fullRoots` hoặc viết lại lệnh.

### I5 (cổng bằng phép đo)

- **R-I5.1: root chỉ-đọc.** Khóa mới `fullReadRoots` (mảng đường dẫn tuyệt đối, mặc định rỗng) cộng các mặc định được chốt sau phép đo. Trong `full`: Read/Grep dưới root chỉ-đọc ⇒ không quyết định; Write/Edit/MultiEdit/NotebookEdit dưới đó vẫn `deny`; `guard-bash` H6 coi chúng là ngoài root cho lệnh ghi/xóa (không bao giờ ghi). Nhắc secret (H3 trong `full`) áp như cũ.
- **R-I5.2: phép đo `claude -p` (cần người dùng đồng ý, trần `--max-budget-usd 0.2`, khoảng 0,12–0,2 USD).** Hook khai bằng `--settings` chỉ ghi `tool_name` và các khóa đường dẫn (`file_path`, `path`, `notebook_path`) vào file ngoài repo, không ghi nội dung. Prompt yêu cầu: (a) chạy một lệnh Bash in đủ lớn để Claude Code lưu kết quả tràn ra file rồi Read đúng đường dẫn đó; (b) gọi một skill của plugin đã cài và Read một file được skill tham chiếu. Ghi vào design: các thư mục thực tế được đọc, phiên bản Claude Code, chi phí. Chưa chạy; kết quả quyết định mặc định của R-I5.1.
- **Nhánh A (người dùng đồng ý phép đo):** chốt mặc định root chỉ-đọc theo kết quả đo, cài đặt AC3.1–AC3.3.
- **Nhánh B (người dùng từ chối):** không viết mã I5; chỉ ghi tài liệu hướng dẫn thêm các thư mục đó vào `fullRoots` (cho phép ghi) và nói rõ rủi ro; AC3.x bỏ. Chi phí nếu chọn B: chạy không người canh có thể bị từ chối Read ngoài root cho tới khi chủ project tự thêm `fullRoots` (rộng hơn mức cần: cho cả ghi).

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `mode: "full"`, phiên `bypassPermissions` và `aip-gate.json` được git theo dõi (repo git tạm thật, không tiêm cấu hình), When `guard-bash`, `guard-files`, `guard-mcp` quyết định, Then cả ba chạy như `ask`: `cat .env` bị hỏi, Write `.env` bị chặn, Write ngoài root không bị H6 chặn (H6 tắt), tool MCP ngoài `mcpAllow` bị chặn.
- [ ] **AC1.2** — Given cùng cấu hình nhưng file chưa được theo dõi (có hoặc không bị gitignore), Then `full` hiệu lực như P4e (lệnh `rm -rf x` không quyết định, `rm /etc/x` `deny`).
- [ ] **AC1.3** — Given phiên không bypass, hoặc `mode` thiếu/`ask`, When hook chạy, Then không có lần spawn `git ls-files` nào (kiểm qua seam đếm lời gọi); khi bypass và `mode: "full"` thì đúng một lần cho mỗi file cấu hình trong một lần `decide`.
- [ ] **AC1.4** — Given git không chạy được hoặc trả kết quả khác exit 0/1 (seam `tracked` trả `unknown`, cộng một ca thật với `PATH` không có git), Then `full` không hiệu lực.
- [ ] **AC1.5** — Given worktree, Then file được kiểm là file thực sự cấp cấu hình: file của worktree được theo dõi ⇒ `ask` dù file repo chính không được theo dõi; chỉ có file của repo chính (file worktree không tồn tại) và nó được theo dõi ⇒ `ask`; không được theo dõi ⇒ `full`.
- [ ] **AC1.6** — Given project có `mode: "full"` được theo dõi và phiên không bypass, When `guard-bash` nhận `git push origin feature/x`, Then vẫn `ask` (nhánh dự phòng của P4e AC1.8 không bị ảnh hưởng).
- [ ] **AC1.7** — Given `aip mode full` trong repo git tạm, Then: file được theo dõi ⇒ đầu ra có cảnh báo `full` bị bỏ qua cùng `git rm --cached .claude/aip-gate.json`; file chưa theo dõi và chưa gitignore ⇒ cảnh báo kèm dòng gitignore cần thêm; chưa theo dõi và đã gitignore ⇒ không cảnh báo git; `.gitignore` không bao giờ bị sửa; `aip mode status` in trạng thái git (được theo dõi ⇒ full bị bỏ qua / không theo dõi / không xác định).
- [ ] **AC2.1** — Given `full` hiệu lực, When `guard-bash` nhận `nice -n5 rm /etc/x`, `nice --10 rm /etc/x`, `env -S "rm /etc/x"`, `sudo -u root rm /etc/x`, `sudo -E rm /etc/x` ⇒ `deny`; cùng dạng với đích trong root ⇒ không quyết định; Given project `full` phiên không bypass, `nice -n5 curl x`, `sudo -u root curl x`, `env -S "curl x"` ⇒ `ask`.
- [ ] **AC2.2** — Given win32 và `full` hiệu lực với root `E:\proj` và cwd trong root, When công cụ PowerShell nhận `Remove-Item /e/proj/a`, Then giải theo ổ hiện tại `E:\e\proj\a` (ngoài root ⇒ `deny`), trong khi công cụ Bash nhận `rm /e/proj/a` giải thành `E:/proj/a` (trong root ⇒ không quyết định); trên nền khác `normalizeMsysPath` không đổi gì (test hàm với tham số `platform`).
- [ ] **AC2.3** — Given worktree có `aip-gate.json` không phải JSON hợp lệ (hoặc không phải đối tượng) và repo chính có file hợp lệ `mode: "full"`, Then `resolveGate` trả `config: null` với nguồn `worktree-invalid` (không rơi về repo chính), hook chạy như không có cấu hình, và `aip mode status|full|ask` báo lỗi (stderr, exit 1) và không ghi file nào.
- [ ] **AC2.4** — Given `full` hiệu lực, `chmod -x /etc/x` ⇒ `deny`, `chmod +x run.sh` (trong root) ⇒ không quyết định; `bash -lc "rm /x"` ⇒ `ask`; `echo a>b>/tmp/x` ⇒ `deny`; Given project `full` phiên không bypass, `kubectl -n x apply -f y` và `helm -n x upgrade r c` ⇒ `ask`.
- [ ] **AC2.5** — Given `.claude/settings.json` là một thư mục, When `aip mode status|full|ask`, Then thông báo lỗi rõ trên stderr và exit 1 (không ném); lỗi JSON của `aip mode` đi ra stderr.
- [ ] **AC3.1** *(nhánh A)* — Given `full` hiệu lực và `fullReadRoots: ["<dir>"]`, When Read/Grep vào đường dẫn dưới `<dir>`, Then không có quyết định; Write/Edit/MultiEdit/NotebookEdit dưới `<dir>` ⇒ `deny`; `guard-bash` `rm <dir>/x` ⇒ `deny`; `fullReadRoots` sai kiểu bị bỏ.
- [ ] **AC3.2** *(nhánh A)* — Given phép đo đã chạy, Then design này ghi các thư mục thực tế (đường dẫn tổng quát, không nội dung), phiên bản Claude Code, chi phí, và mặc định root chỉ-đọc khớp kết quả đo (có test cho mặc định, tính cả `CLAUDE_CONFIG_DIR` nếu đo cho thấy cần).
- [ ] **AC3.3** *(nhánh B, thay AC3.1–3.2)* — Given người dùng từ chối phép đo, Then không có mã I5; README EN/VI ghi cách thêm thư mục của Claude Code vào `fullRoots`, rủi ro ghi rộng hơn mức cần và vị trí `[Unverified]`.
- [ ] **AC4.1** — Given `README.md` và `README_VI.md`, Then mục chế độ quyền có: điều kiện thứ ba "file không được git theo dõi" kèm cách xử lý (gỡ khỏi index, gitignore), các wrapper nay được phủ và danh sách vẫn không phát hiện, `PowerShell` không đổi `/e/x`, hành vi worktree + JSON hỏng, minor hoãn còn lại, kết quả phép đo hoặc hướng dẫn `fullRoots`; đoạn rủi ro I4 cũ được thay bằng quy tắc mới; `CLAUDE.md` nhắc điều kiện theo dõi git; pin theo đoạn neo, nhãn tiền tố `P4e2`.
- [ ] **AC4.2** — Given repo sau thay đổi, Then `docs/specs/hooks-gates/spec.md` đổi R6 (thêm điều kiện không được theo dõi), đổi R7 (wrapper, PowerShell), thêm R9 (cấu hình hỏng của worktree che repo chính), thêm R10 (root chỉ-đọc, nhánh A) và `docs/specs/cli-wizard/spec.md` đổi R4 (cảnh báo/trạng thái git, stderr); `AGENTS.md` không đổi; `check-request.mjs` (kể cả `--base master`) không có W10–W14.
- [ ] **AC5.1** — `npm test` và `npm run pack:verify` xanh; bump version `core` một lần ở task cuối (backend/frontend chỉ khi `versions.mjs --lock` buộc).

## Ảnh hưởng spec
- hooks-gates: đổi R6, đổi R7, thêm R9, thêm R10
- cli-wizard: đổi R4

## Thiết kế

### 1. Lớp tin cậy cho `full` (gate-config)

`resolveGate` thêm `file` (đường dẫn file cấu hình đã dùng) và `invalid` (file worktree tồn tại nhưng hỏng ⇒ `config: null`, `source: 'worktree-invalid'`). Hàm mới `fullEffective(gate, input, { tracked })`: (1) `permission_mode` bypass, (2) `effectiveMode(gate.config, input) === 'full'`, (3) nếu `gate.file` có thì `gateTracked(gate.file) === false`; `tracked` là seam cho test (mặc định chạy `git ls-files --error-unmatch`, kết quả nhớ theo đường dẫn trong một tiến trình). Ba hook gọi `fullEffective` thay cho gọi `effectiveMode` trực tiếp. `effectiveMode` và bảng AC1.1 của P4e giữ nguyên.

### 2. Wrapper, PowerShell, minor (guard-bash)

`cmdIndex` mở rộng cho `nice`, `env -S`, `sudo`; `env -S` được tách thành token ở bước chuẩn hóa đoạn. `normalizeMsysPath` được truyền theo công cụ (không áp cho PowerShell). Các minor còn lại là vá cục bộ trong `confineSegment`/`matchesAsk`.

### 3. `aip mode`

Thêm dòng/cảnh báo git (R-I4.5) bằng `git ls-files` và `git check-ignore` (zero-dep, `execFileSync`); lỗi ra stderr; lỗi EISDIR có thông báo; `locateGate` dùng cùng quy tắc "worktree hỏng che repo chính" với hook.

### 4. Root chỉ-đọc (nhánh A) hoặc tài liệu (nhánh B)

`guard-files.confine`: Read/Grep dưới `fullReadRoots` (+ mặc định đã đo) ⇒ không quyết định; ghi ⇒ `deny` như cũ. `guard-bash` không đổi cho ghi.

## Ngoài phạm vi và anti-goal

- Không file cấu hình cục bộ không-commit, không tự ghi `.gitignore`, không đổi baseline.
- Không sandbox hệ điều hành; không resolve symlink (ruling P4e giữ).
- Không chạy lại phép đo Linux/macOS; không kiểm hộp xác nhận tương tác của `ask` dưới bypass; `permission_mode` sau khi đổi chế độ giữa phiên; hook plugin trong subagent; `scratchpad_dir` trong subagent; `claude plugin validate --strict` (vẫn `[Unverified]`).
- Anti-goal: một `full` kích hoạt từ file repo không đáng tin; lệnh `aip mode` sửa file repo ngoài `.claude/`.

## Ràng buộc

- Zero-dep; UTF-8 không BOM, LF; README EN/VI; hook fail-open, chỉ đọc, không ghi file; kiểm rẻ trước (không spawn git cho phiên thường).
- Tên test mang tiền tố `P4e2 ACx.y:`; test CLI trong thư mục tạm dọn bằng `fs.rmSync` (không `rm -rf` thư mục có junction trên Windows).
- Bump version một lần ở task cuối, để `node cli/lib/versions.mjs --lock` quyết, không sửa tay lock.
- Khẳng định về Claude Code chưa đối chiếu giữ `[Unverified]` kèm link; không in bí mật vào báo cáo; không chạy `claude -p` khi chưa được người dùng cho phép.

## Kiểm thử

Hook: test `decide` với `tracked` seam và repo git tạm thật (một ca end-to-end qua `execFileSync` CLI hook); `aip mode`: thư mục tạm với `git init`; pin README/spec theo đoạn neo; AC4.2 bằng `check-request.mjs`.

## Để builder quyết

- Hình dạng chính xác của seam `tracked` và cách đếm lời gọi git trong test; cách truyền cờ "không đổi msys" (tham số hay trạng thái cục bộ trong `decide`).
- Định dạng dòng `git:` của `aip mode status`.

## Rủi ro và câu hỏi mở

- [Inference] Chặn `full` theo "file được theo dõi" chỉ chặn đường mở repo clone đã commit file; nó không cản người dùng tự chạy `aip mode full` hay tự sao chép một file cấu hình không bị theo dõi từ nguồn lạ. Người dùng vẫn nên xem `.claude/` của repo lạ trước khi chạy bypass.
- [Inference] Một agent ở `full` có thể `git add -f` rồi chính nó làm `full` bị bỏ qua (an toàn hơn) hoặc sửa `mode` (đã nêu ở P4e; không có rào riêng).
- [Unverified] Vị trí tệp tràn kết quả tool và tệp plugin (I5) tới khi có phép đo hoặc người dùng từ chối.
- Tất cả `[Unverified]` của P4e về Claude Code (hộp xác nhận tương tác, đổi chế độ giữa phiên, hook plugin trong subagent, `scratchpad_dir` trong subagent) vẫn mở.
