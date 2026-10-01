# Thiết kế: Skill `backend-performance` + agent `backend-performance-analyst` — đo và profile cho `workflow-performance` (G10)

- Ngày: 2026-09-30
- Trạng thái: **Đã thực thi** trên nhánh `feature/backend-performance` (2026-09-30), chờ merge; sửa sau review
  toàn nhánh ghi ở §8.
- Phạm vi: đóng G10 (spec [`2026-09-25-agents-workflows-design.md`](2026-09-25-agents-workflows-design.md) §9;
  spec [`2026-09-29-skill-plugin-workflow-upgrade-design.md`](2026-09-29-skill-plugin-workflow-upgrade-design.md)
  §5.1, §13.2) cho **phía backend**: cung cấp công cụ và chủ sở hữu cho Bước 2 (Baseline), Bước 3 (Profile &
  giả thuyết) và Bước 5 (Benchmark & so sánh) của `workflow-performance`. Frontend performance để spec sau.
- Người duyệt: chủ dự án.
- Nền: spec fixer [`2026-09-30-fixer-agent-design.md`](2026-09-30-fixer-agent-design.md) (Bước 4 do
  `backend-fixer` chế độ `performance`, "không tự tuyên bố nhanh hơn — số đo thuộc Bước 5").

---

## 0. Cách đọc & nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: đọc file hoặc grep, có `file:dòng` hay tên bước đi kèm |
| `[Inference]` | Suy luận từ nội dung đã đọc, chưa chạy thực tế |
| `[Unverified]` | Chưa kiểm chứng được (tài liệu công cụ bên ngoài, hành vi client thật) |
| `[Đề xuất]` | Quyết định thiết kế chờ duyệt |

Số bước trích theo `master` = `d0cc23f`.

---

## 1. Vấn đề & mục tiêu

### 1.1 Vấn đề

`workflows/performance/WORKFLOW.md` có 7 bước. Bước 1, 2, 3, 5 đều `Thực hiện: session chính`, không skill nào
hướng dẫn cách đo hay profile:

| Bước | Hiện trạng | Thiếu |
|---|---|---|
| 2 Baseline | "đo baseline hiện tại đúng môi trường/tải/dữ liệu đã chọn" | không có công cụ, không định nghĩa "điều kiện đo", không yêu cầu lặp |
| 3 Profile & giả thuyết ⏸ | "profile để tìm bottleneck" | không có thứ tự tầng, không có công cụ profiler, evidence tuỳ ý |
| 5 Benchmark & so sánh | "đo lại đúng điều kiện Bước 2" | không có artifact nào bảo đảm "đúng điều kiện" (script, bảng điều kiện) |

Hai định nghĩa G10 từng lệch nhau: spec 2026-09-25 §9 và `README.md:235` gọi G10 là `backend-performance-testing`
(k6/JMeter/Gatling — **đo**); spec 2026-09-29 §13.2 gọi G10 là "Bước 3 chưa có công cụ hay chủ sở hữu
**profiling**". Spec này gộp cả hai (quyết định G-Q1).

### 1.2 Mục tiêu & tiêu chí thành công

1. Bước 2, 3, 5 có `Thực hiện: agent` với hợp đồng riêng; đầu ra có số đo tái lập được hoặc bottleneck có evidence.
2. Bước 5 bắt buộc dùng lại **script + bảng điều kiện đo của Bước 2**.
3. Vai trò tách bạch: analyst đo và không sửa; fixer sửa và không đo.
4. Không đánh số lại bước; `workflow-performance` vẫn được wizard offer.
5. `npm test` xanh; assert mới trong `validate.mjs`.

---

## 2. Quyết định đã chốt (2026-09-30)

| # | Câu hỏi | Quyết định |
|---|---|---|
| G-Q1 | G10 giải quyết phần nào? | **Cả đo (Bước 2, 5) lẫn profile (Bước 3).** Bước 4 vẫn là `backend-fixer`. |
| G-Q2 | Phía nào? | **Backend trước**; frontend để spec sau, workflow chừa sẵn câu chờ cho phía FE. |
| G-Q3 | Ai chạy Bước 2/3/5? | **Agent mới `backend-performance-analyst`, mode `write`, chỉ ghi `perf/`, `bench/`, config tool đo**, gate diff kiểu A3. Script đo là artifact giữ lại để Bước 5 chạy lại đúng điều kiện. |
| G-Q4 | Cấu trúc skill? | **Một skill `backend-performance`, hai chế độ `measure` / `profile`** (phương án A). Không tách hai skill vì Bước 2 và 5 phải cùng script/điều kiện với đầu vào của Bước 3. |
| G-Q5 | An toàn môi trường | Chỉ local/test; từ chối staging/production; thiếu môi trường → `not_run`. |
| G-Q6 | Publish? | **Publish cùng đợt nối workflow** (như `*-fix`, spec fixer F-Q3): `workflow-performance` đang publish, `offeredCatalog` ẩn workflow có closure chưa publish (`cli/lib/install.mjs:355`). |

---

## 3. Skill `backend-performance`

### 3.1 Vị trí & frontmatter

```text
plugins/backend/skills/backend-performance/SKILL.md
plugins/backend/skills/backend-performance/references/
  measure-conditions.md
  k6.md
  jmh-pytest-benchmark.md
  profiling-java.md
  profiling-python.md
  db-query-analysis.md
```

Frontmatter: `name: backend-performance`, `order: 10` (backend đang dùng 1–9), `stageNumber: "10"`, `title`,
`runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`. Description tiếng Việt, có trigger:
"đo hiệu năng backend", "load test", "benchmark", "profile", "tìm bottleneck", "p95/p99", "N+1", "query chậm" —
và câu "KHÔNG sửa code production (đó là `backend-fix`); KHÔNG thay test đúng/sai (đó là `backend-testing`)".

### 3.2 Ranh giới với skill lân cận

| Skill | Việc |
|---|---|
| `backend-testing` | test đúng/sai (pass/fail) |
| **`backend-performance`** | **đo số** (latency/throughput/memory) + **tìm bottleneck**; không sửa code production |
| `backend-fix` chế độ `performance` | sửa theo giả thuyết; không tự kết luận nhanh hơn |
| `backend-code-review` trục performance | đọc diff tìm N+1/thiếu index; không đo |

### 3.3 Chế độ `measure` (Bước 2 và Bước 5)

1. Chốt **bảng điều kiện đo** (mẫu ở `references/measure-conditions.md`): môi trường (host local/test), phiên bản
   build, dữ liệu seed (kích thước, cách tạo), endpoint/luồng, mô hình tải (VU hoặc RPS, thời lượng; tải hằng
   định, không ramp — warm-up chạy riêng), warm-up, số lần lặp, công cụ + phiên bản. Bảng có thêm hàng **Khởi chạy
   ứng dụng** (lệnh start, ai start, port) và **Config tool đo** (file config/manifest ngoài `perf/`/`bench/`
   người dùng đã duyệt được đổi); hàng Build = commit SHA + `git diff --name-only` của working tree (Bước 5: chỉ
   khác đúng danh sách file Bước 4).
2. Viết hoặc tái dùng script: load test ở `perf/` (mặc định **k6**), micro-benchmark ở `bench/` (mặc định **JMH**
   cho Java, **pytest-benchmark** cho Python). Chọn công cụ **project đã có** trước; chưa có → đề xuất mặc định
   và **hỏi trước** khi thêm tool/dependency.
3. Chạy **≥ 3 lần**; ghi p50/p95/p99, throughput, error rate và độ lệch giữa các lần.
4. Ở Bước 5: đọc bảng điều kiện + script của Bước 2, khởi chạy lại ứng dụng từ working tree và xác nhận tiến
   trình mới trước warm-up, rồi **chạy lại nguyên trạng**; điều kiện lệch (build khác ngoài thay đổi tối ưu, dữ
   liệu khác, tải khác) → từ chối so sánh, báo.

### 3.4 Chế độ `profile` (Bước 3)

Thứ tự tầng rẻ → đắt; dừng ở tầng tìm ra bottleneck có evidence:

1. **DB:** đếm query mỗi request (bắt N+1), `EXPLAIN ANALYZE` query chậm, slow query log
   (`references/db-query-analysis.md`). Đếm query bật lúc khởi chạy (tham số dòng lệnh/biến môi trường, file cấu
   hình hoặc harness trong `perf/`, đếm phía DB test), không sửa file trong `src/`; không làm được → `blocked` +
   đề xuất. Lệnh/config bật đếm query ghi vào report Bước 3, không ghi vào bảng điều kiện của Bước 2.
2. **CPU/alloc:** JFR / async-profiler (Java), py-spy / cProfile (Python), chạy trong lúc có tải của `measure`
   (`references/profiling-java.md`, `profiling-python.md`).
3. **I/O, pool, lock:** thread dump, metric connection pool, thời gian chờ lock.

Đầu ra: bottleneck + evidence (`file:line`, số đo, trích đoạn flame graph/EXPLAIN); giả thuyết nguyên nhân; **danh
sách file/hàm đề xuất sửa** (đầu vào F2 của `backend-fixer`).

### 3.5 Cổng P1–P5 (fail-loud)

| Cổng | Nội dung | Đỏ thì |
|---|---|---|
| P1 Môi trường | Chỉ chạy trên local/test; host staging/production → từ chối | Thiếu môi trường → `not_run` + lý do; không tự dựng hạ tầng |
| P2 Điều kiện đo | Bảng điều kiện đo đầy đủ **trước** khi chạy; Bước 5 dùng lại bảng Bước 2 | Thiếu mục → dừng, hỏi (chạy như subagent: trả `blocked` + câu hỏi) |
| P3 Ổn định | ≥ 3 lần; báo độ lệch; độ lệch p95 giữa các lần > **10%** (mặc định, project ghi đè trong bảng điều kiện) → cảnh báo, không kết luận | Tăng số lần lặp hoặc cô lập nhiễu |
| P4 Evidence | Mọi giả thuyết có evidence đo được; không suy diễn chỉ từ đọc code | Profile thêm |
| P5 Phạm vi ghi | Chỉ ghi `perf/`, `bench/`, config tool đo; thêm tool/dependency → hỏi trước (chạy như subagent: trả `blocked` + câu hỏi); không sửa `src/` production, không sửa test, không chạy DDL/migration | Gỡ thay đổi ngoài phạm vi |

### 3.6 Ranh giới an toàn (SKILL.md)

- Không trỏ tải vào staging/production; không dùng hay in credential thật (chỉ nêu tên biến môi trường).
- Không sửa code production; phát hiện bottleneck → chỉ đề xuất danh sách file cho `backend-fix`.
- Ngôn ngữ đo được: báo bằng số và lệnh thật; không dùng "nhanh hơn rõ rệt", "tối ưu hoàn toàn"; luôn nêu
  residual risk (nhiễu môi trường, dữ liệu seed khác production, JIT warm-up).
- Mọi lệnh/cờ công cụ trong `references/` chưa đối chiếu tài liệu chính thức gắn `[Unverified]`.

---

## 4. Agent `backend-performance-analyst`

### 4.1 Vị trí & frontmatter

`plugins/backend/agents/backend-performance-analyst.md`; `name` = tên file; `mode: write`;
`skills: "backend-performance"`; body 4 heading `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`
(contract `test/validate.mjs:276-286`). Catalog 15 → **16** agent.

### 4.2 Nội dung (bản để hiện thực)

```markdown
---
name: backend-performance-analyst
description: "Agent đo và profile hiệu năng BACKEND theo skill backend-performance: chế độ measure chốt bảng điều kiện đo, chạy load test/benchmark ≥3 lần, ghi p50/p95/p99, throughput, error rate, độ lệch; chế độ profile tìm bottleneck theo thứ tự DB → CPU/alloc → I/O có evidence và đề xuất danh sách file cho backend-fixer. Chỉ ghi perf/, bench/, config tool đo; không sửa code production; chỉ chạy trên local/test. Dùng khi workflow-performance cần Baseline, Profile hoặc Benchmark."
mode: write
skills: "backend-performance"
---

## Vai trò
Đo và profile hiệu năng backend, cho ra số đo tái lập được và bottleneck có evidence. Không sửa code production,
không kết luận tối ưu có hiệu quả ngoài bảng số.

## Phạm vi
- Được: ĐỌC không giới hạn (code, config, `project-knowledge/`); tạo/sửa file trong `perf/`, `bench/` và config
  tool đo; chạy load test, benchmark, profiler, `EXPLAIN` trên môi trường local/test.
- Không được: sửa `src/` production hoặc file test; trỏ tải vào staging/production; dùng hay in credential thật;
  thêm tool/dependency khi chưa hỏi; chạy DDL/migration; commit; gọi agent khác.
- Bắt buộc: thiếu môi trường local/test → trả `not_run` + `reason`, không tự dựng hạ tầng; cần quyết định của
  người dùng (thêm tool/dependency, mục bảng điều kiện chưa biết, sửa config ngoài `perf/`/`bench/` chưa có ở hàng
  Config tool đo) → trả `status: blocked` + `questions[]`, không tự làm.

## Quy trình
1. Đọc skill `backend-performance`; xác định chế độ (`measure` | `profile`) và bước gọi; gọi độc lập (không có
   mốc từ session chính) → tự ghi `git status --porcelain` làm mốc.
2. `measure`: chốt bảng điều kiện đo (P2); ở Bước 5 đọc lại bảng + script của Bước 2, không tạo mới. `profile`:
   dùng lại bảng điều kiện + script của Bước 2, không chốt bảng mới.
3. `measure`: chạy ≥3 lần, ghi thống kê chính theo P3 (p95 load test / `Score` JMH / `median` pytest-benchmark) +
   độ lệch; load test ghi thêm p50/p99, throughput, error rate. `profile`: DB → CPU/alloc → I/O, dừng khi có
   evidence (P4).
4. Tự đối chiếu diff so với mốc đầu bước (mốc do session chính truyền; gọi độc lập → tự ghi
   `git status --porcelain` ở bước 1) bằng `git diff --name-only` + `git ls-files --others --exclude-standard`:
   chỉ `perf/`, `bench/`, config tool đo đã liệt kê ở hàng Config tool đo (P5).
5. Báo cáo.

## Report trả về
- `measure`: bảng điều kiện đo + bảng số (thống kê chính theo P3: p95 load test / `Score` JMH / `median`
  pytest-benchmark, + độ lệch; load test ghi thêm p50/p99, throughput, error rate) + lệnh chạy.
- `profile`: bottleneck + evidence (`file:line`, số đo, trích flame/EXPLAIN) + giả thuyết + danh sách file/hàm đề
  xuất sửa.
- Evidence theo contract `core:principles`; không chạy được → `not_run` + `reason`; cần quyết định của người dùng
  → `status: blocked` + `questions[]` (mỗi câu nêu lựa chọn và đề xuất).
- `remaining_risks`: nhiễu môi trường, dữ liệu seed khác production, JIT warm-up, phần chỉ suy từ đọc code.
```

### 4.3 Vai trò so với `backend-fixer`

Analyst đo, không sửa; fixer sửa, không đo. Chuỗi trong workflow: analyst (Bước 2 `measure`) → analyst (Bước 3
`profile`) → fixer (Bước 4) → analyst (Bước 5 `measure`).

---

## 5. Nối vào `workflow-performance`

### 5.1 Nguyên tắc

- **Không đánh số lại** — giữ 7 bước; giữ ⏸ ở Bước 3 và 7.
- Mọi trường `- **Thực hiện:** …` viết trên **một dòng**: `stepRefs` (`cli/lib/workflows.mjs:49-56`) chỉ đọc dòng
  đầu của trường (đã tách task riêng để sửa parser).
- Phía FE chưa có skill: Bước 2, 3, 5 thêm câu chờ "Phía FE: chưa có skill đo/profile frontend — session chính đo
  theo công cụ sẵn có của project, ghi `[giả định]` cho phần không kiểm chứng được."

### 5.2 Thay đổi theo bước

| Bước | Thay đổi |
|---|---|
| 1 Metric & mục tiêu | Giữ session chính. Đầu ra thêm "điều kiện đo sơ bộ (môi trường local/test, endpoint/luồng, tải mục tiêu)". |
| 2 Baseline | `Thực hiện: agent \`backend-performance-analyst\` (chế độ \`measure\`; phía BE)`. Hành động theo skill `backend-performance`. Gate: bảng điều kiện đo đầy đủ; ≥ 3 lần + độ lệch; so với mốc `git status --porcelain` đầu bước, file thay đổi/mới (`git diff --name-only`, `git ls-files --others --exclude-standard`) chỉ gồm `perf/`, `bench/`, config tool đo đã liệt kê ở hàng Config tool đo của bảng điều kiện. Khi fail: `not_run` vì thiếu môi trường → workflow dừng `blocked` (không có baseline thì không tối ưu); agent trả `blocked` + câu hỏi → session chính hỏi người dùng, ghi quyết định vào bảng điều kiện (hàng Config tool đo nếu liên quan), gọi lại agent; diff ngoài phạm vi (ngoài `perf/`, `bench/`, hàng Config tool đo) → revert phần lệch, không nhận. Evidence: report của agent + `git hash-object` của script và file bảng điều kiện sau khi chốt (mốc bất biến cho Bước 5; bảng + script chốt ở cuối Bước 2, từ đó tới hết Bước 5 không ai sửa). |
| 3 Profile & giả thuyết ⏸ | `Thực hiện: agent \`backend-performance-analyst\` (chế độ \`profile\`; phía BE)`. Đầu vào: bảng điều kiện + script + số đo baseline từ Bước 2. Hành động: session chính ghi mốc `git status --porcelain` rồi dispatch. Ràng buộc: không sửa bảng điều kiện và script đo của Bước 2 — lệnh/config bật đếm query hay profiler ghi vào report Bước 3 (hoặc `perf/profile-<luồng>.md`). Đầu ra giữ nguyên (bottleneck + giả thuyết + danh sách file/hàm cho Bước 4). Gate thêm "evidence đo được (không chỉ đọc code); diff chỉ `perf/`, `bench/`, config tool đo đã liệt kê ở hàng Config tool đo của bảng điều kiện". Khi fail: agent trả `blocked` + câu hỏi → session chính hỏi người dùng, ghi quyết định vào report Bước 3, gọi lại agent; quyết định làm đổi điều kiện đo (môi trường, dữ liệu seed, tải, warm-up, số lần lặp, config tool đo) → quay lại Bước 2 đo lại baseline; diff ngoài phạm vi → revert phần lệch, không nhận. Người dùng xác nhận ở ⏸. |
| 4 Tối ưu | Không đổi (`backend-fixer`). |
| 5 Benchmark & so sánh | `Thực hiện: agent \`backend-performance-analyst\` (chế độ \`measure\`; phía BE)`. Đầu vào: **script + bảng điều kiện đo của Bước 2** + code đã tối ưu. Hành động: session chính ghi mốc `git status --porcelain`, đọc mốc `git hash-object` của script và bảng điều kiện đã ghi ở Evidence Bước 2, rồi dispatch; agent build + khởi chạy lại ứng dụng từ working tree theo hàng Khởi chạy ứng dụng (không tự làm được → `blocked` hỏi người dùng), xác nhận là tiến trình mới (PID/thời điểm start khác baseline, hoặc version/actuator info) trước warm-up. Ràng buộc: không đổi điều kiện đo. Gate: bảng baseline vs sau cùng điều kiện; đạt hoặc báo không đạt ngưỡng; nhiễu vượt P3 → không kết luận; script và bảng điều kiện Bước 2 không đổi (`git hash-object` bằng mốc Bước 2); file mới chỉ trong `perf/`/`bench/` (output); diff code production của working tree (`git diff --name-only` + `git ls-files --others --exclude-standard`) chỉ gồm danh sách file Bước 4, cộng file ở hàng Config tool đo. Khi fail: agent trả `blocked` + câu hỏi → session chính hỏi người dùng, ghi quyết định vào report Bước 5, gọi lại agent; quyết định làm đổi điều kiện đo → quay lại Bước 2 đo lại baseline. Evidence: report của agent + `git hash-object` hiện tại của script và bảng điều kiện so với mốc Bước 2. |
| 6, 7 | Không đổi. |

Frontmatter `agents`: `"backend-performance-analyst,backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer"`.
Điều kiện tiên quyết liệt kê thêm agent. Bảng lỗi thêm 4 hàng:

| Tình huống | Hành động |
|---|---|
| Môi trường đo thiếu (Bước 2/5, `not_run`) | Dừng `blocked`, báo người dùng cung cấp môi trường local/test; không tối ưu khi chưa có baseline |
| Điều kiện Bước 5 lệch Bước 2 | Từ chối so sánh; chạy lại đúng điều kiện Bước 2 |
| Nhiễu vượt ngưỡng P3 | Không kết luận; tăng số lần lặp hoặc cô lập nhiễu rồi đo lại |
| Quyết định phát sinh ở Bước 3/5 làm đổi điều kiện đo | Quay lại Bước 2 đo lại baseline; không sửa bảng điều kiện đã chốt |

DoD: dòng "Baseline đo đúng điều kiện — evidence: Bước 2" thêm "(bảng điều kiện đo + ≥ 3 lần)".

---

## 6. Publish, docs, kiểm chứng

### 6.1 Publish (làm TRƯỚC khi nối workflow)

- `plugins/_published.json`, `plugins/_cowork.json`: thêm `backend/backend-performance` / `backend:backend-performance`.
- `plugins/backend/.manifest.json`: version `1.4.0` → `1.5.0`; description liệt kê `backend-performance`
  (assert PL2 `test/validate.mjs:~785`).
- `test/install.test.mjs`: số skill backend được offer `9` → `10`.

### 6.2 Docs

- `README.md` / `README_VI.md`: `### Agents (15)` → `(16)` / `### Agent (15)` → `(16)`; thêm hàng
  `| \`backend-performance-analyst\` | backend | write | backend-performance | WF09 |`; cột agent của WF09 thêm
  `backend-performance-analyst`; bỏ hàng G10 khỏi bảng Skill gaps.
- `CLAUDE.md:83`: backend 10 skill published (thêm `backend-performance`).
- Spec 2026-09-29: §9 P3 và §13 đánh dấu G10 (backend) xong; §13.2 thêm hàng mở "frontend performance (Web
  Vitals/Lighthouse/React Profiler/bundle)".

### 6.3 Test

Khối `// 20.` ở cuối `test/validate.mjs` (helper riêng `flat20`, `wf20`, `step20`, `field20` theo kiểu khối 19):
- skill: frontmatter (`order: 10`, `pipeline: false`); bảng gate có P1–P5; có 2 chế độ `measure`/`profile`; chứa
  "staging/production", `not_run`, regex `/≥\s?3/` (số lần lặp), `perf/`, `bench/`; ranh giới nêu `backend-fix` và `backend-testing`;
  `references/` có đủ 6 file.
- agent: `mode: write`, `skills` đúng 1; body chứa `perf/`, `bench/`, "staging/production", `not_run`,
  `core:principles`, `src/`.
- publish: `_published.json`, `_cowork.json`.
- workflow: Bước 2/3/5 `field20(…,'Thực hiện')` chứa agent analyst; Bước 2/3 Gate chứa `perf/`; Bước 5 Đầu vào
  chứa "Bước 2" và Ràng buộc chứa "điều kiện"; vẫn 7 bước; frontmatter agents; `offeredCatalog` vẫn chứa
  `workflows/workflow-performance` (kiểm có răng).
- README: heading `(16)`; hàng agent dùng ở WF09; không còn hàng G10.

### 6.4 Kiểm chứng

| Bước | Lệnh | Chứng minh |
|---|---|---|
| Contract | `npm run validate` | skill/agent/workflow mới đúng contract |
| Build | `npm run build` | skill + `references/` + agent ở `build/<provider>/` |
| Toàn bộ | `npm test` | installer/wizard/pack-guard không regression; backend offer 10 |
| Smoke | `AIE_INSTALL_ROOT=<sandbox> aip install --provider claude --skill workflows/workflow-performance --yes` | closure kéo `backend-performance`, agent xuất hiện; dọn bằng `fs.rmSync` |
| Công cụ thật | Chạy k6/JMH/py-spy trên project mẫu | `[Unverified]` — chỉ đo được khi pilot |

---

## 7. Lộ trình (mỗi task = 1 commit, người duyệt diff)

| Pha | Nội dung | Điều kiện xong |
|---|---|---|
| PF-P1 | `SKILL.md` + assert skill (§3, §6.3) | validate skill contract xanh |
| PF-P2 | 6 file `references/` (đối chiếu tài liệu công cụ; nhãn `[Unverified]` chỗ chưa kiểm) | assert đủ file; link từ `SKILL.md` hợp lệ |
| PF-P3 | Publish (§6.1) | `npm test` xanh; backend offer 10 |
| PF-P4 | Agent (§4.2) + assert | validate agent contract xanh |
| PF-P5 | Nối workflow (§5) + assert + kiểm có răng | `npm test` xanh; 7 bước; workflow vẫn offer |
| PF-P6 | Docs (§6.2) + assert README | validate xanh |
| PF-P7 | Smoke sandbox (§6.4) | closure đúng; sandbox dọn sạch |

PF-P3 phải đi trước PF-P5 (publish trước, nối sau).

---

## 8. Rủi ro còn lại

- **Chưa pilot.** Publish ngay (G-Q6) nên skill chưa chạy trên project thật; nội dung `references/` về cờ công cụ
  có thể sai phiên bản — gắn `[Unverified]` và sửa sau lần dùng đầu.
- `[Inference]` Đo hiệu năng trên máy local nhiễu cao (CPU boost, tiến trình khác); ngưỡng độ lệch 10% có thể quá
  chặt hoặc quá lỏng tuỳ máy — để project ghi đè.
- `[Inference]` Profiler (async-profiler, py-spy) cần quyền hệ thống hoặc attach process; trên Windows/containers
  có thể không chạy — skill phải báo `not_run` thay vì tự cài.
- Micro-benchmark JVM cần warm-up đúng cách (JMH lo phần này); benchmark tự viết không qua JMH dễ cho số sai —
  skill ưu tiên JMH, cảnh báo khi không dùng.
- Agent mode `write` không bị chặn ghi theo đường dẫn bằng công cụ; phạm vi `perf/`, `bench/` chỉ được kiểm bằng
  gate diff của workflow (giống A3).
- Frontend performance chưa có; workflow chỉ có câu chờ.
- **Mở rộng sau review toàn nhánh (2026-09-30):** agent chạy như subagent nên "hỏi" = trả `status: blocked` +
  `questions[]` (session chính hỏi người dùng, ghi quyết định vào report của bước đó, gọi lại; Bước 5 → report Bước 5);
  bảng điều kiện thêm hàng **Config tool đo** (file config ngoài `perf/`/`bench/` đã duyệt — gate diff so với danh sách này) và
  **Khởi chạy ứng dụng** (Bước 5 khởi chạy lại từ working tree, xác nhận tiến trình mới trước warm-up); gate
  Bước 5 so `git hash-object` hiện tại của script + bảng điều kiện với mốc ghi ở Bước 2; đếm query bật lúc khởi chạy, không
  sửa file trong `src/` (không làm được → `blocked` + đề xuất). `[Inference]` Các cổng này vẫn là kiểm bằng lệnh
  git của session chính, không phải chặn ghi bằng công cụ.
- Bảng điều kiện + script đo chốt ở cuối Bước 2, mốc `git hash-object` ghi ở Evidence Bước 2; Bước 3 và Bước 5
  không sửa bảng (sửa sau review B1/B2, 2026-10-01).

---

## 9. Quyết định cần chốt

| # | Câu hỏi | Trạng thái |
|---|---|---|
| ~~G-Q1…G-Q6~~ | (§2) | Đã chốt 2026-09-30 |
| G-Q7 | Có thêm bước perf regression tự động trong CI không? | Mở — ngoài phạm vi; cần `ops-ci-pipeline` (G6) trước |
| G-Q8 | Spec frontend performance | Mở — sau spec này |
