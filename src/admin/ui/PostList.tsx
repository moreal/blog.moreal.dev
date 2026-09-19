import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import type { PostGroup, PostSourceSummary } from "../lib/types.ts";
import { LANG_LABEL, api } from "./api.ts";
import { kstDateTime, kstYear } from "../shared/dates.ts";

/** Debounced so typing does not read every post on every keystroke. */
function useDebounced<T>(source: () => T, ms: number): () => T {
  const [value, setValue] = createSignal<T>(source());
  let timer: ReturnType<typeof setTimeout> | undefined;
  createMemo(() => {
    const next = source();
    clearTimeout(timer);
    timer = setTimeout(() => setValue(() => next), ms);
  });
  return value;
}

type Filter = "all" | "daily" | "reading" | "draft" | "asset";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "daily", label: "일상" },
  { id: "reading", label: "독후감" },
  { id: "draft", label: "초안" },
  { id: "asset", label: "이미지 있음" },
];

function matchesFilter(group: PostGroup, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "asset") return group.assetDir !== null;
  if (filter === "draft") return group.sources.some((source) => source.draft);
  return group.sources.some((source) => source.type === filter);
}

function searchableText(group: PostGroup): string {
  return (
    group.postPath +
    " " +
    group.sources.map((source) => `${source.title} ${source.description ?? ""} ${source.lang}`).join(" ")
  ).toLowerCase();
}

function SourceChips(props: { source: PostSourceSummary }) {
  return (
    <>
      <span class="chip">{LANG_LABEL[props.source.lang] ?? props.source.lang}</span>
      <Show when={props.source.derivedLangs.length > 0}>
        {/* The derived view has no file of its own, so it never gets an edit
            affordance -- seonbi generates it at build time. */}
        <span class="chip derived" title="seonbi가 빌드 시점에 생성합니다">
          → {props.source.derivedLangs.map((l) => LANG_LABEL[l] ?? l).join(", ")}{" "}
          (파생)
        </span>
      </Show>
      <Show when={props.source.draft}>
        <span class="chip warn">초안</span>
      </Show>
      <Show when={props.source.dark}>
        <span class="chip warn">불 끄고</span>
      </Show>
      <Show when={props.source.type}>
        <span class="chip">
          {props.source.type === "daily" ? "일상" : "독후감"}
        </span>
      </Show>
      <Show when={props.source.parseError}>
        <span class="chip bad" title={props.source.parseError}>
          파싱 실패
        </span>
      </Show>
    </>
  );
}

function SearchResults(props: {
  results: Awaited<ReturnType<typeof api.search>> | undefined;
  loading: boolean;
}) {
  return (
    <div class="card">
      <h2>
        본문 검색
        <Show when={props.loading}> · 찾는 중…</Show>
        <Show when={props.results}>
          {(r) => (
            <>
              {" "}· {r().hits.length}건
              <Show when={r().truncated}> (일부만 표시)</Show>
            </>
          )}
        </Show>
      </h2>
      <Show
        when={props.results?.hits.length}
        fallback={
          <Show when={!props.loading}>
            <p class="lab-sub" style={{ margin: 0 }}>
              본문에서 찾지 못했습니다.
            </p>
          </Show>
        }
      >
        <div class="rows">
          <For each={props.results?.hits}>
            {(hit) => (
              <a
                class="hit"
                href={`/admin/edit?file=${encodeURIComponent(hit.file)}`}
              >
                <span class="hit-title">
                  {hit.title}
                  <span class="chip">{LANG_LABEL[hit.lang] ?? hit.lang}</span>
                  <span class="when">
                    {hit.line}번째 줄 · {hit.count}회
                  </span>
                </span>
                <span class="hit-excerpt">{hit.excerpt}</span>
              </a>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function PostGroupRow(props: { group: PostGroup }) {
  return (
    <div class="row">
      <div class="row-main">
        <div class="row-title">
          <For each={props.group.sources}>
            {(source, i) => (
              <>
                <Show when={i() > 0}>
                  <span class="sep">·</span>
                </Show>
                <a href={`/admin/edit?file=${encodeURIComponent(source.file)}`}>
                  {source.title || source.slug}
                </a>
              </>
            )}
          </For>
        </div>
        <div class="row-meta">
          <code>{props.group.postPath}</code>
          <For each={props.group.sources}>{(source) => <SourceChips source={source} />}</For>
          <Show when={props.group.assetDir}>
            <span class="chip">이미지 {props.group.assetCount}</span>
          </Show>
        </div>
      </div>
      <div class="row-side">
        <span class="when">
          {kstDateTime(props.group.sources[0]?.published ?? "")}
        </span>
        <div class="row-actions">
          <For each={props.group.missingLangs}>
            {(lang) => (
              <a
                class="btn small"
                href={`/admin/new?translationOf=${encodeURIComponent(props.group.postPath)}&lang=${lang}`}
                title={`${LANG_LABEL[lang]} 번역 추가`}
              >
                ＋{LANG_LABEL[lang]}
              </a>
            )}
          </For>
          <a class="btn small" href={`/${props.group.postPath}/`} target="_blank">
            보기
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PostList() {
  const [data, { refetch }] = createResource(() => api.posts());
  const [query, setQuery] = createSignal("");
  const [filter, setFilter] = createSignal<Filter>("all");
  const [fullText, setFullText] = createSignal(false);

  const debouncedQuery = useDebounced(query, 220);
  const [hits] = createResource(
    () => fullText() && debouncedQuery().trim().length >= 2
      ? debouncedQuery().trim()
      : null,
    (needle) => api.search(needle),
  );

  const groups = createMemo(() => {
    const all = data()?.groups ?? [];
    const needle = query().trim().toLowerCase();
    return all.filter(
      (group) =>
        matchesFilter(group, filter()) &&
        (needle === "" || searchableText(group).includes(needle)),
    );
  });

  const groupsByYear = createMemo(() => {
    const years = new Map<string, PostGroup[]>();
    for (const group of groups()) {
      const year = kstYear(group.sources[0]?.published ?? "");
      const list = years.get(year);
      if (list === undefined) years.set(year, [group]);
      else list.push(group);
    }
    return [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  });

  return (
    <div class="lab">
      <div class="list-head">
        <div>
          <h1>글</h1>
          <p class="lab-sub">
            <Show when={data()} fallback="불러오는 중…">
              {(d) => (
                <>
                  {d().groups.length}편 ·{" "}
                  {d().groups.reduce((n, group) => n + group.sources.length, 0)}개 원고
                </>
              )}
            </Show>
          </p>
        </div>
        <div class="toolbar" style={{ margin: 0 }}>
          <a class="btn primary" href="/admin/new">
            새 글
          </a>
          <button onClick={() => refetch()}>새로고침</button>
        </div>
      </div>

      <div class="toolbar">
        <input
          class="search"
          type="search"
          placeholder="제목·경로·설명 검색"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <label class="fm-check">
          <input
            type="checkbox"
            checked={fullText()}
            onChange={(e) => setFullText(e.currentTarget.checked)}
          />
          본문까지
        </label>
        <div class="filters">
          <For each={FILTERS}>
            {(f) => (
              <button
                class={filter() === f.id ? "primary" : ""}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            )}
          </For>
        </div>
      </div>

      <Show when={fullText() && query().trim().length >= 2}>
        <SearchResults results={hits()} loading={hits.loading} />
      </Show>

      <Show when={data.error}>
        <div class="card bad-box">목록을 불러오지 못했습니다: {String(data.error)}</div>
      </Show>

      <Show
        when={groups().length > 0}
        fallback={
          <Show when={!data.loading}>
            <div class="empty">해당하는 글이 없습니다.</div>
          </Show>
        }
      >
        <For each={groupsByYear()}>
          {([year, list]) => (
            <>
              <h2 class="year">{year}</h2>
              <div class="rows">
                <For each={list}>
                  {(group) => (
                    <PostGroupRow group={group} />
                  )}
                </For>
              </div>
            </>
          )}
        </For>
      </Show>
    </div>
  );
}
