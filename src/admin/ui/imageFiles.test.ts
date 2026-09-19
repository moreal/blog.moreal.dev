import assert from "node:assert/strict";
import test from "node:test";
import { captureImageFiles } from "./imageFiles.ts";

test("captures image files before the transfer expires and ignores other items", () => {
  const image = new File(["image"], "image.png", { type: "image/png" });
  let active = true;
  const transfer = {
    items: [
      { kind: "string", type: "text/plain", getAsFile: () => { throw new Error("not a file"); } },
      { kind: "file", type: "text/plain", getAsFile: () => { throw new Error("not an image"); } },
      { kind: "file", type: "image/png", getAsFile: () => active ? image : null },
      { kind: "file", type: "image/jpeg", getAsFile: () => null },
    ],
  } as unknown as DataTransfer;
  const captured = captureImageFiles(transfer);
  active = false;
  assert.deepEqual(captured, [image]);
  assert.deepEqual(captureImageFiles(transfer), []);
});
