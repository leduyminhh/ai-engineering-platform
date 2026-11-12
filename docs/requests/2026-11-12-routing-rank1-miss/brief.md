# Brief: sửa các cặp skill bị chọn nhầm ở hạng 1
- Ngày: 2026-11-12
- Trạng thái: approved

## Vấn đề và loại việc

Backlog audit (`docs/requests/2026-11-12-skill-coverage-audit/backlog.md`, hạng 2, trục "bắt nhầm") ghi lại rằng prompt
đúng nghĩa của một skill lại rơi sang skill khác ở hạng 1. Đo ngày 2026-11-12 bằng `node scripts/routing-score.mjs`:
positive 149/214 (69%), negative 151/160 (94%), tức 65 positive và 9 negative trượt. Skill đúng không được nạp thì skill
đó coi như không có.

Đây là việc sửa nội dung chiếu (`description` của skill, và câu mẫu trong `test/routing/` khi câu đó sai nhãn), không phải
thêm skill. Request này là request thứ hai trong top 5 của backlog; request hạng 1 (chuẩn hoá đầu vào trong AC) chạy riêng
ở nhánh `claude/brainstorm-ac-normalize-78eb1b`. Request này chỉ lo routing và `description`, không lo thân skill (hạng 1,
3, 5) hay hạ tầng (hạng 4).

## Vì sao bây giờ và thành công trông thế nào

Backlog xếp hạng 2 vì "cao khi xảy ra": skill đúng không được nạp. Đợt `skill-enrichment-from-usage` thêm 3 skill mới
làm điểm tụt dưới khoá (positive 68, negative 93); vòng sửa viết lại câu mẫu mù và đặt khoá lại ở 69/94 (positive 71 → 69).
Còn 65 positive trượt, chưa ai phân loại.

Thành công (người dùng chọn): sửa các cặp bắt nhầm **thật**, không chạy theo điểm. Đo được bằng:

- Có bảng phân loại đủ 74 dòng (65 positive + 9 negative trượt), mỗi dòng có nhãn và lý do dẫn `description` đã đọc.
- Mỗi cặp được sửa có bằng chứng: prompt chuyển từ trượt sang đạt, và **không prompt nào đang đạt tụt** (so danh sách
  hit trước/sau từng thay đổi, chặt hơn so điểm tổng).
- Sàn: positive ≥ 69, negative ≥ 94 ở `test/routing/rank1.lock.json`. Số tụt dưới sàn thì sửa lại thay đổi, không hạ sàn.

## Goal, non-goal, anti-goal

Goal:

- Phân loại từng prompt trượt vào một trong năm nhãn (xem "Hướng đã cân nhắc"), kèm lý do.
- Sửa `description` hoặc câu mẫu ở nhóm có lỗi thật. Tách nhóm skill meta (`using-aip`, `aip-status`) trong phân loại.
- Mỗi `.manifest.json` có `description` đổi thì bump version, chạy `node cli/lib/versions.mjs --lock`; `npm test` xanh.

Non-goal:

- Nâng `rank1.lock.json` trong request này (làm sau, chỉ khi số đo thật tăng). Hạ sàn.
- Thêm lớp prompt "competing" hay thước đo mới cho `test/routing/`: chưa thêm, quyết ở design khi đã biết bao nhiêu miss là
  "cả hai skill cùng đúng".
- Sửa `scripts/routing-score.mjs`, sửa thân `SKILL.md`, thêm skill mới.
- Prompt mà không skill nào đúng (negative kiểu "Dựng cụm Consul và Vault bằng docker-compose"): đó là gap "thiếu" (hạng
  4, 13), chuyển cho request đó, không sửa ở đây.

Anti-goal:

- Chép nguyên cụm prompt mẫu vào `description` để đạt điểm (đợt trước đã bỏ cụm kiểu này).
- Xoá câu mẫu đang trượt để nâng điểm (review package bắt hành vi này; thay câu thì được).
- Thu hẹp `using-aip` làm mất trigger "bắt đầu mọi hội thoại" đang dùng.
- Skill dính tên riêng của project nguồn; `description` quá 1024 ký tự; bỏ vế "Không dùng khi → id".

## Hiện trạng và tham khảo đã thấy

Đã xem (số và đoạn trích đều từ script hoặc file đọc trực tiếp, `[Verified]`):

- `scripts/routing-score.mjs`: chấm bằng TF-IDF cosine trên `description` của mọi id published; **bỏ phần "Không dùng
  khi"** (`routable`). Hệ quả: vế "Không dùng khi → id" là cách `description` hiện giải các cặp chồng nhau, nhưng thước đo
  không thấy nó, nên không đo được hiệu quả của việc thêm vế đó. Đây là thước tất định, không phải model thật.
- Hạng thật của skill đúng trong 65 positive trượt: 23 ở hạng 2, 10 ở hạng 3, 9 ở hạng 4–5, 23 ở hạng 6 trở xuống.
  Chênh điểm với hạng 1: trung vị 0,033; 42/65 có chênh dưới 0,05. `[Inference]` phần lớn là nhiễu từ vựng, chưa chắc là chọn
  sai; phần hạng 6 trở xuống mới đáng nghi là thiếu từ trong `description`.
- Skill hút nhiều nhất ở hạng 1 sai (positive): `aip-status` 6, `using-aip` 6, `backend-fix` 5, `workflow-performance` 4,
  `engineering-debugging` 4, `engineering-tdd` 3, `engineering-writing-style` 3, `workflow-bugfix` 3. Dòng "hạng 1 sai nhiều
  nhất" của backlog bỏ sót `backend-fix` và `workflow-performance`; số ở đây thay cho dòng đó.
- Đã đọc `description` của: `aip-status`, `using-aip`, `engineering-debugging`, `workflow-bugfix`, `engineering-tdd`,
  `engineering-writing-style`, `backend-fix`, `frontend-fix`, `backend-testing`, `frontend-testing`, `backend-performance`,
  `frontend-performance`, `workflow-performance`, `backend-api-contract`, `frontend-data-integration`,
  `backend-code-review`, `frontend-code-review`, `ops-observability`, `engineering-spec-backfill`, `backend-llm-integration`.
  Ba nhận xét `[Verified]` từ phần đọc đó:
  - `backend-fix` và `frontend-fix` (và hai skill `*-testing`, `*-code-review`) có `description` cùng khuôn, chỉ khác
    chữ stack (Java/Python so với React/TypeScript). Một số câu mẫu không nêu stack, ví dụ "Finding bảo mật đã xác nhận
    rồi, vá đúng chỗ đó thôi, không refactor lung tung": cả hai skill đều đúng.
  - `workflow-bugfix` có sẵn "debug", "sai kết quả", "dán stacktrace"; `engineering-debugging` được kỳ vọng nhận cùng loại
    prompt. Chồng này có chủ đích ở mức `description`; ranh giới thật nằm ở vế "Không dùng khi".
  - `workflow-performance` nêu "benchmark trước/sau cùng điều kiện" trong khi câu mẫu của `backend-performance` ("Sau khi
    tối ưu, chạy lại benchmark cùng điều kiện cũ") nói đúng việc đó. `[Inference]` câu mẫu này có thể sai nhãn.
- Đợt trước (`docs/requests/2026-11-11-skill-enrichment-from-usage/design.md`, mục Ruling và "Ngoài phạm vi"): sau khi 3
  skill mới làm tụt, người dùng chốt viết lại dữ liệu routing mù và bỏ cụm chép đề khỏi `description`, đặt khoá theo số đo
  thật (positive 71 → 69, negative 94). Sửa `description` của skill cũ để nâng điểm routing nằm trong danh sách ngoài phạm
  vi của đợt đó, nên request này là lần đầu động tới `description` skill cũ vì routing.
- Contract `56` (`test/contract/56-routing-score.contract.mjs`): số đo không được tụt dưới khoá; `findWeakening` (review
  package) bắt xoá câu mẫu mà không thay.

Chưa xem:

- Chưa đọc `description` đầy đủ của `ops-incident-troubleshooting`, `git-workflow`, `git-release`, `plan-execution`,
  `engineering-plan-writing`, `engineering-spec-writing` và các skill còn lại trong 65 dòng; phải đọc khi phân loại.
- Chưa chạy eval model thật (`scripts/eval-run.mjs`, tốn tiền): chưa biết routing thật của các cặp này có sai hay không.
- Không có số prompt người dùng gõ thật bị nạp nhầm; câu mẫu do chính repo viết mù. Mức đại diện của điểm đo cho dùng thật
  là `[Inference]`.

## Hướng đã cân nhắc

- **A (chọn). Phân loại trước, rồi sửa nhóm có lỗi thật.** Lập `classification.md` trong thư mục request: mỗi prompt trượt
  một dòng gồm skill đúng, skill hạng 1, hạng thật của skill đúng, nhãn, lý do. Năm nhãn:
  - **N** nhiễu từ vựng (skill hạng 1 không có quyền nhận prompt; skill đúng thiếu từ chung với prompt);
  - **C** cả hai skill cùng đúng (chồng có chủ đích);
  - **P** câu mẫu thiếu tín hiệu hoặc sai nhãn (sửa bằng thay câu);
  - **D** `description` thiếu từ hoặc ranh giới mờ (sửa `description`);
  - **T** thiếu skill (chuyển request khác).
  Chỉ sửa D và P. N chỉ sửa khi cùng một nguyên nhân gốc, như nhóm `aip-status`; C ghi lại và để design quyết có cần lớp
  competing không. Đánh đổi: tốn một bước đọc 74 dòng trước khi sửa; đổi lại điểm không còn là mục tiêu và ít nguy cơ sửa
  theo thước TF-IDF.
- **B (loại). Nâng điểm trực tiếp trên bộ hiện có.** Đặt mục tiêu số rồi chỉnh `description`. Nhanh nhưng người dùng đã chọn
  không chạy theo điểm; `[Inference]` dễ tối ưu cho TF-IDF thay vì model thật, đúng điều đợt trước đã tránh.
- **C (loại, có thể quay lại ở design). Chạy eval model thật trước để biết cặp nào sai thật.** Chính xác hơn, nhưng tốn tiền
  model và `evals/` chỉ phủ vài case. Nếu người dùng cho ngân sách, design có thể thêm một lượt eval nhỏ cho đúng các cặp
  sắp sửa.

## Quyết định của agent

- Chia nhóm skill meta thành một nhóm riêng khi phân loại; `using-aip` giữ `description` rộng (người dùng đã chốt), chỉ xem
  lại `aip-status`. Đã chốt với người dùng: không phải quyết định của agent.
- Chọn hướng A trong ba hướng trên và năm nhãn phân loại: do agent đề xuất, người dùng chỉ chốt mục tiêu, sàn, nhóm meta và
  chưa thêm lớp competing.
- Tiêu chí "không prompt đang đạt nào tụt" đặt chặt hơn điểm tổng; do agent đề xuất vì điểm tổng có thể đứng yên khi một
  prompt lên một prompt xuống.
- Lưu `classification.md` cạnh brief, trong `docs/requests/2026-11-12-routing-rank1-miss/`; không tạo thước đo mới.
- Phạm vi `code-be` theo tiền lệ request 2026-11-11: phần code là tooling Node và dữ liệu JSON của aip, phần còn lại là
  Markdown; không gọi agent backend Java/Spring. Đã thử `route.mjs` với phương án khác: `feature/không-code` ra "chưa có quy
  trình", `bug/code-be` ra `workflow-bugfix` (quy trình đó đòi tái hiện bằng test đỏ, không hợp việc sửa `description`).
  Giữ `feature/code-be`; người dùng ghi đè được ở thẻ duyệt.
- Xong khi nào: `classification.md` đủ 74 dòng cộng đo lại số nền đã đủ để request xong, kể cả khi không có dòng D/P nào cần
  sửa. Không ép ra sửa để có "kết quả"; nhóm N, C, T chỉ ghi lại.
- Gán nhãn: agent đọc `description` đầy đủ của cả skill đúng lẫn skill hạng 1 (kể cả vế "Không dùng khi", thứ model thật
  thấy mà thước không thấy) rồi ghi lý do kèm câu trích ngắn; nhãn C khi cả hai `description` đều nêu việc của prompt.
  Bảng là phán đoán `[Inference]`, người dùng soát ở design; nhãn D chỉ đặt khi `description` thật sự không nêu ý chính của
  prompt.
- Vế "Không dùng khi → id": thước không chấm nên không chứng minh được hiệu quả. Chỉ sửa vế này khi phân loại cho thấy
  con trỏ sai hoặc thiếu, và ghi hiệu quả là `[Unverified]` (không tính vào "prompt chuyển từ trượt sang đạt").
- Eval model thật: không chạy trong request này, trừ khi người dùng cấp ngân sách cụ thể ở design.
- Thay câu mẫu (nhãn P): câu mới do subagent mù viết, không cho xem điểm hay hạng 1; lý do sai nhãn của câu cũ ghi ở
  `classification.md`; không thay quá một nửa số câu của một skill.
- Hạng 1 là nhóm cả hai trục: "không prompt đạt nào tụt" tính cả negative lẫn positive; khoá cũng fail khi một trục tụt
  (`lockDecision`). Sửa một bên làm bên kia tụt thì không sửa và ghi vào bảng. Trong 9 negative trượt, dùng cùng năm nhãn;
  hai prompt kiểu "Dựng cụm Consul và Vault bằng docker-compose" thuộc T.
- Thứ tự với các request khác trong top 5: đo lại số nền ngay trước khi sửa; xung đột `plugins/_versions.lock.json` khi merge
  giải bằng build lại rồi `versions.mjs --lock`; thứ tự merge do người dùng quyết.

## Phần đoán

- [giả định] Phần lớn 65 trượt là nhóm N hoặc C, không phải D; nên số `description` thật sự phải sửa nhỏ.
- [giả định] Sửa `description` của `aip-status` (thêm tín hiệu như "aip status", "ledger", "part") đủ để bỏ phần lớn prompt
  bị hút; chưa kiểm token nào của prompt kéo về `aip-status`.
- [giả định] Nếu nhóm C lớn, design sẽ thấy thước hiện có phạt việc đúng; khi đó mới cân nhắc lớp competing.
- [giả định] Tập chấm hiện có 53 id; thêm hoặc bỏ skill published giữa chừng (kể cả ở request khác trong top 5) đổi số đo
  nền, nên đo lại số nền ngay trước khi sửa.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: bảng phân loại 74 prompt trượt và các sửa description hoặc câu mẫu ở nhóm có lỗi thật, giữ sàn 69/94
rủi-ro: sửa description theo thước TF-IDF làm model thật chọn tệ hơn; sửa một cặp làm prompt của skill khác rơi khỏi hạng 1; đổi description mà quên bump version
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
