# Mẫu báo cáo cuối

```text
## Kết quả <release|hotfix> vX.Y.Z — <tên repo>

| Mục               | Giá trị                                               |
|-------------------|-------------------------------------------------------|
| Version           | A.B.C → X.Y.Z (<bump>: n feat, n fix, n breaking)     |
| Branch            | <release|hotfix>/X.Y.Z (từ <base> @ <hash>)           |
| Commit release    | <hash> chore(release): vX.Y.Z                         |
| Chặng promotion   | <chặng>: <hash> — đã push / còn chờ                   |
| Tag               | vX.Y.Z (annotated) @ <hash> — đã push / còn chờ       |
| Merge-back        | <branch> @ <hash> — đã push / còn chờ / không có      |
| GitHub Release    | <URL> / bỏ qua (<lý do>)                              |
| Branch release    | đã xoá / giữ                                          |
| Baseline build/test | <lệnh> → <kết quả> / không chạy (<lý do>)           |

Hash lúc preflight (để hoàn tác): <branch>=<hash>, …
Checkpoint đã qua: <danh sách>
Bỏ qua / chưa chạy: <danh sách hoặc "không có">
Business rules đã trình: <ID hoặc "không có">
Rủi ro còn lại: deploy do người dùng thực hiện; skill không kiểm trạng thái deploy.
```
