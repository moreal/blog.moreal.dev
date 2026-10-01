import { For, Show } from "solid-js";
import type { Heading } from "./outline.ts";

/**
 * Floats in the left margin of the writing surface.  Where the margin is too
 * narrow for titles it shrinks to one short bar per heading and opens over the
 * text on hover or keyboard focus.
 */
export default function Outline(props: {
  headings: Heading[];
  active: number;
  onPick: (line: number) => void;
}) {
  return (
    <Show when={props.headings.length > 1}>
      <nav class="outline" aria-label="목차">
        <ol>
          <For each={props.headings}>
            {(heading, index) => (
              <li class={`outline-h${heading.level}`} classList={{ active: index() === props.active }}>
                <button
                  type="button"
                  title={heading.text}
                  aria-current={index() === props.active ? "location" : undefined}
                  onClick={() => props.onPick(heading.line)}
                >
                  <span class="outline-bar" aria-hidden="true" />
                  <span class="outline-text">{heading.text}</span>
                </button>
              </li>
            )}
          </For>
        </ol>
      </nav>
    </Show>
  );
}
