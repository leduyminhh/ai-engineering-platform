# Thiết kế: spec sống theo năng lực (project P7)
- Ngày: 2026-10-21
- Trạng thái: đã duyệt 2026-10-21
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P7 (xu hướng 4, 5)

## Vấn đề và lý do

Mỗi request chỉ có `design.md` + `plan.md` và là bộ nhớ ngắn hạn "từ spec đến merge" (baseline, `#### Memory and resume`). Sau merge, hành vi của một năng lực rải trong nhiều design cũ; muốn biết "hooks-gates hiện làm gì" phải đọc ngược nhiều request. Gốc của việc này là quyết định của P1: superpowers sinh đúng hai file và aip không sửa plugin. aip chỉ tác động qua baseline `AGENTS.md`, template và validator.

Hướng giải (người dùng duyệt 2026-10-21): **giữ superpowers nguyên; aip thêm spec sống** để hành vi bền của từng năng lực nằm ở một file duy nhất, và thêm cầu nối từ `design.md` sang spec đó.

## Quyết định đã chốt

Của người dùng (2026-10-21):
- Spec sống ở `docs/specs/<năng-lực>/spec.md`, mỗi năng lực một file, sửa tại chỗ khi request đổi hành vi.
- Cho aip có 7 năng lực: `projection`, `install-lifecycle`, `hooks-gates`, `workflows`, `artifact-templates`, `baseline`, `cli-wizard`.
- Yêu cầu bị bỏ được giữ lại dạng gạch ngang kèm "đã bỏ bởi `<request>`"; ID không tái sử dụng.
- Việc gộp spec chỉ là bước cảnh báo (không chặn bằng hook trong project này; người dùng nói "làm luôn" với câu hỏi chặn hay cảnh báo, nên tôi lấy mặc định cảnh báo).
- Không viết lại các request cũ; spec sống của một năng lực tạo khi request kế tiếp chạm tới nó. Không đưa `tasks.md` lại luồng; `requirement.md` vẫn tùy chọn; không làm spec-as-source.

Của tôi (chưa duyệt, ghi là lựa chọn của tôi):
- Mỗi yêu cầu là một câu hành vi đo được; Given/When/Then vẫn nằm trong request (`AC<n>.<m>`), spec sống không chép lại AC.
- ID yêu cầu `<năng-lực>/R<n>`, tăng dần trong từng file.
- Validator đặt trong `check-request.mjs` (core, ship qua npm), không tạo script mới.
- Template spec nằm trong `artifact-templates` (loại mới `spec`), đích của `aip init --full` là `docs/specs/_TEMPLATE.md`.
- Validator không hard-code danh sách năng lực: năng lực hợp lệ là thư mục `docs/specs/<tên>/` có `spec.md`. Danh sách 7 năng lực của aip nằm trong `docs/specs/README.md` do người viết.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `core/skills/artifact-templates/`, Then có `references/spec.template.md` mở bằng khối `<!-- artifact-template … -->` (`type: spec`, `validator: scripts/check-request.mjs`, `sources`), và bảng mục lục trong `SKILL.md` có dòng loại `spec`.
- [ ] **AC1.2** — Given `spec.template.md`, Then có các mục `Mục đích`, `Phạm vi`, `Yêu cầu`, `Lịch sử`; dòng yêu cầu mẫu dạng `- **<năng-lực>/R1** — … Nguồn: [<slug>](…) (thêm)` và dòng mẫu yêu cầu bị bỏ dạng `- ~~**<năng-lực>/R2** — …~~ đã bỏ bởi [<slug>](…)`.
- [ ] **AC2.1** — Given `design.template.md`, Then có mục `## Ảnh hưởng spec` với hai dạng: `- <năng-lực>: thêm|đổi|bỏ R<n>` hoặc `Không ảnh hưởng: <lý do>`.
- [ ] **AC2.2** — Given `aip init --full` ở thư mục trống, Then có `docs/specs/_TEMPLATE.md` lấy từ `spec.template.md`, và `aip init` không ghi đè file đã có.
- [ ] **AC3.1** — Given `design.md` không có mục `Ảnh hưởng spec`, When chạy `check-request.mjs`, Then có cảnh báo `W10`, exit 0 (exit 1 khi `--strict`).
- [ ] **AC3.2** — Given mục `Ảnh hưởng spec` nêu năng lực `x` mà `docs/specs/x/spec.md` không tồn tại (suy từ `<request>/../../specs`), Then cảnh báo `W11`.
- [ ] **AC3.3** — Given mục nêu `đổi R<n>` hoặc `bỏ R<n>` mà spec không có ID `x/R<n>`, hoặc `bỏ` mà dòng đó chưa gạch ngang kèm "đã bỏ", Then cảnh báo `W12`.
- [ ] **AC3.4** — Given `--base <ref>` và `design.md` khai báo ảnh hưởng mà `docs/specs/x/spec.md` không đổi so với `<ref>`, Then cảnh báo `W13`; không có `--base` thì không chạy kiểm này.
- [ ] **AC3.5** — Given một spec được `design.md` tham chiếu, Then cảnh báo `W14` khi ID sai định dạng `<năng-lực>/R<n>`, ID trùng, tên năng lực không khớp thư mục chứa, hoặc link request trong bảng Lịch sử không tồn tại.
- [ ] **AC4.1** — Given baseline `core/agents/AGENTS.template.md`, Then mục `Docs location and format` có bước gộp spec trước `finishing-a-development-branch`: cập nhật `docs/specs/<năng-lực>/spec.md` theo `Ảnh hưởng spec`, thêm dòng vào Lịch sử, chạy `check-request.mjs`; và bảng bộ nhớ ghi spec sống là bộ nhớ dài hạn. `AGENTS.md` giữ byte-for-byte giống template.
- [ ] **AC4.2** — Given `CLAUDE.md` và README (EN/VI) của repo, Then mô tả `docs/specs/`, loại template `spec` và các cảnh báo W10–W14 ở đúng chỗ đã nêu về `check-request.mjs`.
- [ ] **AC5.1** — Given repo aip, Then có `docs/specs/README.md` liệt kê 7 năng lực, mỗi năng lực một dòng mô tả và đường dẫn dự kiến; chưa có `spec.md` nào.
- [ ] **AC6.1** — `npm test` xanh; bump version `core` (và plugin/workflow nào có nội dung chiếu đổi); `node cli/lib/versions.mjs --lock` cập nhật; `npm run pack:verify` xanh.

## Thiết kế

### 1. Template `spec` (core)

`spec.template.md` có khung đã chốt ở mục Quyết định: tiêu đề `# Spec: <năng-lực>`, dòng `Cập nhật`, các mục `Mục đích`, `Phạm vi` (gồm / không gồm), `Yêu cầu`, `Lịch sử` (bảng `Ngày | Request | ID | Thêm/đổi/bỏ`). `SKILL.md` của `artifact-templates` thêm một dòng mục lục; bảng validator ghi `scripts/check-request.mjs`. `cli/lib/templates.mjs` thêm cặp `['spec.template.md', 'docs/specs/_TEMPLATE.md']` vào danh sách `aip init`.

### 2. Cầu nối trong `design.md`

`design.template.md` thêm mục `## Ảnh hưởng spec` sau `Thiết kế`. Superpowers vẫn sinh `design.md`; mục này xuất hiện nhờ template của aip và baseline, không nhờ sửa plugin.

### 3. Validator

`check-request.mjs` (233 dòng, hiện W1–W9) thêm W10–W14 theo AC3.x. Quy tắc chung: chỉ cảnh báo, giữ nguyên hành vi exit, giữ zero-dep. Thư mục spec suy từ `path.resolve(<request-dir>, '..', '..', 'specs')`. Chỉ kiểm các spec mà `design.md` tham chiếu, nên request cũ không có mục này chỉ nhận W10. W13 gọi `git diff --name-only <ref>` và bỏ qua im lặng khi không có git.

### 4. Baseline và tài liệu

Mục `#### Docs location and format` thêm bước gộp spec (AC4.1) và bảng bộ nhớ thêm dòng spec sống ở tầng dài hạn. `AGENTS.md` chép lại từ template (test byte-for-byte có sẵn). `CLAUDE.md` (mục Adding capability content) và README nhắc `docs/specs/` và W10–W14.

### 5. Khởi tạo cho aip

`docs/specs/README.md` do người viết (AC5.1), không nằm trong template của `aip init`.

## Ngoài phạm vi và anti-goal

- Không backfill spec cho các request đã merge; không tạo `spec.md` nào trong project này.
- Không hook chặn (Stop gate hay SessionStart) cho việc gộp spec; nếu thực tế cho thấy bị bỏ sót thì mở project riêng.
- Không đổi `tasks.md`, `requirement.md`, workflow hay agent; không sửa plugin superpowers.
- Anti-goal: spec sống chép lại AC hoặc plan của request; một năng lực mà request nào cũng phải sửa hết mọi file.

## Ràng buộc

- Zero-dep, Node built-ins; tiếng Việt có dấu, UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*.
- `check-request.mjs` chạy được ở project đích chỉ với core; W13 không được làm lỗi khi không có git.
- Đổi nội dung chiếu thì bump version `core` và chạy `node cli/lib/versions.mjs --lock`; không bump plugin không đổi.
- Làm trên nhánh `feature/living-spec`, commit mỗi task qua `core:git-workflow`; không push.

## Kiểm thử

- AC3.1–AC3.5: test đơn vị cho `check-request.mjs` (bảng tham số hóa theo fixture thư mục request + specs), đặt cạnh test hiện có của script; tên test bắt đầu bằng ID AC.
- AC1.x, AC2.1: contract `test/contract/35-artifact-templates.contract.mjs` (thêm loại `spec`, mục trong design template).
- AC2.2: test init hiện có (`test/init.test.mjs`) thêm đích mới.
- AC4.1: test byte-for-byte của `AGENTS.md` có sẵn; một pin ngắn cho bước gộp spec trong baseline.
- AC4.2, AC5.1: kiểm đọc.
- AC6.1: `npm test`, `pack:verify`.

## Để builder quyết

- Cách phân tích mục `Ảnh hưởng spec` (regex theo dòng `- <năng-lực>: …`), miễn khớp mẫu ở AC2.1.
- Tên và vị trí hàm trong `check-request.mjs`; cách tách nếu file vượt cỡ.
- Cách đánh dấu "đã bỏ" nhận được ngoài `~~…~~` (ví dụ chỉ cần chuỗi "đã bỏ bởi") miễn nhất quán với AC1.2 và AC3.3.

## Rủi ro và câu hỏi mở

- [Inference] Chỉ cảnh báo nên agent có thể bỏ qua bước gộp mà không bị chặn; chưa đo mức tuân thủ thực tế. Giảm thiểu: W13 trong CI với `--strict`.
- Một năng lực lớn dần có thể cần tách; chưa có quy tắc đổi tên/tách năng lực (ID gắn tên năng lực). Hoãn đến khi gặp.
- Đã chốt cùng việc duyệt design: khi một request tạo năng lực mới (thư mục mới), bước gộp cập nhật cả `docs/specs/README.md`; ghi trong baseline (AC4.1).
