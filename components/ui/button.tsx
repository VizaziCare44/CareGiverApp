import { ButtonHTMLAttributes, forwardRef } from 'react'

const base =
  'inline-flex items-center justify-center min-h-touch min-w-touch gap-2 px-5 rounded-lg ' +
  'text-base font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500 focus-visible:ring-offset-2'

const variants = {
  primary: 'bg-sage-600 text-white hover:bg-sage-700 shadow-card',
  secondary: 'bg-surface text-foreground border border-border hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-alert-600 text-white hover:bg-alert-700',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  /** Shows a "Submitting…"/"Saving…" state and disables the button — the
   * only real safeguard against a duplicate booking (FD-ACC §6.5), since no
   * slot-locking exists. */
  loading?: boolean
  loadingText?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading, loadingText = 'Submitting…', disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={[base, variants[variant], className].join(' ')}
        {...props}
      >
        {loading ? loadingText : children}
      </button>
    )
  },
)

Button.displayName = 'Button'
