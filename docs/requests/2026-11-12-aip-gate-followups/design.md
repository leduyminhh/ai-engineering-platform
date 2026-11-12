# Thiết kế: bốn follow-up của aip-gate-config-flow
- Ngày: 2026-11-12
- Trạng thái: in-progress — design và plan đã duyệt (G1, G2); chờ duyệt diff cả nhánh (G3)
- Requirement: không có

## Vấn đề và lý do

Request [2026-11-11-aip-gate-config-flow](../2026-11-11-aip-gate-config-flow/design.md) (merged 7ba0934c, core 1.33.5) để lại bốn việc, người dùng chọn làm sau (mục "Quyết định khi thực thi"). Đã đọc trong code:

1. `cli/lib/mode.mjs` (`writeText`, dòng 103–106; gọi ở `runModeUnsafe` 170, 171, 196, 197) và `cli/lib/autonomy.mjs` (dòng 59–60) ghi `.claude/aip-gate.json` / `.claude/settings.json` bằng `fs.writeFileSync` không kiểm symlink. File hay thư mục `.claude` là symlink/junction (kể cả đã commit từ clone) thì ghi xuyên ra ngoài project. `setRunner` trong `core/skills/plan-execution/scripts/autonomy.mjs:60–62` đã từ chối trường hợp này bằng `lstatSync(...).isSymbolicLink()` ở file và thư mục chứa nó.
2. `core/hooks/scripts/session-start.mjs`: `probe` (dòng 91–98) gọi `d.tracked(p)` cho mọi handoff ứng viên còn trong hạn tuổi; mặc định `handoffTracked` → `gateTracked` tốn tối đa 2 lần `git ls-files`, đo ≈ 78 ms mỗi file trên Windows (số của request trước, chưa đo lại). Clone có N file `handoff.md` đã commit đều mới theo mtime nên cả N file qua bộ lọc tuổi: N × 78 ms trước khi phiên mở được.
3. `core/hooks/scripts/gate-stop.mjs:151`: `fileOff = !gate?.file || tracked(gate.file) === false`. Ngoài repo git `resolveGate` trả `null` nên `!gate?.file` đúng và lời nhắn vẫn mời đặt `"stopGate": false`, dù hook không đọc `aip-gate.json` ở đó (hooks-gates/R4).
4. `cli/lib/init.mjs:30`: `path.resolve(root) !== g.top` so chuỗi. `g.top` đến từ `git rev-parse --show-toplevel` (đường dẫn thật, ổ đĩa viết hoa theo git), còn `root` có thể là symlink/junction tới gốc worktree hoặc viết khác hoa/thường ổ đĩa. Hai chuỗi lệch thì gốc worktree bị coi là thư mục con: `readAllowEnvFiles` không rơi về file của repo chính, trả `false` (giữ quy tắc `.env`: lỗi theo hướng an toàn, nhưng `aip init --full` sinh `settings.json` khác với hook).

## Quyết định đã chốt

- A1 (mục 1): một hàm `assertNotLinked(files)` export từ `mode.mjs`; ném lỗi (`runMode`/`runAutonomy` đã bắt → `Lỗi: …`, exit 1, stderr) khi file hoặc thư mục chứa nó là symlink/junction (`lstatSync().isSymbolicLink()`, file thiếu thì bỏ qua). Gọi trước mọi lần ghi của lệnh, trên đúng danh sách file sắp ghi (gồm `settings.json` khi lệnh thay nó), để không ghi dở một nửa. Khác `setRunner` (exit 0 vì chỉ là gợi ý lưu ngầm), đây là lệnh người dùng gọi tường minh nên exit 1. `status` và nhánh không ghi gì (`autonomy safe` không có khoá) không bị ảnh hưởng.
- A2 (mục 2): một lần `git ls-files` mỗi gốc ứng viên thay cho 1–2 lần mỗi file. Lấy danh sách mọi `handoff.md` đã theo dõi: `git -C <gốc> ls-files -z -- ':(icase,glob)**/handoff.md'` (đã thử trong repo này: icase + glob chạy đúng, 87 ms một lần), cache theo gốc trong một lần `decide`. Ứng viên tên `handoff.md` nằm dưới gốc và không đi qua symlink (so `realpath` của file với `realpath(gốc)` + đường dẫn tương đối, không phân biệt hoa thường) tra thẳng trong tập; mọi ứng viên khác (symlink, `handoffPath` tên khác, batch lỗi) rơi về `gateTracked` từng file như cũ. Seam test mới `d.listTracked(dir)`; seam `d.tracked(p)` hiện có giữ nguyên.
- A3 (mục 3): gợi ý `"stopGate": false` chỉ hiện khi `gate` không phải `null`, tức trong repo git đã xác định được (`gate != null && (!gate.file || tracked(gate.file) === false)`). Seam `loadConfig` (không có `file`) vẫn nhận gợi ý như cũ.
- A4 (mục 4): `readAllowEnvFiles` so `realpathSync.native` của `root` và `g.top` (thêm hạ chữ thường trên win32) thay cho `path.resolve(root) !== g.top`; realpath lỗi thì rơi về so chuỗi như cũ.
- Không làm: không đổi `GATE_KEYS`, spec R20 (bảng khoá), `gate-file.mjs` (hai bản sao giữ nguyên), `settings.json` sinh ra; không thêm cảnh báo trong hook.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `.claude` (hoặc `.claude/aip-gate.json`) là symlink/junction trỏ ra ngoài project When chạy `aip mode full`, `aip mode ask`, `aip autonomy high` hoặc `aip autonomy safe` (có khoá `autonomy`) Then lệnh exit 1, stderr nêu file là symlink/junction, không file nào (kể cả ở đích của link và `settings.json`) bị tạo hay đổi.
- [ ] **AC1.2** — Given không có symlink When chạy bốn lệnh trên và `status` Then hành vi giữ nguyên (không hồi quy ở các test hiện có của `test/mode.test.mjs`).
- [ ] **AC2.1** — Given N ≥ 20 `handoff.md` ứng viên trong hạn tuổi When `session-start.decide` chạy với seam `listTracked` Then `listTracked` được gọi tối đa một lần mỗi gốc (≤ 2) và `gateTracked` không được gọi cho ứng viên tên `handoff.md` không đi qua symlink.
- [ ] **AC2.2** — Given repo git thật có `docs/requests/a/handoff.md` đã commit và `.claude/handoff.md` chưa theo dõi When `decide` chạy với `startup` Then chỉ nội dung file chưa theo dõi được nạp, file đã commit (kể cả viết `HANDOFF.MD` khác hoa/thường) bị bỏ.
- [ ] **AC2.3** — Given `listTracked` ném lỗi hoặc ứng viên đi qua symlink When `decide` chạy Then rơi về `gateTracked` từng file, kết quả như trước sửa (git lỗi vẫn coi là chưa theo dõi).
- [ ] **AC3.1** — Given phiên Stop ngoài repo git (không `loadConfig`, `resolveGate` trả `null`) When gate chặn vì sửa code chưa test Then lý do không chứa `"stopGate": false`, vẫn chứa `AIP_STOP_GATE=off`.
- [ ] **AC3.2** — Given trong repo git, file `aip-gate.json` thiếu hoặc chưa theo dõi When gate chặn Then lý do vẫn chứa gợi ý `"stopGate": false` (không hồi quy); file đã theo dõi hoặc git không xác định thì không có.
- [ ] **AC4.1** — Given worktree liên kết không có `aip-gate.json`, repo chính có file chưa theo dõi với `allowEnvFiles: true` When `readAllowEnvFiles(root)` với `root` là symlink/junction tới gốc worktree, và (win32) với ổ đĩa viết khác hoa/thường Then trả `true`, như khi `root` viết đúng.
- [ ] **AC4.2** — Given `root` là thư mục con thật của repo When gọi `readAllowEnvFiles` Then vẫn không thừa kế file của gốc git (hành vi hiện có, R8 cli-wizard).
- [ ] **AC5.1** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng version.

## Thiết kế

Tác động và vị trí:
- `cli/lib/mode.mjs`: thêm `assertNotLinked`, gọi trong `runModeUnsafe` trước nhánh `full` và `ask` ghi (danh sách file theo `settingsAction`).
- `cli/lib/autonomy.mjs`: gọi `assertNotLinked([file])` ngay trước `fs.mkdirSync`/`writeFileSync` (sau nhánh `safe` không có khoá, nên nhánh không ghi gì không bị từ chối).
- `core/hooks/scripts/session-start.mjs`: thay `handoffTracked` bằng hàm nhận `(file, root, d)` dùng tập đã liệt kê; `probe` truyền `root` (đã có trong tuple nguồn) vào `d.tracked`.
- `core/hooks/scripts/gate-stop.mjs`: một dòng điều kiện (A3).
- `cli/lib/init.mjs`: hàm `sameDir` nhỏ cho A4.
- Test: `test/mode.test.mjs` (AC1), `test/contract/90-hooks.contract.mjs` (AC2, AC3; dùng seam `listTracked`, `loadGate`/`resolveRoots` của `gate-stop`, kèm một ca repo git thật), `test/init.test.mjs` (AC4).
- Spec sống: `docs/specs/hooks-gates/spec.md` R19 (handoff kiểm theo gốc, một lần git), `docs/specs/cli-wizard/spec.md` R4 và R6 (từ chối ghi qua symlink), R8 (so gốc bằng realpath).
- Version: `core/.manifest.json` 1.33.5 → 1.33.6, rồi `node cli/lib/versions.mjs --lock` sau `npm run build`.

## Ảnh hưởng spec
- hooks-gates: đổi R19
- cli-wizard: đổi R4, đổi R6, đổi R8

## Ngoài phạm vi và anti-goal
- Không từ chối ghi khi `settings.json` là symlink nhưng lệnh không thay nó; không kiểm symlink ở các cha trên `root` (root do người dùng chọn).
- Không đo lại 78 ms bằng benchmark; chỉ kiểm số lần gọi git.
- Anti-goal: handoff đã commit không được nạp lại vì batch (không hạ mức chặn hiện có).

## Ràng buộc
- Zero-dependency; không đổi `gate-file.mjs` (giữ byte-identical với bản sao); fail-open của hook giữ nguyên.
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Không merge, không push khi người dùng chưa xác nhận.

## Kiểm thử
- AC1.1/AC1.2: `test/mode.test.mjs`, repo git tạm; liên kết tạo bằng junction (Windows, không cần quyền admin) hoặc symlink (POSIX); symlink file chỉ thử khi tạo được, nếu không bỏ ca đó.
- AC2.x, AC3.x: `test/contract/90-hooks.contract.mjs`; AC2.2 dùng git thật.
- AC4.x: `test/init.test.mjs` (junction/symlink tới worktree thật; ca ổ đĩa viết khác hoa/thường chỉ chạy trên win32).
- AC5.1: `npm run build`, `versions.mjs --lock`, `npm test`.
- Mỗi sửa một test hồi quy ở tầng thấp nhất; không thêm test lặp.

## Để builder quyết
- Chữ chính xác của thông báo lỗi A1 (nêu đường dẫn file và lý do symlink/junction).
- Tên hàm A2/A4; có đặt `assertNotLinked` ở `mode.mjs` hay một module nhỏ riêng nếu import vòng.

## Rủi ro và câu hỏi mở
- [Inference] Con số 78 ms/file lấy từ request trước; chưa đo lại, nên AC2 kiểm số lần gọi git thay vì thời gian.
- A2 bỏ qua handoff trong submodule: `git ls-files` ở gốc không liệt kê file bên trong submodule (nó chỉ thấy gitlink), nên `handoff.md` đã commit trong repo con nằm đúng ở `docs/requests/*/` hay `.aip/runs/*/` sẽ không bị nhận là đã theo dõi và được nạp. Bố cục như vậy không có trong quy ước; chấp nhận, ghi rủi ro.
- Từ chối ghi qua symlink đổi hành vi cho người đang dùng `.claude` là symlink có chủ ý (dotfiles). Họ phải sửa file qua đích thật hoặc bỏ link; thông báo lỗi nêu rõ. Chưa kiểm project nào dùng cách này.
- Câu mở cho người duyệt: lệnh `aip mode`/`aip autonomy` từ chối với exit 1 (đề xuất) hay bỏ qua im lặng exit 0 như `setRunner`?
