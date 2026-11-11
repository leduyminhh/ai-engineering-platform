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

  // AC3.2: spec-writing bước 10 và checklist có mục kiểm AC mâu thuẫn
  const SW = 'plugins/engineering/skills/engineering-spec-writing';
  const SWS = read(`${SW}/SKILL.md`);
  const step10 = (SWS.match(/^10\. \*\*Verify[\s\S]*?(?=^## )/m) || [''])[0].replace(/\n\s*/g, ' ');
  ok(/mâu thuẫn/.test(step10) && /checklist\.md/.test(step10), 'AC3.2: bước 10 trỏ checklist cho mục kiểm AC mâu thuẫn');
  const CL = read(`${SW}/references/checklist.md`).replace(/\n\s*/g, ' ');
  ok(/cặp AC cùng đối tượng[^.]*trạng thái[^.]*ngưỡng[^.]*mã lỗi[^.]*thứ tự/.test(CL), 'AC3.2: checklist lập cặp AC cùng đối tượng (trạng thái, ngưỡng, mã lỗi, thứ tự)');
  ok(/Quyết định đã chốt[^.]*brief\.md/.test(CL), 'AC3.2: checklist đối chiếu AC với "Quyết định đã chốt" và brief.md');
  ok(/câu hỏi mở[^.]*trước checkpoint/.test(CL), 'AC3.2: AC lệch thì sửa hoặc đưa vào câu hỏi mở trước checkpoint');
  ok(SWS.split('\n').length <= 300, 'AC3.2: SKILL.md spec-writing không quá 300 dòng');

  // AC3.4: skill engineering-api-research
  const AR = 'plugins/engineering/skills/engineering-api-research';
  const ARS = read(`${AR}/SKILL.md`);
  const fm = (ARS.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  ok(/^name: engineering-api-research$/m.test(fm), 'AC3.4: frontmatter name đúng');
  const desc = 'Nghiên cứu API ngoài từ tài liệu gốc, chạy thử script chỉ đọc, ghi file facts có nhãn [Verified]/[Inference]/[Unverified] kèm nguồn và ngày đọc. Dùng khi người dùng muốn \\"tra docs API\\", \\"hạn mức, xác thực, mã lỗi của dịch vụ ngoài\\", \\"script thử chỉ đọc\\", \\"cái nào đã xác nhận, cái nào suy đoán\\". Không dùng khi cần viết spec yêu cầu → engineering-spec-writing; ghi quyết định chọn phương án → engineering-adr.';
  ok(fm.includes(`description: "${desc}"`), 'AC3.4: description nguyên văn D6');
  ok(desc.length <= 500, 'AC3.4: description không quá 500 ký tự');
  for (const k of ['order', 'title', 'runsIn', 'invoke']) ok(new RegExp(`^${k}:`, 'm').test(fm), `AC3.4: frontmatter có ${k}`);
  const proc = (ARS.match(/^## Quy trình[^\n]*\n([\s\S]*?)(?=^## )/m) || [, ''])[1];
  const safe = (ARS.match(/^## Ranh giới an toàn[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m) || [, ''])[1];
  ok(proc !== '' && safe !== '', 'AC3.4: có ## Quy trình và ## Ranh giới an toàn');
  ok(/câu hỏi cần trả lời/.test(proc), 'AC3.4: quy trình chốt câu hỏi cần trả lời');
  ok(/docs chính thức[\s\S]{0,200}phiên bản/.test(proc) && /Kiểm nguồn/.test(proc) && /core:principles/.test(proc), 'AC3.4: đọc docs chính thức đúng phiên bản theo mục Kiểm nguồn của core:principles');
  ok(/spike[\s\S]{0,300}lệnh chạy lại/.test(proc), 'AC3.4: spike nhỏ chạy được, kết quả ghi kèm lệnh chạy lại');
  ok(/\[Verified\][\s\S]{0,200}URL sau chuyển hướng[\s\S]{0,100}ngày đọc/.test(proc) && /\[Inference\]/.test(proc) && /\[Unverified\]/.test(proc), 'AC3.4: file facts có nhãn Verified (nguồn, URL sau chuyển hướng, ngày đọc), Inference, Unverified');
  ok(/tính tiền/.test(safe) && /dữ liệu thật/.test(safe) && /duyệt/.test(safe), 'AC3.4: không gọi API tính tiền hay ghi dữ liệu thật khi chưa được duyệt');
  ok(/khoá thật/.test(safe) && /facts/.test(safe), 'AC3.4: không đưa khoá thật vào file facts');
  ok(read(`${AR}/references/facts.template.md`) !== '', 'AC3.4: có references/facts.template.md');
  ok(ARS.split('\n').length <= 300, 'AC3.4: SKILL.md api-research không quá 300 dòng');
}
