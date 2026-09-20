import assert from "node:assert/strict";
import test from "node:test";
import { parseFrontMatter } from "../../lib/posts.ts";
import { parsesToSameFrontMatter, readForm, serializeFrontMatter } from "./frontmatter.ts";

const published = "2026-09-20T10:00:00+09:00";

function metaOf(frontMatter: string) {
  return parseFrontMatter(frontMatter, "(test)").meta;
}

test("the form keeps the published timestamp as written, without its quotes", () => {
  assert.equal(readForm(`---\npublished: ${published}\n---\n`, "(test)").published, published);
  assert.equal(readForm(`---\npublished: "${published}"\n---\n`, "(test)").published, published);
  assert.equal(readForm(`---\npublished: '${published}'  \n---\n`, "(test)").published, published);
});

test("the form reads every field the site reads, legacy string flags included", () => {
  const source = [
    "---",
    `published: ${published}`,
    'description: "A: quoted"',
    'draft: "true"',
    "dark: true",
    "type: reading",
    "book:",
    "  title: Book",
    "  year: 2001",
    "---",
    "",
    "Body",
  ].join("\n");
  assert.deepEqual(readForm(source, "(test)"), {
    published,
    description: "A: quoted",
    draft: true,
    dark: true,
    type: "reading",
    book: { title: "Book", author: undefined, translator: undefined, publisher: undefined, year: 2001 },
  });
});

test("the form leaves out fields the file does not set", () => {
  assert.deepEqual(readForm(`---\npublished: ${published}\ndraft: false\n---\n`, "(test)"), { published });
});

test("serialized keys follow the order existing posts and scaffold scripts use", () => {
  const serialized = serializeFrontMatter({
    book: { year: 2001, publisher: "Publisher", translator: "Translator", author: "Author", title: "Book" },
    type: "reading",
    dark: true,
    draft: true,
    description: "Description",
    published,
  });
  assert.equal(
    serialized,
    [
      "---",
      `published: ${published}`,
      "description: Description",
      "draft: true",
      "dark: true",
      "type: reading",
      "book:",
      "  title: Book",
      "  author: Author",
      "  translator: Translator",
      "  publisher: Publisher",
      "  year: 2001",
      "---",
      "",
    ].join("\n"),
  );
});

test("serializing omits false flags and empty values because no post writes them", () => {
  assert.equal(
    serializeFrontMatter({ published, description: "", draft: false, dark: false }),
    `---\npublished: ${published}\n---\n`,
  );
  assert.equal(
    serializeFrontMatter({ published, type: "reading", book: { title: "", author: "Author" } }),
    `---\npublished: ${published}\ntype: reading\nbook:\n  author: Author\n---\n`,
  );
  assert.equal(
    serializeFrontMatter({ published, type: "reading", book: { title: "" } }),
    `---\npublished: ${published}\ntype: reading\n---\n`,
  );
});

test("books are written only for reading posts", () => {
  assert.equal(
    serializeFrontMatter({ published, type: "daily", book: { title: "Book" } }),
    `---\npublished: ${published}\ntype: daily\n---\n`,
  );
});

test("text is written bare only when YAML reads it back unchanged", () => {
  const bare = ["Plain text", "한국어 설명", "a#b", "1.2.3a"];
  const quoted = [
    " leading space",
    "trailing space ",
    "line\nbreak",
    "- dash",
    "#hash",
    "'single'",
    '"double"',
    "key: value",
    "text #comment",
    "true",
    "No",
    "~",
    "42",
    "-1.5",
  ];
  for (const description of bare) {
    assert.equal(serializeFrontMatter({ published, description }).split("\n")[2], `description: ${description}`);
  }
  for (const description of quoted) {
    assert.equal(
      serializeFrontMatter({ published, description }).split("\n")[2],
      `description: ${JSON.stringify(description)}`,
    );
  }
  for (const description of [...bare, ...quoted]) {
    assert.equal(metaOf(serializeFrontMatter({ published, description })).description, description);
  }
});

test("text the YAML parser reads back as something else is quoted, however it ends or is tagged", () => {
  const quoted = [
    "Ends in a colon:",
    "콜론으로 끝나는 설명:",
    "a colon and a tab:\tb",
    "a hash after a tab\t#b",
    "0x1A",
    "0o17",
    "1e10",
    ".inf",
    ".nan",
  ];
  for (const description of quoted) {
    assert.equal(
      serializeFrontMatter({ published, description }).split("\n")[2],
      `description: ${JSON.stringify(description)}`,
    );
    assert.equal(metaOf(serializeFrontMatter({ published, description })).description, description);
  }
  const book = { title: "Ends in a colon:" };
  assert.equal(metaOf(serializeFrontMatter({ published, type: "reading", book })).book?.title, book.title);
});

test("a new reading post gets the empty title and author lines of new-reading.sh, which mean no book", () => {
  const serialized = serializeFrontMatter({ published, type: "reading", book: { title: "Ignored" }, bookScaffold: true });
  assert.equal(serialized, `---\npublished: ${published}\ntype: reading\nbook:\n  title:\n  author:\n---\n`);
  assert.equal(metaOf(serialized).book, undefined);
});

test("front matter that differs only in spelling compares equal", () => {
  const spelled = [
    "---",
    `published: "${published}"`,
    "description: 'Description'",
    'draft: "true"',
    "type: reading",
    "book:",
    '  title: "Book"',
    "---",
  ].join("\n");
  const canonical = serializeFrontMatter({ published, description: "Description", draft: true, type: "reading", book: { title: "Book" } });
  assert.equal(parsesToSameFrontMatter(canonical, spelled), true);
  assert.equal(parsesToSameFrontMatter(`---\npublished: 2026-09-20T01:00:00Z\n---\n`, `---\npublished: ${published}\n---\n`), true);
});

test("front matter that differs in meaning compares unequal", () => {
  const base = { published, description: "Description", type: "reading", book: { title: "Book", year: 2001 } } as const;
  const serialized = serializeFrontMatter(base);
  for (const changed of [
    { ...base, published: "2026-09-20T10:00:01+09:00" },
    { ...base, description: "Other" },
    { ...base, draft: true },
    { ...base, dark: true },
    { ...base, type: "daily" as const },
    { ...base, book: { ...base.book, year: 2002 } },
    { ...base, book: { ...base.book, author: "Author" } },
  ]) {
    assert.equal(parsesToSameFrontMatter(serializeFrontMatter(changed), serialized), false);
  }
});

test("front matter that cannot be parsed never compares equal", () => {
  assert.equal(parsesToSameFrontMatter("no fence", "no fence"), false);
  assert.equal(parsesToSameFrontMatter(`---\ntitle: no published\n---\n`, `---\ntitle: no published\n---\n`), false);
  assert.equal(parsesToSameFrontMatter(`---\npublished: ${published}\ntype: essay\n---\n`, `---\npublished: ${published}\n---\n`), false);
});
