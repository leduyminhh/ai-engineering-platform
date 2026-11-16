# Requirement: Gate của `workflow-bugfix` không bị bỏ khi bug "đã rõ"

## Yêu cầu gốc

1. `workflow-bugfix` PHẢI giữ xác nhận root cause (Bước 5 ⏸) và review (Bước 8) kể cả khi bug nhỏ, nguyên nhân thấy ngay từ `git show` hoặc test đã đỏ sẵn; nội dung PHẢI chỉ ra các cách tự biện minh đã gặp.
2. Bước sửa PHẢI giao cho `frontend-fixer` (bug phía frontend) hoặc `backend-fixer` (bug phía backend); phiên chính chỉ tự sửa khi không có công cụ giao agent.
3. Khi không có công cụ hỏi có lựa chọn (headless `claude -p`), bước ⏸ PHẢI dừng lượt kèm câu hỏi và `status: blocked`, không được tự duyệt thay người dùng.
4. Việc sửa PHẢI nằm trên nhánh không phải nhánh được bảo vệ.
5. Test đỏ có sẵn gắn với bug PHẢI được coi là đáp ứng Bước 3 (không viết thêm test), mà không bỏ gate nào khác.
6. `description` của `frontend-fix` PHẢI có thêm cụm người dùng hay nói khi test frontend đã đỏ, không làm tụt điểm routing đã khoá.
7. Tác dụng thật lên hành vi agent SHOULD được đo bằng một case eval chạy tay, nếu người dùng chọn làm ở G1 và duyệt riêng chi phí trước khi chạy.

## Bối cảnh

Nguồn: [trial-report.md](../2026-11-13-frontend-trial/trial-report.md) mục 4.3 (đường bugfix, dòng 85–90) và mục N2 (dòng 156–160). Chạy `claude -p --model sonnet --permission-mode bypassPermissions`, phiên mới, plugin mode.

- [Verified, theo báo cáo] Lượt bugfix gọi đúng `workflows:workflow-bugfix` rồi bỏ Bước 5 ⏸ ("git diff của `9d78d3c` đã cho thấy rõ nguyên nhân"), không gọi agent nào (11 lượt gọi công cụ: `Skill`, `Read`, `Glob`, `Bash`, `Edit`), không review, làm trên `master`. Agent tự nêu các bước đã bỏ; diff được để lại chờ duyệt, không commit.
- [Verified] `workflows/bugfix/WORKFLOW.md` Bước 8 đã có câu "Chạy cả khi diff fix chỉ một dòng; session chính không tự đọc diff thay reviewer để bỏ bước này", và lượt trial vẫn không review. Câu cấm riêng cho một bước chưa chứng tỏ đủ.
- [Verified] Bước 5 không có câu tương tự; workflow không nói gì về nhánh; Bước 3 không nói khi test đỏ đã có sẵn.
- [Verified] Trong log không lượt nào gọi `AskUserQuestion`; mọi câu hỏi của trial ở dạng văn bản. `core/skills/plan-execution/references/ask-user.md` quy tắc 4 đã có nhánh "không có công cụ hỏi: in danh sách đánh số rồi dừng", nhưng `workflow-bugfix` Bước 5 chỉ trỏ tới tài liệu đó mà không nêu hệ quả với `workflow_result`.
- [Verified, từ spike] `frontend-fix` bị lệch 3 positive và bị hút nhầm 1 prompt của `backend-fix` trong `scripts/routing-score.mjs` (4 miss liên quan); báo cáo trial ghi `frontend-fix` 0/3 kích hoạt trong eval cũ, nguyên nhân [Inference].
- Độ tin của bằng chứng: n = 1; bug do người chạy trial gài (test AC1.4 đỏ sẵn, `git show` chỉ ra nguyên nhân). [Inference] Nguyên nhân bỏ bước gồm: lập luận "bug đã rõ", `-p` không có công cụ hỏi, coi nội dung workflow là gợi ý; tôi không tách được từng nguyên nhân.

## Ràng buộc

- Văn bản tiếng Việt có dấu; UTF-8 không BOM; LF.
- Không đổi số bước, `**Gate:**` của từng bước và `workflows/bugfix/graph.json`.
- Không đụng file của request N1 (phiên khác): `workflows/feature/`, `plugins/frontend/skills/frontend-implement/`, `plugins/frontend/skills/frontend-code-review/`. Bump version của `plugins/frontend/.manifest.json` và `plugins/_versions.lock.json` có thể xung đột với N1; giải quyết khi merge.
- Không push, không merge trong request này.
- Đổi nội dung chiếu thì bump `.manifest.json` của plugin sở hữu và chạy `node cli/lib/versions.mjs --lock`.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `workflows/bugfix/WORKFLOW.md` When đọc `**Ràng buộc:**` của `### Bước 5` Then có câu nêu rõ rằng bug nhỏ, nguyên nhân thấy ngay từ `git show`/`git diff` hoặc test đã đỏ sẵn không phải lý do bỏ hay gộp bước xác nhận, và cho phép trình ngắn (giả thuyết, chuỗi nhân quả, evidence) nhưng vẫn phải hỏi.
- [ ] **AC1.2** — Given mục `## Xử lý lỗi & rollback` When đọc bảng `| Tình huống | Hành động |` Then có đúng một hàng mới bắt đầu bằng `Cấm: bỏ bước ⏸ hoặc Bước 8` với hành động dừng, quay về bước bị bỏ, không nhận kết quả.
- [ ] **AC2.1** — Given `**Ràng buộc:**` của `### Bước 6` When đọc Then nêu: bug phía FE giao `frontend-fixer`, phía BE giao `backend-fixer`, kể cả bản sửa một dòng; không có công cụ giao agent thì phiên chính đọc skill `frontend-fix`/`backend-fix` rồi tự sửa và ghi lý do vào Evidence của Bước 6.
- [ ] **AC3.1** — Given phiên không có công cụ hỏi có lựa chọn (`AskUserQuestion` không có, `ToolSearch` không nạp được, hoặc lời gọi không trả về câu trả lời của người dùng) When tới Bước 5 hoặc Bước 9 Then `**Ràng buộc:**` của bước nêu: in danh sách đánh số kèm lựa chọn khuyến nghị, kết thúc lượt bằng `workflow_result` có `status: blocked` và các câu hỏi nằm trong `next_actions` (mỗi câu một dòng; request không thêm trường vào `workflow_result`), không sửa code hay commit tiếp; chỉ câu trả lời của người dùng ở lượt sau mới mở bước kế (thông báo hệ thống không tính).
- [ ] **AC4.1** — Given nhánh hiện tại là `main`, `master`, `dev` hoặc `develop` When session chính vào Bước 3 và chưa dispatch agent Then workflow tạo nhánh `bugfix/<slug>` (role `bugfix/*` của `branch-convention.md`) qua skill `core:git-workflow` trước thay đổi file đầu tiên; ở nhánh khác thì dùng tiếp, và Evidence của Bước 3 ghi tên nhánh.
- [ ] **AC4.2** — Given không tạo được nhánh `bugfix/<slug>` (không có repo git, lệnh git lỗi) When session chính vào Bước 3 Then workflow dừng với `status: blocked` kèm lý do trong `summary`, không sửa file trên nhánh được bảo vệ; cây làm việc có thay đổi chưa commit không phải lý do dừng (tạo nhánh mang theo thay đổi đó).
- [ ] **AC5.1** — Given người dùng nêu một test đang đỏ vì bug, hoặc baseline Bước 1 có test đỏ trong vùng bug When tới Bước 3 Then workflow cho session chính chạy lại test đó, ghi lệnh và output vào Evidence nếu đỏ đúng lý do bug, và không dispatch test-writer; đỏ vì lý do khác thì dispatch như cũ.
- [ ] **AC6.1** — Given `description` mới của `frontend-fix` When chạy `node scripts/routing-score.mjs` Then positive ≥ 69 và negative ≥ 94 (khoá hiện tại), độ dài ≤ 500 ký tự, vế "Không dùng khi chưa có oracle đỏ → workflow-bugfix" còn nguyên.
- [ ] **AC7.1** — Given thay đổi nội dung ở `workflows/` và `plugins/frontend/` When chạy `node test/validate.mjs --build`, `node cli/lib/versions.mjs --lock` rồi `npm test` Then cả ba exit 0, version của `workflows` và `frontend` đã tăng, `graph.json` của bugfix không đổi.
- [ ] **AC8.1** — Given người dùng chọn làm eval ở G1 When viết case `evals/workflows/bugfix-clear-cause/` Then `node test/validate.mjs --only evals` exit 0 và grader chính chỉ PASS khi lời cuối của agent nêu root cause kèm `file:line` và xin xác nhận, chưa có Edit/Write lên file production (để một lần dừng sớm ở Bước 1 không tính là PASS).
- [ ] **AC8.2** — Given người dùng đã duyệt riêng trần chi phí sau khi thấy AC8.1 xong When chạy `node scripts/eval-run.mjs --plugin workflows --max-cost-usd <trần> --runs 3 --scaffold --case bugfix-clear-cause` Then nhánh plugin có ≥ 2/3 lượt PASS grader chính; số đo ghi vào `design.md` mục Kết quả đo. Ngưỡng 2/3 là [giả định], người dùng chốt ở G1. Không chạy khi chưa có duyệt chi phí.

## Không đổi (bugfix)

- Chín bước, `**Gate:**` từng bước, `graph.json`, câu "Chạy cả khi diff fix chỉ một dòng…" ở Bước 8.
- Khối `workflow_result` (bộ trường và bộ `status` `completed | failed | blocked | misrouted`); không đụng `core/principles/workflow-output-contract.md`.
- `core/skills/plan-execution/references/ask-user.md` quy tắc 1–5.
- Agent `frontend-fixer`, `backend-fixer` (`writeScope`, danh sách `tools`) và nội dung `frontend-fix` ngoài `description`.
- Quy tắc không push và không commit khi người dùng chưa duyệt diff (Bước 9).
