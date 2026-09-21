# Interaction tier — hợp đồng "presentational + tương tác cơ bản"

Skill dừng ở mức **presentational + tương tác cơ bản**: component trung thực với thiết kế, có props typed
và tương tác nội bộ nhìn thấy được — nhưng **chưa nối dữ liệu/API/route**. Nhà phát triển cắm data ở bước sau.

## LÀM (trong phạm vi)

- **Props typed:** khai `interface`/`type` cho props; nhận **dữ liệu qua props** + **callback** cho sự kiện
  (`onSelect`, `onSubmit`, `onChange`). Không tự lấy dữ liệu bên trong.
- **State nội bộ chỉ cho UI:** tương tác nhìn thấy trong thiết kế — mở/đóng (`useDisclosure`/`useState`),
  chuyển tab, controlled input, hover/focus/selected. Dùng `useState`/`useReducer` cục bộ.
- **Các state hiển thị:** dựng sẵn variant cho `hover/active/disabled/selected` và, khi thiết kế có,
  `loading`/`empty`/`error` — nhận qua props (`isLoading`, `items=[]`) chứ không tự fetch.
- **Form:** ràng buộc controlled + validate phía UI cơ bản (required/format) hoặc `react-hook-form` nếu
  project dùng; submit gọi `props.onSubmit(values)` — KHÔNG tự gọi API.
- **A11y:** role/aria, label liên kết, điều hướng bàn phím, focus nhìn thấy.

## KHÔNG LÀM (ngoài phạm vi — để bước hiện thực sau)

- **Fetch/mutation/API client:** không `fetch`/`axios`/React Query trong component; chỗ cần dữ liệu để
  trống bằng props + `// TODO(data): truyền từ container/hook`.
- **Routing/điều hướng:** không `useNavigate`/`<Link>` logic; phát `onX` callback để nơi gọi quyết định.
- **Global store/business rule:** không đọc/ghi store toàn cục, không nhét quy tắc nghiệp vụ vào
  presentational (thuộc feature/container/hook ở bước sau).
- **Side-effect thật:** không localStorage/timer/analytics trừ khi thuần UI và thiết kế yêu cầu rõ.

## Chỗ trống dữ liệu

- Mọi nội dung động khai thành **props** với kiểu rõ; đặt giá trị mẫu chỉ trong story/preview, không
  hard-code vào component.
- Đánh dấu điểm nối tương lai bằng `// TODO(data): ...` để bước hiện thực (container/feature) biết cắm vào đâu.

## Đặt đúng tầng theo kiến trúc

- **Feature-Based:** UI thuần ở `features/<domain>/components` (chỉ props/callback); logic/state ở `hooks/`,
  gọi API ở `api/`, type/view-model ở `types/` (bước sau). Không tự fetch/store trong presentational; không
  cross-import ruột feature khác — mở qua public API `index.ts`.
- **FSD:** UI thuần ở segment `ui/` của entity/feature; logic/state ở `model/`, gọi API ở `api/` (bước sau).
  Import chỉ xuống, không cross-import cùng layer, qua public API `index.ts`.
- **Micro-FE:** nội bộ mỗi remote theo FSD (đặt file như FSD ở trên); UI-kit dùng chung ở `packages/ui-kit`.
  Không import ruột remote khác — cross-remote qua module `expose` + `packages/*`.

Blueprint kiến trúc (`architecture/react-<feature-based|fsd|micro-frontend>.template.md`) là chuẩn cho vị trí file + ranh giới import.
