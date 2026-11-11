# Mẫu prompt: review cuối toàn nhánh

Chạy một lần sau task cuối, khi mọi task đã `complete` trong ledger (khi có part: mọi part đã `merged <hash>` hoặc `bỏ`). Gọi `backend-reviewer` và/hoặc `frontend-reviewer` theo
phía bị chạm (hai phía thì gọi song song), mỗi lần với `model: opus`. Diff toàn nhánh không chạm phía backend hay frontend (chỉ tooling, script, docs) thì gọi `general-purpose` với `model: opus` thay cho hai reviewer đó, cùng mẫu prompt bên dưới. Song song với đó là `engineering-quality-auditor`
(quality + security gate); auditor chỉ chạy ở review cuối nhánh, không chạy ở review từng task.

Package là toàn nhánh: `node <thư mục skill plan-execution>/scripts/review-package.mjs <MERGE_BASE> <HEAD> --plan <plan.md>` với
`MERGE_BASE` = `git merge-base HEAD <nhánh gốc>` và `<plan.md>` là plan gốc; luôn dùng `--plan` (package ghi vào workspace `.aip/`) để diff toàn nhánh không đổ vào context session chính.

```
Review cuối toàn nhánh cho plan <đường dẫn plan.md>, chế độ final-review. Bạn chỉ đọc; không sửa file, không commit,
không gọi agent khác.

Đầu vào:
- Review package toàn nhánh: <đường dẫn>, khoảng <MERGE_BASE>..<HEAD>.
- Plan: <đường dẫn plan.md>, spec/design: <đường dẫn>. Coi spec là tầm nhìn, không phải danh sách kiểm: im lặng của spec
  không phải là cho phép.
- Review Focus của plan (các failure mode design ngụ ý mà test từng task có thể chưa phủ): <dán mục Review Focus>.
- Request chia part: Bảng part (`## Bảng part` của design) và các interface giữa part (`**Interfaces:**` Produces/Consumes qua ranh giới part) là Review Focus bắt buộc: <dán Bảng part và danh sách interface giữa part>.
- Các dòng Ruling: đã ghi trong ledger (quyết định của session chính trong lúc chạy; request chia part: ledger `root/` và mọi ledger part `<nn>-<part-slug>/`): <dán output của `node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md gốc> --rulings`: mỗi Ruling kèm nguồn, lệnh `chạy lại:` và cờ>.
- Danh sách task ghi `cỡ nhỏ` (lấy từ các dòng ledger `review cuối — cỡ nhỏ`; ghi "không có" nếu rỗng): <dán danh sách task và commit>.
- Finding minor/nit đã hoãn (cùng các ledger như trên): <dán các dòng minor (deferred)>. Finding blocker/major đã hoãn nằm trong các dòng Ruling:
  ở trên, kèm mức gốc.

Cách làm:
1. Đọc kỹ diff của các task ledger ghi `cỡ nhỏ` (đã bỏ review từng task, chỉ có đối chiếu `**Files:**` sau commit): đây là lần review đầu của chúng.
   Rồi tìm lỗi mà review từng task không thấy: tích hợp giữa các task, interface lệch tên/kiểu, hồi quy, phần plan hứa mà
   không ai làm, từng mục Review Focus có test phủ thật không.
2. Xét từng Ruling: có đúng không, chi phí nếu sai có chấp nhận được không; Ruling nào chạm không-đảo-ngược, bảo mật,
   schema DB hay tác động ngoài repo thì gắn nhãn cần người dùng quyết. Đối chiếu lý do của mọi Ruling với diff và file
   trong repo (vd "đã có test phủ" thì mở test đó). Ruling có `chạy lại:` mà lệnh chỉ đọc (test, build, lint) thì chạy lệnh và ghi `rerun` (command, exit_code, matches) vào mục ruling_review[] của nó;
   lệnh ghi file hay tác động ngoài repo thì không chạy, ghi vào declined_to_judge[]. `matches: false`, cờ `số đo không có lệnh chạy lại`, hoặc lý do sai với code (kèm file:line) → gắn nhãn cần người dùng quyết; không tự biến thành finding sửa code.
3. Xét lại các minor đã hoãn: gom lại thành mảng lỗi nào đáng sửa ngay không.
4. Được chạy lệnh chỉ đọc, kể cả test/build, để lấy evidence; ghi lệnh và kết quả.
5. Thang severity của contract đầu ra; mỗi finding có location file:line và evidence; tự đọc lại trước khi trả.
6. Liệt kê điều bạn bỏ qua trong declined_to_judge[] kèm lý do.
7. Finding chỉ sửa được bằng cách đổi nghĩa hoặc câu chữ một AC đã duyệt: không chọn hướng sửa, ghi vào questions[]
   gồm AC ID, các cách hiểu, và hệ quả của từng cách hiểu. Finding ngoài AC mà chỉ sửa được bằng cách đổi hành vi hoặc API (ném lỗi mới, mã lý do mới, tham số mới): cũng không chọn hướng sửa, gắn nhãn `ngoài AC` kèm hệ quả để thẻ G3 hỏi người dùng.
8. Gắn nhãn `trong AC` hoặc `ngoài AC` cho mỗi finding. Finding kiểm đầu vào cho dữ liệu do code hoặc cấu hình nội bộ khai báo: theo mục "Ranh giới tin cậy" của skill `principles` (bản cài plugin: `core:principles`; nguồn `core/principles/trust-boundary.md`), tối đa `minor`, trừ finding vi phạm AC hay tiêu chí đã duyệt (vẫn `major` trở lên).

Trả khối agent_result: findings[], validation[], ruling_review[], declined_to_judge[], remaining_risks[], questions[].
```

`review clean` = không còn blocker/major mở **trong phạm vi**; finding ngoài AC đi theo mục "Nhận review" của `task-loop.md`.

Sau review cuối, chỉ một lần sửa cho toàn bộ finding blocker/major trong phạm vi (một dispatch, `model: sonnet`: logic subagent theo bảng routing của baseline) và một lần re-review có
phạm vi theo `prompts/re-review.md`; không có làn sửa thứ hai. Finding còn lại và `Ruling:` cần quyết trình người dùng ở
bước kết thúc nhánh (`references/finish.md`).

AC mới do người dùng chốt từ `questions[]` (mục 7): người dùng duyệt câu AC trong `design.md` trước; session chính thêm `### Task <n>` sửa vào plan gốc, có `**TDD:**`, `**Kind:**`, `**Phủ AC:**` (gồm AC mới) và `**Files:**` với `- Test:`, đúng mẫu task của plan, để `check-request.mjs` không báo W6. Task này đi chung
đúng một lần dispatch sửa và một lần re-review ở trên, không mở làn sửa thứ hai. Ghi BASE (bước 1 của `task-loop.md`) trước lần dispatch sửa; sau re-review, ghi dòng
`Task <n>: complete (…)` của task này theo bước 9 của `task-loop.md`, để lần làm tiếp sau compact không làm lại task đó.
