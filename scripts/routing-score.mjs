#!/usr/bin/env node
// Chấm routing tất định: prompt mẫu (test/routing/<id>.json) xếp hạng với `description` của mọi id published bằng TF-IDF + cosine.
// Cách dùng: [--lock] — in số đo positive/negative và các miss; --lock ghi test/routing/rank1.lock.json khi số đo tăng, exit 1 khi tụt.
// Hằng số: idf = log((N+1)/(df+1)) + 1; tf = số lần xuất hiện; điểm = cosine; token = unigram + bigram sau normalize (bỏ dấu, đ → d), bỏ token 1 ký tự.
// Chọn cấu hình (đo trên 50 id): bigram+bỏ 1 ký tự 70%/94%, bigram+giữ 1 ký tự 70%/93%, không bigram 68%/93% (positive/negative).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, loadCore, loadWorkflows, loadPlugins } from '../cli/lib/plugins.mjs';
import { offeredCatalog } from '../cli/lib/install.mjs';

const ROUTING_DIR = path.join(REPO_ROOT, 'test', 'routing');
const LOCK_FILE = path.join(ROUTING_DIR, 'rank1.lock.json');

export const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function tokens(text) {
  const w = normalize(text).split(' ').filter((x) => x.length >= 2);
  return [...w, ...w.slice(1).map((x, i) => `${w[i]} ${x}`)];
}

// Phần "Không dùng khi" chỉ dẫn sang skill khác, chấm vào đó sẽ kéo prompt về nhầm id.
export const routable = (description) => description.replace(/Không dùng khi[\s\S]*$/i, '');

const counts = (list) => list.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());

export function buildIndex(docs) {
  const df = new Map();
  const tfs = docs.map((d) => counts(tokens(d.text)));
  for (const tf of tfs) for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const idf = (t) => Math.log((docs.length + 1) / ((df.get(t) || 0) + 1)) + 1;
  const vec = (tf) => new Map([...tf].map(([t, c]) => [t, c * idf(t)]));
  const norm = (v) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  const vecs = tfs.map((tf, i) => { const v = vec(tf); return { id: docs[i].id, v, n: norm(v) }; });
  return { vecs, vec, norm };
}

export function rank(index, prompt) {
  const q = index.vec(counts(tokens(prompt)));
  const qn = index.norm(q);
  return index.vecs.map(({ id, v, n }) => {
    let dot = 0;
    for (const [t, w] of q) dot += w * (v.get(t) || 0);
    return { id, score: dot ? dot / (qn * n) : 0 };
  }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function measure({ docs, data }) {
  const index = buildIndex(docs);
  const out = { positive: { hit: 0, total: 0, pct: 0 }, negative: { hit: 0, total: 0, pct: 0 }, misses: [] };
  for (const [id, { positive = [], negative = [] }] of Object.entries(data)) {
    for (const [kind, prompts] of [['positive', positive], ['negative', negative]]) {
      for (const prompt of prompts) {
        const top = rank(index, prompt)[0].id;
        out[kind].total++;
        if ((top === id) === (kind === 'positive')) out[kind].hit++;
        else out.misses.push({ kind, id, top, prompt });
      }
    }
  }
  for (const k of ['positive', 'negative']) out[k].pct = out[k].total ? Math.floor((100 * out[k].hit) / out[k].total) : 0;
  return out;
}

// Chỉ cho khoá tăng: một trục tụt thì fail dù trục kia tăng, để khoá không bị đổi chác.
export function lockDecision({ measured, locked }) {
  const m = { positive: measured.positive.pct, negative: measured.negative.pct };
  if (!locked) return { action: 'write', lock: { positive: { threshold: m.positive }, negative: { threshold: m.negative } } };
  const l = { positive: locked.positive.threshold, negative: locked.negative.threshold };
  if (m.positive < l.positive || m.negative < l.negative) return { action: 'fail', lock: locked };
  if (m.positive === l.positive && m.negative === l.negative) return { action: 'keep', lock: locked };
  return { action: 'write', lock: { positive: { threshold: m.positive }, negative: { threshold: m.negative } } };
}

export function loadRoutingDocs() {
  const groups = [loadCore(), loadWorkflows(), ...loadPlugins()].filter(Boolean);
  const desc = new Map(groups.flatMap((g) => g.stages.map((s) => [`${g.id}/${s.id}`, s.description || ''])));
  const wf = groups.find((g) => g.id === 'workflows');
  const ids = new Set(offeredCatalog().plugins.flatMap((p) => p.skillIds).filter((s) => s !== 'core/principles'));
  for (const s of wf?.stages || []) ids.add(`workflows/${s.id}`);
  return [...ids].map((full) => ({ id: full.split('/').pop(), text: routable(desc.get(full) || '') }));
}

export function loadRoutingData() {
  const data = {};
  for (const f of fs.readdirSync(ROUTING_DIR).filter((x) => x.endsWith('.json') && x !== 'rank1.lock.json')) {
    data[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(ROUTING_DIR, f), 'utf8'));
  }
  return data;
}

function main(argv) {
  const m = measure({ docs: loadRoutingDocs(), data: loadRoutingData() });
  for (const k of ['positive', 'negative']) console.log(`${k}: ${m[k].hit}/${m[k].total} (${m[k].pct}%)`);
  for (const x of m.misses) console.log(`miss ${x.kind} ${x.id} → hạng 1 ${x.top}: ${x.prompt}`);
  if (!argv.includes('--lock')) return 0;
  const locked = fs.existsSync(LOCK_FILE) ? JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8')) : null;
  const d = lockDecision({ measured: m, locked });
  if (d.action === 'fail') { console.error('số đo thấp hơn file khoá, không ghi'); return 1; }
  if (d.action === 'write') { fs.writeFileSync(LOCK_FILE, JSON.stringify(d.lock, null, 2) + '\n'); console.log(`đã ghi ${path.relative(REPO_ROOT, LOCK_FILE)}`); }
  return 0;
}

const invoked = (() => {
  try { return !!process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return false; }
})();
if (invoked) process.exitCode = main(process.argv.slice(2));
