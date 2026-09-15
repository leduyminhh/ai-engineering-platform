# Mẫu kết quả review — có evidence, đo được

Tài liệu tham chiếu cho `frontend-code-review`. Trình bày kết quả theo mẫu dưới; ngôn ngữ **đo được**
(số finding đếm được, `file:line` cụ thể, nhãn proven/suspected), KHÔNG tuyên bố "đã review hết / hết bug".
Điền theo scope thật; mục nào không áp dụng ghi "Không có" + lý do ngắn.

---

## 1. Phạm vi + ngữ cảnh
- **Scope:** <diff / PR #… / module …> — nguồn diff (`git diff <base>...<head>` / `--staged` / thư mục).
- **Stack + kiến trúc:** React <ver> · TypeScript · <TanStack Query / …> · <component-lib> · <feature-based / fsd / micro-frontend>
  (theo `project-knowledge/architecture.md`).
- **Ép ranh giới có sẵn:** <eslint-plugin-boundaries / Steiger / không> — luật nào lint đã bao, luật nào soát tay.

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

| # | Severity | file:line | Trục | Proven/Suspected | Rationale (kịch bản tương tác→hành vi sai nếu là correctness/a11y) | Đề xuất fix |
|---|---|---|---|---|---|---|
| 1 | blocker | `src/components/invoices/InvoiceList.tsx:42` | correctness | proven | Khi <thao tác/props/state>, <hành vi sai/hậu quả> | <hướng sửa gọn> |
| 2 | major | `src/containers/InvoiceListContainer.tsx:88` | thiết-kế | suspected | <vì sao nghi>; chưa tái hiện được | <hướng sửa> |
| … | | | | | | |

Trục hợp lệ: `correctness` · `thiết-kế` (boundary Feature-Based/FSD/Micro-FE) · `đơn-giản-hoá` · `a11y` ·
`readability/naming` · `test-coverage`.

## 4. Cần người quyết
Liệt kê finding vượt tầm review tự xử — đánh đổi thiết kế, thay đổi rủi ro cao, nghi ngờ chưa tái hiện, hoặc
việc nên route:
- <mô tả> → route `engineering-quality-gate` (bảo mật/tool scan) / `frontend-refactor` (tái cấu trúc) /
  `frontend-migrate-architecture` (đổi kiến trúc Feature-Based↔FSD↔Micro-FE) / `frontend-testing` (bổ sung test).

## 5. Phần chưa soát + residual risk
- **Chưa soát:** <đường render/nhánh/file ngoài scope, hành vi runtime không thấy trong diff tĩnh, tương phản
  màu/đọc màn hình cần kiểm thực tế, style/asset chưa đọc>.
- **Residual risk:** review phản ánh thời điểm đọc với ngữ cảnh sẵn có; có thể còn lỗi ở đường render chưa
  nghĩ tới hoặc chỉ lộ lúc chạy/tương tác thật. KHÔNG kết luận "hết bug".

---

> **READ-ONLY:** đây là nhận xét để **người quyết** hướng xử lý, mặc định KHÔNG kèm thay đổi code. Chỉ khi
> người dùng yêu cầu rõ mới áp fix cho finding proven/rõ ràng/đúng scope, và vẫn DỪNG cho người duyệt diff
> trước commit.
