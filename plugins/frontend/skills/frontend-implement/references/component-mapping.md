# Component mapping — thiết kế → component library / Tailwind

Nguyên tắc: **tái dùng component library của project TRƯỚC**, chỉ dựng thủ công bằng Tailwind khi lib
không có. Dò lib thật từ `package.json` + `design-system.md`; bảng dưới là gợi ý map theo lib phổ biến.

## Thứ tự ưu tiên

1. Có trong **component-lib** của project → dùng đúng component + variant của lib (đừng dựng lại).
2. Có **wrapper/primitive dùng chung** của project (vd `components/` gốc `src/` ở Feature-Based, `shared/ui`
   ở FSD, `packages/ui-kit` ở Micro-FE) → dùng nó.
3. Không có → **dựng bằng Tailwind** theo token design-system, đặt ở đúng tầng/slice; nếu có khả năng
   tái dùng → đặt ở lớp UI dùng chung (Feature-Based: `components/` phẳng gốc `src/`; FSD: `shared/ui`;
   Micro-FE: `packages/ui-kit`).

## Bảng map phần tử → component (theo lib)

| Phần tử thiết kế | shadcn/ui | MUI | Ant Design | Nếu không có lib (Tailwind) |
|------------------|-----------|-----|------------|------------------------------|
| Nút | `Button` (variant/size) | `Button` | `Button` | `<button>` + class trạng thái |
| Ô nhập | `Input` | `TextField` | `Input` | `<input>` + focus ring |
| Chọn | `Select` | `Select` | `Select` | `<select>` hoặc listbox a11y |
| Checkbox/Radio/Switch | `Checkbox`/`RadioGroup`/`Switch` | tương ứng | tương ứng | input + label liên kết |
| Thẻ | `Card` | `Card` | `Card` | `<div>` bo góc + shadow token |
| Hộp thoại | `Dialog` | `Dialog` | `Modal` | portal + overlay + focus trap |
| Tab | `Tabs` | `Tabs` | `Tabs` | role="tablist" + panel |
| Bảng | `Table` | `Table`/DataGrid | `Table` | `<table>` semantic |
| Badge/Tag | `Badge` | `Chip` | `Tag` | span + màu token |
| Tooltip | `Tooltip` | `Tooltip` | `Tooltip` | title/aria + popover |
| Menu/Dropdown | `DropdownMenu` | `Menu` | `Dropdown` | menu a11y |
| Toast/Alert | `Sonner`/`Alert` | `Snackbar`/`Alert` | `message`/`Alert` | vùng aria-live |

> Bảng là **gợi ý**, không phải luật — API/tên chính xác đọc từ version lib trong project. Nếu design-system
> của project đã bọc lib bằng wrapper riêng, dùng wrapper đó.

## Map props / variant

- Ánh xạ **biến thể thị giác** của thiết kế → **variant/size của lib** (primary/secondary/outline/ghost;
  sm/md/lg) thay vì override style rời rạc.
- Chỉ thêm `className` Tailwind cho phần lib không phủ (spacing ngoài, layout) — không override sâu nội bộ lib.
- Giữ **API component tối giản, typed**: chỉ nhận props thật sự cần (dữ liệu + callback + biến thể); xem
  [interaction-tiers.md](interaction-tiers.md).

## Khi tự dựng bằng Tailwind

- Bám token qua [tailwind-token-map.md](tailwind-token-map.md); không đặt màu/spacing lẻ.
- Giữ a11y: role/aria đúng, label liên kết input, focus nhìn thấy, bấm được bằng bàn phím.
- Nếu phần tử lặp lại nhiều nơi → tách thành component tái dùng ở lớp UI dùng chung, đừng lặp markup.
