import assert from "node:assert/strict";
import test from "node:test";
import { decodeHtml, extractTitle, readResponsePrefix } from "./html-title.ts";

test("Open Graph title wins over <title>, which tends to carry a site-name suffix, in any attribute order", () => {
  assert.equal(extractTitle('<title>Document</title><meta content="  Post &amp; &#x41; &#66;  " property="og:title">'), "Post & A B");
  assert.equal(extractTitle("<meta name='og:title' content='Other'><title>Document</title>"), "Other");
  assert.equal(extractTitle('<meta property="og:title" content=" "><title>Document</title>'), "Document");
});

test("titles collapse whitespace, preserve unknown entities and cap at 300 characters", () => {
  assert.equal(extractTitle("<title> one\n two &unknown; &#99999999; &NBSP; &copy; </title>"), "one two &unknown; &#99999999; ©");
  assert.equal(extractTitle(`<title>${"a".repeat(301)}</title>`), "a".repeat(300));
  assert.equal(extractTitle("<title> </title>"), null);
  assert.equal(extractTitle("<body>No title</body>"), null);
  assert.equal(extractTitle("<title>&nbsp;</title>"), "");
});

test("charset comes from HTTP before meta, with UTF-8 fallback for unsupported labels", () => {
  const prefix = new TextEncoder().encode('<meta charset="utf-8"><title>');
  const bytes = new Uint8Array([...prefix, 0xe9]);
  assert.ok(decodeHtml(bytes, "text/html; charset=windows-1252").endsWith("é"));
  assert.ok(decodeHtml(bytes, "text/html").endsWith("�"));
  assert.ok(decodeHtml(bytes, "text/html; charset=not-real").endsWith("�"));
});

test("older Korean pages served as EUC-KR decode with their declared charset", () => {
  assert.equal(decodeHtml(new Uint8Array([0xb0, 0xa1]), "text/html; charset=euc-kr"), "가");
});

test("a meta charset is found in bytes that are not UTF-8, since charset labels are ASCII", () => {
  const meta = new Uint8Array([...new TextEncoder().encode('<meta charset="windows-1252">'), 0xe9]);
  assert.ok(decodeHtml(meta, "text/html").endsWith("é"));
});

test("stream reading truncates an oversized chunk and cancels the rest", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3, 4, 5])); },
    cancel() { cancelled = true; },
  });
  assert.deepEqual(await readResponsePrefix(body, 3), new Uint8Array([1, 2, 3]));
  assert.equal(cancelled, true);
  assert.deepEqual(await readResponsePrefix(null, 3), new Uint8Array());
  const short = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } });
  assert.deepEqual(await readResponsePrefix(short, 3), new Uint8Array([1]));
});
