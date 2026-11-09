import type { InputHTMLAttributes, ReactNode } from 'react'

// "Caregiver option" of the Admin frames (VER-07, 07c): a 12px-radius card with a 24px radio at the left, 20px
// padding and 16 between the radio and the text. Unselected: white, 1px border. Chosen: the soft teal fill, a 3px
// primary border and the radio filled with a white check, so a choice is never colour alone. The current
// caregiver (disabled) has the surface fill and a grey radio and cannot be chosen. The whole card is the label,
// so the tap target is large; it is a real radio, so the keyboard (arrow keys) and screen readers work as usual.
export function RadioCard({
  children,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode }) {
  return (
    <label
      className={[
        'flex items-start gap-4 rounded-[12px] border p-5',
        'has-[:checked]:border-[3px] has-[:checked]:border-figma-primary has-[:checked]:bg-figma-soft has-[:checked]:p-[18px]',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-figma-primary has-[:focus-visible]:ring-offset-2',
        props.disabled ? 'cursor-not-allowed border-figma-border bg-figma-surface' : 'cursor-pointer border-figma-border bg-white',
        className,
      ].join(' ')}
    >
      <span className="relative flex size-6 shrink-0">
        <input
          type="radio"
          className="peer size-6 shrink-0 appearance-none rounded-full border-2 border-figma-border bg-white checked:border-figma-primary checked:bg-figma-primary focus-visible:outline-none disabled:border-figma-border disabled:bg-figma-line"
          {...props}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto hidden text-white peer-checked:block"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">{children}</span>
    </label>
  )
}
