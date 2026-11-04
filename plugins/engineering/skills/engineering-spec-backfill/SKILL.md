---
name: engineering-spec-backfill
description: "Dựng spec sống ban đầu cho project đã có code từ docs, request đã merge và code, theo năng lực nghiệp vụ, mỗi R có Nguồn. Dùng khi người dùng muốn \"backfill spec\", \"dựng docs/specs từ code\", \"tạo spec cho project cũ\", \"kiểm spec lệch code\". Không dùng khi cần đặc tả tính năng mới → engineering-spec-writing; chỉ ghi quyết định kiến trúc → engineering-adr."
order: 12
title: "Spec Backfill — dựng spec sống ban đầu từ code và docs có sẵn"
runsIn: execute
invoke: per-request
argument-hint: "[phạm vi: cả repo | thư mục con]"
---

# Spec Backfill — dựng spec sống ban đầu (skill dùng chung)

Dùng cho project **đã có code** nhưng chưa có `docs/specs/`. Skill đề xuất năng lực theo nghiệp vụ, rồi mỗi
năng lực một subagent `general-purpose` viết `docs/specs/<năng-lực>/spec.md`. Mỗi yêu cầu `R<n>` phải có một
nguồn truy được (request đã merge, `file:line` + tên test, `[Unverified]`, hoặc `lệch: <request>`).

Khác `engineering-spec-writing` (đặc tả tính năng mới trong `docs/requests/`): skill này mô tả hành vi **đã có**.
Đầu ra là spec, không phải code. Chạy ở session chính; session chính giữ hai cổng duyệt của người dùng.

## Ranh giới an toàn

- **Chỉ ghi dưới `docs/specs/`.** Không sửa `src/`, test, cấu hình, `docs/requests/`; không push, không merge, không tag.
- **Không đọc secret** (`.env`, key, credential, `*.pem`). Thấy secret trong mã nguồn thì ghi loại và `file:line`,
  không in giá trị; việc rotate do người dùng làm.
- **Chỉ đọc cục bộ**: `Read`, `Grep`, `Glob`, `git log`, `git ls-files`. Không chạy build/test của project, không gọi mạng.
- **Request chưa `merged` không là nguồn.** Token lấy từ dòng `- Trạng thái:` của `design.md`; chỉ `merged` đủ điều kiện.
- **Hai cổng của người dùng không bỏ qua**: không tạo subagent trước khi người dùng duyệt danh sách năng lực;
  không commit trước khi người dùng duyệt diff `docs/specs/`.
- **Chạy lại không ghi.** Khi đã có spec, skill chỉ trả báo cáo lệch; không thêm `R<n>`, không sửa câu chữ đã duyệt.
- Không tự chạy skill từ `aip init`, `aip install` hay hook; chỉ khi người dùng gọi.

## Quy trình — backfill

Sao checklist này vào phản hồi và đánh dấu từng bước khi làm:

- [ ] 1. **Kiểm kê nguồn và xác định lần chạy.** Đọc nguồn theo thứ tự rẻ → đắt ([references/sources.md](references/sources.md)), dừng khi đủ để đề xuất năng lực, không đọc toàn bộ code. Có `docs/specs/*/spec.md` nào thì là **chạy lại** (bước 7); chỉ có `docs/specs/README.md` với bảng trống (từ `aip init --full`) hoặc chưa có gì thì là **lần đầu**.
- [ ] 2. **Đề xuất năng lực ⏸ cổng duyệt.** Bảng theo nghiệp vụ, không theo module/package: tên kebab, mục đích, Gồm / Không gồm, thư mục nguồn, request liên quan. Liệt kê rõ phần chưa kiểm kê. Dừng và chờ người dùng gộp, tách, đổi tên hoặc bỏ năng lực. Trước câu duyệt: chưa ghi file nào, chưa tạo subagent.
- [ ] 3. **Giao subagent.** Mỗi năng lực đã duyệt một `general-purpose` (model `sonnet`, [references/subagent-prompt.md](references/subagent-prompt.md)). Các con chỉ ghi `docs/specs/<năng-lực>/spec.md` của mình nên chạy song song được. Kiểm `changes` của mỗi báo cáo: file ngoài `docs/specs/<năng-lực>/` là đầu ra hỏng, giao lại cho chính con đó (tối đa 2 lần).
- [ ] 4. **Ghi README.** Nếu chưa có `docs/specs/README.md`, tạo từ `specs-readme.template.md` của skill `artifact-templates` (core) rồi điền bảng năng lực đã duyệt. Đã có thì chỉ thêm dòng năng lực vào bảng, không đổi phần khác.
- [ ] 5. **Kiểm.** (a) `node <thư mục skill>/scripts/check-citations.mjs docs/specs --root <gốc repo>` phải exit 0. (b) W14 không chạy được vì W14 chỉ kiểm qua thư mục request khai năng lực; backfill không có request, nên kiểm tay theo `spec.template.md` của `artifact-templates`: ID đúng `<năng-lực>/R<n>` với tiền tố là tên thư mục, không trùng, mục `## Yêu cầu` đúng heading, link tương đối tới `docs/requests/…` có thật. (c) `git ls-files --others --exclude-standard` và `git diff --name-only` đều chỉ nằm dưới `docs/specs/`.
  **Vòng kiểm:** lỗi thì sửa (đúng `file:line` hoặc chuyển thành `[Unverified]`) → chạy lại → chỉ qua bước 6 khi sạch. Sau 3 vòng vẫn lỗi thì dừng và báo người dùng; không nới checker.
- [ ] 6. **Cổng duyệt diff ⏸ rồi commit.** Trình `git diff` và danh sách file mới của `docs/specs/`. Sau khi người dùng duyệt, commit qua `core:git-workflow` trên nhánh không protected (không `main`/`master`/`dev`/`develop`), header `docs(specs): …`, không thêm dòng `Co-authored-by`. Không push.
- [ ] 7. **Chạy lại (khi đã có spec).** Đối chiếu từng spec với code và nguồn theo cùng quy tắc, trả báo cáo lệch hai nhóm ([references/drift-report.md](references/drift-report.md)) trong chat. Không ghi file. Sau lần chạy `git status --porcelain docs/specs/` phải rỗng. Muốn sửa spec thì dùng request thường (`Ảnh hưởng spec` → bước gộp).

## Quy tắc viết R (dùng ở bước 3)

Mỗi dòng yêu cầu là một câu hành vi đo được, có đúng một loại nguồn:

```markdown
## Yêu cầu

- **billing/R1** — Hoá đơn quá hạn 30 ngày được đánh dấu `overdue` khi chạy job nhắc nợ. Nguồn: `src/billing/overdue.ts:41` (test "marks invoice overdue after 30 days")
- **billing/R2** — Hoàn tiền một phần không vượt số tiền đã thu. Nguồn: [refund-partial](../../requests/2026-03-02-refund-partial/design.md)
- **billing/R3** — Phí trễ hạn tính theo ngày lịch. Nguồn: `src/billing/late-fee.ts:18` [Unverified]

## Câu hỏi mở

- Phí trễ hạn có áp dụng cho gói dùng thử không? Code không phân nhánh; không có test.
```

| Loại | Bằng chứng | Ghi trong Nguồn |
|---|---|---|
| 1 | Design `merged` mô tả hành vi và code khớp | link `../../requests/<ngày>-<slug>/design.md` |
| 2 | Chỉ có code và test | `` `file:line` `` + tên test |
| 3 | Chỉ suy từ code, không test hay doc nào xác nhận | `` `file:line` `` + `[Unverified]` |
| 4 | Design `merged` nhưng code khác design | theo code: `` `file:line` `` + `lệch: [<slug>](…/design.md)` |

- Mơ hồ, không biết đúng hay sai → không thành R; đưa vào `## Câu hỏi mở`.
- Mọi trích dẫn `` `file:line` `` phải đúng định dạng này (không dấu cách, không range `3-5`, không `dòng:cột`) để `check-citations.mjs` đọc được.
- ID tăng dần từ `R1`, không tái dùng số đã bỏ.

## Ranh giới đầu ra

- Khi chạy lần đầu, spec ghi mục `Lịch sử` mỗi R một dòng `| <ngày> | backfill <ngày> | <năng-lực>/R<n> | thêm |`, thay cho link request khi không có request gốc.
- Không tạo năng lực mới ngoài danh sách đã duyệt; gộp, tách hay đổi tên chỉ theo lựa chọn ở bước 2.

## Verification (trước khi báo hoàn thành)

- `check-citations.mjs docs/specs --root <gốc repo>` exit 0 (in `0 trích dẫn hỏng`).
- Kiểm tay W14 theo bước 5(b) cho mọi spec; ghi rõ spec nào đã kiểm.
- `git ls-files --others --exclude-standard` và `git diff --name-only` chỉ có đường dẫn dưới `docs/specs/`; không có file mã nguồn.
- Lần chạy lại: báo cáo có hai nhóm, `git status --porcelain docs/specs/` rỗng.
- Báo residual risk: phần chưa kiểm kê, R dựa trên `[Unverified]`, mục Câu hỏi mở còn lại.

## Bản đồ tài liệu

- [references/sources.md](references/sources.md): thứ tự kiểm kê nguồn rẻ → đắt, cách lọc request `merged`, bảng nguồn của R. Nạp ở bước 1.
- [references/subagent-prompt.md](references/subagent-prompt.md): prompt mẫu cho mỗi năng lực, quy tắc ghi, định dạng báo cáo. Nạp ở bước 3.
- [references/drift-report.md](references/drift-report.md): mẫu báo cáo lệch khi chạy lại (hai nhóm). Nạp ở bước 7.
