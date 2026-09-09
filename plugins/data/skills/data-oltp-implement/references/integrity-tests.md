# Test toàn vẹn + chạy migration up/down

Tài liệu hướng dẫn kiểm chứng schema + migration TRƯỚC khi bàn giao. Mọi kiểm chạy trên **DB tạm**
(container/DB dev dùng một lần), KHÔNG chạm production. Báo cáo kết quả THẬT (lệnh + số pass/fail);
không tuyên bố hoàn tất khi chưa có bằng chứng. Ngôn ngữ đo được; `[giả định]` khi suy đoán.

## A. Chuẩn bị DB tạm

- Dựng một instance engine ĐÚNG loại + version của project (đọc `tech-stack.yml`). Khác version có
  thể khác hành vi khóa/kiểu dữ liệu — nêu `[giả định]` nếu buộc dùng version khác.
- Áp toàn bộ migration từ đầu (hoặc từ baseline đã chốt) để có schema hiện trạng, rồi mới test
  migration mới.

## B. Kiểm ràng buộc hoạt động đúng schema contract

Mỗi ràng buộc trong contract cần một kiểm CHỨNG MINH nó thực thi (dùng phép thử âm — thao tác vi
phạm PHẢI bị từ chối):

| Ràng buộc | Cách kiểm (kỳ vọng) |
|---|---|
| PRIMARY KEY / UNIQUE | Chèn 2 bản ghi trùng khóa → lần 2 BỊ từ chối |
| FOREIGN KEY | Chèn con trỏ tới cha không tồn tại → BỊ từ chối; xóa cha còn con → theo ON DELETE đã chốt |
| NOT NULL | Chèn thiếu cột bắt buộc → BỊ từ chối |
| CHECK | Chèn giá trị ngoài miền cho phép → BỊ từ chối |
| Index | Truy vấn catalog engine xác nhận index tồn tại đúng bảng/cột |

```
-- Ví dụ phép thử âm cho UNIQUE (minh họa) — kỳ vọng lệnh thứ hai lỗi
INSERT INTO customer (email) VALUES ('a@x.io');
INSERT INTO customer (email) VALUES ('a@x.io');  -- kỳ vọng: vi phạm unique
```

Ghi rõ mỗi phép thử: PASS nếu vi phạm bị chặn / cấu trúc tồn tại đúng, FAIL nếu ngược lại.

## C. Chạy migration up → down → up (reversible)

Xác nhận migration mới đảo ngược sạch và lặp lại được:

1. **up**: áp migration mới lên DB tạm → không lỗi.
2. **down**: hoàn tác → schema trở về trạng thái trước migration (đối chiếu cấu trúc bảng/cột/ràng
   buộc; công cụ diff schema nếu có).
3. **up lại**: áp lại → không lỗi (migration không phụ thuộc trạng thái sót lại từ lần trước).

`down` lỗi hoặc để lại cấu trúc lệch = migration CHƯA reversible → sửa trước khi bàn giao.

## D. Không mất dữ liệu ở dải backfill

Với migration có backfill/biến đổi dữ liệu:

- Nạp một tập dữ liệu mẫu đại diện (gồm ca biên: NULL, chuỗi rỗng, giá trị dài) TRƯỚC khi áp.
- So SỐ BẢN GHI và/hoặc checksum cột liên quan trước–sau migration; kỳ vọng không mất dòng ngoài
  chủ đích.
- Kiểm vài bản ghi mẫu đã backfill đúng logic (không chỉ đếm tổng).
- `[giả định]`: dữ liệu mẫu KHÔNG phản ánh 100% prod — nêu residual risk là backfill trên dữ liệu
  thật (khối lượng lớn, phân bố khác) có thể chậm/khóa lâu hơn hoặc lộ ca biên chưa phủ.

## E. Cổng kết luận

- Mọi phép thử ràng buộc PASS + chu trình up/down/up sạch + kiểm mất dữ liệu đạt → mới coi là xong
  bước test.
- Còn phép thử FAIL → DỪNG, phân tích, sửa migration/DDL; KHÔNG commit migration còn fail.
- Báo cáo: engine + version DB tạm, danh sách phép thử + kết quả, kết quả up/down/up, chênh lệch
  số bản ghi (nếu có backfill), và residual risk còn lại trước khi con người áp prod.
