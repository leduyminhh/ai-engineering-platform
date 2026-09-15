# Design — Bộ kiến trúc frontend (frontend architecture kit)

> Ngày: 2026-09-15 · Phạm vi: `plugins/frontend` · Mục tiêu: đưa bộ template kiến trúc frontend lên
> ngang tầm "architecture kit" của backend (ARD làm selector + template chuẩn cho từng structure),
> với bộ 3 kiến trúc **Feature-Based / FSD / Micro-Frontend**.

## 1. Bối cảnh & vấn đề

Backend đã có một "architecture kit" đầy đủ tại `plugins/backend/templates/architecture/`:

- `ARD.md` — Architecture Reference Document: khái niệm + **bảng chọn kiến trúc** (selector) + tín hiệu
  nâng cấp + checklist review + hợp đồng sinh example.
- `<stack>-<arch>.template.md` — blueprint cấu trúc (cây thư mục annotated + ranh giới + quy ước tên,
  **không** code skeleton) cho mỗi kiến trúc × stack.

Frontend hiện chỉ có 2 template rời (`react-layered.template.md`, `react-fsd.template.md`), **không có
ARD** — logic chọn kiến trúc nằm rải trong `frontend-init` / `frontend-migrate-architecture`. Thiếu một
nguồn sự thật chung để "AI đánh giá trước rồi chọn kiến trúc", và thiếu mức kiến trúc cho hệ đa team
(micro-frontend).

**Cơ chế ship (đã xác minh):** mọi skill frontend khai `sharedAssets: templates/architecture` trong
frontmatter → toàn bộ thư mục `plugins/frontend/templates/architecture/` ship kèm mỗi `SKILL.md` dưới
đường dẫn tương đối `architecture/`. Vì vậy **thêm file template mới tự động tới tay người dùng** ở mọi
skill; công việc còn lại chỉ là viết nội dung + trỏ lại tham chiếu trong thân skill.

## 2. Quyết định đã chốt (từ brainstorming)

1. **Bộ 3 template thay Layered:** Feature-Based (mặc định, mức đơn giản nhất) · FSD (giữ) ·
   Micro-Frontend (mới). **Xóa hẳn Layered** — kể cả khỏi ARD; không giữ tầng "no-template".
2. **Selector = `ARD.md` frontend** theo đúng chuẩn backend (tài liệu, không thêm skill runtime).
3. **Phạm vi:** template + ARD, **rồi nối vào** `frontend-init` và `frontend-migrate-architecture`, và
   lan tham chiếu ra các skill còn dùng tên template cũ.
4. **Micro-FE trong migrate:** ở mức **nhận diện + kế hoạch phân rã có hướng dẫn** (slice/domain nào →
   remote nào), **không** auto-move in-place như Feature-Based↔FSD (vì đây là tách app + build/deploy
   độc lập, không phải dời file trong một `src/`).
5. **Stack Micro-FE:** Vite + Module Federation. Plugin chính chủ **`@module-federation/vite`** làm mặc
   định; ghi `@originjs/vite-plugin-federation` như biến thể cũ; nêu nhánh Rspack/webpack
   (`@module-federation/enhanced`). **[Unverified]** tên/độ mới chính xác của package — chốt version khi
   implement, template mô tả theo vai trò (host expose/remote, shared singleton) để không lệ thuộc một
   version cụ thể.
6. **Feature-flags:** thêm một mục **Tùy chọn** ("Optional") vào **cả 3** template — mô tả nơi đặt và
   cách đọc flag đúng ranh giới của từng kiến trúc; không ép vào scaffold.

## 3. Kiến trúc bộ template (thang độ phức tạp)

| Mức dự án | Kiến trúc | File | Ghi chú |
|---|---|---|---|
| Nhỏ/vừa — **mặc định** | **Feature-Based** | `react-feature-based.template.md` **(mới)** | Nhóm theo domain; mềm hơn FSD (không widgets/entities, không cấm cross-import cứng). |
| Lớn / nhiều domain-team | **FSD** | `react-fsd.template.md` (giữ, sửa nhẹ) | Layer/slice/segment + public API. |
| Đa team + deploy độc lập | **Micro-Frontend** | `react-micro-frontend.template.md` **(mới)** | Host + remotes (Module Federation); **mỗi remote nội bộ = FSD**. |

Nguyên tắc nền chung (ARD): phụ thuộc **chỉ trỏ xuống**, giao tiếp qua **public API/module expose**,
**không cross-import** ngang hàng; ép bằng `eslint-plugin-boundaries` (+ `steiger` cho FSD; +
federation config cho Micro-FE).

## 4. Nội dung từng file

Mọi template theo **đúng khung mục sẵn có** của các template hiện tại: `Summary → Context (bảng vai trò↔
ví dụ) → Problem → Solution → Architecture (cây thư mục annotated + vai trò/ranh giới + chiều phụ thuộc +
ranh giới state) → [Feature-flags (Optional)] → Implementation → Standards → Best Practices →
Anti-patterns → Examples → Checklist → References → Related`. **Không code skeleton** — chỉ blueprint.
Domain minh hoạ: `invoices` (đồng bộ với template hiện có).

### 4.1 `ARD.md` (mới) — selector

Mục: (1) Quy tắc nền (dependency trỏ xuống / public API / no cross-import); (2) Khối kiến thức —
Component-driven, Separation-by-feature, FSD methodology, Micro-frontend/Module Federation; (3) Bảng so
sánh 3 kiến trúc; (4) **Bảng chọn** + tín hiệu nâng cấp (Small/Medium→Feature-Based · Large→FSD ·
Multi-team+independent deploy→Micro-FE; kèm cảnh báo "đừng chọn phức tạp hơn nhu cầu"); (5) Quy ước chung
+ boundary tooling; (6) Checklist review PR; (7) Hợp đồng sinh example khi init. **Không nhắc Layered.**

### 4.2 `react-feature-based.template.md` (mới) — mặc định

- Cây: `src/{app,pages,features/<domain>/{ui,hooks,api,model,index.ts},shared/{ui,lib,config,api}}`.
- Ranh giới: `feature` **không** import ruột `feature` khác (đi qua `shared` hoặc compose ở `pages`);
  server-state React Query ở `features/<x>/api`; presentational trong `features/<x>/ui`.
- Boundary: `eslint-plugin-boundaries` (feature↔feature disallow; mọi thứ → shared allow; app→pages→features).
- Feature-flags (Optional): nguồn flag ở `shared/config/flags`, hook `useFeatureFlag` ở `shared/lib`; gate
  ở `pages`/`features/<x>/ui`; **không** đặt logic flag trong `shared/api`.

### 4.3 `react-micro-frontend.template.md` (mới)

- Cây monorepo: `apps/host` (shell: routing gốc, layout, auth/session) + `apps/<remote>` (mỗi remote
  **nội bộ FSD** — link sang `react-fsd.template.md`) + `packages/{ui-kit,contracts,shared-config}`.
- Module Federation (Vite): host khai `remotes`, remote `expose` module công khai; **React singleton +
  shared deps** (tránh nhân bản/nhiều bản React); versioning shared. Ghi biến thể poly-repo.
- Ranh giới cross-app: remote **không** import nội bộ remote khác — chỉ qua module `expose` + `packages/*`;
  contract chia sẻ ở `packages/contracts`, UI-kit ở `packages/ui-kit`.
- Feature-flags (Optional): flag là **runtime config do host cung cấp** (context/props truyền vào remote →
  bật/tắt không cần redeploy remote), fallback flag cục bộ mỗi remote; đặt ở `packages/shared-config`.

### 4.4 `react-fsd.template.md` (sửa nhẹ)

- Thêm mục **Feature-flags (Optional)**: nguồn flag ở `shared/config`, hook ở `shared/lib`; entities/
  features đọc qua `shared`; gate ở `pages`/`widgets`. Không đặt trong segment `api`.
- Cập nhật `Related`: bỏ link `react-layered.template.md`; thêm link `ARD.md`, `react-feature-based`,
  `react-micro-frontend`.

### 4.5 Xóa `react-layered.template.md`

Gỡ file. Mọi tham chiếu tới nó phải được trỏ lại (mục 5) — verify **0 tham chiếu chết**.

## 5. Nối vào skill (wire-in) — mọi touchpoint đã liệt kê

Đổi mọi `react-<layered|fsd>` → bộ mới; thêm Micro-FE; bỏ Layered.

- **`frontend-init/SKILL.md`** — bước hỏi kiến trúc: đọc `architecture/ARD.md`, chọn trong
  {Feature-Based(mặc định)/FSD/Micro-FE}, scaffold từ template tương ứng.
- **`frontend-migrate-architecture/`** — `SKILL.md` + `references/detection-heuristic.md` +
  `boundary-tooling.md` + `migration-workflow.md`: thêm target Feature-Based (auto-move) và Micro-FE
  (**nhận diện + kế hoạch phân rã, không auto-move**, ghi rõ ranh giới).
- **`frontend-code-review/`** — `SKILL.md` + `references/review-dimensions.md` + `review-output-template.md`.
- **`frontend-implement/`** — `SKILL.md` + `references/component-mapping.md` + `fidelity-checklist.md` +
  `interaction-tiers.md`.
- **`frontend-testing/references/test-strategy.md`**.
- **`frontend-refactor/SKILL.md`**.
- **Frontmatter `description`** (5 skill: code-review, implement, migrate-architecture, refactor, testing):
  đổi cụm "Layered/FSD" → "Feature-Based/FSD/Micro-FE" cho khớp matcher.

## 6. Xác minh (fail-loud, theo AGENTS.md)

Sau mỗi phase và cuối cùng:

1. `npm run build` — template mới ship qua `sharedAssets`, build không lỗi.
2. `npm run validate` — contract source + build-output.
3. `npm test` — full suite.
4. `grep -rn "react-layered" plugins/frontend` → **rỗng** (0 tham chiếu chết).

## 7. Phân phase (để `/loop` chạy dần — 1 phase = 1 commit qua core:git-workflow)

- **P1** — `ARD.md` (selector).
- **P2** — `react-feature-based.template.md` (+ feature-flags Optional).
- **P3** — `react-micro-frontend.template.md` (+ feature-flags Optional).
- **P4** — sửa `react-fsd.template.md` (feature-flags + Related); **xóa** `react-layered.template.md`.
- **P5** — wire-in `frontend-init` + `frontend-migrate-architecture` (+3 references).
- **P6** — lan tham chiếu (code-review/implement/testing/refactor + 5 frontmatter description);
  chạy build+validate+test; grep 0 tham chiếu chết.

Mỗi phase: đọc file liên quan trước khi sửa · thay đổi phẫu thuật · build+validate xanh · dừng cho người
duyệt diff trước commit.

## 8. Rủi ro & giả định

- **Xóa Layered là breaking** với project đã init theo Layered: skill migrate/review phải xử lý mềm (đọc
  `project-knowledge/architecture.md` của project, **không ép** kiến trúc mới lên project đang là Layered —
  chỉ ngừng cung cấp Layered như một *đích scaffold mới*). Ghi rõ trong wire-in.
- **[Unverified]** Package Module Federation trên Vite: chốt tên/version lúc implement; template mô tả theo
  vai trò để không giòn theo version.
- Kích thước diff lớn ở P6 (nhiều file nhỏ) — tách commit theo skill nếu cần review dễ hơn.
