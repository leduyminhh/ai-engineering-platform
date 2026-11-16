# ADR-0006: Phiên gốc tự mở phiên part khi `partRunner: session`

- Trạng thái: Proposed (2026-11-10) — chủ repo chốt Status sau khi duyệt diff nhánh `fix/plan-execution-root-routing`
- Ngày: 2026-11-10

Nguồn quyết định: chạy thử request chia part cho thấy người dùng phải nhắn "Tự mở 3 phiên đi" thì phiên gốc mới mở phiên part; người dùng chốt đảo quyết định cũ.

Liên kết:
- Đảo quyết định cũ: [`2026-10-30-request-parts-aip-workspace/design.md`](../requests/2026-10-30-request-parts-aip-workspace/design.md), mục "Chế độ part" ("aip không tự mở phiên hay agent") và mục Validator (cùng câu). Design đó giữ nguyên; ADR này trỏ ngược.
- Quy tắc hiện hành: `core/skills/plan-execution/references/task-loop.md`, mục "Chế độ part" bước 3, 6, 7 và 10.

## Bối cảnh

- Với `partRunner: session`, phiên gốc chỉ in khối bàn giao rồi chờ người dùng dán vào phiên mới. Phiên gốc dừng ở mỗi bước chuyển (mở phiên, mở nhóm kế) và không đi tiếp cho tới khi người dùng nhắn.
- Công cụ `start_session` của app Claude Code cho phép phiên gốc tự mở phiên. [Unverified] Ràng buộc của app: chỉ gọi được trong lượt của người dùng, hoặc trong chuỗi `<side-sessions-event>` ngay sau lượt đó; lượt do `SendMessage` của phiên part hay sự kiện tự động khác khởi động bị từ chối.

## Các lựa chọn đã cân nhắc

1. **A. Giữ nguyên: phiên gốc chỉ in khối bàn giao, người dùng dán.**
   - Ưu: không phụ thuộc công cụ của app; không có phiên nào mở ngoài ý người dùng.
   - Nhược: người dùng phải nhắn tay ở mỗi nhóm; phiên gốc đứng chờ.
2. **B. Phiên gốc tự mở phiên part trong lượt cho phép, từ chối thì đưa thẻ một lần bấm — chọn.**
   - Ưu: nhóm đầu mở ngay trong lượt người dùng trả lời; nhóm sau chỉ tốn một lần bấm khi app từ chối.
   - Nhược: phụ thuộc hành vi của app [Unverified]; thêm phiên do agent mở.
3. **C. Chạy part bằng subagent nền cho mọi request.**
   - Ưu: không cần phiên riêng.
   - Nhược: không có review từng task trong part; đã có sẵn thành khoá `partRunner: subagent`, không thay thế được `session`.

## Quyết định

Chọn B, với phạm vi:
- Chỉ khi `partRunner: session` và người dùng đã chọn phiên riêng; câu trả lời cách chạy và sự đồng ý worktree/merge local áp cho mọi nhóm của request.
- Chỉ gọi `start_session` trong lượt cho phép: nhóm đầu trong lượt người dùng trả lời; nhóm sau thử gọi, bị từ chối thì đưa đúng một thẻ hoặc lựa chọn một lần bấm, không hỏi lại cách chạy, không đứng im.
- Thứ tự: đặt `đang làm`, tạo worktree, dựng khối bàn giao rồi mới `start_session`, khối đó làm brief.
- Không nới permission mode: phiên mở ra không cao hơn phiên gốc; app không cho đặt thì để mặc định.
- Sau merge, phiên gốc archive phiên part idle nó đã mở rồi mới dọn worktree; không archive được thì để dọn cuối ở `finish.md`.

## Hệ quả

- Câu "aip không tự mở phiên hay agent" không còn đúng với `partRunner: session`; pin test đổi theo.
- Phiên gốc đọc lại Bảng part và ledger mỗi lần được đánh thức rồi tự chọn bước kế.
- Nếu app đổi ràng buộc của `start_session`, đường lui (in khối bàn giao để dán) vẫn dùng được.
- Hành vi của app chưa kiểm chứng ngoài lần chạy thử [Unverified]; Status chuyển Accepted sau khi chủ repo duyệt.
