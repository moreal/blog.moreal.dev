import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_CONFIG } from "../config.ts";
import { clientConfig } from "./client-config.ts";

test("the browser gets the editor engine and nothing else, since that is all the editor reads", () => {
  assert.deepEqual(clientConfig(ADMIN_CONFIG), {
    editorEngine: ADMIN_CONFIG.editorEngine,
  });
});

test("image naming, the link title rules file and the rest of the server settings stay on the server", () => {
  const sent = clientConfig({ ...ADMIN_CONFIG, suggestImageName: () => "custom" });
  assert.deepEqual(Object.keys(sent), ["editorEngine"]);
});
