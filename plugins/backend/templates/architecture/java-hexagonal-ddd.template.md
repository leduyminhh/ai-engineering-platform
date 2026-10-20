# Template: Java · Hexagonal + DDD

## Summary

Blueprint **cấu trúc** cho một Bounded Context viết bằng Java theo kiến trúc **Hexagonal (Ports & Adapters) + DDD**, tổ chức thành 6 module Maven bị **trình biên dịch cô lập**. File mô tả cây thư mục, vai trò & ranh giới từng module, chiều phụ thuộc, luồng một use case, quy tắc mapping và quy ước đặt tên. Điểm nhấn: **adapter web vào (driving) là một module riêng `billing-web-api`** tách khỏi `billing-infrastructure` (chỉ còn adapter ra/driven), nên luật "inbound không gọi outbound" do **Maven ép cứng** thay vì chỉ ArchUnit. Cây thư mục **minh hoạ bằng domain `billing`** (aggregate `Invoice`) cho dễ hình dung — thay bằng domain thật theo bảng đối chiếu ở [Context](#context). **Không chứa code skeleton** — chỉ là blueprint cấu trúc để scaffold; code nghiệp vụ viết theo blueprint này.

## Context

- **Stack:** Maven multi-module · Java 17 · Spring Boot 3.3.x. **CHỈ áp dụng stack Java.**
- **Phạm vi file:** chỉ mô tả **CẤU TRÚC**. Quy tắc chung (Dependency Rule, vai trò module, checklist review) xem [ARD.md](ARD.md); bản Python cùng kiến trúc: [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md).
- **Biến thể 6 module so với baseline:** ARD mô tả baseline 5 module (web adapter nằm trong `infrastructure/in/web`). Template này **tách adapter web vào ra module riêng `billing-web-api`** → 6 module; `infrastructure` chỉ còn adapter ra (driven). Onion vẫn giữ 5 module.
- **Khi nào dùng:** ứng dụng nghiệp vụ vừa–phức tạp, có (hoặc sẽ có) nhiều kênh vào/ra dùng chung một lõi. (Mặc định của kit là Onion + DDD; chọn Hexagonal khi số kênh I/O là yếu tố nổi trội.)
- **Đối chiếu domain minh hoạ ↔ vai trò:** cây dùng domain `billing`; cột phải là "chỗ trống" cần thay khi áp cho domain của bạn.

| Vai trò (chỗ trống) | Ý nghĩa | Ví dụ trong cây `billing` |
|---------------------|---------|---------------------------|
| Bounded Context | thư mục gốc + segment package | `billing` |
| Aggregate Root | thực thể gốc của cụm nhất quán | `Invoice` |
| Entity con | thực thể nằm trong aggregate | `InvoiceLine` |
| Value Object | giá trị bất biến | `Money`, `TaxRate` |
| Aggregate liên quan | tham chiếu **bằng ID** | `Customer` → `CustomerId` |
| Domain event | biến cố nghiệp vụ | `InvoiceIssuedEvent`, `InvoicePaidEvent` |
| Domain service | logic liên nhiều đối tượng | `PricingService` |
| Use case | một tình huống sử dụng | `IssueInvoice` → `IssueInvoiceUseCase` / `…Command` / `…Service` / `…Request` |
| Hệ thống ngoài | năng lực gọi ra ngoài | `Payment` → `PaymentPort` / `PaymentGatewayAdapter` |
| Adapter vào (web) | REST controller hiện thực driving port | `InvoiceController` ở module `billing-web-api` |
| Lớp khởi động | entrypoint Spring Boot | `BillingApplication` |
| Tài nguyên URL | danh từ trên REST path | `invoices` |

## Problem

Nghiệp vụ dễ bị buộc chặt vào framework và hạ tầng: logic lẫn trong controller hay JPA entity, đổi DB/khung là đụng vào lõi, phải dựng cả Spring + DB mới test được, và mỗi kênh vào/ra mới lại kéo theo sửa lõi. Cần tách **lõi nghiệp vụ** khỏi **chi tiết kỹ thuật** sao cho ranh giới không thể vô tình phá vỡ.

## Solution

Hexagonal + DDD: lõi (`domain` + `application`) là POJO thuần, giao tiếp với thế giới **chỉ qua port** (interface); mọi chi tiết kỹ thuật nằm ở adapter cắm vào port. Chia thành **6 module Maven** với **phụ thuộc chỉ trỏ vào trong** về phía `domain` — vi phạm là **lỗi biên dịch**, không cần review thủ công. Adapter vào (web) ở module `billing-web-api`, adapter ra (JPA/HTTP/messaging) ở `billing-infrastructure`: hai loại adapter ở hai module tách biệt nên inbound **không thể** import outbound (Maven chặn). DDD tactical (aggregate, value object, domain event, domain service) giữ quy tắc nghiệp vụ nằm trong lõi.

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
│   │   └── exception/
│   │       └── InvoiceNotDraftException.java         # lỗi nghiệp vụ của domain
│   └── src/test/java/com/acme/billing/domain/
│       └── model/invoice/InvoiceTest.java            # unit test lõi — không cần Spring/DB
│
├── billing-application/                              # điều phối use case — POJO thuần
│   ├── src/main/java/com/acme/billing/application/
│   │   ├── port/
│   │   │   ├── in/                                   # DRIVING port — thế giới gọi VÀO lõi
│   │   │   │   └── IssueInvoiceUseCase.java          #   (+ IssueInvoiceCommand)
│   │   │   └── out/                                  # DRIVEN port — lõi gọi RA ngoài
│   │   │       └── SaveInvoicePort.java              #   (+ NotificationPort, PaymentPort, EventPublisherPort, FileStoragePort)
│   │   └── service/
│   │       └── IssueInvoiceService.java              # điều phối; KHÔNG chứa quy tắc nghiệp vụ
│   └── src/test/java/com/acme/billing/application/
│       └── service/IssueInvoiceServiceTest.java      # mock port, không cần Spring
│
├── billing-web-api/                                  # DRIVING/INBOUND adapter (web) — MODULE RIÊNG, tách khỏi infrastructure
│   └── src/main/java/com/acme/billing/webapi/
│       ├── invoice/                                  # gói theo tài nguyên/feature
│       │   ├── InvoiceController.java                #   @RestController implements InvoiceApi; delegate mapper
│       │   ├── InvoiceApi.java                       #   interface REST (@RequestMapping/@Tag) — controller implements
│       │   ├── dto/
│       │   │   └── IssueInvoiceRequest.java          #   request DTO kênh web (response TÁI DÙNG InvoiceResponse của api-contract)
│       │   └── mapper/
│       │       └── InvoiceDtoMapper.java             #   MapStruct: request → command; domain → InvoiceResponse (api-contract)
│       └── advice/
│           └── ApiExceptionHandler.java              #   @RestControllerAdvice — dùng chung mọi controller
│
├── billing-infrastructure/                           # adapter RA/driven — nơi DUY NHẤT có JPA / HTTP-out / messaging
│   └── src/main/java/com/acme/billing/infrastructure/
│       └── out/
│           ├── persistence/                          # driven adapter (JPA) — 4 folder chuẩn: adapter/entity/mapper/repository
│           │   ├── adapter/
│           │   │   └── InvoicePersistenceAdapter.java  #   hiện thực SaveInvoicePort (adapter class)
│           │   ├── entity/
│           │   │   └── InvoiceEntity.java            #   entity JPA — RIÊNG khỏi aggregate
│           │   ├── mapper/
│           │   │   └── InvoiceEntityMapper.java      #   MapStruct: aggregate ↔ InvoiceEntity (class riêng, @Mapper)
│           │   └── repository/
│           │       └── SpringDataInvoiceRepository.java  #   Spring Data JPA
│           ├── notification/
│           │   └── LogNotificationAdapter.java       #   hiện thực NotificationPort
│           ├── messaging/                            # publish event ra ngoài (Kafka) + transactional outbox
│           │   ├── KafkaEventPublisherAdapter.java   #   hiện thực EventPublisherPort
│           │   └── outbox/
│           │       ├── OutboxEntity.java             #   bản ghi outbox (JPA) — ghi CÙNG transaction lệnh ghi
│           │       └── OutboxRelay.java              #   @Scheduled đọc outbox → publish (tránh dual-write)
│           ├── storage/                              # lưu file/blob (MinIO/S3)
│           │   └── MinioStorageAdapter.java          #   hiện thực FileStoragePort
│           └── payment/                              # OUTBOUND HTTP client (Feign/@HttpExchange) = Anti-Corruption Layer
│               ├── PaymentClient.java                #   @HttpExchange (hoặc @FeignClient) — khai báo lời gọi HTTP
│               └── PaymentGatewayAdapter.java        #   hiện thực PaymentPort; delegate PaymentClient + ACL map tay
│
└── billing-bootstrap/                                # main() + wiring — module DUY NHẤT "thấy" tất cả
    └── src/main/
        ├── java/com/acme/billing/bootstrap/
        │   ├── BillingApplication.java               # @SpringBootApplication
        │   └── config/
        │       └── BeanConfig.java                   # lắp ráp bean cho lõi
        └── resources/
            └── application.yml
```

> **Tên module vs tầng:** thư mục/artifactId là `billing-<tầng>` (`billing-domain`, `billing-application`…) để phân biệt rõ trong reactor; phần đuôi (`api-contract`, `domain`, `application`, `web-api`, `infrastructure`, `bootstrap`) là **tầng**, còn package Java giữ nguyên `com.acme.billing.<tầng>` — riêng `billing-web-api` dùng package `com.acme.billing.webapi` (không gạch nối).

### Vai trò & ranh giới từng module

Sáu module Maven, mỗi module một trách nhiệm; **ranh giới do trình biên dịch ép** (không khai báo dependency thì không import được).

- **`billing-api-contract`** — hợp đồng gọi liên service: DTO phẳng ổn định + khai báo endpoint (`@HttpExchange`). **Chỉ hợp đồng, KHÔNG logic, KHÔNG domain.** Là thứ service khác phụ thuộc để gọi bạn; đổi domain thoải mái, giữ contract ổn định.
- **`billing-domain`** — LÕI nghiệp vụ: aggregate (`Invoice`), value object (`Money`), domain event, domain service. **POJO thuần, KHÔNG `import org.springframework.*` / `jakarta.persistence.*` / JDBC.** Đây là tầng trong cùng, không biết gì về hạ tầng.
- **`billing-application`** — điều phối use case (`IssueInvoiceService`) + **khai báo port** (interface). Không chứa quy tắc nghiệp vụ (ở `domain`), không chứa chi tiết hạ tầng (ở `infrastructure`). Vẫn là POJO thuần.
- **`billing-web-api`** — **driving/inbound adapter (web)**, MODULE RIÊNG: REST controller (`InvoiceController`) hiện thực driving port của `application`, interface REST (`InvoiceApi`), DTO request/response của kênh web, `@RestControllerAdvice`, và mapper DTO↔command (`InvoiceDtoMapper`). Phụ thuộc `application` (gọi use case) + `api-contract`, **KHÔNG** phụ thuộc `infrastructure` → không thể import adapter ra (Maven chặn). Nơi được đụng Spring Web (MVC). Thêm kênh vào khác (CLI/queue) = thêm module/adapter cùng loại, port không đổi.
- **`billing-infrastructure`** — **adapter RA/driven**: JPA repository / HTTP client / messaging. Nơi duy nhất được đụng JPA, HTTP-out, mạng ra ngoài. Map entity ↔ kiểu của lõi. Mapper `InvoiceEntityMapper` (aggregate↔entity) sống ở đây, co-locate cạnh adapter dùng nó, để adapter luôn thin. **KHÔNG còn chứa web controller** (đã tách sang `billing-web-api`).
- **`billing-bootstrap`** — `main()`, `@SpringBootApplication`, cấu hình, lắp ráp bean. **Module duy nhất "thấy" tất cả**; giữ Spring và wiring ra khỏi lõi.

### Chiều phụ thuộc

Mũi tên chỉ trỏ **vào trong**, về phía `domain`:

| Module | Được phụ thuộc |
|--------|----------------|
| `billing-api-contract` | `spring-web` (cho `@HttpExchange` — contract không phải lõi nên được phép) |
| `billing-domain` | **không có** — chỉ `junit-jupiter` scope test |
| `billing-application` | `:billing-domain` — test thêm `mockito-core`, `mockito-junit-jupiter` |
| `billing-web-api` | `:billing-application`, `:billing-api-contract`, `spring-boot-starter-web`, `org.mapstruct:mapstruct` + processor. **KHÔNG** `:billing-infrastructure` — Maven ép inbound↮outbound. Test: `spring-boot-starter-test` (MockMvc) |
| `billing-infrastructure` | `:billing-application`, `:billing-domain`, `:billing-api-contract`, `spring-boot-starter-data-jpa`, `h2` (runtime), `org.mapstruct:mapstruct` + processor; theo adapter dùng: `spring-kafka` (messaging/outbox), `io.minio:minio` hoặc `s3` (storage), `spring-cloud-openfeign` **hoặc** `spring-web` (`@HttpExchange`) cho HTTP client ra ngoài. **KHÔNG** `spring-boot-starter-web` (inbound đã sang `billing-web-api`) |
| `billing-bootstrap` | tất cả 5 module trên + `spring-boot-maven-plugin` (repackage) |

### Biến thể: nền tảng FPT eGov (platform baseline) — opt-in ở backend-init

Khi `backend-init` chọn **stack Java + profile "FPT eGov platform"**, root pom **kế thừa `be-egov-parent`** (đã quản BOM Spring Boot/Cloud + version lombok/mapstruct + plugin) và các module dùng lại thư viện `platform-*` thay vì tự cấu hình. Bảng "Chiều phụ thuộc" ở trên **giữ nguyên cấu trúc module**, chỉ **overlay** dependency như dưới. Khác baseline generic: `domain`/`application` được phép dùng **lombok + `platform-exception`/`platform-security-core`** (POJO/compile-time, KHÔNG kéo Spring runtime vào lõi).

**Root pom** (`billing-parent`, `packaging=pom`) — chỉ giữ phần project-specific, KHÔNG lặp cái parent đã có (Java version, BOM, plugin version):

```xml
<parent>
  <groupId>com.fpt.egov.platform</groupId>
  <artifactId>be-egov-parent</artifactId>
  <version>1.3.0</version>
  <relativePath/>                         <!-- resolve từ .m2/Nexus, không theo path sibling -->
</parent>
<groupId>com.acme</groupId>
<artifactId>billing-parent</artifactId>
<version>1.0.0-SNAPSHOT</version>
<packaging>pom</packaging>

<properties>
  <billing.version>${project.version}</billing.version>
  <platform.version>1.3.0</platform.version>
</properties>

<modules>
  <module>billing-api-contract</module>
  <module>billing-domain</module>
  <module>billing-application</module>
  <module>billing-web-api</module>
  <module>billing-infrastructure</module>
  <module>billing-bootstrap</module>
</modules>

<dependencyManagement>
  <dependencies>
    <!-- Internal modules: quản version bằng ${billing.version} -->
    <dependency><groupId>com.acme</groupId><artifactId>billing-api-contract</artifactId><version>${billing.version}</version></dependency>
    <dependency><groupId>com.acme</groupId><artifactId>billing-domain</artifactId><version>${billing.version}</version></dependency>
    <dependency><groupId>com.acme</groupId><artifactId>billing-application</artifactId><version>${billing.version}</version></dependency>
    <dependency><groupId>com.acme</groupId><artifactId>billing-web-api</artifactId><version>${billing.version}</version></dependency>
    <dependency><groupId>com.acme</groupId><artifactId>billing-infrastructure</artifactId><version>${billing.version}</version></dependency>
    <!-- Platform: quản version bằng ${platform.version} -->
    <dependency><groupId>com.fpt.egov.platform</groupId><artifactId>platform-exception</artifactId><version>${platform.version}</version></dependency>
    <dependency><groupId>com.fpt.egov.platform</groupId><artifactId>platform-shared</artifactId><version>${platform.version}</version></dependency>
    <dependency><groupId>com.fpt.egov.platform</groupId><artifactId>platform-security-core</artifactId><version>${platform.version}</version></dependency>
    <dependency><groupId>com.fpt.egov.platform</groupId><artifactId>platform-webapi-core</artifactId><version>${platform.version}</version></dependency>
    <dependency><groupId>com.fpt.egov.platform</groupId><artifactId>platform-webapi-starter</artifactId><version>${platform.version}</version></dependency>
    <dependency><groupId>com.fpt.egov.platform</groupId><artifactId>platform-environment-starter</artifactId><version>${platform.version}</version></dependency>
  </dependencies>
</dependencyManagement>

<build><plugins>
  <plugin>
    <groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId>
    <configuration>
      <annotationProcessorPaths>
        <path><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><version>${lombok.version}</version></path>
        <path><groupId>org.mapstruct</groupId><artifactId>mapstruct-processor</artifactId><version>${mapstruct.version}</version></path>
      </annotationProcessorPaths>
      <compilerArgs><arg>-parameters</arg></compilerArgs>
    </configuration>
  </plugin>
</plugins></build>
```

**Dependency theo module (overlay platform)** — mỗi module chỉ khai thứ nó dùng; version do parent/`dependencyManagement` quản (KHÔNG khai version ở module):

| Module | Platform + dep chính (bản eGov) |
|--------|----------------------------------|
| `billing-api-contract` | `lombok`; `spring-web` (cho `@HttpExchange`) |
| `billing-domain` | `platform-exception` (base exception/error code), `lombok` — **KHÔNG** Spring/JPA |
| `billing-application` | `:billing-domain`, `platform-security-core` (current-user/validator), `mapstruct`, `lombok` |
| `billing-web-api` | `:billing-application`, `:billing-api-contract`, **`platform-webapi-starter`** (auto-config web/security/error/Feign/OpenAPI — kéo theo `platform-webapi-core`), `mapstruct` + processor, `lombok`. **KHÔNG** `:billing-infrastructure` |
| `billing-infrastructure` | `:billing-application`, `:billing-domain`, `:billing-api-contract`, `spring-boot-starter-data-jpa`, `mapstruct` + processor, `lombok`; HTTP client ra ngoài dùng Feign/`@HttpExchange` (đã có trong `platform-webapi-starter` ở bootstrap) |
| `billing-bootstrap` | tất cả module trên + `platform-environment-starter` (load env/dotenv), `spring-boot-starter`, `spring-boot-starter-actuator`, `spring-boot-maven-plugin` |

> **Không khai lại version** cho `spring-boot-*`, `lombok`, `mapstruct` — `be-egov-parent` đã quản qua BOM/properties. Chỉ `platform-*` dùng `${platform.version}` và internal module dùng `${billing.version}`. (Nguồn: cấu trúc `api-processor-parent` của DAPS.)

### Ép ranh giới TRONG module bằng ArchUnit

Cô lập Maven chặn phụ thuộc **liên module** (không khai báo dependency thì không import được) — nhờ tách `billing-web-api` thành module riêng, "inbound không gọi thẳng outbound" nay **do Maven ép** (web-api không phụ thuộc infrastructure nên không import được adapter ra). Còn ranh giới **trong một module** — cycle giữa package, quy ước đặt tên — thì compiler không thấy. Bổ sung một **ArchUnit test** chạy cùng `mvn test` làm fitness function (đối xứng với `import-linter` bên bản Python). Thêm `com.tngtech.archunit:archunit-junit5` scope test vào `billing-bootstrap` (module thấy mọi package):

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

    // inbound↮outbound giờ do MAVEN ép (web-api KHÔNG khai dependency tới infrastructure);
    // giữ luật này làm defense-in-depth, hữu ích nếu sau này gộp lại một module.
    @ArchTest static final ArchRule web_khong_goi_thang_outbound =
        noClasses().that().resideInAPackage("..webapi..")
            .should().dependOnClassesThat().resideInAPackage("..infrastructure..");

    @ArchTest static final ArchRule khong_cycle =
        slices().matching("com.acme.billing.(*)..").should().beFreeOfCycles();

    @ArchTest static final ArchRule dat_ten_adapter =
        classes().that().resideInAPackage("..infrastructure.out..").and().areNotInterfaces()
            .should().haveSimpleNameEndingWith("Adapter");
}
```

Maven ép chiều **liên module** (gồm cả inbound↮outbound nhờ web-api tách module); ArchUnit ép các luật compiler không thấy (cycle, naming, layered) + giữ inbound↮outbound làm defense-in-depth. Hai lớp **bổ trợ**, không thay thế.

### Port — driving vs driven

Điểm đặc trưng của Hexagonal: lõi giao tiếp với thế giới **chỉ qua port** (interface), mỗi port có một hay nhiều adapter cắm vào.

| Loại port | Vị trí khai báo | Adapter hiện thực | Ví dụ (`billing`) |
|-----------|-----------------|-------------------|-------------------|
| **Driving / primary** — thế giới gọi *vào* lõi | `application/port/in` | `billing-web-api` (module riêng, package `webapi`) | `IssueInvoiceUseCase` ← `InvoiceController` (REST). Thêm CLI/queue consumer = thêm adapter/module cùng loại, port không đổi. |
| **Driven / secondary** — lõi gọi *ra* ngoài | `application/port/out` | `infrastructure/out/*` | `SaveInvoicePort` ← `InvoicePersistenceAdapter` (JPA); `PaymentPort` ← `PaymentGatewayAdapter` (HTTP). Đổi DB/HTTP chỉ đổi adapter. |

Thêm một kênh vào/ra mới = thêm **một adapter** (và nếu là năng lực mới ra ngoài thì thêm một driven port). Lõi (`domain` + `application`) **không đổi**.

> **Port thuộc package nào là quy ước của kit, không phải luật.** Cockburn (Hexagonal) chỉ yêu cầu "giao tiếp qua port, phụ thuộc trỏ vào lõi"; đặt driven port ở `application/port/out` (như file này) hay ở `domain` (như bản Onion) đều hợp lệ. Chọn một và giữ nhất quán trong cả codebase.

## Implementation

Khi hiện thực (pom, DTO, aggregate, port, service, adapter, wiring), giữ ba điểm map ở biên để lõi luôn sạch, DTO/hạ tầng không rò vào trong:

| Ranh giới | Map ở | Quy tắc |
|-----------|-------|---------|
| DTO web ↔ command/VO | `InvoiceController` (driving adapter, ở `billing-web-api`) **delegate** `InvoiceDtoMapper` (MapStruct, co-locate trong `billing-web-api`) | Controller không tự map trường; gọi `InvoiceDtoMapper` để đổi `IssueInvoiceRequest` ↔ `IssueInvoiceCommand`. |
| Aggregate ↔ JPA entity | `InvoicePersistenceAdapter` (driven adapter, ở `persistence/adapter/`) **delegate** `InvoiceEntityMapper` (MapStruct, ở `persistence/mapper/`) | `InvoiceEntity` **riêng** khỏi aggregate `Invoice`, aggregate KHÔNG mang annotation JPA; `InvoiceEntityMapper` (MapStruct) sinh `toEntity`/`toDomain`. |
| DTO service ngoài ↔ VO domain | `PaymentGatewayAdapter` = **Anti-Corruption Layer** | ACL không chỉ đổi tên trường — nó **dịch ngữ nghĩa giữa hai model** (model của hệ ngoài ↔ model của bạn), bảo vệ lõi khỏi khái niệm "lạ". DTO của payment service không lọt vào lõi. |

**Ranh giới transaction đặt ở use case, không ở adapter.** Một use case có thể ghi nhiều aggregate/adapter và cần nguyên tử **toàn use case**; đặt `@Transactional` lẻ ở từng adapter sẽ tạo nhiều transaction rời → mất nguyên tử. Để giữ `application` thuần POJO mà transaction vẫn bao trọn use case: khai báo một **`TransactionPort` (Unit of Work)** ở `application/port/out`, hiện thực `SpringTransactionAdapter` ở `infrastructure`, service gọi `txPort.inTransaction(() -> …)`; hoặc bọc transactional proxy quanh service ở `bootstrap`. Theo quy tắc DDD **một transaction sửa một aggregate** (Vernon, *Effective Aggregate Design*) — cần đổi nhiều aggregate thì dùng eventual consistency (domain event), đừng nới transaction.

Domain event: aggregate `Invoice` ghi event nội bộ (`pullDomainEvents()`); **service/adapter phát sau khi lưu, TRONG cùng transaction** với lệnh ghi. Phát ra bus **ngoài** sau khi commit là **dual-write** (lưu xong nhưng phát lỗi → mất event); muốn phát ra ngoài đáng tin cậy thì dùng **transactional outbox** (ghi event cùng transaction, một relay đọc outbox phát sau).

## Standards

- **Dependency Rule:** phụ thuộc chỉ trỏ vào trong; `billing-domain` và `billing-application` **không** có dependency Spring/JPA — vi phạm là lỗi compile, không cần review thủ công.
- **Driving port:** tên use case + hậu tố `UseCase` (vd `IssueInvoiceUseCase`); command đi kèm hậu tố `Command` (`IssueInvoiceCommand`).
- **Driven port:** động từ/năng lực + hậu tố `Port` (vd `SaveInvoicePort`, `NotificationPort`, `PaymentPort`, `EventPublisherPort`, `FileStoragePort`). Mỗi adapter ra ở `out/<loại>/` hiện thực đúng một driven port.
- **Adapter:** công nghệ/ngữ cảnh + vai trò + hậu tố `Adapter` (vd `InvoicePersistenceAdapter`, `KafkaEventPublisherAdapter`, `MinioStorageAdapter`, `PaymentGatewayAdapter`).
- **HTTP client ra ngoài (Feign/@HttpExchange):** interface khai lời gọi HTTP đặt hậu tố `Client` (`PaymentClient`) cạnh adapter trong `out/<service>/`; **ưu tiên `@HttpExchange`** (Spring khuyến nghị) hơn `@FeignClient` (OpenFeign đang bảo trì). Adapter (`*GatewayAdapter`) delegate `*Client` + **ACL map tay** để DTO ngoài không lọt vào lõi. Interface client lý tưởng dùng lại `*-api-contract`/internal-api của service bị gọi. (Publish contract liên-repo + wiring consumer đầy đủ: [ARD.md](ARD.md) mục 6.)
- **Messaging/outbox:** publish ra ngoài qua `EventPublisherPort` ← `KafkaEventPublisherAdapter`; ghi `OutboxEntity` **cùng transaction** lệnh ghi, `OutboxRelay` (`@Scheduled`) đọc outbox rồi publish (tránh dual-write).
- **Persistence outbound (JPA) = 4 folder chuẩn:** `persistence/adapter/` (adapter class `*PersistenceAdapter`), `persistence/entity/` (JPA entity), `persistence/mapper/` (MapStruct), `persistence/repository/` (Spring Data). Adapter KHÔNG nằm trực tiếp dưới `persistence/`.
- **Quy tắc mapper (Java — BẮT BUỘC):** mỗi khi một adapter cần map giữa hai model, **TẠO folder `mapper/` cạnh adapter đó** + một **interface MapStruct RIÊNG** (`@Mapper(componentModel = "spring")`, `*DtoMapper` / `*EntityMapper`) — KHÔNG map tay inline trong adapter, KHÔNG gom mapper dùng chung. Vị trí: DTO↔command là `InvoiceDtoMapper` ở `billing-web-api/.../mapper/`; aggregate↔entity là `InvoiceEntityMapper` ở `persistence/mapper/`. Ngoại lệ: ACL (`PaymentGatewayAdapter`) map tay để dịch ngữ nghĩa.
- **Package theo chiều port:** `port/in` (driving) và `port/out` (driven) ở `application`; adapter driving (web) ở module `billing-web-api` (package `webapi`), adapter driven ở `infrastructure/out`.
- **Một transaction = một aggregate** (Vernon): mỗi use case ghi một aggregate instance; liên aggregate dùng eventual consistency, không nới transaction để ôm nhiều aggregate.
- **Naming ép bằng ArchUnit:** adapter kết thúc `Adapter`, driven port kết thúc `Port`, driving port kết thúc `UseCase` — ArchUnit test fail nếu lệch (xem mục ArchUnit ở [Architecture](#architecture)).
- Đặt tên theo **Ubiquitous Language** của nghiệp vụ, không theo thuật ngữ kỹ thuật.

## Best Practices

- Giữ `domain`/`application` thuần POJO; để trình biên dịch ép ranh giới thay vì dựa vào review.
- Đặt quy tắc nghiệp vụ (invariant, chuyển trạng thái, tính toán) trong aggregate/domain service; application service (`IssueInvoiceService`) chỉ **điều phối**.
- Map dữ liệu ở biên: controller **delegate** `InvoiceDtoMapper` (MapStruct) để map DTO↔command, adapter persistence **delegate** `InvoiceEntityMapper` (MapStruct) để map aggregate↔entity, ACL (`PaymentGatewayAdapter`) map DTO ngoài↔VO bằng tay. Mapper co-locate cạnh adapter dùng nó, không gom vào một package infra dùng chung.
- Tham chiếu aggregate khác **bằng ID** (`CustomerId`), không nhúng trực tiếp object.
- Transaction bao quanh **use case** (qua `TransactionPort`/proxy ở `bootstrap`), không rải `@Transactional` ở từng adapter; **một transaction sửa một aggregate**.
- Aggregate ghi domain event nội bộ; phát **trong cùng transaction** với lệnh ghi; phát ra hệ ngoài thì qua **transactional outbox** để tránh dual-write.
- Thêm kênh vào/ra = thêm **một adapter**; năng lực mới ra ngoài = thêm **một driven port**. Lõi không đổi.

## Anti-patterns

- `import org.springframework.*` / `jakarta.persistence.*` / JDBC trong `billing-domain` hoặc `billing-application`.
- Nhét quy tắc nghiệp vụ vào `InvoiceController` hoặc `IssueInvoiceService` (phải nằm ở aggregate/domain service).
- Gắn annotation JPA (`@Entity`, `@Table`) lên aggregate `Invoice` — trộn model nghiệp vụ với model lưu trữ.
- Dùng chung một class cho web-DTO, aggregate và JPA-entity (rò rỉ + anemic model).
- Để DTO của payment service trôi thẳng vào lõi (thiếu Anti-Corruption Layer).
- Đặt mapper (`*Mapper`) ở `domain`/`application` — mapper là mối quan tâm biên, chỉ được sống trong `infrastructure`.
- Để MapStruct map thẳng DTO của service ngoài, bỏ qua dịch ngữ nghĩa của ACL (`PaymentGatewayAdapter` phải giữ code tay).
- `billing-api-contract` phụ thuộc `billing-domain` hoặc chứa logic.
- Phát domain event ngay trong lõi thay vì để service/adapter phát sau khi lưu.
- Phát domain event ra bus **ngoài** sau commit mà không có outbox (dual-write → mất event).
- Rải `@Transactional` ở từng adapter cho use case ghi nhiều aggregate/adapter → nhiều transaction rời, mất nguyên tử.
- Thêm kênh I/O bằng cách sửa lõi thay vì thêm adapter.
- `billing-web-api` phụ thuộc `billing-infrastructure` hoặc import adapter ra (`..infrastructure.out..`) — phá cô lập module; controller chỉ gọi use case qua `application`, không đụng thẳng adapter persistence/HTTP.
- Để web controller lại trong `billing-infrastructure` (hoặc để `billing-infrastructure` giữ `spring-boot-starter-web` cho inbound) — inbound web phải nằm ở `billing-web-api`.

## Examples

Luồng `POST /api/invoices` (phát hành hoá đơn) đi qua cấu trúc:

1. `InvoiceController` (driving adapter, ở module `billing-web-api`) nhận `IssueInvoiceRequest` (DTO), **delegate** `InvoiceDtoMapper` (MapStruct) để map sang `IssueInvoiceCommand` (dùng VO của domain), gọi `IssueInvoiceUseCase` của `application`.
2. `IssueInvoiceService` (application) **điều phối**: dựng `Invoice` (aggregate), gọi `PaymentPort` xử lý thanh toán, gọi phương thức nghiệp vụ `invoice.issue()`, rồi `SaveInvoicePort.save()` và `NotificationPort`.
3. Quy tắc nghiệp vụ (invariant, chuyển trạng thái, tính tiền) nằm trong `Invoice`/`Money` ở **domain** — service chỉ gọi, không tự quyết.
4. Các port out được nối tới adapter thật (`InvoicePersistenceAdapter`, `PaymentGatewayAdapter`…) qua `BeanConfig` ở **bootstrap**.

## Checklist

Scaffold coi là đúng khi:

- [ ] pom của `billing-domain` và `billing-application` **không** có dependency Spring/JPA.
- [ ] `mvn test` xanh **không cần** DB (unit test lõi mock port); adapter có **integration test** (Testcontainers) — "không cần DB" chỉ áp cho unit test lõi.
- [ ] **ArchUnit test xanh:** phụ thuộc trỏ vào trong, inbound không gọi thẳng outbound, không cycle, naming đúng.
- [ ] Controller (`InvoiceController`) nằm ở `billing-web-api`, chỉ map DTO ↔ command, không chứa quy tắc nghiệp vụ.
- [ ] `billing-web-api` **không** khai dependency tới `billing-infrastructure` (Maven ép inbound↮outbound); `billing-infrastructure` **không** còn `spring-boot-starter-web` cho inbound.
- [ ] Adapter JPA map thủ công aggregate ↔ entity; aggregate không có annotation JPA.
- [ ] Ranh giới transaction ở use case (`TransactionPort`/proxy), không ở adapter; một transaction một aggregate.
- [ ] Mỗi driven port có đúng một điểm hiện thực ở `infrastructure/out`; lắp ráp ở `bootstrap`.

## References

- [ARD.md](ARD.md) — Dependency Rule, vai trò module (baseline 5 module; template này tách thêm `billing-web-api` → 6), checklist review PR (mục 7).
- Ghi **lựa chọn kiến trúc này thành ADR** (theo `docs/decisions/_TEMPLATE.md`) trong `docs/decisions/` — vì sao chọn Hexagonal + DDD cho BC này, các phương án đã cân nhắc, hệ quả.
- ArchUnit — <https://www.archunit.org>: fitness function ép ranh giới kiến trúc (Ford/Parsons/Kua, *Building Evolutionary Architectures*).

## Related

- [python-hexagonal-ddd.template.md](python-hexagonal-ddd.template.md) — cùng kiến trúc Hexagonal + DDD, stack Python.
- [java-onion-ddd.template.md](java-onion-ddd.template.md) — biến thể Onion: repository interface ở `domain`, tách Domain Service khỏi Application Service.
- [java-hexagonal-clean-cqrs.template.md](java-hexagonal-clean-cqrs.template.md) — thêm CQRS: tách luồng ghi (Command) khỏi đọc (Query).
