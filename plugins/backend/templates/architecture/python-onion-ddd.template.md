# Template: Python · Onion + DDD

## Summary

Blueprint **cấu trúc** cho một Bounded Context viết bằng Python theo kiến trúc **Onion + DDD**, tổ chức thành một package `src/<bc>/` với các vòng tầng bọc quanh `domain` và ranh giới ép bằng **import-linter + `typing.Protocol`** (Python không có compiler cô lập module như Maven). File mô tả cây thư mục, vai trò & ranh giới từng tầng, chiều phụ thuộc, hai điểm đặc trưng của Onion, quy tắc mapping và quy ước đặt tên. Cây thư mục **minh hoạ bằng domain `billing`** (aggregate `Invoice`) cho dễ hình dung — thay bằng domain thật theo bảng đối chiếu ở [Context](#context). **Không chứa code skeleton** — chỉ là blueprint cấu trúc để scaffold; code nghiệp vụ viết theo blueprint này.

## Context

- **Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2. **CHỈ áp dụng stack Python.**
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC**. Quy tắc chung (Dependency Rule, DDD tactical, checklist review) xem [ARD.md](ARD.md); bản Java cùng kiến trúc: [java-onion-ddd.template.md](java-onion-ddd.template.md).
- **Khi nào dùng:** domain nhiều quy tắc nghiệp vụ, ít kênh vào/ra — nhấn mạnh domain model, phân tầng tường minh. (Đây là **mặc định** của kit; chọn Hexagonal khi số kênh I/O là yếu tố nổi trội.)
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `billing`; cột phải là "chỗ trống" cần thay khi áp cho domain của bạn.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong cây `billing` |
|---------------------|---------|---------------------------|
| Bounded Context | package gốc `src/<bc>/` | `src/billing/` |
| Aggregate Root | thực thể gốc của cụm nhất quán | `Invoice` |
| Entity con | thực thể nằm trong aggregate | `InvoiceLine` |
| Value Object | giá trị bất biến | `Money`, `TaxRate` |
| Aggregate liên quan | tham chiếu **bằng ID** | `Customer` → `CustomerId`, `CustomerTier` |
| Domain event | biến cố nghiệp vụ | `InvoiceIssuedEvent`, `InvoicePaidEvent` |
| Domain service | logic liên nhiều đối tượng | `PricingService` |
| Specification | điều kiện nghiệp vụ tái dùng | `HighValueInvoiceSpec` |
| Repository (ở domain) | cổng lưu trữ khai báo trong lõi | `InvoiceRepository` (Protocol) |
| Use case | một tình huống sử dụng | `IssueInvoice` → `IssueInvoiceService` / `…Command` |
| Gateway (ở application) | năng lực hạ tầng ngoài domain | `NotificationGateway`, `DomainEventPublisher` |
| Tài nguyên URL | danh từ trên REST path | `invoices` |

## Problem

Nghiệp vụ dễ bị buộc chặt vào framework và hạ tầng: logic lẫn trong router FastAPI hay model SQLAlchemy, đổi DB/khung là đụng vào lõi, phải dựng cả app + DB mới test được. Với domain nặng quy tắc, còn cần chỗ đặt **logic liên nhiều đối tượng** và **điều kiện nghiệp vụ tái dùng** nằm trong lõi. Python lại **không ép ranh giới ở mức biên dịch**, nên rất dễ vô tình `import sqlalchemy` ngay trong lõi mà không ai chặn.

## Solution

Onion + DDD: các vòng tầng bọc quanh `domain`, **phụ thuộc chỉ trỏ vào trong** — ép tự động bằng import-linter (fail build nếu vi phạm), thay cho compiler cô lập module như Maven. Khác Hexagonal ở hai điểm: **repository `Protocol` khai báo ngay trong `domain`** (để Domain Service dùng được), và **Domain Service** (nghiệp vụ thuần) tách khỏi **Application Service** (điều phối + ranh giới transaction). DDD tactical (aggregate, value object, domain event, domain service, specification) giữ toàn bộ quy tắc nghiệp vụ nằm trong lõi.

## Architecture

### Cây thư mục

Cây dưới minh hoạ domain `billing` (aggregate `Invoice`) — một Bounded Context là một package Python `src/billing/`, mỗi tầng là một sub-package. Ở **package lá** chỉ nêu **một file tượng trưng**; chú thích `+ …` báo còn file cùng loại — điều quan trọng là **cây package**, không phải liệt kê hết file. File dùng snake_case, tầng đi sâu theo package con.

```
src/billing/                                     # Bounded Context minh hoạ (đổi thành BC của bạn) — package gốc
├── __init__.py
├── domain/                                      # LÕI (vòng trong cùng) — thuần Python, KHÔNG fastapi/sqlalchemy
│   ├── model/
│   │   ├── invoice/                             # gói theo AGGREGATE
│   │   │   ├── invoice.py                       #   AGGREGATE ROOT (+ invoice_line.py, invoice_status.py)
│   │   │   └── vo/
│   │   │       └── money.py                     #   VALUE OBJECT (+ invoice_id.py, tax_rate.py)
│   │   └── customer/
│   │       └── customer_id.py                   # tham chiếu aggregate khác BẰNG ID (+ customer_tier.py)
│   ├── events/
│   │   └── invoice_issued_event.py             # domain event (+ domain_event.py nền)
│   ├── services/
│   │   └── pricing_service.py                   # DOMAIN SERVICE — logic liên nhiều đối tượng
│   ├── specifications/
│   │   └── high_value_invoice_spec.py          # SPECIFICATION — điều kiện nghiệp vụ tái dùng
│   ├── repository/
│   │   └── invoice_repository.py               # InvoiceRepository (Protocol) — KHAI BÁO Ở LÕI (đặc trưng Onion)
│   └── exceptions.py                            # lỗi nghiệp vụ của domain (InvoiceNotDraftError + …)
│
├── application/                                 # điều phối use case (vòng giữa) — thuần Python
│   ├── commands/
│   │   └── issue_invoice_command.py            # IssueInvoiceCommand — DTO vào của use case
│   ├── ports/
│   │   └── gateways.py                          # NotificationGateway / DomainEventPublisher (gateway NGOÀI domain)
│   └── services/
│       └── issue_invoice_service.py           # IssueInvoiceService — APPLICATION SERVICE, chỉ điều phối
│
├── infrastructure/                             # VÒNG NGOÀI cùng — hiện thực Protocol; nơi DUY NHẤT có fastapi/sqlalchemy/mạng
│   ├── inbound/
│   │   └── web/
│   │       ├── router.py                        #   FastAPI adapter — gọi web/mapper.py, rồi IssueInvoiceService
│   │       ├── schemas.py                       #   Pydantic request/response (DTO, KHÔNG rò vào domain)
│   │       ├── mapper.py                        #   hàm to_command/to_response (DTO ↔ command) — HAND-WRITTEN
│   │       └── exception_handler.py            #   map lỗi domain -> HTTP status
│   └── outbound/
│       ├── persistence/
│       │   ├── models.py                        #   InvoiceRow (SQLAlchemy) — RIÊNG khỏi aggregate
│       │   ├── mapper.py                        #   hàm to_row/to_domain (aggregate ↔ InvoiceRow) — HAND-WRITTEN
│       │   └── adapter.py                       #   SqlAlchemyInvoiceRepository -> InvoiceRepository (CỦA DOMAIN)
│       ├── notification/
│       │   └── log_adapter.py                   #   LogNotificationAdapter -> NotificationGateway
│       └── event/
│           └── publisher.py                     #   EventBusPublisher -> DomainEventPublisher (cầu nối event bus)
│
└── bootstrap/                                   # lắp ráp — nơi DUY NHẤT "thấy" cả lõi lẫn adapter
    └── container.py                             # dựng PricingService(); truyền InvoiceRepository + gateway vào service
```

> **Ánh xạ về `api → service → repository`:** `infrastructure/inbound/web` = `api/`; `application/services` = `service/`; `infrastructure/outbound/persistence` = `repository/`. Khác Hexagonal: port lưu trữ (`InvoiceRepository`) nằm trong `domain/repository/`, còn `application/ports/gateways.py` chỉ giữ gateway KHÔNG thuộc domain. Đăng ký router của module vào `src/main.py` (chỗ đã chừa comment).

### Vai trò & ranh giới từng tầng

Bốn tầng là các vòng đồng tâm, mỗi tầng một trách nhiệm; **ranh giới do import-linter ép** (không có compiler cô lập như Maven).

- **`domain`** — LÕI nghiệp vụ (vòng trong cùng): aggregate (`Invoice`), value object (`Money`), domain event, **domain service** (`PricingService`), **specification** (`HighValueInvoiceSpec`), và **repository `Protocol`** (`InvoiceRepository`). Thuần Python, **KHÔNG `import fastapi`/`sqlalchemy`**. Không biết gì về hạ tầng.
- **`application`** — Application Service (`IssueInvoiceService`) điều phối use case + **khai báo gateway** hạ tầng không thuộc domain (`NotificationGateway`, `DomainEventPublisher`). Không chứa quy tắc nghiệp vụ (ở `domain`), không chứa chi tiết hạ tầng (ở `infrastructure`). Thuần Python.
- **`infrastructure`** — vòng ngoài cùng, **adapter hiện thực Protocol**: hiện thực repository của domain (`SqlAlchemyInvoiceRepository`) + gateway của application, router FastAPI (inbound), SQLAlchemy repo / HTTP client / event bus (outbound). Nơi duy nhất được đụng FastAPI, SQLAlchemy, mạng. Map DTO/row ↔ kiểu của lõi qua **mapper module hand-written** (`web/mapper.py`, `persistence/mapper.py`) đặt cạnh adapter dùng nó — không đặt ở `domain`/`application`, để adapter luôn thin.
- **`bootstrap`** — `container.py` lắp ráp: dựng `PricingService()`, truyền `InvoiceRepository` + gateway vào `IssueInvoiceService` qua `Depends`. **Nơi duy nhất "thấy" cả lõi lẫn adapter**; giữ FastAPI và wiring ra khỏi lõi.

### Chiều phụ thuộc

Phụ thuộc chỉ trỏ **vào trong**, về phía `domain`. Python không có "bảng dependency Maven"; thay vào đó khai báo contract cho import-linter trong `pyproject.toml` và chạy `lint-imports` ở CI — vi phạm là **fail build**:

```toml
# pyproject.toml — ép Dependency Rule (thay cho compiler Maven)
[tool.importlinter]
root_package = "src"

[[tool.importlinter.contracts]]
name = "Onion layers — phụ thuộc chỉ trỏ vào trong"
type = "layers"
layers = ["src.billing.infrastructure", "src.billing.application", "src.billing.domain"]

[[tool.importlinter.contracts]]
name = "Lõi không biết framework"
type = "forbidden"
source_modules = ["src.billing.domain", "src.billing.application"]
forbidden_modules = ["fastapi", "sqlalchemy"]

[[tool.importlinter.contracts]]
name = "Inbound không gọi thẳng Outbound (đi qua application)"
type = "forbidden"
source_modules = ["src.billing.infrastructure.inbound"]
forbidden_modules = ["src.billing.infrastructure.outbound"]
```

> **import-linter chặn được phụ thuộc, KHÔNG chặn được naming.** Contract trên là "fitness function" cho chiều import (tương đương ArchUnit bên Java), nhưng quy ước đặt tên (`*Repository`/`*Gateway`/`*Adapter`) vẫn phải giữ bằng review hoặc một test nhỏ tự viết.

Đảo phụ thuộc bằng `typing.Protocol`: lõi khai báo `InvoiceRepository`/gateway là `Protocol`; adapter ở `infrastructure` "structural-implements" mà **không cần import ngược** vào lõi. Nhờ đó `infrastructure` phụ thuộc `application` + `domain`, nhưng lõi vẫn không thấy adapter.

| Tầng | Được phụ thuộc |
|------|----------------|
| `domain` | **không có** — chỉ thư viện chuẩn Python; test thêm `pytest` |
| `application` | `domain` (dùng aggregate + `InvoiceRepository` Protocol); test thêm `pytest` mock port |
| `infrastructure` | `application`, `domain`, `fastapi`, `sqlalchemy`, driver DB (async) |
| `bootstrap` | tất cả tầng trên (lắp ráp qua `Depends`) |

### Hai điểm đặc trưng Onion

Cùng "phụ thuộc trỏ vào trong" như Hexagonal, nhưng Onion đặt interface và tách service khác đi:

| Khía cạnh | Onion (file này) | Hexagonal (`python-hexagonal-ddd`) |
|-----------|------------------|------------------------------------|
| Port lưu trữ | `InvoiceRepository` (`Protocol`) khai báo ở **`domain/repository/`** — để Domain Service cũng gọi được | `SaveInvoicePort` khai báo ở `application/ports/outbound.py` |
| Service | Hai vòng service **tách tên rõ**: Domain Service (`PricingService`, nghiệp vụ thuần, ở `domain`) và Application Service (`IssueInvoiceService`, điều phối, ở `application`) là hai tầng riêng | Cũng có domain service **khi cần**, nhưng không nhấn thành *tầng* riêng — điều phối ở application service, nghiệp vụ trong aggregate/domain service |
| Gateway ngoài | Gateway không thuộc domain (`NotificationGateway`) khai báo ở `application/ports/gateways.py` | Driven port khai báo ở `application/ports/outbound.py` |

> **Điểm phân biệt chắc chắn** giữa hai kiểu là **vị trí repository** (Onion: `domain/repository/`; Hexagonal: `application/ports/outbound.py`) — cả hai đều là *quy ước đóng gói*, không phải luật từ nguồn gốc. Còn "tách Domain/Application Service" chỉ là **cách Onion nhấn mạnh**: Hexagonal + DDD vẫn có thể có domain service. Chọn một quy ước và giữ nhất quán.

Hiện thực của **mọi** `Protocol` (repository của domain lẫn gateway của application) đều nằm ở `infrastructure` vòng ngoài cùng.

## Implementation

Khi hiện thực (aggregate, domain service, specification, application service, adapter, container), giữ các điểm map ở biên để lõi luôn sạch, DTO/hạ tầng không rò vào trong:

| Ranh giới | Map ở | Quy tắc |
|-----------|-------|---------|
| DTO web ↔ command/VO | `router.py` gọi hàm trong `web/mapper.py` (inbound adapter) | `web/mapper.py` khai báo `to_command`/`to_response`: map `IssueInvoiceRequest` (Pydantic) ↔ `IssueInvoiceCommand` (VO domain); `router.py` chỉ gọi, không tự map, không nhét logic. |
| Aggregate ↔ SQLAlchemy row | `adapter.py` gọi `persistence/mapper.py` (`to_row`/`to_domain`) | `InvoiceRow` **riêng** khỏi aggregate `Invoice`; hàm thuần `to_row`/`to_domain` trong `persistence/mapper.py`, không codegen. Aggregate KHÔNG kế thừa `Base`. |
| Domain event → event bus | `publisher.py` (`DomainEventPublisher`) | Adapter dịch domain event sang cơ chế bus thật; lõi không biết hạ tầng. |

**Ranh giới transaction đặt ở use case, không ở adapter.** Python không có `@Transactional`; đừng để mỗi adapter tự `commit`. Mở/commit một **Unit of Work** (session SQLAlchemy) bao trọn use case — ví dụ một dependency của `router.py` mở session, `IssueInvoiceService` chạy trong đó, commit/rollback ở cuối; hoặc khai báo một `TransactionPort`/context-manager ở `application`, hiện thực ở `infrastructure`. Use case ghi nhiều adapter mà mỗi adapter tự commit sẽ mất nguyên tử. Theo quy tắc DDD **một transaction sửa một aggregate** (Vernon) — nhiều aggregate thì dùng eventual consistency.

Domain event: aggregate `Invoice` ghi event nội bộ (`pull_events()`); `IssueInvoiceService` **phát sau khi lưu, TRONG cùng transaction** qua `DomainEventPublisher`, không phát trong aggregate. Phát ra bus **ngoài** sau khi commit là **dual-write** (lưu xong nhưng phát lỗi → mất event); muốn phát ra ngoài đáng tin cậy thì dùng **transactional outbox**.

## Standards

- **Dependency Rule:** phụ thuộc chỉ trỏ vào trong; `domain` và `application` **không** `import fastapi`/`sqlalchemy` — `lint-imports` fail build nếu vi phạm.
- **Repository `Protocol`:** danh từ aggregate + `Repository` (`InvoiceRepository`), đặt ở `domain/repository/`.
- **Domain service:** năng lực + `Service` (`PricingService`); **application service:** use case + `Service` (`IssueInvoiceService`); **command:** use case + `Command` (`IssueInvoiceCommand`).
- **Specification:** điều kiện + `Spec` (`HighValueInvoiceSpec`) với `is_satisfied_by(...)`.
- **Gateway (application):** vai trò + `Gateway` (`NotificationGateway`) / `DomainEventPublisher`; **adapter:** công nghệ/ngữ cảnh + vai trò (`SqlAlchemyInvoiceRepository`, `LogNotificationAdapter`) — "structural-implements" Protocol, không cần kế thừa.
- **Package theo tầng:** `domain/` (lõi), `application/` (điều phối), `infrastructure/inbound|outbound` (adapter), `bootstrap/` (wiring).
- **Mapper module:** đặt cạnh adapter dùng nó (`web/mapper.py`, `persistence/mapper.py`), là module **hàm thuần** — `to_command`/`to_response` (DTO ↔ command), `to_row`/`to_domain` (aggregate ↔ row). Không codegen, không dùng thư viện mapping ma thuật.
- **Một transaction = một aggregate** (Vernon): mỗi use case ghi một aggregate instance; liên aggregate dùng eventual consistency, không nới transaction.
- **Ranh giới ép bằng import-linter:** contract `forbidden` chặn `inbound → outbound` và lõi `import fastapi/sqlalchemy`; naming vẫn là quy ước/review.
- Đặt tên theo **Ubiquitous Language** của nghiệp vụ, không theo thuật ngữ kỹ thuật.

## Best Practices

- Giữ `domain`/`application` thuần Python; để `lint-imports` ép ranh giới thay vì dựa vào review.
- Đặt logic liên nhiều đối tượng vào **Domain Service** (`PricingService`); điều kiện nghiệp vụ tái dùng vào **Specification** (`HighValueInvoiceSpec`); invariant/chuyển trạng thái trong aggregate `Invoice`. `IssueInvoiceService` chỉ **điều phối**.
- Khai báo repository `Protocol` ở `domain` để Domain Service dùng được; hiện thực SQLAlchemy ở `infrastructure`.
- Map dữ liệu ở biên: `router.py` gọi `web/mapper.py` để map DTO↔command, `adapter.py` gọi `persistence/mapper.py` để map aggregate↔row — mapper là hàm thuần, không phải class/lib.
- Tham chiếu aggregate khác **bằng ID** (`CustomerId`), không nhúng trực tiếp object.
- Transaction bao quanh **use case** (một Unit of Work/session cho cả use case), không để mỗi adapter tự `commit`; **một transaction sửa một aggregate**.
- Aggregate ghi domain event nội bộ; application service phát **trong cùng transaction**; ra hệ ngoài thì qua **transactional outbox** để tránh dual-write.

## Anti-patterns

- `import fastapi` / `import sqlalchemy` trong `domain` hoặc `application` (`lint-imports` chặn).
- Nhét quy tắc nghiệp vụ vào `router.py` hoặc `IssueInvoiceService` (phải nằm ở aggregate/domain service/specification).
- Cho aggregate `Invoice` kế thừa `Base` của SQLAlchemy — trộn model nghiệp vụ với model lưu trữ.
- Đặt `InvoiceRepository` `Protocol` ở `application` thay vì `domain` (mất điểm đặc trưng Onion — Domain Service không gọi được).
- Dùng chung một class cho Pydantic DTO, aggregate và SQLAlchemy row (rò rỉ + anemic model).
- Import cụ thể adapter trong lõi thay vì phụ thuộc `Protocol` (phá đảo phụ thuộc).
- Phát domain event ngay trong aggregate thay vì để application service phát sau khi lưu.
- Phát domain event ra bus **ngoài** sau commit mà không có outbox (dual-write → mất event).
- Để mỗi adapter tự `commit` trong use case ghi nhiều adapter → nhiều transaction rời, mất nguyên tử.
- Đặt `mapper.py` ở `domain`/`application` thay vì cạnh adapter trong `infrastructure` (mapper là mối quan tâm BIÊN, không phải lõi).
- Kéo thư viện mapping tự động (vd `automapper`-style) thay cho hàm `to_command`/`to_row` thuần — phá tính zero-magic, khó review diff.

## Examples

Luồng `POST /invoices` (phát hành hoá đơn) đi qua cấu trúc:

1. `router.py` (inbound adapter) nhận `IssueInvoiceRequest` (Pydantic DTO), gọi `web/mapper.py.to_command()` để map sang `IssueInvoiceCommand` (dùng VO của domain), rồi gọi `IssueInvoiceService`.
2. `IssueInvoiceService` (application) **điều phối**: dựng `Invoice` (aggregate), gọi `PricingService` cho logic liên đối tượng (vd chiết khấu theo `CustomerTier`), gọi `invoice.issue()`, rồi `InvoiceRepository.save()`, phát domain event qua `DomainEventPublisher` và gọi `NotificationGateway`.
3. Quy tắc nghiệp vụ (invariant, chuyển trạng thái, tính tiền) nằm trong `Invoice`/`Money`/`PricingService`/`HighValueInvoiceSpec` ở **domain** — application service chỉ gọi, không tự quyết.
4. `Protocol` (`InvoiceRepository`, `NotificationGateway`, `DomainEventPublisher`) được nối tới hiện thực thật ở **infrastructure** qua `container.py` ở **bootstrap**.

## Checklist

Scaffold coi là đúng khi:

- [ ] `lint-imports` xanh; `domain/` + `application/` **không** `import fastapi`/`sqlalchemy`; `inbound` **không** import `outbound`.
- [ ] `InvoiceRepository` là `Protocol` trong `domain/repository/` (KHÔNG ở `application`).
- [ ] `PricingService` ở `domain` không import hạ tầng.
- [ ] `IssueInvoiceService` không chứa if/else nghiệp vụ (chỉ điều phối).
- [ ] Adapter map thủ công aggregate ↔ row; aggregate `Invoice` không kế thừa `Base`.
- [ ] Transaction/Unit of Work bao trọn use case (không mỗi adapter tự commit); một transaction một aggregate.
- [ ] `pytest` xanh **không cần** DB (unit test lõi mock/fake port); adapter có **integration test** (Testcontainers); domain event phát **trong cùng transaction**.

## References

- [ARD.md](ARD.md) — Dependency Rule, DDD tactical, checklist review PR (mục 7).
- Ghi **lựa chọn kiến trúc này thành ADR** (theo `docs/decisions/_TEMPLATE.md`) trong `docs/decisions/` — vì sao chọn Onion + DDD cho BC này, phương án đã cân nhắc, hệ quả.
- import-linter — <https://import-linter.readthedocs.io>: fitness function ép chiều import (tương đương ArchUnit; Ford/Parsons/Kua, *Building Evolutionary Architectures*).

## Related

- [java-onion-ddd.template.md](java-onion-ddd.template.md) — cùng kiến trúc Onion + DDD, stack Java (Maven multi-module).
- [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md) — biến thể Hexagonal: repository là driven port ở `application`, giao tiếp chỉ qua port.
- [python-hexagonal-clean-cqrs.template.md](python-hexagonal-clean-cqrs.template.md) — thêm CQRS: tách luồng ghi (Command) khỏi đọc (Query).
