# Thiết kế: Audit & định hướng nâng cấp Skill → Plugin → Workflow + plan thiết kế agent mới

- Ngày: 2026-09-29
- Trạng thái: **Đang thực thi** (cập nhật 2026-10-01). P0 xong; P1 xong (`data-db-migration` vẫn draft);
  P1c xong (publish không chờ pilot, 2026-09-30); P1b chờ pilot (Q6); P2 phần lớn xong (WF3 phần dùng skill
  chờ P1b); P3 xong (G10 phần backend, 2026-09-30); frontend performance còn mở. Tiến độ và việc còn lại: §13.
- Phạm vi: đánh giá chất lượng 4 plugin `backend`, `frontend`, `engineering`, `workflows`; định hướng nâng cấp
  theo 3 cấp; thiết kế 3 skill + 2 agent mới đã được chủ dự án chốt:
  `backend-db-migration`, agent e2e, agent data-integration. Plugin `ops` **không** được audit; 2 agent `ops`
  ở §8.1 giữ nguyên.
- Người duyệt: chủ dự án; review chéo bằng Codex.
- Nền: spec `2026-09-25-agents-workflows-design.md` (§5.1 contract, §9 gap G1–G11).
- Thiết kế đầy đủ của `backend-db-migration` (gộp G2 từ spec `2026-09-07-backend-migrate-db-design.md`, phương
  án A) nằm ở §7.1 của file này.

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: đọc file hoặc grep, có `file:dòng` hay tên bước đi kèm |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng được (tài liệu công cụ bên ngoài, hành vi client thật) |
| `[Đề xuất]` | Hướng nâng cấp. Là quyết định thiết kế chờ duyệt, không phải sự thật |

Điểm 1–10 là **đánh giá có lập luận** dựa trên bằng chứng bên dưới, không phải số đo khách quan.

Đường dẫn trích dẫn dùng **source repo** (`plugins/…`, `workflows/<slug>/WORKFLOW.md`). Một số dòng lấy từ
audit trên **bản cài** (`~/.claude/plugins/cache/ai-engineering-platform/<plugin>/1.2.0/…`) được ghi rõ là `(cache)`.
Riêng workflow được trích theo **tên bước** thay vì số dòng, vì adapter chèn thêm header khi build, làm lệch số
dòng giữa source và bản cài.

---

## 1. Mục tiêu & tiêu chí thành công

1. Có danh sách lỗi **đã xác nhận trên source hiện tại** (commit `80eecee`), kèm bằng chứng, để sửa theo từng
   task nhỏ.
2. Có định hướng nâng cấp theo 3 cấp (skill → plugin → workflow), xếp ưu tiên P0–P3.
3. Có thiết kế đủ chi tiết để hiện thực:
   `backend-db-migration`, `frontend-e2e-testing` + `frontend-e2e-test-writer`,
   `frontend-data-integration` + `frontend-data-integrator`. Thiết kế phải qua được contract của
   `test/validate.mjs` (§8.4).
4. Không tạo mục song song với roadmap đã có (G1, G2, G5 trong spec 2026-09-25 §9). Chỗ nào chồng lấn thì nêu
   rõ và đưa thành câu hỏi quyết định (§11).

---

## 2. Phương pháp & nguồn bằng chứng

1. **Audit nội dung** (4 sub-agent song song) trên bản cài: backend/frontend/engineering `1.2.0`, workflows
   `1.0.0`. Đọc trọn mọi `SKILL.md` + `agents/*.md` + `plugin.json`. **Không đọc** `references/*.md` của từng
   skill; nhận định về độ sâu của reference là `[Unverified]`.
2. **Đọc trực tiếp 13/13 workflow** (lần audit đầu sót `workflow-testing`) và grep tham chiếu chéo.
3. **Đối chiếu lại trên source** (`E:\Mine\AI\ai-engineering-platform`, nhánh `master`, working tree sạch,
   HEAD `80eecee`): 12 lỗi D1–D12 **đều còn tồn tại** (§3.2).

### 2.1 Đính chính so với báo cáo trong chat trước đó

| Nhận định cũ | Thực tế sau khi đọc source |
|---|---|
| "schema spec §5.1 không có file định nghĩa" | **Có**, nằm trong `docs/superpowers/specs/2026-09-25-agents-workflows-design.md` §5.1. Vấn đề thật: file này **không được ship** cùng plugin, nên agent chạy trong project đích không đọc được (xem A1) |
| "Plugin `data` không tồn tại" | **Có**, ở dạng draft trong `plugins/data/` (4 skill). Không nằm trong `plugins/_published.json`, nên không có trong bản cài |
| "Gap G1 chỉ được nhắc tên" | Đã định nghĩa trong spec 2026-09-25 §9: `frontend-data-integration` |
| `workflow-db-change` 10/10 | Không đứng được: workflow **không có bước test** (§5) |
| Đã audit "12 workflow" | Có 12 workflow + orchestrator = 13 file; lần đầu sót `workflow-testing` |

---

## 3. Cấp 1 — Skill

### 3.1 Bảng điểm (audit bản cài)

**backend** (tổng 8/10)

| Skill/agent | Điểm | Điểm mạnh chính | Điểm yếu chính |
|---|---|---|---|
| backend-api-contract | 8 | Quy tắc SemVer cụ thể; drift-check READ-ONLY | Guardrail lặp gần nguyên văn ở 2 mục (cache :30-49 và :120-127) |
| backend-code-review | 8.5 | Gate R1–R5; bắt buộc phân biệt proven/suspected | D1 (tham chiếu lỗi thời) |
| backend-implement | 8 | DoD có kiểm ArchUnit/import-linter | Trỏ DB migration sang plugin `data` chưa publish (cache :73; source :78) |
| backend-init | 6.5 | Idempotent, skip file đã có | D3 (Node-TS không có template downstream); không có gate |
| backend-migrate-architecture | 9 | G1–G6; buộc chứng minh boundary bằng tool | Dày (131 dòng) |
| backend-migrate-vault-consul | 9 | Cổng kiểm `.properties` còn sót; secret lộ ⇒ rotate | Dài nhất (184 dòng) |
| backend-principles | 6 | Thứ tự nguồn sự thật rõ | Mỏng; phần an toàn chỉ 1 bullet |
| backend-refactor | 9 | Tách bạch rõ với migrate-architecture; hỏi trước khi áp pattern lớn | — |
| backend-testing | 8.5 | Test pyramid gắn theo tầng; cấm trỏ vào staging/prod | Phụ thuộc reference chưa đọc |
| agents (3) | 8–8.5 | reviewer read-only ép bằng `disallowedTools` | Trỏ "§5.1" không ship (A1) |

**frontend** (tổng 7/10)

| Skill/agent | Điểm | Điểm mạnh chính | Điểm yếu chính |
|---|---|---|---|
| frontend-code-review | 8 | Gate R1–R5; READ-ONLY | D1 |
| frontend-implement | 7 | Ranh giới "KHÔNG nối API" rõ | Bị D2 mâu thuẫn; guardrail mỏng hơn các skill cùng plugin |
| frontend-init | 7 | Hai chốt người duyệt; không ghi đè | Hỏi domain hai lần (bước 2 và bước 4) |
| frontend-migrate-architecture | 9 | G1–G6; Micro-FE chỉ lập kế hoạch | — |
| frontend-principles (`shared/principles.md`) | 5 | Thứ tự nguồn sự thật | **D2**: mâu thuẫn trực tiếp với frontend-implement |
| frontend-refactor | 9 | Ranh giới với migrate-architecture; có danh sách từ bị cấm | — |
| frontend-testing | 9 | Bắt buộc msw; T1–T6 | Loại e2e nhưng không trỏ sang skill nào (→ G5) |
| agents (3) | 7–9 | reviewer read-only bằng tool | test-writer chỉ cấm sửa production bằng văn bản (A3) |

**engineering** (tổng 8/10)

| Skill/agent | Điểm | Điểm mạnh chính | Điểm yếu chính |
|---|---|---|---|
| engineering-adr | 8 | Không tự đặt `Accepted`; ghi hệ quả trung thực | Đánh số bước "2b" |
| engineering-convention-enforce | 8 | Fail-loud khi thiếu `code-convention.md`; phân ranh với quality-gate | Ranh giới với ADR nói lại 3 lần |
| engineering-diagram | 8 | Không ghi file khi chưa xác nhận; cấm bịa | Quy tắc "tối đa 2 diagram" không có lý do |
| engineering-principles | 7 | Quy tắc mask secret; kỷ luật evidence | Mỏng (35 dòng) |
| engineering-quality-gate | 9 | Danh sách cấm auto-fix; khoá phạm vi scan | Không nhắc tới convention-enforce từ phía mình |
| engineering-release-notes | 9 | Handoff với `git-workflow` + fallback | Không có ví dụ mẫu |
| engineering-spec-writing | 8 | AC đo được; mức FEATURE | Lặp lại thủ tục ADR đã có trong engineering-adr |
| agents (3) | 8–9 | Auditor read-only bằng tool | D11; trỏ "§5.1" (A1) |

### 3.2 Lỗi đã xác nhận trên source (HEAD `80eecee`)

| ID | Lỗi | Bằng chứng (source) | Mức |
|---|---|---|---|
| D1 | Gọi `*-refactor` là "skill sắp có" dù skill đã tồn tại | `plugins/backend/skills/backend-code-review/SKILL.md:42`, `:96`; `plugins/frontend/skills/frontend-code-review/SKILL.md:45` | minor |
| D2 | Principles nói frontend-implement "nối API thật", ngược với ranh giới của chính skill đó | `plugins/frontend/shared/principles.md:25` và `frontend-implement/SKILL.md` ("KHÔNG nối data/API") | **major** |
| D3 | backend-init cho chọn Node-TypeScript nhưng mọi skill downstream chỉ hỗ trợ Java/Python | `plugins/backend/skills/backend-init/SKILL.md:39` | major |
| D4 | Manifest frontend ghi "Layered + FSD", còn mọi skill dùng Feature-Based/FSD/Micro-FE | `plugins/frontend/.manifest.json:4` | minor |
| D5 | workflow-testing: bảng lỗi cho "sửa code", trong khi Bước 4 cấm sửa code production | `workflows/testing/WORKFLOW.md:122` và Bước 4 | **major** |
| D6 | workflow-docs: bảng lỗi có dòng "Build fail", trong khi workflow không build | `workflows/docs/WORKFLOW.md:107` và mục Baseline | minor |
| D7 | security-review: tập vùng rủi ro thiếu authorization/access control | `workflows/security-review/WORKFLOW.md` Bước 1 (grep `authoriz\|phân quyền\|access control` = 0) | **major** |
| D8 | security-review: phát hiện secret lộ nhưng không có bước rotate | cùng file (grep `rotate\|thu hồi` = 0) | **major** |
| D9 | db-change: đổi query/ORM/DTO mà không có bước test | `workflows/db-change/WORKFLOW.md` frontmatter `agents: "backend-implementer,backend-reviewer"` (không có test-writer) | **major** |
| D10 | api: không có review correctness/bảo mật, nhưng DoD đòi "0 finding blocker" | `workflows/api/WORKFLOW.md` (grep `quality-auditor` = 0); Bước 4 chỉ kiểm drift | **major** |
| D11 | spec-analyst: "cả hai skill" trong khi agent dùng 3 skill | `plugins/engineering/agents/engineering-spec-analyst.md:37`; frontmatter `skills` có 3 mục | nit |
| D12 | performance/db-change bảo reviewer xét "performance/N+1" nhưng backend-code-review không có trục đó | grep `performance\|hiệu năng\|N+1` trong `plugins/backend/skills/backend-code-review` = 0 | major |

### 3.3 Định hướng nâng cấp — cấp Skill `[Đề xuất]`

| # | Hành động | Sửa lỗi | Ưu tiên |
|---|---|---|---|
| S1 | Xoá chữ "(skill sắp có)" ở 3 chỗ | D1 | P0 |
| S2 | Viết lại `frontend/shared/principles.md:25`: implement **dừng ở presentational**; phần nối data là việc của skill mới `frontend-data-integration` | D2 | P0 |
| S3 | backend-init: bỏ Node-TypeScript, **hoặc** giữ lại nhưng in cảnh báo "chưa có template kiến trúc — các skill downstream không hỗ trợ" | D3 | P0 |
| S4 | backend-code-review: thêm trục **performance** (N+1, thiếu index, query trong vòng lặp, tải eager thừa). Enum `category: performance` đã có sẵn trong §5.1 | D12 | P1 |
| S5 | engineering-quality-gate: thêm 1 dòng trỏ sang convention-enforce | — | P2 |
| S6 | engineering-spec-writing bước 4: thay phần thủ tục ADR bằng một pointer tới engineering-adr | — | P2 |
| S7 | frontend-testing: phần loại e2e trỏ sang `frontend-e2e-testing` | — | P1 (cùng lúc với §7.2) |
| S8 | backend-implement `:78`, `:89`: đổi pointer DB migration sang `backend-db-migration` | — | Pha publish của §7.1.10 |

---

## 4. Cấp 2 — Plugin

### 4.1 Hiện trạng

| Plugin | Điểm | Nhận xét |
|---|---|---|
| backend | 8 | Khung skill nhất quán (trigger, ranh giới an toàn, gate). Lỗi: D1, D3; manifest chỉ nêu 3/8 skill |
| frontend | 7 | Kỷ luật tốt nhưng có mâu thuẫn nội bộ D2 (nặng nhất trong audit), D4 |
| engineering | 8 | Guardrail nhất quán. Manifest nêu 3/6 skill; trùng thủ tục ADR |
| data (draft) | chưa audit | Không có trong bản cài; `data-oltp-implement` có phạm vi chồng với `backend-db-migration` (§7.1.1) |

### 4.2 Vấn đề xuyên plugin

| ID | Vấn đề | Bằng chứng |
|---|---|---|
| P-a | Contract §5.1 chỉ nằm trong design spec, không ship theo plugin; 3 agent + mọi workflow trỏ "schema spec §5.1" | `backend-reviewer.md`, `frontend-reviewer.md`, `engineering-quality-auditor.md` (cache :26/:31/:41) |
| P-b | Manifest mô tả thiếu skill, làm yếu khả năng discovery | `plugins/*/.manifest.json` |
| P-c | Không workflow nào dùng `backend-init`, `frontend-init`, `backend-migrate-vault-consul` | grep trong workflows = 0 |
| P-d | `_published.json` liệt kê cả plugin, nên **mọi skill mới thêm vào `frontend`/`backend` được wizard offer ngay**. Publish từng skill (`plugin/skill`) chỉ điều khiển wizard; **gói npm vẫn ship nguyên thư mục plugin** khi plugin có ≥ 1 skill đã publish, nên skill draft vẫn nằm trong gói | Comment trong `plugins/_published.json`; `offeredCatalog` (`cli/lib/install.mjs:327`) |

### 4.3 Định hướng — cấp Plugin `[Đề xuất]`

| # | Hành động | Ưu tiên |
|---|---|---|
| PL1 | Chuyển contract §5.1 (evidence/finding/result + quy tắc §5.2) vào `core/principles/` (thứ được ship), rồi đổi mọi pointer "schema spec §5.1" thành pointer tới `core:principles` | P0 |
| PL2 | Viết lại description của 3 manifest cho khớp đủ danh sách skill (sửa D4 cùng lúc) | P0 |
| PL3 | Skill mới publish **từng phần**: đổi mục nguyên plugin thành danh sách `<plugin>/<skill>`, thêm skill mới chỉ khi đã qua smoke/pilot (Q4). Chỉ gate được wizard, không gate được gói npm (P-d) | P1 |
| PL4 | Viết một ADR tách phạm vi migration DB giữa `backend` và `data` (§7.1.1) | P1 |

---

## 5. Cấp 3 — Workflow

### 5.1 Bảng điểm (đọc trực tiếp 13 file)

Điểm này **thay thế** điểm workflow trong báo cáo chat trước (tổng khi đó là 8, nay là **7/10**).

| Workflow | Điểm | Thiếu chính (bằng chứng: tên bước) |
|---|---|---|
| orchestrator | 8 | Registry thiếu dòng cho init/config-secret/dependency-upgrade; không ghép được feature+db-change+api |
| feature | 8 | Không có nhánh schema; Bước 3 vướng G1; không có e2e; nối tiếp `workflow-docs` trùng Bước 6 |
| bugfix | 9 | Bước 5 (fix) ở session chính; regression chỉ chạy "phía đã fix" (Bước 6) `[Inference]` có thể sót lỗi xuyên BE↔FE |
| refactor | 9 | Chế độ `architecture` không cập nhật `project-knowledge/architecture.md` |
| code-review | 7 | File nhóm "khác" (CI/IaC/SQL) không có reviewer (Bước 2); spec đầu vào tuỳ chọn không được dùng; không kiểm drift |
| security-review | 7 | D7, D8; không có regression test cho lỗ hổng; Bước 5 ở session chính |
| db-change | 7 | D9; không cập nhật `data-model.md`; phần contract của expand/contract không ghi vào `next_actions`; migration viết ở session chính |
| api | 7 | D10; Bước 5 FE client vướng G1 |
| testing | 6 | D5; policy có e2e nhưng không ai viết; đầu vào Bước 5 "đã xanh" mâu thuẫn với Bước 4 |
| performance | 6 | Không có công cụ hay chủ sở hữu profiling (G10); D12 |
| incident | 8 | Thiếu bước truyền thông; "theo dõi đủ thời gian" không có ngưỡng; không có thang severity mặc định |
| release | 8 | Không có bước build/test (chỉ là tiền điều kiện); không kiểm migration đang chờ; `[Inference]` tag sau deploy |
| docs | 6 | D6; phần lớn việc ở session chính; kiểm link làm tay |

### 5.2 Vấn đề xuyên workflow

| ID | Vấn đề | Bằng chứng |
|---|---|---|
| W-a | "Baseline XANH" là tiền điều kiện nhưng không bước nào đo (trừ refactor Bước 3) | mục "Điều kiện tiên quyết" của feature/api/testing/security-review/release |
| W-b | Code sửa ở session chính, không có agent khoá phạm vi | bugfix Bước 5, security-review Bước 5, performance Bước 4, db-change Bước 3 (số bước lúc audit). Sau WF7/WF11 đánh số lại (kiểm 2026-09-30): bugfix Bước 6 "Fix tối thiểu", security-review Bước 8 "Sửa", performance Bước 4 "Tối ưu", db-change Bước 3 "Implement" (phần file migration) |
| W-c | Bảng lỗi bị copy boilerplate, không khớp với loại workflow | D5, D6 |

### 5.3 Định hướng — cấp Workflow `[Đề xuất]`

| # | Workflow | Thay đổi | Ưu tiên |
|---|---|---|---|
| WF1 | testing | Sửa D5: dòng "Test fail" → "phân loại lỗi test/lỗi code; lỗi code → đề xuất `workflow-bugfix`". Bước 5 nhận "test lỗi-test đã xanh + danh sách lỗi-code đã chuyển" | P0 |
| WF2 | docs | Sửa D6: bỏ dòng Build/Test fail, thay bằng "Không áp dụng" như code-review đang làm | P0 |
| WF3 | db-change | Bước 2/3/6 chạy skill `backend-db-migration` qua agent `backend-implementer`; Bước 6 đổi "up → rollback → up" thành verify-cycle theo công cụ (§7.1.5 — Flyway forward-only không có rollback); **thêm bước Test** (backend-test-writer: integration Testcontainers cho repository/query); bước cuối cập nhật `data-model.md` và ghi migration contract còn nợ vào `next_actions` | P1 |
| WF4 | api | Thêm `engineering-quality-auditor` song song với drift-check (authz, input validation); Bước 5 → agent `frontend-data-integrator` | P1 |
| WF5 | feature | Bước 1: phạm vi có "đổi schema" thì dừng và đề xuất chuỗi `db-change` → `feature`. Thêm Bước 3b `frontend-data-integrator` (khi fullstack). Bước 4 thêm `frontend-e2e-test-writer` cho các AC dạng luồng UI. Bỏ `workflow-docs` khỏi cột "Nối tiếp" | P1–P2 |
| WF6 | testing | Chiến lược "luồng quan trọng: e2e" → `frontend-e2e-test-writer` | P1 |
| WF7 | security-review | Tập vùng rủi ro thêm **authorization/access control, SSRF, misconfiguration**; bắt buộc bước **rotate** khi phát hiện secret lộ (người dùng thực hiện); regression test qua test-writer | P1 |
| WF8 | release | Thêm Bước 0 "baseline build/test" và bước "kiểm migration chờ chạy + thứ tự migration/deploy" | P2 |
| WF9 | code-review | Nhóm "khác": auditor kiểm CI/IaC/SQL; diff đụng `docs/contracts` hoặc controller thì backend-reviewer kiểm drift | P2 |
| WF10 | orchestrator | Thêm dòng Registry: init project (`backend-init`/`frontend-init`), migrate config/secret (`backend-migrate-vault-consul`); cho phép chuỗi `db-change → api → feature` | P2 |
| WF11 | chung | Thêm "Bước 0 — Baseline" (chạy build/test, ghi số mốc) cho mọi workflow có sửa code (W-a) | P2 |
| WF12 | incident / performance | incident: thêm bước cập nhật trạng thái cho stakeholder + thang severity mặc định. performance: chờ G10; trục reviewer sau S4 | P3 |

---

## 6. Tổng quan thay đổi mới (đã chốt)

| Hạng mục | Loại | Plugin | Khớp roadmap | Agent bọc |
|---|---|---|---|---|
| `backend-db-migration` | skill | backend | Gộp G2 `backend-migrate-db` (2 chế độ `adopt`/`change`); ranh giới với `data-oltp-implement` — **đã chốt phương án A**, thiết kế đầy đủ ở §7.1 | `backend-implementer` (thêm vào `skills` ở pha publish) |
| `frontend-e2e-testing` | skill | frontend | G5 | `frontend-e2e-test-writer` (mới) |
| `frontend-data-integration` | skill | frontend | G1 | `frontend-data-integrator` (mới) |

Tên agent phải có prefix plugin (`test/validate.mjs:279`), nên "agent e2e" và "agent data-integration" được đặt
tên là `frontend-e2e-test-writer` và `frontend-data-integrator`.

---

## 7. Thiết kế skill mới

### 7.1 `backend-db-migration` (gộp G2 — phương án A, đã chốt 2026-09-29)

> **Cập nhật 2026-09-30 (ADR-0001, `docs/decisions/0001-database-capabilities-in-data-plugin.md`):** skill này nay
> thuộc plugin `data` với tên `data-db-migration`. Mọi đường dẫn `plugins/backend/skills/backend-db-migration/…` và
> tên `backend-db-migration` trong toàn bộ spec này đọc là `plugins/data/skills/data-db-migration/…` và
> `data-db-migration`. Nội dung thiết kế không đổi.

Gộp G2 `backend-migrate-db` (spec `2026-09-07-backend-migrate-db-design.md`, đã duyệt, chưa hiện thực) với năng
lực "viết một thay đổi schema" thành **một** skill có 2 chế độ. Chế độ `adopt` **giữ nguyên G2**: §3–§8 của spec
đó là nguồn sự thật cho template Spring Boot. Mục này chỉ ghi phần mới và phần khác so với G2.

#### 7.1.1 Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| M1 | Gộp hay tách với G2 | Gộp, 2 chế độ `adopt` / `change`. Đổi tên `backend-migrate-db` → `backend-db-migration` |
| M2 | Stack đợt này | **Chỉ Java/Spring Boot** (template Flyway + Liquibase của G2). Chế độ `change` viết trung tính công cụ nên vẫn hướng dẫn được Alembic, nhưng **không ship template Python**; SKILL.md nói rõ điều này. Template Alembic để đợt sau |
| M3 | Rollback với Flyway | **Forward-only.** An toàn dựa vào expand/contract; "rollback" = migration bù mới. Liquibase/Alembic vẫn chạy chu trình up → down → up |
| M4 | Publish | **Draft tới khi pilot** trên một project Spring thật (xem P-d ở §4.2) |
| M5 | Engine | Bảng rủi ro khoá chỉ viết cho **PostgreSQL** (engine của template G2). Engine khác → DỪNG, hỏi DBA |
| M6 | Ngưỡng "bảng lớn" | Không có ngưỡng mặc định; skill **hỏi** số dòng hoặc lấy từ ADR của project |

#### 7.1.2 Cấu trúc

```
plugins/backend/skills/backend-db-migration/
├── SKILL.md                              # Bước 0 chọn chế độ → adopt (7 bước G2) | change (cổng C1–C5)
└── references/
    ├── README.md                         # ở GỐC references/ — spring-boot/README.md đã bị vault-consul chiếm
    ├── adopt/inventory-checklist.md      # G2 §5 bước 2, không đổi
    ├── adopt/tool-comparison-rubric.md   # G2 §6, không đổi
    ├── change/change-patterns.md         # loại thay đổi → các pha expand / migrate data / contract
    ├── change/lock-risk-postgres.md      # thao tác nào khoá bảng, cách làm online
    ├── change/verify-cycle.md            # chu trình verify theo công cụ
    └── spring-boot/{common,flyway,liquibase}/   # template G2 §4 + §7, không đổi
```

#### 7.1.3 Bước 0 — chọn chế độ

| Dấu hiệu trong project | Đi tiếp |
|---|---|
| Chưa có công cụ migration (`ddl-auto=update`, DDL chạy tay) | `adopt` |
| Đã có Flyway/Liquibase/Alembic + yêu cầu đổi schema | `change` |
| Có `data-oltp-init`, hoặc schema là contract cho nhiều consumer | DỪNG → `data-oltp-implement` (plugin `data`) |
| Có cả hai dấu hiệu | DỪNG, hỏi người dùng |

Chế độ `adopt` = đúng 7 bước G2 §5 (gate cứng bước 4: chưa ghi file nào trước khi người dùng chọn công cụ).

#### 7.1.4 Chế độ `change` — cổng C1–C5

| Cổng | Nội dung | Đỏ khi → hành động |
|---|---|---|
| C1 Nhận diện | Công cụ + version (theo BOM), engine + version, thư mục migration, version mới nhất, quy ước đặt tên đang dùng | Không nhận diện được → DỪNG, đề xuất `adopt` |
| C2 Kế hoạch ⏸ | Mỗi thay đổi → một pattern ở `change-patterns.md` → các pha expand / migrate data / contract; rủi ro khoá; cỡ bảng (M6); pha nào vào PR này. Người dùng duyệt | Thao tác phá huỷ (drop, thu hẹp kiểu) chưa được xác nhận, hoặc code vẫn còn dùng (evidence grep) → DỪNG |
| C3 Viết | Chỉ thêm file mới; file migration đã có trên base branch là **bất biến**; đặt tên theo CONVENTIONS; đặt `lock_timeout`; backfill theo lô, tách migration riêng; Liquibase: mỗi changeSet có `rollback` | Sửa file đã có trên base → huỷ, viết file mới |
| C4 Verify ⏸ | Xác nhận DB đích là DB test (mask credential), rồi chạy chu trình ở §7.1.5. Ưu tiên DB tạm (Testcontainers/compose của project) | Không có DB test → `not_run` + lý do. Không bao giờ chạy trên production |
| C5 Bàn giao | Cập nhật `data-model.md`; pha contract còn nợ → `next_actions` kèm điều kiện kích hoạt; runbook prod (thứ tự, cửa sổ khoá, bước chạy ngoài transaction) | — |

#### 7.1.5 Verify-cycle theo công cụ (`change/verify-cycle.md`)

| Công cụ | Chu trình | Chứng minh |
|---|---|---|
| Flyway (M3) | (a) DB rỗng → migrate toàn bộ → `validate` · (b) DB ở version N-1 (migration của base branch) → migrate lên N · (c) app boot với `ddl-auto=validate` hoặc integration test xanh | Chạy được từ đầu và từ bản trước; migration bù nêu trong runbook |
| Liquibase | (a) + `update` → rollback k changeSet → `update` + (c) | Block rollback chạy được |
| Alembic / khác | `upgrade` → `downgrade -1` → `upgrade`; không có template (M2) | Reversible |

`[Unverified]` Tên lệnh rollback của Liquibase (CLI / Maven plugin) theo version — đối chiếu tài liệu trước khi viết
reference.

#### 7.1.6 Pattern tiêu biểu (`change/change-patterns.md` + `change/lock-risk-postgres.md`)

`[Unverified]` Toàn bộ hành vi khoá dưới đây phải đối chiếu tài liệu PostgreSQL theo version trước khi viết reference.

| Thay đổi | Cách làm an toàn |
|---|---|
| Thêm cột NOT NULL | Thêm nullable → backfill theo lô → `CHECK … NOT VALID` → `VALIDATE` → `SET NOT NULL` |
| Đổi tên cột | Thêm cột mới → ghi cả hai → backfill → chuyển đọc → drop cột cũ ở PR sau |
| Thêm index | `CREATE INDEX CONCURRENTLY`, chạy ngoài transaction (Flyway `.conf`, Liquibase `runInTransaction: false`); fail giữa chừng → drop index INVALID, chạy lại |
| Thêm FK | `NOT VALID` → `VALIDATE CONSTRAINT` ở bước riêng |
| Đổi kiểu cột | Coi như đổi tên (cột mới + backfill), trừ khi xác nhận được là không viết lại bảng |
| Drop cột/bảng | Chỉ ở pha contract, sau khi code bản đang chạy không còn dùng (evidence grep) + người dùng xác nhận |

#### 7.1.7 Frontmatter

```yaml
name: backend-db-migration
description: "<một dòng có ngoặc kép: 2 chế độ adopt/change + cụm kích hoạt VI+EN (migrate db, flyway, liquibase,
  công cụ migration, bỏ ddl-auto, quản lý schema, database migration, đổi schema, thêm cột, expand contract,
  schema change, migration an toàn) + câu phân ranh: KHÔNG dùng khi project đã chạy data-oltp-init>"
order: 9
stageNumber: "09"
title: "Backend DB Migration — Áp công cụ migration & viết thay đổi schema an toàn (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
```

`order: 9` vì 1–8 đã dùng. Không khai `sharedAssets` — skill không đọc blueprint kiến trúc.

#### 7.1.8 Ranh giới an toàn (SKILL.md)

- Không chạy migration lên DB nào khi chưa qua C4 (hoặc bước 7 của `adopt`); không bao giờ chạy trên production.
- Không kết nối DB, không chạy `pg_dump` khi chưa được cho phép; không đọc hay in secret, chỉ nêu tên biến.
- Không sửa file migration đã có trên base branch; không dùng `repair` / `clearChecksums` / `clean` để "cho qua".
- Thao tác phá huỷ chỉ sau xác nhận tường minh ở C2.
- Không ghim version công cụ đè BOM khi không có ADR (G2 P8).
- Làm trên branch riêng; dừng cho người duyệt diff trước khi commit (1 task = 1 commit).

#### 7.1.9 Kiểm chứng của kit

| Bước | Chứng minh |
|---|---|
| `npm run validate` | Frontmatter đúng; `order: 9` không trùng; path tương đối trong `references/` không trùng với skill backend khác |
| `npm run build` | Skill + `references/` có ở cả 4 provider |
| `npm test` | Không regression; test phụ thuộc `_published.json` dạng `"backend"` được cập nhật nếu có |
| `offeredCatalog` | Wizard **không** offer `backend-db-migration`; 8 skill backend cũ vẫn được offer |
| Sandbox `AIE_INSTALL_ROOT` | `aip install --skill backend-db-migration` cài được |
| Không có | Chạy template lên Postgres thật — việc của pilot (G2 §9). Không tuyên bố template "đã chạy được" |

#### 7.1.10 Các pha thực thi

| Pha | Nội dung | Điều kiện xong |
|---|---|---|
| M-P1 | `SKILL.md`: frontmatter + Bước 0 + `adopt` (7 bước) + `change` (C1–C5) + ranh giới an toàn | `npm run build` thấy skill ở 4 provider |
| M-P2 | `references/adopt/` (G2 §5–§6) | Rubric đủ 6 tiêu chí + cột bằng chứng |
| M-P3 | `references/change/` — đối chiếu tài liệu PostgreSQL/Liquibase trước, gỡ nhãn `[Unverified]` nào đã kiểm | Mỗi pattern có nguồn |
| M-P4 | `references/spring-boot/common/` (G2 P3) | `env.example` khớp đúng tập biến các yml tham chiếu |
| M-P5 ∥ M-P6 | `references/spring-boot/flyway/` ∥ `liquibase/` (G2 P4, P5) | Không có `@Configuration` tự viết; changeSet mẫu có `rollback` |
| M-P7 | `references/README.md` (G2 P6) | Đọc README là dựng được module |
| M-P8 | `_published.json`: `"backend"` → 8 mục `backend/<skill>` (chưa có db-migration); manifest backend liệt kê đủ skill (PL2); `npm test` | §7.1.9 xanh |
| M-P9 | Người duyệt diff → commit qua `core:git-workflow` | Người dùng duyệt |
| **Pha publish** (sau pilot) | Thêm `backend/backend-db-migration` vào `_published.json`; thêm skill vào `backend-implementer`; WF3 (`workflow-db-change`); S8 | Pilot có evidence chạy thật |

Tích hợp agent + workflow để ở pha publish vì nếu thêm skill draft vào `backend-implementer` sớm, agent sẽ được cài
qua wizard nhưng trỏ tới skill chưa cài.

### 7.2 `frontend-e2e-testing` (G5)

#### 7.2.1 Phạm vi

- **Làm:** test đầu-cuối bằng Playwright (`@playwright/test`, công cụ repo đã chọn ở
  `plugins/frontend/templates/architecture/references/testing-toolchain.md`) cho **3–5 luồng giá trị cao**, mỗi test
  map tới 1 acceptance criterion. Test đặt ở `e2e/` ngoài `src/`; với Micro-FE thì đặt ở gốc monorepo
  (`plugins/frontend/templates/architecture/react-micro-frontend.template.md`).
- **Không làm:** thay unit/integration (đó là `frontend-testing`); load test; test trên staging/production.

#### 7.2.2 Quy tắc bắt buộc

| # | Quy tắc |
|---|---|
| E-r1 | Selector theo role/label/text (`getByRole`, `getByLabel`), không dùng CSS class hay XPath |
| E-r2 | Không `waitForTimeout`/sleep cứng; dùng assertion tự chờ (`await expect(locator).toBeVisible()`) |
| E-r3 | `baseURL` lấy từ biến môi trường; chỉ nhận host local/test; từ chối staging/production |
| E-r4 | Credential lấy từ biến môi trường (chỉ nêu tên biến) và là tài khoản test; đăng nhập một lần qua setup project + `storageState` |
| E-r5 | Dữ liệu cô lập theo từng lần chạy (hậu tố duy nhất hoặc seed/cleanup riêng); không phụ thuộc thứ tự test |
| E-r6 | Evidence: `trace: 'on-first-retry'` + report HTML; chống flaky bằng `--repeat-each=3` |
| E-r7 | Thêm `@playwright/test` hoặc tải browser là thay đổi dependency → **hỏi trước** |

#### 7.2.3 Cổng

| Cổng | Nội dung | Đỏ khi → hành động |
|---|---|---|
| E1 Môi trường | FE chạy được (qua `webServer` hoặc lệnh của project); BE + DB test có sẵn (docker compose hoặc lệnh của project) | Thiếu BE/DB test → `not_run` + lý do; **không tự dựng hạ tầng** |
| E2 Chọn luồng ⏸ | Bảng luồng → AC → lý do không chứng minh được ở tầng thấp; người dùng duyệt | Đưa vào luồng mà unit/integration phủ được → loại |
| E3 Viết | Theo E-r1…E-r5 | — |
| E4 Ổn định | `npx playwright test --repeat-each=3` xanh | Flaky → sửa test (không nới assertion), chạy lại |
| E5 Bug thật | Test đỏ do hành vi sai → giữ nguyên đỏ, báo cáo, **không sửa code** | — |

### 7.3 `frontend-data-integration` (G1) — thiết kế đã duyệt 2026-09-29

#### 7.3.1 Phạm vi

- **Làm:** nối component đã dựng (bởi `frontend-implement`) với API **theo contract OpenAPI** ở `docs/contracts/`:
  dùng type sinh từ contract, tạo data hook, xử lý đủ 4 trạng thái loading/error/empty/success, map DTO sang
  view model ở biên, viết test bằng msw (qua `frontend-testing`).
- **Không làm:** đổi contract (lệch → DỪNG, báo drift, chuyển `backend-api-contract`); quyết định lưu token hay
  auth (→ ADR/security); thêm global store khi chưa hỏi; e2e (thuộc `frontend-e2e-testing`).

#### 7.3.2 Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| N1 | Publish thế nào | **Draft tới khi pilot**, cùng cách với M4: `_published.json` đổi `"frontend"` thành 6 mục `frontend/<skill>` hiện có, không có skill mới. Agent mới `frontend-data-integrator` tạo ngay được: installer chỉ đặt agent khi mọi skill của nó đã được chọn (`cli/lib/install.mjs:496-497`), nên agent không lộ ra khi skill còn draft. **Không** thêm agent vào workflow trước pha publish: installer ẩn workflow có closure chưa được offer (`install.mjs:349`) |
| N2 | Type sinh từ contract đặt ở đâu | Ở tầng shared: `lib/api/generated/` (Feature-Based), `shared/api/generated/` (FSD, và trong remote của Micro-FE). Mỗi `*.dto.ts` của feature chỉ là type alias chọn từ schema đã sinh (vd `components['schemas']['Invoice']`), không viết tay lại. Giữ tên `*.dto.ts` và chiều import `shared → features` của template |
| N3 | Công cụ khi project chưa có codegen | Đề xuất `openapi-typescript` (chỉ sinh type) cùng `api-client` và hook TanStack Query viết mỏng theo template. Chỉ **đề xuất và hỏi** ở cổng I2, không tự cài. Hành vi công cụ gắn `[Unverified]` cho tới khi đối chiếu tài liệu |
| N4 | Nối ở đâu | Ở **container/page**, không sửa presentational: Feature-Based tạo/sửa `*-container.tsx`; FSD tạo/sửa `ui` của widget hoặc page. Container gọi hook rồi đổ `props` xuống; chỗ `TODO` do `frontend-implement` để lại được thay bằng props thật. Presentational vẫn test được chỉ bằng render + props |
| N5 | Auth | Chỉ **map lỗi 401** thành trạng thái UI hoặc lỗi hook trả ra; không quyết định nơi lưu token, không viết luồng refresh |
| N6 | Tích hợp workflow | Để pha publish (§9 P1c): `workflow-api` (WF4), `workflow-feature` (WF5) |

#### 7.3.3 Cấu trúc

```
plugins/frontend/skills/frontend-data-integration/     order: 7, pipeline: false, sharedAssets: templates/architecture
├── SKILL.md                              # tiền đề + cổng I1–I5 + ranh giới an toàn + report
└── references/
    ├── contract-and-codegen.md           # contract → type/client; dò codegen sẵn có; N2, N3
    ├── data-layer-by-architecture.md     # đặt file theo Feature-Based / FSD / Micro-FE (bảng 7.3.4)
    └── states-and-errors.md              # 4 trạng thái; map lỗi 401/4xx/5xx; N5
plugins/frontend/agents/frontend-data-integrator.md   # §8.3
```

Path tương đối trong `references/` không được trùng với skill khác cùng plugin (`test/validate.mjs`, mục hygiene).

#### 7.3.4 Đặt code theo kiến trúc

| Kiến trúc | Client gốc | Type sinh (N2) | Đọc (query) | Ghi (mutation) | Map DTO → view model | Nối UI (N4) |
|---|---|---|---|---|---|---|
| Feature-Based | `lib/api-client.ts` | `lib/api/generated/` | `features/<x>/api/` | `features/<x>/api/` | `features/<x>/utils/to-*.ts` | `features/<x>/components/*-container.tsx` |
| FSD | `shared/api/` | `shared/api/generated/` | `entities/<x>/api/` | `features/<x>/api/` | segment `api` của slice | `ui` của `widgets/<x>` hoặc `pages/<x>` |
| Micro-FE | trong remote (theo FSD) | trong remote, `shared/api/generated/` | như FSD | như FSD | như FSD | như FSD |

Micro-FE: type sinh từ contract nằm trong **remote sở hữu miền**; `packages/contracts` chỉ chứa type ở biên
host↔remote + event bus, không chứa DTO backend. Bảng này lấy từ `plugins/frontend/templates/architecture/*.template.md`
(Feature-Based: cây `features/<x>/api`, `lib/api-client.ts`, `utils/to-invoice.ts`; FSD: bảng "Ranh giới state" và
"Implementation" — đọc ở `entities/<x>/api`, ghi ở `features/<x>/api`, client ở `shared/api`). Spec bản đầu ghi entity
lo CRUD; template FSD chia đọc/ghi như bảng trên, nên bảng này thay thế.

#### 7.3.5 Cổng

| Cổng | Nội dung | Đỏ khi → hành động |
|---|---|---|
| I1 Contract | Contract có trong `docs/contracts/`, đã qua drift-check | Chưa có hoặc đang drift → DỪNG, đề xuất `workflow-api` / `backend-api-contract` |
| I2 Công cụ ⏸ | Dò codegen (openapi-typescript/orval/openapi-generator) và thư viện data (TanStack Query/SWR/RTK Query) **đã có** thì dùng lại | Chưa có → đề xuất (N3) + hỏi; thư viện data mới → ADR |
| I3 Không viết tay | Type/client sinh từ contract (N2); component không gọi `fetch`/`axios` trực tiếp | Vi phạm → sửa |
| I4 Trạng thái | Mỗi màn hình có đủ loading/error/empty/success; map lỗi 401/4xx/5xx (N5) | Thiếu → bổ sung |
| I5 Xanh | `tsc --noEmit`, lint (gồm boundary), build; test msw (qua `frontend-testing`) | Đỏ → sửa |

#### 7.3.6 Kiểm chứng của kit

| Bước | Chứng minh |
|---|---|
| `npm run validate` | Frontmatter đúng, `order: 7` không trùng, mọi link `references/` trong `SKILL.md` có file thật, agent có đủ 4 heading và `skills` trỏ đúng skill, `SKILL.md` chứa đủ cổng I1–I5 |
| Assert manifest | Description manifest `frontend` liệt kê skill mới (assert mục 10 đã đòi mọi skill có tên trong description) |
| `install.test.mjs` | Skill có trong `skillCatalog`, **không** có trong `offeredCatalog`; wizard vẫn offer đúng 6 skill frontend cũ |
| Sandbox `AIE_INSTALL_ROOT` | `aip install --skill frontend/frontend-data-integration` cài được; agent `frontend-data-integrator` chỉ xuất hiện khi skill được cài |
| Không có | Chạy trên project React thật — việc của pilot. Không tuyên bố skill "đã chạy được" |

#### 7.3.7 Các pha thực thi

| Pha | Nội dung | Điều kiện xong |
|---|---|---|
| DI-P1 | `SKILL.md` + gate draft (`_published.json` 6 mục lẻ) + manifest `1.3.0` + assert draft ở `install.test.mjs` | `npm test` xanh; wizard không offer skill mới |
| DI-P2 | 3 file `references/` (đối chiếu template và tài liệu công cụ trước khi viết) | Link hợp lệ; nhận định công cụ có nguồn hoặc nhãn `[Unverified]` |
| DI-P3 | Agent `frontend-data-integrator` (§8.3) + assert agent | Agent qua contract `validate.mjs`; không lộ khi skill chưa cài |
| **Pha publish** (publish không chờ pilot, 2026-09-30) | Thêm `frontend/frontend-data-integration` vào `_published.json`; WF4, WF5; sửa `principles.md:14,41` (`state-model` treo) và thêm pointer từ `frontend-implement` sang skill này | Pilot có evidence chạy thật — miễn pilot (quyết định 2026-09-30, §12) |

---

## 8. Plan thiết kế agent

### 8.1 Catalog sau nâng cấp (11 → 15)

| Agent | Plugin | Mode | Skills | Workflow dùng | Thay đổi |
|---|---|---|---|---|---|
| backend-implementer | backend | write | `backend-implement,backend-api-contract,`**`backend-db-migration`** | feature, api, **db-change** | + skill (pha publish §7.1.10) |
| backend-test-writer | backend | write | backend-testing | feature, bugfix, api, testing, refactor, **db-change** | + workflow |
| backend-reviewer | backend | read-only | backend-code-review, backend-api-contract | … | trục performance (S4) |
| frontend-implementer | frontend | write | frontend-implement | feature | — |
| frontend-test-writer | frontend | write | frontend-testing | … | — |
| frontend-reviewer | frontend | read-only | frontend-code-review | … | — |
| **frontend-e2e-test-writer** | frontend | write | frontend-e2e-testing | feature, testing, release (smoke) | **mới** — đã publish 2026-09-30 (không chờ pilot); workflow: feature, testing, release (smoke trước deploy) |
| **frontend-data-integrator** | frontend | write | frontend-data-integration | feature, api | **mới** — đã publish 2026-09-30 (không chờ pilot); workflow: feature, api |
| engineering-spec-analyst | engineering | write | spec-writing, adr, diagram | … | sửa D11 |
| engineering-quality-auditor | engineering | read-only | quality-gate, convention-enforce | …, **api** | + workflow |
| engineering-release-scribe | engineering | write | release-notes | release | — |
| ops-incident-investigator | ops | read-only | ops-incident-troubleshooting, ops-observability | incident | — |
| ops-release-engineer | ops | read-only | ops-deploy-release, ops-observability | release | — |
| **backend-fixer** | backend | write | backend-fix | bugfix, security-review, performance | **mới** (A4, spec 2026-09-30) |
| **frontend-fixer** | frontend | write | frontend-fix | bugfix, security-review, performance | **mới** (A4, spec 2026-09-30) |

Cột `skills` lấy từ frontmatter thật trong `plugins/*/agents/*.md`. Cột Mode lấy theo `disallowedTools` của bản cài.

### 8.2 `frontend-e2e-test-writer`

```markdown
---
name: frontend-e2e-test-writer
description: "Agent chỉ viết test END-TO-END (Playwright) cho vài luồng người dùng giá trị cao theo skill frontend-e2e-testing: map mỗi test tới một acceptance criterion, selector theo role/label, không sleep cứng, chạy --repeat-each=3 để loại flaky, chỉ trên môi trường local/test. Test đỏ vì bug thật thì giữ đỏ và báo, không sửa code production. Dùng khi workflow cần kiểm luồng xuyên FE→BE→DB."
mode: write
skills: "frontend-e2e-testing"
---

## Vai trò
Viết và ổn định e2e test cho các luồng đã được duyệt, làm lưới an toàn xuyên tầng khi FE nối API thật.

## Phạm vi
- Được: tạo/sửa file trong `e2e/`, `playwright.config.*`, fixture/seed dưới `e2e/`; chạy Playwright lấy evidence.
- Không được: sửa `src/` production; trỏ `baseURL` vào staging/production; dùng hay in credential thật; thêm
  dependency hoặc tải browser khi chưa hỏi; gọi agent khác; commit.
- Thiếu BE/DB test để chạy → `not_run` + `reason`, không tự dựng hạ tầng.

## Quy trình
1. Đọc skill `frontend-e2e-testing`, acceptance criteria (`docs/requests/…`), kiến trúc UI; dò Playwright config
   và lệnh chạy FE/BE thật của project.
2. Lập bảng luồng → AC → lý do cần e2e; trình để duyệt (E2).
3. Viết test theo E-r1…E-r5; đăng nhập qua setup project + `storageState`.
4. Chạy `npx playwright test --repeat-each=3`; flaky → sửa test, không nới assertion.
5. Test đỏ vì hành vi sai → giữ đỏ đúng lý do, ghi trace, báo cáo.

## Report trả về
- Bảng test ↔ AC (`file:line`); test giữ đỏ vì bug thật + lý do + đường dẫn trace.
- Evidence theo contract (`command`, `exit_code`, `status`, `summary`); không chạy được → `not_run` + `reason`.
- `remaining_risks`: luồng chưa phủ, phụ thuộc dữ liệu seed, biến môi trường cần có.
```

### 8.3 `frontend-data-integrator`

```markdown
---
name: frontend-data-integrator
description: "Agent nối UI React đã dựng với API THẬT theo contract OpenAPI (skill frontend-data-integration): dùng type sinh từ docs/contracts bằng codegen sẵn có của project, tạo data hook đúng tầng kiến trúc (Feature-Based/FSD/Micro-FE), nối ở container/page (không sửa presentational), xử lý loading/error/empty/success, map DTO→view model ở biên. Không đổi contract; lệch contract thì dừng và báo drift. tsc/lint/build phải xanh trước khi trả. Dùng khi workflow cần nối data cho màn hình đã có."
mode: write
skills: "frontend-data-integration"
---

## Vai trò
Hiện thực tầng data cho component đã có, bám contract làm nguồn sự thật FE↔BE.

## Phạm vi
- Được: dùng/cập nhật type sinh từ contract bằng codegen sẵn có; tạo/sửa data hook và tầng `api/` đúng vị trí
  kiến trúc; tạo/sửa container hoặc page để gọi hook rồi đổ `props` xuống, thay chỗ `TODO` bằng props thật; chạy
  tsc/lint/build/test.
- Không được: sửa `docs/contracts/`; viết tay type trùng với contract; gọi `fetch`/`axios` trong component; sửa
  presentational ngoài việc thay `TODO` bằng props đã có sẵn kiểu; thêm thư viện data, codegen hoặc global store
  khi chưa hỏi; quyết định lưu token/auth; sửa file ngoài feature được giao; gọi agent khác; commit.

## Quy trình
1. Đọc skill `frontend-data-integration`, `project-knowledge/architecture.md`, contract liên quan.
2. Kiểm I1 (contract có và không drift) → không đạt thì dừng, báo.
3. Dò codegen và thư viện data sẵn có (I2); chưa có → dừng, đề xuất, chờ người dùng chọn.
4. Dùng type sinh từ contract; viết hook đúng tầng; nối ở container/page; đủ 4 trạng thái (I3, I4).
5. Chạy `tsc --noEmit`, lint, build (I5); ghi lệnh + kết quả thật.

## Report trả về
- File đã thêm/sửa theo tầng; endpoint ↔ hook ↔ container.
- Evidence theo contract đầu ra trong `core:principles`; phần không chạy được → `not_run` + `reason`.
- `remaining_risks`: endpoint chưa nối, trạng thái chưa có test msw, giả định về xử lý lỗi/auth.
```

### 8.4 Checklist contract cho mọi agent mới (`test/validate.mjs:275-286`)

- [ ] `name` trùng tên file; prefix `<plugin>-`; không chứa `:`
- [ ] `mode` ∈ {read-only, write}; `skills` không rỗng và mọi skill tồn tại trong catalog
- [ ] Có đủ 4 heading: `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`
- [ ] `description` > 10 ký tự; id duy nhất toàn cục

### 8.5 Cải tiến agent hiện có `[Đề xuất]`

| # | Hành động | Lý do |
|---|---|---|
| A1 | Mọi agent trỏ contract qua `core:principles` (sau PL1) thay vì "schema spec §5.1" | Agent trong project đích không đọc được design spec |
| A2 | Sửa D11 ("cả hai" → "ba") | Nhất quán nội bộ |
| A3 | Workflow có test-writer: thêm gate "`git diff --name-only` của bước test chỉ chứa file test/e2e" | Mode `write` sinh `disallowedTools` theo mode (`adapters/_shared/agents.mjs:19`), `[Inference]` nên không chặn được theo đường dẫn. Cần một cổng kiểm diff thay thế |
| A4 | (Q2) Các bước sửa code ở session chính (W-b) chuyển sang `backend-implementer`/`frontend-implementer` | Khoá phạm vi bằng agent thay vì bằng lời văn |

---

## 9. Lộ trình

Mỗi task = 1 branch + 1 commit (theo `AGENTS.md`), người duyệt diff trước khi merge.

| Pha | Nội dung | Mục | Trạng thái (2026-09-30) |
|---|---|---|---|
| **P0 — Sửa lỗi nội dung** | D1, D2, D3, D4, D5, D6, D11; PL1 (ship §5.1), PL2 (manifest) | S1–S3, WF1, WF2, A1, A2 | ✅ merge `2619be9` |
| **P1 — Năng lực mới** | ~~ADR phân ranh `backend-db-migration` ↔ `data-oltp-implement` (Q5)~~ (xong: ADR-0001, skill nay là `data-db-migration`); `backend-db-migration` theo §7.1.10 (M-P1–M-P9, draft); `frontend-data-integration` theo §7.3.7 (DI-P1–DI-P3, draft); `frontend-e2e-testing` theo §7.2; 2 agent frontend theo §8.2–§8.3; S4, S7 | §7, §8 | ✅ merge `48f90d0`, `a609735`, `482c50b`; S7 xong trên nhánh `feature/spec-followups` |
| **P1b — Publish db-migration** (sau pilot, Q6) | Pha publish của §7.1.10: `_published.json`, thêm skill vào `backend-implementer`, S8; WF3 đi cùng | §7.1.10, WF3 | ⏳ chờ pilot (Q6) |
| **P1c — Publish frontend-data-integration** (publish không chờ pilot, 2026-09-30) | Pha publish của §7.3.7: `_published.json`, WF4, WF5, sửa `principles.md:14,41`, pointer từ `frontend-implement` | §7.3.7, WF4, WF5 | ✅ publish không chờ pilot (2026-09-30), merge `d0cc23f` |
| **P2 — Nối vào workflow** | WF3–WF7 (db-change, api, feature, testing, security-review); WF8–WF11 | §5.3 | ◐ WF4–WF11 xong; WF3 phần dùng skill còn chờ P1b |
| **P3 — Phần còn lại** | WF12; G10 performance; A3, A4; S5, S6 | — | ◐ merge `1d8b42f`, `0a22df5`, `909f1b9`; A4 xong (spec 2026-09-30-fixer-agent-design); G10 backend xong, merge `16a8064`; frontend performance còn mở |

Ký hiệu: ✅ xong · ◐ xong một phần · ⏳ chờ pilot · ☐ chưa làm. Chi tiết từng mục ở §13.

---

## 10. Kiểm chứng

| Bước | Lệnh / cách làm | Chứng minh |
|---|---|---|
| Contract source | `npm run validate` | Agent/skill/workflow mới đúng contract (§8.4) |
| Build 4 provider | `npm run build` | Skill + `references/` được chiếu ra `build/<provider>/` |
| Toàn bộ | `npm test` | Không regression installer/wizard/managed-block/pack-guard |
| Gói npm | `npm run pack:verify` | Tập file publish nằm trong allowlist (liên quan Q4) |
| Smoke | `aip install` trong sandbox `AIE_INSTALL_ROOT` | Agent mới xuất hiện; workflow resolve được agent |
| Client thật | `/agents` trong Claude Code | `[Unverified]` cho tới khi chạy thật (như spec 2026-09-25 §10) |
| Hành vi | Chạy thử `workflow-db-change`, `workflow-feature` (fullstack) trên project mẫu | Gate mới thật sự chặn đúng. Chỉ đánh giá được khi chạy thật |

---

## 11. Quyết định cần chốt

| # | Câu hỏi | Khuyến nghị / Trạng thái |
|---|---|---|
| ~~Q1~~ | ~~`backend-db-migration` gộp với G2 `backend-migrate-db` (2 chế độ) hay tách riêng?~~ | **Đã chốt (2026-09-29): gộp, phương án A.** Các câu hỏi kế thừa đã chốt ở §7.1.1: publish sau pilot (M4), không có ngưỡng bảng lớn mặc định (M6), template Alembic để đợt sau (M2) |
| ~~Q2~~ | ~~Bước sửa code ở session chính (W-b) có chuyển sang agent implementer không?~~ | **Đã chốt (2026-09-30): spec `2026-09-30-fixer-agent-design.md`** |
| Q3 | Môi trường e2e (BE + DB test) do ai cung cấp? | Project tự cung cấp (compose/lệnh); agent chỉ `not_run` khi thiếu |
| Q4 | Skill frontend mới publish ngay (cả plugin) hay publish từng phần sau smoke? | Từng phần (`frontend/<skill>`) — cùng nguyên tắc với M4. Lưu ý P-d: chỉ gate được wizard |
| ~~Q5~~ | ~~Plugin `data`: giữ draft hay publish nhánh OLTP để tránh trùng với `backend-db-migration`?~~ | **Đã chốt (2026-09-30, ADR-0001):** mọi năng lực liên quan database thuộc plugin `data`; skill chuyển sang `data-db-migration`; plugin `data` vẫn draft, quy tắc phân ranh §7.1.3 giữ nguyên trong cùng plugin |
| Q6 | Pilot `backend-db-migration` trên project Spring nào? | Chưa chốt. G2 từng nêu `be-directive-mgt` (đã hoãn ở G2 Q2) |
| Q7 | Pilot `frontend-data-integration` trên project React nào (cần contract OpenAPI thật ở `docs/contracts/`)? | Không chặn publish nữa (publish 2026-09-30); pilot vẫn nên làm để kiểm nội dung |

## 12. Rủi ro còn lại

- `[Unverified]` Chưa đọc `references/*.md` của các skill hiện có; đánh giá độ sâu dựa trên SKILL.md.
- `[Inference]` Mức tuân thủ gate và contract của model chỉ đo được khi chạy workflow thật; CLI không kiểm được.
- `[Unverified]` Chi tiết theo công cụ ở §7.1.5–§7.1.6 (hành vi khoá của PostgreSQL, lệnh rollback Liquibase, undo
  của Flyway) phải kiểm lại tài liệu công cụ trước khi viết vào reference (M-P3).
- Trước khi WF3 xong, `workflow-db-change` Bước 6 vẫn đòi "up → rollback → up", không làm được với Flyway
  forward-only (M3). Skill ở dạng draft nên chưa có người dùng qua wizard gặp mâu thuẫn này.
- `[Unverified]` `openapi-typescript` (N3) và hành vi codegen: chưa đối chiếu tài liệu, chưa chạy trên project thật; phải kiểm trước khi viết `contract-and-codegen.md` (DI-P2).
- `[Inference]` Nối ở container/page (N4) giả định `frontend-implement` để lại chỗ trống bằng `props` + `TODO`; project dựng UI bằng cách khác có thể cần điều chỉnh.
- Thêm 2 agent và các bước song song làm tăng token cho mỗi lần chạy workflow.
- Điểm số là đánh giá có lập luận, không phải đo lường; Codex có thể chấm khác trên cùng bằng chứng.
- `[Inference]` §7.1.10 và §8.1 thêm `data-db-migration` (plugin `data`) vào `backend-implementer` (plugin `backend`):
  đây là tham chiếu skill chéo plugin. Chưa kiểm installer có cài kèm skill của plugin khác theo agent hay không
  (ADR-0001, mục Hệ quả). Phải kiểm trước pha publish P1b.
- Publish `frontend-data-integration` và `frontend-e2e-testing` không chờ pilot (2026-09-30, lần thứ hai làm trái Q4 sau F-Q3 của spec fixer); chất lượng nội dung chưa kiểm trên project thật. `frontend-data-integration` giả định `frontend-implement` để lại `props` + `TODO`.

## 13. Tiến độ & việc còn lại (kiểm trên source 2026-10-01, `master` = `16a8064`)

### 13.1 Đã xong

| Mục | Merge | Commit chính |
|---|---|---|
| P0: S1–S3, D4, PL2 | `2619be9` | `f3fc470` |
| P0: PL1, A1 | `2619be9` | `e4108aa` |
| P0: WF1, WF2, A2 | `2619be9` | `5424e36`, `548b01b` |
| `backend-db-migration` M-P1–M-P9 (draft) | `48f90d0` | `ae1d7a5` … `11dc5c7` |
| `frontend-data-integration` DI-P1–DI-P3 + agent (draft) | `a609735` | `b12fb8f`, `721399f`, `980f9ca` |
| `frontend-e2e-testing` + agent (draft) | `a609735` | `6315615`, `27bfc3b`, `e832d11`, `c118999` |
| S4 (trục performance) | `a609735` | `626db7b` |
| WF7 (security-review) | `a609735` | `f6b3364` |
| WF4 phần auditor song song | `a609735` | `0d960c5` |
| WF3 phần Test + data-model | `a609735` | `3f3841b` |
| ADR-0001: chuyển sang `data-db-migration` | `482c50b` | `8a98313`, `204c058`, `09bd539` |
| S5, S6 | `1d8b42f` | `c54b562` |
| WF9 (code-review) | `1d8b42f` | `c1f206c` |
| WF8 (release) | `1d8b42f` | `b69297a` |
| WF10 (orchestrator) | `1d8b42f` | `874095d`, `aeeb45f` |
| WF3 phần verify theo công cụ | `0a22df5` | `4bb17a2` |
| A3 (gate diff chỉ file test) | `0a22df5` | `05a79e0`, `e4ff661` |
| WF12 phần incident | `0a22df5` | `f27042d` |
| Ánh xạ vùng rủi ro security-review ↔ quality-gate | `0a22df5` | `bd1cfb4` |
| WF11 (Bước 1 Baseline) | `0a22df5` | `1baa5f9`, `aa93f8d`, `9db78d8`, `e4ff661` |
| A4/Q2: fixer agent | `909f1b9` | `d0e17ce`, `8fa1c13`, `875c430`, `b017350`, `534d379`, `6db2c11`, `d7b1e0d`, `fca093e`, `938349f`, `528ec4f` |
| S7, P1c, WF4, WF5, WF6 | `d0cc23f` | `5b314a3`, `0282bc6`, `b5da76a`, `57dab44`, `7c56037`, `cdaa27d`, `71b7a02`, `f8f2ac6` |
| G10 (backend) | `16a8064` | `21ee797`, `c32b42b`, `7b2f8cc`, `c6870ec`, `336c49f`, `71f2cb6`, `ce647d4`, `5ff2c8d`, `ab63691`, `d91176b` |
| e2e smoke ở release (Bước 5, trước deploy) | nhánh `feature/release-e2e-smoke` | (xem git log) |

### 13.2 Còn lại

| Mục | Hiện trạng (bằng chứng) | Chặn bởi |
|---|---|---|
| S8 | `plugins/backend/skills/backend-implement/SKILL.md:78` trỏ chung "`data` nhánh OLTP / recipe migration" | Nên đi cùng P1b |
| P1b | `plugins/_published.json` và `package.json` `files` chưa có `data` | Q6 (pilot); rủi ro chéo plugin ở §12 |
| WF3 phần dùng skill | `workflows/db-change/WORKFLOW.md` Bước 3: file migration vẫn ở session chính | P1b |
| Frontend performance (Web Vitals/Lighthouse/React Profiler/bundle) | `workflow-performance` Bước 2/3/5 phía FE chỉ có câu chờ | Chưa có spec (G-Q8 của spec 2026-09-30-backend-performance-design) |
