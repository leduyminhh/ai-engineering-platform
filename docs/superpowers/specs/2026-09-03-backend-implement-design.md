# Thiết kế: Skill `backend-implement` — sinh vertical slice từ use-case/contract

- Ngày: 2026-09-03
- Trạng thái: **Đã thực thi** — skill `backend-implement` (`a7c5342`), merge vào `master` qua PR #23 (`d08de01`, 2026-09-04).
- Phạm vi: Nội dung — thêm skill recipe on-demand `backend-implement` cho plugin `backend`. Không đổi
  engine/adapter/CLI.

## 1. Mục tiêu & tiêu chí thành công

Việc lặp lại hằng ngày "code một API/use-case mới trên project backend đã có kiến trúc" hiện chưa có skill
hỗ trợ (`backend` mới có `backend-init` docs-only + hai recipe migrate). Mục tiêu: một recipe biến **một
use-case/feature/contract** thành **MỘT vertical slice tối thiểu** (aggregate + use-case + driven port +
adapter) bám **đúng kiến trúc backend đã chọn** (Java/Python × Onion+DDD / Hexagonal+DDD /
Hexagonal-Clean+CQRS / layered) và quy ước đặt tên của blueprint.

Thành công khi:

1. Có `plugins/backend/skills/backend-implement/SKILL.md` (recipe mỏng) + `references/` (dày) theo cách
   khung vận hành.
2. Skill là recipe **on-demand** (`pipeline: false`, `next: null`, `order` sau `backend-init`), auto-discover,
   project ra **cả 4 provider**, parity `references/`.
3. Skill khai `sharedAssets: templates/architecture` để đọc được blueprint kiến trúc đã chọn + `ARD.md`.
4. `npm test` xanh; `npm run build` ship skill + references ra 4 provider.
5. **Docs-only** — skill là *hướng dẫn agent sinh code*, không phải codegen tool; không tự viết runtime
   của khung, KHÔNG chép lại cây thư mục/naming của template (chỉ TRỎ tới template).

## 2. Phạm vi

- **Trong phạm vi:** 3 nguồn đầu vào (mô tả người dùng · `docs/requests/<...>/requirement.md` · contract
  `docs/contracts/openapi.json`). Đầu ra **MỘT slice tối thiểu** xuyên mọi tầng: một aggregate, một use-case
  (command hoặc query), một driven port + một adapter, kèm test lõi (mock/fake port). Tôn trọng Dependency
  Rule + map-ở-biên của kiến trúc đã chọn.
- **Ngoài phạm vi:** DB migration thật (thuộc `oltp-database` / recipe migration khác); externalize
  config/secret (thuộc `backend-migrate-vault-consul`); đổi kiến trúc (thuộc `backend-migrate-architecture`);
  nhiều feature/aggregate trong một lần; đụng secret; hạ tầng thật (chỉ integration test tùy chọn cho adapter).

## 3. Kiến trúc đích

```
plugins/backend/skills/backend-implement/
├── SKILL.md                         # recipe mỏng: nạp context -> chốt use-case -> thiết kế slice -> sinh -> verify
└── references/
    ├── use-case-intake.md           # chốt phạm vi: aggregate + invariant, command/query, driven port, IO DTO
    ├── slice-workflow.md            # sinh slice DEFER cây/naming/boundary cho blueprint; recap map-ở-biên + transaction
    └── checklist.md                 # Definition of Done: build/test/boundary xanh, một aggregate, người duyệt diff
```

Frontmatter: `pipeline: false`, `next: null`, `order: 2`, `stageNumber: "02"`, `runsIn: execute`,
`invoke: per-request`, `sharedAssets: templates/architecture` (đọc blueprint `<stack>-<kiểu>.template.md` +
`ARD.md`; cùng nguồn với `backend-init`/`backend-migrate-architecture`).

## 4. Luồng skill (5 bước)

0. **Nạp context (bắt buộc):** đọc `project-knowledge/` (`architecture.md` = kiến trúc đã chọn: stack
   java/python + kiểu hexagonal-ddd/onion-ddd/hexagonal-clean-cqrs/layered; `source-structure.md`,
   `data-model.md`, `code-convention.md`, `tech-stack`); đọc blueprint tương ứng
   `architecture/<stack>-<kiểu>.template.md` + `ARD.md` để biết cây, Dependency Rule, đặt tên. Dò stack thật
   (`pom.xml`/`build.gradle`/`pyproject.toml`/`requirements.txt`) + lệnh build/test.
1. **Chốt use-case** (references/use-case-intake.md): từ mô tả người dùng / `docs/requests/<...>/requirement.md`
   / contract (`docs/contracts/openapi.json` nếu có). Xác định aggregate + invariant, use-case là command hay
   query, driven port cần (repository/gateway), input/output DTO.
2. **Thiết kế slice tối thiểu:** một aggregate, một use-case, driven port + adapter — theo ARD "tối giản, không
   phình". KHÔNG sinh nhiều feature.
3. **Sinh code đúng kiến trúc** (references/slice-workflow.md): đặt file đúng tầng/module theo blueprint đã
   chọn; tôn trọng Dependency Rule (domain thuần không import hạ tầng; inbound không gọi thẳng outbound); map
   ở biên bằng mapper thủ công (DTO↔command, aggregate↔row); đặt tên theo `code-convention` + template.
4. **Verify** (references/checklist.md): build + test (unit lõi mock/fake port, không cần DB; adapter có
   integration test nếu chạm hạ tầng), lint ranh giới (ArchUnit/import-linter) xanh; con người duyệt diff.

## 5. Kiểm thử & verification

- `npm test`: frontmatter contract (order duy nhất, recipe `pipeline: false`/`next: null`), parity
  `references/`/sharedAssets qua 4 adapter, strip workflow-metadata. Phải xanh.
- `npm run build`: `backend-implement/` + `references/` xuất hiện trong output backend của **cả 4 provider**.

## 6. Ranh giới / ngoài phạm vi

- Một use-case/aggregate mỗi lần; KHÔNG chạy DB migration thật; KHÔNG externalize config/secret; không đụng
  secret; một transaction = một aggregate (theo ARD).
- Defer `code-convention.md` + blueprint kiến trúc **tuyệt đối**; KHÔNG chép lại cây/naming của template —
  chỉ TRỎ tới `architecture/<stack>-<kiểu>.template.md` + `ARD.md`.
- Thiếu `project-knowledge/` (chưa chạy `backend-init`) → skill đề nghị chạy init trước hoặc chạy với giả
  định an toàn + ghi rõ (fail-loud).
- Chỉ chạm plugin `backend`; không đụng CLI/adapter/engine. Con người duyệt diff trước commit.

## 7. Các pha thực thi

1. Viết `SKILL.md`.
2. Viết 3 file `references/`.
3. `npm test` + `npm run build`; xác nhận ship qua 4 provider.
