---
name: frontend-fix
description: "Sửa code frontend (React/TypeScript) theo một oracle đỏ (failing test, regression test bảo mật hoặc bottleneck đã xác nhận): fix tối thiểu trong phạm vi file khoanh trước, không đụng test. Dùng khi người dùng muốn \"sửa bug React theo failing test\", \"fix finding bảo mật frontend\", \"test React/vitest đang đỏ, sửa lỗi này\". Không dùng khi chưa có oracle đỏ → workflow-bugfix; dựng UI mới → frontend-implement; dọn component → frontend-refactor."
order: 9
title: "Frontend Fix — Sửa code React theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)"
runsIn: execute
invoke: per-request
argument-hint: "[failing test | finding | bottleneck] [danh sách file]"
---

# Frontend Fix — Sửa code React theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)

Recipe hướng dẫn agent **sửa mã nguồn FRONTEND có sẵn** (React/TypeScript) để **một oracle đỏ chuyển xanh**,
trong **phạm vi file đã được khoanh trước**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc,
KHÔNG phải công cụ tự sửa. Gọi độc lập hoặc từ bước sửa của `workflow-bugfix`, `workflow-security-review`,
`workflow-performance`.

**Oracle** là thứ cho biết fix đúng hay chưa, và phải có TRƯỚC khi sửa: một failing test (Testing Library /
Vitest / Jest) tái hiện bug, một regression test đỏ cho finding bảo mật, hoặc (chế độ `performance`) một giả
thuyết bottleneck đã có evidence profile (React Profiler, bundle analyzer, số đo render). Các loại oracle khác
liệt kê ở "Oracle chấp nhận" (mục Ba chế độ). Không có oracle → không sửa.

## Ranh giới với skill lân cận

| Skill | Đầu vào | Kết quả |
|---|---|---|
| `frontend-implement` | thiết kế (HTML/Figma/ảnh) | component **mới** presentational |
| `frontend-refactor` | component có sẵn, test xanh | hành vi **không đổi** |
| **`frontend-fix`** | code có sẵn + **oracle đỏ** + **danh sách file được sửa** | hành vi **đổi đúng một chỗ**, oracle xanh |

KHÔNG dùng skill này khi: cần dựng UI mới (→ `frontend-implement`); cần dọn component không đổi hành vi
(→ `frontend-refactor`); chưa có oracle (→ chạy `workflow-bugfix` từ đầu để tái hiện bằng failing test).

## Ba chế độ

| Chế độ | Oracle | Gate xanh |
|---|---|---|
| `bug` | failing test tái hiện bug (bugfix Bước 3) | test đó xanh |
| `security` | regression test đỏ (security-review Bước 7) + finding đã chọn | test đó xanh; không che triệu chứng |
| `performance` | giả thuyết bottleneck đã xác nhận + file/component (performance Bước 4); **không có test đỏ** | `tsc`/lint/test hiện có xanh. Skill **không tự tuyên bố nhanh hơn** — số đo trước/sau là việc của Bước 6 (Benchmark) của workflow |

**Oracle chấp nhận:** (a) test đỏ chạy được (mặc định bug/security); (b) khi quay lại từ bước review/re-scan:
finding đã validate (`file:line`) do người dùng xác nhận, gate xanh = review/re-scan lại; (c) chế độ
performance: giả thuyết có evidence profile; (d) bug chỉ tái hiện thủ công (bugfix Bước 3 không viết được
test): oracle = các bước tái hiện thủ công + kết quả kỳ vọng do người dùng xác nhận; gate xanh = chạy lại đúng
các bước đó, ghi kết quả; (e) finding bảo mật không có test (secret/dependency/misconfiguration —
security-review Bước 7 ghi "không áp dụng"): oracle = finding đã validate (`file:line`/CVE); gate xanh =
re-scan Bước 9 sạch.

## Ranh giới an toàn (CLAUDE.md)
- **Có oracle mới sửa.** Oracle là test (a): chạy xác nhận đang ĐỎ đúng lý do trước khi động code. Đỏ vì lý do
  khác (thiếu dependency, môi trường, msw chưa bật) hoặc không đỏ → DỪNG, báo, không sửa. Oracle loại (b)–(e):
  kiểm đủ thành phần theo "Oracle chấp nhận", thiếu → DỪNG.
- **Phạm vi khoanh trước.** Bước gọi (hoặc người dùng) đưa **danh sách file/component được sửa**. Chỉ sửa trong
  đó. Cần sửa ngoài danh sách → DỪNG, trả `blocked` kèm file đề nghị thêm; **không tự mở** phạm vi.
- **Không đụng test.** KHÔNG sửa/xoá/nới file test, fixture, snapshot, mock/msw handler. Test sai thật → báo,
  để `frontend-testing` (test-writer) xử lý ở lượt riêng.
- **Sửa nguyên nhân, không che triệu chứng.** Cấm: `any` mới, `!` non-null assertion mới, `// @ts-ignore` /
  `// @ts-expect-error` mới, `// eslint-disable` mới; `test.skip`/`it.skip`/`xit` mới; nới `waitFor` timeout;
  cập nhật snapshot cho khớp output sai (`-u`); `catch` nuốt lỗi; `key={index}` để tắt warning.
- **Một thay đổi mỗi lượt, revert bản sửa hỏng.** Mỗi lượt thử áp đúng một thay đổi gắn với một giả thuyết nguyên
  nhân (chi tiết ở Bước 2); bản sửa làm oracle còn đỏ hoặc làm build/test đỏ phải revert trước khi thử lại, không
  chồng thêm thay đổi lên trên.
- **Không đổi thứ ngoài code.** Không sửa `docs/contracts/`, không đổi design-system token. KHÔNG THÊM
  dependency mới. NÂNG version một dependency đã có (sửa manifest `package.json` + lockfile
  `package-lock.json`/`pnpm-lock.yaml`/`yarn.lock`) ĐƯỢC PHÉP khi các file đó nằm trong danh sách và
  finding là CVE của dependency đó. Cần khác → DỪNG và báo.
- **Tôn trọng boundary.** Sửa trong slice/feature của file được giao; không cross-import ruột feature khác.
- **Không push thẳng main.** Một fix = 1 commit; con người **duyệt diff** trước merge/push
  (protected branch: mỗi commit).
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng oracle đỏ → xanh với lệnh THẬT + exit code, `file:line` đã sửa. KHÔNG dùng
  "đảm bảo / loại bỏ / không còn lỗi". LUÔN nêu **residual risk**.

## Quy trình — cổng F1–F5

### 0. Nạp context
- Nhận **oracle** (một loại ở "Oracle chấp nhận"; test: lệnh chạy + kỳ vọng đỏ → xanh) và **danh sách file được
  sửa** từ bước gọi. Thiếu một trong hai → DỪNG, hỏi.
- Đọc `project-knowledge/architecture.md`, `code-convention.md`; dò lệnh THẬT từ `package.json` (`tsc --noEmit`,
  eslint, test runner, build). Đọc code THẬT trong danh sách file, không đoán.

### 1. Xác nhận oracle đỏ — CỔNG F1
- Mốc đầu bước: `git status --porcelain` + `git hash-object <file>` cho từng file test đang bẩn trong mốc (test
  oracle chưa commit). Mốc do session chính ghi trước khi dispatch; agent đọc lại mốc đó, không tự tạo mốc mới
  (gọi độc lập, không có mốc → tự ghi trước khi chạy oracle).
- Chạy oracle. Chế độ `bug`/`security`: phải ĐỎ đúng lý do. Chế độ `performance`: giả thuyết phải có evidence
  profile từ bước trước. Oracle (b)/(d)/(e): kiểm finding/bước tái hiện đã được người dùng xác nhận.

### 2. Sửa tối thiểu trong danh sách — CỔNG F2, F3, F4
- Sửa đúng nguyên nhân gốc (state/effect sai, điều kiện render, handler, race), ít thay đổi nhất làm oracle xanh.
  Không "nhân tiện" tách component hay đổi style (đó là `frontend-refactor`, lượt khác).
- **Một thay đổi mỗi lượt.** Trước khi sửa, ghi giả thuyết đang kiểm: "X là nguyên nhân vì Y" (`bug`), finding
  đã chọn (`security`) hoặc giả thuyết bottleneck có evidence profile (`performance`). Mỗi lượt thử áp đúng một
  thay đổi cho giả thuyết đó; chế độ `performance` là một thay đổi tối ưu mỗi lượt. Không chồng nhiều fix vào cùng
  lượt: oracle xanh cũng không biết thay đổi nào có tác dụng, đỏ cũng không biết thay đổi nào hỏng.
- **Revert bản sửa hỏng trước khi thử lại.** Bản sửa hỏng (oracle còn đỏ, regression đỏ, build/lint đỏ do chính
  nó) phải được gỡ trước lượt kế, nếu không lượt sau chồng lên một thay đổi đã biết là sai. Chỉ gỡ phần thay đổi
  của chính bản sửa đó, trong danh sách file: dùng `git diff <file>` để thấy đúng phần đó rồi hoàn lại; KHÔNG dùng
  `git reset --hard`, `git checkout .` hay `git stash` toàn cây; file test đã bẩn trong mốc (test oracle) giữ
  nguyên nội dung (`git hash-object` khớp mốc). Sau revert chạy lại oracle loại (a)/(d): phải đỏ đúng lý do như
  lúc đầu, rồi mới thử giả thuyết mới.
- **Đếm lần thử.** Số lần thử = số lần sửa thất bại bước gọi báo (nếu có) + các lượt của lượt giao này. Bộ đếm
  tổng do bước gọi giữ (`workflow-bugfix` Bước 6 đủ 3 lần thất bại thì hỏi người dùng về kiến trúc); chạm lần
  thất bại thứ 3 thì trả `blocked` kèm các giả thuyết đã loại, không tự thử lần 4.
- Cần chạm file ngoài danh sách → DỪNG, trả `blocked` + danh sách file đề nghị thêm.
- Tự soát danh sách "che triệu chứng" → gỡ.

### 3. Xanh trước khi trả — CỔNG F5
- Chạy oracle → XANH. Chạy `tsc --noEmit` + lint + test của feature đụng + build → XANH. Oracle (b)/(e): gate
  xanh là review/re-scan của workflow — agent không tự tuyên bố đã hết finding.
- So với mốc `git status --porcelain` đầu bước: file thay đổi/mới TRONG BƯỚC (`git diff --name-only`,
  `git ls-files --others --exclude-standard`, trừ đi những gì đã có trong mốc) ⊆ danh sách file; không có file
  test/fixture/snapshot/mock mới hay đổi; file test ĐÃ BẨN trong mốc (test oracle) phải giữ nguyên nội dung
  (`git hash-object <file>` trước/sau bằng nhau).
- Chưa xanh → revert bản sửa hỏng (Bước 2), thử một thay đổi cho giả thuyết khác trong danh sách; hết cách →
  `blocked`, nêu vì sao.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| F1 | Có oracle thuộc một loại ở "Oracle chấp nhận": test ĐỎ đúng lý do (a), finding/bước tái hiện đã xác nhận (b)(d)(e), giả thuyết có evidence (c) | 1 | DỪNG, không sửa |
| F2 | Chỉ sửa file trong danh sách được giao | 2 | `blocked` + file đề nghị thêm; không tự mở |
| F3 | Không sửa/xoá/nới file test, fixture, snapshot, mock | 2 | Gỡ thay đổi đó; test sai thật → báo test-writer |
| F4 | Không che triệu chứng (danh sách ở Ranh giới an toàn) | 2 | Gỡ, sửa lại nguyên nhân |
| F5 | Oracle xanh (bug/security) / build-test hiện có xanh (performance) + `tsc`/lint/build/test xanh; diff so mốc ⊆ danh sách, không đổi file test (kể cả oracle đã bẩn) | 3 | Revert bản sửa hỏng, thử một thay đổi khác trong danh sách; hết cách → `blocked` |

## Sau khi xong
Báo: oracle trước/sau (`command`, `exit_code`); file đã sửa (`file:line`) và xác nhận ⊆ danh sách; kết quả
`tsc`/lint/build THẬT; **residual risk** (giả định về nguyên nhân, chỗ cùng pattern chưa sửa vì ngoài phạm vi,
trạng thái UI chưa có test). Cần dọn component sau fix → route `frontend-refactor`; cần thêm test → route
`frontend-testing`.
Báo thêm: **số lần thử** và **giả thuyết đang kiểm** của từng lần (giả thuyết, thay đổi đã áp, kết quả oracle,
đã revert chưa); giả thuyết chưa được oracle xác nhận ghi vào residual risk.
