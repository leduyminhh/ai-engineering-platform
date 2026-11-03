# Thiết kế: rút gọn baseline AGENTS.template.md xuống ≤ 200 dòng
- Ngày: 2026-11-03
- Trạng thái: merged 41c54e49
- Requirement: không có
## Vấn đề và lý do
`core/agents/AGENTS.template.md` dài 324 dòng (đo bằng `wc -l`, khớp `AGENTS.md` gốc repo). Khối giữa marker `AI-ENGINEERING:BEGIN/END` được chiếu vào `AGENTS.md`/`CLAUDE.md` của mọi project đích, dùng chung cho Claude, Codex, Cursor, Antigravity. Người dùng dẫn docs Claude Code khuyến nghị "target under 200 lines per CLAUDE.md file; longer files consume more context and reduce adherence" [Unverified — trích lại từ người dùng, chưa tự kiểm với docs]. Repo này vừa import `AGENTS.md` vào `CLAUDE.md` (commit `031aca28`), nên cả 324 dòng nằm trong context mỗi phiên.

Số đo hiện tại (đọc file, dòng của `AGENTS.template.md`):

| Phần | Dòng | Số dòng |
|---|---|---|
| Đầu file + Priority … Workflow defaults (giữ) | 1–159 | 159 |
| `#### Docs location and format` + `#### Memory and resume` | 160–201 | 42 |
| `### Agents in CI` | 203–210 | 8 |
| `### Parallel agents` | 212–223 | 12 |
| `### Model and session routing` | 225–308 | 84 |
| `### Language` + `### Definition of Done` (giữ) | 310–324 | 15 |

Bốn phần chuyển đi cộng khoảng cách chiếm 150 dòng, đều là hướng dẫn tình huống (khi viết docs, khi chạy CI, khi chạy song song, khi điều phối phiên) chứ không phải quy tắc áp cho mọi tác vụ.

## Quyết định đã chốt
Người dùng chốt (session chính, 2026-11-03):
1. **Đích:** chuyển nội dung ra `references/` của skill core (chạy trên cả 4 provider; mỗi dòng trỏ nêu tên skill + đường dẫn reference).
2. **Ngưỡng:** cả file `core/agents/AGENTS.template.md` ≤ 200 dòng, khoá bằng contract test. `AGENTS.md` của repo giữ byte-identical với template.
3. **Các mục khác giữ nguyên nội dung** (Priority, Rules, Comments, Testing, Safety, Command routing, Workflow defaults, Language, Definition of Done): không viết lại.

Hướng đã cân nhắc:

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A. Chuyển ra `references/` của skill core, baseline giữ bản rút gọn + dòng trỏ | 4 file reference mới; baseline còn bảng tier + quy tắc cốt lõi + con trỏ | Agent phải nạp skill/đọc file để thấy chi tiết (xem Rủi ro); nội dung giữ nguyên, ship qua cơ chế `references/` sẵn có tới cả 4 provider | **Chọn** (người dùng chốt) |
| B. `.claude/rules/*.md` có `paths:` | Rule nạp theo glob | Chỉ Claude Code đọc; Codex, Cursor, Antigravity mất nội dung; ngoài cơ chế `references/` của aip | Loại |
| C. Xoá hẳn | Bỏ 4 mục | Mất quy tắc an toàn và vận hành đã được pin (CI: `--permission-mode dontAsk`, `--max-budget-usd`; song song: miền ghi không giao nhau) | Loại |
| D. Nén văn bản tại chỗ, không chuyển (hướng do agent thêm) | Viết lại cho ngắn | Cần cắt ≥ 124 dòng (38%) nên phải viết lại cả mục người dùng yêu cầu giữ nguyên; rủi ro làm lệch ngữ nghĩa các chuỗi đã pin | Loại (quyết định của agent, chờ G1) |

**Quyết định của agent (người dùng duyệt ở G1):** chấm điểm mức "áp cho mọi phiên" và phân bổ như sau.

| Mục | Điểm /10 | Xử lý |
|---|---|---|
| Model and session routing | 6 | Giữ bản rút gọn trong baseline: bảng tier 5 hàng + 4 quy tắc cốt lõi + 1 dòng trỏ; chi tiết → `core/skills/plan-execution/references/model-routing.md` |
| Docs location and format + Memory and resume | 3 | Giữ 3 bullet + 1 dòng trỏ; còn lại → `core/skills/artifact-templates/references/docs-conventions.md` |
| Agents in CI | 3 | 1 dòng trỏ; nội dung → `core/skills/using-aip/references/agents-in-ci.md` |
| Parallel agents | 2 | 1 dòng trỏ; nội dung → `core/skills/git-worktree/references/parallel-agents.md` |

## Tiêu chí chấp nhận
Đo số dòng: văn bản đã chuẩn hoá `\r\n` → `\n`, số ký tự `\n` (khớp `wc -l`).

- [ ] **AC1.1** — Given `core/agents/AGENTS.template.md` sau thay đổi When đếm số dòng Then ≤ 200.
- [ ] **AC1.2** — Given contract test giới hạn dòng When chạy với nội dung template thật Then pass; When chạy với nội dung giả 201 dòng Then đỏ kèm số dòng đo được (ca âm tính nằm trong test, không sửa file thật).
- [ ] **AC1.3** — Given `AGENTS.md` ở gốc repo When `cmp AGENTS.md core/agents/AGENTS.template.md` Then exit 0; contract `30-templates` (drift guard) và pin `33-request-parts` (`rd('AGENTS.md') === tpl`) pass.
- [ ] **AC1.4** — Given template When trích khối giữa marker Then có đúng một cặp `<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->` / `<!-- AI-ENGINEERING:END AGENTS_BASELINE -->` và `test/managed-block.test.mjs` pass.
- [ ] **AC2.1** — Given `core/skills/artifact-templates/references/docs-conventions.md` When đối chiếu với `AGENTS.template.md` trước thay đổi (dòng 160–201 của commit `031aca28`) Then chứa đủ các chuỗi then chốt: `docs/specs/<capability>/spec.md`, `Ảnh hưởng spec`, `Tiêu chí chấp nhận`, `**Phủ AC:**`, `ac1_2`, `- Test:`, `--strict`, `check-request.mjs`, `W9`, `W7`, `W10`, `parts/<nn>-<part-slug>/plan.md`, `_TEMPLATE`, `| Short-term |`, `| Long-term |`, `first task with no `complete` line`; và baseline còn đúng 3 bullet nội dung (đường dẫn spec + plan, làm tiếp change đã có folder, tri thức dài hạn chỉ đề xuất) cộng 1 dòng trỏ.
- [ ] **AC2.2** — Given `core/skills/plan-execution/references/model-routing.md` When đối chiếu với dòng 225–308 trước thay đổi Then chứa đủ chuỗi then chốt: bảng tier đầy đủ, `effort`, `medium`, `high`, `/clear`, `/compact`, `15 minutes`, `acknowledg`, `statusline`, `/usage`, `foreground`, `cheaper to replace than`, `[Inference]`, `[Unverified]`, bốn URL nguồn (`code.claude.com/docs/en/prompt-caching`, `…/sub-agents`, `…/costs`, `anthropic.com/engineering/multi-agent-research-system`); và baseline giữ bảng 5 hàng + 4 quy tắc cốt lõi + 1 dòng trỏ, con số ~40%/~60% mang nhãn `[Inference]`.
- [ ] **AC2.3** — Given `core/skills/using-aip/references/agents-in-ci.md` When đối chiếu với dòng 203–210 trước thay đổi Then chứa `claude -p`, `--permission-mode dontAsk`, `--allowedTools`, `--max-turns`, `--max-budget-usd`, `--bare`, `commit SHA`, `read-only`, `required reviewers`, `[Unverified]`.
- [ ] **AC2.4** — Given `core/skills/git-worktree/references/parallel-agents.md` When đối chiếu với dòng 212–223 trước thay đổi Then chứa `worktree-<slug>-p<nn>`, `.claude/worktrees/<slug>-p<nn>/`, `merge --no-ff`, `integration branch`, `check-partition.mjs`, `After each part merge`, `shared-file step`, `3 agents`, `disjoint`, `rm -rf`, `junction`, `autonomy.partRunner`, và không chứa `t<n>` hay `**Song song:**`.
- [ ] **AC2.5** — Given mỗi mục chuyển đi When đọc baseline Then có đúng một dòng trỏ (bullet) nêu tên skill dạng `skill `<tên>`` + đường dẫn `references/<file>.md`; contract mới phân tích các dòng trỏ và xác nhận file tồn tại ở `core/skills/<tên>/references/<file>.md` (nguồn) và ở mỗi build (`claude`, `codex`, `cursor`, `antigravity`) sau `npm run build`.
- [ ] **AC3.1** — Given danh sách chuỗi then chốt của các pin cũ (bảng "Ánh xạ pin" ở Thiết kế) When so pin mới với pin cũ Then mỗi chuỗi được assert đúng ở nơi nội dung đang nằm (baseline hoặc reference), không chuỗi nào bị bỏ; pin về an toàn của CI (`23`) và song song (`25`, `32`, `33`) vẫn kiểm đủ các chuỗi `--permission-mode dontAsk`, `--max-budget-usd`, `disjoint`, `rm -rf`, `junction`.
- [ ] **AC3.2** — Given các pin dùng mốc heading của baseline (`31` cắt `### Workflow defaults` → `### Agents in CI`; `18`, `19` cắt tới `### Language`; `20`, `21` cắt từ `### Model and session routing`) When baseline đổi bố cục Then mốc vẫn tồn tại hoặc pin được sửa cùng commit, không pin nào pass vì lát cắt rỗng.
- [ ] **AC4.1** — Given 4 `SKILL.md` (`plan-execution`, `artifact-templates`, `using-aip`, `git-worktree`) When đọc Then mỗi file có link `[references/<file>.md](references/<file>.md)` tới reference mới trong mục Tham chiếu/Bản đồ tài liệu (`using-aip`, `git-worktree` chưa có mục này nên thêm một mục ngắn); contract `10-source` (link tồn tại, mỗi `.md` cấp đầu của `references/` được `SKILL.md` trỏ tới) pass.
- [ ] **AC4.2** — Given `README.md`, `README_VI.md`, `CLAUDE.md`, `core/skills/git-workflow/SKILL.md`, `core/skills/git-worktree/SKILL.md` When `grep` cụm "baseline section `Agents in CI`", "baseline section `Parallel agents`", "mục baseline `Agents in CI`/`Parallel agents`", "quy ước `Parallel agents` của baseline" Then 0 kết quả; các chỗ đó trỏ tới reference mới; pin `23` (AC3.2) và `25` (AC1.2) pass.
- [ ] **AC5.1** — Given `core/.manifest.json` When so với master Then `version` lớn hơn `1.26.15` và `node cli/lib/versions.mjs --lock` đã chạy, `plugins/_versions.lock.json` khớp build.
- [ ] **AC5.2** — Given nhánh `feature/baseline-slim` sau mọi task When `npm test` Then exit 0.
- [ ] **AC5.3** — Given bước gộp spec When đọc `docs/specs/baseline/spec.md` và `docs/specs/artifact-templates/spec.md` Then khớp mục "Ảnh hưởng spec" bên dưới và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-03-baseline-slim/ --base master` không còn W10–W14.

## Thiết kế
### Ngân sách dòng
Phần giữ nguyên chiếm 159 + 15 = 174 dòng, còn 26 dòng cho phần mới. Đã dựng bản nháp trong thư mục scratchpad (ngoài repo) để đo thay vì ước lượng: cách trình bày đơn giản nhất (mỗi mục một heading, có dòng trống) cho 203 dòng, vượt 3. Ba đòn bẩy, chỉ tác động lên phần mới:
- L1: gộp hai mục trỏ dưới một heading `### Agents in CI and Parallel agents`, mỗi mục một bullet (−1 dòng).
- L2: gộp bullet "tri thức dài hạn" vào bullet trỏ của Docs (−1 dòng).
- L3: không có dòng trống giữa heading `### Model and session routing` và bảng (−1 dòng).

`calc: 159 + 26 + 15 = 200`. Bản nháp áp cả ba đòn bẩy đo được 200 dòng, tức không còn dư địa. Nếu khi viết thật vẫn > 200, builder rút chữ trong chính 4 phần mới trước; hết cách thì dừng và báo G1 (xem câu hỏi mở), không tự cắt phần "giữ nguyên".

### Bố cục baseline mới (từ dòng 160)
- `#### Docs location and format`: 3 bullet (spec ở `docs/requests/<yyyy-mm-dd>-<slug>/design.md` kèm skill `engineering-spec-writing`, plan ở `plan.md` cùng folder kèm skill `engineering-plan-writing`; làm tiếp change đã có folder thì đọc `design.md`, `plan.md`, ledger `.aip/runs/<request>/<part>/progress.md`, không tạo folder/design/plan thứ hai; tri thức dài hạn chỉ đề xuất, người duyệt cập nhật) + 1 dòng trỏ tới `skill `artifact-templates`, `references/docs-conventions.md``. Giữ nguyên các chuỗi mà pin `18`, `31`, `33` còn đọc ở baseline (`docs/requests/<yyyy-mm-dd>-<slug>/design.md`, `` `plan.md` in the same folder ``, `skill `engineering-spec-writing``, `skill `engineering-plan-writing``, `never create a second folder`, `.aip/runs/<request>/<part>/progress.md`).
- `### Agents in CI and Parallel agents` (hoặc hai heading riêng nếu còn dòng): hai bullet trỏ, mỗi bullet một skill + path (`using-aip` → `references/agents-in-ci.md`; `git-worktree` → `references/parallel-agents.md`).
- `### Model and session routing`: bảng tier 5 hàng (rút chữ ở cột Work và Default model, giữ tên model) + 4 bullet: (1) chọn model + effort lúc tạo phiên/subagent, không đổi model của phiên đã có context, đổi thì bàn giao sang phiên mới; (2) một phiên một gói việc, xong hoặc context ~40% mềm / ~60% cứng `[Inference]` thì ghi `handoff.md` và mở phiên mới; (3) không gửi tin chỉ để báo/hỏi thăm, phiên con chỉ báo khi xong, bị chặn, hoặc cần người quyết; (4) song song chỉ khi các task độc lập về file, bước kế phụ thuộc kết quả subagent thì chạy foreground; + 1 dòng trỏ tới `skill `plan-execution`, `references/model-routing.md``. Dòng ghi chú "(Claude Code. Other tools: …)" gộp vào bullet (1).

Văn bản trong reference giữ nguyên chữ của template cũ (chép nguyên, thêm tiêu đề H1 và một câu mở đầu nêu nguồn là baseline); không rút gọn, để đối chiếu chuỗi ở AC2.x. Reference viết bằng tiếng Anh như baseline.

### Điểm chạm
- Tạo mới 4 reference (đường dẫn ở bảng trên). `using-aip` và `git-worktree` hiện chưa có thư mục `references/`; `assets` tự nhận thư mục này (`loadSkills` trong `cli/lib/plugins.mjs`), contract `20-build` (parity `references/`) tự áp cho hai skill này.
- Sửa `core/agents/AGENTS.template.md` và `AGENTS.md` (byte-identical).
- `SKILL.md` của 4 skill: thêm link reference mới (AC4.1).
- Tài liệu nhắc mục bị chuyển (tìm bằng `grep`): `README.md:382`, `README.md:398`, `README_VI.md:375`, `README_VI.md:391`, `CLAUDE.md:73` (mục **Parallel agents** — giữ các từ `check-partition.mjs`, `Parallel agents`, `worktree-<slug>-p<nn>` mà pin `25` đọc), `core/skills/git-workflow/SKILL.md:29`, `core/skills/git-worktree/SKILL.md:17` và `:75` ("theo heuristic của baseline"). `description`/`title` của `git-worktree` (dòng 3, 5) nói "quy ước baseline": nếu sửa phải theo giới hạn ≤ 500 ký tự của `cli/lib/conventions.mjs`; builder quyết có sửa hay không.
- `core/hooks/scripts/guard-mcp.mjs:36` nhắc mục "Model and session routing" của baseline: vẫn đúng vì heading và hàng `sonnet` của bảng ở lại baseline; không sửa.

### Ánh xạ pin (danh sách chuỗi phải còn được kiểm; đường dẫn thật, tìm bằng `grep`)
| Pin | Chuỗi đang đọc từ template | Nơi mới |
|---|---|---|
| `test/content/18-superpowers-docs-standard.pin.mjs` (dòng 76–88, lát cắt `### Workflow defaults` → `### Language`) | `docs/requests/<yyyy-mm-dd>-<slug>/design.md`, `plan.md in the same folder`, tên 2 skill, `never create a second folder` | baseline |
| cùng file | `AC<n>.<m>`, `Given/When/Then`, `Tiêu chí chấp nhận`, `requirement.md if it exists, otherwise in`, `**Phủ AC:**`, `Không đổi`, `| Short-term |`, `| Long-term |`, `first task with no complete line`, `only when it contains design.md`, `artifact-templates`, `check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/` | `docs-conventions.md` |
| `test/content/19-verification-gate.pin.mjs` (dòng 5–11) | `ac1_2`, `- Test:`, `--strict` | `docs-conventions.md` |
| `test/content/20-model-session-routing.pin.mjs` | `haiku`, `sonnet`, `opus`, `new session` | baseline (mốc `### Model and session routing` còn) |
| cùng file | `/clear`, `/compact`, `15 minutes`, `acknowledg`, `effort`/`medium`/`high`, 4 URL nguồn | `model-routing.md` |
| `test/content/21-long-session-context.pin.mjs` | `handoff.md`, `foreground`, nhãn `[Inference]` của con số | baseline |
| cùng file | `1 hour`, `statusline` + `hook` + `cannot`, `sends the parent one line`, `bounds its output`, `instead of ending the turn`, `cheaper to replace than`, `open a new session from `handoff.md``, `Record each session`, `/usage`, `[Unverified]`, URL prompt-caching | `model-routing.md` |
| `test/content/22-living-spec.pin.mjs` (dòng 5–21) | `docs/specs/<capability>/spec.md`, `Ảnh hưởng spec`, `history table`, `docs/specs/README.md`, `check-request.mjs`, `--base <ref>`, thứ tự trước `before finishing the branch`, `Không ảnh hưởng: <reason>`, `_TEMPLATE/design.md`, `(W10)`, dòng `| Long-term |` có `docs/specs/` | `docs-conventions.md` (mốc `#### Docs location and format`/`#### Memory and resume` đổi thành mốc trong file mới) |
| `test/content/23-agent-permissions.pin.mjs` (dòng 7–17) | cờ CI, thứ tự CI trước Model routing | `agents-in-ci.md`; baseline: dòng trỏ nằm trước mục routing |
| `test/content/25-parallel-agents-docs.pin.mjs` (dòng 7–15) | tên nhánh, thư mục worktree, `merge --no-ff`, `integration branch`, `3 agents`, `disjoint`, `rm -rf`, `junction`, `once`, thứ tự giữa CI và routing | `parallel-agents.md`; baseline: dòng trỏ |
| `test/content/31-workflow-self-sufficient.pin.mjs` (dòng 719–731) | lát cắt `### Workflow defaults` → `### Agents in CI`, `.aip/runs/<request>/<part>/progress.md`, `Keep the branch as-is` | baseline (mốc `### Agents in CI` còn, kể cả khi gộp heading) |
| `test/content/32-superpowers-gap.pin.mjs` (dòng 169–176, AC4.1) | `worktree-<slug>-p<nn>`, `.claude/worktrees/<slug>-p<nn>/` | `parallel-agents.md` |
| `test/content/33-request-parts.pin.mjs` (dòng 385–415) | `.aip/runs/<request>/<part>/progress.md` và không `.sdd` | baseline (giữ) + `docs-conventions.md` (thêm kiểm không `.sdd`) |
| cùng file | `parts/<nn>-<part-slug>/plan.md`; `only between parts, never inside a part`, `check-partition.mjs`, `After each part merge`, `shared-file step` đứng trước `full suites`; không `t<n>`, không `**Song song:**` | `docs-conventions.md` / `parallel-agents.md`; kiểm `t<n>`, `**Song song:**` mở rộng sang cả 4 reference |
| `test/content/29-permission-modes-docs.pin.mjs`, `test/contract/30-templates.contract.mjs`, `test/managed-block.test.mjs` | bullet Safety `full`; drift guard; marker | không đổi (mục Safety, marker giữ nguyên) |

`18` đã dùng tên `Workflow defaults`/`Language` làm mốc cắt; `31` dùng `### Agents in CI`. Các pin `20`, `21` đọc mục routing tới `\n### ` kế tiếp: sau khi rút gọn, lát cắt này chỉ còn phần baseline, nên các chuỗi đã chuyển phải đổi sang đọc `model-routing.md`, nếu không `ok` sẽ đỏ (đúng hành vi mong muốn, nhưng phải sửa cùng commit).

### Spec sống
`docs/specs/baseline/spec.md`: R2, R3 (phần Docs/Memory chuyển sang reference, baseline giữ 3 bullet + trỏ), R4 (Agents in CI), R6 (Parallel agents), R7 (routing rút gọn) đổi; thêm R9: template ≤ 200 dòng, khoá bằng contract, mỗi mục chuyển có dòng trỏ skill + reference. `docs/specs/artifact-templates/spec.md`: thêm R14 (`references/docs-conventions.md` là nguồn chi tiết của quy ước docs, được mục lục trỏ tới). Khi gộp, ghi dòng vào bảng Lịch sử mỗi spec.

### Phát hành
Bump `core/.manifest.json` (từ `1.26.15`; số cụ thể do builder chọn, [giả định] tăng minor vì đổi bố cục baseline), rồi `node cli/lib/versions.mjs --lock` sau `npm run build`. Project đích đã cài bản cũ chạy `aip update` (hoặc cài lại) để cập nhật khối baseline và các skill core cùng lúc.

## Ảnh hưởng spec
- baseline: đổi R2, đổi R3, đổi R4, đổi R6, đổi R7, thêm R9
- artifact-templates: thêm R14
## Ngoài phạm vi và anti-goal
- Không viết lại Priority, Rules, Comments, Testing, Safety, Command routing, Workflow defaults, Language, Definition of Done.
- Không đổi hành vi `install`/`managed-block`/`aip init`, hook, validator `check-request.mjs`/`check-partition.mjs`, nội dung README ngoài các câu trỏ.
- Không thêm `.claude/rules`, không thêm cơ chế nạp reference tự động (hook inject) cho phần đã chuyển.
- Không sửa ADR `0002`, `0003` (Accepted; vị trí nội dung đổi, quyết định giữ nguyên).
- Không rút gọn thêm các section khác nếu 4 phần mới vẫn không đủ chỗ: dừng và hỏi.
## Ràng buộc
- Baseline và reference viết tiếng Anh (như baseline hiện tại); tài liệu request tiếng Việt có dấu.
- `AGENTS.md` giữ byte-identical với template; UTF-8 không BOM, LF.
- Mỗi chuỗi trong pin cũ phải còn được assert (AC3.1); không xoá kiểm tra an toàn (CI, song song, Safety).
- Tên file trong `references/` không trùng giữa các skill cùng plugin (contract `10-source`): `model-routing.md`, `docs-conventions.md`, `agents-in-ci.md`, `parallel-agents.md` hiện không trùng file nào trong `core`.
- Zero dependency, Node 20; mỗi task một commit trên `feature/baseline-slim`, không push, không merge.
## Không đổi
- Nội dung các section giữ lại (đầu file, Priority, Rules, Comments, Testing, Safety kể cả bullet chế độ `full`, Command routing, Workflow defaults, Language, Definition of Done).
- Marker managed block, vùng giữa marker vẫn do `cli/lib/install.mjs` trích từ template; hành vi `install`/`uninstall`/`update`, `cli/lib/managed-block.mjs`, `aip init` giữ nguyên.
- Quy tắc `guard-mcp` (message vẫn trỏ đúng mục "Model and session routing" và mặc định `sonnet`).
- Nội dung quy ước docs, CI, song song, routing: chỉ đổi nơi đặt, không đổi chữ trong reference.
- `README.md`/`README_VI.md` giữ nguyên các đoạn CI/song song riêng của chúng (pin `23` AC3.2, `25` AC1.2 đọc các đoạn này).
## Kiểm thử
- Contract mới (đề xuất đặt trong `test/contract/30-templates.contract.mjs`, cạnh drift guard): AC1.1, AC1.2 (kèm ca âm tính 201 dòng), AC1.4, AC2.5 (dòng trỏ → file nguồn tồn tại).
- Contract có sẵn: `10-source` (AC4.1), `20-build` (parity `references/` cho `using-aip`, `git-worktree`; AC2.5 phần build), `30-templates` (AC1.3), `managed-block.test.mjs` (AC1.4).
- Pin `test/content/18, 19, 20, 21, 22, 23, 25, 31, 32, 33` (AC2.1–AC2.4, AC3.1, AC3.2, AC4.2), sửa theo bảng Ánh xạ pin.
- `npm test` (AC5.2), `node cli/lib/versions.mjs --lock` (AC5.1), `check-request.mjs … --base master` ở bước gộp spec (AC5.3).
- Không viết test mới cho nội dung văn xuôi của reference ngoài các chuỗi đã pin (AGENTS.md mục Testing: không pin văn xuôi trừ hợp đồng vận hành).
## Để builder quyết
Chọn gộp hay tách heading CI/Parallel; chữ cụ thể của dòng trỏ và 4 bullet routing; cách viết hàm đếm dòng và ca âm tính; chỗ đặt pin mới cho `docs-conventions.md` (file pin sẵn có hay file mới); số phiên bản core; có sửa `description`/`title` của `git-worktree` hay không.
## Rủi ro và câu hỏi mở
Rủi ro:
- Agent bỏ sót nội dung đã chuyển vì không nạp skill (Codex/Cursor chỉ thấy `description` của skill, không tự mở `references/`). Giảm bằng dòng trỏ nêu tên skill + path ngay trong baseline; không đo được mức bỏ sót khi chưa chạy eval [Unverified].
- Project đích đã cài bản cũ: khối baseline cũ (324 dòng) và skill core cũ không có reference mới; phải `aip update`. Chỉ cập nhật một nửa (khối mới, skill cũ) thì dòng trỏ trỏ vào file chưa có. Cache plugin Claude theo version nên bắt buộc bump core.
- Zero dư địa dòng (200/200): mọi thêm dòng sau này vào baseline đỏ contract; chủ đích, nhưng các request khác sửa `AGENTS.template.md` phải tự nhường chỗ.
- Xung đột với request `2026-11-03-execution-mode-choice` (draft): AC6.1 của request đó sửa `AGENTS.template.md:152` (giữ) và `:220` (bullet `autonomy.partRunner` thuộc Parallel agents, sẽ nằm ở `parallel-agents.md` sau request này); cả hai cùng sửa spec `baseline` (R6, R8) và cùng bump core. Merge sau phải đối chiếu lại vị trí câu "not asked when `autonomy.partRunner`".
- Pin cũ trượt vì lát cắt rỗng: `indexOf` trả -1 thì `slice` ra chuỗi sai nhưng không ném lỗi; AC3.2 yêu cầu soát từng mốc.
- ADR `0002`, `0003` mô tả mục routing nằm trong baseline; ghi chú vị trí mới là việc của người giữ ADR, ngoài phạm vi.

[giả định] cần người xác nhận:
1. Chuẩn đếm dòng là số `\n` sau chuẩn hoá xuống dòng (khớp `wc -l`), tính cả 6 dòng đầu file ngoài marker.
2. Gộp hai mục trỏ dưới một heading là chấp nhận được để đủ 200 dòng; nếu muốn giữ hai heading riêng thì phải cắt thêm 1 dòng ở phần mới.
3. 3 bullet Docs/Memory ở baseline gồm đúng ba ý nêu trong Thiết kế (người dùng mô tả "~3 dòng", chưa duyệt chữ).
4. Core luôn được cài cùng plugin khác (domain plugin kéo core qua dependency, theo chú thích trong `cli/lib/install.mjs`), nên reference nằm trong skill core tới được project đích; chưa kiểm trên Codex/Cursor.
5. Chuỗi docs Claude Code "target under 200 lines per CLAUDE.md file" đã đối chiếu tại https://code.claude.com/docs/en/memory (2026-11-03).
6. Số phiên bản core tăng minor.

Câu hỏi đã chốt ở G1:
- Bản viết thật vẫn > 200 sau L1–L3: builder rút chữ cột Work của bảng tier hoặc gộp 4 bullet routing, giữ đủ 5 hàng; không đụng mục "giữ nguyên"; không dừng hỏi lại.
