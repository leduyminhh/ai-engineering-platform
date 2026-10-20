---
name: <skill-id>
description: "<Hành động một câu, ≤ 200 ký tự>. Dùng khi người dùng muốn \"<trigger 1>\", \"<trigger 2>\", \"<trigger 3>\". Không dùng khi <tình huống> → <id-skill-khác>."
order: <n>
title: "<Tiêu đề skill>"
runsIn: <plan|execute>
invoke: per-request
---

<!-- artifact-template
type: skill
version: 2
validator: cli/lib/conventions.mjs → checkSkillBody, checkDescription, checkDescriptionStyle, checkSourceKeys (chỉ có trong repo aip)
sources: Anthropic skill best practices; agentskills.io
Bỏ khối này khi chép template ra dùng.
-->

# <Tiêu đề skill>

<Một đoạn ngắn: skill làm gì, đầu vào, đầu ra. Giữ SKILL.md dưới 500 dòng; phần chi tiết đẩy sang `references/`, mỗi reference chỉ sâu một tầng (SKILL.md → reference, reference không trỏ tiếp sang reference khác).>

## Quy trình — <tên>

Sao checklist này vào phản hồi và đánh dấu từng bước khi làm:

- [ ] 1. <Bước 1: đọc đầu vào, xác định phạm vi>
- [ ] 2. <Bước 2: thực hiện việc chính>
- [ ] 3. <Bước 3: chạy validator hoặc lệnh kiểm>
- [ ] 4. <Bước 4: báo kết quả kèm evidence>

**Vòng kiểm:** chạy `<lệnh validate>` → lỗi thì sửa theo thông báo → chạy lại `<lệnh validate>` → chỉ qua bước 4 khi sạch. Sau 3 vòng vẫn lỗi thì dừng và báo người dùng, không nới validator.

## Ranh giới an toàn

- <Điều skill không được làm: ghi ngoài phạm vi, chạy lệnh phá hủy, đọc secret, …>
- <Điểm phải dừng và chờ người dùng xác nhận>

## Verification (trước khi báo hoàn thành)

- <Lệnh kiểm + kết quả mong đợi (exit code, số fail = 0)>
- <Evidence cần đính kèm: file:line, output lệnh>

## Bản đồ tài liệu

- [references/<tên>.md](references/<tên>.md): <nội dung và khi nào nạp>
