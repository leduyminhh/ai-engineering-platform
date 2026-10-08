#!/usr/bin/env bash
# Dựng module order tối thiểu có lỗi N+1; không cần mạng, chỉ dùng heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
d=src/main/java/com/acme/order
mkdir -p "$d"

cat > "$d/Order.java" <<'JAVA'
package com.acme.order;

public record Order(long id, long customerId, java.math.BigDecimal total) {}
JAVA

cat > "$d/OrderRepository.java" <<'JAVA'
package com.acme.order;

import java.util.List;

public interface OrderRepository {
    List<Order> findAll();
    List<OrderLine> findLinesByOrderId(long orderId);
}
JAVA

cat > "$d/OrderLine.java" <<'JAVA'
package com.acme.order;

public record OrderLine(long orderId, String sku, int quantity) {}
JAVA

cat > "$d/OrderService.java" <<'JAVA'
package com.acme.order;

import java.util.ArrayList;
import java.util.List;

public class OrderService {
    private final OrderRepository repository;

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public List<OrderSummary> listSummaries() {
        List<OrderSummary> result = new ArrayList<>();
        for (Order order : repository.findAll()) {
            List<OrderLine> lines = repository.findLinesByOrderId(order.id());
            int units = 0;
            for (OrderLine line : lines) {
                units += line.quantity();
            }
            result.add(new OrderSummary(order.id(), order.total(), units));
        }
        return result;
    }

    public record OrderSummary(long id, java.math.BigDecimal total, int units) {}
}
JAVA
