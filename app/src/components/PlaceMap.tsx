import { useEffect, useRef, useState } from 'react'
import { T } from '../i18n/strings'
import { metresBetween, TOLERANCE_METRES } from '../lib/geo'
import { TILE, metresPerPixel, panned, tileOf } from '../lib/mercator'
import type { Fix } from '../lib/position'
import type { NearPlace } from '../store/places'

/**
 * Where the phone is, on a real map.
 *
 * This used to be a drawing — a dot, two circles and the saved places, from
 * coordinates the phone already had — precisely so that no request would go out
 * carrying a position. What was reported about it is right and worth writing
 * down: the drawing only ever knew one thing, the accuracy compared against the
 * fifteen-metre tolerance, and that is a sentence rather than a picture. With no
 * saved place nearby, which is the normal case, it was two concentric circles
 * around a dot. Nothing on it was recognisable as anywhere.
 *
 * So: streets, from OpenStreetMap, decided deliberately and not by drift. The
 * cost is that asking for a tile tells openstreetmap.org roughly where this phone
 * is — the tile URL *is* the square of the world you are standing in. That is
 * written down in three places that have to move together, and did: section 13 of
 * the privacy policy, the disclosure on the Sitios screen, and the rule in
 * `CLAUDE.md`.
 *
 * What survives from the old drawing is the part that was useful, now on top of
 * something meaningful: the ring is what the device admits it does not know, the
 * dashed circle is the fifteen metres inside which two places count as the same
 * one, and a ring wider than the dashes is a fix too vague to match a doorway.
 * On a street map those become "half the block" instead of "0.7 of a square".
 *
 * Two things it still does not do. It asks for nothing until a map has been asked
 * for — the switch that says it will save where you are being turned on, or a
 * saved place being opened from Sitios — so somebody who never saves a place
 * never reaches a tile server, and nothing is requested by walking around or by
 * opening the app. And the coordinate still never goes to our backend, is still
 * not written to the spreadsheet, and there is still no column for it.
 *
 * The second occasion is the newer one, and it is the same bargain rather than a
 * wider one: what a saved place's detail asks for is the tile that place sits in,
 * which is the tile the review step already asked for on the day it was saved.
 *
 * No mapping library: the tiles are `<img>` elements laid out from the same Web
 * Mercator arithmetic the servers are keyed by — `lib/mercator.ts`, thirty lines
 * and no dependency. There is still no zoom: this is a picture of one spot at the
 * scale the accuracy asks for, not something to explore.
 *
 * It does drag, on the one screen that is choosing a position rather than showing
 * one — see `onPan`. Which is a third of a mapping library and worth exactly what
 * it costs, because a fix is sometimes wrong in a way no amount of standing still
 * will fix: the phone says the far side of the block, and the person holding it
 * can see which doorway it should be.
 */

const HEIGHT = 176
/**
 * Street level, and as far out as a very unsure fix needs.
 *
 * 17 rather than 18 for two reasons that point the same way. The box covers about
 * 165 m at 17 and 80 m at 18, and the question this map answers is "am I where I
 * think I am" — which needs the street *and* the next one along, not one doorway
 * filling the screen. And a tile at 17 is a 244 m square rather than a 122 m one,
 * so the coarsest thing that answers the question is also the least that has to
 * be said to a tile server.
 */
const MAX_ZOOM = 17
const MIN_ZOOM = 13
/** Sane ceiling on the mosaic, so a very wide window cannot turn one glance into
 *  thirty requests. */
const MAX_COLUMNS = 7
const TILES = 'https://tile.openstreetmap.org'

/**
 * The closest zoom at which the accuracy ring still fits.
 *
 * The ring is what decides, not the tolerance: at ±90 m a street-level zoom is a
 * circle larger than the box, which hides both the streets and the fact that the
 * circle is what it is.
 */
function zoomFor(fix: Fix): number {
  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom--) {
    if ((fix.accuracy * 2.4) / metresPerPixel(fix.lat, zoom) <= HEIGHT) return zoom
  }
  return MIN_ZOOM
}

/** A round number of metres whose bar is comfortably readable at this scale. */
function scaleBar(metresPerPx: number): { metres: number; pixels: number } {
  for (const metres of [10, 20, 50, 100, 200, 500, 1000]) {
    const pixels = metres / metresPerPx
    if (pixels >= 44) return { metres, pixels }
  }
  return { metres: 1000, pixels: 1000 / metresPerPx }
}

export function PlaceMap({
  fix, nearby, improving = false, label = T.places.mapLabel, note, centreLabel, onPan,
}: {
  /**
   * The centre, and the accuracy the ring is drawn from.
   *
   * Two things are a `Fix`: where the phone is right now, on the review step, and
   * the fix a saved place was written with, on its own detail. The map is the
   * same either way — a spot, its accuracy, and what else is saved around it —
   * and the two callers differ only in the words above and below the box.
   */
  fix: Fix
  /** The saved places, already measured against this fix by the caller. The
   *  first one is drawn over the centre when it *is* the centre. */
  nearby: NearPlace[]
  /** True while the watch is still running and the fix might get better. Never
   *  true for a fix read back off the disk, which is as good as it will get. */
  improving?: boolean
  /** The line over the box. Defaults to "where you are"; a saved place says
   *  where it was saved instead. */
  label?: string
  /** The line under it, in place of the "still improving" note. The accuracy is
   *  appended either way: it is what the ring means. */
  note?: string
  /**
   * A name for the centre itself, drawn under the dot.
   *
   * Under rather than over, which is where the neighbours' labels go: on a saved
   * place's map the centre *is* one of the places, and a label above the dot sat
   * on top of it and hid the thing it was naming.
   */
  centreLabel?: string
  /**
   * Makes the map draggable, and reports the point the centre lands on.
   *
   * Set only by the screen that is choosing a position rather than showing one.
   * Every move reports a new fix and the caller hands it straight back as `fix`,
   * so this component keeps no position of its own to disagree with — the same
   * discipline as the wizard keeping its step in the URL rather than in two
   * places.
   *
   * Panning asks for the tiles you pan over, which is what panning is and is the
   * same bargain the map already makes: squares of the world, never the point.
   * What it must not turn into is a way to look around from a map somebody opened
   * to read, which is why it is a prop and not the default.
   */
  onPan?: (fix: Fix) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)

  // Measured for one reason: how many tiles wide the mosaic has to be. Everything
  // drawn on top is positioned from the centre of the box, which is where the fix
  // is by construction and needs no measurement at all.
  useEffect(() => {
    const node = box.current
    if (!node) return
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width
      if (measured) setWidth(measured)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const zoom = zoomFor(fix)
  const metresPerPx = metresPerPixel(fix.lat, zoom)
  const centre = tileOf(fix.lat, fix.lon, zoom)
  const limit = 2 ** zoom

  // Two spare columns and two spare rows, because the fix can sit anywhere inside
  // its own tile and the box is centred on it rather than on the tile.
  const columns = Math.min(MAX_COLUMNS, Math.ceil(width / TILE) + 2)
  const rows = Math.ceil(HEIGHT / TILE) + 2
  const first = { x: Math.floor(centre.x) - (columns >> 1), y: Math.floor(centre.y) - (rows >> 1) }

  /**
   * The drag, in the map's own pixels.
   *
   * Reported on every move rather than on release, so the streets follow the
   * thumb instead of jumping when it lifts. Pointer events rather than touch
   * ones: a finger, a mouse and a stylus are the same three handlers, and the
   * capture is what stops a fast drag being dropped the moment it leaves the box.
   */
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!onPan) return
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const held = drag.current
    if (!onPan || !held || held.pointer !== event.pointerId) return
    const dx = event.clientX - held.x
    const dy = event.clientY - held.y
    if (!dx && !dy) return
    drag.current = { ...held, x: event.clientX, y: event.clientY }
    onPan(panned(fix, dx, dy, zoom))
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const shown = nearby.slice(0, 4)
  const bar = scaleBar(metresPerPx)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-ink-2">{label}</p>
      <div
        ref={box}
        className={'relative overflow-hidden rounded-xl border border-line'
          + (onPan ? ' cursor-grab active:cursor-grabbing' : '')}
        style={{
          height: HEIGHT,
          background: 'var(--surface-2)',
          // Or the browser claims the gesture for scrolling the screen and the
          // map moves once, by whatever was left over.
          touchAction: onPan ? 'none' : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="absolute inset-0" role="img" aria-label={label}>
          {/* The tiles. `--map-tint` is `none` in daylight and an inversion in the
              dark palette: the standard OpenStreetMap style is a white sheet of
              paper, and a white sheet of paper at night is a torch. */}
          {width > 0 && !failed && Array.from({ length: columns * rows }, (_, index) => {
            const x = first.x + (index % columns)
            const y = first.y + Math.floor(index / columns)
            // Off the top or bottom of the world, or past the date line. Nothing
            // to ask for, and asking would be a 404 on somebody else's server.
            if (y < 0 || y >= limit || x < 0 || x >= limit) return null
            return (
              <img
                key={`${x}:${y}`}
                src={`${TILES}/${zoom}/${x}/${y}.png`}
                alt=""
                aria-hidden="true"
                draggable={false}
                width={TILE}
                height={TILE}
                onError={() => setFailed(true)}
                className="pointer-events-none absolute select-none"
                style={{
                  left: `calc(50% + ${(x - centre.x) * TILE}px)`,
                  top: `calc(50% + ${(y - centre.y) * TILE}px)`,
                  filter: 'var(--map-tint)',
                }}
              />
            )
          })}

          {/* The fifteen metres inside which two places are the same place.
              Dashed, because it is a rule rather than a measurement. */}
          <Ring radius={TOLERANCE_METRES / metresPerPx} dashed />
          {/* What the device admits it does not know. */}
          <Ring radius={fix.accuracy / metresPerPx} />
          {/* The centre. A dot when the map is reporting where something is, and
              a sight when it is being aimed: what moves under a drag is the map,
              so the marker has to read as the crosshair rather than as the
              subject. */}
          {onPan ? <Crosshair /> : (
            <span
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full
                         ring-2 ring-white"
              style={{ left: '50%', top: '50%', background: 'var(--accent)' }}
            />
          )}
          {centreLabel && (
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap rounded px-1 py-px
                         text-[10px] font-semibold"
              style={{
                left: '50%',
                top: 'calc(50% + 10px)',
                background: 'var(--paper)',
                color: 'var(--ink-2)',
                border: '1px solid var(--line)',
              }}
            >
              {centreLabel}
            </span>
          )}

          {shown.map(place => {
            // North is up. A degree of longitude is shorter than one of latitude
            // away from the equator, and `metresBetween` already knows it, so the
            // offsets are metres taken from that same maths rather than raw
            // degrees — otherwise everything would lean east.
            const east = metresBetween(fix, { lat: fix.lat, lon: place.lon })
              * (place.lon >= fix.lon ? 1 : -1)
            const north = metresBetween(fix, { lat: place.lat, lon: fix.lon })
              * (place.lat >= fix.lat ? 1 : -1)
            return (
              <span
                key={place.id}
                className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded
                           px-1 py-px text-[10px] font-semibold"
                style={{
                  left: `calc(50% + ${(east / metresPerPx).toFixed(1)}px)`,
                  top: `calc(50% - ${(north / metresPerPx).toFixed(1)}px)`,
                  background: 'var(--paper)',
                  color: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                }}
              >
                {place.concept}
              </span>
            )
          })}
        </div>

        {/* Offline, or a tile server having a bad day. The rings and the places
            are still drawn on the blank: they are ours and they still mean what
            they meant before there was a map under them. */}
        {failed && (
          <p className="absolute inset-x-0 top-2 px-3 text-center text-[11px] text-ink-3">
            {T.places.mapFailed}
          </p>
        )}

        {/* The scale, so the two rings are metres rather than decoration. On its
            own backing, like the credit: over a street map, unbacked grey text is
            legible until it lands on a road. */}
        <span
          className="absolute bottom-1 left-1 flex items-center gap-1 rounded px-1 py-0.5"
          style={{ background: 'color-mix(in srgb, var(--paper) 82%, transparent)' }}
        >
          <span
            className="block h-1.5 border-x border-b"
            style={{ width: bar.pixels, borderColor: 'var(--ink-2)' }}
          />
          <span className="tabular font-mono text-[10px] text-ink-2">
            {T.places.mapScale(bar.metres)}
          </span>
        </span>

        {/* Required, and it is also the disclosure: whoever drew these streets
            is who was asked for them. */}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-0 right-0 rounded-tl px-1.5 py-0.5 text-[10px] text-ink-2
                     underline focus-visible:outline focus-visible:outline-2"
          style={{ background: 'var(--paper)' }}
        >
          {T.places.mapCredit}
        </a>
      </div>
      <p className="text-[11px] text-ink-3">
        {note ?? (improving ? T.places.mapImproving : T.places.mapSteady)}
        {' · '}
        {T.places.accuracy(Math.round(fix.accuracy))}
      </p>
    </div>
  )
}

/** The sight, while a position is being aimed at. A hole in the middle, so the
 *  doorway under it is not hidden by the thing pointing at it, and a white
 *  underlay on every stroke because these streets are printed in every colour. */
function Crosshair() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: '50%', top: '50%' }}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="var(--accent)"
           strokeWidth={2} strokeLinecap="round">
        <circle cx="16" cy="16" r="7" stroke="white" strokeWidth={4} />
        <path d="M16 1v7M16 24v7M1 16h7M24 16h7" stroke="white" strokeWidth={4} />
        <circle cx="16" cy="16" r="7" />
        <path d="M16 1v7M16 24v7M1 16h7M24 16h7" />
      </svg>
    </span>
  )
}

/** A circle centred on the fix, sized in pixels. A div rather than SVG: the
 *  overlay is positioned in the box's own pixels, and `border-radius` needs no
 *  viewBox to agree with them. */
function Ring({ radius, dashed = false }: { radius: number; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: '50%',
        top: '50%',
        width: radius * 2,
        height: radius * 2,
        border: `1px ${dashed ? 'dashed' : 'solid'} var(--accent)`,
        background: dashed ? undefined : 'color-mix(in srgb, var(--accent) 12%, transparent)',
        opacity: dashed ? 0.75 : 0.85,
      }}
    />
  )
}
