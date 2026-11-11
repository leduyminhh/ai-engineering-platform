# Thiết kế: review soát giả định của implementer và bằng chứng của `Ruling:`
- Ngày: 2026-11-11
- Trạng thái: approved
- Requirement: không có
- Brief: [2026-11-11-process-discernment/brief.md](../2026-11-11-process-discernment/brief.md) (hướng B, người dùng đã chọn)

## Vấn đề và lý do

Brief process-discernment kiểm kê cơ chế aip đang có để soát lập luận của agent. Request này làm hướng B của brief: tăng cường cơ chế
review đã có, không thêm skill mới. Đã đọc trong code (mọi mô tả "hiện tại" dựa vào các điểm này):

- `agent_result` (`core/principles/workflow-output-contract.md`, mục "Agent result") không có chỗ cho giả định thiết kế. Implementer
  chỉ phải gắn `[Unverified]` cho số đo làm ngoài repo (`core/skills/plan-execution/references/prompts/implementer.md`, việc 7). Giả
  định ngầm (đơn vị thời gian, cách làm tròn, ý nghĩa một trường mà brief không nói) chỉ lộ ra khi reviewer tự đoán được từ diff.
- Task review đọc báo cáo implementer "để biết ý định, KHÔNG tin" (`prompts/task-review.md`, đầu vào), so diff với brief bằng
  `spec_verdict`, nhưng không được giao xét giả định nào. Re-review chỉ trả `ADDRESSED`/`NOT ADDRESSED` cho finding cũ (`prompts/re-review.md`).
- `task-loop.md` (mục "Breaker và `Ruling:`") đòi số đo hay thử nghiệm mà một `Ruling:` dựa vào phải tái lập được và "dòng `Ruling:`
  ghi lệnh chạy lại", nhưng không có cú pháp cố định cho lệnh đó và không script nào kiểm. Review cuối nhận các dòng `Ruling:` do
  session chính tự dán (`prompts/final-review.md`, đầu vào) và trả `ruling_review[]` "đúng hay sai", không bị đòi chạy lại gì.
- `ledger.mjs` chỉ kiểm định dạng dòng sự kiện và bằng chứng `red:`/`tests:` của dòng `complete` (`validateLine`); dòng `Ruling:` đi
  qua không kiểm.
- Eval về soát lập luận: chỉ có `evals/workflows/task-review-spec` (thiếu AC1.2, thừa hành vi) và `workflows/review-out-of-scope`.
  Chưa có case nào cho giả định sai của implementer hay `Ruling:` không khớp bằng chứng.

[Inference] Không làm thì giả định sai của implementer chỉ bị bắt khi reviewer tình cờ thấy, và một `Ruling:` viện dẫn "đã đo" hay
"đã có test phủ" đi tới G3 mà không ai chạy lại.

## Quyết định đã chốt

Người dùng chốt (qua brief và session gốc, không hỏi lại):
- **R1** — Làm hướng B, ba việc: `assumptions[]` trong `agent_result` và reviewer xét từng giả định; review cuối kiểm từng `Ruling:` với
  bằng chứng chạy lại được; 2–3 case eval về lập luận, chỉ cấu trúc, không chạy eval tốn model.
- **R2** — Hướng C (skill đọc transcript) hoãn; không đọc chuỗi suy nghĩ hay transcript.

*Quyết định của agent* (người dùng chưa xét riêng; soát và đảo được ở G1):
- **A1** — Định dạng giả định: mỗi mục `{ assumption, basis, if_wrong }`. `basis` là nguồn (`file:line`, mục brief) hoặc `không có`;
  `if_wrong` là hệ quả một vế. Chỉ ghi điều implementer đã chọn mà brief, AC và Interfaces không nói; không chép lại yêu cầu.
- **A2** — Implementer trong vòng task (mọi kind, cả vòng sửa) luôn trả khoá `assumptions`, được phép rỗng. Thiếu khoá là đầu ra hỏng
  (thêm một luật vào "Kiểm đầu ra worker"); rỗng không bị bắt lỗi. Lý do: chỉ đòi có khoá thì kiểm được tất định, đòi "đủ giả định" thì
  không ai kiểm được. Luật chỉ áp khi có `agent_result` do subagent trả: workflow không dùng vòng task, chế độ inline và task `TOOLING`
  do session chính tự làm không bị đòi.
- **A3** — Reviewer task-review trả `assumption_review[]`, mỗi giả định của báo cáo một mục `{ assumption, verdict: holds | wrong |
  unverifiable, evidence }`. `wrong` đi kèm một finding thường: vi phạm AC/brief thì `major` trở lên (luật bước 4 hiện có), còn lại theo
  thang. `unverifiable` kèm điều cần kiểm, session chính xử lý như `cannot_verify` (không đoán). Báo cáo có giả định mà thiếu
  `assumption_review[]`, hoặc số mục khác số giả định, là đầu ra hỏng (luật riêng cho reviewer task-review, cạnh luật `spec_verdict`
  hiện có). Reviewer cũng ghi giả định ngầm tự thấy trong diff mà báo cáo không khai (một finding `minor`
  hoặc cao hơn theo hệ quả), để giả định giấu đi không có lợi hơn giả định khai ra.
- **A4** — Re-review chỉ xét giả định mới trong báo cáo vòng sửa (không xét lại giả định đã xét), trong cùng `assumption_review[]`.
  Giả định `wrong` mức `blocker`/`major` giữ task trong vòng sửa như `new_breakage`.
- **A5** — Giả định `wrong` mà hướng đã duyệt ở G1 dựa vào là loại dừng 6 hiện có (`task-loop.md`): không thêm loại dừng mới, chỉ
  trỏ tới nó.
- **A6** — Cú pháp lệnh chạy lại của `Ruling:` là một phần thứ tư tuỳ chọn: `Ruling: <quyết định> — <lý do> — <chi phí nếu sai> —
  chạy lại: `<lệnh>``. Bắt buộc khi lý do dựa vào số đo, kết quả test hay thử nghiệm; các `Ruling:` khác (cách chạy, chọn hướng) không cần.
- **A7** — Phần tất định đặt ở `ledger.mjs`, không ở `review-package.mjs`: lệnh mới `ledger.mjs <plan.md|requestDir> --rulings` đọc
  mọi `progress.md` của request (`root/` và mọi part, ở gốc repo chính và, khi khác, gốc worktree) và in từng dòng `Ruling:` kèm nguồn
  và cờ. Phần `— chạy lại: `<lệnh>`` cuối dòng được tách trước bằng regex neo cuối dòng (lệnh có ` — ` vẫn đúng), rồi mới đếm phần.
  Cờ `thiếu phần`: ít hơn ba phần ngăn bằng ` — `; mẫu hai phần `Ruling: nhóm <nhãn> chạy tuần tự — <lý do>` của `workflow-feature`
  Bước 4 bị cờ có chủ đích và mẫu đó được sửa thành ba phần trong request này. Cờ `số đo không có lệnh chạy lại`: không có phần
  `chạy lại:` mà dòng có số kèm đơn vị (`ms`, `s`, `giây`, `phút`, `%`, `KB`, `MB`, `GB`, `req/s`), `exit <n>`, hoặc cụm "test xanh",
  "benchmark", "đã đo" có ranh giới chữ (bộ hẹp: không bắt "lần", "pass", "đo" trần để ít báo nhầm). Có `chạy lại:` thì in lệnh.
  Exit 0 kể cả khi có cờ (cảnh báo, giống `check-partition.mjs`); exit 2 khi thiếu đối số, kể cả `ledger.mjs --rulings` một mình.
  `--rulings` rẽ nhánh trước kiểm dòng và trước `ledgerFile`, nên không bao giờ bị ghi thành dòng ledger. Không tạo thư mục `.aip`:
  `workspace.mjs` tách hàm thuần `workspaceDirs(planArg, deps) → { main, top, request, part, plan }`, `resolveWorkspace` gọi lại nó
  và giữ nguyên hành vi. Lý do chọn chỗ này: `review-package.mjs` chạy cho mọi task review, mục Ruling ở đó là
  nhiễu cho task review; lệnh `--rulings` thay luôn việc session chính tự grep và dán `Ruling:` cho review cuối.
- **A8** — `ledger.mjs` không từ chối dòng `Ruling:` khi ghi. Lý do: dòng `Ruling: nhóm <nhãn> chạy tuần tự — <lý do>` của
  `workflow-feature` Bước 4 đang có hai phần theo tài liệu; từ chối lúc ghi sẽ chặn giữa vòng task vì một lỗi định dạng mà review cuối vẫn
  bắt được. Hướng từ chối lúc ghi ghi ở "Đường đã cân nhắc".
- **A9** — Review cuối: session chính dán output của `ledger.mjs --rulings` thay cho các dòng tự grep. Reviewer với mỗi `Ruling:` có
  `chạy lại:` thì chạy lệnh (lệnh chỉ đọc như test/build; lệnh ghi hay tác động ngoài repo thì không chạy, ghi `declined_to_judge`) và
  ghi `rerun: { command, exit_code, matches: true | false }` vào mục `ruling_review[]` của nó. `matches: false` (kết quả bác lý do)
  hoặc cờ `số đo không có lệnh chạy lại` thì Ruling đó gắn nhãn "cần người dùng quyết" và vào thẻ G3; không tự thành finding sửa code.
  Mọi `Ruling:` được đối chiếu lý do với diff/file trong repo; lý do sai với code (vd "AC1.2 đã có test phủ" khi test không kiểm) cũng gắn
  nhãn đó, kèm `file:line`.
- **A10** — Eval: hai case mới dưới `evals/workflows/`, không thêm case cho "bỏ sót AC" vì `task-review-spec` đã phủ:
  (a) `task-review-assumption`: implementer khai giả định `now` tính bằng giây trong khi design nói mili-giây, và test "xanh" chỉ dùng
  đầu vào không lộ sai lệch; grader chấm reviewer bác giả định có bằng chứng và không ghi `Task 1: complete`.
  (b) `final-review-ruling-evidence`: plan đã xong, ledger có hai `Ruling:`: một viện dẫn số đo không có lệnh chạy lại, một nói "AC2.1 đã có
  test phủ" trong khi file test không có ca đó; grader chấm review cuối gắn nhãn cả hai, dẫn `file:line`, và không tuyên bố nhánh sạch.
  Cả hai không có Bash (chạy được trên Windows), `tags` có `reasoning`. README.md/README_VI.md của `evals/` thêm hai hàng "Not yet run [Unverified]".
- **A11** — Chế độ inline không có reviewer thứ hai để xét giả định (`inline.md` đã ghi "không có góc nhìn thứ hai"). Review cuối của
  inline (tự review hay subagent) vẫn đọc `--rulings`: `inline.md` thêm một câu trỏ tới lệnh.
- **A12** — Agent file đồng bộ với prompt: mục "Report trả về" của `backend-implementer`, `frontend-implementer`, `backend-fixer`,
  `frontend-fixer` thêm dòng `assumptions` (trỏ contract); `backend-reviewer`, `frontend-reviewer` thêm `assumption_review[]` ở
  task-review/re-review và `rerun` ở `ruling_review[]` của final-review. Chỉ thêm câu, không viết lại chữ đã pin.
- **A13** — `workflows/feature/WORKFLOW.md`: Bước 4 sửa mẫu `Ruling: nhóm <nhãn> chạy tuần tự — <lý do>` thành ba phần; Bước 6 đầu
  vào và hành động trỏ `ledger.mjs --rulings` và việc chạy lại; Bước 7 nêu Ruling gắn nhãn cần người dùng quyết đứng riêng ở G3.
- **A14** — Version: bump patch `core` (1.33.1), `workflows` (3.16.1), `backend` (1.15.1), `frontend` (1.16.1). `evals/` không ship,
  không bump. `node cli/lib/versions.mjs --lock` sau build.

Đường đã cân nhắc và bị loại:
- Đặt mục `## Ruling cần kiểm` trong `review-package.mjs` (nhiễu cho mọi task review; package không biết ledger part).
- `ledger.mjs` từ chối `Ruling:` thiếu phần hoặc thiếu lệnh chạy lại lúc ghi (chặn vòng task vì định dạng; phải sửa thêm mẫu hai phần
  ở `workflow-feature`/`check-partition`; review cuối vẫn bắt được).
- Đòi `assumptions` không rỗng hoặc tối thiểu N mục (khuyến khích bịa giả định cho đủ; không kiểm được chất lượng).
- Agent thứ ba chỉ chấm giả định (thêm token mỗi task; reviewer task-review đã đọc diff và brief).

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `workflow-output-contract.md` When đọc mục "Agent result" và "Trường mở rộng cho vòng task" Then có khoá `assumptions` với định dạng `{ assumption, basis, if_wrong }` và `assumption_review[]` với `verdict` ∈ {`holds`, `wrong`, `unverifiable`} kèm `evidence`; `ruling_review[]` nêu trường `rerun: { command, exit_code, matches }`
- [ ] **AC1.2** — Given mục "Kiểm đầu ra worker" When implementer (subagent) trong vòng task trả `agent_result` thiếu khoá `assumptions` Then đó là đầu ra hỏng; `assumptions: []` không phải đầu ra hỏng; luật riêng cho reviewer task-review: báo cáo implementer có `assumptions` không rỗng mà `assumption_review[]` thiếu hoặc số mục khác số giả định là đầu ra hỏng
- [ ] **AC1.3** — Given `prompts/implementer.md` When giao task hoặc vòng sửa Then prompt đòi `assumptions` (có thể rỗng), chỉ gồm điều brief/AC/Interfaces không nói, mỗi mục có `basis` và `if_wrong`
- [ ] **AC1.4** — Given `prompts/task-review.md` When review task Then prompt đòi xét từng giả định thành một mục `assumption_review[]`, `wrong` kèm finding theo thang hiện có (vi phạm AC/brief là `major` trở lên), giả định ngầm thấy trong diff mà báo cáo không khai thành finding; `prompts/re-review.md` chỉ xét giả định mới của vòng sửa và `wrong` mức `blocker`/`major` giữ task trong vòng sửa
- [ ] **AC1.5** — Given `task-loop.md` When đọc loại dừng 6 Then nêu giả định `wrong` mà hướng đã duyệt ở G1 dựa vào thuộc loại dừng này; nêu cú pháp `— chạy lại: `<lệnh>`` cho `Ruling:` dựa vào số đo, test hay thử nghiệm
- [ ] **AC2.1** — Given ledger `root/` và ledger part có dòng `Ruling:` When chạy `ledger.mjs <plan.md> --rulings` Then in mọi dòng `Ruling:` của mọi `progress.md` dưới `.aip/runs/<request>/`, mỗi dòng kèm nguồn (`root` hoặc tên part), exit 0
- [ ] **AC2.2** — Given dòng `Ruling: a — b` When `--rulings` Then dòng đó có cờ `thiếu phần`; Given `Ruling: a — b — c` hoặc `Ruling: a — b — c — chạy lại: `x — y`` Then không có cờ `thiếu phần`, và dòng sau in `chạy lại: x — y`
- [ ] **AC2.3** — Given lý do có số đo hay kết quả test (vd `đo 40ms`, `exit 0`, `test xanh`) mà không có phần `chạy lại:` When `--rulings` Then có cờ `số đo không có lệnh chạy lại`; Given cùng dòng có `— chạy lại: `npm test`` Then không có cờ đó và in `chạy lại: npm test`; Given `Ruling: cách chạy subagent — người dùng chọn — mất review` Then không có cờ nào
- [ ] **AC2.4** — Given request chưa có thư mục `.aip/runs/<request>/` When `--rulings` Then in "(không có Ruling)", exit 0, và không tạo thư mục `.aip`; Given `ledger.mjs --rulings` không có đối số plan When chạy Then exit 2 và không ghi ledger nào; Given `ledger.mjs <plan> --rulings` When chạy Then không có dòng `--rulings` nào được ghi vào ledger
- [ ] **AC2.6** — Given `resolveWorkspace` sau khi tách `workspaceDirs` When chạy các test hiện có của workspace/ledger Then vẫn xanh (hành vi không đổi)
- [ ] **AC2.5** — Given ghi dòng `Ruling:` bất kỳ (hai phần, ba phần, có `chạy lại:`) bằng `ledger.mjs <plan> "<dòng>"` When ghi Then vẫn exit 0 như hiện nay (không từ chối lúc ghi)
- [ ] **AC3.1** — Given `prompts/final-review.md` When review cuối Then đầu vào là output của `ledger.mjs --rulings` (không còn "dán nguyên các dòng Ruling:" tự grep); reviewer chạy lệnh `chạy lại:` chỉ đọc và ghi `rerun` vào `ruling_review[]`, lệnh ghi hoặc ngoài repo vào `declined_to_judge[]`; `matches: false`, cờ `số đo không có lệnh chạy lại`, hoặc lý do sai với code đều gắn nhãn cần người dùng quyết kèm `file:line`
- [ ] **AC3.2** — Given `finish.md`, `SKILL.md` của `plan-execution` và `workflows/feature/WORKFLOW.md` Bước 7 When trình G3 Then các `Ruling:` gắn nhãn cần người dùng quyết ở review cuối có trong thẻ G3 (nêu nhãn và lý do), không bị gộp vào `rulings` như Ruling thường
- [ ] **AC3.3** — Given `SKILL.md` bước 3, `task-loop.md` mục "Chế độ part" (bước gom Ruling cho review cuối), `inline.md` (review cuối inline) và `WORKFLOW.md` Bước 6 When gom Ruling cho review cuối Then trỏ tới `ledger.mjs --rulings`; mẫu Ruling ở `WORKFLOW.md` Bước 4 có ba phần
- [ ] **AC3.4** — Given `plugins/{backend,frontend}/agents/*-implementer.md`, `*-fixer.md`, `*-reviewer.md` When đọc mục "Report trả về" Then implementer/fixer nêu `assumptions`, reviewer nêu `assumption_review[]` (task-review, re-review) và `rerun` trong `ruling_review[]` (final-review)
- [ ] **AC4.1** — Given `evals/workflows/task-review-assumption/` và `evals/workflows/final-review-ruling-evidence/` When chạy `test/contract/95-evals.contract.mjs` Then cả hai đạt cấu trúc (prompt.md `runs: 3`, graders/, case.yaml + scaffold.sh), không có Bash trong `allowed_tools`; mỗi case có grader `scaffold-applied` và `skill-used` theo mẫu `task-review-spec` (kiểm thủ công, contract không kiểm tên grader)
- [ ] **AC4.2** — Given `evals/README.md` và `evals/README_VI.md` When đọc bảng "Cases" Then có hai hàng mới, ghi chưa chạy [Unverified] như hàng `review-out-of-scope`
- [ ] **AC5.1** — Given bước gộp When cập nhật spec sống Then `docs/specs/workflows/spec.md` có R24 mới và R1, R2, R7 đổi, mỗi mục có dòng Lịch sử trỏ request này; `check-request.mjs --base master` không báo W10–W14
- [ ] **AC5.2** — Given sau thay đổi When chạy `npm run build`, `node cli/lib/versions.mjs --lock` và `npm test` Then `core` > 1.33.1, `workflows` > 3.16.1, `backend` > 1.15.1, `frontend` > 1.16.1, lock khớp và `npm test` exit 0

## Thiết kế

### `assumptions[]` và `assumption_review[]` (A1–A5)

Contract: thêm `assumptions: []` vào khối `agent_result` (chú thích: implementer trong vòng task; xem "Trường mở rộng"), và hai gạch đầu
dòng ở "Trường mở rộng cho vòng task": `assumptions` (A1, A2) và `assumption_review[]` (A3, A4). "Kiểm đầu ra worker" thêm hai luật
của AC1.2. Prompt implementer: thêm việc 8 (khai giả định) và dòng `assumptions` vào danh sách báo cáo. Prompt task-review: thêm bước
xét giả định giữa phán quyết thứ nhất và thứ hai, và `assumption_review[]` vào khối trả về. Prompt re-review: thêm bước cho giả định
mới. `task-loop.md`: loại dừng 6 thêm vế giả định `wrong` (A5); bước nhận kết quả review xử lý `wrong`/`unverifiable` như finding và
`cannot_verify`.

### `ledger.mjs --rulings` (A6–A8)

Hàm thuần `rulingFlags(line) → { flags: string[], rerun: string | null }` (export để test) và `listRulings(dirs, fsx) → string` (đọc
`*/progress.md` dưới `.aip/runs/<request>/` của `main` và, khi khác, `top`; thứ tự `root` trước rồi part theo tên). `main` của script
rẽ nhánh khi `argv[1] === '--rulings'` trước mọi kiểm dòng. Đường dẫn lấy từ `workspaceDirs` (A7). Định dạng in, mỗi Ruling một khối:

```
- [root] Ruling: hoãn major: … — … — … — chạy lại: `npm test`
  chạy lại: npm test
- [02-api] Ruling: giữ timeout — đo 40ms dưới ngưỡng — chậm khi tải cao
  cờ: số đo không có lệnh chạy lại
```

### Review cuối và G3 (A9)

`final-review.md`: dòng đầu vào Ruling đổi sang output `--rulings`; bước 2 "Xét từng Ruling" thêm việc chạy lại và đối chiếu lý do với
code. `SKILL.md` bước 3 và `finish.md` (bước gom `Ruling:` và chỗ trình G3): Ruling có nhãn cần người dùng quyết đứng riêng trong thẻ G3. `WORKFLOW.md` theo A13.

### Mục đổi (file map)

- `core/principles/workflow-output-contract.md`: Agent result, Trường mở rộng, Kiểm đầu ra worker.
- `core/skills/plan-execution/references/prompts/implementer.md`, `task-review.md`, `re-review.md`, `final-review.md`.
- `core/skills/plan-execution/references/task-loop.md`: loại dừng 6, cú pháp `chạy lại:`, xử lý `assumption_review[]`, bước gom Ruling
  của "Chế độ part".
- `core/skills/plan-execution/references/finish.md`, `references/inline.md`, `SKILL.md` (bước 3, dòng script ở Tham chiếu).
- `core/skills/plan-execution/scripts/ledger.mjs`, `scripts/workspace.mjs` (tách `workspaceDirs`).
- `workflows/feature/WORKFLOW.md` (A13).
- `plugins/backend/agents/backend-implementer.md`, `backend-fixer.md`, `backend-reviewer.md`; `plugins/frontend/agents/frontend-implementer.md`,
  `frontend-fixer.md`, `frontend-reviewer.md` (A12).
- `evals/workflows/task-review-assumption/**`, `evals/workflows/final-review-ruling-evidence/**`, `evals/README.md`, `evals/README_VI.md`.
- Test: pin nội dung mới `test/content/53-reasoning-review.pin.mjs` (AC1.x, AC3.x); test `--rulings` và `workspaceDirs` (AC2.x) ở
  `test/contract/98-ledger-rulings.contract.mjs` (mẫu `97-audit-mustfix.contract.mjs` import `ledger.mjs`); `95-evals.contract.mjs`
  chạy sẵn cho AC4.1. Pin hiện có (`31-workflow-self-sufficient`, `38-scope-discipline`, `43-progress-plan-quality`) không bị đổi: chỉ
  thêm câu, giữ các cụm đã pin (vd "tái lập được từ nhánh").
- Spec sống (bước gộp): `docs/specs/workflows/spec.md`.
- `core/.manifest.json`, `workflows/.manifest.json`, `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`,
  `plugins/_versions.lock.json`.

Không đổi: `review-package.mjs`, `task-brief.mjs`, hook, hành vi ghi dòng của `ledger.mjs`, `graph.json`.

## Ảnh hưởng spec
- workflows: đổi R1, đổi R2, đổi R7, thêm R24

R24 (workflows), viết ở bước gộp: implementer vòng task trả `assumptions[]` (có thể rỗng); task review trả `assumption_review[]`; `Ruling:`
dựa vào số đo/test ghi `— chạy lại: `<lệnh>``; `ledger.mjs --rulings` liệt kê mọi `Ruling:` của request kèm cờ; review cuối chạy lại
lệnh chỉ đọc và đưa Ruling không khớp bằng chứng vào G3.

## Ngoài phạm vi và anti-goal
- Đọc transcript hay chuỗi suy nghĩ (hướng C); hiệu chuẩn `confidence` của finding; xem lại ngưỡng cỡ Nhỏ của ADR-0005; chạy eval tốn model.
- Anti-goal: coi việc có trường `assumptions` là bằng chứng lập luận đúng; để cờ của `--rulings` chặn vòng task; reviewer tự sửa code theo giả định.

## Ràng buộc
- Zero-dependency; `ledger.mjs` chỉ dùng built-in của Node, không import `cli/`.
- `--rulings` chỉ đọc: không tạo `.aip`, không ghi file.
- Không đổi hành vi ghi dòng của `ledger.mjs` (AC2.5) và các test hiện có của nó.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; không `Co-Authored-By`.

## Kiểm thử
- AC1.1–AC1.5, AC3.1–AC3.4: pin nội dung (câu quy tắc chính, không khớp cả đoạn). AC3.1/AC3.2 là phán đoán của reviewer: chỉ pin chữ
  trong prompt, không kiểm được kết quả nếu không chạy eval.
- AC2.1–AC2.6: gọi `rulingFlags`/`main` của `ledger.mjs` và `workspaceDirs` trên repo git tạm (ledger root + part, ledger trống, chưa có
  `.aip`, đối số thiếu); test hiện có của workspace/ledger chạy lại không đổi.
- AC4.1: `95-evals.contract.mjs` + đọc tay grader; AC4.2: đọc tay (bảng README là tài liệu).
- AC5.1: `check-request.mjs --base master`; AC5.2: `npm run build`, `versions.mjs --lock`, `npm test`.
- Không có AC nêu kết quả số cần `calc:`. Hai case eval chưa chạy: chưa có bằng chứng model làm theo prompt mới.

## Builder check (2026-11-11, một vòng, subagent sonnet)
15 điểm, tất cả agent tự quyết và đã đưa vào design: agent file lệch prompt (A12), tách `workspaceDirs` (A7), regex `chạy lại:` neo cuối
dòng và bộ cờ hẹp (A7), `WORKFLOW.md` Bước 4/6/7 và R7 (A13, AC5.1), `inline.md` và bước gom Ruling của "Chế độ part" (AC3.3), tên file
test, cách hiểu "khớp từng mục" (A3), AC4.1 grader kiểm tay, phạm vi luật `assumptions` (A2). Không còn câu cho người dùng ngoài các câu G1.

## Rủi ro và câu hỏi mở
- [Inference] Thêm token mỗi task: một danh sách giả định ngắn cho implementer và một mục xét cho reviewer; chưa đo.
- [Inference] Implementer có thể trả `assumptions: []` cho mọi task; A3 (reviewer ghi giả định ngầm thấy trong diff) là đối trọng, chưa có
  bằng chứng nó đủ; case eval (a) đo được khi người dùng cho chạy.
- [Inference] Cờ `số đo không có lệnh chạy lại` dựa vào regex nên có báo nhầm và bỏ sót; nó chỉ là cảnh báo cho reviewer, không chặn.
- Câu hỏi cho G1: A2 (thiếu khoá `assumptions` là đầu ra hỏng), A7/A8 (kiểm tất định ở `ledger.mjs --rulings`, không từ chối lúc ghi),
  A9 (Ruling không khớp bằng chứng vào G3 chứ không thành finding sửa code), A10 (hai case eval, không thêm case bỏ sót AC).
