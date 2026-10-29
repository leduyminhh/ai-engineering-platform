#!/usr/bin/env bash
# Dựng module Java có test JUnit đỏ mà lỗi nằm ở DiscountPolicy, không phải DiscountService; chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/main/java/shop src/test/java/shop
cat > src/main/java/shop/DiscountPolicy.java <<'JAVA'
package shop;

public final class DiscountPolicy {
    private DiscountPolicy() {}

    // Đơn từ ngưỡng này trở lên được giảm 10%.
    public static long threshold() {
        return 1_000_001L;
    }
}
JAVA
cat > src/main/java/shop/DiscountService.java <<'JAVA'
package shop;

public class DiscountService {
    public long applyDiscount(long total) {
        if (total >= DiscountPolicy.threshold()) {
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
