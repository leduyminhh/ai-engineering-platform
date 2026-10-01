# Micro-benchmark — JMH (Java) và pytest-benchmark (Python)

Tài liệu tham chiếu cho `backend-performance`, chế độ `measure`. Script đặt ở `bench/`. Tên annotation, plugin,
task và cờ dòng lệnh dưới đây chưa đối chiếu tài liệu chính thức của phiên bản project → gắn `[Unverified]`.

## Khi nào dùng micro-benchmark

| Tình huống | Công cụ |
|---|---|
| Hàm/thuật toán nóng trong process (serialize, mapping, parse, tính toán) | micro-benchmark (JMH, pytest-benchmark) |
| Latency/throughput endpoint dưới tải, gồm DB, pool, network | load test (`k6.md`) |

Số micro-benchmark (ns/op, µs/op) và số load test (ms/request) đo hai thứ khác nhau — **không so với nhau**,
không cộng dồn để suy latency endpoint.

## JMH (Java)

Class mẫu `bench/src/jmh/java/.../OrderMapperBenchmark.java` (đường dẫn tuỳ plugin build) `[Unverified]`.
Số iteration/fork là **tham số mẫu**, chốt lại trong bảng điều kiện:

```java
import java.util.concurrent.TimeUnit;
import org.openjdk.jmh.annotations.*;
import org.openjdk.jmh.infra.Blackhole;

@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(3)
public class OrderMapperBenchmark {
  private Order order;

  @Setup
  public void setUp() {
    order = OrderFixtures.sample(); // dữ liệu cố định, tái lập được
  }

  @Benchmark
  public void toDto(Blackhole bh) {
    bh.consume(OrderMapper.toDto(order)); // chặn JIT loại bỏ code "vô dụng"
  }
}
```

- `@Warmup` cho JIT kịp biên dịch; `@Fork` chạy nhiều JVM riêng để giảm ảnh hưởng profile của một JVM
  `[Unverified]` ý nghĩa chính xác từng tham số theo phiên bản.
- **Dead-code elimination:** kết quả không dùng tới có thể bị JIT bỏ → trả giá trị từ method `@Benchmark` hoặc
  đưa vào `Blackhole.consume(...)`.
- Chạy qua plugin build: Gradle thường dùng plugin `me.champeau.jmh` với task `jmh` `[Unverified]`; Maven
  thường tạo module từ archetype JMH rồi chạy `java -jar target/benchmarks.jar` `[Unverified]`. Thêm plugin hay
  dependency JMH là thay đổi tool → **hỏi trước**.
- Xuất kết quả máy đọc được, ví dụ `java -jar target/benchmarks.jar -rf json -rff bench/out/result.json`
  `[Unverified]`. Báo `Score ± Error` và đơn vị đúng như output.
- `Mode.AverageTime` không cho percentile. Cần p50/p95/p99 của thời gian mỗi lời gọi → dùng `Mode.SampleTime`
  `[Unverified]`; ghi mode đã chọn vào bảng điều kiện.

## pytest-benchmark (Python)

File mẫu `bench/test_order_mapper_bench.py`:

```python
from app.orders.mapper import to_dto
from tests.fixtures import sample_order


def test_to_dto(benchmark):
    order = sample_order()  # dữ liệu cố định, tái lập được
    result = benchmark(to_dto, order)
    assert result is not None
```

- Fixture `benchmark` gọi hàm nhiều vòng và thống kê min/max/mean/median `[Unverified]` các cột thống kê.
- Chạy chỉ benchmark: `pytest bench/ --benchmark-only` `[Unverified]`.
- Lưu và so sánh lần chạy: `pytest bench/ --benchmark-autosave` rồi `--benchmark-compare` `[Unverified]`; hoặc
  lệnh `pytest-benchmark compare` `[Unverified]`. Lần so sánh phải cùng máy, cùng phiên bản Python.
- Cần kiểm soát số vòng/warm-up: `benchmark.pedantic(fn, args=(...), rounds=..., iterations=...)` `[Unverified]`.
- File trong `bench/` không phải test đúng/sai: `assert` chỉ để chặn benchmark chạy trên kết quả rỗng, không thay
  test của `backend-testing`. Nếu project cấu hình pytest thu mọi `test_*.py`, tách `bench/` khỏi đường chạy test
  thường (hỏi trước khi sửa config).

## Cảnh báo

- **JVM:** benchmark tự viết (vòng `for` + `System.nanoTime()`) không qua JMH dễ cho số sai vì JIT, dead-code
  elimination, GC và on-stack replacement → ưu tiên JMH; nếu buộc phải tự viết, ghi rõ vào residual risk.
- **Python:** kết quả nhạy với phiên bản interpreter, extension C và GC; ghi phiên bản thật vào bảng điều kiện.
- Chạy **≥ 3 lần** (với JMH: nhiều fork cũng tính là lặp ở mức JVM, nhưng vẫn báo độ lệch giữa các lần chạy);
  độ lệch vượt ngưỡng → không kết luận (P3).
- **Thống kê cho P3:** micro-benchmark không có p95 mặc định. Áp đúng công thức độ lệch của
  `measure-conditions.md` lên **score chính mỗi lần chạy**: JMH → `Score`; pytest-benchmark → `median`. Ngưỡng
  mặc định 10%, project ghi đè trong bảng điều kiện.
- Không bịa số mẫu trong báo cáo: chỉ chép từ output thật.
