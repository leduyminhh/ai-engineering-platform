# Thiết kế: kiểm tương thích công cụ sinh code trước cổng G1
- Ngày: 2026-11-13
- Trạng thái: draft — chờ duyệt G1
- Requirement: [requirement.md](requirement.md)

## Vấn đề và lý do

Mục N3 của [trial-report.md](../2026-11-13-frontend-trial/trial-report.md): công cụ codegen được chốt ở G1 mà chưa ai kiểm nó chạy được với toolchain của project; lỗi lộ ở Task 1, sau khi ADR, AC và tên type đã dựa vào nó.

Đã đọc code nền (nhánh `claude/frontend-codegen-compat-f9538e`, master `36e5a52e`):

1. `plugins/frontend/skills/frontend-data-integration/SKILL.md:79–83` (I2): "chưa có codegen → đề xuất `openapi-typescript` (… hành vi công cụ gắn `[Unverified]`) và HỎI". Không có bước đọc peer hay `engines`.
2. `references/contract-and-codegen.md:21–33`: bảng dò codegen và ví dụ script `api:types`, không có kiểm peer, không nói ghim phiên bản.
3. `workflows/feature/WORKFLOW.md` Bước 3 (dòng 85–116): chỉ nhắc builder check; không có từ "spike". Quy tắc spike giả định `[Unverified]` nằm ở `engineering-spec-writing` (`SKILL.md` dòng 120–124, mục C bước 9), ngoài workflow, nên agent ở trial coi là tuỳ chọn.
4. **Thời điểm:** I2 chạy ở Bước 5 khi `frontend-data-integrator` nhận task `FE-INT`, sau G1 và G2. Công cụ được chốt ở Bước 2–3 khi `engineering-spec-analyst` viết `design.md`. Skill chạy sau cổng thì không thể làm cổng.

## Quyết định đã chốt

Không có: người dùng giao toàn bộ câu hỏi thiết kế cho cổng G1 này.

### Quyết định của agent

Người dùng chưa trả lời câu hỏi nào; mọi dòng dưới là **quyết định của agent**, nêu nổi bật để sửa khi duyệt.

- **D1 — bắt buộc, có lối thoát, không chỉ khuyến nghị.** Bước kiểm là bắt buộc ở I2 và ở Bước 3; khi không chạy được lệnh thì giữ `[Unverified]` và nêu như rủi ro chặn hướng ở G1, không chặn công việc. Lý do: nhãn `[Unverified]` đã có ở trial và không đủ; "khuyến nghị" lặp lại đúng cái đã thất bại. Lối thoát khớp mục "Kiểm nguồn" của `core/principles/source-check.md` ("không có mạng… làm tiếp").
- **D2 — áp cho mọi công cụ codegen, kiểm cả `peerDependencies` lẫn `engines`.** Lý do: kiểm bằng `npm view` không phụ thuộc tên công cụ, và `engines` có thật (xem Spike: `orval` đòi Node ≥ 22.18.0, `@openapitools/openapi-generator-cli` đòi Node ≥ 22.0.0; peer của `orval` là `typedoc`, `prettier`, `typedoc-plugin-markdown`, không có `typescript`). Giới hạn theo `openapi-typescript` sẽ bỏ sót đúng loại xung đột này ở công cụ khác.
- **D3 — sửa ở cả hai nơi, mỗi nơi một vai.** Workflow Bước 3 là chỗ **buộc** và đặt thời điểm (trước G1); reference của skill là chỗ **chỉ cách** (lệnh, ghim, phương án); `SKILL.md` I2 là lưới đỡ cho ca công cụ được chọn muộn hoặc người dùng nêu thẳng ở Bước 5. Chỉ sửa skill: chạy sau cổng. Chỉ sửa workflow: thiếu lệnh cụ thể nên mỗi lần phải bịa lại.
- **D4 — ghi lệnh, không viết script.** Hai lệnh có sẵn đủ (Spike); một script phải so semver (thêm dependency hoặc tự viết bộ so) và phải bảo trì cho từng package manager. `npm install --dry-run` đã làm đúng việc so peer bằng chính bộ giải của npm.
- **D5 — pin nội dung, không eval.** Hành vi cần chốt là chữ trong skill (có lệnh nào, có nằm ở Bước 3 không), tất định, kiểm bằng pin ở `test/content/`. Eval thật tốn tiền model và đo mức kích hoạt của skill, không đo chữ có mặt; trial đã có dữ liệu cho thất bại này. Pin chỉ ghim chuỗi lệnh và vị trí (hợp lệ theo AGENTS.md: hợp đồng vận hành, không ghim văn xuôi).

### Hướng đã cân nhắc

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A | Chỉ sửa `SKILL.md` I2 (đúng như gợi ý ban đầu của N3) | Nhỏ nhất, nhưng I2 chạy ở Bước 5, sau G1; không sửa được lỗ hổng gốc | Loại |
| B | Chỉ sửa workflow Bước 3 | Đúng thời điểm, nhưng không có lệnh và cách xử lý xung đột; reference của skill không đổi nên Bước 5 vẫn mù | Loại |
| C | Workflow Bước 3 (buộc) + reference (cách làm) + I2 (lưới đỡ) | Ba file, nhưng mỗi file đổi vài dòng, không thêm bước, không đổi `graph.json` | **Khuyến nghị** |
| D | C + script kiểm peer trong skill | Chính xác hơn với package manager khác, nhưng thêm mã phải bảo trì và so semver | Loại (D4) |

## Thiết kế

Ba thay đổi nội dung, không thêm bước, không đổi `graph.json`.

**1. `plugins/frontend/skills/frontend-data-integration/references/contract-and-codegen.md`** — thêm mục "Kiểm tương thích công cụ" ngay sau mục 2 (dò codegen) và sửa ví dụ ở mục 3:

- Đọc khai báo: `npm view <gói>@<phiên bản> peerDependencies engines --json`; so với `typescript` trong `package.json` và lockfile và `node --version`.
- Chạy thử (không ghi vào project): sao chép `package.json` (và lockfile) sang thư mục tạm rồi `npm install --dry-run --ignore-scripts <gói>@<phiên bản>`; `ERESOLVE`, exit khác 0 là xung đột. Package manager khác npm: vẫn đọc khai báo bằng `npm view`, phần chạy thử gắn `[Unverified]`.
- Phương án khi xung đột, người dùng chọn: (a) ghim bằng `npx --yes -p typescript@<x.y.z> -p <gói>@<x.y.z> <lệnh>` trong script `api:types` (không thêm dependency vào `package.json`; file type sinh ra vẫn được `tsc` của project kiểm: trial báo typecheck và 149 test xanh với cách này, tôi chưa chạy lại `tsc` dưới TypeScript 7); (b) đổi công cụ hoặc phiên bản công cụ; (c) hạ TypeScript của project: ngoài phạm vi skill, chỉ nêu như hệ quả.
- Ví dụ script ở mục 3 ghim `openapi-typescript@<x.y.z>`.

**2. `SKILL.md` mục I2** — thêm một đoạn trước câu "Chưa có codegen → đề xuất…": với mọi ứng viên codegen (kể cả người dùng nêu tên), chạy mục "Kiểm tương thích công cụ" của reference, ghi dòng "Tương thích" (lệnh, peer/`engines` đã đọc, phiên bản TypeScript/Node của project, kết luận) vào ADR của công cụ; request không có ADR cho công cụ thì ghi vào `design.md` mục rủi ro/giả định. "Đỏ khi" thêm: peer hoặc `engines` xung đột → dừng, trình phương án, chưa Accepted ADR trước khi người dùng chọn. Giữ nguyên "hành vi công cụ gắn `[Unverified]`" cho phần không kiểm bằng lệnh được.

**3. `workflows/feature/WORKFLOW.md` Bước 3 (chỉ bước này)** — hai phần của Bước 3 đổi:

- Hành động, sau câu builder check: "Spike giả định (theo `engineering-spec-writing`): giả định về công cụ hoặc thư viện mà hướng đã chọn dựa vào và kiểm được bằng một lệnh (vd công cụ codegen có chạy với TypeScript/Node của project không: `references/contract-and-codegen.md` của `frontend-data-integration`) thì kiểm trước checkpoint, ghi lệnh và kết quả vào tài liệu; không kiểm được thì nêu ở G1 như rủi ro chặn hướng."
- Gate: thêm "mọi giả định công cụ kiểm được bằng một lệnh đã có kết quả trong tài liệu, hoặc được nêu ở G1 là rủi ro chặn hướng". Evidence: thêm "lệnh spike + kết quả".

**4. Pin và version.** `test/content/54-codegen-compat.pin.mjs` kiểm: SKILL.md I2 và reference có `npm view`, `peerDependencies`, `engines`, `--dry-run`, `npx --yes -p typescript@`; workflow Bước 3 có từ khoá spike trong Hành động và Gate; số bước vẫn 7. Bump `plugins/frontend/.manifest.json` (1.16.3 → 1.16.4) và `workflows/.manifest.json` (3.16.2 → 3.16.3), rồi `node cli/lib/versions.mjs --lock`.

## Ảnh hưởng spec

- workflows: thêm R25

## Ngoài phạm vi và anti-goal

- Chọn công cụ codegen hộ người dùng, hoặc đổi công cụ mặc định đề xuất (`openapi-typescript` giữ nguyên).
- Kiểm tương thích cho thư viện không phải codegen (TanStack Query, msw, Playwright): bước spike ở Bước 3 là chung cho giả định kiểm được bằng một lệnh, nhưng reference chỉ viết cách cho codegen.
- Script kiểm peer, eval, hỗ trợ `pnpm`/`yarn` đầy đủ (chỉ ghi `[Unverified]` cho phần chạy thử của họ).
- Mọi bước khác của `workflow-feature` (Bước 5, 6 thuộc request N1) và `workflow-bugfix` (N2).
- Chạy lại trial để đo hiệu quả.

## Ràng buộc

Như `requirement.md`. Thêm: ở Bước 3 chỉ sửa Hành động, Gate, Evidence (không viết `skill \`...\`` hay `agent \`...\`` mới vào Thực hiện, không thêm chữ "hỏi" hoặc "quay lại Bước N" vào Khi fail, vì `checkGraphAgainstBody` ở `cli/lib/workflows.mjs` suy graph từ hai trường đó; đã đọc code, dòng 220–262); câu lệnh trong chỉ dẫn là lệnh chạy được trên Windows và POSIX (chỉ dùng `npm`, `npx`, `node`); không đưa đường dẫn tuyệt đối của máy nào vào nội dung chiếu.

## Kiểm thử

| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1, AC1.2, AC2.1, AC2.2 | pin nội dung | `test/content/54-codegen-compat.pin.mjs`: chuỗi lệnh và vị trí trong I2, "Đỏ khi", reference |
| AC3.1, AC3.2 | pin + git | pin Bước 3 (Hành động và Gate); số bước 7 và đối chiếu graph do `test/contract/50-workflows.contract.mjs` và `test/content/08-publish.pin.mjs` giữ sẵn; `git diff master -- workflows/feature/WORKFLOW.md` chỉ có hunk trong Hành động/Gate/Evidence của Bước 3, kiểm tay lúc kết thúc |
| AC4.2 | check-request | bước gộp ở `finish.md`; `check-request.mjs … --base master` |
| AC4.1 | pin nội dung | một pin cho câu lối thoát `[Unverified]` + "rủi ro chặn hướng" ở Bước 3 |
| AC5.1 | toàn bộ | `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` |
| AC5.2 | tay | hai lệnh ở Spike; cần mạng và registry nên không vào `npm test` |

## Để builder quyết

- Cách pin: tách trường Bước 3 bằng `parseSteps` rồi cắt theo mẫu `field20` của `test/content/09-backend-performance.pin.mjs` (không tìm "spike" trên cả file); khớp từng token rời (`--dry-run`, `--ignore-scripts`, `engines`, `peerDependencies`) thay vì chuỗi lệnh dài; kiểm bước đọc đứng trước câu "Chưa có codegen" bằng `indexOf`; thêm chữ vào dòng "Đỏ khi" hiện có của I2, không tạo "Đỏ khi" thứ hai; xác minh runner nạp `*.pin.mjs` theo glob trước khi đặt tên file.
- Tên chính xác của đoạn thêm vào I2 và mục thêm vào reference (miễn đủ chuỗi lệnh ở AC).
- Vị trí đoạn ADR "Tương thích": một dòng trong ADR hay mục riêng của `docs/decisions/_TEMPLATE.md`; chọn theo template hiện có của project đích.
- Số thứ tự bump (patch hay minor) nếu request N1/N2 đã bump trước khi merge: giải quyết lúc merge, lấy số lớn hơn.

## Rủi ro và câu hỏi mở

- **Builder check (một lần, subagent mới, 8 câu):** đã trả lời và ghi vào tài liệu: thiếu AC cho spec sống (thêm AC4.2), lệnh ghim `<major>` lệch `x.y.z` (đã thống nhất `x.y.z`), không có ADR thì ghi ở đâu (ghi vào `design.md`), hạn chế vị trí chữ ở Bước 3 do `checkGraphAgainstBody` (đã vào Ràng buộc và AC3.2), cách pin và lệnh kiểm tay (vào Để builder quyết và AC3.2), giữ link `https://`. Không có câu nào cần hỏi người dùng ngoài D1–D5.

- **Spike (đã chạy 2026-11-13, tay, trong thư mục tạm ở scratchpad của phiên):**
  1. `npm view openapi-typescript@7.13.0 peerDependencies version engines --json` → exit 0, `peerDependencies: { typescript: "^5.x" }`.
  2. Thư mục tạm có `package.json` với `typescript: 7.0.2`, rồi `npm install --dry-run --ignore-scripts openapi-typescript@7.13.0` → exit 1, `ERESOLVE`, "peer typescript@"^5.x" from openapi-typescript@7.13.0"; không tạo `node_modules`. Tái lập đúng lỗi của trial bằng một lệnh.
  3. `npx --yes -p typescript@5.9.3 -p openapi-typescript@7.13.0 openapi-typescript <openapi.yaml của project trial> -o <file tạm>` → exit 0, ghi 175 dòng type. Khớp script `gen:api` mà trial đã dùng.
  4. `npm view orval peerDependencies engines --json` → peer `typedoc`, `prettier`, `typedoc-plugin-markdown`; `engines.node >=22.18.0`. `npm view @openapitools/openapi-generator-cli peerDependencies engines --json` → `engines.node >=22.0.0`, không có peer. Dữ liệu cho D2.
- [Unverified] `npm install --dry-run` cho cùng kết quả với `pnpm` và `yarn`; chưa kiểm, nên AC2.1 chỉ hứa cho npm.
- [Unverified] Chỉ dẫn mới đủ để agent ở một trial khác kiểm trước G1; chỉ chắc rằng lỗ hổng chữ đã đóng. Cần một lượt trial lại để biết (ngoài phạm vi).
- [Unverified] Mức phổ biến của xung đột kiểu này ở project khác (trial báo cáo cũng ghi chưa biết).
- Xung đột merge đã biết: `workflows/feature/WORKFLOW.md` (N1 sửa Bước 5/6; request này chỉ Bước 3, hunk khác nhau), `plugins/frontend/.manifest.json`, `workflows/.manifest.json` và `plugins/_versions.lock.json` (N1, N2 cũng bump), và số `workflows/R25` trong spec sống (N1 hoặc N2 có thể cũng thêm R25). Giải quyết lúc merge.
- Câu hỏi mở cho G1: D1–D5 đúng ý chưa; muốn bắt buộc cả với thư viện không phải codegen thì phải mở rộng reference (hiện chỉ codegen).
