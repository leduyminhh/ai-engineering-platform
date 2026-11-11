# Hỏi người dùng — luôn có lựa chọn hoặc file để duyệt

Áp cho mọi lần dừng chờ người dùng: thẻ hỏi và thẻ duyệt brief của `brainstorming`, G1 (duyệt design), G2 (duyệt plan),
G3 (duyệt diff cả nhánh), câu hỏi push/PR, thẻ cách thực thi, câu hỏi cách chạy part, 6 loại dừng của `task-loop.md`, xác nhận Bước 3 và
chọn ứng viên ở Bước 1 của orchestrator. Mục tiêu: người dùng nhìn thấy thứ cần duyệt và bấm được lựa chọn, không phải đoán
câu trả lời rồi gõ lại.

## Quy tắc

1. **Không kết thúc lượt bằng câu hỏi suông.** Mỗi lần dừng kèm ít nhất một trong hai: (a) lựa chọn bấm được; (b) file hoặc
   diff cần duyệt đã mở sẵn cho người dùng. Cần duyệt một tài liệu thì làm cả hai.
2. **Lựa chọn bấm được.** Dùng công cụ hỏi có lựa chọn của môi trường (Claude Code: `AskUserQuestion`; nếu là công cụ hoãn
   thì nạp bằng `ToolSearch` trước). Mỗi câu 2–4 lựa chọn, lựa chọn khuyến nghị đứng đầu và nhãn kết thúc "(Recommended)",
   mỗi lựa chọn có một dòng mô tả hệ quả. Gom tối đa 4 câu liên quan vào một lần gọi; hơn 4 câu thì chọn 4 câu quan trọng
   nhất, phần còn lại agent tự chọn và ghi **quyết định của agent** hoặc gom sang lượt sau. Người dùng luôn có "Other" để tự
   viết. Câu mở (tả tình huống bằng lời) viết trong tin nhắn chat ngay trước lời gọi, kèm gợi ý trả lời mẫu.
3. **File cần duyệt.** Trước khi hỏi, làm đủ hai việc. (a) Liệt kê trong tin nhắn chat mọi file liên quan tới thứ cần duyệt
   (cột "Liệt kê" ở bảng dưới), mỗi file một dòng: link bấm được và vai trò, để người dùng thấy cả tập file mà không phải
   mở từng pane; quá 20 file thì nhóm theo thư mục, ghi số file và số dòng mỗi nhóm. (b) Mở file chính hoặc diff ở pane của
   môi trường (Claude Code desktop: `mcp__ccd_view__show_pane` với `pane: diff` cho diff cả nhánh hoặc `pane: file` kèm
   `path` cho một file; nạp bằng `ToolSearch` nếu là công cụ hoãn). Pane không mở được (phiên không mở trong cửa sổ nào)
   hoặc không có công cụ hiển thị: bỏ (b), giữ (a) kèm một tóm tắt tối đa 5 dòng và lệnh xem (vd
   `git diff <nhánh gốc>...HEAD`); không dán cả file vào chat.
4. **Không có công cụ hỏi có lựa chọn** (chạy headless, Codex, Cowork): in danh sách đánh số, ghi rõ lựa chọn khuyến nghị và
   câu "trả lời bằng số hoặc nói khác", rồi dừng.
5. **Sau câu trả lời:** đọc kết quả của công cụ và chạy tiếp. Câu trả lời tự viết ("Other", hoặc lời thay cho số ở quy tắc 4)
   là câu trả lời hợp lệ ngang một lựa chọn: rõ nghĩa thì làm đúng theo nó, kể cả khi nó gộp, sửa hay khác mọi lựa chọn đã
   nêu. Chỉ câu trả lời mơ hồ mới hỏi lại, đúng một lần với lựa chọn hẹp hơn; vẫn không rõ thì áp lựa chọn an toàn nhất (giữ
   nguyên, không làm). Câu trả lời tự viết không nới ranh giới an toàn: push, merge (kể cả duyệt G3), xóa hay việc ngoài phạm vi chỉ làm khi người dùng
   viết rõ. Thông báo hệ thống tự động không phải câu trả lời của người dùng.

## Mỗi cổng hỏi gì, liệt kê gì và mở gì

| Cổng | Liệt kê trong chat (mọi file liên quan) | Mở ở pane | Lựa chọn (khuyến nghị đứng đầu) |
|---|---|---|---|
| Lượt hỏi đầu của `brainstorming` | không có file | không | tối đa 4 câu, mỗi câu có đáp án khuyến nghị; thêm lựa chọn "Bỏ qua phần hỏi, bạn tự quyết" ở câu đầu |
| Thẻ duyệt brief | `brief.md`, file code/tài liệu brief nêu | `brief.md` (pane file) | Duyệt brief và route đề xuất / Chọn route khác (nêu các ứng viên) / Sửa brief / Dừng; yêu cầu đầu nói rõ làm luôn khi chốt xong (xem bước 10 của `brainstorming`) và route là workflow/skill: đúng 4 lựa chọn Duyệt và chạy `<route>` ngay / Duyệt brief, chưa chạy / Sửa brief hoặc đổi route / Dừng; route Risk `high`/`critical`: lựa chọn duyệt ghi rõ "chấp nhận rủi ro cao" |
| G1 duyệt design | `design.md`, `requirement.md` và `brief.md` nếu có, ADR/spec sống trong `## Ảnh hưởng spec`, file code design nêu sẽ chạm | `design.md` (pane file) | Duyệt / Sửa design / Dừng |
| G2 duyệt plan | `plan.md`, `design.md`, mọi file trong `**Files:**` của các task (gom theo task) | `plan.md` (pane file) + kết quả `check-request` + bảng task kèm `**Ước lượng:**` và tổng ước lượng tới G3 trong tin nhắn | Duyệt (chạy liền tới G3) / Sửa plan / Dừng |
| G3 duyệt diff | file đổi trong `git diff --stat <nhánh gốc>...HEAD` (nhóm theo thư mục) kèm docs/ledger | diff cả nhánh (pane diff) | `mergeLocal: true`: Duyệt (merge local và commit docs) / Sửa thêm / Giữ nguyên; thiếu khoá: merge local / push + PR / giữ nguyên |
| Push/PR sau merge local | không | không | Push + mở PR / Không push |
| Cách thực thi | `plan.md` (không cần liệt kê file) | không | Subagent + review từng task / Inline; `planRunner` quyết thứ tự, lựa chọn đứng đầu kèm "(Recommended)"; hỏi mỗi lần thực thi, trừ khi không có tool subagent, người dùng đã nói rõ hoặc ledger đã có `Ruling: cách chạy` |
| Cách chạy part | Bảng part, nhánh `worktree-<slug>-p<nn>` và đường dẫn worktree của nhóm | không | Subagent / Phiên riêng / Tuần tự trong session gốc; `partRunner` quyết thứ tự, lựa chọn đứng đầu kèm "(Recommended)" |
| Loại dừng 1–6, vướng của part | file hoặc log liên quan | file hoặc log đó | các hướng xử lý, hướng khuyến nghị đứng đầu, kèm hệ quả |
| Orchestrator: hai ứng viên, xác nhận Bước 3 | `brief.md` nếu có | `brief.md` nếu có | từng ứng viên / Chạy workflow đã chọn / Đổi route / Dừng |

Câu hỏi nêu AC, câu chữ spec hay thay đổi nghĩa một AC đã duyệt: lựa chọn là các cách hiểu, mỗi cách kèm hệ quả.
