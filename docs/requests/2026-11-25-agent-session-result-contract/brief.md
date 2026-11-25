# Brief: Chuẩn hóa result giữa session và subagent
- Ngày: 2026-11-25
- Trạng thái: approved

## Vấn đề và loại việc
Kết quả trả về giữa các tác nhân của aip đang có hai dạng, và cả hai đều để LLM tự đọc rồi tự kiểm:

- **Subagent → session chính:** khối YAML `agent_result` (contract ở `core/principles/workflow-output-contract.md`). Định dạng đã thống nhất, nhưng 7 luật "Kiểm đầu ra worker" do session chính áp bằng tay. Các prompt giao việc chép lại schema theo cách riêng của mình, và khoá rỗng vẫn bị bắt ghi ra.
- **Phiên con → phiên gốc:** văn tự do quy định ở ba chỗ: `task-loop.md` "Chế độ part" bước 6 (một dòng gồm hash, kết quả test, số minor hoãn), dòng `Blocked:`, và quy tắc 9 và 14 của `model-routing.md` (đường dẫn kèm kết luận). Không có cú pháp cố định và không có trần độ dài.

Loại việc: feature, sửa nội dung core (contract, prompt, `plan-execution`) kèm một script Node mới. Phạm vi gồm cả session lẫn subagent, theo yêu cầu người dùng.

## Vì sao bây giờ và thành công trông thế nào
Chế độ part chạy bằng phiên riêng vừa merge (40900e05), nên phiên gốc ngày càng nhận nhiều báo cáo của phiên con. Note tự động của app chỉ trích 400 ký tự đầu của báo cáo cuối lượt, theo hướng dẫn app cấp cho phiên này, nên báo cáo dài hoặc không theo cấu trúc dễ mất phần quan trọng.

Thành công khi:
- Có một script (tên tạm `result-check.mjs`) parse được `agent_result` và dòng báo cáo phiên, áp đủ 7 luật kiểm đầu ra hiện có, kèm test trong `npm test`.
- Mọi tin phiên con → phiên gốc là một dòng `aip-report` có khoá, dài tối đa 400 ký tự; chi tiết nằm ở ledger hoặc file mà dòng đó trỏ tới.
- `agent_result` cho phép bỏ các khoá rỗng không bắt buộc. Prompt giao việc trỏ về contract thay vì chép schema. Tổng kích thước contract cộng 4 prompt trong `plan-execution/references/prompts/` (hiện khoảng 31,8 KB) được đo trước và sau, và không tăng.
- Session chính gọi script này thay cho việc tự áp luật bằng tay (`task-loop.md` bước 4, mục "Kiểm đầu ra worker").

## Goal, non-goal, anti-goal
- **Goal:** một contract kết quả cho cả subagent lẫn phiên, gọn hơn, máy kiểm được.
- **Non-goal:** đổi định dạng dòng ledger (`Task <n>: complete`, `Part: complete`, `Blocked:`, `Ruling:`); chuyển hẳn sang JSON; ép schema ở tầng công cụ Agent; viết lại `workflow_result`, ngoài việc áp cùng quy tắc bỏ khoá rỗng nếu design thấy cần.
- **Anti-goal:** làm hỏng `aip status`, hook `session-start` hay `ledger.mjs` đang đọc ledger; thêm phụ thuộc runtime; bắt reviewer chỉ-đọc phải ghi file; làm report cũ trong `.aip/runs/` bị báo lỗi.

## Hiện trạng và tham khảo đã thấy
- Đã đo 91 file `task-*-report.md` trong `.aip/runs/`: trung vị 1,1 KB, p90 2 KB, lớn nhất 6,6 KB. `agent_result` khi chạy thật không dài.
- Phần dài là đặc tả: `workflow-output-contract.md` 13,4 KB; prompt `final-review` 6,8 KB, `task-review` 5,0 KB, `implementer` 4,3 KB, `re-review` 2,4 KB.
- `ledger.mjs` đã ghi `events.jsonl` (`{ts, line}`) cạnh `progress.md`. Phiên gốc vốn phải đọc lại ledger mỗi lần được đánh thức (`task-loop.md` bước 7), nên tin nhắn giữa các phiên chỉ cần đánh thức và trỏ tới file.
- Các biến thể `agent_result` riêng: `engineering-codebase-onboarding/references/subagent-prompts.md` mục D và `engineering-spec-backfill/references/subagent-prompt.md`.
- Test đang ghim contract: `test/content/31-workflow-self-sufficient.pin.mjs`, `53-reasoning-review.pin.mjs`, `test/contract/10-source.contract.mjs`.
- Chưa xem: nội dung chi tiết của 16 file agent ngoài dòng "Trả khối `agent_result`"; `inline.md` mục "Subagent part"; template `handoff.template.md`.
- [Unverified] Chưa kiểm công cụ Agent của Claude Code có hỗ trợ ép đầu ra theo schema hay không.

## Hướng đã cân nhắc
- **A (đã chọn):** giữ YAML `agent_result` nhưng cho bỏ khoá rỗng; thêm dòng `aip-report` có khoá cho tin phiên ↔ phiên; thêm script parse cả hai dạng và áp 7 luật; gom định nghĩa về contract, prompt chỉ trỏ tới. Đánh đổi: thêm một script cùng test, và phải sửa prompt ở nhiều file.
- **B (loại):** chuyển hết sang JSON. Parse chặt nhất, nhưng tốn token hơn vì dấu nháy, người khó đọc khi duyệt, và phải đổi định dạng mọi agent cùng lúc.
- **C (loại):** chỉ quy ước trong tài liệu, không có script. Rẻ, nhưng vẫn để LLM kiểm tay, đúng chỗ đang yếu.

Về câu hỏi "AI nói với nhau bằng full text có ổn không": [Inference] phần giao việc để văn tự nhiên là hợp lý; chỗ chưa tối ưu là phần kết quả. Hướng A sửa đúng chỗ đó mà không đổi cách giao việc.

## Quyết định của agent
- Script đặt ở `core/skills/plan-execution/scripts/`, cạnh `ledger.mjs`, dùng chung `workspace.mjs` nếu cần.
- Report cũ không có dấu hiệu dạng mới thì script bỏ qua, không báo lỗi. Người dùng đã chốt hướng tương thích này; cách nhận ra dạng mới (vd dòng `v1` hoặc khoá phiên bản) để design quyết.
- Hai biến thể `agent_result` của onboarding và spec-backfill nằm trong phạm vi rà, nhưng chỉ đổi khi chúng lệch contract chung.
- **Script đọc từ file, không đọc từ stdin.** Worker có quyền ghi (implementer, test-writer) tự ghi report vào thư mục run (`.aip/runs/<request>/<part>/task-<n>-report.md`, như task `TOOLING` đang làm, `task-loop.md:26`). Reviewer chỉ-đọc vẫn trả report trong tin nhắn, session chính lưu file như hiện nay (`report_file` để trống), rồi mới chạy script. Reviewer không phải ghi file nào.
- **Luật cần repo:** luật "file trong `changes` thuộc danh sách đã giao" cần `**Files:**` của task, nên script nhận thêm `--plan <plan.md> --task <n>` cho luật này. Không truyền thì luật đó báo `not_run` thay vì đạt. Các luật còn lại chỉ cần nội dung report. Đối chiếu với diff thật vẫn là việc của reviewer và `review-package.mjs`.
- **Đo kích thước:** đo contract cộng 4 prompt, tính cả phần mới (đặc tả `aip-report`, cách gọi script). "Không tăng" là mục tiêu báo số trước/sau trong design, không phải cổng của `npm test`. Không cắt các trường bắt buộc (`spec_verdict`, `assumption_review`, `verdicts`, `tdd`) để đạt số.
- **`aip-report` thay dòng tự do, không thay ledger:** dòng này thay câu "một dòng gồm hash, kết quả test, số minor hoãn" và tin báo `Blocked:` gửi qua `SendMessage` (`task-loop.md` bước 6). Nó cũng đứng đầu báo cáo cuối lượt của phiên con để lọt vào 400 ký tự của note. Ledger vẫn ghi `Part: complete` / `Blocked:` như cũ và vẫn là nguồn sự thật. Dòng `aip-report` không ghi vào ledger hay `events.jsonl`. Phiên gốc chạy script trên dòng nhận được, rồi đọc ledger như bước 7.
- **Pin test được sửa** theo vị trí mới của định nghĩa. Test ghim trường bắt buộc (`spec_verdict`, `assumption_review`, `tdd`, `assumptions`) là test contract được bảo vệ (`AGENTS.md`, mục Testing): chỉ được chuyển chỗ, không bỏ, và script mới có test cho từng luật.
- **`phạm-vi: code-be`** giữ theo tiền lệ của repo: các request sửa script Node và nội dung core trước đây đều ghi `code-be` và route `workflow-feature`. Việc này không cần agent backend Java/Python. Design ghi rõ kind của task là `TOOLING`/`DOCS`.

## Phần đoán
- [giả định] Dạng dòng `aip-report` gần như sau, chốt ở design: `aip-report v1 from=<part nn|session> status=<complete|blocked|failed> hash=<sha> tests=<pass|fail|not_run> minor=<n> file=<đường dẫn> note="<≤120 ký tự>"`.
- [giả định] Bỏ khoá rỗng giảm được khoảng 10–20% kích thước một report. Cơ sở: report mẫu `2026-11-16-full-path-resolver/root/task-3-report.md` còn ghi `changes`/`validation` dù nội dung đã có ở commit. Chưa đo.
- [giả định] Quy tắc 14 của `model-routing.md` và mục "Messages between sessions" là chỗ duy nhất cần đổi ở baseline. `AGENTS.md` chỉ có một câu ở "Model and session routing" và có thể giữ nguyên.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: contract kết quả chung cho subagent và phiên (agent_result gọn, dòng aip-report ≤400 ký tự), script result-check.mjs áp 7 luật kiểm đầu ra kèm test, prompt plan-execution trỏ về contract, core bump version và lock
rủi-ro: đổi contract làm vỡ pin test đang ghim agent_result; script parse YAML tay bắt sai report hợp lệ làm session chính giao lại worker oan; sửa prompt reviewer làm rơi trường bắt buộc như spec_verdict hoặc assumption_review
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
