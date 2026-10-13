# Release checklist — tiền / hậu deploy

Mỗi mục là tiêu chí **đo được**: chỉ đánh dấu **đạt** khi đã kiểm được bằng chứng (lệnh + kết quả, ID
backup, link thông báo…). Chưa kiểm → ghi **chưa đạt** (fail-loud), KHÔNG coi là "xong". Không tuyên bố
"đảm bảo an toàn"; checklist giảm rủi ro chứ không loại bỏ.

## Tiền deploy (trước khi triển khai)

### 1. Sẵn sàng artifact
- [ ] Build/test/lint **xanh** trên đúng commit/tag sẽ phát hành (nêu lệnh + kết quả).
- [ ] Version / artifact / image tag đã **chốt** và khớp scope release (không phải `latest` mơ hồ).
- [ ] Changelog / release note tóm tắt thay đổi + rủi ro đã có.

### 2. Migration & dữ liệu
- [ ] Liệt kê migration schema nằm trong phạm vi release (thư mục migration của project, so với tag trước),
      hoặc ghi "không có migration". Migration nào đã áp trên môi trường đích do người dùng xác nhận, không tự suy.
- [ ] Thứ tự migration ↔ deploy rõ ràng: migration tương thích ngược chạy trước khi deploy code mới; migration phá
      tương thích chỉ chạy sau khi code cũ đã ngừng dùng. Mỗi migration **đảo được** (hoặc có kế hoạch forward-fix).
- [ ] Dữ liệu lớn / khoá bảng: đã ước lượng thời gian + tác động; có phương án ngoài giờ cao điểm.

### 3. Backup & điểm rollback
- [ ] **Điểm khôi phục** đã sẵn: version/artifact trước đó còn deploy lại được (nêu tag/ID cụ thể).
- [ ] Backup dữ liệu (nếu release đụng schema/dữ liệu) đã tạo + **verify khôi phục được** (nêu ID/thời điểm).

### 4. Cấu hình & secret
- [ ] Biến môi trường / config cho môi trường đích đã đủ; **secret qua secret store / env**, chỉ nêu **tên
      biến**, KHÔNG hardcode, KHÔNG in giá trị.
- [ ] Khác biệt config staging vs prod đã rà (endpoint, quota, flag).

### 5. Thông báo & cửa sổ triển khai
- [ ] Bên liên quan (on-call, QA, product) đã được **thông báo** thời điểm + phạm vi + kế hoạch rollback.
- [ ] Cửa sổ triển khai + người **duyệt production** đã xác nhận.

### 6. Feature flag
- [ ] Phần rủi ro cao được bọc **feature flag** (tắt nhanh không cần redeploy) khi khả thi.

### 7. Smoke e2e trước deploy (tuỳ chọn, chỉ khi project có `e2e/`)
- [ ] Chạy 1–3 luồng e2e giá trị cao **đã có** trên đúng commit/tag sẽ phát hành, chỉ ở local/test (không trỏ
      staging/production), theo skill `frontend-e2e-testing` (agent `frontend-e2e-test-writer` khi có). Không viết
      test mới, không sửa test.
- [ ] Kết quả: pass, hoặc `not_run` + lý do (vd thiếu môi trường BE/DB test) ghi vào rủi ro còn lại. Flaky → chạy
      lại `--repeat-each=3`; vẫn flaky = `failed`. Đỏ vì hành vi sai hoặc `failed` → KHÔNG deploy, đề xuất
      `workflow-bugfix`.

## Hậu deploy (sau khi triển khai)

- [ ] **Health-check** qua: health endpoint OK, error rate / latency / saturation trong ngưỡng (nêu số).
- [ ] **Smoke test** các luồng nghiệp vụ chính đạt (nêu danh sách + kết quả).
- [ ] Theo dõi thêm một khoảng (nêu thời lượng) — không có tăng bất thường lỗi/log.
- [ ] Thông báo **kết quả** cho bên liên quan; cập nhật trạng thái release.
- [ ] Ghi lại: version đã phát hành, thay đổi chính, quyết định, và **điểm rollback** vẫn còn hiệu lực.
- [ ] Feature flag: đóng/mở theo kế hoạch; dọn flag tạm sau khi ổn định (ghi lại để làm sau).

## Residual risk (luôn nêu)
- Phần **chưa verify được** (vd tải thật khác staging, dữ liệu prod khác mẫu).
- Cửa sổ theo dõi còn lại; giả định `[giả định]` về môi trường/hạ tầng khi thiếu dữ liệu.
