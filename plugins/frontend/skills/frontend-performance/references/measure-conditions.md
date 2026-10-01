# Bảng điều kiện đo frontend — chốt TRƯỚC khi chạy, dùng lại nguyên trạng khi so sánh

Tài liệu tham chiếu cho `frontend-performance`, chế độ `measure` (cổng P2, P3). Dùng ở Bước 2 (Baseline) để
chốt điều kiện, và ở Bước 5 (Benchmark & so sánh) để **đọc lại đúng bảng đó** rồi chạy lại.

## Vì sao cần bảng điều kiện

Số lab của frontend nhạy với route, bản build, throttle và cache. Không có bảng ghi lại → Bước 5 không chứng
minh được "cùng điều kiện", và chênh lệch có thể đến từ nhiễu hoặc cache khác chứ không phải từ code. Bảng là
artifact, lưu cạnh script trong `perf/frontend/` (ví dụ `perf/frontend/<luồng>.conditions.md`) để con người duyệt
diff cùng script. Backend dùng `perf/backend/`, hai phía không ghi đè nhau.

## Bảng mẫu

Điền đủ mọi hàng trước khi chạy; hàng nào chưa biết → dừng, hỏi (P2; chạy như subagent: trả `blocked` + câu hỏi).
Không để trống, không ghi "như cũ".

| Mục | Giá trị | Ghi chú |
|---|---|---|
| Route/luồng | URL path trên localhost (vd `/orders`) hoặc chuỗi thao tác; dữ liệu mock/seed dùng | Tài khoản test qua biến môi trường, chỉ nêu tên biến; cấm staging/production (P1) |
| Build | commit SHA + `git diff --name-only` của working tree | Bước 5: diff code production chỉ gồm file của Bước 4; file ở hàng Config tool đo được phép |
| Phục vụ bản build | lệnh nguyên văn + port + ai start (agent hay người dùng) | Bước 5 build + phục vụ lại bằng đúng lệnh này; xem `serve-production-build.md` |
| Thiết bị/throttle | preset Lighthouse (mobile mặc định hoặc desktop) + CPU slowdown + network throttle | Ghi cờ nguyên văn; giữ nguyên cho cả baseline lẫn lần đo sau |
| Cache | lạnh (Chrome profile mới mỗi lần) hoặc ấm (có lần nạp trước) | Lighthouse CLI mặc định mỗi lần là profile sạch `[Unverified]` |
| Số lần lặp | ≥ 3 | Mỗi lần chạy lại từ cùng trạng thái cache |
| Công cụ + phiên bản | Lighthouse, Chrome, Node + phiên bản thật (lệnh in version) | Không ghi phiên bản đoán; lấy từ output lệnh |
| Ngưỡng độ lệch | 10% giữa các lần (mặc định) cho median LCP/TBT | Project ghi đè tại đây nếu máy nhiễu hơn/ít hơn |
| Config tool đo | file config ngoài `perf/`/`bench/` người dùng đã duyệt được đổi (vd `package.json` script đo, `.gitignore`); không có → ghi "không có" | Gate diff Bước 2/3/5 so với danh sách này; file ngoài danh sách → revert, không nhận |

Bảng + script đo chốt ở cuối Bước 2. Artifact của Bước 2: script đo, bảng điều kiện, `assets-baseline.txt`
(`serve-production-build.md`) và các file ở hàng Config tool đo. **Session chính** tự chạy `git hash-object` cho từng artifact đó và ghi các giá trị hash vào Evidence/report
Bước 2 (như phía BE), **không** ghi vào chính bảng (một file không chứa được hash của chính nó). File
`perf/frontend/<luồng>.hashes.txt` (nếu agent tạo) chỉ là bản sao tiện lợi, không có thẩm quyền vì agent ghi
được file đó. Bước 3/5 băm lại các artifact và so với giá trị hash trong Evidence Bước 2; lệch → điều kiện đã bị
sửa sau khi chốt, từ chối so sánh. Cần đổi điều kiện thì quay lại Bước 2,
đo lại baseline. `[Unverified]` `git hash-object` chỉ băm nội dung file, không băm đường dẫn.

## Chỉ số báo cáo

- **LCP, TBT, CLS:** lấy từ Lighthouse JSON, median của các lần (`lighthouse-cli.md`). Là số **lab**.
- **INP:** Lighthouse navigation mặc định không báo INP (không có tương tác người dùng); `[Unverified]` chế độ
  timespan/user-flow có thể ghi INP lab, ngoài phạm vi recipe. Số báo cáo là TBT, không phải INP.
- **Kích thước bundle:** tổng + chunk lớn nhất, đọc từ output build (`bundle-analysis.md`). Chỉ số xác định, so
  trực tiếp, không cần tính độ lệch.

## Độ lệch giữa các lần (P3)

```text
độ lệch = (max(x) − min(x)) / median(x)     # x = LCP hoặc TBT của từng lần
```

- Độ lệch ≤ ngưỡng (mặc định 10%) → báo median kèm dãy số thô.
- Độ lệch > ngưỡng → **cảnh báo, không kết luận**. Giảm nhiễu: tăng số lần lặp, tắt tiến trình nền nặng (IDE
  indexing, build khác), cắm sạc laptop và chọn power plan hiệu năng cao `[Unverified]`, đóng tab/extension
  chiếm CPU. Mọi thay đổi ghi vào bảng và áp **cho cả baseline lẫn lần đo sau**.

## Mẫu bảng kết quả baseline vs sau

Điền bằng số THẬT từ output công cụ; không làm tròn "cho đẹp".

| Chỉ số | Baseline (Bước 2) | Sau tối ưu (Bước 5) | Chênh lệch |
|---|---|---|---|
| LCP median (ms) | … | … | … |
| TBT median (ms) | … | … | … |
| CLS median | … | … | … |
| Bundle tổng / chunk lớn nhất (KB) | … | … | … |
| Độ lệch LCP / TBT giữa các lần | … | … | — |
| Số lần lặp | … | … | — |

Kèm theo: lệnh chạy nguyên văn, commit của hai build, và **residual risk** (nhiễu máy local, một thiết bị giả
lập, lab ≠ người dùng thật, cache lạnh/ấm).
