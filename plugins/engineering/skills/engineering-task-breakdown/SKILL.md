---
name: engineering-task-breakdown
description: "Phân rã yêu cầu/use case/ARD thành task BE/FE theo lát dọc, qua 2 checkpoint teamlead và check-tasks.mjs, xuất tasks.md vào docs/requests/ (tuỳ chọn Excel). Dùng khi người dùng muốn \"tách task\", \"chia task\", \"phân rã yêu cầu\", \"breakdown task\", \"task từ use case\". Không dùng khi yêu cầu còn mơ hồ cần khảo sát → engineering-spec-writing; làm feature end-to-end → workflow-feature."
order: 7
title: "Task Breakdown — phân rã yêu cầu thành task BE/FE giao được"
runsIn: plan
invoke: per-request
argument-hint: "[đường dẫn requirement/use case/ARD]"
---

# Task Breakdown (skill dùng chung)

Biến yêu cầu thô, use case, ARD hoặc `requirement.md` thành **danh sách task giao được** cho hai đối tượng: dev
trong team đọc markdown trong repo, và agent AI (`backend-implementer`, `frontend-implementer`…) nhận từng task để
code. Skill này là **docs-only recipe** — hướng dẫn agent phân tích và viết tài liệu task, KHÔNG sinh mã nguồn cho
project; kèm script kiểm tra/xuất tất định `scripts/check-tasks.mjs`.

Tách theo **use case — lát dọc** `CT → DB → BE → FE-UI → FE-INT → E2E`, chỉ sinh loại task thật sự cần. Mỗi task
**tự đủ nghĩa**: người hoặc agent nhận một task không cần đọc lại toàn bộ input. `tasks.md` là **nguồn sự thật**;
Excel chỉ là bản xuất.

Teamlead giữ chốt ở hai điểm: duyệt danh sách use case (**Checkpoint 1**) và duyệt bản tách task (**Checkpoint 2**).

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh mã nguồn cho project; chỉ ghi trong `docs/requests/` (kể cả CSV do
  `check-tasks.mjs --csv` xuất).
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

   Bảng là phụ thuộc **tối thiểu**. Được thêm phụ thuộc ngoài bảng — `BE` → `BE` khi dùng sự kiện/dữ liệu task kia tạo; chéo use case khi dùng bảng/contract của use case khác; task dùng nền tảng → task `UC00` tương ứng — nếu nêu lý do ở Ngữ cảnh. `FE-UI` không ghi `CT` vào Phụ thuộc.

   Nền tảng dùng chung (auth, layout, shared component) → nhóm `UC00`, chỉ khi ≥ 2 use case cần.

4. **Điền template + size.**
   Task `BE` theo [references/task-template-backend.md](references/task-template-backend.md); `FE-UI` / `FE-INT`
   theo [references/task-template-frontend.md](references/task-template-frontend.md); header chung + `CT` / `DB` /
   `E2E` theo task-template-common. Size theo [references/sizing.md](references/sizing.md): S ≤ 0.5 ngày,
   M ≤ 2 ngày, L → buộc tách. Mục không áp dụng ghi `N/A — <lý do>`, không bỏ trống.

5. **Kiểm tra. ⏸ Checkpoint 2**
   Ghi bản nháp `docs/requests/<yyyy-mm-dd>-<slug>/tasks.md` theo
   [references/output-formats.md](references/output-formats.md) §2–§3 (đã tồn tại → hỏi trước). Có Node → chạy
   `node <thư mục skill>/scripts/check-tasks.mjs <đường dẫn tasks.md>` ([scripts/check-tasks.mjs](scripts/check-tasks.mjs));
   exit 1 → sửa `tasks.md` theo từng dòng lỗi rồi chạy lại tới khi 0 lỗi; cảnh báo W1 → thêm phụ thuộc hoặc nêu lý do ở
   Ngữ cảnh; W2 → bỏ `CT` khỏi Phụ thuộc của `FE-UI` (luật ở bước 3). Rồi chạy
   [references/breakdown-checklist.md](references/breakdown-checklist.md) cho các mục script không kiểm
   (không có Node → kiểm cả checklist thủ công). Nêu rõ phần còn thiếu (fail-loud); trình bảng tổng task cho
   teamlead duyệt. Câu hỏi mở phát sinh ở bước 3–5 trình cùng Checkpoint 2.

6. **Xuất file.**
   Hỏi định dạng (nếu chưa nói): `md` (mặc định) hoặc `md + excel`. `tasks.md` đã ghi ở bước 5; chọn excel →
   `tasks.xlsx` hoặc `tasks.csv` theo [references/output-formats.md](references/output-formats.md) §4 (CSV ưu tiên
   `check-tasks.mjs --csv`). `plan.md` đã có → chỉ thêm 1 dòng link tới `tasks.md`.

## Verification (trước khi báo hoàn thành)

- Đã nạp context; phần suy đoán đánh dấu **[giả định]**; teamlead đã duyệt Checkpoint 1 và Checkpoint 2.
- Mọi AC của use case được phủ bởi ≥ 1 task; không vòng phụ thuộc; không còn task size L.
- `check-tasks.mjs` báo 0 lỗi (hoặc ghi rõ không có Node và đã kiểm checklist thủ công).
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
- [scripts/check-tasks.mjs](scripts/check-tasks.mjs): kiểm `tasks.md` (lỗi E1–E9, cảnh báo W1–W2) + xuất CSV UTF-8 có
  BOM; Node ≥ 20, không phụ thuộc ngoài.
