# Brief: hạ tầng dưới dạng code (Bash, Docker Compose, cấu hình CI, runbook)
- Ngày: 2026-11-12
- Trạng thái: approved

## Vấn đề và loại việc

Backlog audit (`docs/requests/2026-11-12-skill-coverage-audit/backlog.md`, hạng 4, trục "thiếu") ghi rằng aip không có
skill nào dạy viết hoặc sửa hạ tầng dưới dạng code: script Bash, `docker-compose*.yml`, cấu hình CI, runbook. Chi phí khi
thiếu `[Inference]`: backup báo thành công khi dump lỗi; job CI luôn đỏ hoặc luôn xanh sai.

Đây là việc **thêm nội dung skill mới** trong plugin `ops`. Request này là request thứ tư trong top 5 của backlog. Nó chỉ
lo hạ tầng dưới dạng code, không lo chuẩn hoá đầu vào trong AC (hạng 1), routing (hạng 2), hợp đồng nội bộ giữa component
(hạng 3) hay thứ tự deploy nhiều component (hạng 5).

Điểm đặc biệt: skill mới **viết/sửa** file hạ tầng, trong khi `plugins/ops/shared/principles.md` hiện ghi plugin ops chỉ
**đọc** cấu hình CI/hạ tầng làm ràng buộc ("KHÔNG dựng lại, KHÔNG sửa ngoài scope"). Thêm skill này đổi lập trường đó ở
mức "viết/sửa trong scope người dùng nêu, không tự chạy lên môi trường"; design phải sửa nguyên tắc cho khớp.

## Vì sao bây giờ và thành công trông thế nào

Bằng chứng, giữ đúng nhãn:

- `[Verified]` ở mức "nguồn ghi như vậy": một repo hạ tầng (Bash, Docker Compose, Jenkins, runbook Markdown, không có
  ledger `.aip`) có chương trình nâng cấp với bảng 7 finding do chính nó tự kiểm. Năm finding thuộc Bash: `set -e` bị tắt
  vì lệnh nằm trong `if` nên dump lỗi vẫn báo thành công; `for ...; done | gzip` trả 0 khi database đầu lỗi; `psql` không
  có `ON_ERROR_STOP`; `((n++))` từ 0 trả 1 dưới `set -e`; bước backup sao lưu nhầm database. Hai finding thuộc CI: bước kiểm
  LF luôn fail vì pipeline luôn trả 0; mẫu quét secret khớp fixture test nên job luôn đỏ. Chương trình đó còn có mảng
  "lib Bash dùng chung" và "runbook theo chuẩn 8 mục". Phiên audit không đọc lại source Bash hay CI của repo đó.
- `[Verified]` ở máy này (Bash trong Git Bash, 2026-11-12): `set -e` không dừng trong hàm gọi từ điều kiện `if`; `((i++))`
  từ 0 trả mã 1 dưới `set -e`; pipeline không `pipefail` trả mã của lệnh cuối (`false | cat` → 0, có `pipefail` → 1).
  Các hành vi này chung cho mọi repo Bash, không riêng một nguồn.
- `[Unverified]` độ phổ biến ngoài một repo. Nguồn-A (project nguồn đợt trước) và nguồn-C (repo aip) không thấy tín hiệu.
  Người dùng trả lời trong phiên này rằng họ **thường xuyên** làm repo hạ tầng; đó là lời người dùng, không có số đếm kèm,
  và chưa nói về người dùng aip khác.
- Không có finding trực tiếp nào về Docker Compose hay lỗi runbook: hai mảng này đi theo lời người dùng về nhu cầu, nhãn
  `[Unverified]`.

Thành công đo được:

- Có skill mới trong `plugins/ops` với `description` ≤ 1024 ký tự, có vế "Không dùng khi → id" trỏ đúng `ops-deploy-release`,
  `ops-observability`, `ops-incident-troubleshooting`, `backend-migrate-vault-consul`.
- Phần Bash và CI có checklist rút từ đủ 7 finding trên, mỗi mục kiểm được bằng lệnh hoặc đọc dòng cụ thể (vd "mọi script
  mở đầu bằng `set -euo pipefail` hoặc có lý do ghi rõ", "`psql` có `-v ON_ERROR_STOP=1`").
- Phần Compose và runbook có khung ngắn hơn, ghi rõ chưa có bằng chứng lỗi.
- `npm test` xanh, `ops/.manifest.json` bump version và lock cập nhật; skill ở trạng thái draft nên điểm routing nền
  (positive 69, negative 94) không đổi.

## Goal, non-goal, anti-goal

Goal:

- Một skill mới trong `plugins/ops` dạy agent viết/sửa script Bash, `docker-compose*.yml`, cấu hình CI và runbook an toàn,
  với bốn mảng và chiều sâu theo bằng chứng (Bash và CI sâu, Compose và runbook khung ngắn).
- Checklist hardening Bash/CI lấy từ 7 finding; bước kiểm bằng máy là `shellcheck` **nếu máy có**, không thêm phụ thuộc.
- Sửa `plugins/ops/shared/principles.md` cho khớp lập trường mới (viết/sửa trong scope, không tự chạy lên môi trường).
- Skill để **draft**: đổi dòng `"ops"` trong `plugins/_published.json` thành từng skill `ops/<id>` (ba skill cũ vẫn
  published) để skill mới không tự published.

Non-goal:

- Script Node kiểm tĩnh trong aip (đã chọn không làm); thêm `shellcheck` vào phụ thuộc hay CI của aip.
- Sửa `ops-deploy-release`, `ops-observability`, `ops-incident-troubleshooting` (nếu cần con trỏ chéo thì chỉ thêm vế
  "Không dùng khi" ở design, không đổi quy trình).
- Publish skill mới; nâng `rank1.lock.json`; Kubernetes manifest, Terraform, Ansible (chưa có bằng chứng, ngoài bốn mảng đã chọn).
- Hạng 1, 2, 3, 5 của backlog.

Anti-goal:

- Skill tự chạy script, backup, deploy hay lệnh lên môi trường; in hoặc ghi secret (chỉ nêu tên biến).
- Trình bày nhu cầu hạ tầng như nhu cầu chung của người dùng aip khi mới có một nguồn.
- Đưa tên project ngoài hay đường dẫn máy vào nội dung skill hay tài liệu.
- `description` chép cụm prompt mẫu để lấy điểm routing; skill mới làm tụt điểm routing dưới khoá khi publish về sau.

## Hiện trạng và tham khảo đã thấy

Đã đọc trực tiếp (`[Verified]`):

- `plugins/ops/skills/ops-deploy-release/SKILL.md` và `references/release-checklist.md`: skill điều phối deploy. Bước 0 dò
  `Dockerfile`, `docker-compose*.yml`, k8s manifest, CI pipeline, Jenkinsfile, "script release có sẵn" rồi *đọc* làm ràng
  buộc. Checklist có "backup đã tạo và verify khôi phục được" nhưng không nói cách viết script backup đúng. Không phủ việc
  viết hay sửa script/CI; tự mô tả là "KHÔNG phải script CI/CD".
- `plugins/ops/skills/ops-observability/SKILL.md`: mỗi alert phải có "severity + link runbook"; không skill nào định nghĩa
  runbook theo chuẩn nào. `ops-incident-troubleshooting`: đọc-chỉ, RCA; không viết hạ tầng.
- `plugins/ops/shared/principles.md`: "Defer cấu hình CI/CD... KHÔNG dựng lại, KHÔNG sửa ngoài scope". Dòng đầu bản chất
  plugin chỉ liệt kê `ops-deploy-release` (lỗi thời so với ba skill hiện có); design xem lại cùng lúc.
- Grep trong `core/`, `plugins/`, `workflows/` (file `.md`): `set -e|pipefail|shellcheck|ON_ERROR_STOP` không khớp file
  nào làm hướng dẫn cho người dùng; `runbook` 11 file, phần lớn là runbook kiểm tay UI (`frontend-manual-check`) và alert
  (`ops-observability`).
- `[Inference]` các script Bash aip tự ship (`backend-migrate-vault-consul/scripts/seed-*.sh`,
  `data-db-migration/scripts/new-migration.sh`) và mọi `evals/**/scaffold.sh` đều mở đầu bằng `set -euo pipefail`: người viết
  aip đã theo quy ước, nhưng chưa có skill nào truyền nó cho người dùng.
- `plugins/_published.json`: `"ops"` là publish cả plugin; một skill mới thêm vào `plugins/ops/skills/` sẽ tự published.
  `cli/lib/plugins.mjs` (`loadPublished`) chấp nhận dạng `plugin/skill` cho publish một phần.
- Bài đo routing của audit: prompt "Dựng cụm Consul và Vault bằng docker-compose" đang rơi vào
  `backend-migrate-vault-consul` (negative trượt); một phần việc của skill mới là việc không skill nào đúng.

Chưa xem:

- Source Bash, `docker-compose*.yml`, Jenkins và runbook của repo hạ tầng nguồn-B (người dùng cho phép đọc chỉ-đọc khi audit,
  chưa cần; nếu design cần mẫu thật thì hỏi lại). Thân `backend-migrate-vault-consul` về phần dựng Compose.
- Chưa kiểm `shellcheck` chạy được trong CI của repo người dùng; máy làm việc này không cài `shellcheck`.
- Chưa có số lần người dùng aip yêu cầu việc kiểu này.

## Hướng đã cân nhắc

- **A (chọn). Một skill mới trong `ops`, thân gọn, `references/` theo mảng.** Thân skill giữ quy trình (đọc cấu hình, chốt
  scope, viết/sửa, tự soát theo checklist, báo residual risk); `references/` gồm Bash hardening, CI config, Compose, runbook.
  Bash và CI đi sâu theo 7 finding; Compose và runbook là khung ngắn. Đánh đổi: bốn mảng trong một `description` ≤ 1024
  ký tự dễ rộng và dễ chồng routing với `ops-deploy-release`; đổi lại một điểm kích hoạt, ít bề mặt bảo trì khi mới có một
  nguồn.
- **B (loại). Bốn skill riêng (Bash, CI, Compose, runbook).** Routing chính xác hơn nhưng bốn bề mặt bảo trì và bốn
  `description` cho một nguồn bằng chứng; `[Inference]` làm tăng nguy cơ tụt điểm routing khi publish. Quay lại được nếu
  về sau có nguồn thứ hai và một mảng phình to.
- **C (loại, người dùng đã chọn không). Chỉ `references/` gắn vào `ops-deploy-release`.** Nhỏ nhất, không đổi lập trường
  ops. `[Inference]` prompt "viết script backup" không kích hoạt skill vì `description` của nó nói về deploy.

Dạng kiểm: người dùng chọn checklist đọc kèm `shellcheck` nếu máy có. Loại: script Node kiểm tĩnh trong aip (chỉ bắt được
mẫu cú pháp như thiếu `set -e`, không bắt được `set -e` bị tắt trong `if` hay pipeline thiếu `pipefail` ở ngữ cảnh,
thêm code phải bảo trì).

## Quyết định của agent

- Chọn hướng A và chiều sâu "Bash và CI sâu, Compose và runbook khung ngắn" theo bằng chứng: agent đề xuất; người dùng chọn
  cả bốn mảng và chọn dạng "skill mới + checklist đọc, shellcheck nếu có", chưa nói về chiều sâu từng mảng.
- Tên skill (đề xuất `ops-infra-as-code`) để design chốt; `[giả định]`.
- Loại việc `feature`; `ops/shared/principles.md` được sửa trong cùng request, không phải request riêng.
- Phạm-vi ghi `code-be` theo tiền lệ các request cùng đợt: việc thật là thêm nội dung Markdown và JSON của aip, không gọi agent
  backend Java/Spring. Đã thử `route.mjs`: `feature/ops` ra "chưa có quy trình", `feature/code-be` và `feature/fullstack` ra
  `workflow-feature`. Giữ `feature/code-be`; người dùng ghi đè được ở thẻ duyệt.
- Người dùng chọn "thường xuyên" nên agent giữ hạng 4 và không thu nhỏ phạm vi theo hướng "hoãn"; độ phổ biến ngoài người
  dùng này vẫn ghi `[Unverified]`.
- Draft bằng cách tách `"ops"` thành ba `ops/<id>` hiện có trong `_published.json`; cách này thuộc cơ chế đã có, không sửa
  `cli/`. Người dùng chốt "draft tới khi có nguồn thứ hai"; điều kiện publish cụ thể do design/ngày sau quyết.
- Chuẩn runbook "8 mục" của nguồn-B: không chép; design tự đề xuất chuẩn gọn, kiểm hợp với `ops-observability` (link runbook)
  và `ops-incident-troubleshooting` (RCA), không chép tên project hay đường dẫn ngoài.
- Khi trích bằng chứng vào skill hoặc docs commit: khái quát hoá, không tên project ngoài, không đường dẫn máy (đã áp dụng
  trong brief này). Sau builder check, thêm các quyết định nhỏ dưới đây (agent tự quyết, design có thể đổi):
  - Mỗi finding thành một mục checklist chung, kiểm được bằng lệnh hoặc đọc dòng cụ thể, không chép chi tiết repo nguồn: "backup
    sao lưu nhầm database" thành "tên database nguồn của dump khớp scope đã chốt"; "mẫu quét secret khớp fixture" thành "mẫu
    quét secret có loại trừ thư mục fixture/test và job được thử trên cả ca có và không có secret".
  - Skill chạy ở session chính, không thêm agent và không `writeScope` trong request này; guard hook hiện có (file secret,
    lệnh nguy hiểm) vẫn áp. Agent chỉ-đọc `ops-incident-investigator` không đổi.
  - Được phép chạy kiểm cục bộ không thực thi script: `bash -n`, `grep`, `shellcheck` nếu có; không chạy script đích, backup,
    `docker compose up` hay lệnh nào chạm môi trường.
  - Sửa luôn dòng đầu "Bản chất plugin" của `ops/shared/principles.md` (chỉ liệt kê `ops-deploy-release`) cùng lúc sửa lập
    trường "chỉ đọc", vì hai chỗ sẽ mâu thuẫn nhau; không sửa phần còn lại.
  - Bump version `plugins/ops/.manifest.json` rồi chạy `node cli/lib/versions.mjs --lock`; không đụng `core/`. Có cần bump
    lại khi chỉ đổi `_published.json` thì `versions.mjs` tự báo; `[Unverified]` trước khi chạy.
  - Điều kiện thoát draft ghi một dòng trong design: có ít nhất một nguồn thứ hai độc lập (repo hạ tầng khác, hoặc người dùng
    aip khác báo lỗi cùng loại); `[giả định]`, người dùng sửa được.
  - Tên skill để design chốt rồi cố định trước khi sửa `_published.json`; đổi tên sau đó phải sửa đủ `_published.json`,
    `description` và con trỏ chéo.
  - Route: `route.mjs` chọn `workflow-feature` (spec, plan, vòng task có review). `aip-add-content` là skill dự án (checklist
    thêm nội dung) mà design/plan dùng bên trong, không phải route thay thế; người dùng ghi đè được ở thẻ duyệt.

## Phần đoán

- [giả định] Bốn mảng chia được trong một skill mà `description` ≤ 1024 ký tự vẫn nêu đủ và không chồng với
  `ops-deploy-release`; chưa soạn thử.
- [giả định] Lỗi nguồn-B (Bash, CI) đại diện cho lỗi người dùng aip gặp; một repo, chưa kiểm.
- [giả định] Compose và runbook đủ dùng ở mức khung ngắn; chưa có finding lỗi nào để rút checklist.
- [giả định] `shellcheck` bắt được đa số lỗi Bash trong bảng finding; chưa chạy trên mẫu nào (máy này chưa cài). Lỗi
  nghiệp vụ như "backup sao lưu nhầm database" không công cụ tĩnh nào bắt.
- `[Verified]` đọc `normalizePublished` (`cli/lib/plugins.mjs:38`): phần tử `plugin/skill` chỉ publish đúng skill đó, `plugin`
  trơn là cả plugin. Còn `[giả định]` rằng tách `"ops"` thành ba `ops/<id>` không làm hỏng đóng gói, wizard hay
  validate (8 file đọc `loadPublished`); chưa chạy `npm test` sau đổi đó.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: skill mới ở trạng thái draft trong plugin ops (viết/sửa Bash, Compose, CI, runbook an toàn) cùng checklist hardening và nguyên tắc ops cập nhật
rủi-ro: skill mới chồng routing với ops-deploy-release; checklist chỉ dựa trên một nguồn bằng chứng nên có thể lệch nhu cầu người dùng khác; đổi _published.json làm lệch danh sách skill được offer
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
