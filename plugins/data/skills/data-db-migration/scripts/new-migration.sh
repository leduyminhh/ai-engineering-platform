#!/usr/bin/env bash
# Sinh file migration mới. Chạy từ thư mục gốc module <app>-db-migration:
#   scripts/new-migration.sh <flyway|liquibase> <domain> "<mo ta khong dau>"
set -euo pipefail

usage() {
  echo "Cách dùng: $0 <flyway|liquibase> <domain> \"<mo ta khong dau>\"" >&2
  exit 2
}

[ "$#" -eq 3 ] || usage
tool=$1
domain=$2
desc=$3

case "$tool" in
  flyway | liquibase) ;;
  *) usage ;;
esac
if ! [[ "$domain" =~ ^[a-z0-9-]+$ ]]; then
  echo "domain chỉ gồm a-z, 0-9, '-': $domain" >&2
  exit 2
fi
# Tên file phải ASCII để mọi OS/công cụ đọc giống nhau; không tự bỏ dấu vì iconv mỗi máy cho kết quả khác.
if ! [[ "$desc" =~ ^[A-Za-z0-9\ _-]+$ ]]; then
  echo "Mô tả chỉ dùng chữ không dấu, số, khoảng trắng, '_' hoặc '-': $desc" >&2
  exit 2
fi

slug=$(printf '%s' "$desc" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//')
[ -n "$slug" ] || { echo "Mô tả phải có ít nhất một chữ hoặc số: $desc" >&2; exit 2; }
slug_dash=${slug//_/-}
flyway_root=src/main/resources/db/migration
liquibase_root=src/main/resources/db/changelog

version_taken() {
  if [ "$tool" = flyway ]; then
    [ -d "$flyway_root" ] && [ -n "$(find "$flyway_root" -name "V${1}__*")" ]
  else
    [ -d "$liquibase_root" ] && [ -n "$(find "$liquibase_root" -name "${1}-*")" ]
  fi
}

# UTC để version không phụ thuộc múi giờ máy sinh; giờ địa phương có thể cho file sau version nhỏ hơn file trước.
version=$(date -u +%Y%m%d%H%M%S)
tries=0
# Hai người sinh cùng giây sẽ trùng version; tăng dần thay vì ghi đè (B5 của G2).
while version_taken "$version"; do
  version=$((version + 1))
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "Không tìm được version trống sau 60 lần thử" >&2
    exit 1
  fi
done

if [ "$tool" = flyway ]; then
  dir="$flyway_root/versioned/$domain"
  file="$dir/V${version}__${slug}.sql"
  mkdir -p "$dir"
  printf -- "-- %s\n-- Pha: expand | migrate-data | contract (giữ đúng một pha)\nSET LOCAL lock_timeout = '5s';\n\n" "$desc" > "$file"
  echo "Đã tạo: $file"
  exit 0
fi

author=${MIGRATION_AUTHOR:-$(git config user.email 2>/dev/null || true)}
if [ -z "$author" ]; then
  echo "Thiếu tác giả: đặt MIGRATION_AUTHOR hoặc git config user.email" >&2
  exit 1
fi
dir="$liquibase_root/versioned/$domain"
name="${version}-${slug_dash}"
mkdir -p "$dir/sql"
cat > "$dir/$name.yaml" <<EOF
databaseChangeLog:
  - changeSet:
      id: ${name}
      author: ${author}
      changes:
        - sqlFile:
            path: sql/${name}.sql
            relativeToChangelogFile: true
      rollback:
        - sqlFile:
            path: sql/${name}.rollback.sql
            relativeToChangelogFile: true
EOF
printf -- "-- %s\nSET LOCAL lock_timeout = '5s';\n\n" "$desc" > "$dir/sql/$name.sql"
printf -- "-- Hoàn tác: %s\nSET LOCAL lock_timeout = '5s';\n\n" "$desc" > "$dir/sql/$name.rollback.sql"
echo "Đã tạo: $dir/$name.yaml"
echo "Đã tạo: $dir/sql/$name.sql"
echo "Đã tạo: $dir/sql/$name.rollback.sql"
echo "Thêm vào db.changelog-master.yaml (trước các include repeatable):"
echo "  - include:"
echo "      file: versioned/$domain/$name.yaml"
echo "      relativeToChangelogFile: true"
