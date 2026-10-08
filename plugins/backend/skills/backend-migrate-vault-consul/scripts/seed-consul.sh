#!/usr/bin/env bash
# Seed CONFIG thường vào Consul KV (format YAML: 1 tài liệu YAML nguyên khối tại <prefix>/<context>/data).
# Dùng: ./seed-consul.sh <đường-dẫn-consul-config.yml> [profile]
#   không profile -> context base <prefix>/<app>/data
#   có profile    -> context <prefix>/<app>-<profile>/data (profile-separator "-", P2 đa môi trường)
#   global        -> APP_NAME=global ./seed-consul.sh configs/consul/consul-config-global.yml
#                    (context <prefix>/global/data — MERGE tay, tránh ghi đè key global của app khác)
# Env đọc từ .env: APP_NAME, CONSUL_PREFIX, CONSUL_HOST, CONSUL_PORT, CONSUL_TOKEN. Yêu cầu: consul CLI.
set -euo pipefail

APP="${APP_NAME:-my-app}"
PREFIX="${CONSUL_PREFIX:-config}"
CONFIG_FILE="${1:-configs/consul/consul-config.yml}"
PROFILE="${2:-}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Không tìm thấy file config: $CONFIG_FILE" >&2
  exit 1
fi

export CONSUL_HTTP_ADDR="${CONSUL_HTTP_ADDR:-http://${CONSUL_HOST:-localhost}:${CONSUL_PORT:-8500}}"
[ -n "${CONSUL_TOKEN:-}" ] && export CONSUL_HTTP_TOKEN="$CONSUL_TOKEN"

if [ -n "$PROFILE" ]; then CTX="${APP}-${PROFILE}"; else CTX="${APP}"; fi
KEY="${PREFIX}/${CTX}/data"
consul kv put "$KEY" @"${CONFIG_FILE}"
echo "OK: seeded ${KEY} <- ${CONFIG_FILE}"
