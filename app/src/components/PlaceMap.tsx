import { T } from '../i18n/strings'
import { metresBetween, TOLERANCE_METRES } from '../lib/geo'
import type { Fix } from '../lib/position'
import type { NearPlace } from '../store/places'

/**
 * Where the phone thinks it is, drawn rather than fetched.
 *
 * Deliberately not a map. A map means tiles, and tiles mean asking a server for
 * the images around a coordinate — which tells that server roughly where this
 * phone is, every time the third step is opened. Section 13 of the privacy
 * policy and the Sitios screen both promise the opposite in as many words, so
 * the choice here is not between a nicer map and a worse one: it is between a
 * drawing and breaking a published promise.
 *
 * What it shows instead is the thing the coordinate is actually for. The dot is
 * the phone. The ring around it is what the device admits it does not know, drawn
 * to the same scale as everything else, so a ±40 m fix looks like ±40 m. The
 * dashed circle is the fifteen metres inside which two places count as the same
 * one — when the ring is bigger than the dashes, the fix is too vague to match a
 * doorway reliably, and that is visible instead of being a number to interpret.
 * The saved places nearby are dots with their distance.
 *
 * All of it from coordinates the phone already has, and none of it leaves.
 */

/** The drawing is 240×240 units of viewBox, and the scale adapts: whatever is
 *  furthest — the accuracy ring, the nearest places, the tolerance circle —
 *  decides how many metres a unit is worth. */
const SIZE = 240
const CENTRE = SIZE / 2
const PADDING = 18

export function PlaceMap({ fix, nearby, improving }: {
  fix: Fix
  /** The saved places, already measured against this fix by the store. */
  nearby: NearPlace[]
  /** True while the watch is still running and the fix might get better. */
  improving: boolean
}) {
  const shown = nearby.slice(0, 4)
  // The radius the drawing has to cover, in metres. Never smaller than the
  // tolerance: a very sure fix would otherwise fill the whole square with its
  // own ring and say nothing about how sure it is.
  const reach = Math.max(
    fix.accuracy,
    TOLERANCE_METRES * 1.6,
    ...shown.map(place => metresBetween(fix, place)),
  )
  const scale = (CENTRE - PADDING) / reach

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-ink-2">{T.places.mapLabel}</p>
      <div
        className="relative overflow-hidden rounded-xl border border-line"
        style={{ background: 'var(--surface)' }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="block h-40 w-full"
          role="img"
          aria-label={T.places.mapLabel}
        >
          {/* The fifteen metres inside which two places are the same place.
              Dashed, because it is a rule rather than a measurement. */}
          <circle
            cx={CENTRE} cy={CENTRE} r={TOLERANCE_METRES * scale}
            fill="none" stroke="var(--accent)" strokeWidth="1"
            strokeDasharray="3 3" opacity="0.5"
          />
          {/* What the device admits it does not know. */}
          <circle
            cx={CENTRE} cy={CENTRE} r={fix.accuracy * scale}
            fill="var(--accent)" fillOpacity="0.1"
            stroke="var(--accent)" strokeWidth="1" opacity="0.7"
          />
          <circle cx={CENTRE} cy={CENTRE} r="4" fill="var(--accent)" />

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
              <g key={place.id}>
                <circle
                  cx={CENTRE + east * scale}
                  cy={CENTRE - north * scale}
                  r="3.5"
                  fill="var(--ink-3)"
                />
                <text
                  x={CENTRE + east * scale}
                  y={CENTRE - north * scale - 7}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ fontSize: '9px' }}
                >
                  {place.concept}
                </text>
              </g>
            )
          })}
        </svg>

        {/* The scale bar, so the circles are metres and not decoration. */}
        <span
          className="tabular absolute bottom-1.5 right-2 font-mono text-[10px] text-ink-3"
        >
          {T.places.mapScale(Math.round(reach))}
        </span>
      </div>
      <p className="text-[11px] text-ink-3">
        {improving ? T.places.mapImproving : T.places.mapSteady}
        {' · '}
        {T.places.accuracy(Math.round(fix.accuracy))}
      </p>
    </div>
  )
}
