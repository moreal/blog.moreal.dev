import assert from "node:assert/strict";
import test from "node:test";
import { checkRequest, errorMessageForClient, fail, json } from "./guard.ts";
import { PathError } from "./paths.ts";

const adminUrl = new URL("http://localhost:4321/admin/api/save");
const jsonBody = { contentType: "application/json" } as const;

function requestWith(headers: Record<string, string>): Request {
  return new Request(adminUrl, { method: "POST", headers });
}

test("a JSON response is never cached and defaults to 200", async () => {
  const response = json({ ok: true, value: 1 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, value: 1 });
});

test("a failure carries its error code and message with the status that code maps to", async () => {
  const response = fail("stale", "changed on disk");
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: "stale", message: "changed on disk" });
  assert.equal(fail("bad-request", "").status, 400);
  assert.equal(fail("forbidden", "").status, 403);
  assert.equal(fail("not-found", "").status, 404);
  assert.equal(fail("exists", "").status, 409);
  assert.equal(fail("too-large", "").status, 413);
  assert.equal(fail("unsupported-type", "").status, 415);
  assert.equal(fail("invalid", "").status, 422);
  assert.equal(fail("io", "").status, 500);
  assert.equal(fail("bad-name", "").status, 400);
});

test("an error shown to the client never contains the absolute repository path", () => {
  const cwd = process.cwd();
  assert.equal(
    errorMessageForClient(new Error(`ENOENT: no such file, open '${cwd}/2026/02/post.ko-Hang.md'`)),
    "ENOENT: no such file, open '2026/02/post.ko-Hang.md'",
  );
  assert.equal(errorMessageForClient(new Error(`cannot read ${cwd}`)), "cannot read ");
});

test("a path error is already written for the client and passes through as is", () => {
  assert.equal(errorMessageForClient(new PathError("path is not repo-relative")), "path is not repo-relative");
});

test("a thrown non-error value is shown as its string form", () => {
  assert.equal(errorMessageForClient("plain failure"), "plain failure");
  assert.equal(errorMessageForClient(42), "42");
});

test("a request from the admin page itself passes, with or without an Origin header", () => {
  assert.equal(checkRequest(requestWith({ origin: adminUrl.origin }), adminUrl), null);
  assert.equal(checkRequest(requestWith({}), adminUrl), null);
});

test("a request from another origin is rejected, as defence in depth over Astro's own dev-server check", async () => {
  const rejected = checkRequest(requestWith({ origin: "https://elsewhere.example" }), adminUrl);
  assert.equal(rejected?.status, 403);
  assert.deepEqual(await rejected?.json(), {
    ok: false,
    error: "forbidden",
    message: "cross-origin request rejected",
  });
});

test("a JSON endpoint rejects any other content type, so a cross-origin caller cannot skip the CORS preflight", async () => {
  const rejected = checkRequest(requestWith({ "content-type": "text/plain" }), adminUrl, jsonBody);
  assert.equal(rejected?.status, 400);
  assert.deepEqual(await rejected?.json(), {
    ok: false,
    error: "bad-request",
    message: "expected application/json",
  });
  assert.equal(checkRequest(requestWith({}), adminUrl, jsonBody)?.status, 400);
  assert.equal(
    checkRequest(requestWith({ "content-type": "application/json; charset=utf-8" }), adminUrl, jsonBody),
    null,
  );
});

test("an upload endpoint accepts only a multipart form, whatever its boundary", async () => {
  const multipartBody = { contentType: "multipart/form-data" } as const;
  const rejected = checkRequest(requestWith({ "content-type": "application/json" }), adminUrl, multipartBody);
  assert.equal(rejected?.status, 400);
  assert.equal((await rejected?.json()).message, "expected multipart/form-data");
  assert.equal(
    checkRequest(requestWith({ "content-type": "multipart/form-data; boundary=x" }), adminUrl, multipartBody),
    null,
  );
});

test("the origin is checked before the content type", async () => {
  const rejected = checkRequest(
    requestWith({ origin: "https://elsewhere.example", "content-type": "text/plain" }),
    adminUrl,
    jsonBody,
  );
  assert.equal((await rejected?.json()).error, "forbidden");
});
