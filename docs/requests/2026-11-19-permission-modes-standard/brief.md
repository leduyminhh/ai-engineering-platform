# Brief: Chế độ quyền `bypass` cho hook aip
- Ngày: 2026-11-19
- Trạng thái: approved

## Vấn đề và loại việc
Feature cho hook của plugin `core`. Chế độ `full` hiện vẫn hỏi (ask) hoặc chặn (deny) ở nhiều chỗ: push nhánh bảo vệ theo
`fullKeep`, ghi `.claude/aip-gate.json`/`settings*.json`, đường dẫn không giải được, đọc ngoài root, file bí mật chưa đủ
quyền, ghi ngoài root, `<tmp>/claude`, `start_session` thiếu model, `mcpAllow`. Người dùng muốn một chế độ mới để phiên
chạy không người canh không bị popup nào của hook chặn lại.

Điểm đặc biệt: việc này cố ý nới cổng an toàn, nên ranh giới bật (điều kiện hiệu lực) phải chặt như `full`.

## Vì sao bây giờ và thành công trông thế nào
Người dùng đang chạy `full` (`fullKeep: []`) ở repo này mà vẫn gặp popup của hook. Thành công là:
- `aip mode bypass` ghi `"mode": "bypass"` và in cảnh báo rủi ro; `aip mode status` in `bypass`; `aip mode ask` gỡ nó.
- Phiên `bypassPermissions` trong project có file không bị git theo dõi: `guard-bash` không trả quyết định nào;
  `guard-files` chỉ còn deny theo `writeScope`; `guard-mcp` chỉ còn deny theo `mcpDeny`.
- Ba điều kiện thiếu một (file bị commit, phiên không bypass, `mode` khác) thì hành vi không đổi so với hiện tại.

## Goal, non-goal, anti-goal
- Goal: giá trị `mode: "bypass"` + lệnh `aip mode bypass`, hook bỏ mọi ask và deny trừ `writeScope` (H5) và `mcpDeny`.
- Goal: `aip mode bypass` xử lý `settings.json` như `aip mode full` (thay bằng bản rỗng khi trùng byte bản aip sinh) và
  in cảnh báo: đọc/ghi mọi nơi, file bí mật, push nhánh bảo vệ không còn hỏi; quay lại bằng `aip mode ask`.
- Phạm vi bỏ cụ thể (người dùng đã chọn "bỏ mọi deny trừ writeScope/mcpDeny" và "cho qua ghi cấu hình"):
  - `guard-bash`: bỏ toàn bộ, gồm H1 (push nhánh bảo vệ, force push), H2 (commit `-m` có dấu), H3 (file bí mật và khoá),
    ghi `aip-gate.json`/`settings*.json`, nhốt root, `<tmp>/claude`. Hook này không có deny cứng nào khác cho lệnh phá huỷ.
  - `guard-files`: bỏ `SECRET_DENY` (cả khoá riêng và `credentials*`), hỏi ghi file cấu hình, nhốt root, `<tmp>/claude`;
    giữ `writeScope`.
  - `guard-mcp`: bỏ deny `start_session` thiếu model (R16), `mcpAllow`, ask khi file cấu hình hỏng; giữ `mcpDeny`.
- Goal: phiên không bypass trong project `bypass` xử lý như `full` không bypass (`guard-bash` hỏi `git push`, `curl`,
  `wget`, `kubectl apply`, `terraform apply`, `helm upgrade`).
- Goal: cập nhật spec `hooks-gates`, `docs/aip-gate*.md` (thêm mục + mẫu `bypass`), README mục Hooks/CLI.
- Non-goal: Stop gate (`gate-stop`) và `session-start` không đổi.
- Non-goal: không thêm khoá mới; `fullRoots`/`fullPaths`/`fullKeep` không có tác dụng ở `bypass`.
- Anti-goal: không để `bypass` có hiệu lực từ file đã commit hoặc khi phiên không bypass (repo lạ không được tự tắt cổng).
- Anti-goal: không bỏ `writeScope` và `mcpDeny` (chặn do người dùng hoặc vai trò agent khai tường minh).

## Hiện trạng và tham khảo đã thấy
- Hiệu lực mode: `core/hooks/scripts/gate-config.mjs:32` (`effectiveMode`), `:38` (`fullEffective`, kiểm git theo dõi).
- `guard-bash` `decide`: các `return ask(...)` ở `core/hooks/scripts/guard-bash.mjs:1759-1835`, push `:1770`, ghi cấu
  hình `:1773`, nhốt root `:1799-1812`, phiên không bypass `:1815` (`gate()?.mode === 'full'`).
- `guard-files`: `confine` `core/hooks/scripts/guard-files.mjs:82-108`, `SECRET_DENY` `:79`, `guardConfigAsk` `:77`,
  `writeScope` sau `:130`.
- `guard-mcp` `decide`: `core/hooks/scripts/guard-mcp.mjs:33-49` (deny `start_session` thiếu model chạy trước cấu hình).
- CLI: `cli/lib/mode.mjs` (`aip mode full|ask|status`), test `test/mode.test.mjs`.
- Khoá `mode` trong `GATE_KEYS` (`core/hooks/scripts/gate-file.mjs`), mức tin cậy `untracked`.
- Spec sống `docs/specs/hooks-gates/spec.md` R6, R7, R8, R20; tài liệu `docs/aip-gate.md`, `docs/aip-gate_VI.md`.
- Chưa xem: test contract của hook (`test/contract/9*-*.contract.mjs`) ngoài tên file.

## Hướng đã cân nhắc
- **B, trả về sớm (chọn):** đầu `decide` của mỗi hook, nếu `bypass` hiệu lực thì `guard-bash` trả `null`, `guard-files`
  chỉ chạy `writeScope`, `guard-mcp` chỉ chạy `mcpDeny`. Ít code nhất, danh sách giữ lại tường minh, không có lỗi parse
  nào biến thành popup.
- A, lọc ở đầu ra (loại): `decide` chạy như `full` rồi một hàm chung bỏ ask/deny trừ quyết định đánh dấu giữ. Tốn công
  parse mỗi lệnh, và deny mới thêm sau này ngầm bị bỏ.
- Cờ trong `full` kiểu `fullAsk: false` (loại): người dùng chọn mode riêng có lệnh `aip mode bypass`.

## Quyết định của agent
- Hiệu lực của `bypass` dùng chung hàm kiểm của `full` (cùng ba điều kiện, cùng thứ tự đọc worktree rồi repo chính),
  chỉ khác giá trị `mode`. Người dùng đã chọn "cùng điều kiện bật như full" ở lượt hỏi đầu; không thêm ràng buộc mới.
- `phạm-vi: code-be` vì hook và CLI là code Node chạy phía máy, không có UI; vai thực thi theo `**Kind:**` của plan.
- Route chính `workflow-feature`; review cuối của nó đã có `engineering-quality-auditor` (bảo mật), nên không chạy
  `workflow-security-review` riêng.
- `aip mode status` ở `bypass` in thêm một dòng nói `fullKeep`, `fullRoots`, `fullReadRoots`, `fullPaths` không có tác
  dụng (nếu file có các khoá đó).
- Test hook chạy trên clone sạch, vì repo chính đang bật `mode: "full"` làm đỏ sẵn `94-permission-modes` (P4e AC1.3).
- Đổi spec: R6, R7, R8, R16, R20 (giá trị của `mode`) và thêm một R mới cho `bypass`.

## Phần đoán
- [giả định] `aip mode full` khi đang `bypass` (và ngược lại) chỉ đổi giá trị `mode`, giữ khoá khác như hiện nay.
- [giả định] Câu cảnh báo của `aip mode bypass` in ra stdout cùng các dòng `✓`, không đòi xác nhận tương tác.
- [giả định] Bump version core theo quy ước, không đổi plugin khác.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: mode bypass trong aip-gate.json + aip mode bypass, hook chỉ còn chặn writeScope và mcpDeny, spec và docs cập nhật
rủi-ro: bảo mật: tắt cổng quyền nên agent đọc ghi file bí mật, ghi ngoài project và push nhánh bảo vệ mà không hỏi
ứng-viên-route: [workflow-feature, workflow-security-review]
route-đã-duyệt: workflow-feature
