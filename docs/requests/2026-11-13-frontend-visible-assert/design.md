# Thiết kế: AC hiển thị có assertion trên text/role; review bắt thông báo nằm trong vùng bị gỡ lúc loading
- Ngày: 2026-11-13
- Trạng thái: merged 96636a84 (local; chưa push)
- Requirement: [requirement.md](requirement.md)
- Nguồn: N4 trong [trial-report.md](../2026-11-13-frontend-trial/trial-report.md)

## Vấn đề và lý do

Trial plugin `frontend` có một ca mà mọi test xanh nhưng người dùng không thấy thông báo AC yêu cầu (chi tiết và kết quả kiểm lại ở mục Bối cảnh của `requirement.md`). Có ba chỗ hở, mỗi chỗ một cơ chế đang có nhưng không chạm tới:

1. **Test:** quy tắc "assert thứ người dùng thấy" có ở `test-strategy.md` §4 và `react-testing-patterns.md` §4 (kể cả dòng 67–68 "sau mutation, assert UI phản ánh kết quả") nhưng viết ở dạng nguyên tắc chung; không có điểm kích hoạt theo AC, không nói điểm thời gian của assertion (sau khi chuỗi sự kiện và tải lại xong), không nói assert request log hay state hook không tính. Test AC3.5 gốc assert request log, nên đúng với nguyên tắc ở chữ nhưng không bắt được lỗi.
2. **Review code:** `review-dimensions.md` Trục 1 mục Loading/error/empty chỉ nói thiếu xử lý ba trạng thái của *dữ liệu*; không nói tới thông báo do *hành động* gây ra bị gỡ cùng vùng đang tải. Trục 6 hỏi có test cho nhánh mới, không hỏi AC hiển thị có assertion hay không.
3. **Chồng nhau không ai thấy:** hook đúng, phần trình bày đúng, mỗi test tầng thấp xanh; chỉ phần ghép sai. Vì vậy tầng thấp nhất bắt được lỗi là test tích hợp của trang, không phải test hook.

[Inference] Cả hai bản sửa nhỏ và không đổi hành vi của hệ thống; không làm thì lỗi dạng này vẫn có thể lọt qua review từng task như trong trial. Chưa có cách tất định kiểm agent thật có làm theo (xem Rủi ro).

## Quyết định đã chốt

Người dùng giao qua yêu cầu mở request (không hỏi lại): phạm vi file dự kiến là `frontend-testing` (SKILL.md hoặc `references/`) và `review-dimensions.md`; chỉ sửa mục loading/error/empty ở Trục 1, không đụng A11y; chỉ có n=1 nên không viết "đủ để bắt" khi chưa thử.

## Quyết định của agent (soát và đảo được ở G1)

- **D1 — Mức ràng buộc: bắt buộc cho AC hiển thị, không áp cho test khác.** Thêm gate `T7` vào bảng gate của `frontend-testing` (cùng loại với T1–T6, "Đỏ thì: thêm assertion, hoặc ghi AC vào khoảng trống chưa phủ ở báo cáo"). Lý do chọn bắt buộc: lỗi lọt im lặng (test xanh) và gate chỉ tốn một assertion trong test đã có. Điều kiện áp rất hẹp: chỉ khi có AC mô tả thứ người dùng thấy. Đường thay thế "khuyến nghị" ghi ở Đường đã cân nhắc.
- **D2 — Áp cho cả test-writer và reviewer, qua skill, không sửa hai file agent.** `frontend-test-writer` có `skills: "frontend-testing"` và `frontend-reviewer` có `skills: "frontend-code-review"`; hai agent đọc skill ở bước 1 của quy trình. [Inference] Theo mô tả quy trình trong hai file agent, SKILL.md vào ngữ cảnh agent, còn `references/` chỉ khi agent đọc: vì vậy quy tắc test nằm ở SKILL.md (gate T7 và một dòng ở bước 2), chi tiết và ví dụ ở `references/react-testing-patterns.md`; quy tắc review nằm ở `review-dimensions.md` mà bước 1 của skill review đã trỏ tới. Không sửa agent để giữ ít file đổi và ít xung đột bump khi merge cùng N1–N3. Điều này chưa được kiểm trên agent chạy thật.
- **D3 — Không gắn vào `AGENTS.md` mục Testing.** `AGENTS.md` là baseline provider-agnostic, byte-identical với `core/agents/AGENTS.template.md` và được `aip init` ghi vào mọi project; đổi nó là bump `core` và đổi baseline mọi project cho một quy tắc đặc thù frontend với bằng chứng n=1. Nguyên tắc "một hành vi một test ở tầng thấp nhất" đã đủ rộng để quy tắc mới là một ca của nó (lỗi nằm ở chỗ ghép nên tầng thấp nhất bắt được là test tích hợp). Quy tắc mới viết thành "thêm assertion vào test đã có", không mâu thuẫn với ràng buộc "không phình bộ test".
- **D4 — Không chạy eval thật trong request này.** `evals/` chạy tay và tốn tiền model (hỏi người dùng trước). Request này chỉ có pin nội dung và kết quả kiểm lại ở trial. Hiệu lực với agent thật là câu hỏi mở; xem Rủi ro. Nếu người dùng muốn đo, mở request riêng thêm case eval (scaffold dựng lại lỗi của trial ở commit `2587135`, chấm: reviewer gắn finding ở `TicketList.tsx` và test-writer thêm assertion).
- **D5 — Pin nội dung tối thiểu, một file.** `test/content/54-frontend-visible-assert.pin.mjs` kiểm ba chuỗi: gate T7, dấu hiệu Trục 1, câu hỏi Trục 6. AGENTS.md mục Testing nói không viết test ghim văn bản tài liệu; repo này lại dùng `test/content/*.pin.mjs` làm cách bảo vệ quy tắc nội dung khỏi bị xoá lặng lẽ khi chưa có contract. Giữ ba assert vì không có cách nào khác kiểm ba quy tắc này còn nguyên; bỏ pin nếu người dùng muốn theo đúng chữ AGENTS.md.
- **D6 — Severity theo thang hiện có.** Thông báo AC bị gỡ lúc loading (proven) là lỗi correctness, dùng dòng `major` của bảng Severity ("thiếu xử lý error vùng quan trọng"); AC hiển thị thiếu assertion: `major` khi AC là thông báo lỗi hoặc xác nhận cho người dùng, `minor` với AC hiển thị khác. Không sửa bảng Severity. Căn cứ: AGENTS.md coi "coverage could be broader" là Minor, và finding ở đây nêu một defect cụ thể (AC thông báo không có assertion) nên nâng `major` được cho riêng ca thông báo.
- **D8 — Làm rõ sau builder check (quyết định của agent).** (a) AC chưa có test ở tầng render cả nguồn lẫn vùng chứa thì thêm một test cho AC đó ở tầng ấy; điều cấm là bản trùng, không phải test cho hành vi chưa có test. (b) AC không có chuỗi sự kiện thì assert ngay sau thao tác. (c) Ca thông báo bị gỡ lúc loading là `major`, không `blocker`. (d) Mục con mới ở `react-testing-patterns.md` §4 đặt ngay sau dòng 67–68 và dòng đó trỏ tới nó; không viết lại hai dòng.
- **D7 — Bump `frontend` từ 1.16.3 lên 1.16.4 (thực tế 1.16.5).** Sau review cuối nội dung build đổi lần nữa nên cổng version (`versions.mjs --lock`) buộc bump thêm một số; kết quả `frontend` là 1.16.5. Xung đột `plugins/frontend/.manifest.json` và `plugins/_versions.lock.json` với N1, N2, N3 giải quyết lúc merge (tính lại số cao nhất và chạy `--lock`).

## Đường đã cân nhắc

| Hướng | Nội dung | Đánh đổi |
|---|---|---|
| **A (khuyến nghị)** | Gate T7 + ví dụ trong `frontend-testing`; dấu hiệu Trục 1 + câu hỏi Trục 6 trong `review-dimensions.md`; pin 3 chuỗi | Ít file, không đụng core hay agent; hiệu lực với agent thật chưa đo |
| B | Như A, thêm một luật vào "Luật chất lượng test" của `frontend-test-writer.md` và dòng vào `frontend-reviewer.md` | Luật nằm ở chỗ chắc chắn vào ngữ cảnh agent; thêm hai file đổi, chồng lặp với skill, tăng điểm xung đột bump; chưa có bằng chứng agent bỏ sót skill |
| C | Chỉ sửa review, không sửa test | Chặn được ở review nhưng bắt muộn (trial: chỉ review cuối bắt được); test vẫn xanh trống |
| D | Quy tắc "AC hiển thị có assertion" vào `AGENTS.md` | Phủ mọi project nhưng đổi baseline + core, đặc thù frontend, n=1 (D3) |

Hướng "khuyến nghị thay vì bắt buộc" cho D1: bỏ gate T7, chỉ giữ ví dụ trong references. Rẻ hơn nhưng quy tắc nằm ngoài bảng gate mà agent bỏ qua khi báo xong; trial cho thấy lỗi này lọt chính vì không có điểm chốt.

## Thiết kế

Bốn chỗ sửa nội dung và một pin. Các bản sửa viết trước ở dạng ý; câu chữ cuối chốt ở plan.

1. **`plugins/frontend/skills/frontend-testing/SKILL.md`**
   - Bảng gate thêm hàng `T7`: "Mỗi AC mô tả thứ người dùng thấy có ≥ 1 assertion trên text/role ở trạng thái cuối chuỗi sự kiện (kể cả sau tải lại), không phải request log hay state hook | 2 | Thêm assertion vào test tích hợp của AC, hoặc ghi AC vào khoảng trống chưa phủ".
   - Bước 2, bullet "Tầng chạm data": thêm một câu trỏ tới T7 và `react-testing-patterns.md` §4.
2. **`plugins/frontend/skills/frontend-testing/references/react-testing-patterns.md` §4**
   - Thêm mục con "AC hiển thị: assert ở cuối chuỗi sự kiện": (a) điểm assert = sau khi mọi request của chuỗi và lần tải lại xong (chờ bằng `findBy*` trên một thứ hiển thị cuối chuỗi, rồi assert thông báo); (b) assert request log/state hook/mock không tính; (c) assertion đặt vào test tích hợp đã có của AC, không thêm test; (d) ví dụ rút từ trial: chuỗi chọn trạng thái → PATCH 404 → GET tải lại → `findByText('1–10 / 24')` → `getByRole('alert')` có chữ thông báo; ca đối chiếu xanh nhưng không assert thông báo; kèm lý do tầng hook và tầng trình bày đều xanh mà trang vẫn sai.
3. **`plugins/frontend/skills/frontend-code-review/references/review-dimensions.md`**
   - Trục 1, sau dòng Loading/error/empty: thêm bullet "Thông báo do hành động gây ra nằm trong vùng bị gỡ lúc loading" với cách kiểm và nhãn proven như AC2.1.
   - Trục 6: thêm bullet câu hỏi AC hiển thị và severity (D6). Không sửa Trục 4.
4. **Version + lock + pin:** `plugins/frontend/.manifest.json` 1.16.3 → 1.16.4; `node cli/lib/versions.mjs --lock`; file pin D5.

Không có đổi code (CLI, hook, adapter).

## Ảnh hưởng spec
Không ảnh hưởng: nội dung hướng dẫn của hai skill frontend không đổi hành vi của năng lực nào trong `docs/specs/` (build, hook, workflow, routing); `docs/specs/` hiện chỉ có spec hạ tầng, không có spec cho nội dung từng plugin.

## Ngoài phạm vi và anti-goal

- Eval thật, đo hiệu lực với agent thật (D4).
- `AGENTS.md`, hai file agent, `frontend-e2e-testing`, `workflows/` (D2, D3).
- Mục A11y của `review-dimensions.md` và bước đối chiếu giao diện thật (N1); `frontend-fix` (N2); `frontend-data-integration` (N3).
- Quy tắc cho backend (`backend-testing`): không có bằng chứng trial.
- Anti-goal: không đòi thêm test mới cho AC không hiển thị; không đòi assert mọi AC hiển thị ở nhiều tầng.

## Ràng buộc

- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment trong file test ví dụ nêu *vì sao*.
- Mỗi lệnh Bash một lần gọi; không push, không merge; commit qua `core:git-workflow` (header tiếng Anh, body tiếng Việt, `git commit -F`, không `Co-Authored-By`).
- Chưa viết plan, chưa sửa nội dung plugin trước khi duyệt G1.

## Kiểm thử

| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1, AC2.1, AC2.2 | pin nội dung | `test/content/54-frontend-visible-assert.pin.mjs`: chuỗi `T7`, dấu hiệu Trục 1, câu hỏi Trục 6 |
| AC1.2, AC1.3 | đọc duyệt diff | không pin (văn bản ví dụ); người duyệt đối chiếu ba điều (a)–(c) và ví dụ |
| AC3.1, AC3.2 | lệnh `git diff` | `git diff master...HEAD --stat` và `git diff master...HEAD -- review-dimensions.md` ở bước kết thúc (ba chấm để master tiến thêm không lẫn vào) |
| AC4.1 | `npm test` | `node cli/lib/versions.mjs --lock` rồi `npm test` |
| AC4.2 | pin | chạy `--only visible-assert` xanh; sửa tạm bỏ T7 thì đỏ |

Đã kiểm trước (spike, ngoài repo, không giữ): ở bản giải nén commit `2587135` của trial, thêm `expect(screen.getByRole('alert')).toHaveTextContent('Ticket không còn tồn tại. Danh sách đã được tải lại.')` vào test AC3.5 thì test đỏ (`Unable to find an accessible element with the role "alert"`), 7/8 test xanh. Chạy lại: giải nén commit bằng `git archive 2587135`, nối `node_modules` của trial bằng junction, `node node_modules/vitest/vitest.mjs run src/features/tickets/components/TicketBoardPage.test.tsx`. Spike chỉ chứng minh một assertion bắt được lỗi, không chứng minh agent sẽ viết nó.

## Để builder quyết

- Câu chữ cuối của gate T7 và các bullet, miễn đủ các ý ở AC1.1–AC2.2.
- Vị trí chính xác của hàng T7 trong bảng và của mục con ở §4 (theo thứ tự hiện có).
- Tên biến, văn bản ví dụ trong mục con (có thể dùng danh sách ticket như trial hoặc ví dụ trung tính).

## Rủi ro và câu hỏi mở

- **[Inference] Hiệu lực với agent thật chưa đo.** Quy tắc nằm ở nội dung skill; chưa thử agent test-writer có thêm assertion hay reviewer có gắn finding ở ca trial. Không viết "đủ để bắt" cho tới khi có eval hoặc trial lặp (D4).
- **Bằng chứng n=1.** Một project, một lỗi. [Unverified] Mức phổ biến của lớp lỗi "thông báo nằm trong vùng bị gỡ lúc loading" ở project khác.
- **Reviewer phải đọc `review-dimensions.md`.** [Inference] Bước 1 của skill review trỏ tới file này nên reviewer có đọc, nhưng không có gì buộc agent mở nó cho mỗi diff.
- **Vùng gỡ nằm xa nơi đặt thông báo.** Dấu hiệu Trục 1 dựa vào đọc nhánh render của cha; lỗi ghép qua nhiều component có thể khó thấy trong diff tĩnh, ghi rõ "proven khi chỉ ra cả hai đầu, nếu không là suspected".
- **Pin ghim văn bản** vs. AGENTS.md (D5): câu hỏi chọn ở G1.
- **Xung đột merge** với N1–N3 ở `.manifest.json`, `_versions.lock.json` (D7) và với N1 ở `review-dimensions.md` (hunk Trục 4 khác hunk của request này).

## Ghi chú thực thi

Quyết định phát sinh lúc chạy plan (ledger nằm ngoài nhánh nên chép vào đây):
- Task 1 là pin đỏ có chủ đích, bằng chứng `tests:` của dòng `complete` là `node --check test/content/54-frontend-visible-assert.pin.mjs` exit 0; pin xanh 3/3 từ Task 3.
- Review cuối coi thiếu câu «không dùng `blocker`» ở bullet Trục 1 là major vì AC2.1 có câu đó; một lần sửa gộp mọi minor cùng vùng chữ (F1–F7), kèm giới hạn khớp theo Trục trong pin (kiểm đột biến: dời bullet sang trục khác thì pin đỏ).
- Hàng T7 giữ nguyên chữ của AC1.1; ý «AC chưa có test ở tầng ghép thì thêm một test, chỉ ghi khoảng trống khi không thêm được» nằm ở bullet «Tầng chạm data» của SKILL.md và mục con §4 của `react-testing-patterns.md`.
- Nhánh bắt đầu từ commit nền 36e5a52e (đã chứa `trial-design.md`, `trial-report.md` của phiên cha); hai file đó không phải của request này.

## Câu hỏi chốt ở G1

1. D1: bắt buộc (gate T7) hay khuyến nghị? Khuyến nghị: bắt buộc.
2. D2: giữ ở skill, không sửa hai agent? Khuyến nghị: giữ ở skill.
3. D3: không đổi `AGENTS.md`? Khuyến nghị: không đổi.
4. D4: không chạy eval thật ở request này? Khuyến nghị: không; mở request riêng nếu muốn đo.
5. D5: giữ pin 3 chuỗi hay bỏ theo chữ AGENTS.md? Khuyến nghị: giữ.
6. D6: severity `major` cho ca thông báo, `minor` cho AC hiển thị khác? Khuyến nghị: đồng ý.

Các mục D1–D8 đều là quyết định của agent, chưa phải của người dùng; D8 chỉ làm rõ sau một lượt builder check (đã chạy một lần, không chạy lại).
