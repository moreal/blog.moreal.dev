import assert from "node:assert/strict";
import test from "node:test";
import { fetchFailureMessage, isHtmlContentType, parsePageUrl } from "./link-page.ts";

test("a pasted page URL is trimmed and parsed", () => {
  const page = parsePageUrl("  https://example.com/a  ");
  assert.ok(page.ok);
  assert.equal(page.url.href, "https://example.com/a");
});

test("a page URL that does not parse, or is not http(s), is refused", () => {
  assert.deepEqual(parsePageUrl(""), { ok: false, message: "URL이 올바르지 않습니다" });
  assert.deepEqual(parsePageUrl("example.com"), { ok: false, message: "URL이 올바르지 않습니다" });
  assert.deepEqual(parsePageUrl("ftp://example.com/x"), { ok: false, message: "http(s) URL만 지원합니다" });
});

test("only an HTML or XHTML response is read for a title", () => {
  for (const type of ["text/html; charset=utf-8", "application/xhtml+xml", "TEXT/HTML"]) {
    assert.equal(isHtmlContentType(type), true, type);
  }
  for (const type of ["", "text/css", "application/json", "image/png"]) {
    assert.equal(isHtmlContentType(type), false, type);
  }
});

test("a fetch that times out says how long it waited", () => {
  assert.equal(fetchFailureMessage(new DOMException("aborted", "TimeoutError")), "응답이 8초 안에 오지 않았습니다");
});

test("a failed fetch names its underlying cause when there is one", () => {
  const refused = new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:1") });
  assert.equal(fetchFailureMessage(refused), "fetch failed: connect ECONNREFUSED 127.0.0.1:1");
  assert.equal(fetchFailureMessage(new Error("boom")), "boom");
  assert.equal(fetchFailureMessage("odd"), "odd");
});
