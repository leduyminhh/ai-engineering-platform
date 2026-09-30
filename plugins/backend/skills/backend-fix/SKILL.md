---
name: backend-fix
description: "Recipe on-demand: SỬA code BACKEND có sẵn (Java/Spring, Python) theo MỘT oracle đỏ — failing test tái hiện bug, regression test của finding bảo mật, hoặc giả thuyết bottleneck đã xác nhận — với phạm vi file được khoanh TRƯỚC. Áp fix tối thiểu cho oracle chuyển xanh; KHÔNG đụng file test/fixture/snapshot; KHÔNG sửa ngoài danh sách file (cần mở rộng → dừng, trả blocked); KHÔNG che triệu chứng (nuốt exception, skip test, nới timeout, hạ log). Ba chế độ: bug / security / performance. KHÁC với sinh code mới (đó là backend-implement) và KHÁC với dọn code giữ hành vi (đó là backend-refactor); chưa có oracle → chạy workflow-bugfix từ đầu để tái hiện. Dùng skill NÀY khi người dùng muốn \"sửa bug theo failing test\", \"fix finding bảo mật\", \"sửa theo root cause\", \"áp fix tối thiểu\", \"tối ưu theo bottleneck đã xác nhận\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 9
stageNumber: "09"
title: "Backend Fix — Sửa code backend theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Backend Fix — Sửa code backend theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)

Recipe hướng dẫn agent **sửa mã nguồn BACKEND có sẵn** (Java/Spring, Python) để **một oracle đỏ chuyển
xanh**, trong **phạm vi file đã được khoanh trước**. Đây là **docs-only recipe** — hướng dẫn cách agent làm
việc, KHÔNG phải công cụ tự sửa. Gọi độc lập hoặc từ bước sửa của `workflow-bugfix`,
`workflow-security-review`, `workflow-performance`.

**Oracle** là thứ cho biết fix đúng hay chưa, và phải có TRƯỚC khi sửa: một failing test tái hiện bug, một
regression test đỏ cho finding bảo mật, hoặc (chế độ `performance`) một giả thuyết bottleneck đã có evidence
profile. Không có oracle → không sửa.

## Ranh giới với skill lân cận

| Skill | Đầu vào | Kết quả |
|---|---|---|
| `backend-implement` | use-case / contract mới | code **mới** (vertical slice) |
| `backend-refactor` | code có sẵn, test xanh | hành vi **không đổi** |
| **`backend-fix`** | code có sẵn + **oracle đỏ** + **danh sách file được sửa** | hành vi **đổi đúng một chỗ**, oracle xanh |

KHÔNG dùng skill này khi: cần viết feature mới (→ `backend-implement`); cần dọn code không đổi hành vi
(→ `backend-refactor`); chưa có oracle (→ chạy `workflow-bugfix` từ đầu để tái hiện bằng failing test).

## Ba chế độ

| Chế độ | Oracle | Gate xanh |
|---|---|---|
| `bug` | failing test tái hiện bug (bugfix Bước 3) | test đó xanh |
| `security` | regression test đỏ (security-review Bước 7) + finding đã chọn | test đó xanh; không che triệu chứng |
| `performance` | giả thuyết bottleneck đã xác nhận + file/hàm (performance Bước 3); **không có test đỏ** | build/test hiện có xanh. Skill **không tự tuyên bố nhanh hơn** — số đo trước/sau là việc của Bước 5 (Benchmark) của workflow |

## Ranh giới an toàn (CLAUDE.md)
- **Có oracle mới sửa.** Chạy oracle xác nhận đang ĐỎ đúng lý do trước khi động code. Đỏ vì lý do khác
  (thiếu dependency, môi trường) hoặc không đỏ → DỪNG, báo, không sửa.
- **Phạm vi khoanh trước.** Bước gọi (hoặc người dùng) đưa **danh sách file/module được sửa**. Chỉ sửa trong
  đó. Cần sửa ngoài danh sách → DỪNG, trả `blocked` kèm file đề nghị thêm; **không tự mở** phạm vi.
- **Không đụng test.** KHÔNG sửa/xoá/nới file test, fixture, snapshot, mock. Test sai thật → báo, để
  `backend-testing` (test-writer) xử lý ở lượt riêng.
- **Sửa nguyên nhân, không che triệu chứng.** Cấm: `try/catch` nuốt exception hoặc `except: pass`;
  `@Disabled`/`@Ignore`/`pytest.skip`/`xfail` mới; nới timeout/retry để qua; hạ mức log hoặc bỏ log thay vì sửa
  lỗ hổng; `@SuppressWarnings` mới; đổi assert trong test.
- **Không đổi thứ ngoài code.** Không sửa `docs/contracts/`, không thêm/sửa migration, không thêm dependency —
  cần thì DỪNG và báo (đó là việc của skill khác: `backend-api-contract`, `data-db-migration`).
- **Không push thẳng main.** Một fix = 1 commit; DỪNG cho người **duyệt diff** trước commit.
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng oracle đỏ → xanh với lệnh THẬT + exit code, `file:line` đã sửa. KHÔNG dùng
  "đảm bảo / loại bỏ / không còn lỗi". LUÔN nêu **residual risk** (chỗ cùng pattern chưa sửa vì ngoài phạm vi).

## Quy trình — cổng F1–F5

### 0. Nạp context
- Nhận **oracle** (lệnh chạy + kỳ vọng đỏ → xanh) và **danh sách file được sửa** từ bước gọi. Thiếu một trong
  hai → DỪNG, hỏi.
- Đọc `project-knowledge/architecture.md`, `code-convention.md`; dò lệnh build/test/lint THẬT từ
  `pom.xml`/`build.gradle`/`pyproject.toml`. Đọc code THẬT trong danh sách file, không đoán.

### 1. Xác nhận oracle đỏ — CỔNG F1
- Chạy oracle. Chế độ `bug`/`security`: phải ĐỎ đúng lý do (message/assert khớp bug hoặc finding). Chế độ
  `performance`: giả thuyết phải có evidence profile (`file:line` hoặc số đo) từ bước trước.
- Ghi trạng thái đầu bước: `git status --porcelain` (để bước gọi so diff sau).

### 2. Sửa tối thiểu trong danh sách — CỔNG F2, F3, F4
- Sửa đúng nguyên nhân gốc, ít thay đổi nhất làm oracle xanh. Không "nhân tiện" dọn code (đó là
  `backend-refactor`, lượt khác).
- Cần chạm file ngoài danh sách → DỪNG, trả `blocked` + danh sách file đề nghị thêm.
- Tự soát: có dòng nào thuộc danh sách "che triệu chứng" ở Ranh giới an toàn không → gỡ.

### 3. Xanh trước khi trả — CỔNG F5
- Chạy oracle → phải XANH. Chạy build + lint + test của module đụng → XANH.
- `git diff --name-only` + `git ls-files --others --exclude-standard` ⊆ danh sách file; không có file test.
- Chưa xanh → sửa tiếp trong danh sách; hết cách → `blocked`, nêu vì sao.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| F1 | Có oracle; oracle đang ĐỎ đúng lý do (bug/security) hoặc giả thuyết có evidence (performance) | 1 | DỪNG, không sửa |
| F2 | Chỉ sửa file trong danh sách được giao | 2 | `blocked` + file đề nghị thêm; không tự mở |
| F3 | Không sửa/xoá/nới file test, fixture, snapshot, mock | 2 | Gỡ thay đổi đó; test sai thật → báo test-writer |
| F4 | Không che triệu chứng (danh sách ở Ranh giới an toàn) | 2 | Gỡ, sửa lại nguyên nhân |
| F5 | Oracle xanh + build/lint xanh; diff ⊆ danh sách, không chứa file test | 3 | Sửa tiếp trong danh sách; hết cách → `blocked` |

## Sau khi xong
Báo: oracle trước/sau (`command`, `exit_code`); file đã sửa (`file:line`) và xác nhận ⊆ danh sách; kết quả
build/lint THẬT; **residual risk** (giả định về nguyên nhân, chỗ cùng pattern chưa sửa vì ngoài phạm vi, phần
chỉ kiểm bằng đọc). Cần dọn code sau fix → route `backend-refactor`; cần thêm test → route `backend-testing`.
