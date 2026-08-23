import { formatEur } from '../lib/money'

export interface Chip {
  concept: string
  amount: number
  payer: 0 | 1
}

export function Chips({ chips, active, onPick }: {
  chips: Chip[]
  active: string
  onPick: (chip: Chip) => void
}) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(chip => {
        const on = chip.concept === active
        return (
          <button
            key={chip.concept}
            type="button"
            onClick={() => onPick(chip)}
            aria-pressed={on}
            className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px]
                       focus-visible:outline focus-visible:outline-2"
            style={on
              ? { background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'var(--accent)', fontWeight: 600 }
              : { background: 'var(--surface-2)', color: 'var(--ink-2)', borderColor: 'transparent' }}
          >
            {chip.concept}
            {chip.amount > 0 && (
              <span className="ml-1.5 font-mono opacity-60">{formatEur(chip.amount)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
