# Thiết kế: workflow graph máy đọc được (project 2b)
- Ngày: 2026-10-20
- Trạng thái: **Đã duyệt và thực thi** — merge vào `master` = `bb24f03` (2026-10-21).
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P2b (xu hướng 7). Tiền đề cho runner (project 6, repo riêng).
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)

## Vấn đề và lý do

- 4 workflow pipeline (`bugfix`, `feature`, `security-review`, `performance`; 34 bước) chỉ có cấu trúc trong văn xuôi: thứ tự bước ngầm định theo số, chỗ quay lại nằm trong câu "quay lại Bước N" ở trường **Khi fail** (18 chỗ), checkpoint người duyệt là ký tự ⏸ cuối tên bước.
- Máy (runner LangGraph ở project 6, hoặc contract test ở repo này) không đọc chắc chắn được: bước nào đi tiếp đâu, fail thì về đâu, bước nào dừng chờ người, ai chạy bước. Một số chỗ còn mơ hồ ngay trong văn xuôi (vd bugfix Bước 9 "quay lại bước tương ứng").
- `cli/lib/workflows.mjs` hiện chỉ kiểm khung (heading, 8 trường, ⏸, anchor) và trích agent/skill của bước; không có mô hình đồ thị để kiểm reachability.

## Quyết định đã chốt

Của người dùng:
- Làm 2b sau 2a, "đề xuất & thực hiện" (2026-10-20).
- Từ lộ trình: aip chỉ chuẩn hóa và phân phối, zero-dep, không tự chạy agent; Claude Code là provider chính; runner là repo riêng.

Của người viết thiết kế (người dùng kiểm khi đọc):
- D1. Mỗi workflow có thêm file nguồn `workflows/<slug>/graph.json` cạnh `WORKFLOW.md`. JSON (không YAML) vì parser frontmatter tự viết không đọc cấu trúc lồng; `JSON.parse` có sẵn.
- D2. `WORKFLOW.md` vẫn là chỉ dẫn cho agent; `graph.json` là cấu trúc cho máy. Hai bên được **contract test đối chiếu** (số bước, tên bước, ⏸ ↔ gate người, agent/skill của trường **Thực hiện**, mọi "quay lại Bước N" có cạnh tương ứng). Không sinh văn xuôi từ JSON, không sinh JSON từ văn xuôi: đối chiếu hai chiều rẻ hơn và không phá nội dung đang chạy.
- D3. Đồ thị có vòng (fail quay lại bước trước), nên mô hình là cạnh `next` + `on_fail`, không phải DAG `depends_on`. Song song (∥) nằm **trong** một bước (`parallel: true` + danh sách agent), không tách thành nhánh đồ thị — khớp cách workflow đang viết.
- D4. Hai đích đặc biệt thay cho số bước: `ask_user` (dừng hỏi người dùng; người dùng trả lời rồi chỉ định bước chạy tiếp, mặc định chạy lại chính bước đó) và `blocked` (kết thúc, báo người dùng). Kết thúc thành công là `done`. Bốn bước commit ⏸ đang ghi "quay lại bước tương ứng" được sửa thành "quay lại bước người dùng chỉ định" và có `reject: "ask_user"` — không đổi hành vi, chỉ gọi đúng tên.
- D5. Gate người (bước ⏸) mô tả theo kiểu interrupt/resume: `review` (người duyệt xem gì, lấy từ bảng Checkpoint), `approve` → đích đi tiếp, `reject` → đích quay về. Bất biến: `approve` bằng `next`; `reject` là một đích có trong `on_fail` (cùng một cạnh, không phải cạnh thứ hai). Bước không ⏸ có `gate.type = "auto"`.
- D9. `on_fail` là danh sách cạnh không thứ tự; `when` là văn bản để agent/runner chọn cạnh, không phải biểu thức. Đối chiếu văn xuôi (AC2.4): cạnh tới bước N cần câu "quay lại Bước N" hoặc "quay về Bước N" trong **Khi fail** của bước đó; cạnh tới `blocked` cần chữ `blocked` hoặc "dừng"; cạnh tới `ask_user` cần chữ "hỏi" hoặc "người dùng chỉ định". Chiều ngược chỉ áp cho "quay lại/quay về Bước N" — các chỗ nhắc "Bước N" khác (vd "ghi bổ sung vào Đầu ra Bước 5") không phải cạnh.
- D10. `run` giữ điều kiện và thứ tự của trường **Thực hiện** dưới dạng văn bản: `run.session` (bool), `run.agents[]` và `run.skills[]`, mỗi phần tử là id hoặc `{ "id", "when"?, "after"? }` (`when` = điều kiện như "chỉ khi phạm vi có API", `after` = id agent/skill phải xong trước). `run.parallel = true` khi văn xuôi có ∥; phần tử có `after` không chạy song song với phần tử nó chờ. Một bước có cả agent lẫn skill được biểu diễn trực tiếp.
- D6. Chỉ 4 workflow pipeline có graph; orchestrator không có (nó là bộ định tuyến, registry của nó đã máy đọc được qua `parseRegistry`).
- D7. Ship `graph.json` cạnh `SKILL.md` của workflow ở build Claude và Codex (cơ chế asset file của stage đang có), để runner đọc từ bản đã cài. Đổi nội dung chiếu → bump `workflows` (và plugin khác nếu lock đòi).
- D8. Ngoài phạm vi: lệnh CLI mới (`aip graph`), sinh Mermaid, runner. Chỉ thêm helper thuần trong `cli/lib/workflows.mjs` + contract test.

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given `workflows/<slug>/graph.json` của 4 workflow pipeline, Then mỗi file hợp lệ theo schema §1: `schema: 1`, `workflow` trùng `name` trong frontmatter, `start` là id của bước 1, mỗi bước có `id` (kebab-case, duy nhất), `n`, `title`, `run`, `next`, `on_fail`, `gate`.
- [x] **AC1.2** — Given một graph, Then mọi đích (`next`, `on_fail[].to`, `gate.approve`, `gate.reject`) là id bước có thật hoặc `done`/`blocked`/`ask_user`; sai → lỗi nêu bước và đích.
- [x] **AC1.3** — Given một graph, Then mọi bước tới được từ `start`, và từ mọi bước tới được `done` (không ngõ cụt, không bước mồ côi).
- [x] **AC2.1** — Given `WORKFLOW.md` và `graph.json` cùng workflow, Then số bước và thứ tự `n` khớp `parseSteps`; `title` khớp tên bước (bỏ ⏸).
- [x] **AC2.2** — Given bước có ⏸ trong `WORKFLOW.md`, Then `gate.type = "human"` có `review`, `approve`, `reject`; bước không ⏸ có `gate.type = "auto"`. Lệch hai chiều → lỗi.
- [x] **AC2.3** — Given trường **Thực hiện** của bước, Then tập id trong `run.agents` và `run.skills` bằng đúng tập `stepRefs` trích được; "session chính" ↔ `run.session = true`; có ∥ ↔ `run.parallel = true`; mọi `after` trỏ tới id cùng bước.
- [x] **AC2.4** — Given trường **Khi fail** của bước k chứa "quay lại Bước N" hoặc "quay về Bước N", Then `on_fail` của bước k có cạnh tới bước N. Mỗi cạnh `on_fail` phải có bằng chứng trong **Khi fail** theo D9 (bước N / `blocked`-"dừng" / "hỏi"-"người dùng chỉ định"); thiếu → lỗi (đồ thị không được tự thêm hành vi).
- [x] **AC2.5** — Given 4 bước commit đang ghi "quay lại bước tương ứng", Then sửa thành "quay lại bước người dùng chỉ định" và graph có `reject: "ask_user"`; chỗ mơ hồ khác phát hiện khi viết graph được sửa theo cùng cách và liệt kê ở plan.
- [x] **AC3.1** — Given `npm run build`, Then `build/claude/plugins/workflows/skills/<id>/graph.json` và bản Codex tương ứng tồn tại, giống byte-for-byte nguồn; cursor/antigravity không có.
- [x] **AC3.2** — Given template workflow (`core/skills/artifact-templates/references/workflow.template.md`) và CLAUDE.md mục "New workflow", Then có hướng dẫn tạo `graph.json` kèm workflow mới; có template `graph.template.json` (hoặc khối mẫu) trong `artifact-templates`; contract fail nếu workflow pipeline thiếu `graph.json`.
- [x] **AC4.1** — `npm test` xanh; bump `workflows` (và `core` vì template đổi, cộng plugin khác nếu lock đòi); `plugins/_versions.lock.json` cập nhật.

## Thiết kế

### §1. Schema `graph.json` (v1)

```json
{
  "schema": 1,
  "workflow": "workflow-bugfix",
  "start": "baseline",
  "steps": [
    {
      "id": "baseline", "n": 1, "title": "Baseline build/test",
      "run": { "session": true },
      "next": "context",
      "on_fail": [ { "to": "blocked", "when": "build đỏ hoặc test đỏ ngoài vùng bug" } ],
      "gate": { "type": "auto" }
    },
    {
      "id": "reproduce", "n": 3, "title": "Tái hiện",
      "run": { "agents": [ { "id": "backend-test-writer", "when": "chỉ phía có lỗi theo Bước 2" }, { "id": "frontend-test-writer", "when": "chỉ phía có lỗi theo Bước 2" } ], "parallel": true },
      "next": "evidence",
      "on_fail": [ { "to": "context", "when": "không tái hiện được" }, { "to": "ask_user", "when": "hỏi người dùng bước tái hiện chính xác hơn" } ],
      "gate": { "type": "auto" }
    },
    {
      "id": "root-cause", "n": 5, "title": "Root cause",
      "run": { "session": true },
      "next": "fix",
      "on_fail": [ { "to": "evidence", "when": "người dùng không đồng ý root cause" } ],
      "gate": { "type": "human", "review": "Giải thích root cause + evidence trích dẫn", "approve": "fix", "reject": "evidence" }
    }
  ]
}
```

- `run`: theo D10; id như trong backtick của trường **Thực hiện**. Ví dụ bước có cả skill lẫn agent tuần tự: `{ "agents": [ { "id": "backend-implementer" }, { "id": "frontend-data-integrator", "after": "backend-implementer" } ], "skills": [ { "id": "backend-api-contract", "when": "chỉ khi phạm vi có API" } ] }`.
- `when`: câu ngắn tiếng Việt lấy từ **Khi fail**; chỉ để người/runner đọc, không phải biểu thức.
- Không có `inputs`/`outputs` ở v1: trường **Đầu vào**/**Đầu ra** là văn xuôi gắn evidence, chưa có nhu cầu máy đọc cụ thể; runner (project 6) sẽ nói cần gì, khi đó lên `schema: 2`.

### §2. Helper và contract

- `cli/lib/workflows.mjs` thêm hàm thuần: `checkGraph(graph) → string[]` (AC1.1–AC1.3), `checkGraphAgainstBody(graph, text) → string[]` (AC2.1–AC2.4). Không đọc đĩa, giống các helper hiện có.
- Trích "quay lại Bước N" từ trường **Khi fail** theo cách `stepRefs` trích trường **Thực hiện** (gom dòng tiếp nối tới bullet cột 0 kế).
- `cli/lib/plugins.mjs` `loadWorkflows()` đọc thêm `graph.json` nếu có, gắn vào stage (`stage.graph`, và đường dẫn để adapter ship như file asset).
- Contract mới trong `test/contract/50-workflows.contract.mjs`: unit cho 2 helper (một test tham số hoá nhiều graph lỗi), rồi chạy cả 2 helper trên 4 workflow thật; kiểm build ship (AC3.1).

### §3. Viết graph cho 4 workflow

- Đọc từng bước; id kebab-case tiếng Anh ngắn theo việc của bước (`baseline`, `reproduce`, `root-cause`, `fix`, `regression`, `review`, `commit`…).
- `on_fail` dịch từ **Khi fail** + bảng "Xử lý lỗi & rollback"; chỗ văn xuôi mơ hồ thì sửa văn xuôi trước (AC2.5).
- Bước cuối (commit ⏸): `approve: "done"`.

## Ngoài phạm vi và anti-goal

Ngoài phạm vi: runner; lệnh CLI hay sơ đồ Mermaid; graph cho orchestrator; `inputs`/`outputs` máy đọc; đổi nội dung nghiệp vụ của workflow ngoài các chỗ mơ hồ ở AC2.5.

Anti-goal:
- Graph và văn xuôi lệch nhau mà test vẫn xanh (AC2.x phải bắt được lệch hai chiều).
- Graph thêm hành vi không có trong văn xuôi (agent đọc `WORKFLOW.md` sẽ làm khác runner đọc `graph.json`).
- Viết workflow mới thành việc nặng: template + lỗi contract phải chỉ rõ thiếu gì.

## Ràng buộc

- Zero-dep, Node 20+ ESM; UTF-8 không BOM, LF; comment tiếng Việt chỉ nêu *vì sao*.
- Không đổi khung 8 trường và các anchor `WF_ANCHORS` hiện có.
- Đổi nội dung chiếu → bump version plugin sở hữu + `versions.mjs --lock`.

## Kiểm thử

| AC | Tầng | Ở đâu |
|---|---|---|
| AC1.1–AC1.3, AC2.1–AC2.4 | unit helper thuần + chạy trên 4 workflow thật | `test/contract/50-workflows.contract.mjs` |
| AC2.5 | đọc lại văn xuôi đã sửa (review), pin nếu cần | plan |
| AC3.1 | contract build | `test/contract/50-workflows.contract.mjs` |
| AC3.2 | contract "workflow pipeline phải có graph.json" + template qua validator | `50-workflows`, `35-artifact-templates` |
| AC4.1 | `npm test` | — |

## Để builder quyết

- Tên id cụ thể của từng bước.
- Cách trích "quay lại Bước N" (regex) miễn bắt đủ 18 chỗ hiện có và các biến thể "quay lại Bước 4/5".
- Khối mẫu graph đặt ở file `graph.template.json` riêng hay trong `workflow.template.md`.

## Rủi ro và câu hỏi mở

Rủi ro:
- Schema v1 có thể không đủ cho runner (project 6) → chấp nhận lên `schema: 2`; v1 cố ý tối thiểu.
- Đối chiếu văn xuôi ↔ graph dựa trên mẫu câu ở D9; người viết diễn đạt khác sẽ khiến cạnh có thật bị báo thiếu bằng chứng (lỗi to, dễ sửa) chứ không lọt im lặng.
- `when`/`after` là văn bản: runner không tự đánh giá điều kiện, agent điều phối vẫn phải đọc; graph chỉ bảo đảm không mất thông tin.

Câu hỏi mở: không còn.
