import { InputHTMLAttributes, forwardRef, useId } from 'react'

// Field/Default and Field/Error from the Figma Components page: a 14px medium label above a 48px-high white box with
// a 1px border in the border colour, 10px radius, 14px side padding, 16px text (placeholder in the muted colour).
// In error the border is 2px danger red, and beneath it sit an alert icon and the message in 14px danger red, so an
// error is never colour alone. The message is linked to the box for screen readers. No asterisk: a required field
// is named in its label where the frame says so ("Full name (required)").
export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(({ label, error, id, className = '', ...props }, ref) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[14px] font-medium leading-[1.4] text-figma-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[
          'h-12 w-full rounded-[10px] bg-white px-[14px] text-[16px] leading-[1.4] text-figma-ink placeholder:text-figma-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2',
          error ? 'border-2 border-figma-danger' : 'border border-figma-border',
          className,
        ].join(' ')}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[14px] leading-[1.4] text-figma-danger">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
            <path d="M12 3.5l9.5 16.5h-19L12 3.5z" />
            <path d="M12 10v4.5M12 17.4v.1" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})

Field.displayName = 'Field'
