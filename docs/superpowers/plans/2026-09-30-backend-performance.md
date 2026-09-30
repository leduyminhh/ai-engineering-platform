# Backend Performance (G10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm skill `backend-performance` (chế độ `measure` / `profile`, cổng P1–P5, 6 file `references/`) và agent `backend-performance-analyst`, publish, rồi giao Bước 2 (Baseline), 3 (Profile) và 5 (Benchmark) của `workflow-performance` cho agent.

**Architecture:** Nội dung canonical ở `plugins/backend/skills/…`, `plugins/backend/agents/…`, `workflows/performance/WORKFLOW.md`; hợp đồng được `test/validate.mjs` kiểm bằng assert chuỗi/regex. Wizard ẩn workflow có closure chưa publish (`cli/lib/install.mjs:355`) → thứ tự bắt buộc: skill → references → **publish** → agent → nối workflow. Assert mới gom vào khối `// 20.` ở cuối `test/validate.mjs` (khối 18, 19 không đụng).

**Tech Stack:** Node.js 20+, ESM, zero dependency. `node test/validate.mjs`, `npm test`, `npm run build`.

**Spec:** [`docs/superpowers/specs/2026-09-30-backend-performance-design.md`](../specs/2026-09-30-backend-performance-design.md)

## Global Constraints

- File UTF-8 **không BOM**, LF; nội dung tiếng Việt có dấu; frontmatter key / identifier tiếng Anh; wrap ~110 cột.
- Skill: `name: backend-performance`, `order: 10`, `stageNumber: "10"`, `runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`.
- Agent: `name: backend-performance-analyst`, `mode: write`, `skills: "backend-performance"`, đủ 4 heading `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`.
- `workflow-performance` giữ **7 bước**, giữ ⏸ ở Bước 3 và 7; mỗi trường `- **Thực hiện:** …` viết trên **MỘT dòng** (`stepRefs` ở `cli/lib/workflows.mjs:49-56` chỉ đọc dòng đầu).
- Mọi `agent \`x\`` trong bước phải có trong frontmatter `agents:` (`test/validate.mjs:314-315`).
- Load test / profile chỉ trên local/test; từ chối staging/production; thiếu môi trường → `not_run`.
- Lệnh/cờ công cụ trong `references/` chưa đối chiếu tài liệu chính thức → gắn `[Unverified]`.
- Mỗi task = 1 commit qua `core:git-workflow`: header tiếng Anh, body tiếng Việt (Changed/Reason), message ghi ra file UTF-8 rồi `git commit -F`. **Không `Co-Authored-By`.** Không push.
- Nhánh: `feature/backend-performance` (cắt từ `docs/backend-performance-spec` = master `d0cc23f` + spec + plan).
- Dọn sandbox bằng Node `fs.rmSync`, không `rm -rf` (junction Windows).

## Review Focus

1. **Bước 5 đổi điều kiện đo so với Bước 2** → so sánh vô nghĩa. Task 5 assert Bước 5 Đầu vào nêu "Bước 2" và Ràng buộc nêu "điều kiện".
2. **Nối trước publish** → wizard ẩn `workflow-performance`. Task 3 publish trước; Task 5 assert `offeredCatalog` vẫn chứa workflow và kiểm có răng.
3. **Analyst ghi ngoài `perf/`/`bench/`** (vd sửa `src/`) → mất tách bạch với fixer. Task 5 assert Gate Bước 2/3 chứa `perf/` và `git diff --name-only`.
4. **Thiếu môi trường ở Bước 2 mà workflow vẫn đi tiếp tối ưu.** Task 5 assert bảng lỗi / Khi fail Bước 2 có `blocked`.
5. **Kết luận từ số đo nhiễu.** Task 1 assert skill có P3 với ngưỡng 10%; Task 5 assert Bước 5 Gate nêu "nhiễu".

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-performance/SKILL.md` | Recipe đo + profile, P1–P5 | 1 |
| `plugins/backend/skills/backend-performance/references/*.md` (6 file) | Chi tiết theo công cụ | 2 |
| `test/validate.mjs` (khối `// 20.` cuối file, sau `}` của khối 19, trước `// ───…` + `console.log('')`) | Assert đợt này | 1–6 |
| `plugins/_published.json`, `plugins/_cowork.json`, `plugins/backend/.manifest.json`, `test/install.test.mjs:183` | Publish | 3 |
| `plugins/backend/agents/backend-performance-analyst.md` | Agent | 4 |
| `workflows/performance/WORKFLOW.md` | Bước 1/2/3/5, frontmatter, tiền điều kiện, bảng lỗi, DoD | 5 |
| `README.md`, `README_VI.md`, `CLAUDE.md:83`, spec 2026-09-29 | Docs | 6 |

---

### Task 0: Nhánh

- [ ] `git checkout docs/backend-performance-spec && git checkout -b feature/backend-performance`; `npm test` xanh (mốc: validate 1792/0, install 204/0, wizard 58/0).

---

### Task 1: `SKILL.md` + mở khối 20

**Files:** Create `plugins/backend/skills/backend-performance/SKILL.md`; Modify `test/validate.mjs`.

**Interfaces — Produces:** skill id `backend/backend-performance`; helper khối 20: `flat20(t)`, `wf20(id)`, `step20(wf, n)`, `field20(body, name)` (cùng hành vi `field19`: cắt thân bước thô từ dòng cột 0 `- **<name>:**` tới dòng cột 0 `- **` kế tiếp, trả text đã flatten GỒM nhãn; không thấy → `''`), `perfSkill` (text SKILL.md).

- [ ] **Step 1: Mở khối 20 với helper + assert skill (đỏ)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 20. SOURCE: backend-performance skill + agent + workflow-performance Bước 2/3/5 (spec 2026-09-30-backend-performance-design)
{
  const flat20 = (t) => t.replace(/\s+/g, ' ');
  const wf20 = (id) => workflows.stages.find((s) => s.id === id);
  const step20 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  // Cắt đúng một trường cột 0 để assert không khớp nhầm chữ của trường khác trong cùng bước.
  const field20 = (body, name) => {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lines = body.split('\n');
    const i = lines.findIndex((l) => new RegExp(`^- \\*\\*${esc}:\\*\\*`).test(l));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return flat20(lines.slice(i, j).join('\n'));
  };
  const perfDir = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-performance');
  const perfSkill = fs.existsSync(path.join(perfDir, 'SKILL.md')) ? fs.readFileSync(path.join(perfDir, 'SKILL.md'), 'utf8') : '';
  ok(perfSkill.length > 0, 'backend-performance: có SKILL.md');
  ok(/^order: 10$/m.test(perfSkill) && /^pipeline: false$/m.test(perfSkill) && /^runsIn: execute$/m.test(perfSkill),
    'backend-performance: frontmatter order 10, pipeline false, runsIn execute');
  ok(/^description: .*backend-fix/m.test(perfSkill) && /^description: .*backend-testing/m.test(perfSkill),
    'backend-performance: description nêu ranh giới với backend-fix và backend-testing');
  for (const g of ['P1', 'P2', 'P3', 'P4', 'P5']) ok(new RegExp(`^\\| ${g} `, 'm').test(perfSkill), `backend-performance: bảng gate có ${g}`);
  ok(perfSkill.includes('`measure`') && perfSkill.includes('`profile`'), 'backend-performance: có 2 chế độ measure / profile');
  ok(/^\| P3 [^\n]*10%/m.test(perfSkill), 'backend-performance: P3 có ngưỡng độ lệch mặc định 10%');
  ok(/^\| P1 [^\n]*staging\/production/m.test(perfSkill) && flat20(perfSkill).includes('not_run'),
    'backend-performance: P1 từ chối staging/production, thiếu môi trường → not_run');
  ok(/≥\s?3/.test(perfSkill) && perfSkill.includes('`perf/`') && perfSkill.includes('`bench/`'),
    'backend-performance: đo ≥3 lần, script ở perf/ và bench/');
  ok(/^\| P5 [^\n]*`src\/`/m.test(perfSkill), 'backend-performance: P5 cấm sửa src/ production');
}
```

- [ ] **Step 2:** `node test/validate.mjs` → đỏ chỉ ở các dòng `backend-performance: …` (11 dòng).

- [ ] **Step 3: Viết `SKILL.md`**

```markdown
---
name: backend-performance
description: "Recipe on-demand: ĐO và PROFILE hiệu năng BACKEND (Java/Spring, Python) — chế độ measure chốt bảng điều kiện đo (môi trường local/test, dữ liệu seed, mô hình tải, warm-up, số lần lặp), viết/tái dùng script load test (k6) ở perf/ hoặc micro-benchmark (JMH, pytest-benchmark) ở bench/, chạy ≥3 lần, báo p50/p95/p99, throughput, error rate và độ lệch; chế độ profile tìm bottleneck theo thứ tự DB (đếm query, N+1, EXPLAIN ANALYZE) → CPU/alloc (JFR, async-profiler, py-spy, cProfile) → I/O/pool/lock, có evidence đo được, và đề xuất danh sách file/hàm cho backend-fix. Chỉ chạy trên local/test, từ chối staging/production; thiếu môi trường → not_run. KHÔNG sửa code production (đó là backend-fix); KHÔNG thay test đúng/sai (đó là backend-testing). Dùng skill NÀY khi người dùng muốn \"đo hiệu năng backend\", \"load test\", \"benchmark\", \"profile\", \"tìm bottleneck\", \"p95/p99\", \"N+1\", \"query chậm\", \"latency API\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 10
stageNumber: "10"
title: "Backend Performance — Đo và profile hiệu năng backend có điều kiện tái lập (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Backend Performance — Đo và profile hiệu năng backend có điều kiện tái lập (recipe on-demand)

Recipe hướng dẫn agent **đo** hiệu năng BACKEND (Java/Spring, Python) với **điều kiện tái lập được** và
**profile** để tìm bottleneck **có evidence**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc, KHÔNG
phải bộ công cụ dựng sẵn. Gọi độc lập hoặc từ Bước 2 (Baseline), Bước 3 (Profile & giả thuyết), Bước 5 (Benchmark
& so sánh) của `workflow-performance`.

## Ranh giới với skill lân cận

| Skill | Việc |
|---|---|
| `backend-testing` | test đúng/sai (pass/fail) |
| **`backend-performance`** | **đo số** (latency/throughput/memory) + **tìm bottleneck**; không sửa code production |
| `backend-fix` chế độ `performance` | sửa theo giả thuyết; không tự kết luận nhanh hơn |
| `backend-code-review` trục performance | đọc diff tìm N+1/thiếu index; không đo |

## Hai chế độ

### `measure` — Baseline (Bước 2) và Benchmark (Bước 5)

1. Chốt **bảng điều kiện đo** theo mẫu [references/measure-conditions.md](references/measure-conditions.md):
   môi trường (host local/test), phiên bản build, dữ liệu seed, endpoint/luồng, mô hình tải (VU hoặc RPS, thời
   lượng, ramp), warm-up, số lần lặp, công cụ + phiên bản, ngưỡng độ lệch.
2. Viết hoặc tái dùng script: load test ở `perf/` ([references/k6.md](references/k6.md)); micro-benchmark ở
   `bench/` ([references/jmh-pytest-benchmark.md](references/jmh-pytest-benchmark.md)). Ưu tiên công cụ project
   đã có; chưa có → đề xuất mặc định (k6, JMH, pytest-benchmark) và **hỏi trước** khi thêm tool/dependency.
3. Chạy **≥ 3 lần**; ghi p50/p95/p99, throughput, error rate và độ lệch giữa các lần.
4. Ở Bước 5: đọc bảng điều kiện + script của Bước 2 và **chạy lại nguyên trạng**. Điều kiện lệch (build khác ngoài
   thay đổi tối ưu, dữ liệu khác, tải khác) → từ chối so sánh, báo.

### `profile` — Profile & giả thuyết (Bước 3)

Thứ tự tầng rẻ → đắt; dừng ở tầng tìm ra bottleneck có evidence:

1. **DB:** đếm query mỗi request (bắt N+1), `EXPLAIN ANALYZE` query chậm, slow query log —
   [references/db-query-analysis.md](references/db-query-analysis.md).
2. **CPU/alloc:** JFR / async-profiler (Java), py-spy / cProfile (Python), chạy trong lúc có tải của `measure` —
   [references/profiling-java.md](references/profiling-java.md), [references/profiling-python.md](references/profiling-python.md).
3. **I/O, pool, lock:** thread dump, metric connection pool, thời gian chờ lock.

Đầu ra: bottleneck + evidence (`file:line`, số đo, trích đoạn flame graph/EXPLAIN); giả thuyết nguyên nhân; **danh
sách file/hàm đề xuất sửa** (đầu vào F2 của `backend-fix`).

## Ranh giới an toàn (CLAUDE.md)
- **Chỉ local/test.** Không trỏ tải vào staging/production; không dùng hay in credential thật (chỉ nêu tên biến
  môi trường). Thiếu môi trường → `not_run` + lý do; không tự dựng hạ tầng.
- **Không sửa code production.** Chỉ ghi `perf/`, `bench/` và config tool đo; không sửa `src/`, không sửa test,
  không chạy DDL/migration. Phát hiện bottleneck → chỉ đề xuất danh sách file cho `backend-fix`.
- **Hỏi trước khi thêm tool/dependency** (k6, JMH, pytest-benchmark, async-profiler, py-spy).
- **Không push thẳng main.** Script đo là artifact; con người **duyệt diff** trước khi commit.
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng số và lệnh THẬT; không dùng "nhanh hơn rõ rệt", "tối ưu hoàn toàn"; luôn nêu
  **residual risk** (nhiễu môi trường, dữ liệu seed khác production, JIT warm-up).
- Lệnh/cờ công cụ trong `references/` chưa đối chiếu tài liệu chính thức gắn `[Unverified]`.

## Bảng gate
| # | Gate | Nội dung | Chế độ | Đỏ thì |
|---|------|---------|--------|--------|
| P1 | Môi trường | Chỉ chạy trên local/test; host staging/production → từ chối | cả hai | Thiếu môi trường → `not_run` + lý do; không tự dựng hạ tầng |
| P2 | Điều kiện đo | Bảng điều kiện đo đầy đủ TRƯỚC khi chạy; Bước 5 dùng lại bảng Bước 2 | `measure` | Thiếu mục → dừng, hỏi |
| P3 | Ổn định | ≥ 3 lần; báo độ lệch; độ lệch p95 giữa các lần > 10% (mặc định, project ghi đè trong bảng điều kiện) → cảnh báo, không kết luận | `measure` | Tăng số lần lặp hoặc cô lập nhiễu |
| P4 | Evidence | Mọi giả thuyết có evidence đo được; không suy diễn chỉ từ đọc code | `profile` | Profile thêm |
| P5 | Phạm vi ghi | Chỉ ghi `perf/`, `bench/`, config tool đo; không sửa `src/` production, không sửa test, không chạy DDL/migration | cả hai | Gỡ thay đổi ngoài phạm vi |

## Sau khi xong
Báo: bảng điều kiện đo; bảng số (p50/p95/p99, throughput, error rate, độ lệch) + lệnh chạy; hoặc bottleneck +
evidence + giả thuyết + danh sách file/hàm đề xuất sửa; **residual risk**. Cần sửa code → route `backend-fix`;
cần test đúng/sai → route `backend-testing`.
```

- [ ] **Step 4:** `node test/validate.mjs` → khối 20 xanh. Link `references/…` trong SKILL.md trỏ tới file chưa có — validate hiện KHÔNG có assert kiểm link tồn tại (đã grep), nên không đỏ; Task 2 tạo file. Assert `P0 PL2: manifest backend nêu đủ skill (thiếu: backend-performance)` SẼ đỏ vì manifest chưa liệt kê skill — đây là đỏ dự kiến, Task 3 sửa (ghi nhận trong report, không sửa manifest ở task này).

- [ ] **Step 5:** `npm run build` → thấy `backend-performance` ở `build/claude`, `build/codex`.

- [ ] **Step 6: Commit**

```text
feat(backend): add backend-performance measure/profile skill

Changed:
- Thêm skill backend-performance (order 10): chế độ measure (bảng điều kiện đo, ≥3 lần, p50/p95/p99, độ lệch) và profile (DB → CPU/alloc → I/O, evidence, danh sách file cho backend-fix).
- Cổng P1–P5: chỉ local/test, điều kiện đo trước khi chạy, ổn định ≥3 lần + ngưỡng 10%, evidence đo được, chỉ ghi perf/ bench/.
- Mở khối validate 20 (helper flat20, wf20, step20, field20) và assert skill.

Reason:
- G10: Bước 2, 3, 5 của workflow-performance chưa có công cụ hay hướng dẫn đo/profile (spec 2026-09-30-backend-performance-design §3).
```

---

### Task 2: 6 file `references/`

**Files:** Create `plugins/backend/skills/backend-performance/references/{measure-conditions,k6,jmh-pytest-benchmark,profiling-java,profiling-python,db-query-analysis}.md`; Modify `test/validate.mjs` (khối 20).

Nội dung là tài liệu tiếng Việt, mỗi file 40–120 dòng. **Mọi lệnh/cờ công cụ chưa đối chiếu tài liệu chính thức ghi `[Unverified]` ngay cạnh.** Không bịa số liệu hiệu năng. Ví dụ script không trỏ host thật — dùng biến môi trường (`BASE_URL`) với giá trị mẫu `http://localhost:8080`.

- [ ] **Step 1: Assert đỏ (khối 20)**

```js
  const perfRefs = ['measure-conditions', 'k6', 'jmh-pytest-benchmark', 'profiling-java', 'profiling-python', 'db-query-analysis'];
  const perfRef = (n) => { const f = path.join(perfDir, 'references', `${n}.md`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
  for (const n of perfRefs) {
    ok(perfRef(n).length > 200, `backend-performance references/${n}.md: có nội dung`);
    ok(perfSkill.includes(`(references/${n}.md)`), `backend-performance: SKILL.md link tới references/${n}.md`);
  }
  ok(/\| *Môi trường *\|/.test(perfRef('measure-conditions')) && /warm-up/i.test(perfRef('measure-conditions')) && perfRef('measure-conditions').includes('10%'),
    'measure-conditions.md: bảng điều kiện đo có Môi trường, warm-up, ngưỡng 10%');
  ok(perfRef('k6').includes('__ENV.BASE_URL') && !/https?:\/\/(?!localhost|127\.0\.0\.1)[a-z]/i.test(perfRef('k6')),
    'k6.md: script mẫu lấy BASE_URL từ biến môi trường, không trỏ host ngoài localhost');
  ok(perfRef('jmh-pytest-benchmark').includes('@Benchmark') && perfRef('jmh-pytest-benchmark').includes('benchmark('),
    'jmh-pytest-benchmark.md: có ví dụ JMH @Benchmark và pytest-benchmark');
  ok(/JFR|jcmd/.test(perfRef('profiling-java')) && /async-profiler/.test(perfRef('profiling-java')),
    'profiling-java.md: có JFR và async-profiler');
  ok(/py-spy/.test(perfRef('profiling-python')) && /cProfile/.test(perfRef('profiling-python')),
    'profiling-python.md: có py-spy và cProfile');
  ok(/EXPLAIN ANALYZE/.test(perfRef('db-query-analysis')) && /N\+1/.test(perfRef('db-query-analysis')),
    'db-query-analysis.md: có EXPLAIN ANALYZE và N+1');
  ok(perfRefs.every((n) => perfRef(n).includes('[Unverified]') || !/`[a-z0-9-]+ [^`]*--/.test(perfRef(n))),
    'backend-performance references: lệnh có cờ công cụ phải gắn [Unverified] trong file');
```

- [ ] **Step 2:** validate → đỏ ở các dòng `references/…` (không đỏ chỗ khác).

- [ ] **Step 3: Viết 6 file theo khung sau**

`measure-conditions.md`
- Mục đích: vì sao cần bảng điều kiện (Bước 5 so với Bước 2).
- **Bảng mẫu** (cột `Mục | Giá trị | Ghi chú`), các hàng bắt buộc: Môi trường (host local/test, CPU/RAM), Build (commit/phiên bản), Dữ liệu seed (kích thước, cách tạo), Endpoint/luồng, Mô hình tải (VU hoặc RPS, thời lượng, ramp), Warm-up, Số lần lặp (≥ 3), Công cụ + phiên bản, Ngưỡng độ lệch (mặc định 10% p95).
- Cách đọc percentile (p50/p95/p99), throughput, error rate; vì sao không dùng trung bình.
- Cách tính độ lệch giữa các lần (max−min)/median của p95; khi vượt ngưỡng: tăng lặp, tắt tiến trình nền, cố định CPU governor `[Unverified]`.
- Mẫu bảng kết quả baseline vs sau.

`k6.md`
- Khi nào dùng k6 (HTTP API); cài đặt là thay đổi tool → hỏi trước.
- Script mẫu `perf/<luồng>.js`: `import http from 'k6/http'`, `const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080'`, `options` với `stages` (ramp) hoặc `vus`/`duration`, `thresholds` ví dụ `http_req_duration: ['p(95)<…']`, `check` status.
- Lệnh chạy mẫu `k6 run -e BASE_URL=http://localhost:8080 perf/<luồng>.js` và xuất summary JSON `[Unverified]` cho cờ export.
- Cách lấy p50/p95/p99, throughput, error rate từ summary; chạy 3 lần.
- Cảnh báo: không trỏ BASE_URL vào staging/production; credential qua biến môi trường.

`jmh-pytest-benchmark.md`
- Khi nào dùng micro-benchmark (hàm/thuật toán nóng) vs load test.
- JMH: class mẫu với `@Benchmark`, `@Warmup`, `@Measurement`, `@Fork`, `@State`; chạy qua plugin build (Maven/Gradle) `[Unverified]` tên plugin/task; chống dead-code elimination (`Blackhole`).
- pytest-benchmark: ví dụ `def test_x(benchmark): benchmark(fn, arg)`; lệnh `pytest --benchmark-only` `[Unverified]`; so sánh lần chạy `[Unverified]`.
- Cảnh báo: benchmark tự viết không qua JMH trên JVM dễ sai do JIT; không so số micro-benchmark với load test.

`profiling-java.md`
- JFR: bật khi chạy (`-XX:StartFlightRecording=…`) hoặc `jcmd <pid> JFR.start` `[Unverified]` cờ; đọc bằng JDK Mission Control; nhìn Hot Methods, Allocation, Lock.
- async-profiler: CPU/alloc/lock flame graph, attach bằng pid `[Unverified]` lệnh; cần quyền hệ thống, có thể không chạy trên Windows/container → `not_run`.
- Chạy profile trong lúc có tải của `measure`; ghi evidence `file:line` từ frame nóng.
- Spring: bật log SQL hoặc datasource-proxy để đếm query (trỏ `db-query-analysis.md`).

`profiling-python.md`
- py-spy: `py-spy record -o profile.svg --pid <pid>` / `py-spy top` `[Unverified]`; cần quyền attach.
- cProfile: `python -m cProfile -o out.prof …` + `pstats`/snakeviz `[Unverified]`.
- Framework web (Django/FastAPI/Flask): profile trong lúc có tải; đếm query ORM (trỏ `db-query-analysis.md`).
- Ghi evidence `file:line` từ hàm tốn thời gian.

`db-query-analysis.md`
- Đếm query/request để bắt **N+1** (Hibernate statistics / datasource-proxy cho Java; Django `connection.queries` / SQLAlchemy event cho Python) `[Unverified]` tên API chính xác.
- `EXPLAIN ANALYZE` (PostgreSQL) / `EXPLAIN ANALYZE` hoặc `EXPLAIN FORMAT=…` (MySQL) — đọc seq scan, rows estimate vs actual, sort/hash spill.
- Chỉ chạy EXPLAIN ANALYZE trên DB test (EXPLAIN ANALYZE **thực thi** câu lệnh — với UPDATE/DELETE phải bọc transaction rồi rollback) — ghi rõ cảnh báo.
- Slow query log: bật trên DB test.
- Đầu ra: query + `file:line` gọi + đề xuất (index, fetch join, batch) → danh sách file cho `backend-fix`; **không** tự thêm index/migration (P5).

- [ ] **Step 4:** validate → 0 fail; `npm run build`.

- [ ] **Step 5: Commit**

```text
feat(backend): add backend-performance references for tools and measure conditions

Changed:
- Thêm 6 file references: bảng điều kiện đo, k6, JMH + pytest-benchmark, profiling Java (JFR, async-profiler), profiling Python (py-spy, cProfile), phân tích query DB (EXPLAIN ANALYZE, N+1).
- Lệnh/cờ chưa đối chiếu tài liệu chính thức gắn [Unverified]; script mẫu lấy BASE_URL từ biến môi trường.
- Khối validate 20 thêm assert references.

Reason:
- Spec 2026-09-30-backend-performance-design §3.1: giữ SKILL.md gọn, tách chi tiết theo công cụ.
```

---

### Task 3: Publish (trước khi nối workflow)

**Files:** `plugins/_published.json`, `plugins/_cowork.json`, `plugins/backend/.manifest.json`, `test/install.test.mjs:183`, `test/validate.mjs` (khối 20).

- [ ] **Step 1: Assert đỏ**

```js
  const pub20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub20.includes('backend/backend-performance'), '_published.json: có backend/backend-performance (publish trước khi nối workflow)');
  const cowork20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork20.includes('backend:backend-performance'), '_cowork.json: có backend:backend-performance');
  const beMan20 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, 'backend', '.manifest.json'), 'utf8'));
  ok(beMan20.version === '1.5.0', 'backend manifest: version 1.5.0');
```

- [ ] **Step 2:** validate đỏ ở 3 dòng trên **và** `P0 PL2: manifest backend nêu đủ skill (thiếu: backend-performance)` (đã đỏ từ Task 1 — nếu Task 1 báo dòng này thì đây là nơi sửa). install.test xanh.

- [ ] **Step 3:** `_published.json`: sau `"backend/backend-fix",` thêm `"backend/backend-performance",`. `_cowork.json`: sau `"backend:backend-fix",` thêm `"backend:backend-performance",`.

- [ ] **Step 4:** `plugins/backend/.manifest.json`: `"version": "1.4.0"` → `"1.5.0"`; cuối `description` thay `backend-fix (sửa code có sẵn theo oracle đỏ, phạm vi khoanh trước).` bằng `backend-fix (sửa code có sẵn theo oracle đỏ, phạm vi khoanh trước), backend-performance (đo và profile hiệu năng có điều kiện tái lập, chỉ local/test).`

- [ ] **Step 5:** `node test/install.test.mjs` → đỏ `offeredCatalog: vẫn offer đủ 9 skill backend …`. Sửa `test/install.test.mjs:183`: `=== 9` → `=== 10`, message `'offeredCatalog: vẫn offer đủ 10 skill backend đã publish'`.

- [ ] **Step 6:** `npm test && npm run pack:verify` → xanh.

- [ ] **Step 7: Commit**

```text
feat(publish): publish backend-performance skill

Changed:
- Thêm backend/backend-performance vào _published.json và _cowork.json; manifest backend 1.5.0 liệt kê skill mới.
- install.test: backend offer 10 skill; khối validate 20 thêm assert publish.

Reason:
- Publish trước khi nối agent vào workflow-performance vì offeredCatalog ẩn workflow có closure chưa publish (spec 2026-09-30-backend-performance-design G-Q6).
```

---

### Task 4: Agent `backend-performance-analyst`

**Files:** Create `plugins/backend/agents/backend-performance-analyst.md`; Modify `test/validate.mjs` (khối 20).

- [ ] **Step 1: Assert đỏ**

```js
  const paPath = path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-performance-analyst.md');
  const pa = fs.existsSync(paPath) ? fs.readFileSync(paPath, 'utf8') : '';
  ok(pa.length > 0, 'backend-performance-analyst: có agent file');
  ok(/^mode: write$/m.test(pa) && /^skills: "backend-performance"$/m.test(pa),
    'backend-performance-analyst: mode write, skills = backend-performance (đúng 1 skill)');
  const paScope = flat20(pa.split('## Phạm vi')[1]?.split('## Quy trình')[0] ?? '');
  ok(paScope.includes('`perf/`') && paScope.includes('`bench/`') && paScope.includes('`src/`') && paScope.includes('staging/production'),
    'backend-performance-analyst: Phạm vi chỉ ghi perf/ bench/, cấm sửa src/, cấm staging/production');
  ok(paScope.includes('not_run'), 'backend-performance-analyst: thiếu môi trường → not_run');
  ok(pa.includes('core:principles') && pa.includes('git diff --name-only'),
    'backend-performance-analyst: report theo core:principles, tự đối chiếu diff');
```

- [ ] **Step 2:** validate đỏ ở 5 dòng trên.

- [ ] **Step 3:** Tạo file với nội dung **nguyên văn** spec §4.2 (khối ```markdown từ `---` tới hết `## Report trả về`). Đọc spec `docs/superpowers/specs/2026-09-30-backend-performance-design.md` §4.2 và chép chính xác.

- [ ] **Step 4:** `npm run build` rồi `node test/validate.mjs` → 0 fail (assert agent chung ở `validate.mjs:276-286` cũng chạy cho agent mới).

- [ ] **Step 5: Commit**

```text
feat(agents): add backend-performance-analyst agent

Changed:
- Thêm agent backend-performance-analyst (skill backend-performance, mode write): đo/profile trên local/test, chỉ ghi perf/ bench/ config tool đo, không sửa src/, thiếu môi trường → not_run.
- Khối validate 20 thêm assert agent.

Reason:
- Spec 2026-09-30-backend-performance-design §4: tách vai "đo, không sửa" khỏi backend-fixer.
```

---

### Task 5: Nối `workflow-performance` (Bước 1, 2, 3, 5)

**Files:** `workflows/performance/WORKFLOW.md`; `test/validate.mjs` (khối 20).

- [ ] **Step 1: Assert đỏ**

```js
  const perfWf = wf20('workflow-performance');
  const pS1 = step20(perfWf, 1), pS2 = step20(perfWf, 2), pS3 = step20(perfWf, 3), pS5 = step20(perfWf, 5);
  for (const [n, s, mode] of [[2, pS2, 'measure'], [3, pS3, 'profile'], [5, pS5, 'measure']]) {
    ok(field20(s.body, 'Thực hiện').includes('agent `backend-performance-analyst`') && field20(s.body, 'Thực hiện').includes(`\`${mode}\``),
      `workflow-performance Bước ${n}: Thực hiện là backend-performance-analyst chế độ ${mode}`);
    ok(flat20(s.body).includes('Phía FE: chưa có skill'), `workflow-performance Bước ${n}: có câu chờ cho phía FE`);
  }
  ok(field20(pS1.body, 'Đầu ra').includes('điều kiện đo'), 'workflow-performance Bước 1: Đầu ra có điều kiện đo sơ bộ');
  for (const [n, s] of [[2, pS2], [3, pS3]]) {
    ok(field20(s.body, 'Gate').includes('`perf/`') && field20(s.body, 'Gate').includes('git diff --name-only'),
      `workflow-performance Bước ${n}: Gate so diff chỉ perf/ bench/ config tool đo`);
  }
  ok(field20(pS2.body, 'Khi fail').includes('blocked'), 'workflow-performance Bước 2: thiếu môi trường → dừng blocked');
  ok(field20(pS5.body, 'Đầu vào').includes('Bước 2') && field20(pS5.body, 'Ràng buộc').includes('điều kiện'),
    'workflow-performance Bước 5: dùng lại script + bảng điều kiện Bước 2, không đổi điều kiện');
  ok(field20(pS5.body, 'Gate').includes('nhiễu'), 'workflow-performance Bước 5: nhiễu vượt P3 → không kết luận');
  ok(pS3.checkpoint, 'workflow-performance Bước 3: giữ ⏸');
  ok(perfWf && perfWf.agents.includes('backend-performance-analyst'), 'workflow-performance: frontmatter agents có backend-performance-analyst');
  ok(parseSteps(perfWf?.body ?? '').length === 7, 'workflow-performance: vẫn 7 bước');
  ok((offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? []).includes('workflows/workflow-performance'),
    'offeredCatalog: vẫn offer workflows/workflow-performance (closure analyst đã publish)');
  const perfErr = flat20(perfWf?.body.split('## Xử lý lỗi')[1]?.split('## Definition of Done')[0] ?? '');
  ok(perfErr.includes('Môi trường đo thiếu') && perfErr.includes('lệch Bước 2') && perfErr.includes('Nhiễu vượt'),
    'workflow-performance: bảng lỗi có 3 hàng môi trường thiếu / điều kiện lệch / nhiễu');
```

- [ ] **Step 2:** validate → đỏ chỉ trong nhóm `workflow-performance …` (`vẫn 7 bước`, `Bước 3: giữ ⏸`, `offeredCatalog …` xanh).

- [ ] **Step 3: Frontmatter** `agents: "backend-performance-analyst,backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer"`

- [ ] **Step 4: Điều kiện tiên quyết** — dòng đầu:

```markdown
- Skill/agent đã cài: `backend-performance-analyst`, `backend-fixer`, `frontend-fixer`, `backend-reviewer`,
  `frontend-reviewer`, skill `core/git-workflow`.
```

- [ ] **Step 5: Bước 1** — Đầu ra `- **Đầu ra:** metric + ngưỡng mục tiêu.` → `- **Đầu ra:** metric + ngưỡng mục tiêu + điều kiện đo sơ bộ (môi trường local/test, endpoint/luồng, tải mục tiêu).`

- [ ] **Step 6: Thay toàn bộ Bước 2** (giữ `Thực hiện` trên một dòng):

```markdown
### Bước 2 — Baseline

- **Thực hiện:** agent `backend-performance-analyst` (chế độ `measure`; phía BE)
- **Đầu vào:** metric + ngưỡng + điều kiện đo sơ bộ từ Bước 1
- **Hành động:** session chính ghi mốc `git status --porcelain` rồi dispatch agent; agent chốt bảng điều kiện đo
  theo skill `backend-performance`, viết/tái dùng script trong `perf/` hoặc `bench/`, chạy ≥ 3 lần trên môi trường
  local/test, ghi p50/p95/p99, throughput, error rate, độ lệch. Phía FE: chưa có skill đo/profile frontend —
  session chính đo theo công cụ sẵn có của project, ghi `[giả định]` cho phần không kiểm chứng được.
- **Ràng buộc:** không đổi code production trước khi có baseline; không trỏ tải vào staging/production; thêm
  tool/dependency đo → hỏi trước.
- **Đầu ra:** bảng điều kiện đo + script đo + số đo baseline.
- **Gate:** bảng điều kiện đo đầy đủ; ≥ 3 lần + độ lệch; so với mốc đầu bước, file thay đổi hoặc mới trong bước
  (`git diff --name-only` và `git ls-files --others --exclude-standard`) chỉ gồm `perf/`, `bench/`, config tool đo.
- **Khi fail:** agent trả `not_run` vì thiếu môi trường local/test → dừng `blocked`, báo người dùng cung cấp môi
  trường (không có baseline thì không tối ưu); độ lệch vượt ngưỡng P3 → tăng số lần lặp hoặc cô lập nhiễu, đo lại.
- **Evidence:** report của agent (bảng điều kiện, bảng số, lệnh chạy) + danh sách file thay đổi so với mốc đầu bước.
```

- [ ] **Step 7: Bước 3** — sửa 3 trường, giữ Đầu ra hiện có:
  - Thực hiện: `- **Thực hiện:** agent \`backend-performance-analyst\` (chế độ \`profile\`; phía BE)`
  - Hành động: `- **Hành động:** agent profile theo thứ tự DB → CPU/alloc → I/O trong lúc chạy tải của Bước 2, nêu bottleneck + giả thuyết kèm evidence đo được, đề xuất danh sách file/hàm cho Bước 4; session chính trình người dùng xác nhận hướng tối ưu. Phía FE: chưa có skill đo/profile frontend — session chính đo theo công cụ sẵn có của project, ghi \`[giả định]\` cho phần không kiểm chứng được.` (wrap ~110 cột)
  - Gate: `- **Gate:** bottleneck có evidence đo được (không chỉ đọc code); có danh sách file được sửa; so với mốc đầu bước, file thay đổi hoặc mới (\`git diff --name-only\`, \`git ls-files --others --exclude-standard\`) chỉ gồm \`perf/\`, \`bench/\`, config tool đo.` (wrap)

- [ ] **Step 8: Thay toàn bộ Bước 5**

```markdown
### Bước 5 — Benchmark & so sánh

- **Thực hiện:** agent `backend-performance-analyst` (chế độ `measure`; phía BE)
- **Đầu vào:** code đã tối ưu từ Bước 4 + script và bảng điều kiện đo của Bước 2
- **Hành động:** agent chạy lại đúng script + bảng điều kiện của Bước 2 (≥ 3 lần), so với baseline, lập bảng
  baseline vs sau. Phía FE: chưa có skill đo/profile frontend — session chính đo theo công cụ sẵn có của project,
  ghi `[giả định]` cho phần không kiểm chứng được.
- **Ràng buộc:** không đổi điều kiện đo so với Bước 2 (môi trường, dữ liệu seed, tải, warm-up, số lần lặp); không
  so sánh số đo khác điều kiện với baseline.
- **Đầu ra:** số đo sau + kết luận đạt/không đạt ngưỡng.
- **Gate:** bảng baseline vs sau cùng điều kiện; đạt ngưỡng hoặc báo không đạt; độ lệch vượt ngưỡng P3 (nhiễu) →
  không kết luận.
- **Khi fail:** không đạt ngưỡng → báo rõ, quay lại Bước 3 tìm hướng khác hoặc dừng theo quyết định người dùng;
  điều kiện lệch Bước 2 → chạy lại đúng điều kiện; nhiễu vượt ngưỡng → đo lại.
- **Evidence:** report của agent (bảng baseline vs sau + lệnh đo).
```

- [ ] **Step 9: Bảng lỗi** — sau hàng `| Không có số đo trước/sau trên cùng điều kiện | … |` thêm:

```markdown
| Môi trường đo thiếu (Bước 2/5, `not_run`) | Dừng `blocked`, báo người dùng cung cấp môi trường local/test; không tối ưu khi chưa có baseline |
| Điều kiện Bước 5 lệch Bước 2 | Từ chối so sánh; chạy lại đúng điều kiện Bước 2 |
| Nhiễu vượt ngưỡng P3 (Bước 2/5) | Không kết luận; tăng số lần lặp hoặc cô lập nhiễu rồi đo lại |
```

- [ ] **Step 10: DoD** — `- [ ] Baseline đo đúng điều kiện — evidence: Bước 2` → `- [ ] Baseline đo đúng điều kiện (bảng điều kiện đo + ≥ 3 lần) — evidence: Bước 2`

- [ ] **Step 11:** `npm test` → xanh. Kiểm có răng: tạm xoá dòng `"backend/backend-performance",` trong `_published.json` → validate → `✗ offeredCatalog: vẫn offer workflows/workflow-performance …` đỏ → khôi phục `git checkout -- plugins/_published.json` → xanh.

- [ ] **Step 12: Commit**

```text
fix(workflows): dispatch performance baseline, profile and benchmark to analyst agent

Changed:
- workflow-performance Bước 2 (measure), Bước 3 (profile), Bước 5 (measure) giao agent backend-performance-analyst; Gate so diff chỉ perf/ bench/ config tool đo; câu chờ cho phía FE.
- Bước 5 bắt buộc chạy lại script + bảng điều kiện đo của Bước 2; nhiễu vượt P3 thì không kết luận; Bước 2 thiếu môi trường → dừng blocked.
- Bước 1 Đầu ra thêm điều kiện đo sơ bộ; frontmatter agents, tiền điều kiện, bảng lỗi (3 hàng), DoD cập nhật; số bước giữ 7.
- Khối validate 20 thêm assert workflow và assert workflow-performance vẫn được offer.

Reason:
- G10 (spec 2026-09-30-backend-performance-design §5): Bước 2, 3, 5 đang ở session chính không có công cụ hay hướng dẫn.
```

---

### Task 6: Docs

**Files:** `README.md`, `README_VI.md`, `CLAUDE.md:83`, `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md`, `test/validate.mjs` (khối 20).

- [ ] **Step 1: Assert đỏ**

```js
  for (const [f, head] of [['README.md', '### Agents (16)'], ['README_VI.md', '### Agent (16)']]) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (a) => rd.split('\n').find((l) => l.startsWith(`| \`${a}\` |`)) ?? '';
    ok(rd.split('\n').some((l) => l.trim() === head), `${f}: heading ${head}`);
    ok(row('backend-performance-analyst').includes('WF09'), `${f}: bảng agent có backend-performance-analyst dùng ở WF09`);
    ok((rd.split('\n').find((l) => l.startsWith('| WF09 |')) ?? '').includes('backend-performance-analyst'), `${f}: WF09 liệt kê backend-performance-analyst`);
    ok(!/^\| G10 \|/m.test(rd), `${f}: bảng Skill gaps bỏ G10`);
  }
```

- [ ] **Step 2:** validate đỏ ở 8 dòng README **và** các assert heading `(15)` của khối 19 sẽ đỏ sau khi sửa heading — xử lý ở Step 4.

- [ ] **Step 3: README.md / README_VI.md**
  - `### Agents (15)` → `### Agents (16)`; `### Agent (15)` → `### Agent (16)`.
  - Bảng agent: sau hàng `| \`backend-fixer\` | … |` thêm `| \`backend-performance-analyst\` | backend | write | backend-performance | WF09 |`.
  - Hàng `| WF09 | \`workflow-performance\` | … |` cột agent → `backend-performance-analyst, backend-fixer, frontend-fixer, backend-reviewer, frontend-reviewer`.
  - Bảng Skill gaps: xoá hàng `| G10 | …`.

- [ ] **Step 4:** Khối 19 có assert heading `['README.md', '### Agents (15)'], ['README_VI.md', '### Agent (15)']` → xoá **chỉ** các phần tử heading đó khỏi khối 19 bằng cách xoá dòng `ok(rd.split('\n').some((l) => l.trim() === head), …)` trong vòng lặp README của khối 19 và bỏ `head` khỏi destructure nếu không còn dùng (giữ các assert hàng agent của khối 19). Lý do: khối 20 assert heading `(16)` chính xác. Đọc code khối 19 trước; sửa tối thiểu.

- [ ] **Step 5: CLAUDE.md:83** — `\`backend\` (9 skills published incl. \`backend-fix\`,` → `\`backend\` (10 skills published incl. \`backend-fix\`, \`backend-performance\`,` (đọc câu thật; chỉ đổi mệnh đề backend).

- [ ] **Step 6: Spec 2026-09-29**
  - Dòng trạng thái đầu file: "P3 còn G10" → "P3 xong (G10 phần backend, 2026-09-30); frontend performance còn mở".
  - §9 hàng P3 cột Trạng thái: `…; còn G10 |` → `…; G10 backend xong trên nhánh \`feature/backend-performance\`; frontend performance còn mở |`.
  - §13.1 thêm hàng: `| G10 (backend) | nhánh \`feature/backend-performance\` | <SHA Task 1–5> |` (SHA thật lấy từ `git log --oneline`).
  - §13.2: sửa hàng `| G10 | … | Chưa có thiết kế |` → `| Frontend performance (Web Vitals/Lighthouse/React Profiler/bundle) | \`workflow-performance\` Bước 2/3/5 phía FE chỉ có câu chờ | Chưa có spec (G-Q8 của spec 2026-09-30-backend-performance-design) |`.

- [ ] **Step 7:** validate → 0 fail; `npm test` xanh.

- [ ] **Step 8: Commit**

```text
docs: document backend-performance-analyst and close G10 backend in upgrade spec

Changed:
- README/README_VI: heading 16 agent, thêm backend-performance-analyst (WF09), cột agent WF09, bỏ G10 khỏi Skill gaps.
- CLAUDE.md: backend 10 skill published.
- Spec 2026-09-29: P3 đánh dấu G10 backend xong, §13 ghi commit và mở mục frontend performance.
- validate: khối 20 assert README; khối 19 bỏ assert heading (15) đã được thay bằng (16).

Reason:
- Tài liệu phải khớp catalog và workflow sau khi thêm skill/agent đo hiệu năng backend.
```

---

### Task 7: Smoke (không commit)

- [ ] `npm run build`
- [ ] Sandbox (Node, không `rm -rf`):

```bash
SB="$(node -e "console.log(require('os').tmpdir())")/aip-perf-smoke" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true});require('fs').mkdirSync(process.argv[1],{recursive:true})" "$SB" && AIE_INSTALL_ROOT="$SB" node cli/index.mjs install --provider claude --skill workflows/workflow-performance --yes && node -e "const m=require(process.argv[1]+'/.ai-engineering/manifest.json');console.log(JSON.stringify(m,null,1).split('\n').filter(l=>/performance/.test(l)).join('\n'))" "$SB" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$SB"
```

Expected: manifest có `.claude/skills/backend-performance`, `.claude/agents/backend-performance-analyst.md`; `git status --short` sạch.

---

## Self-Review

**1. Spec coverage**

| Spec | Task |
|---|---|
| §3.1–3.6 skill (frontmatter, ranh giới, measure, profile, P1–P5, an toàn) | 1 |
| §3.1 references (6 file) | 2 |
| §6.1 publish | 3 |
| §4 agent | 4 |
| §5 workflow (Bước 1/2/3/5, frontmatter, tiền điều kiện, 3 hàng lỗi, DoD, câu chờ FE) | 5 |
| §6.2 docs | 6 |
| §6.4 smoke | 7 |

**2. Placeholder scan:** Task 6 Step 6 "<SHA Task 1–5>" là dữ liệu chỉ có sau khi commit. Task 1 để lại đúng 1 assert đỏ dự kiến (PL2 manifest) cho tới Task 3 — cùng mẫu đợt fixer; Task 3 chạy ngay sau Task 2.

**3. Type consistency:** `flat20`, `wf20`, `step20`, `field20`, `perfDir`, `perfSkill` định nghĩa Task 1; `perfRef`/`perfRefs` Task 2; dùng lại ở Task 3–6. `offeredCatalog`, `parseSteps`, `workflows`, `PLUGINS_DIR`, `REPO_ROOT` có sẵn đầu `validate.mjs`.

**4. Review Focus:** (1) Task 5 assert Bước 5 Đầu vào/Ràng buộc; (2) Task 3 trước Task 5 + assert offered + kiểm có răng; (3) Task 5 assert Gate Bước 2/3; (4) Task 5 assert Bước 2 Khi fail `blocked`; (5) Task 1 assert P3 10% + Task 5 assert Bước 5 Gate "nhiễu".
