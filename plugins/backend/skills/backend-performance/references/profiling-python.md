# Profiling Python — py-spy và cProfile

Tài liệu tham chiếu cho `backend-performance`, chế độ `profile`, tầng CPU (và một phần I/O). Làm tầng DB trước
(`db-query-analysis.md`); chỉ xuống tầng này khi DB chưa giải thích được bottleneck. Mọi lệnh và cờ dưới đây
chưa đối chiếu tài liệu chính thức của phiên bản công cụ → `[Unverified]`.

## Chọn công cụ

| Công cụ | Kiểu | Khi dùng |
|---|---|---|
| py-spy | sampling, attach vào process đang chạy, không sửa code | profile server web đang chịu tải |
| cProfile | deterministic, đo mọi lời gọi hàm | profile một script/hàm/lệnh cụ thể; overhead cao hơn |

## py-spy

```bash
# [Unverified] cú pháp và cờ theo phiên bản py-spy
py-spy record -o perf/out/profile.svg --pid <pid> --duration 60
py-spy top --pid <pid>
py-spy dump --pid <pid>
```

- `record` sinh flame graph; `top` xem hàm nóng theo thời gian thực; `dump` in stack hiện tại của mọi thread
  (dùng như thread dump khi nghi treo/chờ I/O) `[Unverified]`.
- Server nhiều worker process (gunicorn, uvicorn workers): cần attach đúng worker hoặc dùng cờ theo dõi
  subprocess `--subprocesses` `[Unverified]`.
- Extension C/native chiếm thời gian: cờ `--native` `[Unverified]` (không phải nền nào cũng hỗ trợ).
- **Quyền attach:** Linux thường cần quyền ptrace/root; trong Docker cần capability `SYS_PTRACE` `[Unverified]`.
  Không đủ quyền → **`not_run`** + lý do; không tự đổi cấu hình container/kernel, không tự cài py-spy (hỏi trước).

## cProfile

```bash
# [Unverified] cú pháp -o và chạy module
python -m cProfile -o perf/out/out.prof -m app.jobs.rebuild_report
```

Đọc kết quả bằng `pstats` `[Unverified]` API:

```python
import pstats

stats = pstats.Stats('perf/out/out.prof')
stats.sort_stats('cumulative').print_stats(20)
```

- Xem trực quan bằng snakeviz (`snakeviz perf/out/out.prof`) `[Unverified]` — thêm tool → hỏi trước.
- cProfile đo mọi lời gọi nên hàm nhỏ gọi nhiều lần bị phóng đại; không dùng số thời gian tuyệt đối của
  cProfile làm latency — chỉ dùng để xếp hạng hàm tốn thời gian. Latency lấy từ chế độ `measure`.
- `cumulative` = thời gian gồm cả hàm con; `tottime` = thời gian riêng trong hàm `[Unverified]` tên cột.

## Framework web (Django / FastAPI / Flask)

- Profile **trong lúc có tải** của `measure` (cùng script k6, cùng bảng điều kiện), attach py-spy vào worker.
- Tách lần đo latency và lần profile: profiler và log debug làm chậm request → không lấy số latency từ lần
  đang profile.
- Middleware profile theo request (nếu project đã có) chỉ bật lúc khởi chạy (settings module riêng trong `perf/`
  qua `DJANGO_SETTINGS_MODULE`, biến môi trường) `[Unverified]`, không sửa file trong `src/` (P5); không làm được
  → `blocked` + đề xuất; thêm cấu hình tool đo cần hỏi trước.
- Async (FastAPI/asyncio): hàm blocking chạy trong event loop làm mọi request chờ → trong flame graph tìm lời
  gọi I/O đồng bộ (driver DB đồng bộ, HTTP client đồng bộ) trong coroutine.
- Đếm query ORM mỗi request (Django ORM, SQLAlchemy): bật lúc khởi chạy, không sửa file trong `src/` → chi tiết ở
  `db-query-analysis.md`.

## Evidence và đầu ra

- Từ flame graph/pstats, lấy hàm tốn thời gian **trong code project** → `file:line` (bỏ frame thư viện trừ khi
  chính thư viện là nguyên nhân), kèm tỉ lệ sample hoặc `cumtime` thật.
- Giả thuyết nguyên nhân phải khớp evidence (P4); không suy diễn chỉ từ đọc code.
- Danh sách file/hàm đề xuất cho `backend-fix`; không tự sửa `src/` (P5).
- Residual risk: overhead profiler, GIL làm sai lệch khi nhiều thread, dữ liệu seed khác production.
