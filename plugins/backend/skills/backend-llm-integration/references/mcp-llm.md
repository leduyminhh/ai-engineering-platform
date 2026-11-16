# LLM trong server MCP

Tham chiếu cho `backend-llm-integration`, dùng khi backend là server MCP. Nội dung theo spec MCP 2026-07-28, đọc ngày 2026-11-16.
Spec và SDK còn đổi, nên cần đọc lại khi có bản mới. Khẳng định chưa đối chiếu nguồn gắn `[Unverified]`.

## 1. Gọi thẳng nhà cung cấp (mặc định cho server mới)

Server cần LLM thì tự gọi nhà cung cấp. Server giữ khoá và chịu chi phí, nên cả bảy mục của `llm-call-checklist.md` áp dụng trọn:

| Mục | Tên trong checklist | Áp dụng |
|---|---|---|
| 1 | Ngân sách theo ngày | Trọn, do server đặt chỗ và trừ |
| 2 | Backoff | Trọn |
| 3 | Fail-soft có đánh dấu | Trọn, kết quả thay thế mang cờ `degraded` |
| 4 | Ghi usage | Trọn, mỗi lời gọi một bản ghi |
| 5 | Redact output và hash input | Trọn |
| 6 | Prompt dự phòng | Trọn |
| 7 | Khoá nhà cung cấp | Trọn, khoá không vào log, lỗi hay prompt |

Lý do: spec đã đánh dấu Sampling là deprecated và chỉ tới việc gọi thẳng API nhà cung cấp. Sampling, Roots và Logging
chỉ đủ điều kiện bị gỡ từ bản spec đầu tiên phát hành vào hoặc sau 2027-07-28.

## 2. Sampling cho đối tác bản cũ (tuỳ chọn)

Chỉ làm khi cần chạy với client bản cũ vẫn dựa vào sampling. Client giữ khoá và chịu chi phí, nên phần lớn lời gọi nhà cung cấp chuyển sang phía client. [Inference: cách chia dưới đây là suy luận
của người viết, vì client mới là bên gọi nhà cung cấp; spec không chia theo mục checklist.]

| Mục | Tên trong checklist | Phía nào lo |
|---|---|---|
| 1 | Ngân sách theo ngày | Client |
| 2 | Backoff | Client, phần retry lời gọi tới nhà cung cấp |
| 4 | Ghi usage | Client lo phần chính; server chỉ ghi phần mình quan sát được |
| 7 | Khoá nhà cung cấp | Client, server không giữ khoá |
| 3, 5, 6 | Fail-soft, redact và hash, prompt dự phòng | Vẫn ở server |

- Client có thể từ chối, hoặc không khai báo `sampling`. Các trường hợp (hai gạch đầu theo phiên bản client, gạch cuối theo khai báo capability):
  - Client bản cũ trả lỗi cho request của server: server trả kết quả `degraded` và ghi log lý do theo mục 3 của checklist, không giả vờ
    đã có câu trả lời của model [Unverified: chưa đọc trang sampling của spec 2025-11-25].
  - Client bản 2026-07-28: spec nói khi lỗi hoặc người dùng từ chối, client không cần gửi lại request. Server trả `input_required`
    rồi kết thúc request, không giữ trạng thái chờ và không nhận tín hiệu từ chối. Client không gọi lại kèm câu trả lời thì
    không có kết quả nào; nếu tính năng vẫn cần văn bản thì dùng nhánh `degraded` [Inference: hệ quả do người viết suy ra; spec không nói].
  - Client không khai báo `sampling`: không gửi yêu cầu sampling cho client đó; coi như lời gọi không có câu trả lời và rơi vào `degraded`
    [Inference: spec chỉ nói rõ điều này cho `sampling.tools`; client hỗ trợ sampling phải khai báo `sampling`].
- Spec khuyến nghị (SHOULD) luôn có người duyệt trong vòng và có quyền từ chối. Server không giả định yêu cầu nào cũng được duyệt.
- Output nhận về từ client vẫn qua bộ che (mục 5 của checklist) trước khi log.

## 3. Bảo mật tối thiểu cho server HTTP

- Kiểm header `Origin` trên mọi kết nối. Spec nói `Origin` có mặt mà không hợp lệ thì phải trả 403, để chặn DNS rebinding.
- Chạy cục bộ thì bind `127.0.0.1`, không bind `0.0.0.0` (spec: nên bind localhost).
- Spec nêu server nên xác thực mọi kết nối. Reference này không hướng dẫn cách làm; xác thực OAuth ngoài phạm vi.
- Roots chỉ cho biết thư mục client coi là liên quan, không phải cơ chế kiểm soát truy cập. Server tự kiểm đường dẫn trong
  từng tool, không tin Roots để giới hạn quyền truy cập. Server vẫn nên tôn trọng ranh giới Roots, chỉ không coi đó là lớp bảo mật.

## 4. Nhận biết đối tác bản cũ hay mới

| | Bản mới (2026-07-28 trở đi) | Bản cũ (2025-11-25 trở về trước) |
|---|---|---|
| Mở đầu | Không bắt tay | Mở bằng `initialize` |
| Dấu hiệu trên request | Mọi request mang `_meta` `io.modelcontextprotocol/protocolVersion` (HTTP: header `MCP-Protocol-Version` khớp giá trị đó) | Phiên bản chốt một lần ở `initialize` |
| Phiên | Không có `Mcp-Session-Id` | Có thể có `Mcp-Session-Id` (server có thể cấp) |
| Server hỏi client | Trả kết quả `input_required`, client gọi lại request kèm câu trả lời | Server tự gửi request riêng |

- Server bản mới phải hỗ trợ `server/discover` để khai báo phiên bản, capability và danh tính; đó là nghĩa vụ của server, không phải dấu hiệu phân biệt đối tác.
- Tiến độ (`progress`) vẫn đi trên luồng phản hồi của chính request đó ở bản mới.
- Server hỗ trợ cả hai chọn hành vi theo cách request mở đầu: request mang `_meta` bản mới thì phục vụ theo bản mới, `initialize` thì
  theo bản cũ. Việc thử bản mới trước rồi lùi về `initialize` là việc của client, không phải của server.
- Python SDK v2.3.0 (theo PyPI lúc đọc; [Unverified: trang chủ SDK render số này ở khối GitHub]; trang what's-new chỉ nói "v2"): một `Server` phục vụ cả hai
  thời kỳ. Cờ `stateless_http` và `json_response` chuyển sang `run()`; hành vi chi tiết của hai cờ
  chỉ liên quan khi phục vụ bản cũ [Unverified: chưa đọc trang Running your server của SDK].

## Nguồn đã đọc

Đọc ngày 2026-11-16. Bản spec gốc: 2026-07-28. Gốc URL: `https://modelcontextprotocol.io/specification/2026-07-28/`.

| Trang | URL | Dùng cho |
|---|---|---|
| changelog | `https://modelcontextprotocol.io/specification/2026-07-28/changelog` | bỏ phiên, `initialize`, GET; `input_required`; progress |
| deprecated | `https://modelcontextprotocol.io/specification/2026-07-28/deprecated` | Sampling, Roots, Logging; mốc gỡ sớm nhất |
| transports | `https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http` | `Origin`, bind localhost, xác thực |
| versioning | `https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning` | `server/discover`, nhận biết thời kỳ |
| sampling | `https://modelcontextprotocol.io/specification/2026-07-28/client/sampling` | deprecated, người duyệt trong vòng |
| roots | `https://modelcontextprotocol.io/specification/2026-07-28/client/roots` | chỉ là thông tin |
| Python SDK (what's-new) | `https://py.sdk.modelcontextprotocol.io/whats-new/` | "v2", hai thời kỳ, cờ chuyển sang `run()` |
| PyPI gói `mcp` | `https://pypi.org/pypi/mcp/json` | số phiên bản v2.3.0 |
| Python SDK (trang chủ) | `https://py.sdk.modelcontextprotocol.io/` | số phiên bản hiện ở khối GitHub khi trang render bằng JS [Unverified: HTML thô không có chuỗi 2.3.0] |
