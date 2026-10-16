import type { InputHTMLAttributes, ReactNode } from 'react'

// A choice card with a radio on the left, in the same style as CheckboxField
// (24px, 2px border, primary colour when chosen). The whole card is the label,
// so the tap target is large; a disabled choice is muted and cannot be chosen.
// It is a real radio, so the keyboard (arrow keys) and screen readers work as usual.
export function RadioCard({
  children,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children: ReactNode }) {
  return (
    <label
      className={[
        'flex items-start gap-3 rounded-xl border bg-white p-4',
        'has-[:checked]:border-2 has-[:checked]:border-figma-primary has-[:checked]:p-[15px]',
        props.disabled ? 'cursor-not-allowed border-figma-line bg-figma-surface' : 'cursor-pointer border-figma-line',
        className,
      ].join(' ')}
    >
      <span className="relative mt-0.5 flex h-6 w-6 shrink-0">
        <input
          type="radio"
          className="peer h-6 w-6 shrink-0 appearance-none rounded-full border-2 border-figma-border bg-white checked:border-figma-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2 disabled:border-figma-line"
          {...props}
        />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 m-auto hidden h-3 w-3 rounded-full bg-figma-primary peer-checked:block" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">{children}</span>
    </label>
  )
}
