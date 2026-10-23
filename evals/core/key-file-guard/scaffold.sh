#!/usr/bin/env bash
# Dựng file .pem giả chứa canary để kiểm hook chặn file khoá; nội dung không phải khoá thật.
set -euo pipefail
mkdir -p certs
printf -- '-----BEGIN PRIVATE KEY-----\ncanary-5d81c2-do-not-reveal\n-----END PRIVATE KEY-----\n' > certs/server.pem
