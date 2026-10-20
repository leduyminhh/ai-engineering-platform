# Checklist — Definition of Done cho một slice

Chạy checklist này trước khi báo "xong". Ưu tiên kiểm định **tất định** (build/test/lint ranh giới) + nêu
thành thật phần bỏ qua/giả định. Ngôn ngữ đo được — mỗi mục hoặc XANH có bằng chứng, hoặc ghi rõ vì sao bỏ qua.

## Kiểm định tất định (phải xanh, kèm lệnh + kết quả THẬT)

- [ ] **Build xanh** bằng lệnh thật của stack (Maven `mvn -q -DskipTests=false test` / `mvn verify`; Gradle
      `./gradlew build`; Python `pytest` + build nếu có). Dán lệnh + số pass/fail.
- [ ] **Test use-case xanh:**
  - **Unit lõi** cho use-case chạy được **KHÔNG cần DB/framework** — mock/fake **driven port** (Java: Mockito
    mock; Python: fake/`Protocol` stub). Kiểm invariant + luồng command/query.
  - **Adapter chạm hạ tầng** (persistence/gateway) có **integration test** riêng (Testcontainers/H2 cho JPA;
    fixture DB cho SQLAlchemy) — chỉ khi slice thực sự thêm adapter mới chạm hạ tầng.
- [ ] **Ranh giới xanh:** chạy công cụ kiểm chiều phụ thuộc của stack —
  - **Java:** **ArchUnit** test — `domain`/`application` KHÔNG phụ thuộc framework/ORM; inbound KHÔNG phụ
    thuộc outbound (`..web..` ↮ `..persistence..`); repository/port ở đúng tầng theo kiểu; không cycle.
  - **Python:** **import-linter** (`lint-imports`) — `domain`/`application` KHÔNG `import fastapi`/`sqlalchemy`;
    contract `forbidden` inbound → outbound.
  - Kiểu **layered** không có công cụ ép → nêu rõ đã kiểm bằng mắt/review (fail-loud).

## Đúng phạm vi slice (không phình)

- [ ] **Đúng MỘT aggregate + MỘT use-case** (command hoặc query) + **một** driven port + **một** adapter.
      Không sinh thêm feature/port/adapter chưa dùng.
- [ ] **Một transaction = một aggregate**; transaction bao quanh use-case, không rải ở adapter; liên aggregate
      dùng domain event (không nới transaction).
- [ ] Nhánh **Query (CQRS)** trả read model (`*View`) trực tiếp, KHÔNG qua aggregate/command/mapper command.

## Đúng kiến trúc + convention

- [ ] File đặt **đúng tầng/module** theo blueprint `<stack>-<kiểu>.template.md` (không tự chế cây/naming).
- [ ] **Map thủ công ở biên:** DTO↔command (inbound), aggregate↔row (persistence) qua mapper RIÊNG cạnh
      adapter (Java: MapStruct; Python: module hàm); ACL map tay. KHÔNG map inline, KHÔNG trộn một class cho
      DTO/aggregate/row.
- [ ] Entity/row RIÊNG khỏi aggregate; aggregate KHÔNG mang annotation ORM.
- [ ] **Đặt tên** theo `code-convention.md` + danh xưng của template (`*Repository`/`*Port`/`*Gateway`/
      `*Adapter`/`*Command`/`*View`…); dùng Ubiquitous Language, không thuật ngữ kỹ thuật.

## Ranh giới an toàn (không vượt phạm vi)

- [ ] KHÔNG chạy DB migration thật; KHÔNG externalize config/secret; không đụng secret.
- [ ] `domain`/`application` không import framework/ORM/web; inbound không gọi thẳng outbound.
- [ ] Chỉ chạm plugin `backend`; không đụng CLI/adapter/engine.

## Thành thật (bắt buộc báo — fail-loud)

- [ ] Nêu rõ **giả định** đã dùng (aggregate/invariant/loại use-case khi input thiếu; stack/lib suy đoán).
- [ ] Nêu rõ phần **bỏ qua verify** và lý do (vd CI không đủ hạ tầng boot → chạy phần chạy được + báo scope
      skip; không im lặng coi như đã phủ).
- [ ] KHÔNG tuyên bố hoàn tất khi build/test/ranh giới chưa xanh.
- [ ] **Con người duyệt diff** trước merge/push (protected branch: mỗi commit) — ranh giới an toàn của khung.
