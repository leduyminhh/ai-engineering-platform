// Pin: checklist robustness và skill gọi LLM (request 2026-11-11-skill-enrichment-from-usage, part 03-backend).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const read = (rel) => {
    try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; }
  };

  // AC4.1: đúng 5 nhóm, mỗi nhóm 2–4 checkbox kèm cách kiểm.
  const checklist = read('plugins/backend/templates/robustness/robustness-checklist.md');
  const groups = checklist.split(/^## /m).slice(1);
  const wanted = ['Chặn kích thước input', 'Che secret', 'Idempotency', 'Race và CAS', 'Việc mồ côi'];
  ok(groups.length === wanted.length, `AC4.1: checklist có đúng ${wanted.length} nhóm (có ${groups.length})`);
  for (const w of wanted) {
    const g = groups.find((x) => x.startsWith(w));
    ok(!!g, `AC4.1: có nhóm "${w}"`);
    if (!g) continue;
    const boxes = g.split('\n').filter((l) => l.startsWith('- [ ] '));
    ok(boxes.length >= 2 && boxes.length <= 4, `AC4.1: nhóm "${w}" có 2–4 checkbox (có ${boxes.length})`);
    ok(boxes.every((l) => /Cách kiểm:/.test(l)), `AC4.1: mỗi checkbox nhóm "${w}" có "Cách kiểm:"`);
  }

  // AC4.2: hai skill ship chung một checklist qua sharedAssets và trỏ ở bước đầu quy trình.
  for (const id of ['backend-implement', 'backend-code-review']) {
    const txt = read(`plugins/backend/skills/${id}/SKILL.md`);
    const assets = (txt.match(/^sharedAssets:s*(.+)$/m)?.[1] ?? '').split(',').map((s) => s.trim());
    ok(assets.includes('templates/robustness') && assets.includes('templates/architecture'), `AC4.2: ${id} khai sharedAssets robustness và architecture`);
    const proc = txt.split(/^## Quy trình/m)[1] ?? '';
    const firstStep = proc.split(/^### 1./m)[0];
    ok(firstStep.includes('robustness/robustness-checklist.md'), `AC4.2: ${id} trỏ checklist ở bước đầu quy trình`);
    ok(txt.split(String.fromCharCode(10)).length <= 300, `AC4.2: ${id} SKILL.md ≤ 300 dòng`);
    ok(fs.existsSync(path.join(ctx.claudeSkillDir('backend', id), 'robustness', 'robustness-checklist.md')), `AC4.2: build có robustness/robustness-checklist.md cạnh ${id}`);
  }

  // AC4.3: skill backend-llm-integration, description nguyên văn D6, phủ 7 chủ đề.
  const llm = read('plugins/backend/skills/backend-llm-integration/SKILL.md');
  const llmRef = read('plugins/backend/skills/backend-llm-integration/references/llm-call-checklist.md');
  const D6 = 'Thêm hoặc rà tính năng backend gọi LLM: ngân sách theo ngày, retry khi bị rate limit, fail-soft có đánh dấu, ghi usage, redact output, prompt dự phòng. Dùng khi người dùng muốn "service gọi mô hình ngôn ngữ", "giới hạn chi phí gọi AI theo ngày", "retry khi rate limit", "fail-soft khi LLM lỗi", "ghi token mỗi lần gọi model". Không dùng khi code slice thường không gọi LLM → backend-implement; review diff tổng quát → backend-code-review.';
  const fm = ctx.parseFrontmatter ? ctx.parseFrontmatter(llm) : null;
  const desc = fm?.data?.description ?? fm?.meta?.description ?? fm?.description;
  ok(desc === D6, 'AC4.3: description đúng nguyên văn D6');
  ok(/^name: backend-llm-integration$/m.test(llm), 'AC4.3: name đúng');
  ok(/^## Quy trình/m.test(llm) && /^## Ranh giới an toàn/m.test(llm), 'AC4.3: có ## Quy trình và ## Ranh giới an toàn');
  ok(llm.split(String.fromCharCode(10)).length <= 300, 'AC4.3: SKILL.md ≤ 300 dòng');
  const topics = [
    ['ngân sách theo ngày', /ngân sách theo ngày/i], ['đặt chỗ trước khi gọi', /đặt chỗ/i], ['backoff luỹ thừa có jitter', /jitter/i],
    ['lỗi 4xx không retry', /4xx/], ['cờ degraded', /degraded/], ['dòng log có lý do', /lý do/],
    ['cờ biến lỗi thành thất bại cứng', /thất bại cứng/], ['hoàn tất job không chứng minh lời gọi thật', /không chứng minh/],
    ['ghi usage chỉ token', /usage[^\n]*token|token[^\n]*usage/i], ['redact output', /redact/i], ['hash input', /hash/i],
    ['prompt dự phòng', /prompt dự phòng/i], ['khoá nhà cung cấp không vào log, lỗi hay prompt', /khoá[^\n]*(log)[^\n]*(lỗi)[^\n]*(prompt)/i],
  ];
  for (const [name, re] of topics) ok(re.test(llm), 'AC4.3: SKILL.md phủ ' + name);
  ok(llm.includes('references/llm-call-checklist.md') && llmRef.length > 0, 'AC4.3: có references/llm-call-checklist.md và SKILL.md trỏ tới');
}
