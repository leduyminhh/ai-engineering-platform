#!/usr/bin/env bash
# Dựng project có code-convention với một rule bắt buộc + một rule khuyến nghị bị vi phạm và thư mục generated/; chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p project-knowledge src/components src/services src/generated
cat > project-knowledge/code-convention.md <<'MD'
# Code convention

- Tên file component React **bắt buộc** đặt PascalCase (vd. `UserCard.tsx`).
- Lớp dịch vụ **nên** có hậu tố `Service` (vd. `OrderService.ts`).
- Thư mục `src/generated/` là code sinh tự động từ OpenAPI, không chỉnh tay.
MD
echo 'export const UserCard = () => null;' > src/components/UserCard.tsx
echo 'export const user_badge = () => null;' > src/components/user_badge.tsx
echo 'export class OrderService {}' > src/services/OrderService.ts
echo 'export class Billing {}' > src/services/Billing.ts
echo '// DO NOT EDIT - generated' > src/generated/api_client.ts
