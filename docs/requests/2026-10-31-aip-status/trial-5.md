# Lượt thử 5 — aip status và xử lý part vướng với core 1.24.1

- Ngày: 2026-10-31
- Mã nguồn: `feature/aip-status` sau khi merge master `c50e017` (`f103e2f`), core 1.24.1. Lượt thử chạy script và câu chữ
  trực tiếp từ worktree `E:\Mine\AI\ai-engineering-platform\.claude\worktrees\aip-status` (`node cli/index.mjs status`,
  `core/skills/plan-execution/scripts/*.mjs`, `references/inline.md`), không qua bản cài plugin: `aip update -g` cài từ
  checkout chính (master), chưa có bản 1.24.1. [Unverified] Chưa kiểm bản cài plugin 1.24.1 sau khi nhánh merge.
- Repo thử: `E:\Mine\AI\aip-parts-trial`, không remote. Nhánh `feature/text-pad` cắt từ `feature/text-case` `a4f0735`.
  `.claude/aip-gate.json` có `autonomy` mức `high` (`aip autonomy high` đã ghi từ lượt 4; `autonomy.mjs` in
  `{"mergeLocal":true,"cleanup":true,"partRunner":"subagent"}`).
- Request: `docs/requests/2026-10-31-text-pad/` — 2 part song song nhóm A, mỗi part 1 task `TOOLING` TDD `có`:
  `01-pad-left` (`padLeft`) ∥ `02-pad-right` (`padRight`). Vướng có chủ đích: Step 2 của plan part 02 ghi "`fill` rỗng thì
  ném `RangeError`", trái AC2.2 đã duyệt trong `design.md` ("`fill` rỗng thì trả text, không ném lỗi"). `check-request`: chỉ
  W9 trước khi chạy; `check-partition`: 0 cảnh báo.
- G1 và G2 của request thử do session gốc coi như đã duyệt (`Ruling:` ở ledger `root/` của repo thử).

## Diễn biến

| Bước | Ai chạy | Kết quả |
|---|---|---|
| Request + plan (`297ec09`), part `đang làm` + 2 worktree (`b2186b2`) | session gốc | `aip status`: G1 ✓ G2 · , part `chưa làm` |
| Part 01: start, test đỏ (`2285922`), code (`b9a10f4`), `Part: complete` | subagent nền `general-purpose` sonnet | `npm test` exit 1 rồi exit 0 (36 pass) |
| Part 02: start, rồi `Blocked: …` (14:33:44Z), không commit | subagent nền `general-purpose` sonnet | trả `blocked` kèm `questions[]` |
| `aip status` / `aip status --json` / `--html` / `aip statusline` | session gốc | part 02 `vướng`, "Cần bạn xử lý" có đúng 1 mục; dòng statusline `⚠ 1 vướng`; part 01 `xong chờ merge` |
| Trang `status.html` mở ở panel; widget "Cần bạn xử lý" với nút `Xử lý ↗` (`xử lý vướng part 02`) | session gốc | theo `SKILL.md` của `aip-status` |
| Gỡ: sửa Step 2 của plan part 02 theo AC2.2 (`d8ad9b3`), ghi `Unblocked:` (14:34:40Z) + `Ruling:` ở `root/`, giao lại subagent mới | session gốc | `aip status`: part 02 `đang làm`, `vướng 0`, statusline mất `⚠` |
| Part 02: start mới (BASE `d8ad9b3`), test đỏ (`4f08ace`), code (`4a6c584`), `Part: complete` | subagent nền sonnet | `npm test` exit 1 rồi exit 0 (33 pass) |
| Merge part 01 (`a68a32f`), part 02 (`daa5f80`) + Bảng part `merged` | session gốc | `npm test` exit 0 sau mỗi merge; `aip status`: `Part merged 2/2`, `vướng 0` |
| Gỡ 2 worktree + 2 nhánh part (`cleanup: true`) | session gốc | `git worktree remove`, `git branch -d` sạch |

Từ lúc part 02 ghi `Blocked:` tới `Unblocked:`: 56 giây; 0 câu hỏi cho người dùng.

## Kết quả theo AC

| AC | Kết quả | Bằng chứng |
|---|---|---|
| AC1.1 | đạt | bảng part có đủ `chưa làm` → `xong chờ merge` / `vướng` → `đang làm` → `merged` theo ledger |
| AC1.2 | đạt | `aip status --json` có đủ khoá `header, gates, needs, totals, parts, graph, details, events` (7 khối; chi tiết và sự kiện chung một khối) |
| AC1.3 | đạt | `aip status --html` ghi `.aip/runs/2026-10-31-text-pad/status.html`, mở được ở panel (pane xem trước báo "static snapshot") |
| AC1.4, AC1.5 | không chạy ở lượt này | chỉ có test `test/status.test.mjs` (57 OK); request thử không có phụ thuộc, không part im lặng |
| AC2.1, AC2.2 | đạt | `events.jsonl` ở cả 3 workspace, mỗi dòng ledger một bản ghi `{ts, line}`; dòng `Blocked:`/`Unblocked:` có mốc thời gian; `progress.md` không có JSON |
| AC3.1 | đạt một phần | trang mở ở panel + widget có khối "Cần bạn xử lý" và nút `Xử lý ↗` (dựng theo `SKILL.md`, không gọi qua `/aip-status` vì skill chưa cài); [Unverified] nút chưa bấm thật, câu `xử lý vướng part 02` do session gốc tự gõ |
| AC3.2 | không chạy ở lượt này | phiên có công cụ hiển thị; chỉ có pin `35-aip-status.pin.mjs` |
| AC4.1 | đạt | vướng thuộc loại "câu hỏi trả lời được từ design/plan": không hỏi người dùng, ghi `Ruling:` (`root/`) + `Unblocked:` (ledger part), sửa plan theo AC2.2, giao lại subagent; không chạm giới hạn 2 vòng sửa hay 1 lần khởi động lại |
| AC4.2, AC4.3 | **không kiểm được** | vướng của lượt này tự gỡ được nên không có thẻ hỏi người dùng; chỉ có pin câu chữ. Chưa quan sát "gom một thẻ", "part khác chạy tiếp trong lúc chờ" (part 01 đã xong từ trước), "không nhắc lại" |
| AC5.1 | đạt | `aip statusline` in `⚠ 1 vướng` khi part 02 vướng; mất sau `Unblocked:` |
| AC6.1 | đạt một phần | trang đúng trạng thái ở mọi bước, gỡ xong part tiếp tục và `merged`; dừng ở trước review cuối và G3 của request thử (dải cổng `G3 ·`), không có người duyệt thật ở G1/G2 |

## Phát hiện

- V1 (minor): lượt chạy lại part 02 ghi dòng `Task 1: start` thứ hai (BASE mới `d8ad9b3`) mà không có dòng `complete` ở giữa;
  `aip status` vẫn ra `đang làm` đúng, nhưng `inline.md` chưa nói gì về dòng start lặp lại khi giao lại part. Không sửa.
- V2 (minor): subagent part 02 ghi thêm dòng tự do `BASE <hash>` ở đầu ledger part. `ledger.mjs` chấp nhận (dòng tự do), không ảnh hưởng.
- V3: `AC4.2/AC4.3` cần một lượt thử riêng với vướng thuộc 6 loại dừng (vd AC mơ hồ) và người dùng thật trả lời.
