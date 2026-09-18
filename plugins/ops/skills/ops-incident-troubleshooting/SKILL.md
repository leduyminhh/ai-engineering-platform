---
name: ops-incident-troubleshooting
description: "Skill vận hành (plugin ops) hướng dẫn TRIAGE & ĐIỀU TRA sự cố production một cách an toàn: (1) nạp context + chốt phạm vi sự cố (triệu chứng, thời điểm bắt đầu, blast radius, service/môi trường ảnh hưởng) và dò nguồn tín hiệu (log/metric/trace/dashboard, health endpoint); (2) khoanh vùng theo tầng (edge/LB → app → DB → dependency ngoài → infra/tài nguyên) dựa trên thời điểm bắt đầu + thay đổi gần đây (deploy/config); (3) đọc log/metric/trace theo tầng, tương quan timeline, lọc nhiễu, mask secret; (4) đặt 1 giả thuyết rõ → kiểm chứng bằng bằng chứng cụ thể (log line/metric), loại trừ dần, phân biệt bằng chứng chắc vs nghi ngờ; (5) đề XUẤT mitigation tạm (rollback deploy nghi ngờ, scale, feature flag, circuit breaker) — KHÔNG tự thực thi trên prod, nêu rủi ro mỗi phương án; (6) RCA đo được (triệu chứng/timeline/nguyên nhân gốc/khắc phục/phòng ngừa) + residual risk. Read-only + ĐỀ XUẤT là mặc định: KHÔNG tự sửa/khởi động lại/rollback/đụng prod khi chưa xác nhận; KHÔNG lộ secret (mask trong log/output). Dùng skill NÀY khi người dùng muốn \"điều tra sự cố\", \"incident\", \"prod lỗi\", \"server down\", \"điều tra lỗi production\", \"triage\", \"RCA\", \"đọc log lỗi\", \"500 error\", \"service chậm\", \"khoanh vùng lỗi\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần; con người DUYỆT trước mọi tác động production."
order: 2
stageNumber: "02"
title: "Incident troubleshooting — triage, khoanh vùng theo tầng, giả thuyết → kiểm chứng, mitigation đề xuất + RCA"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Incident troubleshooting (capability ops)

Điều phối một vòng **triage & điều tra sự cố production**: chốt phạm vi sự cố, **khoanh vùng theo tầng**,
**đọc log/metric/trace** để tương quan timeline, đặt **giả thuyết → kiểm chứng bằng bằng chứng**, rồi
**ĐỀ XUẤT mitigation tạm** và viết **RCA đo được**. Skill này là **hướng dẫn cách agent điều tra**
(docs-only recipe), KHÔNG phải công cụ giám sát, KHÔNG phải script tự sửa, cũng KHÔNG phải codegen.

Nguyên tắc trung tâm: **read-only + đề xuất là mặc định**. Agent **QUAN SÁT** (log/metric/trace) rồi
**trình bày giả thuyết + bằng chứng + phương án**; **KHÔNG tự sửa / khởi động lại / rollback / đụng
production khi chưa có xác nhận** — con người giữ chốt và quyết mọi hành động lên môi trường chạy thật.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần điều tra sự cố.

## Khi nào dùng

- Có sự cố production: service **down / chậm / lỗi 5xx**, error rate tăng, latency cao, hàng đợi ứ, out-of-memory.
- Cần **triage** nhanh: khoanh vùng triệu chứng về **tầng nghi ngờ**, xác định blast radius, tìm thay đổi gần đây.
- Cần **đọc log/metric/trace** để tương quan timeline và **đặt giả thuyết → kiểm chứng** nguyên nhân.
- Cần **RCA** (root cause analysis) sau sự cố: dòng thời gian, nguyên nhân gốc, hành động khắc phục đo được.

KHÔNG dùng skill này để tự ý tác động production (restart/scale/rollback), sửa cấu hình ngoài scope, hay
kết luận nguyên nhân từ một tín hiệu đơn lẻ chưa kiểm chứng.

## Ranh giới an toàn

- **KHÔNG tự tác động production.** Điều tra ở chế độ **read-only**; mọi mitigation (restart, scale,
  rollback, đổi flag) chỉ **ĐỀ XUẤT** kèm rủi ro, chờ người xác nhận rõ ràng rồi mới để người thực thi.
  Xem [references/triage-workflow.md](references/triage-workflow.md).
- **KHÔNG lệnh phá huỷ** (xoá dữ liệu, drop/reset, force-push, restart hàng loạt, đổi schema) khi điều tra;
  quan sát không được làm thay đổi trạng thái hệ thống.
- **KHÔNG** nhập/in/log token/secret; khi đọc log/metric phải **mask** giá trị nhạy cảm (token, mật khẩu,
  connection string, PII) trước khi đưa vào output; chỉ nêu **tên biến/khoá**, không đọc giá trị secret.
- **Scope-bound.** Chỉ điều tra đúng **service + môi trường** trong phạm vi sự cố người dùng nêu; KHÔNG lan
  sang service anh em hay môi trường khác trừ khi tương quan cho thấy liên đới (và nêu rõ lý do).
- Ngôn ngữ **đo được** (số liệu log/metric, ngưỡng, thời điểm cụ thể); phân biệt **bằng chứng chắc** vs
  **nghi ngờ**; LUÔN nêu **residual risk**. KHÔNG tuyên bố "đảm bảo / loại bỏ / chặn triệt để" — kết luận
  phản ánh dữ liệu quan sát được tại thời điểm điều tra; nêu `[giả định]` khi suy luận thiếu dữ liệu.

## Luồng điều tra sự cố

0. **Nạp context + chốt phạm vi (BẮT BUỘC — trước khi điều tra).**
   Đọc `CLAUDE.md` / project-knowledge để nắm **ranh giới an toàn** + kiến trúc service. **Chốt phạm vi
   sự cố:** triệu chứng cụ thể, **thời điểm bắt đầu**, blast radius (bao nhiêu %/user/region), service +
   môi trường ảnh hưởng. Dò **nguồn tín hiệu**: log (app/access/error), metric/dashboard, trace, health
   endpoint. Nêu **tên biến env** nếu cần để truy nguồn, KHÔNG đọc giá trị secret. Thiếu tín hiệu/quyền
   truy cập → nói rõ (fail-loud), đề nghị người cung cấp thay vì suy diễn.

1. **Khoanh vùng theo tầng.**
   Theo [references/triage-workflow.md](references/triage-workflow.md): thu hẹp từ triệu chứng → **tầng
   nghi ngờ** (edge/LB, app, DB, dependency ngoài, infra/tài nguyên), dùng **thời điểm bắt đầu** đối chiếu
   **thay đổi gần đây** (deploy/config/scale/traffic). Loại nhanh tầng không khớp timeline.

2. **Đọc tín hiệu.**
   Theo [references/log-metric-reading.md](references/log-metric-reading.md): đọc **log/metric/trace theo
   tầng** đã khoanh, **tương quan timeline** (khớp mốc lỗi với mốc thay đổi), **lọc nhiễu** (lỗi thứ cấp,
   log lặp), **mask secret**. Không kết luận từ một tín hiệu đơn lẻ — cần ít nhất hai nguồn khớp nhau.

3. **Giả thuyết → kiểm chứng.**
   Đặt **1 giả thuyết rõ** ("X gây Y vì Z"), rồi **kiểm bằng bằng chứng cụ thể** (log line, số liệu metric,
   trace span) — bằng chứng **ủng hộ** hay **bác bỏ**. **Loại trừ dần**; phân biệt **bằng chứng chắc**
   (đo được, tái lập được) vs **nghi ngờ** (tương quan chưa chứng minh nhân quả). Sai giả thuyết → quay lại
   bước 1/2 với dữ liệu mới, không cố ép kết luận.

4. **Mitigation tạm (ĐỀ XUẤT — chờ xác nhận).**
   Nêu phương án **giảm thiểu** khả dĩ: **rollback deploy nghi ngờ**, **scale** tài nguyên, bật/tắt
   **feature flag**, **circuit breaker** cho dependency lỗi. Mỗi phương án nêu **rủi ro + điều kiện áp dụng
   + cách kiểm tra sau khi áp**. **KHÔNG tự thực thi trên prod** — trình bày lệnh/kế hoạch, chờ người xác
   nhận (chi tiết ranh giới: [references/triage-workflow.md](references/triage-workflow.md)). Khi người
   dùng cần THỰC THI rollback theo một chiến lược cụ thể (rolling/blue-green/canary) → route sang
   `ops-deploy-release` (skill này chỉ dừng ở mức đề xuất, không đi sâu cách rollback).

5. **RCA + hành động khắc phục.**
   Theo [references/rca-template.md](references/rca-template.md): **nguyên nhân gốc** (phân biệt trigger vs
   root cause), **dòng thời gian** (bắt đầu → phát hiện → giảm thiểu → khôi phục), **hành động khắc phục**
   đo được (ai/gì/khi nào kiểm được), và **residual risk** (phần chưa verify, giả định, khả năng tái diễn).

## Verification (trước khi báo hoàn thành)

- Đã **chốt phạm vi sự cố** (triệu chứng, thời điểm bắt đầu, blast radius, service/môi trường) và nêu rõ
  nguồn tín hiệu đã dùng (log/metric/trace/dashboard); thiếu nguồn/quyền báo rõ (fail-loud).
- Đã **khoanh vùng theo tầng** + đối chiếu **thay đổi gần đây**; loại trừ có nêu lý do.
- Mỗi kết luận có **bằng chứng cụ thể** (log line/metric/trace) đi kèm; phân biệt **bằng chứng chắc vs
  nghi ngờ**; không kết luận từ tín hiệu đơn lẻ.
- Mitigation chỉ **ĐỀ XUẤT** kèm rủi ro; **không tự tác động prod** (restart/scale/rollback) khi chưa xác
  nhận; không lệnh phá huỷ; không secret nào lọt ra (đã mask).
- Có mục **RCA** + **Residual risk**; ngôn ngữ đo được, không tuyên bố tuyệt đối; phần chưa verify báo rõ.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/triage-workflow.md](references/triage-workflow.md): quy trình **khoanh vùng theo tầng**
  (edge/LB → app → DB → dependency → infra), tận dụng **thời điểm bắt đầu + thay đổi gần đây**, và ranh
  giới **read-only + đề xuất** cho mitigation.
- [references/log-metric-reading.md](references/log-metric-reading.md): cách **đọc log/metric/trace theo
  tầng**, **tương quan timeline**, **lọc nhiễu**, **mask secret**, và vì sao không kết luận từ tín hiệu đơn lẻ.
- [references/rca-template.md](references/rca-template.md): **mẫu RCA** (triệu chứng / dòng thời gian /
  nguyên nhân gốc / khắc phục / phòng ngừa / residual risk) với ngôn ngữ **đo được**.
