# ADR-0002: Chuẩn code convention và lint/format

- Trạng thái: Accepted
- Ngày: <yyyy-mm-dd>
- Người quyết định: <tên>

## Bối cảnh và vấn đề

Cần một bộ quy ước code thống nhất, ràng buộc cho cả người và AI (Cowork/Code) để
diff sạch, dễ review, giảm tranh luận style. Chi tiết đầy đủ ở
project-knowledge/code-convention.md.

## Yếu tố quyết định

- Code đồng nhất giữa người và AI.
- Review nhanh, ít tranh luận style.
- Chi phí bảo trì convention thấp.

## Các phương án

- Theo style guide chuẩn của ngôn ngữ/cộng đồng (ví dụ <...>).
- Convention tùy biến nội bộ.
- Không ràng buộc.

## Kết quả quyết định

Chọn phương án "theo style guide chuẩn của ngôn ngữ/cộng đồng", vì phổ biến và ít tranh cãi.

- Chốt bộ convention: <tên style guide / tùy biến> + formatter `<...>` + linter `<...>`.
- Chi tiết quy ước: project-knowledge/code-convention.md (nguồn sự thật).
- Bắt buộc: format + lint pass trước commit; CI chặn nếu fail.

### Hệ quả

- Tốt, vì code đồng nhất, review nhanh, AI sinh code đúng chuẩn ngay.
- Xấu, vì cần cấu hình tool + CI ban đầu; mọi người phải cài hook/format.
- Việc phải làm: thêm config formatter/linter, (tùy chọn) pre-commit hook + bước CI.

### Xác nhận

CI chạy format + lint và chặn merge khi fail.

## Ưu nhược từng phương án

### Theo style guide chuẩn của ngôn ngữ/cộng đồng

- Tốt, vì phổ biến, ít tranh cãi.
- Xấu, vì ít chỗ tùy biến cho nhu cầu riêng.

### Convention tùy biến nội bộ

- Tốt, vì linh hoạt.
- Xấu, vì tốn công bảo trì.

### Không ràng buộc

- Xấu, vì mỗi người một kiểu, gây diff bẩn. Loại.
