# Spec: cli-wizard

Cập nhật: 2026-10-23

## Mục đích

CLI `aip` và wizard là cửa vào của người dùng; năng lực này gồm các lệnh đo đạc chỉ đọc như `aip stats`.

## Phạm vi

- Gồm: `aip stats --usage [--since <số ngày|yyyy-mm-dd>]` — chỉ phần do request `2026-10-22-cost-tracking` thêm.
- Gồm: `aip mode full|ask|status` — do request `2026-10-22-permission-modes` thêm; cảnh báo/trạng thái git do request `2026-10-23-permission-modes-phase2` đổi.
- Không gồm: hành vi cũ của `init`, wizard, `args` và các chế độ `aip stats` đã có (bảng context, `--session`, `--json`) chưa có yêu cầu trong spec này vì chưa có request nào chạm tới; spec sống tạo dần.

## Yêu cầu

- **cli-wizard/R1** — `aip stats --usage` đọc transcript Claude Code của project hiện tại, tổng hợp token theo model (mỗi `message.id` một lần trên toàn project (kể cả bản sao fork/resume)), tách phiên chính và subagent; chỉ đọc. `--since` lọc theo `timestamp` của từng dòng, mặc định 7 ngày, giá trị sai định dạng thì exit 2. Nguồn: [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) (thêm)
- **cli-wizard/R2** — Tiền lấy từ bản ghi `cost-state` của Claude Code (giá trị `totalCostUSD` lớn nhất của phiên), aip không có bảng giá và không dự đoán hạn mức; phiên thiếu `cost-state` hiển thị `—`. Nguồn: [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) (thêm)
- **cli-wizard/R3** — `aip stats --usage` (bảng và `--json`) không in nội dung hội thoại (chỉ số, tên model, `sessionId`, tên agent, tên file) và không ghi file nào. Nguồn: [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) (thêm)
- **cli-wizard/R4** — `aip mode full|ask|status` chỉ chạy ở phạm vi project (`-g` và giá trị lạ bị từ chối): `full` ghi `mode: "full"` vào `.claude/aip-gate.json` (giữ các khoá khác, bỏ BOM, chạy lại không đổi gì), `ask` bỏ khoá `mode`, `status` in `mode` và tình trạng `settings.json`; `.claude/settings.json` chỉ bị viết lại (rỗng ở `full`, policy chuẩn ở `ask`) khi trùng byte với bản aip sinh, ngược lại giữ nguyên và liệt kê quy tắc của aip còn trong đó. `full` in cảnh báo khi `aip-gate.json` đang được git theo dõi (full bị bỏ qua; gợi ý `git rm --cached`) hoặc chưa được gitignore, `status` thêm dòng `git:` (theo dõi / ignore / chưa ignore / không xác định); aip không bao giờ sửa `.gitignore`. Lỗi (JSON hỏng, không đọc được file) in ra stderr và exit 1. Nguồn: [2026-10-23-permission-modes-phase2](../../requests/2026-10-23-permission-modes-phase2/design.md) (đổi)
- **cli-wizard/R5** — `aip statusline` đọc JSON statusLine của Claude Code từ stdin và in một dòng: model, `ctx <n>%` (kèm nhắc bàn giao từ `--soft` mặc định 40 và `--hard` mặc định 60, soft < hard, số trong 1–100, sai thì stderr + mã 2), phút cache còn ấm từ `prompt_cache.expires_at` hoặc `cache nguội`, tiền phiên, hạn mức 5 giờ. Chỉ dùng trường có sẵn trong stdin, không đọc transcript; stdin rỗng, hỏng hoặc không phải object thì in dòng rỗng và thoát mã 0.

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-22 | [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) | cli-wizard/R1 | thêm |
| 2026-10-22 | [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) | cli-wizard/R2 | thêm |
| 2026-10-22 | [2026-10-22-cost-tracking](../../requests/2026-10-22-cost-tracking/design.md) | cli-wizard/R3 | thêm |
| 2026-10-22 | [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) | cli-wizard/R4 | thêm |
| 2026-10-23 | [2026-10-23-permission-modes-phase2](../../requests/2026-10-23-permission-modes-phase2/design.md) | cli-wizard/R4 | đổi |
| 2026-10-29 | [2026-10-29-aip-statusline](../../requests/2026-10-29-aip-statusline/design.md) | cli-wizard/R5 | thêm |
