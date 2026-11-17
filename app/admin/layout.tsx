import { AdminNav } from '@/components/admin/admin-nav'
import { TextLink } from '@/components/ui/text-link'

// The Admin screens are 1280 wide in the Figma frames (FD-VERIFY, sections D to F) on the surface grey, under a
// white bar with the brand and the tabs.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-figma-surface">
      <AdminNav />
      {children}
      <footer className="mx-auto w-full max-w-[1280px] px-4 pb-8 md:px-8">
        <TextLink href="/account/password">Change password</TextLink>
      </footer>
    </div>
  )
}
