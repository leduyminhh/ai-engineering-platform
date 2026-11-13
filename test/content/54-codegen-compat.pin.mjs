// Pin nội dung: kiểm tương thích công cụ codegen trước G1 (request 2026-11-13-frontend-codegen-compat).
// Ghim chuỗi lệnh và vị trí, không ghim văn xuôi.
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR } = ctx;
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
  ok(i2.includes('contract-and-codegen.md') && i2.includes('design.md'),
    'AC1.1: I2 trỏ reference và nêu nơi ghi kết quả khi không có ADR (design.md)');

  const redLines = i2.split('\n').filter((l) => l.startsWith('**Đỏ khi:**'));
  ok(redLines.length === 1 && redLines[0].includes('xung đột'),
    'AC1.2: I2 có đúng một dòng "Đỏ khi" và dòng đó nêu xung đột peer/engines');

  ok(ref.includes('Kiểm tương thích công cụ'), 'AC2.1: reference có mục "Kiểm tương thích công cụ"');
  for (const tok of ['--dry-run', '--ignore-scripts', 'ERESOLVE', '[Unverified]']) {
    ok(ref.includes(tok), `AC2.1: reference nêu \`${tok}\``);
  }

  ok(ref.includes('npx --yes -p typescript@') && ref.includes('x.y.z'),
    'AC2.2: reference nêu cách ghim npx với phiên bản đủ x.y.z');
  const scriptLine = ref.split('\n').find((l) => l.includes('"api:types"')) ?? '';
  ok(scriptLine.includes('openapi-typescript@'), 'AC2.2: script api:types ghim phiên bản openapi-typescript');
  ok(ref.includes('https://openapi-ts.dev'), 'AC2.2: reference giữ link nguồn https://openapi-ts.dev');
}
