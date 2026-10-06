# backend-migrate-architecture (recipe on-demand)

Skill migrate KIỂU kiến trúc mã nguồn của một backend project đã tồn tại sang kiểu đích
(Onion / Hexagonal / CQRS / layered), giữ nguyên hành vi. Recipe on-demand, gọi
khi cần — không thuộc chuỗi bắt buộc init→…→implement.

- Nguồn kiểu kiến trúc đích: `plugins/backend/templates/architecture/` (ship kèm qua
  `sharedAssets`), dùng chung với `backend-init` bước 0c.
- `references/` chứa công cụ kiểm chứng ranh giới: ArchUnit (Java/Spring), import-linter
  (Python) và heuristic nhận diện + ánh xạ file→tầng.
- Đảm bảo production-ready qua 6 gate G1–G6 (xem SKILL.md): baseline xanh, characterization
  test, xanh-mỗi-bước, kiểm chiều phụ thuộc, hồi quy toàn bộ, 1 task = 1 commit.
