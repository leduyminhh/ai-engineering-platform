---
name: engineering-spec-writing
description: "Làm rõ yêu cầu ở session chính rồi viết requirement/design vào docs/requests/<ngày>-<slug>/ với AC đo được; cần bộ BA đầy đủ/SAP thì handoff FIS. Dùng khi người dùng muốn \"viết spec\", \"đặc tả yêu cầu\", \"khảo sát yêu cầu\", \"feature spec\", \"PRD gọn\". Không dùng khi cần ghi quyết định kiến trúc → engineering-adr; làm feature end-to-end → workflow-feature."
order: 2
title: "Spec Writing — làm rõ yêu cầu + viết feature/requirement spec"
runsIn: plan
invoke: per-request
argument-hint: "[mô tả yêu cầu]"
---

# Spec Writing (skill dùng chung)

**Làm rõ yêu cầu ở session chính** (hội thoại trực tiếp với người dùng), rồi **viết một feature/requirement spec GỌN**
vào đúng cấu trúc tài liệu của project (`docs/requests/<ngày>-<slug>/`). Skill này là **hướng dẫn cách làm rõ và viết
tài liệu** (docs-only recipe), KHÔNG sinh code và KHÔNG dựng lại bộ artifact BA/SAP sâu.

Việc hỏi, tóm tắt lại, đề xuất hướng và builder check **chỉ chạy ở session chính**: subagent không hội thoại trực
tiếp được với người dùng. Agent `engineering-spec-analyst` chỉ **ghi** tài liệu từ đầu vào đã chốt (bước 7–8).

Đặc tả ở **mức FEATURE** (không phân rã story): mô tả tính năng cần gì, đo bằng gì, chạm data/contract ở đâu,
rủi ro/giả định là gì. Spec này **portable ra mọi provider** (claude/cursor/codex/antigravity) và bám scaffold
`docs/requests/_TEMPLATE` — không dựng cấu trúc song song.

Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần ở giai đoạn **plan** (trước khi lập
`plan.md` hoặc bắt tay code). Con người giữ chốt: **duyệt spec** trước khi dùng làm nguồn.
Phân rã story/task chi tiết → `engineering-task-breakdown`; viết `plan.md` sau khi design được duyệt → `engineering-plan-writing`.

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh code; KHÔNG phân rã story (giữ ở mức feature-level).
- **KHÔNG bịa yêu cầu.** Thiếu thông tin quan trọng → hỏi từng câu (references/elicitation.md); phần suy đoán phải
  đánh dấu **[giả định]** và đưa vào mục câu hỏi mở, không âm thầm điền. Người dùng **bỏ qua phần hỏi** thì mọi lựa
  chọn của agent ghi là **quyết định của agent**, không trình bày như điều người dùng đã đồng ý.
- Acceptance criteria phải **đo được** (Given/When/Then hoặc tiêu chí kiểm được); ngôn ngữ đo được, KHÔNG
  tuyên bố "đảm bảo / loại bỏ rủi ro / chặn triệt để".
- Bám scaffold `docs/requests/_TEMPLATE` + `docs/decisions/_TEMPLATE.md`; KHÔNG dựng cấu trúc tài liệu song song.
  `_TEMPLATE` có sẵn của project thắng template core cho `requirement.md`: nếu khác template của `artifact-templates`
  thì nêu trong báo cáo và gợi ý cập nhật, KHÔNG ghi đè; `design.md`/`plan.md` theo template core khi `_TEMPLATE` cũ
  không có `design.md` (baseline `AGENTS.md`; chi tiết ở references/spec-structure.md).
- Defer `project-knowledge/` + `code-convention.md` (skill init lo); docs-only, không đụng CLI/adapter/engine.
- Con người **duyệt** spec trước khi dùng làm nguồn cho plan/triển khai; mỗi file (`requirement.md`, `design.md`,
  `plan.md`) một gate duyệt riêng.

## Quy trình — làm rõ rồi viết spec

**A. Làm rõ (session chính)**

1. **Nạp context (BẮT BUỘC — trước khi hỏi).**
   Đọc `project-knowledge/` (`project-overview.md`, `domain-context.md`), `docs/decisions/` (ADR đã có),
   `docs/contracts/` (contract/data-model nếu có), `CLAUDE.md`. Tìm trong repo là mặc định, không cần xin phép; chỉ
   xin khi phải ra ngoài repo (web). Từ đó xác định **feature/yêu cầu cần đặc tả** + **đối tượng đọc** (dev / BA /
   stakeholder). Thiếu `project-knowledge/` → nói rõ (fail-loud) và đề nghị chạy init trước, hoặc viết với giả định + ghi rõ.

2. **Cổng "đủ thông tin" + lối thoát.**
   Tự hỏi: mình đã biết gì về điều người dùng muốn và vì sao? Yêu cầu đã đủ rõ và nhỏ (một sửa đổi có kết quả quan sát
   được, không có quyết định thiết kế) → **không chạy workflow**, làm thẳng. Ngược lại, tin nhắn đầu tiên gồm đúng
   hai phần: một dòng nói rằng người dùng có thể **bỏ qua phần hỏi** bất cứ lúc nào, và một câu mở gợi họ kể tình huống
   thật. Người dùng chọn bỏ qua → bỏ bước 3–4, **không hỏi thêm câu nào** trước checkpoint (kể cả ở builder check, bước 9):
   agent **tự chọn hướng ở bước 5** (vẫn ghi 2–3 hướng + khuyến nghị + đánh đổi, không dừng chờ chọn), xếp cỡ việc
   rồi viết tài liệu (bước 6–8) với mọi lựa chọn đánh dấu **quyết định của agent**, nêu nổi bật ở checkpoint (chỉ
   nêu riêng lựa chọn công nghệ/nền tảng quan trọng) để người dùng sửa khi duyệt.

3. **Hỏi từng câu.**
   Mỗi tin nhắn kết thúc bằng **một câu hỏi**, không kèm danh sách ví dụ; câu mở trước, chỉ đưa lựa chọn khi
   người dùng bí; neo vào tình huống cụ thể; đoán để họ sửa thường tốt hơn hỏi. Tám nhóm của
   [references/elicitation.md](references/elicitation.md) là **vùng phủ** để không bỏ sót, không đọc ra thành câu.
   Ưu tiên câu mở khoá AC. Chuyện kỹ thuật/nền tảng: hỏi người dùng muốn tự chọn hay giao agent; agent chọn thì ghi
   **quyết định của agent**.

4. **Playback — tóm tắt lại từng phần.**
   Mỗi khi hiểu xong một phần, nói lại ngắn (khoảng 200–300 từ) bằng lời của mình, đánh dấu chỗ suy đoán là **[giả định]**,
   kết bằng "sai hoặc thiếu gì?"; xen kẽ với câu hỏi, không dồn về cuối. Nếu thực ra là nhiều dự án độc lập → nói
   thẳng, thống nhất thứ tự rồi làm lần lượt.

5. **Đề xuất 2–3 hướng + 1 khuyến nghị + đánh đổi** — đặt **sau playback**, khi mô tả đã được xác nhận.
   Tự nghĩ rộng riêng tư, bỏ hướng yếu; chỉ trình 2–3 hướng thật sự khác nhau, mỗi hướng một dòng đánh đổi, nêu **một
   khuyến nghị** và lý do. Cả hướng được chọn lẫn các hướng bị loại (kèm đánh đổi và lý do) đều ghi vào `design.md`. Người dùng chốt hướng →
   mục Quyết định đã chốt; người dùng bỏ qua phần hỏi hoặc không chốt → agent tự chọn theo khuyến nghị, ghi
   **quyết định của agent**, không dừng chờ chọn. Đây là **lệch có chủ đích** so với cách "không đưa lựa chọn sớm" của
   brainstorming trong superpowers (chủ repo yêu cầu có đề xuất); giữ thứ tự "hỏi mô tả trước, đề xuất sau" và đừng
   sửa lại theo cách đó. Cần diagram (flow/ERD/sequence/kiến trúc) → skill **`engineering-diagram`**; chỉ đưa hình khi
   nhìn tốt hơn đọc.

6. **Xếp cỡ việc** (xác nhận lại ở đây; nếu việc lớn lên giữa chừng thì dừng, nâng cỡ).
   - **Việc rõ và nhỏ** → không chạy workflow (đã xử lý ở bước 2).
   - **Thay đổi nhỏ** → chỉ `requirement.md` (AC nằm ở đây) + checkpoint trong chat; không có `design.md`, không có `plan.md`.
   - **Dự án** → `requirement.md` + `design.md` + `plan.md`, mỗi file một gate người duyệt.

   AC chỉ nằm một nơi: `requirement.md` khi có; `design.md` chỉ chứa AC nếu không có `requirement.md`.

**B. Ghi tài liệu**

7. **Giao `engineering-spec-analyst` ghi tài liệu.**
   Gói đầu vào đã chốt (mục tiêu, phạm vi, câu trả lời, hướng đã chọn, danh sách **quyết định của agent**,
   **[giả định]**, cỡ việc) rồi giao agent ghi `requirement.md` (+ `design.md` khi cỡ dự án) theo
   [references/spec-structure.md](references/spec-structure.md). Agent không hỏi người dùng; thiếu đầu vào thì trả `blocked`
   + `questions[]` và session chính hỏi lại. Bám scaffold `_TEMPLATE`, mở rộng chứ không thay thế. Tiếng Việt CÓ DẤU.
   Mỗi acceptance criterion mang ID `AC<n>.<m>` (`<n>` = số thứ tự requirement, `<m>` = số thứ tự AC trong requirement đó,
   vd `AC1.2`), viết Given/When/Then, để `plan.md` và `tasks.md` phủ/truy vết đúng ID. Skill này KHÔNG dựng `plan.md`
   (kế hoạch triển khai thuộc `engineering-plan-writing` sau khi spec được duyệt).

8. **Ghi ADR cho quyết định lớn.**
   Với mỗi quyết định thiết kế/nghiệp vụ đáng lưu (chọn phương án, đánh đổi phạm vi, ràng buộc kỹ thuật lớn):
   dùng skill **`engineering-adr`** (cùng plugin) để làm rõ phương án và ghi ADR vào `docs/decisions/`; spec chỉ
   link tới ADR đó và tới contract/data-model liên quan, không tự lặp lại thủ tục ghi ADR.

**C. Kiểm**

9. **Builder check (một lần, trước checkpoint design/spec).**
   Session chính gọi **một subagent MỚI** (general-purpose) đóng vai người lập plan giỏi theo prompt ở
   [references/builder-check.md](references/builder-check.md): không được hỏi người viết, chỉ liệt kê câu hỏi còn cần mà đoán
   sai sẽ hỏng, xếp hạng. Session chính phân kết quả thành 3 nhóm: **đã trả lời** (ghi vào tài liệu) / **nhỏ** (tự quyết,
   ghi **quyết định của agent**) / **của người dùng** — chỉ nhóm này đi hỏi, **gom vào đúng một tin nhắn**, đây là vòng
   hỏi duy nhất của bước kiểm. Người dùng đã **bỏ qua phần hỏi** → không hỏi: nhóm "của người dùng" cũng ghi là
   **quyết định của agent** kèm mặc định đã chọn và nêu nổi bật ở checkpoint. **Không có tool subagent** → session chính tự đọc tài liệu như builder theo cùng prompt.

10. **Verify.**
    Chạy checklist [references/checklist.md](references/checklist.md): đủ mục; mỗi requirement truy vết được
    (nguồn/actor/mục tiêu); acceptance criteria đo được; scope + out-of-scope rõ; rủi ro/giả định/câu hỏi mở
    liệt kê; ADR ghi cho quyết định lớn; đặt đúng `docs/requests/<ngày>-<slug>/`; tiếng Việt có dấu. Chạy
    `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/` để soát ID AC
    và cấu trúc thư mục request. Nêu rõ phần còn thiếu (fail-loud); con người **duyệt**.

## Verification (trước khi báo hoàn thành)

- Đã nạp context và xác định feature + đối tượng đọc; phần suy đoán đánh dấu **[giả định]**.
- Đã qua cổng "đủ thông tin"; lựa chọn của agent ghi **quyết định của agent**; `design.md` (cỡ dự án) ghi 2–3 hướng + 1 khuyến nghị + đánh đổi, gồm cả hướng bị loại — khi người dùng bỏ qua phần hỏi
  thì ghi là **quyết định của agent**, không bỏ phần này; cỡ thay đổi nhỏ không có `design.md`.
- Đã chạy đúng một lần builder check; câu hỏi còn lại của người dùng gom trong một tin nhắn.
- Spec đặt đúng `docs/requests/<yyyy-mm-dd>-<slug>/requirement.md`, bám scaffold `_TEMPLATE`.
- Mỗi AC có ID `AC<n>.<m>`; đã chạy `check-request.mjs` của skill `artifact-templates` trên thư mục request
  (`node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/`) và nêu
  từng dòng `WARN` còn lại (không có Node → ghi `not_run` kèm lý do).
- Functional requirements ở **mức feature** (không story); acceptance criteria **đo được**.
- Điểm chạm data/contract có link; quyết định lớn có ADR ở `docs/decisions/`.
- Rủi ro / giả định / câu hỏi mở liệt kê rõ; ngôn ngữ đo được, không tuyên bố tuyệt đối.
- Tiếng Việt còn nguyên dấu; con người duyệt spec.

## Ghi chú — handoff FIS (khi cần artifact sâu)

Skill này cho spec **GỌN, portable ra mọi provider** và tích hợp cấu trúc tài liệu của repo. Khi cần:

- **Bộ artifact BA đầy đủ** — PRD, SOD, DDD, FSD, BRD, personas chi tiết, feature-catalog — hoặc
- **Đặc tả SAP-specific** (module FI/CO/MM/SD…, fit-to-standard, scope item, tài liệu FIS)

và đang **ở Cowork có skill FIS** (`fisba` / `fissap` / `fispm`) → **chuyển phần sâu sang FIS**; skill này lo
phần **spec lõi + tích hợp cấu trúc tài liệu repo**, rồi trỏ tới artifact FIS. Nêu handoff một cách graceful:
**nếu không có FIS** (ví dụ đang trên Codex/Cursor/Antigravity) thì recipe này vẫn **đủ cho spec
feature-level** — cứ hoàn thành đặc tả gọn theo luồng trên.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/spec-structure.md](references/spec-structure.md): cấu trúc feature/requirement spec + mỗi mục
  nên có gì; feature-level granularity (không phân rã story); acceptance criteria đo được; phân biệt
  functional vs NFR; cách link ADR/contract/data-model; cách điền `design.md` (đã chốt / quyết định của agent /
  để builder quyết / anti-goal); cách map vào `requirement.md` (+ `design.md` khi có) của `_TEMPLATE`.
- [references/elicitation.md](references/elicitation.md): cách hỏi ở session chính (từng câu, câu mở, đoán để họ
  sửa, playback) + tám nhóm vùng phủ (mục tiêu, actors, phạm vi/out-of-scope, luồng + edge case, dữ liệu &
  tích hợp, NFR, ràng buộc & giả định, tiêu chí chấp nhận) kèm câu gợi ý để tự chọn, không đọc ra.
- [references/builder-check.md](references/builder-check.md): prompt mẫu cho subagent mới đóng vai người lập
  plan, cách phân 3 nhóm kết quả và gom một tin nhắn, cách tự đọc khi không có tool subagent.
- [references/checklist.md](references/checklist.md): Definition of Done cho spec (đủ mục, truy vết được, đo
  được, scope rõ, ADR ghi, builder check, đặt đúng chỗ, tiếng Việt có dấu) với ngôn ngữ đo được và fail-loud phần còn thiếu.
