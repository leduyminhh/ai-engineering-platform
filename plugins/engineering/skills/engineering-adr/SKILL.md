---
name: engineering-adr
description: "Skill capability (plugin engineering) để ĐIỀU PHỐI một quyết định kiến trúc/thiết kế rồi GHI thành ADR chuẩn (Nygard) vào docs/decisions/ của project. Làm rõ bối cảnh & lực đẩy (forces), liệt kê 2–4 phương án thực chất kèm đánh đổi, chốt quyết định + lý do truy vết được, ghi hệ quả TRUNG THỰC (cả tích cực lẫn tiêu cực + residual risk); đánh số tiếp theo convention docs/decisions/, đặt Status (Proposed/Accepted/…), link tới spec (docs/requests/) + contract/data-model (docs/contracts/). Giúp teamlead/manager chốt quyết định có truy vết. Portable ra mọi provider (claude/cursor/codex/antigravity). Dùng skill NÀY khi người dùng muốn \"viết ADR\", \"ghi quyết định kiến trúc\", \"architecture decision record\", \"quyết định thiết kế\", \"chọn phương án\", \"đánh đổi kiến trúc\", \"lưu lý do quyết định\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG tự quyết quyết định lớn thay người dùng (facilitate + đề xuất, con người chốt Status). KHÔNG thuộc pipeline bắt buộc; gọi khi cần ở giai đoạn plan."
order: 5
title: "ADR — điều phối quyết định kiến trúc + ghi architecture decision record"
runsIn: plan
invoke: per-request
---

# ADR — Architecture Decision Record (skill dùng chung)

Điều phối (facilitate) một **quyết định kiến trúc/thiết kế** rồi ghi thành **ADR chuẩn (Nygard)** vào
`docs/decisions/` của project. Skill này là **hướng dẫn cách agent làm rõ quyết định và viết tài liệu**
(docs-only recipe), KHÔNG sinh code và KHÔNG tự quyết thay con người.

Một ADR ghi lại: **bối cảnh & lực đẩy (forces)** dẫn tới quyết định, **các phương án đã cân nhắc** kèm đánh
đổi, **quyết định** đã chốt + **lý do** truy vết được về forces, và **hệ quả** (cả tích cực lẫn tiêu cực).
Mục tiêu: giúp teamlead/manager **chốt quyết định có truy vết**, để người sau đọc lại hiểu *vì sao* chọn thế.

Skill này **portable ra mọi provider** (claude/cursor/codex/antigravity) và bám `docs/decisions/_TEMPLATE.md`
— không dựng cấu trúc song song. KHÔNG thuộc chuỗi pipeline bắt buộc; gọi khi cần ở giai đoạn **plan**. Con
người giữ chốt: **duyệt và chốt Status** trước khi ADR được coi là quyết định chính thức.

## Khi nào dùng

- Người dùng muốn viết ADR, ghi quyết định kiến trúc, architecture decision record, lưu lý do một quyết định
  thiết kế, so sánh/chọn phương án, ghi lại đánh đổi kiến trúc.
- Có một quyết định đáng lưu (chọn phương án, đánh đổi phạm vi, ràng buộc kỹ thuật lớn, chọn stack/pattern) cần
  truy vết được về lý do.
- Skill `engineering-spec-writing` phát hiện quyết định lớn trong lúc viết spec và cần ghi ADR để link ngược.

KHÔNG dùng skill này để sinh code, để tự chốt một quyết định lớn thay người dùng, hay để phân rã story/task.

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh code; chỉ tạo/cập nhật file ADR trong `docs/decisions/`.
- **KHÔNG tự quyết quyết định lớn thay con người.** Skill *điều phối*: làm rõ forces, đề xuất phương án + phân
  tích đánh đổi, có thể **khuyến nghị** một phương án — nhưng **con người chốt** và đặt `Status`. Quyết định lớn
  còn chưa chốt → để `Status: Proposed`, không tự đặt `Accepted`.
- **KHÔNG bịa phương án hay đánh đổi.** Thiếu thông tin → hỏi TỪNG câu (references/decision-facilitation.md);
  phần suy đoán đánh dấu **[giả định]**, không âm thầm điền.
- **Ghi hệ quả trung thực** — nêu cả tiêu cực + **residual risk**; ngôn ngữ đo được, KHÔNG tuyên bố "đảm bảo /
  loại bỏ / chặn triệt để".
- Bám `docs/decisions/_TEMPLATE.md` và **convention đánh số** hiện có; KHÔNG dựng cấu trúc tài liệu song song.
- Defer `project-knowledge/` (skill init lo); docs-only, không đụng CLI/adapter/engine.
- Con người **duyệt** ADR và **chốt Status** trước khi coi là quyết định chính thức.

## Luồng viết ADR

0. **Nạp context (BẮT BUỘC — trước khi làm rõ).**
   Đọc `project-knowledge/` (`project-overview.md`, `domain-context.md`) và **quét `docs/decisions/`** hiện có
   để xác định **số ADR kế tiếp** + **phong cách** đang dùng; đọc `_TEMPLATE.md`. Từ đó xác định **quyết định
   cần ghi** + **đối tượng đọc** (teamlead / dev / stakeholder). Thiếu `docs/decisions/` → nói rõ (fail-loud) và
   đề nghị chạy init trước, hoặc viết với giả định + ghi rõ.

1. **Facilitate (điều phối quyết định).**
   Theo [references/decision-facilitation.md](references/decision-facilitation.md): làm rõ **vấn đề/lực đẩy
   (forces)** — ràng buộc, mục tiêu, yếu tố đánh đổi; liệt kê **2–4 phương án thực chất** (không phải phương án
   rơm) kèm **đánh đổi** của từng cái; nêu **tiêu chí chọn**. Hỏi **TỪNG câu** khi thiếu; đánh dấu mọi
   **[giả định]**. Với quyết định lớn: đề xuất + phân tích, **không tự chốt thay người dùng**.

2. **Viết ADR.**
   Theo [references/adr-structure.md](references/adr-structure.md), bám `docs/decisions/_TEMPLATE.md` (Nygard:
   Title / Status / Context / Decision / Consequences + mục Các lựa chọn đã cân nhắc). Đặt file
   `docs/decisions/<số kế tiếp>-<slug>.md` (số 4 chữ số nối tiếp convention; slug ngắn, kebab-case). Đặt
   `Status` phù hợp (Proposed / Accepted / Superseded by ADR-xxxx). **Link** tới spec liên quan
   (`docs/requests/<...>/requirement.md`) và contract/data-model (`docs/contracts/`). Tiếng Việt CÓ DẤU.

2b. **Ghi hệ quả trung thực.**
   Mục Hệ quả nêu **cả tác động tích cực lẫn tiêu cực** và **residual risk** (rủi ro còn lại sau quyết định) +
   việc phải làm tiếp. Không thổi phồng lợi ích, không giấu đánh đổi. Dùng ngôn ngữ đo được.

3. **Verify.**
   Chạy checklist trong [references/adr-structure.md](references/adr-structure.md): đủ các mục Nygard; **≥2
   phương án** có đánh đổi rõ; **quyết định truy vết được về forces**; hệ quả có cả tiêu cực + residual risk;
   **đánh số đúng nối tiếp** + link spec/contract/data-model đúng; đặt đúng `docs/decisions/`; tiếng Việt có
   dấu. Nêu rõ phần còn thiếu (fail-loud); **con người duyệt và chốt Status**.

## Verification (trước khi báo hoàn thành)

- Đã nạp context, quét `docs/decisions/` và xác định số ADR kế tiếp + quyết định cần ghi; suy đoán đánh dấu
  **[giả định]**.
- ADR đặt đúng `docs/decisions/<số kế tiếp>-<slug>.md`, bám `_TEMPLATE.md` (đủ mục Nygard).
- Có **2–4 phương án** thực chất kèm đánh đổi; quyết định + lý do **truy vết được về forces**.
- Hệ quả ghi **cả tiêu cực + residual risk**; ngôn ngữ đo được, không tuyên bố tuyệt đối.
- `Status` đặt đúng (Proposed khi chưa chốt); link spec/contract/data-model có khi liên quan.
- Tiếng Việt còn nguyên dấu; **con người duyệt và chốt Status** (skill không tự chốt quyết định lớn).

## Quan hệ với các skill khác

- **`engineering-spec-writing`** (cùng plugin) tạo spec ở `docs/requests/` và link tới ADR. Khi spec chạm một
  quyết định lớn → dùng skill NÀY để ghi ADR, rồi link hai chiều (spec ↔ ADR). Skill này lo **phần quyết định +
  lý do**; spec lo **phần yêu cầu tính năng**.
- **`engineering-diagram`** (cùng plugin): cần minh hoạ phương án/kiến trúc trong ADR (so sánh, sequence, thành
  phần) → dùng skill diagram sinh PlantUML renderable rồi nhúng/liên kết; skill này không tự vẽ diagram.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/adr-structure.md](references/adr-structure.md): cấu trúc ADR chuẩn Nygard theo `_TEMPLATE.md`
  (Title / Status / Context / Decision / Consequences + Các lựa chọn đã cân nhắc), convention **đánh số** nối
  tiếp, quy tắc `Status` + supersede, cách **link** spec/contract/data-model, và checklist Definition of Done.
- [references/decision-facilitation.md](references/decision-facilitation.md): bộ câu hỏi làm rõ **forces** (lực
  đẩy/ràng buộc/mục tiêu), cách khai thác **2–4 phương án** thực chất + **đánh đổi**, tiêu chí chọn, và nguyên
  tắc **tránh quyết thay con người** cho quyết định lớn (facilitate + đề xuất, người chốt Status).
