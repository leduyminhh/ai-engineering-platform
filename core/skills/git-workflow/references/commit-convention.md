# Quy ước commit message

File này là điểm vào duy nhất cho việc viết commit message. Chỉ nạp thêm
`commit-templates.md` / `commit-examples.md` / `config-env-rules.md` khi thay đổi
thật sự cần tới mức hướng dẫn đó.

## Luồng chọn

1. Xác định cỡ thay đổi: `small`, `medium`, `large`, hoặc `breaking`.
2. Chọn type + scope nhỏ nhất mà vẫn đúng sự thật.
3. Nạp [commit-templates.md](commit-templates.md) khi cần template daily, structured,
   multi-module, long body, refactor, fix, breaking, architecture, hoặc PR notes.
4. Commit một dòng CHỈ khi thay đổi nhỏ và title đã giải thích trọn vẹn.
5. Tách các thay đổi không liên quan thành commit riêng thay vì giấu trong một template lớn.

## Định dạng

```text
type(scope): short summary

Changed:
- ...
  • ...
- ...

Reason:
- ...

Important notes / Breaking impact:
- ...
  • ...
```

- Title: tiếng Anh, thể mệnh lệnh, thường dưới 72 ký tự.
- Body: tiếng Việt CÓ DẤU (UTF-8) mặc định, trừ khi người dùng/repo nói khác.
- Commit message hiển thị dạng plain text: KHÔNG bọc tên file, định danh, lệnh, cờ trong
  backtick — viết trần (vd: update .env, chạy aip install, mục Changed). Chỉ dùng backtick
  khi token thật sự không đọc nổi nếu thiếu.
- Breaking change: thêm `!` vào header, kèm `BREAKING CHANGE:` và mục `Migration:` khi
  consumer phải hành động.

## Type cho phép

`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`,
`revert`, `merge`.

## Scope

Ưu tiên: tên feature/module, vùng infra/runtime, tên tooling/workflow, đích docs.
Ví dụ: `auth`, `camera`, `rtsp`, `workflow`, `docker`, `config`, `readme`, `agents`.
Tránh scope rộng như `system`, `core`, `misc` trừ khi thật sự không tránh được.

## Quy tắc body

`Changed` và `Reason` là BẮT BUỘC; `Important notes / Breaking impact` thêm khi có tác
động (xem [config-env-rules.md](config-env-rules.md) cho các trường hợp bắt buộc).

Mỗi mục chứa:

- 1 đến 5 bullet chính, tuỳ cỡ thay đổi thật.
- Chỉ những thay đổi có ý nghĩa, gom theo hành vi hoặc ý định workflow.
- Bullet chính `- ...`; dòng chi tiết tuỳ chọn thụt vào `  • ...` (0–3 dòng mỗi bullet).
- Các bullet chính viết LIỀN NHAU, KHÔNG chèn dòng trống giữa chúng; dòng trống chỉ dùng
  để ngăn cách các mục Changed / Reason / Important notes.

Tránh: lặp lại title, bình luận format vụn vặt, kể lể từng file một (trừ khi thay đổi
thuần cấu trúc). Đọc diff như một reviewer: nói ý định, hành vi, workflow, tác động vận
hành và bảo trì — luồng chính trước, luồng phụ sau.

### Body dài

Coi body là DÀI khi cỡ là `large`/`breaking`, hoặc một mục cần từ 3 bullet chính dày trở
lên. Khi đó:

- Mỗi bullet chính là một câu tóm tắt ngắn; chuyển facts phụ trợ xuống 1–3 dòng `•` bên dưới.
- Gom component, cờ, artifact, ràng buộc, luồng phụ dưới đúng hành vi cha mà chúng phục vụ.
- Mối quan tâm độc lập vẫn là bullet chính riêng — KHÔNG nest thứ không liên quan chỉ để
  giảm số bullet.

### Tách commit

Tự tách commit khi thay đổi là các workflow độc lập, fix không liên quan, hoặc mối quan
tâm vận hành tách bạch. Gom theo hành vi / workflow / tác động deploy / ý định feature,
không gom chỉ theo loại file. Tránh cả commit trộn khổng lồ lẫn micro-commit vô nghĩa.

### Commit refactor

Nói rõ độ phức tạp nào được giảm, trùng lặp nào được gỡ, cấu trúc nào dễ bảo trì hơn.
KHÔNG nhận có thay đổi hành vi nếu diff không thể hiện.

### Commit perf

Mô tả bottleneck/hot path, luồng bị ảnh hưởng, và tác động tài nguyên khi thấy được
(CPU, memory, startup, IO, latency).

## Sinh tự động (grounding)

Khi tự sinh commit message, rút nghĩa từ: staged diff, code xung quanh, quy ước đặt tên,
comment/config lân cận — theo góc nhìn developer: họ cải thiện, sửa, đơn giản hoá, hay
mở khoá được gì.

KHÔNG bịa: migration, breaking change, ảnh hưởng bảo mật, cải thiện hiệu năng — trừ khi
diff trực tiếp chứng minh. Ý định không rõ → chọn từ ngữ trung tính, không giải thích quá tay.

## An toàn encoding

- Đọc/ghi commit text bằng UTF-8; giữ nguyên dấu tiếng Việt.
- Ghi toàn bộ message vào file UTF-8 và commit bằng `git commit -F <file>`.
- Trước khi commit, chạy `node <thư mục skill>/scripts/check-commit-message.mjs <file>` (hoặc
  `scripts/test-commit-message-encoding.ps1 -MessageFile <file>` trên PowerShell) khi body có tiếng Việt.
- Sau khi commit, kiểm tra `git log -1 --format=%B`; amend ngay nếu tiếng Việt bị hỏng.
- Terminal hỏng encoding → sửa encoding trước, KHÔNG âm thầm bỏ dấu trừ khi người dùng
  chấp nhận tường minh sự đánh đổi đó.
- KHÔNG thêm bất kỳ dòng nào có prefix `Co-authored-by` / `Co-Authored-By` hay attribution
  của assistant vào commit message, PR body, tag/release notes.
