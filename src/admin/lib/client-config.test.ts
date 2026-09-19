import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_CONFIG } from "../config.ts";
import { LANGS } from "../shared/post-files.ts";
import { clientConfig } from "./client-config.ts";

test("the browser gets the editor settings and the supported languages", () => {
  assert.deepEqual(clientConfig(ADMIN_CONFIG), {
    imageNamePattern: ADMIN_CONFIG.imageNamePattern,
    imageTypes: ADMIN_CONFIG.imageTypes,
    maxImageBytes: ADMIN_CONFIG.maxImageBytes,
    formatOnSave: ADMIN_CONFIG.formatOnSave,
    editorEngine: ADMIN_CONFIG.editorEngine,
    langs: LANGS,
  });
});

test("the image name rule reaches the browser as its pattern only, since a suggestImageName function cannot be serialised and the UI only describes the rule", () => {
  const sent = clientConfig({ ...ADMIN_CONFIG, suggestImageName: () => "custom" });
  assert.equal(sent.imageNamePattern, ADMIN_CONFIG.imageNamePattern);
  assert.equal("suggestImageName" in sent, false);
});

test("the link title rules file path stays on the server", () => {
  assert.equal("linkTitleRulesFile" in clientConfig(ADMIN_CONFIG), false);
});
