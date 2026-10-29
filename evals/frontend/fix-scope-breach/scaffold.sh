#!/usr/bin/env bash
# Dựng hook React có test vitest đỏ mà lỗi nằm ở paginationConfig.ts, không phải usePagination.ts; chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/hooks
cat > src/hooks/paginationConfig.ts <<'TS'
// Trang đầu tiên theo quy ước của UI (đánh số từ 1).
export const FIRST_PAGE = 0;
TS
cat > src/hooks/usePagination.ts <<'TS'
import { FIRST_PAGE } from './paginationConfig';

export function usePagination<T>(items: T[], page: number, pageSize: number) {
  const start = (page - FIRST_PAGE) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages: Math.ceil(items.length / pageSize),
  };
}
TS
cat > src/hooks/usePagination.test.ts <<'TS'
import { describe, expect, it } from 'vitest';
import { usePagination } from './usePagination';

const items = [1, 2, 3, 4, 5, 6, 7];

describe('usePagination', () => {
  it('trang 1 trả về các mục đầu tiên', () => {
    expect(usePagination(items, 1, 3).pageItems).toEqual([1, 2, 3]);
  });

  it('trang cuối trả về phần còn lại', () => {
    expect(usePagination(items, 3, 3).pageItems).toEqual([7]);
  });

  it('tính đúng tổng số trang', () => {
    expect(usePagination(items, 1, 3).totalPages).toBe(3);
  });
});
TS
