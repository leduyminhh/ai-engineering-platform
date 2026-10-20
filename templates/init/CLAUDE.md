# CLAUDE.md

@AGENTS.md

Baseline chung (cách hành xử, an toàn, Definition of Done, ngôn ngữ) nằm ở `AGENTS.md`, được nạp
qua dòng import phía trên — giữ dòng đó ở đầu file. File này lưu rule RIÊNG của dự án — điền theo project.

## Đọc trước khi code (nguyên tắc nền tảng)
Trước khi làm bất kỳ việc gì, đọc skill nguyên tắc nền tảng: `principles`
(bản cài dạng plugin: `core:principles`). Nguyên tắc nền tảng + ranh giới tầng tài liệu
là bắt buộc cho cả Cowork lẫn Code.

## Git (commit / push / branch / PR)
Khi commit, push, tạo/chuyển branch, chuẩn bị PR, merge, release hoặc hotfix: gọi skill
`git-workflow` (bản cài dạng plugin: `core:git-workflow`). Không thêm dòng `Co-authored-by`.

## Tổng quan
<mô tả ngắn project là gì, làm gì>

## Tài liệu cần đọc trước khi code
- project-knowledge/  ← context nền (đọc TRƯỚC khi code)
- project-knowledge/code-convention.md  ← CHUẨN CODE BẮT BUỘC (đọc TRƯỚC khi viết code)
- docs/requests/<...>/plan.md  ← kế hoạch của yêu cầu hiện tại
- docs/decisions/  ← lý do các quyết định

## Quy ước code (RÀNG BUỘC — không phải gợi ý)
- Nguồn chuẩn duy nhất: `project-knowledge/code-convention.md`. ĐỌC TRƯỚC khi viết code.
- Mọi code sinh ra PHẢI tuân thủ convention đó: đặt tên, format, cấu trúc, xử lý lỗi, test.
- Lệch chuẩn = LỖI: phải sửa cho pass lint/format TRƯỚC khi commit; không commit code fail lint.
- Đổi convention chỉ qua ADR mới (cập nhật code-convention.md + ADR), không tự ý lệch.

## Lệnh
- Build: <lệnh>
- Test:  <lệnh>
- Lint:  <lệnh>
- Run:   <lệnh>

## RANH GIỚI AN TOÀN (Code KHÔNG được tự làm)
- Không push thẳng lên nhánh main/master.
- Không chạy migration hay lệnh phá hủy dữ liệu khi chưa được xác nhận.
- Không sửa file bí mật (.env, secrets, credentials).
- Không commit code lệch convention hoặc fail lint/format.
- Duyệt diff trước khi tích hợp (mục Safety của `AGENTS.md`): feature branch duyệt toàn bộ diff trước merge/push; protected branch dừng trước mỗi commit.

## Nguồn sự thật khi tài liệu lệch nhau
- Schema thực trong code  >  project-knowledge/data-model.md
- project-knowledge/code-convention.md + lint config  >  thói quen / style cá nhân
- docs/requests/<...>/plan.md  >  TODO.md

## Onboarding skill (cho người mới mở repo)
Repo này KHÔNG chứa skill workflow; skill sống ở KIT nguồn riêng (ai-engineering-platform,
CLI `aip`) và được cài bằng `aip install` (project scope hoặc `-g` cho global).
Khi mở repo mà các skill workflow chưa khả dụng, HÃY HỎI người dùng có muốn cài từ kit không
(xem README, mục "Onboarding cho người mới clone"). KHÔNG tự cài khi chưa được đồng ý.
