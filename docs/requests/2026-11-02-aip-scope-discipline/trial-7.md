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
- `requirement.md` agent ghi có 15 khối `calc:` (AC1.2–AC3.2).
- Trích file từ trace `spec-ac-calc-with-1.jsonl` rồi chạy `check-request.mjs`: 0 cảnh báo, tức mọi khối đều đúng số học.
- Hai trong ba phiếu chấm của LLM judge vẫn cho FAIL. Bằng chứng judge trích ra là tin nhắn cuối, không phải nội dung lệnh Write.
- Kết luận: grader báo đỏ nhầm. Hành vi AC2.4 đạt; grader cần đổi sang kiểm bằng máy (chạy W22 trên file đã ghi). Việc đổi này ghi thành follow-up.

**Ca không phân biệt được hai nhánh.** `brainstorm-reads-code-first` cho hai nhánh cùng điểm. Repo mẫu nhỏ nên baseline cũng đọc `src/cart.mjs` trước khi hỏi; case này chưa đo được tác dụng của "Rà ca biên".

## 2. E2E "mã giảm giá cho giỏ hàng"

Sandbox ngoài repo (`shop4`), dựng theo `e2e/README.md`. Session `740b4a86-…`, 3 lượt:

| Lượt | Nội dung | Chi phí (USD) | Số turn |
|---|---|---|---|
| 1 | `turn-1.txt` | 0,25 | 7 |
| 2 | chọn 1.1, 2.1, 3.1 + 3.3 (giới hạn lượt), tình huống dịp lễ, đi tiếp theo route | 0,44 | 4 |
| 3 | "1 — Duyệt và chạy workflow-feature … đến G3" | 2,40 | 49 |

Không cần lượt 4 (lượt gốc dùng lượt 4 để sửa AC sai số; lần này không có AC sai).

Kết quả: nhánh `feature/cart-coupon-discount`, 3 commit; `src/cart.mjs` +25 dòng, test 15/15 pass; `check-request.mjs` 0 cảnh báo; review cuối 0 blocker, 0 major.

Oracle (`node oracle.mjs aip-obj <shop4>/src/cart.mjs`): **11/12**. Ca trượt duy nhất là "chuẩn hoá hoa/thường + khoảng trắng". Bản này nhận đối tượng coupon, còn việc tra mã thuộc bên gọi (brief, lựa chọn 2.1), nên ca này không áp dụng. Kết quả trên các ca áp dụng: 11/11. Adapter `aip-obj` thêm vào `oracle.mjs`; không sửa ca.

## 3. Chấm theo rubric (mục Kiểm thử của `design.md`)

| Phần | Lượt trước (aip) | Lượt này | Bằng chứng |
|---|---|---|---|
| Làm rõ | 7 | **8** | Đạt: lượt 1 đọc `src/cart.mjs` rồi chỉ hỏi điều code không trả lời ("Mình đã đọc repo: `src/cart.mjs` chỉ có hàm thuần `subtotal(items)`…"); brief có ở lượt 2. Không đạt: thẻ đầu không có ca biên số nào kèm mặc định dẫn code. Làm tròn xuống, `total ≥ 0`, hạn tính cả mốc và rủi ro đếm đồng thời chỉ xuất hiện ở brief lượt 2 (`brief.md:28-34`) dưới dạng quyết định của agent, không dẫn `file:line`. |
| Spec / AC | 7 | **8,5** | Đạt: W22 = 0; AC1.2–AC1.4 có `calc:` đúng; tính năng người dùng nêu (giới hạn lượt dùng) bị cắt một phần (bên gọi tự tăng `used`) nhưng được nêu rõ ở thẻ duyệt brief và người dùng đã duyệt. Không đạt: AC1.1 nêu `discount = 10000, total = 90000` mà không có `calc:` (`requirement.md:30`). |
| Gọn / đúng phạm vi | 6 | **9** | Đạt: 25 dòng code, 15 test (lượt trước 42 dòng code); hai finding ngoài AC (kiểm `items` hỏng, `null` trong coupon) được đưa lên G3 hỏi người dùng, không tự sửa; không kiểm đầu vào cho dữ liệu nội bộ. Oracle 11/12, ca trượt không áp dụng cho API này. Còn sót: `now` thiếu khi có `expiresAt` trả `invalid`, AC1.8 không nêu rõ. |

### Hai phần còn dưới 9 và nguyên nhân

- **Làm rõ (8).** [Inference] `brainstorming/SKILL.md` mô tả thẻ hỏi đầu (dòng ~44–51) mà không trỏ tới mục "Rà ca biên" của `clarify-core.md`. Vì vậy agent chỉ rà ca biên khi viết brief, sau khi người dùng đã trả lời. Muốn sửa thì bước tạo thẻ đầu phải gọi tới mục đó. Eval AC1.2 không bắt được lỗi này vì cả hai nhánh đều đạt.
- **Spec / AC (8,5).** Quy tắc "AC nêu kết quả số phải kèm `calc:`" chỉ do skill bắt buộc. Theo quyết định B2, W22 không cảnh báo khi AC thiếu `calc:`, nên AC1.1 lọt. Lượt này agent tự ghi `requirement.md` (cỡ thay đổi nhỏ, không giao `engineering-spec-analyst`). Builder check vẫn chạy nhưng không bắt được AC1.1.

Không chấm nới: hai phần trên chưa đạt mức ≥ 9 của AC4.1.

## 4. Giới hạn của lượt đo

- n = 1, mỗi nhánh một lượt; kết quả dao động giữa các lượt chưa đo.
- Không chạy lại nhánh đối chứng E2E. Số so sánh lấy từ lượt trước (`baseline` 10/12, chấm 6,8).
- `~/.claude/CLAUDE.md` mang baseline aip vẫn được nạp, nên là yếu tố gây nhiễu (như lượt trước).
