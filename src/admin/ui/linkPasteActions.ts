import { api } from "./api.ts";

/**
 * What happens when a bare URL is pasted -- the menu linkPasteMenu.ts shows is
 * built from LINK_PASTE_ACTIONS, so adding a menu item is appending an entry
 * here; the menu shell needs no change.  An action that needs the server gets
 * its own /admin/api/ endpoint, like `fetch-title` below.
 */

export interface LinkPasteContext {
  /** The pasted URL, exactly as it now sits in the document. */
  url: string;
  /** Text the paste replaced when something was selected, else "". */
  replacedText: string;
}

export interface LinkPasteOutcome {
  /** Replaces the pasted URL. */
  text: string;
  /** Selection within `text`; the caret lands after the text when omitted. */
  selection?: { anchor: number; head: number };
}

export interface LinkPasteAction {
  id: string;
  label: string;
  /** Dim sample of the result, shown right of the label. */
  hint?: string;
  /** Item label while an async run() is in flight. */
  busyLabel?: string;
  /**
   * Returning null keeps the URL exactly as pasted.  Throwing keeps the menu
   * open and shows the message, so the user can still pick another option.
   */
  run: (
    ctx: LinkPasteContext,
  ) => LinkPasteOutcome | null | Promise<LinkPasteOutcome | null>;
}

/**
 * `]` and `\` would end or corrupt the label, and an unbalanced `)` in the URL
 * would end the destination early -- `<>` is always safe for the destination.
 */
function mdLink(
  alias: string,
  url: string,
): { text: string; aliasStart: number; aliasEnd: number } {
  const label = alias.replace(/([\\[\]])/g, "\\$1");
  const dest = /[()<>]/.test(url) ? `<${url}>` : url;
  return {
    text: `[${label}](${dest})`,
    aliasStart: 1,
    aliasEnd: 1 + label.length,
  };
}

export const LINK_PASTE_ACTIONS: readonly LinkPasteAction[] = [
  {
    id: "plain",
    label: "URL 그대로",
    hint: "https://…",
    run: () => null,
  },
  {
    id: "alias",
    label: "별칭 달기",
    hint: "[별칭](URL)",
    run: ({ url, replacedText }) => {
      const { text, aliasStart } = mdLink(replacedText, url);
      // With a former selection the alias is already written, so the caret
      // moves on; with none it parks inside the empty brackets.
      return replacedText === ""
        ? { text, selection: { anchor: aliasStart, head: aliasStart } }
        : { text };
    },
  },
  {
    id: "fetch-title",
    label: "제목 가져와 별칭으로",
    hint: "[페이지 제목](URL)",
    busyLabel: "제목 가져오는 중…",
    run: async ({ url }) => {
      const { title } = await api.linkTitle(url);
      if (title === null) {
        throw new Error("문서에서 제목을 찾지 못했습니다.");
      }
      return { text: mdLink(title, url).text };
    },
  },
];
