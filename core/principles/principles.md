# Nguyên tắc nền tảng — Workflow Cowork → Code (CORE)

> Đây là phần "luôn bật" (always-on) **DÙNG CHUNG cho mọi plugin** của bộ workflow.
> Mỗi plugin bổ sung phần RIÊNG theo lĩnh vực (pipeline + định nghĩa contract + ranh
> giới/nguồn-sự-thật đặc thù). Các adapter nhúng nội dung CORE này TRƯỚC phần riêng:
> Claude Code cài qua plugin `core` (dependency bắt buộc); Cursor/Codex/Antigravity
> build gộp core + phần riêng vào cùng một file rules/AGENTS.md.

## 4 nguyên tắc cốt lõi
1. **MỘT FOLDER CHUNG** cho cả công cụ "nghĩ/lập kế hoạch" (Cowork) và công cụ "thực thi/git" (Code).
2. **MỌI BỐI CẢNH NẰM TRONG FILE**, không dựa vào memory — vì phiên chat quên giữa các lần,
   và công cụ thực thi KHÔNG đọc được "Project/Workspace" của công cụ lập kế hoạch. Mọi quyết
   định, kế hoạch, kiến thức nền đều phải externalize ra file.
3. **CLAUDE.md / AGENTS.md LÀ HỢP ĐỒNG**: công cụ thực thi tự đọc file này làm context đầu vào.
4. **CON NGƯỜI GIỮ 2 CHỐT**: chọn giải pháp (sau giai đoạn phân tích) + duyệt diff trước khi
   commit. Đây là 2 nơi sai sót đắt nhất nếu tự động hoàn toàn.

## 3 tầng tài liệu (phân biệt rõ)
- `project-knowledge/` = KIẾN THỨC NỀN: ổn định, ít đổi (kiến trúc, domain, stack, mô hình dữ
  liệu, code-convention). Mọi công cụ đọc làm context LÂU DÀI, đọc TRƯỚC khi làm.
- `docs/requests/` = TIẾN TRÌNH theo TỪNG yêu cầu: mỗi yêu cầu MỘT thư mục riêng, không ghi đè
  → giữ lịch sử mọi yêu cầu.
- `docs/decisions/` = ADR (Architecture Decision Records): quyết định kiến trúc TÍCH LŨY, đánh
  số tăng dần, cho người sau biết VÌ SAO chọn giải pháp đó.

Tách biệt **tầng tài liệu** và **tầng mã nguồn**: mã nguồn nằm trong root riêng (mặc định `src/`),
tổ chức theo module/feature tự chứa, KHÔNG trộn với tài liệu — để git diff sạch và scope
build/test/lint rõ ràng.

## Ranh giới an toàn nền (công cụ thực thi KHÔNG được tự làm)
- Không push thẳng lên `main`.
- Không chạy lệnh phá hủy / ghi đè dữ liệu khi chưa được duyệt.
- Không sửa file bí mật (`.env` / secrets / credentials).
- Luôn để con người duyệt diff trước khi commit.
- Không commit code lệch `code-convention.md` / fail lint.

> Mỗi plugin có thể BỔ SUNG ranh giới an toàn đặc thù lĩnh vực (vd: nhánh data-olap cấm
> backfill/overwrite partition; frontend cấm tự đổi design tokens toàn cục).

## Nguồn sự thật khi tài liệu lệch nhau (nền)
schema/migration thực trong code > tài liệu mô tả; `contract.md` > mock/sample; `plan.md` >
`TODO.md`; `code-convention.md` + lint config > thói quen cá nhân.

> Mỗi plugin BỔ SUNG thứ tự nguồn-sự-thật đặc thù cho contract/model của lĩnh vực mình.

## Phối hợp đa-plugin (khi nhiều lĩnh vực dùng chung 1 repo)
Các plugin (backend / frontend / data) KHÔNG đọc trực tiếp `docs/requests/` của nhau
(đó là tiến trình RIÊNG từng yêu cầu). Tương tác chéo đi qua 2 kênh dùng chung, tường minh:

- **`docs/contracts/` = HANDOFF (hợp đồng đã công bố).** Bên PRODUCER công bố contract ổn định
  ra đây (backend: response schema/endpoint; data (OLAP): data contract của dataset đích).
  Bên CONSUMER (vd frontend) ÁNH XẠ contract của mình TỪ đó. Khi lệch nhau, **contract đã công
  bố của producer là nguồn sự thật** — consumer DỪNG, không tự bịa; đổi contract đã công bố =
  thay đổi có thể phá consumer.
- **`docs/decisions/` = ADR CHUNG.** Quyết định kiến trúc liên-lĩnh-vực (vd chốt shape API ảnh
  hưởng cả backend lẫn frontend) ghi 1 ADR đánh số chung, mọi plugin cùng đọc — đây là ngữ cảnh
  phối hợp tích lũy, không thuộc riêng plugin nào.

> Thứ tự handoff điển hình full-stack: backend `api-contract` (công bố `docs/contracts/`) →
> frontend `ui-contract` (ánh xạ từ đó). Đổi hợp đồng phá tương thích → mở ADR trước.
