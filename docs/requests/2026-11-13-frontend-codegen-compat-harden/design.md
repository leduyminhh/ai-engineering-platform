# Thiết kế: siết bảo mật và độ chính xác của chỉ dẫn kiểm tương thích công cụ codegen (N3b)
- Ngày: 2026-11-13
- Trạng thái: merged 296824fa
- Requirement: [requirement.md](requirement.md)

## Vấn đề và lý do

N3 ([2026-11-13-frontend-codegen-compat](../2026-11-13-frontend-codegen-compat/design.md)) buộc kiểm tương thích công cụ codegen trước G1. Review cuối và audit của N3 để lại năm điểm; người dùng chọn xử lý ở request riêng. Đã đọc code nền ở HEAD `cb9ecb86`:

1. `workflows/feature/WORKFLOW.md:100–104` (Bước 3, Hành động): câu spike nói "kiểm trước checkpoint" nhưng không nói spike được làm gì. `engineering-spec-writing/SKILL.md:120–125` mô tả spike là "một test hoặc script nhỏ, chạy được trong repo", nên người đọc câu ở Bước 3 có thể hiểu là được cài thử vào project hoặc `npx --yes` một gói chưa ai duyệt, trước cả G1.
2. `references/contract-and-codegen.md:34–38` (mục 2a, bước 2): chép `package.json` sang thư mục tạm mà không nói gì về `.npmrc`; coi `ERESOLVE` là tín hiệu duy nhất; không nói `EBADENGINE`.
3. Cùng file, dòng 23 và 28; `SKILL.md:57` và `:84`: tên `openapi-generator` đi cùng danh sách ứng viên gắn với lệnh `npm view`/`npx`.
4. Cùng file, mục 3 (dòng 53–66): ví dụ script dùng `npx --yes openapi-typescript@<x.y.z>`, trong khi dòng 65 nói "ưu tiên cài vào `devDependencies`"; câu `npm audit` lặp ở dòng 47 và 64.
5. `test/content/54-codegen-compat.pin.mjs`: khớp token rời (`--dry-run`, `--ignore-scripts`), không ghim chuỗi liền; không ghim "không ghi vào project"; Bước 3 chỉ ghim chữ `spike`, `[Unverified]`, `G1`.

## Quyết định đã chốt

Từ N3, không hỏi lại: kiểm tương thích bắt buộc có lối thoát (`[Unverified]` + nêu ở G1); áp mọi công cụ codegen; lệnh chứ không script; pin nội dung, không eval. Năm mục và cách chốt từng mục do người dùng giao ở brief; mục "Thiết kế" dưới đây chỉ cụ thể hoá. Hướng đã cân nhắc: không có hướng thay thế đáng kể, năm mục là sửa chữ trên các dòng đã có.

### Quyết định của agent (sửa khi duyệt)

- **D1 — mục 2 của brief: coi "không dùng được" theo nội dung `package.json`, không theo exit code.** Brief nêu "ENOENT với `workspaces` hoặc dependency `file:`"; đã thử cả hai ca và dry-run vẫn exit 0 (xem Spike 2, 3), nên luật dựa trên mã lỗi sẽ không bao giờ kích hoạt. Luật dựa trên `package.json` (có `workspaces` hoặc dependency `file:`/`link:`) bao trùm ca brief lo. Mã lỗi `E401`/`E404` vẫn nằm trong luật (a); `E404` đã kiểm, `E401` chưa (`[Unverified]`, cần registry yêu cầu đăng nhập).
- **D2 — `EBADENGINE` kiểm bằng bước đọc khai báo.** Dry-run in cảnh báo nhưng exit 0 (Spike 4), nên chỉ dẫn nói rõ kết luận `engines` lấy từ `npm view … engines`, còn stderr của dry-run chỉ để đối chiếu.
- **D3 — một mặc định: `devDependencies` đúng `x.y.z`.** Kiểm bằng `--save-exact` (Spike 5). `npx` chỉ còn là phương án khi mục 2a báo xung đột peer và người dùng đã chọn ghim. Câu `npm audit` chuyển hẳn vào dòng phương án `npx` (bỏ bản lặp ở mục 3) và gắn `[Inference]`, vì ca mặc định đã nằm trong `package.json` nên audit thấy được.
- **D4 — `SKILL.md:57` (dòng dò stack ở mục 0) giữ nguyên.** Đó là danh sách tên để dò dấu hiệu trong `package.json`, cùng loại với bảng dò mục 2; chỉ dòng 84 (I2, gắn với `npm view`) đổi. README: grep không thấy file nào dưới `plugins/frontend/` nhắc tên này, nên không có gì để sửa.
- **D5 — hệ quả của mục 1 cần biết:** spike ở Bước 3 chạy trước G1, tức là trước khi người dùng duyệt công cụ, nên chỉ được dùng `npm view` và `npm install --dry-run --ignore-scripts` (không thực thi mã của gói). Lần chạy thật công cụ (kiểu Spike 3 của N3: `npx --yes -p …`) chỉ làm được sau khi người dùng chọn ghim, tức là ở hoặc sau G1. Không có AC nào của N3 phụ thuộc lần chạy đó trước G1 (AC5.2 của N3 là kiểm tay của người bảo trì).

### Đã chốt ở G1

**Q1 — ranh giới chỉ-đọc đặt ở cả `engineering-spec-writing` (quy tắc "Spike giả định", `SKILL.md:120–125`) và workflow Bước 3** (người dùng chọn 2026-11-13, trái với khuyến nghị ban đầu của agent là chỉ workflow). Hệ quả đã tính: đổi thêm plugin `engineering` (bump version, AC1.3, mục 7 dưới đây); câu mới chỉ áp cho giả định về công cụ hoặc thư viện, không đổi định nghĩa spike "test hoặc script nhỏ chạy được trong repo" cho các loại giả định khác, nên không mâu thuẫn với nó. Pin `43-progress-plan-quality` đòi đoạn spike có `[Unverified]`, `hướng đã chọn`, `trước checkpoint`: câu thêm không được làm mất ba cụm đó.

## Thiết kế

Năm file nội dung và một pin; không thêm bước, không đổi `graph.json`.

**1. `workflows/feature/WORKFLOW.md` Bước 3, Hành động (AC1.1).** Thêm vào câu spike, ngay sau "kiểm được bằng một lệnh (…)": "Spike chỉ đọc hoặc chạy thử trong thư mục tạm, không cài vào project, không `npx --yes` hay chạy gói chưa được người dùng duyệt;". Gate: thêm "kiểm theo ranh giới chỉ đọc đó" vào vế "đã có kết quả spike" (một cụm). Evidence: không cần đổi (đã có "lệnh spike + kết quả"). Không chạm Thực hiện, Khi fail.

**2. `contract-and-codegen.md` mục 2a, bước 2 (AC2.1–2.3, D1, D2).** Sửa bước "Chạy thử" thành: sao chép **chỉ** `package.json` và lockfile sang thư mục tạm (không chép `.npmrc`, `.yarnrc*`, `.env` hay file nào chứa token hoặc thông tin đăng nhập registry); chạy `npm install --dry-run --ignore-scripts <gói>@<phiên bản>` ở đó, lệnh không ghi vào project. Kết quả:

- `ERESOLVE` (exit khác 0): peer xung đột với project.
- Exit khác 0 mà mã lỗi khác (`E401`, `E404`): coi như không chạy được; giữ `[Unverified]` kèm lý do, nêu ở G1 như rủi ro chặn hướng.
- `package.json` có `workspaces` hoặc dependency `file:`/`link:`: bản sao không chứa các thư mục đó nên cây khác project dù exit 0; coi như không chạy được, cùng cách xử lý.
- `EBADENGINE` chỉ là cảnh báo (exit 0): kết luận về `engines` lấy từ bước 1.

Package manager khác npm: giữ câu hiện có.

**3. Tên gói (AC3.1, D4).** `contract-and-codegen.md` mục 2a dòng 28 và `SKILL.md` I2 dòng 84: `openapi-generator` → `@openapitools/openapi-generator-cli`. Bảng dò mục 2 dòng 23 giữ `openapi-generator` kèm `openapitools.json` như cũ.

**4. Mục 3 (AC4.1, AC4.2, D3).** Viết lại đoạn mặc định:

- Mặc định (mục 2a không báo xung đột peer, người dùng đồng ý thêm dependency): `npm install --save-dev --save-exact <gói>@<x.y.z>`; script `"api:types": "openapi-typescript docs/contracts/openapi.json -o src/lib/api/generated/schema.d.ts"`.
- Ca xung đột peer và người dùng đã chọn ghim: dạng `npx --yes -p typescript@<x.y.z> -p openapi-typescript@<x.y.z> openapi-typescript …` (giữ ở bảng phương án mục 2a, một ví dụ script thứ hai ở mục 3).
- Câu audit chỉ nằm ở dòng "Ghim công cụ bằng `npx`" của bảng 2a, mở đầu bằng `[Inference]`: gói chạy bằng `npx` không nằm trong `package.json` và lockfile nên `npm audit` có thể không quét nó; ghi vào ADR. Bỏ bản lặp ở mục 3.

**5. Pin `test/content/54-codegen-compat.pin.mjs` (AC5.1, AC5.2).** Lấy mục 2a bằng cắt từ `## 2a.` tới `## 3.`, chuẩn hoá khoảng trắng; thêm: `includes('npm install --dry-run --ignore-scripts')`, `includes('không ghi vào project')`, `.npmrc`, `EBADENGINE`, `@openapitools/openapi-generator-cli`; ngoài đó, sau khi xoá `@openapitools/openapi-generator-cli` khỏi mục 2a và I2 thì không còn token `openapi-generator`. Bước 3: tách bằng `parseSteps` (hàm `field` có sẵn), Hành động có `thư mục tạm`, `không cài vào project`, `` `npx --yes` ``. Sửa dòng pin script `api:types` theo D3: dòng script mặc định không chứa `npx`, dòng `npx` ghim `<gói>@(<x.y.z>|ba số)`. Giữ tên file và các pin còn lại. Thêm pin cho AC1.3: đoạn `**Spike giả định` của `engineering-spec-writing/SKILL.md` (cắt từ đó tới dòng `10. **Verify.**`) có ba cụm trên.

**6. Version và spec sống (AC6.1, AC6.2).** Bump `plugins/frontend/.manifest.json` 1.16.5 → 1.16.6, `workflows/.manifest.json` 3.16.3 → 3.16.4 và `plugins/engineering/.manifest.json` 2.15.0 → 2.15.1, rồi `node cli/lib/versions.mjs --lock`. Spec sống: sửa R25 trong `docs/specs/workflows/spec.md` (thêm ranh giới chỉ đọc của spike ở Bước 3 và spec-writing, và rằng chạy thử bỏ qua `.npmrc`) và thêm dòng `đổi` ở Lịch sử. Không có spec sống riêng cho `engineering`.

**7. `engineering-spec-writing/SKILL.md` bước 9, đoạn "Spike giả định" (AC1.3).** Thêm một câu vào cuối đoạn: giả định về công cụ hoặc thư viện (gói npm, công cụ sinh code, CLI) chỉ kiểm bằng lệnh đọc hoặc chạy thử trong thư mục tạm, không cài vào project, không `npx --yes` hay chạy gói chưa được người dùng duyệt; cần vượt ranh giới đó mới kiểm được thì coi là không spike được và nêu ở checkpoint như rủi ro chặn hướng. Chỉ đổi đoạn này; `references/checklist.md` giữ nguyên.

## Ảnh hưởng spec

- workflows: đổi R26

## Ngoài phạm vi và anti-goal

- Đổi công cụ codegen mặc định đề xuất (`openapi-typescript` giữ nguyên), script kiểm peer, eval, hỗ trợ đầy đủ `pnpm`/`yarn`.
- Mở rộng kiểm tương thích sang thư viện không phải codegen.
- Sửa `engineering-spec-writing` ngoài đoạn "Spike giả định" ở bước 9, và mọi bước khác của `workflow-feature` hay `workflow-bugfix` (N1, N2).
- Tên `openapi-generator` ở `plugins/backend/skills/backend-api-contract/SKILL.md:89` và `test/routing/backend-api-contract.json:10`: thuộc plugin backend, không gắn với lệnh `npm view`/`npx`.
- Chạy lại trial để đo hiệu quả.

## Ràng buộc

Như `requirement.md`. Thêm: một lệnh Bash mỗi lần gọi; commit qua `core:git-workflow` (`git commit -F`, header tiếng Anh, body tiếng Việt, không Co-Authored-By); không push, không merge.

## Kiểm thử

| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1, AC1.3, AC2.1–2.3, AC3.1, AC4.1, AC4.2, AC5.1, AC5.2 | pin nội dung | `test/content/54-codegen-compat.pin.mjs` (`node test/validate.mjs --only codegen-compat`); chỉ ghim lệnh, ranh giới an toàn và tên gói, không ghim văn xuôi |
| AC1.2 | pin + git | số bước 7 và đối chiếu graph do `test/contract/50-workflows.contract.mjs` và `test/content/08-publish.pin.mjs` giữ sẵn; `git diff cb9ecb86 -- workflows/feature/WORKFLOW.md` chỉ có hunk trong Hành động/Gate/Evidence của Bước 3, kiểm tay lúc kết thúc |
| AC2.2 (ca `workspaces`/`file:`), AC4.2 | tay | `npm install --dry-run` ở Spike 2–3; không vào `npm test` vì cần mạng |
| AC6.1 | toàn bộ | `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` |
| AC6.2 | check-request | `check-request.mjs docs/requests/2026-11-13-frontend-codegen-compat-harden/ --base master` |

## Để builder quyết

- Câu chữ chính xác của từng đoạn thêm (miễn đủ chuỗi và ranh giới ở AC), và việc gộp hay tách hai câu ở Gate.
- Số bump nếu N1/N2/N3 đã bump trước khi merge: lấy số lớn hơn lúc merge. Xung đột đã biết: `workflows/R25` trùng với nhánh N2 `claude/frontend-bugfix-gates-b96292` (nhánh merge sau đổi sang R26), `.manifest.json` và `_versions.lock.json`, hunk `workflows/feature/WORKFLOW.md` với N1.
- Nếu `W7` của `check-request` báo ID AC trùng với pin N3 cũ: nhiễu đã biết, ghi `Ruling:` thay vì đổi ID.

## Rủi ro và câu hỏi mở

**Spike (chạy 2026-11-13 trong thư mục tạm ở scratchpad của phiên; Node v24.16.0, npm 11.13.0; cần mạng):**

1. `npm view openapi-generator name version description bin --json` → `openapi-generator@0.1.39`, bin `openapi-generator`; `npm view @openapitools/openapi-generator-cli name version description bin engines --json` → `2.42.2`, `engines.node >=22.0.0`. Hai gói khác nhau.
2. Thư mục tạm có `package.json` với `typescript` 5.9.3; `npm install --dry-run --ignore-scripts this-pkg-does-not-exist-n3b-xyz@1.0.0` → exit 1, `E404`.
3. `package.json` có `dependencies: { "local-lib": "file:../packages/local-lib" }` (đường dẫn không tồn tại); `npm install --dry-run --ignore-scripts openapi-typescript@7.13.0` → exit 0, in `add local-lib undefined`. Cùng lệnh với `workspaces: ["packages/*"]` (không có thư mục) → exit 0. Không tái hiện được `ENOENT`.
4. Gói cục bộ giả `fake-eng` khai `engines.node >=99.0.0`; `npm install --dry-run --ignore-scripts ./fake-eng` → in `npm warn EBADENGINE`, exit 0.
5. `npm install --save-dev --save-exact --package-lock-only --ignore-scripts openapi-typescript@7.13.0` → exit 0, `package.json` có `"openapi-typescript":"7.13.0"` (không `^`).

Chạy lại: các lệnh trên, mỗi lệnh trong một thư mục rỗng có `package.json` tối thiểu (mục 1 chỉ cần `npm view`). Cần mạng và registry công khai.

- [Unverified] Câu "`npm audit` không thấy gói chạy bằng `npx`": lệnh `npx --yes -p … ` chạy thử trong phiên này bị bộ phân loại quyền từ chối, không làm lách; câu giữ nhãn `[Inference]`, người bảo trì có thể kiểm ở máy riêng.
- [Unverified] `E401` (registry yêu cầu đăng nhập, không có `.npmrc` trong thư mục tạm) cho exit khác 0 khác `ERESOLVE`: chưa có registry riêng để thử; luật (a) dựa trên `E404` đã kiểm và trên mô tả của brief.
- [Unverified] `npm install --dry-run` với `pnpm`/`yarn` (kế thừa từ N3): chỉ dẫn vẫn chỉ hứa cho npm.
- [Unverified] Dry-run có tải tarball của gói để đọc peer của dependency con hay chỉ đọc metadata: chưa kiểm; không đổi kết luận, vì `--ignore-scripts` chặn chạy mã cài đặt.
- Còn mở cho G1: D1 (luật theo nội dung `package.json` thay vì mã `ENOENT` của brief); người dùng duyệt G1 mà không sửa D1–D5 thì coi là đồng ý.

## Quyết định khi thực thi và còn mở (G3, 2026-11-13)

- **Cách chạy:** subagent + review từng task (người dùng chọn). Task TOOLING do session chính tự làm theo brief; reviewer `general-purpose` sonnet, re-review haiku, review cuối opus kèm `engineering-quality-auditor`. Làm trên nhánh `claude/frontend-codegen-compat-harden-3570f2` thay vì `feature/<slug>` (như N3).
- **Kết quả review:** Task 1 sửa một vòng (ba finding minor về câu chữ mục 2a: "hai ca trên", vế stderr của `EBADENGINE`, nhãn `E401`), re-review ADDRESSED; Task 2 sạch; Task 3 cỡ nhỏ (đối chiếu file, không review riêng). Review cuối và audit: 0 blocker, 0 major. Chạy lại: `node test/validate.mjs --only codegen-compat`; toàn bộ: `npm test` (exit 0, validate 7546 pass).
- **Đã chốt ở G3 (người dùng chọn "giữ mọi thư viện"):** giữ nguyên chữ AC1.1, AC1.3. Câu hỏi: ranh giới chỉ đọc của AC1.1 và AC1.3 đang áp cho mọi công cụ hoặc thư viện, kể cả thư viện đã cài sẵn, nên cấm cả spike chạy trong repo với thư viện đó (spec-writing vốn cho phép "test hoặc script nhỏ chạy được trong repo"). R1b chỉ nhắm gói chưa cài hoặc chưa duyệt. Giữ nguyên: spike loại đó thành `[Unverified]` nêu ở G1. Đổi: thêm cụm "chưa có trong project" vào AC1.1, AC1.3, câu ở Bước 3, câu ở spec-writing và pin.
- **Minor hoãn đã sửa sau merge (commit `cb6e39cb`, version frontend 1.17.3, workflows 3.17.4, engineering 2.16.2):** các mục (1), (2), (4) và trong (3): "ngoài project" và xoá thư mục tạm, registry riêng, `npm install --save-dev` nêu sự đồng ý gồm script cài đặt, tên gói ở bảng dò và dòng dò stack. **Chưa sửa:** định nghĩa "người dùng đã duyệt" (cần quyết định ngữ nghĩa) và câu "agent chỉ ghi trong `docs/`" ở trường Ràng buộc của Bước 3 (AC1.2 cấm đổi trường này). Chạy lại: `node test/validate.mjs --only codegen-compat`; `npm test` exit 0, validate 8074 pass.
- **Minor hoãn (ngoài AC, bản gốc trước khi sửa):** (1) mục 3 của reference còn câu "Chỉ đề xuất sau khi mục 2a không báo xung đột" đứng cạnh ví dụ `npx` dành cho ca có xung đột; (2) pin 54: AC4.2 thiếu điều kiện `lastIndexOf >= 0`, cắt mục 2a/3 không kiểm index, hai comment mới và comment đầu file chỉ mô tả việc code làm; (3) từ audit: thư mục tạm chưa nói "ngoài project" và chưa dặn xoá sau khi chạy, chưa định nghĩa người dùng nêu tên có là "được duyệt", scope registry private có thể làm dry-run báo không xung đột sai, câu "agent chỉ ghi trong `docs/`" ở Bước 3 đọc lên vẫn cấm spike, `npm install --save-dev` mặc định không có `--ignore-scripts`, dòng dò `openapi-generator` ở hai chỗ chưa ghi tên gói đầy đủ; (4) EBADENGINE nói stderr "chỉ để đối chiếu" trong khi AC2.3 viết "để thấy cảnh báo".
- **Merge:** nhánh gốc đề xuất là `claude/frontend-codegen-compat-f9538e` (N3, chưa merge, đang do worktree `frontend-codegen-compat-f9538e` giữ nên `git checkout` sẽ bị chặn). `workflows/R25` trùng với N2 (`claude/frontend-bugfix-gates-b96292`, nhánh merge sau đổi sang R26); version `workflows` 3.16.4 trùng với N2, và `claude/frontend-ui-verify-7f105e` (3.17.0, 1.17.0), `claude/frontend-perf-script-f30726` (1.17.0) đã bump cao hơn: lấy số lớn hơn rồi `node cli/lib/versions.mjs --lock`.
- **Chưa kiểm** `[Unverified]`: `E401` và `npm audit` với gói chạy bằng `npx` (xem Spike); hành vi của `@openapitools/openapi-generator-cli` (tải JAR, cần Java: chỉ dẫn chỉ kiểm `peerDependencies` và `engines`); agent thật có tuân ranh giới mới hay không (cần eval, ngoài phạm vi). W7 của AC5.2, AC6.1, AC6.2 giữ nguyên vì kiểm bằng lệnh.
