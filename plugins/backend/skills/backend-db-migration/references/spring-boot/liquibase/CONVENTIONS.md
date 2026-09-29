# Quy ước Liquibase

```
db.changelog-master.yaml                     chỉ chứa include, không chứa change
<yyyyMMddHHmmss>-<mo-ta-gach-noi>.yaml       một nhóm changeSet
sql/<cùng tên>.sql                           SQL thô, changeSet trỏ vào bằng sqlFile
sql/<cùng tên>.rollback.sql                  SQL hoàn tác, block rollback trỏ vào
changeSet.id     = <yyyyMMddHHmmss>-<mo-ta>
changeSet.author = <tên thật hoặc email>
```

- Sinh file bằng `scripts/new-migration.sh liquibase <domain> "<mo ta>"`, rồi thêm dòng `include` script in ra vào
  master theo đúng thứ tự thời gian.
- **Mỗi changeSet có block `rollback`**; rollback kiểm được bằng chu trình ở `references/change/verify-cycle.md`.
- Repeatable = `runOnChange: true` trên changeSet (Liquibase không có thư mục/khái niệm repeatable riêng).
- File SQL có thân hàm trong `$$ … $$` đặt `splitStatements: false`.
- `CREATE INDEX CONCURRENTLY` đặt `runInTransaction: false` trên changeSet đó; changeSet không-transaction chỉ chứa
  **một lệnh DDL** (`references/change/change-patterns.md`, mục "Thêm index"). `[Inference]` `SET lock_timeout` /
  `RESET lock_timeout` là lệnh cấp session, không để lại trạng thái schema, nên được đi kèm lệnh DDL đó.
- **Bất biến:** changeSet đã có trên base branch không được sửa (trừ changeSet `runOnChange`). Không dùng
  `clearCheckSums` để "cho qua".
- Mỗi migration đổi cấu trúc đặt `lock_timeout` ở đầu file SQL — cả file `.sql` lẫn `.rollback.sql` — theo cách
  changeSet chạy:
  - chạy trong transaction (mặc định): `SET LOCAL lock_timeout = '5s';`
  - changeSet có `runInTransaction: false` (vd `CREATE INDEX CONCURRENTLY`): `SET lock_timeout = '5s';` … rồi
    `RESET lock_timeout;` cuối file (`SET LOCAL` ngoài transaction không có tác dụng; `SET` thường có hiệu lực cả
    session).
