# An toàn secret

Đọc ở bước 1 (thiết lập `.aip/`), bước 2 (đọc cấu hình) và bước 6 (quét và ghi findings). Luật ở đây chỉ là luật trong prompt: không có hook nào của skill chặn việc đọc sai. Skill không tự chạy quality gate và không sửa lỗ hổng.

## Lệnh đọc tên khoá

Đây là lệnh duy nhất được phép chạm vào file cấu hình. Chép nguyên văn, không tự soạn lại, không đổi cờ:

```bash
grep -nE '^[[:space:]]*[A-Za-z0-9_.-]{1,30}[[:space:]]*(:$|[:=][^=])' -- '<file>' | sed -E 's/^([0-9]+):[[:space:]]*([A-Za-z0-9_.-]+).*/\1 \2/' | grep -E '^[0-9]+ [A-Za-z0-9_.-]+$'
```

- Tên file đặt trong nháy đơn sau `--`. Tên file chứa dấu nháy đơn: bỏ qua file đó, ghi `not_read` với lý do `cấu hình`.
- Một file mỗi lần. Với nhiều file, `grep` in tiền tố tên file và dòng gốc có giá trị có thể lọt.
- Không dùng `grep -o` hay `-oE` cho việc này: `-o` in phần khớp, nên có thể lộ ký tự đầu của giá trị.
- Đầu ra mỗi dòng chỉ là `<số dòng> <tên khoá>`. Không đưa đầu ra của lệnh này vào báo cáo cùng giá trị nào.
- Lệnh bỏ dòng `KEY==x` (có `==` ngay sau khoá) và dòng `A=` (dấu phân cách rồi hết dòng); dòng `C=abc==` vẫn lấy khoá `C`. Khoá quá 30 ký tự, khoá có nháy kép (JSON) hoặc dòng không khớp: ghi `not_read` với lý do `cấu hình`.

## File cấu hình không được đọc nội dung

Chỉ dùng lệnh tên khoá ở trên. Không `Read`, `cat`, `head`, `tail`, `less`, `sed`, `awk`, không `Grep` chế độ nội dung, không lệnh nào khác in nội dung các file sau:

- `application*.yml`, `application*.yaml`, `application*.properties`, `bootstrap*.yml`
- `.env` và `.env.*`
- `appsettings*.json`
- `*.pem`, `*.key`, `*.jks`, `*.p12`, `*.keystore`, `*.pfx`, `*.p8`
- `config.json` chứa kết nối
- `docker-compose*.yml` có khối `environment`
- `gradle.properties`, `settings.xml` của Maven, `.npmrc`, `.netrc`, `.pgpass`, `*.tfvars`, `values*.yaml` của Helm
- `secrets.*`, `credentials*`, `config.js`, `config.ts`, `settings.py`
- `*.sql` có nghi chứa mật khẩu: không `Read` file `.sql` ngoài đường dẫn có `migration` hoặc `schema`
- mọi file trong thư mục `resources` có tên chứa `secret`, `credential` hoặc `config`
- `pom.xml`, `build.gradle`, `settings.gradle`: thông tin module lấy từ trường kiểm kê, không mở

Gặp giá trị bí mật trong mã nguồn: ghi loại và `file:line`, không trích thêm dòng đó.

## Lệnh chép ra tài liệu, Dockerfile và CI

- Áp cho mọi lệnh chép ra bất kỳ tài liệu nào (README module, README gốc, project-knowledge, findings, báo cáo), kể cả dòng `RUN` của Dockerfile, dòng `run` của CI, `CMD`, `ENTRYPOINT`, mục `scripts` của package.json, lệnh clone và dòng của requirements.txt:
  - Bỏ tiền tố gán biến môi trường: `TÊN=giá-trị lệnh` thành `<tên-biến> lệnh`. Cùng luật cho `export`, `set`, `$env:TÊN=`, `cross-env`, `docker run -e` và `-D<tên>=<giá-trị>`.
  - Thay bằng `<giá-trị>` mọi giá trị chữ đứng sau cờ (dính liền hoặc cách bằng dấu cách) hoặc sau `TÊN=`, mọi phần `user:pass` trong URL (clone, `--extra-index-url`, `git+https://token@`) và mọi giá trị sau `-u`. Ví dụ: `mysql -u <giá-trị> -p <giá-trị>`, `curl -u <giá-trị> <url>`.
  - Khớp tên cờ và `TÊN` không phân biệt hoa thường với `pass`, `pwd`, `secret`, `token`, `key`, `auth`, `dsn`, `credential`, `connection`; cờ ngắn một chữ cái luôn che giá trị.
  - Không chắc cờ có mang giá trị thì không chép lệnh; ghi `[Unverified] lệnh có cờ mang giá trị`.
- Dockerfile: chỉ chép dòng `RUN` có lệnh build hoặc test, `CMD` và `ENTRYPOINT`, với giá trị đã che theo luật trên (`--build-arg` và `-e` giữ tên, che giá trị). Không chép dòng `ENV` và `ARG`.
- File CI: chỉ chép dòng `run` có lệnh build hoặc test. Không chép khối `env`, `with`, hay mọi khối có giá trị.
- Dockerfile và file CI có thể đọc bằng Read. Giá trị trong đó không được chép vào bất kỳ file hay trường nào; ghi `"Read đưa giá trị trong <tên file> vào log phiên"` vào `remaining_risks`.
- package.json, requirements.txt và lock file được Read; không chép URL có `user:pass@` hoặc `token@` từ chúng.

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

File nằm ở cấp `.aip/`, không nằm trong thư mục run. Nếu chưa có, tạo file này với nội dung một dòng `*`. Lý do: `.aip/runs/` chứa findings và phần nháp; `*` làm cả thư mục bị bỏ qua, kể cả file này. Việc đó là chủ đích: findings không vào commit nếu không ai chép thủ công. Nếu file đã có thì giữ nguyên.

## Rủi ro còn lại

Ghi nguyên văn vào báo cáo cuối (mục "Rủi ro còn lại"):

- Chưa kiểm được log phiên: nếu một lệnh đã in giá trị cấu hình, giá trị đó có thể đã nằm trong log phiên và skill không kiểm được log này.
- Mã nguồn có secret cứng: lệnh Read đưa cả file vào log phiên, nên giá trị có thể đã nằm trong log. `scan-secrets.mjs` không quét log phiên, nên không kiểm được điều này.
- Reviewer mở dòng mã nguồn bằng `sed -n '<n>p'`: nếu dòng đó chứa secret cứng, giá trị vào log phiên và không kiểm được.

`scan-secrets.mjs` là heuristic: sạch không chứng minh log phiên sạch hay không còn secret dạng tự do (mật khẩu không kèm tên khoá, chuỗi mã hoá lạ, giá trị trong ô bảng Markdown hoặc ở dòng sau tên khoá, mật khẩu nêu trong câu văn).
