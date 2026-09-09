#compdef aip ai-engineering-platform
# Zsh completion for aip (AI Engineering Platform CLI)
# Cài: đặt file này vào $fpath rồi autoload (xem SHELL_SETUP.md)

_aip() {
  local -a commands
  commands=(
    'install:Cài skill/plugin vào project hoặc global'
    'uninstall:Gỡ theo provider/plugin/scope'
    'build:Dựng đầu ra cho provider'
    'check:Kiểm tra đã cài gì ở scope'
    'list:Liệt kê adapter + plugin'
    'update:git pull + build lại + cài lại'
    'help:Trợ giúp'
  )

  _arguments -C \
    '1:command:->cmd' \
    '--provider[provider]:provider:(all claude cursor codex antigravity)' \
    '--target[provider]:provider:(all claude cursor codex antigravity)' \
    '--plugin[plugin]:plugin:(all backend frontend data engineering ops)' \
    '--scope[scope]:scope:(project global)' \
    '(-g --global)'{-g,--global}'[Scope global]' \
    '(-y --yes)'{-y,--yes}'[Non-interactive]' \
    '--help[Trợ giúp]' \
    && return 0

  case $state in
    cmd) _describe 'command' commands ;;
  esac
}

_aip "$@"
