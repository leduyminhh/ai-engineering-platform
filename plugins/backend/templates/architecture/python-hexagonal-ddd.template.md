# Template: Python · Hexagonal + DDD

## Summary

Blueprint **cấu trúc** cho một Bounded Context viết bằng Python theo kiến trúc **Hexagonal (Ports & Adapters) + DDD**, tổ chức thành một package `src/<bc>/` với ranh giới ép bằng **import-linter (contract khai báo trong `pyproject.toml`) + `typing.Protocol`** — Python không có compiler cô lập như module Maven, nên ràng buộc là **fail build ở CI** thay cho lỗi biên dịch. File mô tả cây thư mục, vai trò & ranh giới từng package, chiều phụ thuộc, luồng một use case, quy tắc mapping và quy ước đặt tên. Cây thư mục **minh hoạ bằng domain `billing`** (aggregate `Invoice`) cho dễ hình dung — thay bằng domain thật theo bảng đối chiếu ở [Context](#context). **Không chứa code skeleton** — chỉ là blueprint cấu trúc để scaffold; code nghiệp vụ viết theo blueprint này.

## Context

- **Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2. **CHỈ áp dụng stack Python.**
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC**. Quy tắc chung (Dependency Rule, DDD tactical, checklist review) xem [ARD.md](ARD.md); bản Java cùng kiến trúc: [java-hexagonal-ddd.template.md](java-hexagonal-ddd.template.md).
- **Khi nào dùng:** ứng dụng nghiệp vụ vừa–phức tạp, có (hoặc sẽ có) nhiều kênh vào/ra dùng chung một lõi (REST + worker/queue + CLI + cron). (Mặc định của kit là Onion + DDD; chọn Hexagonal khi số kênh I/O là yếu tố nổi trội.)
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `billing`; cột phải là "chỗ trống" cần thay khi áp cho domain của bạn.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong cây `billing` |
|---------------------|---------|---------------------------|
| Bounded Context | package gốc `src/<bc>/` | `src/billing/` |
| Aggregate Root | thực thể gốc của cụm nhất quán | `Invoice` |
| Entity con | thực thể nằm trong aggregate | `InvoiceLine` |
| Value Object | giá trị bất biến | `Money`, `TaxRate` |
| Aggregate liên quan | tham chiếu **bằng ID** | `Customer` → `CustomerId` |
| Domain event | biến cố nghiệp vụ | `InvoiceIssuedEvent`, `InvoicePaidEvent` |
| Domain service | logic liên nhiều đối tượng | `PricingService` |
| Use case | một tình huống sử dụng | `IssueInvoice` → `IssueInvoiceUseCase` / `…Command` / `…Service` / `…Request` |
| Hệ thống ngoài | năng lực gọi ra ngoài | `Payment` → `PaymentPort` / `HttpPaymentAdapter` |
| Lớp khởi động | entrypoint FastAPI + wiring | `src/main.py` + `bootstrap/container.py` |
| Tài nguyên URL | danh từ trên REST path | `invoices` |

## Problem

Nghiệp vụ dễ bị buộc chặt vào framework và hạ tầng: logic lẫn trong router FastAPI hay model SQLAlchemy, đổi DB/khung là đụng vào lõi, phải dựng cả app + DB mới test được, và mỗi kênh vào/ra mới lại kéo theo sửa lõi. Python lại **không ép ranh giới ở mức biên dịch**, nên rất dễ vô tình `import fastapi` ngay trong lõi mà không ai chặn. Cần tách **lõi nghiệp vụ** khỏi **chi tiết kỹ thuật** sao cho ranh giới không thể vô tình phá vỡ.

## Solution

Hexagonal + DDD: lõi (`domain` + `application`) là Python thuần, giao tiếp với thế giới **chỉ qua port** khai báo bằng `typing.Protocol`; mọi chi tiết kỹ thuật nằm ở `infrastructure` dưới dạng adapter "structural-implements" port. Lõi **không import `fastapi`/`sqlalchemy`**: `domain`/`application` phải chạy được mà không cần dựng framework. Vì không có compiler cô lập như module Maven, **Dependency Rule ép tự động bằng [import-linter](https://import-linter.readthedocs.io/)** (contract khai báo trong `pyproject.toml`, chạy `lint-imports` ở CI) — vi phạm là fail build. DDD tactical (aggregate, value object, domain event, domain service) giữ quy tắc nghiệp vụ nằm trong lõi.

## Architecture

### Cây thư mục

Cây dưới minh hoạ domain `billing` (aggregate `Invoice`) — một Bounded Context là **một package Python** `src/billing/`, các tầng là **package con** chứ không phải module Maven (không có prefix `billing-`). Ở **package lá** chỉ nêu **một file tượng trưng**; chú thích `+ …` báo còn file cùng loại — điều quan trọng là **cây package**, không phải liệt kê hết file.

```
src/billing/                                     # Bounded Context minh hoạ (đổi thành BC của bạn) — 1 package Python
├── __init__.py
│
├── domain/                                      # LÕI nghiệp vụ — thuần Python, KHÔNG fastapi/sqlalchemy
│   ├── __init__.py
│   ├── model/
│   │   ├── invoice/                             # gói theo AGGREGATE
│   │   │   ├── __init__.py
│   │   │   ├── invoice.py                       #   AGGREGATE ROOT (+ invoice_line.py, invoice_status.py)
│   │   │   └── vo/
│   │   │       ├── __init__.py
│   │   │       └── money.py                     #   VALUE OBJECT (+ invoice_id.py, tax_rate.py)
│   │   └── customer/
│   │       ├── __init__.py
│   │       └── customer_id.py                   # tham chiếu aggregate khác BẰNG ID
│   ├── events.py                                # domain event: InvoiceIssuedEvent (+ DomainEvent nền)
│   ├── services.py                              # DOMAIN SERVICE — PricingService (logic liên nhiều đối tượng)
│   └── exceptions.py                            # lỗi nghiệp vụ của domain (+ InvoiceNotDraftError)
│
├── application/                                 # điều phối use case — thuần Python
│   ├── __init__.py
│   ├── ports/
│   │   ├── __init__.py
│   │   ├── inbound.py                           # DRIVING port (Protocol) — thế giới gọi VÀO lõi
│   │   │                                        #   IssueInvoiceUseCase (+ IssueInvoiceCommand)
│   │   └── outbound.py                          # DRIVEN port (Protocol) — lõi gọi RA ngoài
│   │                                            #   SaveInvoicePort (+ NotificationPort, PaymentPort)
│   └── services/
│       ├── __init__.py
│       └── issue_invoice.py                     # IssueInvoiceService — điều phối; KHÔNG chứa nghiệp vụ
│
├── infrastructure/                             # adapter hiện thực port — nơi DUY NHẤT có fastapi/sqlalchemy/mạng
│   ├── __init__.py
│   ├── inbound/
│   │   └── web/                                 # driving adapter (REST)
│   │       ├── __init__.py
│   │       ├── router.py                        #   FastAPI — gọi web/mapper.py để map DTO ↔ command
│   │       ├── schemas.py                       #   Pydantic request/response (DTO, KHÔNG rò vào domain)
│   │       └── mapper.py                        #   hàm to_command/to_response (DTO ↔ command) — HAND-WRITTEN
│   └── outbound/
│       ├── persistence/                         # driven adapter (SQLAlchemy)
│       │   ├── __init__.py
│       │   ├── adapter.py                       #   SqlAlchemyInvoiceRepository -> SaveInvoicePort
│       │   ├── models.py                        #   InvoiceRow (SQLAlchemy) — RIÊNG khỏi aggregate
│       │   └── mapper.py                        #   hàm to_row/to_domain (aggregate ↔ InvoiceRow) — HAND-WRITTEN
│       ├── notification/
│       │   └── log_adapter.py                   #   LogNotificationAdapter -> NotificationPort
│       └── payment/                             # HTTP client = Anti-Corruption Layer
│           └── http_adapter.py                  #   HttpPaymentAdapter -> PaymentPort
│
└── bootstrap/                                   # wiring — nơi DUY NHẤT "thấy" cả lõi lẫn adapter
    ├── __init__.py
    └── container.py                             # lắp ráp port -> service (constructor injection qua Depends)
```

> **Ánh xạ về `api → service → repository` (Layered thường) cho ai quen 3 tầng:** `infrastructure/inbound/web` = tầng `api/`; `application/services` = tầng `service/`; `infrastructure/outbound/persistence` = tầng `repository/`. Hexagonal thêm `domain/` (lõi thuần) và tách `ports/` để đảo phụ thuộc. Đăng ký router của BC vào `src/main.py` (chỗ đã chừa comment).

### Vai trò & ranh giới các package

Bốn package con, mỗi package một trách nhiệm; **ranh giới do import-linter ép** (không khai báo được phụ thuộc trỏ ra ngoài — vi phạm là fail build ở CI).

- **`domain`** — LÕI nghiệp vụ: aggregate (`Invoice`), value object (`Money`), domain event, domain service (`PricingService`). **Thuần Python, KHÔNG `import fastapi`/`sqlalchemy`.** Tầng trong cùng, không biết gì về hạ tầng.
- **`application`** — điều phối use case (`IssueInvoiceService`) + **khai báo port** bằng `Protocol` (`ports/inbound.py`, `ports/outbound.py`). Không chứa quy tắc nghiệp vụ (ở `domain`), không chứa chi tiết hạ tầng (ở `infrastructure`). Vẫn thuần Python.
- **`infrastructure`** — **adapter hiện thực port**: router FastAPI (driving), SQLAlchemy repo / HTTP client / messaging (driven). Nơi duy nhất được đụng FastAPI, SQLAlchemy, mạng. Map DTO/row ↔ kiểu của lõi qua **mapper module hand-written** (`web/mapper.py`, `persistence/mapper.py`) đặt cạnh adapter dùng nó — không đặt ở `domain`/`application`, để adapter luôn thin.
- **`bootstrap`** — `container.py` lắp ráp port → service qua `Depends`. **Package duy nhất "thấy" cả lõi lẫn adapter**; giữ framework và wiring ra khỏi lõi.

### Chiều phụ thuộc

Không có module Maven để trình biên dịch cô lập; thay vào đó **contract import-linter trong `pyproject.toml`** đóng vai "bảng dependency" — phụ thuộc chỉ trỏ **vào trong**, về phía `domain`. Đảo phụ thuộc bằng `typing.Protocol`: lõi khai báo port, adapter ở ngoài "structural-implements" mà không import ngược vào lõi.

| Package | Được phụ thuộc (theo contract import-linter) |
|---------|----------------------------------------------|
| `domain` | **không có** package nội bộ nào; cấm `fastapi`/`sqlalchemy` (contract `forbidden`) |
| `application` | `domain`; cấm `fastapi`/`sqlalchemy` (contract `forbidden`) |
| `infrastructure` | `application`, `domain`, `fastapi`, `sqlalchemy` — nơi duy nhất được import framework |
| `bootstrap` | tất cả package trên (điểm lắp ráp) |

Contract "layers" xếp `infrastructure → application → domain` để ép chiều mũi tên; `lint-imports` fail build nếu có import trỏ ngược (xem cấu hình cụ thể ở [Standards](#standards)).

### Port — driving vs driven

Điểm đặc trưng của Hexagonal: lõi giao tiếp với thế giới **chỉ qua port** (`Protocol`), mỗi port có một hay nhiều adapter "structural-implements".

| Loại port | Vị trí khai báo | Adapter hiện thực | Ví dụ (`billing`) |
|-----------|-----------------|-------------------|-------------------|
| **Driving / primary** — thế giới gọi *vào* lõi | `application/ports/inbound.py` | `infrastructure/inbound/*` | `IssueInvoiceUseCase` ← `router.py` (FastAPI). Thêm CLI/worker = thêm adapter, port không đổi. |
| **Driven / secondary** — lõi gọi *ra* ngoài | `application/ports/outbound.py` | `infrastructure/outbound/*` | `SaveInvoicePort` ← `SqlAlchemyInvoiceRepository`; `PaymentPort` ← `HttpPaymentAdapter` (HTTP). Đổi DB/HTTP chỉ đổi adapter. |

Thêm một kênh vào/ra mới = thêm **một adapter** (và nếu là năng lực mới ra ngoài thì thêm một driven port). Lõi (`domain` + `application`) **không đổi**.

> **Port thuộc package nào là quy ước của kit, không phải luật.** Cockburn (Hexagonal) chỉ yêu cầu "giao tiếp qua port, phụ thuộc trỏ vào lõi"; đặt driven port ở `application/ports/outbound.py` (như file này) hay ở `domain` (như bản Onion) đều hợp lệ. Chọn một và giữ nhất quán.

## Implementation

Khi hiện thực (aggregate, port `Protocol`, service, adapter, container), giữ ba điểm map ở biên để lõi luôn sạch, DTO/hạ tầng không rò vào trong:

| Ranh giới | Map ở | Quy tắc |
|-----------|-------|---------|
| DTO web ↔ command/VO | `router.py` gọi `web/mapper.py` (driving adapter) | `web/mapper.py` khai báo `to_command`/`to_response`: map `IssueInvoiceRequest` (Pydantic) ↔ `IssueInvoiceCommand` (VO domain); `router.py` chỉ gọi, không tự map, không nhét logic. |
| Aggregate ↔ SQLAlchemy row | `SqlAlchemyInvoiceRepository` gọi `persistence/mapper.py` (`to_row`/`to_domain`) (driven adapter) | `InvoiceRow` **riêng** khỏi aggregate `Invoice`; hàm thuần `to_row`/`to_domain` trong `persistence/mapper.py`, không codegen. Aggregate KHÔNG kế thừa `Base`. |
| DTO service ngoài ↔ VO domain | `HttpPaymentAdapter` = **Anti-Corruption Layer** (hand-written, không tách mapper riêng) | ACL không chỉ đổi tên trường — nó **dịch ngữ nghĩa giữa hai model** (model hệ ngoài ↔ model của bạn), bảo vệ lõi khỏi khái niệm "lạ". DTO của payment service không lọt vào lõi. |

**Ranh giới transaction đặt ở use case, không ở adapter.** Python không có `@Transactional`; đừng để mỗi adapter tự `commit`. Mở/commit một **Unit of Work** (session SQLAlchemy) bao trọn use case — ví dụ một dependency của `router.py` mở session, `IssueInvoiceService` chạy trong đó, commit/rollback ở cuối; hoặc khai báo một `TransactionPort`/context-manager ở `application/ports/outbound.py`, hiện thực ở `infrastructure`. Use case ghi nhiều adapter mà mỗi adapter tự commit sẽ mất nguyên tử. Theo quy tắc DDD **một transaction sửa một aggregate** (Vernon) — nhiều aggregate thì dùng eventual consistency.

Domain event: aggregate `Invoice` ghi event nội bộ (`pull_events()`); **adapter/event bus phát sau khi lưu, TRONG cùng transaction** với lệnh ghi, không phát trong lõi. Phát ra bus **ngoài** sau khi commit là **dual-write** (lưu xong nhưng phát lỗi → mất event); muốn phát ra ngoài đáng tin cậy thì dùng **transactional outbox**.

## Standards

- **Dependency Rule ép bằng import-linter (không phải dependency Maven):** khai báo contract trong `pyproject.toml`, chạy `lint-imports` ở CI — vi phạm là fail build. Cấu hình tối thiểu:

```toml
# pyproject.toml — ép Dependency Rule (thay cho compiler/module Maven)
[tool.importlinter]
root_package = "src"

[[tool.importlinter.contracts]]
name = "Hexagonal layers — phụ thuộc chỉ trỏ vào trong"
type = "layers"
layers = ["src.billing.infrastructure", "src.billing.application", "src.billing.domain"]

[[tool.importlinter.contracts]]
name = "Domain không biết framework"
type = "forbidden"
source_modules = ["src.billing.domain", "src.billing.application"]
forbidden_modules = ["fastapi", "sqlalchemy"]

[[tool.importlinter.contracts]]
name = "Inbound không gọi thẳng Outbound (đi qua application)"
type = "forbidden"
source_modules = ["src.billing.infrastructure.inbound"]
forbidden_modules = ["src.billing.infrastructure.outbound"]
```

> **import-linter chặn được phụ thuộc, KHÔNG chặn được naming.** Contract trên là "fitness function" cho chiều import (tương đương ArchUnit bên Java); quy ước đặt tên (`*Port`/`*UseCase`/`*Adapter`) vẫn phải giữ bằng review hoặc một test nhỏ tự viết.

- **Driving port:** tên use case + hậu tố `UseCase` (`IssueInvoiceUseCase`, là `Protocol`); command đi kèm hậu tố `Command` (`IssueInvoiceCommand`).
- **Driven port:** động từ/năng lực + hậu tố `Port` (`SaveInvoicePort`, `NotificationPort`, `PaymentPort`), là `Protocol`.
- **Adapter:** công nghệ/ngữ cảnh + vai trò (`SqlAlchemyInvoiceRepository`, `LogNotificationAdapter`, `HttpPaymentAdapter`) — "structural-implements" port, không cần kế thừa.
- **Package theo chiều port:** `ports/inbound.py` (driving) và `ports/outbound.py` (driven) ở `application`; adapter tương ứng ở `infrastructure/inbound`, `infrastructure/outbound`.
- **Mapper module:** đặt cạnh adapter dùng nó (`web/mapper.py`, `persistence/mapper.py`), là module **hàm thuần** — `to_command`/`to_response` (DTO ↔ command), `to_row`/`to_domain` (aggregate ↔ row). Không codegen, không dùng thư viện mapping ma thuật.
- **Đặt tên file Python `snake_case`, class `PascalCase`:** file `invoice.py`/`issue_invoice.py`/`http_adapter.py`, class `Invoice`/`IssueInvoiceService`/`HttpPaymentAdapter`. Mỗi package có `__init__.py`.
- **Một transaction = một aggregate** (Vernon): mỗi use case ghi một aggregate instance; liên aggregate dùng eventual consistency, không nới transaction.
- Đặt tên theo **Ubiquitous Language** của nghiệp vụ, không theo thuật ngữ kỹ thuật.

## Best Practices

- Giữ `domain`/`application` thuần Python; để `lint-imports` ép ranh giới thay vì dựa vào review.
- Khai báo port bằng `Protocol` để adapter không phải import ngược vào lõi (đảo phụ thuộc).
- Đặt quy tắc nghiệp vụ (invariant, chuyển trạng thái, tính toán) trong aggregate/domain service; `IssueInvoiceService` chỉ **điều phối**.
- Map dữ liệu ở biên: `router.py` gọi `web/mapper.py` để map DTO↔command, adapter gọi `persistence/mapper.py` để map aggregate↔row, ACL map DTO ngoài↔VO — mapper là hàm thuần, không phải class/lib.
- Tham chiếu aggregate khác **bằng ID** (`CustomerId`), không nhúng trực tiếp object.
- Transaction bao quanh **use case** (một Unit of Work/session cho cả use case), không để mỗi adapter tự `commit`; **một transaction sửa một aggregate**.
- Aggregate ghi domain event nội bộ; phát **trong cùng transaction**; ra hệ ngoài thì qua **transactional outbox** để tránh dual-write.
- Thêm kênh vào/ra = thêm **một adapter**; năng lực mới ra ngoài = thêm **một driven port**. Lõi không đổi.

## Anti-patterns

- `import fastapi` / `import sqlalchemy` trong `domain` hoặc `application` (`lint-imports` chặn).
- Nhét quy tắc nghiệp vụ vào `router.py` hoặc `IssueInvoiceService` (phải nằm ở aggregate/domain service).
- Cho aggregate `Invoice` kế thừa `Base` của SQLAlchemy — trộn model nghiệp vụ với model lưu trữ.
- Dùng chung một class cho Pydantic DTO, aggregate và SQLAlchemy row (rò rỉ + anemic model).
- Để DTO của payment service trôi thẳng vào lõi (thiếu Anti-Corruption Layer).
- Import cụ thể adapter trong lõi thay vì phụ thuộc `Protocol` (phá đảo phụ thuộc).
- Phát domain event ngay trong lõi thay vì để adapter phát sau khi lưu.
- Phát domain event ra bus **ngoài** sau commit mà không có outbox (dual-write → mất event).
- Để mỗi adapter tự `commit` trong use case ghi nhiều adapter → nhiều transaction rời, mất nguyên tử.
- Thêm kênh I/O bằng cách sửa lõi thay vì thêm adapter.
- Đặt `mapper.py` ở `domain`/`application` thay vì cạnh adapter trong `infrastructure` (mapper là mối quan tâm BIÊN, không phải lõi).
- Kéo thư viện mapping tự động (vd `automapper`-style) thay cho hàm `to_command`/`to_row` thuần — phá tính zero-magic, khó review diff.

## Examples

Luồng `POST /invoices` (phát hành hoá đơn) đi qua cấu trúc:

1. `router.py` (driving adapter) nhận `IssueInvoiceRequest` (Pydantic DTO), gọi `web/mapper.py.to_command()` để map sang `IssueInvoiceCommand` (dùng VO của domain), rồi gọi `IssueInvoiceUseCase` (lấy qua `Depends`).
2. `IssueInvoiceService` (application) **điều phối**: dựng `Invoice` (aggregate), gọi `PaymentPort` xử lý thanh toán, gọi phương thức nghiệp vụ `invoice.issue()`, rồi `SaveInvoicePort.save()` và `NotificationPort`.
3. Quy tắc nghiệp vụ (invariant, chuyển trạng thái, tính tiền) nằm trong `Invoice`/`Money` ở **domain** — service chỉ gọi, không tự quyết.
4. Các port out được nối tới adapter thật (`SqlAlchemyInvoiceRepository`, `HttpPaymentAdapter`…) qua `container.py` ở **bootstrap**.

## Checklist

Scaffold coi là đúng khi:

- [ ] `lint-imports` xanh; `domain/` + `application/` **không** `import fastapi`/`sqlalchemy`; `inbound` **không** import `outbound`.
- [ ] `pytest` xanh **không cần** DB (unit test lõi mock/fake port); adapter có **integration test** (Testcontainers).
- [ ] Port là `Protocol` khai báo ở `application/ports`.
- [ ] Router chỉ map DTO ↔ command, không chứa quy tắc nghiệp vụ.
- [ ] Adapter map thủ công aggregate ↔ row; aggregate `Invoice` không kế thừa `Base`.
- [ ] Transaction/Unit of Work bao trọn use case (không mỗi adapter tự commit); một transaction một aggregate.
- [ ] Mỗi driven port có đúng một điểm hiện thực ở `infrastructure/outbound`; lắp ráp ở `bootstrap`; domain event phát **trong cùng transaction**.

## References

- [ARD.md](ARD.md) — Dependency Rule, DDD tactical, checklist review PR (mục 7).
- Ghi **lựa chọn kiến trúc này thành ADR** (theo `docs/decisions/_TEMPLATE.md`) trong `docs/decisions/` — vì sao chọn Hexagonal + DDD cho BC này, phương án đã cân nhắc, hệ quả.
- import-linter — <https://import-linter.readthedocs.io>: fitness function ép chiều import (tương đương ArchUnit; Ford/Parsons/Kua, *Building Evolutionary Architectures*).

## Related

- [java-hexagonal-ddd.template.md](java-hexagonal-ddd.template.md) — cùng kiến trúc Hexagonal + DDD, stack Java (Maven multi-module).
- [python-onion-ddd.template.md](python-onion-ddd.template.md) — biến thể Onion: repository `Protocol` ở `domain`, tách Domain Service khỏi Application Service.
- [python-hexagonal-clean-cqrs.template.md](python-hexagonal-clean-cqrs.template.md) — thêm CQRS: tách luồng ghi (Command) khỏi đọc (Query).
