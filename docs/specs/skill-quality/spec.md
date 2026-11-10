# Spec: skill-quality

Cập nhật: 2026-11-10

## Mục đích

Đo chất lượng định tuyến của skill và workflow đã published mà không tốn tiền model, để `npm test` bắt được khi `description` đổi làm skill khó được chọn đúng hơn.

## Phạm vi

- Gồm: scorer routing tất định `scripts/routing-score.mjs`, dữ liệu prompt `test/routing/<id>.json`, file khoá ngưỡng `test/routing/rank1.lock.json`, contract `test/contract/56-routing-score.contract.mjs`; case eval "phải im lặng" trong `evals/`.
- Không gồm: chạy eval bằng model thật (`scripts/eval-run.mjs`, chạy tay); kiểm cấu trúc eval case chung (`test/contract/95-evals.contract.mjs`); trùng cụm trigger nguyên văn (`triggerCollisions`, thuộc `projection`).

## Yêu cầu

- **skill-quality/R1** — `npm test` chấm mọi skill và workflow published (catalog `offeredCatalog()` bỏ `core/principles`, cộng mọi workflow) bằng TF-IDF trên phần `description` trước "Không dùng khi", sau khi bỏ dấu tiếng Việt; tỉ lệ prompt positive có skill đúng ở hạng 1 hoặc tỉ lệ prompt negative có skill đó không ở hạng 1 thấp hơn `threshold` trong `test/routing/rank1.lock.json` thì fail; mỗi id cần ≥ 3 positive và ≥ 2 negative; `node scripts/routing-score.mjs --lock` chỉ nâng ngưỡng, số đo thấp hơn thì exit 1. Nguồn: [2026-11-10-agent-skills-gap-closure](../../requests/2026-11-10-agent-skills-gap-closure/design.md) (thêm)
- **skill-quality/R2** — Có case eval "phải im lặng" cho ba cặp skill dễ gọi nhầm (`engineering-tdd`/`workflow-bugfix`, `backend-code-review`/`engineering-quality-gate`, `git-workflow`/`git-release`); mỗi case có grader `tool_used` `Skill` cho skill đúng (`min: 1`) và cho skill phải im lặng (`max: 0`). Nguồn: [2026-11-10-agent-skills-gap-closure](../../requests/2026-11-10-agent-skills-gap-closure/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-11-10 | [2026-11-10-agent-skills-gap-closure](../../requests/2026-11-10-agent-skills-gap-closure/design.md) | skill-quality/R1 | thêm |
| 2026-11-10 | [2026-11-10-agent-skills-gap-closure](../../requests/2026-11-10-agent-skills-gap-closure/design.md) | skill-quality/R2 | thêm |
