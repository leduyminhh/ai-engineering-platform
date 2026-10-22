# Thiết kế: chạy agent không người canh — công thức CI và runner (project P6)
- Ngày: 2026-10-21
- Trạng thái: đã duyệt 2026-10-22 (người dùng duyệt design P6 và giao phiên điều phối chạy P6a; P6b chỉ là thiết kế sơ bộ, không hiện thực)
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P6 (xu hướng 6, 7, 8)

## Vấn đề và lý do

Quyết định đã chốt (2026-10-20): aip chỉ chuẩn hóa và phân phối, không tự chạy agent; việc chạy tự động (CI, lịch, nền) nằm ở runner ở repo riêng, viết bằng Python, dùng LangGraph điều phối và mỗi node là một phiên Claude Code. Tiền đề đã có: `graph.json` máy đọc được cho 4 workflow (P2b), chính sách quyền, hook `guard-mcp` và công thức CI an toàn (P4).

Tra tài liệu chính thức của Claude Code ngày 2026-10-21 (qua subagent `claude-code-guide`, chưa đối chiếu từng trang) đổi một điểm của kế hoạch: `anthropics/claude-code-action` đã hỗ trợ sẵn các trigger `pull_request`, `issue_comment`, `schedule`, nạp được plugin (`plugins`, `plugin_marketplaces`), gọi skill dạng `/plugin:skill` qua `prompt`, và nhận `claude_args` (`--max-turns`, `--allowedTools`, …). Nghĩa là mốc đầu của runner ("một sự kiện → một agent chỉ đọc, ví dụ PR mở thì reviewer chạy") **không cần runner tự viết**. Runner chỉ cần khi có luồng nhiều bước có trạng thái, cổng người duyệt kéo dài theo thời gian và quay lại bước trước (đúng cái `graph.json` mô tả).

## Quyết định đã chốt

Duyệt 2026-10-22: người dùng đã duyệt design P6; P6a làm ngay trong repo này; P6b (runner `aip-runner`, repo riêng) chỉ là thiết kế sơ bộ, KHÔNG hiện thực; hai câu hỏi mở giữ đề xuất của design (xem cuối tài liệu).

Của người dùng (2026-10-21): "bỏ qua câu hỏi và để tôi tự đề xuất" cho thiết kế P6. Phần dưới là đề xuất của tôi, chưa ai duyệt; giữ nguyên các quyết định cũ: aip zero-dep và không chạy agent, runner ở repo riêng, Claude first, LangGraph điều phối (cách B).

Đề xuất của tôi:
- **Tách P6 làm hai.** **P6a (làm trong repo này, nhỏ):** file ví dụ `templates/ci/claude-review.example.yml` cho GitHub Actions + mục README EN/VI, dựa trên công thức của P4. **P6b (repo riêng `aip-runner`, thiết kế ở đây, chưa hiện thực):** runner LangGraph chạy `graph.json`.
- **P6a không được `aip init` sao chép.** `templates/ci/` được ship trong gói npm (đã nằm trong allowlist `templates/`) nhưng `aip init` chỉ đọc `templates/init` và `templates/init-minimal`; người dùng tự chép file. Lý do: workflow CI chạy được trên tài khoản của người dùng nên không tự ghi vào project (cùng nguyên tắc P4).
- **P6a là bước chỉ đọc:** trigger `pull_request` (không phải `pull_request_target`), quyền `contents: read` và `pull-requests: read`, đầu ra là job summary hoặc artifact, không đăng bình luận lên PR (đăng bình luận là hành động hướng ra ngoài, để sau cổng người duyệt). Action và mọi action bên thứ ba ghim theo commit SHA (ghi chỗ giữ `<full-40-char-commit-sha>` để người dùng điền); `claude_args` có `--permission-mode dontAsk`, `--allowedTools` liệt kê tường minh các tool chỉ đọc, `--max-turns`, `--max-budget-usd`; prompt gọi một skill reviewer của aip với đối số cố định, không nhúng tiêu đề/nội dung PR vào prompt (dữ liệu PR là đầu vào không tin cậy).
- **P6b — thiết kế sơ bộ** (để chốt hướng, không hiện thực ở đây):
  - **Repo và công nghệ:** `aip-runner`, Python 3.11+, LangGraph, `claude-agent-sdk`; không nằm trong gói npm của aip.
  - **Đọc graph:** nạp `workflows/<slug>/graph.json` (schema 1) → `StateGraph`: mỗi `step` là một node; `next` là cạnh; `on_fail` là cạnh có điều kiện theo kết quả node; `gate.type = human` → `interrupt()` với payload `{review, approve, reject}`; `gate.type = auto` → đi tiếp; `run.agents` + `parallel` → fan-out; `run.session` → phiên chính.
  - **Node = một phiên Claude Code:** ưu tiên SDK (`query()` với `cwd`=worktree của run, `setting_sources=["project"]`, `plugins=[{"type":"local","path":…}]`, `permission_mode="dontAsk"`, `allowed_tools`, `max_turns`, `max_budget_usd`); dự phòng là subprocess `claude -p --output-format json --json-schema …`. Giao diện nội bộ `run_step(step, ctx) -> StepResult` che hai backend.
  - **Giao thức kết quả bước:** mỗi node phải trả đối tượng có schema cố định `{status: ok|fail, goto?: <id trong on_fail>, summary, artifacts[]}` qua `structured_output` (hoặc file `docs/requests/<slug>/run/<step>.json` nếu dùng SDK); thiếu hoặc sai schema thì coi là `fail` và đi tới `blocked`.
  - **Trạng thái và resume:** checkpointer SQLite file, `thread_id = <workflow>:<slug>`; [Inference] checkpoint giữ dữ liệu chứ không giữ tiến trình đang chạy, nên node đang chạy khi process chết sẽ chạy lại từ đầu → mọi bước trước cổng phải idempotent (đúng ghi chú cũ trong memory).
  - **An toàn:** áp công thức P4 cho mỗi node (`dontAsk`, `allowedTools` tường minh, trần lượt và ngân sách), tổng ngân sách mỗi run cộng từ `total_cost_usd`; worktree riêng cho mỗi run; không push, không đăng bình luận, không gọi mạng ngoài trừ khi nằm sau cổng người duyệt; bí mật chỉ qua biến môi trường, không ghi log.
  - **Xác thực:** dùng `ANTHROPIC_API_KEY` cho máy chủ không người canh. [Unverified] tài liệu SDK cấm bên thứ ba cung cấp đăng nhập claude.ai cho sản phẩm xây trên SDK; chưa xác nhận trường hợp runner nội bộ dùng token đăng nhập.
  - **Mốc:** M0 = spike kiểm các điều chưa xác minh (xem Rủi ro); M1 = PR reviewer chỉ đọc (chính là P6a, không cần runner); M2 = executor graph cho `workflow-bugfix` với cổng người duyệt và resume; M3 = trigger và duyệt qua bình luận/CLI, lịch; M4 = agent song song nhiều worktree (P3).
  - **Không chọn Temporal ở mốc đầu:** [Inference] checkpoint LangGraph không phải thực thi bền (tiến trình chết là run chết, cần bộ giám sát chạy lại); Temporal xử lý việc đó nhưng thêm hạ tầng; để quyết lại khi M2 cho thấy cần. Nguồn: bài so sánh của nhà cung cấp (thiên vị), chưa kiểm độc lập.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given gói npm, Then `templates/ci/claude-review.example.yml` tồn tại, nằm trong tập file `pack:verify` cho phép, và `aip init --full` không tạo file nào dưới `.github/` (kiểm bằng test init hiện có thêm một khẳng định).
- [ ] **AC1.2** — Given `claude-review.example.yml`, Then trigger là `pull_request` và không có `pull_request_target`; `permissions` chỉ gồm `contents: read` và `pull-requests: read`; mọi `uses:` ghim theo SHA hoặc là chỗ giữ `<full-40-char-commit-sha>`.
- [ ] **AC1.3** — Given file đó, Then `claude_args` chứa `--permission-mode dontAsk`, `--allowedTools` với danh sách tường minh chỉ gồm tool chỉ đọc, `--max-turns` và `--max-budget-usd`; prompt gọi một skill reviewer của aip dạng `/plugin:skill` và không chứa biểu thức `${{ github.event.pull_request.title }}`, `.body` hay `.head.ref`.
- [ ] **AC1.4** — Given file đó, Then không có bước đăng bình luận hay ghi vào PR; đầu ra là job summary hoặc artifact.
- [ ] **AC2.1** — Given `README.md` và `README_VI.md`, Then có mục "Run reviews in CI" / "Chạy review trong CI" nêu file ví dụ, việc người dùng tự chép, các điều kiện an toàn trên và giới hạn (chỉ đọc, chưa đăng bình luận, nội dung PR là đầu vào không tin cậy), và nêu rằng P6b (runner) là repo riêng chưa hiện thực.
- [ ] **AC3.1** — Given spec tổng `docs/requests/2026-10-21-aip-trends-master-spec/design.md`, Then P4 ghi xong (merge `e363048`) và P6 có hai dòng P6a, P6b với trạng thái đúng; bảng trace xu hướng 6, 7, 8 phản ánh P4 và P6a.
- [ ] **AC4.1** — `npm test` xanh; không đổi nội dung plugin nên không bump version trừ khi `versions.mjs --lock` buộc; `npm run pack:verify` xanh.

## Ảnh hưởng spec
Không ảnh hưởng: P6a chỉ thêm file ví dụ và tài liệu, P6b nằm ở repo riêng; chưa có hành vi mới của năng lực nào trong `docs/specs`.

## Thiết kế

### 1. File ví dụ (`templates/ci/claude-review.example.yml`)

Một workflow YAML kèm chú thích tiếng Việt nêu chỗ phải điền (SHA của action, tên plugin/skill, khóa API lấy từ GitHub Secrets). Tên plugin và skill theo cách cài từ nguồn (`plugin_marketplaces`) như tài liệu của Action; skill reviewer là một skill đọc-chỉ-đọc của aip (ví dụ `backend-code-review`). Danh sách `--allowedTools` chỉ gồm tool đọc (`Read`, `Grep`, `Glob`) và `Bash(git diff *)`/`Bash(git log *)`. Mọi khẳng định về cờ và đầu vào của Action ghi `[Unverified]` kèm link tài liệu cho tới khi builder đối chiếu.

### 2. Test

Một pin trong `test/content/` (module mới) kiểm AC1.2–AC1.4 bằng các mẫu chuỗi trên nội dung file (không cần parser YAML), cộng một khẳng định vào `test/init.test.mjs` cho AC1.1. Danh sách phải tránh khẳng định giả (chỉ kiểm từ khóa khi có neo vào đúng khối).

### 3. Tài liệu và đồng bộ lộ trình

README EN/VI một mục mới. Spec tổng cập nhật P4 xong và tách P6 thành P6a/P6b; mục P6b trong spec tổng trỏ về design này cho phần thiết kế sơ bộ.

## Ngoài phạm vi và anti-goal

- Không tạo repo `aip-runner`, không viết mã Python/LangGraph, không sửa `graph.json` hay schema workflow.
- Không có file workflow tự chép vào project qua `aip init`; không đăng bình luận lên PR; không `pull_request_target`; không dùng `--dangerously-skip-permissions`/`bypassPermissions`.
- Anti-goal: một "reviewer tự động" mà prompt nhúng nội dung PR hoặc workflow mặc định có quyền ghi.

## Ràng buộc

- Zero-dep; UTF-8 không BOM, LF; README EN/VI; chú thích Vietnamese trong YAML chỉ nêu *vì sao*.
- Mọi khẳng định về Claude Code Action ghi `[Unverified]` kèm link `https://code.claude.com/docs/en/github-actions` và `/headless` cho tới khi đối chiếu.
- Nhánh `feature/p6-ci-runner`, commit mỗi task qua `core:git-workflow`; không push.

## Kiểm thử

- AC1.1: `test/init.test.mjs` (không có `.github/` trong danh sách tạo) và `npm run pack:verify`.
- AC1.2–AC1.4: pin mới trong `test/content/`.
- AC2.1: pin README (neo theo đoạn). AC3.1: kiểm đọc spec tổng. AC4.1: `npm test`, `pack:verify`.

## Để builder quyết

- Tên chính xác của đầu vào và định dạng giá trị của Action (`plugins`, `plugin_marketplaces`, `claude_args`, khóa API) theo tài liệu hiện hành; nếu khác, sửa file ví dụ và ghi lại.
- Skill reviewer nào dùng làm ví dụ; cách đặt tên file test pin.

## Rủi ro và câu hỏi mở

- [Unverified] Hook của plugin có chạy trong phiên SDK và `claude -p --plugin-dir` hay không chưa được tài liệu xác nhận bằng chữ; đây là điều M0 phải kiểm trước khi viết executor. Nếu hook không chạy, mọi cổng an toàn của aip (guard-bash, guard-files, guard-mcp) vắng mặt trong runner và phải thay bằng `can_use_tool`/`PermissionRequest` hoặc đặt trong `settings.json` của worktree.
- [Unverified] `isolation: worktree` trong `-p`/SDK và `AgentDefinition.isolation` của Python chưa xác nhận; M4 phụ thuộc điều này.
- [Unverified] Bản `result` JSON của `claude -p` có đủ `num_turns` và `is_error` chưa rõ trong trang `headless`; chỉ chắc `result`, `session_id`, `total_cost_usd`, `usage`, `structured_output`.
- [Inference] `claude -p` không `--bare` nạp hook và `.mcp.json` của project không hỏi tin cậy; vì vậy workflow ví dụ chạy trên mã của PR là bề mặt tấn công (PR từ fork). Giảm thiểu: chỉ chạy trên nhánh cùng repo hoặc yêu cầu duyệt môi trường; builder phải ghi rõ trong ví dụ và README.
- Câu hỏi mở 1: P6a có cần chạy được trên PR từ fork không. **Chốt 2026-10-22:** giữ đề xuất — P6a chỉ chạy trên nhánh cùng repo, không chạy PR từ fork.
- Câu hỏi mở 2: khi nào tạo repo `aip-runner` và ai tạo. **Chốt 2026-10-22:** chưa tạo; làm sau, cần người dùng (hành động hướng ra ngoài).
