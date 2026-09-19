import { For, Show } from "solid-js";
import type { BookInfo, FrontMatterForm as Form, PostType } from "../lib/types.ts";
import { datetimeLocalValue, kstIsoFromDatetimeLocal } from "../shared/dates.ts";
import { withBookField, withFormField } from "./frontMatterEdits.ts";
import { POST_KIND_LABELS } from "./postKinds.ts";

/**
 * The form owns the front matter and the editor buffer owns only the body, so
 * the CMS structurally cannot write invalid YAML.
 */

const BOOK_INPUTS: { key: keyof BookInfo; label: string; type: "text" | "number" }[] = [
  { key: "title", label: "책 제목", type: "text" },
  { key: "author", label: "지은이", type: "text" },
  { key: "translator", label: "옮긴이", type: "text" },
  { key: "publisher", label: "펴낸곳", type: "text" },
  { key: "year", label: "펴낸해", type: "number" },
];

export default function FrontMatterForm(props: {
  value: Form;
  onChange: (next: Form) => void;
  nowIso: () => string;
}) {
  const set = <Key extends keyof Form>(key: Key, value: Form[Key]) => {
    props.onChange(withFormField(props.value, key, value));
  };

  const setBook = (key: keyof BookInfo, input: string) => {
    props.onChange(withBookField(props.value, key, input));
  };

  return (
    <div class="fm">
      <label class="fm-row">
        <span>발행</span>
        <span class="fm-inline">
          <input
            type="datetime-local"
            value={datetimeLocalValue(props.value.published)}
            onChange={(e) =>
              set(
                "published",
                kstIsoFromDatetimeLocal(e.currentTarget.value, props.value.published),
              )
            }
          />
          <button class="small" onClick={() => set("published", props.nowIso())}>
            지금
          </button>
        </span>
      </label>

      <label class="fm-row">
        <span>설명</span>
        <input
          type="text"
          placeholder="(선택) 검색 결과와 메타 태그에 쓰입니다"
          value={props.value.description ?? ""}
          onInput={(e) => set("description", e.currentTarget.value)}
        />
      </label>

      <label class="fm-row">
        <span>종류</span>
        <select
          value={props.value.type ?? ""}
          onChange={(e) =>
            set(
              "type",
              e.currentTarget.value === ""
                ? undefined
                : (e.currentTarget.value as PostType),
            )
          }
        >
          <option value="">{POST_KIND_LABELS.regular}</option>
          <option value="daily">{POST_KIND_LABELS.daily}</option>
          <option value="reading">{POST_KIND_LABELS.reading}</option>
        </select>
      </label>

      <div class="fm-row">
        <span>표시</span>
        <span class="fm-inline">
          <label class="fm-check">
            <input
              type="checkbox"
              checked={props.value.draft === true}
              onChange={(e) => set("draft", e.currentTarget.checked)}
            />
            초안 <em>빌드에서 제외</em>
          </label>
          <label class="fm-check">
            <input
              type="checkbox"
              checked={props.value.dark === true}
              onChange={(e) => set("dark", e.currentTarget.checked)}
            />
            불 끄고 <em>목록에서 감춤</em>
          </label>
        </span>
      </div>

      <Show when={props.value.type === "reading"}>
        <div class="fm-book">
          <For each={BOOK_INPUTS}>
            {(input) => (
              <label class="fm-row">
                <span>{input.label}</span>
                <input
                  type={input.type}
                  value={props.value.book?.[input.key] ?? ""}
                  onInput={(e) => setBook(input.key, e.currentTarget.value)}
                />
              </label>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
