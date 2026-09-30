# Mẫu kết quả review — có evidence, đo được

Tài liệu tham chiếu cho `backend-code-review`. Trình bày kết quả theo mẫu dưới; ngôn ngữ **đo được**
(số finding đếm được, `file:line` cụ thể, nhãn proven/suspected), KHÔNG tuyên bố "đã review hết / hết bug".
Điền theo scope thật; mục nào không áp dụng ghi "Không có" + lý do ngắn.

---

## 1. Phạm vi + ngữ cảnh
- **Scope:** <diff / PR #… / module …> — nguồn diff (`git diff <base>...<head>` / `--staged` / thư mục).
- **Stack + kiến trúc:** <Java-Spring / Python> · <onion-ddd / hexagonal-ddd / hexagonal-clean-cqrs / layered>
  (theo `project-knowledge/architecture.md`).
- **Ép ranh giới có sẵn:** <ArchUnit / import-linter / không> — luật nào máy đã bao, luật nào soát tay.

## 2. Tóm tắt theo severity
| Severity | Số finding |
|---|---|
| blocker | <n> |
| major | <n> |
| minor | <n> |
| nit | <n> |

Một dòng nhận định tổng: mức sẵn sàng merge theo góc nhìn review (KHÔNG phải bảo chứng đúng), điểm rủi ro nhất.

## 3. Bảng finding
Sắp theo severity giảm dần. Mỗi finding một dòng, phải có `file:line`.

| # | Severity | file:line | Trục | Proven/Suspected | Rationale (kịch bản input→hành vi sai nếu là correctness) | Đề xuất fix |
|---|---|---|---|---|---|---|
| 1 | blocker | `path/to/File.java:42` | correctness | proven | Khi <input>, <hành vi sai/hậu quả> | <hướng sửa gọn> |
| 2 | major | `path/to/svc.py:88` | thiết-kế | suspected | <vì sao nghi>; chưa tái hiện được | <hướng sửa> |
| 3 | major | `path/to/OrderQuery.java:57` | performance | suspected | Vòng lặp gọi `findByOrderId` cho từng đơn; nghi N+1, chưa đo | Tải theo lô hoặc `JOIN FETCH`; đo bằng log SQL trước khi sửa |
| … | | | | | | |

Trục hợp lệ: `correctness` · `thiết-kế` (Dependency Rule/kiến trúc) · `đơn-giản-hoá` · `readability/naming` ·
`performance` · `test-coverage`.

## 4. Cần người quyết
Liệt kê finding vượt tầm review tự xử — đánh đổi thiết kế, thay đổi rủi ro cao, nghi ngờ chưa tái hiện, hoặc
việc nên route:
- <mô tả> → route `engineering-quality-gate` (bảo mật/tool scan) / `backend-refactor` (tái cấu trúc) /
  `backend-migrate-architecture` (đổi kiến trúc) / `backend-testing` (bổ sung test).

## 5. Phần chưa soát + residual risk
- **Chưa soát:** <đường đi/nhánh/file ngoài scope, hành vi runtime không thấy trong diff tĩnh, cấu hình/migration
  chưa đọc>.
- **Residual risk:** review phản ánh thời điểm đọc với ngữ cảnh sẵn có; có thể còn lỗi ở đường đi chưa nghĩ tới
  hoặc chỉ lộ lúc chạy. KHÔNG kết luận "hết bug".

---

> **READ-ONLY:** đây là nhận xét để **người quyết** hướng xử lý, mặc định KHÔNG kèm thay đổi code. Chỉ khi
> người dùng yêu cầu rõ mới áp fix cho finding proven/rõ ràng/đúng scope, và vẫn DỪNG cho người duyệt diff
> trước commit.
