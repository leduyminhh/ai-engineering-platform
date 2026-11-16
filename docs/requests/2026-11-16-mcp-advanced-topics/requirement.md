# Requirement: Reference MCP trong skill backend-llm-integration
## Yêu cầu gốc
Skill `backend-llm-integration` PHẢI có một reference ngắn nói cho agent biết cách xử lý lời gọi LLM khi backend là một
server MCP, theo spec MCP bản 2026-07-28: gọi thẳng nhà cung cấp thay vì sampling, và cách đối xử với đối tác còn nói bản cũ.
## Bối cảnh
Brief đã duyệt: `docs/requests/2026-11-16-mcp-advanced-topics/brief.md`. Khoá MCP Advanced Topics dạy mô hình cũ (phiên,
kênh GET, cờ stateless, sampling). Spec hiện hành bỏ phiên và request do server khởi xướng, đánh dấu Sampling, Roots,
Logging là deprecated và khuyên gọi thẳng API nhà cung cấp LLM; Python SDK v2 nói bản mới và phục vụ cả hai thời kỳ.
Người dùng chọn hướng thu hẹp: không skill mới, chỉ thêm reference vào skill đã published.
## Ràng buộc
- Không đổi `description` của `backend-llm-integration`: test `test/content/50-enrich-backend.pin.mjs` ghim nguyên văn và
  spec `skill-quality/R5` giới hạn ≤ 500 ký tự cùng khoá routing.
- Không chép nội dung khoá hay spec: tóm tắt bằng lời, mỗi lần trích dưới 15 từ; ví dụ mã tự viết hoặc không có.
- Khẳng định chưa đọc nguồn đúng phiên bản gắn `[Unverified]`; không có hướng dẫn về xác thực OAuth.
- Không sửa hook, `aip-gate.json`, `policy.json`.
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given nhánh đã xong When mở `plugins/backend/skills/backend-llm-integration/SKILL.md` Then có đúng một liên kết tương đối tới `references/mcp-llm.md` và file đó tồn tại; `description` trong frontmatter giữ nguyên văn so với `master`.
- [ ] **AC1.2** — Given `references/mcp-llm.md` When đọc Then nêu rõ bản spec 2026-07-28 làm gốc, ngày đọc 2026-11-16 và liệt kê ít nhất 6 URL trang spec đã đọc (changelog, deprecated, transports, versioning, sampling, roots).
- [ ] **AC1.3** — Given `references/mcp-llm.md` When đọc Then có đủ bốn phần: (a) server cần LLM thì gọi thẳng nhà cung cấp, kèm ánh xạ bảy mục của `llm-call-checklist.md` áp dụng trọn; (b) sampling chỉ là tuỳ chọn tương thích bản cũ, kèm mục nào của checklist chuyển sang client; (c) bảo mật tối thiểu cho server HTTP: kiểm `Origin`, bind localhost khi chạy cục bộ, Roots chỉ là thông tin, và một dòng nói spec khuyến nghị (SHOULD) xác thực kết nối (không hướng dẫn cách làm, OAuth ngoài phạm vi); (d) cách nhận biết đối tác bản cũ hay mới.
- [ ] **AC1.4** — Given reference When rà từng câu so với trang nguồn Then reviewer (có truy cập các URL ở mục "Nguồn đã đọc" của design) không thấy đoạn chép nguyên văn quá 15 từ, và mọi khẳng định về Python SDK có nhãn phiên bản (v2.3.0) hoặc `[Unverified]`. Ngày ghi trong reference là ngày đọc thực tế; bản này đọc ngày 2026-11-16.
- [ ] **AC1.5** — Given nhánh đã xong When chạy `node scripts/routing-score.mjs` Then positive không dưới 69 và negative không dưới 94 (khoá `rank1.lock.json`).
- [ ] **AC1.6** — Given nhánh đã xong When đọc `plugins/backend/.manifest.json` Then `version` là `1.16.0` (từ `1.15.3`), `plugins/_versions.lock.json` khớp bản build, và `npm test` thoát 0.
