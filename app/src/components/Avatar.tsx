import type { CSSProperties, ReactNode } from 'react'

/**
 * The faces, for the two buttons that say who paid.
 *
 * Eight of them, traced down to a few lines from painted portraits — and no
 * opinion about which belongs to whom: the pair is chosen on each phone, from
 * the icons menu, and either person can wear any of these. That is why there are
 * eight rather than two.
 *
 * Faces only, with nothing under them. An earlier set had a head over a pair of
 * shoulders, and at button size that is a dark blob with a circle on top — the
 * same blob eight times, with the part that has to be recognised squeezed into
 * the top third of it.
 *
 * What survives being traced is never the painting. It is the one or two marks
 * that only that portrait has: a joined eyebrow, an open oval of a mouth, a
 * pearl, a beard that comes to a point. So each of these is a face shape plus
 * the two or three lines that name it, and nothing else — at twenty pixels on a
 * phone in a queue, a fourth line is mud.
 */

export const AVATARS = {
  /** La Gioconda: the long centre-parted hair either side of the jaw, and the
   *  smile that is barely a curve. */
  monalisa: <>
    <path d="M12 2.8c3.2 0 5.6 2.8 5.6 6.6 0 5-2.5 9.4-5.6 9.4S6.4 14.4 6.4 9.4C6.4 5.6 8.8 2.8 12 2.8Z" />
    <path d="M6.5 7.2C5 10.4 4.6 15.4 5.4 20.4M17.5 7.2c1.5 3.2 1.9 8.2 1.1 13.2" />
    <path d="M10.2 14.6c1.1.6 2.5.6 3.6 0" />
  </>,
  /** La joven de la perla: the cloth over the head and down the back of it, and
   *  the pearl. The wrap was drawn against the side of the face first and read
   *  as an ear with a handle on it. */
  pearl: <>
    <path d="M12 4.8c3 0 5.2 2.6 5.2 6.2 0 4.6-2.3 8.4-5.2 8.4s-5.2-3.8-5.2-8.4c0-3.6 2.2-6.2 5.2-6.2Z" />
    <path d="M6.2 10C6 5.2 8.6 2.4 12 2.4s6 2.8 5.8 7.6" />
    <path d="M6.4 8.6C4.6 11 4.4 14 5.8 16.6" />
    <circle cx="15.6" cy="16.6" r="1.3" />
  </>,
  /** Van Gogh: the beard, drawn wider and lower than the face so that the
   *  outline itself is bearded. Inside the jaw it closed the oval and read as a
   *  bowl; sharing the oval's radius, it merged into the oval. */
  vangogh: <>
    <path d="M12 3.6c3 0 5.2 2.6 5.2 6.2 0 4.4-2.3 8-5.2 8s-5.2-3.6-5.2-8c0-3.6 2.2-6.2 5.2-6.2Z" />
    <path d="M5.6 9.8c0 6 2.9 9.6 6.4 9.6s6.4-3.6 6.4-9.6" />
    <path d="M10.3 12.4c1.1-.4 2.3-.4 3.4 0" />
  </>,
  /** Frida: the eyebrow that crosses, and the flowers above the parting. */
  frida: <>
    <path d="M12 4.4c3.2 0 5.6 2.6 5.6 6.4 0 5-2.5 9-5.6 9s-5.6-4-5.6-9c0-3.8 2.4-6.4 5.6-6.4Z" />
    <path d="M8.4 10.4c1.2-.9 2.3-.9 3.6 0 1.3-.9 2.4-.9 3.6 0" />
    <circle cx="8.6" cy="4.6" r="1.5" /><circle cx="12" cy="3.4" r="1.5" />
    <circle cx="15.4" cy="4.6" r="1.5" />
  </>,
  /** El grito: the long skull, the hollow eyes, the open mouth. */
  scream: <>
    <path d="M12 2.8c3 0 5 2.6 5 6.4 0 6-2.2 11.6-5 11.6S7 15.2 7 9.2c0-3.8 2-6.4 5-6.4Z" />
    <ellipse cx="10" cy="9.4" rx="1.1" ry="1.6" />
    <ellipse cx="14" cy="9.4" rx="1.1" ry="1.6" />
    <ellipse cx="12" cy="15.4" rx="1.6" ry="2.4" />
  </>,
  /** El caballero de la mano en el pecho: the moustache, and the beard that
   *  comes to a point. */
  knight: <>
    <path d="M12 3.2c3.2 0 5.6 2.8 5.6 6.6 0 4.4-2.5 8-5.6 8S6.4 14.2 6.4 9.8C6.4 6 8.8 3.2 12 3.2Z" />
    <path d="M10 12.4c1.4-.7 2.6-.7 4 0" />
    <path d="M9.4 14.4c.5 4 1.6 6.6 2.6 7.8 1-1.2 2.1-3.8 2.6-7.8" />
  </>,
  /** La infanta Margarita: the hair out to both sides, and the bow in it. */
  menina: <>
    <path d="M12 5c3 0 5.2 2.6 5.2 6.2 0 4.6-2.3 8.4-5.2 8.4s-5.2-3.8-5.2-8.4C6.8 7.6 9 5 12 5Z" />
    <path d="M7 9.2C4.4 8.6 2.6 10 2.8 12.6 3 15 4.6 16.4 6.6 16M17 9.2c2.6-.6 4.4.8 4.2 3.4-.2 2.4-1.8 3.8-3.8 3.4" />
    <path d="M9.4 5.4c.8-1.6 4.4-1.6 5.2 0" />
  </>,
  /** A cubist portrait: one face from two angles, which is the whole joke and
   *  the one thing here that reads at any size — a profile cut down the middle,
   *  an eye on each side of it, and only one of them looking at you. */
  cubist: <>
    <path d="M8.8 3.4h8.4v17.2H8.8z" />
    <path d="M8.8 3.4 5 9.6l3.8 5.4" />
    <circle cx="11.6" cy="8.6" r="1.4" />
    <path d="M14.6 7.2h2.6v2.8h-2.6z" />
    <path d="M11.4 15.8h4.4" />
  </>,
} as const

export type AvatarName = keyof typeof AVATARS

export const AVATAR_NAMES = Object.keys(AVATARS) as AvatarName[]

/** True for a face this set actually draws. A stored choice can name one that no
 *  longer exists, and an empty square is not an acceptable answer to "who paid". */
export function isAvatarName(name: string): name is AvatarName {
  return name in AVATARS
}

export function Avatar({ name, className = 'h-5 w-5', style }: {
  name: AvatarName
  className?: string
  /** For the one place that draws a face in a person's own colour rather than
   *  inheriting the text around it. */
  style?: CSSProperties
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className} style={style}
         fill="none" stroke="currentColor" strokeWidth={1.6}
         strokeLinecap="round" strokeLinejoin="round">
      {AVATARS[name] as ReactNode}
    </svg>
  )
}
