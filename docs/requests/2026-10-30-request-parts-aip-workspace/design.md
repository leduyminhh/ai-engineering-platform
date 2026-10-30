# Thiết kế: chia part trong một request, workspace `.aip/` và trường TDD theo task
- Ngày: 2026-10-30
- Trạng thái: draft — chờ duyệt
- Requirement: không có
## Vấn đề và lý do
Một feature lớn nhiều chức năng hiện chỉ có một `design.md` và một `plan.md`; `plan-execution` chạy task tuần tự ("không song song trong cùng một cây làm việc", `core/skills/plan-execution/references/task-loop.md:3`), còn `**Song song:**` và `check-partition.mjs` chỉ cảnh báo, `plan-execution` không đọc. Ledger, brief và review package nằm ở `<requestDir>/.sdd/` (tự `.gitignore` `*`, `core/skills/plan-execution/scripts/ledger.mjs:29-33`), nên khi chạy nhiều agent theo worktree thì trạng thái chạy gắn với từng cây làm việc. Đã kiểm chứng trong phiên: `git worktree remove` exit 0 và xoá luôn file bị ignore trong worktree (`.sdd/`, `.aip/`), nên ledger đặt trong worktree mất theo; ngược lại `resolveGate` trong `core/hooks/scripts/gate-config.mjs:24-31` có `roots` gồm gốc worktree và gốc repo chính, nên chế độ `full` cho ghi vào `<gốc repo chính>/.aip/` từ worktree. Về TDD, chỉ task `**Kind:** BE` bắt `tdd.red`/`tdd.green`, FE-UI viết test sau (`frontend-implementer` rồi `frontend-test-writer`), kind khác không TDD; skill `engineering-tdd` nói ngoại lệ cần người dùng đồng ý nhưng plan không có chỗ ghi. Superpowers 7.0.0 làm khác ở ba điểm: TDD luôn bắt và ngoại lệ (prototype vứt đi, code sinh tự động, file cấu hình) hỏi người; cấm dispatch nhiều implementer song song trong một plan; workspace tạm mỗi plan ở `<repo-root>/.superpowers/sdd/<plan>/` (tự ignore, không đặt trong `.git/` vì Claude Code chặn agent ghi `.git/`).
## Quyết định đã chốt
- Người dùng: KHÔNG tách thành nhiều thư mục request; chia part BÊN TRONG một request. Hướng bị loại: (a) nhiều thư mục request ngang hàng, người dùng từ chối; (b) chạy song song task bên trong một plan, superpowers cấm và dễ ghi đè file nhau.
- Bố cục opt-in; không có `parts/` thì mọi thứ như cũ:
  ```
  docs/requests/<ngày>-<slug>/        (commit)
    design.md          tổng: phạm vi, ranh giới part, contract chung, ## Bảng part, AC toàn request
    plan.md            (tuỳ chọn) phần nền, chạy trước mọi part
    parts/<nn>-<part-slug>/plan.md     bắt buộc cho mỗi part
    parts/<nn>-<part-slug>/design.md   tuỳ chọn, KHÔNG chứa AC
  ```
  `<nn>` hai chữ số; một cấp part, không lồng. AC chỉ ở gốc (`requirement.md` hoặc `design.md` gốc), ID duy nhất toàn request; plan của part phủ AC gốc qua `**Phủ AC:**`.
- `## Bảng part` trong `design.md` gốc, cột `| Part | Phụ thuộc | Song song | Trạng thái |`: Part = `<nn>-<part-slug>`; Phụ thuộc = danh sách part hoặc `—`; Song song = nhãn nhóm hoặc `—`; Trạng thái ∈ `chưa làm | đang làm | merged <hash> | bỏ`. Chỉ session gốc sửa bảng, lúc merge part.
- Workspace chạy ở `<gốc>/.aip/`, tách khỏi `.ai-engineering/` (trạng thái cài đặt, có thể ở scope global). `<gốc>` là thư mục cha của `git rev-parse --path-format=absolute --git-common-dir` (gốc repo chính, dùng chung mọi worktree, sống sót `git worktree remove`); không phải git repo thì cwd. Tên `runs/` và `root` là (quyết định của agent).
- Script `plan-execution` nhận đường dẫn plan, tính workspace từ một hàm dùng chung; đối số là thư mục request thì coi như `<dir>/plan.md`; `--out` vẫn ghi đè; ledger mới chưa có mà `.sdd/progress.md` cũ có thì CHÉP sang, không xoá file cũ. (quyết định của agent)
- Trường TDD theo task: `**TDD:** có` hoặc `**TDD:** không — <lý do>` (hai giá trị: quyết định của agent). Người dùng chọn: `có` chỉ hợp lệ với kind `BE` và `TOOLING`; FE-UI giữ như nay (test viết sau, cổng `tsc`/lint/build) vì test đỏ trước khi có component là đỏ do import, trái `engineering-tdd`. Plan được người dùng duyệt là sự đồng ý ngoại lệ mà `engineering-tdd` yêu cầu; skill nêu 3 ngoại lệ của superpowers làm ví dụ, lý do vẫn tự do.
- Người dùng chọn: gỡ song song cấp task. Bỏ `**Song song:**` giữa task và nhánh `worktree-<slug>-t<n>`; chỉ còn song song giữa part (`worktree-<slug>-p<nn>`); `check-partition.mjs` chỉ kiểm giữa part và báo P3 khi plan còn `**Song song:**` cấp task.
- Chế độ part của `plan-execution`: part không review cuối riêng, chỉ một review cuối toàn nhánh sau khi mọi part xong. (quyết định của agent)
- Giao thức part (quyết định của agent): trước mỗi nhóm song song, session gốc hỏi người dùng một lần: mở phiên riêng cho từng part (người dùng tự mở, hoặc tool mở phiên của app nếu có) hay chạy tuần tự trong session gốc. Phiên của part ghi `Part: complete <hash>` vào ledger của part sau commit task cuối; session gốc ghi `Part <nn>: merged <hash>` vào ledger `root/`; `Plan: complete` chỉ ghi ở ledger `root/` ở bước kết thúc nhánh. Part chạy tuần tự không có merge commit: `<hash>` là HEAD sau commit task cuối của part trên `feature/<slug>`.
- Giảm rủi ro phạm vi rộng (quyết định của agent): `plan.md` của request này chia 3 giai đoạn tuần tự, mỗi giai đoạn tự đứng được (bump version, `versions.mjs --lock`, `npm test` xanh, commit) nên nhánh dừng sau giai đoạn nào cũng merge được: A = trường TDD (R5); B = workspace `.aip/` và hook (R3, R4); C = part, validator part, chế độ part, baseline (R1, R2, R6, R7). Không dùng bố cục `parts/` cho chính request này vì validator chỉ hiểu `parts/` sau giai đoạn C.
- Giảm rủi ro xung đột ngữ nghĩa giữa part (quyết định của agent): interface dùng chung giữa part chỉ được tạo ở `plan.md` gốc hoặc ở part mà part kia khai trong cột Phụ thuộc; part cùng nhóm Song song không được `Consumes` thứ mà part cùng nhóm `Produces` (`check-partition.mjs` báo P4 khi tên trong backtick ở `Consumes` của part này trùng `Produces` của part cùng nhóm). Bước "Rà plan trước khi chạy" của `task-loop.md` xét thêm `**Interfaces:**` giữa part. Sau mỗi lần merge part, session gốc chạy full suite của component bị chạm và component phụ thuộc. Review cuối nhận thêm Bảng part và danh sách interface giữa part làm Review Focus bắt buộc.
- Giảm rủi ro quyền ghi `.aip/` từ worktree (quyết định của agent): đã thử `decide()` của `guard-files` và `guard-bash` với `permission_mode` `default` và `acceptEdits`, phiên ở worktree ghi `<gốc repo chính>/.aip/…`: cả hai trả `null` (hook aip không chặn). Còn sandbox Bash của Claude Code có thể chặn ghi ra ngoài cwd, nên hàm workspace có đường lui: ghi `<gốc repo chính>/.aip/` lỗi quyền (`EACCES`/`EPERM`/`EROFS`) thì ghi `<gốc worktree>/.aip/` và in một dòng cảnh báo; skill `git-worktree` chép `<worktree>/.aip/runs/` về `<gốc repo chính>/.aip/runs/` trước khi `git worktree remove`; hook đọc `.aip/` ở cả gốc repo chính lẫn gốc worktree hiện tại.
- Quyết định nhỏ sau builder check (quyết định của agent): plan nằm ngoài `docs/requests/<x>/` thì `<request>` là tên thư mục cha của plan và `<part>` là `root`; `task-brief.mjs` chèn đúng một dòng TDD hiệu lực ngay sau heading task, phần còn lại giữ nguyên văn; W7 (như W6) tính trên hợp test của mọi plan; W16 áp cho cả `parts/*/plan.md`; `review-package.mjs` thêm `--plan <path>`, có `--plan` mà không `--out` thì ghi vào workspace của plan, không có `--plan` thì giữ hành vi cũ (stdout); hook bỏ qua `.sdd/progress.md` cũ của request đã có ledger trong `.aip/runs/<request>/`, và coi ledger có `Part: complete` như đã xong.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given request có `parts/01-a/plan.md` với một task thiếu `**Kind:**`, When chạy `check-request.mjs`, Then có cảnh báo W17 nêu đường dẫn `parts/01-a/plan.md`.
- [ ] **AC1.2** — Given AC `AC1.1` của request chỉ được phủ bằng `**Phủ AC:**` trong `parts/01-a/plan.md` và chỉ được nhắc trong file test của part đó, When chạy `check-request.mjs`, Then không có W6 và W7 cho AC đó.
- [ ] **AC1.3** — Given Bảng part có part không có `parts/<part>/plan.md`, hoặc thư mục `parts/<x>/` không có trong bảng, hoặc Phụ thuộc trỏ part không có, hoặc Trạng thái ngoài tập cho phép, When chạy `check-request.mjs`, Then có một cảnh báo W19 cho mỗi chỗ lệch.
- [ ] **AC1.4** — Given `parts/01-a/design.md` chứa chuỗi dạng `AC<n>.<m>`, When chạy `check-request.mjs`, Then có cảnh báo W20 nêu file đó.
- [ ] **AC1.5** — Given request không có `parts/`, không có Bảng part và plan không có dòng `**TDD:**`, When chạy `check-request.mjs`, Then không có W19, W20, W21 và output giống hệt trước thay đổi.
- [ ] **AC1.6** — Given `design.md` có Trạng thái `merged` và còn `parts/01-a/plan.md`, When chạy `check-request.mjs`, Then có W16 nêu `parts/01-a/plan.md`.
- [ ] **AC2.1** — Given hai part cùng nhãn cột Song song có file ở `**Files:**` giao nhau, When chạy `check-partition.mjs`, Then có P1 nêu hai tên part và file giao; part khác nhãn hoặc nhãn `—` thì không có cảnh báo.
- [ ] **AC2.2** — Given một part trong nhóm song song ghi file dùng chung bị cấm, When chạy `check-partition.mjs`, Then có P2 nêu tên part đó.
- [ ] **AC2.3** — Given một plan (gốc hoặc part) còn dòng `**Song song:**` cấp task, When chạy `check-partition.mjs`, Then có P3 báo song song cấp task đã bỏ, và không còn P1/P2 tính giữa task.
- [ ] **AC2.4** — Given hai part cùng nhãn Song song, part A có `**Interfaces:**` `Consumes` chứa `` `X` `` và part B có `Produces` chứa `` `X` ``, When chạy `check-partition.mjs`, Then có P4 nêu hai part và `X`; A khai B trong cột Phụ thuộc (khác nhóm) thì không cảnh báo.
- [ ] **AC3.1** — Given plan gốc và `parts/01-a/plan.md`, When chạy `ledger.mjs`, `task-brief.mjs`, `review-package.mjs` từ gốc repo chính và từ một worktree, Then file được ghi vào `<gốc repo chính>/.aip/runs/<request>/root/` hoặc `.../01-a/`, và `<gốc repo chính>/.aip/.gitignore` có nội dung `*`.
- [ ] **AC3.2** — Given đối số là thư mục request, When chạy một script `plan-execution`, Then kết quả giống truyền `<dir>/plan.md`.
- [ ] **AC3.3** — Given `<requestDir>/.sdd/progress.md` cũ và chưa có ledger mới, When chạy `ledger.mjs`, Then nội dung được chép sang ledger mới và file cũ còn nguyên.
- [ ] **AC3.4** — Given `review-package.mjs <base> <head> --plan parts/01-a/plan.md` không có `--out`, When chạy, Then package được ghi vào workspace của part và đường dẫn được in ra; không có `--plan` thì vẫn in package ra stdout như trước.
- [ ] **AC3.5** — Given ghi vào `<gốc repo chính>/.aip/` lỗi quyền (giả lập `EACCES`/`EPERM`) khi script chạy trong worktree, When chạy `ledger.mjs`, Then ledger được ghi vào `<gốc worktree>/.aip/runs/<r>/<part>/` và stderr có một dòng cảnh báo nêu đường dẫn đã dùng; lỗi khác vẫn làm script thất bại.
- [ ] **AC3.6** — Given worktree của part có `.aip/runs/`, When làm theo bước dọn worktree của skill `git-worktree`, Then `.aip/runs/` được chép về `<gốc repo chính>/.aip/runs/` trước lệnh `git worktree remove`.
- [ ] **AC4.1** — Given ledger dở ở `.aip/runs/<r>/<part>/progress.md` của gốc repo chính hoặc của gốc worktree hiện tại, When hook `session-start` chạy với `source: startup` ở gốc repo hoặc trong worktree, Then đuôi ledger được nạp theo quy tắc hooks-gates/R11 (mtime mới nhất, bỏ `Plan: complete`, tối đa 2000 ký tự, tuổi `handoffMaxAgeHours`, `ledgerInject`, ngân sách chung 9000).
- [ ] **AC4.2** — Given chỉ có `docs/requests/<r>/.sdd/progress.md` cũ và không có `.aip/runs/<r>/`, When hook chạy, Then ledger cũ vẫn được nạp như trước; có `.aip/runs/<r>/` thì ledger `.sdd` của `<r>` bị bỏ qua.
- [ ] **AC4.4** — Given ledger part mới nhất có dòng `Part: complete <hash>`, When hook chạy, Then ledger đó bị bỏ qua như ledger có `Plan: complete`.
- [ ] **AC4.3** — Given nhiều nguồn handoff cùng tồn tại, When hook chạy, Then thứ tự chọn là `handoffPath` hợp lệ, rồi `.aip/runs/*/handoff.md` mới nhất, rồi `docs/requests/*/handoff.md` mới nhất, rồi `.claude/handoff.md`.
- [ ] **AC5.1** — Given dòng `**TDD:**` có giá trị lạ, hoặc `không` thiếu lý do, hoặc `có` ở task kind ngoài {BE, TOOLING}, When chạy `check-request.mjs`, Then có cảnh báo W21 cho mỗi ca; `có` hợp lệ và `không — <lý do>` thì không cảnh báo.
- [ ] **AC5.2** — Given task trong plan, When chạy `task-brief.mjs`, Then brief có đúng một dòng TDD hiệu lực ngay sau heading task, kèm "(mặc định theo kind)" khi plan không có dòng `**TDD:**` (BE là có, kind khác là không); phần còn lại của task giữ nguyên văn.
- [ ] **AC5.3** — Given vòng task của `plan-execution`, When task có TDD `có` thiếu `tdd.red` hoặc `tdd.green` trong `agent_result` (task `TOOLING`: thiếu red/green trong dòng ledger), Then đầu ra bị coi là hỏng; task `BE` với `không — <lý do>` không bị đòi `tdd`.
- [ ] **AC6.1** — Given `design.md` gốc có Bảng part, When chạy `plan-execution`, Then plan gốc (nếu có) chạy trước trên `feature/<slug>`, rồi các part theo thứ tự phụ thuộc; trước mỗi nhóm Song song, session gốc hỏi người dùng một lần (phiên riêng hay tuần tự); nhóm chỉ chạy song song khi `check-partition.mjs` không báo P1/P2 cho nhóm đó và người dùng chọn phiên riêng, không thì chạy tuần tự trong session gốc.
- [ ] **AC6.2** — Given part chạy song song, When phiên của part làm việc, Then nó dùng worktree `.claude/worktrees/<slug>-p<nn>/` và nhánh `worktree-<slug>-p<nn>` cắt từ đỉnh hiện tại của `feature/<slug>`, không sửa `design.md` gốc hay Bảng part, và ghi `Part: complete <hash>` vào ledger của part sau commit task cuối; session gốc `merge --no-ff` vào `feature/<slug>`, chạy test của component bị chạm, ghi `Part <nn>: merged <hash>` vào ledger `root/`, đặt Trạng thái `merged <hash>` và commit.
- [ ] **AC6.3** — Given mọi part có Trạng thái `merged <hash>` hoặc `bỏ`, When `plan-execution` kết thúc, Then review cuối toàn nhánh chạy đúng một lần, với Review Focus có Bảng part và các interface giữa part, sau đó mới tới bước kết thúc nhánh; `Plan: complete` chỉ ghi ở ledger `root/`.
- [ ] **AC6.5** — Given một part vừa merge vào `feature/<slug>`, When session gốc kiểm sau merge, Then full suite của component bị chạm và component phụ thuộc chạy và xanh trước khi part kế tiếp bắt đầu; đỏ thì dừng nhóm, sửa trên `feature/<slug>` theo vòng sửa của `plan-execution`.
- [ ] **AC6.4** — Given part chạy tuần tự trong session gốc, When part xong, Then Trạng thái là `merged <hash>` với `<hash>` là HEAD sau commit task cuối của part trên `feature/<slug>`.
- [ ] **AC7.1** — Given `core/agents/AGENTS.template.md`, When đọc, Then mục Docs location nêu `parts/`, bảng Memory ghi ledger ở `.aip/runs/<request>/<part>/progress.md`, mục Parallel agents dùng `worktree-<slug>-p<nn>` / `.claude/worktrees/<slug>-p<nn>/` thay cho `-t<n>` và nêu "chỉ song song giữa part, không trong một part"; `AGENTS.md` byte-identical với template.
## Thiết kế
**Commit và git-ignored**
| Artifact | Nơi | Lý do |
|---|---|---|
| requirement/design gốc, `parts/*/design.md`, `plan.md` gốc, `parts/*/plan.md`, `tasks.md` | request (commit) | quyết định, có cổng duyệt |
| Bảng part (trạng thái thô + hash merge) | request (commit) | người ở máy khác cần biết part nào xong |
| ledger `progress.md`, brief, review package, report agent | `.aip/` | trạng thái chạy, sinh lại được |
| `handoff.md` | `.aip/` | chỉ có nghĩa giữa các phiên |
| map part → đường dẫn worktree | `.aip/` | đường dẫn tuyệt đối theo máy |
| `Ruling:` | ledger trong `.aip/`; ruling làm đổi design thì chép vào `design.md` ở bước kết thúc | |

Đánh đổi: `.aip/` chỉ có ở máy đang chạy; máy khác chỉ có commit và Bảng part.

**Workspace.** `<gốc>/.aip/runs/<tên-thư-mục-request>/<part>/` với `<part>` = `root` cho `plan.md` gốc hoặc `<nn>-<part-slug>`; handoff ở `<gốc>/.aip/runs/<tên-thư-mục-request>/handoff.md`; `<gốc>/.aip/.gitignore` chứa `*` (tự ignore như superpowers; `aip init` không đổi). Một hàm dùng chung tính workspace từ đường dẫn plan là nguồn duy nhất cho ba script `ledger.mjs`, `task-brief.mjs`, `review-package.mjs`.

**Hook `session-start`.** Ledger đọc ở `<gốc repo chính>/.aip/runs/*/*/progress.md` (phiên ở gốc hay trong worktree đều thấy) cộng `docs/requests/*/.sdd/progress.md` cũ; quy tắc hooks-gates/R11 giữ nguyên. Chỉ dùng `git rev-parse`, fail-open, không ghi file.

**Trường TDD.** Thiếu dòng thì mặc định theo kind: `BE` = có, kind khác = không (đúng hành vi hiện tại). "không" nghĩa là không bắt test đỏ trước; AC vẫn phải có test (W6/W7 và gate "mỗi AC ít nhất một test" giữ nguyên). Chuỗi agent không đổi: `BE` `có` như nay; `TOOLING` `có` do session chính tự làm và ghi red/green vào dòng ledger. Task `có` thiếu `tdd.red`/`tdd.green` là đầu ra hỏng; task `không` không đòi `tdd`. Trường được hướng dẫn ở `plan-structure.md` của `engineering-plan-writing` và có trong `plan.template.md`; Bảng part có trong `design.template.md` (mục tuỳ chọn). File phải đổi từ "chỉ task kind `BE`" sang "task TDD `có`": `core/principles/workflow-output-contract.md`, `core/skills/plan-execution/references/task-loop.md` và `prompts/task-review.md`, `workflows/feature/WORKFLOW.md` (+ `references/error-matrix.md`), `plugins/backend/agents/backend-implementer.md`, `plugins/engineering/skills/engineering-tdd/SKILL.md`.

**Gỡ song song cấp task.** Bỏ `**Song song:**` giữa task ở `check-partition.mjs` (thay bằng P3), `core/skills/git-worktree/SKILL.md`, baseline Parallel agents, README/README_VI và `CLAUDE.md`; đổi `-t<n>` thành `-p<nn>`. Pin `test/content/24-check-partition.pin.mjs` và `25-parallel-agents-docs.pin.mjs` đổi theo (vẫn giữ kiểm P1/P2, nay ở cấp part).

**Chế độ part.** Chạy plan gốc trước, rồi part theo phụ thuộc. Mỗi part chạy song song có worktree riêng (skill `git-worktree`), tự commit trên nhánh part, ghi ledger của part, và báo về session gốc khi xong; bên trong một part vẫn tuần tự. aip không tự mở phiên hay agent: người dùng hoặc tool của app mở; chưa có phiên riêng thì chạy tuần tự trong session gốc (kết quả như nhau). Sau khi merge xong mọi part, một review cuối toàn nhánh bắt lỗi tích hợp giữa part, rồi kết thúc nhánh như hiện nay; dọn worktree theo `git-worktree` (đã merge, sạch).

**Validator.**
- `check-request.mjs`: áp các kiểm hiện có cho plan (W5 header, W8/W9, W17/W18, W7) cho TỪNG `parts/*/plan.md`, cảnh báo nêu đúng `parts/<nn>-<slug>/plan.md`; W6 tính độ phủ AC trên hợp của plan gốc, mọi plan part và `tasks.md`. Mới: **W19** Bảng part lệch thư mục hoặc giá trị; **W20** AC xuất hiện trong `parts/*/design.md`; **W21** dòng `**TDD:**` sai.
- `check-partition.mjs`: áp P1/P2 giữa các part cùng nhãn cột Song song của Bảng part; tập file của part = hợp `**Files:**` mọi task của part; cảnh báo nêu tên part. P3 khi plan còn `**Song song:**` cấp task (đã bỏ). P4 khi tên trong backtick ở `Consumes` của một part trùng `Produces` của part cùng nhóm.

**Thứ tự triển khai.** Ba giai đoạn tuần tự trong một `plan.md`; mỗi giai đoạn kết thúc bằng một task `TOOLING` bump version các plugin bị chạm, `node cli/lib/versions.mjs --lock`, `npm test` xanh và commit.

| Giai đoạn | Nhóm AC | Plugin bị chạm |
|---|---|---|
| A — trường TDD | AC5.x | core, engineering, backend, workflows |
| B — workspace `.aip/` và hook | AC3.x, AC4.x | core, workflows |
| C — part, validator part, chế độ part, baseline | AC1.x, AC2.x, AC6.x, AC7.1 | core, engineering, workflows |

**Ảnh hưởng spec (mô tả ngắn, không chép spec)**
- artifact-templates/R10 (mới): bố cục `parts/`, Bảng part, W19, W20. artifact-templates/R11 (mới): trường `**TDD:**` và W21. artifact-templates/R8 (đổi): P1/P2 chuyển sang cấp part, P3 cho `**Song song:**` cấp task.
- hooks-gates/R11 (đổi): đường dẫn ledger thêm `.aip/runs/...` bên cạnh `.sdd/` cũ. hooks-gates/R14 (mới): thứ tự tìm handoff.
- workflows/R7 (đổi): TDD theo trường `**TDD:**` thay vì chỉ kind `BE`. workflows/R8 (đổi): đường dẫn ledger. workflows/R14 (mới): chế độ part của `plan-execution`.
- baseline/R2, R3, R6 (đổi): theo AC7.1.
## Ảnh hưởng spec
- artifact-templates: thêm R10, thêm R11, đổi R8
- hooks-gates: đổi R11, thêm R14
- workflows: đổi R7, đổi R8, thêm R14
- baseline: đổi R2, đổi R3, đổi R6
## Ngoài phạm vi và anti-goal
- Không song song task trong một part.
- Không TDD cho FE-UI, FE-INT, E2E, DB, CT, DOCS (`**TDD:** có` chỉ ở BE, TOOLING).
- aip không tự mở phiên hay agent.
- Không part lồng.
- Không tự xoá hay di chuyển `.sdd/` cũ.
- Không đổi `engineering-task-breakdown` và `tasks.md`.
- Không đổi `.ai-engineering/`; `aip init` không đổi.
## Ràng buộc
- Node built-in, zero-dependency; chạy được trên Windows.
- Hook fail-open, chỉ `git rev-parse`/`git ls-files`, không ghi file.
- Bump version các plugin bị chạm ở mỗi giai đoạn (`core`, `engineering`, `backend`, `workflows`; `frontend` không đổi) rồi chạy `node cli/lib/versions.mjs --lock`.
- `AGENTS.md` giữ byte-identical với `core/agents/AGENTS.template.md`; cập nhật README/README_VI nếu nhắc `.sdd`.
## Kiểm thử
- AC1.x, AC5.1: unit trong `test/contract/35-artifact-templates.contract.mjs` (`check-request.mjs`).
- AC2.x: cùng file đó hoặc nơi đang test `check-partition` (`test/content/24-check-partition.pin.mjs` hiện có); builder chọn có chuyển sang contract hay không.
- AC2.4: cùng nơi test P1/P2 của `check-partition`.
- AC3.5: unit hàm workspace với `fs` tiêm lỗi `EACCES`/`EPERM` (không cần sandbox thật). AC3.6, AC6.5: pin chuỗi vận hành trong `git-worktree` và `task-loop.md`, như AC6.x.
- AC3.1–AC3.4, AC5.2: unit các script `plan-execution`, ở nơi đang test ledger/task-brief (xem `test/content/31-workflow-self-sufficient.pin.mjs`, `test/content/32-superpowers-gap.pin.mjs`).
- AC4.x: `decide()` trong `test/contract/90-hooks.contract.mjs`.
- AC5.3, AC6.x: văn bản skill/agent/workflow. Chỉ pin các chuỗi vận hành mà người và script dựa vào (`Part: complete`, `Part <nn>: merged`, `-p<nn>`, "TDD `có`" trong contract đầu ra), một pin mỗi AC có nêu ID AC (quyết định của agent, để W7 không báo); phần văn xuôi còn lại kiểm bằng review cuối.
- AC7.1: contract `AGENTS.md` = template hiện có, cộng một pin cho các chuỗi vận hành (đường dẫn ledger, tên nhánh `-p<nn>`) vì là contract vận hành.
## Để builder quyết
- Vị trí hàm parse Bảng part dùng chung (đề xuất export từ `check-request.mjs` cho `check-partition.mjs` dùng lại).
- Định dạng dòng ledger cho red/green của `TOOLING` (và cách `ledger.mjs` kiểm dòng đó).
- Câu chữ thông báo W19, W20, W21.
- Tên file của hàm tính workspace.
## Rủi ro và câu hỏi mở
- Hai part không chung file vẫn có thể xung đột ngữ nghĩa. Đã giảm bằng: luật interface giữa part và P4, rà interface trước khi chạy, full suite sau mỗi merge, Review Focus bắt buộc ở review cuối. Còn lại: P4 chỉ so tên trong backtick, nên interface ghi không có backtick hoặc khác tên sẽ lọt.
- `session-start` chọn ledger mới nhất, có thể là ledger part của phiên khác (chấp nhận, như hiện tại).
- Plan đang chạy dở với `.sdd/` cũ: chép một lần sang ledger mới.
- [giả định] Review cuối toàn nhánh của feature lớn có diff lớn, chấp nhận vì từng task đã được review.
- Phạm vi rộng (4 plugin cộng `AGENTS.md`): đã giảm bằng 3 giai đoạn tự đứng được. Còn lại: giai đoạn C vẫn lớn nhất.
- [Unverified] Sandbox Bash của Claude Code có chặn ghi `<gốc repo chính>/.aip/` từ worktree hay không chưa thử trên phiên thật; hook aip đã kiểm là không chặn. Đường lui ghi vào `<gốc worktree>/.aip/` và chép về trước khi remove phủ trường hợp bị chặn.
