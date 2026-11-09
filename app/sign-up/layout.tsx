import { inter } from '@/lib/fonts'

// The screen is white and set in Inter, as in the Figma frames (ACC-01 to ACC-05).
export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <div className={`min-h-screen bg-white ${inter.className}`}>{children}</div>
}
