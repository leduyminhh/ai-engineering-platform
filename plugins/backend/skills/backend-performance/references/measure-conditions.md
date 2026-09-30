# Bảng điều kiện đo — chốt TRƯỚC khi chạy, dùng lại nguyên trạng khi so sánh

Tài liệu tham chiếu cho `backend-performance`, chế độ `measure` (cổng P2, P3). Dùng ở Bước 2 (Baseline) để
chốt điều kiện, và ở Bước 5 (Benchmark & so sánh) để **đọc lại đúng bảng đó** rồi chạy lại.

## Vì sao cần bảng điều kiện

Số đo hiệu năng chỉ so sánh được khi mọi thứ ngoài thay đổi tối ưu **giữ nguyên**: máy, build, dữ liệu, tải,
warm-up, số lần lặp, công cụ. Không có bảng ghi lại → Bước 5 không chứng minh được "cùng điều kiện", và chênh
lệch có thể đến từ nhiễu hoặc dữ liệu khác chứ không phải từ code. Bảng là artifact, lưu cạnh script trong
`perf/` hoặc `bench/` (ví dụ `perf/<luồng>.conditions.md`) để con người duyệt diff cùng script.

## Bảng mẫu

Điền đủ mọi hàng trước khi chạy; hàng nào chưa biết → dừng, hỏi (P2). Không để trống, không ghi "như cũ".

| Mục | Giá trị | Ghi chú |
|---|---|---|
| Môi trường | host local/test (vd `localhost`), OS, CPU (số core), RAM | Cấm staging/production (P1); ghi cả tiến trình nặng khác đang chạy |
| Build | commit SHA / phiên bản artifact, cờ JVM hoặc phiên bản Python | Bước 5 chỉ được khác đúng thay đổi tối ưu |
| Dữ liệu seed | kích thước (số bản ghi bảng chính), cách tạo (script/lệnh seed) | Seed tái lập được; ghi rõ khác production ở đâu |
| Endpoint/luồng | method + path hoặc chuỗi request; payload mẫu | Không chứa credential thật; token lấy từ biến môi trường |
| Mô hình tải | VU hoặc RPS, thời lượng, think time; lần đo giữ tải hằng định, không ramp | Mô hình mở (RPS) hay đóng (VU) — ghi rõ loại |
| Warm-up | cách tách (lần chạy warm-up riêng, bỏ kết quả) + thời lượng hoặc số iteration | JVM cần warm-up cho JIT; Python cần warm cache/pool |
| Số lần lặp | ≥ 3 | Mỗi lần chạy lại từ cùng trạng thái dữ liệu |
| Công cụ + phiên bản | vd k6, JMH, pytest-benchmark + phiên bản thật (lệnh in version) | Không ghi phiên bản đoán; lấy từ output lệnh |
| Ngưỡng độ lệch | 10% độ lệch giữa các lần (mặc định): p95 cho load test, score chính cho micro-benchmark | Project ghi đè tại đây nếu máy nhiễu hơn/ít hơn |

## Đọc số: percentile, throughput, error rate

- **p50** (median): một nửa số request nhanh hơn giá trị này — trải nghiệm "điển hình".
- **p95 / p99**: 95% / 99% request nhanh hơn giá trị này — phần đuôi, nơi người dùng thấy chậm và nơi lộ ra
  lock, GC, pool cạn. Mục tiêu hiệu năng nên đặt trên p95/p99, không đặt trên trung bình.
- **Vì sao không dùng trung bình:** phân phối latency thường lệch phải (đuôi dài); vài request rất chậm kéo
  trung bình lên, còn nhiều request chậm vừa lại bị che. Trung bình không cho biết đuôi.
- **Throughput:** số request (hoặc iteration) hoàn tất mỗi giây trong pha đo, không tính warm-up. Think time
  (`sleep`) trong mô hình đóng giới hạn throughput → so throughput cần mô hình mở hoặc không có think time.
- **Error rate:** tỉ lệ request lỗi theo định nghĩa của k6 `http_req_failed`: response ngoài dải 200–399 (cả 4xx
  lẫn 5xx) cộng lỗi mạng/timeout `[Unverified]` định nghĩa mặc định. Bảng kết quả dùng định nghĩa này; tỉ lệ
  `check` fail báo riêng. Công cụ khác → ghi định nghĩa lỗi của công cụ đó vào bảng điều kiện. Latency thấp đi
  kèm error rate tăng không phải là cải thiện — luôn báo hai số cùng nhau.

## Độ lệch giữa các lần (P3)

Với N lần chạy (N ≥ 3), lấy **thống kê chính** của từng lần rồi tính cùng một công thức:

```text
độ lệch = (max(x) − min(x)) / median(x)
```

| Loại đo | Thống kê chính `x` mỗi lần chạy |
|---|---|
| Load test (k6, …) | p95 latency của lần đo |
| JMH (`Mode.AverageTime`) | `Score` của lần chạy (không có p95); cần percentile → `Mode.SampleTime` `[Unverified]` |
| pytest-benchmark | `median` của lần chạy (công cụ báo min/max/mean/median/stddev, không có p95) |

- Độ lệch ≤ ngưỡng (mặc định 10%) → dùng median của các lần làm con số báo cáo, kèm cả dãy số thô.
- Độ lệch > ngưỡng → **cảnh báo, không kết luận**. Cách giảm nhiễu:
  - tăng số lần lặp hoặc thời lượng pha đo;
  - tắt tiến trình nền nặng (IDE indexing, build khác, container không liên quan);
  - chạy công cụ tải và ứng dụng trên tài nguyên tách biệt nếu có thể (tải tự sinh cũng ăn CPU);
  - cố định CPU governor trên Linux, ví dụ `cpupower frequency-set -g performance` `[Unverified]` (cần quyền
    hệ thống — hỏi trước, ghi vào bảng điều kiện);
  - Windows: chọn power plan hiệu năng cao `[Unverified]`; laptop cắm sạc.
- Mọi thay đổi để giảm nhiễu phải ghi vào bảng và áp **cho cả baseline lẫn lần đo sau**.

## Mẫu bảng kết quả baseline vs sau

Điền bằng số THẬT từ output công cụ; không làm tròn "cho đẹp", không suy số khi chưa chạy.

| Chỉ số | Baseline (Bước 2) | Sau tối ưu (Bước 5) | Chênh lệch |
|---|---|---|---|
| p50 (ms) | … | … | … |
| p95 (ms) | … | … | … |
| p99 (ms) | … | … | … |
| Throughput (req/s) | … | … | … |
| Error rate | … | … | … |
| Độ lệch p95 giữa các lần | … | … | — |
| Số lần lặp | … | … | — |

Kèm theo: lệnh chạy nguyên văn, commit của hai build, và **residual risk** (nhiễu máy local, dữ liệu seed khác
production, JIT warm-up chưa đủ, cache nóng/lạnh giữa các lần).
