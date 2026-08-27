/**
 * A ring with a quarter missing, going round.
 *
 * Borders rather than an SVG: three classes, no file, and it inherits the colour
 * of the text beside it. `motion-reduce` stops it turning for anyone who has asked
 * the phone for that — a still ring is still a marker, and somebody who has
 * switched animation off has not asked to be told less.
 *
 * Shared because it now marks two different waits: the queue going up, above the
 * tab bar, and a button that has been pressed and is talking to the sheet.
 */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} shrink-0 animate-spin rounded-full border-2 border-current
                  border-t-transparent motion-reduce:animate-none`}
    />
  )
}
