# Cấu hình `.claude/aip-gate.json`

> English: xem [aip-gate.md](aip-gate.md).

File này chỉnh hành vi các hook của plugin `core` theo từng project: chế độ quyền, Stop gate, MCP, nội dung nạp đầu
phiên và mức tự chủ của `plan-execution`. Trang này gom mọi khoá vào một chỗ và đưa sẵn JSON mẫu cho từng chế độ. Chi
tiết từng quy tắc của hook (H1–H6, cách giải đường dẫn) nằm ở mục **Hooks** của [README_VI.md](../README_VI.md#hooks).

## File nằm ở đâu, được đọc thế nào

- Đường dẫn: `<git-root>/.claude/aip-gate.json`. Không có bản global, không thừa kế từ thư mục cha. Ngoài repo git thì
  hook không đọc file nào.
- Trong worktree: hook đọc file ở gốc worktree trước, thiếu thì lấy file của repo chính. File của worktree tồn tại mà
  hỏng (JSON lỗi, không phải đối tượng) thì coi như không có cấu hình, không rơi về repo chính.
- Mỗi khoá có một mức tin cậy:
  - **untracked**: khoá nới quyền. Chỉ có hiệu lực khi git **không** theo dõi file. File đã commit (đến từ clone mà bạn
    chưa xét) thì khoá rơi về mặc định.
  - **any**: khoá siết hoặc trung tính, file đã commit vẫn có hiệu lực.
- Nên thêm `.claude/aip-gate.json` vào `.gitignore`. `aip mode status` và `aip autonomy status` in trạng thái git của
  file và dòng `Khoá bị bỏ qua` khi có khoá không có hiệu lực.
- Không sửa file này bằng Write/Edit của agent: hook sẽ hỏi. Dùng `aip mode`, `aip autonomy`, hoặc tự sửa tay.

## Bảng khoá

| Khoá | Kiểu | Tin cậy | Mặc định | Tác dụng |
|---|---|---|---|---|
| `mode` | string | untracked | `ask` | `"full"` bật chế độ full (xem dưới). Giá trị khác hoặc thiếu là `ask`. |
| `fullKeep` | array | untracked | `["push"]` | Ở full, các cổng vẫn hỏi. Hiện chỉ có `"push"`. `[]` là mở hết; mảng có phần tử nhưng không nhận ra phần tử nào (gõ sai `"Push"`) thì giữ mặc định. |
| `fullRoots` | array | untracked | `[]` | Ở full, thư mục tuyệt đối ngoài project được đủ ba quyền đọc, ghi, xoá. |
| `fullReadRoots` | array | untracked | `[]` | Ở full, thư mục tuyệt đối chỉ được đọc. |
| `fullPaths` | array | untracked | `[]` | Ở full, quyền theo thư mục: `[{"path": "<tuyệt đối>", "allow": ["read","write","delete"]}]`. |
| `allowEnvFiles` | boolean | untracked | `false` | `true` thì không chặn/hỏi file env (`.env*`, `*.env`, `.envrc`). File khoá và `credentials*` vẫn bị chặn. |
| `stopGate` | boolean | untracked | bật | `false` tắt Stop gate (chặn một lần khi sửa code mà chưa chạy test/lint/build). |
| `testCommands` | array | untracked | không có mẫu thêm | Regex bổ sung để Stop gate nhận ra lệnh test của project, vd `"^make test\\b"`. Regex sai bị bỏ. |
| `exemptAgents` | array | untracked | `["data-migration-writer"]` | Agent không bị Stop gate chặn ở `SubagentStop`. |
| `autonomy` | object | untracked | `{mergeLocal: false, cleanup: false, partRunner: "session", planRunner: "subagent"}` | Mức hỏi của luồng `plan-execution`. Không phải quyền công cụ, không hook nào thi hành. |
| `mcpAllow` | array | any | không lọc | Chỉ cho server MCP trong danh sách. Ở full hiệu lực thì bỏ qua. |
| `mcpDeny` | array | any | không lọc | Chặn server MCP trong danh sách. Thắng `mcpAllow`, giữ cả ở full. |
| `bootstrapInject` | boolean | any | bật | `false` thì đầu phiên không nạp quy tắc gọi skill. |
| `handoffInject` | boolean | any | bật | `false` thì không nạp `handoff.md`. |
| `ledgerInject` | boolean | any | bật | `false` thì không nạp đuôi ledger `.aip/runs/*/*/progress.md`. |
| `resumeWarn` | boolean | any | bật | `false` thì không cảnh báo khi resume/fork phiên nguội. |
| `handoffPath` | string | any | tự tìm | File `.md` trong cwd của phiên dùng làm handoff. Trỏ ra ngoài hoặc không phải `.md` thì bị bỏ. |
| `handoffMaxAgeHours` | number | any | `24` | Tuổi tối đa của handoff và ledger được nạp. |
| `statusStaleMinutes` | number | any | `30` | Ngưỡng phút im lặng để `aip status` xếp part vào "im lặng quá lâu". |

Tên server MCP là `<server>` hoặc `plugin:<plugin>:<server>`, so khớp phân biệt hoa thường.

## Chế độ `ask` (mặc định)

Mọi cổng chạy đầy đủ: hỏi khi push nhánh bảo vệ hay force push, chặn commit `-m` có dấu, chặn/hỏi file bí mật, giữ
`writeScope` của agent, áp `mcpAllow`/`mcpDeny`. `.claude/settings.json` giữ các quy tắc `deny`/`ask` do `aip init --full`
sinh. Không cần file `aip-gate.json`; chỉ tạo khi muốn chỉnh khoá khác.

Mẫu `ask` có chỉnh Stop gate, MCP và nạp đầu phiên:

```json
{
  "testCommands": ["^make test\\b", "^pnpm vitest\\b"],
  "mcpDeny": ["plugin:playwright:playwright"],
  "handoffMaxAgeHours": 48
}
```

Quay về `ask` từ `full`: `aip mode ask` (bỏ khoá `mode`, giữ khoá khác).

## Chế độ `full`

Dành cho project bạn tin, để agent chạy không người canh. Chỉ hiệu lực khi **đủ cả ba**:

1. `aip-gate.json` có `"mode": "full"`.
2. Phiên chạy với `permission_mode` là `bypassPermissions` (khởi động `claude --permission-mode bypassPermissions` hoặc
   đặt trong settings người dùng; settings của project không bật được bypass).
3. Git không theo dõi `aip-gate.json`.

Thiếu một điều kiện thì chạy như `ask`. Phiên không bypass trong project `full` thì `guard-bash` tự hỏi với `git push`,
`curl`, `wget`, `kubectl apply`, `terraform apply`, `helm upgrade`, vì quy tắc `ask` của `settings.json` đã bị gỡ.

Khi hiệu lực:

- Bỏ: chặn commit `-m` có dấu, chặn/hỏi file bí mật trong các root, `mcpAllow`.
- Giữ: hỏi push theo `fullKeep` (mặc định vẫn hỏi), `writeScope` của agent, `mcpDeny`, Stop gate, nạp đầu phiên.
- Nhốt root (heuristic, không phải sandbox): root gồm gốc project (và gốc repo chính khi ở worktree), `scratchpad_dir`
  của phiên, `<tmpdir>/claude`, `fullRoots`. Ghi ra ngoài root bị deny, đọc ngoài root thì hỏi, đường dẫn không giải
  được (`$VAR`, `~`, glob lạ) thì hỏi. Chính thư mục `<tmpdir>/claude` luôn bị chặn.
- Vẫn hỏi: ghi `.claude/aip-gate.json` hoặc `.claude/settings*.json`.

Bật: `aip mode full`. Lệnh ghi `"mode": "full"` (giữ khoá khác) và thay `.claude/settings.json` bằng
`{"permissions":{"deny":[],"ask":[]}}` chỉ khi file đó trùng byte bản aip sinh; khác thì để nguyên và liệt kê quy tắc cần
tự gỡ. Kiểm lại bằng `aip mode status`.

### Mẫu `full` tối thiểu

Push nhánh bảo vệ và force push vẫn hỏi, chỉ làm việc trong project:

```json
{
  "mode": "full"
}
```

### Mẫu `full` chạy không người canh

Mở push, cho ghi thêm một thư mục output, đọc một thư mục dữ liệu, đọc `.env`, và bật mức tự chủ cao cho `plan-execution`
(duyệt G3 là merge local, tự dọn nhánh đã merge):

```json
{
  "mode": "full",
  "fullKeep": [],
  "fullRoots": ["E:/work/shared-out"],
  "fullReadRoots": ["E:/datasets"],
  "fullPaths": [
    { "path": "E:/cache", "allow": ["read", "write"] },
    { "path": "E:/scratch", "allow": ["read", "write", "delete"] }
  ],
  "allowEnvFiles": true,
  "autonomy": {
    "mergeLocal": true,
    "cleanup": true,
    "partRunner": "subagent",
    "planRunner": "subagent"
  }
}
```

Lưu ý khi dùng `fullPaths`:

- `path` phải tuyệt đối; mục sai (`path` tương đối, `allow` không phải mảng) bị bỏ lặng lẽ.
- Ba quyền độc lập: `write` không kéo theo `read`, `delete` không kéo theo `write`. Mục cùng `path` chỉ cộng quyền.
- `Read`/`Grep` cần `read` (thiếu thì hỏi); `Write`/`Edit` cần `write` (thiếu thì deny); `rm`, nguồn của `mv` cần `delete`.
- File giống bí mật chỉ được miễn hỏi ở thư mục có đủ ba quyền.

`autonomy` có thể đặt bằng lệnh thay vì sửa tay: `aip autonomy high` ghi `mergeLocal`, `cleanup`, `partRunner`;
`aip autonomy safe` gỡ chúng. Lệnh này độc lập với `aip mode` và không cần bypass.

## Giới hạn

Hook là cổng regex, không phải sandbox: symlink, `sed -i`, `find -delete`, chương trình tự ghi file không được phân loại
theo quyền. Windows native không có sandbox, nên "trong project" chỉ là cấu hình của hook. Muốn nhốt thật thì dùng WSL2,
VM hoặc container. Danh sách đầy đủ ở mục **Giới hạn / residual risk** của [README_VI.md](../README_VI.md#hooks).
