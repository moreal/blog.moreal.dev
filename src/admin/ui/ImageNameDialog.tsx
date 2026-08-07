import { Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

export interface ImageNameRequest {
  suggestion: string;
  ext: string;
  dir: string;
  existing: string[];
  preview: string;
}

export interface ImageNameResult {
  name: string;
  overwrite: boolean;
}

/**
 * Deliberately not window.prompt: the destination path and the collision check
 * are the two things that make this dialog worth having, and prompt() can show
 * neither while it blocks the event loop mid-paste.
 */
export default function ImageNameDialog(props: {
  request: ImageNameRequest;
  onConfirm: (result: ImageNameResult) => void;
  onCancel: () => void;
}) {
  const [name, setName] = createSignal(props.request.suggestion);
  const [overwrite, setOverwrite] = createSignal(false);
  let input: HTMLInputElement | undefined;

  const fileName = () => name().trim() + props.request.ext;
  const collides = createMemo(() =>
    props.request.existing.some(
      (f) => f.toLowerCase() === fileName().toLowerCase(),
    ),
  );
  const valid = () =>
    /^[a-z0-9][a-z0-9._-]*$/.test(name().trim().toLowerCase()) &&
    (!collides() || overwrite());

  function confirm() {
    if (!valid()) return;
    props.onConfirm({
      name: name().trim().toLowerCase(),
      overwrite: overwrite(),
    });
  }

  onMount(() => {
    input?.focus();
    input?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && props.onCancel()}>
      <div class="modal">
        <h2>이미지 이름</h2>
        <img class="modal-thumb" src={props.request.preview} alt="" />

        <div class="modal-input">
          <input
            ref={input}
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
          />
          <span class="ext">{props.request.ext}</span>
        </div>

        <p class="modal-dest">
          → <code>{props.request.dir}/{fileName()}</code>
        </p>
        <p class="modal-dest dim">
          본문에는 <code>![](./{fileName()})</code> 로 들어갑니다.
        </p>

        <Show when={collides()}>
          <label class="fm-check warnish">
            <input
              type="checkbox"
              checked={overwrite()}
              onChange={(e) => setOverwrite(e.currentTarget.checked)}
            />
            이미 있는 이름입니다 — 덮어쓰기
          </label>
        </Show>

        <Show when={name().trim() !== "" && !/^[a-z0-9][a-z0-9._-]*$/.test(name().trim().toLowerCase())}>
          <p class="modal-dest bad">
            영소문자·숫자·하이픈·밑줄만 쓸 수 있습니다.
          </p>
        </Show>

        <div class="toolbar" style={{ "margin-bottom": 0 }}>
          <button class="primary" onClick={confirm} disabled={!valid()}>
            넣기
          </button>
          <button onClick={props.onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
}
