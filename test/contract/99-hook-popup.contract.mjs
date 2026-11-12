// Contract 99: request 2026-11-12-hook-popup-standardization (reason dễ hiểu, bớt bắt nhầm, guard-mcp giữ mcpDeny).
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR } = ctx;
  const hook = (name) => import(pathToFileURL(path.join(CORE_DIR, 'hooks', 'scripts', name)).href);

  // ── Task 1: guard-mcp (AC3.x)
  {
    const mcp = await hook('guard-mcp.mjs');
    const call = (tool, locate, extra = {}) => mcp.decide({ tool_name: tool, cwd: '.' }, { locate, tracked: () => null, ...extra });
    const cfgOf = (config, extra = {}) => () => ({ gate: { config, file: '/x/.claude/aip-gate.json', inRepo: true, ...extra }, invalid: null });
    const broken = (file) => () => ({ gate: null, invalid: file });
    const none = () => ({ gate: null, invalid: null });

    const bad = call('mcp__a__t', broken('/repo/.claude/aip-gate.json'));
    ok(bad?.decision === 'ask' && bad.reason.includes('/repo/.claude/aip-gate.json') && bad.reason.includes('a'),
      'AC3.2: file aip-gate.json hỏng → ask mọi tool MCP, lý do nêu đường dẫn file');
    ok(call('Bash', broken('/repo/.claude/aip-gate.json')) === null, 'AC3.2: tool không phải MCP không bị ảnh hưởng khi file hỏng');
    const START = 'mcp__ccd_session__start_session';
    ok(mcp.decide({ tool_name: START, tool_input: { initiation: 'own_initiative' }, cwd: '.' }, { locate: broken('/r/.claude/aip-gate.json') })?.decision === 'deny',
      'AC3.2: start_session thiếu model vẫn deny trước, kể cả khi file hỏng');
    ok(call('mcp__a__t', none) === null && call('mcp__a__t', cfgOf({})) === null && call('mcp__a__t', cfgOf({ mcpDeny: ['b'] })) === null,
      'AC3.3: không file / file không có mcpDeny / mcpDeny server khác → null');
    ok(call('mcp__a__t', cfgOf({ mcpDeny: ['a'] }))?.decision === 'deny', 'AC3.3: mcpDeny đúng server vẫn deny (không đổi)');

    // AC3.1: git lỗi nhưng có .git ở trên → gitUnknown; file vẫn đọc được và mcpDeny/mcpAllow phải áp
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-popup-'));
    try {
      const repo = path.join(tmp, 'repo');
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.mkdirSync(path.join(repo, '.claude'));
      const gate = path.join(repo, '.claude', 'aip-gate.json');
      const real = (tool) => mcp.decide({ tool_name: tool, cwd: repo }, {});
      fs.writeFileSync(gate, JSON.stringify({ mcpDeny: ['a'], mcpAllow: ['b'] }));
      ok(real('mcp__a__t')?.decision === 'deny' && /mcpDeny/.test(real('mcp__a__t').reason), 'AC3.1: gitUnknown + mcpDeny → deny nêu mcpDeny');
      ok(real('mcp__c__t')?.decision === 'deny' && /mcpAllow/.test(real('mcp__c__t').reason) && real('mcp__b__t') === null, 'AC3.1: gitUnknown + mcpAllow vẫn áp');
      fs.writeFileSync(gate, '{ hỏng');
      const r = real('mcp__b__t');
      ok(r?.decision === 'ask' && r.reason.includes('aip-gate.json'), 'AC3.2: JSON hỏng trong repo → ask, lý do nêu aip-gate.json');
      const outside = path.join(tmp, 'plain');
      fs.mkdirSync(outside);
      ok(mcp.decide({ tool_name: 'mcp__b__t', cwd: outside }, {}) === null, 'AC3.3: ngoài repo git → null (R3/R4)');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
