# Mẫu báo cáo audit

Tài liệu tham chiếu cho `engineering-repo-audit`. Điền theo scope thật; mục nào không áp dụng ghi "Không có" kèm
lý do ngắn. Ngôn ngữ đo được: số đếm, `file:line`, nhãn proven/suspected.

## 1. Phạm vi và cách đọc
- **Scope:** <cả repo | cây con …>; số file đã theo dõi: <n>.
- **Điểm nóng đã đọc kỹ:** <n> file, chọn theo <churn · kích thước · thiếu test>; repo <có | không có> lịch sử git.
- **Lệnh đã chạy:** <danh sách ngắn các lệnh chỉ đọc>.

## 2. Tóm tắt
| Mức | Số finding |
|---|---|
| blocker | <n> |
| major | <n> |
| minor | <n> |

Một câu nhận định: rủi ro lớn nhất và nơi tập trung nó. Không dùng câu khẳng định tuyệt đối.

## 3. Bảng finding (xếp theo điểm giảm dần)
| # | Mức | `file:line` | Trục | Proven/Suspected | Vì sao đáng lo (kịch bản) | Định tuyến |
|---|---|---|---|---|---|---|
| 1 | blocker | `src/.../File.java:42` | bảo mật | proven | Khi <input>, <hậu quả> | `engineering-quality-gate` |
| … | | | | | | |

Finding cùng gốc gộp một dòng. Phần còn lại không liệt kê: "Còn <n> finding minor, cùng dạng <…>".

## 4. Ba việc nên làm trước
1. <việc> — vì <lý do>, định tuyến `<skill|workflow>`.
2. …
3. …

## 5. Phần chưa soát và residual risk
- **Chưa soát:** <thư mục, loại file, hành vi runtime, cấu hình triển khai, schema DB>.
- **Residual risk:** audit phản ánh thời điểm đọc với ngữ cảnh sẵn có; có thể còn lỗi ở đường chưa nghĩ tới hoặc
  chỉ lộ lúc chạy. Không kết luận "hết bug".

---

> **Chỉ đọc:** báo cáo để người quyết hướng xử lý, không kèm thay đổi code.
