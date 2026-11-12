# Brief: Triển khai nhiều component — thứ tự deploy, rollback, ngân sách RAM production
- Ngày: 2026-11-12
- Trạng thái: approved

## Vấn đề và loại việc
Hạng 5 của backlog `docs/requests/2026-11-12-skill-coverage-audit/backlog.md` (trục thiếu/mỏng). Khi một feature chạm từ hai component trở lên mà mỗi component deploy riêng (backend, frontend, worker, reverse proxy), bộ skill không có chỗ nào nói thứ tự deploy giữa chúng, rollback theo thứ tự nào và dọn gì, hay tổng RAM của các component có vừa máy production không.

Đọc thân skill ([Verified], ngày 2026-11-12):

- `ops-deploy-release` và 3 file `references/` của nó viết cho một service. Thứ tự duy nhất được nêu là migration chạy trước hay sau deploy code (`release-checklist.md`, mục 2). Grep các từ `RAM`, `compose`, `mồ côi`, `orphan`, `nhiều service` trong skill này không ra gì.
- `engineering-plan-writing` có tập `Kind` đóng (`BE, FE-UI, FE-INT, E2E, DB, CT, DOCS, TOOLING`) không có kind triển khai. Các template `design`, `plan`, `requirement` không có mục nào nói về triển khai.
- `plan-execution` (cả `references/finish.md`) và `workflows/feature` không nhắc `ops-deploy-release`; chữ "rollback" ở workflow chỉ nói về git. Chỉ `workflows/orchestrator` định tuyến "chuẩn bị deploy" sang skill này, và skill tự khai `invoke: per-request`, không thuộc chuỗi pipeline.

Kết luận: gap nằm ở cả hai lớp: nội dung nhiều component còn thiếu trong `ops-deploy-release`, và không có chỗ nào trong luồng feature để gọi tới nó.

Loại việc: thay đổi nội dung skill và template (không có code chạy). Đây là một request riêng trong top 5 của backlog.

## Vì sao bây giờ và thành công trông thế nào
Tần suất ([Verified] là số đếm regex trên ledger của một project nguồn, có thể đếm dư): 8/23 ledger, 6/9 request nhắc thứ tự deploy, rollback hoặc RAM production. Chi phí là `[Inference]`: deploy sai thứ tự làm component này gọi component kia chưa sẵn sàng (lỗi 404/403), rollback bỏ sót tài nguyên (container mồ côi), tổng RAM vượt máy. Chưa đọc từng dòng ledger của cụm này nên chưa biết mỗi ca tốn bao nhiêu.

Thành công trông như sau, kiểm được:

1. Request chạm từ hai component deploy riêng trở lên có mục "Triển khai" trong design hoặc plan, nêu rõ: thứ tự deploy và tiêu chí kiểm sau mỗi bước, rollback theo thứ tự nào và dọn gì, tổng RAM so với ngân sách.
2. Gọi `ops-deploy-release` cho ca nhiều component thì checklist có đủ ba mục trên; `finish.md` nhắc tới nó khi design khai nhiều component.
3. `npm test` xanh, điểm routing không tụt dưới ngưỡng khoá, version `.manifest.json` của plugin/core bị chạm đã bump và `_versions.lock.json` khớp.
4. Đo hiệu quả: đếm lại cụm này trên request mới của project nguồn. Chưa có số nền ngoài 8/23 và 6/9 nên kết quả đo là việc về sau, không phải điều kiện duyệt.

## Goal, non-goal, anti-goal
**Goal**
- Thêm nội dung cho triển khai nhiều component vào `ops-deploy-release`: thứ tự theo phụ thuộc, rollback theo thứ tự ngược kèm bước dọn tài nguyên còn sót, ngân sách RAM (cộng giới hạn từng component, kể cả lúc hai version chạy song song). Ưu tiên đặt trong `references/` để `SKILL.md` không dài thêm nhiều.
- Thêm mục "Triển khai" tuỳ chọn vào template design hoặc plan, dùng khi chạm từ hai component deploy riêng trở lên, và một dòng nhắc ở `finish.md` (vào `next_actions`) trỏ tới `ops-deploy-release`.

**Non-goal**
- Không viết script kiểm RAM hay bất kỳ script mới nào; không chạy hay thêm lệnh deploy (giữ `deploy-safety.md`: aip chỉ trình bày kế hoạch và lệnh, người chạy).
- Không thêm skill mới, không thêm `Kind` vào tập đóng của plan.
- Không đổi chuẩn hoá đầu vào trong AC (hạng 1), routing (hạng 2), hợp đồng giữa component (hạng 3), viết Bash/CI/runbook (hạng 4).

**Anti-goal**
- Không biến thành bước bắt buộc ở `finish.md` hay cổng chặn G3: nhánh chỉ đổi tooling không được bị hỏi thừa.
- Không làm tụt điểm routing của `ops-deploy-release` hay skill gần nó (`git-release`, `ops-observability`) khi sửa `description`.
- Không để agent tự deploy hay tự rollback production trong bất kỳ đường nào của nội dung mới.

## Hiện trạng và tham khảo đã thấy
Đã đọc: backlog hạng 5 và mục "Chưa xem và giới hạn"; thân `ops-deploy-release` cùng `release-checklist.md`, `rollback-strategies.md`, `deploy-safety.md`; `engineering-plan-writing/references/plan-structure.md`; `plan-execution/references/finish.md`; `workflows/feature/WORKFLOW.md` (qua grep các từ khoá và mục xử lý lỗi/rollback); mục `ops-deploy-release` trong `workflows/orchestrator/WORKFLOW.md` và `test/routing/ops-deploy-release.json`; `plugins/_published.json` (plugin `ops` đã published trọn).

Chưa xem:
- Từng dòng ledger của cụm 6 ở project nguồn (chỉ có số đếm và con trỏ), nên chi phí vẫn `[Inference]`.
- Thân `plan-execution/SKILL.md`, `task-loop.md` và `design.template.md` đọc bằng grep, chưa đọc toàn bộ; cần đọc trước khi design.
- Hai request khác của top 5 (hạng 3, hạng 4) đang được brainstorm ở phiên riêng; chưa biết chúng sẽ chạm file nào.

Giới hạn bằng chứng: một project nguồn cho cụm này; số đếm regex có thể dư; chưa có tình huống cụ thể do người dùng kể (câu mở của thẻ hỏi đầu chưa được trả lời).

## Hướng đã cân nhắc
1. **Hai lớp (chọn, người dùng chốt).** Nội dung nhiều component trong `ops-deploy-release` cộng mục tuỳ chọn ở design/plan và một dòng nhắc ở `finish.md`. Đánh đổi: chạm ba nơi (plugin `ops`, template, `finish.md`), phải bump version ở cả plugin `ops` và core; đổi lại có đường kích hoạt từ luồng feature, nên nội dung không nằm im.
2. **Chỉ nội dung `ops-deploy-release` (loại).** Ít file nhất, ít rủi ro routing. Loại vì khoảng trống "không ai gọi" đã [Verified]: không bước nào của luồng feature tới skill này, người dùng phải tự nhớ gọi.
3. **Skill mới riêng cho triển khai nhiều component (loại).** Tách bạch nhưng thêm một bề mặt routing, trùng trigger với `ops-deploy-release` (từ "deploy", "rollback" đã khớp nó) và `git-release`. Loại vì rủi ro làm tụt điểm routing lớn hơn lợi ích.
4. **Bước bắt buộc ở `finish.md` (loại).** Bảo đảm gọi nhưng thêm cổng hỏi thừa cho nhánh không có gì để deploy (ví dụ nhánh chỉ đổi tooling). Loại vì nặng so với tần suất.

## Quyết định của agent
- Slug `multi-component-deploy`.
- Phân loại `feature`, phạm vi `ops` (nhãn gần nhất trong tập đóng). `route.mjs` trả "chưa có quy trình phù hợp" cho cặp này vì `workflow-feature` chỉ khai `code-be`, `code-fe`, `fullstack`. Ứng viên `workflow-feature` giữ lại làm lựa chọn ghi đè (request `skill-enrichment-from-usage` đi đường này với việc sửa nội dung skill); người dùng chốt ở thẻ duyệt.
- Hiểu "nhiều component" là nhiều đơn vị deploy riêng (backend, frontend, worker, proxy), không phải nhiều module trong một artifact.
- Mục "Triển khai" đặt ở `design.md` (không phải plan): dòng nhắc ở `finish.md` kích hoạt theo việc design có mục này, nên mục và điều kiện kích hoạt phải ở cùng một tài liệu. Design có mục "Triển khai" thì nhắc, không có thì không nhắc; không thêm trường khai danh sách component. Khi design, đọc `check-request.mjs` để biết thêm mục có sinh cảnh báo mới không.
- Ngân sách RAM: con số do người dùng hoặc `project-knowledge/` cung cấp; checklist chỉ yêu cầu ghi phép cộng giới hạn từng component (kể cả lúc hai version chạy song song) so với ngân sách. Thiếu con số ngân sách thì ghi "chưa đạt" và xin người dùng, không đoán. Không gắn một công cụ cụ thể (compose chỉ là ví dụ).
- `description` của `ops-deploy-release`: mặc định không đổi; chỉ đổi tối thiểu khi nội dung mới cần trigger, và khi đó điểm routing không được tụt dưới ngưỡng khoá (không nới ngưỡng). Điểm tụt thì ưu tiên giữ ngưỡng, gỡ trigger và dựa vào dòng nhắc ở `finish.md`.
- Hạng 4 sửa cùng plugin `ops`: hai request chạy tuần tự, request nào merge sau thì rebase và bump version lại (`_versions.lock.json`).
- Kiểm: dùng `npm test` hiện có (validate, versions lock, routing). Không thêm test ghim chữ tài liệu (AGENTS.md, mục Testing); eval tuỳ chọn nằm ngoài `npm test`, để design quyết.
- `phạm-vi: ops` là nhãn gần nhất trong tập đóng; việc thực tế chạm cả `plugins/ops/` và `core/`.
- Chạy trọn `workflow-feature` cho việc sửa nội dung markdown là cách repo đã làm với request sửa nội dung skill (`skill-enrichment-from-usage`); thẻ duyệt cho bạn đổi route nếu muốn nhẹ hơn.

Đã chốt qua thẻ hỏi đầu (người dùng chọn đáp án khuyến nghị cho cả bốn câu): gap ở cả hai lớp; mức tự động là mục tuỳ chọn cộng nhắc ở `finish.md`; chỉ viết checklist, không chạm lệnh deploy; tách khỏi hạng 3 và hạng 4. Câu mở (tình huống thật của người dùng) chưa được trả lời.

## Phần đoán
- `[giả định]` Ngưỡng "từ hai component trở lên" đủ để bật mục "Triển khai"; chưa có dữ liệu cho ngưỡng khác.
- `[Inference]` Chi phí khi thiếu (lỗi 404/403, container mồ côi sau rollback) lấy từ mô tả cụm trong ghi chú audit, chưa đối chiếu từng dòng ledger.
- `[Inference]` Hạng 4 cũng có thể sửa `plugins/ops/` (backlog ghi `ops-deploy-release` là skill gần nhất của nó), nên hai request không nên chạy song song trên cùng file.
- `[giả định]` Sửa `description` của `ops-deploy-release` (nếu cần cho trigger "nhiều component") không làm tụt điểm routing; cần chạy `node scripts/routing-score.mjs` để biết.

## Định tuyến
loại-việc: feature
phạm-vi: ops
đầu-ra-mong-đợi: ops-deploy-release có phần triển khai nhiều component (thứ tự, rollback kèm dọn tài nguyên, ngân sách RAM), template design hoặc plan có mục "Triển khai" tuỳ chọn, và finish.md nhắc gọi skill khi design khai nhiều component
rủi-ro: sửa description hoặc thêm nội dung làm tụt điểm routing của ops-deploy-release và skill gần nó; chạm cả plugin ops lẫn core nên phải bump version hai nơi; request hạng 4 có thể sửa cùng plugin ops
ứng-viên-route: [workflow-feature]
route-đã-duyệt: chưa-có-quy-trình
