import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { For, Show, createSignal, onCleanup } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";

/**
 * Does macOS Hanja conversion (Option+Return) survive each candidate editor?
 *
 * Conversion is *re*conversion: the IME reads back text that was already
 * committed and replaces it in place.  At the DOM level that arrives either as
 * a composition cycle or as a `beforeinput` with inputType
 * "insertReplacementText" and a non-collapsed target range -- the path editors
 * historically get wrong.  So the log below exists to answer one question per
 * pane: what events actually fire, and did the text change.
 */

type PaneId = "textarea" | "contenteditable" | "plaintext-only" | "codemirror";

interface Pane {
  id: PaneId;
  title: string;
  note: string;
}

const PANES: Pane[] = [
  {
    id: "textarea",
    title: "textarea",
    note: "보장된 기준선 · 폴백 엔진",
  },
  {
    id: "contenteditable",
    title: "contenteditable",
    note: "CM6이 올라선 바닥",
  },
  {
    id: "plaintext-only",
    title: 'contenteditable="plaintext-only"',
    note: "macOS에서 다르게 동작",
  },
  {
    id: "codemirror",
    title: "CodeMirror 6",
    note: "실제 설정 그대로 · autocomplete 없음",
  },
];

const SEED = "한자 대한민국 국한문";

const VERDICTS = ["후보창 뜸", "후보 선택됨", "텍스트 치환됨", "Esc로 복구"];

const EVENT_TYPES = [
  "keydown",
  "keyup",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "cm-update",
] as const;

interface LogEntry {
  seq: number;
  t: number;
  pane: PaneId;
  source: "capture" | "cm-handler" | "cm-update";
  type: string;
  detail: Record<string, unknown>;
  value: string;
}

/** CJK Unified Ideographs, including the common extensions. */
function isHanja(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x2ebef)
  );
}

function codepoints(s: string): { cp: string; hanja: boolean }[] {
  return [...s].slice(0, 60).map((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return {
      cp: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
      hanja: isHanja(cp),
    };
  });
}

function nodeLabel(n: Node): string {
  return n.nodeType === Node.TEXT_NODE ? "#text" : n.nodeName.toLowerCase();
}

/** The text a StaticRange covers -- i.e. exactly what the IME is replacing. */
function staticRangeText(r: StaticRange): string {
  try {
    const range = document.createRange();
    range.setStart(r.startContainer, r.startOffset);
    range.setEnd(r.endContainer, r.endOffset);
    return range.toString();
  } catch {
    return "?";
  }
}

function keyDetail(e: KeyboardEvent): Record<string, unknown> {
  return {
    key: e.key,
    code: e.code,
    // Deprecated, but it is the IME signal: a key handled by the input method
    // reports keyCode 229 while `key` still says "Enter".
    keyCode: e.keyCode,
    altKey: e.altKey,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
    isComposing: e.isComposing,
    repeat: e.repeat,
  };
}

function inputDetail(e: InputEvent): Record<string, unknown> {
  const d: Record<string, unknown> = {
    inputType: e.inputType,
    data: e.data,
    isComposing: e.isComposing,
    cancelable: e.cancelable,
  };
  const text = e.dataTransfer?.getData("text/plain");
  if (text) d["dataTransfer"] = text;
  // The decisive field: a non-collapsed range here means the IME is replacing
  // committed text rather than inserting at the caret.
  if (typeof e.getTargetRanges === "function") {
    const ranges = e.getTargetRanges();
    if (ranges.length > 0) {
      d["targetRanges"] = ranges.map((r) => ({
        start: `${nodeLabel(r.startContainer)}:${r.startOffset}`,
        end: `${nodeLabel(r.endContainer)}:${r.endOffset}`,
        collapsed: r.collapsed,
        text: staticRangeText(r),
      }));
    }
  }
  return d;
}

export default function ImeLab() {
  const [log, setLog] = createStore<LogEntry[]>([]);
  // Derived from PANES so adding a pane cannot leave this behind.
  const [values, setValues] = createStore<Record<PaneId, string>>(
    Object.fromEntries(PANES.map((p) => [p.id, SEED])) as Record<
      PaneId,
      string
    >,
  );
  const [verdicts, setVerdicts] = createStore<Record<string, boolean>>({});
  const [paneOn, setPaneOn] = createStore<Record<string, boolean>>(
    Object.fromEntries(PANES.map((p) => [p.id, true])),
  );
  const [typeOn, setTypeOn] = createStore<Record<string, boolean>>(
    Object.fromEntries(EVENT_TYPES.map((t) => [t, true])),
  );
  const [follow, setFollow] = createSignal(true);

  let seq = 0;
  const t0 = performance.now();
  let logBody: HTMLDivElement | undefined;

  const readers: Partial<Record<PaneId, () => string>> = {};

  function push(
    pane: PaneId,
    source: LogEntry["source"],
    type: string,
    detail: Record<string, unknown>,
  ): number {
    const id = ++seq;
    const value = readers[pane]?.() ?? "";
    setValues(pane, value);
    setLog(log.length, {
      seq: id,
      t: Math.round(performance.now() - t0),
      pane,
      source,
      type,
      detail,
      value,
    });
    if (follow() && logBody) {
      queueMicrotask(() => {
        if (logBody) logBody.scrollTop = logBody.scrollHeight;
      });
    }
    return id;
  }

  /** preventDefault is always false at capture time; re-read once handlers ran. */
  function trackPrevented(id: number, e: Event) {
    queueMicrotask(() => {
      if (!e.defaultPrevented) return;
      setLog(
        produce((entries) => {
          const it = entries.find((x) => x.seq === id);
          if (it) it.detail["defaultPrevented"] = true;
        }),
      );
    });
  }

  function detailFor(type: string, e: Event): Record<string, unknown> {
    if (type === "keydown" || type === "keyup") {
      return keyDetail(e as KeyboardEvent);
    }
    if (type === "beforeinput" || type === "input") {
      return inputDetail(e as InputEvent);
    }
    return { data: (e as CompositionEvent).data };
  }

  /** Capture phase, so nothing downstream can hide an event from the log. */
  function attachCapture(pane: PaneId, el: HTMLElement) {
    for (const type of EVENT_TYPES) {
      if (type === "cm-update") continue;
      const handler = (e: Event) => {
        const id = push(pane, "capture", type, detailFor(type, e));
        trackPrevented(id, e);
      };
      el.addEventListener(type, handler, { capture: true });
      onCleanup(() => el.removeEventListener(type, handler, { capture: true }));
    }
  }

  // ---- panes -------------------------------------------------------------

  // Each pane wires itself up from its ref callback rather than from onMount,
  // so nothing depends on when the control-flow components create their DOM.
  let taEl: HTMLTextAreaElement | undefined;
  let ceEl: HTMLDivElement | undefined;
  let poEl: HTMLDivElement | undefined;
  let cmView: EditorView | undefined;

  function mountTextarea(el: HTMLTextAreaElement) {
    taEl = el;
    el.value = SEED;
    readers["textarea"] = () => el.value;
    attachCapture("textarea", el);
  }

  // The contenteditable panes are seeded imperatively and never re-rendered by
  // Solid: a reactive update landing mid-composition would abort the IME.
  function mountEditable(pane: PaneId, el: HTMLDivElement) {
    if (pane === "contenteditable") ceEl = el;
    else poEl = el;
    el.textContent = SEED;
    readers[pane] = () => el.innerText;
    attachCapture(pane, el);
  }

  function mountCodeMirror(el: HTMLDivElement) {
    const domHandlers: Record<string, (e: Event) => boolean> = {};
    for (const type of EVENT_TYPES) {
      if (type === "cm-update") continue;
      // Returning false leaves CodeMirror's own handling untouched; this is an
      // observer, not an interceptor.
      domHandlers[type] = (e: Event) => {
        push("codemirror", "cm-handler", type, detailFor(type, e));
        return false;
      };
    }
    type DomHandlers = Parameters<typeof EditorView.domEventHandlers>[0];
    const view = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: SEED,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          EditorView.domEventHandlers(domHandlers as DomHandlers),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            const changes: string[] = [];
            u.changes.iterChanges((fa, ta, fb, tb, ins) => {
              changes.push(
                `${fa}-${ta}→${fb}-${tb} ${JSON.stringify(ins.toString())}`,
              );
            });
            push("codemirror", "cm-update", "cm-update", {
              composing: u.view.composing,
              changes,
            });
          }),
        ],
      }),
    });
    cmView = view;
    readers["codemirror"] = () => view.state.doc.toString();
    // CodeMirror stops most events at its content DOM, so a capture listener
    // on the wrapper catches anything its own handlers never see.
    attachCapture("codemirror", el);
    onCleanup(() => view.destroy());
  }


  // ---- actions -----------------------------------------------------------

  function reset() {
    if (taEl) taEl.value = SEED;
    if (ceEl) ceEl.textContent = SEED;
    if (poEl) poEl.textContent = SEED;
    cmView?.dispatch({
      changes: { from: 0, to: cmView.state.doc.length, insert: SEED },
    });
    for (const p of PANES) setValues(p.id, SEED);
  }

  function clearLog() {
    setLog(reconcile([]));
    seq = 0;
  }

  function summary(): string {
    const lines: string[] = [
      "## IME 한자 변환(⌥⏎) 검증 결과",
      "",
      `- 브라우저: ${navigator.userAgent}`,
      `- 이벤트 수: ${log.length}`,
      "",
      "| 패널 | " + VERDICTS.join(" | ") + " |",
      "|---|" + VERDICTS.map(() => "---").join("|") + "|",
    ];
    for (const p of PANES) {
      const marks = VERDICTS.map((_, i) =>
        verdicts[`${p.id}:${i}`] ? "✅" : "❌"
      );
      lines.push(`| ${p.title} | ${marks.join(" | ")} |`);
    }

    lines.push("", "### 패널별 관측된 inputType", "");
    for (const p of PANES) {
      const seen = new Set<string>();
      for (const e of log) {
        if (e.pane !== p.id) continue;
        const it = e.detail["inputType"];
        if (typeof it === "string") seen.add(it);
      }
      lines.push(`- **${p.title}**: ${[...seen].join(", ") || "(없음)"}`);
    }

    lines.push("", "### 마지막 ⌥⏎ 이후 이벤트 시퀀스", "");
    for (const p of PANES) {
      const own = log.filter((e) => e.pane === p.id);
      let start = -1;
      for (let i = own.length - 1; i >= 0; i--) {
        const e = own[i]!;
        if (e.type === "keydown" && e.detail["altKey"] === true) {
          start = i;
          break;
        }
      }
      lines.push(`**${p.title}**`, "");
      if (start < 0) {
        lines.push("```", "(⌥⏎ 관측 안 됨)", "```", "");
        continue;
      }
      lines.push("~~~~");
      for (const e of own.slice(start, start + 30)) {
        lines.push(`${e.type} ${JSON.stringify(e.detail)}`);
      }
      lines.push("~~~~", `최종 값: \`${own.at(-1)?.value ?? ""}\``, "");
    }
    return lines.join("\n");
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${what} 복사됨`);
    } catch {
      alert("클립보드 접근 실패");
    }
  }

  const visible = () =>
    log.filter((e) => paneOn[e.pane] && typeOn[e.type] !== false);

  return (
    <div class="lab">
      <h1>IME 한자 변환 검증</h1>
      <p class="lab-sub">
        어떤 편집기가 macOS 한자 변환을 견디는지 실측합니다. 여기 결과로 CMS의
        에디터 엔진이 정해집니다.
      </p>

      <div class="card">
        <h2>이렇게 확인하세요</h2>
        <ol>
          <li>
            각 패널에서 <b>한자</b> 뒤에 캐럿을 두거나 그 두 글자를 선택합니다.
          </li>
          <li>
            <kbd>⌥</kbd> + <kbd>⏎</kbd> 를 누릅니다. 후보 창이 떠야 합니다.
          </li>
          <li>후보를 고르고 <kbd>⏎</kbd> 로 확정합니다.</li>
          <li>
            아래 코드포인트가 <code>U+D55C U+C790</code> 에서{" "}
            <code>U+6F22 U+5B57</code> 로 바뀌었는지 봅니다 — 글자 모양이 아니라
            이 숫자로 판단하세요.
          </li>
          <li>패널마다 판정 체크박스를 채운 뒤 “요약 복사”를 누릅니다.</li>
        </ol>
      </div>

      <div class="panes">
        <For each={PANES}>
          {(pane) => (
            <div class="pane">
              <div class="pane-head">
                <h3>{pane.title}</h3>
                <code>{pane.note}</code>
                <span class="count">
                  {log.filter((e) => e.pane === pane.id).length}
                </span>
              </div>

              <Show when={pane.id === "textarea"}>
                <textarea class="surface" spellcheck={false} ref={mountTextarea} />
              </Show>
              <Show when={pane.id === "contenteditable"}>
                <div
                  class="surface"
                  contenteditable="true"
                  spellcheck={false}
                  ref={(el) => mountEditable("contenteditable", el)}
                />
              </Show>
              <Show when={pane.id === "plaintext-only"}>
                <div
                  class="surface"
                  contenteditable="plaintext-only"
                  spellcheck={false}
                  ref={(el) => mountEditable("plaintext-only", el)}
                />
              </Show>
              <Show when={pane.id === "codemirror"}>
                <div ref={mountCodeMirror} />
              </Show>

              <div class="readout">
                <div>
                  <b>값</b> {JSON.stringify(values[pane.id])}
                </div>
                <div>
                  <b>코드포인트</b>{" "}
                  <For each={codepoints(values[pane.id])}>
                    {(c) => (
                      <span class={c.hanja ? "hanja" : undefined}>{c.cp} </span>
                    )}
                  </For>
                </div>
              </div>

              <div class="verdict">
                <For each={VERDICTS}>
                  {(label, i) => (
                    <label>
                      <input
                        type="checkbox"
                        checked={verdicts[`${pane.id}:${i()}`] === true}
                        onChange={(e) =>
                          setVerdicts(
                            `${pane.id}:${i()}`,
                            e.currentTarget.checked,
                          )
                        }
                      />
                      {label}
                    </label>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="toolbar">
        <button class="primary" onClick={() => copy(summary(), "요약")}>
          요약 복사
        </button>
        <button onClick={() => copy(JSON.stringify(log, null, 2), "JSON")}>
          JSON 복사
        </button>
        <button onClick={clearLog}>로그 지우기</button>
        <button onClick={reset}>본문 초기화</button>
        <div class="filters">
          <For each={PANES}>
            {(p) => (
              <label>
                <input
                  type="checkbox"
                  checked={paneOn[p.id]}
                  onChange={(e) => setPaneOn(p.id, e.currentTarget.checked)}
                />
                {p.title}
              </label>
            )}
          </For>
        </div>
      </div>

      <div class="toolbar">
        <label>
          <input
            type="checkbox"
            checked={follow()}
            onChange={(e) => setFollow(e.currentTarget.checked)}
          />
          자동 스크롤
        </label>
        <div class="filters">
          <For each={EVENT_TYPES}>
            {(t) => (
              <label>
                <input
                  type="checkbox"
                  checked={typeOn[t]}
                  onChange={(e) => setTypeOn(t, e.currentTarget.checked)}
                />
                {t}
              </label>
            )}
          </For>
        </div>
      </div>

      <div class="log-wrap" ref={logBody}>
        <Show
          when={visible().length > 0}
          fallback={
            <div class="empty">
              아직 이벤트가 없습니다. 위 패널에 입력해 보세요.
            </div>
          }
        >
          <table class="log">
            <thead>
              <tr>
                <th>#</th>
                <th>ms</th>
                <th>패널</th>
                <th>출처</th>
                <th>이벤트</th>
                <th>상세</th>
                <th>값</th>
              </tr>
            </thead>
            <tbody>
              <For each={visible()}>
                {(e) => {
                  const replacement =
                    e.detail["inputType"] === "insertReplacementText" ||
                    (Array.isArray(e.detail["targetRanges"]) &&
                      (e.detail["targetRanges"] as { collapsed: boolean }[])
                        .some((r) => !r.collapsed));
                  const cls = replacement
                    ? "is-replacement"
                    : e.type.startsWith("composition")
                    ? "is-composition"
                    : e.type.startsWith("key")
                    ? "is-key"
                    : undefined;
                  return (
                    <tr class={cls}>
                      <td class="seq">{e.seq}</td>
                      <td class="t">{e.t}</td>
                      <td>{e.pane}</td>
                      <td>{e.source}</td>
                      <td class="type">{e.type}</td>
                      <td class="detail">{JSON.stringify(e.detail)}</td>
                      <td class="detail">{JSON.stringify(e.value)}</td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </div>
  );
}
