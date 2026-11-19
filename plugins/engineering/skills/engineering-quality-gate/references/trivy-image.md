# Trivy image: vuln và secret trong container image

Trivy image là nguồn bắt buộc của chỉ tiêu secret, Critical/High, RCE và KEV, qua cờ `--trivy`. Một lệnh quét cả lỗ hổng và secret; nếu thiếu `secret` trong `--scanners`, script vẫn coi nguồn `trivy` đã có và chỉ tiêu secret không có số từ Trivy.

## Cách chạy tại chỗ

[Unverified] Cú pháp theo phiên bản Trivy. Kiểm bằng `trivy version` và `trivy image --help`.

```bash
trivy image --scanners vuln,secret --format json --output <thư-mục-ngoài-repo>/trivy-image.json <image>
```

- Luôn có `vuln,secret`. Quét thiếu `secret` thì chỉ tiêu secret có thể đạt sai.
- Tham chiếu theo digest (`<repo>@sha256:...`) khi có. `Metadata.RepoDigests` chỉ có giá trị khi image đã có digest trên registry [Unverified]. Script dùng `Metadata.RepoDigests[0]` làm khoá tài sản của finding; không có thì dùng `ArtifactName`. Đối chiếu digest đã quét với image đang chạy trên SIT/UAT là bước của skill `ops-deploy-release` (file `references/digest-check.md`), không phải của script.
- Quét trên máy có quyền pull image. Không chạy trên VM SIT/UAT.
- Trivy chưa cài: nêu rõ các chỉ tiêu liên quan `chưa đo`, đề nghị người dùng cài hoặc đưa report sẵn có. Không cài vào project.

## Cờ script

| Cờ | Tên nguồn trong `missing` và `--na` | Ghi chú |
|---|---|---|
| `--trivy <file>` | `trivy` | Một lần mỗi lần chạy script. Đợt có nhiều image chưa được hỗ trợ: lặp cờ thì exit 2. |

## Trường đọc

Report phải có `Results` hoặc `ArtifactName`. `Results` nếu có thì phải là mảng.

| Trường | Bắt buộc | Dùng để | Ghi chú |
|---|---|---|---|
| `Metadata.RepoDigests[0]` | không | phần sau `@` là digest, làm tài sản của khoá; không có thì dùng `ArtifactName` | [Unverified] |
| `ArtifactName` | không | tài sản dự phòng khi không có digest | [Unverified] |
| `Results[].Vulnerabilities[].VulnerabilityID` | có, chuỗi | CVE trong khoá | [Unverified] |
| `Results[].Vulnerabilities[].Severity` | có | mức độ, xem bảng dưới | [Unverified] |
| `Results[].Vulnerabilities[].PkgName`, `InstalledVersion` | không | vị trí `component@version` trong output | [Unverified] |
| `Results[].Vulnerabilities[].CweIDs` | không, mảng chuỗi | CWE để xét RCE | [Unverified] |
| `Results[].Vulnerabilities[].Title` | không | nhãn "Remote Code Execution" để xét RCE | [Unverified] |
| `Results[].Secrets[].RuleID` | có, chuỗi | phần luật của khoá secret | [Unverified] |
| `Results[].Secrets[].StartLine` | có, số | phần dòng của khoá secret | [Unverified] |
| `Results[].Secrets[].Layer.DiffID` | không | vị trí layer; không có thì dùng `Results[].Target` | [Unverified] |

- Script không đọc `Secrets[].Match`, `Secrets[].Code` hay `Secrets[].Severity`.
- Trường `Severity` của secret không dùng: finding secret không vào Critical/High.

## Ánh xạ severity

| Trivy `Severity` | Mức chuẩn hoá |
|---|---|
| CRITICAL | Critical |
| HIGH | High |
| MEDIUM | Medium |
| LOW | Low |
| UNKNOWN | Info |

Giá trị khác (vd `SEVERE`) thì exit 2. Script không phân biệt hoa thường và bỏ khoảng trắng đầu cuối.

## Khoá finding

- CVE: `CVE@image:<digest>`, hoặc `CVE@image:<ArtifactName>` khi không có digest.
- Secret: `RuleID@<layer hoặc Target>:<StartLine>`.
- Cùng CVE trên image này và trên một dòng `component@version` của BlackDuck được đếm hai lần vì là hai tài sản (quyết định 9). Ghi điều này vào báo cáo khi xảy ra.

## Mask

- Không đọc và không chép `Match`, `Code` của secret. Báo cáo chỉ nêu `RuleID`, layer hoặc target, `StartLine`.
- Báo cáo không chứa nội dung report gốc.

## File ignore cần liệt kê

- `.trivyignore` ở gốc repo: số dòng không rỗng và không bắt đầu bằng `#` [Unverified].
- File VEX trong repo hoặc pipeline: số statement [Unverified].

Finding bị ignore không có trong report nên script không đếm. Ghi dòng "suppress ngoài report" kèm số mục và residual risk.

## Điền --na và --fp

- `--na trivy=<bằng chứng>` chỉ khi đợt không có image nào để quét, ví dụ repo chỉ là thư viện. Bằng chứng ghi rõ điều đó.
- `--fp` và `--accepted` là JSON mảng; `reason` bắt buộc:

```json
[{ "source": "trivy", "key": "CVE-XXXX-NNNN@image:sha256:<digest>", "reason": "<lý do>" }]
```

Khoá secret có dạng `RuleID@<layer>:<StartLine>`. Khoá không khớp finding nào thì script ghi một dòng vào `warnings`, số đếm không đổi.

## Ranh giới

- Chỉ quét và đọc kết quả. Không đẩy image, không ghi lên registry, không ghi lên SIT/UAT, không cài tool vào project.
- Report Trivy ghi ra thư mục ngoài repo và không commit: có tên gói và đường dẫn layer nội bộ.
