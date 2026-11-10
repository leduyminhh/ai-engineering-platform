# Thiết kế: thu hẹp bốn mảng agent-skills mạnh hơn aip
- Ngày: 2026-11-10
- Trạng thái: approved — G1 2026-11-10
- Requirement: không có (brief: [brief.md](brief.md))

## Vấn đề và lý do

Brief đã duyệt nêu bốn mảng aip còn thiếu so với addyosmani/agent-skills (`301b02b`): đo routing của skill, kiểm nguồn docs
chính thức, quality bar có guard, bảng "Dấu hiệu đang tự biện minh" cho các skill còn thiếu. Đã kiểm trong code:

- `test/contract/95-evals.contract.mjs` bắt mọi thư mục con trực tiếp của `evals/` là plugin, `core` hoặc `workflows`; mỗi
  case có `prompt.md` với `runs: 3`, grader hợp lệ theo `checkEvalCase`. Chưa có case "phải im lặng".
- Routing chỉ có `triggerCollisions` (`cli/lib/conventions.mjs`) và `test/overlap.mjs` (báo cáo, không assert).
- `core/principles/*.md` được ghép vào skill `principles` (ví dụ `trust-boundary.md` thành mục "Ranh giới tin cậy").
- `core/skills/plan-execution/scripts/review-package.mjs`: `findWeakening` bỏ qua file `.md`, nên một file quality bar dạng
  Markdown hiện không được so.
- `cli/lib/templates.mjs:18` chép nguyên `references/project-knowledge/` khi `aip init --full`; template đặt trong thư mục đó
  sẽ bị sinh tự động, trái quyết định của brief.
- Bảng tự biện minh đã có ở 7 SKILL.md; 9 skill trong brief chưa có. `SKILL.md` dài nhất hiện 237 dòng (cảnh báo 300, lỗi 500).

## Quyết định đã chốt

Từ brief (người dùng): prompt routing do subagent viết mù, chỉ thấy `## Quy trình` của SKILL.md, không thấy `description`.

Từ brief (agent), giữ nguyên: phạm vi 9 skill của P4; 3 cặp im lặng; reference kiểm nguồn trong `core/principles/`, không có
mạng thì gắn `[Unverified]` và làm tiếp; quality bar ở `project-knowledge/quality-bar.md` của project đích, `aip init` không
sinh; "nới" = bỏ lệnh kiểm, thêm hoặc gia hạn ngoại lệ, đổi ngưỡng theo hướng nới.

Chốt thêm ở design (quyết định của agent):

- **D1 — Chỗ đặt dữ liệu routing:** `test/routing/<skill-id>.json` và file khoá `test/routing/rank1.lock.json`. Không đặt dưới
  `evals/` để contract 95 không đỏ, và `test/` không ship trong npm.
- **D2 — Văn bản được chấm:** `description` cắt bỏ từ "Không dùng khi" trở đi. Phần đó liệt kê từ khoá của skill khác nên làm
  nhiễu TF-IDF. [giả định] Model thật đọc cả câu; ta chỉ đo phần "Dùng khi".
- **D3 — Ratchet:** file khoá dùng khoá JSON `threshold`, nên `findWeakening` sẵn có (`MIN_KEY` gồm `threshold`) đã báo khi ai
  hạ số bằng tay. Lệnh `--lock` của scorer chỉ ghi khi số đo cao hơn số khoá, thấp hơn thì exit 1.
- **D4 — Template quality bar:** `core/skills/artifact-templates/references/quality-bar.template.md` (ngoài
  `references/project-knowledge/`), mục lục của `artifact-templates` thêm một hàng chỉ đường chép sang
  `project-knowledge/quality-bar.md`.
- **D5 — Kiểm nguồn trỏ qua skill `principles`:** file `core/principles/source-check.md` thành mục "Kiểm nguồn" của skill
  `principles` (`readCorePrinciples` ghép `core/principles/*.md` theo tên file); 3 skill implement trỏ theo mẫu "mục X của
  skill `principles` (bản cài plugin: `core:principles`)".
- **D6 — Tập chấm routing:** `offeredCatalog().skillIds` (dạng `plugin/skill`) bỏ mọi skill principles (`core/principles` và
  `<plugin>-principles`, sinh lúc build, không có quy trình riêng), cộng mọi workflow của `loadWorkflows()` (không lọc theo
  closure). `description` lấy từ `stages` của `loadCore()`, `loadWorkflows()`, `loadPlugins()`. Id file dữ liệu là tên trần
  (`engineering-tdd`, `workflow-bugfix`); hai mục trùng tên trần thì contract fail.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given dữ liệu `test/routing/*.json` và file khoá When chạy `npm test` Then một contract chấm mọi skill và
  workflow published (theo `plugins/_published.json`, cộng toàn bộ `core` và `workflows`), tính tỉ lệ prompt positive có skill
  đúng ở hạng 1 và tỉ lệ prompt negative có skill đó không ở hạng 1, và fail khi một trong hai thấp hơn `threshold` trong
  `rank1.lock.json`. Tập chấm theo D6.
- [ ] **AC1.2** — Given tập chấm D6 When contract chạy Then mỗi id có `test/routing/<id>.json` với ≥ 3 positive và ≥ 2
  negative; file của id ngoài tập chấm, hoặc hai mục trùng tên trần, làm fail.
- [ ] **AC1.3** — Given chuỗi tiếng Việt có dấu When chuẩn hoá Then bỏ dấu, `đ` thành `d`, chữ thường, tách token chữ số, thêm
  bigram; ví dụ `"Đặc tả yêu cầu"` cho token `dac`, `ta`, `yeu`, `cau` và bigram `dac ta`.
- [ ] **AC1.4** — Given số đo và số khoá When chạy `node scripts/routing-score.mjs --lock` Then số đo (làm tròn xuống tới số
  nguyên phần trăm) cao hơn thì ghi file khoá, thấp hơn thì exit 1 không ghi; và một diff hạ `"threshold"` trong file khoá được
  `findWeakening` liệt kê là ngưỡng nới.
- [ ] **AC1.5** — Given 3 case im lặng (`engineering-tdd`/`workflow-bugfix`, `backend-code-review`/`engineering-quality-gate`,
  `git-workflow`/`git-release`) When contract 95 chạy Then cả ba hợp lệ (`runs: 3`, `allowed_tools` có `Skill`), mỗi case có
  grader `tool_used` `Skill` cho skill đúng (`min: 1`) và cho skill phải im lặng (`min: 0`, `max: 0`), cả hai có `input_match`
  dạng `'"skill"\s*:\s*"(?:[\w-]+:)?<id>"'` như `evals/engineering/tdd-red-first/graders/skill-used.md`.
- [ ] **AC2.1** — Given skill `principles` sau build When đọc Then có mục "Kiểm nguồn" nêu: xác định phiên bản từ manifest hoặc
  lockfile; ưu tiên docs chính thức đúng phiên bản; ghi deep link vào báo cáo; không tra được thì gắn `[Unverified]` và làm tiếp.
- [ ] **AC2.2** — Given `backend-implement`, `frontend-implement`, `frontend-data-integration` When đọc bước đầu của
  `## Quy trình` Then mỗi skill trỏ tới mục "Kiểm nguồn" của skill `principles` (kèm `core:principles`).
- [ ] **AC3.1** — Given `artifact-templates` When đọc Then có `references/quality-bar.template.md` với mục `## Lệnh kiểm`
  (`| Lệnh | Ngưỡng | Owner |`) và `## Ngoại lệ` (`| Ngoại lệ | Lý do | Owner | Hạn |`), mục lục `SKILL.md` có hàng trỏ tới
  nó, và `aip init --full` không sinh `project-knowledge/quality-bar.md`.
- [ ] **AC3.2** — Given bản base và head của `quality-bar.md` When so Then báo: lệnh kiểm bị bỏ; ngoại lệ thêm mới; ngoại lệ
  có `Hạn` muộn hơn; ngưỡng `>=` bị hạ hoặc `<=` bị nâng. Không báo: thêm lệnh kiểm, siết ngưỡng, bỏ ngoại lệ, rút hạn.
- [ ] **AC3.3** — Given khoảng base..head đổi `project-knowledge/quality-bar.md` When `buildPackage` chạy Then các dòng ở AC3.2
  nằm trong mục `## Dấu hiệu nới kiểm`; file chưa có ở base (`git show` lỗi, được bắt, `buildPackage` không ném) thì không báo;
  file bị xoá ở head thì mỗi lệnh kiểm cũ là một dòng "bỏ lệnh kiểm".
- [ ] **AC4.1** — Given 8 skill `backend-code-review`, `frontend-code-review`, `backend-refactor`, `frontend-refactor`,
  `engineering-quality-gate`, `ops-deploy-release`, `data-db-migration`, `git-workflow` When đọc Then mỗi skill có
  `## Dấu hiệu đang tự biện minh` với 4–6 dòng `| "…" | … |`, và thân `SKILL.md` ≤ 300 dòng; `engineering-debugging` giữ
  bảng sẵn có `## Dấu hiệu đang đoán thay vì điều tra` (4–6 dòng, không sửa file) — người dùng chốt ở G2.

## Thiết kế

### P1 — Đo routing và case im lặng

- `scripts/routing-score.mjs` (repo, không ship, cạnh `scripts/eval-run.mjs`), Node thuần. Export: `normalize(text)`,
  `tokens(text)` (unigram + bigram sau chuẩn hoá), `routable(description)` (cắt từ "Không dùng khi"), `buildIndex(docs)` (TF-IDF,
  idf = log((N+1)/(df+1)) + 1), `rank(index, prompt)` (cosine, xếp giảm dần, hoà điểm xếp theo id), `measure({ docs, data })` →
  `{ positive: { hit, total, pct }, negative: { hit, total, pct }, misses: [...] }`. CLI: không cờ in bảng tổng và danh sách
  miss; `--lock` theo D3.
- Tập skill published: dùng lại hàm đang đọc `_published.json` của wizard/catalog (không viết parser mới), cộng toàn bộ core và
  workflows (`loadCore`, `loadWorkflows`).
- `test/routing/<id>.json`: `{ "positive": ["…"], "negative": ["…"] }`. `test/routing/rank1.lock.json`:
  `{ "positive": { "threshold": N }, "negative": { "threshold": M } }`, mỗi khoá một dòng.
- Contract mới `test/contract/56-routing-score.contract.mjs` (chạy trong `validate --build`): AC1.1–AC1.4 (phần `--lock` test
  bằng hàm thuần quyết định ghi hay không, không ghi file thật).
- Dữ liệu: session chính trích `## Quy trình` của từng skill (workflow: `## Các bước`, chỉ tên bước và trường Hành động) vào
  prompt giao subagent; subagent không được đọc file trong repo, trả JSON; session chính ghi file. Positive: câu người dùng thật sẽ
  gõ để làm việc mô tả trong quy trình. Negative: câu gần lĩnh vực nhưng quy trình đó không làm.
- Ngưỡng khởi điểm: mức đo lần đầu, làm tròn xuống. Không tinh chỉnh `description` để nâng số trong request này.
- 3 case im lặng: `evals/engineering/tdd-quiet-on-bug/` (prompt báo lỗi hành vi có sẵn → `workflow-bugfix` gọi,
  `engineering-tdd` im), `evals/backend/code-review-quiet-on-scan/` (prompt quét sonar/lỗ hổng dependency →
  `engineering-quality-gate` gọi, `backend-code-review` im), `evals/core/release-quiet-on-commit/` (prompt commit thay đổi →
  `git-workflow` gọi, `git-release` im). Theo mẫu `evals/engineering/tdd-red-first/` (case.yaml/scaffold khi prompt cần file).

### P2 — Kiểm nguồn

- `core/principles/source-check.md`: mục `## Kiểm nguồn`, ngắn (≤ 15 dòng): (1) đọc phiên bản từ manifest/lockfile
  (`package.json` + lockfile, `pom.xml`, `build.gradle`, `pyproject.toml`/`requirements*.txt`); (2) thứ tự nguồn: docs chính thức
  đúng phiên bản > changelog/migration guide > source thư viện đã cài > bài viết khác; (3) API dùng lần đầu hoặc dễ đổi giữa phiên
  bản thì ghi deep link vào báo cáo (`agent_result.evidence` hoặc body commit), không vào comment code; (4) không có mạng hay
  WebFetch thì gắn `[Unverified]` cho API đó trong báo cáo và làm tiếp, không chặn.
- 3 skill implement: bước đầu `## Quy trình` thêm một câu trỏ tới mục đó.

### P3 — Quality bar

- Template D4: header `<!-- artifact-template … -->`; `## Lệnh kiểm` (`Ngưỡng` dạng `exit 0`, `<chỉ số> >= <số>` hoặc
  `<chỉ số> <= <số>`), `## Ngoại lệ` (`Hạn` dạng `yyyy-mm-dd`, bắt buộc), một dòng hướng dẫn: sửa file này đi qua review như
  code, mọi nới hiện ở review package.
- `review-package.mjs`: hàm thuần `qualityBarLoosening(oldText, newText)` trả các dòng AC3.2 (khoá dòng = ô đầu bỏ backtick;
  ô `Ngưỡng` không đọc được hướng thì báo "đổi ngưỡng, cần xét"); `buildPackage` khi `diff --name-only` có
  `project-knowledge/quality-bar.md` thì đọc hai bản bằng `git show <ref>:<path>` (không có thì chuỗi rỗng) và nối kết quả vào
  `## Dấu hiệu nới kiểm`. Không đổi `findWeakening` (vẫn bỏ `.md`).
- Test: `test/content/46-quality-bar.pin.mjs` (bảng tham số cho AC3.2, `buildPackage` với `run` giả mô phỏng thêm
  `diff --name-only` và `show` cho AC3.3); `test/contract/35-artifact-templates.contract.mjs` nâng danh sách `TYPES` từ 13 lên
  14 loại (thêm `quality-bar`, cả câu thông báo "13 loại") và pin heading của template (R2 của spec artifact-templates). Header
  template ghi `validator: chưa có`.

### P4 — Bảng tự biện minh

- Mỗi skill trong 8 skill (trừ `engineering-debugging`, giữ bảng sẵn có) thêm `## Dấu hiệu đang tự biện minh` trước `## Tham chiếu` (hoặc cuối file nếu không có), bảng
  `| Suy nghĩ | Thực tế |` 4–6 dòng, cột Thực tế trỏ về một bước, cổng hay ranh giới đã có trong chính skill đó (không thêm luật
  mới). Viết theo `engineering-writing-style`, không chép câu của agent-skills.
- Test: `test/content/47-rationalization-tables.pin.mjs` (AC4.1).

### Việc chung (plan gốc, sau các part)

Bump version `core`, `backend`, `frontend`, `engineering`, `ops`, `data` (`.manifest.json`), `npm run build`,
`node cli/lib/versions.mjs --lock`, dòng `CHANGELOG.md`, một dòng lệnh `node scripts/routing-score.mjs` ở mục Commands của
`CLAUDE.md`; ở bước kết thúc nhánh tạo `docs/specs/skill-quality/spec.md` (năng lực mới) và thêm hàng vào
`docs/specs/README.md`.

Dữ liệu routing viết mù nằm ở `plan.md` gốc, chạy trước các part: subagent part không gọi được agent khác (mục "Chế độ part"
của `task-loop.md`), nên chỉ session gốc giao được việc viết mù.

## Bảng part

| Part | Phụ thuộc | Song song | Trạng thái |
|---|---|---|---|
| 01-routing-score | — | A | merged 3c6a3361 |
| 02-source-check | — | A | merged 0f8088b1 |
| 03-quality-bar | — | A | merged d8e5dde6 |
| 04-rationalization-tables | — | A | merged b527e08a |

Tập file của bốn part rời nhau (P1: `scripts/routing-score.mjs`, `test/routing/rank1.lock.json`, contract 56, 3 thư mục case
mới; dữ liệu `test/routing/<id>.json` do plan gốc tạo; P2: `core/principles/`, 3
SKILL.md, pin 45; P3: `review-package.mjs`, `artifact-templates`, contract 35, pin 46; P4: 9 SKILL.md, pin 47). Manifest, lock
version, `CHANGELOG.md`, `CLAUDE.md` chỉ sửa ở plan gốc.

## Ảnh hưởng spec

- skill-quality: thêm R1, thêm R2
- artifact-templates: đổi R1
- workflows: thêm R20

(skill-quality/R1: scorer routing và ngưỡng khoá chỉ nâng; R2: case eval im lặng. artifact-templates/R1: thêm template quality
bar. workflows/R20: review package báo nới quality bar.)

## Ngoài phạm vi và anti-goal

- Ngoài phạm vi: eval model thật trong CI; ngưỡng coverage/mutation theo phần trăm; hook cache WebFetch; sửa `description` để
  nâng điểm routing; tự sinh `quality-bar.md` khi `aip init`.
- Anti-goal: chép câu chữ hay skill của agent-skills; thêm skill mới; ép mọi skill đủ 5 section.

## Ràng buộc

- Node thuần, không dependency. File UTF-8 không BOM, LF. Nội dung skill tiếng Việt có dấu.
- Scorer tất định: cùng dữ liệu cho cùng số, không ngẫu nhiên, không gọi mạng.
- `SKILL.md` của 12 skill bị sửa vẫn ≤ 300 dòng.
- Comment theo mục Comments của `AGENTS.md`.

## Kiểm thử

| AC | Tầng | File |
|---|---|---|
| AC1.1, AC1.2, AC1.3, AC1.4 | contract (hàm thuần + dữ liệu thật) | `test/contract/56-routing-score.contract.mjs` |
| AC1.5 | contract 95 sẵn có + pin grader | `test/contract/56-routing-score.contract.mjs` |
| AC2.1, AC2.2 | pin build output và nguồn | `test/content/45-source-check.pin.mjs` |
| AC3.1 | contract template + pin init | `test/contract/35-artifact-templates.contract.mjs`, `test/content/46-quality-bar.pin.mjs` |
| AC3.2, AC3.3 | unit (hàm thuần, `run` giả) | `test/content/46-quality-bar.pin.mjs` |
| AC4.1 | pin nội dung | `test/content/47-rationalization-tables.pin.mjs` |

## Để builder quyết

- Hằng số TF-IDF, cách xử lý token 1 ký tự, có giữ bigram không: chọn theo số đo trên dữ liệu thật, ghi lựa chọn vào comment
  đầu file scorer.
- Câu chữ cụ thể của bảng tự biện minh và mục Kiểm nguồn.

## Rủi ro và câu hỏi mở

- [giả định] TF-IDF trên tiếng Việt bỏ dấu cho tỉ lệ rank-1 thấp (có thể 50–70%) ở các cặp skill gần nhau; ngưỡng khoá khi đó
  thấp nhưng vẫn bắt được tụt. Số thật biết sau lần đo đầu.
- Prompt viết mù có thể lệch cách người dùng thật gõ; người dùng bổ sung câu thật dần (brief).
- Thêm khoảng 6–8 dòng mỗi `SKILL.md` ở P4 và 1 câu ở P2 làm tăng context mỗi lần nạp skill.
- Case im lặng chỉ chạy khi gọi tay `scripts/eval-run.mjs` (tốn tiền model), `npm test` chỉ kiểm cấu trúc.
