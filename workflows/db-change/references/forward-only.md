# Công cụ forward-only — workflow-db-change

Chỉ áp dụng ở Bước 6 khi công cụ migration của project là forward-only (vd Flyway theo hướng forward-only).
Gate, Ràng buộc và Khi fail của Bước 6 trong `WORKFLOW.md` vẫn áp dụng nguyên văn.

Chạy (a)(b)(c) theo `references/change/verify-cycle.md` của skill `data-db-migration`, rồi thêm lượt kiểm SQL bù
(migration bù của công cụ forward-only) do workflow bổ sung: áp đúng nguyên văn đoạn SQL trong report Bước 3,
không viết lại hay sửa tay, lên DB đã xác nhận ở Bước 5, rồi kiểm schema/dữ liệu sau từng lượt; nếu report
Bước 3 chưa có SQL bù cho thay đổi này thì quay lại Bước 2 bổ sung kế hoạch rồi Bước 3, không tự bịa SQL bù.
