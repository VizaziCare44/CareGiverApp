import type { InputHTMLAttributes, ReactNode } from 'react'

// Checkbox/Unchecked and Checkbox/Checked from the Figma Components page: a 24px
// box with a 6px radius and a 2px border, filled with the primary colour and a
// white check when ticked; the label is Inter Regular 16px in ink, 12px away.
// It is a real checkbox, so the keyboard and screen readers work as usual.
export function CheckboxField({
  children,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode }) {
  return (
    <label className={['flex cursor-pointer items-start gap-3 py-[10px]', className].join(' ')}>
      <span className="relative mt-px flex h-6 w-6 shrink-0">
        <input
          type="checkbox"
          className="peer h-6 w-6 shrink-0 cursor-pointer appearance-none rounded-[6px] border-2 border-figma-border bg-white checked:border-figma-primary checked:bg-figma-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2"
          {...props}
        />
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute inset-0 m-auto hidden peer-checked:block"
        >
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
      <span className="text-[16px] leading-[1.4] text-figma-ink">{children}</span>
    </label>
  )
}
