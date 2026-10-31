# Thiết kế: luồng tự động với 3 cổng duyệt cố định
- Ngày: 2026-10-31
- Trạng thái: merged — merge `feature/autonomy-gates` vào master f232e57 ngày 2026-10-31 (review cuối + một lượt sửa, 0 blocker/major còn mở; G3 giữ nguyên 3 quyết định: Ruling sửa bảo mật F7, khoá autonomy đã commit chỉ cảnh báo, không sửa baseline AGENTS)
- Requirement: không có
## Vấn đề và lý do
Ba lượt thử chế độ part cho thấy một request phải quay lại chat 15–20 lần: hỏi trước mỗi nhóm Song song, mở và trust phiên part, hỏi riêng merge local, dọn worktree, xoá nhánh, cộng các dòng báo trạng thái từ phiên con. Phần lớn là việc đảo ngược được, đã có kiểm chứng máy (test, review, ledger), nên không cần người duyệt từng bước. Người dùng muốn: việc tự động được thì tự làm; việc cần người kiểm thì dừng một lần và chờ duyệt.
## Quyết định đã chốt
- (1) Một request chỉ dừng ở 3 cổng cố định: G1 duyệt design, G2 duyệt plan, G3 duyệt diff cả nhánh (kèm `rulings`, finding còn lại). Push/PR/publish chỉ hỏi ở cuối nhánh (sau G3) hoặc khi người dùng yêu cầu. Ngoài ra chỉ dừng ở 6 loại dừng của `task-loop.md` (không đổi). Giữa G2 và G3 chạy liền, không hỏi.
- (2) Câu hỏi làm rõ yêu cầu gom vào một tin nhắn trước G1 (không hỏi từng câu qua nhiều lượt).
- (3) Khoá mới `autonomy` trong `.claude/aip-gate.json` (đọc theo cùng thứ tự worktree → repo chính như các khoá khác): `{ "mergeLocal": bool, "cleanup": bool, "partRunner": "subagent" | "session" | "sequential" }`. Thiếu khoá = hành vi hiện nay (an toàn): hỏi merge local, hỏi dọn, hỏi cách chạy part.
- (4) `mergeLocal: true`: duyệt G3 cũng là đồng ý merge `--no-ff` nhánh feature vào nhánh gốc local, chạy full suite trên kết quả merge, đặt Trạng thái `merged`, bỏ `plan.md` (W16). Suite đỏ thì dừng, không dọn gì.
- (5) `cleanup: true`: sau merge local xanh, tự gỡ worktree sạch và xoá nhánh đã nằm trong nhánh gốc (`git merge-base --is-ancestor`), báo một dòng. Nhánh chưa merge giữ nguyên.
- (6) `partRunner: "subagent"`: không hỏi trước nhóm Song song. Session gốc tự tạo worktree theo quy ước `worktree-<slug>-p<nn>`, giao mỗi part cho một subagent chạy nền (`general-purpose`, `model: sonnet`) làm việc chỉ trong đường dẫn worktree đó theo `inline.md` (subagent không gọi được agent khác nên không có review từng task trong part), tự commit từng task trên nhánh part qua `git-workflow` (subagent part đóng vai session của part, ngoại lệ của luật "agent không commit"), ghi `Part: complete <hash>`; review cuối toàn nhánh vẫn chạy như cũ. `"session"` giữ cách hiện nay (phiên thật, câu hỏi bước 3); `"sequential"` chạy tuần tự trong session gốc.
- (7) Báo cáo: session gốc không gửi dòng trạng thái giữa chừng (kể cả khi phiên con hoặc subagent xong một lượt); chỉ nói ở G1, G2, G3, câu hỏi push, loại dừng, hoặc lỗi chặn.
- (8) Lệnh mới `aip autonomy high|safe|status` (scope project, giống `aip mode`): `high` ghi `{ mergeLocal: true, cleanup: true, partRunner: "subagent" }`, `safe` xoá khoá, `status` in giá trị hiệu lực. Script `plan-execution/scripts/autonomy.mjs` in JSON hiệu lực để skill đọc, zero-dependency.
## Tiêu chí chấp nhận
- [x] **AC1.1** — Given request chạy `workflow-feature` When đi từ làm rõ tới kết thúc nhánh Then chỉ dừng chờ người dùng ở G1, G2, G3, câu hỏi push và 6 loại dừng; tài liệu `workflow-feature` và `plan-execution` nêu đúng danh sách này
- [x] **AC2.1** — Given yêu cầu cần làm rõ When ở Bước 2 của `workflow-feature` Then mọi câu hỏi gom trong một tin nhắn
- [x] **AC3.1** — Given `aip-gate.json` có khoá `autonomy` hợp lệ When chạy `autonomy.mjs` Then in JSON đủ ba trường với giá trị đã ghi
- [x] **AC3.2** — Given không có khoá `autonomy`, hoặc giá trị sai kiểu/ngoài tập When chạy `autonomy.mjs` Then in mặc định an toàn `{ mergeLocal: false, cleanup: false, partRunner: "session" }` cho trường đó
- [x] **AC3.3** — Given worktree không có `aip-gate.json` riêng When chạy `autonomy.mjs` trong worktree Then đọc khoá của repo chính
- [x] **AC4.1** — Given `mergeLocal: true` và người dùng duyệt G3 When kết thúc nhánh Then `finish.md` merge local, chạy full suite, đặt `merged` mà không hỏi thêm; suite đỏ thì dừng
- [x] **AC5.1** — Given `cleanup: true` và merge local xanh When dọn Then `finish.md` chỉ gỡ worktree sạch và xoá nhánh đã là tổ tiên của nhánh gốc
- [x] **AC6.1** — Given `partRunner: "subagent"` và nhóm Song song sạch `check-partition` When tới nhóm đó Then `task-loop.md` không hỏi, tạo worktree theo quy ước, giao subagent nền theo `inline.md`, merge khi có `Part: complete`
- [x] **AC7.1** — Given phiên con hoặc subagent xong một lượt không cần người dùng quyết When session gốc nhận note Then không gửi tin nhắn trạng thái
- [x] **AC8.1** — Given project bất kỳ When chạy `aip autonomy high`, `safe`, `status` Then lần lượt ghi preset, xoá khoá, in giá trị hiệu lực; các khoá khác của `aip-gate.json` giữ nguyên
- [x] **AC9.1** — Given `aip autonomy high` và một request 2 part Song song trên `aip-parts-trial` When chạy từ G2 tới G3 Then không có lượt dừng nào ngoài cổng, và cả hai part merged qua subagent
## Thiết kế
- `core/skills/plan-execution/scripts/autonomy.mjs`: đọc gate theo thứ tự của `workspace.mjs`/hook (gốc worktree, rồi gốc repo chính), chuẩn hoá từng trường về mặc định khi sai.
- `cli/lib/mode.mjs` (hoặc file mới `cli/lib/autonomy.mjs` theo cùng mẫu `runMode`) + định tuyến trong `cli/index.mjs`/`args.mjs`.
- Câu chữ: `workflows/feature/WORKFLOW.md` (Bước 2, Checkpoint), `plan-execution/SKILL.md`, `references/task-loop.md` ("Chế độ part" bước 3–6, quy tắc báo cáo), `references/finish.md` (G3, mergeLocal, cleanup, push hỏi riêng).
## Ảnh hưởng spec
- workflows: đổi R7
- workflows: đổi R14
- hooks-gates: thêm R15
- cli-wizard: thêm R6
## Ngoài phạm vi và anti-goal
- Không tự push hay tạo PR; không khoá nào bật push tự động.
- Không đổi 6 loại dừng và không bỏ G1/G2/G3.
- Không đổi `aip mode` (quyền công cụ) và không gộp với `autonomy` (mức hỏi của luồng).
- Không làm review từng task bên trong part chạy bằng subagent.
## Ràng buộc
- Zero-dependency; bump `core`, `workflows`; `node cli/lib/versions.mjs --lock`; `npm test` xanh.
## Không đổi
- Thiếu khoá `autonomy` thì luồng hỏi như hiện nay.
- `partRunner: "session"` giữ nguyên câu hỏi bước 3 của "Chế độ part".
## Kiểm thử
- AC3.1–AC3.3: test có tham số cho `autonomy.mjs` (`test/content/` cùng chỗ test script plan-execution).
- AC8.1: test `runAutonomy` theo mẫu test của `aip mode`.
- AC1.1, AC2.1, AC4.1–AC7.1: câu chữ, kiểm ở lượt thử AC9.1; ghi kết quả vào `trial-4.md`.
## Để builder quyết
- Tên file CLI (`mode.mjs` mở rộng hay `autonomy.mjs` riêng).
## Rủi ro và câu hỏi mở
- [Unverified] Subagent nền giữ được cwd trong worktree giữa các lệnh Bash và hook `guard-files`/`session-start` áp đúng theo đường dẫn worktree; lượt thử AC9.1 phải kiểm.
- Part chạy bằng subagent không có review từng task; lỗi chỉ được bắt ở review cuối toàn nhánh (đổi lấy việc không phải mở phiên và trust).
- `mergeLocal` vào nhánh protected local: vẫn là merge local, push vẫn hỏi; người dùng đã chọn ở brainstorm 2026-10-31.
