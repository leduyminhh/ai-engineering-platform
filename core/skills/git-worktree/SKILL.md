---
name: git-worktree
description: "Tạo và dọn git worktree theo quy ước baseline: kiểm trước, tên nhánh, đường dẫn, merge về nhánh tích hợp, dọn an toàn trên Windows. Dùng khi người dùng muốn \"tạo worktree\", \"chạy song song nhiều part\", \"cô lập nhánh đang làm\", \"dọn worktree\". Không dùng khi chỉ commit hoặc merge trên một cây làm việc → git-workflow."
order: 7
title: "Git Worktree — tạo, merge, dọn worktree theo quy ước baseline (dùng chung)"
runsIn: execute
invoke: per-request
---

# Git Worktree (skill dùng chung)

Worktree là một cây làm việc riêng của cùng repo. Dùng khi hai agent hoặc hai part chạy cùng lúc với tập file không giao
nhau, hoặc khi cần cô lập việc mới khỏi thay đổi đang dở. Task chạy tuần tự (mặc định của `plan-execution`, kể cả trong một part) thì ở yên một
cây, không cần skill này. Skill dành cho session chính; worktree do `isolation: worktree` của Claude Code tự tạo cho
subagent thì không thuộc phạm vi skill này.

Quy ước dưới đây là quy ước "Parallel agents" của baseline `AGENTS.md`; skill không đặt quy ước khác. Chỉ song song giữa part (`<nn>` là số part trong Bảng part); bên trong một part các task chạy tuần tự.

## Quy trình — tạo worktree

1. **Hỏi một lần.** Theo `git-workflow`, chưa được người dùng đồng ý thì không tạo. Nêu tên nhánh, đường dẫn và nhánh gốc. Part chạy qua `plan-execution`: câu trả lời "phiên riêng hay tuần tự" ở bước 3 của "Chế độ part" thay câu hỏi này.
2. **Kiểm trước.**
   - Nhánh tích hợp `feature/<slug>` đã tồn tại, cây hiện tại đang ở đúng nhánh đó (`git branch --show-current`) và không có
     thay đổi dở thuộc việc khác (`git status --short`).
   - `git check-ignore -q .claude/worktrees/` thành công. Chưa bị bỏ qua thì đề xuất thêm `.claude/worktrees/` vào
     `.gitignore` và chờ người dùng đồng ý; không tự sửa.
3. **Tạo từ tip hiện tại của nhánh tích hợp:**
   ```bash
   git worktree add -b worktree-<slug>-p<nn> .claude/worktrees/<slug>-p<nn> feature/<slug>
   ```
   Tên nhánh là `worktree-<slug>-p<nn>`, thư mục là `.claude/worktrees/<slug>-p<nn>/`. Sau mỗi lần merge, part kế tiếp cắt
   từ tip mới của nhánh tích hợp, không từ tip cũ.
4. **Baseline trong worktree mới.** Cài dependency nếu project cần, rồi chạy build/test hẹp. Đỏ thì dừng và báo; không
   implement trên baseline đỏ.
5. **Làm việc.** Hook `core` đọc `.claude/aip-gate.json` từ gốc worktree rồi từ gốc repo chính, nên cấu hình gate vẫn áp dụng.

## Quy trình — merge về nhánh tích hợp

1. Chạy ở cây tích hợp (session chính): `git merge --no-ff worktree-<slug>-p<nn>`; sau mỗi merge chạy test của các component
   bị chạm.
2. Xung đột nằm ngoài tập file đã khai cho part đó thì dừng và báo người dùng; không tự giải quyết.
3. File dùng chung (version bump, lock, spec sống, README) chỉ sửa ở session chính: sau mỗi lần merge part, trước khi chạy full suite (`plan-execution`, mục "Chế độ part").

## Quy trình — dọn worktree

1. Chỉ dọn khi nhánh đã merge (`git branch --merged feature/<slug>` liệt kê nó, có thể kèm tiền tố `+` vì nhánh đang được worktree dùng) **và** `git -C .claude/worktrees/<slug>-p<nn> status --short --ignored`
   không in gì ngoài mục `.aip/` (chép ở bước 2). `git worktree remove` xoá cả file bị gitignore (cấu hình cục bộ, `.aip/` của worktree), nên còn mục ignored
   không tái tạo được thì giữ lại. Chưa merge hoặc còn thay đổi thì giữ lại và báo người dùng.
2. Nếu worktree có `.aip/runs/` (ledger, brief, review package, ghi khi `<gốc repo chính>/.aip/` không ghi được), chép về
   `<gốc repo chính>/.aip/runs/` trước khi xoá, không ghi đè file đã có ở đích; chỉ chép, không xoá nguồn:
   ```bash
   node -e "require('fs').cpSync(process.argv[1], process.argv[2], { recursive: true, force: false, errorOnExist: true })" "<worktree>/.aip/runs" "<gốc repo chính>/.aip/runs"
   ```
   Đích đã có file trùng tên thì lệnh lỗi (file đã tồn tại) và có thể đã chép một phần: dừng, không xoá worktree; so sánh từng
   file `.aip/runs/` của worktree với đích, gộp bằng tay, rồi mới sang bước 3.
3. Dọn bằng lệnh của git, theo thứ tự:
   ```bash
   git worktree remove .claude/worktrees/<slug>-p<nn>
   git branch -d worktree-<slug>-p<nn>
   ```
   `git worktree prune` chỉ chạy sau khi thư mục đã không còn.
4. **Windows và junction.** Worktree có thể chứa junction (vd `node_modules`, `build/` trỏ ra ngoài). Xoá đệ quy bằng shell
   có thể đi xuyên junction và xoá nội dung ở đích. Nếu `git worktree remove` không gỡ được, liệt kê junction bằng
   `fs.lstatSync(p).isSymbolicLink()`, gỡ chính link bằng `fs.unlinkSync`, rồi dọn phần còn lại bằng `fs.rmSync` của Node.
   [Unverified] Hành vi `fs.rmSync` trên junction chưa được kiểm ở đây; thử trên thư mục tạm có junction trỏ vào thư mục
   rỗng trước khi dọn thật.

## Ranh giới an toàn

- Không tạo worktree khi chưa được người dùng đồng ý; không tạo ngoài `.claude/worktrees/`.
- Không `rm -rf` hay `Remove-Item -Recurse` lên thư mục worktree; không `git worktree remove --force`; không `git branch -D`.
- Hai worktree không được ghi cùng một file; kiểm tập file bằng `check-partition.mjs` của `artifact-templates` trước khi chạy song song.
- [Inference] Chạy tối đa 3 agent cùng lúc, theo heuristic của baseline (không phải giới hạn chính thức của git).
- Không push từ worktree; push và PR đi qua `git-workflow` sau khi người dùng duyệt diff cả nhánh tích hợp.
- Không xoá nhánh tích hợp; không amend hay squash khi chưa được người dùng xác nhận.
