---
name: backend-implement
description: "Recipe on-demand: biến một use-case/feature/contract thành MỘT vertical slice tối thiểu (aggregate + use-case + driven port + adapter) bám ĐÚNG kiến trúc backend đã chọn (Java/Python × Onion+DDD / Hexagonal+DDD / Hexagonal-Clean+CQRS / layered) + quy ước đặt tên của blueprint. Sinh code xuyên mọi tầng, map ở biên bằng mapper thủ công, kèm test lõi mock/fake port; con người duyệt diff. Dùng skill NÀY khi người dùng muốn \"code API mới\", \"hiện thực feature backend\", \"sinh endpoint/use-case\", \"viết vertical slice\", \"làm API theo contract\", \"thêm use case\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã chạy backend-init."
order: 2
stageNumber: "02"
title: "Backend Implement — Sinh vertical slice từ use-case/contract"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Backend Implement — Sinh vertical slice từ use-case (recipe on-demand)

Biến một **use-case / feature / contract** thành **MỘT vertical slice tối thiểu** (một aggregate + một
use-case + một driven port + một adapter) bám kiến trúc backend + quy ước đặt tên của project. Skill này là
**hướng dẫn cách agent sinh code** (docs-only recipe), KHÔNG phải công cụ codegen. Recipe `pipeline: false`,
gọi khi cần — không thuộc chuỗi bắt buộc.

## Tiền đề

- Project **đã chạy `backend-init`** (có `project-knowledge/`: `architecture.md` = kiến trúc đã chọn,
  `source-structure.md`, `data-model.md`, `code-convention.md`, `tech-stack`). Chưa có → đề nghị chạy
  `backend-init` trước; hoặc chạy với **giả định an toàn + ghi rõ giả định** (fail-loud), không âm thầm bịa
  kiến trúc/naming.
- Mọi bối cảnh nằm trong FILE. Con người giữ chốt: **duyệt diff trước khi commit**.

## Quy trình

### 0. Nạp context (BẮT BUỘC — đọc TRƯỚC khi sinh)
- Đọc `project-knowledge/`: **kiến trúc đã chọn** (`architecture.md` — stack **java/python** + kiểu
  **hexagonal-ddd / onion-ddd / hexagonal-clean-cqrs / layered**), `source-structure.md` (cây `src/` thật),
  `data-model.md` (ERD/aggregate), `code-convention.md`, `tech-stack`.
- Đối chiếu **blueprint kiến trúc** ship kèm ở `architecture/<stack>-<kiểu>.template.md` + [ARD.md](architecture/ARD.md)
  để biết **cây thư mục, Dependency Rule, quy ước đặt tên**. Đây là nguồn quyết định "đặt file ở đâu" và
  "gọi tên tầng/port thế nào" — KHÔNG tự chế.
- Dò **stack thật** từ `pom.xml` / `build.gradle` / `pyproject.toml` / `requirements.txt`: framework, ORM,
  test runner, công cụ kiểm ranh giới (ArchUnit / import-linter) + **lệnh build/test** thật để chạy ở bước 4.

### 1. Chốt use-case
Từ nguồn đầu vào (mô tả người dùng · `docs/requests/<...>/requirement.md` · contract
`docs/contracts/openapi.json` nếu có), xác định phạm vi TRƯỚC khi sinh — chi tiết:
[references/use-case-intake.md](references/use-case-intake.md).
- **Aggregate root + invariant** liên quan; use-case là **command** (đổi trạng thái) hay **query** (đọc);
  **driven port** cần (repository/gateway); **input/output DTO**.
- Nguyên tắc "**một use-case, một aggregate, tối giản**". Thiếu thông tin (chưa rõ aggregate/nghiệp vụ) →
  **hỏi hoặc nêu giả định**, KHÔNG bịa.

### 2. Thiết kế slice tối thiểu
Một aggregate · một use-case · một driven port + một adapter — theo ARD "**tối giản, không phình**"
([ARD.md](architecture/ARD.md) mục 8: "Tối giản, không phình"). KHÔNG sinh nhiều feature trong một
lần; feature khác là slice khác, gọi lại skill.

### 3. Sinh code ĐÚNG kiến trúc
Theo [references/slice-workflow.md](references/slice-workflow.md) — **DEFER cây/naming/boundary cho blueprint**:
- **Đặt file đúng tầng/module** theo blueprint `<stack>-<kiểu>` đã chọn (không chép cây ở đây — đọc template).
- **Tôn trọng Dependency Rule:** `domain`/`application` thuần, **không import** framework/ORM/web; inbound
  adapter **không gọi thẳng** outbound adapter (đi qua use-case/port).
- **Map ở biên bằng mapper thủ công:** DTO↔command ở inbound adapter/mapper; aggregate↔row ở persistence
  mapper (Java: MapStruct riêng cạnh adapter; Python: module hàm thuần). KHÔNG map inline, KHÔNG "thư viện ma
  thuật" trộn model.
- **Đặt driven port đúng chỗ theo kiểu:** Onion → `domain/repository`; Hexagonal/CQRS → `application/port(s)/out(bound)`.
- **Ranh giới transaction ở use-case**, không ở adapter; **một transaction = một aggregate** (ARD).
- Tuân thủ `code-convention.md` + quy ước đặt tên của template **tuyệt đối**.

### 4. Verify (Definition of Done)
Theo [references/checklist.md](references/checklist.md):
- **Build xanh** + **test use-case xanh** (unit lõi mock/fake port, KHÔNG cần DB; adapter chạm hạ tầng thì
  thêm integration test).
- **Ranh giới xanh:** ArchUnit (Java) / import-linter (Python) — `domain`/`application` không import
  framework; inbound không import outbound.
- **Đúng một aggregate/use-case** (không phình); map thủ công ở biên; đặt tên theo convention.
- Nêu rõ phần **bỏ qua / giả định** (fail-loud). Con người **duyệt diff** trước khi commit.

## Ranh giới

- Một use-case/aggregate mỗi lần; **KHÔNG chạy DB migration thật** (thuộc `data` nhánh OLTP / recipe migration
  khác); **KHÔNG externalize config/secret** (thuộc `backend-migrate-vault-consul`); không đụng secret.
- Defer `code-convention.md` + **blueprint kiến trúc tuyệt đối**; **KHÔNG chép lại cây/naming** của template —
  chỉ TRỎ tới `architecture/<stack>-<kiểu>.template.md` + `ARD.md`.
- Đổi kiến trúc là việc của `backend-migrate-architecture`, không phải skill này.
- Chỉ chạm plugin `backend`. Con người duyệt diff trước commit.

## Ghi chú

- Chưa chạy `backend-init` → thiếu `project-knowledge/`; đề nghị chạy `backend-init` trước để có kiến trúc +
  data-model làm chuẩn, rồi mới gọi skill này.
- Nối hạ tầng thật (DB migration, externalize config) là các recipe khác, ngoài phạm vi slice này.
