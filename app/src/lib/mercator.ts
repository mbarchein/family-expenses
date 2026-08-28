import type { Fix } from './position'

/**
 * The Web Mercator arithmetic every XYZ tile server is keyed by.
 *
 * Thirty lines instead of a mapping library, which is the same trade the map
 * itself makes — see `components/PlaceMap`. It lives here rather than in that
 * component because the map can be dragged now, and a sign error in the drag is
 * a bug that moves somebody's doorway quietly in the wrong direction. Here it is
 * three pure functions with a round trip a test can check.
 */

/** Tiles are 256 pixels square, which is what all of this assumes. */
export const TILE = 256

/** Metres to a pixel, at a latitude and a zoom. Shrinks away from the equator:
 *  a tile covers less ground in Granada than it does in Quito. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

/** Fractional tile coordinates. The whole part names the tile, the fraction is
 *  where inside it. */
export function tileOf(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom
  const rad = (lat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  }
}

/** The way back: a point on the ground from fractional tile coordinates. */
export function pointOf(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const n = 2 ** zoom
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI,
    lon: (x / n) * 360 - 180,
  }
}

/**
 * Where a fix ends up after the map under it is dragged by so many pixels.
 *
 * Dragging the map to the right pulls the world east under a centre that does
 * not move, so the point the centre names goes *west* — hence the subtraction,
 * which is the sign this whole file exists to keep honest. Down the screen works
 * out the same way and is the one that reads wrong at first: dragging downwards
 * brings what was above the centre into it, so the point goes north. Screen y and
 * tile y both grow downwards, which is why one subtraction covers both.
 *
 * The accuracy comes along untouched: how sure the device was of this fix is not
 * changed by somebody moving the map, and whoever calls this decides what the
 * number means once the point has been placed by hand.
 */
export function panned(fix: Fix, dx: number, dy: number, zoom: number): Fix {
  const centre = tileOf(fix.lat, fix.lon, zoom)
  const moved = pointOf(centre.x - dx / TILE, centre.y - dy / TILE, zoom)
  return { ...moved, accuracy: fix.accuracy }
}
