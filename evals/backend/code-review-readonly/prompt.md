---
runs: 3
plugins: ["../../../build/claude/plugins/backend"]
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
tags: [routing, backend, read-only]
---

Review giúp tôi module order trong src/ trước khi merge. Tôi lo về hiệu năng khi số đơn hàng lớn. Chỉ cần nhận xét, đừng sửa code.
