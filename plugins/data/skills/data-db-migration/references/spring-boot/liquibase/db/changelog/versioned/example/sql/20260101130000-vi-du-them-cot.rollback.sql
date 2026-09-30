-- lock_timeout: chờ khoá quá lâu thì fail để chạy lại, thay vì chặn mọi truy vấn xếp hàng phía sau.
SET LOCAL lock_timeout = '5s';

ALTER TABLE invoice DROP COLUMN note;
