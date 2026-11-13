// Pin: docs/requests/2026-11-13-frontend-visible-assert — AC hiển thị có assertion trên text/role; review bắt thông báo nằm trong vùng bị gỡ lúc loading.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (...p) => fs.readFileSync(path.join(REPO_ROOT, ...p), 'utf8').replace(/\r\n/g, '\n');
  const flat = (s) => s.replace(/\s*\n\s*/g, ' ');
  const FE = ['plugins', 'frontend', 'skills'];
  const testing = flat(read(...FE, 'frontend-testing', 'SKILL.md'));
  const dims = flat(read(...FE, 'frontend-code-review', 'references', 'review-dimensions.md'));

  // Chưa có contract nào kiểm ba quy tắc nội dung này; không pin thì có thể bị xoá lặng lẽ khi sửa skill.
  ok(/\| T7 \|[^|]*text hoặc role[^|]*trạng thái cuối/.test(testing),
    'AC1.1 frontend-testing: gate T7 đòi assertion trên text hoặc role ở trạng thái cuối chuỗi sự kiện');
  ok(dims.includes('**Thông báo do hành động gây ra nằm trong vùng bị gỡ khi loading:**'),
    'AC2.1 review-dimensions: Trục 1 có dấu hiệu thông báo nằm trong vùng bị gỡ khi loading');
  ok(/AC mô tả thứ người dùng thấy[^.]*trạng thái cuối chuỗi sự kiện/.test(dims.split('## Trục 6')[1] ?? ''),
    'AC2.2 review-dimensions: Trục 6 hỏi AC hiển thị có assertion ở trạng thái cuối chuỗi sự kiện');
}
