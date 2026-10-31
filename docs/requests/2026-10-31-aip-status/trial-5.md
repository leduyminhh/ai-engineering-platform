# Lượt thử 5 — aip status và xử lý part vướng với core 1.24.2

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
| AC4.2 | đạt (lượt 5b) | hai part vướng loại hỏi người dùng gom vào một thẻ có cách hiểu, hệ quả, đáp án khuyến nghị; part 01 merge và part 03 chạy tiếp trong lúc chờ; lời giải gửi về part bằng `SendMessage` (tiếp tục subagent đã dừng từ transcript); `Unblocked:` ghi vào ledger của từng part |
| AC4.3 | đạt có điều kiện (lượt 5b) | vướng mới (part 03) gộp vào cùng thẻ chỉ với mục mới, mục cũ chỉ nhắc một dòng "vẫn chờ, không hỏi lại"; xem V4 |
| AC5.1 | đạt | `aip statusline` in `⚠ 1 vướng` khi part 02 vướng; mất sau `Unblocked:` |
| AC6.1 | đạt (lượt 5 + 5b) | trang đúng trạng thái ở mọi bước, vướng gỡ xong part tiếp tục và `merged`; lượt 5b chạy tới G3 của request thử, người dùng duyệt thật, merge local, `Plan: complete`. G1 và G2 của request thử vẫn do session gốc coi như duyệt |

## Phát hiện

- V1 (minor): lượt chạy lại part 02 ghi dòng `Task 1: start` thứ hai (BASE mới `d8ad9b3`) mà không có dòng `complete` ở giữa;
  `aip status` vẫn ra `đang làm` đúng, nhưng `inline.md` chưa nói gì về dòng start lặp lại khi giao lại part. Không sửa.
- V2 (minor): subagent part 02 ghi thêm dòng tự do `BASE <hash>` ở đầu ledger part. `ledger.mjs` chấp nhận (dòng tự do), không ảnh hưởng.
- V3: đã xử lý ở lượt 5b bên dưới.

## Lượt 5b — vướng loại hỏi người dùng, tới G3 của request thử

Bổ sung sau yêu cầu của người dùng ở G3 của nhánh aip-status ("Chặn merge, bổ sung trước"). Cùng cách chạy như lượt 5 (script và câu chữ từ worktree, `autonomy high`).

- Request: `docs/requests/2026-10-31-text-wrap/`, 3 part song song nhóm A: `01-wrap-hard` (sạch), `02-wrap-soft` (AC2.2 chưa chốt: từ dài hơn độ rộng), `03-indent` (3 task; AC3.3 chưa chốt ở Task 3: dòng trống khi thụt lề). Design ghi hai AC đó chỉ người dùng chốt được.
- Nhánh `feature/text-wrap` cắt từ `feature/text-pad`; đích merge là `feature/text-pad`.

| Bước | Kết quả |
|---|---|
| 3 subagent nền chạy song song | 02 `Blocked:` sau khoảng 25 giây, không commit; 01 xong và merge (`82e2fec`, `npm test` exit 0) trong lúc 02 chờ |
| `aip status` + statusline | 02 `vướng`, "Cần bạn xử lý" 1 mục, `⚠ 1 vướng`; 01 `merged`, 03 `đang làm` |
| Thẻ vướng gửi người dùng (một lần) | widget với hai nút chọn (a)/(b) kèm đáp án khuyến nghị (b), cách hiểu và hệ quả |
| 03 `Blocked:` ở Task 3 (Task 1, 2 đã xong và commit) | `aip status`: `vướng 2`, `⚠ 2 vướng`; thẻ cập nhật chỉ thêm mục 2 |
| Người dùng trả lời một câu: "AC2.2 (b), AC3.3 (b)" | root sửa AC trong `design.md` (`7f8157d`), ghi `Unblocked:` vào ledger của từng part, `Ruling:` ở `root/` |
| Gửi lời giải về part | `SendMessage` tới hai subagent đã dừng: cả hai tiếp tục từ transcript, 02 làm lại Task 1 (đỏ `8c77977`, xanh `6e73dbf`), 03 làm Task 3 (đỏ `71ce324`, xanh `fbaed82`) |
| Merge part 02 (`6479baa`), 03 (`8581dba`) | `npm test` exit 0 sau mỗi merge; `aip status`: `Part merged 3/3`, `vướng 0` |
| Review cuối (sonnet, bỏ auditor, `Ruling:`) | approve, 0 blocker/major, 1 minor + 4 nit |
| G3 của request thử: người dùng trả lời "Duyệt" | merge `--no-ff` vào `feature/text-pad` (`3856582`), docs `merged` + xoá plan (`c3f3590`), `check-request` 0 cảnh báo, `npm test` exit 0 (47 pass) |
| Dọn (`cleanup: true`) | gỡ 3 worktree, xoá `feature/text-wrap` và 3 nhánh part (đều là tổ tiên của `feature/text-pad`); `Plan: complete` ở ledger root |

Số câu hỏi cho người dùng giữa G2 và G3 của request thử: 1 thẻ (hai mục) + câu duyệt G3.

### Phát hiện lượt 5b

- V4 (minor): trong lúc chờ trả lời thẻ, harness gửi thông báo nền (lệnh chờ xong, subagent xong) làm session gốc phải trả lời; hai lần session gốc viết một dòng "đang chờ", không lặp nội dung thẻ nhưng vẫn là nhắc nhẹ. Câu chữ "không nhắc lại" không ngăn được dòng này; không sửa.
- V5 (minor): worktree của part giữ bản `design.md` cũ sau khi root sửa AC (`7f8157d`); lời giải nằm trong `SendMessage` và ledger part nên part vẫn làm đúng. `task-loop.md` chưa nói root gửi kèm nội dung AC đã chốt. Không sửa.
- V6: `SendMessage` tiếp tục được subagent đã dừng (đúng với `partRunner: subagent`). [Unverified] Phiên part do người dùng mở riêng (`partRunner: session`) chưa thử.
