---
name: ops-deploy-release
description: "Skill vận hành (plugin ops) hướng dẫn deploy/release một service lên server MỘT CÁCH AN TOÀN: (1) nạp context + dò cấu hình deploy/CI/CD của project và chốt scope release (version/artifact/service, môi trường staging/prod); (2) chuẩn bị + chạy checklist tiền deploy (build/test/migration sẵn sàng, backup + điểm rollback, thông báo, feature flag); (3) chọn chiến lược triển khai phù hợp (rolling / blue-green / canary) kèm tiêu chí tiến/lùi; (4) triển khai theo cấu hình project + health-check, KHÔNG tự chạy lệnh deploy/rollback prod — trình bày lệnh/kế hoạch, chờ người xác nhận; (5) verify hậu deploy theo health/metric/smoke test, rollback theo chiến lược đã chọn khi vượt ngưỡng; (6) đóng checklist hậu deploy + nêu residual risk. Đọc Dockerfile/compose/k8s manifest/CI pipeline/script release làm ràng buộc, KHÔNG dựng lại hạ tầng, KHÔNG lộ secret (token qua biến môi trường, mask trong log). Dùng skill NÀY khi người dùng muốn \"deploy\", \"release\", \"phát hành\", \"triển khai lên server\", \"rollback\", \"release checklist\", \"canary\", \"blue-green\", \"rolling update\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần; con người DUYỆT trước mọi tác động production."
order: 1
title: "Deploy / Release an toàn — checklist tiền/hậu deploy, chiến lược triển khai, health-check + rollback"
runsIn: execute
invoke: per-request
---

# Deploy / Release (capability ops)

Điều phối một vòng **deploy/release an toàn** cho một service: chuẩn bị + **checklist tiền/hậu deploy**,
**chọn chiến lược triển khai** (rolling / blue-green / canary), **health-check + tiêu chí rollback**, và
**rollback** khi cần. Skill này là **hướng dẫn cách agent chuẩn bị và điều phối deploy** (docs-only recipe),
KHÔNG phải script CI/CD, cũng KHÔNG phải công cụ codegen.

Nguyên tắc trung tâm: **an toàn production là trên hết**. Agent **ĐỌC** cấu hình deploy/CI/CD + quy trình
release của project làm ràng buộc, rồi **trình bày kế hoạch + lệnh cụ thể**; **KHÔNG tự deploy/rollback
production khi chưa có xác nhận** — con người giữ chốt và duyệt trước mọi tác động lên môi trường chạy thật.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần triển khai/phát hành.

## Khi nào dùng

- Người dùng muốn deploy / release / phát hành / triển khai một service lên server (staging hoặc prod).
- Cần lập **release checklist**, chọn **chiến lược triển khai** (rolling / blue-green / canary), hay xác định
  **tiêu chí health-check + rollback**.
- Cần **rollback** một release đang có vấn đề về đúng phiên bản/điểm khôi phục đã chuẩn bị.

KHÔNG dùng skill này để dựng lại hạ tầng/CI từ đầu, sửa cấu hình pipeline ngoài scope, hay tự ý tác động
production mà không có xác nhận.

## Ranh giới an toàn

- **KHÔNG tự thực thi deploy/rollback production.** Trình bày **kế hoạch + lệnh cụ thể**, chờ người xác nhận
  rõ ràng rồi mới để người thực thi (hoặc thực thi khi được xác nhận đúng scope). Xem
  [references/deploy-safety.md](references/deploy-safety.md).
- **KHÔNG lệnh phá huỷ** (xoá dữ liệu, drop/reset, force-push, đổi schema không thể đảo, restart hàng loạt)
  khi chưa xác nhận và chưa có điểm khôi phục.
- **KHÔNG** nhập/in/log token/secret; secret đi qua **biến môi trường / secret store**, skill chỉ nêu **tên
  biến**; **mask** mọi giá trị secret trong log/report.
- **Scope-bound.** Chỉ triển khai đúng **version/artifact/service + môi trường** người dùng nêu; KHÔNG đụng
  service anh em hay môi trường khác. Không sửa cấu hình CI/hạ tầng ngoài phạm vi.
- Ngôn ngữ **đo được** (ngưỡng health/metric, tiêu chí tiến/lùi kiểm được); LUÔN nêu **residual risk**.
  KHÔNG tuyên bố "đảm bảo / loại bỏ / chặn triệt để" — kế hoạch phản ánh dữ liệu tại thời điểm làm, môi
  trường thật có thể khác; nêu `[giả định]` khi suy luận thiếu dữ liệu.

## Quy trình — deploy / release

0. **Nạp context + dò cấu hình (BẮT BUỘC — trước khi triển khai).**
   Đọc `CLAUDE.md` / project-knowledge để nắm **ranh giới an toàn** + quy trình release. Dò cấu hình deploy/CI:
   `Dockerfile`, `docker-compose*.yml`, **k8s manifest** (Deployment/Service/Ingress), **CI pipeline**
   (`.github/workflows`, `.gitlab-ci.yml`, Jenkinsfile…), **script release** có sẵn. Xác định **môi trường**
   (staging / prod) và **biến env chứa secret** (chỉ nêu **tên biến**, không đọc giá trị). **Chốt scope
   release:** version / artifact / service cụ thể. Thiếu cấu hình → nói rõ (fail-loud), đề nghị người cung cấp
   thay vì tự bịa.

1. **Chuẩn bị & checklist tiền deploy.**
   Chạy [references/release-checklist.md](references/release-checklist.md): build/test/lint xanh, **migration**
   sẵn sàng và đảo được, **backup + điểm rollback** đã có, **thông báo** bên liên quan, **feature flag** cho
   phần rủi ro. Mỗi mục là tiêu chí **đo được** (đạt / chưa đạt), không đánh dấu "xong" khi chưa kiểm.

2. **Chọn chiến lược triển khai.**
   Theo [references/rollback-strategies.md](references/rollback-strategies.md): chọn **rolling / blue-green /
   canary** theo đặc điểm service (khả năng chạy song song nhiều version, tài nguyên, mức rủi ro), kèm **tiêu
   chí tiến/lùi** rõ ràng cho từng bước.

3. **Triển khai (theo cấu hình project) + health-check.**
   Chuẩn bị lệnh/kế hoạch triển khai bám đúng cấu hình đã dò ở bước 0. **KHÔNG tự chạy lệnh deploy prod** —
   nêu **lệnh cụ thể + thứ tự bước + điểm health-check**, chờ người xác nhận rồi mới để người thực thi (chi
   tiết ranh giới: [references/deploy-safety.md](references/deploy-safety.md)). Với staging có thể thực thi khi
   được xác nhận, vẫn health-check sau mỗi bước.

4. **Verify hậu deploy + tiêu chí rollback.**
   Kiểm **health endpoint / metric (error rate, latency, saturation) / smoke test** theo ngưỡng đã đặt. Nếu
   **vượt ngưỡng** → **rollback** theo chiến lược đã chọn ở bước 2 (về version/điểm khôi phục đã chuẩn bị), cũng
   **chờ xác nhận** trước khi rollback prod. Ghi lại kết quả đo được (đạt/không đạt từng tiêu chí).

5. **Hậu deploy: đóng checklist + residual risk.**
   Chạy phần hậu deploy của [references/release-checklist.md](references/release-checklist.md): theo dõi thêm một
   khoảng, thông báo kết quả, ghi lại version + thay đổi + quyết định. Nêu **residual risk**: phần chưa verify
   được, cửa sổ theo dõi còn lại, giả định về môi trường thật.

## Verification (trước khi báo hoàn thành)

- Đã dò cấu hình deploy/CI, **chốt scope release** (version/artifact/service + môi trường), nêu rõ nguồn cấu hình.
- Checklist tiền deploy đã chạy; mỗi mục có trạng thái **đo được** (đạt/chưa đạt), phần chưa đạt báo rõ.
- Đã **chọn chiến lược** + nêu **tiêu chí tiến/lùi** và **ngưỡng health/metric** cụ thể.
- Với production: đã **trình bày kế hoạch + lệnh** và **có xác nhận của người** trước khi thực thi; không tự
  deploy/rollback prod; không lệnh phá huỷ; không secret nào lọt ra (đã mask).
- Có mục **Residual risk**; ngôn ngữ đo được, không tuyên bố tuyệt đối; phần bỏ qua/không verify được báo rõ.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/release-checklist.md](references/release-checklist.md): checklist **tiền/hậu deploy** đo được
  (build/test/migration/backup/thông báo/feature flag + theo dõi/ghi lại sau deploy).
- [references/rollback-strategies.md](references/rollback-strategies.md): **rolling / blue-green / canary** —
  khi nào dùng, tài nguyên cần, **tiêu chí tiến/lùi**, và cách **rollback** cho từng chiến lược.
- [references/deploy-safety.md](references/deploy-safety.md): **ranh giới an toàn** — không tự deploy/rollback
  prod, không secret, không lệnh phá huỷ, scope-bound, con người duyệt; mẫu trình bày kế hoạch chờ xác nhận.
