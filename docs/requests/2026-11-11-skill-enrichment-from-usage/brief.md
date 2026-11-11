# Brief: làm giàu bộ skill plugin từ dữ liệu dùng thật
- Ngày: 2026-11-11
- Trạng thái: approved

## Vấn đề và loại việc

Người dùng đang làm tay một số việc mà chưa skill nào của aip lo. Một số skill đã có cũng để lọt lỗi, và lỗi lộ ra ở
vòng review muộn. Bằng chứng lấy từ dùng thật trong repo `content-automation-platform` (cap): 23 ledger
`.aip/runs/*/progress.md`, 6 file `manual-check.md`, các file facts/spike/handoff trong `docs/requests/` và ghi chú
feedback của người dùng trong memory.

Đây là một feature của aip: vừa sửa skill có sẵn, vừa thêm skill mới, cộng thêm một công cụ đo. Request chia part, mỗi
part là một plugin.

## Vì sao bây giờ và thành công trông thế nào

Người dùng nêu lý do: có việc chưa skill nào lo. Ledger của cap cho thấy cái giá của việc đó. Có 8 task phải review tới
vòng 2 mà vẫn còn lỗi, 3 task tới vòng 3 (đếm dòng `review N issues`). 9 ledger có ruling "ngoài Files", tức plan để
sót file cần sửa.

Thành công (người dùng chọn) là ít vòng review và ít ruling hơn. Số nền đo từ ledger hiện có trước khi sửa skill. Các
request sau đợt này đo lại bằng cùng script và so: tỉ lệ task phải review từ vòng 2 trở lên, và số ruling "ngoài Files"
trên mỗi request.

## Goal, non-goal, anti-goal

Goal, mỗi dòng là một part:

- **Gốc (chạy trước mọi part): đo.** Script đọc `progress.md` của một project đích, đếm số vòng review của mỗi task, số
  ruling, số ruling "ngoài Files" và số minor bị hoãn, rồi in số nền.
- **01 core.**
  - `plan-execution` và `workflow-feature` chia việc theo cỡ Nhỏ/Vừa/Lớn. Việc nhỏ hoặc cơ học không review từng task,
    chỉ review cuối; Minor không vào vòng sửa; full suite chạy một lần.
  - Bổ sung quy trình điều phối nhiều phiên vào chỗ đã có: vai phiên gốc và phiên con, handoff, xoay context ở mức mềm
    và mức cứng, giữ ledger khi worktree bị xoá.
  - `git-workflow` thêm luật xoá file đã tracked thì commit chỉ-xoá riêng. `git-worktree` dựng worktree từ nhánh feature,
    không từ origin/master.
- **02 engineering.**
  - `plan-writing` kiểm `**Files:**` đủ trước khi duyệt plan, gồm test, fixture, caller và config bị chạm.
  - `spec-writing` kiểm AC mâu thuẫn với nhau và với brief trước khi duyệt.
  - Task tài liệu có bước kiểm từng khẳng định trong docs với code.
  - Skill mới: nghiên cứu API ngoài hoặc làm spike, ra file facts có nhãn `[Verified]`/`[Inference]` và nguồn.
- **03 backend.**
  - Một checklist robustness dùng chung cho `backend-implement` và `backend-code-review`: chặn kích thước input, che
    secret trong log và lỗi, idempotency, race và CAS, việc mồ côi sau lỗi.
  - Skill mới cho tính năng gọi LLM: budget theo ngày, backoff, fail-soft có đánh dấu, ghi usage, redact output, hash
    input, prompt fallback.
- **04 frontend.** Skill mới viết runbook kiểm tay ánh xạ AC (seed data, bước, kết quả mong đợi) cho UI không có test
  tự động, kèm walkthrough khám phá bằng Playwright có luật PASS/FAIL/SKIP và luật an toàn.
- **05 data.** `data-db-migration` thêm quy tắc giữ số migration khi nhiều nhánh chạy song song, và thứ tự merge.

Non-goal:

- Ngân sách RAM/compose cho ops, thay đổi contract Avro/Kafka, bẫy Windows/ffmpeg. Bằng chứng mỏng, để đợt sau nếu gặp
  lại. Vì vậy plugin `ops` không có part.
- Workflow mới hoàn toàn (người dùng chọn để đợt sau, khi dữ liệu dùng thật cho thấy cần). Việc chia cỡ của `workflow-feature` nằm trong part core.
- Sửa repo cap. Cap chỉ là nguồn bằng chứng và nơi thử script đo.

Anti-goal:

- Skill dính tên riêng của cap (cap-core, cap-web, V124, khe kho…). Skill phải trung lập với project, cap chỉ xuất hiện
  dưới dạng ví dụ đã khái quát.
- Phình `SKILL.md` quá ngưỡng độ dài: nội dung dài đưa vào `references/`.
- Bỏ review ở việc có backend, migration hoặc bảo mật.

## Hiện trạng và tham khảo đã thấy

Đã xem:

- Cấu trúc aip ở `build/claude/plugins/`: 7 plugin, 56 skill. `data` có 2 skill, `ops` có 4.
- `docs/requests/2026-11-10-agent-skills-gap-closure/design.md`: đã có routing score (`test/routing/`, `rank1.lock.json`),
  reference kiểm nguồn, quality bar có guard, bảng tự biện minh cho 9 skill.
- Bằng chứng ở cap, do subagent đọc và tôi kiểm lại một phần:
  - Review lặp vòng: `.aip/runs/2026-11-03-niche-market-intel/04-niche-digest/progress.md:21-44`,
    `.aip/runs/2026-11-10-intel-searxng-web-search/root/progress.md:53-57`.
  - Ruling "ngoài Files": `.aip/runs/2026-11-06-research-intel-upgrade/01-web-search-source/progress.md:3,26,35,40,41`.
  - AC mâu thuẫn và ruling tự đảo: `.aip/runs/2026-11-03-niche-market-intel/01-profile-no-channel/progress.md:35`,
    `.aip/runs/2026-10-31-story-series/root/progress.md:27,36`.
  - Task docs nhiều finding muộn: `.aip/runs/2026-11-06-stock-footage-broll/root/progress.md:76-78`.
  - Manual-check viết tay: `docs/requests/*/manual-check.md` (6 file, khoảng 870 dòng).
  - Walkthrough UI: `docs/requests/2026-10-26-ui-walkthrough/brief.md`.
  - File facts API: `docs/requests/2026-10-20-p1-1-tiktok/tiktok-api-facts.md`, `2026-10-21-p2-facebook-reels/facebook-api-facts.md`,
    `2026-11-06-research-intel-upgrade/web-search-facts.md`.
  - Đụng số Flyway: `.aip/runs/2026-10-31-story-series/root/progress.md:23,38`,
    `.aip/runs/2026-11-06-stock-footage-broll/root/progress.md:14,18`.
  - Feedback trong memory của cap: `feedback-speed.md` (chia cỡ, cắt review), `feedback-coordinator-role.md`,
    `feedback-monitor-child-context.md`, `feedback-no-stop-for-rotation.md`, `feedback-deletion-commit.md`,
    `agent-worktree-base.md`.

Chưa xem:

- Nội dung hiện tại của từng `SKILL.md` sẽ sửa.
- ADR 0002 và 0003 của aip (chuyển model, phiên dài) có thể đã phủ một phần việc điều phối nhiều phiên.
- `events.jsonl`, các file `task-N-brief.md` và phần lớn `plan.md`/`design.md` của cap.

## Hướng đã cân nhắc

- **A (chọn). Một request, chia part theo plugin, việc đo làm ở gốc.** Script đo chạy trước để có số nền. Sau đó 5 part
  chạy song song vì mỗi part chỉ sửa thư mục plugin của nó; file dùng chung (CHANGELOG, version, `_published.json`) chỉ
  phiên chính sửa. Đánh đổi: request lớn, nhiều part, nên cần kiểm phân vùng file.
- **B (loại). Chỉ làm 3 chỗ đau nhất** (spec/plan, review theo cỡ, điều phối nhiều phiên). Có số đo nhanh hơn, nhưng chỉ
  làm được một phần ý "mỗi plugin một part" của người dùng.
- **C (loại). Mỗi plugin là một request riêng.** Phải duyệt 5 lần, và không có số nền chung.

## Quyết định của agent

- Lưu brief ở `docs/requests/` của repo aip, vì đó là repo của việc, không phải repo cap.
- Gộp phần workflows vào part core: chưa có bằng chứng cho một workflow mới, chỉ có việc chia cỡ của `workflow-feature`.
- Script đo đọc ledger của một project đích qua đường dẫn truyền vào. Không đóng gói ledger của cap vào aip. Đặt ở
  `scripts/` của aip, in JSON ra stdout. Số nền của cap lưu thành `baseline.json` trong thư mục request này để các request
  sau so lại. Đường dẫn cụ thể chốt ở design.
- Điều phối nhiều phiên không thành skill mới. Baseline `AGENTS.md` (mục "Model and session routing", ADR 0002/0003) và
  template `handoff` đã phủ một phần. Part core chỉ bổ sung phần còn thiếu (vai phiên gốc và phiên con, giữ ledger khi
  worktree bị xoá) vào chỗ đã có và không được mâu thuẫn ADR. Vì vậy đợt này có 3 skill mới: nghiên cứu API/spike, tính
  năng gọi LLM, runbook kiểm tay UI.
- Ngưỡng đã có trong aip làm tiêu chí đạt của mọi part: `SKILL.md` dưới mức cảnh báo 300 dòng (lỗi ở 500), `npm test`
  xanh gồm routing score không thấp hơn `test/routing/rank1.lock.json`. Mỗi skill mới có file `test/routing/<id>.json`.
- Kiểm skill trung lập với project bằng grep một danh sách tên riêng của cap (`cap-core`, `cap-web`, `capcore`, số
  `V1xx`, `khe kho`…) trên phần diff skill ở review cuối. Danh sách chốt ở design.
- `phạm-vi: code-be` theo tiền lệ của request 2026-11-10: phần code là tooling Node của aip, phần còn lại là Markdown.
  Không gọi agent backend Java/Spring cho việc này.
- Theo route `workflow-feature`, bước đầu là design. Design đối chiếu từng mục goal với `SKILL.md` thật và bỏ mục đã có
  trước khi viết plan.

## Phần đoán

- [giả định] Một số mục khác ngoài điều phối nhiều phiên có thể cũng đã có một phần trong skill hiện tại.
- [giả định] Số đếm từ ledger dùng grep theo định dạng dòng hiện tại (`Task N: review K issues`, `Ruling:`, `minor
  (deferred)`). Đổi định dạng ledger thì phải sửa script đo.
- [giả định] Chỉ một project (cap) làm nguồn bằng chứng, nên checklist backend và skill LLM có thể lệch về stack Java/Python
  của cap.
- [giả định] Phạm vi chủ yếu là Markdown của skill, cộng một script Node cho phần đo.
- [giả định] "Ít vòng review hơn" chỉ đo được sau vài request mới trên cap, không đo ngay khi đợt này merge.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: aip có script đo ledger kèm số nền, 5 part sửa skill core/engineering/backend/frontend/data và 3 skill mới
rủi-ro: thêm nội dung làm SKILL.md dài và tăng context mỗi lần nạp; skill mới trùng trigger với skill cũ làm routing score tụt; cắt review cho việc nhỏ để lọt lỗi
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
