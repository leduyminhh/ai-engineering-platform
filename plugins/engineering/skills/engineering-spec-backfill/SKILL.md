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

Dùng cho project **đã có code** nhưng chưa có (đủ) `docs/specs/`. Skill đề xuất năng lực theo nghiệp vụ, rồi mỗi
năng lực **chưa có spec** một subagent `general-purpose` viết `docs/specs/<năng-lực>/spec.md`; năng lực đã có spec chỉ nhận báo cáo lệch. Mỗi yêu cầu `R<n>` phải có một
nguồn truy được (request đã merge, `file:line` + tên test, `[Unverified]`, hoặc `lệch: <request>`).

Khác `engineering-spec-writing` (đặc tả tính năng mới trong `docs/requests/`): skill này mô tả hành vi **đã có**.
Đầu ra là spec, không phải code. Chạy ở session chính; session chính giữ hai cổng duyệt của người dùng.

## Ranh giới an toàn

- **Chỉ ghi dưới `docs/specs/`.** Không sửa `src/`, test, cấu hình, `docs/requests/`; không push, không merge, không tag.
  Ngoại lệ duy nhất ngoài `docs/specs/`: thư mục tạm trong scratchpad cho bước 5(b), không nằm trong repo, dọn bằng `fs.rmSync`.
- **Không đọc secret** (`.env`, key, credential, `*.pem`). Thấy secret trong mã nguồn thì ghi loại và `file:line`,
  không in giá trị; việc rotate do người dùng làm.
- **Công cụ được dùng:**
  - Đọc: `Read`, `Grep`, `Glob`.
  - Bash chỉ đọc: `git log`, `git ls-files`, `git status`, `git diff`; `grep`, `head`, `wc`, `sort`, `sed` (chỉ in ra stdout, không `-i`), `ls`, `basename`, `date`, `echo`, `[ -f … ]`.
  - Bash ghi chỉ vào thư mục tạm: `mkdir`, `cp`, `printf … >` và `printf … >>`.
  - `node` chỉ chạy `check-citations.mjs`, `check-request.mjs` và một dòng `node -e` dọn thư mục tạm.
  - `git add`, `git commit` chỉ ở bước 6. Không build, không test, không gọi mạng.
- **Request chưa `merged` không là nguồn.** Token lấy từ dòng `- Trạng thái:` của `design.md`; chỉ `merged` đủ điều kiện.
- **Hai cổng của người dùng không bỏ qua**: không tạo subagent trước khi người dùng duyệt danh sách năng lực;
  không commit trước khi người dùng duyệt diff `docs/specs/`.
- **Năng lực đã có spec không bị ghi.** Năng lực đã có `docs/specs/<năng-lực>/spec.md` chỉ nhận báo cáo lệch; không thêm `R<n>`, không sửa câu chữ đã duyệt. Năng lực chưa có spec được ghi như lần đầu.
- Không tự chạy skill từ `aip init`, `aip install` hay hook; chỉ khi người dùng gọi.

## Quy trình — backfill

Sao checklist này vào phản hồi và đánh dấu từng bước khi làm:

- [ ] 1. **Kiểm kê nguồn và xếp từng năng lực.** Đọc nguồn theo thứ tự rẻ → đắt ([references/sources.md](references/sources.md)), dừng khi đủ để đề xuất năng lực, không đọc toàn bộ code. Rồi xếp từng năng lực: đã có `docs/specs/<năng-lực>/spec.md` → **chỉ báo lệch** (bước 7); chưa có → **ghi như lần đầu** (bước 2–6). `docs/specs/README.md` với bảng trống (từ `aip init --full`) không tính là spec. Một lần chạy có thể có cả hai nhóm.
- [ ] 2. **Đề xuất năng lực ⏸ cổng duyệt.** Bảng theo nghiệp vụ, không theo module/package: tên kebab, mục đích, Gồm / Không gồm, thư mục nguồn, request liên quan. Liệt kê rõ phần chưa kiểm kê. Bảng chỉ gồm năng lực chưa có spec; năng lực đã có spec ghi thành dòng riêng "chỉ báo lệch" cùng thông điệp. Dừng và chờ người dùng gộp, tách, đổi tên hoặc bỏ năng lực. Trước câu duyệt: chưa ghi file nào, chưa tạo subagent.
- [ ] 3. **Giao subagent.** Mỗi năng lực đã duyệt (chưa có spec) một `general-purpose` (model `sonnet`, [references/subagent-prompt.md](references/subagent-prompt.md)). Các con chỉ ghi `docs/specs/<năng-lực>/spec.md` của mình nên chạy song song được. Kiểm `changes` của mỗi báo cáo: file ngoài `docs/specs/<năng-lực>/spec.md` là **ghi nhận và báo người dùng**, không tự xoá; sau đó mới giao lại cho chính con đó (tối đa 2 lần).
- [ ] 4. **Ghi README.** Nếu chưa có `docs/specs/README.md`, tạo từ `<thư mục skill artifact-templates>/references/specs-readme.template.md` (skill `artifact-templates`, core) rồi điền bảng năng lực đã duyệt. Đã có thì chỉ thêm dòng năng lực vào bảng, không đổi phần khác.
- [ ] 5. **Kiểm cơ học.** Chạy đủ bốn mục; chỉ (b) ghi file, và chỉ vào thư mục tạm. Trước khi chạy, thay mọi `<…>` trong lệnh bằng đường dẫn hoặc giá trị thật. Trong ngoặc kép `<` không phải chuyển hướng, nhưng chưa thay thì `mkdir` tạo thư mục tên chữ `<thư mục scratchpad>` ngay trong repo; hai guard dưới chặn việc đó. Chỉ kiểm năng lực vừa ghi ở bước 3 (spec cũ do request ghi không đúng dạng của skill này):
    ```bash
    NEW="<các năng lực vừa ghi, cách nhau bằng dấu cách>"
    case "$NEW" in *'<'*) echo "chưa thay <các năng lực vừa ghi>"; exit 1;; esac
    ```
  - (a) **Trích dẫn** `file:line` tồn tại:
    ```bash
    for c in $NEW; do node <thư mục skill>/scripts/check-citations.mjs "docs/specs/$c/spec.md" --root <gốc repo>; done
    ```
    Kỳ vọng exit 0 và `0 trích dẫn hỏng`.
  - (b) **W14** (cấu trúc spec). W14 chỉ kiểm spec qua một thư mục request khai năng lực, nên chạy trên một request tạm: copy cả `docs/` của project vào thư mục tạm (link `../../decisions/…`, `../../requests/…` trong spec phải resolve được), rồi khai mọi năng lực có `spec.md` trong một design giả:
    ```bash
    TMP="<thư mục scratchpad>/w14-check"   # nếu còn sót từ lần trước thì dọn bằng lệnh node ở cuối mục này trước
    case "$TMP" in *'<'*) echo "chưa thay <thư mục scratchpad>"; exit 1;; esac
    mkdir -p "$TMP"
    cp -r docs "$TMP/docs"
    REQ="$TMP/docs/requests/$(date +%F)-backfill-check"
    mkdir -p "$REQ"
    printf '## Ảnh hưởng spec\n' > "$REQ/design.md"
    for c in $NEW; do printf -- '- %s: thêm R1\n' "$c" >> "$REQ/design.md"; done
    ```
    Mỗi năng lực vừa ghi thành một dòng `- <năng-lực>: thêm R1`. Rồi chạy:
    ```bash
    node <thư mục skill artifact-templates>/scripts/check-request.mjs "$REQ/" | grep -E '\[(W11|W14)\]'
    ```
    Kỳ vọng không có dòng nào (grep thoát 1). W11 báo năng lực khai mà không có `spec.md` (W14 im trong trường hợp này), W14 báo lỗi cấu trúc của spec có mặt. Mã W khác của thư mục giả bỏ qua. Xong thì dọn:
    ```bash
    node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$TMP"
    ```
  - (c) **Nguồn của từng R** (chỉ đọc). Ba lệnh, mỗi lệnh kỳ vọng không in gì:
    ```bash
    FILES=$(for c in $NEW; do echo "docs/specs/$c/spec.md"; done)
    # R thiếu Nguồn:
    grep -nE '^\s*[-*]\s+\*\*[a-z0-9-]+/R[0-9]+\*\*' $FILES | grep -v 'Nguồn:'
    # Nguồn không đúng dạng của bốn loại (loại 3 có hai dạng):
    grep -nE 'Nguồn:' $FILES | grep -vE 'Nguồn: \[[^]]+\]\(\.\./\.\./requests/[^)]+/design\.md\)$|Nguồn: `[^`: ]*[./][^`: ]*:[0-9]+` \(test .+\)$|Nguồn: `[^`: ]*[./][^`: ]*:[0-9]+` \[Unverified\]$|Nguồn: \[Unverified\] [^ ].*$|Nguồn: `[^`: ]*[./][^`: ]*:[0-9]+` lệch: \[[^]]+\]\(\.\./\.\./requests/[^)]+/design\.md\)$'
    # Request làm nguồn R (chỉ dòng Nguồn, không tính mục Lịch sử) phải có dòng "- Trạng thái: merged":
    grep -h 'Nguồn:' $FILES | grep -ohE '\.\./\.\./requests/[^)]+/design\.md' | sort -u | sed 's#^\.\./\.\./#docs/#' | while IFS= read -r f; do grep -qE '^-\s+Trạng thái\s*:\s*merged\b' "$f" || echo "chưa merged: $f"; done
    ```
    Ba lệnh này áp cho spec do skill này ghi (`$FILES` chỉ có năng lực vừa ghi). Spec sống do request ghi (có `(thêm)`/`(đổi)`, nhiều link trong một dòng, link trong Lịch sử) không đúng dạng này: không kiểm bằng (c).
    Dòng nào in ra thì sửa trước cổng duyệt: đưa về đúng dạng của bốn loại (xem **Vòng kiểm**).
  - (d) **Phạm vi file**: mọi thay đổi phải nằm dưới `docs/specs/`:
    ```bash
    git status --porcelain | grep -vE '^.. docs/specs/'
    ```
    Kỳ vọng rỗng. Dòng còn lại là thay đổi có sẵn trước khi chạy hoặc lỗi: liệt kê cho người dùng, không tự xử lý.

  **Vòng kiểm:** trích dẫn hỏng thì sửa thành `file:line` đúng (đọc lại file để chọn dòng). Không tìm được dòng đúng thì bỏ token `file:line` hỏng và ghi `Nguồn: [Unverified] <mô tả ngắn chỗ suy ra>` (loại 3). `## Câu hỏi mở` chỉ dành cho hành vi mơ hồ, không dùng để chứa R có trích dẫn hỏng. Sửa xong → chạy lại (a) đến (d) → chỉ qua bước 6 khi sạch. Sau 3 vòng vẫn lỗi thì dừng và báo người dùng; không nới checker.
- [ ] 6. **Cổng duyệt diff ⏸ rồi commit.** Trình `git diff` và danh sách file mới của `docs/specs/`. Sau khi người dùng duyệt, commit qua `core:git-workflow` trên nhánh không protected (không `main`/`master`/`dev`/`develop`), header `docs(specs): …`, không thêm dòng `Co-authored-by`. Không push.
- [ ] 7. **Báo lệch cho năng lực đã có spec (chỉ đọc).** Áp cho từng năng lực đã có `docs/specs/<năng-lực>/spec.md`, giao cùng đợt với bước 3 được. Đường đã chọn: subagent chỉ đọc, mỗi năng lực một con (chế độ "chạy lại" trong [references/subagent-prompt.md](references/subagent-prompt.md)), đối chiếu R với code và nguồn của chính nó, trả findings. Session chính:
  1. chạy `check-citations.mjs docs/specs/<năng-lực>/spec.md --root <gốc repo>` cho từng năng lực đã có spec và cộng số vào dòng "Citation hỏng" của báo cáo;
  2. gom findings thành hai nhóm theo [references/drift-report.md](references/drift-report.md) và trả trong chat.

  Không ghi file của các năng lực này: `git status --porcelain -- docs/specs/<năng-lực>/` của từng năng lực đã có spec phải rỗng. Muốn sửa spec thì dùng request thường (`Ảnh hưởng spec` → bước gộp).

## Quy tắc viết R (dùng ở bước 3)

Mỗi dòng yêu cầu là một câu hành vi đo được, có đúng một loại nguồn:

```markdown
## Yêu cầu

- **billing/R1** — Hoá đơn quá hạn 30 ngày được đánh dấu `overdue` khi chạy job nhắc nợ. Nguồn: `src/billing/overdue.ts:41` (test "marks invoice overdue after 30 days")
- **billing/R2** — Hoàn tiền một phần không vượt số tiền đã thu. Nguồn: [refund-partial](../../requests/2026-03-02-refund-partial/design.md)
- **billing/R3** — Phí trễ hạn tính theo ngày lịch. Nguồn: `src/billing/late-fee.ts:18` [Unverified]
- **billing/R4** — Job nhắc nợ chạy mỗi ngày một lần. Nguồn: [Unverified] lịch cron trong cấu hình deploy, không chỉ ra được một dòng

## Câu hỏi mở

- Phí trễ hạn có áp dụng cho gói dùng thử không? Code không phân nhánh; không có test.
```

| Loại | Bằng chứng | Ghi trong Nguồn |
|---|---|---|
| 1 | Design `merged` mô tả hành vi và code khớp | link `../../requests/<ngày>-<slug>/design.md` |
| 2 | Chỉ có code và test | `` `file:line` `` + tên test trong `(test "…")` |
| 3 | Chỉ suy từ code, không test hay doc nào xác nhận | ưu tiên `` `file:line` `` + `[Unverified]`; không chỉ ra được một dòng thì `[Unverified] <mô tả ngắn chỗ suy ra>` |
| 4 | Design `merged` nhưng code khác design | theo code: `` `file:line` `` + `lệch: [<slug>](…/design.md)` |

- Mơ hồ, không biết đúng hay sai → không thành R; đưa vào `## Câu hỏi mở`.
- Mọi trích dẫn `` `file:line` `` viết liền trong một cặp backtick, đường dẫn tính từ gốc repo, rồi đúng một số nguyên sau dấu hai chấm. Không dùng khoảng (hai số nối bằng gạch ngang), không dùng danh sách (số ngăn bằng dấu phẩy), không dùng cột (thêm dấu hai chấm và số thứ hai), không có dấu cách; checker báo lỗi các dạng đó.
- Phần trước dấu hai chấm phải có `.` hoặc `/`, nếu không checker coi là chữ thường và bỏ qua: file không đuôi ghi `./Makefile:3`, không ghi `Makefile:3`.
- ID tăng dần từ `R1`, không tái dùng số đã bỏ.

## Ranh giới đầu ra

- Khi ghi spec cho năng lực chưa có, spec ghi mục `Lịch sử` mỗi R một dòng `| <ngày> | backfill <ngày> | <năng-lực>/R<n> | thêm |`, thay cho link request khi không có request gốc.
- Không tạo năng lực mới ngoài danh sách đã duyệt; gộp, tách hay đổi tên chỉ theo lựa chọn ở bước 2.

## Verification (trước khi báo hoàn thành)

- Bước 5(a) exit 0 (in `0 trích dẫn hỏng`) cho từng năng lực vừa ghi.
- Bước 5(b): không có dòng `[W11]` hay `[W14]` từ thư mục request tạm; thư mục tạm đã dọn.
- Bước 5(c): ba lệnh không in gì; mọi R vừa ghi có đúng một loại nguồn.
- Bước 5(d): `git status --porcelain` không có dòng ngoài `docs/specs/`.
- Năng lực đã có spec: báo cáo có hai nhóm và số citation hỏng; file spec của chúng không đổi.
- Báo residual risk: phần chưa kiểm kê, R dựa trên `[Unverified]`, mục Câu hỏi mở còn lại.

## Bản đồ tài liệu

- [references/sources.md](references/sources.md): thứ tự kiểm kê nguồn rẻ → đắt, cách lọc request `merged`, bảng nguồn của R. Nạp ở bước 1.
- [references/subagent-prompt.md](references/subagent-prompt.md): prompt mẫu cho mỗi năng lực (ghi; chỉ đọc cho năng lực đã có spec), quy tắc ghi, định dạng báo cáo. Nạp ở bước 3 và 7.
- [references/drift-report.md](references/drift-report.md): mẫu báo cáo lệch cho năng lực đã có spec (hai nhóm, số citation hỏng). Nạp ở bước 7.
