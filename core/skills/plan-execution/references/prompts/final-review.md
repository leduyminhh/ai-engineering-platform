# Mẫu prompt: review cuối toàn nhánh

Chạy một lần sau task cuối, khi mọi task đã `complete` trong ledger. Gọi `backend-reviewer` và/hoặc `frontend-reviewer` theo
phía bị chạm (hai phía thì gọi song song), mỗi lần với `model: opus`. Song song với đó là `engineering-quality-auditor`
(quality + security gate); auditor chỉ chạy ở review cuối nhánh, không chạy ở review từng task.

Package là toàn nhánh: `review-package.mjs <MERGE_BASE> <HEAD>` với `MERGE_BASE` = `git merge-base HEAD <nhánh gốc>`.

```
Review cuối toàn nhánh cho plan <đường dẫn plan.md>, chế độ final-review. Bạn chỉ đọc; không sửa file, không commit,
không gọi agent khác.

Đầu vào:
- Review package toàn nhánh: <đường dẫn>, khoảng <MERGE_BASE>..<HEAD>.
- Plan: <đường dẫn plan.md>, spec/design: <đường dẫn>. Coi spec là tầm nhìn, không phải danh sách kiểm: im lặng của spec
  không phải là cho phép.
- Review Focus của plan (các failure mode design ngụ ý mà test từng task có thể chưa phủ): <dán mục Review Focus>.
- Các dòng Ruling: đã ghi trong ledger (quyết định của session chính trong lúc chạy): <dán nguyên các dòng Ruling:>.
- Finding minor đã hoãn: <dán các dòng minor (deferred)>.

Cách làm:
1. Tìm lỗi mà review từng task không thấy: tích hợp giữa các task, interface lệch tên/kiểu, hồi quy, phần plan hứa mà
   không ai làm, từng mục Review Focus có test phủ thật không.
2. Xét từng Ruling: có đúng không, chi phí nếu sai có chấp nhận được không; Ruling nào chạm không-đảo-ngược, bảo mật,
   schema DB hay tác động ngoài repo thì gắn nhãn cần người dùng quyết.
3. Xét lại các minor đã hoãn: gom lại thành mảng lỗi nào đáng sửa ngay không.
4. Được chạy lệnh chỉ đọc, kể cả test/build, để lấy evidence; ghi lệnh và kết quả.
5. Thang severity của contract đầu ra; mỗi finding có location file:line và evidence; tự đọc lại trước khi trả.
6. Liệt kê điều bạn bỏ qua trong "Declined to judge".

Trả khối agent_result: findings[], validation[], ruling_review[], remaining_risks[].
```

Sau review cuối, chỉ một lần sửa cho toàn bộ finding blocker/major (một dispatch, `model: opus`) và một lần re-review có
phạm vi theo `prompts/re-review.md`; không có làn sửa thứ hai. Finding còn lại và `Ruling:` cần quyết trình người dùng ở
bước kết thúc nhánh (`references/finish.md`).
