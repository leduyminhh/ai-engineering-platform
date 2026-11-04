# Mẫu báo cáo lệch (chạy lại)

Nạp ở bước 7 khi `docs/specs/` đã có spec. Báo cáo nằm trong chat, không ghi file. Skill không sửa spec.

## Mẫu

```markdown
## Báo cáo lệch spec sống — <yyyy-mm-dd>

**Phạm vi đã đối chiếu:** <năng lực nào, spec nào>
**Chưa đối chiếu:** <năng lực, thư mục hoặc R không kiểm được và lý do>
**Citation hỏng (check-citations):** <số, hoặc "0">

### Nhóm 1: R không còn đúng với code

| Spec | R | Hành vi hiện tại (file:line) | Chênh lệch | Hướng xử lý |
|---|---|---|---|---|
| `billing` | `billing/R3` | `src/billing/late-fee.ts:24` | Code tính phí theo tháng, R ghi theo ngày | Mở request để đổi R, hoặc sửa code |

### Nhóm 2: hành vi chưa có R

| Năng lực đề xuất | Hành vi | Bằng chứng | Hướng xử lý |
|---|---|---|---|
| `billing` | Hoàn phí khi huỷ trong 24 giờ | `src/billing/cancel.ts:57`, test "refunds within 24h" | Mở request thêm R; skill không tự thêm |

### Kết luận ngắn
- Nhóm 1: <n> R. Nhóm 2: <m> hành vi.
- Không có file nào bị ghi trong lần chạy này.
```

## Quy tắc viết

- **Nhóm 1** là R mà code hiện tại làm khác, hoặc code không còn nữa. Mỗi dòng có `file:line` hiện tại làm bằng chứng. Nếu chỉ suy được từ code, ghi `[Unverified]`.
- **Nhóm 2** là hành vi có bằng chứng trong code hoặc test nhưng không có R nào. Chỉ ghi khi có `file:line` và tên test thật.
- Không đánh giá chất lượng code; báo lệch so với spec là đủ.
- Hướng xử lý luôn qua request thường: design khai `## Ảnh hưởng spec` rồi bước gộp cập nhật spec. Skill không tự sửa spec.
- Mục chưa đối chiếu luôn có, kể cả khi rỗng ("không có").
- Nguồn của báo cáo: findings của các subagent chỉ đọc (bước 7 của skill) và số citation hỏng từ `check-citations.mjs`; session chính không tự đánh giá lại code.
- Nếu một R có Nguồn là request đã `merged` nhưng code lệch, ghi vào nhóm 1 và nêu cả request lẫn code.
