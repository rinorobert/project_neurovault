import { useRef, useState } from 'react'

export function CodeEntry({
  length = 4,
  disabled = false,
  onSubmit,
  shake = false,
  submitLabel = 'Authorize Escape',
}: {
  length?: number
  disabled?: boolean
  onSubmit: (code: string) => void
  shake?: boolean
  submitLabel?: string
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function setDigit(i: number, val: string) {
    const clean = val.replace(/[^0-9]/g, '').slice(-1)
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    if (clean && i < length - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus()
    }
    if (e.key === 'Enter') {
      submit()
    }
  }

  function submit() {
    if (digits.some((d) => d === '')) return
    onSubmit(digits.join(''))
    setDigits(Array(length).fill(''))
    refs.current[0]?.focus()
  }

  const isComplete = digits.every((d) => d !== '')

  return (
    <div className="flex flex-col items-center gap-5">
      <div className={`flex gap-3 ${shake ? 'shake' : ''}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={d}
            disabled={disabled}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            inputMode="numeric"
            maxLength={1}
            aria-label={`Code digit ${i + 1}`}
            className="digit-box w-14 h-16 sm:w-16 sm:h-20 text-center text-3xl sm:text-4xl font-bold rounded-md outline-none transition-colors"
            style={{
              background: 'var(--bg-raised)',
              border: `1px solid ${d ? 'var(--cyan)' : 'var(--line)'}`,
              color: 'var(--text-hi)',
              boxShadow: d ? '0 0 14px rgba(76,224,210,0.25)' : 'none',
            }}
          />
        ))}
      </div>
      <button
        onClick={submit}
        disabled={disabled || !isComplete}
        className="font-display uppercase tracking-[0.2em] text-sm sm:text-base font-semibold px-8 py-3 rounded-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          background: isComplete && !disabled ? 'var(--cyan)' : 'transparent',
          color: isComplete && !disabled ? 'var(--bg-void)' : 'var(--text-mid)',
          border: `1px solid ${isComplete && !disabled ? 'var(--cyan)' : 'var(--line)'}`,
        }}
      >
        {submitLabel}
      </button>
    </div>
  )
}
