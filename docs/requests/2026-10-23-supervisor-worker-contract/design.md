# Thiết kế: Supervisor kiểm đầu ra worker và retry có ngưỡng
- Ngày: 2026-10-23
- Trạng thái: merged — master `b8b2cb7` (2026-10-23)
- Requirement: không có

## Vấn đề và lý do

Workflow trong `workflows/` gọi worker agent (16 agent trong `plugins/*/agents/`) rồi đi tiếp theo `next` hoặc
`on_fail` của `graph.json`. Có ba khoảng trống:

1. Mỗi agent mô tả đầu ra bằng lời trong `## Report trả về`, không có khối chung. Reviewer không trả `status`,
   fixer thì có `status: blocked`. Session chính không có một luật thống nhất để biết kết quả của worker đạt
   hay không đạt.
2. Điều kiện `on_fail.when` và gate `auto` đều là văn xuôi, không có tiêu chí nào kiểm được.
3. 16 cạnh `on_fail` quay ngược (ví dụ `workflow-bugfix` `reproduce → context`, `review → fix`) không có giới
   hạn số lần, nên về lý thuyết có thể lặp vô hạn.

Nguồn ý tưởng: mô hình Supervisor / Worker trả JSON / Evaluator mà người dùng đưa ra trong cuộc trao đổi.

## Quyết định đã chốt

Người dùng chốt:
- **Không tạo agent Supervisor riêng.** Vai Supervisor nằm ở session chính, tức orchestrator hoặc workflow
  đang chạy. Lý do: subagent không có tool `Agent`, nên không giao việc được cho worker.
- **Worker trượt → Supervisor tự giao làm lại đến hết ngưỡng rồi mới hỏi người dùng**, không hỏi ngay từ lần
  trượt đầu.
- **Ngưỡng = 2 lần làm lại**, tức tối đa 3 lượt chạy trên cùng một cạnh.
- **Không dùng SQLite/Redis hay bất kỳ state runtime nào.** State tiếp tục nằm trong file (`docs/requests/`,
  ledger, `handoff.md`).

Lựa chọn của tôi (người dùng đã nghe ở bản tóm tắt và đồng ý):
- Khối đầu ra chung `agent_result` đặt trong `core/principles/workflow-output-contract.md`.
- Luật chấm "Kiểm đầu ra worker" đặt trong cùng file đó.
- Khai báo ngưỡng bằng khóa `max_attempts` trên cạnh `on_fail` của `graph.json`, `checkGraph` kiểm tra khóa
  này.
- Đầu ra vẫn là YAML trong report (theo contract hiện có), không đổi sang JSON thuần.

Lựa chọn của tôi sau vòng builder check (người dùng chưa duyệt):
- Retry hai tầng: đầu ra hỏng thì làm lại ngầm với chính worker đó (mặc định 2); kết quả `failed` hoặc gate
  trượt thì đi theo cạnh graph có `max_attempts`.
- `blocked` → hỏi người dùng ngay, không retry.
- Bộ đếm tính theo từng cạnh, không reset trong một lần chạy workflow.
- `location` của finding không bắt buộc là `file:line` khi finding không gắn với code. Thêm trường
  `questions[]` vào `agent_result`.
- Template graph giữ nguyên.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `workflow-output-contract.md` When đọc mục `agent_result` Then mục này định nghĩa các
  trường `agent`, `status` (`completed | failed | blocked`), `summary`, `changes`, `validation[]`, `findings[]`,
  `remaining_risks[]`, và trường `status` là bắt buộc.
- [ ] **AC1.2** — Given bất kỳ file nào trong `plugins/*/agents/*.md` When contract test chạy Then mục
  `## Report trả về` của file đó nhắc `agent_result`; agent nào thiếu thì test đỏ và nêu tên file.
- [ ] **AC2.1** — Given `workflow-output-contract.md` When đọc mục "Kiểm đầu ra worker" Then có đủ các luật:
  có `status`; mỗi finding có `location` không rỗng (dạng `file:line` khi finding gắn với code; với log, số
  đo hoặc tài liệu thì là tham chiếu tới nguồn đó) và có `evidence`; `status: completed` thì không có
  `validation` nào ở trạng thái `failed`; mọi file trong `changes` thuộc danh sách file đã giao (với agent có
  danh sách). Kết quả không đạt bất kỳ luật nào là **đầu ra hỏng**.
- [ ] **AC2.2** — Given `workflow-output-contract.md` When đọc mục "Kiểm đầu ra worker" Then có luật xử lý
  theo loại kết quả: (a) đầu ra hỏng → giao lại cho chính worker đó, kèm luật bị vi phạm, tối đa 2 lần, không
  đi theo cạnh nào của graph, hết ngưỡng thì `ask_user`; (b) `status: blocked` → đi theo cạnh `on_fail` hiện
  có (thường là `ask_user`) ngay, không retry; (c) `status: failed` hoặc đầu ra hợp lệ nhưng gate trượt → đi
  theo cạnh `on_fail` khớp `when`, và tính lượt theo AC3.4.
- [ ] **AC3.1** — Given một `graph.json` có cạnh `on_fail` quay ngược (đích là chính bước đó hoặc một bước có
  `n` nhỏ hơn) và cạnh đó không phải `gate.reject` của gate `human` When chạy `checkGraph` Then báo lỗi nếu
  thiếu `max_attempts`, hoặc nếu `max_attempts` không phải số nguyên ≥ 1.
- [ ] **AC3.2** — Given cạnh `on_fail` tiến lên phía trước, cạnh tới đích đặc biệt (`blocked`, `ask_user`)
  hoặc cạnh `gate.reject` của gate `human` When chạy `checkGraph` Then cạnh đó có `max_attempts` thì báo lỗi
  (khóa thừa), không có thì không báo lỗi.
- [ ] **AC3.3** — Given 4 file `workflows/*/graph.json` When chạy `npm test` Then mọi cạnh quay ngược thuộc
  diện AC3.1 đều có `max_attempts: 2`, và mọi graph đều qua `checkGraph`. `workflow.graph.template.json` giữ
  nguyên, vì cạnh quay ngược duy nhất của nó là `gate.reject` của gate `human` (được miễn theo AC3.2).
- [ ] **AC3.4** — Given `workflow-output-contract.md` When đọc mục retry Then có luật: mỗi cạnh quay ngược
  được đi tối đa `max_attempts` lần trong một lần chạy workflow; bộ đếm tính riêng cho từng cạnh và không
  reset khi workflow đi tiếp. Lần thứ `max_attempts + 1` cần đi cạnh đó thì Supervisor chuyển sang `ask_user`
  và kèm lý do trượt của từng lượt. Mỗi `WORKFLOW.md` có một dòng trỏ tới luật này.

## Thiết kế

### 1. `agent_result` (contract)

Thêm vào `core/principles/workflow-output-contract.md`, đặt sau mục `## Finding`:

```yaml
agent_result:
  agent: <agent-id>
  status: completed     # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation: [ <evidence> ]
  findings: [ <finding> ]
  questions: []         # câu hỏi cho người dùng/bước gọi; không rỗng thường đi kèm status: blocked
  remaining_risks: []
```

Ở mỗi agent, mục `## Report trả về` giữ nguyên các gạch đầu dòng riêng (oracle trước/sau, ...) và thêm một
dòng ở đầu: trả khối `agent_result` theo contract; các ý dưới đây là nội dung riêng của agent này.

### 2. "Kiểm đầu ra worker" (luật của Supervisor)

Mục mới trong cùng file, chứa các luật nêu ở AC2.1 và AC2.2. Supervisor là session chính. Mỗi lần nhận
`agent_result` từ một worker, session chính áp các luật này trước khi đi `next`.

Có hai tầng retry tách biệt:
- **Đầu ra hỏng** (sai định dạng, thiếu ý): giao lại cho chính worker đó, ngầm định, không khai báo trong
  graph. Nhờ vậy không phải thêm cạnh tự trỏ cho mọi bước có agent. Đây là chỗ duy nhất dùng giá trị mặc
  định 2.
- **Kết quả hợp lệ nhưng không đạt** (`failed`, gate trượt): đi theo cạnh `on_fail` đã khai báo, giới hạn bằng
  `max_attempts` trên cạnh đó.

`blocked` nghĩa là worker cần người quyết, nên không retry.

### 3. Retry có ngưỡng

- Mở rộng `GRAPH_KEYS.onFail` trong `cli/lib/workflows.mjs`: `['to', 'when', 'max_attempts']`.
- `checkGraph` áp luật AC3.1 và AC3.2. "Quay ngược" nghĩa là `n` của đích ≤ `n` của bước hiện tại.
- Cạnh `gate.reject` của gate `human` được miễn, vì người dùng đã ở trong vòng và tự quyết.
- Thêm `max_attempts: 2` vào các cạnh quay ngược trong 4 graph. Template giữ nguyên (xem AC3.3).
- Bộ đếm tính theo từng cạnh và không reset (AC3.4). [Inference] Ví dụ ở bugfix, các vòng chồng nhau
  (`regression → fix`, `review → fix`, `fix → root-cause`): trường hợp xấu nhất vẫn hữu hạn, khoảng vài chục
  lượt worker. Chấp nhận mức đó vì luật đơn giản, model dễ tuân.
- Thêm luật retry vào văn xuôi của contract (AC3.4). Session chính đọc văn xuôi chứ không đọc `graph.json`,
  vì phần thân `WORKFLOW.md` không trỏ tới graph.
- Session chính tự đếm số lượt trong hội thoại; không ghi file state.

### 4. Version

Có thay đổi nội dung được chiếu sang provider, nên phải bump `core/.manifest.json`, `workflows/.manifest.json`
và manifest của từng plugin có agent bị sửa (`backend`, `frontend`, `data`, `engineering`, `ops`). Sau đó chạy
`npm run build` và `node cli/lib/versions.mjs --lock`.

## Ảnh hưởng spec
- workflows: thêm R1, thêm R2, thêm R3

(R1 = `agent_result` bắt buộc cho mọi agent; R2 = luật "Kiểm đầu ra worker"; R3 = retry có ngưỡng
`max_attempts`. Spec `docs/specs/workflows/spec.md` chưa tồn tại và sẽ được tạo ở bước gộp.)

## Ngoài phạm vi và anti-goal

- Ngoài phạm vi: agent Supervisor riêng; Evaluator độc lập cho bước chưa có reviewer phía sau (người dùng
  chốt bỏ, vì luật "Kiểm đầu ra worker" đã đủ để bắt đầu ra mơ hồ hoặc thiếu ý); parse hoặc validate `agent_result` lúc runtime (`aip` không chạy
  agent); state runtime (SQLite/Redis, file đếm lượt); tiêu chí máy kiểm được cho gate `auto` dạng
  `require: [...]`; đổi đầu ra sang JSON thuần.
- Anti-goal: Supervisor hỏi người dùng ngay từ lần trượt đầu (trái với quyết định đã chốt); thêm runtime
  dependency; vòng lặp không có lối ra.

## Ràng buộc

- Zero runtime dependency, chạy trên Node 20+, ESM; mã nguồn UTF-8 không BOM, line ending LF.
- Nội dung skill/agent/contract viết bằng tiếng Việt.
- `checkGraphAgainstBody` phải tiếp tục xanh với văn xuôi hiện có.

## Kiểm thử

- AC2.2: kiểm bằng cách đọc khi review, giống AC2.1.
- AC1.2, AC3.1, AC3.2, AC3.3: contract test ở `test/contract/` (unit, chạy trên source). AC3.1 và AC3.2 viết
  một test có tham số dùng `mut()` của `50-workflows.contract.mjs`.
- AC1.1, AC2.1, AC3.4: kiểm bằng cách đọc khi review; không pin câu chữ (theo quy tắc Testing của baseline).
  Ngoại lệ được phép: kiểm mục `agent_result` có trong contract và có khóa `status`, vì đây là contract vận
  hành.
- Cuối cùng chạy `npm test`.

## Để builder quyết

- Câu chữ chính xác của các luật và của dòng trỏ trong `WORKFLOW.md`.
- Đặt test mới vào file contract sẵn có (`10-source`, `50-workflows`) hay tạo file mới.
- Cách thêm dòng `agent_result` vào 16 agent và vào `agent.template.md` (template cũng phải theo).

## Rủi ro và câu hỏi mở

- [Inference] Model có thể không tuân luật đếm lượt một cách chính xác, vì không có gì cưỡng chế ở runtime.
  Chấp nhận rủi ro này vì không có runtime nào để cưỡng chế.
- Nhánh hiện tại `feature/ci-pin-input-as-data` đang có thay đổi chưa commit, không thuộc request này. Phần
  hiện thực nên làm trên nhánh riêng `feature/supervisor-worker-contract`.
