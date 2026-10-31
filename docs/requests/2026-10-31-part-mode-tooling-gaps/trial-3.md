# Lượt thử 3 — chế độ part với core 1.22.7

- Ngày: 2026-10-31
- Core: 1.22.7 (`aa946bc` trên `feature/part-mode-tooling-gaps`), cài plugin scope user; `aip check -g` không báo lệch.
- Repo thử: `E:\Mine\AI\aip-parts-trial`, nhánh `feature/text-case` cắt từ `feature/text-format` `d9fcb17`, không remote.
- Request: `docs/requests/2026-10-31-text-case/` — 3 part, mỗi part 1 task `TOOLING` `**TDD:** có`:
  - `01-split-words` ∥ `02-reverse` (nhóm Song song A);
  - `03-camel-case` phụ thuộc `01-split-words`, Consumes `splitWords` từ `src/split-words.js`.
- `check-request`: chỉ W9 trước khi chạy, 0 cảnh báo sau cùng; `check-partition`: 0 cảnh báo.

## Diễn biến và hash

| Bước | Ai chạy | Commit | Kiểm chứng |
|---|---|---|---|
| Request + plan | session gốc | `f6ea06d` | check-request W9, check-partition 0 |
| Part 01, 02 `đang làm` + 2 worktree | session gốc | `99d88f1` | — |
| Part 01: test đỏ / code | session gốc trong worktree p01 (phiên part không mở được, xem V5) | `a98c88a` / `3604f65` | `npm test` exit 1 / exit 0 (22 pass) |
| Part 02: test đỏ / code | phiên part thật (sonnet) trong worktree p02 | `9b8c499` / `442b8a0` | `npm test` exit 1 / exit 0 |
| Merge part 01 | session gốc | `daf2c8f`, Bảng part `b95541c` | `npm test` exit 0 (22 pass) |
| Part 03 tuần tự: test đỏ / code | session gốc trên `feature/text-case` | `7366dbf` / `b7dd8d2` | `npm test` exit 1 (stub) / exit 0 (24 pass) |
| Merge part 02 | session gốc | `6535b04`, Bảng part `adcbf40` | `npm test` exit 0 (25 pass) |
| Part 03 merged + Bảng part | session gốc | `a4a0f43` | `npm test` exit 0 (25 pass) |
| Kết thúc nhánh (giữ nguyên) | session gốc | `9d0f3e4` | check-request 0, `npm test` exit 0 (25 pass) |

Review từng task: `general-purpose` haiku, cả 3 `spec_verdict: compliant`, không blocker/major. Review cuối
(`d9fcb17..a4a0f43`): `general-purpose` opus + `engineering-quality-auditor`, không blocker/major nên không có vòng sửa.

## Ledger

`E:\Mine\AI\aip-parts-trial\.aip\runs\2026-10-31-text-case\`:

- `root/`: `Part 01: merged daf2c8f…`, `Part 02: merged 6535b04…`, `Part 03: merged b7dd8d2…`, `Plan: complete`.
- `01-split-words/`: 1 `minor (deferred)`,
  `Task 1: complete (commits 99d88f1..3604f65, review clean, red: npm test exit 1, tests: npm test exit 0)`, `Part: complete 3604f65…`.
- `02-reverse/`: 1 `minor (deferred)`, `Task 1: complete (commits 99d88f1..442b8a0, review clean, red: npm test exit 1, tests: npm test exit 0)`, `Part: complete 442b8a0…`.
- `03-camel-case/`: 1 `Ruling:` (camelCase viết hoa theo code unit), 2 `minor (deferred)`,
  `Task 1: complete (commits b95541c..b7dd8d2, review clean, red: npm test exit 1, tests: npm test exit 0)`, `Part: complete b7dd8d2…`.

## Đối chiếu AC

| AC | Kết quả | Evidence |
|---|---|---|
| AC1.1 | đạt | Phiên part thật p02 mở trong worktree `text-case-p02`, ledger part chưa có. Lúc đó có 2 ledger `root/` dở: của chính request (chỉ header) và `2026-10-31-other-req` (tạo cho lượt thử, đã xoá sau). Hook `session-start` chỉ nạp khối bootstrap, không có khối `Ledger (…)` hay handoff. Chạy thử hook với cwd p01 cho cùng kết quả. |
| AC2.1 | đạt | Cả 3 part ghi dòng `complete` đúng mẫu bước 9 (`review clean`, `red:`, `tests:`), các `minor (deferred)` đứng trước; không phải tự chế. |
| AC2.2 | đạt | `task-1-report.md` dạng `agent_result` (`tdd.red`/`tdd.green`) ở 3 part, reviewer `general-purpose` không nạp skill domain. Khoảng hở ở V7. |
| AC2.3 | đạt (câu chữ); kiểm chứng còn hở | 3 cặp commit đỏ riêng → code. Reviewer task chỉ kiểm được thứ tự qua danh sách commit, không thấy file của từng commit (p02 `declined_to_judge`). Review cuối và auditor tự kiểm bằng `git archive` + `node --test`: 3 commit đỏ exit 1, mỗi commit chỉ 1 file test. Xem V6, V7. |
| AC2.4 | đạt | Trong repo thử, `ledger.mjs` nhận dòng `Task 1: complete (…, review clean, tests: npm test exit 0)` thiếu `red:` thì trả exit 2, ledger không đổi. |
| AC2.5 | không chạy ở lượt thử | Không có task `BE` hay TDD `không`; đã phủ bằng test của Task 1 (`test/content/32-superpowers-gap.pin.mjs`). |
| AC3.1 | đạt | Diff toàn nhánh là Node thuần; review cuối gọi `general-purpose` `model: opus` theo `final-review.md`. |
| AC4.1 | không phát sinh | Review cuối không có `questions[]` nên không có AC mới; chỉ đọc lại `final-review.md`, thấy đoạn thêm `### Task` sửa. |
| AC5.1 | đạt | Khối bàn giao (`trial3-handoff-p0{1,2}.md`) có dòng nhắc trust. Thực tế: mở phiên p01 thì app hỏi trust, người dùng từ chối nên phiên không chạy. |
| AC6.1 | đạt, kèm điều kiện | Cả 3 part `merged <hash>`, review cuối chạy xong, không phải tự chế mẫu dòng `complete` hay báo cáo TOOLING. Điều kiện: part 01 chạy trong session gốc (V5), không phải phiên riêng. |

## Chỗ vướng

1. **V1 — `aip install` gỡ install plugin-mode.** Lệnh `aip install -g --provider claude --plugin core --yes` (thiếu
   `--as-plugin`, đúng như handoff gợi ý) thay entry plugin-mode trong `~/.ai-engineering/manifest.json` bằng entry
   skills-mode và gỡ cả 7 plugin aip khỏi `claude plugin list`, không cảnh báo. Khôi phục bằng
   `aip uninstall -g --provider claude --plugin core --yes`, rồi
   `aip install -g --provider claude --plugin all --as-plugin --yes`. Lỗi của CLI, ngoài phạm vi request này.
2. **V2 — cột Phụ thuộc.** Phải ghi tên part đầy đủ (`01-split-words`); ghi `01` thì `check-request` báo W19.
   Handoff/plan của request này viết `01`.
3. **V3 — `check-request` trên thư mục part** báo W1 (part không có design). Chỉ chạy trên thư mục request là đúng
   cách, nhưng không chỗ nào nói vậy.
4. **V4 — mở phiên part từ session gốc.** `start_session` bị app từ chối khi lượt do session khác khởi động;
   `own_initiative` không nhận `cwd`. Phải chờ người dùng tự nói "mở 2 phiên part".
5. **V5 — trust thư mục worktree.** Hai phiên mở cùng lúc: người dùng từ chối trust p01, p02 chạy. Part 01 chạy
   trong session gốc, trong worktree p01.
6. **V6 — đỏ đúng lý do.** Cả 3 part có `minor (deferred)` cùng gốc: commit đỏ chỉ chứa file test (bước 6), nên với
   hàm mới thì đỏ do `ERR_MODULE_NOT_FOUND`, không phải do assertion. Muốn đỏ bằng assertion thì cần stub trong `src/`,
   nhưng bước 6 chỉ cho stage file test (part 03 dùng stub không commit). Giao thức không nói stub hay lỗi import có
   được tính là red hợp lệ. Review cuối gom thành một mảng (F2) và đề xuất follow-up.
7. **V7 — review package không tách theo commit.** `review-package.mjs` in danh sách subject commit + một diff gộp;
   `task-review.md` bước 1 cấm reviewer chạy git. Reviewer không kiểm được commit đỏ chỉ chứa test (AC2.3); p02 phải
   tự `git show --stat`.
8. **V8 — Bảng part của part tuần tự.** Đặt `03-camel-case` thành `đang làm` được gộp vào commit `merged` của part 01
   (`b95541c`); giao thức không cấm, nhưng bước 5 hiểu là một commit riêng trước task đầu.
9. **V9 — dọn worktree p02** phải chờ archive phiên p02 (task-loop "Chế độ part" bước 10); worktree p01 đã dọn
   bằng `git worktree remove`. Thư mục `text-utils-p01`, `text-utils-p02` của lượt thử 1 vẫn nằm trong `.claude/worktrees/`.
10. Không thuộc aip: harness nhắc thêm `Co-Authored-By`, AGENTS.md cấm (theo AGENTS.md); repo thử thiếu
    `.gitattributes` (cảnh báo LF → CRLF).

## Finding review cuối còn mở (repo thử)

- minor: `test/split-words.test.js:6` chưa có ca `-`/`_` ở đầu/cuối chuỗi; `camelCase` dựa vào việc `splitWords` không
  trả chuỗi rỗng.
- minor (Ruling, chấp nhận): `camelCase` viết hoa theo code unit, nên chữ astral có case ở đầu từ không được viết hoa.
- minor (gom từ 3 part): xem V6.
- nit (auditor): input không phải string ném `TypeError` (giống các hàm có sẵn); `reverse` làm hỏng văn bản NFD/ZWJ,
  thuộc anti-goal của design.
