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
  không có `design.md` (skill `artifact-templates`, `references/docs-conventions.md`; chi tiết ở references/spec-structure.md).
- Defer `project-knowledge/` + `code-convention.md` (skill init lo); docs-only, không đụng CLI/adapter/engine.
- Con người **duyệt** spec trước khi dùng làm nguồn cho plan/triển khai (hỏi theo tài liệu `ask-user.md` của skill `plan-execution` (bản cài plugin: `core:plan-execution`): mở `requirement.md`/`design.md` ở pane rồi hỏi bằng lựa chọn Duyệt / Sửa / Dừng); mỗi file (`requirement.md`, `design.md`,
  `plan.md`) một gate duyệt riêng.

## Quy trình — làm rõ rồi viết spec

**A. Làm rõ (session chính)**

1. **Nạp context (BẮT BUỘC — trước khi hỏi).**
   Đọc `project-knowledge/` (`project-overview.md`, `domain-context.md`), `docs/decisions/` (ADR đã có),
   `docs/contracts/` (contract/data-model nếu có), `CLAUDE.md`. Tìm trong repo là mặc định, không cần xin phép; chỉ
   xin khi phải ra ngoài repo (web). Từ đó xác định **feature/yêu cầu cần đặc tả** + **đối tượng đọc** (dev / BA /
   stakeholder). Thiếu `project-knowledge/` → nói rõ (fail-loud) và đề nghị chạy init trước, hoặc viết với giả định + ghi rõ.

2. **Cổng "đủ thông tin" + lối thoát.**
   Làm theo mục "Cổng "đủ thông tin" + lối thoát" của skill `brainstorming` (bản cài plugin: `core:brainstorming`), file
   `references/clarify-core.md`: yêu cầu đã đủ rõ và nhỏ → **không chạy workflow**, làm thẳng; ngược lại tin nhắn đầu
   gồm dòng **bỏ qua phần hỏi** và một câu mở. Riêng skill này: người dùng chọn bỏ qua → bỏ bước 3–4, **không hỏi thêm câu nào** trước checkpoint (kể cả ở builder check, bước 9):
   agent **tự chọn hướng ở bước 5** (vẫn ghi 2–3 hướng + khuyến nghị + đánh đổi, không dừng chờ chọn), xếp cỡ việc
   rồi viết tài liệu (bước 6–8) với mọi lựa chọn đánh dấu **quyết định của agent**, nêu nổi bật ở checkpoint (chỉ
   nêu riêng lựa chọn công nghệ/nền tảng quan trọng) để người dùng sửa khi duyệt.

3. **Hỏi gom một thẻ.**
   Gom mọi câu còn thiếu vào **một thẻ** theo `ask-user.md` của skill `plan-execution` (tối đa 4 câu, mỗi câu kèm đáp
   án khuyến nghị, đúng một câu mở), như bước hỏi của `brainstorming` và Bước 2 `workflow-feature`; không hỏi từng câu
   qua nhiều lượt. Neo vào tình huống cụ thể; đoán để họ sửa thường tốt hơn hỏi. Tám nhóm của
   [references/elicitation.md](references/elicitation.md) là **vùng phủ** để không bỏ sót, không đọc ra thành câu.
   Ưu tiên câu mở khoá AC. Ca biên theo mục "Rà ca biên" của `references/clarify-core.md` (skill `brainstorming` / `core:brainstorming`): ca có mặc định dẫn code đi vào tin nhắn hỏi gom đầu tiên. Chuyện kỹ thuật/nền tảng: hỏi người dùng muốn tự chọn hay giao agent; agent chọn thì ghi
   **quyết định của agent**.

4. **Playback — tóm tắt lại từng phần.**
   Làm theo mục "Playback — tóm tắt lại từng phần" của `references/clarify-core.md` (skill `brainstorming` / `core:brainstorming`): tóm tắt
   lại từng phần, đánh dấu **[giả định]**, kết bằng "sai hoặc thiếu gì?", xen kẽ với câu hỏi.

5. **Đề xuất 2–3 hướng + 1 khuyến nghị + đánh đổi** — đặt **sau playback**.
   Làm theo mục "Đề xuất 2–3 hướng — đặt sau playback" của `references/clarify-core.md`, gồm ghi chú **lệch có chủ đích** (đừng bỏ bước
   này). Riêng skill này: cả hướng được chọn lẫn các hướng bị loại (kèm đánh đổi và lý do) đều ghi vào `design.md`;
   người dùng chốt hướng → mục Quyết định đã chốt. Cần diagram (flow/ERD/sequence/kiến trúc) → skill
   **`engineering-diagram`**; chỉ đưa hình khi nhìn tốt hơn đọc.

6. **Xếp cỡ việc** (xác nhận lại ở đây; nếu việc lớn lên giữa chừng thì dừng, nâng cỡ).
   - **Việc rõ và nhỏ** → không chạy workflow (đã xử lý ở bước 2).
   - **Thay đổi nhỏ** → chỉ `requirement.md` (AC nằm ở đây) + checkpoint trong chat; không có `design.md`, không có `plan.md`.
   - **Dự án** → `requirement.md` + `design.md` + `plan.md`, mỗi file một gate người duyệt.
   - **Dự án lớn, nhiều chức năng độc lập** (mỗi chức năng đủ lớn để có plan riêng) → vẫn một thư mục request; chia part ở
     `parts/<nn>-<part-slug>/` và thêm mục `## Bảng part` vào `design.md` gốc (template `design.template.md`). AC chỉ khai ở gốc.
     Không tách thành nhiều thư mục request; request không chia part thì bỏ mục này.

   AC chỉ nằm một nơi: `requirement.md` khi có; `design.md` chỉ chứa AC nếu không có `requirement.md`.

**B. Ghi tài liệu**

7. **Giao `engineering-spec-analyst` ghi tài liệu.**
   Gói đầu vào đã chốt (mục tiêu, phạm vi, câu trả lời, hướng đã chọn, danh sách **quyết định của agent**,
   **[giả định]**, cỡ việc) rồi giao agent ghi `requirement.md` (+ `design.md` khi cỡ dự án) theo
   [references/spec-structure.md](references/spec-structure.md). Agent không hỏi người dùng; thiếu đầu vào thì trả `blocked`
   + `questions[]` và session chính hỏi lại. Bám scaffold `_TEMPLATE`, mở rộng chứ không thay thế. Tiếng Việt CÓ DẤU.
   Mỗi acceptance criterion mang ID `AC<n>.<m>` (`<n>` = số thứ tự requirement, `<m>` = số thứ tự AC trong requirement đó,
   vd `AC1.2`), viết Given/When/Then, để `plan.md` và `tasks.md` phủ/truy vết đúng ID. AC nêu kết quả số phải kèm khối `calc: <biểu thức> = <kết quả>` trong backtick; `check-request.mjs` tính lại (W22).
   Skill này KHÔNG dựng `plan.md`
   (kế hoạch triển khai thuộc `engineering-plan-writing` sau khi spec được duyệt).
   Điền `## Ảnh hưởng spec` của `design.md` theo `references/spec-structure.md` (mục "Điền `design.md`"): (1) đọc `docs/specs/README.md` trước; (2) năng lực chưa có spec khai `- <năng-lực>: thêm R1`; (3) "repo chưa có spec" không phải lý do `Không ảnh hưởng`. Báo cáo trả session chính nêu năng lực mới cần `spec.md` ở bước gộp.

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
   **quyết định của agent** kèm mặc định đã chọn và nêu nổi bật ở checkpoint. Trừ tính năng người dùng nêu mà design chỉ
   làm một phần: mục đó vẫn nêu ở checkpoint duyệt design như điều chưa được duyệt, không ghi là quyết định của agent.
   **Không có tool subagent** → session chính tự đọc tài liệu như builder theo cùng prompt.

   **Spike giả định (sau builder check, trước checkpoint).** Mỗi giả định [Unverified] về hành vi thư viện, framework hay
   hạ tầng mà hướng đã chọn dựa vào (đoán sai thì phải đổi hướng, không chỉ sửa một AC) được kiểm bằng một spike trước
   checkpoint: một test hoặc script nhỏ, chạy được trong repo, tối đa khoảng 15 phút mỗi giả định, không đưa vào nhánh
   nếu không cần giữ. Kết quả ghi vào `design.md` (mục rủi ro/giả định) kèm lệnh chạy lại; giả định bị bác thì sửa hướng
   trước checkpoint. Không spike được (thiếu hạ tầng, tốn quá giới hạn) thì nêu ở checkpoint như rủi ro chặn hướng để
   người dùng chọn, không để tới lúc task tích hợp mới phát hiện.

10. **Verify.**
    Chạy checklist [references/checklist.md](references/checklist.md): đủ mục; mỗi requirement truy vết được
    (nguồn/actor/mục tiêu); acceptance criteria đo được; scope + out-of-scope rõ; rủi ro/giả định/câu hỏi mở
    liệt kê; ADR ghi cho quyết định lớn; đặt đúng `docs/requests/<ngày>-<slug>/`; tiếng Việt có dấu. Chạy
    `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/` để soát ID AC
    và cấu trúc thư mục request. Kiểm AC mâu thuẫn theo mục "Acceptance criteria không mâu thuẫn" của checklist. Nêu rõ
    phần còn thiếu (fail-loud); con người **duyệt**.

## Dấu hiệu đang tự biện minh

| Suy nghĩ | Thực tế |
|---|---|
| "Yêu cầu rõ rồi, viết spec luôn" | Qua cổng "đủ thông tin" trước; chỉ việc rõ và nhỏ mới bỏ quy trình. |
| "Chỗ này tôi đoán được, khỏi hỏi" | Ghi **[giả định]** kèm cơ sở và đưa vào câu hỏi mở; lựa chọn khi người dùng bỏ qua phần hỏi là **quyết định của agent**. |
| "AC này khó đo, viết chung chung cũng được" | AC phải đo được theo Given/When/Then; có kết quả số thì kèm `calc:`. |
| "Hỏi thêm vài lượt cho chắc" | Gom một thẻ mỗi lượt; builder check chỉ chạy một lần. |

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
