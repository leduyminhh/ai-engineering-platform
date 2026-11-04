# Prompt mẫu cho subagent backfill (một năng lực)

Nạp ở bước 3. Session chính điền các chỗ `<…>` rồi giao cho một subagent `general-purpose` (model `sonnet`).
Subagent không thấy skill này: mọi quy tắc cần thiết phải nằm trong prompt. Mỗi năng lực một prompt, một subagent.

## Mẫu prompt

```text
Bạn dựng spec sống cho một năng lực của project <tên project>. Chỉ đọc code; chỉ ghi một file.

## Đầu vào
- Năng lực: `<tên-kebab>`
- Mục đích: <một câu>
- Gồm: <danh sách>
- Không gồm: <danh sách, kèm năng lực khác đứng ở đâu>
- Thư mục nguồn trong code: <đường dẫn>
- Request đã merge liên quan: <đường dẫn docs/requests/<ngày>-<slug>/design.md>, hoặc "không có"
- Request KHÔNG có token `merged`: không đọc, không dùng làm nguồn.
- Mẫu spec: <đường dẫn spec.template.md, hoặc đoạn mẫu trong prompt này>

## Được phép
- Đọc: Read, Grep, Glob, và `git log` / `git ls-files` (chỉ đọc).
- Ghi đúng một file: `docs/specs/<tên-kebab>/spec.md`. Tạo thư mục nếu chưa có.

## Không được
- Ghi, sửa hay xoá file nào khác; sửa code; chạy test, build; commit, push, merge.
- Đọc `.env`, key, credential. Thấy secret trong code: ghi loại và `file:line`, không in giá trị.
- Hỏi người dùng. Điều mơ hồ đưa vào `## Câu hỏi mở`.
- Thêm R cho hành vi không có bằng chứng; bịa tên test; viết "đảm bảo", "loại bỏ hoàn toàn".

## Quy tắc mỗi R
- Dạng: `- **<tên-kebab>/R<n>** — <câu hành vi đo được>. Nguồn: <một loại dưới đây>`
- ID tăng dần từ R1, không trùng.
- Đúng một loại nguồn:
  1. Request đã `merged` mô tả hành vi và code khớp: `[<slug>](../../requests/<ngày>-<slug>/design.md)`
  2. Chỉ có code và test: `` `file:line` `` + tên test trong ngoặc
  3. Chỉ suy từ code: `` `file:line` `` + `[Unverified]`
  4. Design `merged` nhưng code khác: `` `file:line` `` (code) + `lệch: [<slug>](../../requests/<ngày>-<slug>/design.md)`
- Trích dẫn `` `file:line` `` viết liền, không dấu cách, không range, không `dòng:cột`.

## Cấu trúc file cần ghi
# Spec: <tên-kebab>

Cập nhật: <yyyy-mm-dd>

## Mục đích
<một đến hai câu>

## Phạm vi
- Gồm: …
- Không gồm: …

## Yêu cầu
<các dòng R theo quy tắc trên>

## Câu hỏi mở
<gạch đầu dòng, hoặc để trống mục này nếu không có>

## Lịch sử
| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| <yyyy-mm-dd> | backfill <yyyy-mm-dd> | <tên-kebab>/R<n> | thêm |

## Báo cáo
Trả khối `agent_result` (định dạng dưới), không in thêm báo cáo dài.

agent_result:
  agent: general-purpose
  status: completed | blocked | failed
  summary: "<1–3 câu: số R, số loại 1–4, số câu hỏi mở>"
  changes: { added: ["docs/specs/<tên-kebab>/spec.md"], modified: [], deleted: [] }
  validation: ["<tự kiểm: số R, mỗi R có đúng một loại nguồn; file:line đã đọc tồn tại>"]
  findings: []
  questions: []
  remaining_risks: ["<phần code chưa đọc, R dựa trên [Unverified]>"]
```

## Chế độ chạy lại (bước 7)

Dùng khi đã có `docs/specs/<tên-kebab>/spec.md`. Thay phần "Được phép" và "Cấu trúc file" bằng:

```text
## Chế độ chạy lại: chỉ đọc
- Đọc `docs/specs/<tên-kebab>/spec.md` hiện có và code cùng nguồn đã nêu trong các R.
- Không ghi file nào; không thêm R; không sửa câu chữ R.
- Trả `agent_result` với `findings`, mỗi finding là một mục của drift-report.md (nhóm 1 hoặc nhóm 2), kèm `location` là `file:line` hoặc link request.
```

## Kiểm đầu ra ở session chính

- `changes` chỉ có `docs/specs/<tên-kebab>/spec.md`. Khác thì đầu ra hỏng: giao lại kèm đúng luật vi phạm (tối đa 2 lần).
- `status: blocked` với `questions[]`: session chính không hỏi người dùng thay subagent; xem câu hỏi có thể trả lời từ docs và request hay không, không thì đưa thành mục Câu hỏi mở và ghi lý do vào báo cáo cuối.
- `status: completed` nhưng `remaining_risks` không rỗng: ghi vào báo cáo cuối của skill, không coi là lỗi.
- Sau khi mọi subagent xong, chạy `check-citations.mjs` trên `docs/specs` (bước 5 của skill), không tin vào `validation` tự khai của con.
