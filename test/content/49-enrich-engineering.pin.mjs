// Pin: làm giàu plugin engineering từ dùng thật — Files đủ, kiểm khẳng định DOCS, kiểm AC mâu thuẫn, skill nghiên cứu API (request 2026-11-11-skill-enrichment-from-usage).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => { try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const PW = 'plugins/engineering/skills/engineering-plan-writing/references';
  const SR = read(`${PW}/self-review.md`);
  const PS = read(`${PW}/plan-structure.md`);

  // AC3.1: mục 6 "Files đủ" có vế file test/fixture/cấu hình khẳng định số đếm; vẫn đúng 6 mục
  const item6 = (SR.match(/^6\. \*\*Files đủ[\s\S]*?(?=^Sau 6 mục)/m) || [''])[0].replace(/\n\s*/g, ' ');
  ok(/test, fixture, cấu hình hoặc catalog/.test(item6), 'AC3.1: mục 6 nêu file test, fixture, cấu hình hoặc catalog khẳng định số đếm/hằng');
  ok(/số đếm/.test(item6) && /grep[^\n]*giá trị cũ/.test(item6), 'AC3.1: mục 6 tìm file đó bằng grep trên giá trị cũ');
  ok((SR.match(/^\d+\. \*\*/gm) || []).length === 6, 'AC3.1: self-review.md còn đúng 6 mục đánh số');

  // AC3.3: kind DOCS có step đối chiếu khẳng định với code; self-review mục 2 nhắc
  const docs = (PS.match(/^## Task DOCS[^\n]*\n([\s\S]*?)(?=^## )/m) || [, ''])[1];
  ok(docs !== '', 'AC3.3: plan-structure có mục riêng cho task DOCS');
  ok(/khẳng định → file:line → khớp\|lệch/.test(docs), 'AC3.3: DOCS ghi bảng khẳng định → file:line → khớp|lệch');
  ok(/tên hàm[\s\S]{0,80}số[\s\S]{0,80}đường dẫn[\s\S]{0,80}lệnh[\s\S]{0,80}mặc định/.test(docs), 'AC3.3: DOCS liệt kê loại khẳng định kiểm được');
  ok(/\[Unverified\]/.test(docs) && /grep hoặc đọc/.test(docs), 'AC3.3: lệch thì sửa docs hoặc gắn [Unverified]; đối chiếu bằng grep hoặc đọc');
  const item2 = (SR.match(/^2\. \*\*[\s\S]*?(?=^3\. )/m) || [''])[0];
  ok(/DOCS/.test(item2) && /khẳng định/.test(item2), 'AC3.3: mục 2 của self-review nhắc bước đối chiếu khẳng định cho task DOCS');
}
