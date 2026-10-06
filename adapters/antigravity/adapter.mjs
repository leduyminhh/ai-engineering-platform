// antigravity adapter — Google Antigravity cũng đọc AGENTS.md làm "hợp đồng".
// Mỗi plugin sinh một bộ riêng: build/antigravity/<id>/AGENTS.md + docs/workflow/<stage>.md.
import { agentsFiles } from '../_shared/lib.mjs';

export default {
  name: 'antigravity',
  describe: 'Google Antigravity — build/antigravity/<id>/AGENTS.md + docs/workflow/ cho mỗi plugin',
  build(plugins, { core }) {
    // Skill dùng chung của core (core/skills/) gộp vào bundle TỪNG plugin —
    // cùng cách core principles được inline per-plugin; chúng nằm chung nhóm "Skill (gọi theo yêu cầu)".
    return plugins.flatMap((p) =>
      agentsFiles({ ...p, stages: [...p.stages, ...(core.stages || [])] }, { tool: 'Antigravity', base: p.id, core }),
    );
  },
};
