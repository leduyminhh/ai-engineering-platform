# Thiết kế: điều hướng model, phiên và subagent
- Ngày: 2026-10-21
- Trạng thái: **Đã duyệt và thực thi** — merge vào `master` = `4cb06ab` (2026-10-21).
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P5a (xu hướng 9)
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- ADR liên quan: [ADR-0002](../../decisions/0002-model-and-session-routing.md) (Accepted)
- Nguồn quan sát: phiên điều phối của `content-automation-platform` ngày 2026-10-20 → 2026-10-21 (1 phiên gốc + 3 phiên con + tới 6 subagent song song).

## Vấn đề và lý do

Quan sát thật (đọc bằng `get_usage` lúc 2026-10-21, gói Team):

| Phiên | Model | Context đã dùng |
|---|---|---|
| Phiên gốc (điều phối) | Opus 5.5 | 494K (49%) |
| Phiên con P0 (điều phối phase) | Opus 5.5 | 753K (75%) |
| Phiên con UI | Opus 5.5 | 718K (72%) |
| Phiên con trợ lý | Opus 5.5 | 526K (53%) |

Hạn mức 5 giờ đã dùng 41%, hạn mức tuần 35%. Người dùng nhận xét: "dùng quá nhiều opus, sonnet dùng tạm, haiku không dùng dẫn đến phiên trôi quá nhanh".

Nguyên nhân, xếp theo mức nặng:

1. **Context phiên lớn.** Claude Code gửi lại toàn bộ hội thoại ở mỗi request. Phần lịch sử có cache được đọc lại theo giá cache, nhưng vẫn tính vào hạn mức: "một câu hỏi một dòng" trong phiên dài vẫn tốn cho cả hội thoại ([costs](https://code.claude.com/docs/en/costs)).
2. **Nhiều tin cross-session lẻ tẻ.** Mỗi tin là một lượt cho phiên nhận (đọc lại ~500–750K) và thường thêm một lượt cho phiên gửi khi nhận hồi âm. Chỉ riêng các tin báo quy tắc (env, xoá file, model) gửi cho 3 phiên đã tạo ~18 lượt mà không có việc gì kèm theo.
3. **Cron tự kiểm 5 phút ở phiên gốc.** Mỗi lần kiểm là một lượt đọc lại ~500K, phần lớn chỉ để ghi "không có thay đổi". Việc này thừa, vì app đã tự đánh thức phiên gốc khi một phiên con xong lượt.
4. **Mọi phiên chạy Opus.** `default` trên gói Team là Opus 5.5 ([model-config](https://code.claude.com/docs/en/model-config)).
5. **16 agent của plugin không khai `model`.** Khi không có tham số lúc gọi, không có frontmatter và không có `CLAUDE_CODE_SUBAGENT_MODEL`, subagent dùng model của phiên chính ([sub-agents](https://code.claude.com/docs/en/sub-agents)). Vì vậy agent của aip chạy Opus mỗi khi phiên chạy Opus. `adapters/_shared/agents.mjs:25` đã chiếu khoá `model` sang Claude, chỉ là chưa agent nào khai.

Không phải nguyên nhân: haiku bị bỏ quên ở tầng subagent chỉ tốn ít. Subagent bắt đầu với context mới, chọn model cho subagent không ảnh hưởng cache của phiên cha ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).

## Sự thật đã kiểm (nguồn chính thức, đọc 2026-10-21)

- **Cache gắn theo model.** "Mỗi model có cache riêng. Đổi model sẽ tính lại toàn bộ request kể cả khi nội dung giống hệt." Bật plan mode của `opusplan` cũng là một lần đổi model. Skill hoặc command có `model` khác trong frontmatter cũng tính là đổi model cho lượt đó ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **Giữ được cache:** sửa CLAUDE.md giữa phiên (nhưng chỉ có hiệu lực sau `/clear`, `/compact` hoặc khởi động lại), đổi permission mode, đổi output style, gọi skill, tạo subagent. Đổi effort trên các model 5.5 cũng giữ cache ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **Làm mất cache:** đổi model, compaction, thêm/bớt MCP tool khi tool search không hoãn chúng, nâng cấp Claude Code ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **TTL:** phiên chính dùng gói (subscription) có TTL 1 giờ. Subagent mặc định TTL 5 phút, kể cả trên gói ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **Thứ tự chọn model của subagent:** tham số lúc gọi → frontmatter `model` → `CLAUDE_CODE_SUBAGENT_MODEL` → model của phiên chính. Giá trị hợp lệ: `sonnet`, `opus`, `haiku`, `fable`, model ID đầy đủ, `inherit` ([sub-agents](https://code.claude.com/docs/en/sub-agents)).
- **Bảng model:** Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 từ $0,10/$0,50 mỗi MTok (vào/ra). Cả ba có cửa sổ 1M ([models overview](https://platform.claude.com/docs/en/about-claude/models/overview)). Hạ model không buộc compact, chỉ mất cache.
- **Khuyến nghị chính thức:** "Sonnet làm tốt phần lớn việc code và rẻ hơn Opus". Chọn model và effort ở đầu phiên, để `/compact` cho lúc nghỉ tự nhiên. `/clear` giữa các việc không liên quan ([costs](https://code.claude.com/docs/en/costs), [prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
- **Nhiều agent:** agent dùng ~4× token so với chat, hệ nhiều agent ~15×. Đáng dùng khi việc có giá trị cao, song song được nhiều, vượt một cửa sổ context hoặc nhiều tool. Không hợp với việc chung context, phụ thuộc chặt, "phần lớn việc code" là ví dụ ([multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)). Agent teams của Claude Code ~7× token, khuyên dùng Sonnet cho teammate, giữ nhóm nhỏ, tắt teammate rảnh ([costs](https://code.claude.com/docs/en/costs)).

Chưa kiểm được: trọng số của cache read trong hạn mức gói ([Unverified]; tài liệu chỉ nói lịch sử được đọc lại "theo giá cache" và "tính vào usage").

## Quyết định đã chốt

Của người dùng (2026-10-21):
- Giảm opus, dùng haiku cho việc máy móc, sonnet cho việc có logic.
- Cần bộ quy tắc điều hướng chuẩn để đưa vào engineering platform.
- Bỏ phần hỏi đáp, người viết thiết kế tự quyết phần còn lại (người dùng kiểm khi đọc).
- Effort (2026-10-21), mặc định của chúng ta chứ không phải mặc định sản phẩm: `opus` → `medium` (trùng mặc định sản phẩm 5.5), chỉ lên `high` cho việc nặng (debug nguyên nhân gốc khó, thiết kế, review bảo mật, review toàn phase, qua tham số lúc gọi); `sonnet` → `high` (mặc định sản phẩm là `medium`); `haiku` → mặc định sản phẩm. Đổi effort giữ cache trên model 5.5 ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)) nên được nâng/hạ giữa phiên khi loại việc đổi; đổi model thì không. 16 agent `model: sonnet` khai thêm `effort: high`.

Của người viết thiết kế:
- **D1. Chọn model ở thời điểm tạo phiên hoặc gọi subagent, không đổi model giữa phiên đang có context.** Muốn hạ model cho phần việc kế thì bàn giao sang phiên mới. Lý do: đổi model tính lại toàn bộ request.
- **D2. Mọi agent của plugin khai `model` tường minh** (không dựa vào kế thừa). Mặc định `sonnet`. Không agent nào hiện có được đặt `opus` hay `haiku` cứng. Lên opus làm bằng tham số lúc gọi, có ghi lý do.
- **D3. Việc máy móc dùng `haiku` qua tham số lúc gọi** (general-purpose hoặc Explore), không tạo agent haiku mới trong project này. Danh sách việc máy móc ở §1.
- **D4. Baseline `AGENTS.md` có thêm mục "Model and session routing"** (tiếng Anh, trong managed block), nội dung ở §2. Đây là chỉ dẫn mềm, không có hook chặn.
- **D5. `validate.mjs` báo lỗi khi agent thiếu `model`** hoặc `model` không thuộc `sonnet|opus|haiku|fable|inherit|<model id>`. `inherit` chỉ được dùng khi agent có ghi lý do trong body.
- **D6. Không đặt `CLAUDE_CODE_SUBAGENT_MODEL` thay người dùng.** aip không quản settings người dùng. README hướng dẫn cách đặt (`sonnet`) như lưới an toàn cho subagent ngoài plugin.
- **D7. Không thêm hook `PreModelSwitch` trong project này.** Claude Code đã tự hỏi lại khi cache còn ấm ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)). Để sau nếu quan sát thấy vẫn đổi nhầm.

## Ảnh hưởng spec
Không ảnh hưởng: design viết trước khi có spec sống (P7) trong cùng ngày; hành vi của nó chưa được ghi vào `docs/specs`, sẽ ghi khi một request kế tiếp chạm tới năng lực đó.
## Tiêu chí chấp nhận

- [x] **AC1.1** — Given mọi file `plugins/*/agents/*.md`, Then mỗi file có khoá `model` và `effort` trong frontmatter với giá trị theo bảng §3 (`sonnet` + `high`).
- [x] **AC1.2** — Given một agent nguồn thiếu `model`, When chạy `node test/validate.mjs`, Then báo lỗi nêu tên agent; giá trị ngoài `sonnet|opus|haiku|fable|inherit` và không khớp mẫu model ID `claude-*` cũng báo lỗi; agent `model: sonnet` thiếu `effort` hoặc `effort` khác `high` báo lỗi; agent `model: opus` có `effort` khác `medium`/`high` báo lỗi.
- [x] **AC1.3** — Given build Claude, Then file agent sinh ra mang đúng khoá `model` của nguồn; build Codex/Cursor/Antigravity không đổi hành vi so với trước (khoá không hỗ trợ được bỏ như hiện tại); Codex không nhận `model_reasoning_effort` từ effort của tầng model Claude.
- [x] **AC2.1** — Given `core/agents/AGENTS.template.md`, Then managed block có mục `### Model and session routing` với các quy tắc §2 (chọn model theo tầng, không đổi model giữa phiên, xoay phiên theo gói việc, giao tiếp giữa phiên, cron); `AGENTS.md` ở gốc repo giống byte-for-byte template.
- [x] **AC2.2** — Given mục §2, Then mọi con số (TTL, hệ số giá, thứ tự chọn model) có link nguồn chính thức hoặc nhãn [Unverified].
- [x] **AC3.1** — Given `README.md` và `README_VI.md`, Then có đoạn hướng dẫn `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` (đặt ở `env` của settings người dùng) và giải thích thứ tự ưu tiên model của subagent.
- [x] **AC4.1** — `npm test` xanh; version `core` và các plugin có agent đổi được bump; `plugins/_versions.lock.json` cập nhật bằng `node cli/lib/versions.mjs --lock`.

## Thiết kế

### §1. Phân loại việc → model

| Tầng | Việc | Model mặc định | Lên một bậc khi |
|---|---|---|---|
| Subagent máy móc | docs, run-log, ledger, cập nhật bảng tiến độ; sửa lint/format; đổi tên, chép file; mock data, mockup HTML; chạy script kiểm (vd `check-request.mjs`); đọc và tóm tắt log test; merge không conflict; tìm kiếm rộng trong repo | `haiku` (tham số lúc gọi) | haiku làm sai một lần → `sonnet` |
| Subagent có logic | implement, viết test, fixer, reviewer thường, spec/plan, giải conflict có ngữ nghĩa | `sonnet` (frontmatter) | sonnet thất bại hai lần cùng việc → `opus`, ghi lý do |
| Subagent chuyên sâu | review toàn phase, review bảo mật trước release, debug nguyên nhân gốc khó (race, migration, saga), thiết kế | `sonnet`; `opus` bằng tham số lúc gọi (effort `high`) cho review toàn phase, review bảo mật trước release, debug nguyên nhân gốc khó (không đặt trong frontmatter) | như trên, hoặc người dùng cho phép |
| Phiên thực thi (một phase / một nhánh) | điều phối subagent của một gói việc | `sonnet`, chọn lúc tạo phiên | gói chủ yếu là thiết kế hoặc debug khó → `opus` lúc tạo phiên |
| Phiên điều phối gốc | giao việc giữa các phiên, gom câu hỏi cho người dùng | `opus` | — |

### §2. Quy tắc phiên và giao tiếp (nội dung mục baseline)

Chọn model:
1. Chọn model và effort khi tạo phiên hoặc gọi subagent. Không đổi model trên phiên đang có context; muốn đổi thì bàn giao sang phiên mới.
2. Subagent ghi model đã dùng trong báo cáo. Mỗi lần lên `opus` ghi một dòng lý do.
2b. Effort (mặc định của chúng ta, không phải mặc định sản phẩm): `opus` → `medium` (trùng mặc định sản phẩm 5.5), `high` chỉ cho việc nặng ở hàng subagent chuyên sâu; `sonnet` → `high` (mặc định sản phẩm là `medium`); `haiku` → mặc định sản phẩm. Đổi effort giữ cache trên model 5.5 (Claude Code dùng API key hoặc subscription; ngoại lệ xem prompt-caching) nên nâng/hạ giữa phiên khi loại việc đổi; đổi model thì không (quyết định người dùng 2026-10-21).

Xoay phiên:
3. Một phiên làm một gói việc (một phase, một nhánh). Xong gói, hoặc context vượt ~40% cửa sổ, thì ghi điểm bàn giao vào ledger/run-log (nhánh, hash, việc dở, câu hỏi chờ) rồi mở phiên mới.
4. Phiên điều phối giữ context nhỏ: đọc tóm tắt, giao việc đọc log/diff dài cho subagent `haiku`.
5. Dùng `/clear` giữa hai việc không liên quan trong cùng phiên; `/compact <trọng tâm>` chỉ ở lúc nghỉ tự nhiên.

Giao tiếp giữa phiên:
6. Không gửi tin chỉ để báo quy tắc hay hỏi thăm; gom vào brief của việc kế tiếp.
7. Phiên con chỉ báo về khi: xong một việc trong hàng đợi, bị chặn, hoặc cần người dùng quyết. Không gửi "đã nhận", "đã ghi quy tắc".
8. Một tin báo gộp nhiều việc nhỏ. Kết quả dài để trong file (run-log), tin chỉ trỏ tới.
9. Brief giao cho phiên con có hàng đợi 2–3 việc nối tiếp, để phiên không đứng chờ giữa các việc.

Theo dõi:
10. Không dùng cron dày để kiểm phiên con; dựa vào sự kiện phiên con xong lượt. Cần lưới an toàn thì đặt ≥ 15 phút.
11. Kiểm hạn mức (`/usage`) ở mỗi cổng phase, không ở mỗi lượt.

Song song:
12. Chỉ chạy song song nhiều phiên hoặc nhiều subagent khi các việc độc lập về file và mỗi việc đủ lớn. Việc code phụ thuộc chặt thì chạy tuần tự trong một phiên. Lý do: hệ nhiều agent tốn ~15× token so với chat.

### §3. Model của 16 agent hiện có

| Agent | Model | Ghi chú |
|---|---|---|
| (mọi agent dưới đây) | — | khai thêm `effort: high` (quyết định người dùng 2026-10-21) |
| `backend-implementer`, `frontend-implementer`, `frontend-data-integrator` | `sonnet` | |
| `backend-fixer`, `frontend-fixer` | `sonnet` | |
| `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer` | `sonnet` | |
| `backend-reviewer`, `frontend-reviewer` | `sonnet` | lên `opus` bằng tham số khi review toàn phase |
| `engineering-quality-auditor` | `sonnet` | review bảo mật; lên `opus` bằng tham số khi cần |
| `engineering-spec-analyst` | `sonnet` | |
| `backend-performance-analyst`, `frontend-performance-analyst` | `sonnet` | |
| `data-migration-writer` | `sonnet` | |
| `ops-incident-investigator` | `sonnet` | |

Bảng phủ đủ 16 file trong `plugins/*/agents/` (đếm 2026-10-21). Agent thêm sau này mặc định `sonnet` trừ khi có lý do ghi trong thiết kế của nó.

## Để lại cho builder

- Vị trí chính xác của kiểm tra `model` trong `test/validate.mjs` và thông điệp lỗi.
- Câu chữ tiếng Anh của mục baseline §2, miễn giữ đủ 13 quy tắc và link nguồn.
- Có cần cập nhật skill `workflow-orchestrator` / `workflow-feature` để nhắc `model` khi gọi Agent hay không (khuyến nghị: một dòng trỏ về mục baseline).

## Rủi ro

- Tài liệu Claude Code thay đổi nhanh; con số TTL và hệ số giá cần kiểm lại khi bump version lớn.
- `sonnet` cho reviewer có thể bỏ sót lỗi tinh vi; bù bằng quy tắc lên `opus` cho review toàn phase và review bảo mật trước release.
- Trọng số cache read trong hạn mức gói chưa kiểm được [Unverified]; quy tắc §2 vẫn đúng hướng vì giảm số lượt ở phiên context lớn.
