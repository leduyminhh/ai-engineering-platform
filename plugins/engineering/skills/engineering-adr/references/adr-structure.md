# Cấu trúc ADR (MADR 4.0) — viết gì vào mỗi mục

ADR (Architecture Decision Record) ghi lại **một quyết định** kiến trúc/thiết kế đáng lưu và **vì sao** chọn
thế, để người sau đọc lại hiểu bối cảnh. Một ADR = **một quyết định**; nhiều quyết định → nhiều file.

Bám scaffold `docs/decisions/_TEMPLATE.md` — file này sinh từ template `adr.template.md` của skill core
`artifact-templates` (một nguồn, không dựng cấu trúc song song). Khung theo **MADR 4.0** (Markdown Architectural
Decision Records) viết tiếng Việt; mục tùy chọn của MADR (Yếu tố quyết định, Thông tin thêm) có thể bỏ khi trống.

## Các mục của ADR

1. **Tiêu đề** — `# ADR-<số>: <tiêu đề quyết định>`. Tiêu đề là **quyết định**, không phải chủ đề
   ("Chọn PostgreSQL cho lưu trữ đơn hàng", KHÔNG "Về cơ sở dữ liệu"). Ngắn, cụ thể, ở dạng khẳng định.
2. **Metadata** — `Trạng thái` (xem "Status + supersede"), `Ngày` (`yyyy-mm-dd`, ngày quyết định hoặc đề xuất),
   `Người quyết định`; `Tham vấn` / `Thông báo` khi có.
3. **Bối cảnh và vấn đề** — vấn đề cần quyết + **lực đẩy (forces)**: ràng buộc kỹ thuật/nghiệp vụ, mục tiêu,
   yếu tố đánh đổi đang tác động. Nêu **sự việc** (khách quan), chưa chọn phương án. Suy đoán đánh dấu **[giả định]**.
4. **Yếu tố quyết định** (tùy chọn) — các tiêu chí dùng để so phương án; dùng làm mốc truy vết cho lý do chọn.
5. **Các phương án** — liệt kê **2–4 phương án** thực chất. Không đưa "phương án rơm" chỉ để loại.
6. **Kết quả quyết định** — `Chọn phương án "…", vì …`, lý do truy vết được về yếu tố quyết định/forces. Gồm:
   - **Hệ quả** — xem "Ghi hệ quả trung thực" bên dưới.
   - **Xác nhận** — cách kiểm tra quyết định được tuân thủ (review, test, fitness function); không có thì bỏ mục.
7. **Ưu nhược từng phương án** — mỗi phương án một mục con với dòng Tốt / Trung tính / Xấu so với yếu tố quyết
   định. Phương án bị loại vẫn ghi kèm lý do loại để tránh bàn lại về sau.
8. **Thông tin thêm** (tùy chọn) — link spec/contract liên quan, điều kiện xem lại quyết định.

## Đánh số (numbering convention)

- File: `docs/decisions/<số 4 chữ số>-<slug>.md`, ví dụ `0002-chon-postgres-cho-don-hang.md`.
- **Số nối tiếp**: quét `docs/decisions/`, lấy số ADR lớn nhất hiện có (bỏ qua `_TEMPLATE.md`) rồi **+1**, giữ
  4 chữ số. ADR đầu tiên của project thường là `0001` (đã có ví dụ `0001-vi-du-quyet-dinh.md`).
- Số ADR **không tái sử dụng**: quyết định bị thay thế vẫn giữ nguyên số, chuyển `Status: Superseded`, không
  xoá file (giữ lịch sử quyết định).
- Slug: ngắn, kebab-case, mô tả quyết định (không dấu tiếng Việt trong tên file).

## Status + supersede

- **Proposed** — đang đề xuất, **chưa chốt**. Dùng cho quyết định lớn con người chưa duyệt. Skill để mặc định
  ở đây khi chưa có xác nhận chốt.
- **Accepted** — đã chốt và đang áp dụng. Chỉ đặt khi con người xác nhận.
- **Superseded by ADR-xxxx** — bị một ADR mới thay thế; ghi rõ số ADR thay thế. ADR mới nên link ngược lại ADR
  cũ trong mục Bối cảnh và vấn đề.
- (Tuỳ project) **Deprecated / Rejected** — nếu convention của project dùng; theo phong cách `docs/decisions/`
  hiện có, không tự thêm trạng thái mới nếu project chưa dùng.

## Ghi hệ quả trung thực (residual risk)

- Ghi **cả tích cực (+) lẫn tiêu cực (−)** — quyết định nào cũng có đánh đổi; ADR chỉ tiêu cực-trống là dấu
  hiệu chưa suy nghĩ hết.
- Nêu **residual risk**: rủi ro/nợ kỹ thuật *còn lại* sau khi chọn phương án này, và (nếu có) cách giảm thiểu.
- Nêu **việc phải làm tiếp** phát sinh từ quyết định (migration, đổi convention, cập nhật contract…).
- Ngôn ngữ **đo được**; KHÔNG tuyên bố "đảm bảo / loại bỏ / chặn triệt để". Không thổi phồng lợi ích.

## Link spec / contract / data-model

- **Spec:** link tương đối tới `docs/requests/<...>/requirement.md` là nguồn của quyết định (nếu có); nếu spec
  đó dùng skill `engineering-spec-writing` thì link **hai chiều** (spec ↔ ADR).
- **Contract / data-model:** khi quyết định chạm dữ liệu/API, link tới file trong `docs/contracts/` (và
  data-model của project). ADR giữ *lý do*, contract giữ *chi tiết trường/endpoint* — tránh trùng lặp, tránh
  drift.
- Khi ADR và contract/spec lệch nhau: nêu rõ là điểm cần con người chốt, không tự sửa contract/spec.

## Ví dụ rút gọn

```markdown
# ADR-0007: Chọn Redis cho cache session

- Trạng thái: Proposed
- Ngày: 2026-09-18
- Người quyết định: Teamlead backend

## Bối cảnh và vấn đề

Session hiện lưu in-memory trên từng instance app → mất session khi scale ngang hoặc
restart. Cần kho session dùng chung, đọc/ghi nhanh (<10ms p99).

## Yếu tố quyết định

- Độ trễ đọc/ghi p99 dưới 10ms.
- Ít tải thêm cho DB chính.

## Các phương án

- Redis (managed)
- Bảng session trong DB quan hệ hiện có

## Kết quả quyết định

Chọn phương án "Redis (managed)", vì đáp ứng ngưỡng latency và có TTL built-in.

### Hệ quả

- Tốt, vì session sống sót qua restart/scale ngang; giảm tải DB chính.
- Xấu, vì thêm một điểm lỗi hạ tầng. Residual risk: chưa có kế hoạch fallback khi Redis down, cần ADR/task riêng
  trước khi lên prod.

### Xác nhận

Load test p99 < 10ms trước khi lên prod.

## Ưu nhược từng phương án

### Redis (managed)

- Tốt, vì nhanh, TTL sẵn, team đã quen.
- Xấu, vì thêm một dependency vận hành.

### Bảng session trong DB quan hệ hiện có

- Tốt, vì không thêm hạ tầng mới.
- Xấu, vì chậm hơn, tăng tải DB chính, phải tự dọn TTL.
```

## Checklist (Definition of Done cho ADR)

- [ ] Đặt đúng `docs/decisions/<số kế tiếp>-<slug>.md`; số **nối tiếp** đúng convention (4 chữ số, +1).
- [ ] Đủ mục MADR theo `adr.template.md`: metadata (Trạng thái / Ngày / Người quyết định), Bối cảnh và vấn đề, Các phương án, Kết quả quyết định (Hệ quả, Xác nhận), Ưu nhược từng phương án.
- [ ] Title là **quyết định** cụ thể ở dạng khẳng định.
- [ ] Bối cảnh và vấn đề nêu rõ **forces**; suy đoán đánh dấu **[giả định]**.
- [ ] Có **2–4 phương án** thực chất, mỗi phương án có **đánh đổi** (ưu/nhược); không bịa phương án.
- [ ] Quyết định + lý do **truy vết được** về forces và tiêu chí chọn.
- [ ] Hệ quả ghi **cả tiêu cực + residual risk** + việc phải làm tiếp; ngôn ngữ đo được, không tuyệt đối.
- [ ] `Status` đặt đúng (Proposed khi chưa chốt); supersede ghi rõ số ADR nếu có.
- [ ] Link spec/contract/data-model có khi liên quan.
- [ ] Tiếng Việt CÓ DẤU; con người **duyệt và chốt Status** (skill không tự chốt quyết định lớn).
