// Contract 57: bộ skill trung lập tên riêng (D5, AC7.4) — không dòng nào trong core/, plugins/, workflows/, test/routing/ nhắc project cụ thể.
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT } = ctx;
  const BANNED = /cap-(core|web|ui|storage|contracts)|capcore|capstorage|content-automation|khe kho|\bV1[0-9]{2}\b|worker-(intelligence|media|content|metadata|acquisition|publishing)|tts-local|searxng|story-series|niche/i;
  const SELF = path.resolve(import.meta.dirname, '57-skill-neutral.contract.mjs');
  const hits = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      if (!/\.(md|json|mjs)$/.test(e.name) || path.resolve(p) === SELF) continue;
      fs.readFileSync(p, 'utf8').split(/\r\n|\r|\n/).forEach((line, i) => {
        if (BANNED.test(line)) hits.push(`${path.relative(REPO_ROOT, p).split(path.sep).join('/')}:${i + 1}`);
      });
    }
  };
  for (const d of ['core', 'plugins', 'workflows', path.join('test', 'routing')]) walk(path.join(REPO_ROOT, d));
  ok(hits.length === 0, `AC7.4 tên riêng cấm trong skill (${hits.slice(0, 10).join(', ')}${hits.length > 10 ? ', …' : ''})`);
}
