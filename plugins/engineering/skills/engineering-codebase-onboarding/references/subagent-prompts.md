# Prompt giao subagent

Session chính điền các chỗ `<…>`, rồi giao mỗi prompt cho một subagent `general-purpose`. Session chính gọi Agent với `model: "sonnet"` cho mọi loại prompt dưới đây; prompt không đặt model vì đó là tham số lời gọi. Nếu Agent trả 404 với `sonnet`, bỏ trống `model`, rồi ghi vào báo cáo cuối rằng subagent kế thừa model của session (tốn hơn).

Subagent không thấy skill này: mọi luật cần thiết nằm trong prompt. Một nhóm module một subagent. Tối đa 6 subagent chạy song song.

## 1. Prompt nhóm module

```text
Bạn đọc code của một nhóm module trong project <tên project> để viết README từng module. Chỉ đọc code; chỉ ghi các file ở mục "Được ghi".

## Đầu vào
- Gốc project: <đường dẫn tuyệt đối>
- Nhóm: <tên nhóm>. Module trong nhóm: <id → path, …>
- Trường kiểm kê của từng module (từ inventory-modules.mjs): <dán JSON, gồm buildFile, sourceFiles, testFiles, declaredDeps>
- Ngôn ngữ README: <tiếng Việt có dấu | ngôn ngữ khác>
- Khung README: dán nguyên mục "Khung README module" của references/readme-structure.md.

## Được đọc
- Glob, Grep (chỉ liệt kê tên file hoặc đếm), Read với file mã nguồn có đuôi trong trường kiểm kê và README có sẵn của module.
- `git ls-files`, `git log --oneline -n 20 -- <đường dẫn>`.
- Tên khoá của file cấu hình, chỉ bằng lệnh này:
  grep -oE '^[[:space:]]*[A-Za-z0-9_.-]+[[:space:]]*[:=]' <file> | sed -E 's/[[:space:]:=]+$//'
  Cần số dòng của tên khoá: dùng `grep -noE` với cùng mẫu, rồi cùng bước sed. Cấm `grep -n` không có `-o`: nó in cả dòng, kèm giá trị. Không thêm cờ hay lệnh nào in nội dung.

## Không được
- Đọc file cấu hình bằng Read, cat, head, tail, less, sed, Grep chế độ nội dung hay bất kỳ lệnh nào in nội dung. File cấu hình gồm: application*.yml, application*.yaml, application*.properties, bootstrap*.yml, .env và .env.*, appsettings*.json, *.pem, *.key, *.jks, *.p12, config.json chứa kết nối, docker-compose*.yml có khối environment, và mọi file trong thư mục resources có tên chứa secret, credential hoặc config.
- Mở pom.xml, build.gradle, settings.gradle: thông tin module và phụ thuộc lấy từ trường kiểm kê (declaredDeps), không từ file này.
- Ghi, sửa hay xoá file ngoài mục "Được ghi"; sửa code; chạy test hay build; commit, push.
- In giá trị của bất kỳ khoá nào, kể cả trong báo cáo. Gặp secret cứng trong code: ghi loại và `file:line`, không trích thêm dòng đó.
- Hỏi người dùng. Điều chưa rõ ghi vào `remaining_risks`.
- Viết "đảm bảo", "loại bỏ hoàn toàn", hay khẳng định không có bằng chứng.

## Được ghi
- Nhóm có một module đầy đủ: `<gốc>/<path của module>/README.md`.
- Module được giao làm một phần (module vượt trần): `.aip/runs/onboarding-<slug>/parts/<module>/<tên-phần>.md`. Không ghi README.md của module đó.
Không ghi file nào khác. Findings không ghi vào file: đưa vào `findings[]` của agent_result.

## Luật bằng chứng
- Mỗi mũi tên liên kết giữa module và mỗi số liệu cụ thể (port, version, tên biến, đường dẫn route, tên bảng) kèm `file:line`:
  - Viết liền trong một cặp backtick, đường dẫn tính từ gốc project, đúng một số nguyên sau dấu hai chấm. Không range (12-15), không danh sách (12,13), không dạng dòng:cột.
  - Phần trước dấu hai chấm có `.` hoặc `/`. File không đuôi viết `./Makefile:3`.
  - Không chắc số dòng thì không đoán. Ghi "suy từ tên" hoặc `[Unverified] <mô tả ngắn>`.
- Số liệu nằm trong file cấu hình: chỉ thấy tên khoá nên ghi `file:line` của tên khoá và `[Unverified] giá trị không đọc được`.
- Mũi tên có lời gọi thấy trong code: nét liền, kèm `file:line` của lời gọi.
- Mũi tên chỉ có trong declaredDeps: nét đứt, nhãn "chỉ khai báo".

## Mức đọc
- Bắt buộc, làm trước: README có sẵn của module (nếu có); liệt kê file nguồn bằng Glob; file điểm vào (tên chứa Application, Main, main, index, app, server, Program, hoặc khai báo route, controller, router); file có lời gọi tới module khác (tìm bằng Grep, chỉ lấy danh sách file).
- Mở rộng trong ngân sách: các file còn lại theo thư mục cấp một, ưu tiên file có lời gọi liên module.
- Ngân sách: tối đa 60 lần gọi công cụ, đếm từng lần. Khi còn 5 lần, ngừng đọc và viết phần đã có. Hết ngân sách: dừng, liệt kê file hoặc thư mục chưa đọc vào `not_read`.

## Đầu ra
Ghi file được phép, rồi trả khối agent_result (mẫu ở mục 5). Không in báo cáo dài.
```

## 2. Prompt ghép module vượt trần

```text
Bạn ghép các phần đã viết của một module thành README.md của module đó. Chỉ đọc file phần; chỉ ghi một file.

## Đầu vào
- Module: <id>, đường dẫn <path>, gốc project <đường dẫn tuyệt đối>
- Các file phần: <danh sách trong .aip/runs/onboarding-<slug>/parts/<module>/>
- Khung README: dán nguyên mục "Khung README module" của references/readme-structure.md.

## Được đọc
- Các file phần. Không mở mã nguồn để thêm thông tin; không đọc file cấu hình (luật như prompt nhóm module).

## Không được
- Thêm số liệu, mũi tên hay file:line không có trong phần.
- Gộp hai nội dung trái nhau: ghi cả hai, đánh dấu `[Unverified] mâu thuẫn giữa <phần A> và <phần B>`.
- Ghi file ngoài `<gốc>/<path>/README.md`. Hỏi người dùng.

## Đầu ra
Ghi README.md theo khung. Mục "Đã đọc / chưa đọc" liệt kê phần nào thiếu hoặc chưa đọc. Trả agent_result (mẫu ở mục 5).
```

## 3. Prompt tổng hợp README root và bốn file project-knowledge

```text
Bạn viết README.md ở gốc và bốn file project-knowledge của project <tên project>. Bạn chỉ đọc README của module và trường kiểm kê, không đọc lại toàn bộ code. Chỉ ghi các file ở mục "Được ghi".

## Đầu vào
- Gốc project: <đường dẫn tuyệt đối>
- Trường kiểm kê (JSON của inventory-modules.mjs): <dán>
- Đường dẫn README từng module: <danh sách>
- Ngôn ngữ: <tiếng Việt có dấu | khác>
- Lựa chọn cổng 1 cho file có sẵn: README.md gốc: <giữ | khối marker | bỏ>; project-overview.md, architecture.md, source-structure.md: <giữ | khối marker | bỏ>; tech-stack.yml: <giữ | bỏ>
- Khung và cách điền: mục "README root" và "Bốn file project-knowledge" của references/readme-structure.md (dán nguyên).
- Thư mục template: <thư mục skill artifact-templates>/references/project-knowledge/

## Được đọc
- README của từng module, trường kiểm kê, file template ở thư mục template, file có sẵn cần cho lựa chọn "khối marker".
- Không đọc mã nguồn và file cấu hình (luật như prompt nhóm module).

## Được ghi
- `<gốc>/README.md`
- `<gốc>/project-knowledge/project-overview.md`, `architecture.md`, `source-structure.md`, `tech-stack.yml`, chỉ những file theo lựa chọn cổng 1.
Không ghi file nào khác.

## Không được
- Thêm mũi tên giữa module không có trong README của module. Điều đó ghi vào `remaining_risks`.
- Viết version thư viện ngoài khi không có file:line; ghi `"[Unverified]"`.
- Để lại `<...>` của template trong file đầu ra. Chỗ không có bằng chứng ghi `[Unverified] <mô tả>`.
- In giá trị cấu hình; hỏi người dùng.

## Đầu ra
Ghi các file theo lựa chọn. Trả agent_result (mẫu ở mục 5).
```

## 4. Prompt reviewer

```text
Bạn kiểm README của một module trong project <tên project>. Chỉ đọc; không sửa file.

## Đầu vào
- README cần kiểm: <đường dẫn>
- Gốc project: <đường dẫn tuyệt đối>
- Lấy tối đa 10 số liệu cụ thể trong README (port, version, tên biến, route) và mọi mũi tên liên kết. Chọn theo thứ tự xuất hiện.

## Việc cần làm
- Mỗi mũi tên có `file:line`: mở đúng dòng đó và kết luận: đúng (dòng có lời gọi tới module được nêu), sai (dòng không có lời gọi đó), không xác minh được.
- Mỗi số liệu có `file:line`: mở đúng dòng và kết luận: đúng, sai, không xác minh được.
- Lệnh mở dòng: `sed -n '<n>p' <file>` với một số `<n>`. Chỉ với file mã nguồn.
- Số liệu nằm trong file cấu hình: không mở dòng, không in giá trị. Dùng `grep -noE '^[[:space:]]*[A-Za-z0-9_.-]+[[:space:]]*[:=]' <file>` (có `-o`) để xác nhận tên khoá có ở dòng đó; kết luận giá trị là "không xác minh được". Không dùng `grep -n` không có `-o`.

## Không được
- In giá trị cấu hình. Sửa README hoặc file khác. Chạy test hay build. Hỏi người dùng.
- Vượt 30 lần gọi công cụ. Hết ngân sách: dừng, ghi số mục chưa kiểm vào `not_read`.

## Đầu ra
Trả agent_result (mẫu ở mục 5). Mỗi kết luận "sai" hoặc "không xác minh được" là một mục `findings`, loại `trích-dẫn-sai` hoặc `không-xác-minh`, `label: proven` khi dòng đọc được mâu thuẫn, `suspected` khi chỉ nghi.
```

## 5. Mẫu agent_result

Khối này là kết quả duy nhất subagent trả. Trường `read` và `not_read` theo module; `findings` không chứa giá trị.

```yaml
agent_result:
  agent: general-purpose
  status: completed | blocked | failed
  summary: "<1–3 câu: module hoặc phần đã xong, số file đã ghi, số khẳng định [Unverified]>"
  changes:
    added: []
    modified: ["<README đã ghi hoặc phần đã ghi>"]
    deleted: []
  read: ["<file đã đọc, đường dẫn từ gốc; file cấu hình chỉ ghi 'tên khoá: <đường dẫn>'>"]
  not_read: ["<file hoặc thư mục chưa đọc, kèm lý do: ngân sách | cấu hình | không nhận dạng>"]
  findings:
    - loại: "private-key | cloud-key-id | jwt | url-credentials | secret-assignment | private-ip | trích-dẫn-sai | không-xác-minh"
      location: "<đường dẫn từ gốc:số dòng>"
      label: proven | suspected
  validation: ["<số lần gọi công cụ đã dùng>", "<số file:line đã trích; số đã mở lại dòng>"]
  questions: []
  remaining_risks: ["<phần chưa đọc, khẳng định dựa trên [Unverified], rủi ro log>"]
```

Loại bảo mật lấy đúng tên loại của `scan-secrets.mjs`. Không có trường giá trị.

## 6. Mục kiểm đầu ra ở session chính

- `changes` chỉ có đường dẫn trong danh sách đã giao. File ngoài danh sách: ghi tên, báo người dùng, giao lại đúng subagent đó kèm luật vi phạm, tối đa 2 lần. Không tự xoá.
- `read` có file cấu hình (mục "Không được" của prompt nhóm module): ghi vi phạm vào báo cáo cuối và coi kết quả nhóm đó là chưa tin cậy; giao lại nhóm đó nếu còn ngân sách.
- `status: blocked` có `questions[]`: session chính không trả lời thay người dùng. Nếu docs và request đã có đáp án thì giao lại kèm đáp án; nếu không thì đưa vào mục "Chưa kiểm" của báo cáo cuối.
- `not_read` không rỗng hoặc `remaining_risks` không rỗng: không phải lỗi; đưa vào báo cáo cuối.
- `validation` tự khai không đủ để tin. Sau khi mọi subagent xong, chạy `check-citations.mjs --root <gốc>` trên file Markdown đã ghi (kỳ vọng exit 0) và `scan-secrets.mjs` trên cùng các file (kỳ vọng exit 0). Khớp của scan-secrets thì sửa file, không nới script.
- `findings` ghi vào `.aip/runs/onboarding-<slug>/security-findings.md`, chỉ có loại, `file:line` và nhãn. Không chép giá trị vào file nào.
