# Nguyên tắc riêng — Frontend

> Phần này BỔ SUNG cho `core/principles/` (4 nguyên tắc cốt lõi, 3 tầng tài liệu,
> ranh giới an toàn nền, nguồn sự thật nền). Chỉ mô tả phần ĐẶC THÙ frontend.

## Phân tầng mã nguồn frontend
Mỗi project chọn MỘT kiểu kiến trúc UI khi `frontend-init`: **Feature-Based** (nhóm theo domain,
ranh giới mềm — mặc định, app nhỏ/vừa một team), **FSD** (Feature-Sliced Design — layer/slice/segment
+ public API, app lớn/nhiều domain), hoặc **Micro-Frontend** (host + remotes qua Module Federation,
đa team; mỗi remote nội bộ = FSD). Kiểu đã chọn + Dependency Rule/ranh giới tầng-slice của nó là
**NGUỒN SỰ THẬT layout**, mô tả ở `project-knowledge/architecture.md` + `source-structure.md` (chọn
theo `architecture/ARD.md`), mọi skill downstream đọc từ đó, KHÔNG hardcode tên tầng. Bất biến chung
mọi kiểu: view/UI thuần KHÔNG tự gọi API trực tiếp mà qua state/data layer; UI primitives/code chung
ở `src/shared/`. Cây component, design tokens, ui-contract, state-model đều externalize ra file.

## Khởi tạo (`frontend-init`)
`frontend-init` là scaffold **CHỈ TÀI LIỆU** (project-knowledge, ADR, contracts, layout thư mục mô
tả) — KHÔNG sinh code skeleton, KHÔNG viết code thực thi. Module nghiệp vụ/skeleton chạy được do các
skill khác (`frontend-implement`...) sinh khi có yêu cầu cụ thể.

## Các mối quan tâm khi implement (không phải chuỗi skill bắt buộc)
Khi hiện thực một UI/feature đầy đủ, `frontend-implement` xử lý tuần tự trong CHÍNH skill đó (không
phải các skill riêng, không bắt buộc theo pipeline): chốt **UI/Component Contract** (props/events/slots
+ đầy đủ trạng thái UI + data contract + UI mock/fixtures) → **State Model** (store/query keys/selectors
+ data-fetching mapping) → **Implement đầy đủ** (code component theo từng trạng thái + nối API thật
thay mock).

Contract của frontend là **HỢP ĐỒNG GIAO DIỆN component**: chốt trước public API (props vào,
events/callbacks ra, slots/children), đầy đủ trạng thái UI (loading/empty/error/success/disabled)
và data contract — hình dạng dữ liệu nhận từ API ánh xạ TRỰC TIẾP từ response schema của backend
contract — rồi mới viết logic. UI mock/fixtures khớp data contract để render component độc lập.

## Ranh giới an toàn — bổ sung frontend
- Không tự đổi shape của props/events/slots đã chốt trong `ui-contract.md`; cần đổi phải quay lại contract.
- Không hardcode API key/base URL vào component.
- Không tự chỉnh design tokens / theme toàn cục khi chưa được duyệt (ảnh hưởng diện rộng).
- Không commit code fail type-check.

## Nguồn sự thật — bổ sung frontend
`ui-contract.md` (component API + states + data contract) > state-model > implement;
backend `contract.md` (response schema) > data contract của frontend (lệch thì DỪNG, quay lại analysis);
`ui-contract.md` > fixtures/mock.
