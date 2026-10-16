import { Inter } from 'next/font/google'
import { AdminNav } from '@/components/admin/admin-nav'

// The Figma design language uses Inter. Loaded here so only the screens built
// to it (the Admin area) use it; older screens keep the existing font stack.
const inter = Inter({ subsets: ['latin'], display: 'swap' })

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={inter.className}>
      <AdminNav />
      {children}
    </div>
  )
}
