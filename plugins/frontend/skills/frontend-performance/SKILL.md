---
name: frontend-performance
description: "Recipe on-demand: ĐO và PROFILE hiệu năng FRONTEND (React/TypeScript) — chế độ measure chốt bảng điều kiện đo (route/luồng, build, cách phục vụ bản build production ở local, preset thiết bị + throttle, trạng thái cache, số lần lặp), viết/tái dùng script đo ở perf/ (Lighthouse CLI), chạy ≥3 lần trên bản build production, báo median LCP/TBT/CLS, kích thước bundle và độ lệch; chế độ profile tìm bottleneck theo thứ tự bundle (analyzer) → render (React Profiler) → main thread (Chrome trace) có evidence, và đề xuất danh sách file/component cho frontend-fix. Lighthouse là số lab, không đo được INP (dùng TBT thay thế). Chỉ chạy trên local/test, từ chối staging/production và dịch vụ đo của bên thứ ba; thiếu môi trường → not_run. KHÔNG sửa code (đó là frontend-fix); KHÔNG thay test đúng/sai (đó là frontend-testing/frontend-e2e-testing). Dùng skill NÀY khi người dùng muốn \"đo hiệu năng frontend\", \"Lighthouse\", \"LCP\", \"bundle size\", \"profile React\", \"render chậm\", \"trang tải chậm\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 10
stageNumber: "10"
title: "Frontend Performance — Đo và profile hiệu năng frontend có điều kiện tái lập (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Frontend Performance — Đo và profile hiệu năng frontend có điều kiện tái lập (recipe on-demand)

Recipe hướng dẫn agent **đo** hiệu năng FRONTEND (React/TypeScript) với **điều kiện tái lập được** và **profile**
để tìm bottleneck **có evidence**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc, KHÔNG phải bộ công
cụ dựng sẵn. Gọi độc lập hoặc từ Bước 2 (Baseline), Bước 3 (Profile & giả thuyết), Bước 5 (Benchmark & so sánh)
của `workflow-performance`.

Khác backend: số đo lấy trên **bản build production** (không phải dev server), là số **lab** (không phải người
dùng thật), và kích thước bundle là chỉ số **xác định** (không nhiễu như latency).

## Ranh giới với skill lân cận

| Skill | Việc |
|---|---|
| `frontend-testing`, `frontend-e2e-testing` | test đúng/sai (pass/fail) |
| **`frontend-performance`** | **đo số** (lab) + **tìm bottleneck**; không sửa code |
| `frontend-fix` chế độ `performance` | sửa theo giả thuyết; không tự kết luận nhanh hơn |
| `frontend-code-review` | đọc diff tìm lỗi/thiết kế; không đo |
| `backend-performance` | phía backend của cùng workflow |

## Hai chế độ

### `measure` — Baseline (Bước 2) và Benchmark (Bước 5)

1. Chốt **bảng điều kiện đo** theo mẫu [references/measure-conditions.md](references/measure-conditions.md):
   route/luồng, build (commit SHA + `git diff --name-only`), cách phục vụ **bản build production** ở local (lệnh,
   port — [references/serve-production-build.md](references/serve-production-build.md)), preset thiết bị + throttle
   của Lighthouse, trạng thái cache (lạnh/ấm), số lần lặp, công cụ + phiên bản (lấy từ output lệnh), ngưỡng độ
   lệch (mặc định 10%), Config tool đo.
2. Viết hoặc tái dùng script đo ở `perf/` (Lighthouse CLI qua lệnh hoặc script Node —
   [references/lighthouse-cli.md](references/lighthouse-cli.md)) và cách lấy kích thước bundle từ output build.
   Ưu tiên công cụ project đã có; thiếu → đề xuất mặc định (Lighthouse CLI, cần Chrome cài trên máy) và **hỏi
   trước** khi thêm tool/dependency. Micro-benchmark logic thuần (nếu có) đặt ở `bench/`.
3. Chạy **≥ 3 lần** trên **bản build production** phục vụ ở local; **không đo trên dev server** (HMR, source map,
   React dev build làm số đo vô nghĩa). Ghi **median** LCP, TBT, CLS (kèm điểm Performance nếu cần) và kích thước
   bundle (tổng + chunk lớn nhất); báo độ lệch giữa các lần.
4. Ở Bước 5: đọc bảng điều kiện + script của Bước 2, **build lại và phục vụ lại** từ working tree, xác nhận là bản
   mới bằng hash file build/tên chunk khác baseline (trùng baseline → dừng, báo: chưa phải bản mới), rồi **chạy
   lại nguyên trạng**. Điều kiện lệch (build khác ngoài thay đổi tối ưu, throttle khác, cache khác) → từ chối so
   sánh, báo. Bảng điều kiện và script chốt ở cuối Bước 2; sau đó không sửa — cần đổi điều kiện thì quay lại
   Bước 2 đo lại baseline.

Báo rõ trong report: Lighthouse đo **lab**, **không** phản ánh INP (không đo được INP trong lab); **TBT** là chỉ
số thay thế. Chỉ số người dùng thật (RUM) ngoài phạm vi.

### `profile` — Profile & giả thuyết (Bước 3)

Thứ tự tầng rẻ → đắt; dừng ở tầng tìm ra bottleneck có evidence:

1. **Bundle:** bundle analyzer / stats build — chunk lớn, dependency nặng, code trùng, thiếu code-splitting —
   [references/bundle-analysis.md](references/bundle-analysis.md).
2. **Render:** React Profiler — component render nhiều/lâu, commit thừa —
   [references/profiling-react.md](references/profiling-react.md).
3. **Main thread:** Chrome performance trace — long task, layout/style thrash, script evaluation —
   [references/chrome-trace.md](references/chrome-trace.md).

Đầu ra: bottleneck + evidence (số đo, `file:line` hoặc tên chunk/component), giả thuyết nguyên nhân, **danh sách
file/component đề xuất sửa** (đầu vào của `frontend-fix`). Lệnh/config bật profiler ghi vào **report Bước 3**
(hoặc `perf/profile-<luồng>.md`), không ghi vào bảng điều kiện đo của Bước 2.

## Ranh giới an toàn (CLAUDE.md)
- **Chỉ local/test.** Không đo trên dev server; không trỏ vào URL staging/production hay site công khai; không gửi
  URL/trace cho dịch vụ đo của bên thứ ba (PageSpeed Insights, WebPageTest công cộng). Không dùng hay in credential
  thật — luồng cần đăng nhập dùng tài khoản test qua biến môi trường (chỉ nêu tên biến). Thiếu môi trường →
  `not_run` + lý do; không tự dựng hạ tầng.
- **Không sửa code.** Chỉ ghi `perf/`, `bench/` và config tool đo; không sửa `src/`, không sửa test. Phát hiện
  bottleneck → chỉ đề xuất danh sách file cho `frontend-fix`.
- **Hỏi trước khi thêm tool/dependency** (Lighthouse CLI, bundle analyzer, plugin profiler). Chạy như subagent:
  trả `blocked` + câu hỏi, không tự thêm.
- **Không push thẳng main.** Script đo là artifact; con người **duyệt diff** trước khi commit.
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng số và lệnh THẬT; không dùng "nhanh hơn rõ rệt", "tối ưu hoàn toàn"; luôn nêu
  **residual risk** (nhiễu máy local, một thiết bị giả lập, lab ≠ người dùng thật).
- Lệnh/cờ công cụ trong `references/` chưa đối chiếu tài liệu chính thức gắn `[Unverified]`.

## Bảng gate
| # | Gate | Nội dung | Chế độ | Đỏ thì |
|---|------|---------|--------|--------|
| P1 | Môi trường | Chỉ chạy trên local/test; URL staging/production hoặc site công khai, hay dịch vụ đo của bên thứ ba → từ chối | cả hai | Thiếu môi trường (không có Chrome, không build được) → `not_run` + lý do; không tự dựng hạ tầng |
| P2 | Điều kiện đo | Bảng điều kiện đo đầy đủ TRƯỚC khi chạy; Bước 5 dùng lại bảng Bước 2 | `measure` | Thiếu mục → dừng, hỏi (chạy như subagent: trả `blocked` + câu hỏi) |
| P3 | Ổn định | ≥ 3 lần; độ lệch median LCP/TBT giữa các lần > 10% (mặc định, project ghi đè trong bảng điều kiện) → cảnh báo, không kết luận; kích thước bundle so trực tiếp (xác định) | `measure` | Tăng số lần lặp hoặc cô lập nhiễu |
| P4 | Evidence | Mọi giả thuyết có evidence đo được; không suy diễn chỉ từ đọc code | `profile` | Profile thêm |
| P5 | Phạm vi ghi | Chỉ ghi `perf/`, `bench/`, config tool đo đã liệt kê ở hàng Config tool đo; thêm tool/dependency → hỏi trước (chạy như subagent: trả `blocked` + câu hỏi); không sửa `src/`, không sửa test | cả hai | Gỡ thay đổi ngoài phạm vi |

## Sau khi xong
Báo: bảng điều kiện đo; bảng số (median LCP/TBT/CLS, kích thước bundle, độ lệch) + lệnh chạy; hoặc bottleneck +
evidence + giả thuyết + danh sách file/component đề xuất sửa; nhắc Lighthouse là số lab và TBT thay INP;
**residual risk**. Cần sửa code → route `frontend-fix`; cần test đúng/sai → route `frontend-testing` hoặc
`frontend-e2e-testing`.
