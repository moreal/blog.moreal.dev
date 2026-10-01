import { Show, createEffect, createSignal, onCleanup } from "solid-js";
import { type ScrollMetrics, type Thumb, scrollTopAfterDrag, thumbOf } from "./scrollbarGeometry.ts";

const LINGER_MS = 900;

function metricsOf({ scrollTop, scrollHeight, clientHeight }: HTMLElement): ScrollMetrics {
  return { scrollTop, scrollHeight, clientHeight };
}

/**
 * Drawn over the writing surface instead of the browser's own bar, which
 * takes width from the centered column and shifts it whenever the document
 * grows past one screen.  Wheel, keyboard and touch scrolling stay native.
 */
export default function OverlayScrollbar(props: { target: () => HTMLElement | undefined }) {
  let track: HTMLDivElement | undefined;
  const [thumb, setThumb] = createSignal<Thumb | null>(null);
  const [scrolling, setScrolling] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);

  createEffect(() => {
    const el = props.target();
    if (el === undefined) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setThumb(thumbOf(metricsOf(el), track?.clientHeight ?? 0)));
    };

    let linger: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      measure();
      setScrolling(true);
      clearTimeout(linger);
      linger = setTimeout(() => setScrolling(false), LINGER_MS);
    };

    const resize = new ResizeObserver(measure);
    resize.observe(el);
    for (const child of el.children) resize.observe(child);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("input", measure);
    measure();

    onCleanup(() => {
      cancelAnimationFrame(frame);
      clearTimeout(linger);
      resize.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("input", measure);
    });
  });

  function startDrag(event: PointerEvent) {
    const el = props.target();
    if (el === undefined || track === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const start = metricsOf(el);
    const trackHeight = track.clientHeight;
    setDragging(true);

    const move = (e: PointerEvent) => {
      el.scrollTop = scrollTopAfterDrag(e.clientY - startY, start.scrollTop, start, trackHeight);
    };
    const end = () => {
      setDragging(false);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  function pageTowards(event: PointerEvent) {
    const el = props.target();
    const current = thumb();
    if (el === undefined || track === undefined || current === null) return;
    const y = event.clientY - track.getBoundingClientRect().top;
    const direction = y < current.offset ? -1 : 1;
    el.scrollBy({ top: direction * el.clientHeight * 0.9, behavior: "smooth" });
  }

  return (
    <div
      ref={track}
      class="overlay-scrollbar"
      classList={{ active: scrolling() || dragging(), dragging: dragging() }}
      aria-hidden="true"
      onPointerDown={pageTowards}
    >
      <Show when={thumb()}>
        {(current) => (
          <div
            class="overlay-scrollbar-thumb"
            style={{
              height: `${current().size}px`,
              transform: `translateY(${current().offset}px)`,
            }}
            onPointerDown={startDrag}
          />
        )}
      </Show>
    </div>
  );
}
