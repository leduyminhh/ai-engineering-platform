# Lighthouse CLI — đo LCP/TBT/CLS cho chế độ `measure`

Tài liệu tham chiếu cho `frontend-performance`, chế độ `measure`. Mọi lệnh, cờ và tên trường JSON của
Lighthouse trong file này chưa được đối chiếu với tài liệu chính thức của phiên bản project đang dùng → gắn
`[Unverified]`; kiểm lại với output `npx lighthouse --version` `[Unverified]` và `--help` của đúng phiên bản.

## Khi nào dùng

- Đo số **lab** LCP, TBT, CLS (kèm điểm Performance nếu cần) của một route trên bản build production phục vụ ở
  local (`serve-production-build.md`).
- Project đã có công cụ đo khác (Lighthouse CI, Playwright + trace) → **dùng công cụ đó**, giữ nguyên tắc bảng
  điều kiện.
- Chưa có Lighthouse: thêm `lighthouse` làm devDependency là thay đổi tool → **hỏi trước**, chạy như subagent thì
  trả `blocked` + câu hỏi. `npx` tải gói tạm cũng là thêm tool → hỏi trước.
- Cần **Chrome cài sẵn** trên máy. Không có Chrome → `not_run` + lý do (P1), không tự cài.

## Giới hạn của số lab

- Lighthouse chạy một lần nạp trang trong môi trường giả lập; chế độ navigation mặc định **không báo INP** (không
  có tương tác người dùng). `[Unverified]` chế độ timespan/user-flow có thể ghi INP lab, ngoài phạm vi recipe này.
  Số báo cáo là **TBT**, nói rõ đó không phải INP.
- Chỉ số người dùng thật (RUM, CrUX) ngoài phạm vi.
- **Không** dùng PageSpeed Insights hay WebPageTest công cộng: các dịch vụ đó nhận URL từ bên ngoài, vi phạm P1
  và không chạy được với `localhost`.

## Lệnh chạy mẫu

```bash
# [Unverified] cờ --output, --output-path, --only-categories, --preset, --chrome-flags; kiểm theo phiên bản thật
npx lighthouse http://localhost:4173/orders \
  --output=json --output-path=perf/frontend/run-1.json \
  --only-categories=performance --chrome-flags="--headless"
# Desktop: thêm --preset=desktop [Unverified]; bỏ cờ này thì dùng cấu hình mobile mặc định.
# Lặp run-2, run-3 với cùng lệnh, chỉ đổi --output-path.
```

- Cờ throttle (CPU slowdown, network) nếu đổi khỏi mặc định phải ghi nguyên văn vào hàng Thiết bị/throttle.
- Host chỉ là `localhost`/`127.0.0.1`. URL ngoài (staging, production, site công khai) → từ chối, báo.
- Luồng cần đăng nhập: dùng tài khoản test, token/cookie qua biến môi trường, chỉ nêu tên biến; Lighthouse CLI
  thuần không tự đăng nhập → cần script Puppeteer/Playwright của project, ngoài phạm vi recipe này nếu chưa có.

## Script Node lấy median từ JSON

`perf/frontend/summarize.mjs` đọc các file `run-*.json`. Tên audit `[Unverified]` theo phiên bản Lighthouse.

```js
import fs from 'node:fs';

const files = process.argv.slice(2);
const pick = (r) => ({
  lcp: r.audits['largest-contentful-paint'].numericValue,
  tbt: r.audits['total-blocking-time'].numericValue,
  cls: r.audits['cumulative-layout-shift'].numericValue,
});
const runs = files.map((f) => pick(JSON.parse(fs.readFileSync(f, 'utf8'))));
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
// Số lần chẵn: lấy phần tử trên giữa, không nội suy, để số báo cáo luôn là một giá trị đo thật.
const spread = (xs) => (Math.max(...xs) - Math.min(...xs)) / median(xs);

for (const k of ['lcp', 'tbt', 'cls']) {
  const xs = runs.map((r) => r[k]);
  console.log(k, 'median', median(xs), 'độ lệch', spread(xs).toFixed(3), 'thô', xs.join(', '));
}
```

```bash
node perf/frontend/summarize.mjs perf/frontend/run-1.json perf/frontend/run-2.json perf/frontend/run-3.json
```

## Đọc kết quả (P3)

- Chạy **≥ 3 lần**, cùng lệnh, mỗi lần một file JSON. Độ lệch LCP/TBT > ngưỡng (mặc định 10%) → cảnh báo, không
  kết luận; tăng số lần lặp hoặc cô lập nhiễu (`measure-conditions.md`).
- CLS gần 0 làm độ lệch tương đối phóng đại; báo dãy số thô và không kết luận chỉ từ CLS khi giá trị rất nhỏ.
- Thư mục `perf/frontend/` chứa output đo; hỏi người dùng có commit hay thêm vào `.gitignore`.
- Ghi nguyên văn lệnh, phiên bản Lighthouse/Chrome (lấy từ output) và **residual risk** vào báo cáo.

## Cảnh báo an toàn

- Chạy Lighthouse bằng Chrome headless có thể tải extension/profile của người dùng nếu cấu hình sai: dùng profile
  sạch mặc định của Lighthouse, không trỏ vào profile Chrome đang đăng nhập.
- Không đưa JSON/trace lên dịch vụ ngoài; báo cáo chỉ chứa số và lệnh, không chứa token hay cookie.
- Máy chạy đo cũng chạy server phục vụ → tranh CPU; ghi vào residual risk.
