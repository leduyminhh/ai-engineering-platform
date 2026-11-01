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

- **Docs-only, với đúng hai ngoại lệ tường minh.** Skill chỉ ghi `brief.md`; không sinh code, không sửa file khác của
  project, không commit. Ngoại lệ: (1) HTML phụ trợ cho hiển thị trực quan ghi ở `.aip/runs/brainstorm-<slug>/` (tạo
  `.aip/.gitignore` chứa `*` nếu chưa có để git bỏ qua); (2) spike bỏ đi, **chỉ khi người dùng đồng ý**, làm ở thư mục tạm
  ngoài repo, không commit, bỏ sau khi dùng; muốn giữ lại spike thì đó là một request mới.
- **Không bịa.** Phần đoán đánh dấu **[giả định]** và đưa vào mục "Phần đoán" của brief; không trình bày như điều người
  dùng đã nói.
- **Đi xem cần đồng ý.** Chỉ việc nạp context nền ở bước 1 là mặc định, không cần hỏi. Mọi việc đi xem sâu hơn (đọc code,
  đọc file khác, đọc web, tài liệu ngoài repo) thì nêu rõ muốn xem gì và vì sao, rồi **chờ đồng ý**, bất kể trong hay
  ngoài repo.
- **Nơi lưu brief.** Trong repo code: `docs/requests/<yyyy-mm-dd>-<slug>/brief.md`. Ngoài repo code (không có
  `docs/requests/` hoặc việc không gắn với repo): hỏi người dùng muốn lưu ở đâu, không tự chọn (đưa câu này vào thẻ ở lượt hỏi đầu); người dùng đã bỏ qua phần hỏi thì không hỏi: lưu ở `.aip/runs/brainstorm-<slug>/brief.md` và ghi lựa chọn đó là **quyết định của agent**.
- **Slug** (`<slug>` trong đường dẫn): chỉ `a-z`, `0-9`, `-`, không dấu, tối đa 60 ký tự, không có `/` hay `..`; `.aip` luôn ở gốc repo chính.
- **Không ghi đè** `brief.md` đã có khi chưa hỏi; có sẵn thì hỏi cập nhật hay tạo bản mới.
- **Người dùng giữ cổng duy nhất:** duyệt brief. Skill không tự chạy workflow hay skill kế tiếp.

## Quy trình — nghĩ cùng rồi ghi brief

1. **Nạp context nền và qua cổng "đủ thông tin".** Đọc `CLAUDE.md`, `project-knowledge/`, `docs/decisions/` và
   `docs/specs/` khi có; đây là phần duy nhất đọc mặc định. Rồi qua cổng của `clarify-core.md`. Việc đã đủ rõ và nhỏ: nói
   với người dùng việc đã đủ rõ nên **không brainstorm và không ghi brief**, rồi kết thúc skill; làm việc đó theo yêu cầu
   thông thường ngoài skill (việc làm ngoài skill không bị ràng buộc docs-only của skill này). Còn lại mới tiếp tục, và
   chốt `<slug>` ngay khi hiểu tên việc.
2. **Lượt hỏi đầu.** Một tin nhắn gồm đúng hai phần: một dòng nói người dùng có thể **bỏ qua phần hỏi** bất cứ lúc nào, và
   **một thẻ gom câu hỏi** (hỏi theo `ask-user.md` của skill `plan-execution`: một lần gọi công cụ hỏi có lựa chọn, tối đa 4 câu, mỗi câu 2–4 lựa chọn với đáp án khuyến nghị đứng đầu; câu mở viết trong chat ngay trước lời gọi; không có công cụ thì danh sách đánh số). Mỗi câu trong thẻ (trừ câu mở) kèm một **đáp án khuyến nghị** để người dùng chỉ cần "đồng ý" hoặc sửa (đáp án khuyến nghị cho dữ kiện agent chưa biết thì đánh dấu **[giả định]**); thẻ
   có đúng **một câu mở** để người dùng tự mô tả tình huống bằng lời của họ (thẻ này thay cho câu mở đơn lẻ của
   `clarify-core.md`). Các lượt sau cũng gom thành một thẻ, không hỏi từng câu qua nhiều lượt. Người dùng bỏ qua phần hỏi
   → bỏ hỏi, bỏ playback từng phần và không đi xem thêm (ghi "chưa xem" vào Hiện trạng), agent tự chọn, ghi mọi lựa chọn là **quyết định của agent** vào brief và nêu ở thẻ
   duyệt brief (checkpoint của skill này).
3. **Nội dung cần nắm** theo [references/coverage.md](references/coverage.md): loại việc và điểm đặc biệt, vì sao bây giờ
   và thành công trông thế nào, goal/non-goal/anti-goal, tham khảo đã thấy, hiện trạng. Đó là vùng phủ để kiểm không sót,
   không đọc ra thành câu. **Mô tả trước, phương án sau.** Người dùng bí thì được đưa menu 2–3 hướng cho họ chọn, bất kỳ
   lúc nào; đó là công cụ gỡ bí, không thay đề xuất bắt buộc ở bước 7. Tự nghĩ rộng riêng tư, bỏ hướng yếu, không đổ cả
   đống ý tưởng lên người dùng.
4. **Đề nghị đi xem.** Khi một phần hiểu biết nằm ở code, file, tài liệu hay web mà agent chưa xem, nêu rõ muốn xem gì và
   vì sao rồi **chờ đồng ý** (trong hay ngoài repo, theo mục Ranh giới an toàn). Phần chưa xem ghi rõ là chưa xem.
5. **Spike bỏ đi** khi người dùng cần cảm nhận mới chốt được (một mẫu, một đoạn thử, một bản nháp): hỏi đồng ý, làm nhanh
   ở thư mục tạm ngoài repo, cho xem, rồi bỏ. Không commit và không đưa spike vào brief như kết quả.
6. **Hiển thị trực quan** khi người dùng hiểu rõ hơn khi thấy hơn khi đọc, theo
   [references/visual.md](references/visual.md): widget inline có nút nếu phiên có công cụ hiển thị, không thì HTML cục
   bộ ở `.aip/runs/brainstorm-<slug>/`, không thì text. Không viết server riêng.
7. **Playback từng phần, rồi đề xuất hướng.** Hiểu xong một phần thì tóm tắt lại, đánh dấu chỗ đoán là **[giả định]**,
   kết bằng "sai hoặc thiếu gì?" (chi tiết ở `clarify-core.md`). Sau đó, và chỉ **sau playback**, agent đề xuất 2–3
   hướng + 1 khuyến nghị + đánh đổi, ghi cả hướng bị loại. Người dùng bỏ qua phần hỏi thì không có playback: agent vẫn
   đề xuất, tự chọn theo khuyến nghị và ghi **quyết định của agent** (xem `clarify-core.md`).
8. **Ghi brief.md nháp** theo template `brief` của `artifact-templates` (`references/brief.template.md`; bỏ khối
   `<!-- artifact-template … -->`), đặt ở nơi đã chốt ở mục Ranh giới an toàn, trạng thái `draft`. Điền khối
   `## Định tuyến` (`loại-việc`, `phạm-vi`, `đầu-ra-mong-đợi`, `rủi-ro`, `ứng-viên-route`), để `route-đã-duyệt` trống.
9. **Builder check** đọc brief nháp, bằng một subagent mới theo [references/builder-check.md](references/builder-check.md):
   phân kết quả thành 3 nhóm (đã trả lời / nhỏ → **quyết định của agent** / của người dùng), chỉ nhóm cuối đi hỏi, gom
   vào **một tin nhắn**. Đó là **một vòng** hỏi duy nhất của bước kiểm, không chạy lại builder check sau khi nhận trả lời;
   người dùng đã bỏ qua phần hỏi thì không hỏi. Không có công cụ subagent thì tự đọc theo cùng prompt. Rồi **cập nhật
   brief** theo kết quả và chạy
   `node <thư mục skill artifact-templates>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/`, chỉ
   báo thư mục request lỗi cấu trúc chứ không kiểm nội dung brief, nên tự soát brief theo template (đủ mục, khối `## Định tuyến` đủ khoá, giá trị đúng tập đóng; `route.mjs` ở bước 10 báo giá trị sai) rồi sửa (ngoài repo code thì bỏ lệnh này, ghi "chưa chạy check-request").
10. **Kiểm route rồi trình một thẻ duyệt brief.** Chạy
    `node <thư mục skill brainstorming>/scripts/route.mjs <brief.md> <orchestrator>`. `<orchestrator>` là
    `workflows/orchestrator/WORKFLOW.md` trong repo aip, hoặc file `SKILL.md` của skill `workflow-orchestrator` trong bản
    cài (đã kiểm: bản build của file này parse ra route đúng); đọc orchestrator qua `route.mjs` là bước máy của skill,
    không tính là đi xem. Không tìm thấy orchestrator, hoặc `route.mjs` thoát 2
    (thiếu đối số hoặc không đọc được file): ghi "chưa kiểm route", báo đường dẫn lỗi cho người dùng và để
    `route-đã-duyệt` trống. Từ JSON `{ chosen, candidates, reason, confidence }` trình **một thẻ duyệt brief**: mở `brief.md` ở pane file rồi hỏi bằng lựa chọn bấm được (Duyệt brief và route đề xuất / Chọn route khác / Sửa brief / Dừng; theo `ask-user.md`) kèm nội dung gồm: tóm
    tắt brief (kèm các **quyết định của agent**), route đề xuất (`chosen`), hoặc hai ứng viên (`candidates`) để người
    dùng chọn, hoặc "chưa có quy trình phù hợp" kèm gợi ý làm trong phiên, và câu nói rõ người dùng **luôn ghi đè được
    route** (ghi đè sang skill ngoài hai bảng của orchestrator thì gọi thẳng skill đó, không qua orchestrator). Route chọn có risk `high` hoặc `critical` (đọc cột Risk của `## Registry`) thì thẻ này đòi một câu duyệt rõ
    ràng cho route đó, không coi im lặng là đồng ý; câu duyệt này thay xác nhận ở Bước 3 của orchestrator nên chỉ ghi
    `route-đã-duyệt` sau khi có nó.
11. **Sau khi người dùng duyệt:** ghi `route-đã-duyệt: <id | chưa-có-quy-trình>` và `Trạng thái: approved` vào brief
    (người dùng ghi đè thì ghi route họ chọn). Duyệt brief là **cổng duy nhất** của brainstorm và cũng là duyệt route;
    không mở thêm cổng nào khác. Rồi gợi ý bước kế: gọi `workflow-orchestrator` với brief, hoặc skill đã chọn; route `chưa-có-quy-trình` thì không
    gọi orchestrator (nó chỉ báo lại rồi dừng) mà gợi ý làm việc trong phiên theo brief; **không tự chạy**. Người dùng sửa brief thì cập nhật và trình lại thẻ, không chạy lại builder check.

## Verification (trước khi báo hoàn thành)

- Đã qua cổng "đủ thông tin" (việc đủ rõ và nhỏ thì kết thúc skill mà không ghi brief); lượt đầu có dòng bỏ qua phần hỏi
  và một thẻ gom câu hỏi (đáp án khuyến nghị mỗi câu, một câu mở); không hỏi từng câu qua nhiều lượt.
- Mọi lựa chọn agent tự đưa ra ghi **quyết định của agent**; phần đoán ghi **[giả định]**; không có spike nào bị đưa vào brief.
- Đề xuất 2–3 hướng của agent đặt sau playback (hoặc ghi quyết định của agent khi người dùng bỏ qua phần hỏi).
- Mọi việc đi xem sâu hơn (ngoài nạp context nền ở bước 1) đã được người dùng đồng ý; file ghi ra chỉ gồm `brief.md` và,
  nếu có, HTML phụ trợ cùng `.aip/.gitignore` (một lần, chứa `*`) ở `.aip/runs/brainstorm-<slug>/`; spike (nếu có) ở thư
  mục tạm ngoài repo, không commit, đã bỏ.
- `brief.md` nháp được ghi trước builder check; đã chạy đúng một builder check đọc brief nháp, câu hỏi của người dùng gom
  trong một tin nhắn, rồi brief được cập nhật theo kết quả.
- `brief.md` đúng template `brief` (tự soát), khối `## Định tuyến` đủ khoá và giá trị đúng tập đóng; đã chạy `check-request.mjs` (hoặc nêu lý do không chạy; lệnh này chỉ bắt lỗi cấu trúc thư mục).
- Đã chạy `route.mjs` sau khi brief cập nhật (hoặc ghi "chưa kiểm route"); thẻ duyệt nêu route hoặc hai ứng viên hoặc
  "chưa có quy trình", quyền ghi đè, và câu duyệt rõ cho route risk cao.
- `route-đã-duyệt` và `Trạng thái: approved` chỉ ghi sau khi người dùng duyệt; chưa tự chạy bước kế.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/clarify-core.md](references/clarify-core.md): phần làm rõ chung (cổng đủ thông tin + lối thoát, nguyên tắc
  hỏi, playback, 2–3 hướng sau playback); `engineering-spec-writing` dùng chung file này.
- [references/coverage.md](references/coverage.md): danh sách nội dung cần nắm làm vùng phủ kiểm không sót.
- [references/builder-check.md](references/builder-check.md): prompt mẫu cho subagent mới, 3 nhóm kết quả, một vòng hỏi,
  cách tự đọc khi không có subagent.
- [references/visual.md](references/visual.md): khi nào hiển thị trực quan, thứ tự widget inline → HTML cục bộ → text.

Tham khảo: skill brainstorming của một bộ plugin bên thứ ba cho Claude Code (xem design request
`docs/requests/2026-10-31-brainstorming-routing/design.md`); không chép nội dung.
