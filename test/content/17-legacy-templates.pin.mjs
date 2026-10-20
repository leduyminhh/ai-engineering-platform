// Pin: project đã có _TEMPLATE cũ (init không ghi đè) → _TEMPLATE của project thắng template core, báo chênh lệch, không ghi đè (spec 2026-10-20-artifact-templates).
export default async function run({ ok, ctx }) {
  const { fs, path, PLUGINS_DIR } = ctx;
  const eng = (rel) => fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', rel), 'utf8').replace(/\r\n/g, '\n');
  const flat = (t) => t.replace(/\s+/g, ' ');
  const RULE = [/có sẵn của project thắng/,/KHÔNG tự ghi đè/, /gợi ý/];
  for (const rel of ['engineering-adr/references/adr-structure.md', 'engineering-spec-writing/references/spec-structure.md']) {
    const t = flat(eng(rel));
    for (const re of RULE) ok(re.test(t), `engineering/${rel}: quy tắc _TEMPLATE cũ của project (${re.source})`);
  }
  for (const rel of ['engineering-adr/SKILL.md', 'engineering-spec-writing/SKILL.md']) {
    const t = flat(eng(rel));
    ok(/có sẵn của project thắng template core/.test(t) && t.includes('KHÔNG ghi đè'),
      `engineering/${rel}: nhắc _TEMPLATE của project thắng template core, không ghi đè`);
  }
}
