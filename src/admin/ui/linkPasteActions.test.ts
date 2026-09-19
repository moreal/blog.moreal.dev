import assert from "node:assert/strict";
import test from "node:test";
import { LINK_PASTE_ACTIONS, markdownLink } from "./linkPasteActions.ts";

function action(id: string) {
  const found = LINK_PASTE_ACTIONS.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

const url = "https://example.com/post";

test("brackets and backslashes in a link label are escaped so they cannot end it", () => {
  assert.equal(markdownLink("a]b[c\\d", url), `[a\\]b\\[c\\\\d](${url})`);
});

test("a destination with parentheses or angle brackets is wrapped in angle brackets", () => {
  assert.equal(markdownLink("Wiki", "https://en.wikipedia.org/wiki/Go_(game)"), "[Wiki](<https://en.wikipedia.org/wiki/Go_(game)>)");
  assert.equal(markdownLink("", url), `[](${url})`);
});

test("keeping the URL as pasted replaces nothing", () => {
  assert.equal(action("plain").run({ url, replacedText: "" }), null);
});

test("an alias with nothing selected parks the caret inside the empty label", () => {
  assert.deepEqual(action("alias").run({ url, replacedText: "" }), {
    text: `[](${url})`,
    selection: { anchor: 1, head: 1 },
  });
});

test("an alias made from the replaced selection is already written, so the caret moves past the link", () => {
  assert.deepEqual(action("alias").run({ url, replacedText: "the post" }), { text: `[the post](${url})` });
});

test("a fetched page title becomes the alias, and a page without one is an error", async (t) => {
  let title: string | null = "Page [1]";
  t.mock.method(globalThis, "fetch", async (requested: string) => {
    assert.equal(requested, `/admin/api/link-title?url=${encodeURIComponent(url)}`);
    return new Response(JSON.stringify({ ok: true, url, title }));
  });
  assert.deepEqual(await action("fetch-title").run({ url, replacedText: "" }), { text: `[Page \\[1\\]](${url})` });
  title = null;
  await assert.rejects(async () => action("fetch-title").run({ url, replacedText: "" }), {
    message: "문서에서 제목을 찾지 못했습니다.",
  });
});
