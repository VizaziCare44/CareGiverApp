'use server'

import { createClient } from '@/lib/supabase/server'
import { isExceptionRow, type ExceptionRow } from '@/lib/admin/exceptions'

export type LoadExceptionsResult = { ok: true; rows: ExceptionRow[]; loadedAt: string | null } | { ok: false }

// The one read of the Exceptions screen (DEV-080; FD-ADMINEXC §9): the Admin's own session reads
// public.admin_exceptions, ordered by requested time and then booking id (R-04). It is made as a plain request so
// the response's Date header can be returned: that is the "Loaded" time, the server's and not the device's (T3).
// Refresh and Try again call this same action again; nothing is polled (R-08). It returns a result, never a raw
// error, and writes nothing to a log: a reason typed by a caregiver must not reach one (X5).
export async function loadExceptionsAction(): Promise<LoadExceptionsResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return { ok: false }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/admin_exceptions?select=*&order=requested_datetime.asc,booking_id.asc`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false }
    const body: unknown = await response.json()
    if (!Array.isArray(body) || !body.every(isExceptionRow)) return { ok: false }
    return { ok: true, rows: body, loadedAt: response.headers.get('date') }
  } catch {
    return { ok: false }
  }
}
