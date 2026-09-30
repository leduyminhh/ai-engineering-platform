# Trục review + severity — dấu hiệu cụ thể cho backend

Tài liệu tham chiếu cho `backend-code-review`. Trung tính stack ở phần nguyên tắc; dấu hiệu cụ thể
minh hoạ bằng Java/Spring và Python. Kiến trúc nền + Dependency Rule + checklist review PR:
`architecture/ARD.md` (mục 1, 7). Đọc soát phần **trong scope** theo từng trục dưới; mỗi phát hiện
phải quy về một `file:line` cụ thể — không có evidence thì không dựng finding.

## Trục 1 — Correctness

Nơi lỗi hay nấp; đây là trục ưu tiên. Dấu hiệu:

- **Null / rỗng / biên:** truy cập field trên tham chiếu có thể null; `Optional.get()` không kiểm; list/map
  rỗng chưa xử; số 0/âm/tràn; chỉ số ngoài biên; chuỗi rỗng vs null lẫn lộn.
- **Error-handling nuốt lỗi:** `catch` rồi bỏ qua / chỉ log rồi tiếp tục như không có lỗi; nuốt
  `InterruptedException` mà không set lại cờ interrupt; `except Exception: pass`; trả giá trị mặc định
  che giấu thất bại; mất stacktrace gốc khi bọc lại exception.
- **Concurrency / race:** trạng thái chia sẻ mutable không đồng bộ; check-then-act không nguyên tử
  (vd kiểm tồn tại rồi mới ghi); `@Scheduled`/worker chạy song song trên cùng dữ liệu; dùng field non-thread-safe
  (SimpleDateFormat, HashMap) ở bean singleton; thiếu idempotency ở consumer/retry.
- **Resource leak:** connection/stream/file/`InputStream` không đóng (thiếu try-with-resources / `with` /
  `finally`); executor không shutdown; transaction/`EntityManager` mở mà không đóng; giữ tham chiếu gây rò bộ nhớ.
- **Transaction:** ranh giới đặt sai tầng (rải `@Transactional` ở từng adapter thay vì bao use case);
  một transaction sửa **nhiều aggregate**; đọc-ghi ngoài transaction gây bất nhất; `@Transactional` trên
  method private/self-invocation (Spring proxy không áp); commit rồi mới publish event ra ngoài (dual-write).
- **Logic sai:** off-by-one, so sánh `==` cho object/float, điều kiện đảo, sai đơn vị/timezone, sai độ
  chính xác số tiền (dùng `double` cho tiền thay vì `BigDecimal`/kiểu thập phân).

## Trục 2 — Thiết kế & bám kiến trúc (Dependency Rule)

Đối chiếu blueprint `<stack>-<kiểu>.template.md` + `architecture/ARD.md`. Phần lớn lỗi thiết kế lộ ở **ranh
giới tầng** — soát import ở đầu file trước:

- **Domain/Application không import hạ tầng:** package `domain`/`application` có `import org.springframework.*`,
  `jakarta.persistence.*`, JDBC, driver DB, HTTP client? (Python: `domain`/`application` import `sqlalchemy`,
  `fastapi`, `requests`, `httpx`?) → vi phạm Dependency Rule. Nếu project có ArchUnit/import-linter mà luật
  này lọt, nghi luật chưa bao đủ.
- **Inbound không gọi thẳng outbound:** controller/route gọi thẳng repository/adapter persistence, bỏ qua
  use-case/application service? → rò tầng.
- **Một transaction một aggregate:** use case ghi nhiều aggregate trong một transaction thay vì đồng bộ qua
  domain event / eventual consistency.
- **Map ở biên bằng mapper thủ công/riêng:** DTO web hay JPA entity **rò vào lõi** (aggregate mang annotation
  JPA, hoặc use case nhận thẳng DTO của controller); map tay inline trong adapter thay vì mapper riêng; dùng
  chung một class cho web-DTO + aggregate + entity. (Quy tắc mapper: `architecture/ARD.md` mục 5.)
- **Repository/port đặt sai chỗ:** Onion — repository interface phải ở `domain`; Hexagonal — driven port ở
  `application/port/out`. Đặt lệch là mất đặc trưng kiến trúc đã chọn.
- **Aggregate:** sửa entity con từ ngoài không qua aggregate root; tham chiếu aggregate khác bằng con trỏ
  trực tiếp thay vì bằng ID; entity có setter công khai tuỳ tiện (anemic model).
- **ACL:** DTO của service ngoài trôi thẳng vào lõi, thiếu Anti-Corruption Layer dịch ngữ nghĩa.

> Khi kiến trúc project là **layered đơn giản** (không DDD/port), chỉ soát các luật áp dụng được
> (controller→service→repository, không nhét nghiệp vụ vào controller); KHÔNG ép DDD/port lên project
> đã chọn layered.

## Trục 3 — Đơn giản hoá & tái dùng

- **Trùng lặp:** cùng một khối logic/nghiệp vụ lặp ở nhiều nơi (copy-paste); nên gom nếu là **cùng một lý
  do thay đổi** (tránh gom nhầm hai thứ tình cờ giống nhau).
- **Over-engineering:** trừu tượng/interface/generic/pattern thừa cho nhu cầu hiện tại; lớp gián tiếp không
  thêm giá trị; cấu hình động cho thứ không bao giờ đổi.
- **Đặt logic đúng tầng (altitude):** quy tắc nghiệp vụ nằm trong controller/application service thay vì
  aggregate/domain service; chi tiết hạ tầng leo lên lõi; helper kỹ thuật lẫn vào domain.
- **Chết & thừa:** code chết, biến/tham số không dùng, nhánh không bao giờ đạt tới, comment lạc hậu.

## Trục 4 — Readability & naming

Đối chiếu **`code-convention` của project** (không áp gu cá nhân — convention là việc của tài liệu convention):

- Tên theo **Ubiquitous Language** nghiệp vụ, không theo thuật ngữ kỹ thuật; hậu tố tầng đúng quy ước
  (`*Service`, `*Repository`, `*Adapter`, `*Gateway`, `*Command`, `*Spec`...).
- Hàm/lớp quá dài, quá nhiều tham số, nhiều cấp lồng sâu → khó đọc; magic number/string không đặt tên.
- Comment giải thích **vì sao** (bất biến, cạm bẫy), không kể lại **cái gì** code đã nói; comment lạc hậu.
- Định dạng/lint lệch chuẩn project (nếu có formatter/linter, chỉ nhắc nếu đây là finding thật, không soi vụn).

## Trục 5 — Test coverage

- Nhánh nghiệp vụ **mới/đã sửa** có unit test lõi (mock/fake driven port, không cần DB) không? Case biên
  (null/rỗng/0/âm, nhánh lỗi) đã phủ?
- Adapter mới có integration test (Testcontainers/DB thật) khi hành vi persistence/mapping/transaction là
  thứ cần chứng minh?
- Thiếu test cho code **có rủi ro thật** = một finding (severity theo mức rủi ro), không phải đòi 100% phủ.
- Test kèm PR có **giòn** không (phụ thuộc thứ tự/thời gian thực/mạng; assert chi tiết cài đặt)? (Chi tiết:
  `backend-testing` → `references/test-strategy.md` mục "Tránh test giòn".) Sâu về chiến lược test → route
  `backend-testing`.

## Trục 6 — Performance

Đọc diff tĩnh chỉ cho thấy **rủi ro hiệu năng**, không cho thấy số đo. Contract đầu ra (`core:principles`) cấm kết
luận về hiệu năng khi không có số đo trước/sau trên cùng điều kiện, nên finding của trục này mặc định:

- nhãn **suspected**, `category: performance`, `confidence` tối đa `medium`;
- **không viết con số** (ms, %, số truy vấn) vào `impact` khi chưa đo;
- severity tối đa **major** khi chưa có số đo hay kế hoạch thực thi (`blocker` cần bằng chứng đo được).

Dấu hiệu:

- **N+1 query:** vòng lặp gọi `repository.findById(...)` cho từng phần tử; truy cập quan hệ lazy (vd `order.getItems()`)
  trong vòng lặp hoặc `stream().map(...)` sau khi đã tải danh sách cha; mapper DTO chạm quan hệ lazy. Python/ORM: truy
  cập quan hệ lazy trong vòng lặp mà không tải trước theo lô. Hướng sửa thường là tải theo lô hoặc `JOIN FETCH`/
  `@EntityGraph` (Hibernate), `selectinload`/`joinedload` (SQLAlchemy) `[Inference]` — đối chiếu ORM và phiên bản của
  project.
- **Query trong vòng lặp:** gọi DB, HTTP hoặc RPC trong `for`/`while`/`stream` thay vì gom thành một truy vấn theo
  lô (`IN`, batch, bulk).
- **Thiếu index:** điều kiện lọc, join hoặc sắp xếp mới trên cột chưa có index (kiểm migration trong diff và schema
  hiện có); `LIKE '%…'` đầu chuỗi; bọc cột bằng hàm trong điều kiện (`WHERE lower(col) = …`). `[Inference]` Ảnh hưởng
  phụ thuộc DB và kích thước dữ liệu, kiểm bằng kế hoạch thực thi; index thừa làm chậm ghi cũng đáng nêu ở mức minor.
- **Tải eager/thừa:** `FetchType.EAGER` trên quan hệ dạng tập hợp; tải cả aggregate để hiển thị vài trường (cân nhắc
  projection/read model); danh sách không phân trang hoặc không giới hạn (vd `findAll()` trên bảng lớn); tải cả bảng
  vào bộ nhớ rồi lọc bằng code.

Cách đo chỉ **đề xuất** trong finding (skill là READ-ONLY, không tự chạy trên môi trường thật): log SQL hoặc đếm
truy vấn trong test tích hợp, `EXPLAIN` trên môi trường local/test, profiler của stack. Cần tối ưu có số đo
trước/sau → `workflow-performance` (nếu project đã cài).

## Severity — thang phân loại + evidence

| Severity | Nghĩa | Ví dụ |
|---|---|---|
| **blocker** | Sai/hỏng chắc chắn hoặc rủi ro nghiêm trọng; không nên merge khi chưa xử | Bug correctness proven (mất dữ liệu, NPE trên luồng chính), rò ranh giới kiến trúc lõi, race gây sai dữ liệu |
| **major** | Vấn đề thật, tác động rõ nhưng có đường lách/không chặn ngay | Error-handling nuốt lỗi vùng quan trọng, thiếu test cho nhánh rủi ro, transaction ôm nhiều aggregate |
| **minor** | Nên sửa, tác động hạn chế | Trùng lặp vừa, đặt logic hơi sai tầng, naming lệch convention |
| **nit** | Gu/đánh bóng, không bắt buộc | Định dạng vụn, tên cải thiện nhẹ, comment thừa |

Quy tắc gắn evidence + severity:

- **Mỗi finding phải có `file:line`** (đường dẫn tương đối + số dòng trong diff/file). Không có vị trí cụ
  thể → không dựng finding.
- **Rationale nêu tác động thật;** với correctness, viết **kịch bản input→hành vi sai** (proven). Chỉ "có
  mùi/có thể" → nhãn **suspected**, KHÔNG nâng lên blocker.
- **Không thổi phồng:** một suspected không tái hiện được thì để minor/nit + nhãn suspected, để người quyết.
- **Đề xuất fix** nêu hướng sửa gọn; READ-ONLY mặc định nên KHÔNG viết code thay trừ khi người dùng yêu cầu.
