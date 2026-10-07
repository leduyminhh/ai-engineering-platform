# Use-case intake — chốt phạm vi slice trước khi sinh

Trước khi sinh bất kỳ code nào, luôn chốt một **phạm vi use-case** rõ ràng — mô tả trung gian, KHÔNG phải
code — rồi mới thiết kế slice. Nhờ đó ba nguồn đầu vào (mô tả người dùng, `requirement.md`, contract OpenAPI)
hội tụ về một đường sinh chung, và slice không phình ra ngoài một aggregate.

## "Phạm vi use-case" gồm gì

- **Aggregate root + invariant:** cụm nhất quán mà use-case chạm tới, root là cửa ngõ duy nhất, các quy tắc
  bất biến phải giữ (vd "tổng dòng = tổng hoá đơn", "không phát hành hoá đơn rỗng"). Tham chiếu aggregate khác
  **bằng ID** (VO id), không nhúng object — theo [ARD.md](../architecture/ARD.md) mục 2 (DDD
  tactical patterns).
- **Loại use-case — command hay query:**
  - **Command** — đổi trạng thái: dựng/sửa aggregate, gọi quy tắc nghiệp vụ, lưu qua repository, thường trả
    **id** (hoặc void). Đi qua aggregate.
  - **Query** — chỉ đọc: **KHÔNG qua aggregate**, trả **read model** (`*View`/DTO) trực tiếp. Với CQRS đây là
    nhánh Query riêng (xem [ARD.md](../architecture/ARD.md) mục 8 + template
    `<stack>-hexagonal-clean-cqrs`). Không có CQRS thì vẫn tách rõ ý định đọc/ghi trong use-case.
- **Driven port cần:** năng lực hạ tầng mà lõi gọi RA — **repository** (lưu/đọc aggregate), **gateway**
  (email, payment, service khác, event publisher). Khai bằng **ngôn ngữ domain**, không dùng thẳng client của
  hệ ngoài. Vị trí port theo kiểu kiến trúc (Onion vs Hexagonal) — xem [slice-workflow.md](slice-workflow.md).
- **Input/output DTO:** kiểu ở biên kênh vào (request) + kiểu trả ra (response/`*View`). Đây là **model của
  biên**, tách khỏi command và khỏi aggregate; map qua mapper ở bước sinh.

Ghi lại phạm vi ngắn gọn (bullet/bảng) trước khi sinh: `aggregate · invariant · command|query · driven port ·
input DTO · output DTO`.

## Nguồn A — Mô tả người dùng (tự do)

Ít cấu trúc nhất. Cách chốt:

- Rút **động từ nghiệp vụ** (phát hành, huỷ, gán, duyệt…) → gợi command; "xem/danh sách/tìm" → gợi query.
- Suy **aggregate** từ danh từ nghiệp vụ chính; đối chiếu `project-knowledge/data-model.md` để khớp aggregate
  đã mô hình hoá, KHÔNG tạo aggregate mới nếu đã có.
- Nêu rõ **giả định** về invariant/định danh khi mô tả thiếu; hỏi lại nếu quyết định rủi ro.

## Nguồn B — `docs/requests/<...>/requirement.md`

Có cấu trúc theo template request của `backend-init`. Cách chốt:

- Đọc phần mục tiêu + tiêu chí chấp nhận → biên use-case + invariant cần thoả.
- Khớp thực thể trong requirement với aggregate trong `data-model.md`; nếu requirement chạm nhiều aggregate →
  **chọn một aggregate cho slice này**, phần còn lại là slice khác (đồng bộ qua domain event nếu cần).

## Nguồn C — Contract `docs/contracts/openapi.json`

Chính xác nhất về shape biên (khi có). Cách chốt:

- Mỗi **operation** (path + method) là một điểm vào use-case: request body/params → **input DTO**; response
  schema → **output DTO** (map tới `*View`/`*Response` của template, KHÔNG chế tên khác).
- Method gợi loại: `POST`/`PUT`/`PATCH`/`DELETE` → command; `GET` → query (read model trực tiếp).
- **Contract là nguồn shape ở biên, KHÔNG phải cấu trúc domain** — đừng để schema DTO rò vào aggregate; map ở
  inbound adapter.

## Nguồn D — task `BE` trong `tasks.md`

Do skill `engineering-task-breakdown` sinh; đầu vào dạng "task `UC01-BE-01` trong `docs/requests/<...>/tasks.md`".
Cách chốt:

- Đọc **chỉ** mục chi tiết của task đó (anchor `<a id="uc01-be-01">`) + mục của các task trong cột Phụ thuộc; không
  làm phần việc của task khác.
- Map trường task → phạm vi use-case:

  | Trường task | Phạm vi use-case |
  |---|---|
  | B1 Endpoint | kênh vào (endpoint / trigger) + input/output DTO theo contract |
  | B2 Use case | command hay query |
  | B3 Aggregate + invariant | aggregate root + invariant |
  | B4 Validation, B5 Phân quyền, B7 Bảng lỗi | ràng buộc ở biên + mã lỗi |
  | B6 Dữ liệu chạm | driven port (repository/gateway); đổi schema → task `DB` phải xong trước |
  | B8 Transaction / idempotency | ranh giới transaction |
  | B10 Test bắt buộc | test lõi + integration của slice |

- AC + DoD của task là tiêu chí xong; "Lệnh verify" là lệnh build/test phải chạy ở bước verify.
- Mục còn `[giả định]` ảnh hưởng thiết kế (aggregate, endpoint, quyền) → hỏi lại, không tự chốt.
- Kết thúc: báo trạng thái đề xuất (`Done` hoặc lý do chặn) để session chính cập nhật cột Trạng thái; KHÔNG sửa
  `tasks.md`.

## Nguyên tắc "một use-case, một aggregate, tối giản"

- Một lần chạy skill = **một** use-case ghi/đọc **một** aggregate + **một** driven port + **một** adapter.
  Nhiều hơn → tách slice, gọi lại skill.
- Không nhét nhiều feature "cho tiện"; không dựng port/adapter chưa dùng tới trong slice này.
- Một transaction chỉ sửa **một** aggregate (ARD); liên aggregate → eventual consistency qua domain event,
  không nới transaction.

## Khi thiếu thông tin (fail-loud)

- Chưa rõ **aggregate/invariant/loại use-case** → **hỏi** hoặc **nêu giả định có nhãn** (vd "[giả định] coi
  `Order` là aggregate, `orderId` là định danh"), KHÔNG bịa im lặng.
- Chưa chạy `backend-init` (thiếu `project-knowledge/`) → đề nghị chạy init trước, hoặc chạy với giả định an
  toàn và ghi rõ để người duyệt sửa nhanh.

## Sau khi chốt

Chuyển sang [slice-workflow.md](slice-workflow.md) để sinh slice đúng tầng/naming/boundary của blueprint, rồi
[checklist.md](checklist.md) để verify.
