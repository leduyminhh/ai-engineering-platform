# Cấu trúc feature/requirement spec — viết gì vào mỗi mục

Spec này ở **mức FEATURE**: mô tả tính năng cần gì và đo bằng gì, KHÔNG phân rã thành story/task. Việc chia
story/task chi tiết thuộc bước lập kế hoạch (`plan.md`) hoặc skill triển khai — không làm ở đây.

Bám scaffold `docs/requests/_TEMPLATE/requirement.md` (`Yêu cầu gốc` / `Bối cảnh` / `Ràng buộc` / `Tiêu chí
chấp nhận`) và **mở rộng** nó bằng các mục dưới đây — KHÔNG dựng cấu trúc song song.

## Feature-level granularity (nguyên tắc)

- Một requirement = **một khả năng của tính năng** ("hệ thống cho phép X"), không phải một bước thao tác code.
- Diễn đạt theo **kết quả quan sát được** với actor, không theo giải pháp kỹ thuật ("người dùng lọc đơn theo
  trạng thái", KHÔNG "thêm index vào cột status").
- Nếu một requirement phải kèm nhiều bước triển khai → đó là dấu hiệu đang lấn sang story/plan; giữ requirement
  ở mức khả năng, đẩy bước triển khai xuống `plan.md`.

## Các mục của spec (đặt trong `requirement.md`)

1. **Yêu cầu gốc** — phát biểu nguyên văn/nguồn yêu cầu (giữ mục có sẵn của template).
2. **Bối cảnh / vấn đề** — vì sao cần tính năng này, đau ở đâu, ai bị ảnh hưởng (mở rộng mục `Bối cảnh`).
3. **Mục tiêu & success criteria** — mục tiêu nghiệp vụ + **tiêu chí thành công ĐO ĐƯỢC** (số/tỷ lệ/thời
   gian/điều kiện kiểm được). Phân biệt "mục tiêu" (định hướng) với "success criteria" (đo được).
4. **Phạm vi & Out-of-scope** — nêu rõ **trong phạm vi** và **NGOÀI phạm vi** (điều CHỦ ĐÍCH không làm) để
   chặn scope creep.
5. **Actors / personas (lite)** — ai dùng, vai trò/quyền, mục tiêu của họ. Personas ở mức nhẹ; personas chi
   tiết là artifact FIS (handoff).
6. **Functional requirements (mức FEATURE)** — danh sách khả năng tính năng, mỗi mục truy vết được về
   actor + mục tiêu ở trên. KHÔNG phân rã story.
7. **Non-functional requirements (NFR)** — hiệu năng, bảo mật, khả dụng, khả năng mở rộng, tuân thủ… ở mức
   đo được khi có thể (xem phân biệt bên dưới). Đặt trong mục `Ràng buộc` hoặc mục NFR riêng.
8. **Acceptance criteria** — điều kiện nghiệm thu **đo được** cho tính năng (giữ mục `Tiêu chí chấp nhận` của
   template, viết dạng checkbox).
9. **Điểm chạm data / contract** — dữ liệu tính năng đọc/ghi, API/contract liên quan; **link** tới
   `docs/contracts/` và data-model thay vì chép lại. Nếu chưa có contract → ghi câu hỏi mở.
10. **Rủi ro / giả định / câu hỏi mở** — liệt kê rõ; mọi **[giả định]** và phần chưa chốt để con người quyết.
11. **Quyết định liên quan (ADR)** — link tới ADR ở `docs/decisions/` cho quyết định lớn (xem cách ghi bên dưới).

## Acceptance criteria ĐO ĐƯỢC

- Ưu tiên **Given/When/Then**: *Given* tiền điều kiện — *When* hành động của actor — *Then* kết quả quan sát
  được.
- Nếu không hợp Given/When/Then → dùng **tiêu chí kiểm được**: ngưỡng số, trạng thái đích, điều kiện đúng/sai
  kiểm chứng được.
- Tránh từ mơ hồ ("nhanh", "thân thiện", "ổn định") — thay bằng số/điều kiện ("p95 < 300ms", "0 lỗi validation
  với input hợp lệ").
- Mỗi acceptance criterion nên soi chiếu về một functional/NFR ở trên (truy vết được).

## Functional vs NFR (phân biệt)

- **Functional** = *hệ thống LÀM gì* (khả năng, hành vi, quy tắc nghiệp vụ). Gắn với actor + kết quả.
- **NFR** = *hệ thống TỐT thế nào* (hiệu năng, bảo mật, khả dụng, khả năng bảo trì, tuân thủ). Diễn đạt bằng
  ngưỡng/điều kiện đo được khi có thể; nếu chưa có ngưỡng → ghi thành câu hỏi mở, không bịa con số.

## Link ADR / contract / data-model

- **ADR:** quyết định lớn (chọn phương án, đánh đổi phạm vi, ràng buộc kỹ thuật lớn) → dùng skill
  `engineering-adr` để ghi ADR vào `docs/decisions/`; trong spec chỉ **link** tới ADR, không lặp toàn bộ lý do.
- **Contract / data-model:** link tương đối tới file trong `docs/contracts/` (và data-model của project). Spec
  mô tả *điểm chạm* (đọc/ghi cái gì), contract giữ *chi tiết trường/endpoint* — tránh trùng lặp, tránh drift.
- Khi spec và contract lệch nhau: nêu rõ là câu hỏi mở để con người chốt, không tự sửa contract.

## Map vào `_TEMPLATE` (requirement.md + plan.md)

- **`requirement.md`** giữ 4 heading gốc (`Yêu cầu gốc`, `Bối cảnh`, `Ràng buộc`, `Tiêu chí chấp nhận`) và
  **thêm** các mục 3–11 ở trên dưới heading phù hợp (ví dụ NFR nằm trong `Ràng buộc`; Mục tiêu/Phạm
  vi/Actors/Functional/Điểm chạm data/Rủi ro thêm thành mục mới). Không đổi tên 4 heading gốc.
- **`plan.md`** chỉ dựng **khung** giai đoạn (Phase/Task để trống theo template) — đây là chỗ bước sau phân rã
  story/task; skill này KHÔNG điền chi tiết task.
- Đặt cả hai trong `docs/requests/<yyyy-mm-dd>-<slug>/` (slug ngắn, kebab-case, mô tả tính năng).
