# Template: Java · Onion + DDD

## Summary

Blueprint **cấu trúc** cho một Bounded Context viết bằng Java theo kiến trúc **Onion + DDD**, tổ chức thành 5 module Maven bị **trình biên dịch cô lập**. File mô tả cây thư mục, vai trò & ranh giới từng module, chiều phụ thuộc, hai điểm đặc trưng của Onion (repository interface ở `domain`, tách Domain Service khỏi Application Service), quy tắc mapping và quy ước đặt tên. Cây thư mục **minh hoạ bằng domain `billing`** (aggregate `Invoice`) cho dễ hình dung — thay bằng domain thật theo bảng đối chiếu ở [Context](#context). **Không chứa code skeleton** — chỉ là blueprint cấu trúc để scaffold; code nghiệp vụ viết theo blueprint này.

## Context

- **Stack:** Maven multi-module · Java 17 · Spring Boot 3.3.x. **CHỈ áp dụng stack Java.**
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC**. Quy tắc chung (Dependency Rule, vai trò 5 module, checklist review) xem [ARD.md](ARD.md); bản Python cùng kiến trúc: [python-onion-ddd.template.md](python-onion-ddd.template.md).
- **Khi nào dùng:** domain nhiều quy tắc nghiệp vụ, ít kênh vào/ra — nhấn mạnh domain model, phân tầng tường minh. (Đây là **mặc định** của kit; chọn Hexagonal khi số kênh I/O là yếu tố nổi trội.)
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `billing`; cột phải là "chỗ trống" cần thay khi áp cho domain của bạn.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong cây `billing` |
|---------------------|---------|---------------------------|
| Bounded Context | thư mục gốc + segment package | `billing` |
| Aggregate Root | thực thể gốc của cụm nhất quán | `Invoice` |
| Entity con | thực thể nằm trong aggregate | `InvoiceLine` |
| Value Object | giá trị bất biến | `Money`, `TaxRate` |
| Aggregate liên quan | tham chiếu **bằng ID** | `Customer` → `CustomerId` |
| Domain event | biến cố nghiệp vụ | `InvoiceIssuedEvent` |
| Domain service | logic liên nhiều đối tượng | `PricingService` |
| Specification | điều kiện nghiệp vụ tái dùng | `HighValueInvoiceSpec` |
| Repository (ở domain) | cổng lưu trữ khai báo trong lõi | `InvoiceRepository` |
| Use case | một tình huống sử dụng | `IssueInvoice` → `IssueInvoiceService` / `…Command` / `…Request` |
| Gateway (ở application) | năng lực hạ tầng ngoài domain | `NotificationGateway`, `DomainEventPublisher` |
| Lớp khởi động | entrypoint Spring Boot | `BillingApplication` |
| Tài nguyên URL | danh từ trên REST path | `invoices` |

## Problem

Nghiệp vụ dễ bị buộc chặt vào framework và hạ tầng: logic lẫn trong controller hay JPA entity, đổi DB/khung là đụng vào lõi, phải dựng cả Spring + DB mới test được. Với domain nặng quy tắc, còn cần chỗ đặt **logic liên nhiều đối tượng** (không thuộc riêng aggregate nào) và **điều kiện nghiệp vụ tái dùng** sao cho chúng nằm trong lõi, không rò ra tầng điều phối hay hạ tầng.

## Solution

Onion + DDD: các tầng bọc quanh `domain` như vòng tròn đồng tâm, **phụ thuộc chỉ trỏ vào trong** về phía `domain` — vi phạm là **lỗi biên dịch**, không cần review thủ công. Khác Hexagonal ở hai điểm: **repository interface khai báo ngay trong `domain`** (để Domain Service dùng được), và **Domain Service** (nghiệp vụ thuần) tách khỏi **Application Service** (điều phối + transaction). DDD tactical (aggregate, value object, domain event, domain service, specification) giữ toàn bộ quy tắc nghiệp vụ nằm trong lõi.

## Architecture

### Cây thư mục

Cây dưới minh hoạ domain `billing` (aggregate `Invoice`). Mỗi tầng là **một module Maven** đặt tên `billing-<tầng>` để artifactId là duy nhất trong reactor. Ở **package lá** chỉ nêu **một file tượng trưng**; chú thích `+ …` báo còn file cùng loại — điều quan trọng là **cây package**, không phải liệt kê hết file.

```
billing/                                              # Bounded Context minh hoạ (đổi thành BC của bạn) — root aggregator
├── pom.xml                                           # parent (packaging=pom): aggregator + import BOM
├── docs/                                             # tài liệu workflow (backend-init) — ngoài build Maven
│
├── billing-api-contract/                             # hợp đồng liên service — DTO + endpoint, KHÔNG logic
│   └── src/main/java/com/acme/billing/contract/
│       ├── dto/
│       │   └── InvoiceResponse.java                  # DTO phẳng, ổn định (+ IssueInvoiceRequest)
│       └── BillingApi.java                           # @HttpExchange — khai báo endpoint
│
├── billing-domain/                                   # LÕI nghiệp vụ — POJO thuần, KHÔNG Spring/JPA
│   ├── src/main/java/com/acme/billing/domain/
│   │   ├── model/
│   │   │   ├── invoice/                              # gói theo AGGREGATE
│   │   │   │   ├── Invoice.java                      #   AGGREGATE ROOT (+ InvoiceLine, InvoiceStatus)
│   │   │   │   └── vo/
│   │   │   │       └── Money.java                    #   VALUE OBJECT (+ InvoiceId, TaxRate)
│   │   │   └── customer/
│   │   │       └── CustomerId.java                   # tham chiếu aggregate khác BẰNG ID
│   │   ├── event/
│   │   │   └── InvoiceIssuedEvent.java               # domain event (+ DomainEvent nền)
│   │   ├── service/
│   │   │   └── PricingService.java                   # DOMAIN SERVICE — logic liên nhiều đối tượng
│   │   ├── specification/
│   │   │   └── HighValueInvoiceSpec.java             # SPECIFICATION — điều kiện nghiệp vụ tái dùng
│   │   └── repository/
│   │       └── InvoiceRepository.java                # interface KHAI BÁO Ở LÕI (đặc trưng Onion)
│   └── src/test/java/com/acme/billing/domain/
│       └── service/PricingServiceTest.java           # unit test lõi — không cần Spring/DB
│
├── billing-application/                              # điều phối use case — POJO thuần
│   ├── src/main/java/com/acme/billing/application/
│   │   ├── service/
│   │   │   └── IssueInvoiceService.java              # APPLICATION SERVICE — điều phối, KHÔNG nghiệp vụ
│   │   ├── command/
│   │   │   └── IssueInvoiceCommand.java
│   │   └── port/                                     # gateway hạ tầng KHÔNG thuộc domain
│   │       └── NotificationGateway.java              #   (+ DomainEventPublisher, PaymentGateway, EventPublisherGateway, FileStorageGateway)
│   └── src/test/java/com/acme/billing/application/
│       └── service/IssueInvoiceServiceTest.java      # mock repository/gateway, không cần Spring
│
├── billing-infrastructure/                           # VÒNG NGOÀI cùng — hiện thực interface, nơi DUY NHẤT có Spring/JPA/mạng
│   └── src/main/java/com/acme/billing/infrastructure/
│       ├── web/
│       │   ├── InvoiceController.java                # gọi thẳng IssueInvoiceService
│       │   └── mapper/
│       │       └── InvoiceDtoMapper.java             #   MapStruct: DTO ↔ command
│       ├── persistence/                              # driven persistence — 4 folder chuẩn: adapter/entity/mapper/repository
│       │   ├── adapter/
│       │   │   └── JpaInvoiceRepository.java         #   hiện thực InvoiceRepository CỦA DOMAIN (adapter class)
│       │   ├── entity/
│       │   │   └── InvoiceEntity.java                #   entity JPA — RIÊNG khỏi aggregate
│       │   ├── mapper/
│       │   │   └── InvoiceEntityMapper.java          #   MapStruct: aggregate ↔ InvoiceEntity (class riêng, @Mapper)
│       │   └── repository/
│       │       └── SpringDataInvoiceRepository.java  #   Spring Data JPA
│       ├── notification/
│       │   └── EmailNotificationGateway.java         # hiện thực NotificationGateway
│       ├── event/
│       │   └── SpringDomainEventPublisher.java       # cầu nối domain event -> Spring event bus (in-process)
│       ├── messaging/                                # publish event ra ngoài (Kafka) + transactional outbox
│       │   ├── KafkaEventPublisherAdapter.java       #   hiện thực EventPublisherGateway
│       │   └── outbox/
│       │       ├── OutboxEntity.java                 #   bản ghi outbox (JPA) — ghi CÙNG transaction lệnh ghi
│       │       └── OutboxRelay.java                  #   @Scheduled đọc outbox → publish (tránh dual-write)
│       ├── storage/                                  # lưu file/blob (MinIO/S3)
│       │   └── MinioStorageAdapter.java              #   hiện thực FileStorageGateway
│       └── payment/                                  # OUTBOUND HTTP client (Feign/@HttpExchange) = Anti-Corruption Layer
│           ├── PaymentClient.java                    #   @HttpExchange (hoặc @FeignClient) — khai báo lời gọi HTTP
│           └── PaymentGatewayAdapter.java            #   hiện thực PaymentGateway; delegate PaymentClient + ACL map tay
│
└── billing-bootstrap/                                # main() + wiring — module DUY NHẤT "thấy" tất cả
    └── src/main/
        ├── java/com/acme/billing/bootstrap/
        │   ├── BillingApplication.java               # @SpringBootApplication
        │   └── config/
        │       └── BeanConfig.java                   # lắp ráp bean cho lõi (PricingService, Spec, Service)
        └── resources/
            └── application.yml
```

> **Tên module vs tầng:** thư mục/artifactId là `billing-<tầng>` (`billing-domain`, `billing-application`…) để phân biệt rõ trong reactor; phần đuôi (`api-contract`, `domain`, `application`, `infrastructure`, `bootstrap`) là **tầng**, còn package Java giữ nguyên `com.acme.billing.<tầng>`.

### Vai trò & ranh giới từng module

Năm module Maven, mỗi module một trách nhiệm; **ranh giới do trình biên dịch ép** (không khai báo dependency thì không import được).

- **`billing-api-contract`** — hợp đồng gọi liên service: DTO phẳng ổn định + khai báo endpoint (`@HttpExchange`). **Chỉ hợp đồng, KHÔNG logic, KHÔNG domain.**
- **`billing-domain`** — LÕI nghiệp vụ: aggregate (`Invoice`), value object (`Money`), domain event, **domain service** (`PricingService`), **specification** (`HighValueInvoiceSpec`), và **repository interface** (`InvoiceRepository`). **POJO thuần, KHÔNG `import org.springframework.*` / `jakarta.persistence.*` / JDBC.** Vòng trong cùng, không biết gì về hạ tầng.
- **`billing-application`** — Application Service (`IssueInvoiceService`) điều phối use case + **khai báo gateway** hạ tầng không thuộc domain (`NotificationGateway`, `DomainEventPublisher`, `PaymentGateway`). Không chứa quy tắc nghiệp vụ (ở `domain`), không chứa chi tiết hạ tầng (ở `infrastructure`). Vẫn là POJO thuần.
- **`billing-infrastructure`** — vòng ngoài cùng: hiện thực repository của domain (`JpaInvoiceRepository`) + gateway của application, web controller, HTTP client. Nơi duy nhất được đụng Spring, JPA, mạng. Map DTO/entity ↔ kiểu của lõi. Mapper (`InvoiceDtoMapper`, `InvoiceEntityMapper`) sống trong `infrastructure`, co-locate ngay cạnh adapter dùng nó, để adapter (controller, repository) luôn thin.
- **`billing-bootstrap`** — `main()`, `@SpringBootApplication`, cấu hình, lắp ráp bean. **Module duy nhất "thấy" tất cả**; giữ Spring và wiring ra khỏi lõi.

### Chiều phụ thuộc

Mũi tên chỉ trỏ **vào trong**, về phía `domain`:

| Module | Được phụ thuộc |
|--------|----------------|
| `billing-api-contract` | `spring-web` (cho `@HttpExchange` — contract không phải lõi nên được phép) |
| `billing-domain` | **không có** — chỉ `junit-jupiter` scope test |
| `billing-application` | `:billing-domain` — test thêm `mockito-core`, `mockito-junit-jupiter` |
| `billing-infrastructure` | `:billing-application`, `:billing-domain`, `:billing-api-contract`, `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `h2` (runtime), `org.mapstruct:mapstruct` + processor; theo adapter dùng: `spring-kafka` (messaging/outbox), `io.minio:minio` hoặc `s3` (storage), `spring-cloud-openfeign` **hoặc** `spring-web` (`@HttpExchange`) cho HTTP client ra ngoài |
| `billing-bootstrap` | tất cả module trên + `spring-boot-maven-plugin` (repackage) |

### Biến thể: nền tảng FPT eGov (platform baseline) — opt-in ở backend-init

Khi `backend-init` chọn **stack Java + profile "FPT eGov platform"**, root pom **kế thừa `be-egov-parent`** (đã quản BOM Spring Boot/Cloud + version lombok/mapstruct + plugin), các module dùng lại `platform-*`. Cấu trúc **5 module Onion giữ nguyên** (web controller vẫn ở `billing-infrastructure`), chỉ overlay dependency. `domain`/`application` được phép dùng **lombok + `platform-exception`/`platform-security-core`** (POJO/compile-time, KHÔNG kéo Spring runtime vào lõi).

**Root pom** (`billing-parent`, `packaging=pom`): parent `be-egov-parent` + `<properties>` (`billing.version=${project.version}`, `platform.version=1.3.0`) + `<modules>` (`billing-api-contract`, `billing-domain`, `billing-application`, `billing-infrastructure`, `billing-bootstrap`) + `dependencyManagement` (internal `${billing.version}` + `platform-*` `${platform.version}`) + compiler plugin lombok+mapstruct + `-parameters`. **Shape đầy đủ giống bản [java-hexagonal-ddd](java-hexagonal-ddd.template.md) mục "Biến thể nền tảng FPT eGov"**, chỉ khác `<modules>` (Onion 5 module, không có `billing-web-api`).

**Dependency theo module (overlay platform)** — module chỉ khai thứ nó dùng; version do parent/`dependencyManagement` quản:

| Module | Platform + dep chính (bản eGov) |
|--------|----------------------------------|
| `billing-api-contract` | `lombok`; `spring-web` (cho `@HttpExchange`) |
| `billing-domain` | `platform-exception`, `lombok` — repository interface Ở ĐÂY (Onion), **KHÔNG** Spring/JPA |
| `billing-application` | `:billing-domain`, `platform-security-core`, `mapstruct`, `lombok` |
| `billing-infrastructure` | `:billing-application`, `:billing-domain`, `:billing-api-contract`, **`platform-webapi-starter`** (web controller Onion nằm ở đây — kéo theo web/security/error/Feign/OpenAPI + `platform-webapi-core`), `spring-boot-starter-data-jpa`, `mapstruct` + processor, `lombok` |
| `billing-bootstrap` | tất cả module trên + `platform-environment-starter`, `spring-boot-starter`, `spring-boot-starter-actuator`, `spring-boot-maven-plugin` |

> **Không khai lại version** cho `spring-boot-*`/`lombok`/`mapstruct` — `be-egov-parent` đã quản. Chỉ `platform-*` dùng `${platform.version}`, internal module dùng `${billing.version}`. (Nguồn: `api-processor-parent` của DAPS.)

### Ép ranh giới TRONG module bằng ArchUnit

Cô lập Maven chỉ chặn phụ thuộc **liên module**. Còn ranh giới **trong một module** — cycle giữa package, quy ước đặt tên, "web không gọi thẳng persistence", "repository interface phải ở `domain`" — thì compiler không thấy. Bổ sung một **ArchUnit test** chạy cùng `mvn test` làm fitness function (đối xứng với `import-linter` bên bản Python). Thêm `com.tngtech.archunit:archunit-junit5` scope test vào `billing-bootstrap`:

```java
// billing-bootstrap : src/test/java — kiểm thử kiến trúc, chạy cùng `mvn test`
@AnalyzeClasses(packagesOf = BillingApplication.class)
class ArchitectureTest {

    @ArchTest static final ArchRule phu_thuoc_tro_vao_trong =
        layeredArchitecture().consideringOnlyDependenciesInLayers()
            .layer("domain").definedBy("..domain..")
            .layer("application").definedBy("..application..")
            .layer("infrastructure").definedBy("..infrastructure..")
            .whereLayer("infrastructure").mayNotBeAccessedByAnyLayer()
            .whereLayer("application").mayOnlyBeAccessedByLayers("infrastructure");

    @ArchTest static final ArchRule web_khong_goi_thang_persistence =   // compiler KHÔNG bắt được
        noClasses().that().resideInAPackage("..infrastructure.web..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure.persistence..");

    @ArchTest static final ArchRule repository_interface_o_domain =     // ép đặc trưng Onion
        classes().that().haveSimpleNameEndingWith("Repository").and().areInterfaces()
            .should().resideInAPackage("..domain.repository..");

    @ArchTest static final ArchRule khong_cycle =
        slices().matching("com.acme.billing.(*)..").should().beFreeOfCycles();
}
```

Maven ép chiều **liên module**; ArchUnit ép các luật compiler không thấy (cycle, naming, web↮persistence, repository ở đúng `domain`). Hai lớp **bổ trợ**, không thay thế.

### Hai điểm đặc trưng Onion

Cùng "phụ thuộc trỏ vào trong" như Hexagonal, nhưng Onion đặt interface và tách service khác đi:

| Khía cạnh | Onion (file này) | Hexagonal (`java-hexagonal-ddd`) |
|-----------|------------------|----------------------------------|
| Port lưu trữ | `InvoiceRepository` khai báo ở **`domain/repository`** — để Domain Service cũng gọi được | `SaveInvoicePort` khai báo ở `application/port/out` |
| Service | Hai vòng service **tách tên rõ**: Domain Service (`PricingService`, nghiệp vụ thuần, ở `domain`) và Application Service (`IssueInvoiceService`, điều phối, ở `application`) là hai tầng riêng | Cũng có domain service **khi cần**, nhưng không nhấn thành *tầng* riêng — điều phối ở application service, nghiệp vụ trong aggregate/domain service |
| Gateway ngoài | Gateway không thuộc domain (`NotificationGateway`) khai báo ở `application/port` | Driven port khai báo ở `application/port/out` |

> **Điểm phân biệt chắc chắn** giữa hai kiểu là **vị trí repository** (Onion: `domain`; Hexagonal: `application/port/out`) — mà cả hai đều là *quy ước đóng gói*, không phải luật từ nguồn gốc (Cockburn không quy định port thuộc package nào). Còn "tách Domain/Application Service" chỉ là **cách Onion nhấn mạnh**: Hexagonal + DDD vẫn có thể có domain service. Chọn một quy ước và giữ nhất quán.

Hiện thực của **mọi** interface (repository của domain lẫn gateway của application) đều nằm ở `infrastructure` vòng ngoài cùng.

## Implementation

Khi hiện thực (pom, DTO, aggregate, domain service, specification, application service, adapter, wiring), giữ các điểm map ở biên để lõi luôn sạch:

| Ranh giới | Map ở | Quy tắc |
|-----------|-------|---------|
| DTO web ↔ command/VO | `InvoiceController` **delegate** `InvoiceDtoMapper` (MapStruct) | Controller không tự map trường; gọi `InvoiceDtoMapper` để đổi `IssueInvoiceRequest` ↔ `IssueInvoiceCommand` rồi gọi `IssueInvoiceService`. |
| Aggregate ↔ JPA entity | `JpaInvoiceRepository` (ở `persistence/adapter/`) **delegate** `InvoiceEntityMapper` (MapStruct, ở `persistence/mapper/`) | `InvoiceEntity` **riêng** khỏi aggregate `Invoice`, aggregate KHÔNG mang annotation JPA; `InvoiceEntityMapper` (MapStruct) sinh `toEntity`/`toDomain`. |
| Domain event → event bus | `SpringDomainEventPublisher` | Adapter dịch domain event sang Spring event; lõi không biết Spring. |
| DTO service ngoài ↔ VO domain | `PaymentGatewayAdapter` = **Anti-Corruption Layer** | ACL không chỉ đổi tên trường — nó **dịch ngữ nghĩa giữa hai model** (model hệ ngoài ↔ model của bạn), bảo vệ lõi khỏi khái niệm "lạ". DTO của payment service không lọt vào lõi. |

**Ranh giới transaction đặt ở use case, không ở adapter.** Một use case có thể ghi nhiều aggregate/adapter và cần nguyên tử **toàn use case**; đặt `@Transactional` lẻ ở từng adapter sẽ tạo nhiều transaction rời → mất nguyên tử. Để giữ `application` thuần POJO mà transaction vẫn bao trọn use case: khai báo một **`TransactionPort` (Unit of Work)** ở `application/port`, hiện thực `SpringTransactionAdapter` ở `infrastructure`, `IssueInvoiceService` gọi `txPort.inTransaction(() -> …)`; hoặc bọc transactional proxy quanh service ở `bootstrap`. Theo quy tắc DDD **một transaction sửa một aggregate** (Vernon, *Effective Aggregate Design*) — cần đổi nhiều aggregate thì dùng eventual consistency (domain event), đừng nới transaction.

Domain event: aggregate `Invoice` ghi event nội bộ (`pullDomainEvents()`); `IssueInvoiceService` **phát sau khi lưu, TRONG cùng transaction** với lệnh ghi, không phát trong aggregate. Phát ra bus **ngoài** sau khi commit là **dual-write** (lưu xong nhưng phát lỗi → mất event); muốn phát ra ngoài đáng tin cậy thì dùng **transactional outbox**.

## Standards

- **Dependency Rule:** phụ thuộc chỉ trỏ vào trong; `billing-domain` và `billing-application` **không** có dependency Spring/JPA — vi phạm là lỗi compile, không cần review thủ công.
- **Repository interface:** danh từ aggregate + hậu tố `Repository` (`InvoiceRepository`), đặt ở `domain/repository`, **không** annotation.
- **Domain service:** năng lực + hậu tố `Service` (`PricingService`); **application service:** use case + `Service` (`IssueInvoiceService`); **command:** use case + `Command` (`IssueInvoiceCommand`).
- **Specification:** điều kiện + hậu tố `Spec` (`HighValueInvoiceSpec`) với `isSatisfiedBy(...)`.
- **Gateway (application):** vai trò + hậu tố `Gateway` (`NotificationGateway`, `EventPublisherGateway`, `FileStorageGateway`) / `DomainEventPublisher`; **adapter:** công nghệ/ngữ cảnh + vai trò (`JpaInvoiceRepository`, `EmailNotificationGateway`, `KafkaEventPublisherAdapter`, `MinioStorageAdapter`, `PaymentGatewayAdapter`).
- **HTTP client ra ngoài (Feign/@HttpExchange):** interface khai lời gọi HTTP đặt hậu tố `Client` (`PaymentClient`) trong `<service>/`; **ưu tiên `@HttpExchange`** hơn `@FeignClient` (OpenFeign bảo trì). Adapter delegate `*Client` + **ACL map tay**; interface client lý tưởng dùng lại `*-api-contract`/internal-api của service bị gọi. (Publish contract liên-repo + wiring consumer đầy đủ: [ARD.md](ARD.md) mục 6.)
- **Messaging/outbox:** `EventPublisherGateway` ← `KafkaEventPublisherAdapter`; ghi `OutboxEntity` **cùng transaction** lệnh ghi, `OutboxRelay` (`@Scheduled`) publish sau (tránh dual-write). Khác `SpringDomainEventPublisher` (event in-process).
- **Persistence outbound (JPA) = 4 folder chuẩn:** `persistence/adapter/` (adapter class `JpaInvoiceRepository`), `persistence/entity/` (JPA entity), `persistence/mapper/` (MapStruct), `persistence/repository/` (Spring Data). Adapter KHÔNG nằm trực tiếp dưới `persistence/`.
- **Quy tắc mapper (Java — BẮT BUỘC):** mỗi khi một adapter cần map giữa hai model, **TẠO folder `mapper/` cạnh adapter đó** + một **interface MapStruct RIÊNG** (`@Mapper(componentModel = "spring")`, `*DtoMapper` / `*EntityMapper`) — KHÔNG map tay inline trong adapter, KHÔNG gom mapper dùng chung. Vị trí: `web/mapper/` (DTO↔command), `persistence/mapper/` (aggregate↔entity). Ngoại lệ: ACL (`PaymentGatewayAdapter`) map tay để dịch ngữ nghĩa.
- **Một transaction = một aggregate** (Vernon): mỗi use case ghi một aggregate instance; liên aggregate dùng eventual consistency, không nới transaction để ôm nhiều aggregate.
- **Naming ép bằng ArchUnit:** repository interface ở `domain/repository`, adapter kết thúc `Adapter`, gateway kết thúc `Gateway` — ArchUnit test fail nếu lệch (xem mục ArchUnit ở [Architecture](#architecture)).
- Đặt tên theo **Ubiquitous Language** của nghiệp vụ, không theo thuật ngữ kỹ thuật.

## Best Practices

- Giữ `domain`/`application` thuần POJO; để trình biên dịch ép ranh giới thay vì dựa vào review.
- Đặt logic liên nhiều đối tượng vào **Domain Service** (`PricingService`); điều kiện nghiệp vụ tái dùng vào **Specification** (`HighValueInvoiceSpec`); invariant/chuyển trạng thái trong aggregate `Invoice`. `IssueInvoiceService` chỉ **điều phối**.
- Repository interface ở `domain` để Domain Service dùng được; hiện thực JPA ở `infrastructure`.
- Map dữ liệu ở biên: controller **delegate** `InvoiceDtoMapper` (MapStruct) để map DTO↔command, adapter persistence **delegate** `InvoiceEntityMapper` (MapStruct) để map aggregate↔entity, ACL map DTO ngoài↔VO bằng tay. Mapper co-locate cạnh adapter dùng nó, không gom vào một package infra dùng chung.
- Tham chiếu aggregate khác **bằng ID** (`CustomerId`), không nhúng trực tiếp object.
- Transaction bao quanh **use case** (qua `TransactionPort`/proxy ở `bootstrap`), không rải `@Transactional` ở từng adapter; **một transaction sửa một aggregate**.
- Aggregate ghi domain event nội bộ; application service phát **trong cùng transaction**; ra hệ ngoài thì qua **transactional outbox** để tránh dual-write.

## Anti-patterns

- `import org.springframework.*` / `jakarta.persistence.*` / JDBC trong `billing-domain` hoặc `billing-application`.
- Nhét quy tắc nghiệp vụ vào `InvoiceController` hoặc `IssueInvoiceService` (phải nằm ở aggregate/domain service/specification).
- Gắn annotation JPA (`@Entity`, `@Table`) lên aggregate `Invoice` — trộn model nghiệp vụ với model lưu trữ.
- Đặt `InvoiceRepository` interface ở `application` thay vì `domain` (mất điểm đặc trưng Onion — Domain Service không gọi được).
- Dùng chung một class cho web-DTO, aggregate và JPA-entity (rò rỉ + anemic model).
- Để DTO của payment service trôi thẳng vào lõi (thiếu Anti-Corruption Layer).
- Đặt mapper (`*Mapper`) ở `domain`/`application` — mapper là mối quan tâm biên, chỉ được sống trong `infrastructure`.
- Để MapStruct map thẳng DTO của service ngoài, bỏ qua dịch ngữ nghĩa của ACL (`PaymentGatewayAdapter` phải giữ code tay).
- Phát domain event ngay trong aggregate thay vì để application service phát sau khi lưu.
- Phát domain event ra bus **ngoài** sau commit mà không có outbox (dual-write → mất event).
- Rải `@Transactional` ở từng adapter cho use case ghi nhiều aggregate/adapter → nhiều transaction rời, mất nguyên tử.

## Examples

Luồng `POST /api/invoices` (phát hành hoá đơn) đi qua cấu trúc:

1. `InvoiceController` nhận `IssueInvoiceRequest` (DTO), **delegate** `InvoiceDtoMapper` (MapStruct) để map sang `IssueInvoiceCommand` (dùng VO của domain), gọi `IssueInvoiceService`.
2. `IssueInvoiceService` (application) **điều phối**: dựng `Invoice` (aggregate), gọi `PricingService` cho logic liên đối tượng (vd tính tiền dòng hoá đơn theo `TaxRate`), gọi phương thức nghiệp vụ `invoice.issue()`, rồi `InvoiceRepository.save()`, phát domain event qua `DomainEventPublisher` và gọi `NotificationGateway`.
3. Quy tắc nghiệp vụ nằm trong `Invoice`/`Money`/`PricingService`/`HighValueInvoiceSpec` ở **domain** — application service chỉ gọi, không tự quyết.
4. Interface (`InvoiceRepository`, `NotificationGateway`, `DomainEventPublisher`) được nối tới hiện thực thật ở **infrastructure** qua `BeanConfig` ở **bootstrap**.

## Checklist

Scaffold coi là đúng khi:

- [ ] pom của `billing-domain` và `billing-application` **không** có dependency Spring/JPA.
- [ ] `InvoiceRepository` là interface trong `domain/repository`, không annotation.
- [ ] `PricingService` ở `domain` không import gì ngoài `domain`.
- [ ] `IssueInvoiceService` không chứa if/else nghiệp vụ (chỉ điều phối).
- [ ] `mvn test` xanh **không cần** DB (unit test lõi mock repository/gateway); adapter có **integration test** (Testcontainers).
- [ ] **ArchUnit test xanh:** phụ thuộc trỏ vào trong, web↮persistence, repository ở `domain`, không cycle, naming đúng.
- [ ] Ranh giới transaction ở use case (`TransactionPort`/proxy), không ở adapter; một transaction một aggregate.
- [ ] Domain event phát **trong cùng transaction**; adapter JPA map thủ công aggregate ↔ entity.

## References

- [ARD.md](ARD.md) — Dependency Rule, vai trò 5 module, checklist review PR (mục 7).
- Ghi **lựa chọn kiến trúc này thành ADR** (theo `docs/decisions/_TEMPLATE.md`) trong `docs/decisions/` — vì sao chọn Onion + DDD cho BC này, các phương án đã cân nhắc, hệ quả.
- ArchUnit — <https://www.archunit.org>: fitness function ép ranh giới kiến trúc (Ford/Parsons/Kua, *Building Evolutionary Architectures*).

## Related

- [python-onion-ddd.template.md](python-onion-ddd.template.md) — cùng kiến trúc Onion + DDD, stack Python.
- [java-hexagonal-ddd.template.md](java-hexagonal-ddd.template.md) — biến thể Hexagonal: repository là driven port ở `application`, giao tiếp chỉ qua port.
- [java-hexagonal-clean-cqrs.template.md](java-hexagonal-clean-cqrs.template.md) — thêm CQRS: tách luồng ghi (Command) khỏi đọc (Query).
