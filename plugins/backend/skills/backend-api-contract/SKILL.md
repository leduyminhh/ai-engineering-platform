---
name: backend-api-contract
description: "Recipe on-demand: chốt & đồng bộ API CONTRACT (OpenAPI-first) giữa backend và frontend cho một BACKEND project (Java/Spring, Python) — thiết kế/cập nhật contract ở docs/contracts/ (OpenAPI 3.1) TRƯỚC khi code, versioning + backward-compat (SemVer, thay đổi tương thích vs breaking, deprecate có lộ trình), và kiểm DRIFT contract↔code (endpoint/DTO thực tế khớp contract: thiếu/thừa field, kiểu sai, endpoint lệch). Contract là nguồn sự thật FE↔BE — BE dựng controller/@HttpExchange theo contract, FE sinh client/type từ contract. READ-ONLY mặc định ở bước kiểm drift; con người duyệt diff. Dùng skill NÀY khi người dùng muốn \"api contract\", \"openapi\", \"swagger/openapi spec\", \"hợp đồng API\", \"đồng bộ contract FE BE\", \"versioning API\", \"kiểm drift contract\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần trên project đã có docs/contracts hoặc mã nguồn. Không dùng khi cần làm API end-to-end (contract, code, test, commit) → workflow-api; hiện thực code theo contract đã chốt → backend-implement."
order: 8
title: "Backend API Contract — Chốt & đồng bộ OpenAPI contract FE↔BE, kiểm drift (recipe on-demand)"
runsIn: plan
invoke: per-request
sharedAssets: templates/architecture
---

# Backend API Contract — Chốt & đồng bộ API contract (OpenAPI-first, recipe on-demand)

Recipe hướng dẫn agent **chốt và đồng bộ API contract giữa backend và frontend** theo lối
**OpenAPI-first**: định nghĩa/cập nhật contract ở `docs/contracts/` (OpenAPI 3.1) làm **nguồn sự thật
FE↔BE**, quản **versioning + backward-compat**, và **kiểm drift** contract↔code (endpoint/DTO thực tế
có khớp contract không). Đây là **docs-only recipe** — hướng dẫn cách agent đọc, thiết kế contract và
báo cáo lệch, KHÔNG phải công cụ codegen/sinh client, cũng KHÔNG phải trình validate dựng sẵn. Recipe
on-demand, gọi khi cần — không thuộc chuỗi bắt buộc.

Vị trí trong hệ: contract là **mặt published** của service — theo `architecture/ARD.md` mục 5 (module
`<bc>-api-contract`: "chỉ hợp đồng, không logic, không domain") và mục 6.1 ("Publish & versioning
contract"). Skill này chốt nội dung + vòng đời của mặt published đó; `backend-implement` mới sinh code
slice bám theo nó.

## Tiền đề

- Project **đã chạy `backend-init`** (có `project-knowledge/` + `docs/contracts/`). `backend-init` có thể
  đã tạo `docs/contracts/openapi.json` rỗng-hợp-lệ. Chưa có → đề nghị chạy `backend-init` trước, hoặc chạy
  với **giả định an toàn có nhãn** (fail-loud), KHÔNG âm thầm bịa vị trí/định dạng contract.
- Mọi bối cảnh nằm trong FILE. Con người giữ chốt: **duyệt diff contract trước khi commit**.

## Ranh giới an toàn (CLAUDE.md)

- **Docs-only.** Skill này chạm **file contract trong `docs/contracts/`** + báo cáo; KHÔNG sinh code, KHÔNG
  commit, KHÔNG chạy codegen. Sinh controller/`@HttpExchange`/client là việc của `backend-implement` và
  công cụ FE — skill này chỉ chốt contract để hai bên bám theo.
- **Bước kiểm drift READ-ONLY mặc định.** Đối chiếu contract↔code chỉ **đọc và báo lệch**; chỉ sửa
  contract hoặc code khi người dùng yêu cầu rõ, và vẫn DỪNG cho người **duyệt diff** (1 việc = 1 commit).
- **Contract là nguồn sự thật FE↔BE.** Khi contract và code lệch nhau, mặc định coi **contract là chuẩn**
  và đề xuất sửa code cho khớp — TRỪ khi người dùng chốt ngược lại (code đúng, contract cũ) thì cập nhật
  contract kèm version. KHÔNG tự chọn bên im lặng.
- **Không tự đổi API công khai không qua version.** Mọi thay đổi phá tương thích (breaking) phải **bump
  version + ghi note** theo `references/versioning.md`; KHÔNG sửa contract published tại chỗ theo kiểu
  breaking mà giữ nguyên version.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — mô tả contract, bảng drift, đề xuất — viết
  **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo cáo bằng thứ đếm được (số endpoint/schema, số điểm drift theo loại, path/field
  cụ thể). KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / khớp hoàn toàn / hết drift"; LUÔN nêu **phần
  chưa soát + residual risk**. Đối chiếu tĩnh phản ánh thời điểm đọc, có thể sót hành vi runtime (validation
  động, serialize tuỳ điều kiện) không lộ trong khai báo.

## Quy trình (trung tính stack)

### 0. Nạp context + chốt scope — BẮT BUỘC trước khi làm

- Đọc `project-knowledge/` (`architecture.md` = **kiến trúc đã chọn**, `source-structure.md`,
  `code-convention.md`, `tech-stack`). Xác định **kiến trúc có module/tầng `api-contract` không** (đối chiếu
  `architecture/ARD.md` mục 5–6): đơn-service → tầng `api-contract`; đa-service → artifact `<bc>-api-contract`
  publish liên-repo (versioning ở mục 6.1).
- Đọc **contract hiện có** trong `docs/contracts/` (vd `openapi.json`): version, `paths`, `components.schemas`
  đã có gì. Nếu chưa có file → chuẩn bị tạo bản khởi tạo hợp lệ (mục 1).
- **Dò stack thật** để biết contract sinh/soát từ đâu: Java/Spring (`springdoc-openapi` từ controller,
  interface `@HttpExchange`), Python/FastAPI (`pydantic` model → OpenAPI tự sinh ở `/openapi.json`). Ghi rõ
  contract là **nguồn viết tay** (design-first) hay **được sinh từ code** (code-first) — quyết định chiều
  đồng bộ ở bước 4.
- **Chốt scope:** service/endpoint nào trong lượt này (một feature, một nhóm path, hay soát toàn contract).
  KHÔNG lan ngoài scope người dùng nêu.

### 1. OpenAPI-first — thiết kế/cập nhật contract TRƯỚC

Theo [references/openapi-first.md](references/openapi-first.md): chốt/cập nhật contract **trước** khi hiện
thực, contract là nguồn sự thật hai bên bám vào.

- Đặt contract ở `docs/contracts/openapi.json` (hoặc vị trí project đã chọn) — OpenAPI **3.1**.
- Mỗi operation: `path` + method + request (params/body schema) + response (status → schema) + mã lỗi. DTO
  request/response khai ở `components.schemas`, tham chiếu bằng `$ref` (KHÔNG lặp inline).
- Contract chỉ mô tả **mặt biên published**, KHÔNG mô tả cấu trúc domain nội bộ (đối chiếu ARD mục 5: "không
  logic, không domain").

### 2. Đồng bộ FE↔BE

Từ contract đã chốt, hai bên bám cùng một nguồn:

- **DTO published** (request/response) + **endpoint declaration** khớp contract là ranh giới chung. BE dựng
  controller/route (Java: interface `@HttpExchange` + controller theo `springdoc`; Python: FastAPI route +
  Pydantic schema) **theo contract**; DTO ở tầng `api-contract`/schemas, KHÔNG để aggregate domain rò ra biên
  (map ở biên — theo `backend-implement`).
- **FE sinh client/type từ contract** (openapi-generator / orval / openapi-typescript…) — skill này KHÔNG chạy
  codegen, chỉ chốt contract để FE sinh. Nêu rõ contract nằm đâu để FE trỏ tới.
- Contract là điểm hẹn: FE và BE thay đổi biên đều qua sửa contract trước, tránh mỗi bên tự đoán.

### 3. Versioning & backward-compat

Theo [references/versioning.md](references/versioning.md) + `architecture/ARD.md` mục 6.1:

- **SemVer theo góc nhìn consumer:** thêm field optional / endpoint mới = **MINOR**; đổi/bỏ field, đổi kiểu,
  đổi nghĩa, siết validation = **MAJOR** (breaking).
- Thay đổi **tương thích ngược** cập nhật trong cùng MAJOR; **breaking** phải bump MAJOR + ghi note, và chạy
  song song bản cũ tới khi consumer chuyển xong.
- **Deprecate có lộ trình:** đánh dấu `deprecated: true` + note thay thế + mốc gỡ, KHÔNG xoá đột ngột.

### 4. Kiểm drift contract↔code

Theo [references/contract-drift-check.md](references/contract-drift-check.md) — **READ-ONLY mặc định**:

- Đối chiếu **contract ↔ endpoint/DTO code thật**: endpoint khai trong contract có tồn tại trong code (và
  ngược lại)? request/response DTO field khớp (tên, kiểu, required, enum)? status code khớp?
- Báo lệch phân loại: **thiếu field / thừa field / kiểu sai / required lệch / endpoint lệch (path/method/status)**,
  mỗi điểm kèm vị trí cụ thể (path + field, `file:line` phía code nếu đọc được).
- Đề xuất sửa theo nguyên tắc "contract là nguồn sự thật" (sửa code cho khớp), hoặc cập nhật contract kèm
  version nếu người dùng chốt code đúng. KHÔNG tự sửa khi chưa được yêu cầu.

### 5. Verify (Definition of Done)

- **Contract hợp lệ:** OpenAPI 3.1 parse được, không `$ref` gãy, mỗi operation có response khai; nếu có công
  cụ validate của project thì chạy và nêu kết quả thật (KHÔNG tự nhận "valid" khi chưa chạy được).
- **Không phát hiện drift trong scope** đã soát — hoặc liệt kê đầy đủ điểm drift còn lại kèm đề xuất.
- **Breaking change có version + note** (không breaking âm thầm cùng version).
- Nêu rõ **phần chưa soát + residual risk** (endpoint ngoài scope, hành vi runtime không lộ trong khai báo).
  Con người **duyệt diff** trước khi commit.

## Ranh giới

- **Docs-only:** chỉ chạm contract trong `docs/contracts/` + báo cáo; KHÔNG sinh controller/client (đó là
  `backend-implement` + công cụ FE), KHÔNG chạy DB migration, KHÔNG externalize config/secret.
- **Contract là nguồn sự thật FE↔BE**; **không tự đổi API công khai không qua version** — breaking phải bump
  MAJOR + note.
- Bước kiểm drift **read-only mặc định**; sửa chỉ khi được yêu cầu rõ, người duyệt diff.
- Chỉ chạm plugin `backend`, đúng scope người dùng nêu. Ngôn ngữ đo được, nêu residual.

## Ghi chú

- Chưa chạy `backend-init` → thiếu `docs/contracts/`; đề nghị chạy init trước (init có thể tạo `openapi.json`
  rỗng-hợp-lệ) rồi mới gọi skill này.
- Sinh code slice bám contract → `backend-implement` (đọc contract ở bước "chốt use-case").
- Publish/versioning contract liên-repo (đa-service) → chi tiết ở `architecture/ARD.md` mục 6.1–6.3.
