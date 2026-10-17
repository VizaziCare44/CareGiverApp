import { Inter } from 'next/font/google'

// The Figma design language uses Inter; loaded for the Caregiver screens built to it.
const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function AssignmentsLayout({ children }: { children: React.ReactNode }) {
  return <div className={inter.className}>{children}</div>
}
