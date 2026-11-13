---
name: engineering-codebase-onboarding
description: "Quét code project cũ để viết README từng module và project-knowledge/; bảo mật ghi riêng, không in giá trị. Đây là quét code để viết tài liệu, không phải cài AIP cho người mới clone. Dùng khi người dùng muốn \"quét project cũ viết README\", \"README từng module\", \"mô tả codebase cho người mới\". Không dùng khi cần spec nghiệp vụ → engineering-spec-backfill; xếp hạng rủi ro repo → engineering-repo-audit; quality gate → engineering-quality-gate."
order: 15
title: "Codebase Onboarding — quét project có sẵn, viết README từng module"
runsIn: execute
invoke: per-request
argument-hint: "[phạm vi: cả repo | thư mục con]"
---

# Codebase Onboarding — quét project có sẵn, viết README từng module

Skill này đọc code của một project đã có rồi viết tài liệu cho dev mới: README của từng module, README gốc và bốn file `project-knowledge/`. Nó khác hai skill gần nhau. `engineering-spec-backfill` dựng spec hành vi nghiệp vụ trong `docs/specs/` và không đọc hết code. `engineering-repo-audit` chỉ đọc và xếp hạng rủi ro, không viết tài liệu. Ở đây "onboarding" nghĩa là dev mới đọc được project đã có. Không phải cài AIP cho người mới clone repo; việc đó là mục Onboarding của `templates/init/CLAUDE.md`.

Chạy ở session chính. Session chính giữ hai cổng duyệt, điều phối subagent và tự chạy các script. Không đọc toàn bộ code ở session chính để giữ ngữ cảnh nhỏ.

## Ranh giới an toàn

- **Chỉ ghi các file sau:**
  - `README.md` của từng module trong bảng đã duyệt ở cổng 1, và `README.md` ở gốc.
  - `project-knowledge/project-overview.md`, `architecture.md`, `source-structure.md`, `tech-stack.yml`.
  - Dưới `.aip/runs/onboarding-<slug>/`: `baseline-status.txt`, `security-findings.md`, thư mục `parts/<module>/`.
  - Ngoại lệ ở cấp `.aip/`: `.aip/.gitignore`, chỉ tạo khi chưa có, nội dung một dòng `*`.
- **Không ghi** `docs/specs/`, `project-knowledge/domain-context.md`, `project-knowledge/code-convention.md`, mã nguồn, test, cấu hình, build file.
- **README và `project-knowledge/` có sẵn không bị ghi đè.** Mỗi file có sẵn chỉ đổi theo lựa chọn ở cổng 1: giữ nguyên; thay khối giữa `<!-- aip:onboarding begin -->` và `<!-- aip:onboarding end -->`; hoặc bỏ. `tech-stack.yml` chỉ giữ hoặc bỏ.
- **Không đọc nội dung `.env` và file cấu hình.** Tên khoá chỉ lấy bằng lệnh trong [references/secret-safety.md](references/secret-safety.md). Không in giá trị vào chat, file hoặc báo cáo. Dockerfile và file CI được đọc, nhưng giá trị trong chúng không được chép đi đâu (luật ở secret-safety.md).
- **Hai cổng không bỏ qua.** Không tạo subagent trước khi người dùng duyệt bảng module. Không commit trước khi người dùng duyệt `git diff`.
- **Không push, không merge, không tag.** Commit qua `core:git-workflow` trên nhánh không protected (không `main`, `master`, `dev`, `develop`). Nếu nhánh hiện tại là protected thì tạo nhánh `docs/onboarding-<slug>` trước. Findings không vào commit.
- **Công cụ được dùng:**
  - Đọc: `Read`, `Grep`, `Glob`; subagent `general-purpose`.
  - Bash chỉ đọc: `git ls-files`, `git status`, `git log`, `git diff`, `ls`, `wc`. Mỗi lần gọi một lệnh.
  - Bash ghi: `mkdir`, `printf … >` chỉ trong `.aip/runs/onboarding-<slug>/`; `printf … >` một lần cho `.aip/.gitignore` khi chưa có; và đúng một lệnh `git status --porcelain > .aip/runs/onboarding-<slug>/baseline-status.txt` ở bước 1.
  - `node` chỉ chạy `inventory-modules.mjs`, `scan-secrets.mjs` của skill này và `check-citations.mjs` của `engineering-spec-backfill`.
  - Không build, không test, không chạy code của project được quét, không gọi mạng.
- Skill không tự chạy quality gate và không sửa lỗ hổng. Phát hiện bảo mật chỉ được ghi và định tuyến.
- Không tự chạy từ `aip init`, `aip install` hay hook. Chỉ chạy khi người dùng gọi.

## Quy trình — onboarding

Sao checklist này vào phản hồi và đánh dấu từng bước khi làm:

- [ ] 1. **Chốt phạm vi và nền.** Hỏi phạm vi (cả repo hoặc thư mục con) nếu người dùng chưa nói. Chọn `<slug>` (kebab-case, gắn ngày hoặc tên phạm vi), tạo `.aip/runs/onboarding-<slug>/` và `.aip/.gitignore` (nếu chưa có). Ghi nền bằng đúng một lệnh, chạy ở bước này: `git status --porcelain > .aip/runs/onboarding-<slug>/baseline-status.txt`. Đây là nền cho bước 6(c). Nạp [references/scope-and-budget.md](references/scope-and-budget.md).
- [ ] 2. **Kiểm kê.** Chạy `node <thư mục skill>/scripts/inventory-modules.mjs <gốc> --format json`. Dựng bảng cho cổng 1 từ trường kiểm kê. Có `notes` thì nêu nguyên văn trong bảng. `modules` rỗng thì kiểm kê tay các module (Go, .NET, Rust, ...) và ghi rõ là làm tay.
- [ ] 3. **Cổng 1 ⏸.** Trình bảng: module, đường dẫn, loại build, số file nguồn và dòng, nhóm đề xuất (số nhóm, tổng file và dòng mỗi nhóm), README hiện có, `project-knowledge/` hiện có (giữ, khối marker hoặc bỏ), thư mục `unclaimed`, và `rootFiles`. Dừng và chờ người dùng duyệt, gộp, tách, bỏ module hoặc đổi lựa chọn cho file có sẵn. Trước câu duyệt: chưa tạo subagent, chưa ghi file đích.
- [ ] 4. **Giao subagent.** Mỗi nhóm đã duyệt một subagent `general-purpose`, `model: "sonnet"`, dùng prompt mục 1 của [references/subagent-prompts.md](references/subagent-prompts.md). Tối đa 6 subagent chạy song song. Agent trả 404 với `sonnet` thì bỏ trống `model` và ghi vào báo cáo cuối rằng subagent kế thừa model của session. Kiểm `changes` của từng báo cáo: file ngoài danh sách được giao thì ghi nhận, báo người dùng và giao lại đúng subagent đó, tối đa 2 lần; không tự xoá. `read` có file cấu hình thì ghi vi phạm và giao lại nhóm đó nếu còn ngân sách. Module vượt trần: giao từng phần theo [references/scope-and-budget.md](references/scope-and-budget.md).
- [ ] 5. **Ghép và tổng hợp.** Module vượt trần: subagent ghép theo prompt 2 của [references/subagent-prompts.md](references/subagent-prompts.md), chỉ đọc các file phần. Sau đó một subagent `general-purpose`, `model: "sonnet"`, theo prompt 3, viết README gốc và bốn file `project-knowledge/` từ README của module và trường kiểm kê, không đọc lại code. Khung và cách điền: [references/readme-structure.md](references/readme-structure.md).
- [ ] 6. **Kiểm cơ học, rồi reviewer.** Chạy đủ ba mục, rồi reviewer mới.
  - (a) **Trích dẫn.** Trước khi chạy, kiểm `<thư mục skill engineering-spec-backfill>/scripts/check-citations.mjs` có tồn tại không. Thiếu thì dừng mục này, ghi `not_run` kèm lý do và nhắc người dùng cài `engineering-spec-backfill`; không ghi "trích dẫn sạch". Có thì chạy `node <script> <file.md | thư mục> --root <gốc>` trên mọi file Markdown đã ghi. Kỳ vọng exit 0 và `0 trích dẫn hỏng`. `not_run` không chặn cổng 2 nhưng phải nêu nổi bật.
  - (b) **Secret.** Ghi `security-findings.md` từ `findings` loại bảo mật theo mẫu trong [references/secret-safety.md](references/secret-safety.md). Rồi chạy `node <thư mục skill>/scripts/scan-secrets.mjs <các file .md đã ghi> <security-findings.md>`. Kỳ vọng exit 0. Có khớp thì sửa file (giao lại subagent của module), không nới script.
  - (c) **Phạm vi.** `git status --porcelain` so với `baseline-status.txt`. Kỳ vọng chỉ còn đường dẫn trong danh sách đã duyệt cộng `project-knowledge/`. Đường dẫn khác: báo người dùng, không tự xử lý.
  - **Reviewer.** Một subagent `general-purpose`, `model: "sonnet"`, theo prompt 4: mở dòng của mọi mũi tên liên kết và tối đa 10 số liệu mỗi module. Kết luận đúng, sai hoặc không xác minh được. Sai thì giao lại đúng subagent của module, tối đa 2 vòng.
  - **Vòng sửa.** Lỗi ở (a) và (b), hoặc từ reviewer, được sửa tối đa 3 vòng. Sau mỗi vòng sửa, chạy lại (a) và (b) trên file đã sửa; vòng chỉ đạt khi lần chạy cuối của (a) và (b) xanh. Lỗi ở (c), tức file ngoài danh sách đã duyệt: chỉ báo người dùng, không tự xoá, không đếm vào ba vòng. Vẫn lỗi ở (a) hoặc (b) sau ba vòng thì dừng và báo người dùng. Không nới checker.
- [ ] 7. **Cổng 2 ⏸.** Trình `git diff` và danh sách file mới (`git status --porcelain`). Nêu số trích dẫn hỏng hoặc `not_run`, và số `[Unverified]`. `security-findings.md` không nằm trong diff vì `.aip/` bị bỏ qua. Người dùng duyệt thì commit qua `core:git-workflow`, header `docs(onboarding): <tóm tắt>`, body tiếng Việt có dấu, không thêm dòng `Co-Authored-By`. Không push.
- [ ] 8. **Báo cáo cuối.** Điền [references/final-report.md](references/final-report.md) và trả trong chat. Không ghi báo cáo thành file trong repo.

## Verification (trước khi báo hoàn thành)

- Ở lần chạy cuối (sau vòng sửa cuối, nếu có): bước 6(a) exit 0 và `0 trích dẫn hỏng`, hoặc `not_run` có lý do trong báo cáo.
- Ở lần chạy cuối: bước 6(b) exit 0 trên mọi file đã ghi và trên `security-findings.md`.
- Ở lần chạy cuối: bước 6(c) `git status --porcelain` không có đường dẫn ngoài danh sách đã duyệt.
- Reviewer: số đúng, sai, không xác minh được đã ghi; các mục sai đã sửa hoặc còn lại được nêu.
- Báo cáo có module đã đọc và chưa đọc, `not_read`, số `[Unverified]`, số lần gọi công cụ thực tế.
- Báo rủi ro còn lại: log phiên, heuristic của `scan-secrets.mjs`, phần chưa kiểm kê.

## Bản đồ tài liệu

- [references/scope-and-budget.md](references/scope-and-budget.md): trường kiểm kê, quy tắc sở hữu file, nhóm, ngân sách và mức đọc. Nạp ở bước 1–4.
- [references/subagent-prompts.md](references/subagent-prompts.md): prompt nhóm module, ghép module, tổng hợp, reviewer; luật cấu hình, luật bằng chứng, luật file có sẵn; luật lệnh, Dockerfile và CI (mục E); mẫu `agent_result`. Nạp ở bước 4–6.
- [references/readme-structure.md](references/readme-structure.md): khung README module, README gốc, bốn file `project-knowledge/`. Nạp ở bước 4–5.
- [references/secret-safety.md](references/secret-safety.md): lệnh đọc tên khoá, file cấu hình không được đọc nội dung, mẫu findings, định tuyến bảo mật, `.aip/.gitignore`, rủi ro còn lại. Nạp ở bước 1, 2 và 6.
- [references/final-report.md](references/final-report.md): mẫu báo cáo cuối. Nạp ở bước 8.
