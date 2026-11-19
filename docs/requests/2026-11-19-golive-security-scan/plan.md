# Cổng quét bảo mật go-live Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** `engineering-quality-gate` đếm bốn chỉ tiêu ngưỡng go-live (secret, Critical/High, RCE, KEV) bằng một script zero-dep từ report của Gitleaks, Trivy, Coverity, ZAP, Nessus CSV, BlackDuck, Sonar, SARIF và file CISA KEV, có reference cho từng nguồn, pentest và ASVS L2; `ops-deploy-release` đối chiếu digest Docker trên VM SIT/UAT; `workflow-security-review` nhận report pentest cho vòng retest.
**Architecture:** một script Node thuần `go-live-gate.mjs` trong `scripts/` của skill: hàm thuần `gate(inputs, { now })` nhận nội dung report dạng chuỗi và trả kết quả JSON; phần CLI chỉ đọc file, gọi `gate`, in stdout, map `InputError` sang exit 2. Phần còn lại là nội dung markdown của ba skill/workflow.
**Tech Stack:** Node 20+ built-in (`node:fs`, `node:path`, `node:url`), markdown tiếng Việt; test qua `test/validate.mjs` (module `test/content/*.pin.mjs`).
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs` | đọc report, chuẩn hoá, gộp, đếm ngưỡng, CLI | Task 1–5 |
| `test/content/55-golive-security-gate.pin.mjs` | test hàm `gate` (unit), CLI qua `spawnSync`, pin cấu trúc tài liệu và corpus | Task 1–11 |
| `plugins/engineering/skills/engineering-quality-gate/references/gitleaks.md` | chạy Gitleaks tại chỗ, trường đọc, `.gitleaksignore` | Task 6 |
| `plugins/engineering/skills/engineering-quality-gate/references/trivy-image.md` | chạy Trivy image, trường đọc, `RepoDigests`, `.trivyignore`/VEX | Task 6 |
| `plugins/engineering/skills/engineering-quality-gate/references/coverity.md` | đọc Coverity JSON đã xuất | Task 6 |
| `plugins/engineering/skills/engineering-quality-gate/references/zap-nessus.md` | đọc ZAP JSON/XML, Nessus CSV/`.nessus` | Task 6 |
| `plugins/engineering/skills/engineering-quality-gate/references/sonarqube.md` | thêm mục đọc issues JSON cho ngưỡng | Task 7 |
| `plugins/engineering/skills/engineering-quality-gate/references/blackduck.md` | thêm mục đọc CycloneDX cho ngưỡng | Task 7 |
| `plugins/engineering/skills/engineering-quality-gate/references/pentest.md` | nhập report pentest, bảng xác nhận, retest | Task 7 |
| `plugins/engineering/skills/engineering-quality-gate/references/asvs-l2.md` | điền checklist ASVS L2 của tổ chức | Task 7 |
| `plugins/engineering/skills/engineering-quality-gate/SKILL.md` | bước 2 nguồn mới + script, ranh giới, bản đồ tài liệu, description | Task 8, Task 11 |
| `plugins/engineering/skills/engineering-quality-gate/references/report-template.md` | mục Ngưỡng go-live, ASVS L2, pentest/retest, suppress ngoài report | Task 8 |
| `plugins/engineering/skills/engineering-quality-gate/references/triage-and-fix.md` | quy tắc FP/chấp nhận rủi ro/suppress, pentest qua người xác nhận | Task 8 |
| `plugins/ops/skills/ops-deploy-release/SKILL.md` | bước đối chiếu digest, ranh giới đọc SIT/UAT, description | Task 9, Task 11 |
| `plugins/ops/skills/ops-deploy-release/references/release-checklist.md` | mục digest (chặn) trong checklist tiền deploy | Task 9 |
| `plugins/ops/skills/ops-deploy-release/references/digest-check.md` | lệnh đọc digest, quy tắc so khớp, so theo image ID | Task 9 |
| `workflows/security-review/WORKFLOW.md` | đầu vào tuỳ chọn + một dòng retest pentest ở Bước 9 | Task 10 |
| `test/routing/engineering-quality-gate.json`, `test/routing/ops-deploy-release.json` | thêm 2 positive go-live/digest mỗi file | Task 11 |
| `plugins/engineering/.manifest.json`, `plugins/ops/.manifest.json`, `workflows/.manifest.json` | bump version | Task 12 |
| `plugins/_versions.lock.json` | refresh lock | Task 12 |

## Global Constraints
- Nhánh `feature/golive-security-scan` tạo từ `master`; commit đầu chứa `brief.md`, `design.md`, `plan.md` của request. Commit mỗi task qua `core:git-workflow`, header tiếng Anh, body tiếng Việt, không `Co-authored-by`. Không push, không merge khi chưa duyệt.
- Script: chỉ `node:fs`, `node:path`, `node:url`; không import `node:http`, `node:https`, `node:net`, `node:dns`, không dùng `fetch`; không dependency; không parser XML; UTF-8 không BOM, LF.
- Cờ CLI (nguyên văn): `--gitleaks-tree`, `--gitleaks-history`, `--trivy`, `--coverity`, `--zap`, `--nessus` (CSV), `--blackduck` (CycloneDX JSON), `--sonar`, `--sarif` (lặp được), `--kev`, `--fp`, `--accepted`, `--na <nguồn>=<bằng chứng>` (lặp được).
- Khoá chỉ tiêu trong output: `secret`, `critHigh`, `rce`, `kev`; trạng thái đúng chuỗi `đạt`, `không đạt`, `chưa đo`, `không áp dụng`; nhãn `chấp nhận rủi ro`, `suppress`, `FP đã loại`. Output có `thresholds`, `overall`, `findings` (mỗi finding có `key`, `sources`, `severity`), `warnings`.
- Quy tắc trạng thái chỉ tiêu (theo thứ tự): có finding đếm được → `không đạt`; không finding và còn nguồn bắt buộc thiếu chưa `--na` → `chưa đo`; mọi nguồn bắt buộc đều `--na` → `không áp dụng`; còn lại → `đạt`. Overall: có `không đạt` → `không đạt`; cả bốn `đạt` → `đạt`; còn lại → `chưa đo`.
- Nguồn bắt buộc: secret = Gitleaks working tree, Gitleaks lịch sử git, Trivy image; Critical/High và RCE = Coverity, Trivy image, ZAP, Nessus, BlackDuck, Sonar (SARIF cộng thêm); KEV = file KEV, Trivy image, Nessus, BlackDuck (Coverity, ZAP, Sonar, SARIF cộng thêm khi có CVE).
- RCE = CWE thuộc {77, 78, 94, 95, 502, 917, 1336} hoặc nhãn chứa "remote code execution" (không phân biệt hoa thường), bất kể severity. Secret chỉ vào chỉ tiêu `secret`, không vào `critHigh`. Sonar chỉ `type` = `VULNERABILITY` vào `critHigh`/`rce`.
- Khoá finding: secret `rule@file:line` (Trivy: layer); mã nguồn `file:line` (+CWE nếu có); CVE `CVE@tài sản` (image digest hoặc tên image, host, `component@version`); ZAP `alert@URL`; Nessus không CVE `plugin@host`. Gộp chỉ khi cùng khoá; cùng CVE khác tài sản là nhiều finding.
- Bảng chuẩn hoá severity nguyên văn ở `design.md` mục "Chuẩn hoá severity"; giá trị lạ → exit 2.
- `--fp`/`--accepted`: JSON mảng `{ "source", "key", "reason" }`, `reason` bắt buộc ở cả hai (thiếu → exit 2); chỉ `--fp` loại khỏi số đếm; khoá không khớp → một dòng `warnings`.
- Exit 0 khi đọc được input (kể cả có Critical); exit 2 khi thiếu đối số, file không đọc được, JSON hỏng, thiếu trường bắt buộc, giá trị lạ, `--na` thiếu bằng chứng, FP/accepted thiếu `reason`. Lỗi chỉ nêu tên cờ, tên file, tên trường; không in message gốc của `JSON.parse`, không in giá trị `Secret`/`Match`.
- KEV: `dateReleased` cũ hơn 7 ngày so với `now`, hoặc không có ngày → một dòng `warnings`, trạng thái không đổi.
- Test không chứa chuỗi giống secret thật trong repo: sentinel ghép từ nhiều mảnh lúc chạy (mẫu `test/content/54-codebase-onboarding.pin.mjs`); fixture dựng lúc chạy trong thư mục tạm.
- `description` ≤ 500 ký tự, giữ "Không dùng khi → id". Không sửa `test/routing/rank1.lock.json`; ngưỡng là phần trăm (positive ≥ 70, negative ≥ 94).
- Version: `engineering` 2.16.2 → 2.17.0, `ops` 2.1.1 → 2.2.0, `workflows` 3.17.4 → 3.17.5; không đổi `workflows/security-review/graph.json`, `plugins/_cowork.json`, `plugins/_published.json`, `docs/specs/`.
- Tên trường tool chưa kiểm với report thật: tài liệu ghi `[Unverified]`; ranh giới: không chạy ZAP active scan, không quét Nessus, không lệnh ghi lên SIT/UAT, không gọi server Sonar/Black Duck, không cài tool vào project.

## Review Focus
- Report hợp lệ nhưng rỗng (vd `{"Results":[]}`, CSV chỉ có header) phải tính là nguồn đã có, không phải `chưa đo`: test "đủ nguồn, không finding → `đạt`" ở Task 4 (AC1.5) dùng fixture rỗng của từng nguồn.
- Severity viết khác hoa/thường hoặc có khoảng trắng (`"Critical "`, `"high"`): test bảng chuẩn hoá ở Task 2 và Task 3 (AC1.3) thêm hàng biến thể và hàng giá trị lạ → exit 2.
- FP khớp finding đã gộp từ hai nguồn: test ở Task 5 (AC1.7) dùng finding Coverity + SARIF đã gộp, FP theo `source` = một trong hai.
- Ô Nessus CSV có dấu phẩy trong nháy kép (`"CVE-A, CVE-B"`, tên plugin có phẩy): test ở Task 3 (AC1.19) dùng dòng có trường nháy kép chứa phẩy.
- Lộ secret qua thông báo lỗi của trường thiếu hoặc giá trị lạ (không chỉ JSON hỏng): test CLI ở Task 1 (AC1.12) thêm ca severity lạ trên finding có sentinel.

### Task 1: Khung script, Gitleaks + Trivy, CLI và an toàn secret
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.1, AC1.2, AC1.12, AC1.13
**Files:**
- Create: `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs`
- Create: `test/content/55-golive-security-gate.pin.mjs`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `gate(inputs, { now })` trả `{ thresholds, overall, findings, warnings }`, với `inputs` = `{ gitleaksTree, gitleaksHistory, trivy, coverity, zap, nessus, blackduck, sonar, sarif, kev, fp, accepted, na }` (chuỗi nội dung file hoặc `undefined`; `sarif` là mảng chuỗi; `na` là `{ <nguồn>: <bằng chứng> }`); `InputError` (lớp lỗi đầu vào, CLI map sang exit 2); `parseArgs(argv)`; khung test `55-golive-security-gate.pin.mjs` với helper dựng fixture và `cli(args)`.

- [ ] **Step 0:** Tạo nhánh `feature/golive-security-scan` từ `master` (qua `core:git-workflow`), commit `brief.md`, `design.md`, `plan.md`: `docs(requests): add golive-security-scan brief, design and plan`.
- [ ] **Step 1:** Viết test đỏ: AC1.1 (2 + 1 + 1 secret qua CLI, `status` `không đạt`), AC1.2 (Trivy Critical/High = 2, Medium/Low không đếm), AC1.12 (sentinel ghép nhiều mảnh trong `Secret`, `Match` và trong file JSON hỏng → stdout/stderr không chứa sentinel), AC1.13 (bảng: thiếu đối số, đường dẫn không tồn tại, JSON hỏng, thiếu trường, severity lạ → exit 2 và stdout không có `đạt`/`không đạt`; đủ file có Critical → exit 0). Chạy `node test/validate.mjs --only golive`; mong đợi: các assert mới đỏ vì script chưa có.
- [ ] **Step 2:** Viết `parseArgs`, `InputError`, `gate` với parser Gitleaks (working tree/lịch sử) và Trivy (vuln + secret, không đọc `Secret`/`Match`), chuẩn hoá severity Trivy, CLI đọc file, in JSON, bắt `InputError` → stderr tự viết + exit 2. Chạy lại; mong đợi: xanh.
- [ ] **Step 3: Commit** `feat(engineering): add go-live gate script with gitleaks and trivy`.

### Task 2: SARIF, ZAP, Coverity; RCE; gộp theo khoá mã nguồn
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.3, AC1.10
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: `gate(inputs, { now })`, `InputError`
- Produces: không có (khoá gộp `file:line`+CWE, `alert@URL`, `CVE@tài sản` nằm trong `findings[].key`)

- [ ] **Step 1:** Test đỏ: AC1.3 các hàng ZAP `riskcode` 3/2/1/0, SARIF `security-severity` 9.0/7.0/4.0/0.1 không `level`, Trivy `UNKNOWN`, hàng biến thể hoa/thường, hàng giá trị lạ → exit 2 (Review Focus); AC1.10 (CWE-78, CWE-502, nhãn "Remote Code Execution" → 3; CWE-79 Critical không vào RCE); một ca gộp Coverity + SARIF cùng `file:line` + CWE-89 thành một finding và ZAP không gộp với chúng (phần mã nguồn của AC1.11, ca đủ ở Task 3). Chạy `--only golive`; mong đợi đỏ.
- [ ] **Step 2:** Viết parser SARIF, ZAP JSON, Coverity JSON (trường [Unverified] theo design; không xác định được mức độ → `InputError`), hằng CWE RCE, khoá gộp mã nguồn và ZAP. Chạy lại; mong đợi xanh.
- [ ] **Step 3: Commit** `feat(engineering): parse sarif, zap and coverity in go-live gate`.

### Task 3: Nessus CSV, BlackDuck CycloneDX, Sonar, KEV
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 30'
**Phủ AC:** AC1.3, AC1.9, AC1.11, AC1.14, AC1.16, AC1.17, AC1.18, AC1.19
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: `gate(inputs, { now })`, `InputError`
- Produces: không có

- [ ] **Step 1:** Test đỏ: AC1.3 các hàng Nessus `Risk` Critical/High/Medium/Low/None; AC1.9 (KEV `CVE-A` khớp 1 trong `CVE-A`, `CVE-B`; thiếu file KEV → `chưa đo`; đọc source script, không có chuỗi import mô-đun mạng hay `fetch`); AC1.11 đủ ca (Trivy `CVE-X`@image + Nessus `CVE-X`@host là hai, Coverity + SARIF gộp một, ZAP riêng → 4 finding); AC1.14 (`CVE-Y` trên 3 host + 1 image → 4); AC1.16 (BlackDuck critical `P@1.0` + low `Q@2.0` → 1, khoá `CVE@P@1.0`; thiếu `vulnerabilities` → exit 2); AC1.17 (Sonar `VULNERABILITY` `BLOCKER` đếm, `BUG`, `CODE_SMELL` không); AC1.18 (`dateReleased` cũ hơn 7 ngày so với `now` → một warning; không có ngày → một warning; trạng thái không đổi); AC1.19 (ô `"CVE-A, CVE-B"` trong nháy kép → `CVE-A@H`, `CVE-B@H`; dòng không CVE → `plugin@H`; trường nháy kép chứa phẩy). Chạy `--only golive`; mong đợi đỏ.
- [ ] **Step 2:** Viết parser CSV tối thiểu (nháy kép, phẩy trong nháy), Nessus, BlackDuck CycloneDX, Sonar (lấy mức cao hơn giữa `severity` và `impacts[]` SECURITY), đối chiếu KEV và cảnh báo tuổi file. Chạy lại; mong đợi xanh.
- [ ] **Step 3: Commit** `feat(engineering): parse nessus, blackduck, sonar and kev in go-live gate`.

### Task 4: Trạng thái chỉ tiêu, nguồn bắt buộc, `--na`, overall
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25'
**Phủ AC:** AC1.4, AC1.5, AC1.6, AC1.15
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: `gate(inputs, { now })`, `InputError`
- Produces: `overallOf(statuses)` trả một trong bốn trạng thái theo Global Constraints

- [ ] **Step 1:** Test đỏ: AC1.4 (thiếu `coverity` → `critHigh`, `rce` `chưa đo`, exit 0), AC1.5 (đủ nguồn với fixture hợp lệ nhưng rỗng của từng nguồn → `đạt`; thêm một Critical và thiếu Coverity → `không đạt`), AC1.6 (`--na nessus=<bằng chứng>`; `--na` thiếu bằng chứng → exit 2; mọi nguồn bắt buộc `--na` → `không áp dụng`), AC1.15 (bảng tham số hoá `overallOf`). Chạy `node test/validate.mjs --only golive`; mong đợi đỏ.
- [ ] **Step 2:** Viết bảng nguồn bắt buộc, quy tắc trạng thái đủ bốn nhánh, `overallOf`, `--na`. Chạy lại; mong đợi xanh, kể cả test của Task 1–3.
- [ ] **Step 3: Commit** `feat(engineering): add go-live threshold status rules`.

### Task 5: FP, chấp nhận rủi ro, suppress
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 20'
**Phủ AC:** AC1.7, AC1.8
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/scripts/go-live-gate.mjs`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: `gate(inputs, { now })`, `InputError`, `findings[].key`, `findings[].sources`
- Produces: không có

- [ ] **Step 1:** Test đỏ: AC1.7 (2 Critical `A`, `B`; FP khớp `A` → 1, liệt kê 1 FP đã loại kèm `reason`; thiếu `reason` → exit 2; khoá không khớp → một warning, số đếm không đổi; thêm ca FP trên finding gộp Coverity + SARIF theo Review Focus); AC1.8 (accepted khớp `C` có `reason`, `D` suppress trong Sonar → cả hai vẫn đếm với nhãn `chấp nhận rủi ro`, `suppress`, `status` không `đạt`; accepted thiếu `reason` → exit 2). Chạy `--only golive`; mong đợi đỏ.
- [ ] **Step 2:** Viết đọc `--fp`/`--accepted`, gán nhãn, nhãn `suppress` từ SARIF `suppressions[]`, Coverity triage, Sonar `resolution`. Chạy lại; mong đợi xanh.
- [ ] **Step 3: Commit** `feat(engineering): apply false positive and accepted-risk lists in go-live gate`.

### Task 6: Reference Gitleaks, Trivy image, Coverity, ZAP + Nessus
**Kind:** DOCS
**Ước lượng:** 25'
**Phủ AC:** AC2.2
**Files:**
- Create: `plugins/engineering/skills/engineering-quality-gate/references/gitleaks.md`
- Create: `plugins/engineering/skills/engineering-quality-gate/references/trivy-image.md`
- Create: `plugins/engineering/skills/engineering-quality-gate/references/coverity.md`
- Create: `plugins/engineering/skills/engineering-quality-gate/references/zap-nessus.md`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: cờ CLI và khoá output của `go-live-gate.mjs` (Global Constraints)
- Produces: không có

- [ ] **Step 1:** Viết bốn reference theo design mục "Nội dung reference": cách chạy tại chỗ (Gitleaks `--redact`, working tree và lịch sử; Trivy `--scanners vuln,secret`) hoặc cách đọc report đã xuất (Coverity, ZAP, Nessus), cờ script tương ứng, trường đọc `[Unverified]`, ánh xạ severity, mask, file ignore cần liệt kê, cấm ZAP active scan và quét Nessus.
- [ ] **Step 2:** Thêm pin AC2.2 (bốn file tồn tại, mỗi file có `[Unverified]` và nhắc cờ script tương ứng). Chạy `node test/validate.mjs --only golive`; mong đợi xanh.
- [ ] **Step 3:** Đối chiếu khẳng định với code: liệt kê cờ, khoá, trạng thái, hằng CWE đã nhắc; grep trong `go-live-gate.mjs`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; dòng lệch thì sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 4: Commit** `docs(engineering): add gitleaks, trivy image, coverity, zap and nessus references`.

### Task 7: Sonar, BlackDuck cho ngưỡng; pentest; ASVS L2
**Kind:** DOCS
**Ước lượng:** 25'
**Phủ AC:** AC2.2
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/references/sonarqube.md`
- Modify: `plugins/engineering/skills/engineering-quality-gate/references/blackduck.md`
- Create: `plugins/engineering/skills/engineering-quality-gate/references/pentest.md`
- Create: `plugins/engineering/skills/engineering-quality-gate/references/asvs-l2.md`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: cờ `--sonar`, `--blackduck` của `go-live-gate.mjs`
- Produces: không có

- [ ] **Step 1:** Thêm mục "Đọc cho ngưỡng go-live" vào `sonarqube.md` (issues JSON, chỉ `VULNERABILITY`, `severity`/`impacts[]`, `resolution`, không gọi server) và `blackduck.md` (CycloneDX `vulnerabilities[]`, `ratings[].severity`, `affects[].ref`, không gọi server), giữ nguyên luồng cũ. Viết `pentest.md` (PDF/md; Word thì nhờ xuất PDF/md; bảng finding cho người dùng xác nhận trước khi sửa; Bước 7–9 `workflow-security-review`; retest tới 100% Critical/High/Medium) và `asvs-l2.md` (checklist csv/md của tổ chức, xlsx thì nhờ xuất; trạng thái đạt/không đạt/chưa kiểm kèm `file:line`; không có file → `chưa đo`; không tự soạn yêu cầu).
- [ ] **Step 2:** Mở rộng pin AC2.2 cho hai file mới và hai mục mới. Chạy `--only golive`; mong đợi xanh.
- [ ] **Step 3:** Đối chiếu khẳng định với code (cờ, tên trường, số bước workflow) và ghi bảng `khẳng định → file:line → khớp|lệch`.
- [ ] **Step 4: Commit** `docs(engineering): add pentest and asvs references, threshold reading for sonar and blackduck`.

### Task 8: SKILL.md, report-template, triage-and-fix của quality-gate
**Kind:** DOCS
**Ước lượng:** 25'
**Phủ AC:** AC2.1, AC2.3, AC2.4, AC2.5, AC2.6
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/SKILL.md`
- Modify: `plugins/engineering/skills/engineering-quality-gate/references/report-template.md`
- Modify: `plugins/engineering/skills/engineering-quality-gate/references/triage-and-fix.md`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: tên file reference của Task 6–7; output JSON của `go-live-gate.mjs`
- Produces: không có

- [ ] **Step 1:** `SKILL.md`: bước 2 thêm nguồn mới và lệnh chạy script (`node <thư mục skill>/scripts/go-live-gate.mjs …`), Ranh giới an toàn (không ZAP active scan, không quét Nessus, không lệnh ghi SIT/UAT, không cài tool, không đọc giá trị secret, thiếu ASVS → `chưa đo`), Bản đồ tài liệu liệt kê mọi file `references/`. Chưa sửa `description` (Task 11). `report-template.md`: mục "Ngưỡng go-live" (bốn chỉ tiêu, bốn trạng thái, overall, cột nguồn, số đếm, nhãn), mục ASVS L2, mục pentest/retest, dòng "suppress ngoài report" liệt kê file ignore và số mục. `triage-and-fix.md`: FP chỉ loại khi có lý do; chấp nhận rủi ro và suppress vẫn đếm có nhãn; finding pentest qua người xác nhận trước khi sửa.
- [ ] **Step 2:** Pin AC2.1 (mọi file `references/` có link ở Bản đồ tài liệu, mọi link tương đối trỏ file có thật) và AC2.3 (bốn khoá chỉ tiêu, bốn trạng thái, mục ASVS L2, pentest/retest, "suppress ngoài report"). Chạy `--only golive`; mong đợi xanh. AC2.4–AC2.6 kiểm ở review diff.
- [ ] **Step 3:** Đối chiếu khẳng định với code và ghi bảng `khẳng định → file:line → khớp|lệch`.
- [ ] **Step 4: Commit** `docs(engineering): wire go-live thresholds into quality gate skill and report`.

### Task 9: Đối chiếu digest trong ops-deploy-release
**Kind:** DOCS
**Ước lượng:** 20'
**Phủ AC:** AC3.1, AC3.2, AC3.3
**Files:**
- Modify: `plugins/ops/skills/ops-deploy-release/SKILL.md`
- Modify: `plugins/ops/skills/ops-deploy-release/references/release-checklist.md`
- Create: `plugins/ops/skills/ops-deploy-release/references/digest-check.md`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: `Metadata.RepoDigests` trong output Trivy (mô tả ở `trivy-image.md` của Task 6)
- Produces: không có

- [ ] **Step 1:** Thêm bước đối chiếu digest vào bước 1 của `SKILL.md` (chưa sửa `description`) và mục digest (mục chặn) vào `release-checklist.md`; viết `digest-check.md`: digest đã quét (Trivy `Metadata.RepoDigests` hoặc `docker image inspect --format '{{json .RepoDigests}}'` ở máy build), digest đang chạy (`docker inspect --format '{{.Image}}'`, `docker image inspect`, `docker compose images`) chỉ đọc sau khi người dùng xác nhận máy và phạm vi hoặc người dùng dán output; khớp → `đạt`; lệch → `không đạt` + đề xuất NO-GO; không lấy được → `chưa đo` + NO-GO; không có RepoDigest → so theo image ID và ghi "so theo image ID"; không lệnh ghi SIT/UAT.
- [ ] **Step 2:** Pin AC3.1 (tên lệnh `docker inspect`, `docker image inspect`, câu chỉ đọc/xác nhận) và AC3.2 (ba trạng thái và NO-GO trong `digest-check.md`). Chạy `--only golive`; mong đợi xanh. AC3.3 kiểm ở review diff.
- [ ] **Step 3:** Đối chiếu khẳng định với code/tài liệu (cú pháp `--format`, tên trường) và ghi bảng `khẳng định → file:line → khớp|lệch`; cú pháp Docker chưa chạy thật giữ `[Unverified]`.
- [ ] **Step 4: Commit** `docs(ops): add image digest check before SIT/UAT release`.

### Task 10: workflow-security-review nhận report pentest
**Kind:** DOCS
**Ước lượng:** 15'
**Phủ AC:** AC4.1, AC4.2, AC4.3
**Files:**
- Modify: `workflows/security-review/WORKFLOW.md`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: `pentest.md` của Task 7
- Produces: không có

- [ ] **Step 1:** "Đầu vào tuỳ chọn" thêm report pentest, Coverity, ZAP, Nessus; Bước 9 thêm đúng một dòng đối chiếu retest pentest (Critical/High/Medium), không đổi gate Bước 9, không thêm bước.
- [ ] **Step 2:** Pin AC4.1. Chạy `node test/validate.mjs --build --only workflows` (AC4.3, mong đợi exit 0) và `git diff master -- workflows/security-review/graph.json` (AC4.2, mong đợi rỗng); đếm `### Bước` = 10.
- [ ] **Step 3:** Đối chiếu khẳng định với code (số bước, tên bước) và ghi bảng `khẳng định → file:line → khớp|lệch`.
- [ ] **Step 4: Commit** `docs(workflows): accept pentest report and track retest in security review`.

### Task 11: Description và corpus routing
**Kind:** TOOLING
**TDD:** không — đo bằng `routing-score.mjs` trên corpus, không có hành vi code mới
**Ước lượng:** 25'
**Phủ AC:** AC5.1, AC5.2, AC5.3
**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/SKILL.md`
- Modify: `plugins/ops/skills/ops-deploy-release/SKILL.md`
- Modify: `test/routing/engineering-quality-gate.json`
- Modify: `test/routing/ops-deploy-release.json`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Chạy `node scripts/routing-score.mjs` ghi số nền (positive, negative). Thêm 2 positive mỗi file corpus (go-live/ngưỡng/Gitleaks cho quality-gate; digest SIT/UAT cho ops); sửa hai `description` (≤ 500 ký tự, rút chữ cũ để có chỗ, giữ "Không dùng khi → id").
- [ ] **Step 2:** Pin AC5.2 (mỗi file ≥ 6 positive). Chạy `node scripts/routing-score.mjs` (mong đợi exit 0, positive ≥ 70%, negative ≥ 94%) và `node test/validate.mjs --build --only source` (AC5.1). Tụt ngưỡng → sửa description hoặc câu corpus, không sửa `rank1.lock.json`.
- [ ] **Step 3: Commit** `feat(routing): add go-live and digest triggers to quality gate and deploy skills`.

### Task 12: Version, build, lock, full suite
**Kind:** TOOLING
**TDD:** không — chỉ bump version và chạy kiểm toàn bộ
**Ước lượng:** 20'
**Phủ AC:** AC5.4, AC5.5, AC5.6, AC6.1
**Files:**
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/ops/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/content/55-golive-security-gate.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Bump `engineering` 2.17.0, `ops` 2.2.0, `workflows` 3.17.5; `npm run build`; `node cli/lib/versions.mjs --lock` (mong đợi exit 0). Repo chính bật `mode: "full"` làm đỏ sẵn test hook: chạy `npm test` và `npm run validate` trên bản `git clone` sạch của nhánh (mong đợi exit 0 cả hai, AC5.5).
- [ ] **Step 2:** `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-19-golive-security-scan/`; mong đợi không có W10–W14, W22; ghi mọi WARN còn lại (W11 `security-gate` dự kiến) vào ledger (AC5.6).
- [ ] **Step 3:** AC6.1: hỏi người dùng report thật đã che của từng tool và file KEV; có thì chạy script, đối chiếu tay với người duyệt, lệch thì sửa parser + thêm fixture đã che (quay lại task parser tương ứng); chưa có trước khi kết thúc nhánh thì ghi residual risk vào ledger, không chặn.
- [ ] **Step 4: Commit** `chore(release): bump engineering, ops and workflows for go-live gate`.
