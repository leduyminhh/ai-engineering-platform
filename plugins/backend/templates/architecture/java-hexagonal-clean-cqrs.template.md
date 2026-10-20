# Template: Java · Hexagonal/Clean + CQRS

## Summary

Blueprint **cấu trúc** cho một Bounded Context viết bằng Java theo kiến trúc **Hexagonal/Clean + CQRS**, tổ chức thành 6 module Maven bị **trình biên dịch cô lập**. File mô tả cây thư mục, vai trò & ranh giới từng module, chiều phụ thuộc, và điểm cốt lõi của CQRS: **tách luồng GHI (Command) khỏi ĐỌC (Query)** — hai repository port, hai controller, hai model. Hai controller (command + query) nằm ở **module riêng `billing-web-api`** tách khỏi `billing-infrastructure` (chỉ còn adapter ra/driven), nên "inbound không gọi outbound" do **Maven ép cứng**. Cây thư mục **minh hoạ bằng domain `billing`** (aggregate `Invoice`) cho dễ hình dung — thay bằng domain thật theo bảng đối chiếu ở [Context](#context). **Không chứa code skeleton** — chỉ là blueprint cấu trúc để scaffold; code nghiệp vụ viết theo blueprint này.

## Context

- **Stack:** Maven multi-module · Java 17 · Spring Boot 3.3.x. **CHỈ áp dụng stack Java.**
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC**. Quy tắc chung (Dependency Rule, vai trò module, checklist review) xem [ARD.md](ARD.md); bản Python cùng kiến trúc: [python-hexagonal-clean-cqrs.template.md](python-hexagonal-clean-cqrs.template.md).
- **Biến thể 6 module so với baseline:** ARD mô tả baseline 5 module (web adapter trong `infrastructure/in/web`). Template này **tách hai controller (command+query) ra module riêng `billing-web-api`** → 6 module; `infrastructure` chỉ còn adapter ra (driven).
- **Khi nào dùng:** đọc/ghi lệch nặng — read model khác hẳn write model, hoặc cần scale đọc/ghi độc lập.
- **Khi nào KHÔNG:** đọc/ghi cùng shape, tải nhẹ → dùng thẳng [java-hexagonal-ddd.template.md](java-hexagonal-ddd.template.md); CQRS là thừa tầng.
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `billing`; cột phải là "chỗ trống" cần thay khi áp cho domain của bạn.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong cây `billing` |
|---------------------|---------|---------------------------|
| Bounded Context | thư mục gốc + segment package | `billing` |
| Aggregate Root (write model) | thực thể gốc cho luồng GHI, giữ invariant | `Invoice` |
| Value Object | giá trị bất biến | `Money`, `InvoiceId` |
| Enum trạng thái | trạng thái của aggregate | `InvoiceStatus` |
| Use case GHI (Command) | tình huống thay đổi trạng thái | `IssueInvoice` → `IssueInvoiceCommand` / `…CommandHandler` |
| Use case ĐỌC (Query) | tình huống truy vấn | `GetInvoiceById` → `GetInvoiceByIdQuery` / `…QueryHandler` |
| Read model (View) | record phẳng tối ưu đọc, KHÁC write model | `InvoiceView` |
| Write port | driven port nhận aggregate để lưu | `InvoiceWriteRepository` |
| Read port | driven port trả read model | `InvoiceReadRepository` |
| Adapter vào (web) | hai REST controller ở module riêng | `InvoiceCommandController` / `InvoiceQueryController` ở `billing-web-api` |
| Lớp khởi động | entrypoint Spring Boot | `BillingApplication` |
| Tài nguyên URL | danh từ trên REST path | `invoices` |

## Problem

Khi đọc và ghi lệch nhau nặng — màn hình đọc cần shape phẳng gộp nhiều nguồn, còn ghi cần aggregate đầy đủ invariant — nhét cả hai vào chung một model làm write model phình ra để phục vụ đọc, query kéo cả aggregate nặng chỉ để hiển thị, và không scale đọc/ghi độc lập được. Cần **tách hẳn hai luồng** nhưng không phá Dependency Rule của Hexagonal (phụ thuộc chỉ trỏ vào trong về phía lõi).

## Solution

CQRS trên nền Hexagonal/Clean: **Command đi qua aggregate, trả id — KHÔNG trả read data. Query bỏ qua aggregate, đọc read model tối ưu.** Lõi (`domain` + `application`) là POJO thuần, giao tiếp với thế giới **chỉ qua port** (interface); mọi chi tiết kỹ thuật nằm ở adapter. Hai driven port tách riêng (`InvoiceWriteRepository` nhận aggregate, `InvoiceReadRepository` trả view), hai controller (command/query) ở module `billing-web-api`, hai driven adapter ở `billing-infrastructure` — ghi dùng JPA/ORM, đọc dùng SQL thuần (`JdbcTemplate`). Chia thành **6 module Maven** với **phụ thuộc chỉ trỏ vào trong** về phía `domain` — vi phạm là **lỗi biên dịch**, không cần review thủ công; adapter vào (web) và adapter ra ở hai module tách biệt nên inbound không thể import outbound.

## Architecture

### Cây thư mục

Cây dưới minh hoạ domain `billing` (aggregate `Invoice`). Mỗi tầng là **một module Maven** đặt tên `billing-<tầng>` để artifactId là duy nhất trong reactor. Ở **package lá** chỉ nêu **một file tượng trưng**; chú thích `+ …` báo còn file cùng loại — điều quan trọng là **cây package** và ranh giới GHI/ĐỌC, không phải liệt kê hết file.

```
billing/                                              # Bounded Context minh hoạ (đổi thành BC của bạn) — root aggregator
├── pom.xml                                           # parent (packaging=pom): aggregator + import BOM
├── docs/                                             # tài liệu workflow (backend-init) — ngoài build Maven
│
├── billing-api-contract/                             # hợp đồng liên service — DTO + endpoint, KHÔNG logic
│   └── src/main/java/com/acme/billing/contract/
│       ├── dto/
│       │   └── InvoiceView.java                      # DTO đọc (read shape), phẳng & ổn định (+ IssueInvoiceRequest)
│       └── BillingApi.java                           # @HttpExchange — khai báo endpoint
│
├── billing-domain/                                   # WRITE MODEL — aggregate, POJO thuần, KHÔNG Spring/JPA
│   ├── src/main/java/com/acme/billing/domain/
│   │   ├── model/
│   │   │   └── invoice/                              # gói theo AGGREGATE
│   │   │       ├── Invoice.java                      #   AGGREGATE ROOT — gọn cho luồng GHI (+ InvoiceStatus)
│   │   │       └── vo/
│   │   │           └── Money.java                    #   VALUE OBJECT (+ InvoiceId)
│   │   └── exception/
│   │       └── InvoiceNotDraftException.java         # lỗi nghiệp vụ của domain
│   └── src/test/java/com/acme/billing/domain/
│       └── model/invoice/InvoiceTest.java            # unit test lõi — không cần Spring/DB
│
├── billing-application/                              # POJO thuần — TÁCH command/query, hai port ra
│   ├── src/main/java/com/acme/billing/application/
│   │   ├── command/                                  # luồng GHI
│   │   │   ├── IssueInvoiceCommand.java              #   command DTO vào (+ …Command khác)
│   │   │   └── handler/
│   │   │       └── IssueInvoiceCommandHandler.java   #   qua aggregate, GHI, TRẢ ID
│   │   ├── query/                                    # luồng ĐỌC
│   │   │   ├── GetInvoiceByIdQuery.java              #   query DTO vào (+ …Query khác)
│   │   │   └── handler/
│   │   │       └── GetInvoiceByIdQueryHandler.java   #   đọc THẲNG, BỎ QUA aggregate
│   │   └── port/
│   │       └── out/                                  # DRIVEN port — lõi gọi RA ngoài, tách theo GHI/ĐỌC
│   │           ├── InvoiceWriteRepository.java       #   nhận aggregate       }  TÁCH RIÊNG,
│   │           ├── InvoiceReadRepository.java        #   trả InvoiceView       }  shape khác nhau
│   │           └── EventPublisherPort.java           #   (+ FileStoragePort, PaymentPort) — driven port phía GHI
│   └── src/test/java/com/acme/billing/application/
│       ├── command/handler/
│       │   └── IssueInvoiceCommandHandlerTest.java   # mock write port, không cần Spring
│       └── query/handler/
│           └── GetInvoiceByIdQueryHandlerTest.java   # mock read port, không cần Spring
│
├── billing-web-api/                                  # DRIVING/INBOUND adapter (web) — MODULE RIÊNG, hai controller
│   └── src/main/java/com/acme/billing/webapi/
│       ├── invoice/                                  # gói theo tài nguyên/feature
│       │   ├── InvoiceCommandController.java         #   route GHI (POST) → command handler, trả {id}
│       │   ├── InvoiceQueryController.java           #   route ĐỌC (GET) → query handler, trả InvoiceView
│       │   ├── InvoiceApi.java                       #   interface REST (@RequestMapping/@Tag) — controller implements
│       │   ├── dto/
│       │   │   └── IssueInvoiceRequest.java          #   request DTO kênh web (response đọc dùng InvoiceView từ api-contract)
│       │   └── mapper/
│       │       └── InvoiceCommandDtoMapper.java      #   MapStruct: request DTO → command (CHỈ phía GHI)
│       └── advice/
│           └── ApiExceptionHandler.java              #   @RestControllerAdvice — dùng chung mọi controller
│
├── billing-infrastructure/                           # adapter RA/driven — nơi DUY NHẤT có JPA/JDBC/mạng ra
│   └── src/main/java/com/acme/billing/infrastructure/
│       └── out/
│           ├── messaging/                            # publish event ra ngoài (Kafka) + transactional outbox (phía GHI)
│           │   ├── KafkaEventPublisherAdapter.java   #   hiện thực EventPublisherPort
│           │   └── outbox/
│           │       ├── OutboxEntity.java             #   bản ghi outbox (JPA) — ghi CÙNG transaction lệnh GHI
│           │       └── OutboxRelay.java              #   @Scheduled đọc outbox → publish (tránh dual-write)
│           ├── storage/                              # lưu file/blob (MinIO/S3)
│           │   └── MinioStorageAdapter.java          #   hiện thực FileStoragePort
│           ├── payment/                              # OUTBOUND HTTP client (Feign/@HttpExchange) = Anti-Corruption Layer
│           │   ├── PaymentClient.java                #   @HttpExchange (hoặc @FeignClient) — khai báo lời gọi HTTP
│           │   └── PaymentGatewayAdapter.java        #   hiện thực PaymentPort; delegate PaymentClient + ACL map tay
│           └── persistence/                          # driven adapter — CHẺ ĐÔI ghi/đọc
│               ├── write/                            # phía GHI — JPA: 4 folder chuẩn adapter/entity/mapper/repository
│               │   ├── adapter/
│               │   │   └── InvoiceWritePersistenceAdapter.java  # hiện thực InvoiceWriteRepository; @Transactional Ở ĐÂY
│               │   ├── entity/
│               │   │   └── InvoiceEntity.java        #   entity JPA — RIÊNG khỏi aggregate
│               │   ├── mapper/
│               │   │   └── InvoiceEntityMapper.java  #   MapStruct: aggregate ↔ InvoiceEntity (class riêng, @Mapper)
│               │   └── repository/
│               │       └── SpringDataInvoiceRepository.java
│               └── read/                             # phía ĐỌC — SQL thuần, KHÔNG MapStruct
│                   └── adapter/
│                       └── InvoiceReadPersistenceAdapter.java   # hiện thực InvoiceReadRepository; JdbcTemplate + RowMapper (KHÔNG entity/mapper/repository)
│
└── billing-bootstrap/                                # main() + wiring — module DUY NHẤT "thấy" tất cả
    └── src/main/
        ├── java/com/acme/billing/bootstrap/
        │   ├── BillingApplication.java               # @SpringBootApplication
        │   └── config/
        │       └── BeanConfig.java                   # khai báo hai handler làm bean, lắp ráp port ↔ adapter
        └── resources/
            └── application.yml
```

> **Tên module vs tầng:** thư mục/artifactId là `billing-<tầng>` (`billing-domain`, `billing-application`…) để phân biệt rõ trong reactor; phần đuôi (`api-contract`, `domain`, `application`, `web-api`, `infrastructure`, `bootstrap`) là **tầng**, còn package Java giữ nguyên `com.acme.billing.<tầng>` — riêng `billing-web-api` dùng package `com.acme.billing.webapi`. Các mục bên dưới gọi tắt theo **tầng**.

### Vai trò & ranh giới từng module

Sáu module Maven, mỗi module một trách nhiệm; **ranh giới do trình biên dịch ép** (không khai báo dependency thì không import được). Nét riêng của CQRS: `application` và `infrastructure` **chẻ đôi theo GHI/ĐỌC**.

- **`billing-api-contract`** — hợp đồng gọi liên service: DTO đọc phẳng ổn định (`InvoiceView`) + DTO ghi (`IssueInvoiceRequest`) + khai báo endpoint (`@HttpExchange`). **Chỉ hợp đồng, KHÔNG logic, KHÔNG domain.** Service khác phụ thuộc để gọi bạn; đổi domain thoải mái, giữ contract ổn định.
- **`billing-domain`** — **write model**: aggregate (`Invoice`), value object (`Money`), enum trạng thái (`InvoiceStatus`). **POJO thuần, KHÔNG `import org.springframework.*` / `jakarta.persistence.*` / JDBC.** Đây là tầng trong cùng; **luồng ĐỌC không dùng model này**.
- **`billing-application`** — tách `command/` (`IssueInvoiceCommandHandler` đi qua aggregate, trả id) khỏi `query/` (`GetInvoiceByIdQueryHandler` đọc thẳng read model), và **hai driven port tách riêng** ở `port/out` (`InvoiceWriteRepository` nhận aggregate, `InvoiceReadRepository` trả view). Không chứa quy tắc nghiệp vụ (ở `domain`), không chứa chi tiết hạ tầng (ở `infrastructure`). Vẫn là POJO thuần.
- **`billing-web-api`** — **driving/inbound adapter (web)**, MODULE RIÊNG: hai controller (`InvoiceCommandController` route GHI, `InvoiceQueryController` route ĐỌC) hiện thực driving của `application`, interface REST (`InvoiceApi`), request DTO kênh web, `@RestControllerAdvice`, và mapper request DTO→command (`InvoiceCommandDtoMapper`, **chỉ phía GHI**). Phụ thuộc `application` + `api-contract`, **KHÔNG** phụ thuộc `infrastructure` → không import được adapter ra (Maven chặn). Nơi được đụng Spring Web (MVC).
- **`billing-infrastructure`** — **adapter RA/driven**, chẻ đôi GHI/ĐỌC: `write/` dùng JPA (`InvoiceWritePersistenceAdapter`), `read/` dùng `JdbcTemplate` SQL thuần (`InvoiceReadPersistenceAdapter`). Nơi duy nhất được đụng JPA, JDBC, mạng ra ngoài. Map entity/row ↔ kiểu của lõi. Mapper `InvoiceEntityMapper` (aggregate↔entity, phía GHI) sống ở đây; **phía ĐỌC không dùng MapStruct**, giữ `RowMapper`. **KHÔNG còn chứa web controller** (đã tách sang `billing-web-api`).
- **`billing-bootstrap`** — `main()`, `@SpringBootApplication`, cấu hình, khai báo hai handler làm bean và lắp ráp port ↔ adapter. **Module duy nhất "thấy" tất cả**; giữ Spring và wiring ra khỏi lõi.

### Chiều phụ thuộc

Mũi tên chỉ trỏ **vào trong**, về phía `domain`:

| Module | Được phụ thuộc |
|--------|----------------|
| `billing-api-contract` | `spring-web` (cho `@HttpExchange` — contract không phải lõi nên được phép) |
| `billing-domain` | **không có** — chỉ `junit-jupiter` scope test |
| `billing-application` | `:billing-domain` — test thêm `mockito-core`, `mockito-junit-jupiter` |
| `billing-web-api` | `:billing-application`, `:billing-api-contract`, `spring-boot-starter-web`, `org.mapstruct:mapstruct` + processor (chỉ phía GHI). **KHÔNG** `:billing-infrastructure` — Maven ép inbound↮outbound. Test: `spring-boot-starter-test` (MockMvc) |
| `billing-infrastructure` | `:billing-application`, `:billing-domain`, `:billing-api-contract`, `spring-boot-starter-data-jpa`, **`spring-boot-starter-jdbc`** (cho adapter đọc), `h2` (runtime), `org.mapstruct:mapstruct` + processor (chỉ phía GHI — đọc dùng `RowMapper`); theo adapter dùng: `spring-kafka` (messaging/outbox), `io.minio:minio` hoặc `s3` (storage), `spring-cloud-openfeign` **hoặc** `spring-web` (`@HttpExchange`) cho HTTP client ra ngoài. **KHÔNG** `spring-boot-starter-web` (inbound đã sang `billing-web-api`) |
| `billing-bootstrap` | tất cả 5 module trên + `spring-boot-maven-plugin` (repackage) |

> **Điểm khác về dependency của bản CQRS:** so với một model đọc/ghi chung, `infrastructure` thêm **`spring-boot-starter-jdbc`** để adapter đọc chạy SQL thuần bằng `JdbcTemplate`.

### Biến thể: nền tảng FPT eGov (platform baseline) — opt-in ở backend-init

Khi `backend-init` chọn **stack Java + profile "FPT eGov platform"**, root pom **kế thừa `be-egov-parent`** (đã quản BOM Spring Boot/Cloud + version lombok/mapstruct + plugin), các module dùng lại `platform-*`. Cấu trúc **6 module CQRS giữ nguyên** (hai controller command/query ở `billing-web-api`; adapter ghi/đọc tách ở `billing-infrastructure`), chỉ overlay dependency. `domain`/`application` được phép dùng **lombok + `platform-exception`/`platform-security-core`** (POJO/compile-time, KHÔNG kéo Spring runtime vào lõi).

**Root pom** (`billing-parent`, `packaging=pom`): parent `be-egov-parent` + `<properties>` (`billing.version=${project.version}`, `platform.version=1.3.0`) + `<modules>` (`billing-api-contract`, `billing-domain`, `billing-application`, `billing-web-api`, `billing-infrastructure`, `billing-bootstrap`) + `dependencyManagement` (internal + `platform-*`) + compiler plugin lombok+mapstruct + `-parameters`. **Shape đầy đủ giống bản [java-hexagonal-ddd](java-hexagonal-ddd.template.md) mục "Biến thể nền tảng FPT eGov"**.

**Dependency theo module (overlay platform)** — module chỉ khai thứ nó dùng; version do parent/`dependencyManagement` quản:

| Module | Platform + dep chính (bản eGov) |
|--------|----------------------------------|
| `billing-api-contract` | `lombok`; `spring-web` (cho `@HttpExchange`). DTO đọc (`*View`) + DTO ghi (`*Request`) sống ở đây |
| `billing-domain` | `platform-exception`, `lombok` — WRITE MODEL, **KHÔNG** Spring/JPA |
| `billing-application` | `:billing-domain`, `platform-security-core`, `mapstruct` (chỉ phía GHI), `lombok` |
| `billing-web-api` | `:billing-application`, `:billing-api-contract`, **`platform-webapi-starter`**, `mapstruct` + processor (chỉ phía GHI — đọc trả `*View` thẳng), `lombok`. **KHÔNG** `:billing-infrastructure` |
| `billing-infrastructure` | `:billing-application`, `:billing-domain`, `:billing-api-contract`, `spring-boot-starter-data-jpa` (ghi), **`spring-boot-starter-jdbc`** (đọc SQL thuần), `mapstruct` + processor (chỉ ghi — đọc dùng `RowMapper`), `lombok` |
| `billing-bootstrap` | tất cả module trên + `platform-environment-starter`, `spring-boot-starter`, `spring-boot-starter-actuator`, `spring-boot-maven-plugin` |

> **Không khai lại version** cho `spring-boot-*`/`lombok`/`mapstruct` — `be-egov-parent` đã quản. Chỉ `platform-*` dùng `${platform.version}`, internal module dùng `${billing.version}`. (Nguồn: `api-processor-parent` của DAPS.)

### Ép ranh giới TRONG module bằng ArchUnit

Cô lập Maven chặn phụ thuộc **liên module** — nhờ tách `billing-web-api` thành module riêng, "inbound không gọi thẳng outbound" nay **do Maven ép** (web-api không phụ thuộc infrastructure). Ranh giới đặc thù CQRS còn lại — "**query không được đụng aggregate**", cycle, naming — thì compiler không thấy. Bổ sung một **ArchUnit test** chạy cùng `mvn test` làm fitness function (đối xứng với `import-linter` bên bản Python). Thêm `com.tngtech.archunit:archunit-junit5` scope test vào `billing-bootstrap`:

```java
// billing-bootstrap : src/test/java — kiểm thử kiến trúc, chạy cùng `mvn test`
@AnalyzeClasses(packagesOf = BillingApplication.class)
class ArchitectureTest {

    @ArchTest static final ArchRule phu_thuoc_tro_vao_trong =
        layeredArchitecture().consideringOnlyDependenciesInLayers()
            .layer("domain").definedBy("..domain..")
            .layer("application").definedBy("..application..")
            .layer("web").definedBy("..webapi..")
            .layer("infrastructure").definedBy("..infrastructure..")
            .whereLayer("web").mayNotBeAccessedByAnyLayer()
            .whereLayer("infrastructure").mayNotBeAccessedByAnyLayer()
            .whereLayer("application").mayOnlyBeAccessedByLayers("web", "infrastructure");

    @ArchTest static final ArchRule query_khong_dung_aggregate =        // ép CQRS: đọc bỏ qua aggregate
        noClasses().that().resideInAPackage("..application.query..")
            .should().dependOnClassesThat().resideInAPackage("..domain.model..");

    // inbound↮outbound giờ do MAVEN ép (web-api KHÔNG khai dependency tới infrastructure);
    // giữ luật này làm defense-in-depth, hữu ích nếu sau này gộp lại một module.
    @ArchTest static final ArchRule web_khong_goi_thang_outbound =
        noClasses().that().resideInAPackage("..webapi..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure..");

    @ArchTest static final ArchRule khong_cycle =
        slices().matching("com.acme.billing.(*)..").should().beFreeOfCycles();
}
```

Maven ép chiều **liên module** (gồm inbound↮outbound nhờ web-api tách module); ArchUnit tự động ép "query không import aggregate" (thay vì chỉ nhắc trong [Checklist](#checklist)) cùng cycle/naming + giữ inbound↮outbound làm defense-in-depth. Hai lớp **bổ trợ**, không thay thế.

### Command vs Query

Điểm đặc trưng của CQRS: hai luồng đi hai đường tách biệt, dùng hai model khác nhau, không chia sẻ repository port.

| Luồng | Đường đi | Model | Điểm mấu chốt |
|-------|----------|-------|---------------|
| **Command (GHI)** | `InvoiceCommandController` → `IssueInvoiceCommandHandler` → aggregate `Invoice` → `InvoiceWriteRepository` → `InvoiceWritePersistenceAdapter` (JPA) | Write model (`Invoice`) | Qua aggregate để validate invariant; **trả id, KHÔNG trả read data** |
| **Query (ĐỌC)** | `InvoiceQueryController` → `GetInvoiceByIdQueryHandler` → `InvoiceReadRepository` → `InvoiceReadPersistenceAdapter` (JDBC) | Read model (`InvoiceView`) | **Bỏ qua aggregate**; đọc thẳng bằng SQL, trả view phẳng |

Thêm một use case GHI = thêm một cặp `Command` + `CommandHandler` (dùng write port). Thêm một use case ĐỌC = thêm một cặp `Query` + `QueryHandler` (dùng read port). Hai luồng tiến hoá độc lập.

> **Hai mức CQRS + nhất quán:** file này để read/write **chung một DB** (đọc SQL thuần, ghi qua ORM) nên read model **nhất quán ngay** sau ghi. Nếu sau này tách **read store riêng** (projection cập nhật bất đồng bộ), bạn nhận **eventual consistency** — UI phải chịu được độ trễ, và projection nên nuôi bằng **transactional outbox** (ghi event cùng transaction ghi, relay phát sau; tránh dual-write). CQRS **không bắt buộc** Event Sourcing hay hai DB — đó là các lựa chọn độc lập. Command lý tưởng trả `void` (Young/Dahan); trả `id` là **thoả hiệp thực dụng** đã chọn ở đây.

## Implementation

Khi hiện thực (pom, DTO, aggregate, handler, port, adapter, wiring), giữ ranh giới GHI/ĐỌC và ba điểm map ở biên để lõi luôn sạch, DTO/hạ tầng không rò vào trong:

| Ranh giới | Map ở | Quy tắc |
|-----------|-------|---------|
| DTO web ↔ command | `InvoiceCommandController` (driving adapter GHI, ở `billing-web-api`) **delegate** `InvoiceCommandDtoMapper` (MapStruct, co-locate trong `billing-web-api`) | Controller không tự map trường; gọi `InvoiceCommandDtoMapper` để đổi `IssueInvoiceRequest` → `IssueInvoiceCommand`, gọi handler, trả `{id}`. |
| Aggregate ↔ JPA entity | `InvoiceWritePersistenceAdapter` (driven adapter GHI, ở `write/adapter/`) **delegate** `InvoiceEntityMapper` (MapStruct, ở `write/mapper/`) | `InvoiceEntity` **riêng** khỏi aggregate `Invoice`, aggregate KHÔNG mang annotation JPA; `InvoiceEntityMapper` (MapStruct) sinh `toEntity`/`toDomain`. `@Transactional` đặt **ở adapter ghi** (xem điểm lệch dưới). |
| Row SQL → read view | `InvoiceReadPersistenceAdapter` (driven adapter ĐỌC) | **Giữ `RowMapper`** (JdbcTemplate) dựng `InvoiceView` từ SQL thuần — **KHÔNG dùng MapStruct** ở phía đọc; **không** đụng ORM/aggregate. |

> **Điểm lệch cần chốt — transaction ở adapter, không ở handler:** một số hướng dẫn đặt `@Service`/`@Transactional` trực tiếp trên handler ở `application`. Template này giữ `application` **thuần POJO** — handler là plain class, bean khai báo ở `bootstrap/BeanConfig`, còn ranh giới transaction đặt `@Transactional` **ở adapter ghi**. Nhất quán với quy tắc "domain/application không biết Spring" trong [ARD.md](ARD.md).
>
> **Cảnh báo điều kiện biên:** đặt `@Transactional` ở adapter ghi chỉ nguyên tử khi command ghi **đúng một** aggregate/adapter — đây là **trường hợp mặc định** của CQRS vì quy tắc DDD **một transaction sửa một aggregate** (Vernon). Command chạm nhiều aggregate/adapter sẽ thành **nhiều transaction rời** → dùng **`TransactionPort` (Unit of Work)** ở `application/port/out` (hiện thực ở `infrastructure`, handler gọi `txPort.inTransaction(...)`) hoặc bọc **transactional proxy** quanh handler ở `bootstrap`, để transaction bao trọn handler mà `application` vẫn thuần POJO.

## Standards

- **Dependency Rule:** phụ thuộc chỉ trỏ vào trong; `billing-domain` và `billing-application` **không** có dependency Spring/JPA — vi phạm là lỗi compile, không cần review thủ công.
- **Command:** use case + hậu tố `Command` (`IssueInvoiceCommand`) + `CommandHandler` (`IssueInvoiceCommandHandler`, trả id).
- **Query:** use case + hậu tố `Query` (`GetInvoiceByIdQuery`) + `QueryHandler` (`GetInvoiceByIdQueryHandler`, trả `InvoiceView`).
- **Port tách đôi:** `InvoiceWriteRepository` (nhận aggregate) và `InvoiceReadRepository` (trả view), cùng ở `application/port/out`.
- **Adapter:** `InvoiceWritePersistenceAdapter` (JPA) ở `infrastructure/out/persistence/write/adapter/`, `InvoiceReadPersistenceAdapter` (JDBC) ở `infrastructure/out/persistence/read/adapter/`. Phía GHI dùng đủ 4 folder chuẩn `write/{adapter,entity,mapper,repository}`; phía ĐỌC chỉ `read/adapter/` (SQL thuần — KHÔNG entity/mapper/repository).
- **Quy tắc mapper (Java — BẮT BUỘC, CHỈ phía GHI):** mỗi khi một adapter cần map giữa hai model, **TẠO folder `mapper/` cạnh adapter đó** + một **interface MapStruct RIÊNG** (`@Mapper(componentModel = "spring")`). Vị trí: request DTO → command là `InvoiceCommandDtoMapper` ở `billing-web-api/.../mapper/`; aggregate↔entity là `InvoiceEntityMapper` ở `write/mapper/`. **Phía ĐỌC KHÔNG có mapper MapStruct** — `InvoiceReadPersistenceAdapter` giữ `RowMapper` map row → `InvoiceView` (SQL thuần không dùng MapStruct).
- **Driven adapter ra khác (phía GHI):** `EventPublisherPort` ← `KafkaEventPublisherAdapter` (+ transactional outbox: `OutboxEntity` ghi cùng transaction, `OutboxRelay` `@Scheduled` publish sau — tránh dual-write); `FileStoragePort` ← `MinioStorageAdapter`; HTTP client ra ngoài đặt hậu tố `Client` (`PaymentClient`, **ưu tiên `@HttpExchange`** hơn `@FeignClient`) + adapter delegate client + **ACL map tay**. Mỗi adapter ở `out/<loại>/`. (Publish contract liên-repo + wiring consumer đầy đủ: [ARD.md](ARD.md) mục 6.)
- **Read model:** `InvoiceView` là record phẳng, tách khỏi aggregate `Invoice` — được phép khác cả tên trường lẫn kiểu.
- **Một transaction = một aggregate** (Vernon): command mặc định ghi một aggregate instance; nhiều aggregate thì dùng eventual consistency, không nới transaction.
- **Naming + ranh giới ép bằng ArchUnit:** "query không import aggregate", adapter kết thúc `Adapter`, port kết thúc `Repository` — ArchUnit test fail nếu lệch (xem mục ArchUnit ở [Architecture](#architecture)).
- Đặt tên theo **Ubiquitous Language** của nghiệp vụ, không theo thuật ngữ kỹ thuật.

## Best Practices

- Giữ `domain`/`application` thuần POJO; handler là plain class, để trình biên dịch ép ranh giới và wiring ở `bootstrap`.
- Command **luôn qua aggregate** (để validate invariant, chuyển trạng thái) và **chỉ trả id**; không trả read data.
- Query **luôn bỏ qua aggregate**, đọc read model tối ưu bằng SQL thuần.
- Read model phẳng, tách hẳn write model — được phép khác cả tên trường lẫn kiểu.
- Map dữ liệu ở biên: command controller **delegate** `InvoiceCommandDtoMapper` (MapStruct) để map DTO→command, adapter ghi **delegate** `InvoiceEntityMapper` (MapStruct) để map aggregate↔entity, adapter đọc **giữ `RowMapper`** map row→view (không đổi sang MapStruct). Mapper co-locate cạnh adapter dùng nó.
- Đặt `@Transactional` ở adapter ghi cho command **một aggregate** (mặc định); command nhiều aggregate/adapter thì dùng `TransactionPort`/proxy để transaction bao trọn handler.
- Tách read store riêng thì chấp nhận **eventual consistency** và nuôi projection bằng **transactional outbox**, không dual-write.
- Chỉ dùng CQRS khi đọc/ghi thực sự lệch; cùng shape thì dùng [java-hexagonal-ddd.template.md](java-hexagonal-ddd.template.md).

## Anti-patterns

- `import org.springframework.*` / `jakarta.persistence.*` / JDBC trong `billing-domain` hoặc `billing-application`.
- Command handler trả read data (`InvoiceView`) thay vì id.
- Query handler import/dựng aggregate `Invoice` để đọc (phải đọc thẳng read model qua read port).
- Dùng chung một repository port cho cả ghi lẫn đọc (mất điểm tách CQRS).
- Dùng chung một class cho write model, read view và JPA entity (rò rỉ + anemic model).
- Gắn annotation JPA (`@Entity`, `@Table`) lên aggregate `Invoice` — trộn model nghiệp vụ với model lưu trữ.
- Đặt mapper (`*Mapper`) ở `domain`/`application` — mapper là mối quan tâm biên, chỉ được sống trong `infrastructure`.
- Dùng MapStruct cho phía ĐỌC (`InvoiceReadPersistenceAdapter`) thay vì giữ `RowMapper` — phía đọc SQL thuần không cần/không dùng MapStruct.
- Để MapStruct map thẳng DTO của service ngoài, bỏ qua dịch ngữ nghĩa của ACL (nếu có Anti-Corruption Layer, phần dịch ngữ nghĩa vẫn phải code tay).
- Đặt `@Service`/`@Transactional` lên handler ở `application` (kéo Spring vào lõi — trái điểm lệch ở trên).
- Dựa vào `@Transactional` ở adapter cho command ghi **nhiều** aggregate/adapter → nhiều transaction rời, mất nguyên tử (phải dùng `TransactionPort`/proxy).
- Nuôi read store tách rời bằng cách phát event sau commit **không có outbox** (dual-write → projection lệch/mất).
- `billing-api-contract` phụ thuộc `billing-domain` hoặc chứa logic.
- `billing-web-api` phụ thuộc `billing-infrastructure` hoặc import adapter ra (`..infrastructure.out..`) — phá cô lập module; controller chỉ gọi handler qua `application`.
- Để hai controller lại trong `billing-infrastructure` (hoặc để `billing-infrastructure` giữ `spring-boot-starter-web` cho inbound) — inbound web phải ở `billing-web-api`.
- Áp CQRS khi đọc/ghi cùng shape, tải nhẹ (thừa tầng, tăng chi phí bảo trì).

## Examples

Luồng GHI rồi ĐỌC trên `/api/invoices` (hai route, hai adapter, hai model):

1. **GHI** — `InvoiceCommandController` (driving adapter, ở module `billing-web-api`) nhận `IssueInvoiceRequest` (DTO), **delegate** `InvoiceCommandDtoMapper` (MapStruct) để map sang `IssueInvoiceCommand`, gọi `IssueInvoiceCommandHandler` của `application`. Handler dựng `Invoice` (aggregate validate invariant), gọi `InvoiceWriteRepository.save()` (adapter delegate `InvoiceEntityMapper` để map aggregate ↔ entity), **trả `id`** (HTTP 201 `{ "id": ... }`) — không trả read data.
2. **ĐỌC** — `InvoiceQueryController` (driving adapter) nhận id, gọi `GetInvoiceByIdQueryHandler`. Handler gọi `InvoiceReadRepository.findById()` — adapter chạy SQL thuần bằng `JdbcTemplate` + `RowMapper` (KHÔNG MapStruct), trả `InvoiceView` phẳng (hoặc 404); **không** đụng aggregate.
3. Quy tắc nghiệp vụ (invariant, chuyển trạng thái, tính tiền) nằm trong `Invoice`/`Money` ở **domain** — command handler chỉ điều phối, không tự quyết.
4. Hai port out được nối tới hai adapter thật (`InvoiceWritePersistenceAdapter`, `InvoiceReadPersistenceAdapter`) qua `BeanConfig` ở **bootstrap**.

## Checklist

Scaffold coi là đúng khi:

- [ ] pom của `billing-domain` và `billing-application` **không** có dependency Spring/JPA.
- [ ] Hai repository port (`InvoiceWriteRepository`, `InvoiceReadRepository`) tách riêng, shape khác nhau.
- [ ] Read model (`InvoiceView`) là record phẳng, khác write model.
- [ ] Query handler **không** import aggregate; phía đọc dùng JDBC/SQL thuần.
- [ ] Command handler **chỉ trả id**.
- [ ] Hai controller (`InvoiceCommandController`, `InvoiceQueryController`) nằm ở `billing-web-api`; module này **không** khai dependency tới `billing-infrastructure`; `billing-infrastructure` **không** còn `spring-boot-starter-web` cho inbound.
- [ ] `@Transactional` ở adapter ghi (command một aggregate), không ở handler; command nhiều aggregate dùng `TransactionPort`/proxy.
- [ ] **ArchUnit test xanh:** query không import aggregate, phụ thuộc trỏ vào trong, inbound↮outbound, không cycle.
- [ ] `mvn test` xanh **không cần** DB (unit test handler mock port); adapter (ghi & đọc) có **integration test** (Testcontainers).

## References

- [ARD.md](ARD.md) — Dependency Rule, vai trò module (baseline 5 module; template này tách thêm `billing-web-api` → 6), checklist review PR (mục 7).
- Ghi **lựa chọn kiến trúc này thành ADR** (theo `docs/decisions/_TEMPLATE.md`) trong `docs/decisions/` — vì sao chọn CQRS cho BC này (đọc/ghi lệch tới mức nào), phương án đã cân nhắc, hệ quả.
- ArchUnit — <https://www.archunit.org>: fitness function ép ranh giới kiến trúc (Ford/Parsons/Kua, *Building Evolutionary Architectures*).

## Related

- [python-hexagonal-clean-cqrs.template.md](python-hexagonal-clean-cqrs.template.md) — cùng kiến trúc Hexagonal/Clean + CQRS, stack Python.
- [java-hexagonal-ddd.template.md](java-hexagonal-ddd.template.md) — nền tảng Hexagonal + DDD (một model đọc/ghi); dùng khi đọc/ghi cùng shape.
- [java-onion-ddd.template.md](java-onion-ddd.template.md) — biến thể Onion: repository interface ở `domain`, tách Domain Service khỏi Application Service.
