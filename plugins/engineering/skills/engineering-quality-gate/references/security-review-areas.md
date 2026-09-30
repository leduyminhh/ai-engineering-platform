# Review bảo mật theo 5 vùng rủi ro

Gộp checklist review source-first thành 5 vùng. Nạp vùng liên quan tới code đang review; mỗi finding gắn
OWASP/ASVS/CWE qua [owasp-asvs-cwe-mapping.md](owasp-asvs-cwe-mapping.md) và trích evidence cụ thể.

## Ánh xạ với vùng rủi ro của `workflow-security-review`

Workflow chia 8 vùng để xác định phạm vi; file này gom checklist thành 5 vùng. Khi review theo vùng của workflow,
nạp mục tương ứng dưới đây:

| Vùng của workflow | Mục trong file này |
|---|---|
| auth/session | 1. Auth / Session |
| authorization/access control | 1. Auth / Session (key check kiểm quyền) |
| input validation | 2. Input validation / Injection |
| SSRF | 2. Input validation / Injection (key check SSRF) |
| crypto/secrets | 3. Crypto / Secrets |
| security misconfiguration | 3. Crypto / Secrets (key check cấu hình) |
| dependency | 4. Dependency / Supply-chain |
| logging | 5. Logging / Error handling |

## 1. Auth / Session (A01, A07)

- **Authentication:** thuật toán + tham số hash mật khẩu đủ mạnh (adaptive hashing); lockout / throttling
  brute-force; chống replay; MFA / step-up cho hành động nhạy cảm.
- **Authorization:** kiểm soát ở mức endpoint, service, **object-level**; scope theo tenant + kiểm ownership;
  guard mức method không bị vòng qua bằng đường khác.
- **Session / token:** cookie flag an toàn; expiry / rotation / revocation / refresh; verify signature +
  audience + issuer + scope.
- **Red flag:** thiếu `@PreAuthorize` (hoặc tương đương) trên handler nhạy cảm; lấy user id thẳng từ request
  không kiểm ownership; role check wildcard lỏng; parse JWT không verify chữ ký.

## 2. Input validation / Injection (A03, A10)

- Validate **structure / type / range / enum / size** ngay tại biên; ưu tiên **allow-list** hơn deny-list
  cho lệnh, loại file, URL.
- Trace input người dùng vào: SQL/ORM query · shell command · template render · expression language · file
  path · HTTP client · deserializer.
- **Upload:** không tin extension/content-type; chống path traversal; scan/quarantine khi cần.
- **SSRF:** allow-list host; giới hạn scheme; xử lý redirect; chặn private network.
- **Deserialize / binding:** chặn polymorphic type không an toàn; tránh bind cả object graph; không bind
  thẳng field nhạy cảm bảo mật.

## 3. Crypto / Secrets (A02, A05)

- Không hardcode credential / API key / signing key / salt / test secret trong code.
- Crypto yếu/lỗi thời: MD5, SHA-1 cho quyết định bảo mật · ECB · custom crypto · tắt verify certificate.
- Password: adaptive hashing, kiểm cost + đường nâng cấp.
- Token: từ chối `alg=none`; ghim thuật toán chấp nhận; validate issuer/audience/expiry + nguồn khoá.
- Secret management: secret đến từ **env / vault / secure store**; không log/echo secret trong CI.
- **Security misconfiguration:** cấu hình không an toàn ở môi trường triển khai: debug/actuator/console bật,
  CORS mở rộng (`*` kèm credential), thiếu header bảo mật (HSTS, CSP, X-Content-Type-Options), credential mặc
  định, endpoint quản trị không hạn chế.
- **Red flag:** Base64 bị tưởng là mã hoá; IV tĩnh dùng chung; secret trong `application.yml` / `.env.example`
  / test data commit mà không tách rõ non-production.

## 4. Dependency / Supply-chain (A06, A08)

- So sánh **manifest + lockfile cùng lúc**; kiểm version ghim / floating / registry không tin cậy.
- Review cả **plugin + build tool** thêm mới, không chỉ runtime lib.
- **Flag:** tắt integrity check; git dependency không ghim; install script chạy mạng; tải trực tiếp không
  verify checksum; bước CI fetch tool/container/script lúc runtime.
- Ưu tiên phát biểu rủi ro có evidence: nguồn package lộ, install hook đáng ngờ, lockfile thiếu cập nhật,
  major line có lỗ hổng / hết hỗ trợ. Đối chiếu CVE từ Black Duck/Trivy ([blackduck.md](blackduck.md)).

## 5. Logging / Error handling (A09)

- KHÔNG log: password · token · API key · session id · dữ liệu cá nhân đầy đủ (trừ khi bắt buộc + được bảo vệ).
- Error handling không lộ ra client: stack trace · chi tiết SQL · internal URL · giá trị secret config.
- Audit log cho: login success/failure · đổi quyền · hành động admin · đổi config nhạy cảm bảo mật.
- Chống **log injection**: field do người dùng kiểm soát chưa sanitize khi ghi log.
- Cân bằng bảo mật + điều tra: đủ context để forensics mà không rò payload nhạy cảm.
