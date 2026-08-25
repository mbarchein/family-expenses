import type { ReactNode } from 'react'

interface Option {
  label: string
  value: string
  /** Drawn before the label, at the label's colour. The two payer buttons carry
   *  a face here: two names in the same type are told apart by reading them,
   *  and this row is pressed without looking. */
  icon?: ReactNode
  tone?: 'accent' | 'person-1' | 'person-2'
  /** For the segment whose label is the answer rather than the question — the
   *  day one, which reads "10 ago" once a day has been chosen. Without it the
   *  only name the control has is a date, and what it does stops being sayable. */
  ariaLabel?: string
}

export function Segmented({ options, value, onChange, compact, stack }: {
  options: Option[]
  value: string
  onChange: (value: string) => void
  /** Half the height and smaller type. For the row that says which day it is,
   *  which is right nine times out of ten and does not deserve the same weight
   *  as the one that says who paid. */
  compact?: boolean
  /** The drawing above the label instead of beside it, in a button tall enough
   *  to be nearly square. For the two that say who paid: side by side, the face
   *  had a fifth of the width and the word "Paga" had the rest, which is the
   *  wrong way round on the one row of this screen that is aimed at rather than
   *  read. */
  stack?: boolean
}) {
  return (
    <div className="flex gap-1.5">
      {options.map(option => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={option.ariaLabel}
            aria-pressed={on}
            className={'flex flex-1 items-center justify-center rounded-lg border px-1' +
              ' font-semibold' +
              ' focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2' +
              (stack ? ' aspect-[7/5] flex-col gap-1 text-sm'
                : ' gap-1.5' + (compact ? ' py-1.5 text-xs' : ' py-2.5 text-sm'))}
            style={on ? onStyle(option.tone) : offStyle}
          >
            {option.icon}
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const offStyle = {
  borderColor: 'var(--line)',
  color: 'var(--ink-3)',
  background: 'var(--surface)',
}

function onStyle(tone: Option['tone']) {
  const colour =
    tone === 'person-1' ? 'var(--person-1)' :
    tone === 'person-2' ? 'var(--person-2)' :
    'var(--accent)'
  return { borderColor: colour, color: colour, background: 'var(--accent-soft)' }
}
