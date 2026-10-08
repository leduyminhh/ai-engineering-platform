# backend-migrate-vault-consul

Recipe **on-demand** (không thuộc pipeline bắt buộc `init → analysis → contract → erd → implement`):
migrate cấu hình một backend project hiện có từ `.env` + file cấu hình phẳng (properties/env) sang
**HashiCorp Consul** (config thường) + **HashiCorp Vault** (secrets), đồng thời chuyển định dạng cấu hình
(vd Spring: `.properties` → `.yaml`).

> Tài liệu này mô tả tổng quan + cách áp dụng. Hướng dẫn thực thi đầy đủ cho agent nằm ở
> [SKILL.md](SKILL.md); template theo stack ở [references/](references/).

## Khi nào dùng
Khi muốn "migrate .env sang vault/consul", "externalize config/secret", "đưa secret vào Vault", "đưa
config vào Consul", "bỏ .env dùng vault" trên một project đã có cấu trúc workflow.

## Kết quả sau khi chạy
- App đọc cấu hình từ Consul (config) + Vault (secrets) thay cho `.env`.
- `.env` rút gọn còn **thông tin kết nối** Vault/Consul + profile.
- 2 file cấu hình sinh từ `.env` cũ, gom về `configs/<type>`: `configs/consul/consul-config.yml` (config)
  và `configs/vault/vault-secrets.yml` (secrets). TOÀN BỘ `configs/` là file gen → nằm trong `.gitignore`,
  KHÔNG commit.
- File template env (`.env.example`/`env.template`) sinh lại TỪ `.env` mới đã rút gọn (không lấy từ
  `.env.bak`), comment tiếng Việt có dấu; `.env` thật không chứa comment.
- Cấu hình dùng chung mọi project gom vào **nhóm global** (`config/global/data`, `secret/global`).

## Tiền đề
1. Project đã chạy `backend-init` (có `project-knowledge/`, `CLAUDE.md`, `docs/`).
2. Đã cài workflow-kit vào project để skill này khả dụng (mở Claude Code trong thư mục project).
3. Có sẵn Consul + Vault để seed/verify (skill KHÔNG dựng hạ tầng — xem ranh giới ở dưới).

## Step-by-step áp dụng vào project

**B0. Kích hoạt.** Mở Claude Code trong project đích, nói ví dụ: *"migrate .env sang Vault + Consul"*.
Skill tự chạy 8 bước sau; mỗi bước sửa file đều DỪNG cho bạn duyệt diff trước khi commit.

1. **Nạp context** — đọc `CLAUDE.md`, `project-knowledge/`, `stack-profile.md`; liệt kê nguồn cấu hình
   (`.env`, `.env.*`, file cấu hình app) và xác định `<app-name>` + các profile.
2. **Kiểm kê & phân loại biến** — agent KHÔNG đọc giá trị trong `.env*`. **Bạn chạy** lệnh kiểm kê chỉ-in-TÊN do
   agent đề xuất (bash `awk` / PowerShell) và dán kết quả vào chat: mỗi dòng là `TÊN` + cờ `CRED`/`-` (cờ `CRED` =
   giá trị nhúng `user:pass@`/`?password=`, không in giá trị). Mỗi biến → Vault (secret) / Consul (config) /
   ở-lại-`.env` (bootstrap kết nối); kèm trục **global vs app**. Cờ `CRED` → Vault; tên dạng URL/URI/DSN/connection
   string với cờ `-` → skill HỎI bạn giá trị có nhúng credential không. → *bạn rà soát bảng phân loại.*
3. **Chọn cơ chế tích hợp — DỪNG cho bạn chọn** — skill đọc version thật (pom.xml/build.gradle) rồi đề
   xuất (Spring: `spring.config.import` vs `bootstrap.yml`). → *bạn chọn phương án; skill ghi ADR.*
4. **Checkout nhánh** — `git checkout -b <type>/consul-vault-migration` trước mọi thay đổi (không làm trên `main`).
5. **Wiring + chuyển định dạng** — **bạn chạy** lệnh backup `.env` → `.env.bak` do agent đề xuất (`cp .env .env.bak` /
   `Copy-Item`); **lọc `.env`: agent tìm theo TÊN biến (loại `.env*` khỏi phạm vi tìm) xem biến có được tham chiếu
   trong project không (evidence-based, không tự định nghĩa) — biến không dùng thì BỎ khỏi `.env` (bạn tự xoá dòng) rồi
   mới đi tiếp**; thêm dependency Consul/Vault; **BẮT BUỘC chuyển hết `.properties` → `.yaml`**
   (không bỏ qua; còn file `.properties` cấu hình app = chưa xong bước này).
6. **Sinh 2 file cấu hình** từ `.env.bak` vào `configs/consul/` + `configs/vault/` (và biến thể theo
   profile/global nếu có) + bảng ánh xạ — agent viết script chuyển đổi (không chứa giá trị), **bạn chạy** script đó;
   toàn bộ `configs/` vào `.gitignore` trước khi commit. Sau khi bảng ánh xạ được duyệt, **bạn chạy** lệnh rút gọn
   `.env` còn thông tin kết nối (không comment); agent sinh lại `.env.example`/`env.template` từ danh sách TÊN biến
   bootstrap đã chốt (không đọc `.env` mới).
7. **Seed + verify** — **bạn chạy** script seed 2 file vào Consul/Vault đang chạy (không in giá trị); verify 2 kịch bản: (a) đủ hạ tầng,
   (b) thiếu Consul → paste `consul-config.yml` xuống local vẫn boot (nhờ import `optional:`).
8. **Test lại toàn bộ project** — chạy full test/lint/build (vd `mvn verify`, `./gradlew build`) ở profile
   dùng Consul/Vault để bắt regression. Fail → DỪNG, sửa, không tuyên bố xong khi suite chưa xanh.

**Sau khi xong:** rotate secret đã lộ (giá trị từng ở plaintext `.env`) trước khi lên prod; **xoá
`configs/vault/vault-secrets*.yml` (sau seed) và `.env.bak` (sau verify + rotate)** — cả hai chứa secret
thật; push nhánh `<type>/consul-vault-migration` và mở PR.

## Mô hình context (Consul/Vault)
| Phạm vi | Consul | Vault |
|---|---|---|
| Global (dùng chung mọi project) | `<prefix>/global/data` | `<backend>/global` |
| App (riêng project) | `<prefix>/<app>/data` | `<backend>/<app>` |
| Theo profile | `<prefix>/<app>-<profile>/data` | `<backend>/<app>/<profile>` |

prefix = `CONSUL_PREFIX`, backend = `VAULT_BACKEND` (mount KV v2). App override global khi trùng key;
chỉ nâng biến lên **global** khi giá trị giống nhau ở mọi project. Cơ chế + biến môi trường đầy đủ xem
[references/spring-boot/README.md](references/spring-boot/README.md).

## Ranh giới an toàn
- Không push thẳng `main`; mỗi task = 1 commit, dừng duyệt diff.
- Không commit secret (`vault-secrets*.yml` phải gitignore, xoá sau seed).
- `optional:` import chỉ ở dev/local; staging/prod bỏ `optional:` cho Vault (fail-fast, tránh boot lặng lẽ
  thiếu secret).
- Dựng/vận hành hạ tầng Consul/Vault + provisioning prod (policy/AppRole/ACL/KV mount) là việc **ngoài skill**.

## Tài liệu liên quan
- [SKILL.md](SKILL.md) — quy trình đầy đủ cho agent.
- [references/classification-heuristic.md](references/classification-heuristic.md) — quy tắc phân loại biến (trung tính stack).
- [references/spring-boot/README.md](references/spring-boot/README.md) — template + hướng dẫn cho stack Spring Boot.
