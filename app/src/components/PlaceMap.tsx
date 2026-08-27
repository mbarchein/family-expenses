import { useEffect, useRef, useState } from 'react'
import { T } from '../i18n/strings'
import { metresBetween, TOLERANCE_METRES } from '../lib/geo'
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
 * the privacy policy, the first lines of the Sitios screen, and the rule in
 * `CLAUDE.md`.
 *
 * What survives from the old drawing is the part that was useful, now on top of
 * something meaningful: the ring is what the device admits it does not know, the
 * dashed circle is the fifteen metres inside which two places count as the same
 * one, and a ring wider than the dashes is a fix too vague to match a doorway.
 * On a street map those become "half the block" instead of "0.7 of a square".
 *
 * Two things it still does not do. It asks for nothing until the switch that says
 * it will save where you are has been turned on — so somebody who never saves a
 * place never reaches a tile server. And the coordinate still never goes to our
 * backend, is still not written to the spreadsheet, and there is still no column
 * for it.
 *
 * No mapping library: the tiles are `<img>` elements laid out from the same Web
 * Mercator arithmetic the servers are keyed by, which is thirty lines and no
 * dependency, and there is nothing here to pan or zoom — it is a picture of one
 * spot, opened for a couple of seconds on the way to saving an expense.
 */

/** Tiles are 256 pixels square, which is what all the arithmetic below assumes. */
const TILE = 256
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

/** Metres to a pixel, at a latitude and a zoom. Shrinks away from the equator:
 *  a tile covers less ground in Granada than it does in Quito. */
function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

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

/** Fractional tile coordinates — the Web Mercator maths every XYZ tile server is
 *  keyed by. The whole part names the tile, the fraction is where inside it. */
function tileOf(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom
  const rad = (lat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  }
}

/** A round number of metres whose bar is comfortably readable at this scale. */
function scaleBar(metresPerPx: number): { metres: number; pixels: number } {
  for (const metres of [10, 20, 50, 100, 200, 500, 1000]) {
    const pixels = metres / metresPerPx
    if (pixels >= 44) return { metres, pixels }
  }
  return { metres: 1000, pixels: 1000 / metresPerPx }
}

export function PlaceMap({ fix, nearby, improving }: {
  fix: Fix
  /** The saved places, already measured against this fix by the store. */
  nearby: NearPlace[]
  /** True while the watch is still running and the fix might get better. */
  improving: boolean
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

  const shown = nearby.slice(0, 4)
  const bar = scaleBar(metresPerPx)

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-ink-2">{T.places.mapLabel}</p>
      <div
        ref={box}
        className="relative overflow-hidden rounded-xl border border-line"
        style={{ height: HEIGHT, background: 'var(--surface-2)' }}
      >
        <div className="absolute inset-0" role="img" aria-label={T.places.mapLabel}>
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
          <span
            className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full
                       ring-2 ring-white"
            style={{ left: '50%', top: '50%', background: 'var(--accent)' }}
          />

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
        {improving ? T.places.mapImproving : T.places.mapSteady}
        {' · '}
        {T.places.accuracy(Math.round(fix.accuracy))}
      </p>
    </div>
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
