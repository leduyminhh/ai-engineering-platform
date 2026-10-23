# Thiết kế: theo dõi mức dùng và chi phí từ transcript (project P5c)
- Ngày: 2026-10-22
- Trạng thái: merged — master `4186bf4` (2026-10-22).
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P5c (xu hướng 9)

## Vấn đề và lý do

Khoảng trống đã ghi cho xu hướng 9: aip có quy tắc chọn model và effort (ADR-0002) và `aip stats` đo dung lượng context của từng phiên (ADR-0003), nhưng chưa trả lời "token và tiền đang đi đâu": theo model nào, phiên chính hay subagent, và những lượt nào bị tính lại cache. Số đo của phiên điều phối thật cho thấy chi phí lớn nhất là số lượt (mỗi lượt đọc lại toàn bộ context), cache bị mất khi đổi model hoặc để phiên nguội, và subagent chạy song song. Những thứ đó nhìn thấy được trong transcript, nhưng hiện chỉ đọc bằng tay.

Kiểm trực tiếp một thư mục transcript thật (2026-10-22, chỉ đọc tên trường, không đọc nội dung; layout là nội bộ của Claude Code nên ghi [Unverified]):
- Dòng `assistant` có `message.model` và `message.usage` với `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` (kèm `cache_creation.ephemeral_1h_input_tokens` và `ephemeral_5m_input_tokens`), `output_tokens`; mọi dòng có `timestamp`, `sessionId`.
- Có dòng `type: "cost-state"` mang `totalCostUSD` tích lũy (tăng dần trong cùng phiên), `modelUsage` (đối tượng theo model), `totalDuration`, `hasUnknownModelCost`. [Inference] đây là bộ đếm tiền của chính Claude Code, nên không cần bảng giá riêng trong aip.
- Subagent có transcript riêng ở `<sessionId>/subagents/agent-<id>.jsonl` kèm `agent-<id>.meta.json`; dòng trong đó có `isSidechain: true` và `agentId`.

## Quyết định đã chốt

Của người dùng (2026-10-22): "bỏ qua câu hỏi, tự đề xuất" cho thiết kế P5c, rồi "Duyệt design P5c, chạy subagent-driven trong phiên mới"; phần dưới là đề xuất của tôi được duyệt cùng (hai câu hỏi mở cuối giữ đề xuất: mặc định 7 ngày, thiếu `cost-state` thì `—`). Giữ nguyên: aip zero-dep, chỉ đọc, không tự chạy agent; layout transcript là nội bộ (đã ghi ở `aip stats`).

Đề xuất của tôi:
- **Mở rộng `aip stats`, không thêm lệnh mới:** cờ `--usage` (và `--since <số ngày|yyyy-mm-dd>`, mặc định 7 ngày) cho cái nhìn tổng hợp; các chế độ cũ (bảng context, `--session`, `--json`) giữ nguyên hành vi.
- **Tiền lấy từ `cost-state` của Claude Code, không tự tính giá:** mỗi phiên lấy bản ghi có `totalCostUSD` lớn nhất (tích lũy). Phiên thiếu `cost-state` hiển thị `—` cho tiền, vẫn có token. `hasUnknownModelCost = true` được gắn nhãn "có model chưa rõ giá". Không có bảng giá và không có dự đoán hạn mức: [Unverified] hạn mức theo gói không nằm trong transcript.
- **Token theo model:** cộng `usage` theo `message.model` cho các dòng `assistant`, mỗi `message.id` chỉ tính một lần (các block của cùng một lượt có thể lặp `usage`; lấy giá trị lớn nhất của từng trường). Cột: lượt, input, cache đọc, cache tạo (tách 1 giờ/5 phút nếu có), output, phần trăm cache đọc.
- **Phiên chính so với subagent:** đọc cả `subagents/agent-*.jsonl`; gộp theo loại agent lấy từ `.meta.json` nếu có tên, nếu không thì theo `agentId`. Báo phần của subagent trên tổng.
- **Tín hiệu "tốn vì cache":** đếm (a) lần đổi model giữa hai lượt liên tiếp của cùng một chuỗi; (b) khoảng nghỉ giữa hai lượt vượt 60 phút (cache phiên chính hết hạn sau 1 giờ theo tài liệu đã trích ở design P5b) mà lượt sau có `cache_creation_input_tokens` lớn; (c) lượt có `cache_creation_input_tokens` chiếm hơn 50% context. Hiển thị số lần và token liên quan, không phán xét đúng sai.
- **Đầu ra:** bảng ngắn (tổng theo model; 5 phiên tốn nhất kèm tiền, số lượt, phần subagent, các tín hiệu cache) và `--json` cho công cụ khác. Không bao giờ in nội dung hội thoại: chỉ số, tên model, `sessionId`, tên agent và tên file transcript.
- **Dogfood P7:** request này tạo spec sống đầu tiên của `cli-wizard` (`docs/specs/cli-wizard/spec.md`), chỉ với yêu cầu mới về `aip stats --usage`, không backfill phần cũ.
- **Không bump version** trừ khi `versions.mjs --lock` buộc: `cli/lib/*` không nằm trong build plugin (đã kiểm ở P4: thêm file ở `core/permissions` và `cli/lib` không đổi hash plugin).

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given các dòng transcript có `cost-state` với `totalCostUSD` tăng dần trong cùng `sessionId`, When tổng hợp phiên, Then tiền của phiên bằng `totalCostUSD` lớn nhất; phiên không có `cost-state` có tiền `null` (hiển thị `—`); `hasUnknownModelCost: true` được ghi nhận.
- [x] **AC1.2** — Given dòng `assistant` có `message.id` lặp (nhiều block cùng một lượt), When cộng token theo model, Then mỗi `message.id` chỉ được tính một lần (lấy giá trị lớn nhất mỗi trường `usage`); dòng không có `usage` hoặc `model` `<synthetic>` không vào bảng token theo model.
- [x] **AC1.3** — Given thư mục `<sessionId>/subagents/` có `agent-<id>.jsonl` (và `agent-<id>.meta.json` hoặc không), When tổng hợp, Then token của subagent được gộp theo tên agent từ meta (không có meta thì theo `agentId`) và tách khỏi phiên chính, kèm phần trăm trên tổng.
- [x] **AC1.4** — Given chuỗi lượt có đổi model, khoảng nghỉ trên 60 phút trước một lượt tạo cache lớn, hoặc lượt có cache tạo chiếm trên 50% context, When tổng hợp, Then các tín hiệu tương ứng được đếm kèm số token liên quan; chuỗi không có hiện tượng nào cho tất cả bằng 0.
- [x] **AC2.1** — Given `aip stats --usage [--since <số ngày|yyyy-mm-dd>] [--json]`, Then in bảng tổng theo model và 5 phiên tốn nhất trong khoảng thời gian (mặc định 7 ngày; theo `timestamp` của dòng), và `--json` in đối tượng cùng nội dung có khóa ổn định; `--since` sai định dạng thì in cách dùng và exit 2.
- [x] **AC2.2** — Given `parse()` của `cli/lib/args.mjs`, Then `--usage` và `--since` được đọc đúng (kiểm qua kết quả `parse()`, không dựng tay args); `--usage` kết hợp với `--session` bị từ chối với thông báo rõ; hành vi của `aip stats` cũ không đổi.
- [x] **AC2.3** — Given một transcript fixture chứa chuỗi nội dung nhận diện được (văn bản người dùng, kết quả công cụ), When chạy `--usage` (bảng và `--json`), Then đầu ra không chứa các chuỗi đó, và lệnh không ghi file nào (kiểm thư mục chỉ-đọc hoặc so danh sách file trước/sau).
- [x] **AC3.1** — Given `README.md` và `README_VI.md`, Then mục `aip stats` có `--usage`/`--since`, nêu rằng tiền lấy từ `cost-state` của Claude Code (không có bảng giá của aip, không dự đoán hạn mức), nhãn `[Unverified]` cho layout nội bộ và cho ý nghĩa của `cost-state`, và `CLAUDE.md` mô tả cờ mới trong dòng lệnh `aip stats`.
- [x] **AC4.1** — Given repo sau thay đổi, Then `docs/specs/cli-wizard/spec.md` tồn tại với `cli-wizard/R1…` cho `aip stats --usage` (tổng hợp theo model, chỉ đọc không in nội dung, tiền từ `cost-state`); `docs/specs/README.md` giữ đủ 7 năng lực; `check-request.mjs` trên request này không có W10–W14.
- [x] **AC5.1** — Given spec tổng `docs/requests/2026-10-21-aip-trends-master-spec/design.md` và design P3 `docs/requests/2026-10-22-parallel-agents/design.md`, Then spec tổng ghi P3 xong (merge `480edd2`) và P5c xong (kèm hash khi đã merge), bảng trace xu hướng 6 và 9 khớp; header design P3 ghi merge `480edd2`.
- [x] **AC6.1** — `npm test` xanh; không đổi nội dung plugin nên không bump version trừ khi `versions.mjs --lock` buộc; `npm run pack:verify` xanh.

## Ảnh hưởng spec
- cli-wizard: thêm R1, thêm R2, thêm R3

## Thiết kế

### 1. Phân tích transcript (`cli/lib/transcript-stats.mjs` hoặc module mới `cli/lib/transcript-usage.mjs`)

Hàm thuần nhận các dòng của một phiên (chính và subagent) và trả về cấu trúc `{ sessionId, costUsd|null, unknownModelCost, byModel, bySubagent, signals, firstTs, lastTs }`; một hàm gom nhiều phiên theo cửa sổ thời gian và dựng tổng, 5 phiên tốn nhất. Việc đọc đĩa tách riêng để test bằng fixture. Dòng lỗi (dòng cuối của phiên đang chạy) bị bỏ qua như code hiện có. Phiên xuất hiện ở nhiều file (resume/fork) được gộp theo `sessionId`, lấy `cost-state` lớn nhất để không đếm trùng tiền.

### 2. CLI

`cli/lib/args.mjs` thêm `--usage` và `--since`; `cli/index.mjs` nối lệnh `stats` với chế độ mới và in bảng (căn cột bằng Node thuần như bảng hiện có). Mặc định `--since` 7 ngày; lọc theo `timestamp` của từng dòng chứ không theo mtime của file.

### 3. Tài liệu và spec sống

README EN/VI và `CLAUDE.md` mô tả cờ mới; spec sống `cli-wizard` được tạo với ba yêu cầu mới (R1 tổng hợp theo model từ transcript, chỉ đọc; R2 tiền lấy từ `cost-state`, không có bảng giá; R3 không in nội dung hội thoại). Đồng bộ trạng thái P3 và P5c vào spec tổng ở task cuối.

## Ngoài phạm vi và anti-goal

- Không bảng giá, không đổi tiền tệ, không dự đoán hạn mức hay cảnh báo ngưỡng, không hook, không ghi file, không gửi dữ liệu đi đâu.
- Không đo thay thế cho `get_usage` hay statusline của Claude Code; không sửa các chế độ `aip stats` đã có.
- Anti-goal: một báo cáo "chi phí" cho kết luận chắc chắn về hóa đơn; số `totalCostUSD` chỉ là bộ đếm nội bộ của Claude Code và có thể lệch hóa đơn hoặc hạn mức gói.

## Ràng buộc

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; README EN/VI.
- Chỉ đọc `~/.claude/projects/<slug>/` của project hiện tại như `aip stats` hiện có; không đọc project khác.
- Test dùng fixture tự dựng trong test, không dùng transcript thật.
- Nhánh `feature/p5c-cost-tracking`, commit mỗi task qua `core:git-workflow`; không push.

## Kiểm thử

- AC1.x: test đơn vị cho hàm tổng hợp, bảng tham số hóa theo chuỗi dòng fixture; gộp nhiều file cùng `sessionId`.
- AC2.1, AC2.3: test CLI trên thư mục `HOME` tạm với fixture; AC2.2 qua `parse()` trong `test/args.test.mjs`.
- AC3.1: pin README theo đoạn neo; AC4.1: `check-request.mjs`; AC5.1 kiểm đọc.
- AC6.1: `npm test`, `pack:verify`.

## Để builder quyết

- Tên module và cách chia hàm; định dạng cột của bảng; cách hiển thị `cost-state` thiếu.
- Cách lấy "tên agent" từ `agent-<id>.meta.json` sau khi đọc một file thật (trường chưa được kiểm trong design này).
- Ngưỡng tín hiệu cache là 60 phút và 50% (đề xuất của tôi) có thể chỉnh nếu fixture thật cho thấy không hợp.

## Rủi ro và câu hỏi mở

- [Unverified] Layout transcript và ý nghĩa của `cost-state` là nội bộ Claude Code và có thể đổi; mọi con số ghi rõ nguồn và có thể sai lệch hóa đơn.
- [Unverified] Trường tên agent trong `agent-<id>.meta.json` và cấu trúc giá trị trong `modelUsage` chưa được kiểm; builder đọc một file thật (chỉ khóa) trước khi hiện thực.
- [Inference] `cost-state` tích lũy theo phiên gốc có thể đã gồm cả chi phí subagent; nếu vậy "tiền của subagent" không tách được từ `cost-state`, chỉ tách được token. Builder cần kiểm bằng một phiên có subagent và ghi kết luận vào design.

### Kết quả kiểm trực tiếp (2026-10-22)

Builder đọc một phiên thật có 8 subagent, chỉ khóa và số, không đọc nội dung. [Unverified] vì layout là nội bộ Claude Code.

- `agent-<id>.meta.json` có khóa: `agentType` (chuỗi, ví dụ `general-purpose`), `description`, `toolUseId`, `spawnDepth`, `requestShape`, `requestNonInteractive`, `model`. Tên agent lấy từ `agentType`; không đọc `description` (có thể mang nội dung hội thoại). Thiếu meta hoặc thiếu `agentType` thì dùng `agentId`.
- Dòng trong `subagents/agent-*.jsonl` có `isSidechain: true`, `agentId`, `timestamp`, và `sessionId` bằng sessionId của phiên gốc.
- `cost-state` có khóa `sessionId`, `totalCostUSD`, `modelUsage`, `hasUnknownModelCost`, `totalDuration`, `startTime`..., và KHÔNG có `timestamp`. `modelUsage[<model>]` = `{ inputTokens, outputTokens, thinkingTokens, cacheReadInputTokens, cacheCreationInputTokens, webSearchRequests, costUSD }`.
- Câu hỏi cost-state có gồm subagent: [Inference] CÓ. Ở phiên đó, `cacheReadInputTokens` của model sonnet trong `modelUsage` trùng khít tổng `cache_read_input_tokens` của 8 transcript subagent (11992206), còn phiên chính chỉ dùng opus. Hệ quả: tiền không tách được giữa phiên chính và subagent; chỉ tách được token. Bảng báo tiền cả phiên (gồm subagent), phần subagent báo bằng token.
- Hệ quả hiện thực: `modelUsage[<model>].costUSD` dùng làm cột tiền theo model (số của Claude Code, không tính lại). `--since` lọc token theo `timestamp` của dòng; tiền là tổng tích lũy cả phiên, không chia theo cửa sổ, nên phiên có ít nhất một lượt trong cửa sổ được tính trọn tiền (đầu ra ghi rõ).

- Câu hỏi mở 1: có cần cửa sổ thời gian khác 7 ngày làm mặc định không.
- Câu hỏi mở 2: khi `cost-state` thiếu, hiển thị `—` hay ước tính từ token (đề xuất: `—`, không ước tính).
