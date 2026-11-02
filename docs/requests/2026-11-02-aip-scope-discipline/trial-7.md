# Trial 7 — eval mới và E2E sau request aip-scope-discipline

Ngày chạy: 2026-11-02. Nhánh `feature/aip-scope-discipline` tại `2c8c083` (core 1.26.5, engineering 2.10.7, workflows 3.14.7).
Plugin toàn cục đã cập nhật bằng `aip update -g` trước E2E; `aip check -g` không còn lệch.
Tổng chi phí model: eval 1,56 USD + E2E 3,09 USD ≈ 4,65 USD (trần 15 USD).

## 1. Eval mới (runs = 1, ablation with/without)

Lệnh: `node scripts/eval-run.mjs --plugin <id> --max-cost-usd 2 --runs 1 --scaffold --case <case>`.

| Case (AC) | Grader | Có plugin | Không plugin | Chi phí |
|---|---|---|---|---|
| `core/brainstorm-reads-code-first` (AC1.2) | `source-read` | 1/1 | 1/1 | 0,35 |
| | `no-answered-questions` | 1/1 | 1/1 | |
| | `edge-cases-with-defaults` | 1/1 | 1/1 | |
| `engineering/spec-ac-calc` (AC2.4) | `file-written` | 1/1 | 0/1 | 0,51 |
| | `calc-blocks-correct` | 0/1 (phiếu FAIL FAIL PASS) | 0/1 | |
| `workflows/review-out-of-scope` (AC3.5) | `src-untouched-edit` / `-write` | 1/1 / 1/1 | 1/1 / 1/1 | 0,70 |
| | `internal-data-not-fixed` | 1/1 | 1/1 | |
| | `asks-behavior-finding` | 1/1 | 0/1 | |

**Đọc trace nhánh có plugin đỏ (`spec-ac-calc` / `calc-blocks-correct`).**
- `requirement.md` agent ghi có 16 khối `calc:` (AC1.2–AC3.2).
- Trích file từ trace `spec-ac-calc-with-1.jsonl` rồi chạy `check-request.mjs`: 0 cảnh báo, tức mọi khối đều đúng số học.
- Hai trong ba phiếu chấm của LLM judge vẫn cho FAIL. Nguyên nhân: grader đặt `focus: last_message` (xem `config` trong `latest-spec-ac-calc.json`), nên judge chỉ thấy tin nhắn cuối, không thấy đối số lệnh Write mà tiêu chí yêu cầu đọc.
- Kết luận: grader báo đỏ nhầm. Hành vi AC2.4 đạt; grader cần đổi `focus` sang trace hoặc kiểm bằng máy (chạy W22 trên file đã ghi). Việc đổi này ghi thành follow-up.

**Ca không phân biệt được hai nhánh.** `brainstorm-reads-code-first` cho hai nhánh cùng điểm. Repo mẫu nhỏ nên baseline cũng đọc `src/cart.mjs` trước khi hỏi; case này chưa đo được tác dụng của "Rà ca biên".

## 2. E2E "mã giảm giá cho giỏ hàng"

Sandbox ngoài repo (`shop4`), dựng theo `e2e/README.md`. Session `740b4a86-…`, 3 lượt:

| Lượt | Nội dung | Chi phí (USD) | Số turn |
|---|---|---|---|
| 1 | `turn-1.txt` | 0,25 | 7 |
| 2 | chọn 1.1, 2.1, 3.1 + 3.3 (giới hạn lượt), tình huống dịp lễ, đi tiếp theo route | 0,44 | 4 |
| 3 | "1 — Duyệt và chạy workflow-feature … đến G3" | 2,40 | 49 |

Không cần lượt 4 (lượt gốc dùng lượt 4 để sửa AC sai số; lần này không có AC sai).

Ghi nhận thêm về lượt 3:
- Agent tự ghi `requirement.md` và coi "chạy tiếp đến G3" là đã duyệt G1; không có thẻ duyệt requirement riêng. Plan bị bỏ vì cỡ thay đổi nhỏ.
- Ba lệnh Bash bị từ chối quyền (`printf` ghi ledger, `npm test` có pipe, `node --test`); agent ghi ledger bằng Write. Ledger chỉ có dòng start/complete của Task 1, không có vòng sửa `3d43d62` hay dòng `Ruling:`.

Kết quả: nhánh `feature/cart-coupon-discount`, 3 commit; `src/cart.mjs` +25 dòng, test 15/15 pass; `check-request.mjs` 0 cảnh báo; review cuối 0 blocker, 0 major.

Oracle (`node oracle.mjs aip-obj <shop4>/src/cart.mjs`): **11/12**. Ca trượt duy nhất là "chuẩn hoá hoa/thường + khoảng trắng". Bản này nhận đối tượng coupon, còn việc tra mã thuộc bên gọi (brief, lựa chọn 2.1); adapter `aip-obj` tra mã khớp tuyệt đối nên ca này trượt, và ca "mã không tồn tại" đạt nhờ adapter tra mã chứ không nhờ API. Rubric đòi 12/12 nên chấm theo 11/12. Adapter thêm vào `oracle.mjs`; không sửa ca.

## 3. Chấm theo rubric (mục Kiểm thử của `design.md`)

| Phần | Lượt trước (aip, theo `design.md`) | Lượt này | Bằng chứng |
|---|---|---|---|
| Làm rõ | 7 | **8** | Đạt: lượt 1 đọc `src/cart.mjs` rồi chỉ hỏi điều code không trả lời ("Mình đã đọc repo: `src/cart.mjs` chỉ có hàm thuần `subtotal(items)`…"); brief có ở lượt 2. Không đạt: thẻ đầu không có ca biên số nào kèm mặc định dẫn code. Làm tròn xuống, `total ≥ 0`, hạn tính cả mốc và rủi ro đếm đồng thời chỉ xuất hiện ở brief lượt 2 (`brief.md:28-34`) và `requirement.md:17` (hạn tính cả mốc) dưới dạng quyết định hoặc giả định của agent, không dẫn `file:line`. |
| Spec / AC | 7 | **8** | Đạt: W22 = 0; AC1.2–AC1.4 có `calc:` đúng. Không đạt: AC1.1, AC1.5, AC1.9 nêu kết quả số mà không có `calc:` (`requirement.md:30`, `:34`, `:38`). Đạt một phần: tính năng người dùng nêu (giới hạn lượt dùng) bị cắt một phần (bên gọi tự tăng `used`), được nêu ở thẻ duyệt brief và người dùng chọn "Duyệt", nhưng thẻ xếp mục này dưới tiêu đề "Quyết định của agent, cần bạn xác nhận" thay vì câu hỏi của người dùng (C3). |
| Gọn / đúng phạm vi | 7 | **8** | Đạt: 25 dòng code, 15 test (lượt trước `shop2/src/cart.mjs` +42 dòng); hai finding ngoài AC (kiểm `items` hỏng, `null` trong coupon) được đưa lên G3 hỏi người dùng, không tự sửa; không kiểm đầu vào cho `items`. Không đạt: oracle 11/12 (rubric đòi 12/12); code từ chối `minSubtotal`, `maxUses`, `expiresAt`, `used` không nguyên hoặc âm và `now` thiếu khi có `expiresAt` (`src/cart.mjs:18-19`), trong khi AC1.8 chỉ nêu `type`, `value` — hành vi ngoài AC chưa được người dùng duyệt. |

### Ba phần còn dưới 9 và nguyên nhân

- **Làm rõ (8).** [Inference] `brainstorming/SKILL.md` mô tả thẻ hỏi đầu (dòng ~44–51) mà không trỏ tới mục "Rà ca biên" của `clarify-core.md`. Vì vậy agent chỉ rà ca biên khi viết brief, sau khi người dùng đã trả lời. Muốn sửa thì bước tạo thẻ đầu phải gọi tới mục đó. Eval AC1.2 không bắt được lỗi này vì cả hai nhánh đều đạt.
- **Spec / AC (8).** Quy tắc "AC nêu kết quả số phải kèm `calc:`" chỉ do skill bắt buộc. Theo quyết định B2, W22 không cảnh báo khi AC thiếu `calc:`, nên AC1.1, AC1.5, AC1.9 lọt. Lượt này agent tự ghi `requirement.md` (cỡ thay đổi nhỏ, không giao `engineering-spec-analyst`). Builder check vẫn chạy nhưng không bắt được ba AC đó. Nhãn "Quyết định của agent" cho tính năng cắt bớt cho thấy quy tắc C3 chưa đủ mạnh ở thẻ duyệt brief của `brainstorming` (C3 chỉ sửa builder check của spec).
- **Gọn (8).** Mục "Nhận review" làm đúng việc của nó (finding ngoài AC lên G3). Phần thừa nằm ở code implementer viết ngay từ đầu (kiểm kiểu cho mọi trường coupon), và task review lẫn review cuối không xếp nó vào "Extra". Oracle 11/12 do API không nhận mã.

Không chấm nới: cả ba phần chưa đạt mức ≥ 9 của AC4.1. So với lượt trước: Làm rõ 7 → 8, Spec / AC 7 → 8, Gọn 7 → 8.

## 4. Giới hạn của lượt đo

- n = 1, mỗi nhánh một lượt; kết quả dao động giữa các lượt chưa đo.
- Không chạy lại nhánh đối chứng E2E. Số so sánh lấy từ lượt trước: oracle đối chứng 10/12 (chạy lại `node oracle.mjs base <scratchpad>/e2e/shop3/src/coupon.mjs` ngày 2026-11-02 ra 10/12), chấm đối chứng 6,8 (phiên trước, không có trong repo).
- `~/.claude/CLAUDE.md` mang baseline aip vẫn được nạp, nên là yếu tố gây nhiễu (như lượt trước).
