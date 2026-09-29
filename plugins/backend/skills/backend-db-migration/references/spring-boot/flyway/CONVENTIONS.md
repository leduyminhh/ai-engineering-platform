# Quy ước Flyway

```
V<yyyyMMddHHmmss>__<mo_ta_khong_dau>.sql    versioned — ĐÃ APPLY LÀ BẤT BIẾN
R__<ten_object>.sql                          repeatable — chạy lại khi checksum đổi, SAU mọi V
<tên file migration>.conf                    cấu hình riêng cho một file (transaction, điều kiện)
```

- Separator giữa version và mô tả là **hai** dấu `_`. `validate-migration-naming: true` làm job fail khi sai.
- Sinh file bằng `scripts/new-migration.sh flyway <domain> "<mo ta>"`; không tự gõ version.
- Thư mục: `baseline/` (V0, luôn có; môi trường có schema sẵn bỏ qua V0 bằng baseline-on-migrate),
  `versioned/<domain>/`, `repeatable/`. Flyway quét đệ quy một location `classpath:db/migration`; thứ tự do version
  quyết định, không do thư mục.
- **Bất biến:** file đã có trên base branch (hoặc đã áp ở bất kỳ môi trường nào) không được sửa. Sửa = thêm file mới.
  Không dùng `repair` để "cho qua" lỗi checksum.
- **Forward-only:** không viết undo `U__`. Hoàn tác = migration bù mới, theo pattern ở
  `references/change/change-patterns.md` của skill.
- Mỗi migration đổi cấu trúc đặt `lock_timeout` ở đầu file, theo cách file chạy:
  - chạy trong transaction (mặc định): `SET LOCAL lock_timeout = '5s';`
  - có `.conf` chứa `executeInTransaction=false`: `SET lock_timeout = '5s';` … rồi `RESET lock_timeout;` cuối file
    (`SET LOCAL` ngoài transaction không có tác dụng; `SET` thường có hiệu lực cả session).
- `CREATE INDEX CONCURRENTLY` cần file `.conf` cùng tên chứa `executeInTransaction=false`.
  - Flyway mặc định dùng advisory lock dạng transaction trên PostgreSQL và ghi "nên đặt `false` cho lệnh như
    `CREATE INDEX CONCURRENTLY`"
    ([Flyway — PostgreSQL Transactional Lock Setting](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-postgresql-namespace/flyway-postgresql-transactional-lock-setting)).
    `[Unverified]` Giữ mặc định thì lock đó có thể làm `CREATE INDEX CONCURRENTLY` chờ mãi (index build chờ transaction
    đang giữ lock). `[Inference]` Key Spring tương ứng là `spring.flyway.postgresql.transactional-lock: false` (suy từ
    `FlywayProperties.Postgresql#setTransactionalLock`, Spring Boot 3.5 API); kiểm khi pilot trước khi dùng CONCURRENTLY.
- Một migration = một pha (expand | migrate data | contract); pha contract ở PR sau.
