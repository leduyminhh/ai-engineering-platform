#!/usr/bin/env bash
# Dựng project Flyway tối thiểu có migration V1; không cần mạng, chỉ dùng heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src/main/resources/db/migration
cat > src/main/resources/db/migration/V1__create_users.sql <<'SQL'
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
SQL
cat > src/main/resources/application.yml <<'YML'
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/app
  flyway:
    enabled: true
YML
