# Nguồn kiểm kê và bảng nguồn của R

Nạp ở bước 1 của skill. Mục tiêu: đủ bằng chứng để đề xuất danh sách năng lực, chưa phải để viết hết R.

## Thứ tự rẻ → đắt

Dừng ở bước nào thì đủ để đề xuất năng lực thì dừng ở đó.

1. **Docs có sẵn** (đọc mục lục và tiêu đề, không đọc hết): `project-knowledge/` hoặc `docs/project-knowledge/`
   (kiến trúc, tech stack), ARD / overview / README, `docs/decisions/` (ADR), `docs/contracts/` (OpenAPI),
   `docs/runbooks/`. Docs cũ chỉ là gợi ý; code là nguồn cuối khi hai bên lệch.
2. **Request đã hiện thực.** Liệt kê `docs/requests/*/design.md` và lấy token đầu của dòng `- Trạng thái:`.
   Chỉ token `merged` mới là nguồn loại 1. Thiếu dòng hoặc token khác (`approved`, `in-progress`, `draft`,
   `abandoned`) thì không dùng làm nguồn. Lệnh chỉ đọc:

   ```bash
   grep -H -m1 -E '^-\s+Trạng thái\s*:' docs/requests/*/design.md
   ```

   Mục "Ảnh hưởng spec" của design `merged` cho biết năng lực nào đã được khai báo.
3. **Điểm vào code**: route/controller/handler, job/worker/consumer, schema/migration. Tìm theo tên nghiệp vụ,
   không theo tên module kỹ thuật:

   ```bash
   git ls-files | grep -icE 'controller|handler|route|job|worker|migration'   # đếm trước; trên 100 thì head cắt kết quả, thu hẹp theo thư mục
   git ls-files | grep -iE 'controller|handler|route|job|worker|migration' | head -100
   ```

4. **Tên test.** Tên test thường là câu hành vi có sẵn, dùng làm bằng chứng loại 2:

   ```bash
   grep -rnE "(^|\s)(it|test|describe)\(|def test_|@Test" <thư mục nguồn> | wc -l   # đếm trước; trên 200 thì head cắt, thu hẹp thư mục
   grep -rnE "(^|\s)(it|test|describe)\(|def test_|@Test" <thư mục nguồn> | head -200
   ```

Đừng đọc toàn bộ code để chia năng lực: chia theo luồng nghiệp vụ mà docs, request và điểm vào cho thấy.

## Đề xuất năng lực (bước 2)

Mỗi năng lực một dòng:

| Tên (kebab) | Mục đích (một câu) | Gồm | Không gồm | Thư mục nguồn | Request liên quan |
|---|---|---|---|---|---|
| `billing` | Phát hành, thu và đối soát hoá đơn | hoá đơn, job nhắc nợ | hoàn tiền (`refunds`) | `src/billing/` | `2026-03-02-refund-partial` |

Sau bảng luôn có hai mục: **Chưa kiểm kê** (thư mục, docs hoặc request chưa đọc) và **Chưa chắc gộp hay tách** (lý do).

## Bảng nguồn của R

Mỗi R chỉ có một loại nguồn. Loại được chọn theo bằng chứng mạnh nhất còn tồn tại:

| Loại | Điều kiện | Ghi trong dòng Nguồn | Ghi chú |
|---|---|---|---|
| 1. Request đã merge | Design có token `merged` và code khớp hành vi | `[<slug>](../../requests/<ngày>-<slug>/design.md)` | Kiểm code còn khớp trước khi chọn loại này |
| 2. Code và test | Có test đặt tên theo hành vi | `` `file:line` `` + tên test trong ngoặc | Dòng `file:line` là dòng khai báo test hoặc dòng thực thi hành vi |
| 3. Chỉ suy từ code | Không có test hay doc xác nhận | `` `file:line` `` + `[Unverified]` | Ghi rõ đang suy từ code; không viết như sự thật đã kiểm |
| 4. Design lệch code | Design `merged` nhưng code làm khác | `` `file:line` `` (code) + `lệch: [<slug>](…/design.md)` | R theo code, không theo design |

Quy tắc chung:

- Không suy ra hành vi từ tên hàm. Cần một dòng code hoặc test cụ thể.
- Không đoán tên test. Chỉ ghi tên test thật đã đọc được.
- Mơ hồ (không rõ đúng hay sai, hai bằng chứng mâu thuẫn không giải quyết được) → mục `## Câu hỏi mở`, không thành R.
- Request chưa `merged` không dùng làm nguồn, kể cả khi design mô tả rất rõ.
- Đừng thêm R để "đủ số": spec chỉ có những hành vi có bằng chứng.
