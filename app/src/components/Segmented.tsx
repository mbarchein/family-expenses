interface Option {
  label: string
  value: string
  tone?: 'accent' | 'person-1' | 'person-2'
}

export function Segmented({ options, value, onChange }: {
  options: Option[]
  value: string
  onChange: (value: string) => void
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
            aria-pressed={on}
            className="flex-1 rounded-lg border px-1 py-2.5 text-sm font-semibold
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={on ? onStyle(option.tone) : offStyle}
          >
            {option.label}
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
