# So sánh superpowers vs aip: khâu làm rõ ý định, thiết kế, lập plan

Phạm vi: trước khi code. Chỉ đọc, không sửa repo. Nhãn `[Inference]` = suy luận của reviewer, không phải điều đọc trực tiếp.

Viết tắt đường dẫn:
- `SP/bs` = `...superpowers\7.0.0\skills\brainstorming\SKILL.md`
- `SP/bc` = `brainstorming\builder-check-prompt.md`
- `SP/vc` = `brainstorming\visual-companion.md`
- `SP/wp` = `writing-plans\SKILL.md`
- `SW` = `plugins/engineering/skills/engineering-spec-writing/SKILL.md`
- `EL` = `.../engineering-spec-writing/references/elicitation.md`
- `SS` = `.../engineering-spec-writing/references/spec-structure.md`
- `TB` = `plugins/engineering/skills/engineering-task-breakdown/SKILL.md`
- `WF` = `workflows/feature/WORKFLOW.md`
- `CR` = `core/skills/artifact-templates/scripts/check-request.mjs`
- `AG` = `core/agents/AGENTS.template.md`

Chưa đọc hết: `brainstorming/scripts/*` (server visual companion, 4 file, ~1100 dòng), `visual-companion.md` dòng 120–299, phần cuối `task-template-frontend.md`, phần sau dòng 190 của `check-tasks.mjs`. Các phần này không đổi kết luận bên dưới (chỉ là cơ chế server/loop của visual companion).

## Phát hiện gốc (đọc trước bảng)

1. **workflow-feature không có bước plan và không có bước design doc.** Bước 2 chỉ ra `requirement.md` (WF:57–79), Bước 3 chỉ là contract OpenAPI + ADR (WF:81–92), Bước 4 implement thẳng từ `requirement.md` (WF:94–116). `plan.md` và `design.md` chỉ xuất hiện trong nhánh superpowers (WF:34–37, AG:156–159). Hệ quả: nếu bỏ superpowers, aip mất luôn khâu lập plan; không có skill nào dạy viết `plan.md` (chỉ có template `plan.template.md`, header 11–21).
2. **Khâu làm rõ của aip nằm trong subagent.** `engineering-spec-analyst` (mode write, không có tool `Agent`) được giao "hỏi từng câu" (spec-analyst:31–32, EL:8–9). `[Inference]` subagent không hội thoại trực tiếp được với người dùng; chính `task-breakdown.md:8–10` và spec-analyst:41–44 xử lý bằng cách "DỪNG, trả kết quả để session chính trình người duyệt". Nghĩa là việc "làm rõ chi tiết" nên chạy ở session chính, không ở agent.
3. **Template `design.md` của aip đã port gần đủ cấu trúc design doc của superpowers** (Quyết định đã chốt, Ngoài phạm vi và anti-goal, Để builder quyết, Rủi ro và câu hỏi mở: `design.template.md:15,25,33,35`). Thứ thiếu là **quy trình** tạo ra nó (playback, builder check, đề xuất phương án), không phải khung.
4. **`check-request.mjs` kiểm cấu trúc, không kiểm chất lượng làm rõ**: nguồn AC (W1/W2, CR:143–148), ID AC (W3/W4), header plan (W5: chỉ `Goal`, `Spec`, CR:164–170), AC được plan/tasks phủ (W6), test nhắc AC (W7–W9, CR:182–205), "Ảnh hưởng spec" (W10–W14, CR:208–241), trạng thái design + plan còn sót sau merged (W15/W16, CR:243–250). Chỉ cảnh báo, exit 1 khi `--strict`.

## 1. Bảng cơ chế

| # | Cơ chế | superpowers làm gì | aip làm gì | Ưu / nhược | Khuyến nghị |
|---|---|---|---|---|---|
| 1 | Cổng "đã đủ thông tin chưa" | Trước khi trả lời tự hỏi "mình biết gì về điều họ muốn và vì sao"; đủ trong request thì làm luôn (`SP/bs:17–24`) | Không có cổng. Spec-writing luôn khảo sát (`SW:47–51`); WF luôn chạy đủ 8 bước | SP: tránh hỏi thừa với việc rõ. aip: nhất quán nhưng nặng cho việc nhỏ | **lấy** — bắt đầu bằng cổng này, ánh xạ vào bảng cỡ việc (hàng 11); giảm câu hỏi lặt vặt từ gốc |
| 2 | Câu mở đầu + lối thoát | Tin nhắn đầu = 1 dòng "muốn bỏ qua hỏi thì nói" + 1 câu mở gợi kể tình huống thật; người dùng chọn bỏ qua thì skill kết thúc, chỉ nêu lựa chọn công nghệ quan trọng (`SP/bs:26–39`) | Không có lối thoát; bắt đầu bằng đọc context rồi hỏi theo nhóm (`SW:41–51`) | SP: tôn trọng người dùng đã rõ ý. aip: không có | **lấy** — đúng yêu cầu "ít câu hỏi lặt vặt"; thêm vào bước làm rõ của session chính |
| 3 | Cách hỏi | Mỗi tin nhắn chỉ kết thúc bằng 1 câu, không kèm danh sách ví dụ; câu mở trước, menu chỉ khi họ bí; câu neo vào tình huống cụ thể; đoán để họ sửa thường hơn hỏi (`SP/bs:41–55, 78–81`) | "Hỏi từng câu khi thiếu", nhưng nguồn câu hỏi là ngân hàng 8 nhóm × 2–4 câu (`EL:17–64`), có cả mẫu "Ai là người dùng chính? Còn actor phụ nào…" | SP: câu hỏi đáng giá, gắn vào tình huống. aip: ngân hàng dạng checklist dễ sinh câu lặt vặt, nhưng tách rõ nhóm giúp không bỏ sót | **chỉnh rồi lấy** — giữ 8 nhóm làm "vùng phủ" ẩn (giống `SP/bs:67–76` "territory, not script"), không đọc ra thành câu; ưu tiên câu mở khoá AC (đã có ở `EL:13–14`) |
| 4 | Nạp context / recon | Sau khi có chút nền thì *đề nghị* đi xem codebase/file/web, nói rõ sẽ tìm gì, người dùng quyết (`SP/bs:83–85`) | Bắt buộc nạp `project-knowledge/`, ADR, contract, `CLAUDE.md` trước khi hỏi, thiếu thì fail-loud (`SW:41–45`); chỉ hỏi phần còn thiếu (`EL:3–4`) | aip tốt hơn: đọc trước, khỏi hỏi lại điều có sẵn trong repo. SP: xin phép mỗi lần, thêm 1 lượt | **giữ aip** — recon trong repo là mặc định không cần xin; chỉ xin phép khi phải ra ngoài repo (web) |
| 5 | Chọn "cách làm" (công nghệ/nền tảng) | Hỏi sớm họ muốn tự chọn hay giao cho mình; chọn thay thì ghi là "quyết định của agent", không phải điều họ đồng ý (`SP/bs:57–65`) | Không có; chỉ gợi ý ADR cho quyết định lớn (`SW:65–68`) | SP: tránh gán quyết định cho người dùng. aip: ADR chỉ cho quyết định lớn | **lấy** — thêm vào `design.md` nhãn "quyết định của agent" tách khỏi "đã chốt cùng người dùng" |
| 6 | Playback (nói lại để xác nhận) | Mô tả lại từng phần 200–300 từ ngay khi hiểu xong phần đó, xen kẽ với câu hỏi; chỗ đoán đánh dấu "của mình", kết bằng "sai/thiếu gì?" (`SP/bs:112–127`) | Chỉ "diễn giải lại một câu" trước khi chốt (`EL:10`); xác nhận hiểu đúng ở `SW:50–51` | SP: bắt lỗi hiểu sai sớm, theo từng đoạn nhỏ. aip: một lần, dễ bị bỏ qua | **lấy** — đây là điểm tăng chất lượng làm rõ lớn nhất; dùng `[giả định]` của aip thay cho "của mình" |
| 7 | Đề xuất phương án | "Nghĩ rộng riêng tư": tự sinh nhiều ý, bỏ ý yếu; chỉ cho xem so sánh khi giúp họ quyết (`SP/bs:87–90`); Red Flags nói đưa options sớm là "steer" (`SP/bs:199`) | Không có bước đề xuất phương án ở feature. ADR có 2–4 phương án nhưng chỉ cho quyết định lớn (spec-analyst:38–40) | Mâu thuẫn với yêu cầu chủ repo ("đưa ra đề xuất"): SP cố ý hạn chế options. aip: không có gì | **chỉnh rồi lấy** — giữ nguyên tắc "hỏi mô tả trước, đề xuất sau"; sau khi playback xong phải có bước **đề xuất 2–3 hướng + khuyến nghị 1 hướng + đánh đổi**, ghi vào `design.md`; quyết định lớn mới sang `engineering-adr` |
| 8 | Visual companion (mockup/diagram trong trình duyệt) | Offer đúng lúc, tin nhắn riêng; server node + HTML trong `.superpowers/brainstorm/` + URL có key (`SP/bs:205–225`, `SP/vc:33–58`) | Không có. Diagram qua `engineering-diagram` (PlantUML, ghi `docs/diagram/` khi xác nhận; SW:62–63) | SP: trực quan cho UI. Nặng: server nền, cổng, khoá phiên, phụ thuộc Windows/background; kéo theo `.superpowers/` mới | **bỏ** (giai đoạn này) — dùng `engineering-diagram`; giữ lại duy nhất luật "chỉ đưa visual khi nhìn tốt hơn đọc" vào hướng dẫn. `[Inference]` có thể là sáng kiến riêng sau |
| 9 | Spike (thử nhanh bỏ đi) | Đề nghị spike khi rẻ hơn hỏi; spike không cần test/plan/review; giữ lại = yêu cầu mới quay lại cổng (`SP/bs:104–110, 189–190, 203`) | Không có | SP: rẻ để hiểu ý. aip: mọi thứ qua 8 bước + baseline | **chỉnh rồi lấy** — thêm như nhánh tuỳ chọn, gắn nhãn throwaway, nằm ngoài Bước 1 baseline và ngoài cổng duyệt; muốn giữ code → quay lại Bước 2 |
| 10 | Tách dự án độc lập | Nếu thực ra là nhiều dự án độc lập: nói, thống nhất thứ tự, brainstorm lần lượt (`SP/bs:142–143`); writing-plans lặp lại ở Scope Check (`SP/wp:19–21`) | Ngưỡng "mơ hồ" của task-breakdown (`analysis.md:15–22`) và phân rã use case (`TB:49–51`) nhưng không có bước "tách thành nhiều request" | Tương đương một phần | **lấy** (câu một dòng ở bước cỡ việc) |
| 11 | Kích cỡ việc | Bảng 3 cỡ: việc rõ → làm luôn; thay đổi nhỏ → mô tả trong chat; dự án → design doc + plan; lớn lên giữa chừng thì dừng, nâng cỡ (`SP/bs:129–140`) | Chỉ một cỡ. Orchestrator có bảng "yêu cầu chạy trực tiếp bằng skill" (`workflows/orchestrator/WORKFLOW.md:57`), không phải cỡ việc theo độ phức tạp | SP: tiết kiệm cho việc nhỏ. aip: một quy trình nặng cho mọi việc | **chỉnh rồi lấy** — ánh xạ: quick → không workflow; small → `requirement.md` ngắn + checkpoint trong chat, bỏ `plan.md`; project → `requirement.md` + `design.md` + `plan.md` |
| 12 | Tài liệu thiết kế viết ra | Một doc một người xây giỏi lập plan được mà không hỏi lại: ý định/vì sao, goal/non-goal/anti-goal, ràng buộc, phần họ đã quyết, phần để builder (`SP/bs:145–158`) | `design.template.md` (36 dòng) khớp gần như từng mục; thêm Trạng thái vòng đời, Ảnh hưởng spec, Kiểm thử. Quy trình viết thì chỉ ở `SW:53–63` cho `requirement.md`; `design.md` chỉ "khi có thiết kế" | aip: khung đủ, có vòng đời + ảnh hưởng spec (SP không có). Thiếu hướng dẫn nội dung "đã chốt / để builder quyết / anti-goal" | **giữ aip** (khung) + **lấy** phần hướng dẫn điền các mục đó vào skill |
| 13 | Builder check | Sau khi có doc: sub-agent mới (prompt `SP/bc:6–23`) đóng vai builder giỏi, không được hỏi người viết, chỉ liệt kê câu hỏi còn cần, xếp hạng, bỏ nitpick/phần giao cho builder; nếu không còn → "nothing important left". Phân 3 nhóm: đã trả lời / nhỏ (tự quyết, ghi "mình quyết") / của họ; gom 1 tin nhắn, đây là vòng hỏi duy nhất của bước kiểm (`SP/bs:160–177`) | Không có. Template có mục "Để builder quyết" nhưng không có bước kiểm. `engineering-spec-analyst` không dispatch được sub-agent (tools không có `Agent`) | Đây là cơ chế chính **giảm câu hỏi lặt vặt mà không giảm chất lượng**: câu nhỏ do agent tự quyết và nêu rõ, chỉ câu đổi kết quả mới hỏi | **chỉnh rồi lấy** — session chính chạy (không phải spec-analyst); prompt đặt trong `references/` của skill spec-writing; không có sub-agent → tự đọc như builder (SP cho phép, `SP/bs:176–177`); báo cáo dạng `agent_result` nếu dùng agent |
| 14 | Cổng cứng (hard gate) | Không build gì khi người dùng chưa duyệt mô tả đầy đủ (chat cho việc nhỏ, doc cho dự án); opt-out và spike là hai ngoại lệ; sau duyệt doc → chỉ gọi writing-plans (`SP/bs:179–193`) | Checkpoint ⏸ Bước 2 (AC + phạm vi), Bước 3 (contract/ADR), Bước 8 (diff) (WF:186–194). Chưa duyệt Checkpoint 2 → chưa sang Bước 3 (WF:66–67). Không có cổng riêng cho plan | aip: checkpoint thật + graph.json (`graph.json:34–40` kiểu gate human). Thiếu: cổng duyệt **plan**, dù AG:146 coi plan approval là human gate | **giữ aip** + thêm gate human cho plan (xem hàng 22) |
| 15 | Vị trí & tên file | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (`SP/bs:156–158`), plan `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` (`SP/wp:16`) | `docs/requests/<yyyy-mm-dd>-<slug>/{requirement,design,plan,tasks}.md` (AG:158–159) | aip: một thư mục một thay đổi, resume dễ (AG:184–195) | **giữ aip** |
| 16 | Tách yêu cầu / thiết kế | Một doc "design" duy nhất gộp mọi thứ; AC không có khái niệm riêng | `requirement.md` (AC, ràng buộc, bối cảnh) tách `design.md` (quyết định, thiết kế, ảnh hưởng spec); AC chỉ ở một file (W2) | aip: truy vết AC rõ, kiểm được bằng script | **giữ aip**; xem xung đột 2.2 về khi nào chỉ cần `design.md` |
| 17 | Định dạng AC + truy vết test | Không có khái niệm AC; plan chỉ nói "mỗi task có test chứng minh" (`SP/wp:10, 146–147`) và "Spec coverage" tự soát (`SP/wp:167`) | `AC<n>.<m>` Given/When/Then (SS:47–49), `**Phủ AC:**` mỗi task, `- Test:` trong `**Files:**`, test nhắc ID AC; script cảnh báo W6–W9 | aip mạnh hơn hẳn, tất định, kiểm bằng lệnh | **giữ aip** — không đổi gì |
| 18 | Cấu trúc plan: bản đồ file | Trước khi chia task phải vẽ bản đồ file tạo/sửa, mỗi file một trách nhiệm, theo pattern hiện có (`SP/wp:23–32`) | `plan.template.md` chỉ có `**Files:**` theo task (21–31); không có bản đồ file toàn cục; `check-partition.mjs` (CLAUDE.md) chỉ kiểm nhóm song song | SP: chốt quyết định phân rã sớm. aip: chỉ cục bộ | **lấy** (thêm một đoạn "Bản đồ file" vào plan; không cần script) |
| 19 | Độ mịn task / step | Task = đơn vị nhỏ nhất có chu trình test riêng và đáng một cổng review; gộp setup/docs vào task cần chúng (`SP/wp:34–41`). Step = một hành động có kết quả kiểm được: viết test đỏ → chạy thấy đỏ → code → chạy xanh → commit (`SP/wp:43–50, 108–137`). Chỉ viết chữ ký, tên test + assert, không chép thân hàm (`SP/wp:140–161`) | `tasks.md` (engineering-task-breakdown): tách theo lát dọc `CT→DB→BE→FE-UI→FE-INT→E2E`, size S ≤ 0.5 ngày / M ≤ 2 ngày, L buộc tách (`sizing.md:3–9`), mỗi task có 9–10 mục B1–B10/F1–F9 (`task-template-backend.md`) dành cho người + agent giao việc. `plan.md` aip: `Step` một dòng (`plan.template.md:31`), không có hướng dẫn | **Hai artifact khác mục đích**: SP = kế hoạch thực thi cho agent theo TDD; aip `tasks.md` = bảng việc để teamlead giao. Không thay thế nhau | **giữ aip** `tasks.md` (tuỳ chọn, như hiện tại) **+ lấy** quy tắc độ mịn của SP cho `plan.md`; khi có `tasks.md` thì plan-task trỏ tới ID task thay vì tự chia lại (tránh hai bản chia) |
| 20 | Interfaces giữa task | Mỗi task có `Interfaces: Consumes / Produces` với chữ ký chính xác, vì implementer chỉ thấy task của mình (`SP/wp:102–106`) | Không có trong plan template; trong `tasks.md` thì có "Phụ thuộc" + B1–B10 (endpoint/operationId, validation…) | Quan trọng khi mỗi task chạy ở sub-agent (aip WF:96–100 giao agent theo phía BE/FE) | **lấy** — thêm `**Interfaces:**` vào `plan.template.md` |
| 21 | Header plan: Global Constraints + Review Focus | `Global Constraints` (giá trị nguyên văn từ spec, mọi task ngầm kế thừa) và `Review Focus` (5 input/failure mode spec ngụ ý mà test chưa phủ, mỗi dòng có test ở task sở hữu) (`SP/wp:70–87`) | `plan.template.md:19–21` có cả hai tiêu đề rỗng; check-request không kiểm nội dung chúng; không có hướng dẫn cách điền | Template đã port tên, mất nội dung hướng dẫn | **lấy** hướng dẫn điền (vào skill mới); không thêm cảnh báo script ở giai đoạn này |
| 22 | Self-review plan | Tự soát (không dispatch): phủ spec, quét step, nhất quán tên/kiểu, Review Focus, tỉ lệ plan so với spec (plan dài nhiều lần spec = "chép chương trình") (`SP/wp:163–177`) | Chỉ script cấu trúc (W5–W9) + checklist skill spec/task-breakdown. Không có tự soát nội dung plan | SP: bắt lỗi ngữ nghĩa (tên hàm lệch, step mơ hồ). aip: bắt lỗi cấu trúc, tất định | **lấy** — hai lớp bổ sung nhau: tự soát 5 mục của SP trước, rồi `check-request.mjs` |
| 23 | Duyệt plan + bàn giao thực thi | Link plan, hỏi duyệt; nếu người dùng đã chọn cách thực thi thì chỉ hỏi "plan có đúng ý không", còn không thì hỏi chọn subagent-driven hay native, kèm khuyến nghị 1 câu (`SP/wp:179–204`) | Execution mặc định đã ghi: subagent-driven, "không hỏi lại sau khi plan duyệt" (AG:146–154); WF chạy agent theo vai trò Bước 4–7 | aip đã đóng câu hỏi chọn phương thức bằng baseline; tránh hỏi thừa | **giữ aip** (mặc định, một dòng "plan đúng ý chưa?"); bỏ nhánh chọn native vs subagent. Xem xung đột 2.5 về TDD vs thứ tự Bước 4→5 |
| 24 | Giữ thực thi nhất quán | `Announce at start`, header "REQUIRED SUB-SKILL: superpowers:…" trong plan (`SP/wp:12, 59`) | Giữ nguyên header đó trong `plan.template.md:11` và contract test `test/contract/35-artifact-templates.contract.mjs:199` kiểm chuỗi này | Sau khi bỏ superpowers, header trỏ tới skill không tồn tại | **bỏ** — thay bằng trỏ tới skill/workflow aip |

## 2. Xung đột và đề xuất bên thắng

2.1 **Ai hỏi người dùng: session chính hay `engineering-spec-analyst`.**
- aip: agent khảo sát và hỏi (spec-analyst:29–33), ở checkpoint mới trả kết quả cho session chính (WF:57–67).
- superpowers: một cuộc hội thoại liên tục, playback xen kẽ (SP/bs:112–118).
- **Thắng: superpowers cho khâu hội thoại.** Session chính làm elicitation + playback + đề xuất phương án + builder check; `engineering-spec-analyst` chỉ nhận đầu ra đã chốt để **ghi** `requirement.md`/`design.md`/ADR/`tasks.md` (đúng `writeScope: docs/**`). `[Inference]` đây là thay đổi lớn nhất vì agent hiện mô tả cả khảo sát lẫn viết.

2.2 **Tên artifact: `design.md` (superpowers) vs `requirement.md` + `design.md` (aip).**
- AC chỉ được nằm một nơi (W2, CR:146–148; AG:163–167). `design.template.md:17–18` cho phép AC trong `design.md` khi không có `requirement.md`.
- **Thắng: aip.** Cỡ "small" chỉ `requirement.md`; cỡ "project" có `requirement.md` (AC) + `design.md` (quyết định, ảnh hưởng spec) + `plan.md`; không bao giờ AC ở cả hai.
- Hệ quả cần quyết: hiện WF không tạo `design.md` nên W10–W14 (ảnh hưởng spec sống) không bao giờ chạy trên đường đi aip. Cần quyết khi nào `design.md` bắt buộc (đề xuất: cỡ project, hoặc khi đổi hành vi một năng lực trong `docs/specs/`).

2.3 **"Đề xuất phương án": SP chủ đích hạn chế (SP/bs:199) vs chủ repo yêu cầu "đưa ra đề xuất".**
- **Thắng: yêu cầu chủ repo**, nhưng đặt sau playback, không thay thế câu mở: hỏi mô tả trước, đề xuất 2–3 hướng + 1 khuyến nghị sau. `[Inference]` đây là lệch có chủ đích khỏi superpowers; ghi rõ trong skill để người đọc sau không "sửa lại" theo SP.

2.4 **Ai duyệt, mấy lần.**
- superpowers: duyệt design doc (SP/bs:179–193) rồi duyệt plan (SP/wp:182–185); builder check chỉ hỏi một vòng.
- aip: Checkpoint 2 (AC) rồi Checkpoint 3 (contract/ADR), không có duyệt plan (WF:186–194); task-breakdown có thêm 2 checkpoint riêng (TB:49–51, 74–82) khi người dùng chọn tách task.
- **Thắng: giữ checkpoint aip, thêm một gate duyệt plan** (AG:146 đã coi plan approval là cổng người). Tránh bốn lần duyệt chồng nhau: khi có `tasks.md`, gộp Checkpoint 2 của task-breakdown với duyệt plan.

2.5 **Thứ tự test: TDD (superpowers) vs implement → test (aip).**
- SP plan step: test đỏ trước, code sau (SP/wp:108–137).
- aip: Bước 4 implement bằng `backend-implementer`/`frontend-implementer`, Bước 5 test bằng agent test-writer riêng; Bước 5 cấm sửa production "cho test xanh" và Gate chỉ cho phép file test đổi (WF:94–140).
- **Không tự quyết được** vì chạm khâu thực thi (ngoài phạm vi báo cáo này). Đề xuất tạm: plan viết `- Test:` theo task (CR đọc được) nhưng **không cam kết** thứ tự step TDD cho tới khi chủ repo chọn: giữ tách vai (aip) hay chuyển sang vòng test-trước theo task. Cần chủ repo quyết.

2.6 **Quy ước ngôn ngữ và độ dài mô tả.** Skill SP viết tiếng Anh; aip bắt buộc tiếng Việt có dấu, mô tả skill ≤ 500 ký tự có "Dùng khi" và "Không dùng khi → id", thân có H2 `## Quy trình…` và `## Ranh giới an toàn…` (CLAUDE.md, `cli/lib/conventions.mjs`). **Thắng: aip**; chỉ tóm ý, không dịch/chép nguyên văn SP.

2.7 **Superpowers tham chiếu chéo ngay trong nội dung aip** (cần gỡ khi bỏ SP): điều kiện tiên quyết WF:34–37, `workflows/bugfix/WORKFLOW.md:32–35`, `workflows/orchestrator/WORKFLOW.md:29–33,57,79,85`, header plan (`plan.template.md:11`), nguồn tham chiếu trong `design/plan/requirement.template.md` và `artifact-templates/SKILL.md:23–25,89`, baseline `AG:144–182,188`, `.superpowers/sdd/` ledger (`AG:188`). **Thắng: aip phải tự đủ**, không còn nhánh "nếu có superpowers thì dùng".

2.8 **Visual companion ghi vào `.superpowers/brainstorm/`** (SP/vc:58) khác chuẩn "state trong `docs/requests/`" và `.ai-engineering/`. **Thắng: aip** — và vì thế khuyến nghị bỏ (hàng 8).

## 3. Danh sách file aip sẽ phải đổi nếu áp khuyến nghị

Nội dung projected → phải bump version `.manifest.json` của plugin sở hữu rồi `node cli/lib/versions.mjs --lock` (CLAUDE.md).

**Mới (đề xuất):**
- `plugins/engineering/skills/engineering-plan-writing/SKILL.md` + `references/` (bản đồ file, độ mịn step, Interfaces, Global Constraints, Review Focus, self-review 5 mục, gate duyệt plan). `[Inference]` đặt ở plugin `engineering` vì `plugins/_published.json` coi cả plugin published và ghi nhớ "skill cross-cutting vào engineering"; cần `order`, `runsIn`, `invoke`, mô tả theo Phase 1 template.
- `plugins/engineering/skills/engineering-spec-writing/references/builder-check.md` (prompt builder check, tóm ý từ `SP/bc`).
- Có thể: `plugins/engineering/skills/engineering-spec-writing/references/playback.md` hoặc gộp vào `elicitation.md`.

**Sửa nội dung:**
- `plugins/engineering/skills/engineering-spec-writing/SKILL.md` — lối thoát opt-out, cổng "đủ thông tin", playback, bước đề xuất phương án, builder check, chạy ở session chính; `Ranh giới an toàn` đổi "hỏi TỪNG câu" thành quy tắc mới.
- `.../engineering-spec-writing/references/elicitation.md` — 8 nhóm thành "vùng phủ", bỏ "đọc ra thành câu"; thêm quy tắc đoán-để-họ-sửa, câu mở.
- `.../engineering-spec-writing/references/spec-structure.md` và `checklist.md` — mục `design.md` (đã chốt / quyết định của agent / để builder quyết / anti-goal), checklist builder check.
- `plugins/engineering/agents/engineering-spec-analyst.md` — chuyển khâu hỏi sang session chính, agent chỉ ghi tài liệu từ đầu vào đã chốt; thêm `engineering-plan-writing` vào `skills` nếu agent soạn plan.
- `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` (+ `references/analysis.md`, `output-formats.md`) — quan hệ với `plan.md` (task trỏ ID `tasks.md`, tránh hai bản chia), gộp checkpoint duyệt.
- `workflows/feature/WORKFLOW.md` — bỏ "Superpowers" ở Điều kiện tiên quyết (34–37); Bước 2 tách làm rõ ý định (session chính, cỡ việc, playback, đề xuất) khỏi ghi `requirement.md`; thêm bước/đoạn `design.md` + `plan.md` + gate duyệt plan; `Checkpoint`, `Definition of Done`, `Report cuối` theo đó.
- `workflows/feature/graph.json` — thêm node (hoặc chia node `requirements`) khớp thân WF; gate human mới; `max_attempts: 2` cho cạnh lùi (CLAUDE.md); kiểm bằng `checkGraph`/`checkGraphAgainstBody`.
- `workflows/feature/references/task-breakdown.md`, `references/error-matrix.md` — theo luồng mới.
- `workflows/bugfix/WORKFLOW.md:32–35` — bỏ nhánh superpowers (`systematic-debugging` cần phương án thay: `[Inference]` ngoài phạm vi báo cáo này).
- `workflows/orchestrator/WORKFLOW.md:29–33,57,79,85` — bỏ routing sang superpowers; thêm dòng cho cỡ việc.
- `core/agents/AGENTS.template.md:144–195` (và `AGENTS.md` ở gốc, phải trùng byte sau chuẩn hoá xuống dòng) — viết lại mục "Superpowers workflow defaults" thành mặc định aip, bỏ ghi chú "ghi đè `docs/superpowers/`", ledger `.superpowers/sdd/`, `finishing-a-development-branch`.
- `core/skills/artifact-templates/references/plan.template.md` — bỏ header "REQUIRED SUB-SKILL: superpowers…", thêm `**Interfaces:**`, đoạn bản đồ file.
- `core/skills/artifact-templates/references/design.template.md`, `requirement.template.md` — bỏ nguồn `superpowers:*` trong khối header `<!-- artifact-template -->`; design: mục "quyết định của agent" nếu chọn.
- `core/skills/artifact-templates/SKILL.md:23–25,89` — cột nguồn + mô tả plan.
- `core/skills/artifact-templates/scripts/check-request.mjs` — chỉ nếu muốn cảnh báo mới (vd plan thiếu `**Interfaces:**`, `design.md` bắt buộc theo cỡ); không bắt buộc cho giai đoạn đầu.
- `core/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/_versions.lock.json` — bump + lock.
- `docs/specs/artifact-templates/spec.md`, `docs/specs/baseline/spec.md` (R1–R3 nhắc `brainstorming`/`writing-plans`) — cập nhật theo `Ảnh hưởng spec`; request mới cần mục `## Ảnh hưởng spec`.
- `CHANGELOG.md`, `README.md`/`README_VI.md` (nếu nhắc luồng superpowers; chưa grep README, `[Unverified]`).

**Test phải đổi:**
- `test/contract/35-artifact-templates.contract.mjs:199` — assert header superpowers.
- `test/content/18-superpowers-docs-standard.pin.mjs:81,112–128` — AC1.1 (ghi đè `docs/superpowers/`), AC3.2 (nhánh superpowers ở feature/bugfix/orchestrator); file này nên đổi tên và rút gọn thành pin cho chuẩn mới, hoặc xoá pin đã hết hiệu lực theo quy ước "retire".
- Thêm pin cho skill mới, graph mới (`test/contract/*`), và (nếu thêm cảnh báo mới) test cho `check-request.mjs`.

## 4. Năm khuyến nghị quan trọng nhất

1. **Bắt buộc có khâu design + plan trong aip**: hiện `workflow-feature` không có plan, nên bỏ superpowers là mất khâu này; thêm skill `engineering-plan-writing` (bản đồ file, độ mịn step, Interfaces, Global Constraints, Review Focus, tự soát 5 mục) + gate duyệt plan.
2. **Chuyển khâu làm rõ ra session chính** (hội thoại liên tục, playback 200–300 từ xen kẽ), `engineering-spec-analyst` chỉ ghi tài liệu.
3. **Lấy bộ ba giảm câu hỏi lặt vặt mà vẫn giữ chất lượng**: lối thoát opt-out + cổng "đủ thông tin" + builder check (phân "đã trả lời / nhỏ-tự quyết-ghi rõ / của họ", gom một lượt).
4. **Chỉnh bước đề xuất theo yêu cầu chủ repo**: sau playback, đưa 2–3 hướng + 1 khuyến nghị + đánh đổi (lệch có chủ đích khỏi SP/bs:199), ghi vào `design.md`.
5. **Giữ nguyên các thứ aip mạnh hơn**: vị trí `docs/requests/`, tách `requirement.md`/`design.md`, ID `AC<n>.<m>` + `**Phủ AC:**` + `check-request.mjs`, `tasks.md`; bỏ visual companion và mọi tham chiếu `superpowers:*` (WF, bugfix, orchestrator, AG, template, contract test).

Điểm cần chủ repo quyết (reviewer không tự quyết được): thứ tự TDD vs implement→test (2.5), khi nào `design.md` bắt buộc (2.2), có thêm cảnh báo script mới hay chưa.
