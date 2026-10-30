---
name: engineering-plan-writing
description: "Lập plan.md thực thi từ design đã duyệt: bản đồ file, task theo kind, Interfaces, Global Constraints, Review Focus, tự soát 5 mục rồi chạy check-request.mjs. Dùng khi người dùng muốn \"viết plan\", \"lập kế hoạch triển khai\", \"plan.md từ design\", \"tách việc cho agent\". Không dùng khi cần bảng việc giao cho người → engineering-task-breakdown."
order: 8
title: "Plan Writing — lập plan.md thực thi cho agent từ design đã duyệt"
runsIn: execute
invoke: per-request
argument-hint: "[đường dẫn design.md hoặc thư mục docs/requests/<ngày>-<slug>/]"
---

# Plan Writing (skill dùng chung)

Biến `design.md` đã duyệt (và `requirement.md` nếu có) thành **`plan.md` để agent thực thi từng task**: mỗi task
đủ ngữ cảnh cho một implementer chỉ thấy task của mình, có bằng chứng kiểm được, và đi đúng chuỗi agent theo `kind`.
Skill này là **docs-only recipe** — chỉ ghi `plan.md`, KHÔNG sinh mã nguồn cho project.

`plan.md` khác `tasks.md` của `engineering-task-breakdown`: `plan.md` là kế hoạch thực thi cho agent (TDD, commit
từng task); `tasks.md` là bảng việc để teamlead giao cho người. Hai file không thay thế nhau — xem
"Quan hệ với tasks.md" bên dưới.

## Ranh giới an toàn

- **Docs-only** — chỉ ghi `docs/requests/<ngày>-<slug>/plan.md`; KHÔNG sinh mã nguồn, KHÔNG sửa `design.md`.
- Cỡ "thay đổi nhỏ" không có `plan.md`: brief là `requirement.md`, số task và kind do `plan-execution` chốt theo phạm vi. Gặp yêu cầu cỡ này → dừng, không tạo `plan.md`.
- KHÔNG bịa yêu cầu hay AC mới; plan chỉ phủ AC đã có ở `design.md`/`requirement.md`. Thiếu → báo, không tự thêm.
- KHÔNG chép thân hàm vào plan (xem [references/plan-structure.md](references/plan-structure.md) mục "Độ mịn").
- `plan.md` đã tồn tại → hỏi trước khi ghi đè.
- Con người **duyệt plan** ở checkpoint trước khi thực thi; không tự bắt đầu code.

## Quy trình — lập plan

1. **Nạp nguồn.** Đọc `design.md` (mục Quyết định, Tiêu chí chấp nhận, Ảnh hưởng spec), `requirement.md` nếu có,
   `project-knowledge/`, `CLAUDE.md`. Có `tasks.md` → đọc luôn (bước 5). Chưa có AC `AC<n>.<m>` → dừng, quay về
   `engineering-spec-writing`.
2. **Chốt cỡ.** Cỡ "thay đổi nhỏ" → dừng theo Ranh giới an toàn. Chỉ cỡ dự án mới lập `plan.md`.
3. **Vẽ bản đồ file trước khi chia task.** Liệt kê file tạo/sửa, mỗi file một trách nhiệm, bám pattern sẵn có của
   repo; ghi vào mục `## Bản đồ file` trước `## Global Constraints`. Chi tiết:
   [references/plan-structure.md](references/plan-structure.md).
4. **Viết header và chia task.** Điền `Global Constraints` (giá trị nguyên văn từ design) và `Review Focus` (rủi ro
   test chưa phủ). Mỗi task: `**Kind:**`, `**Phủ AC:**`, `**Files:**` (có `- Test:`), `**Interfaces:**`
   (Consumes/Produces), rồi các step. Chia task và step theo
   [references/plan-structure.md](references/plan-structure.md); ghi `kind` theo bảng ánh xạ cũng ở đó.
5. **Có `tasks.md`?** Task trong `plan.md` trỏ ID task của `tasks.md` thay vì chia lại, và hai file dùng chung một
   checkpoint duyệt. Không có `tasks.md` → plan tự chia task, không bắt buộc tạo `tasks.md`.
6. **Tự soát.** Chạy 5 mục trong [references/self-review.md](references/self-review.md), sửa tại chỗ, rồi chạy
   `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<ngày>-<slug>/`. Còn cảnh báo ngoài W9 → sửa `plan.md`; không xoá `**Files:**`/test để
   tắt cảnh báo. Request chia part (có `## Bảng part`): mỗi part một `parts/<nn>-<part-slug>/plan.md`
   ([references/plan-structure.md](references/plan-structure.md) mục "Request chia part"), chạy thêm
   `node <thư mục skill artifact-templates>/scripts/check-partition.mjs docs/requests/<ngày>-<slug>/` sau `check-request.mjs`.
7. **Checkpoint plan ⏸.** Trình plan + kết quả tự soát cho người duyệt. Câu hỏi còn lại gom vào một tin nhắn.

## Quan hệ với tasks.md

- `engineering-task-breakdown` tách task để giao người (size S/M, B1–B10/F1–F9); `plan.md` tách task để agent chạy
  TDD. Hai mục đích khác nhau nên giữ cả hai khi cần, nhưng **không chia hai lần**: có `tasks.md` thì ID task ở
  `plan.md` bám `tasks.md`.
- Một checkpoint duyệt chung cho cả hai, không hỏi người duyệt hai lần.

## Verification (trước khi báo hoàn thành)

- Mọi `AC<n>.<m>` của design xuất hiện ở `**Phủ AC:**` của ít nhất một task.
- Mọi task có `**Kind:**` thuộc tập đóng, `**Files:**` có `- Test:`, `**Interfaces:**`.
- Đã chạy tự soát 5 mục và `check-request.mjs`; còn cảnh báo nào thì nêu rõ lý do (fail-loud).
- Không có `plan.md` cho cỡ "thay đổi nhỏ".
- Tiếng Việt còn nguyên dấu.

## Bản đồ tài liệu

- [references/plan-structure.md](references/plan-structure.md): bản đồ file, độ mịn task/step, `kind` → chuỗi agent,
  Interfaces, Global Constraints, Review Focus, request chia part.
- [references/self-review.md](references/self-review.md): tự soát 5 mục, rồi `check-request.mjs`.
