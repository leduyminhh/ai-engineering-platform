# Shell Completions for aip

Tab-completion cho CLI `aip` (và alias `ai-engineering-platform`): hoàn tất lệnh, provider,
plugin và cờ. File hoàn tất nằm trong `completions/`.

## Bash

Thêm vào `~/.bashrc`:

```bash
source /duong-dan/toi/ai-engineering-platform/completions/aip.bash
```

Hoặc chép vào thư mục completion hệ thống:

```bash
cp completions/aip.bash /etc/bash_completion.d/aip
```

Mở terminal mới (hoặc `source ~/.bashrc`) để nạp.

## Zsh

Đặt `completions/aip.zsh` vào một thư mục trong `$fpath` với tên `_aip`, rồi bật `compinit`.

```zsh
# ví dụ: dùng thư mục completion riêng
mkdir -p ~/.zsh/completions
cp completions/aip.zsh ~/.zsh/completions/_aip

# thêm vào ~/.zshrc (trước compinit)
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

## Cách dùng

```bash
aip <Tab>                      # install uninstall build check list update pack help
aip install --provider <Tab>   # all claude cursor codex antigravity
aip install --plugin <Tab>     # all backend frontend data engineering ops
aip install --provider claude --<Tab>   # --plugin --scope --global --yes ...
```

## Lệnh khả dụng

| Lệnh | Mô tả |
|------|-------|
| `install` | Cài skill/plugin vào project (mặc định) hoặc global |
| `uninstall` | Gỡ theo provider/plugin/scope |
| `build` | Dựng đầu ra cho provider vào `build/<provider>/` |
| `check` | Kiểm tra đã cài gì ở scope (đọc manifest) |
| `list` | Liệt kê adapter + plugin |
| `update` | git pull + build lại + cài lại các install đã ghi |
| `pack` | Đóng gói skill Cowork ra `build/cowork/<skill>.zip` |
| `help` | Trợ giúp |

## Cờ chung

| Cờ | Ý nghĩa |
|----|---------|
| `--provider <p>` / `--target <p>` | Chọn provider (`all` hoặc `claude,cursor,codex,antigravity`) |
| `--plugin <id>` | Chọn plugin (`all` hoặc danh sách phẩy) |
| `--scope <s>` | `project` (mặc định) hoặc `global` |
| `-g` / `--global` | Rút gọn của `--scope global` |
| `-y` / `--yes` | Non-interactive (bỏ wizard) |
| `--as-plugin` | (chỉ `install` + Claude) cài như plugin thật qua CLI `claude` |
| `--help` | Trợ giúp |

Không có cờ chọn rõ ràng và stdin là TTY → `aip` mở wizard tương tác.

## Khắc phục

- Completion không chạy: xác nhận đã `source` đúng file và mở shell mới.
- Zsh báo "command not found: compdef": thêm `autoload -Uz compinit && compinit` vào `~/.zshrc`.
- `aip` chưa có trên PATH: chạy `npm link` trong repo, hoặc gọi `node cli/index.mjs`.
