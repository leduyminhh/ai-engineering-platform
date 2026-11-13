# Thiết kế trial plugin `frontend`

Ngày: 2026-11-13. Người duyệt: người dùng (G1 của trial này). Đầu ra cuối: `trial-report.md` cùng thư mục.

## Mục đích

Chạy thật plugin `frontend` của aip và các workflow liên quan (`workflow-feature`, `workflow-bugfix`, `workflow-performance`) để dựng một UI mới, rồi ghi nhận chỗ nào đúng, chỗ nào lỗ, và nâng cấp nào đáng làm. Các trial trước (lifecycle, e2e headless) tìm ra lỗ ở cổng finish và routing nhưng chưa có trial nào tập trung vào frontend thật.

## Mục tiêu

- Phủ các skill: `frontend-init`, `frontend-implement`, `frontend-data-integration`, `frontend-testing`, `frontend-e2e-testing`, `frontend-code-review`, `frontend-manual-check`, `frontend-fix`, `frontend-performance`.
- Phủ các agent `frontend-implementer`, `frontend-data-integrator`, `frontend-test-writer`, `frontend-e2e-test-writer`, `frontend-reviewer`, `frontend-fixer`, `frontend-performance-analyst`.
- Đo routing tự nhiên: prompt như người dùng thật, không gọi tên skill.
- Quan sát hook (chặn/hỏi có hợp lý không), cổng G1/G2/G3, số lần bị hỏi, thời gian và token.

## Không làm / không được làm

- Không sửa plugin trong phiên này. Nâng cấp nào được chọn sẽ là request riêng.
- Không dựng backend thật; không staging/production; không push; không đọc file bí mật.
- Không chấm "UI đẹp"; chấm quy trình và độ đúng của kết quả.
- Anti-goal: trial chỉ cho thấy plugin chạy được vì tôi mớm prompt. Nếu phải mớm tên skill để nó chạy, ghi là lỗ routing.

## Các hướng đã cân nhắc (cách chạy)

1. **Prompt tự nhiên, không nhắc skill (chọn).** Giống người dùng thật; đo được routing. Nếu kẹt, mới nhắc nhẹ và ghi là lỗ.
2. Prompt gọi tên skill tường minh. Chạy trơn nhưng không đo được routing, trái với lý do làm trial.
3. Lai: tự nhiên rồi mớm khi sai. Là cách xử lý khi kẹt của hướng 1, không phải hướng riêng.

Người dùng đã chọn: headless `claude -p --model sonnet`, "như một lần chạy bình thường", không đặt trần chi phí.

## Thiết kế

**UI mẫu: Bảng ticket (React + TypeScript).** Danh sách ticket, lọc theo trạng thái, form tạo ticket, đổi trạng thái; đủ 4 trạng thái loading/empty/error/success. Nhỏ nhưng phủ implement → data → test → e2e → review, và có chỗ cho bug và hiệu năng.

**Project:** `E:\Mine\AI\aip-frontend-trial`, `git init`, ngoài repo aip. Stack: React + TypeScript + Vite + Vitest + Testing Library + msw + Playwright. Chromium đã có trong cache `ms-playwright`, không tải thêm; `npm install` cần mạng tới npm registry.

**Cài aip:** `aip` toàn cục đã `npm link` tới `E:\Mine\AI\ai-engineering-platform` (master, trùng base nhánh này). Chạy `aip install` plugin mode cho `claude` (core + frontend + engineering + workflows) và `aip init` vào project để có hook và khối baseline. Ghi version đã cài.

**Chuẩn bị đầu vào (do tôi, ghi rõ là mớm):**

- `design/ticket-board.html`: mockup HTML/CSS (đầu vào của `frontend-implement`).
- `docs/contracts/openapi.yaml`: contract 4 endpoint (`GET/POST /tickets`, `PATCH /tickets/{id}`), đầu vào của `frontend-data-integration`.
- `mock-api/`: server Node thuần bám contract, có cờ nạp 5000 ticket (cho bước performance).
- `.claude/aip-gate.json` mặc định (`mode: ask`); không bật `full`. Chạy `claude -p` với `--permission-mode bypassPermissions` như trial e2e: hook vẫn chạy, nhưng `mode: full` không bật nên guard giữ nguyên.

**Các lượt (headless, `--resume` giữa các lượt, `--output-format stream-json`):**

| Lượt | Prompt (tự nhiên) | Kỳ vọng |
|---|---|---|
| 0 | gọi `frontend-init` | sinh `architecture.md`, `design-system.md` |
| 1 | "làm màn hình quản lý ticket theo mockup, nối API, có test" | brainstorming/`workflow-feature` → G1 |
| 2 | duyệt design | plan → G2 |
| 3 | duyệt plan, chọn Subagent | `plan-execution`: implement → data → test → e2e, review từng task |
| 4 | duyệt diff cuối | review cuối, G3, giữ nhánh |
| 5 | bug báo như người dùng (tôi gài lỗi lọc ở commit riêng) | `workflow-bugfix` → `frontend-fix` |
| 6 | "trang lag khi 5000 ticket" | `workflow-performance` → `frontend-performance` |

Duyệt G1/G2/G3 bằng tin nhắn `--resume` ngắn; mọi câu hỏi agent đặt ra được ghi lại, trả lời tối thiểu.

**Ghi nhận mỗi lượt:** skill và agent được gọi (từ stream-json), lệnh hook chặn/hỏi, build/tsc/lint/test/e2e xanh hay đỏ, số lần bị hỏi, `duration_ms`, `total_cost_usd`/token nếu có. Log ở scratchpad, trích dẫn vào báo cáo.

**Tiêu chí chấm (0–10, kèm bằng chứng file:line/log/lệnh):**

1. Routing: skill/workflow/agent đúng ngay lần đầu, không mớm.
2. Kết quả: build, tsc, lint, test, e2e xanh; AC khớp; a11y cơ bản.
3. Đúng quy trình: G1/G2/G3, ledger, review từng task, commit theo `git-workflow`.
4. Hook: chặn/hỏi đúng chỗ, không chặn oan.
5. Ít hỏi: số lần dừng không cần thiết.
6. Chi phí: thời gian và token mỗi lượt.

**Báo cáo:** `trial-report.md` (tiếng Việt): bảng điểm, bằng chứng, danh sách nâng cấp xếp theo tác động kèm file cần sửa dưới `plugins/frontend/` hoặc `workflows/`. Commit báo cáo và thiết kế này qua `core:git-workflow` (không Co-Authored-By); không push, không merge.

## Việc để người thực hiện quyết

- Chi tiết mockup, nội dung seed, bug gài cụ thể (chọn một lỗi hành vi lọc; phải ghi lại trong báo cáo).
- Ngưỡng "lag" cho lượt 6 (đo ≥ 3 lần bởi `frontend-performance`).
- Dọn: giữ nguyên `aip-frontend-trial` để người dùng xem; xoá chỉ khi họ nói, bằng Node `fs.rmSync`.

## Rủi ro

- Chi phí model không trần; ước tính vài chục lượt sonnet, một vài lượt có subagent opus (review cuối).
- Trial dùng `aip` toàn cục đang link tới master local; nếu master đổi giữa chừng, kết quả lệch. Ghi commit của aip lúc bắt đầu.
- Headless không có người chọn tương tác; câu hỏi dạng thẻ (AskUserQuestion) có thể không hiển thị được. Ghi lại nếu xảy ra, vì đó là phát hiện về cổng.
