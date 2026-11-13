# Codebase Onboarding Skill Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** Thêm skill `engineering-codebase-onboarding` vào plugin `engineering` cùng hai script Node có test (kiểm kê module, quét secret), nối vào orchestrator và README, bump version.
**Architecture:** Skill theo khuôn `engineering-spec-backfill`: `SKILL.md` ở session chính điều phối, `references/` giữ prompt và khung tài liệu, `scripts/` giữ hai script zero-dep. Test là một pin `test/content/54-codebase-onboarding.pin.mjs` dựng fixture lúc chạy.
**Tech Stack:** Node 20+ ESM thuần, không dependency; Markdown tiếng Việt; harness `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/engineering/skills/engineering-codebase-onboarding/scripts/inventory-modules.mjs` | Kiểm kê module từ build file, đếm file và dòng, liệt kê thư mục chưa thuộc module | Task 1 |
| `plugins/engineering/skills/engineering-codebase-onboarding/scripts/scan-secrets.mjs` | Quét Markdown tìm dấu hiệu secret, in `file:line loại`, không in giá trị | Task 2 |
| `test/content/54-codebase-onboarding.pin.mjs` | Pin: test hai script bằng fixture dựng lúc chạy, kiểm đường dẫn `check-citations.mjs` và tên script trong `SKILL.md` | Task 1, Task 2, Task 5 |
| `plugins/engineering/skills/engineering-codebase-onboarding/references/subagent-prompts.md` | Prompt nhóm module, ghép module lớn, tổng hợp, reviewer; mẫu `agent_result` | Task 3 |
| `plugins/engineering/skills/engineering-codebase-onboarding/references/readme-structure.md` | Khung README module, README root, bốn file `project-knowledge/`, luật bằng chứng | Task 3 |
| `plugins/engineering/skills/engineering-codebase-onboarding/references/final-report.md` | Mẫu báo cáo cuối | Task 3 |
| `plugins/engineering/skills/engineering-codebase-onboarding/SKILL.md` | Frontmatter, quy trình tám bước hai cổng, ranh giới an toàn, bản đồ tài liệu | Task 4 |
| `plugins/engineering/skills/engineering-codebase-onboarding/references/scope-and-budget.md` | Trường kiểm kê, nhóm, ngân sách, mức đọc bắt buộc và mở rộng | Task 4 |
| `plugins/engineering/skills/engineering-codebase-onboarding/references/secret-safety.md` | Lệnh đọc tên khoá, danh sách file cấu hình, mẫu file findings, bảng định tuyến, câu rủi ro còn lại | Task 4 |
| `test/routing/engineering-codebase-onboarding.json` | Prompt routing positive và negative của skill mới | Task 5 |
| `test/routing/rank1.lock.json` | Khoá ngưỡng routing, chỉ nâng bằng `--lock` khi số đo tăng | Task 5 |
| `workflows/orchestrator/WORKFLOW.md` | Thêm một dòng định tuyến quét project cũ tới skill mới | Task 6 |
| `README.md`, `README_VI.md` | Bỏ dòng G7 khỏi Roadmap "chưa làm", thêm skill vào danh sách `engineering` | Task 6 |
| `CLAUDE.md` | Dòng "Content spans": số skill `engineering` và tên skill mới | Task 6 |
| `plugins/engineering/.manifest.json` | Version 2.15.0 → 2.16.0, `description` 15 skill | Task 7 |
| `workflows/.manifest.json` | Bump version vì thêm dòng orchestrator | Task 7 |
| `plugins/_versions.lock.json` | Sinh lại bằng `node cli/lib/versions.mjs --lock` | Task 7 |

## Global Constraints
- Tiếng Việt có dấu, UTF-8 không BOM, LF; script Node thuần, không dependency, comment chỉ giải thích lý do (`AGENTS.md`, mục Comments).
- Tên skill `engineering-codebase-onboarding`; frontmatter `order: 15`, `runsIn: execute`, `invoke: per-request`; `description` ≤ 500 ký tự, có `Dùng khi người dùng muốn "…"` (3–5 trigger) và `Không dùng khi … → engineering-spec-backfill; … → engineering-repo-audit; … → engineering-quality-gate`; nói rõ là quét code để viết tài liệu, không phải cài AIP cho người mới clone.
- Số hiệu chỉnh: nhóm ≤ 150 file nguồn và ≤ 15.000 dòng; ≤ 60 lần gọi công cụ mỗi subagent; ≤ 6 subagent song song; module vượt trần chia theo thư mục con cấp một. Tất cả là `[giả định]` ghi trong báo cáo.
- `sourceFiles` và `lines` tính trên đuôi `java kt groovy scala js jsx ts tsx mjs cjs py go cs rs rb php vue sql`; `testFiles` tách theo thư mục `test`, `tests`, `__tests__`, `src/test` hoặc tên `*.test.*`, `*.spec.*`, `test_*.py`. File cấu hình, tài nguyên, README không tính dòng và không bị mở.
- Thoát: cả hai script exit 0 sạch, 1 (chỉ `scan-secrets`) có khớp, 2 sai đối số hoặc file không đọc được; `inventory-modules` không nhận ra build file thì `modules: []` kèm `notes`, exit 0.
- Subagent: `general-purpose`, `model: "sonnet"`; Agent trả 404 thì bỏ trống `model` và ghi vào báo cáo cuối. Cấm `Read`, `cat`, `Grep` chế độ nội dung trên file cấu hình; chỉ lệnh in tên khoá. Mũi tên liên kết giữa module và số liệu cụ thể kèm `file:line`, còn lại ghi "suy từ tên" hoặc `[Unverified]`.
- Danh sách ghi được ở project đích: README module và README root trong bảng đã duyệt, `project-knowledge/project-overview.md`, `architecture.md`, `source-structure.md`, `tech-stack.yml`, và dưới `.aip/runs/onboarding-<slug>/` (findings, `parts/`, `.aip/.gitignore`). Không ghi `docs/specs/`, `domain-context.md`, `code-convention.md`. README hoặc `project-knowledge/` có sẵn chỉ đổi theo lựa chọn ở cổng 1: giữ, khối marker `<!-- aip:onboarding begin -->` … `<!-- aip:onboarding end -->`, hoặc bỏ; `tech-stack.yml` chỉ giữ hoặc bỏ.
- Quy trình skill: hai cổng ⏸ (bảng module trước subagent, `git diff` trước commit); commit `docs(onboarding): …` qua `core:git-workflow` trên nhánh không protected; không push; findings không vào commit.
- Fixture của test dựng lúc chạy trong thư mục tạm; chuỗi giống secret ghép từ mảnh để file test không chứa nguyên chuỗi.
- Không sửa `engineering-spec-backfill`, `engineering-repo-audit`, `check-citations.mjs`, `plugins/_cowork.json`.
- Commit: header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu, `git commit -F`, không `Co-Authored-By`.

## Review Focus
- Script kiểm kê không in nội dung file cấu hình (sentinel trong `application.yml`, `.env`, `pom.xml`): Task 1 test AC2.3.
- `scan-secrets` không in đoạn khớp, kể cả khi báo lỗi: Task 2 test AC3.1.
- Module lồng nhau không đếm hai lần, file ngoài module không mất: Task 1 test AC2.5.
- `check-citations.mjs` của skill anh em còn ở đúng đường dẫn mà `SKILL.md` gọi: Task 5 pin AC4.4.
- Routing sát khoá 69/94 sau khi `description` chốt: Task 5 chạy `node scripts/routing-score.mjs`.

### Task 1: Script kiểm kê module `inventory-modules.mjs`
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC2.1, AC2.2, AC2.3, AC2.4, AC2.5
**Files:**
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/scripts/inventory-modules.mjs`
- Create: `test/content/54-codebase-onboarding.pin.mjs`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `inventoryModules(root)` trả `{ modules: [{ id, path, kind, buildFile, sourceFiles, testFiles, lines, hasReadme, declaredDeps }], unclaimed: string[], rootFiles: number, projectKnowledge: { 'project-overview.md': boolean, 'architecture.md': boolean, 'source-structure.md': boolean, 'tech-stack.yml': boolean }, notes: string[] }`; `main(argv)` trả exit code (0 hoặc 2) và in JSON hoặc bảng theo `--format json|table`; CLI `inventory-modules.mjs <gốc> [--format json|table]`

- [ ] **Step 1:** Tạo `test/content/54-codebase-onboarding.pin.mjs` (`export default async function run({ ok, ctx })`, import script bằng `pathToFileURL`) với các ca tham số hoá, fixture dựng bằng `mkdtempSync` rồi xoá bằng `fs.rmSync`: Maven cha khai hai `<module>` (AC2.1: `kind`, `path`, `buildFile`, `sourceFiles`, `hasReadme`, `declaredDeps` chỉ module anh em); Gradle `include`, npm `workspaces` dạng mảng và `{packages}`, pnpm `pnpm-workspace.yaml`, Python hai thư mục có `pyproject.toml` (AC2.2); sentinel trong `application.yml`, `.env`, `pom.xml` không xuất hiện ở stdout/stderr của CLI (AC2.3); `docs/` ngoài module vào `unclaimed`, `node_modules/` không tính, gốc không tồn tại hoặc thiếu đối số exit 2, stack lạ `modules: []` kèm `notes` và exit 0 (AC2.4); module tổng hợp `packaging pom` không đếm lại file của module con, file ngoài module tính vào `rootFiles`/`unclaimed`, `testFiles` tách khỏi `sourceFiles` (AC2.5). Tên mỗi `ok(...)` bắt đầu bằng ID AC.
- [ ] **Step 2:** Chạy `node test/validate.mjs --only codebase-onboarding`. Mong đợi: exit 1 (import script thiếu). Ghi lệnh và kết quả làm `red:` cho ledger. Commit riêng phần test đỏ qua `core:git-workflow`.
- [ ] **Step 3:** Viết `inventory-modules.mjs` đủ cho AC trên: danh sách file từ `git ls-files` khi gốc là repo git, ngược lại duyệt bằng `fs` bỏ `node_modules`, `target`, `build`, `dist`, `.git`, mỗi file đếm một lần; bộ nhận diện Maven (`<module>`), Gradle (`include`), npm/yarn (`workspaces`), pnpm (`packages:`), Python (`pyproject.toml`, `setup.py`, `requirements.txt`); chủ sở hữu file là module có đường dẫn sâu nhất; chỉ mở build file và file nguồn để đếm dòng, không mở file cấu hình; export `inventoryModules` và `main`, chạy khi là entry (cùng cách `realpath` như `check-citations.mjs` vì skill cài qua junction trên Windows).
- [ ] **Step 4:** Chạy lại `node test/validate.mjs --only codebase-onboarding`. Mong đợi: exit 0. Chạy thêm `node plugins/engineering/skills/engineering-codebase-onboarding/scripts/inventory-modules.mjs . --format table` ở gốc repo: mong đợi `modules` rỗng kèm `notes`, không in nội dung file.
- [ ] **Step 5:** Commit phần code qua `core:git-workflow` (`feat(engineering): add module inventory script for codebase onboarding`).

### Task 2: Script quét secret `scan-secrets.mjs`
**Kind:** TOOLING
**TDD:** có
**Ước lượng:** 25 phút
**Phủ AC:** AC3.1, AC3.2, AC3.3
**Files:**
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/scripts/scan-secrets.mjs`
- Modify: `test/content/54-codebase-onboarding.pin.mjs`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `scanText(text)` trả `[{ line: number, kind: string }]` với `kind` thuộc `private-key`, `cloud-key-id`, `jwt`, `url-credentials`, `secret-assignment`, `private-ip`; `scanPaths(targets)` trả `[{ file, line, kind }]`; `main(argv)` trả 0 sạch, 1 có khớp, 2 sai đối số; CLI `scan-secrets.mjs <file | thư mục> …`, in `file:line kind`

- [ ] **Step 1:** Thêm vào pin 54 các ca: file Markdown fixture mỗi dòng một loại trong sáu loại (chuỗi giống secret ghép từ mảnh) → CLI in sáu dòng `file:line kind`, exit 1, stdout không chứa mảnh giá trị nào (AC3.1); file chỉ có tên khoá, `password: <…>`, `${DB_PASSWORD}`, `***`, giá trị rỗng, `127.0.0.1`, `0.0.0.0`, `192.0.2.10`, số phiên bản `1.2.3` → exit 0 (AC3.2); thư mục có `.md` và `.txt` cùng chứa secret → chỉ `.md` bị báo, thiếu đối số hoặc file không đọc được → exit 2 (AC3.3).
- [ ] **Step 2:** Chạy `node test/validate.mjs --only codebase-onboarding`. Mong đợi: exit 1 (script thiếu). Ghi `red:`. Commit riêng phần test đỏ.
- [ ] **Step 3:** Viết `scan-secrets.mjs`: regex theo sáu loại; bỏ qua giá trị rỗng, `<…>`, `${…}`, `***`, `changeme`, `127.0.0.1`, `0.0.0.0`, dải `192.0.2.x`, số phiên bản ba phần; thư mục quét đệ quy `.md`; file nêu rõ quét bất kể đuôi; thông báo chỉ gồm `file:line kind`, không bao giờ chứa đoạn khớp (kể cả khi lỗi đọc file); comment nêu giới hạn heuristic ở đầu file.
- [ ] **Step 4:** Chạy lại `node test/validate.mjs --only codebase-onboarding`. Mong đợi: exit 0.
- [ ] **Step 5:** Commit code (`feat(engineering): add secret scan script for codebase onboarding`).

### Task 3: References prompt, khung tài liệu và báo cáo cuối
**Kind:** DOCS
**Ước lượng:** 25 phút
**Phủ AC:** AC4.3, AC5.1
**Files:**
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/references/subagent-prompts.md`
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/references/readme-structure.md`
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/references/final-report.md`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: CLI `inventory-modules.mjs` và `scan-secrets.mjs` của Task 1 và Task 2 (tên script, cờ, mã thoát)
- Produces: tên tài liệu `references/subagent-prompts.md`, `references/readme-structure.md`, `references/final-report.md` mà `SKILL.md` của Task 4 dẫn tới

- [ ] **Step 1:** Viết `subagent-prompts.md` theo khuôn `engineering-spec-backfill/references/subagent-prompt.md`: prompt nhóm module (đầu vào, được phép, không được, danh sách ghi được, luật bằng chứng mỗi khẳng định, lệnh in tên khoá, mức đọc bắt buộc rồi mở rộng trong ngân sách), prompt ghép module vượt trần từ `parts/`, prompt tổng hợp README root và bốn file `project-knowledge/`, prompt reviewer mới (mở dòng của mọi mũi tên liên kết và tối đa 10 số liệu mỗi module, kết luận đúng/sai/không xác minh được), mẫu `agent_result` có `read[]`, `not_read[]`, `findings[]` (loại, `file:line`, `proven|suspected`) và `remaining_risks[]`, mục kiểm đầu ra ở session chính.
- [ ] **Step 2:** Viết `readme-structure.md`: khung README module (mục đích, cấu trúc thư mục, điểm vào, API hoặc route, cấu hình bằng tên khoá, phụ thuộc có nhãn "có lời gọi" hay "chỉ khai báo", đã đọc/chưa đọc), khung README root, cách điền bốn file từ `<thư mục skill artifact-templates>/references/project-knowledge/` (bỏ khối header của template), luật marker cho file có sẵn, Mermaid luôn kèm bảng chữ cùng nội dung.
- [ ] **Step 3:** Viết `final-report.md`: mẫu báo cáo cuối gồm mỗi module đã đọc và chưa đọc, số trích dẫn hỏng, số phát hiện và nơi để file, thư mục `unclaimed`, số `[Unverified]`, hiệu chỉnh ngân sách thực tế, `not_run` nếu có, và câu cố định nêu chưa kiểm được log phiên sau khi lệnh đã in giá trị cấu hình.
- [ ] **Step 4:** Đối chiếu khẳng định với code: liệt kê tên script, cờ `--format`, mã thoát, tên bốn file `project-knowledge/`, đường dẫn template, tên trường `agent_result` đã viết; grep trong hai script và `core/skills/artifact-templates/references/project-knowledge/`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; dòng `lệch` thì sửa docs hoặc gắn `[Unverified]`.
- [ ] **Step 5:** Commit (`docs(engineering): add onboarding prompts, README structure and report template`).

### Task 4: `SKILL.md`, phạm vi và an toàn secret
**Kind:** DOCS
**Ước lượng:** 25 phút
**Phủ AC:** AC1.1, AC4.1, AC4.2, AC4.4, AC4.5
**Files:**
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/SKILL.md`
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/references/scope-and-budget.md`
- Create: `plugins/engineering/skills/engineering-codebase-onboarding/references/secret-safety.md`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: `references/subagent-prompts.md`, `references/readme-structure.md`, `references/final-report.md` của Task 3; CLI của hai script (Task 1, Task 2); `<thư mục skill engineering-spec-backfill>/scripts/check-citations.mjs`
- Produces: skill `engineering-codebase-onboarding` mà Task 5 và Task 6 dẫn tới

- [ ] **Step 1:** Viết `scope-and-budget.md`: bảng trường kiểm kê, quy tắc sở hữu file của module lồng nhau, cách nhóm module theo trần 150 file và 15.000 dòng, cách chia module vượt trần theo thư mục con cấp một và ghi `parts/`, mức đọc bắt buộc (build file, entrypoint, route, tên khoá cấu hình, Dockerfile, CI) rồi mở rộng theo ngân sách 60 lần gọi, tối đa 6 song song; mọi số ghi `[giả định]`.
- [ ] **Step 2:** Viết `secret-safety.md`: lệnh in tên khoá (`grep -oE` rồi bỏ dấu phân cách), danh sách mẫu tên file cấu hình bị cấm đọc nội dung, mẫu file findings (chỉ loại, `file:line`, `proven|suspected`), bảng định tuyến sang `engineering-quality-gate` và `workflow-security-review`, `.aip/.gitignore` chứa `*`, câu rủi ro còn lại về log phiên; skill không tự chạy gate và không sửa lỗ hổng.
- [ ] **Step 3:** Viết `SKILL.md` theo khuôn `engineering-spec-backfill/SKILL.md`: frontmatter (Global Constraints), mở đầu nêu khác `spec-backfill`/`repo-audit` và nghĩa của "onboarding" ở đây, `## Ranh giới an toàn` (danh sách ghi được, không đọc `.env` và file cấu hình, công cụ được dùng, hai cổng không bỏ qua, README và `project-knowledge/` có sẵn không ghi đè), `## Quy trình — onboarding` tám bước của design (cổng 1 ⏸ và cổng 2 ⏸), bước kiểm cơ học với `check-citations.mjs` (thiếu script thì `not_run`, không chặn cổng 2 nhưng nêu nổi bật), `scan-secrets.mjs` và `git status --porcelain` so với nền, `## Verification`, `## Bản đồ tài liệu` liên kết đủ năm file `references/`.
- [ ] **Step 4:** Đối chiếu khẳng định với code: tên script, cờ, mã thoát, đường dẫn `check-citations.mjs` (`plugins/engineering/skills/engineering-spec-backfill/scripts/check-citations.mjs`), danh sách file cấu hình, hằng số ngân sách so với Global Constraints, tên skill đích của `Không dùng khi` so với `plugins/*/skills/`; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 5:** Chạy `node test/validate.mjs --build --only conventions`. Mong đợi: exit 0 (frontmatter, `description` ≤ 500, hai H2 bắt buộc). Commit (`feat(engineering): add engineering-codebase-onboarding skill`).

### Task 5: Dữ liệu routing và pin cấu trúc
**Kind:** TOOLING
**TDD:** không — pin chỉ kiểm điều đã có (đường dẫn script anh em, tên script trong `SKILL.md`), không có hành vi mới để đỏ trước; số đo routing do `routing-score.mjs` quyết định
**Ước lượng:** 20 phút
**Phủ AC:** AC1.2, AC4.4
**Files:**
- Create: `test/routing/engineering-codebase-onboarding.json`
- Modify: `test/content/54-codebase-onboarding.pin.mjs`
- Modify: `test/routing/rank1.lock.json`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: skill của Task 4 (`description`, tên script trong `SKILL.md`); `scripts/routing-score.mjs`
- Produces: không có

- [ ] **Step 1:** Viết `test/routing/engineering-codebase-onboarding.json` (≥ 3 positive, ≥ 2 negative, prompt tiếng Việt tự nhiên không lặp nguyên văn `description`; negative lấy từ việc của `engineering-spec-backfill`, `engineering-repo-audit`, `engineering-quality-gate`).
- [ ] **Step 2:** Chạy `node scripts/routing-score.mjs`. Mong đợi: exit 0, positive ≥ 69% và negative ≥ 94%, `git diff master -- plugins/engineering/skills/engineering-spec-backfill/SKILL.md plugins/engineering/skills/engineering-repo-audit/SKILL.md` rỗng. Không đạt thì sửa `description` của G7 hoặc viết lại prompt (không chọn prompt để ép số), tối đa hai vòng; vẫn không đạt thì dừng và báo người dùng; không hạ `rank1.lock.json`.
- [ ] **Step 3:** Thêm vào pin 54 (tên ca có `AC4.4`/`AC1.2`): `check-citations.mjs` của `engineering-spec-backfill` tồn tại ở đúng đường dẫn `SKILL.md` gọi; `SKILL.md` nhắc `inventory-modules.mjs`, `scan-secrets.mjs`, `check-citations.mjs` và có ít nhất hai dấu ⏸; comment trong pin ghi AC4.1–AC4.3, AC4.5, AC5.1, AC6.2 kiểm ở review (không có test tự động).
- [ ] **Step 4:** Chạy `node test/validate.mjs --only codebase-onboarding` (mong đợi exit 0), rồi `node scripts/routing-score.mjs --lock` để nâng khoá nếu số đo tăng. Commit (`test(engineering): add routing data and structure pins for codebase onboarding`).

### Task 6: Orchestrator, README và CLAUDE.md
**Kind:** DOCS
**Ước lượng:** 15 phút
**Phủ AC:** AC6.2
**Files:**
- Modify: `workflows/orchestrator/WORKFLOW.md`
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: skill `engineering-codebase-onboarding` của Task 4
- Produces: không có

- [ ] **Step 1:** Trong `workflows/orchestrator/WORKFLOW.md`, bảng "Yêu cầu chạy trực tiếp bằng skill", thêm một dòng ngay sau dòng `backfill spec`: `"quét project cũ viết README từng module", "mô tả codebase cho người mới", "dựng project-knowledge từ code"` → `engineering-codebase-onboarding` (plugin `engineering`), các cột phụ `— | — | —`.
- [ ] **Step 2:** Trong `README.md` và `README_VI.md`: bỏ dòng G7 khỏi bảng Roadmap "chưa làm"; giữ `workflow-onboarding` ở mục "Workflow tương lai" (không thuộc request này) và đổi chú thích G7 thành đã có skill; thêm `engineering-codebase-onboarding` vào danh sách skill của dòng `engineering`.
- [ ] **Step 3:** Trong `CLAUDE.md`, dòng "Content spans": số skill `engineering` thành 15 và thêm `engineering-codebase-onboarding` vào danh sách nêu tên.
- [ ] **Step 4:** Đối chiếu khẳng định với code: tên skill, tên plugin, số 15 (đếm `plugins/engineering/skills/*/SKILL.md`), vị trí dòng trong bảng orchestrator; ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo task; sửa dòng `lệch`.
- [ ] **Step 5:** Commit (`docs(readme): announce engineering-codebase-onboarding and orchestrator route`).

### Task 7: Bump version, lock và chạy bộ test
**Kind:** TOOLING
**TDD:** không — thay đổi phát hành, kiểm bằng `npm test` và versions lock đã có
**Ước lượng:** 20 phút
**Phủ AC:** AC6.1
**Files:**
- Modify: `plugins/engineering/.manifest.json`
- Modify: `workflows/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Test: `test/content/54-codebase-onboarding.pin.mjs`

**Interfaces:**
- Consumes: mọi file của Task 1–Task 6
- Produces: không có

- [ ] **Step 1:** Trong `plugins/engineering/.manifest.json`: `version` 2.15.0 → 2.16.0, `description` ghi 15 skill và thêm `engineering-codebase-onboarding`; trong `workflows/.manifest.json`: tăng version một mức patch.
- [ ] **Step 2:** Chạy `npm run build`, rồi `node cli/lib/versions.mjs --lock`. Mong đợi: lock sinh lại, không báo "đổi nội dung mà chưa đổi version".
- [ ] **Step 3:** Chạy `npm test` một lần. Mong đợi: exit 0. Có test đếm số skill hoặc catalog đỏ thì thêm file đó vào `**Files:**` kèm lý do và sửa; `git diff master -- plugins/_cowork.json` phải rỗng.
- [ ] **Step 4:** Chạy `node scripts/routing-score.mjs` lần cuối. Mong đợi: exit 0, không dưới khoá. Commit (`chore(engineering): bump engineering to 2.16.0 and workflows version, refresh lock`).
