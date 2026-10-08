// Ngữ cảnh dùng chung cho các module test/contract và test/content: nạp nguồn một lần, build (nếu --build) trước khi đọc output.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadPlugins, loadCore, loadMarketplace, loadWorkflows, splitList, parseFrontmatter, loadSkillsFrom, REPO_ROOT, PLUGINS_DIR, CORE_DIR } from '../cli/lib/plugins.mjs';
import { checkWorkflowBody, parseSteps, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS, missingAnchors, registrySignals } from '../cli/lib/workflows.mjs';
import { offeredCatalog } from '../cli/lib/install.mjs';
import claudeAdapter from '../adapters/claude/adapter.mjs';
import codexAdapter from '../adapters/codex/adapter.mjs';
import cursorAdapter from '../adapters/cursor/adapter.mjs';
import { tomlBasic, tomlMultiline } from '../adapters/_shared/agents.mjs';
import { agentsFiles, whenToUse, WHEN_TO_USE_MAX, principlesDigest } from '../adapters/_shared/lib.mjs';
import { frontmatter, yamlScalar } from '../cli/lib/write.mjs';
import { checkSkillBody, checkDescription, notForTargets, quotedPhrases, triggerCollisions, checkFrontmatterYaml, checkDescriptionStyle, checkAgentDescription, DESCRIPTION_TARGET, AGENT_DESCRIPTION_MAX, SOURCE_KEYS, checkSourceKeys, checkPassthroughTypes } from '../cli/lib/conventions.mjs';
import { lineOverlap, stepOverlap, titleOverlap } from './overlap.mjs';
import { hashDir, currentVersions, planLock, lockDecision, diffLock, readLock } from '../cli/lib/versions.mjs';
import { parseClaudePluginList } from '../cli/lib/install.mjs';

const RUN_IN = ['plan', 'execute'];
const INVOKE_IN = ['once', 'per-request'];

/** Đường dẫn tương đối (POSIX) của mọi file dưới `dir`, đệ quy. [] nếu dir không tồn tại. */
function listFilesRec(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRec(p, baseDir));
    else out.push(path.relative(baseDir, p).split(path.sep).join('/'));
  }
  return out;
}
const hasFiles = (dir) => listFilesRec(dir).length > 0;

const BUILD = path.join(REPO_ROOT, 'build');

/** `fails` là mảng của harness: khối build ghi thẳng vào đó khi một SKILL.md build hỏng frontmatter. */
export async function buildContext({ build = false, fails = [] } = {}) {
  // Build phải xong trước khi bất kỳ module nào đọc build/ (các module chỉ-đọc-nguồn không bị ảnh hưởng).
  if (build) execFileSync('node', ['cli/build.mjs', '--target', 'all'], { cwd: REPO_ROOT, stdio: 'ignore' });

  const core = loadCore();
  const plugins = loadPlugins();
  const workflows = loadWorkflows();
  const catalogSkillIds = new Set([
    'core/principles', ...core.stages.map((s) => `core/${s.id}`),
    ...plugins.flatMap((p) => p.stages.map((s) => `${p.id}/${s.id}`)),
  ]);
  const allAgents = plugins.flatMap((p) => p.agents);
  const claudeDir = path.join(BUILD, 'claude');

  // Fixture adapter thuần (không đọc plugin thật).
  const fxAgent = { id: 'fx-reviewer', plugin: 'fx', description: 'Agent fixture để test adapter', mode: 'read-only',
    skills: ['fx/fx-review'], model: null, effort: 'high', color: null, body: '## Vai trò\nx\n', file: '' };
  const fxPlugin = { id: 'fx', name: 'Fixture', description: 'Plugin fixture', version: '1.0.0',
    shared: { principles: '' }, stages: [], agents: [fxAgent] };
  const fxWorkflows = { id: 'workflows', name: 'Workflows', description: 'Bộ workflow fixture', version: '1.0.0',
    shared: { principles: '' }, agents: [], stages: [{ id: 'workflow-demo', description: 'Workflow fixture để test',
      body: '# Demo\n', agents: ['fx-reviewer'], requires: ['core/git-workflow'],
      assets: [], fileAssets: [], dirAssets: [], assetsDir: '' }] };
  const fxCore = { ...loadCore(), stages: [] };
  const fxMk = { name: 'fx-mkt', owner: { name: 'fx' }, description: '' };
  const byPath = (files) => new Map(files.map((f) => [f.path, f]));

  return {
    fs, path, os, execFileSync, pathToFileURL,
    loadPlugins, loadCore, loadMarketplace, loadWorkflows, splitList, parseFrontmatter, loadSkillsFrom, REPO_ROOT, PLUGINS_DIR, CORE_DIR,
    checkWorkflowBody, parseSteps, stepRefs, parseRegistry, expandWorkflowDeps, missingDeps, RISKS, missingAnchors, registrySignals,
    offeredCatalog, claudeAdapter, codexAdapter, cursorAdapter, tomlBasic, tomlMultiline,
    agentsFiles, whenToUse, WHEN_TO_USE_MAX, principlesDigest, frontmatter, yamlScalar,
    checkSkillBody, checkDescription, notForTargets, quotedPhrases, triggerCollisions, checkFrontmatterYaml,
    checkDescriptionStyle, checkAgentDescription, DESCRIPTION_TARGET, AGENT_DESCRIPTION_MAX, SOURCE_KEYS, checkSourceKeys, checkPassthroughTypes,
    lineOverlap, stepOverlap, titleOverlap,
    hashDir, currentVersions, planLock, lockDecision, diffLock, readLock, parseClaudePluginList,
    RUN_IN, INVOKE_IN, listFilesRec, hasFiles, BUILD, claudeDir,
    core, plugins, workflows, catalogSkillIds, allAgents,
    fxAgent, fxPlugin, fxWorkflows, fxCore, fxMk, byPath,
    fails,
  };
}
