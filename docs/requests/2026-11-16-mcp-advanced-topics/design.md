# Thiết kế: Reference MCP trong backend-llm-integration
- Ngày: 2026-11-16
- Trạng thái: approved — G1 duyệt 2026-11-16
- Requirement: [requirement.md](requirement.md)
## Vấn đề và lý do
Backend xây server MCP có hai chỗ dễ sai mà skill hiện có không nói: ai gọi LLM (server tự gọi hay nhờ client qua sampling)
và đối tác đang nói bản giao thức nào. Spec 2026-07-28 đã bỏ phiên và request do server khởi xướng, nên kiến thức từ khoá
MCP Advanced Topics (cờ stateless, sampling, roots) chỉ còn đúng với đối tác bản cũ. Một reference ngắn gắn vào skill
LLM sẵn có rẻ hơn một skill mới và không đụng routing.
## Quyết định đã chốt
- Người dùng chọn: thu hẹp vào `backend-llm-integration`, không tạo `backend-mcp-server`.
- Người dùng chọn: cỡ dự án (design + plan), đọc spec web ở Bước 3 (đã đọc, xem brief mục "Cập nhật"), không tách task.
- Quyết định của agent: đặt file ở `references/mcp-llm.md`; không đổi `description`; bump `backend` minor lên 1.16.0.
## Thiết kế
Một file mới `plugins/backend/skills/backend-llm-integration/references/mcp-llm.md`, khoảng 60 dòng, bốn phần:
1. **Gọi thẳng nhà cung cấp (mặc định cho server mới).** Server giữ khoá và chịu chi phí, nên bảy mục của
   `llm-call-checklist.md` áp dụng nguyên vẹn. Nêu lý do: spec đánh dấu Sampling deprecated và chỉ tới hướng này.
2. **Sampling cho đối tác bản cũ (tuỳ chọn).** Client chịu khoá và chi phí nên mục ngân sách, usage và khoá nhà cung cấp
   chuyển sang phía client; server vẫn phải xử lý trường hợp client từ chối hoặc không khai báo sampling (rơi vào
   `degraded` theo mục 3 của skill). Nhắc người duyệt trong vòng là yêu cầu của spec.
3. **Bảo mật tối thiểu cho server HTTP.** Kiểm `Origin` (403 khi sai), bind `127.0.0.1` khi chạy cục bộ; một dòng nói spec
   khuyến nghị (SHOULD) xác thực kết nối, không hướng dẫn cách làm. Roots chỉ cho biết thư mục liên quan, không chặn truy cập, nên
   server tự kiểm đường dẫn trong tool.
4. **Nhận biết thời kỳ.** Bản mới mang phiên bản giao thức trong từng request, có `server/discover`; bản cũ mở bằng
   `initialize` và có `Mcp-Session-Id`. Server hỗ trợ cả hai thì thử bản mới trước. Cờ `stateless_http` và `json_response`
   chỉ liên quan khi phục vụ bản cũ [Unverified: chưa đọc trang Running your server của SDK].
Cuối file: URL các trang đã đọc, ngày đọc, nhãn phiên bản. `SKILL.md` thêm đúng một dòng ở mục Tiền đề trỏ tới file.
Cập nhật `plugins/backend/.manifest.json` (version), chạy `node cli/lib/versions.mjs --lock`, kiểm routing.
### Nguồn đã đọc (2026-11-16, chỉ đọc)
Gốc: `https://modelcontextprotocol.io/specification/2026-07-28/` cộng đường dẫn dưới đây.
| Trang | Xác nhận khẳng định |
|---|---|
| `changelog` | bỏ phiên, `Mcp-Session-Id`, `initialize`, GET; request server khởi xướng thay bằng `input_required`; progress giữ nguyên |
| `deprecated` | Sampling, Roots, Logging deprecated; hướng thay là gọi thẳng nhà cung cấp |
| `basic/transports/streamable-http` | kiểm `Origin` (403), bind localhost, xác thực nên có |
| `basic/versioning` | phiên bản trong từng request, `server/discover`, nhận biết thời kỳ bản cũ/mới |
| `client/sampling` | deprecated, người duyệt trong vòng |
| `client/roots` | chỉ là thông tin, không phải kiểm soát truy cập |
Python SDK: `https://py.sdk.modelcontextprotocol.io/whats-new/` xác nhận v2 nói bản 2026-07-28, một `Server` phục vụ hai thời kỳ,
`stateless_http`/`json_response` chuyển sang `run()`. Số phiên bản v2.3.0 theo `https://pypi.org/pypi/mcp/json` (trang SDK chỉ nói "v2"). Chưa đọc: trang chạy server và dependencies của SDK.
Thứ tự làm: chờ G1 duyệt tài liệu và G2 duyệt plan rồi mới viết reference.
## Ảnh hưởng spec
Không ảnh hưởng: chỉ thêm nội dung tham chiếu cho skill, không đổi hành vi hook, CLI hay khoá routing; `skill-quality/R5` giữ nguyên vì `description` không đổi.
## Ngoài phạm vi và anti-goal
- Skill mới về xây MCP server; hook canh ghi `.mcp.json`; eval `guard-mcp`; xác thực OAuth cho MCP.
- Sửa `guard-mcp`, `policy.json`, `aip-gate.json`.
- Chép bài khoá hoặc trang spec.
### Việc hoãn (ứng viên request riêng)
| Việc | Vì sao hoãn |
|---|---|
| Nhánh `ask` của `guard-files` khi ghi `.mcp.json` | Server stdio là tiến trình con của client nên thêm server là thêm lệnh chạy [Inference]; cần đối chiếu cách Claude Code nạp `.mcp.json` [Unverified]. Hiện không hook nào canh. |
| Eval cho `guard-mcp` | Khoảng trống có từ trước (`evals/README.md:124`); hook Bash không chạy được trên Windows theo ghi chú đó. |
| Skill hoặc reference về xây MCP server đầy đủ | Chờ có project backend cụ thể xây server MCP; tài liệu Python SDK v2 chưa đọc hết (Running your server, Dependencies). |
## Ràng buộc
Tiếng Việt có dấu theo `engineering-writing-style`; UTF-8 không BOM, LF; không `Co-Authored-By`; không push hay merge khi chưa được xác nhận.
## Kiểm thử
AC1.1–AC1.4 kiểm bằng đọc diff và grep (reviewer task DOCS); AC1.5 bằng `node scripts/routing-score.mjs`; AC1.6 bằng `node cli/lib/versions.mjs --lock` rồi `npm test`. Không viết test mới: nội dung tham chiếu không có hành vi chạy được (quy tắc Testing của AGENTS.md).
## Để builder quyết
Tên tiêu đề từng phần, thứ tự câu trong reference, cách ghi nhãn `[Unverified]`.
## Rủi ro và câu hỏi mở
- Spec và SDK còn đổi; reference gắn ngày đọc và phiên bản nên cần đọc lại khi có bản mới [Inference].
- Chưa đọc trang SDK về chạy server và dependencies, nên mọi câu về `stateless_http`/`json_response` ở SDK v2 gắn [Unverified].
- Reference chỉ được nạp khi skill kích hoạt; nếu agent không kích hoạt skill khi xây server MCP thì không có tác dụng (nhiều skill của repo đã gặp lỗi kích hoạt theo ghi chú audit).
