# Backlog: gap độ bao phủ và độ giàu của bộ skill
- Ngày: 2026-11-12
- Trạng thái: draft
- Brief: [brief.md](brief.md) (approved, route `chưa-có-quy-trình`)

Đây là đầu ra audit của brief. Chưa sửa hay thêm skill nào. Người dùng duyệt, bổ sung tình huống của mình, rồi chọn top N cho request sau.

## Cách đọc

Ba trục:

- **Thiếu:** tình huống thật mà không skill nào đúng để kích hoạt.
- **Mỏng:** skill kích hoạt đúng nhưng thiếu bước hoặc ca, nên lỗi lọt sang review hoặc người dùng làm tay.
- **Bắt nhầm:** prompt đúng nghĩa lại rơi sang skill khác ở hạng 1.

Ba nguồn bằng chứng, gọi trung lập (dẫn chứng đến từng dòng nằm ở ghi chú phiên, ngoài repo, vì có tên request của project ngoài):

- **Nguồn-A:** project nguồn của đợt trước (23 ledger, 9 request, 136 task). Chưa có request mới từ lúc lấy `baseline.json`.
- **Nguồn-B:** repo hạ tầng (Bash, Docker Compose, Jenkins, runbook). Không có ledger `.aip`; bằng chứng là brief chương trình nâng cấp và `CLAUDE.md` của nó.
- **Nguồn-C:** repo aip tự dùng skill của mình (29 ledger, 20 request). Lệch về tooling của aip: gần như không có bằng chứng cho backend, frontend, data, ops.

Thước xếp hạng (người dùng chốt): tác động = tần suất gặp × chi phí khi thiếu. Cột "Tần suất" là số đếm thật. Cột "Chi phí" là đánh giá của agent và luôn là `[Inference]`: chưa có số đo chi phí cho từng gap. Độ chắc ghi riêng, không là trọng số. Số nguồn độc lập chỉ để phá thế hoà.

Cách đếm: regex theo từ khoá trên ledger, đếm số ledger và số request khớp, không loại trùng. Cụm ghi "rộng" có thể đếm dư.

## Xếp hạng

| # | Gap | Trục | Tần suất | Chi phí | Độ chắc | Skill gần nhất |
|---|---|---|---|---|---|---|
| 1 | Ngữ nghĩa chuẩn hoá đầu vào không được chốt trong AC (strip, rỗng so với thiếu khoá, đếm ký tự, hoa/thường) | Mỏng | A: 12/23 ledger, 8/9 request | Vừa: mỗi lần là một ruling hoặc vòng review | Đếm [Verified]; chi phí [Inference] | `engineering-spec-writing`, `backend-implement` |
| 2 | Hạng 1 sai ở nhóm cặp cùng khuôn và nhóm skill meta (xem mục "Bắt nhầm") | Bắt nhầm | 65/214 positive trượt (30%); 9/160 negative trượt | Cao khi xảy ra: skill đúng không được nạp | Đếm [Verified]; đại diện cho dùng thật [Inference] | `frontend-*` và `backend-*` cùng khuôn, `aip-status`, `using-aip`, `engineering-debugging` |
| 3 | Hợp đồng nội bộ giữa component (lệnh, queue, payload) chỉ chốt miệng | Thiếu | A: 10/23 ledger, 6/9 request (rộng) | Cao: lỗi tích hợp tới vòng review muộn | Đếm [Verified]; chi phí [Inference] | `backend-api-contract` (chỉ lo hợp đồng frontend↔backend) |
| 4 | Hạ tầng dưới dạng code: Bash, Docker Compose, cấu hình CI, runbook theo chuẩn | Thiếu | B: toàn bộ chương trình nâng cấp; A và C: không thấy. Một nguồn | Cao: backup báo thành công khi dump lỗi, CI luôn đỏ | Bằng chứng [Verified]; độ phổ biến ngoài một repo [Unverified] | `ops-deploy-release` (không phủ việc viết hay sửa script/CI) |
| 5 | Triển khai nhiều component: thứ tự deploy, rollback, ngân sách RAM production | Thiếu / mỏng | A: 8/23 ledger, 6/9 request | Cao: deploy sai thứ tự gây 404/403, container mồ côi sau rollback | Đếm [Verified]; chi phí [Inference] | `ops-deploy-release` (chưa gắn vào task cuối của plan feature) [Inference] |
| 6 | Minor hoãn tích luỹ rồi thành request follow-up; chưa có bước dọn | Mỏng | A: 221 dòng; C: 212 dòng, 3 request `finish-*` sinh từ minor hoãn | Thấp đến vừa: thành request riêng | Đếm [Verified]; chi phí [Inference] | `plan-execution` (`final-review.md`) |
| 7 | Tranh chấp tài nguyên khi test: Docker thiếu RAM, hai agent tranh `target/`, test tích hợp dùng chung DB | Mỏng | A: 8/9 request (rộng, gồm cả "full suite"); ca Docker/RAM chặt: 2 request | Vừa: chạy lại, bước chờ | Đếm [Verified] (rộng); chưa đối chiếu đủ [Inference] | `git-worktree` (`parallel-agents.md`), `backend-testing` |
| 8 | Tài liệu lệch code sau vòng sửa (ADR, api.md, javadoc) | Mỏng | A: 16/23 ledger, 9/9 request (rộng, có thể đếm dư) | Vừa: nâng finding lên major ở review | Đếm [Verified] (rộng) | `engineering-adr`, `backend-api-contract` (chỉ kiểm drift OpenAPI). Đợt trước đã thêm bước đối chiếu khẳng định cho task `DOCS`, chưa đo |
| 9 | Dữ liệu cũ khi đổi hành vi (dòng legacy, NULL, digest cũ) | Mỏng | A: 6/23 ledger, 5/9 request | Vừa: lỗi dữ liệu, khó thấy | Đếm [Verified] | `data-db-migration` (lo schema, chưa lo hành vi trên dòng cũ) |
| 10 | Smoke test gọi nhà cung cấp ngoài có chi phí; bước gọi thật ghi "chưa kiểm được" | Thiếu | A: 6/6 `manual-check` | Vừa đến thấp | Đếm [Verified] | `frontend-manual-check` (chỉ UI) |
| 11 | Sửa migration chưa phát hành tại chỗ; số dùng chung ngoài migration (số ADR bị cấp trùng, `advisory lock` id) | Mỏng | A: 4/9 request (8 dòng); 3 file handoff chia dải số; hai file ADR cùng số `0035` | Vừa: checksum, trùng số | Đếm [Verified] | `data-db-migration`, `engineering-adr` |
| 12 | Ánh xạ mã lỗi backend sang nhãn UI lệch hoặc trùng | Mỏng | A: 5/23 ledger, 5/9 request | Thấp đến vừa | Đếm [Verified] | `frontend-data-integration` |
| 13 | Bốn skill `*-init` gần như một khuôn, không có `references/`, đặt `disable-model-invocation: true` | Mỏng / bắt nhầm | 4 skill; `overlap` 48–56%; trượt: `frontend-init` 2, `backend-init` 1 | Thấp: chạy một lần mỗi project | Thân skill đã đọc [Verified]; liên hệ với routing [Inference] | `backend-init`, `frontend-init`, `data-oltp-init`, `data-olap-init` (hai skill sau còn draft) |

Ghi chú xếp hạng:

- Hạng 1 đứng đầu vì tần suất cao nhất và có sẵn một chỗ hở rõ trong `clarify-core.md`: phần "Rà ca biên" chỉ có 5 nhóm cố định (làm tròn, biên dưới/trên, đầu vào rỗng, mốc thời gian, đếm đồng thời), không có chuẩn hoá chuỗi hay so sánh null với thiếu khoá. [Verified] đọc file.
- Hạng 4 chỉ có một nguồn. Tần suất ở người dùng khác là [Unverified]; xếp cao vì chi phí khi sai (báo thành công sai trên dữ liệu production). Nếu người dùng không làm repo hạ tầng thường xuyên thì hạ xuống.
- Hạng 2 dùng dữ liệu routing mù do chính repo viết; mức độ đại diện cho prompt thật là [Inference].

## Bắt nhầm (chi tiết hạng 2)

Nguồn: `node scripts/routing-score.mjs` chạy 2026-11-12. Positive 149/214 (69%), negative 151/160 (94%).

- **Nhóm skill meta hút prompt chung:** hạng 1 sai là `using-aip` 6 lần và `aip-status` 6 lần. Ví dụ `backend-code-review` 2, `frontend-code-review` 1, `ops-incident-troubleshooting` 1, `frontend-manual-check` 1, `backend-performance` 1 rơi vào `aip-status`. [Inference] Prompt có từ chung (tiến độ, bước, kiểm tra) khớp với mô tả của skill meta hơn skill chuyên môn; chưa kiểm từng prompt.
- **Cặp frontend↔backend cùng khuôn:** `frontend-testing`→`backend-testing` 2, `frontend-fix`→`backend-fix` 2, `backend-fix`→`frontend-fix` 1, `backend-api-contract`→`frontend-data-integration` 2. `overlap` báo `backend-fix`↔`frontend-fix` 59% và `backend-code-review`↔`frontend-code-review` 57%, sát ngưỡng gộp 60%.
- **Skill chuyên môn so với workflow cùng đề:** `engineering-debugging`→`workflow-bugfix` 2, `backend-performance`→`workflow-performance` 2, `frontend-performance`→`workflow-performance` 1.
- **Negative trượt (9) gợi ý "thiếu":** prompt "Dựng cụm Consul và Vault bằng docker-compose" rơi vào `backend-migrate-vault-consul`; "Dựng khung dự án backend mới từ đầu với kiến trúc Hexagon" rơi vào `backend-migrate-architecture` dù có `backend-init`. [Inference] `backend-init` đặt `disable-model-invocation: true` nên không thể thắng; việc không skill nào đúng thì rơi vào skill gần nhất. Liên quan hạng 4 và hạng 13.
- **Việc chưa đo lại:** `backend-fix` và `frontend-fix` từng 0/3 kích hoạt trong eval khi prompt có test đỏ ([Verified] trong design của `superpowers-gap-closure`; nguyên nhân [Inference]). Bootstrap `using-aip` ra đời để chữa; chưa có số kích hoạt sau đó.

## Đã làm ở đợt trước, chờ đo (không xếp hạng)

Các cụm này vẫn xuất hiện trong ledger nhưng đợt `skill-enrichment-from-usage` đã sửa nội dung liên quan; cần vài request mới mới thấy hiệu quả, nên không đưa vào top.

- Plan bỏ sót `**Files:**`: A 7/9 request; C 10 ruling. Đợt trước thêm vế "Files đủ" vào mục 6 của `engineering-plan-writing`.
- Trạng thái kẹt hoặc mồ côi sau lỗi giữa chừng: A 5/9 request. Đợt trước thêm checklist robustness cho `backend-implement` và `backend-code-review`.
- Trần chi phí, quota, backoff khi gọi LLM: A 7 request. Đợt trước thêm `backend-llm-integration`.
- Focus và a11y: A 7 request; `frontend-code-review` đã có mục a11y. Không đưa thành gap.
- Review từng task: nguồn-C ghi 30/130 task (23,1%) review từ vòng 2 khi subagent chạy, và 28/128 (21,9%) khi tôi chạy trước đó; ledger của phiên đang chạy đổi số. Nguồn-A: 58/136 (42,6%) trong `baseline.json`. Hiệu quả của cỡ task Nhỏ/Vừa/Lớn (ADR-0005) chưa đo được: nguồn-A chưa có request mới.

## Ngoài phạm vi skill của bộ

Cụm có trong ledger nguồn-C nhưng là việc sửa tooling của chính aip, không phải gap của skill: ca biên merge/kết thúc nhánh (4 request), bump version cho nội dung chiếu gián tiếp (5 request), lỗi an toàn chỉ lộ ở audit hook/CLI (11 mục Must-fix), ledger ghi sai hash hoặc thứ tự (3 request). Ghi để người dùng biết, không xếp hạng.

## Đối chiếu bên ngoài (không vào xếp hạng chính)

Theo chốt của người dùng: ghi riêng, chỉ vào xếp hạng khi có bằng chứng dùng thật.

- Skill cục bộ của bộ `superpowers` (chỉ đọc tên và mô tả): `receiving-code-review`, `verification-before-completion`, `writing-skills`. [Inference] aip không có skill riêng cho ba việc này: ý "nhận phản hồi review" rải rác ở `plan-execution`, "kiểm trước khi báo xong" nằm ở hook Stop (`gate-stop.mjs`), "viết skill" chỉ có skill dự án `aip-add-content` không ship. Chưa thấy bằng chứng dùng thật trong ba project nên không xếp hạng.
- Web, tất cả [Unverified] vì chỉ đọc đoạn trích tìm kiếm: bài "Skill Coverage: A Test Adequacy Metric for Agent Skills" ([alphaxiv](https://www.alphaxiv.org/abs/2606.20659)) chia chỉ dẫn của skill thành ràng buộc kiểm được rồi xem quỹ đạo chạy có chạm chúng không; một skill cộng đồng ([claudskills](https://claudskills.com/skills/skill-compliance-auditor/SKILL.md)) chia prompt đo kích hoạt thành explicit, implicit và competing. Gợi ý phương pháp cho một request sau: `test/routing/` hiện chia positive/negative, chưa có lớp "competing" (hai skill cùng đáng gọi). Không dùng làm bằng chứng cho gap cụ thể.

## Chưa xem và giới hạn

- Thân `SKILL.md` đã đọc chọn lọc: bốn skill `*-init`. Các gap "mỏng" còn lại dựa trên bằng chứng từ ledger và mô tả skill gần nhất, nên cột "Độ chắc" ghi `[Inference]` ở phần liên hệ skill; cần đọc thân skill đó trước khi design.
- 65 positive trượt chưa phân loại từng prompt; mới nhóm theo cặp skill.
- Nguồn-A và nguồn-C do subagent đọc rồi báo; tôi kiểm lại bằng `ledger-metrics.mjs` (số nền khớp `baseline.json` với nguồn-A) và đọc trực tiếp bốn skill `*-init`, không đọc lại từng dòng dẫn chứng.
- Nguồn-B chỉ có một brief và `CLAUDE.md`; không đọc source Bash hay CI của nó.
- Chưa có tình huống cụ thể do người dùng nêu (câu mở chưa trả lời). Bổ sung khi duyệt rồi xếp hạng lại một lần.
- Số đếm theo regex có thể đếm dư; không thay thế đo bằng script.
- Dẫn chứng đến từng dòng nằm ở ghi chú phiên (`skill-coverage-audit-evidence.md`, ngoài repo), không commit vì mang tên request của project ngoài.
