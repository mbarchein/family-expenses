/**
 * The icon set, drawn here.
 *
 * One family, one weight, one colour — `currentColor`, so a tile that inverts
 * on selection inverts its icon with it. That is the thing emoji could not do:
 * they arrive in whatever style the platform ships, they cannot be recoloured,
 * and the same concept looks like a different app on Android and on iOS.
 *
 * Drawn rather than loaded from an icon font. A font would be a request to a
 * host this app does not otherwise talk to, on a screen that has to work in a
 * supermarket basement — and until it arrived every tile would show a blank or
 * a tofu box. What is needed here is two dozen shapes; as paths they are a few
 * hundred bytes inside a bundle that is already precached, with nothing to load
 * and nothing to fail.
 *
 * Simple on purpose. These are read at 24 pixels by somebody standing at a till,
 * so each one is circles, rectangles and straight lines: a shape that survives
 * being small beats a detailed one that turns to mush.
 */

export const ICONS = {
  cesta: <><path d="M4 8h16l-1.6 10.5a2 2 0 0 1-2 1.5H7.6a2 2 0 0 1-2-1.5L4 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  salud: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></>,
  coche: <><path d="M4 16v-2.2l1.8-4.3A2 2 0 0 1 7.6 8h8.8a2 2 0 0 1 1.8 1.2L20 13.8V16" /><path d="M4 16h16" /><circle cx="7.5" cy="17.5" r="1.6" /><circle cx="16.5" cy="17.5" r="1.6" /></>,
  combustible: <><rect x="5" y="4" width="9" height="16" rx="2" /><path d="M14 9h2.5a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0v-6l-2-3" /><path d="M7.5 8h4" /></>,
  bombilla: <><path d="M9 17a5.5 5.5 0 1 1 6 0v1.5H9V17Z" /><path d="M10 21h4" /></>,
  gota: <><path d="M12 3.5s6 6.4 6 10.2A6 6 0 0 1 6 13.7C6 9.9 12 3.5 12 3.5Z" /></>,
  llama: <><path d="M12 3.5c3 3.6 5.5 6 5.5 9.4a5.5 5.5 0 0 1-11 0c0-2 1-3.4 2.4-4.7.3 1.3 1 2 2 2 .6-2.6-.4-4.6 1.1-6.7Z" /></>,
  senal: <><path d="M5 19v-3M10 19v-7M15 19v-11M20 19v-15" /></>,
  casa: <><path d="M4 11 12 4l8 7" /><path d="M6 10.5V20h12v-9.5" /><path d="M10 20v-5h4v5" /></>,
  escudo: <><path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6l-7-2.5Z" /></>,
  // A fork and a knife rather than the plate this was: a plate seen from above
  // is two concentric circles, and two concentric circles at 24 px are a target,
  // a doughnut or a button — anything but lunch. Cutlery is the sign everybody
  // already reads, and it is straight lines.
  cubiertos: <><path d="M5 3.5v5a2 2 0 0 0 4 0v-5" /><path d="M7 3.5v5" /><path d="M7 10.5v10" /><path d="M16.5 20.5v-9" /><path d="M16.5 11.5V3.5l2 3.2a3 3 0 0 1-2 4.8Z" /></>,
  // A loaf from the side: a domed top on a flat base, with the three cuts a
  // baker's blade leaves. Two cuts were drawn first and rendered at 24, 48 and
  // 96 pixels next to the car, which is the same dome over the same straight
  // line: at 24 they were hard to tell apart. Three longer cuts make the inside
  // of the shape the thing that identifies it, which is what survives being
  // small.
  pan: <><path d="M3.5 14a5.5 5.5 0 0 1 5.5-5.5h6a5.5 5.5 0 0 1 5.5 5.5v2.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V14Z" /><path d="M9.2 9.4 7.4 14M12.6 9.1 10.8 14M16 9.4 14.2 14" /></>,
  taza: <><path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" /><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M4 21h13" /></>,
  camiseta: <><path d="M9 4 4.5 6.5 6 10l2-1v11h8V9l2 1 1.5-3.5L15 4a4 4 0 0 1-6 0Z" /></>,
  regalo: <><rect x="3.5" y="8.5" width="17" height="11.5" rx="1.5" /><path d="M3.5 12.5h17M12 8.5V20" /><path d="M12 8.5S10.5 4 8 4a2 2 0 0 0 0 4.5M12 8.5S13.5 4 16 4a2 2 0 0 1 0 4.5" /></>,
  libro: <><path d="M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z" /><path d="M17 7.5h2V20" /></>,
  maleta: <><rect x="3.5" y="8" width="17" height="11" rx="2" /><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /><path d="M8 19v1.5M16 19v1.5" /></>,
  bus: <><rect x="4.5" y="4.5" width="15" height="12.5" rx="2.5" /><path d="M4.5 11h15" /><path d="M8 17v2.5M16 17v2.5" /><circle cx="8.5" cy="14" r="1" /><circle cx="15.5" cy="14" r="1" /></>,
  huella: <><circle cx="7" cy="10" r="2" /><circle cx="11.5" cy="7.5" r="2" /><circle cx="16.5" cy="9" r="2" /><path d="M12 12c3.5 0 5.5 2.4 5.5 4.6 0 1.9-1.7 2.9-3.4 2.4-1.4-.4-2.9-.4-4.3 0-1.7.5-3.3-.5-3.3-2.4C6.5 14.4 8.5 12 12 12Z" /></>,
  herramienta: <><path d="M15.5 4a5 5 0 0 0-4.2 7.6L4 19l1.4 1.4 7.4-7.3A5 5 0 0 0 20 8.5l-3 1.3-2.3-2.3L15.5 4Z" /></>,
  recibo: <><path d="M6 3.5h9l3.5 3.5v13.5H6V3.5Z" /><path d="M14.5 3.5V7h4" /><path d="M9 12h6M9 15.5h6" /></>,
  banco: <><path d="M3.5 9 12 4l8.5 5" /><path d="M6 9v8M12 9v8M18 9v8" /><path d="M4 20h16" /></>,
  entrada: <><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z" /><path d="M12 8.5v7" /></>,
  tijeras: <><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /><path d="M8.4 16.4 17 5M15.6 16.4 7 5" /></>,
  pesa: <><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></>,
  planta: <><path d="M12 20v-7" /><path d="M12 13c-4 0-6-2.2-6-5 3 0 6 1.6 6 5Z" /><path d="M12 13c0-3.4 2.5-5.5 6-5.5 0 3.2-2.2 5.5-6 5.5Z" /><path d="M8.5 20h7" /></>,
  biberon: <><rect x="8.5" y="8" width="7" height="12" rx="2" /><path d="M9.5 8V6h5v2" /><path d="M11 6V4h2v2" /></>,
  movil: <><rect x="7" y="3.5" width="10" height="17" rx="2.5" /><path d="M10.5 17.5h3" /></>,
}

export type IconName = keyof typeof ICONS

export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/** True for a name this set actually draws — a stored choice may name an icon
 *  that has since been renamed, and a blank tile is not an acceptable answer. */
export function isIconName(name: string): name is IconName {
  return name in ICONS
}

export function Icon({ name, className = 'h-6 w-6' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false"
      fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  )
}
