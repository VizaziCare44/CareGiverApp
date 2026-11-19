'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOutButton } from '@/components/ui/log-out-button'

// The Admin navigation of the Figma frames: a white bar 64 high with "Vizazi Care · Admin" in 18 bold, then the
// tabs 32 to the right of it. The current tab is bold with a 4px primary line under it; the others are medium
// and muted. Route guarding is in middleware.ts (everything under /admin is Admin-only).
const links = [
  // Booking Detail sits under the queue, so the queue stays marked while on it
  { href: '/admin/queue', label: 'Booking Queue', alsoUnder: ['/admin/bookings'] },
  { href: '/admin/caregivers', label: 'Caregivers', alsoUnder: [] as string[] },
  // DEV-080: the third tab, after Caregivers (FD-ADMINEXC §7)
  { href: '/admin/exceptions', label: 'Exceptions', alsoUnder: [] as string[] },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="bg-white">
      {/* from 768 wide: the brand and the tabs in one row, 64 high. Under 768 the brand has its own row and the three tabs are equal columns, 56 high */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-col md:h-16 md:flex-row md:items-center md:gap-8 md:px-8">
        {/* VIZ-201: Log out is at the right of the brand row under 768 wide, and at the far right of the bar from 768 ("md:contents" lets
            the brand and the button join the bar's own row; the button moves after the tabs) */}
        <div className="flex items-center justify-between pb-1 pl-4 pr-2 pt-1 md:contents">
          <p className="text-[18px] font-bold leading-[1.4] text-figma-ink md:p-0">Vizazi Care · Admin</p>
          <LogOutButton className="md:order-last md:ml-auto" />
        </div>
        <ul className="grid grid-cols-3 gap-1 px-2 md:flex md:gap-8 md:p-0">
          {links.map((link) => {
            const current = [link.href, ...link.alsoUnder].some((base) => pathname === base || pathname.startsWith(`${base}/`))
            return (
              <li key={link.href} className="min-w-0">
                <Link
                  href={link.href}
                  aria-current={current ? 'page' : undefined}
                  className={[
                    'flex h-14 min-w-touch items-center justify-center border-b-4 px-1 text-center text-[16px] leading-tight text-figma-ink md:h-16 md:inline-flex md:justify-start md:text-left',
                    current ? 'border-figma-primary font-bold' : 'border-transparent font-medium text-figma-muted',
                  ].join(' ')}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
