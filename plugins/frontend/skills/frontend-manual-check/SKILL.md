---
name: frontend-manual-check
description: "Viết runbook kiểm tay ánh xạ từng AC (dữ liệu seed, bước, kết quả mong đợi) cho UI chưa có test tự động, kèm walkthrough khám phá bằng Playwright có luật PASS/FAIL/SKIP và luật an toàn. Dùng khi người dùng muốn \"viết checklist kiểm tay UI\", \"runbook kiểm tay theo AC\", \"duyệt thủ công các màn hình\", \"walkthrough UI bằng Playwright\". Không dùng khi cần viết test e2e tự động → frontend-e2e-testing; test component → frontend-testing."
order: 11
title: "Frontend Manual Check — Runbook kiểm tay theo AC và walkthrough Playwright (recipe on-demand)"
runsIn: execute
invoke: per-request
---

# Frontend Manual Check — Runbook kiểm tay theo AC và walkthrough Playwright (recipe on-demand)

Lập **runbook kiểm tay** cho phần UI chưa có test tự động: mỗi acceptance criterion (AC) được ánh xạ tới các bước người
kiểm làm, kèm dữ liệu seed và kết quả mong đợi. Tuỳ chọn: chạy một **walkthrough khám phá** bằng Playwright để thu
bằng chứng nhanh trước khi người kiểm tay. Skill này là hướng dẫn cách agent làm (docs-only recipe), không sinh bộ test
tự động và không thay thế test của project.

Phân công với skill anh em: `frontend-e2e-testing` viết test Playwright **tự động, chạy lặp được** cho vài luồng giá trị cao;
`frontend-testing` viết test component và hook. Skill này dành cho phần UI **chưa** có test tự động, hoặc phần mà test tự
động không chứng minh được (bố cục, luồng nhiều màn hình, trạng thái lỗi). Walkthrough ở đây **không** để lại file test
và không thay cho test e2e.

## Tiền đề

- Có danh sách AC của thay đổi cần kiểm (thường ở `docs/requests/<request>/design.md` hoặc `requirement.md`). Thiếu AC
  thì dừng và đề nghị làm rõ yêu cầu trước (`engineering-spec-writing`).
- Biết cách dựng môi trường chạy local/test (lệnh chạy FE, BE, DB test) từ `README` hoặc `project-knowledge/`.
  Chưa rõ thì hỏi người dùng, không đoán lệnh.
- Con người giữ chốt: duyệt runbook trước khi chạy walkthrough, và là người kiểm tay cuối cùng.

## Phạm vi

- **Làm:** runbook theo [mẫu](references/runbook.template.md); walkthrough Playwright theo
  [luật walkthrough](references/walkthrough.md); báo cáo kết quả đã chạy.
- **Không làm:** viết file test tự động (→ `frontend-e2e-testing`, `frontend-testing`); sửa code hay cấu hình của project;
  kiểm trên staging hoặc production; đo hiệu năng (→ `frontend-performance`).

## Quy trình

### 1. Đọc AC và chốt phạm vi

- Liệt kê mọi `AC<n>.<m>` của thay đổi. Mỗi AC có một mã duy nhất; AC không có mã thì đặt mã tạm và ghi chú.
- Với mỗi AC, ghi: màn hình hoặc luồng liên quan, thao tác chính, tiền điều kiện dữ liệu.
- Phân loại AC: kiểm được bằng thao tác trên UI, hay chỉ kiểm được bằng cách khác (log, DB, hệ thống ngoài). Loại sau vẫn
  vào runbook, đánh dấu "chưa kiểm" kèm lý do, không bỏ ra ngoài.

### 2. Dựng điều kiện và dữ liệu seed

- Điền `## Điều kiện` của mẫu: môi trường (URL local/test, lệnh chạy), tài khoản test (chỉ nêu tên, không ghi mật khẩu
  thật), dữ liệu seed cần có và cách tạo.
- Dữ liệu tạo mới dùng **tiền tố riêng** của lần kiểm (ví dụ `manual-check-<ngày>-`) để nhận ra và dọn được.
- Dữ liệu không dựng được thì ghi vào điều kiện, các bước phụ thuộc sẽ là "chưa kiểm".

### 3. Viết bảng bước

- Bảng có đúng bốn cột `| # | Thao tác | Kết quả mong đợi | AC |`; mỗi hàng là một thao tác người kiểm làm được trong
  vài giây, kèm kết quả quan sát được (chữ hiện ra, trạng thái nút, thông báo, URL).
- **Mỗi `AC<n>.<m>` của design xuất hiện ở ít nhất một bước.** Soát lại bằng cách duyệt từng AC và chỉ ra số bước phủ nó;
  AC chưa có bước thì thêm bước hoặc ghi "chưa kiểm" kèm lý do.
- Kết quả mong đợi viết theo cái nhìn thấy được, không viết theo cài đặt bên trong ("nút Lưu bị vô hiệu" thay cho
  "state `dirty` là false").
- Bước phá huỷ (xoá, huỷ vĩnh viễn) chỉ đi tới hộp xác nhận rồi huỷ; xem luật an toàn bên dưới.

### 4. Chạy và ghi kết quả

- Người dùng duyệt bảng bước trước khi chạy. Chạy tay hoặc chạy walkthrough (mục 5), rồi điền `## Kết quả đã chạy`:
  bước nào PASS, FAIL hay "chưa kiểm", ngày chạy, môi trường, commit đang kiểm.
- Phần không chạy được **ghi rõ "chưa kiểm" kèm lý do, không để trống**. Ô trống không phân biệt được với "quên kiểm".
- FAIL ghi đủ bốn thứ: bước tái hiện, kết quả thực, kết quả mong đợi, bằng chứng (request lỗi, ảnh chụp, thông báo console).
- Không sửa code để làm FAIL thành PASS trong lượt này; báo cáo để người quyết định.

### 5. Walkthrough Playwright (tuỳ chọn)

Khi có công cụ trình duyệt (Playwright MCP hoặc tương đương) và môi trường local/test chạy được, agent đi qua các bước
của runbook như một người dùng thật, đọc request mạng và console sau mỗi bước, rồi gán một trong bốn kết quả: PASS,
FAIL, SKIP-SAFETY, SKIP-PRECOND. Định nghĩa từng kết quả, luật an toàn đầy đủ và mẫu báo cáo nằm ở
[references/walkthrough.md](references/walkthrough.md). Đọc file đó trước khi mở trình duyệt.

Walkthrough cho kết quả **quan sát**, không phải bằng chứng đầy đủ: bước SKIP và phần ngoài UI vẫn cần người kiểm.

## Ranh giới an toàn

Walkthrough chạm vào một ứng dụng đang chạy nên giữ sáu luật sau; chi tiết và cách xử lý từng tình huống ở
[references/walkthrough.md](references/walkthrough.md):

- Không xoá vĩnh viễn: dừng ở hộp xác nhận rồi huỷ.
- Không nhập khoá hay mật khẩu thật; chỉ dùng tài khoản và giá trị test.
- Không đi theo OAuth hay chuyển hướng ra ngoài localhost.
- Không tải file về máy.
- Dữ liệu tạo mới có tiền tố riêng của lần kiểm.
- Không sửa code hay cấu hình, không đọc file bí mật (`.env`, khoá, chứng chỉ).

Ngoài ra:

- Chỉ chạy trên host local/test; từ chối staging và production.
- Không tự cài Playwright hay tải trình duyệt khi chưa hỏi người dùng.
- Làm việc trên nhánh riêng, không trên nhánh được bảo vệ; commit runbook chỉ khi người dùng yêu cầu, merge và push chỉ sau
  khi người dùng duyệt diff.
- Báo cáo bằng số đo được (số bước PASS/FAIL/SKIP); không dùng "đảm bảo", "loại bỏ hoàn toàn", "kiểm hết".
  Luôn nêu phần chưa kiểm và rủi ro còn lại.
- Mọi đầu ra hướng người dùng viết tiếng Việt có dấu (UTF-8).

## Report trả về

```yaml
result:
  summary: "<1–3 câu>"
  runbook: "<đường dẫn runbook>"
  totals: { pass: 0, fail: 0, skip_safety: 0, skip_precond: 0, not_checked: 0 }
  fail_ids: []            # danh sách # của bước FAIL
  not_checked:            # phần chưa kiểm và lý do
    - { step: "", reason: "" }
  remaining_risks: []
```
