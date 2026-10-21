// Contract hook guard-mcp: cổng allow/deny theo server MCP qua mcpAllow/mcpDeny trong aip-gate.json.
export default async function run({ ok, ctx }) {
  const { fs, path, os, execFileSync, pathToFileURL, CORE_DIR, checkHooksJson, claudeDir } = ctx;
  const hooksDir = path.join(CORE_DIR, 'hooks');
  const script = path.join(hooksDir, 'scripts', 'guard-mcp.mjs');

  const obj = JSON.parse(fs.readFileSync(path.join(hooksDir, 'hooks.json'), 'utf8'));
  const entry = (obj.hooks.PreToolUse || []).find((e) => e.matcher === 'mcp__.*');
  ok(!!entry && /guard-mcp\.mjs$/.test(entry.hooks?.[0]?.args?.[0] || ''), 'AC2.1: hooks.json có PreToolUse matcher mcp__.* trỏ guard-mcp.mjs');
  ok(checkHooksJson(obj, { scriptsExist: (rel) => fs.existsSync(path.join(hooksDir, rel)) }).length === 0, 'AC2.1: hooks.json qua checkHooksJson không lỗi');
  if (fs.existsSync(claudeDir)) {
    ok(fs.existsSync(path.join(claudeDir, 'plugins', 'core', 'hooks', 'scripts', 'guard-mcp.mjs')), 'AC2.1: build claude ship guard-mcp.mjs');
  }

  const { decide, parseMcpTool } = await import(pathToFileURL(script).href);
  const call = (tool, config) => decide({ tool_name: tool, cwd: '.' }, { config });

  ok(parseMcpTool('mcp__a__t')?.server === 'a' && parseMcpTool('mcp__plugin_p_a__t')?.server === 'plugin:p:a'
    && parseMcpTool('mcp__my_server__t')?.server === 'my_server', 'parseMcpTool: server thường, plugin, có dấu gạch dưới');
  ok(['mcp__', 'mcp__a', 'mcp____t', 'Bash', ''].every((n) => parseMcpTool(n) === null), 'AC2.5: parseMcpTool tên hỏng/không phải MCP → null');

  ok(call('mcp__a__t', null) === null && call('mcp__a__t', {}) === null, 'AC2.2: không cấu hình (null, {}) → không quyết định');

  const table = [
    ['AC2.3: mcpAllow chặn server ngoài danh sách', { mcpAllow: ['a'] }, 'mcp__b__t', true],
    ['AC2.3: mcpAllow cho server trong danh sách', { mcpAllow: ['a'] }, 'mcp__a__t', false],
    ['AC2.3: plugin server trong mcpAllow', { mcpAllow: ['plugin:p:a'] }, 'mcp__plugin_p_a__t', false],
    ['AC2.3: plugin server ngoài mcpAllow', { mcpAllow: ['plugin:p:a'] }, 'mcp__plugin_p_b__t', true],
    ['AC2.3: server có dấu gạch dưới', { mcpAllow: ['my_server'] }, 'mcp__my_server__t', false],
    ['AC2.4: mcpDeny thắng mcpAllow', { mcpAllow: ['a'], mcpDeny: ['a'] }, 'mcp__a__t', true],
    ['AC2.4: mcpDeny đơn lẻ chặn đúng server', { mcpDeny: ['a'] }, 'mcp__a__t', true],
    ['AC2.4: mcpDeny đơn lẻ không chặn server khác', { mcpDeny: ['a'] }, 'mcp__b__t', false],
    ['AC2.5: mcpAllow sai kiểu (chuỗi) → bỏ qua', { mcpAllow: 'a' }, 'mcp__b__t', false],
    ['AC2.5: mcpAllow toàn phần tử không phải chuỗi → bỏ qua', { mcpAllow: [1] }, 'mcp__b__t', false],
    ['AC2.5: mcpAllow null → bỏ qua', { mcpAllow: null }, 'mcp__b__t', false],
    ['AC2.5: mảng lẫn kiểu: chỉ giữ chuỗi', { mcpAllow: ['a', 1] }, 'mcp__b__t', true],
    ['AC2.5: tên tool hỏng mcp__', { mcpAllow: ['a'] }, 'mcp__', false],
    ['AC2.5: tên tool thiếu phần tool mcp__a', { mcpDeny: ['a'] }, 'mcp__a', false],
    ['AC2.5: tool không phải MCP', { mcpAllow: ['a'] }, 'Bash', false],
  ];
  for (const [name, cfg, tool, deny] of table) {
    const r = call(tool, cfg);
    ok(deny ? r?.decision === 'deny' && typeof r.reason === 'string' && r.reason.length > 0 : r === null, name);
  }
  const reason = call('mcp__b__t', { mcpAllow: ['a'] })?.reason || '';
  ok(reason.includes('b') && /mcpAllow/.test(reason), 'AC2.3: lý do nêu server bị chặn và khoá cần sửa');
  ok(/mcpDeny/.test(call('mcp__a__t', { mcpDeny: ['a'] })?.reason || ''), 'AC2.4: lý do deny nêu mcpDeny');

  const run = (stdin, cwd) => execFileSync('node', [script], { input: stdin, encoding: 'utf8', cwd });
  ok(run('') === '' && run('nope') === '' && run('{}') === '', 'AC2.5: CLI input rỗng/hỏng/{} → exit 0, không in gì');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aip-mcp-'));
  try {
    const repo = path.join(tmp, 'repo');
    const plain = path.join(tmp, 'plain');
    fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
    fs.mkdirSync(plain);
    execFileSync('git', ['init', '-q', repo]);
    fs.writeFileSync(path.join(repo, '.claude', 'aip-gate.json'), '﻿' + JSON.stringify({ mcpAllow: ['a'] }));
    const payload = (cwd) => '﻿' + JSON.stringify({ tool_name: 'mcp__b__t', cwd });
    const out = JSON.parse(run(payload(repo), repo) || '{}');
    ok(out.hookSpecificOutput?.hookEventName === 'PreToolUse' && out.hookSpecificOutput?.permissionDecision === 'deny'
      && /b/.test(out.hookSpecificOutput?.permissionDecisionReason || ''), 'AC2.3: CLI BOM stdin + aip-gate.json có BOM trong git repo → in JSON deny');
    ok(run(JSON.stringify({ tool_name: 'mcp__a__t', cwd: repo }), repo) === '', 'AC2.3: CLI server được phép → không in gì');
    ok(run(payload(plain), plain) === '', 'AC2.2: CLI thư mục không phải git → không in gì');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
