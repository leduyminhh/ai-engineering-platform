#!/usr/bin/env bash
# Dựng component React tối thiểu có lỗi rõ ràng; không cần mạng, chỉ dùng heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/components
cat > src/components/ProductList.tsx <<'TSX'
import { useEffect, useState } from 'react';

type Product = { id: number; name: string; imageUrl: string };

export function ProductList({ category }: { category: string }) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    fetch(`/api/products?category=${category}`)
      .then((r) => r.json())
      .then((data) => setItems(data));
  }, []);

  return (
    <ul>
      {items.map((p) => (
        <li>
          <img src={p.imageUrl} />
          {p.name}
        </li>
      ))}
    </ul>
  );
}
TSX
