---
name: engineering-repo-audit
description: "Soát toàn repo chỉ đọc: xếp hạng điểm nóng, đọc có giới hạn, trả finding xếp hạng có file:line và phần chưa soát. Dùng khi người dùng muốn \"audit repo\", \"soát toàn bộ codebase\", \"tìm rủi ro trong repo\", \"xếp hạng điểm nóng\", \"repo health check\". Không dùng khi chỉ review diff/PR → backend-code-review; quét tool hoặc OWASP → engineering-quality-gate; kiểm quy ước đặt tên → engineering-convention-enforce."
order: 9
title: "Repo Audit — soát toàn repo chỉ đọc, xếp hạng điểm nóng và rủi ro có evidence"
runsIn: execute
invoke: per-request
argument-hint: "[thư mục gốc | phạm vi]"
---

# Repo Audit — soát toàn repo chỉ đọc (skill dùng chung)

Hướng dẫn agent **soát một repo hoặc một cây thư mục lớn** khi không có diff để bám: chọn chỗ đáng đọc
nhất, đọc có ngân sách, rồi trả **danh sách finding xếp hạng** mà người đọc hiểu được trong một lượt.
Đây là **docs-only recipe**, không phải scanner và không sinh code. Skill không đọc hết repo: nó
**nói rõ phần nào đã đọc, phần nào chưa**.

Khác các skill gần nó: `*-code-review` bị khoá ở diff/PR/module; `engineering-quality-gate` chạy
SonarQube/Black Duck và security review theo OWASP; `engineering-convention-enforce` chỉ đối chiếu quy
ước. Skill này trả lời câu hỏi "repo này **đang rủi ro ở đâu**, nên sửa gì trước" và định tuyến phần
việc chuyên trách sang các skill đó.

## Ranh giới an toàn

- **Chỉ đọc.** Không sửa file, không commit, không đổi cấu hình, không cài gói. Báo cáo nằm trong chat;
  chỉ ghi file khi người dùng yêu cầu rõ, và chỉ ghi vào `docs/`.
- **Không đọc file bí mật** (`.env`, key, credential, `*.pem`). Thấy secret nằm trong mã nguồn thì báo
  `file:line` và loại secret, **không in giá trị**; việc rotate do người dùng làm.
- **Chỉ chạy lệnh đọc cục bộ** (`git log`, `git ls-files`, `grep`, đếm dòng). Không chạy build/test của
  project, không gọi mạng, không chạy script lạ.
- **Mọi finding có evidence** `file:line` và nhãn **proven** (nói được kịch bản input → hành vi sai) hoặc
  **suspected** (có mùi, chưa tái hiện). Không thổi suspected thành blocker.
- **Ngôn ngữ đo được.** Báo bằng số đếm được; không viết "repo sạch", "hết bug", "đã soát hết".
  Luôn nêu **phần chưa soát** và **residual risk**.
- **Không tự mở rộng thành sửa lỗi.** Việc nào cần sửa thì định tuyến, không làm trong lượt audit.
- Đầu ra hướng người dùng bằng tiếng Việt có dấu.

## Quy trình — audit

0. **Chốt scope và ngân sách đọc.** Hỏi hoặc suy ra: cả repo hay một cây con, mục tiêu (trước release,
   tiếp quản, nghi ngờ hiệu năng). Đặt ngân sách theo cỡ repo (xem
   [references/hotspot-ranking.md](references/hotspot-ranking.md)); không quét lan ra ngoài scope.
1. **Xếp hạng điểm nóng.** Dùng `git` và đếm dòng để chọn 10–20 file đáng đọc nhất (lớn × hay sửa × thiếu
   test). Repo shallow hoặc không có lịch sử thì nói rõ và xếp theo kích thước, đừng giả vờ có tín hiệu churn.
2. **Đọc theo trục.** Với mỗi điểm nóng, đọc theo các trục ở
   [references/audit-axes.md](references/audit-axes.md): lỗi logic, bảo mật nhìn bằng mắt, độ tin cậy
   dưới tải, rủi ro thiếu test, đường chậm, code chết/trùng. Mỗi finding quy về một `file:line`.
3. **Xếp hạng finding.** Theo (mức hậu quả × độ chắc chắn × độ dễ gặp); gộp finding cùng gốc. Giữ danh
   sách ngắn: ưu tiên 10–15 finding quan trọng nhất, phần còn lại gom thành một dòng đếm.
4. **Báo cáo** theo [references/audit-report-template.md](references/audit-report-template.md): phạm vi và phần chưa soát,
   bảng finding xếp hạng, ba việc nên làm trước, định tuyến.

## Định tuyến sau audit

| Phát hiện | Chuyển sang |
|---|---|
| Lỗ hổng, secret, dependency có CVE | `engineering-quality-gate` hoặc `workflow-security-review` |
| Lỗi hành vi cần tái hiện rồi sửa | `workflow-bugfix` |
| Nghẽn hiệu năng cần đo | `workflow-performance` |
| Thiếu test ở module rủi ro | `backend-testing` / `frontend-testing` |
| Cấu trúc sai tầng, god class | `backend-refactor` / `frontend-refactor` |
| Lệch quy ước đặt tên và thư mục | `engineering-convention-enforce` |

## Verification (trước khi báo hoàn thành)

- Đã chốt scope và ngân sách; không đọc ngoài scope và không đọc file bí mật.
- Mỗi finding có `file:line` và nhãn proven/suspected; không có finding nào chỉ dựa vào đoán tên file.
- Báo cáo có phần **chưa soát** và **residual risk**; không có câu khẳng định tuyệt đối.
- Chưa có file nào bị sửa; việc cần sửa đã được định tuyến, không tự làm.

## Bản đồ tài liệu

- [references/hotspot-ranking.md](references/hotspot-ranking.md): cách xếp hạng điểm nóng bằng `git`, ngân sách
  đọc theo cỡ repo, xử lý repo shallow.
- [references/audit-axes.md](references/audit-axes.md): các trục audit và dấu hiệu từng trục.
- [references/audit-report-template.md](references/audit-report-template.md): mẫu báo cáo và cách ghi phần chưa soát.
