#!/usr/bin/env bash
# Dựng module Java tối thiểu có lỗi lệch biên khi tính giảm giá; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/main/java/shop
cat > src/main/java/shop/DiscountService.java <<'JAVA'
package shop;

public class DiscountService {
    // Đơn từ 1_000_000 trở lên được giảm 10%.
    public long applyDiscount(long total) {
        if (total > 1_000_000) {
            return total - total / 10;
        }
        return total;
    }
}
JAVA
