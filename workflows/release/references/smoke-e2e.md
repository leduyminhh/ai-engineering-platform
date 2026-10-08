# Smoke e2e tuỳ chọn — workflow-release

Chỉ áp dụng ở Bước 5 khi project có `e2e/`. Gate, Ràng buộc và Khi fail của Bước 5 trong `WORKFLOW.md` vẫn áp dụng
nguyên văn.

`frontend-e2e-test-writer` chạy 1–3 luồng e2e giá trị cao **đã có** trên bản release candidate (commit release
Bước 4) chạy ở local/test, `npx playwright test` theo skill `frontend-e2e-testing` [lệnh cụ thể theo project];
không viết test mới, không sửa test; thiếu môi trường BE/DB test → `not_run` + lý do. Chế độ smoke: luồng lấy từ
e2e đã có (hoặc người dùng chỉ định trong Bước 5) — bỏ qua E2/E3; flaky → chạy lại `--repeat-each=3`, không sửa
test; vẫn flaky → báo `failed`, dừng release.
