# Chờ theo điều kiện thay cho `sleep` cố định

Test flaky do thời gian thường có dạng "chờ N giây rồi kiểm". N có thể đúng trên máy này nhưng sai trên máy khác. Quy tắc của dự án:
không `sleep` cố định trong test, chờ điều kiện với thời hạn ngắn nhất vẫn ổn định.

## Cách làm

1. **Xác định điều kiện thật** mà test đang chờ (một bản ghi xuất hiện, một cờ đổi trạng thái, một tiến trình thoát).
2. **Poll điều kiện đó** với chu kỳ ngắn và một thời hạn tối đa; hết hạn thì thất bại với thông báo nêu điều kiện đang chờ.
3. **Không tăng thời hạn** để làm xanh. Test chỉ xanh khi mới tăng thời hạn là dấu hiệu điều kiện chưa đúng.

`condition` phải trả giá trị truthy khi sẵn sàng và không ném lỗi khi chưa sẵn sàng (giá trị falsy như `0` hay `''` được coi
là chưa sẵn sàng).

```js
// waitFor: poll một điều kiện, thất bại rõ ràng khi hết hạn (không sleep cố định).
async function waitFor(condition, { timeoutMs = 2000, intervalMs = 20, what = 'điều kiện' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await condition();
    if (value) return value;
    if (Date.now() >= deadline) throw new Error(`hết ${timeoutMs}ms mà ${what} chưa xảy ra`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
```

## Phân loại nguyên nhân flaky

| Nhóm | Dấu hiệu | Hướng xử lý |
|---|---|---|
| Race | Kết quả đổi theo thứ tự hoàn thành | Chờ sự kiện hoàn thành, không chờ thời gian |
| Dùng chung trạng thái | Chạy riêng qua, chạy chung đỏ | Xem `polluter-bisect.md` |
| Phụ thuộc đồng hồ | Đỏ gần nửa đêm, cuối tháng, đổi múi giờ | Tiêm đồng hồ giả |
| Phụ thuộc mạng | Đỏ khi mạng chậm | Thay bằng fake ở ranh giới hệ thống |
| Phụ thuộc thứ tự test | Đổi thứ tự thì đổi kết quả | Mỗi test tự dựng dữ liệu của mình |

Khi dùng `waitFor` mà vẫn flaky, điều kiện đang chờ chưa phải điều kiện thật; quay lại pha điều tra.
