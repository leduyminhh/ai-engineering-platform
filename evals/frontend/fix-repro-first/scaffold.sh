#!/usr/bin/env bash
# Dựng hook React tối thiểu có lỗi lệch biên khi phân trang; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/hooks
cat > src/hooks/usePagination.ts <<'TS'
export function usePagination<T>(items: T[], page: number, pageSize: number) {
  // page bắt đầu từ 1.
  const start = page * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages: Math.ceil(items.length / pageSize),
  };
}
TS
