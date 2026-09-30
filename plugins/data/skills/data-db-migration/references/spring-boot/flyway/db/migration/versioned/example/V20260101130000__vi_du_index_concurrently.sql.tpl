-- Chạy NGOÀI transaction (file .conf cùng tên): PostgreSQL cấm CREATE INDEX CONCURRENTLY trong transaction.
-- Fail giữa chừng để lại index INVALID: DROP INDEX CONCURRENTLY IF EXISTS rồi chạy lại.
SET lock_timeout = '5s';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_customer_id ON invoice (customer_id);
-- SET ngoài transaction có hiệu lực cả session; không reset thì lọt sang migration sau trên cùng connection.
RESET lock_timeout;
