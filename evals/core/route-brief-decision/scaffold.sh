#!/usr/bin/env bash
# Dựng brief quyết-định không-code và bảng route rút gọn; chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail

cat > brief.md <<'MD'
# Brief: chốt cách ghi quyết định sau họp
- Ngày: 2026-11-01
- Trạng thái: approved

## Vấn đề và loại việc
Nhóm họp hàng tuần nhưng không ai nhớ đã quyết gì; cần chọn một cách ghi quyết định.
## Định tuyến
loại-việc: quyết-định
phạm-vi: không-code
đầu-ra-mong-đợi: một quyết định về cách ghi lại kết luận sau họp, kèm phương án đã loại
rủi-ro: không có
ứng-viên-route: [engineering-adr]
route-đã-duyệt:
MD

cat > orchestrator.md <<'MD'
## Registry

| id | Tín hiệu | Risk | Không dùng khi | loại-việc | phạm-vi | điều-kiện |
|---|---|---|---|---|---|---|
| `workflow-feature` | "thêm tính năng" | medium | x | feature | code-be, code-fe, fullstack | — |
| `workflow-bugfix` | "lỗi" | medium | x | bug | code-be, code-fe, fullstack | — |

**Thứ tự ưu tiên:** `workflow-bugfix` > `workflow-feature`

## Yêu cầu chạy trực tiếp bằng skill

| Tín hiệu | Skill | loại-việc | phạm-vi | điều-kiện |
|---|---|---|---|---|
| "quyết định", "chọn phương án", "ADR" | `engineering-adr` (plugin `engineering`) | quyết-định | * | — |
| "cập nhật tài liệu" | Session chính sửa trực tiếp | tài-liệu | * | — |

## Các bước
MD
