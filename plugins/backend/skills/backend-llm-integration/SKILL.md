---
name: backend-llm-integration
description: "Thêm hoặc rà tính năng backend gọi LLM: ngân sách theo ngày, backoff, fail-soft có đánh dấu, ghi usage, redact output, hash input, prompt dự phòng. Dùng khi người dùng muốn \"thêm tính năng gọi LLM\", \"gọi model AI từ backend\", \"ngân sách token theo ngày\", \"fail-soft khi LLM lỗi\", \"ghi usage gọi LLM\". Không dùng khi code slice thường không gọi LLM → backend-implement; review diff tổng quát → backend-code-review."
order: 11
title: "Backend LLM Integration — Gọi LLM từ backend có ngân sách, fail-soft có đánh dấu (recipe on-demand)"
runsIn: execute
invoke: per-request
argument-hint: "[tính năng gọi LLM | đường dẫn module cần rà]"
---

# Backend LLM Integration — Gọi LLM từ backend an toàn (recipe on-demand)

Recipe hướng dẫn agent **thêm mới hoặc rà soát** một tính năng backend có lời gọi tới LLM (model do nhà cung cấp bên ngoài
phục vụ). Lời gọi LLM khác một lời gọi HTTP thường ở ba điểm: tốn tiền theo từng lời gọi, hay lỗi tạm thời, và trả về văn bản
tự do có thể chứa dữ liệu nhạy cảm. Skill gom bảy mục kiểm cho các điểm đó. Đây là **docs-only recipe**, không phải thư viện
hay công cụ codegen. Phần slice thường (aggregate, use-case, port, adapter) vẫn theo `backend-implement`; skill này chỉ thêm
lớp riêng của lời gọi LLM. Chi tiết từng mục và cách kiểm: [references/llm-call-checklist.md](references/llm-call-checklist.md).

## Tiền đề

- Biết **lời gọi LLM nằm ở đâu** trong kiến trúc đã chọn: nên là một driven port (cổng ra) với adapter riêng, để use-case
  không import SDK của nhà cung cấp (đọc `project-knowledge/architecture.md` nếu project có).
- Biết **nơi lưu ngân sách và usage** (bảng hoặc kho có sẵn). Chưa có thì nêu giả định và đề xuất, không tự dựng hạ tầng ngoài slice.
- Mọi khẳng định về hành vi của nhà cung cấp cụ thể (mã lỗi, header giới hạn tốc độ, cách tính token) chưa đọc tài liệu đúng
  phiên bản thì gắn nhãn `[Unverified]`, theo mục "Kiểm nguồn" của skill `principles` (bản cài plugin: `core:principles`).

## Quy trình

### 0. Chốt phạm vi
- Liệt kê **mọi chỗ gọi LLM** trong phạm vi (mới hoặc đang rà). Với mỗi chỗ ghi: ai gọi (request người dùng hay job nền),
  ngân sách thời gian của job, kết quả dùng để làm gì (hiển thị, lưu, ra quyết định).
- Thiếu thông tin → hỏi hoặc nêu giả định (fail-loud), không bịa.

### 1. Ngân sách theo ngày
- **Đặt chỗ trước khi gọi:** trừ ước lượng vào ngân sách ngày (token hoặc số lời gọi) trong một thao tác nguyên tử, rồi mới gọi;
  gọi xong thì điều chỉnh theo số thực dùng. Không kiểm "còn ngân sách" rồi gọi sau (race giữa hai request).
- **Cạn ngân sách thì hạ cấp, không gọi:** trả kết quả thay thế (mục 3) hoặc từ chối có mã lỗi rõ. Không âm thầm vượt trần.
- Ranh giới ngày (múi giờ, giờ reset) ghi thành cấu hình; chưa kiểm cách nhà cung cấp reset thì gắn `[Unverified]`.

### 2. Backoff
- Retry lỗi tạm thời (hết thời gian, 5xx, giới hạn tốc độ) bằng **backoff luỹ thừa có jitter**, số lần có trần.
- **Chặn trên bằng ngân sách thời gian của job:** tổng thời gian chờ cộng thời gian gọi không vượt hạn của job; hết hạn thì
  dừng retry và rơi vào mục 3.
- **Lỗi 4xx (trừ giới hạn tốc độ) không retry:** request sai thì gọi lại vẫn sai, chỉ tốn thêm ngân sách.

### 3. Fail-soft có đánh dấu
- Khi lời gọi lỗi hoặc hết ngân sách, trả **kết quả thay thế mang cờ `degraded`** và ghi **một dòng log có lý do** (mã lỗi,
  hết ngân sách, chưa cấu hình khoá). Không trả kết quả thay thế mà không dấu vết.
- Có **cờ cấu hình** biến lỗi của nhà cung cấp thành **thất bại cứng** (job thất bại thay vì trả kết quả thay thế), để môi trường
  cần độ chính xác bật lên. Kết quả `degraded` không được đi tiếp vào bước không chấp nhận nó (xuất bản, ghi vào dữ liệu gốc).
- **Hoàn tất job không chứng minh lời gọi thật đã chạy:** kiểm bằng cờ `degraded` và dòng log, không bằng trạng thái thành công.

### 4. Ghi usage
- Mỗi lời gọi ghi một bản ghi usage: **chỉ token** (vào, ra), nhà cung cấp, model, kết quả (thành công, lỗi, hạ cấp), thời điểm.
  Không ghi nội dung prompt hay output, không ghi số tiền quy đổi.
- Ghi cả lời gọi lỗi và lời gọi bị hạ cấp (token 0), để đối chiếu ngân sách với thực tế.

### 5. Redact output và hash input
- **Redact output trước khi log hay lưu:** văn bản model trả về có thể lặp lại dữ liệu nhạy cảm của input; chạy bộ che (email,
  số định danh, token, khoá) trước khi ghi log, lưu bản tạm hay đưa vào trace.
- **Hash input thay vì lưu nguyên prompt:** cần nhận diện lời gọi lặp hay tái hiện thì lưu băm của prompt (kèm phiên bản
  template), không lưu văn bản gốc trừ khi có yêu cầu lưu và chỗ lưu đã được phân quyền.

### 6. Prompt dự phòng
- Khi lời gọi lỗi mà tính năng vẫn cần văn bản, dùng **prompt dự phòng**: template cố định, ngắn, không phụ thuộc kết quả của
  lời gọi trước, hoặc một lời gọi tới model rẻ hơn. Kết quả từ nhánh này cũng mang cờ `degraded` (mục 3).
- Nhánh dự phòng có test riêng: ép lỗi lời gọi chính, xác nhận ra đúng kết quả và đúng cờ.

### 7. Khoá nhà cung cấp
- **Khoá nhà cung cấp không vào log, lỗi hay prompt.** Lấy khoá tại thời điểm dùng từ nơi lưu secret của project, không
  nhúng vào chuỗi cấu hình dùng chung, không đưa vào thông báo lỗi trả về, không đưa vào nội dung gửi model.
- Khi đọc trace hay log lỗi của SDK, kiểm xem header xác thực có bị ghi nguyên không (che trước khi ghi).

### 8. Verify
Theo [references/llm-call-checklist.md](references/llm-call-checklist.md): mỗi mục có một cách kiểm chạy được. Báo kết quả
bằng thứ đếm được (mục nào đã kiểm, mục nào N/A kèm lý do, mục nào chưa kiểm). Với phần slice còn lại, dùng thêm
`robustness/robustness-checklist.md` của `backend-implement`.

## Ranh giới an toàn

- **Không gọi nhà cung cấp thật** trong test hay lúc rà khi chưa được duyệt: dùng fake port; lời gọi thật tốn tiền và có thể gửi
  dữ liệu ra ngoài. Không đặt khoá thật vào file, test hay lệnh.
- Không đưa nội dung prompt, output hay khoá vào báo cáo của skill này; chỉ nêu `file:line` và tên mục.
- Phạm vi là lớp gọi LLM; **không** dựng hạ tầng ngân sách hay bảng usage mới ngoài slice khi chưa được giao, **không** chạy
  migration (thuộc `data-db-migration`), **không** externalize config hay secret (thuộc `backend-migrate-vault-consul`).
- Rà soát mặc định chỉ đọc: ghi finding kèm `file:line`, không tự sửa trừ khi người dùng yêu cầu rõ; con người duyệt diff trước
  merge hoặc push (protected branch: mỗi commit).
- Báo cáo bằng thứ đếm được; nêu phần chưa kiểm và residual risk, không dùng "đảm bảo" hay "loại bỏ" khi chưa có bằng chứng chạy.
