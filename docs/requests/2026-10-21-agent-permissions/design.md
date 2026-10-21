# Thiết kế: quyền cho agent và cổng MCP (project P4)
- Ngày: 2026-10-21
- Trạng thái: đã duyệt 2026-10-21
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P4 (xu hướng 8, 5)

## Vấn đề và lý do

Khoảng trống đã ghi trong spec tổng cho xu hướng 8: hook `guard-*` chỉ có ở plugin mode, chưa có quy tắc an toàn cho agent chạy trong CI, chưa kiểm skill bên thứ ba, chưa có cấu hình MCP. Tra tài liệu chính thức của Claude Code ngày 2026-10-21 (nguồn thứ cấp: tổng hợp của subagent `claude-code-guide`, chưa đối chiếu từng trang) cho các ràng buộc mà thiết kế phải tôn trọng:

- Plugin **không** ship được quyền allow/ask/deny; `settings.json` của plugin chỉ nhận `agent` và `subagentStatusLine`. Muốn có quyền ở project phải nằm trong `.claude/settings.json` của project.
- Agent của plugin **bỏ qua** `permissionMode`, `hooks`, `mcpServers`; chỉ `tools`/`disallowedTools` có tác dụng.
- Hook PreToolUse trả `permissionDecision: deny` giữ nguyên ở mọi chế độ quyền, kể cả bypass; matcher MCP có dạng `mcp__<server>__<tool>`, server của plugin là `mcp__plugin_<plugin>_<server>__<tool>`.
- MCP server của plugin tự khởi động khi bật plugin, tài liệu không mô tả bước duyệt riêng; `claude -p` không có `--bare` nạp hook và `.mcp.json` của project mà không hỏi tin cậy.
- Cursor, Codex và Antigravity: chỉ có nguồn thứ cấp và báo lỗi từ người dùng (quy tắc `Mcp(...)` của Cursor bị báo là không khớp; danh sách allow của Antigravity bị báo là không được tôn trọng; Codex có `approval_policy`/`sandbox_mode` trong `config.toml` nhưng định dạng agent TOML chưa xác nhận). Không đủ chắc để sinh file quyền cho ba provider này.

Hệ quả: với Claude, hook plugin là chỗ ép buộc duy nhất đi cùng plugin; quyền ở cấp project phải do project tự giữ. aip hiện không viết `settings.json` (ghi chú ở `cli/lib/install.mjs`), nên quyền chỉ đi qua `aip init`.

## Quyết định đã chốt

Của người dùng (2026-10-21): để tôi tự đề xuất thiết kế P4, rồi duyệt design; chốt `git_push` và `network` đặt mức `ask`; P4c (quét plugin bên thứ ba) làm sau P6; `aip init --full` bỏ các quy tắc `.env` khi `<root>/.claude/aip-gate.json` có `allowEnvFiles: true` (chốt sau review cuối). Phần còn lại dưới đây là đề xuất của tôi được duyệt cùng. Giữ nguyên các quyết định cũ: Claude first, provider khác best-effort; aip chỉ chuẩn hóa và phân phối, zero-dep, không tự chạy agent.

Đề xuất của tôi:
- **Phạm vi P4 chỉ gồm P4a (chính sách quyền cho Claude + cổng MCP) và P4b (công thức CI, chỉ tài liệu).** Hai phần nữa tách riêng, chưa thiết kế: P4c (quét plugin/skill bên thứ ba) và P4d (sinh cấu hình MCP). Lý do P4d chưa làm: chưa có capability nào của aip cần MCP server (YAGNI).
- **Chính sách quyền chuẩn** là file JSON `core/permissions/policy.json`, nhóm theo ý nghĩa: `secrets` (deny), `git_push` (ask), `network` (ask), `production_deploy` (ask). Mỗi nhóm giữ danh sách quy tắc theo cú pháp quy tắc của Claude Code. Chỉ dùng các dạng đã nêu trong tài liệu: `Read(./.env)`, `Bash(git push *)`, `WebFetch`, `mcp__<server>__*`. Quy tắc glob chưa xác nhận (ví dụ cho `*.pem`) bị loại cho đến khi builder đối chiếu tài liệu.
- **Phân phối:** `aip init --full` tạo `.claude/settings.json` chỉ khi file chưa tồn tại, với khối `permissions.deny` và `permissions.ask` sinh từ chính sách; không bao giờ ghi đè hoặc sửa file có sẵn. Khi file đã có, `aip init` in cảnh báo kèm đường dẫn chính sách và không ghi gì.
- **Cổng MCP:** hook `PreToolUse` mới `guard-mcp.mjs` với matcher `mcp__.*`, đọc `<git-root>/.claude/aip-gate.json`: `mcpAllow` (danh sách tên server hoặc `plugin:<plugin>:<server>`) và `mcpDeny`. Không có cấu hình thì cho qua (hành vi hiện tại không đổi); có `mcpAllow` thì tool của server ngoài danh sách bị `deny`; `mcpDeny` thắng `mcpAllow`. Lỗi nội bộ thì fail-open như các hook còn lại.
- **Provider khác:** không sinh file quyền cho Cursor, Codex, Antigravity trong P4. Codex tiếp tục nhận `sandbox_mode` theo `mode` của agent như hiện nay. Ghi rõ trong README là Claude-only vì chưa xác minh được định dạng.
- **P4b:** mục baseline ngắn "Agents in CI" và mục README chi tiết với công thức tối thiểu cho `claude -p`: dùng `--permission-mode dontAsk`, `--allowedTools` liệt kê tường minh, `--max-turns`, `--max-budget-usd`, `--bare` khi không cần plugin; ghim action theo commit SHA, token chỉ đọc, môi trường cần người duyệt. Không thêm file workflow vào `templates/init`.
- **Dogfood P7:** request này tạo spec sống đầu tiên `docs/specs/hooks-gates/spec.md` chỉ với các yêu cầu mới của P4 (không backfill phần cũ).

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given `core/permissions/policy.json`, Then có bốn nhóm `secrets`, `git_push`, `network`, `production_deploy`, mỗi nhóm có hành động `deny` hoặc `ask` và danh sách quy tắc không rỗng, và mọi quy tắc khớp một trong các dạng đã chốt (`Read(<path>)`, `Bash(<lệnh> *)`, `WebFetch`, `mcp__<server>__*`).
- [x] **AC1.2** — Given `aip init --full` ở thư mục trống, Then có `.claude/settings.json` hợp lệ JSON với `permissions.deny` chứa quy tắc nhóm `secrets` và `permissions.ask` chứa quy tắc ba nhóm còn lại.
- [x] **AC1.3** — Given `.claude/settings.json` đã tồn tại, When chạy `aip init --full`, Then file giữ nguyên byte-for-byte và kết quả báo bỏ qua kèm đường dẫn chính sách.
- [x] **AC1.4** — Given `<root>/.claude/aip-gate.json` có `allowEnvFiles` đúng giá trị `true` (cùng quy tắc với hook: giá trị khác `true`, file thiếu hoặc JSON hỏng đều không tính), When chạy `aip init --full` mà `.claude/settings.json` chưa có, Then `permissions.deny` không chứa các quy tắc của nhóm `secrets` (quy tắc `.env`); khi không bật cờ thì giữ nguyên như AC1.2.
- [x] **AC2.1** — Given `core/hooks/hooks.json`, Then có mục `PreToolUse` với matcher `mcp__.*` trỏ tới `guard-mcp.mjs`.
- [x] **AC2.2** — Given không có `mcpAllow`/`mcpDeny` trong `aip-gate.json`, When hook nhận một tool `mcp__x__y`, Then không có quyết định (cho qua).
- [x] **AC2.3** — Given `mcpAllow = ["a"]`, When hook nhận `mcp__b__t`, Then trả `permissionDecision: deny` kèm lý do; nhận `mcp__a__t` hoặc `mcp__plugin_p_a__t` khi cấu hình `plugin:p:a`, Then cho qua.
- [x] **AC2.4** — Given `mcpDeny = ["a"]` và `mcpAllow = ["a"]`, When hook nhận `mcp__a__t`, Then `deny` (deny thắng allow).
- [x] **AC2.5** — Given đầu vào hỏng (JSON sai, thiếu tên tool, `aip-gate.json` sai), Then hook không làm hỏng phiên (fail-open, exit 0).
- [x] **AC3.1** — Given baseline `core/agents/AGENTS.template.md`, Then có mục `Agents in CI` nêu `--permission-mode dontAsk`, `--allowedTools`, `--max-turns`, `--max-budget-usd`, `--bare`, ghim action theo SHA; `AGENTS.md` giữ byte-for-byte giống template.
- [x] **AC3.2** — Given `README.md` và `README_VI.md`, Then có mục công thức CI, mục chính sách quyền (Claude-only, vì sao chưa có Cursor/Codex/Antigravity) và khoá `mcpAllow`/`mcpDeny` của `aip-gate.json`; `CLAUDE.md` mô tả `guard-mcp` và `core/permissions/policy.json`.
- [x] **AC4.1** — Given repo sau thay đổi, Then có `docs/specs/hooks-gates/spec.md` với yêu cầu `hooks-gates/R1…` cho `guard-mcp`, `mcpAllow`/`mcpDeny` và deny thắng allow; `docs/specs/README.md` vẫn liệt kê đủ 7 năng lực; `check-request.mjs` trên request này không có W10–W14.
- [x] **AC5.1** — `npm test` xanh; bump version `core` (và plugin/workflow mà `versions.mjs --lock` buộc phải bump); `node cli/lib/versions.mjs --lock` cập nhật; `npm run pack:verify` xanh (chính sách và hook nằm trong `core/` nên đi theo gói npm).

## Ảnh hưởng spec
- hooks-gates: thêm R1, thêm R2, thêm R3

## Thiết kế

### 1. Chính sách quyền (`core/permissions/policy.json`)

Dạng `{ "version": 1, "groups": { "<tên>": { "action": "deny"|"ask", "rules": ["…"] } } }`. Một hàm thuần trong `cli/lib/` đọc chính sách và dựng khối `permissions` (`deny` gom từ nhóm có action `deny`, `ask` từ nhóm `ask`). Test đối chiếu từng quy tắc với bộ dạng hợp lệ để không lọt cú pháp lạ.

### 2. `aip init`

`cli/lib/init.mjs` (hoặc nơi `aip init --full` đang tạo file) thêm một mục tạo `.claude/settings.json` từ chính sách theo cùng cơ chế "không ghi đè, báo skipped" của các file template. Chỉ chạy ở chế độ `--full` như phần còn lại của khung `templates/init`.

### 3. `guard-mcp.mjs`

Cùng khuôn với `guard-bash`/`guard-files`: đọc stdin JSON, lấy `tool_name`, tách server từ `mcp__<server>__<tool>`; tên server của plugin dạng `plugin_<plugin>_<server>` ánh xạ về `plugin:<plugin>:<server>` để so với cấu hình. Đầu ra theo dạng `hookSpecificOutput.permissionDecision` giống `guard-files`. Cấu hình đọc qua `gate-config.mjs` (`readGateConfig`).

### 4. Tài liệu

Baseline thêm mục `Agents in CI` (ngắn, tiếng Anh); README có công thức đầy đủ và nêu rõ Claude Code mặc định không có `--bare` thì nạp hook và `.mcp.json` của project không hỏi.

## Ngoài phạm vi và anti-goal

- Không quét plugin/skill bên thứ ba (P4c), không sinh `.mcp.json` hay `[mcp_servers]` (P4d), không sinh quyền cho Cursor/Codex/Antigravity, không thêm hook chặn cho Codex hay Cursor.
- Không sửa hoặc ghi đè `.claude/settings.json` có sẵn, kể cả khi thiếu quy tắc; không viết `settings.json` ở scope global.
- Anti-goal: chính sách thành bản sao thứ hai của `guard-bash`; một cổng MCP mặc định chặn khiến project hiện có hỏng khi nâng cấp.

## Ràng buộc

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; baseline tiếng Anh; README EN/VI.
- Hook mới fail-open, không ghi file, không gọi mạng; `guard-mcp` không đổi hành vi khi không có cấu hình.
- Bump `core`; chạy `node cli/lib/versions.mjs --lock`; gói npm vẫn chỉ ship core (`pack:verify`).
- Nhánh `feature/p4-permissions-mcp`, commit mỗi task qua `core:git-workflow`; không push.

## Kiểm thử

- AC1.1: contract kiểm cấu trúc chính sách và cú pháp quy tắc (tham số hóa theo nhóm).
- AC1.2, AC1.3: `test/init.test.mjs` (tạo mới và không ghi đè).
- AC2.x: test đơn vị cho `guard-mcp` theo mẫu test hook hiện có (`test/contract/90-hooks.contract.mjs`), bảng tham số hóa theo cấu hình × tên tool.
- AC3.1, AC4.1: pin trong module `test/content/` mới; AC3.2 kiểm đọc.
- AC5.1: `npm test`, `pack:verify`.

## Để builder quyết

- Tên hàm và vị trí file dựng khối `permissions`; cách `aip init` báo `skipped`.
- Danh sách quy tắc cụ thể của từng nhóm, miễn dùng đúng dạng đã chốt và đối chiếu lại tài liệu cú pháp quy tắc của Claude Code trước khi chốt.
- Có cần nhận cú pháp `mcp__server` không có `__*` hay không trong `mcpAllow`; chọn dạng đơn giản nhất khớp AC2.3.

## Rủi ro và câu hỏi mở

- [Unverified] Toàn bộ sự thật về Claude Code lấy từ tổng hợp của subagent; builder phải đối chiếu `permissions`, `hooks` và quy tắc MCP trên trang chính thức trước khi hiện thực.
- [Inference] Hook có thể bị bypass nếu project tắt plugin; chính sách `.claude/settings.json` là lớp thứ hai nhưng người dùng có thể sửa. Không có lớp ép buộc nào ngoài managed settings của tổ chức.
- [Inference] Quy tắc `Bash(git push *)` và `network` ở mức `ask` (người dùng đã chốt) có thể gây nhiều hỏi trong workflow tự động; project chỉnh `.claude/settings.json` sinh ra khi cần.
- [Inference] Nhóm `secrets` mức `deny` có thể xung đột với công tắc `allowEnvFiles` của project muốn đọc `.env`; file sinh ra chỉ là điểm xuất phát, project tự sửa, và `aip init` không bao giờ sửa lại.
- Đã chốt cùng việc duyệt design: P4c làm sau P6.
