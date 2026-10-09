# Thiết kế: Skill core `spec-writing` — khảo sát yêu cầu + viết feature/requirement spec

- Ngày: 2026-09-03
- Trạng thái: **Đã thực thi** — skill core `spec-writing` (`b0d49b7`), merge vào `master` qua PR #23 (`d08de01`, 2026-09-04); sau đó chuyển sang plugin `engineering` thành `engineering-spec-writing` (`7fda25c`).
- Phạm vi: Nội dung — thêm skill DÙNG CHUNG (core) `spec-writing` dưới `core/skills/`. Không đổi
  engine/adapter/CLI.

## 1. Mục tiêu & tiêu chí thành công

Việc lặp lại "khảo sát yêu cầu rồi viết đặc tả cho một tính năng" hiện chưa có skill core hỗ trợ. Bộ skill
BA/SAP giàu artifact (`fisba`, `fissap`, `fispm`) CHỈ tồn tại trên Claude/Cowork, KHÔNG được project ra
Codex/Cursor/Antigravity và không gắn với quy ước tài liệu của repo này. Mục tiêu: một recipe **gọn,
aip-native, portable qua mọi provider** giúp agent **khảo sát yêu cầu** và **viết một feature/requirement
spec** vào đúng cấu trúc tài liệu sẵn có của project (`docs/requests/`), **defer** bộ artifact BA/SAP sâu
(PRD/SOD/DDD/FSD/BRD/personas) cho FIS trên Cowork qua một ghi chú handoff — KHÔNG dựng lại chúng.

Thành công khi:

1. Có `core/skills/spec-writing/SKILL.md` (recipe mỏng) + `references/` (dày) theo cách khung vận hành.
2. Skill là recipe **on-demand** (`pipeline: false`, `next: null`, `order` sau `quality-gate`), auto-discover
   trong `core/skills/`, project ra **cả 4 provider** (claude/cursor/codex/antigravity), parity `references/`.
3. Spec được viết vào `docs/requests/<yyyy-mm-dd>-<slug>/requirement.md` (+ khung `plan.md`) — bám scaffold
   `_TEMPLATE`, KHÔNG dựng cấu trúc song song.
4. Acceptance criteria **đo được**; quyết định lớn có ADR ở `docs/decisions/`; điểm chạm data/contract link
   tới `docs/contracts/` + data-model.
5. `npm test` xanh; `npm run build` ship skill + references ra 4 provider.
6. **Docs-only** — skill là *hướng dẫn agent khảo sát + viết tài liệu*, KHÔNG sinh code, KHÔNG dựng lại
   artifact FIS.

## 2. Phạm vi

- **Trong phạm vi:** khảo sát/làm rõ yêu cầu (bộ câu hỏi BA), viết **feature/requirement spec ở mức
  FEATURE** (không phân rã story) vào `docs/requests/<ngày>-<slug>/requirement.md` + khung `plan.md`; ghi ADR
  cho quyết định lớn; link điểm chạm data/contract; acceptance criteria đo được; verify bằng checklist.
- **Ngoài phạm vi:** bộ artifact BA đầy đủ (PRD/SOD/DDD/FSD/BRD/personas chi tiết) và đặc tả SAP-specific —
  **defer cho FIS** (`fisba`/`fissap`/`fispm`) khi đang ở Cowork; phân rã story/task chi tiết; sinh code;
  viết `project-knowledge/` hay `code-convention.md` (đã có skill init lo).

## 3. Kiến trúc đích

```
core/skills/spec-writing/
├── SKILL.md                    # recipe mỏng: nạp context -> khảo sát -> viết spec -> ADR -> verify
└── references/
    ├── spec-structure.md       # cấu trúc feature/requirement spec + map vào requirement.md/plan.md
    ├── elicitation.md          # bộ câu hỏi khảo sát BA theo nhóm + nguyên tắc hỏi
    └── checklist.md            # Definition of Done cho spec (đo được, fail-loud)
```

Frontmatter: `name: spec-writing`; `order: 4` (kế tiếp sau `git-workflow=2`, `quality-gate=3`);
`stageNumber: "04"`; `title` (VN); `runsIn: plan`; `invoke: per-request`; `pipeline: false`; `next: null`.
Không khai `sharedAssets`. Là skill core nên ship kèm mọi provider qua cùng cơ chế `loadCore()`/adapter như
`git-workflow`, `quality-gate`.

## 4. Luồng skill (5 bước)

0. **Nạp context (BẮT BUỘC):** đọc `project-knowledge/` (`project-overview.md`, `domain-context.md`),
   `docs/decisions/` (ADR đã có), `docs/contracts/` (contract/data-model nếu có), `CLAUDE.md`; xác định
   feature/yêu cầu cần đặc tả + đối tượng đọc.
1. **Khảo sát / làm rõ** (references/elicitation.md): hỏi các câu BA còn thiếu — mục tiêu & success criteria,
   actors/personas (lite), phạm vi & out-of-scope, ràng buộc, NFR, edge case, tiêu chí chấp nhận. Hỏi TỪNG
   câu khi thiếu; xác nhận hiểu đúng; KHÔNG bịa, đánh dấu giả định.
2. **Viết spec** (references/spec-structure.md): ghi vào `docs/requests/<yyyy-mm-dd>-<slug>/requirement.md`
   (+ khung `plan.md`): bối cảnh/vấn đề, mục tiêu + success criteria (ĐO ĐƯỢC), phạm vi/out-of-scope, actors,
   **functional requirements ở mức FEATURE (không phân rã story)**, acceptance criteria, điểm chạm
   data/contract (link `docs/contracts/` + data-model), rủi ro/giả định/câu hỏi mở. Tiếng Việt có dấu.
3. **Ghi ADR** cho quyết định lớn vào `docs/decisions/` (đánh số tiếp) theo `_TEMPLATE.md`; link
   contract/data-model liên quan.
4. **Verify** (references/checklist.md): đủ mục; acceptance criteria đo được; không mâu thuẫn; truy vết được
   về nguồn (project-knowledge/ADR/contract); con người duyệt.

## 5. Kiểm thử & verification

- `npm test`: frontmatter contract cho core skill (`pipeline=false`, `next=null`, `runsIn∈{plan,execute}`,
  `invoke∈{once,per-request}`, có `stageNumber`), parity `references/` qua 4 adapter, strip workflow-metadata.
  Phải xanh.
- `npm run build`: `spec-writing/` + `references/` xuất hiện trong output core của claude/codex/cursor và
  trong bundle từng plugin của antigravity (recipe on-demand core).

## 6. Ranh giới / ngoài phạm vi

- **Docs-only** — không sinh code; không phân rã story (giữ ở mức feature-level).
- **Không dựng lại artifact FIS.** Khi cần bộ artifact BA đầy đủ (PRD/SOD/DDD/FSD/BRD/personas) hoặc đặc tả
  SAP-specific và đang ở Cowork có skill FIS (`fisba`/`fissap`/`fispm`) → **handoff sang FIS** cho phần sâu;
  skill này lo phần spec lõi + tích hợp cấu trúc tài liệu repo. Nêu graceful: không có FIS thì recipe này vẫn
  đủ cho spec feature-level.
- Defer `project-knowledge/` + `code-convention.md` (skill init lo); không chế cấu trúc tài liệu song song
  với `_TEMPLATE`.
- Chỉ thêm nội dung `core`; không đụng CLI/adapter/engine. Con người **duyệt** spec trước khi dùng làm nguồn.
- **REALITY FILTER:** ngôn ngữ đo được; không tuyên bố "đảm bảo/loại bỏ rủi ro"; giả định + câu hỏi mở phải
  liệt kê rõ (fail-loud).

## 7. Các pha thực thi

1. Viết `SKILL.md`.
2. Viết 3 file `references/` (spec-structure, elicitation, checklist).
3. `npm test` + `npm run build`; xác nhận ship qua 4 provider.
