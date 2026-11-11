# Brief: Chuẩn hóa luồng cấu hình và check quyền của aip-gate.json
- Ngày: 2026-11-11
- Trạng thái: approved

## Vấn đề và loại việc
Feature nội bộ (refactor có đổi hành vi bảo mật) cho CLI và hook của aip. `.claude/aip-gate.json` là nơi duy nhất cấu hình hook, chế độ quyền (`mode`, `fullKeep`, `fullRoots`, `fullReadRoots`, `mcpAllow`/`mcpDeny`, `allowEnvFiles`), luồng plan-execution (`autonomy`) và SessionStart (`bootstrapInject`, `handoffPath`…). Hiện file này có sáu parser riêng, ba bản kiểm "file bị git theo dõi", và mỗi khoá tự quyết có tin file đã commit hay không.

Điểm đặc biệt: script `core/skills/plan-execution/scripts/autonomy.mjs` phải tự đứng (chạy ở project đích, skills mode không cài hook), nên không import được module của hook.

## Vì sao bây giờ và thành công trông thế nào
Mỗi request gần đây thêm khoá mới (`autonomy`, `planRunner`, `statusStaleMinutes`) kèm một bản đọc mới. Lệch thật đã thấy: `allowEnvFiles` trong file đã commit vẫn tắt guard `.env`, trong khi `mode: full` và `autonomy` trong file đã commit bị bỏ qua.

Thành công:
- Một module đọc duy nhất (resolve worktree → repo chính, BOM, file hỏng, trạng thái git) dùng cho mọi hook, lệnh CLI (`mode`, `autonomy`, `init`, `status`) và script plan-execution; script vẫn chạy được khi không có hook.
- Một bảng khoá (tên, kiểu, mặc định, mức tin cậy) là nguồn sự thật: khoá nới quyền chỉ có hiệu lực từ file không bị git theo dõi; khoá siết thì đọc cả từ file đã commit.
- File hỏng: hook và script coi như không có cấu hình (vẫn che file repo chính, theo hooks-gates/R9); lệnh CLI báo lỗi và không ghi.
- Khoá lạ hoặc sai kiểu: lệnh status của CLI liệt kê; hook im lặng bỏ qua.
- Spec `docs/specs/hooks-gates/spec.md` có bảng khoá và chính sách; `npm test` xanh.

## Goal, non-goal, anti-goal
- Goal: một module đọc + một bảng khoá + chính sách tin cậy thống nhất; bỏ các parser và bản kiểm tracked trùng lặp; khoá nới quyền (`allowEnvFiles`, `stopGate: false`) từ file đã commit bị bỏ qua; CLI cảnh báo khoá lạ/sai kiểu.
- Non-goal: thêm lệnh CLI mới (`aip config`); đổi `policy.json` hay cách `aip init --full` sinh `settings.json`; đổi cú pháp hay tên khoá hiện có; thêm cảnh báo trong hook.
- Anti-goal: hạ mức bảo vệ ở bất kỳ nhánh nào (một khoá trước đây bị bỏ qua thì không được bắt đầu có hiệu lực); để script plan-execution phụ thuộc vào cây hook.

## Hiện trạng và tham khảo đã thấy
Đã đọc:
- `core/hooks/scripts/gate-config.mjs`: `resolveGate`, `readGate`, `gateTracked` (icase, symlink), `fullEffective`, `envFilesAllowed` (không kiểm tracked).
- `cli/lib/mode.mjs`: `locateGate`, `gitStateOf`; file hỏng → lỗi.
- `cli/lib/autonomy.mjs`: `readAt`, `gateOf` (bản đọc thứ hai trong CLI).
- `core/skills/plan-execution/scripts/autonomy.mjs`: `readGateAt` (file hỏng → `{}`), `trackedByGit` (bản chép rút gọn của `gateTracked`).
- `cli/lib/init.mjs:24` `readAllowEnvFiles`: đọc thẳng file, lỗi → `false`, không kiểm tracked.
- `core/hooks/scripts/session-start.mjs:36` `trackedByGit` cho handoff: không icase, git lỗi → coi là chưa theo dõi.
- `cli/lib/permissions.mjs`, `core/permissions/policy.json`.
- `docs/specs/hooks-gates/spec.md` (R4, R6, R9, R13, R15, R17, R19).

Chưa xem: `cli/lib/status.mjs` (đọc `statusStaleMinutes`), `gate-stop.mjs` chi tiết đọc `stopGate`/`testCommands`, các test hiện có của từng parser, cơ chế `sharedAssets` của build cho core.

## Hướng đã cân nhắc
1. **Được chọn — module gốc trong core + bản sao commit cho script.** Module đọc và bảng khoá đặt cạnh `gate-config.mjs` (hook và CLI import thẳng); script plan-execution dùng bản sao commit trong skill, test giữ byte-identical. Một contract test chạy cùng bộ vector (thiếu file, file hỏng, worktree che repo chính, tracked/untracked/unknown, khoá lạ) trên module. Đánh đổi: có một file sao chép, đổi lại có đúng một nguồn sự thật và không thêm bước build.
2. **Loại — một thư viện chung mà cả hook lẫn script import theo đường dẫn tương đối.** Skills mode không cài cây hook nên script sẽ gãy ở project đích.
3. **Dự phòng — giữ các bản riêng, chỉ thêm bộ vector test chung.** Ít đổi code nhất, nhưng mỗi khoá mới vẫn phải sửa nhiều nơi và bảng chính sách không có chỗ đặt. Dùng khi hướng 1 vướng ở build.

## Quyết định của agent
- Slug `aip-gate-config-flow` và nơi lưu `docs/requests/2026-11-11-aip-gate-config-flow/brief.md`.
- Câu mở ("vì sao bây giờ") người dùng không trả lời; lý do ghi ở mục trên lấy từ code.
- `session-start` kiểm tracked cho handoff dùng chung hàm kiểm tracked của module (icase, symlink); git lỗi cho handoff vẫn coi là chưa theo dõi như R19 hiện tại, vì handoff là dữ liệu, không phải quyền.
- Mức tin cậy tính theo **cả khoá**, không theo hướng của giá trị (một dòng mỗi khoá). Khoá nới quyền: `mode`, `autonomy`, `allowEnvFiles`, `stopGate`, `exemptAgents`. Khoá trong file đã commit bị bỏ qua thì rơi về mặc định của khoá đó (vd `exemptAgents` về `DEFAULT_EXEMPT_AGENTS`). `fullKeep`, `fullRoots`, `fullReadRoots` chỉ dùng khi `full` hiệu lực, mà `full` đã đòi file chưa commit, nên không cần xếp riêng. Danh sách cuối chốt ở design.
- Khoá siết hoặc trung tính (`mcpDeny`, `mcpAllow`, `testCommands`, `bootstrapInject`, `handoffInject`, `ledgerInject`, `resumeWarn`, `handoffMaxAgeHours`, `statusStaleMinutes`, `handoffPath`) vẫn đọc từ file đã commit.
- Trạng thái git `unknown` theo chính sách hiện có (hooks-gates/R6, R15): trong repo git, khoá nới quyền bị bỏ qua; ngoài repo git, hook không có cấu hình (R4), còn CLI và script đọc như thường.
- Bản sao module cho script plan-execution được **commit trong cây nguồn** (`core/skills/plan-execution/scripts/`), có test kiểm byte-identical với bản gốc (như cặp `AGENTS.md` ↔ `core/agents/AGENTS.template.md`), nên chạy từ source vẫn được và không cần bước build mới. Content đổi thì bump version core và lock theo quy tắc version gate.
- Báo thay đổi hành vi: `stopGate: false` và `exemptAgents` trong file đã commit sẽ mất hiệu lực (Stop gate bật lại). Lệnh `aip mode status` và `aip autonomy status` liệt kê khoá bị bỏ qua vì file đã commit, cạnh khoá lạ/sai kiểu. Thông điệp chặn của `gate-stop` (dòng gợi ý `"stopGate": false`) thêm điều kiện "file không bị git theo dõi". Hook không thêm cảnh báo mới (theo lựa chọn của người dùng).

## Phần đoán
- [giả định] Không project nào đang dựa vào `allowEnvFiles: true` hoặc `stopGate: false` trong file đã commit; nếu có, sau thay đổi guard `.env` và Stop gate sẽ bật lại ở project đó.
- [giả định] Module đọc dùng chung đủ nhỏ để chép nguyên vào skill mà không kéo theo phần riêng của hook (`classifyPath`, root chỉ-đọc…); nếu không, chỉ phần đọc + kiểm tracked + bảng khoá được tách ra.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: một module đọc aip-gate.json, một bảng khoá có mức tin cậy, mọi hook/CLI/script dùng chung, spec hooks-gates cập nhật, npm test xanh
rủi-ro: đổi hành vi guard bảo mật; allowEnvFiles và stopGate trong file đã commit mất hiệu lực ở project đang dùng; bản sao cho script plan-execution lệch nguồn nếu build quên chép
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
