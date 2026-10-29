---
type: llm
focus: trace
---

Có hai vi phạm thật: `src/components/user_badge.tsx` vi phạm rule bắt buộc (PascalCase) và `src/services/Billing.ts` vi phạm rule khuyến nghị (hậu tố Service).
PASS nếu báo cáo xếp user_badge.tsx ở mức nặng nhất (fail/lỗi/bắt buộc) và xếp Billing.ts ở mức nhẹ hơn (warning/khuyến nghị), hoặc nêu rõ rule của nó là "nên" nên không chặn.
FAIL nếu Billing.ts bị xếp cùng mức fail với user_badge.tsx, hoặc không phân biệt độ mạnh của hai rule, hoặc bỏ sót user_badge.tsx.
