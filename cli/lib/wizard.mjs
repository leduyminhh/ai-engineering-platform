// Wizard tương tác step-by-step (keypress TUI). Logic step-machine có back, deps injectable để test.
import * as prompt from './prompt.mjs';
import { PROVIDERS } from './paths.mjs';
import { knownPluginIds, check, offeredCatalog } from './install.mjs';

const { BACK, CANCEL } = prompt;

const defaultDeps = {
  selectOne: prompt.selectOne, selectMany: prompt.selectMany, confirmStep: prompt.confirmStep,
  selectTree: prompt.selectTree,
  PROVIDERS, knownPluginIds, check, offeredCatalog,
};

/** Chạy danh sách step có back. step = { key, run(state) -> value|BACK|CANCEL }.
 *  BACK ở bước >0 lùi 1 bước (giữ state); BACK ở bước 0 hoặc CANCEL -> trả null. */
export async function runSteps(steps) {
  const state = {};
  let i = 0;
  while (i < steps.length) {
    const res = await steps[i].run(state);
    if (res === CANCEL) return null;
    if (res === BACK) { if (i === 0) return null; i -= 1; continue; }
    state[steps[i].key] = res;
    i += 1;
  }
  return state;
}

const SCOPE_ITEMS = [
  { label: 'project — thư mục hiện tại', value: 'project' },
  { label: 'global  — toàn máy (~)', value: 'global' },
];

export async function runWizard(action, deps = defaultDeps) {
  const d = { ...defaultDeps, ...deps };

  if (!action) {
    const picked = await d.selectOne('aip · Chọn thao tác', [
      { label: 'install   — cài workflow', value: 'install' },
      { label: 'uninstall — gỡ workflow đã cài', value: 'uninstall' },
      { label: 'update    — cập nhật plugin đã cài (pull → build → cài lại)', value: 'update' },
      { label: 'build     — chỉ build ra build/<tool>/', value: 'build' },
    ]);
    if (picked === BACK || picked === CANCEL) return null;
    action = picked;
  }

  const provItems = d.PROVIDERS.map((p) => ({ label: p, value: p }));

  // Cây skill CÓ THỂ chọn lẻ, gộp theo plugin — dùng chung cho uninstall (gỡ) và update (làm tươi).
  // Bỏ baseline không tách lẻ được (core/principles + generated <plugin>-principles).
  const removableGroups = (installs) => {
    const byPlugin = new Map();
    for (const e of installs) for (const sid of (e.skills || [])) {
      const [plug, name] = sid.split('/');
      if (sid === 'core/principles' || name === `${plug}-principles`) continue;
      if (!byPlugin.has(plug)) byPlugin.set(plug, new Set());
      byPlugin.get(plug).add(sid);
    }
    return [...byPlugin.entries()].map(([plug, set]) => ({
      plugin: plug, label: plug,
      skills: [...set].sort().map((v) => ({ value: v, label: v.split('/')[1] })),
    }));
  };

  if (action === 'build') {
    const ok = await d.confirmStep('build · build mọi adapter ra build/<tool>/');
    return (ok === BACK || ok === CANCEL) ? null : { action: 'build' };
  }

  if (action === 'install') {
    // Kiểu cài CHỈ áp dụng cho claude; chỉ hỏi khi claude được chọn, ngược lại mặc định 'skills'.
    const KIND_ITEMS = [
      { label: 'skills — copy vào .claude/skills/ (mặc định, không cần CLI "claude")', value: 'skills' },
      { label: 'plugin — đăng ký marketplace qua "claude plugin" (namespaced, core auto theo dependency)', value: 'plugin' },
    ];
    // Skill đã cài cho các provider vừa chọn (đọc manifest qua check.skills) → preselect cây skill.
    const installedSkills = (scope, providers) => {
      const set = new Set();
      for (const e of d.check({ scope }).installs) {
        if (!providers.includes(e.provider)) continue;
        for (const sid of (e.skills || [])) set.add(sid);
      }
      return set;
    };
    // Dựng nhóm cây skill từ catalog ĐƯỢC OFFER (core + plugin đã published; core/principles con KHOÁ).
    const skillGroups = () => d.offeredCatalog().plugins.map((p) => ({
      plugin: p.id, label: p.id,
      skills: p.skillIds.map((v) => ({ value: v, label: v.split('/')[1], locked: v === 'core/principles' })),
    }));
    // scope + provider hỏi TRƯỚC để biết bối cảnh, rồi mới dựng cây skill với preselect đúng provider.
    // Nhãn theo TÊN bước, không dùng "N/5": bước kiểu cài chỉ hiện khi chọn claude nên tổng số bước
    // thay đổi — mẫu số cố định sẽ sai khi bỏ qua bước đó.
    const st = await runSteps([
      { key: 'scope', run: () => d.selectOne('install · Scope', SCOPE_ITEMS) },
      { key: 'providers', run: (s) => d.selectMany('install · Provider', provItems, { preselected: s.providers, min: 1 }) },
      { key: 'skills', run: (s) => {
          // Mặc định bật core/git-workflow để khớp default CLI (whole-core baseline) + skill đã cài của provider.
          const pre = new Set(['core/git-workflow', ...installedSkills(s.scope, s.providers)]);
          return d.selectTree('install · Skill (gộp theo plugin)', skillGroups(), { preselected: [...pre], min: 1 });
        } },
      { key: 'mode', run: (s) => s.providers.includes('claude')
          ? d.selectOne('install · Kiểu cài cho claude', KIND_ITEMS)
          : 'skills' },
      { key: 'ok', run: (s) => d.confirmStep('install · Xác nhận',
          [`skills=${s.skills.join(',')} | providers=${s.providers.join(',')} | scope=${s.scope}` +
            (s.providers.includes('claude') ? ` | claude=${s.mode}` : '')]) },
    ]);
    return st ? { action: 'install', plugins: [], skills: st.skills, providers: st.providers, scope: st.scope, mode: st.mode } : null;
  }

  if (action === 'update') {
    // Chọn skill/plugin để làm tươi (mặc định bật hết = update mọi entry). Chỉ có install copy-mode
    // (plugin-mode do `claude` CLI quản, không tách skill) → cây rỗng thì bỏ bước, update tất cả.
    const st = await runSteps([
      { key: 'scope', run: () => d.selectOne('update · Bước 1/3 · Chọn scope', SCOPE_ITEMS) },
      { key: 'skills', run: (s) => {
          const installs = d.check({ scope: s.scope }).installs;
          if (!installs.length) { console.log(`\nKhông có gì đã cài ở scope=${s.scope} để update. (b để đổi scope, q để thoát)`); return CANCEL; }
          const groups = removableGroups(installs.filter((e) => e.mode !== 'plugin'));
          if (!groups.length) return []; // chỉ có plugin-mode / core-only → không lọc, update tất cả
          const all = groups.flatMap((g) => g.skills.map((sk) => sk.value));
          return d.selectTree('update · Bước 2/3 · Chọn skill/plugin để làm tươi (mặc định tất cả)',
            groups, { preselected: all, min: 1 });
        } },
      { key: 'ok', run: (s) => {
          const installs = d.check({ scope: s.scope }).installs;
          const skills = s.skills || [];
          const sel = skills.length ? `skills=${skills.join(',')}` : 'tất cả entry';
          const summary = installs.map((e) => `${e.provider}(${(e.plugins || []).join(',')})`).join(' · ');
          return d.confirmStep('update · Bước 3/3 · Xác nhận',
            [`git pull → build → làm tươi ${sel} | đã cài: ${summary} | scope=${s.scope}`]);
        } },
    ]);
    // skills rỗng = không lọc (update mọi entry); có skill = chỉ entry chứa skill đó.
    return st ? { action: 'update', scope: st.scope, skills: st.skills || [] } : null;
  }

  if (action === 'uninstall') {
    // Copy-mode: cây skill gộp theo plugin (bỏ baseline không gỡ lẻ được). Plugin-mode (claude
    // --as-plugin) do `claude` CLI quản, không tách skill → chọn theo NGUYÊN plugin. Hai loại được
    // gỡ bằng hai lời gọi uninstall RIÊNG (mỗi loại scope đúng provider) nên không lẫn bộ lọc.
    const pmItems = (scope) => d.check({ scope }).installs
      .filter((e) => e.mode === 'plugin')
      .flatMap((e) => (e.plugins || []).map((p) => ({ value: `${e.provider}::${p}`, label: `${e.provider}:${p} (plugin-mode)` })));
    const st = await runSteps([
      { key: 'scope', run: () => d.selectOne('uninstall · Scope', SCOPE_ITEMS) },
      { key: 'skills', run: (s) => {
          const groups = removableGroups(d.check({ scope: s.scope }).installs.filter((e) => e.mode !== 'plugin'));
          if (!groups.length) {
            if (!pmItems(s.scope).length) { console.log(`\nKhông có gì đã cài ở scope=${s.scope} để gỡ. (b để đổi scope, q để thoát)`); return CANCEL; }
            return []; // chỉ có plugin-mode → bỏ chọn skill, sang bước chọn plugin
          }
          return d.selectTree('uninstall · Skill copy-mode (gộp theo plugin)', groups, { min: 1 });
        } },
      { key: 'pmPlugins', run: (s) => {
          const items = pmItems(s.scope);
          if (!items.length) return []; // không có plugin-mode → bỏ qua bước này
          return d.selectMany('uninstall · Plugin-mode (claude) để gỡ', items, { min: (s.skills || []).length ? 0 : 1 });
        } },
      { key: 'ok', run: (s) => {
          const parts = [];
          if ((s.skills || []).length) parts.push(`skills=${s.skills.join(',')}`);
          if ((s.pmPlugins || []).length) parts.push(`plugin-mode=${s.pmPlugins.join(',')}`);
          return d.confirmStep('uninstall · Xác nhận gỡ', [`${parts.join(' | ')} | scope=${s.scope}`]);
        } },
    ]);
    if (!st) return null;
    // providers copy-mode ảnh hưởng = provider chứa ≥1 skill vừa chọn (uninstall() lọc thêm theo skill).
    const providers = [...new Set(
      d.check({ scope: st.scope }).installs.filter((e) => e.mode !== 'plugin')
        .filter((e) => (e.skills || []).some((sid) => (st.skills || []).includes(sid))).map((e) => e.provider),
    )];
    // Gom plugin-mode theo provider → mỗi provider một lời gỡ riêng (scope đúng provider, không lẫn).
    const byProvider = new Map();
    for (const v of (st.pmPlugins || [])) {
      const [prov, plug] = v.split('::');
      if (!byProvider.has(prov)) byProvider.set(prov, []);
      byProvider.get(prov).push(plug);
    }
    const pluginModeRemovals = [...byProvider.entries()].map(([provider, plugins]) => ({ provider, plugins }));
    return { action: 'uninstall', providers, skills: st.skills || [], scope: st.scope, pluginModeRemovals };
  }

  return null;
}
