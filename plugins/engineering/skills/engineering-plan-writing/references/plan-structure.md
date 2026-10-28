# Cấu trúc plan.md

Khung chép từ `plan.template.md` của skill `artifact-templates`. File này nói **cách điền**, không lặp lại khung.

## Bản đồ file

Trước khi chia task, liệt kê mọi file sẽ tạo hoặc sửa, mỗi file **một trách nhiệm**, bám pattern và layout đang có của
repo (đọc file cùng loại trước khi quyết định tên và chỗ đặt). Ghi bảng `File | Trách nhiệm | Task`. Mục đích: chốt sớm
quyết định phân rã; file nào có hai trách nhiệm thì tách ngay ở đây, không để tới lúc code. Không cần script kiểm.

## Độ mịn task

- Một task là đơn vị nhỏ nhất **có chu trình test riêng** và **đáng một lần review**. Setup hoặc docs cần cho task nào
  thì gộp vào task đó, không tách thành task rỗng.
- Task quá lớn để review một lần → tách; task chỉ là một dòng sửa không có test riêng → gộp vào task gần nhất.

## Độ mịn step

- Một step là **một hành động có kết quả kiểm được**: viết test đỏ → chạy, thấy đỏ → viết code → chạy, thấy xanh →
  commit. Mỗi step ghi lệnh chạy và kết quả mong đợi.
- Chỉ ghi chữ ký hàm, tên test và điều test assert. **Không chép thân hàm** vào plan; plan dài ra như chương trình
  chép sẵn là dấu hiệu sai (xem mục 5 của `self-review.md`).

## Kind và chuỗi agent

`**Kind:**` thuộc tập đóng `BE`, `FE-UI`, `FE-INT`, `E2E`, `DB`, `CT`, `DOCS`, `TOOLING`, khớp lát dọc
`CT→DB→BE→FE-UI→FE-INT→E2E` của `engineering-task-breakdown`. `check-request.mjs` cảnh báo W17 khi task thiếu kind,
W18 khi kind ngoài tập. Kind quyết định chuỗi agent:

| Kind | Chuỗi agent |
|---|---|
| `BE` | `backend-implementer` (TDD) → `backend-reviewer` |
| `FE-UI` | `frontend-implementer` → `frontend-test-writer` → `frontend-reviewer` |
| `FE-INT` | `frontend-data-integrator` → `frontend-reviewer` |
| `E2E` | `frontend-e2e-test-writer` → `frontend-reviewer` |
| `DB` | `data-migration-writer` → `backend-reviewer` |
| `CT` | `backend-implementer` (skill `backend-api-contract`) → `backend-reviewer` |
| `DOCS` / `TOOLING` | session chính tự làm, review bằng `general-purpose` |

Task trộn hai phía (vd BE + FE-UI) → tách thành hai task, mỗi task một kind.

Trong `workflow-feature` không tạo task kind `CT` hay `DB`: contract đã chốt ở Bước 3, đổi schema đã dừng ở Bước 2 để chạy
`data-db-migration`. Plan trỏ ID `tasks.md` thì task `CT`/`DB` của `tasks.md` đã `Done` ở Bước 3 hoặc ngoài workflow nên
không đưa vào plan.

## Interfaces

Implementer chỉ thấy task của mình, nên mỗi task ghi `**Interfaces:**` với **chữ ký chính xác**:

- `Consumes:` hàm/kiểu/endpoint (`operationId`) do task trước tạo mà task này dùng; không có thì ghi "không có".
- `Produces:` hàm/kiểu/endpoint task sau sẽ dùng; không có thì ghi "không có".

Tên và kiểu ở `Produces` của task A phải **trùng từng ký tự** với `Consumes` của task B (kiểm ở mục 3 của
`self-review.md`).

## Global Constraints

Ràng buộc mọi task ngầm kế thừa: giá trị **nguyên văn** từ design (số, tên khoá, ngưỡng, tập đóng, quy ước ngôn ngữ,
quy tắc commit). Chép nguyên văn để implementer không phải đoán; đổi giá trị thì đổi ở một chỗ này.

## Review Focus

Liệt kê tối đa 5 input hoặc failure mode mà design ngụ ý nhưng test của task có thể chưa phủ (vd chuỗi rỗng,
trùng lặp, quyền truy cập, giá trị biên). Mỗi dòng nêu **test nào ở task nào** sẽ phủ nó; dòng không có test chủ → thêm
test vào task phù hợp hoặc bỏ dòng.

## Có tasks.md

Task trong `plan.md` trỏ ID task của `tasks.md` (vd `Task 3` ghi `Nguồn: UC01-BE-02`) thay vì tự chia lại; hai file dùng một
checkpoint duyệt. Không có `tasks.md` thì plan tự chia, không bắt buộc tạo thêm.
