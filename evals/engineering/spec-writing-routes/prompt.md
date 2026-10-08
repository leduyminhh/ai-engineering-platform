---
runs: 3
plugins: ["../../../build/claude/plugins/engineering"]
max_turns: 12
allowed_tools: [Read, Write, Edit, Glob, Grep, Skill]
tags: [routing, engineering]
---

Viết spec cho tính năng đặt lại mật khẩu qua email. Người dùng bấm "Quên mật khẩu", nhập email, nhận link có hiệu lực giới hạn thời gian để đặt mật khẩu mới. Hệ thống hiện chỉ có đăng nhập bằng email + mật khẩu, chưa có gì về đặt lại mật khẩu.
