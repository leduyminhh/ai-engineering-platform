# Phân tích query DB — đếm query, N+1, EXPLAIN ANALYZE, slow query log

Tài liệu tham chiếu cho `backend-performance`, chế độ `profile`, tầng đầu tiên (DB — rẻ nhất, hay gặp nhất). Tên
cấu hình, API và cú pháp dưới đây chưa đối chiếu tài liệu chính thức của phiên bản ORM/DB project đang dùng →
`[Unverified]`.

## Cảnh báo an toàn — đọc trước

- **Chỉ chạy trên DB test/local** (P1). Không chạy `EXPLAIN ANALYZE`, không bật slow query log trên DB
  staging/production.
- **`EXPLAIN ANALYZE` THỰC THI câu lệnh** (khác `EXPLAIN` thường chỉ lập kế hoạch). Với `UPDATE`/`DELETE`/`INSERT`
  phải bọc transaction rồi rollback:

```sql
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status = 'ARCHIVED' WHERE created_at < DATE '2020-01-01';
ROLLBACK;
```

  Rollback không hoàn tác mọi hiệu ứng phụ: ví dụ sequence đã tăng (PostgreSQL), trigger gọi ra ngoài →
  vẫn chỉ chạy trên DB test. MySQL: kiểm phiên bản có hỗ trợ `EXPLAIN ANALYZE` cho câu lệnh ghi hay không
  `[Unverified]`; engine không hỗ trợ transaction → không chạy câu lệnh ghi.
- **Không** tự thêm index, không viết migration, không chạy DDL (P5) — chỉ đề xuất cho `backend-fix`.
- Credential DB chỉ qua biến môi trường; không in ra báo cáo.

## Đếm query mỗi request (bắt N+1)

N+1: một query lấy danh sách N bản ghi, rồi N query nữa lấy quan hệ cho từng bản ghi (thường do lazy loading
trong vòng lặp hoặc serializer). Dấu hiệu: số query mỗi request tăng theo kích thước dữ liệu trả về.

| Stack | Cách đếm |
|---|---|
| Java/Hibernate | `hibernate.generate_statistics` (Spring: `spring.jpa.properties.hibernate.generate_statistics=true`) + log SQL `logging.level.org.hibernate.SQL=DEBUG` `[Unverified]` |
| Java (mọi JDBC) | datasource-proxy bọc `DataSource`, bật đếm query (`ProxyDataSourceBuilder` … `countQuery()`) `[Unverified]` — thêm dependency → hỏi trước |
| Django | `connection.queries` khi `DEBUG=True`, hoặc `CaptureQueriesContext` `[Unverified]` |
| SQLAlchemy | event `before_cursor_execute` trên engine để đếm, hoặc `echo=True` `[Unverified]` |

- Đếm với **hai kích thước dữ liệu** (ví dụ trang ít và nhiều bản ghi): số query tăng tuyến tính theo số bản ghi
  → N+1 có evidence; ghi cả hai con số thật.
- Từ log SQL, truy ngược `file:line` gọi query (repository/service/serializer) — đó là evidence cho P4.
- Bật log đếm query chỉ trong cấu hình môi trường test; tách lần đếm query khỏi lần đo latency.

## EXPLAIN ANALYZE — đọc kế hoạch thực thi

- PostgreSQL: `EXPLAIN (ANALYZE, BUFFERS) <query>` `[Unverified]` tuỳ chọn `BUFFERS`.
- MySQL 8: `EXPLAIN ANALYZE <query>` `[Unverified]` phiên bản tối thiểu; hoặc `EXPLAIN FORMAT=JSON` /
  `EXPLAIN FORMAT=TREE` (không thực thi) `[Unverified]`.
- Dùng tham số thật lấy từ log SQL (bind value của request chậm), trên dữ liệu seed đúng bảng điều kiện.

Những gì cần đọc:

- **Seq scan / full table scan** trên bảng lớn với điều kiện lọc chọn lọc → nghi thiếu index hoặc index không
  dùng được (hàm bọc cột, kiểu dữ liệu lệch, `LIKE '%...'`).
- **Rows estimate vs actual** lệch lớn → thống kê cũ hoặc phân phối dữ liệu lệch; planner chọn sai join.
- **Sort / hash spill ra đĩa** (PostgreSQL: `Sort Method: external merge`, `Batches` > 1 ở Hash) `[Unverified]`
  cách hiển thị → bộ nhớ làm việc không đủ hoặc sort không cần thiết.
- **Nested loop** với vòng ngoài nhiều dòng → chi phí nhân lên.
- Thời gian thực tế từng node: tìm node chiếm phần lớn tổng thời gian; trích đoạn node đó làm evidence.

## Slow query log (DB test)

- PostgreSQL: `log_min_duration_statement` `[Unverified]`; extension `pg_stat_statements` `[Unverified]` (cài
  extension là thay đổi cấu hình DB → hỏi trước).
- MySQL: `slow_query_log`, `long_query_time` `[Unverified]`.
- Chỉ bật trên DB test, ghi ngưỡng đã đặt vào bảng điều kiện đo; tắt lại sau khi đo.

## Đầu ra cho `backend-fix`

Mỗi phát hiện một dòng:

| Query (rút gọn) | `file:line` gọi | Evidence | Đề xuất |
|---|---|---|---|
| … | … | số query/request ở hai kích thước dữ liệu, hoặc trích node EXPLAIN | index / fetch join / batch fetch / phân trang |

Đề xuất index hay migration chỉ là **đề xuất** — `backend-fix` (và nếu cần, skill migration của project) quyết
định và thực hiện; skill này không ghi `src/`, không chạy DDL (P5).
