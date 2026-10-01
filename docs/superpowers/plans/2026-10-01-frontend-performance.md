# Frontend Performance (skill + agent + nối workflow-performance) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm skill `frontend-performance` (2 chế độ `measure`/`profile`, cổng P1–P5, 6 file references), publish, thêm agent `frontend-performance-analyst`, rồi thay các câu chờ "Phía FE: chưa có skill…" ở `workflow-performance` Bước 2/3/5 bằng agent này (hai analyst chạy song song); sửa docs.

**Architecture:** Nội dung canonical ở `plugins/frontend/…`, `workflows/performance/WORKFLOW.md`; hợp đồng kiểm bằng assert chuỗi trong `test/validate.mjs` (khối `// 23.` mới ở cuối file). Wizard ẩn workflow có closure chưa publish (`cli/lib/install.mjs:~355`) → thứ tự bắt buộc: **skill → references → publish → agent → nối workflow → docs**.

**Tech Stack:** Node.js 20+, ESM, zero dependency. `node test/validate.mjs`, `npm test`, `npm run build`.

**Spec:** [`docs/superpowers/specs/2026-10-01-frontend-performance-design.md`](../specs/2026-10-01-frontend-performance-design.md)

## Global Constraints

- File UTF-8 **không BOM**, LF; nội dung tiếng Việt có dấu; frontmatter/identifier tiếng Anh; wrap ~110 cột (đo ký tự Unicode).
- Skill: `plugins/frontend/skills/frontend-performance/SKILL.md`, frontmatter `name: frontend-performance`, `order: 10`, `stageNumber: "10"`, `title`, `runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`. **Mẫu cấu trúc: `plugins/backend/skills/backend-performance/SKILL.md` và `references/`** — đọc trước khi viết, giữ cùng bố cục (heading, bảng gate, `### \`measure\``, `### \`profile\``, mục ranh giới/an toàn, danh sách link references).
- Agent: `name: frontend-performance-analyst`, `mode: write`, `skills: "frontend-performance"`, đủ 4 heading `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`; file ở `plugins/frontend/agents/` (thư mục đã có).
- `workflow-performance` giữ **7 bước**; ⏸ ở Bước 3 và 7; không đánh số lại; Bước 1, 4, 6, 7 giữ nguyên nội dung (Bước 1 chỉ đổi nếu cần cho "điều kiện đo sơ bộ theo từng phía"). Trường `- **Thực hiện:**` có thể xuống dòng (`stepRefs` đọc trọn trường).
- **Kiểm tra hợp đồng workflow** (`test/validate.mjs:~327`): agent id nêu trong `**Hành động:**` phải nằm trong `**Thực hiện:**` của cùng bước; skill token trong Thực hiện phải có trong `requires` hoặc skill của agent. Ở Bước 2/3/5 cả hai analyst đều có trong Thực hiện nên được phép nêu trong Hành động.
- Mọi lệnh/cờ công cụ ngoài (Lighthouse CLI, `vite-bundle-visualizer`, `source-map-explorer`, React Profiler, `--trace`…) chưa đối chiếu tài liệu chính thức phải gắn `[Unverified]` ngay trong file (assert yêu cầu mỗi file reference có chữ `[Unverified]`).
- Commit qua `core:git-workflow`: header tiếng Anh, body tiếng Việt (Changed/Reason, **không dùng dấu `?`**), message ghi ra file UTF-8 rồi `git commit -F`. **Không `Co-Authored-By`.** Không push.
- Nhánh: `feature/frontend-performance` (đã cắt từ master `57a4c1e`).
- Dọn sandbox bằng Node `fs.rmSync`, không `rm -rf` (junction Windows).

## Review Focus

1. **Nối workflow trước publish** → wizard ẩn `workflow-performance` lặng lẽ. Task 3 publish trước; Task 5 assert `offeredCatalog` + kiểm có răng.
2. **Đo trên dev server / URL ngoài local / dịch vụ bên thứ ba** làm số đo vô nghĩa hoặc rò URL. Skill P1 + agent Phạm vi cấm; assert ở Task 1 và 4.
3. **Nhầm lab với người dùng thật:** INP không đo được trong lab; skill/agent/report phải nói rõ (assert "INP").
4. **Mốc hash chỉ phủ BE:** Task 5 bắt Bước 2 Evidence/Bước 3, 5 Gate nêu hash của **từng phía** (BE và FE).
5. **Assert khối 20 `validate.mjs:1510`** đòi câu chờ FE còn tồn tại → phải ĐẢO chiều (không nới) ở Task 5.
6. **Hai analyst cùng working tree:** mỗi analyst chỉ ghi thư mục con của mình (`perf/backend/`, `perf/frontend/`); Task 5 sửa agent BE đúng một câu để khớp.

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/frontend/skills/frontend-performance/SKILL.md` | Skill | 1 |
| `plugins/frontend/skills/frontend-performance/references/*.md` (6 file) | Bảng điều kiện, phục vụ build production, Lighthouse, bundle, React profiler, Chrome trace | 2 |
| `plugins/_published.json`, `plugins/_cowork.json`, `plugins/frontend/.manifest.json`, `test/install.test.mjs` | Publish | 3 |
| `plugins/frontend/agents/frontend-performance-analyst.md` | Agent | 4 |
| `workflows/performance/WORKFLOW.md`, `plugins/backend/agents/backend-performance-analyst.md` (1 câu) | Nối workflow | 5 |
| `README.md`, `README_VI.md`, `CLAUDE.md`, spec 2026-09-29, spec backend-performance | Docs | 6 |
| `test/validate.mjs` (khối `// 23.` mới cuối file; khối 20 dòng ~1510 đảo; khối 22 dòng assert `(17)`) | Assert | 1–6 |

---

### Task 0: Nhánh

- [ ] `git branch --show-current` = `feature/frontend-performance`; `npm test` xanh (mốc validate 2021/0, install 210, wizard 64).

---

### Task 1: Skill `frontend-performance` + mở khối 23

**Files:** Create `plugins/frontend/skills/frontend-performance/SKILL.md`; Modify `test/validate.mjs`.

**Interfaces — Produces:** khối 23 với helper `flat23(t)`, `wf23(id)`, `step23(wf, n)`, `field23(body, name)` (cắt thân bước thô từ dòng cột 0 `- **<name>:**` tới dòng cột 0 `- **` kế tiếp, flatten, GỒM nhãn; không thấy → `''`), dùng ở Task 2–6. Biến `feSkill23`, `feDir23`, `feRef23(n)` dùng ở Task 2.

- [ ] **Step 1: Mở khối 23 + assert skill (đỏ)** — thêm cuối `test/validate.mjs`, SAU `}` đóng khối 22, TRƯỚC dòng `// ───…` + `console.log('')`. Copy `field22` từ khối 22 (đổi `22`→`23`) để không lệch regex:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 23. SOURCE: frontend-performance skill + agent + workflow-performance Bước 2/3/5 phía FE (spec 2026-10-01-frontend-performance-design)
{
  const flat23 = (t) => t.replace(/\s+/g, ' ');
  const wf23 = (id) => workflows.stages.find((s) => s.id === id);
  const step23 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
  const field23 = (body, name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return flat23(lines.slice(i, j).join('\n'));
  };
  const feDir23 = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-performance');
  const feSkill23 = fs.existsSync(path.join(feDir23, 'SKILL.md')) ? fs.readFileSync(path.join(feDir23, 'SKILL.md'), 'utf8') : '';
  ok(feSkill23.length > 0, 'frontend-performance: có SKILL.md');
  ok(/^order: 10$/m.test(feSkill23) && /^pipeline: false$/m.test(feSkill23) && /^runsIn: execute$/m.test(feSkill23),
    'frontend-performance: frontmatter order 10, pipeline false, runsIn execute');
  ok(/^description: .*frontend-fix/m.test(feSkill23) && /^description: .*frontend-testing/m.test(feSkill23)
    && /^description: .*frontend-e2e-testing/m.test(feSkill23),
    'frontend-performance: description nêu ranh giới với frontend-fix, frontend-testing, frontend-e2e-testing');
  for (const g of ['P1', 'P2', 'P3', 'P4', 'P5']) ok(new RegExp(`^\\| ${g} `, 'm').test(feSkill23), `frontend-performance: bảng gate có ${g}`);
  ok(feSkill23.includes('`measure`') && feSkill23.includes('`profile`'), 'frontend-performance: có 2 chế độ measure / profile');
  ok(/^\| P3 [^\n]*10%/m.test(feSkill23), 'frontend-performance: P3 có ngưỡng độ lệch mặc định 10%');
  ok(/^\| P1 [^\n]*staging\/production/m.test(feSkill23) && flat23(feSkill23).includes('not_run'),
    'frontend-performance: P1 từ chối staging/production, thiếu môi trường → not_run');
  ok(/^\| P1 [^\n]*(bên thứ ba|dịch vụ đo)/m.test(feSkill23),
    'frontend-performance: P1 cấm gửi URL cho dịch vụ đo của bên thứ ba');
  ok(/≥\s?3/.test(feSkill23) && feSkill23.includes('`perf/`') && feSkill23.includes('`bench/`'),
    'frontend-performance: đo ≥3 lần, script ở perf/ và bench/');
  ok(feSkill23.includes('dev server') && feSkill23.includes('bản build production'),
    'frontend-performance: đo trên bản build production, cấm dev server');
  ok(feSkill23.includes('INP') && feSkill23.includes('TBT') && /lab/i.test(feSkill23),
    'frontend-performance: nêu Lighthouse là số lab, INP không đo được, TBT thay thế');
  ok(/^\| P5 [^\n]*`src\/`/m.test(feSkill23) && /^\| P5 [^\n]*blocked/m.test(feSkill23),
    'frontend-performance: P5 cấm sửa src/, chạy như subagent → trả blocked');
  ok(feSkill23.includes('`frontend-fix`'), 'frontend-performance: ranh giới nêu frontend-fix');
}
```

- [ ] **Step 2:** `node test/validate.mjs` → đỏ đúng các dòng `frontend-performance: …` (ghi lại số dòng đỏ thực tế).

- [ ] **Step 3: Viết `SKILL.md`** theo spec §3 (đọc `backend-performance/SKILL.md` làm mẫu cấu trúc; viết lại nội dung cho FE, không copy nguyên BE):
  - frontmatter: `description` tiếng Việt, bắt đầu bằng "Recipe on-demand: ĐO và PROFILE hiệu năng FRONTEND…", trigger theo §3.1 (đo hiệu năng frontend, Lighthouse, LCP, bundle size, profile React, render chậm, trang tải chậm), kèm "KHÔNG sửa code (đó là `frontend-fix`); KHÔNG thay test đúng/sai (đó là `frontend-testing`/`frontend-e2e-testing`)". Assert regex dùng `^description: .*frontend-fix` → description phải nằm trên MỘT dòng.
  - bảng ranh giới §3.2; `### \`measure\`` §3.3 (nêu "bản build production", "dev server" bị cấm, "≥ 3 lần", median LCP/TBT/CLS + kích thước bundle, Bước 5 build lại + xác nhận bản mới bằng hash file build/tên chunk khác baseline, "Lighthouse đo lab, không phản ánh INP; TBT là chỉ số thay thế"); `### \`profile\`` §3.4 (bundle → render → main thread; lệnh/config bật profiler ghi vào report Bước 3 hoặc `perf/profile-<luồng>.md`, không vào bảng điều kiện Bước 2).
  - bảng cổng P1–P5 đúng như §3.5, mỗi hàng bắt đầu `| P<n> `; P1 chứa `staging/production`, `not_run`, và cụm "dịch vụ đo của bên thứ ba"; P3 chứa `10%`; P5 chứa `` `src/` `` và `blocked`.
  - mục ranh giới an toàn §3.6.
  - danh sách link đúng cú pháp `(references/<tên>.md)` cho cả 6 file: `measure-conditions`, `serve-production-build`, `lighthouse-cli`, `bundle-analysis`, `profiling-react`, `chrome-trace`.
  Wrap ~110 cột; description một dòng.

- [ ] **Step 4:** `node test/validate.mjs` → các assert skill xanh; riêng contract chung (references phải tồn tại nếu SKILL.md link tới) có thể đỏ cho tới Task 2 — nếu vậy tạo 6 file references RỖNG tạm KHÔNG được phép: thay vào đó **gộp Task 1 và Task 2 vào cùng lần chạy test** (implement Task 2 trước khi commit Task 1 nếu contract chung bắt link chết). Ghi lại quyết định vào report.

- [ ] **Step 5: Commit** (nếu Task 2 phải gộp thì commit sau Task 2 với header `feat(frontend): add frontend-performance skill with references`)

```text
feat(frontend): add frontend-performance skill

Changed:
- Thêm skill frontend-performance (order 10): chế độ measure chốt bảng điều kiện đo và đo bản build production ≥ 3 lần, chế độ profile theo thứ tự bundle → render → main thread; cổng P1-P5.
- Khối validate 23 mở với assert skill (ranh giới, P1-P5, INP/TBT, cấm dev server, cấm dịch vụ đo bên thứ ba).

Reason:
- Phần frontend của G10: workflow-performance Bước 2/3/5 chưa có skill đo/profile frontend (spec 2026-10-01-frontend-performance-design §3).
```

---

### Task 2: 6 file `references/`

**Files:** Create `plugins/frontend/skills/frontend-performance/references/{measure-conditions,serve-production-build,lighthouse-cli,bundle-analysis,profiling-react,chrome-trace}.md`; Modify `test/validate.mjs` (khối 23).

- [ ] **Step 1: Assert đỏ (cuối khối 23, trước `}` đóng)**

```js
  const feRefs23 = ['measure-conditions', 'serve-production-build', 'lighthouse-cli', 'bundle-analysis', 'profiling-react', 'chrome-trace'];
  const feRef23 = (n) => { const f = path.join(feDir23, 'references', `${n}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
  for (const n of feRefs23) {
    ok(feRef23(n).length > 200, `frontend-performance references/${n}.md: có nội dung`);
    ok(feSkill23.includes(`(references/${n}.md)`), `frontend-performance: SKILL.md link tới references/${n}.md`);
    ok(feRef23(n).includes('[Unverified]'), `frontend-performance references/${n}.md: lệnh/cờ chưa kiểm gắn [Unverified]`);
  }
  const fmc23 = feRef23('measure-conditions');
  ok(/\| *Route/.test(fmc23) && /\| *Build/.test(fmc23) && fmc23.includes('Config tool đo') && fmc23.includes('10%')
    && /\| *Cache/.test(fmc23) && /throttl/i.test(fmc23) && fmc23.includes('Phục vụ bản build'),
    'measure-conditions.md (FE): bảng điều kiện có Route, Build, Phục vụ bản build, Cache, throttle, Config tool đo, ngưỡng 10%');
  ok(/vite preview|next start/.test(feRef23('serve-production-build')) && feRef23('serve-production-build').includes('dev server')
    && feRef23('serve-production-build').includes('blocked'),
    'serve-production-build.md: lệnh phục vụ bản build (vite preview / next start), cấm dev server, project không có lệnh → blocked');
  ok(/lighthouse/i.test(feRef23('lighthouse-cli')) && feRef23('lighthouse-cli').includes('--output=json')
    && feRef23('lighthouse-cli').includes('localhost') && !/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(feRef23('lighthouse-cli'))
    && feRef23('lighthouse-cli').includes('INP'),
    'lighthouse-cli.md: lệnh Lighthouse CLI trỏ localhost, xuất JSON, không URL ngoài, nêu INP không đo trong lab');
  ok(/bundle/i.test(feRef23('bundle-analysis')) && /(source-map-explorer|visualizer|webpack-bundle-analyzer)/.test(feRef23('bundle-analysis'))
    && /code-splitting|dynamic import/i.test(feRef23('bundle-analysis')),
    'bundle-analysis.md: có bundle analyzer và code-splitting');
  ok(/Profiler/.test(feRef23('profiling-react')) && /(profiling build|build profiling)/i.test(feRef23('profiling-react'))
    && /commit/i.test(feRef23('profiling-react')),
    'profiling-react.md: React Profiler, cần build profiling, commit thừa');
  ok(/long task/i.test(feRef23('chrome-trace')) && /trace/i.test(feRef23('chrome-trace')) && feRef23('chrome-trace').includes('Bước 3'),
    'chrome-trace.md: long task, xuất trace, ghi lệnh vào report Bước 3');
  ok(!/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(feRefs23.map(feRef23).join('\n').replace(/https?:\/\/(?:github\.com|developer\.chrome\.com|web\.dev|react\.dev)[^\s)]*/g, '')),
    'frontend-performance references: không URL host ngoài (trừ link tài liệu chính thức)');
```

- [ ] **Step 2:** validate → đỏ nhóm `frontend-performance references/…`, `measure-conditions.md (FE)`, `serve-production-build.md`, `lighthouse-cli.md`, `bundle-analysis.md`, `profiling-react.md`, `chrome-trace.md`.

- [ ] **Step 3: Viết 6 file** (tiếng Việt, mẫu: `plugins/backend/skills/backend-performance/references/*.md`; 60–100 dòng/file, ví dụ lệnh/mã ngắn):
  - `measure-conditions.md`: bảng `| Mục | Giá trị |` với các hàng: `Route/luồng`, `Build` (commit SHA + `git diff --name-only`), `Phục vụ bản build` (lệnh + port; ghi lại để Bước 5 dùng đúng), `Thiết bị/throttle` (preset Lighthouse mobile/desktop + CPU/network throttle), `Cache` (lạnh/ấm), `Số lần lặp` (≥ 3), `Công cụ + phiên bản` (lấy từ output lệnh), `Ngưỡng độ lệch` (mặc định 10%, project ghi đè được), `Config tool đo` (liệt kê mọi file config ngoài `perf/`/`bench/` được phép sửa). Giải thích: bảng + script chốt cuối Bước 2, `git hash-object`, không sửa sau đó.
  - `serve-production-build.md`: build production (`npm run build`), phục vụ local (`vite preview --port 4173`, `next start`, `npx serve dist` …, mỗi lệnh cờ gắn `[Unverified]`), xác nhận là bản mới ở Bước 5 (hash tên file build/tên chunk khác baseline), **không dùng dev server** (HMR/source map/React dev build làm số đo vô nghĩa), project không có lệnh phục vụ → `blocked` + câu hỏi.
  - `lighthouse-cli.md`: `npx lighthouse http://localhost:4173/<route> --output=json --output-path=perf/frontend/run-1.json --only-categories=performance --preset=desktop` hoặc mặc định mobile, `--chrome-flags="--headless"`; lặp ≥ 3 lần, lấy median LCP/TBT/CLS bằng script Node đọc JSON (`audits['largest-contentful-paint'].numericValue` …); **INP không đo được trong lab, dùng TBT thay thế**; không dùng PageSpeed Insights/WebPageTest công cộng (gửi URL ra ngoài); cần Chrome cài trên máy — thiếu → `not_run`; thêm `lighthouse` làm devDependency → hỏi trước (`blocked`). Mọi cờ gắn `[Unverified]`.
  - `bundle-analysis.md`: lấy kích thước từ output build hoặc stats; công cụ theo bundler (`vite-bundle-visualizer`, `source-map-explorer`, `webpack-bundle-analyzer`, `@next/bundle-analyzer`) — dùng cái project đã có, thêm mới → hỏi trước; tìm chunk lớn, dependency nặng, code trùng, thiếu code-splitting/dynamic import; kích thước là chỉ số xác định nên so trực tiếp. `[Unverified]` cho lệnh/cờ.
  - `profiling-react.md`: React DevTools Profiler (ghi commit, flamegraph), cần **build profiling** (production build + profiling flag, vd `react-dom/profiling` alias) vì production mặc định bỏ profiler; tìm component render nhiều/lâu và commit thừa; lệnh/config bật profiler ghi vào report Bước 3, **không** vào bảng điều kiện Bước 2, không sửa `src/` (alias bật profiling nằm ở config tool đo đã liệt kê hoặc hỏi trước). `[Unverified]`.
  - `chrome-trace.md`: Chrome DevTools Performance panel / `chrome --trace`/Lighthouse `--save-assets` để lấy trace; tìm long task, layout/style thrash, script evaluation; trace lưu ở `perf/frontend/`, không upload dịch vụ ngoài; lệnh ghi vào report Bước 3. `[Unverified]`.

- [ ] **Step 4:** `npm run build && node test/validate.mjs` → 0 fail (hygiene tên file references chỉ kiểm trong cùng plugin, `measure-conditions.md` tồn tại ở plugin backend không xung đột — xác nhận bằng kết quả chạy). Kiểm `build/claude/**/frontend-performance/references/` có 6 file.

- [ ] **Step 5: Commit**

```text
feat(frontend): add frontend-performance references

Changed:
- Thêm 6 file references: measure-conditions (bảng điều kiện đo FE), serve-production-build, lighthouse-cli, bundle-analysis, profiling-react, chrome-trace.
- Mọi lệnh/cờ công cụ ngoài gắn [Unverified]; không URL host ngoài local.
- Khối validate 23 thêm assert references và liên kết từ SKILL.md.

Reason:
- Spec 2026-10-01-frontend-performance-design §3.1: skill tách chi tiết công cụ ra references, giống backend-performance.
```

---

### Task 3: Publish (TRƯỚC khi nối workflow)

**Files:** `plugins/_published.json`, `plugins/_cowork.json`, `plugins/frontend/.manifest.json`, `test/install.test.mjs`, `test/validate.mjs`.

- [ ] **Step 1: Assert đỏ (khối 23)**

```js
  const pub23 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub23.includes('frontend/frontend-performance'), '_published.json: có frontend/frontend-performance (publish trước khi nối workflow)');
  const cowork23 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork23.includes('frontend:frontend-performance'), '_cowork.json: có frontend:frontend-performance');
  const feMan23 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'frontend', '.manifest.json'), 'utf8'));
  ok(feMan23.version === '1.7.0' && feMan23.description.includes('frontend-performance'),
    'frontend manifest: version 1.7.0, description nêu frontend-performance');
  const offFe23 = offeredCatalog().plugins.find((p) => p.id === 'frontend');
  ok(!!offFe23 && offFe23.skillIds.includes('frontend/frontend-performance') && offFe23.skillIds.length === 10,
    'offeredCatalog: plugin frontend offer 10 skill gồm frontend-performance');
```

- [ ] **Step 2:** validate → đỏ 4 dòng trên.

- [ ] **Step 3:** `plugins/_published.json`: thêm `"frontend/frontend-performance",` ngay sau mục `frontend/…` cuối cùng (giữ thứ tự nhóm, JSON hợp lệ). `plugins/_cowork.json`: thêm `"frontend:frontend-performance",` cạnh các mục `frontend:` (sau mục frontend cuối). `plugins/frontend/.manifest.json`: `"version": "1.6.0"` → `"1.7.0"`; trong `description` thêm `frontend-performance (đo và profile hiệu năng frontend: Lighthouse, bundle, React Profiler, trace — chỉ local/test, không sửa code)` vào danh sách skill, giữ văn phong câu hiện có.

- [ ] **Step 4:** `node test/install.test.mjs` → đỏ ở dòng `offeredCatalog: offer đủ 9 skill frontend đã publish` (~204). Sửa `9` → `10` và message `10 skill`. Nếu assert khác lệch +1 (đếm Cowork, số skill ship…), sửa đúng con số và ghi lại dòng nào, vì sao; không nới assert khác.

- [ ] **Step 5:** `npm test && npm run pack:verify` → xanh.

- [ ] **Step 6: Commit**

```text
feat(publish): publish frontend-performance skill

Changed:
- Thêm frontend/frontend-performance vào _published.json và _cowork.json; manifest frontend 1.7.0.
- install.test: số skill frontend được offer 9 → 10; khối validate 23 thêm assert publish.

Reason:
- Publish không chờ pilot và làm trước khi nối workflow vì offeredCatalog ẩn workflow có closure chưa publish (spec 2026-10-01-frontend-performance-design §6.1, E-Q3).
```

---

### Task 4: Agent `frontend-performance-analyst`

**Files:** Create `plugins/frontend/agents/frontend-performance-analyst.md`; Modify `test/validate.mjs`.

- [ ] **Step 1: Assert đỏ (khối 23)**

```js
  const fpaPath = path.join(PLUGINS_DIR, 'frontend', 'agents', 'frontend-performance-analyst.md');
  const fpa = fs.existsSync(fpaPath) ? fs.readFileSync(fpaPath, 'utf8') : '';
  ok(fpa.length > 0, 'frontend-performance-analyst: có agent file');
  ok(/^mode: write$/m.test(fpa) && /^skills: "frontend-performance"$/m.test(fpa),
    'frontend-performance-analyst: mode write, skills = frontend-performance (đúng 1 skill)');
  const fpaScope = flat23(fpa.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
  ok(fpaScope.includes('`perf/`') && fpaScope.includes('`bench/`') && fpaScope.includes('`src/`')
    && fpaScope.includes('dev server') && fpaScope.includes('staging/production'),
    'frontend-performance-analyst: Phạm vi ghi perf/ bench/, cấm sửa src/, cấm dev server, cấm staging/production');
  ok(fpaScope.includes('blocked') && fpaScope.includes('questions') && fpaScope.includes('not_run'),
    'frontend-performance-analyst: cần quyết định → blocked + questions; thiếu môi trường → not_run');
  ok(fpa.includes('core:principles') && fpa.includes('git diff --name-only'),
    'frontend-performance-analyst: report theo core:principles, tự đối chiếu diff');
  ok(fpa.includes('INP') && /^description: .*(LCP|TBT)/m.test(fpa),
    'frontend-performance-analyst: nêu lab không phải INP; description nêu LCP/TBT');
  const fpaSpec = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'superpowers', 'specs', '2026-10-01-frontend-performance-design.md'), 'utf8')
    .replace(/\r\n/g, '\n');
  const fpaBlock = fpaSpec.split('### 4.2')[1]?.split('```markdown\n')[1]?.split('\n```')[0] ?? '';
  ok(fpaBlock.length > 0 && fpaBlock.trimEnd() === fpa.replace(/\r\n/g, '\n').trimEnd(),
    'frontend-performance-analyst: khối agent trong spec §4.2 giống hệt file agent');
```

- [ ] **Step 2:** validate → đỏ 7 dòng `frontend-performance-analyst: …`.

- [ ] **Step 3: Tạo file** — copy **nguyên văn** khối ```markdown trong spec §4.2 (từ dòng `---` mở frontmatter tới hết dòng `- \`remaining_risks\`: …`), không kèm hàng rào ```. Nếu assert "ghi `perf/frontend/` khi có cả hai phía" cần thêm câu mà khối spec thiếu thì sửa spec §4.2 và file cùng lúc (giữ giống hệt byte).

- [ ] **Step 4:** `npm run build && node test/validate.mjs` → 0 fail (contract agent chung chạy cho agent mới). `grep -rl frontend-performance-analyst build/claude build/codex | head` thấy `.md` và `.toml`.

- [ ] **Step 5: Commit**

```text
feat(agents): add frontend-performance-analyst agent

Changed:
- Thêm agent frontend-performance-analyst (plugin frontend, skill frontend-performance, mode write): đo bản build production, profile bundle → render → main thread, chỉ ghi perf/, bench/ và config tool đo; không sửa src/ hay test, không dev server, không staging/production.
- Khối validate 23 thêm assert agent, gồm so khớp từng byte với khối trong spec.

Reason:
- Spec 2026-10-01-frontend-performance-design §4: đo và sửa tách thành hai agent, analyst đo, frontend-fixer sửa.
```

---

### Task 5: Nối `workflow-performance` (hai analyst song song)

**Files:** `workflows/performance/WORKFLOW.md`, `plugins/backend/agents/backend-performance-analyst.md`, `test/validate.mjs` (khối 23 + đảo assert khối 20 dòng ~1510).

- [ ] **Step 1: Assert đỏ (khối 23)**

```js
  const pf23 = wf23('workflow-performance');
  for (const [n, mode] of [[2, 'measure'], [3, 'profile'], [5, 'measure']]) {
    const s = step23(pf23, n);
    const th = field23(s.body, 'Thực hiện');
    ok(th.includes('agent `backend-performance-analyst`') && th.includes('agent `frontend-performance-analyst`') && th.includes(`\`${mode}\``),
      `workflow-performance Bước ${n}: Thực hiện có cả hai analyst (BE ∥ FE) chế độ ${mode}`);
    ok(!flat23(s.body).includes('Phía FE: chưa có skill'), `workflow-performance Bước ${n}: không còn câu chờ phía FE`);
    ok(field23(s.body, 'Khi fail').includes('blocked') && field23(s.body, 'Khi fail').includes('câu hỏi'),
      `workflow-performance Bước ${n}: Khi fail — analyst trả blocked + câu hỏi → session chính hỏi người dùng`);
  }
  ok(!flat23(pf23?.body ?? '').includes('Phía FE: chưa có skill'), 'workflow-performance: body không còn "Phía FE: chưa có skill"');
  const fS2 = step23(pf23, 2), fS3 = step23(pf23, 3), fS5 = step23(pf23, 5);
  ok(field23(fS2.body, 'Evidence').includes('hash-object') && /từng phía|BE và FE|cả hai phía/.test(field23(fS2.body, 'Evidence')),
    'workflow-performance Bước 2: Evidence ghi git hash-object script + bảng điều kiện của TỪNG phía');
  ok(field23(fS2.body, 'Hành động').includes('perf/frontend/') && field23(fS2.body, 'Hành động').includes('perf/backend/'),
    'workflow-performance Bước 2: hai phía dùng thư mục con riêng perf/backend/ và perf/frontend/');
  ok(field23(fS3.body, 'Gate').includes('mốc Bước 2') && /từng phía|BE và FE|cả hai phía/.test(field23(fS3.body, 'Gate')),
    'workflow-performance Bước 3: Gate so hash của từng phía với mốc Bước 2');
  ok(field23(fS5.body, 'Gate').includes('mốc Bước 2') && /từng phía/.test(field23(fS5.body, 'Gate')),
    'workflow-performance Bước 5: Gate hash từng phía bằng mốc Bước 2, kết luận đạt/không đạt theo từng phía');
  ok(field23(fS5.body, 'Hành động').includes('hash') && field23(fS5.body, 'Hành động').includes('chunk')
    && field23(fS5.body, 'Hành động').includes('bản build production'),
    'workflow-performance Bước 5: FE build lại bản production, xác nhận bản mới (hash file build / tên chunk khác baseline)');
  ok(field23(fS5.body, 'Ràng buộc').includes('dev server') || field23(fS2.body, 'Ràng buộc').includes('dev server'),
    'workflow-performance: Ràng buộc FE cấm đo trên dev server');
  ok(step23(pf23, 3).checkpoint && step23(pf23, 7).checkpoint && parseSteps(pf23?.body ?? '').length === 7,
    'workflow-performance: vẫn 7 bước, ⏸ ở Bước 3 và 7');
  ok(pf23 && ['backend-performance-analyst', 'frontend-performance-analyst', 'backend-fixer', 'frontend-fixer', 'backend-reviewer', 'frontend-reviewer']
    .every((a) => pf23.agents.includes(a)),
    'workflow-performance: frontmatter agents có frontend-performance-analyst');
  const pfErr23 = flat23(pf23?.body.split('## Xử lý lỗi')[1]?.split('## Definition of Done')[0] ?? '');
  ok(pfErr23.includes('Chrome') && pfErr23.includes('not_run'),
    'workflow-performance: bảng lỗi có hàng bản build FE không dựng được / không có Chrome (not_run → blocked)');
  ok(flat23(pf23?.body.split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('frontend-performance-analyst'),
    'workflow-performance: điều kiện tiên quyết liệt kê frontend-performance-analyst');
  ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-performance'),
    'offeredCatalog: vẫn offer workflows/workflow-performance (closure frontend-performance đã publish)');
  const bpaFlow23 = flat23(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-performance-analyst.md'), 'utf8')
    .split('## Quy trình')[1]?.split('## Report trả về')[0] ?? '');
  ok(bpaFlow23.includes('perf/backend/'), 'backend-performance-analyst: Quy trình ghi artifact vào perf/backend/ khi workflow có cả hai phía');
```

- [ ] **Step 2: Đảo assert khối 20** — `test/validate.mjs` dòng ~1510: xoá dòng `ok(flat20(s.body).includes('Phía FE: chưa có skill'), \`workflow-performance Bước ${n}: có câu chờ cho phía FE\`);` (assert đảo chiều tương ứng nằm ở khối 23, vòng `for` đầu của Step 1). Chỉ xoá đúng dòng đó, giữ mọi assert khác của khối 20.

- [ ] **Step 3:** `node test/validate.mjs` → đỏ nhóm `workflow-performance …` mới + `backend-performance-analyst: Quy trình ghi artifact…`; các assert khối 20 khác phải vẫn xanh. Ghi lại dòng đỏ thực tế.

- [ ] **Step 4: Sửa `workflows/performance/WORKFLOW.md`** (đọc text thật từng bước trước khi sửa; không đụng Bước 1/4/6/7 trừ ghi chú dưới):
  - Frontmatter `agents:` → `"backend-performance-analyst,frontend-performance-analyst,backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer"`.
  - Điều kiện tiên quyết dòng đầu: thêm `frontend-performance-analyst`; thêm dòng: "Phía FE: project build được bản production và có Chrome cài trên máy (Lighthouse); thiếu → agent trả `not_run`."
  - Mô tả/description đầu file: bỏ ngụ ý "chỉ backend" nếu có (đọc `description` và "Mục tiêu & đầu vào").
  - **Bước 2 Thực hiện** (xuống dòng được):
    ```markdown
    - **Thực hiện:** agent `backend-performance-analyst` (chế độ `measure`; phía BE) ∥ agent
      `frontend-performance-analyst` (chế độ `measure`; phía FE) — chỉ phía có đụng theo Bước 1
    ```
    **Hành động:** giữ phần BE; xoá câu "Phía FE: chưa có skill…"; thêm: "Phía FE: agent chốt bảng điều kiện đo theo skill `frontend-performance`, build và phục vụ bản build production ở local (không đo trên dev server), chạy Lighthouse/đo bundle ≥ 3 lần, ghi median LCP/TBT/CLS, kích thước bundle và độ lệch; số lab, không phải INP. Khi phạm vi có cả hai phía, hai agent chạy song song, mỗi phía ghi vào thư mục con riêng `perf/backend/` và `perf/frontend/` với bảng điều kiện + script riêng."
    **Ràng buộc:** nối "; phía FE không đo trên dev server, không trỏ URL ngoài local/test, không gửi URL cho dịch vụ đo của bên thứ ba".
    **Gate:** nối "; điều kiện này áp cho từng phía có đụng (BE và FE)".
    **Khi fail:** thêm "agent FE trả `not_run` vì không dựng được bản build hoặc không có Chrome → dừng `blocked`, báo người dùng"; giữ nguyên các vế `blocked` + câu hỏi / P3 / diff ngoài phạm vi (áp cho từng phía).
    **Evidence:** "`git hash-object` của script và file bảng điều kiện **của từng phía** (BE và FE) sau khi chốt (mốc bất biến cho Bước 5)".
  - **Bước 3** (`profile`, hai phía): Thực hiện tương tự Bước 2 (chế độ `profile`); Hành động: xoá câu chờ FE, thêm "Phía FE: agent profile theo thứ tự bundle → render (React Profiler) → main thread (trace), dùng lại bảng điều kiện của Bước 2, nêu bottleneck + giả thuyết kèm evidence (số đo, `file:line` hoặc tên chunk/component), đề xuất danh sách file/hàm cho `frontend-fixer`; lệnh/config bật profiler ghi vào report Bước 3"; Gate: hash của script + bảng điều kiện **từng phía** bằng mốc Bước 2, diff chỉ `perf/`, `bench/`, config tool đo; Khi fail/Evidence: giữ luật hash + diff, nêu từng phía; quyết định làm đổi điều kiện đo → quay lại Bước 2.
  - **Bước 5** (`measure`, hai phía): Thực hiện tương tự; Hành động: xoá câu chờ FE, thêm "Phía FE: agent build lại bản production và phục vụ lại từ working tree, xác nhận là bản mới (hash file build hoặc tên chunk khác baseline) trước khi đo, rồi chạy lại đúng script + bảng điều kiện của Bước 2 (≥ 3 lần), lập bảng baseline vs sau"; Gate: "hash của từng phía bằng mốc Bước 2; kết luận đạt/không đạt theo từng phía; nhiễu vượt P3 → không kết luận" (giữ các vế hiện có); Evidence: hash từng phía.
  - Bảng lỗi: thêm hàng `| Bản build FE không dựng được hoặc không có Chrome (Bước 2/5, \`not_run\`) | Dừng \`blocked\`, báo người dùng cung cấp môi trường; không tối ưu khi chưa có baseline |`.
  - DoD: giữ nguyên (đã nêu "bảng điều kiện đo + ≥ 3 lần"); thêm "(từng phía có đụng)" vào dòng Baseline và dòng Số đo sau nếu chưa có.
  Wrap ~110 cột; không dùng dấu `?` trong body commit (không áp cho file).

- [ ] **Step 5: `plugins/backend/agents/backend-performance-analyst.md`** — Quy trình bước 1: nối "Khi workflow có cả hai phía, ghi artifact vào `perf/backend/` (phía frontend dùng `perf/frontend/`)." Không đổi gì khác (agent này không có assert so khớp spec).

- [ ] **Step 6:** `npm test` → xanh (assert cũ khối 20 về Bước 2/3/5 — hash, diff, blocked, `tiến trình mới` — phải xanh, không nới).

- [ ] **Step 7: Kiểm có răng** — tạm xoá `"frontend/frontend-performance",` khỏi `plugins/_published.json` → `✗ offeredCatalog: vẫn offer workflows/workflow-performance` đỏ → `git checkout -- plugins/_published.json` → xanh. Ghi lại output.

- [ ] **Step 8: Commit**

```text
fix(workflows): dispatch performance frontend measure and profile to frontend-performance-analyst

Changed:
- workflow-performance Bước 2/3/5 giao phía FE cho agent frontend-performance-analyst chạy song song backend-performance-analyst; bỏ câu chờ "Phía FE: chưa có skill"; mỗi phía dùng thư mục con perf/backend/ và perf/frontend/.
- Gate và Evidence nêu git hash-object của từng phía so với mốc Bước 2; Bước 5 build lại bản production và xác nhận bản mới; thêm hàng lỗi bản build FE không dựng được hoặc không có Chrome.
- backend-performance-analyst ghi artifact vào perf/backend/ khi có cả hai phía; khối validate 23 thêm assert workflow, assert khối 20 đòi câu chờ FE được đảo chiều.

Reason:
- G-Q8 của spec backend-performance: phía FE ở session chính không có bảng điều kiện đo, gate diff hay mốc hash (spec 2026-10-01-frontend-performance-design §5).
```

---

### Task 6: Docs

**Files:** `README.md`, `README_VI.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md`, `docs/superpowers/specs/2026-09-30-backend-performance-design.md`, `test/validate.mjs`.

- [ ] **Step 1: Assert đỏ (khối 23)**

```js
  for (const [f, head] of [['README.md', '### Agents (18)'], ['README_VI.md', '### Agent (18)']]) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(rd.split('\n').some((l) => l.trim() === head), `${f}: heading ${head}`);
    ok(row('frontend-performance-analyst').includes('WF09') && row('frontend-performance-analyst').includes('frontend-performance'),
      `${f}: bảng agent có frontend-performance-analyst dùng ở WF09`);
    ok((rd.split('\n').find((l) => l.startsWith('| WF09 |')) ?? '').includes('frontend-performance-analyst'),
      `${f}: WF09 liệt kê frontend-performance-analyst`);
  }
  ok(flat23(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`frontend` (10 skills published'),
    'CLAUDE.md: frontend 10 skill published (gồm frontend-performance)');
  ok(flat23(fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8')).includes('`frontend-performance`'),
    'CLAUDE.md: nêu frontend-performance');
  ok(flat23(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'superpowers', 'specs', '2026-09-30-backend-performance-design.md'), 'utf8'))
    .includes('2026-10-01-frontend-performance-design.md'),
    'spec backend-performance: G-Q8 trỏ tới spec frontend-performance (đã làm)');
```

- [ ] **Step 2:** validate → đỏ nhóm trên; riêng assert `### Agents (17)` ở khối 22 sẽ đỏ sau khi sửa README (xử lý ở Step 6).

- [ ] **Step 3: README.md / README_VI.md**
  - `### Agents (17)` → `(18)`; `### Agent (17)` → `(18)`.
  - Thêm hàng `| \`frontend-performance-analyst\` | frontend | write | frontend-performance | WF09 |` ngay sau hàng `frontend-fixer` (giữ 5 ô).
  - Hàng `| WF09 | \`workflow-performance\` | … |` cột agent: `backend-performance-analyst, frontend-performance-analyst, backend-fixer, frontend-fixer, backend-reviewer, frontend-reviewer`.
  - Hàng plugin `frontend`: cột Skills thêm `frontend-performance` và số skill (đọc hàng thật, đổi tối thiểu). Bỏ câu về FE còn mở nếu có (`grep -n "frontend performance\|Frontend performance" README*.md`).

- [ ] **Step 4: `CLAUDE.md`** Conventions: `frontend` (9 skills published incl. …) → `frontend` (10 skills published incl. `frontend-fix`, `frontend-data-integration`, `frontend-e2e-testing`, `frontend-performance`, …). Đọc đoạn thật, đổi tối thiểu.

- [ ] **Step 5: Specs**
  - `2026-09-29-skill-plugin-workflow-upgrade-design.md`: §13.1 thêm hàng `| Frontend performance (skill + agent + nối workflow-performance) | (xem git log) | (xem git log) |`; §13.2 xoá hàng "Frontend performance" (~dòng 696); §8.1 catalog thêm hàng `frontend-performance-analyst | frontend | write | frontend-performance | performance | mới (2026-10-01)` và tăng +1 số trong tiêu đề catalog; dòng trạng thái đầu file nếu nêu "FE perf còn lại" → xoá. Đọc từng dòng trước khi sửa.
  - `2026-09-30-backend-performance-design.md`: G-Q8 (§8) → "Đã làm — [`2026-10-01-frontend-performance-design.md`](2026-10-01-frontend-performance-design.md)"; dòng "Frontend performance chưa có; workflow chỉ có câu chờ." (~323) → cập nhật thành đã làm.
  - `2026-10-01-frontend-performance-design.md`: dòng "Trạng thái" → "Đã duyệt và thực thi (2026-10-01)".

- [ ] **Step 6:** Khối 22 của `test/validate.mjs`: xoá **chỉ** dòng assert heading `ok(rd.split('\n').some((l) => l.trim() === head), \`${f}: heading ${head}\`);` (và biến `head` trong destructuring nếu thành thừa); giữ assert hàng agent/WF07; khối 23 đã assert `(18)`. Nếu khối 20/21 còn assert đếm khác dính README, xử lý tương tự — ghi lại dòng nào.

- [ ] **Step 7:** `node test/validate.mjs` → 0 fail; `npm test` xanh; `npm run pack:verify` xanh.

- [ ] **Step 8: Commit**

```text
docs: document frontend-performance-analyst and close frontend performance in upgrade spec

Changed:
- README/README_VI: 18 agent, thêm frontend-performance-analyst (WF09), cột agent WF09, plugin frontend 10 skill; CLAUDE.md cập nhật 10 skill published.
- Spec 2026-09-29: Frontend performance đánh dấu xong ở §13, catalog agent +1; spec backend-performance: G-Q8 trỏ tới spec frontend; khối validate 23 thêm assert docs, khối 22 bỏ assert heading (17).

Reason:
- Tài liệu phải khớp catalog và workflow sau khi thêm skill và agent (spec 2026-10-01-frontend-performance-design §6.2).
```

---

### Task 7: Smoke sandbox (không commit)

- [ ] `npm run build`
- [ ] Sandbox (Node, không `rm -rf`):

```bash
SB="$(node -e "console.log(require('os').tmpdir())")/aip-fp-smoke" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true});require('fs').mkdirSync(process.argv[1],{recursive:true})" "$SB" && AIE_INSTALL_ROOT="$SB" node cli/index.mjs install --provider claude --skill workflows/workflow-performance --yes && node -e "const m=require(process.argv[1]+'/.ai-engineering/manifest.json');console.log(JSON.stringify(m,null,1).split('\n').filter(l=>/performance/.test(l)).join('\n'))" "$SB" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$SB"
```

Expected: manifest có `.claude/skills/frontend-performance`, `.claude/skills/backend-performance`, `.claude/agents/frontend-performance-analyst.md`, `.claude/agents/backend-performance-analyst.md`, `.claude/skills/workflow-performance`; `git status --short` sạch.

---

## Self-Review

**1. Spec coverage**

| Spec | Task |
|---|---|
| §3 skill (+ §3.1 references) | 1, 2 |
| §6.1 publish | 3 |
| §4 agent | 4 |
| §5 workflow (+ đảo assert khối 20, agent BE 1 câu) | 5 |
| §6.2 docs | 6 |
| §6.3 test (khối 23) | 1–6 |
| §6.4 smoke | 7 |

**2. Placeholder scan:** Task 6 Step 5 ghi `(xem git log)` có chủ ý (tránh tự tham chiếu hash). Không TBD khác.

**3. Type consistency:** `flat23`, `wf23`, `step23`, `field23`, `feDir23`, `feSkill23` định nghĩa Task 1, `feRef23` Task 2, dùng Task 2–6; `offeredCatalog`, `parseSteps`, `workflows`, `PLUGINS_DIR`, `REPO_ROOT` có sẵn đầu `validate.mjs`.

**4. Review Focus:** (1) Task 5 Step 7 teeth + assert offered; (2) Task 1/4 assert cấm dev server, staging/production, dịch vụ ngoài; (3) Task 1/2/4 assert INP/TBT/lab; (4) Task 5 assert hash từng phía; (5) Task 5 Step 2 đảo assert khối 20; (6) Task 5 Step 5 `perf/backend/`.
