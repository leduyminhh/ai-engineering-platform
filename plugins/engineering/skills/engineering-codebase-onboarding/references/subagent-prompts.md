# Prompt giao subagent

Session chính điền các chỗ `<…>` rồi giao mỗi prompt cho một subagent `general-purpose`. Session chính gọi Agent với `model: "sonnet"` cho mọi loại prompt dưới đây; prompt không đặt model vì đó là tham số lời gọi. Nếu Agent trả 404 với `sonnet`, bỏ trống `model` và ghi vào báo cáo cuối rằng subagent kế thừa model của session (tốn hơn).

Subagent không thấy skill này: mọi luật cần thiết được dán nguyên vào từng prompt. Một nhóm module một subagent. Tối đa 6 subagent chạy song song.

Các khối dùng chung (dán nguyên, không sửa chữ) nằm ở mục A, B, C, D. Mỗi prompt ở mục 1–4 đã ghi sẵn vị trí dán.

## Mục A. Luật file cấu hình (dán nguyên)

```text
## Luật file cấu hình
- Cấm Read, cat, head, tail, less, sed, awk, Grep chế độ nội dung, hoặc bất kỳ lệnh nào in nội dung của file cấu hình. File cấu hình gồm: application*.yml, application*.yaml, application*.properties, bootstrap*.yml, .env và .env.*, appsettings*.json, *.pem, *.key, *.jks, *.p12, config.json chứa kết nối, docker-compose*.yml có khối environment, và mọi file trong thư mục resources có tên chứa secret, credential hoặc config.
- Không mở pom.xml, build.gradle, settings.gradle. Thông tin module và phụ thuộc lấy từ trường kiểm kê (declaredDeps).
- Chỉ lấy tên khoá và số dòng bằng lệnh sau, không đổi, không thêm cờ. Đầu ra mỗi dòng chỉ là `<số dòng> <tên khoá>`:
  grep -nE '^[[:space:]]*[A-Za-z0-9_.-]{1,30}[[:space:]]*(:$|[:=][^=])' <file> | sed -E 's/^([0-9]+):[[:space:]]*([A-Za-z0-9_.-]+).*/\1 \2/' | grep -E '^[0-9]+ [A-Za-z0-9_.-]+$'
- Một file mỗi lần, không truyền nhiều file: với nhiều file, `grep` in tiền tố tên file, `sed` không bỏ được và dòng gốc (có giá trị) có thể lọt. Bộ lọc `grep -E` cuối chỉ giữ dòng dạng `<số> <khoá>`.
- Không dùng `grep -o` (hoặc `-oE`) cho việc này: `-o` in mọi ký tự nằm trong đoạn khớp, kể cả ký tự đầu của giá trị. Không đưa ký tự giá trị vào mẫu. Dòng gốc chỉ đi vào pipe; đầu ra chỉ có số dòng và tên khoá.
- Không in ký tự giá trị: lệnh không dùng `-o`, và `sed` bỏ mọi thứ sau khoá. `[^=]` sau dấu phân cách chỉ loại dòng có `=` đệm base64 (`...=`, `...==`), không lấy giá trị; ký tự nó khớp không được in. Khoá quá 30 ký tự, khoá có dấu nháy kép (JSON), và dòng không khớp: ghi vào `not_read` với lý do "cấu hình".
- `sed` chỉ nhận đầu vào từ pipe của `grep` ở trên. Không đưa tên file cấu hình cho `sed`.
- Gặp giá trị bí mật trong mã nguồn: ghi loại và `file:line`, không trích thêm dòng đó.
```

## Mục B. Luật bằng chứng (dán nguyên)

```text
## Luật bằng chứng
- Mỗi mũi tên liên kết giữa module và mỗi số liệu cụ thể (port, version, tên biến, đường dẫn route, tên bảng) kèm `file:line`:
  - Viết liền trong một cặp backtick, đường dẫn tính từ gốc project, đúng một số nguyên sau dấu hai chấm. Không range (12-15), không danh sách (12,13), không dạng dòng:cột.
  - Phần trước dấu hai chấm có `.` hoặc `/`. File không đuôi viết `./Makefile:3`.
  - Không chắc số dòng thì không đoán. Ghi "suy từ tên" hoặc `[Unverified] <mô tả ngắn>`.
- Số liệu nằm trong file cấu hình: chỉ thấy tên khoá, nên ghi `file:line` của tên khoá và `[Unverified] giá trị không đọc được`.
- Mũi tên có lời gọi thấy trong code: nét liền, kèm `file:line` của lời gọi.
- Mũi tên chỉ có trong declaredDeps: nét đứt, nhãn "chỉ khai báo".
- Không viết "đảm bảo", "loại bỏ hoàn toàn", hay khẳng định không có bằng chứng.
```

## Mục C. Luật file có sẵn (dán nguyên)

```text
## Luật file có sẵn
Cổng 1 đã chọn cho mỗi file có sẵn một lựa chọn: giữ | khối marker | bỏ. Không ghi đè file có sẵn trong mọi trường hợp.
- Giữ: không đụng file; không đưa file đó vào `changes`.
- Khối marker: file phải có đúng một cặp marker:
  <!-- aip:onboarding begin -->
  ...nội dung do skill ghi...
  <!-- aip:onboarding end -->
  Chỉ thay phần giữa hai marker, giữ nguyên hai dòng marker. Không có cặp marker: thêm khối vào cuối file, không sửa phần trên.
  Chỉ có begin mà thiếu end, chỉ có end mà thiếu begin, hoặc có nhiều hơn một cặp: dừng, trả `status: blocked`, không ghi file đó.
- Bỏ: không tạo file này trong lần chạy. File có sẵn không bị sửa hay xoá.
- tech-stack.yml chỉ có giữ hoặc bỏ, không dùng marker.
```

## Mục D. Khối agent_result (dán nguyên, subagent phải trả đúng khối này)

```text
## Đầu ra
Ghi các file được phép, rồi trả đúng một khối sau. Không in báo cáo dài. Không đưa giá trị cấu hình vào bất kỳ trường nào.

agent_result:
  agent: general-purpose
  status: completed | blocked | failed
  summary: "<1–3 câu: phần đã xong, số file đã ghi, số khẳng định [Unverified]>"
  changes:
    added: []
    modified: ["<file đã ghi>"]
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
```

## Mục E. Luật lệnh, Dockerfile và CI (dán nguyên)

```text
## Luật lệnh, Dockerfile và CI
- Lệnh trong README (cách chạy, build, test): thay mọi phần gán biến môi trường đứng trước lệnh (`TÊN=<giá-trị> lệnh`) bằng `<TÊN>`; không chép giá trị.
- Dockerfile: chỉ chép dòng `RUN` có lệnh build hoặc test, `CMD` và `ENTRYPOINT`. Không chép dòng `ENV`, `ARG`, hay cờ `--build-arg` và `-e` có giá trị.
- File CI: chỉ chép dòng `run` có lệnh build hoặc test. Không chép khối `env`, `with`, hay mọi khối có giá trị.
- Dockerfile và file CI có thể đọc bằng Read. Giá trị trong đó không được chép vào bất kỳ file hay trường nào; ghi `"Read đưa giá trị trong <tên file> vào log phiên"` vào `remaining_risks`.
```

## 1. Prompt nhóm module

```text
Bạn đọc code của một nhóm module trong project <tên project> để viết README từng module. Chỉ đọc code; chỉ ghi các file ở mục "Được ghi".

## Đầu vào
- Gốc project: <đường dẫn tuyệt đối>
- Nhóm: <tên nhóm>. Module trong nhóm: <id → path, …>
- Trường kiểm kê của từng module (từ inventory-modules.mjs): <dán JSON, gồm buildFile, sourceFiles, testFiles, declaredDeps, hasReadme>
- Lựa chọn cổng 1 cho README có sẵn của từng module có hasReadme true: <id → giữ | khối marker | bỏ>
- Ngôn ngữ README: <tiếng Việt có dấu | ngôn ngữ khác>
- Khung README: dán nguyên mục "Khung README module" của references/readme-structure.md.

## Được đọc
- Glob, Grep (chỉ liệt kê tên file hoặc đếm), Read với file mã nguồn có đuôi trong trường kiểm kê, README có sẵn của module, và Dockerfile hoặc file CI của module (theo mục E).
- `git ls-files`, `git log --oneline -n 20 -- <đường dẫn>`.
- Lệnh lấy tên khoá theo mục A, bắt buộc cho mục 5 của mức đọc; không dùng cách nào khác để mở file cấu hình.

## Không được
- Ghi, sửa hay xoá file ngoài mục "Được ghi"; sửa code; chạy test hay build; commit, push.
- Hỏi người dùng. Điều chưa rõ ghi vào `remaining_risks`.

## Được ghi
- Với mỗi module đầy đủ trong nhóm: `<gốc>/<path của module>/README.md`.
- Với module được giao làm một phần (module vượt trần): `.aip/runs/onboarding-<slug>/parts/<module>/<tên-phần>.md`. Không ghi README.md của module đó.
- README có sẵn (hasReadme true): chỉ ghi theo lựa chọn ở đầu vào và luật file có sẵn (mục C).
Không ghi file nào khác. Findings không ghi vào file; đưa vào `findings[]` của agent_result.

## Mức đọc
- Dán nguyên mục "Mức đọc" của references/scope-and-budget.md: bảy mục bắt buộc làm trước, mở rộng trong ngân sách, ngân sách 60 lần gọi. Luật lệnh, Dockerfile và CI: dán nguyên mục E ở trên.

<dán nguyên mục A>

<dán nguyên mục B>

<dán nguyên mục C>

<dán nguyên mục D>
```

## 2. Prompt ghép module vượt trần

```text
Bạn ghép các phần đã viết của một module thành README.md của module đó. Chỉ đọc file phần; chỉ ghi một file.

## Đầu vào
- Module: <id>, đường dẫn <path>, gốc project <đường dẫn tuyệt đối>
- Các file phần: <danh sách trong .aip/runs/onboarding-<slug>/parts/<module>/>
- Lựa chọn cổng 1 cho README có sẵn: <giữ | khối marker | bỏ>
- Khung README: dán nguyên mục "Khung README module" của references/readme-structure.md.

## Được đọc
- Các file phần. Không mở mã nguồn để thêm thông tin. Không đọc file cấu hình.

## Không được
- Thêm số liệu, mũi tên hay file:line không có trong phần.
- Gộp hai nội dung trái nhau: ghi cả hai và đánh dấu `[Unverified] mâu thuẫn giữa <phần A> và <phần B>`.
- Ghi file ngoài `<gốc>/<path>/README.md`. Hỏi người dùng.

## Được ghi
- `<gốc>/<path>/README.md`, theo luật file có sẵn (mục C) với lựa chọn ở đầu vào.

Mục "Đã đọc / chưa đọc" liệt kê phần nào thiếu hoặc chưa đọc.

<dán nguyên mục B>

<dán nguyên mục C>

<dán nguyên mục D>
```

## 3. Prompt tổng hợp README root và bốn file project-knowledge

```text
Bạn viết README.md ở gốc và bốn file project-knowledge của project <tên project>. Bạn chỉ đọc README của module và trường kiểm kê, không đọc lại code. Chỉ ghi các file ở mục "Được ghi".

## Đầu vào
- Gốc project: <đường dẫn tuyệt đối>
- Trường kiểm kê (JSON của inventory-modules.mjs): <dán>
- Đường dẫn README từng module: <danh sách>
- Ngôn ngữ: <tiếng Việt có dấu | khác>
- Lựa chọn cổng 1 cho file có sẵn: README.md gốc: <giữ | khối marker | bỏ>; project-overview.md, architecture.md, source-structure.md: <giữ | khối marker | bỏ>; tech-stack.yml: <giữ | bỏ>
- Khung và cách điền: dán nguyên mục "Khung README root" và "Bốn file project-knowledge" của references/readme-structure.md. Luật lệnh trong README: dán nguyên mục E.
- Thư mục template: <thư mục skill artifact-templates>/references/project-knowledge/

## Được đọc
- README của từng module, trường kiểm kê, file template ở thư mục template, file có sẵn cần cho lựa chọn "khối marker".
- Không đọc mã nguồn. Không đọc file cấu hình.

## Không được
- Thêm mũi tên giữa module không có trong README của module; ghi vào `remaining_risks`.
- Viết version thư viện ngoài khi không có file:line; ghi `"[Unverified]"`.
- Để lại `<...>` của template trong file đầu ra; chỗ không có bằng chứng ghi `[Unverified] <mô tả>`.
- In giá trị cấu hình. Hỏi người dùng.

## Được ghi
- `<gốc>/README.md`
- `<gốc>/project-knowledge/project-overview.md`, `architecture.md`, `source-structure.md`, `tech-stack.yml`, chỉ những file theo lựa chọn cổng 1.
Không ghi file nào khác.

<dán nguyên mục A>

<dán nguyên mục B>

<dán nguyên mục C>

<dán nguyên mục D>
```

## 4. Prompt reviewer

```text
Bạn kiểm README của một module trong project <tên project>. Chỉ đọc; không sửa file.

## Đầu vào
- README cần kiểm: <đường dẫn>
- Gốc project: <đường dẫn tuyệt đối>
- Lấy tối đa 10 số liệu cụ thể trong README (port, version, tên biến, route) và mọi mũi tên liên kết, theo thứ tự xuất hiện.

## Việc cần làm
- Mỗi mũi tên có `file:line`: mở đúng dòng và kết luận: đúng (dòng có lời gọi tới module được nêu), sai (dòng không có lời gọi đó), không xác minh được.
- Mỗi số liệu có `file:line`: mở đúng dòng và kết luận: đúng, sai, không xác minh được.
- Mở dòng mã nguồn: `sed -n '<n>p' <file>` với một số `<n>`. Chỉ áp dụng cho file mã nguồn.
- Số liệu nằm trong file cấu hình: không mở dòng, không in giá trị; dùng lệnh tên khoá theo mục A để xác nhận tên khoá có ở dòng đó; kết luận giá trị là "không xác minh được".

## Không được
- Sửa README hoặc file khác. Chạy test hay build. Hỏi người dùng.
- Vượt 30 lần gọi công cụ [giả định]. Hết ngân sách: dừng và ghi số mục chưa kiểm vào `not_read`.

## Đầu ra
Mỗi kết luận "sai" hoặc "không xác minh được" là một mục `findings`, loại `trích-dẫn-sai` hoặc `không-xác-minh`; `label: proven` khi dòng đọc được mâu thuẫn, `suspected` khi chỉ nghi.

<dán nguyên mục A>

<dán nguyên mục B>

<dán nguyên mục D>
```

## 5. Mục kiểm đầu ra ở session chính

- `changes` chỉ có đường dẫn trong danh sách đã giao. File ngoài danh sách: ghi tên, báo người dùng, giao lại đúng subagent đó kèm luật vi phạm, tối đa 2 lần. Không tự xoá.
- `read` có file cấu hình: ghi vi phạm vào báo cáo cuối, coi kết quả nhóm đó là chưa tin cậy, giao lại nhóm đó nếu còn ngân sách.
- `status: blocked` có `questions[]`: session chính không trả lời thay người dùng. Nếu docs và request đã có đáp án thì giao lại kèm đáp án; nếu không thì đưa vào mục "Chưa kiểm" của báo cáo cuối.
- `status: blocked` do lệch cặp marker: báo người dùng, không ghi file đó.
- `not_read` không rỗng hoặc `remaining_risks` không rỗng: không phải lỗi; đưa vào báo cáo cuối.
- `validation` tự khai không đủ để tin. Sau khi mọi subagent xong, chạy bước 6(a) và 6(b) của SKILL.md trên các file đã ghi, có nhánh `not_run` khi thiếu check-citations; kỳ vọng exit 0 của scan-secrets. Khớp của scan-secrets thì sửa file, không nới script.
- `findings` loại bảo mật (loại trùng tên của `scan-secrets.mjs`) ghi vào `.aip/runs/onboarding-<slug>/security-findings.md`, chỉ có loại, `file:line` và nhãn. Loại `trích-dẫn-sai` và `không-xác-minh` ghi vào báo cáo cuối, không vào file đó. Không chép giá trị vào file nào.
