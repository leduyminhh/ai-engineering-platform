---
name: backend-code-review
description: "Review diff/PR/module backend (Java/Spring, Python) theo correctness, kiến trúc, naming, test và hiệu năng (N+1, thiếu index); trả finding có severity + file:line, chỉ đọc mặc định. Dùng khi người dùng muốn \"review code backend\", \"review PR backend\", \"review diff backend\", \"đọc soát PR\". Không dùng khi cần quét bảo mật hoặc tool scan → engineering-quality-gate; review cả PR đa vai trò BE + FE → workflow-code-review."
order: 4
title: "Backend Code Review — Review diff/PR backend theo trục, có evidence (recipe on-demand)"
runsIn: execute
invoke: per-request
argument-hint: "[PR | branch | đường dẫn]"
sharedAssets: templates/architecture
---

# Backend Code Review — Review diff/PR/module backend theo trục (recipe on-demand)

Recipe hướng dẫn agent **review một diff / PR / module BACKEND** (Java/Spring, Python) theo các
**TRỤC review** cố định, phân loại **severity**, kèm **evidence `file:line`** và **đề xuất fix**.
Đây là **docs-only recipe** — hướng dẫn cách agent đọc soát và báo cáo, KHÔNG phải công cụ lint/scan
dựng sẵn, cũng KHÔNG phải công cụ codegen. KHÔNG nằm trong chuỗi bắt buộc; gọi khi cần.

**READ-ONLY mặc định:** skill này *đọc và nhận xét*, KHÔNG tự sửa code trừ khi người dùng yêu cầu rõ.
Con người giữ chốt: đọc review rồi **tự quyết** sửa gì. Với thay đổi lớn (tái cấu trúc, siết bảo mật),
skill này **route** sang skill chuyên trách thay vì tự làm — xem bước 4.

Nguyên tắc trục (đối xứng với `backend-implement`/`backend-testing`): kiến trúc hướng miền tách **lõi**
khỏi **hạ tầng**, nên phần lớn lỗi thiết kế lộ ra ở **ranh giới tầng** (import ngược chiều, logic sai
tầng, map rò kiểu ở biên) — review bám `architecture/ARD.md` mục "Dependency Rule" + checklist review PR
(mục 7) và `code-convention` của project, KHÔNG áp gu cá nhân.

## Ranh giới an toàn (CLAUDE.md)
- **READ-ONLY mặc định.** Không sửa code, không commit, không đổi cấu hình. Chỉ khi người dùng yêu cầu
  rõ "sửa luôn" mới áp fix — và vẫn DỪNG cho người **duyệt diff** trước khi commit (1 việc = 1 commit).
- **Scope-bound.** Chỉ review **đúng phạm vi người dùng nêu** (diff / PR / module / thư mục). KHÔNG lan
  sang module anh em hay cả repo; code ngoài scope chỉ nhắc khi ảnh hưởng trực tiếp tới phần đang review,
  và nêu rõ là ngoài scope.
- **Bám nguồn sự thật, không áp gu lạ:** đối chiếu **kiến trúc đã chốt** (ADR / `project-knowledge/architecture.md`
  + blueprint `architecture/<stack>-<kiểu>.template.md`) và `code-convention` của project. Convention của
  project thắng sở thích cá nhân; convention là việc của tài liệu convention, review chỉ **đối chiếu**.
- **Phân biệt lỗi CHẮC vs NGHI NGỜ:** finding nói được kịch bản input→hành vi sai là **proven**; finding
  "có mùi / có thể" là **suspected** — phải ghi rõ nhãn, KHÔNG thổi suspected thành blocker.
- **Không tự ý mở rộng thành refactor.** Thấy cần tái cấu trúc → **đề xuất + route** sang `backend-refactor`,
  không tự viết lại trong lượt review.
- **Ngôn ngữ (bắt buộc):** mọi đầu ra hướng người dùng — bảng finding, tóm tắt, đề xuất fix — viết
  **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo cáo bằng thứ đếm được (số finding theo severity, `file:line` cụ thể, kịch bản
  tái hiện). KHÔNG dùng "đảm bảo / loại bỏ / chặn triệt để / review hết / không còn bug"; LUÔN nêu **phần
  chưa soát + residual risk**. Review phản ánh thời điểm đọc với ngữ cảnh sẵn có, có thể sót đường đi
  chưa nghĩ tới hoặc hành vi runtime không thấy trong diff tĩnh.

## Quy trình (trung tính stack)

### 0. Nạp context + chốt scope — BẮT BUỘC trước khi review
- **Chốt scope review:** diff làm việc (`git diff`), một PR, hay một module/thư mục? Dò cách lấy diff thật
  từ project (`git diff <base>...<head>`, `git diff --staged`) — KHÔNG đoán nội dung thay đổi, đọc diff thật.
- Đọc `project-knowledge/` (`architecture.md` = **kiến trúc đã chọn**, `source-structure.md`,
  `code-convention.md`, `stack-profile`/`tech-stack`) để biết **kiến trúc, quy ước đặt tên, ranh giới an toàn**.
  Đối chiếu blueprint `architecture/<stack>-<kiểu>.template.md` + [architecture/ARD.md](architecture/ARD.md)
  cho Dependency Rule + checklist review PR (mục 7).
- **Dò stack thật** từ chính project (`pom.xml`/`build.gradle`/`pyproject.toml`/`requirements.txt`):
  Java/Spring hay Python, ORM, có ArchUnit/import-linter không — để biết luật nào máy đã ép, luật nào phải
  soát tay.
- Thiếu diff/scope rõ hoặc thiếu `project-knowledge` → BÁO (fail-loud), hỏi người dùng thay vì tự bịa
  phạm vi hay tự suy kiến trúc.

### 1. Review theo TRỤC
Đọc soát phần trong scope theo các trục cố định, mỗi trục có dấu hiệu cụ thể cho backend:
[references/review-dimensions.md](references/review-dimensions.md).
- **Correctness** — bug/edge/null, error-handling nuốt lỗi, concurrency-race, resource-leak (không đóng
  connection/stream), ranh giới transaction sai.
- **Thiết kế & bám kiến trúc** — Dependency Rule (domain/application KHÔNG import hạ tầng), inbound KHÔNG gọi
  thẳng outbound, **một transaction một aggregate**, map ở biên bằng **mapper thủ công/riêng** (không rò DTO
  vào lõi), đặt logic đúng tầng (altitude).
- **Đơn giản hoá & tái dùng** — trùng lặp, over-engineering, trừu tượng thừa, logic đặt sai tầng.
- **Readability & naming** — theo `code-convention` của project (Ubiquitous Language, hậu tố tầng), không áp gu lạ.
- **Performance** — N+1, query/HTTP trong vòng lặp, thiếu index cho điều kiện lọc/join/sắp xếp mới, tải eager
  hoặc không phân trang. Không có số đo thì nhãn **suspected**, không nêu con số; chỉ đề xuất cách đo.
- **Test coverage** — unit lõi cho nhánh nghiệp vụ mới + case biên; thiếu test cho code có rủi ro là một finding.

### 2. Phân loại severity + evidence + đề xuất fix
Mỗi finding gồm: **severity** (blocker / major / minor / nit), **`file:line`**, **trục**, **rationale**
(vì sao là vấn đề — kèm kịch bản input→hành vi sai nếu là lỗi correctness), **nhãn proven/suspected**, và
**đề xuất fix** (hướng sửa, không bắt buộc viết code trừ khi được yêu cầu). Thang severity + cách gắn evidence:
[references/review-dimensions.md](references/review-dimensions.md) mục "Severity". Không có `file:line` cụ thể
thì KHÔNG dựng finding (tránh nhận xét chung chung).

### 3. Xuất kết quả
Trình bày theo [references/review-output-template.md](references/review-output-template.md): bảng finding
(severity · `file:line` · trục · rationale · đề xuất fix), tóm tắt theo severity, mục **cần-người-quyết**,
và **phần chưa soát + residual risk**. Ngôn ngữ đo được.

### 4. Read-only + route — con người duyệt
- Mặc định **KHÔNG sửa**; giao kết quả cho người quyết. Chỉ áp fix khi người dùng yêu cầu rõ, và chỉ cho
  finding **proven, rõ ràng, đúng scope** — vẫn DỪNG duyệt diff trước commit.
- **Route** khi vượt phạm vi review:
  - Cần **quét bảo mật / lỗ hổng phụ thuộc / tool gate (SonarQube, Black Duck, security review)** →
    `engineering-quality-gate`. Skill này KHÔNG tự làm security scan; chỉ nhắc khi thấy dấu hiệu (vd secret
    hardcode, input chưa validate) và chuyển tiếp.
  - Cần **tái cấu trúc / đổi kiến trúc** vượt một-vài dòng → `backend-refactor` hoặc
    `backend-migrate-architecture` khi là đổi kiểu kiến trúc.
  - Cần **thêm/sửa test** → `backend-testing`.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| R1 | Đã chốt scope + đọc **diff thật** + nạp `project-knowledge` (kiến trúc + convention) | 0 | DỪNG, hỏi người dùng, không tự bịa scope/kiến trúc |
| R2 | Mỗi finding có `file:line` + trục + rationale + nhãn proven/suspected | 1–2 | Bỏ finding chung chung không có evidence |
| R3 | Không thổi suspected thành blocker; severity bám tác động thật | 2 | Hạ severity đúng mức trước khi xuất |
| R4 | READ-ONLY — không sửa/commit khi chưa được yêu cầu; route đúng skill | 4 | Trả về đề xuất, không tự sửa |
| R5 | Nêu phần chưa soát + residual risk, không tuyên bố "hết bug" | 3 | Bổ sung trước khi kết luận |

## Sau khi xong
Tóm tắt: số finding theo severity, các mục **cần người quyết**, phần **chưa soát + residual risk**. Con người
đọc review và **tự quyết** hướng xử lý (sửa / hoãn / route). Nếu gặp ràng buộc mâu thuẫn (stack ngoài
Java/Python chưa có dấu hiệu trong references, hoặc không lấy được diff rõ để soát), DỪNG và BÁO thay vì tự
đi chệch hay review mò.
