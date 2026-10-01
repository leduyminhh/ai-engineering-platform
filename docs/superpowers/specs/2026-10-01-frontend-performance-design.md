# Thiết kế: Skill `frontend-performance` + agent `frontend-performance-analyst` — đo và profile frontend cho `workflow-performance`

- Ngày: 2026-10-01
- Trạng thái: **Đã duyệt và thực thi (2026-10-01)**.
- Phạm vi: phần **frontend** của G10 (spec backend
  [`2026-09-30-backend-performance-design.md`](2026-09-30-backend-performance-design.md) §8 G-Q8; spec
  [`2026-09-29-skill-plugin-workflow-upgrade-design.md`](2026-09-29-skill-plugin-workflow-upgrade-design.md) §13.2):
  thay các câu chờ "Phía FE: chưa có skill đo/profile frontend" ở `workflow-performance` Bước 2, 3, 5 bằng agent có
  hợp đồng riêng.
- Người duyệt: chủ dự án.
- Nền: spec backend-performance (khung: một skill hai chế độ `measure`/`profile`, cổng P1–P5, bảng điều kiện đo chốt
  ở Bước 2 với mốc `git hash-object`, agent `mode: write` chỉ ghi `perf/`/`bench/`); spec fixer (Bước 4 do
  `frontend-fixer` chế độ `performance`).
- Thứ tự: làm **sau** spec `2026-10-01-data-migration-writer-design.md` (số agent trong README: 17 → 18).

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: đọc file hoặc grep, có `file:dòng` hay tên bước đi kèm |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng (tài liệu công cụ bên ngoài, hành vi trình duyệt thật) |
| `[Đề xuất]` | Quyết định thiết kế chờ duyệt |

Số bước trích theo `master` = `1538852`.

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

`workflows/performance/WORKFLOW.md` Bước 2, 3, 5 chỉ có agent cho phía backend; phía frontend mang câu "Phía FE: chưa có
skill đo/profile frontend — session chính đo theo công cụ sẵn có của project, ghi `[giả định]`…" ở cả ba bước. Hệ quả:
phía FE chạy ở session chính, không có bảng điều kiện đo, không có gate diff, không có mốc hash cho Bước 5.

### 1.2 Khác biệt cần tính đến so với backend

- **Đo trên bản build production**, không phải dev server: dev server (HMR, source map, React dev build) cho số đo vô nghĩa.
  Bước 5 phải build lại và phục vụ bản mới ở local trước khi đo.
- **Chỉ số lab, không phải số người dùng thật:** Lighthouse CLI đo lab (LCP, TBT, CLS); **INP không đo được trong lab** —
  dùng TBT làm chỉ số thay thế và nói rõ. Chỉ số người dùng thật (RUM) ngoài phạm vi.
- **Kích thước bundle** là chỉ số xác định (không nhiễu như latency): lấy từ output build/stats.
- **Công cụ đo mở trình duyệt:** Lighthouse CLI cần Chrome cài trên máy; thêm công cụ là thay đổi dependency → hỏi trước.
- **Không gửi URL cho dịch vụ bên thứ ba** (PageSpeed Insights, WebPageTest công cộng): đó là dữ liệu ra ngoài máy.

### 1.3 Mục tiêu & tiêu chí thành công

1. Bước 2/3/5 phía FE có `Thực hiện: agent frontend-performance-analyst` với hợp đồng riêng; câu chờ biến mất.
2. Bước 5 dùng lại script + bảng điều kiện của Bước 2 cho cả hai phía; mốc hash bao phủ cả hai phía.
3. Agent đo/profile, không sửa code; sửa vẫn là `frontend-fixer` (Bước 4).
4. Không đánh số lại bước (7 bước); `workflow-performance` vẫn được wizard offer.
5. `npm test` xanh; assert mới trong `validate.mjs`.

---

## 2. Quyết định đã chốt (2026-10-01)

| # | Câu hỏi | Quyết định |
|---|---|---|
| E-Q1 | Làm tới đâu? | **(a) Đối xứng G10:** skill `frontend-performance` + agent `frontend-performance-analyst` + nối workflow + publish cùng đợt. |
| E-Q2 | Công cụ mặc định | Lighthouse CLI (số đo lab) + kích thước bundle từ build; profile bằng React Profiler, bundle analyzer, Chrome performance trace. Ưu tiên thứ project đã có; thêm tool → hỏi trước. |
| E-Q3 | Publish | Cùng đợt nối workflow, không chờ pilot (như `backend-performance`). |

---

## 3. Skill `frontend-performance`

### 3.1 Vị trí & frontmatter

```text
plugins/frontend/skills/frontend-performance/SKILL.md
plugins/frontend/skills/frontend-performance/references/
  measure-conditions.md
  serve-production-build.md
  lighthouse-cli.md
  bundle-analysis.md
  profiling-react.md
  chrome-trace.md
```

Frontmatter: `name: frontend-performance`, `order: 10` (frontend đang dùng 1–9), `stageNumber: "10"`, `runsIn: execute`,
`invoke: per-request`, `pipeline: false`, `next: null`. Tên file `references/` không trùng skill khác trong plugin
(`test/validate.mjs:244-252`; `measure-conditions.md` đã tồn tại ở plugin `backend` — hygiene chỉ kiểm trong cùng plugin).
Description tiếng Việt, trigger: "đo hiệu năng frontend", "Lighthouse", "LCP", "bundle size", "profile React", "render
chậm", "trang tải chậm" — kèm "KHÔNG sửa code (đó là `frontend-fix`); KHÔNG thay test đúng/sai (đó là
`frontend-testing`/`frontend-e2e-testing`)".

### 3.2 Ranh giới với skill lân cận

| Skill | Việc |
|---|---|
| `frontend-testing`, `frontend-e2e-testing` | test đúng/sai |
| **`frontend-performance`** | **đo số** (lab) + **tìm bottleneck**; không sửa code |
| `frontend-fix` chế độ `performance` | sửa theo giả thuyết; không tự kết luận nhanh hơn |
| `frontend-code-review` | đọc diff; không đo |
| `backend-performance` | phía backend của cùng workflow |

### 3.3 Chế độ `measure` (Bước 2 và Bước 5)

1. Chốt **bảng điều kiện đo** (`references/measure-conditions.md`): route/luồng, build (commit SHA + `git diff --name-only`),
   cách phục vụ bản build production ở local (lệnh, port), preset thiết bị + throttle của Lighthouse, trạng thái cache
   (lạnh/ấm), số lần lặp, công cụ + phiên bản (lấy từ output lệnh), ngưỡng độ lệch (mặc định 10%), Config tool đo.
2. Viết/tái dùng script ở `perf/` (Lighthouse CLI qua lệnh hoặc script Node) và cách lấy kích thước bundle. Chọn công cụ
   project đã có; thiếu → đề xuất mặc định và **hỏi trước** (chạy như subagent: trả `blocked` + câu hỏi).
3. Chạy **≥ 3 lần** trên **bản build production** phục vụ ở local; ghi **median** LCP, TBT, CLS (+ điểm Performance nếu cần)
   và kích thước bundle (tổng + chunk lớn nhất); báo độ lệch.
4. Ở Bước 5: build lại + phục vụ lại từ working tree, xác nhận là bản mới (hash file build/tên chunk khác baseline),
   rồi chạy lại **nguyên trạng** script + bảng điều kiện của Bước 2. Điều kiện lệch → từ chối so sánh. Bảng điều kiện và
   script chốt ở cuối Bước 2; sau đó không sửa — cần đổi điều kiện thì quay lại Bước 2 đo lại baseline.

Ghi rõ trong report: Lighthouse đo lab, **không** phản ánh INP; TBT là chỉ số thay thế.

### 3.4 Chế độ `profile` (Bước 3)

Thứ tự rẻ → đắt, dừng ở tầng có evidence:

1. **Bundle:** bundle analyzer / stats build — chunk lớn, dependency nặng, code trùng, thiếu code-splitting
   (`references/bundle-analysis.md`).
2. **Render:** React Profiler — component render nhiều/lâu, commit thừa (`references/profiling-react.md`).
3. **Main thread:** Chrome performance trace — long task, layout/style thrash, script evaluation
   (`references/chrome-trace.md`).

Đầu ra: bottleneck + evidence (số đo, `file:line` hoặc tên chunk/component), giả thuyết, danh sách file/hàm đề xuất sửa
cho `frontend-fix`. Lệnh/config bật profiler ghi vào **report Bước 3** (hoặc `perf/profile-<luồng>.md`), không ghi vào
bảng điều kiện của Bước 2.

### 3.5 Cổng P1–P5

| Cổng | Nội dung | Đỏ thì |
|---|---|---|
| P1 Môi trường | Chỉ chạy trên local/test; URL staging/production hoặc site công khai, hay dịch vụ đo của bên thứ ba → từ chối | Thiếu môi trường (không có Chrome, không build được) → `not_run` + lý do |
| P2 Điều kiện đo | Bảng điều kiện đầy đủ TRƯỚC khi chạy; Bước 5 dùng lại bảng Bước 2 | Thiếu mục → dừng (subagent: `blocked` + câu hỏi) |
| P3 Ổn định | ≥ 3 lần; độ lệch median LCP/TBT giữa các lần > 10% (mặc định) → cảnh báo, không kết luận; kích thước bundle so trực tiếp (xác định) | Tăng số lần lặp hoặc cô lập nhiễu |
| P4 Evidence | Giả thuyết có evidence đo được; không chỉ suy từ đọc code | Profile thêm |
| P5 Phạm vi ghi | Chỉ ghi `perf/`, `bench/`, config tool đo đã liệt kê ở hàng Config tool đo; thêm tool/dependency → hỏi trước; không sửa `src/`, không sửa test | Gỡ thay đổi ngoài phạm vi |

### 3.6 Ranh giới an toàn

- Không đo trên dev server; không trỏ vào URL ngoài local/test; không gửi URL/trace ra dịch vụ ngoài; không dùng hay in
  credential thật (đăng nhập cho luồng cần auth: tài khoản test qua biến môi trường).
- Không sửa code; phát hiện bottleneck → chỉ đề xuất danh sách file cho `frontend-fix`.
- Ngôn ngữ đo được: báo số và lệnh thật; không "nhanh hơn rõ rệt"; luôn nêu residual risk (nhiễu máy local, một thiết bị
  giả lập, lab ≠ người dùng thật).
- Mọi lệnh/cờ chưa đối chiếu tài liệu chính thức gắn `[Unverified]`.

---

## 4. Agent `frontend-performance-analyst`

### 4.1 Vị trí & frontmatter

`plugins/frontend/agents/frontend-performance-analyst.md`; `mode: write`; `skills: "frontend-performance"`; 4 heading
(contract `validate.mjs:~276-286`). Catalog agent 17 → **18** (sau spec data-migration-writer).

### 4.2 Nội dung (bản để hiện thực)

```markdown
---
name: frontend-performance-analyst
description: "Agent đo và profile hiệu năng FRONTEND theo skill frontend-performance: chế độ measure chốt bảng điều kiện đo, build và phục vụ bản production ở local, chạy Lighthouse/đo bundle ≥3 lần, ghi median LCP/TBT/CLS, kích thước bundle và độ lệch; chế độ profile tìm bottleneck theo thứ tự bundle → render (React Profiler) → main thread (trace) có evidence và đề xuất danh sách file cho frontend-fixer. Chỉ ghi perf/, bench/ và config tool đo; không sửa code hay test; chỉ chạy trên local/test. Dùng khi workflow-performance cần Baseline, Profile hoặc Benchmark cho phía frontend."
mode: write
skills: "frontend-performance"
---

## Vai trò
Đo và profile hiệu năng frontend, cho ra số đo tái lập được và bottleneck có evidence. Không sửa code, không kết luận tối
ưu có hiệu quả ngoài bảng số; Lighthouse là số lab, không phải INP.

## Phạm vi
- Được: ĐỌC không giới hạn (code, config, `project-knowledge/`); tạo/sửa file trong `perf/`, `bench/` và config tool đo đã
  liệt kê ở hàng Config tool đo; build và phục vụ bản production ở local; chạy Lighthouse, bundle analyzer, profiler, trace.
- Không được: sửa `src/` hay file test; đo trên dev server; trỏ vào URL staging/production/site công khai hoặc gửi URL/trace
  cho dịch vụ bên ngoài; dùng hay in credential thật; thêm tool/dependency khi chưa hỏi; commit; gọi agent khác.
- Bắt buộc: cần quyết định của người dùng (thêm tool/dependency, mục bảng điều kiện chưa biết, sửa config ngoài
  `perf/`/`bench/` chưa có ở hàng Config tool đo) → trả `status: blocked` + `questions[]`, không tự làm. Thiếu môi trường
  (không có Chrome, không build được) → `not_run` + `reason`, không tự dựng hạ tầng.

## Quy trình
1. Đọc skill `frontend-performance`; xác định chế độ (`measure` | `profile`) và bước gọi. Khi workflow có cả hai phía, ghi
   artifact vào `perf/frontend/` (phía backend dùng `perf/backend/`).
2. `measure`: chốt bảng điều kiện đo (P2); ở Bước 5 đọc lại bảng + script của Bước 2, build + phục vụ lại từ working tree và
   xác nhận bản mới trước khi đo. `profile`: dùng lại bảng của Bước 2, không chốt bảng mới.
3. `measure`: chạy ≥3 lần trên bản build production, ghi median LCP/TBT/CLS, kích thước bundle, độ lệch (P3). `profile`:
   bundle → render → main thread, dừng khi có evidence (P4).
4. Tự đối chiếu diff so với mốc đầu bước (`git diff --name-only` + `git ls-files --others --exclude-standard`): chỉ `perf/`,
   `bench/`, config tool đo đã liệt kê ở hàng Config tool đo (P5); mốc do session chính truyền; gọi độc lập → tự ghi
   `git status --porcelain` ở bước 1.
5. Báo cáo.

## Report trả về
- `measure`: bảng điều kiện đo + bảng số (median LCP/TBT/CLS, kích thước bundle, độ lệch) + lệnh chạy; nêu rõ số lab, không
  phải INP.
- `profile`: bottleneck + evidence (số đo, `file:line` hoặc tên chunk/component) + giả thuyết + danh sách file/hàm đề xuất
  sửa; lệnh/config bật profiler ghi ở đây.
- Evidence theo contract `core:principles`; không chạy được → `not_run` + `reason`; cần quyết định → `blocked` +
  `questions[]`.
- `remaining_risks`: nhiễu máy local, một preset thiết bị, lab ≠ người dùng thật, phần chỉ suy từ đọc code.
```

### 4.3 Vai trò so với `frontend-fixer`

Analyst đo, không sửa; fixer sửa, không đo. Chuỗi: analyst (Bước 2 `measure`) → analyst (Bước 3 `profile`) → fixer (Bước 4) →
analyst (Bước 5 `measure`).

---

## 5. Nối vào `workflow-performance`

### 5.1 Nguyên tắc

- Giữ **7 bước**, ⏸ ở Bước 3 và 7; không đánh số lại; Bước 4, 6, 7 không đổi.
- `Thực hiện` có thể xuống dòng (`stepRefs` đọc trọn trường).
- Khi phạm vi có cả hai phía: hai analyst chạy song song (`∥`), mỗi phía dùng thư mục con riêng (`perf/backend/`,
  `perf/frontend/`) với bảng điều kiện + script riêng; mốc `git hash-object` ghi cho **cả hai** phía.

### 5.2 Thay đổi theo bước

| Bước | Thay đổi |
|---|---|
| 2 Baseline | `Thực hiện: agent backend-performance-analyst (chế độ measure; phía BE) ∥ agent frontend-performance-analyst (chế độ measure; phía FE)` — chỉ phía có đụng theo Bước 1. Bỏ câu chờ "Phía FE…". Gate: bảng điều kiện đầy đủ + ≥3 lần cho từng phía; so mốc đầu bước, file thay đổi chỉ gồm `perf/`, `bench/`, config tool đo đã liệt kê. Evidence: `git hash-object` script + bảng điều kiện **của từng phía** (mốc bất biến cho Bước 5). |
| 3 Profile ⏸ | Tương tự (`profile`, hai phía). Bỏ câu chờ. Gate/Khi fail giữ luật hash + diff; quyết định làm đổi điều kiện đo → quay lại Bước 2. |
| 5 Benchmark | Tương tự (`measure`, hai phía). Hành động: mỗi phía build + khởi chạy lại từ working tree và xác nhận bản mới; FE: hash file build hoặc tên chunk khác baseline. Gate: hash của từng phía bằng mốc Bước 2; kết luận đạt/không đạt theo từng phía; nhiễu vượt P3 → không kết luận. |
| 1, 4, 6, 7 | Không đổi (Bước 1: điều kiện đo sơ bộ ghi theo từng phía có đụng). |

Frontmatter `agents` thêm `frontend-performance-analyst`; Điều kiện tiên quyết liệt kê thêm agent; bảng lỗi mở rộng:
"Bản build FE không dựng được hoặc không có Chrome (Bước 2/5, `not_run`)" → dừng `blocked`, báo người dùng.

---

## 6. Publish, docs, kiểm chứng

### 6.1 Publish (TRƯỚC khi nối workflow)

- `plugins/_published.json`: thêm `frontend/frontend-performance`; `plugins/_cowork.json`: thêm `frontend:frontend-performance`.
- `plugins/frontend/.manifest.json`: version `1.6.0` → `1.7.0`; description nêu `frontend-performance`.
- `test/install.test.mjs`: số skill frontend được offer `9` → `10`.

### 6.2 Docs

- `README.md`/`README_VI.md`: `### Agents (17)` → `(18)`; hàng `| \`frontend-performance-analyst\` | frontend | write |
  frontend-performance | WF09 |`; cột agent WF09 thêm agent mới; bỏ câu về FE còn mở nếu có.
- `CLAUDE.md`: frontend 10 skill published (thêm `frontend-performance`).
- Spec 2026-09-29: §13 đánh dấu "Frontend performance" xong, bỏ hàng khỏi §13.2; spec backend-performance: G-Q8 → "đã làm
  — `2026-10-01-frontend-performance-design.md`".
- `workflows/performance/WORKFLOW.md` mô tả/description bỏ ngụ ý "chỉ backend" nếu có.

### 6.3 Test — khối `// 23.` cuối `test/validate.mjs`

- skill: frontmatter (`order: 10`, `pipeline: false`); P1–P5; hai chế độ; chứa "staging/production", `not_run`, "dev server",
  "INP" (nêu giới hạn lab), "≥ 3"; ranh giới nêu `frontend-fix`; `references/` đủ 6 file và được link từ SKILL.md;
  P5 chứa `src/`.
- agent: `mode: write`, `skills` đúng 1; Phạm vi chứa `perf/`, `bench/`, `src/`, "dev server", "staging/production",
  `blocked`, `not_run`; body chứa `core:principles`, `git diff --name-only`; khối agent trong spec §4.2 giống hệt file agent.
- publish: `_published.json`, `_cowork.json`, manifest `1.7.0`.
- workflow: Bước 2/3/5 `Thực hiện` chứa cả hai agent analyst; không còn câu "Phía FE: chưa có skill"; Bước 5 Gate chứa
  "mốc Bước 2"; vẫn 7 bước; frontmatter agents; `offeredCatalog` vẫn chứa `workflows/workflow-performance` (kiểm có răng);
  các assert khác của khối 20 về Bước 2/3/5 (hash, diff, blocked…) vẫn xanh, không nới.
- **Thay (không nới) assert `test/validate.mjs:1510`** (`workflow-performance Bước N: có câu chờ cho phía FE`, đòi câu chờ còn tồn tại)
  bằng assert đảo chiều: `Thực hiện` chứa cả hai agent analyst và body **không còn** `Phía FE: chưa có skill`.
- README: heading `(18)`, hàng agent, WF09.

### 6.4 Kiểm chứng

| Bước | Lệnh | Chứng minh |
|---|---|---|
| Contract | `npm run validate` | skill/agent/workflow mới đúng contract |
| Build | `npm run build` | skill + references + agent ở `build/<provider>/` |
| Toàn bộ | `npm test` | không regression; frontend offer 10 |
| Smoke | `AIE_INSTALL_ROOT=<sandbox> aip install --provider claude --skill workflows/workflow-performance --yes` | closure kéo `frontend-performance` + 2 analyst; dọn bằng `fs.rmSync` |
| Công cụ thật | Chạy Lighthouse/profiler trên app React thật | `[Unverified]` — chỉ làm được khi pilot |

---

## 7. Lộ trình (mỗi task = 1 commit, người duyệt diff)

| Pha | Nội dung |
|---|---|
| FP-P1 | `SKILL.md` + khối 23 (assert skill) |
| FP-P2 | 6 file `references/` (nhãn `[Unverified]` cho lệnh/cờ chưa kiểm) |
| FP-P3 | Publish (§6.1) |
| FP-P4 | Agent (§4.2) + assert |
| FP-P5 | Nối workflow (§5) + assert + kiểm có răng + sửa assert khối 20 nếu cần |
| FP-P6 | Docs (§6.2) + assert |
| FP-P7 | Smoke sandbox |

FP-P3 phải đi trước FP-P5 (publish trước, nối sau).

---

## 8. Rủi ro còn lại

- **Chưa pilot** (publish ngay): cờ Lighthouse CLI, cách bật React Profiler trên bản production (cần build profiling),
  cách xuất trace headless đều `[Unverified]`; sửa sau lần dùng thật đầu tiên.
- `[Inference]` Số đo lab trên máy local nhiễu cao (CPU boost, extension, tiến trình nền); 10% có thể quá chặt — để project
  ghi đè.
- Lighthouse đo một preset thiết bị mỗi lần; kết quả không đại diện người dùng thật; INP không có trong lab.
- `[Inference]` Hai analyst song song cùng working tree: mỗi analyst chỉ ghi thư mục con của mình; gate cuối ở session
  chính kiểm hợp hai danh sách. Hai phía dùng chung tên `measure-conditions.md` ở hai plugin khác nhau (hygiene tên file
  chỉ kiểm trong cùng plugin).
- Phục vụ bản build cần lệnh start của project (`vite preview`, `next start`…); project không có → agent trả `blocked`.
- Agent mode `write` không bị chặn ghi theo đường dẫn bằng công cụ (`adapters/_shared/agents.mjs:5`); phạm vi chỉ được kiểm
  bằng gate diff của workflow.
- Bước 2/3/5 sau thay đổi dài hơn (hai agent ∥); số assert của khối 20 phải cập nhật cho khớp.

---

## 9. Quyết định cần chốt

| # | Câu hỏi | Trạng thái |
|---|---|---|
| ~~E-Q1…E-Q3~~ | (§2) | Đã chốt 2026-10-01 |
| E-Q4 | Thêm RUM / Web Vitals thực tế (INP thật) | Mở — ngoài phạm vi; cần hạ tầng thu thập |
| E-Q5 | Perf regression tự động trong CI (cả BE lẫn FE) | Mở — cần `ops-ci-pipeline` (G6) |
