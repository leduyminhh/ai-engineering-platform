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
- Build gate bảo mật: <PASS | FAIL | ERROR> — điều kiện: CRITICAL>0 hoặc HIGH>0 (hoặc theo --fail-on).
  Đây là gate build cũ; ngưỡng go-live ở mục bên dưới chỉ báo, không chặn.
- Ngưỡng go-live (`overall`): <không đạt | đạt | chưa đo> — chi tiết ở mục Ngưỡng go-live

## Ngưỡng go-live
Nguồn: stdout JSON của `go-live-gate.mjs` (khoá `thresholds`, `overall`, `findings`, `falsePositives`, `warnings`).
Script chỉ báo, không chặn. Exit 0 nghĩa là đọc được input, KHÔNG nghĩa là đạt; kết luận nằm ở `overall` và `status`.
Lấy trạng thái và số đếm từ stdout của script, không đếm tay thay thế.

| Chỉ tiêu | Khoá JSON | Trạng thái | Số đếm (`count`) | Nguồn thiếu (`missing`) | Nguồn `--na` (bằng chứng) | Nhãn: chấp nhận rủi ro / suppress / FP đã loại |
|---|---|---|---|---|---|---|
| 0 secret | `secret` | <trạng thái> | <n> | <danh sách hoặc —> | <nguồn: bằng chứng hoặc —> | <a> / <b> / <c> |
| 0 Critical/High | `critHigh` | <trạng thái> | <n> | <...> | <...> | <a> / <b> / <c> |
| 0 RCE | `rce` | <trạng thái> | <n> | <...> | <...> | <a> / <b> / <c> |
| 0 KEV | `kev` | <trạng thái> | <n> | <...> | <...> | <a> / <b> / <c> |

Trạng thái tổng thể (`overall`): <không đạt | đạt | chưa đo>.

Bốn trạng thái của một chỉ tiêu (theo hàm `statusOf` trong `go-live-gate.mjs`):

| Trạng thái | Điều kiện |
|---|---|
| `không đạt` | có ít nhất một finding được đếm, kể cả khi còn nguồn thiếu |
| `chưa đo` | không có finding được đếm, và còn nguồn bắt buộc chưa có report hoặc `--na` |
| `không áp dụng` | mọi nguồn bắt buộc của chỉ tiêu đều có `--na` kèm bằng chứng |
| `đạt` | không có finding được đếm và mọi nguồn bắt buộc có report hoặc `--na` |

Trạng thái tổng thể: `không đạt` khi có chỉ tiêu `không đạt`; `đạt` khi cả bốn chỉ tiêu đều `đạt`; còn lại
`chưa đo`. `không áp dụng` không được tính là `đạt`, nên tổng thể không thành `đạt` khi có chỉ tiêu `không áp dụng`.

Số đếm:
- `count` không gồm finding có nhãn `FP đã loại`. Finding có nhãn `chấp nhận rủi ro` hoặc `suppress` vẫn được đếm.
- Các `count` không cộng lại được: một finding có thể nằm trong critHigh, rce và kev cùng lúc.
- Secret không vào critHigh. Mức độ `Secret` là nhãn của finding secret, không ghi là Critical.

### Findings của ngưỡng go-live

| ID | Mức độ | Khoá | Nguồn (`sources`) | Vị trí | CWE / CVE | Chỉ tiêu | Nhãn |
|---|---|---|---|---|---|---|---|
| F001 | <Critical…Info, hoặc Secret> | `<khoá>` | <nguồn, ...> | `<file:line hoặc component@version>` | <CWE-n / CVE-n> | <xem quy tắc dưới> | <nhãn> |

- Chỉ tiêu suy ra từ output: `Secret` là secret; Critical hoặc High (không phải secret) là critHigh; `rce: true` là rce;
  `kev: true` là kev. Một finding có thể thuộc nhiều chỉ tiêu.
- Secret: chỉ nêu tên luật (`RuleID`), `File:StartLine` hoặc layer. Không ghi giá trị.

### Finding đã loại (FP đã loại)

| ID | Khoá | Nguồn | Lý do (`reason`) |
|---|---|---|---|
| F00x | `<khoá>` | <nguồn> | <lý do> |

Liệt kê toàn bộ mục trong `falsePositives`. Không có mục nào thì ghi "không có".

### Chấp nhận rủi ro

| ID | Khoá | Lý do (`reason`) |
|---|---|---|
| F00x | `<khoá>` | <lý do> |

Các finding này vẫn nằm trong số đếm và trạng thái chỉ tiêu.

### Cảnh báo (`warnings`)
- <mỗi dòng trong `warnings`, hoặc "không có">

### Dòng suppress ngoài report

Script không thấy finding đã bị file ignore ẩn khỏi report. Liệt kê từng file có trong repo kèm số mục:

| File ignore hoặc cấu hình | Có trong repo | Số mục | Nguồn bị ảnh hưởng |
|---|---|---|---|
| `.gitleaksignore` | có / không | <n> | gitleaks |
| `.trivyignore` | có / không | <n> | trivy |
| File VEX `<đường-dẫn>` | có / không | <n> statement | trivy |
| Cấu hình ignore hoặc `NOSONAR` của SonarQube [Unverified] | có / không | <n> | sonar |
| Cấu hình exclude URL hoặc rule bị tắt của ZAP | có / không | <n> | zap |
| Plugin rule hoặc accepted risk của Nessus | có / không | <n> | nessus |
| Comment `coverity[...]` trong mã nguồn; triage trên Coverity Connect không có trong file | có / không | <n> | coverity |

- [Unverified] Tên file và cách đếm mục theo reference của từng nguồn; chưa kiểm với file thật của tổ chức.
- Residual risk: các finding bị ẩn bởi mục trên không có trong report nên không được đếm trong `thresholds`.
- [Inference] Số mục là số dòng hoặc statement trong file, không nhất thiết bằng số finding bị ẩn.

## Findings theo mức độ
| Nguồn | Loại Severity | Vị trí | OWASP | ASVS | CWE | Trạng thái |
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

## ASVS L2
Nguồn: checklist của tổ chức (csv hoặc md). Chi tiết: [asvs-l2.md](asvs-l2.md).
Không có checklist thì ghi `ASVS L2: chưa đo`. Agent không soạn yêu cầu ASVS và không sinh biên bản.

| Mã mục | Yêu cầu (nguyên văn từ checklist) | Trạng thái (`đạt` / `không đạt` / `chưa kiểm`) | Evidence (`file:line`) | Ghi chú |
|---|---|---|---|---|
| `<mã>` | `<yêu cầu>` | `<trạng thái>` | `<file:line>` | `<lý do nếu chưa kiểm>` |

Tổng: đạt <a> · không đạt <b> · chưa kiểm <c>.

## Pentest và retest
Nguồn: report pentest của đơn vị ATTT (PDF hoặc md). Report này không đi qua script go-live.
Chi tiết: [pentest.md](pentest.md). Finding được sửa sau khi người dùng xác nhận: [triage-and-fix.md](triage-and-fix.md).

| ID | Mức độ (chuẩn hoá, mức gốc trong ngoặc) | Mô tả | Vị trí | Xác nhận (giữ / bỏ kèm lý do / hoãn) | Retest |
|---|---|---|---|---|---|
| P01 | <Critical…Info> (<mức gốc>) | <mô tả ngắn> | <URL hoặc file:line> | <quyết định> | <kết quả retest> |

Retest theo dõi tới 100% finding Critical, High và Medium. Đây là chỉ tiêu theo dõi, không thuộc bốn chỉ tiêu ngưỡng
và không có cổng tự động.

## Cần người quyết
- <danh sách item Propose/Defer chờ người: hotspot, bảo mật rủi ro cao, breaking-change, bump major, license, finding pentest chưa xác nhận>
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
- Nguồn bắt buộc chưa có report: ghi `chưa đo` ở chỉ tiêu liên quan, KHÔNG ghi số 0 và KHÔNG ghi `đạt`.
- `không áp dụng` chỉ ghi khi có bằng chứng bề mặt không tồn tại (`--na`); không dùng để né nguồn chưa đo.
- Không ghi giá trị secret, payload, request, response hay Plugin Output vào report. Report ZAP và Nessus chứa
  URL và tên host nội bộ: ghi ngoài repo và không commit.
