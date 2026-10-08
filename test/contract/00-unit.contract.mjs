// Contract unit: loader agent/workflows, helper workflow và adapter với fixture (thuần, không đọc plugin thật).
import { parseOnly } from '../harness.mjs';

export default async function run({ ok, ctx }) {
  const { fs, path, loadPlugins, loadCore, loadWorkflows, splitList, REPO_ROOT, checkWorkflowBody, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS, claudeAdapter, codexAdapter, tomlBasic, tomlMultiline, frontmatter, core, plugins, workflows, fxPlugin, fxWorkflows, fxCore, fxMk, byPath } = ctx;

  // ─────────────────────────────────────────────────────────────────────────────
  // 0. UNIT: loader agent + workflows
  // ─────────────────────────────────────────────────────────────────────────────
  ok(JSON.stringify(splitList(' a, b ,,c ')) === '["a","b","c"]', 'splitList: tách phẩy + trim + bỏ rỗng');
  ok(parseOnly(['--only']).error && parseOnly(['--only', '--build']).error, 'parseOnly: --only thiếu giá trị hoặc theo sau là flag → lỗi');
  ok(!parseOnly(['--only', 'versions']).error && parseOnly(['--only', 'versions']).onlys[0] === 'versions', 'parseOnly: --only <tên> hợp lệ');
  ok(!parseOnly(['--only=versions']).error && parseOnly(['--only=versions']).onlys.join() === 'versions', 'parseOnly: --only=<tên> hợp lệ');
  ok(!!parseOnly(['--only=']).error, 'parseOnly: --only= (giá trị rỗng) → lỗi');
  ok(Array.isArray(splitList(undefined)) && splitList(undefined).length === 0, 'splitList: không phải chuỗi → []');
  ok(loadPlugins().every((p) => Array.isArray(p.agents)), 'loadPlugins: mỗi plugin có mảng agents');
  ok(Array.isArray(loadCore().agents) && loadCore().agents.length === 0, 'loadCore: agents = []');
  {
    const wf = loadWorkflows();
    ok(!!wf && wf.id === 'workflows', 'loadWorkflows: đọc workflows/.manifest.json (id = workflows)');
    ok(!!wf && Array.isArray(wf.stages), 'loadWorkflows: có mảng stages');
  }

  // 0b. UNIT: helper workflow (khung body, step, registry, closure)
  {
    const tpl = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'workflows', 'workflow.template.md'), 'utf8').replace(/\r\n/g, '\n');
    const tplErrs = checkWorkflowBody(tpl);
    ok(tplErrs.length === 0, `template workflow PASS checkWorkflowBody${tplErrs.length ? ' — ' + tplErrs.join('; ') : ''}`);

    const step = (n, fields, tail = '') => `### Bước ${n} — Tên${tail}\n` + fields.map((f) => `- **${f}:** x`).join('\n') + '\n';
    const ALL = ['Thực hiện', 'Đầu vào', 'Hành động', 'Ràng buộc', 'Đầu ra', 'Gate', 'Khi fail', 'Evidence'];
    const frame = (steps, result = 'workflow_result:') => [
      '## Mục tiêu & đầu vào', 'x', '## Điều kiện tiên quyết', 'x', '## Các bước', steps,
      '## Checkpoint', 'x', '## Xử lý lỗi & rollback', 'x', '## Definition of Done', 'x', '## Report cuối', result,
    ].join('\n');
    ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸'))).length === 0, 'checkWorkflowBody: khung đủ → hợp lệ');
    ok(checkWorkflowBody(frame(step(1, ALL.filter((f) => f !== 'Gate'), ' ⏸'))).some((e) => e.includes('"Gate"')),
      'checkWorkflowBody: thiếu trường Gate → báo lỗi');
    ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸') + step(3, ALL))).some((e) => e.includes('liên tục')),
      'checkWorkflowBody: đánh số nhảy → báo lỗi');
    ok(checkWorkflowBody(frame(step(1, ALL))).some((e) => e.includes('⏸')), 'checkWorkflowBody: không có ⏸ → báo lỗi');
    ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸')).replace('## Checkpoint', '## X')).some((e) => e.includes('Checkpoint')),
      'checkWorkflowBody: thiếu heading → báo lỗi');
    ok(checkWorkflowBody(frame(step(1, ALL, ' ⏸')), { kind: 'orchestrator' }).some((e) => e.includes('orchestrator_result')),
      'checkWorkflowBody: orchestrator đòi orchestrator_result');

    const refs = stepRefs(frame(
      '### Bước 1 — A ⏸\n- **Thực hiện:** agent `backend-reviewer` ∥ agent `frontend-reviewer`\n' +
      '### Bước 2 — B\n- **Thực hiện:** skill `backend-refactor` | skill `core/git-workflow`\n'));
    ok(JSON.stringify(refs[0].agents) === '["backend-reviewer","frontend-reviewer"]', 'stepRefs: bắt agent song song');
    ok(JSON.stringify(refs[1].skills) === '["backend-refactor","core/git-workflow"]', 'stepRefs: bắt skill trần + đầy đủ');
    const wrapped = stepRefs(frame(
      '### Bước 1 — A ⏸\n- **Thực hiện:** agent `backend-reviewer` rồi\n  agent `frontend-reviewer` và\n  skill `backend-refactor`\n' +
      '- **Đầu vào:** agent `z-khac` | skill `z-skill`\n'));
    ok(JSON.stringify(wrapped[0].agents) === '["backend-reviewer","frontend-reviewer"]',
      'stepRefs: bắt agent ở dòng nối của Thực hiện, bỏ agent ở trường kế tiếp');
    ok(JSON.stringify(wrapped[0].skills) === '["backend-refactor"]', 'stepRefs: bắt skill ở dòng nối, bỏ skill ở trường kế tiếp');

    const reg = parseRegistry([
      '## Registry', '| id | Tín hiệu | Risk | Nối tiếp | Không dùng khi |', '|---|---|---|---|---|',
      '| `workflow-incident` | prod down | critical | `workflow-bugfix`, `workflow-docs` | x |',
      '| `workflow-docs` | readme | low | — | x |',
      '**Thứ tự ưu tiên:** `workflow-incident` > `workflow-docs`', '## Khác',
    ].join('\n'));
    ok(reg.rows.length === 2 && reg.rows[0].risk === 'critical', 'parseRegistry: đọc dòng + risk');
    ok(JSON.stringify(reg.rows[0].next) === '["workflow-bugfix","workflow-docs"]' && reg.rows[1].next.length === 0,
      'parseRegistry: đọc cột Nối tiếp ("—" = rỗng)');
    ok(JSON.stringify(reg.priority) === '["workflow-incident","workflow-docs"]', 'parseRegistry: đọc thứ tự ưu tiên');

    const model = {
      workflows: [{ id: 'workflow-x', requires: ['core/git-workflow'], agents: ['be-rev'] }],
      agents: [{ id: 'be-rev', skills: ['backend/backend-code-review'] }],
    };
    const dep = expandWorkflowDeps(new Set(['workflows/workflow-x']), model);
    ok(dep.skills.has('core/git-workflow') && dep.skills.has('backend/backend-code-review'),
      'expandWorkflowDeps: kéo requires + skill của agent');
    ok(dep.pulled.length === 1 && dep.pulled[0].from === 'workflow-x', 'expandWorkflowDeps: ghi nguồn kéo theo');
    ok(expandWorkflowDeps(new Set(['backend/backend-init']), model).pulled.length === 0,
      'expandWorkflowDeps: không có workflow → giữ nguyên');
    ok(JSON.stringify(missingDeps(dep.required, new Set(['core/git-workflow']))) === '["backend/backend-code-review"]',
      'missingDeps: nêu skill không có trong catalog');
    ok(RISKS.join(',') === 'low,medium,high,critical', 'RISKS: 4 mức');
  }

  // 0c. UNIT: adapter với fixture (thuần — không đọc plugin thật)
  {
    const out = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore, workflows: fxWorkflows }));
    const agentMd = (out.get('plugins/fx/agents/fx-reviewer.md') || {}).content || '';
    ok(agentMd.includes('name: fx-reviewer') && agentMd.includes('disallowedTools: Edit, Write, NotebookEdit, Agent'),
      'claude agent: frontmatter name + disallowedTools read-only');
    ok(agentMd.includes('effort: high') && agentMd.includes('`fx:fx-review`'), 'claude agent: effort + pointer skill dạng plugin');
    const pj = JSON.parse((out.get('plugins/workflows/.claude-plugin/plugin.json') || { content: '{}' }).content);
    ok(JSON.stringify(pj.dependencies) === '["core","fx"]', 'claude workflows: dependencies = core + plugin của agent/requires');
    const wfMd = (out.get('plugins/workflows/skills/workflow-demo/SKILL.md') || {}).content || '';
    ok(wfMd.includes('name: workflow-demo') && wfMd.includes('`fx:fx-reviewer`') && wfMd.includes('`core:git-workflow`'),
      'claude workflows: SKILL.md + preamble dispatch 2 dạng tên');
    const mk = JSON.parse(out.get('.claude-plugin/marketplace.json').content);
    ok(mk.plugins.some((x) => x.name === 'workflows'), 'claude marketplace: có entry workflows');
    const noWf = byPath(claudeAdapter.build([fxPlugin], { marketplace: fxMk, core: fxCore }));
    ok(![...noWf.keys()].some((k) => k.startsWith('plugins/workflows/')), 'claude: không truyền workflows → không sinh plugin workflows');
  }
  {
    ok(tomlBasic('a"b\\c\nd') === '"a\\"b\\\\c\\nd"', 'tomlBasic: escape " \\ và newline');
    {
      const out = tomlMultiline('x"""y\\z');
      ok(out.startsWith('"""\n'), 'tomlMultiline: mở bằng """ + newline');
      ok(out.endsWith('"""'), 'tomlMultiline: đóng bằng """');
      const body = out.slice(4, -3);
      ok(!/(^|[^\\])"""/.test(body), 'tomlMultiline: không còn chuỗi """ chưa escape ở giữa nội dung');
    }
    {
      // Regression: content kết thúc bằng dấu " sát ngay dấu đóng """ (thuật toán cũ tạo 4 dấu " liên tiếp → lỗi cú pháp TOML).
      const out = tomlMultiline('Hello"');
      ok(out.startsWith('"""\n') && out.endsWith('"""'), 'tomlMultiline: content kết thúc bằng " vẫn mở/đóng đúng');
      ok(out.slice(4, -3).endsWith('\\"'), 'tomlMultiline: dấu " cuối content được escape (không tạo 4 dấu " liên tiếp trước """ đóng)');
    }
    const out = byPath(codexAdapter.build([fxPlugin], { core: fxCore, workflows: fxWorkflows }));
    const toml = (out.get('fx/agents/fx-reviewer.toml') || {}).content || '';
    ok(toml.includes('sandbox_mode = "read-only"') && toml.includes('model_reasoning_effort = "high"'),
      'codex agent: sandbox_mode + effort');
    ok(toml.includes('developer_instructions = """') && toml.includes('`fx-review`'), 'codex agent: developer_instructions + pointer skill');
    ok(!toml.includes('model ='), 'codex agent: KHÔNG map model');
    ok(toml.includes('name = "fx_reviewer"'), 'codex agent: name đổi `-` → `_` (convention tài liệu subagents)');
    const wfMd = (out.get('workflows/skills/workflow-demo/SKILL.md') || {}).content || '';
    ok(wfMd.includes('name: workflow-demo') && wfMd.includes('Cách dispatch trên Codex'), 'codex workflows: SKILL.md + preamble Codex');
  }
}
