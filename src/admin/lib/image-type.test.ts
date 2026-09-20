import assert from "node:assert/strict";
import test from "node:test";
import { extensionFromMimeType } from "./image-type.ts";

test("an accepted MIME type gives the extension the configured table maps it to", () => {
  assert.deepEqual(extensionFromMimeType("image/jpeg"), { ok: true, ext: ".jpg" });
  assert.deepEqual(extensionFromMimeType("image/svg+xml"), { ok: true, ext: ".svg" });
  assert.deepEqual(extensionFromMimeType("image/png", { "image/png": ".PNG" }), { ok: true, ext: ".PNG" });
});

test("a MIME type outside the table is refused with a message naming it", () => {
  assert.deepEqual(extensionFromMimeType("image/heic"), {
    ok: false,
    message: "image/heic은 받지 않습니다.",
  });
  assert.deepEqual(extensionFromMimeType("image/png", {}), {
    ok: false,
    message: "image/png은 받지 않습니다.",
  });
});

test("a missing MIME type is refused as an unknown type", () => {
  assert.deepEqual(extensionFromMimeType(""), { ok: false, message: "알 수 없는 형식은 받지 않습니다." });
});

test("a MIME type naming a built-in property of the table is refused, not answered with what it inherits", () => {
  for (const mimeType of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    assert.deepEqual(
      extensionFromMimeType(mimeType),
      { ok: false, message: `${mimeType}은 받지 않습니다.` },
      mimeType,
    );
  }
});
