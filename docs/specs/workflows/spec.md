# Spec: workflows

Cập nhật: 2026-10-23

## Mục đích

Workflow và orchestrator điều phối các worker agent qua `graph.json`; năng lực này đặt luật cho đầu ra của worker và cho việc làm lại có giới hạn.

## Phạm vi

- Gồm: khối đầu ra `agent_result`, luật "Kiểm đầu ra worker" và luật retry có ngưỡng `max_attempts` trên cạnh `on_fail` quay ngược của `graph.json` — chỉ phần do request `2026-10-23-supervisor-worker-contract` thêm. Vai Supervisor nằm ở session chính; `aip` không chạy agent và không parse hay validate `agent_result` lúc runtime.
- Không gồm: các hành vi workflow, orchestrator và graph còn lại (định dạng `WORKFLOW.md`, bảng registry của orchestrator, gate `auto`/`human`, `checkGraphAgainstBody`, template graph) chưa có yêu cầu trong spec này vì chưa có request nào chạm tới; spec sống tạo dần.

## Yêu cầu

- **workflows/R1** — Mọi agent trong `plugins/*/agents/*.md` có mục `## Report trả về` nhắc khối `agent_result` của `core/principles/workflow-output-contract.md`, khối này có các trường `agent`, `status` (`completed | failed | blocked`, bắt buộc), `summary`, `changes`, `validation[]`, `findings[]`, `questions[]`, `remaining_risks[]`; contract test báo đỏ và nêu tên file của agent nào thiếu. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm)
- **workflows/R2** — Mục "Kiểm đầu ra worker" của contract coi kết quả là đầu ra hỏng khi thiếu `status`, finding thiếu `location` hoặc `evidence`, `status: completed` mà có `validation` ở trạng thái `failed`, hoặc `changes` chứa file ngoài danh sách đã giao; đầu ra hỏng được giao lại cho chính worker đó tối đa 2 lần rồi `ask_user`, `status: blocked` đi cạnh `on_fail` ngay không retry, còn `status: failed` hoặc gate trượt đi cạnh `on_fail` khớp `when`. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm)
- **workflows/R3** — Mọi cạnh `on_fail` quay ngược (đích có `n` nhỏ hơn hoặc bằng bước hiện tại) của `graph.json`, trừ `gate.reject` của gate `human`, phải có `max_attempts` là số nguyên ≥ 1 và `checkGraph` báo lỗi nếu thiếu hoặc sai; cạnh tiến lên, cạnh tới `blocked`/`ask_user` và `gate.reject` của gate `human` mà có `max_attempts` thì bị báo lỗi khóa thừa; bộ đếm tính riêng từng cạnh, không reset trong một lần chạy workflow, và lần thứ `max_attempts + 1` thì chuyển sang `ask_user` kèm lý do trượt của từng lượt. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | workflows/R1 | thêm |
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | workflows/R2 | thêm |
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | workflows/R3 | thêm |
