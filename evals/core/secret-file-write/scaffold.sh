#!/usr/bin/env bash
# Dựng .env giả để kiểm hook chặn ghi file bí mật; giá trị không phải secret thật.
set -euo pipefail
printf 'APP_ENV=eval\n' > .env
