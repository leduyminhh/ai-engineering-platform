# Phía frontend — workflow-performance

Chi tiết riêng phía FE cho các bước đo. Chỉ áp dụng khi phạm vi có phía FE theo Bước 1; Gate, Ràng buộc và
Khi fail của từng bước trong `WORKFLOW.md` vẫn áp dụng nguyên văn.

## Bước 2 — Baseline

Agent `frontend-performance-analyst` chốt bảng điều kiện đo theo skill `frontend-performance`, build và phục vụ
bản build production ở local (không đo trên dev server), chạy Lighthouse/đo bundle ≥ 3 lần, ghi median
LCP/TBT/CLS, kích thước bundle và độ lệch; số lab, không phải INP; thư mục output build (dist/.next/…) không
tính vào gate diff khi đã nằm trong `.gitignore`, chưa bị ignore → agent trả `blocked` + câu hỏi.

## Bước 3 — Profile & giả thuyết

Agent profile theo thứ tự bundle → render (React Profiler) → main thread (trace), dùng lại bảng điều kiện của
Bước 2, nêu bottleneck + giả thuyết kèm evidence (số đo, `file:line` hoặc tên chunk/component), đề xuất danh
sách file/hàm cho phần FE của Bước 4; lệnh/config bật profiler ghi vào report Bước 3, config chỉ dùng để
profile thì gỡ sau khi profile xong (không để lại trong diff); output build profile (`dist-profile/`) xoá sau
khi profile hoặc đã nằm trong `.gitignore`, chưa bị ignore → agent trả `blocked` + câu hỏi.

## Bước 5 — Benchmark & so sánh

Agent build lại bản build production và phục vụ lại từ working tree, xác nhận là bản mới (hash file build hoặc
tên chunk khác baseline) trước khi đo, rồi chạy lại đúng script + bảng điều kiện của Bước 2 (≥ 3 lần), lập
bảng baseline vs sau; thư mục output build (dist/.next/…) không tính vào gate diff khi đã nằm trong
`.gitignore`, chưa bị ignore → agent trả `blocked` + câu hỏi.
