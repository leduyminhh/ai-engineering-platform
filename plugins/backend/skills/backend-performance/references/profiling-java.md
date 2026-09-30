# Profiling Java — JFR và async-profiler

Tài liệu tham chiếu cho `backend-performance`, chế độ `profile`, tầng CPU/alloc (và một phần lock/I/O). Làm tầng
DB trước (`db-query-analysis.md`); chỉ xuống tầng này khi DB chưa giải thích được bottleneck. Mọi cờ JVM, lệnh
`jcmd`/`jfr`/`asprof` dưới đây chưa đối chiếu tài liệu chính thức của phiên bản JDK/công cụ → `[Unverified]`.

## Nguyên tắc chung

- Profile **trong lúc có tải** của chế độ `measure` (cùng script k6/bảng điều kiện), không profile lúc ứng dụng
  rảnh — frame nóng lúc rảnh không đại diện.
- Chỉ trên local/test (P1). Attach profiler vào process production → từ chối.
- Evidence (P4): frame nóng → `file:line` trong code project (bỏ qua frame thư viện trừ khi chính thư viện là
  nguyên nhân), tỉ lệ sample, trích đoạn flame graph hoặc bảng Hot Methods. Không suy diễn chỉ từ đọc code.

## JFR (JDK Flight Recorder)

Bật khi khởi động JVM `[Unverified]` cú pháp tham số; `delay=` hoãn lúc bắt đầu ghi để bỏ qua startup và warm-up
`[Unverified]` (chọn ≥ thời gian khởi động + warm-up, ghi vào báo cáo):

```bash
java -XX:StartFlightRecording=delay=60s,duration=120s,filename=perf/out/app.jfr,settings=profile -jar app.jar
```

Hoặc bật trên process đang chạy bằng `jcmd` `[Unverified]`. Chọn MỘT trong hai cách; recording có
`duration=…` tự dừng và tự ghi file khi hết giờ, nên không nối thêm `JFR.dump`/`JFR.stop` cho recording đó:

```bash
# (a) recording có hẹn giờ: tự dừng và ghi perf/out/app.jfr sau 120s
jcmd <pid> JFR.start name=perf settings=profile duration=120s filename=perf/out/app.jfr

# (b) recording không hẹn giờ: tự quyết điểm dừng theo pha đo của tải
jcmd <pid> JFR.start name=perf settings=profile
jcmd <pid> JFR.dump name=perf filename=perf/out/app.jfr
jcmd <pid> JFR.stop name=perf
```

- Đọc file `.jfr` bằng JDK Mission Control (JMC); xem các mục **Hot Methods** (CPU), **Allocation** (nơi cấp
  phát nhiều), **Lock/Monitor** (chờ khoá), **GC** (tần suất, pause) `[Unverified]` tên mục theo phiên bản JMC.
- Không có GUI: công cụ dòng lệnh `jfr print` / `jfr summary` `[Unverified]` để trích sự kiện dạng text.
- Chọn cửa sổ ghi trùng với pha đo của tải (bỏ warm-up) và ghi lại thời điểm vào báo cáo.

## async-profiler

- Sinh flame graph CPU, allocation, lock với overhead thấp; attach bằng pid `[Unverified]`:

```bash
asprof -d 60 -e cpu   -f perf/out/cpu.html   <pid>
asprof -d 60 -e alloc -f perf/out/alloc.html <pid>
asprof -d 60 -e lock  -f perf/out/lock.html  <pid>
```

  Phiên bản cũ dùng script `profiler.sh` với cờ tương tự `[Unverified]`.
- Cần quyền hệ thống (ví dụ `perf_event_paranoid`, capability trong container) `[Unverified]`; chỉ hỗ trợ
  Linux/macOS `[Unverified]`. Trên Windows hoặc container không có quyền → **`not_run`** + lý do; không tự đổi
  cấu hình kernel/container, không tự cài. Có thể lùi về JFR (chạy được trên mọi nền JDK hỗ trợ JFR).
- Cài async-profiler là thêm tool → hỏi trước.

## Tầng I/O, pool, lock

- **Thread dump** trong lúc có tải: `jcmd <pid> Thread.print` `[Unverified]`; chụp vài lần cách nhau vài giây,
  tìm nhiều thread cùng `BLOCKED`/`WAITING` ở một chỗ (lock, chờ connection pool, chờ HTTP client).
- **Connection pool:** metric pool (ví dụ HikariCP qua Spring Boot Actuator/Micrometer: số connection active,
  pending, thời gian chờ lấy connection) `[Unverified]` tên metric; pending tăng khi tải tăng → nghi pool cạn
  hoặc giữ connection quá lâu (transaction dài, gọi ra ngoài trong transaction).
- **GC:** pause dài hoặc GC dày khớp với p99 xấu → xem Allocation để tìm nơi cấp phát.

## Spring: đếm query

- Bật log SQL hoặc datasource-proxy để đếm query mỗi request → chi tiết ở `db-query-analysis.md`.
- Bật log SQL/thống kê Hibernate lúc khởi chạy (tham số dòng lệnh, hoặc `--spring.config.additional-location`
  trỏ file trong `perf/`) `[Unverified]`, không sửa file trong `src/`; không làm được → `blocked` + đề xuất (chi
  tiết ở `db-query-analysis.md`).
- Log SQL dày làm chậm chính lần đo → không đo latency trong lúc bật log đếm query, tách hai lần chạy.

## Đầu ra

Bottleneck + evidence (`file:line`, tỉ lệ sample hoặc số liệu JFR, trích flame graph) → giả thuyết nguyên nhân →
danh sách file/hàm đề xuất cho `backend-fix`. Không tự sửa `src/` (P5). Residual risk: overhead profiler, JIT
chưa ổn định, dữ liệu seed khác production.
