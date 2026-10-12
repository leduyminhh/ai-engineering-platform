import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeManagedBlock, removeManagedBlock, hasOnlyWhitespace, importsAgentsMd } from "../cli/lib/managed-block.mjs";

const BEGIN = "<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->";
const END = "<!-- AI-ENGINEERING:END AGENTS_BASELINE -->";
const baseline = `${BEGIN}\nNEW\n${END}`;

test("merge chèn baseline vào file chưa có khối, giữ nội dung cũ", () => {
  const out = mergeManagedBlock("User content.", baseline, "AGENTS.md");
  assert.match(out, /User content\./);
  assert.match(out, /NEW/);
});

test("merge thay đúng vùng giữa marker, bảo toàn ngoài khối", () => {
  const existing = `TOP\n${BEGIN}\nOLD\n${END}\nBOTTOM`;
  const out = mergeManagedBlock(existing, baseline, "AGENTS.md");
  assert.match(out, /TOP/);
  assert.match(out, /BOTTOM/);
  assert.match(out, /NEW/);
  assert.doesNotMatch(out, /OLD/);
});

test("merge ném lỗi khi marker hỏng", () => {
  assert.throws(() => mergeManagedBlock(`${END}\n${BEGIN}`, baseline, "AGENTS.md"), /invalid/);
});

test("remove gỡ khối, giữ nội dung ngoài", () => {
  const existing = `TOP\n${BEGIN}\nOLD\n${END}\nBOTTOM`;
  const out = removeManagedBlock(existing);
  assert.match(out, /TOP/);
  assert.match(out, /BOTTOM/);
  assert.doesNotMatch(out, /OLD/);
});

test("remove trả rỗng khi file chỉ còn khối managed", () => {
  const existing = `${BEGIN}\nOLD\n${END}\n`;
  assert.equal(removeManagedBlock(existing).trim(), "");
});

test("hasOnlyWhitespace phân biệt chuỗi rỗng và có nội dung", () => {
  assert.equal(hasOnlyWhitespace("  \n\t "), true);
  assert.equal(hasOnlyWhitespace("x"), false);
});

test("importsAgentsMd chỉ nhận dòng import thật, bỏ code span/fenced block", () => {
  const cases = [
    ["@AGENTS.md\n", true],
    ["# CLAUDE.md\n\n@./AGENTS.md\n", true],
    ["Xem @AGENTS.md trước khi code.", true],
    ["xem [AGENTS.md](AGENTS.md)", false],
    ["dùng `@AGENTS.md` để import", false],
    ["```\n@AGENTS.md\n```\n", false],
    ["@AGENTS.md.bak", false],
    ["email@AGENTS.md", false],
  ];
  for (const [text, expected] of cases) assert.equal(importsAgentsMd(text), expected, JSON.stringify(text));
});
