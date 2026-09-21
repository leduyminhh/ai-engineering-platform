---
name: frontend-code-review
description: "Recipe on-demand: REVIEW một diff/PR/module FRONTEND (React/TypeScript) theo các TRỤC — correctness (state/effect sai, dependency array thiếu/thừa, race giữa request, key list không ổn định, memo/useCallback sai, xử lý loading/error/empty), thiết kế & bám boundary (Feature-Based: feature tự chứa components/hooks/api/types, không cross-import ruột feature, qua public API; FSD: import chỉ trỏ xuống, không cross-import cùng layer, đi qua public API; server-state ở React Query không copy vào useState), đơn giản hoá & tái dùng (trùng lặp component/logic, over-engineering, prop drilling), a11y (role/label/keyboard/focus/contrast), readability & naming theo code-convention, và test coverage. Phân loại severity (blocker/major/minor/nit) + evidence file:line + đề xuất fix; READ-ONLY mặc định (không tự sửa trừ khi được yêu cầu). Defer security/tool scan sang engineering-quality-gate, tái cấu trúc sang frontend-refactor. Dùng skill NÀY khi người dùng muốn \"review code frontend\", \"review PR React\", \"review component\", \"đánh giá code FE\", \"review diff frontend\", \"review UI code\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 4
stageNumber: "04"
title: "Frontend Code Review — Review diff/PR frontend React/TS theo trục, có evidence (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
sharedAssets: templates/architecture
next: null
---

# Frontend Code Review — Review diff/PR/module frontend theo trục (recipe on-demand)

Recipe hướng dẫn agent **review một diff / PR / module FRONTEND** (React + TypeScript) theo các **TRỤC
review** cố định, phân loại **severity**, kèm **evidence `file:line`** và **đề xuất fix**. Đây là
**docs-only recipe** — hướng dẫn cách agent đọc soát và báo cáo, KHÔNG phải công cụ lint/scan dựng sẵn,
cũng KHÔNG phải công cụ codegen. KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần.

**READ-ONLY mặc định:** skill này *đọc và nhận xét*, KHÔNG tự sửa code trừ khi người dùng yêu cầu rõ.
Con người giữ chốt: đọc review rồi **tự quyết** sửa gì. Với thay đổi lớn (tái cấu trúc, siết bảo mật),
skill này **route** sang skill chuyên trách thay vì tự làm — xem bước 4.

Nguyên tắc trục (đối xứng với `frontend-implement`/`frontend-testing`): kiến trúc UI tách **presentational**
khỏi **data/state**, nên phần lớn lỗi thiết kế lộ ra ở **ranh giới tầng** (import ngược chiều, fetch trong
component thuần, server-state copy vào `useState`) — review bám blueprint kiến trúc đã chọn
(`architecture/react-<feature-based|fsd|micro-frontend>.template.md`) + `code-convention`/`design-system`
của project, KHÔNG áp gu cá nhân.

## Ranh giới an toàn (CLAUDE.md)
- **READ-ONLY mặc định.** Không sửa code, không commit, không đổi cấu hình. Chỉ khi người dùng yêu cầu
  rõ "sửa luôn" mới áp fix — và vẫn DỪNG cho người **duyệt diff** trước khi commit (1 việc = 1 commit).
- **Scope-bound.** Chỉ review **đúng phạm vi người dùng nêu** (diff / PR / module / thư mục). KHÔNG lan
  sang module anh em hay cả repo; code ngoài scope chỉ nhắc khi ảnh hưởng trực tiếp tới phần đang review,
  và nêu rõ là ngoài scope.
- **Bám nguồn sự thật, không áp gu lạ:** đối chiếu **kiến trúc đã chốt** (ADR / `project-knowledge/architecture.md`
  + blueprint `architecture/react-<feature-based|fsd|micro-frontend>.template.md`), `code-convention` và `design-system` của
  project. Convention/design-system của project thắng sở thích cá nhân; đó là việc của tài liệu tương ứng,
  review chỉ **đối chiếu**.
- **Phân biệt lỗi CHẮC vs NGHI NGỜ:** finding nói được kịch bản tương tác→hành vi sai (thao tác/props/state
  → UI/hậu quả) là **proven**; finding "có mùi / có thể" là **suspected** — phải ghi rõ nhãn, KHÔNG thổi
  suspected thành blocker.
- **Không tự ý mở rộng thành refactor.** Thấy cần tái cấu trúc → **đề xuất + route** sang `frontend-refactor`
  (skill sắp có), không tự viết lại trong lượt review.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng finding, tóm tắt, đề xuất fix — viết
  **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo cáo bằng thứ đếm được (số finding theo severity, `file:line` cụ thể, kịch bản
  tái hiện). KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / review hết / không còn bug"; LUÔN nêu **phần
  chưa soát + residual risk**. Review phản ánh thời điểm đọc với ngữ cảnh sẵn có, có thể sót đường render
  chưa nghĩ tới hoặc hành vi runtime không thấy trong diff tĩnh.

## Quy trình (trung tính stack)

### 0. Nạp context + chốt scope — BẮT BUỘC trước khi review
- **Chốt scope review:** diff làm việc (`git diff`), một PR, hay một module/thư mục? Dò cách lấy diff thật
  từ project (`git diff <base>...<head>`, `git diff --staged`) — KHÔNG đoán nội dung thay đổi, đọc diff thật.
- Đọc `project-knowledge/` (`architecture.md` = **kiến trúc UI đã chọn** Feature-Based/FSD/Micro-FE, `source-structure.md`,
  `code-convention.md`, `design-system.md`) để biết **ranh giới tầng, quy ước đặt tên, design-system**.
  Đối chiếu blueprint [architecture/react-feature-based.template.md](architecture/react-feature-based.template.md),
  [architecture/react-fsd.template.md](architecture/react-fsd.template.md) hoặc
  [architecture/react-micro-frontend.template.md](architecture/react-micro-frontend.template.md) cho luật boundary tương ứng.
- **Dò stack thật** từ chính project (`package.json`): React version, TypeScript, data-fetching (TanStack
  Query?), state lib (Zustand/Redux/Context), component-lib (shadcn/MUI/antd), test (Testing Library/msw),
  ép ranh giới (`eslint-plugin-boundaries`/Steiger?) — để biết luật nào lint đã ép, luật nào phải soát tay.
- Thiếu diff/scope rõ hoặc thiếu `project-knowledge` → BÁO (fail-loud), hỏi người dùng thay vì tự bịa
  phạm vi hay tự suy kiến trúc/design-system.

### 1. Review theo TRỤC
Đọc soát phần trong scope theo các trục cố định, mỗi trục có dấu hiệu cụ thể cho frontend:
[references/review-dimensions.md](references/review-dimensions.md).
- **Correctness** — state/effect sai, dependency array thiếu/thừa, race giữa các request, `key` list không
  ổn định, `useMemo`/`useCallback` sai (memo hoá vô ích hoặc thiếu khi cần), thiếu xử lý loading/error/empty,
  stale closure.
- **Thiết kế & bám boundary** — Feature-Based: feature tự chứa `components/hooks/api/types`, KHÔNG cross-import
  ruột feature khác (liên kết qua nhóm dùng chung phẳng gốc `src/` hoặc compose ở `app/routes`), mở ra ngoài
  qua **public API `index.ts`**;
  FSD: import **chỉ trỏ xuống** layer, KHÔNG cross-import cùng layer, đi qua **public API `index.ts`**;
  Micro-FE: mỗi remote nội bộ theo FSD, ranh giới cross-remote qua module `expose` + `packages/*`, KHÔNG
  import ruột remote khác; server-state ở **React Query**, KHÔNG copy vào `useState`.
- **Đơn giản hoá & tái dùng** — trùng lặp component/logic, over-engineering (trừu tượng thừa), **prop
  drilling** sâu, đặt logic sai tầng.
- **A11y** — `role`/`label` (nút/ảnh/icon-only), liên kết label↔input, thao tác **bàn phím** (focusable,
  Enter/Escape), quản lý **focus** (modal/route change), tương phản màu, `aria-*` đúng.
- **Readability & naming** — theo `code-convention` của project (quy ước `*Page`/`*Container`/`use*`/`*.api`),
  không áp gu lạ.
- **Test coverage** — component/hook mới có test hành vi (render + interaction) cho nhánh mới + case biên
  (loading/error/empty); thiếu test cho code có rủi ro là một finding.

### 2. Phân loại severity + evidence + đề xuất fix
Mỗi finding gồm: **severity** (blocker / major / minor / nit), **`file:line`**, **trục**, **rationale**
(vì sao là vấn đề — kèm kịch bản tương tác→hành vi sai nếu là lỗi correctness/a11y), **nhãn proven/suspected**,
và **đề xuất fix** (hướng sửa, không bắt buộc viết code trừ khi được yêu cầu). Thang severity + cách gắn
evidence: [references/review-dimensions.md](references/review-dimensions.md) mục "Severity". Không có
`file:line` cụ thể thì KHÔNG dựng finding (tránh nhận xét chung chung).

### 3. Xuất kết quả
Trình bày theo [references/review-output-template.md](references/review-output-template.md): bảng finding
(severity · `file:line` · trục · rationale · đề xuất fix), tóm tắt theo severity, mục **cần-người-quyết**,
và **phần chưa soát + residual risk**. Ngôn ngữ đo được.

### 4. Read-only + route — con người duyệt
- Mặc định **KHÔNG sửa**; giao kết quả cho người quyết. Chỉ áp fix khi người dùng yêu cầu rõ, và chỉ cho
  finding **proven, rõ ràng, đúng scope** — vẫn DỪNG duyệt diff trước commit.
- **Route** khi vượt phạm vi review:
  - Cần **quét bảo mật / lỗ hổng phụ thuộc / tool gate (SonarQube, Black Duck, security review)** →
    `engineering-quality-gate`. Skill này KHÔNG tự làm security scan; chỉ nhắc khi thấy dấu hiệu (vd
    `dangerouslySetInnerHTML` với dữ liệu chưa làm sạch, secret/token hardcode, URL/target chưa kiểm) và
    chuyển tiếp.
  - Cần **tái cấu trúc / đổi kiến trúc** vượt một-vài dòng → `frontend-refactor` (skill sắp có) hoặc
    `frontend-migrate-architecture` khi là đổi kiểu kiến trúc (Feature-Based ↔ FSD ↔ Micro-FE).
  - Cần **thêm/sửa test** → `frontend-testing`.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| R1 | Đã chốt scope + đọc **diff thật** + nạp `project-knowledge` (kiến trúc + convention + design-system) | 0 | DỪNG, hỏi người dùng, không tự bịa scope/kiến trúc |
| R2 | Mỗi finding có `file:line` + trục + rationale + nhãn proven/suspected | 1–2 | Bỏ finding chung chung không có evidence |
| R3 | Không thổi suspected thành blocker; severity bám tác động thật | 2 | Hạ severity đúng mức trước khi xuất |
| R4 | READ-ONLY — không sửa/commit khi chưa được yêu cầu; route đúng skill | 4 | Trả về đề xuất, không tự sửa |
| R5 | Nêu phần chưa soát + residual risk, không tuyên bố "hết bug" | 3 | Bổ sung trước khi kết luận |

## Sau khi xong
Tóm tắt: số finding theo severity, các mục **cần người quyết**, phần **chưa soát + residual risk**. Con người
đọc review và **tự quyết** hướng xử lý (sửa / hoãn / route). Nếu gặp ràng buộc mâu thuẫn (stack ngoài
React/TS chưa có dấu hiệu trong references, hoặc không lấy được diff rõ để soát), DỪNG và BÁO thay vì tự
đi chệch hay review mò.
