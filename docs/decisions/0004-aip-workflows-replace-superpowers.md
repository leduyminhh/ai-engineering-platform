# ADR-0004: Workflow aip thay superpowers làm quy trình chính

- Trạng thái: Proposed (2026-10-26) — chủ repo chốt Status sau khi duyệt diff nhánh và kết quả P6
- Ngày: 2026-10-26

Nguồn quyết định: chủ repo yêu cầu chỉ dùng workflow aip, lấy điểm mạnh của superpowers đưa vào aip rồi bỏ superpowers (phiên 2026-10-23, ghi ở mục "Quyết định đã chốt" của design).

Liên kết:
- Thiết kế: [`2026-10-23-workflow-self-sufficient/design.md`](../requests/2026-10-23-workflow-self-sufficient/design.md); kế hoạch: [`plan.md`](../requests/2026-10-23-workflow-self-sufficient/plan.md); bằng chứng so sánh hai bên: [`research/`](../requests/2026-10-23-workflow-self-sufficient/research/).
- Đảo quyết định cũ: [`2026-10-22-parallel-agents/design.md`](../requests/2026-10-22-parallel-agents/design.md), mục "Quyết định đã chốt" ghi "superpowers là quy trình chính, aip không sửa plugin superpowers".
- Không đổi [ADR-0002](0002-model-and-session-routing.md) (tầng model) và [ADR-0003](0003-long-session-context.md) (ngân sách context); ngân sách của hook `session-start` được chia chung cho handoff và ledger (xem Hệ quả).

## Bối cảnh

- Có hai đường cho cùng một việc: `workflow-feature`/`workflow-bugfix` của aip và luồng superpowers (`brainstorming` → `writing-plans` → `subagent-driven-development`). Hai workflow aip tự nhường chỗ khi superpowers đã cài, nên trên máy của chủ repo chúng không bao giờ chạy.
- Hệ quả là điểm mạnh riêng của aip không được dùng: baseline đo trước, agent domain có `writeScope`, khoá phạm vi file bằng git, contract-first, `agent_result`.
- So sánh toàn văn hai bên (superpowers 7.0.0 và nội dung aip, có `file:line`) cho thấy: `workflow-feature` thiếu bước làm rõ/design và bước plan; chạy theo giai đoạn thay vì theo task nên không review từng task; không có ledger tiến độ nên sau compact dễ mất dấu; `workflow-bugfix` đã mạnh hơn `systematic-debugging` ở 10 điểm nhưng thiếu 5 kỹ thuật điều tra và giới hạn tổng số lần sửa.
- Một lần chấm điểm workflow trước đó còn tìm thấy vòng lặp không giới hạn trong thân workflow, `workflow-security-review` không review code của bản sửa và `workflow-performance` không đo baseline build/test.
- Quyết định cũ (2026-10-22) chốt superpowers là quy trình chính và coi nó nằm ngoài phạm vi sửa của aip; quyết định này đảo lại nửa đầu của câu đó.

## Các lựa chọn đã cân nhắc

1. **A. Giữ superpowers làm quy trình chính, aip chỉ cung cấp skill và agent.**
   - Ưu: không phải viết thêm; superpowers đã được dùng thật.
   - Nhược: hai workflow aip vẫn chết trên máy chủ repo; quy trình nằm ngoài kiểm soát và ngoài test của repo; điểm mạnh của aip vẫn không được dùng.
2. **B. Workflow aip gọi skill superpowers lúc chạy.**
   - Ưu: tái dùng nội dung đã có, ít viết hơn A.
   - Nhược: workflow phụ thuộc một plugin ngoài bộ (không có trong gói npm, đổi phiên bản là đổi hành vi); `workflow-feature` và `workflow-bugfix` phải giữ nhánh "có/không có superpowers"; đúng điều design xếp vào anti-goal.
3. **C. Hấp thụ điểm mạnh của superpowers vào skill, agent và workflow của aip rồi bỏ hẳn superpowers — chọn.**
   - Ưu: một đường duy nhất, nằm trong bộ có test và version gate; giữ được điểm mạnh riêng của aip; không phụ thuộc plugin ngoài.
   - Nhược: tốn công viết và kiểm chứng; mất nội dung mà superpowers bảo trì hộ; phải tránh chép nguyên văn (MIT, © 2025 Jesse Vincent) nên chỉ tóm ý và viết lại bằng tiếng Việt.

## Quyết định

Chọn C. Cụ thể:
- `workflow-feature` có 7 bước: Baseline → Làm rõ & cỡ việc ⏸ → Tài liệu ⏸ → Plan ⏸ → Vòng task → Review cuối → Kết thúc nhánh ⏸. Vòng task chạy từng task: ghi BASE, giao agent domain theo `kind`, review task, sửa tối đa 3 vòng (vòng 3 agent mới chạy opus), commit, ghi ledger.
- Skill core mới `plan-execution` (giao thức vòng task, ledger, `Ruling:`, review cuối, kết thúc nhánh, 3 script Node zero-dep) và skill `engineering-plan-writing` (plan có `**Kind:**`, `**Interfaces:**`, Review Focus); `engineering-spec-writing` chuyển phần làm rõ về session chính.
- `workflow-bugfix` thêm kỹ thuật điều tra và tổng 3 lần sửa thất bại thì `ask_user`; mọi workflow bỏ vòng lặp không giới hạn.
- Gỡ mọi tham chiếu `superpowers:*` khỏi nguồn; baseline mặc định trỏ tới workflow aip.
- Điều kiện kiểm chứng trước khi coi quyết định là xong (P6): chạy workflow mới trên một feature thật và eval `workflows` đạt (cả 3 case có điểm với plugin ≥ không plugin, ít nhất 2 case Δ > 0); không đạt thì không bỏ superpowers mà quay lại chỉnh nội dung. Status chuyển sang Accepted chỉ sau bước này, do chủ repo chốt.

## Hệ quả

- Hai workflow `workflow-feature`/`workflow-bugfix` chạy được trên máy có hay không có superpowers; không còn nhánh "nhường chỗ".
- Baseline `AGENTS.md` mục `Workflow defaults` thay mục mặc định superpowers; project cài aip nhận quy trình mới qua managed block. Docs location và Memory and resume trỏ tới skill aip, ledger là `docs/requests/<ngày>-<slug>/.sdd/progress.md`.
- `check-request.mjs` thêm W17/W18 (task trong `plan.md` thiếu `**Kind:**` hoặc `kind` ngoài tập 8 giá trị).
- Hook `session-start` nạp thêm đuôi ledger chưa xong (tối đa 2000 ký tự, tắt bằng `ledgerInject: false`). Lệch có chủ đích so với đề xuất ban đầu của design (D6: ledger không chiếm giới hạn của handoff): ledger và handoff chia chung ngân sách 9000 ký tự vì trần 10.000 của Claude Code ghi trong chính hook, vượt có thể làm hỏng cả khối; handoff chỉ ngắn hơn khi có ledger.
- Vòng task tốn thêm một reviewer cho mỗi task; chi phí thật chỉ biết sau P6 [Inference].
- Số 3 vòng sửa/task và tổng 3 lần sửa ở bugfix chưa đo [Inference]; điều chỉnh sau eval.
- Các request cũ vẫn nhắc superpowers (`docs/requests/`, CHANGELOG) giữ nguyên làm lịch sử; đường dẫn thư mục request có chữ "superpowers" không đổi tên để không gãy liên kết.
- Chủ repo vẫn dùng superpowers để phát triển P1–P5; chỉ P6 chạy bằng workflow mới.
