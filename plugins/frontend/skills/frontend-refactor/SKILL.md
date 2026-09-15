---
name: frontend-refactor
description: "Recipe on-demand: REFACTOR mã nguồn FRONTEND (React/TypeScript) mà GIỮ NGUYÊN hành vi quan sát được — extract component/custom hook, nâng (lift) hoặc hạ (colocate) state đúng chỗ, bỏ prop drilling bằng context/composition, tách presentational khỏi logic, gom style/token trùng, memoize hợp lý (không lạm dụng), bỏ useEffect thừa, đổi tên, giảm độ phức tạp. TÔN TRỌNG boundary của kiến trúc đã chốt (Feature-Based/FSD/Micro-FE) — refactor TRONG ranh giới, không dời ranh giới. Đi qua cổng behavior-preserving: baseline build/test/lint XANH → thiếu test vùng đụng thì viết characterization render/interaction test trước → bước nhỏ, XANH sau mỗi bước → verify + con người duyệt diff. KHÁC với đổi KIỂU kiến trúc (Feature-Based↔FSD↔Micro-FE) — việc đó dùng frontend-migrate-architecture. Dùng skill NÀY khi người dùng muốn \"refactor frontend\", \"tái cấu trúc React\", \"dọn component\", \"tách component/hook\", \"bỏ prop drilling\", \"giảm trùng lặp UI\", \"đơn giản hoá React\", \"tách logic khỏi JSX\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn React."
order: 5
stageNumber: "05"
title: "Frontend Refactor — Tái cấu trúc code React giữ nguyên hành vi (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Refactor — Tái cấu trúc code React giữ nguyên hành vi (recipe on-demand)

Recipe hướng dẫn agent **refactor mã nguồn FRONTEND** (React + TypeScript) — cải thiện cấu trúc bên
trong (đọc-hiểu, tái dùng, giảm trùng lặp, giảm phức tạp, tách rành mạch UI/logic) **mà KHÔNG đổi hành
vi quan sát được từ phía người dùng**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc,
KHÔNG phải công cụ codegen hay lint dựng sẵn. KHÔNG nằm trong chuỗi bắt buộc `init → implement →
testing`; gọi khi cần trên project đã có mã nguồn.

Định nghĩa refactor ở skill này: các move quen thuộc của React/TS — Extract Component, Extract Custom
Hook, nâng (lift) / hạ (colocate) state đúng chỗ, bỏ prop drilling bằng Context/composition, tách
presentational khỏi logic (container/hook), gom style/token trùng, memoize hợp lý (`memo`/`useMemo`/
`useCallback`) khi có bằng chứng, bỏ `useEffect` thừa, đổi tên, làm phẳng điều kiện trong JSX — mỗi
move **giữ nguyên hành vi**. Chỉ nâng độ trừu tượng khi gỡ được **phức tạp thật**, không phải "cho đẹp".

**KHÁC biệt quan trọng — ranh giới với `frontend-migrate-architecture`:** skill này KHÔNG đổi *kiểu*
kiến trúc (Feature-Based ↔ FSD ↔ Micro-FE). Đổi kiểu kiến trúc là việc của `frontend-migrate-architecture`.
Ở đây mọi move phải **tôn trọng kiểu kiến trúc đã chốt** và chiều phụ thuộc của nó (presentational không biết
fetch/store; feature không cross-import ruột feature khác; import chỉ trỏ xuống; qua public API) — refactor
*trong* ranh giới, không dời ranh giới.

## Ranh giới an toàn (CLAUDE.md)
- **Giữ hành vi (bất biến cốt lõi).** Refactor KHÔNG đổi trải nghiệm quan sát được: cùng tương tác →
  cùng UI render + cùng side-effect (request phát ra, điều hướng, message). Cần đổi hành vi (sửa bug,
  đổi UX, đổi luồng) → đó là bước RIÊNG, tách khỏi refactor, gọi `frontend-implement`; KHÔNG trộn "dọn
  component" với "đổi logic" trong một bước.
- **Baseline phải XANH.** Không refactor trên nền gãy: build/test/lint hiện trạng đỏ → DỪNG, báo, đề
  xuất sửa/ổn định trước. Vùng đụng thiếu test → viết characterization render/interaction test khoá
  hành vi TRƯỚC (trỏ `frontend-testing`).
- **Tôn trọng boundary.** Bám kiến trúc đã chốt (`project-knowledge/architecture.md` + blueprint
  `architecture/react-<feature-based|fsd|micro-frontend>.template.md`) và chiều phụ thuộc của nó. KHÔNG đổi
  kiểu kiến trúc — đó là `frontend-migrate-architecture`.
- **Bám code-convention + design-system, không áp gu lạ.** Đặt tên/tổ chức theo `code-convention`;
  token/spacing/variant theo `design-system` của project; convention của project thắng sở thích cá nhân.
- **Không tự mở rộng phạm vi.** Chỉ refactor đúng vùng người dùng nêu; thấy vùng khác cần dọn → đề
  xuất, không tự lan.
- **Không push thẳng main.** Mỗi bước refactor = 1 commit; DỪNG cho người **duyệt diff** trước commit.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng move, báo cáo, commit message — viết
  **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo cáo bằng thứ đếm được (số move, `file:line`, kết quả build/test THẬT).
  KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / không còn nợ kỹ thuật". LUÔN nêu **residual risk**;
  characterization test chỉ khoá hành vi *quan sát được qua tương tác đã viết*, có thể sót đường đi hoặc
  trạng thái chưa nghĩ tới. Dùng `[giả định]` khi suy đoán ý định code cũ mà không xác minh được.

## Quy trình (trung tính stack React/TS) — cổng behavior-preserving

### 0. Nạp context — BẮT BUỘC trước khi động code
- **Chốt scope refactor:** component/hook/module/thư mục nào? Đọc code THẬT trong scope, không đoán.
- Đọc `project-knowledge/` (`architecture.md` = **kiến trúc đã chốt** Feature-Based/FSD/Micro-FE, `source-structure.md`,
  `code-convention.md`, `design-system.md`, `tech-stack.yml`) + blueprint
  `architecture/react-<feature-based|fsd|micro-frontend>.template.md` để biết kiểu kiến trúc, chiều phụ thuộc,
  quy ước đặt tên và vocabulary tầng/slice.
- **Dò stack + lệnh THẬT** từ project (`package.json`): React/TS, bundler (Vite/…), quản state (Context/
  Redux/Zustand), data layer (fetch/axios/React Query), test runner (Vitest/Jest + Testing Library), có
  `eslint-plugin-boundaries`/Steiger không; lệnh build/test/lint (vd `tsc`, `npm run build`, `vitest run`,
  `eslint`).
- Thiếu scope rõ hoặc thiếu `project-knowledge` → BÁO (fail-loud), hỏi người dùng, KHÔNG tự bịa.

### 1. Baseline XANH — CỔNG G1
Chạy build + test + lint hiện trạng (vd `tsc`, `npm run build`, `vitest run`, `eslint`), ghi lệnh +
kết quả THẬT — đây là mốc so hồi quy.
- Baseline **đỏ** → DỪNG; không refactor trên nền gãy (báo + đề xuất ổn định trước).
- Vùng sẽ đụng **thiếu test** → sinh **characterization render/interaction test khoá hành vi hiện tại
  TRƯỚC khi động code** (render màn hình/component chính + tương tác nhìn thấy được, query theo
  role/accessible); xác nhận test mới XANH **trên code CŨ**. Trỏ `frontend-testing` để viết test đúng
  chuẩn dự án. Chi tiết cổng: [references/refactor-workflow.md](references/refactor-workflow.md).

### 2. Nhận diện target refactor
Đọc soát vùng trong scope, liệt kê "code smell" theo danh mục và chọn move tương ứng — dấu hiệu, rủi
ro, cách giữ hành vi ở [references/refactor-catalog.md](references/refactor-catalog.md): component quá
lớn (Extract Component), logic lẫn trong JSX (Extract Custom Hook / tách presentational–container),
prop drilling nhiều tầng (Context / composition), state đặt sai chỗ (lift / colocate), trùng lặp
component-style (gom về nơi đúng tầng + token design-system), `useEffect` thừa/sai, re-render không cần
(memoize có bằng chứng)… Ưu tiên move gỡ được nhiều phức tạp/trùng lặp nhất với ít rủi ro nhất.

### 3. Áp từng bước nhỏ — GIỮ hành vi, XANH sau mỗi bước — CỔNG G2
- Mỗi bước là **một** loại thay đổi, phạm vi nhỏ, dễ đọc diff.
- **Dời/đổi tên/tách trước; đổi hành vi là bước TÁCH RIÊNG.** Trong một bước refactor KHÔNG vừa tách
  component vừa sửa logic/JSX — nếu phát hiện bug lúc dọn, GHI LẠI và xử ở bước riêng (route
  `frontend-implement`).
- Sau **mỗi** bước: `tsc` ✓ + test (gồm characterization) ✓ + build ✓ + lint (gồm boundary nếu có) ✓.
  Đỏ → sửa hoặc revert **bước đó**, KHÔNG đi tiếp. 1 bước = 1 commit; DỪNG cho người duyệt diff.

### 4. Verify + con người duyệt — CỔNG G3
- Chạy lại FULL `tsc` + test + lint + build, SO với baseline bước 1 (số pass/fail, lệnh THẬT). Có fail
  → DỪNG, phân tích, sửa; KHÔNG tuyên bố hoàn tất khi suite chưa xanh.
- Có `eslint-plugin-boundaries`/Steiger → chạy để chứng minh boundary vẫn nguyên (refactor không rò
  tầng, không cross-import cùng layer, không import sâu bỏ qua public API).
- So sánh với characterization test: hành vi quan sát được KHÔNG đổi.
- Con người **duyệt diff** trước khi commit/merge. Nêu residual risk + phần chưa soát.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| G1 | Baseline build/test/lint XANH; vùng thiếu test có characterization render/interaction khoá hành vi | 1 | DỪNG, không refactor trên nền gãy / chưa có lưới an toàn |
| G2 | Mỗi bước giữ hành vi + tsc/test/lint/build XANH; tách/dời trước, đổi hành vi tách riêng | 3 | Sửa/revert bước đó, không đi tiếp |
| G3 | Hồi quy so baseline + boundary check (eslint-plugin-boundaries/Steiger) XANH; con người duyệt diff | 4 | Không tuyên bố hoàn tất |
| G4 | 1 bước = 1 commit, DỪNG duyệt diff, không push main; giữ boundary/kiểu kiến trúc | Xuyên suốt | — |

## Sau khi xong
Tóm tắt: các move đã áp (+ `file:line`), kết quả `tsc`/test/lint/build so baseline (số THẬT), phần
**chưa soát + residual risk**. Refactor giữ hành vi — nếu cần đổi trải nghiệm/nghiệp vụ, route
`frontend-implement`; cần đổi *kiểu* kiến trúc, route `frontend-migrate-architecture`; cần thêm/sửa
test, route `frontend-testing`. Gặp ràng buộc mâu thuẫn (stack không phải React, hoặc không lập được
baseline xanh), DỪNG và BÁO thay vì tự đi chệch.
