-- Repeatable: Flyway chạy lại khi checksum đổi, SAU mọi migration V trong cùng lần chạy.
CREATE OR REPLACE FUNCTION invoice_total(p_invoice_id bigint)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0) FROM invoice_line WHERE invoice_id = p_invoice_id;
$$;
