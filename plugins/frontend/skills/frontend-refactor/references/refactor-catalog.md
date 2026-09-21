# Danh mục refactoring frontend (React/TS) — dấu hiệu, move, cách giữ hành vi

Tài liệu tham chiếu cho `frontend-refactor`. Dấu hiệu minh hoạ bằng React 18+ / TypeScript. Kiến trúc
nền + chiều phụ thuộc + quy tắc đặt tầng/slice: blueprint `architecture/react-<feature-based|fsd|micro-frontend>.template.md`.
Mỗi move dưới đây **giữ nguyên hành vi quan sát được từ phía người dùng**; đổi hành vi/UX là việc riêng
của `frontend-implement`.

Nguyên tắc chung cho MỌI move:
- **Tách/dời/đổi tên trước, đổi hành vi sau (bước riêng).** Không trộn dọn component với sửa logic/JSX.
- **Bước nhỏ, XANH sau mỗi bước** (`tsc` + test + lint + build). Đỏ → revert bước đó.
- **Đặt đúng tầng/slice.** Trước khi gom/dời, hỏi: chỗ đến có vi phạm chiều phụ thuộc không? (vd không
  kéo `fetch`/store vào presentational; Feature-Based — feature tự chứa, không cross-import ruột feature
  khác, liên kết qua nhóm dùng chung (phẳng gốc `src/`)/compose ở `app/routes`, qua public API `index.ts`;
  FSD — chỉ import xuống layer
  thấp hơn, qua public API `index.ts`, không cross-import cùng layer; Micro-FE — nội bộ remote theo FSD,
  cross-remote qua module `expose` + `packages/*`.)
- **Có công cụ thì dùng.** IDE refactoring (Rename/Extract) an toàn hơn sửa tay; `eslint-plugin-boundaries`/
  Steiger chứng minh boundary còn nguyên sau khi dời.

## 1. Component quá lớn
- **Dấu hiệu:** một component vài trăm dòng JSX; nhiều khối UI độc lập trong cùng `return`; nhiều
  `useState`/handler không liên quan nhau; khó đặt tên vì làm quá nhiều việc.
- **Move:** Extract Component theo từng khối UI có trách nhiệm rõ (props in / events out); tách phần lặp
  trong list thành component con (`Row`/`Item`). Giữ presentational thuần — không kéo fetch/store vào con.
- **Rủi ro / giữ hành vi:** truyền đủ props + callback thay vì đóng biến ẩn; giữ nguyên `key` trong list
  (đổi `key` làm React remount → mất state/đổi hành vi). Coi chừng thứ tự hook không được thay đổi khi
  cắt JSX. Chạy interaction test qua tương tác nhìn thấy được sau khi tách.

## 2. Logic lẫn trong JSX / trộn presentational với logic
- **Dấu hiệu:** `fetch()` trong `useEffect` giữa JSX; tính toán/định dạng phức tạp nội tuyến trong
  `return`; component vừa gọi API vừa giữ business rule vừa render.
- **Move:** Extract Custom Hook (`useXxx`) đưa data/state/side-effect ra khỏi UI; tách presentational
  (thuần props) khỏi container/hook (nối data). Đưa gọi backend về data layer/hook đúng blueprint.
- **Rủi ro / giữ hành vi:** giữ nguyên deps của `useEffect`/`useMemo` khi dời (đổi deps là đổi thời điểm
  chạy → đổi hành vi); giữ đúng thứ tự gọi hook (Rules of Hooks — không đặt hook trong nhánh/vòng lặp);
  giữ nguyên trạng thái loading/error hiển thị. Đây cũng là move giúp bám chiều phụ thuộc (UI là lá).

## 3. Prop drilling
- **Dấu hiệu:** một prop truyền qua 3+ tầng component trung gian chỉ để tới component sâu; component giữa
  nhận prop chỉ để chuyển tiếp; đổi một prop phải sửa cả chuỗi.
- **Move:** Context cho state dùng chung theo cụm (theme, user, locale) — provider ở nơi đúng tầng; hoặc
  **composition** (truyền `children`/slot component) để bỏ tầng trung gian mà không cần context. Chọn
  context khi nhiều nhánh cùng cần; chọn composition khi chỉ là "xuyên tầng".
- **Rủi ro / giữ hành vi:** context làm MỌI consumer re-render khi value đổi — tách context theo tần suất
  đổi, hoặc memo value provider, để không đổi đặc tính re-render ngoài ý muốn. Đừng nhét state cục bộ vào
  context toàn cục (mở rộng phạm vi state quá mức). Server-state nên ở React Query, không đẩy vào context.

## 4. State đặt sai chỗ (lift / colocate)
- **Dấu hiệu:** state ở component cha nhưng chỉ một nhánh con dùng (nên **colocate** xuống); hoặc hai
  anh em cần chia sẻ state nhưng mỗi bên giữ bản riêng rồi đồng bộ tay (nên **lift** lên cha chung); state
  suy diễn được từ props/state khác lại lưu riêng.
- **Move:** Lift State Up tới tổ tiên chung gần nhất; Colocate state xuống nơi dùng để giảm re-render;
  Derive-don't-store (tính khi render thay vì lưu vào state) khi giá trị suy diễn được.
- **Rủi ro / giữ hành vi:** khi lift/hạ phải giữ nguyên giá trị khởi tạo và thời điểm cập nhật; bỏ state
  suy diễn phải chắc công thức tính đúng mọi nhánh (kể cả lần render đầu). Coi chừng đổi identity của
  object/callback truyền xuống làm con memo re-render khác đi.

## 5. `useEffect` thừa hoặc sai
- **Dấu hiệu:** `useEffect` chỉ để tính giá trị suy diễn từ props/state rồi `setState`; effect đồng bộ
  hai state với nhau; effect để "chạy khi prop đổi" mà thực ra tính được lúc render; deps thiếu/thừa.
- **Move:** thay effect-tính-toán bằng tính trực tiếp lúc render (hoặc `useMemo` nếu nặng); nâng sự kiện
  người dùng lên event handler thay vì effect; chỉ giữ effect cho **đồng bộ với hệ thống ngoài** (DOM,
  network, subscription).
- **Rủi ro / giữ hành vi:** bỏ effect phải giữ đúng thời điểm side-effect quan sát được (số request phát
  ra, thứ tự). Cẩn thận cleanup của subscription/timer khi gỡ. Đừng đổi số lần gọi API khi dọn effect —
  đó là hành vi quan sát được.

## 6. Trùng lặp component / style
- **Dấu hiệu:** hai-ba component gần giống nhau (khác vài prop); className/inline-style lặp ở nhiều nơi;
  giá trị màu/spacing "trần" thay vì token của design-system.
- **Move:** gộp component gần giống bằng props/variant (hoặc composition) — về **nơi đúng tầng/slice**
  (UI dùng chung → `components/` phẳng gốc `src/` ở Feature-Based, `shared/ui` ở FSD); gom style trùng về
  class/util/variant dùng chung; thay
  literal màu/spacing bằng **token design-system** của project.
- **Rủi ro / giữ hành vi:** hai component "giống" nhưng khác tinh vi (trạng thái, a11y, edge case) — đọc
  kỹ trước khi gộp; gộp nhầm là đổi UI. Trùng lặp *tình cờ* (giống hiện tại nhưng lý do đổi khác nhau) thì
  ĐỪNG gộp — tạo phụ thuộc giả. Giữ nguyên class/DOM mà test hoặc style ngoài đang bám. `[giả định]` khi
  chưa chắc hai chỗ thật sự cùng ý nghĩa.

## 7. Re-render không cần / memoize
- **Dấu hiệu:** list lớn render lại toàn bộ khi một item đổi; child nặng re-render vì cha truyền
  object/callback mới mỗi lần; đo được (React DevTools Profiler) là nút cổ chai.
- **Move:** `React.memo` cho child thuần + ổn định props; `useCallback`/`useMemo` giữ identity handler/
  giá trị truyền xuống; ổn định `key` trong list. Áp **có bằng chứng đo được**, không rải khắp nơi.
- **Rủi ro / giữ hành vi:** memoize sai deps giữ giá trị cũ → đổi hành vi (stale closure); `React.memo`
  với props luôn đổi identity thì vô ích và thêm chi phí so sánh. **Không lạm dụng** — memoize thừa làm
  code khó đọc mà không cải thiện; chỉ áp nơi Profiler chỉ ra. Memoize là tối ưu, không đổi kết quả render.

## 8. Đổi tên / làm phẳng điều kiện trong JSX
- **Dấu hiệu:** tên component/prop/hook mơ hồ (`data`, `Comp`, `flag`); ternary lồng sâu hoặc chuỗi
  `&&` khó đọc trong `return`.
- **Move:** Rename theo `code-convention` (component PascalCase, hook/util camelCase); tách nhánh điều
  kiện thành biến/hàm-render có tên (`renderEmpty()`), guard sớm để làm phẳng.
- **Rủi ro / giữ hành vi:** rename phải cập nhật mọi nơi import (ưu tiên Rename của IDE); làm phẳng điều
  kiện phải giữ nguyên nhánh render cho mọi tổ hợp state (kể cả null/loading/empty). Đừng đổi nhánh mặc
  định lúc "dọn".

## Chống nợ mới khi refactor
- Không thêm trừu tượng "phòng xa" chưa có nhu cầu thật (YAGNI) — component/hook/context chỉ tách khi gỡ
  phức tạp hiện tại hoặc khớp điểm mở rộng đã chứng minh.
- Không đổi contract công khai khi refactor: props công khai của component tái dùng, ARIA/role, URL/route,
  request phát ra — đó là hành vi quan sát được.
- Dọn code cũ còn sót (barrel re-export, component thừa) của giai đoạn "cùng tồn tại" trước khi tuyên bố xong.
