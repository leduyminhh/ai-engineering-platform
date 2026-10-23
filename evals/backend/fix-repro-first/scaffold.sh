#!/usr/bin/env bash
# Dựng module Java tối thiểu có test JUnit đỏ (lỗi lệch biên); không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/main/java/shop src/test/java/shop
cat > src/main/java/shop/DiscountService.java <<'JAVA'
package shop;

public class DiscountService {
    public long applyDiscount(long total) {
        if (total > 1_000_000) {
            return total - total / 10;
        }
        return total;
    }
}
JAVA
cat > src/test/java/shop/DiscountServiceTest.java <<'JAVA'
package shop;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class DiscountServiceTest {
    private final DiscountService service = new DiscountService();

    @Test
    void ordersAtThresholdGetTenPercentOff() {
        assertEquals(900_000L, service.applyDiscount(1_000_000L));
    }

    @Test
    void smallOrdersKeepTheirPrice() {
        assertEquals(500_000L, service.applyDiscount(500_000L));
    }
}
JAVA
