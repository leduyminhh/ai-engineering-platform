-- Mẫu pha EXPAND: thêm cột nullable, code bản đang chạy không bị ảnh hưởng.
-- lock_timeout: chờ khoá quá lâu thì fail để chạy lại, thay vì chặn mọi truy vấn xếp hàng phía sau.
SET LOCAL lock_timeout = '5s';

ALTER TABLE invoice ADD COLUMN note text;
