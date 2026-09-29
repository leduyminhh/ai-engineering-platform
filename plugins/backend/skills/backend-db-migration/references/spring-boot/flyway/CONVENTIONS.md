# Quy ước Flyway

```
V<yyyyMMddHHmmss>__<mo_ta_khong_dau>.sql    versioned — ĐÃ APPLY LÀ BẤT BIẾN
R__<ten_object>.sql                          repeatable — chạy lại khi checksum đổi, SAU mọi V
<tên file migration>.conf                    cấu hình riêng cho một file (transaction, điều kiện)
```

- Separator giữa version và mô tả là **hai** dấu `_`. `validate-migration-naming: true` làm job fail khi sai.
- Sinh file bằng `scripts/new-migration.sh flyway <domain> "<mo ta>"`; không tự gõ version.
- Thư mục: `baseline/` (chỉ đường greenfield), `versioned/<domain>/`, `repeatable/`. Flyway quét đệ quy một location
  `classpath:db/migration`; thứ tự do version quyết định, không do thư mục.
- **Bất biến:** file đã có trên base branch (hoặc đã áp ở bất kỳ môi trường nào) không được sửa. Sửa = thêm file mới.
  Không dùng `repair` để "cho qua" lỗi checksum.
- **Forward-only:** không viết undo `U__`. Hoàn tác = migration bù mới, theo pattern ở
  `references/change/change-patterns.md` của skill.
- Mỗi migration đổi cấu trúc đặt `SET LOCAL lock_timeout = '5s';` ở đầu file.
- `CREATE INDEX CONCURRENTLY` cần file `.conf` cùng tên chứa `executeInTransaction=false`.
- Một migration = một pha (expand | migrate data | contract); pha contract ở PR sau.
