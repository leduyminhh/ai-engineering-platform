# Template Spring Boot — externalize config sang Consul + Vault

Áp dụng khi `stack-profile.md` cho biết project là Java/Spring Boot. Đọc kỹ trước khi wiring.

## Chọn cơ chế tích hợp (đọc version THẬT từ pom.xml/build.gradle)
- **Spring Boot ≥ 2.4 / Spring Cloud ≥ 2020 (khuyến nghị):** dùng `spring.config.import` trong
  `application.yml` — xem `application.yml` mẫu. Không cần `bootstrap.yml`.
- **Spring Boot < 2.4 (legacy):** cần `spring-cloud-starter-bootstrap` + đặt cấu hình Consul/Vault
  trong `bootstrap.yml` (property giống hệt, chỉ khác file). Chỉ chọn khi bị khoá version cũ.

Dependency (BOM `spring-cloud-dependencies` khớp version):
`spring-cloud-starter-consul-config`, `spring-cloud-starter-vault-config`
(+ `spring-cloud-starter-consul-discovery` nếu cần service discovery).

## Vì sao `format: YAML` cho Consul
Lưu toàn bộ config THƯỜNG thành MỘT tài liệu YAML nguyên khối tại key `<prefix>/<context>/data`
(prefix = CONSUL_PREFIX; context = `global` hoặc tên app). Nhờ vậy nội dung Consul KV == một file YAML
hợp lệ → khi site dev không có Consul, paste file đó thành `config/application.yml` local là chạy (cần
đổi import sang `optional:` — xem mục P4).

## Vault KV v2
Mount engine KV v2, tên mount = VAULT_BACKEND (vd `dls-hcm`; `vault -dev` mặc định là `secret`). Nếu tự
dựng: `vault secrets enable -version=2 -path=<backend> kv`. Spring đọc `<backend>/global` (global, dùng
chung) + `<backend>/<app>` (riêng app, override) — client tự thêm tầng `data/` của KV v2.
Auth qua công tắc env `VAULT_AUTH` (không sửa file): `APPROLE` (mặc định — role-id/secret-id +
app-role-path = VAULT_APP_ROLE_PATH) cho staging/prod; `VAULT_AUTH=TOKEN` + `VAULT_TOKEN` cho local dev
(Vault dev-mode không có sẵn AppRole).

## Biến môi trường (.env) mà template đọc
APP_NAME, SPRING_PROFILES_ACTIVE; Consul: CONSUL_HOST, CONSUL_PORT, CONSUL_TOKEN, CONSUL_PREFIX;
Vault: VAULT_URI, VAULT_AUTH, VAULT_TOKEN (dev/seed), VAULT_ROLE_ID, VAULT_SECRET_ID,
VAULT_APP_ROLE_PATH, VAULT_BACKEND, VAULT_DEFAULT_CONTEXT. Xem `env.example`.

## Hạ tầng Consul/Vault
Skill KHÔNG dựng hạ tầng (không sinh docker-compose). Consul/Vault phải có sẵn ở môi trường; skill chỉ
seed cấu hình vào chúng.

## File trong thư mục này
- `application.yml` — khung cấu hình app đọc từ Consul + Vault (cơ chế config.import).
- `env.example` — TEMPLATE env sau migration: CHỈ thông tin kết nối + profile, comment tiếng Việt có dấu.
  File `.env` thật sinh từ template này KHÔNG chứa comment (chỉ `KEY=value`).
- `consul-config.example.yml` — mẫu định dạng file config Consul (cũng là file fallback local).
- `vault-secrets.example.yml` — mẫu định dạng file secret Vault (gitignore, không commit).

## Script
Script `seed-consul.sh` / `seed-vault.sh` nằm ở `scripts/` của skill (copy vào project trước khi chạy) — nạp file
cấu hình vào Consul/Vault (idempotent, nhận tham số profile).

## Thứ tự làm
1. Thêm dependency + append khối `application.yml` mẫu (config.import mặc định non-optional; dev đổi optional).
2. BẮT BUỘC chuyển HẾT `.properties` → `.yaml` (giữ nguyên ngữ nghĩa key), xoá `.properties` cũ. Còn sót
   file `.properties` cấu hình app = chưa xong; không được bỏ qua.
3. Sinh `configs/consul/consul-config.yml` + `configs/vault/vault-secrets.yml` từ `.env` cũ (theo bảng
   phân loại; mọi file gen — kể cả profile/global — gom về `configs/<type>`; TOÀN BỘ `configs/` vào
   `.gitignore` trước khi commit — file gen, không commit).
4. Seed vào Consul/Vault dev đang chạy: `seed-consul.sh` + `seed-vault.sh` (từ `scripts/` của skill).
5. Rút gọn `.env` còn thông tin kết nối (chỉ `KEY=value`, KHÔNG comment); sinh lại `.env.example`/
   `env.template` TỪ `.env` MỚI đã rút gọn (không lấy từ `.env.bak`), comment tiếng Việt có dấu;
   verify boot 2 kịch bản (có / thiếu Consul).

## Đa profile (P2)
Khi giá trị khác nhau theo môi trường, dùng context riêng cho từng profile — Spring Cloud tự đọc
base + profile:
- Consul: base `<prefix>/<app>/data` + `<prefix>/<app>-<profile>/data` (profile-separator "-", vd `config/my-app-prod/data`).
- Vault:  base `<backend>/<app>` + `<backend>/<app>/<profile>` (vd `dls-hcm/my-app/prod`).
Sinh file theo cặp trong `configs/<type>`: `consul-config.yml` (+ `consul-config-<profile>.yml`),
`vault-secrets.yml` (+ `vault-secrets-<profile>.yml`). Seed với tham số profile:
`./seed-consul.sh configs/consul/consul-config-prod.yml prod` · `./seed-vault.sh configs/vault/vault-secrets-prod.yml prod`.
File base giữ giá trị dùng chung; file profile chỉ chứa phần OVERRIDE khác biệt.

## Global config (dùng chung mọi project)
Spring Cloud đọc 2 tầng context, app override global khi trùng key:
- Consul: global `<prefix>/global/data` + app `<prefix>/<app>/data` (`default-context: global`).
- Vault:  global `<backend>/global`      + app `<backend>/<app>`      (`kv.default-context: global`,
  `kv.application-name: <app>`).
Cấu hình LUÔN CÓ ở mọi project (endpoint hạ tầng chung, OAuth issuer, truststore/CA, feature flag toàn
tổ chức) → gom vào file global: `consul-config-global.yml` / `vault-secrets-global.yml`. Seed global bằng
cách nhắm context `global`, ví dụ: `APP_NAME=global ./seed-consul.sh configs/consul/consul-config-global.yml`.
**Cảnh báo:** `consul kv put` ghi đè cả blob — khi cập nhật global phải MERGE (đọc giá trị hiện có, thêm/sửa
key của app này) để không xoá key global của app khác.

## optional theo môi trường (P4)
Mẫu `application.yml` mặc định NON-optional (`consul:` / `vault://`) = fail-fast, hợp staging/prod (không
boot lặng lẽ khi thiếu secret).
- **dev/local không có Consul:** đổi import sang `optional:consul:` + `optional:vault://` để boot bằng file
  YAML paste local (nên tách profile dev, vd application-dev.yml).

## Rotate secret đã lộ (P3)
Secret từng nằm plaintext trong `.env` (nhất là nếu `.env` đã commit git history) coi như ĐÃ LỘ.
Sau khi seed + verify: đổi giá trị tại nguồn (DB/API provider...) rồi cập nhật lại Vault TRƯỚC khi lên
prod. Cân nhắc scrub git history nếu `.env`/secret từng bị commit.
