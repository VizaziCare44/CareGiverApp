import { InputHTMLAttributes, forwardRef, useId } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Inline, on-blur validation message — named in plain language next to
   * the field it belongs to (FD-ACC §6.5 general pattern). */
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, id, className = '', ...props }, ref) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-base font-medium text-foreground">
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined}
        className={[
          'min-h-touch rounded-lg border bg-surface px-4 text-base text-foreground placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust-500',
          error ? 'border-alert-500' : 'border-border',
          className,
        ].join(' ')}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm status-error">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
