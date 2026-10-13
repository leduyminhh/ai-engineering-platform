# Luồng Gitflow của git-release

## Vai trò branch

| Vai trò | Ví dụ | Ghi chú |
|---|---|---|
| integration | `develop` | Có thể không có. Nguồn tách `release/*`, nhận merge-back |
| promotion chain | `staging, main` | Thứ tự merge; chặng cuối = production, nơi đặt tag. Không có `staging` → `main` |
| release | `release/1.3.0` | Tách từ integration (không có → từ chặng cuối) |
| hotfix | `hotfix/1.2.4` | Tách từ tag gần nhất trên chặng cuối |

Nguồn merge vào MỌI chặng là chính `release/*` (`hotfix/*`), không merge chặng này sang chặng khác: production chỉ
nhận đúng những gì thuộc release, kể cả khi `staging` đang lẫn code khác.

## Release

```text
develop ──●──●──────────────────────────●── (merge-back, + commit nâng dev suffix nếu có)
           \                           /
release/1.3.0 ●(chore(release))──●(fix)
               \                  \    \
staging         ●(lần finish 1)    ●(lại, vì có fix)
                                        \
main                                     ●  tag v1.3.0
```

- `release start` dừng sau khi push `release/1.3.0`.
- Mỗi lần `release finish` làm một chặng. Chặng trước chỉ xong khi chứa HEAD hiện tại của `release/*`; fix hoặc
  merge-back hotfix tạo commit mới → phải đi lại từ `staging`.

## Hotfix

- Lỗi tìm thấy khi test `release/*` (chưa lên production) → KHÔNG dùng hotfix; commit fix thẳng lên `release/*`.
- Lỗi trên production → hotfix từ tag gần nhất trên chặng cuối.
- Merge-back của hotfix: `release/*` đang mở → vào `release/*` (release sẽ mang fix về `develop` khi finish);
  không có release mở → vào integration; không có integration → bỏ merge-back.
- Hotfix không bao giờ tách từ `release/*`: branch đó chứa code chưa lên production.

## Hotfix chen ngang release đang mở

1. `release/1.3.0` đang test trên `staging`; production `v1.2.3` lỗi.
2. `hotfix start` → bảng branch ghi merge-back = `release/1.3.0` → `hotfix/1.2.4` từ `v1.2.3`.
3. `hotfix finish` (lần 1) → bump 1.2.4 + CHANGELOG ⏸ → merge vào `staging` ⏸ push → dừng test.
4. `hotfix finish` (lần 2) → merge `main` + tag `v1.2.4` → merge-back vào `release/1.3.0` (conflict dòng version và
   đầu CHANGELOG xử lý theo `conflict-rules.md`) ⏸ → `push --atomic origin main release/1.3.0 v1.2.4` ⏸.
5. `release finish` thấy `release/1.3.0` có commit mới → đưa lại lên `staging` trước, rồi mới tới `main`.

## Không có integration branch

`release/*` tách từ chặng cuối; `finish` không merge-back; hotfix merge-back vào `release/*` nếu đang mở, không
thì bỏ.
