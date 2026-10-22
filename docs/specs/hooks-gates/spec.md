# Spec: hooks-gates

Cập nhật: 2026-10-22

## Mục đích

Các hook cổng an toàn của core chặn hoặc hỏi trước khi agent làm điều rủi ro.

## Phạm vi

- Gồm: `guard-mcp` và khoá `mcpAllow`/`mcpDeny` trong `.claude/aip-gate.json` — chỉ phần do request `2026-10-21-agent-permissions` thêm. Server của plugin có tên dạng `plugin:<plugin>:<server>` (tool `mcp__plugin_<plugin>_<server>__<tool>`).
- Gồm: hành vi trong worktree — cách `gate-config.mjs` chọn `aip-gate.json` và cách `guard-files` neo `writeScope` — do request `2026-10-22-parallel-agents` thêm.
- Gồm: chế độ quyền `full`/`ask` (khoá `mode`, `fullKeep`, `fullRoots` trong `.claude/aip-gate.json`; hiệu lực, hành vi của `guard-bash`/`guard-files`/`guard-mcp`, nhốt root, hỏi bằng hook ở phiên không bypass) — do request `2026-10-22-permission-modes` thêm.
- Không gồm: các hook còn lại (`guard-bash`, `guard-files`, `gate-stop`, `session-start`) chưa có yêu cầu trong spec này vì chưa có request nào chạm tới; spec sống tạo dần.

## Yêu cầu

- **hooks-gates/R1** — `guard-mcp` từ chối (deny) tool của server không thuộc `mcpAllow` khi `mcpAllow` không rỗng. Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R2** — `mcpDeny` thắng `mcpAllow`: server nằm trong `mcpDeny` bị `guard-mcp` từ chối, kể cả khi cũng có trong `mcpAllow` hoặc chỉ nằm trong `mcpDeny`. Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R3** — Khi không có cấu hình, cấu hình sai kiểu hoặc gặp lỗi nội bộ thì `guard-mcp` cho qua (không in gì, exit 0). Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R4** — Khi chạy trong một git worktree, các hook đọc `.claude/aip-gate.json` ở gốc worktree trước, không có thì ở gốc repo chính; repo không chung `git-common-dir` thì không có cấu hình (`null`). Nguồn: [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) (thêm)
- **hooks-gates/R5** — `guard-files` neo `writeScope` theo gốc git của file đích, nên phạm vi áp theo worktree chứa file đó. Nguồn: [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) (thêm)
- **hooks-gates/R6** — Chế độ `full` chỉ hiệu lực khi `.claude/aip-gate.json` có `mode: "full"` và stdin của hook có `permission_mode: "bypassPermissions"`; mọi tổ hợp khác (thiếu khoá, giá trị lạ, phiên không bypass) chạy như `ask`. `fullKeep` mặc định `["push"]` (kiểu sai ⇒ mặc định). Nguồn: [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) (thêm)
- **hooks-gates/R7** — Khi `full` hiệu lực: `guard-bash` bỏ H2 (commit có dấu) và H3 (lệnh nhắc file bí mật), chỉ giữ H1 (push nhánh bảo vệ, force push) khi `fullKeep` chứa `"push"`; `guard-files` bỏ quy tắc file bí mật nhưng giữ `writeScope` (H5); `guard-mcp` bỏ `mcpAllow` nhưng giữ `mcpDeny`. Mọi thao tác bị nhốt trong các root gồm gốc project, gốc repo chính khi ở worktree, `scratchpad_dir` của stdin và `fullRoots`: file tool ghi ngoài root bị `deny`, đọc ngoài root bị `ask`; `guard-bash` với lệnh ghi/xoá và chuyển hướng có đích ngoài root bị `deny`, đường dẫn không phân tích được bị `ask`. Đây là heuristic, không phải sandbox (không resolve symlink, không bắt chương trình tự ghi file). Nguồn: [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) (thêm)
- **hooks-gates/R8** — Khi `mode: "full"` nhưng phiên không bypass, `guard-bash` hỏi (ask) với `git push`, `curl`, `wget`, `kubectl apply`, `terraform apply`, `helm upgrade`; khi `mode` thiếu hoặc `ask` thì hook không hỏi (quy tắc nằm ở `settings.json`), khi `full` hiệu lực thì tắt. Danh sách này khớp phần Bash của nhóm `git_push`, `network`, `production_deploy` trong `core/permissions/policy.json`, được giữ đồng bộ bằng một contract test. Nguồn: [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R1 | thêm |
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R2 | thêm |
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R3 | thêm |
| 2026-10-22 | [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) | hooks-gates/R4 | thêm |
| 2026-10-22 | [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) | hooks-gates/R5 | thêm |
| 2026-10-22 | [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) | hooks-gates/R6 | thêm |
| 2026-10-22 | [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) | hooks-gates/R7 | thêm |
| 2026-10-22 | [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) | hooks-gates/R8 | thêm |
