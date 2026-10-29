---
name: using-aip
description: "Quy tắc gọi skill trước khi hành động: kiểm skill áp dụng, ưu tiên theo thứ tự, nhận ra các cách tự biện minh để bỏ qua. Dùng khi người dùng muốn \"bắt đầu phiên mới\", \"chọn skill phù hợp\", \"có skill nào áp dụng không\", hoặc khi vừa mở phiên làm việc. Không dùng khi cần chọn một workflow cho yêu cầu cụ thể → workflow-orchestrator."
order: 6
title: "Using AIP — gọi skill trước khi hành động (dùng chung)"
runsIn: execute
invoke: per-request
---

# Using AIP (skill dùng chung)

Skill của bộ chỉ có tác dụng khi được gọi. Skill này đặt một quy tắc duy nhất cho đầu mỗi phiên: kiểm skill áp dụng
**trước** khi trả lời, hỏi lại hay đọc code. Hook `session-start` nạp bản tóm tắt của quy tắc này khi mở phiên (cài dạng
plugin); cài dạng skills thì `description` của skill này là đường duy nhất.

> **SUBAGENT-STOP** — Agent worker được giao một task cụ thể (theo `plan-execution` hoặc workflow) bỏ qua skill này:
> việc chọn skill đã làm ở session chính.

## Quy trình — chọn skill trước khi hành động

1. **Kiểm.** Với mỗi yêu cầu mới, tự hỏi: có skill nào có khả năng áp dụng, dù nhỏ? Có thì gọi skill đó **trước** mọi
   phản hồi, kể cả câu hỏi làm rõ và việc đọc code.
2. **Chọn theo thứ tự.** Skill về cách làm (quy trình, kỷ luật) đi trước, skill về cách thực hiện (domain) đi sau.
   Yêu cầu là cả một pipeline nhiều bước (feature, bugfix, review bảo mật, hiệu năng) → `workflow-orchestrator`.
3. **Nói một dòng.** Báo skill đang dùng và vì sao, rồi làm theo skill; skill có checklist thì theo từng mục.
4. **Gọi nhầm thì thôi.** Đọc skill xong thấy không áp dụng → nói một dòng rồi bỏ qua; không làm theo cho đủ thủ tục.

## Thứ tự ưu tiên

Yêu cầu trực tiếp của người dùng > quy tắc project (`CLAUDE.md`, `AGENTS.md`) > skill > hành vi mặc định. Người dùng đã
nói rõ bỏ qua một skill thì bỏ qua; không tự suy ra điều đó từ việc họ muốn nhanh.

## Dấu hiệu đang tự biện minh để bỏ qua skill

| Suy nghĩ | Thực tế |
|---|---|
| "Chỉ là câu hỏi nhỏ" | Câu hỏi cũng là một việc. Kiểm skill trước. |
| "Để tôi đọc code trước đã" | Skill chỉ cách đọc. Gọi trước, đọc sau. |
| "Test đỏ rõ ràng, sửa luôn" | Lỗi chưa rõ nguyên nhân thì đi theo quy trình sửa lỗi (`workflow-bugfix`), không đoán rồi sửa. |
| "Tôi nhớ skill này rồi" | Skill có thể đã đổi. Đọc bản hiện tại. |
| "Việc này nhỏ, skill quá nặng" | Skill tự nêu lối tắt cho việc nhỏ (vd cỡ "thay đổi nhỏ" của `workflow-feature`). Không tự cắt. |
| "Cần thêm ngữ cảnh rồi mới chọn" | Chọn skill trước; skill nói cách thu ngữ cảnh. |
| "Chỉ commit thôi" | Commit, push, branch đi qua `git-workflow`. |

## Ranh giới an toàn

- Skill này không cấp quyền mới và không nới hook, quy tắc commit hay ranh giới an toàn của skill khác.
- Không gọi skill chỉ để lách một bước kiểm; không lặp lại việc gọi skill đã nạp trong cùng lượt.
- Quy tắc project và yêu cầu người dùng luôn thắng; xung đột thì nêu rõ và theo bên ưu tiên cao hơn.
