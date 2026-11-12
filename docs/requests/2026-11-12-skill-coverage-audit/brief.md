# Brief: audit độ bao phủ và độ giàu của bộ skill
- Ngày: 2026-11-12
- Trạng thái: approved

## Vấn đề và loại việc

Người dùng muốn bàn tiếp "vấn đề làm giàu, bao phủ skill": bộ skill của aip thiếu skill nào, skill nào còn mỏng, và tình huống nào chưa skill nào bắt. Đợt 2026-11-11 (`skill-enrichment-from-usage`) làm giàu từ dữ liệu của một project duy nhất; brief đó tự ghi rủi ro lệch stack ở mục Phần đoán.

Đây là một đợt **nghiên cứu / audit**, chưa sửa hay thêm skill. Đầu ra là một backlog xếp hạng để người dùng chọn việc cho request sau. Kiểm kê trên cả bộ: core, workflows và 5 plugin (52 thư mục skill, 5 workflow).

Ba trục của audit (quyết định của agent, định nghĩa vận hành chốt ở design):

- **Thiếu:** tình huống thật mà không skill nào đúng để kích hoạt.
- **Mỏng:** skill kích hoạt đúng nhưng thiếu bước hoặc ca, nên người dùng vẫn làm tay hoặc lỗi lọt sang review.
- **Bắt nhầm:** skill có mà prompt đúng nghĩa lại rơi sang skill khác (routing hạng 1 sai).

## Vì sao bây giờ và thành công trông thế nào

Đợt trước xong ngày 2026-11-11 và khoá routing ở 69/94 trên dữ liệu mù. Người dùng muốn chốt hướng làm giàu tiếp theo trước khi mở request sửa. Đo lại bằng số trong repo cho thấy phần positive còn 65/214 prompt chưa ra hạng 1 (149/214 ra hạng 1; negative 151/160).

Thành công (người dùng chọn): có **backlog xếp hạng, mỗi gap kèm bằng chứng và nhãn `[Verified]` hoặc `[Inference]`**, người dùng duyệt rồi chọn top N cho đợt sau. Người dùng không chọn chỉ số bao phủ chạy lại được, và không chọn nâng khoá routing.

Người duyệt: người dùng, dựa trên việc mỗi gap có nguồn kiểm lại được.

## Goal, non-goal, anti-goal

Goal:

- Bản đồ gap theo ba trục trên, xếp hạng chung toàn bộ, mỗi gap nêu: tình huống, nguồn bằng chứng, nhãn độ chắc, plugin hoặc skill liên quan.
- Mỗi gap ghi rõ nguồn bằng chứng nào làm cơ sở. Gap chỉ một nguồn ghi rõ là một nguồn.
- Phần chưa kiểm được ghi "chưa xem", không suy diễn thành sự thật.
- Thước xếp hạng (người dùng chốt): tác động trước, tức tần suất gặp nhân chi phí khi thiếu (vòng review, việc làm tay). Độ chắc là nhãn `[Verified]`/`[Inference]`, không là trọng số; số nguồn độc lập chỉ dùng để phá thế hoà.
- Skill của bộ ngoài (ví dụ `superpowers`) mà aip không có (người dùng chốt): ghi ở mục "Đối chiếu bên ngoài" riêng của backlog, không vào xếp hạng chính, trừ khi có bằng chứng dùng thật trong ba project.

Non-goal:

- Sửa `SKILL.md`, thêm skill, đổi `description` hay nâng `rank1.lock.json`. Chọn gap nào làm do người dùng quyết sau khi duyệt backlog.
- Thiết kế skill hay plugin mới (kể cả cho mảng hạ tầng). Audit chỉ nêu gap và xếp hạng.
- Thêm chỉ số bao phủ chạy lại được (người dùng không chọn lần này).
- Sửa các project nguồn. Chỉ đọc.

Anti-goal:

- Kết luận gap từ một lượt đọc mỏng rồi trình bày như sự thật.
- Đưa tên riêng, đường dẫn máy hay nội dung nhạy cảm của project nguồn vào tài liệu commit.
- Bỏ sót gap vì chỉ dùng nguồn dễ đo.

## Hiện trạng và tham khảo đã thấy

Đã xem (người dùng đồng ý cho đọc, chỉ đọc):

- Bộ skill hiện có: core 8, backend 11, data 5, engineering 14, frontend 11, ops 3 (đếm thư mục `skills/`); 5 workflow. `data` chỉ publish `data-db-migration`, 4 skill `data-oltp-*`/`data-olap-*` vẫn draft (`plugins/_published.json`).
- Đợt trước: `docs/requests/2026-11-11-skill-enrichment-from-usage/` (brief, design, `baseline.json`), ADR-0005, `scripts/routing-score.mjs`, `test/routing/rank1.lock.json`, `scripts/ledger-metrics.mjs`, `npm run overlap`.
- Routing: positive 149/214 (69%), negative 151/160 (94%). Prompt chọn nhầm, ví dụ trong phần cuối kết quả: `frontend-testing` sang `backend-testing`, `git-workflow` sang `git-worktree`. Chưa phân loại đủ 65 trường hợp.
- Overlap: các cặp backend↔frontend ở 57–59% (`backend-fix`↔`frontend-fix` 59%, `backend-code-review`↔`frontend-code-review` 57%), cặp `*-init` 48–56%; ngưỡng gộp là 60%. Báo cáo tham khảo.
- Ba project đã duyệt:
  - Project hạ tầng `be-documents` (Bash, Docker Compose, Jenkins, runbook Markdown; không có ledger `.aip`): đã đọc `CLAUDE.md` và brief chương trình nâng cấp. Việc của nó gồm sửa lỗi Bash (`set -e` bị tắt trong `if`, pipeline nuốt lỗi), sửa CI luôn đỏ, đối chiếu tài liệu gốc từng sản phẩm, viết runbook theo chuẩn. [Inference] Plugin `ops` chỉ có 3 skill và grep từ khoá trong `core/`, `plugins/`, `workflows/` không thấy skill nào cho shell script, CI config hay viết runbook; chưa đọc từng skill nên chưa kết luận.
  - Project nguồn của đợt trước (cap): chạy lại `ledger-metrics.mjs` ra đúng số của `baseline.json` (23 ledger, 9 request), tức chưa có request mới.
  - Repo aip: 29 ledger, 20 request, 128 task, 21,9% task review từ vòng 2, 0,5 ruling "ngoài Files" mỗi request. [Inference] Số này lệch vì repo tự dùng skill của mình để phát triển nó.
- Skill cục bộ đã cài (chỉ thấy tên và mô tả): `superpowers` có `receiving-code-review`, `verification-before-completion`, `writing-skills`. [Inference] aip không có skill riêng cho ba việc này, chỉ có ý rải rác trong `plan-execution` và hook Stop.
- Web, `[Unverified]` vì chỉ đọc đoạn trích tìm kiếm: bài báo "Skill Coverage: A Test Adequacy Metric for Agent Skills" (alphaxiv 2606.20659) chia chỉ dẫn của skill thành ràng buộc kiểm được rồi xem quỹ đạo chạy có chạm chúng không; một skill cộng đồng chia prompt đo kích hoạt thành explicit, implicit, competing. Không thấy chuẩn dùng rộng rãi.

Chưa xem:

- Nội dung từng `SKILL.md` (mới biết số dòng và `description`); cần để kết luận "mỏng".
- Nội dung ledger, `docs/requests/` và handoff của ba project ngoài các số đếm và brief đã nêu.
- Trang gốc của các nguồn web, tài liệu đầy đủ của skill ngoài.
- Trường hợp nào trong 65 positive trượt là do mô tả mơ hồ và trường hợp nào là do hai skill phủ cùng việc.

## Hướng đã cân nhắc

- **A (chọn). Một request, audit theo ba trục, dùng cả ba nguồn.** Ra một backlog xếp hạng, không chia part. Đánh đổi: phải kiểm chéo các nguồn lệch nhau (repo hạ tầng, repo tự dùng, project nguồn cũ).
- **B (loại). Chia part theo nguồn, mỗi part chỉ đọc, chạy song song.** Nhanh hơn nhưng nhiều part cho việc chỉ đọc, và phiên gốc vẫn phải gộp xếp hạng.
- **C (loại). Đào sâu một gap hạ tầng rồi thiết kế skill.** Bỏ audit rộng người dùng đã chọn, và dựa trên một project.

## Quyết định của agent

- Lưu brief ở `docs/requests/2026-11-12-skill-coverage-audit/` của repo aip.
- Ba trục thiếu, mỏng, bắt nhầm làm khung audit; định nghĩa vận hành chốt ở design.
- Trục "bắt nhầm" dùng số routing có sẵn (`routing-score.mjs`, `overlap.mjs`), không tạo thước đo mới.
- Gap của project hạ tầng được xếp hạng cùng các gap khác, không đưa sẵn lên đầu và không coi là kết luận.
- Nguồn web chỉ dùng để gợi phương pháp đo, không dùng làm bằng chứng cho gap cụ thể. Gap dựa vào web ghi `[Unverified]` cho tới khi đọc bản gốc.
- Phạm vi gắn nhãn `không-code`, vì đầu ra là tài liệu backlog, không sinh code. Việc chạy `routing-score.mjs`, `overlap.mjs`, `ledger-metrics.mjs` để lấy số liệu vẫn được phép.
- Phạm vi đọc ba project (người dùng đã cho đọc, chỉ đọc): ledger `.aip`, `docs/requests/`, handoff, `manual-check`. Không đọc file bí mật. Khi trích vào tài liệu commit thì khái quát hoá: không tên riêng, không đường dẫn máy, không nội dung nhạy cảm.
- Độ sâu trục "mỏng": đọc `description` và số dòng của cả 52 skill, đọc thân `SKILL.md` chọn lọc ở skill có tín hiệu (routing trượt, overlap cao, ledger nhắc). Gap "mỏng" chỉ gắn `[Verified]` sau khi đã đọc thân skill đó; chưa đọc thì gắn `[Inference]`. Không bắt buộc đọc hết 52 thân.
- Tình huống người dùng nêu thêm khi duyệt backlog được thêm vào bản nháp rồi xếp hạng lại một lần; xếp hạng nháp không coi là chốt.
- Đầu ra là `backlog.md` cạnh brief trong `docs/requests/2026-11-12-skill-coverage-audit/`; định nghĩa vận hành ba trục viết ở đầu file đó, không dựng `design.md` riêng, trừ khi người dùng chọn route cần design.

## Phần đoán

- [giả định] "Thiếu" nghĩa là tình huống thật mà không skill nào kích hoạt đúng; "mỏng" nghĩa là skill kích hoạt nhưng thiếu bước hoặc ca.
- [giả định] Người dùng chưa kể tình huống cụ thể nào ở câu mở, nên backlog đầu dựa trên số đo và dữ liệu ba project. Tình huống người dùng nêu thêm khi duyệt sẽ được bổ sung.
- [giả định] Hai project ngoài (hạ tầng và repo aip) đủ khác stack để giảm lệch của đợt trước; chưa kiểm.
- [giả định] 65 positive trượt trong routing là tín hiệu cho cả "mỏng" lẫn "bắt nhầm"; chưa phân loại.

## Định tuyến
loại-việc: nghiên-cứu
phạm-vi: không-code
đầu-ra-mong-đợi: backlog xếp hạng các gap skill (thiếu, mỏng, bắt nhầm), mỗi gap có bằng chứng và nhãn độ chắc để người dùng chọn việc cho request sau
rủi-ro: nguồn bằng chứng ít và lệch (một repo hạ tầng, một repo tự dùng, một project cũ) nên xếp hạng có thể lệch; kết luận "mỏng" chưa đọc từng SKILL.md; nguồn web mới thấy đoạn trích
ứng-viên-route: []
route-đã-duyệt: chưa-có-quy-trình
