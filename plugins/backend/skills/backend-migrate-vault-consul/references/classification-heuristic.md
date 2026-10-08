# Phân loại biến cấu hình (trung tính stack)

Mỗi biến trong `.env` / file cấu hình phẳng phải rơi vào ĐÚNG một đích. Khi không chắc,
liệt kê ở mục "CẦN XÁC NHẬN" và hỏi người dùng — KHÔNG tự đoán với biến nhạy cảm.

## SECRET → Vault (KV v2)
Dấu hiệu tên (không phân biệt hoa/thường): `PASSWORD`, `PASSWD`, `PWD`, `SECRET`, `TOKEN`,
`APIKEY`, `API_KEY`, `ACCESS_KEY`, `PRIVATE_KEY`, `CREDENTIAL`, `CLIENT_SECRET`, `SALT`,
`ENCRYPTION_KEY`, `JWT_SECRET`, `KEYSTORE_PASSWORD`.
Dấu hiệu giá trị: connection string nhúng credential (`db://user:pass@host`, `?password=`), chuỗi base64/PEM,
key dài ngẫu nhiên. Agent không đọc giá trị: dấu hiệu này đến từ cờ `CRED` của lệnh kiểm kê chỉ in TÊN
(xem SKILL.md bước 2). Biến có cờ `CRED` → SECRET, kể cả khi tên là `*_URL`/`*_HOST`
(vd `REDIS_URL=redis://:pw@host`, `SPRING_DATASOURCE_URL=jdbc:…://user:pw@…`).

## CONFIG thường → Consul (KV)
Không nhạy cảm, cần theo môi trường: `*_HOST`, `*_PORT`, `*_URL` (chỉ khi người dùng đã xác nhận không kèm credential — xem mục "Ca ranh giới"),
`*_TIMEOUT`, `*_POOL_SIZE`, `MAX_*`, `*_ENABLED` (feature flag), `LOG_LEVEL`, `*_TOPIC`,
`*_QUEUE`, `*_BUCKET`, `REGION`, `*_ENDPOINT` (public), `DDL_AUTO`, `CACHE_TTL`.

## BOOTSTRAP kết nối → ở lại `.env` (ngoại lệ có chủ đích)
Thông tin để app biết cách TỚI chính Consul/Vault + chọn profile — không thể lấy từ trong chúng:
`APP_NAME`, `SPRING_PROFILES_ACTIVE`, `CONSUL_HOST`, `CONSUL_PORT`, `CONSUL_TOKEN`, `CONSUL_PREFIX`,
`VAULT_URI`, `VAULT_AUTH`, `VAULT_TOKEN` (dev/seed), `VAULT_ROLE_ID`, `VAULT_SECRET_ID`,
`VAULT_APP_ROLE_PATH`, `VAULT_BACKEND`, `VAULT_DEFAULT_CONTEXT` (tên biến theo template
`references/spring-boot/application.yml`).

## Ca ranh giới cần XÁC NHẬN
- **Tên dạng URL/URI/DSN/connection string** — `*_URL`, `*_URI`, `*_DSN`, `*CONNECTION*`, `*_CONN*`, `DATABASE_*` (và
  `*_HOST` có cờ `CRED`): chỉ có tên thì không biết giá trị có nhúng `user:pass@` hay không. Cờ `CRED` → SECRET; cờ `-` →
  KHÔNG tự xếp CONFIG mà HỎI người dùng "giá trị có nhúng credential không?" (cờ `-` chỉ là lệnh không nhận ra, không
  chứng minh sạch). Có → SECRET hoặc tách credential sang Vault; không → CONFIG. Tránh để credential lọt vào Consul.
- **Username DB / user credential**: mặc định gom về Vault CÙNG password (là cặp credential). Nếu
  người dùng muốn để username ở Consul, xác nhận rõ.
- **URL có tham số nhạy cảm** (`?sslkey=`, `?token=`): tách phần secret sang Vault.
- **Basic-auth trong URL webhook/registry**: tách credential sang Vault, giữ host ở Consul.

## Phạm vi: GLOBAL vs APP (trục thứ hai, áp cho biến vào Consul/Vault)
Song song với trục Vault/Consul, đánh giá biến có LUÔN CÓ ở MỌI project không:
- **GLOBAL** → context `global` (`config/global/data`, `secret/global`): giá trị GIỐNG nhau
  ở mọi project của tổ chức, không mang định danh app. Ví dụ: endpoint hạ tầng dùng chung (registry,
  broker, observability), OAuth/OIDC issuer chung, truststore/CA chung, feature flag toàn tổ chức.
- **APP** (mặc định) → `config/<app>/data` / `secret/<app>`: riêng project này; override global khi trùng key.
Chỉ nâng GLOBAL khi CHẮC dùng chung — global ảnh hưởng mọi app, và seed global phải MERGE (không ghi đè key
của app khác). Không chắc → để APP + hỏi.

## Quy tắc quy đổi tên ENV_VAR → property-key (áp theo thứ tự ưu tiên)
Mục tiêu: cùng một `.env` phải cho ra CÙNG một bộ property-key ở mọi lần chạy — không tự nghĩ tên mới.
1. **Placeholder có sẵn thắng:** nếu biến đang được tham chiếu qua placeholder trong file cấu hình cũ
   (vd `spring.datasource.url=${DB_URL}` trong `.properties`) → dùng CHÍNH property-key đang chứa
   placeholder đó. Không đổi tên key hiện hữu.
2. **Relaxed binding chuẩn:** biến map thẳng property Spring chuẩn theo quy tắc relaxed binding
   (`SPRING_DATASOURCE_URL` → `spring.datasource.url`, `SERVER_PORT` → `server.port`) → dùng property chuẩn.
3. **Biến custom (đọc qua `System.getenv` / `@Value`):** đặt dưới namespace `app.` theo kebab-case
   (`EXTERNAL_API_TIMEOUT` → `app.external.api-timeout`); ghi tên ENV gốc vào cột Ghi chú của bảng ánh xạ
   và cập nhật code đọc property mới (1 task riêng, có duyệt diff).
Không suy diễn ngữ nghĩa mới; mọi quy đổi phải hiện trong bảng ánh xạ để người dùng rà soát.

## Đầu ra
Bảng: `| Biến .env cũ | Kho (Vault/Consul/.env) | Phạm vi (global/app) | Property-key đích | Ghi chú |`.
Người dùng rà soát bảng TRƯỚC khi sinh file cấu hình.
