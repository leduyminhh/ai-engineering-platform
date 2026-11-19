# Coverity: đọc report JSON đã xuất

Coverity chỉ đọc report đã xuất. Người dùng chạy Coverity trên máy có license và xuất JSON; agent chỉ đọc file. Agent không chạy Coverity và không gọi Coverity Connect.

Coverity là nguồn bắt buộc của Critical/High và RCE. Không có report thì hai chỉ tiêu này `chưa đo` khi không có finding nào.

## Cách lấy report

[Unverified] Lệnh xuất theo tài liệu Coverity, kiểm theo phiên bản của tổ chức:

```bash
cov-format-errors --json-output-v7 <file-kết-quả>.json
```

Người dùng chạy và đưa file cho agent. Không có file thì nêu rõ `chưa đo`, không đoán số.

## Cờ script

| Cờ | Tên nguồn trong `missing` và `--na` | Ghi chú |
|---|---|---|
| `--coverity <file>` | `coverity` | Một lần mỗi lần chạy script. |

## Trường đọc

Report phải có `issues` là mảng. Không có thì exit 2.

| Trường | Bắt buộc | Dùng để | Ghi chú |
|---|---|---|---|
| `issues[].mainEventFilePathname` | có, chuỗi | phần file của khoá | [Unverified] |
| `issues[].mainEventLineNumber` | có, số | phần dòng của khoá | [Unverified] |
| `issues[].checkerProperties.impact` | có | mức độ, xem bảng dưới; giá trị khác thì exit 2 | [Unverified] tên trường và tập giá trị |
| `issues[].checkerProperties.cweCategory` | không | CWE, số hoặc `CWE-n`; sai dạng thì exit 2 | [Unverified] |
| `issues[].checkerName`, `checkerProperties.categoryDescription` | không | nhãn để xét RCE | [Unverified] |
| `issues[].stateOnServer.triage.classification` | không | `False Positive` hoặc `Intentional` gắn nhãn `suppress` | [Unverified] |

- Script chỉ đọc các trường trong bảng. Đoạn mã và mô tả sự kiện không được chép vào báo cáo.

## Ánh xạ severity

| Coverity `impact` | Mức chuẩn hoá |
|---|---|
| HIGH | High |
| MEDIUM | Medium |
| LOW | Low |

Coverity không có mức Critical hay Info trong bảng. Giá trị khác thì exit 2, không đoán. Script không phân biệt hoa thường và bỏ khoảng trắng đầu cuối.

## Khoá finding

- `file:line` khi không có CWE; `file:line+CWE-n` khi có CWE.
- Coverity và SARIF gộp thành một finding chỉ khi cùng `file:line` và cùng CWE. Một bên có CWE, bên kia không có thì hai finding (script đối chiếu đúng như vậy).

## Mask

- Báo cáo chỉ nêu file, dòng, CWE và tên checker.
- Không dán nội dung report gốc vào chat hay báo cáo.

## File ignore và suppress cần liệt kê

- Triage trên Coverity Connect chỉ có trong file JSON nếu report xuất kèm trạng thái đó. Triage không có trong file thì script không gắn nhãn. Ghi số finding đã triage trên server, nếu người dùng biết, vào dòng "suppress ngoài report".
- Comment suppress trong mã nguồn [Unverified]: đếm bằng `grep -rn "coverity\[" <đường-dẫn-repo>` và ghi số lượng vào báo cáo.

## Điền --na và --fp

- `--na coverity=<bằng chứng>` chỉ khi repo không có mã nguồn mà Coverity phân tích. Bằng chứng ghi rõ các ngôn ngữ đã kiểm.
- `--fp` và `--accepted` là JSON mảng; `reason` bắt buộc:

```json
[{ "source": "coverity", "key": "<file>:<line>+CWE-<n>", "reason": "<lý do>" }]
```

Finding gộp với SARIF có thể khớp theo `source` là `coverity` hoặc `sarif`.

## Ranh giới

- Không chạy Coverity, không gọi server Coverity, không ghi lên SIT/UAT, không cài tool vào project.
