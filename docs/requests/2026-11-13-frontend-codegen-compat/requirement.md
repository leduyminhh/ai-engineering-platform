# Requirement: kiểm tương thích công cụ sinh code trước cổng G1

## Yêu cầu gốc

- **R1** — Skill `frontend-data-integration` PHẢI buộc, ở cổng I2 và trước khi đề xuất bất kỳ công cụ codegen nào (kể cả công cụ do người dùng nêu tên), đọc `peerDependencies` và `engines` của gói ở đúng phiên bản định dùng rồi so với phiên bản TypeScript và Node của project, và ghi kết quả vào ADR của công cụ đó; request không có ADR cho công cụ thì ghi vào `design.md` (hoặc `requirement.md` khi cỡ thay đổi nhỏ), mục rủi ro/giả định.
- **R2** — `references/contract-and-codegen.md` PHẢI nêu cách chạy thử một lệnh không ghi vào project để thấy xung đột peer, cách ghim phiên bản công cụ và phương án khi xung đột.
- **R3** — `workflow-feature` Bước 3 PHẢI buộc: giả định về công cụ hoặc thư viện mà hướng đã chọn dựa vào và kiểm được bằng một lệnh thì được kiểm trước G1, kết quả nằm trong `design.md` (hoặc `requirement.md` khi cỡ thay đổi nhỏ). Không kiểm được thì nêu ở G1 như rủi ro chặn hướng, không âm thầm giữ `[Unverified]`.
- **R4** — Khi công cụ xung đột với toolchain của project, người dùng chọn phương án ở G1 (không phải ở Task 1) và phương án đã chọn nằm trong ADR.

## Bối cảnh

Nguồn: mục N3 của [trial-report.md](../2026-11-13-frontend-trial/trial-report.md). Trial chạy `workflow-feature` trên project ngoài: tài liệu G1 ghi `openapi-typescript` là `[Unverified]` ("chưa chạy thử"), G1 và G2 được duyệt, ADR 0005, AC5.1/5.2, tên type và Task 1 đều dựa trên giả định đó. Task 1 mới lộ `ERESOLVE` (gói `openapi-typescript@7.13.0` khai peer `typescript@^5.x`, project dùng TypeScript 7.0.2) và crash `createKeywordTypeNode`. Phương án sửa buộc đổi ADR, ghi `Ruling:` và thêm `.gitignore`.

Hai điều đã đọc từ file và đã kiểm bằng lệnh khi lập request này (chi tiết ở `design.md`, mục Spike):

- Cổng I2 của `frontend-data-integration` chỉ chạy ở Bước 5 (task `FE-INT`), sau G1. Công cụ được chốt sớm hơn, ở Bước 2–3, khi `engineering-spec-analyst` viết `design.md`. Sửa riêng I2 thì kiểm đến sau cổng.
- `engineering-spec-writing` đã có quy tắc spike giả định `[Unverified]` trước checkpoint, nhưng `workflows/feature/WORKFLOW.md` Bước 3 chỉ nhắc builder check, không nhắc spike; trial không spike.

Trial chỉ đo thiếu bước kiểm sau khi công cụ đã chốt: tên `openapi-typescript` do prompt của người chạy trial nêu, nên không đo được việc plugin tự chọn công cụ. Nhãn `[Unverified]` ở trial đã đúng; lỗ hổng là nhãn đó không buộc kiểm trước cổng.

Không có API, không có contract (`docs/contracts/` không tồn tại), không có luồng e2e: thay đổi nằm hoàn toàn trong nội dung skill, reference và workflow.

## Ràng buộc

- Chỉ sửa: `plugins/frontend/skills/frontend-data-integration/SKILL.md` (mục I2), `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md`, `workflows/feature/WORKFLOW.md` (chỉ Bước 3). Không đụng file riêng của request N1 (`frontend-implement/`, `frontend-code-review/`) hay N2 (`workflows/bugfix/`, `frontend-fix/`).
- Không thêm script, không thêm dependency, không thêm bước vào `workflow-feature` (vẫn 7 bước, `graph.json` không đổi).
- Chỉ dẫn là lệnh đọc hoặc chạy thử không ghi vào project; không tự cài gì (giữ nguyên ranh giới "KHÔNG tự cài dependency" của skill).
- Đổi nội dung chiếu thì bump version: `plugins/frontend/.manifest.json`, `workflows/.manifest.json`, rồi `node cli/lib/versions.mjs --lock`.
- Tiếng Việt có dấu, UTF-8 không BOM, LF.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `SKILL.md` của `frontend-data-integration` When đọc mục I2 Then trước câu đề xuất codegen có bước đọc `peerDependencies` và `engines` của gói bằng `npm view <gói>@<phiên bản> peerDependencies engines --json`, so với phiên bản TypeScript (từ `package.json` và lockfile) và Node (`node --version`) của project; bước áp cho mọi công cụ codegen (`openapi-typescript`, `orval`, `openapi-generator`) kể cả công cụ người dùng nêu tên; kết quả (lệnh, khai báo, phiên bản project, kết luận) được ghi vào ADR của công cụ, hoặc vào `design.md`/`requirement.md` khi request không có ADR cho công cụ
- [ ] **AC1.2** — Given `SKILL.md` mục I2 When peer hoặc `engines` của công cụ xung đột với project Then phần "Đỏ khi" của I2 nêu dừng, không cài, trình phương án cho người dùng chọn; chưa có lựa chọn thì chưa viết ADR ở trạng thái Accepted
- [ ] **AC2.1** — Given `references/contract-and-codegen.md` When đọc Then có mục chạy thử `npm install --dry-run --ignore-scripts <gói>@<phiên bản>` trong thư mục tạm chứa bản sao `package.json` (và lockfile nếu có), nói rõ `ERESOLVE` với exit code khác 0 là xung đột, lệnh không sửa project; package manager khác npm thì phần chạy thử gắn `[Unverified]` và vẫn đọc khai báo bằng `npm view`
- [ ] **AC2.2** — Given `references/contract-and-codegen.md` When đọc Then có bảng phương án khi xung đột (ghim bằng `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z> <lệnh>`; đổi công cụ hoặc phiên bản công cụ; hạ TypeScript của project, ghi là ngoài phạm vi của skill) và ví dụ script `api:types` ghim phiên bản đủ `x.y.z`, không dùng `latest`, `^` hay dải; hai link `https://openapi-ts.dev/...` ở mục 3 vẫn còn (pin `03-frontend-data-integration` đòi có `https://`)
- [ ] **AC3.1** — Given `workflows/feature/WORKFLOW.md` When đọc Bước 3 Then Hành động buộc kiểm trước G1 mọi giả định công cụ hoặc thư viện còn `[Unverified]` mà kiểm được bằng một lệnh (spike của `engineering-spec-writing`), Gate yêu cầu kết quả đã nằm trong tài liệu hoặc được nêu ở G1 như rủi ro chặn hướng, Evidence có lệnh và kết quả; với công cụ codegen thì trỏ tới mục "Kiểm tương thích công cụ" của reference `contract-and-codegen` trong `frontend-data-integration` bằng tên reference, không viết đường dẫn `references/…` (đổi ở G3: `test/contract/50-workflows.contract.mjs` buộc mọi `references/<x>.md` nhắc trong workflow nằm trong references của chính workflow)
- [ ] **AC3.2** — Given `git diff master -- workflows/feature/WORKFLOW.md` When đối chiếu số dòng các hunk với mục `### Bước 3 — Tài liệu ⏸` Then mọi hunk nằm trong mục đó và chỉ trong các trường Hành động, Gate, Evidence (không chạm Thực hiện và Khi fail, vì `checkGraphAgainstBody` suy `run.agents`/`run.skills` từ Thực hiện và cạnh `on_fail` từ chữ "hỏi" và "quay lại Bước N" ở Khi fail); số bước vẫn là 7 và `checkGraphAgainstBody` không báo lỗi
- [ ] **AC4.1** — Given một lệnh kiểm không chạy được (không có mạng, không có `npm`, registry lỗi) When agent gặp giả định công cụ Then giả định giữ nhãn `[Unverified]` kèm lý do không kiểm được, và được nêu ở G1 như rủi ro chặn hướng; việc làm rõ và viết tài liệu không bị chặn
- [ ] **AC4.2** — Given bước gộp When cập nhật spec sống Then `docs/specs/workflows/spec.md` có `workflows/R25` mô tả bước spike công cụ ở Bước 3 và bước kiểm tương thích ở I2, kèm dòng `thêm` trong bảng Lịch sử trỏ tới request này; `check-request.mjs docs/requests/2026-11-13-frontend-codegen-compat/ --base master` không báo W10–W14
- [ ] **AC5.1** — Given thay đổi hoàn tất When chạy `npm run build`, `node cli/lib/versions.mjs --lock` và `npm test` Then version của `plugins/frontend` lớn hơn 1.16.3 và của `workflows` lớn hơn 3.16.2, `plugins/_versions.lock.json` khớp, `npm test` exit 0 gồm pin mới `test/content/54-codegen-compat.pin.mjs`
- [ ] **AC5.2** — Given thư mục tạm có `package.json` với `typescript` 7.0.2 When chạy hai lệnh được ghi ở AC2.1 và AC2.2 cho `openapi-typescript@7.13.0` Then `npm install --dry-run` exit 1 với `ERESOLVE` nêu `peer typescript@"^5.x"`, và lệnh `npx --yes -p typescript@5.9.3 -p openapi-typescript@7.13.0 openapi-typescript <contract> -o <file>` exit 0 và ghi file type (kiểm tay lúc kết thúc, cần mạng, không nằm trong `npm test`)
