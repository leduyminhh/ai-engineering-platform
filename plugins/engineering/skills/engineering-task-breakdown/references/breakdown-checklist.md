# Checklist trước Checkpoint 2

Chạy từng mục; mục nào chưa đạt → nêu rõ (fail-loud), không báo hoàn thành.

## Phủ & truy vết

- [ ] Mọi AC của mọi use case được phủ bởi ≥ 1 task (bảng AC → task trình trong chat ở Checkpoint 2; không bắt buộc ghi vào `tasks.md`).
- [ ] Mọi task có ≥ 1 AC truy vết về `AC<uc>.<n>`.
- [ ] Mọi task có trường Nguồn trỏ về input.

## Cấu trúc

- [ ] ID duy nhất, đúng dạng `UC<nn>-<loại>-<nn>` với `<loại>` ∈ `CT`/`DB`/`BE`/`FE`/`E2E` (`FE-UI` và `FE-INT` cùng dùng `FE`).
- [ ] Không có vòng phụ thuộc; phụ thuộc chỉ trỏ tới ID có thật.
- [ ] Phụ thuộc có tối thiểu bảng chuẩn (`BE` ← `CT`/`DB`; `FE-INT` ← `CT`/`FE-UI`; `E2E` ← `BE`/`FE-INT`; `FE-UI` không chờ `BE`); phụ thuộc ngoài bảng có lý do ở Ngữ cảnh.
- [ ] Không còn task size `L`.

## Nội dung

- [ ] Mọi task có đủ header chung (task-template-common §3).
- [ ] Task `BE` có đủ B1–B10; task `FE-UI` / `FE-INT` có đủ F1–F9; task `CT` / `DB` / `E2E` có đủ mục theo loại.
- [ ] Không mục nào bỏ trống (trừ `Owner` — luôn để trống cho teamlead): mục không áp dụng ghi `N/A — <lý do>`.
- [ ] Phần suy đoán đánh dấu **[giả định]** và có trong Câu hỏi mở.
- [ ] Đổi schema có task `DB` + gợi ý `workflow-db-change`.
- [ ] Không có quyết định kiến trúc tự chốt (nếu có → Câu hỏi mở + `engineering-adr`).

## Đầu ra

- [ ] `tasks.md` đặt đúng `docs/requests/<yyyy-mm-dd>-<slug>/`.
- [ ] Excel (nếu chọn) có cùng số task với bảng tổng của `tasks.md`; nếu fallback CSV đã báo rõ.
- [ ] Tiếng Việt còn nguyên dấu.
