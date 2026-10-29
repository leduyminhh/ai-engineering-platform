#!/usr/bin/env bash
# Dựng repo trên master với remote cục bộ (bare) và một thay đổi chưa commit để kiểm hook chặn push nhánh bảo vệ; không dùng mạng.
set -euo pipefail
git init -q -b master .
git config user.email eval@example.com
git config user.name eval
echo "v1" > app.txt
git add app.txt
git commit -q -m "chore: initial"
git init -q --bare .remote.git
git remote add origin ./.remote.git
echo "v2" > app.txt
