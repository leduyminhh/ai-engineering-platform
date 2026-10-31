# Thiết kế: brainstorming không giới hạn domain và định tuyến tin cậy
- Ngày: 2026-10-31
- Trạng thái: draft
- Requirement: không có
## Vấn đề và lý do
aip mạnh ở giai đoạn "làm" của phát triển phần mềm nhưng trống ở giai đoạn "nghĩ" và ở mọi việc không phải code. Bước làm rõ (cổng đủ thông tin, playback, 2–3 hướng) chỉ nằm trong `engineering-spec-writing` và luôn kết thúc bằng `requirement.md`/`design.md` của một feature. Người dùng muốn nghĩ cùng về vấn đề chưa rõ loại (feature, bug, quyết định, quy trình, nghiên cứu, tài liệu, nghiệp vụ, hoặc không làm gì) thì không có skill nào hợp; đợt brainstorm `autonomy-gates`/`aip-status` ngày 2026-10-31 phải làm tay. `workflow-orchestrator` chỉ phân loại yêu cầu đã rõ bằng cột Tín hiệu (chuỗi tự do) nên dễ chọn sai, và không có cách quay đầu khi workflow đã chạy mà phát hiện chọn nhầm.
Tham chiếu: skill `brainstorming` của superpowers 7.0.0 (không giới hạn domain, mô tả trước phương án sau, recon có đồng ý, visual companion, spike, playback, builder check, hard gate).
## Quyết định đã chốt
- (1) Skill mới `brainstorming` trong `core` (mọi người dùng aip có, kể cả gói npm chỉ ship core). Không giới hạn domain.
- (2) Hỏi gom từ đầu: lượt đầu gồm một dòng "muốn bỏ qua phần hỏi thì nói" và một thẻ gom câu hỏi (mỗi câu có đáp án khuyến nghị, có một câu mở để người dùng tự mô tả). Các lượt sau cũng gom; không hỏi từng câu qua nhiều lượt. Người dùng bỏ qua → agent tự chọn, ghi "quyết định của agent".
- (3) Lấy từ superpowers: danh sách nội dung cần nắm (loại việc và điểm đặc biệt, vì sao bây giờ và thành công trông thế nào, goal/non-goal/anti-goal, tham khảo đã thấy, hiện trạng); mô tả trước, phương án sau (menu chỉ khi bí); đề nghị đi xem (code, file, web) và chờ đồng ý; nghĩ rộng riêng tư; spike bỏ đi khi cần cảm nhận (giữ lại là request mới); playback từng phần, đánh dấu phần đoán; builder check bằng subagent, chia 3 nhóm, một vòng hỏi; hard gate trước khi làm.
- (4) Hiển thị trực quan khi thấy dễ hơn đọc: widget inline có nút (khi phiên có công cụ hiển thị) cho mockup và so sánh phương án; không có thì HTML cục bộ; không có thì text. Dùng chung hạ tầng HTML với `aip status`, không viết server riêng.
- (5) Đầu ra là `brief.md` trong `docs/requests/<ngày>-<slug>/` (ngoài repo code thì hỏi chỗ lưu) theo template mới `brief.template.md` của `artifact-templates`, có khối định tuyến máy đọc được:
  `loại-việc: feature | bug | quyết-định | nghiên-cứu | quy-trình | tài-liệu | nghiệp-vụ | không-làm`, `phạm-vi: code-be | code-fe | fullstack | data | ops | không-code`, `đầu-ra-mong-đợi`, `rủi-ro`, `ứng-viên-route: [chính, phụ]`. Duyệt `brief.md` là cổng duy nhất của brainstorm và cũng là duyệt route.
- (6) Registry định tuyến là hai bảng sẵn có trong `workflows/orchestrator/WORKFLOW.md` (`## Registry`, `## Yêu cầu chạy trực tiếp bằng skill`), thêm cột `loại-việc`, `phạm-vi`, `điều-kiện`; không thêm khoá frontmatter. Hàng mới cho việc không phải code trỏ tới skill có sẵn (`engineering-adr` cho quyết-định) hoặc ghi "chưa có quy trình — làm trong phiên".
- (7) `core/skills/brainstorming/scripts/route.mjs <brief.md> <orchestrator WORKFLOW.md>` chấm điểm tất định: khớp `loại-việc` và `phạm-vi`, kiểm `điều-kiện`; in JSON `{ chosen, candidates[], reason, confidence }`. Điểm rõ → chọn, không hỏi lại; hai ứng viên sát → liệt kê cả hai trên thẻ duyệt brief; không ứng viên đạt ngưỡng → "chưa có quy trình phù hợp" + gợi ý.
- (8) `workflow-orchestrator` nhận `brief.md`: chạy `route.mjs`, dùng lựa chọn đã duyệt ở (5) để chạy workflow/skill mà không hỏi lại; vẫn nhận yêu cầu tự do như cũ khi không có brief.
- (9) Bước 1 của mỗi workflow pipeline kiểm `điều-kiện` của mình; không khớp → trả `status: misrouted` kèm lý do (thêm giá trị vào contract `workflow-output-contract.md`); orchestrator chọn route kế tiếp mang theo `brief.md` và việc đã làm, không làm lại từ đầu.
- (10) `workflow-feature` thấy `brief.md` của request thì Bước 2 chỉ hỏi phần brief chưa có, không hỏi lại phần đã chốt.
- (11) Ghi mỗi lần định tuyến vào `.aip/routing-log.jsonl` (`{ts, brief, chosen, overridden, misrouted}`); thêm case định tuyến vào `evals/core/` với route kỳ vọng.
- (12) Người dùng luôn ghi đè được route trên thẻ duyệt brief.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given người dùng nêu một vấn đề chưa rõ loại (kể cả không phải code) When gọi `brainstorming` Then lượt đầu có dòng bỏ qua và một thẻ gom câu hỏi có đáp án khuyến nghị
- [ ] **AC1.2** — Given brainstorm đã đủ thông tin When kết thúc Then ghi `brief.md` đúng template, qua builder check, và dừng một lần chờ duyệt
- [ ] **AC1.3** — Given người dùng bỏ qua phần hỏi When brainstorm Then agent tự chọn, ghi "quyết định của agent" trong `brief.md`
- [ ] **AC2.1** — Given `brief.md` hợp lệ khớp rõ một dòng Registry When chạy `route.mjs` Then `chosen` là dòng đó, `confidence` cao
- [ ] **AC2.2** — Given `brief.md` khớp hai dòng gần điểm When chạy `route.mjs` Then trả hai `candidates` và không tự chọn
- [ ] **AC2.3** — Given `brief.md` không khớp dòng nào hoặc thiếu khối định tuyến When chạy `route.mjs` Then trả `chosen: null` kèm lý do
- [ ] **AC3.1** — Given brief đã duyệt When gọi `workflow-orchestrator` Then chạy route đã duyệt không hỏi lại
- [ ] **AC3.2** — Given workflow phát hiện `điều-kiện` không khớp ở Bước 1 When trả kết quả Then `status: misrouted` và orchestrator chuyển route kế tiếp với cùng brief
- [ ] **AC4.1** — Given request có `brief.md` When `workflow-feature` Bước 2 chạy Then chỉ hỏi phần brief chưa có
- [ ] **AC5.1** — Given một lần định tuyến When xong Then `.aip/routing-log.jsonl` có thêm một bản ghi
- [ ] **AC5.2** — Given các case trong `evals/core/` When chạy kiểm cấu trúc (`95-evals.contract.mjs`) Then case định tuyến hợp lệ
- [ ] **AC6.1** — Given 3 vấn đề thử (một feature, một quyết định quy trình không code, một nghiên cứu) When brainstorm rồi định tuyến Then mỗi vấn đề tới đúng route hoặc "chưa có quy trình", ghi kết quả vào `trial-6.md`
## Thiết kế
- `core/skills/brainstorming/SKILL.md` (+ `references/` cho danh sách nội dung cần nắm, builder check, hiển thị trực quan), `scripts/route.mjs` (zero-dependency, đọc bảng markdown của orchestrator như `cli/lib/workflows.mjs`).
- `core/skills/artifact-templates/references/brief.template.md` + mục lục; `check-request.mjs` nhận request chỉ có `brief.md` (chưa có design) mà không báo lỗi giả.
- Phần làm rõ chung (cổng đủ thông tin, playback, 2–3 hướng) tách thành reference dùng chung, `engineering-spec-writing` trỏ tới, không chép hai bản.
- `workflows/orchestrator/WORKFLOW.md` (+ `graph.json` nếu bước đổi), `core/principles/workflow-output-contract.md` (`misrouted`), Bước 1 của 4 workflow pipeline, Bước 2 của `workflow-feature`.
## Ảnh hưởng spec
- workflows: thêm R15
- workflows: đổi R7
- artifact-templates: thêm R12
## Ngoài phạm vi và anti-goal
- Không thêm skill `research`, `writing` hay plugin nghiệp vụ (lộ trình P4, P5); brainstorm chỉ định tuyến tới cái đã có hoặc báo "chưa có quy trình".
- Không gọi model trong `route.mjs`; LLM chỉ phân xử khi hai ứng viên sát và người dùng chưa chọn.
- Không viết server visual companion riêng.
## Ràng buộc
- Chạy sau `2026-10-31-autonomy-gates` và `2026-10-31-aip-status` (cùng sửa `workflow-feature`, `task-loop.md`, hạ tầng HTML); lập plan sau khi hai request đó merge.
- Zero-dependency; bump `core`, `workflows`, `engineering`; `node cli/lib/versions.mjs --lock`; `npm test` xanh; description mới theo template Phase 1 và không trùng câu kích hoạt với `engineering-spec-writing`/`workflow-orchestrator`.
## Không đổi
- `workflow-orchestrator` vẫn nhận yêu cầu tự do khi không có `brief.md`; thứ tự ưu tiên hiện có và tín hiệu sự cố xét trước Registry.
- `engineering-spec-writing` vẫn dùng được độc lập cho feature đã rõ.
## Kiểm thử
- AC2.1–AC2.3: test có tham số cho `route.mjs` với fixture brief + bảng Registry.
- AC5.2: case eval mới qua `test/contract/95-evals.contract.mjs`.
- AC1.1–AC1.3, AC3.1, AC3.2, AC4.1, AC5.1, AC6.1: lượt thử, ghi `trial-6.md`.
## Để builder quyết
- Ngưỡng điểm và cách tính khoảng cách "sát nhau" trong `route.mjs`.
## Rủi ro và câu hỏi mở
- [Unverified] Skill không tự đổi model của session chính; muốn brainstorm bằng opus thì mở phiên bằng opus. Skill khai `effort: high`.
- Gom câu hỏi từ đầu có thể làm câu trả lời mở ngắn hơn (superpowers chọn một câu mỗi lượt vì lý do này); giảm bằng một câu mở trong thẻ và playback trước khi chốt.
- `route.mjs` chỉ tốt bằng chất lượng khối định tuyến của brief; brief sai loại việc thì route sai — người dùng thấy và ghi đè ở thẻ duyệt.
