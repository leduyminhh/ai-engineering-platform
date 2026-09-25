# Heuristic nhận diện kiến trúc + ánh xạ file→tầng

## A. Nhận diện kiến trúc hiện trạng (bước 2)

Dò các TÍN HIỆU trong code thật (không chỉ tài liệu):

| Tín hiệu quan sát | Gợi ý kiến trúc |
|---|---|
| Chỉ có controller + service + gọi thẳng ORM/DAO, không interface repository | Layered đơn giản |
| Domain model thuần (không annotation framework) + repository là interface, impl ở tầng ngoài | Onion / Hexagonal |
| Có thư mục `ports/` (interface) + `adapters/{inbound,outbound}` | Hexagonal |
| Tách rõ luồng ghi (Command → aggregate) và đọc (Query → read model/DTO) | CQRS (overlay trên Hexagonal/Clean — không loại trừ các dòng trên) |
| Domain import `jakarta.persistence` / `sqlalchemy` / framework web | Vi phạm phụ thuộc (chưa Onion/Hexagonal thật) |

Đối chiếu chiều phụ thuộc: liệt kê import của package `domain` — nếu có import
`infrastructure`/`web`/ORM/framework thì domain CHƯA độc lập (dù thư mục có thể đã đặt tên
"đúng"). Đây là input chính cho cột (c) của bảng ánh xạ.

## B. Quy tắc ánh xạ file → tầng đích (bước 4)

Bảng ở mục này là **tra nhanh theo khái niệm**, KHÔNG thay thế việc đọc template. LUÔN đối chiếu
với mục "Vai trò & ranh giới từng module" của đúng `architecture/<stack>-<kiểu>.template.md` đã
chọn để lấy **CHÍNH XÁC tên thư mục/module** — tên khác nhau giữa Onion/Hexagonal/CQRS và giữa
Java/Python (vd `domain/service` vs `domain/services`, `application/port/out` vs
`application/ports`). Ánh xạ đi từ tầng cấp 1 (domain/application/infrastructure/bootstrap)
**xuống tới khái niệm cụ thể bên trong** — dừng ở tầng cấp 1 là CHƯA đủ.

### B1. Domain (tầng lõi) — gói theo AGGREGATE trước, rồi theo khái niệm

Một Bounded Context có thể có NHIỀU aggregate — gói riêng theo từng aggregate
(`domain/model/<aggregate>/`), value object của aggregate đó xuống `vo/` con bên trong. Event,
service, specification, repository là các NHÓM RIÊNG ngang hàng với `model/`, KHÔNG lồng vào
trong một thư mục aggregate cụ thể (chúng có thể liên quan nhiều aggregate).

| Loại phần tử hiện tại | Tầng đích | Ghi chú |
|---|---|---|
| Entity/Aggregate Root/Entity con (thuộc 1 aggregate) | `domain/model/<aggregate>/` | Gói theo TỪNG aggregate — không dồn chung một `model/` phẳng khi có nhiều aggregate |
| Value Object (thuộc 1 aggregate) | `domain/model/<aggregate>/vo/` | |
| Domain Event (biến cố nghiệp vụ đã xảy ra) | `domain/event(s)/` | KHÔNG gộp vào `model/` — khái niệm riêng, thường tham chiếu nhiều aggregate |
| Domain Service (logic liên NHIỀU đối tượng, KHÔNG thuộc riêng aggregate nào, KHÔNG cần transaction/port) | `domain/service(s)/` | Khác Application Service — xem B2, lỗi hay gặp nhất khi migrate là nhét nhầm sang `application` |
| Specification (điều kiện nghiệp vụ tái dùng, có thể combine AND/OR/NOT) | `domain/specification(s)/` | |
| Repository interface | `domain/repository/` (Onion) hoặc `application/port/out` (Hexagonal/CQRS) | Đọc đúng template đã chọn — đây là điểm phân biệt Onion vs Hexagonal |

### B2. Application (điều phối use case) — phân biệt RÕ với Domain Service

| Loại phần tử hiện tại | Tầng đích | Ghi chú |
|---|---|---|
| Business logic liên nhiều đối tượng, KHÔNG cần transaction/port | `domain/service` (xem B1) | **KHÔNG phải `application`** dù trông giống "business rule" |
| Điều phối use case (dựng aggregate, gọi domain service, transaction, publish event) | `application/service` | Application Service — CHỈ điều phối, KHÔNG tự quyết nghiệp vụ |
| Command/Request DTO vào use case | `application/command(s)/` | |
| Gateway/port hạ tầng KHÔNG thuộc domain (notification, file storage, payment, event publisher) | `application/port/` (khai báo interface) | Impl từng cái ở infrastructure — xem B3, một interface = một năng lực |

### B3. Infrastructure (adapter) — chia theo NĂNG LỰC KỸ THUẬT, không dồn một cục

| Loại phần tử hiện tại | Tầng đích | Ghi chú |
|---|---|---|
| Impl repository (JPA/SQLAlchemy) | `infrastructure/persistence/{adapter,entity,mapper,repository}/` (Java, 4 folder chuẩn) hoặc tương đương Python (`persistence/{models,mapper,adapter}`) | KHÔNG dồn chung một `persistence/` phẳng — xem đúng template để lấy tên folder |
| Controller/router HTTP | `infrastructure/web/` (Onion) hoặc module `web-api` riêng (Hexagonal/CQRS) | Kèm `mapper/` riêng cạnh nó cho DTO↔command, KHÔNG map inline trong controller |
| Gateway impl theo năng lực (email/SMS, file storage, thanh toán ngoài, publish event ra broker) | `infrastructure/<năng lực>/` — MỖI năng lực MỘT thư mục riêng (vd `notification/`, `storage/`, `payment/`, `messaging/`) | KHÔNG gộp chung một `external/`/`adapters/` mơ hồ |
| Mapper (DTO↔command / aggregate↔entity/row) | co-locate NGAY CẠNH adapter dùng nó | Java: MapStruct interface `@Mapper` riêng; Python: module hàm thuần. KHÔNG gom mapper dùng chung, KHÔNG ở domain/application |
| Cấu hình/DI wiring | `bootstrap`/composition root | Nơi DUY NHẤT nối interface↔impl |

### B4. CQRS (chỉ khi đích migrate là kiểu +CQRS) — chẻ đôi GHI/ĐỌC ở CẢ application lẫn infrastructure

| Loại phần tử hiện tại | Tầng đích | Ghi chú |
|---|---|---|
| Use case thay đổi trạng thái | `application/command/` + `command/handler/` | Đi qua aggregate, trả id — KHÔNG trả read data |
| Use case truy vấn | `application/query/` + `query/handler/` | BỎ QUA aggregate, đọc thẳng read model |
| Port lưu (ghi) | `application/port/out` — `<Aggregate>WriteRepository` | Nhận aggregate |
| Port đọc | `application/port/out` — `<Aggregate>ReadRepository` | Trả read model (View), KHÔNG phải aggregate |
| Impl persistence GHI | `infrastructure/persistence/write/{adapter,entity,mapper,repository}/` | JPA/ORM đầy đủ như B3 |
| Impl persistence ĐỌC | `infrastructure/persistence/read/adapter/` | SQL thuần (JdbcTemplate/RowMapper) — KHÔNG tách entity/mapper/repository riêng |
| Controller | `web-api/` — command controller + query controller TÁCH RIÊNG | Không dùng chung một class cho cả hai |

> Nguyên tắc gói theo aggregate/domain-event/specification dựa trên DDD tactical patterns (Eric
> Evans; Vaughn Vernon — *Effective Aggregate Design*, *Implementing Domain-Driven Design*); ranh
> giới port/adapter dựa trên Hexagonal Architecture (Alistair Cockburn) và Onion Architecture
> (Jeffrey Palermo); tách command/query dựa trên CQRS (Greg Young, Martin Fowler). **[Unverified —
> từ kiến thức huấn luyện, chưa tra cứu lại nguồn gốc trong phiên này]** tên gọi cụ thể (vd
> `application/port/out`, tên thư mục 4-folder persistence) là quy ước riêng của bộ template này,
> không phải thuật ngữ nguyên bản của các tác giả trên.

Phân loại mỗi phần tử vào một trong ba cột hành động:
- **(a) DỜI:** đã đúng tinh thần, chỉ sai vị trí → đổi package + import.
- **(b) TÁCH/ĐẢO:** cần trích interface hoặc đảo chiều phụ thuộc (vd tách repository interface
  ra domain, đẩy impl xuống infrastructure).
- **(c) VI PHẠM:** domain đang phụ thuộc hạ tầng → phải cắt phụ thuộc (mapping/anti-corruption)
  trước khi coi là đạt.

## C. Thứ tự thực thi gợi ý (bước 7)

Mặc định lõi→ngoài (domain → application → infrastructure → bootstrap). Nếu phần lớn vi phạm
nằm ở ranh giới repository, tách interface repository TRƯỚC để cắt phụ thuộc sớm, rồi mới dời
phần còn lại. Luôn giữ mỗi bước build+test XANH; cho phép adapter tạm giữ cả đường cũ lẫn mới.

Khi migrate, tách phần map INLINE trong controller/adapter (field-by-field) ra mapper co-locate
cạnh adapter là một hành động thuộc cột **(b) TÁCH**. Read-side CQRS giữ nguyên RowMapper/
JdbcTemplate, không tách mapper riêng cho luồng đọc.
