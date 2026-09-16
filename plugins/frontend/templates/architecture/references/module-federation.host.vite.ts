// Artifact mẫu: cấu hình Vite cho HOST (shell) trong hệ Micro-Frontend.
// Host khai `remotes` (map tên -> URL remoteEntry) và `shared` singleton để cả
// host lẫn mọi remote dùng CHUNG một bản React. Đây là file THAM CHIẾU đi kèm
// react-micro-frontend.template.md — copy về rồi chốt version/tên option theo dự án.
//
// Package đã xác minh tồn tại trên npm (registry, tính đến 2026-09-15):
// @module-federation/vite@1.21.6. Tên export và shape chính xác của `remotes`/`shared`
// còn [Unverified] — đối chiếu docs package khi cài (xem references/integration-patterns.md,
// mục "Chốt gì khi triển khai"); version chốt theo release thực tế của dự án.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Plugin chính chủ của team Module Federation cho Vite (@module-federation/vite, npm latest 1.21.6 @ 2026-09-15).
// Biến thể cũ: '@originjs/vite-plugin-federation' (latest 1.4.1; export mặc định, tên option lệch).
import { federation } from '@module-federation/vite';

// URL remoteEntry đọc từ env theo môi trường (dev/stg/prod) — KHÔNG hardcode.
// Đổi endpoint remote = đổi biến môi trường, không build lại host.
const REMOTE_INVOICES = process.env.VITE_REMOTE_INVOICES_URL
  ?? 'http://localhost:5001/assets/remoteEntry.js';
const REMOTE_CUSTOMERS = process.env.VITE_REMOTE_CUSTOMERS_URL
  ?? 'http://localhost:5002/assets/remoteEntry.js';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'host',

      // Map tên remote -> URL remoteEntry.js. Host lazy-load module mà remote
      // `expose`; tên bên trái phải khớp với `name` khai ở từng remote.
      remotes: {
        invoices: REMOTE_INVOICES,
        customers: REMOTE_CUSTOMERS,
      },

      // Deps nền chia sẻ. `singleton: true` ép cả host + remote dùng đúng MỘT
      // bản — nhiều bản React/react-dom sẽ làm hook/context vỡ khó lần.
      // `requiredVersion` giữ host + remote cùng dải version; lệch major có thể
      // buộc nạp hai bản (nặng, dễ lỗi) nên đồng bộ qua workspace.
      shared: {
        react: { singleton: true, requiredVersion: '^18.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
        // Chia sẻ thêm khi host + remote thực sự dùng chung MỘT instance:
        // 'react-router-dom': { singleton: true },
        // '@tanstack/react-query': { singleton: true },
      },
    }),
  ],

  // Module Federation cần target hỗ trợ top-level await để nạp remote runtime.
  build: {
    target: 'esnext',
  },
});
