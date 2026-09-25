---
name: backend-testing
description: "Recipe on-demand: chiến lược và viết TEST cho một BACKEND project (Java/Spring, Python) BÁM kiến trúc đã chọn — unit cho lõi domain/application thuần (mock/fake driven port, KHÔNG cần DB), integration cho adapter (Testcontainers/DB thật), web slice cho controller, characterization khi đụng code cũ ít test. Đặt test đúng tầng theo test pyramid, chọn loại test theo mức rủi ro, đo độ phủ nhánh chính + edge, tránh test giòn (phụ thuộc thứ tự/thời gian/mạng). Dùng skill NÀY khi người dùng muốn \"viết test backend\", \"unit test\", \"integration test\", \"test service/API\", \"test coverage\", \"đo độ phủ\", \"TDD backend\", \"kiểm thử backend\", \"viết JUnit/pytest\", \"test controller/repository\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 3
stageNumber: "03"
title: "Backend Testing — Chiến lược và viết test bám kiến trúc (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Backend Testing — Chiến lược và viết test bám kiến trúc (recipe on-demand)

Recipe hướng dẫn agent **chọn loại test, đặt test đúng tầng, và viết test** cho một BACKEND
project (Java/Spring, Python) sao cho test **bám KIẾN TRÚC đã chọn** và `code-convention` của
project. KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần. Đây là **docs-only recipe** — hướng dẫn
cách agent viết/chạy test, KHÔNG phải bộ test dựng sẵn hay công cụ codegen.

Nguyên tắc trục: kiến trúc hướng miền tách lõi khỏi hạ tầng, nên **test lõi không cần bật
framework/DB** (nhanh, nhiều), còn adapter mới cần dependency thật (ít hơn, chậm hơn) — xem
`architecture/ARD.md` mục "TDD — cách xây, không phải cách xếp".

## Ranh giới an toàn (CLAUDE.md)
- Test bám **kiến trúc đã chốt** (ADR/`project-knowledge/architecture.md`) + `code-convention`
  của project; KHÔNG áp phong cách test lạ với repo.
- **KHÔNG chạy test phá dữ liệu thật:** integration dùng DB dùng-một-lần (Testcontainers / DB
  in-memory / schema test riêng), KHÔNG trỏ vào DB staging/production. Test không được xoá/ghi
  đè dữ liệu ngoài phạm vi của chính nó.
- Không đổi hành vi nghiệp vụ để "cho test xanh"; nếu test lộ bug thật → BÁO, để người quyết
  sửa code hay sửa kỳ vọng.
- Mỗi task = 1 commit, DỪNG cho người **duyệt diff** trước khi commit; không push thẳng main.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — tên test, bảng phủ, báo cáo, commit
  message, comment trong file test — viết **tiếng Việt CÓ DẤU** (UTF-8). Comment chỉ giải thích
  *vì sao* (bất biến nghiệp vụ, cạm bẫy dễ tái phạm), không kể lại *cái gì* code đã nói.
- **Ngôn ngữ đo được:** báo cáo bằng số đếm được (số test, nhánh/case đã phủ, lệnh + kết quả
  THẬT). KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / test hết"; LUÔN nêu khoảng trống còn
  lại và residual risk. Độ phủ phản ánh thời điểm chạy, có thể sót đường đi chưa nghĩ tới.

## Quy trình (trung tính stack)

### 0. Nạp context + dò stack, test runner, lệnh test — BẮT BUỘC trước khi viết
- Đọc CLAUDE.md + `project-knowledge/` (`architecture.md`, `source-structure.md`,
  `stack-profile.md`, `code-convention.md`) để biết **kiến trúc đã chọn**, ranh giới an toàn,
  quy ước đặt tên và idiom test hiện có.
- Dò **stack + test runner + lệnh chạy** từ chính project, không đoán:
  - Java Maven → `pom.xml` (surefire/failsafe, `spring-boot-starter-test`, testcontainers,
    archunit); lệnh `mvn test` (unit) / `mvn verify` (gồm integration `*IT`).
  - Java Gradle → `build.gradle(.kts)`; lệnh `./gradlew test` / `./gradlew integrationTest`.
  - Python → `pyproject.toml` / `pytest.ini` / `tox.ini`; lệnh `pytest`, `pytest -m "not slow"`.
- Đọc **test đã có** để tái dùng fixture/factory/helper/base class thay vì dựng mới trùng lặp.
- Thiếu test runner/lệnh test → BÁO (fail-loud), đề nghị người xác nhận thay vì tự chế khung.

### 1. Chiến lược test — đặt đúng tầng
Xác định **hành vi cần test + mức rủi ro**, rồi chọn **loại test hẹp nhất chứng minh được rủi
ro đó** theo test pyramid và ánh xạ tầng-kiến-trúc. Chi tiết + ma trận chọn loại:
[references/test-strategy.md](references/test-strategy.md).
- Onion/Hexagonal/CQRS: **lõi (domain + application) → unit thuần, mock/fake driven port,
  KHÔNG DB**; **adapter (persistence, HTTP client, messaging, controller) → integration/slice**;
  **e2e → mỏng**, chỉ vài luồng giá trị cao không chứng minh được ở tầng thấp.
- Layered đơn giản: service → unit (mock repository); repository/controller → integration/slice.
- Ưu tiên **nhánh chính + case biên/lỗi có rủi ro thật**; không dồn e2e cho thứ tầng thấp phủ
  được rẻ và ổn định hơn.

### 2. Viết test theo tầng
Đặt file test đúng cấu trúc `<stack>-<kiểu>` của project (không tự bịa cây thư mục). Với mỗi
tầng:
- **Unit lõi (domain/application thuần):** không bật Spring/DB; **mock/fake driven port** (qua
  interface Java / `Protocol` Python). Test invariant aggregate, quy tắc domain service, điều
  phối use-case (thứ tự gọi port, nhánh rẽ nghiệp vụ). Nhanh, chạy mỗi lần lưu file. Không mock
  chính class đang test; assert **hành vi/kết quả quan sát được**, không phải chi tiết nội bộ.
- **Integration adapter:** dùng **Testcontainers** (DB/broker/cache thật) hoặc DB in-memory khi
  đủ đại diện, để test hành vi persistence, mapping entity↔aggregate, transaction/rollback,
  query. Mỗi test tự dựng + dọn dữ liệu của nó (deterministic), KHÔNG dựa DB thật.
- **Web slice controller:** test riêng tầng vào (serialize/deserialize, validation, mã lỗi HTTP,
  ánh xạ exception) với use-case bên dưới được mock — Java `@WebMvcTest`/MockMvc, Python test
  client của FastAPI/Flask. Không kéo cả stack chỉ để test một controller.
- Idiom cụ thể từng stack (JUnit5/Mockito/AssertJ/Testcontainers vs pytest/fixture/monkeypatch):
  [references/java-python-testing.md](references/java-python-testing.md).

### 3. Characterization khi đụng code cũ / ít test
Trước khi sửa hay refactor code cũ chưa có test bao quanh, **viết characterization test khóa
hành vi HIỆN TẠI** (gọi qua điểm vào công khai, chốt output + side-effect quan sát được), xác
nhận XANH trên code cũ để làm lưới an toàn hồi quy. Quy trình + cạm bẫy:
[references/characterization.md](references/characterization.md). Các test này ở lại repo làm
tài sản.

### 4. Chạy + đo độ phủ, đánh giá chất lượng test — CỔNG
Chạy đúng lệnh test đã dò ở bước 0, ghi **lệnh + kết quả THẬT** (số pass/fail). Nếu project có
đo phủ (JaCoCo / `coverage.py`), chạy và đọc theo **nhánh chính + case biên**, không chạy theo
con số phần trăm tổng.
- **Test phải đo được là tốt, không chỉ "chạy được":** phủ nhánh nghiệp vụ chính + edge có rủi
  ro; **không phụ thuộc thứ tự chạy**, không phụ thuộc thời gian thực/mạng/trạng thái chia sẻ
  toàn cục; assert hành vi chứ không phải chi tiết cài đặt. Dấu hiệu **test giòn** + cách tránh:
  [references/test-strategy.md](references/test-strategy.md) mục "Tránh test giòn".
- Nêu rõ **khoảng trống còn lại** (đường đi/nhánh chưa phủ, phần bỏ qua vì hạ tầng CI thiếu) và
  **residual risk**; KHÔNG tuyên bố đã phủ hết.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| T1 | Đã dò stack + test runner + lệnh test THẬT từ project | 0 | DỪNG, hỏi người dùng, không tự chế khung |
| T2 | Test đặt đúng tầng theo kiến trúc (lõi unit-no-DB / adapter integration) | 1–2 | Xếp lại tầng trước khi viết thêm |
| T3 | Characterization khóa hành vi cũ XANH TRƯỚC khi sửa code ít test | 3 | Chưa dám refactor sâu vùng đó |
| T4 | Suite chạy được, ghi lệnh + kết quả thật, không phụ thuộc thứ tự | 4 | Sửa test giòn / báo trước khi kết luận |
| T5 | 1 task = 1 commit, DỪNG duyệt diff, không push main | Xuyên suốt | — |

## Sau khi xong
Tóm tắt: test đã thêm (số + tầng), lệnh chạy + kết quả THẬT, nhánh/case đã phủ, **khoảng trống
+ residual risk** còn lại. Con người **duyệt diff** trước khi commit; **người dùng** tự push nhánh
+ mở PR.
Nếu gặp ràng buộc mâu thuẫn (stack ngoài Java/Python chưa có idiom trong references, hoặc không
có điểm vào rõ để characterization), DỪNG và BÁO thay vì tự đi chệch.
