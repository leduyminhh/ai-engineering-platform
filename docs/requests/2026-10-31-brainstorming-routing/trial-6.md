# Lượt thử 6: brainstorming và định tuyến theo brief

- Ngày: 2026-11-01
- Nhánh: `feature/brainstorming-routing`, nội dung đã commit tới `05487b9`
- Cách thử: ba subagent `general-purpose` (sonnet) đọc nguồn trong repo và đóng cả hai vai (agent làm đúng từng bước của skill, người dùng theo kịch bản); `check-request.mjs`, `route.mjs`, `route.mjs --exclude` và `route.mjs --log` chạy thật; phần orchestrator và workflow chỉ đọc văn bản rồi mô phỏng.
- Giới hạn: **không có người dùng thật** trả lời thẻ, nên chưa kiểm cách người dùng phản ứng với thẻ gom câu hỏi, thẻ duyệt hay dòng bỏ qua phần hỏi [Unverified]. Builder check phải tự đọc vì subagent con không tạo được [Unverified về độ độc lập]. Transcript đầy đủ nằm ở `.aip/trial6/p1..p3/transcript.md` (git bỏ qua) kèm `brief.md` của từng vấn đề.

## Ba vấn đề thử

| # | Vấn đề | Kịch bản người dùng | Route kỳ vọng | `route.mjs` thật trả |
|---|---|---|---|---|
| 1 | Feature: xuất báo cáo doanh thu theo tháng ra CSV (Spring Boot + React) | trả lời đủ thẻ | `workflow-feature` | `workflow-feature`, `confidence: high`, điểm 7 |
| 2 | Quyết định về cách ghi lại kết luận sau họp, không code | "Bỏ qua phần hỏi, bạn tự quyết" | `engineering-adr` | `engineering-adr` (kind `skill`), `high`, điểm 7 |
| 3 | Nghiên cứu: có nên chuyển dịch vụ nội bộ từ REST sang gRPC, chưa cần code | trả lời đủ thẻ, đồng ý cho đọc web (mô phỏng, không truy cập web) | chưa có quy trình | `chosen: null`, `confidence: none`, `reason` "chưa có quy trình phù hợp…" |

## Kết quả theo AC

| AC | Kết quả | Bằng chứng |
|---|---|---|
| AC1.1 | Đạt [mô phỏng] | Cả ba vấn đề: lượt đầu có dòng bỏ qua phần hỏi, một thẻ gom 6–8 câu kèm đáp án khuyến nghị, đúng một câu mở, chưa ghi file nào. Vấn đề 2 và 3 không phải code. |
| AC1.2 | Đạt, có lưu ý [mô phỏng] | `brief.md` đúng template, khối `## Định tuyến` đủ khoá, một builder check, một thẻ duyệt. Lưu ý: builder check cũng là một lần hỏi (không phải cổng); `check-request.mjs` chỉ bắt lỗi cấu trúc thư mục, không kiểm nội dung brief (đã sửa lời trong skill: tự soát, `route.mjs` báo giá trị sai). |
| AC1.3 | Đạt [mô phỏng] | Vấn đề 2: sau lời bỏ qua agent không hỏi thêm câu nào (kể cả builder check), tự chọn hướng, ghi 7 điểm vào mục "Quyết định của agent" và nêu lại ở thẻ duyệt. |
| AC2.1–AC2.3 | Đạt (chạy thật) | Ba kết quả `route.mjs` ở bảng trên với bảng Registry thật. |
| AC3.1 | Đạt [mô phỏng] | Vấn đề 1: orchestrator nhận brief đã duyệt, chạy route đã duyệt, Risk của Registry là `medium` nên bỏ qua xác nhận, không hỏi lại lần nào. Vấn đề 2: route kind `skill` dừng ở Bước 1 không hỏi lại. |
| AC3.2 | Đạt có điều kiện [mô phỏng] | Vấn đề 1 giả định giao nhầm `workflow-bugfix`: workflow trả `status: misrouted` qua tiêu chí sau baseline; orchestrator quay lại Bước 1 với `--exclude workflow-bugfix` (chạy thật) và route kế mang cùng brief. Lỗ hổng tìm thấy: Ràng buộc chặn tiêu chí theo brief khi `route-đã-duyệt` trùng workflow, và "mâu thuẫn rõ" chưa có ví dụ (đã sửa, xem dưới). |
| AC4.1 | Đạt một phần [mô phỏng] | Feature Bước 2 bỏ qua mục tiêu, phạm vi, quyết định của agent, chỉ còn 2 câu; danh sách bỏ qua chưa nhắc "hướng đã chốt" (đã thêm cùng mục "Hướng đã cân nhắc" vào template). |
| AC5.1 | Đạt (chạy thật) | `route.mjs --log` trong thư mục tạm ghi đúng một dòng `{ts, brief, chosen, overridden, misrouted}` ở vấn đề 1 (`workflow-feature`) và vấn đề 3 (`chosen: null`). Lỗ hổng: nhật ký không tạo `.aip/.gitignore` (đã sửa, có test). |
| AC6.1 | Đạt | Feature → `workflow-feature`, quyết định → `engineering-adr`, nghiên cứu → "chưa có quy trình". Ghi chú: AC viết "quyết định quy trình không code" nhưng tập đóng có cả `quyết-định` và `quy-trình`; đã định nghĩa: `quyết-định` là chọn phương án kiến trúc hoặc thiết kế cần ADR (route `engineering-adr`), `quy-trình` là cách làm việc của nhóm (chưa có route nên ra "chưa có quy trình"). Vấn đề 2 được phân loại `quyết-định`. |

## Lỗ hổng tìm thấy và xử lý

Đã sửa trong nhánh (commit `3c02e75`, `05487b9` và các commit review):

- major: `route.mjs --log` không tạo `.aip/.gitignore` → tạo, có test.
- major: "hỏi nơi lưu brief" mâu thuẫn với lối thoát "bỏ qua phần hỏi" → đã bỏ qua phần hỏi thì lưu ở `.aip/runs/brainstorm-<slug>/brief.md` và ghi là quyết định của agent; câu hỏi nơi lưu đưa vào thẻ ở lượt hỏi đầu.
- major: template brief thiếu chỗ cho hướng đã chọn và hướng bị loại → mục "Hướng đã cân nhắc"; feature Bước 2 nhắc "hướng đã cân nhắc" trong phần bỏ qua.
- major: `check-request.mjs` không kiểm brief mà skill coi "0 cảnh báo" là bằng chứng → skill ghi lại là tự soát brief theo template, `route.mjs` báo giá trị sai.
- major: tiêu chí `misrouted` khi `route-đã-duyệt` trùng workflow mơ hồ → thêm ví dụ "mâu thuẫn rõ" cho từng workflow; ngoại lệ not_run mở rộng cho misrouted sau baseline.
- minor đã sửa: phân biệt `quyết-định` với `quy-trình`; route `chưa-có-quy-trình` không gọi orchestrator; đáp án khuyến nghị cho dữ kiện chưa biết đánh dấu `[giả định]`; "trừ câu mở" cho quy tắc đáp án khuyến nghị; mô tả mục "Quyết định của agent"; Report cuối của workflow có `misrouted`; bỏ qua phần hỏi thì không đi xem thêm.

Còn mở (minor, không chặn, để lượt sau):

- Vấn đề đã rõ loại nhưng chưa rõ cách làm (feature) vẫn đi hết brainstorm; ranh giới giữa brainstorming và cổng "đủ thông tin" của spec-writing chưa sắc.
- Trước thẻ duyệt có thể có tới 3–4 lượt hỏi (thẻ đầu, builder check, playback, đề xuất hướng); chưa đo số lượt thật với người dùng thật.
- `route-đã-duyệt` cũ không được cập nhật khi người dùng chấp nhận route dự phòng sau `misrouted` (lần gọi orchestrator sau sẽ chọn lại route đã trượt).
- Builder check tự đọc mất tính độc lập, fallback chưa nêu cách giảm nhẹ; chưa có xác nhận một dòng ngay sau lời "bỏ qua".
- Nhạy cảm với cwd: nạp context nền giả định cwd là repo của việc; việc ngoài repo hiện tại dùng nơi lưu `.aip/runs/brainstorm-<slug>/`.
- Gợi ý tách task cho mọi việc fullstack ở feature Bước 2; cổng "đủ thông tin" nghiêng về code.
- `ứng-viên-route` chỉ có tác dụng với id có trong hai bảng orchestrator.

## Kết luận

Ba vấn đề tới đúng route hoặc "chưa có quy trình" bằng `route.mjs` chạy thật; phần hội thoại, thẻ duyệt, orchestrator và workflow chỉ được mô phỏng bằng đọc văn bản nên cần một lượt thử có người dùng thật trước khi coi hành vi đã kiểm chứng.
