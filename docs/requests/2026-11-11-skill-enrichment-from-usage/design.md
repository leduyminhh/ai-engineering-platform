# Thiết kế: làm giàu bộ skill từ dữ liệu dùng thật
- Ngày: 2026-11-11
- Trạng thái: draft — chờ người duyệt G1
- Requirement: không có (brief: [brief.md](brief.md))

## Vấn đề và lý do

Brief đã duyệt ([brief.md](brief.md)) nêu: người dùng làm tay một số việc chưa skill nào lo, và một số skill có sẵn để lọt
lỗi tới vòng review muộn. Bằng chứng lấy từ dùng thật ở một project đích (ledger `.aip/runs/*/*/progress.md`, `manual-check.md`,
file facts). Design này đối chiếu từng mục goal với nguồn thật của aip trước khi lập plan; mục đã có đủ thì bỏ.

Số đo sơ bộ ngày 2026-11-11 (một đoạn `node -e` chạy tạm ngoài repo trên 23 ledger của project đích; chưa phải số nền chính
thức, số nền chính thức do script ở P0 sinh ra): 136 task có dòng `complete`, 58 task có dòng `review` vòng ≥ 2, 229 dòng
`Ruling:`, 12 dòng `Ruling:` có "ngoài Files" (trong 9 ledger), 221 dòng `minor (deferred)`. Đoạn tạm không giữ lại;
P0 viết script thật và test.

Định dạng ledger đã đọc trong `core/skills/plan-execution/references/task-loop.md:245-262` và `scripts/ledger.mjs:25-33`
(`EVENT_FORMATS`), rồi đối chiếu với ledger thật: dòng review là `Task <n>: review <vòng> <compliant|issues|cannot_verify> <b>/<m>/<n>`
(ví dụ `Task 2: review 2 compliant 0/0/0`), nên "review K issues" trong brief là cách nói gọn của dòng này.

## Quyết định đã chốt

Từ brief (người dùng, giữ nguyên): thành công = ít vòng review và ít ruling hơn, đo bằng cùng một script trước và sau; mỗi plugin
một part; không workflow mới; không sửa project nguồn; plugin `ops` không có part.

Từ brief (agent, giữ nguyên): brief lưu ở repo aip; workflows gộp vào part core; script ở `scripts/`, in JSON ra stdout, số nền
lưu `baseline.json` trong thư mục request; điều phối nhiều phiên không thành skill mới; 3 skill mới; ngưỡng đã có làm tiêu chí
đạt; phạm vi `code-be` theo tiền lệ 2026-11-10 (tooling Node + Markdown).

Chốt thêm ở design. Quyết định của người dùng (builder check): D10 (giữ phiên gốc bump manifest, nhóm A song song) và D14 (viết ADR-0005). Quyết định của agent, chờ duyệt ở G1: D1, D2, D4, D8 (gồm phạm vi áp dụng), AC7.1, luật ưu tiên của AC2.1/AC2.4, chỗ đặt bảng dự trữ số migration ở AC6.1, cùng các D còn lại:

- **D1 — Chỗ đặt script đo:** `scripts/ledger-metrics.mjs` (repo, không ship, cạnh `scripts/routing-score.mjs`), Node thuần.
  Cách dùng: `node scripts/ledger-metrics.mjs --project <dir> [--label <nhãn>]`; đọc `<dir>/.aip/runs/**/progress.md`. Chỉ đọc, không ghi file, không in đường dẫn
  tuyệt đối; khoá `project` của đầu ra là `--label` (mặc định `project`), không phải tên thư mục.
  Export `parseLedger(text)` và `measure(dir, label)` để test. Thiếu `--project` hoặc không thấy `progress.md` nào thì exit 1, stdout rỗng.
- **D2 — Định dạng dòng script nhận** (đúng bảng ledger của `task-loop.md`, không thêm dạng mới):
  task xong = dòng khớp `TASK_COMPLETE_RE` của `ledger.mjs:17` (`^Task \d+: complete\b`, không phân biệt hoa thường) nhưng loại dòng
  `complete?` ghi chú tạm (`\b` vẫn khớp trước dấu `?`, nên script thêm `(?!\?)`); một task có nhiều dòng `complete` trong cùng ledger chỉ
  đếm một lần, theo cặp `<ledger>#<n>`. Các dòng khác: `^Task (\d+): review (\d+) (compliant|issues|cannot_verify) \d+/\d+/\d+`,
  `^Ruling:`, `^minor \(deferred\)`. Ruling "ngoài Files" = dòng `^Ruling:` khớp `/ngoài\s+\**Files/i`; dòng `Ruling: ngoài AC, đổi hành vi …`
  không khớp (AC, không phải Files). Request = tên thư mục cấp một dưới `runs/`. Chỉ task đã xong mới vào mẫu số; dòng review
  của task chưa xong bị bỏ.
- **D3 — Khoá JSON của script:** `project`, `ledgers`, `requests`, `tasks`, `tasksReview2plus`, `pctReview2plus` (1 chữ số thập
  phân), `tasksIssuesAtRound2plus`, `tasksIssuesAtRound3plus` (task có dòng `review <v> issues|cannot_verify` với v ≥ 2, v ≥ 3),
  `rulings`, `rulingsOutsideFiles`, `outsideFilesPerRequest` (= `rulingsOutsideFiles / requests`, 2 chữ số thập phân),
  `minorDeferred`, `byRequest[]` (`request`, `tasks`, `tasksReview2plus`, `rulings`, `rulingsOutsideFiles`, `minorDeferred`).
  Chỉ số thành công của brief: `pctReview2plus` và `outsideFilesPerRequest`.
- **D4 — Số nền:** `docs/requests/2026-11-11-skill-enrichment-from-usage/baseline.json` = stdout nguyên văn của script chạy trên
  project nguồn ở máy người dùng: `node scripts/ledger-metrics.mjs --project <thư mục project nguồn> --label source-project > baseline.json`
  (project nguồn chỉ đọc). Khoá `project` là nhãn trung lập từ `--label`, file không chứa tên thư mục, tên riêng hay đường dẫn tuyệt đối.
  Các request sau chạy cùng lệnh rồi so hai khoá của D3. `.aip/` nằm ngoài git của project nguồn, nên không có gì để commit ở đó.
- **D5 — Danh sách tên riêng cấm và cách grep:** một contract `test/contract/57-skill-neutral.contract.mjs` quét `core/`,
  `plugins/`, `workflows/`, `test/routing/` (file `.md`, `.json`, `.mjs`; không quét `docs/`, không quét chính contract) và fail khi
  một dòng khớp biểu thức không phân biệt hoa thường:
  `cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche`.
  Đã chạy grep tương đương trên cây hiện tại: 0 dòng, nên contract xanh ngay và chỉ bắt thêm về sau. Lệnh tay cho review cuối:
  `git diff <base>..HEAD -- core plugins workflows test/routing | grep '^+' | grep -v '^+++' | grep -n -i -E '<biểu thức trên>'` ra 0 dòng.
- **D6 — Ba skill mới:**

  | Skill id | Plugin | `description` |
  |---|---|---|
  | `engineering-api-research` | engineering | "Nghiên cứu API hoặc dịch vụ ngoài, hoặc làm spike kỹ thuật nhỏ, rồi ghi file facts mỗi khẳng định có nhãn [Verified]/[Inference]/[Unverified] kèm nguồn và ngày đọc. Dùng khi người dùng muốn \"tìm hiểu API của dịch vụ ngoài\", \"đọc docs rồi ghi lại sự thật\", \"spike thử thư viện\", \"lập file facts\". Không dùng khi cần viết spec yêu cầu → engineering-spec-writing; ghi quyết định chọn phương án → engineering-adr." |
  | `backend-llm-integration` | backend | "Thêm hoặc rà tính năng backend gọi LLM: ngân sách theo ngày, backoff, fail-soft có đánh dấu, ghi usage, redact output, hash input, prompt dự phòng. Dùng khi người dùng muốn \"thêm tính năng gọi LLM\", \"gọi model AI từ backend\", \"ngân sách token theo ngày\", \"fail-soft khi LLM lỗi\", \"ghi usage gọi LLM\". Không dùng khi code slice thường không gọi LLM → backend-implement; review diff tổng quát → backend-code-review." |
  | `frontend-manual-check` | frontend | "Viết runbook kiểm tay ánh xạ từng AC (dữ liệu seed, bước, kết quả mong đợi) cho UI chưa có test tự động, kèm walkthrough khám phá bằng Playwright có luật PASS/FAIL/SKIP và luật an toàn. Dùng khi người dùng muốn \"viết checklist kiểm tay UI\", \"runbook kiểm tay theo AC\", \"duyệt thủ công các màn hình\", \"walkthrough UI bằng Playwright\". Không dùng khi cần viết test e2e tự động → frontend-e2e-testing; test component → frontend-testing." |

  Độ dài đã đếm: 409, 413 và 433 ký tự (trần 500). Cụm "Dùng khi" của ba skill không trùng nguyên văn cụm nào của skill cũ
  (đã so với `frontend-e2e-testing`, `frontend-testing`, `backend-implement`, `engineering-spec-writing`); phần "Không dùng khi"
  trỏ về skill dễ nhầm nhất. Builder kiểm lại bằng `npm run build` và `node scripts/routing-score.mjs`.
- **D7 — Routing của skill mới:** mỗi skill có `test/routing/<id>.json` (≥ 3 positive, ≥ 2 negative, viết mù theo cách
  của request 2026-11-10: subagent chỉ thấy `## Quy trình`, không thấy `description`). Contract 56 đòi file này cho mọi id
  trong tập chấm và `engineering` được publish cả plugin, còn `backend`/`frontend` chỉ publish theo từng skill ở
  `plugins/_published.json` (file dùng chung). Vì vậy session gốc làm ở bước file dùng chung sau khi merge part: viết dữ liệu
  routing (subagent mù), thêm `backend/backend-llm-integration` và `frontend/frontend-manual-check` vào `_published.json`
  (skill chưa vào đó thì là draft, không nằm trong tập chấm), chạy `node scripts/routing-score.mjs --lock`.
  Thêm skill có thể làm một prompt cũ rơi khỏi hạng 1: số đo tụt dưới `rank1.lock.json` thì sửa `description` của skill mới,
  không hạ khoá.
- **D8 — Cỡ task, không thêm trường mới vào plan:** cỡ suy từ `**Kind:**`, `**TDD:**` và `**Files:**` đã có
  (`engineering-plan-writing`, `plan-structure.md`), nên `check-request.mjs` và template plan không đổi. Điều kiện cỡ Nhỏ,
  phải đủ cả bốn: (1) `Kind` ∈ {`FE-UI`, `TOOLING`}; (2) `**TDD:** không`; (3) ≤ 5 file production (trần đã có ở
  `self-review.md` mục 6); (4) `**Files:**` không có đường dẫn migration, auth/phân quyền, secret/credential, CI hoặc hook, và
  không đổi contract API hay schema. Cỡ Vừa = task cùng khuôn, gộp theo mục "Gom task nhỏ" đã có. Cỡ Lớn = mọi task còn lại
  (`BE`, `DB`, `CT`, `FE-INT`, `E2E`, `DOCS`, `**TDD:** có`, hoặc chạm đường dẫn nhạy cảm): vòng đầy đủ như hiện nay.
  `DOCS` ở lại cỡ Lớn vì ledger của project nguồn cho thấy task docs là nơi finding đến muộn (xem bảng đối chiếu), và vì
  review `DOCS` chỉ tốn `haiku`. **Phạm vi áp dụng:** mọi chế độ còn review từng task (chạy tuần tự không part, và part với
  `partRunner: session`). Part chạy bằng subagent và inline đã bỏ review từng task (`SKILL.md:95`, `inline.md:68`) nên không đổi.
  Quyết định ghi thành [ADR-0005](../../decisions/0005-small-task-skips-per-task-review.md).
- **D9 — Dòng ledger của task cỡ Nhỏ:** sau commit, diff khớp `**Files:**` và không chạm đường dẫn nhạy cảm của D8 thì ghi
  `Task <n>: complete (commits <a>..<b>, review cuối — cỡ nhỏ)`. Không ghi dòng `Task <n>: review …` (`EVENT_FORMATS` của
  `ledger.mjs` chỉ nhận vòng ≥ 1); script đo (D2) tính task này là không có dòng review (vòng 0).
- **D10 — Bước file dùng chung (người dùng chốt: giữ):** phiên gốc bump `.manifest.json` của plugin vừa merge và
  `plugins/_versions.lock.json` (`node cli/lib/versions.mjs --lock` sau `npm run build`) sau mỗi lần merge part, trước full suite;
  cũng làm `plugins/_published.json`, `test/routing/*.json` của skill mới, `test/routing/rank1.lock.json`, `CHANGELOG.md`,
  `README.md`/`README_VI.md`, `docs/specs/*`. Part không tự bump và không ghi các file này; nhóm A chạy song song. Lý do: `check-partition.mjs:82`
  coi mọi `.manifest.json` là file chung và báo P2 cho part có nhãn Song song.
- **D11 — Chỗ đặt checklist robustness backend:** `plugins/backend/templates/robustness/robustness-checklist.md`, ship vào
  skill qua `sharedAssets` (cơ chế đang dùng cho `templates/architecture`, `cli/lib/plugins.mjs:217`). `backend-implement` và
  `backend-code-review` khai thêm đường dẫn này ở `sharedAssets` và trỏ tới file ở bước đầu `## Quy trình`/Trục 1.
  Một file, hai skill trỏ, không chép nội dung vào cả hai.
- **D12 — Không đổi baseline:** `AGENTS.md` và `core/agents/AGENTS.template.md` giữ nguyên (đang 200/200 dòng, contract
  `test/contract/30-templates.contract.mjs` đặt `MAX = 200`, hai file giữ byte-identical). Nội dung điều phối nhiều phiên thêm vào
  `core/skills/plan-execution/references/model-routing.md`, nơi baseline đã trỏ tới.
- **D13 — Không thêm hàng vào bảng "Yêu cầu chạy trực tiếp bằng skill" của orchestrator** cho ba skill mới: chưa có bằng
  chứng người dùng nhờ orchestrator chọn chúng; `description` đủ để gọi trực tiếp. `[giả định]`
- **D14 — ADR cho D8 (người dùng chốt, 2026-11-11):** viết ngay [ADR-0005](../../decisions/0005-small-task-skips-per-task-review.md)
  (MADR 4.0, `Status: Proposed` tới khi người chốt) cho D8: điều kiện cỡ Nhỏ, ngoại lệ `DOCS`/backend/bảo mật/migration, phạm vi chế độ. Design trỏ ADR, ADR trỏ lại design.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given thư mục project có `.aip/runs/<request>/<part>/progress.md` When chạy
  `node scripts/ledger-metrics.mjs --project <dir> [--label <nhãn>]` Then exit 0, stdout là một JSON hợp lệ có đủ các khoá của D3 (`project` = `--label`,
  mặc định `project`), script không tạo hay sửa file nào trong `<dir>` và không in gì ra stderr.
- [ ] **AC1.2** — Given một ledger thử có 4 task đều `complete`: Task 1 chỉ có `review 1 compliant`; Task 2 có `review 1 issues` rồi
  `review 2 compliant`; Task 3 có `review 1 issues`, `review 2 issues`, `review 3 compliant`; Task 4 không có dòng review
  When đo Then `tasks` = 4, `tasksReview2plus` = 2, `pctReview2plus` = 50 (`calc: 2 / 4 * 100 = 50`),
  `tasksIssuesAtRound2plus` = 1, `tasksIssuesAtRound3plus` = 0.
- [ ] **AC1.3** — Given hai request trong `runs/`, với ba dòng `Ruling:` trong đó một dòng chứa "ngoài Files", một dòng chứa
  "ngoài AC, đổi hành vi", và hai dòng `minor (deferred)` When đo Then `rulings` = 3, `rulingsOutsideFiles` = 1,
  `minorDeferred` = 2, `requests` = 2 và `outsideFilesPerRequest` = 0.5 (`calc: 1 / 2 = 0.5`).
- [ ] **AC1.4** — Given ledger có dòng `Task 5: complete? chờ re-review`, `Task 6: start (base <hash>)` kèm
  `Task 6: review 2 issues 0/1/0`, và Task 7 có hai dòng `Task 7: complete (…)` When đo Then Task 5 (`complete?`) và Task 6 (chưa
  có `complete`) không vào `tasks` và không vào `tasksReview2plus`, còn Task 7 được đếm một lần.
- [ ] **AC1.5** — Given `--project` trỏ tới thư mục không chứa `progress.md` nào, hoặc thiếu `--project` When chạy script Then exit 1,
  stderr nêu lý do (không thấy ledger / thiếu đối số), stdout rỗng.
- [ ] **AC1.6** — Given `baseline.json` ở thư mục request When đọc Then có đủ khoá của D3, `ledgers` ≥ 1, `tasks` ≥ 1, `project` bằng
  nhãn trung lập `source-project` (từ `--label`, không phải tên thư mục hay tên riêng), `pctReview2plus` bằng
  `tasksReview2plus / tasks * 100` làm tròn 1 chữ số; lệnh chạy lại được ghi ở mục "Số nền" của file này; không có đường dẫn
  tuyệt đối trong file.
- [ ] **AC2.1** — Given `core/skills/plan-execution/references/task-loop.md` When đọc Then có mục "Cỡ task và review từng task" nêu
  đủ bốn điều kiện cỡ Nhỏ của D8, nêu `BE`, `DB`, `CT`, `FE-INT`, `E2E`, `DOCS` và task `**TDD:** có` luôn review từng task, và
  trỏ tới mục "Gom task nhỏ" cho cỡ Vừa. Luật ưu tiên: mục dài hơn 25 dòng thì chi tiết chuyển sang một file `references/` của
  `plan-execution`, `SKILL.md` và `task-loop.md` chỉ giữ tóm tắt và liên kết.
- [ ] **AC2.2** — Given một task cỡ Nhỏ vừa commit, ở chế độ còn review từng task (chạy tuần tự không part, hoặc part với `partRunner: session`)
  When session chính đối chiếu `git diff --name-only <BASE>..HEAD` với `**Files:**` Then file ngoài danh sách hoặc đường dẫn nhạy cảm
  của D8 nâng task lên cỡ Lớn (giao review thường); không lệch thì ghi đúng dòng D9, và `node core/skills/plan-execution/scripts/ledger.mjs`
  nhận dòng đó (exit 0). Chế độ inline và part `partRunner: subagent` đã bỏ review từng task nên không đổi.
- [ ] **AC2.3** — Given `plan-execution/SKILL.md`, `references/prompts/final-review.md` và `workflows/feature/WORKFLOW.md` When đọc
  Then hàng "Task nhỏ, bỏ review cho nhanh" của bảng tự biện minh trỏ về D8 thay vì phủ định chung; `final-review.md` bảo reviewer đọc
  kỹ diff của task ghi `cỡ nhỏ` trong ledger; Bước 5 của `WORKFLOW.md` không còn buộc review từng task cho task cỡ Nhỏ và trỏ tới
  mục mới; `graph.json` vẫn qua `checkGraphAgainstBody`.
- [ ] **AC2.4** — Given `core/skills/plan-execution/references/model-routing.md` When đọc Then có mục "Vai phiên gốc và phiên con"
  nêu: (a) phiên gốc giao việc kế, không chồng file, cho phiên con vừa xong hoặc rảnh; (b) xoay phiên mềm ở ranh giới task, cứng
  ngay, mở phiên mới trước rồi mới dừng phiên cũ, không dừng phiên con giữa plan vì hạn mức; (c) không mở được phiên (Remote
  Control, lượt do tin cross-session khởi động) thì để phiên cũ chạy tiếp; (d) phiên con đã xong và merge thì đóng, không xoay.
  Mục giữ ngưỡng ~40%/~60% kèm nhãn `[Inference]` như ADR-0003 và không đổi bảng tầng hay 18 quy tắc có sẵn. Luật ưu tiên: mục
  dài hơn 20 dòng thì chi tiết chuyển sang một file `references/` của skill `plan-execution`, `model-routing.md` chỉ giữ tóm tắt và liên kết.
- [ ] **AC2.5** — Given `core/skills/git-workflow/SKILL.md` When đọc Then có luật: xoá file đã tracked → một commit chỉ gồm các file bị xoá
  (body liệt kê file và lý do), phần sửa tham chiếu để build chạy lại là commit riêng sau đó; build có thể đỏ giữa hai commit và
  chấp nhận được; không gộp hai phần, không viết lại lịch sử commit cũ; thân `SKILL.md` ≤ 300 dòng.
- [ ] **AC2.6** — Given `core/skills/git-worktree/SKILL.md` When đọc Then phần "worktree do `isolation: worktree` tự tạo" (nay chỉ nằm
  ngoài phạm vi) có đoạn: worktree đó có thể dựng từ `origin/<nhánh gốc>` chứ không từ `feature/<slug>`; đầu việc agent kiểm
  `git merge-base --is-ancestor <hash đỉnh feature> HEAD`, không đạt thì trả `blocked`; session chính cherry-pick commit của nhánh
  `worktree-agent-*` về `feature/<slug>`; không dùng `reset --hard` để "đồng bộ". Việc giữ ledger khi xoá worktree không thêm gì
  (đã có ở bước dọn 2).
- [ ] **AC3.1** — Given `plugins/engineering/skills/engineering-plan-writing/references/self-review.md` When đọc mục 6 "Files đủ"
  Then thêm vế: file test, fixture, cấu hình hoặc catalog khẳng định số đếm hay hằng mà task đổi (test đếm số mục, snapshot, file
  kiểu dùng chung) cũng phải nằm trong `**Files:**`, tìm bằng grep trên giá trị cũ; số mục tự soát vẫn là 6.
- [ ] **AC3.2** — Given `plugins/engineering/skills/engineering-spec-writing/SKILL.md` (bước 10) và `references/checklist.md` When đọc
  Then có mục kiểm AC: lập từng cặp AC cùng đối tượng (cùng trạng thái, ngưỡng, mã lỗi, thứ tự) và đối chiếu mỗi AC với mục
  "Quyết định đã chốt" và `brief.md` của request (nếu có); lệch thì sửa hoặc đưa vào câu hỏi mở trước checkpoint; thân `SKILL.md` ≤ 300 dòng.
- [ ] **AC3.3** — Given `plugins/engineering/skills/engineering-plan-writing/references/plan-structure.md` (kind `DOCS`) và mục 2 của
  `self-review.md` When đọc Then task `DOCS` có step bắt buộc: liệt kê từng khẳng định kiểm được (tên hàm, số, đường dẫn, lệnh, giá
  trị mặc định), đối chiếu với code bằng grep hoặc đọc, ghi bảng `khẳng định → file:line → khớp|lệch` vào báo cáo, lệch thì sửa docs
  hoặc gắn `[Unverified]`; `self-review.md` vẫn có đúng 6 mục đánh số.
- [ ] **AC3.4** — Given `plugins/engineering/skills/engineering-api-research/SKILL.md` When đọc Then có `## Quy trình` và
  `## Ranh giới an toàn`, frontmatter và `description` đúng D6, bước: chốt câu hỏi cần trả lời; đọc docs chính thức đúng phiên bản theo
  mục "Kiểm nguồn" của skill `principles` (bản cài plugin: `core:principles`); spike nhỏ chạy được, kết quả ghi kèm lệnh chạy lại;
  ghi file facts với nhãn `[Verified]` (nguồn, URL sau chuyển hướng, ngày đọc), `[Inference]`, `[Unverified]` cho từng khẳng định;
  không gọi API tính tiền hay ghi dữ liệu thật khi chưa được duyệt; không đưa khoá thật vào file facts. Có `references/facts.template.md`.
- [ ] **AC4.1** — Given `plugins/backend/templates/robustness/robustness-checklist.md` When đọc Then có đúng 5 nhóm: chặn kích thước input
  (body, mảng, chuỗi, số trang); che secret trong log và thông báo lỗi; idempotency (khoá, lặp lại, retry); race và CAS (đọc rồi
  ghi, cập nhật có điều kiện); việc mồ côi sau lỗi (bản ghi dở, tài nguyên chưa dọn), mỗi nhóm 2–4 dòng checkbox kèm cách kiểm.
- [ ] **AC4.2** — Given `backend-implement` và `backend-code-review` When đọc Then cả hai khai `sharedAssets` có
  `templates/robustness`, trỏ tới checklist ở bước đầu `## Quy trình` hoặc Trục 1, và sau `npm run build` file checklist nằm cạnh cả
  hai skill trong `build/claude/`; thân cả hai `SKILL.md` ≤ 300 dòng.
- [ ] **AC4.3** — Given `plugins/backend/skills/backend-llm-integration/SKILL.md` When đọc Then có `## Quy trình` và
  `## Ranh giới an toàn`, `description` đúng D6, và quy trình phủ 7 mục: ngân sách theo ngày (đặt chỗ trước khi gọi, cạn thì hạ cấp,
  không gọi), backoff (luỹ thừa có jitter, chặn trên bằng ngân sách thời gian của job, lỗi 4xx không retry), fail-soft có đánh dấu
  (kết quả thay thế mang cờ `degraded` và dòng log có lý do; có cờ biến lỗi nhà cung cấp thành thất bại cứng; hoàn tất job không chứng
  minh lời gọi thật đã chạy), ghi usage (chỉ token, mỗi lời gọi), redact output trước khi log hay lưu, hash input thay vì lưu nguyên
  prompt, prompt dự phòng khi lời gọi lỗi. Khoá nhà cung cấp không vào log, lỗi hay prompt.
- [ ] **AC5.1** — Given `plugins/frontend/skills/frontend-manual-check/SKILL.md` và `references/runbook.template.md` When đọc Then mẫu runbook có
  `## Điều kiện` (dữ liệu seed, môi trường), bảng `| # | Thao tác | Kết quả mong đợi | AC |`, `## Kết quả đã chạy`; quy trình đòi mỗi
  `AC<n>.<m>` của design xuất hiện ở ít nhất một bước, và đòi ghi "chưa kiểm" cho phần không chạy được thay vì để trống.
- [ ] **AC5.2** — Given `frontend-manual-check` When đọc phần walkthrough Playwright Then có bốn kết quả: PASS (UI đúng, không request API 4xx/5xx
  ngoài ý muốn, không lỗi console mới), FAIL (kèm bước tái hiện, kết quả thực, kết quả mong đợi, request lỗi), SKIP-SAFETY, SKIP-PRECOND;
  luật an toàn: không xoá vĩnh viễn (dừng ở hộp xác nhận rồi huỷ), không nhập khoá hay mật khẩu thật, không đi theo OAuth ra ngoài
  localhost, không tải file, dữ liệu tạo mới có tiền tố riêng, không sửa code hay cấu hình, không đọc file bí mật; báo cáo nêu
  tổng PASS/FAIL/SKIP và danh sách ID FAIL.
- [ ] **AC5.3** — Given `frontend-manual-check` When đo Then thân `SKILL.md` ≤ 300 dòng, chi tiết dài nằm ở `references/`, và
  `description` giữ ranh giới với `frontend-e2e-testing` (viết test tự động) và `frontend-testing`.
- [ ] **AC6.1** — Given `plugins/data/skills/data-db-migration/SKILL.md` (C1–C3) When đọc Then trước khi chọn số migration kế tiếp có
  bước: đọc số lớn nhất trên nhánh tích hợp và trên mọi nhánh/worktree đang mở (`git worktree list`, `git branch --list`,
  `git ls-tree -r --name-only <nhánh> -- <thư mục migration>`); số đã bị nhánh khác giữ thì chọn số cao hơn; request chia part dùng
  mục `## Dự trữ số migration` trong `design.md` của request (bảng `| Part | Dải số | Trạng thái |`), do phiên gốc ghi trước khi chạy
  nhóm song song, part chỉ chọn số trong dải của mình; skill trỏ tới mục này. Template design của `artifact-templates` không đổi (mục
  này tuỳ chọn, chỉ request có migration song song thêm); muốn thêm vào template thì thuộc part 01-core, không thuộc part 05.
- [ ] **AC6.2** — Given cùng skill When đọc Then có quy tắc thứ tự merge: nhánh số thấp merge trước; trùng số khi merge sau thì
  đổi số của nhánh chưa phát hành (chưa áp lên DB nào ngoài container test) và ghi `Ruling:`; không đổi số hay nội dung migration
  đã áp lên DB dùng chung (checksum); bảng "Dấu hiệu đang tự biện minh" thêm đúng một dòng (4–6 dòng) và thân `SKILL.md` ≤ 300 dòng.
- [ ] **AC7.1** — Given nhánh `feature/skill-enrichment-from-usage` sau khi merge đủ part và làm xong bước file dùng chung When chạy
  `npm test` Then exit 0; số pass của `validate` chỉ đổi khi một pin bị sửa hoặc bỏ có dòng `Ruling:` nêu phép kiểm thay thế, và không pin nào bị xoá mà chưa có phép kiểm mới phủ hành vi mới (6518 của baseline chỉ để tham chiếu, không là ngưỡng cứng).
- [ ] **AC7.2** — Given mọi `SKILL.md` bị sửa hoặc thêm trong request When `npm run build` và `node test/validate.mjs --build` chạy Then
  không có cảnh báo "quá mốc 300" mới (`SKILL_BODY_WARN_LINES` ở `cli/lib/conventions.mjs`).
- [ ] **AC7.3** — Given ba skill mới đã vào tập chấm (D7) When chạy `node scripts/routing-score.mjs` Then positive ≥ 69 và negative ≥ 94
  (giá trị khoá hiện tại ở `test/routing/rank1.lock.json`); ba file `test/routing/<id>.json` có ≥ 3 positive và ≥ 2 negative;
  khoá chỉ nâng.
- [ ] **AC7.4** — Given D5 When chạy `npm test` Then contract 57 xanh: 0 dòng khớp trong `core/`, `plugins/`, `workflows/`,
  `test/routing/`.
- [ ] **AC7.5** — Given Bảng part When chạy `node core/skills/artifact-templates/scripts/check-partition.mjs docs/requests/2026-11-11-skill-enrichment-from-usage/`
  sau khi có plan Then không có P1, P2, P4 cho nhóm A; diff của mỗi nhánh part so với đỉnh `feature/<slug>` lúc cắt không chứa
  file ở D10.
- [ ] **AC7.6** — Given thay đổi nội dung chiếu When kết thúc Then đã bump `core`, `workflows`, `engineering`, `backend`, `frontend`, `data`
  (không bump `ops`), `node cli/lib/versions.mjs --lock` chạy sau `npm run build`, `AGENTS.md` và `core/agents/AGENTS.template.md`
  không đổi so với đầu nhánh.

## Thiết kế

### Đối chiếu goal với nguồn thật

Cột "Đã có" trích `file:line` đã đọc ngày 2026-11-11; "Thiếu" là phần part làm.

| Mục goal | Nguồn liên quan | Đã có | Thiếu | Quyết định |
|---|---|---|---|---|
| P0 script đo | `scripts/` (chỉ `eval-run.mjs`, `routing-score.mjs`), `ledger.mjs:25-33` | Định dạng dòng ledger cố định, `ledger.mjs` kiểm | Không có script đếm vòng review, ruling, minor | Giữ → root (D1–D4) |
| 01a chia cỡ Nhỏ/Vừa/Lớn | `task-loop.md:55-56`, `:202-206`, `:242`, `SKILL.md:95`, `workflow-feature` Bước 5 (`WORKFLOW.md:146`), `inline.md` | Minor không vào vòng sửa (`:55-56`); full suite một lần (`:242`); gom task nhỏ (`:202-206`); inline bỏ review từng task (`inline.md:68`) | Chia cỡ task; bỏ review từng task cho task nhỏ ngoài inline và part (`SKILL.md:95` và Bước 5 đang buộc review mọi cỡ) | Giữ phần thiếu → 01 (D8, D9). Bỏ "Minor không vào vòng sửa" và "full suite một lần": đã có |
| 01b điều phối nhiều phiên | `AGENTS.md:171-180`, `model-routing.md:38,57,81,84`, ADR-0002/0003, `handoff.template.md`, `session-start.mjs` | Bảng tầng gồm phiên gốc/phiên thực thi; xoay ~40%/~60% bằng `handoff.md` (rule 4); hàng đợi 2–3 việc cho phiên con (rule 10); ghi % context mỗi cổng (rule 18); hook nạp handoff | Vai phiên gốc giao việc cho phiên con rảnh; xoay "mở mới trước, dừng cũ sau"; không dừng giữa plan vì hạn mức; ca không mở được phiên; phiên con xong thì đóng | Giữ phần thiếu → 01 (AC2.4), chỉ ở `model-routing.md`, không đổi baseline (D12) |
| 01b giữ ledger khi xoá worktree | `git-worktree/SKILL.md:51-57`, `task-loop.md:231` | Bước dọn 2 chép `.aip/runs` về gốc repo chính trước khi xoá; đường lui đọc ledger part trong worktree | — | Bỏ: đã có đủ |
| 01c `git-workflow` xoá file tracked | `git-workflow/SKILL.md`, `references/*` (grep "xoá", "git rm": chỉ gặp trong config-env-rules, không phải luật commit) | Không có luật commit chỉ-xoá | Luật commit chỉ-xoá riêng | Giữ → 01 (AC2.5) |
| 01c `git-worktree` dựng từ nhánh feature | `git-worktree/SKILL.md:3,14` (tạo từ `feature/<slug>`), `parallel-agents.md` | Worktree do session chính tạo đã cắt từ `feature/<slug>`; nhưng worktree của `isolation: worktree` bị đặt ngoài phạm vi skill | Cách xử lý worktree của `isolation: worktree` dựng từ nhánh gốc xa | Giữ phần hẹp → 01 (AC2.6) |
| 02a plan-writing kiểm `**Files:**` | `self-review.md` mục 6, `plan-structure.md` "Độ mịn task" | Mục 6 "Files đủ": grep caller, lớp hiện thực, chỗ inject bean, test gọi tới symbol bị gỡ/đổi; trần 30 phút/5 file | Test/fixture/cấu hình khẳng định số đếm hay hằng mà task đổi (ledger nguồn: ruling thêm file đếm rule, file kiểu dùng chung) | Giữ phần hẹp → 02 (AC3.1); không thêm mục 7 (nhiều file và pin đếm "6 mục") |
| 02b spec-writing AC mâu thuẫn | `engineering-spec-writing/SKILL.md` (bước 10), `references/checklist.md:25` | "Không mâu thuẫn" giữa các mục và với ADR/contract/project-knowledge | Rà từng cặp AC và đối chiếu AC với brief/quyết định đã chốt | Giữ phần hẹp → 02 (AC3.2) |
| 02c task docs kiểm khẳng định với code | `plan-structure.md` (bảng Kind: `DOCS`), `prompts/task-review.md:3`, `finish.md` | `DOCS` chạy `general-purpose` haiku rồi reviewer; không có bước đối chiếu khẳng định với code | Step bắt buộc và bảng khẳng định → file:line | Giữ → 02 (AC3.3). Đặt ở plan-writing (một chủ), không sửa prompt của core |
| 02d skill nghiên cứu API/spike | `engineering-spec-writing` (spike giả định, bước 9), `core/principles/source-check.md` | Spike giả định trong spec; kiểm phiên bản khi viết code | Không có skill ghi file facts có nhãn nguồn cho API ngoài | Giữ → 02 (D6, AC3.4) |
| 03a checklist robustness | `review-dimensions.md:19` (race, idempotency ở consumer), `use-case-intake.md:71` (B8 transaction/idempotency), `backend-testing/references/test-strategy.md:50`, `core/principles/trust-boundary.md` | Race/check-then-act và idempotency được nhắc rải rác ở review; ranh giới tin cậy | Chặn kích thước input, che secret trong log và lỗi, việc mồ côi sau lỗi, một nơi gom cho cả implement và review | Giữ → 03 (D11, AC4.1–4.2); checklist trỏ phần đã có thay vì chép |
| 03b skill tính năng gọi LLM | `plugins/backend/skills/*` (grep fail-soft, backoff, ngân sách: không có skill backend nào), `ops-observability` (chỉ alert) | Không có | Cả skill | Giữ → 03 (D6, AC4.3) |
| 04 runbook kiểm tay UI + walkthrough | `frontend-e2e-testing` (viết test Playwright tự động), `frontend-testing` | Test tự động, e2e có Playwright | Runbook ánh xạ AC cho UI không có test; walkthrough khám phá PASS/FAIL/SKIP | Giữ → 04 (D6, AC5.1–5.3) |
| 05 số migration song song | `data-db-migration/SKILL.md` C1 (đọc "version mới nhất"), C3 (file cũ bất biến), bảng tự biện minh | Đọc số mới nhất ở nhánh hiện tại; file đã có ở base là bất biến | Số bị nhánh khác giữ, bảng dự trữ cho part song song, thứ tự merge | Giữ → 05 (AC6.1–6.2) |

Kết quả đối chiếu: không mục nào bỏ cả part. Hai ý con bị bỏ vì đã có: "Minor không vào vòng sửa, full suite một lần" (01a) và "giữ
ledger khi worktree bị xoá" (01b). Ba mục thu hẹp: 01b (chỉ phần vai phiên và xoay), 01c worktree (chỉ ca `isolation: worktree`),
02a (một vế vào mục 6 có sẵn). Part 05 nhỏ nhưng giữ riêng để đúng "mỗi plugin một part" của người dùng.

### P0 — Script đo và số nền (plan gốc)

- `scripts/ledger-metrics.mjs` theo D1–D3, comment đầu file nêu định dạng dòng nhận và chỉ số thành công. `measure(dir, label)` là hàm
  thuần trên cây thư mục; `parseLedger(text)` trả `{ complete: Set, maxRound: Map, issueRounds: Map, rulings, outsideFiles, minor }`.
- `test/contract/58-ledger-metrics.contract.mjs` (trong `validate --build`): dựng thư mục tạm bằng `fs.mkdtempSync(os.tmpdir())`,
  ghi ledger giả theo AC1.2–AC1.4, gọi `measure`, assert từng số và assert thư mục không có file mới (AC1.1); AC1.5 chạy CLI bằng
  `child_process` trên thư mục rỗng; AC1.6 đọc `baseline.json` thật. Xoá thư mục tạm bằng `fs.rmSync`.
- `test/contract/57-skill-neutral.contract.mjs` theo D5.
- Task cuối của plan gốc: chạy `node scripts/ledger-metrics.mjs --project <project nguồn> --label source-project > baseline.json` (project nguồn ở máy người dùng, chỉ đọc), đọc lại kiểm AC1.6, commit.
- Dòng lệnh `node scripts/ledger-metrics.mjs <dir>` thêm vào mục Commands của `CLAUDE.md` (file dùng chung, plan gốc làm).

### Số nền

Chạy lại (máy có project nguồn): `node scripts/ledger-metrics.mjs --project <thư mục project nguồn> --label source-project > docs/requests/2026-11-11-skill-enrichment-from-usage/baseline.json`.
Sau đợt này, mỗi request mới của project nguồn đo lại bằng cùng lệnh (cùng `--label`) rồi so `pctReview2plus` và `outsideFilesPerRequest` với file này.
Số liệu mới chỉ mang ý nghĩa khi có vài request chạy bằng skill đã sửa; không đo ngay lúc merge (xem rủi ro).

### 01-core (gồm `workflows/`)

Sửa: `core/skills/plan-execution/references/task-loop.md` (mục "Cỡ task và review từng task", đặt trước "Gom task nhỏ", ≤ 25 dòng),
`core/skills/plan-execution/SKILL.md` (hàng bảng tự biện minh; thêm một dòng vào "Quy trình" bước 2 trỏ mục mới, giữ ≤ 300 dòng, hiện
112), `core/skills/plan-execution/references/prompts/final-review.md`, `core/skills/plan-execution/references/model-routing.md`
(mục mới, ≤ 20 dòng), `core/skills/git-workflow/SKILL.md` (luật commit chỉ-xoá, hiện 160 dòng), `core/skills/git-worktree/SKILL.md`
(đoạn `isolation: worktree`, hiện 81 dòng), `workflows/feature/WORKFLOW.md` (Bước 5, và Bước 1 nếu còn câu "mọi cỡ việc" buộc
review). Pin có thể đỏ theo hành vi mới: `test/content/31-workflow-self-sufficient.pin.mjs` (nhắc "review từng task"),
`20-model-session-routing.pin.mjs`, `21-long-session-context.pin.mjs`; sửa pin theo hành vi mới và ghi `Ruling:`, không xoá phép
kiểm hành vi còn đúng. Pin mới của part: `test/content/48-enrich-core.pin.mjs` (AC2.1–AC2.6, kiểm đủ mục và đủ điều kiện, không
pin câu văn).

Không đổi: Minor ngoài vòng sửa (`task-loop.md:55-56`), full suite một lần (`:242`), `ledger.mjs` và các dạng dòng của nó,
`inline.md`, `check-request.mjs`, baseline `AGENTS.md`.

### 02-engineering

Sửa: `references/self-review.md` và `references/plan-structure.md` của `engineering-plan-writing`;
`engineering-spec-writing/SKILL.md` (bước 10) và `references/checklist.md`. Thêm: `plugins/engineering/skills/engineering-api-research/`
(`SKILL.md`, `references/facts.template.md`). `engineering` được publish cả plugin nên skill mới tự vào tập chấm. Pin:
`test/content/49-enrich-engineering.pin.mjs` (AC3.1–AC3.4).

### 03-backend

Thêm: `plugins/backend/templates/robustness/robustness-checklist.md`, `plugins/backend/skills/backend-llm-integration/`
(`SKILL.md`, `references/` khi cần giữ thân < 300 dòng). Sửa: `backend-implement/SKILL.md` và `backend-code-review/SKILL.md`
(`sharedAssets` và dòng trỏ; một dòng ở `backend-implement/references/checklist.md` hoặc `review-dimensions.md` Trục 1 nếu hợp hơn).
Skill mới là draft cho tới khi session gốc thêm vào `_published.json` (D7). Pin: `test/content/50-enrich-backend.pin.mjs`
(AC4.1–AC4.3).

### 04-frontend

Thêm: `plugins/frontend/skills/frontend-manual-check/` (`SKILL.md`, `references/runbook.template.md`,
`references/walkthrough.md`). Không sửa skill khác. Pin: `test/content/51-enrich-frontend.pin.mjs` (AC5.1–AC5.3).

### 05-data

Sửa: `plugins/data/skills/data-db-migration/SKILL.md` (C1–C3, bảng tự biện minh) và, nếu thân gần 300 dòng, đưa chi tiết sang
`references/change/` (file mới `migration-numbering.md`). Pin: `test/content/52-enrich-data.pin.mjs` (AC6.1–AC6.2).

### Nguyên tắc nội dung chung cho skill

- Trung lập project (D5): ví dụ lấy từ dùng thật được khái quát ("test đếm số rule", "migration số tuần tự"), không mang tên
  thành phần, bảng hay số phiên bản của project nguồn.
- Bảng "Dấu hiệu đang tự biện minh" chỉ thêm khi skill sửa đã có bảng (`data-db-migration`, `plan-execution`) và vẫn 4–6 dòng
  (pin 47 giữ).
- Viết theo `engineering-writing-style`, tiếng Việt có dấu, nhãn `[Verified]`/`[Inference]`/`[Unverified]` ở chỗ nêu sự thật chưa kiểm.

### Bước file dùng chung và thứ tự chạy

1. Plan gốc (P0): script đo, hai contract, `baseline.json`, dòng Commands của `CLAUDE.md`. Chạy trước mọi part.
2. Năm part chạy song song (nhóm A) trong worktree riêng, mỗi part làm `plan.md` của nó, test hẹp bằng
   `node test/validate.mjs --build --only <pin>` (cần `npm run build` trong worktree), tự commit trên nhánh part.
   Contract 56 đỏ trên nhánh part 02 là bình thường cho tới bước 3 (chưa có `test/routing/engineering-api-research.json`).
3. Sau mỗi `merge --no-ff`, session gốc làm D10 theo từng part: bump manifest, dữ liệu routing và `_published.json` (part
   02, 03, 04), `npm run build`, `versions.mjs --lock`, `routing-score.mjs --lock`, rồi full suite (`npm test`); đỏ thì dừng nhóm.
4. Kết thúc nhánh: `CHANGELOG.md`, `README*.md`, `docs/specs/*` (xem "Ảnh hưởng spec"), grep D5 trên diff, `npm test` một lần.

## Bảng part

| Part | Phụ thuộc | Song song | Trạng thái |
|---|---|---|---|
| 01-core | — | A | đang làm |
| 02-engineering | — | A | đang làm |
| 03-backend | — | A | đang làm |
| 04-frontend | — | A | đang làm |
| 05-data | — | A | đang làm |

Plan gốc (`plan.md`) là P0 và chạy trước mọi part (`task-loop.md`, "Chế độ part" bước 1), nên cột Phụ thuộc để `—`.
Tập file năm part rời nhau theo thư mục: 01 = `core/`, `workflows/`, pin 48; 02 = `plugins/engineering/`, pin 49; 03 =
`plugins/backend/`, pin 50; 04 = `plugins/frontend/`, pin 51; 05 = `plugins/data/`, pin 52. Contract 57 và 58, script,
`baseline.json` thuộc plan gốc. File dùng chung (D10) chỉ session gốc sửa sau khi merge; kiểm bằng `check-partition.mjs` (AC7.5).

## Ảnh hưởng spec

- skill-quality: thêm R3, thêm R4, thêm R5
- workflows: thêm R21, đổi R7, thêm R22

(skill-quality/R3: script `ledger-metrics.mjs` và `baseline.json`; R4: contract trung lập tên riêng; R5: ba skill mới đạt
`description`, độ dài và routing theo D6, D7 — [giả định] đặt ở `skill-quality` vì chưa có năng lực riêng cho catalog skill.
workflows/R21: cỡ task và review từng task (D8, D9); R7: Bước 5 của `workflow-feature` trỏ mục cỡ task; R22: vai phiên gốc/phiên
con ở `model-routing.md`, luật commit chỉ-xoá của `git-workflow`, worktree của `isolation: worktree`. Các năng lực này đã có
`spec.md` trong `docs/specs/` nên W23 không áp.)

## Ngoài phạm vi và anti-goal

- Ngoài phạm vi: ngân sách RAM/compose cho ops, đổi contract Avro/Kafka, bẫy Windows/ffmpeg (brief: bằng chứng mỏng, để đợt
  sau); workflow mới; sửa project nguồn; sửa `check-request.mjs`, template plan, `ledger.mjs`; sửa baseline `AGENTS.md`; sửa
  `description` của skill cũ để nâng điểm routing; eval model thật cho skill mới; đo "ít vòng review hơn" ngay lúc merge.
- Anti-goal (từ brief): skill dính tên riêng của project nguồn; `SKILL.md` quá ngưỡng 300 dòng; bỏ review ở việc có backend,
  migration hoặc bảo mật (D8 loại cả bốn nhóm đó khỏi cỡ Nhỏ).

## Ràng buộc

- Node thuần, không dependency; file UTF-8 không BOM, LF; nội dung skill tiếng Việt có dấu; comment theo mục Comments của `AGENTS.md`.
- Script đo tất định, chỉ đọc, không gọi mạng.
- `SKILL.md` bị sửa hoặc thêm ≤ 300 dòng; chi tiết dài ở `references/`.
- Thân `AGENTS.md` không đổi (200/200 dòng).
- Test theo `AGENTS.md` mục Testing: mỗi pin kiểm cấu trúc và điều kiện, không ghim câu văn; contract 57 và 58 là bất biến vận hành.

## Kiểm thử

| AC | Tầng | File |
|---|---|---|
| AC1.1–AC1.6 | contract (hàm thuần, CLI, dữ liệu thật) | `test/contract/58-ledger-metrics.contract.mjs` |
| AC2.1–AC2.6 | pin nội dung + `ledger.mjs` thật cho AC2.2 | `test/content/48-enrich-core.pin.mjs` |
| AC3.1–AC3.4 | pin nội dung | `test/content/49-enrich-engineering.pin.mjs` |
| AC4.1–AC4.3 | pin nội dung + build output | `test/content/50-enrich-backend.pin.mjs` |
| AC5.1–AC5.3 | pin nội dung | `test/content/51-enrich-frontend.pin.mjs` |
| AC6.1–AC6.2 | pin nội dung | `test/content/52-enrich-data.pin.mjs` |
| AC7.1, AC7.6 | `npm test` đầy đủ và `versions.mjs --lock` | `test/contract/60-versions.contract.mjs` (có sẵn) |
| AC7.2 | contract conventions (có sẵn) | `cli/lib/conventions.mjs` qua `validate --build` |
| AC7.3 | contract routing (có sẵn) | `test/contract/56-routing-score.contract.mjs` |
| AC7.4 | contract mới | `test/contract/57-skill-neutral.contract.mjs` |
| AC7.5 | `check-partition.mjs` (advisory) | chạy tay ở bước plan và sau merge |

## Để builder quyết

- Câu chữ cụ thể của các mục và skill mới; số dòng thật của từng đoạn thêm (miễn trong trần).
- Tên file `references/` của skill mới ngoài các file đã nêu; `migration-numbering.md` có tách hay không.
- Có thêm dòng vào bảng "Dấu hiệu đang tự biện minh" của `plan-execution` hay chỉ sửa hàng có sẵn.
- Cách ghi `facts.template.md` (cột nào), miễn có nhãn, nguồn, ngày đọc và lệnh chạy lại.

## Rủi ro và câu hỏi mở

- [giả định] Số đo sơ bộ ở trên dùng regex khớp định dạng ledger hiện tại; ledger cũ hơn của project khác có thể ghi dạng khác,
  khi đó script đo ít hơn thực tế. Đổi định dạng ledger thì sửa script (brief nêu cùng điều này).
- [giả định] Chỉ một project nguồn nên checklist backend và skill LLM có thể lệch về stack Java/Python; mục trong skill giữ
  ở mức khái quát (tên nhóm kiểm, không tên thư viện).
- [giả định] Ngưỡng cỡ Nhỏ (≤ 5 file production, kind `FE-UI`/`TOOLING`) lấy từ trần có sẵn của plan-writing và từ ghi chú
  phản hồi của người dùng nguồn (FE-only, ≤ ~5 file, không API mới); chưa kiểm trên dữ liệu: ledger nguồn không ghi kind. D8 chặt hơn ghi chú
  đó ở chỗ loại `DOCS`.
- Rủi ro D8: bỏ review từng task cho cỡ Nhỏ có thể để lọt lỗi tới review cuối; giảm bằng điều kiện đủ cả bốn, đối chiếu diff
  sau commit (AC2.2) và dòng nhắc ở `final-review.md` (AC2.3). Chỉ đo được hiệu quả sau vài request thật. ADR đề xuất:
  [ADR-0005](../../decisions/0005-small-task-skips-per-task-review.md) (`Status: Proposed`, chờ người chốt).
- Rủi ro routing: ba skill mới làm một prompt cũ rơi khỏi hạng 1, số đo tụt dưới khoá; xử lý bằng sửa `description` skill mới (D7).
  `[Unverified]` đến khi chạy `routing-score.mjs` thật sau khi có skill.
- Rủi ro context: mỗi đoạn thêm làm tăng số dòng nạp mỗi lần gọi skill; trần 300 dòng và `references/` giữ mức tăng nhỏ (AC2.1, AC2.4 có luật ưu tiên chuyển sang `references/`).
- Pin 31, 20, 21 có thể đỏ theo hành vi mới của part 01; xử lý theo "01-core".
