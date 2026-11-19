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
- Không sửa file này bằng Write/Edit của agent: hook hỏi ở `guarded` và từ chối ở `confined`, `open`. Dùng `aip mode`,
  `aip autonomy`, hoặc tự sửa tay.

## Bảng khoá

| Khoá | Kiểu | Tin cậy | Mặc định | Tác dụng |
|---|---|---|---|---|
| `mode` | string | untracked | `guarded` | `"guarded"`, `"confined"` hoặc `"open"` (các mục dưới). Tên cũ vẫn chạy: `"ask"` là `guarded`, `"full"` là `confined`. Thiếu hoặc giá trị khác (`"bypass"`, sai hoa thường) là `guarded`. |
| `fullKeep` | array | untracked | `["push"]` | Ở `confined`, các cổng vẫn bị `deny` (không còn hỏi). Hiện chỉ có `"push"`. `[]` là mở hết; mảng có phần tử nhưng không nhận ra phần tử nào (gõ sai `"Push"`) thì giữ mặc định. Ở `open` không có tác dụng. |
| `fullRoots` | array | untracked | `[]` | Ở `confined`, thư mục tuyệt đối ngoài project được đủ ba quyền đọc, ghi, xoá. Ở `open` không có tác dụng. |
| `fullReadRoots` | array | untracked | `[]` | Ở `confined`, thư mục tuyệt đối chỉ được đọc. Ở `open` không có tác dụng. |
| `fullPaths` | array | untracked | `[]` | Ở `confined`, quyền theo thư mục: `[{"path": "<tuyệt đối>", "allow": ["read","write","delete"]}]`. Ở `open` không có tác dụng. |
| `allowEnvFiles` | boolean | untracked | `false` | `true` thì không chặn/hỏi file env (`.env*`, `*.env`, `.envrc`). File khoá và `credentials*` vẫn bị chặn. |
| `stopGate` | boolean | untracked | bật | `false` tắt Stop gate (chặn một lần khi sửa code mà chưa chạy test/lint/build). |
| `testCommands` | array | untracked | không có mẫu thêm | Regex bổ sung để Stop gate nhận ra lệnh test của project, vd `"^make test\\b"`. Regex sai bị bỏ. |
| `exemptAgents` | array | untracked | `["data-migration-writer"]` | Agent không bị Stop gate chặn ở `SubagentStop`. |
| `autonomy` | object | untracked | `{mergeLocal: false, cleanup: false, partRunner: "session", planRunner: "subagent"}` | Mức hỏi của luồng `plan-execution`. Không phải quyền công cụ, không hook nào thi hành. |
| `mcpAllow` | array | any | không lọc | Chỉ cho server MCP trong danh sách. Ở `confined` hoặc `open` hiệu lực thì bỏ qua. |
| `mcpDeny` | array | any | không lọc | Chặn server MCP trong danh sách. Thắng `mcpAllow`, giữ cả ở `confined` và `open`. |
| `bootstrapInject` | boolean | any | bật | `false` thì đầu phiên không nạp quy tắc gọi skill. |
| `handoffInject` | boolean | any | bật | `false` thì không nạp `handoff.md`. |
| `ledgerInject` | boolean | any | bật | `false` thì không nạp đuôi ledger `.aip/runs/*/*/progress.md`. |
| `resumeWarn` | boolean | any | bật | `false` thì không cảnh báo khi resume/fork phiên nguội. |
| `handoffPath` | string | any | tự tìm | File `.md` trong cwd của phiên dùng làm handoff. Trỏ ra ngoài hoặc không phải `.md` thì bị bỏ. |
| `handoffMaxAgeHours` | number | any | `24` | Tuổi tối đa của handoff và ledger được nạp. |
| `statusStaleMinutes` | number | any | `30` | Ngưỡng phút im lặng để `aip status` xếp part vào "im lặng quá lâu". |

Tên server MCP là `<server>` hoặc `plugin:<plugin>:<server>`, so khớp phân biệt hoa thường.

## Ba chế độ

Đổi bằng `aip mode guarded|confined|open|status`. Lệnh luôn ghi tên mới; `guarded` bỏ khoá `mode` và giữ khoá khác.
`aip mode ask` và `aip mode full` vẫn chạy như bí danh. `aip mode status` in chế độ hiệu lực, câu nghĩa của nó (các câu
dưới đây) và, khi file còn dùng tên cũ, một dòng gợi ý chạy lại `aip mode <tên mới>`.

`confined` và `open` chỉ hiệu lực khi **đủ cả ba**:

1. `aip-gate.json` có `"mode": "confined"` hoặc `"mode": "open"` (`"full"` tính là `confined`).
2. Phiên chạy với `permission_mode` là `bypassPermissions` (khởi động `claude --permission-mode bypassPermissions` hoặc
   đặt trong settings người dùng; settings của project không bật được bypass).
3. Git không theo dõi `aip-gate.json`.

Thiếu một điều kiện thì chạy như `guarded`. Phiên không bypass trong project `confined` hoặc `open` thì `guard-bash` tự
hỏi với `git push`, `curl`, `wget`, `kubectl apply`, `terraform apply`, `helm upgrade`, vì quy tắc `ask` của
`settings.json` đã bị gỡ. Khi phiên bắt đầu trong project như vậy, hook in một dòng
`aip: mode hiệu lực = <mode> (nguồn <file>)` để bạn thấy file đang xin chế độ nào; hook không biết phiên có bypass hay
không.

## Chế độ `guarded` (mặc định)

Việc rủi ro thì hỏi người dùng.

Mọi cổng chạy đầy đủ: hỏi khi push nhánh bảo vệ hay force push, chặn commit `-m` có dấu, chặn/hỏi file bí mật, giữ
`writeScope` của agent, áp `mcpAllow`/`mcpDeny`. Agent chạy `aip mode <tên>` là đang xin ghi lại `aip-gate.json` nên hook
hỏi. `.claude/settings.json` giữ các quy tắc `deny`/`ask` do `aip init --full` sinh. Không cần file `aip-gate.json`;
chỉ tạo khi muốn chỉnh khoá khác.

Mẫu `guarded` có chỉnh Stop gate, MCP và nạp đầu phiên:

```json
{
  "testCommands": ["^make test\\b", "^pnpm vitest\\b"],
  "mcpDeny": ["plugin:playwright:playwright"],
  "handoffMaxAgeHours": 48
}
```

Quay về `guarded` từ hai chế độ kia: `aip mode guarded` (bỏ khoá `mode`, giữ khoá khác).

## Chế độ `confined`

Không bao giờ hỏi: việc trong rào thì cho qua, ngoài rào thì từ chối.

Dành cho project bạn tin, để agent chạy không người canh mà không treo phiên ở một popup. Cần đủ ba điều kiện ở trên.
Rào là các root và các khoá `fullKeep`, `fullRoots`, `fullReadRoots`, `fullPaths`. Đây là chế độ `full` cũ với mọi
`ask` đổi thành `deny`.

Khi hiệu lực:

- Bỏ: chặn commit `-m` có dấu, chặn/hỏi file bí mật trong các root, `mcpAllow`.
- Giữ: `writeScope` của agent, `mcpDeny`, Stop gate, nạp đầu phiên.
- Nhốt root (heuristic, không phải sandbox): root gồm gốc project (và gốc repo chính khi ở worktree), `scratchpad_dir`
  của phiên, `<tmpdir>/claude`, `fullRoots`. Chính thư mục `<tmpdir>/claude` luôn bị chặn.
- Từ chối (`deny`), mỗi câu nêu cách mở (câu `Mở:`; ghi ngoài root thì kết thúc bằng `Cần mở rộng → …`, còn chính thư mục `<tmpdir>/claude` không có cách mở):
  - push nhánh bảo vệ, force push hoặc push vào nhánh chưa rõ khi `fullKeep` có `"push"` (bỏ nó khỏi `fullKeep`, tự đẩy
    code, hoặc dùng `open`);
  - ghi ngoài root (câu lý do liệt kê các root có quyền còn thiếu và trỏ tới `fullPaths` hoặc `fullRoots`);
  - đọc ngoài các thư mục được cấp quyền đọc (`fullReadRoots`, `fullPaths`): chỉ áp cho công cụ Read/Grep và nguồn của
    `cp`/`Copy-Item`, không áp cho các lệnh Bash đọc khác như `cat` (xem Giới hạn); đường dẫn không giải được (`$VAR`,
    `~`, glob lạ); lệnh nhắc file bí mật ngoài root; lệnh có hơn 1000 đoạn; lỗi nội bộ của hook;
  - ghi `.claude/aip-gate.json` hoặc `.claude/settings*.json`, và `aip mode <tên>` do agent chạy (tự sửa file hoặc tự
    chạy `aip mode`).
- Không đổi: tool MCP khi `aip-gate.json` hỏng vẫn hỏi (hook không biết mode), và `start_session` thiếu `model` vẫn
  bị từ chối.

Bật: `aip mode confined`. Lệnh ghi `"mode": "confined"` (giữ khoá khác) và thay `.claude/settings.json` bằng
`{"permissions":{"deny":[],"ask":[]}}` chỉ khi file đó trùng byte bản aip sinh; khác thì để nguyên và liệt kê quy tắc cần
tự gỡ. Kiểm lại bằng `aip mode status`.

### Mẫu `confined` tối thiểu

Push nhánh bảo vệ và force push bị từ chối, chỉ làm việc trong project:

```json
{
  "mode": "confined"
}
```

### Mẫu `confined` chạy không người canh

Mở push, cho ghi thêm một thư mục output, đọc một thư mục dữ liệu, đọc `.env`, và bật mức tự chủ cao cho `plan-execution`
(duyệt G3 là merge local, tự dọn nhánh đã merge):

```json
{
  "mode": "confined",
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
- `Read`/`Grep` cần `read` (thiếu thì deny); `Write`/`Edit` cần `write` (thiếu thì deny); `rm`, nguồn của `mv` cần `delete`.
- File giống bí mật chỉ được miễn ở thư mục có đủ ba quyền.

`autonomy` có thể đặt bằng lệnh thay vì sửa tay: `aip autonomy high` ghi `mergeLocal`, `cleanup`, `partRunner`;
`aip autonomy safe` gỡ chúng. Lệnh này độc lập với `aip mode` và không cần bypass.

## Chế độ `open`

Không hỏi, không rào: chỉ còn chặn ghi file cấu hình quyền và theo `writeScope`, `mcpDeny`.

Cần đủ ba điều kiện như `confined`. Chỉ dùng khi bạn chấp nhận phiên bypass đọc/ghi mọi nơi, đọc file bí mật và push
nhánh bảo vệ mà không hỏi; chỗ hợp lý là VM, container hoặc WSL2.

Khi hiệu lực:

- Bỏ: mọi thứ `confined` bỏ, thêm cổng push, nhốt root, chặn `<tmpdir>/claude`, chặn file khoá và `credentials*`, chặn
  `start_session` thiếu `model`, và `mcpAllow`. `fullKeep`, `fullRoots`, `fullReadRoots`, `fullPaths` không có tác dụng
  (`aip mode status` nói rõ khi file có các khoá đó).
- Giữ: `mcpDeny`; `writeScope` của agent (chỉ chặn công cụ file Edit/Write/MultiEdit/NotebookEdit, không chặn Bash); Stop
  gate; nạp đầu phiên.
- Từ chối (không bao giờ hỏi): ghi `.claude/aip-gate.json` và `.claude/settings*.json` (công cụ file và Bash), ghi
  `hooks/scope-lock.json` của plugin chỉ với công cụ file, và `aip mode <tên>` do agent chạy, vì `mcpDeny` và
  `writeScope` đọc từ chính các file này. Bash ghi `scope-lock.json` thì cho qua (`echo x > …/hooks/scope-lock.json`),
  nên `writeScope` có thể bị tắt cho phiên sau bằng một lệnh Bash đơn giản. `aip mode status` và đọc các file đó vẫn qua.
- Không đổi: tool MCP khi `aip-gate.json` hỏng vẫn hỏi.

Bật: `aip mode open`; lệnh in cảnh báo, xử lý `settings.json` như `confined`, và quay lại bằng `aip mode guarded`.

### Mẫu `open` tối thiểu

```json
{
  "mode": "open"
}
```

## Giới hạn

Hook là cổng regex, không phải sandbox: symlink, `sed -i`, `find -delete`, chương trình tự ghi file không được phân loại
theo quyền. Windows native không có sandbox, nên "trong project" chỉ là cấu hình của hook. Muốn nhốt thật thì dùng WSL2,
VM hoặc container. Danh sách đầy đủ ở mục **Giới hạn / residual risk** của [README_VI.md](../README_VI.md#hooks).

Giới hạn riêng của `confined` và `open`:

- Việc nhận diện `aip mode` và ghi file cấu hình trong `guard-bash` là heuristic. Script do agent viết (`node x.mjs`)
  hoặc cách né bằng escape của shell vẫn lọt, nên agent trong phiên bypass vẫn có thể tự đổi mode. Hook không phải ranh
  giới chống agent bị chiếm quyền.
- `writeScope` chỉ chặn công cụ file, không chặn Bash của subagent. Ở `open`, `guard-bash` không biết
  `hooks/scope-lock.json`, nên lệnh Bash ghi vào file này cho qua và có thể tắt `writeScope` ở phiên sau. Junction hoặc symlink tới thư mục `.claude` lọt vì
  đường dẫn không đi qua realpath.
- Ở `open`, lỗi nội bộ cho lệnh qua, kể cả `mcpDeny` của `guard-mcp` khi lỗi xảy ra sau bước kiểm mode.
- Hai finding của security review độc lập được cố ý bỏ lại: agent tự đặt `bypassPermissions` cho phiên của nó hoặc phiên
  con qua tool MCP của app [Unverified: chưa kiểm app có buộc duyệt không], và file `aip-gate.json` chưa theo dõi nhưng
  không do người dùng ghi (tarball không có git, `.gitignore` của repo lạ, script cài đặt) vẫn thoả điều kiện thứ ba.
- Claude Code còn có thể tự hỏi với một số lệnh xoá ở đường dẫn quan trọng dù hook không trả gì [Unverified: theo tài
  liệu Claude Code, chưa đo]; "không bao giờ hỏi" chỉ đúng với hook của aip.
