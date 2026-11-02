# Thiết kế: làm rõ bám code, AC có phép tính kiểm được, review không làm thừa
- Ngày: 2026-11-02
- Trạng thái: approved — người dùng duyệt 2026-11-02
- Requirement: không có
## Vấn đề và lý do
Lượt chấm E2E ngày 2026-11-02 (cùng kịch bản "mã giảm giá cho giỏ hàng", aip so với Claude không plugin, oracle độc lập 12 ca) cho aip 7.6/10 và đối chứng 6.8/10. aip thắng ở TDD, review, cổng và truy vết; thua ở ba phần người dùng muốn nâng lên ≥ 9:

| Phần | aip | Đối chứng | Bằng chứng |
|---|---|---|---|
| Làm rõ yêu cầu | 7 | 8 | Lượt đầu xin phép đọc `src/` và hỏi "giỏ hàng tính tiền thế nào"; đối chứng đọc code trước, tự nêu làm tròn và kẹp tổng. |
| Spec / AC | 7 | 7 | `engineering-spec-analyst` ghi AC1.3 sai số học (`99999` giảm 15% làm tròn xuống → 85000, AC ghi 84999); builder check không bắt; chỉ lộ ra khi TDD đỏ ở `plan-execution`. |
| Gọn / đúng phạm vi | 7 | 8 | Sau review cuối, `Ruling:` của session chính nhận đề xuất của reviewer/auditor: `applyCoupon` ném `TypeError` khi `now` sai hoặc bản ghi mã sai kiểu. Không AC nào yêu cầu, caller phải bọc `try/catch`, và bảng mã là hằng số trong code (không phải ranh giới tin cậy). Spec để việc tăng lượt dùng cho caller nên tính năng "tổng lượt dùng tối đa" người dùng nêu chỉ làm một nửa. |

Hai sửa đã merge ở master `3b9b62c` (request trước, chưa kiểm bằng E2E): `brainstorming` đọc code nhỏ trước khi hỏi; `engineering-spec-writing` dặn tự tính lại ví dụ số. Cả hai là chỉ dẫn cho model; lỗi số học là model tự kiểm model nên vẫn có thể lọt.

Đối chiếu superpowers 7.0.0: skill `receiving-code-review` có "YAGNI Check" và "When To Push Back" cho góp ý review; aip chưa có bước tương đương, quy tắc 7 của `plan-execution/references/prompts/final-review.md` chỉ chặn finding đổi nghĩa AC. superpowers không có AC kèm ví dụ số nên không có lỗi kiểu AC1.3; brainstorming của superpowers cũng "offer recon" và chờ đồng ý, nên aip không lấy superpowers làm mẫu cho phần làm rõ mà lấy hành vi của đối chứng.
## Quyết định đã chốt
Người dùng chốt:
1. Nâng ba phần trên lên ≥ 9.
2. Làm theo đề xuất A–D (người dùng trả lời "tiếp tục" sau bản đề xuất).
3. Ở G3, người dùng chọn "làm" cho một finding ngoài AC có đổi hành vi thì aip chỉ ghi thành follow-up (request hoặc task riêng sau khi nhánh xong), không chạy tiếp trong nhánh. `finish.md` không thêm lane mới.
4. Chạy eval mới (D1) và E2E (D2) bằng model nằm trong điều kiện "xong" của request. Chi phí khoảng $10 [Inference] đã được duyệt, nên plan có task cuối chạy chúng. Các mục dưới ghi chi tiết; mục ghi *quyết định của agent* là chỗ người dùng chưa xét riêng.

- **A. Làm rõ bám code.**
  - A1. Giữ quy tắc đọc code nhỏ trước khi hỏi (đã merge). Không đổi.
  - A2. Thêm bước "Rà ca biên" vào `core/skills/brainstorming/references/clarify-core.md` (dùng chung cho `brainstorming` và `engineering-spec-writing`): khi việc chạm số, tiền, thời gian, bộ đếm hoặc giới hạn, liệt kê các ca: làm tròn, biên dưới/trên (không âm, trần), đầu vào rỗng, mốc thời gian (bao gồm hay loại trừ), đếm đồng thời. Mỗi ca có một mặc định khuyến nghị dẫn chứng bằng code đã đọc (`file:line`) và đi vào thẻ câu hỏi dưới dạng đáp án khuyến nghị; code đã trả lời thì ghi thẳng vào brief, không hỏi. *Quyết định của agent:* danh sách ca cố định ở trên, không mở rộng theo domain.
- **B. AC có phép tính kiểm được.**
  - B1. Mọi AC nêu kết quả số kèm một khối `calc: <biểu thức> = <kết quả>` trong backtick, vd `` `calc: 99999 - floor(99999 * 15 / 100) = 85000` ``. Quy tắc nằm ở `engineering-spec-writing` (bước ghi AC), `references/checklist.md`, `engineering-spec-analyst`, template `requirement.template.md`/`design.template.md` (một dòng hướng dẫn).
  - B2. `check-request.mjs` thêm **W22**: tính biểu thức của mọi khối `calc:` trong `requirement.md`/`design.md` bằng bộ tính số học zero-dependency (số, `+ - * / %`, ngoặc, `floor`, `ceil`, `round`, `min`, `max`, `abs`; không `eval`); kết quả lệch, hoặc biểu thức không hợp lệ, thì cảnh báo kèm dòng. *Quyết định của agent:* không cảnh báo AC có số mà thiếu `calc:` (dễ báo nhầm với ID, ngày, mã HTTP); bắt buộc bằng skill, W22 chỉ kiểm khối có mặt.
  - B3. Builder check của spec (`engineering-spec-writing/references/builder-check.md`) bỏ dòng "tự tính lại" ở bản trước, thay bằng: chạy `check-request.mjs` và đưa mọi W22 vào nhóm sửa thẳng.
- **C. Review không làm thừa.**
  - C1. Thêm mục "Nhận review" vào `core/skills/plan-execution/references/task-loop.md`, áp cho review từng task và review cuối, trước khi giao sửa. Session chính xếp mỗi finding vào một nhóm:
    - **trong phạm vi**: vi phạm AC hay tiêu chí đã duyệt, lỗi đúng/sai trong hành vi AC mô tả, test sai → sửa như hiện nay;
    - **ngoài AC, không đổi hành vi**: hardening, kiểm đầu vào, dọn code mà không có AC → ghi `minor (deferred)` (giữ mức gốc trong `Ruling:` nếu là blocker/major), không sửa;
    - **ngoài AC, đổi hành vi hoặc API** (ném lỗi mới, mã lý do mới, tham số mới) → đưa vào thẻ G3 kèm hệ quả, không sửa; người dùng chọn "làm" thì ghi thành follow-up (Quyết định 3).

    `Ruling:` không được thêm hành vi không có trong AC. Ngoại lệ: lỗ hổng bảo mật ở ranh giới tin cậy thì vẫn là trong phạm vi.

    *Quyết định của agent* (từ builder check):
    - Lỗi đúng/sai với đầu vào hợp lệ của chính tính năng (crash, kết quả sai) mà AC chưa nhắc tới vẫn là **trong phạm vi**: sửa và thêm AC kèm test qua lane "AC mới" có sẵn của `final-review.md` (người dùng duyệt câu AC trong `design.md`). Đầu vào hợp lệ là đầu vào đúng kiểu và đúng miền mà design mô tả.
    - Finding blocker/major ngoài AC được hoãn ngay ở lần nhận review bằng dòng `Ruling:` giữ mức gốc. Finding đó không chặn `Task <n>: complete`: `review clean` đổi thành "không còn blocker/major mở **trong phạm vi**". `ledger.mjs` không đổi, vì nó không đọc mức finding. Mọi `Ruling:` hoãn blocker/major ngoài AC được liệt kê ở G3.
  - C2. Quy tắc ranh giới tin cậy, một đoạn chung đặt ở `core/principles/` và trỏ từ `prompts/task-review.md`, `prompts/final-review.md`, `engineering-quality-auditor`: dữ liệu do code hoặc cấu hình nội bộ của repo khai báo không phải ranh giới tin cậy; kiểm đầu vào chỉ là finding trong phạm vi khi dữ liệu đến từ người dùng, mạng, file hay hệ thống ngoài. Finding kiểm đầu vào cho dữ liệu nội bộ tối đa `minor`.
  - C3. Builder check của spec và thẻ duyệt G1: tính năng người dùng nêu mà design chỉ làm một phần (vd có giới hạn lượt dùng nhưng không có cách tăng lượt) là câu hỏi của người dùng (nhóm "theirs"), không phải *quyết định của agent*.
- **D. Kiểm chứng.**
  - D1. Ba eval case mới (không cần Bash, chạy được trên Windows): `evals/core/brainstorm-reads-code-first`, `evals/engineering/spec-ac-calc`, `evals/workflows/review-out-of-scope`.
  - D2. Chạy lại E2E cùng kịch bản lượt 2026-11-02, chấm theo rubric ở mục Kiểm thử, ghi `trial-7.md`. Kịch bản (code ban đầu, 4 lời nhắn người dùng, cờ `claude -p`, cách tắt plugin cho nhánh đối chứng) và `oracle.mjs` nằm ở `docs/requests/2026-11-02-aip-scope-discipline/e2e/`.
- **Ánh xạ spec** (*quyết định của agent*): `workflows/R16` = Nhận review và ranh giới tin cậy (C1, C2); `workflows/R17` = Làm rõ và spec của `workflow-feature` Bước 2–3: rà ca biên, khối `calc:` bắt buộc trong AC, tính năng cắt bớt là câu hỏi người dùng (A2, B1, B3, C3); `artifact-templates/R13` = W22 (B2). `brainstorming` và `engineering-spec-writing` là các bước của `workflow-feature` nên ghi vào spec `workflows`, không tạo capability mới.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given việc chạm số/tiền/thời gian/bộ đếm When `brainstorming` hoặc `engineering-spec-writing` chạy bước làm rõ Then `clarify-core.md` yêu cầu rà 5 nhóm ca biên (làm tròn, biên, rỗng, mốc thời gian, đồng thời), mỗi ca một mặc định dẫn `file:line` của code đã đọc, ca code đã trả lời thì không hỏi
- [ ] **AC1.2** — Given eval `core/brainstorm-reads-code-first` (repo nhỏ có hàm tính tiền) When chạy nhánh có plugin Then có `Read` file nguồn trước tin nhắn cuối, tin nhắn cuối không hỏi điều code đã trả lời và có ít nhất một ca biên kèm mặc định
- [ ] **AC2.1** — Given `requirement.md` có AC chứa `` `calc: 99999 - floor(99999 * 15 / 100) = 84999` `` When chạy `check-request.mjs` Then có cảnh báo W22 nêu dòng, giá trị ghi 84999 và giá trị tính 85000
- [ ] **AC2.2** — Given khối `calc:` đúng, hoặc biểu thức chứa ký tự ngoài tập cho phép When chạy `check-request.mjs` Then khối đúng không cảnh báo, biểu thức không hợp lệ có W22 "biểu thức không hợp lệ" và không thực thi gì
- [ ] **AC2.3** — Given `engineering-spec-writing`, `engineering-spec-analyst`, `checklist.md`, `builder-check.md` When đọc Then có quy tắc AC nêu kết quả số phải kèm `calc:` và builder check chạy `check-request.mjs`, W22 vào nhóm sửa thẳng
- [ ] **AC2.4** — Given eval `engineering/spec-ac-calc` (yêu cầu có giảm % làm tròn xuống) When chạy nhánh có plugin Then `requirement.md` có khối `calc:` và mọi khối đúng số học
- [ ] **AC3.1** — Given finding ngoài AC không đổi hành vi When session chính nhận review Then `task-loop.md` bảo ghi `minor (deferred)` (blocker/major giữ mức gốc trong `Ruling:`), không giao sửa
- [ ] **AC3.2** — Given finding ngoài AC đổi hành vi hoặc API When nhận review Then `task-loop.md` bảo đưa vào thẻ G3 kèm hệ quả, không sửa; `finish.md` ghi lựa chọn "làm" thành follow-up; `Ruling:` không được thêm hành vi không có trong AC
- [ ] **AC3.3** — Given dữ liệu do code/cấu hình nội bộ khai báo When reviewer task, reviewer cuối hoặc `engineering-quality-auditor` đánh giá kiểm đầu vào Then prompt trỏ tới đoạn ranh giới tin cậy chung và finding đó tối đa `minor`
- [ ] **AC3.4** — Given design chỉ làm một phần tính năng người dùng nêu When builder check của spec chạy Then mục đó vào nhóm câu hỏi của người dùng, không ghi là quyết định của agent
- [ ] **AC3.5** — Given eval `workflows/review-out-of-scope` (review cuối có finding hardening dữ liệu nội bộ và finding đề xuất ném lỗi mới) When chạy nhánh có plugin Then không có Edit/Write vào `src/` cho hai finding đó và tin nhắn cuối hỏi người dùng về finding đổi hành vi
- [ ] **AC4.1** — Given bản sửa đã merge When chạy lại E2E cùng kịch bản với oracle Then `trial-7.md` ghi điểm từng phần theo rubric, ba phần đều ≥ 9, oracle 12/12
## Thiết kế
- `core/skills/brainstorming/references/clarify-core.md`: mục "Rà ca biên" (A2). `engineering-spec-writing` đã trỏ tới `clarify-core.md`, không chép.
- `core/skills/artifact-templates/scripts/check-request.mjs`: hàm `evalCalc(expr)` thuần (tokenizer + đệ quy giảm dần, tập hàm cố định), quét khối `` `calc: … = <số>` `` trong `requirement.md` và `design.md` (cả `parts/*/design.md`), cảnh báo W22. Template `requirement.template.md`/`design.template.md` thêm một dòng hướng dẫn `calc:` ở mục AC; mục lục W trong `SKILL.md` của `artifact-templates` thêm W22.
- `plugins/engineering/skills/engineering-spec-writing/SKILL.md`, `references/checklist.md`, `references/builder-check.md`, `plugins/engineering/agents/engineering-spec-analyst.md`: quy tắc B1, B3, C3.
- `core/principles/trust-boundary.md` (mới, một đoạn): C2. `core/skills/plan-execution/references/prompts/task-review.md`, `prompts/final-review.md`, `plugins/engineering/agents/engineering-quality-auditor.md` trỏ tới.
- `core/skills/plan-execution/references/task-loop.md`: mục "Nhận review" (C1); `prompts/final-review.md` quy tắc 7 mở rộng sang finding ngoài AC đổi hành vi; `references/finish.md` thẻ G3 liệt kê câu hỏi từ C1.
- Eval: 3 thư mục case theo `evals/README.md` (prompt, graders, `case.yaml` + `scaffold.sh` khi cần file mẫu), cập nhật bảng case trong `evals/README.md` và `README_VI.md`.
## Ảnh hưởng spec
- artifact-templates: thêm R13
- workflows: thêm R16
- workflows: thêm R17
## Ngoài phạm vi và anti-goal
- Không đổi số vòng review, model routing hay thứ tự bước của `workflow-feature`.
- Không bỏ review cuối hay auditor; chỉ đổi cách session chính nhận finding.
- Anti-goal: aip trở nên "gọn" bằng cách bỏ qua lỗi thật trong phạm vi AC (oracle phải giữ 12/12), hoặc bỏ qua lỗ hổng ở ranh giới tin cậy.
- Không cảnh báo AC thiếu `calc:` (B2).
## Ràng buộc
- Zero-dependency, không `eval`/`Function` trong `evalCalc`.
- Bump `core`, `engineering`, `workflows` (nếu chạm), `node cli/lib/versions.mjs --lock`, `npm test` xanh.
- Eval case không cấp Bash (Windows không chạy được case có Bash).
- Chi phí model: D1 chạy 1 lần mỗi nhánh (~$2), D2 một lượt E2E (~$8); tổng ước ~$10 [Inference], người dùng đã duyệt (Quyết định 4). Vượt $15 thì dừng hỏi.
## Kiểm thử
- AC2.1, AC2.2: test có tham số cho `evalCalc` và W22 với fixture request trong `test/` (tầng unit).
- AC1.1, AC2.3, AC3.1–AC3.4: pin nội dung `test/content/38-scope-discipline.pin.mjs` (câu quy tắc chính, con trỏ tới `trust-boundary.md`).
- AC1.2, AC2.4, AC3.5: eval case mới; cấu trúc qua `test/contract/95-evals.contract.mjs`, hành vi qua `scripts/eval-run.mjs` (tốn tiền, chạy tay).
- AC4.1: lượt E2E + oracle, ghi `trial-7.md`. Rubric ≥ 9:
  - Làm rõ: không câu hỏi nào code đã trả lời; thẻ đầu có ca biên số kèm mặc định dẫn code; brief có ở lượt ≤ 2.
  - Spec / AC: W22 = 0; mọi AC nêu kết quả số có `calc:`; tính năng người dùng nêu làm đủ hoặc cắt có người dùng duyệt ở G1.
  - Gọn: diff không có hành vi ngoài AC chưa được người dùng duyệt; không kiểm đầu vào cho dữ liệu nội bộ; oracle 12/12.
## Để builder quyết
- Cú pháp chính xác của khối `calc:` (có cho phép dấu phân cách hàng nghìn hay không) và thông điệp W22.
- Nội dung prompt và scaffold cụ thể của 3 eval case.
## Rủi ro và câu hỏi mở
- [Inference] Model có thể bỏ khối `calc:` mà W22 không thấy (B2 không cảnh báo thiếu); eval `spec-ac-calc` và rubric E2E đo việc này.
- C1 dời một số sửa sang G3, có thể làm thẻ G3 dài hơn; giảm bằng cách gom câu hỏi đổi hành vi vào một thẻ.
- Rubric do agent chấm (n=1); điểm là đánh giá có bằng chứng, không phải số đo thống kê.
