# Spec: workflows

Cập nhật: 2026-10-23

## Mục đích

Workflow và orchestrator điều phối các worker agent qua `graph.json`; năng lực này đặt luật cho đầu ra của worker và cho việc làm lại có giới hạn.

## Phạm vi

- Gồm: `graph.json` của workflow pipeline và việc đối chiếu nó với `WORKFLOW.md` (request `2026-10-20-workflow-graph`); khối đầu ra `agent_result`, luật "Kiểm đầu ra worker" và luật retry có ngưỡng `max_attempts` trên cạnh `on_fail` quay ngược của `graph.json` — phần do request `2026-10-23-supervisor-worker-contract` thêm. Vai Supervisor nằm ở session chính; `aip` không chạy agent và không parse hay validate `agent_result` lúc runtime.
- Không gồm: định dạng 8 trường/bước của `WORKFLOW.md`, bảng registry và định tuyến của orchestrator, quy ước pipeline-vs-skill (chưa có yêu cầu trong spec này; chưa kiểm với code ngoài `checkGraph`/`checkGraphAgainstBody`); việc chiếu `graph.json` ra build thuộc `projection`.

## Yêu cầu

- **workflows/R1** — Mọi agent trong `plugins/*/agents/*.md` có mục `## Report trả về` nhắc khối `agent_result` của `core/principles/workflow-output-contract.md`, khối này có các trường `agent`, `status` (`completed | failed | blocked`, bắt buộc), `summary`, `changes`, `validation[]`, `findings[]`, `questions[]`, `remaining_risks[]`; contract test báo đỏ và nêu tên file của agent nào thiếu. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm)
- **workflows/R2** — Mục "Kiểm đầu ra worker" của contract coi kết quả là đầu ra hỏng khi thiếu `status`, finding thiếu `location` hoặc `evidence`, `status: completed` mà có `validation` ở trạng thái `failed`, hoặc `changes` chứa file ngoài danh sách đã giao (với agent có danh sách); đầu ra hỏng được giao lại cho chính worker đó tối đa 2 lần rồi `ask_user`, `status: blocked` đi cạnh `on_fail` ngay không retry, còn `status: failed` hoặc gate trượt đi cạnh `on_fail` khớp `when`. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm)
- **workflows/R3** — Mọi cạnh `on_fail` quay ngược (đích có `n` nhỏ hơn hoặc bằng bước hiện tại) của `graph.json`, trừ `gate.reject` của gate `human`, phải có `max_attempts` là số nguyên ≥ 1 và `checkGraph` báo lỗi nếu thiếu hoặc sai; cạnh tiến lên, cạnh tới `blocked`/`ask_user` và `gate.reject` của gate `human` mà có `max_attempts` thì bị báo lỗi khóa thừa; bộ đếm tính riêng từng cạnh, không reset trong một lần chạy workflow, và lần thứ `max_attempts + 1` thì chuyển sang `ask_user` kèm lý do trượt của từng lượt, còn khi không đọc được `graph.json` hoặc cạnh thiếu `max_attempts` thì Supervisor dùng 2. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm)

- **workflows/R4** — Mỗi workflow pipeline có `workflows/<slug>/graph.json` (`schema: 1`, `workflow` trùng `name` trong frontmatter, `start` là id bước 1, mỗi bước có `id` kebab-case duy nhất, `n`, `title`, `run`, `next`, `on_fail`, `gate`); `checkGraph` báo lỗi khi đích (`next`, `on_fail[].to`, `gate.approve`, `gate.reject`) không phải id bước thật hay `done`/`blocked`/`ask_user`, khi có bước không tới được từ `start`, hoặc từ một bước không tới được `done`; orchestrator không có graph. Nguồn: [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) (thêm)
- **workflows/R5** — `checkGraphAgainstBody` đối chiếu `graph.json` với `WORKFLOW.md` hai chiều: số bước, thứ tự `n` và `title` khớp (bỏ ⏸); bước ⏸ ↔ `gate.type: human` (có `review`, `approve`, `reject`) còn bước không ⏸ ↔ `auto`; tập id trong `run.agents`/`run.skills` bằng tập agent/skill của trường **Thực hiện**; mỗi cạnh `on_fail` phải có bằng chứng trong **Khi fail** ("quay lại/quay về Bước N", `blocked`/"dừng", "hỏi"/"người dùng chỉ định") và mọi "quay lại Bước N" phải có cạnh tương ứng. Nguồn: [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) (thêm)
- **workflows/R6** — Contract test đỏ khi một workflow pipeline thiếu `graph.json`; `core/skills/artifact-templates/references/workflow.graph.template.json` là khối mẫu và `CLAUDE.md` mục "New workflow" hướng dẫn tạo `graph.json` kèm workflow mới. Nguồn: [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | workflows/R1 | thêm |
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | workflows/R2 | thêm |
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | workflows/R3 | thêm |
| 2026-10-23 | [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) | workflows/R4 | thêm |
| 2026-10-23 | [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) | workflows/R5 | thêm |
| 2026-10-23 | [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) | workflows/R6 | thêm |
