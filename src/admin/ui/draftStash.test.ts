import assert from "node:assert/strict";
import test from "node:test";
import { draftStashFor } from "./draftStash.ts";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

test("an unsaved body is kept per source file under the CMS draft prefix", () => {
  const storage = memoryStorage();
  const career = draftStashFor("2026/02/career.ko-Hang.md", storage);
  assert.equal(career.read(), null);
  career.keep("edited");
  assert.equal(career.read(), "edited");
  assert.deepEqual([...storage.items], [["cms-draft:2026/02/career.ko-Hang.md", "edited"]]);
  assert.equal(draftStashFor("2026/02/career.en.md", storage).read(), null);
});

test("a discarded draft is gone", () => {
  const storage = memoryStorage();
  const stash = draftStashFor("a.md", storage);
  stash.keep("edited");
  stash.discard();
  assert.equal(stash.read(), null);
});
