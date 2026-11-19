import Link from 'next/link'
import type { ComponentProps } from 'react'

// "Text link (44 tap target)" from the Figma frames: primary colour, Inter semibold 16px, underlined, 44px high.
// The classes are shared with Log out (components/ui/log-out-button.tsx), which is a button but must look the same.
export const TEXT_LINK_CLASS = [
  'inline-flex h-11 items-center rounded-lg text-[16px] font-semibold leading-[1.4] text-figma-primary underline',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-figma-primary',
].join(' ')

// `block` makes it full width and centred, as under the main button of Sign Up and Log In; otherwise it is as wide
// as its words (My bookings, Forgot password?).
export function TextLink({ block = false, className = '', ...props }: ComponentProps<typeof Link> & { block?: boolean }) {
  return <Link className={[TEXT_LINK_CLASS, block ? 'w-full justify-center' : '', className].join(' ')} {...props} />
}
