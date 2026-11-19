# Gitleaks: secret trong working tree và lịch sử git

Gitleaks là nguồn bắt buộc của chỉ tiêu **secret** (0 secret), qua hai cờ: `--gitleaks-tree` (working tree) và `--gitleaks-history` (lịch sử git). Thiếu một trong hai mà không có finding nào thì secret là `chưa đo`.

## Cách chạy tại chỗ

[Unverified] Cú pháp theo phiên bản Gitleaks. Trước khi chạy, kiểm bằng `gitleaks version` và `gitleaks dir --help`, `gitleaks git --help`.

```bash
gitleaks dir --redact --report-format json --report-path gitleaks-tree.json <đường-dẫn-repo>
gitleaks git --redact --report-format json --report-path gitleaks-history.json <đường-dẫn-repo>
```

- `--redact` là bắt buộc, kể cả khi chỉ chạy thử. Report không có cờ này chứa giá trị secret.
- Ghi ra file bằng `--report-path`, không để in ra log CI.
- Phiên bản cũ thay cả hai lệnh bằng `gitleaks detect` [Unverified].
- Chạy trên máy có repo. Không chạy trên VM SIT/UAT.
- Repo không có lịch sử git: không chạy `gitleaks git`; khai `--na gitleaks-history=<bằng chứng>`, ví dụ "thư mục không phải git repo, đã kiểm bằng `git rev-parse`".
- Gitleaks chưa cài: nêu rõ secret `chưa đo`, đề nghị người dùng cài hoặc đưa report đã che. Không cài vào project.

## Cờ script

| Cờ | Tên nguồn trong `missing` và `--na` | Ghi chú |
|---|---|---|
| `--gitleaks-tree <file>` | `gitleaks-tree` | Mỗi cờ dùng một lần. |
| `--gitleaks-history <file>` | `gitleaks-history` | |

## Trường đọc

Report phải là một mảng JSON ở cấp gốc. Không phải mảng thì exit 2.

| Trường | Bắt buộc | Dùng để | Ghi chú |
|---|---|---|---|
| `RuleID` | có, chuỗi | phần luật của khoá | [Unverified] |
| `File` | có, chuỗi | phần đường dẫn của khoá | [Unverified] |
| `StartLine` | có, số | phần dòng của khoá | [Unverified] |

- Khoá finding: `RuleID@File:StartLine`. Mỗi phần tử là một finding secret.
- Cùng `RuleID@File:StartLine` ở working tree và lịch sử thì gộp thành một finding, đếm một lần (quyết định 9).
- Secret không có mức độ. Finding secret có `severity` là `Secret` trong output và không vào Critical/High (quyết định 4).
- Report `[]` là hợp lệ: nguồn đã có, không có finding.
- Script không đọc `Secret`, `Match`, `Fingerprint`. Các trường này không dùng để khoá và không in ra.

## Mask

- `--redact` khi chạy. Script không đọc trường chứa giá trị.
- Báo cáo chỉ nêu `RuleID` và `File:StartLine`. Không chép nội dung report gốc vào chat, báo cáo hay ledger.
- Report chưa che không đưa cho agent. Chạy lại với `--redact` rồi đưa bản mới.

## File ignore cần liệt kê

Finding bị ignore không có trong report nên script không đếm. Ghi vào báo cáo một dòng "suppress ngoài report" kèm số mục của từng file:

- `.gitleaksignore` ở gốc repo: số dòng không rỗng và không bắt đầu bằng `#` [Unverified].
- `.gitleaks.toml` (mục `allowlist`), nếu có: số mục [Unverified].

Ghi kèm residual risk: các finding này không được đếm.

## Điền --na và --fp

- `--na gitleaks-tree=<bằng chứng>` hoặc `--na gitleaks-history=<bằng chứng>` chỉ khi bề mặt đó không tồn tại. Cung cấp cả cờ và `--na` cho cùng nguồn thì exit 2.
- `--na` chỉ bỏ nguồn đó khỏi danh sách thiếu. Nguồn còn lại vẫn phải có report.
- `--fp` và `--accepted` là JSON mảng. `reason` bắt buộc, thiếu thì exit 2:

```json
[{ "source": "gitleaks-tree", "key": "<RuleID>@<File>:<StartLine>", "reason": "<lý do>" }]
```

`--fp` loại finding khỏi số đếm. `--accepted` giữ finding trong số đếm với nhãn `chấp nhận rủi ro`. Với lịch sử git, `source` là `gitleaks-history`.

## Ranh giới

- Chỉ quét tại chỗ và đọc kết quả. Không gọi server, không ghi lên SIT/UAT, không cài tool vào project.
- Không in giá trị secret ra chat, báo cáo hay log.
