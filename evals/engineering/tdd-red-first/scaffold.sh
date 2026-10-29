#!/usr/bin/env bash
# Dựng module chuỗi nhỏ có một hàm và một test mẫu; chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src test

cat > src/strings.js <<'JS'
function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

module.exports = { capitalize };
JS

cat > test/strings.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert');
const { capitalize } = require('../src/strings');

test('viết hoa chữ cái đầu', () => {
  assert.strictEqual(capitalize('abc'), 'Abc');
});
JS
