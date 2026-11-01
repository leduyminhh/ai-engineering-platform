---
name: brainstorming
description: "Nghĩ cùng người dùng về việc chưa rõ loại (feature, bug, quyết định, quy trình, nghiên cứu, tài liệu, nghiệp vụ, không làm gì), hỏi gom một thẻ rồi ghi brief.md kèm route đề xuất. Dùng khi người dùng muốn \"brainstorm\", \"nghĩ cùng\", \"chưa rõ nên làm gì\", \"bàn ý tưởng\". Không dùng khi yêu cầu đã rõ cần viết spec → engineering-spec-writing; đã có brief hoặc việc đã rõ loại cần chọn workflow → workflow-orchestrator."
order: 9
title: "Brainstorming — nghĩ cùng, ghi brief và đề xuất route (dùng chung)"
runsIn: plan
invoke: per-request
effort: high
argument-hint: "[vấn đề hoặc ý tưởng]"
---

# Brainstorming (skill dùng chung)

Skill dành cho việc **chưa rõ loại**: có thể là một feature, một bug, một quyết định, một quy trình, một đợt nghiên cứu,
một tài liệu, một việc nghiệp vụ, hoặc kết luận là không làm gì. Không giới hạn domain và không giả định có code. Nghĩ
cùng người dùng ở **session chính** rồi ghi kết quả thành **`brief.md`**: một tài liệu ngắn nêu việc là gì, vì sao, thành
công trông thế nào và nên đi route nào. Skill dừng ở brief đã duyệt; làm tiếp là việc của workflow hoặc skill được chọn.

Hỏi, tóm tắt lại, đề xuất hướng và builder check **chỉ chạy ở session chính**: subagent không hội thoại trực tiếp với
người dùng. Phần làm rõ chung (cổng "đủ thông tin", lối thoát, playback, 2–3 hướng) nằm ở
[references/clarify-core.md](references/clarify-core.md), là nguồn duy nhất; skill này không chép lại.

## Ranh giới an toàn

- **Docs-only:** chỉ ghi `brief.md`; không sinh code, không sửa file khác, không chạy lệnh làm đổi trạng thái project.
- **Không bịa.** Phần đoán đánh dấu **[giả định]** và đưa vào mục "Phần đoán" của brief; không trình bày như điều người
  dùng đã nói.
- **Đi xem ngoài repo cần đồng ý.** Đọc code và file trong repo là mặc định. Đọc web, tài liệu ngoài repo hay mở thứ gì
  ngoài hội thoại: hỏi trước, người dùng đồng ý rồi mới làm.
- **Spike bỏ đi.** Thử nhanh để lấy cảm giác thì làm ở nơi tạm và bỏ sau khi dùng; muốn giữ lại thì đó là một request mới,
  không nằm trong brainstorm này.
- **Nơi lưu brief.** Trong repo code: `docs/requests/<yyyy-mm-dd>-<slug>/brief.md`. Ngoài repo code (không có `docs/requests/`
  hoặc việc không gắn với repo): hỏi người dùng muốn lưu ở đâu, không tự chọn.
- **Không ghi đè** `brief.md` đã có khi chưa hỏi; có sẵn thì hỏi cập nhật hay tạo bản mới.
- **Người dùng giữ cổng duy nhất:** duyệt brief. Skill không tự chạy workflow hay skill kế tiếp.

## Quy trình — nghĩ cùng rồi ghi brief

1. **Nạp context và qua cổng "đủ thông tin".** Đọc `CLAUDE.md`, `project-knowledge/`, `docs/decisions/`, `docs/specs/` và
   `docs/requests/` khi có; tìm trong repo trước khi hỏi. Rồi qua cổng của `clarify-core.md`: việc đủ rõ và nhỏ thì **làm
   thẳng, không brainstorm** và nói với người dùng như vậy. Còn lại mới tiếp tục.
2. **Lượt hỏi đầu.** Một tin nhắn gồm đúng hai phần: một dòng nói người dùng có thể **bỏ qua phần hỏi** bất cứ lúc nào, và
   **một thẻ gom câu hỏi**. Mỗi câu trong thẻ kèm một **đáp án khuyến nghị** để người dùng chỉ cần "đồng ý" hoặc sửa; thẻ
   có đúng **một câu mở** để người dùng tự mô tả tình huống bằng lời của họ. Các lượt sau cũng gom thành một thẻ, không
   hỏi từng câu qua nhiều lượt. Người dùng bỏ qua phần hỏi → agent tự chọn, không hỏi thêm, ghi mọi lựa chọn là
   **quyết định của agent** vào brief và nêu ở thẻ duyệt.
3. **Nội dung cần nắm** theo [references/coverage.md](references/coverage.md): loại việc và điểm đặc biệt, vì sao bây giờ
   và thành công trông thế nào, goal/non-goal/anti-goal, tham khảo đã thấy, hiện trạng. Đó là vùng phủ để kiểm không sót,
   không đọc ra thành câu. **Mô tả trước, phương án sau:** chỉ đưa menu 2–3 hướng khi người dùng bí hoặc sau playback.
   Tự nghĩ rộng riêng tư, bỏ hướng yếu, không đổ cả đống ý tưởng lên người dùng.
4. **Đề nghị đi xem.** Khi một phần hiểu biết nằm ở code, file, tài liệu hay web mà agent chưa xem, nói rõ muốn xem gì và
   vì sao, rồi **chờ đồng ý** nếu phải ra ngoài repo. Phần chưa xem ghi rõ là chưa xem.
5. **Spike bỏ đi** khi người dùng cần cảm nhận mới chốt được (một mẫu, một đoạn thử, một bản nháp): làm nhanh ở nơi tạm,
   cho xem, rồi bỏ. Không đưa spike vào brief như kết quả.
6. **Hiển thị trực quan** khi người dùng hiểu rõ hơn khi thấy hơn khi đọc, theo
   [references/visual.md](references/visual.md): widget inline có nút nếu phiên có công cụ hiển thị, không thì HTML cục
   bộ dưới `.aip/runs/<request>/`, không thì text. Không viết server riêng.
7. **Playback từng phần.** Hiểu xong một phần thì tóm tắt lại, đánh dấu chỗ đoán là **[giả định]**, kết bằng "sai hoặc
   thiếu gì?" (chi tiết ở `clarify-core.md`). Đề xuất 2–3 hướng + khuyến nghị đặt **sau** playback.
8. **Builder check** bằng một subagent mới theo [references/builder-check.md](references/builder-check.md): phân kết quả
   thành 3 nhóm (đã trả lời / nhỏ → **quyết định của agent** / của người dùng), chỉ nhóm cuối đi hỏi, gom vào **một tin
   nhắn**. Đó là **một vòng** hỏi duy nhất của bước kiểm; người dùng đã bỏ qua phần hỏi thì không hỏi. Không có công cụ
   subagent thì tự đọc theo cùng prompt.
9. **Ghi `brief.md`** theo template `brief` của `artifact-templates` (`references/brief.template.md`; bỏ khối
   `<!-- artifact-template … -->`), đặt ở nơi đã chốt ở mục Ranh giới an toàn, trạng thái `draft`. Điền khối
   `## Định tuyến` (`loại-việc`, `phạm-vi`, `đầu-ra-mong-đợi`, `rủi-ro`, `ứng-viên-route`), để `route-đã-duyệt` trống.
   Chạy `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/` và sửa
   mọi cảnh báo thuộc brief (ngoài repo code thì bỏ bước này, ghi "chưa chạy check-request").
10. **Kiểm route rồi trình một thẻ duyệt brief.** Chạy
    `node <thư mục skill brainstorming>/scripts/route.mjs <brief.md> <WORKFLOW.md của orchestrator>`; orchestrator là
    `workflows/orchestrator/WORKFLOW.md` trong repo aip hoặc bản cài của skill `workflow-orchestrator`. Không tìm thấy
    orchestrator thì ghi "chưa kiểm route" và để `route-đã-duyệt` trống. Từ JSON `{ chosen, candidates, reason, confidence }`
    trình **một thẻ duyệt brief** gồm: tóm tắt brief (kèm các **quyết định của agent**), route đề xuất (`chosen`), hoặc
    hai ứng viên (`candidates`) để người dùng chọn, hoặc "chưa có quy trình phù hợp" kèm gợi ý làm trong phiên, và câu
    nói rõ người dùng **luôn ghi đè được route**. Route chọn có risk `high` hoặc `critical` (đọc cột Risk của
    `## Registry`) thì thẻ này đòi một câu duyệt rõ ràng cho route đó, không coi im lặng là đồng ý.
11. **Sau khi người dùng duyệt:** ghi `route-đã-duyệt: <id | chưa-có-quy-trình>` và `Trạng thái: approved` vào brief
    (người dùng ghi đè thì ghi route họ chọn). Duyệt brief là **cổng duy nhất** của brainstorm và cũng là duyệt route;
    không mở thêm cổng nào khác. Rồi gợi ý bước kế: gọi `workflow-orchestrator` với brief, hoặc skill đã chọn; **không tự
    chạy**. Người dùng sửa brief thì cập nhật và trình lại thẻ, không chạy lại builder check.

## Verification (trước khi báo hoàn thành)

- Đã qua cổng "đủ thông tin"; lượt đầu có dòng bỏ qua phần hỏi và một thẻ gom câu hỏi (đáp án khuyến nghị mỗi câu, một
  câu mở); không hỏi từng câu qua nhiều lượt.
- Mọi lựa chọn agent tự đưa ra ghi **quyết định của agent**; phần đoán ghi **[giả định]**; không có spike nào bị đưa vào brief.
- Đã chạy đúng một builder check; câu hỏi của người dùng gom trong một tin nhắn.
- `brief.md` đúng template `brief`, khối `## Định tuyến` đủ khoá; đã chạy `check-request.mjs` (hoặc nêu lý do không chạy).
- Đã chạy `route.mjs` (hoặc ghi "chưa kiểm route"); thẻ duyệt nêu route hoặc hai ứng viên hoặc "chưa có quy trình", quyền
  ghi đè, và câu duyệt rõ cho route risk cao.
- Chỉ ghi `brief.md`; `route-đã-duyệt` và `Trạng thái: approved` chỉ ghi sau khi người dùng duyệt; chưa tự chạy bước kế.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/clarify-core.md](references/clarify-core.md): phần làm rõ chung (cổng đủ thông tin + lối thoát, nguyên tắc
  hỏi, playback, 2–3 hướng sau playback); `engineering-spec-writing` dùng chung file này.
- [references/coverage.md](references/coverage.md): danh sách nội dung cần nắm làm vùng phủ kiểm không sót.
- [references/builder-check.md](references/builder-check.md): prompt mẫu cho subagent mới, 3 nhóm kết quả, một vòng hỏi,
  cách tự đọc khi không có subagent.
- [references/visual.md](references/visual.md): khi nào hiển thị trực quan, thứ tự widget inline → HTML cục bộ → text.

Tham khảo: skill brainstorming của bộ Claude plugins chính thức (xem design request
`docs/requests/2026-10-31-brainstorming-routing/design.md`); không chép nội dung.
