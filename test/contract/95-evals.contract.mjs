// Contract Phase 3: eval case (evals/<plugin>/<case>/) hợp lệ về cấu trúc; KHÔNG chạy `claude plugin eval` (tốn tiền model).
export default async function run({ ok, ctx }) {
  const { fs, path, REPO_ROOT, plugins, parseFrontmatter, checkEvalCase, EVAL_GRADER_TYPES } = ctx;

  // checkEvalCase thuần: dựng meta tối thiểu hợp lệ rồi bóp méo từng điểm
  const grader = (o = {}) => ({ type: 'llm', body: 'PASS if x.', ...o });
  const good = { promptMeta: { runs: 3, max_turns: 8, allowed_tools: ['Read', 'Skill'] }, graders: [grader()] };
  ok(EVAL_GRADER_TYPES.includes('tool_used') && EVAL_GRADER_TYPES.length === 6, 'EVAL_GRADER_TYPES có 6 loại grader');
  ok(checkEvalCase(good).length === 0, 'checkEvalCase: case hợp lệ → 0 lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [] }).some((e) => e.includes('grader')), 'checkEvalCase: thiếu grader → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [grader({ type: 'bogus' })] }).some((e) => e.includes('bogus')), 'checkEvalCase: grader type lạ → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [{ type: 'llm' }] }).some((e) => e.includes('criteria')), 'checkEvalCase: llm thiếu criteria → lỗi');
  ok(checkEvalCase({ promptMeta: { foo: 1 }, graders: [grader()] }).some((e) => e.includes('foo')), 'checkEvalCase: khoá prompt.md lạ → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [{}] }).length >= 1, 'checkEvalCase: grader thiếu type → lỗi');
  ok(checkEvalCase({ promptMeta: { allowed_tools: ['Bash'] }, graders: [grader()] }).some((e) => e.includes('Bash')), 'checkEvalCase: allowed_tools có Bash → lỗi');
  ok(checkEvalCase({ promptMeta: { allowed_tools: ['Read', 'Bash(npm test *)'] }, graders: [grader()] }).some((e) => e.includes('Bash')),
    'checkEvalCase: Bash(pattern) cũng bị chặn');
  ok(checkEvalCase({ promptMeta: { runs: 0 }, graders: [grader()] }).length === 1 && checkEvalCase({ promptMeta: { runs: 51 }, graders: [grader()] }).length === 1
    && checkEvalCase({ promptMeta: { runs: 1.5 }, graders: [grader()] }).length === 1, 'checkEvalCase: runs ngoài 1–50 → lỗi');
  ok(checkEvalCase({ promptMeta: { max_turns: 201 }, graders: [grader()] }).length === 1, 'checkEvalCase: max_turns > 200 → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [{ type: 'tool_used' }] }).some((e) => e.includes('tool')), 'checkEvalCase: tool_used thiếu tool → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [{ type: 'regex' }] }).some((e) => e.includes('pattern')), 'checkEvalCase: regex thiếu pattern → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [{ type: 'file_exists' }] }).some((e) => e.includes('path')), 'checkEvalCase: file_exists thiếu path → lỗi');
  ok(checkEvalCase({ promptMeta: {}, graders: [{ type: 'tool_used', tool: 'Skill', input_match: '(' }] }).some((e) => e.includes('input_match')),
    'checkEvalCase: input_match không phải regex hợp lệ → lỗi');

  // Mọi case trong evals/ phải qua checkEvalCase
  const evalsDir = path.join(REPO_ROOT, 'evals');
  const pluginIds = new Set(['core', 'workflows', ...plugins.map((p) => p.id)]);
  const subdirs = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  let cases = 0;
  for (const pid of fs.existsSync(evalsDir) ? subdirs(evalsDir) : []) {
    ok(pluginIds.has(pid), `evals/${pid}: khớp một plugin/core/workflows có thật`);
    for (const name of subdirs(path.join(evalsDir, pid))) {
      const dir = path.join(evalsDir, pid, name);
      const at = `evals/${pid}/${name}`;
      if (!fs.existsSync(path.join(dir, 'prompt.md'))) {
        ok(!fs.existsSync(path.join(dir, 'graders')) && !fs.existsSync(path.join(dir, 'case.yaml')), `${at}: có graders/ hoặc case.yaml nhưng thiếu prompt.md`);
        continue;
      }
      cases++;
      const prompt = parseFrontmatter(fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8'));
      ok(prompt.body.trim().length > 0, `${at}: prompt.md có nội dung prompt`);
      const gdir = path.join(dir, 'graders');
      const files = fs.existsSync(gdir) ? fs.readdirSync(gdir).filter((f) => f.endsWith('.md')).sort() : [];
      const graders = files.map((f) => {
        const g = parseFrontmatter(fs.readFileSync(path.join(gdir, f), 'utf8'));
        return { ...g.meta, body: g.body, name: f.slice(0, -3) };
      });
      const errs = checkEvalCase({ promptMeta: prompt.meta, graders });
      ok(errs.length === 0, `${at}: cấu trúc eval hợp lệ${errs.length ? ' — ' + errs.join('; ') : ''}`);
      ok(prompt.meta.runs === 3, `${at}: prompt.md đặt runs: 3`);
      const caseYaml = path.join(dir, 'case.yaml');
      if (fs.existsSync(caseYaml)) {
        const y = fs.readFileSync(caseYaml, 'utf8');
        ok(/^schema_version:\s*"1\.1"\s*$/m.test(y) && /^name:\s*\S+/m.test(y), `${at}: case.yaml có schema_version "1.1" và name`);
        const sc = y.match(/^\s+scaffold_script:\s*(\S+)\s*$/m);
        ok(!sc || fs.existsSync(path.join(dir, sc[1])), `${at}: scaffold_script tồn tại`);
      }
    }
  }
  ok(cases >= 3, `evals/ có ≥ 3 case (có ${cases})`);
}
