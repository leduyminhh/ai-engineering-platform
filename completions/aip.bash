# Bash completion for aip (AI Engineering Platform CLI)
# Cài: source completions/aip.bash  (xem SHELL_SETUP.md)

_aip_completions() {
  local cur prev
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  local commands="install uninstall build check list update help"
  local providers="all claude cursor codex antigravity"
  local plugins="all backend frontend data engineering ops"

  case "$prev" in
    --provider|--target)
      COMPREPLY=($(compgen -W "$providers" -- "$cur")); return ;;
    --plugin)
      COMPREPLY=($(compgen -W "$plugins" -- "$cur")); return ;;
    --scope)
      COMPREPLY=($(compgen -W "project global" -- "$cur")); return ;;
  esac

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur")); return
  fi

  COMPREPLY=($(compgen -W "--provider --plugin --scope --global -g --yes -y --help" -- "$cur"))
}

complete -F _aip_completions aip
complete -F _aip_completions ai-engineering-platform
