# ZAP và Nessus: đọc report đã xuất

Cả hai nguồn chỉ đọc report đã xuất. Agent không chạy ZAP, không chạy active scan, không quét Nessus và không gọi API của ZAP hay Nessus. Người dùng xuất report sau khi quét ở môi trường đã được họ chọn.

ZAP và Nessus là nguồn bắt buộc của Critical/High và RCE. Nessus cũng là nguồn bắt buộc của KEV.

## ZAP: `--zap <file>`

Script đọc ZAP JSON. ZAP XML đọc tay theo mục dưới, không đưa vào script.

### Trường đọc

Report phải có `site` là mảng. Mỗi `site` có `alerts` là mảng.

| Trường | Bắt buộc | Dùng để | Ghi chú |
|---|---|---|---|
| `site[].alerts[].alert` (hoặc `name`) | có, chuỗi | tên alert trong khoá | [Unverified] |
| `site[].alerts[].riskcode` | có | mức độ, xem bảng dưới | [Unverified] |
| `site[].alerts[].cweid` | không | CWE nếu là số dương; `-1`, `0` hoặc rỗng thì không có CWE; khác dạng số thì exit 2 | [Unverified] |
| `site[].alerts[].instances[].uri` | không | URL trong khoá | [Unverified] |
| `site[]["@name"]` | có khi alert không có `instances[].uri`; thiếu thì exit 2 | URL dự phòng | [Unverified] |

- Script không đọc `evidence`, `attack`, request hay response.

### Ánh xạ severity

| ZAP `riskcode` | Mức chuẩn hoá |
|---|---|
| 3 | High |
| 2 | Medium |
| 1 | Low |
| 0 | Info |

Giá trị khác thì exit 2. Script chấp nhận chuỗi `"3"` và có khoảng trắng đầu cuối.

### Khoá finding

`alert@URL`. ZAP không gộp với finding có `file:line` (Coverity, SARIF, Sonar).

### File ignore và context

- File context hoặc cấu hình exclude URL của ZAP trong repo: số mục [Unverified].
- Alert bị tắt trong cấu hình rule của ZAP: số mục [Unverified].
- Ghi các số này vào dòng "suppress ngoài report" kèm residual risk.

### ZAP XML

Agent đọc tay theo cấu trúc `alertitem` (`riskcode`, `cweid`, `instances`) [Unverified]. Số đếm tay không thay cho cờ script: nguồn ZAP vẫn `chưa đo` trong ngưỡng đến khi có JSON hoặc `--na` có bằng chứng.

## Nessus: `--nessus <file.csv>`

Script đọc CSV. `.nessus` (XML) đọc tay theo mục dưới.

### Định dạng CSV

- Dấu phân cách là phẩy, nháy kép kiểu RFC 4180. Nessus xuất dấu khác thì thiếu cột và exit 2.
- Cột bắt buộc: `Plugin ID`, `CVE`, `Risk`, `Host`. Thiếu cột nào thì exit 2, kể cả khi mọi dòng đều có CVE.
- Cột tuỳ chọn: `Port`, `Name`.
- Header có mà không có dòng dữ liệu: nguồn hợp lệ, không có finding.
- Nháy kép không đóng: exit 2.

### Trường đọc

| Cột | Bắt buộc | Dùng để | Ghi chú |
|---|---|---|---|
| `Plugin ID` | có trong header; giá trị có khi dòng không có CVE | khoá `plugin@host` | [Unverified] |
| `CVE` | có trong header | khoá `CVE@host`, nhiều CVE tách bằng phẩy trong nháy kép | [Unverified] |
| `Risk` | có trong header | mức độ, xem bảng dưới | [Unverified] |
| `Host` | có; giá trị không rỗng | tài sản của khoá | [Unverified] |
| `Port` | không | chỉ hiển thị trong vị trí | [Unverified] |
| `Name` | không | nhãn để xét RCE | [Unverified] |

- Script chỉ nhận CVE đúng dạng `CVE-năm-số`. Giá trị khác dạng bị bỏ qua và dòng đó coi như không có CVE. Đây là giới hạn đã biết; ghi vào báo cáo nếu gặp.
- Nessus CSV không có CWE. RCE của Nessus chỉ xét qua nhãn "remote code execution" trong `Name`.
- Không đọc cột Plugin Output: có thể chứa banner hoặc giá trị nhạy cảm.

### Ánh xạ severity

| Nessus `Risk` | Mức chuẩn hoá |
|---|---|
| Critical | Critical |
| High | High |
| Medium | Medium |
| Low | Low |
| None | Info |

Giá trị khác thì exit 2. Script không phân biệt hoa thường và bỏ khoảng trắng đầu cuối.

### Khoá finding

- Dòng có CVE: `CVE@host`, mỗi CVE một finding.
- Dòng không có CVE: `plugin@host`. Plugin ID rỗng và không có CVE thì exit 2.
- Hai dòng cùng CVE trên cùng host khác port là một finding.

### File ignore và accepted risk

- Plugin rule hoặc accepted risk trong Nessus làm ẩn finding khỏi report xuất [Unverified]: liệt kê số mục.
- Ghi vào dòng "suppress ngoài report" kèm residual risk.

### .nessus (XML)

Agent đọc tay theo cấu trúc `ReportHost` và `ReportItem` (tên host, `pluginID`, `severity`, `cve`) [Unverified]. Nếu chỉ có `.nessus`, yêu cầu người dùng xuất CSV.

Đếm tay `.nessus` không đưa vào chỉ tiêu. Nguồn nessus vẫn `chưa đo` cho tới khi có CSV hoặc `--na` có bằng chứng; kết quả đọc tay chỉ ghi vào báo cáo như ghi chú [giả định].

## Điền --na và --fp

- `--na zap=<bằng chứng>`: đợt không có giao diện web hoặc API để quét. Bằng chứng ghi rõ điều đó.
- `--na nessus=<bằng chứng>`: đợt không có máy chủ (VM) trong phạm vi. Bằng chứng ghi rõ điều đó.
- `--fp` và `--accepted` là JSON mảng; `reason` bắt buộc:

ZAP:

```json
[{ "source": "zap", "key": "<tên alert>@<URL>", "reason": "<lý do>" }]
```

Nessus:

```json
[{ "source": "nessus", "key": "<CVE>@<host>", "reason": "<lý do>" }]
```

Với Nessus không CVE, khoá là `<Plugin ID>@<host>`.

## Ranh giới

- Không chạy ZAP active scan. Không quét Nessus. Không gọi API ZAP hay Nessus.
- Không ghi lên SIT/UAT. Không cài tool vào project.
- Không chép nội dung request, response hay Plugin Output vào báo cáo.
- Report ZAP và Nessus chứa URL, tên host nội bộ. Ghi ra thư mục ngoài repo và không commit file report.
