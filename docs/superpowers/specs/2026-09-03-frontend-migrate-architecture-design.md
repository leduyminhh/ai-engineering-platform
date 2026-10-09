# Thiết kế: Skill `frontend-migrate-architecture` — tái cấu trúc React sang Layered/FSD

- Ngày: 2026-09-03
- Trạng thái: **Đã thực thi** — skill `frontend-migrate-architecture` (`9cae8ab`), merge vào `master` qua PR #23 (`d08de01`, 2026-09-04).
- Phạm vi: Nội dung — thêm skill recipe on-demand `frontend-migrate-architecture` cho plugin `frontend`.
  Không đổi engine/adapter/CLI.

## 1. Mục tiêu & tiêu chí thành công

Việc lặp lại "dọn cấu trúc `src/` của một React project cũ cho đúng kiến trúc" hiện chưa có skill hỗ trợ:
`frontend` mới có `frontend-init` (scaffold tài liệu) và `frontend-implement` (sinh component). Mục tiêu:
một recipe **tái tổ chức** mã nguồn của một React project ĐÃ TỒN TẠI sang kiến trúc đích trong bộ chuẩn
(**Layered** hoặc **Feature-Sliced Design**) — **GIỮ NGUYÊN hành vi**, chỉ đổi cách phân tầng/ranh giới
phụ thuộc — qua các cổng an toàn incremental. Đây là bản song sinh phía frontend của
`backend-migrate-architecture`.

Thành công khi:

1. Có `plugins/frontend/skills/frontend-migrate-architecture/SKILL.md` (recipe mỏng với cổng an toàn
   đánh số) + `references/` (dày) theo cách khung vận hành.
2. Skill là recipe **on-demand** (`pipeline: false`, `next: null`, `order` sau các skill hiện có),
   auto-discover, project ra **cả 4 provider**, parity `references/`.
3. Skill khai `sharedAssets: templates/architecture` để đọc blueprint kiến trúc đích
   (`react-layered.template.md` / `react-fsd.template.md`) — **KHÔNG chép lại cây/luật** trong skill.
4. `npm test` xanh; `npm run build` ship skill + references + `architecture/` ra 4 provider.
5. **Docs-only, behavior-preserving** — skill là *hướng dẫn agent tái cấu trúc an toàn*, không phải công
   cụ refactor tự động; không đổi hành vi nghiệp vụ trong lúc migrate.

## 2. Phạm vi

- **Trong phạm vi:** dò cấu trúc `src/` React hiện trạng (theo feature / theo type / phẳng), chọn kiến
  trúc đích (Layered/FSD), lập bảng ánh xạ file → tầng/slice, **dời file + cập nhật import** theo lô nhỏ,
  dựng lưới characterization test khi thiếu test, bật ép ranh giới (eslint-plugin-boundaries / Steiger).
- **Ngoài phạm vi:** đổi hành vi nghiệp vụ (là bước tách riêng sau migrate), đổi component library, đổi
  state-lib/router, nâng cấp framework, đụng secret/config/CI infra ngoài lint boundary, viết lại
  design-system. Không tách micro-frontend.

## 3. Kiến trúc đích

```
plugins/frontend/skills/frontend-migrate-architecture/
├── SKILL.md                          # recipe mỏng: context -> baseline G1 -> ánh xạ -> G2..G5 (cổng an toàn)
└── references/
    ├── detection-heuristic.md        # nhận diện cấu trúc React hiện trạng + bảng map file -> tầng/slice đích
    ├── migration-workflow.md         # chi tiết cổng G1-G6: chia lô nhỏ, giữ hành vi, characterization test React
    └── boundary-tooling.md           # bật ép ranh giới sau tái cấu trúc (boundaries / Steiger), giới thiệu dần
```

Frontmatter: `pipeline: false`, `next: null`, `order: 7`, `stageNumber: "07"`, `runsIn: execute`,
`invoke: per-request`, `sharedAssets: templates/architecture` (đọc blueprint Layered/FSD; cùng nguồn với
`frontend-init` / `frontend-implement`).

## 4. Luồng skill (cổng an toàn G1–G6)

0. **Nạp context + chọn kiến trúc đích:** đọc `project-knowledge/` (nếu có) + dò cấu trúc React thật (cây
   `src/`, router, state, data layer, component-lib, Tailwind, TS, alias, lệnh build/test); chọn đích
   (Layered nếu nhỏ/ít domain; FSD nếu nhiều domain — DỪNG cho người chốt) và đọc blueprint tương ứng ở
   `architecture/react-<layered|fsd>.template.md`.
1. **G1 — Baseline XANH:** build + test + lint hiện trạng phải xanh TRƯỚC khi động. Chưa có test → dựng
   characterization test tối thiểu (render/snapshot màn hình chính) ở G2.
2. **Nhận diện + BẢNG ÁNH XẠ:** phân loại cấu trúc hiện trạng, lập bảng file → tầng/slice đích (chi tiết
   `references/detection-heuristic.md`); in bảng cho người rà soát TRƯỚC khi động code.
3. **G2 — Characterization:** dựng lưới an toàn (render/interaction/snapshot) khoá hành vi hiện tại quanh
   các màn hình/luồng sẽ đụng; xác nhận XANH trên code CŨ.
4. **G3 — Xanh-mỗi-bước (vòng lặp chính):** di chuyển theo lô nhỏ (một slice/nhóm component mỗi lần), ưu
   tiên **dời + cập nhật import**, KHÔNG đổi hành vi; build + test xanh sau mỗi bước.
5. **G4 — Ép ranh giới:** bật/cấu hình eslint-plugin-boundaries (Layered) / Steiger + boundaries (FSD),
   giới thiệu dần (cảnh báo → lỗi), làm nó xanh (chi tiết `references/boundary-tooling.md`).
6. **G5 — Hồi quy toàn bộ:** full build/test/lint xanh cuối cùng, so khớp với characterization + baseline;
   cập nhật `project-knowledge/architecture.md` + `source-structure.md`.
7. **G6 — Một bước = một commit (xuyên suốt):** mỗi bước dừng cho người duyệt diff rồi commit; không push
   thẳng main.

Đặt file/tầng/slice + boundary theo blueprint (`architecture/react-<layered|fsd>.template.md`) — KHÔNG chép
cây/luật vào skill; chỉ trỏ template. Chi tiết ở `references/migration-workflow.md`.

## 5. Kiểm thử & verification

- `npm test`: frontmatter contract (order unique, recipe order > pipeline, next=null), parity
  `references/` + sharedAssets qua 4 adapter, strip workflow-metadata. Phải xanh.
- `npm run build`: `frontend-migrate-architecture/` + `references/` + `architecture/` xuất hiện trong output
  frontend của **cả 4 provider** (claude, cursor, codex, antigravity).

## 6. Ranh giới / ngoài phạm vi

- **Behavior-preserving:** KHÔNG đổi hành vi nghiệp vụ trong lúc migrate — đổi hành vi là bước tách riêng.
- Baseline phải XANH trước khi động (G1); không migrate trên nền gãy.
- Không đụng secret/config; defer blueprint + `code-convention.md` của project tuyệt đối.
- Chỉ chạm plugin `frontend`; không đụng CLI/adapter/engine. Con người duyệt diff mỗi bước.
- REALITY FILTER: dùng ngôn ngữ đo được (lệnh + kết quả thật), không tuyên bố tuyệt đối; nêu rủi ro còn lại.

## 7. Các pha thực thi

1. Viết `SKILL.md`.
2. Viết 3 file `references/` (detection-heuristic, migration-workflow, boundary-tooling).
3. `npm test` + `npm run build`; xác nhận ship qua 4 provider.
