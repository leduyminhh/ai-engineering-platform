# Làm giàu bộ skill từ dữ liệu dùng thật — Plan gốc (P0)

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Dựng công cụ đo (`scripts/ledger-metrics.mjs`), hai contract (57 trung lập tên riêng, 58 script đo) và số nền `baseline.json`; ghi lại bước file dùng chung mà session gốc làm sau mỗi lần merge part. Plan gốc chạy trước mọi part.
**Architecture:** Node thuần, không dependency; script chỉ đọc, in JSON ra stdout; contract chạy trong `validate --build`.
**Tech Stack:** Node.js 20+, `node:fs`, `node:child_process`, harness `test/harness.mjs`.
**Spec:** design.md
**Requirement:** không có

Part: 01-core, 02-engineering, 03-backend, 04-frontend, 05-data (mỗi part một `parts/<nn>-<slug>/plan.md`, nhóm A song song, chạy sau plan gốc).

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `scripts/ledger-metrics.mjs` | Đếm vòng review, ruling, minor từ `progress.md`; export `parseLedger`, `measure`; CLI | Task 1, Task 2 |
| `test/contract/58-ledger-metrics.contract.mjs` | Contract AC1.1–AC1.6 (hàm thuần, CLI, `baseline.json` thật) | Task 1, Task 2, Task 4 |
| `test/contract/57-skill-neutral.contract.mjs` | Quét `core/`, `plugins/`, `workflows/`, `test/routing/` tìm tên riêng cấm (D5) | Task 3 |
| `docs/requests/2026-11-11-skill-enrichment-from-usage/baseline.json` | Số nền: stdout nguyên văn của script trên project nguồn | Task 4 |
| `CLAUDE.md` | Thêm một dòng lệnh vào mục Commands | Task 4 |

Bước file dùng chung (D10) không có trong bảng này: là mục riêng ở cuối plan, session gốc làm sau mỗi lần merge part.

## Global Constraints

- Node thuần, không dependency; file UTF-8 không BOM, LF; nội dung skill tiếng Việt có dấu; comment theo mục Comments của `AGENTS.md`.
- Script đo tất định, chỉ đọc, không gọi mạng, không in đường dẫn tuyệt đối; khoá `project` của đầu ra là `--label` (mặc định `project`), không phải tên thư mục.
- Khoá JSON của script (D3): `project`, `ledgers`, `requests`, `tasks`, `tasksReview2plus`, `pctReview2plus` (1 chữ số thập phân), `tasksIssuesAtRound2plus`, `tasksIssuesAtRound3plus`, `rulings`, `rulingsOutsideFiles`, `outsideFilesPerRequest` (2 chữ số thập phân), `minorDeferred`, `byRequest[]` (`request`, `tasks`, `tasksReview2plus`, `rulings`, `rulingsOutsideFiles`, `minorDeferred`).
- Dòng ledger script nhận (D2): task xong = `^Task \d+: complete\b` không phân biệt hoa thường, loại `complete?` bằng `(?!\?)`, một task nhiều dòng `complete` đếm một lần theo `<ledger>#<n>`; `^Task (\d+): review (\d+) (compliant|issues|cannot_verify) \d+/\d+/\d+`; `^Ruling:`; `^minor \(deferred\)`; ruling "ngoài Files" khớp `/ngoài\s+\**Files/i`; request = tên thư mục cấp một dưới `runs/`; chỉ task đã xong vào mẫu số.
- Thiếu `--project` hoặc không thấy `progress.md` nào: exit 1, stdout rỗng, stderr nêu lý do.
- Biểu thức cấm của contract 57 (D5), không phân biệt hoa thường, quét file `.md`, `.json`, `.mjs`, không quét `docs/`, không quét chính contract: `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
- `baseline.json` không chứa tên thư mục, tên riêng hay đường dẫn tuyệt đối; `project` = `source-project`; project nguồn chỉ đọc.
- Test theo `AGENTS.md` mục Testing: contract 57 và 58 là bất biến vận hành; không ghim câu văn; thư mục tạm của test tạo bằng `fs.mkdtempSync(os.tmpdir())` và xoá bằng `fs.rmSync`.
- Không đổi `AGENTS.md`, `core/agents/AGENTS.template.md`, `check-request.mjs`, `ledger.mjs`, template plan.
- Commit theo `git-workflow`: header Conventional Commits tiếng Anh, thân tiếng Việt có dấu, không `Co-authored-by`.

## Review Focus

- Dòng `Task 5: complete? chờ re-review` bị `(?!\?)` loại, và task có hai dòng `complete` chỉ đếm một lần: Task 1 (case AC1.4 trong contract 58).
- Dòng review của task chưa `complete` không vào `tasksReview2plus` và không vào hai khoá `tasksIssuesAtRound*`: Task 1 (AC1.4).
- `Ruling: ngoài AC, đổi hành vi` không bị đếm vào `rulingsOutsideFiles`: Task 1 (AC1.3).
- Script không tạo hay sửa file trong `--project` và không in stderr khi thành công: Task 2 (AC1.1, so snapshot danh sách file trước và sau).
- Chạy tay contract 57 đỏ khi chèn tạm một tên cấm vào file dưới `core/` (rồi bỏ): Task 3.

### Task 1: parseLedger và measure
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.2, AC1.3, AC1.4
**Ước lượng:** 25'
**Files:**
- Create: `scripts/ledger-metrics.mjs`
- Create: `test/contract/58-ledger-metrics.contract.mjs`
- Test: `test/contract/58-ledger-metrics.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `parseLedger(text)` trả `{ complete, maxRound, issueRounds, rulings, outsideFiles, minor }`; `measure(dir, label)` trả object có đủ khoá D3

- [ ] **Step 1:** Viết case AC1.2 (4 task: một compliant vòng 1; issues rồi compliant; ba vòng; không review), AC1.3 (hai request, ba `Ruling:`, hai `minor (deferred)`) và AC1.4 (`complete?`, task chưa complete, task có hai dòng complete) trong contract 58, dựng ledger giả ở thư mục tạm, gọi `measure`, assert từng số. Tên case nhắc ID AC.
- [ ] **Step 2:** Chạy `npm run build` rồi `node test/validate.mjs --build --only 58-ledger-metrics`. Kết quả mong đợi: đỏ (chưa có `scripts/ledger-metrics.mjs`).
- [ ] **Step 3:** Viết `parseLedger` và `measure` theo Global Constraints; comment đầu file nêu dạng dòng nhận và hai chỉ số thành công (`pctReview2plus`, `outsideFilesPerRequest`). Chạy lại lệnh bước 2. Kết quả mong đợi: xanh.
- [ ] **Step 4:** Commit (`feat(scripts): add ledger-metrics parse and measure`).

### Task 2: CLI của script đo
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1, AC1.5
**Ước lượng:** 20'
**Files:**
- Modify: `scripts/ledger-metrics.mjs`
- Modify: `test/contract/58-ledger-metrics.contract.mjs`
- Test: `test/contract/58-ledger-metrics.contract.mjs`

**Interfaces:**
- Consumes: `parseLedger(text)`, `measure(dir, label)`
- Produces: CLI `node scripts/ledger-metrics.mjs --project <dir> [--label <nhãn>]` (stdout JSON, exit 0 hoặc 1)

- [ ] **Step 1:** Thêm case AC1.1 (chạy CLI bằng `child_process` trên thư mục tạm có ledger: exit 0, stdout parse được JSON đủ khoá D3, `project` = `--label`, mặc định `project`, stderr rỗng, danh sách file của thư mục trước và sau chạy giống nhau) và AC1.5 (thư mục rỗng và thiếu `--project`: exit 1, stderr không rỗng, stdout rỗng). Chạy `node test/validate.mjs --build --only 58-ledger-metrics`. Kết quả mong đợi: đỏ.
- [ ] **Step 2:** Thêm phần CLI vào script (đọc đối số, in JSON, lỗi ra stderr với exit 1; chỉ chạy khi file là entry). Chạy lại lệnh bước 1. Kết quả mong đợi: xanh.
- [ ] **Step 3:** Commit (`feat(scripts): add ledger-metrics cli`).

### Task 3: Contract 57 trung lập tên riêng
**Kind:** TOOLING
**TDD:** không — task chính là contract; contract xanh ngay trên cây hiện tại (0 dòng khớp), chỉ bắt thêm về sau; đỏ giả lập bằng chèn tạm ở Step 2
**Phủ AC:** AC7.4
**Ước lượng:** 15'
**Files:**
- Create: `test/contract/57-skill-neutral.contract.mjs`
- Test: `test/contract/57-skill-neutral.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [ ] **Step 1:** Viết contract theo D5: quét `core/`, `plugins/`, `workflows/`, `test/routing/` (`.md`, `.json`, `.mjs`), loại chính file contract và `docs/`, fail kèm `file:dòng` khi dòng khớp biểu thức ở Global Constraints. Chạy `node test/validate.mjs --build --only 57-skill-neutral`. Kết quả mong đợi: xanh (AC7.4 nhắc ở tên case).
- [ ] **Step 2:** Chèn tạm chuỗi `cap-core` vào một file dưới `core/`, chạy lại lệnh bước 1: đỏ, thông báo nêu đúng file và dòng; bỏ chuỗi, chạy lại: xanh. Không commit chuỗi chèn tạm (`git diff --stat` chỉ còn contract mới).
- [ ] **Step 3:** Commit (`test(contract): add skill neutrality contract 57`).

### Task 4: baseline.json và dòng Commands
**Kind:** TOOLING
**TDD:** không — dữ liệu sinh từ script đã có test; AC1.6 kiểm bằng case đọc file thật
**Phủ AC:** AC1.6
**Ước lượng:** 15'
**Files:**
- Create: `docs/requests/2026-11-11-skill-enrichment-from-usage/baseline.json`
- Modify: `test/contract/58-ledger-metrics.contract.mjs`
- Modify: `CLAUDE.md`
- Test: `test/contract/58-ledger-metrics.contract.mjs`

**Interfaces:**
- Consumes: CLI `node scripts/ledger-metrics.mjs --project <dir> [--label <nhãn>]`
- Produces: `baseline.json` (đủ khoá D3, `project` = `source-project`)

- [ ] **Step 1:** Thêm case AC1.6 vào contract 58 (đọc `baseline.json` thật: đủ khoá D3, `ledgers` ≥ 1, `tasks` ≥ 1, `project` = `source-project`, `pctReview2plus` = `tasksReview2plus / tasks * 100` làm tròn 1 chữ số, không có đường dẫn tuyệt đối). Chạy `node test/validate.mjs --build --only 58-ledger-metrics`. Kết quả mong đợi: đỏ (chưa có file).
- [ ] **Step 2:** Chạy `node scripts/ledger-metrics.mjs --project E:\Mine\Project\content-automation-platform --label source-project > docs/requests/2026-11-11-skill-enrichment-from-usage/baseline.json`. Chỉ đọc `.aip/runs/**/progress.md` của project nguồn; không ghi, không sửa gì ở đó (`git -C` project nguồn không đổi `git status`). Kết quả mong đợi: exit 0, stderr rỗng.
- [ ] **Step 3:** Mở `baseline.json` kiểm bằng mắt không có tên thư mục, tên riêng hay ổ đĩa (`grep -i -E "content-automation|[A-Z]:\\\\" baseline.json` ra 0 dòng); lệnh chạy lại đã ghi ở mục "Số nền" của `design.md` (không sửa design). Chạy lại lệnh bước 1. Kết quả mong đợi: xanh.
- [ ] **Step 4:** Thêm vào mục Commands của `CLAUDE.md` một dòng `node scripts/ledger-metrics.mjs --project <dir> [--label <nhãn>]   # đếm vòng review, ruling, minor từ .aip/runs/**/progress.md (in JSON; số nền ở docs/requests/2026-11-11-skill-enrichment-from-usage/baseline.json)`, cùng kiểu với dòng `routing-score.mjs`.
- [ ] **Step 5:** Commit (`feat(scripts): record ledger metrics baseline`).

## Bước file dùng chung (session gốc, không phải task của part)

Part chạy song song trong worktree riêng và không ghi các file này (D10, `check-partition.mjs` P2). Session gốc làm theo thứ tự dưới đây, sau mỗi `merge --no-ff` của một part, trước khi cắt part kế tiếp từ đỉnh mới của `feature/skill-enrichment-from-usage`.

**Phủ AC:** AC7.1, AC7.2, AC7.3, AC7.5, AC7.6

Sau mỗi part được merge:
1. Bump `version` ở `.manifest.json` của plugin vừa merge: part 01 → `core` và `workflows`; part 02 → `engineering`; 03 → `backend`; 04 → `frontend`; 05 → `data`. Không bump `ops`.
2. Part 02, 03, 04 (skill mới): viết `test/routing/<id>.json` cho `engineering-api-research`, `backend-llm-integration`, `frontend-manual-check` (≥ 3 positive, ≥ 2 negative, subagent mù chỉ thấy `## Quy trình`, không thấy `description`); thêm `backend/backend-llm-integration` và `frontend/frontend-manual-check` vào `plugins/_published.json` (`engineering` đã publish cả plugin).
3. `npm run build`, rồi `node cli/lib/versions.mjs --lock`, rồi `node scripts/routing-score.mjs` (positive ≥ 69, negative ≥ 94; tụt dưới `test/routing/rank1.lock.json` thì sửa `description` của skill mới, không hạ khoá), rồi `node scripts/routing-score.mjs --lock` khi tăng.
4. Full suite `npm test` một lần; đỏ thì dừng nhóm và sửa trên `feature/skill-enrichment-from-usage`. Contract 56 đỏ trên nhánh part 02 là bình thường cho tới bước 2.
5. Cập nhật cột Trạng thái của Bảng part trong `design.md` thành `merged <hash>` (đúng quyền của session gốc) và ghi `Part <nn>-<slug>: merged <hash>` vào ledger `root/`.

Kết thúc nhánh (sau part cuối):
1. `CHANGELOG.md`, `README.md`/`README_VI.md`, và `docs/specs/*` theo mục "Ảnh hưởng spec" (skill-quality: thêm R3, R4, R5; workflows: thêm R21, đổi R7, thêm R22; thêm dòng vào bảng lịch sử của mỗi spec), rồi chạy `check-request.mjs` với `--base <ref>`.
2. Grep D5 trên diff: `git diff <base>..HEAD -- core plugins workflows test/routing | grep '^+' | grep -v '^+++' | grep -n -i -E '<biểu thức D5>'` ra 0 dòng.
3. Xác nhận `git diff <đầu nhánh>..HEAD -- AGENTS.md core/agents/AGENTS.template.md` rỗng (AC7.6); `node test/validate.mjs --build` không có cảnh báo "quá mốc 300" mới (AC7.2); `check-partition.mjs` không còn P1, P2, P4 (AC7.5).
4. `npm test` một lần; exit 0 (AC7.1: số pass `validate` chỉ đổi theo `Ruling:` nêu phép kiểm thay thế). ADR-0005 giữ `Status: Proposed` tới khi người chốt.
