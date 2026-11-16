# Requirement: siết bảo mật và độ chính xác của chỉ dẫn kiểm tương thích công cụ codegen (N3b)

## Yêu cầu gốc

- **R1** — Câu spike giả định ở `workflow-feature` Bước 3 PHẢI nêu ranh giới chỉ đọc: spike chỉ đọc hoặc chạy thử trong thư mục tạm, không cài vào project, không `npx --yes` gói chưa được người dùng duyệt.
- **R1b** — Quy tắc "Spike giả định" của `engineering-spec-writing` (bước 9 của `SKILL.md`) PHẢI nêu cùng ranh giới cho giả định về công cụ hoặc thư viện, để spike chạy ngoài `workflow-feature` cũng không cài vào project hay `npx --yes` gói chưa được duyệt (người dùng chọn ở G1, 2026-11-13).
- **R2** — Mục 2a của `references/contract-and-codegen.md` (chạy thử `npm install --dry-run`) PHẢI dặn không sao chép `.npmrc` hay file chứa token sang thư mục tạm; PHẢI nêu khi nào kết quả chạy thử không dùng được (coi như không chạy được, giữ `[Unverified]`, nêu ở G1); PHẢI nói `EBADENGINE` chỉ là cảnh báo không đổi exit code.
- **R3** — Tên gói gắn với lệnh `npm view` hoặc `npx` trong danh sách ứng viên codegen PHẢI là `@openapitools/openapi-generator-cli`, không phải `openapi-generator` (gói unscoped là gói khác).
- **R4** — Mục 3 của reference PHẢI chọn một mặc định cho ca không xung đột peer và ví dụ script PHẢI nhất quán với mặc định đó; câu về `npm audit` và `npx` PHẢI được kiểm bằng lệnh hoặc gắn `[Inference]`.
- **R5** — Pin `test/content/54-codegen-compat.pin.mjs` PHẢI ghim các ranh giới trên để chúng không bị sửa mất âm thầm.

## Bối cảnh

Request nền: [2026-11-13-frontend-codegen-compat](../2026-11-13-frontend-codegen-compat/design.md) (N3, nhánh `claude/frontend-codegen-compat-f9538e`, HEAD `cb9ecb86`, chưa merge). Review cuối và audit của N3 tìm ra năm điểm nhỏ về bảo mật và độ chính xác; người dùng chọn xử lý ở request riêng (mục "Quyết định khi thực thi và còn mở (G3)" của design N3). Request này làm trên nhánh cắt từ N3, nên sửa lên chính các dòng N3 vừa thêm.

Đã kiểm bằng lệnh trong phiên lập request này (Node v24.16.0, npm 11.13.0, 2026-11-13; chi tiết và lệnh chạy lại ở `design.md`, mục Spike):

- Gói unscoped `openapi-generator` (0.1.39, bin `openapi-generator`) khác gói `@openapitools/openapi-generator-cli` (2.42.2, `engines.node >=22.0.0`).
- `npm install --dry-run --ignore-scripts` với gói không tồn tại thoát exit 1 với `E404`, không phải `ERESOLVE`.
- Bản sao `package.json` có `workspaces` hoặc dependency `file:` trỏ tới thư mục không có trong bản sao: dry-run vẫn exit 0 (ở dependency `file:` còn in `add local-lib undefined`). Chưa tái hiện được `ENOENT` mà ghi chú review nêu; rủi ro thực là kết quả xanh nhưng cây phụ thuộc khác project.
- `EBADENGINE` chỉ in `npm warn`, exit 0 (kiểm với một gói cục bộ giả khai `engines.node >=99.0.0`).
- `npm install --save-dev --save-exact <gói>@<x.y.z>` ghi `"<gói>": "<x.y.z>"` không có `^` vào `devDependencies` (kiểm với `--package-lock-only`).

Chưa kiểm được: câu "`npm audit` không thấy gói chạy bằng `npx`". Lệnh `npx --yes` chạy thử bị bộ phân loại quyền của phiên từ chối, và đó đúng là loại hành vi mục 1 muốn cấm, nên không chạy lại; câu này gắn `[Inference]`.

Cỡ việc: dự án nhỏ, ba file nội dung, hai bump version, một pin, không thêm bước vào workflow, không đổi `graph.json`.

## Ràng buộc

- Chỉ sửa: `workflows/feature/WORKFLOW.md` (chỉ Bước 3, chỉ các trường Hành động, Gate, Evidence), `plugins/engineering/skills/engineering-spec-writing/SKILL.md` (chỉ đoạn "Spike giả định" ở bước 9), `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md`, `plugins/frontend/skills/frontend-data-integration/SKILL.md` (chỉ mục I2, và chỉ khi nó nhắc tên công cụ gắn với lệnh), `test/content/54-codegen-compat.pin.mjs`, `docs/specs/workflows/spec.md` (R25), hai `.manifest.json` và `plugins/_versions.lock.json`. Không đụng file riêng của N1 (`frontend-implement/`, `frontend-code-review/`) và N2 (`workflows/bugfix/`, `frontend-fix/`).
- Ở Bước 3 không thêm `skill`/`agent` vào Thực hiện, không thêm chữ "hỏi" hay "quay lại Bước N" vào Khi fail (`checkGraphAgainstBody` suy graph từ hai trường đó); không viết `references/<x>.md` trong backtick (contract `test/contract/50-workflows.contract.mjs`).
- Không thêm script, dependency hay bước; giữ ranh giới "KHÔNG tự cài dependency" của skill: thêm dependency vẫn phải hỏi người dùng trước.
- Lệnh trong chỉ dẫn chỉ dùng `npm`, `npx`, `node`, chạy được trên Windows và POSIX.
- Tiếng Việt có dấu, UTF-8 không BOM, LF.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `workflows/feature/WORKFLOW.md` When đọc trường Hành động của Bước 3 Then câu spike nêu cả ba ý: chỉ đọc hoặc chạy thử trong thư mục tạm, không cài vào project, không `npx --yes` gói chưa được người dùng duyệt
- [ ] **AC1.2** — Given `git diff cb9ecb86 -- workflows/feature/WORKFLOW.md` When đối chiếu số dòng các hunk với mục `### Bước 3` Then mọi hunk nằm trong Hành động, Gate hoặc Evidence của Bước 3; số bước vẫn 7; `checkGraphAgainstBody` không báo lỗi; không có chuỗi `references/` mới trong file
- [ ] **AC1.3** — Given `engineering-spec-writing/SKILL.md` When đọc đoạn "Spike giả định" ở bước 9 Then có câu nêu: giả định về công cụ hoặc thư viện chỉ kiểm bằng lệnh đọc hoặc chạy thử trong thư mục tạm, không cài vào project, không `npx --yes` hay chạy gói chưa được người dùng duyệt, và không kiểm được trong ranh giới đó thì nêu ở checkpoint như rủi ro chặn hướng; pin `test/content/43-progress-plan-quality.pin.mjs` vẫn xanh; chỉ đoạn này đổi
- [ ] **AC2.1** — Given mục 2a của reference When đọc phần chạy thử Then dặn chỉ chép `package.json` và lockfile, không chép `.npmrc`, `.yarnrc*`, `.env` hay file nào khác chứa token hoặc thông tin đăng nhập registry
- [ ] **AC2.2** — Given mục 2a When đọc phần chạy thử Then nêu các ca kết quả không dùng được, coi như không chạy được, giữ `[Unverified]` kèm lý do và nêu ở G1: (a) exit khác 0 mà mã lỗi không phải `ERESOLVE` (vd `E401`, `E404`); (b) `package.json` có `workspaces` hoặc dependency trỏ vào đường dẫn cục bộ (`file:`, `link:`) vì bản sao không chứa chúng nên cây khác project dù exit 0
- [ ] **AC2.3** — Given mục 2a When đọc Then nói `EBADENGINE` là cảnh báo, không đổi exit code, nên kết luận về `engines` lấy từ lệnh `npm view` ở bước đọc khai báo (đọc thêm stderr của dry-run để thấy cảnh báo), không từ exit code của dry-run
- [ ] **AC3.1** — Given `references/contract-and-codegen.md` và mục I2 của `SKILL.md` When tìm tên `openapi-generator` Then trong danh sách ứng viên gắn với `npm view`/`npx` (mục 2a của reference, dòng "Kiểm tương thích trước khi đề xuất" của I2) chỉ còn `@openapitools/openapi-generator-cli`; tên cũ chỉ còn ở bảng dò dấu hiệu (mục 2) và dòng dò stack của mục 0 trong `SKILL.md`; không file nào dưới `plugins/frontend/` có README nhắc tên này
- [ ] **AC4.1** — Given mục 3 của reference When đọc Then có đúng một mặc định cho ca không xung đột peer: cài vào `devDependencies` đúng `x.y.z` bằng `npm install --save-dev --save-exact <gói>@<x.y.z>` sau khi người dùng đồng ý, và ví dụ script `api:types` gọi gói đã cài, không dùng `npx`; dạng `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z>` chỉ còn như phương án khi mục 2a báo xung đột peer và người dùng đã chọn ghim
- [ ] **AC4.2** — Given reference When tìm câu về `npm audit` và gói chạy bằng `npx` Then câu đó có nhãn `[Inference]` ở đầu câu (hoặc có lệnh kiểm kèm kết quả), và chỉ xuất hiện một lần
- [ ] **AC5.1** — Given `test/content/54-codegen-compat.pin.mjs` When chạy `node test/validate.mjs --only codegen-compat` Then exit 0 và pin kiểm: chuỗi liền `npm install --dry-run --ignore-scripts` (chuẩn hoá khoảng trắng, không khớp token rời) và cụm `không ghi vào project` trong mục 2a; Hành động của Bước 3 (tách bằng `parseSteps`) và đoạn "Spike giả định" của `engineering-spec-writing` đều có `thư mục tạm`, `không cài vào project` và `` `npx --yes` ``; mục 2a có `.npmrc`, `EBADENGINE` và `@openapitools/openapi-generator-cli`; ngoài bảng dò, mục 2a và I2 không còn token `openapi-generator` đứng riêng
- [ ] **AC5.2** — Given pin cũ về script `api:types` When mặc định mục 3 đổi Then pin được sửa theo mặc định mới (script mặc định không chứa `npx`; dạng `npx` ghim `<gói>@<x.y.z>` đủ ba số) và không còn kiểm chữ thừa so với AC4.1
- [ ] **AC6.1** — Given thay đổi hoàn tất When chạy `npm run build`, `node cli/lib/versions.mjs --lock` và `npm test` Then `plugins/frontend/.manifest.json` lớn hơn 1.16.5, `workflows/.manifest.json` lớn hơn 3.16.3 và `plugins/engineering/.manifest.json` lớn hơn 2.15.0, `plugins/_versions.lock.json` khớp, `npm test` exit 0
- [ ] **AC6.2** — Given bước gộp When cập nhật spec sống Then `docs/specs/workflows/spec.md` có R26 nêu thêm ranh giới chỉ đọc của spike và dòng `đổi` trong bảng Lịch sử trỏ tới request này; `check-request.mjs docs/requests/2026-11-13-frontend-codegen-compat-harden/ --base master` không báo W10–W14
