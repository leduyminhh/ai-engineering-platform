# Brief: skill G7 quét project có sẵn rồi mô tả chi tiết (engineering-codebase-onboarding)
- Ngày: 2026-11-13
- Trạng thái: approved

## Vấn đề và loại việc

AIP chưa có skill nào quét một project đã có code rồi viết tài liệu mô tả nó. Một phiên làm việc ở repo khác (monorepo Java/Spring 12 module Maven, micro-frontend React, tool Node/Python) đã làm tay việc này: 6 subagent haiku quét song song, viết 27 README, một `env.template` và một file ghi chú bảo mật. Phiên đó rút ra kết luận từ bảng so sánh với AIP: G7 `engineering-codebase-onboarding` mới chỉ nằm ở Roadmap "chưa làm", còn `engineering-spec-backfill` và `engineering-repo-audit` đều chủ đích không đọc hết code.

Loại việc: thêm một skill vào bộ (nội dung capability của repo AIP, kèm vài script Node). Đây là việc của repo AIP, không phải việc của project đã được quét.

Điểm đặc biệt: skill này đọc nhiều code nhất trong bộ, nên rủi ro lớn nhất là in nhầm giá trị cấu hình hoặc bí mật ra output công cụ và trình bày phần chưa đọc như đã đọc.

## Vì sao bây giờ và thành công trông thế nào

Quy trình tay đã chạy được nên còn nhớ rõ chỗ hỏng: không có cổng duyệt danh sách module trước khi giao 6 agent, `grep` của agent in dòng cấu hình có giá trị ra log phiên, không có checker máy cho trích dẫn, và ba khẳng định trong brief hoá ra sai khi đối chiếu code. Làm thành skill ngay thì các bài học này vào được quy trình trước khi bị quên.

Thành công, đo được:

- Chạy trên một project mẫu ra README từng module và `project-knowledge/` (project-overview, architecture, source-structure, tech-stack) mà người đọc mới dùng được.
- `check-citations.mjs` thoát 0 trên mọi file sinh ra; quét secret trên các file Markdown sinh ra không khớp; `git status --porcelain` ngoài danh sách ghi được duyệt thì rỗng. Quét này không chứng minh log phiên sạch: việc chặn in giá trị cấu hình ở log dựa vào luật trong prompt subagent và công cụ đọc tên khoá (xem Quyết định của agent), và báo cáo cuối ghi đây là rủi ro còn lại.
- Hai script mới có test tự động trên fixture nhỏ trong repo AIP; nghiệm thu thật chạy tay trên một project do người dùng chỉ định sau, không nằm trong `npm test`.
- Báo cáo cuối nêu mỗi module đã đọc phần nào và chưa đọc phần nào.
- `npm test` xanh, routing không tụt dưới khoá ở `test/routing/rank1.lock.json`.

## Goal, non-goal, anti-goal

Goal (phạm vi G7, chốt với người dùng ở thẻ hỏi):

- Một skill `engineering-codebase-onboarding` trong plugin `engineering`.
- Đầu ra gồm cả hai: README từng module (bản chi tiết) và `project-knowledge/` tổng hợp từ README con.
- Mức đọc "có cấu trúc": bắt buộc đọc build file, entrypoint, route, tên khoá cấu hình; mở rộng theo ngân sách mỗi module; báo cáo ghi rõ đã đọc và chưa đọc.
- Phát hiện bảo mật đi vào một file riêng, chỉ có loại, `file:line` và nhãn proven hoặc suspected, không có giá trị; sau đó định tuyến sang `engineering-quality-gate`.
- Khung quy trình (rút từ phiên trước, [giả định] chờ xác nhận ở thẻ duyệt):
  1. Kiểm kê module từ build file, đưa danh sách qua cổng duyệt thứ nhất.
  2. Mỗi nhóm thư mục không chồng nhau giao một subagent viết README của nhóm.
  3. Tổng hợp README root và `project-knowledge/` từ README con, đối chiếu code.
  4. Quét secret trên đầu ra; prompt cấm in giá trị cấu hình.
  5. Kiểm trích dẫn `file:line` bằng `check-citations.mjs`, kiểm mẫu nội dung bằng một reviewer mới.
  6. Cổng duyệt diff thứ hai, rồi commit trên nhánh không protected; không push.

Non-goal:

- `workflow-onboarding` (để request sau nếu cần; người dùng chọn chỉ làm skill).
- Sửa `engineering-spec-backfill` hay `engineering-repo-audit`. G7 không ghi `docs/specs/`. Ngoại lệ duy nhất là nếu design chọn chuyển `check-citations.mjs` sang `core`; khi đó phải được người dùng duyệt riêng.
- Tự chạy `engineering-quality-gate` hay sửa lỗ hổng tìm thấy.
- Chạy build, test, docker của project được quét; render Mermaid.
- Cập nhật README khi code đổi về sau (G7 dựng lần đầu).
- Sửa project được quét ngoài README, `project-knowledge/` và file findings.

Anti-goal:

- Viết hay nói "đã đọc toàn bộ source".
- Chép giá trị cấu hình, mật khẩu, khoá, IP nội bộ vào README, brief, ledger hay output công cụ.
- Vẽ mũi tên liên kết giữa module chỉ vì thấy khai báo, khi chưa thấy lời gọi.
- Ghi đè README hay `project-knowledge/` có sẵn mà không hỏi.

## Hiện trạng và tham khảo đã thấy

Đã đọc (chỉ đọc):

- File tổng kết phiên trước (ngoài repo AIP): quy trình 9 bước, bảng so sánh với AIP, mục 7 trả lời "AIP chưa có", mục 8 đề xuất khung G7. Số đo ghi trong đó: 6 agent haiku, 375 lần gọi công cụ, khoảng 1,43 triệu token. `docs/security-findings.md` của project đó chỉ đọc để biết loại phát hiện: bí mật nằm trong git và source, xác thực/phân quyền yếu, endpoint thiếu xác thực, log chuỗi kết nối. Không chép giá trị nào.
- `README_VI.md:231` và `README.md:237`: dòng G7 ở Roadmap, kèm `workflow-onboarding` ở mục "Workflow tương lai".
- `plugins/engineering/skills/engineering-spec-backfill/SKILL.md`: hai cổng duyệt, subagent mỗi năng lực một con, kiểm cơ học `check-citations.mjs` và `check-request.mjs`, phạm vi ghi `git status --porcelain`. G7 nên theo khuôn này. `scripts/check-citations.mjs` kiểm file có thật và dòng nằm trong file, không kiểm câu có đúng với dòng được trích hay không.
- `plugins/engineering/skills/engineering-repo-audit/SKILL.md`: đọc theo ngân sách, nhãn proven/suspected, bảng định tuyến sang `engineering-quality-gate`.
- `plugins/backend/skills/backend-init/SKILL.md`: điền `project-knowledge/` từ câu trả lời, không quét; ERD dùng Mermaid. Mẫu `project-knowledge/` ở `core/skills/artifact-templates/references/project-knowledge/` (6 file).
- `workflows/orchestrator/WORKFLOW.md:60`: có dòng định tuyến "backfill spec" tới `engineering-spec-backfill`; chưa có dòng nào cho quét brownfield.
- `CLAUDE.md`, `AGENTS.md` và skill dự án `aip-add-content` (`.claude/skills/aip-add-content/SKILL.md`): source là `plugins/`, `core/`, `workflows/`; `build/` bị `.gitignore` nên không sửa ở đó. `plugins/_published.json` publish cả plugin `engineering`, nên skill mới trong plugin này được wizard chào ngay, không có bước draft.

Chưa xem:

- `engineering-diagram` (chỉ biết mô tả; hướng chọn là Mermaid như `backend-init`, chưa cần đọc kỹ).
- `frontend-init`, ngoài mô tả.
- `core/skills/brainstorming/scripts/route.mjs` chạy thật trên brief này (chạy ở bước định tuyến).
- Các skill draft `data-*`.

## Hướng đã cân nhắc

- **A (chọn). Skill mới `engineering-codebase-onboarding` theo khuôn `engineering-spec-backfill`.** Hai cổng duyệt, subagent mỗi nhóm thư mục, kiểm cơ học. Thêm một script kiểm kê module từ build file và một script quét secret trên đầu ra. Đánh đổi: thêm một skill nữa vào `engineering` (14 → 15) có thể làm routing tranh với `spec-backfill` và `repo-audit`, cần mô tả tách bạch và chạy lại `routing-score.mjs`.
- **B (loại). Mở rộng `engineering-spec-backfill`.** Không tạo skill mới. Loại vì ranh giới an toàn của nó là "chỉ ghi dưới `docs/specs/`" và đầu ra là spec theo năng lực nghiệp vụ, còn G7 ghi README theo module và `project-knowledge/`; trộn hai đầu ra làm skill khó kích hoạt đúng.
- **C (loại). Không làm skill, chạy `spec-backfill` rồi `repo-audit` nối tiếp.** Loại vì không có bước kiểm kê module từ build file, không ra README, và không có luật chặn in giá trị cấu hình, đúng ba chỗ phiên trước vấp.

## Quyết định của agent

- Lưu brief ở `docs/requests/2026-11-13-codebase-onboarding-skill/` của repo AIP.
- Giữ tên theo Roadmap (`engineering-codebase-onboarding`). Chữ "onboarding" cũng xuất hiện ở `templates/init/CLAUDE.md:50` với nghĩa khác (cài AIP cho người mới clone), nên mô tả skill phải nói rõ là quét code để viết tài liệu.
- Model subagent viết README: `sonnet`, vì phải suy liên kết từ code. Bước máy (đếm, quét secret) chạy bằng script, không cần agent.
- File findings đặt ở `.aip/runs/onboarding-<slug>/security-findings.md`, git bỏ qua, không commit mặc định. Lý do: một file liệt kê chỗ yếu của hệ thống không nên vào lịch sử git nếu người dùng chưa chủ động chọn.
- README đã có sẵn: không ghi đè. Bảng ở cổng 1 có cột "README hiện có" với ba lựa chọn giữ, cập nhật trong khối giới hạn bởi marker, hoặc bỏ module đó.
- Khẳng định cần `file:line`: mũi tên liên kết giữa module (phân biệt "có lời gọi" và "chỉ khai báo"), số liệu cụ thể (port, version, tên biến). Mô tả chung chung ghi "suy từ tên" hoặc `[Unverified]`. Không đòi `file:line` cho mọi câu.
- Hai cổng duyệt, giống `spec-backfill`: danh sách module trước khi tạo subagent, diff trước khi commit. Commit `docs(onboarding): …` trên nhánh không protected, không push.
- Hai script mới nằm trong thư mục skill: kiểm kê module từ build file (Maven, Gradle, npm workspaces, Python), và quét secret trên các file Markdown vừa sinh. Zero-dep, theo quy ước repo. Chi tiết ở design.
- Không đọc `.env`. Tên khoá cấu hình lấy từ file mẫu hoặc `application*.yml` bằng lệnh chỉ in tên khoá.
- Phạm vi gắn `không-code` theo cách các brief trước của repo làm, vì đầu ra chính là nội dung skill (Markdown); việc viết hai script Node vẫn nằm trong phạm vi.
- Văn bản hướng người đọc viết tiếng Việt có dấu, theo `engineering-writing-style`.
- Chặn in giá trị cấu hình: subagent chỉ đọc cấu hình qua lệnh hoặc script in tên khoá (ví dụ `grep -o`, hoặc một script trong skill), cấm lệnh in dòng nguyên của file cấu hình. Script quét secret chạy trên Markdown sinh ra. Không có cơ chế nào kiểm được log phiên sau khi lệnh đã chạy, nên đây là rủi ro còn lại, báo ở cuối mỗi lần chạy.
- Hai script có test (theo `AGENTS.md`, mục Testing). Kind của task trong plan là TOOLING, có `**TDD:**` cho phần logic của script; việc viết `SKILL.md` và references là task docs. `không-code` chỉ mô tả đầu ra chính, không bỏ test của script.
- `check-citations.mjs`: mặc định G7 trỏ tới script của skill anh em trong cùng plugin `engineering` (wizard chào cả plugin), không sửa `spec-backfill`. Cài lẻ từng skill có thể thiếu script, ghi là rủi ro; nếu design chọn chuyển sang `core` thì thành ngoại lệ ở Non-goal và cần người dùng duyệt.
- Nghiệm thu: test tự động trên fixture nhỏ cho hai script; chạy thật tay trên một project người dùng chỉ định, chưa chọn.
- Ranh giới ghi ở project đích: README mỗi module và README root trong danh sách đã duyệt ở cổng 1; `project-knowledge/` ở gốc project (như `backend-init`), chỉ ghi `project-overview.md`, `architecture.md`, `source-structure.md`, `tech-stack.yml`; hai file còn lại (`domain-context.md`, `code-convention.md`) không động vì code không trả lời được. File findings ở `.aip/runs/onboarding-<slug>/` của project đích, kèm `.aip/.gitignore` chứa `*` nếu chưa có (cách `brainstorming` đã làm). Phạm vi ghi kiểm bằng `git status --porcelain` so với danh sách này.
- Subagent dùng `general-purpose` do skill tự giao, như `spec-backfill`; không thêm file agent trong `plugins/engineering/agents/`. Không có `writeScope` nên khoá phạm vi dựa vào prompt và kiểm `changes` sau mỗi con, cộng kiểm `git status` ở cuối.

## Phần đoán

- [giả định] Người đọc README là dev mới vào team. Câu mở về tình huống dùng, cỡ project lớn nhất và việc có phải chạy trên project không phải Java/React chưa được trả lời.
- [giả định] Hỗ trợ kiểm kê ban đầu cho Maven, Gradle, npm/pnpm workspaces và Python (`pyproject.toml`, `requirements.txt`); stack khác thì kiểm kê tay qua cổng 1.
- [giả định] Ngân sách đọc mỗi subagent và cách chia module lớn chỉ có số liệu phiên trước (khoảng 60 lần gọi công cụ, 240 nghìn token mỗi agent) làm tham chiếu; con số thật chốt ở design.
- [giả định] Đọc có cấu trúc đủ để README đáng tin. Phiên trước vẫn lọt ba khẳng định sai ở brief dù đã quét; chưa có số đo sai lệch của cách đọc có cấu trúc.
- [giả định] Mermaid render được ở nơi đọc README (như `backend-init` đã dùng); chưa kiểm.
- [Unverified] Trạng thái skill draft `data-*` và tương tác của skill mới với `npm run overlap`.

Câu hỏi mở chuyển cho design:

1. `check-citations.mjs` đang nằm trong `engineering-spec-backfill`: G7 phụ thuộc skill anh em, chuyển script sang `core/skills/artifact-templates/scripts/`, hay dùng cơ chế `sharedAssets`? Cài từng skill riêng lẻ có thể thiếu script.
2. File findings để ở `.aip/` (mặc định, không commit) hay `docs/` (người dùng chủ động commit)?
3. Ngân sách đọc mỗi subagent bằng bao nhiêu, và module vượt ngân sách chia nhóm con thế nào?
4. Khi `project-knowledge/` đã có (từ `backend-init`), G7 chỉ đề xuất diff hay cũng chỉ ghi vào phần trống?
5. Có thêm eval thật cho skill này không (tốn tiền model, chạy tay theo `evals/README.md`)?
6. Skill mới có đẩy routing của `spec-backfill` và `repo-audit` tụt không; cần kiểm bằng `scripts/routing-score.mjs` trước khi khoá.

## Định tuyến
loại-việc: feature
phạm-vi: không-code
đầu-ra-mong-đợi: skill engineering-codebase-onboarding (SKILL.md, references, hai script) quét một project có sẵn và sinh README từng module, project-knowledge/ và file ghi chú bảo mật riêng, qua hai cổng duyệt của người dùng
rủi-ro: in nhầm giá trị cấu hình hoặc bí mật ra output công cụ khi quét; README trình bày phần chưa đọc như đã đọc; skill mới làm routing của spec-backfill và repo-audit tụt hạng
ứng-viên-route: []
route-đã-duyệt: chưa-có-quy-trình
