---
name: ops-observability
description: "Skill vận hành (plugin ops) hướng dẫn THIẾT LẬP & ĐÁNH GIÁ observability cho một service: dò stack hiện có (Prometheus/Grafana/OpenTelemetry/ELK/Loki/Datadog) và health endpoint, ba trụ cột metrics/logs/traces, golden signals + SLI/SLO + error budget, alerting theo triệu chứng bám SLO chống alert fatigue, đánh giá độ phủ và ĐỀ XUẤT bổ sung. Docs-only + đề xuất là mặc định: KHÔNG tự đổi cấu hình monitoring/hạ tầng prod; KHÔNG lộ secret. Dùng skill NÀY khi người dùng muốn \"observability\", \"giám sát\", \"monitoring\", \"metrics/logs/traces\", \"alert\", \"cảnh báo\", \"SLO/SLI\", \"dashboard\", \"golden signals\" — kể cả khi không nói chính xác chữ \"skill\". Con người áp dụng vào hạ tầng thật. Không dùng khi đang có sự cố cần điều tra → ops-incident-troubleshooting; cần quy trình xử lý sự cố đầy đủ → workflow-incident."
order: 3
title: "Observability — ba trụ cột metrics/logs/traces, golden signals + SLI/SLO, alerting theo triệu chứng, đánh giá độ phủ"
runsIn: execute
invoke: per-request
---

# Observability (capability ops)

Điều phối một vòng **thiết lập & đánh giá observability** cho một service: nắm **ba trụ cột**
(metrics / logs / traces), chọn **golden signals** + **SLI/SLO**, thiết kế **alerting theo triệu chứng**,
rồi **đánh giá độ phủ** hiện có và **ĐỀ XUẤT bổ sung**. Skill này là **hướng dẫn cách agent đánh giá và
đề xuất observability** (docs-only recipe), KHÔNG phải công cụ giám sát, KHÔNG phải script cấu hình
monitoring, cũng KHÔNG phải codegen.

Nguyên tắc trung tâm: **docs-only + đề xuất là mặc định**. Agent **ĐỌC** cấu hình + dependency
observability của project làm ràng buộc, rồi **trình bày đánh giá + đề xuất đo được**; **KHÔNG tự đổi cấu
hình monitoring/hạ tầng production** — con người giữ chốt và áp dụng đề xuất vào hạ tầng thật.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần thiết lập/đánh giá observability.

## Khi nào dùng

- Cần **thiết lập observability** cho một service: bổ sung metrics/logs/traces, dashboard, alert từ đầu hay
  cho phần còn thiếu.
- Cần chọn **golden signals**, định nghĩa **SLI/SLO** + **error budget**, hoặc áp **RED/USE method**.
- Cần thiết kế **alerting**: cảnh báo theo triệu chứng, đặt ngưỡng theo SLO, giảm **alert fatigue/noise**,
  gắn **severity + runbook**.
- Cần **đánh giá độ phủ** observability hiện có (mỗi service đã có metrics/log/trace/alert/dashboard chưa),
  tìm **khoảng trống** và đề xuất bổ sung.

KHÔNG dùng skill này để tự đổi cấu hình monitoring/hạ tầng prod, dựng lại stack quan sát ngoài scope, hay
kết luận độ phủ mà không dựa trên cấu hình/dependency đọc được.

## Ranh giới an toàn

- **KHÔNG tự đổi cấu hình monitoring/hạ tầng production.** Trình bày **kế hoạch + cấu hình đề xuất** (rule
  alert, dashboard, SLO), chờ người xác nhận rồi **người áp dụng** vào hạ tầng thật. Xem
  [references/observability-checklist.md](references/observability-checklist.md).
- **KHÔNG lệnh phá huỷ** (xoá dashboard/alert đang chạy, đổi cấu hình thu thập của service khác, restart
  agent thu thập hàng loạt) khi chưa xác nhận.
- **KHÔNG** nhập/in/log token/secret; secret đi qua **biến môi trường / secret store**, skill chỉ nêu **tên
  biến**; **mask** mọi giá trị secret khi trích cấu hình/log vào output. Cảnh báo (đã mask) nếu phát hiện
  secret bị log ra plaintext hoặc lộ trong nhãn metric — coi đó là khoảng trống cần khắc phục.
- **Scope-bound.** Chỉ đánh giá/đề xuất đúng **service + môi trường** người dùng nêu; KHÔNG lan sang service
  anh em hay môi trường khác trừ khi có liên đới rõ (và nêu lý do).
- Ngôn ngữ **đo được** (ngưỡng metric, SLO/error budget, tỉ lệ độ phủ kiểm được); LUÔN nêu **residual
  risk**. KHÔNG tuyên bố "đảm bảo / loại bỏ / chặn triệt để" — observability **tăng khả năng phát hiện**
  chứ không loại bỏ sự cố; đánh giá phản ánh cấu hình đọc được tại thời điểm làm; nêu `[giả định]` khi suy
  luận thiếu dữ liệu.

## Quy trình — observability

0. **Nạp context + dò stack (BẮT BUỘC — trước khi đánh giá).**
   Đọc `CLAUDE.md` / project-knowledge để nắm **ranh giới an toàn** + kiến trúc service. **Chốt service /
   scope** cần quan sát. Dò **stack observability hiện có** từ config/dependency: Prometheus/Grafana,
   OpenTelemetry (SDK/collector), ELK/Loki (log), Jaeger/Tempo/Datadog (trace/APM) — qua file dependency,
   `docker-compose*.yml`, k8s manifest, cấu hình exporter/agent. Xác định **health endpoint** (liveness/
   readiness). Nêu **tên biến env** chứa endpoint/khoá (vd `OTEL_EXPORTER_OTLP_ENDPOINT`), KHÔNG đọc giá trị
   secret. Thiếu cấu hình/quyền truy cập → nói rõ (fail-loud), đề nghị người cung cấp thay vì suy diễn.

1. **Ba trụ cột: metrics / logs / traces.**
   Theo [references/three-pillars.md](references/three-pillars.md): phân vai **metrics** (xu hướng tổng hợp,
   rẻ để giữ lâu), **logs** (chi tiết một sự kiện, đắt), **traces** (đường đi một request qua nhiều
   service); chọn đúng trụ cột cho từng câu hỏi. Xác lập **structured logging** + **correlation id / trace
   context** để nối ba trụ cột với nhau. Không lộ secret/PII trong log hay nhãn metric.

2. **Golden signals + SLI/SLO.**
   Theo [references/signals-and-slo.md](references/signals-and-slo.md): soi **4 golden signals** (latency,
   traffic, errors, saturation); chọn **SLI** phản ánh trải nghiệm người dùng; đặt **SLO** đo được +
   **error budget**; áp **RED** (request-driven service) / **USE** (tài nguyên) tùy đối tượng. Mỗi chỉ số
   nêu nguồn đo + cửa sổ + ngưỡng cụ thể, không nói chung chung.

3. **Alerting.**
   Theo [references/alerting-rules.md](references/alerting-rules.md): cảnh báo **theo triệu chứng**
   (symptom-based, ảnh hưởng người dùng) hơn theo **nguyên nhân**; đặt **ngưỡng bám SLO/error budget**;
   chống **alert fatigue/noise** (gộp, khử rung, chỉ alert cái cần hành động); mỗi alert có **severity +
   link runbook**. Alert đề xuất dạng cấu hình mẫu — **người áp dụng**, agent không tự bật.

4. **Đánh giá độ phủ & bổ sung.**
   Theo [references/observability-checklist.md](references/observability-checklist.md): chấm **độ phủ** (mỗi
   service đã có metrics / log có cấu trúc / trace / alert / dashboard chưa), chỉ ra **khoảng trống** đo
   được (vd "service X chưa có trace", "alert error rate chưa gắn SLO"), và **ĐỀ XUẤT bổ sung** ưu tiên
   theo rủi ro. Nêu **residual risk**: phần chưa xác minh, giả định về tải/hạ tầng thật, độ trễ thu thập.

## Verification (trước khi báo hoàn thành)

- Đã **chốt service/scope** và dò **stack observability** thực tế từ config/dependency; nêu rõ nguồn (file
  nào, dependency nào); thiếu nguồn/quyền báo rõ (fail-loud).
- Phân vai **ba trụ cột** đúng nhu cầu; có **structured logging + correlation/trace context**; không secret/
  PII nào lọt vào log/nhãn metric (đã mask).
- Đã chọn **golden signals** + định nghĩa **SLI/SLO + error budget** đo được (nguồn đo + cửa sổ + ngưỡng);
  áp RED/USE đúng đối tượng.
- Alert **theo triệu chứng**, **ngưỡng bám SLO**, có **severity + runbook**, có biện pháp **chống noise**;
  chỉ **ĐỀ XUẤT**, không tự đổi cấu hình monitoring/hạ tầng prod.
- Có bảng **đánh giá độ phủ** + **khoảng trống + đề xuất** đo được; có mục **Residual risk**; ngôn ngữ đo
  được, không tuyên bố tuyệt đối; phần chưa verify báo rõ.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/three-pillars.md](references/three-pillars.md): **metrics vs logs vs traces** — dùng cái gì
  cho việc gì, **structured logging**, **correlation id / trace context** để nối ba trụ cột, và không lộ
  secret/PII.
- [references/signals-and-slo.md](references/signals-and-slo.md): **4 golden signals**, cách chọn **SLI**,
  đặt **SLO + error budget**, và **RED / USE method**.
- [references/alerting-rules.md](references/alerting-rules.md): **symptom-based alerting**, đặt **ngưỡng
  theo SLO**, **chống alert fatigue/noise**, **severity + link runbook**.
- [references/observability-checklist.md](references/observability-checklist.md): **checklist độ phủ**
  (metrics/log/trace/alert/dashboard mỗi service) + **khoảng trống + đề xuất** đo được và residual risk.
