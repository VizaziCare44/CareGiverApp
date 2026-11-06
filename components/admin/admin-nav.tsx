'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Main navigation for the Admin screens. Route guarding is in middleware.ts
// (everything under /admin is Admin-only).
const links = [
  // Booking Detail sits under the queue, so the queue stays marked while on it
  { href: '/admin/queue', label: 'Booking queue', alsoUnder: ['/admin/bookings'] },
  { href: '/admin/caregivers', label: 'Caregivers', alsoUnder: [] as string[] },
  // DEV-080: the third tab, after Caregivers (FD-ADMINEXC §7)
  { href: '/admin/exceptions', label: 'Exceptions', alsoUnder: [] as string[] },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="border-b border-figma-line bg-white">
      {/* from 768 wide the tabs sit in a row; under 768 they are three equal tabs, 56px high, and "Booking queue" wraps at 360 */}
      <ul className="mx-auto grid max-w-2xl grid-cols-3 gap-1 px-2 md:flex">
        {links.map((link) => {
          const current = [link.href, ...link.alsoUnder].some((base) => pathname === base || pathname.startsWith(`${base}/`))
          return (
            <li key={link.href} className="min-w-0">
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={[
                  'flex h-14 min-w-touch items-center justify-center px-3 text-center text-[16px] leading-tight text-figma-ink border-b-2 md:inline-flex md:justify-start md:text-left',
                  current ? 'border-figma-softtext font-semibold' : 'border-transparent font-medium',
                ].join(' ')}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
