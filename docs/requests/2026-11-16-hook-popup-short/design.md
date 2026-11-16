# Thiết kế: popup hook ask chỉ nói đang làm gì, đụng đường dẫn nào
- Ngày: 2026-11-16
- Trạng thái: in-progress — nhánh feature/hook-popup-short-2
- Requirement: không có

## Vấn đề và lý do

Người dùng nói nguyên văn: "Scroll mô tả khi hỏi đang khá nhỏ nếu text dài. Đánh giá ko tóm tắt các từ vô nghĩa. Chỉ cần tóm tắt đang làm gì đụng vào folder nào." Popup duyệt quyền của `guard-bash` và `guard-files` (nhánh `ask`) hiện hiện câu `reason` theo khuôn R21 của request `2026-11-12-hook-popup-standardization`: lệnh làm gì, vì sao hỏi, cho phép thì sao, nên chọn gì (cộng dòng `Lệnh gồm: …` của `guard-bash`). Ví dụ hiện tại, push nhánh bảo vệ: "Đẩy code lên nhánh bảo vệ `master` trên remote. Sau khi đẩy, người khác thấy ngay và khó rút lại. Chỉ cho phép nếu bạn đã duyệt diff; nếu không, hãy từ chối để agent đẩy lên nhánh feature." (~230 ký tự) kèm dòng `Lệnh gồm` tối đa 6 bước. Phần "vì sao", "cho phép thì sao", "nên chọn gì" là chữ người dùng gọi là vô nghĩa; vùng cuộn của popup nhỏ nên câu dài khó đọc. Đây là popup của hook, không phải thẻ câu hỏi `AskUserQuestion` của agent.

Đổi khuôn này là đổi AC1.1 đã duyệt của `2026-11-12-hook-popup-standardization` (khuôn "có cho phép hoặc từ chối", "≤ 500 ký tự"), nên cần G1 mới.

Đã đọc: `core/hooks/scripts/guard-bash.mjs` (`PUSH_TEXT`/`pushText`, `CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`, `FULL_NO_BYPASS_TEXT`, `secretText`, `UNPARSABLE_TEXT`, `summarize`, `MAX_STEPS = 6`, hàm `ask` trong `decide`), `guard-files.mjs` (`guardConfigAsk`, ba câu `ask` trong `confine`), `test/contract/99-hook-popup.contract.mjs` (`BANNED`, `shapeOk`) và bản sao `shapeOk` ở `99-path-permissions.contract.mjs`, spec `docs/specs/hooks-gates/spec.md` R21.

## Quyết định đã chốt

Người dùng đã trả lời bốn câu làm rõ (gom một tin nhắn) ngày 2026-11-16:

- **K1 — dòng "Lệnh gồm" giữ, rút còn ≤ 3 bước.** Vẫn liệt kê theo thứ tự kèm đường dẫn; hơn 3 bước thì "… và N bước khác". Đường dẫn trong mỗi bước giữ 40 ký tự cuối (hiện 60).
- **K2 — bỏ câu khuyên "nên chọn gì" ở mọi `ask`.** Không còn "cho phép", "từ chối", "nên", "hãy" trong reason của `ask`; cũng bỏ phần "vì sao hỏi" và "cho phép thì sao".
- **K3 — giữ `deny`, giữ token khớp.** `deny` (agent đọc, nhắc `fullRoots`/`fullPaths`) và `DENY_COMMIT` không đổi. Reason `ask` vẫn nêu đầy đủ (qua `showArg`) tên nhánh bảo vệ, tên file bí mật, đường dẫn.
- **K4 — độ dài: người dùng chọn "Giữ 500"** (làm rõ) và xác nhận ở G1 bằng cách bỏ vạch 200 ký tự agent đề xuất. Trần 500 ký tự của AC1.1 cũ không đổi.

### Quyết định của agent

Mọi dòng dưới là **quyết định của agent**, nêu nổi bật để người duyệt sửa.

- **D1 — khuôn mới của reason `ask`.** Một câu một dòng: `<việc> <token>.`, không chủ ngữ "Agent muốn", không lý do. Dòng thứ hai (chỉ `guard-bash`) là `Lệnh gồm: …`. Tổng cộng tối đa 2 dòng. Chữ mới (token đặt trong dấu `` ` ``):
  - push nhánh bảo vệ: ``Đẩy code lên nhánh bảo vệ `master`.``
  - push force: `Force push hoặc xoá nhánh trên remote.` (đổi khi thực thi: `pushReason` gom cả `--delete`, `--mirror` vào loại này)
  - push không rõ nhánh: `Push vào nhánh chưa rõ (tên nhánh hoặc thư mục là biến).`
  - cấu hình quyền (`guard-bash`): ``Ghi vào file cấu hình quyền (`.claude/aip-gate.json` hoặc `settings.json`).``
  - cấu hình quyền (`guard-files`): ``Ghi vào file cấu hình quyền `aip-gate.json`.``
  - đường dẫn chưa rõ (`guard-bash`, full): ``Ghi hoặc xoá ở đường dẫn chưa rõ (`$VAR`, `~`, `*`).``
  - đọc ngoài thư mục được cấp (`guard-bash`, full): `Đọc file ngoài các thư mục được cấp quyền đọc.`
  - full nhưng phiên không bypass: ``Lệnh đẩy code, gọi mạng hoặc deploy; project bật chế độ full nhưng phiên này vẫn hỏi. Đổi: `aip mode ask`.`` (giữ chuỗi `aip mode ask`: đó là cách đổi chế độ, không phải lời khuyên cho phép hay từ chối).
  - file bí mật: ``Lệnh nhắc tới file bí mật `.env`.``
  - commit nháy chưa đóng: `Lệnh commit có dấu nháy chưa đóng, không đọc chắc được.`
  - `guard-files`: ``Ghi (hoặc Đọc) đường dẫn chưa rõ `$HOME/x`.``; ``Ghi (hoặc Đọc) file bí mật `x` ở thư mục chưa đủ quyền đọc, ghi, xoá.``; ``Đọc file ngoài thư mục project `x`.``
- **D2 — khuôn test mới.** `shapeOk` đổi: bỏ yêu cầu có chữ "cho phép|từ chối"; thêm kiểm câu chính (bỏ dòng `Lệnh gồm`) **không** chứa `cho phép|từ chối|nên |hãy |khuyên`; trần 500 ký tự giữ nguyên (người dùng duyệt G1 chọn bỏ vạch 200 mà agent đề xuất). Độ ngắn do chữ mới ở D1 và `Lệnh gồm` ≤ 3 bước đảm bảo, test không ghim độ dài ngắn hơn 500. `BANNED` giữ. Bản sao `shapeOk` ở `99-path-permissions.contract.mjs` đổi theo; hai bản chép từ một hằng nếu `test/lib` có chỗ dùng chung, nếu không thì sửa cả hai.
- **D3 — `summarize` nhận số bước tối đa.** `MAX_STEPS` 6 → 3; hàm `summarize(cmd, msys, max = MAX_STEPS)` và `export` để test "không giấu lệnh" (dòng `Lệnh gồm` đủ bước) gọi `max` lớn thay vì dựa vào dòng bị cắt. Hệ quả có chủ đích: lệnh nối nhiều bước có thể không liệt kê bước gây ra câu hỏi (vd `push` là bước thứ 4); câu chính vẫn nêu nó (``nhánh bảo vệ `master```) và popup vẫn hiện khối lệnh thô bên dưới.
- **D4 — không đổi nhánh khác.** `guard-mcp`, `gate-stop`, `session-start`, `deny`, `DENY_COMMIT`, `CLAUDE_TMP_BLOCKED_TEXT`, `UNPARSABLE`-liên quan logic quyết định: không đổi, chỉ đổi chữ.
- **D5 — version.** Tăng `core/.manifest.json` (đổi nội dung hook), `npm run build`, `node cli/lib/versions.mjs --lock`. Lúc viết design core ở 1.33.23; master lên 1.34.1 trước khi nhánh merge nên thực tế bump 1.34.1 → 1.34.2, rồi 1.34.3 sau lượt sửa review cuối.

## Hướng đã cân nhắc

**Chọn — sửa chữ tại chỗ** (các hằng `*_TEXT`, `pushText`, `secretText`, ba câu của `guard-files`), rút `MAX_STEPS` và đường dẫn trong `summarize`, đổi khuôn test. Không đổi chữ ký hàm quyết định.

**Loại 1 — gộp "Lệnh gồm" vào câu đầu, một dòng:** mất danh sách bước nên chuỗi `a && b && git push` khó thấy hết lệnh. Người dùng chọn giữ dòng này.

**Loại 2 — giữ một vế khuyên ngắn chỉ ở ask rủi ro cao (push bảo vệ/force, cấu hình quyền, file bí mật):** giữ chữ "từ chối" trong popup. Người dùng chọn bỏ ở mọi `ask`.

**Loại 3 — rút cả `deny`:** agent đọc `deny` để biết cách xin cấp quyền (`fullPaths`/`fullRoots`), nên giữ. Người dùng chọn giữ.

## Tiêu chí chấp nhận

Test: sửa `test/contract/99-hook-popup.contract.mjs` (khuôn, ca bước tóm tắt) và `99-path-permissions.contract.mjs` (bản sao `shapeOk`, ca dòng `Lệnh gồm`); ca đỏ viết và commit trước code.

- [ ] **AC1.1** — Given mỗi nhánh `ask` của `guard-bash` và `guard-files` (bảng ca của `99-hook-popup`: push bảo vệ, push force, push không rõ nhánh, sửa cấu hình, file bí mật `.env` và `.pem`, commit nháy chưa đóng, full + đường dẫn không rõ, full + phiên không bypass, đọc ngoài project, ghi/đọc đường dẫn không rõ, file bí mật ở thư mục thiếu quyền; thêm ca đọc ngoài thư mục được cấp của `guard-bash`) When hook quyết định Then câu chính (bỏ dòng `Lệnh gồm`) không chứa `cho phép`, `từ chối`, `nên `, `hãy `, `khuyên`, `Agent muốn`, các từ của `BANNED`; câu chính dài tối đa 500 ký tự; toàn reason tối đa 2 dòng.
- [ ] **AC1.2** — Given push vào `master`, lệnh nhắc `.env` và `server.pem`, đọc `C:/x/y.txt` ngoài project, ghi cấu hình `aip-gate.json` When hook hỏi Then reason vẫn chứa tên nhánh, tên file khớp, đường dẫn đã cho (không đổi so với AC1.2 cũ); khi `allowEnvFiles` bật thì không nêu `.env` đã được phép (như cũ).
- [ ] **AC1.3** — Given `git add -A && git commit -m x && git push origin master` When `guard-bash` hỏi Then dòng `Lệnh gồm:` liệt kê `git add`, `git commit`, `git push` theo thứ tự; lệnh 8 bước chỉ liệt kê 3 và có "5 bước khác"; mỗi đường dẫn trong bước tối đa 40 ký tự cuối; `guard-files` không có dòng này; `summarize(cmd, msys, 99)` vẫn liệt kê đủ bước (các ca "không giấu lệnh" của heredoc, `<<EOF`, `bash -c`, nháy chưa đóng, `$( )` giữ nguyên ý, chạy qua `summarize` với `max` lớn).
- [ ] **AC1.4** — Given `deny` của full (ghi ngoài root, thiếu `fullPaths`, `DENY_COMMIT`, `CLAUDE_TMP_BLOCKED_TEXT`) When hook quyết định Then chữ `deny` không đổi, vẫn nhắc `fullRoots` (và `fullPaths`) như R21/R24.
- [ ] **AC1.5** — Given dữ liệu agent cung cấp (đường dẫn có xuống dòng, backtick, bidi, 900 ký tự; lệnh con git 100k ký tự) When hook hỏi Then reason không chèn dòng giả, không backtick của agent, không quá 1200 ký tự (không đổi so với AC1.1 cũ).
- [ ] **AC2.1** — Given tài liệu When đọc Then `docs/specs/hooks-gates/spec.md` R21 mô tả khuôn mới (một câu việc + token, không khuyên, `Lệnh gồm` tối đa 3 bước, 40 ký tự đường dẫn, deny giữ nguyên) kèm dòng Lịch sử; `README.md` và `README_VI.md` (mục Hooks, đoạn nói popup) khớp; các pin `test/content` liên quan xanh.
- [ ] **AC2.2** — Given các sửa trên When `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test` Then xanh; `core/.manifest.json` tăng so với master lúc merge (xem D5).

## Thiết kế

### Chỗ cần sửa

- **`core/hooks/scripts/guard-bash.mjs`**: các hằng `PUSH_TEXT`, `pushText`, `CONFIG_TEXT`, `FULL_PATH_TEXT`, `READ_OUTSIDE_TEXT`, `FULL_NO_BYPASS_TEXT`, `secretText`, `UNPARSABLE_TEXT` (chữ theo D1); `MAX_STEPS` 3 và tham số `max` của `summarize`, `export summarize`; `showArg(…, 60)` của đích trong `summarize` → 40; comment đầu khối chữ nêu khuôn mới.
- **`core/hooks/scripts/guard-files.mjs`**: `guardConfigAsk` và ba câu `ask` trong `confine` (theo D1). `deny` không đổi.
- **Test**: `99-hook-popup.contract.mjs` (`shapeOk`, bảng ca, ca 8 bước → 3 bước, các ca "không giấu lệnh" chuyển sang `summarize(cmd, true, 99)`), `99-path-permissions.contract.mjs` (bản sao `shapeOk`, ca dòng `Lệnh gồm`); grep `90-hooks`, `94-permission-modes`, `97-audit-mustfix` xem còn ca nào ghim chữ cũ.
- **Tài liệu**: `docs/specs/hooks-gates/spec.md` (R21), `README.md`, `README_VI.md`, `CHANGELOG.md`; `core/.manifest.json`, `plugins/_versions.lock.json`.
- **Không đổi**: `gate-config.mjs` (trừ khi cần `showArg`; không cần), `guard-mcp.mjs`, `gate-stop.mjs`, `session-start.mjs`, `cli/lib/*`, logic quyết định `ask`/`deny`.

## Ảnh hưởng spec
- hooks-gates: đổi R21

## Ngoài phạm vi và anti-goal

- Không đổi khi nào hook hỏi/chặn; chỉ đổi chữ hiển thị và độ dài danh sách bước.
- Không đổi `deny`, `DENY_COMMIT`, `CLAUDE_TMP_BLOCKED_TEXT`, câu của `guard-mcp` (ngoài R21: R21 chỉ nói `guard-bash` và `guard-files`).
- Không thêm tuỳ chọn cấu hình độ dài.
- Anti-goal: không làm mất token khớp (nhánh, tên file bí mật, đường dẫn); không để dữ liệu agent chèn dòng giả vào popup (giữ `showArg`).

## Ràng buộc

- Zero-dependency; hook fail-open khi lỗi nội bộ (`summarize` lỗi chỉ mất dòng tóm tắt, như hiện tại).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment theo AGENTS.md.
- Request này sửa cùng `guard-bash.mjs` với các request hook khác: chạy lần lượt, không song song (các request hook trước đã merge).
- Không push, không merge khi người dùng chưa duyệt G3; commit không có `Co-Authored-By` (theo AGENTS.md và dặn của người dùng).

## Kiểm thử

- Khuôn qua bảng ca của `99-hook-popup` (một hàng mỗi nhánh), ca đỏ commit riêng trước code.
- Trước G3, reviewer cuối chạy `decide` thật (`guard-bash` và `guard-files`) bằng script tạm trong scratchpad: in `reason` của mọi nhánh `ask` và đo độ dài, kèm ca ngoài bảng (đường dẫn dài, lệnh nhiều bước, nháy chưa đóng, `bash -c`), rồi đối chiếu D1, không chỉ đọc code.
- AC2.2: `npm run build`, `versions.mjs --lock`, `npm test` một lần cuối.

## Để builder quyết

- Tên biến/hàm nội bộ; cách gom các câu mới thành bảng; có tách hằng chung cho hai bản `shapeOk` hay chép.

## Quyết định khi thực thi

Chép từ `Ruling:` và vòng review của ledger (`.aip/` không vào nhánh); kiểm lại bằng `node test/validate.mjs --only hook-popup`. Mục này thay D1/D5 ở chỗ nào lệch.

- Cách chạy: Subagent + review từng task (người dùng chọn). Task 3 (DOCS) giao sonnet thay haiku vì dòng R21 và đoạn README rất dài, phải khớp từng khẳng định với code. Task 4 cỡ nhỏ, chịu review cuối.
- Nhánh: nhánh gốc `feature/hook-popup-short` đang bị worktree khác giữ khi chuyển phiên, nên làm tiếp ở `feature/hook-popup-short-2` (cắt từ cùng commit, đã merge `master`).
- Version: master lên core 1.34.1 trước khi merge nên bump 1.34.2 (Task 4), rồi 1.34.3 sau lượt sửa review cuối; `CHANGELOG.md` thêm vào Files của Task 4 để số version đúng.
- Review Task 3 vòng 1 (0/2/2): R21/README nói mọi câu ask nêu token (sai ở 5 loại câu), "một câu" (câu full không bypass có hai câu), thiếu nhãn [Unverified] cho "popup hiện khối lệnh thô", gộp BANNED/ADVICE sai phạm vi; đã sửa ở vòng 1 và re-review sạch.
- Review cuối (opus + auditor): 0 blocker, 0 major; chạy `decide` thật 37 ca và 360 ca so sánh master: quyết định ask/deny/null và mọi câu `deny` không đổi. Lượt sửa duy nhất: câu force push thành "Force push hoặc xoá nhánh trên remote." (vì `pushReason` gom cả `--delete`/`--mirror`), comment `showArg`, thông điệp test, tài liệu R21/README (dữ liệu agent qua `showArg` có thể chứa chữ bất kỳ, thêm loại câu không có token, "câu thứ hai", giới hạn cắt 40 ký tự); re-review ADDRESSED.
- Baseline `npm test` đỏ một ca ngoài phạm vi (`test/statusline.test.mjs` AC1.1, ledger request khác có dòng Blocked); cuối cùng `npm test` xanh (8194 pass).
- Ca đo thời gian `hook-copy-alias-brace AC3.4` (dưới 1 giây) đỏ 4 lần liên tiếp ở `npm test`, xanh ở lần 5 và mọi lần chạy riêng, không sửa: `decide` đo cùng ~120–330 ms trên nhánh và master, commit trước bump và master xanh ở `validate --build`; nên nới ngưỡng ở request riêng.
- Minor hoãn (không sửa): dòng `Lệnh gồm` 3 bước có thể không chứa bước gây hỏi và cắt mất phần đầu `$X`/`~` của đường dẫn chưa rõ dài hơn 40 ký tự (D3, chấp nhận); `guard-mcp` vẫn có câu khuyên dài (ngoài R21); thân heredoc trong `$( )` của lệnh commit nháy chưa đóng bị liệt kê thành bước thừa (có từ master); `git push --all` bị gom vào loại force; R21/README gom loại câu không token chưa phân biệt `guard-files` (có token); `ADVICE` chép ở hai file test.

## Rủi ro và câu hỏi mở

- [Inference] Bỏ lời khuyên làm người duyệt mất gợi ý "nên từ chối" ở ca rủi ro cao (push bảo vệ, cấu hình quyền). Giảm nhẹ: câu vẫn nêu đúng việc và đích, và popup hiện khối lệnh thô.
- [Inference] Rút còn 3 bước có thể không liệt kê bước gây ra câu hỏi khi lệnh dài; câu chính vẫn nêu việc. Người dùng chọn 3 bước.
- [Unverified] Chưa đo độ rộng popup thật của Claude Code desktop; test chỉ giữ trần 500, không đảm bảo câu vừa một dòng popup.
