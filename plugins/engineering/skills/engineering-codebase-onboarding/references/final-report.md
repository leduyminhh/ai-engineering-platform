# Mẫu báo cáo cuối

Session chính điền mẫu này sau khi đã kiểm cơ học và trước khi trình cổng 2. Mọi số lấy từ kết quả lệnh hoặc agent_result, không ước lượng. Số không có thì ghi `[Unverified]`.

```markdown
# Báo cáo onboarding: <tên project> (onboarding-<slug>)

- Ngày: <yyyy-mm-dd>; gốc: `<đường dẫn>`; nhánh: `<tên nhánh>`
- Cổng 1: <duyệt | duyệt có sửa: <nêu>>; cổng 2: <duyệt | chưa duyệt>

## 1. Module đã đọc và chưa đọc
| Module | Đường dẫn | Nhóm subagent | File đã đọc / tổng | Chưa đọc (lý do) | [Unverified] |
|---|---|---|---|---|---|
| `<id>` | `<path>` | <nhóm> | <n> / <m> | <danh sách, lý do> | <n> |

## 2. Kiểm cơ học
- `check-citations.mjs --root <gốc>`: exit <n>; trích dẫn hỏng: <n>; file: <danh sách>. Nếu không chạy được: `not_run`, lý do.
- `scan-secrets.mjs` trên file đã ghi: exit <n>; khớp: <n>.
- `git status --porcelain` so với nền: <n> đường dẫn ngoài danh sách đã duyệt: <danh sách hoặc "không có">.

## 3. Phát hiện bảo mật
- Số phát hiện: <n> (proven: <a>; suspected: <b>).
- Nơi để file: `.aip/runs/onboarding-<slug>/security-findings.md`. File này không vào commit. File chỉ có loại, `file:line` và nhãn, không có giá trị.

## 4. Thư mục chưa thuộc module nào
- `unclaimed`: <danh sách hoặc "không có">; file ở gốc (`rootFiles`): <n>; quyết định: <để ngoài | đã kiểm tay>.

## 5. Khẳng định chưa xác minh
- `[Unverified]`: <n> trên <m> khẳng định về module; theo module: <danh sách>.
- Reviewer: đúng <a>, sai <b>, không xác minh được <c>. Sai đã sửa: <n>; còn lại: <n>.

## 6. Ngân sách thực tế (hiệu chỉnh)
| Subagent | Nhóm | Lần gọi công cụ | Hết ngân sách (60) | Vượt trần file/dòng |
|---|---|---|---|---|
| <tên> | <nhóm> | <n> | <có/không> | <có/không> |

- Trần giả định [giả định]: 150 file nguồn, 15.000 dòng, 60 lần gọi, 6 subagent song song.
- Hiệu chỉnh đề xuất: <số liệu từ bảng trên hoặc `[Unverified]`>.
- Model: <sonnet | kế thừa model session, lý do: Agent trả 404>.

## 7. Chưa chạy (not_run)
- <bước và lý do; không có thì ghi "không có">.

## 8. Rủi ro còn lại
- Chưa kiểm được log phiên: nếu một lệnh đã in giá trị cấu hình, giá trị đó có thể đã nằm trong log phiên và skill không kiểm được log này.
- <rủi ro khác từ `remaining_risks`, mỗi dòng một mục>.
```
