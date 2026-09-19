const DRAFT_KEY_PREFIX = "cms-draft:";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface DraftStash {
  read: () => string | null;
  keep: (body: string) => void;
  discard: () => void;
}

export function draftStashFor(file: string, storage: DraftStorage): DraftStash {
  const key = DRAFT_KEY_PREFIX + file;
  return {
    read: () => storage.getItem(key),
    keep: (body) => storage.setItem(key, body),
    discard: () => storage.removeItem(key),
  };
}
