# Profile render bằng React Profiler — tầng profile thứ hai

Tài liệu tham chiếu cho `frontend-performance`, chế độ `profile` (tầng 2). Mọi lệnh, cờ, alias và tên API trong
file này chưa được đối chiếu với tài liệu chính thức của phiên bản React/bundler project đang dùng → gắn
`[Unverified]`; kiểm lại tài liệu chính thức (vd https://react.dev) trước khi dựa vào.

## Khi nào dùng

- Bundle không có điểm bất thường (`bundle-analysis.md`) nhưng TBT cao, hoặc người dùng báo tương tác/render chậm.
- Muốn biết **component nào render nhiều hoặc lâu** và **commit nào thừa** (render lại mà không có thay đổi
  nhìn thấy được).
- Không dùng để so số trước/sau: Profiler cho thời gian render trong một phiên ghi, không thay Lighthouse. Số so
  sánh vẫn lấy ở `measure`.

## Vì sao cần build profiling

Bản production mặc định **bỏ** instrumentation của Profiler để nhỏ và nhanh; React DevTools Profiler trên bản
production thường không có dữ liệu. Dev build có dữ liệu nhưng không đại diện (dev checks, không tối ưu). Cách
chuẩn: **profiling build** = production build + bật profiling của React `[Unverified]`.

Ví dụ alias của bundler (nội dung phụ thuộc phiên bản React/bundler `[Unverified]`):

```js
// perf/frontend/vite.config.profile.js — file cấu hình RIÊNG cho lần profile, không sửa vite.config.js
import base from '../../vite.config.js';

export default {
  ...base,
  resolve: { ...base.resolve, alias: { ...base.resolve?.alias, 'react-dom/client': 'react-dom/profiling' } },
  build: { ...base.build, outDir: 'dist-profile' },
};
```

```bash
npx vite build --config perf/frontend/vite.config.profile.js   # [Unverified] cờ --config; cách import theo project
```

- Dùng file config profile riêng thay vì sửa config chính: Config tool đo đã chốt ở cuối Bước 2 và không thêm ở
  Bước 3; một alias còn sót trong config chính sẽ đưa profiling build vào lần đo của Bước 5. File profile **không
  bao giờ** dùng cho lần đo ở `measure`, và phải xóa (hoặc revert) sau khi profile xong. Thêm file hay gói mới
  ngoài `perf/`/`bench/` → hỏi trước, chạy như subagent thì trả `blocked` + câu hỏi (P5).
- Output vào thư mục riêng (`dist-profile`) để không ghi đè `dist/` của lần đo. **Không sửa `src/`** (không bọc
  `<Profiler>` vào code app).
- Lệnh build/phục vụ profiling + đường dẫn file config profile ghi vào **report Bước 3** (hoặc
  `perf/profile-<luồng>.md`), **không** vào bảng điều kiện đo của Bước 2: bản profiling khác bản đo, trộn hai thứ
  làm Bước 5 so lệch điều kiện.
- Phục vụ bản profiling bằng cách ở `serve-production-build.md`, chỉ trên localhost.

## Cách ghi và đọc

React DevTools là extension của trình duyệt, agent không điều khiển thẳng được: hướng dẫn người dùng (hoặc dùng
trình duyệt tự động của project) làm các bước sau, rồi dán kết quả vào report.

1. Mở bản profiling trên localhost, mở tab Profiler của React DevTools `[Unverified]`.
2. Bấm ghi → thực hiện đúng luồng trong bảng điều kiện → dừng. Có thể xuất phiên ghi ra JSON để lưu ở
   `perf/frontend/` `[Unverified]` tính năng xuất theo phiên bản DevTools.
3. Đọc theo thứ tự:
   - **Commit chart:** số commit trong luồng, commit nào đắt; commit nhiều bất thường so với số thao tác.
   - **Flamegraph/ranked chart:** component nào có thời gian render lớn; component render nhưng "did not render"
     ở commit khác cho biết memo có tác dụng.
   - **Lý do render** (nếu bật ghi "why did this render" `[Unverified]`): props/state/hook/context nào đổi.

## Cần tìm gì

- **Commit thừa:** cha render lại kéo cả cây con dù props không đổi; context đổi giá trị mỗi render.
- **Component đắt:** tính toán nặng trong render, danh sách dài không ảo hóa, key không ổn định.
- **Effect gây vòng render:** state đặt lại trong effect, kéo thêm một commit mỗi thao tác.
- Memo hóa chỉ đề xuất khi có số đo cho thấy lợi ích; không "memo cho chắc".

## Đầu ra

Bottleneck + evidence: tên component, số commit, thời gian render (số thật từ Profiler), `file:line` component
(đọc để trỏ chỗ, không suy nguyên nhân thay cho số đo — P4), giả thuyết nguyên nhân + danh sách component/file đề
xuất sửa cho `frontend-fix`. Render bình thường → chuyển tầng 3 (`chrome-trace.md`).
