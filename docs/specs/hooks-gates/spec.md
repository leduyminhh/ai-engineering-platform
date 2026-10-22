# Spec: hooks-gates

Cập nhật: 2026-10-22

## Mục đích

Các hook cổng an toàn của core chặn hoặc hỏi trước khi agent làm điều rủi ro.

## Phạm vi

- Gồm: `guard-mcp` và khoá `mcpAllow`/`mcpDeny` trong `.claude/aip-gate.json` — chỉ phần do request `2026-10-21-agent-permissions` thêm. Server của plugin có tên dạng `plugin:<plugin>:<server>` (tool `mcp__plugin_<plugin>_<server>__<tool>`).
- Gồm: hành vi trong worktree — cách `gate-config.mjs` chọn `aip-gate.json` và cách `guard-files` neo `writeScope` — do request `2026-10-22-parallel-agents` thêm.
- Không gồm: các hook còn lại (`guard-bash`, `guard-files`, `gate-stop`, `session-start`) chưa có yêu cầu trong spec này vì chưa có request nào chạm tới; spec sống tạo dần.

## Yêu cầu

- **hooks-gates/R1** — `guard-mcp` từ chối (deny) tool của server không thuộc `mcpAllow` khi `mcpAllow` không rỗng. Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R2** — `mcpDeny` thắng `mcpAllow`: server nằm trong `mcpDeny` bị `guard-mcp` từ chối, kể cả khi cũng có trong `mcpAllow` hoặc chỉ nằm trong `mcpDeny`. Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R3** — Khi không có cấu hình, cấu hình sai kiểu hoặc gặp lỗi nội bộ thì `guard-mcp` cho qua (không in gì, exit 0). Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R4** — Khi chạy trong một git worktree, các hook đọc `.claude/aip-gate.json` ở gốc worktree trước, không có thì ở gốc repo chính; repo không chung `git-common-dir` thì không có cấu hình (`null`). Nguồn: [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) (thêm)
- **hooks-gates/R5** — `guard-files` neo `writeScope` theo gốc git của file đích, nên phạm vi áp theo worktree chứa file đó. Nguồn: [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R1 | thêm |
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R2 | thêm |
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R3 | thêm |
| 2026-10-22 | [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) | hooks-gates/R4 | thêm |
| 2026-10-22 | [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) | hooks-gates/R5 | thêm |
