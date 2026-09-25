---
name: backend-migrate-vault-consul
description: "Recipe on-demand: migrate cấu hình một BACKEND project hiện có từ .env + file cấu hình phẳng (properties/env) sang HashiCorp Consul (config thường) + Vault (secrets). Kiểm kê & phân loại biến (secret vs config vs thông tin kết nối, trục global/app), chọn cơ chế tích hợp theo stack, chuyển định dạng cấu hình, sinh file cấu hình consul-config/vault-secrets (kèm biến thể profile/global) vào configs/<type> từ .env cũ, seed vào Consul/Vault có sẵn và verify boot. Dùng skill NÀY khi người dùng muốn \"migrate .env sang vault/consul\", \"chuyển cấu hình sang Consul + Vault\", \"externalize config/secret\", \"đưa secret vào Vault\", \"đưa config vào Consul\", \"bỏ .env dùng vault\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có cấu trúc workflow."
order: 6
stageNumber: "06"
title: "Backend Migrate — .env → Vault + Consul (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Backend Migrate — .env → Vault + Consul (recipe on-demand)

Recipe hiện thực việc externalize cấu hình: đưa cấu hình THƯỜNG lên Consul (KV) và
SECRETS vào Vault (KV v2), thay cho việc set toàn bộ qua `.env` / file cấu hình phẳng.
Skill này KHÔNG phụ thuộc skill nào khác; gọi độc lập trên project đã có mã nguồn (khuyến
nghị đã chạy `backend-init` trước để có cấu trúc workflow, nhưng không bắt buộc).

## Tiền đề
- Project đã có cấu trúc workflow (đã chạy `backend-init`). Nếu chưa, gợi ý khởi tạo trước.
- Đọc CLAUDE.md + `project-knowledge/` (đặc biệt `stack-profile.md`) để biết ranh giới an toàn
  và idiom stack. Nếu stack là Java/Spring, theo template ở `references/spring-boot/`.

## Ranh giới an toàn (CLAUDE.md)
Không push thẳng main. Không commit secret (giá trị secret CHỈ nằm trong Vault; file chứa secret
phải gitignore). Mỗi task = 1 commit, DỪNG cho người duyệt diff trước khi commit. Không chạy lệnh
phá huỷ dữ liệu khi chưa duyệt.

**Ngôn ngữ (bắt buộc):** MỌI đầu ra hướng người dùng của skill — bảng kiểm kê/ánh xạ, ADR, báo cáo
từng bước, commit message, comment trong file cấu hình sinh ra — viết **tiếng Việt CÓ DẤU** (UTF-8).
Không viết tiếng Việt không dấu, không trộn tiếng Anh khi đã có từ tiếng Việt thông dụng.

## Quy trình (trung tính stack)

### 1. Nạp context + xác định phạm vi
Đọc CLAUDE.md, project-knowledge/, stack-profile.md. Liệt kê mọi nguồn cấu hình hiện có:
`.env`, `.env.*`, file cấu hình app (properties/yml/toml...). Xác định `<app-name>` + các profile
(dev/staging/prod).

### 2. Kiểm kê & phân loại biến
Lập bảng: mỗi biến cấu hình → một trong ba đích. Heuristic chi tiết ở
`references/classification-heuristic.md`.
- **SECRET → Vault (KV v2):** tên chứa PASSWORD/PASSWD/SECRET/TOKEN/KEY/CREDENTIAL/PRIVATE/APIKEY,
  hoặc connection string nhúng `user:pass`.
- **CONFIG thường → Consul (KV):** host, port, URL không kèm credential, pool size, timeout,
  feature flag, log level, tên topic/queue...
- **BOOTSTRAP kết nối → ở lại `.env`:** thông tin để app biết cách TỚI Consul/Vault (địa chỉ,
  token/AppRole, profile). Đây là ngoại lệ có chủ đích: `.env` sau migration CHỈ còn nhóm này.
Ca không chắc → liệt kê mục "CẦN XÁC NHẬN" và HỎI trước khi xếp loại.

Thêm trục PHẠM VI cho mỗi biến sẽ vào Consul/Vault — đánh giá cấu hình nào LUÔN CÓ ở MỌI project thì gom global:
- **GLOBAL (dùng chung mọi project)** → context `global`: `<prefix>/global/data` (Consul) /
  `<backend>/global` (Vault). Chỉ xếp GLOBAL khi giá trị GIỐNG nhau ở MỌI project của tổ chức và không
  mang tính định danh app (vd endpoint hạ tầng dùng chung, OAuth issuer chung, truststore/CA chung, feature
  flag toàn tổ chức). PHẢI XÁC NHẬN — global ảnh hưởng mọi app.
- **APP (riêng project này)** → `<prefix>/<app>/data` / `<backend>/<app>` (override global khi trùng key).
Mặc định là APP; chỉ nâng GLOBAL khi chắc chắn dùng chung. Áp cho cả config (Consul) lẫn secret (Vault).
Ký hiệu: `<prefix>` = `CONSUL_PREFIX` (KV path gốc), `<backend>` = `VAULT_BACKEND` (mount KV v2) — theo
template stack; KHÔNG hardcode `config/`, `secret/` khi tổ chức dùng giá trị khác.

### 3. Chọn kho ngoài + cơ chế tích hợp — DỪNG cho người chọn
- Phân chia mặc định: Consul = config thường; Vault = secrets.
- Phát hiện version/stack THẬT (đọc manifest phụ thuộc: pom.xml/build.gradle/…), rồi ĐỀ XUẤT cơ chế
  tích hợp phù hợp. Với Spring Boot: `spring.config.import` (Boot ≥ 2.4 / Spring Cloud ≥ 2020) vs
  `bootstrap.yml` legacy — xem `references/spring-boot/README.md`.
- Vault auth: AppRole cho staging/prod, Token cho local dev.
- Trình bày phương án + khuyến nghị, DỪNG cho người dùng chọn.

### 4. Checkout nhánh migration TRƯỚC KHI thực thi
- Trước khi sửa BẤT KỲ file nào (kể cả ADR/plan/code), tạo & chuyển sang nhánh riêng:
  `git checkout -b <type>/consul-vault-migration`. `<type>` theo CONTRIBUTING.md — thường `refactor/`
  cho migration cấu hình, hoặc `feat/` nếu coi là năng lực mới. KHÔNG thực thi trên `main`.
- Ghi ADR (nếu đổi kiến trúc cấu hình) + cập nhật project-knowledge/ trên nhánh này. Mọi commit của
  migration nằm trên nhánh; không push thẳng main.

### 5. Wiring + chuyển định dạng (làm từng task, 1 task = 1 commit)
- **Backup `.env` TRƯỚC mọi thay đổi (chống mất nguồn giá trị):** copy `.env` → `.env.bak` và thêm
  `.env.bak` vào `.gitignore`. Đây là nguồn gốc để bước 6 sinh config; KHÔNG rút gọn `.env` ở bước này
  (việc rút gọn để cuối bước 6, sau khi đã sinh xong 2 file).
- **Lọc `.env` — CHECK TRỰC TIẾP từng biến (BẮT BUỘC, KHÔNG tự định nghĩa):** áp cho các biến config/secret
  của app (KHÔNG áp cho nhóm bootstrap kết nối ở bước 2 — nhóm đó luôn giữ). Với MỖI biến trong `.env`, TÌM
  THẬT trên toàn project mọi tham chiếu — mã nguồn + file cấu hình + Dockerfile/compose/k8s/CI/script — theo
  tên env var, placeholder `${VAR}`, `@Value` / `Environment.getProperty` / `System.getenv`,
  `@ConfigurationProperties`. Kết luận CHỈ dựa trên kết quả tìm được; KHÔNG suy diễn, KHÔNG tự bịa công dụng.
  - Có ≥ 1 tham chiếu thật → ĐANG DÙNG → migrate.
  - KHÔNG có tham chiếu nào → KHÔNG DÙNG → BỎ biến khỏi `.env` (không migrate), rồi mới tiếp bước 6.
  - Báo cáo danh sách biến đã bỏ (người dùng thấy khi duyệt diff `.env`). Chỉ biến ĐANG DÙNG mới sang bước 6.
- Thêm dependency client Consul/Vault theo stack; cấu hình app đọc từ Consul + Vault theo cơ chế đã chốt.
- **BẮT BUỘC: chuyển `.properties` → `.yaml` — KHÔNG được bỏ qua.** Nếu project còn BẤT KỲ file cấu hình
  `.properties` nào giữ config của app (vd `application.properties`, `application-<profile>.properties`,
  `*.properties` trong `src/main/resources`), phải chuyển HẾT sang `.yaml` tương đương, GIỮ NGUYÊN ngữ nghĩa
  key (không đổi tên key khi chưa duyệt), rồi XOÁ file `.properties` cũ đã chuyển.
  - CỔNG KIỂM CHỨNG: sau khi chuyển, liệt kê lại mọi `*.properties` còn sót; nếu còn file cấu hình app dạng
    `.properties` → bước này CHƯA XONG, DỪNG và báo, KHÔNG sang bước 6.
  - Ngoại lệ hợp lệ DUY NHẤT: project vốn không có `.properties` (đã dùng `.yaml`) — ghi rõ "không có
    .properties, bỏ qua hợp lệ". Không được viện lý do khác để skip.
  - **APPEND khối kết nối Consul/Vault:** vào `application.yml` kết quả, thêm nguyên khối `spring.config.import`
    + `spring.cloud.consul` + `spring.cloud.vault` theo mẫu `references/spring-boot/application.yml` (dùng biến
    môi trường; KHÔNG chứa giá trị secret). Đây là phần cấu hình để app đọc từ Consul/Vault.
- Consul lưu config dạng blob YAML nguyên khối (Spring: `spring.cloud.consul.config.format=YAML`) để
  EXPORT được ra 1 file YAML paste xuống local khi site dev không có Consul.
- **`optional:` import theo MÔI TRƯỜNG (P4 — tránh boot lặng lẽ thiếu secret):** mẫu application.yml mặc định
  non-optional (`consul:` / `vault://`) → fail-fast, hợp staging/prod (không boot lặng lẽ thiếu secret).
  DEV không có Consul: đổi sang `optional:consul:` / `optional:vault://` để boot bằng file YAML paste local —
  xem `references/spring-boot/README.md`.
- **Encoding file sinh/chuyển (toàn flow):** mọi file cấu hình sinh ra hoặc chuyển đổi (`.yaml` từ
  `.properties`, `application.yml`, `configs/<type>/*.yml`, `.env.example`) phải là **UTF-8 KHÔNG BOM**;
  comment viết tiếng Việt CÓ DẤU. Không để editor/PowerShell ghi lại thành UTF-8-BOM/UTF-16 (PowerShell
  phải dùng `-Encoding utf8`); project Maven cần `project.build.sourceEncoding=UTF-8` khi bật resource filtering.
- **Commit message NGẮN GỌN, human-readable:** header Conventional Commits ≤ 72 ký tự nói đúng MỘT việc
  của task; body tối đa 3 gạch đầu dòng tiếng Việt có dấu nêu ĐÃ ĐỔI GÌ + VÌ SAO — KHÔNG liệt kê máy móc
  từng file, không lặp lại diff, không lan man. Người đọc `git log --oneline` phải hiểu ngay task làm gì.
- Trước mỗi task: tóm tắt ngắn + file dự kiến đụng tới. Sau task: DỪNG cho duyệt diff, xác nhận mới commit.

### 6. Sinh FILE CẤU HÌNH từ `.env` cũ — tối thiểu 2 file, KÈM biến thể profile/global (đầu ra bắt buộc)
Đọc `.env.bak` (bản gốc đã backup ở bước 5 — `.env` lúc này CHƯA rút gọn) + key trong file cấu hình cũ,
CHỈ lấy các biến đã xác nhận ĐANG DÙNG ở bước 5 (biến không có tham chiếu đã bị BỎ khỏi `.env` ở bước 5),
rồi sinh RA HAI file tách bạch (mẫu định dạng: `references/spring-boot/consul-config.example.yml` và
`references/spring-boot/vault-secrets.example.yml`):
Mọi file cấu hình sinh ra gom về MỘT thư mục `configs/<type>` ở gốc project (`configs/consul/`,
`configs/vault/` — gồm cả biến thể profile/global). **Thêm TOÀN BỘ `configs/` vào `.gitignore` NGAY khi
tạo thư mục, TRƯỚC khi commit bất kỳ task nào** — đây là file gen ra từ `.env`, KHÔNG commit:
- **`configs/consul/consul-config.yml`** — CONFIG thường, YAML nguyên khối theo cây key của app; KHÔNG chứa
  secret. Đây là nội dung nạp vào Consul KV (`<prefix>/<app>/data`) và cũng là file fallback paste xuống local.
- **`configs/vault/vault-secrets.yml`** — map phẳng `<property-key>: "<giá trị thật từ .env>"` (tên key theo
  quy tắc quy đổi ENV_VAR → property-key trong `references/classification-heuristic.md`), chỉ gồm biến
  đã phân loại secret. Nội dung nạp vào Vault KV v2 (`<backend>/<app>`). CHỨA SECRET THẬT → đã nằm trong
  `configs/` gitignore; xoá sau khi seed.
- **Secret cũ coi như ĐÃ LỘ (P3):** giá trị secret từng nằm plaintext trong `.env` (nhất là nếu `.env`
  đã từng commit vào git history) phải coi là compromised — đánh dấu để ROTATE ở mục "Sau khi xong".
- **Đa profile (P2):** nếu giá trị KHÁC nhau theo môi trường, sinh THÊM `consul-config-<profile>.yml`
  (→ Consul `<prefix>/<app>-<profile>/data`, profile-separator "-") và `vault-secrets-<profile>.yml` (→ Vault `<backend>/<app>/<profile>`);
  file base (`<prefix>/<app>/data`, `<backend>/<app>`) giữ giá trị dùng chung, profile chỉ override phần khác biệt.
  Chỉ 1 môi trường → ghi rõ scope single-env và bỏ qua phần này.
- **Global (nhóm dùng chung mọi project):** biến đã xác nhận GLOBAL ở bước 2 tách ra
  `consul-config-global.yml` (→ `<prefix>/global/data`) và `vault-secrets-global.yml` (→ `<backend>/global`).
  Khi seed global phải MERGE với nội dung sẵn có (đọc trước → thêm/sửa key của app này), TUYỆT ĐỐI KHÔNG ghi
  đè toàn bộ blob làm mất key của app khác. Nếu không dùng global, bỏ qua.
In BẢNG ÁNH XẠ mỗi biến `.env` cũ → đích (Consul / Vault / ở-lại-.env) cho người dùng rà soát.

CHỈ SAU khi 2 file + bảng ánh xạ được duyệt:
- **Rút gọn `.env`** còn nhóm bootstrap kết nối. `.env` sau rút gọn CHỈ gồm dòng `KEY=value` —
  **KHÔNG viết comment vào `.env`**.
- **Sinh lại file template env** (`.env.example` / `env.template` / `.env.sample` — theo đúng tên project
  đang dùng) **TỪ `.env` MỚI đã rút gọn**: cùng danh sách key với `.env` mới, giá trị để trống hoặc mẫu.
  **KHÔNG sinh từ `.env.bak`** — template phải phản ánh env SAU migration (chỉ nhóm bootstrap kết nối),
  không phải env cũ đầy đủ. Comment trong template viết **tiếng Việt CÓ DẤU** (mẫu:
  `references/spring-boot/env.example`).
- Đảm bảo `.env`, `.env.bak`, và **toàn bộ `configs/`** đều nằm trong `.gitignore` trước khi commit.

### 7. Seed cấu hình vào Consul/Vault + verify
- Seed các file đã sinh vào Consul/Vault ĐANG CHẠY SẴN ở môi trường dev (script seed idempotent, mẫu Spring:
  `references/spring-boot/`). Dựng/vận hành hạ tầng Consul/Vault là việc NGOÀI skill (không sinh docker-compose).
  - File app → `<prefix>/<app>/data`, `<backend>/<app>`.
  - File theo profile (P2) → `<prefix>/<app>-<profile>/data`, `<backend>/<app>/<profile>` (script nhận tham số profile).
  - File global → `<prefix>/global/data`, `<backend>/global` — MERGE, không ghi đè key của app khác.
- Verify (báo cáo kết quả THẬT, không suy đoán):
  - Kịch bản 1 (đủ hạ tầng): seed → app boot → xác nhận property từ Consul + secret từ Vault đã nạp đúng.
  - Kịch bản 2 (thiếu Consul): paste `consul-config.yml` thành file cấu hình local → app vẫn boot nhờ import
    `optional:` + fallback file; Vault vẫn cấp secret.
  - Bước nào fail → DỪNG, báo log lỗi, đề xuất sửa. Không tuyên bố hoàn tất khi chưa có bằng chứng.

### 8. Testing lại TOÀN BỘ project (sau khi thực thi)
- **CỔNG BẮT BUỘC — định dạng cấu hình:** trước khi kết luận xong, kiểm lại KHÔNG còn file cấu hình app dạng
  `.properties` nào (đã chuyển hết sang `.yaml` ở bước 5). Còn sót = migration CHƯA XONG, quay lại bước 5.
- Sau khi hoàn tất wiring + migrate, chạy FULL bộ test + lint/build của project đích (không chỉ verify
  boot ở bước 7): unit + integration + lint + build (vd Maven `mvn verify`, Gradle `./gradlew build`).
- Mục tiêu regression: migration cấu hình KHÔNG làm hỏng hành vi hiện hữu. Chạy ở profile dùng
  Consul/Vault để chắc test nạp đúng nguồn cấu hình mới.
- **CI không có Consul/Vault:** chạy suite bằng profile fallback local (file YAML paste + `optional:` import,
  hoặc testcontainers nếu stack cho phép) và BÁO CÁO RÕ phần nào chưa chạy với hạ tầng thật (scope skip) —
  không im lặng coi như đã phủ.
- Báo cáo kết quả THẬT (số test pass/fail, lệnh đã chạy). Có test fail → DỪNG, phân tích, sửa; KHÔNG
  tuyên bố hoàn tất khi suite chưa xanh.

## Sau khi xong
Tóm tắt file đã đổi + bảng ánh xạ; cập nhật `project-knowledge/` phản ánh nguồn cấu hình mới
(Consul/Vault + vai trò `.env`).
- **DỌN FILE CHỨA SECRET (bắt buộc):** xoá `configs/vault/vault-secrets*.yml` sau khi seed xong, và xoá
  `.env.bak` sau khi verify + rotate hoàn tất — cả hai đang giữ secret thật plaintext trên đĩa.
- **ROTATE secret đã lộ (P3):** đổi giá trị mọi secret từng ở plaintext `.env` tại nguồn (DB/API...) rồi
  cập nhật lại Vault TRƯỚC khi lên prod; nếu `.env` từng commit, coi git history đã lộ (cân nhắc scrub history).
- **Prod fail-fast (P4):** xác nhận profile staging/prod KHÔNG để `optional:` cho Vault.
Xác nhận full test suite đã xanh (bước 8) trước khi bàn giao; người dùng tự push nhánh
`<type>/consul-vault-migration` + mở PR. Nếu phát hiện ràng buộc mâu thuẫn (vd stack không hỗ trợ cơ chế
đã chọn), DỪNG và báo thay vì tự đi chệch.
