# Cấu trúc ADR chuẩn (Nygard) — viết gì vào mỗi mục

ADR (Architecture Decision Record) ghi lại **một quyết định** kiến trúc/thiết kế đáng lưu và **vì sao** chọn
thế, để người sau đọc lại hiểu bối cảnh. Một ADR = **một quyết định**; nhiều quyết định → nhiều file.

Bám scaffold `docs/decisions/_TEMPLATE.md` và **mở rộng** nó — KHÔNG dựng cấu trúc song song. Cấu trúc dưới đây
theo mô hình **Nygard** (Michael Nygard, 2011): Title / Status / Context / Decision / Consequences, bổ sung mục
**Các lựa chọn đã cân nhắc** (Alternatives) mà `_TEMPLATE.md` đã có.

## Các mục của ADR

1. **Tiêu đề (Title)** — `ADR-<số>: <tiêu đề quyết định>`. Tiêu đề là **quyết định**, không phải chủ đề
   ("Chọn PostgreSQL cho lưu trữ đơn hàng", KHÔNG "Về cơ sở dữ liệu"). Ngắn, cụ thể, ở dạng khẳng định.
2. **Trạng thái (Status)** — xem mục "Status + supersede" bên dưới.
3. **Ngày (Date)** — `yyyy-mm-dd` ngày quyết định (hoặc đề xuất).
4. **Bối cảnh (Context)** — vấn đề cần quyết + **lực đẩy (forces)**: ràng buộc kỹ thuật/nghiệp vụ, mục tiêu,
   yếu tố đánh đổi đang tác động. Đây là phần để người sau hiểu *tại sao có quyết định này*. Nêu **sự việc**
   (khách quan), chưa chọn phương án. Phần suy đoán đánh dấu **[giả định]**.
5. **Các lựa chọn đã cân nhắc (Alternatives)** — liệt kê **2–4 phương án** thực chất; mỗi phương án ghi **ưu /
   nhược (đánh đổi)** so với forces. Không đưa "phương án rơm" chỉ để loại. Phương án bị loại vẫn ghi kèm lý do
   loại để tránh bàn lại về sau.
6. **Quyết định (Decision)** — chọn phương án nào + **lý do** truy vết được về forces và tiêu chí chọn. Viết
   dạng khẳng định ("Chúng ta sẽ …"). Lý do phải soi chiếu về Context/Alternatives, không phải sở thích.
7. **Hệ quả (Consequences)** — xem "Ghi hệ quả trung thực" bên dưới.

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
  cũ trong Context.
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

Status: Proposed
Date: 2026-09-18

## Context
Session hiện lưu in-memory trên từng instance app → mất session khi scale ngang hoặc
restart. Cần kho session dùng chung, đọc/ghi nhanh (<10ms p99).

## Các lựa chọn đã cân nhắc
1. **Redis (managed)** — nhanh, TTL sẵn, đã có hạ tầng team quen. Nhược: thêm 1 dependency vận hành.
2. **DB quan hệ hiện có (bảng session)** — không thêm hạ tầng mới. Nhược: chậm hơn, tăng tải DB chính,
   phải tự dọn TTL.

## Decision
Chúng ta sẽ dùng Redis (managed) cho session cache, vì đáp ứng ngưỡng latency và có TTL
built-in, giảm code dọn dẹp thủ công so với phương án 2.

## Consequences
+ Session sống sót qua restart/scale ngang; giảm tải DB chính.
− Thêm một điểm lỗi hạ tầng (Redis down → fallback cần thiết kế riêng, CHƯA có ở ADR này).
Residual risk: chưa có kế hoạch fallback khi Redis down — cần ADR/task riêng trước khi lên prod.
```

## Checklist (Definition of Done cho ADR)

- [ ] Đặt đúng `docs/decisions/<số kế tiếp>-<slug>.md`; số **nối tiếp** đúng convention (4 chữ số, +1).
- [ ] Đủ mục Nygard: Title / Status / Ngày / Context / Các lựa chọn đã cân nhắc / Decision / Consequences.
- [ ] Title là **quyết định** cụ thể ở dạng khẳng định.
- [ ] Context nêu rõ **forces**; suy đoán đánh dấu **[giả định]**.
- [ ] Có **2–4 phương án** thực chất, mỗi phương án có **đánh đổi** (ưu/nhược); không bịa phương án.
- [ ] Quyết định + lý do **truy vết được** về forces và tiêu chí chọn.
- [ ] Hệ quả ghi **cả tiêu cực + residual risk** + việc phải làm tiếp; ngôn ngữ đo được, không tuyệt đối.
- [ ] `Status` đặt đúng (Proposed khi chưa chốt); supersede ghi rõ số ADR nếu có.
- [ ] Link spec/contract/data-model có khi liên quan.
- [ ] Tiếng Việt CÓ DẤU; con người **duyệt và chốt Status** (skill không tự chốt quyết định lớn).
