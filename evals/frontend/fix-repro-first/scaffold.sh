#!/usr/bin/env bash
# Dựng hook React tối thiểu có test vitest đỏ (lỗi lệch biên); không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/hooks
cat > src/hooks/usePagination.ts <<'TS'
export function usePagination<T>(items: T[], page: number, pageSize: number) {
  const start = page * pageSize;
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
