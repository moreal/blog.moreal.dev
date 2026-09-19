import assert from "node:assert/strict";
import test from "node:test";
import { withBookField, withFormField } from "./frontMatterEdits.ts";

const published = "2026-08-07T23:05:11+09:00";

test("a filled-in field is set on a copy of the form", () => {
  const form = { published };
  assert.deepEqual(withFormField(form, "description", "About"), { published, description: "About" });
  assert.deepEqual(withFormField(form, "draft", true), { published, draft: true });
  assert.deepEqual(form, { published });
});

test("an emptied, unchecked or unset field is left out of the form entirely", () => {
  const form = { published, description: "About", draft: true, type: "daily" as const };
  assert.deepEqual(withFormField(form, "description", ""), { published, draft: true, type: "daily" });
  assert.deepEqual(withFormField(form, "draft", false), { published, description: "About", type: "daily" });
  assert.deepEqual(withFormField(form, "type", undefined), { published, description: "About", draft: true });
});

test("book text fields are set as typed and dropped when emptied", () => {
  const form = withBookField({ published }, "title", "소년이 온다");
  assert.deepEqual(form, { published, book: { title: "소년이 온다" } });
  assert.deepEqual(withBookField(withBookField(form, "author", "한강"), "title", ""), {
    published,
    book: { author: "한강" },
  });
});

test("the book year is kept only when the input reads as an integer", () => {
  assert.deepEqual(withBookField({ published }, "year", "2014"), { published, book: { year: 2014 } });
  assert.deepEqual(withBookField({ published }, "year", "2014.9"), { published, book: { year: 2014 } });
  const withYear = { published, book: { title: "t", year: 2014 } };
  assert.deepEqual(withBookField(withYear, "year", ""), { published, book: { title: "t" } });
});

test("a book left with no fields is removed, since it would parse to no book anyway", () => {
  assert.deepEqual(withBookField({ published, book: { title: "t" } }, "title", ""), { published });
  assert.deepEqual(withBookField({ published }, "year", "abc"), { published });
});
