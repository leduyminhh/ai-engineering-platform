---
name: engineering-release-notes
description: "Skill capability (plugin engineering) để từ LỊCH SỬ GIT (giữa 2 tag, khoảng ngày, N ngày gần nhất, hoặc nhóm commit) VIẾT changelog + release notes HƯỚNG NGƯỜI DÙNG: phân nhóm New Features / Improvements / Fixes / Breaking Changes / Security, lọc churn nội bộ, viết lại commit thành ngôn ngữ kết quả, nêu breaking change + cách migrate, giữ truy vết tag/hash/PR/ticket. Là bước hoàn tất sau khi git-workflow gom lịch sử. Docs-only: KHÔNG tự tag/release/push, KHÔNG bịa thay đổi; con người duyệt. Dùng skill NÀY khi người dùng muốn \"release notes\", \"changelog\", \"ghi chú phát hành\", \"tóm tắt thay đổi từ tag\", \"tổng hợp commit tuần/tháng\", \"what's new\", \"viết note cho bản phát hành\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần ở giai đoạn plan. Không dùng khi chỉ cần gom lịch sử git → git-workflow; chuẩn bị cả đợt phát hành → workflow-release."
order: 4
title: "Release Notes — từ lịch sử git viết changelog + release notes hướng người dùng"
runsIn: plan
invoke: per-request
---

# Release Notes (skill dùng chung)

Từ **lịch sử git** của một phạm vi (giữa 2 tag/version, một khoảng ngày, N ngày gần nhất, hoặc từ một nhóm
commit trước) → **viết changelog + release notes HƯỚNG NGƯỜI DÙNG**. Skill này là **hướng dẫn cách agent
phân loại và viết nội dung phát hành** (docs-only recipe), KHÔNG sinh code, KHÔNG tự tag/release/push.

Nội dung đầu ra phân theo nhóm chuẩn (New Features / Improvements / Fixes / Breaking Changes / Security), lọc
bớt churn nội bộ (refactor/format/chore không đổi hành vi người dùng), **viết lại** commit khô khan thành ngôn
ngữ **kết quả/giá trị** (không lặp nguyên văn subject), nêu rõ breaking change kèm cách migrate, và **giữ truy
vết** (tag/hash/PR/ticket) để đối chiếu ngược.

Skill này là **bước HOÀN TẤT của handoff** từ skill core `git-workflow`: `git-workflow` gom lịch sử git theo
phạm vi (`Quy trình — changelog / release notes`) và giao phần **VIẾT nội dung cuối** cho skill này. Nếu chỉ có
`git-workflow` mà thiếu skill này, `git-workflow` chỉ tạo bản tóm tắt tối thiểu; skill này viết bản đầy đủ,
hướng người dùng. Skill này KHÔNG thuộc chuỗi pipeline bắt buộc của plugin nào; gọi khi cần ở giai đoạn
**plan** (chuẩn bị phát hành). Con người giữ chốt: **duyệt release notes** trước khi công bố.

## Khi nào dùng

- Người dùng muốn viết release notes, changelog, ghi chú phát hành, "what's new".
- Cần tóm tắt thay đổi từ tag/version (`v2.4.0..v2.5.0`), theo khoảng ngày, N ngày gần nhất, hoặc từ một nhóm
  commit đã gom sẵn.
- Cần tổng hợp commit tuần/tháng thành bản tin thay đổi cho người dùng cuối / dev / stakeholder.
- Đang ở cuối `git-workflow` (`Quy trình — changelog / release notes`) và cần bước viết nội dung cuối.

KHÔNG dùng skill này để thực hiện thao tác git (tag/release/push/merge) — đó là việc của `git-workflow`; skill
này chỉ **viết nội dung**.

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh code; KHÔNG tự `git tag` / tạo release / push; KHÔNG bump version thay người dùng.
  Các thao tác git thuộc skill `git-workflow`.
- **KHÔNG bịa thay đổi.** Chỉ viết những gì có trong lịch sử git đã gom. Mục nào không rõ tác động người dùng →
  đưa vào câu hỏi mở, đánh dấu **[giả định]**, KHÔNG âm thầm điền.
- Ngôn ngữ **đo được**; KHÔNG tuyên bố tuyệt đối kiểu "đảm bảo / loại bỏ hoàn toàn / chặn triệt để". Mô tả tác
  động theo điều quan sát được; nêu **residual risk** khi có.
- **Không lộ nội dung nhạy cảm** trong release notes công khai: đường dẫn nội bộ, tên hạ tầng/host, secret,
  chi tiết lỗ hổng chưa vá. Mục Security nêu ở mức người dùng cần biết, không kèm PoC khai thác.
- **Giữ truy vết** nhưng phân biệt kênh: bản công khai có thể ẩn hash nội bộ; giữ tag/PR/ticket nếu là kênh nội bộ.
- Con người **duyệt** release notes trước khi công bố (protected: kênh phát hành công khai).

## Quy trình — viết release notes

0. **Nạp context (BẮT BUỘC — trước khi viết).**
   Chốt **phạm vi so sánh nhỏ nhất có ích**: giữa 2 tag/version (`vX..vY`), một khoảng ngày, N ngày gần nhất,
   hoặc từ một nhóm commit đã gom. Xác định **đối tượng đọc** (người dùng cuối / dev / stakeholder) và **kênh
   xuất** (`CHANGELOG.md` / trang release / bản tin). Lịch sử thường do skill `git-workflow` gom sẵn; nếu chưa
   có → nói rõ (fail-loud) và đề nghị chạy `git-workflow` (`Quy trình — changelog / release notes`) để lấy lịch sử
   theo phạm vi trước, hoặc viết với phần đầu vào đã có + ghi rõ giới hạn.

1. **Gom & phân loại.**
   Theo [references/scope-and-grouping.md](references/scope-and-grouping.md): đọc lịch sử của phạm vi, phân
   nhóm theo **New Features / Improvements / Fixes / Breaking Changes / Security**, **lọc churn nội bộ** (chore/
   refactor/format/test/CI không đổi hành vi người dùng), và **giữ truy vết** (tag/hash/PR/ticket) cho từng mục.

2. **Viết hướng người dùng.**
   Theo [references/user-facing-writing.md](references/user-facing-writing.md): viết lại mỗi mục theo **kết
   quả/giá trị** cho người đọc (họ làm được gì / tránh được gì), **không lặp nguyên văn commit subject**, gộp
   các commit cùng chủ đề. Nêu **breaking change** rõ ràng kèm **cách migrate**; đánh dấu **[giả định]** cho
   phần suy đoán tác động.

3. **Định dạng đầu ra.**
   Theo [references/changelog-format.md](references/changelog-format.md): chọn định dạng theo kênh — mục
   `CHANGELOG.md` kiểu **Keep a Changelog** (Unreleased + phiên bản có ngày) hoặc **trang release**; version
   theo **SemVer**; kèm ngày phát hành và link (tag/so sánh/PR). Tiếng Việt CÓ DẤU.

4. **Verify.**
   Chạy checklist: mọi nhóm CÓ thay đổi đều được nêu; **breaking change + migration** nêu rõ; mỗi mục **truy
   vết được** về nguồn (tag/hash/PR/ticket); **không lộ nội dung nhạy cảm** ở kênh công khai; ngôn ngữ đo
   được, không tuyên bố tuyệt đối. Nêu rõ mục không rõ tác động (fail-loud) → đưa vào câu hỏi mở để con người
   quyết; con người **duyệt**.

## Verification (trước khi báo hoàn thành)

- Đã chốt phạm vi so sánh nhỏ nhất có ích + đối tượng đọc + kênh xuất.
- Thay đổi phân đủ theo nhóm (New/Improve/Fix/Breaking/Security); churn nội bộ đã lọc.
- Mỗi mục viết theo kết quả/giá trị, KHÔNG lặp nguyên văn commit subject.
- Breaking change nêu rõ **kèm cách migrate**; phần suy đoán đánh dấu **[giả định]**.
- Truy vết được về nguồn (tag/hash/PR/ticket); định dạng đúng kênh (Keep a Changelog / release page), SemVer +
  ngày + link.
- Không lộ nội dung nhạy cảm ở kênh công khai; ngôn ngữ đo được, không tuyên bố tuyệt đối.
- Tiếng Việt còn nguyên dấu; con người duyệt trước khi công bố.

## Ghi chú — quan hệ với git-workflow

Skill này **không** thao tác git. Việc **gom lịch sử theo phạm vi** (tag/ngày/N ngày/nhóm commit) và mọi thao
tác git (tag, release branch, push, merge-back) thuộc skill core **`git-workflow`**. Quan hệ chuẩn:

- `git-workflow` (`Quy trình — changelog / release notes`) → gom lịch sử, giữ tag/hash/PR/ticket → **giao** phần viết
  nội dung cuối cho skill này.
- Skill này → phân loại + viết hướng người dùng + định dạng → trả bản release notes để con người duyệt, rồi
  quay lại `git-workflow` nếu cần tag/release thật.

Nếu người dùng vừa muốn tag/release vừa muốn nội dung: dùng `git-workflow` cho phần git, skill này cho phần viết.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/scope-and-grouping.md](references/scope-and-grouping.md): cách chốt phạm vi so sánh, đọc lịch sử,
  phân nhóm New/Improve/Fix/Breaking/Security, quy tắc lọc churn nội bộ, và cách giữ truy vết (tag/hash/PR/ticket).
- [references/user-facing-writing.md](references/user-facing-writing.md): cách viết lại commit theo kết quả/giá
  trị, không lặp subject, gộp theo chủ đề, nêu breaking + migration, đánh dấu [giả định].
- [references/changelog-format.md](references/changelog-format.md): định dạng theo kênh (Keep a Changelog /
  trang release), quy ước SemVer, ngày phát hành, link tag/so sánh, ẩn thông tin nhạy cảm ở kênh công khai.
