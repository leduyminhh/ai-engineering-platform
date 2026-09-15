# Characterization test FE — khóa hành vi màn hình cũ trước khi sửa

Tài liệu tham chiếu cho `frontend-testing`, bước 3. Dùng khi cần refactor/migrate màn hình hoặc
component cũ **chưa có test bao quanh** (hoặc test quá thưa). Mục tiêu: dựng **lưới an toàn hồi
quy** trước khi động code, để mọi thay đổi hành vi ngoài ý muốn lộ ra ngay.

## Characterization test là gì

Test **mô tả hành vi HIỆN TẠI của UI như nó đang chạy** — kể cả hành vi có vẻ lạ — chứ không mô tả
hành vi "đáng lẽ đúng". Nó chốt lại "màn hình hôm nay hiển thị/phản ứng ra sao" để khi refactor,
nếu hành vi đổi ngoài ý định, test sẽ đỏ.

Khác với test thông thường: test thường khẳng định hành vi ĐÚNG theo yêu cầu; characterization khóa
hành vi ĐANG CÓ (đúng hay sai chưa xét). Nếu phát hiện hành vi hiện tại có vẻ là bug (a11y thiếu,
luồng lỗi sai) → GHI LẠI, BÁO cho người quyết, KHÔNG tự "sửa cho đúng" trong lúc dựng lưới.

## Quy trình

1. **Xác định điểm vào (seam) qua góc nhìn người dùng:** render component/màn hình ở ranh giới ổn
   định nhất (một page/feature công khai) và tương tác như người dùng, thay vì gọi hàm nội bộ dễ đổi
   khi refactor.
2. **Khoanh vùng phụ thuộc ngoài:**
   - Mạng → chặn bằng **msw**. Ghi response theo dữ liệu THẬT quan sát được (chạy app/đọc network một
     lần) rồi cố định vào handler, không bịa shape.
   - Thời gian/ngẫu nhiên → fake timer + cố định seed/`Date` để render tái lập (tránh test giòn).
   - Router/store/provider → bọc đúng như app chạy (tái dùng custom render nếu có).
3. **Ghi lại phần hiển thị + kết quả tương tác quan sát được** với vài trạng thái đại diện: nội dung
   render ở state chính (có dữ liệu / empty / error / loading), kết quả sau click/submit (văn bản
   đổi, điều hướng, callback). Nếu chưa chắc UI hiện ra gì, render thử một lần, đọc kết quả THẬT rồi
   chốt kỳ vọng theo đó.
4. **Xác nhận toàn bộ characterization test XANH trên code CŨ** (chưa sửa gì). Đây là mốc: lưới chỉ
   có giá trị khi nó xanh trên hiện trạng.
5. **Refactor/migrate từng bước nhỏ**, chạy lại lưới sau mỗi bước. Đỏ → hoặc thay đổi làm lệch hành
   vi (revert/sửa), hoặc là thay đổi hành vi CHỦ Ý → cập nhật test kèm giải thích *vì sao* trong
   commit. Không sửa test để "cho xanh" mà không hiểu vì sao đỏ.

## Chọn độ phủ cho lưới

- Phủ **các màn hình/luồng bạn sắp động vào** trước; không cố khóa toàn bộ UI cũ cùng lúc.
- Ưu tiên luồng người dùng chính + các state hiển thị (empty/error) đi qua vùng refactor.
- Query theo role/label/text (không theo class/DOM nội bộ) để lưới không vỡ vì chính việc refactor
  markup — thứ ta muốn được phép đổi.
- Không có điểm vào rõ để render (component dính chặt context/global, phụ thuộc chằng chịt) → BÁO rủi
  ro, đề xuất thu hẹp phạm vi hoặc tách seam tối thiểu (bọc provider/inject props) trước, thay vì
  refactor mù.

## Sau khi refactor/migrate xong

- Giữ characterization test ở lại repo làm **tài sản hồi quy** (đừng xóa sau khi migrate).
- Với hành vi mà quá trình này lộ ra là **bug thật**, ghi rõ trong báo cáo + để người quyết: sửa
  code (kèm test khẳng định hành vi ĐÚNG mới) hay giữ nguyên. Không âm thầm đổi.
- Nêu residual risk: state/luồng chưa khóa được, phụ thuộc chưa cô lập được hoàn toàn, phần trực
  quan (layout/CSS) không nằm trong lưới render-based. [giả định] Với migrate kiến trúc (Feature-Based↔FSD↔Micro-FE),
  lưới ở tầng người dùng (render + interaction) ít đổi khi di chuyển file/tầng, nên phù hợp làm mốc
  hồi quy xuyên suốt việc dời cấu trúc.
