import Link from 'next/link'
import type { ComponentProps } from 'react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

// Button/Primary, Button/Secondary, Button/Destructive and Button/Disabled from
// the Figma Components page: 48px high, 10px radius, Inter semibold 16px. The
// destructive button is outlined in the danger colour, not filled. Disabled is
// the same grey for all three.
const variants = {
  primary: 'bg-figma-primary text-white',
  secondary: 'border-2 border-figma-primary bg-white text-figma-primary',
  destructive: 'border-2 border-figma-danger bg-white text-figma-danger',
} as const

type Variant = keyof typeof variants
// 'compact' is the 44px high button of the Admin tables (frames VER-05, 05b); every other button is 48
type Size = 'default' | 'compact'

function classes(variant: Variant, className: string, size: Size = 'default') {
  return [
    `inline-flex ${size === 'compact' ? 'h-11' : 'h-12'} items-center justify-center rounded-[10px] px-5 text-[16px] font-semibold leading-[1.4]`,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-figma-line disabled:text-figma-muted',
    variants[variant],
    className,
  ].join(' ')
}

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ variant = 'primary', size = 'default', className = '', type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={classes(variant, className, size)} {...props} />
  ),
)

ActionButton.displayName = 'ActionButton'

/** The same button look for something that goes to another screen: a link, not a button. */
export function ActionLink({
  variant = 'primary',
  size = 'default',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={classes(variant, className, size)} {...props} />
}
