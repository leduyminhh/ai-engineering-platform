# Kiểm drift contract↔code — đối chiếu, báo lệch (read-only)

Drift = contract và code thật **không còn khớp**. Xảy ra khi code sửa mà quên cập nhật contract (design-first),
hoặc contract sửa mà code chưa theo. Bước này **đọc và báo lệch**, KHÔNG tự sửa (READ-ONLY mặc định); người
dùng đọc báo cáo rồi quyết định. Nguyên tắc mặc định: **contract là nguồn sự thật FE↔BE** → lệch thì đề xuất
sửa code cho khớp, trừ khi người dùng chốt code đúng thì cập nhật contract kèm version (theo [versioning.md](versioning.md)).

## Đầu vào đối chiếu

- **Contract:** `docs/contracts/openapi.json` (paths + components.schemas).
- **Code thật (đọc từ project theo stack):**
  - **Java/Spring:** controller (`@GetMapping`/`@PostMapping`…), interface `@HttpExchange`, DTO `*Request`/
    `*Response`/`*View` ở tầng `api-contract`; nếu có `springdoc` thì so với OpenAPI được sinh.
  - **Python/FastAPI:** route (`@app.get`/`@router.post`…), Pydantic schema; so với `/openapi.json` FastAPI tự
    sinh khi chạy được.
- Chỉ soát **đúng scope** người dùng nêu (một feature / nhóm path / toàn contract). Ngoài scope chỉ nhắc khi
  ảnh hưởng trực tiếp, và nêu rõ là ngoài scope.

## Các loại drift (phân loại khi báo)

| Loại | Mô tả | Ví dụ |
|------|-------|-------|
| **Endpoint lệch** | Path/method/status khai một bên, thiếu bên kia | Contract có `DELETE /orders/{id}` nhưng code không có; code có `GET /orders/{id}/history` nhưng contract thiếu |
| **Thiếu field** | Contract khai field mà DTO code không có | Response schema có `createdAt`, DTO code thiếu |
| **Thừa field** | Code trả field không khai trong contract | DTO có `internalNote` không có trong contract (rò field nội bộ ra biên) |
| **Kiểu sai** | Cùng field nhưng kiểu/format khác | Contract `amount: integer`, code `BigDecimal`/`string` |
| **Required lệch** | `required` trong contract vs bắt buộc thực tế trong code | Contract nói `email` optional, code validate bắt buộc |
| **Enum lệch** | Miền giá trị enum khác nhau | Code có thêm trạng thái `ARCHIVED` chưa khai trong contract |
| **Status/lỗi lệch** | Mã trả về hoặc cấu trúc lỗi khác contract | Contract khai `201`, code trả `200` |

## Cách soát

1. Lập **bảng endpoint**: mỗi operation trong contract → tìm handler tương ứng trong code (và ngược lại, quét
   handler không có trong contract). Đánh dấu khớp / lệch / thiếu một bên.
2. Với mỗi operation khớp path: đối chiếu **request** (params/body field: tên, kiểu, required, enum) và
   **response** (status → field: tên, kiểu, required, enum).
3. Ghi mỗi điểm drift kèm **vị trí cụ thể**: `path` + method + field phía contract; `file:line` phía code khi
   đọc được. KHÔNG gộp mơ hồ "nhiều field lệch" — liệt kê từng field.

## Báo cáo (đo được)

- Đếm: số endpoint soát, số điểm drift theo từng loại ở bảng trên.
- Mỗi điểm: loại drift · vị trí contract · vị trí code · đề xuất (sửa code theo contract, hoặc cập nhật contract
  + bump version nếu người dùng chốt code đúng — breaking thì nêu rõ theo [versioning.md](versioning.md)).
- **KHÔNG dùng** "khớp hoàn toàn / hết drift". Nêu **phần chưa soát + residual risk**: đối chiếu tĩnh có thể sót
  hành vi runtime (validation động, field serialize tuỳ điều kiện, mã lỗi phát sinh trong luồng) không lộ trong
  khai báo. Ghi `[giả định]` khi suy diễn kiểu/required từ code mà không chắc.

## Sau khi báo

- Người dùng quyết bên nào là chuẩn. Nếu yêu cầu sửa: sửa **một phía** theo quyết định đó (1 việc = 1 commit);
  con người duyệt diff trước merge/push (protected branch: mỗi commit). Sửa contract theo hướng breaking → bắt
  buộc bump version + note.
- Sinh lại code slice bám contract mới → route sang `backend-implement`.
