# Template: Python · Hexagonal/Clean + CQRS

## Summary

Blueprint **cấu trúc** cho một Bounded Context viết bằng Python theo kiến trúc **Hexagonal/Clean + CQRS**, tổ chức thành một package `src/<bc>/` với ranh giới ép bằng **import-linter + `typing.Protocol`** (không có compiler như Maven). File mô tả cây thư mục, vai trò & ranh giới từng tầng, chiều phụ thuộc, và điểm cốt lõi của CQRS: **tách luồng GHI (Command) khỏi ĐỌC (Query)** — hai repository port, hai router, hai model. Cây thư mục **minh hoạ bằng domain `billing`** (aggregate `Invoice`) cho dễ hình dung — thay bằng domain thật theo bảng đối chiếu ở [Context](#context). **Không chứa code skeleton** — chỉ là blueprint cấu trúc để scaffold; code nghiệp vụ viết theo blueprint này.

## Context

- **Stack:** Python 3.11+ · FastAPI · SQLAlchemy 2.0 (async) · Pydantic v2 — khớp skeleton `stack/python/` mà backend-init đã scaffold. **CHỈ áp dụng stack Python.**
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC**. Nền tảng port/adapter + `import-linter` giống [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md); quy tắc chung (Dependency Rule, DDD tactical, checklist review) xem [ARD.md](ARD.md); bản Java cùng kiến trúc: [java-hexagonal-clean-cqrs.template.md](java-hexagonal-clean-cqrs.template.md).
- **Khi nào dùng:** đọc/ghi lệch nặng — read model khác hẳn write model, hoặc cần scale đọc/ghi độc lập.
- **Khi nào KHÔNG:** đọc/ghi cùng shape, tải nhẹ → dùng thẳng [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md); CQRS là thừa.
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `billing`; cột phải là "chỗ trống" cần thay khi áp cho domain của bạn.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong cây `billing` |
|---------------------|---------|---------------------------|
| Bounded Context | package gốc `src/<bc>/` | `src/billing/` |
| Aggregate Root (write model) | thực thể gốc cho luồng GHI | `Invoice` |
| Value Object | giá trị bất biến | `Money` |
| Enum trạng thái | trạng thái của aggregate | `InvoiceStatus` |
| Use case GHI (Command) | tình huống thay đổi trạng thái | `IssueInvoice` → `IssueInvoiceCommand` / `…CommandHandler` |
| Use case ĐỌC (Query) | tình huống truy vấn | `GetInvoiceById` → `GetInvoiceByIdQuery` / `…QueryHandler` |
| Read model (View) | Pydantic phẳng tối ưu đọc, KHÁC write model | `InvoiceView` |
| Write repository (driven port) | ghi qua aggregate | `InvoiceWriteRepository` |
| Read repository (driven port) | đọc trả view | `InvoiceReadRepository` |
| Tài nguyên URL | danh từ trên REST path | `invoices` |

## Problem

Khi đọc và ghi lệch nhau nặng — màn hình đọc cần shape phẳng gộp nhiều nguồn, còn ghi cần aggregate đầy đủ invariant — nhét cả hai vào chung một model làm write model phình ra để phục vụ đọc, query kéo cả aggregate nặng chỉ để hiển thị, và không scale đọc/ghi độc lập được. Python lại **không ép ranh giới ở mức biên dịch**, nên rất dễ vô tình `import sqlalchemy` ngay trong lõi hay để query kéo aggregate vào mà không ai chặn. Cần **tách hẳn hai luồng** nhưng không phá Dependency Rule của Hexagonal.

## Solution

CQRS trên nền Hexagonal: **Command đi qua aggregate, trả id — không trả read data. Query bỏ qua aggregate, đọc read model tối ưu (SQL thuần).** Hai driven port tách riêng khai báo bằng `typing.Protocol` (`InvoiceWriteRepository` nhận aggregate, `InvoiceReadRepository` trả view), hai router, hai adapter — ghi dùng SQLAlchemy ORM, đọc dùng SQLAlchemy Core/`text()` SQL thuần (bỏ qua ORM). Phụ thuộc vẫn **chỉ trỏ vào trong** về phía `domain`, ép tự động bằng import-linter.

## Architecture

### Cây thư mục

Cây dưới minh hoạ domain `billing` (aggregate `Invoice`) — một Bounded Context là một package `src/billing/`. Ở **package lá** chỉ nêu **một file tượng trưng**; chú thích `+ …` báo còn file cùng loại — điều quan trọng là **cây package** và ranh giới GHI/ĐỌC, không phải liệt kê hết file.

```
src/billing/                                          # 1 Bounded Context (thay module "example" của skeleton)
├── domain/                                           # WRITE MODEL — thuần Python, KHÔNG fastapi/sqlalchemy
│   └── model/
│       └── invoice/                                  # gói theo AGGREGATE
│           ├── invoice.py                            #   AGGREGATE ROOT — gọn cho luồng GHI (+ InvoiceStatus)
│           └── vo/
│               └── money.py                          #   VALUE OBJECT (+ invoice_id.py)
│
├── application/                                      # điều phối use case — thuần Python, TÁCH command/query
│   ├── command/                                      # luồng GHI
│   │   ├── issue_invoice.py                          #   IssueInvoiceCommand (dataclass)
│   │   └── handlers/
│   │       └── issue_invoice_handler.py              #   IssueInvoiceCommandHandler — qua aggregate, trả id
│   ├── query/                                        # luồng ĐỌC
│   │   ├── get_invoice.py                            #   GetInvoiceByIdQuery + InvoiceView (READ MODEL, Pydantic)
│   │   └── handlers/
│   │       └── get_invoice_handler.py                #   GetInvoiceByIdQueryHandler — đọc THẲNG, bỏ qua aggregate
│   └── ports/
│       └── outbound.py                               #   InvoiceWriteRepository / InvoiceReadRepository (Protocol) — TÁCH RIÊNG
│
├── infrastructure/                                   # adapter — nơi DUY NHẤT có fastapi/sqlalchemy/mạng
│   ├── inbound/
│   │   └── web/
│   │       ├── command_router.py                     #   route GHI (POST) — gọi mapper.py để map DTO -> command
│   │       ├── query_router.py                       #   route ĐỌC (GET) — trả InvoiceView
│   │       ├── schemas.py                            #   Pydantic request DTO (+ …)
│   │       └── mapper.py                             #   DTO ghi → command — hàm to_command/to_response, HAND-WRITTEN
│   └── outbound/
│       └── persistence/
│           ├── write/
│           │   ├── models.py                         #   InvoiceRow (SQLAlchemy ORM) — RIÊNG khỏi aggregate
│           │   ├── mapper.py                         #   hàm to_row/to_domain (aggregate ↔ InvoiceRow) — HAND-WRITTEN
│           │   └── adapter.py                        #   SqlAlchemyInvoiceWriteRepository -> InvoiceWriteRepository
│           └── read/
│               ├── queries.py                        #   câu text() SELECT cho read model (+ …)
│               └── adapter.py                        #   SqlInvoiceReadRepository — mapping text()->InvoiceView GIỮ TRONG adapter, KHÔNG tách mapper
│
└── bootstrap/
    └── container.py                                  #   cung cấp RIÊNG hai handler (write / read) qua Depends
```

> **Ánh xạ về `api → service → repository` cho ai quen 3 tầng:** hai router (`command_router`/`query_router`) = tầng `api/`; command/query handler = tầng `service/`; hai adapter `write/`+`read/` = tầng `repository/`. CQRS **chẻ mỗi tầng này làm đôi** theo GHI/ĐỌC. Đăng ký cả hai router vào `src/main.py` (chỗ đã chừa comment).

### Vai trò & ranh giới từng tầng

`application` và `infrastructure` **chẻ đôi theo GHI/ĐỌC**; ranh giới không do compiler ép mà do **import-linter + `Protocol`** (xem mục dưới).

- **`domain`** — **write model**: aggregate `Invoice` + VO `Money` cho luồng ghi. Thuần Python, **KHÔNG `import fastapi`/`sqlalchemy`**. Query **không** dùng model này.
- **`application`** — tách `command/` (`IssueInvoiceCommandHandler` đi qua aggregate, trả id) khỏi `query/` (`GetInvoiceByIdQueryHandler` đọc thẳng read model), và **hai `Protocol` port tách riêng** ở `ports/outbound.py`. Read model `InvoiceView` (Pydantic phẳng) đặt ở `query/`, không ở `domain`. Thuần Python.
- **`infrastructure`** — hai router (`command_router`/`query_router`) và hai adapter: `write/` dùng SQLAlchemy ORM, `read/` dùng SQLAlchemy Core/`text()` SQL thuần (bỏ qua ORM). Nơi duy nhất đụng FastAPI/SQLAlchemy/mạng. Map ở biên qua **mapper module hand-written** đặt cạnh adapter: `web/mapper.py` (DTO ghi ↔ command) và `write/mapper.py` (aggregate ↔ row) — không đặt ở `domain`/`application`. **Read side KHÔNG có mapper riêng**: `read/adapter.py` tự map `text()` row → `InvoiceView` ngay trong adapter, vì đây là luồng đọc phẳng một chiều, tách thêm module là thừa tầng.
- **`bootstrap`** — `container.py` cung cấp riêng hai handler (write/read) qua `Depends`. Nơi duy nhất "thấy" cả lõi lẫn adapter.

### Chiều phụ thuộc (ép bằng contract import-linter)

Không có compiler như Maven; "bảng dependency" của Python là **contract import-linter** chạy `lint-imports` ở CI — vi phạm là **fail build**. Contract giữ nguyên `layers = infrastructure > application > domain` và `forbidden` (domain/application không `import fastapi`/`sqlalchemy`) như [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md); read model `InvoiceView` (Pydantic) đặt ở `application/query` nên layers/forbidden-framework **giữ nguyên**; CQRS **thêm 2 contract riêng** (query không đụng aggregate, inbound↮outbound) — đây chính là "fitness function" ép ranh giới CQRS mà không cần công cụ ngoài:

```toml
# pyproject.toml — ép Dependency Rule (thay cho compiler Maven)
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
name = "Query không đụng aggregate (đọc bỏ qua write model)"
type = "forbidden"
source_modules = ["src.billing.application.query"]
forbidden_modules = ["src.billing.domain.model"]

[[tool.importlinter.contracts]]
name = "Inbound không gọi thẳng Outbound"
type = "forbidden"
source_modules = ["src.billing.infrastructure.inbound"]
forbidden_modules = ["src.billing.infrastructure.outbound"]
```

> Contract "Query không đụng aggregate" **tự động** ép điều mà [Checklist](#checklist) chỉ nhắc — `lint-imports` fail build nếu query handler lỡ import write model. Naming (`*Repository`/`*Handler`) vẫn là quy ước/review.

- **`domain`** — không phụ thuộc gì (thuần Python thư viện chuẩn).
- **`application`** — phụ thuộc `domain`; khai báo port bằng `Protocol` để adapter "structural-implements" mà không import ngược. Được dùng Pydantic cho `InvoiceView`.
- **`infrastructure`** — phụ thuộc `application` + `domain`; nơi duy nhất `import fastapi`/`sqlalchemy`.
- **`bootstrap`** — phụ thuộc tất cả; lắp ráp qua `Depends`.

### Command vs Query

Điểm đặc trưng của CQRS: hai luồng đi hai đường tách hẳn, dùng hai model, hai port, hai adapter.

| Luồng | Đường đi | Model | Điểm mấu chốt |
|-------|----------|-------|---------------|
| **Command (GHI)** | `command_router` → `IssueInvoiceCommandHandler` → aggregate `Invoice` → `InvoiceWriteRepository` (ORM) | Write model (`Invoice`) | Qua aggregate để validate invariant; **trả id, KHÔNG trả read data** |
| **Query (ĐỌC)** | `query_router` → `GetInvoiceByIdQueryHandler` → `InvoiceReadRepository` (`text()` SQL) | Read model (`InvoiceView`) | **Bỏ qua aggregate**; đọc thẳng bằng SQL thuần, trả view phẳng |

Thêm màn hình đọc mới = thêm một `Query` + `QueryHandler` + câu `text()` SQL, **không** đụng aggregate. Thêm hành vi ghi mới = thêm một `Command` + `CommandHandler` đi qua aggregate.

> **Hai mức CQRS + nhất quán:** file này để read/write **chung một DB** (đọc `text()` SQL, ghi qua ORM) nên read model **nhất quán ngay** sau ghi. Nếu sau này tách **read store riêng** (projection cập nhật bất đồng bộ), bạn nhận **eventual consistency** — UI phải chịu được độ trễ, và projection nên nuôi bằng **transactional outbox** (ghi event cùng transaction ghi, relay phát sau; tránh dual-write). CQRS **không bắt buộc** Event Sourcing hay hai DB — đó là các lựa chọn độc lập. Command lý tưởng trả `None` (Young/Dahan); trả `id` là **thoả hiệp thực dụng** đã chọn ở đây.

## Implementation

Khi hiện thực (aggregate, command/query handler, port `Protocol`, hai adapter, container), giữ ranh giới GHI/ĐỌC và các điểm map ở biên:

| Ranh giới | Map ở | Quy tắc |
|-----------|-------|---------|
| DTO web ↔ command | `command_router.py` gọi `web/mapper.py` | `web/mapper.py` khai báo `to_command`/`to_response`: map `IssueInvoiceRequest` (Pydantic) → `IssueInvoiceCommand`; router chỉ gọi handler và trả `{"id": ...}`; không nhét logic. |
| Aggregate ↔ SQLAlchemy row | `write/adapter.py` gọi `write/mapper.py` (`to_row`/`to_domain`) | `InvoiceRow` **riêng** khỏi aggregate; hàm thuần `to_row`/`to_domain` trong `write/mapper.py`, `adapter.py` chỉ `add` + `flush`. Aggregate KHÔNG kế thừa `Base`. |
| Row SQL → read view | `read/adapter.py` (mapping GIỮ TRONG adapter, không tách mapper) | Chạy `text()` SELECT, dựng `InvoiceView` ngay trong `adapter.py`; **không** đụng ORM/aggregate. Đọc là luồng phẳng một chiều nên KHÔNG cần `mapper.py` riêng ở read side. |

`@Transactional` không có ở Python; đặt ranh giới giao dịch (session `commit`/`rollback`) **ở adapter ghi** hoặc dependency của `command_router`, giữ handler thuần Python. **Cảnh báo điều kiện biên:** cách này chỉ nguyên tử khi command ghi **đúng một** aggregate/adapter — trường hợp mặc định vì quy tắc DDD **một transaction sửa một aggregate** (Vernon). Command chạm nhiều aggregate/adapter thì mở **một Unit of Work (session)** bao trọn handler (dependency của router mở/commit, hoặc `TransactionPort`/context-manager ở `application`), đừng để mỗi adapter tự commit → nhiều transaction rời.

## Standards

- **Dependency Rule:** phụ thuộc chỉ trỏ vào trong; `domain` và `application` **không** `import fastapi`/`sqlalchemy` — `lint-imports` fail build nếu vi phạm.
- **Command:** use case + `Command` (`IssueInvoiceCommand`, dataclass) + `CommandHandler` (`IssueInvoiceCommandHandler`, trả id) ở `application/command`.
- **Query:** use case + `Query` (`GetInvoiceByIdQuery`) + `QueryHandler` (`GetInvoiceByIdQueryHandler`, trả `InvoiceView`) ở `application/query`.
- **Port tách đôi:** `InvoiceWriteRepository` (nhận aggregate) và `InvoiceReadRepository` (trả view), là `Protocol` ở `application/ports/outbound.py`.
- **Adapter:** `SqlAlchemyInvoiceWriteRepository` (ORM) và `SqlInvoiceReadRepository` (`text()`/Core), ở `infrastructure/outbound/persistence/{write,read}`.
- **Read model:** `InvoiceView` là Pydantic phẳng ở `application/query`, tách khỏi aggregate `Invoice`.
- **Mapper module (WRITE side only):** đặt cạnh adapter dùng nó (`web/mapper.py`, `write/mapper.py`), là module **hàm thuần** — `to_command`/`to_response` (DTO ↔ command), `to_row`/`to_domain` (aggregate ↔ row). Không codegen, không dùng thư viện mapping ma thuật. **Read side không có mapper riêng** — `read/adapter.py` tự map `text()` → `InvoiceView`.
- **Một transaction = một aggregate** (Vernon): command mặc định ghi một aggregate instance; nhiều aggregate thì dùng eventual consistency, không nới transaction.
- **Ranh giới ép bằng import-linter:** contract chặn `query → domain.model` và `inbound → outbound`; naming vẫn là quy ước/review.
- Đặt tên theo **Ubiquitous Language** của nghiệp vụ, file `.py` snake_case, không theo thuật ngữ kỹ thuật.

## Best Practices

- Giữ `domain`/`application` thuần Python; handler là plain class, wiring ở `container.py`.
- Command **luôn qua aggregate** (để validate invariant) và **chỉ trả id**; không trả read data.
- Query **luôn bỏ qua aggregate**, đọc read model tối ưu bằng `text()`/Core SQL thuần.
- Khai báo port bằng `Protocol` để adapter không phải import ngược vào lõi (đảo phụ thuộc).
- Map dữ liệu WRITE side ở biên: `command_router.py` gọi `web/mapper.py` để map DTO↔command, `write/adapter.py` gọi `write/mapper.py` để map aggregate↔row — mapper là hàm thuần, không phải class/lib. READ side giữ mapping `text()`→`InvoiceView` ngay trong `read/adapter.py`, không tách mapper.
- Read model phẳng, tách hẳn write model — được phép khác cả tên trường lẫn kiểu.
- Transaction bao trọn command **một aggregate** (mặc định); command nhiều aggregate mở một Unit of Work cho cả handler, không mỗi adapter tự commit.
- Tách read store riêng thì chấp nhận **eventual consistency** và nuôi projection bằng **transactional outbox**, không dual-write.
- Chỉ dùng CQRS khi đọc/ghi thực sự lệch; cùng shape thì dùng python-hexagonal-ddd.

## Anti-patterns

- `import fastapi` / `import sqlalchemy` trong `domain` hoặc `application` (`lint-imports` chặn).
- Command handler trả read data (`InvoiceView`) thay vì id.
- Query handler import/dựng aggregate `Invoice` để đọc (phải đọc thẳng read model bằng `text()` SQL).
- Dùng chung một `Protocol` repository cho cả ghi lẫn đọc (mất điểm tách CQRS).
- Dùng chung một class cho write model, read view (`InvoiceView`) và SQLAlchemy row.
- Cho aggregate `Invoice` kế thừa `Base` của SQLAlchemy — trộn model nghiệp vụ với model lưu trữ.
- Để mỗi adapter tự `commit` trong command ghi **nhiều** aggregate/adapter → nhiều transaction rời, mất nguyên tử.
- Nuôi read store tách rời bằng cách phát event sau commit **không có outbox** (dual-write → projection lệch/mất).
- Áp CQRS khi đọc/ghi cùng shape, tải nhẹ (thừa tầng, tăng chi phí bảo trì).
- Đặt `mapper.py` ở `domain`/`application` thay vì cạnh adapter trong `infrastructure` (mapper là mối quan tâm BIÊN, không phải lõi).
- Kéo thư viện mapping tự động (vd `automapper`-style) thay cho hàm `to_command`/`to_row` thuần — phá tính zero-magic, khó review diff.
- Tách thêm `mapper.py` riêng cho read side (`read/`) — mapping `text()`→`InvoiceView` đã đơn giản, tách thêm là thừa tầng.

## Examples

Luồng GHI rồi ĐỌC trên `/invoices` (hai route, hai adapter, hai model):

1. **GHI** — `command_router` nhận `IssueInvoiceRequest`, gọi `web/mapper.py.to_command()` để map sang `IssueInvoiceCommand`, gọi `IssueInvoiceCommandHandler`. Handler dựng `Invoice` (aggregate validate invariant), `InvoiceWriteRepository.save()`, **trả `id`** (HTTP 201 `{"id": ...}`).
2. **ĐỌC** — `query_router` nhận id, gọi `GetInvoiceByIdQueryHandler`. Handler gọi `InvoiceReadRepository.find_by_id()` — adapter chạy `text()` SQL, trả `InvoiceView` phẳng (hoặc 404).
3. Hai port được nối tới hai adapter thật (`SqlAlchemyInvoiceWriteRepository`, `SqlInvoiceReadRepository`) qua `container.py` ở **bootstrap**.

## Checklist

Scaffold coi là đúng khi:

- [ ] `lint-imports` xanh; lõi **không** `import fastapi`/`sqlalchemy` (Pydantic ở `query` được phép); `query` **không** import `domain.model`; `inbound` **không** import `outbound`.
- [ ] Hai repository port (`InvoiceWriteRepository`, `InvoiceReadRepository`) là `Protocol` tách riêng, shape khác nhau.
- [ ] Read model (`InvoiceView`) là Pydantic phẳng, khác write model.
- [ ] Query handler **không** import aggregate; phía đọc dùng `text()`/Core SQL thuần (bỏ qua ORM).
- [ ] Command handler **chỉ trả id**; transaction bao trọn handler (command một aggregate) — nhiều aggregate dùng Unit of Work.
- [ ] `pytest` xanh **không cần** DB (unit test handler mock/fake port); adapter (ghi & đọc) có **integration test** (Testcontainers).

## References

- [ARD.md](ARD.md) — Dependency Rule, DDD tactical, checklist review PR (mục 7).
- Ghi **lựa chọn kiến trúc này thành ADR** (theo `docs/decisions/_TEMPLATE.md`) trong `docs/decisions/` — vì sao chọn CQRS cho BC này (đọc/ghi lệch tới mức nào), phương án đã cân nhắc, hệ quả.
- import-linter — <https://import-linter.readthedocs.io>: fitness function ép chiều import (tương đương ArchUnit; Ford/Parsons/Kua, *Building Evolutionary Architectures*).

## Related

- [java-hexagonal-clean-cqrs.template.md](java-hexagonal-clean-cqrs.template.md) — cùng kiến trúc Hexagonal/Clean + CQRS, stack Java (Maven multi-module).
- [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md) — nền tảng Hexagonal + DDD (một model đọc/ghi); dùng khi đọc/ghi cùng shape.
- [python-onion-ddd.template.md](python-onion-ddd.template.md) — biến thể Onion: repository `Protocol` ở `domain`, tách Domain Service khỏi Application Service.
