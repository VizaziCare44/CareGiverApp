import { AdminMain } from '@/components/admin/admin-main'
import { ExceptionsScreen } from '@/components/admin/exceptions-screen'
import { EXCEPTIONS_TEXT } from '@/lib/admin/exceptions-text'

// The Exceptions screen (DEV-080; FD-ADMINEXC §7, frames EXC-01 to EXC-04b): the Admin's read-only list of
// bookings that need a look, derived on every read from the visit records (public.admin_exceptions). Admin only:
// everything under /admin is (middleware.ts), and the view itself returns no row to anyone else. It sends no
// alerts, has no auto-refresh and changes nothing (R-07, R-08).
export default function ExceptionsPage() {
  return (
    <AdminMain>
      <h1 className="text-[28px] font-bold leading-[1.25]">{EXCEPTIONS_TEXT.title}</h1>
      <p className="text-[16px] leading-[1.4] text-figma-muted">{EXCEPTIONS_TEXT.intro}</p>
      <ExceptionsScreen />
    </AdminMain>
  )
}
