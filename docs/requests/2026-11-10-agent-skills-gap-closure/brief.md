# Brief: Thu hẹp các mảng agent-skills mạnh hơn aip
- Ngày: 2026-11-10
- Trạng thái: approved

## Vấn đề và loại việc
Bản so sánh aip với addyosmani/agent-skills (commit `301b02b`, 01/11/2026) cho thấy aip mạnh hơn về quy trình và cưỡng chế,
nhưng còn thiếu bốn mảng mà agent-skills đã có. Đây là một feature của bộ công cụ aip, gồm script Node và nội dung skill:

1. **Đo chất lượng skill.** Đo routing tất định trong `npm test` (prompt positive/negative cho từng skill), và có eval kiểm
   skill phải im lặng khi prompt không thuộc phạm vi của nó.
2. **Kiểm nguồn docs chính thức.** Trước khi viết code dùng framework hay thư viện: xác định phiên bản, ưu tiên docs chính
   thức, trích deep link, gắn `[Unverified]` khi không tra được.
3. **Quality bar.** Một file khai báo các lệnh kiểm, owner và hạn ngoại lệ của project; floor-guard so file này giữa base và
   head để bắt việc nới thanh chất lượng.
4. **Bảng "Dấu hiệu đang tự biện minh"** cho các skill còn thiếu.

Điểm đặc biệt: nội dung skill viết bằng tiếng Việt, nên cách chấm routing của agent-skills (TF-IDF có stem tiếng Anh) không
dùng thẳng được.

## Vì sao bây giờ và thành công trông thế nào
Vì sao bây giờ: việc này nối tiếp bản so sánh ngày 06/11 và đợt bổ sung ngày 10/11. Người dùng chưa nêu sự cố cụ thể nào
(xem Phần đoán).

Thành công khi:
- `npm test` chấm routing cho mọi skill đã published. Tỉ lệ rank-1 thấp hơn ngưỡng đã khoá thì test fail; ngưỡng chỉ được nâng.
- Có case eval "phải im lặng" cho ít nhất 3 cặp skill dễ gọi nhầm, được `test/contract/95-evals.contract.mjs` kiểm cấu trúc.
- `backend-implement`, `frontend-implement` và `frontend-data-integration` có bước kiểm nguồn, cùng trỏ tới một reference dùng chung.
- Có template quality bar, và review package báo khi file quality bar bị nới giữa base và head.
- Các skill trong danh sách ở mục "Quyết định của agent" có bảng tự biện minh ngắn, mỗi dòng trỏ về một luật đã có.

## Goal, non-goal, anti-goal
- **Goal:** bốn mảng trên, mỗi mảng có validator hoặc test bắt được khi nó hỏng.
- **Non-goal:**
  - Eval hành vi chạy model thật trong CI (vẫn chạy tay bằng `scripts/eval-run.mjs`).
  - Ngưỡng coverage hay mutation theo phần trăm.
  - Hook cache WebFetch (sdd-cache).
- **Anti-goal:**
  - Chép nguyên skill hay câu chữ của agent-skills.
  - Thêm skill mới cạnh tranh routing khi một reference là đủ.
  - Bắt mọi skill có đủ 5 section cứng như agent-skills.

## Hiện trạng và tham khảo đã thấy
Hiện trạng trong aip:
- **Floor-guard:** `core/skills/plan-execution/scripts/review-package.mjs` có mục `## Dấu hiệu nới kiểm`, bắt test bị skip,
  cảnh báo bị tắt và ngưỡng số bị nới (commit `adbf56b4` trên nhánh `feature/core-threshold-guard-skill-length-warn`,
  chưa merge). Chưa có file quality bar nào để so.
- **Bảng tự biện minh:** đã có ở 7 SKILL.md: `plan-execution`, `using-aip`, `backend-fix`, `frontend-fix`,
  `engineering-spec-writing`, `engineering-plan-writing`, `engineering-tdd`.
- **Routing:** chỉ có `triggerCollisions` trong `cli/lib/conventions.mjs` (bắt cụm trích dẫn trùng nguyên văn) và
  `test/overlap.mjs` (báo cáo, không assert). Chưa có dữ liệu positive/negative cho skill nào.
- **Eval:** `evals/<plugin>/<case>/` (`prompt.md`, `graders/`, tuỳ chọn `case.yaml`/`scaffold.sh`). Cấu trúc được kiểm bởi
  `test/contract/95-evals.contract.mjs`; chạy thật bằng tay qua `scripts/eval-run.mjs`. Chưa có case "phải im lặng" nào
  (đã kiểm bằng `ls evals/*/*quiet*`).
- **Kiểm nguồn:** chưa có. Nhãn `[Unverified]` chỉ xuất hiện rải rác.

Tham khảo (agent-skills `301b02b`, chỉ đọc):
- `scripts/run-evals.js`: tầng 2 dùng TF-IDF với rank-1 ratchet `--min-rank1 95`.
- `evals/plugin/*-stays-quiet*`: 5 cặp case "phải gọi" và "phải im lặng".
- `skills/source-driven-development/SKILL.md`.
- `skills/constraint-driven-development/` cùng `references/floor-guard.md` và `scripts/quality-gate.mjs`.
- 4 báo cáo so sánh ở `C:\Users\ldmle\AppData\Local\Temp\claude\f5fe61fa7c46a028\700984bf-a629-49fb-b479-f60ce3ed3c62\scratchpad\compare-{1-define-plan,2-build-verify,3-review-ship,4-infra}.md`.

Chưa xem:
- Phần sau của `scripts/eval-run.mjs` (chưa biết nó có kiểm "chạy hoàn tất mới chấm" hay không).
- Cách `aip init` sinh `project-knowledge/` ở project đích.

## Hướng đã cân nhắc
- **A (chọn): một request, bốn part độc lập về file.**
  - P1: dữ liệu routing `evals/trigger/<skill>.json`, script chấm tất định chạy trong `npm test`, ngưỡng khoá trong file và
    chỉ được nâng; thêm case "phải im lặng" trong `evals/`.
  - P2: reference kiểm nguồn trong `core/principles/`, nối vào bước đầu của 3 skill implement.
  - P3: template quality bar trong `artifact-templates`, và `review-package.mjs` so file này giữa base..head.
  - P4: bảng tự biện minh cho các skill trong danh sách.

  Đánh đổi: một design và một plan cho cả đợt, các part chạy song song được. Đổi lại, cổng duyệt cuối gom 4 mảng vào một lần.
- **B (loại): đo routing bằng `claude plugin eval` thật.** Đo đúng ngữ nghĩa hơn nhưng tốn tiền model và không chạy được trong CI.
- **C (loại): chép nguyên `source-driven-development` và `constraint-driven-development` thành skill mới.** Hai skill đó xung
  đột với aip ở ngôn ngữ, ngưỡng coverage và Gitflow, và còn thêm description cạnh tranh trong routing.

## Quyết định của người dùng
- Prompt để chấm routing do một subagent viết "mù": nó chỉ đọc phần `## Quy trình` của SKILL.md, không được xem
  `description`. Người dùng bổ sung câu thật dần về sau.

## Quyết định của agent
**Phạm vi bảng tự biện minh.** Chỉ thêm cho skill có cổng hoặc bước dễ bị lách: `backend-code-review`,
`frontend-code-review`, `backend-refactor`, `frontend-refactor`, `engineering-quality-gate`, `engineering-debugging`,
`ops-deploy-release`, `data-db-migration`, `git-workflow`. Không áp cho mọi skill. Bảng ngắn 4–6 dòng, nằm trong trần
độ dài hiện có (cảnh báo 300 dòng, lỗi 500 dòng; skill dài nhất hiện tại 237 dòng).

**Case "phải im lặng".** Ba cặp đầu tiên:
- `engineering-tdd` với `workflow-bugfix`;
- `backend-code-review` với `engineering-quality-gate`;
- `git-workflow` với `git-release`.

Các case này theo luật hiện có của `test/contract/95-evals.contract.mjs` (thư mục theo plugin, `prompt.md` có `runs: 3`).

**Đo routing (P1).**
- Dữ liệu đặt ở thư mục mà contract 95 không quét (contract này bắt mọi thư mục con trực tiếp của `evals/` phải là
  plugin). Đường dẫn cụ thể chốt ở design.
- Scorer chấm trên `description`, xếp hạng trên toàn bộ skill và workflow published (`plugins/_published.json`, cộng toàn
  bộ core và workflows).
- Positive đạt khi skill đúng đứng hạng 1; negative đạt khi skill đó không đứng hạng 1.
- Ratchet do P1 tự cưỡng chế: test so mức đo được với ngưỡng khoá trong repo, muốn nâng ngưỡng thì commit file khoá.

**Kiểm nguồn (P2).** Reference đặt trong `core/principles/`. Ba skill implement trỏ tới theo mẫu tham chiếu chéo đang
dùng ("skill X (bản cài plugin: core:X)"). Không có mạng hay WebFetch thì gắn `[Unverified]` và tiếp tục, không chặn
việc code.

**Quality bar (P3).**
- Template nằm ở `artifact-templates`, bản điền ở `project-knowledge/quality-bar.md` của project đích. `aip init`
  không tự sinh file này.
- Các thay đổi tính là "nới": bỏ một lệnh kiểm; thêm hoặc gia hạn ngoại lệ; đổi ngưỡng theo hướng nới. Thêm lệnh kiểm
  mới không tính là nới.

**Nhánh làm việc.** Cắt từ đầu `feature/core-threshold-guard-skill-length-warn`, vì P3 mở rộng phần guard ở `adbf56b4`.
Nhánh đó merge trước thì cắt từ master.

**Route.** Chỉ còn `workflow-feature`, đi trọn từ design đến code qua các cổng G1/G2/G3. Bỏ ứng viên
`engineering-spec-writing` vì skill đó chỉ ra spec.

## Phần đoán
- [giả định] Không có sự cố cụ thể nào thúc đẩy việc này; thứ tự làm part theo mức ưu tiên của bản so sánh.
- [giả định] Ngưỡng rank-1 khởi điểm là mức đo được ở lần chạy đầu, làm tròn xuống tới số nguyên phần trăm.
- [giả định] Mỗi skill published cần ít nhất 3 prompt positive và 2 prompt negative. Ở các cặp trùng thật, ngưỡng
  rank-1 có thể khó vượt cao, nên ngưỡng khoá là mức đo được, không đặt mục tiêu 95% như agent-skills.
- [giả định] Phạm vi `code-be` ở đây là tooling Node của aip, không phải Java hay Python; không gọi agent backend
  Java/Spring cho việc này.
- [giả định] Tiếng Việt cần chuẩn hoá (bỏ dấu, có thể thêm bigram) thì chấm điểm mới phân biệt được skill; phải thử trên
  dữ liệu thật trước khi khoá ngưỡng.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: aip có đo routing và eval im lặng trong npm test, reference kiểm nguồn, quality bar có guard, bảng tự biện minh cho 9 skill
rủi-ro: ngưỡng routing tiếng Việt đặt sai làm npm test đỏ giả hoặc vô dụng; thêm nội dung SKILL.md làm tăng context mỗi lần nạp skill
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
