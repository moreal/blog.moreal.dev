import { Show, createResource, createSignal } from "solid-js";
import type { Lang } from "../lib/types.ts";
import { LANG_LABEL, api, kstDate } from "./api.ts";

type Kind = "daily" | "reading" | "regular";

const KINDS: { id: Kind; label: string; note: string }[] = [
  { id: "regular", label: "일반 글", note: "목록의 기본 탭에 실립니다" },
  { id: "daily", label: "일상", note: "파일명이 날짜가 되고 /daily/ 로 갑니다" },
  { id: "reading", label: "독후감", note: "책 정보 칸이 생기고 /reading/ 으로 갑니다" },
];

const LANGS: Lang[] = ["ko-Hang", "ko-Kore", "en"];

/** The file the server will write, named the way postFileName() names it. */
function filePreview(day: string, name: string, lang: Lang): string {
  return `${day.slice(0, 4)}/${day.slice(5, 7)}/${name}.${lang}.md`;
}

export default function NewPost() {
  const params = new URLSearchParams(location.search);
  const translationOf = params.get("translationOf") ?? "";
  const isTranslation = translationOf !== "";

  const [kind, setKind] = createSignal<Kind>("regular");
  const [lang, setLang] = createSignal<Lang>(
    (params.get("lang") as Lang | null) ?? "ko-Hang",
  );
  const [slug, setSlug] = createSignal("");
  const [title, setTitle] = createSignal("");
  const today = kstDate();
  const [date, setDate] = createSignal(today);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  // Only offered for a translation, so the user can see what will be shared.
  const [existing] = createResource(
    () => (isTranslation ? translationOf : null),
    async (postPath) => {
      const all = await api.posts();
      return all.groups.find((g) => g.postPath === postPath) ?? null;
    },
  );

  const slugOk = () => kind() === "daily" || /^[a-z0-9][a-z0-9-]*$/.test(slug());
  // An emptied or half-typed date input reads as "", so guard before sending.
  const dateOk = () => kind() !== "daily" || /^20\d\d-\d\d-\d\d$/.test(date());

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/admin/api/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: kind(),
          lang: lang(),
          ...(kind() === "daily" ? { date: date() } : { slug: slug() }),
          ...(title() !== "" ? { title: title() } : {}),
          ...(isTranslation ? { translationOf } : {}),
        }),
      });
      const data = (await res.json()) as
        | { ok: true; file: string }
        | { ok: false; message: string };
      if (!data.ok) {
        setError(data.message);
        return;
      }
      location.href = `/admin/edit?file=${encodeURIComponent(data.file)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="lab narrow">
      <a class="back" href="/admin">
        ← 목록
      </a>
      <h1>{isTranslation ? "번역 추가" : "새 글"}</h1>

      <Show when={isTranslation}>
        <div class="card">
          <p style={{ margin: "0 0 6px" }}>
            <code>{translationOf}</code> 의 번역본을 만듭니다.
          </p>
          <p class="lab-sub" style={{ margin: 0 }}>
            같은 달 디렉터리에 생기므로 이미지 디렉터리를 그대로 공유합니다
            (복사하지 않습니다). 발행 시각·종류·책 정보는 원본에서 가져옵니다.
            <Show when={existing()?.assetCount}>
              {" "}현재 이미지 {existing()?.assetCount}개.
            </Show>
          </p>
        </div>
      </Show>

      <Show when={!isTranslation}>
        <div class="fm-block">
          <h2>종류</h2>
          <div class="pickers">
            {KINDS.map((k) => (
              <button
                class={kind() === k.id ? "picker on" : "picker"}
                onClick={() => setKind(k.id)}
              >
                <b>{k.label}</b>
                <em>{k.note}</em>
              </button>
            ))}
          </div>
        </div>
      </Show>

      <div class="fm-block">
        <h2>언어</h2>
        <div class="pickers">
          {LANGS.map((l) => (
            <button
              class={lang() === l ? "picker on" : "picker"}
              disabled={isTranslation && existing()?.missingLangs.includes(l) === false}
              onClick={() => setLang(l)}
            >
              <b>{LANG_LABEL[l]}</b>
              <em>
                {l === "ko-Kore"
                  ? "漢字로 쓰면 한글 뷰가 자동 생성됩니다"
                  : l}
              </em>
            </button>
          ))}
        </div>
      </div>

      <Show when={kind() !== "daily" && !isTranslation}>
        <div class="fm-block">
          <h2>슬러그</h2>
          <input
            class="search wide"
            type="text"
            placeholder="reproducible-commit"
            value={slug()}
            onInput={(e) => setSlug(e.currentTarget.value)}
          />
          <p class="lab-sub">
            파일이 됩니다:{" "}
            <code>{filePreview(today, slug() || "…", lang())}</code>
          </p>
        </div>

        <div class="fm-block">
          <h2>제목</h2>
          <input
            class="search wide"
            type="text"
            placeholder="(비우면 TODO)"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </div>
      </Show>

      <Show when={kind() === "daily" && !isTranslation}>
        <div class="fm-block">
          <h2>날짜</h2>
          <span class="fm-inline">
            <input
              class="search"
              type="date"
              value={date()}
              onInput={(e) => setDate(e.currentTarget.value)}
            />
            <button
              class="small"
              disabled={date() === today}
              onClick={() => setDate(today)}
            >
              오늘
            </button>
          </span>
          <p class="lab-sub">
            파일명과 제목이 이 날짜가 됩니다:{" "}
            <code>
              {dateOk() ? filePreview(date(), date(), lang()) : "…"}
            </code>
            <Show when={dateOk() && date() !== today}>
              {" "}발행 시각은 그 날의 지금 시각으로 적힙니다.
            </Show>
          </p>
        </div>
      </Show>

      <Show when={error()}>
        <div class="card bad-box">{error()}</div>
      </Show>

      <div class="toolbar">
        <button
          class="primary"
          onClick={create}
          disabled={busy() || !slugOk() || !dateOk()}
        >
          {busy() ? "만드는 중…" : "만들고 편집"}
        </button>
        <a class="btn" href="/admin">
          취소
        </a>
      </div>
    </div>
  );
}
