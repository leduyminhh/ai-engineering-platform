# An toàn secret

Đọc ở bước 1 (thiết lập `.aip/`), bước 2 (đọc cấu hình) và bước 6 (quét và ghi findings). Luật ở đây chỉ là luật trong prompt: không có hook nào của skill chặn việc đọc sai. Skill không tự chạy quality gate và không sửa lỗ hổng.

## Lệnh đọc tên khoá

Đây là lệnh duy nhất được phép chạm vào file cấu hình. Chép nguyên văn, không tự soạn lại, không đổi cờ:

```bash
grep -nE '^[[:space:]]*[A-Za-z0-9_.-]{1,30}[[:space:]]*(:$|[:=][^=])' <file> | sed -E 's/^([0-9]+):[[:space:]]*([A-Za-z0-9_.-]+).*/\1 \2/' | grep -E '^[0-9]+ [A-Za-z0-9_.-]+$'
```

- Một file mỗi lần. Với nhiều file, `grep` in tiền tố tên file và dòng gốc có giá trị có thể lọt.
- Không dùng `grep -o` hay `-oE` cho việc này: `-o` in phần khớp, nên có thể lộ ký tự đầu của giá trị.
- Đầu ra mỗi dòng chỉ là `<số dòng> <tên khoá>`. Không đưa đầu ra của lệnh này vào báo cáo cùng giá trị nào.
- Khoá quá 30 ký tự, khoá có nháy kép (JSON) hoặc dòng không khớp: ghi `not_read` với lý do `cấu hình`.

## File cấu hình không được đọc nội dung

Chỉ dùng lệnh tên khoá ở trên. Không `Read`, `cat`, `head`, `tail`, `less`, `sed`, `awk`, không `Grep` chế độ nội dung, không lệnh nào khác in nội dung các file sau:

- `application*.yml`, `application*.yaml`, `application*.properties`, `bootstrap*.yml`
- `.env` và `.env.*`
- `appsettings*.json`
- `*.pem`, `*.key`, `*.jks`, `*.p12`
- `config.json` chứa kết nối
- `docker-compose*.yml` có khối `environment`
- mọi file trong thư mục `resources` có tên chứa `secret`, `credential` hoặc `config`
- `pom.xml`, `build.gradle`, `settings.gradle`: thông tin module lấy từ trường kiểm kê, không mở

Gặp giá trị bí mật trong mã nguồn: ghi loại và `file:line`, không trích thêm dòng đó.

## Mẫu file findings

Đường dẫn: `.aip/runs/onboarding-<slug>/security-findings.md`. Chỉ có loại, `file:line` và nhãn `proven` hoặc `suspected`. Không có giá trị, không có đoạn khớp.

```markdown
# Phát hiện bảo mật: onboarding-<slug>

- <loại> | `<đường dẫn>:<số dòng>` | <proven | suspected>
```

Chỉ ghi các loại trùng tên với `scan-secrets.mjs`: `private-key`, `cloud-key-id`, `jwt`, `url-credentials`, `secret-assignment`, `private-ip`. Loại `trích-dẫn-sai` và `không-xác-minh` ghi trong báo cáo cuối, không vào file này.

## Định tuyến

| Loại | Đi tới | Việc đó làm |
|---|---|---|
| `private-key`, `cloud-key-id`, `jwt`, `url-credentials`, `secret-assignment` | `engineering-quality-gate` | Quét bằng công cụ và review theo OWASP, CWE; báo cáo che giá trị |
| Cùng loại, cần validate, sửa và quét lại | `workflow-security-review` | Điều phối review, sửa, quét lại; người dùng tự rotate secret đã lộ |
| `private-ip` | `engineering-quality-gate` | Đánh giá cấu hình nội bộ có lộ ra ngoài không |

Skill này không tự rotate secret, không sửa mã nguồn để xoá lỗ hổng, không chạy gate. Nó chỉ ghi phát hiện và đề xuất đi tới skill nào.

## `.aip/.gitignore`

Nếu chưa có, tạo file này với nội dung một dòng `*`. Lý do: `.aip/runs/` chứa findings và phần nháp; `*` làm cả thư mục bị bỏ qua, kể cả file này, nên findings không vào commit nếu không ai chép thủ công. Nếu file đã có thì giữ nguyên.

## Rủi ro còn lại

Ghi nguyên văn vào báo cáo cuối (mục "Rủi ro còn lại"):

- Chưa kiểm được log phiên: nếu một lệnh đã in giá trị cấu hình, giá trị đó có thể đã nằm trong log phiên và skill không kiểm được log này.
- Mã nguồn có secret cứng: lệnh Read đưa cả file vào log phiên, nên giá trị có thể đã nằm trong log. `scan-secrets.mjs` không quét log phiên, nên không kiểm được điều này.

`scan-secrets.mjs` là heuristic: sạch không chứng minh log phiên sạch hay không còn secret dạng tự do (mật khẩu không kèm tên khoá, chuỗi mã hoá lạ).
