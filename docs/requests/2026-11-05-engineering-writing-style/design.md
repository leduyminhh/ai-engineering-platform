# Thiết kế: skill chuẩn văn phong `engineering-writing-style` và nhắc trong bootstrap
- Ngày: 2026-11-05
- Trạng thái: draft
- Requirement: không có (cỡ thay đổi nhỏ, AC nằm trong file này)
## Vấn đề và lý do
Văn bản agent viết cho người đọc (README, mô tả PR, release notes, câu trả lời chat) hay mang dấu hiệu "văn AI": câu mở sáo rỗng, từ nhấn rỗng, gom ba ý ở mọi câu, câu kết lặp lại thân bài. Trong bộ chỉ có vài quy tắc rải rác: mục "Văn phong & trình bày" của `engineering-release-notes/references/user-facing-writing.md` (chỉ cho release notes) và một dòng "không sáo rỗng" trong checklist của `engineering-spec-writing`. Chưa có skill riêng, chưa có danh sách cụm cần bỏ, và hook không nói khi nào phải viết theo văn phong con người.
## Quyết định đã chốt
Người dùng chốt ngày 2026-11-05: (1) gắn vào hook bằng cách thêm câu vào đoạn bootstrap của `session-start`; (2) cỡ thay đổi nhỏ, không có `plan.md`; (3) phủ tiếng Việt và tiếng Anh; (4) kèm script quét.

| Hướng gắn hook | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A. Bootstrap `SessionStart` | Thêm câu phân định cần/không cần và trỏ skill vào `BOOTSTRAP` (hiện 480/1200 ký tự) | Không chặn, không thêm logic; chỉ là lời nhắc | **Chọn** |
| B. `PreToolUse` khi ghi `.md` | Nhắc đúng lúc ghi file | Thêm logic vào guard; chưa kiểm `additionalContext` của PreToolUse | Loại |
| C. `Stop` quét cụm sáo rỗng | Chặn một lần khi file `.md` đã sửa có cụm bị cấm | Dễ báo nhầm, gây phiền | Loại |

Quyết định của agent: tên skill `engineering-writing-style`; bảng cụm trong `references/patterns-vi.md` và `references/patterns-en.md` là nguồn duy nhất, script đọc bảng đó, không chép danh sách vào code. Câu trong bootstrap tự đứng được khi plugin `engineering` chưa cài (hook nằm ở `core`).
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given `plugins/engineering/skills/engineering-writing-style/SKILL.md` When chạy `npm test` Then skill qua kiểm convention (frontmatter, `description` theo mẫu có `Dùng khi` và `Không dùng khi … → <id>`, H2 `## Quy trình` và `## Ranh giới an toàn`) và nêu: phạm vi áp (cần/không cần, như bảng ở `references/scope.md`), danh sách không được đổi (code block, inline code, URL, đường dẫn, số, ngày, tên riêng, trích dẫn), quy trình dò → viết lại → chạy script → tự soát, và đầu ra chỉ là văn bản đã viết lại.
- [ ] **AC1.2** — Given `references/patterns-vi.md` và `references/patterns-en.md` Then mỗi file có bảng `| Cụm | Thay bằng |` gồm cụm mở đầu rỗng, từ nhấn rỗng, câu kết lặp, và mục dấu hiệu cấu trúc (gom ba ý, "không chỉ… mà còn…", in đậm tràn lan, emoji, gạch đầu dòng cho văn xuôi).
- [ ] **AC2.1** — Given `scripts/scan-style.mjs <file…>` When file có cụm trong bảng ở văn xuôi Then in `file:line: "<cụm>" → <thay bằng>` và exit 1; cụm nằm trong fenced code block, inline code, URL hoặc dòng trích dẫn (`>`) không bị báo; không có cụm → exit 0; sai đối số hoặc file không đọc được → exit 2. So khớp không phân biệt hoa thường.
- [ ] **AC2.2** — Given test pin `test/content/42-writing-style.pin.mjs` When chạy Then kiểm AC2.1 bằng một bộ ca tham số hoá (văn xuôi, code block, inline code, trích dẫn, exit 0/1/2) và kiểm script đọc được mọi hàng của hai bảng (không bảng nào rỗng).
- [ ] **AC3.1** — Given `BOOTSTRAP` trong `core/hooks/scripts/session-start.mjs` Then có câu: văn bản cho người đọc (README, docs, mô tả PR, release notes, body commit, trả lời chat) viết tự nhiên theo skill `engineering-writing-style` nếu có; không áp cho code, comment code, header commit, config, log, output cho máy đọc, prompt giao agent và trích dẫn. Tổng ≤ 1200 ký tự (test AC1.1 hiện có vẫn xanh).
- [ ] **AC3.2** — Given `test/contract/90-hooks.contract.mjs` When chạy Then đỏ nếu `BOOTSTRAP` nhắc một id skill dạng `` `<plugin>-<slug>` `` hoặc `` `using-aip` `` không có trong nguồn (`core/skills/` hoặc `plugins/*/skills/`).
- [ ] **AC3.3** — Given `docs/specs/hooks-gates/spec.md` Then R12 nêu câu văn phong trong bootstrap và bảng lịch sử có hàng cho request này (R12, đổi).
- [ ] **AC4.1** — Given thay đổi nội dung chiếu Then `plugins/engineering/.manifest.json` 2.11.1 → 2.12.0 (description ghi 13 skill, có `engineering-writing-style`), `core/.manifest.json` 1.28.8 → 1.28.9, `CLAUDE.md` ghi `engineering` 13 skill, `plugins/_cowork.json` có `engineering:engineering-writing-style`; `npm run build`, `node cli/lib/versions.mjs --lock` đã chạy; `npm test` exit 0.
## Thiết kế
Task 1 (DOCS + script, plugin `engineering`):
1. `SKILL.md`: frontmatter `order: 13`, `runsIn: execute`, `invoke: per-request`; thân gồm Mục tiêu, `## Quy trình`, `## Ranh giới an toàn`, Đầu ra, Bản đồ tài liệu.
2. `references/scope.md`: bảng loại văn bản → cần/không cần → lý do; `references/patterns-vi.md`, `references/patterns-en.md`: bảng cụm + mục dấu hiệu cấu trúc (mục này để agent tự soát, script không quét).
3. `scripts/scan-style.mjs`: zero-dep; tách văn bản thành dòng, bỏ dòng trong fenced block và dòng `>`, xoá inline code và URL khỏi dòng trước khi so; export `scanText(text, patterns)` và `loadPatterns(dir)` để test gọi trực tiếp.
4. Pin `42-writing-style.pin.mjs`.

Task 2 (TOOLING, `core`):
5. Thêm câu vào `BOOTSTRAP`; thêm kiểm AC3.2 vào `90-hooks.contract.mjs`.
6. Spec `hooks-gates` R12 + hàng lịch sử.
7. Bump version, `CLAUDE.md`, `_cowork.json`, build, lock, `npm test`.
## Ảnh hưởng spec
- hooks-gates: đổi R12
## Ngoài phạm vi và anti-goal
- Không sửa skill khác (`engineering-release-notes`, `engineering-spec-writing`, `git-workflow`) để gọi skill mới; không thêm hook `PreToolUse`/`Stop`; không tự viết lại văn bản người dùng không yêu cầu.
- Không đổi khối baseline `AGENTS.md`. Không push, không merge khi chưa duyệt G3.
## Ràng buộc
Tiếng Việt có dấu, UTF-8 không BOM, LF; script Node thuần, không dependency; `description` ≤ 500 ký tự, không lặp trigger của skill khác.
## Kiểm thử
AC1.1, AC4.1: `npm test` (convention + validate). AC1.2, AC3.1, AC3.3: đọc diff ở review. AC2.1–AC2.2: pin 42. AC3.2: contract 90-hooks (đỏ khi đổi id trong `BOOTSTRAP` thành id không tồn tại).
## Để builder quyết
Câu chữ chính xác của skill, các bảng cụm (mỗi bảng ≥ 15 cụm) và câu trong bootstrap, miễn đúng AC.
## Rủi ro và câu hỏi mở
Bootstrap chỉ là lời nhắc; model có thể bỏ qua [Inference]. Script quét theo cụm cố định nên không bắt được văn AI không dùng cụm trong bảng, và có thể báo nhầm khi cụm được dùng đúng nghĩa; vì vậy script chỉ là công cụ tự soát, không phải gate.
