import { Show, createResource, createSignal } from "solid-js";
import type { Lang, PostKind } from "../lib/types.ts";
import { languageLabel } from "../../lib/site.ts";
import { api } from "./api.ts";
import { editorHref } from "./links.ts";
import { POST_KIND_LABELS } from "./postKinds.ts";
import { kstDate, looksLikeCalendarDate, yearAndMonthOf } from "../shared/dates.ts";
import { errorMessage } from "../shared/errors.ts";
import { CREATE_SLUG, LANGS, postFilePath } from "../shared/post-files.ts";

const KINDS: { id: PostKind; label: string; note: string }[] = [
  { id: "regular", label: POST_KIND_LABELS.regular, note: "목록의 기본 탭에 실립니다" },
  { id: "daily", label: POST_KIND_LABELS.daily, note: "파일명이 날짜가 되고 /daily/ 로 갑니다" },
  { id: "reading", label: POST_KIND_LABELS.reading, note: "책 정보 칸이 생기고 /reading/ 으로 갑니다" },
];

function fileTheServerWillWrite(day: string, slug: string, lang: Lang): string {
  return postFilePath(yearAndMonthOf(day), slug, lang);
}

export default function NewPost() {
  const params = new URLSearchParams(location.search);
  const translationOf = params.get("translationOf") ?? "";
  const isTranslation = translationOf !== "";

  const [kind, setKind] = createSignal<PostKind>("regular");
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
      return all.groups.find((group) => group.postPath === postPath) ?? null;
    },
  );

  const slugOk = () => kind() === "daily" || CREATE_SLUG.test(slug());
  const dateInputComplete = () => kind() !== "daily" || looksLikeCalendarDate(date());

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
      location.href = editorHref(data.file);
    } catch (e) {
      setError(errorMessage(e));
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
            {KINDS.map((kindOption) => (
              <button
                class={kind() === kindOption.id ? "picker on" : "picker"}
                onClick={() => setKind(kindOption.id)}
              >
                <b>{kindOption.label}</b>
                <em>{kindOption.note}</em>
              </button>
            ))}
          </div>
        </div>
      </Show>

      <div class="fm-block">
        <h2>언어</h2>
        <div class="pickers">
          {LANGS.map((langOption) => (
            <button
              class={lang() === langOption ? "picker on" : "picker"}
              disabled={isTranslation && existing()?.missingLangs.includes(langOption) === false}
              onClick={() => setLang(langOption)}
            >
              <b>{languageLabel(langOption)}</b>
              <em>
                {langOption === "ko-Kore"
                  ? "漢字로 쓰면 한글 뷰가 자동 생성됩니다"
                  : langOption}
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
            <code>{fileTheServerWillWrite(today, slug() || "…", lang())}</code>
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
              {dateInputComplete() ? fileTheServerWillWrite(date(), date(), lang()) : "…"}
            </code>
            <Show when={dateInputComplete() && date() !== today}>
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
          disabled={busy() || !slugOk() || !dateInputComplete()}
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
