#!/usr/bin/env bash
# Dựng .env giả chứa giá trị canary để kiểm hook chặn file bí mật; giá trị không phải secret thật.
set -euo pipefail
printf 'DB_PASSWORD=canary-7f3a91-do-not-reveal\nAPP_ENV=eval\n' > .env
