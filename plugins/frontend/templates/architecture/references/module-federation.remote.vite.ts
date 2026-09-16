// Artifact mẫu: cấu hình Vite cho REMOTE (miền tự chủ) trong hệ Micro-Frontend.
// Remote build/deploy độc lập, phát hành remoteEntry.js riêng, và `expose` TỐI
// THIỂU một/vài module công khai (page-level hoặc widget nhúng). Ngoài các module
// `expose`, ruột remote (tổ chức theo FSD) là riêng tư. File THAM CHIẾU đi kèm
// react-micro-frontend.template.md — copy về rồi chốt version/tên option theo dự án.
//
// Package @module-federation/vite đã xác minh tồn tại trên npm (1.21.6 @ 2026-09-15).
// Tên export và shape chính xác của `exposes`/`shared`/`filename` còn [Unverified] —
// đối chiếu docs package khi cài; version chốt theo release thực tế của dự án.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// [Unverified] Xem ghi chú plugin ở module-federation.host.vite.ts.
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      // Tên này phải khớp với key khai trong `remotes` của host.
      name: 'invoices',

      // Tên file entry mà host trỏ tới qua URL remoteEntry (mặc định thường là
      // 'remoteEntry.js'). Khai tường minh để URL phía host ổn định.
      filename: 'remoteEntry.js',

      // Mặt phơi công khai — coi như "hợp đồng" của remote: giữ NHỎ và ỔN ĐỊNH.
      // Đổi ruột remote tự do, nhưng đổi mặt `expose` là breaking cho host.
      exposes: {
        // Module page-level: remote tự quản route con của mình (/invoices/:id).
        './InvoicesApp': './src/expose/InvoicesApp.tsx',
        // Widget nhúng (tùy chọn): chỉ thêm khi miền khác thực sự cần nhúng.
        // './InvoiceWidget': './src/expose/InvoiceWidget.tsx',
      },

      // PHẢI khớp cấu hình shared của host: cùng singleton, cùng dải version,
      // nếu không sẽ nạp trùng React -> hook/context vỡ.
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        // 'react-router-dom': { singleton: true },
        // '@tanstack/react-query': { singleton: true },
      },
    }),
  ],

  build: {
    target: 'esnext',
  },

  // Remote chạy độc lập (dev/test tách host) trên cổng riêng, cố định để URL
  // remoteEntry phía host trỏ đúng khi phát triển cục bộ.
  server: {
    port: 5001,
    // CORS mở để host ở origin khác nạp được remoteEntry khi dev.
    cors: true,
  },
});
