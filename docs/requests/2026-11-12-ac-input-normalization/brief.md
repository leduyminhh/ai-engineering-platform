# Brief: chốt ngữ nghĩa chuẩn hoá đầu vào trong AC
- Ngày: 2026-11-12
- Trạng thái: approved

## Vấn đề và loại việc

Skill viết yêu cầu không buộc AC chốt **ngữ nghĩa chuẩn hoá đầu vào** của trường chuỗi ở biên: cắt khoảng trắng đầu/cuối hay giữ nguyên, chuỗi rỗng so với khoá thiếu so với `null`, độ dài đếm theo đơn vị nào (UTF-16, code point, byte), so sánh và khoá duy nhất có phân biệt hoa/thường không. AC im lặng thì người thi hành tự chọn, rồi lệch ở review hoặc phải có ruling của người dùng.

Đây là gap hạng 1 của backlog `docs/requests/2026-11-12-skill-coverage-audit/backlog.md` (trục "mỏng"). Loại việc: thêm nội dung hướng dẫn vào skill của bộ (feature của chính aip). Chỉ lo ngữ nghĩa chuẩn hoá trong AC; hợp đồng nội bộ giữa component (hạng 3) và routing (hạng 2) là request khác.

## Vì sao bây giờ và thành công trông thế nào

Bằng chứng ở nguồn-A (project nguồn của đợt trước): cụm này khớp 12/23 ledger và 8/9 request, đếm bằng regex theo từ khoá, không loại trùng. Chi phí là `[Inference]`: mỗi lần là một ruling hoặc một vòng review; chưa có số đo chi phí riêng cho gap này. Người dùng chọn top 5 gap, mỗi gap một request, và đây là hạng 1.

Thành công, người dùng duyệt qua nội dung skill đã đọc được: khi viết AC cho một trường chuỗi ở biên, quy trình làm rõ nhắc đủ bốn nhóm ca; ca nào code đã đọc trả lời được thì ghi thẳng, ca chưa có thì hỏi kèm mặc định; checklist của spec không cho qua AC còn bỏ trống các nhóm áp dụng. Hiệu quả thật chỉ đo được ở request mới (số ruling và vòng review liên quan); nguồn-A chưa có request mới từ lúc lấy `baseline.json`.

## Goal, non-goal, anti-goal

Goal:

- Bốn nhóm ca chuẩn hoá đầu vào (người dùng chọn đủ bốn): **cắt khoảng trắng** (kể cả chuỗi toàn khoảng trắng và thứ tự cắt so với validate), **rỗng / thiếu khoá / null** (ba trạng thái đối xử giống hay khác; với cập nhật một phần, thiếu khoá là giữ nguyên hay xoá), **đơn vị đếm độ dài** (kèm ví dụ biên), **hoa/thường** (so sánh, khoá duy nhất, lưu bản gốc hay bản đã hạ chữ).
- Hướng dẫn nằm ở phía **viết AC** (người dùng chọn): `clarify-core.md`, `engineering-spec-writing` (elicitation, checklist) và dòng hướng dẫn AC ở template `requirement`.

Non-goal:

- Phía thi hành và review: `backend-implement` (B4, đơn vị độ dài), `robustness-checklist.md`, `backend-code-review`, `frontend-data-integration`. Chưa đọc thân bốn skill sau, và AC đã chốt thì phía sau chỉ cần làm theo.
- Cảnh báo máy mới trong `check-request.mjs` (người dùng chọn không): validator khó biết trường nào là chuỗi, dễ cảnh báo nhầm.
- Chuẩn hoá Unicode (NFC/NFKC) và grapheme: ngoài lần này.
- Đổi `description` của skill hoặc nâng `rank1.lock.json`.
- Hợp đồng nội bộ giữa component (hạng 3) và routing (hạng 2).

Anti-goal:

- Làm tăng số câu hỏi ở thẻ đầu: ca có mặc định dẫn code phải ghi thẳng hoặc gom vào một câu của thẻ, không thêm câu thứ 5.
- Tên request hay đường dẫn máy của project nguồn lọt vào tài liệu commit.
- Phá các pin test và spec sống đang ghi nhóm ca biên (xem Hiện trạng).

## Hiện trạng và tham khảo đã thấy

Đã đọc thân (chỉ đọc) và kết luận `[Verified]`:

- `core/skills/brainstorming/references/clarify-core.md`, mục "Rà ca biên" (dòng 34–47): đúng 5 nhóm cố định (làm tròn, biên dưới/trên, đầu vào rỗng, mốc thời gian, đếm đồng thời); câu mở mục ghi "danh sách cố định, không mở rộng theo domain". Điều kiện kích hoạt là "việc chạm số, tiền, thời gian, bộ đếm hoặc giới hạn", nên một trường chuỗi thuần (tên, mã, email) **không** kích hoạt mục này. Nhóm "đầu vào rỗng" không nói gì về strip, thiếu khoá hay null.
- `plugins/engineering/skills/engineering-spec-writing/SKILL.md`, `references/elicitation.md` nhóm 4 ("input sai, dữ liệu rỗng, trùng"), `references/checklist.md`: AC phải đo được (Given/When/Then, khối `calc:` cho kết quả số). Không dòng nào về strip, hoa/thường, đơn vị đếm.
- `core/skills/artifact-templates/references/requirement.template.md`: chỉ có hướng dẫn `calc:` ở mục AC.
- `plugins/backend/skills/backend-implement/SKILL.md`, `references/use-case-intake.md`: B4 Validation (đọc từ `engineering-task-breakdown/references/task-template-backend.md`) ghi "bắt buộc, kiểu, độ dài, định dạng, miền giá trị"; "độ dài" không nêu đơn vị. `robustness-checklist.md` đặt "trần cho chuỗi", cũng không nêu đơn vị.
- Grep `strip|trim|NFC|code point|case-insensitive|chuẩn hoá…` trên mọi `.md` ở `core/` và `plugins/`: không skill spec/implement nào dạy chốt ngữ nghĩa chuẩn hoá; chỉ có ví dụ `nullif(trim(email))` trong staging của `data-olap-implement` (ngoài phạm vi).

Ràng buộc cho design (cũng `[Verified]` khi đọc file):

- `test/content/38-scope-discipline.pin.mjs:22-24` ghim tên 5 nhóm của "Rà ca biên" bằng `includes`; thêm nhóm không làm đỏ nó nhưng nên cập nhật cho khớp.
- Spec sống `docs/specs/workflows/spec.md` có R17 (làm rõ, rà ca biên) và AC cũ ở `docs/requests/2026-11-02-aip-scope-discipline/design.md` ghi "5 nhóm"; eval `evals/core/brainstorm-reads-code-first/graders/edge-cases-with-defaults.md` cũng ghi "5 nhóm". Design phải khai `## Ảnh hưởng spec` cho R17.
- `workflows/feature/WORKFLOW.md` và `engineering-spec-writing/SKILL.md:67` chỉ trỏ tới mục "Rà ca biên", không chép nội dung, nên sửa ở nguồn duy nhất là đủ.
- Nội dung chiếu đổi thì phải bump version của `core/.manifest.json` và plugin `engineering` (nếu sửa), rồi `node cli/lib/versions.mjs --lock` (theo `CLAUDE.md`).

Chưa xem: thân `backend-code-review`, `backend-testing`, `frontend-data-integration`, `engineering-tdd` (grep từ khoá không khớp nhưng chưa đọc); từng dòng dẫn chứng trong ledger nguồn-A (ghi chú phiên ngoài repo, mang tên request của project ngoài nên không đưa vào đây); chưa có tình huống riêng do người dùng kể (câu mở ở lượt đầu chưa được trả lời).

## Hướng đã cân nhắc

- **A (chọn). Thêm nhóm thứ 6 "chuẩn hoá chuỗi đầu vào" vào "Rà ca biên" của `clarify-core.md`, mở rộng điều kiện kích hoạt sang trường chuỗi ở biên, rồi thêm dòng nhắc ở `elicitation.md`, mục checklist ở `checklist.md` của spec-writing và dòng hướng dẫn AC ở template `requirement`.** Đúng chỗ AC được viết, một nguồn duy nhất cho phần câu hỏi. Đánh đổi: bốn nơi sửa phải đồng bộ, và phải sửa câu "danh sách cố định" cùng các chỗ ghi "5 nhóm".
- **B (loại). Chỉ sửa `clarify-core.md`.** Nhỏ nhất, nhưng checklist của spec không kiểm, nên AC vẫn qua được khi người viết không đi qua mục đó.
- **C (loại). Làm cả phía thi hành (B4, robustness, code-review, frontend-data-integration).** Chặn ở nhiều tầng hơn nhưng rộng, cần đọc thêm bốn thân skill chưa xem; người dùng chọn chỉ phía viết AC.
- **D (loại). Thêm cảnh báo W mới ở `check-request.mjs`.** Bắt được AC bỏ sót nhưng khó biết trường nào là chuỗi, dễ cảnh báo nhầm; người dùng chọn không.

## Quyết định của agent

- Lưu brief ở `docs/requests/2026-11-12-ac-input-normalization/` của repo aip; slug `ac-input-normalization`.
- Chỉ xét trường chuỗi ở biên, cộng khoá thiếu/null cho mọi trường (đơn vị đếm, strip và hoa/thường chỉ áp cho chuỗi). Hướng dẫn nêu rõ để design chốt lại nếu cần.
- Hướng A (thêm nhóm 6 vào "Rà ca biên") là lựa chọn của agent theo khuyến nghị, chưa qua bước đề xuất–chốt riêng: người dùng đã chọn phía viết AC và không validator nhưng chưa xem hướng A so với B.
- Chuẩn hoá Unicode (NFC/NFKC, grapheme) để ngoài lần này.
- Hiệu quả đo bằng số ruling và vòng review liên quan ở request sau (`ledger-metrics.mjs`); kiểm nội dung ở request này bằng pin test và eval do design chọn.
- Câu mở lượt đầu không được trả lời: coi như chưa có tình huống riêng, dựa vào dữ liệu nguồn-A.
- Route: bảng orchestrator không có hàng cho việc sửa nội dung skill (`feature` + `không-code` ra "chưa có quy trình"), nên `ứng-viên-route` để trống. Bước kế gợi ý, làm trong phiên: `engineering-spec-writing` → `engineering-plan-writing` → `plan-execution`, theo checklist của skill dự án `aip-add-content`.
- "Biên" trong điều kiện kích hoạt là mọi đầu vào từ ngoài vào (API, form, import file, CLI); kích hoạt khi yêu cầu chạm trường chuỗi do bên ngoài nhập và được tạo, sửa, so sánh, tìm hoặc dùng làm khoá duy nhất. Design chốt lời văn.
- Nhóm mới là **một nhóm thứ 6** gộp bốn ca con. Câu "danh sách cố định, không mở rộng theo domain" sửa thành cố định, thêm nhóm chỉ khi có bằng chứng xuyên domain; "5 nhóm" đổi thành "6 nhóm" ở pin test, spec sống R17 và grader eval. Design chốt lời văn.
- Mục checklist của spec là mục chặn: AC cho trường chuỗi ở biên phải chốt từng nhóm áp dụng; nhóm không áp dụng ghi "N/A" kèm lý do, theo cách `robustness-checklist.md` đang làm.
- Ca code chưa trả lời thì nêu mặc định kèm `[giả định]` như `clarify-core.md` đã quy định; có bảng mặc định tham khảo chung (vd cắt đầu/cuối, đếm code point) hay không do design quyết.
- Eval: sửa grader cũ cho khớp "6 nhóm"; không thêm eval mới cần chạy tốn tiền model trong request này.
- Bump version: `core/.manifest.json` và `plugins/engineering/.manifest.json` (spec-writing nằm ở engineering), rồi `node cli/lib/versions.mjs --lock`.

## Phần đoán

- [giả định] Nguyên nhân gốc nằm ở chỗ AC im lặng, không phải ở chỗ người thi hành thiếu kiến thức; nguồn-A không cho biết ruling nào xuất phát từ AC thiếu so với từ việc đọc sai AC.
- [giả định] Chi phí mỗi lần là một ruling hoặc vòng review (`[Inference]`, chưa có số đo).
- [giả định] Bốn nhóm ca là đủ cho cụm này; số đếm 12/23 là cụm rộng gộp cả strip, rỗng, đơn vị đếm và hoa/thường, nên không biết nhóm nào chiếm nhiều nhất.
- [giả định] Mở rộng điều kiện kích hoạt sang trường chuỗi không làm thẻ đầu dài thêm đáng kể vì ca nằm trong một câu gom chung.

## Định tuyến
loại-việc: feature
phạm-vi: không-code
đầu-ra-mong-đợi: nội dung skill phía viết AC (clarify-core, engineering-spec-writing, template requirement) buộc chốt bốn nhóm ca chuẩn hoá chuỗi đầu vào, kèm pin test và spec sống cập nhật
rủi-ro: mở rộng nhóm làm lệch pin test, spec sống R17 và eval đang ghi "5 nhóm"; kết luận gap dựa trên số đếm regex ở một project nguồn và chưa có số đo chi phí
ứng-viên-route: []
route-đã-duyệt: chưa-có-quy-trình
