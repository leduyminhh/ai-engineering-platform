# Brief: Tích hợp kiến thức MCP nâng cao vào aip
- Ngày: 2026-11-16
- Trạng thái: approved

## Vấn đề và loại việc
Người dùng học khoá "Model Context Protocol: Advanced Topics" của Anthropic và muốn đưa vào aip phần phù hợp. aip hiện
chỉ đụng MCP ở phía **dùng**: hook `guard-mcp` lọc tool theo tên server (`mcpAllow`/`mcpDeny`), không có nội dung nào hướng
dẫn **xây** server MCP. Việc này là nghiên cứu cộng một feature nhỏ về nội dung (docs-only), không phải code runtime.
Người dùng xác nhận cả hai phía (dùng server có sẵn, thỉnh thoảng xây server nhỏ cho backend) đều đáng xét.

## Vì sao bây giờ và thành công trông thế nào
Khoá cho thấy vài bẫy chỉ lộ khi chuyển từ máy dev lên production (cờ stateless làm mất progress, logging, sampling mà
không báo lỗi). Thành công là một recipe ngắn giúp agent xây hoặc rà một MCP server backend tránh các bẫy đó, và có
quyết định rõ cho từng chủ đề của khoá: tích hợp, hoãn hoặc không làm. Kết quả đo được: mỗi chủ đề có một dòng
quyết định kèm lý do (xem Hướng đã cân nhắc).

## Goal, non-goal, anti-goal
- Goal: một recipe docs-only về xây MCP server (chọn transport, cờ HTTP, sampling, thông báo tiến độ, roots), đặt ở
  plugin `backend`, bắt đầu ở trạng thái draft.
- Non-goal: thư viện, codegen, hay một MCP server của chính aip. Không viết lại spec MCP, không dạy auth OAuth.
- Anti-goal: không chép nội dung khoá; không mở rộng `guard-mcp` hay `aip-gate.json` trong request này.

## Hiện trạng và tham khảo đã thấy
Bài của khoá đã đọc (đăng nhập bằng tài khoản của người dùng; mỗi lần chỉ tóm tắt bằng lời mình):
- Giới thiệu khoá, mục tiêu học: https://anthropic.skilljar.com/model-context-protocol-advanced-topics (trang công khai)
- Sampling: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296288
- Log and progress notifications: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296284
- Roots: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296289
- JSON message types: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296290
- The STDIO transport: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296291
- The StreamableHTTP transport: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296287
- StreamableHTTP in depth: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296286
- State and the StreamableHTTP transport: https://anthropic.skilljar.com/model-context-protocol-advanced-topics/296285

**Chưa đọc:** các bài walkthrough (295172, 291036, 295839), bài mở và bài kết (296349, 296350), survey 297276 và bài
đánh giá 296301 (video, mã hoặc câu hỏi, không có phần chữ đáng kể). Khoá **không có bài nào về xác thực**; mục tiêu học
cũng không nêu auth. Nội dung khoá dùng Python SDK; cờ `stateless_http`/`json_response` là tên của SDK đó, SDK khác có thể
đặt tên khác [Unverified]. Trang cũ của khoá ngừng vào đầu 12/2026 theo banner của Skilljar.

Tóm tắt khoá, theo ý của tôi:
- **Sampling:** server nhờ client gọi LLM thay mình, nên server không cần khoá API và chi phí token nằm ở client; hợp với
  server công khai.
- **Log và progress:** server báo tiến độ qua đối tượng context, client tự quyết hiển thị; chỉ là tiện ích UX.
- **Roots:** client khai thư mục server được động tới; SDK không tự chặn, server phải tự kiểm đường dẫn nằm trong root.
- **Thông điệp JSON:** hai nhóm request-result và notification, spec định nghĩa bằng TypeScript; mọi kết nối mở bằng bắt tay
  ba bước.
- **stdio:** client chạy server như tiến trình con, hai chiều tự do, chỉ chạy cùng máy.
- **StreamableHTTP:** server không chủ động gọi client được qua HTTP thuần, nên dùng SSE làm đường ngược (một kết nối
  chính cộng một kết nối riêng mỗi lần gọi tool, định danh bằng header session). Bật `stateless_http` để scale ngang thì
  mất session, request từ server, sampling, progress, subscription; `json_response` mất log và progress giữa chừng.
  Khoá khuyên test bằng đúng transport sẽ dùng ở production.

Phía aip, đã đọc:
- `core/hooks/scripts/guard-mcp.mjs`: chỉ lọc theo **tên server** (`parseMcpTool`), không xét tên tool hay tham số; `mcpDeny`
  thắng `mcpAllow`; `full` bỏ `mcpAllow` nhưng giữ `mcpDeny`; luôn chặn `start_session` thiếu `model`; fail-open khi lỗi
  nội bộ. Spec: `docs/specs/hooks-gates/spec.md` (R1, R2, R3, R7, R16).
- `core/permissions/policy.json` chỉ có 4 nhóm (secrets, git_push, network, production_deploy), không có quy tắc MCP.
  `cli/lib/permissions.mjs:15` đã nhận dạng quy tắc `mcp__<server>__*`, nhưng `REQUIRED_GROUPS` (dòng 8) từ chối nhóm lạ,
  nên thêm nhóm MCP cần sửa code, không chỉ sửa JSON.
- Skill `backend-llm-integration` (published) nói về backend **gọi** LLM: ngân sách, retry, fail-soft, usage, redact, khoá
  nhà cung cấp. Không nhắc MCP. Tìm trong `core/hooks/scripts` không thấy chỗ nào canh ghi vào `.mcp.json`.
- README mục CI đã cảnh báo `claude -p` không `--bare` nạp `.mcp.json` mà không hỏi tin cậy; `evals/README.md:124` ghi
  chưa có eval cho `guard-mcp`.

## Hướng đã cân nhắc
Bảng quyết định theo chủ đề (nhãn [Inference] là suy luận của tôi, chưa kiểm trên project thật):

| Chủ đề | Quyết định | Hình thức | Lý do |
|---|---|---|---|
| StreamableHTTP + cờ stateless/json | Tích hợp | Mục chính của recipe: bảng "cờ nào mất tính năng nào", test bằng transport production | Bẫy câm, đắt nhất khi gặp ở production [Inference] |
| Sampling | Tích hợp | Mục trong recipe + một dòng chéo từ `backend-llm-integration` ("server không giữ khoá thì 7 mục kia N/A, chuyển sang client") | Quyết định kiến trúc về ai giữ khoá và chịu chi phí; liền với skill LLM sẵn có |
| Roots | Tích hợp | Một mục kiểm trong recipe: kiểm đường dẫn nằm trong root, xử lý `..` và symlink | SDK không tự chặn; lỗi dễ lặp lại [Inference] |
| Log/progress | Tích hợp nhẹ | Một đoạn ngắn trong recipe | Tiện ích tuỳ chọn, ít rủi ro |
| Thông điệp JSON, bắt tay | Chỉ tham chiếu | Link tới spec, không chép | Nguồn chính là spec; sao chép sẽ lỗi thời [Inference] |
| stdio | Chỉ nhắc | Một dòng trong phần chọn transport | Chạy cùng máy; chỉ là baseline |
| Hook canh ghi `.mcp.json` (phía dùng) | Hoãn, request riêng | Có thể thêm vào `guard-files` một nhánh `ask` | Server stdio là tiến trình con của client, nên thêm server vào `.mcp.json` là thêm lệnh chạy [Inference]; khoá không nói điều này, và cần đối chiếu cách Claude Code nạp `.mcp.json` trước khi làm [Unverified] |
| Eval cho `guard-mcp` | Hoãn, ngoài phạm vi khoá | Eval riêng | Khoảng trống đã có từ trước (`evals/README.md:124`); Windows không chạy được hook Bash theo ghi chú đó |
| Auth MCP (OAuth) | Không làm | Không có | Khoá không dạy; chưa đọc spec nên chưa có cơ sở viết [Unverified] |

Ba hướng tổng thể:
1. **Recipe docs-only mới trong `backend`, draft trước** (đề xuất): skill `backend-mcp-server` (tên [giả định]) kèm một
   reference ngắn, thêm một dòng chéo ở `backend-llm-integration`. Rẻ, không đổi hook nên không đụng spec `hooks-gates`.
   Đánh đổi: thêm một skill dễ kéo tụt điểm routing (cụm 10 trong ghi chú audit) và phải bump version backend; từ vựng "MCP
   server" khác hẳn skill hiện có nên rủi ro thấp hơn nhưng chưa đo [Unverified].
2. **Recipe cộng hook**: làm hướng 1 và thêm nhánh `ask` ghi `.mcp.json` cùng khoá mới. Đánh đổi: đổi spec `hooks-gates`,
   thêm test hook, rủi ro hỏi nhầm; người dùng đã chọn "nội dung trước", nên loại khỏi request này.
3. **Chỉ ghi chú**: không thêm skill, thêm một đoạn vào README. Rẻ nhất nhưng agent không được kích hoạt khi xây server
   (nhiều skill của repo đã không kích hoạt theo ghi chú audit), nên giá trị thấp.

**Không nên làm và lý do:**
- Mở rộng `guard-mcp` lọc theo tool hoặc tham số: tên tool và tên tham số do từng server tự đặt, hook không biết tham số
  nào là đường dẫn; README đã nói rõ tool MCP không bị nhốt root; hook thiết kế fail-open nên lọc phức tạp càng dễ sai [Inference].
- Thêm nhóm MCP vào `policy.json` kiểu "ask cho mọi `mcp__*`": gây hỏi dồn cho cả tool của chính ứng dụng Claude (như
  `ccd_*`), và phải sửa `REQUIRED_GROUPS` [Inference].
- Biến aip thành MCP server: lệch mục tiêu (CLI không runtime, zero dependency) và khoá không đề cập.
- Chép bài khoá hoặc code mẫu vào skill: vi phạm bản quyền và sẽ lỗi thời khi spec hoặc SDK đổi.

## Quyết định của agent
- Người dùng đã bỏ qua câu mở về tình huống; tôi suy ra mục tiêu từ yêu cầu gốc và ghi trong Phần đoán.
- Chọn hướng 1 (recipe draft) làm đề xuất, theo lựa chọn "nội dung trước, hook khi có lỗ hổng cụ thể" của người dùng.
- Đặt recipe ở plugin `backend` thay vì `engineering`, vì skill LLM liên quan nằm ở đó; plugin `engineering` là lựa chọn
  thay thế nếu muốn trung lập ngôn ngữ [giả định].
- Tách hook `.mcp.json` và eval `guard-mcp` thành hai ứng viên request riêng, không đưa vào request này.
- Recipe trung lập ngôn ngữ ở phần giao thức; chỉ ví dụ Python vì khoá dùng Python SDK, và đánh dấu [Unverified] cho
  tên cờ ở SDK khác (Java/Spring chưa có tài liệu nào được đọc).
- Route: chỉ giữ `workflow-feature` làm ứng viên. `backend-implement` sinh code slice nên không hợp với skill docs-only;
  `phạm-vi: code-be` vì skill nằm ở plugin `backend`, không phải vì có code runtime.
- Thứ tự ở request sau: đọc spec MCP hiện hành và tài liệu SDK chính thức **trước khi viết recipe**, rồi gắn nhãn phiên
  bản; bảng "cờ nào mất tính năng nào" lấy từ tài liệu SDK và spec, không diễn đạt lại từ bài khoá. Đọc web là việc cần
  người dùng đồng ý ở thời điểm đó.
- "Draft" nghĩa là khai báo trong `plugins/_published.json` (build vào `build/claude/drafts/`). Xong khi: bump version
  `backend`, chạy `node cli/lib/versions.mjs --lock`, và `npm test` xanh, gồm ngưỡng routing `rank1.lock.json`; tụt dưới
  ngưỡng thì chặn, sửa description chứ không hạ ngưỡng.
- Có sửa `backend-llm-integration` (một dòng chéo, bump version cùng đợt). Nêu ở thẻ duyệt để người dùng có thể bỏ.
- Quyết định theo chủ đề và hai việc hoãn (hook `.mcp.json`, eval `guard-mcp`) giữ ở bảng "Hướng đã cân nhắc" của brief này;
  design.md của request sau chép lại thành mục "Việc hoãn" để không mất khi brief bị thay.
- Ví dụ Python tự viết theo SDK chính thức, không lấy từ mã mẫu của khoá.

## Phần đoán
- [giả định] Người dùng backend của aip sẽ thật sự xây server MCP; người dùng xác nhận "cả hai phía", nhưng chưa có ví dụ
  project cụ thể.
- [giả định] Spec MCP hiện hành và SDK khớp với nội dung khoá (khoá cũ, trang đóng 12/2026); cần đọc spec trước khi viết
  recipe và gắn nhãn phiên bản.
- [giả định] Tên `backend-mcp-server` và việc đặt ở `backend`.
- [Inference] Rủi ro routing khi thêm skill chưa đo; cần chạy `node scripts/routing-score.mjs` ở giai đoạn plan.

## Cập nhật sau khi đọc spec hiện hành (2026-11-16, người dùng đã chọn hướng thu hẹp)
Đã đọc, chỉ đọc, ghi URL:
- https://modelcontextprotocol.io/specification/2026-07-28/changelog
- https://modelcontextprotocol.io/specification/2026-07-28/deprecated
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports (và `/streamable-http`)
- https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/client/sampling, `/client/roots`, `/basic/patterns/progress`
- https://py.sdk.modelcontextprotocol.io/whats-new/ (Python SDK v2.3.0, trang cho biết v2 nói bản 2026-07-28)

Phát hiện [Verified từ các trang trên]: bản 2026-07-28 bỏ phiên cấp giao thức, `Mcp-Session-Id`, bắt tay `initialize`, endpoint
GET và mọi request do server khởi xướng (thay bằng kết quả `input_required` rồi client gọi lại). Sampling, Roots, Logging
bị đánh dấu deprecated, hướng thay là gọi thẳng API nhà cung cấp LLM; Roots chỉ là thông tin tham khảo, không phải kiểm soát
truy cập. Progress giữ nguyên, đi trên luồng phản hồi của chính request. SDK Python v2 nói bản mới và một `Server` phục vụ
cả hai thời kỳ; `stateless_http`, `json_response` chuyển sang tham số của `run()`.

Hệ quả cho brief: bảng cờ stateless (chủ đề chính ban đầu) chỉ còn đúng cho server tương thích bản 2025-11-25 trở về trước;
không còn cơ sở để viết skill mới quanh nó. **Hướng mới (người dùng chọn):** bỏ skill `backend-mcp-server`; thêm một
reference ngắn vào `backend-llm-integration`: server MCP cần LLM thì gọi trực tiếp (bảy mục của checklist áp dụng trọn),
sampling chỉ còn là tuỳ chọn tương thích bản cũ, nhận biết thời kỳ của đối tác, và vài dòng về Origin, localhost và
roots-không-phải-kiểm-soát. Các hướng 2 và 3, hai việc hoãn (hook `.mcp.json`, eval `guard-mcp`) và mục "Không nên làm"
giữ nguyên; bảng chủ đề cập nhật: StreamableHTTP+cờ stateless → chỉ nhắc trong phần tương thích; sampling → khuyến nghị
gọi trực tiếp; roots → một dòng cảnh báo; log/progress → progress vẫn dùng được, logging deprecated.

## Định tuyến
loại-việc: feature
phạm-vi: code-be
đầu-ra-mong-đợi: một reference ngắn về MCP trong skill backend-llm-integration (không có skill mới), cùng danh sách hai request hoãn (hook .mcp.json, eval guard-mcp)
rủi-ro: thêm skill mới có thể kéo điểm routing xuống dưới ngưỡng khoá và phải bump version backend, lock lại
ứng-viên-route: [workflow-feature]
route-đã-duyệt: workflow-feature
