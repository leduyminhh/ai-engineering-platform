# Thiết kế: nhiều agent song song, mỗi agent một worktree (project P3)
- Ngày: 2026-10-22
- Trạng thái: **Đã duyệt và thực thi** — merge vào `master` = `480edd2` (2026-10-22).
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P3 (xu hướng 6)

## Vấn đề và lý do

Xu hướng 6 ("agent chạy nền, nhiều agent song song") là khoảng trống duy nhất chưa có project nào trong spec tổng. Hiện aip có đủ mảnh rời nhưng chưa có quy ước nối chúng:

- `writeScope` (khoá phạm vi ghi theo agent) và `guard-files` đã hoạt động, nhưng chưa có quy tắc "chia việc sao cho các agent không đụng cùng file".
- `gate-config.mjs` đã đọc `aip-gate.json` ở gốc worktree rồi gốc repo chính, nhưng chưa có test nào chứng minh hook chạy đúng trong worktree.
- Baseline chưa nói gì về tên nhánh/thư mục worktree, cách gộp, giới hạn đồng thời, cách dọn (rủi ro junction trên Windows).
- Runner P6b ở mốc M4 ("agent song song nhiều worktree") phụ thuộc P3 và cần một quy ước để theo.

Tra tài liệu chính thức của Claude Code ngày 2026-10-22 (nguồn thứ cấp: tổng hợp của subagent `claude-code-guide`, đã trích URL từng ý nhưng trang `sub-agents` bị cắt một phần nên chưa đọc hết) cho các ràng buộc sau:

- [Verified: https://code.claude.com/docs/en/worktrees] `claude --worktree <name>` tạo `.claude/worktrees/<name>/`, nhánh `worktree-<name>`, base mặc định là default branch (`worktree.baseRef`: `"fresh"` mặc định, hoặc `"head"`). Khi thoát phiên interactive: phiên không đặt tên và worktree sạch thì tự xoá; phiên có tên thì được hỏi trước; có thay đổi hoặc commit mới thì hỏi giữ hay xoá. `claude -p` không có bước thoát nên không tự dọn.
- [Verified: https://code.claude.com/docs/en/worktrees] Subagent với `isolation: worktree` dùng `.claude/worktrees/`, tự xoá khi không có thay đổi; lệnh Bash/PowerShell trỏ về main checkout bị chặn. `${CLAUDE_PROJECT_DIR}` vẫn trỏ về main checkout, còn `cwd` trong đầu vào hook là worktree.
- [Verified: https://code.claude.com/docs/en/worktrees] File gitignored (như `.env`) không có trong worktree trừ khi khai báo trong `.worktreeinclude` (cú pháp `.gitignore`; không xử lý khi dùng hook `WorktreeCreate`).
- [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại] (https://code.claude.com/docs/en/hooks) Hook `WorktreeCreate`/`WorktreeRemove` có tồn tại; hook PreToolUse trong settings và `hooks/hooks.json` của plugin chạy cả trong subagent (đầu vào có `agent_id`, `agent_type`). Hook ở frontmatter của agent plugin bị bỏ qua (nhất quán với design P4).
- [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại] (https://code.claude.com/docs/en/sub-agents) Mặc định tối đa 20 subagent đồng thời (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại] (https://code.claude.com/docs/en/agent-teams, /costs) Agent teams là experimental, tắt mặc định, chỉ interactive; khuyến nghị 3–5 teammate, dùng Sonnet; chi phí tăng đáng kể (trang costs nêu khoảng 7 lần cho teammate ở plan mode); traffic tính vào rate limit của tổ chức.
- [Unverified] `isolation: worktree` có áp dụng cho agent do plugin cung cấp không (tài liệu chỉ nói plugin agent bỏ qua `hooks`, `mcpServers`, `permissionMode`); tên nhánh và đường dẫn riêng của worktree subagent; `AgentDefinition.isolation` trong Agent SDK; khuyến nghị chính thức về PR theo từng agent; ràng buộc "một nhánh không checkout ở hai worktree" (đây là hành vi của git, [Inference] đúng nhưng chưa đối chiếu tài liệu Claude Code).

Hệ quả cho thiết kế: aip không cần chế cơ chế tạo worktree. Claude Code đã có (`--worktree`, `isolation`); phần còn thiếu là **quy ước, kiểm tra chia việc, và bằng chứng rằng hook của aip đúng trong worktree**.

## Quyết định đã chốt

Của người dùng (đã chốt trước, không bàn lại): Claude first, provider khác best-effort; aip chỉ chuẩn hóa và phân phối, không tự chạy agent, zero-dep; superpowers là quy trình chính, aip không sửa plugin superpowers; giữ router + supervisor, không làm swarm; fan-out/fan-in kiểu `Send` chỉ là ý tưởng tham khảo.

Của người dùng (2026-10-22, trả lời năm câu hỏi mở): (1) gộp qua **một PR cuối** từ nhánh tích hợp, không PR từng agent; (2) **làm** `check-partition.mjs` (chỉ cảnh báo); (3) trần 3 agent song song là thoải mái, hợp hạn mức; (4) "oke" cho đề xuất của design: chưa tạo spec sống `baseline` trong request này, chỉ thêm `hooks-gates/R4`, `R5` (đây là cách hiểu của tôi về lời "oke", người dùng chưa nói rõ hơn); (5) làm **từng bước một**, không chạy song song nhiều project.

**Đề xuất của tôi (đề xuất của agent, đã được người dùng duyệt 2026-10-22)** — các mục dưới do tôi tự đề xuất; các mục khớp (1)–(4) ở trên đã được người dùng xác nhận:
- **Phạm vi P3 = P3a + P3b, không có P3c.** P3a: quy ước + tài liệu (baseline, README). P3b: kiểm chia việc không chồng file (script chỉ cảnh báo) + test hook trong worktree. Không thêm lệnh `aip` mới, không sinh file cho provider khác (Cursor/Codex/Antigravity chỉ best-effort, không có tài liệu worktree nào được xác minh).
- **Một phiên chính điều phối (supervisor), mỗi agent làm một task trong worktree riêng.** Phiên chính chia task, giao, nhận kết quả, gộp. Không có agent nói chuyện ngang hàng với nhau (không swarm).
- **Quy ước nhánh/thư mục.** Nhánh tích hợp là `feature/<slug>` (đã là quy ước hiện có). Mỗi agent làm trên `worktree-<slug>-t<n>` (`<n>` = số task trong `plan.md`), tại `.claude/worktrees/<slug>-t<n>/` — tức dùng đúng mặc định của `claude --worktree <slug>-t<n>`, không đặt thư mục riêng. Nhánh task cắt từ **tip nhánh tích hợp** (`baseRef: "head"` khi chạy trong nhánh tích hợp), không từ default branch, để agent thấy các task đã gộp trước đó.
- **Chia việc.** Chỉ task độc lập mới chạy song song: không cần kết quả của nhau, **tập file ghi không giao nhau**, không cùng sửa một file sinh ra (`plugins/_versions.lock.json`, `build/`) hay cùng bump một `.manifest.json`. Bước chạm file chung (bump version, `versions.mjs --lock`, spec sống, README) làm **một lần ở phiên chính sau khi gộp**, không giao cho agent song song. Phân tích nằm ở `plan.md`: mỗi task đã có mục `**Files:**` theo template; thêm một dòng `**Song song:** <nhóm>` (nhóm cùng tên chạy cùng lúc) — [Inference] định dạng này cần builder đối chiếu với `plan.template.md` và skill `writing-plans` (aip không sửa superpowers, nên chỉ đọc, không bắt buộc).
- **Khoá phạm vi.** Với agent có `writeScope`, `guard-files` đã neo theo gốc git của file đích nên đúng trong worktree; với phiên chính hay agent không có `writeScope`, quy ước là *tập file của task* ghi trong `plan.md` (không có hook ép buộc; nêu rõ là soft guidance). Không thêm cờ ép buộc mới.
- **Gộp: một nhánh tích hợp, một PR cuối.** Phiên chính gộp từng nhánh task vào `feature/<slug>` bằng `merge --no-ff` cục bộ theo thứ tự task, chạy test của các thành phần chạm tới sau mỗi lần gộp, rồi con người duyệt **toàn bộ diff nhánh tích hợp** (đúng quy tắc Safety hiện có: 1 task = 1 commit, người duyệt cả nhánh trước khi merge/push). Không PR riêng cho từng agent — lý do: PR từng agent đẩy việc xử lý xung đột và thứ tự lên con người, trái mục tiêu giảm tắc nghẽn kiểm chứng (xu hướng 7); và baseline cấm push khi chưa xác nhận.
- **Xung đột khi gộp.** Xung đột văn bản ở file nằm ngoài tập khai báo = lỗi chia việc: phiên chính dừng, báo, không tự giải quyết ngầm (xung đột ngữ nghĩa thuộc tầng "logic subagent"/`opus` theo routing hiện có).
- **Giới hạn đồng thời.** Khuyến nghị baseline: tối đa **3 agent song song** (nằm trong khoảng 3–5 của tài liệu; thấp hơn trần 20 mặc định vì mỗi worktree tốn thêm context + build riêng). [Inference] Con số 3 là lựa chọn thận trọng của tôi, không phải số liệu chính thức.
- **Hook và `aip-gate.json` trong worktree.** Không đổi mã hook. Thêm **test chứng minh**: `readGateConfig` từ thư mục trong worktree lấy cấu hình ở gốc repo chính khi worktree chưa có file (tình huống thật: `.claude/aip-gate.json` thường bị gitignore nên không có trong worktree); `guard-files` neo `writeScope` theo gốc worktree. Đánh giá `gate-stop` theo transcript từng phiên nằm ngoài phạm vi (không AC nào cần). Không dùng `.worktreeinclude` cho `aip-gate.json` (đã có fallback gốc repo chính; sao chép tạo hai nguồn sự thật lệch nhau).
- **Dọn dẹp.** Dùng `git worktree remove <path>` hoặc công cụ dọn của app; **không** `rm -rf` thư mục worktree chứa junction từ Git Bash trên Windows (xoá xuyên vào nguồn); nếu phải xoá tay thì Node `fs.rmSync`. Chỉ xoá worktree đã gộp xong và không còn thay đổi; không dùng `--force`, không xoá nhánh task chưa gộp khi chưa hỏi người dùng. Phiên `claude -p` không tự dọn nên runner phải tự dọn.
- **Cách tạo worktree thuộc phiên chính, không thuộc agent plugin.** Không đặt `isolation: worktree` mặc định cho 16 agent hiện có vì [Unverified] chưa biết nó có hiệu lực với agent plugin; để M0 (spike) của P6b hoặc builder kiểm. Nếu hiệu lực, có thể bật theo agent ở bước sau.
- **Dogfood trong repo này.** Chính quy trình đang dùng (phiên lộ trình chạy worktree `.claude/worktrees/…`) là bản thử đầu. Phát hiện đã xử lý: `.gitignore` của repo chỉ chặn `.worktrees/`; dòng `.claude/worktrees/` nay đã được thêm vào `.gitignore`.
- **Quan hệ với runner P6b (M4).** M4 dùng đúng quy ước này (tên nhánh/thư mục, chia việc, gộp về nhánh tích hợp); runner tự tạo worktree bằng git, không cần hook `WorktreeCreate`. P3 không phụ thuộc P6b; P6b M4 phụ thuộc P3. Câu hỏi [Unverified] về `isolation: worktree` trong headless của P6 giữ ở M0, P3 không cần trả lời nó.
- **Dogfood spec sống P7.** Request này thêm hai yêu cầu vào `docs/specs/hooks-gates/spec.md` (hành vi hook trong worktree). Quy ước baseline và script chia việc chưa có spec sống (`baseline`, `artifact-templates` chưa tồn tại); theo quy tắc P7 spec tạo khi request chạm tới, nhưng request này chỉ *thêm mục baseline*, không đổi hành vi có kiểm — tôi để hai năng lực đó cho request sau. Người dùng đã đồng ý để spec `baseline` cho request sau (cách hiểu của tôi về "oke").

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given baseline `core/agents/AGENTS.template.md`, Then có mục `Parallel agents` (tiếng Anh, ngắn) nêu: tên nhánh `worktree-<slug>-t<n>` và thư mục `.claude/worktrees/`, tập file ghi không giao nhau, bước chạm file chung làm một lần ở phiên chính, gộp `merge --no-ff` về nhánh tích hợp rồi người duyệt cả nhánh, tối đa 3 agent song song, không `rm -rf` worktree có junction; `AGENTS.md` giữ byte-for-byte giống template.
- [x] **AC1.2** — Given `README.md` và `README_VI.md`, Then có mục "Parallel agents" / "Agent song song" gồm công thức từng bước (tạo worktree, giao task, gộp, dọn), bảng điều đã [Verified]/[Unverified] ở mục trên, và nói rõ aip không tự chạy agent; `CLAUDE.md` nhắc quy ước và script chia việc.
- [x] **AC2.1** — Given một `plan.md` có hai task cùng nhóm `**Song song:** A` mà `**Files:**` giao nhau, When chạy `check-partition.mjs` trên thư mục request, Then in cảnh báo `P1` nêu hai task và file trùng; không giao nhau thì không cảnh báo; vẫn chỉ cảnh báo, `--strict` mới exit 1.
- [x] **AC2.2** — Given task nhóm song song ghi file chung bị cấm (`plugins/_versions.lock.json`, `*/.manifest.json`, `docs/specs/**`, `README*.md`), Then cảnh báo `P2` (các file này làm ở phiên chính sau gộp).
- [x] **AC2.3** — Given `plan.md` không có dòng `**Song song:**` hoặc thiếu `**Files:**`, Then không cảnh báo và exit 0 (tính năng chọn tham gia, không phá request cũ).
- [x] **AC3.1** — Given một worktree thật tạo bằng `git worktree add` và `.claude/aip-gate.json` chỉ có ở repo chính, When gọi `readGateConfig` từ thư mục trong worktree, Then trả cấu hình của repo chính; khi worktree có file riêng, Then dùng file của worktree.
- [x] **AC3.2** — Given agent có `writeScope` và đường dẫn đích nằm trong một worktree, When `guard-files` quyết định, Then phạm vi neo theo gốc git của worktree (ghi trong scope được, ngoài scope bị `deny`).
- [x] **AC4.1** — Given repo sau thay đổi, Then `docs/specs/hooks-gates/spec.md` có `hooks-gates/R4` (đọc `aip-gate.json` trong worktree) và `R5` (neo `writeScope` theo gốc worktree); `check-request.mjs` trên request này không có W10–W14.
- [x] **AC5.1** — `npm test` xanh; bump version `core` (và thành phần `versions.mjs --lock` buộc phải bump); `node cli/lib/versions.mjs --lock` cập nhật; `npm run pack:verify` xanh. AC cổng: bằng chứng là `npm test` và `npm run pack:verify`, không có test riêng (script mới nằm trong `core/` nên đi theo gói npm).

## Ảnh hưởng spec
- hooks-gates: thêm R4, thêm R5

## Thiết kế

### 1. Quy ước (baseline + README)

Mục baseline ngắn gồm sáu quy tắc: chia việc theo tập file, tên nhánh/thư mục, task song song không chạm file chung, gộp về nhánh tích hợp, trần 3 agent, cách dọn. README EN/VI giữ công thức đầy đủ và bảng [Verified]/[Unverified] ở trên (chép kèm URL), nêu rõ "aip không tự chạy agent" và "quy tắc khoá phạm vi chỉ do hook ép với agent có `writeScope`".

### 2. `check-partition.mjs`

Script zero-dep đặt cạnh `check-request.mjs` trong `core/skills/artifact-templates/scripts/` (cùng khuôn: `<thư-mục> [--strict]`, chỉ cảnh báo, exit 2 khi sai đối số). Đọc `plan.md`, tách task theo heading, lấy `**Song song:** <nhóm>` và các dòng trong `**Files:**`, quy glob đơn giản về tiền tố thư mục để so giao; cảnh báo P1 (giao nhau) và P2 (file chung bị cấm). Không đọc git. Tên mã cảnh báo `P1`, `P2` để không lẫn `W1–W14`.

### 3. Test hook trong worktree

Một mục trong `test/contract/90-hooks.contract.mjs` (hoặc module mới cạnh nó) dựng repo tạm bằng `git init` + `git worktree add` trong thư mục tạm của test, kiểm AC3.1 và AC3.2. Dọn bằng Node `fs.rmSync` (không `rm -rf`).

### 4. Spec sống

Thêm hai yêu cầu vào `hooks-gates/spec.md` theo template, kèm dòng lịch sử.

## Ngoài phạm vi và anti-goal

- Không tạo cơ chế tự chạy agent, không `aip worktree …`, không sửa plugin superpowers, không sinh quyền/worktree cho Cursor/Codex/Antigravity, không bật `isolation: worktree` cho agent hiện có, không dùng agent teams (experimental), không đổi mã `guard-*`/`gate-*`/`gate-config`.
- Không backfill spec `baseline`/`artifact-templates`.
- Anti-goal: một "swarm" agent ngang hàng; tự động gộp không qua người duyệt; PR từng agent đẩy việc chia/gộp lên con người; quy ước cứng đến mức task nhỏ cũng phải mở worktree (song song là tuỳ chọn, tuần tự vẫn là mặc định).

## Ràng buộc

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment tiếng Việt chỉ nêu *vì sao*; baseline tiếng Anh; README EN/VI.
- Bump `core`; chạy `node cli/lib/versions.mjs --lock`; gói npm vẫn chỉ ship core (`pack:verify`).
- Nhánh `feature/p3-parallel-agents`, commit mỗi task qua `core:git-workflow`; không push.
- Trên Windows không `rm -rf` thư mục có junction từ Git Bash (kể cả trong test).

## Kiểm thử

- AC1.1, AC1.2: pin trong `test/content/` (neo theo mục) + kiểm đọc README; `AGENTS.md` byte-for-byte đã có test hiện hành.
- AC2.x: test đơn vị tham số hóa cho `check-partition.mjs` (bảng plan × kết quả).
- AC3.x: contract hook với worktree git thật trong thư mục tạm.
- AC4.1: `check-request.mjs docs/requests/2026-10-22-parallel-agents` không W10–W14 và đọc spec. AC5.1: `npm test`, `pack:verify`.

## Để builder quyết

- Định dạng chính xác của `**Song song:**` và cách tách task trong `plan.md` (đối chiếu `plan.template.md` và đầu ra thật của `superpowers:writing-plans`); cách quy glob về tiền tố.
- Tên và vị trí test; có nâng `check-partition` thành phần của `check-request.mjs` hay giữ script riêng (đề xuất: riêng).
- Có thêm `.claude/worktrees/` vào `.gitignore` của repo hay không, sau khi kiểm `git status` thực tế.
- Đối chiếu lại trang `sub-agents`/`worktrees` (phần bị cắt) trước khi ghi bảng [Verified] vào README.

## Rủi ro và câu hỏi mở

- [Unverified] `isolation: worktree` với agent plugin và trong headless/SDK; tên nhánh worktree của subagent; ràng buộc một-nhánh-một-worktree trong tài liệu Claude Code.
- [Inference] `.claude/aip-gate.json` thường gitignore nên không có trong worktree; fallback gốc repo chính (code `gate-config.mjs`) che được, nhưng chỉ khi `--git-common-dir` trỏ đúng repo chính (worktree tạo bằng `git worktree`); worktree của clone riêng không dùng được fallback.
- [Inference] Nhiều agent song song làm tăng chi phí và rate limit theo số phiên; baseline chỉ khuyến nghị trần 3, không ép; P5c (theo dõi chi phí) có ích hơn khi P3 dùng nhiều.
- [Inference] Soft guidance không ngăn agent không có `writeScope` ghi ngoài tập file; chỉ `writeScope` + `guard-files` ép buộc, và Bash vẫn ghi được ở nơi khác (đã nêu ở CLAUDE.md).
- Còn mở: thứ tự sau P3 đã chốt là làm từng bước một; việc chọn P5c, P4c hay P6 làm tiếp quyết định sau khi P3 xong.
