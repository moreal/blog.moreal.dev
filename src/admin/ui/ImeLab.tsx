import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { For, Show, createSignal, onCleanup } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import {
  EVENT_TYPES, PANES, SEED, VERDICTS, verdictKey,
  type LogEntry, type PaneId,
} from "./imeLabModel.ts";
import { codepoints, eventDetail, eventRowClass } from "./imeLabEvents.ts";
import { formatImeReport } from "./imeLabReport.ts";

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

export default function ImeLab() {
  const [log, setLog] = createStore<LogEntry[]>([]);
  // Derived from PANES so adding a pane cannot leave this behind.
  const [values, setValues] = createStore<Record<PaneId, string>>(
    Object.fromEntries(PANES.map((pane) => [pane.id, SEED])) as Record<
      PaneId,
      string
    >,
  );
  const [verdicts, setVerdicts] = createStore<Record<string, boolean>>({});
  const [paneOn, setPaneOn] = createStore<Record<string, boolean>>(
    Object.fromEntries(PANES.map((pane) => [pane.id, true])),
  );
  const [typeOn, setTypeOn] = createStore<Record<string, boolean>>(
    Object.fromEntries(EVENT_TYPES.map((type) => [type, true])),
  );
  const [follow, setFollow] = createSignal(true);

  let seq = 0;
  const startedAt = performance.now();
  let logBody: HTMLDivElement | undefined;

  const readers: Partial<Record<PaneId, () => string>> = {};

  function recordEvent(
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
      t: Math.round(performance.now() - startedAt),
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
  function trackDefaultPrevented(id: number, e: Event) {
    queueMicrotask(() => {
      if (!e.defaultPrevented) return;
      setLog(
        produce((entries) => {
          const entry = entries.find((candidate) => candidate.seq === id);
          if (entry) entry.detail["defaultPrevented"] = true;
        }),
      );
    });
  }

  /** Capture phase, so nothing downstream can hide an event from the log. */
  function attachCapture(pane: PaneId, el: HTMLElement) {
    for (const type of EVENT_TYPES) {
      if (type === "cm-update") continue;
      const handler = (e: Event) => {
        const id = recordEvent(pane, "capture", type, eventDetail(type, e));
        trackDefaultPrevented(id, e);
      };
      el.addEventListener(type, handler, { capture: true });
      onCleanup(() => el.removeEventListener(type, handler, { capture: true }));
    }
  }

  // Each pane wires itself up from its ref callback rather than from onMount,
  // so nothing depends on when the control-flow components create their DOM.
  let textareaElement: HTMLTextAreaElement | undefined;
  let contentEditableElement: HTMLDivElement | undefined;
  let plaintextElement: HTMLDivElement | undefined;
  let codeMirrorView: EditorView | undefined;

  function mountTextarea(el: HTMLTextAreaElement) {
    textareaElement = el;
    el.value = SEED;
    readers["textarea"] = () => el.value;
    attachCapture("textarea", el);
  }

  // The contenteditable panes are seeded imperatively and never re-rendered by
  // Solid: a reactive update landing mid-composition would abort the IME.
  function mountEditable(pane: PaneId, el: HTMLDivElement) {
    if (pane === "contenteditable") contentEditableElement = el;
    else plaintextElement = el;
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
        recordEvent("codemirror", "cm-handler", type, eventDetail(type, e));
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
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const changes: string[] = [];
            update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
              changes.push(
                `${fromA}-${toA}→${fromB}-${toB} ${JSON.stringify(inserted.toString())}`,
              );
            });
            recordEvent("codemirror", "cm-update", "cm-update", {
              composing: update.view.composing,
              changes,
            });
          }),
        ],
      }),
    });
    codeMirrorView = view;
    readers["codemirror"] = () => view.state.doc.toString();
    // CodeMirror stops most events at its content DOM, so a capture listener
    // on the wrapper catches anything its own handlers never see.
    attachCapture("codemirror", el);
    onCleanup(() => view.destroy());
  }

  function reset() {
    if (textareaElement) textareaElement.value = SEED;
    if (contentEditableElement) contentEditableElement.textContent = SEED;
    if (plaintextElement) plaintextElement.textContent = SEED;
    codeMirrorView?.dispatch({
      changes: { from: 0, to: codeMirrorView.state.doc.length, insert: SEED },
    });
    for (const pane of PANES) setValues(pane.id, SEED);
  }

  function clearLog() {
    setLog(reconcile([]));
    seq = 0;
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${what} 복사됨`);
    } catch {
      alert("클립보드 접근 실패");
    }
  }

  const visibleEntries = () =>
    log.filter((entry) => paneOn[entry.pane] && typeOn[entry.type] !== false);

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
                  {log.filter((entry) => entry.pane === pane.id).length}
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
                    {(codepoint) => (
                      <span class={codepoint.hanja ? "hanja" : undefined}>{codepoint.cp} </span>
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
                        checked={verdicts[verdictKey(pane.id, i())] === true}
                        onChange={(e) =>
                          setVerdicts(verdictKey(pane.id, i()), e.currentTarget.checked)
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
        <button
          class="primary"
          onClick={() => copy(formatImeReport(log, verdicts, navigator.userAgent), "요약")}
        >
          요약 복사
        </button>
        <button onClick={() => copy(JSON.stringify(log, null, 2), "JSON")}>
          JSON 복사
        </button>
        <button onClick={clearLog}>로그 지우기</button>
        <button onClick={reset}>본문 초기화</button>
        <div class="filters">
          <For each={PANES}>
            {(pane) => (
              <label>
                <input
                  type="checkbox"
                  checked={paneOn[pane.id]}
                  onChange={(e) => setPaneOn(pane.id, e.currentTarget.checked)}
                />
                {pane.title}
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
            {(type) => (
              <label>
                <input
                  type="checkbox"
                  checked={typeOn[type]}
                  onChange={(e) => setTypeOn(type, e.currentTarget.checked)}
                />
                {type}
              </label>
            )}
          </For>
        </div>
      </div>

      <div class="log-wrap" ref={logBody}>
        <Show
          when={visibleEntries().length > 0}
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
              <For each={visibleEntries()}>
                {(entry) => (
                  <tr class={eventRowClass(entry)}>
                    <td class="seq">{entry.seq}</td>
                    <td class="t">{entry.t}</td>
                    <td>{entry.pane}</td>
                    <td>{entry.source}</td>
                    <td class="type">{entry.type}</td>
                    <td class="detail">{JSON.stringify(entry.detail)}</td>
                    <td class="detail">{JSON.stringify(entry.value)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </div>
  );
}
