---
name: engineering-spec-writing
description: "Khảo sát yêu cầu và viết feature spec mức feature, AC đo được, vào docs/requests/<ngày>-<slug>/; không phân rã story; cần bộ BA đầy đủ/SAP thì handoff FIS. Dùng khi người dùng muốn \"viết spec\", \"đặc tả yêu cầu\", \"khảo sát yêu cầu\", \"feature spec\", \"PRD gọn\". Không dùng khi cần ghi quyết định kiến trúc → engineering-adr; làm feature end-to-end → workflow-feature."
order: 2
title: "Spec Writing — khảo sát yêu cầu + viết feature/requirement spec"
runsIn: plan
invoke: per-request
---

# Spec Writing (skill dùng chung)

Khảo sát yêu cầu còn thiếu rồi **viết một feature/requirement spec GỌN** vào đúng cấu trúc tài liệu sẵn có
của project (`docs/requests/<ngày>-<slug>/`). Skill này là **hướng dẫn cách agent khảo sát và viết tài liệu**
(docs-only recipe), KHÔNG sinh code và KHÔNG dựng lại bộ artifact BA/SAP sâu.

Đặc tả ở **mức FEATURE** (không phân rã story): mô tả tính năng cần gì, đo bằng gì, chạm data/contract ở đâu,
rủi ro/giả định là gì. Spec này **portable ra mọi provider** (claude/cursor/codex/antigravity) và bám scaffold
`docs/requests/_TEMPLATE` — không dựng cấu trúc song song.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần ở giai đoạn **plan** (trước khi lập
`plan.md` chi tiết hoặc bắt tay code). Con người giữ chốt: **duyệt spec** trước khi dùng làm nguồn.
Phân rã story/task chi tiết → `engineering-task-breakdown`.

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh code; KHÔNG phân rã story (giữ ở mức feature-level).
- **KHÔNG bịa yêu cầu.** Thiếu thông tin → hỏi TỪNG câu (references/elicitation.md); phần suy đoán phải đánh
  dấu **[giả định]** và đưa vào mục câu hỏi mở, không âm thầm điền.
- Acceptance criteria phải **đo được** (Given/When/Then hoặc tiêu chí kiểm được); ngôn ngữ đo được, KHÔNG
  tuyên bố "đảm bảo / loại bỏ rủi ro / chặn triệt để".
- Bám scaffold `docs/requests/_TEMPLATE` + `docs/decisions/_TEMPLATE.md`; KHÔNG dựng cấu trúc tài liệu song song.
- Defer `project-knowledge/` + `code-convention.md` (skill init lo); docs-only, không đụng CLI/adapter/engine.
- Con người **duyệt** spec trước khi dùng làm nguồn cho plan/triển khai.

## Quy trình — viết spec

1. **Nạp context (BẮT BUỘC — trước khi khảo sát).**
   Đọc `project-knowledge/` (`project-overview.md`, `domain-context.md`), `docs/decisions/` (ADR đã có),
   `docs/contracts/` (contract/data-model nếu có), `CLAUDE.md`. Từ đó xác định **feature/yêu cầu cần đặc tả**
   + **đối tượng đọc** (dev / BA / stakeholder). Thiếu `project-knowledge/` → nói rõ (fail-loud) và đề nghị
   chạy init trước, hoặc viết với giả định + ghi rõ.

2. **Khảo sát / làm rõ.**
   Đối chiếu những gì đã biết với các nhóm câu hỏi trong [references/elicitation.md](references/elicitation.md):
   mục tiêu & success criteria, actors/personas (lite), phạm vi & out-of-scope, luồng chính + edge case, dữ
   liệu & tích hợp, NFR (hiệu năng/bảo mật/khả dụng), ràng buộc & giả định, tiêu chí chấp nhận. Hỏi **TỪNG
   câu** khi thiếu; xác nhận hiểu đúng; đánh dấu mọi **[giả định]**. KHÔNG bịa để lấp chỗ trống.

3. **Viết spec.**
   Ghi vào `docs/requests/<yyyy-mm-dd>-<slug>/requirement.md` (+ khung `plan.md`) theo cấu trúc trong
   [references/spec-structure.md](references/spec-structure.md): bối cảnh/vấn đề, mục tiêu + success criteria
   (ĐO ĐƯỢC), phạm vi/out-of-scope, actors, **functional requirements ở mức FEATURE (không phân rã story)**,
   acceptance criteria, điểm chạm data/contract (link `docs/contracts/` + data-model), rủi ro/giả định/câu
   hỏi mở. Bám scaffold `_TEMPLATE`, mở rộng chứ không thay thế. Tiếng Việt CÓ DẤU.
   **Cần diagram trong spec** (flow/ERD/sequence/kiến trúc) → dùng skill **`engineering-diagram`** (cùng
   plugin) để sinh PlantUML renderable, rồi nhúng/liên kết vào spec; skill này không tự vẽ diagram.

4. **Ghi ADR cho quyết định lớn.**
   Với mỗi quyết định thiết kế/nghiệp vụ đáng lưu (chọn phương án, đánh đổi phạm vi, ràng buộc kỹ thuật lớn):
   dùng skill **`engineering-adr`** (cùng plugin) để làm rõ phương án và ghi ADR vào `docs/decisions/`; spec chỉ
   link tới ADR đó và tới contract/data-model liên quan, không tự lặp lại thủ tục ghi ADR.

5. **Verify.**
   Chạy checklist [references/checklist.md](references/checklist.md): đủ mục; mỗi requirement truy vết được
   (nguồn/actor/mục tiêu); acceptance criteria đo được; scope + out-of-scope rõ; rủi ro/giả định/câu hỏi mở
   liệt kê; ADR ghi cho quyết định lớn; đặt đúng `docs/requests/<ngày>-<slug>/`; tiếng Việt có dấu. Nêu rõ
   phần còn thiếu (fail-loud); con người **duyệt**.

## Verification (trước khi báo hoàn thành)

- Đã nạp context và xác định feature + đối tượng đọc; phần suy đoán đánh dấu **[giả định]**.
- Spec đặt đúng `docs/requests/<yyyy-mm-dd>-<slug>/requirement.md`, bám scaffold `_TEMPLATE`.
- Functional requirements ở **mức feature** (không story); acceptance criteria **đo được**.
- Điểm chạm data/contract có link; quyết định lớn có ADR ở `docs/decisions/`.
- Rủi ro / giả định / câu hỏi mở liệt kê rõ; ngôn ngữ đo được, không tuyên bố tuyệt đối.
- Tiếng Việt còn nguyên dấu; con người duyệt spec.

## Ghi chú — handoff FIS (khi cần artifact sâu)

Skill này cho spec **GỌN, portable ra mọi provider** và tích hợp cấu trúc tài liệu của repo. Khi cần:

- **Bộ artifact BA đầy đủ** — PRD, SOD, DDD, FSD, BRD, personas chi tiết, feature-catalog — hoặc
- **Đặc tả SAP-specific** (module FI/CO/MM/SD…, fit-to-standard, scope item, tài liệu FIS)

và đang **ở Cowork có skill FIS** (`fisba` / `fissap` / `fispm`) → **chuyển phần sâu sang FIS**; skill này lo
phần **spec lõi + tích hợp cấu trúc tài liệu repo**, rồi trỏ tới artifact FIS. Nêu handoff một cách graceful:
**nếu không có FIS** (ví dụ đang trên Codex/Cursor/Antigravity) thì recipe này vẫn **đủ cho spec
feature-level** — cứ hoàn thành đặc tả gọn theo luồng trên.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/spec-structure.md](references/spec-structure.md): cấu trúc feature/requirement spec + mỗi mục
  nên có gì; feature-level granularity (không phân rã story); acceptance criteria đo được; phân biệt
  functional vs NFR; cách link ADR/contract/data-model; cách map vào `requirement.md` + `plan.md` của
  `_TEMPLATE`.
- [references/elicitation.md](references/elicitation.md): bộ câu hỏi khảo sát BA theo nhóm (mục tiêu, actors,
  phạm vi/out-of-scope, luồng + edge case, dữ liệu & tích hợp, NFR, ràng buộc & giả định, tiêu chí chấp
  nhận) + nguyên tắc hỏi từng câu, xác nhận hiểu đúng, đánh dấu giả định.
- [references/checklist.md](references/checklist.md): Definition of Done cho spec (đủ mục, truy vết được, đo
  được, scope rõ, ADR ghi, đặt đúng chỗ, tiếng Việt có dấu) với ngôn ngữ đo được và fail-loud phần còn thiếu.
