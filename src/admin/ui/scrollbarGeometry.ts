export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface Thumb {
  size: number;
  offset: number;
}

/** Short enough to stay out of the way, long enough to grab. */
export const MIN_THUMB = 32;

function scrollRange({ scrollHeight, clientHeight }: ScrollMetrics): number {
  return Math.max(0, scrollHeight - clientHeight);
}

export function thumbOf(metrics: ScrollMetrics, track: number): Thumb | null {
  const range = scrollRange(metrics);
  if (range < 1 || track <= 0) return null;
  const size = Math.min(track, Math.max(MIN_THUMB, (metrics.clientHeight / metrics.scrollHeight) * track));
  const ratio = Math.min(1, Math.max(0, metrics.scrollTop / range));
  return { size, offset: ratio * (track - size) };
}

/** Where a thumb dragged by `delta` pixels from `startScrollTop` puts the content. */
export function scrollTopAfterDrag(
  delta: number,
  startScrollTop: number,
  metrics: ScrollMetrics,
  track: number,
): number {
  const thumb = thumbOf({ ...metrics, scrollTop: startScrollTop }, track);
  const range = scrollRange(metrics);
  if (thumb === null || track === thumb.size) return startScrollTop;
  const next = startScrollTop + (delta * range) / (track - thumb.size);
  return Math.min(range, Math.max(0, next));
}
