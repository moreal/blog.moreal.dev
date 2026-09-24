import assert from "node:assert/strict";
import test from "node:test";
import { PROJECT_SECTIONS } from "./projects.ts";

test("sections open with the current focus and close with the rest, each non-empty", () => {
  assert.deepEqual(
    PROJECT_SECTIONS.map((section) => section.id),
    ["focus", "activitypub", "interpreter", "translation", "misc"],
  );
  for (const section of PROJECT_SECTIONS) {
    assert.ok(section.title.length > 0);
    assert.ok(section.projects.length > 0);
  }
});

test("projects are named once within a section and link to an https page", () => {
  for (const section of PROJECT_SECTIONS) {
    const names = section.projects.map((project) => project.name);
    assert.equal(new Set(names).size, names.length);
    for (const project of section.projects) {
      assert.ok(project.name.length > 0);
      assert.ok(project.description.length > 0);
      assert.equal(new URL(project.href).protocol, "https:");
    }
  }
});