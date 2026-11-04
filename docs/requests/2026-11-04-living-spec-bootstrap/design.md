# Thiết kế: spec sống không bị kẹt ở project chưa có spec, dựng spec đầu bằng backfill
- Ngày: 2026-11-04
- Trạng thái: approved — người dùng duyệt G1 ngày 2026-11-04, giữ 6 quyết định của agent
- Requirement: không có
## Vấn đề và lý do
Spec sống (`docs/specs/<năng-lực>/spec.md`) chỉ được tạo ở bước gộp của một request, và bước đó bị bỏ qua khi design ghi `Không ảnh hưởng`. Ở project chưa có `docs/specs/` thì agent ghi đúng câu đó, nên spec đầu tiên không bao giờ ra đời. Repo aip này có 7 spec chỉ nhờ một lần backfill viết tay ngày 2026-10-23 (`docs/specs/README.md`).

Bằng chứng (session chính đo bằng `ls`/`grep` ngày 2026-11-04 trên máy người dùng):
- `E:\Mine\Project\content-automation-platform`: 25 request, 21 `design.md`, không có `docs/specs/`. 15 design từ `2026-10-21-p1-3` trở đi đều ghi `## Ảnh hưởng spec` = `Không ảnh hưởng`, 14 trong số đó với lý do "repo chưa có docs/specs/". Còn lại `calc: 21 - 15 = 6` design cũ không có mục này. Không design nào có token trạng thái `merged`; dòng trạng thái là chữ tự do ("Đã duyệt (người dùng…", "Đã hiện thực, đã merge…") nên W15 lẽ ra báo nhưng không ai chạy hay sửa.
- `E:\Mine\AI\ai-telegram-claude-bot`: 3 request, không có `docs/specs/`; mục "Ảnh hưởng spec" rỗng hoặc bị thay bằng bảng tự chế.

Nguyên nhân gốc là một vòng lặp, mỗi mắt xích đã đọc trong code:
1. `plugins/engineering/skills/engineering-spec-writing/` không nhắc `docs/specs` hay `Ảnh hưởng spec`, nên agent điền `Không ảnh hưởng: chưa có spec`.
2. `check-request.mjs` W10 chỉ đòi lý do không rỗng (`core/skills/artifact-templates/scripts/check-request.mjs`, khoảng dòng 345–346), nên câu đó qua.
3. `core/skills/plan-execution/references/finish.md` bước 2 bỏ qua khi design ghi "Không ảnh hưởng".
4. Với năng lực mới, bước 2 chỉ nói "thêm vào `docs/specs/README.md`", không nói tạo `spec.md` từ `core/skills/artifact-templates/references/spec.template.md`, và `aip init --full` (`cli/lib/init.mjs`, nguồn `templates/init/`) không tạo `docs/specs/README.md`. Chỉ `workflows/feature/WORKFLOW.md` (Bước 7) có bước spec sống.

Hai lỗ hổng phụ:
- Trạng thái request kẹt `approved`: `finish.md` chỉ đặt `merged <hash>` khi aip tự merge local (khoảng dòng 31 và 59). Chọn "giữ nguyên" hoặc "push + PR" rồi người merge tay hay qua PR thì không ai đổi trạng thái.
- Không chức năng nào đọc source để dựng spec ban đầu cho project đã có code, nên chặn vòng lặp một mình chỉ làm spec mọc dần từ request mới, các năng lực có sẵn vẫn trắng.
## Quyết định đã chốt
Người dùng chốt (session chính, 2026-11-04), không bàn lại:

**A. Chặn vòng lặp.**
1. **A1.** `engineering-spec-writing` thêm bước điền `## Ảnh hưởng spec`: đọc `docs/specs/README.md`; năng lực chưa có spec thì khai `- <năng-lực>: thêm R1…`; "chưa có spec" không phải lý do hợp lệ cho `Không ảnh hưởng`.
2. **A2.** `check-request.mjs` thêm cảnh báo **W23** khi design ghi `Không ảnh hưởng` mà `docs/specs/README.md` (theo `specsDir` mà `check-request` đang dùng) không tồn tại. Thông điệp gợi ý chạy skill `engineering-spec-backfill` hoặc khai năng lực mới. Điều kiện dựa vào việc file có tồn tại, không so chữ lý do. Chỉ áp cho thư mục request mà W10 kiểm (miễn legacy như W10). Vẫn chỉ cảnh báo.
3. **A3.** `finish.md` bước 2: năng lực chưa có `spec.md` thì tạo từ `spec.template.md`; chưa có `docs/specs/README.md` thì tạo (bảng năng lực + bản đồ docs). Ghi trạng thái ở mọi lựa chọn G3: merge local → `merged <hash>`; push + PR → `in-progress — PR <link hoặc nhánh>`; giữ nguyên → `in-progress — nhánh <tên>`; kèm hướng dẫn "khi merge tay sau này, đặt `merged <hash>`".
4. **A4.** `templates/init/docs/specs/README.md` để `aip init --full` tạo sẵn (không ghi đè file có sẵn, đúng hành vi init hiện tại).

**B. Skill mới `engineering-spec-backfill`** trong plugin `engineering`:
1. Kiểm kê nguồn từ rẻ đến đắt: docs có sẵn (ARD, overview, docs project, ADR `docs/decisions/`, contracts) → `design.md` của request đã hiện thực → điểm vào code (API/route, job/worker, schema) → tên test.
2. Đề xuất danh sách năng lực **theo nghiệp vụ** (không theo module/package): tên kebab, mục đích, Gồm/Không gồm, thư mục nguồn, request liên quan. **Cổng người duyệt** (gộp, tách, đổi tên).
3. Mỗi năng lực một subagent, chỉ đọc code, chỉ ghi spec của năng lực đó. Mỗi `R<n>` là một câu hành vi đo được có `Nguồn:` bắt buộc: design đã merge → link request; chỉ có code và test → `file:line` + tên test; chỉ suy từ code → `[Unverified]`; design lệch code → theo code, ghi "lệch: <request>"; mơ hồ → mục "Câu hỏi mở", không thành R; request chưa merge không vào spec.
4. Ghi `docs/specs/README.md` (bảng năng lực + bản đồ docs + dòng lệnh `aip status --requests`) và từng spec, bảng Lịch sử có dòng "backfill <ngày>".
5. Kiểm W14 của `check-request` trên spec và kiểm mọi `file:line` được trích dẫn tồn tại.
6. Cổng người duyệt diff `docs/specs/`, commit qua `git-workflow` trên nhánh.
7. Chạy lại trên repo đã có `docs/specs/`: **chỉ báo lệch** (R không còn đúng, hành vi chưa có R), không ghi spec.
8. Không sửa code; chỉ ghi trong `docs/specs/`.

**C. `docs/specs/README.md` là điểm vào duy nhất.** Gồm bảng năng lực, bản đồ docs (làm gì → specs; cấu trúc → ARD/overview; vì sao → decisions; giao tiếp → contracts; vận hành → runbooks; đang làm → lệnh), và request đang mở chỉ ghi **lệnh**, không bảng. Lệnh mới `aip status --requests` (chỉ đọc, hỗ trợ `--json`): liệt kê request trong `docs/requests/` có token trạng thái khác `merged`/`abandoned` (thiếu dòng hoặc không hợp lệ thì hiện "không rõ"), đánh dấu "nghi đã merge" khi nhánh `feature/<slug>` tồn tại và là tổ tiên của HEAD (`git merge-base --is-ancestor`); lỗi git thì không đánh dấu, không ném lỗi. `docs/specs/README.md` của repo này đổi sang dạng mới.

Hướng đã cân nhắc và bị loại:

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| 1. Bảng request đang mở do script ghi vào README giữa marker | README luôn có danh sách | Phải nhớ chạy lại script, bảng lệch ngay khi quên; thêm một nguồn sự thật thứ hai cho trạng thái | Loại (người dùng chọn chỉ ghi lệnh) |
| 2. Chuyển request đã merge vào `_archive/` hoặc xoá | Giảm số thư mục trong `docs/requests/` | Gãy link trong bảng Lịch sử của spec (link tương đối tới `requests/<ngày>-<slug>/`); không giảm việc đọc vì người đọc đi từ README | Loại |
| 3. W10 so chữ lý do "chưa có spec" | Bắt đúng câu hiện thời | Giòn: đổi chữ là qua; không bắt được lý do khác cùng gốc | Loại (A2 dựa vào file có tồn tại) |
| 4. Backfill chạy lại tự thêm R cho hành vi chưa có R | Spec luôn đuổi kịp code | Người không duyệt từng lần thì R mới không qua cổng; dễ ghi đè câu chữ đã duyệt | Loại (người dùng chọn chỉ báo lệch) |
| 5. W23 thành lỗi (exit 1 mặc định) thay vì cảnh báo | Chặn cứng | Phá R5 của `artifact-templates` (cảnh báo exit 0 trừ `--strict`); project chưa muốn spec bị chặn | Loại (quyết định của agent) |
| 6. `aip init --full` tự chạy backfill | Spec có ngay sau init | aip không gọi model; backfill cần cổng duyệt năng lực và diff | Loại (quyết định của agent) |

**Quyết định của agent** (người dùng duyệt ở bước duyệt design):
1. **Chia năng lực theo spec hiện có.** Skill backfill và `README` của specs thuộc `artifact-templates` (R16, R17), vì chúng là quy ước tạo và tìm spec sống, đã nằm ở đó (R3, R7, R14). W23 cũng ở đó (R15). Hành vi của `finish.md` và của skill `engineering-spec-writing` thuộc `workflows` (R18, R19), vì spec đó đã phủ `workflow-feature` Bước 2–3 (R17) và `plan-execution` (R7, R14). `aip status --requests` thuộc `cli-wizard` (R9, cạnh R7 của `aip status`). `aip init --full` tạo README là `đổi R3` của `artifact-templates` (R3 đã liệt kê file `init --full` sinh). Không tạo năng lực mới, vì W11 sẽ báo năng lực chưa có spec.
2. **Cờ vào `checkRequest`.** W23 nhận tham số mới `specsIndex` (boolean) trong `opts`; không truyền thì không W23, nên các lời gọi cũ (và test cũ) giữ nguyên kết quả. `main()` của script tính `specsIndex` bằng `fs.existsSync(path.join(specsDir, 'README.md'))`.
3. **Trạng thái khi push + PR.** Ghi `in-progress — PR nhánh <tên nhánh feature>` ở một commit docs trước khi push; không push lần hai chỉ để chèn link PR. Có link sẵn trước khi push (hiếm) thì ghi link.
4. **`--requests` đứng một mình.** Kết hợp với `<request>`, `--html`, `--watch` hoặc `--part` thì in lỗi và thoát mã 2; chỉ `--json` được đi kèm.
5. **Quét `docs/requests/` bỏ qua** thư mục `_TEMPLATE` và mọi mục không phải thư mục; thư mục không có `design.md` (chỉ có `requirement.md` hoặc `brief.md`) hiện "không rõ".
6. **Subagent backfill dùng `general-purpose`**, không thêm agent mới có `writeScope`. Phạm vi ghi do prompt giới hạn và do bước kiểm cuối (mọi file đổi nằm dưới `docs/specs/`), vì `writeScope` chỉ chặn công cụ ghi, không chặn Bash.
## Tiêu chí chấp nhận
Mọi ca test dùng thư mục tạm; không `rm -rf` sandbox có junction, dọn bằng `fs.rmSync`.

**Chặn vòng lặp ở khâu viết design (R1).**
- [ ] **AC1.1** — Given skill `engineering-spec-writing` sau thay đổi When đọc bước viết `design.md` Then có bước điền `## Ảnh hưởng spec` nêu ba điều: đọc `docs/specs/README.md` trước; năng lực chưa có spec thì khai `- <năng-lực>: thêm R1`; "repo chưa có spec" không phải lý do hợp lệ cho `Không ảnh hưởng`.

**W23 (R2).**
- [ ] **AC2.1** — Given design của thư mục request đặt tên `<yyyy-mm-dd>-<slug>` từ 2026-10-21 trở đi, có `Không ảnh hưởng: <lý do không rỗng>`, và `checkRequest` nhận `specsIndex: false` When chạy Then đúng một cảnh báo `W23` tại dòng của mục "Ảnh hưởng spec", thông điệp nêu `engineering-spec-backfill` và cách khai năng lực mới.
- [ ] **AC2.2** — Given cùng design When `specsIndex: true`, hoặc design dùng `- <năng-lực>: thêm R<n>` thay cho `Không ảnh hưởng` (kể cả `specsIndex: false`) Then không có W23.
- [ ] **AC2.3** — Given `specsIndex: false` và các lý do khác nhau (gồm chữ không nhắc "spec") When chạy Then W23 vẫn báo cho mọi lý do; và `specsIndex: true` thì không lý do nào bị W23 (điều kiện không phụ thuộc chữ).
- [ ] **AC2.4** — Given thư mục request cũ (trước 2026-10-21 hoặc không có tiền tố ngày), hoặc lời gọi không truyền `specsIndex` When chạy Then không W23; và chạy CLI `check-request.mjs` trên thư mục thật không có `docs/specs/README.md` thì in W23 với exit 0 (exit 1 chỉ khi `--strict`).

**`finish.md`: spec đầu tiên và trạng thái (R3).**
- [ ] **AC3.1** — Given design khai năng lực chưa có `docs/specs/<năng-lực>/spec.md` When `finish.md` bước "Cập nhật spec sống" Then bước nói tạo `spec.md` từ `spec.template.md` (bỏ khối `<!-- artifact-template -->`, có bảng Lịch sử), và khi chưa có `docs/specs/README.md` thì tạo nó theo mẫu của `templates/init/docs/specs/README.md` rồi thêm dòng năng lực.
- [ ] **AC3.2** — Given người dùng chọn "push + PR" ở G3 When `finish.md` hướng dẫn ghi nhận Then `design.md` được đặt `Trạng thái: in-progress — PR …` (có nhánh hoặc link) trong một commit docs trước khi push.
- [ ] **AC3.3** — Given người dùng chọn "giữ nguyên" ở G3 When `finish.md` hướng dẫn ghi nhận Then `design.md` được đặt `Trạng thái: in-progress — nhánh <tên>` trong một commit docs trên nhánh feature, và đường merge local vẫn đặt `merged <hash>` như hiện tại.
- [ ] **AC3.4** — Given kết quả cuối (`workflow_result` hoặc báo cáo G3) của lựa chọn push + PR hoặc giữ nguyên When đọc Then có dòng nhắc người merge tay hoặc qua PR sau này đặt `Trạng thái: merged <hash>` và xoá `plan.md` (W16).

**`aip init --full` tạo `docs/specs/README.md` (R4).**
- [ ] **AC4.1** — Given thư mục chưa có `docs/specs/README.md` When `init({root, full: true})` Then file được tạo từ `templates/init/docs/specs/README.md`, nằm trong `created`, có ba phần (bảng năng lực, bản đồ docs, lệnh `aip status --requests`) và không có bảng request đang mở.
- [ ] **AC4.2** — Given `docs/specs/README.md` đã có nội dung khác When `init({root, full: true})` Then file không đổi byte và nằm trong `skipped`; `init` không `--full` không tạo file này.

**Skill `engineering-spec-backfill` (R5).**
- [ ] **AC5.1** — Given plugin `engineering` sau thay đổi When `npm run build` và `node test/validate.mjs --build` Then skill được nạp và qua mọi contract (frontmatter hợp lệ, có `## Quy trình…` và `## Ranh giới an toàn…`, description theo mẫu Phase 1 ≤ 500 ký tự, không trùng trigger của skill khác) và `plugins/engineering/.manifest.json` mô tả đúng số skill.
- [ ] **AC5.2** — Given project có code nhưng không có `docs/specs/` When skill chạy bước kiểm kê và đề xuất Then trả danh sách năng lực theo nghiệp vụ (tên kebab, mục đích, Gồm/Không gồm, thư mục nguồn, request liên quan) và dừng chờ người dùng duyệt, chưa ghi file nào và chưa tạo subagent.
- [ ] **AC5.3** — Given danh sách đã duyệt When skill giao việc Then mỗi năng lực một subagent chỉ đọc code và chỉ ghi `docs/specs/<năng-lực>/spec.md` của năng lực đó; mỗi `R<n>` trong spec ghi ra là một câu hành vi đo được có `Nguồn:`, thuộc đúng một trong bốn loại (link request đã merge; `file:line` + tên test; `[Unverified]`; "lệch: <request>"); điều mơ hồ nằm ở mục "Câu hỏi mở", không thành R; request chưa `merged` không là nguồn.
- [ ] **AC5.4** — Given spec vừa ghi When bước kiểm Then `check-request.mjs` không báo W14 cho spec, và mọi `file:line` được trích dẫn trỏ tới file có thật với dòng nằm trong file; trích dẫn hỏng thì bị sửa hoặc chuyển thành `[Unverified]` trước cổng duyệt.
- [ ] **AC5.5** — Given repo đã có `docs/specs/` When chạy lại skill Then đầu ra là báo cáo lệch gồm hai nhóm (R không còn đúng với code; hành vi chưa có R) và `git status --porcelain docs/specs/` rỗng sau lần chạy.
- [ ] **AC5.6** — Given lần chạy ghi spec When người dùng duyệt diff `docs/specs/` Then mọi file đổi (`git diff --name-only`) nằm dưới `docs/specs/`, không file mã nguồn nào đổi, và commit đi qua `core:git-workflow` trên nhánh không protected.

**`aip status --requests` (R6).**
- [ ] **AC6.1** — Given `docs/requests/` có request mang token `draft`, `approved`, `in-progress`, `merged`, `abandoned`, một request thiếu dòng "- Trạng thái:", một request token lạ, một thư mục chỉ có `requirement.md`, và `_TEMPLATE` When `aip status --requests` Then liệt kê đúng các request `draft`, `approved`, `in-progress` cùng ba ca "không rõ"; không có `merged`, `abandoned`, `_TEMPLATE`.
- [ ] **AC6.2** — Given request `approved` có `<slug>` và git trả thành công cho `git merge-base --is-ancestor feature/<slug> HEAD` When `aip status --requests` Then dòng của request có "nghi đã merge"; nhánh không tồn tại, hoặc không là tổ tiên của HEAD, thì không có dấu đó.
- [ ] **AC6.3** — Given git ném lỗi (không phải repo, hết thời gian, lệnh không chạy được) When `aip status --requests` Then không ném lỗi, không dòng nào có "nghi đã merge", danh sách request vẫn in, exit 0.
- [ ] **AC6.4** — Given `aip status --requests --json` When đọc stdout Then là một JSON parse được, mỗi phần tử có tên request, token trạng thái (hoặc `null`), và cờ nghi đã merge; không file nào được tạo hay sửa. Kết hợp `--requests` với `<request>`, `--html`, `--watch` hoặc `--part` thì exit 2 kèm thông báo.
- [ ] **AC6.5** — Given không có `docs/requests/` hoặc không request nào đang mở When `aip status --requests` Then in một dòng nói không có request đang mở và exit 0.

**`docs/specs/README.md` dạng mới và bản đồ docs (R7).**
- [ ] **AC7.1** — Given `docs/specs/README.md` của repo này và `templates/init/docs/specs/README.md` When đọc Then mỗi file có bảng năng lực, bản đồ docs sáu dòng (làm gì → specs; cấu trúc → ARD/overview; vì sao → decisions; giao tiếp → contracts; vận hành → runbooks; đang làm → lệnh `aip status --requests`), không có bảng request đang mở; riêng README của repo này giữ nguyên bảng 7 năng lực hiện có và đoạn giải thích cách spec sống tạo dần.

**Phát hành và tài liệu (R8).**
- [ ] **AC8.1** — Given nhánh `feature/living-spec-bootstrap` sau mọi task When `npm test` Then exit 0 (baseline 2026-11-04: `npm test` exit 0, validate 6103 pass; số test giảm chỉ khi test bị thay có chủ đích).
- [ ] **AC8.2** — Given thay đổi chạm `core/` và `plugins/engineering/` When kiểm cổng version Then `core/.manifest.json` (hiện 1.27.2) và `plugins/engineering/.manifest.json` (hiện 2.10.10) đã tăng version, `node cli/lib/versions.mjs --lock` đã chạy sau `npm run build`, và `npm test` không báo lock lệch.
- [ ] **AC8.3** — Given bước gộp spec sống When đọc `docs/specs/artifact-templates/spec.md`, `docs/specs/workflows/spec.md`, `docs/specs/cli-wizard/spec.md` Then khớp mục "Ảnh hưởng spec" bên dưới (kèm dòng bảng Lịch sử) và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-04-living-spec-bootstrap/ --base master` không còn W10–W14 hay W23.
- [ ] **AC8.4** — Given `README.md`, `README_VI.md` và `CLAUDE.md` của repo When `grep` dòng liệt kê lệnh `aip status`, số cảnh báo của `check-request.mjs` ("W1–W22"), và số skill của plugin `engineering` ("11 skills") Then mỗi chỗ nêu `--requests`, W23 và 12 skill; bản dịch `README_VI.md` khớp `README.md`.
## Thiết kế
### Vòng lặp trước và sau
| Mắt xích | Trước | Sau |
|---|---|---|
| Viết design (`engineering-spec-writing`) | Không nhắc spec; agent ghi `Không ảnh hưởng: chưa có spec` | Bước điền `Ảnh hưởng spec`: đọc `docs/specs/README.md`, khai năng lực mới là `thêm R1` (A1) |
| `check-request.mjs` | W10 chỉ đòi lý do không rỗng | Thêm W23 khi `Không ảnh hưởng` mà không có `docs/specs/README.md` (A2) |
| Gộp spec ở `finish.md` | Bỏ qua khi `Không ảnh hưởng`; năng lực mới chỉ "thêm vào README" | Năng lực mới → tạo `spec.md` từ template; chưa có README → tạo (A3) |
| `aip init --full` | Không có `docs/specs/README.md` | Tạo sẵn từ `templates/init/docs/specs/README.md` (A4) |
| Project đã có code, chưa có spec | Không có đường nào | Skill `engineering-spec-backfill` (B) |
| Trạng thái sau G3 | Chỉ `merged <hash>` ở merge local | Mọi lựa chọn đều ghi trạng thái (A3) |

### A1: `engineering-spec-writing`
Thêm vào `plugins/engineering/skills/engineering-spec-writing/SKILL.md` (bước "Giao `engineering-spec-analyst` ghi tài liệu" hoặc một bước ngay sau) và `references/spec-structure.md` (chỗ mô tả `design.md`) quy tắc điền `## Ảnh hưởng spec`: đọc `docs/specs/README.md` để biết năng lực đã có; năng lực chưa có thì khai `- <năng-lực>: thêm R1…`; `Không ảnh hưởng` chỉ khi không năng lực nào bị chạm, và "chưa có spec" không phải lý do. Agent `engineering-spec-analyst` nạp skill này nên không sửa agent. Câu trả về cho session chính nhắc năng lực mới sẽ cần `spec.md` ở bước gộp.

### A2: W23
- `checkRequest(texts, opts)` đọc `opts.specsIndex`. Điều kiện W23: `readSpec` có (cùng điều kiện W10), `legacy !== true`, `imp.none` có (kể cả lý do không rỗng), `opts.specsIndex === false`. Dòng báo là dòng heading của mục (`imp.line`). Thiếu mục hoặc mục rỗng thì đã có W10, không thêm W23.
- `main()`: `specsIndex = fs.existsSync(path.join(specsDir, 'README.md'))`, với `specsDir` đã có (`path.resolve(dir, '..', '..', 'specs')`), cùng nguồn với `readSpec` nên bố cục lồng repo/pkg vẫn đúng.
- Thông điệp (builder chốt chữ): nêu "chưa có `docs/specs/README.md`", gợi ý skill `engineering-spec-backfill`, và gợi ý khai `- <năng-lực>: thêm R1` nếu request tạo năng lực mới.
- Chỉ cảnh báo: exit 0, `--strict` thì exit 1 như mọi W khác (R5 của `artifact-templates`).

### A3: `finish.md`
Sửa `core/skills/plan-execution/references/finish.md`:
- Bước 2 "Cập nhật spec sống": thêm hai việc. Năng lực chưa có `spec.md` → tạo từ `core/skills/artifact-templates/references/spec.template.md` (bỏ khối chú thích đầu, điền Mục đích, Phạm vi, các `R<n>` đúng số design khai, một dòng Lịch sử). `docs/specs/README.md` chưa có → tạo theo mẫu `templates/init/docs/specs/README.md` rồi thêm dòng năng lực vào bảng. Giữ nguyên dòng "Design ghi `Không ảnh hưởng` thì bỏ qua và ghi lý do".
- Mục "Ghi nhận" (hoặc bước 7 và "Chi tiết từng lựa chọn"): mỗi lựa chọn G3 ghi `Trạng thái` trong `design.md` bằng một commit docs trước khi kết thúc:

| Lựa chọn | Trạng thái ghi | Thời điểm |
|---|---|---|
| merge local (theo khoá hoặc tay) | `merged <hash merge>` | như hiện tại (bước 3 của "Merge local theo khoá") |
| push + PR | `in-progress — PR nhánh <tên nhánh feature>` | commit docs trước khi push |
| giữ nguyên | `in-progress — nhánh <tên nhánh feature>` | commit docs trên nhánh feature |

- Với hai trạng thái `in-progress`, kết quả cuối nhắc: khi nhánh được merge tay hoặc qua PR, đặt `Trạng thái: merged <hash>` và xoá `plan.md`/`parts/*/plan.md` (W16). `in-progress` là token hợp lệ của W15 (`STATUSES` đã có), và W16 chỉ đòi xoá plan với `merged`/`abandoned`, nên plan còn ở nhánh chờ merge không bị cảnh báo.
- `workflows/feature/WORKFLOW.md` Bước 7 đã trỏ `finish.md`; chỉ sửa nếu bảng 3 lựa chọn ở đó mô tả khác (builder rà).

### A4: `templates/init/docs/specs/README.md`
Tệp mẫu một trang: tiêu đề, bảng năng lực rỗng (`| Năng lực | Mô tả | Spec |`), đoạn "spec sống tạo dần" rút từ README của repo này, bản đồ docs sáu dòng, dòng `aip status --requests`, và một dòng trỏ tới skill `engineering-spec-backfill` cho project đã có code. `init.mjs` đã chép mọi file dưới `templates/init/` mà không ghi đè (`listFiles` + `existsSync`), nên không cần đổi mã; chỉ kiểm bằng test.

### B: skill `engineering-spec-backfill`
Cấu trúc đề xuất: `plugins/engineering/skills/engineering-spec-backfill/SKILL.md` (khung H2 `## Quy trình…`, `## Ranh giới an toàn…`) cùng `references/` (quy tắc nguồn của `R<n>`; mẫu prompt subagent; mẫu báo cáo lệch). Description đề xuất (builder đếm ký tự và chạy contract): "Dựng spec sống ban đầu cho project đã có code từ docs, request đã merge và code theo năng lực nghiệp vụ, mỗi R có Nguồn. Dùng khi người dùng muốn "backfill spec", "dựng docs/specs từ code", "tạo spec cho project cũ", "kiểm spec lệch code". Không dùng khi cần đặc tả tính năng mới → engineering-spec-writing; chỉ ghi quyết định kiến trúc → engineering-adr."

Quy trình:
1. **Kiểm kê** nguồn từ rẻ đến đắt (docs sẵn có → design đã `merged` → điểm vào code → tên test), dừng ở mức đủ để đề xuất năng lực; không đọc toàn bộ code.
2. **Đề xuất năng lực** (bảng) và dừng ở cổng người duyệt: gộp, tách, đổi tên; không tạo subagent trước khi duyệt.
3. **Giao subagent**, mỗi năng lực một con (`general-purpose`): đọc code và nguồn của năng lực, ghi một `spec.md` theo `spec.template.md`. Quy tắc nguồn của `R<n>` nằm trong `references/`:

| Bằng chứng | Nguồn ghi |
|---|---|
| Design đã `merged` nêu hành vi và code khớp | link `requests/<ngày>-<slug>/design.md` |
| Chỉ có code và test | `file:line` + tên test |
| Chỉ suy từ code | `[Unverified]` |
| Design lệch code | theo code, ghi "lệch: <request>" |
| Mơ hồ | mục "Câu hỏi mở" của spec, không thành R |
| Request chưa `merged` | không dùng làm nguồn |

4. **Ghi** `docs/specs/README.md` (từ mẫu A4, đã điền bảng) và các `spec.md`; bảng Lịch sử mỗi spec có dòng "backfill <ngày>" thay cho link request khi không có request gốc.
5. **Kiểm**: `check-request.mjs` W14 trên spec; mọi `file:line` trích dẫn tồn tại và dòng nằm trong file (xem "Để builder quyết": script hay danh mục kiểm tay). Mọi file đổi nằm dưới `docs/specs/`.
6. **Cổng duyệt diff** `docs/specs/`, rồi commit qua `core:git-workflow` trên nhánh không protected; không push.
7. **Chạy lại** khi đã có `docs/specs/`: đọc spec hiện có, đối chiếu với code và nguồn theo cùng quy tắc, trả báo cáo lệch (hai nhóm), không ghi `docs/specs/`. Người dùng muốn sửa spec thì dùng request thường (design `Ảnh hưởng spec` → bước gộp).

Skill không gọi model ngoài subagent, không đụng `src/` hay test, và không lấy request chưa merge làm nguồn.

### C: `aip status --requests`
- `cli/lib/args.mjs`: thêm `--requests` → `a.requests = true` (cờ lạ vốn bị từ chối, nên bắt buộc khai).
- `cli/lib/status.mjs`: hàm `listOpenRequests({ docsRoot, git })` đọc `docs/requests/*/design.md`; lấy dòng `^-\s+Trạng thái\s*:`, token đầu (tách ở khoảng trắng, `—`, `–`, chữ thường) theo cách W15 đọc; token thuộc `merged` hoặc `abandoned` thì bỏ; `draft`, `approved`, `in-progress` giữ nguyên; thiếu dòng, thiếu `design.md` hay token lạ thì trạng thái `null` hiển thị "không rõ". Tên nhánh dự kiến `feature/` + tên thư mục bỏ tiền tố `^\d{4}-\d{2}-\d{2}-`; kiểm `git rev-parse --verify --quiet refs/heads/<nhánh>` rồi `git merge-base --is-ancestor <nhánh> HEAD`, mọi lỗi (kể cả mã thoát 1) đi qua `tryGit` thành "không đánh dấu". Tái dùng `git` được tiêm sẵn của `runStatus` để test dùng git giả.
- `runStatus` rẽ nhánh `args.requests` trước đoạn chọn request. Text: mỗi dòng `<tên>  <trạng thái|không rõ>[  nghi đã merge]`; `--json`: `{ "requests": [{ "name", "status", "suspectMerged" }] }` (builder chốt khoá, giữ ổn định). Chỉ đọc: không ghi `.aip/`, không tạo `status.html`.
- `cli/index.mjs`: dòng trợ giúp của `status`. Tài liệu: `README.md`, `README_VI.md`, `CLAUDE.md` (dòng lệnh `aip status`).

### C: `docs/specs/README.md` của repo này
Đổi sang dạng mới: giữ bảng 7 năng lực và đoạn giải thích cách spec sống tạo dần (bỏ đoạn "Backfill 2026-10-23" thành một dòng lịch sử ngắn hoặc giữ nếu còn giá trị), thêm bản đồ docs sáu dòng và dòng lệnh `aip status --requests`. Trỏ cột "cấu trúc" tới `project-knowledge/` hoặc ARD nếu repo có; nếu không có thì ghi "chưa có" thay vì đặt link chết [giả định: builder kiểm thư mục thật khi viết].

### Điểm chạm
- Sửa mã: `core/skills/artifact-templates/scripts/check-request.mjs`, `cli/lib/status.mjs`, `cli/lib/args.mjs`, `cli/index.mjs`.
- Sửa nội dung chiếu: `core/skills/plan-execution/references/finish.md`, `core/skills/artifact-templates/` (`SKILL.md` hoặc `references/docs-conventions.md` nhắc W23, `docs/specs/README.md` và bước gộp), `plugins/engineering/skills/engineering-spec-writing/` (`SKILL.md`, `references/spec-structure.md`), `plugins/engineering/skills/engineering-spec-backfill/` (mới), `plugins/engineering/.manifest.json` (số skill trong mô tả).
- Thêm file mẫu: `templates/init/docs/specs/README.md`.
- Tài liệu và spec: `docs/specs/README.md`, ba spec ở "Ảnh hưởng spec", `README.md`, `README_VI.md`, `CLAUDE.md` của repo (cảnh báo W1–W22, "11 skills", lệnh `aip status`).
- `plugins/_published.json` không phải sửa: mục `engineering` đã publish cả plugin (đã đọc), nên skill mới được wizard offer.
- Test sẽ thêm hoặc đổi: `test/contract/36-living-spec.contract.mjs` (W23), `test/status.test.mjs` (`--requests`), `test/init.test.mjs` (README của `init --full`); các test đếm skill hoặc pin chữ có thể phải cập nhật (`grep` "11" và `engineering-spec-writing` trong `test/`). Builder nêu tên test sửa trong commit.

### Spec sống
- `artifact-templates` (R14 cuối): đổi R3 (danh sách file `init --full` sinh có thêm `docs/specs/README.md`); thêm R15 (W23: điều kiện, miễn legacy, chỉ cảnh báo, theo file tồn tại); thêm R16 (skill `engineering-spec-backfill`: kiểm kê, cổng năng lực, quy tắc `Nguồn:`, chỉ ghi `docs/specs/`, chạy lại chỉ báo lệch); thêm R17 (`docs/specs/README.md` là điểm vào: bảng năng lực, bản đồ docs, request đang mở chỉ là lệnh; mẫu `templates/init/docs/specs/README.md`).
- `workflows` (R17 cuối): thêm R18 (`engineering-spec-writing` điền `Ảnh hưởng spec` theo A1); thêm R19 (`finish.md` tạo `spec.md` và README khi thiếu, ghi trạng thái ở mọi lựa chọn G3).
- `cli-wizard` (R8 cuối): thêm R9 (`aip status --requests`).
- `artifact-templates/R7` giữ nguyên chữ vì W10 không đổi; chỉ cần R15 mô tả W23. Khi gộp, thêm dòng vào bảng Lịch sử của ba spec và, vì không có năng lực mới, không thêm dòng vào bảng của `docs/specs/README.md` (chỉ sửa mô tả cột nếu cần).

### Phát hành
Chạm `core/` (check-request, finish.md, templates) và `plugins/engineering/`: tăng version cả `core/.manifest.json` và `plugins/engineering/.manifest.json` (skill mới thường là minor), chạy `npm run build` rồi `node cli/lib/versions.mjs --lock`. `cli/` và `templates/init/` không chiếu ra project đích; project đích cần `aip update` (cài lại) để nhận skill, `finish.md` và `check-request.mjs` mới, và chạy `aip init --full` nếu muốn `docs/specs/README.md`.

## Ảnh hưởng spec
- artifact-templates: đổi R3, thêm R15, thêm R16, thêm R17
- workflows: thêm R18, thêm R19
- cli-wizard: thêm R9
## Ngoài phạm vi và anti-goal
- Không tự backfill ở `aip init`, `aip install` hay hook; skill chỉ chạy khi người dùng gọi.
- Không bảng request đang mở trong README, không script ghi vào README, không `_archive/`, không xoá request đã merge.
- Backfill chạy lại không ghi hay sửa spec; không tự thêm `R<n>` cho hành vi chưa có R.
- Không đổi nghĩa W10–W16, `STATUSES`, hay làm W23 thành lỗi; không so chữ lý do `Không ảnh hưởng`.
- Không sửa code project đích; không thêm agent mới hay `writeScope`; không đổi `workflows/feature/WORKFLOW.md` ngoài chỗ trùng với `finish.md` (nếu có).
- Không thêm phụ thuộc runtime; `aip status --requests` không gọi model, không ghi file, không đổi `aip status` các dạng cũ.
- Không sửa 25 request của `content-automation-platform` hay ghi vào repo khác; dọn dòng trạng thái cũ ở đó là việc của người dùng khi chạy `aip status --requests`.
## Ràng buộc
- Zero dependency, Node 20 built-ins; UTF-8 không BOM, LF; chuỗi hiển thị tiếng Việt có dấu.
- Mỗi task một commit trên `feature/living-spec-bootstrap`; không push, không merge.
- Cổng version: tăng `core/.manifest.json` và `plugins/engineering/.manifest.json`, chạy `node cli/lib/versions.mjs --lock` sau build.
- Testing theo `AGENTS.md`: một hành vi một test ở tầng thấp nhất, ca nhiều đầu vào gộp thành test tham số hoá, không test chữ tài liệu ngoài lệnh/tên file vận hành.
- `check-request.mjs` vẫn chỉ cảnh báo; lời gọi cũ không truyền `specsIndex` giữ nguyên kết quả.
## Kiểm thử
- AC2.1–AC2.4: `test/contract/36-living-spec.contract.mjs`, một test tham số hoá cho các tổ hợp (`specsIndex`, lý do, legacy, có/không `thêm R`); AC2.4 phần CLI bằng một ca chạy script trên thư mục tạm không có `docs/specs/README.md`.
- AC4.1–AC4.2: `test/init.test.mjs`, hàm `init()` trên thư mục tạm (tạo mới; file có sẵn không đổi byte; không `--full` không tạo).
- AC6.1–AC6.5: `test/status.test.mjs`, dựng `docs/requests/` giả trong thư mục tạm và `git` giả tiêm vào `runStatus`/`listOpenRequests` (ca tổ tiên, không tổ tiên, ném lỗi); AC6.4 thêm một ca chạy CLI thật cho `--json` và mã thoát 2 khi kết hợp cờ.
- AC5.1: contract sẵn có qua `node test/validate.mjs --build` (không viết test mới). AC5.4: nếu builder làm script kiểm trích dẫn thì một test cho ca dòng ngoài file và file không tồn tại; nếu không có script thì kiểm tay ở review.
- AC1.1, AC3.1–AC3.4, AC5.2, AC5.3, AC5.5, AC5.6, AC7.1: nội dung skill và tài liệu, kiểm bằng review và `grep`; không viết test pin văn xuôi (AGENTS.md mục Testing). Một thử nghiệm tay trên project mẫu có code nhưng chưa có spec (người dùng hoặc builder) là bằng chứng cho AC5.2–AC5.6.
- AC8.1: `npm test`; AC8.2: `npm test` sau khi `versions.mjs --lock`; AC8.3: `check-request.mjs … --base master`; AC8.4: `grep`.
- Lưu ý W7: sau khi có plan, W7 sẽ báo các AC chỉ kiểm bằng review (nhóm AC1.1, AC3.x, AC5.x, AC7.1) vì không test nào nhắc ID; ghi chúng vào `remaining_risks` của plan thay vì thêm test pin.
## Để builder quyết
- Chữ cụ thể của thông điệp W23 và của dòng help `aip status --requests`; tên khoá JSON của `--requests --json`; nơi đặt hàm đọc token trạng thái để dùng chung giữa `status.mjs` và `STATUSES` của `check-request.mjs` (tránh hai danh sách lệch nhau).
- Kiểm trích dẫn `file:line` của backfill: script Node nhỏ trong skill (`scripts/check-citations.mjs`, zero-dep, có test) hay danh mục kiểm tay trong `SKILL.md`. Đề xuất: script, vì tất định và test được; nhưng thêm một file được chiếu.
- Tên lệnh: cờ `--requests` (đã chốt) so với subcommand `aip requests`; đề xuất giữ cờ để không thêm lệnh mới ở bảng trợ giúp và wizard.
- Số `R` mỗi năng lực khi backfill (ước lượng 10–30 [Inference], theo kích cỡ spec hiện có của repo này) và có cần ngưỡng cứng không; chia năng lực quá lớn là việc của cổng người duyệt.
- Ngưỡng và cách chia subagent khi repo lớn (số năng lực chạy song song cùng lúc, giới hạn đọc file mỗi subagent).
- Việc `docs/specs/README.md` của repo này nên giữ đoạn "Backfill 2026-10-23" hay rút thành một dòng; cột "cấu trúc" của bản đồ docs trỏ tới đâu khi repo không có ARD.
- Cách `finish.md` lấy tên nhánh feature khi ghi `in-progress — nhánh <tên>` (từ `git branch --show-current`).
## Rủi ro và câu hỏi mở
Rủi ro:
- Backfill trên repo lớn tốn nhiều token và thời gian (mỗi năng lực một subagent đọc code); chưa đo [Unverified]. Cổng duyệt năng lực ở bước 2 là chỗ cắt phạm vi.
- Subagent chỉ bị giới hạn bằng prompt, không bằng `writeScope`; Bash cho phép ghi ngoài `docs/specs/`. Bước kiểm cuối và cổng duyệt diff là hàng rào, không phải ngăn chặn (quyết định của agent 6).
- `R<n>` suy từ code có thể ghi nhận hành vi sai là hành vi đúng; nhãn `[Unverified]` và mục "Câu hỏi mở" giảm rủi ro nhưng người duyệt vẫn phải đọc. Spec sai còn tệ hơn không có spec vì các request sau gộp lên nền sai.
- "Nghi đã merge" của `aip status --requests` dựa vào nhánh `feature/<slug>`: merge squash/rebase (nhánh không là tổ tiên của HEAD) hoặc nhánh đã bị xoá thì không đánh dấu; tên nhánh không theo `feature/<slug>` cũng không nhận ra. Công cụ chỉ gợi ý, không đổi trạng thái.
- W23 chỉ nhìn `docs/specs/README.md`: project có `docs/specs/` nhưng không có README vẫn bị W23; project có README rỗng thì không. Chấp nhận để điều kiện đơn giản.
- Project đích chỉ nhận thay đổi sau `aip update` (cài lại skill, `finish.md`, `check-request.mjs`) và, với README, sau `aip init --full`; project chưa cập nhật vẫn lặp lại vòng cũ.
- Chưa có ADR cho quyết định "spec đầu tiên đến từ backfill có cổng người duyệt, backfill chạy lại chỉ báo lệch"; nên có một ADR `Status: Proposed` khi người dùng duyệt design.

[giả định] cần người xác nhận:
1. `in-progress — PR nhánh <tên>` ghi trước khi push là đủ, không cần link PR (quyết định của agent 3).
2. Skill backfill, README và W23 gom vào năng lực `artifact-templates`; `finish.md` và `engineering-spec-writing` gom vào `workflows` (quyết định của agent 1), thay vì năng lực mới.
3. `--requests` không đi cùng `<request>`, `--html`, `--watch`, `--part` (quyết định của agent 4).
4. Subagent backfill dùng `general-purpose`, không có agent mới (quyết định của agent 6).
5. Cả hai plugin `core` và `engineering` cần bump version, mức bump do builder chọn.
6. Số skill của `engineering` hiện là 11 (từ mô tả manifest và `CLAUDE.md`); builder kiểm lại khi cập nhật thành 12.
7. Dòng trạng thái của `finish.md` ở lựa chọn "giữ nguyên" dùng một commit docs trên nhánh feature (hợp với quy tắc commit không dừng trên nhánh feature).
