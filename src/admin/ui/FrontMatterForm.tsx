import { Show } from "solid-js";
import type { BookInfo, FrontMatterForm as Form } from "../lib/types.ts";

/**
 * The form owns the front matter and the editor buffer owns only the body, so
 * the CMS structurally cannot write invalid YAML.
 */

/** "2026-08-07T23:05:11+09:00" <-> the value a datetime-local input wants. */
function toLocalInput(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?/.exec(iso);
  return m === null ? "" : `${m[1]}T${m[2]}`;
}

function fromLocalInput(value: string, previous: string): string {
  if (value === "") return previous;
  const secs = /T\d{2}:\d{2}(:\d{2})/.exec(previous)?.[1] ?? ":00";
  return `${value}${secs}+09:00`;
}

export default function FrontMatterForm(props: {
  value: Form;
  onChange: (next: Form) => void;
  nowIso: () => string;
}) {
  const set = <K extends keyof Form>(key: K, v: Form[K]) => {
    const next = { ...props.value };
    if (v === undefined || v === false || v === "") delete next[key];
    else next[key] = v;
    props.onChange(next);
  };

  const setBook = (key: keyof BookInfo, v: string) => {
    const book: BookInfo = { ...props.value.book };
    if (key === "year") {
      const n = Number.parseInt(v, 10);
      if (Number.isNaN(n)) delete book.year;
      else book.year = n;
    } else if (v === "") delete book[key];
    else book[key] = v;
    const next: Form = { ...props.value, book };
    // An all-blank book block parses to undefined anyway (parseBook in
    // posts.ts); dropping it here keeps it out of the file entirely.
    if (Object.values(book).every((x) => x === undefined)) delete next.book;
    props.onChange(next);
  };

  return (
    <div class="fm">
      <label class="fm-row">
        <span>발행</span>
        <span class="fm-inline">
          <input
            type="datetime-local"
            value={toLocalInput(props.value.published)}
            onChange={(e) =>
              set(
                "published",
                fromLocalInput(e.currentTarget.value, props.value.published),
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
                : (e.currentTarget.value as "daily" | "reading"),
            )
          }
        >
          <option value="">일반 글</option>
          <option value="daily">일상</option>
          <option value="reading">독후감</option>
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
          <label class="fm-row">
            <span>책 제목</span>
            <input
              type="text"
              value={props.value.book?.title ?? ""}
              onInput={(e) => setBook("title", e.currentTarget.value)}
            />
          </label>
          <label class="fm-row">
            <span>지은이</span>
            <input
              type="text"
              value={props.value.book?.author ?? ""}
              onInput={(e) => setBook("author", e.currentTarget.value)}
            />
          </label>
          <label class="fm-row">
            <span>옮긴이</span>
            <input
              type="text"
              value={props.value.book?.translator ?? ""}
              onInput={(e) => setBook("translator", e.currentTarget.value)}
            />
          </label>
          <label class="fm-row">
            <span>펴낸곳</span>
            <input
              type="text"
              value={props.value.book?.publisher ?? ""}
              onInput={(e) => setBook("publisher", e.currentTarget.value)}
            />
          </label>
          <label class="fm-row">
            <span>펴낸해</span>
            <input
              type="number"
              value={props.value.book?.year ?? ""}
              onInput={(e) => setBook("year", e.currentTarget.value)}
            />
          </label>
        </div>
      </Show>
    </div>
  );
}
