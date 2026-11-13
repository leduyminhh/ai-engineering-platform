// Pin nội dung: kiểm tương thích công cụ codegen trước G1 (request 2026-11-13-frontend-codegen-compat).
// Ghim chuỗi lệnh và vị trí, không ghim văn xuôi.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR, parseSteps, workflows } = ctx;
  const diDir = path.join(PLUGINS_DIR, 'frontend', 'skills', 'frontend-data-integration');
  const skill = fs.readFileSync(path.join(diDir, 'SKILL.md'), 'utf8');
  const ref = fs.readFileSync(path.join(diDir, 'references', 'contract-and-codegen.md'), 'utf8');

  const i2Start = skill.indexOf('### I2.');
  const i2End = skill.indexOf('### I3.');
  const i2 = i2Start >= 0 && i2End > i2Start ? skill.slice(i2Start, i2End) : '';
  ok(i2.length > 0, 'AC1.1: SKILL.md có mục I2 đứng trước I3');

  for (const tok of ['npm view', 'peerDependencies', 'engines']) {
    ok(i2.includes(tok), `AC1.1: I2 nêu \`${tok}\` trước khi đề xuất codegen`);
  }
  const proposeAt = i2.search(/Chưa\s+có\s+codegen/);
  ok(proposeAt >= 0 && i2.indexOf('npm view') >= 0 && i2.indexOf('npm view') < proposeAt,
    'AC1.1: bước đọc peerDependencies đứng trước câu "Chưa có codegen → đề xuất"');
  ok(i2.includes('contract-and-codegen.md') && i2.includes('design.md') && i2.includes('requirement.md') && i2.includes('ADR'),
    'AC1.1: I2 trỏ reference và nêu nơi ghi kết quả (ADR, hoặc design.md/requirement.md khi không có ADR)');

  const redLines = i2.split('\n').filter((l) => l.startsWith('**Đỏ khi:**'));
  ok(redLines.length === 1 && redLines[0].includes('xung đột'),
    'AC1.2: I2 có đúng một dòng "Đỏ khi" và dòng đó nêu xung đột peer/engines');

  ok(ref.includes('Kiểm tương thích công cụ'), 'AC2.1: reference có mục "Kiểm tương thích công cụ"');
  for (const tok of ['--dry-run', '--ignore-scripts', 'ERESOLVE', '[Unverified]']) {
    ok(ref.includes(tok), `AC2.1: reference nêu \`${tok}\``);
  }

  ok(ref.includes('npx --yes -p typescript@') && ref.includes('x.y.z'),
    'AC2.2: reference nêu cách ghim npx với phiên bản đủ x.y.z');
  const scriptLines = ref.split('\n').filter((l) => l.includes('"api:types"'));
  ok(/openapi-typescript@(<x\.y\.z>|\d+\.\d+\.\d+)(\s|")/.test(scriptLines[1] ?? ''),
    'AC2.2: script api:types dạng npx ghim openapi-typescript@<x.y.z> (đủ ba số, không @latest/@^7)');
  ok(ref.includes('https://openapi-ts.dev'), 'AC2.2: reference giữ link nguồn https://openapi-ts.dev');

  // N3b: ranh giới an toàn của mục 2a, tên gói và mặc định mục 3.
  const norm = (s) => s.replace(/\s+/g, ' ');
  const sec2a = norm(ref.slice(ref.indexOf('## 2a.'), ref.indexOf('## 3.')));
  const sec3 = norm(ref.slice(ref.indexOf('## 3.'), ref.indexOf('## 4.')));
  ok(sec2a.length > 0 && sec3.length > 0, 'N3b AC5.1: tách được mục 2a và mục 3 của reference');
  ok(sec2a.includes('npm install --dry-run --ignore-scripts') && sec2a.includes('không ghi vào project'),
    'N3b AC5.1: mục 2a ghim chuỗi liền npm install --dry-run --ignore-scripts và ranh giới "không ghi vào project"');
  ok(sec2a.includes('.npmrc'), 'N3b AC2.1: mục 2a dặn không chép .npmrc sang thư mục tạm');
  ok(/E40[14]/.test(sec2a) && sec2a.includes('workspaces'),
    'N3b AC2.2: mục 2a nêu ca không dùng được (E401/E404, workspaces)');
  ok(sec2a.includes('EBADENGINE'), 'N3b AC2.3: mục 2a nêu EBADENGINE chỉ là cảnh báo');
  const scoped = '@openapitools/openapi-generator-cli';
  ok(sec2a.includes(scoped) && i2.includes(scoped), 'N3b AC3.1: mục 2a và I2 dùng tên gói đầy đủ cho npm view/npx');
  const bareName = /(?<![\w@/-])openapi-generator(?![\w-])/;
  ok(!bareName.test(sec2a.split(scoped).join('')) && !bareName.test(i2.split(scoped).join('')),
    'N3b AC3.1: mục 2a và I2 không còn tên openapi-generator đứng riêng');
  ok(sec3.includes('npm install --save-dev --save-exact'), 'N3b AC4.1: mục 3 chọn mặc định cài devDependencies đúng x.y.z');
  ok(scriptLines.length === 2 && !scriptLines[0].includes('npx') && scriptLines[1].includes('npx --yes -p typescript@'),
    'N3b AC4.1: hai ví dụ api:types, mặc định không dùng npx, dạng npx cho ca xung đột');
  const flat = norm(ref);
  const auditAt = flat.indexOf('npm audit');
  ok(auditAt >= 0 && flat.indexOf('npm audit', auditAt + 1) < 0 && flat.lastIndexOf('[Inference]', auditAt) >= auditAt - 80,
    'N3b AC4.2: câu về npm audit xuất hiện một lần và mở bằng [Inference]');

  // workflow-feature Bước 3: lấy riêng từng trường để chữ ở Thực hiện/Khi fail không khớp nhầm.
  const feature = workflows.stages.find((s) => s.id === 'workflow-feature');
  const steps = feature ? parseSteps(feature.body) : [];
  const step3 = steps.find((s) => s.n === 3) ?? { body: '' };
  const field = (name) => {
    const lines = step3.body.split('\n');
    const i = lines.findIndex((l) => l.startsWith(`- **${name}:**`));
    if (i < 0) return '';
    let j = lines.findIndex((l, k) => k > i && /^- \*\*/.test(l));
    if (j < 0) j = lines.length;
    return lines.slice(i, j).join('\n').replace(/\s+/g, ' ');
  };
  ok(steps.length === 7, 'AC3.2: workflow-feature vẫn có 7 bước');
  const doing = field('Hành động');
  ok(/spike/i.test(doing) && doing.includes('frontend-data-integration') && doing.includes('contract-and-codegen'),
    'AC3.1: Bước 3 Hành động buộc spike giả định công cụ và trỏ reference codegen của frontend-data-integration');
  const gate = field('Gate');
  ok(/spike/i.test(gate) && gate.includes('rủi ro chặn hướng'),
    'AC3.1/AC4.1: Bước 3 Gate đòi kết quả spike trong tài liệu hoặc nêu ở G1 như rủi ro chặn hướng');
  ok(/spike/i.test(field('Evidence')), 'AC3.1: Bước 3 Evidence ghi lệnh và kết quả spike');
  ok(doing.includes('[Unverified]') && doing.includes('G1'),
    'AC4.1: Bước 3 Hành động nêu giữ [Unverified] và đưa lên G1 khi không kiểm được');
  ok(!/spike/i.test(field('Thực hiện')) && !/spike/i.test(field('Khi fail')),
    'AC3.2: chữ spike không nằm ở Thực hiện hay Khi fail (checkGraphAgainstBody suy graph từ hai trường này)');
}
