# ASVS Level 2: điền checklist của tổ chức

ASVS L2 dùng checklist của tổ chức, không do agent soạn. Agent không tự tạo, không bổ sung, không bớt yêu cầu
ASVS, và không sinh biên bản. Script `go-live-gate.mjs` không đọc ASVS; kết quả ASVS nằm trong report.

## Nguồn

- Checklist dạng csv hoặc md.
- Checklist dạng xlsx: nhờ người dùng xuất csv hoặc md trước khi điền. Agent không đọc xlsx trong quy trình này.
- Không có file checklist: trạng thái ASVS trong report là `chưa đo`. Không ghi "đạt" và không liệt kê yêu cầu
  thay cho checklist.

## Điền trạng thái

Mỗi mục checklist được điền một dòng:

| Mã mục | Yêu cầu (nguyên văn từ checklist) | Trạng thái | Evidence | Ghi chú |
|---|---|---|---|---|
| `<mã>` | `<yêu cầu>` | đạt | `<đường-dẫn>:<dòng>` | |
| `<mã>` | `<yêu cầu>` | không đạt | `<đường-dẫn>:<dòng>` | `<lý do ngắn>` |
| `<mã>` | `<yêu cầu>` | chưa kiểm | | `<lý do chưa kiểm>` |

- Trạng thái mục: `đạt`, `không đạt`, `chưa kiểm`.
- Mục `đạt` và `không đạt` phải có evidence dạng `file:line` cụ thể. Không có evidence thì mục là `chưa kiểm`.
- Mục `chưa kiểm` ghi lý do: thiếu quyền đọc, thiếu môi trường chạy, hoặc phạm vi không có thành phần đó.
- [Unverified] Tên cột và thứ tự cột của checklist tổ chức chưa kiểm; giữ nguyên cột của checklist khi có thể.

## Gợi ý CWE

Với mục `không đạt`, có thể tra [owasp-asvs-cwe-mapping.md](owasp-asvs-cwe-mapping.md) để gợi ý CWE. Gợi ý
không thay thế mục checklist và không đưa CWE vào chỉ tiêu ngưỡng.

## Ranh giới

- Không soạn yêu cầu ASVS, không suy diễn yêu cầu từ tên mục.
- Không sinh biên bản ASVS hoặc biên bản kiểm tra; báo cáo chỉ chứa bảng trạng thái.
- Không chạy kiểm thử động để điền mục. Mục cần kiểm thử động ghi `chưa kiểm` kèm lý do.
