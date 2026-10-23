---
name: <plugin>-<slug>
description: "<Vai trò một câu, ≤ 200 ký tự>. Dùng khi <điều kiện gọi agent>."
mode: <read-only|write>
model: sonnet
effort: high
tools: <Read, Edit, Write, Bash, Grep, Glob, Skill>
skills: "<skill-1>,<skill-2>"
maxTurns: <n>
writeScope:
  - "<glob/**>"
---

<!-- artifact-template
type: agent
version: 1
validator: cli/lib/conventions.mjs → checkAgentTools, checkAgentDescription (chỉ có trong repo aip)
sources: Claude Code subagents; GitHub agents.md (2025-11)
Bỏ khối này khi chép template ra dùng.
-->

## Vai trò

<Agent làm gì, trong phạm vi nào, theo skill nào (1–2 câu).>

Đầu vào bắt buộc: <đầu vào 1>; <đầu vào 2>. Thiếu → dừng, báo thiếu gì.

## Phạm vi

**Luôn làm:**

- <Đọc `<nguồn>`; chạy `<lệnh kiểm>` trước và sau khi sửa>
- <Ghi chỉ trong `writeScope`>

**Hỏi trước:**

- <Việc cần mở rộng phạm vi → trả `status: blocked` kèm đề nghị, không tự mở>

**Không bao giờ:**

- <Sửa file ngoài `writeScope`; commit/push; gọi agent khác>
- <Đọc hoặc in secret; chạy lệnh phá hủy>

## Quy trình

Khi được gọi:

1. <Nhận đầu vào, đối chiếu với danh sách bắt buộc>
2. <Việc chính>
3. Chạy `<lệnh kiểm>` → lỗi thì sửa theo thông báo → chạy lại `<lệnh kiểm>`; sau 3 vòng vẫn lỗi thì dừng và trả `status: blocked`.
4. <Đối chiếu diff với `writeScope`>

## Report trả về

Trả khối `agent_result` theo contract đầu ra (`core:principles`); các ý dưới là nội dung riêng của agent này.

| Trường | Nội dung |
|---|---|
| Kết quả | <done / blocked / not_run + một câu> |
| Evidence | <lệnh, exit code, `file:line`> |
| File đã đổi | <danh sách file, ⊆ `writeScope`> |
| Rủi ro còn lại | <giả định, phần chưa kiểm> |
