# ADR-0005: Task cỡ Nhỏ bỏ review từng task, chỉ review cuối

- Trạng thái: Proposed
- Ngày: 2026-11-11
- Người quyết định: người dùng (chờ chốt Status)

Liên kết:
- Thiết kế: [`2026-11-11-skill-enrichment-from-usage/design.md`](../requests/2026-11-11-skill-enrichment-from-usage/design.md) (D8, D9).
- Nối tiếp [ADR-0002](0002-model-and-session-routing.md) và [ADR-0003](0003-long-session-context.md).

## Bối cảnh và vấn đề

`plan-execution` buộc review từng task ở mọi cỡ task, trừ chế độ inline và part chạy bằng subagent (`SKILL.md`, bảng tự biện minh; `inline.md`). Người dùng project nguồn phàn nàn nhiều lần về tốc độ và đề nghị bỏ review từng task cho việc nhỏ hoặc cơ học, vẫn review ở việc có backend, bảo mật hay migration. Câu hỏi: task nào được bỏ review từng task mà không để lọt lỗi tới sau review cuối?

## Yếu tố quyết định

- Giảm số lượt review ở việc rủi ro thấp (ledger nguồn: 58 trên 136 task phải review từ vòng 2, số sơ bộ chưa phải số nền).
- Không bỏ review ở việc có backend, migration, bảo mật (anti-goal của brief).
- Không thêm trường vào plan hay cảnh báo mới vào `check-request.mjs`.
- Quyết định đo được từ `**Kind:**`, `**TDD:**`, `**Files:**` đã có.

## Các phương án

- A. Giữ review từng task ở mọi cỡ.
- B. Thêm trường `**Cỡ:**` vào plan, người viết plan tự gắn.
- C. Suy cỡ từ `Kind`, `TDD`, `Files` bằng điều kiện đủ cả bốn; task cỡ Nhỏ chỉ review cuối.

## Kết quả quyết định

Chọn phương án C, vì đạt cả bốn yếu tố: không đổi plan hay validator, loại cả nhóm backend, migration, bảo mật bằng điều kiện đo được.

Cỡ Nhỏ khi đủ cả bốn: (1) `Kind` là `FE-UI` hoặc `TOOLING`; (2) `**TDD:** không`; (3) không quá 5 file production; (4) `**Files:**` không có đường dẫn migration, auth/phân quyền, secret/credential, CI hoặc hook, và không đổi contract API hay schema. Mọi task khác là cỡ Lớn và review từng task như cũ, gồm `BE`, `DB`, `CT`, `FE-INT`, `E2E`, `DOCS` (finding docs đến muộn theo ledger nguồn; review `DOCS` chỉ tốn `haiku`) và task `**TDD:** có`. Cỡ Vừa dùng mục "Gom task nhỏ" đã có. Áp ở mọi chế độ còn review từng task (tuần tự không part; part `partRunner: session`); inline và part subagent đã bỏ review từng task nên không đổi.

### Hệ quả

- Tốt, vì task cỡ Nhỏ không tốn implementer-review-sửa theo vòng.
- Xấu, vì lỗi ở task cỡ Nhỏ chỉ bị bắt ở review cuối. Giảm bằng đối chiếu `git diff --name-only <BASE>..HEAD` với `**Files:**` sau commit (lệch hoặc chạm đường dẫn nhạy cảm thì nâng lên cỡ Lớn), dòng ledger `review cuối — cỡ nhỏ` và dòng nhắc reviewer cuối đọc kỹ diff các task đó.
- Xấu, vì ngưỡng 5 file lấy từ trần sẵn có và ghi chú của người dùng, chưa kiểm trên dữ liệu [Unverified].

### Xác nhận

Pin nội dung của part 01-core; số `pctReview2plus` và `outsideFilesPerRequest` đo bằng `scripts/ledger-metrics.mjs` trên các request sau đợt này.

## Ưu nhược từng phương án

### A. Giữ review mọi cỡ

- Tốt, vì không đổi gì.
- Xấu, vì chậm với việc nhỏ, đúng điều người dùng phàn nàn.

### B. Trường `**Cỡ:**` trong plan

- Tốt, vì tường minh.
- Xấu, vì đổi template và validator, và người viết plan có thể gắn "nhỏ" cho việc rủi ro.

### C. Suy cỡ từ Kind, TDD, Files

- Tốt, vì không đổi plan hay validator, loại sẵn backend, migration, bảo mật.
- Xấu, vì ngưỡng chưa kiểm trên dữ liệu và `Files` do plan khai có thể sót; bù bằng kiểm diff sau commit.

## Thông tin thêm

Xem lại khi số nền cho thấy task cỡ Nhỏ vẫn sinh finding nặng ở review cuối.
