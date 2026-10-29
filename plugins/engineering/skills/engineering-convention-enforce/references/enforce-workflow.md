# Quy trình báo cáo & enforce — bảng lệch, severity, read-only mặc định

Mục tiêu: biến các điểm lệch (từ [naming-rules.md](naming-rules.md) + [structure-rules.md](structure-rules.md))
thành **báo cáo có evidence** để con người quyết, và — chỉ khi được yêu cầu — **áp sửa an toàn** trong đúng
scope. Mặc định **read-only**.

## Bảng lệch (định dạng báo cáo)

Mỗi dòng một điểm lệch, đủ 5 cột:

| Path / `file:line` | Rule nguồn | Hiện tại | Đề xuất | Severity |
|---|---|---|---|---|

- **Path / `file:line`** — evidence cụ thể; vi phạm import phải có số dòng.
- **Rule nguồn** — trích ngắn quy tắc trong `code-convention.md`/`source-structure.md` đã bị vi phạm (để truy vết),
  kèm nhãn **độ mạnh** `[MUST]` / `[SHOULD]` / `[?]` theo đúng từ ngữ của nguồn (xem mục "Độ mạnh của rule nguồn").
- **Hiện tại → Đề xuất** — trạng thái hiện tại và cách sửa cụ thể (đổi tên tới đâu / di chuyển tới đâu).
- **Severity** — theo thang dưới.

Tách rõ **findings đã xác thực** (có rule nguồn) khỏi **[giả định]** (mục convention không quy định rõ — cần hỏi).

## Độ mạnh của rule nguồn

Nhãn lấy từ **từ ngữ của nguồn chuẩn**, không từ cảm nhận của agent:

- **`[MUST]`** — nguồn viết "bắt buộc", "phải", "không được", "cấm", hoặc rule do lint/CI đang chặn.
- **`[SHOULD]`** — nguồn viết "nên", "khuyến nghị", "ưu tiên", hoặc chỉ nêu ví dụ.
- **`[?]`** — nguồn không nói rõ độ mạnh → xử lý như **[giả định]**, hỏi người dùng.

Quy tắc suy ra severity: **chỉ `[MUST]` mới được `fail`**; `[SHOULD]` tối đa **warning**; `[?]` là **info**.
Không nâng một rule "nên" thành `fail` vì thấy nó quan trọng — nếu muốn bắt buộc, đó là đổi convention → `engineering-adr`.

## Thang severity

- **fail** — vi phạm rõ một quy tắc `[MUST]` trong `code-convention.md`/kiến trúc: sai tầng vi phạm Dependency
  Rule, `name` metadata lệch tên thư mục, sai case/hậu tố bắt buộc. Cần sửa trước khi merge.
- **warning** — lệch nhẹ hoặc drift đáng lưu ý: tên mơ hồ, từ vựng không nhất quán, test chưa map, file lạc vị trí
  không phá tầng. Nên hiểu rõ trước khi publish.
- **info / [giả định]** — mục convention không quy định rõ, hoặc phần chưa quét được; **hỏi** thay vì phán lệch.

Báo cáo xếp **fail trước warning trước info**, kèm phần **residual risk** (phần chưa quét, mục mơ hồ, giả định).

## Read-only mặc định & sửa hàng loạt

- **Mặc định chỉ báo, KHÔNG sửa.** Trả bảng lệch + severity + đề xuất; dừng ở đó nếu người dùng chưa yêu cầu sửa.
- **Sửa chỉ khi người dùng yêu cầu rõ.** Khi được yêu cầu:
  1. Sửa **trong đúng scope** đã chốt; không lan sang file/thư mục ngoài scope.
  2. Gom sửa **theo nhóm** (đổi tên / di chuyển / đảo import) để diff dễ đọc; 1 nhóm = 1 bước duyệt.
  3. **KHÔNG đổi hành vi nghiệp vụ** — enforce chỉ chỉnh tên/vị trí/quy ước, không sửa logic.
  4. Đổi tên/di chuyển phải **cập nhật mọi tham chiếu** (import, path, manifest/test-map) — nếu không chắc quét hết,
     nêu **residual risk** thay vì tuyên bố sạch.
  5. **Con người duyệt diff** trước merge/push (protected branch: mỗi commit); không tự commit/push
     (commit: nguyên tắc riêng plugin engineering; push: mục Safety của `AGENTS.md`).
- **KHÔNG đổi convention để hợp thức hoá code.** Nếu code lệch vì *convention nên đổi*, đó là quyết định kiến trúc
  → dừng, trỏ `engineering-adr` để ghi quyết định + cập nhật `code-convention.md`, rồi enforce lại theo chuẩn mới.

## Khi KHÔNG hành động

Dừng và hỏi (hoặc chỉ ghi vào residual risk) thay vì báo lệch/sửa trong các trường hợp:

- **Code sinh tự động hoặc vendored** (`generated/`, `vendor/`, `node_modules/`, file có header "DO NOT EDIT",
  thư mục nằm trong ignore của lint): không báo, không sửa.
- **Ngoại lệ đã được ghi** trong `code-convention.md`, ADR, hoặc chú thích tại chỗ (vd. tên legacy giữ vì tương
  thích API): không báo lệch; nếu ngoại lệ không có lý do → `[giả định]`, hỏi.
- **Scope chưa chốt** hoặc người dùng chỉ hỏi về một file: chỉ kiểm file đó, không quét lan.
- **Lint/formatter đã tự động hoá rule đó**: trỏ người dùng chạy tool, không đối chiếu tay từng dòng.
- **Số điểm lệch rất lớn** (vd. > 50 cùng một rule): báo **số lượng + vài mẫu + cách tìm tất cả**, đề nghị chốt
  lộ trình (dần dần/codemod) thay vì mở một diff khổng lồ; việc đổi hàng loạt cần người duyệt từng nhóm.
- **Đổi tên làm vỡ API công khai** (public API, tên cấu hình, tên bảng/cột, route): không đổi trong enforce; nêu
  rủi ro tương thích và trỏ quyết định cho người dùng/`engineering-adr`.

## Checklist (Definition of Done cho enforce)

- [ ] Đã đọc `code-convention.md` (+ source-structure/architecture/lint config nếu có) làm nguồn chuẩn; thiếu →
      fail-loud, không tự bịa.
- [ ] Đã **chốt scope**; chỉ kiểm/sửa trong scope.
- [ ] Mỗi điểm lệch có **evidence** (`file:line`/path) + **rule nguồn** trích dẫn được.
- [ ] Mỗi dòng có nhãn **độ mạnh** (`[MUST]`/`[SHOULD]`/`[?]`); chỉ `[MUST]` mới `fail`.
- [ ] Đã loại code sinh tự động/vendored và ngoại lệ có ghi trước khi báo lệch (mục "Khi KHÔNG hành động").
- [ ] Bảng lệch đủ 5 cột + **severity**; fail xếp trước; **[giả định]** tách riêng và đã **hỏi**.
- [ ] Mặc định **read-only**; nếu có sửa: đúng scope, gom nhóm, **con người duyệt diff**, không đổi hành vi nghiệp vụ,
      đã cập nhật tham chiếu.
- [ ] KHÔNG đổi convention (đổi là ADR → `engineering-adr`); tái cấu trúc lớn trỏ `backend-migrate-architecture`.
- [ ] Ngôn ngữ **đo được** (không "đảm bảo/loại bỏ/chặn triệt để"); nêu **residual risk**.
