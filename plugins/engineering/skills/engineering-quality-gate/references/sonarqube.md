# SonarQube — thu thập, phân loại, và quyết định sửa

Mục tiêu của bước Sonar: rút một danh sách findings chất lượng/bảo mật **có vị trí file:line** để gộp cùng
Black Duck rồi triage. Có **hai cách thu thập, KHÔNG dùng web API**.

## Cách thu thập

### (a) Chạy `sonar-scanner` tại chỗ

Điều kiện: có `sonar-project.properties` (hoặc cấu hình tương đương trong `pom.xml`/`build.gradle`/CI) và
token cấp qua **biến môi trường**. Skill chỉ nêu **tên biến**, KHÔNG đọc/in giá trị:

- `SONAR_HOST_URL` — URL server SonarQube/SonarCloud.
- `SONAR_TOKEN` — token phân tích (analysis token).

Chạy scanner đúng theo stack (thường là lệnh `sonar-scanner`, hoặc goal `mvn sonar:sonar` /
`gradle sonar`). Sau khi phân tích xong, kết quả nằm trên server; để lấy findings về **không qua web API**,
ưu tiên **xuất report ra file** (xem (b)) hoặc đọc **quality gate status** mà scanner in ra cuối run.
Thiếu `sonar-project.properties` hoặc thiếu token → **không đoán mò**: nói rõ và chuyển sang (b) nếu có
report, hoặc đề nghị người bổ sung cấu hình/biến môi trường.

### (b) Đọc report đã xuất sẵn

Khi project (hoặc CI) đã xuất findings ra file, đọc trực tiếp — đây là đường an toàn nhất, không cần token:

- **Issues JSON** (kết xuất từ Sonar) — danh sách issue kèm rule, type, severity, `component`, `line`.
- **SARIF** (`*.sarif`) — chuẩn chung; đọc `runs[].results[]` (ruleId, level, `locations[].physicalLocation`).
- **Quality gate status** — JSON/log nêu `status` (`OK`/`ERROR`) + các điều kiện không đạt (coverage,
  duplication, new issues...).

Dò các đường thường gặp: thư mục `.scannerwork/`, output CI, hoặc file report người dùng chỉ định. Không
thấy → hỏi đường dẫn, đừng bịa findings.

## Phân loại finding

Với mỗi finding, rút các trường sau để triage nhất quán:

- **Type:** `Bug` · `Vulnerability` · `Code Smell` · `Security Hotspot`.
- **Severity:** `Blocker` · `Critical` · `Major` · `Minor` · `Info`.
- **Rule:** ruleId (vd `java:S2095`) — dùng để hiểu ý lỗi và cách sửa chuẩn.
- **Vị trí:** map `component` (path) + `line` → **`file:line`** trong repo. Với SARIF là
  `physicalLocation.artifactLocation.uri` + `region.startLine`.

Ngoài issue-level, ghi lại **quality gate status** và các chỉ số cổng nếu report có: **coverage**,
**duplication**, **new issues / new coverage** trên nhánh mới. Những chỉ số này quyết cổng đạt/không đạt,
nên đưa vào report dù không phải "lỗi" sửa được bằng một diff.

## Tự sửa an toàn vs cần người review

| Nhóm | Ví dụ | Hành động |
|------|-------|-----------|
| **Tự sửa an toàn** | Code smell rõ (unused import/var, dead code), đặt tên vi phạm convention, format, bug đơn giản không đổi hành vi quan sát được (thiếu `close()` tài nguyên có pattern chuẩn, so sánh sai kiểu hiển nhiên) | Áp fix theo `code-convention`, giữ nguyên hành vi nghiệp vụ, kèm test/lint xanh |
| **Cần người review** | `Security Hotspot` (cần đánh giá ngữ cảnh: có thật sự là lỗ hổng không), fix làm **thay đổi hành vi** mà **thiếu test** bảo chứng, sửa động tới logic nghiệp vụ / luồng auth / crypto | **KHÔNG auto-fix** — đề xuất hướng + đánh dấu để người quyết trong report |
| **Không thuộc phạm vi một diff** | Coverage/duplication dưới ngưỡng cổng | Báo trong report như điều kiện cổng; đề xuất bổ sung test là việc riêng |

Nguyên tắc: một fix chỉ "an toàn để tự áp" khi **không đổi hành vi quan sát được** hoặc **có test bảo
chứng**. Còn nghi ngờ → hạ xuống nhóm "cần người review".

## Ranh giới (nhắc lại)

- Token qua biến môi trường; KHÔNG in/log giá trị.
- KHÔNG đổi quality gate profile hay cấu hình server.
- Ngôn ngữ đo được: mỗi finding có type + severity + `file:line` (hoặc rule + component). Findings phản
  ánh **thời điểm quét**, có thể sót — nêu **residual risk** trong report, không tuyên bố tuyệt đối.

Sau khi có findings Sonar, gộp cùng Black Duck ([blackduck.md](blackduck.md)) rồi theo vòng chung ở
[triage-and-fix.md](triage-and-fix.md).

## Đọc cho ngưỡng go-live

Cờ `--sonar <issues.json>` đọc issues JSON đã xuất, mỗi lần chạy một file. Script chỉ đọc file: không gọi server
SonarQube, không đọc `SONAR_HOST_URL` hay `SONAR_TOKEN`. Thiếu mảng `issues` → exit 2. `paging.total` (hoặc `total`) lớn hơn số phần tử `issues` → exit 2, vì report chưa đủ trang.

Sonar là nguồn bắt buộc của Critical/High và RCE (`SCAN_SOURCES` trong `scripts/go-live-gate.mjs`).

### Trường đọc

[Unverified] Tên trường và giá trị dưới đây chưa kiểm với report thật; kiểm trên report của tổ chức trước khi dùng.

| Trường | Bắt buộc | Script dùng để |
|---|---|---|
| `issues[].type` | có, chuỗi | Chuẩn hoá không phân biệt hoa thường; chỉ `VULNERABILITY` vào Critical/High và RCE; `BUG`, `CODE_SMELL`, `SECURITY_HOTSPOT` hợp lệ nhưng không vào chỉ tiêu; giá trị khác → exit 2 |
| `issues[].severity` | có, với issue `VULNERABILITY` (trừ khi có `impacts[]` SECURITY) | Mức theo bảng dưới |
| `issues[].impacts[]` | không | Chỉ mục có `softwareQuality` = `SECURITY` (không phân biệt hoa thường) được xét |
| `issues[].component` | có, chuỗi, với issue `VULNERABILITY` | [Unverified] Đường dẫn file là phần sau dấu `:` đầu tiên, dạng `<project-key>:<đường-dẫn>` |
| `issues[].line` | không | Thiếu thì khoá dùng dòng 0 |
| `issues[].cwe` | không | Số (`78`) hoặc chuỗi (`CWE-78`) |
| `issues[].tags` | không | Tag dạng `cwe-<n>` được tính là CWE; số thuần như năm thì không |
| `issues[].resolution`, `issues[].issueStatus` | không | Gắn nhãn `suppress` (xem dưới) |
| `issues[].message`, `issues[].rule` | không | Chỉ để xét nhãn "remote code execution" |

Issue có `type` hợp lệ khác `VULNERABILITY` bị bỏ qua trước khi kiểm `severity`, `component`, `line`, `cwe`, `tags`; các trường đó không bị đòi với issue này.

### Mức độ

Mức của finding là mức cao hơn giữa `severity` và mọi `impacts[]` có `softwareQuality` = `SECURITY`.

[Unverified] Tập giá trị của `impacts[].severity` chưa kiểm với report thật.

| Nguồn | Giá trị | Mức chuẩn hoá |
|---|---|---|
| `severity` | BLOCKER | Critical |
| `severity` | CRITICAL | High |
| `severity` | MAJOR | Medium |
| `severity` | MINOR | Low |
| `severity` | INFO | Info |
| `impacts[].severity` | BLOCKER | Critical |
| `impacts[].severity` | HIGH | High |
| `impacts[].severity` | MEDIUM | Medium |
| `impacts[].severity` | LOW | Low |
| `impacts[].severity` | INFO | Info |

Giá trị khác bảng → exit 2. Script không phân biệt hoa thường và bỏ khoảng trắng đầu cuối.

### Nhãn suppress và FP

- [Unverified] Nhãn `suppress` khi `resolution` là `FALSE-POSITIVE` hoặc `WONTFIX`, hoặc `issueStatus` là
  `FALSE_POSITIVE` hoặc `ACCEPTED`. Giá trị so sánh không phân biệt hoa thường.
- Nhãn `suppress` không loại finding khỏi số đếm. Chỉ `--fp` kèm `reason` mới loại.

### Phần không đếm được

- [Unverified] Security Hotspot thường không nằm trong issues JSON, nên script không đếm. Ghi vào report như residual risk.
- Finding Sonar có `type` khác `VULNERABILITY` không vào chỉ tiêu, dù có mức Blocker.
- `type` và `impacts[].softwareQuality` được chuẩn hoá không phân biệt hoa thường và bỏ khoảng trắng đầu cuối: `vulnerability` đếm như `VULNERABILITY`, `security` như `SECURITY`. `type` ngoài {BUG, CODE_SMELL, VULNERABILITY, SECURITY_HOTSPOT} → exit 2.
- [Unverified] Tên trường `paging.total` theo API issues của Sonar. Script đọc `paging.total`, không có thì đọc `total`; giá trị lớn hơn số phần tử `issues` hoặc không phải số nguyên → exit 2 (report chưa đủ trang). Người xuất lấy đủ mọi trang vào một file rồi chạy lại.

### Ví dụ đầu vào

```json
{
  "issues": [
    {
      "type": "VULNERABILITY",
      "severity": "BLOCKER",
      "component": "<project-key>:src/<đường-dẫn>/<tên-file>.java",
      "line": 42,
      "rule": "<rule-id>",
      "message": "<mô tả>",
      "cwe": [78],
      "tags": ["cwe-78"]
    }
  ]
}
```

### --na

`--na sonar=<bằng chứng>` chỉ khi bằng chứng cho thấy phạm vi không có project Sonar và người dùng đã xác nhận. Bằng chứng ghi cụ thể
(tên project đã kiểm hoặc lý do), không ghi chung chung. Script ghi đúng một warning "N/A tự khai, cần người dùng xác nhận bề mặt không tồn tại" cho nguồn `sonar`.

Không dùng `--na sonar=...` khi đã có `--sonar`: script trả exit 2 (`--na` cho nguồn đã có cờ riêng).
