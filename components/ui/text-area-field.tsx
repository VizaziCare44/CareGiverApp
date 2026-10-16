import type { TextareaHTMLAttributes } from 'react'

// Field/Multiline and Field/Error from the Figma Components page: a 14px medium
// label above a white box with a 1px border, 10px radius and 112px minimum
// height; in error the border is 2px danger red and an alert icon and the
// message sit beneath. The helper text is linked to the box for screen readers.
export function TextAreaField({
  id,
  label,
  helper,
  error,
  className = '',
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id: string
  label: string
  helper?: string
  error?: string | null
}) {
  const describedBy = [helper ? `${id}-helper` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      <label htmlFor={id} className="text-[14px] font-medium leading-[1.4] text-figma-ink">
        {label}
      </label>
      {helper && (
        <p id={`${id}-helper`} className="text-[14px] leading-[1.4] text-figma-muted">
          {helper}
        </p>
      )}
      <textarea
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={[
          'min-h-[112px] w-full resize-y rounded-[10px] bg-white px-[14px] py-3 text-[16px] leading-[1.4] text-figma-ink',
          'placeholder:text-figma-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2',
          error ? 'border-2 border-figma-danger' : 'border border-figma-border',
        ].join(' ')}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-[14px] leading-[1.4] text-figma-danger">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0">
            <circle cx="9" cy="9" r="7.5" />
            <path d="M9 5.2v4.6M9 12.4v.1" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
