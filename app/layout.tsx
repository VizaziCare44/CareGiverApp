import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vizazi Care',
  description: 'Trusted home-based elder care — booking, verification, and visit visibility.',
}

// mobile-first: content sized to the device, no forced zoom-out — per
// docs/UI-UX Designer Skill.md accessibility standards
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
