# Spec: hooks-gates

Cập nhật: 2026-10-21

## Mục đích

Các hook cổng an toàn của core chặn hoặc hỏi trước khi agent làm điều rủi ro.

## Phạm vi

- Gồm: `guard-mcp` và khoá `mcpAllow`/`mcpDeny` trong `.claude/aip-gate.json` — chỉ phần mới của P4.
- Không gồm: các hook còn lại (`guard-bash`, `guard-files`, `gate-stop`, `session-start`) chưa có yêu cầu trong spec này vì chưa có request nào chạm tới; spec sống tạo dần.

## Yêu cầu

- **hooks-gates/R1** — `guard-mcp` từ chối (deny) tool của server không thuộc `mcpAllow` khi `mcpAllow` không rỗng. Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R2** — Khi một server vừa có trong `mcpDeny` vừa có trong `mcpAllow` thì `guard-mcp` từ chối (`mcpDeny` thắng). Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **hooks-gates/R3** — Khi không có cấu hình, cấu hình sai kiểu hoặc gặp lỗi nội bộ thì `guard-mcp` cho qua (không in gì, exit 0). Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R1 | thêm |
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R2 | thêm |
| 2026-10-21 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | hooks-gates/R3 | thêm |
