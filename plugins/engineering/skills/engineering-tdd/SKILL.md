---
name: engineering-tdd
description: "Kỷ luật TDD, gọi trước khi viết code cho hàm hoặc hành vi mới: test đỏ đúng lý do trước, code tối thiểu để xanh, rồi refactor. Dùng khi người dùng muốn \"thêm hàm mới vào file\", \"thêm xử lý mới cho module\", \"làm theo TDD\", \"viết test trước\". Không dùng khi chỉ cần chiến lược hoặc độ phủ test cho code đã có → backend-testing, sửa lỗi hành vi đã có end-to-end → workflow-bugfix."
order: 10
title: "TDD — test đỏ đúng lý do trước, code tối thiểu, rồi refactor (skill dùng chung)"
runsIn: execute
invoke: per-request
argument-hint: "[hành vi hoặc AC cần làm theo TDD]"
---

# TDD — kỷ luật đỏ, xanh, refactor (skill dùng chung)

Một thay đổi hành vi chỉ được viết code production sau khi có một test đã chạy và **đỏ đúng lý do**. Test chưa từng đỏ thì
chưa chứng minh được nó đo đúng thứ cần đo.

Skill này là kỷ luật làm việc, không phải chiến lược test: chọn tầng test, độ phủ, characterization cho code cũ thuộc
`backend-testing` / `frontend-testing`.

## Quy trình — đỏ, xanh, refactor

1. **Chọn một hành vi.** Một AC, hoặc một nhánh của AC. Một hành vi một test, ở tầng thấp nhất mà test vẫn bắt được lỗi
   (unit cho logic thuần; integration chỉ khi cần DB, broker hay HTTP thật).
2. **Viết test.** Tên nêu hành vi. Kỳ vọng tự tính từ spec hoặc AC, không chép từ output của code hiện có.
3. **Chạy và thấy đỏ đúng lý do.** Đỏ vì hành vi chưa có, không phải vì lỗi cú pháp, import hay setup. Ghi lệnh, exit code
   và thông báo lỗi (task `kind: BE` ghi vào `tdd.red`).
4. **Viết code tối thiểu** cho test xanh. Không thêm hành vi chưa có test.
5. **Chạy lại đúng lệnh đó và thấy xanh** (task `kind: BE` ghi vào `tdd.green`); chạy thêm test hẹp của vùng bị chạm.
6. **Refactor khi đang xanh**, chạy lại sau mỗi bước nhỏ.
7. **Sửa bug:** test tái hiện bug phải đỏ trước. Sau khi sửa phải xanh; xác nhận bằng cách tạm vô hiệu hoá đúng đoạn
   vừa sửa (test đỏ lại) rồi khôi phục (test xanh). Không dùng `git checkout` hay `git reset` lên file chưa commit để hoàn tác:
   bản sửa chưa commit sẽ mất.

Ngoại lệ (code vứt đi, tệp cấu hình sinh tự động, thay đổi chỉ docs) cần người dùng đồng ý; không tự cấp. Agent chạy
trong workflow (chế độ nhúng) không hỏi người dùng: trả `status: blocked` kèm `questions[]`.

## Dấu hiệu đang tự biện minh để bỏ qua bước đỏ

| Suy nghĩ | Thực tế |
|---|---|
| "Việc này đơn giản, khỏi cần test trước" | Đơn giản thì test cũng ngắn. Bước đỏ chứng minh test đo đúng thứ. |
| "Viết test sau cũng như nhau" | Test viết sau thường xanh ngay, không có gì chứng minh nó bắt được lỗi. |
| "Tôi đã thử tay rồi" | Thử tay không lặp lại được và không nằm trong suite. |
| "Code đã viết rồi, bỏ thì phí" | Code chưa có test đỏ chỉ là giả thuyết. Viết test trước rồi mới giữ phần code còn đúng. |
| "Test khó viết, thôi bỏ" | Test khó viết là tín hiệu thiết kế: đơn giản hoá interface, không bỏ test. |
| "Chạy full suite cho chắc ở mỗi bước" | Mỗi bước chỉ chạy test hẹp; full suite chạy một lần ở cuối. |

## Ranh giới với quy tắc Testing của dự án

TDD không có nghĩa là nhiều test hơn. Quy tắc của `AGENTS.md` vẫn áp dụng: một hành vi một test ở tầng thấp nhất; nhiều
đầu vào của cùng một hành vi gộp thành một test tham số hoá; mỗi bug đã sửa có đúng một regression test; không viết test chỉ
để lặp lại mock vừa cấu hình hay ghim chi tiết cài đặt. Anti-pattern cụ thể ở
[references/anti-patterns.md](references/anti-patterns.md). Một review nói "coverage có thể rộng hơn" là mức minor, không tự
thành việc thêm test.

## Ranh giới an toàn

- Không sửa, xoá hay nới test để làm xanh; không sửa code production chỉ để test xanh sai lý do.
- Không dùng `sleep` cố định, không phụ thuộc thứ tự test, thời gian thực hay mạng thật.
- Báo `tdd: { red, green }` chỉ khi task `kind: BE` trong vòng task, đúng định dạng của contract đầu ra (`core:principles`);
  ngoài đó ghi cùng evidence (lệnh, exit code) vào `validation`. Skill này không đổi định dạng của contract.
- Không commit và không chạy lệnh tác động môi trường; commit do bước điều phối đảm nhiệm.
