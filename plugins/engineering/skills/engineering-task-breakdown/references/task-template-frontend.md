# Frontend cần gì — template task FE-UI / FE-INT

Task `FE-UI` dựng màn hình/component từ thiết kế (presentational, theo `frontend-implement`); task `FE-INT` nối UI
đó với API thật theo contract (theo `frontend-data-integration`). Hai loại dùng chung 9 mục; mục ngoài phạm vi loại
task → `N/A — <lý do>` (vd F6 trong `FE-UI`: `N/A — nối API ở UC01-FE-02`).

## Template chép được

````markdown
#### Frontend

- **F1. Route / màn hình:** <path route> — <tên màn hình>
- **F2. Nguồn thiết kế:** <link Figma frame | file HTML | ảnh>
- **F3. Component:** tái dùng <component từ design-system / component lib>; mới <component>
- **F4. Trạng thái:** loading <...>; empty <...>; error <...>; success <...>
- **F5. Form & validation:**

  | Field | Rule (đồng bộ B4) | Thông báo lỗi |
  |---|---|---|
  | <field> | <rule> | <thông báo> |

- **F6. API dùng:** operationId `<id>`; 401 → <xử lý>; 403 → <xử lý>; 4xx → <xử lý>; 5xx → <xử lý>
- **F7. Phân quyền hiển thị:** <role nào thấy / ẩn / disable phần nào>
- **F8. i18n / a11y / responsive:** i18n <key>; a11y <label, role, bàn phím, focus>; breakpoint <...>
- **F9. Test bắt buộc:** render + interaction cho <case>; mock API bằng msw cho <case> (chỉ `FE-INT`; `FE-UI` → `N/A — nối API ở <ID FE-INT>`)
````

## Hướng dẫn từng mục

### F1. Route / màn hình

Path route + tên màn hình; component con thì ghi màn hình cha chứa nó.

### F2. Nguồn thiết kế

Link Figma (frame cụ thể), file HTML, hoặc ảnh. Không có thiết kế → **[giả định]** dựng theo `design-system.md` +
Câu hỏi mở.

### F3. Component

Ưu tiên tái dùng từ design-system / component lib của project (đọc `component-map.md` nếu có); chỉ liệt kê
component mới khi lib không có.

### F4. Trạng thái

Đủ 4 trạng thái loading / empty / error / success: hiển thị gì, thông điệp gì. Trạng thái không xảy ra →
`N/A — <lý do>`.

### F5. Form & validation

Field + rule + thông báo lỗi, **đồng bộ với B4** của task `BE` tương ứng (cùng rule, cùng ngưỡng). Màn hình không
có form → `N/A — không có form`.

### F6. API dùng

`operationId` trong contract; map lỗi: 401 → về đăng nhập; 403 → thông báo không đủ quyền; 4xx → thông báo theo
bảng B7; 5xx → thông báo chung + cho thử lại. Trong `FE-UI` thường là `N/A — nối API ở <ID task FE-INT>`.

### F7. Phân quyền hiển thị

Role nào thấy / ẩn / disable phần nào. Đây là UX — kiểm quyền thật nằm ở B5.

### F8. i18n / a11y / responsive

Chuỗi cần dịch (key i18n nếu project có); a11y: label, role, điều hướng bàn phím, focus; breakpoint hỗ trợ theo
`design-system.md`.

### F9. Test bắt buộc

Render + interaction bằng Testing Library cho các trạng thái F4 và form F5; `FE-INT` mock API bằng msw cho thành
công + từng nhóm lỗi F6. Gắn từng case với AC.
