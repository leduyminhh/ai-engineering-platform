// Đo dung lượng context từ transcript JSONL của Claude Code. Zero-dependency.
// [Unverified] Layout <home>/.claude/projects/<slug>/*.jsonl là nội bộ của Claude Code, không phải hợp đồng công khai.
import fs from 'node:fs';
import path from 'node:path';

export function projectSlug(cwd) {
  return cwd.replace(/[:\\/]/g, '-');
}

export function findTranscripts({ home, cwd }) {
  const dir = path.join(home, '.claude', 'projects', projectSlug(cwd));
  let names;
  try { names = fs.readdirSync(dir); } catch { return []; }
  return names.filter((n) => n.endsWith('.jsonl')).map((n) => path.join(dir, n));
}

function textLen(c) {
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c)) return c.reduce((n, b) => n + (typeof b?.text === 'string' ? b.text.length : JSON.stringify(b ?? '').length), 0);
  return c == null ? 0 : JSON.stringify(c).length;
}

const add = (map, key, n) => { map[key] = (map[key] || 0) + n; };

export function statsFromLines(lines) {
  const chars = { toolResult: 0, toolUse: 0, assistantText: 0, thinking: 0, userText: 0, attachment: 0 };
  const toolResultByTool = {};
  const attachmentByType = {};
  const turnCtx = new Map(); // message.id -> ctx lớn nhất; Map giữ thứ tự xuất hiện đầu tiên
  const toolNames = new Map();
  const seenUse = new Set();
  const seenResult = new Set();
  let anon = 0;

  for (const line of lines) {
    let e;
    // Dòng cuối của phiên đang chạy có thể dở; bỏ qua thay vì làm hỏng cả báo cáo.
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e !== 'object') continue;

    if (e.type === 'attachment') {
      const n = JSON.stringify(e.attachment ?? '').length;
      chars.attachment += n;
      add(attachmentByType, e.attachment?.type || 'unknown', n);
      continue;
    }
    if (e.type !== 'assistant' && e.type !== 'user') continue;
    const msg = e.message || {};

    if (e.type === 'assistant' && msg.usage) {
      const u = msg.usage;
      const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      const id = msg.id ?? `anon-${anon++}`;
      turnCtx.set(id, Math.max(turnCtx.get(id) ?? 0, ctx));
    }

    if (typeof msg.content === 'string') {
      if (e.type === 'user') chars.userText += msg.content.length;
      else chars.assistantText += msg.content.length;
      continue;
    }
    for (const b of Array.isArray(msg.content) ? msg.content : []) {
      if (!b || typeof b !== 'object') continue;
      if (b.type === 'tool_use') {
        if (seenUse.has(b.id)) continue;
        seenUse.add(b.id);
        toolNames.set(b.id, b.name);
        chars.toolUse += JSON.stringify(b.input ?? {}).length;
      } else if (b.type === 'tool_result') {
        if (seenResult.has(b.tool_use_id)) continue;
        seenResult.add(b.tool_use_id);
        const n = textLen(b.content);
        chars.toolResult += n;
        add(toolResultByTool, toolNames.get(b.tool_use_id) || 'unknown', n);
      } else if (b.type === 'thinking' && e.type === 'assistant') {
        chars.thinking += (b.thinking || '').length;
      } else if (b.type === 'text') {
        if (e.type === 'user') chars.userText += (b.text || '').length;
        else chars.assistantText += (b.text || '').length;
      }
    }
  }

  const ctxs = [...turnCtx.values()];
  let peakCtx = 0;
  let peakTurn = 0;
  ctxs.forEach((c, i) => { if (c > peakCtx) { peakCtx = c; peakTurn = i + 1; } });
  return {
    turns: ctxs.length,
    firstCtx: ctxs[0] ?? 0,
    peakCtx,
    peakTurn,
    lastCtx: ctxs.length ? ctxs[ctxs.length - 1] : 0,
    chars,
    toolResultByTool,
    attachmentByType,
  };
}

export function statsForFile(file) {
  return statsFromLines(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean));
}
