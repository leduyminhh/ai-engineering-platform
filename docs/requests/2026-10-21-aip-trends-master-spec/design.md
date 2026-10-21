# Thiết kế: spec tổng lộ trình chuẩn hóa aip theo 9 xu hướng
- Ngày: 2026-10-21
- Trạng thái: đã duyệt 2026-10-21
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)

## Vấn đề và lý do

Lộ trình chuẩn hóa aip theo 9 xu hướng AI coding (chốt 2026-10-20) không có tài liệu gốc trong repo. Nó chỉ nằm ở memory cá nhân và phiên brainstorm cũ; các design con chỉ có một dòng "Thuộc lộ trình" và chỉ 3 trong 9 xu hướng được nêu số (3, 4, 7). Hệ quả:

- Không trả lời được "đã phủ xu hướng nào, còn hở đâu" nếu không đọc lại phiên cũ.
- Trạng thái các design lệch thực tế: `long-session-context` ghi "chờ merge" dù đã merge `aadc6c2`; `model-session-routing` và `workflow-graph` không ghi commit merge; việc hoãn của `verification-gate` (Task 6, I-2) chỉ có trong memory.

Spec này là điểm duy nhất ghi lộ trình, và đồng thời dọn trạng thái các design hiện có cho khớp với git.

## Quyết định đã chốt

Của người dùng (2026-10-21): "dọn trạng thái các design và gom một chỗ trace lộ trình". Từ các quyết định ngày 2026-10-20, giữ nguyên:

- Claude Code là provider chính, provider khác best-effort. Superpowers là quy trình chính.
- aip chỉ chuẩn hóa và phân phối (zero-dep, không tự chạy agent). Chạy tự động là runner ở repo riêng.
- Mỗi thay đổi một thư mục `docs/requests/<yyyy-mm-dd>-<slug>/`.

## Thiết kế

### 1. Chín xu hướng (nguồn: phiên brainstorm 2026-10-20)

Số liệu thị phần/khảo sát của từng nguồn không chép vào đây; [Unverified] chúng do nguồn tự công bố và chưa được kiểm lại.

| # | Xu hướng |
|---|---|
| 1 | Agent thay autocomplete/chat |
| 2 | Thị trường dồn về vài tool |
| 3 | Từ vibe coding sang agentic engineering |
| 4 | Spec-driven development |
| 5 | Context engineering và chuẩn mở |
| 6 | Agent chạy nền, nhiều agent song song |
| 7 | Chỗ tắc chuyển sang kiểm chứng |
| 8 | Agent thành lỗ hổng chuỗi cung ứng |
| 9 | Tính phí theo mức dùng |

### 2. Trace xu hướng → project → trạng thái

Trạng thái "xong" lấy từ merge commit trong git log và memory; AC của P1b và P1 đã được kiểm lại ở Task 3 (commit `aa8276e`), các project còn lại chưa kiểm lại AC trong code.

| # | Đã làm | Còn hở |
|---|---|---|
| 1 | không có khoảng trống lớn | — |
| 2 | quyết định Claude first | — |
| 3 | P1 | — |
| 4 | P1, P2a, P7 | AC kiểm thủ công cho `--strict` (I-2) |
| 5 | P1b, P5b, P7 | kiểm theo agentskills.io; cấu hình MCP; rule theo đường dẫn file |
| 6 | chưa | P3 |
| 7 | P2a, P2b | Task 6 (smoke hook Stop + eval); quy tắc review PR do agent tạo; eval trong CI |
| 8 | hook guard, `writeScope`, `allowEnvFiles` | P4: hook chỉ có ở plugin mode, quy tắc agent trong CI, kiểm skill bên thứ ba |
| 9 | P5a | theo dõi chi phí (`aip stats` mới đo context) |

### 3. Chỉ mục project

Đánh số P5a/P5b là **quyết định của tôi** (người dùng chưa duyệt): hai việc này làm sau khi lộ trình ngày 2026-10-20 được đặt; P5a (theo dõi chi phí) gán vào xu hướng 9, P5b (xử lý phiên dài/context) gán vào xu hướng 5.

| Project | Slug / vị trí | Trạng thái | Merge |
|---|---|---|---|
| 1b | `2026-10-20-artifact-templates` | xong | `c337dbc` |
| 1 | `2026-10-20-superpowers-docs-standard` | xong | `6913753` |
| 2a | `2026-10-20-verification-gate` | xong một phần: Task 6 hoãn | `dabc13f` |
| 2b | `2026-10-20-workflow-graph` | xong | `bb24f03` |
| 5a | `2026-10-21-model-session-routing` | xong | `4cb06ab` |
| 5b | `2026-10-21-long-session-context` | xong | `aadc6c2` (docs sync `9f31280`) |
| 3 | agent song song / worktree | chưa brainstorm | — |
| 4 | MCP + permission trong adapter | chưa brainstorm | — |
| 5c | theo dõi chi phí | chưa brainstorm | — |
| 6 | runner LangGraph (repo riêng) | chưa brainstorm; tiền đề 2b đã có | — |
| 7 | `2026-10-21-living-spec` | xong | `d774be4` |

Thứ tự đề xuất cho phần còn lại: giữ thứ tự cũ (6 → 3 → 4 → 5c). [Đoán] 4 có thể nên lên trước 6 vì runner chạy agent không người giám sát; để người dùng quyết ở "Câu hỏi mở".

### 4. Dọn trạng thái các design

| Design | Sửa |
|---|---|
| `long-session-context` | "đã hiện thực, chờ merge" → "đã duyệt và thực thi; merge `aadc6c2`" |
| `model-session-routing` | thêm "merge `4cb06ab`" |
| `workflow-graph` | thêm "merge `bb24f03`" |
| `verification-gate` | thêm "merge `dabc13f`"; ghi Task 6 và I-2 là việc hoãn, trỏ về mục 5 của spec này |
| `artifact-templates`, `superpowers-docs-standard` | giữ nguyên header (đã đúng); tick AC thật có bằng chứng, AC không kiểm được giữ `[ ]` kèm `[chưa kiểm]` |
| `long-session-context` (plan) | tick step đã thực hiện theo commit trong git |
| tất cả design con | dòng "Thuộc lộ trình" trỏ tới spec này, ghi mã project (P1b, P1, P2a, P2b, P5a, P5b) |

Chỉ sửa header, dòng lộ trình và ký tự checkbox; không đổi nội dung kỹ thuật hay AC của design con.

### 5. Việc hoãn đang mở

- 2a Task 6: smoke hook Stop + eval thật (~0,5 USD/case, chạy tay). Hoãn vì `claude` CLI trong sandbox Bash báo "Not logged in".
- 2a I-2: cách đánh dấu AC kiểm thủ công để `--strict` bỏ qua W7. Chờ người dùng quyết.
- Backlog (chỉ tham khảo, từ memory): key passthrough → `metadata` theo namespace; org defaults nhiều lớp; agent server headless làm động cơ runner; agent Maintenance/Docs sync; đa repo.

### 6. P7 — spec sống (xong, merge `d774be4`)

Vấn đề: mỗi request chỉ có `design.md` + `plan.md` và là bộ nhớ ngắn hạn; sau merge, hành vi của một năng lực rải trong nhiều design cũ. Gốc là quyết định của P1 (superpowers sinh đúng hai file; aip không sửa plugin). Hướng giải: **giữ superpowers nguyên, aip chỉ thêm spec sống**, tác động qua baseline, template và validator.

Đã duyệt (người dùng, 2026-10-21): hướng trên và danh sách dưới. Các mục đánh dấu "tôi chọn" là đề xuất được duyệt cùng.

- Spec sống: `docs/specs/<năng-lực>/spec.md`, mỗi năng lực một file, sửa tại chỗ khi request đổi hành vi. Khung gồm mục đích, yêu cầu có ID ổn định `<năng-lực>/R<n>`, link tới request đã thêm hoặc đổi (tôi chọn: ID khác `AC<n>.<m>` vì AC chỉ có nghĩa trong một request).
- Cầu nối: `design.md` có thêm mục `## Ảnh hưởng spec` (năng lực, thêm/đổi/bỏ, ID yêu cầu; hoặc "không ảnh hưởng" kèm lý do).
- Gộp vào spec sống: bước cuối trước merge, ghi trong baseline; không tạo skill mới; template `spec.template.md` đặt trong `artifact-templates` (tôi chọn: core là phần duy nhất ship qua npm).
- Kiểm: `check-request.mjs` cảnh báo khi `design.md` thiếu mục "Ảnh hưởng spec" hoặc nêu spec không tồn tại; vẫn chỉ cảnh báo, `--strict` cho CI. Kiểm "spec đã sửa trong diff" cần git, để lại cho thiết kế chi tiết.
- Khởi tạo: không viết lại các request cũ; spec sống của một năng lực tạo khi request kế tiếp chạm tới nó (tôi chọn). `aip init --full` tạo sẵn `docs/specs/`.
- Không làm: đưa `tasks.md` lại luồng; bắt `requirement.md`; spec-as-source (sinh code từ spec).

Thiết kế chi tiết và hiện thực nằm ở [`../2026-10-21-living-spec/design.md`](../2026-10-21-living-spec/design.md).

## Ảnh hưởng spec
Không ảnh hưởng: spec tổng chỉ trace lộ trình, chưa có spec sống nào trong docs/specs.

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given thư mục `docs/requests/2026-10-21-aip-trends-master-spec/`, When đọc `design.md`, Then có đủ 9 xu hướng và mỗi xu hướng có ít nhất một dòng trace tới project hoặc ghi "không có khoảng trống".
- [x] **AC2.1** — Given mỗi design con có trạng thái "xong", When đối chiếu với `git log --merges`, Then header ghi đúng commit merge của nó.
- [x] **AC3.1** — Given 6 design trong `docs/requests/`, When đọc dòng "Thuộc lộ trình", Then mỗi cái trỏ tới spec tổng và có mã project.
- [x] **AC4.1** — Given thay đổi chỉ chạm tài liệu, When chạy `npm test`, Then xanh; không file nào ngoài `docs/` bị đổi.
- [x] **AC5.1** — Given `artifact-templates` và `superpowers-docs-standard`, When đối chiếu checkbox AC trong design và plan, Then mỗi AC thật được tick `[x]` khi có bằng chứng chạy được, và AC không kiểm được giữ `[ ]` kèm `[chưa kiểm]`.
- [x] **AC5.2** — Given plan của `long-session-context`, When đối chiếu với `git log`, Then step đã thực hiện được tick `[x]` theo commit trong git.

## Ngoài phạm vi và anti-goal

- Không thiết kế hay hiện thực project 3, 4, 5c, 6; mỗi cái brainstorm riêng. P7 đã có design và hiện thực riêng (mục 6).
- Không viết lại nội dung kỹ thuật, AC hay quyết định của design con.
- Không bump version plugin (không đổi nội dung được chiếu).
- Anti-goal: spec tổng thành một bản sao thứ hai của memory. Memory chỉ giữ con trỏ tới spec, không lặp bảng trạng thái.
- Không cập nhật memory cá nhân trong repo; việc đó làm riêng sau khi spec được duyệt.

## Ràng buộc

- Tiếng Việt có dấu, UTF-8 không BOM, LF.
- Làm trên nhánh `feature/<slug>`, commit qua `core:git-workflow`, dừng cho người dùng duyệt diff trước khi commit (AGENTS.md).
- Không push; không đụng master.

## Kiểm thử

Chỉ tài liệu: AC1.1–AC3.1 và AC5.1–AC5.2 kiểm bằng đọc đối chiếu; AC4.1 bằng `npm test`. Không viết test mới.

## Để builder quyết

- Có chạy `check-request.mjs` lên thư mục spec này không, tùy nó có áp được cho spec không có `plan.md`/`tasks.md`.
- Định dạng chính xác dòng trạng thái khi thêm commit merge, bám các design đã đúng (`artifact-templates`).

## Rủi ro và câu hỏi mở

- [Unverified] Cột "Đã làm" dựa vào merge commit và memory; chưa kiểm AC từng project trong code.
- Bốn dấu tick dựa trên đối chiếu ý định tại thời điểm merge hoặc suy từ plan, không phải lệnh chạy hôm nay: artifact-templates AC1.1 (tại `c337dbc` `references/` có đúng 9 mục; nay thêm handoff và graph JSON); docs-standard AC2.1 (đường dẫn `templates/init/docs/requests/_TEMPLATE/` không tồn tại tại `6913753`, design chuyển sang sinh từ core — bằng chứng nay: `cli/lib/templates.mjs`, `test/init.test.mjs`); docs-standard AC5.1 (tại `6913753` `docs/superpowers/` còn nguyên; sau đó xóa có chủ đích ở `c201ec9`); các bước "xác nhận đỏ" trong plan của long-session-context (tick theo task, không tái hiện được trạng thái đỏ). Nếu muốn đọc nghiêm, hoàn lại bốn mục này về `[ ]` kèm `[chưa kiểm]`.
- Câu hỏi mở 1: thứ tự phần còn lại có đổi (4 trước 6) không?
- Câu hỏi mở 2: cách đánh số P5a/P5b/P5c có chấp nhận không?
- Câu hỏi mở 3: I-2 và Task 6 giữ là việc hoãn, hay chốt hẳn một hướng?
