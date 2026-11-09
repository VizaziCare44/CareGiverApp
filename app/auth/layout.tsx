import { inter } from '@/lib/fonts'

// The screen is white and set in Inter, as in the Figma frames (section D of "FD-ACC screens").
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`min-h-screen bg-white ${inter.className}`}>{children}</div>
}
