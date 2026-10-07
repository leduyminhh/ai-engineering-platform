---
name: engineering-task-breakdown
description: "Skill capability (plugin engineering) để teamlead PHÂN RÃ yêu cầu, use case, ARD hoặc requirement.md thành danh sách task BE/FE giao được cho dev và agent. Phân tích ra bảng use case (actor, AC đo được, NFR), tách theo lát dọc CT → DB → BE → FE-UI → FE-INT → E2E, điền template chuẩn cho Backend và Frontend, ước lượng size S/M/L (L buộc tách), kiểm phủ AC và phụ thuộc, rồi xuất tasks.md vào docs/requests/ (tuỳ chọn Excel: xlsx hoặc CSV UTF-8 có BOM). Docs-only, không sinh code, không gán người. Dùng skill NÀY khi người dùng muốn \"tách task\", \"chia task\", \"phân rã yêu cầu\", \"breakdown task\", \"lập task BE FE\", \"task từ use case\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần ở giai đoạn plan. Không dùng khi yêu cầu còn mơ hồ cần khảo sát → engineering-spec-writing; làm feature end-to-end → workflow-feature."
order: 7
title: "Task Breakdown — phân rã yêu cầu thành task BE/FE giao được"
runsIn: plan
invoke: per-request
---

# Task Breakdown (skill dùng chung)

Biến yêu cầu thô, use case, ARD hoặc `requirement.md` thành **danh sách task giao được** cho hai đối tượng: dev
trong team đọc markdown trong repo, và agent AI (`backend-implementer`, `frontend-implementer`…) nhận từng task để
code. Skill này là **docs-only recipe** — hướng dẫn agent phân tích và viết tài liệu task, KHÔNG sinh code.

Tách theo **use case — lát dọc** `CT → DB → BE → FE-UI → FE-INT → E2E`, chỉ sinh loại task thật sự cần. Mỗi task
**tự đủ nghĩa**: người hoặc agent nhận một task không cần đọc lại toàn bộ input. `tasks.md` là **nguồn sự thật**;
Excel chỉ là bản xuất.

Teamlead giữ chốt ở hai điểm: duyệt danh sách use case (**Checkpoint 1**) và duyệt bản tách task (**Checkpoint 2**).

## Khi nào dùng

- Teamlead/manager muốn tách task, chia task, phân rã yêu cầu thành việc cho team Backend/Frontend.
- Đã có use case, ARD hoặc `requirement.md` (ví dụ do `engineering-spec-writing` viết) và cần biến thành task có
  ID, phụ thuộc, size, AC.
- Cần giao việc cho agent theo từng task: "làm task `UC01-BE-01` trong `tasks.md`".

KHÔNG dùng khi yêu cầu còn mơ hồ (chạy `engineering-spec-writing` trước), hay khi muốn làm feature end-to-end
(dùng `workflow-feature`).

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh code; chỉ ghi trong `docs/requests/`.
- **KHÔNG bịa yêu cầu.** Thiếu thông tin → đánh dấu **[giả định]** hoặc đưa vào Câu hỏi mở; không âm thầm điền.
- KHÔNG tự chốt quyết định kiến trúc → ghi Câu hỏi mở + gợi ý `engineering-adr`.
- KHÔNG gán người: cột `Owner` để trống cho teamlead.
- Đổi schema DB → nêu rõ trong task `DB` + gợi ý `workflow-db-change`.
- KHÔNG ghi đè `requirement.md` / `plan.md` có sẵn; `tasks.md` đã tồn tại → hỏi trước (xem output-formats).
- Ngôn ngữ đo được; không tuyên bố tuyệt đối.
- Con người **duyệt** ở Checkpoint 1 và Checkpoint 2 trước khi task được giao.

## Quy trình — phân rã task

0. **Nạp context (BẮT BUỘC).**
   Đọc `project-knowledge/` (`architecture.md` BE/FE, `data-model.md`, `design-system.md`, `code-convention.md`),
   `docs/contracts/`, `docs/decisions/`, `CLAUDE.md`. Thiếu `project-knowledge/` → nói rõ (fail-loud), vẫn tách
   được nhưng đánh dấu **[giả định]** ở mục "File dự kiến" và "Lệnh verify" của mọi task.

1. **Nhận diện input.**
   Xác định dạng input (yêu cầu thô / use case / ARD / `requirement.md`, có thể nhiều nguồn) theo
   [references/analysis.md](references/analysis.md). Có `requirement.md` → dùng làm nguồn chính. Chạm
   **ngưỡng mơ hồ** (không trích được use case nào có actor + mục tiêu, HOẶC không có AC đo được) → DỪNG, đề nghị
   chạy `engineering-spec-writing` trước.

2. **Phân tích → bảng Use case. ⏸ Checkpoint 1**
   Mỗi use case: ID `UC<nn>`, actor, mục tiêu, luồng chính/phụ, AC đo được, NFR, nguồn truy vết. Nguồn mâu thuẫn
   hoặc thiếu → Câu hỏi mở. Trình bảng Use case + Câu hỏi mở cho teamlead duyệt TRƯỚC khi tách task.

3. **Tách task theo lát dọc.**
   Với mỗi use case sinh task theo thứ tự `CT → DB → BE → FE-UI → FE-INT → E2E`, chỉ sinh loại cần (bảng loại và
   điều kiện ở [references/task-template-common.md](references/task-template-common.md)). Phụ thuộc chuẩn:

   | Task | Phụ thuộc |
   |---|---|
   | `BE` | `CT`, `DB` của cùng use case (nếu có) |
   | `FE-UI` | không chờ `BE` — làm song song khi có contract hoặc mock |
   | `FE-INT` | `CT`, `FE-UI` |
   | `E2E` | `BE`, `FE-INT` |

   Nền tảng dùng chung (auth, layout, shared component) → nhóm `UC00`, chỉ khi ≥ 2 use case cần.

4. **Điền template + size.**
   Task `BE` theo [references/task-template-backend.md](references/task-template-backend.md); `FE-UI` / `FE-INT`
   theo [references/task-template-frontend.md](references/task-template-frontend.md); header chung + `CT` / `DB` /
   `E2E` theo task-template-common. Size theo [references/sizing.md](references/sizing.md): S ≤ 0.5 ngày,
   M ≤ 2 ngày, L → buộc tách. Mục không áp dụng ghi `N/A — <lý do>`, không bỏ trống.

5. **Kiểm tra. ⏸ Checkpoint 2**
   Chạy [references/breakdown-checklist.md](references/breakdown-checklist.md): phủ AC, không vòng phụ thuộc,
   không task L, không mục trống, ID duy nhất. Nêu rõ phần còn thiếu (fail-loud); trình bảng tổng task cho
   teamlead duyệt.

6. **Xuất file.**
   Hỏi định dạng (nếu chưa nói): `md` (mặc định) hoặc `md + excel`. Ghi
   `docs/requests/<yyyy-mm-dd>-<slug>/tasks.md` (+ `tasks.xlsx` hoặc `tasks.csv`) theo
   [references/output-formats.md](references/output-formats.md). `plan.md` đã có → chỉ thêm 1 dòng link tới
   `tasks.md`.

## Verification (trước khi báo hoàn thành)

- Đã nạp context; phần suy đoán đánh dấu **[giả định]**; teamlead đã duyệt Checkpoint 1 và Checkpoint 2.
- Mọi AC của use case được phủ bởi ≥ 1 task; không vòng phụ thuộc; không còn task size L.
- Mọi task có đủ header chung + mục theo loại; không mục trống.
- `tasks.md` đặt đúng `docs/requests/<yyyy-mm-dd>-<slug>/`; Excel (nếu chọn) khớp `tasks.md`; nêu rõ nếu đã
  fallback CSV.
- Tiếng Việt còn nguyên dấu.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/analysis.md](references/analysis.md): nhận diện input, ngưỡng mơ hồ, bảng Use case, nguồn mâu thuẫn.
- [references/task-template-common.md](references/task-template-common.md): loại task, quy ước ID, header chung,
  template `CT` / `DB` / `E2E`, quy tắc điền.
- [references/task-template-backend.md](references/task-template-backend.md): Backend cần gì — 10 mục B1–B10 +
  template chép được.
- [references/task-template-frontend.md](references/task-template-frontend.md): Frontend cần gì — 9 mục F1–F9 +
  template chép được.
- [references/sizing.md](references/sizing.md): quy ước S/M/L + cách tách task L.
- [references/output-formats.md](references/output-formats.md): cấu trúc `tasks.md`, Excel 3 sheet, CSV UTF-8 có BOM.
- [references/breakdown-checklist.md](references/breakdown-checklist.md): Definition of Done trước Checkpoint 2.
