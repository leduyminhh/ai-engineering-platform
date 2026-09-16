// steiger.config.js — Steiger: linter kiến trúc/cấu trúc file CHÍNH THỨC của FSD.
// Đây là "fitness function" kiến trúc: chạy trong CI, vi phạm FSD = fail build.
//
// Cài:  npm i -D steiger @feature-sliced/steiger-plugin
// Chạy: npx steiger ./src           (kiểm 1 lần, dùng trong CI)
//       npx steiger ./src --watch   (vừa code vừa kiểm)
//
// Nguồn: https://github.com/feature-sliced/steiger  ·  https://feature-sliced.design
// Lưu ý: Steiger đang beta (config format đổi từ 0.5.0). Rule dưới đây theo bộ `recommended`.

import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  // Bật toàn bộ rule chuẩn FSD. Các rule chính trong `recommended`:
  //   fsd/forbidden-imports          — cấm import từ layer trên + cross-import slice cùng layer
  //   fsd/public-api                 — mỗi slice (và segment ở layer không-slice) phải có public API
  //   fsd/no-public-api-sidestep     — cấm import xuyên qua public API vào file nội bộ của slice
  //   fsd/no-segmentless-slices      — slice phải có ít nhất một segment (ui/api/model/lib/config)
  //   fsd/no-segments-on-sliced-layers — cấm đặt segment thẳng vào entities/features/... (thiếu slice)
  //   fsd/no-reserved-folder-names   — cấm thư mục con trùng tên segment chuẩn
  //   fsd/segments-by-purpose        — tên segment mô tả MỤC ĐÍCH, không phải bản chất (cấm components/hooks/types)
  //   fsd/insignificant-slice        — cảnh báo slice chỉ 1 hoặc 0 nơi tham chiếu (nên gộp/xoá)
  //   fsd/excessive-slicing          — cảnh báo quá nhiều slice rời rạc (nên gom nhóm)
  //   fsd/repetitive-naming          — nhất quán số ít/số nhiều khi đặt tên slice
  //   fsd/no-processes               — nhắc `processes` đã DEPRECATED, chuyển sang features/app
  //   fsd/ambiguous-slice-names      — cấm tên slice trùng tên segment của Shared
  //   fsd/no-layer-public-api        — cấm index.ts ở cấp LAYER (public API là của slice, không phải layer)
  //   fsd/no-ui-in-app / typo-in-layer-name / shared-lib-grouping — vệ sinh cấu trúc còn lại
  // (no-cross-imports, no-higher-level-imports, import-locality mặc định TẮT vì forbidden-imports đã bao.)
  ...fsd.configs.recommended,

  // Bỏ qua file không thuộc phạm vi kiểm kiến trúc (mock, story, snapshot test-fixture).
  { ignores: ['**/__mocks__/**', '**/*.stories.*'] },

  {
    // Shared là layer KHÔNG có slice: mỗi module (button, text-field...) tự expose public API riêng.
    // Mở `public-api` nếu team chủ ý import trực tiếp `@/shared/ui/button` để tree-shaking tốt hơn.
    files: ['./src/shared/**'],
    rules: {
      // 'fsd/public-api': 'off',
    },
  },
])
