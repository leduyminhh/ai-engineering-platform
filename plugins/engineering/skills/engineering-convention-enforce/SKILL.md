---
name: engineering-convention-enforce
description: "Skill capability xuyên suốt (plugin engineering) để KIỂM và ENFORCE quy ước của project trên mã nguồn: đặt tên (file/thư mục/định danh) + cấu trúc thư mục/file + convention chung. Đối chiếu với nguồn chuẩn của project `project-knowledge/code-convention.md` (+ `source-structure.md`/`architecture.md`/lint config nếu có), phát hiện lệch, BÁO có evidence `file:line`/path + rule nguồn, đề xuất sửa (path · rule · hiện tại → đề xuất · severity). READ-ONLY mặc định; sửa hàng loạt CHỈ khi người dùng yêu cầu và con người DUYỆT DIFF. KHÔNG tự bịa chuẩn (thiếu code-convention → fail-loud, đề nghị chạy init/bổ sung trước); ĐỔI convention là quyết định kiến trúc → trỏ engineering-adr, không tự đổi. Docs-only recipe (hướng dẫn agent), KHÔNG phải validator chạy được, KHÔNG sinh code. Dùng skill NÀY khi người dùng muốn \"enforce convention\", \"kiểm quy ước\", \"chuẩn hoá đặt tên\", \"kiểm cấu trúc thư mục\", \"convention check\", \"lint quy ước\", \"áp chuẩn code convention\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần ở bất kỳ giai đoạn nào cần kiểm/áp quy ước."
order: 6
title: "Convention Enforce — kiểm & áp quy ước đặt tên + cấu trúc thư mục theo code-convention của project"
runsIn: execute
invoke: per-request
---

# Convention Enforce — kiểm & enforce quy ước project (skill dùng chung)

Kiểm và **enforce quy ước của project** trên mã nguồn: **đặt tên** (file/thư mục/định danh), **cấu trúc
thư mục/file**, và **convention chung**. Skill này là **hướng dẫn cách agent đối chiếu, phát hiện lệch và
báo cáo** (docs-only recipe) — KHÔNG phải validator chạy được, KHÔNG sinh code.

**Nguồn chuẩn = của project**, không phải của agent: agent đối chiếu code với `project-knowledge/code-convention.md`
(+ `source-structure.md` / `architecture.md` / lint config của project nếu có). Mỗi điểm lệch báo kèm
**evidence** (`file:line` hoặc path) và **rule nguồn** đã vi phạm, rồi **đề xuất sửa**. Mặc định **read-only**;
sửa hàng loạt chỉ khi người dùng yêu cầu và **con người duyệt diff**.

Skill này **portable ra mọi provider** (claude/cursor/codex/antigravity). KHÔNG thuộc chuỗi pipeline bắt
buộc; gọi khi cần ở bất kỳ giai đoạn nào cần kiểm/áp quy ước.

## Khi nào dùng

- Người dùng muốn enforce convention, kiểm quy ước, chuẩn hoá đặt tên, kiểm cấu trúc thư mục, convention
  check, lint quy ước, áp chuẩn code convention.
- Trước khi merge / sau khi thêm module/file mới / sau refactor: muốn xác nhận đặt tên + cấu trúc còn bám
  convention của project.
- Rà một thư mục/module nghi ngờ lệch chuẩn và cần bảng lệch có evidence để con người quyết.

KHÔNG dùng skill này để **đổi convention** (đó là quyết định kiến trúc → `engineering-adr`), để **sinh code**,
hay để **tự sửa hàng loạt** khi chưa được yêu cầu và chưa có người duyệt diff.

## Ranh giới an toàn

- **Read-only mặc định** — chỉ đọc + báo cáo; KHÔNG sửa file khi chưa được yêu cầu. Sửa hàng loạt chỉ khi
  người dùng **yêu cầu rõ**, trong đúng scope đã chốt, và **con người duyệt diff** trước khi commit.
- **Nguồn chuẩn = `project-knowledge/code-convention.md` của project** (+ `source-structure.md` /
  `architecture.md` / lint config nếu có). **KHÔNG tự bịa/chế chuẩn.** Thiếu `code-convention.md` →
  **fail-loud**, đề nghị bổ sung hoặc chạy skill init trước; KHÔNG suy diễn chuẩn rồi âm thầm áp.
- **KHÔNG đổi convention.** Đổi/định nghĩa lại một quy ước là **quyết định kiến trúc** → dùng `engineering-adr`.
  Skill này chỉ *kiểm tuân thủ*, không *đặt luật*.
- **Mọi điểm lệch phải có evidence** (`file:line` / path) + **rule nguồn** đã vi phạm; KHÔNG báo lệch chung
  chung. Phần suy đoán đánh dấu **[giả định]**, không trộn vào findings đã xác thực.
- **Ngôn ngữ đo được** — KHÔNG tuyên bố "đảm bảo / loại bỏ / chặn triệt để". Nêu **residual risk** (mục mơ hồ,
  phần chưa quét, giả định).
- **Không đụng secrets** (`.env`, key material…) và **không quét** ngoài scope đã chốt; defer `project-knowledge/`
  cho skill init lo — skill này *đọc* làm nguồn chuẩn, không *dựng*.

## Quy trình — kiểm & enforce

0. **Nạp context (BẮT BUỘC — trước khi kiểm).**
   Đọc `project-knowledge/code-convention.md` làm **nguồn chuẩn** (+ `source-structure.md` / `architecture.md`
   và lint config của project — ESLint/Prettier/Ruff/Checkstyle… — nếu có). **Chốt scope** với người dùng:
   thư mục/module nào được kiểm. Xác định **stack** để áp đúng idiom ngôn ngữ.
   Thiếu `code-convention.md` → **fail-loud**: nói rõ chưa có nguồn chuẩn, đề nghị bổ sung hoặc chạy skill
   init trước; KHÔNG tự bịa chuẩn để chấm.

1. **Kiểm đặt tên.**
   Theo [references/naming-rules.md](references/naming-rules.md): đối chiếu tên **file / thư mục / định danh**
   với quy ước trong `code-convention.md` + idiom của stack (case, ký tự cho phép, tiền tố/hậu tố, khớp
   tên-với-định-danh). Liệt kê điểm lệch kèm `file:line`/path + rule nguồn.

2. **Kiểm cấu trúc.**
   Theo [references/structure-rules.md](references/structure-rules.md): đối chiếu **layout thư mục/file** với
   `source-structure.md` / `architecture.md` — file đặt đúng chỗ (đúng tầng/slice/module), không lệch tầng
   (Dependency Rule), không đặt sai loại file vào thư mục sai. Liệt kê điểm lệch kèm path + rule nguồn.

3. **Báo & đề xuất.**
   Theo [references/enforce-workflow.md](references/enforce-workflow.md): tổng hợp **bảng lệch**
   (path · rule · hiện tại → đề xuất · severity). Mặc định **read-only** — chỉ báo. Nếu người dùng yêu cầu
   sửa: sửa **trong đúng scope**, gom theo nhóm, **con người duyệt diff**, KHÔNG đổi hành vi nghiệp vụ.

4. **Verify.**
   Mọi điểm lệch có **evidence + rule nguồn**; KHÔNG đổi convention (đổi convention là ADR → trỏ
   `engineering-adr`); ngôn ngữ đo được; nêu **residual risk**. Mục mơ hồ (`code-convention.md` không quy định
   rõ) → **hỏi**, không tự phán.

## Verification (trước khi báo hoàn thành)

- Đã đọc `project-knowledge/code-convention.md` (+ source-structure/architecture/lint config nếu có) làm nguồn
  chuẩn và **chốt scope**; thiếu nguồn chuẩn → đã fail-loud, không tự bịa.
- Mỗi điểm lệch có **evidence** (`file:line`/path) + **rule nguồn** đã vi phạm; suy đoán đánh dấu **[giả định]**.
- Bảng lệch có **severity** + **đề xuất sửa** (hiện tại → đề xuất); mặc định read-only.
- Nếu có sửa: **con người duyệt diff**, đúng scope, không đổi hành vi nghiệp vụ; đổi convention thì trỏ ADR.
- Ngôn ngữ **đo được** (không tuyệt đối); nêu **residual risk** (phần chưa quét / mục mơ hồ đã hỏi).

## Quan hệ với các skill khác

- **`engineering-adr`** (cùng plugin): khi cần **đổi/định nghĩa lại một convention** (thay vì chỉ kiểm tuân thủ),
  đó là quyết định kiến trúc → ghi ADR bằng skill đó rồi cập nhật `code-convention.md`; skill NÀY chỉ enforce
  chuẩn hiện có, không tự đổi luật.
- **`engineering-quality-gate`** (cùng plugin): quality-gate lo bug/vulnerability/security qua scanner; skill NÀY
  lo **quy ước đặt tên + cấu trúc + convention**. Hai skill bổ trợ, không trùng phạm vi.
- **`backend-init`** (plugin backend): là nơi **dựng** `project-knowledge/` + `code-convention.md`. Thiếu nguồn
  chuẩn → đề nghị chạy init/bổ sung trước, skill NÀY không tự dựng.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/naming-rules.md](references/naming-rules.md): cách đối chiếu **đặt tên** (file/thư mục/định danh)
  với `code-convention.md` + idiom stack; các loại lệch phổ biến (case, ký tự cấm, tiền tố/hậu tố, tên metadata
  khác tên thư mục); nguyên tắc "tên tự nói lên phạm vi + hành động".
- [references/structure-rules.md](references/structure-rules.md): cách đối chiếu **cấu trúc thư mục/file** với
  `source-structure.md`/`architecture.md`; đặt file đúng tầng/slice, không lệch tầng (Dependency Rule), thư mục
  runtime phẳng, test/resource đúng chỗ; các cờ đỏ cấu trúc.
- [references/enforce-workflow.md](references/enforce-workflow.md): quy trình báo cáo & enforce — bảng lệch
  (path · rule · hiện tại → đề xuất), thang **severity**, quy tắc **read-only mặc định** + **sửa hàng loạt cần
  duyệt diff**, và checklist Definition of Done.
