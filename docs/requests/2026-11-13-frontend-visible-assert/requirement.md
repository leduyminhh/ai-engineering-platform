# Requirement: AC hiển thị phải có assertion trên text hoặc role, và review bắt thông báo nằm trong vùng bị gỡ lúc loading

## Yêu cầu gốc

Skill `frontend-testing` PHẢI buộc test của một AC mô tả thứ người dùng thấy có assertion trên text hoặc role đó ở trạng thái cuối của chuỗi sự kiện, kể cả sau tải lại. Skill `frontend-code-review` PHẢI buộc reviewer soát hai thứ: thông báo do hành động gây ra nằm trong vùng bị gỡ khi loading, và AC hiển thị không có assertion nào.

## Bối cảnh

Nguồn: mục N4 của [trial-report.md](../2026-11-13-frontend-trial/trial-report.md). Đã đối chiếu với code của project trial `aip-frontend-trial` ở commit `2587135` (bản trước khi sửa):

- AC3.5 (đổi trạng thái gặp 404 thì hiện «Ticket không còn tồn tại. Danh sách đã được tải lại.») có test tích hợp `TicketBoardPage.test.tsx` xanh. Test chỉ assert thứ tự request (`PATCH` rồi `GET`) và nhãn `1–10 / 24`, không assert thông báo.
- `use-update-ticket-status.ts` đặt `errors[id]` rồi gọi `reload`; `TicketList.tsx` chỉ vẽ `<ul>` (kèm lỗi từng dòng) khi `state.kind === 'ready'`, nên trong lúc tải lại cả danh sách và thông báo bị gỡ. Ticket đã xoá cũng không còn dòng để mang lỗi. Thông báo không bao giờ hiện.
- Bước kiểm lại của phiên này: thêm `expect(screen.getByRole('alert')).toHaveTextContent(…)` sau dòng `findByText('1–10 / 24')` vào test gốc ở bản giải nén commit `2587135` thì test đỏ, 7/8 test xanh (không tìm thấy role `alert`). Một assertion là đủ làm test bắt lỗi này.
- Mọi test từng tầng đều xanh vì mỗi tầng đúng khi đứng riêng: hook đặt đúng state, phần trình bày hiển thị đúng khi nhận prop. Lỗi nằm ở chỗ ghép, nên chỉ test tích hợp bắt được.
- Review từng task không bắt được; một dòng `Ruling:` ("hook và UI làm đúng chữ AC") qua review từng task, chỉ review cuối toàn nhánh chỉ ra.

Quy tắc hiện có chưa phủ: `react-testing-patterns.md` §4 đòi assert thông báo lỗi cho ca lỗi khi tải lần đầu và "UI phản ánh kết quả" sau mutation (dòng 67–68, ví dụ toast, điều hướng, danh sách cập nhật), nhưng không nói điểm thời gian của assertion sau một chuỗi có tải lại, và không nói assert request log không tính; `frontend-test-writer.md` đòi nêu thay đổi production nào làm test fail; `review-dimensions.md` Trục 1 chỉ nói "thiếu xử lý loading/error/empty" ở mức trạng thái của dữ liệu, không nói đến thông báo của hành động.

Giới hạn bằng chứng: n=1 project, một trial. [Inference] Quy tắc mới làm agent viết assertion đúng chỗ hoặc reviewer bắt được ca này: chưa thử với agent thật.

## Ràng buộc

- Chỉ đổi nội dung chiếu của plugin `frontend`; văn bản tiếng Việt có dấu, UTF-8 không BOM, LF.
- Không thêm test riêng cho cùng AC; không làm bộ test phình theo số vòng review (AGENTS.md mục Testing).
- Không đụng mục A11y của `review-dimensions.md` (request N1 sửa dòng focus), `workflows/`, `frontend-implement`, `frontend-fix`, `frontend-data-integration`.
- Đổi nội dung chiếu thì phải bump `plugins/frontend/.manifest.json` và chạy `node cli/lib/versions.mjs --lock`.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `plugins/frontend/skills/frontend-testing/SKILL.md` When đọc bảng gate Then có gate `T7` nêu: mỗi AC mô tả thứ người dùng thấy có ít nhất một assertion trên text hoặc role ở trạng thái cuối chuỗi sự kiện, kể cả sau tải lại; cột "Đỏ thì" yêu cầu thêm assertion hoặc ghi AC đó vào khoảng trống chưa phủ.
- [ ] **AC1.2** — Given quy tắc của AC1.1 When đọc nội dung Then nêu rõ ba điều: (a) assertion đặt vào test đã có của AC ở tầng thấp nhất render cả nguồn của thông báo lẫn vùng chứa nó, không thêm test thứ hai cho cùng AC ở tầng đó; AC chưa có test nào ở tầng đó (chỉ có test hook hoặc test trình bày) thì thêm một test cho AC đó ở tầng ấy, vì đây là hành vi chưa có test, không phải bản trùng; (a') AC không có chuỗi sự kiện hay tải lại (một thao tác ra kết quả ngay) thì assert ngay sau thao tác, không giả lập tải lại; (b) assert request log, state của hook, mock được gọi hay số lần gọi không thoả quy tắc; (c) quy tắc chỉ áp khi có AC mô tả thứ người dùng thấy.
- [ ] **AC1.3** — Given `references/react-testing-patterns.md` mục 4 When đọc Then có ví dụ chuỗi hành động → lỗi → tải lại → assertion thông báo sau khi dữ liệu về, kèm ca đối chứng "test xanh nhưng không assert thông báo" và lý do nó không bắt được lỗi.
- [ ] **AC2.1** — Given `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` Trục 1 mục "Loading / error / empty" When đọc Then có dấu hiệu "thông báo do hành động gây ra nằm trong vùng bị gỡ khi loading", kèm cách kiểm (lần từ nơi đặt thông báo tới nhánh render của cha theo `state.kind`/`isLoading`/`isFetching` và hỏi nhánh đó còn mounted sau tải lại không) và nhãn proven khi chỉ ra được cả nơi đặt lẫn nhánh gỡ; severity `major` khi AC yêu cầu thông báo đó (dòng `major` hiện có của bảng Severity, không dùng `blocker` vì không crash hay mất dữ liệu).
- [ ] **AC2.2** — Given `review-dimensions.md` Trục 6 When đọc Then có câu hỏi "AC mô tả thứ người dùng thấy có assertion trên text/role ở trạng thái cuối chuỗi sự kiện không", nêu assert request log hoặc state hook không tính, và severity: `major` khi AC là thông báo lỗi hoặc xác nhận cho người dùng, `minor` với AC hiển thị khác.
- [ ] **AC3.1** — Given diff của nhánh so với master When chạy `git diff master...HEAD -- plugins/frontend/skills/frontend-code-review/references/review-dimensions.md` Then các hunk chỉ nằm ở Trục 1 mục Loading/error/empty và Trục 6, không có hunk nào trong Trục 4 (A11y).
- [ ] **AC3.2** — Given diff của nhánh When đối chiếu danh sách file đổi Then không có thay đổi ở `AGENTS.md`, `core/agents/AGENTS.template.md`, `plugins/frontend/agents/*`, `workflows/`, `plugins/frontend/skills/frontend-implement/`, `plugins/frontend/skills/frontend-fix/`, `plugins/frontend/skills/frontend-data-integration/`.
- [ ] **AC4.1** — Given nội dung đã đổi When chạy `node cli/lib/versions.mjs --lock` rồi `npm test` Then version `frontend` lớn hơn `1.16.3`, `plugins/_versions.lock.json` khớp bản build, `npm test` exit 0.
- [ ] **AC4.2** — Given file pin `test/content/54-frontend-visible-assert.pin.mjs` When chạy `node test/validate.mjs --only visible-assert` Then pass, và đỏ nếu bỏ gate `T7` hoặc bỏ dấu hiệu ở Trục 1 hoặc câu hỏi ở Trục 6.

## Ngoài phạm vi

- Chạy eval thật và đo hiệu lực (xem design).
- Sửa `AGENTS.md` mục Testing, hai file agent, `frontend-e2e-testing` (skill riêng cho luồng trên trình duyệt thật; chưa đọc kỹ nên chưa kết luận nó cần hay không cần quy tắc này).
- Bước chạy UI thật đối chiếu mockup (request N1).
