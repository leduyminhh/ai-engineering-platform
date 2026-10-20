# Report template — kết quả quality + security gate

Xuất report sau khi verify. Ngôn ngữ **đo được** (đếm được, có `file:line`, có CVE/CVSS, có OWASP/ASVS/CWE);
LUÔN có mục **Residual risk**. **Mask** mọi giá trị secret. KHÔNG tuyên bố "chặn / đảm bảo / loại bỏ / sửa
triệt để" — findings phản ánh **thời điểm quét** với dữ liệu sẵn có, có thể sót.

## Mẫu

```markdown
# Quality + Security Gate — <project/scope> — <ngày>

## Tóm tắt
- Scope: <diff | module | thư mục | scope report> · Stack: <java-spring | node-react | python | docker | ...>
- Chế độ: <chạy scanner | đọc report | fix-từ-report> — Sonar: <...> · SCA: <Black Duck | Trivy | đọc BOM>
- Quality gate (Sonar): <OK | ERROR> — điều kiện không đạt: <coverage/duplication/new issues nếu có>
- Tổng findings: <n> (chất lượng <a> · dependency <b> · bảo mật review <c>) — Đã sửa <x> · Hoãn <y>
- Build gate bảo mật: <PASS | FAIL | ERROR> — điều kiện: CRITICAL>0 hoặc HIGH>0 (hoặc theo --fail-on)

## Findings theo mức độ
| Nguồn | Loại | Severity | Vị trí | OWASP | ASVS | CWE | Trạng thái |
|-------|------|----------|--------|-------|------|-----|-----------|
| Sonar | Bug/Vuln/Smell/Hotspot | Blocker/…/Info | file:line (rule) | — | — | — | Đã sửa / Hoãn |
| SCA (Black Duck/Trivy) | CVE-XXXX-NNNN | Critical/…/Low (CVSS x.x) | component@version → fixed x.y.z | A06 | dependency | CWE-1104 | Đã sửa (bump) / Hoãn |
| Review | injection/authz/secret/… | Critical/…/Low | file:line + evidence | A0x | <họ control> | CWE-nnn | Đã sửa / Propose / Defer |

## Đã sửa
- <mô tả ngắn> — <file:line hoặc component@version> — verify: <build/test/lint/rescan xanh>
- ...

## Hoãn (kèm lý do)
- <finding> — lý do: <thiếu test đổi hành vi | hotspot/bảo mật cần đánh giá | chưa có bản vá | bump major rủi ro | license | ngoài scope>
- <vuln không bản vá> — hướng: <workaround | replace | accept-with-note + ngày rà lại>
- ...

## Residual risk
- <rủi ro còn lại sau vòng này: finding hoãn, phần không tự verify được, độ phủ quét/review>
- Findings phản ánh thời điểm quét (<ngày>) và dữ liệu report/BOM/source sẵn có; có thể còn sót.

## Bước verify đã chạy
- build: <lệnh + kết quả>
- test: <lệnh + kết quả>
- lint: <lệnh + kết quả>
- rescan (nếu có): <kết quả>

## Cần người quyết
- <danh sách item Propose/Defer chờ người: hotspot, bảo mật rủi ro cao, breaking-change, bump major, license>
- Con người DUYỆT DIFF trước merge/push (protected branch: mỗi commit).
```

## Quy tắc viết

- Mỗi finding có **severity + vị trí** cụ thể; tránh mô tả mơ hồ ("một vài lỗi", "nhìn chung ổn").
- Finding **bảo mật** kèm **evidence** (trích code/config/manifest) + ánh xạ **OWASP/ASVS/CWE** qua
  [owasp-asvs-cwe-mapping.md](owasp-asvs-cwe-mapping.md); không ánh xạ chắc → ghi `n/a` + lý do, không gán bừa.
- **Mask** mọi secret: chỉ nêu tên khoá + file:line + giá trị đã che (vd `sk_live_****1234`).
- Mục **Đã sửa** đi kèm bằng chứng verify (lệnh + kết quả), không chỉ khẳng định suông.
- Mục **Hoãn** luôn có **lý do** ánh xạ về bảng quyết định trong [triage-and-fix.md](triage-and-fix.md).
- Mục **Residual risk** là **bắt buộc**: nêu finding còn treo, phần không tự verify được (vd đánh giá hotspot/
  bảo mật cần ngữ cảnh), và phạm vi/độ tin cậy của lần quét/review.
- Nếu bỏ qua kiểm tra nào (không chạy được test/rescan, thiếu token nên bỏ enrichment scanner) → **nói rõ** ở
  "Bước verify đã chạy" (fail-loud), KHÔNG coi phần bỏ qua là đã "sạch".
