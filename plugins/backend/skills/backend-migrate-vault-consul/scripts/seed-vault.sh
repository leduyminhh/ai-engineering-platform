#!/usr/bin/env bash
# Seed SECRETS vào Vault KV v2 tại <backend>/<app>[/<profile>]. Đọc map phẳng từ vault-secrets.yml.
# Dùng: ./seed-vault.sh <đường-dẫn-vault-secrets.yml> [profile]
#   không profile -> path base <backend>/<app>
#   có profile    -> path <backend>/<app>/<profile> (P2 đa môi trường)
#   global        -> APP_NAME=global ./seed-vault.sh configs/vault/vault-secrets-global.yml
#                    (path <backend>/global — dùng chung mọi app)
# Env đọc từ .env: APP_NAME, VAULT_BACKEND, VAULT_URI. Seed dùng token admin (VAULT_TOKEN), KHÁC với
# AppRole của app lúc chạy. Yêu cầu: vault CLI + yq (chuyển YAML phẳng -> key=value). KHÔNG commit file secret.
set -euo pipefail

command -v yq >/dev/null 2>&1 || { echo "Thiếu 'yq' (mikefarah/yq) — cần để đọc vault-secrets.yml. Cài rồi chạy lại." >&2; exit 1; }
command -v vault >/dev/null 2>&1 || { echo "Thiếu 'vault' CLI." >&2; exit 1; }

APP="${APP_NAME:-my-app}"
BACKEND="${VAULT_BACKEND:-dls-hcm}"
SECRET_FILE="${1:-configs/vault/vault-secrets.yml}"
PROFILE="${2:-}"

if [ ! -f "$SECRET_FILE" ]; then
  echo "Không tìm thấy file secret: $SECRET_FILE" >&2
  exit 1
fi

export VAULT_ADDR="${VAULT_ADDR:-${VAULT_URI:-http://localhost:8200}}"
export VAULT_TOKEN="${VAULT_TOKEN:?Cần VAULT_TOKEN (token admin để seed)}"

# yq -o=props biến YAML phẳng (kể cả key có dấu chấm) thành từng dòng key=value.
args=()
while IFS='=' read -r k v; do
  k="$(echo "$k" | xargs)"          # trim
  [ -z "$k" ] && continue
  v="${v# }"                         # bỏ 1 space đầu
  args+=("${k}=${v}")
done < <(yq -o=props '.' "$SECRET_FILE")

if [ "${#args[@]}" -eq 0 ]; then
  echo "Không có secret nào trong $SECRET_FILE" >&2
  exit 1
fi

if [ -n "$PROFILE" ]; then VPATH="${BACKEND}/${APP}/${PROFILE}"; else VPATH="${BACKEND}/${APP}"; fi
vault kv put "$VPATH" "${args[@]}"
echo "OK: seeded ${VPATH} <- ${SECRET_FILE} (${#args[@]} keys)"
