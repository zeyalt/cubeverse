/**
 * Official WCA event icon (from @cubing/icons), rendered as a webfont glyph.
 *
 * Our DB event IDs (333, 222, pyram, 333oh, clock, minx, sq1, …) match the
 * icon set's event class names directly, so no mapping is needed. The glyph
 * inherits `font-size` and `color`, so size/theme it via `className`
 * (e.g. "text-base text-white/70").
 */
export function EventIcon({
  event,
  className,
}: {
  event: string;
  className?: string;
}) {
  return (
    <i
      className={`cubing-icon event-${event}${className ? ` ${className}` : ""}`}
      aria-hidden
    />
  );
}
