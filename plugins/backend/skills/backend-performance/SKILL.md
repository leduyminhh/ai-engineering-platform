---
name: backend-performance
description: "Recipe on-demand: ĐO và PROFILE hiệu năng BACKEND (Java/Spring, Python) — chế độ measure chốt bảng điều kiện đo (môi trường local/test, dữ liệu seed, mô hình tải, warm-up, số lần lặp), viết/tái dùng script load test (k6) ở perf/ hoặc micro-benchmark (JMH, pytest-benchmark) ở bench/, chạy ≥3 lần, báo p50/p95/p99, throughput, error rate và độ lệch; chế độ profile tìm bottleneck theo thứ tự DB (đếm query, N+1, EXPLAIN ANALYZE) → CPU/alloc (JFR, async-profiler, py-spy, cProfile) → I/O/pool/lock, có evidence đo được, và đề xuất danh sách file/hàm cho backend-fix. Chỉ chạy trên local/test, từ chối staging/production; thiếu môi trường → not_run. KHÔNG sửa code production (đó là backend-fix); KHÔNG thay test đúng/sai (đó là backend-testing). Dùng skill NÀY khi người dùng muốn \"đo hiệu năng backend\", \"load test\", \"benchmark\", \"profile\", \"tìm bottleneck\", \"p95/p99\", \"N+1\", \"query chậm\", \"latency API\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 10
title: "Backend Performance — Đo và profile hiệu năng backend có điều kiện tái lập (recipe on-demand)"
runsIn: execute
invoke: per-request
---

# Backend Performance — Đo và profile hiệu năng backend có điều kiện tái lập (recipe on-demand)

Recipe hướng dẫn agent **đo** hiệu năng BACKEND (Java/Spring, Python) với **điều kiện tái lập được** và
**profile** để tìm bottleneck **có evidence**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc, KHÔNG
phải bộ công cụ dựng sẵn. Gọi độc lập hoặc từ Bước 2 (Baseline), Bước 3 (Profile & giả thuyết), Bước 5 (Benchmark
& so sánh) của `workflow-performance`.

## Ranh giới với skill lân cận

| Skill | Việc |
|---|---|
| `backend-testing` | test đúng/sai (pass/fail) |
| **`backend-performance`** | **đo số** (latency/throughput/memory) + **tìm bottleneck**; không sửa code production |
| `backend-fix` chế độ `performance` | sửa theo giả thuyết; không tự kết luận nhanh hơn |
| `backend-code-review` trục performance | đọc diff tìm N+1/thiếu index; không đo |

## Hai chế độ

### `measure` — Baseline (Bước 2) và Benchmark (Bước 5)

1. Chốt **bảng điều kiện đo** theo mẫu [references/measure-conditions.md](references/measure-conditions.md):
   môi trường (host local/test), phiên bản build, dữ liệu seed, endpoint/luồng, mô hình tải (VU hoặc RPS, thời
   lượng; tải hằng định, không ramp — warm-up chạy riêng), warm-up, số lần lặp, công cụ + phiên bản, ngưỡng độ
   lệch.
2. Viết hoặc tái dùng script: load test ở `perf/` ([references/k6.md](references/k6.md)); micro-benchmark ở
   `bench/` ([references/jmh-pytest-benchmark.md](references/jmh-pytest-benchmark.md)). Ưu tiên công cụ project
   đã có; chưa có → đề xuất mặc định (k6, JMH, pytest-benchmark) và **hỏi trước** khi thêm tool/dependency.
3. Chạy **≥ 3 lần**; ghi p50/p95/p99, throughput, error rate và độ lệch giữa các lần.
4. Ở Bước 5: đọc bảng điều kiện + script của Bước 2, khởi chạy lại ứng dụng từ working tree và xác nhận tiến trình
   mới trước warm-up, rồi **chạy lại nguyên trạng**. Điều kiện lệch (build khác ngoài thay đổi tối ưu, dữ liệu
   khác, tải khác) → từ chối so sánh, báo. Bảng điều kiện và script chốt ở cuối Bước 2; sau đó không sửa — cần đổi điều kiện thì quay lại Bước 2 đo lại baseline.

### `profile` — Profile & giả thuyết (Bước 3)

Thứ tự tầng rẻ → đắt; dừng ở tầng tìm ra bottleneck có evidence:

1. **DB:** đếm query mỗi request (bắt N+1), `EXPLAIN ANALYZE` query chậm, slow query log —
   [references/db-query-analysis.md](references/db-query-analysis.md).
2. **CPU/alloc:** JFR / async-profiler (Java), py-spy / cProfile (Python), chạy trong lúc có tải của `measure` —
   [references/profiling-java.md](references/profiling-java.md), [references/profiling-python.md](references/profiling-python.md).
3. **I/O, pool, lock:** thread dump, metric connection pool, thời gian chờ lock.

Đầu ra: bottleneck + evidence (`file:line`, số đo, trích đoạn flame graph/EXPLAIN); giả thuyết nguyên nhân; **danh
sách file/hàm đề xuất sửa** (đầu vào F2 của `backend-fix`).

## Ranh giới an toàn (CLAUDE.md)
- **Chỉ local/test.** Không trỏ tải vào staging/production; không dùng hay in credential thật (chỉ nêu tên biến
  môi trường). Thiếu môi trường → `not_run` + lý do; không tự dựng hạ tầng.
- **Không sửa code production.** Chỉ ghi `perf/`, `bench/` và config tool đo; không sửa `src/`, không sửa test,
  không chạy DDL/migration. Phát hiện bottleneck → chỉ đề xuất danh sách file cho `backend-fix`.
- **Hỏi trước khi thêm tool/dependency** (k6, JMH, pytest-benchmark, async-profiler, py-spy). Chạy như subagent:
  trả `blocked` + câu hỏi, không tự thêm.
- **Không push thẳng main.** Script đo là artifact; con người **duyệt diff** trước khi commit.
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng số và lệnh THẬT; không dùng "nhanh hơn rõ rệt", "tối ưu hoàn toàn"; luôn nêu
  **residual risk** (nhiễu môi trường, dữ liệu seed khác production, JIT warm-up).
- Lệnh/cờ công cụ trong `references/` chưa đối chiếu tài liệu chính thức gắn `[Unverified]`.

## Bảng gate
| # | Gate | Nội dung | Chế độ | Đỏ thì |
|---|------|---------|--------|--------|
| P1 | Môi trường | Chỉ chạy trên local/test; host staging/production → từ chối | cả hai | Thiếu môi trường → `not_run` + lý do; không tự dựng hạ tầng |
| P2 | Điều kiện đo | Bảng điều kiện đo đầy đủ TRƯỚC khi chạy; Bước 5 dùng lại bảng Bước 2 | `measure` | Thiếu mục → dừng, hỏi (chạy như subagent: trả `blocked` + câu hỏi) |
| P3 | Ổn định | ≥ 3 lần; báo độ lệch; độ lệch p95 (load test) hoặc score chính (micro-benchmark) giữa các lần > 10% (mặc định, project ghi đè trong bảng điều kiện) → cảnh báo, không kết luận | `measure` | Tăng số lần lặp hoặc cô lập nhiễu |
| P4 | Evidence | Mọi giả thuyết có evidence đo được; không suy diễn chỉ từ đọc code | `profile` | Profile thêm |
| P5 | Phạm vi ghi | Chỉ ghi `perf/`, `bench/`, config tool đo đã liệt kê ở hàng Config tool đo; thêm tool/dependency → hỏi trước (chạy như subagent: trả `blocked` + câu hỏi); không sửa `src/` production, không sửa test, không chạy DDL/migration | cả hai | Gỡ thay đổi ngoài phạm vi |

## Sau khi xong
Báo: bảng điều kiện đo; bảng số (p50/p95/p99, throughput, error rate, độ lệch) + lệnh chạy; hoặc bottleneck +
evidence + giả thuyết + danh sách file/hàm đề xuất sửa; **residual risk**. Cần sửa code → route `backend-fix`;
cần test đúng/sai → route `backend-testing`.
