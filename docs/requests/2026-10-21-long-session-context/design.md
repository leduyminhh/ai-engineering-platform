# Thiết kế: kiểm soát context của phiên chạy dài
- Ngày: 2026-10-21
- Trạng thái: bản nháp, chờ người dùng duyệt (chưa hiện thực gì)
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)
- ADR liên quan: [ADR-0003](../../decisions/0003-long-session-context.md) (Proposed); nối tiếp [ADR-0002](../../decisions/0002-model-and-session-routing.md).
- Nguồn quan sát: phiên điều phối của `content-automation-platform` ngày 2026-10-21 (số đo của chính phiên đó, ghi lại nguyên văn bên dưới).

## Vấn đề và lý do

Người dùng báo các phiên chạy dài, nhất là phiên root điều phối, có context quá lớn nên ngốn hạn mức.

**Số liệu thật** (`get_usage`, gói Team, 2026-10-21):
- Hạn mức 5 giờ dùng 94% sau khoảng 8 giờ làm việc với 1 phiên gốc, 3–4 phiên con và tới 6 subagent song song.
- Context lúc đó: phiên gốc 685K token (Messages 578K), phiên con Backend 738K, UI 477K, phiên điều phối cũ 753K (75%) trước khi bị thay, API đọc đợt 2 261K. Cửa sổ 1M, tự nén ở 97%.
- Mỗi tin cross-session là một lượt cho phiên nhận (đọc lại toàn bộ context). Mỗi lần phiên con xong lượt, app tự đánh thức phiên gốc, cũng là một lượt đọc lại toàn bộ.
- Báo cáo của phiên con dài 1–2K token mỗi tin (có tin hơn 3K) và nằm lại trong context của root.
- Đổi model của 3 phiên con giữa chừng (Opus → Sonnet) làm mất cache; mỗi phiên đọc lại 500–750K token không cache.
- Phần cố định mỗi phiên: memory index ~19K token, định nghĩa MCP ~28K ở phiên gốc.

**Số đo thành phần context của root** (phiên gốc tự phân tích transcript, đã loại trùng, ước lượng ~3,2 ký tự/token; tiếng Việt token hoá nặng hơn nên số thật có thể cao hơn khoảng 1,2–1,4 lần). Đo được ~363K token, trong khi `get_usage` báo Messages 578K; phần chênh chưa giải thích được [Unverified].

| Thành phần | Token | Tỉ lệ | Chi tiết |
|---|---|---|---|
| Nhắc nhở hệ thống tự chèn | 110K | 30% | 76 thông báo "phiên con xong lượt" ~61K (~800 token/lần, kèm đoạn chỉ dẫn lặp ~200 token mỗi lần); 5 lần nạp lại CLAUDE.md + AGENTS.md + MEMORY.md khi fork/resume ~24K; tin cross-session ~11K; danh sách MCP/công cụ hoãn ~9K |
| Kết quả công cụ | 107K | 29% | Bash 53K (94 lần, ~560/lần); `list_sessions` 14K (13 lần ~1,1K, trả toàn bộ phiên mỗi lần); kết quả `SendMessage` 12K (81 lần); `list_events` 9K; `get_usage` ~8K |
| Lời gọi công cụ của root | 74K | 20% | brief `SendMessage` 32K (81 tin ~400 token/tin) |
| Lời của root | 55K | 15% | 245 khối ~225 token/khối; báo cáo cuối lượt dài nhất |

Phát hiện thêm: transcript lưu một số mục assistant hai lần, nên đo trên file thô cao gần gấp đôi; công cụ đo phải loại trùng theo id.

**Kết luận từ số đo:** nguồn tăng chính là sự kiện tự động (thông báo phiên con, nạp lại file hướng dẫn) cộng kết quả công cụ dài, không phải lời của root. Chi phí lớn nhất không phải độ lớn context mà **số lượt**, vì mỗi lượt đọc lại toàn bộ context. Hướng giải nhắm vào: (a) giảm số lần phiên kết thúc lượt chỉ để chờ nền, (b) giới hạn kích thước kết quả công cụ, (c) giảm phần nạp lại mỗi lần, (d) xoay phiên bằng file bàn giao thay vì để context phình.

## Sự thật đã kiểm (nguồn chính thức, tra 2026-10-21)

- **Cache.** Mỗi request gửi lại cả hội thoại; cache đọc lại vẫn tính vào usage. Đổi model, compaction, thêm/bớt MCP tool khi tool search không hoãn, nâng cấp Claude Code làm mất cache. Đổi effort không làm mất cache trên Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.1 khi dùng API key hoặc subscription; gọi skill và sửa CLAUDE.md giữa phiên giữ cache ([prompt-caching](https://code.claude.com/docs/en/prompt-caching#actions-that-invalidate-the-cache)).
- **TTL.** Phiên chính trên subscription trong hạn mức gói: 1 giờ; subagent, workflow, fork, compaction: 5 phút; hết hạn mức và dùng usage credits thì phiên chính về 5 phút. Phiên rảnh quá TTL rồi nhận tin tiếp thì đọc lại toàn bộ context không cache. Ghi đè: `promptCacheTtl` / `CLAUDE_CODE_PROMPT_CACHE_TTL` và `subagentPromptCacheTtl` / `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` (v2.1.242 trở lên) ([prompt-caching](https://code.claude.com/docs/en/prompt-caching#cache-lifetime), [costs](https://code.claude.com/docs/en/costs#why-usage-climbs-in-a-long-session)).
- **Compaction.** Là một request lớn: rẻ khi cache còn ấm, đắt nhất khi mở lại phiên cũ đã nguội. Cửa sổ tự nén chỉnh được từ 100K tới 1M bằng `/autocompact`, `autoCompactWindow` (settings), `--autocompact` (một lần chạy) hoặc `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (ưu tiên cao nhất). Model có cửa sổ 1M nén ở ~967K mặc định ([model-config](https://code.claude.com/docs/en/model-config#set-the-auto-compact-window)). `/compact <trọng tâm>` và mục "Compact instructions" trong CLAUDE.md định hướng phần giữ lại ([costs](https://code.claude.com/docs/en/costs#manage-context-proactively)).
- **Hook `SessionStart`.** Nhận `source` ∈ `startup|resume|clear|compact|fork`; khi `resume`/`fork` còn nhận `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd` (v2.1.251 trở lên). Có thể chèn context qua `additionalContext` hoặc stdout, mỗi loại tối đa 10.000 ký tự ([hooks](https://code.claude.com/docs/en/hooks#sessionstart)).
- **Hook `PreCompact`.** Nhận `trigger` ∈ `manual|auto` và `custom_instructions` (null khi tự nén); chặn được bằng exit 2 hoặc `"decision": "block"` (chặn nén tự động thì phiên tiếp tục không nén; nếu nén là cách phục hồi sau lỗi vượt cửa sổ thì request lỗi). [Unverified] Hook không có trường để thêm chỉ dẫn vào bản tóm tắt ([hooks](https://code.claude.com/docs/en/hooks#precompact)).
- **Đo context.** Chỉ statusline nhận `context_window.used_percentage`, `context_window_size`, `current_usage`, `exceeds_200k_tokens` và `rate_limits` (Pro/Max); `used_percentage` tính trên input token. Input chung của hook (kể cả `Stop`, `UserPromptSubmit`) không có trường dung lượng context ([statusline](https://code.claude.com/docs/en/statusline), [hooks](https://code.claude.com/docs/en/hooks#common-input-fields)). [Inference] Hook `Stop` muốn biết dung lượng phải tự ước lượng từ `transcript_path`, và tài liệu nói file ghi bất đồng bộ nên có thể trễ.
- **Hướng dẫn chính thức khác.** `/clear` giữa việc không liên quan; `/compact` ở chỗ nghỉ tự nhiên; CLAUDE.md dưới 200 dòng, đưa chỉ dẫn theo việc vào skill; định nghĩa MCP mặc định được hoãn (chỉ tên và hướng dẫn server vào context), tắt server không dùng bằng `/mcp`; giao việc ồn ào cho subagent nhưng subagent vẫn tính usage; tác vụ định kỳ, tin cross-session và goal check-in là các nguồn làm usage tăng ([costs](https://code.claude.com/docs/en/costs#reduce-token-usage)).
- **Nhiều agent.** Agent ~4× token so với chat, hệ nhiều agent ~15×, agent teams ~7× ([multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system), [costs](https://code.claude.com/docs/en/costs)).

Chưa kiểm được:
- [Unverified] trọng số cache read trong hạn mức gói (tài liệu chỉ nói đọc lại "theo giá cache" và vẫn "tính vào usage").
- [Unverified] tài liệu chính thức không mô tả quy trình bàn giao phiên.
- [Unverified] phần chênh 578K (`get_usage`) so với ~363K (đo transcript).

## Quyết định đã chốt

Của người dùng (qua phiên content-automation, 2026-10-21): ghi vấn đề vào platform để nâng cấp luồng làm việc; chỉ viết tài liệu, chưa hiện thực; subagent không dùng opus.

Của người viết thiết kế (người dùng kiểm khi đọc; mỗi mục ghi **mềm** = quy tắc trong baseline, **hook** = đề xuất hook, người dùng chọn):

- **D1. Root mỏng — trạng thái nằm trong file** (mềm). Phiên con ghi báo cáo dài vào file (run-log trong thư mục request), tin gửi root chỉ một dòng kèm đường dẫn và kết luận. Root không tự đọc diff hay log dài: giao subagent `haiku` đọc rồi trả bản tóm tắt. Giải quyết: kết quả công cụ 29%, brief 20%.
- **D2. Kết quả công cụ có giới hạn** (mềm). Lệnh chạy ở phiên điều phối dùng `head`, `--stat`, lọc cột; liệt kê phiên theo tên hoặc id thay vì liệt kê hết; không gọi `get_usage`/`list_events` lặp trong cùng một cổng. Mục tiêu: hạ ~560 token/lần Bash và ~1,1K/lần `list_sessions`.
- **D3. Giảm số lượt thừa** (mềm). Khi bước kế phụ thuộc vào subagent, chạy foreground (không kết thúc lượt để chờ thông báo nền). Phiên con chỉ báo về khi xong cả gói, bị chặn, hoặc cần người dùng quyết; gom nhiều việc nhỏ vào một tin; hàng đợi 2–3 việc nối tiếp mỗi brief. Không nhắn qua lại chỉ để báo nhận. Giải quyết: 76 thông báo × ~800 token. Liên kết ADR-0002 §2 mục 6–9, không lặp lại.
- **D4. File bàn giao chuẩn `handoff.md`** (mềm), đặt trong thư mục request đang chạy (`docs/requests/<ngày>-<slug>/handoff.md`), gồm: nhánh, hash HEAD, đã xong, đang dở, bước kế, câu hỏi chờ người dùng, ràng buộc phải nhớ, đường dẫn run-log. Phiên mới đọc file thay vì kế thừa hội thoại. Template đặt trong skill `artifact-templates` khi hiện thực.
- **D5. Xoay phiên theo ngưỡng** (mềm). Ngưỡng mềm ~40% cửa sổ: xong gói hiện tại rồi bàn giao; ngưỡng cứng ~60%: bàn giao ngay. [Inference] Hai ngưỡng đến từ phiên gốc, chưa kiểm thực nghiệm; người dùng chỉnh được. Đo bằng `/usage` hoặc statusline `context_window.used_percentage`, nên chỉ có người hoặc statusline đọc được, hook không đọc được (xem D8).
- **D6. Root theo "kỷ nguyên"** (mềm). Một root mỗi phase (hoặc mỗi ngày làm việc), không để một root sống nhiều ngày. Root mới đọc `handoff.md` và run-log của kỷ nguyên trước.
- **D7. Chính sách nén** (mềm + quyết định của người dùng). Chủ động `/compact <trọng tâm>` ở chỗ nghỉ tự nhiên khi cache còn ấm (dưới 1 giờ); thêm mục "Compact instructions" cho vai root vào CLAUDE.md của project điều phối. Hạ `autoCompactWindow` (vd 400–500K) so với giữ ~967K: **được** là trần mỗi request thấp hơn, tránh các lượt 700K+; **mất** là nén nhiều lần hơn, mỗi lần nén là một request lớn và mất chi tiết. Khuyến nghị: không hạ chung; xoay phiên bằng D4–D6 là đường chính, hạ cửa sổ chỉ như lưới an toàn nếu người dùng muốn. Đây là cấu hình người dùng (settings/env), aip không ghi thay (giống D6 của ADR-0002).
- **D8. Hook — người dùng chọn** (không bật mặc định trong design này):
  - **H-A (đề xuất):** hook `SessionStart` đọc `handoff.md` của request đang chạy và chèn vào context khi `source` là `startup`, `clear` hoặc `compact` (giới hạn 10.000 ký tự). Cần `--plugin core` cài dạng plugin.
  - **H-B (đề xuất):** hook `SessionStart` khi `source` là `resume` và `prompt_cache_likely_expired` là true thì nhắc "phiên nguội, đọc lại toàn bộ context không cache (~`estimated_cache_write_usd` USD); cân nhắc mở phiên mới từ `handoff.md`". Dùng dữ liệu có sẵn trong input hook (v2.1.251 trở lên).
  - **H-C (không đề xuất):** hook `Stop` ước lượng dung lượng từ `transcript_path` để nhắc bàn giao. Lý do: chưa có trường dung lượng, transcript ghi trễ, mục assistant lưu trùng làm số đo lệch gần 2×; dễ báo sai.
  - **H-D (không đề xuất):** `PreCompact` chặn nén tự động. Lý do: chặn thì phiên tiếp tục phình; không có tác dụng giữ được thông tin.
- **D9. Cache khi phiên rảnh** (mềm). Phiên lớn rảnh quá 1 giờ thì thà mở phiên mới từ `handoff.md` hơn là đánh thức; không đổi model giữa phiên (ADR-0002 D1).
- **D10. Đo đạc** (mềm, kèm công cụ). Ghi `used_percentage` (hoặc `/usage`) của từng phiên vào run-log ở mỗi cổng phase. Công cụ đo transcript (tuỳ chọn, ngoài aip): phải loại trùng theo id; báo cáo thành phần như bảng trên.
- **D11. Giảm phần cố định** (mềm). Memory index mỗi mục một dòng ngắn, gộp mục cũ (hiện ~19K token); tắt MCP không dùng; CLAUDE.md dưới 200 dòng, chỉ dẫn theo việc để trong skill; rút gọn các file nạp lại mỗi lần fork/resume (~24K cho 5 lần).
- **D12. Giới hạn song song** (mềm). 2–3 phiên cùng lúc, chỉ khi các việc độc lập về file — đã có ở ADR-0002 §2 mục 12; chỉ liên kết.
- **D13. Phạm vi.** Mở rộng mục "Model and session routing" của baseline sau khi thiết kế được duyệt, không sửa `AGENTS.md` hay code ngay (theo yêu cầu).

## Tiêu chí chấp nhận

(Áp cho lần hiện thực sau khi người dùng duyệt; mỗi AC kiểm được bằng đọc file hoặc test nội dung.)

- [ ] **AC1.1** — Given `core/agents/AGENTS.template.md`, When hiện thực xong, Then mục "Model and session routing" (hoặc mục kế bên) có các quy tắc D1–D3 và D9: báo cáo dài ghi file + tin một dòng, kết quả công cụ có giới hạn, chỉ báo khi xong/chặn/cần quyết, chạy foreground khi bước kế phụ thuộc, phiên rảnh quá 1 giờ thì mở phiên mới; `AGENTS.md` gốc giống byte-for-byte template.
- [ ] **AC1.2** — Given mục baseline ở AC1.1, Then mọi con số (TTL, ngưỡng 40%/60%, hệ số token) có link nguồn chính thức trong "Sự thật đã kiểm" hoặc nhãn [Unverified]/[Inference].
- [ ] **AC2.1** — Given template `handoff.md` trong `core/skills/artifact-templates/references/`, When mở, Then có các mục: nhánh, hash HEAD, đã xong, đang dở, bước kế, câu hỏi chờ người dùng, ràng buộc, đường dẫn run-log; có khối header `<!-- artifact-template -->` và nằm trong mục lục của skill (kiểm bằng contract hiện có của `artifact-templates`).
- [ ] **AC2.2** — Given baseline, Then quy tắc xoay phiên (D4–D6) nêu ngưỡng mềm và cứng, nêu rằng chỉ người hoặc statusline đọc được % context (hook không đọc được), và trỏ tới `handoff.md`.
- [ ] **AC3.1** — Given người dùng chọn hook H-A, When một phiên khởi động (`startup`, `clear` hoặc `compact`) trong project có `handoff.md` của request đang chạy, Then hook in ra tối đa 10.000 ký tự nội dung `handoff.md` qua `additionalContext`; không có file thì không in gì; lỗi bất kỳ thì exit 0 không chặn (fail-open như các hook hiện có).
- [ ] **AC3.2** — Given người dùng chọn hook H-B, When `SessionStart` có `source: "resume"` và `prompt_cache_likely_expired: true`, Then hook in một dòng cảnh báo có `estimated_cache_write_usd`; khi `prompt_cache_likely_expired` là false hoặc thiếu trường thì không in gì.
- [ ] **AC4.1** — Given baseline và template run-log, Then có quy tắc ghi `used_percentage` (hoặc `/usage`) của từng phiên vào run-log ở mỗi cổng phase.
- [ ] **AC4.2** — Given công cụ đo transcript (nếu người dùng chọn làm), When chạy trên transcript có mục assistant lưu trùng, Then số token chỉ tính một lần cho mỗi id và báo cáo thành phần (nhắc nhở hệ thống, kết quả công cụ, lời gọi công cụ, lời của root) khớp tổng.
- [ ] **AC5.1** — Given README EN/VI, Then có đoạn nói về `autoCompactWindow` / `CLAUDE_CODE_AUTO_COMPACT_WINDOW` và đánh đổi (D7), nêu rõ aip không ghi settings của người dùng.
- [ ] **AC6.1** — `npm test` xanh khi hiện thực; version `core` được bump; `plugins/_versions.lock.json` cập nhật bằng `node cli/lib/versions.mjs --lock`.

## Thiết kế

### §1. Chia theo tác động và chi phí

| Nhóm | Quyết định | Chi phí hiện thực | Tác động theo số đo |
|---|---|---|---|
| Quy tắc mềm trong baseline | D1, D2, D3, D5, D6, D9, D10, D11, D12 | thấp: một mục baseline + bump core | cao: nhắm vào 30% nhắc nhở tự chèn + 29% kết quả công cụ + 20% brief |
| File bàn giao | D4 | thấp: một template + contract | cao: cho phép xoay phiên không kế thừa hội thoại |
| Hook | D8 (H-A, H-B) | trung bình: script Node, test như hook hiện có | trung bình: chỉ hữu ích nếu người dùng thật sự xoay phiên bằng file |
| Cấu hình nén | D7 | không (hướng dẫn README) | trung bình, có đánh đổi; người dùng quyết |
| Công cụ đo | D10 (AC4.2) | trung bình, ngoài aip có thể hợp hơn | hỗ trợ kiểm chứng, không giảm trực tiếp |

### §2. Nội dung quy tắc mềm (mô tả để hiện thực sau)

Mục baseline mở rộng, giữ ngắn (dưới ~25 dòng thêm) và không lặp ADR-0002: (1) báo cáo dài ghi file, tin một dòng; (2) lệnh ở phiên điều phối luôn giới hạn đầu ra; (3) chạy foreground khi chờ kết quả; (4) phiên con chỉ báo ở ba trường hợp; (5) xoay phiên bằng `handoff.md` ở ngưỡng mềm/cứng; (6) phiên rảnh quá 1 giờ thì mở phiên mới; (7) ghi % context ở cổng phase; (8) giữ phần cố định gọn. Chỉ dẫn "Compact instructions" cho vai root thuộc CLAUDE.md của project điều phối, không thuộc baseline chung.

### §3. Hook (chỉ khi người dùng chọn)

Cùng khung với `gate-stop.mjs`: script Node trong `core/hooks/scripts/`, đăng ký `SessionStart` trong `hooks.json`, export hàm `decide()` thuần để test, fail-open, không ghi file, đọc cấu hình từ `<git-root>/.claude/aip-gate.json` qua `gate-config.mjs` (khoá mới đề xuất `handoffInject`, `resumeWarn`, mặc định tắt). `checkHooksJson` và `HOOK_EVENTS` cần nhận `SessionStart`.

## Ngoài phạm vi và anti-goal

Ngoài phạm vi: hiện thực bất kỳ thứ gì (chờ duyệt); đổi hành vi app Claude Desktop (tự đánh thức phiên gốc khi phiên con xong lượt) — chỉ giảm số lần phiên con kết thúc lượt; viết công cụ đo trong aip nếu người dùng thấy nên để ngoài; hook `Stop`/`PreCompact` đo hay chặn context.

Anti-goal (thất bại dù chạy được):
- Quy tắc làm phiên chậm hơn: bắt ghi file bàn giao quá thường xuyên khiến thêm lượt, tốn hơn lợi.
- Hook chèn quá nhiều vào context mỗi lần khởi động (phải ≤ 10.000 ký tự và chỉ khi có `handoff.md`).
- Quy tắc ngưỡng mà không ai đo được (hook không đọc được % context; phải nói rõ ai đo).
- Chép nguyên văn ADR-0002 vào baseline (lặp, phình baseline đã dài).

## Ràng buộc

- Chưa hiện thực: chỉ file docs trong lần này (design + ADR-0003); không đụng `core/`, `plugins/`, `AGENTS.md`.
- Khi hiện thực: zero-dep, Node 20+, UTF-8 không BOM, LF; baseline tiếng Anh; comment code tiếng Việt chỉ nêu *vì sao*; đổi nội dung chiếu thì bump version plugin sở hữu và chạy `versions.mjs --lock`.

## Để lại cho builder

- Câu chữ cụ thể của mục baseline và vị trí chính xác trong `AGENTS.template.md`.
- Tên và đường dẫn cuối cùng của file bàn giao nếu project không dùng `docs/requests/` (đề xuất thay thế: `.claude/handoff.md`).
- Có đưa quy tắc ngưỡng vào template run-log của skill hay chỉ trong baseline.

## Rủi ro

- Tài liệu Claude Code thay đổi nhanh; trường `SessionStart` (v2.1.251 trở lên), tên setting và con số TTL cần kiểm lại khi nâng version.
- Ngưỡng 40%/60% chưa kiểm thực nghiệm [Inference]; có thể quá sớm hoặc quá muộn với từng project.
- Phần chênh 578K so với ~363K chưa giải thích được [Unverified]; nếu phần thật còn nằm ngoài các thành phần đã đo (ví dụ nội dung hệ thống không lưu vào transcript) thì kết luận "nhắc nhở tự chèn là nguồn chính" cần kiểm lại.
- Chạy foreground thay vì nền có thể làm phiên đứng chờ lâu; đánh đổi giữa số lượt và độ song song (ADR-0002 §2 mục 12).
- Xoay phiên bằng file làm mất sắc thái hội thoại; `handoff.md` phải đủ chi tiết, nếu không phiên mới làm lại việc.

Câu hỏi mở cho người dùng (chọn khi duyệt):
1. Có bật hook H-A và H-B không (mặc định tắt trong thiết kế này)?
2. Có hạ `autoCompactWindow` như lưới an toàn cho root không, hay chỉ xoay phiên?
3. Công cụ đo transcript (AC4.2) làm trong aip hay để ngoài?
