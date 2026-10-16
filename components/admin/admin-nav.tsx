'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Main navigation for the Admin screens. Route guarding is in middleware.ts
// (everything under /admin is Admin-only).
const links = [
  { href: '/admin/queue', label: 'Booking queue' },
  { href: '/admin/caregivers', label: 'Caregivers' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Main" className="border-b border-figma-line bg-white">
      <ul className="mx-auto flex max-w-2xl gap-1 px-2">
        {links.map((link) => {
          const current = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={[
                  'inline-flex h-14 min-w-touch items-center px-3 text-[16px] text-figma-ink border-b-2',
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
