---
name: engineering-diagram
description: "Skill capability xuyên suốt (plugin engineering) để biến mô tả hệ thống / luồng / kiến trúc / cấu trúc dữ liệu / kế hoạch thành DIAGRAM: CHỌN ĐÚNG LOẠI diagram TRƯỚC (theo câu hỏi cần trả lời, loại nhỏ-nhất-đủ-dùng), rồi mới sinh nguồn PlantUML RENDERABLE (bọc @startuml…@enduml hoặc start tag chuyên biệt), nhãn theo ngôn ngữ domain, đánh dấu [giả định] cho phần suy đoán. Chỉ ghi file vào docs/diagram/ khi người dùng XÁC NHẬN (protected path). Dùng skill NÀY khi người dùng muốn \"vẽ diagram\", \"sinh sơ đồ\", \"PlantUML\", \"sequence diagram\", \"ERD\", \"class diagram\", \"component/architecture diagram\", \"activity/state diagram\", \"deployment/network diagram\", \"sơ đồ luồng\", \"sơ đồ tuần tự\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần ở bất kỳ giai đoạn nào cần trực quan hoá (vd nhúng diagram vào spec)."
order: 3
title: "Diagram — chọn đúng loại rồi sinh PlantUML renderable"
runsIn: execute
invoke: per-request
---

# Diagram (capability engineering)

Biến mô tả hệ thống / luồng / kiến trúc / cấu trúc dữ liệu / kế hoạch thành **diagram PlantUML renderable**.
Nguyên tắc cốt lõi: **chọn đúng loại diagram TRƯỚC rồi mới sinh** — chọn loại trả lời câu hỏi của người dùng
bằng **ít notation nhất**. Skill này là **hướng dẫn cách agent chọn loại + sinh nguồn** (docs-only recipe),
KHÔNG phải công cụ render.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần ở bất kỳ giai đoạn nào cần trực
quan hoá (vd `engineering-spec-writing` cần nhúng flow/ERD/sequence/kiến trúc vào spec). `docs/` là
**protected path** —
chỉ ghi file khi người dùng **xác nhận**.

## Khi nào dùng

- Người dùng muốn vẽ/sinh/review một diagram: sequence, use case, class, activity, component, deployment,
  state, ER/ERD, network, wireframe, gantt/WBS… cho kiến trúc, luồng, mô hình dữ liệu, kế hoạch, hay UI.
- Cần trực quan hoá một mô tả hệ thống để review hoặc nhúng vào tài liệu (spec, ADR).

## Ranh giới an toàn

- **Chọn loại trước, sinh sau.** Chọn sai loại sẽ giấu mất quan hệ người dùng cần xem. Loại **nhỏ nhất đủ
  dùng**; tối đa 2 diagram nếu cùng một câu trả lời cần 2 góc nhìn — không sinh cả loạt.
- **Renderable:** trả nguồn PlantUML hoàn chỉnh (mở/đóng đúng cặp `@startuml…@enduml` hoặc `@startjson` /
  `@startyaml` / `@startmindmap` / `@startgantt`…). Không phụ thuộc file ngoài đang thiếu.
- **Nhãn theo domain:** mọi participant/component/class/state/entity lấy từ context người dùng hoặc là
  **[giả định]** được đánh dấu rõ. KHÔNG bịa API/bảng/state/hạ tầng mà không đánh dấu.
- **Không** đưa secret / token / credential / hostname thật vào diagram trừ khi người dùng cung cấp để làm tài liệu.
- **Protected path:** `docs/` được bảo vệ. Chỉ ghi file diagram khi người dùng **xác nhận** (nêu path +
  mục đích + tóm tắt nội dung trước); mặc định trả trong khung code, không tự ghi file.
- Không tuyên bố "đã render thành công" trừ khi thật sự chạy lệnh render.

## Quy trình — sinh diagram

1. **Xác định ý định + đối tượng đọc.** Câu hỏi diagram cần trả lời là gì (giải thích / review kiến trúc /
   thiết kế luồng / mô hình dữ liệu / kế hoạch / UI)? Đối tượng đọc là ai (engineering / product / ops / lãnh đạo)?
2. **Chọn loại (nhỏ nhất đủ dùng).** Đối chiếu bảng chọn loại trong
   [references/diagram-types.md](references/diagram-types.md). Thiếu scope mà chọn sai sẽ gây hiểu lầm → hỏi;
   còn lại → chọn + đánh dấu **[giả định]** và tiếp tục.
3. **Sinh nguồn PlantUML.** Áp luật output trong [references/plantuml-output-rules.md](references/plantuml-output-rules.md):
   một khối `plantuml` hoàn chỉnh mỗi diagram, có `title`, nhãn theo domain, style tiết chế. Không lẫn nhiều
   mối quan tâm không liên quan vào một diagram.
4. **Ghi file (chỉ khi được xác nhận).** Nếu người dùng muốn lưu: đề xuất path `docs/diagram/<loại>/<tên>_<yyyyMMdd_HHmm>.puml`,
   nêu path + mục đích + tóm tắt, chờ **xác nhận** rồi mới ghi (protected path).
5. **Ghi chú render (khi cần).** Nếu người dùng hỏi cách xem: nêu cách render (PlantUML server / `java -jar
   plantuml.jar diagram.puml` / `-tsvg`). Không khẳng định đã render nếu chưa chạy.

## Verification (trước khi báo hoàn thành)

- Nguồn PlantUML **hoàn chỉnh, renderable**: bắt đầu/kết thúc đúng directive, mọi block đã đóng.
- Loại diagram **khớp ý định**; dùng ít notation nhất; không lẫn chi tiết không liên quan.
- Nhãn theo **domain người dùng**; phần suy đoán đánh dấu **[giả định]**.
- Không secret/hostname thật; nếu ghi file `docs/diagram/` thì đã có **xác nhận** người dùng.

## Bản đồ tài liệu

Nạp đúng file khi cần:

- [references/diagram-types.md](references/diagram-types.md): bảng chọn loại diagram (sequence / use case /
  class / object / activity / component / deployment / state / timing / gantt / WBS / mindmap / ER-IE /
  JSON-YAML / network / wireframe-salt / archimate / grammar) → khi nào dùng + gợi ý ưu tiên theo danh từ chính.
- [references/plantuml-output-rules.md](references/plantuml-output-rules.md): luật output renderable + naming
  + style + quy tắc [giả định] + hướng dẫn render + checklist review.
