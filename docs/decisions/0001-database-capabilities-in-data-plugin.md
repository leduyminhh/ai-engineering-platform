# ADR-0001: Năng lực liên quan database thuộc plugin data
- Trạng thái: Accepted
- Ngày: 2026-09-30

Nguồn quyết định: chủ dự án chốt trong phiên làm việc ("dữ liệu liên quan database → move về plugin data").

Liên kết:
- Spec: [`2026-09-29-skill-plugin-workflow-upgrade-design.md`](../superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §7.1, §7.1.3, §11 Q5.
- Plan: [`2026-09-30-db-migration-to-data-plugin.md`](../superpowers/plans/2026-09-30-db-migration-to-data-plugin.md).

## Bối cảnh

Repo có hai skill cùng viết migration schema theo expand/contract, đặt ở hai plugin khác nhau (trước quyết định này):

- `backend-db-migration` (plugin `backend`, draft): áp Flyway/Liquibase và viết thay đổi schema trong repo của một app backend.
- `data-oltp-implement` (plugin `data`, draft): hiện thực schema vật lý cho một database project OLTP dùng chung, giữ schema contract đã công bố cho consumer; mỗi migration `up` phải có `down`.

Quy tắc phân ranh giữa hai skill nằm ở Bước 0 của skill migration (spec §7.1.3): có `data-oltp-init` hoặc schema là contract cho nhiều consumer thì DỪNG và chuyển sang `data-oltp-implement`. Spec Q5 ghi rõ quy tắc này là suy luận, chưa phải ADR chính thức.

Lực đẩy:
- Một chủ sở hữu cho mọi việc về schema; tránh hai bộ hướng dẫn migration trùng lặp hoặc mâu thuẫn.
- Nếu hai skill ở hai plugin thì redirect ở Bước 0 là liên kết chéo plugin. [Inference] Skill được publish trước sẽ trỏ sang skill của plugin còn draft; suy ra từ `plugins/_published.json` (không có mục `data`) và từ redirect chéo plugin, chưa thử cài đặt để kiểm.
- Quy tắc đặt tên: tên skill phải bắt đầu bằng `<id plugin>-` (`test/validate.mjs:216`), nên đổi plugin kéo theo đổi tên skill.
- Publish gate theo plugin hoặc theo skill (`plugins/_published.json`); plugin `data` chưa có mục nào ở đó nên vẫn là draft.

## Các lựa chọn đã cân nhắc

1. **A. Giữ `backend-db-migration` ở plugin `backend`, kèm quy tắc phân ranh.**
   - Ưu: không phải di chuyển hay đổi tên skill.
   - Nhược: hai chủ sở hữu cho một chủ đề; redirect Bước 0 đi chéo plugin, mà `data` còn draft; [Inference] hai skill dễ trôi lệch nhau theo thời gian.
2. **B. Chuyển skill sang plugin `data`, đổi tên `data-db-migration` — chọn.**
   - Ưu: một plugin sở hữu mọi việc về database; redirect Bước 0 thành nội bộ plugin; khớp quy tắc tiền tố tên.
   - Nhược: đổi tên skill và mọi tham chiếu tới tên cũ.
3. **C. Gộp hẳn hai skill thành một.**
   - Ưu: không còn ranh giới phải giữ.
   - Nhược: trộn hai đối tượng khác nhau (migration trong repo app so với DB project riêng có schema contract), skill phình to, khó pilot và khó review từng phần.
4. **D. Publish nhánh OLTP của plugin `data` trước, giữ hai plugin.**
   - Ưu: hết cảnh trỏ sang skill draft.
   - Nhược: trì hoãn pilot của `backend-db-migration` (spec M4), vẫn hai plugin và hai chủ sở hữu.

## Quyết định

Chúng ta sẽ chọn phương án B: chuyển `backend-db-migration` sang plugin `data` với tên `data-db-migration`. Hai skill vẫn tách riêng. Quy tắc phân ranh ở Bước 0 giữ nguyên nội dung nhưng nằm trong cùng plugin (`plugins/data/skills/data-db-migration/SKILL.md`, bảng Bước 0, dòng trỏ `data-oltp-implement`).

Lý do: B đáp ứng hai lực đầu (một chủ sở hữu, redirect nội bộ) mà không gộp hai đối tượng khác nhau như C, và không phải publish sớm như D. Plugin `data` vẫn draft nên skill vẫn draft; publish sau pilot (spec M4).

## Hệ quả

Tích cực:
- Một plugin sở hữu mọi việc về database; redirect giữa hai skill là nội bộ, không còn liên kết chéo plugin.
- Skill giữ nguyên nội dung thiết kế; chỉ đổi vị trí và tên.

Tiêu cực và rủi ro:
- Đổi tên skill: các tham chiếu tên cũ trong `docs/superpowers/` là lịch sử, không sửa.
- Spec §7.1.10 và §8.1 vẫn dùng tên cũ; đã thêm ghi chú dưới §7.1 để đọc đúng.
- Plugin `data` là draft nguyên khối. Khi publish, cần mục `data/data-db-migration` trong `plugins/_published.json` hoặc publish cả plugin `data`.
- Agent `backend-implementer` (plugin `backend`) hiện chỉ khai báo skill `backend-implement,backend-api-contract`. Khi thêm `data-db-migration` vào agent, việc cài skill của plugin khác đi kèm agent là `[Inference]`: chưa kiểm cách installer xử lý, cần kiểm lại ở pha publish.

Residual risk: skill chưa pilot trên project Spring thật.

Việc theo sau (không thuộc ADR này): pha publish sau pilot (spec §9 P1b); workflow db-change dùng `data-db-migration` khi publish.
